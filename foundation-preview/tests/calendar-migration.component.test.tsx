import { describe, expect, it } from 'vitest';
import { createPreviewEnvelope, createSamplePreviewData, PREVIEW_SCHEMA_VERSION } from '../src/domain/preview-state.ts';
import { createAuthenticatedPreviewIdentity } from '../src/domain/preview-identity.ts';
import {
  createPreviewStorageScope,
  loadPreview,
  loadV36RecoveryCopy,
  loadV35RecoveryCopy,
  PREVIEW_STORAGE_KEY,
  PREVIEW_V36_RECOVERY_KEY,
  PREVIEW_V35_RECOVERY_KEY,
  writePreview
} from '../src/storage/preview-storage.ts';
import type { PreviewStorage } from '../src/storage/preview-storage.ts';

class FixtureStorage implements PreviewStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('calendar source migration persistence', () => {
  it('keeps schema 35 data untouched on load and preserves its exact recovery copy before first save', () => {
    const data = createSamplePreviewData();
    data.personNotes = [{
      id: 'person-note-synthetic',
      personId: 'sample-person-morgan',
      content: 'Synthetic note',
      createdAt: '2026-11-06T12:00:00.000Z',
      updatedAt: '2026-11-06T12:00:00.000Z'
    }];
    const current = createPreviewEnvelope(data);
    const previousData = { ...current.data } as Record<string, unknown>;
    delete previousData.calendarSources;
    const raw = JSON.stringify({ ...current, schemaVersion: 35, data: previousData });
    const storage = new FixtureStorage();
    storage.setItem(PREVIEW_STORAGE_KEY, raw);

    const loaded = loadPreview(storage, '2026-11-06');
    expect(loaded.kind).toBe('loaded');
    expect(storage.getItem(PREVIEW_STORAGE_KEY)).toBe(raw);
    expect(storage.getItem(PREVIEW_V35_RECOVERY_KEY)).toBeNull();
    if (loaded.kind !== 'loaded') return;

    expect(loaded.data.calendarSources).toEqual([]);
    expect(loaded.data.personNotes).toEqual(data.personNotes);
    const written = writePreview(storage, loaded.data, loaded.raw, {
      currentDate: '2026-11-06',
      operation: 'save'
    });

    expect(written.kind).toBe('saved');
    expect(storage.getItem(PREVIEW_V35_RECOVERY_KEY)).toBe(raw);
    expect(loadV35RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw });
    if (written.kind !== 'saved') return;
    const saved = JSON.parse(written.raw) as { schemaVersion: number; data: Record<string, unknown> };
    expect(saved.schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
    expect(saved.data.calendarSources).toEqual([]);
    expect(saved.data.personNotes).toEqual(data.personNotes);
  });

  it('migrates schema 36 to 37 only after preserving the exact source copy', () => {
    const data = createSamplePreviewData();
    data.calendarSources = [{
      id: 'calendar-source-schema-36',
      name: 'Synthetic calendar',
      url: 'https://p123-caldav.icloud.com/published/synthetic-token'
    }];
    const current = createPreviewEnvelope(data);
    const raw = JSON.stringify({ ...current, schemaVersion: 36 });
    const storage = new FixtureStorage();
    storage.setItem(PREVIEW_STORAGE_KEY, raw);

    const loaded = loadPreview(storage, '2026-11-06');
    expect(loaded.kind).toBe('loaded');
    expect(storage.getItem(PREVIEW_STORAGE_KEY)).toBe(raw);
    expect(storage.getItem(PREVIEW_V36_RECOVERY_KEY)).toBeNull();
    if (loaded.kind !== 'loaded') return;

    expect(loaded.data.calendarSources).toEqual(data.calendarSources);
    const written = writePreview(storage, loaded.data, loaded.raw, {
      currentDate: '2026-11-06',
      operation: 'save'
    });

    expect(written.kind).toBe('saved');
    expect(storage.getItem(PREVIEW_V36_RECOVERY_KEY)).toBe(raw);
    expect(loadV36RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw });
    if (written.kind !== 'saved') return;
    const saved = JSON.parse(written.raw) as { schemaVersion: number; data: Record<string, unknown> };
    expect(saved.schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
    expect(saved.data.calendarSources).toEqual(data.calendarSources);
  });

  it('keeps saved calendar links within the authenticated account namespace', () => {
    const storage = new FixtureStorage();
    const source = {
      id: 'calendar-source-account',
      name: 'Private link',
      url: 'https://p123-caldav.icloud.com/published/synthetic-token'
    };
    const data = createSamplePreviewData();
    data.calendarSources = [source];
    const accountA = createPreviewStorageScope(
      storage,
      createAuthenticatedPreviewIdentity('11111111-1111-4111-8111-111111111111', 1)
    );
    const accountB = createPreviewStorageScope(
      storage,
      createAuthenticatedPreviewIdentity('22222222-2222-4222-8222-222222222222', 1)
    );
    expect(accountA).not.toBeNull();
    expect(accountB).not.toBeNull();
    if (!accountA || !accountB) return;

    expect(writePreview(accountA.storage, data, null, { currentDate: '2026-11-06' }).kind).toBe('saved');
    expect(loadPreview(accountA.storage, '2026-11-06')).toMatchObject({
      kind: 'loaded',
      data: { calendarSources: [source] }
    });
    expect(loadPreview(accountB.storage, '2026-11-06')).toEqual({ kind: 'missing' });
  });
});
