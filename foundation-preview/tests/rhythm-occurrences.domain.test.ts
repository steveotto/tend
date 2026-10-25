import { describe, expect, it } from 'vitest';
import { rhythmLastTendedLabel } from '../src/domain/preview-data.ts';
import { selectNextScheduledOccurrence } from '../src/domain/rhythm-occurrences.ts';
import type { RhythmSchedule, RhythmScoringMetadata } from '../src/domain/rhythm-schedule.ts';

describe('next scheduled occurrence selection', () => {
  it('uses the quarterly pattern to label the actual next date and today when due', () => {
    const quarterlySchedule: RhythmSchedule = {
      frequency: 'quarterly',
      monthInQuarter: 1,
      pattern: { kind: 'dayOfMonth', day: 1 }
    };
    const result = selectNextScheduledOccurrence({
      schedule: quarterlySchedule,
      asOfDate: '2026-10-25',
      trackingStartDate: '2026-10-25'
    });
    expect(result).toEqual({ kind: 'found', date: '2027-01-01' });
    expect(rhythmLastTendedLabel({
      completionHistory: [],
      cadence: 'Quarterly',
      schedule: quarterlySchedule,
      createdLocalDate: '2026-10-25'
    }, false, '2026-10-25')).toBe('Next due Jan 1');

    expect(selectNextScheduledOccurrence({
      schedule: quarterlySchedule,
      asOfDate: '2027-01-01'
    })).toEqual({ kind: 'found', date: '2027-01-01' });
    expect(rhythmLastTendedLabel({
      completionHistory: [],
      cadence: 'Quarterly',
      schedule: quarterlySchedule
    }, false, '2027-01-01')).toBe('Due today');
  });

  it('uses current schedule-history boundaries and reports mismatches instead of inventing dates', () => {
    const schedule: RhythmSchedule = { frequency: 'daily' };
    const scoring: RhythmScoringMetadata = {
      trackingStartDate: '2026-10-25',
      timeZone: 'UTC',
      scheduleHistory: [{ startDate: '2026-10-25', schedule }]
    };
    expect(selectNextScheduledOccurrence({
      schedule,
      scoring,
      asOfDate: '2026-10-24'
    })).toEqual({ kind: 'found', date: '2026-10-25' });
    expect(selectNextScheduledOccurrence({
      schedule: { frequency: 'weekly', weekdays: [1] },
      scoring,
      asOfDate: '2026-10-25'
    })).toMatchObject({ kind: 'unavailable' });
  });

  it('searches far enough for a valid leap-day yearly occurrence', () => {
    expect(selectNextScheduledOccurrence({
      schedule: {
        frequency: 'yearly',
        month: 2,
        pattern: { kind: 'dayOfMonth', day: 29 }
      },
      asOfDate: '2025-03-01'
    })).toEqual({ kind: 'found', date: '2028-02-29' });
  });

  it('keeps descriptive cadences neutral and preserves the latest completion label', () => {
    expect(rhythmLastTendedLabel({
      completionHistory: [],
      cadence: '3 times a week'
    }, false, '2026-10-25')).toBe('Not yet tended');
    expect(rhythmLastTendedLabel({
      completionHistory: [{ id: 'latest', effectiveDate: '2026-10-23' }],
      cadence: 'Quarterly',
      schedule: {
        frequency: 'quarterly',
        monthInQuarter: 1,
        pattern: { kind: 'dayOfMonth', day: 1 }
      }
    }, false, '2026-10-25')).toMatch(/^Last tended /);
  });
});
