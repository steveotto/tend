import { describe, expect, it } from 'vitest';
import type { FoundationScoreSelection } from '../src/domain/foundation-scoring.ts';
import { selectFoundationScore } from '../src/domain/foundation-scoring.ts';
import {
  aggregateCategoryHealthScores,
  selectCardioCategoryScore,
  selectCategoryHealthScore,
  selectCategoryScore,
  selectFoundationCategoryScore,
  selectHealthFitnessCategoryScore,
  selectStrengthCategoryScore,
  selectUnlinkedFlexibilityRhythms,
  selectWeightCategoryScore
} from '../src/domain/category-scoring.ts';
import { createCardioData, selectCardioProgress } from '../src/domain/cardio.ts';
import { selectRhythmScore } from '../src/domain/rhythm-scoring.ts';
import {
  faithPractices,
  marriageRhythms,
  parentingFoundations,
  todayRhythms,
  type RhythmPreview
} from '../src/domain/preview-data.ts';
import type { RhythmScoreSelection } from '../src/domain/rhythm-scoring.ts';

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
    health: consistency === null || onTrack === null
      ? null
      : consistency * 0.75 + onTrack * 0.25
  };
}

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

function weightRhythm(id: string, overrides: Partial<RhythmPreview> = {}): RhythmPreview {
  return {
    ...todayRhythms[0]!,
    id,
    categoryIds: ['health'] as const,
    primaryFoundationId: 'health-weight',
    secondaryFoundationIds: [],
    healthLogCapability: 'weight' as const,
    ...overrides
  };
}

function strengthRhythm(id: string, overrides: Partial<RhythmPreview> = {}): RhythmPreview {
  return {
    ...todayRhythms[0]!,
    id,
    categoryIds: ['health'] as const,
    primaryFoundationId: 'health-strength',
    secondaryFoundationIds: [],
    ...overrides
  };
}

describe('selecting equal-weight Marriage Category scores', () => {
  it('uses the existing Cardio measures independently and keeps valid zero available', () => {
    const data = {
      ...createCardioData(),
      goals: { weeklyRunTarget: 2, weeklyMileTarget: 8 },
      trackingStartDate: '2026-09-01',
      targetHistory: [{ effectiveDate: '2026-09-01', weeklyRunTarget: 2, weeklyMileTarget: 8 }],
      runs: []
    };
    const score = selectCardioCategoryScore(selectCardioProgress(data, '2026-10-22'));

    expect(score).toMatchObject({
      foundationIds: ['health-cardio'],
      eligibleFoundationIds: ['health-cardio'],
      consistency: 0,
      onTrack: 0,
      health: 0
    });

    const partial = selectCardioCategoryScore(selectCardioProgress({
      ...createCardioData(),
      goals: { weeklyRunTarget: 2, weeklyMileTarget: 8 },
      runs: []
    }, '2026-10-22'));
    expect(partial).toMatchObject({
      eligibleFoundationIds: [],
      consistency: null,
      onTrack: 0,
      health: null
    });
  });

  it('scores Weight-linked Rhythm measures independently and averages only available values', () => {
    const first = weightRhythm('weight-daily');
    const second = weightRhythm('weight-weekly', {
      healthLogCapability: 'weight',
      primaryFoundationId: 'health-weight'
    });
    const partial = {
      ...scoredRhythm(40, 100),
      onTrack: {
        kind: 'unscored' as const,
        reasonCode: 'no-eligible-occurrences' as const,
        explanation: 'No scheduled opportunity is available.'
      }
    };
    const score = selectWeightCategoryScore(
      [first, second],
      new Map([
        [first.id, scoredRhythm(80, 60)],
        [second.id, partial]
      ]),
      []
    );

    expect(score).toMatchObject({
      foundationIds: ['health-weight'],
      eligibleFoundationIds: ['health-weight'],
      consistency: 60,
      onTrack: 60,
      health: 60
    });

    expect(selectWeightCategoryScore([second], new Map([[second.id, partial]]), []))
      .toMatchObject({
        eligibleFoundationIds: [],
        consistency: 40,
        onTrack: null,
        health: null
      });
  });

  it('keeps Weight zero valid and excludes unlinked, non-Weight, and archived Rhythms', () => {
    const zero = weightRhythm('weight-zero');
    const unlinked = weightRhythm('weight-unlinked', { primaryFoundationId: null });
    const cardio = weightRhythm('cardio-capability', { healthLogCapability: 'cardio' });
    const archived = weightRhythm('weight-archived');
    const result = selectWeightCategoryScore(
      [zero, unlinked, cardio, archived],
      new Map([
        [zero.id, scoredRhythm(0, 0)],
        [unlinked.id, scoredRhythm(100, 100)],
        [cardio.id, scoredRhythm(100, 100)],
        [archived.id, scoredRhythm(100, 100)]
      ]),
      [archived.id]
    );

    expect(result).toMatchObject({
      eligibleFoundationIds: ['health-weight'],
      consistency: 0,
      onTrack: 0,
      health: 0
    });
  });

  it('uses the existing scheduled Rhythm scores after missed Weight check-ins', () => {
    const rhythm = weightRhythm('weight-missed-checkins', {
      cadence: 'Daily',
      schedule: { frequency: 'daily' },
      createdLocalDate: '2026-09-01',
      createdTimeZone: 'UTC'
    });
    const rhythmScore = selectRhythmScore({
      rhythmId: rhythm.id,
      cadence: 'Daily',
      schedule: { frequency: 'daily' },
      createdLocalDate: '2026-09-01',
      createdTimeZone: 'UTC',
      records: [{
        id: 'one-scheduled-weigh-in',
        rhythmId: rhythm.id,
        effectiveDate: '2026-09-01'
      }],
      recordsAvailable: true,
      asOfDate: '2026-10-22',
      timeZone: 'UTC'
    });
    expect(rhythmScore.kind).toBe('rhythm-score');
    if (rhythmScore.kind !== 'rhythm-score') return;
    expect(rhythmScore.consistency.kind).toBe('scored');
    expect(rhythmScore.onTrack.kind).toBe('scored');
    if (rhythmScore.consistency.kind !== 'scored' || rhythmScore.onTrack.kind !== 'scored') return;
    expect(rhythmScore.consistency.score).toBeLessThan(100);
    expect(rhythmScore.onTrack.score).toBeLessThan(100);

    const health = selectWeightCategoryScore(
      [rhythm],
      new Map([[rhythm.id, rhythmScore]]),
      []
    );
    expect(health.consistency).toBe(rhythmScore.consistency.score);
    expect(health.onTrack).toBe(rhythmScore.onTrack.score);
    expect(health.health).toBeCloseTo(
      rhythmScore.consistency.score * 0.75 + rhythmScore.onTrack.score * 0.25
    );
  });

  it('uses existing Foundation aggregation for completed, missed, and multiply linked Strength Rhythms', () => {
    const completed = strengthRhythm('strength-completed', {
      cadence: 'Daily',
      schedule: { frequency: 'daily' },
      createdLocalDate: '2026-10-20',
      createdTimeZone: 'UTC'
    });
    const missed = strengthRhythm('strength-missed', {
      cadence: 'Daily',
      schedule: { frequency: 'daily' },
      createdLocalDate: '2026-10-20',
      createdTimeZone: 'UTC',
      primaryFoundationId: null,
      secondaryFoundationIds: ['health-strength']
    });
    const unlinked = strengthRhythm('strength-unlinked', {
      primaryFoundationId: null,
      secondaryFoundationIds: []
    });
    const completedScore = selectRhythmScore({
      rhythmId: completed.id,
      cadence: completed.cadence!,
      schedule: completed.schedule!,
      createdLocalDate: completed.createdLocalDate!,
      createdTimeZone: completed.createdTimeZone!,
      records: ['2026-10-20', '2026-10-21', '2026-10-22'].map((effectiveDate, index) => ({
        id: `strength-completion-${index}`,
        rhythmId: completed.id,
        effectiveDate
      })),
      recordsAvailable: true,
      asOfDate: '2026-10-22',
      timeZone: 'UTC'
    });
    const missedScore = selectRhythmScore({
      rhythmId: missed.id,
      cadence: missed.cadence!,
      schedule: missed.schedule!,
      createdLocalDate: missed.createdLocalDate!,
      createdTimeZone: missed.createdTimeZone!,
      records: [],
      recordsAvailable: true,
      asOfDate: '2026-10-22',
      timeZone: 'UTC'
    });
    expect(completedScore.kind).toBe('rhythm-score');
    expect(missedScore.kind).toBe('rhythm-score');
    if (completedScore.kind !== 'rhythm-score' || missedScore.kind !== 'rhythm-score') return;
    expect(completedScore.consistency.kind).toBe('scored');
    expect(missedScore.consistency.kind).toBe('scored');
    if (completedScore.consistency.kind !== 'scored' || missedScore.consistency.kind !== 'scored') return;
    expect(completedScore.consistency.score).toBeGreaterThan(missedScore.consistency.score);

    const health = selectStrengthCategoryScore(
      [completed, missed, completed, unlinked],
      new Map([
        [completed.id, completedScore],
        [missed.id, missedScore],
        [unlinked.id, scoredRhythm(100, 100)]
      ]),
      []
    );
    expect(health.foundationIds).toEqual(['health-strength']);
    expect(health.eligibleFoundationIds).toEqual(['health-strength']);
    expect(health.consistency).toBeCloseTo(
      ((completedScore.consistency.kind === 'scored' ? completedScore.consistency.score : 0)
        + (missedScore.consistency.kind === 'scored' ? missedScore.consistency.score : 0)) / 2
    );
    expect(health.health).toBe(health.consistency! * 0.75 + health.onTrack! * 0.25);
  });

  it('preserves Strength zero scores, excludes archived Rhythms, and leaves unresolved scores unavailable', () => {
    const zero = strengthRhythm('strength-zero');
    const unresolved = strengthRhythm('strength-unresolved');
    const archived = strengthRhythm('strength-archived');
    const score = selectStrengthCategoryScore(
      [zero, unresolved, archived],
      new Map([
        [zero.id, scoredRhythm(0, 0)],
        [archived.id, scoredRhythm(100, 100)]
      ]),
      [archived.id]
    );

    expect(score).toMatchObject({
      eligibleFoundationIds: ['health-strength'],
      consistency: 0,
      onTrack: 0,
      health: 0
    });

    expect(selectStrengthCategoryScore([unresolved], new Map(), [])).toMatchObject({
      eligibleFoundationIds: [],
      excludedFoundationIds: ['health-strength'],
      consistency: null,
      onTrack: null,
      health: null
    });
    expect(selectStrengthCategoryScore([], new Map(), []).health).toBeNull();
  });

  it('averages Strength, Cardio, and Weight at the measure level and blends once', () => {
    const completeRollup = selectHealthFitnessCategoryScore({
      foundationIds: ['health-cardio'],
      eligibleFoundationIds: ['health-cardio'],
      excludedFoundationIds: [],
      unresolvedFoundationIds: [],
      consistency: 100,
      onTrack: 60,
      health: 90
    }, {
      foundationIds: ['health-weight'],
      eligibleFoundationIds: ['health-weight'],
      excludedFoundationIds: [],
      unresolvedFoundationIds: [],
      consistency: 60,
      onTrack: 100,
      health: 70
    }, {
      foundationIds: ['health-strength'],
      eligibleFoundationIds: ['health-strength'],
      excludedFoundationIds: [],
      unresolvedFoundationIds: [],
      consistency: 0,
      onTrack: 80,
      health: 20
    });

    expect(completeRollup).toMatchObject({
      consistency: 160 / 3,
      onTrack: 80,
      health: 60
    });

    const cardio = {
      foundationIds: ['health-cardio'],
      eligibleFoundationIds: [],
      excludedFoundationIds: [],
      unresolvedFoundationIds: [],
      consistency: 80,
      onTrack: null,
      health: null
    };
    const weight = {
      foundationIds: ['health-weight'],
      eligibleFoundationIds: [],
      excludedFoundationIds: [],
      unresolvedFoundationIds: [],
      consistency: null,
      onTrack: 40,
      health: null
    };

    const unavailableStrength = {
      foundationIds: ['health-strength'],
      eligibleFoundationIds: [],
      excludedFoundationIds: [],
      unresolvedFoundationIds: [],
      consistency: null,
      onTrack: null,
      health: null
    };
    expect(selectHealthFitnessCategoryScore(cardio, weight, unavailableStrength)).toEqual({
      foundationIds: ['consistency', 'on-track'],
      eligibleFoundationIds: ['consistency', 'on-track'],
      excludedFoundationIds: [],
      unresolvedFoundationIds: [],
      consistency: 80,
      onTrack: 40,
      health: 70
    });
    expect(selectHealthFitnessCategoryScore({
      ...cardio,
      consistency: 0,
      onTrack: 0
    }, weight, unavailableStrength)).toMatchObject({
      consistency: 0,
      onTrack: 20,
      health: 5
    });
  });

  it('scores Flexibility from linked stretch Rhythms and identifies unlinked ones without changing links', () => {
    const linked = weightRhythm('stretch-linked', {
      healthLogCapability: 'flexibility',
      primaryFoundationId: 'health-flexibility'
    });
    const linkedSecondarily = weightRhythm('stretch-secondary', {
      healthLogCapability: 'flexibility',
      primaryFoundationId: null,
      secondaryFoundationIds: ['health-flexibility']
    });
    const unlinked = weightRhythm('stretch-unlinked', {
      healthLogCapability: 'flexibility',
      primaryFoundationId: null,
      secondaryFoundationIds: []
    });
    const nonStretch = weightRhythm('weight-unlinked', {
      primaryFoundationId: null
    });
    const scores = new Map([
      [linked.id, scoredRhythm(80, 60)],
      [linkedSecondarily.id, scoredRhythm(40, 100)],
      [unlinked.id, scoredRhythm(0, 0)],
      [nonStretch.id, scoredRhythm(100, 100)]
    ]);

    expect(selectFoundationCategoryScore(
      'health-flexibility',
      [linked, linkedSecondarily, unlinked, nonStretch],
      scores,
      []
    )).toMatchObject({
      eligibleFoundationIds: ['health-flexibility'],
      consistency: 60,
      onTrack: 80,
      health: 65
    });
    expect(selectUnlinkedFlexibilityRhythms([
      linked,
      linkedSecondarily,
      unlinked,
      nonStretch
    ])).toEqual([unlinked]);
    expect(unlinked.primaryFoundationId).toBeNull();
    expect(unlinked.secondaryFoundationIds).toEqual([]);
  });

  it('averages available Category Health values without rounding intermediate scores', () => {
    const result = aggregateCategoryHealthScores([100, 13, 13, null, null, null]);

    expect(result).toEqual({
      health: 42,
      scoredCategoryCount: 3,
      categoryCount: 6
    });

  });

  it('includes Flexibility equally in both Health & Fitness measure averages', () => {
    const cardio = {
      foundationIds: ['health-cardio'],
      eligibleFoundationIds: ['health-cardio'],
      excludedFoundationIds: [],
      unresolvedFoundationIds: [],
      consistency: 80,
      onTrack: 40,
      health: 70
    };
    const unavailable = {
      foundationIds: [],
      eligibleFoundationIds: [],
      excludedFoundationIds: [],
      unresolvedFoundationIds: [],
      consistency: null,
      onTrack: null,
      health: null
    };
    const flexibility = {
      foundationIds: ['health-flexibility'],
      eligibleFoundationIds: ['health-flexibility'],
      excludedFoundationIds: [],
      unresolvedFoundationIds: [],
      consistency: 100,
      onTrack: 100,
      health: 100
    };

    expect(selectHealthFitnessCategoryScore(cardio, unavailable, unavailable, flexibility))
      .toMatchObject({
        consistency: 90,
        onTrack: 70,
        health: 85
      });
    expect(selectHealthFitnessCategoryScore({
      ...cardio,
      consistency: null,
      onTrack: null,
      health: null
    }, unavailable, unavailable, {
      ...flexibility,
      consistency: 0,
      onTrack: 0,
      health: 0
    })).toMatchObject({
      consistency: 0,
      onTrack: 0,
      health: 0
    });
  });

  it('includes a valid zero Category Health value', () => {
    const result = aggregateCategoryHealthScores([0, null, null, null, null, null]);

    expect(result).toEqual({
      health: 0,
      scoredCategoryCount: 1,
      categoryCount: 6
    });
  });

  it('returns an unavailable score and zero coverage when all Categories are unavailable', () => {
    const result = aggregateCategoryHealthScores([null, null, null, null, null, null]);

    expect(result).toEqual({
      health: null,
      scoredCategoryCount: 0,
      categoryCount: 6
    });
  });

  it('keeps fractional Category scores unrounded until display', () => {
    const result = aggregateCategoryHealthScores([100, 13, 12, null, null, null]);

    expect(result.health).toBeCloseTo(41.6666667);
    expect(Math.round(result.health!)).toBe(42);
  });

  it('uses the account selectors for Today and preserves a valid zero score', () => {
    const foundation = parentingFoundations[0]!;
    const rhythm = {
      ...marriageRhythms[0]!,
      id: 'account-derived-zero-rhythm',
      categoryIds: ['parenting'] as const,
      primaryFoundationId: foundation.id,
      secondaryFoundationIds: []
    };
    const result = selectCategoryHealthScore(
      [foundation],
      [rhythm],
      new Map([[rhythm.id, scoredRhythm(0, 0)]]),
      []
    );

    expect(result.eligibleFoundationIds).toEqual([foundation.id]);
    expect(result).toMatchObject({ consistency: 0, onTrack: 0, health: 0 });
  });

  it('extends the shared equal-weight selectors to Faith Practices without a breadth penalty', () => {
    const firstRhythm = {
      ...marriageRhythms[0]!,
      id: 'faith-scored-rhythm-1',
      categoryIds: ['faith'] as const,
      primaryFoundationId: faithPractices[1]!.id,
      secondaryFoundationIds: []
    };
    const secondRhythm = {
      ...marriageRhythms[0]!,
      id: 'faith-scored-rhythm-2',
      categoryIds: ['faith'] as const,
      primaryFoundationId: faithPractices[8]!.id,
      secondaryFoundationIds: []
    };
    const rhythmScores = new Map([
      [firstRhythm.id, scoredRhythm(80, 100)],
      [secondRhythm.id, scoredRhythm(60, 60)]
    ]);
    const foundationScores = new Map(faithPractices.map(practice => [
      practice.id,
      selectFoundationScore(practice.id, [firstRhythm, secondRhythm], rhythmScores, [])
    ]));
    const result = selectCategoryScore(faithPractices, foundationScores);

    expect(result.foundationIds).toHaveLength(9);
    expect(result.eligibleFoundationIds).toEqual([faithPractices[1]!.id, faithPractices[8]!.id]);
    expect(result.consistency).toBe(70);
    expect(result.onTrack).toBe(80);
    expect(result.health).toBe(72.5);
    expect(result.excludedFoundationIds).toHaveLength(7);
  });

  it('keeps Faith zero distinct from unscored and archived Practice data', () => {
    const scored = {
      ...marriageRhythms[0]!,
      id: 'faith-zero-rhythm',
      categoryIds: ['faith'] as const,
      primaryFoundationId: faithPractices[0]!.id,
      secondaryFoundationIds: []
    };
    const archived = {
      ...marriageRhythms[0]!,
      id: 'faith-archived-rhythm',
      categoryIds: ['faith'] as const,
      primaryFoundationId: faithPractices[1]!.id,
      secondaryFoundationIds: []
    };
    const score = selectFoundationScore(
      faithPractices[0]!.id,
      [scored],
      new Map([[scored.id, scoredRhythm(0, 0)]]),
      []
    );
    const archivedScore = selectFoundationScore(
      faithPractices[1]!.id,
      [archived],
      new Map([[archived.id, scoredRhythm(100, 100)]]),
      [archived.id]
    );
    const category = selectCategoryScore(
      faithPractices,
      new Map(faithPractices.map(practice => [
        practice.id,
        practice.id === faithPractices[0]!.id
          ? score
          : practice.id === faithPractices[1]!.id
            ? archivedScore
            : selectFoundationScore(practice.id, [], new Map(), [])
      ]))
    );

    expect(score).toMatchObject({ consistency: 0, onTrack: 0, health: 0 });
    expect(archivedScore).toMatchObject({ consistency: null, onTrack: null, health: null });
    expect(category).toMatchObject({ consistency: 0, onTrack: 0, health: 0 });
    expect(category.eligibleFoundationIds).toEqual([faithPractices[0]!.id]);
    expect(category.excludedFoundationIds).toContain(faithPractices[1]!.id);
  });

  it('uses the same equal-weight scoring for Parenting Foundations with an explicit numeric example', () => {
    const firstRhythm = {
      ...marriageRhythms[0]!,
      id: 'parenting-scored-rhythm-1',
      primaryFoundationId: parentingFoundations[0]!.id,
      secondaryFoundationIds: []
    };
    const secondRhythm = {
      ...marriageRhythms[0]!,
      id: 'parenting-scored-rhythm-2',
      primaryFoundationId: parentingFoundations[1]!.id,
      secondaryFoundationIds: []
    };
    const rhythmScores = new Map([
      [firstRhythm.id, scoredRhythm(80, 100)],
      [secondRhythm.id, scoredRhythm(60, 60)]
    ]);
    const foundationScores = new Map(parentingFoundations.map(foundation => [
      foundation.id,
      selectFoundationScore(
        foundation.id,
        [firstRhythm, secondRhythm],
        rhythmScores,
        []
      )
    ]));
    const result = selectCategoryScore(parentingFoundations, foundationScores);

    expect(result.eligibleFoundationIds).toEqual([
      parentingFoundations[0]!.id,
      parentingFoundations[1]!.id
    ]);
    expect(result.consistency).toBe(70);
    expect(result.onTrack).toBe(80);
    expect(result.health).toBe(72.5);
  });

  it('uses the single eligible Foundation directly', () => {
    const result = selectCategoryScore(
      [{ id: 'connection' }, { id: 'partnership' }],
      new Map([
        ['connection', foundationScore('connection', 80, 100)],
        ['partnership', foundationScore('partnership', null, null)]
      ])
    );

    expect(result).toMatchObject({
      foundationIds: ['connection', 'partnership'],
      eligibleFoundationIds: ['connection'],
      excludedFoundationIds: ['partnership'],
      unresolvedFoundationIds: [],
      consistency: 80,
      onTrack: 100,
      health: 85
    });
  });

  it('averages Foundations equally and blends their unrounded averages', () => {
    const result = selectCategoryScore(
      [{ id: 'foundation-a' }, { id: 'foundation-b' }],
      new Map([
        ['foundation-a', foundationScore('foundation-a', 80, 100)],
        ['foundation-b', foundationScore('foundation-b', 40, 60)]
      ])
    );

    expect(result.consistency).toBe(60);
    expect(result.onTrack).toBe(80);
    expect(result.health).toBe(65);
  });

  it('reports partial coverage and excludes Foundations missing either measure', () => {
    const result = selectCategoryScore(
      Array.from({ length: 6 }, (_, index) => ({ id: `foundation-${index + 1}` })),
      new Map([
        ['foundation-1', foundationScore('foundation-1', 80, 100)],
        ['foundation-2', foundationScore('foundation-2', 40, null)],
        ['foundation-3', foundationScore('foundation-3', null, 60)]
      ])
    );

    expect(result.foundationIds).toHaveLength(6);
    expect(result.eligibleFoundationIds).toEqual(['foundation-1']);
    expect(result.excludedFoundationIds).toEqual(['foundation-2', 'foundation-3']);
    expect(result.unresolvedFoundationIds).toEqual(['foundation-4', 'foundation-5', 'foundation-6']);
    expect(result.consistency).toBe(80);
    expect(result.onTrack).toBe(100);
    expect(result.health).toBe(85);
  });

  it('keeps a genuine zero separate from unavailable Category values', () => {
    const zero = selectCategoryScore(
      [{ id: 'zero-foundation' }],
      new Map([['zero-foundation', foundationScore('zero-foundation', 0, 0)]])
    );
    const unavailable = selectCategoryScore(
      [{ id: 'unavailable-foundation' }],
      new Map([['unavailable-foundation', foundationScore('unavailable-foundation', null, null)]])
    );
    const empty = selectCategoryScore([], new Map());

    expect(zero).toMatchObject({ consistency: 0, onTrack: 0, health: 0 });
    expect(unavailable).toMatchObject({ consistency: null, onTrack: null, health: null });
    expect(empty).toMatchObject({ consistency: null, onTrack: null, health: null });
  });

  it('counts duplicate Foundation IDs once', () => {
    const result = selectCategoryScore(
      [{ id: 'connection' }, { id: 'connection' }],
      new Map([['connection', foundationScore('connection', 80, 100)]])
    );

    expect(result.foundationIds).toEqual(['connection']);
    expect(result.eligibleFoundationIds).toEqual(['connection']);
    expect(result.health).toBe(85);
  });

  it('counts a shared Rhythm once within each linked Foundation, then each Foundation once', () => {
    const sharedRhythm = {
      ...marriageRhythms[0]!,
      id: 'shared-foundation-rhythm',
      primaryFoundationId: 'connection',
      secondaryFoundationIds: ['communication', 'connection']
    };
    const rhythmScores = new Map([['shared-foundation-rhythm', scoredRhythm(80, 100)]]);
    const connection = selectFoundationScore('connection', [sharedRhythm], rhythmScores, []);
    const communication = selectFoundationScore('communication', [sharedRhythm], rhythmScores, []);
    const result = selectCategoryScore(
      [{ id: 'connection' }, { id: 'communication' }],
      new Map([
        ['connection', connection],
        ['communication', communication]
      ])
    );

    expect(connection.eligibleRhythmIds).toEqual(['shared-foundation-rhythm']);
    expect(communication.eligibleRhythmIds).toEqual(['shared-foundation-rhythm']);
    expect(result.eligibleFoundationIds).toEqual(['connection', 'communication']);
    expect(result.health).toBe(85);
  });

  it('preserves fractional values for calculations and leaves rounding to presentation', () => {
    const result = selectCategoryScore(
      [{ id: 'foundation-a' }, { id: 'foundation-b' }],
      new Map([
        ['foundation-a', foundationScore('foundation-a', 80.4, 100)],
        ['foundation-b', foundationScore('foundation-b', 40.2, 60)]
      ])
    );

    expect(result.consistency).toBeCloseTo(60.3);
    expect(result.onTrack).toBe(80);
    expect(result.health).toBeCloseTo(65.225);
    expect(result.consistency === null ? null : Math.round(result.consistency)).toBe(60);
    expect(result.onTrack === null ? null : Math.round(result.onTrack)).toBe(80);
    expect(result.health === null ? null : Math.round(result.health)).toBe(65);
  });

  it('recomputes when Foundation scores change after association or history updates', () => {
    const foundations = [{ id: 'connection' }, { id: 'communication' }];
    const before = selectCategoryScore(
      foundations,
      new Map([
        ['connection', foundationScore('connection', 80, 100)],
        ['communication', foundationScore('communication', null, null)]
      ])
    );
    const afterHistory = selectCategoryScore(
      foundations,
      new Map([
        ['connection', foundationScore('connection', 77, 99)],
        ['communication', foundationScore('communication', null, null)]
      ])
    );
    const afterAssociation = selectCategoryScore(
      foundations,
      new Map([
        ['connection', foundationScore('connection', 77, 99)],
        ['communication', foundationScore('communication', 77, 99)]
      ])
    );

    expect(before).toMatchObject({ eligibleFoundationIds: ['connection'], health: 85 });
    expect(afterHistory.health).toBe(82.5);
    expect(afterAssociation).toMatchObject({
      eligibleFoundationIds: ['connection', 'communication'],
      consistency: 77,
      onTrack: 99,
      health: 82.5
    });
  });
});
