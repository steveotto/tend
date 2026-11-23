import { describe, expect, it } from 'vitest';
import { createSamplePreviewData } from '../src/domain/preview-state.ts';
import {
  PREVIEW_SCHEMA_VERSION,
  createPreviewEnvelope,
  parsePreviewBackup
} from '../src/domain/preview-state.ts';
import {
  PREVIEW_V51_RECOVERY_KEY,
  preserveProposedV4SourceRecovery
} from '../src/storage/preview-v4-recovery.ts';
import { PREVIEW_STORAGE_KEY } from '../src/storage/preview-storage.ts';
import type { PreviewStorage } from '../src/storage/preview-storage.ts';
import { withPreSparkSchema } from './legacy-preview-fixtures.ts';

const today = '2026-10-22';

describe('Cardio estimate preview migration', () => {
  it('snapshots historical run weights and keeps the exact v51 envelope recoverable', () => {
    const data = createSamplePreviewData();
    data.weight.weighIns = [
      { id: 'weight-before-run', date: '2026-10-19', weightKg: 70 },
      { id: 'weight-after-run', date: '2026-10-21', weightKg: 73 }
    ];
    data.cardio.runs = [
      { id: 'legacy-run', date: '2026-10-20', distance: 5 },
      { id: 'run-before-weight', date: '2026-10-18', distance: 3 }
    ];
    const current = createPreviewEnvelope(data);
    const raw = JSON.stringify(withPreSparkSchema({
      ...current,
      schemaVersion: 51,
      data: {
        ...data,
        cardio: {
          ...data.cardio,
          runs: [
            { id: 'legacy-run', date: '2026-10-20', distance: 5 },
            { id: 'run-before-weight', date: '2026-10-18', distance: 3 }
          ]
        }
      }
    }, 51));

    const migrated = parsePreviewBackup(raw, today);

    expect(migrated, migrated.valid ? undefined : migrated.message).toMatchObject({ valid: true });
    if (!migrated.valid) return;
    expect(migrated.sourceSchemaVersion).toBe(51);
    expect(migrated.envelope.schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
    expect(migrated.envelope.data.cardio.runs).toEqual([
      expect.objectContaining({
        id: 'legacy-run',
        calorieEstimate: {
          source: 'estimated',
          method: 'distance-weight-v1',
          weightKg: 70,
          weightSource: 'weigh-in',
          weightDate: '2026-10-19',
          weightMeasurementId: 'weight-before-run'
        }
      }),
      { id: 'run-before-weight', date: '2026-10-18', distance: 3 }
    ]);

    const values = new Map<string, string>([[PREVIEW_STORAGE_KEY, raw]]);
    const storage: PreviewStorage = {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); }
    };
    expect(preserveProposedV4SourceRecovery(storage, raw)).toEqual({
      kind: 'preserved',
      key: PREVIEW_V51_RECOVERY_KEY,
      raw
    });
    expect(values.get(PREVIEW_V51_RECOVERY_KEY)).toBe(raw);
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(raw);
  });
});
