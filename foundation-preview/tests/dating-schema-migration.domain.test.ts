import { describe, expect, it } from 'vitest';
import {
  createPreviewEnvelope,
  createSamplePreviewData,
  parsePreviewBackup,
  PREVIEW_SCHEMA_VERSION,
  validatePreviewEnvelope
} from '../src/domain/preview-state.ts';
import { areas, foundationCatalogue } from '../src/domain/preview-data.ts';
import {
  loadPreview,
  PREVIEW_STORAGE_KEY,
  writePreview
} from '../src/storage/preview-storage.ts';
import {
  createValidatedPreviewAccountDocument,
  validatePreviewAccountBackup
} from '../src/storage/preview-account-backup.ts';
import { migratePreviewToProposedV4 } from '../src/domain/preview-v4-migration.ts';
import {
  PREVIEW_V53_RECOVERY_KEY,
  PREVIEW_V54_RECOVERY_KEY,
  proposedV4RecoveryKeyForRaw
} from '../src/storage/preview-v4-recovery.ts';
import { MemoryStorage } from './memory-storage.ts';

function preDatingEnvelopeV53() {
  const envelope = createPreviewEnvelope(createSamplePreviewData());
  const {
    dating: _dating,
    ...categoryPreferences
  } = envelope.data.categoryPreferences;
  const foundationPreferences = Object.fromEntries(
    Object.entries(envelope.data.foundationPreferences)
      .filter(([id]) => !foundationCatalogue.some(foundation =>
        foundation.categoryId === 'dating' && foundation.id === id
      ))
  );
  const peopleGroups = envelope.data.peopleGroups.filter(group => group.id !== 'dating');
  return {
    ...envelope,
    schemaVersion: 53,
    data: {
      ...envelope.data,
      categoryPreferences,
      foundationPreferences,
      peopleGroups
    }
  };
}

describe('Dating schema migration', () => {
  it('migrates schema v53 preferences and People groups while preserving exact recovery', () => {
    const storage = new MemoryStorage();
    const previous = preDatingEnvelopeV53();
    const raw = ` \n${JSON.stringify(previous)}\n`;
    storage.setItem(PREVIEW_STORAGE_KEY, raw);
    const accountBackup = validatePreviewAccountBackup({
      document: previous,
      schemaVersion: 53,
      revision: 1,
      updatedAt: null
    }, '2026-11-22');
    expect(accountBackup.data.categoryPreferences.dating).toBe(false);
    expect(migratePreviewToProposedV4(raw, '2026-11-22')).toMatchObject({
      valid: true,
      sourceSchemaVersion: 53,
      envelope: { data: { categoryPreferences: { dating: false } } }
    });

    const loaded = loadPreview(storage, '2026-11-22');
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    expect(loaded.data.categoryPreferences.dating).toBe(false);
    expect(loaded.data.foundationPreferences['dating-connection']).toBe(true);
    expect(loaded.data.peopleGroups.find(group => group.id === 'dating')?.memberIds).toEqual([]);
    expect(loaded.data.peopleGroups.filter(group => group.id !== 'dating'))
      .toEqual(previous.data.peopleGroups);

    const written = writePreview(storage, loaded.data, loaded.raw, {
      currentDate: '2026-11-22'
    });
    expect(written.kind).toBe('saved');
    expect(storage.getItem(PREVIEW_V53_RECOVERY_KEY)).toBe(raw);
    expect(parsePreviewBackup(storage.getItem(PREVIEW_STORAGE_KEY) ?? '', '2026-11-22')).toMatchObject({
      valid: true,
      sourceSchemaVersion: PREVIEW_SCHEMA_VERSION,
      envelope: {
        data: {
          categoryPreferences: { dating: false },
          peopleGroups: expect.arrayContaining([
            { id: 'dating', label: 'Dating partner', memberIds: [] }
          ])
        }
      }
    });
  });

  it('rejects incomplete current availability data and maps v54 sources to their immutable recovery key', () => {
    const envelope = createPreviewEnvelope(createSamplePreviewData());
    const missingDating = {
      ...envelope,
      data: {
        ...envelope.data,
        categoryPreferences: Object.fromEntries(
          Object.entries(envelope.data.categoryPreferences).filter(([id]) => id !== 'dating')
        )
      }
    };
    expect(validatePreviewEnvelope(missingDating, '2026-11-22')).toMatchObject({ valid: false });

    const rawV54 = JSON.stringify({ ...envelope, schemaVersion: 54 });
    expect(proposedV4RecoveryKeyForRaw(rawV54)).toBe(PREVIEW_V54_RECOVERY_KEY);
    expect(proposedV4RecoveryKeyForRaw(JSON.stringify(envelope))).toBeNull();
    expect(areas.some(area => area.id === 'dating')).toBe(true);
  });

  it('normalizes legacy dual enablement without changing data and enforces the rule on import and restore', () => {
    const current = createPreviewEnvelope(createSamplePreviewData());
    const dualEnabledV54 = {
      ...current,
      schemaVersion: 54,
      data: {
        ...current.data,
        categoryPreferences: {
          ...current.data.categoryPreferences,
          dating: true
        }
      }
    };
    const raw = ` \n${JSON.stringify(dualEnabledV54)}\n`;
    const currentDate = '2026-11-22';
    const parsed = parsePreviewBackup(raw, currentDate);

    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;
    expect(parsed.sourceSchemaVersion).toBe(54);
    expect(parsed.envelope.schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
    expect(parsed.envelope.data.categoryPreferences).toMatchObject({
      marriage: true,
      dating: false
    });
    expect(parsed.envelope.data.savedRhythms).toEqual(dualEnabledV54.data.savedRhythms);
    expect(parsed.envelope.data.people).toEqual(dualEnabledV54.data.people);
    expect(parsed.envelope.data.peopleGroups).toEqual(dualEnabledV54.data.peopleGroups);
    expect(parsed.envelope.data.foundationPreferences).toEqual(dualEnabledV54.data.foundationPreferences);
    expect(parsed.envelope.data.datedRhythmCompletions).toEqual(dualEnabledV54.data.datedRhythmCompletions);
    expect(parsed.envelope.data.friendships).toEqual(dualEnabledV54.data.friendships);

    const storage = new MemoryStorage();
    storage.setItem(PREVIEW_STORAGE_KEY, raw);
    const loaded = loadPreview(storage, currentDate);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    expect(loaded.data.categoryPreferences).toMatchObject({ marriage: true, dating: false });
    expect(storage.getItem(PREVIEW_STORAGE_KEY)).toBe(raw);
    expect(writePreview(storage, loaded.data, loaded.raw, { currentDate }).kind).toBe('saved');
    expect(storage.getItem(PREVIEW_V54_RECOVERY_KEY)).toBe(raw);

    const importStorage = new MemoryStorage();
    expect(writePreview(importStorage, parsed.envelope.data, null, {
      currentDate,
      operation: 'import',
      importSourceRaw: raw
    }).kind).toBe('saved');
    expect(parsePreviewBackup(importStorage.getItem(PREVIEW_STORAGE_KEY)!, currentDate))
      .toMatchObject({
        valid: true,
        envelope: { data: { categoryPreferences: { marriage: true, dating: false } } }
      });

    const restored = validatePreviewAccountBackup({
      document: dualEnabledV54,
      schemaVersion: 54,
      revision: 3,
      updatedAt: '2026-11-22T12:00:00.000Z'
    }, currentDate);
    expect(restored.data.categoryPreferences).toMatchObject({ marriage: true, dating: false });
    expect(createValidatedPreviewAccountDocument(restored.data, currentDate).schemaVersion)
      .toBe(PREVIEW_SCHEMA_VERSION);

    const datingOnlyV54 = {
      ...dualEnabledV54,
      data: {
        ...dualEnabledV54.data,
        categoryPreferences: {
          ...dualEnabledV54.data.categoryPreferences,
          marriage: false
        }
      }
    };
    const neitherV54 = {
      ...datingOnlyV54,
      data: {
        ...datingOnlyV54.data,
        categoryPreferences: {
          ...datingOnlyV54.data.categoryPreferences,
          dating: false
        }
      }
    };
    expect(parsePreviewBackup(JSON.stringify(datingOnlyV54), currentDate))
      .toMatchObject({
        valid: true,
        envelope: { data: { categoryPreferences: { marriage: false, dating: true } } }
      });
    expect(parsePreviewBackup(JSON.stringify(neitherV54), currentDate))
      .toMatchObject({
        valid: true,
        envelope: { data: { categoryPreferences: { marriage: false, dating: false } } }
      });

    const currentV55 = createPreviewEnvelope(createSamplePreviewData());
    const dualEnabledV55 = {
      ...currentV55,
      data: {
        ...currentV55.data,
        categoryPreferences: {
          ...currentV55.data.categoryPreferences,
          dating: true
        }
      }
    };
    expect(parsePreviewBackup(JSON.stringify(dualEnabledV55), currentDate).valid).toBe(false);
  });
});
