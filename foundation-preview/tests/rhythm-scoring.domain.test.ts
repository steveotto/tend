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
  expect(result.kind).toBe('daily-score');
  if (result.kind !== 'daily-score') throw new Error('Expected a daily scoring result.');
  return result;
}

describe('daily occurrence scoring', () => {
  it('scores empty, partial, duplicate, complete and zero-floor histories from dated evidence', () => {
    const empty = scored(input({ asOfDate: '2026-10-03', scoring: scoring('2026-10-01'), records: [] }));
    expect(empty.consistency).toMatchObject({
      kind: 'scored',
      score: 0,
      evidence: { eligibleDueCount: 2, completedCount: 0, notCompletedCount: 2 }
    });
    expect(empty.onTrack).toMatchObject({
      kind: 'scored',
      score: 80,
      evidence: { overdueDates: ['2026-10-01', '2026-10-02'], deduction: 20 }
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
      exactPercent: 10,
      evidence: { eligibleDueCount: 30, completedCount: 3, notCompletedCount: 27 }
    });
    expect(partial.consistency.kind === 'scored'
      && partial.consistency.evidence.occurrences.find(item => item.date === '2026-09-24'))
      .toMatchObject({ status: 'completed', recordIds: ['duplicate-a', 'duplicate-b'] });
    expect(partial.onTrack).toMatchObject({
      kind: 'scored',
      score: 70,
      evidence: {
        lastQualifyingCompletionDate: '2026-10-19',
        overdueDates: ['2026-10-20', '2026-10-21', '2026-10-22'],
        deduction: 30
      }
    });

    const complete = scored(input({
      records: Array.from({ length: 30 }, (_, index) => record(`complete-${index}`, addCalendarDays(trackingStartDate, index)))
    }));
    expect(complete.consistency).toMatchObject({
      kind: 'scored',
      score: 100,
      evidence: { eligibleDueCount: 30, completedCount: 30 }
    });
    expect(complete.onTrack).toMatchObject({ kind: 'scored', score: 100 });

    const zeroFloor = scored(input({
      asOfDate: '2026-10-23',
      scoring: scoring('2026-10-01'),
      records: []
    }));
    expect(zeroFloor.onTrack).toMatchObject({
      kind: 'scored',
      score: 0,
      evidence: { overdueDates: Array.from({ length: 22 }, (_, index) => addCalendarDays('2026-10-01', index)), deduction: 220 }
    });
  });

  it('clips Consistency to the tracking start, excludes today, and includes closed schedule dates', () => {
    const start = '2026-10-21';
    const endedSegment: RhythmScoringMetadata['scheduleHistory'] = [
      { startDate: start, endDate: '2026-10-22', schedule: dailySchedule },
      { startDate: '2026-10-23', schedule: dailySchedule }
    ];
    const result = scored(input({
      asOfDate,
      scoring: scoring(start, endedSegment),
      records: [
        record('before-start', '2026-10-20'),
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
        windowEndDate: '2026-10-22',
        eligibleDueCount: 2,
        completedCount: 2,
        occurrences: [{ date: '2026-10-21' }, { date: '2026-10-22' }]
      }
    });
    expect(result.onTrack).toMatchObject({ kind: 'scored', score: 100 });

    const startedToday = scored(input({
      asOfDate,
      scoring: scoring(asOfDate),
      records: [record('today-only', asOfDate)]
    }));
    expect(startedToday.consistency).toMatchObject({
      kind: 'unscored',
      reasonCode: 'no-eligible-occurrences'
    });
    expect(startedToday.onTrack).toMatchObject({ kind: 'scored', score: 100 });
    expect(startedToday.healthScore).toBeNull();
  });

  it('applies today’s qualifying completion without a deduction and evaluates backdated edits by effective date', () => {
    const today = scored(input({ records: [record('today', asOfDate)] }));
    expect(today.onTrack).toMatchObject({
      kind: 'scored',
      score: 100,
      evidence: {
        lastQualifyingCompletionDate: asOfDate,
        overdueDates: [],
        deduction: 0,
        days: [{ date: asOfDate, status: 'tended', score: 100 }]
      }
    });

    const baseline = scored(input({ records: [record('latest', '2026-10-20')] }));
    const withBackdatedAddition = scored(input({
      records: [record('latest', '2026-10-20'), record('backdated', '2026-10-01')]
    }));
    expect(withBackdatedAddition.onTrack).toEqual(baseline.onTrack);
    const edited = scored(input({ records: [record('latest', '2026-10-21')] }));
    expect(edited.onTrack).toMatchObject({ kind: 'scored', score: 90 });
    const deleted = scored(input({ records: [] }));
    expect(deleted.onTrack).toMatchObject({ kind: 'scored', score: 0 });
    const undoRestored = scored(input({ records: [record('latest', '2026-10-20')] }));
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
    expect(selectDailyRhythmScore(input({ scoring: undefined }))).toMatchObject({
      kind: 'unscored',
      reason: { reasonCode: 'missing-tracking-start' },
      healthScore: null
    });
    expect(selectDailyRhythmScore(input({
      schedule: { frequency: 'weekly', weekdays: [1] } satisfies RhythmSchedule
    }))).toMatchObject({
      kind: 'unscored',
      reason: { reasonCode: 'unsupported-schedule' }
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
      { startDate: '2026-09-23', endDate: '2026-10-10', schedule: { frequency: 'weekly', weekdays: [1] } },
      { startDate: '2026-10-11', schedule: dailySchedule }
    ];
    const acrossUnsupportedHistory = scored(input({
      scoring: scoring(trackingStartDate, history),
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
        overdueDates: ['2026-10-21', '2026-10-22'],
        deduction: 20
      }
    });
    expect(acrossUnsupportedHistory.healthScore).toBeNull();

    const noLatestTend = selectDailyRhythmScore(input({
      scoring: scoring(trackingStartDate, history),
      records: []
    }));
    expect(noLatestTend).toMatchObject({
      kind: 'daily-score',
      onTrack: { kind: 'unscored', reasonCode: 'unsupported-history' }
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
      scoring: scoring(trackingStartDate, [{ startDate: trackingStartDate, schedule: orderedSchedule }])
    }));
    expect(result.consistency.kind).toBe('scored');
  });
});
