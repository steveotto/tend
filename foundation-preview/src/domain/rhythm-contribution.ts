import {
  aggregateCategoryHealthScores,
  selectStrengthCategoryScore,
  selectWeightCategoryScore
} from './category-scoring.ts';
import { foundationRhythmIds } from './foundation-rhythm-associations.ts';
import { selectFoundationScore } from './foundation-scoring.ts';
import {
  areas,
  type CategoryId,
  type FoundationPreview,
  type RhythmPreview
} from './preview-data.ts';
import type { RhythmScoreResult } from './rhythm-scoring.ts';

export type RhythmContributionItem = {
  id: string;
  label: string;
  score: number | null;
  categoryId?: string;
  categoryLabel?: string;
  categoryIconId?: CategoryId;
  foundationIconId?: string;
  showScore?: boolean;
};

export type HealthInfoIdentity = {
  name: string;
  secondary?: string;
  icon:
    | { kind: 'category'; id: CategoryId }
    | { kind: 'foundation'; id: string }
    | { kind: 'rhythm' };
};

export type HealthContributionScoringInfo = {
  groupId: 'categories' | 'foundations' | 'rhythm';
  triggerLabel: string;
  title: string;
  coverage?: string;
  paragraphs?: readonly string[];
};

export type HealthContributionDiagram = {
  heading: string;
  highlightedGroup: 'overall' | 'categories' | 'foundations' | 'rhythm';
  highlightedItemId: string;
  overallScore: number | null;
  categories: readonly RhythmContributionItem[];
  foundations: readonly RhythmContributionItem[];
  bottomGroupLabel: string;
  bottomItem: RhythmContributionItem & { showScore?: boolean };
  identity: HealthInfoIdentity;
  scoringInfo?: HealthContributionScoringInfo;
};

export type RhythmContributionSelection = {
  overallScore: number | null;
  categories: readonly RhythmContributionItem[];
  foundations: readonly RhythmContributionItem[];
  rhythm: RhythmContributionItem;
  unresolvedFoundationIds: readonly string[];
};

const rhythmScoredCategoryIds = new Set<string>(['faith', 'marriage', 'parenting', 'health']);

export function selectRhythmContribution(input: {
  rhythm: RhythmPreview;
  foundations: readonly FoundationPreview[];
  relatedRhythms: readonly RhythmPreview[];
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>;
  archivedRhythmIds: readonly string[];
  categoryHealthScores: ReadonlyMap<string, number | null>;
  rhythmHealthScore: number | null;
}): RhythmContributionSelection {
  const foundationIds = foundationRhythmIds(input.rhythm);
  const foundationById = new Map(input.foundations.map(foundation => [foundation.id, foundation]));
  const linkedRhythms = [
    input.rhythm,
    ...input.relatedRhythms.filter(rhythm => rhythm.id !== input.rhythm.id)
  ];
  const healthRhythms = linkedRhythms.filter(rhythm => rhythm.categoryIds?.includes('health'));
  const strengthScore = selectStrengthCategoryScore(
    healthRhythms,
    input.rhythmScores,
    input.archivedRhythmIds
  );
  const weightScore = selectWeightCategoryScore(
    healthRhythms,
    input.rhythmScores,
    input.archivedRhythmIds
  );

  const foundationItems: RhythmContributionItem[] = [];
  const unresolvedFoundationIds: string[] = [];
  for (const id of foundationIds) {
    const foundation = foundationById.get(id);
    if (!foundation) {
      unresolvedFoundationIds.push(id);
      foundationItems.push({
        id,
        label: `${id} (unresolved)`,
        categoryLabel: 'Category unavailable',
        score: null
      });
      continue;
    }

    if (!rhythmScoredCategoryIds.has(foundation.categoryId)) continue;
    let score: number | null;
    if (foundation.categoryId === 'health') {
      if (!input.rhythm.categoryIds?.includes('health')) continue;
      if (id === 'health-strength') score = strengthScore.health;
      else if (id === 'health-weight') {
        if (input.rhythm.healthLogCapability !== 'weight') continue;
        score = weightScore.health;
      } else {
        continue;
      }
    } else {
      score = selectFoundationScore(
        id,
        linkedRhythms,
        input.rhythmScores,
        input.archivedRhythmIds
      ).health;
    }
    foundationItems.push({
      id,
      label: foundation.name,
      categoryId: foundation.categoryId,
      categoryLabel: areas.find(area => area.id === foundation.categoryId)?.label ?? foundation.categoryId,
      foundationIconId: foundation.iconId ?? foundation.id,
      score
    });
  }

  const categoryIds = [...new Set(foundationItems
    .map(item => item.categoryId)
    .filter((id): id is CategoryId => id !== undefined))];
  const categories = categoryIds.map(id => ({
    id,
    label: areas.find(area => area.id === id)?.label ?? id,
    categoryIconId: id,
    score: input.categoryHealthScores.get(id) ?? null
  }));
  const categoryScores = areas.map(area => input.categoryHealthScores.get(area.id) ?? null);

  return {
    overallScore: aggregateCategoryHealthScores(categoryScores).health,
    categories,
    foundations: foundationItems,
    rhythm: {
      id: input.rhythm.id,
      label: input.rhythm.title,
      score: input.rhythmHealthScore
    },
    unresolvedFoundationIds
  };
}
