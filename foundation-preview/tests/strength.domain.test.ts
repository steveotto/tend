import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  createStrengthData,
  createStrengthWorkout,
  deleteStrengthWorkout,
  deleteStrengthWorkoutLog,
  editStrengthWorkout,
  rankStrengthWorkouts,
  saveStrengthWorkoutLog,
  selectStrengthWorkoutHistory,
  selectStrengthMuscleScores,
  selectStrengthScore,
  strengthMuscles,
  strengthWorkoutSuggestions,
  validateStrengthData,
  validateStrengthSettings
} from '../src/domain/strength.ts';
import type { StrengthData, StrengthSavedWorkout } from '../src/domain/strength.ts';

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

describe('Strength selector and command behavior', () => {
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
      expect(selectStrengthMuscleScores(data, date)).toEqual(
        legacyResult('fitnessMuscleScores', data, date)
      );
    }

    const chest = selectStrengthMuscleScores(data, '2026-03-09').find(item => item.id === 'chest')!;
    expect(chest.restDaysRemaining).toBe(0);
    expect(chest.daysUntilDue).toBe(1);
    expect(chest.score).toBe(100);
    expect(selectStrengthMuscleScores(data, '2026-03-08').find(item => item.id === 'abs')?.eligible).toBe(true);
    expect(selectStrengthMuscleScores(data, '2026-03-09').find(item => item.id === 'back')?.historyState).toBe('never-trained');
  });

  it('matches legacy missing-setting, invalid-history, and future-log states', () => {
    const data = syntheticData();
    delete data.settings.muscleIntervals.triceps;
    data.workouts = [
      { id: 'invalid', date: '2026-02-30', muscleIds: ['biceps'] },
      { id: 'future', date: '2026-10-30', muscleIds: ['shoulders'] }
    ];
    for (const date of ['2026-10-22', '2026-10-30']) {
      expect(selectStrengthMuscleScores(data, date)).toEqual(
        legacyResult('fitnessMuscleScores', data, date)
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

  it('keeps empty and unscored groups unavailable rather than fabricating zero', () => {
    const data = syntheticData();
    const scores = selectStrengthMuscleScores(data, '2026-10-22');
    expect(scores).toHaveLength(strengthMuscles.length);
    expect(scores.every(item => item.score === null)).toBe(true);
    expect(selectStrengthScore(scores)).toBeNull();
  });

  it('defines the seven approved source-linked templates with authoritative muscle IDs', () => {
    expect(strengthWorkoutSuggestions.map(({ sourceId, name, muscleIds }) => ({
      sourceId,
      name,
      muscleIds
    }))).toEqual([
      { sourceId: 'strength.upper-body', name: 'Upper Body', muscleIds: ['chest', 'back', 'biceps', 'triceps', 'shoulders'] },
      { sourceId: 'strength.lower-body', name: 'Lower Body', muscleIds: ['quads', 'hamstrings', 'calves'] },
      { sourceId: 'strength.arms', name: 'Arms', muscleIds: ['biceps', 'triceps'] },
      { sourceId: 'strength.back-biceps', name: 'Back & Biceps', muscleIds: ['back', 'biceps'] },
      { sourceId: 'strength.chest-triceps', name: 'Chest & Triceps', muscleIds: ['chest', 'triceps'] },
      { sourceId: 'strength.shoulders-quads', name: 'Shoulders & Quads', muscleIds: ['shoulders', 'quads'] },
      { sourceId: 'strength.arms-shoulders', name: 'Arms & Shoulders', muscleIds: ['biceps', 'triceps', 'shoulders'] }
    ]);
    expect(new Set(strengthWorkoutSuggestions.map(item => item.sourceId)).size).toBe(7);
    expect(strengthWorkoutSuggestions.every(item =>
      item.muscleIds.every(id => strengthMuscles.some(muscle => muscle.id === id))
    )).toBe(true);
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
});
