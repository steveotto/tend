import { describe, expect, it } from 'vitest';
import { saveCheckIn } from '../src/domain/money-goals.ts';
import { createPreviewEnvelope, createSamplePreviewData, parsePreviewBackup } from '../src/domain/preview-state.ts';
import { createValidatedPreviewAccountDocument } from '../src/storage/preview-account-backup.ts';

const currentDate = '2026-10-21';

function dataWithGoalLinks() {
  const data = createSamplePreviewData();
  const savings = data.goals[0]!;
  const corrected = saveCheckIn(savings, {
    effectiveDate: '2026-10-18',
    balance: '1300.00',
    note: 'Corrected snapshot'
  }, '2026-10-21T12:00:00.000Z', currentDate, savings.checkIns[1]).goal!;
  data.goals = [
    { ...corrected, supportingRhythmIds: ['archived-rhythm-id', 'missing-rhythm-id'] },
    { ...data.goals[1]!, supportingRhythmIds: ['disabled-finances-rhythm-id'] }
  ];
  return data;
}

describe('goal Rhythm-link serialization', () => {
  it('migrates schema v43 goals without links to v44 without disturbing balances or history', () => {
    const envelope = JSON.parse(JSON.stringify(createPreviewEnvelope(createSamplePreviewData()))) as {
      schemaVersion: number;
      data: { goals: Array<Record<string, unknown>> };
    };
    envelope.schemaVersion = 43;
    for (const goal of envelope.data.goals) delete goal.supportingRhythmIds;

    const migrated = parsePreviewBackup(JSON.stringify(envelope), currentDate);
    expect(migrated).toMatchObject({
      valid: true,
      sourceSchemaVersion: 43,
      envelope: { schemaVersion: 44 }
    });
    if (!migrated.valid) return;
    expect(migrated.envelope.data.goals.map(goal => goal.supportingRhythmIds ?? [])).toEqual([[], []]);
    expect(migrated.envelope.data.goals.map(goal => goal.checkIns)).toEqual(
      createSamplePreviewData().goals.map(goal => goal.checkIns)
    );
  });

  it('preserves archived, unavailable, and disabled-category IDs through backup and account-transfer serialization', () => {
    const data = dataWithGoalLinks();
    const envelope = createPreviewEnvelope(data);
    const imported = parsePreviewBackup(JSON.stringify(envelope), currentDate);
    expect(imported.valid).toBe(true);
    if (!imported.valid) return;
    expect(imported.envelope.data.goals.map(goal => goal.supportingRhythmIds)).toEqual([
      ['archived-rhythm-id', 'missing-rhythm-id'],
      ['disabled-finances-rhythm-id']
    ]);
    expect(imported.envelope.data.goals[0]?.checkIns).toEqual(data.goals[0]?.checkIns);
    expect(imported.envelope.data.goals[0]?.correctionHistory).toEqual(data.goals[0]?.correctionHistory);

    const accountDocument = createValidatedPreviewAccountDocument(data, currentDate);
    expect(accountDocument.data.goals.map(goal => goal.supportingRhythmIds)).toEqual([
      ['archived-rhythm-id', 'missing-rhythm-id'],
      ['disabled-finances-rhythm-id']
    ]);
    expect(accountDocument.data.goals[0]?.checkIns).toEqual(data.goals[0]?.checkIns);
    expect(accountDocument.data.goals[0]?.correctionHistory).toEqual(data.goals[0]?.correctionHistory);
  });

  it('rejects malformed or duplicate stable Rhythm IDs without normalizing them', () => {
    const envelope = JSON.parse(JSON.stringify(createPreviewEnvelope(dataWithGoalLinks()))) as {
      data: { goals: Array<Record<string, unknown>> };
    };
    envelope.data.goals[0]!.supportingRhythmIds = ['duplicate-id', 'duplicate-id'];

    expect(parsePreviewBackup(JSON.stringify(envelope), currentDate)).toMatchObject({
      valid: false,
      kind: 'invalid'
    });
  });
});
