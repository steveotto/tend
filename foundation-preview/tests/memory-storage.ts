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
  PREVIEW_V12_RECOVERY_KEY
} from '../src/storage/preview-v4-recovery.ts';

export class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, String(value));
  }
}

export function installMemoryStorage(): MemoryStorage {
  const storage = new MemoryStorage();
  for (const key of [
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
    PREVIEW_V12_RECOVERY_KEY
  ]) {
    storage.removeItem(key);
  }
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
  return storage;
}
