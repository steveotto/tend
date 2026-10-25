import { describe, expect, it } from 'vitest';
import {
  rhythmSeasonForDate,
  rhythmSeasonInclusiveEndDate,
  rhythmSeasonPaletteForId,
  rhythmSeasonPaletteForOrdinal,
  createRhythmSeason
} from '../src/domain/rhythm-seasons.ts';
import { validateRhythmScoringMetadata } from '../src/domain/rhythm-schedule.ts';

describe('Rhythm Season schedule history', () => {
  const first = createRhythmSeason('season-fixture', '2024-03-09', { frequency: 'daily' });
  const second = createRhythmSeason('season-fixture', '2024-03-11', {
    frequency: 'weekly',
    weekdays: [1, 3]
  });
  const seasons = [first, second];

  it('derives exclusive interval lookup and inclusive display ends with calendar-safe dates', () => {
    expect(rhythmSeasonForDate(seasons, '2024-03-08')).toBeUndefined();
    expect(rhythmSeasonForDate(seasons, '2024-03-09')).toBe(first);
    expect(rhythmSeasonForDate(seasons, '2024-03-10')).toBe(first);
    expect(rhythmSeasonForDate(seasons, '2024-03-11')).toBe(second);
    expect(rhythmSeasonForDate(seasons, 'not-a-date')).toBeUndefined();
    expect(rhythmSeasonInclusiveEndDate(seasons, 0)).toBe('2024-03-10');
    expect(rhythmSeasonInclusiveEndDate(seasons, 1)).toBeUndefined();
    expect(rhythmSeasonInclusiveEndDate([
      createRhythmSeason('season-fixture', '2024-02-28', { frequency: 'daily' }),
      createRhythmSeason('season-fixture', '2024-03-01', { frequency: 'daily' })
    ], 0)).toBe('2024-02-29');
  });

  it('keeps IDs and palette tokens stable independent of list position', () => {
    const recreated = createRhythmSeason('season-fixture', '2024-03-09', { frequency: 'daily' });
    expect(recreated.id).toBe(first.id);
    expect(recreated.paletteToken).toBe(first.paletteToken);
    expect(rhythmSeasonPaletteForId(first.id)).toBe(first.paletteToken);
    expect(rhythmSeasonPaletteForId(second.id)).toBe(second.paletteToken);
  });

  it('cycles the five existing palette tokens by chronological ordinal', () => {
    const tokens = Array.from({ length: 7 }, (_, ordinal) =>
      rhythmSeasonPaletteForOrdinal(ordinal));
    expect(tokens).toEqual(['fern', 'sage', 'sky', 'ocean', 'plum', 'fern', 'sage']);
    expect(() => rhythmSeasonPaletteForOrdinal(-1)).toThrow(RangeError);
    expect(() => rhythmSeasonPaletteForOrdinal(1.5)).toThrow(RangeError);
  });

  it('strictly validates season identity, ordered boundaries, optional text and schedule snapshots', () => {
    const scoring = {
      trackingStartDate: '2024-03-09',
      timeZone: 'America/New_York',
      scheduleHistory: [
        { ...first, name: 'Initial rhythm', note: 'Optional context.' },
        second
      ]
    };
    expect(validateRhythmScoringMetadata(scoring)).toBe(true);
    expect(validateRhythmScoringMetadata({
      ...scoring,
      scheduleHistory: [first, { ...second, startDate: first.startDate }]
    })).toBe(false);
    expect(validateRhythmScoringMetadata({
      ...scoring,
      scheduleHistory: [first, { ...second, id: first.id }]
    })).toBe(false);
    expect(validateRhythmScoringMetadata({
      ...scoring,
      scheduleHistory: [{ ...first, startDate: '2024-02-30' }]
    })).toBe(false);
    expect(validateRhythmScoringMetadata({
      ...scoring,
      scheduleHistory: [{ ...first, schedule: { frequency: 'weekly', weekdays: [] } }]
    })).toBe(false);
    expect(validateRhythmScoringMetadata({
      ...scoring,
      scheduleHistory: [{ ...first, unknown: true }]
    })).toBe(false);
    expect(validateRhythmScoringMetadata({
      ...scoring,
      scheduleHistory: [{ ...first, name: 'x'.repeat(81) }]
    })).toBe(false);
    expect(validateRhythmScoringMetadata({
      ...scoring,
      scheduleHistory: [{ ...first, note: 'x'.repeat(1001) }]
    })).toBe(false);
  });

  it('preserves a schedule-level end date and rejects an unknown palette token', () => {
    const schedule = createRhythmSeason('season-fixture', '2024-03-09', {
      frequency: 'daily',
      endDate: '2024-04-01'
    });
    expect(validateRhythmScoringMetadata({
      trackingStartDate: '2024-03-09',
      timeZone: 'UTC',
      scheduleHistory: [schedule]
    })).toBe(true);
    expect(validateRhythmScoringMetadata({
      trackingStartDate: '2024-03-09',
      timeZone: 'UTC',
      scheduleHistory: [{ ...schedule, paletteToken: 'rgb(0,0,0)' }]
    })).toBe(false);
  });
});
