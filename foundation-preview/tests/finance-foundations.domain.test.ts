import { describe, expect, it } from 'vitest';
import {
  FINANCE_DEBT_REDUCTION_ID,
  FINANCE_GENEROSITY_ID,
  FINANCE_INVESTING_FUTURE_ID,
  FINANCE_PLANNING_SPENDING_ID,
  FINANCE_SAVING_RESERVES_ID,
  financeFoundations,
  faithPractices,
  todayRhythms
} from '../src/domain/preview-data.ts';
import { selectCategoryHealthScore } from '../src/domain/category-scoring.ts';
import type { RhythmScoreSelection } from '../src/domain/rhythm-scoring.ts';
import { selectFoundationScore } from '../src/domain/foundation-scoring.ts';
import { saveFoundationRhythmAssociations } from '../src/domain/foundation-rhythm-associations.ts';
import type { SavedRhythm } from '../src/domain/rhythm-editor.ts';

function scored(consistency: number, onTrack: number): RhythmScoreSelection {
  return {
    kind: 'rhythm-score',
    asOfDate: '2026-10-21',
    timeZone: 'UTC',
    trackingStartDate: '2026-10-01',
    consistency: {
      kind: 'scored',
      score: consistency,
      exactPercent: consistency,
      evidence: {
        frequency: 'daily',
        windowStartDate: '2026-10-01',
        windowEndDate: '2026-10-21',
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
        lastQualifyingCompletionDate: '2026-10-21',
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

function savedRhythm(rhythm: typeof todayRhythms[number]): SavedRhythm {
  return {
    id: rhythm.id,
    title: rhythm.title,
    cadence: rhythm.cadence ?? 'Daily',
    timeLabel: rhythm.timeLabel ?? 'Anytime',
    personIds: [...(rhythm.personIds ?? [])],
    categoryIds: [...(rhythm.categoryIds ?? [])],
    ...(rhythm.primaryFoundationId === undefined
      ? {}
      : { primaryFoundationId: rhythm.primaryFoundationId }),
    ...(rhythm.secondaryFoundationIds === undefined
      ? {}
      : { secondaryFoundationIds: [...rhythm.secondaryFoundationIds] })
  };
}

describe('Finance Foundations', () => {
  it('defines the five stable Foundations and their approved descriptions', () => {
    expect(financeFoundations.map(({ id, name, description }) => ({ id, name, description }))).toEqual([
      {
        id: FINANCE_PLANNING_SPENDING_ID,
        name: 'Planning & Spending',
        description: 'Give your money direction and spend intentionally.'
      },
      {
        id: FINANCE_SAVING_RESERVES_ID,
        name: 'Saving & Reserves',
        description: 'Build a cushion and prepare for future needs.'
      },
      {
        id: FINANCE_DEBT_REDUCTION_ID,
        name: 'Debt Reduction',
        description: 'Make steady progress toward reducing debt.'
      },
      {
        id: FINANCE_INVESTING_FUTURE_ID,
        name: 'Investing & Future',
        description: 'Give your longer-term financial plans regular attention.'
      },
      {
        id: FINANCE_GENEROSITY_ID,
        name: 'Generosity',
        description: 'Make financial giving intentional.'
      }
    ]);
  });

  it('averages scored Foundation Health while preserving zero and excluding archived or unscored Rhythms', () => {
    const zeroRhythm = {
      ...todayRhythms[0]!,
      id: 'finance-zero-rhythm',
      categoryIds: ['finances'] as const,
      primaryFoundationId: FINANCE_SAVING_RESERVES_ID,
      secondaryFoundationIds: []
    };
    const archivedRhythm = {
      ...todayRhythms[0]!,
      id: 'finance-archived-rhythm',
      categoryIds: ['finances'] as const,
      primaryFoundationId: FINANCE_DEBT_REDUCTION_ID,
      secondaryFoundationIds: []
    };
    const unscoredRhythm = {
      ...todayRhythms[0]!,
      id: 'finance-unscored-rhythm',
      categoryIds: ['finances'] as const,
      primaryFoundationId: FINANCE_PLANNING_SPENDING_ID,
      secondaryFoundationIds: []
    };
    const result = selectCategoryHealthScore(
      financeFoundations,
      [zeroRhythm, archivedRhythm, unscoredRhythm],
      new Map([
        [zeroRhythm.id, scored(0, 0)],
        [archivedRhythm.id, scored(100, 100)]
      ]),
      [archivedRhythm.id]
    );

    expect(result).toMatchObject({
      eligibleFoundationIds: [FINANCE_SAVING_RESERVES_ID],
      health: 0,
      consistency: 0,
      onTrack: 0
    });
    expect(result.excludedFoundationIds).toContain(FINANCE_DEBT_REDUCTION_ID);
    expect(result.excludedFoundationIds).toContain(FINANCE_PLANNING_SPENDING_ID);
  });

  it('allows one Rhythm and completion to support Faith and Finance Generosity independently', () => {
    const faithGenerosity = faithPractices.find(practice => practice.name === 'Generosity')!;
    const rhythm = {
      ...todayRhythms[0]!,
      id: 'shared-generosity-rhythm',
      title: 'Plan intentional giving',
      categoryIds: ['faith', 'finances'] as const,
      primaryFoundationId: faithGenerosity.id,
      secondaryFoundationIds: [],
      completionHistory: [{ id: 'one-generosity-completion', effectiveDate: '2026-10-21' }]
    };
    const original = savedRhythm(rhythm);
    const linked = saveFoundationRhythmAssociations(
      [original],
      [rhythm],
      [],
      FINANCE_GENEROSITY_ID,
      [{ rhythmId: rhythm.id, linked: true }]
    );

    expect('error' in linked).toBe(false);
    if ('error' in linked) return;
    expect(linked.savedRhythms).toHaveLength(1);
    const shared = { ...rhythm, ...linked.savedRhythms[0]! };
    expect(shared.completionHistory).toEqual([
      { id: 'one-generosity-completion', effectiveDate: '2026-10-21' }
    ]);
    const scores = new Map([[rhythm.id, scored(60, 80)]]);
    const faith = selectFoundationScore(faithGenerosity.id, [shared], scores, []);
    const finance = selectFoundationScore(FINANCE_GENEROSITY_ID, [shared], scores, []);
    expect(faith.eligibleRhythmIds).toEqual([rhythm.id]);
    expect(finance.eligibleRhythmIds).toEqual([rhythm.id]);
    expect(faith.health).toBe(65);
    expect(finance.health).toBe(65);
    expect(shared.completionHistory).toHaveLength(1);
  });
});
