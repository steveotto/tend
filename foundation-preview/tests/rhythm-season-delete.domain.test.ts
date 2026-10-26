import { describe, expect, it } from 'vitest';
import {
  createRhythmSeason,
  createUnknownRhythmSeason,
  rhythmSeasonPaletteForOrdinal
} from '../src/domain/rhythm-seasons.ts';
import { deleteRhythmSeason, restoreDeletedRhythmSeason } from '../src/domain/rhythm-season-delete.ts';
import type { RhythmScoringMetadata } from '../src/domain/rhythm-schedule.ts';

function fixture() {
  const first = {
    ...createRhythmSeason(
      'delete-fixture',
      '2024-01-01',
      { frequency: 'weekly', weekdays: [1] },
      'morning',
      undefined,
      rhythmSeasonPaletteForOrdinal(0)
    ),
    name: 'Monday season',
    note: 'first-note'
  };
  const middle = {
    ...createRhythmSeason(
      'delete-fixture',
      '2024-02-01',
      { frequency: 'weekly', weekdays: [2] },
      'afternoon',
      'season-middle',
      rhythmSeasonPaletteForOrdinal(1)
    ),
    name: 'Tuesday season',
    note: 'middle-note'
  };
  const current = {
    ...createRhythmSeason(
      'delete-fixture',
      '2024-03-01',
      { frequency: 'weekly', weekdays: [3] },
      'evening',
      'season-current',
      rhythmSeasonPaletteForOrdinal(2)
    ),
    name: 'Wednesday season',
    note: 'current-note'
  };
  const scoring: RhythmScoringMetadata = {
    trackingStartDate: first.startDate,
    timeZone: 'UTC',
    scheduleHistory: [first, middle, current]
  };
  return { first, middle, current, scoring };
}

describe('Rhythm Season deletion and scoped Undo', () => {
  it('removes a middle boundary while preserving the next boundary and every surviving identity', () => {
    const { first, middle, current, scoring } = fixture();
    const result = deleteRhythmSeason(current.schedule, scoring, middle.id);

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.scoring.scheduleHistory).toEqual([first, current]);
    expect(result.scoring.scheduleHistory[0]).toMatchObject({
      id: first.id,
      name: first.name,
      note: first.note,
      paletteToken: first.paletteToken,
      schedule: first.schedule
    });
    expect(result.scoring.scheduleHistory[1]).toMatchObject({
      id: current.id,
      name: current.name,
      note: current.note,
      paletteToken: current.paletteToken,
      startDate: current.startDate
    });
    expect(result.schedule).toEqual(current.schedule);
    expect(result.activeTimeOfDay).toBeUndefined();
  });

  it('makes the predecessor current and synchronizes its known schedule time metadata', () => {
    const { first, middle, current, scoring } = fixture();
    const result = deleteRhythmSeason(current.schedule, scoring, current.id);

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.scoring.scheduleHistory).toEqual([first, middle]);
    expect(result.schedule).toEqual(middle.schedule);
    expect(result.activeTimeOfDay).toBe('afternoon');
  });

  it('rejects first and unresolved history entries and does not delete when the prior schedule ended', () => {
    const { first, middle, current, scoring } = fixture();
    expect(deleteRhythmSeason(current.schedule, scoring, first.id))
      .toMatchObject({ valid: false, error: expect.stringContaining('first Season') });

    const unknown = createUnknownRhythmSeason('delete-fixture', '2024-01-15', '3 times a week');
    const unknownHistory: RhythmScoringMetadata = {
      ...scoring,
      trackingStartDate: first.startDate,
      scheduleHistory: [first, unknown, current]
    };
    expect(deleteRhythmSeason(current.schedule, unknownHistory, unknown.id))
      .toMatchObject({ valid: false, error: expect.stringContaining('repair it') });
    expect(deleteRhythmSeason(current.schedule, unknownHistory, current.id))
      .toMatchObject({ valid: false, error: expect.stringContaining('preceding schedule needs details') });

    const missingTimeFirst = createRhythmSeason('delete-fixture', first.startDate, first.schedule);
    const missingTimeHistory: RhythmScoringMetadata = {
      ...scoring,
      scheduleHistory: [missingTimeFirst, current]
    };
    expect(deleteRhythmSeason(current.schedule, missingTimeHistory, current.id))
      .toMatchObject({ valid: false, error: expect.stringContaining('no saved time of day') });

    const endedFirst = {
      ...first,
      schedule: { ...first.schedule, endDate: '2024-01-31' }
    };
    const endedHistory: RhythmScoringMetadata = {
      ...scoring,
      scheduleHistory: [endedFirst, middle, current]
    };
    expect(deleteRhythmSeason(current.schedule, endedHistory, middle.id))
      .toMatchObject({ valid: false, error: expect.stringContaining('end date') });
  });

  it('restores the exact deleted Season and blocks Undo after a schedule edit', () => {
    const { first, middle, current, scoring } = fixture();
    const deletion = deleteRhythmSeason(current.schedule, scoring, current.id);
    expect(deletion.valid).toBe(true);
    if (!deletion.valid) return;
    const undo = {
      rhythmId: 'delete-fixture',
      season: deletion.deletedSeason,
      index: deletion.index,
      expectedScoring: deletion.scoring,
      expectedSchedule: deletion.schedule,
      expectedCadence: 'Monday schedule' as const,
      expectedTimeLabel: 'Afternoon' as const,
      expectedTimeOfDay: 'afternoon' as const,
      restoreSchedule: current.schedule,
      restoreCadence: 'Wednesday schedule' as const,
      restoreTimeLabel: 'Evening' as const,
      restoreTimeOfDay: 'evening' as const
    };
    const restored = restoreDeletedRhythmSeason(
      'delete-fixture',
      deletion.schedule,
      deletion.scoring,
      undo.expectedCadence,
      undo.expectedTimeLabel,
      undo.expectedTimeOfDay,
      undo
    );
    expect(restored).toMatchObject({
      valid: true,
      schedule: current.schedule,
      cadence: undo.restoreCadence,
      timeLabel: undo.restoreTimeLabel,
      timeOfDay: undo.restoreTimeOfDay
    });
    if (!restored.valid) return;
    expect(restored.scoring.scheduleHistory).toEqual([first, middle, current]);

    const changedScoring = {
      ...deletion.scoring,
      scheduleHistory: [first, { ...middle, name: 'Changed after delete' }]
    };
    expect(restoreDeletedRhythmSeason(
      'delete-fixture',
      deletion.schedule,
      changedScoring,
      undo.expectedCadence,
      undo.expectedTimeLabel,
      undo.expectedTimeOfDay,
      undo
    )).toMatchObject({ valid: false, error: expect.stringContaining('changed after deletion') });
  });

  it('preserves palette assignments through deletion and Undo after cycling past five Seasons', () => {
    const scheduleHistory = Array.from({ length: 7 }, (_, index) =>
      createRhythmSeason(
        'palette-delete-fixture',
        `2024-01-0${index + 1}`,
        { frequency: 'weekly', weekdays: [index as 0 | 1 | 2 | 3 | 4 | 5 | 6] },
        'morning'
      ));
    const scoring: RhythmScoringMetadata = {
      trackingStartDate: scheduleHistory[0]!.startDate,
      timeZone: 'UTC',
      scheduleHistory
    };
    const currentSchedule = scheduleHistory.at(-1)!.schedule;
    const deletedIndex = 3;
    const deletion = deleteRhythmSeason(
      currentSchedule,
      scoring,
      scheduleHistory[deletedIndex]!.id
    );

    expect(deletion.valid).toBe(true);
    if (!deletion.valid) return;
    expect(deletion.scoring.scheduleHistory.map(season => season.paletteToken)).toEqual([
      'fern', 'sage', 'sky', 'plum', 'fern', 'sage'
    ]);
    const undo = {
      rhythmId: 'palette-delete-fixture',
      season: deletion.deletedSeason,
      index: deletion.index,
      expectedScoring: deletion.scoring,
      expectedSchedule: deletion.schedule,
      expectedCadence: 'Daily',
      expectedTimeLabel: 'Morning',
      expectedTimeOfDay: 'morning' as const,
      restoreSchedule: currentSchedule,
      restoreCadence: 'Daily',
      restoreTimeLabel: 'Morning' as const,
      restoreTimeOfDay: 'morning' as const
    };
    const restored = restoreDeletedRhythmSeason(
      undo.rhythmId,
      deletion.schedule,
      deletion.scoring,
      undo.expectedCadence,
      undo.expectedTimeLabel,
      undo.expectedTimeOfDay,
      undo
    );

    expect(restored.valid).toBe(true);
    if (restored.valid) {
      expect(restored.scoring.scheduleHistory.map(season => season.paletteToken))
        .toEqual(['fern', 'sage', 'sky', 'ocean', 'plum', 'fern', 'sage']);
    }
  });
});
