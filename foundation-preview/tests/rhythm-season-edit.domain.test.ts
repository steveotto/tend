import { describe, expect, it } from 'vitest';
import { establishCurrentRhythmSeason } from '../src/domain/rhythm-season-edit.ts';
import { createRhythmSeason } from '../src/domain/rhythm-seasons.ts';
import type { RhythmSchedule, RhythmScoringMetadata } from '../src/domain/rhythm-schedule.ts';

const rhythmId = 'season-establishment-fixture';
const currentSchedule = { frequency: 'daily' } as const;
const proposedSchedule: RhythmSchedule = { frequency: 'weekly', weekdays: [1] };
const asOfDate = '2026-10-25';

function draft(startDate: string) {
  return {
    segmentId: `current-schedule:${rhythmId}`,
    startDate,
    schedule: proposedSchedule,
    timeOfDay: 'evening' as const,
    name: 'Evening rhythm'
  };
}

describe('establishing the boundary for a display-only current Season', () => {
  it('does not establish history without a valid explicit start date', () => {
    expect(establishCurrentRhythmSeason(
      rhythmId,
      currentSchedule,
      undefined,
      'UTC',
      asOfDate,
      draft('')
    )).toMatchObject({ valid: false, error: expect.stringContaining('starting date') });
    expect(establishCurrentRhythmSeason(
      rhythmId,
      currentSchedule,
      undefined,
      'UTC',
      asOfDate,
      draft('2026-10-26')
    )).toMatchObject({ valid: false, error: expect.stringContaining('starting date') });
  });

  it('creates the first saved boundary exactly at the user-selected date', () => {
    const result = establishCurrentRhythmSeason(
      rhythmId,
      currentSchedule,
      undefined,
      'UTC',
      asOfDate,
      draft('2026-10-20')
    );

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.scoring).toMatchObject({
      trackingStartDate: '2026-10-20',
      timeZone: 'UTC',
      scheduleHistory: [{
        startDate: '2026-10-20',
        schedule: proposedSchedule,
        timeOfDay: 'evening',
        name: 'Evening rhythm'
      }]
    });
    expect(result.schedule).toEqual(proposedSchedule);
    expect(result.activeTimeOfDay).toBe('evening');
  });

  it('preserves earlier history and rejects a duplicate boundary', () => {
    const earlier = createRhythmSeason(rhythmId, '2026-10-01', currentSchedule, 'morning');
    const scoring: RhythmScoringMetadata = {
      trackingStartDate: earlier.startDate,
      timeZone: 'UTC',
      scheduleHistory: [earlier]
    };
    const result = establishCurrentRhythmSeason(
      rhythmId,
      currentSchedule,
      scoring,
      'UTC',
      asOfDate,
      draft('2026-10-20')
    );

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.scoring.scheduleHistory[0]).toEqual(earlier);
    expect(result.scoring.scheduleHistory[1]).toMatchObject({
      startDate: '2026-10-20',
      schedule: proposedSchedule
    });
    expect(establishCurrentRhythmSeason(
      rhythmId,
      currentSchedule,
      scoring,
      'UTC',
      asOfDate,
      draft(earlier.startDate)
    )).toMatchObject({ valid: false, error: expect.stringContaining('already starts') });
  });
});
