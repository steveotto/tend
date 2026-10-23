import { PREVIEW_BACKUP_FORMAT } from '../domain/preview-state.ts';
import type { PreviewStorage } from './preview-storage.ts';

export const PREVIEW_STORAGE_KEY = 'tend2:synthetic-preview';
export const PREVIEW_V1_RECOVERY_KEY = 'tend2:synthetic-preview:v1-recovery';
export const PREVIEW_V2_RECOVERY_KEY = 'tend2:synthetic-preview:v2-recovery';
export const PREVIEW_V3_RECOVERY_KEY = 'tend2:synthetic-preview:v3-recovery';
export const PREVIEW_V4_RECOVERY_KEY = 'tend2:synthetic-preview:v4-recovery';
export const PREVIEW_V5_RECOVERY_KEY = 'tend2:synthetic-preview:v5-recovery';

const recoveryKeys = {
  1: PREVIEW_V1_RECOVERY_KEY,
  2: PREVIEW_V2_RECOVERY_KEY,
  3: PREVIEW_V3_RECOVERY_KEY,
  4: PREVIEW_V4_RECOVERY_KEY,
  5: PREVIEW_V5_RECOVERY_KEY
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

export function proposedV4SourceVersionForRaw(raw: string): 1 | 2 | 3 | 4 | 5 | 6 | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const envelope = parsed;
    if (envelope.format !== PREVIEW_BACKUP_FORMAT) return null;
    return envelope.schemaVersion === 1 || envelope.schemaVersion === 2
      || envelope.schemaVersion === 3 || envelope.schemaVersion === 4 || envelope.schemaVersion === 5
      || envelope.schemaVersion === 6
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
    ? recoveryKeys[version]
    : null;
}
