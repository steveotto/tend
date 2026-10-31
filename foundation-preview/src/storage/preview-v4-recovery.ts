import { PREVIEW_BACKUP_FORMAT } from '../domain/preview-state.ts';
import type { PreviewStorage } from './preview-storage.ts';

export const PREVIEW_STORAGE_KEY = 'tend2:synthetic-preview';
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
  29: PREVIEW_V29_RECOVERY_KEY
} as const;

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

export function proposedV4SourceVersionForRaw(
  raw: string
): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const envelope = parsed;
    if (envelope.format !== PREVIEW_BACKUP_FORMAT) return null;
    return envelope.schemaVersion === 1 || envelope.schemaVersion === 2
      || envelope.schemaVersion === 3 || envelope.schemaVersion === 4 || envelope.schemaVersion === 5
      || envelope.schemaVersion === 6 || envelope.schemaVersion === 7 || envelope.schemaVersion === 8
      || envelope.schemaVersion === 9 || envelope.schemaVersion === 10 || envelope.schemaVersion === 11
      || envelope.schemaVersion === 12 || envelope.schemaVersion === 13 || envelope.schemaVersion === 14
      || envelope.schemaVersion === 15 || envelope.schemaVersion === 16 || envelope.schemaVersion === 17
      || envelope.schemaVersion === 18 || envelope.schemaVersion === 19 || envelope.schemaVersion === 20
      || envelope.schemaVersion === 21
      || envelope.schemaVersion === 22 || envelope.schemaVersion === 23 || envelope.schemaVersion === 24
      || envelope.schemaVersion === 25 || envelope.schemaVersion === 26 || envelope.schemaVersion === 27
      || envelope.schemaVersion === 28 || envelope.schemaVersion === 29
      ? envelope.schemaVersion
      : null;
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
    return { kind: 'preserved', key, raw };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export function proposedV4RecoveryKeyForRaw(raw: string): string | null {
  const version = proposedV4SourceVersionForRaw(raw);
  return version === 1 || version === 2 || version === 3 || version === 4 || version === 5
    || version === 6 || version === 7 || version === 8 || version === 9 || version === 10
    || version === 11 || version === 12 || version === 13 || version === 14 || version === 15 || version === 16 || version === 17 || version === 18 || version === 19 || version === 20
    || version === 21 || version === 22 || version === 23 || version === 24 || version === 25 || version === 26 || version === 27
    || version === 28 || version === 29
    ? recoveryKeys[version]
    : null;
}
