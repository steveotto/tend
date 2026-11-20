import { describe, expect, it } from 'vitest';
import type { RhythmPreview } from '../src/domain/preview-data.ts';
import { todayRhythms } from '../src/domain/preview-data.ts';
import type { DatedRhythmCompletion } from '../src/domain/rhythm-completion.ts';
import { createRhythmSeason } from '../src/domain/rhythm-seasons.ts';
import type { RhythmSchedule } from '../src/domain/rhythm-schedule.ts';
import type {
  StrengthRotationVersion,
  StrengthSavedWorkout,
  StrengthWorkoutLog
} from '../src/domain/strength.ts';
import {
  saveStrengthWorkoutLog
} from '../src/domain/strength.ts';
import type { StrengthGuidedSessionDraft } from '../src/domain/strength.ts';
import {
  selectStrengthRotationAssignment,
  updateStrengthRhythmMode
} from '../src/domain/strength-rotation.ts';

const rhythmId = 'rotation-rhythm';
const workoutIds = ['abs-1', 'abs-2', 'abs-3'];
const savedWorkouts: StrengthSavedWorkout[] = workoutIds.map((id, index) => ({
  id,
  name: `Abs ${index + 1}`,
  muscleIds: ['abs'],
  sharedWith: []
}));

function rhythm(schedule: RhythmPreview['schedule'] = { frequency: 'daily' }): RhythmPreview {
  return {
    ...todayRhythms[0]!,
    id: rhythmId,
    title: 'Abs rotation',
    categoryIds: ['health'],
    primaryFoundationId: 'health-strength',
    healthLogCapability: 'workout',
    schedule,
    scoring: {
      trackingStartDate: '2026-06-01',
      timeZone: 'UTC',
      scheduleHistory: [createRhythmSeason(rhythmId, '2026-06-01', schedule!)]
    }
  };
}

function version(
  advanceMode: StrengthRotationVersion['advanceMode'] = 'after-completion',
  overrides: Partial<StrengthRotationVersion> = {}
): StrengthRotationVersion {
  return {
    effectiveFrom: '2026-06-01',
    workoutIds: [...workoutIds],
    workoutNames: ['Abs 1', 'Abs 2', 'Abs 3'],
    advanceMode,
    startIndex: 0,
    ...overrides
  };
}

function completion(date: string): DatedRhythmCompletion {
  return {
    id: `completion-${date}`,
    rhythmId,
    effectiveDate: date,
    localTime: '12:00',
    timeZone: 'UTC',
    completedAt: `${date}T12:00:00.000Z`,
    recordedAt: `${date}T12:00:00.000Z`
  };
}

function log(date: string, savedWorkoutId: string): StrengthWorkoutLog {
  return {
    id: `workout-${date}`,
    date,
    muscleIds: ['abs'],
    savedWorkoutId,
    rhythmId,
    rhythmOccurrence: date,
    completionId: `completion-${date}`
  };
}

function assignment(
  date: string,
  rotation: StrengthRotationVersion,
  overrides: {
    rhythm?: RhythmPreview;
    workouts?: readonly StrengthWorkoutLog[];
    completions?: readonly DatedRhythmCompletion[];
    availableWorkouts?: readonly StrengthSavedWorkout[];
  } = {}
) {
  return selectStrengthRotationAssignment({
    rhythm: overrides.rhythm ?? rhythm(),
    setting: { rhythmId, mode: 'rotation', rotationHistory: [rotation] },
    date,
    workouts: overrides.workouts ?? [],
    savedWorkouts: overrides.availableWorkouts ?? savedWorkouts,
    completions: overrides.completions ?? []
  });
}

describe('Strength workout rotation', () => {
  it('repeats a missed workout, advances once on linked completion, and restores the assignment after Undo', () => {
    const config = version();
    expect(assignment('2026-06-01', config)).toMatchObject({ kind: 'assigned', workoutId: 'abs-1' });
    expect(assignment('2026-06-02', config)).toMatchObject({ kind: 'assigned', workoutId: 'abs-1' });

    const completedLog = log('2026-06-01', 'abs-1');
    const completed = completion('2026-06-01');
    expect(assignment('2026-06-02', config, {
      workouts: [completedLog],
      completions: [completed]
    })).toMatchObject({ kind: 'assigned', workoutId: 'abs-2' });
    expect(assignment('2026-06-02', config, {
      workouts: [completedLog],
      completions: [completed]
    })).toMatchObject({ kind: 'assigned', workoutId: 'abs-2' });
    expect(assignment('2026-06-02', config, { workouts: [completedLog] }))
      .toMatchObject({ kind: 'assigned', workoutId: 'abs-1' });
  });

  it('wraps after three linked completions and does not advance when a duplicate save fails', () => {
    const config = version();
    const logs = [
      log('2026-06-01', 'abs-1'),
      log('2026-06-02', 'abs-2'),
      log('2026-06-03', 'abs-3')
    ];
    const completions = logs.map(item => completion(item.date));
    const next = assignment('2026-06-04', config, { workouts: logs, completions });
    expect(next).toMatchObject({ kind: 'assigned', workoutId: 'abs-1' });
    expect(assignment('2026-06-04', config, { workouts: logs, completions })).toEqual(next);

    const duplicate = saveStrengthWorkoutLog(logs, {
      ...log('2026-06-03', 'abs-3'),
      id: 'duplicate-workout'
    });
    expect(duplicate).toMatchObject({
      valid: false,
      error: 'A workout is already linked to this scheduled Rhythm occurrence.'
    });
    expect(assignment('2026-06-04', config, { workouts: logs, completions }))
      .toMatchObject({ kind: 'assigned', workoutId: 'abs-1' });
  });

  it('advances on actual selected weekdays, including missed occurrences, with wraparound', () => {
    const schedule: RhythmSchedule = {
      frequency: 'weekly',
      weekdays: [1, 3, 5],
      weeklyMode: 'select-days'
    };
    const config = version('each-scheduled-occurrence');
    const scheduledRhythm = rhythm(schedule);
    expect(assignment('2026-06-01', config, { rhythm: scheduledRhythm }))
      .toMatchObject({ kind: 'assigned', workoutId: 'abs-1' });
    expect(assignment('2026-06-03', config, { rhythm: scheduledRhythm }))
      .toMatchObject({ kind: 'assigned', workoutId: 'abs-2' });
    expect(assignment('2026-06-05', config, { rhythm: scheduledRhythm }))
      .toMatchObject({ kind: 'assigned', workoutId: 'abs-3' });
    expect(assignment('2026-06-08', config, { rhythm: scheduledRhythm }))
      .toMatchObject({ kind: 'assigned', workoutId: 'abs-1' });
    expect(assignment('2026-06-02', config, { rhythm: scheduledRhythm }))
      .toMatchObject({ kind: 'unavailable', reason: 'This Rhythm is not due on this date.' });
  });

  it('does not count an unlinked workout or a generic completion as rotation progress', () => {
    const config = version();
    const wrongWorkout = log('2026-06-01', 'abs-2');
    const genericCompletion = completion('2026-06-01');
    expect(assignment('2026-06-02', config, { workouts: [wrongWorkout] }))
      .toMatchObject({ kind: 'assigned', workoutId: 'abs-1' });
    expect(assignment('2026-06-02', config, { completions: [genericCompletion] }))
      .toMatchObject({ kind: 'assigned', workoutId: 'abs-1' });
  });

  it('keeps already saved assignments stable after a backdated completion', () => {
    const config = version();
    const first = log('2026-06-01', 'abs-1');
    const existing = log('2026-06-02', 'abs-1');
    const completions = [completion('2026-06-01'), completion('2026-06-02')];
    expect(assignment('2026-06-03', config, {
      workouts: [first, existing],
      completions
    })).toMatchObject({ kind: 'assigned', workoutId: 'abs-3' });
  });

  it('keeps each Rhythm’s rotation progress independent and does not advance from a draft alone', () => {
    const otherRhythmId = 'other-rotation-rhythm';
    const otherRhythm = {
      ...rhythm(),
      id: otherRhythmId,
      scoring: {
        trackingStartDate: '2026-06-01',
        timeZone: 'UTC',
        scheduleHistory: [createRhythmSeason(otherRhythmId, '2026-06-01', { frequency: 'daily' })]
      }
    };
    const config = version();
    const firstLog = log('2026-06-01', 'abs-1');
    const firstCompletion = completion('2026-06-01');
    const activeDraft: StrengthGuidedSessionDraft = {
      id: 'active-session',
      templateId: 'abs-2',
      workoutName: 'Abs 2',
      date: '2026-06-02',
      startedAt: '2026-06-02T10:00:00.000Z',
      timeZone: 'UTC',
      muscleIds: ['abs'],
      sharedWith: [],
      rhythmId,
      rhythmOccurrence: '2026-06-02',
      completionId: 'active-completion',
      currentExerciseIndex: 0,
      currentSetId: 'set-1',
      exercises: []
    };

    expect(selectStrengthRotationAssignment({
      rhythm: rhythm(),
      setting: { rhythmId, mode: 'rotation', rotationHistory: [config] },
      date: '2026-06-02',
      workouts: [firstLog],
      savedWorkouts,
      completions: [firstCompletion],
      activeDraft
    })).toMatchObject({ kind: 'assigned', workoutId: 'abs-2' });
    expect(selectStrengthRotationAssignment({
      rhythm: otherRhythm,
      setting: {
        rhythmId: otherRhythm.id,
        mode: 'rotation',
        rotationHistory: [config]
      },
      date: '2026-06-02',
      workouts: [firstLog],
      savedWorkouts,
      completions: [firstCompletion]
    })).toMatchObject({ kind: 'assigned', workoutId: 'abs-1' });
  });

  it('retains the assigned workout through an active session when a rotation is edited', () => {
    const scheduledRhythm = rhythm({
      frequency: 'weekly',
      weekdays: [1, 3, 5],
      weeklyMode: 'select-days'
    });
    const currentVersion = version();
    const result = updateStrengthRhythmMode({
      prior: { rhythmId, mode: 'rotation', rotationHistory: [currentVersion] },
      rhythm: scheduledRhythm,
      mode: 'rotation',
      rotationWorkoutIds: ['abs-2', 'abs-1', 'abs-3'],
      advanceMode: 'each-scheduled-occurrence',
      savedWorkouts,
      workouts: [],
      completions: [],
      activeDraft: {
        id: 'active-session',
        templateId: 'abs-1',
        workoutName: 'Abs 1',
        date: '2026-06-01',
        startedAt: '2026-06-01T10:00:00.000Z',
        timeZone: 'UTC',
        muscleIds: ['abs'],
        sharedWith: [],
        rhythmId,
        rhythmOccurrence: '2026-06-01',
        completionId: 'active-completion',
        currentExerciseIndex: 0,
        currentSetId: 'set-1',
        exercises: []
      },
      asOfDate: '2026-06-01'
    });

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.setting.rotationHistory).toHaveLength(2);
    expect(result.setting.rotationHistory?.[0]?.effectiveUntil).toBe('2026-06-03');
    expect(result.setting.rotationHistory?.[1]).toMatchObject({
      effectiveFrom: '2026-06-03',
      workoutIds: ['abs-2', 'abs-1', 'abs-3'],
      advanceMode: 'each-scheduled-occurrence',
      startIndex: 1
    });
    expect(selectStrengthRotationAssignment({
      rhythm: scheduledRhythm,
      setting: result.setting,
      date: '2026-06-01',
      workouts: [],
      savedWorkouts,
      completions: []
    })).toMatchObject({ kind: 'assigned', workoutId: 'abs-1' });
  });

  it('applies schedule edits after an active draft and starts on the next actual occurrence', () => {
    const schedule: RhythmSchedule = {
      frequency: 'weekly',
      weekdays: [1, 3, 5],
      weeklyMode: 'select-days'
    };
    const scheduledRhythm: RhythmPreview = {
      ...rhythm(schedule),
      scoring: {
        trackingStartDate: '2026-06-01',
        timeZone: 'UTC',
        scheduleHistory: [
          createRhythmSeason(rhythmId, '2026-06-01', { frequency: 'daily' }),
          createRhythmSeason(rhythmId, '2026-06-03', schedule)
        ]
      }
    };
    const currentVersion = version();
    const result = updateStrengthRhythmMode({
      prior: { rhythmId, mode: 'rotation', rotationHistory: [currentVersion] },
      rhythm: scheduledRhythm,
      mode: 'rotation',
      rotationWorkoutIds: ['abs-1', 'abs-2', 'abs-3'],
      advanceMode: 'each-scheduled-occurrence',
      savedWorkouts,
      workouts: [],
      completions: [],
      activeDraft: {
        id: 'active-session',
        templateId: 'abs-1',
        workoutName: 'Abs 1',
        date: '2026-06-01',
        startedAt: '2026-06-01T10:00:00.000Z',
        timeZone: 'UTC',
        muscleIds: ['abs'],
        sharedWith: [],
        rhythmId,
        rhythmOccurrence: '2026-06-01',
        completionId: 'active-completion',
        currentExerciseIndex: 0,
        currentSetId: 'set-1',
        exercises: []
      },
      asOfDate: '2026-06-01',
      scheduleChanged: true
    });

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.setting.rotationHistory).toHaveLength(2);
    expect(result.setting.rotationHistory?.[0]?.effectiveUntil).toBe('2026-06-03');
    expect(selectStrengthRotationAssignment({
      rhythm: scheduledRhythm,
      setting: result.setting,
      date: '2026-06-01',
      workouts: [],
      savedWorkouts,
      completions: []
    })).toMatchObject({ kind: 'assigned', workoutId: 'abs-1' });
    expect(selectStrengthRotationAssignment({
      rhythm: scheduledRhythm,
      setting: result.setting,
      date: '2026-06-03',
      workouts: [],
      savedWorkouts,
      completions: []
    })).toMatchObject({ kind: 'assigned', workoutId: 'abs-1' });
  });

  it('requires two available workouts and exposes an explicit repair state when one is removed', () => {
    const invalid = updateStrengthRhythmMode({
      rhythm: rhythm(),
      mode: 'rotation',
      rotationWorkoutIds: ['abs-1'],
      advanceMode: 'after-completion',
      savedWorkouts,
      workouts: [],
      completions: [],
      asOfDate: '2026-06-01'
    });
    expect(invalid).toMatchObject({ valid: false });

    expect(assignment('2026-06-01', version(), {
      availableWorkouts: savedWorkouts.filter(workout => workout.id !== 'abs-1')
    })).toMatchObject({
      kind: 'repair',
      workoutId: 'abs-1',
      available: false
    });
  });
});
