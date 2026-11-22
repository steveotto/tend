import { describe, expect, it } from 'vitest';
import { createFlexibilityData } from '../src/domain/flexibility.ts';
import type { FlexibilityData, FlexibilitySession } from '../src/domain/flexibility.ts';
import {
  saveFlexibilityDataCommand,
  selectFlexibilityStretchRhythmOptions
} from '../src/domain/flexibility-rhythm-linking.ts';
import type { FlexibilityCompletionState } from '../src/domain/flexibility-rhythm-linking.ts';
import { todayRhythms } from '../src/domain/preview-data.ts';
import type { RhythmPreview } from '../src/domain/preview-data.ts';
import { createPreviewEnvelope, createSamplePreviewData, parsePreviewBackup } from '../src/domain/preview-state.ts';
import type { SavedRhythm } from '../src/domain/rhythm-editor.ts';
import type { DatedRhythmCompletion } from '../src/domain/rhythm-completion.ts';
import { createValidatedPreviewAccountDocument } from '../src/storage/preview-account-backup.ts';
import { withPreSparkSchema } from './legacy-preview-fixtures.ts';

const today = '2026-10-23';
const rhythmId = 'user-rhythm-11111111-1111-4111-8111-111111111113';
const completionId = 'flexibility-completion-session-1';

function rhythm(overrides: Partial<RhythmPreview> = {}): RhythmPreview {
  const { scoring: _scoring, completionHistory: _history, ...base } = todayRhythms[0]!;
  return {
    ...base,
    id: rhythmId,
    title: 'Stretch Rhythm',
    categoryIds: ['health'],
    primaryFoundationId: 'health-flexibility',
    secondaryFoundationIds: [],
    healthLogCapability: 'flexibility',
    schedule: { frequency: 'daily' },
    ...overrides
  };
}

function linkedSession(overrides: Partial<FlexibilitySession> = {}): FlexibilitySession {
  return {
    id: 'stretch-session-1',
    date: today,
    regionIds: ['hamstrings'],
    linkedRhythmId: rhythmId,
    rhythmOccurrence: today,
    completionId,
    ...overrides
  };
}

function emptyCompletionState(): FlexibilityCompletionState {
  return {
    datedRhythmCompletions: [],
    activeRhythmCompletions: [],
    completedRhythmIds: [],
    rhythmHistoryIds: []
  };
}

function save(
  previous: FlexibilityData,
  next: FlexibilityData,
  completionState = emptyCompletionState(),
  options: { rhythms?: readonly RhythmPreview[]; now?: Date } = {}
) {
  return saveFlexibilityDataCommand({
    previous,
    next,
    today,
    now: options.now ?? new Date(`${today}T12:30:00.000Z`),
    rhythms: options.rhythms ?? [rhythm()],
    archivedRhythmIds: new Set(),
    editableRhythmIds: new Set([rhythmId]),
    completionState
  });
}

function savedRhythmForFlexibility(): SavedRhythm {
  return {
    id: rhythmId,
    title: 'Stretch Rhythm',
    cadence: 'Daily',
    timeLabel: 'Anytime',
    timeOfDay: 'anytime',
    personIds: [],
    categoryIds: ['health'],
    primaryFoundationId: 'health-flexibility',
    secondaryFoundationIds: [],
    healthLogCapability: 'flexibility',
    schedule: { frequency: 'daily' }
  };
}

function completion(overrides: Partial<DatedRhythmCompletion> = {}): DatedRhythmCompletion {
  return {
    id: completionId,
    rhythmId,
    effectiveDate: today,
    localTime: '12:00',
    timeZone: 'UTC',
    completedAt: `${today}T12:00:00.000Z`,
    recordedAt: `${today}T12:00:00.000Z`,
    ...overrides
  };
}

describe('Flexibility manual-log Rhythm associations', () => {
  it('offers only eligible Health Flexibility Rhythms and detects existing completions', () => {
    const linked = rhythm();
    const otherMeasure = rhythm({
      id: 'cardio-rhythm',
      title: 'Cardio Rhythm',
      healthLogCapability: 'cardio'
    });
    const eligible = selectFlexibilityStretchRhythmOptions(
      [linked, otherMeasure],
      [],
      [],
      today
    );
    expect(eligible).toHaveLength(1);
    expect(eligible[0]).toMatchObject({ rhythm: linked, eligible: true });

    expect(selectFlexibilityStretchRhythmOptions(
      [linked],
      [],
      [completion()],
      today
    )[0]).toMatchObject({
      eligible: false,
      reason: 'A completion already exists for this Rhythm in this scheduled period.'
    });
  });

  it('creates a linked completion atomically, moves its date on edit, and removes it on unlink or delete', () => {
    const previous = createFlexibilityData();
    const next = { ...createFlexibilityData(), sessions: [linkedSession()] };
    const created = save(previous, next);
    expect(created.valid).toBe(true);
    if (!created.valid) return;
    expect(created.flexibility.sessions[0]).toEqual(linkedSession());
    expect(created.completionState.datedRhythmCompletions).toHaveLength(1);
    expect(created.completionState.datedRhythmCompletions[0]).toMatchObject({
      id: completionId,
      rhythmId,
      effectiveDate: today
    });
    expect(created.completionState.activeRhythmCompletions).toEqual([
      { rhythmId, completionId }
    ]);

    const movedSession = linkedSession({
      date: '2026-10-22',
      rhythmOccurrence: '2026-10-22'
    });
    const moved = save(
      created.flexibility,
      { ...created.flexibility, sessions: [movedSession] },
      created.completionState
    );
    expect(moved.valid).toBe(true);
    if (!moved.valid) return;
    expect(moved.completionState.datedRhythmCompletions).toHaveLength(1);
    expect(moved.completionState.datedRhythmCompletions[0]).toMatchObject({
      id: completionId,
      effectiveDate: '2026-10-22',
      recordedAt: created.completionState.datedRhythmCompletions[0]?.recordedAt
    });

    const unlinkedSession = { ...movedSession };
    delete unlinkedSession.linkedRhythmId;
    delete unlinkedSession.rhythmOccurrence;
    delete unlinkedSession.completionId;
    const unlinked = save(
      moved.flexibility,
      { ...moved.flexibility, sessions: [unlinkedSession] },
      moved.completionState
    );
    expect(unlinked.valid).toBe(true);
    if (!unlinked.valid) return;
    expect(unlinked.completionState.datedRhythmCompletions).toHaveLength(0);

    const deleted = save(moved.flexibility, { ...moved.flexibility, sessions: [] }, moved.completionState);
    expect(deleted.valid).toBe(true);
    if (deleted.valid) expect(deleted.completionState.datedRhythmCompletions).toHaveLength(0);
  });

  it('fails closed for duplicate occurrences and missing or foreign completion references', () => {
    const previous = createFlexibilityData();
    const withDuplicate = save(
      previous,
      { ...previous, sessions: [linkedSession()] },
      { ...emptyCompletionState(), datedRhythmCompletions: [completion({ id: 'other-completion' })] }
    );
    expect(withDuplicate).toMatchObject({
      valid: false,
      error: 'This Flexibility Rhythm occurrence already has completion credit. No changes were saved.'
    });

    const linked = { ...createFlexibilityData(), sessions: [linkedSession()] };
    const missingOwned = save(linked, { ...linked, sessions: [] });
    expect(missingOwned).toMatchObject({
      valid: false,
      error: 'The linked stretch completion is missing or no longer belongs to this session. No Flexibility changes were saved.'
    });

    const foreign = save(previous, {
      ...previous,
      sessions: [linkedSession({ completionId: 'foreign-completion' })]
    }, {
      ...emptyCompletionState(),
      datedRhythmCompletions: [completion({ id: 'foreign-completion' })]
    });
    expect(foreign).toMatchObject({
      valid: false,
      error: 'This stretch session references a completion owned by another activity. No Flexibility changes were saved.'
    });
  });

  it('keeps old v45 sessions unlinked and round-trips new linked records through backup import', () => {
    const oldData = createSamplePreviewData();
    oldData.flexibility.sessions = [{
      id: 'legacy-manual-stretch',
      date: today,
      regionIds: ['calves'],
      notes: 'Existing manual log'
    }];
    const legacyEnvelope = withPreSparkSchema(
      JSON.parse(JSON.stringify(createPreviewEnvelope(oldData))) as ReturnType<typeof createPreviewEnvelope>,
      45
    );
    const migrated = parsePreviewBackup(JSON.stringify(legacyEnvelope), today);
    expect(migrated.valid).toBe(true);
    if (!migrated.valid) return;
    expect(migrated.sourceSchemaVersion).toBe(45);
    expect(migrated.envelope.data.flexibility.sessions).toEqual(oldData.flexibility.sessions);
    expect(migrated.envelope.data.datedRhythmCompletions).toEqual(oldData.datedRhythmCompletions);

    const next = { ...createFlexibilityData(), sessions: [linkedSession()] };
    const linked = save(createFlexibilityData(), next);
    expect(linked.valid).toBe(true);
    if (!linked.valid) return;
    const currentData = createSamplePreviewData();
    currentData.savedRhythms = [savedRhythmForFlexibility()];
    currentData.flexibility = {
      ...oldData.flexibility,
      sessions: [...oldData.flexibility.sessions, ...linked.flexibility.sessions]
    };
    currentData.datedRhythmCompletions = linked.completionState.datedRhythmCompletions;
    currentData.activeRhythmCompletions = linked.completionState.activeRhythmCompletions;
    currentData.completedRhythmIds = linked.completionState.completedRhythmIds;
    currentData.rhythmHistoryIds = linked.completionState.rhythmHistoryIds;

    const accountDocument = createValidatedPreviewAccountDocument(currentData, today);
    const imported = parsePreviewBackup(JSON.stringify(accountDocument), today);
    expect(imported, JSON.stringify(imported)).toMatchObject({ valid: true });
    if (!imported.valid) return;
    expect(imported.envelope.data.flexibility.sessions).toEqual(currentData.flexibility.sessions);
    expect(imported.envelope.data.datedRhythmCompletions).toEqual(currentData.datedRhythmCompletions);
    expect(imported.envelope.data.activeRhythmCompletions).toEqual(currentData.activeRhythmCompletions);

    const brokenData = {
      ...currentData,
      datedRhythmCompletions: [],
      activeRhythmCompletions: [],
      completedRhythmIds: []
    };
    expect(parsePreviewBackup(JSON.stringify(createPreviewEnvelope(brokenData)), today)).toMatchObject({
      valid: false,
      diagnostic: {
        code: 'preview.flexibility.completion-link.invalid',
        flexibilityCompletionLinks: { missingCompletion: 1, invalid: 1 }
      }
    });
  });
});
