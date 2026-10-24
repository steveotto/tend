import { createPreviewEnvelope, parsePreviewBackup } from '../domain/preview-state.ts';
import type { PreviewData } from '../domain/preview-state.ts';
import { migratePreviewToProposedV4 } from '../domain/preview-v4-migration.ts';
import {
  PREVIEW_STORAGE_KEY,
  PREVIEW_V1_RECOVERY_KEY,
  PREVIEW_V2_RECOVERY_KEY,
  PREVIEW_V3_RECOVERY_KEY,
  PREVIEW_V4_RECOVERY_KEY,
  PREVIEW_V5_RECOVERY_KEY,
  PREVIEW_V6_RECOVERY_KEY,
  preserveProposedV4SourceRecovery,
  proposedV4SourceVersionForRaw
} from './preview-v4-recovery.ts';

export {
  PREVIEW_STORAGE_KEY,
  PREVIEW_V1_RECOVERY_KEY,
  PREVIEW_V2_RECOVERY_KEY,
  PREVIEW_V3_RECOVERY_KEY,
  PREVIEW_V4_RECOVERY_KEY,
  PREVIEW_V5_RECOVERY_KEY,
  PREVIEW_V6_RECOVERY_KEY
};

export type PreviewStorage = Pick<Storage, 'getItem' | 'setItem'>;

export type PreviewLoadResult =
  | { kind: 'missing' }
  | { kind: 'loaded'; data: PreviewData; raw: string }
  | { kind: 'corrupt'; raw: string; message: string }
  | { kind: 'unsupported'; raw: string; message: string }
  | { kind: 'unavailable'; message: string };

export type PreviewWriteResult =
  | { kind: 'saved'; raw: string }
  | { kind: 'conflict'; actualRaw: string | null }
  | { kind: 'error'; message: string };

export type RecoveryCopyReadResult =
  | { kind: 'loaded'; raw: string | null }
  | { kind: 'error'; message: string };

export type PreviewWriteOptions = {
  allowUnrecoverableReplacement?: boolean;
  currentDate?: string;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Browser storage is unavailable.';
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

export function writePreview(
  storage: PreviewStorage,
  data: PreviewData,
  expectedRaw: string | null,
  options: PreviewWriteOptions = {}
): PreviewWriteResult {
  try {
    const actualRaw = storage.getItem(PREVIEW_STORAGE_KEY);
    if (actualRaw !== expectedRaw) return { kind: 'conflict', actualRaw };
    const raw = JSON.stringify(createPreviewEnvelope(data));

    if (expectedRaw !== null) {
      const sourceVersion = proposedV4SourceVersionForRaw(expectedRaw);
      const source = options.currentDate ? parsePreviewBackup(expectedRaw, options.currentDate) : { valid: false as const };
      if (!source.valid && !options.allowUnrecoverableReplacement) {
        return {
          kind: 'error',
          message: sourceVersion === 7
            ? 'The active preview data is malformed and cannot be replaced without an explicit raw backup.'
            : 'The stored source value is invalid or cannot be checked. Download its raw recovery before explicitly replacing it.'
        };
      }
      if (sourceVersion === 1 || sourceVersion === 2 || sourceVersion === 3
        || sourceVersion === 4 || sourceVersion === 5 || sourceVersion === 6) {
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
                  : recovery.message
          };
        }
      } else if (sourceVersion === null && !options.allowUnrecoverableReplacement) {
        return {
          kind: 'error',
          message: 'The stored value has no supported immutable recovery key. Download its raw recovery before explicitly replacing it.'
        };
      }
    }

    const finalRaw = storage.getItem(PREVIEW_STORAGE_KEY);
    if (finalRaw !== expectedRaw) return { kind: 'conflict', actualRaw: finalRaw };
    storage.setItem(PREVIEW_STORAGE_KEY, raw);
    return { kind: 'saved', raw };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function browserPreviewStorage(): PreviewStorage {
  return {
    getItem: key => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value)
  };
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

export function listenForPreviewChanges(listener: (newValue: string | null) => void): () => void {
  function handleStorageChange(event: StorageEvent) {
    if (event.key === PREVIEW_STORAGE_KEY || event.key === null) listener(event.key === null ? null : event.newValue);
  }
  window.addEventListener('storage', handleStorageChange);
  return () => window.removeEventListener('storage', handleStorageChange);
}
