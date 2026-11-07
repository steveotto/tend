import {
  createPreviewEnvelope,
  parsePreviewBackup,
  PREVIEW_SCHEMA_VERSION
} from '../domain/preview-state.ts';
import type { PreviewData, PreviewEnvelope } from '../domain/preview-state.ts';

export type PreviewAccountBackupRecord = {
  document: unknown;
  schemaVersion: number;
  revision: number;
  updatedAt: string | null;
};

export type PreviewAccountBackupApi = {
  read: () => Promise<PreviewAccountBackupRecord | null>;
  save: (document: PreviewEnvelope, expectedRevision: number) => Promise<number>;
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
  rpc: (
    functionName: 'tend_save_preview_backup',
    parameters: {
      p_document: PreviewEnvelope;
      p_expected_revision: number;
      p_schema_version: number;
    }
  ) => PromiseLike<SupabaseResult>;
};

export class PreviewAccountBackupError extends Error {
  constructor(
    readonly kind: 'stale' | 'request' | 'invalid',
    message: string
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
  return {
    async read() {
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
        if (errorCode(error) === '40001') {
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
    throw new PreviewAccountBackupError(
      'invalid',
      'The account backup schema does not match its stored version. No local data was changed.'
    );
  }
  const parsed = parsePreviewBackup(JSON.stringify(record.document), currentDate);
  if (!parsed.valid) {
    throw new PreviewAccountBackupError(
      'invalid',
      `The account backup could not be validated: ${parsed.message} No local data was changed.`
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
    throw new PreviewAccountBackupError(
      'invalid',
      'This browser’s preview data could not be validated for backup. No account data was changed.'
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
