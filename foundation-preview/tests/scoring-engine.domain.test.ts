import { describe, expect, it } from 'vitest';
import type { RhythmSchedule } from '../src/domain/rhythm-schedule.ts';
import {
  averageScores,
  blendScores,
  consistencyWindowForSchedule,
  scoreRhythm
} from '../../src/scoring/engine.ts';

const asOfDate = '2026-11-12';

const patternOnDayOne = { kind: 'dayOfMonth', day: 1 } as const;
const patternOnDayFifteen = { kind: 'dayOfMonth', day: 15 } as const;

const cadenceSchedules: readonly {
  label: string;
  schedule: RhythmSchedule;
  windowStartDate: string;
  dueCount: number;
}[] = [
  {
    label: 'daily',
    schedule: { frequency: 'daily' },
    windowStartDate: '2026-10-14',
    dueCount: 30
  },
  {
    label: 'once-weekly',
    schedule: { frequency: 'weekly', weekdays: [1] },
    windowStartDate: '2026-08-21',
    dueCount: 12
  },
  {
    label: 'multi-day selected-weekdays weekly',
    schedule: { frequency: 'weekly', weekdays: [1, 3, 5], weeklyMode: 'select-days' },
    windowStartDate: '2026-08-21',
    dueCount: 36
  },
  {
    label: 'custom interval in days',
    schedule: { frequency: 'custom', unit: 'days', interval: 7, startDate: '2026-01-01' },
    windowStartDate: '2026-10-14',
    dueCount: 5
  },
  {
    label: 'custom interval in weeks',
    schedule: { frequency: 'custom', unit: 'weeks', interval: 2, weekdays: [1], startDate: '2025-01-06' },
    windowStartDate: '2026-08-21',
    dueCount: 6
  },
  {
    label: 'custom interval in months',
    schedule: { frequency: 'custom', unit: 'months', interval: 2, pattern: patternOnDayFifteen, startDate: '2025-01-15' },
    windowStartDate: '2026-05-12',
    dueCount: 3
  },
  {
    label: 'custom interval in years',
    schedule: { frequency: 'custom', unit: 'years', interval: 1, month: 4, pattern: patternOnDayOne, startDate: '2025-04-01' },
    windowStartDate: '2024-11-12',
    dueCount: 2
  },
  {
    label: 'monthly',
    schedule: { frequency: 'monthly', pattern: patternOnDayFifteen },
    windowStartDate: '2026-05-12',
    dueCount: 6
  },
  {
    label: 'quarterly',
    schedule: { frequency: 'quarterly', monthInQuarter: 1, pattern: patternOnDayOne },
    windowStartDate: '2025-11-12',
    dueCount: 4
  },
  {
    label: 'yearly',
    schedule: { frequency: 'yearly', month: 4, pattern: patternOnDayOne },
    windowStartDate: '2024-11-12',
    dueCount: 2
  }
];

describe('shared scoring engine cadence windows', () => {
  it.each(cadenceSchedules)(
    'covers $label with the correct window and due-occurrence cadence',
    ({ schedule, windowStartDate, dueCount }) => {
      const window = consistencyWindowForSchedule(schedule, asOfDate);
      expect(window.startDate).toBe(windowStartDate);
      expect(window.endDate).toBe(asOfDate);
      expect(window.dueDates).toHaveLength(dueCount);
    }
  );

  it('extends custom intervals only far enough to include the latest two due chances', () => {
    const everyFortyDays: RhythmSchedule = {
      frequency: 'custom',
      unit: 'days',
      interval: 40,
      startDate: '2018-01-01'
    };
    const window = consistencyWindowForSchedule(everyFortyDays, asOfDate);

    expect(window.dueDates).toHaveLength(2);
    expect(window.startDate).toBe(window.dueDates[0]);
    expect(window.dueDates[1]! < asOfDate).toBe(true);
  });

  it('extends custom month and year windows to include two due chances', () => {
    const everyEighteenMonths: RhythmSchedule = {
      frequency: 'custom',
      unit: 'months',
      interval: 18,
      pattern: patternOnDayFifteen,
      startDate: '2020-01-15'
    };
    const everyThreeYears: RhythmSchedule = {
      frequency: 'custom',
      unit: 'years',
      interval: 3,
      month: 4,
      pattern: patternOnDayOne,
      startDate: '2018-04-01'
    };
    const monthWindow = consistencyWindowForSchedule(everyEighteenMonths, asOfDate);
    const yearWindow = consistencyWindowForSchedule(everyThreeYears, asOfDate);

    expect(monthWindow.dueDates).toEqual(['2024-07-15', '2026-01-15']);
    expect(monthWindow.startDate).toBe('2024-07-15');
    expect(yearWindow.dueDates).toEqual(['2021-04-01', '2024-04-01']);
    expect(yearWindow.startDate).toBe('2021-04-01');
  });

  it('does not extend a custom window earlier than the Rhythm score clock', () => {
    const everyFortyDays: RhythmSchedule = {
      frequency: 'custom',
      unit: 'days',
      interval: 40,
      startDate: '2026-10-01'
    };
    const window = consistencyWindowForSchedule(everyFortyDays, asOfDate, '2026-10-01');

    expect(window.startDate).toBe('2026-10-01');
    expect(window.dueDates).toHaveLength(2);
  });
});

describe('shared scoring engine Rhythm scores', () => {
  it('leaves rhythms without a clock unscored rather than inventing a start date', () => {
    const result = scoreRhythm({
      rhythmId: 'missing-clock',
      schedule: { frequency: 'daily' },
      completionDates: [],
      asOfDate
    });

    expect(result.scoreClockStartDate).toBeNull();
    expect(result.consistency).toEqual({ kind: 'unscored', reason: 'missing-clock' });
    expect(result.onTrack).toEqual({ kind: 'unscored', reason: 'missing-clock' });
    expect(result.health).toBeNull();
  });

  it('starts scoring at the first due occurrence, not at the first completion', () => {
    const input = {
      rhythmId: 'new-custom',
      schedule: {
        frequency: 'custom',
        unit: 'days',
        interval: 2,
        startDate: '2026-11-12'
      } as const,
      createdDate: '2026-11-10',
      completionDates: []
    };
    const beforeFirstDue = scoreRhythm({ ...input, asOfDate: '2026-11-11' });
    const firstDue = scoreRhythm({ ...input, asOfDate: '2026-11-12' });

    expect(beforeFirstDue.consistency).toEqual({ kind: 'unscored', reason: 'no-due-occurrences' });
    expect(beforeFirstDue.onTrack).toEqual({ kind: 'unscored', reason: 'not-due-yet' });
    expect(firstDue.scoreClockStartDate).toBe('2026-11-10');
    expect(firstDue.occurrences).toHaveLength(1);
    expect(firstDue.consistency).toEqual({ kind: 'scored', score: 0 });
    expect(firstDue.onTrack).toEqual({ kind: 'scored', score: 100 });
    expect(firstDue.health).toBe(25);
  });

  it('keeps a brand-new Rhythm unscored until its first assigned time block begins', () => {
    const input = {
      rhythmId: 'evening-rhythm',
      schedule: { frequency: 'daily' } as const,
      createdDate: '2026-11-12',
      completionDates: [],
      asOfDate: '2026-11-12',
      dueTime: '18:00'
    };
    const beforeDue = scoreRhythm({ ...input, asOfTime: '17:59' });
    const atDue = scoreRhythm({ ...input, asOfTime: '18:00' });

    expect(beforeDue.consistency).toEqual({ kind: 'unscored', reason: 'not-due-yet' });
    expect(beforeDue.onTrack).toEqual({ kind: 'unscored', reason: 'not-due-yet' });
    expect(beforeDue.health).toBeNull();
    expect(atDue.consistency).toEqual({ kind: 'scored', score: 0 });
    expect(atDue.onTrack).toEqual({ kind: 'scored', score: 100 });
    expect(atDue.health).toBe(25);

    const established = scoreRhythm({
      ...input,
      createdDate: '2026-11-11',
      asOfTime: '17:59'
    });
    expect(established.consistency).toEqual({ kind: 'scored', score: 0 });
    expect(established.onTrack).toEqual({ kind: 'scored', score: 90 });
  });

  it('starts a known late-created Rhythm at its next selected weekday occurrence', () => {
    const schedule: RhythmSchedule = {
      frequency: 'weekly',
      weekdays: [1, 3, 5]
    };
    const input = {
      rhythmId: 'late-created-weekly',
      schedule,
      createdDate: '2026-11-11',
      createdLocalTime: '18:01',
      createdDueTime: '18:00',
      completionDates: []
    };
    const createdAfterWednesdayBlock = scoreRhythm({
      ...input,
      asOfDate: '2026-11-11',
      asOfTime: '18:01',
      dueTime: '18:00'
    });
    const beforeFridayBlock = scoreRhythm({
      ...input,
      asOfDate: '2026-11-13',
      asOfTime: '17:59',
      dueTime: '18:00'
    });
    const atFridayBlock = scoreRhythm({
      ...input,
      asOfDate: '2026-11-13',
      asOfTime: '18:00',
      dueTime: '18:00'
    });

    expect(createdAfterWednesdayBlock.scoreClockStartDate).toBe('2026-11-13');
    expect(createdAfterWednesdayBlock.health).toBeNull();
    expect(beforeFridayBlock.consistency).toEqual({ kind: 'unscored', reason: 'not-due-yet' });
    expect(beforeFridayBlock.onTrack).toEqual({ kind: 'unscored', reason: 'not-due-yet' });
    expect(atFridayBlock.consistency).toEqual({ kind: 'scored', score: 0 });
    expect(atFridayBlock.onTrack).toEqual({ kind: 'scored', score: 100 });
    expect(atFridayBlock.health).toBe(25);
  });

  it('keeps known pre-block creation unscored until the assigned block and preserves missing-boundary behavior', () => {
    const knownCreation = {
      rhythmId: 'created-before-block',
      schedule: { frequency: 'daily' } as const,
      createdDate: asOfDate,
      createdLocalTime: '17:59',
      createdDueTime: '18:00',
      completionDates: [],
      asOfDate,
      dueTime: '18:00'
    };
    const beforeBlock = scoreRhythm({ ...knownCreation, asOfTime: '17:59' });
    const atBlock = scoreRhythm({ ...knownCreation, asOfTime: '18:00' });
    const missingBoundary = scoreRhythm({
      rhythmId: 'legacy-creation-boundary',
      schedule: { frequency: 'daily' },
      createdDate: asOfDate,
      completionDates: [],
      asOfDate,
      asOfTime: '18:01',
      dueTime: '18:00'
    });

    expect(beforeBlock.health).toBeNull();
    expect(beforeBlock.consistency).toEqual({ kind: 'unscored', reason: 'not-due-yet' });
    expect(atBlock.health).toBe(25);
    expect(missingBoundary.health).toBe(25);
  });

  it('uses a backdated completion as clock evidence earlier than creation', () => {
    const result = scoreRhythm({
      rhythmId: 'backdated',
      schedule: { frequency: 'daily' },
      createdDate: '2026-11-12',
      completionDates: ['2026-11-10'],
      asOfDate: '2026-11-13'
    });

    expect(result.scoreClockStartDate).toBe('2026-11-10');
    expect(result.consistency).toEqual({ kind: 'scored', score: 25 });
    expect(result.onTrack).toEqual({ kind: 'scored', score: 80 });
  });

  it('counts completed due occurrences and deducts On Track only for ended missed occurrences', () => {
    const result = scoreRhythm({
      rhythmId: 'missed-days',
      schedule: { frequency: 'daily' },
      createdDate: '2026-11-12',
      completionDates: ['2026-11-12'],
      asOfDate: '2026-11-14'
    });

    expect(result.consistency).toEqual({ kind: 'scored', score: 1 / 3 * 100 });
    expect(result.onTrack).toEqual({ kind: 'scored', score: 90 });
    expect(result.health).toBeCloseTo((1 / 3 * 100) * 0.75 + 90 * 0.25);
    expect(result.occurrences.map(item => item.missed)).toEqual([false, true, false]);
  });

  it('resets On Track to 100 after a qualifying completion and floors at zero', () => {
    const reset = scoreRhythm({
      rhythmId: 'reset-after-miss',
      schedule: { frequency: 'daily' },
      createdDate: '2026-11-08',
      completionDates: ['2026-11-10'],
      asOfDate: '2026-11-13'
    });
    const floor = scoreRhythm({
      rhythmId: 'long-miss',
      schedule: { frequency: 'daily' },
      createdDate: '2026-10-01',
      completionDates: [],
      asOfDate: '2026-11-12'
    });

    expect(reset.onTrack).toEqual({ kind: 'scored', score: 80 });
    expect(floor.onTrack).toEqual({ kind: 'scored', score: 0 });
  });

  it('counts consecutive misses from the score-clock start even outside the Consistency window', () => {
    const result = scoreRhythm({
      rhythmId: 'long-running-yearly',
      schedule: { frequency: 'yearly', month: 12, pattern: patternOnDayOne },
      createdDate: '2010-12-01',
      completionDates: ['2010-12-01'],
      asOfDate: '2026-12-02'
    });

    expect(result.consistencyWindow.startDate).toBe('2024-12-02');
    expect(result.occurrences).toHaveLength(2);
    expect(result.onTrackOccurrences).toHaveLength(17);
    expect(result.onTrack).toEqual({ kind: 'scored', score: 0 });
    expect(result.onTrackOccurrences.slice(-2).map(item => item.onTrack)).toEqual([0, 0]);
  });

  it('accepts a once-weekly completion anywhere in its week but counts selected weekdays separately', () => {
    const onceWeekly: RhythmSchedule = { frequency: 'weekly', weekdays: [1] };
    const selectedDays: RhythmSchedule = {
      frequency: 'weekly',
      weekdays: [1, 3],
      weeklyMode: 'select-days'
    };
    const onceWeeklyScore = scoreRhythm({
      rhythmId: 'weekly',
      schedule: onceWeekly,
      createdDate: '2026-11-02',
      completionDates: ['2026-11-04'],
      asOfDate: '2026-11-09'
    });
    const selectedDaysScore = scoreRhythm({
      rhythmId: 'selected-days',
      schedule: selectedDays,
      createdDate: '2026-11-02',
      completionDates: ['2026-11-04'],
      asOfDate: '2026-11-09'
    });

    expect(onceWeeklyScore.occurrences[0]?.completed).toBe(true);
    expect(selectedDaysScore.occurrences[0]?.completed).toBe(false);
    expect(selectedDaysScore.occurrences[1]?.completed).toBe(true);
  });
});

describe('shared scoring engine rollups', () => {
  it('blends each level from its own averaged components', () => {
    expect(blendScores(80, 60)).toBe(75);
    expect(averageScores([
      { consistency: 80, onTrack: 60 },
      { consistency: 40, onTrack: 100 }
    ])).toEqual({
      consistency: 60,
      onTrack: 80,
      health: 65,
      scoredCount: 2,
      totalCount: 2
    });
  });

  it('excludes unscored children and preserves valid zero scores', () => {
    expect(averageScores([
      { consistency: 0, onTrack: 0 },
      null
    ])).toEqual({
      consistency: 0,
      onTrack: 0,
      health: 0,
      scoredCount: 1,
      totalCount: 2
    });
    expect(averageScores([null, null])).toEqual({
      consistency: null,
      onTrack: null,
      health: null,
      scoredCount: 0,
      totalCount: 2
    });
  });
});
