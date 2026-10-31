import { describe, expect, it } from 'vitest';
import type { RhythmCompletionRecord } from '../src/domain/rhythm-completion.ts';
import {
  selectRhythmScore,
  selectRhythmSeasonScore
} from '../src/domain/rhythm-scoring.ts';
import type { SelectRhythmScoreInput } from '../src/domain/rhythm-scoring.ts';
import type { RhythmSchedule, RhythmScheduleHistorySegment } from '../src/domain/rhythm-schedule.ts';
import {
  createRhythmSeason,
  createUnknownRhythmSeason,
  rhythmSeasonInclusiveEndDate
} from '../src/domain/rhythm-seasons.ts';

const rhythmId = 'season-health-test';

function completion(id: string, effectiveDate: string, timeZone = 'UTC'): RhythmCompletionRecord {
  return { id, rhythmId, effectiveDate, timeZone };
}

function scoreInput(
  scheduleHistory: readonly RhythmScheduleHistorySegment[],
  asOfDate: string,
  records: readonly RhythmCompletionRecord[] = [],
  timeZone = 'UTC'
): SelectRhythmScoreInput {
  const latest = [...scheduleHistory].reverse().find(
    (season): season is Extract<RhythmScheduleHistorySegment, { kind: 'scheduled' }> =>
      season.kind === 'scheduled'
  );
  const firstScheduled = scheduleHistory.find(
    (season): season is Extract<RhythmScheduleHistorySegment, { kind: 'scheduled' }> =>
      season.kind === 'scheduled'
  );
  return {
    rhythmId,
    ...(latest ? { schedule: latest.schedule } : {}),
    ...(firstScheduled
      ? {
          scoring: {
            trackingStartDate: firstScheduled.startDate,
            timeZone,
            scheduleHistory: [...scheduleHistory]
          }
        }
      : {}),
    records,
    recordsAvailable: true,
    asOfDate,
    timeZone
  };
}

describe('Season-scoped Health scoring', () => {
  it('scores current and historical Seasons independently and excludes later logs', () => {
    const first = createRhythmSeason(rhythmId, '2026-10-01', { frequency: 'daily' }, undefined, 'season-first');
    const current = createRhythmSeason(rhythmId, '2026-10-04', { frequency: 'daily' }, undefined, 'season-current');
    const input = scoreInput(
      [first, current],
      '2026-10-06',
      [completion('first-last-day', '2026-10-03'), completion('later-log', '2026-10-05')]
    );
    const overallBefore = selectRhythmScore(input);
    const firstEnd = rhythmSeasonInclusiveEndDate([first, current], 0);
    const earlierScore = selectRhythmSeasonScore(input, first, firstEnd);
    const currentScore = selectRhythmSeasonScore(input, current);

    expect(firstEnd).toBe('2026-10-03');
    expect(earlierScore).toMatchObject({
      kind: 'rhythm-score',
      asOfDate: '2026-10-03',
      consistency: {
        kind: 'scored',
        evidence: {
          windowStartDate: '2026-10-01',
          windowEndDate: '2026-10-03',
          eligibleDueCount: 3,
          completedCount: 1,
          todayIncluded: true
        }
      },
      onTrack: { kind: 'scored', score: 100 },
      healthScore: 50
    });
    expect(currentScore).toMatchObject({
      kind: 'rhythm-score',
      asOfDate: '2026-10-06',
      consistency: {
        kind: 'scored',
        score: 50,
        evidence: {
          windowStartDate: '2026-10-04',
          windowEndDate: '2026-10-05',
          eligibleDueCount: 2,
          completedCount: 1
        }
      },
      onTrack: { kind: 'scored', score: 100 },
      healthScore: 62.5
    });
    expect(selectRhythmScore(input)).toEqual(overallBefore);
    expect(earlierScore.kind === 'rhythm-score'
      && earlierScore.onTrack.kind === 'scored'
      && earlierScore.onTrack.evidence.occurrences.some(item => item.date === '2026-10-05')).toBe(false);
  });

  it('clips period credit at the historical final local date and leaves a pending final day unmissed', () => {
    const mondayWeekly: RhythmSchedule = { frequency: 'weekly', weekdays: [1] };
    const lastWeekday = createRhythmSeason(
      rhythmId,
      '2026-10-19',
      mondayWeekly,
      undefined,
      'season-week'
    );
    const next = createRhythmSeason(
      rhythmId,
      '2026-10-22',
      { frequency: 'daily' },
      undefined,
      'season-next'
    );
    const input = scoreInput(
      [lastWeekday, next],
      '2026-10-26',
      [completion('next-season-log', '2026-10-22', 'America/Los_Angeles')],
      'America/Los_Angeles'
    );
    const result = selectRhythmSeasonScore(input, lastWeekday, '2026-10-21');
    expect(result).toMatchObject({
      kind: 'rhythm-score',
      asOfDate: '2026-10-21',
      consistency: {
        kind: 'scored',
        evidence: {
          occurrences: [{
            date: '2026-10-19',
            status: 'not-completed',
            eligibleEndDate: '2026-10-21'
          }]
        }
      },
      onTrack: { kind: 'unscored', reasonCode: 'ready-for-first-tend' },
      healthScore: null
    });

    const completedOnFinalDay = selectRhythmSeasonScore({
      ...input,
      records: [...input.records, completion('last-season-final-day', '2026-10-21', 'America/Los_Angeles')]
    }, lastWeekday, '2026-10-21');
    expect(completedOnFinalDay).toMatchObject({
      kind: 'rhythm-score',
      consistency: { kind: 'scored', score: 100 },
      onTrack: { kind: 'scored', score: 100 },
      healthScore: 100
    });
  });

  it('keeps Seasons before tracking unavailable and scores tracked occurrences through a Season schedule end', () => {
    const v2 = createRhythmSeason(
      rhythmId,
      '2026-08-01',
      { frequency: 'daily', endDate: '2026-09-30' },
      undefined,
      'season-v2'
    );
    const outsideTracking = scoreInput([v2], '2026-08-31');
    const outsideResult = selectRhythmSeasonScore({
      ...outsideTracking,
      scoring: {
        ...outsideTracking.scoring!,
        trackingStartDate: '2026-09-01'
      }
    }, v2, '2026-08-31');
    expect(outsideResult).toMatchObject({
      kind: 'unscored',
      reason: { reasonCode: 'not-started' },
      consistency: { kind: 'unscored', reasonCode: 'not-started' },
      onTrack: { kind: 'unscored', reasonCode: 'not-started' },
      healthScore: null
    });

    const preDev = createRhythmSeason(
      rhythmId,
      '2026-10-01',
      { frequency: 'daily', endDate: '2026-10-13' },
      undefined,
      'season-pre-dev'
    );
    const selectedDays = createRhythmSeason(
      rhythmId,
      '2026-10-17',
      { frequency: 'weekly', weekdays: [0, 2, 5, 6] },
      undefined,
      'season-selected-days'
    );
    const preDevInput = scoreInput([preDev, selectedDays], '2026-10-26');
    const preDevResult = selectRhythmSeasonScore(preDevInput, preDev, '2026-10-16');
    expect(preDevResult).toMatchObject({
      kind: 'rhythm-score',
      asOfDate: '2026-10-13',
      consistency: {
        kind: 'scored',
        score: 0,
        evidence: {
          windowStartDate: '2026-10-01',
          windowEndDate: '2026-10-12',
          eligibleDueCount: 12,
          completedCount: 0
        }
      },
      onTrack: { kind: 'scored', score: 0, evidence: { missedOccurrenceCount: 12 } },
      healthScore: 0
    });

    const lateTrackingInput = scoreInput([v2, preDev, selectedDays], '2026-10-26');
    const v2BeforeTracking = selectRhythmSeasonScore({
      ...lateTrackingInput,
      scoring: {
        ...lateTrackingInput.scoring!,
        trackingStartDate: '2026-10-01'
      }
    }, v2, '2026-09-30');
    expect(v2BeforeTracking).toMatchObject({
      kind: 'unscored',
      reason: { reasonCode: 'not-started' },
      consistency: { kind: 'unscored', reasonCode: 'not-started' },
      onTrack: { kind: 'unscored', reasonCode: 'not-started' },
      healthScore: null
    });
    const preDevBeforeTracking = selectRhythmSeasonScore({
      ...lateTrackingInput,
      scoring: {
        ...lateTrackingInput.scoring!,
        trackingStartDate: '2026-10-17'
      }
    }, preDev, '2026-10-16');
    expect(preDevBeforeTracking).toMatchObject({
      kind: 'unscored',
      reason: { reasonCode: 'not-started' },
      consistency: { kind: 'unscored', reasonCode: 'not-started' },
      onTrack: { kind: 'unscored', reasonCode: 'not-started' },
      healthScore: null
    });
    const preDevPartiallyTracked = selectRhythmSeasonScore({
      ...lateTrackingInput,
      scoring: {
        ...lateTrackingInput.scoring!,
        trackingStartDate: '2026-10-10'
      }
    }, preDev, '2026-10-16');
    expect(preDevPartiallyTracked).toMatchObject({
      kind: 'rhythm-score',
      asOfDate: '2026-10-13',
      consistency: {
        kind: 'scored',
        evidence: {
          windowStartDate: '2026-10-10',
          windowEndDate: '2026-10-12',
          eligibleDueCount: 3,
          completedCount: 0
        }
      },
      onTrack: { kind: 'scored', score: 70, evidence: { missedOccurrenceCount: 3 } },
      healthScore: 17.5
    });
  });

  it('reproduces the mixed-history Season badges using each interval’s actual schedule and logs', () => {
    const v2 = createRhythmSeason(
      rhythmId,
      '2026-08-01',
      { frequency: 'daily' },
      undefined,
      'season-v2'
    );
    const unknown = createUnknownRhythmSeason(rhythmId, '2026-10-01');
    const selectedDays = createRhythmSeason(
      rhythmId,
      '2026-10-17',
      { frequency: 'weekly', weekdays: [0, 2, 5, 6] },
      undefined,
      'season-selected-days'
    );
    const current = createRhythmSeason(
      rhythmId,
      '2026-10-21',
      { frequency: 'daily' },
      undefined,
      'season-current-daily'
    );
    const history = [v2, unknown, selectedDays, current];
    const input = scoreInput(
      history,
      '2026-10-26',
      [
        completion('oct-17', '2026-10-17', 'America/New_York'),
        completion('oct-18', '2026-10-18', 'America/New_York'),
        completion('oct-20', '2026-10-20', 'America/New_York'),
        completion('out-of-range', '2026-10-27', 'America/New_York')
      ],
      'America/New_York'
    );
    const currentScore = selectRhythmSeasonScore(input, current);
    const selectedDaysScore = selectRhythmSeasonScore(input, selectedDays, '2026-10-20');
    const unknownScore = selectRhythmSeasonScore(input, unknown, '2026-10-16');
    const v2Score = selectRhythmSeasonScore(input, v2, '2026-09-30');
    const reloadedInput: SelectRhythmScoreInput = {
      ...input,
      ...(input.scoring ? { scoring: structuredClone(input.scoring) } : {})
    };
    const reloadedV2Score = selectRhythmSeasonScore(reloadedInput, v2, '2026-09-30');

    expect(currentScore).toMatchObject({
      kind: 'rhythm-score',
      consistency: {
        kind: 'scored',
        score: 0,
        evidence: {
          windowStartDate: '2026-10-21',
          windowEndDate: '2026-10-25',
          eligibleDueCount: 5,
          completedCount: 0
        }
      },
      onTrack: { kind: 'scored', score: 50, evidence: { missedOccurrenceCount: 5 } },
      healthScore: 12.5
    });
    expect(selectedDaysScore).toMatchObject({
      kind: 'rhythm-score',
      asOfDate: '2026-10-20',
      consistency: { kind: 'scored', score: 100 },
      onTrack: { kind: 'scored', score: 100 },
      healthScore: 100
    });
    expect(unknownScore).toMatchObject({ kind: 'unscored', healthScore: null });
    expect(v2Score).toMatchObject({
      kind: 'rhythm-score',
      consistency: { kind: 'scored', score: 0, evidence: { eligibleDueCount: 29, completedCount: 0 } },
      onTrack: { kind: 'scored', score: 0 },
      healthScore: 0
    });
    expect(reloadedV2Score).toEqual(v2Score);
  });

  it('keeps zero distinct from unknown, empty evidence, and unsupported Custom Consistency', () => {
    const daily = createRhythmSeason(rhythmId, '2026-09-01', { frequency: 'daily' }, undefined, 'season-zero');
    const zero = selectRhythmSeasonScore(scoreInput([daily], '2026-10-10'), daily);
    expect(zero).toMatchObject({
      kind: 'rhythm-score',
      consistency: { kind: 'scored', score: 0 },
      onTrack: { kind: 'scored', score: 0 },
      healthScore: 0
    });

    const noRecords = selectRhythmSeasonScore({
      ...scoreInput([daily], '2026-09-01'),
      recordsAvailable: false
    }, daily);
    expect(noRecords).toMatchObject({
      kind: 'unscored',
      consistency: { kind: 'unscored', reasonCode: 'history-unavailable' },
      healthScore: null
    });

    const unknown = createUnknownRhythmSeason(rhythmId, '2026-09-01');
    expect(selectRhythmSeasonScore(scoreInput([unknown, daily], '2026-10-10'), unknown))
      .toMatchObject({ kind: 'unscored', healthScore: null });

    const custom = createRhythmSeason(rhythmId, '2026-09-01', {
      frequency: 'custom',
      unit: 'days',
      interval: 2,
      startDate: '2026-09-01'
    }, undefined, 'season-custom');
    const customScore = selectRhythmSeasonScore(scoreInput([custom], '2026-10-10'), custom);
    expect(customScore).toMatchObject({
      kind: 'rhythm-score',
      consistency: { kind: 'unscored', reasonCode: 'unsupported-schedule' },
      healthScore: null
    });

    const notYetDue = createRhythmSeason(rhythmId, '2026-10-17', {
      frequency: 'monthly',
      pattern: { kind: 'dayOfMonth', day: 20 }
    }, undefined, 'season-not-yet-due');
    expect(selectRhythmSeasonScore(scoreInput([notYetDue], '2026-10-18'), notYetDue))
      .toMatchObject({
        kind: 'rhythm-score',
        consistency: { kind: 'unscored', reasonCode: 'no-eligible-occurrences' },
        healthScore: null
      });
  });
});
