import { describe, expect, it } from 'vitest';
import type { RhythmCompletionRecord } from '../src/domain/rhythm-completion.ts';
import {
  addCalendarDays,
  localDateInTimeZone,
  selectDailyRhythmScore
} from '../src/domain/rhythm-scoring.ts';
import type { SelectDailyRhythmScoreInput } from '../src/domain/rhythm-scoring.ts';
import type { RhythmSchedule, RhythmScoringMetadata } from '../src/domain/rhythm-schedule.ts';

const rhythmId = 'daily-test-rhythm';
const asOfDate = '2026-10-23';
const trackingStartDate = '2026-09-23';
const dailySchedule = { frequency: 'daily' } as const;

function record(id: string, effectiveDate: string, targetId = rhythmId): RhythmCompletionRecord {
  return { id, rhythmId: targetId, effectiveDate };
}

function scoring(
  startDate = trackingStartDate,
  scheduleHistory: RhythmScoringMetadata['scheduleHistory'] = [
    { startDate, schedule: dailySchedule }
  ],
  timeZone = 'UTC'
): RhythmScoringMetadata {
  return { trackingStartDate: startDate, timeZone, scheduleHistory };
}

function input(
  overrides: Omit<Partial<SelectDailyRhythmScoreInput>, 'schedule' | 'scoring'> & {
    schedule?: RhythmSchedule | undefined;
    scoring?: RhythmScoringMetadata | undefined;
  } = {}
): SelectDailyRhythmScoreInput {
  const { schedule: scheduleOverride, scoring: scoringOverride, ...rest } = overrides;
  const result: SelectDailyRhythmScoreInput = {
    rhythmId,
    schedule: dailySchedule,
    scoring: scoring(),
    records: [],
    recordsAvailable: true,
    asOfDate,
    timeZone: 'UTC',
    ...rest
  };
  if ('schedule' in overrides) {
    if (scheduleOverride === undefined) delete result.schedule;
    else result.schedule = scheduleOverride;
  }
  if ('scoring' in overrides) {
    if (scoringOverride === undefined) delete result.scoring;
    else result.scoring = scoringOverride;
  }
  return result;
}

function scored(inputValue: SelectDailyRhythmScoreInput) {
  const result = selectDailyRhythmScore(inputValue);
  expect(result.kind).toBe('rhythm-score');
  if (result.kind !== 'rhythm-score') throw new Error('Expected a rhythm scoring result.');
  return result;
}

describe('daily occurrence scoring', () => {
  it('scores empty, partial, duplicate, complete and zero-floor histories from dated evidence', () => {
    const empty = scored(input({
      asOfDate: '2026-10-03',
      scoring: scoring('2026-10-01'),
      createdLocalDate: '2026-10-01',
      createdTimeZone: 'UTC',
      records: []
    }));
    expect(empty.consistency).toMatchObject({
      kind: 'scored',
      score: 0,
      evidence: { eligibleDueCount: 2, completedCount: 0, notCompletedCount: 2 }
    });
    expect(empty.onTrack).toMatchObject({
      kind: 'scored',
      score: 80,
      evidence: { missedOccurrenceCount: 2, deduction: 20 }
    });

    const partialRecords = [
      record('one', '2026-09-23'),
      record('duplicate-a', '2026-09-24'),
      record('duplicate-b', '2026-09-24'),
      record('last-tended', '2026-10-19')
    ];
    const partial = scored(input({ records: partialRecords }));
    expect(partial.consistency).toMatchObject({
      kind: 'scored',
      exactPercent: 200 / 29,
      evidence: { eligibleDueCount: 29, completedCount: 2, notCompletedCount: 27 }
    });
    expect(partial.consistency.kind === 'scored'
      && partial.consistency.evidence.occurrences.find(item => item.date === '2026-09-24'))
      .toMatchObject({ status: 'completed', recordIds: ['duplicate-a', 'duplicate-b'] });
    expect(partial.onTrack).toMatchObject({
      kind: 'scored',
      score: 70,
      evidence: {
        lastQualifyingCompletionDate: '2026-10-19',
        missedOccurrenceCount: 3,
        deduction: 30
      }
    });

    const complete = scored(input({
      records: Array.from({ length: 30 }, (_, index) => record(`complete-${index}`, addCalendarDays(trackingStartDate, index)))
    }));
    expect(complete.consistency).toMatchObject({
      kind: 'scored',
      score: 100,
      evidence: { eligibleDueCount: 29, completedCount: 29 }
    });
    expect(complete.onTrack).toMatchObject({ kind: 'scored', score: 100 });

    const zeroFloor = scored(input({
      asOfDate: '2026-10-23',
      scoring: scoring('2026-10-01'),
      createdLocalDate: '2026-10-01',
      createdTimeZone: 'UTC',
      records: []
    }));
    expect(zeroFloor.onTrack).toMatchObject({
      kind: 'scored',
      score: 0,
      evidence: {
        missedOccurrenceCount: 22,
        deduction: 100,
        occurrences: expect.arrayContaining([{ date: '2026-10-10', status: 'missed', score: 0 }]),
        repeatedZeroScoreSpans: [{ startDate: '2026-10-11', endDate: '2026-10-22', occurrenceCount: 12 }]
      }
    });
  });

  it('keeps long zero-score stretches compact and exposes schedule-history boundaries', () => {
    const longHistory = scored(input({
      asOfDate: '2026-10-23',
      scoring: scoring('1900-01-01'),
      createdLocalDate: '1900-01-01',
      createdTimeZone: 'UTC',
      records: []
    }));
    expect(longHistory.onTrack).toMatchObject({
      kind: 'scored',
      score: 0,
      evidence: {
        missedOccurrenceCount: expect.any(Number),
        occurrences: expect.any(Array),
        repeatedZeroScoreSpans: expect.any(Array)
      }
    });
    if (longHistory.onTrack.kind !== 'scored') throw new Error('Expected scored On Track evidence.');
    expect(longHistory.onTrack.evidence.missedOccurrenceCount).toBeGreaterThan(40_000);
    expect(longHistory.onTrack.evidence.occurrences.length).toBe(11);
    expect(longHistory.onTrack.evidence.repeatedZeroScoreSpans[0]?.occurrenceCount)
      .toBe(longHistory.onTrack.evidence.missedOccurrenceCount - 10);

    const boundaryStart = '2026-10-01';
    const scheduleHistory: RhythmScoringMetadata['scheduleHistory'] = [
      {
        startDate: boundaryStart,
        endDate: '2026-10-14',
        schedule: { frequency: 'daily', endDate: '2026-10-14' }
      },
      { startDate: '2026-10-15', schedule: dailySchedule }
    ];
    const acrossBoundary = scored(input({
      asOfDate: '2026-10-24',
      scoring: scoring(boundaryStart, scheduleHistory),
      createdLocalDate: boundaryStart,
      createdTimeZone: 'UTC',
      records: []
    }));
    expect(acrossBoundary.onTrack).toMatchObject({
      kind: 'scored',
      score: 0,
      evidence: {
        scheduleChanges: [{ date: '2026-10-15', score: 0 }],
        repeatedZeroScoreSpans: [
          { startDate: '2026-10-11', endDate: '2026-10-14', occurrenceCount: 4 },
          { startDate: '2026-10-15', endDate: '2026-10-23', occurrenceCount: 9 }
        ]
      }
    });
  });

  it('retains each Daily completion reset outside repeated-zero summaries', () => {
    const result = scored(input({
      asOfDate: '2026-10-24',
      scoring: scoring('2026-10-01'),
      createdLocalDate: '2026-10-01',
      createdTimeZone: 'UTC',
      records: [
        record('first-reset', '2026-10-01'),
        record('later-reset', '2026-10-15')
      ]
    }));
    expect(result.onTrack).toMatchObject({
      kind: 'scored',
      score: 20,
      evidence: {
        lastQualifyingCompletionDate: '2026-10-15',
        missedOccurrenceCount: 8,
        deduction: 80,
        repeatedZeroScoreSpans: [{
          startDate: '2026-10-12',
          endDate: '2026-10-14',
          occurrenceCount: 3
        }]
      }
    });
    if (result.onTrack.kind !== 'scored') throw new Error('Expected scored On Track evidence.');
    expect(result.onTrack.evidence.occurrences.filter(day => day.status === 'completed').map(day => day.date))
      .toEqual(['2026-10-01', '2026-10-15']);
    expect(result.onTrack.evidence.occurrences.at(-1)).toEqual({
      date: '2026-10-24',
      status: 'today',
      score: 20
    });
  });

  it('clips Consistency to the tracking start and includes a completed today', () => {
    const start = '2026-10-21';
    const endedSegment: RhythmScoringMetadata['scheduleHistory'] = [
      { startDate: start, endDate: '2026-10-22', schedule: dailySchedule },
      { startDate: '2026-10-23', schedule: dailySchedule }
    ];
    const result = scored(input({
      asOfDate,
      scoring: scoring(start, endedSegment),
      records: [
        record('first-active', '2026-10-21'),
        record('last-active', '2026-10-22'),
        record('today', '2026-10-23')
      ]
    }));
    expect(result.consistency).toMatchObject({
      kind: 'scored',
      score: 100,
      evidence: {
        windowStartDate: start,
        windowEndDate: '2026-10-23',
        eligibleDueCount: 3,
        completedCount: 3,
        todayIncluded: true,
        occurrences: [{ date: '2026-10-21' }, { date: '2026-10-22' }, { date: '2026-10-23' }]
      }
    });
    expect(result.onTrack).toMatchObject({ kind: 'scored', score: 100 });

    const startedToday = scored(input({
      asOfDate,
      scoring: scoring(asOfDate),
      records: [record('today-only', asOfDate)]
    }));
    expect(startedToday.consistency).toMatchObject({ kind: 'scored', score: 100 });
    expect(startedToday.onTrack).toMatchObject({ kind: 'scored', score: 100 });
    expect(startedToday.healthScore).toBe(100);
  });

  it('applies today’s qualifying completion without a deduction and evaluates backdated edits by effective date', () => {
    const today = scored(input({ records: [record('today', asOfDate)] }));
    expect(today.onTrack).toMatchObject({
      kind: 'scored',
      score: 100,
      evidence: {
        lastQualifyingCompletionDate: asOfDate,
        missedOccurrenceCount: 0,
        deduction: 0,
        occurrences: [{ date: asOfDate, status: 'completed', score: 100 }]
      }
    });

    const baseline = scored(input({
      createdLocalDate: trackingStartDate,
      createdTimeZone: 'UTC',
      records: [record('latest', '2026-10-20')]
    }));
    const withBackdatedAddition = scored(input({
      createdLocalDate: trackingStartDate,
      createdTimeZone: 'UTC',
      records: [record('latest', '2026-10-20'), record('backdated', '2026-10-01')]
    }));
    expect(withBackdatedAddition.onTrack).toMatchObject({
      kind: 'scored',
      score: baseline.onTrack.kind === 'scored' ? baseline.onTrack.score : null,
      evidence: {
        lastQualifyingCompletionDate: '2026-10-20',
        missedOccurrenceCount: 2,
        deduction: 20
      }
    });
    if (withBackdatedAddition.onTrack.kind !== 'scored') throw new Error('Expected scored On Track evidence.');
    expect(withBackdatedAddition.onTrack.evidence.occurrences.find(day => day.date === '2026-10-01')).toEqual({
      date: '2026-10-01',
      status: 'completed',
      score: 100
    });
    const edited = scored(input({
      createdLocalDate: trackingStartDate,
      createdTimeZone: 'UTC',
      records: [record('latest', '2026-10-21')]
    }));
    expect(edited.onTrack).toMatchObject({ kind: 'scored', score: 90 });
    const deleted = scored(input({
      createdLocalDate: trackingStartDate,
      createdTimeZone: 'UTC',
      records: []
    }));
    expect(deleted.onTrack).toMatchObject({ kind: 'scored', score: 0 });
    const undoRestored = scored(input({
      createdLocalDate: trackingStartDate,
      createdTimeZone: 'UTC',
      records: [record('latest', '2026-10-20')]
    }));
    expect(undoRestored.onTrack).toEqual(baseline.onTrack);
  });

  it('keeps completion dates stable across device zones and uses calendar arithmetic at DST boundaries', () => {
    expect(addCalendarDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addCalendarDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(localDateInTimeZone(new Date('2026-03-08T07:30:00.000Z'), 'America/Los_Angeles'))
      .toBe('2026-03-07');
    const timezoneScoring = scoring('2026-10-21', [
      { startDate: '2026-10-21', schedule: dailySchedule }
    ], 'America/Los_Angeles');
    const result = scored(input({
      asOfDate: '2026-10-23',
      timeZone: 'America/Los_Angeles',
      scoring: timezoneScoring,
      createdLocalDate: '2026-10-21',
      createdTimeZone: 'America/Los_Angeles',
      records: [record('date-only', '2026-10-22')]
    }));
    expect(result.consistency).toMatchObject({
      kind: 'scored',
      evidence: {
        eligibleDueCount: 2,
        completedCount: 1,
        occurrences: [
          { date: '2026-10-21', status: 'not-completed' },
          { date: '2026-10-22', status: 'completed', recordIds: ['date-only'] }
        ]
      }
    });
    expect(result.onTrack).toMatchObject({ kind: 'scored', score: 100 });
  });

  it('reports missing, unsupported, inactive, invalid and unsupported-history states distinctly', () => {
    expect(selectDailyRhythmScore(input({ scoring: undefined, records: [] }))).toMatchObject({
      kind: 'rhythm-score',
      consistency: { kind: 'unscored', reasonCode: 'ready-for-first-tend' },
      onTrack: { kind: 'unscored', reasonCode: 'ready-for-first-tend' },
      healthScore: null
    });
    expect(selectDailyRhythmScore(input({
      scoring: undefined,
      records: [],
      schedule: { frequency: 'weekly', weekdays: [1] } satisfies RhythmSchedule
    }))).toMatchObject({
      kind: 'rhythm-score',
      consistency: { kind: 'unscored', reasonCode: 'ready-for-first-tend' },
      onTrack: { kind: 'unscored', reasonCode: 'ready-for-first-tend' }
    });
    expect(selectDailyRhythmScore(input({ archived: true }))).toMatchObject({
      kind: 'unscored',
      reason: { reasonCode: 'inactive' }
    });
    expect(selectDailyRhythmScore(input({
      schedule: { frequency: 'daily', endDate: '2026-10-22' },
      scoring: scoring(trackingStartDate, [
        { startDate: trackingStartDate, schedule: { frequency: 'daily', endDate: '2026-10-22' } }
      ])
    }))).toMatchObject({
      kind: 'unscored',
      reason: { reasonCode: 'inactive' }
    });

    const history: RhythmScoringMetadata['scheduleHistory'] = [
      {
        startDate: '2026-09-23',
        endDate: '2026-10-10',
        schedule: {
          frequency: 'custom',
          unit: 'days',
          interval: 2,
          startDate: '2026-09-23'
        }
      },
      { startDate: '2026-10-11', schedule: dailySchedule }
    ];
    const acrossUnsupportedHistory = scored(input({
      scoring: scoring(trackingStartDate, history),
      createdLocalDate: trackingStartDate,
      createdTimeZone: 'UTC',
      records: [record('recent', '2026-10-20')]
    }));
    expect(acrossUnsupportedHistory.consistency).toMatchObject({
      kind: 'unscored',
      reasonCode: 'unsupported-history'
    });
    expect(acrossUnsupportedHistory.onTrack).toMatchObject({
      kind: 'scored',
      score: 80,
      evidence: {
        lastQualifyingCompletionDate: '2026-10-20',
        missedOccurrenceCount: 2,
        deduction: 20
      }
    });
    expect(acrossUnsupportedHistory.healthScore).toBeNull();

    const noLatestTend = selectDailyRhythmScore(input({
      scoring: scoring(trackingStartDate, history),
      createdLocalDate: trackingStartDate,
      createdTimeZone: 'UTC',
      records: []
    }));
    expect(noLatestTend).toMatchObject({
      kind: 'rhythm-score',
      onTrack: { kind: 'scored', score: 0 }
    });
    expect(selectDailyRhythmScore(input({ recordsAvailable: false }))).toMatchObject({
      kind: 'unscored',
      reason: { reasonCode: 'history-unavailable' }
    });
    expect(selectDailyRhythmScore(input({
      records: [record('duplicate', '2026-10-20'), record('duplicate', '2026-10-21')]
    }))).toMatchObject({ kind: 'invalid' });
  });

  it('compares structured schedule metadata independent of property ordering', () => {
    const orderedSchedule = { frequency: 'daily' as const, endDate: '2026-11-01' };
    const reorderedSchedule = { endDate: '2026-11-01', frequency: 'daily' as const };
    const result = scored(input({
      schedule: reorderedSchedule,
      scoring: scoring(trackingStartDate, [{ startDate: trackingStartDate, schedule: orderedSchedule }]),
      createdLocalDate: trackingStartDate,
      createdTimeZone: 'UTC'
    }));
    expect(result.consistency.kind).toBe('scored');
  });

  it('scores both Daily inputs automatically from dated completions without a tracking start', () => {
    const result = scored(input({
      scoring: undefined,
      records: [
        record('latest', '2026-10-20'),
        record('backdated', '2026-10-01')
      ]
    }));
    expect(result.consistency).toMatchObject({ kind: 'scored', score: expect.any(Number) });
    expect(result.onTrack).toMatchObject({
      kind: 'scored',
      score: 80,
      evidence: {
        lastQualifyingCompletionDate: '2026-10-20',
        missedOccurrenceCount: 2,
        deduction: 20
      }
    });
    expect(result.healthScore).toBeCloseTo(26.81818181818182);
  });

  it('normalizes only the exact legacy Daily cadence for scoring', () => {
    const legacyDaily = scored(input({
      schedule: undefined,
      scoring: undefined,
      cadence: 'Daily',
      records: [record('legacy-completion', '2026-10-20')]
    }));
    expect(legacyDaily.onTrack).toMatchObject({ kind: 'scored', score: 80 });
    expect(legacyDaily.consistency.kind).toBe('scored');
    expect(selectDailyRhythmScore(input({
      schedule: undefined,
      scoring: undefined,
      cadence: '3 times a week',
      records: [record('unknown-cadence', '2026-10-20')]
    }))).toMatchObject({
      kind: 'unscored',
      reason: { reasonCode: 'unsupported-schedule' }
    });
  });

  it('scores short daily tracking history without a minimum lookback or completion count', () => {
    const result = scored(input({
      scoring: scoring('2026-10-20'),
      records: [
        record('first-day', '2026-10-20'),
        record('second-day-a', '2026-10-21'),
        record('second-day-b', '2026-10-21')
      ]
    }));
    expect(result.consistency).toMatchObject({
      kind: 'scored',
      evidence: {
        windowStartDate: '2026-10-20',
        windowEndDate: '2026-10-22',
        eligibleDueCount: 3,
        completedCount: 2,
        notCompletedCount: 1,
        limitedHistoryDays: 3
      }
    });
    expect(result.consistency.kind === 'scored' ? result.consistency.exactPercent : NaN).toBeCloseTo(200 / 3);
    expect(result.healthScore).toBeCloseTo((200 / 3) * 0.75 + 90 * 0.25);
  });

  it('includes a qualifying today-only completion in Consistency and On Track', () => {
    const result = scored(input({
      asOfDate,
      scoring: scoring(asOfDate),
      records: [record('today-only', asOfDate)]
    }));
    expect(result.consistency).toMatchObject({ kind: 'scored', score: 100 });
    expect(result.onTrack).toMatchObject({ kind: 'scored', score: 100 });
    expect(result.healthScore).toBe(100);
  });

  it('derives the daily window from creation and the oldest dated completion', () => {
    const createdTodayWithoutLogs = scored(input({
      scoring: undefined,
      records: [],
      createdLocalDate: asOfDate,
      createdTimeZone: 'UTC'
    }));
    expect(createdTodayWithoutLogs).toMatchObject({
      consistency: { kind: 'unscored', reasonCode: 'ready-for-first-tend' },
      onTrack: { kind: 'unscored', reasonCode: 'ready-for-first-tend' },
      healthScore: null
    });

    const createdAndTendedToday = scored(input({
      scoring: undefined,
      records: [record('today', asOfDate)],
      createdLocalDate: asOfDate,
      createdTimeZone: 'UTC'
    }));
    expect(createdAndTendedToday).toMatchObject({
      trackingStartDate: asOfDate,
      consistency: { kind: 'scored', score: 100, evidence: { eligibleDueCount: 1, completedCount: 1, todayIncluded: true } },
      onTrack: { kind: 'scored', score: 100 },
      healthScore: 100
    });

    const createdYesterday = addCalendarDays(asOfDate, -1);
    const tendedToday = scored(input({
      scoring: undefined,
      records: [record('today', asOfDate)],
      createdLocalDate: createdYesterday,
      createdTimeZone: 'UTC'
    }));
    expect(tendedToday).toMatchObject({
      trackingStartDate: createdYesterday,
      consistency: { kind: 'scored', score: 50, evidence: { eligibleDueCount: 2, completedCount: 1 } },
      onTrack: { kind: 'scored', score: 100 },
      healthScore: 62.5
    });

    const backdated = addCalendarDays(asOfDate, -60);
    const oldCreationWithBackfill = scored(input({
      scoring: undefined,
      records: [record('backfill', backdated), record('today', asOfDate)],
      createdLocalDate: asOfDate,
      createdTimeZone: 'UTC'
    }));
    expect(oldCreationWithBackfill.trackingStartDate).toBe(backdated);
    expect(oldCreationWithBackfill.consistency).toMatchObject({
      kind: 'scored',
      evidence: {
        windowStartDate: addCalendarDays(asOfDate, -29),
        windowEndDate: asOfDate,
        eligibleDueCount: 30,
        completedCount: 1,
        todayIncluded: true,
        limitedHistoryDays: null
      }
    });
  });

  it('recalculates automatic starts after backdated records are edited or deleted', () => {
    const created = addCalendarDays(asOfDate, -2);
    const firstTend = addCalendarDays(asOfDate, -5);
    const withBackfill = scored(input({
      scoring: undefined,
      createdLocalDate: created,
      createdTimeZone: 'UTC',
      records: [record('backfill', firstTend), record('recent', addCalendarDays(asOfDate, -1))]
    }));
    expect(withBackfill.trackingStartDate).toBe(firstTend);
    expect(withBackfill.consistency).toMatchObject({
      kind: 'scored',
      evidence: { windowStartDate: firstTend, eligibleDueCount: 5, completedCount: 2 }
    });

    const afterDelete = scored(input({
      scoring: undefined,
      createdLocalDate: created,
      createdTimeZone: 'UTC',
      records: [record('recent', addCalendarDays(asOfDate, -1))]
    }));
    expect(afterDelete.trackingStartDate).toBe(created);
    expect(afterDelete.consistency).toMatchObject({
      kind: 'scored',
      evidence: { windowStartDate: created, eligibleDueCount: 2, completedCount: 1 }
    });
  });

  it('scores supported weekly, monthly, quarterly, and yearly patterns by missed occurrence', () => {
    const cases: {
      schedule: RhythmSchedule;
      start: string;
      expectedDue: number;
      expectedOnTrack: number;
      records: RhythmCompletionRecord[];
    }[] = [
      {
        schedule: { frequency: 'weekly', weekdays: [1, 3, 5] },
        start: '2026-10-19',
        expectedDue: 2,
        expectedOnTrack: 90,
        records: [record('mon', '2026-10-19')]
      },
      {
        schedule: { frequency: 'monthly', pattern: { kind: 'dayOfMonth', day: 15 } },
        start: '2026-10-01',
        expectedDue: 1,
        expectedOnTrack: 100,
        records: [record('monthly', '2026-10-15')]
      },
      {
        schedule: { frequency: 'quarterly', monthInQuarter: 1, pattern: { kind: 'dayOfMonth', day: 1 } },
        start: '2026-01-01',
        expectedDue: 4,
        expectedOnTrack: 100,
        records: [record('quarterly', '2026-01-01'), record('quarterly-oct', '2026-10-01')]
      },
      {
        schedule: { frequency: 'yearly', month: 2, pattern: { kind: 'dayOfMonth', day: 28 } },
        start: '2025-01-01',
        expectedDue: 2,
        expectedOnTrack: 100,
        records: [record('yearly', '2026-02-28')]
      }
    ];
    for (const testCase of cases) {
      const segments: RhythmScoringMetadata['scheduleHistory'] = [
        { startDate: testCase.start, schedule: testCase.schedule }
      ];
      const result = scored(input({
        schedule: testCase.schedule,
        scoring: scoring(testCase.start, segments),
        createdLocalDate: testCase.start,
        createdTimeZone: 'UTC',
        records: testCase.records
      }));
      expect(result.consistency).toMatchObject({
        kind: 'scored',
        evidence: {
          eligibleDueCount: testCase.expectedDue,
          completedCount: testCase.records.length
        }
      });
      expect(result.onTrack).toMatchObject({ kind: 'scored', score: testCase.expectedOnTrack });
    }
  });

  it('scores every structured frequency only at actual occurrences and leaves today pending', () => {
    const cases: {
      name: string;
      schedule: RhythmSchedule;
      start: string;
      asOfDate: string;
      records?: RhythmCompletionRecord[];
      expectedMissed: number;
      expectedScore: number;
      expectedLastCompletion?: string | null;
    }[] = [
      {
        name: 'daily after an older completion',
        schedule: dailySchedule,
        start: '2026-10-01',
        asOfDate: '2026-10-24',
        records: [record('daily-last', '2026-10-20')],
        expectedMissed: 3,
        expectedScore: 70,
        expectedLastCompletion: '2026-10-20'
      },
      {
        name: 'selected weekdays with today still pending',
        schedule: { frequency: 'weekly', weekdays: [1, 3, 5] },
        start: '2026-10-19',
        asOfDate: '2026-10-23',
        records: [record('selected-monday', '2026-10-19'), record('off-schedule-tuesday', '2026-10-20')],
        expectedMissed: 1,
        expectedScore: 90,
        expectedLastCompletion: '2026-10-19'
      },
      {
        name: 'once-weekly Thursday on an unscheduled Friday',
        schedule: { frequency: 'weekly', weekdays: [4] },
        start: '2026-10-08',
        asOfDate: '2026-10-10',
        expectedMissed: 1,
        expectedScore: 90,
        expectedLastCompletion: null
      },
      {
        name: 'monthly ordinal weekday',
        schedule: { frequency: 'monthly', pattern: { kind: 'ordinalWeekday', ordinal: 1, weekday: 4 } },
        start: '2026-10-01',
        asOfDate: '2026-10-02',
        expectedMissed: 1,
        expectedScore: 90,
        expectedLastCompletion: null
      },
      {
        name: 'monthly last day',
        schedule: { frequency: 'monthly', pattern: { kind: 'dayOfMonth', day: 'last' } },
        start: '2026-09-30',
        asOfDate: '2026-10-01',
        expectedMissed: 1,
        expectedScore: 90,
        expectedLastCompletion: null
      },
      {
        name: 'quarterly occurrence',
        schedule: { frequency: 'quarterly', monthInQuarter: 1, pattern: { kind: 'dayOfMonth', day: 1 } },
        start: '2026-10-01',
        asOfDate: '2026-10-02',
        expectedMissed: 1,
        expectedScore: 90,
        expectedLastCompletion: null
      },
      {
        name: 'quarterly ordinal weekday',
        schedule: { frequency: 'quarterly', monthInQuarter: 2, pattern: { kind: 'ordinalWeekday', ordinal: 2, weekday: 1 } },
        start: '2026-02-09',
        asOfDate: '2026-02-10',
        expectedMissed: 1,
        expectedScore: 90,
        expectedLastCompletion: null
      },
      {
        name: 'yearly occurrence',
        schedule: { frequency: 'yearly', month: 2, pattern: { kind: 'dayOfMonth', day: 28 } },
        start: '2026-02-28',
        asOfDate: '2026-03-01',
        expectedMissed: 1,
        expectedScore: 90,
        expectedLastCompletion: null
      },
      {
        name: 'yearly ordinal weekday',
        schedule: { frequency: 'yearly', month: 10, pattern: { kind: 'ordinalWeekday', ordinal: 'last', weekday: 4 } },
        start: '2026-10-29',
        asOfDate: '2026-10-30',
        expectedMissed: 1,
        expectedScore: 90,
        expectedLastCompletion: null
      },
      {
        name: 'custom day interval',
        schedule: { frequency: 'custom', unit: 'days', interval: 2, startDate: '2026-10-01' },
        start: '2026-10-01',
        asOfDate: '2026-10-08',
        expectedMissed: 4,
        expectedScore: 60,
        expectedLastCompletion: null
      },
      {
        name: 'custom week interval anchored to Monday week',
        schedule: { frequency: 'custom', unit: 'weeks', interval: 2, weekdays: [1, 3], startDate: '2026-10-19' },
        start: '2026-10-19',
        asOfDate: '2026-11-03',
        expectedMissed: 3,
        expectedScore: 70,
        expectedLastCompletion: null
      },
      {
        name: 'custom month interval with Last weekday pattern',
        schedule: {
          frequency: 'custom',
          unit: 'months',
          interval: 2,
          pattern: { kind: 'ordinalWeekday', ordinal: 'last', weekday: 5 },
          startDate: '2026-08-15'
        },
        start: '2026-08-15',
        asOfDate: '2026-12-26',
        expectedMissed: 3,
        expectedScore: 70,
        expectedLastCompletion: null
      },
      {
        name: 'custom month interval with date pattern skips short months',
        schedule: {
          frequency: 'custom',
          unit: 'months',
          interval: 1,
          pattern: { kind: 'dayOfMonth', day: 31 },
          startDate: '2026-01-31'
        },
        start: '2026-01-31',
        asOfDate: '2026-04-01',
        expectedMissed: 2,
        expectedScore: 80,
        expectedLastCompletion: null
      },
      {
        name: 'custom year interval with leap-day pattern',
        schedule: {
          frequency: 'custom',
          unit: 'years',
          interval: 2,
          month: 2,
          pattern: { kind: 'dayOfMonth', day: 29 },
          startDate: '2024-02-29'
        },
        start: '2024-02-29',
        asOfDate: '2028-03-01',
        records: [record('leap-day-reset', '2024-02-29')],
        expectedMissed: 1,
        expectedScore: 90,
        expectedLastCompletion: '2024-02-29'
      },
      {
        name: 'custom year interval with Last weekday pattern',
        schedule: {
          frequency: 'custom',
          unit: 'years',
          interval: 2,
          month: 10,
          pattern: { kind: 'ordinalWeekday', ordinal: 'last', weekday: 4 },
          startDate: '2026-01-01'
        },
        start: '2026-01-01',
        asOfDate: '2030-11-01',
        expectedMissed: 3,
        expectedScore: 70,
        expectedLastCompletion: null
      }
    ];

    for (const testCase of cases) {
      const result = scored(input({
        schedule: testCase.schedule,
        scoring: scoring(testCase.start, [{ startDate: testCase.start, schedule: testCase.schedule }]),
        createdLocalDate: testCase.start,
        createdTimeZone: 'UTC',
        asOfDate: testCase.asOfDate,
        records: testCase.records ?? []
      }));
      expect(result.onTrack, testCase.name).toMatchObject({
        kind: 'scored',
        score: testCase.expectedScore,
        evidence: {
          lastQualifyingCompletionDate: testCase.expectedLastCompletion,
          missedOccurrenceCount: testCase.expectedMissed,
          deduction: testCase.expectedMissed * 10
        }
      });
      if (result.onTrack.kind !== 'scored') throw new Error(`${testCase.name} should be scored.`);
      expect(result.onTrack.evidence.occurrences.at(-1)).toMatchObject({
        date: testCase.asOfDate,
        status: 'today',
        score: testCase.expectedScore
      });
    }
  });

  it('resets on one qualifying occurrence, ignores duplicate and off-schedule logs, and recalculates after edits', () => {
    const schedule: RhythmSchedule = { frequency: 'weekly', weekdays: [1, 3, 5] };
    const start = '2026-10-19';
    const makeResult = (records: RhythmCompletionRecord[]) => scored(input({
      schedule,
      scoring: scoring(start, [{ startDate: start, schedule }]),
      createdLocalDate: start,
      createdTimeZone: 'UTC',
      asOfDate: '2026-10-23',
      records
    }));

    const afterWednesdayTend = makeResult([
      record('monday', '2026-10-19'),
      record('wednesday-a', '2026-10-21'),
      record('wednesday-b', '2026-10-21'),
      record('thursday-off-schedule', '2026-10-22')
    ]);
    expect(afterWednesdayTend.onTrack).toMatchObject({
      kind: 'scored',
      score: 100,
      evidence: {
        lastQualifyingCompletionDate: '2026-10-21',
        missedOccurrenceCount: 0,
        deduction: 0
      }
    });

    const afterDeletingWednesday = makeResult([
      record('monday', '2026-10-19'),
      record('tuesday-off-schedule', '2026-10-20'),
      record('thursday-off-schedule', '2026-10-22')
    ]);
    expect(afterDeletingWednesday.onTrack).toMatchObject({
      kind: 'scored',
      score: 90,
      evidence: {
        lastQualifyingCompletionDate: '2026-10-19',
        missedOccurrenceCount: 1,
        deduction: 10
      }
    });
  });

  it('preserves score evidence across schedule-history transitions without charging unscheduled gaps', () => {
    const firstSchedule: RhythmSchedule = { frequency: 'weekly', weekdays: [1] };
    const secondSchedule: RhythmSchedule = { frequency: 'weekly', weekdays: [4] };
    const start = '2026-10-19';
    const history: RhythmScoringMetadata['scheduleHistory'] = [
      { startDate: start, endDate: '2026-10-21', schedule: firstSchedule },
      { startDate: '2026-10-22', schedule: secondSchedule }
    ];
    const result = scored(input({
      schedule: secondSchedule,
      scoring: scoring(start, history),
      createdLocalDate: start,
      createdTimeZone: 'UTC',
      asOfDate: '2026-10-24',
      records: [record('old-schedule-completion', '2026-10-19')]
    }));
    expect(result.onTrack).toMatchObject({
      kind: 'scored',
      score: 90,
      evidence: {
        lastQualifyingCompletionDate: '2026-10-19',
        missedOccurrenceCount: 1,
        scheduleChanges: [{ date: '2026-10-22', score: 100 }]
      }
    });
  });

  it('returns a precise unavailable reason when unknown history can still affect the score', () => {
    const schedule: RhythmSchedule = { frequency: 'weekly', weekdays: [4] };
    const scoringStart = '2026-10-05';
    const history: RhythmScoringMetadata['scheduleHistory'] = [
      { startDate: scoringStart, schedule }
    ];
    const uncertain = scored(input({
      schedule,
      scoring: scoring(scoringStart, history),
      createdLocalDate: scoringStart,
      createdTimeZone: 'UTC',
      asOfDate: '2026-10-10',
      records: [record('pre-history', '2026-10-01')]
    }));
    expect(uncertain.onTrack).toMatchObject({
      kind: 'unscored',
      reasonCode: 'unsupported-history',
      explanation: 'The schedule history does not cover part of the On Track period, so missed occurrences cannot be reconstructed.'
    });

    const resetAfterUnknown = scored(input({
      schedule,
      scoring: scoring(scoringStart, history),
      createdLocalDate: scoringStart,
      createdTimeZone: 'UTC',
      asOfDate: '2026-10-10',
      records: [record('pre-history', '2026-10-01'), record('known-reset', '2026-10-08')]
    }));
    expect(resetAfterUnknown.onTrack).toMatchObject({
      kind: 'scored',
      score: 100,
      evidence: { lastQualifyingCompletionDate: '2026-10-08', missedOccurrenceCount: 0 }
    });
  });

  it('caps long histories at each frequency maximum lookback', () => {
    const cases: {
      schedule: RhythmSchedule;
      windowStart: string;
      expectedDue: number;
    }[] = [
      { schedule: dailySchedule, windowStart: '2026-09-24', expectedDue: 29 },
      {
        schedule: { frequency: 'weekly', weekdays: [1, 3] },
        windowStart: '2026-09-23',
        expectedDue: 9
      },
      {
        schedule: { frequency: 'weekly', weekdays: [1] },
        windowStart: '2026-07-31',
        expectedDue: 12
      },
      {
        schedule: { frequency: 'monthly', pattern: { kind: 'dayOfMonth', day: 'last' } },
        windowStart: '2026-04-23',
        expectedDue: 6
      },
      {
        schedule: { frequency: 'quarterly', monthInQuarter: 1, pattern: { kind: 'dayOfMonth', day: 1 } },
        windowStart: '2025-10-23',
        expectedDue: 4
      },
      {
        schedule: { frequency: 'yearly', month: 2, pattern: { kind: 'dayOfMonth', day: 28 } },
        windowStart: '2024-10-23',
        expectedDue: 2
      }
    ];
    for (const testCase of cases) {
      const segments: RhythmScoringMetadata['scheduleHistory'] = [
        { startDate: '2020-01-01', schedule: testCase.schedule }
      ];
      const result = scored(input({
        schedule: testCase.schedule,
        scoring: scoring('2020-01-01', segments),
        createdLocalDate: '2020-01-01',
        createdTimeZone: 'UTC',
        records: []
      }));
      expect(result.consistency).toMatchObject({
        kind: 'scored',
        score: 0,
        evidence: {
          windowStartDate: testCase.windowStart,
          windowEndDate: '2026-10-22',
          eligibleDueCount: testCase.expectedDue
        }
      });
    }
  });

  it('does not invent short-month occurrences or score a window with no due dates', () => {
    const schedule = { frequency: 'monthly', pattern: { kind: 'dayOfMonth', day: 31 } } as const;
    const result = selectDailyRhythmScore(input({
      schedule,
      scoring: scoring('2026-02-01', [{ startDate: '2026-02-01', schedule }]),
      createdLocalDate: '2026-02-01',
      createdTimeZone: 'UTC',
      asOfDate: '2026-03-01',
      records: []
    }));
    expect(result).toMatchObject({
      kind: 'rhythm-score',
      consistency: { kind: 'unscored', reasonCode: 'no-eligible-occurrences' }
    });
  });

  it('keeps On Track ready for a first Tend without metadata and flags timezone mismatch', () => {
    expect(scored(input({ scoring: undefined })).onTrack).toMatchObject({
      kind: 'unscored',
      reasonCode: 'ready-for-first-tend'
    });
    expect(scored(input({
      scoring: scoring(asOfDate),
      records: []
    }))).toMatchObject({
      trackingStartDate: null,
      consistency: { kind: 'unscored', reasonCode: 'ready-for-first-tend' },
      onTrack: { kind: 'unscored', reasonCode: 'ready-for-first-tend' }
    });
    expect(scored(input({
      scoring: undefined,
      records: [{
        ...record('zone-mismatch', '2026-10-20'),
        timeZone: 'America/Los_Angeles'
      }]
    })).onTrack).toMatchObject({
      kind: 'unscored',
      reasonCode: 'timezone-uncertain'
    });
  });
});
