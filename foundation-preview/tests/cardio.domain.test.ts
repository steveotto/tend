import { describe, expect, it } from 'vitest';
import {
  cardioDataIssues,
  cardioWeekStart,
  createCardioData,
  deleteCardioRun,
  parseCardioGoalInput,
  saveCardioDataCommand,
  saveCardioGoals,
  saveCardioRun,
  selectCardioProgress,
  stepCardioGoalInput,
  validatedCardioRuns,
  validateCardioGoals
} from '../src/domain/cardio.ts';
import type { CardioData, CardioRun } from '../src/domain/cardio.ts';
import type { RhythmPreview } from '../src/domain/preview-data.ts';
import { todayRhythms } from '../src/domain/preview-data.ts';
import { prepareDatedRhythmCompletion } from '../src/domain/rhythm-completion.ts';
import type { DatedRhythmCompletion } from '../src/domain/rhythm-completion.ts';
import { createRhythmSeason } from '../src/domain/rhythm-seasons.ts';
import { createRhythmDraft, validateRhythmDraft } from '../src/domain/rhythm-editor.ts';

const today = '2026-10-22';

function rhythm(schedule: RhythmPreview['schedule'] = { frequency: 'daily' }): RhythmPreview {
  const source = todayRhythms[0]!;
  const { scoring: _scoring, completionHistory: _history, ...base } = source;
  return {
    ...base,
    id: 'cardio-rhythm',
    title: 'Run day',
    categoryIds: ['health'],
    schedule,
    healthLogCapability: 'cardio',
    completionHistory: []
  };
}

function run(overrides: Partial<CardioRun> = {}): CardioRun {
  return {
    id: 'run-1',
    date: today,
    distance: 3,
    ...overrides
  };
}

function completion(
  id: string,
  date: string,
  rhythmId = 'cardio-rhythm',
  memory = 'Keep this note'
): DatedRhythmCompletion {
  const result = prepareDatedRhythmCompletion({
    id,
    rhythmId,
    effectiveDate: date,
    hour: 9,
    minute: 0,
    period: 'AM',
    timeZone: 'UTC',
    memory
  }, new Date('2026-10-22T17:20:00.000Z'));
  if (!result.valid) throw new Error('test completion fixture is invalid');
  return result.record;
}

function command(
  previous: CardioData,
  next: CardioData,
  options: {
    rhythms?: readonly RhythmPreview[];
    completions?: DatedRhythmCompletion[];
    today?: string;
    archived?: ReadonlySet<string>;
  } = {}
) {
  return saveCardioDataCommand({
    previous,
    next,
    today: options.today ?? today,
    now: new Date('2026-10-22T17:20:00.000Z'),
    rhythms: options.rhythms ?? [rhythm()],
    archivedRhythmIds: options.archived ?? new Set(),
    editableRhythmIds: new Set(['cardio-rhythm']),
    completionState: {
      datedRhythmCompletions: options.completions ?? [],
      activeRhythmCompletions: [],
      completedRhythmIds: [],
      rhythmHistoryIds: []
    }
  });
}

describe('Cardio domain', () => {
  it('accepts an explicit Cardio logging capability only for a Health & Fitness Rhythm', () => {
    const cardioDraft = createRhythmDraft(['health']);
    cardioDraft.title = 'Run logging';
    cardioDraft.healthLogCapability = 'cardio';
    expect(validateRhythmDraft(cardioDraft)).toEqual({});

    cardioDraft.categoryIds = ['marriage'];
    expect(validateRhythmDraft(cardioDraft).categoryIds)
      .toContain('Health & Fitness category');
  });

  it('keeps current run and mileage percentages unrounded and caps only progress', () => {
    const goals = { weeklyRunTarget: 2, weeklyMileTarget: 8 };
    const oneRun: CardioData = { ...createCardioData(), goals, runs: [run({ distance: 3 })] };
    expect(selectCardioProgress(oneRun, today)).toMatchObject({
      runs: 1, miles: 3, runProgress: 50, mileageProgress: 37.5,
      score: 37.5, remainingRuns: 1, remainingMiles: 5
    });

    const twoRuns: CardioData = {
      ...oneRun,
      runs: [run({ id: 'run-a', distance: 3 }), run({ id: 'run-b', distance: 5 })]
    };
    expect(selectCardioProgress(twoRuns, today)).toMatchObject({
      runs: 2, miles: 8, runProgress: 100, mileageProgress: 100, score: 100
    });

    const beyond: CardioData = {
      ...twoRuns,
      runs: [...twoRuns.runs, run({ id: 'run-c', distance: 2 })]
    };
    expect(selectCardioProgress(beyond, today)).toMatchObject({
      runs: 3, miles: 10, runProgress: 100, mileageProgress: 100,
      score: 100, remainingRuns: 0, remainingMiles: 0
    });
  });

  it('blends four completed Cardio weeks with current-week progress without rounding', () => {
    const data: CardioData = {
      ...createCardioData(),
      goals: { weeklyRunTarget: 2, weeklyMileTarget: 8 },
      trackingStartDate: '2026-09-01',
      targetHistory: [{
        effectiveDate: '2026-09-01',
        weeklyRunTarget: 2,
        weeklyMileTarget: 8
      }],
      runs: [
        run({ id: 'week-1-a', date: '2026-09-23', distance: 4 }),
        run({ id: 'week-1-b', date: '2026-09-25', distance: 4 }),
        run({ id: 'week-2-a', date: '2026-09-30', distance: 4 }),
        run({ id: 'week-2-b', date: '2026-10-02', distance: 4 }),
        run({ id: 'week-3-a', date: '2026-10-07', distance: 4 }),
        run({ id: 'current-week-a', date: '2026-10-22', distance: 4 })
      ]
    };

    expect(selectCardioProgress(data, today)).toMatchObject({
      consistency: 62.5,
      score: 50,
      health: 59.375,
      eligibleConsistencyWeeks: 4,
      weekStart: '2026-10-19',
      weekEnd: '2026-10-25'
    });
  });

  it('excludes the current partial week, pre-tracking weeks, and weeks with unknown target history', () => {
    const untracked = {
      ...createCardioData(),
      goals: { weeklyRunTarget: 2, weeklyMileTarget: 8 },
      runs: [run({ date: '2026-10-22', distance: 4 })]
    };
    expect(selectCardioProgress(untracked, today)).toMatchObject({
      consistency: null,
      score: 50,
      health: null,
      eligibleConsistencyWeeks: 0
    });

    const changedMidweek: CardioData = {
      ...untracked,
      trackingStartDate: '2026-09-01',
      targetHistory: [
        { effectiveDate: '2026-09-01', weeklyRunTarget: 2, weeklyMileTarget: 8 },
        { effectiveDate: '2026-10-14', weeklyRunTarget: 3, weeklyMileTarget: 10 }
      ]
    };
    expect(selectCardioProgress(changedMidweek, today).eligibleConsistencyWeeks).toBe(3);
  });

  it('distinguishes valid zero progress from unavailable or invalid goals', () => {
    const noRuns: CardioData = { ...createCardioData(), goals: { weeklyRunTarget: 2, weeklyMileTarget: 8 } };
    expect(selectCardioProgress(noRuns, today)).toMatchObject({
      runs: 0, miles: 0, runProgress: 0, mileageProgress: 0, score: 0
    });
    expect(selectCardioProgress(createCardioData(), today)).toMatchObject({
      runs: 0, miles: 0, runProgress: null, mileageProgress: null, score: null
    });
    expect(validateCardioGoals({ weeklyRunTarget: 0, weeklyMileTarget: 8 })).toContain('positive weekly target');
    expect(validateCardioGoals({ weeklyRunTarget: 2, weeklyMileTarget: null })).toContain('both');
    expect(validateCardioGoals({ weeklyRunTarget: null, weeklyMileTarget: null })).toBeNull();
    expect(saveCardioGoals(noRuns, { weeklyRunTarget: null, weeklyMileTarget: null }, today).goals)
      .toEqual({ weeklyRunTarget: null, weeklyMileTarget: null });
    expect(selectCardioProgress({
      ...noRuns,
      goals: { weeklyRunTarget: 2, weeklyMileTarget: 0 }
    }, today).score).toBeNull();
  });

  it('steps blank and fractional weekly targets without crossing their valid bounds', () => {
    expect(parseCardioGoalInput('')).toBeNull();
    expect(parseCardioGoalInput('0')).toBe(0);
    expect(parseCardioGoalInput('8.5')).toBe(8.5);
    expect(stepCardioGoalInput('', 1, 'runs')).toBe('1');
    expect(stepCardioGoalInput('', -1, 'runs')).toBe('');
    expect(stepCardioGoalInput('1', -1, 'runs')).toBe('1');
    expect(stepCardioGoalInput('21', 1, 'runs')).toBe('21');
    expect(stepCardioGoalInput('', 1, 'miles')).toBe('0.1');
    expect(stepCardioGoalInput('8.5', 1, 'miles')).toBe('8.6');
    expect(stepCardioGoalInput('0.1', -1, 'miles')).toBe('0.1');
    expect(validateCardioGoals({ weeklyRunTarget: 2, weeklyMileTarget: 8.5 })).toBeNull();
  });

  it('uses explicit date-only Monday–Sunday boundaries across month, year, and DST dates', () => {
    expect(cardioWeekStart('2026-10-18')).toBe('2026-10-12');
    expect(cardioWeekStart('2026-10-19')).toBe('2026-10-19');
    expect(cardioWeekStart('2027-01-03')).toBe('2026-12-28');
    expect(cardioWeekStart('2026-03-08')).toBe('2026-03-02');
    expect(cardioWeekStart('2026-03-09')).toBe('2026-03-09');

    const data: CardioData = {
      ...createCardioData(),
      goals: { weeklyRunTarget: 2, weeklyMileTarget: 8 },
      runs: [
        run({ id: 'sunday-before', date: '2026-10-18', distance: 9 }),
        run({ id: 'monday', date: '2026-10-19', distance: 3 }),
        run({ id: 'sunday', date: '2026-10-25', distance: 5 })
      ]
    };
    expect(selectCardioProgress(data, '2026-10-22')).toMatchObject({ weekStart: '2026-10-19', runs: 1, miles: 3 });
    expect(selectCardioProgress(data, '2026-10-25')).toMatchObject({ weekStart: '2026-10-19', runs: 2, miles: 8 });
  });

  it('keeps multiple same-date runs and excludes invalid, duplicate-ID, and future evidence without dropping raw records', () => {
    const malformed = { id: 'invalid-distance', date: today, distance: 0, unknown: true };
    const future = { id: 'future', date: '2026-10-23', distance: 5 };
    const invalidDate = { id: 'bad-date', date: '2026-02-30', distance: 4 };
    const duplicateOne = { id: 'duplicate', date: today, distance: 2 };
    const duplicateTwo = { id: 'duplicate', date: today, distance: 4 };
    const data: CardioData = {
      ...createCardioData(),
      goals: { weeklyRunTarget: 2, weeklyMileTarget: 8 },
      runs: [
        malformed, future, invalidDate, duplicateOne, duplicateTwo,
        run({ id: 'same-day-a', distance: 2 }), run({ id: 'same-day-b', distance: 3 })
      ]
    };
    const result = validatedCardioRuns(data, today);
    expect(result.records.map(item => item.id)).toEqual(['same-day-a', 'same-day-b']);
    expect(result.issues.join(' ')).toContain('future-dated');
    expect(result.issues.join(' ')).toContain('invalid fields');
    expect(result.issues.join(' ')).toContain('duplicated');
    expect(selectCardioProgress(data, today)).toMatchObject({
      runs: 2, miles: 5, days: expect.arrayContaining([expect.objectContaining({ date: today, count: 2, miles: 5 })])
    });
    expect(data.runs[0]).toBe(malformed);
    expect(data.runs[1]).toBe(future);
    expect(cardioDataIssues(data, today).length).toBeGreaterThan(0);
  });

  it('adds, edits by stable ID, changes activity dates, and deletes only the selected run', () => {
    const first = saveCardioRun(createCardioData(), run({ id: 'stable', date: '2026-10-19', distance: 3 }), today);
    expect(first.valid).toBe(true);
    if (!first.valid) return;
    const edited = saveCardioRun(first.data, run({ id: 'stable', date: '2026-10-20', distance: 4 }), today);
    expect(edited.valid).toBe(true);
    if (!edited.valid) return;
    expect(edited.data.runs).toHaveLength(1);
    expect(selectCardioProgress(edited.data, '2026-10-20').miles).toBe(4);
    expect(saveCardioRun(edited.data, run({ id: 'future', date: '2026-10-23' }), today)).toMatchObject({ valid: false });
    expect(saveCardioRun(edited.data, run({ id: 'bad-distance', distance: Number.NaN }), today)).toMatchObject({ valid: false });
    expect(deleteCardioRun(edited.data, 'stable').deleted?.id).toBe('stable');
    expect(deleteCardioRun(edited.data, 'stable').data.runs).toEqual([]);
  });

  it('resolves Cardio logging through the selected date schedule and season, including backfill', () => {
    const seasonal = {
      ...rhythm(),
      scoring: {
        trackingStartDate: '2026-10-01',
        timeZone: 'UTC',
        scheduleHistory: [
          createRhythmSeason('cardio-rhythm', '2026-10-01', {
            frequency: 'weekly', weekdays: [1], weeklyMode: 'select-days'
          }, undefined, undefined, 'fern')
        ]
      }
    };
    expect(command(createCardioData(), {
      ...createCardioData(),
      runs: [run({
        date: '2026-10-19',
        rhythmId: 'cardio-rhythm',
        rhythmOccurrence: '2026-10-19',
        completionId: 'backfill-credit'
      })]
    }, { rhythms: [seasonal] })).toMatchObject({ valid: true });

    const wrongDay = command(createCardioData(), {
      ...createCardioData(),
      runs: [run({
        date: '2026-10-20',
        rhythmId: 'cardio-rhythm',
        rhythmOccurrence: '2026-10-20',
        completionId: 'wrong-day-credit'
      })]
    }, { rhythms: [seasonal] });
    expect(wrongDay).toMatchObject({ valid: false, error: expect.stringContaining('not a scheduled occurrence') });
    expect(command(createCardioData(), {
      ...createCardioData(),
      runs: [run({
        date: '2026-10-20',
        rhythmId: 'cardio-rhythm',
        rhythmOccurrence: '2026-10-20',
        completionId: 'archived-credit'
      })]
    }, { archived: new Set(['cardio-rhythm']) })).toMatchObject({ valid: false });
  });

  it('creates one owned completion, retains its note on date edits, and unlinks/deletes only owned credit', () => {
    const rhythmRecord = rhythm();
    const linked = run({
      rhythmId: rhythmRecord.id,
      rhythmOccurrence: today,
      completionId: 'owned-credit'
    });
    const initial = command(createCardioData(), { ...createCardioData(), runs: [linked] });
    expect(initial.valid).toBe(true);
    if (!initial.valid) return;
    expect(initial.completionState.datedRhythmCompletions).toHaveLength(1);
    expect(initial.completionState.completedRhythmIds).toEqual([rhythmRecord.id]);

    const unrelated = completion('unrelated-credit', today, rhythmRecord.id, 'Other activity');
    const owned = completion('owned-credit', today);
    const previous: CardioData = { ...createCardioData(), runs: [linked] };
    const changedRun = { ...linked, date: '2026-10-21', rhythmOccurrence: '2026-10-21' };
    const updated = command(previous, { ...previous, runs: [changedRun] }, {
      completions: [owned, unrelated]
    });
    expect(updated.valid).toBe(true);
    if (!updated.valid) return;
    expect(updated.completionState.datedRhythmCompletions).toHaveLength(2);
    expect(updated.completionState.datedRhythmCompletions.find(item => item.id === 'owned-credit'))
      .toMatchObject({ effectiveDate: '2026-10-21', memory: 'Keep this note' });
    expect(updated.completionState.datedRhythmCompletions.find(item => item.id === 'unrelated-credit')).toEqual(unrelated);

    const unlinked = command(previous, { ...previous, runs: [{ id: linked.id, date: linked.date, distance: linked.distance }] }, {
      completions: [owned, unrelated]
    });
    expect(unlinked.valid).toBe(true);
    if (unlinked.valid) {
      expect(unlinked.completionState.datedRhythmCompletions.map(item => item.id)).toEqual(['unrelated-credit']);
    }
    const deleted = command(previous, { ...previous, runs: [] }, { completions: [owned, unrelated] });
    expect(deleted.valid).toBe(true);
    if (deleted.valid) expect(deleted.completionState.datedRhythmCompletions.map(item => item.id)).toEqual(['unrelated-credit']);
  });

  it('blocks duplicate occurrence credit, foreign completion ownership, and repeated linked runs', () => {
    const linked = run({
      rhythmId: 'cardio-rhythm',
      rhythmOccurrence: today,
      completionId: 'credit-1'
    });
    const duplicate = completion('other-credit', today);
    expect(command(createCardioData(), { ...createCardioData(), runs: [linked] }, {
      completions: [duplicate]
    })).toMatchObject({ valid: false, error: expect.stringContaining('already has completion credit') });

    const foreign = completion('credit-1', today);
    const foreignOwner = { ...foreign, rhythmId: 'someone-else' };
    expect(command(createCardioData(), { ...createCardioData(), runs: [linked] }, {
      completions: [foreignOwner]
    })).toMatchObject({ valid: false, error: expect.stringContaining('owned by another activity') });

    const duplicateRuns = {
      ...createCardioData(),
      runs: [linked, { ...linked, id: 'run-2' }]
    };
    expect(command(createCardioData(), duplicateRuns)).toMatchObject({ valid: false });
  });
});
