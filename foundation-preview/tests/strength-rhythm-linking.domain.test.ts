import { describe, expect, it } from 'vitest';
import {
  isPinnedStrengthRotationRepair,
  selectStrengthWorkoutRhythmOptions
} from '../src/domain/strength-rhythm-linking.ts';
import type { RhythmPreview } from '../src/domain/preview-data.ts';
import type { DatedRhythmCompletion } from '../src/domain/rhythm-completion.ts';
import { createRhythmSeason } from '../src/domain/rhythm-seasons.ts';
import { todayRhythms } from '../src/domain/preview-data.ts';
import type {
  StrengthGuidedSessionDraft,
  StrengthSavedWorkout,
  StrengthWorkoutLog
} from '../src/domain/strength.ts';

function rhythm(overrides: Partial<RhythmPreview> = {}): RhythmPreview {
  const source = todayRhythms[0]!;
  return {
    ...source,
    id: 'strength-rhythm',
    title: 'Strength training',
    categoryIds: ['health'],
    primaryFoundationId: 'health-strength',
    healthLogCapability: 'workout',
    schedule: { frequency: 'daily' },
    ...overrides
  };
}

function completion(rhythmId: string, date: string): DatedRhythmCompletion {
  return {
    id: `completion-${rhythmId}-${date}`,
    rhythmId,
    effectiveDate: date,
    localTime: '12:00',
    timeZone: 'UTC',
    completedAt: `${date}T12:00:00.000Z`,
    recordedAt: `${date}T12:00:00.000Z`
  };
}

describe('Strength workout Rhythm selection', () => {
  it('limits suggestions to Strength-linked workout Rhythms and marks the saved-workout match', () => {
    const linked = rhythm();
    const otherFoundation = rhythm({
      id: 'other-foundation-rhythm',
      title: 'Other foundation',
      primaryFoundationId: null,
      secondaryFoundationIds: []
    });
    const nonWorkout = rhythm({
      id: 'non-workout-rhythm',
      title: 'Non-workout',
      healthLogCapability: 'cardio'
    });
    const options = selectStrengthWorkoutRhythmOptions([
      { rhythm: linked, mode: 'specific', workoutId: 'saved-workout' },
      { rhythm: otherFoundation, mode: 'specific', workoutId: 'saved-workout' },
      { rhythm: nonWorkout, mode: 'specific', workoutId: 'saved-workout' }
    ], [], [], '2026-10-22', 'saved-workout');

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({
      rhythm: linked,
      eligible: true,
      suggested: true,
      explicit: false
    });
  });

  it('does not present an ambiguous set as an automatic match and blocks an existing same-date completion', () => {
    const matched = rhythm();
    const other = rhythm({ id: 'other-rhythm', title: 'Another Rhythm' });
    const options = selectStrengthWorkoutRhythmOptions([
      { rhythm: matched, mode: 'specific', workoutId: 'saved-workout' },
      { rhythm: other, mode: 'recommended' }
    ], [], [], '2026-10-22', 'saved-workout');

    expect(options.filter(option => option.eligible)).toHaveLength(2);
    expect(options.map(option => option.suggested)).toEqual([true, false]);

    const completed = selectStrengthWorkoutRhythmOptions(
      [{ rhythm: matched, mode: 'recommended' }],
      [],
      [completion(matched.id, '2026-10-22')],
      '2026-10-22'
    );
    expect(completed[0]).toMatchObject({
      eligible: false,
      reason: 'A completion already exists for this Rhythm on this date.'
    });
  });

  it('evaluates a backdated completion against that date’s Season schedule', () => {
    const id = 'seasonal-strength-rhythm';
    const seasonal = rhythm({
      id,
      schedule: { frequency: 'daily' },
      scoring: {
        trackingStartDate: '2026-10-01',
        timeZone: 'UTC',
        scheduleHistory: [
          createRhythmSeason(id, '2026-10-01', {
            frequency: 'weekly',
            weekdays: [1, 3],
            weeklyMode: 'select-days'
          }),
          createRhythmSeason(id, '2026-10-20', { frequency: 'daily' })
        ]
      }
    });
    const [scheduledDate] = selectStrengthWorkoutRhythmOptions(
      [{ rhythm: seasonal, mode: 'recommended' }],
      [],
      [],
      '2026-10-19'
    );
    const [unscheduledDate] = selectStrengthWorkoutRhythmOptions(
      [{ rhythm: seasonal, mode: 'recommended' }],
      [],
      [],
      '2026-10-18'
    );

    expect(scheduledDate?.eligible).toBe(true);
    expect(unscheduledDate).toMatchObject({
      eligible: false,
      reason: 'This date is not a scheduled occurrence.'
    });
  });

  it('keeps an explicit Tend Rhythm available while marking archived explicit Rhythms unavailable', () => {
    const explicit = rhythm({
      id: 'explicit-rhythm',
      primaryFoundationId: null,
      secondaryFoundationIds: []
    });
    const activeOption = selectStrengthWorkoutRhythmOptions(
      [{ rhythm: explicit, mode: 'custom' }],
      [],
      [],
      '2026-10-22',
      undefined,
      explicit.id
    );
    const archivedOption = selectStrengthWorkoutRhythmOptions(
      [],
      [explicit],
      [],
      '2026-10-22',
      undefined,
      explicit.id
    );

    expect(activeOption[0]).toMatchObject({ eligible: true, explicit: true });
    expect(archivedOption[0]).toMatchObject({
      eligible: false,
      explicit: true,
      reason: 'Restore this Rhythm before linking a workout.'
    });
  });

  it('does not offer an explicit association when the Rhythm is not a workout Rhythm', () => {
    const cardio = rhythm({
      healthLogCapability: 'cardio',
      primaryFoundationId: null,
      secondaryFoundationIds: []
    });
    expect(selectStrengthWorkoutRhythmOptions(
      [{ rhythm: cardio, mode: 'custom' }],
      [],
      [],
      '2026-10-22',
      undefined,
      cardio.id
    )).toEqual([]);
  });

  it('allows only an active session to keep its pinned workout when that template is unavailable', () => {
    const linked = rhythm();
    const savedWorkouts: StrengthSavedWorkout[] = [{
      id: 'available-workout',
      name: 'Available workout',
      muscleIds: ['abs'],
      sharedWith: []
    }];
    const setting = {
      rhythm: linked,
      mode: 'rotation' as const,
      rotationHistory: [{
        effectiveFrom: '2026-10-22',
        workoutIds: ['deleted-workout', 'available-workout'],
        workoutNames: ['Deleted workout', 'Available workout'],
        advanceMode: 'after-completion' as const,
        startIndex: 0
      }]
    };

    expect(selectStrengthWorkoutRhythmOptions(
      [setting], [], [], '2026-10-22', 'deleted-workout', linked.id, [], savedWorkouts
    )[0]).toMatchObject({
      eligible: false,
      reason: '“Deleted workout” is unavailable. Edit this Rhythm’s rotation to repair it.'
    });
    expect(selectStrengthWorkoutRhythmOptions(
      [setting], [], [], '2026-10-22', 'deleted-workout', linked.id, [], savedWorkouts, linked.id
    )[0]).toMatchObject({ eligible: true });
    expect(selectStrengthWorkoutRhythmOptions(
      [setting], [], [], '2026-10-22', 'available-workout', linked.id, [], savedWorkouts, linked.id
    )[0]).toMatchObject({
      eligible: false,
      reason: '“Deleted workout” is unavailable. Edit this Rhythm’s rotation to repair it.'
    });
    expect(selectStrengthWorkoutRhythmOptions(
      [setting], [], [completion(linked.id, '2026-10-22')],
      '2026-10-22', 'deleted-workout', linked.id, [], savedWorkouts, linked.id
    )[0]).toMatchObject({
      eligible: false,
      reason: 'A completion already exists for this Rhythm on this date.'
    });
  });

  it('accepts a deleted template only for the exact active session completion', () => {
    const repair = {
      kind: 'repair' as const,
      workoutId: 'deleted-workout',
      workoutName: 'Deleted workout',
      rotationIndex: 0,
      available: false as const,
      reason: 'Repair this rotation.'
    };
    const log: StrengthWorkoutLog = {
      id: 'completed-session',
      date: '2026-10-22',
      muscleIds: ['abs'],
      savedWorkoutId: 'deleted-workout',
      rhythmId: 'strength-rhythm',
      rhythmOccurrence: '2026-10-22',
      completionId: 'session-completion'
    };
    const activeDraft: StrengthGuidedSessionDraft = {
      id: 'active-session',
      templateId: 'deleted-workout',
      workoutName: 'Deleted workout',
      date: '2026-10-22',
      startedAt: '2026-10-22T10:00:00.000Z',
      timeZone: 'UTC',
      muscleIds: ['abs'],
      sharedWith: [],
      rhythmId: 'strength-rhythm',
      rhythmOccurrence: '2026-10-22',
      completionId: 'session-completion',
      currentExerciseIndex: 0,
      currentSetId: 'set-1',
      exercises: []
    };

    expect(isPinnedStrengthRotationRepair(repair, log, activeDraft)).toBe(true);
    expect(isPinnedStrengthRotationRepair(repair, log)).toBe(false);
    expect(isPinnedStrengthRotationRepair(repair, {
      ...log,
      completionId: 'different-completion'
    }, activeDraft)).toBe(false);
    expect(isPinnedStrengthRotationRepair(repair, {
      ...log,
      savedWorkoutId: 'different-workout'
    }, activeDraft)).toBe(false);
  });
});
