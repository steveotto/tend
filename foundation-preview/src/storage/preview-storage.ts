import { createPreviewEnvelope, parsePreviewBackup, PREVIEW_SCHEMA_VERSION } from '../domain/preview-state.ts';
import type { PreviewData } from '../domain/preview-state.ts';
import { migratePreviewToProposedV4 } from '../domain/preview-v4-migration.ts';
import {
  DEVELOPMENT_PREVIEW_IDENTITY,
  validatePreviewIdentity
} from '../domain/preview-identity.ts';
import type { PreviewIdentityState } from '../domain/preview-identity.ts';
import {
  PREVIEW_STORAGE_KEY,
  PREVIEW_RAW_RECOVERY_KEY,
  PREVIEW_V1_RECOVERY_KEY,
  PREVIEW_V2_RECOVERY_KEY,
  PREVIEW_V3_RECOVERY_KEY,
  PREVIEW_V4_RECOVERY_KEY,
  PREVIEW_V5_RECOVERY_KEY,
  PREVIEW_V6_RECOVERY_KEY,
  PREVIEW_V7_RECOVERY_KEY,
  PREVIEW_V8_RECOVERY_KEY,
  PREVIEW_V9_RECOVERY_KEY,
  PREVIEW_V10_RECOVERY_KEY,
  PREVIEW_V11_RECOVERY_KEY,
  PREVIEW_V12_RECOVERY_KEY,
  PREVIEW_V13_RECOVERY_KEY,
  PREVIEW_V14_RECOVERY_KEY,
  PREVIEW_V15_RECOVERY_KEY,
  PREVIEW_V16_RECOVERY_KEY,
  PREVIEW_V17_RECOVERY_KEY,
  PREVIEW_V18_RECOVERY_KEY,
  PREVIEW_V19_RECOVERY_KEY,
  PREVIEW_V20_RECOVERY_KEY,
  PREVIEW_V21_RECOVERY_KEY,
  PREVIEW_V22_RECOVERY_KEY,
  PREVIEW_V23_RECOVERY_KEY,
  PREVIEW_V24_RECOVERY_KEY,
  PREVIEW_V25_RECOVERY_KEY,
  PREVIEW_V26_RECOVERY_KEY,
  PREVIEW_V27_RECOVERY_KEY,
  PREVIEW_V28_RECOVERY_KEY,
  PREVIEW_V29_RECOVERY_KEY,
  PREVIEW_V30_RECOVERY_KEY,
  PREVIEW_V31_RECOVERY_KEY,
  PREVIEW_V32_RECOVERY_KEY,
  PREVIEW_V33_RECOVERY_KEY,
  PREVIEW_V34_RECOVERY_KEY,
  PREVIEW_V35_RECOVERY_KEY,
  PREVIEW_V36_RECOVERY_KEY,
  PREVIEW_V37_RECOVERY_KEY,
  PREVIEW_V38_RECOVERY_KEY,
  PREVIEW_V39_RECOVERY_KEY,
  preserveProposedV4SourceRecovery,
  proposedV4RecoveryKeyForRaw,
  proposedV4SourceVersionForRaw
} from './preview-v4-recovery.ts';

export {
  PREVIEW_STORAGE_KEY,
  PREVIEW_RAW_RECOVERY_KEY,
  PREVIEW_V1_RECOVERY_KEY,
  PREVIEW_V2_RECOVERY_KEY,
  PREVIEW_V3_RECOVERY_KEY,
  PREVIEW_V4_RECOVERY_KEY,
  PREVIEW_V5_RECOVERY_KEY,
  PREVIEW_V6_RECOVERY_KEY,
  PREVIEW_V7_RECOVERY_KEY,
  PREVIEW_V8_RECOVERY_KEY,
  PREVIEW_V9_RECOVERY_KEY,
  PREVIEW_V10_RECOVERY_KEY,
  PREVIEW_V11_RECOVERY_KEY,
  PREVIEW_V12_RECOVERY_KEY,
  PREVIEW_V13_RECOVERY_KEY,
  PREVIEW_V14_RECOVERY_KEY,
  PREVIEW_V15_RECOVERY_KEY,
  PREVIEW_V16_RECOVERY_KEY,
  PREVIEW_V17_RECOVERY_KEY,
  PREVIEW_V18_RECOVERY_KEY,
  PREVIEW_V19_RECOVERY_KEY,
  PREVIEW_V20_RECOVERY_KEY,
  PREVIEW_V21_RECOVERY_KEY,
  PREVIEW_V22_RECOVERY_KEY,
  PREVIEW_V23_RECOVERY_KEY,
  PREVIEW_V24_RECOVERY_KEY,
  PREVIEW_V25_RECOVERY_KEY,
  PREVIEW_V26_RECOVERY_KEY,
  PREVIEW_V27_RECOVERY_KEY,
  PREVIEW_V28_RECOVERY_KEY,
  PREVIEW_V29_RECOVERY_KEY,
  PREVIEW_V30_RECOVERY_KEY,
  PREVIEW_V31_RECOVERY_KEY,
  PREVIEW_V32_RECOVERY_KEY,
  PREVIEW_V33_RECOVERY_KEY,
  PREVIEW_V34_RECOVERY_KEY,
  PREVIEW_V35_RECOVERY_KEY,
  PREVIEW_V36_RECOVERY_KEY,
  PREVIEW_V37_RECOVERY_KEY,
  PREVIEW_V38_RECOVERY_KEY,
  PREVIEW_V39_RECOVERY_KEY
};

export const PREVIEW_CATEGORY_RECOVERY_KEY = `${PREVIEW_STORAGE_KEY}:v32-category-recovery`;
export const PREVIEW_CLOUD_RESTORE_RECOVERY_KEY = `${PREVIEW_STORAGE_KEY}:cloud-restore-recovery`;
export const PREVIEW_IMPORT_RECOVERY_KEY = `${PREVIEW_STORAGE_KEY}:import-recovery`;
export const PREVIEW_IMPORT_SYNC_GUARD_KEY = `${PREVIEW_STORAGE_KEY}:import-sync-guard`;
export const PREVIEW_ACCOUNT_STORAGE_PREFIX = 'tend2:preview:account';
const previewImportRecoveryFormat = 'tend.preview-import-recovery';
const previewImportSyncGuardFormat = 'tend.preview-import-sync-guard';

export type PreviewStorage = Pick<Storage, 'getItem' | 'setItem'> & Partial<Pick<Storage, 'removeItem'>>;
export type PreviewStorageScope = {
  key: string;
  storage: PreviewStorage;
};

export type PreviewLoadResult =
  | { kind: 'missing' }
  | { kind: 'loaded'; data: PreviewData; raw: string }
  | { kind: 'corrupt'; raw: string; message: string }
  | { kind: 'unsupported'; raw: string; message: string }
  | { kind: 'unavailable'; message: string };

export type PreviewWriteResult =
  | { kind: 'saved'; raw: string }
  | { kind: 'conflict'; actualRaw: string | null }
  | { kind: 'error'; message: string; diagnostic?: PreviewStorageDiagnostic };

export type RecoveryCopyReadResult =
  | { kind: 'loaded'; raw: string | null }
  | { kind: 'error'; message: string };

export type CloudRestoreRecoveryResult =
  | { kind: 'preserved' }
  | { kind: 'not-needed' }
  | { kind: 'conflict'; message: string }
  | { kind: 'error'; message: string };

export type PreviewImportRecoveryReadResult =
  | { kind: 'loaded'; latestRaw: string | null; latestSourceRaw: string | null; archiveRaw: string | null }
  | { kind: 'error'; message: string };

export type PreviewImportSyncGuard =
  | { kind: 'none' }
  | { kind: 'pending'; importedRaw: string }
  | { kind: 'resolved'; importedRaw: string };

export type PreviewImportSyncGuardReadResult =
  | { kind: 'loaded'; guard: PreviewImportSyncGuard }
  | { kind: 'error'; message: string };

export type PreviewImportSyncGuardResolveResult =
  | { kind: 'resolved' }
  | { kind: 'error'; message: string };

export type PreviewWriteOptions = {
  allowUnrecoverableReplacement?: boolean;
  currentDate?: string;
  importSourceRaw?: string;
  operation?: 'save' | 'import' | 'reset' | 'replace';
};

export type PreviewStorageDiagnostic = {
  operation: NonNullable<PreviewWriteOptions['operation']>;
  sourceSchemaVersion: number | null;
  applicationSchemaVersion: number;
  rejectedRule: string;
  recoveryKeyLookup: 'exact-copy-present' | 'available-not-created' | 'conflicting-copy' | 'no-supported-key' | 'not-required' | 'unavailable';
  migrationValidation: 'valid' | 'invalid' | 'not-run';
  concurrentModification: 'detected' | 'not-detected' | 'not-checked';
  latestDraft: 'failed';
  failureDetail?: string;
};

export function createPreviewStorageScope(
  storage: PreviewStorage,
  identity: PreviewIdentityState
): PreviewStorageScope | null {
  const validatedIdentity = validatePreviewIdentity(identity);
  if (validatedIdentity.kind === 'development') return { key: PREVIEW_STORAGE_KEY, storage };
  if (validatedIdentity.kind !== 'authenticated') return null;

  const accountRoot = `${PREVIEW_ACCOUNT_STORAGE_PREFIX}:${validatedIdentity.accountId}`;
  const mapKey = (key: string) => key === PREVIEW_STORAGE_KEY
    ? accountRoot
    : key.startsWith(`${PREVIEW_STORAGE_KEY}:`)
      ? `${accountRoot}${key.slice(PREVIEW_STORAGE_KEY.length)}`
      : key;
  return {
    key: accountRoot,
    storage: {
      getItem: key => storage.getItem(mapKey(key)),
      setItem: (key, value) => storage.setItem(mapKey(key), value),
      ...(storage.removeItem ? { removeItem: (key: string) => storage.removeItem?.(mapKey(key)) } : {})
    }
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Browser storage is unavailable.';
}

function parseImportRecoveryArchive(raw: string): { copies: string[]; sources: string[] } {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('The saved import recovery archive is invalid and was not changed.');
  }
  const archive = parsed as Record<string, unknown>;
  if (archive.format !== previewImportRecoveryFormat
    || archive.schemaVersion !== 1
    || !Array.isArray(archive.copies)
    || !archive.copies.every(copy => typeof copy === 'string')
    || !Array.isArray(archive.sources)
    || !archive.sources.every(source => typeof source === 'string')
    || Object.keys(archive).some(key => !['format', 'schemaVersion', 'copies', 'sources'].includes(key))) {
    throw new Error('The saved import recovery archive is invalid and was not changed.');
  }
  return { copies: archive.copies, sources: archive.sources };
}

function serializeImportSyncGuard(guard: PreviewImportSyncGuard): string {
  return JSON.stringify({
    format: previewImportSyncGuardFormat,
    schemaVersion: 1,
    ...guard
  });
}

function parseImportSyncGuard(raw: string): PreviewImportSyncGuard {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('The saved import sync guard is invalid. Account sync was paused.');
  }
  const guard = parsed as Record<string, unknown>;
  const expectedKeys = guard.kind === 'none'
    ? ['format', 'schemaVersion', 'kind']
    : ['format', 'schemaVersion', 'kind', 'importedRaw'];
  if (guard.format !== previewImportSyncGuardFormat
    || guard.schemaVersion !== 1
    || !['none', 'pending', 'resolved'].includes(String(guard.kind))
    || (guard.kind !== 'none' && typeof guard.importedRaw !== 'string')
    || Object.keys(guard).some(key => !expectedKeys.includes(key))) {
    throw new Error('The saved import sync guard is invalid. Account sync was paused.');
  }
  if (guard.kind === 'none') return { kind: 'none' };
  return {
    kind: guard.kind as 'pending' | 'resolved',
    importedRaw: guard.importedRaw as string
  };
}

export function loadPreviewImportSyncGuard(storage: PreviewStorage): PreviewImportSyncGuardReadResult {
  try {
    const raw = storage.getItem(PREVIEW_IMPORT_SYNC_GUARD_KEY);
    return { kind: 'loaded', guard: raw === null ? { kind: 'none' } : parseImportSyncGuard(raw) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function resolvePreviewImportSyncGuard(
  storage: PreviewStorage,
  expectedImportedRaw: string
): PreviewImportSyncGuardResolveResult {
  try {
    const loaded = loadPreviewImportSyncGuard(storage);
    if (loaded.kind === 'error') return loaded;
    if (loaded.guard.kind === 'resolved' && loaded.guard.importedRaw === expectedImportedRaw) {
      return { kind: 'resolved' };
    }
    if (loaded.guard.kind !== 'pending' || loaded.guard.importedRaw !== expectedImportedRaw) {
      return {
        kind: 'error',
        message: 'The imported preview changed before its sync choice was saved. Account sync remains paused.'
      };
    }
    const serialized = serializeImportSyncGuard({ kind: 'resolved', importedRaw: expectedImportedRaw });
    storage.setItem(PREVIEW_IMPORT_SYNC_GUARD_KEY, serialized);
    if (storage.getItem(PREVIEW_IMPORT_SYNC_GUARD_KEY) !== serialized) {
      return {
        kind: 'error',
        message: 'The imported preview sync choice could not be verified. Account sync remains paused.'
      };
    }
    return { kind: 'resolved' };
  } catch (error) {
    return {
      kind: 'error',
      message: `The imported preview sync choice could not be saved: ${errorMessage(error)}`
    };
  }
}

function restoreImportMetadata(
  storage: PreviewStorage,
  key: string,
  previousRaw: string | null,
  emptyRaw: string
): void {
  if (previousRaw !== null) {
    storage.setItem(key, previousRaw);
  } else if (storage.removeItem) {
    storage.removeItem(key);
  } else {
    storage.setItem(key, emptyRaw);
  }
}

export function loadPreviewImportRecovery(storage: PreviewStorage): PreviewImportRecoveryReadResult {
  try {
    const archiveRaw = storage.getItem(PREVIEW_IMPORT_RECOVERY_KEY);
    if (archiveRaw === null) {
      return { kind: 'loaded', latestRaw: null, latestSourceRaw: null, archiveRaw: null };
    }
    const archive = parseImportRecoveryArchive(archiveRaw);
    return {
      kind: 'loaded',
      latestRaw: archive.copies.length > 0 ? archive.copies[archive.copies.length - 1]! : null,
      latestSourceRaw: archive.sources.length > 0 ? archive.sources[archive.sources.length - 1]! : null,
      archiveRaw
    };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

type RawRecoveryResult =
  | { kind: 'preserved' }
  | { kind: 'conflict' }
  | { kind: 'active-conflict' }
  | { kind: 'error'; message: string };

function preserveUnclassifiedSourceRecovery(storage: PreviewStorage, raw: string): RawRecoveryResult {
  try {
    if (storage.getItem(PREVIEW_STORAGE_KEY) !== raw) return { kind: 'active-conflict' };
    const existing = storage.getItem(PREVIEW_RAW_RECOVERY_KEY);
    if (existing !== null && existing !== raw) return { kind: 'conflict' };
    if (existing === null) storage.setItem(PREVIEW_RAW_RECOVERY_KEY, raw);
    if (storage.getItem(PREVIEW_STORAGE_KEY) !== raw) return { kind: 'active-conflict' };
    if (storage.getItem(PREVIEW_RAW_RECOVERY_KEY) !== raw) {
      return { kind: 'error', message: 'The exact raw recovery copy could not be verified.' };
    }
    return { kind: 'preserved' };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

function diagnosticForWriteFailure(
  storage: PreviewStorage,
  sourceRaw: string | null,
  currentDate: string | undefined,
  operation: NonNullable<PreviewWriteOptions['operation']>,
  rejectedRule: string,
  concurrentModification: PreviewStorageDiagnostic['concurrentModification'],
  failureDetail?: string
): PreviewStorageDiagnostic {
  let sourceSchemaVersion: number | null = null;
  if (sourceRaw !== null) {
    try {
      const source: unknown = JSON.parse(sourceRaw);
      if (typeof source === 'object' && source !== null && !Array.isArray(source)
        && 'schemaVersion' in source && typeof source.schemaVersion === 'number') {
        sourceSchemaVersion = source.schemaVersion;
      }
    } catch {
      sourceSchemaVersion = null;
    }
  }
  const validation = sourceRaw !== null && currentDate
    ? parsePreviewBackup(sourceRaw, currentDate)
    : null;
  const mappedRecoveryKey = sourceRaw === null ? null : proposedV4RecoveryKeyForRaw(sourceRaw);
  const recoveryKey = mappedRecoveryKey
    ?? (sourceRaw === null
      ? null
      : validation?.valid ? null : PREVIEW_RAW_RECOVERY_KEY);
  let recoveryKeyLookup: PreviewStorageDiagnostic['recoveryKeyLookup'] = 'not-required';
  if (recoveryKey !== null && sourceRaw !== null) {
    try {
      const existing = storage.getItem(recoveryKey);
      recoveryKeyLookup = existing === sourceRaw
        ? 'exact-copy-present'
        : existing === null
          ? 'available-not-created'
          : 'conflicting-copy';
    } catch {
      recoveryKeyLookup = 'unavailable';
    }
  } else if (sourceRaw !== null && sourceSchemaVersion !== PREVIEW_SCHEMA_VERSION) {
    recoveryKeyLookup = 'no-supported-key';
  }
  return {
    operation,
    sourceSchemaVersion,
    applicationSchemaVersion: PREVIEW_SCHEMA_VERSION,
    rejectedRule,
    recoveryKeyLookup,
    migrationValidation: validation === null ? 'not-run' : validation.valid ? 'valid' : 'invalid',
    concurrentModification,
    latestDraft: 'failed',
    ...(failureDetail ? { failureDetail } : {})
  };
}

export function loadPreview(storage: PreviewStorage, currentDate: string): PreviewLoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(PREVIEW_STORAGE_KEY);
  } catch (error) {
    return { kind: 'unavailable', message: errorMessage(error) };
  }
  if (raw === null) return { kind: 'missing' };

  const parsed = migratePreviewToProposedV4(raw, currentDate);
  if (!parsed.valid) {
    return parsed.kind === 'unsupported'
      ? { kind: 'unsupported', raw, message: parsed.message }
      : { kind: 'corrupt', raw, message: parsed.message };
  }
  return { kind: 'loaded', data: parsed.envelope.data, raw };
}

export function loadRawRecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_RAW_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadCloudRestoreRecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function preservePreviewBeforeCloudRestore(
  storage: PreviewStorage,
  expectedRaw: string | null
): CloudRestoreRecoveryResult {
  try {
    if (storage.getItem(PREVIEW_STORAGE_KEY) !== expectedRaw) {
      return {
        kind: 'conflict',
        message: 'This browser’s preview changed before it could be preserved. Nothing was restored.'
      };
    }
    if (expectedRaw === null) return { kind: 'not-needed' };

    const existing = storage.getItem(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY);
    if (existing !== null && existing !== expectedRaw) {
      return {
        kind: 'conflict',
        message: 'An earlier pre-restore recovery copy contains different data. Download or preserve that copy before trying another restore.'
      };
    }
    if (existing === null) storage.setItem(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY, expectedRaw);
    if (storage.getItem(PREVIEW_STORAGE_KEY) !== expectedRaw) {
      return {
        kind: 'conflict',
        message: 'This browser’s preview changed while its recovery copy was being made. Nothing was restored.'
      };
    }
    if (storage.getItem(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY) !== expectedRaw) {
      return {
        kind: 'error',
        message: 'The exact pre-restore recovery copy could not be verified. Nothing was restored.'
      };
    }
    return { kind: 'preserved' };
  } catch (error) {
    return {
      kind: 'error',
      message: `The pre-restore recovery copy could not be saved: ${errorMessage(error)}`
    };
  }
}

export function writePreview(
  storage: PreviewStorage,
  data: PreviewData,
  expectedRaw: string | null,
  options: PreviewWriteOptions = {}
): PreviewWriteResult {
  const operation = options.operation ?? 'save';
  let rawRecoveryExpected: string | null = null;
  let activeSourceCompared = false;
  try {
    const actualRaw = storage.getItem(PREVIEW_STORAGE_KEY);
    if (actualRaw !== expectedRaw) return { kind: 'conflict', actualRaw };
    activeSourceCompared = true;
    const raw = JSON.stringify(createPreviewEnvelope(data));

    if (expectedRaw !== null) {
      const sourceVersion = proposedV4SourceVersionForRaw(expectedRaw);
      const source = options.currentDate ? parsePreviewBackup(expectedRaw, options.currentDate) : { valid: false as const };
      if (!source.valid && !options.allowUnrecoverableReplacement) {
        return {
          kind: 'error',
          message: sourceVersion === 9 || sourceVersion === 10 || sourceVersion === 11
            ? 'The active preview data is malformed and cannot be replaced without an explicit raw backup.'
            : 'The saved preview could not be verified, so no changes were written. Download its raw recovery before explicitly replacing it.',
          diagnostic: diagnosticForWriteFailure(
            storage,
            expectedRaw,
            options.currentDate,
            operation,
            'source-validation-failed',
            'not-detected'
          )
        };
      }
      if (!source.valid && sourceVersion === null && options.allowUnrecoverableReplacement) {
        const recovery = preserveUnclassifiedSourceRecovery(storage, expectedRaw);
        if (recovery.kind !== 'preserved') {
          return {
            kind: 'error',
            message: 'The saved preview could not be safely replaced because its exact source could not be preserved.',
            diagnostic: diagnosticForWriteFailure(
              storage,
              expectedRaw,
              options.currentDate,
              operation,
              recovery.kind === 'conflict'
                ? 'raw-recovery-copy-conflict'
                : recovery.kind === 'active-conflict'
                  ? 'source-changed-during-raw-recovery'
                  : 'raw-recovery-copy-failed',
              recovery.kind === 'active-conflict' ? 'detected' : 'not-detected',
              recovery.kind === 'error' ? recovery.message : undefined
            )
          };
        }
        rawRecoveryExpected = expectedRaw;
      }
      if (sourceVersion !== null && sourceVersion < PREVIEW_SCHEMA_VERSION) {
        const recovery = preserveProposedV4SourceRecovery(storage, expectedRaw);
        if (recovery.kind !== 'preserved') {
          return {
            kind: 'error',
            message: recovery.kind === 'conflict'
              ? `The original v${sourceVersion} recovery copy already contains different data. No schema write was made.`
              : recovery.kind === 'active-conflict'
                ? 'Preview storage changed before its recovery copy was made. No schema write was made.'
                : recovery.kind === 'unsupported'
                  ? recovery.message
                  : 'The original preview could not be preserved, so no changes were written.',
            diagnostic: diagnosticForWriteFailure(
              storage,
              expectedRaw,
              options.currentDate,
              operation,
              recovery.kind === 'conflict'
                ? 'immutable-recovery-copy-conflict'
                : recovery.kind === 'active-conflict'
                  ? 'source-changed-during-recovery'
                  : recovery.kind === 'unsupported'
                    ? 'immutable-recovery-key-unavailable'
                    : 'immutable-recovery-copy-failed',
              recovery.kind === 'active-conflict' ? 'detected' : 'not-detected',
              recovery.kind === 'error' ? recovery.message : undefined
            )
          };
        }
        if (source.valid && source.resolvedPersonCategories > 0) {
          const categoryRecovery = storage.getItem(PREVIEW_CATEGORY_RECOVERY_KEY);
          if (categoryRecovery !== null && categoryRecovery !== expectedRaw) {
            return {
              kind: 'error',
              message: 'The original preview could not be preserved, so no changes were written.',
              diagnostic: diagnosticForWriteFailure(
                storage,
                expectedRaw,
                options.currentDate,
                operation,
                'category-recovery-copy-conflict',
                'not-detected',
                'An existing immutable category-resolution recovery copy differs from the current source.'
              )
            };
          }
          if (categoryRecovery === null) {
            storage.setItem(PREVIEW_CATEGORY_RECOVERY_KEY, expectedRaw);
            if (storage.getItem(PREVIEW_CATEGORY_RECOVERY_KEY) !== expectedRaw) {
              return {
                kind: 'error',
                message: 'The original preview could not be preserved, so no changes were written.',
                diagnostic: diagnosticForWriteFailure(
                  storage,
                  expectedRaw,
                  options.currentDate,
                  operation,
                  'category-recovery-copy-failed',
                  'not-detected'
                )
              };
            }
          }
        }
      } else if (source.valid && source.resolvedPersonCategories > 0) {
        const recovery = storage.getItem(PREVIEW_CATEGORY_RECOVERY_KEY);
        if (recovery !== null && recovery !== expectedRaw) {
          return {
            kind: 'error',
            message: 'The original preview could not be preserved, so no changes were written.',
            diagnostic: diagnosticForWriteFailure(
              storage,
              expectedRaw,
              options.currentDate,
              operation,
              'category-recovery-copy-conflict',
              'not-detected',
              'An existing immutable category-resolution recovery copy differs from the current source.'
            )
          };
        }
        if (recovery === null) {
          storage.setItem(PREVIEW_CATEGORY_RECOVERY_KEY, expectedRaw);
          if (storage.getItem(PREVIEW_CATEGORY_RECOVERY_KEY) !== expectedRaw) {
            return {
              kind: 'error',
              message: 'The original preview could not be preserved, so no changes were written.',
              diagnostic: diagnosticForWriteFailure(
                storage,
                expectedRaw,
                options.currentDate,
                operation,
                'category-recovery-copy-failed',
                'not-detected'
              )
            };
          }
        }
      } else if (sourceVersion === null
        && (!source.valid || source.sourceSchemaVersion !== PREVIEW_SCHEMA_VERSION)
        && !options.allowUnrecoverableReplacement) {
        return {
          kind: 'error',
          message: 'The saved preview could not be safely updated, so no changes were written. Download its raw recovery before explicitly replacing it.',
          diagnostic: diagnosticForWriteFailure(
            storage,
            expectedRaw,
            options.currentDate,
            operation,
            'immutable-recovery-key-unavailable',
            'not-detected'
          )
        };
      }
    }
    const finalRaw = storage.getItem(PREVIEW_STORAGE_KEY);
    if (finalRaw !== expectedRaw) return { kind: 'conflict', actualRaw: finalRaw };
    if (rawRecoveryExpected !== null && storage.getItem(PREVIEW_RAW_RECOVERY_KEY) !== rawRecoveryExpected) {
      return {
        kind: 'error',
        message: 'The exact raw recovery copy changed before replacement, so no changes were written.',
        diagnostic: diagnosticForWriteFailure(
          storage,
          expectedRaw,
          options.currentDate,
          operation,
          'raw-recovery-copy-changed-before-replacement',
          'not-detected'
        )
      };
    }
    if (operation === 'import') {
      const sourceRaw = options.importSourceRaw;
      if (sourceRaw === undefined || !options.currentDate) {
        return {
          kind: 'error',
          message: 'The selected backup could not be verified, so no changes were written.',
          diagnostic: diagnosticForWriteFailure(
            storage,
            expectedRaw,
            options.currentDate,
            operation,
            'import-source-missing',
            'not-detected'
          )
        };
      }
      const imported = parsePreviewBackup(sourceRaw, options.currentDate);
      if (!imported.valid || JSON.stringify(imported.envelope.data) !== JSON.stringify(data)) {
        return {
          kind: 'error',
          message: 'The selected backup could not be verified, so no changes were written.',
          diagnostic: diagnosticForWriteFailure(
            storage,
            expectedRaw,
            options.currentDate,
            operation,
            'import-source-validation-failed',
            'not-detected',
            imported.valid ? 'Parsed backup data did not match the requested import.' : imported.message
          )
        };
      }
      const previousGuard = loadPreviewImportSyncGuard(storage);
      if (previousGuard.kind === 'error') {
        return {
          kind: 'error',
          message: previousGuard.message,
          diagnostic: diagnosticForWriteFailure(
            storage,
            expectedRaw,
            options.currentDate,
            operation,
            'import-sync-guard-invalid',
            'not-detected'
          )
        };
      }
      if (previousGuard.guard.kind === 'pending') {
        return {
          kind: 'error',
          message: 'Choose how to handle the previous imported preview before importing another backup.',
          diagnostic: diagnosticForWriteFailure(
            storage,
            expectedRaw,
            options.currentDate,
            operation,
            'previous-import-sync-choice-pending',
            'not-detected'
          )
        };
      }
      const previousGuardRaw = storage.getItem(PREVIEW_IMPORT_SYNC_GUARD_KEY);
      const previousArchiveRaw = storage.getItem(PREVIEW_IMPORT_RECOVERY_KEY);
      const archive = previousArchiveRaw === null
        ? { copies: [] as string[], sources: [] as string[] }
        : parseImportRecoveryArchive(previousArchiveRaw);
      if (expectedRaw !== null) archive.copies.push(expectedRaw);
      archive.sources.push(sourceRaw);
      const nextArchiveRaw = JSON.stringify({
        format: previewImportRecoveryFormat,
        schemaVersion: 1,
        copies: archive.copies,
        sources: archive.sources
      });
      const nextGuardRaw = serializeImportSyncGuard({ kind: 'pending', importedRaw: raw });
      const emptyArchiveRaw = JSON.stringify({
        format: previewImportRecoveryFormat,
        schemaVersion: 1,
        copies: [],
        sources: []
      });
      const emptyGuardRaw = serializeImportSyncGuard({ kind: 'none' });
      try {
        storage.setItem(PREVIEW_IMPORT_RECOVERY_KEY, nextArchiveRaw);
        storage.setItem(PREVIEW_IMPORT_SYNC_GUARD_KEY, nextGuardRaw);
      } catch (error) {
        restoreImportMetadata(storage, PREVIEW_IMPORT_RECOVERY_KEY, previousArchiveRaw, emptyArchiveRaw);
        restoreImportMetadata(storage, PREVIEW_IMPORT_SYNC_GUARD_KEY, previousGuardRaw, emptyGuardRaw);
        throw error;
      }
      if (storage.getItem(PREVIEW_IMPORT_RECOVERY_KEY) !== nextArchiveRaw
        || storage.getItem(PREVIEW_IMPORT_SYNC_GUARD_KEY) !== nextGuardRaw
        || storage.getItem(PREVIEW_STORAGE_KEY) !== expectedRaw) {
        restoreImportMetadata(storage, PREVIEW_IMPORT_RECOVERY_KEY, previousArchiveRaw, emptyArchiveRaw);
        restoreImportMetadata(storage, PREVIEW_IMPORT_SYNC_GUARD_KEY, previousGuardRaw, emptyGuardRaw);
        return {
          kind: 'conflict',
          actualRaw: storage.getItem(PREVIEW_STORAGE_KEY)
        };
      }
      try {
        storage.setItem(PREVIEW_STORAGE_KEY, raw);
      } catch (error) {
        restoreImportMetadata(storage, PREVIEW_IMPORT_RECOVERY_KEY, previousArchiveRaw, emptyArchiveRaw);
        restoreImportMetadata(storage, PREVIEW_IMPORT_SYNC_GUARD_KEY, previousGuardRaw, emptyGuardRaw);
        throw error;
      }
    } else {
      storage.setItem(PREVIEW_STORAGE_KEY, raw);
    }
    return { kind: 'saved', raw };
  } catch (error) {
    return {
      kind: 'error',
      message: 'The preview could not be saved on this device. Your changes remain in this tab; retry before leaving.',
      diagnostic: diagnosticForWriteFailure(
        storage,
        expectedRaw,
        options.currentDate,
        operation,
        'storage-operation-failed',
        activeSourceCompared ? 'not-detected' : 'not-checked',
        errorMessage(error)
      )
    };
  }
}

export function browserPreviewStorage(
  identity: PreviewIdentityState = DEVELOPMENT_PREVIEW_IDENTITY
): PreviewStorage {
  const scope = createPreviewStorageScope({
    getItem: key => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value)
  }, identity);
  if (!scope) throw new Error('Preview storage is unavailable without an authenticated identity.');
  return scope.storage;
}

export function loadV1RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V1_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV2RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V2_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV3RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V3_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV4RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V4_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV5RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V5_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV6RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V6_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV7RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V7_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV8RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V8_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV9RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V9_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV10RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V10_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV11RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V11_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV12RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V12_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV13RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V13_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV14RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V14_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV15RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V15_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV16RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V16_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV17RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V17_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV18RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V18_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV19RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V19_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV20RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V20_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV21RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V21_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV22RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V22_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV23RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V23_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV24RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V24_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV25RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V25_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV26RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V26_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV27RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V27_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV28RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V28_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV29RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V29_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV30RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V30_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV31RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V31_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV32RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V32_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV33RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V33_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV34RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V34_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV35RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V35_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV36RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V36_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function loadV39RecoveryCopy(storage: PreviewStorage): RecoveryCopyReadResult {
  try {
    return { kind: 'loaded', raw: storage.getItem(PREVIEW_V39_RECOVERY_KEY) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function listenForPreviewChanges(
  listener: (newValue: string | null) => void,
  identity: PreviewIdentityState = DEVELOPMENT_PREVIEW_IDENTITY
): () => void {
  const scope = createPreviewStorageScope(browserPreviewStorageBase(), identity);
  if (!scope) return () => undefined;
  const activeKey = scope.key;
  function handleStorageChange(event: StorageEvent) {
    if (event.key === null) {
      listener(null);
      return;
    }
    if (event.key === activeKey) listener(event.newValue);
  }
  window.addEventListener('storage', handleStorageChange);
  return () => window.removeEventListener('storage', handleStorageChange);
}

function browserPreviewStorageBase(): PreviewStorage {
  return {
    getItem: key => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
    removeItem: key => window.localStorage.removeItem(key)
  };
}
