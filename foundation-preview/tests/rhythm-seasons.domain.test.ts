import { describe, expect, it } from 'vitest';
import {
  rhythmSeasonForDate,
  rhythmSeasonInclusiveEndDate,
  rhythmSeasonPaletteAssignments,
  rhythmSeasonPaletteForId,
  rhythmSeasonPaletteForOrdinal,
  createRhythmSeason,
  createUnknownRhythmSeason
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

  it('corrects legacy ID-hash colors and resolves neighboring collisions in chronological palette order', () => {
    const original = createRhythmSeason(
      'sample-connect',
      '2026-10-17',
      { frequency: 'daily' }
    );
    const current = {
      ...createRhythmSeason(
        'sample-connect',
        '2026-10-25',
        { frequency: 'weekly', weekdays: [1, 3, 5] }
      ),
      paletteToken: 'sage' as const
    };
    const assignments = rhythmSeasonPaletteAssignments([original, current]);

    expect(original.paletteToken).toBe('plum');
    expect(assignments.get(original.id)).toBe('fern');
    expect(assignments.get(current.id)).toBe('sage');

    const collidingSeasons = [
      createRhythmSeason('fixture', '2026-10-01', { frequency: 'daily' }, undefined, 'first', 'fern'),
      createRhythmSeason('fixture', '2026-10-03', { frequency: 'daily' }, undefined, 'second', 'fern'),
      createRhythmSeason('fixture', '2026-10-04', { frequency: 'daily' }, undefined, 'third', 'fern')
    ];
    const collisionAssignments = rhythmSeasonPaletteAssignments(collidingSeasons);
    const reorderedAssignments = rhythmSeasonPaletteAssignments([...collidingSeasons].reverse());
    const unknownSeparatedAssignments = rhythmSeasonPaletteAssignments([
      collidingSeasons[0]!,
      createUnknownRhythmSeason('fixture', '2026-10-02'),
      collidingSeasons[1]!,
      collidingSeasons[2]!
    ]);
    const appendedAssignments = rhythmSeasonPaletteAssignments([
      ...collidingSeasons,
      createRhythmSeason('fixture', '2026-10-05', { frequency: 'daily' }, undefined, 'fourth', 'fern')
    ]);
    expect(collisionAssignments.get('first')).toBe('fern');
    expect(collisionAssignments.get('second')).toBe('sage');
    expect(collisionAssignments.get('third')).toBe('sky');
    expect(collisionAssignments.get('third')).not.toBe(collisionAssignments.get('second'));
    expect([...collisionAssignments]).toEqual([...reorderedAssignments]);
    expect([...collisionAssignments]).toEqual([...unknownSeparatedAssignments]);
    expect([...collisionAssignments]).toEqual([...appendedAssignments].slice(0, 3));
    const aliasIds = Array.from({ length: 100 }, (_, index) => `palette-alias-${index}`)
      .filter(id => rhythmSeasonPaletteForId(id) === 'fern');
    const aliasCollisionAssignments = rhythmSeasonPaletteAssignments([
      createRhythmSeason('fixture', '2026-10-01', { frequency: 'daily' }, undefined, aliasIds[0], 'ocean'),
      createRhythmSeason('fixture', '2026-10-02', { frequency: 'daily' }, undefined, aliasIds[1], 'clay')
    ]);
    expect(aliasCollisionAssignments.get(aliasIds[0]!)).toBe('ocean');
    expect(aliasCollisionAssignments.get(aliasIds[1]!)).toBe('sage');
  });

  it('corrects a hash-assigned current Season after an explicit unknown-history interval', () => {
    const rhythmId = 'sample-connect';
    const unknownId = `season:${rhythmId}:2026-10-17:unknown`;
    const currentId = `season:${rhythmId}:2026-10-26`;
    const unknown = createUnknownRhythmSeason(rhythmId, '2026-10-17');
    const current = createRhythmSeason(
      rhythmId,
      '2026-10-26',
      { frequency: 'weekly', weekdays: [1, 3, 5] },
      undefined,
      currentId,
      rhythmSeasonPaletteForId(currentId)
    );
    const assignments = rhythmSeasonPaletteAssignments([
      { ...unknown, id: unknownId },
      current
    ]);

    expect(current.paletteToken).toBe('plum');
    expect(assignments.get(unknownId)).toBeUndefined();
    expect(assignments.get(currentId)).toBe('fern');
  });

  it('resolves the saved same-day-boundary history using the approved palette order', () => {
    const rhythmId = 'user-rhythm-b6dfbc84-dd52-48cb-8c7c-3d52b14f275f';
    const firstId = `season:${rhythmId}:2026-10-05:unknown`;
    const secondId = `season:${rhythmId}:2026-10-25`;
    const assignments = rhythmSeasonPaletteAssignments([
      createRhythmSeason(
        rhythmId,
        '2026-10-05',
        { frequency: 'weekly', weekdays: [1, 3, 5] },
        undefined,
        firstId,
        'fern'
      ),
      createRhythmSeason(
        rhythmId,
        '2026-10-25',
        { frequency: 'weekly', weekdays: [1] },
        undefined,
        secondId,
        'fern'
      )
    ]);

    expect(assignments.get(firstId)).toBe('fern');
    expect(assignments.get(secondId)).toBe('sage');
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
