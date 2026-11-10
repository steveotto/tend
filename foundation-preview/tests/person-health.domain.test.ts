import { describe, expect, it } from 'vitest';
import { selectCategoryScore } from '../src/domain/category-scoring.ts';
import { aggregateHealthMeasures } from '../src/domain/health-scoring.ts';
import {
  selectPersonHealth,
  selectPersonOverallHealth,
  selectPersonRhythmHealth
} from '../src/domain/person-health.ts';
import { marriageRhythms } from '../src/domain/preview-data.ts';
import type { RhythmPreview } from '../src/domain/preview-data.ts';
import type { RhythmScoreResult, RhythmScoreSelection } from '../src/domain/rhythm-scoring.ts';
import type { FoundationScoreSelection } from '../src/domain/foundation-scoring.ts';

function scoredRhythm(consistency: number, onTrack: number): RhythmScoreSelection {
  return {
    kind: 'rhythm-score',
    asOfDate: '2026-10-27',
    timeZone: 'UTC',
    trackingStartDate: '2026-10-01',
    consistency: {
      kind: 'scored',
      score: consistency,
      exactPercent: consistency,
      evidence: {
        frequency: 'daily',
        windowStartDate: '2026-10-01',
        windowEndDate: '2026-10-27',
        eligibleDueCount: 1,
        completedCount: 1,
        notCompletedCount: 0,
        limitedHistoryDays: null,
        todayIncluded: true,
        occurrences: []
      }
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

function foundationScore(
  foundationId: string,
  consistency: number | null,
  onTrack: number | null
): FoundationScoreSelection {
  return {
    foundationId,
    linkedRhythmIds: [],
    activeLinkedRhythmIds: [],
    eligibleRhythmIds: [],
    archivedRhythmIds: [],
    unresolvedRhythmIds: [],
    excludedRhythms: [],
    consistency,
    onTrack,
    health: consistency === null || onTrack === null ? null : consistency * 0.75 + onTrack * 0.25
  };
}

describe('person Health selectors', () => {
  it('uses the Faith rollup for identical eligible measures without rounding inputs', () => {
    const measures = [
      { id: 'rhythm-component', consistency: 80.4, onTrack: 100 },
      { id: 'connection-component', consistency: 40.2, onTrack: 60 }
    ];
    const person = selectPersonHealth(measures);
    const faith = selectCategoryScore(
      [{ id: 'practice-a' }, { id: 'practice-b' }],
      new Map([
        ['practice-a', foundationScore('practice-a', 80.4, 100)],
        ['practice-b', foundationScore('practice-b', 40.2, 60)]
      ])
    );

    expect(person.eligibleComponentIds).toEqual(['rhythm-component', 'connection-component']);
    expect(person.consistency).toBeCloseTo(60.3);
    expect(person.onTrack).toBe(80);
    expect(person.health).toBeCloseTo(65.225);
    expect(person.consistency).toBe(faith.consistency);
    expect(person.onTrack).toBe(faith.onTrack);
    expect(person.health).toBe(faith.health);
    expect(Math.round(person.consistency!)).toBe(60);
    expect(Math.round(person.health!)).toBe(65);
  });

  it('keeps valid zero distinct from empty and unavailable component sets', () => {
    expect(aggregateHealthMeasures([{ consistency: 0, onTrack: 0 }]))
      .toEqual({ consistency: 0, onTrack: 0, health: 0 });
    expect(selectPersonHealth([{ id: 'pending', consistency: null, onTrack: null }]))
      .toMatchObject({
        componentIds: ['pending'],
        eligibleComponentIds: [],
        excludedComponentIds: ['pending'],
        consistency: null,
        onTrack: null,
        health: null
      });
    expect(selectPersonHealth([])).toMatchObject({
      componentIds: [],
      consistency: null,
      onTrack: null,
      health: null
    });
  });

  it('aggregates only unique eligible person-associated Rhythms and reports exclusions', () => {
    const rhythmA: RhythmPreview = {
      ...marriageRhythms[0]!,
      id: 'person-health-rhythm-a',
      personIds: ['sample-person-avery']
    };
    const rhythmB: RhythmPreview = {
      ...rhythmA,
      id: 'person-health-rhythm-b'
    };
    const archived: RhythmPreview = {
      ...rhythmA,
      id: 'person-health-rhythm-archived'
    };
    const unrelated: RhythmPreview = {
      ...rhythmA,
      id: 'person-health-rhythm-unrelated',
      personIds: ['sample-person-morgan']
    };
    const rhythmScores = new Map<string, RhythmScoreResult>([
      [rhythmA.id, scoredRhythm(80.4, 100)],
      [rhythmB.id, scoredRhythm(40.2, 60)],
      [archived.id, scoredRhythm(100, 100)]
    ]);
    const result = selectPersonRhythmHealth(
      'sample-person-avery',
      [rhythmA, rhythmA, rhythmB, archived, unrelated],
      rhythmScores,
      new Set([archived.id])
    );

    expect(result.rhythmIds).toEqual([rhythmA.id, rhythmB.id, archived.id]);
    expect(result.activeRhythmIds).toEqual([rhythmA.id, rhythmB.id]);
    expect(result.eligibleRhythmIds).toEqual([rhythmA.id, rhythmB.id]);
    expect(result.archivedRhythmIds).toEqual([archived.id]);
    expect(result.consistency).toBeCloseTo(60.3);
    expect(result.onTrack).toBe(80);
    expect(result.health).toBeCloseTo(65.225);
  });

  it('excludes a Rhythm missing either measure and preserves genuine scored zero', () => {
    const zero: RhythmPreview = {
      ...marriageRhythms[0]!,
      id: 'person-health-rhythm-zero',
      personIds: ['sample-person-avery']
    };
    const unscored: RhythmPreview = {
      ...zero,
      id: 'person-health-rhythm-unscored'
    };
    const partialScore: RhythmScoreSelection = {
      ...scoredRhythm(30, 50),
      onTrack: {
        kind: 'unscored',
        reasonCode: 'history-unavailable',
        explanation: 'No eligible evidence.'
      }
    };
    const result = selectPersonRhythmHealth(
      'sample-person-avery',
      [zero, unscored, { ...zero, id: 'person-health-rhythm-missing' }],
      new Map<string, RhythmScoreResult>([
        [zero.id, scoredRhythm(0, 0)],
        [unscored.id, partialScore]
      ]),
      new Set()
    );

    expect(result.eligibleRhythmIds).toEqual([zero.id]);
    expect(result.excludedRhythmIds).toEqual([unscored.id]);
    expect(result.unresolvedRhythmIds).toEqual(['person-health-rhythm-missing']);
    expect(result).toMatchObject({ consistency: 0, onTrack: 0, health: 0 });
  });

  it('rolls up available components once and ignores missing measures instead of treating them as zero', () => {
    const result = selectPersonHealth([
      { id: 'rhythms', consistency: 70, onTrack: 90 },
      { id: 'connection', consistency: null, onTrack: null, scoringStatus: 'unavailable' },
      { id: 'prayer', consistency: null, onTrack: null, scoringStatus: 'unavailable' },
      { id: 'rhythms', consistency: 0, onTrack: 0 }
    ]);

    expect(result.componentIds).toEqual(['rhythms', 'connection', 'prayer']);
    expect(result.eligibleComponentIds).toEqual(['rhythms']);
    expect(result.excludedComponentIds).toEqual([]);
    expect(result.unscoredComponentIds).toEqual(['connection', 'prayer']);
    expect(result).toMatchObject({ consistency: 70, onTrack: 90, health: 75 });
  });

  it('uses the profile Overall Health selector for list scores, including zero and unavailable', () => {
    const rhythm: RhythmPreview = {
      ...marriageRhythms[0]!,
      id: 'person-health-rhythm-score-parity',
      personIds: ['sample-person-avery']
    };
    const scored = selectPersonRhythmHealth(
      'sample-person-avery',
      [rhythm],
      new Map([[rhythm.id, scoredRhythm(20, 80)]]),
      new Set()
    );
    const zero = selectPersonRhythmHealth(
      'sample-person-avery',
      [rhythm],
      new Map([[rhythm.id, scoredRhythm(0, 0)]]),
      new Set()
    );
    const unavailable = selectPersonRhythmHealth('sample-person-avery', [rhythm], new Map(), new Set());

    expect(selectPersonOverallHealth(scored).health).toBe(scored.health);
    expect(selectPersonOverallHealth(scored).health).toBe(35);
    expect(selectPersonOverallHealth(zero).health).toBe(0);
    expect(selectPersonOverallHealth(unavailable).health).toBeNull();
  });
});
