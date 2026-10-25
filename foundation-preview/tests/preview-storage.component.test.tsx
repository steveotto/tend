import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App.tsx';
import { PreviewDataControls } from '../src/components/PreviewDataControls.tsx';
import {
  createPreviewEnvelope,
  createSamplePreviewData,
  parsePreviewBackup,
  validatePreviewEnvelope
} from '../src/domain/preview-state.ts';
import {
  browserPreviewStorage,
  loadPreview,
  loadV1RecoveryCopy,
  loadV2RecoveryCopy,
  loadV3RecoveryCopy,
  loadV4RecoveryCopy,
  loadV5RecoveryCopy,
  loadV6RecoveryCopy,
  loadV7RecoveryCopy,
  PREVIEW_STORAGE_KEY,
  PREVIEW_V1_RECOVERY_KEY,
  PREVIEW_V2_RECOVERY_KEY,
  PREVIEW_V3_RECOVERY_KEY,
  PREVIEW_V4_RECOVERY_KEY,
  PREVIEW_V5_RECOVERY_KEY,
  PREVIEW_V6_RECOVERY_KEY,
  PREVIEW_V7_RECOVERY_KEY,
  writePreview
} from '../src/storage/preview-storage.ts';
import type { PreviewData } from '../src/domain/preview-state.ts';
import { localDateString } from '../src/domain/money-goals.ts';
import { installMemoryStorage, MemoryStorage } from './memory-storage.ts';

beforeEach(installMemoryStorage);
afterEach(() => {
  cleanup();
  window.localStorage.removeItem(PREVIEW_STORAGE_KEY);
  window.localStorage.removeItem(PREVIEW_V1_RECOVERY_KEY);
  window.localStorage.removeItem(PREVIEW_V2_RECOVERY_KEY);
  window.localStorage.removeItem(PREVIEW_V3_RECOVERY_KEY);
  window.localStorage.removeItem(PREVIEW_V4_RECOVERY_KEY);
  window.localStorage.removeItem(PREVIEW_V5_RECOVERY_KEY);
  window.localStorage.removeItem(PREVIEW_V6_RECOVERY_KEY);
  window.localStorage.removeItem(PREVIEW_V7_RECOVERY_KEY);
  vi.unstubAllGlobals();
});

function sampleWithHistory(): PreviewData {
  const data = createSamplePreviewData();
  data.goals[0]!.correctionHistory.push({
    effectiveDate: '2026-10-18',
    previousBalanceMinor: 120_000,
    previousNote: 'Earlier value',
    replacedAt: '2026-10-20T12:30:00.000Z'
  });
  data.completedRhythmIds = ['sample-pray-together'];
  return data;
}

function versionOneRaw(data: PreviewData): string {
  const envelope = createPreviewEnvelope(data);
  return JSON.stringify({
    format: envelope.format,
    schemaVersion: 1,
    data: {
      goals: envelope.data.goals,
      completedRhythmIds: envelope.data.completedRhythmIds
    }
  });
}

function versionTwoRaw(data: PreviewData): string {
  const envelope = createPreviewEnvelope(data);
  return JSON.stringify({
    format: envelope.format,
    schemaVersion: 2,
    data: {
      goals: envelope.data.goals,
      completedRhythmIds: envelope.data.completedRhythmIds,
      savedRhythms: legacySavedRhythms(envelope.data.savedRhythms)
    }
  });
}

function versionThreeRaw(data: PreviewData): string {
  const envelope = createPreviewEnvelope(data);
  return JSON.stringify({
    format: envelope.format,
    schemaVersion: 3,
    data: {
      goals: envelope.data.goals,
      completedRhythmIds: envelope.data.completedRhythmIds,
      savedRhythms: legacySavedRhythms(envelope.data.savedRhythms),
      archivedRhythmIds: envelope.data.archivedRhythmIds
    }
  });
}

function versionFourRaw(data: PreviewData): string {
  const envelope = createPreviewEnvelope(data);
  return JSON.stringify({
    format: envelope.format,
    schemaVersion: 4,
    data: {
      goals: envelope.data.goals,
      completedRhythmIds: envelope.data.completedRhythmIds,
      savedRhythms: envelope.data.savedRhythms,
      archivedRhythmIds: envelope.data.archivedRhythmIds
    }
  });
}

function versionFiveRaw(data: PreviewData): string {
  const envelope = createPreviewEnvelope(data);
  return JSON.stringify({
    format: envelope.format,
    schemaVersion: 5,
    data: {
      goals: envelope.data.goals,
      completedRhythmIds: envelope.data.completedRhythmIds,
      savedRhythms: envelope.data.savedRhythms,
      archivedRhythmIds: envelope.data.archivedRhythmIds,
      datedRhythmCompletions: envelope.data.datedRhythmCompletions,
      activeRhythmCompletions: envelope.data.activeRhythmCompletions
    }
  });
}

function versionSixRaw(data: PreviewData): string {
  const envelope = createPreviewEnvelope(data);
  return JSON.stringify({
    ...envelope,
    schemaVersion: 6,
    data: {
      ...envelope.data,
      savedRhythms: envelope.data.savedRhythms.map(rhythm => {
        const { scoring: _ignored, ...legacyRhythm } = rhythm;
        return legacyRhythm;
      })
    }
  });
}

function versionSevenRaw(data: PreviewData): string {
  const envelope = createPreviewEnvelope(data);
  return JSON.stringify({
    ...envelope,
    schemaVersion: 7,
    data: {
      ...envelope.data,
      savedRhythms: envelope.data.savedRhythms.map(rhythm => {
        const {
          createdLocalDate: _createdLocalDate,
          createdTimeZone: _createdTimeZone,
          dailyBackfillAllowed: _dailyBackfillAllowed,
          ...versionSevenRhythm
        } = rhythm;
        return versionSevenRhythm;
      })
    }
  });
}

function legacySavedRhythms(rhythms: PreviewData['savedRhythms']) {
  return rhythms.map(rhythm => ({
    id: rhythm.id,
    title: rhythm.title,
    ...(rhythm.description === undefined ? {} : { description: rhythm.description }),
    cadence: rhythm.cadence,
    timeLabel: rhythm.timeLabel,
    personIds: [...rhythm.personIds],
    categoryIds: [...rhythm.categoryIds]
  }));
}

function storageFixture(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); }
  };
  return { storage, values };
}

function alteredEnvelope(change: (value: Record<string, unknown>) => void): unknown {
  const value: unknown = JSON.parse(JSON.stringify(createPreviewEnvelope(sampleWithHistory())));
  change(value as Record<string, unknown>);
  return value;
}

function setDownloadMocks() {
  const createObjectURL = vi.fn((_blob: Blob) => 'blob:synthetic-preview');
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  return { createObjectURL, revokeObjectURL };
}

describe('synthetic preview storage adapter and envelope', () => {
  it('round-trips the explicit versioned envelope with goals, check-ins, corrections, and Today completion', () => {
    const data = sampleWithHistory();
    const envelope = createPreviewEnvelope(data);
    const parsed = validatePreviewEnvelope(envelope, '2026-10-21');
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;
    expect(parsed.envelope.format).toBe('tend.synthetic-preview');
    expect(parsed.envelope.schemaVersion).toBe(8);
    expect(parsed.envelope.data).toEqual(data);

    const { storage } = storageFixture();
    expect(writePreview(storage, data, null).kind).toBe('saved');
    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind === 'loaded') expect(loaded.data).toEqual(data);
  });

  it('exports and imports structured schedules and Personal through the backup controls', async () => {
    const user = userEvent.setup();
    const data = sampleWithHistory();
    const id = 'user-rhythm-11111111-1111-4111-8111-111111111111';
    data.savedRhythms = [{
      id,
      title: 'Quarterly connection',
      cadence: 'Quarterly',
      timeLabel: 'Early morning',
      timeOfDay: 'early-morning',
      schedule: {
        frequency: 'quarterly',
        monthInQuarter: 1,
        pattern: { kind: 'dayOfMonth', day: 'last' }
      },
      personal: false,
      personIds: ['sample-person-avery'],
      categoryIds: ['marriage']
    }];
    data.completedRhythmIds.push(id);
    data.archivedRhythmIds = [id];
    data.completedRhythmIds.push('sample-connect');
    data.datedRhythmCompletions.push({
      id: 'dated-connect-2026-10-20',
      rhythmId: 'sample-connect',
      effectiveDate: '2026-10-20',
      localTime: '19:45',
      timeZone: 'UTC',
      completedAt: '2026-10-20T19:45:00.000Z',
      recordedAt: '2026-10-20T19:46:00.000Z',
      memory: 'A saved memory.'
    });
    data.activeRhythmCompletions.push({
      rhythmId: 'sample-connect',
      completionId: 'dated-connect-2026-10-20'
    });
    data.rhythmCompletionOverrides = [{
      id: 'sample-connect-2026-10-17',
      rhythmId: 'sample-connect',
      effectiveDate: '2026-10-16',
      memory: 'Date-only edit survives backup.'
    }];
    data.removedSeedCompletionIds = ['sample-connect-2026-10-18'];
    const onImport = vi.fn(() => null);
    const { createObjectURL } = setDownloadMocks();
    render(
      <PreviewDataControls
        data={data}
        status={{ kind: 'saved' }}
        currentDate="2026-10-21"
        onImport={onImport}
        onReset={() => null}
        onRetrySave={() => {}}
        onReloadExternal={() => null}
        onReplaceExternal={() => null}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Export preview backup' }));
    const blob = createObjectURL.mock.calls[0]![0];
    const backup = await blob.text();
    expect(JSON.parse(backup).schemaVersion).toBe(8);
    expect(JSON.parse(backup).data.datedRhythmCompletions).toEqual(data.datedRhythmCompletions);
    expect(JSON.parse(backup).data.activeRhythmCompletions).toEqual(data.activeRhythmCompletions);
    expect(JSON.parse(backup).data.rhythmCompletionOverrides).toEqual(data.rhythmCompletionOverrides);
    expect(JSON.parse(backup).data.removedSeedCompletionIds).toEqual(data.removedSeedCompletionIds);
    await user.upload(
      screen.getByLabelText('Import preview backup'),
      new File([backup], 'v4-structured.json', { type: 'application/json' })
    );
    const dialog = await screen.findByRole('dialog', { name: 'Replace preview data?' });
    await user.click(within(dialog).getByRole('button', { name: 'Replace with backup' }));
    expect(onImport).toHaveBeenCalledWith(data);
  });

  it('offers exact v3 recovery bytes through the shared backup controls', async () => {
    const user = userEvent.setup();
    const raw = versionThreeRaw(sampleWithHistory());
    const { createObjectURL } = setDownloadMocks();
    render(
      <PreviewDataControls
        data={createSamplePreviewData()}
        status={{ kind: 'saved' }}
        currentDate="2026-10-21"
        onImport={() => null}
        onReset={() => null}
        onRetrySave={() => {}}
        onReloadExternal={() => null}
        onReplaceExternal={() => null}
        v3RecoveryCopy={raw}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Download original v3 recovery backup' }));
    const download = createObjectURL.mock.calls[0]![0];
    expect(await download.text()).toBe(raw);
  });

  it('restores valid empty state without reinitializing sample goals or completions', () => {
    const empty = {
      goals: [],
      completedRhythmIds: [],
      savedRhythms: [],
      archivedRhythmIds: [],
      datedRhythmCompletions: [],
      activeRhythmCompletions: [],
      rhythmCompletionOverrides: [],
      removedSeedCompletionIds: []
    };
    const raw = JSON.stringify(createPreviewEnvelope(empty));
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: raw });
    const result = loadPreview(storage, '2026-10-21');
    expect(result.kind).toBe('loaded');
    if (result.kind === 'loaded') expect(result.data).toEqual(empty);
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(raw);
  });

  it('does not overwrite an existing saved draft during startup or a stale initial write', () => {
    const saved = sampleWithHistory();
    const raw = JSON.stringify(createPreviewEnvelope(saved));
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: raw });
    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(raw);
    expect(writePreview(storage, createSamplePreviewData(), null)).toEqual({ kind: 'conflict', actualRaw: raw });
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(raw);
  });

  it('migrates a v1 backup in memory while preserving goals, corrections, completions, and valid empty states', () => {
    const data = sampleWithHistory();
    const raw = versionOneRaw(data);
    const parsed = parsePreviewBackup(raw, '2026-10-21');
    expect(parsed.valid).toBe(true);
    if (parsed.valid) {
      expect(parsed.envelope.schemaVersion).toBe(8);
      expect(parsed.envelope.data).toEqual({ ...data, savedRhythms: [], archivedRhythmIds: [] });
      expect(parsed.envelope.data.goals[0]!.checkIns).toEqual(data.goals[0]!.checkIns);
      expect(parsed.envelope.data.goals[0]!.correctionHistory).toEqual(data.goals[0]!.correctionHistory);
      expect(parsed.envelope.data.completedRhythmIds).toEqual(data.completedRhythmIds);
    }

    const emptyV1 = JSON.stringify({
      format: 'tend.synthetic-preview',
      schemaVersion: 1,
      data: { goals: [], completedRhythmIds: [] }
    });
    const emptyResult = parsePreviewBackup(emptyV1, '2026-10-21');
    expect(emptyResult.valid && emptyResult.envelope.data).toEqual({
      goals: [],
      completedRhythmIds: [],
      savedRhythms: [],
      archivedRhythmIds: [],
      datedRhythmCompletions: [],
      activeRhythmCompletions: [],
      rhythmCompletionOverrides: [],
      removedSeedCompletionIds: []
    });
  });

  it('migrates v2 previews with editable Rhythms and completions while making them active', () => {
    const data = sampleWithHistory();
    const savedRhythms: PreviewData['savedRhythms'] = [{
      id: 'user-rhythm-11111111-1111-4111-8111-111111111111',
      title: 'Marriage walk',
      cadence: 'Weekly',
      timeLabel: 'Evening',
      personIds: ['sample-person-morgan'],
      categoryIds: ['marriage']
    }];
    const v2Data = { ...data, savedRhythms };
    const parsed = parsePreviewBackup(versionTwoRaw(v2Data), '2026-10-21');
    expect(parsed.valid).toBe(true);
    if (parsed.valid) {
      expect(parsed.sourceSchemaVersion).toBe(2);
      expect(parsed.envelope.schemaVersion).toBe(8);
      expect(parsed.envelope.data).toEqual({
        ...v2Data,
        savedRhythms: v2Data.savedRhythms.map(rhythm => ({ ...rhythm, timeOfDay: 'evening' })),
        archivedRhythmIds: []
      });
    }
  });

  it('loads v3 without writing and preserves exact bytes before its first explicit v4 save', () => {
    const data = sampleWithHistory();
    const id = 'user-rhythm-11111111-1111-4111-8111-111111111111';
    data.savedRhythms = [{
      id,
      title: 'Descriptive weekly rhythm',
      cadence: '3 times a week',
      timeLabel: 'Evening',
      personIds: ['sample-person-morgan'],
      categoryIds: ['marriage']
    }];
    data.completedRhythmIds.push(id);
    data.archivedRhythmIds = [id];
    const originalRaw = versionThreeRaw(data);
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: originalRaw });

    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    if (loaded.kind !== 'loaded') return;
    expect(loaded.data.savedRhythms[0]).toMatchObject({
      id,
      cadence: '3 times a week',
      timeLabel: 'Evening',
      timeOfDay: 'evening',
      personIds: ['sample-person-morgan'],
      categoryIds: ['marriage']
    });
    expect(loaded.data.savedRhythms[0]!.schedule).toBeUndefined();
    expect(loaded.data.completedRhythmIds).toContain(id);
    expect(loaded.data.archivedRhythmIds).toEqual([id]);

    const result = writePreview(storage, loaded.data, originalRaw, { currentDate: '2026-10-21' });
    expect(result.kind).toBe('saved');
    expect(values.get(PREVIEW_V3_RECOVERY_KEY)).toBe(originalRaw);
    expect(loadV3RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: originalRaw });
    expect(JSON.parse(values.get(PREVIEW_STORAGE_KEY)!).schemaVersion).toBe(8);
  });

  it('blocks v3 replacement on recovery conflicts or recovery storage failures', () => {
    const originalRaw = versionThreeRaw(sampleWithHistory());
    const conflict = storageFixture({
      [PREVIEW_STORAGE_KEY]: originalRaw,
      [PREVIEW_V3_RECOVERY_KEY]: '{"different":"v3"}'
    });
    expect(loadPreview(conflict.storage, '2026-10-21').kind).toBe('loaded');
    expect(writePreview(conflict.storage, createSamplePreviewData(), originalRaw, {
      currentDate: '2026-10-21'
    })).toMatchObject({ kind: 'error' });
    expect(conflict.values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);

    const values = new Map([[PREVIEW_STORAGE_KEY, originalRaw]]);
    const failingStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key === PREVIEW_V3_RECOVERY_KEY) throw new Error('Recovery write blocked');
        values.set(key, value);
      }
    };
    expect(writePreview(failingStorage, createSamplePreviewData(), originalRaw, {
      currentDate: '2026-10-21'
    }))
      .toMatchObject({ kind: 'error', message: 'Recovery write blocked' });
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    expect(values.has(PREVIEW_V3_RECOVERY_KEY)).toBe(false);
  });

  it('preserves exact v4 bytes before the first v5 replacement and blocks recovery conflicts', () => {
    const originalRaw = ` \n${versionFourRaw(sampleWithHistory())}\n`;
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: originalRaw });
    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    if (loaded.kind !== 'loaded') return;
    expect(loaded.data.datedRhythmCompletions).toEqual([]);

    expect(writePreview(storage, loaded.data, originalRaw, { currentDate: '2026-10-21' }).kind).toBe('saved');
    expect(values.get(PREVIEW_V4_RECOVERY_KEY)).toBe(originalRaw);
    expect(loadV4RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: originalRaw });
    expect(JSON.parse(values.get(PREVIEW_STORAGE_KEY)!).schemaVersion).toBe(8);

    const conflicting = storageFixture({
      [PREVIEW_STORAGE_KEY]: originalRaw,
      [PREVIEW_V4_RECOVERY_KEY]: '{"different":"v4"}'
    });
    expect(writePreview(conflicting.storage, createSamplePreviewData(), originalRaw, {
      currentDate: '2026-10-21'
    })).toMatchObject({ kind: 'error' });
    expect(conflicting.values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    expect(conflicting.values.get(PREVIEW_V4_RECOVERY_KEY)).toBe('{"different":"v4"}');

    const failingValues = new Map([[PREVIEW_STORAGE_KEY, originalRaw]]);
    const failingStorage = {
      getItem: (key: string) => failingValues.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key === PREVIEW_V4_RECOVERY_KEY) throw new Error('v4 recovery write blocked');
        failingValues.set(key, value);
      }
    };
    expect(writePreview(failingStorage, createSamplePreviewData(), originalRaw, {
      currentDate: '2026-10-21'
    })).toMatchObject({ kind: 'error', message: 'v4 recovery write blocked' });
    expect(failingValues.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
  });

  it('preserves exact v5 bytes before the first v8 replacement and blocks recovery conflicts', () => {
    const originalRaw = ` \n${versionFiveRaw(sampleWithHistory())}\n`;
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: originalRaw });
    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    expect(loadV5RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: null });
    if (loaded.kind !== 'loaded') return;
    expect(loaded.data.rhythmCompletionOverrides).toEqual([]);
    expect(loaded.data.removedSeedCompletionIds).toEqual([]);

    expect(writePreview(storage, loaded.data, originalRaw, { currentDate: '2026-10-21' }).kind).toBe('saved');
    expect(values.get(PREVIEW_V5_RECOVERY_KEY)).toBe(originalRaw);
    expect(loadV5RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: originalRaw });
    expect(JSON.parse(values.get(PREVIEW_STORAGE_KEY)!).schemaVersion).toBe(8);

    const conflicting = storageFixture({
      [PREVIEW_STORAGE_KEY]: originalRaw,
      [PREVIEW_V5_RECOVERY_KEY]: '{"different":"v5"}'
    });
    expect(writePreview(conflicting.storage, createSamplePreviewData(), originalRaw, {
      currentDate: '2026-10-21'
    })).toMatchObject({ kind: 'error' });
    expect(conflicting.values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    expect(conflicting.values.get(PREVIEW_V5_RECOVERY_KEY)).toBe('{"different":"v5"}');

    const failingValues = new Map([[PREVIEW_STORAGE_KEY, originalRaw]]);
    const failingStorage = {
      getItem: (key: string) => failingValues.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key === PREVIEW_V5_RECOVERY_KEY) throw new Error('v5 recovery write blocked');
        failingValues.set(key, value);
      }
    };
    expect(writePreview(failingStorage, createSamplePreviewData(), originalRaw, {
      currentDate: '2026-10-21'
    })).toMatchObject({ kind: 'error', message: 'v5 recovery write blocked' });
    expect(failingValues.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
  });

  it('migrates schema v6 in memory and preserves its exact bytes before a v8 replacement', () => {
    const originalRaw = ` \n${versionSixRaw(sampleWithHistory())}\n`;
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: originalRaw });
    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    expect(loadV6RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: null });
    if (loaded.kind !== 'loaded') return;
    expect(loaded.data.savedRhythms.every(rhythm => rhythm.scoring === undefined)).toBe(true);

    expect(writePreview(storage, loaded.data, originalRaw, { currentDate: '2026-10-21' }).kind).toBe('saved');
    expect(values.get(PREVIEW_V6_RECOVERY_KEY)).toBe(originalRaw);
    expect(loadV6RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: originalRaw });
    expect(JSON.parse(values.get(PREVIEW_STORAGE_KEY)!).schemaVersion).toBe(8);
  });

  it('migrates schema v7 read-only and preserves its exact bytes before the first v8 write', () => {
    const originalRaw = ` \n${versionSevenRaw(sampleWithHistory())}\n`;
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: originalRaw });
    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    expect(loadV7RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: null });
    if (loaded.kind !== 'loaded') return;
    expect(loaded.data.savedRhythms.every(rhythm => rhythm.createdLocalDate === undefined)).toBe(true);

    expect(writePreview(storage, loaded.data, originalRaw, { currentDate: '2026-10-21' }).kind).toBe('saved');
    expect(values.get(PREVIEW_V7_RECOVERY_KEY)).toBe(originalRaw);
    expect(loadV7RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: originalRaw });
    expect(JSON.parse(values.get(PREVIEW_STORAGE_KEY)!).schemaVersion).toBe(8);
  });

  it('validates and round-trips seed overrides and removals without allowing invented associations', () => {
    const data = sampleWithHistory();
    data.rhythmCompletionOverrides = [{
      id: 'sample-connect-2026-10-17',
      rhythmId: 'sample-connect',
      effectiveDate: '2026-10-16',
      memory: 'Edited without adding a time.'
    }, {
      id: 'sample-connect-2026-10-20',
      rhythmId: 'sample-connect',
      effectiveDate: '2026-10-20',
      localTime: '09:30',
      timeZone: 'UTC',
      completedAt: '2026-10-20T09:30:00.000Z'
    }];
    data.removedSeedCompletionIds = ['sample-connect-2026-10-18'];
    const raw = JSON.stringify(createPreviewEnvelope(data));
    const parsed = parsePreviewBackup(raw, '2026-10-21');
    expect(parsed.valid).toBe(true);
    if (parsed.valid) expect(parsed.envelope.data).toEqual(data);

    const invalidOverride = JSON.parse(raw) as {
      data: { rhythmCompletionOverrides: Array<Record<string, unknown>> };
    };
    invalidOverride.data.rhythmCompletionOverrides[0]!.rhythmId = 'sample-pray-together';
    expect(parsePreviewBackup(JSON.stringify(invalidOverride), '2026-10-21')).toMatchObject({
      valid: false,
      kind: 'invalid'
    });

    const conflicted = JSON.parse(raw) as {
      data: { removedSeedCompletionIds: string[] };
    };
    conflicted.data.removedSeedCompletionIds.push('sample-connect-2026-10-17');
    expect(parsePreviewBackup(JSON.stringify(conflicted), '2026-10-21')).toMatchObject({
      valid: false,
      kind: 'invalid'
    });
  });

  it('does not automatically replace malformed supported-version source data', () => {
    const malformedEnvelope = JSON.parse(versionThreeRaw(sampleWithHistory())) as {
      data: { archivedRhythmIds: string[] };
    };
    malformedEnvelope.data.archivedRhythmIds = ['unresolved-rhythm-id'];
    const raw = JSON.stringify(malformedEnvelope);
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: raw });
    expect(loadPreview(storage, '2026-10-21')).toMatchObject({ kind: 'corrupt', raw });
    expect(writePreview(storage, createSamplePreviewData(), raw, {
      currentDate: '2026-10-21'
    })).toMatchObject({ kind: 'error' });
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(raw);
    expect(values.has(PREVIEW_V3_RECOVERY_KEY)).toBe(false);
  });

  it('archives the exact v1 envelope before the first v4 write and never overwrites that recovery copy', () => {
    const initial = sampleWithHistory();
    const originalRaw = versionOneRaw(initial);
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: originalRaw });
    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    expect(loaded.data).toEqual({ ...initial, savedRhythms: [] });
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    expect(loadV1RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: null });

    const updated = { ...loaded.data, completedRhythmIds: ['sample-connect'] };
    expect(writePreview(storage, updated, originalRaw, { currentDate: '2026-10-21' }).kind).toBe('saved');
    expect(values.get(PREVIEW_V1_RECOVERY_KEY)).toBe(originalRaw);
    const recoveryCopy = values.get(PREVIEW_V1_RECOVERY_KEY);
    const activeV2 = values.get(PREVIEW_STORAGE_KEY)!;
    expect(JSON.parse(activeV2).schemaVersion).toBe(8);
    expect(writePreview(storage, { ...updated, completedRhythmIds: [] }, activeV2, {
      currentDate: '2026-10-21'
    }).kind).toBe('saved');
    expect(values.get(PREVIEW_V1_RECOVERY_KEY)).toBe(recoveryCopy);

    const occupied = storageFixture({
      [PREVIEW_STORAGE_KEY]: originalRaw,
      [PREVIEW_V1_RECOVERY_KEY]: '{"other":"preserved"}'
    });
    expect(writePreview(occupied.storage, loaded.data, originalRaw, {
      currentDate: '2026-10-21'
    })).toMatchObject({ kind: 'error' });
    expect(occupied.values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    expect(occupied.values.get(PREVIEW_V1_RECOVERY_KEY)).toBe('{"other":"preserved"}');
  });

  it('preserves exact v2 bytes before migration and blocks conflicting recovery copies', () => {
    const data = sampleWithHistory();
    data.savedRhythms = [{
      id: 'user-rhythm-11111111-1111-4111-8111-111111111111',
      title: 'Marriage walk',
      cadence: 'Weekly',
      timeLabel: 'Evening',
      personIds: ['sample-person-morgan'],
      categoryIds: ['marriage']
    }];
    const originalRaw = versionTwoRaw(data);
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: originalRaw });
    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;

    expect(writePreview(storage, {
      ...loaded.data,
      archivedRhythmIds: [data.savedRhythms[0]!.id]
    }, originalRaw, { currentDate: '2026-10-21' }).kind).toBe('saved');
    expect(values.get(PREVIEW_V2_RECOVERY_KEY)).toBe(originalRaw);
    expect(loadV2RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: originalRaw });
    expect(JSON.parse(values.get(PREVIEW_STORAGE_KEY)!).schemaVersion).toBe(8);

    const occupied = storageFixture({
      [PREVIEW_STORAGE_KEY]: originalRaw,
      [PREVIEW_V2_RECOVERY_KEY]: '{"different":"v2"}'
    });
    expect(writePreview(occupied.storage, loaded.data, originalRaw, {
      currentDate: '2026-10-21'
    })).toMatchObject({ kind: 'error' });
    expect(occupied.values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    expect(occupied.values.get(PREVIEW_V2_RECOVERY_KEY)).toBe('{"different":"v2"}');
  });

  it('round-trips schema v8 creation and scoring metadata with prior records and goal history', () => {
    const data = sampleWithHistory();
    const id = 'user-rhythm-11111111-1111-4111-8111-111111111111';
    data.savedRhythms = [{
      id,
      title: 'Monthly connection',
      cadence: 'Monthly',
      timeLabel: 'All day',
      timeOfDay: 'all-day',
      schedule: {
        frequency: 'monthly',
        pattern: { kind: 'ordinalWeekday', ordinal: 2, weekday: 4 },
        endDate: '2028-10-22'
      },
      scoring: {
        trackingStartDate: '2026-10-01',
        timeZone: 'America/New_York',
        scheduleHistory: [{
          startDate: '2026-10-01',
          schedule: {
            frequency: 'monthly',
            pattern: { kind: 'ordinalWeekday', ordinal: 2, weekday: 4 },
            endDate: '2028-10-22'
          }
        }]
      },
      personal: true,
      personIds: ['sample-person-morgan', 'sample-person-avery'],
      categoryIds: ['marriage', 'friendships']
    }];
    data.completedRhythmIds.push(id);
    data.archivedRhythmIds = [id];
    data.rhythmCompletionOverrides = [{
      id: 'sample-connect-2026-10-17',
      rhythmId: 'sample-connect',
      effectiveDate: '2026-10-16',
      memory: 'A date-only fixture edit.'
    }];
    data.removedSeedCompletionIds = ['sample-connect-2026-10-18'];
    const { storage } = storageFixture();

    const saved = writePreview(storage, data, null);
    expect(saved.kind).toBe('saved');
    if (saved.kind !== 'saved') return;
    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    expect(loaded.data).toEqual(data);
    expect(parsePreviewBackup(saved.raw, '2026-10-21')).toMatchObject({
      valid: true,
      sourceSchemaVersion: 8,
      envelope: { schemaVersion: 8 }
    });
  });

  it('does not overwrite an unsupported active envelope', () => {
    const unsupportedRaw = JSON.stringify({
      format: 'tend.synthetic-preview',
      schemaVersion: 9,
      data: { goals: [], completedRhythmIds: [], savedRhythms: [], archivedRhythmIds: [] }
    });
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: unsupportedRaw });
    expect(loadPreview(storage, '2026-10-21')).toMatchObject({ kind: 'unsupported', raw: unsupportedRaw });
    expect(writePreview(storage, createSamplePreviewData(), null)).toEqual({
      kind: 'conflict',
      actualRaw: unsupportedRaw
    });
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(unsupportedRaw);
  });

  it('keeps malformed v7 data untouched and blocks non-explicit adapter writes', () => {
    const data = sampleWithHistory();
    data.savedRhythms = [{
      id: 'user-rhythm-11111111-1111-4111-8111-111111111111',
      title: 'Malformed schedule',
      cadence: 'Weekly',
      timeLabel: 'Morning',
      timeOfDay: 'morning',
      schedule: { frequency: 'weekly', weekdays: [1] },
      personIds: [],
      categoryIds: []
    }];
    const malformed = JSON.parse(JSON.stringify(createPreviewEnvelope(data))) as {
      data: { savedRhythms: Array<Record<string, unknown>> };
    };
    malformed.data.savedRhythms[0]!.schedule = {
      frequency: 'weekly',
      weekdays: [1, 1]
    };
    const raw = JSON.stringify(malformed);
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: raw });
    expect(loadPreview(storage, '2026-10-21')).toMatchObject({ kind: 'corrupt', raw });
    expect(writePreview(storage, createSamplePreviewData(), raw, {
      currentDate: '2026-10-21'
    })).toMatchObject({ kind: 'error' });
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(raw);
  });

  it('touches only the isolated preview key, leaving existing Tend storage keys unchanged', () => {
    const legacyKeys = {
      'tend-state': '{"live":"unchanged"}',
      'tend:account-cache': '{"account":"unchanged"}',
      'supabase.auth.token': '{"auth":"unchanged"}',
      'tend:calendar-cache': '{"calendar":"unchanged"}',
      'tend:sync-state': '{"sync":"unchanged"}'
    };
    const { storage, values } = storageFixture(legacyKeys);
    expect(loadPreview(storage, '2026-10-21').kind).toBe('missing');
    expect(writePreview(storage, createSamplePreviewData(), null).kind).toBe('saved');
    for (const [key, value] of Object.entries(legacyKeys)) expect(values.get(key)).toBe(value);
    expect([...values.keys()]).toEqual([...Object.keys(legacyKeys), PREVIEW_STORAGE_KEY]);
  });

  it('rejects malformed JSON, unsupported versions, malformed records, duplicate IDs, and invalid references', () => {
    expect(parsePreviewBackup('{', '2026-10-21').valid).toBe(false);
    const unsupported = createPreviewEnvelope(sampleWithHistory());
    expect(validatePreviewEnvelope({ ...unsupported, schemaVersion: 9 }, '2026-10-21')).toMatchObject({
      valid: false,
      kind: 'unsupported'
    });
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      const data = value.data as Record<string, unknown>;
      (data.goals as Array<Record<string, unknown>>)[0]!.targetBalanceMinor = -1;
    }), '2026-10-21').valid).toBe(false);
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      const data = value.data as Record<string, unknown>;
      const goals = data.goals as Array<Record<string, unknown>>;
      goals.push({ ...goals[0] });
    }), '2026-10-21').valid).toBe(false);
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      const data = value.data as Record<string, unknown>;
      data.completedRhythmIds = ['not-a-today-example'];
    }), '2026-10-21').valid).toBe(false);
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      const data = value.data as Record<string, unknown>;
      data.archivedRhythmIds = ['not-a-today-example'];
    }), '2026-10-21').valid).toBe(false);
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      const data = value.data as Record<string, unknown>;
      data.archivedRhythmIds = ['sample-pray-together', 'sample-pray-together'];
    }), '2026-10-21').valid).toBe(false);
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      delete (value.data as Record<string, unknown>).archivedRhythmIds;
    }), '2026-10-21').valid).toBe(false);
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      const data = value.data as Record<string, unknown>;
      const goals = data.goals as Array<Record<string, unknown>>;
      goals[0]!.startDate = '2026-02-30';
    }), '2026-10-21').valid).toBe(false);
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      const data = value.data as Record<string, unknown>;
      const goals = data.goals as Array<Record<string, unknown>>;
      const checkIns = goals[0]!.checkIns as Array<Record<string, unknown>>;
      checkIns[0]!.effectiveDate = 'not-a-date';
    }), '2026-10-21').valid).toBe(false);
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      const data = value.data as Record<string, unknown>;
      const goals = data.goals as Array<Record<string, unknown>>;
      const checkIns = goals[0]!.checkIns as Array<Record<string, unknown>>;
      checkIns[0]!.effectiveDate = '2026-10-22';
    }), '2026-10-21').valid).toBe(false);
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      const data = value.data as Record<string, unknown>;
      const goals = data.goals as Array<Record<string, unknown>>;
      const checkIns = goals[0]!.checkIns as Array<Record<string, unknown>>;
      checkIns[1]!.id = checkIns[0]!.id;
    }), '2026-10-21').valid).toBe(false);
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      const data = value.data as Record<string, unknown>;
      const goals = data.goals as Array<Record<string, unknown>>;
      goals[0]!.currency = 'ZZZ';
    }), '2026-10-21').valid).toBe(false);
  });

  it('preserves corrupt stored bytes and reports blocked and quota-failed storage', () => {
    const corruptRaw = '{"broken":';
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: corruptRaw });
    expect(loadPreview(storage, '2026-10-21')).toMatchObject({ kind: 'corrupt', raw: corruptRaw });
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(corruptRaw);

    const blocked = {
      getItem: () => { throw new Error('Storage access denied'); },
      setItem: () => {},
      removeItem: () => {}
    };
    expect(loadPreview(blocked, '2026-10-21')).toMatchObject({ kind: 'unavailable', message: 'Storage access denied' });

    const quota = {
      getItem: () => null,
      setItem: () => { throw new Error('Quota exceeded'); },
      removeItem: () => {}
    };
    expect(writePreview(quota, createSamplePreviewData(), null))
      .toMatchObject({ kind: 'error', message: 'Quota exceeded' });
  });

  it('detects an external-tab write before replacing a stale value', () => {
    const first = JSON.stringify(createPreviewEnvelope(createSamplePreviewData()));
    const secondData = sampleWithHistory();
    const second = JSON.stringify(createPreviewEnvelope(secondData));
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: first });
    expect(writePreview(storage, secondData, first, { currentDate: '2026-10-21' })).toMatchObject({ kind: 'saved' });
    expect(writePreview(storage, createSamplePreviewData(), first, { currentDate: '2026-10-21' }))
      .toEqual({ kind: 'conflict', actualRaw: second });
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(second);
  });
});

describe('preview backup controls', () => {
  it('exports the explicit envelope and imports the backup through confirmation', async () => {
    const user = userEvent.setup();
    const data = sampleWithHistory();
    data.archivedRhythmIds = ['sample-pray-together'];
    const onImport = vi.fn(() => null);
    const { createObjectURL } = setDownloadMocks();
    render(
      <PreviewDataControls
        data={data}
        status={{ kind: 'saved' }}
        currentDate="2026-10-21"
        onImport={onImport}
        onReset={() => null}
        onRetrySave={() => {}}
        onReloadExternal={() => null}
        onReplaceExternal={() => null}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Export preview backup' }));
    const exportedBlob = createObjectURL.mock.calls[0]![0];
    const exportedText = await exportedBlob.text();
    const exported = JSON.parse(exportedText) as Record<string, unknown>;
    expect(Object.keys(exported).sort()).toEqual(['data', 'format', 'schemaVersion']);
    expect(exported.format).toBe('tend.synthetic-preview');
    expect(exported.schemaVersion).toBe(8);
    expect((exported.data as PreviewData).archivedRhythmIds).toEqual(['sample-pray-together']);
    await user.upload(
      screen.getByLabelText('Import preview backup'),
      new File([exportedText], 'exported.json', { type: 'application/json' })
    );
    const dialog = await screen.findByRole('dialog', { name: 'Replace preview data?' });
    await user.click(within(dialog).getByRole('button', { name: 'Replace with backup' }));
    expect(onImport).toHaveBeenCalledWith(data);
  });

  it('imports v2 backups as active and explains the missing archive state before replacement', async () => {
    const user = userEvent.setup();
    const legacyData = sampleWithHistory();
    legacyData.savedRhythms = [{
      id: 'user-rhythm-11111111-1111-4111-8111-111111111111',
      title: 'Earlier saved Rhythm',
      cadence: 'Weekly',
      timeLabel: 'Evening',
      personIds: ['sample-person-morgan'],
      categoryIds: ['marriage']
    }];
    const onImport = vi.fn(() => null);
    render(
      <PreviewDataControls
        data={createSamplePreviewData()}
        status={{ kind: 'saved' }}
        currentDate="2026-10-21"
        onImport={onImport}
        onReset={() => null}
        onRetrySave={() => {}}
        onReloadExternal={() => null}
        onReplaceExternal={() => null}
      />
    );
    await user.upload(
      screen.getByLabelText('Import preview backup'),
      new File([versionTwoRaw(legacyData)], 'v2-backup.json', { type: 'application/json' })
    );
    const dialog = await screen.findByRole('dialog', { name: 'Replace preview data?' });
    expect(within(dialog).getByText(/predates archive status, so its Rhythms will be restored as active/)).toBeTruthy();
    expect(onImport).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Replace with backup' }));
    expect(onImport).toHaveBeenCalledWith({
      ...legacyData,
      savedRhythms: legacyData.savedRhythms.map(rhythm => ({ ...rhythm, timeOfDay: 'evening' })),
      archivedRhythmIds: []
    });
  });

  it('imports only after validation and confirmation, and cancellation preserves current state', async () => {
    const user = userEvent.setup();
    const imported = sampleWithHistory();
    imported.goals[0]!.title = '<script>sample</script>';
    const onImport = vi.fn(() => null);
    const { container } = render(
      <PreviewDataControls
        data={createSamplePreviewData()}
        status={{ kind: 'saved' }}
        currentDate="2026-10-21"
        onImport={onImport}
        onReset={() => null}
        onRetrySave={() => {}}
        onReloadExternal={() => null}
        onReplaceExternal={() => null}
      />
    );
    const input = within(container).getByLabelText('Import preview backup') as HTMLInputElement;
    const file = new File([JSON.stringify(createPreviewEnvelope(imported))], 'sample.json', { type: 'application/json' });
    await user.upload(input, file);
    const dialog = await screen.findByRole('dialog', { name: 'Replace preview data?' });
    expect(within(dialog).getByText(/Cancel leaves the current preview unchanged/)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Download current preview backup' })).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onImport).not.toHaveBeenCalled();
    expect(screen.getByText('Preview data saved in this browser.')).toBeTruthy();
  });

  it('offers export before reset and preserves storage when the replacement is cancelled', async () => {
    const user = userEvent.setup();
    const original = JSON.stringify(createPreviewEnvelope(sampleWithHistory()));
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, original);
    const { createObjectURL } = setDownloadMocks();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(screen.getByRole('button', { name: 'Reset sample data' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reset sample data?' });
    await user.click(within(dialog).getByRole('button', { name: 'Download current preview backup' }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(original);
  });

  it('preserves corrupt storage, offers raw recovery, and resets only the preview key after confirmation', async () => {
    const user = userEvent.setup();
    const corruptRaw = '{"bad":';
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, corruptRaw);
    window.localStorage.setItem('tend-state', '{"live":"keep"}');
    const { createObjectURL } = setDownloadMocks();
    render(<App />);

    expect(await screen.findByText(/original value is preserved/)).toBeTruthy();
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(corruptRaw);
    await user.click(screen.getByRole('button', { name: 'Download raw recovery file' }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    const recoveryBlob = createObjectURL.mock.calls[0]![0] as Blob;
    expect(await recoveryBlob.text()).toBe(corruptRaw);

    await user.click(screen.getByRole('button', { name: 'Reset sample data' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reset sample data?' });
    await user.click(within(dialog).getByRole('button', { name: 'Reset sample data' }));
    expect(await screen.findByText('Preview data saved in this browser.')).toBeTruthy();
    expect(loadPreview(browserPreviewStorage(), '2026-10-21').kind).toBe('loaded');
    expect(window.localStorage.getItem('tend-state')).toBe('{"live":"keep"}');
  });

  it('keeps app state on an invalid backup and restores goal corrections and Today completion on remount', async () => {
    const user = userEvent.setup();
    const openFinances = () => user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Finances' }));
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(screen.getByRole('button', { name: 'Tend Pray together' }));
    const completionDialog = await screen.findByRole('dialog', { name: 'When did you tend it?' });
    await user.click(within(completionDialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tended Pray together' }).matches(':disabled')).toBe(true));
    await openFinances();
    const goal = screen.getByRole('article', { name: 'Starter reserve' });
    await user.click(within(goal).getAllByRole('button', { name: 'Correct' })[0]!);
    const correction = screen.getByRole('dialog', { name: 'Correct balance check-in' });
    const balance = within(correction).getByLabelText('Current balance');
    await user.clear(balance);
    await user.type(balance, '1350.00');
    await user.click(within(correction).getByRole('button', { name: 'Save correction' }));
    const beforeInvalidImport = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    await user.upload(
      screen.getByLabelText('Import preview backup'),
      new File(['{"format":"bad"}'], 'invalid.json', { type: 'application/json' })
    );
    expect(await screen.findByText(/format or schema version is not supported/)).toBeTruthy();
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(beforeInvalidImport);

    cleanup();
    render(<App />);
    expect(await screen.findByText('1 of 3 tended')).toBeTruthy();
    await openFinances();
    const restored = screen.getByRole('article', { name: 'Starter reserve' });
    expect(within(restored).getByText('$1,350.00')).toBeTruthy();
    expect(within(restored).getByText(/previous value \$1,250\.00/)).toBeTruthy();
    expect(within(restored).getByRole('heading', { name: 'Correction history' })).toBeTruthy();
  });

  it('preserves a backdated Tend state through backup export, import and reload', async () => {
    const user = userEvent.setup();
    const { createObjectURL } = setDownloadMocks();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');

    const card = screen.getByRole('article', { name: 'Take a walk' });
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);
    const effectiveDate = localDateString(pastDate);
    const dateLabel = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(new Date(`${effectiveDate}T12:00:00`));

    await user.click(within(card).getByRole('button', { name: 'Tend Take a walk' }));
    const completionDialog = screen.getByRole('dialog', { name: 'When did you tend it?' });
    fireEvent.change(within(completionDialog).getByLabelText('Date'), { target: { value: effectiveDate } });
    await user.click(within(completionDialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(within(card).getByRole('button', { name: 'Tend Take a walk' })).toBeTruthy();
      expect(within(card).getByText(`Last tended ${dateLabel}`)).toBeTruthy();
    });

    await user.click(screen.getByRole('button', { name: 'Export preview backup' }));
    const exportedText = await (createObjectURL.mock.calls[0]![0] as Blob).text();
    await user.upload(
      screen.getByLabelText('Import preview backup'),
      new File([exportedText], 'backdated.json', { type: 'application/json' })
    );
    const importDialog = await screen.findByRole('dialog', { name: 'Replace preview data?' });
    await user.click(within(importDialog).getByRole('button', { name: 'Replace with backup' }));
    await waitFor(() => {
      expect(within(card).getByRole('button', { name: 'Tend Take a walk' })).toBeTruthy();
      expect(within(card).getByText(`Last tended ${dateLabel}`)).toBeTruthy();
    });

    cleanup();
    render(<App />);
    const restoredCard = await screen.findByRole('article', { name: 'Take a walk' });
    expect(within(restoredCard).getByRole('button', { name: 'Tend Take a walk' })).toBeTruthy();
    expect(within(restoredCard).getByText(`Last tended ${dateLabel}`)).toBeTruthy();
  });

  it('renders imported strings as text and persists the confirmed preview replacement', async () => {
    const user = userEvent.setup();
    const imported = sampleWithHistory();
    imported.goals[0]!.title = '<script>synthetic</script>';
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.upload(
      screen.getByLabelText('Import preview backup'),
      new File([JSON.stringify(createPreviewEnvelope(imported))], 'safe-data.json', { type: 'application/json' })
    );
    const dialog = await screen.findByRole('dialog', { name: 'Replace preview data?' });
    await user.click(within(dialog).getByRole('button', { name: 'Replace with backup' }));
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Finances' }));
    const importedGoal = screen.getByRole('article', { name: '<script>synthetic</script>' });
    expect(importedGoal.textContent).toContain('<script>synthetic</script>');
    expect(importedGoal.querySelector('script')).toBeNull();
    const saved = JSON.parse(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!) as {
      data: { goals: Array<{ title: string }> };
    };
    expect(saved.data.goals[0]!.title).toBe('<script>synthetic</script>');
  });

  it('requires an explicit decision for another tab and supports reload or replacement', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    const oldValue = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    const external = createSamplePreviewData();
    external.goals[0]!.title = 'Another tab reserve';
    const newValue = JSON.stringify(createPreviewEnvelope(external));
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, newValue);
    const storageEvent = new Event('storage');
    Object.defineProperties(storageEvent, {
      key: { value: PREVIEW_STORAGE_KEY },
      oldValue: { value: oldValue },
      newValue: { value: newValue }
    });
    window.dispatchEvent(storageEvent);
    expect(await screen.findByText(/changed in another tab/)).toBeTruthy();
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Finances' }));
    expect(screen.getByRole('article', { name: 'Starter reserve' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Reload other tab’s preview' }));
    expect(await screen.findByRole('article', { name: 'Another tab reserve' })).toBeTruthy();
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(newValue);

    const laterExternal = createSamplePreviewData();
    laterExternal.goals[0]!.title = 'Third tab reserve';
    const laterValue = JSON.stringify(createPreviewEnvelope(laterExternal));
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, laterValue);
    const laterEvent = new Event('storage');
    Object.defineProperties(laterEvent, {
      key: { value: PREVIEW_STORAGE_KEY },
      oldValue: { value: newValue },
      newValue: { value: laterValue }
    });
    window.dispatchEvent(laterEvent);
    await screen.findByText(/changed in another tab/);
    await user.click(screen.getByRole('button', { name: 'Replace other tab’s data' }));
    const replaceDialog = await screen.findByRole('dialog', { name: 'Replace the other tab?' });
    expect(within(replaceDialog).getByRole('button', { name: 'Download current preview backup' })).toBeTruthy();
    await user.click(within(replaceDialog).getByRole('button', { name: 'Replace other tab' }));
    expect(JSON.parse(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!).data.goals[0].title)
      .toBe('Another tab reserve');
  });

  it('reports blocked storage and quota errors without claiming that data was saved', async () => {
    vi.spyOn(MemoryStorage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage access denied'); });
    render(<App />);
    expect(await screen.findByText(/Browser storage is unavailable/)).toBeTruthy();
    expect(screen.queryByText('Preview data saved in this browser.')).toBeNull();
    cleanup();
    vi.restoreAllMocks();

    vi.spyOn(MemoryStorage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded'); });
    render(<App />);
    expect(await screen.findByText(/Preview data was not saved\. Quota exceeded/)).toBeTruthy();
    expect(screen.queryByText('Preview data saved in this browser.')).toBeNull();
  });
});
