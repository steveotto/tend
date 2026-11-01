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
  PREVIEW_V25_RECOVERY_KEY,
  PREVIEW_V26_RECOVERY_KEY,
  PREVIEW_V27_RECOVERY_KEY,
  PREVIEW_V28_RECOVERY_KEY,
  PREVIEW_V29_RECOVERY_KEY,
  PREVIEW_V30_RECOVERY_KEY,
  PREVIEW_V31_RECOVERY_KEY,
  PREVIEW_V32_RECOVERY_KEY,
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
  PREVIEW_V25_RECOVERY_KEY,
  PREVIEW_V26_RECOVERY_KEY,
  PREVIEW_V27_RECOVERY_KEY,
  PREVIEW_V28_RECOVERY_KEY,
  PREVIEW_V29_RECOVERY_KEY,
  PREVIEW_V30_RECOVERY_KEY,
  PREVIEW_V31_RECOVERY_KEY,
  PREVIEW_V32_RECOVERY_KEY
};

export const PREVIEW_CATEGORY_RECOVERY_KEY = `${PREVIEW_STORAGE_KEY}:v32-category-recovery`;
export const PREVIEW_ACCOUNT_STORAGE_PREFIX = 'tend2:preview:account';

export type PreviewStorage = Pick<Storage, 'getItem' | 'setItem'>;
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
  | { kind: 'error'; message: string };

export type RecoveryCopyReadResult =
  | { kind: 'loaded'; raw: string | null }
  | { kind: 'error'; message: string };

export type PreviewWriteOptions = {
  allowUnrecoverableReplacement?: boolean;
  currentDate?: string;
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
      setItem: (key, value) => storage.setItem(mapKey(key), value)
    }
  };
}

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
          message: sourceVersion === 9 || sourceVersion === 10 || sourceVersion === 11
            ? 'The active preview data is malformed and cannot be replaced without an explicit raw backup.'
            : 'The stored source value is invalid or cannot be checked. Download its raw recovery before explicitly replacing it.'
        };
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
                  : recovery.message
          };
        }
        if (source.valid && source.resolvedPersonCategories > 0) {
          const categoryRecovery = storage.getItem(PREVIEW_CATEGORY_RECOVERY_KEY);
          if (categoryRecovery !== null && categoryRecovery !== expectedRaw) {
            return {
              kind: 'error',
              message: 'The immutable category-resolution recovery copy already contains different data. No preview write was made.'
            };
          }
          if (categoryRecovery === null) storage.setItem(PREVIEW_CATEGORY_RECOVERY_KEY, expectedRaw);
        }
      } else if (source.valid && source.resolvedPersonCategories > 0) {
        const recovery = storage.getItem(PREVIEW_CATEGORY_RECOVERY_KEY);
        if (recovery !== null && recovery !== expectedRaw) {
          return {
            kind: 'error',
            message: 'The immutable category-resolution recovery copy already contains different data. No preview write was made.'
          };
        }
        if (recovery === null) storage.setItem(PREVIEW_CATEGORY_RECOVERY_KEY, expectedRaw);
      } else if (sourceVersion === null
        && (!source.valid || source.sourceSchemaVersion !== PREVIEW_SCHEMA_VERSION)
        && !options.allowUnrecoverableReplacement) {
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
    setItem: (key, value) => window.localStorage.setItem(key, value)
  };
}
