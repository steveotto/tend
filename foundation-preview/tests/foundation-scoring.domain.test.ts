import { describe, expect, it } from 'vitest';
import { marriageRhythms, todayRhythms } from '../src/domain/preview-data.ts';
import type { RhythmPreview } from '../src/domain/preview-data.ts';
import type { RhythmSchedule } from '../src/domain/rhythm-schedule.ts';
import { addCalendarDays, selectRhythmScore } from '../src/domain/rhythm-scoring.ts';
import { createRhythmSeason } from '../src/domain/rhythm-seasons.ts';
import {
  selectFoundationRhythmScores,
  selectFoundationScore
} from '../src/domain/foundation-scoring.ts';
import type {
  RhythmScoreResult,
  RhythmScoreSelection,
  UnscoredMetric
} from '../src/domain/rhythm-scoring.ts';

const consistencyEvidence = {
  frequency: 'daily' as const,
  windowStartDate: '2026-10-01',
  windowEndDate: '2026-10-27',
  eligibleDueCount: 1,
  completedCount: 1,
  notCompletedCount: 0,
  limitedHistoryDays: null,
  todayIncluded: true,
  occurrences: []
};

function scored(consistency: number, onTrack: number): RhythmScoreSelection {
  return {
    kind: 'rhythm-score',
    asOfDate: '2026-10-27',
    timeZone: 'UTC',
    trackingStartDate: '2026-10-01',
    consistency: {
      kind: 'scored',
      score: consistency,
      exactPercent: consistency,
      evidence: consistencyEvidence
    },
    onTrack: {
      kind: 'scored',
      score: onTrack,
      evidence: {
        lastQualifyingCompletionDate: '2026-10-27',
        missedOccurrenceCount: 0,
        pointsPerMissedOccurrence: 10,
        deduction: 0,
        occurrences: [],
        repeatedZeroScoreSpans: [],
        scheduleChanges: []
      }
    },
    healthScore: consistency * 0.75 + onTrack * 0.25
  };
}

const unscoredMetric: UnscoredMetric = {
  kind: 'unscored',
  reasonCode: 'ready-for-first-tend',
  explanation: 'Ready for your first Tend.'
};

function rhythm(
  id: string,
  primaryFoundationId: string | null,
  secondaryFoundationIds: readonly string[] = [],
  cadence = 'Daily'
): RhythmPreview {
  return {
    ...marriageRhythms[0]!,
    id,
    title: id,
    cadence,
    primaryFoundationId,
    secondaryFoundationIds
  };
}

describe('selecting equal-weight Foundation scores', () => {
  it('keeps the synthetic Take a walk fixture unscored without a structured schedule or completion history', () => {
    const rhythm = todayRhythms.find(item => item.id === 'sample-walk')!;
    const score = selectFoundationRhythmScores(
      [rhythm],
      [],
      new Set([rhythm.id]),
      new Date('2026-10-23T12:00:00Z'),
      'UTC'
    ).get(rhythm.id);

    expect(rhythm.completionHistory).toBeUndefined();
    expect(rhythm.schedule).toBeUndefined();
    expect(score).toMatchObject({
      kind: 'unscored',
      reason: { reasonCode: 'unsupported-schedule' },
      onTrack: { kind: 'unscored' }
    });
  });

  it('reselects Rhythm scores when saved completion records or schedule change', () => {
    const asOfDate = '2026-10-27';
    const trackingStartDate = '2026-09-28';
    const rhythmId = 'changing-rhythm';
    const rhythmWithHistory: RhythmPreview = {
      ...rhythm(rhythmId, 'connection'),
      schedule: { frequency: 'daily' },
      scoring: {
        trackingStartDate,
        timeZone: 'UTC',
        scheduleHistory: [
          createRhythmSeason(rhythmId, trackingStartDate, { frequency: 'daily' })
        ]
      },
      createdLocalDate: trackingStartDate,
      createdTimeZone: 'UTC',
      completionHistory: [
        ...Array.from({ length: 23 }, (_, index) => ({
          id: `completion-${index}`,
          effectiveDate: addCalendarDays(trackingStartDate, index)
        })),
        { id: 'completion-today', effectiveDate: asOfDate }
      ]
    };
    const instant = new Date(`${asOfDate}T12:00:00.000Z`);
    const initial = selectFoundationRhythmScores(
      [rhythmWithHistory],
      [],
      new Set(),
      instant,
      'UTC'
    ).get(rhythmId);

    expect(initial?.kind).toBe('rhythm-score');
    if (initial?.kind !== 'rhythm-score') throw new Error('Expected the daily Rhythm to be scored.');
    expect(initial.consistency).toMatchObject({ kind: 'scored', score: 80 });
    expect(initial.onTrack).toMatchObject({ kind: 'scored', score: 100 });

    const addedCompletion = selectFoundationRhythmScores(
      [{
        ...rhythmWithHistory,
        completionHistory: [
          ...rhythmWithHistory.completionHistory!,
          { id: 'completion-added', effectiveDate: '2026-10-25' }
        ]
      }],
      [],
      new Set(),
      instant,
      'UTC'
    ).get(rhythmId);
    expect(addedCompletion?.kind).toBe('rhythm-score');
    if (addedCompletion?.kind !== 'rhythm-score') throw new Error('Expected the updated Rhythm to be scored.');
    expect(addedCompletion.consistency.kind).toBe('scored');
    if (addedCompletion.consistency.kind !== 'scored') throw new Error('Expected Consistency to be scored.');
    expect(addedCompletion.consistency.score).toBeCloseTo(83.3333);
    expect(addedCompletion.onTrack).toMatchObject({ kind: 'scored', score: 100 });

    const changedSchedule = selectFoundationRhythmScores(
      [{
        ...rhythmWithHistory,
        schedule: { frequency: 'weekly', weekdays: [1, 3, 5] },
        scoring: {
          trackingStartDate,
          timeZone: 'UTC',
          scheduleHistory: [
            createRhythmSeason(
              rhythmId,
              trackingStartDate,
              { frequency: 'weekly', weekdays: [1, 3, 5] }
            )
          ]
        }
      }],
      [],
      new Set(),
      instant,
      'UTC'
    ).get(rhythmId);
    expect(changedSchedule?.kind).toBe('rhythm-score');
    if (changedSchedule?.kind !== 'rhythm-score') throw new Error('Expected the rescheduled Rhythm to be scored.');
    expect(changedSchedule.consistency).toMatchObject({ kind: 'scored' });
    expect(changedSchedule.consistency).not.toEqual(initial.consistency);
  });

  it('uses the 12-week shared-engine window for selected-weekday Rhythm scores', () => {
    const rhythmId = 'selected-weekday-rhythm';
    const asOfDate = '2026-10-27';
    const startDate = '2026-08-05';
    const schedule: RhythmSchedule = {
      frequency: 'weekly',
      weekdays: [1, 3, 5]
    };
    const completionHistory: { id: string; effectiveDate: string }[] = [];
    for (let date = startDate; date <= asOfDate; date = addCalendarDays(date, 1)) {
      if (new Date(`${date}T00:00:00.000Z`).getUTCDay() === 1) {
        completionHistory.push({ id: `monday-${date}`, effectiveDate: date });
      }
    }
    const rhythmWithHistory: RhythmPreview = {
      ...rhythm(rhythmId, 'connection'),
      schedule,
      scoring: {
        trackingStartDate: startDate,
        timeZone: 'UTC',
        scheduleHistory: [createRhythmSeason(rhythmId, startDate, schedule)]
      },
      createdLocalDate: startDate,
      createdTimeZone: 'UTC',
      completionHistory
    };
    const legacy = selectRhythmScore({
      rhythmId,
      schedule,
      ...(rhythmWithHistory.scoring ? { scoring: rhythmWithHistory.scoring } : {}),
      createdLocalDate: startDate,
      createdTimeZone: 'UTC',
      records: completionHistory.map(record => ({ ...record, rhythmId })),
      recordsAvailable: true,
      asOfDate,
      timeZone: 'UTC'
    });
    const selected = selectFoundationRhythmScores(
      [rhythmWithHistory],
      [],
      new Set(),
      new Date(`${asOfDate}T12:00:00.000Z`),
      'UTC'
    ).get(rhythmId);

    if (selected?.kind !== 'rhythm-score') {
      throw new Error(selected?.kind === 'invalid' ? selected.reason : 'Expected the selected-weekday Rhythm to be scored.');
    }
    expect(selected.kind).toBe('rhythm-score');
    expect(selected.consistency).toMatchObject({
      kind: 'scored',
      evidence: {
        frequency: 'weekly',
        windowStartDate: '2026-08-05',
        eligibleDueCount: 36,
        completedCount: 12
      }
    });
    if (selected.consistency.kind !== 'scored') throw new Error('Expected selected-weekday Consistency to be scored.');
    expect(selected.consistency.score).toBeCloseTo(100 / 3);
    expect(selected.onTrack).toMatchObject({ kind: 'scored', score: 100 });
    expect(selected.healthScore).toBeCloseTo(50);
    expect(legacy.kind).toBe('rhythm-score');
    if (legacy.kind !== 'rhythm-score' || legacy.consistency.kind !== 'scored') {
      throw new Error('Expected the prior scorer to produce a Rhythm score for comparison.');
    }
    expect(legacy.consistency.score).toBeCloseTo(500 / 13);
    expect(legacy.healthScore).toBeCloseTo(500 / 13 * 0.75 + 25);
  });

  it('applies the lifetime missed-occurrence streak to Rhythm On Track scores', () => {
    const rhythmId = 'old-yearly-rhythm';
    const schedule: RhythmSchedule = {
      frequency: 'yearly',
      month: 12,
      pattern: { kind: 'dayOfMonth', day: 1 }
    };
    const selected = selectFoundationRhythmScores(
      [{
        ...rhythm(rhythmId, 'connection'),
        schedule,
        scoring: {
          trackingStartDate: '2010-12-01',
          timeZone: 'UTC',
          scheduleHistory: [createRhythmSeason(rhythmId, '2010-12-01', schedule)]
        },
        createdLocalDate: '2010-12-01',
        createdTimeZone: 'UTC',
        completionHistory: [{ id: 'first-completion', effectiveDate: '2010-12-01' }]
      }],
      [],
      new Set(),
      new Date('2026-12-02T12:00:00.000Z'),
      'UTC'
    ).get(rhythmId);

    expect(selected?.kind).toBe('rhythm-score');
    if (selected?.kind !== 'rhythm-score') throw new Error('Expected the yearly Rhythm to be scored.');
    expect(selected.consistency).toMatchObject({ kind: 'scored', score: 0 });
    expect(selected.onTrack).toMatchObject({
      kind: 'scored',
      score: 0,
      evidence: {
        missedOccurrenceCount: 15,
        lastQualifyingCompletionDate: '2010-12-01'
      }
    });
    expect(selected.healthScore).toBe(0);
  });

  it('uses the single eligible Rhythm score directly', () => {
    const result = selectFoundationScore(
      'connection',
      [rhythm('rhythm-a', 'connection')],
      new Map([['rhythm-a', scored(80, 100)]]),
      []
    );

    expect(result).toMatchObject({
      eligibleRhythmIds: ['rhythm-a'],
      consistency: 80,
      onTrack: 100,
      health: 85
    });
  });

  it('averages Rhythms equally regardless of cadence and counts duplicate links once', () => {
    const result = selectFoundationScore(
      'connection',
      [
        rhythm('daily-rhythm', 'connection', ['connection'], 'Daily'),
        rhythm('quarterly-rhythm', 'connection', [], 'Quarterly')
      ],
      new Map([
        ['daily-rhythm', scored(80, 100)],
        ['quarterly-rhythm', scored(40, 60)]
      ]),
      []
    );

    expect(result.linkedRhythmIds).toEqual(['daily-rhythm', 'quarterly-rhythm']);
    expect(result).toMatchObject({
      eligibleRhythmIds: ['daily-rhythm', 'quarterly-rhythm'],
      consistency: 60,
      onTrack: 80,
      health: 65
    });
  });

  it('counts a shared Rhythm once within each linked Foundation', () => {
    const shared = rhythm('shared-rhythm', 'connection', ['communication', 'connection']);
    const scores = new Map([['shared-rhythm', scored(80, 100)]]);

    const connection = selectFoundationScore('connection', [shared], scores, []);
    const communication = selectFoundationScore('communication', [shared], scores, []);

    expect(connection.eligibleRhythmIds).toEqual(['shared-rhythm']);
    expect(communication.eligibleRhythmIds).toEqual(['shared-rhythm']);
    expect(connection.health).toBe(85);
    expect(communication.health).toBe(85);
  });

  it('keeps numeric zero distinct from empty and fully unscorable Foundations', () => {
    const zero = selectFoundationScore(
      'connection',
      [rhythm('zero-rhythm', 'connection')],
      new Map([['zero-rhythm', scored(0, 0)]]),
      []
    );
    const empty = selectFoundationScore('connection', [], new Map(), []);
    const unscored = selectFoundationScore(
      'connection',
      [rhythm('unscored-rhythm', 'connection')],
      new Map([['unscored-rhythm', {
        kind: 'unscored',
        asOfDate: '2026-10-27',
        timeZone: 'UTC',
        reason: unscoredMetric,
        consistency: unscoredMetric,
        onTrack: unscoredMetric,
        healthScore: null
      } satisfies RhythmScoreResult]]),
      []
    );

    expect(zero).toMatchObject({ consistency: 0, onTrack: 0, health: 0 });
    expect(empty).toMatchObject({ linkedRhythmIds: [], consistency: null, onTrack: null, health: null });
    expect(unscored).toMatchObject({
      eligibleRhythmIds: [],
      consistency: null,
      onTrack: null,
      health: null,
      excludedRhythms: [{ rhythmId: 'unscored-rhythm' }]
    });
  });

  it('excludes a Rhythm missing either component from both averages and retains its reason', () => {
    const partialScore: RhythmScoreResult = {
      ...scored(80, 100),
      consistency: {
        kind: 'scored',
        score: 80,
        exactPercent: 80,
        evidence: consistencyEvidence
      },
      onTrack: unscoredMetric
    };
    const result = selectFoundationScore(
      'connection',
      [rhythm('partial-rhythm', 'connection'), rhythm('eligible-rhythm', 'connection')],
      new Map([
        ['partial-rhythm', partialScore],
        ['eligible-rhythm', scored(40, 60)]
      ]),
      []
    );

    expect(result).toMatchObject({
      eligibleRhythmIds: ['eligible-rhythm'],
      consistency: 40,
      onTrack: 60,
      health: 45,
      excludedRhythms: [{ rhythmId: 'partial-rhythm', score: partialScore }]
    });
  });

  it('excludes archived Rhythms and reports linked IDs with unresolved score results', () => {
    const archivedRhythm = rhythm('archived-rhythm', 'connection');
    const result = selectFoundationScore(
      'connection',
      [archivedRhythm, rhythm('unresolved-rhythm', 'connection')],
      new Map(),
      ['archived-rhythm']
    );
    const restored = selectFoundationScore(
      'connection',
      [archivedRhythm],
      new Map([['archived-rhythm', scored(80, 100)]]),
      []
    );

    expect(result).toMatchObject({
      linkedRhythmIds: ['archived-rhythm', 'unresolved-rhythm'],
      activeLinkedRhythmIds: ['unresolved-rhythm'],
      archivedRhythmIds: ['archived-rhythm'],
      unresolvedRhythmIds: ['unresolved-rhythm'],
      eligibleRhythmIds: [],
      health: null
    });
    expect(restored).toMatchObject({
      eligibleRhythmIds: ['archived-rhythm'],
      archivedRhythmIds: [],
      health: 85
    });
  });

  it('averages unrounded metrics before applying the 75/25 blend', () => {
    const result = selectFoundationScore(
      'connection',
      [rhythm('fractional-a', 'connection'), rhythm('fractional-b', 'connection')],
      new Map([
        ['fractional-a', scored(80.4, 100)],
        ['fractional-b', scored(40.3, 60.2)]
      ]),
      []
    );

    expect(result.consistency).toBeCloseTo(60.35);
    expect(result.onTrack).toBe(80.1);
    expect(result.health).toBeCloseTo(65.2875);
  });

  it('reselects after association and Rhythm score inputs change', () => {
    const original = rhythm('editable-rhythm', 'connection');
    const before = selectFoundationScore(
      'connection',
      [original],
      new Map([['editable-rhythm', scored(80, 100)]]),
      []
    );
    const afterAssociation = selectFoundationScore(
      'connection',
      [{ ...original, primaryFoundationId: 'communication' }],
      new Map([['editable-rhythm', scored(90, 90)]]),
      []
    );
    const afterScoreUpdate = selectFoundationScore(
      'communication',
      [{ ...original, primaryFoundationId: 'communication' }],
      new Map([['editable-rhythm', scored(90, 90)]]),
      []
    );

    expect(before.health).toBe(85);
    expect(afterAssociation.health).toBeNull();
    expect(afterScoreUpdate.health).toBe(90);
  });
});
