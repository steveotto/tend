import { describe, expect, it } from 'vitest';
import { createPreviewEnvelope, createSamplePreviewData, parsePreviewBackup, PREVIEW_SCHEMA_VERSION } from '../src/domain/preview-state.ts';
import type { PreviewData } from '../src/domain/preview-state.ts';
import { migratePreviewToProposedV4, PROPOSED_PREVIEW_SCHEMA_VERSION } from '../src/domain/preview-v4-migration.ts';
import { loadPreview, PREVIEW_STORAGE_KEY, writePreview } from '../src/storage/preview-storage.ts';
import {
  PREVIEW_V3_RECOVERY_KEY,
  preserveProposedV4SourceRecovery,
  proposedV4RecoveryKeyForRaw
} from '../src/storage/preview-v4-recovery.ts';
import { PREVIEW_V4_RECOVERY_KEY } from '../src/storage/preview-v4-recovery.ts';
import { PREVIEW_V21_RECOVERY_KEY } from '../src/storage/preview-v4-recovery.ts';
import { PREVIEW_V22_RECOVERY_KEY } from '../src/storage/preview-v4-recovery.ts';
import { PREVIEW_V23_RECOVERY_KEY } from '../src/storage/preview-v4-recovery.ts';
import { PREVIEW_V24_RECOVERY_KEY } from '../src/storage/preview-v4-recovery.ts';
import { PREVIEW_V25_RECOVERY_KEY } from '../src/storage/preview-v4-recovery.ts';
import {
  clearStrengthGuidedSessionDraft,
  confirmStrengthSessionDuration,
  confirmStrengthSessionSet,
  createStrengthGuidedSession,
  createStrengthWorkoutSuggestionExercises,
  createStrengthWorkoutSuggestionSupersetGroups,
  finishStrengthGuidedSession,
  strengthWorkoutSuggestions,
  validateStrengthData,
  validateStrengthGuidedSessionDraft
} from '../src/domain/strength.ts';
import type { StrengthData, StrengthSavedWorkout } from '../src/domain/strength.ts';

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

function strengthAtV24(data: StrengthData): StrengthData {
  const legacy = structuredClone(data);
  for (const workout of legacy.savedWorkouts) {
    delete workout.supersetGroups;
    for (const exercise of workout.exercises ?? []) {
      for (const set of exercise.sets) delete set.measurement;
    }
  }
  for (const log of legacy.workouts) {
    delete log.supersetGroups;
    for (const exercise of log.exercises ?? []) {
      for (const set of exercise.sets) delete set.measurement;
    }
  }
  if (legacy.guidedSessionDraft) {
    delete legacy.guidedSessionDraft.supersetGroups;
    delete legacy.guidedSessionDraft.exerciseTimer;
    for (const exercise of legacy.guidedSessionDraft.exercises) {
      for (const set of exercise.sets) delete set.measurement;
    }
  }
  return legacy;
}

describe('v4 migration and recovery domain', () => {
  it('round-trips completed superset and timed-set history through the current backup envelope', () => {
    const data = createSamplePreviewData();
    const powerSuggestion = strengthWorkoutSuggestions.find(item => item.sourceId === 'strength.power-abs')!;
    const powerExercises = createStrengthWorkoutSuggestionExercises(powerSuggestion, (() => {
      let id = 0;
      return () => `backup-power-${++id}`;
    })());
    const powerGroups = createStrengthWorkoutSuggestionSupersetGroups(
      powerSuggestion,
      powerExercises,
      () => 'backup-power-group'
    );
    const powerWorkout: StrengthSavedWorkout = {
      id: 'backup-power-template',
      name: powerSuggestion.name,
      muscleIds: ['abs'],
      sharedWith: [],
      exercises: powerExercises,
      supersetGroups: powerGroups
    };
    const powerSession = createStrengthGuidedSession(powerWorkout, {
      id: 'backup-power-session',
      date: currentDate,
      startedAt: '2026-10-22T09:00:00.000Z',
      timeZone: 'UTC'
    });
    expect(powerSession.valid).toBe(true);
    if (!powerSession.valid) return;
    const first = confirmStrengthSessionSet(
      powerSession.session, powerExercises[0]!.id, powerExercises[0]!.sets[0]!.id, 10, '2026-10-22T09:01:00.000Z'
    );
    expect(first.valid).toBe(true);
    if (!first.valid) return;
    const second = confirmStrengthSessionSet(
      first.session, powerExercises[1]!.id, powerExercises[1]!.sets[0]!.id, 10, '2026-10-22T09:02:00.000Z'
    );
    expect(second.valid).toBe(true);
    if (!second.valid) return;
    const powerLog = finishStrengthGuidedSession(
      second.session, 'backup-power-log', '2026-10-22T09:03:00.000Z'
    );
    expect(powerLog.valid).toBe(true);
    if (!powerLog.valid) return;

    const plankSuggestion = strengthWorkoutSuggestions.find(item => item.sourceId === 'strength.plank')!;
    const plankExercises = createStrengthWorkoutSuggestionExercises(plankSuggestion, (() => {
      let id = 0;
      return () => `backup-plank-${++id}`;
    })());
    const plankWorkout: StrengthSavedWorkout = {
      id: 'backup-plank-template',
      name: plankSuggestion.name,
      muscleIds: ['abs'],
      sharedWith: [],
      exercises: plankExercises,
      supersetGroups: []
    };
    const plankSession = createStrengthGuidedSession(plankWorkout, {
      id: 'backup-plank-session',
      date: currentDate,
      startedAt: '2026-10-22T10:00:00.000Z',
      timeZone: 'UTC'
    });
    expect(plankSession.valid).toBe(true);
    if (!plankSession.valid) return;
    const timedLogSession = confirmStrengthSessionDuration(
      plankSession.session,
      plankExercises[0]!.id,
      plankExercises[0]!.sets[0]!.id,
      40,
      '2026-10-22T10:01:00.000Z'
    );
    expect(timedLogSession.valid).toBe(true);
    if (!timedLogSession.valid) return;
    const plankLog = finishStrengthGuidedSession(
      timedLogSession.session, 'backup-plank-log', '2026-10-22T10:02:00.000Z'
    );
    expect(plankLog.valid).toBe(true);
    if (!plankLog.valid) return;

    data.strength.savedWorkouts = [powerWorkout, plankWorkout];
    data.strength.workouts = [powerLog.log, plankLog.log];
    const backup = JSON.stringify(createPreviewEnvelope(data));
    const restored = parsePreviewBackup(backup, currentDate);
    expect(restored.valid).toBe(true);
    if (!restored.valid) return;
    expect(restored.envelope.data.strength.workouts[0]?.supersetGroups).toEqual(powerGroups);
    expect(restored.envelope.data.strength.workouts[0]?.exercises?.map(item => item.sets[0]?.status))
      .toEqual(['performed', 'performed']);
    expect(restored.envelope.data.strength.workouts[1]?.exercises?.[0]?.sets[0]).toMatchObject({
      measurement: { kind: 'duration', targetDurationSeconds: 180 },
      status: 'performed',
      actualDurationSeconds: 40
    });
  });

  it('preserves exact v24 raw bytes at the version-specific recovery key', () => {
    const raw = ' \n{"format":"tend.synthetic-preview","schemaVersion":24,"data":{}}\n';
    const { storage, values } = storageFixture(raw);
    expect(proposedV4RecoveryKeyForRaw(raw)).toBe(PREVIEW_V24_RECOVERY_KEY);
    expect(preserveProposedV4SourceRecovery(storage, raw)).toEqual({
      kind: 'preserved',
      key: PREVIEW_V24_RECOVERY_KEY,
      raw
    });
    expect(values.get(PREVIEW_V24_RECOVERY_KEY)).toBe(raw);
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(raw);
  });

  it('migrates v25 rest preferences with exact recovery and preserves existing workout snapshots', () => {
    const data = createSamplePreviewData();
    data.strength.savedWorkouts = [{
      id: 'existing-v25-plan',
      name: 'Existing plan',
      muscleIds: ['chest'],
      sharedWith: [],
      exercises: [{
        id: 'existing-v25-exercise',
        name: 'Bench Press',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        restDurationSeconds: 75,
        sets: [{ id: 'existing-v25-set', targetReps: 8 }]
      }]
    }];
    const active = createStrengthGuidedSession(data.strength.savedWorkouts[0]!, {
      id: 'existing-v25-session',
      date: currentDate,
      startedAt: '2026-10-22T09:00:00.000Z',
      timeZone: 'UTC'
    });
    expect(active.valid).toBe(true);
    if (!active.valid) return;
    data.strength.guidedSessionDraft = active.session;
    data.strength.workouts = [{
      id: 'existing-v25-history',
      date: currentDate,
      muscleIds: ['chest']
    }];
    const envelope = createPreviewEnvelope(data);
    const legacyStrength = structuredClone(envelope.data.strength);
    delete (legacyStrength.settings as Partial<StrengthData['settings']>).betweenSetRestSeconds;
    const { personDetails: _personDetails, ...v25Data } = envelope.data;
    const raw = JSON.stringify({
      ...envelope,
      schemaVersion: 25,
      data: { ...v25Data, strength: legacyStrength }
    });
    const parsed = parsePreviewBackup(raw, currentDate);
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;
    expect(parsed.sourceSchemaVersion).toBe(25);
    expect(parsed.envelope.data.strength.settings.betweenSetRestSeconds).toEqual({
      chest: 180, back: 180, quads: 180, hamstrings: 180,
      biceps: 120, triceps: 120, shoulders: 120, abs: 120, calves: 120
    });
    expect(parsed.envelope.data.strength.savedWorkouts[0]?.exercises?.[0]?.restDurationSeconds).toBe(75);
    expect(parsed.envelope.data.strength.guidedSessionDraft?.exercises[0]?.restDurationSeconds).toBe(75);
    expect(parsed.envelope.data.strength.guidedSessionDraft?.exercises[0]?.sets[0]?.status).toBe('pending');
    expect(parsed.envelope.data.strength.workouts[0]).toMatchObject(data.strength.workouts[0]!);

    const { storage, values } = storageFixture(raw);
    const loaded = loadPreview(storage, currentDate);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    expect(writePreview(storage, loaded.data, loaded.raw, { currentDate })).toMatchObject({ kind: 'saved' });
    expect(values.get(PREVIEW_V25_RECOVERY_KEY)).toBe(raw);
    const savedEnvelope = JSON.parse(values.get(PREVIEW_STORAGE_KEY)!) as ReturnType<typeof createPreviewEnvelope>;
    expect(savedEnvelope.schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
    expect(parsePreviewBackup(JSON.stringify(savedEnvelope), currentDate).valid).toBe(true);
  });

  it('migrates v24 Strength records to explicit reps/groups/timer without inventing performance', () => {
    const data = createSamplePreviewData();
    const workout: StrengthSavedWorkout = {
      id: 'v24-workout',
      name: 'Bench Press',
      muscleIds: ['chest'],
      sharedWith: [],
      exercises: [{
        id: 'v24-exercise',
        name: 'Bench Press',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        restDurationSeconds: 90,
        sets: [{ id: 'v24-set', targetReps: 8 }]
      }]
    };
    data.strength.savedWorkouts = [workout];
    const active = createStrengthGuidedSession(workout, {
      id: 'v24-active-session',
      date: currentDate,
      startedAt: '2026-10-22T09:00:00.000Z',
      timeZone: 'UTC'
    });
    expect(active.valid).toBe(true);
    if (!active.valid) return;
    data.strength.guidedSessionDraft = active.session;
    const legacyStrength = structuredClone(data.strength);
    delete legacyStrength.savedWorkouts[0]!.supersetGroups;
    for (const exercise of legacyStrength.savedWorkouts[0]!.exercises ?? []) {
      for (const set of exercise.sets) delete set.measurement;
    }
    const legacySession = legacyStrength.guidedSessionDraft!;
    delete legacySession.supersetGroups;
    delete legacySession.exerciseTimer;
    for (const exercise of legacySession.exercises) {
      for (const set of exercise.sets) delete set.measurement;
    }
    const envelope = createPreviewEnvelope(data);
    const { personDetails: _personDetails, ...v24Data } = envelope.data;
    const raw = JSON.stringify({
      ...envelope,
      schemaVersion: 24,
      data: { ...v24Data, strength: legacyStrength }
    });
    const migrated = parsePreviewBackup(raw, currentDate);
    expect(migrated.valid).toBe(true);
    if (!migrated.valid) return;
    expect(migrated.sourceSchemaVersion).toBe(24);
    expect(migrated.envelope.schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
    expect(migrated.envelope.data.strength.savedWorkouts[0]!.supersetGroups).toEqual([]);
    expect(migrated.envelope.data.strength.savedWorkouts[0]!.exercises?.[0]?.sets[0])
      .toMatchObject({ measurement: { kind: 'reps' }, targetReps: 8 });
    expect(migrated.envelope.data.strength.guidedSessionDraft).toMatchObject({
      supersetGroups: [],
      exerciseTimer: { status: 'idle', elapsedMilliseconds: 0 }
    });
    expect(migrated.envelope.data.strength.guidedSessionDraft?.exercises[0]?.sets[0])
      .toMatchObject({ status: 'pending', measurement: { kind: 'reps' } });
  });

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
    expect(result.envelope.schemaVersion).toBe(PROPOSED_PREVIEW_SCHEMA_VERSION);
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

    const currentWithUnknownField = createPreviewEnvelope(dataWithHistory());
    const currentUnknownRaw = JSON.stringify({
      ...currentWithUnknownField,
      data: { ...currentWithUnknownField.data, unknownFutureValue: true }
    });
    expect(migratePreviewToProposedV4(currentUnknownRaw, currentDate)).toMatchObject({
      valid: false, kind: 'invalid'
    });

    const futureRaw = JSON.stringify({
      format: 'tend.synthetic-preview',
      schemaVersion: PREVIEW_SCHEMA_VERSION + 1,
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

  it('assigns schema v15 an immutable recovery key before schema v21 writes', () => {
    const data = createSamplePreviewData();
    const {
      weight: _weight,
      cardio: _cardio,
      friendships: _friendships,
      peopleGroups: _peopleGroups,
      personDetails: _personDetails,
      ...dataBeforeWeight
    } = data;
    const savedRhythms = dataBeforeWeight.savedRhythms.map(({ healthLogCapability: _capability, ...rhythm }) => rhythm);
    const originalRaw = ` \n${JSON.stringify({
      format: 'tend.synthetic-preview',
      schemaVersion: 15,
      data: { ...dataBeforeWeight, savedRhythms }
    })}\n`;
    const { storage, values } = storageFixture(originalRaw);

    expect(proposedV4RecoveryKeyForRaw(originalRaw)).toBe('tend2:synthetic-preview:v15-recovery');
    expect(preserveProposedV4SourceRecovery(storage, originalRaw)).toEqual({
      kind: 'preserved',
      key: 'tend2:synthetic-preview:v15-recovery',
      raw: originalRaw
    });
    expect(values.get('tend2:synthetic-preview:v15-recovery')).toBe(originalRaw);
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    const saved = writePreview(storage, data, originalRaw, { currentDate });
    expect(saved.kind).toBe('saved');
    expect(values.get('tend2:synthetic-preview:v15-recovery')).toBe(originalRaw);
    expect(JSON.parse(values.get(PREVIEW_STORAGE_KEY)!).schemaVersion).toBe(PROPOSED_PREVIEW_SCHEMA_VERSION);
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

  it('uses schema v25 for active preview serialization', () => {
    expect(createPreviewEnvelope(dataWithHistory()).schemaVersion).toBe(PROPOSED_PREVIEW_SCHEMA_VERSION);
  });

  it('migrates schema v23 Strength settings before saving a fresh suggestion and preserves its exact source', () => {
    const data = createSamplePreviewData();
    const currentEnvelope = createPreviewEnvelope(data);
    const legacyEnvelope = JSON.parse(JSON.stringify(currentEnvelope)) as Record<string, unknown>;
    legacyEnvelope.schemaVersion = 23;
    delete (legacyEnvelope.data as Record<string, unknown>).personDetails;
    const legacyStrength = (legacyEnvelope.data as Record<string, unknown>).strength as Record<string, unknown>;
    const legacySettings = legacyStrength.settings as Record<string, unknown>;
    delete legacySettings.weightUnit;
    delete legacySettings.betweenSetRestSeconds;
    const legacyRaw = ` \n${JSON.stringify(legacyEnvelope)}\n`;

    const migrated = migratePreviewToProposedV4(legacyRaw, currentDate);
    expect(migrated).toMatchObject({ valid: true, sourceSchemaVersion: 23 });
    if (!migrated.valid) return;
    expect(migrated.envelope.schemaVersion).toBe(PROPOSED_PREVIEW_SCHEMA_VERSION);
    expect(migrated.envelope.data.strength.settings.weightUnit).toBe('lb');
    expect(migrated.envelope.data.strength.settings.betweenSetRestSeconds).toMatchObject({
      chest: 180, back: 180, quads: 180, hamstrings: 180,
      biceps: 120, triceps: 120, shoulders: 120, abs: 120, calves: 120
    });

    const suggestion = strengthWorkoutSuggestions.find(item => item.sourceId === 'strength.ab-roller');
    expect(suggestion).toBeDefined();
    if (!suggestion) return;
    let nextId = 0;
    const exercises = createStrengthWorkoutSuggestionExercises(
      suggestion,
      () => `v23-suggestion-${++nextId}`,
      migrated.envelope.data.strength.settings
    );
    const nextStrength: StrengthData = {
      ...migrated.envelope.data.strength,
      savedWorkouts: [...migrated.envelope.data.strength.savedWorkouts, {
        id: 'v23-ab-roller',
        name: suggestion.name,
        muscleIds: [...suggestion.muscleIds],
        sharedWith: [],
        suggestionSourceId: suggestion.sourceId,
        exercises,
        supersetGroups: []
      }]
    };
    expect(validateStrengthData(nextStrength, true, true, true)).toBe(true);

    const { storage, values } = storageFixture(legacyRaw);
    const written = writePreview(storage, {
      ...migrated.envelope.data,
      strength: nextStrength
    }, legacyRaw, { currentDate });
    expect(written.kind).toBe('saved');
    expect(values.get(PREVIEW_V23_RECOVERY_KEY)).toBe(legacyRaw);
    const loaded = loadPreview(storage, currentDate);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind === 'loaded') {
      expect(loaded.data.strength.settings.weightUnit).toBe('lb');
      expect(loaded.data.strength.savedWorkouts).toHaveLength(1);
      expect(loaded.data.strength.savedWorkouts[0]?.suggestionSourceId).toBe('strength.ab-roller');
    }
  });

  it('migrates schema v21 with exact recovery and retains its prior records', () => {
    const data = createSamplePreviewData();
    const template: StrengthSavedWorkout = {
      id: 'template-v22-session',
      name: 'Upper body',
      muscleIds: ['chest'],
      sharedWith: ['sample-person-avery'],
      exercises: [{
        id: 'exercise-v22-bench',
        name: 'Bench Press',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        restDurationSeconds: 90,
        sets: [{
          id: 'set-v22-bench',
          targetReps: 8,
          targetLoad: { kind: 'external' as const, meaning: 'total' as const, value: 135, unit: 'lb' as const }
        }]
      }]
    };
    data.strength.savedWorkouts = [template];
    const active = createStrengthGuidedSession(template, {
      id: 'session-v22-session',
      date: currentDate,
      startedAt: `${currentDate}T09:00:00.000Z`,
      timeZone: 'UTC'
    });
    expect(active.valid).toBe(true);
    if (!active.valid) return;
    data.strength.guidedSessionDraft = active.session;

    const backup = JSON.stringify(createPreviewEnvelope(data));
    const restored = parsePreviewBackup(backup, currentDate);
    expect(restored.valid).toBe(true);
    if (restored.valid) {
      expect(restored.envelope.data.strength.guidedSessionDraft).toEqual(active.session);
    }

    const strengthV21 = clearStrengthGuidedSessionDraft(data.strength);
    const v21Envelope = createPreviewEnvelope({ ...data, strength: strengthV21 });
    const { personDetails: _personDetails, ...v21Data } = v21Envelope.data;
    const v21Raw = ` \n${JSON.stringify({
      ...v21Envelope,
      schemaVersion: 21,
      data: { ...v21Data, strength: strengthAtV24(strengthV21) }
    })}\n`;
    const migrated = migratePreviewToProposedV4(v21Raw, currentDate);
    expect(migrated).toMatchObject({ valid: true, sourceSchemaVersion: 21 });
    if (!migrated.valid) return;
    expect(migrated.envelope.schemaVersion).toBe(PROPOSED_PREVIEW_SCHEMA_VERSION);
    expect(migrated.envelope.data.strength.guidedSessionDraft).toBeUndefined();
    const { storage, values } = storageFixture(v21Raw);
    const saved = writePreview(storage, migrated.envelope.data, v21Raw, { currentDate });
    expect(saved.kind).toBe('saved');
    expect(values.get(PREVIEW_V21_RECOVERY_KEY)).toBe(v21Raw);
    expect(JSON.parse(values.get(PREVIEW_STORAGE_KEY)!).schemaVersion).toBe(PROPOSED_PREVIEW_SCHEMA_VERSION);
  });

  it('preserves exact v22 raw recovery before saving a timer-ready current envelope', () => {
    const data = createSamplePreviewData();
    const template: StrengthSavedWorkout = {
      id: 'template-v23-session',
      name: 'Upper body',
      muscleIds: ['chest'],
      sharedWith: ['sample-person-avery'],
      exercises: [{
        id: 'exercise-v23-bench',
        name: 'Bench Press',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        restDurationSeconds: 180,
        sets: [{
          id: 'set-v23-bench',
          targetReps: 8,
          targetLoad: { kind: 'external' as const, meaning: 'total' as const, value: 135, unit: 'lb' as const }
        }]
      }]
    };
    data.strength.savedWorkouts = [template];
    const created = createStrengthGuidedSession(template, {
      id: 'session-v23-session',
      date: currentDate,
      startedAt: `${currentDate}T09:00:00.000Z`,
      timeZone: 'UTC'
    });
    expect(created.valid).toBe(true);
    if (!created.valid) return;
    const legacyDraft = { ...created.session };
    delete (legacyDraft as Partial<typeof legacyDraft>).restTimer;
    delete (legacyDraft as Partial<typeof legacyDraft>).autoStartRest;
    data.strength.guidedSessionDraft = legacyDraft;
    expect(validateStrengthGuidedSessionDraft(strengthAtV24(data.strength).guidedSessionDraft)).toBe(true);
    expect(validateStrengthData(strengthAtV24(data.strength), true)).toBe(true);

    const current = createPreviewEnvelope(data);
    const { personDetails: _personDetails, ...v22Data } = current.data;
    const v22Raw = ` \n${JSON.stringify({
      ...current,
      schemaVersion: 22,
      data: { ...v22Data, strength: strengthAtV24(data.strength) }
    })}\n`;
    const migrated = migratePreviewToProposedV4(v22Raw, currentDate);
    expect(migrated, migrated.valid ? undefined : migrated.message).toMatchObject({ valid: true, sourceSchemaVersion: 22 });
    if (!migrated.valid) return;
    expect(migrated.envelope.schemaVersion).toBe(PROPOSED_PREVIEW_SCHEMA_VERSION);
    expect(migrated.envelope.data.strength.guidedSessionDraft).toMatchObject({
      ...legacyDraft,
      autoStartRest: false,
      restTimer: { status: 'idle', durationSeconds: 180 },
      supersetGroups: [],
      exerciseTimer: { status: 'idle', elapsedMilliseconds: 0 }
    });

    const { storage, values } = storageFixture(v22Raw);
    const written = writePreview(storage, migrated.envelope.data, v22Raw, { currentDate });
    expect(written.kind).toBe('saved');
    expect(values.get(PREVIEW_V22_RECOVERY_KEY)).toBe(v22Raw);
    expect(JSON.parse(values.get(PREVIEW_STORAGE_KEY)!).schemaVersion).toBe(PROPOSED_PREVIEW_SCHEMA_VERSION);
    const loaded = loadPreview(storage, currentDate);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind === 'loaded') {
      expect(loaded.data.strength.guidedSessionDraft).toEqual(migrated.envelope.data.strength.guidedSessionDraft);
    }
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
