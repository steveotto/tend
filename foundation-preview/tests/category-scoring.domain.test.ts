import { describe, expect, it } from 'vitest';
import type { FoundationScoreSelection } from '../src/domain/foundation-scoring.ts';
import { selectFoundationScore } from '../src/domain/foundation-scoring.ts';
import { selectCategoryScore } from '../src/domain/category-scoring.ts';
import { faithPractices, marriageRhythms, parentingFoundations } from '../src/domain/preview-data.ts';
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

describe('selecting equal-weight Marriage Category scores', () => {
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
