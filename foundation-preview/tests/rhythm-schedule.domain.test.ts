import { describe, expect, it } from 'vitest';
import {
  rhythmScheduleSummary,
  rhythmSummary,
  rhythmTimeLabel,
  rhythmTimeOptions,
  rhythmTimeValueFromLabel,
  validateRhythmSchedule
} from '../src/domain/rhythm-schedule.ts';
import type { RhythmSchedule } from '../src/domain/rhythm-schedule.ts';

const validSchedules: RhythmSchedule[] = [
  { frequency: 'daily' },
  { frequency: 'weekly', weekdays: [1, 3, 5] },
  { frequency: 'monthly', pattern: { kind: 'dayOfMonth', day: 31 } },
  { frequency: 'monthly', pattern: { kind: 'dayOfMonth', day: 'last' } },
  { frequency: 'monthly', pattern: { kind: 'ordinalWeekday', ordinal: 'last', weekday: 5 } },
  { frequency: 'quarterly', monthInQuarter: 2, pattern: { kind: 'dayOfMonth', day: 15 } },
  { frequency: 'yearly', month: 2, pattern: { kind: 'ordinalWeekday', ordinal: 2, weekday: 1 } },
  { frequency: 'custom', unit: 'days', interval: 3, startDate: '2026-10-22' },
  { frequency: 'custom', unit: 'weeks', interval: 2, weekdays: [2], startDate: '2026-10-22' },
  { frequency: 'custom', unit: 'months', interval: 3, pattern: { kind: 'dayOfMonth', day: 'last' }, startDate: '2026-10-22' },
  { frequency: 'custom', unit: 'years', interval: 1, month: 2, pattern: { kind: 'dayOfMonth', day: 29 }, startDate: '2026-10-22' }
];

describe('pure structured Rhythm schedule domain', () => {
  it('validates all frequency and conditional custom-unit shapes', () => {
    for (const schedule of validSchedules) {
      expect(validateRhythmSchedule(schedule)).toEqual({ valid: true, schedule });
    }
  });

  it('requires unique selected weekdays and rejects out-of-range values', () => {
    for (const weekdays of [[], [1, 1], [-1], [7], ['1']]) {
      expect(validateRhythmSchedule({ frequency: 'weekly', weekdays }).valid).toBe(false);
    }
    expect(validateRhythmSchedule({
      frequency: 'custom',
      unit: 'weeks',
      interval: 1,
      weekdays: [],
      startDate: '2026-10-22'
    }).valid).toBe(false);
  });

  it('validates intervals, patterns, months, and local calendar dates without computing occurrences', () => {
    for (const interval of [0, 366, 1.5, '2']) {
      expect(validateRhythmSchedule({
        frequency: 'custom',
        unit: 'days',
        interval,
        startDate: '2026-10-22'
      }).valid).toBe(false);
    }
    expect(validateRhythmSchedule({ frequency: 'yearly', month: 13, pattern: { kind: 'dayOfMonth', day: 1 } }).valid).toBe(false);
    expect(validateRhythmSchedule({ frequency: 'monthly', pattern: { kind: 'dayOfMonth', day: 32 } }).valid).toBe(false);
    expect(validateRhythmSchedule({ frequency: 'monthly', pattern: { kind: 'ordinalWeekday', ordinal: 5, weekday: 1 } }).valid).toBe(false);
    expect(validateRhythmSchedule({ frequency: 'daily', startDate: '2026-10-22' }).valid).toBe(false);
    expect(validateRhythmSchedule({ frequency: 'custom', unit: 'days', interval: 1, startDate: '2026-02-30' }).valid).toBe(false);
    expect(validateRhythmSchedule({
      frequency: 'custom',
      unit: 'days',
      interval: 1,
      startDate: '2026-10-23',
      endDate: '2026-10-22'
    }).valid).toBe(false);
    expect(validateRhythmSchedule({
      frequency: 'custom',
      unit: 'days',
      interval: 1,
      startDate: '2026-10-22',
      endDate: '2026-10-22'
    }).valid).toBe(true);
    expect(validateRhythmSchedule({
      frequency: 'monthly',
      pattern: { kind: 'dayOfMonth', day: 31 }
    }).valid).toBe(true);
    for (const day of [29, 30, 31]) {
      for (const schedule of [
        { frequency: 'monthly', pattern: { kind: 'dayOfMonth', day } },
        { frequency: 'quarterly', monthInQuarter: 1, pattern: { kind: 'dayOfMonth', day } },
        { frequency: 'yearly', month: 2, pattern: { kind: 'dayOfMonth', day } },
        { frequency: 'custom', unit: 'months', interval: 1, pattern: { kind: 'dayOfMonth', day }, startDate: '2026-10-22' },
        { frequency: 'custom', unit: 'years', interval: 1, month: 2, pattern: { kind: 'dayOfMonth', day }, startDate: '2026-10-22' }
      ]) {
        expect(validateRhythmSchedule(schedule).valid).toBe(true);
      }
    }
  });

  it('rejects unknown, irrelevant, and missing conditional fields rather than dropping them', () => {
    expect(validateRhythmSchedule({ frequency: 'weekly', weekdays: [1], mystery: true }).valid).toBe(false);
    expect(validateRhythmSchedule({ frequency: 'monthly', pattern: { kind: 'dayOfMonth', day: 1 }, weekday: 2 }).valid).toBe(false);
    expect(validateRhythmSchedule({ frequency: 'custom', unit: 'months', interval: 1, startDate: '2026-10-22' }).valid).toBe(false);
    expect(validateRhythmSchedule({ frequency: 'custom', unit: 'days', interval: 1 }).valid).toBe(false);
    expect(validateRhythmSchedule({
      frequency: 'custom',
      unit: 'days',
      interval: 1,
      startDate: '2026-10-22',
      weekdays: [1]
    }).valid).toBe(false);
    expect(validateRhythmSchedule({ frequency: 'fortnightly' }).valid).toBe(false);
  });

  it('formats stored definitions as summaries without implying due dates', () => {
    expect(rhythmScheduleSummary({ frequency: 'daily' })).toBe('Every day.');
    expect(rhythmScheduleSummary({ frequency: 'weekly', weekdays: [5, 1, 3] }))
      .toBe('Every week on Monday, Wednesday, and Friday.');
    expect(rhythmScheduleSummary({
      frequency: 'monthly',
      pattern: { kind: 'ordinalWeekday', ordinal: 1, weekday: 0 }
    })).toBe('The first Sunday of every month.');
    expect(rhythmScheduleSummary({ frequency: 'quarterly', monthInQuarter: 3, pattern: { kind: 'dayOfMonth', day: 'last' } }))
      .toBe('The last day of the third month of every quarter.');
    expect(rhythmScheduleSummary({
      frequency: 'yearly',
      month: 10,
      pattern: { kind: 'ordinalWeekday', ordinal: 2, weekday: 2 },
      endDate: '2028-10-22'
    })).toBe('The second Tuesday of October every year, ending October 22, 2028.');
    expect(rhythmScheduleSummary({
      frequency: 'custom',
      unit: 'weeks',
      interval: 2,
      weekdays: [1, 4],
      startDate: '2026-10-22',
      endDate: '2027-10-22'
    })).toBe('Every 2 weeks on Monday and Thursday, starting October 22, 2026 and ending October 22, 2027.');
  });

  it('provides reference time choices through stable values and shared labels', () => {
    expect(rhythmTimeOptions.map(option => option.value)).toEqual([
      'anytime', 'all-day', 'early-morning', 'morning', 'lunch',
      'afternoon', 'way-home', 'evening', 'bedtime'
    ]);
    expect(rhythmTimeOptions.map(option => option.label)).toEqual([
      'Anytime', 'All day', 'Early morning', 'Morning', 'Lunch',
      'Afternoon', 'Way home', 'Evening', 'Bedtime'
    ]);
    expect(rhythmTimeValueFromLabel('Morning')).toBe('morning');
    expect(rhythmTimeLabel('way-home')).toBe('Way home');
    expect(rhythmTimeValueFromLabel('Night shift')).toBeUndefined();
    expect(rhythmSummary({ frequency: 'daily' }, 'all-day')).toBe('Every day · All day.');
  });
});
