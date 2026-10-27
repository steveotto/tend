import { describe, expect, it } from 'vitest';
import type { RhythmCompletionRecord } from '../src/domain/rhythm-completion.ts';
import {
  addCalendarDays,
  localDateInTimeZone,
  selectDailyRhythmScore
} from '../src/domain/rhythm-scoring.ts';
import type { SelectDailyRhythmScoreInput } from '../src/domain/rhythm-scoring.ts';
import type { RhythmSchedule, RhythmScoringMetadata } from '../src/domain/rhythm-schedule.ts';
import { createRhythmSeason } from '../src/domain/rhythm-seasons.ts';

const rhythmId = 'daily-test-rhythm';
const asOfDate = '2026-10-23';
const trackingStartDate = '2026-09-23';
const dailySchedule = { frequency: 'daily' } as const;
type SegmentFixture = { startDate: string; schedule: RhythmSchedule };

function record(id: string, effectiveDate: string, targetId = rhythmId): RhythmCompletionRecord {
  return { id, rhythmId: targetId, effectiveDate };
}

function scoring(
  startDate = trackingStartDate,
  scheduleHistory: SegmentFixture[] = [
    { startDate, schedule: dailySchedule }
  ],
  timeZone = 'UTC'
): RhythmScoringMetadata {
  return {
    trackingStartDate: startDate,
    timeZone,
    scheduleHistory: scheduleHistory.map(segment => createRhythmSeason(rhythmId, segment.startDate, segment.schedule))
  };
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
  if (result.kind !== 'rhythm-score') throw new Error(`Expected a rhythm scoring result: ${result.reason}`);
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
    const scheduleHistory: SegmentFixture[] = [
      {
        startDate: boundaryStart,
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
    const endedSegment: SegmentFixture[] = [
      { startDate: start, schedule: dailySchedule },
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
    const today = scored(input({ scoring: scoring(asOfDate), records: [record('today', asOfDate)] }));
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

    const history: SegmentFixture[] = [
      {
        startDate: '2026-09-23',
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

  it('keeps On Track unavailable before the first eligible occurrence', () => {
    const schedule: RhythmSchedule = {
      frequency: 'quarterly',
      monthInQuarter: 1,
      pattern: { kind: 'dayOfMonth', day: 1 }
    };
    const result = scored(input({
      schedule,
      scoring: {
        trackingStartDate: asOfDate,
        timeZone: 'UTC',
        scheduleHistory: [createRhythmSeason(rhythmId, asOfDate, schedule)]
      },
      createdLocalDate: asOfDate,
      createdTimeZone: 'UTC',
      records: []
    }));
    expect(result.consistency).toMatchObject({
      kind: 'unscored',
      reasonCode: 'no-eligible-occurrences',
      explanation: 'No scheduled moments to measure yet.'
    });
    expect(result.onTrack).toMatchObject({
      kind: 'unscored',
      reasonCode: 'ready-for-first-tend',
      explanation: 'Starts with your first Tend.'
    });
    expect(result.healthScore).toBeNull();
  });

  it('requires a qualifying completion or an ended eligible occurrence across every supported frequency', () => {
    const today = '2026-10-23';
    const cases: { name: string; schedule: RhythmSchedule }[] = [
      { name: 'Daily', schedule: { frequency: 'daily' } },
      { name: 'selected weekdays', schedule: { frequency: 'weekly', weekdays: [5] } },
      { name: 'Monthly', schedule: { frequency: 'monthly', pattern: { kind: 'dayOfMonth', day: 23 } } },
      {
        name: 'Quarterly',
        schedule: { frequency: 'quarterly', monthInQuarter: 1, pattern: { kind: 'dayOfMonth', day: 23 } }
      },
      { name: 'Yearly', schedule: { frequency: 'yearly', month: 10, pattern: { kind: 'dayOfMonth', day: 23 } } },
      { name: 'Custom', schedule: { frequency: 'custom', unit: 'days', interval: 1, startDate: today } }
    ];

    for (const testCase of cases) {
      const base = {
        asOfDate: today,
        schedule: testCase.schedule,
        scoring: scoring(today, [{ startDate: today, schedule: testCase.schedule }]),
        createdLocalDate: today,
        createdTimeZone: 'UTC'
      };
      const withoutCompletion = scored(input({ ...base, records: [] }));
      expect(withoutCompletion.onTrack, testCase.name).toMatchObject({
        kind: 'unscored',
        reasonCode: 'ready-for-first-tend',
        explanation: 'Starts with your first Tend.'
      });
      expect(withoutCompletion.healthScore, testCase.name).toBeNull();

      const completedToday = scored(input({
        ...base,
        records: [record(`${testCase.name}-today`, today)]
      }));
      expect(completedToday.onTrack, testCase.name).toMatchObject({ kind: 'scored', score: 100 });
    }
  });

  it('scores one ended miss without a completion and keeps due-today occurrences pending', () => {
    const cases: {
      name: string;
      schedule: RhythmSchedule;
      trackingStartDate: string;
      asOfDate: string;
    }[] = [
      { name: 'Daily', schedule: { frequency: 'daily' }, trackingStartDate: '2026-10-22', asOfDate: '2026-10-23' },
      {
        name: 'selected weekdays',
        schedule: { frequency: 'weekly', weekdays: [1] },
        trackingStartDate: '2026-10-19',
        asOfDate: '2026-10-26'
      },
      {
        name: 'Monthly',
        schedule: { frequency: 'monthly', pattern: { kind: 'dayOfMonth', day: 15 } },
        trackingStartDate: '2026-10-15',
        asOfDate: '2026-11-01'
      },
      {
        name: 'Quarterly',
        schedule: { frequency: 'quarterly', monthInQuarter: 1, pattern: { kind: 'dayOfMonth', day: 1 } },
        trackingStartDate: '2027-01-01',
        asOfDate: '2027-04-01'
      },
      {
        name: 'Yearly',
        schedule: { frequency: 'yearly', month: 10, pattern: { kind: 'dayOfMonth', day: 23 } },
        trackingStartDate: '2026-10-23',
        asOfDate: '2027-01-01'
      },
      {
        name: 'Custom',
        schedule: { frequency: 'custom', unit: 'days', interval: 2, startDate: '2026-10-20' },
        trackingStartDate: '2026-10-20',
        asOfDate: '2026-10-21'
      }
    ];

    for (const testCase of cases) {
      const result = scored(input({
        schedule: testCase.schedule,
        scoring: scoring(testCase.trackingStartDate, [{
          startDate: testCase.trackingStartDate,
          schedule: testCase.schedule
        }]),
        createdLocalDate: testCase.trackingStartDate,
        createdTimeZone: 'UTC',
        asOfDate: testCase.asOfDate,
        records: []
      }));
      expect(result.onTrack, testCase.name).toMatchObject({
        kind: 'scored',
        score: 90,
        evidence: { missedOccurrenceCount: 1, deduction: 10 }
      });
    }

    const quarterly: RhythmSchedule = {
      frequency: 'quarterly',
      monthInQuarter: 1,
      pattern: { kind: 'dayOfMonth', day: 1 }
    };
    const dueToday = scored(input({
      schedule: quarterly,
      scoring: scoring('2027-01-01', [{ startDate: '2027-01-01', schedule: quarterly }]),
      createdLocalDate: '2027-01-01',
      createdTimeZone: 'UTC',
      asOfDate: '2027-01-01',
      records: []
    }));
    expect(dueToday.onTrack).toMatchObject({
      kind: 'unscored',
      reasonCode: 'ready-for-first-tend',
      explanation: 'Starts with your first Tend.'
    });

    const missedQuarterlyOccurrence = scored(input({
      schedule: quarterly,
      scoring: scoring('2027-01-01', [{ startDate: '2027-01-01', schedule: quarterly }]),
      createdLocalDate: '2027-01-01',
      createdTimeZone: 'UTC',
      asOfDate: '2027-04-01',
      records: []
    }));
    expect(missedQuarterlyOccurrence).toMatchObject({
      consistency: { kind: 'scored', score: 0, evidence: { eligibleDueCount: 1, notCompletedCount: 1 } },
      onTrack: { kind: 'scored', score: 90, evidence: { missedOccurrenceCount: 1 } },
      healthScore: 22.5
    });
  });

  it('does not unlock On Track with an off-schedule log or after deleting the only qualifying log', () => {
    const mondaySchedule: RhythmSchedule = { frequency: 'weekly', weekdays: [1] };
    const offScheduleLog = scored(input({
      schedule: mondaySchedule,
      scoring: scoring(asOfDate, [{ startDate: asOfDate, schedule: mondaySchedule }]),
      createdLocalDate: asOfDate,
      createdTimeZone: 'UTC',
      records: [record('off-schedule-today', asOfDate)]
    }));
    expect(offScheduleLog.onTrack).toMatchObject({
      kind: 'unscored',
      reasonCode: 'ready-for-first-tend',
      explanation: 'Starts with your first Tend.'
    });

    const onlyCompletion = scored(input({
      scoring: undefined,
      records: [record('only-qualifying-today', asOfDate)]
    }));
    expect(onlyCompletion.onTrack).toMatchObject({ kind: 'scored', score: 100 });
    const afterDeletingCompletion = scored(input({
      scoring: undefined,
      records: []
    }));
    expect(afterDeletingCompletion).toMatchObject({
      trackingStartDate: null,
      consistency: { kind: 'unscored', reasonCode: 'ready-for-first-tend' },
      onTrack: {
        kind: 'unscored',
        reasonCode: 'ready-for-first-tend',
        explanation: 'Starts with your first Tend.'
      },
      healthScore: null
    });
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

  it('uses explicit Season tracking instead of the implicit creation date', () => {
    const explicitTrackingStart = '2026-10-20';
    const result = scored(input({
      scoring: scoring(explicitTrackingStart),
      createdLocalDate: '2026-10-01',
      createdTimeZone: 'UTC'
    }));

    expect(result.trackingStartDate).toBe(explicitTrackingStart);
    expect(result.consistency).toMatchObject({
      kind: 'scored',
      evidence: {
        windowStartDate: explicitTrackingStart,
        windowEndDate: '2026-10-22',
        eligibleDueCount: 3,
        completedCount: 0
      }
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
      const segments: SegmentFixture[] = [
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

  it('credits one period occurrence once for early, on-date, and late completions', () => {
    const monthly: RhythmSchedule = {
      frequency: 'monthly',
      pattern: { kind: 'dayOfMonth', day: 1 }
    };
    const monthlyRecords = [
      record('october-early', '2026-10-17'),
      record('october-extra-a', '2026-10-18'),
      record('october-extra-b', '2026-10-20')
    ];
    const monthlyResult = scored(input({
      schedule: monthly,
      scoring: scoring('2026-10-01', [{ startDate: '2026-10-01', schedule: monthly }]),
      createdLocalDate: '2026-10-01',
      createdTimeZone: 'UTC',
      asOfDate: '2026-10-21',
      records: monthlyRecords
    }));
    expect(monthlyResult.consistency).toMatchObject({
      kind: 'scored',
      evidence: {
        eligibleDueCount: 1,
        completedCount: 1,
        occurrences: [{
          date: '2026-10-01',
          status: 'completed',
          recordIds: ['october-early', 'october-extra-a', 'october-extra-b']
        }]
      }
    });
    expect(monthlyResult.onTrack).toMatchObject({
      kind: 'scored',
      score: 100,
      evidence: {
        lastQualifyingCompletionDate: '2026-10-17',
        missedOccurrenceCount: 0
      }
    });
    const afterRemovingFirstMonthlyLog = scored(input({
      schedule: monthly,
      scoring: scoring('2026-10-01', [{ startDate: '2026-10-01', schedule: monthly }]),
      createdLocalDate: '2026-10-01',
      createdTimeZone: 'UTC',
      asOfDate: '2026-10-21',
      records: monthlyRecords.slice(1)
    }));
    expect(afterRemovingFirstMonthlyLog.consistency).toMatchObject({
      kind: 'scored',
      evidence: {
        completedCount: 1,
        occurrences: [{
          date: '2026-10-01',
          status: 'completed',
          recordIds: ['october-extra-a', 'october-extra-b']
        }]
      }
    });
    expect(afterRemovingFirstMonthlyLog.onTrack).toMatchObject({
      kind: 'scored',
      score: 100,
      evidence: { missedOccurrenceCount: 0 }
    });

    const earlyMonthly: RhythmSchedule = {
      frequency: 'monthly',
      pattern: { kind: 'dayOfMonth', day: 20 }
    };
    const early = scored(input({
      schedule: earlyMonthly,
      scoring: scoring('2026-10-01', [{ startDate: '2026-10-01', schedule: earlyMonthly }]),
      createdLocalDate: '2026-10-01',
      createdTimeZone: 'UTC',
      asOfDate: '2026-10-21',
      records: [record('before-due-date', '2026-10-17')]
    }));
    expect(early.consistency).toMatchObject({
      kind: 'scored',
      evidence: { completedCount: 1, occurrences: [{ date: '2026-10-20', status: 'completed' }] }
    });
    expect(early.onTrack).toMatchObject({
      kind: 'scored',
      score: 100,
      evidence: { lastQualifyingCompletionDate: '2026-10-17', missedOccurrenceCount: 0 }
    });

    const weekly: RhythmSchedule = { frequency: 'weekly', weekdays: [1] };
    const weeklyLate = scored(input({
      schedule: weekly,
      scoring: scoring('2026-10-12', [{ startDate: '2026-10-12', schedule: weekly }]),
      createdLocalDate: '2026-10-12',
      createdTimeZone: 'UTC',
      asOfDate: '2026-10-24',
      records: [
        record('previous-week', '2026-10-18'),
        record('later-weekday', '2026-10-23')
      ]
    }));
    expect(weeklyLate.consistency).toMatchObject({
      kind: 'scored',
      evidence: {
        completedCount: 2,
        occurrences: expect.arrayContaining([
          {
            date: '2026-10-12',
            status: 'completed',
            recordIds: ['previous-week'],
            periodStartDate: '2026-10-12',
            eligibleEndDate: '2026-10-18'
          },
          {
            date: '2026-10-19',
            status: 'completed',
            recordIds: ['later-weekday'],
            periodStartDate: '2026-10-19',
            eligibleEndDate: '2026-10-25'
          }
        ])
      }
    });
    expect(weeklyLate.onTrack).toMatchObject({
      kind: 'scored',
      score: 100,
      evidence: { lastQualifyingCompletionDate: '2026-10-23', missedOccurrenceCount: 0 }
    });

    const quarterly: RhythmSchedule = {
      frequency: 'quarterly',
      monthInQuarter: 1,
      pattern: { kind: 'dayOfMonth', day: 1 }
    };
    const quarterLate = scored(input({
      schedule: quarterly,
      scoring: scoring('2026-10-01', [{ startDate: '2026-10-01', schedule: quarterly }]),
      createdLocalDate: '2026-10-01',
      createdTimeZone: 'UTC',
      asOfDate: '2026-11-01',
      records: [record('quarter-late', '2026-10-30')]
    }));
    expect(quarterLate.consistency).toMatchObject({
      kind: 'scored',
      evidence: { completedCount: 1, occurrences: [{ date: '2026-10-01', status: 'completed' }] }
    });
    expect(quarterLate.onTrack).toMatchObject({
      kind: 'scored',
      score: 100,
      evidence: { lastQualifyingCompletionDate: '2026-10-30', missedOccurrenceCount: 0 }
    });

    const yearly: RhythmSchedule = {
      frequency: 'yearly',
      month: 2,
      pattern: { kind: 'dayOfMonth', day: 28 }
    };
    const yearLate = scored(input({
      schedule: yearly,
      scoring: scoring('2026-01-01', [{ startDate: '2026-01-01', schedule: yearly }]),
      createdLocalDate: '2026-01-01',
      createdTimeZone: 'UTC',
      asOfDate: '2026-12-02',
      records: [record('year-late', '2026-12-01')]
    }));
    expect(yearLate.consistency).toMatchObject({
      kind: 'scored',
      evidence: { completedCount: 1, occurrences: [{ date: '2026-02-28', status: 'completed' }] }
    });
    expect(yearLate.onTrack).toMatchObject({
      kind: 'scored',
      score: 100,
      evidence: { lastQualifyingCompletionDate: '2026-12-01', missedOccurrenceCount: 0 }
    });

    const quarterBoundarySchedule: RhythmSchedule = {
      frequency: 'quarterly',
      monthInQuarter: 1,
      pattern: { kind: 'dayOfMonth', day: 1 }
    };
    const quarterBoundary = scored(input({
      schedule: quarterBoundarySchedule,
      scoring: scoring('2026-01-01', [{
        startDate: '2026-01-01',
        schedule: quarterBoundarySchedule
      }]),
      createdLocalDate: '2026-01-01',
      createdTimeZone: 'UTC',
      asOfDate: '2026-04-01',
      records: [record('quarter-end', '2026-03-31')]
    }));
    expect(quarterBoundary.consistency).toMatchObject({
      kind: 'scored',
      evidence: { completedCount: 1, occurrences: [{ date: '2026-01-01', status: 'completed' }] }
    });
    expect(quarterBoundary.onTrack).toMatchObject({
      kind: 'scored',
      score: 100,
      evidence: { lastQualifyingCompletionDate: '2026-03-31', missedOccurrenceCount: 0 }
    });

    const ordinalYearly: RhythmSchedule = {
      frequency: 'yearly',
      month: 10,
      pattern: { kind: 'ordinalWeekday', ordinal: 'last', weekday: 4 }
    };
    const ordinalLate = scored(input({
      schedule: ordinalYearly,
      scoring: scoring('2026-10-01', [{ startDate: '2026-10-01', schedule: ordinalYearly }]),
      createdLocalDate: '2026-10-01',
      createdTimeZone: 'UTC',
      asOfDate: '2027-01-01',
      records: [record('ordinal-year-end', '2026-12-31')]
    }));
    expect(ordinalLate.consistency).toMatchObject({
      kind: 'scored',
      evidence: { completedCount: 1, occurrences: [{ date: '2026-10-29', status: 'completed' }] }
    });
    expect(ordinalLate.onTrack).toMatchObject({
      kind: 'scored',
      score: 100,
      evidence: { lastQualifyingCompletionDate: '2026-12-31', missedOccurrenceCount: 0 }
    });

    const leapYearSchedule: RhythmSchedule = {
      frequency: 'yearly',
      month: 2,
      pattern: { kind: 'dayOfMonth', day: 29 }
    };
    const leapYear = scored(input({
      schedule: leapYearSchedule,
      scoring: scoring('2024-01-01', [{ startDate: '2024-01-01', schedule: leapYearSchedule }]),
      createdLocalDate: '2024-01-01',
      createdTimeZone: 'UTC',
      asOfDate: '2024-03-02',
      records: [record('leap-late', '2024-03-01')]
    }));
    expect(leapYear.consistency).toMatchObject({
      kind: 'scored',
      evidence: { completedCount: 1, occurrences: [{ date: '2024-02-29', status: 'completed' }] }
    });
  });

  it('distinguishes a single-day Select Days occurrence from single-weekday Weekly period credit', () => {
    const weekly: RhythmSchedule = { frequency: 'weekly', weekdays: [1] };
    const selectDays: RhythmSchedule = {
      frequency: 'weekly',
      weekdays: [1],
      weeklyMode: 'select-days'
    };
    const tuesdayLogs = [
      record('tuesday-a', '2026-10-20'),
      record('tuesday-b', '2026-10-20')
    ];
    const mondayLogs = [
      record('monday-a', '2026-10-19'),
      record('monday-b', '2026-10-19')
    ];
    const scoreFor = (
      schedule: RhythmSchedule,
      records: RhythmCompletionRecord[]
    ) => scored(input({
      schedule,
      scoring: scoring('2026-10-19', [{ startDate: '2026-10-19', schedule }]),
      createdLocalDate: '2026-10-19',
      createdTimeZone: 'UTC',
      asOfDate: '2026-10-25',
      records
    }));

    const weeklyTuesday = scoreFor(weekly, tuesdayLogs);
    expect(weeklyTuesday.consistency).toMatchObject({
      kind: 'scored',
      evidence: {
        eligibleDueCount: 1,
        completedCount: 1,
        occurrences: [{ date: '2026-10-19', status: 'completed', recordIds: ['tuesday-a', 'tuesday-b'] }]
      }
    });
    expect(weeklyTuesday.onTrack).toMatchObject({
      kind: 'scored',
      score: 100,
      evidence: { missedOccurrenceCount: 0 }
    });

    const selectDaysTuesday = scoreFor(selectDays, tuesdayLogs);
    expect(selectDaysTuesday.consistency).toMatchObject({
      kind: 'scored',
      evidence: {
        eligibleDueCount: 1,
        completedCount: 0,
        occurrences: [{ date: '2026-10-19', status: 'not-completed', recordIds: [] }]
      }
    });
    expect(selectDaysTuesday.onTrack).toMatchObject({
      kind: 'scored',
      score: 90,
      evidence: { missedOccurrenceCount: 1 }
    });

    for (const schedule of [weekly, selectDays]) {
      const mondayScore = scoreFor(schedule, [...tuesdayLogs, ...mondayLogs]);
      expect(mondayScore.consistency).toMatchObject({
        kind: 'scored',
        evidence: {
          eligibleDueCount: 1,
          completedCount: 1,
          occurrences: [{
            date: '2026-10-19',
            status: 'completed',
            recordIds: schedule === weekly
              ? ['monday-a', 'monday-b', 'tuesday-a', 'tuesday-b']
              : ['monday-a', 'monday-b']
          }]
        }
      });
      expect(mondayScore.onTrack).toMatchObject({
        kind: 'scored',
        score: 100,
        evidence: { missedOccurrenceCount: 0 }
      });
    }

    const legacyAmbiguous = scoreFor(
      { frequency: 'weekly', weekdays: [1] },
      tuesdayLogs
    );
    expect(legacyAmbiguous.consistency).toMatchObject({
      kind: 'scored',
      evidence: { completedCount: 1 }
    });
  });

  it('does not carry records across period or Season boundaries and clips tracking starts', () => {
    const monthly: RhythmSchedule = {
      frequency: 'monthly',
      pattern: { kind: 'dayOfMonth', day: 1 }
    };
    const priorPeriod = scored(input({
      schedule: monthly,
      scoring: scoring('2026-09-01', [{ startDate: '2026-09-01', schedule: monthly }]),
      createdLocalDate: '2026-09-01',
      createdTimeZone: 'UTC',
      asOfDate: '2026-11-02',
      records: [record('september-only', '2026-09-30')]
    }));
    expect(priorPeriod.consistency).toMatchObject({
      kind: 'scored',
      evidence: {
        occurrences: expect.arrayContaining([
          {
            date: '2026-09-01',
            status: 'completed',
            recordIds: ['september-only'],
            periodStartDate: '2026-09-01',
            eligibleEndDate: '2026-09-30'
          },
          {
            date: '2026-10-01',
            status: 'not-completed',
            recordIds: [],
            periodStartDate: '2026-10-01',
            eligibleEndDate: '2026-10-31'
          },
          {
            date: '2026-11-01',
            status: 'not-completed',
            recordIds: [],
            periodStartDate: '2026-11-01',
            eligibleEndDate: '2026-11-30'
          }
        ])
      }
    });
    expect(priorPeriod.onTrack).toMatchObject({
      kind: 'scored',
      score: 90,
      evidence: { missedOccurrenceCount: 1 }
    });

    const startsMidPeriod = scored(input({
      schedule: monthly,
      scoring: scoring('2026-10-17', [{ startDate: '2026-10-17', schedule: monthly }]),
      createdLocalDate: '2026-10-17',
      createdTimeZone: 'UTC',
      asOfDate: '2026-10-21',
      records: [record('after-tracking-start', '2026-10-17')]
    }));
    expect(startsMidPeriod.consistency).toMatchObject({
      kind: 'unscored',
      reasonCode: 'no-eligible-occurrences'
    });
    expect(startsMidPeriod.onTrack).toMatchObject({
      kind: 'unscored',
      reasonCode: 'ready-for-first-tend'
    });

    const oldSeason: RhythmSchedule = {
      frequency: 'monthly',
      pattern: { kind: 'dayOfMonth', day: 1 },
      endDate: '2026-10-14'
    };
    const newSeason: RhythmSchedule = {
      frequency: 'monthly',
      pattern: { kind: 'dayOfMonth', day: 20 }
    };
    const boundary = scored(input({
      schedule: newSeason,
      scoring: scoring('2026-10-01', [
        { startDate: '2026-10-01', schedule: oldSeason },
        { startDate: '2026-10-15', schedule: newSeason }
      ]),
      createdLocalDate: '2026-10-01',
      createdTimeZone: 'UTC',
      asOfDate: '2026-10-21',
      records: [record('new-season-only', '2026-10-17')]
    }));
    expect(boundary.consistency).toMatchObject({
      kind: 'scored',
      evidence: {
        eligibleDueCount: 2,
        completedCount: 1,
        occurrences: [
          { date: '2026-10-01', status: 'not-completed', recordIds: [] },
          { date: '2026-10-20', status: 'completed', recordIds: ['new-season-only'] }
        ]
      }
    });
    expect(boundary.onTrack).toMatchObject({
      kind: 'scored',
      score: 100,
      evidence: { missedOccurrenceCount: 0, lastQualifyingCompletionDate: '2026-10-17' }
    });
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
        asOfDate: '2026-10-12',
        expectedMissed: 1,
        expectedScore: 90,
        expectedLastCompletion: null
      },
      {
        name: 'monthly ordinal weekday',
        schedule: { frequency: 'monthly', pattern: { kind: 'ordinalWeekday', ordinal: 1, weekday: 4 } },
        start: '2026-10-01',
        asOfDate: '2026-11-01',
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
        asOfDate: '2027-01-01',
        expectedMissed: 1,
        expectedScore: 90,
        expectedLastCompletion: null
      },
      {
        name: 'quarterly ordinal weekday',
        schedule: { frequency: 'quarterly', monthInQuarter: 2, pattern: { kind: 'ordinalWeekday', ordinal: 2, weekday: 1 } },
        start: '2026-02-09',
        asOfDate: '2026-04-01',
        expectedMissed: 1,
        expectedScore: 90,
        expectedLastCompletion: null
      },
      {
        name: 'yearly occurrence',
        schedule: { frequency: 'yearly', month: 2, pattern: { kind: 'dayOfMonth', day: 28 } },
        start: '2026-02-28',
        asOfDate: '2027-01-01',
        expectedMissed: 1,
        expectedScore: 90,
        expectedLastCompletion: null
      },
      {
        name: 'yearly ordinal weekday',
        schedule: { frequency: 'yearly', month: 10, pattern: { kind: 'ordinalWeekday', ordinal: 'last', weekday: 4 } },
        start: '2026-10-29',
        asOfDate: '2027-01-01',
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
    const history: SegmentFixture[] = [
      { startDate: start, schedule: firstSchedule },
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
      score: 100,
      evidence: {
        lastQualifyingCompletionDate: '2026-10-19',
        missedOccurrenceCount: 0,
        scheduleChanges: [{ date: '2026-10-22', score: 100 }]
      }
    });
  });

  it('returns a precise unavailable reason when unknown history can still affect the score', () => {
    const schedule: RhythmSchedule = { frequency: 'weekly', weekdays: [4] };
    const scoringStart = '2026-10-05';
    const history: SegmentFixture[] = [
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
        schedule: { frequency: 'weekly', weekdays: [1], weeklyMode: 'select-days' },
        windowStart: '2026-09-23',
        expectedDue: 4
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
      const segments: SegmentFixture[] = [
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

  it('uses one current-frequency window while combining each Season schedule occurrence', () => {
    const monthly: RhythmSchedule = {
      frequency: 'monthly',
      pattern: { kind: 'dayOfMonth', day: 1 }
    };
    const monthlyThenDaily: SegmentFixture[] = [
      { startDate: '2026-09-01', schedule: monthly },
      { startDate: '2026-10-21', schedule: dailySchedule }
    ];
    const dailyCurrent = scored(input({
      schedule: dailySchedule,
      scoring: scoring('2026-09-01', monthlyThenDaily),
      createdLocalDate: '2026-10-21',
      createdTimeZone: 'UTC',
      asOfDate: '2026-10-26',
      records: [record('earlier-monthly', '2026-10-01')]
    }));
    expect(dailyCurrent.consistency).toMatchObject({
      kind: 'scored',
      exactPercent: (1 / 6) * 100,
      evidence: {
        frequency: 'daily',
        windowStartDate: '2026-09-27',
        windowEndDate: '2026-10-25',
        eligibleDueCount: 6,
        completedCount: 1,
        notCompletedCount: 5
      }
    });

    const selectedDays: RhythmSchedule = {
      frequency: 'weekly',
      weekdays: [0, 2, 5, 6]
    };
    const dailyThenSelectedThenDaily: SegmentFixture[] = [
      { startDate: '2026-09-01', schedule: dailySchedule },
      { startDate: '2026-10-17', schedule: selectedDays },
      { startDate: '2026-10-21', schedule: dailySchedule }
    ];
    const mixedDaily = scored(input({
      schedule: dailySchedule,
      scoring: scoring('2026-09-01', dailyThenSelectedThenDaily),
      createdLocalDate: '2026-10-21',
      createdTimeZone: 'UTC',
      asOfDate: '2026-10-26',
      records: [
        record('selected-saturday', '2026-10-17'),
        record('selected-sunday', '2026-10-18'),
        record('selected-tuesday', '2026-10-20')
      ]
    }));
    expect(mixedDaily.consistency).toMatchObject({
      kind: 'scored',
      exactPercent: (3 / 28) * 100,
      evidence: {
        frequency: 'daily',
        windowStartDate: '2026-09-27',
        windowEndDate: '2026-10-25',
        eligibleDueCount: 28,
        completedCount: 3,
        notCompletedCount: 25,
        todayIncluded: false
      }
    });
    if (mixedDaily.consistency.kind !== 'scored') throw new Error('Expected mixed Daily evidence.');
    expect(mixedDaily.consistency.evidence.occurrences.map(occurrence => occurrence.date))
      .not.toContain('2026-10-26');

    const dailyThenMonthly: SegmentFixture[] = [
      { startDate: '2026-04-01', schedule: dailySchedule },
      { startDate: '2026-10-01', schedule: monthly }
    ];
    const mixedMonthly = scored(input({
      schedule: monthly,
      scoring: scoring('2026-04-01', dailyThenMonthly),
      createdLocalDate: '2026-10-01',
      createdTimeZone: 'UTC',
      asOfDate: '2026-10-26',
      records: [
        record('earlier-daily', '2026-04-30'),
        record('current-monthly', '2026-10-01')
      ]
    }));
    expect(mixedMonthly.consistency).toMatchObject({
      kind: 'scored',
      exactPercent: (2 / 159) * 100,
      evidence: {
        frequency: 'monthly',
        windowStartDate: '2026-04-26',
        windowEndDate: '2026-10-25',
        eligibleDueCount: 159,
        completedCount: 2,
        notCompletedCount: 157
      }
    });
    if (mixedMonthly.consistency.kind !== 'scored') throw new Error('Expected mixed Monthly evidence.');
    expect(mixedMonthly.consistency.evidence.occurrences[0]?.date).toBe('2026-04-26');
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
      consistency: {
        kind: 'unscored',
        reasonCode: 'no-eligible-occurrences',
        explanation: 'No scheduled moments to measure yet.'
      }
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
      trackingStartDate: asOfDate,
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
