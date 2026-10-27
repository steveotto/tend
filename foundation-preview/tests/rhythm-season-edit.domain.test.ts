import { describe, expect, it } from 'vitest';
import { establishCurrentRhythmSeason } from '../src/domain/rhythm-season-edit.ts';
import { selectRhythmScore } from '../src/domain/rhythm-scoring.ts';
import {
  createRhythmSeason,
  ensureRhythmSeasonHistoryCoverage,
  rhythmSeasonForDate,
  rhythmSeasonInclusiveEndDate
} from '../src/domain/rhythm-seasons.ts';
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

  it('preserves the known preceding schedule when establishing a dated current Season', () => {
    const result = establishCurrentRhythmSeason(
      rhythmId,
      currentSchedule,
      undefined,
      'UTC',
      asOfDate,
      draft('2026-10-24'),
      {
        effectiveStartDate: '2026-10-01',
        earliestCompletionDate: '2026-10-17',
        previousTimeOfDay: 'morning'
      }
    );

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    const [previous, current] = result.scoring.scheduleHistory;
    expect(result.scoring.scheduleHistory).toHaveLength(2);
    expect(previous).toMatchObject({
      kind: 'scheduled',
      startDate: '2026-10-01',
      schedule: currentSchedule,
      timeOfDay: 'morning'
    });
    expect(current).toMatchObject({ kind: 'scheduled', startDate: '2026-10-24', schedule: proposedSchedule });
    expect(rhythmSeasonInclusiveEndDate(result.scoring.scheduleHistory, 0)).toBe('2026-10-23');
    expect(rhythmSeasonForDate(result.scoring.scheduleHistory, '2026-10-23')).toBe(previous);
    expect(rhythmSeasonForDate(result.scoring.scheduleHistory, '2026-10-24')).toBe(current);
    const records = ['2026-10-17', '2026-10-18', '2026-10-20'].map((effectiveDate, index) => ({
      id: `completion-${index}`,
      rhythmId,
      effectiveDate
    }));
    for (const date of records.map(record => record.effectiveDate)) {
      const season = rhythmSeasonForDate(result.scoring.scheduleHistory, date);
      expect(season?.kind).toBe('scheduled');
      if (season?.kind === 'scheduled') expect(season.schedule).toEqual(currentSchedule);
    }
    const selected = selectRhythmScore({
      rhythmId,
      schedule: proposedSchedule,
      scoring: result.scoring,
      records,
      recordsAvailable: true,
      createdLocalDate: '2026-10-01',
      createdTimeZone: 'UTC',
      asOfDate: '2026-10-26',
      timeZone: 'UTC'
    });
    expect(selected.kind).toBe('rhythm-score');
    if (selected.kind === 'rhythm-score' && selected.consistency.kind === 'scored') {
      expect(selected.consistency.evidence.occurrences.filter(occurrence =>
        records.some(record => record.effectiveDate === occurrence.date)
      )).toMatchObject([
        { date: '2026-10-17', status: 'completed', recordIds: ['completion-0'] },
        { date: '2026-10-18', status: 'completed', recordIds: ['completion-1'] },
        { date: '2026-10-20', status: 'completed', recordIds: ['completion-2'] }
      ]);
    } else {
      throw new Error('The known historical schedule should produce scored evidence.');
    }
  });

  it('uses the earliest log when no original effective start date exists', () => {
    const result = establishCurrentRhythmSeason(
      rhythmId,
      currentSchedule,
      undefined,
      'UTC',
      asOfDate,
      draft('2026-10-24'),
      { earliestCompletionDate: '2026-10-17' }
    );

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.scoring.scheduleHistory.map(season => season.startDate))
      .toEqual(['2026-10-17', '2026-10-24']);
  });

  it('repairs missing legacy coverage as one stable unknown interval', () => {
    const current = createRhythmSeason(rhythmId, '2026-10-24', proposedSchedule);
    const repaired = ensureRhythmSeasonHistoryCoverage(rhythmId, [current], '2026-10-17');
    const repeated = ensureRhythmSeasonHistoryCoverage(rhythmId, repaired, '2026-10-17');

    expect(repaired).toHaveLength(2);
    expect(repaired[0]).toMatchObject({ kind: 'unknown', startDate: '2026-10-17' });
    expect(repeated).toEqual(repaired);
    expect(ensureRhythmSeasonHistoryCoverage(rhythmId, repaired, '2026-10-01')).toEqual([
      { ...repaired[0]!, startDate: '2026-10-01' },
      current
    ]);

    const selected = selectRhythmScore({
      rhythmId,
      schedule: proposedSchedule,
      scoring: {
        trackingStartDate: current.startDate,
        timeZone: 'UTC',
        scheduleHistory: repaired
      },
      records: ['2026-10-17', '2026-10-18', '2026-10-20'].map((effectiveDate, index) => ({
        id: `unknown-history-completion-${index}`,
        rhythmId,
        effectiveDate
      })),
      recordsAvailable: true,
      createdLocalDate: '2026-10-01',
      createdTimeZone: 'UTC',
      asOfDate: '2026-10-26',
      timeZone: 'UTC'
    });
    expect(selected.kind).toBe('rhythm-score');
    if (selected.kind === 'rhythm-score') {
      expect(selected.consistency).toMatchObject({
        kind: 'unscored',
        reasonCode: 'unsupported-history'
      });
      expect(selected.healthScore).toBeNull();
    }
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
