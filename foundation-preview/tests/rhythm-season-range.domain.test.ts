import { describe, expect, it } from 'vitest';
import { resolveRhythmSeasonRange, restoreRhythmSeasonRange } from '../src/domain/rhythm-season-range.ts';
import { selectRhythmScore } from '../src/domain/rhythm-scoring.ts';
import {
  createRhythmSeason,
  createUnknownRhythmSeason,
  rhythmSeasonForDate
} from '../src/domain/rhythm-seasons.ts';
import type { RhythmSchedule, RhythmScoringMetadata } from '../src/domain/rhythm-schedule.ts';

const rhythmId = 'season-range-fixture';
const timeZone = 'UTC';
const daily: RhythmSchedule = { frequency: 'daily' };
const weekly: RhythmSchedule = { frequency: 'weekly', weekdays: [1, 3, 5] };

function scoringOf(
  scheduleHistory: RhythmScoringMetadata['scheduleHistory']
): RhythmScoringMetadata {
  return { trackingStartDate: scheduleHistory.find(season => season.kind === 'scheduled')!.startDate, timeZone, scheduleHistory };
}

function apply(
  scoring: RhythmScoringMetadata,
  startDate: string,
  endDate: string | undefined,
  schedule: RhythmSchedule = weekly,
  segmentId?: string,
  asOfDate = '2024-08-15'
) {
  const active = rhythmSeasonForDate(scoring.scheduleHistory, asOfDate);
  if (active?.kind !== 'scheduled') throw new Error('Fixture needs a known schedule today.');
  return resolveRhythmSeasonRange({
    rhythmId,
    currentSchedule: active.schedule,
    scoring,
    timeZone,
    asOfDate,
    draft: {
      ...(segmentId ? { segmentId } : {}),
      startDate,
      ...(endDate ? { endDate } : {}),
      schedule,
      timeOfDay: 'evening',
      name: 'New schedule'
    }
  });
}

describe('resolving Season date ranges', () => {
  it('keeps the first Season on or before its earliest dated log and rejects a later boundary', () => {
    const first = createRhythmSeason(rhythmId, '2024-01-01', daily, 'morning', 'season-first');
    const current = createRhythmSeason(rhythmId, '2024-03-01', weekly, 'evening', 'season-current');
    const scoring = scoringOf([first, current]);
    const resolveStart = (startDate: string, earliestCompletionDate?: string) =>
      resolveRhythmSeasonRange({
        rhythmId,
        currentSchedule: weekly,
        scoring,
        timeZone,
        asOfDate: '2024-04-01',
        draft: {
          segmentId: first.id,
          startDate,
          schedule: daily,
          timeOfDay: 'morning',
          name: 'First'
        },
        ...(earliestCompletionDate ? { coverage: { earliestCompletionDate } } : {})
      });

    expect(resolveStart('2024-01-09', '2024-01-10')).toMatchObject({ valid: true });
    expect(resolveStart('2024-01-10', '2024-01-10')).toMatchObject({ valid: true });
    expect(resolveStart('2024-01-11', '2024-01-10')).toEqual({
      valid: false,
      error: 'The first Season cannot start after the earliest logged moment (2024-01-10).'
    });
    expect(resolveStart('2024-01-11')).toMatchObject({ valid: true });
  });

  it('splits a surrounding season into preserved before/after fragments with inclusive dates', () => {
    const original = {
      ...createRhythmSeason(rhythmId, '2024-01-01', daily, 'morning', 'season-original'),
      name: 'Original',
      note: 'preserve this note',
      contextCadence: 'Daily'
    };
    const result = apply(scoringOf([original]), '2024-02-01', '2024-02-29');

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    const history = result.scoring.scheduleHistory;
    expect(history.map(season => season.startDate)).toEqual([
      '2024-01-01',
      '2024-02-01',
      '2024-03-01'
    ]);
    expect(history[0]).toMatchObject({
      id: original.id,
      kind: 'scheduled',
      name: 'Original',
      note: 'preserve this note',
      contextCadence: 'Daily',
      schedule: { frequency: 'daily' }
    });
    expect(history[1]).toMatchObject({
      kind: 'scheduled',
      startDate: '2024-02-01',
      schedule: { frequency: 'weekly', weekdays: [1, 3, 5], endDate: '2024-02-29' },
      timeOfDay: 'evening',
      name: 'New schedule'
    });
    expect(history[2]).toMatchObject({
      kind: 'scheduled',
      startDate: '2024-03-01',
      schedule: { frequency: 'daily' },
      name: 'Original',
      note: 'preserve this note'
    });
    expect(history[2]?.id).not.toBe(original.id);
    expect(result.selectedChange).toBeUndefined();
    expect(result.changes).toMatchObject([{ seasonId: original.id, change: 'split' }]);
    expect(rhythmSeasonForDate(history, '2024-01-31')?.id).toBe(original.id);
    expect(rhythmSeasonForDate(history, '2024-02-01')?.id).toBe(history[1]?.id);
    expect(rhythmSeasonForDate(history, '2024-02-29')?.id).toBe(history[1]?.id);
    expect(rhythmSeasonForDate(history, '2024-03-01')?.id).toBe(history[2]?.id);
    expect(result.schedule).toEqual(daily);
  });

  it('extends the explicit tracking boundary and produces the same mixed-frequency score after reload', () => {
    const current = createRhythmSeason(
      rhythmId,
      '2026-10-21',
      daily,
      'morning',
      'season-current'
    );
    const original = scoringOf([current]);
    const addRange = (source: RhythmScoringMetadata, startDate: string, endDate: string, schedule: RhythmSchedule) =>
      resolveRhythmSeasonRange({
        rhythmId,
        currentSchedule: daily,
        scoring: source,
        timeZone,
        asOfDate: '2026-10-26',
        draft: {
          startDate,
          endDate,
          schedule,
          timeOfDay: 'evening',
          name: ''
        }
      });
    const earlierDaily = addRange(original, '2026-09-01', '2026-10-20', daily);
    expect(earlierDaily.valid).toBe(true);
    if (!earlierDaily.valid) return;
    const selectedDays: RhythmSchedule = {
      frequency: 'weekly',
      weekdays: [0, 2, 5, 6]
    };
    const corrected = addRange(earlierDaily.scoring, '2026-10-17', '2026-10-20', selectedDays);
    expect(corrected.valid).toBe(true);
    if (!corrected.valid) return;
    expect(corrected.scoring.trackingStartDate).toBe('2026-09-01');
    expect(corrected.scoring.scheduleHistory.map(season => season.startDate)).toEqual([
      '2026-09-01',
      '2026-10-17',
      '2026-10-21'
    ]);

    const records = [
      { id: 'saturday', rhythmId, effectiveDate: '2026-10-17' },
      { id: 'sunday', rhythmId, effectiveDate: '2026-10-18' },
      { id: 'tuesday', rhythmId, effectiveDate: '2026-10-20' }
    ];
    const scoreInput = {
      rhythmId,
      schedule: daily,
      scoring: corrected.scoring,
      records,
      recordsAvailable: true,
      asOfDate: '2026-10-26',
      timeZone,
      createdLocalDate: '2026-10-21',
      createdTimeZone: timeZone
    } as const;
    const previewScore = selectRhythmScore(scoreInput);
    expect(previewScore).toMatchObject({
      kind: 'rhythm-score',
      trackingStartDate: '2026-09-01',
      consistency: {
        kind: 'scored',
        exactPercent: (3 / 28) * 100,
        evidence: {
          windowStartDate: '2026-09-27',
          windowEndDate: '2026-10-25',
          eligibleDueCount: 28,
          completedCount: 3
        }
      }
    });
    const reloadedScore = selectRhythmScore({
      ...scoreInput,
      scoring: JSON.parse(JSON.stringify(corrected.scoring)) as RhythmScoringMetadata
    });
    expect(reloadedScore).toEqual(previewScore);
  });

  it('replaces a fully covered middle Season without disturbing its neighbors', () => {
    const first = createRhythmSeason(rhythmId, '2024-01-01', daily, 'morning', 'season-first');
    const replaced = {
      ...createRhythmSeason(rhythmId, '2024-02-01', weekly, 'afternoon', 'season-replaced'),
      name: 'Old middle schedule'
    };
    const last = createRhythmSeason(rhythmId, '2024-03-01', daily, 'evening', 'season-last');
    const result = apply(scoringOf([first, replaced, last]), '2024-02-01', '2024-02-29');

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.scoring.scheduleHistory.map(season => season.startDate)).toEqual([
      '2024-01-01',
      '2024-02-01',
      '2024-03-01'
    ]);
    expect(result.changes).toEqual([
      expect.objectContaining({ seasonId: replaced.id, change: 'replaced' })
    ]);
    expect(result.scoring.scheduleHistory[0]).toEqual(first);
    expect(result.scoring.scheduleHistory[1]).toMatchObject({
      kind: 'scheduled',
      schedule: { frequency: 'weekly', endDate: '2024-02-29' }
    });
    expect(result.scoring.scheduleHistory[2]).toEqual(last);
  });

  it('trims and replaces every overlapped season when a range spans multiple boundaries', () => {
    const first = createRhythmSeason(rhythmId, '2024-01-01', daily, 'morning', 'season-first');
    const second = {
      ...createRhythmSeason(rhythmId, '2024-04-01', weekly, 'afternoon', 'season-second'),
      name: 'Second'
    };
    const current = createRhythmSeason(rhythmId, '2024-07-01', daily, 'evening', 'season-current');
    const result = apply(scoringOf([first, second, current]), '2024-03-01', '2024-05-31');

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.scoring.scheduleHistory.map(season => season.startDate)).toEqual([
      '2024-01-01',
      '2024-03-01',
      '2024-06-01',
      '2024-07-01'
    ]);
    expect(result.changes).toEqual([
      expect.objectContaining({ seasonId: first.id, change: 'shortened' }),
      expect.objectContaining({ seasonId: second.id, change: 'shortened' })
    ]);
    expect(result.scoring.scheduleHistory[2]).toMatchObject({
      id: second.id,
      kind: 'scheduled',
      name: 'Second',
      timeOfDay: 'afternoon',
      schedule: weekly
    });
    expect(result.scoring.scheduleHistory[3]).toEqual(current);
  });

  it('keeps future finite additions bounded and leaves the current schedule effective until then', () => {
    const current = createRhythmSeason(rhythmId, '2024-01-01', daily, 'morning', 'season-current');
    const original = scoringOf([current]);
    const result = apply(original, '2024-12-01', '2024-12-31', weekly);

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.schedule).toEqual(daily);
    expect(result.scoring.scheduleHistory.map(season => season.startDate)).toEqual([
      '2024-01-01',
      '2024-12-01',
      '2025-01-01'
    ]);
    expect(result.scoring.scheduleHistory[0]).toMatchObject({ id: current.id, schedule: daily });
    expect(result.scoring.scheduleHistory.at(-1)).toMatchObject({ schedule: daily });
    expect(result.scoring.scheduleHistory.at(-1)?.id).not.toBe(current.id);
    const scored = selectRhythmScore({
      rhythmId,
      schedule: result.schedule,
      scoring: result.scoring,
      records: [],
      recordsAvailable: true,
      asOfDate: '2024-08-15',
      timeZone
    });
    expect(scored.kind).toBe('rhythm-score');
  });

  it('supports an open-ended range and resolves the active current schedule by date', () => {
    const current = createRhythmSeason(rhythmId, '2024-01-01', daily, 'morning', 'season-current');
    const result = apply(scoringOf([current]), '2024-09-01', undefined, weekly);

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.scoring.scheduleHistory.map(season => season.startDate)).toEqual([
      '2024-01-01',
      '2024-09-01'
    ]);
    expect(result.schedule).toEqual(daily);
    expect(result.scoring.scheduleHistory.at(-1)).toMatchObject({ schedule: weekly });
  });

  it('keeps unknown history explicit around an insertion and does not invent a prior schedule', () => {
    const unknown = createUnknownRhythmSeason(rhythmId, '2024-01-01', '5 times a week');
    const current = createRhythmSeason(rhythmId, '2024-03-01', daily, 'morning', 'season-current');
    const result = apply(scoringOf([unknown, current]), '2024-02-01', '2024-02-15');

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.scoring.scheduleHistory).toMatchObject([
      { kind: 'unknown', id: unknown.id, startDate: '2024-01-01', descriptiveCadence: '5 times a week' },
      { kind: 'scheduled', startDate: '2024-02-01', schedule: { frequency: 'weekly', endDate: '2024-02-15' } },
      { kind: 'unknown', startDate: '2024-02-16' },
      { kind: 'scheduled', id: current.id, startDate: '2024-03-01', schedule: daily }
    ]);
    expect(result.changes).toEqual([
      expect.objectContaining({ seasonId: unknown.id, change: 'split' })
    ]);
  });

  it('uses the user range when editing dates and retains logs as date evidence', () => {
    const first = createRhythmSeason(rhythmId, '2024-01-01', daily, 'morning', 'season-first');
    const selected = {
      ...createRhythmSeason(rhythmId, '2024-03-01', weekly, 'afternoon', 'season-selected'),
      name: 'Selected'
    };
    const current = createRhythmSeason(rhythmId, '2024-05-01', daily, 'evening', 'season-current');
    const original = scoringOf([first, selected, current]);
    const result = apply(original, '2024-02-15', '2024-03-31', weekly, selected.id);

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.selectedChange).toEqual({
      seasonId: selected.id,
      label: 'Selected',
      change: 'shortened'
    });
    expect(result.scoring.scheduleHistory.map(season => season.startDate)).toEqual([
      '2024-01-01',
      '2024-02-15',
      '2024-04-01',
      '2024-05-01'
    ]);
    const records = ['2024-02-20', '2024-03-03', '2024-04-15'].map((effectiveDate, index) => ({
      id: `saved-log-${index}`,
      rhythmId,
      effectiveDate
    }));
    expect(records.map(record => record.effectiveDate)).toEqual(['2024-02-20', '2024-03-03', '2024-04-15']);
    expect(result.scoring.scheduleHistory.find(season => season.startDate === '2024-04-01'))
      .toMatchObject({ kind: 'unknown', startDate: '2024-04-01' });
  });

  it('preserves score evidence and allows a guarded snapshot Undo only before later changes', () => {
    const original = scoringOf([
      createRhythmSeason(rhythmId, '2024-01-01', daily, 'morning', 'season-current')
    ]);
    const result = apply(original, '2024-02-01', '2024-02-29');
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    const restore = restoreRhythmSeasonRange(
      rhythmId,
      result.schedule,
      result.scoring,
      result.scoring,
      result.schedule,
      original,
      daily
    );
    expect(restore).toEqual({ valid: true, scoring: original, schedule: daily });
    expect(restoreRhythmSeasonRange(
      rhythmId,
      result.schedule,
      result.scoring,
      original,
      daily,
      original,
      daily
    )).toMatchObject({ valid: false, error: expect.stringContaining('changed after the Season update') });
  });

  it('rejects invalid and inverted ranges without changing the input timeline', () => {
    const original = scoringOf([
      createRhythmSeason(rhythmId, '2024-01-01', daily, 'morning', 'season-current')
    ]);
    expect(apply(original, '2024-02-01', '2024-01-31'))
      .toMatchObject({ valid: false, error: expect.stringContaining('date range') });
    expect(original.scheduleHistory).toHaveLength(1);
    expect(apply(original, '2024-02-01', '2024-02-29').valid).toBe(true);
  });
});
