import { describe, expect, it } from 'vitest';
import { createPreviewEnvelope, createSamplePreviewData, parsePreviewBackup } from '../src/domain/preview-state.ts';
import type { PreviewData } from '../src/domain/preview-state.ts';
import { migratePreviewToProposedV4, PROPOSED_PREVIEW_SCHEMA_VERSION } from '../src/domain/preview-v4-migration.ts';
import { loadPreview, PREVIEW_STORAGE_KEY, writePreview } from '../src/storage/preview-storage.ts';
import {
  PREVIEW_V3_RECOVERY_KEY,
  preserveProposedV4SourceRecovery,
  proposedV4RecoveryKeyForRaw
} from '../src/storage/preview-v4-recovery.ts';
import { PREVIEW_V4_RECOVERY_KEY } from '../src/storage/preview-v4-recovery.ts';

const currentDate = '2026-10-22';
const savedRhythmId = 'user-rhythm-11111111-1111-4111-8111-111111111111';

function dataWithHistory(): PreviewData {
  const data = createSamplePreviewData();
  data.goals[0]!.correctionHistory.push({
    effectiveDate: '2026-10-18',
    previousBalanceMinor: 120_000,
    previousNote: 'Earlier value',
    replacedAt: '2026-10-20T12:30:00.000Z'
  });
  data.completedRhythmIds = ['sample-pray-together', savedRhythmId];
  data.savedRhythms = [{
    id: savedRhythmId,
    title: 'Three flexible connections',
    description: 'Keep the original descriptive cadence until explicitly edited.',
    cadence: '3 times a week',
    timeLabel: 'Evening',
    personIds: ['sample-person-morgan', 'sample-person-avery'],
    categoryIds: ['marriage', 'friendships']
  }];
  data.archivedRhythmIds = [savedRhythmId];
  return data;
}

function rawAtVersion(data: PreviewData, version: 1 | 2 | 3 | 4): string {
  const envelope = createPreviewEnvelope(data);
  const versionOneCompletions = data.completedRhythmIds.filter(id => id !== savedRhythmId);
  const legacySavedRhythms = envelope.data.savedRhythms.map(rhythm => ({
    id: rhythm.id,
    title: rhythm.title,
    ...(rhythm.description === undefined ? {} : { description: rhythm.description }),
    cadence: rhythm.cadence,
    timeLabel: rhythm.timeLabel,
    personIds: [...rhythm.personIds],
    categoryIds: [...rhythm.categoryIds]
  }));
  return JSON.stringify({
    format: envelope.format,
    schemaVersion: version,
    data: version === 1
      ? { goals: envelope.data.goals, completedRhythmIds: versionOneCompletions }
      : version === 2
        ? {
            goals: envelope.data.goals,
            completedRhythmIds: envelope.data.completedRhythmIds,
            savedRhythms: legacySavedRhythms
          }
        : version === 3
          ? {
              goals: envelope.data.goals,
              completedRhythmIds: envelope.data.completedRhythmIds,
              savedRhythms: legacySavedRhythms,
              archivedRhythmIds: envelope.data.archivedRhythmIds
            }
          : {
              goals: envelope.data.goals,
              completedRhythmIds: envelope.data.completedRhythmIds,
              savedRhythms: envelope.data.savedRhythms,
              archivedRhythmIds: envelope.data.archivedRhythmIds
            }
  });
}

function storageFixture(activeRaw: string) {
  const values = new Map([[PREVIEW_STORAGE_KEY, activeRaw]]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }
  };
  return { storage, values };
}

describe('v4 migration and recovery domain', () => {
  it('migrates v3 without converting descriptive cadence or changing identity-level state', () => {
    const data = dataWithHistory();
    const raw = rawAtVersion(data, 3);
    const result = migratePreviewToProposedV4(raw, currentDate);
    expect(result.valid).toBe(true);
    if (!result.valid) return;

    expect(result.sourceSchemaVersion).toBe(3);
    expect(result.envelope.schemaVersion).toBe(PROPOSED_PREVIEW_SCHEMA_VERSION);
    expect(result.envelope.data.goals).toEqual(data.goals);
    expect(result.envelope.data.goals[0]!.checkIns).toEqual(data.goals[0]!.checkIns);
    expect(result.envelope.data.goals[0]!.correctionHistory).toEqual(data.goals[0]!.correctionHistory);
    expect(result.envelope.data.completedRhythmIds).toEqual(data.completedRhythmIds);
    expect(result.envelope.data.archivedRhythmIds).toEqual(data.archivedRhythmIds);
    expect(result.envelope.data.savedRhythms[0]).toMatchObject({
      id: savedRhythmId,
      cadence: '3 times a week',
      timeLabel: 'Evening',
      timeOfDay: 'evening',
      personIds: ['sample-person-morgan', 'sample-person-avery'],
      categoryIds: ['marriage', 'friendships']
    });
    expect(result.envelope.data.savedRhythms[0]!.schedule).toBeUndefined();
    expect(result.envelope.data.savedRhythms[0]!.personal).toBeUndefined();
  });

  it('migrates v1 and v2 while preserving their supported data without inventing archive state', () => {
    const data = dataWithHistory();
    for (const version of [1, 2] as const) {
      const result = migratePreviewToProposedV4(rawAtVersion(data, version), currentDate);
      expect(result.valid).toBe(true);
      if (!result.valid) continue;
      expect(result.sourceSchemaVersion).toBe(version);
      expect(result.envelope.data.goals).toEqual(data.goals);
      expect(result.envelope.data.completedRhythmIds).toEqual(
        version === 1 ? ['sample-pray-together'] : data.completedRhythmIds
      );
      expect(result.envelope.data.archivedRhythmIds).toEqual([]);
      expect(result.envelope.data.savedRhythms).toHaveLength(version === 1 ? 0 : 1);
      if (version === 2) {
        expect(result.envelope.data.savedRhythms[0]!.cadence).toBe('3 times a week');
        expect(result.envelope.data.savedRhythms[0]!.schedule).toBeUndefined();
      }
    }
  });

  it('migrates v4 with empty dated history, without inferring timestamps', () => {
    const data = dataWithHistory();
    const result = migratePreviewToProposedV4(rawAtVersion(data, 4), currentDate);
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.sourceSchemaVersion).toBe(4);
    expect(result.envelope.schemaVersion).toBe(7);
    expect(result.envelope.data.datedRhythmCompletions).toEqual([]);
    expect(result.envelope.data.activeRhythmCompletions).toEqual([]);
    expect(result.envelope.data.completedRhythmIds).toEqual(data.completedRhythmIds);
  });

  it('rejects unknown fields and unsupported versions without converting or changing active bytes', () => {
    const validRaw = rawAtVersion(dataWithHistory(), 3);
    const value = JSON.parse(validRaw) as { data: Record<string, unknown> };
    value.data.unknownFutureValue = { preserve: true };
    const unknownRaw = JSON.stringify(value);
    const { storage, values } = storageFixture(unknownRaw);

    expect(migratePreviewToProposedV4(unknownRaw, currentDate)).toMatchObject({ valid: false, kind: 'invalid' });
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(unknownRaw);

    const futureRaw = JSON.stringify({
      format: 'tend.synthetic-preview',
      schemaVersion: 8,
      data: { unknownFutureValue: true }
    });
    const futureStorage = storageFixture(futureRaw);
    expect(migratePreviewToProposedV4(futureRaw, currentDate)).toMatchObject({ valid: false, kind: 'unsupported' });
    expect(proposedV4RecoveryKeyForRaw(futureRaw)).toBeNull();
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(unknownRaw);
    expect(storage.getItem(PREVIEW_STORAGE_KEY)).toBe(unknownRaw);
    expect(loadPreview(futureStorage.storage, currentDate)).toMatchObject({
      kind: 'unsupported',
      raw: futureRaw
    });
    expect(writePreview(futureStorage.storage, createSamplePreviewData(), null)).toEqual({
      kind: 'conflict',
      actualRaw: futureRaw
    });
    expect(preserveProposedV4SourceRecovery(futureStorage.storage, futureRaw)).toMatchObject({ kind: 'unsupported' });
    expect(futureStorage.values.get(PREVIEW_STORAGE_KEY)).toBe(futureRaw);
  });

  it('copies exact source bytes to the version-specific immutable recovery key without changing the active key', () => {
    const data = dataWithHistory();
    const expectedKeys = {
      1: 'tend2:synthetic-preview:v1-recovery',
      2: 'tend2:synthetic-preview:v2-recovery',
      3: PREVIEW_V3_RECOVERY_KEY,
      4: PREVIEW_V4_RECOVERY_KEY
    } as const;

    for (const version of [1, 2, 3, 4] as const) {
      const raw = ` \n${rawAtVersion(data, version)}\n`;
      const { storage, values } = storageFixture(raw);
      const result = preserveProposedV4SourceRecovery(storage, raw);
      expect(result).toEqual({ kind: 'preserved', key: expectedKeys[version], raw });
      expect(values.get(expectedKeys[version])).toBe(raw);
      expect(values.get(PREVIEW_STORAGE_KEY)).toBe(raw);
      expect([...values.keys()]).toEqual([PREVIEW_STORAGE_KEY, expectedKeys[version]]);
    }
  });

  it('preserves raw known-version bytes even when payload validation blocks migration', () => {
    const malformed = JSON.stringify({
      format: 'tend.synthetic-preview',
      schemaVersion: 3,
      data: { goals: [], completedRhythmIds: [], savedRhythms: [], archivedRhythmIds: [], unknown: ['keep'] }
    });
    const { storage, values } = storageFixture(malformed);
    expect(migratePreviewToProposedV4(malformed, currentDate).valid).toBe(false);
    expect(preserveProposedV4SourceRecovery(storage, malformed)).toEqual({
      kind: 'preserved',
      key: PREVIEW_V3_RECOVERY_KEY,
      raw: malformed
    });
    expect(values.get(PREVIEW_V3_RECOVERY_KEY)).toBe(malformed);
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(malformed);
  });

  it('blocks conflicting recovery bytes and stale active snapshots', () => {
    const raw = rawAtVersion(dataWithHistory(), 3);
    const occupied = storageFixture(raw);
    occupied.values.set(PREVIEW_V3_RECOVERY_KEY, '{"different":"original"}');
    expect(preserveProposedV4SourceRecovery(occupied.storage, raw)).toMatchObject({
      kind: 'conflict',
      key: PREVIEW_V3_RECOVERY_KEY
    });
    expect(occupied.values.get(PREVIEW_STORAGE_KEY)).toBe(raw);
    expect(occupied.values.get(PREVIEW_V3_RECOVERY_KEY)).toBe('{"different":"original"}');

    const stale = storageFixture('another-tab-value');
    expect(preserveProposedV4SourceRecovery(stale.storage, raw)).toEqual({
      kind: 'active-conflict',
      actualRaw: 'another-tab-value'
    });
    expect(stale.values.size).toBe(1);
  });

  it('uses schema v7 for active preview serialization', () => {
    expect(createPreviewEnvelope(dataWithHistory()).schemaVersion).toBe(7);
  });

  it('loads v4 backups with legacy day-of-month values 29–31 unchanged', () => {
    for (const day of [29, 30, 31]) {
      const data = dataWithHistory();
      data.savedRhythms[0]!.schedule = {
        frequency: 'monthly',
        pattern: { kind: 'dayOfMonth', day }
      };
      const loaded = parsePreviewBackup(JSON.stringify(createPreviewEnvelope(data)), currentDate);

      expect(loaded.valid).toBe(true);
      if (loaded.valid) {
        expect(loaded.envelope.data.savedRhythms[0]!.schedule).toEqual({
          frequency: 'monthly',
          pattern: { kind: 'dayOfMonth', day }
        });
      }
    }
  });

  it('loads v4 backups with legacy day-of-month values 29–31 unchanged', () => {
    for (const day of [29, 30, 31]) {
      const data = dataWithHistory();
      data.savedRhythms[0]!.schedule = {
        frequency: 'monthly',
        pattern: { kind: 'dayOfMonth', day }
      };
      const backup = JSON.stringify(createPreviewEnvelope(data));
      const loaded = parsePreviewBackup(backup, currentDate);

      expect(loaded.valid).toBe(true);
      if (loaded.valid) {
        expect(loaded.envelope.data.savedRhythms[0]!.schedule).toEqual({
          frequency: 'monthly',
          pattern: { kind: 'dayOfMonth', day }
        });
      }
    }
  });
});
