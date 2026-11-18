import { describe, expect, it } from 'vitest';
import { saveCheckIn, updateGoalSupportingRhythms } from '../src/domain/money-goals.ts';
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
  it('lets one eligible Rhythm support multiple goals without duplicate links within a goal', () => {
    const data = createSamplePreviewData();
    const rhythmId = 'shared-finance-rhythm';
    const eligibleRhythmIds = new Set([rhythmId]);
    const first = updateGoalSupportingRhythms(
      data.goals[0]!,
      [{ rhythmId, linked: true }],
      eligibleRhythmIds
    ).goal!;
    const second = updateGoalSupportingRhythms(
      data.goals[1]!,
      [{ rhythmId, linked: true }],
      eligibleRhythmIds
    ).goal!;
    const repeatedLink = updateGoalSupportingRhythms(
      first,
      [{ rhythmId, linked: true }],
      eligibleRhythmIds
    ).goal!;

    expect(first.supportingRhythmIds).toEqual([rhythmId]);
    expect(second.supportingRhythmIds).toEqual([rhythmId]);
    expect(repeatedLink.supportingRhythmIds).toEqual([rhythmId]);
  });

  it('migrates schema v43 goals without links to the current schema without disturbing balances or history', () => {
    const envelope = JSON.parse(JSON.stringify(createPreviewEnvelope(createSamplePreviewData()))) as {
      schemaVersion: number;
      data: { goals: Array<Record<string, unknown>> };
    };
    envelope.schemaVersion = 43;
    for (const goal of envelope.data.goals) {
      delete goal.supportingRhythmIds;
      delete goal.foundationId;
    }

    const migrated = parsePreviewBackup(JSON.stringify(envelope), currentDate);
    expect(migrated).toMatchObject({
      valid: true,
      sourceSchemaVersion: 43,
      envelope: { schemaVersion: 45 }
    });
    if (!migrated.valid) return;
    expect(migrated.envelope.data.goals.map(goal => goal.supportingRhythmIds ?? [])).toEqual([[], []]);
    expect(migrated.envelope.data.goals.map(goal => goal.foundationId)).toEqual([undefined, undefined]);
    expect(migrated.envelope.data.goals.map(goal => goal.checkIns)).toEqual(
      createSamplePreviewData().goals.map(goal => goal.checkIns)
    );
  });

  it('migrates v44 goals without inferring Foundation assignments and preserves unknown IDs', () => {
    const data = createSamplePreviewData();
    const envelope = JSON.parse(JSON.stringify(createPreviewEnvelope(data))) as {
      schemaVersion: number;
      data: { goals: Array<Record<string, unknown>> };
    };
    envelope.schemaVersion = 44;
    for (const goal of envelope.data.goals) delete goal.foundationId;
    envelope.data.goals[0]!.title = 'Emergency reserve';

    const migrated = parsePreviewBackup(JSON.stringify(envelope), currentDate);
    expect(migrated).toMatchObject({
      valid: true,
      sourceSchemaVersion: 44,
      envelope: { schemaVersion: 45 }
    });
    if (!migrated.valid) return;
    expect(migrated.envelope.data.goals[0]?.foundationId).toBeUndefined();
    expect(migrated.envelope.data.goals[1]?.foundationId).toBeUndefined();
    expect(migrated.envelope.data.goals[0]?.checkIns).toEqual(data.goals[0]?.checkIns);
    expect(migrated.envelope.data.goals[0]?.correctionHistory).toEqual(data.goals[0]?.correctionHistory);

    const accountDocument = createValidatedPreviewAccountDocument(migrated.envelope.data, currentDate);
    const imported = parsePreviewBackup(JSON.stringify(accountDocument), currentDate);
    expect(imported.valid).toBe(true);
    if (imported.valid) {
      expect(imported.envelope.data.goals[0]?.foundationId).toBeUndefined();
      expect(imported.envelope.data.goals[1]?.foundationId).toBeUndefined();
    }
  });

  it('preserves an unresolved Foundation ID in goal data across backup and account serialization', () => {
    const data = createSamplePreviewData();
    data.goals = data.goals.map((goal, index) => index === 0
      ? { ...goal, foundationId: 'unresolved-foundation' }
      : goal);
    const accountDocument = createValidatedPreviewAccountDocument(data, currentDate);
    const imported = parsePreviewBackup(JSON.stringify(accountDocument), currentDate);

    expect(imported.valid).toBe(true);
    if (imported.valid) {
      expect(imported.envelope.data.goals[0]?.foundationId).toBe('unresolved-foundation');
    }
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
