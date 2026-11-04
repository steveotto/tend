import { PREVIEW_BACKUP_FORMAT } from '../domain/preview-state.ts';
import type { PreviewStorage } from './preview-storage.ts';

export const PREVIEW_STORAGE_KEY = 'tend2:synthetic-preview';
export const PREVIEW_RAW_RECOVERY_KEY = 'tend2:synthetic-preview:raw-recovery';
export const PREVIEW_V1_RECOVERY_KEY = 'tend2:synthetic-preview:v1-recovery';
export const PREVIEW_V2_RECOVERY_KEY = 'tend2:synthetic-preview:v2-recovery';
export const PREVIEW_V3_RECOVERY_KEY = 'tend2:synthetic-preview:v3-recovery';
export const PREVIEW_V4_RECOVERY_KEY = 'tend2:synthetic-preview:v4-recovery';
export const PREVIEW_V5_RECOVERY_KEY = 'tend2:synthetic-preview:v5-recovery';
export const PREVIEW_V6_RECOVERY_KEY = 'tend2:synthetic-preview:v6-recovery';
export const PREVIEW_V7_RECOVERY_KEY = 'tend2:synthetic-preview:v7-recovery';
export const PREVIEW_V8_RECOVERY_KEY = 'tend2:synthetic-preview:v8-recovery';
export const PREVIEW_V9_RECOVERY_KEY = 'tend2:synthetic-preview:v9-recovery';
export const PREVIEW_V10_RECOVERY_KEY = 'tend2:synthetic-preview:v10-recovery';
export const PREVIEW_V11_RECOVERY_KEY = 'tend2:synthetic-preview:v11-recovery';
export const PREVIEW_V12_RECOVERY_KEY = 'tend2:synthetic-preview:v12-recovery';
export const PREVIEW_V13_RECOVERY_KEY = 'tend2:synthetic-preview:v13-recovery';
export const PREVIEW_V14_RECOVERY_KEY = 'tend2:synthetic-preview:v14-recovery';
export const PREVIEW_V15_RECOVERY_KEY = 'tend2:synthetic-preview:v15-recovery';
export const PREVIEW_V16_RECOVERY_KEY = 'tend2:synthetic-preview:v16-recovery';
export const PREVIEW_V17_RECOVERY_KEY = 'tend2:synthetic-preview:v17-recovery';
export const PREVIEW_V18_RECOVERY_KEY = 'tend2:synthetic-preview:v18-recovery';
export const PREVIEW_V19_RECOVERY_KEY = 'tend2:synthetic-preview:v19-recovery';
export const PREVIEW_V20_RECOVERY_KEY = 'tend2:synthetic-preview:v20-recovery';
export const PREVIEW_V21_RECOVERY_KEY = 'tend2:synthetic-preview:v21-recovery';
export const PREVIEW_V22_RECOVERY_KEY = 'tend2:synthetic-preview:v22-recovery';
export const PREVIEW_V23_RECOVERY_KEY = 'tend2:synthetic-preview:v23-recovery';
export const PREVIEW_V24_RECOVERY_KEY = 'tend2:synthetic-preview:v24-recovery';
export const PREVIEW_V25_RECOVERY_KEY = 'tend2:synthetic-preview:v25-recovery';
export const PREVIEW_V26_RECOVERY_KEY = 'tend2:synthetic-preview:v26-recovery';
export const PREVIEW_V27_RECOVERY_KEY = 'tend2:synthetic-preview:v27-recovery';
export const PREVIEW_V28_RECOVERY_KEY = 'tend2:synthetic-preview:v28-recovery';
export const PREVIEW_V29_RECOVERY_KEY = 'tend2:synthetic-preview:v29-recovery';
export const PREVIEW_V30_RECOVERY_KEY = 'tend2:synthetic-preview:v30-recovery';
export const PREVIEW_V31_RECOVERY_KEY = 'tend2:synthetic-preview:v31-recovery';
export const PREVIEW_V32_RECOVERY_KEY = 'tend2:synthetic-preview:v32-recovery';
export const PREVIEW_V33_RECOVERY_KEY = 'tend2:synthetic-preview:v33-recovery';
export const PREVIEW_V34_RECOVERY_KEY = 'tend2:synthetic-preview:v34-recovery';
export const PREVIEW_V35_RECOVERY_KEY = 'tend2:synthetic-preview:v35-recovery';
export const PREVIEW_V36_RECOVERY_KEY = 'tend2:synthetic-preview:v36-recovery';

type RecoverablePreviewSchemaVersion =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17
  | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33 | 34 | 35 | 36;

const recoveryKeys = {
  1: PREVIEW_V1_RECOVERY_KEY,
  2: PREVIEW_V2_RECOVERY_KEY,
  3: PREVIEW_V3_RECOVERY_KEY,
  4: PREVIEW_V4_RECOVERY_KEY,
  5: PREVIEW_V5_RECOVERY_KEY,
  6: PREVIEW_V6_RECOVERY_KEY,
  7: PREVIEW_V7_RECOVERY_KEY,
  8: PREVIEW_V8_RECOVERY_KEY,
  9: PREVIEW_V9_RECOVERY_KEY,
  10: PREVIEW_V10_RECOVERY_KEY,
  11: PREVIEW_V11_RECOVERY_KEY,
  12: PREVIEW_V12_RECOVERY_KEY,
  13: PREVIEW_V13_RECOVERY_KEY,
  14: PREVIEW_V14_RECOVERY_KEY,
  15: PREVIEW_V15_RECOVERY_KEY,
  16: PREVIEW_V16_RECOVERY_KEY,
  17: PREVIEW_V17_RECOVERY_KEY,
  18: PREVIEW_V18_RECOVERY_KEY,
  19: PREVIEW_V19_RECOVERY_KEY,
  20: PREVIEW_V20_RECOVERY_KEY,
  21: PREVIEW_V21_RECOVERY_KEY,
  22: PREVIEW_V22_RECOVERY_KEY,
  23: PREVIEW_V23_RECOVERY_KEY,
  24: PREVIEW_V24_RECOVERY_KEY,
  25: PREVIEW_V25_RECOVERY_KEY,
  26: PREVIEW_V26_RECOVERY_KEY,
  27: PREVIEW_V27_RECOVERY_KEY,
  28: PREVIEW_V28_RECOVERY_KEY,
  29: PREVIEW_V29_RECOVERY_KEY,
  30: PREVIEW_V30_RECOVERY_KEY,
  31: PREVIEW_V31_RECOVERY_KEY,
  32: PREVIEW_V32_RECOVERY_KEY,
  33: PREVIEW_V33_RECOVERY_KEY,
  34: PREVIEW_V34_RECOVERY_KEY,
  35: PREVIEW_V35_RECOVERY_KEY,
  36: PREVIEW_V36_RECOVERY_KEY
} as const satisfies Record<RecoverablePreviewSchemaVersion, string>;

export type ProposedRecoveryResult =
  | { kind: 'preserved'; key: string; raw: string }
  | { kind: 'conflict'; key: string; existingRaw: string }
  | { kind: 'active-conflict'; actualRaw: string | null }
  | { kind: 'unsupported'; message: string }
  | { kind: 'error'; message: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Browser storage is unavailable.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRecoverablePreviewSchemaVersion(value: unknown): value is RecoverablePreviewSchemaVersion {
  return typeof value === 'number' && Object.hasOwn(recoveryKeys, value);
}

export function proposedV4SourceVersionForRaw(
  raw: string
): RecoverablePreviewSchemaVersion | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const envelope = parsed;
    if (envelope.format !== PREVIEW_BACKUP_FORMAT) return null;
    return isRecoverablePreviewSchemaVersion(envelope.schemaVersion) ? envelope.schemaVersion : null;
  } catch {
    return null;
  }
}

export function preserveProposedV4SourceRecovery(
  storage: PreviewStorage,
  raw: string
): ProposedRecoveryResult {
  const key = proposedV4RecoveryKeyForRaw(raw);
  if (!key) {
    return { kind: 'unsupported', message: 'The source envelope version has no approved recovery key.' };
  }

  try {
    const actualRaw = storage.getItem(PREVIEW_STORAGE_KEY);
    if (actualRaw !== raw) return { kind: 'active-conflict', actualRaw };
    const existingRaw = storage.getItem(key);
    if (existingRaw === raw) return { kind: 'preserved', key, raw };
    if (existingRaw !== null) return { kind: 'conflict', key, existingRaw };
    storage.setItem(key, raw);
    const actualRawAfterCopy = storage.getItem(PREVIEW_STORAGE_KEY);
    if (actualRawAfterCopy !== raw) return { kind: 'active-conflict', actualRaw: actualRawAfterCopy };
    if (storage.getItem(key) !== raw) {
      return { kind: 'error', message: 'The exact recovery copy could not be verified.' };
    }
    return { kind: 'preserved', key, raw };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function proposedV4RecoveryKeyForRaw(raw: string): string | null {
  const version = proposedV4SourceVersionForRaw(raw);
  return version === null ? null : recoveryKeys[version];
}
