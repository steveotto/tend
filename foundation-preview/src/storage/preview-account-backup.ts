import {
  createPreviewEnvelope,
  parsePreviewBackup,
  PREVIEW_SCHEMA_VERSION
} from '../domain/preview-state.ts';
import type {
  PreviewData,
  PreviewEnvelope,
  PreviewValidationDiagnostic
} from '../domain/preview-state.ts';

export type PreviewAccountBackupRecord = {
  document: unknown;
  schemaVersion: number;
  revision: number;
  updatedAt: string | null;
};

export type PreviewAccountRecoveryArchive = {
  document: unknown;
  schemaVersion: number;
  revision: number;
  updatedAt: string;
  preservedAt: string;
};

export type PreviewAccountBackupApi = {
  read: () => Promise<PreviewAccountBackupRecord | null>;
  save: (document: PreviewEnvelope, expectedRevision: number) => Promise<number>;
  preserveRecovery?: (expectedRevision: number) => Promise<number>;
  readRecovery?: (sourceRevision: number) => Promise<PreviewAccountRecoveryArchive | null>;
  listRecoveries?: () => Promise<PreviewAccountRecoveryArchive[]>;
};

type SupabaseResult = {
  data: unknown;
  error: unknown;
};

export type PreviewAccountBackupSupabaseClient = {
  from: (table: 'tend_preview_backups') => {
    select: (columns: 'document,revision,schema_version,updated_at') => {
      maybeSingle: () => PromiseLike<SupabaseResult>;
    };
  };
  rpc: {
    (
      functionName: 'tend_save_preview_backup',
      parameters: {
        p_document: PreviewEnvelope;
        p_expected_revision: number;
        p_schema_version: number;
      }
    ): PromiseLike<SupabaseResult>;
    (
      functionName: 'tend_preserve_preview_backup',
      parameters: { p_expected_revision: number }
    ): PromiseLike<SupabaseResult>;
    (
      functionName: 'tend_read_preview_backup_recovery',
      parameters: { p_source_revision: number }
    ): PromiseLike<SupabaseResult>;
    (
      functionName: 'tend_list_preview_backup_recoveries',
      parameters: Record<string, never>
    ): PromiseLike<SupabaseResult>;
  };
};

export class PreviewAccountBackupError extends Error {
  constructor(
    readonly kind: 'stale' | 'request' | 'invalid' | 'recovery-conflict',
    message: string,
    readonly diagnostic?: PreviewValidationDiagnostic
  ) {
    super(message);
    this.name = 'PreviewAccountBackupError';
  }
}

export type ValidatedPreviewAccountBackup = {
  data: PreviewData;
  envelope: PreviewEnvelope;
  sourceSchemaVersion: number;
};

export function createPreviewAccountBackupApi(
  client: PreviewAccountBackupSupabaseClient
): PreviewAccountBackupApi {
  let inFlightRead: Promise<PreviewAccountBackupRecord | null> | null = null;
  async function readFromClient(): Promise<PreviewAccountBackupRecord | null> {
    const { data, error } = await client
      .from('tend_preview_backups')
      .select('document,revision,schema_version,updated_at')
      .maybeSingle();
    if (error !== null) {
      throw new PreviewAccountBackupError(
        'request',
        'The account backup could not be read. Check the connection and that Preview storage is configured.'
      );
    }
    if (data === null) return null;
    if (!isRecord(data)
      || !Number.isSafeInteger(data.revision)
      || (data.revision as number) < 1
      || !Number.isSafeInteger(data.schema_version)
      || (data.schema_version as number) < 1
      || (data.updated_at !== null && typeof data.updated_at !== 'string')) {
      throw new PreviewAccountBackupError(
        'invalid',
        'The account backup record is incomplete or invalid. No data was changed.'
      );
    }
    return {
      document: data.document,
      revision: data.revision as number,
      schemaVersion: data.schema_version as number,
      updatedAt: data.updated_at as string | null
    };
  }

  function assertRevision(revision: number, label: string) {
    if (!Number.isSafeInteger(revision) || revision < 1) {
      throw new PreviewAccountBackupError(
        'invalid',
        `The ${label} revision is invalid. No account data was changed.`
      );
    }
  }

  function throwRecoveryRpcError(error: unknown, action: 'preserve' | 'read'): never {
    const code = errorCode(error);
    const message = isRecord(error) && typeof error.message === 'string'
      ? error.message
      : '';
    if (code === 'P0001' && message === 'Stale Preview backup revision') {
      throw new PreviewAccountBackupError(
        'stale',
        'The account backup changed before its recovery copy was preserved. No replacement was attempted; review the latest copy.'
      );
    }
    if (code === 'P0001' && message === 'Preview recovery archive conflict') {
      throw new PreviewAccountBackupError(
        'recovery-conflict',
        'A different recovery copy already exists for this account revision. It was left unchanged; no account data was replaced.'
      );
    }
    throw new PreviewAccountBackupError(
      'request',
      action === 'preserve'
        ? 'The previous account copy could not be preserved. No account replacement was attempted.'
        : 'The preserved account copy could not be read. No account replacement was attempted.'
    );
  }

  function parseRecoveryArchive(value: unknown): PreviewAccountRecoveryArchive {
    if (!isRecord(value)
      || !Number.isSafeInteger(value.revision)
      || (value.revision as number) < 1
      || !Number.isSafeInteger(value.schemaVersion)
      || (value.schemaVersion as number) < 1
      || typeof value.updatedAt !== 'string'
      || typeof value.preservedAt !== 'string'
      || !('document' in value)) {
      throw new PreviewAccountBackupError(
        'invalid',
        'The preserved account copy is incomplete or invalid. No account data was replaced.'
      );
    }
    return {
      document: value.document,
      schemaVersion: value.schemaVersion as number,
      revision: value.revision as number,
      updatedAt: value.updatedAt,
      preservedAt: value.preservedAt
    };
  }

  return {
    read() {
      if (inFlightRead) return inFlightRead;
      const request = readFromClient();
      inFlightRead = request;
      const release = () => {
        if (inFlightRead === request) inFlightRead = null;
      };
      void request.then(release, release);
      return request;
    },
    async save(document, expectedRevision) {
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
        throw new PreviewAccountBackupError(
          'invalid',
          'The account backup revision is invalid. No data was changed.'
        );
      }
      const { data, error } = await client.rpc('tend_save_preview_backup', {
        p_document: document,
        p_expected_revision: expectedRevision,
        p_schema_version: PREVIEW_SCHEMA_VERSION
      });
      if (error !== null) {
        if (errorCode(error) === '40001'
          || (errorCode(error) === 'P0001'
            && isRecord(error)
            && error.message === 'Stale Preview backup revision')) {
          throw new PreviewAccountBackupError(
            'stale',
            'The account backup changed after you reviewed it. No data was replaced; review the latest copy and try again.'
          );
        }
        throw new PreviewAccountBackupError(
          'request',
          'The account backup could not be saved. Check the connection and that Preview storage is configured.'
        );
      }
      const revision = typeof data === 'number' ? data : Number(data);
      if (!Number.isSafeInteger(revision) || revision < 1) {
        throw new PreviewAccountBackupError(
          'invalid',
          'The backup service returned an invalid revision. Check the account backup before continuing.'
        );
      }
      return revision;
    },
    async preserveRecovery(expectedRevision) {
      assertRevision(expectedRevision, 'account backup');
      const { data, error } = await client.rpc('tend_preserve_preview_backup', {
        p_expected_revision: expectedRevision
      });
      if (error !== null) throwRecoveryRpcError(error, 'preserve');
      const revision = typeof data === 'number' ? data : Number(data);
      if (!Number.isSafeInteger(revision) || revision !== expectedRevision) {
        throw new PreviewAccountBackupError(
          'invalid',
          'The recovery service returned an unexpected revision. No account replacement was attempted.'
        );
      }
      return revision;
    },
    async readRecovery(sourceRevision) {
      assertRevision(sourceRevision, 'recovery archive');
      const { data, error } = await client.rpc('tend_read_preview_backup_recovery', {
        p_source_revision: sourceRevision
      });
      if (error !== null) throwRecoveryRpcError(error, 'read');
      return data === null ? null : parseRecoveryArchive(data);
    },
    async listRecoveries() {
      const { data, error } = await client.rpc('tend_list_preview_backup_recoveries', {});
      if (error !== null) throwRecoveryRpcError(error, 'read');
      if (!Array.isArray(data)) {
        throw new PreviewAccountBackupError(
          'invalid',
          'The account recovery archive list is incomplete or invalid.'
        );
      }
      return data.map(parseRecoveryArchive);
    }
  };
}

export function validatePreviewAccountBackup(
  record: PreviewAccountBackupRecord,
  currentDate: string
): ValidatedPreviewAccountBackup {
  const documentSchemaVersion = isRecord(record.document)
    ? record.document.schemaVersion
    : null;
  if (documentSchemaVersion !== record.schemaVersion) {
    const diagnostic = {
      code: 'preview.account-backup.schema-mismatch',
      path: 'schemaVersion'
    };
    throw new PreviewAccountBackupError(
      'invalid',
      `The account backup schema does not match its stored version. Diagnostic: ${formatDiagnostic(diagnostic)}. No local data was changed.`,
      diagnostic
    );
  }
  const parsed = parsePreviewBackup(JSON.stringify(record.document), currentDate);
  if (!parsed.valid) {
    const diagnostic = parsed.diagnostic ?? {
      code: 'preview.validation.failed',
      path: 'document'
    };
    throw new PreviewAccountBackupError(
      'invalid',
      `${parsed.kind === 'unsupported'
        ? 'The account backup schema is not supported.'
        : 'The account backup could not be validated.'} Diagnostic: ${formatDiagnostic(diagnostic)}. No local data was changed.`,
      diagnostic
    );
  }
  return {
    data: parsed.envelope.data,
    envelope: parsed.envelope,
    sourceSchemaVersion: parsed.sourceSchemaVersion
  };
}

export function createValidatedPreviewAccountDocument(
  data: PreviewData,
  currentDate: string
): PreviewEnvelope {
  const envelope = createPreviewEnvelope(data);
  const parsed = parsePreviewBackup(JSON.stringify(envelope), currentDate);
  if (!parsed.valid || parsed.sourceSchemaVersion !== PREVIEW_SCHEMA_VERSION) {
    const diagnostic = !parsed.valid
      ? parsed.diagnostic ?? { code: 'preview.validation.failed', path: 'document' }
      : { code: 'preview.backup.schema-mismatch', path: 'schemaVersion' };
    throw new PreviewAccountBackupError(
      'invalid',
      `This browser’s preview data could not be validated for backup. Diagnostic: ${formatDiagnostic(diagnostic)}. No account data was changed.`,
      diagnostic
    );
  }
  return parsed.envelope;
}

export function previewEnvelopesEqual(left: PreviewEnvelope, right: PreviewEnvelope): boolean {
  return stableJson(left) === stableJson(right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort()
      .map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function errorCode(value: unknown): string | null {
  return isRecord(value) && typeof value.code === 'string' ? value.code : null;
}

function formatDiagnostic(diagnostic: PreviewValidationDiagnostic): string {
  const counts = diagnostic.strengthCompletionLinks;
  if (!counts) return `${diagnostic.code} at ${diagnostic.path}`;
  return `${diagnostic.code} at ${diagnostic.path}; workout relationships: ${counts.workouts} total, `
    + `${counts.linked} linked, ${counts.unlinked} unlinked, ${counts.invalid} invalid `
    + `(incomplete ${counts.incompleteLink}, missing Rhythm ${counts.missingRhythm}, `
    + `non-Health Rhythm ${counts.nonHealthRhythm}, missing completion ${counts.missingCompletion}, `
    + `Rhythm mismatch ${counts.rhythmMismatch}, date mismatch ${counts.dateMismatch}, `
    + `repeated completion ${counts.repeatedCompletion}, archived Rhythm ${counts.archivedRhythm})`;
}
