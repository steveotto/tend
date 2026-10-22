import {
  parsePreviewBackup,
  createPreviewEnvelope,
  isVersionOnePreviewRaw,
  isVersionTwoPreviewRaw
} from '../domain/preview-state.ts';
import type { PreviewData } from '../domain/preview-state.ts';

export const PREVIEW_STORAGE_KEY = 'tend2:synthetic-preview';
export const PREVIEW_V1_RECOVERY_KEY = 'tend2:synthetic-preview:v1-recovery';
export const PREVIEW_V2_RECOVERY_KEY = 'tend2:synthetic-preview:v2-recovery';

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

  const parsed = parsePreviewBackup(raw, currentDate);
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
  expectedRaw: string | null
): PreviewWriteResult {
  try {
    const actualRaw = storage.getItem(PREVIEW_STORAGE_KEY);
    if (actualRaw !== expectedRaw) return { kind: 'conflict', actualRaw };
    const raw = JSON.stringify(createPreviewEnvelope(data));

    const sourceRecoveryKey = expectedRaw !== null && isVersionOnePreviewRaw(expectedRaw)
      ? PREVIEW_V1_RECOVERY_KEY
      : expectedRaw !== null && isVersionTwoPreviewRaw(expectedRaw)
        ? PREVIEW_V2_RECOVERY_KEY
        : null;
    if (expectedRaw !== null && sourceRecoveryKey !== null) {
      const archivedRaw = storage.getItem(sourceRecoveryKey);
      if (archivedRaw === null) {
        storage.setItem(sourceRecoveryKey, expectedRaw);
      } else if (archivedRaw !== expectedRaw) {
        return {
          kind: 'error',
          message: `The original ${isVersionOnePreviewRaw(expectedRaw) ? 'v1' : 'v2'} recovery copy already contains different data. No new schema write was made.`
        };
      }
    }

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

export function listenForPreviewChanges(listener: (newValue: string | null) => void): () => void {
  function handleStorageChange(event: StorageEvent) {
    if (event.key === PREVIEW_STORAGE_KEY || event.key === null) listener(event.key === null ? null : event.newValue);
  }
  window.addEventListener('storage', handleStorageChange);
  return () => window.removeEventListener('storage', handleStorageChange);
}
