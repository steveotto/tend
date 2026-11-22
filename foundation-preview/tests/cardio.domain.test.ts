import { describe, expect, it } from 'vitest';
import {
  cardioDataIssues,
  cardioDistanceFromMiles,
  cardioDistanceToMiles,
  cardioRunCalorieEstimate,
  cardioPaceSecondsPerUnit,
  cardioWeekStart,
  createCardioData,
  deleteCardioRun,
  estimateCardioCalories,
  formatCardioPace,
  formatCardioWeekRange,
  formatCardioWeekdayRange,
  isCardioRun,
  latestCardioWeightOnOrBefore,
  migrateCardioDataToV52,
  parseCardioGoalInput,
  parseCardioRunDuration,
  saveCardioDataCommand,
  saveCardioGoals,
  saveCardioRun,
  selectCardioRunTotals,
  selectCardioRunComparisons,
  selectCardioProgress,
  stepCardioGoalInput,
  validatedCardioRuns,
  validateCardioGoals
} from '../src/domain/cardio.ts';
import type { CardioData, CardioRun } from '../src/domain/cardio.ts';
import type { RhythmPreview } from '../src/domain/preview-data.ts';
import { todayRhythms } from '../src/domain/preview-data.ts';
import {
  createEmptyPreviewData,
  createPreviewEnvelope,
  createSamplePreviewData,
  parsePreviewBackup
} from '../src/domain/preview-state.ts';
import { prepareDatedRhythmCompletion } from '../src/domain/rhythm-completion.ts';
import type { DatedRhythmCompletion } from '../src/domain/rhythm-completion.ts';
import { createWeightData } from '../src/domain/weight.ts';
import type { WeightData } from '../src/domain/weight.ts';
import {
  selectFoundationRhythmScores,
  selectFoundationScore
} from '../src/domain/foundation-scoring.ts';
import {
  createRhythmDraft,
  resolveTodayRhythms,
  saveRhythmDraft,
  updateRhythmDraftFitnessActivity,
  validateRhythmDraft
} from '../src/domain/rhythm-editor.ts';
import { createRhythmSeason } from '../src/domain/rhythm-seasons.ts';
import { prepareCompletionHistory } from '../src/domain/rhythm-history.ts';
import { localDateTimeInZone } from '../src/domain/rhythm-completion.ts';
import { isRhythmRelevantOnDate } from '../src/domain/category-rhythms.ts';

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
  it.each([
    { runKind: 'existing', linkDescription: 'existing run' },
    { runKind: 'new', linkDescription: 'new run' }
  ] as const)(
    'scores a same-day Saturday Morning Run Rhythm after linking the $linkDescription and preserves its history lifecycle',
    ({ runKind }) => {
      const date = '2026-11-21';
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const now = localDateTimeInZone(date, '20:48', timeZone);
      const rhythmId = 'user-rhythm-11111111-1111-4111-8111-111111111111';
      const draft = updateRhythmDraftFitnessActivity(createRhythmDraft(['health']), 'cardio');
      const created = saveRhythmDraft([], {
        ...draft,
        title: 'Saturday run',
        timeLabel: 'Morning',
        schedule: { frequency: 'weekly', weekdays: [6], weeklyMode: 'select-days' },
        scheduleEditing: true
      }, rhythmId, 'create', {
        currentDate: date,
        deviceTimeZone: timeZone,
        createdLocalTime: '20:48',
        createdDueTime: '09:00'
      });
      expect(created.errors).toEqual({});
      expect(created.savedRhythms?.[0]).toMatchObject({
        timeOfDay: 'morning',
        createdLocalDate: date,
        createdLocalTime: '20:48',
        createdDueTime: '09:00',
        scoring: { trackingStartDate: date }
      });
      const rhythm = resolveTodayRhythms(created.savedRhythms ?? [])
        .find(item => item.id === rhythmId);
      expect(rhythm).toBeDefined();
      if (!rhythm) throw new Error('The saved Saturday Rhythm was not resolved.');
      expect(isRhythmRelevantOnDate(rhythm, date)).toBe(true);

      const score = (
        rhythmToScore: typeof rhythm = rhythm,
        records: typeof rhythmToScore.completionHistory = rhythmToScore.completionHistory
      ) => {
        const scoreRhythm = records === undefined
          ? rhythmToScore
          : { ...rhythmToScore, completionHistory: records };
        return selectFoundationRhythmScores(
          [scoreRhythm],
          [],
          new Set([rhythmId]),
          now,
          timeZone
        ).get(rhythmId);
      };
      expect(score()).toMatchObject({
        kind: 'unscored',
        reason: { reasonCode: 'not-started', explanation: 'This Rhythm’s tracking date is in the future.' },
        healthScore: null
      });

      const runId = 'existing-saturday-run';
      const completionId = 'completion-saturday-run';
      const unlinkedRun = run({ id: runId, date });
      const previous = {
        ...createCardioData(),
        runs: runKind === 'existing' ? [unlinkedRun] : []
      };
      const savedRun = saveCardioRun(previous, {
        ...unlinkedRun,
        rhythmId,
        rhythmOccurrence: date,
        completionId
      }, date);
      expect(savedRun.valid).toBe(true);
      if (!savedRun.valid) throw new Error(savedRun.error);

      const linked = saveCardioDataCommand({
        previous,
        next: savedRun.data,
        today: date,
        now,
        rhythms: [rhythm],
        archivedRhythmIds: new Set(),
        editableRhythmIds: new Set([rhythmId]),
        completionState: {
          datedRhythmCompletions: [],
          activeRhythmCompletions: [],
          completedRhythmIds: [],
          rhythmHistoryIds: []
        }
      });
      expect(linked.valid).toBe(true);
      if (!linked.valid) throw new Error(linked.error);
      expect(linked.completionState).toMatchObject({
        datedRhythmCompletions: [{ id: completionId, rhythmId, effectiveDate: date }],
        activeRhythmCompletions: [{ rhythmId, completionId }],
        completedRhythmIds: [rhythmId],
        rhythmHistoryIds: [rhythmId]
      });

      const linkedRhythm = { ...rhythm, completionHistory: linked.completionState.datedRhythmCompletions };
      const linkedScore = score(linkedRhythm, linkedRhythm.completionHistory);
      if (!linkedScore) throw new Error('The linked Run Rhythm has no score result.');
      expect(linkedScore).toMatchObject({
        kind: 'rhythm-score',
        trackingStartDate: date,
        consistency: { kind: 'scored', evidence: { completedCount: 1 } }
      });
      expect(linkedScore.healthScore).not.toBeNull();
      expect(selectFoundationScore(
        'health-cardio',
        [linkedRhythm],
        new Map([[rhythmId, linkedScore]]),
        []
      )).toMatchObject({
        eligibleRhythmIds: [rhythmId],
        health: expect.any(Number)
      });
      expect(prepareCompletionHistory(linkedRhythm.completionHistory, date)).toMatchObject({
        kind: 'recorded',
        count: 1,
        firstDate: date,
        lastDate: date,
        dailyCounts: [{ date, count: 1 }]
      });

      const duplicate = saveCardioRun(linked.cardio, {
        ...run({ id: 'duplicate-saturday-run', date }),
        rhythmId,
        rhythmOccurrence: date,
        completionId: 'completion-duplicate-saturday-run'
      }, date);
      expect(duplicate).toMatchObject({
        valid: false,
        error: 'An activity is already linked to this scheduled Rhythm occurrence.'
      });

      const unlinked = saveCardioRun(linked.cardio, unlinkedRun, date);
      expect(unlinked.valid).toBe(true);
      if (!unlinked.valid) throw new Error(unlinked.error);
      const undone = saveCardioDataCommand({
        previous: linked.cardio,
        next: unlinked.data,
        today: date,
        now,
        rhythms: [rhythm],
        archivedRhythmIds: new Set(),
        editableRhythmIds: new Set([rhythmId]),
        completionState: linked.completionState
      });
      expect(undone).toMatchObject({
        valid: true,
        completionState: {
          datedRhythmCompletions: [],
          activeRhythmCompletions: [],
          completedRhythmIds: [],
          rhythmHistoryIds: [rhythmId]
        }
      });
      if (!undone.valid) throw new Error(undone.error);
      expect(score()).toMatchObject({
        kind: 'unscored',
        reason: { reasonCode: 'not-started' },
        healthScore: null
      });

      const persisted = createEmptyPreviewData();
      persisted.savedRhythms = created.savedRhythms ?? [];
      persisted.cardio = linked.cardio;
      persisted.datedRhythmCompletions = linked.completionState.datedRhythmCompletions;
      persisted.activeRhythmCompletions = linked.completionState.activeRhythmCompletions;
      persisted.completedRhythmIds = linked.completionState.completedRhythmIds;
      persisted.rhythmHistoryIds = linked.completionState.rhythmHistoryIds;
      const reloaded = parsePreviewBackup(
        JSON.stringify(createPreviewEnvelope(persisted)),
        date
      );
      expect(reloaded.valid).toBe(true);
      if (!reloaded.valid) throw new Error(reloaded.message);
      const restoredRhythm = resolveTodayRhythms(reloaded.envelope.data.savedRhythms)
        .find(item => item.id === rhythmId);
      const restoredRecords = reloaded.envelope.data.datedRhythmCompletions
        .filter(record => record.rhythmId === rhythmId);
      expect(restoredRhythm).toBeDefined();
      if (!restoredRhythm) throw new Error('The saved Saturday Rhythm was lost after reload.');
      expect(reloaded.envelope.data.cardio.runs).toContainEqual(linked.cardio.runs[0]);
      expect(score(restoredRhythm, restoredRecords)).toMatchObject({
        kind: 'rhythm-score',
        trackingStartDate: date,
        consistency: { kind: 'scored', evidence: { completedCount: 1 } }
      });
      expect(prepareCompletionHistory(restoredRecords, date)).toMatchObject({
        kind: 'recorded',
        count: 1,
        dailyCounts: [{ date, count: 1 }]
      });
    }
  );

  it('accepts an explicit Cardio logging capability only for a Health & Fitness Rhythm', () => {
    const cardioDraft = createRhythmDraft(['health']);
    cardioDraft.title = 'Run logging';
    cardioDraft.primaryFoundationId = 'health-cardio';
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

  it('gives a qualifying Rhythm-linked run the same single Cardio credit as a direct run', () => {
    const data: CardioData = {
      ...createCardioData(),
      goals: { weeklyRunTarget: 2, weeklyMileTarget: 8 }
    };
    const direct = saveCardioRun(data, run({ id: 'direct-entry' }), today);
    const linked = saveCardioRun(data, run({
      id: 'rhythm-entry',
      rhythmId: 'cardio-rhythm',
      rhythmOccurrence: today,
      completionId: 'completion-from-run'
    }), today);

    expect(direct.valid).toBe(true);
    expect(linked.valid).toBe(true);
    if (!direct.valid || !linked.valid) return;
    expect(selectCardioProgress(direct.data, today)).toMatchObject({ runs: 1, miles: 3, score: 37.5 });
    expect(selectCardioProgress(linked.data, today)).toMatchObject({ runs: 1, miles: 3, score: 37.5 });

    const rhythmCompletedWithoutRun = {
      ...data,
      runs: [...data.runs]
    };
    expect(selectCardioProgress(rhythmCompletedWithoutRun, today))
      .toMatchObject({ runs: 0, miles: 0, score: 0 });
  });

  it('does not add Cardio credit for a Rhythm completion without a saved run', () => {
    const data: CardioData = {
      ...createCardioData(),
      goals: { weeklyRunTarget: 2, weeklyMileTarget: 8 }
    };
    const before = selectCardioProgress(data, today);
    const result = command(data, data, { completions: [completion('completion-only', today)] });

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.completionState.datedRhythmCompletions).toHaveLength(1);
    expect(result.cardio.runs).toEqual([]);
    expect(selectCardioProgress(result.cardio, today)).toEqual(before);
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

  it('parses optional durations and calculates pace in miles or kilometers without inventing invalid results', () => {
    expect(parseCardioRunDuration('', '', '')).toEqual({ valid: true, durationSeconds: null });
    expect(parseCardioRunDuration('1', '02', '03')).toEqual({ valid: true, durationSeconds: 3723 });
    expect(parseCardioRunDuration('', '60', '0').valid).toBe(false);
    expect(parseCardioRunDuration('', '0', '0').valid).toBe(false);
    expect(cardioPaceSecondsPerUnit(2700, 6)).toBe(450);
    expect(cardioPaceSecondsPerUnit(3600, 10)).toBe(360);
    expect(cardioPaceSecondsPerUnit(null, 10)).toBeNull();
    expect(cardioPaceSecondsPerUnit(0, 10)).toBeNull();
    expect(cardioPaceSecondsPerUnit(3600, 0)).toBeNull();
    expect(cardioPaceSecondsPerUnit(3600, Number.NaN)).toBeNull();
    expect(cardioDistanceFromMiles(cardioDistanceToMiles(10, 'km'), 'km')).toBeCloseTo(10, 10);
  });

  it('estimates gross calories from a weight snapshot and formats pace without false precision', () => {
    expect(estimateCardioCalories(70, 5)).toBe(563);
    expect(estimateCardioCalories(0, 5)).toBeNull();
    expect(estimateCardioCalories(70, Number.NaN)).toBeNull();
    expect(formatCardioPace(480, 'mi')).toBe('8:00/mi');
    expect(formatCardioPace(360, 'km')).toBe('6:00/km');
    expect(formatCardioPace(null, 'mi')).toBe('—');
  });

  it('selects only the latest valid weigh-in on or before a run date', () => {
    const weight: WeightData = {
      ...createWeightData(),
      weighIns: [
        { id: 'weight-before', date: '2026-10-19', weightKg: 70 },
        { id: 'weight-after', date: '2026-10-21', weightKg: 72 },
        { id: 'weight-future', date: '2026-10-23', weightKg: 80 }
      ]
    };

    expect(latestCardioWeightOnOrBefore(weight, '2026-10-20', today))
      .toMatchObject({ id: 'weight-before', weightKg: 70 });
    expect(latestCardioWeightOnOrBefore(weight, '2026-10-18', today)).toBeNull();
    expect(latestCardioWeightOnOrBefore(weight, '2026-10-23', today)).toBeNull();
  });

  it('snapshots historical estimates during migration and keeps them stable after weigh-in edits', () => {
    const weight: WeightData = {
      ...createWeightData(),
      weighIns: [
        { id: 'weight-70', date: '2026-10-19', weightKg: 70 },
        { id: 'weight-72', date: '2026-10-21', weightKg: 72 }
      ]
    };
    const cardio: CardioData = {
      ...createCardioData(),
      runs: [
        run({ id: 'historical-with-weight', date: '2026-10-20', distance: 5 }),
        { id: 'historical-without-weight', date: '2026-10-18', distance: 3 },
        { id: 'invalid-preserved', date: '2026-10-20', distance: 0 }
      ]
    };
    const migrated = migrateCardioDataToV52(cardio, weight);
    const snapshot = migrated.runs[0] as CardioRun;
    expect(snapshot.calorieEstimate).toMatchObject({
      source: 'estimated',
      method: 'distance-weight-v1',
      weightKg: 70,
      weightSource: 'weigh-in',
      weightDate: '2026-10-19',
      weightMeasurementId: 'weight-70'
    });
    expect(migrated.runs[1]).toEqual(cardio.runs[1]);
    expect(migrated.runs[2]).toBe(cardio.runs[2]);
    expect(cardioRunCalorieEstimate(snapshot, weight)?.calories).toBe(563);

    const editedWeight: WeightData = {
      ...weight,
      weighIns: [{ id: 'weight-70', date: '2026-10-19', weightKg: 90 }]
    };
    expect(cardioRunCalorieEstimate(snapshot, editedWeight)?.calories).toBe(563);
  });

  it('rejects a stored estimate whose weigh-in date is later than the run', () => {
    expect(isCardioRun(run({
      date: '2026-10-20',
      calorieEstimate: {
        source: 'estimated',
        method: 'distance-weight-v1',
        weightKg: 70,
        weightSource: 'weigh-in',
        weightDate: '2026-10-21',
        weightMeasurementId: 'future-weight'
      }
    }))).toBe(false);
  });

  it('compares distance to the prior run and pace to the latest similar-distance run', () => {
    const weight: WeightData = {
      ...createWeightData(),
      weighIns: [{ id: 'comparison-weight', date: '2026-10-18', weightKg: 70 }]
    };
    const runs = [
      run({
        id: 'similar-run',
        date: '2026-10-19',
        distance: 6,
        durationSeconds: 3600,
        calorieEstimate: {
          source: 'estimated',
          method: 'distance-weight-v1',
          weightKg: 70,
          weightSource: 'weigh-in',
          weightDate: '2026-10-18',
          weightMeasurementId: 'comparison-weight'
        }
      }),
      run({
        id: 'previous-run',
        date: '2026-10-21',
        distance: 3,
        durationSeconds: 1800,
        calorieEstimate: {
          source: 'estimated',
          method: 'distance-weight-v1',
          weightKg: 70,
          weightSource: 'weigh-in',
          weightDate: '2026-10-18',
          weightMeasurementId: 'comparison-weight'
        }
      }),
      run({
        id: 'current-run',
        date: today,
        distance: 6.2,
        distanceUnit: 'mi',
        durationSeconds: 2976,
        calorieEstimate: {
          source: 'estimated',
          method: 'distance-weight-v1',
          weightKg: 70,
          weightSource: 'weigh-in',
          weightDate: '2026-10-18',
          weightMeasurementId: 'comparison-weight'
        }
      })
    ];

    expect(selectCardioRunComparisons(runs, runs[2]!, weight, today)).toMatchObject({
      previousRun: { id: 'previous-run' },
      similarDistanceRun: { id: 'similar-run' },
      paceReferenceRun: { id: 'similar-run' },
      distanceDelta: 3.2,
      paceImprovementSeconds: 120,
      calorieDelta: 360
    });
  });

  it('does not compare pace against a different-distance run when no similar-distance duration exists', () => {
    const previous = run({ id: 'previous', date: '2026-10-21', distance: 3, durationSeconds: 1800 });
    const current = run({ id: 'current', date: today, distance: 6.2, durationSeconds: 3600 });
    const comparison = selectCardioRunComparisons([previous, current], current, createWeightData(), today);

    expect(comparison).toMatchObject({
      previousRun: { id: 'previous' },
      similarDistanceRun: null,
      paceReferenceRun: null,
      paceImprovementSeconds: null,
      distanceDelta: 3.2
    });
  });

  it('summarizes run totals in canonical miles and reports partial duration and calorie coverage', () => {
    const timedWithEstimate = run({
      id: 'timed-estimated',
      date: '2026-10-19',
      distance: 2,
      durationSeconds: 1200,
      calorieEstimate: {
        source: 'estimated',
        method: 'distance-weight-v1',
        weightKg: 70,
        weightSource: 'manual'
      }
    });
    const untimedKilometers = run({
      id: 'untimed-kilometers',
      date: '2026-10-20',
      distance: cardioDistanceToMiles(10, 'km'),
      distanceUnit: 'km'
    });
    const timedWithoutEstimate = run({
      id: 'timed-without-estimate',
      date: '2026-10-21',
      distance: 4,
      durationSeconds: 1800
    });
    const future = run({ id: 'future', date: '2026-10-23', distance: 8 });

    expect(selectCardioRunTotals(
      [timedWithEstimate, untimedKilometers, timedWithoutEstimate, future],
      createWeightData(),
      today
    )).toMatchObject({
      runCount: 3,
      durationRunCount: 2,
      durationSeconds: 3000,
      estimatedRunCount: 1,
      estimatedCalories: 225
    });
    expect(selectCardioRunTotals(
      [timedWithEstimate, untimedKilometers, timedWithoutEstimate],
      createWeightData(),
      today
    ).distanceMiles).toBeCloseTo(12.2137119, 6);
  });

  it('keeps unavailable duration and calorie totals distinct from zero', () => {
    const runs = [run({ id: 'no-duration' })];
    expect(selectCardioRunTotals(runs, createWeightData(), today)).toMatchObject({
      runCount: 1,
      distanceMiles: 3,
      durationRunCount: 0,
      durationSeconds: null,
      estimatedRunCount: 0,
      estimatedCalories: null
    });
    expect(selectCardioRunTotals([], createWeightData(), today)).toMatchObject({
      runCount: 0,
      distanceMiles: 0,
      durationSeconds: null,
      estimatedCalories: null
    });
  });

  it('does not infer an earlier same-day run when activity time is not recorded', () => {
    const weight = createWeightData();
    const sameDay = [
      run({ id: 'run-b', date: today, distance: 2 }),
      run({ id: 'run-a', date: today, distance: 2 })
    ];
    expect(selectCardioRunComparisons(sameDay, sameDay[0]!, weight, today).previousRun).toBeNull();
    expect(selectCardioRunComparisons([sameDay[0]!], sameDay[0]!, weight, today)).toMatchObject({
      previousRun: null,
      similarDistanceRun: null,
      paceReferenceRun: null,
      distanceDelta: null,
      paceImprovementSeconds: null,
      calorieDelta: null
    });
  });

  it('round-trips an optional run duration and entry unit in the versioned preview envelope', () => {
    const data = createSamplePreviewData();
    data.cardio.runs = [run({
      id: 'timed-kilometer-run',
      distance: cardioDistanceToMiles(10, 'km'),
      distanceUnit: 'km',
      durationSeconds: 3600
    })];

    const backup = JSON.stringify(createPreviewEnvelope(data));
    const restored = parsePreviewBackup(backup, today);

    expect(restored.valid).toBe(true);
    if (!restored.valid) return;
    expect(restored.envelope.data.cardio.runs).toEqual([expect.objectContaining({
      id: 'timed-kilometer-run',
      distanceUnit: 'km',
      durationSeconds: 3600
    })]);
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

  it('formats the fixed Monday–Sunday range across month and year boundaries independently of timezone', () => {
    expect(formatCardioWeekRange('2026-11-16', '2026-11-22')).toBe('Nov 16 – Nov 22');
    expect(formatCardioWeekdayRange('2026-11-16', '2026-11-22')).toBe('Monday – Sunday');
    expect(formatCardioWeekRange('2026-11-30', '2026-12-06')).toBe('Nov 30 – Dec 6');
    expect(formatCardioWeekRange('2026-12-28', '2027-01-03')).toBe('Dec 28, 2026 – Jan 3, 2027');
  });

  it('keeps Cardio Health independent of saved or estimated calories', () => {
    const base: CardioData = {
      ...createCardioData(),
      goals: { weeklyRunTarget: 2, weeklyMileTarget: 8 },
      runs: [run({ id: 'same-run', distance: 4 })]
    };
    const withEstimate: CardioData = {
      ...base,
      runs: [{
        ...base.runs[0]!,
        calorieEstimate: {
          source: 'estimated',
          method: 'distance-weight-v1',
          weightKg: 70,
          weightSource: 'manual'
        }
      }]
    };

    expect(selectCardioProgress(withEstimate, today)).toEqual(selectCardioProgress(base, today));
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

  it('preserves duration and display units, clears them explicitly, and rejects invalid stored durations', () => {
    const saved = saveCardioRun(createCardioData(), run({
      id: 'timed-run',
      distance: cardioDistanceToMiles(10, 'km'),
      distanceUnit: 'km',
      durationSeconds: 3600
    }), today);
    expect(saved.valid).toBe(true);
    if (!saved.valid) return;
    expect(validatedCardioRuns(saved.data, today).records[0]).toMatchObject({
      distanceUnit: 'km',
      durationSeconds: 3600
    });

    const cleared = saveCardioRun(saved.data, run({ id: 'timed-run' }), today);
    expect(cleared.valid).toBe(true);
    if (!cleared.valid) return;
    expect(cleared.data.runs[0]).not.toHaveProperty('distanceUnit');
    expect(cleared.data.runs[0]).not.toHaveProperty('durationSeconds');
    expect(saveCardioRun(createCardioData(), run({ durationSeconds: 0 }), today))
      .toMatchObject({ valid: false });
    expect(saveCardioRun(createCardioData(), run({ durationSeconds: Number.NaN }), today))
      .toMatchObject({ valid: false });
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
