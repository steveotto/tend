import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  createStrengthData,
  defaultStrengthBetweenSetRestSeconds,
  createStrengthGuidedSession,
  createStrengthWorkoutSuggestionExercises,
  createStrengthWorkoutSuggestionSupersetGroups,
  addStrengthSessionSet,
  completeStrengthSessionRestTimer,
  createStrengthWorkout,
  confirmStrengthSessionSet,
  confirmStrengthSessionDuration,
  convertStrengthLoad,
  formatStrengthVolumeChangePercent,
  correctStrengthSessionSet,
  correctStrengthSessionDuration,
  hasPerformedStrengthSessionSet,
  moveStrengthSessionToSet,
  pauseStrengthSessionRestTimer,
  resetStrengthSessionRestTimer,
  resumeStrengthSessionRestTimer,
  deleteStrengthWorkout,
  deleteStrengthWorkoutLog,
  editStrengthWorkout,
  finishStrengthGuidedSession,
  rankStrengthWorkouts,
  resolveStrengthBetweenSetRestSeconds,
  saveStrengthWorkoutLog,
  selectStrengthWorkoutHistory,
  selectStrengthExerciseVolume,
  selectStrengthExerciseVolumeComparison,
  saveStrengthScoringSetup,
  selectStrengthConsistency,
  selectStrengthMuscleScores,
  selectPreviousStrengthSetValues,
  selectNextStrengthSessionSet,
  selectStrengthSessionExecutionOrder,
  selectStrengthExerciseTimerElapsedMilliseconds,
  selectStrengthScore,
  setStrengthSessionAutoStartRest,
  setStrengthGuidedSessionRestPreference,
  setStrengthSessionRestDuration,
  skipStrengthSessionSet,
  startStrengthSessionRestTimer,
  startStrengthExerciseTimer,
  pauseStrengthExerciseTimer,
  strengthMuscles,
  strengthWorkoutSuggestions,
  updateStrengthSavedWorkoutRestOverride,
  validateStrengthData,
  validateStrengthGuidedSessionDraft,
  validateStrengthSettings
} from '../src/domain/strength.ts';
import type {
  StrengthData,
  StrengthLoad,
  StrengthSavedWorkout,
  StrengthWorkoutExerciseSnapshot,
  StrengthWorkoutLog
} from '../src/domain/strength.ts';

const legacyScoringSource = readFileSync(resolve(process.cwd(), '../app-fitness-scoring.js'), 'utf8');
const legacyContext = runInNewContext(`${legacyScoringSource}; ({
  fitnessMuscleScores,
  fitnessRankSavedWorkouts
})`) as Record<string, unknown>;

function legacyResult(name: string, ...args: unknown[]): unknown {
  (legacyContext as { __args?: unknown[] }).__args = args;
  return JSON.parse(JSON.stringify(runInNewContext(`${name}.apply(null, __args)`, legacyContext)));
}

function syntheticData(): StrengthData {
  return createStrengthData();
}

function confirmedChestLog(date: string, id: string): StrengthWorkoutLog {
  return {
    id,
    date,
    muscleIds: ['chest'],
    exercises: [{
      id: `${id}-exercise`,
      name: 'Bench Press',
      muscleIds: ['chest'],
      equipment: 'Barbell',
      loadMeaning: 'total',
      restDurationSeconds: 60,
      sets: [{
        id: `${id}-set`,
        targetReps: 8,
        status: 'performed',
        actualReps: 8,
        confirmedAt: `${date}T12:00:00.000Z`
      }]
    }]
  };
}

function suggestedReps(set: { targetReps: number } | { targetDurationSeconds: number }): number | undefined {
  return 'targetReps' in set ? set.targetReps : undefined;
}

describe('Strength selector and command behavior', () => {
  it('keeps stable exercise and set order, explicit load meaning, and immutable history snapshots', () => {
    const template: StrengthSavedWorkout = {
      id: 'template-guided-1',
      name: 'Upper body',
      muscleIds: ['chest', 'triceps'],
      sharedWith: ['sample-person-avery'],
      exercises: [
        {
          id: 'exercise-bench-stable',
          name: 'Bench Press',
          muscleIds: ['chest'],
          equipment: 'Barbell',
          restDurationSeconds: 90,
          sets: [
            { id: 'bench-set-1', targetReps: 8, targetLoad: { kind: 'external', meaning: 'total', value: 135, unit: 'lb' } },
            { id: 'bench-set-2', targetReps: 8, targetLoad: { kind: 'external', meaning: 'total', value: 135, unit: 'lb' } }
          ]
        },
        {
          id: 'exercise-triceps-stable',
          name: 'Tricep Extensions',
          muscleIds: ['triceps'],
          equipment: 'Dumbbells',
          notes: 'Keep elbows steady.',
          restDurationSeconds: 60,
          sets: [
            { id: 'triceps-set-1', targetReps: 12, targetLoad: { kind: 'external', meaning: 'per-dumbbell', value: 40, unit: 'lb' } }
          ]
        }
      ]
    };
    const created = createStrengthWorkout([], template);
    expect(created.valid).toBe(true);
    if (!created.valid) return;
    expect(created.workouts[0]?.exercises?.map(exercise => [exercise.id, exercise.sets.map(set => set.id)])).toEqual([
      ['exercise-bench-stable', ['bench-set-1', 'bench-set-2']],
      ['exercise-triceps-stable', ['triceps-set-1']]
    ]);

    const started = createStrengthGuidedSession(template, {
      id: 'draft-session-1',
      date: '2026-10-22',
      startedAt: '2026-10-22T09:00:00.000Z',
      timeZone: 'UTC'
    });
    expect(started.valid).toBe(true);
    if (!started.valid) return;
    expect(started.session.exercises[0]?.sets.map(set => set.status)).toEqual(['pending', 'pending']);
    expect(started.session.exercises[0]?.sets[0]?.targetLoad).toEqual({
      kind: 'external', meaning: 'total', value: 135, unit: 'lb'
    });
    expect(started.session.exercises[1]?.sets[0]?.targetLoad).toEqual({
      kind: 'external', meaning: 'per-dumbbell', value: 40, unit: 'lb'
    });

    const performed = confirmStrengthSessionSet(
      started.session, 'exercise-bench-stable', 'bench-set-1', 8,
      '2026-10-22T09:05:00.000Z',
      { kind: 'external', meaning: 'total', value: 135, unit: 'lb' }
    );
    expect(performed.valid).toBe(true);
    if (!performed.valid) return;
    const skipped = skipStrengthSessionSet(performed.session, 'exercise-bench-stable', 'bench-set-2');
    expect(skipped.valid).toBe(true);
    if (!skipped.valid) return;
    const finished = finishStrengthGuidedSession(skipped.session, 'history-log-1', '2026-10-22T09:15:00.000Z');
    expect(finished.valid).toBe(true);
    if (!finished.valid) return;
    expect(finished.log.muscleIds).toEqual(['chest']);
    expect(finished.log.exercises?.[0]?.sets.map(set => set.status)).toEqual(['performed', 'skipped']);
    const finishedEarly = finishStrengthGuidedSession(
      started.session, 'empty-history-log', '2026-10-22T09:15:00.000Z'
    );
    expect(finishedEarly.valid && finishedEarly.log.muscleIds).toEqual([]);
    expect(finishedEarly.valid
      ? finishedEarly.log.exercises?.flatMap(exercise => exercise.sets.map(set => set.status)) ?? []
      : []).toEqual(['pending', 'pending', 'pending']);
    if (finishedEarly.valid) {
      const saved = saveStrengthWorkoutLog([], finishedEarly.log);
      expect(saved).toEqual({
        valid: false,
        error: 'Confirm at least one set before saving completed workout activity.'
      });
      expect(validateStrengthData({ ...createStrengthData(), workouts: [] })).toBe(true);
      expect(selectStrengthMuscleScores({ settings: createStrengthData().settings, workouts: [] }, '2026-10-22')
        .find(item => item.id === 'chest')?.historyState).toBe('never-trained');
    }

    const updatedTemplate = editStrengthWorkout(created.workouts, {
      ...template,
      name: 'Renamed plan',
      exercises: template.exercises!.map(exercise => ({
        ...exercise,
        name: `Edited ${exercise.name}`,
        sets: exercise.sets.map(set => ({ ...set, targetReps: 5 }))
      }))
    });
    expect(updatedTemplate.valid).toBe(true);
    expect(finished.log.workoutName).toBe('Upper body');
    expect(finished.log.exercises?.[0]).toMatchObject({
      id: 'exercise-bench-stable',
      name: 'Bench Press',
      sets: [
        { id: 'bench-set-1', targetReps: 8, actualReps: 8, actualLoad: { value: 135, unit: 'lb', kind: 'external', meaning: 'total' }, status: 'performed' },
        { id: 'bench-set-2', targetReps: 8, status: 'skipped' }
      ]
    });
  });

  describe('Strength session rest timer commands', () => {
    function session() {
      const created = createStrengthGuidedSession({
        id: 'timer-template',
        name: 'Timer workout',
        muscleIds: ['chest'],
        sharedWith: [],
        exercises: [
          {
            id: 'timer-bench',
            name: 'Bench Press',
            muscleIds: ['chest'],
            equipment: 'Barbell',
            restDurationSeconds: 180,
            sets: [{ id: 'timer-bench-set', targetReps: 8, targetLoad: { kind: 'external', meaning: 'total', value: 135, unit: 'lb' } }]
          },
          {
            id: 'timer-triceps',
            name: 'Tricep Extensions',
            muscleIds: ['triceps'],
            equipment: 'Dumbbells',
            restDurationSeconds: 120,
            sets: [{ id: 'timer-triceps-set', targetReps: 10, targetLoad: { kind: 'external', meaning: 'per-dumbbell', value: 40, unit: 'lb' } }]
          }
        ]
      }, {
        id: 'timer-session',
        date: '2026-10-30',
        startedAt: '2026-10-30T12:00:00.000Z',
        timeZone: 'UTC'
      });
      expect(created.valid).toBe(true);
      if (!created.valid) throw new Error(created.error);
      return created.session;
    }

    it('uses the exercise-specific duration and changes it only in the session', () => {
      const original = session();
      expect(original).toMatchObject({
        autoStartRest: true,
        restTimer: { status: 'idle', durationSeconds: 180 }
      });
      const changed = setStrengthSessionRestDuration(original, 150);
      expect(changed.valid).toBe(true);
      if (changed.valid) {
        expect(changed.session.restTimer).toEqual({ status: 'idle', durationSeconds: 150 });
        expect(original.exercises[0]!.restDurationSeconds).toBe(180);
      }
      expect(setStrengthSessionRestDuration(original, 0).valid).toBe(false);
      expect(setStrengthSessionRestDuration(original, 3601).valid).toBe(false);
    });

    it('starts against an absolute deadline and completes only once without altering set performance', () => {
      const original = session();
      const started = startStrengthSessionRestTimer(original, '2026-10-30T12:00:00.000Z');
      expect(started.valid).toBe(true);
      if (!started.valid) return;
      expect(started.session.restTimer).toEqual({
        status: 'running',
        durationSeconds: 180,
        deadlineAt: '2026-10-30T12:03:00.000Z'
      });
      expect(completeStrengthSessionRestTimer(started.session, '2026-10-30T12:02:59.999Z').valid).toBe(false);
      const complete = completeStrengthSessionRestTimer(started.session, '2026-10-30T12:03:00.000Z');
      expect(complete.valid).toBe(true);
      if (complete.valid) {
        expect(complete.session.restTimer).toEqual({ status: 'complete', durationSeconds: 180 });
        expect(complete.session.exercises).toEqual(original.exercises);
        expect(completeStrengthSessionRestTimer(complete.session, '2026-10-30T12:03:01.000Z').valid).toBe(false);
      }
    });

    it('preserves paused remaining duration and resets without creating activity', () => {
      const started = startStrengthSessionRestTimer(session(), '2026-10-30T12:00:00.000Z');
      expect(started.valid).toBe(true);
      if (!started.valid) return;
      const paused = pauseStrengthSessionRestTimer(started.session, '2026-10-30T12:00:30.250Z');
      expect(paused.valid).toBe(true);
      if (!paused.valid) return;
      expect(paused.session.restTimer).toEqual({
        status: 'paused',
        durationSeconds: 180,
        remainingMilliseconds: 149750
      });
      const resumed = resumeStrengthSessionRestTimer(paused.session, '2026-10-30T12:01:00.000Z');
      expect(resumed.valid).toBe(true);
      if (!resumed.valid) return;
      expect(resumed.session.restTimer).toEqual({
        status: 'running',
        durationSeconds: 180,
        deadlineAt: '2026-10-30T12:03:29.750Z'
      });
      const reset = resetStrengthSessionRestTimer(resumed.session);
      expect(reset.valid).toBe(true);
      if (reset.valid) {
        expect(reset.session.restTimer).toEqual({ status: 'idle', durationSeconds: 180 });
        expect(reset.session.exercises).toEqual(session().exercises);
      }
    });

    it('auto-starts on confirmation only, resets a running manual rest on another confirmation, and never starts on skip', () => {
      const original = session();
      const autoStart = setStrengthSessionAutoStartRest(original, true);
      expect(autoStart.valid).toBe(true);
      if (!autoStart.valid) return;
      const confirmed = confirmStrengthSessionSet(
        autoStart.session,
        'timer-bench',
        'timer-bench-set',
        8,
        '2026-10-30T12:00:05.000Z',
        { kind: 'external', meaning: 'total', value: 135, unit: 'lb' }
      );
      expect(confirmed.valid).toBe(true);
      if (confirmed.valid) {
        expect(confirmed.session.restTimer).toEqual({
          status: 'running',
          durationSeconds: 180,
          deadlineAt: '2026-10-30T12:03:05.000Z'
        });
        expect(confirmed.session.exercises[0]!.sets[0]!.status).toBe('performed');
      }

      const running = startStrengthSessionRestTimer(original, '2026-10-30T12:00:00.000Z');
      expect(running.valid).toBe(true);
      if (!running.valid) return;
      const continued = confirmStrengthSessionSet(
        running.session,
        'timer-bench',
        'timer-bench-set',
        8,
        '2026-10-30T12:00:10.000Z',
        { kind: 'external', meaning: 'total', value: 135, unit: 'lb' }
      );
      expect(continued.valid).toBe(true);
      if (continued.valid) {
        expect(continued.session.restTimer).toEqual({
          status: 'running',
          durationSeconds: 180,
          deadlineAt: '2026-10-30T12:03:10.000Z'
        });
      }

      const skipped = skipStrengthSessionSet(original, 'timer-bench', 'timer-bench-set');
      expect(skipped.valid).toBe(true);
      if (skipped.valid) expect(skipped.session.restTimer).toEqual(original.restTimer);
    });

    it('uses the next exercise rest default without restarting an active countdown', () => {
      const original = session();
      const started = startStrengthSessionRestTimer(original, '2026-10-30T12:00:00.000Z');
      expect(started.valid).toBe(true);
      if (!started.valid) return;
      const nextSet = started.session.exercises[1]!.sets[0]!.id;
      const advanced = moveStrengthSessionToSet(started.session, 1, nextSet);
      expect(advanced.valid).toBe(true);
      if (advanced.valid) {
        expect(advanced.session.restTimer).toEqual(started.session.restTimer);
      }
      const reset = resetStrengthSessionRestTimer(started.session);
      expect(reset.valid).toBe(true);
      if (!reset.valid) return;
      const advancedIdle = moveStrengthSessionToSet(reset.session, 1, nextSet);
      expect(advancedIdle.valid).toBe(true);
      if (advancedIdle.valid) {
        expect(advancedIdle.session.restTimer).toEqual({ status: 'idle', durationSeconds: 120 });
      }
    });
  });

  it('resumes stable exercise identities, copies only compatible previous values, and corrects without duplicate sets', () => {
    const template: StrengthSavedWorkout = {
      id: 'template-previous-values',
      name: 'Upper body',
      muscleIds: ['chest'],
      sharedWith: ['sample-person-avery'],
      exercises: [{
        id: 'exercise-stable-bench',
        name: 'Bench Press',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        restDurationSeconds: 90,
        sets: [
          { id: 'bench-target-1', targetReps: 10, targetLoad: { kind: 'external', meaning: 'total', value: 135, unit: 'lb' } },
          { id: 'bench-target-2', targetReps: 10, targetLoad: { kind: 'external', meaning: 'total', value: 155, unit: 'lb' } }
        ]
      }]
    };
    const started = createStrengthGuidedSession(template, {
      id: 'session-previous-values',
      date: '2026-10-22',
      startedAt: '2026-10-22T09:00:00.000Z',
      timeZone: 'UTC'
    });
    expect(started.valid).toBe(true);
    if (!started.valid) return;
    expect(started.session.sharedWith).toEqual(['sample-person-avery']);
    expect(started.session.currentSetId).toBe('bench-target-1');
    expect(hasPerformedStrengthSessionSet(started.session)).toBe(false);

    const previous: StrengthWorkoutLog = {
      id: 'previous-workout',
      date: '2026-10-20',
      savedWorkoutId: template.id,
      workoutName: 'Upper body',
      muscleIds: ['chest'],
      startedAt: '2026-10-20T08:00:00.000Z',
      finishedAt: '2026-10-20T08:30:00.000Z',
      timeZone: 'UTC',
      exercises: [{
        ...template.exercises![0]!,
        sets: [
          {
            id: 'bench-target-1',
            targetReps: 10,
            targetLoad: { kind: 'external', meaning: 'total', value: 120, unit: 'lb' },
            status: 'performed',
            actualReps: 8,
            actualLoad: { kind: 'external', meaning: 'total', value: 54.4310844, unit: 'kg' },
            confirmedAt: '2026-10-20T08:10:00.000Z'
          },
          { id: 'bench-target-2', targetReps: 10, targetLoad: { kind: 'external', meaning: 'total', value: 155, unit: 'lb' }, status: 'skipped' }
        ]
      }]
    };
    const firstPrevious = selectPreviousStrengthSetValues([previous], started.session, 'exercise-stable-bench', 0);
    expect(firstPrevious).toMatchObject({
      reps: 8,
      load: { kind: 'external', meaning: 'total', unit: 'lb' },
      loadMeaningMismatch: false
    });
    expect(firstPrevious?.load?.kind === 'external' && firstPrevious.load.value).toBeCloseTo(120, 8);
    expect(selectPreviousStrengthSetValues([previous], started.session, 'different-id-same-name', 0)).toBeNull();
    expect(selectPreviousStrengthSetValues([previous], started.session, 'exercise-stable-bench', 1)).toMatchObject({
      reps: 10,
      load: { value: 155, unit: 'lb' },
      loadMeaningMismatch: false
    });
    const untargetedSession = structuredClone(started.session);
    const untargetedExercise = untargetedSession.exercises[0]!;
    untargetedExercise.loadMeaning = 'total';
    for (const set of untargetedExercise.sets) delete set.targetLoad;
    expect(selectPreviousStrengthSetValues(
      [previous], untargetedSession, 'exercise-stable-bench', 0
    )).toMatchObject({
      reps: 8,
      load: { kind: 'external', meaning: 'total' },
      loadMeaningMismatch: false
    });
    const unknownMeaningSession = structuredClone(untargetedSession);
    delete unknownMeaningSession.exercises[0]!.loadMeaning;
    expect(selectPreviousStrengthSetValues(
      [previous], unknownMeaningSession, 'exercise-stable-bench', 0
    )).toMatchObject({ loadMeaningMismatch: true });

    const mismatch = {
      ...previous,
      id: 'previous-mismatch',
      exercises: [{
        ...previous.exercises![0]!,
        sets: [{
          ...previous.exercises![0]!.sets[0]!,
          actualLoad: { kind: 'external' as const, meaning: 'per-side' as const, value: 25, unit: 'lb' as const }
        }]
      }]
    };
    const meaningMismatch = selectPreviousStrengthSetValues(
      [mismatch], started.session, 'exercise-stable-bench', 0
    );
    expect(meaningMismatch).toMatchObject({ reps: 8, loadMeaningMismatch: true });
    expect(meaningMismatch?.load).toBeUndefined();

    const confirmed = confirmStrengthSessionSet(
      started.session, 'exercise-stable-bench', 'bench-target-1', 9,
      '2026-10-22T09:05:00.000Z',
      { kind: 'external', meaning: 'total', value: 140, unit: 'lb' }
    );
    expect(confirmed.valid).toBe(true);
    if (!confirmed.valid) return;
    expect(hasPerformedStrengthSessionSet(confirmed.session)).toBe(true);
    const corrected = correctStrengthSessionSet(
      confirmed.session, 'exercise-stable-bench', 'bench-target-1', 8,
      { kind: 'external', meaning: 'total', value: 140, unit: 'lb' }
    );
    expect(corrected.valid).toBe(true);
    if (!corrected.valid) return;
    expect(corrected.session.exercises[0]?.sets).toHaveLength(2);
    expect(corrected.session.exercises[0]?.sets[0]).toMatchObject({
      status: 'performed', actualReps: 8, confirmedAt: '2026-10-22T09:05:00.000Z'
    });
    const extra = addStrengthSessionSet(corrected.session, 'exercise-stable-bench', {
      id: 'bench-extra-1', targetReps: 6,
      targetLoad: { kind: 'external', meaning: 'total', value: 165, unit: 'lb' }
    });
    expect(extra.valid).toBe(true);
    if (extra.valid) {
      expect(extra.session.exercises[0]?.sets.map(set => set.id)).toEqual([
        'bench-target-1', 'bench-target-2', 'bench-extra-1'
      ]);
      expect(extra.session.exercises[0]?.sets[2]?.status).toBe('pending');
    }
  });

  it('converts only external Strength loads and keeps units and load meaning independent of preferences', () => {
    const bench: StrengthLoad = { kind: 'external', meaning: 'total', value: 135, unit: 'lb' };
    const dumbbell: StrengthLoad = { kind: 'external', meaning: 'per-dumbbell', value: 40, unit: 'lb' };
    const perSide: StrengthLoad = { kind: 'external', meaning: 'per-side', value: 20, unit: 'kg' };
    expect(convertStrengthLoad(bench, 'kg')).toEqual({
      kind: 'external', meaning: 'total', value: 61.23496995, unit: 'kg'
    });
    const dumbbellKg = convertStrengthLoad(dumbbell, 'kg');
    expect(dumbbellKg).toMatchObject({ kind: 'external', meaning: 'per-dumbbell', unit: 'kg' });
    expect(dumbbellKg.kind === 'external' && dumbbellKg.value).toBeCloseTo(18.1436948, 12);
    const perSideLb = convertStrengthLoad(perSide, 'lb');
    expect(perSideLb).toMatchObject({ kind: 'external', meaning: 'per-side', unit: 'lb' });
    expect(perSideLb.kind === 'external' && perSideLb.value).toBeCloseTo(44.092452437, 10);
    expect(convertStrengthLoad({ kind: 'bodyweight' }, 'kg')).toEqual({ kind: 'bodyweight' });
    expect(convertStrengthLoad(bench, 'lb')).toEqual(bench);

    const data = createStrengthData();
    data.workouts = [{
      id: 'converted-log',
      date: '2026-10-22',
      muscleIds: ['chest'],
      startedAt: '2026-10-22T09:00:00.000Z',
      finishedAt: '2026-10-22T09:30:00.000Z',
      timeZone: 'UTC',
      exercises: [{
        id: 'converted-exercise',
        name: 'Per-side load',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        restDurationSeconds: 90,
        sets: [{
          id: 'converted-set',
          status: 'performed',
          actualReps: 8,
          actualLoad: perSideLb,
          confirmedAt: '2026-10-22T09:10:00.000Z'
        }]
      }]
    }];
    expect(validateStrengthData(data)).toBe(true);
  });

  it('rejects invalid exercise identities, configuration, set values, states, and timestamps', () => {
    const template: StrengthSavedWorkout = {
      id: 'template-invalid-cases',
      name: 'Plan',
      muscleIds: ['chest'],
      sharedWith: [],
      exercises: [{
        id: 'exercise-one',
        name: 'Push-up',
        muscleIds: ['chest'],
        equipment: 'Bodyweight',
        restDurationSeconds: 60,
        sets: [{ id: 'set-one', targetReps: 10, targetLoad: { kind: 'bodyweight' } }]
      }]
    };
    const session = createStrengthGuidedSession(template, {
      id: 'draft-invalid-cases', date: '2026-10-22',
      startedAt: '2026-10-22T09:00:00.000Z', timeZone: 'UTC'
    });
    expect(session.valid).toBe(true);
    if (!session.valid) return;
    expect(validateStrengthGuidedSessionDraft(session.session)).toBe(true);
    const exercise = template.exercises![0]!;
    const badRestTemplate: StrengthSavedWorkout = {
      ...template,
      exercises: [{ ...exercise, restDurationSeconds: 3601 }]
    };
    expect(createStrengthGuidedSession(badRestTemplate, {
      id: 'draft-bad-rest', date: '2026-10-22',
      startedAt: '2026-10-22T09:00:00.000Z', timeZone: 'UTC'
    }).valid).toBe(false);
    const duplicateSetTemplate: StrengthSavedWorkout = {
      ...template,
      exercises: [{
        ...exercise,
        sets: [
          exercise.sets[0]!,
          { ...exercise.sets[0]!, id: 'set-one' }
        ]
      }]
    };
    expect(createStrengthGuidedSession(duplicateSetTemplate, {
      id: 'draft-duplicate-set', date: '2026-10-22',
      startedAt: '2026-10-22T09:00:00.000Z', timeZone: 'UTC'
    }).valid).toBe(false);
    expect(createStrengthWorkout([], {
      ...template,
      exercises: [exercise, { ...exercise, id: 'exercise-one' }]
    }).valid).toBe(false);
    expect(createStrengthWorkout([], {
      ...template,
      exercises: [{ ...exercise, muscleIds: ['chest', 'chest'] }]
    }).valid).toBe(false);
    expect(confirmStrengthSessionSet(
      session.session, 'exercise-one', 'set-one', 0, '2026-10-22T09:01:00.000Z'
    ).valid).toBe(false);
    expect(confirmStrengthSessionSet(
      session.session, 'exercise-one', 'set-one', 10, 'not-an-instant'
    ).valid).toBe(false);
    expect(confirmStrengthSessionSet(
      session.session, 'exercise-one', 'set-one', 10, '2026-10-22T08:59:00.000Z'
    ).valid).toBe(false);
    expect(confirmStrengthSessionSet(
      session.session, 'exercise-one', 'set-one', 10, '2026-10-22T09:01:00.000Z',
      { kind: 'external', meaning: 'total', value: Number.NaN, unit: 'lb' }
    ).valid).toBe(false);
    expect(validateStrengthGuidedSessionDraft({
      ...session.session,
      exercises: [{
        ...session.session.exercises[0]!,
        sets: [{ ...session.session.exercises[0]!.sets[0]!, status: 'performed' }]
      }]
    })).toBe(false);
    expect(validateStrengthGuidedSessionDraft({
      ...session.session,
      exercises: [{
        ...session.session.exercises[0]!,
        sets: [{ ...session.session.exercises[0]!.sets[0]!, targetReps: 0 }]
      }]
    })).toBe(false);
    expect(validateStrengthGuidedSessionDraft({
      ...session.session,
      exercises: [{
        ...session.session.exercises[0]!,
        sets: [{
          ...session.session.exercises[0]!.sets[0]!,
          status: 'performed',
          actualReps: 10,
          confirmedAt: '2026-10-22T08:59:00.000Z'
        }]
      }]
    })).toBe(false);
    expect(validateStrengthData({
      ...createStrengthData(),
      savedWorkouts: [{ ...template, sharedWith: ['unresolved-person'] }],
      workouts: []
    })).toBe(false);
    const invalidLogData = createStrengthData();
    invalidLogData.workouts = [{
      id: 'invalid-confirmation-window',
      date: '2026-10-22',
      muscleIds: ['chest'],
      startedAt: '2026-10-22T09:00:00.000Z',
      finishedAt: '2026-10-22T09:10:00.000Z',
      timeZone: 'UTC',
      exercises: [{
        ...exercise,
        sets: [{
          id: 'performed-set',
          status: 'performed',
          actualReps: 10,
          confirmedAt: '2026-10-22T09:11:00.000Z'
        }]
      }]
    }];
    expect(validateStrengthData(invalidLogData)).toBe(false);
  });

  it('matches legacy timeliness scoring, due dates, rest boundaries, and zero-rest Abs', () => {
    const data = syntheticData();
    data.settings.muscleIntervals.chest = 4;
    data.settings.preferredRestDays.chest = 2;
    data.settings.muscleIntervals.abs = 3;
    data.settings.preferredRestDays.abs = 0;
    data.workouts = [
      { id: 'chest', date: '2026-03-06', muscleIds: ['chest'] },
      { id: 'abs', date: '2026-03-08', muscleIds: ['abs'] },
      { id: 'future', date: '2026-03-20', muscleIds: ['back'] }
    ];

    for (const date of ['2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-20']) {
      expect(selectStrengthMuscleScores(data, date)).toMatchObject(
        legacyResult('fitnessMuscleScores', data, date) as object[]
      );
    }

    const chest = selectStrengthMuscleScores(data, '2026-03-09').find(item => item.id === 'chest')!;
    expect(chest.restDaysRemaining).toBe(0);
    expect(chest.daysUntilDue).toBe(1);
    expect(chest.score).toBe(100);
    expect(selectStrengthMuscleScores(data, '2026-03-08').find(item => item.id === 'abs')?.eligible).toBe(true);
    expect(selectStrengthMuscleScores(data, '2026-03-09').find(item => item.id === 'back')?.historyState).toBe('never-trained');
  });

  it('scores Strength Consistency and Health from complete tracked interval windows', () => {
    const data = syntheticData();
    data.settings.muscleIntervals.chest = 7;
    data.settings.preferredRestDays.chest = 2;
    const configured = saveStrengthScoringSetup(data, '2026-09-01', '2026-09-01');
    const thirdWindow = confirmedChestLog('2026-09-20', 'chest-third-window');
    configured.workouts = [
      confirmedChestLog('2026-09-01', 'chest-first-window'),
      confirmedChestLog('2026-09-03', 'chest-first-window-extra'),
      confirmedChestLog('2026-09-08', 'chest-second-window'),
      thirdWindow
    ];

    const score = selectStrengthMuscleScores(configured, '2026-09-28')
      .find(item => item.id === 'chest')!;
    expect(score).toMatchObject({
      consistency: 75,
      onTrack: 90,
      health: 78.75,
      eligibleConsistencyWindows: 4,
      creditedConsistencyWindows: 3,
      lastPerformed: '2026-09-20'
    });
  });

  it('excludes incomplete transition windows and never credits pending, skipped, planned, or legacy logs', () => {
    const data = syntheticData();
    data.settings.muscleIntervals.chest = 7;
    const configured = saveStrengthScoringSetup(data, '2026-09-03', '2026-09-03');
    const pending = confirmedChestLog('2026-09-10', 'pending-placeholder');
    pending.exercises![0]!.sets[0] = {
      id: 'pending-set', targetReps: 8, status: 'pending'
    };
    const skipped = confirmedChestLog('2026-09-17', 'skipped-placeholder');
    skipped.exercises![0]!.sets[0] = {
      id: 'skipped-set', targetReps: 8, status: 'skipped'
    };
    configured.workouts = [
      { id: 'legacy', date: '2026-09-03', muscleIds: ['chest'] },
      { id: 'legacy-empty', date: '2026-09-04', muscleIds: ['chest'], exercises: [] },
      pending,
      skipped
    ];

    const selection = selectStrengthConsistency(
      'chest',
      configured.scoringSettingsHistory,
      configured.trackingStartDate,
      configured.workouts,
      '2026-09-29'
    );
    expect(selection).toMatchObject({ score: 0, eligibleWindows: 2, creditedWindows: 0 });
    expect(selectStrengthMuscleScores(configured, '2026-09-29')
      .find(item => item.id === 'chest')?.onTrack).toBeNull();
  });

  it('preserves a numeric zero component while Strength Health remains unavailable', () => {
    const data = syntheticData();
    data.settings.muscleIntervals.chest = 7;
    const configured = saveStrengthScoringSetup(data, '2026-10-01', '2026-10-01');
    const chest = selectStrengthMuscleScores(configured, '2026-10-10')
      .find(item => item.id === 'chest')!;
    expect(chest.consistency).toBe(0);
    expect(chest.onTrack).toBeNull();
    expect(chest.health).toBeNull();

    const notStarted = selectStrengthMuscleScores(configured, '2026-09-30')
      .find(item => item.id === 'chest')!;
    expect(notStarted.consistency).toBeNull();
    expect(notStarted.health).toBeNull();
  });

  it('matches legacy missing-setting, invalid-history, and future-log states', () => {
    const data = syntheticData();
    delete data.settings.muscleIntervals.triceps;
    data.workouts = [
      { id: 'invalid', date: '2026-02-30', muscleIds: ['biceps'] },
      { id: 'future', date: '2026-10-30', muscleIds: ['shoulders'] }
    ];
    for (const date of ['2026-10-22', '2026-10-30']) {
      expect(selectStrengthMuscleScores(data, date)).toMatchObject(
        legacyResult('fitnessMuscleScores', data, date) as object[]
      );
    }
    expect(selectStrengthMuscleScores(data, '2026-10-22').find(item => item.id === 'biceps')?.historyState).toBe('invalid');
    expect(selectStrengthMuscleScores(data, '2026-10-22').find(item => item.id === 'shoulders')?.historyState).toBe('never-trained');
    expect(selectStrengthMuscleScores(data, '2026-10-22').find(item => item.id === 'triceps')?.score).toBeNull();
  });

  it('matches legacy recommendation ranking, ties, duplicate combinations, exclusions and the two-item cap', () => {
    const data = syntheticData();
    data.savedWorkouts = [
      { id: 'z', name: 'Upper', muscleIds: ['back', 'chest', 'chest'], sharedWith: [] },
      { id: 'b', name: 'Arms', muscleIds: ['biceps'], sharedWith: [] },
      { id: 'a', name: 'arms', muscleIds: ['biceps'], sharedWith: [] },
      { id: 'c', name: 'Core', muscleIds: ['abs'], sharedWith: [] },
      { id: 'bad', name: 'Resting target', muscleIds: ['chest'], sharedWith: [] }
    ];
    data.workouts = [{ id: 'resting', date: '2026-10-22', muscleIds: ['chest'] }];
    data.settings.preferredRestDays.chest = 1;
    const scores = selectStrengthMuscleScores(data, '2026-10-22');
    expect(rankStrengthWorkouts(scores, data.savedWorkouts)).toEqual(
      legacyResult('fitnessRankSavedWorkouts', scores, data.savedWorkouts)
    );
    expect(rankStrengthWorkouts(scores, data.savedWorkouts)).toHaveLength(2);
    expect(rankStrengthWorkouts(scores, data.savedWorkouts).map(item => item.id)).toEqual(['a', 'c']);
    expect(selectStrengthScore(scores)).toBe(100);
  });

  it('preserves date-independent template history, identity, and unrelated logs through commands', () => {
    const template: StrengthSavedWorkout = {
      id: 'template-stable-id',
      name: 'Upper body',
      muscleIds: ['chest', 'back'],
      sharedWith: ['sample-person-avery']
    };
    const created = createStrengthWorkout([], template);
    expect(created.valid).toBe(true);
    if (!created.valid) return;
    const edited = editStrengthWorkout(created.workouts, { ...template, name: 'Renamed', muscleIds: ['biceps'] });
    expect(edited.valid).toBe(true);
    const log = {
      id: 'log-stable-id',
      date: '2026-10-20',
      muscleIds: ['chest'] as ('chest')[],
      savedWorkoutId: template.id,
      workoutName: template.name
    };
    const logs = saveStrengthWorkoutLog([], log);
    expect(logs.valid).toBe(true);
    if (!logs.valid) return;
    expect(logs.workouts[0]).toMatchObject({ savedWorkoutId: template.id, workoutName: template.name, muscleIds: ['chest'] });
    expect(deleteStrengthWorkout(edited.valid ? edited.workouts : [], template.id)).toEqual([]);
    expect(deleteStrengthWorkoutLog(logs.workouts, log.id)).toMatchObject({
      workouts: [],
      deleted: { id: log.id, date: log.date }
    });
  });

  it('orders history newest first, resolves same-date ties deterministically, and groups after applying the visible limit', () => {
    const logs = [
      { id: 'a', date: '2025-12-31', muscleIds: ['chest'] as ('chest')[] },
      { id: 'c', date: '2026-01-01', muscleIds: ['back'] as ('back')[] },
      { id: 'b', date: '2026-01-01', muscleIds: ['abs'] as ('abs')[] },
      { id: 'd', date: '2026-02-01', muscleIds: ['quads'] as ('quads')[] }
    ];
    const firstThree = selectStrengthWorkoutHistory(logs, 3);
    expect(firstThree.visibleLogs.map(log => log.id)).toEqual(['d', 'c', 'b']);
    expect(firstThree.groups.map(group => [group.key, group.label, group.logs.map(log => log.id)])).toEqual([
      ['2026-02', 'February 2026', ['d']],
      ['2026-01', 'January 2026', ['c', 'b']]
    ]);
    expect(firstThree).toMatchObject({ total: 4, hasMore: true });

    const all = selectStrengthWorkoutHistory(logs, 10);
    expect(all.groups.map(group => group.key)).toEqual(['2026-02', '2026-01', '2025-12']);
    expect(all.groups[1]?.logs.map(log => log.id)).toEqual(['c', 'b']);
    expect(all.hasMore).toBe(false);
    expect(selectStrengthWorkoutHistory([], 10)).toMatchObject({
      total: 0,
      visibleLogs: [],
      groups: [],
      hasMore: false
    });
  });

  it('prevents invalid interval/rest settings and duplicate linked occurrences', () => {
    const data = syntheticData();
    data.settings.muscleIntervals.chest = 2;
    data.settings.preferredRestDays.chest = 2;
    expect(validateStrengthSettings(data.settings).chest).toMatch(/interval must exceed/i);
    expect(validateStrengthData(data)).toBe(false);

    const linked = {
      id: 'log-one',
      date: '2026-10-22',
      muscleIds: ['chest'] as ('chest')[],
      rhythmId: 'rhythm-one',
      rhythmOccurrence: '2026-10-22',
      completionId: 'completion-one'
    };
    const first = saveStrengthWorkoutLog([], linked);
    expect(first.valid).toBe(true);
    if (!first.valid) return;
    const duplicate = saveStrengthWorkoutLog(first.workouts, { ...linked, id: 'log-two', completionId: 'completion-two' });
    expect(duplicate).toMatchObject({ valid: false });
    const updateToDuplicate = saveStrengthWorkoutLog(first.workouts, {
      ...linked,
      id: 'log-one',
      date: '2026-10-23',
      rhythmOccurrence: '2026-10-22'
    });

    expect(updateToDuplicate).toMatchObject({ valid: false });
  });

  it('resolves approved per-muscle between-set defaults using the longest applicable preference', () => {
    expect(defaultStrengthBetweenSetRestSeconds).toEqual({
      chest: 180,
      back: 180,
      quads: 180,
      hamstrings: 180,
      biceps: 120,
      triceps: 120,
      shoulders: 120,
      abs: 120,
      calves: 120
    });
    const data = createStrengthData();
    data.settings.betweenSetRestSeconds.chest = 240;
    data.settings.betweenSetRestSeconds.biceps = 60;
    expect(resolveStrengthBetweenSetRestSeconds(['chest', 'biceps'], data.settings)).toBe(240);
    expect(resolveStrengthBetweenSetRestSeconds(['biceps', 'chest', 'biceps'], data.settings)).toBe(240);
    expect(resolveStrengthBetweenSetRestSeconds([], data.settings)).toBe(90);
    expect(validateStrengthSettings(data.settings)).toEqual({});
  });

  it('uses current preferences for fresh suggestion drafts without rewriting saved exercise or timed targets', () => {
    const data = createStrengthData();
    const existingWorkout: StrengthSavedWorkout = {
      id: 'existing-rest-snapshot',
      name: 'Existing plan',
      muscleIds: ['chest'],
      sharedWith: [],
      exercises: [{
        id: 'existing-rest-exercise',
        name: 'Bench Press',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        restDurationSeconds: 75,
        restDurationOverridden: true,
        sets: [{ id: 'existing-rest-set', targetReps: 8 }]
      }]
    };
    data.savedWorkouts = [existingWorkout];
    data.settings.betweenSetRestSeconds.chest = 240;
    data.settings.betweenSetRestSeconds.abs = 210;

    let id = 0;
    const makeId = () => `rest-pref-${++id}`;
    const upper = strengthWorkoutSuggestions.find(item => item.sourceId === 'strength.upper-body')!;
    const upperDrafts = createStrengthWorkoutSuggestionExercises(upper, makeId, data.settings);
    expect(upperDrafts[0]?.restDurationSeconds).toBe(240);
    expect(upperDrafts[1]?.restDurationSeconds).toBe(180);
    expect(upperDrafts[0]?.sets.every(set => set.targetLoad === undefined)).toBe(true);
    for (const suggestion of strengthWorkoutSuggestions) {
      const drafts = createStrengthWorkoutSuggestionExercises(suggestion, makeId, data.settings);
      expect(drafts.map(exercise => exercise.restDurationSeconds)).toEqual(
        suggestion.exercises.map(exercise => resolveStrengthBetweenSetRestSeconds(exercise.muscleIds, data.settings))
      );
      expect(drafts.flatMap(exercise => exercise.sets).every(set => set.targetLoad === undefined)).toBe(true);
    }

    const powerAbs = strengthWorkoutSuggestions.find(item => item.sourceId === 'strength.power-abs')!;
    const absDrafts = createStrengthWorkoutSuggestionExercises(powerAbs, makeId, data.settings);
    const groups = createStrengthWorkoutSuggestionSupersetGroups(powerAbs, absDrafts, makeId, data.settings);
    expect(absDrafts.map(exercise => exercise.restDurationSeconds)).toEqual([210, 210]);
    expect(groups[0]?.restDurationSeconds).toBe(210);

    const plank = strengthWorkoutSuggestions.find(item => item.sourceId === 'strength.plank')!;
    const plankDraft = createStrengthWorkoutSuggestionExercises(plank, makeId, data.settings)[0]!;
    expect(plankDraft.restDurationSeconds).toBe(210);
    expect(plankDraft.sets[0]?.measurement).toEqual({ kind: 'duration', targetDurationSeconds: 180 });
    expect(plankDraft.sets[0]?.targetLoad).toBeUndefined();
    expect(data.savedWorkouts).toEqual([existingWorkout]);
    expect(data.savedWorkouts[0]?.exercises?.[0]?.restDurationSeconds).toBe(75);
  });

  it('keeps empty and unscored groups unavailable rather than fabricating zero', () => {
    const data = syntheticData();
    const scores = selectStrengthMuscleScores(data, '2026-10-22');
    expect(scores).toHaveLength(strengthMuscles.length);
    expect(scores.every(item => item.score === null)).toBe(true);
    expect(selectStrengthScore(scores)).toBeNull();
  });

  it('defines all ten approved source-linked templates with authoritative muscle IDs', () => {
    expect(strengthWorkoutSuggestions.map(({ sourceId, name, muscleIds }) => ({
      sourceId,
      name,
      muscleIds
    }))).toEqual([
      { sourceId: 'strength.upper-body', name: 'Upper Body', muscleIds: ['chest', 'back', 'biceps', 'triceps', 'shoulders'] },
      { sourceId: 'strength.lower-body', name: 'Lower Body', muscleIds: ['quads', 'hamstrings', 'calves', 'back'] },
      { sourceId: 'strength.arms', name: 'Arms', muscleIds: ['biceps', 'triceps'] },
      { sourceId: 'strength.back-biceps', name: 'Back & Biceps', muscleIds: ['back', 'biceps'] },
      { sourceId: 'strength.chest-triceps', name: 'Chest & Triceps', muscleIds: ['chest', 'triceps', 'shoulders'] },
      { sourceId: 'strength.shoulders-quads', name: 'Shoulders & Quads', muscleIds: ['shoulders', 'quads', 'hamstrings', 'triceps'] },
      { sourceId: 'strength.arms-shoulders', name: 'Arms & Shoulders', muscleIds: ['biceps', 'triceps', 'shoulders', 'back'] },
      { sourceId: 'strength.ab-roller', name: 'Ab Roller', muscleIds: ['abs'] },
      { sourceId: 'strength.power-abs', name: 'Power Abs', muscleIds: ['abs'] },
      { sourceId: 'strength.plank', name: 'Plank', muscleIds: ['abs'] }
    ]);
    expect(new Set(strengthWorkoutSuggestions.map(item => item.sourceId)).size).toBe(10);
    expect(strengthWorkoutSuggestions.every(item =>
      item.muscleIds.every(id => strengthMuscles.some(muscle => muscle.id === id))
        && new Set(item.muscleIds).size === item.muscleIds.length
        && new Set(item.muscleIds).size === new Set(item.exercises.flatMap(exercise => exercise.muscleIds)).size
        && item.muscleIds.every(id => item.exercises.some(exercise => exercise.muscleIds.includes(id)))
    )).toBe(true);
  });

  it('keeps every approved exercise plan ordered, with blank loads and supported muscle groups', () => {
    const plan = (sourceId: string) => {
      const suggestion = strengthWorkoutSuggestions.find(item => item.sourceId === sourceId)!;
      return suggestion.exercises.map(exercise => ({
        name: exercise.name,
        muscleIds: [...exercise.muscleIds],
        equipment: exercise.equipment,
        notes: exercise.notes,
        sets: exercise.sets.map(set => ({ ...set }))
      }));
    };

    expect(plan('strength.upper-body')).toEqual([
      { name: 'Bench Press', muscleIds: ['chest', 'triceps', 'shoulders'], equipment: 'Barbell', notes: undefined, sets: [{ targetReps: 12 }, { targetReps: 10 }, { targetReps: 8 }] },
      { name: 'Pull-Up', muscleIds: ['back', 'biceps'], equipment: 'Pull-up bar', notes: 'Aim for 10–15 reps per set.', sets: [{ targetReps: 10 }, { targetReps: 10 }, { targetReps: 10 }] },
      { name: 'Overhead Press', muscleIds: ['shoulders', 'triceps'], equipment: 'Barbell', notes: undefined, sets: [{ targetReps: 10 }, { targetReps: 10 }, { targetReps: 10 }] },
      { name: 'Barbell Biceps Curl', muscleIds: ['biceps'], equipment: 'Barbell', notes: undefined, sets: [{ targetReps: 8 }, { targetReps: 8 }, { targetReps: 8 }] },
      { name: 'Cable Triceps Pressdown', muscleIds: ['triceps'], equipment: 'Cable', notes: undefined, sets: [{ targetReps: 8 }, { targetReps: 8 }, { targetReps: 8 }] }
    ]);
    expect(plan('strength.lower-body').map(exercise => [exercise.name, exercise.muscleIds, exercise.sets.map(suggestedReps)])).toEqual([
      ['Squat', ['quads', 'hamstrings'], [10, 10, 10]],
      ['Romanian Deadlift', ['hamstrings', 'back'], [8, 8, 8]],
      ['Calf Raise', ['calves'], [12, 12, 12]]
    ]);
    expect(plan('strength.arms').map(exercise => [exercise.name, exercise.muscleIds, exercise.sets.map(suggestedReps)])).toEqual([
      ['Skull Crusher', ['triceps'], [10, 10, 10]],
      ['Incline Dumbbell Curl', ['biceps'], [10, 10, 10]],
      ['Cable Triceps Pressdown', ['triceps'], [10, 10, 10]],
      ['Hammer Curl', ['biceps'], [10, 10, 10]]
    ]);
    expect(plan('strength.back-biceps').map(exercise => [exercise.name, exercise.muscleIds, exercise.sets.map(suggestedReps)])).toEqual([
      ['Weighted Pull-Up', ['back', 'biceps'], [10, 10, 10]],
      ['Cable Row', ['back', 'biceps'], [10, 10, 10]],
      ['Incline Dumbbell Curl', ['biceps'], [10, 10, 10]]
    ]);
    expect(plan('strength.chest-triceps').map(exercise => [exercise.name, exercise.muscleIds, exercise.sets.map(suggestedReps)])).toEqual([
      ['Incline Dumbbell Press', ['chest', 'triceps', 'shoulders'], [10, 10, 10]],
      ['Incline Dumbbell Fly', ['chest', 'shoulders'], [10, 10, 10]],
      ['Triceps Extension', ['triceps'], [10, 10, 10]]
    ]);
    expect(plan('strength.shoulders-quads').map(exercise => [exercise.name, exercise.muscleIds, exercise.sets.map(suggestedReps)])).toEqual([
      ['Barbell Squat', ['quads', 'hamstrings'], [10, 10, 10]],
      ['Military Press', ['shoulders', 'triceps'], [10, 10, 10]],
      ['Lateral Raise', ['shoulders'], [10, 10, 10]],
      ['Dumbbell Front Raise', ['shoulders'], [10, 10, 10]]
    ]);
    expect(plan('strength.arms-shoulders').map(exercise => [exercise.name, exercise.muscleIds, exercise.sets.map(suggestedReps)])).toEqual([
      ['Dumbbell Overhead Press', ['shoulders', 'triceps'], [10, 10, 10]],
      ['Incline Dumbbell Curl', ['biceps'], [10, 10, 10]],
      ['Cable Triceps Pressdown', ['triceps'], [10, 10, 10]],
      ['Lateral Raise', ['shoulders'], [10, 10, 10]],
      ['Front Raise', ['shoulders'], [10, 10, 10]],
      ['Bent-Over Reverse Fly', ['shoulders', 'back'], [10, 10, 10]]
    ]);
    expect(strengthWorkoutSuggestions.flatMap(suggestion => suggestion.exercises).every(exercise =>
      exercise.sets.every(set => 'targetReps' in set
        ? Object.keys(set).every(key => key === 'targetReps')
        : Object.keys(set).every(key => key === 'targetDurationSeconds'))
        && exercise.muscleIds.every(id => strengthMuscles.some(muscle => muscle.id === id))
    )).toBe(true);
    expect(plan('strength.ab-roller')).toEqual([
      { name: 'Ab Wheel Rollout', muscleIds: ['abs'], equipment: 'Ab wheel', notes: undefined, sets: [{ targetReps: 20 }, { targetReps: 20 }, { targetReps: 20 }] }
    ]);
    expect(plan('strength.power-abs')).toEqual([
      { name: 'Weighted Decline Sit-Up', muscleIds: ['abs'], equipment: 'Weight plate', notes: undefined, sets: [{ targetReps: 10 }, { targetReps: 10 }, { targetReps: 10 }] },
      { name: 'Roman Chair Leg Raise', muscleIds: ['abs'], equipment: 'Roman chair', notes: undefined, sets: [{ targetReps: 10 }, { targetReps: 10 }, { targetReps: 10 }] }
    ]);
    expect(strengthWorkoutSuggestions.find(item => item.sourceId === 'strength.power-abs')?.supersetExerciseIndexes).toEqual([0, 1]);
    expect(plan('strength.plank')).toEqual([
      { name: 'Plank', muscleIds: ['abs'], equipment: 'Bodyweight', notes: undefined, sets: [{ targetDurationSeconds: 180 }] }
    ]);
  });

  it('creates valid suggestion templates with explicit load meanings and only declared supersets', () => {
    const expectedMeanings: Record<string, string> = {
      'Bench Press': 'total',
      'Pull-Up': 'bodyweight',
      'Overhead Press': 'total',
      'Barbell Biceps Curl': 'total',
      'Cable Triceps Pressdown': 'total',
      'Squat': 'total',
      'Romanian Deadlift': 'total',
      'Calf Raise': 'bodyweight',
      'Skull Crusher': 'total',
      'Incline Dumbbell Curl': 'per-dumbbell',
      'Hammer Curl': 'per-dumbbell',
      'Weighted Pull-Up': 'total',
      'Cable Row': 'total',
      'Incline Dumbbell Press': 'per-dumbbell',
      'Incline Dumbbell Fly': 'per-dumbbell',
      'Triceps Extension': 'per-dumbbell',
      'Barbell Squat': 'total',
      'Military Press': 'total',
      'Lateral Raise': 'per-dumbbell',
      'Dumbbell Front Raise': 'per-dumbbell',
      'Dumbbell Overhead Press': 'per-dumbbell',
      'Front Raise': 'per-dumbbell',
      'Bent-Over Reverse Fly': 'per-dumbbell',
      'Ab Wheel Rollout': 'bodyweight',
      'Weighted Decline Sit-Up': 'total',
      'Roman Chair Leg Raise': 'bodyweight',
      'Plank': 'bodyweight'
    };
    let id = 0;
    const createId = () => `suggestion-contract-${++id}`;
    for (const suggestion of strengthWorkoutSuggestions) {
      const exercises = createStrengthWorkoutSuggestionExercises(suggestion, createId);
      expect(exercises.map(exercise => [exercise.name, exercise.loadMeaning])).toEqual(
        suggestion.exercises.map(exercise => [exercise.name, expectedMeanings[exercise.name]])
      );
      expect(exercises.flatMap(exercise => exercise.sets).every(set => set.targetLoad === undefined)).toBe(true);
      const supersetGroups = createStrengthWorkoutSuggestionSupersetGroups(suggestion, exercises, createId);
      expect(supersetGroups).toHaveLength(suggestion.sourceId === 'strength.power-abs' ? 1 : 0);
      const result = createStrengthWorkout([], {
        id: `suggestion-workout-${suggestion.sourceId}`,
        name: suggestion.name,
        muscleIds: [...suggestion.muscleIds],
        sharedWith: [],
        suggestionSourceId: suggestion.sourceId,
        exercises,
        supersetGroups
      });
      expect(result.valid, suggestion.sourceId).toBe(true);
    }
    expect(strengthWorkoutSuggestions.flatMap(item => item.exercises)
      .every(exercise => exercise.loadMeaning !== undefined)).toBe(true);
  });

  it('creates independently identified suggestion exercise and set drafts', () => {
    let id = 0;
    const nextId = () => `test-${++id}`;
    const suggestion = strengthWorkoutSuggestions.find(item => item.sourceId === 'strength.upper-body')!;
    const firstDraft = createStrengthWorkoutSuggestionExercises(suggestion, nextId);
    const secondDraft = createStrengthWorkoutSuggestionExercises(suggestion, nextId);
    const ids = (exercises: typeof firstDraft) => [
      ...exercises.map(exercise => exercise.id),
      ...exercises.flatMap(exercise => exercise.sets.map(set => set.id))
    ];

    expect(firstDraft.map(exercise => exercise.name)).toEqual(suggestion.exercises.map(exercise => exercise.name));
    expect(new Set(ids(firstDraft)).size).toBe(ids(firstDraft).length);
    expect(new Set([...ids(firstDraft), ...ids(secondDraft)]).size).toBe(ids(firstDraft).length + ids(secondDraft).length);
    expect(firstDraft.flatMap(exercise => exercise.sets).every(set => set.targetLoad === undefined)).toBe(true);
    expect(firstDraft.map(exercise => exercise.restDurationSeconds)).toEqual([180, 180, 120, 120, 120]);
  });

  it('creates stable, independent Power Abs superset groups from exercise IDs', () => {
    let id = 0;
    const suggestion = strengthWorkoutSuggestions.find(item => item.sourceId === 'strength.power-abs')!;
    const exercises = createStrengthWorkoutSuggestionExercises(suggestion, () => `instance-${++id}`);
    const firstGroups = createStrengthWorkoutSuggestionSupersetGroups(suggestion, exercises, () => `group-${++id}`);
    const secondExercises = createStrengthWorkoutSuggestionExercises(suggestion, () => `instance-${++id}`);
    const secondGroups = createStrengthWorkoutSuggestionSupersetGroups(suggestion, secondExercises, () => `group-${++id}`);
    expect(firstGroups).toEqual([{
      id: 'strength-superset-group-9',
      exerciseIds: [exercises[0]!.id, exercises[1]!.id],
      restDurationSeconds: exercises[1]!.restDurationSeconds,
      restDurationOverridden: false
    }]);
    expect(secondGroups[0]!.id).not.toBe(firstGroups[0]!.id);
    expect(secondGroups[0]!.exerciseIds).not.toEqual(firstGroups[0]!.exerciseIds);
  });

  it('alternates Power Abs by round and starts auto-rest only after each completed pair', () => {
    const suggestion = strengthWorkoutSuggestions.find(item => item.sourceId === 'strength.power-abs')!;
    const exercises = createStrengthWorkoutSuggestionExercises(suggestion, (() => {
      let id = 0;
      return () => `power-${++id}`;
    })());
    const groups = createStrengthWorkoutSuggestionSupersetGroups(suggestion, exercises, () => 'power-group');
    const template: StrengthSavedWorkout = {
      id: 'power-abs-template',
      name: suggestion.name,
      muscleIds: ['abs'],
      sharedWith: [],
      exercises,
      supersetGroups: groups
    };
    const created = createStrengthGuidedSession(template, {
      id: 'power-abs-session',
      date: '2026-10-22',
      startedAt: '2026-10-22T09:00:00.000Z',
      timeZone: 'UTC'
    });
    expect(created.valid).toBe(true);
    if (!created.valid) return;
    const session = setStrengthSessionAutoStartRest(created.session, true);
    expect(session.valid).toBe(true);
    if (!session.valid) return;
    const active = session.session;
    expect(selectStrengthSessionExecutionOrder(active).map(item => [item.exerciseId, item.setId])).toEqual([
      [exercises[0]!.id, exercises[0]!.sets[0]!.id],
      [exercises[1]!.id, exercises[1]!.sets[0]!.id],
      [exercises[0]!.id, exercises[0]!.sets[1]!.id],
      [exercises[1]!.id, exercises[1]!.sets[1]!.id],
      [exercises[0]!.id, exercises[0]!.sets[2]!.id],
      [exercises[1]!.id, exercises[1]!.sets[2]!.id]
    ]);

    const first = confirmStrengthSessionSet(
      active, exercises[0]!.id, exercises[0]!.sets[0]!.id, 10, '2026-10-22T09:01:00.000Z'
    );
    expect(first.valid).toBe(true);
    if (!first.valid) return;
    expect(first.session.restTimer?.status).toBe('idle');
    expect(selectNextStrengthSessionSet(first.session, exercises[0]!.id, exercises[0]!.sets[0]!.id))
      .toEqual({ exerciseId: exercises[1]!.id, setId: exercises[1]!.sets[0]!.id });

    const partner = confirmStrengthSessionSet(
      first.session, exercises[1]!.id, exercises[1]!.sets[0]!.id, 10, '2026-10-22T09:02:00.000Z'
    );
    expect(partner.valid).toBe(true);
    if (!partner.valid) return;
    expect(partner.session.restTimer).toMatchObject({ status: 'running', durationSeconds: 120 });
    expect(selectNextStrengthSessionSet(partner.session, exercises[1]!.id, exercises[1]!.sets[0]!.id))
      .toEqual({ exerciseId: exercises[0]!.id, setId: exercises[0]!.sets[1]!.id });
  });

  it('does not rest after a skipped superset member and handles unequal set counts without invented sets', () => {
    const suggestion = strengthWorkoutSuggestions.find(item => item.sourceId === 'strength.power-abs')!;
    const exercises = createStrengthWorkoutSuggestionExercises(suggestion, (() => {
      let id = 0;
      return () => `unequal-${++id}`;
    })());
    exercises[0]!.sets = [exercises[0]!.sets[0]!];
    const groups = createStrengthWorkoutSuggestionSupersetGroups(suggestion, exercises, () => 'unequal-group');
    const created = createStrengthGuidedSession({
      id: 'unequal-template', name: 'Power Abs', muscleIds: ['abs'], sharedWith: [], exercises, supersetGroups: groups
    }, {
      id: 'unequal-session', date: '2026-10-22', startedAt: '2026-10-22T09:00:00.000Z', timeZone: 'UTC'
    });
    expect(created.valid).toBe(true);
    if (!created.valid) return;
    const active = setStrengthSessionAutoStartRest(created.session, true);
    if (!active.valid) return;
    const sequence = selectStrengthSessionExecutionOrder(active.session);
    expect(sequence.map(item => [item.exerciseId, item.setId])).toEqual([
      [exercises[0]!.id, exercises[0]!.sets[0]!.id],
      [exercises[1]!.id, exercises[1]!.sets[0]!.id],
      [exercises[1]!.id, exercises[1]!.sets[1]!.id],
      [exercises[1]!.id, exercises[1]!.sets[2]!.id]
    ]);
    const skipped = skipStrengthSessionSet(active.session, exercises[0]!.id, exercises[0]!.sets[0]!.id);
    expect(skipped.valid).toBe(true);
    if (!skipped.valid) return;
    const performed = confirmStrengthSessionSet(
      skipped.session, exercises[1]!.id, exercises[1]!.sets[0]!.id, 10, '2026-10-22T09:01:00.000Z'
    );
    expect(performed.valid).toBe(true);
    if (performed.valid) {
      expect(performed.session.restTimer?.status).toBe('idle');
      expect(selectNextStrengthSessionSet(performed.session, exercises[1]!.id, exercises[1]!.sets[0]!.id))
        .toEqual({ exerciseId: exercises[1]!.id, setId: exercises[1]!.sets[1]!.id });
    }
  });

  it('keeps timed exercise timing independent from rest and logs only explicit actual duration', () => {
    const suggestion = strengthWorkoutSuggestions.find(item => item.sourceId === 'strength.plank')!;
    const exercises = createStrengthWorkoutSuggestionExercises(suggestion, (() => {
      let id = 0;
      return () => `plank-${++id}`;
    })());
    const created = createStrengthGuidedSession({
      id: 'plank-template', name: suggestion.name, muscleIds: ['abs'], sharedWith: [], exercises
    }, {
      id: 'plank-session', date: '2026-10-22', startedAt: '2026-10-22T09:00:00.000Z', timeZone: 'UTC'
    });
    expect(created.valid).toBe(true);
    if (!created.valid) return;
    const rest = setStrengthSessionRestDuration(created.session, 90);
    if (!rest.valid) return;
    const restStarted = startStrengthSessionRestTimer(rest.session, '2026-10-22T09:01:00.000Z');
    if (!restStarted.valid) return;
    const timerStarted = startStrengthExerciseTimer(restStarted.session, '2026-10-22T09:01:05.000Z');
    expect(timerStarted.valid).toBe(true);
    if (!timerStarted.valid) return;
    expect(timerStarted.session.restTimer?.status).toBe('idle');
    expect(selectStrengthExerciseTimerElapsedMilliseconds(
      timerStarted.session.exerciseTimer!, '2026-10-22T09:04:05.000Z'
    )).toBe(180_000);
    expect(timerStarted.session.exercises[0]!.sets[0]!.status).toBe('pending');
    expect(hasPerformedStrengthSessionSet(timerStarted.session)).toBe(false);

    const paused = pauseStrengthExerciseTimer(timerStarted.session, '2026-10-22T09:04:05.000Z');
    expect(paused.valid).toBe(true);
    if (!paused.valid) return;
    const resumed = startStrengthExerciseTimer(paused.session, '2026-10-22T09:05:05.000Z');
    expect(resumed.valid).toBe(true);
    if (!resumed.valid) return;
    expect(selectStrengthExerciseTimerElapsedMilliseconds(
      resumed.session.exerciseTimer!, '2026-10-22T09:05:35.000Z'
    )).toBe(210_000);

    const set = exercises[0]!.sets[0]!;
    const logged = confirmStrengthSessionDuration(
      resumed.session, exercises[0]!.id, set.id, 90, '2026-10-22T09:05:35.000Z'
    );
    expect(logged.valid).toBe(true);
    if (!logged.valid) return;
    expect(logged.session.exercises[0]!.sets[0]).toMatchObject({
      status: 'performed',
      measurement: { kind: 'duration', targetDurationSeconds: 180 },
      actualDurationSeconds: 90
    });
    const corrected = correctStrengthSessionDuration(logged.session, exercises[0]!.id, set.id, 120);
    expect(corrected.valid).toBe(true);
    if (!corrected.valid) return;
    const finished = finishStrengthGuidedSession(
      corrected.session, 'plank-log', '2026-10-22T09:06:00.000Z'
    );
    expect(finished.valid).toBe(true);
    if (finished.valid) {
      expect(finished.log.exercises?.[0]?.sets[0]).toMatchObject({
        measurement: { kind: 'duration', targetDurationSeconds: 180 },
        actualDurationSeconds: 120
      });
      expect(finished.log.muscleIds).toEqual(['abs']);
    }
  });

  it('preserves stable source identity and unknown saved-workout fields through edits', () => {
    const workout: StrengthSavedWorkout = {
      id: 'template-stable-id',
      name: 'Upper Body',
      muscleIds: ['chest', 'back'],
      sharedWith: ['sample-person-avery'],
      suggestionSourceId: 'strength.upper-body'
    };
    const withUnknownField = Object.assign(workout, { futureTemplateMetadata: { revision: 3 } });
    const data = syntheticData();
    data.savedWorkouts = [withUnknownField];
    expect(validateStrengthData(data)).toBe(true);

    const edited = editStrengthWorkout(data.savedWorkouts, {
      ...withUnknownField,
      name: 'Renamed strength day',
      muscleIds: ['quads']
    });
    expect(edited.valid).toBe(true);
    if (!edited.valid) return;
    expect(edited.workouts[0]).toMatchObject({
      id: workout.id,
      name: 'Renamed strength day',
      muscleIds: ['quads'],
      suggestionSourceId: 'strength.upper-body',
      futureTemplateMetadata: { revision: 3 }
    });
  });

  it('ranks only saved templates, including a saved suggestion as an ordinary candidate', () => {
    const data = syntheticData();
    const scores = selectStrengthMuscleScores(data, '2026-10-22');
    expect(rankStrengthWorkouts(scores, data.savedWorkouts)).toEqual([]);

    const suggestion = strengthWorkoutSuggestions.find(item => item.sourceId === 'strength.arms')!;
    const saved = createStrengthWorkout(data.savedWorkouts, {
      id: 'saved-strength-arms',
      name: suggestion.name,
      muscleIds: [...suggestion.muscleIds],
      sharedWith: [],
      suggestionSourceId: suggestion.sourceId
    });
    expect(saved.valid).toBe(true);
    if (!saved.valid) return;
    const ranked = rankStrengthWorkouts(scores, saved.workouts);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]).toMatchObject({
      id: 'saved-strength-arms',
      name: 'Arms',
      muscleIds: ['biceps', 'triceps']
    });
  });

  it('updates custom rest only on the originating exercise or superset and inherits it in future sessions', () => {
    const workout: StrengthSavedWorkout = {
      id: 'custom-rest-workout',
      name: 'Custom rest',
      muscleIds: ['chest'],
      sharedWith: [],
      exercises: [
        {
          id: 'custom-rest-bench-pair-a',
          name: 'Bench Press',
          muscleIds: ['chest'],
          equipment: 'Barbell',
          restDurationSeconds: 90,
          restDurationOverridden: false,
          sets: [{ id: 'custom-rest-a-set', targetReps: 8 }]
        },
        {
          id: 'custom-rest-bench-pair-b',
          name: 'Bench Press',
          muscleIds: ['chest'],
          equipment: 'Barbell',
          restDurationSeconds: 120,
          restDurationOverridden: false,
          sets: [{ id: 'custom-rest-b-set', targetReps: 8 }]
        },
        {
          id: 'custom-rest-bench-unpaired',
          name: 'Bench Press',
          muscleIds: ['chest'],
          equipment: 'Barbell',
          restDurationSeconds: 150,
          restDurationOverridden: false,
          sets: [{ id: 'custom-rest-unpaired-set', targetReps: 8 }]
        }
      ],
      supersetGroups: [{
        id: 'custom-rest-pair',
        exerciseIds: ['custom-rest-bench-pair-a', 'custom-rest-bench-pair-b'],
        restDurationSeconds: 180,
        restDurationOverridden: false
      }]
    };
    const historical: StrengthWorkoutLog = {
      id: 'custom-rest-history',
      date: '2026-10-20',
      muscleIds: ['chest'],
      exercises: [{
        ...workout.exercises![0]!,
        sets: [{
          id: 'custom-rest-history-set',
          targetReps: 8,
          status: 'performed',
          actualReps: 8,
          confirmedAt: '2026-10-20T10:00:00.000Z'
        }]
      }]
    };
    const individual = updateStrengthSavedWorkoutRestOverride(
      [workout], workout.id,
      { kind: 'exercise', exerciseId: 'custom-rest-bench-unpaired' }, 222
    );
    expect(individual.valid).toBe(true);
    if (!individual.valid) return;
    expect(individual.workouts[0]!.exercises!.map(item => [item.id, item.restDurationSeconds, item.restDurationOverridden]))
      .toEqual([
        ['custom-rest-bench-pair-a', 90, false],
        ['custom-rest-bench-pair-b', 120, false],
        ['custom-rest-bench-unpaired', 222, true]
      ]);
    expect(workout.exercises![2]?.restDurationSeconds).toBe(150);
    expect(historical.exercises?.[0]?.sets[0]).toMatchObject({
      status: 'performed',
      actualReps: 8
    });

    const session = createStrengthGuidedSession(workout, {
      id: 'custom-rest-session',
      date: '2026-10-22',
      startedAt: '2026-10-22T09:00:00.000Z',
      timeZone: 'UTC'
    });
    expect(session.valid).toBe(true);
    if (!session.valid) return;
    const sessionPreference = setStrengthGuidedSessionRestPreference(
      session.session, 'custom-rest-bench-unpaired', 222
    );
    expect(sessionPreference.valid).toBe(true);
    if (sessionPreference.valid) {
      expect(sessionPreference.session.exercises[2]?.restDurationSeconds).toBe(222);
      expect(sessionPreference.session.exercises[0]?.restDurationSeconds).toBe(90);
    }

    const pair = updateStrengthSavedWorkoutRestOverride(
      individual.workouts, workout.id,
      { kind: 'superset', groupId: 'custom-rest-pair' }, 245
    );
    expect(pair.valid).toBe(true);
    if (!pair.valid) return;
    expect(pair.workouts[0]?.supersetGroups?.[0]).toMatchObject({
      restDurationSeconds: 245,
      restDurationOverridden: true
    });
    expect(pair.workouts[0]?.exercises?.map(item => item.restDurationSeconds)).toEqual([90, 120, 222]);
    const pairPreference = setStrengthGuidedSessionRestPreference(
      session.session, 'custom-rest-bench-pair-a', 245, 'custom-rest-pair'
    );
    expect(pairPreference.valid).toBe(true);
    if (pairPreference.valid) {
      expect(pairPreference.session.supersetGroups?.[0]).toMatchObject({
        restDurationSeconds: 245,
        restDurationOverridden: true
      });
      expect(pairPreference.session.exercises.map(item => item.restDurationSeconds)).toEqual([90, 120, 150]);
    }
    const future = createStrengthGuidedSession(pair.workouts[0]!, {
      id: 'custom-rest-next-session',
      date: '2026-10-23',
      startedAt: '2026-10-23T09:00:00.000Z',
      timeZone: 'UTC'
    });
    expect(future.valid && future.session.supersetGroups?.[0]?.restDurationSeconds).toBe(245);
    expect(updateStrengthSavedWorkoutRestOverride(
      [workout], 'deleted-template', { kind: 'exercise', exerciseId: 'custom-rest-bench-unpaired' }, 222
    )).toMatchObject({ valid: false });
  });

  it('selects rep-based exercise volume precisely and does not invent bodyweight or timed volume', () => {
    const bench: StrengthWorkoutExerciseSnapshot = {
      id: 'volume-bench',
      name: 'Bench Press',
      muscleIds: ['chest'],
      equipment: 'Barbell',
      loadMeaning: 'total',
      restDurationSeconds: 180,
      sets: [
        { id: 'volume-set-1', measurement: { kind: 'reps' }, targetReps: 12, status: 'performed', actualReps: 12, actualLoad: { kind: 'external', meaning: 'total', value: 135, unit: 'lb' }, confirmedAt: '2026-10-22T10:01:00.000Z' },
        { id: 'volume-set-2', measurement: { kind: 'reps' }, targetReps: 10, status: 'performed', actualReps: 10, actualLoad: { kind: 'external', meaning: 'total', value: 145, unit: 'lb' }, confirmedAt: '2026-10-22T10:02:00.000Z' },
        { id: 'volume-set-3', measurement: { kind: 'reps' }, targetReps: 8, status: 'performed', actualReps: 8, actualLoad: { kind: 'external', meaning: 'total', value: 155, unit: 'lb' }, confirmedAt: '2026-10-22T10:03:00.000Z' }
      ]
    };
    expect(selectStrengthExerciseVolume(bench)).toEqual({
      status: 'complete',
      value: 4310,
      unit: 'lb',
      meaning: 'total',
      label: 'Volume'
    });

    const partial = {
      ...bench,
      sets: [
        bench.sets[0]!,
        {
          id: 'volume-set-2',
          measurement: { kind: 'reps' as const },
          targetReps: 10,
          status: 'performed' as const,
          actualReps: 10,
          confirmedAt: '2026-10-22T10:02:00.000Z'
        },
        { ...bench.sets[2]!, status: 'skipped' as const }
      ]
    };
    expect(selectStrengthExerciseVolume(partial)).toMatchObject({
      status: 'partial',
      value: 1620,
      unit: 'lb'
    });
    const dumbbell = {
      ...bench,
      name: 'Incline Dumbbell Press',
      equipment: 'Dumbbells',
      loadMeaning: 'per-dumbbell' as const,
      sets: [{
        id: 'volume-dumbbell',
        targetReps: 10,
        status: 'performed' as const,
        actualReps: 10,
        actualLoad: { kind: 'external' as const, meaning: 'per-dumbbell' as const, value: 40, unit: 'lb' as const },
        confirmedAt: '2026-10-22T10:01:00.000Z'
      }]
    };
    expect(selectStrengthExerciseVolume(dumbbell)).toMatchObject({
      status: 'complete',
      value: 400,
      meaning: 'per-dumbbell',
      label: 'Volume'
    });
    const addedLoad = {
      ...dumbbell,
      name: 'Weighted Pull-Up',
      equipment: 'Pull-up bar',
      loadMeaning: 'total' as const,
      sets: [{
        ...dumbbell.sets[0]!,
        actualLoad: { kind: 'external' as const, meaning: 'total' as const, value: 25, unit: 'lb' as const }
      }]
    };
    expect(selectStrengthExerciseVolume(addedLoad)).toMatchObject({
      value: 250,
      label: 'Added-load volume'
    });
    const bodyweight = {
      ...bench,
      loadMeaning: 'bodyweight' as const,
      sets: [{
        id: 'volume-bodyweight',
        status: 'performed' as const,
        actualReps: 10,
        actualLoad: { kind: 'bodyweight' as const },
        confirmedAt: '2026-10-22T10:01:00.000Z'
      }]
    };
    expect(selectStrengthExerciseVolume(bodyweight)).toBeNull();
    const timed = {
      ...bodyweight,
      sets: [{
        id: 'volume-timed',
        measurement: { kind: 'duration' as const, targetDurationSeconds: 60 },
        status: 'performed' as const,
        actualDurationSeconds: 60,
        confirmedAt: '2026-10-22T10:01:00.000Z'
      }]
    };
    expect(selectStrengthExerciseVolume(timed)).toBeNull();
  });

  it('compares only earlier matching exercise performances and rounds percentages only for display', () => {
    const makeExercise = (id: string, value: number, unit: 'lb' | 'kg' = 'lb'): StrengthWorkoutExerciseSnapshot => ({
      id,
      name: 'Bench Press',
      muscleIds: ['chest'],
      equipment: 'Barbell',
      loadMeaning: 'total',
      restDurationSeconds: 180,
      sets: [{
        id: `${id}-set`,
        targetReps: 1,
        status: 'performed',
        actualReps: 1,
        actualLoad: { kind: 'external', meaning: 'total', value, unit },
        confirmedAt: '2026-10-21T10:01:00.000Z'
      }]
    });
    const current = makeExercise('volume-stable-bench', 105.4);
    const previousLog: StrengthWorkoutLog = {
      id: 'volume-previous',
      date: '2026-10-21',
      muscleIds: ['chest'],
      finishedAt: '2026-10-21T10:30:00.000Z',
      exercises: [makeExercise('volume-stable-bench', 100.6)]
    };
    const sameNameDifferentId: StrengthWorkoutLog = {
      id: 'volume-other-exercise',
      date: '2026-10-22',
      muscleIds: ['chest'],
      finishedAt: '2026-10-22T10:00:00.000Z',
      exercises: [makeExercise('different-stable-id', 104)]
    };
    const currentLog: StrengthWorkoutLog = {
      id: 'volume-current-log',
      date: '2026-10-22',
      muscleIds: ['chest'],
      startedAt: '2026-10-22T11:00:00.000Z',
      finishedAt: '2026-10-22T11:30:00.000Z',
      exercises: [current]
    };
    const comparison = selectStrengthExerciseVolumeComparison(
      [previousLog, sameNameDifferentId, currentLog],
      { id: currentLog.id, date: currentLog.date, startedAt: currentLog.startedAt! },
      current
    );
    expect(comparison?.workout.id).toBe(previousLog.id);
    expect(comparison?.volume.value).toBe(100.6);
    expect(comparison?.changePercent).toBeCloseTo((105.4 - 100.6) / 100.6 * 100);
    expect(formatStrengthVolumeChangePercent(comparison!.changePercent!)).toBe('+5%');
    expect(selectStrengthExerciseVolumeComparison(
      [previousLog],
      { id: currentLog.id, date: currentLog.date, startedAt: currentLog.startedAt! },
      { ...current, equipment: 'Dumbbells' }
    )).toBeNull();
    const incompatibleMeaning = {
      ...previousLog,
      exercises: [makeExercise('volume-stable-bench', 100.6)]
        .map(item => ({
          ...item,
          loadMeaning: 'per-dumbbell' as const,
          sets: item.sets.map(set => set.status === 'performed'
            ? {
                ...set,
                actualLoad: { kind: 'external' as const, meaning: 'per-dumbbell' as const, value: 100.6, unit: 'lb' as const }
              }
            : set)
        }))
    };
    expect(selectStrengthExerciseVolumeComparison(
      [incompatibleMeaning],
      { id: currentLog.id, date: currentLog.date, startedAt: currentLog.startedAt! },
      current
    )).toBeNull();
    const pendingUnknownExercise: StrengthWorkoutExerciseSnapshot = {
      id: current.id,
      name: current.name,
      muscleIds: current.muscleIds,
      equipment: current.equipment,
      restDurationSeconds: current.restDurationSeconds,
      sets: current.sets.map(set => ({
        id: set.id,
        ...(set.targetReps === undefined ? {} : { targetReps: set.targetReps }),
        status: 'pending'
      }))
    };
    expect(selectStrengthExerciseVolumeComparison(
      [previousLog],
      { id: currentLog.id, date: currentLog.date, startedAt: currentLog.startedAt! },
      pendingUnknownExercise
    )).toBeNull();
    const pendingBodyweightExercise = structuredClone(pendingUnknownExercise);
    pendingBodyweightExercise.loadMeaning = 'bodyweight';
    expect(selectStrengthExerciseVolumeComparison(
      [previousLog],
      { id: currentLog.id, date: currentLog.date, startedAt: currentLog.startedAt! },
      pendingBodyweightExercise
    )).toBeNull();

    const convertedPrevious = {
      ...previousLog,
      exercises: [makeExercise('volume-stable-bench', 100 / 2.20462262185, 'kg')]
    };
    expect(selectStrengthExerciseVolumeComparison(
      [convertedPrevious],
      { id: currentLog.id, date: currentLog.date, startedAt: currentLog.startedAt! },
      current
    )?.volume.value).toBeCloseTo(100);

    const zeroPrevious = {
      ...previousLog,
      exercises: [makeExercise('volume-stable-bench', 0)]
    };
    expect(selectStrengthExerciseVolumeComparison(
      [zeroPrevious],
      { id: currentLog.id, date: currentLog.date, startedAt: currentLog.startedAt! },
      current
    )?.changePercent).toBeUndefined();
    const sameDayFuture = {
      ...previousLog,
      date: currentLog.date,
      finishedAt: '2026-10-22T12:00:00.000Z'
    };
    expect(selectStrengthExerciseVolumeComparison(
      [sameDayFuture],
      { id: currentLog.id, date: currentLog.date, startedAt: currentLog.startedAt! },
      current
    )).toBeNull();
  });
});
