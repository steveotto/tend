import { averageScores } from '../../../src/scoring/engine.ts';
import type { FoundationPreview } from './preview-data.ts';
import type { RhythmPreview } from './preview-data.ts';
import type { FoundationScoreSelection } from './foundation-scoring.ts';
import { selectFoundationScore } from './foundation-scoring.ts';
import type { CardioProgress } from './cardio.ts';
import type { RhythmScoreResult } from './rhythm-scoring.ts';
import { foundationRhythmIds } from './foundation-rhythm-associations.ts';
import {
  HEALTH_CONSISTENCY_WEIGHT,
  HEALTH_ON_TRACK_WEIGHT
} from './rhythm-history.ts';

export type CategoryScoreSelection = {
  foundationIds: readonly string[];
  eligibleFoundationIds: readonly string[];
  excludedFoundationIds: readonly string[];
  unresolvedFoundationIds: readonly string[];
  consistency: number | null;
  onTrack: number | null;
  health: number | null;
};

export type OverallCategoryHealthSelection = {
  health: number | null;
  scoredCategoryCount: number;
  categoryCount: number;
};

function isFiniteScore(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

export function aggregateCategoryHealthScores(
  categoryScores: readonly (number | null)[]
): OverallCategoryHealthSelection {
  const scored = categoryScores.filter(isFiniteScore);
  return {
    health: scored.length === 0
      ? null
      : scored.reduce((total, score) => total + score, 0) / scored.length,
    scoredCategoryCount: scored.length,
    categoryCount: categoryScores.length
  };
}

export function selectCategoryScore(
  foundations: readonly Pick<FoundationPreview, 'id'>[],
  foundationScores: ReadonlyMap<string, FoundationScoreSelection>
): CategoryScoreSelection {
  const seen = new Set<string>();
  const foundationIds: string[] = [];
  const eligible: { id: string; consistency: number; onTrack: number }[] = [];
  const excludedFoundationIds: string[] = [];
  const unresolvedFoundationIds: string[] = [];

  for (const foundation of foundations) {
    if (seen.has(foundation.id)) continue;
    seen.add(foundation.id);
    foundationIds.push(foundation.id);

    const score = foundationScores.get(foundation.id);
    if (!score) {
      unresolvedFoundationIds.push(foundation.id);
      continue;
    }
    if (!isFiniteScore(score.consistency) || !isFiniteScore(score.onTrack)) {
      excludedFoundationIds.push(foundation.id);
      continue;
    }
    eligible.push({
      id: foundation.id,
      consistency: score.consistency,
      onTrack: score.onTrack
    });
  }

  const averages = averageScores(eligible);
  if (averages.health === null) {
    return {
      foundationIds,
      eligibleFoundationIds: [],
      excludedFoundationIds,
      unresolvedFoundationIds,
      consistency: null,
      onTrack: null,
      health: null
    };
  }

  return {
    foundationIds,
    eligibleFoundationIds: eligible.map(item => item.id),
    excludedFoundationIds,
    unresolvedFoundationIds,
    consistency: averages.consistency,
    onTrack: averages.onTrack,
    health: averages.health
  };
}

export function selectCategoryHealthScore(
  foundations: readonly Pick<FoundationPreview, 'id'>[],
  rhythms: readonly RhythmPreview[],
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>,
  archivedRhythmIds: readonly string[]
): CategoryScoreSelection {
  const foundationScores = new Map(foundations.map(foundation => [
    foundation.id,
    selectFoundationScore(foundation.id, rhythms, rhythmScores, archivedRhythmIds)
  ]));
  return selectCategoryScore(foundations, foundationScores);
}

export function selectCardioCategoryScore(progress: CardioProgress): CategoryScoreSelection {
  const consistency = isFiniteScore(progress.consistency) ? progress.consistency : null;
  const onTrack = isFiniteScore(progress.score) ? progress.score : null;
  const health = isFiniteScore(progress.health) ? progress.health : null;
  return {
    foundationIds: ['health-cardio'],
    eligibleFoundationIds: health === null ? [] : ['health-cardio'],
    excludedFoundationIds: [],
    unresolvedFoundationIds: [],
    consistency,
    onTrack,
    health
  };
}

function averageAvailableScores(scores: readonly (number | null)[]): number | null {
  const available = scores.filter(isFiniteScore);
  return available.length === 0
    ? null
    : available.reduce((total, score) => total + score, 0) / available.length;
}

function scoredMetricScore(
  result: RhythmScoreResult | undefined,
  metric: 'consistency' | 'onTrack'
): number | null {
  if (!result || result.kind !== 'rhythm-score') return null;
  const value = result[metric];
  return value.kind === 'scored' && isFiniteScore(value.score) ? value.score : null;
}

export function selectWeightCategoryScore(
  rhythms: readonly RhythmPreview[],
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>,
  archivedRhythmIds: readonly string[]
): CategoryScoreSelection {
  const archived = new Set(archivedRhythmIds);
  const linkedRhythms = [...new Map(rhythms
    .filter(rhythm =>
      rhythm.healthLogCapability === 'weight'
      && rhythm.categoryIds?.includes('health')
      && foundationRhythmIds(rhythm).includes('health-weight')
    )
    .map(rhythm => [rhythm.id, rhythm] as const)
  ).values()];
  const activeRhythms = linkedRhythms.filter(rhythm => !archived.has(rhythm.id));
  const consistency = averageAvailableScores(activeRhythms.map(rhythm =>
    scoredMetricScore(rhythmScores.get(rhythm.id), 'consistency')
  ));
  const onTrack = averageAvailableScores(activeRhythms.map(rhythm =>
    scoredMetricScore(rhythmScores.get(rhythm.id), 'onTrack')
  ));
  const health = consistency === null || onTrack === null
    ? null
    : consistency * HEALTH_CONSISTENCY_WEIGHT + onTrack * HEALTH_ON_TRACK_WEIGHT;

  return {
    foundationIds: ['health-weight'],
    eligibleFoundationIds: health === null ? [] : ['health-weight'],
    excludedFoundationIds: activeRhythms.length > 0 && health === null ? ['health-weight'] : [],
    unresolvedFoundationIds: [],
    consistency,
    onTrack,
    health
  };
}

export function selectStrengthCategoryScore(
  rhythms: readonly RhythmPreview[],
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>,
  archivedRhythmIds: readonly string[]
): CategoryScoreSelection {
  const foundationId = 'health-strength';
  return selectCategoryScore(
    [{ id: foundationId }],
    new Map([[
      foundationId,
      selectFoundationScore(foundationId, rhythms, rhythmScores, archivedRhythmIds)
    ]])
  );
}

export function selectHealthFitnessCategoryScore(
  cardio: CategoryScoreSelection,
  weight: CategoryScoreSelection,
  strength: CategoryScoreSelection,
  flexibility: CategoryScoreSelection | null = null
): CategoryScoreSelection {
  const consistency = averageAvailableScores([
    cardio.consistency,
    weight.consistency,
    strength.consistency,
    flexibility?.consistency ?? null
  ]);
  const onTrack = averageAvailableScores([
    cardio.onTrack,
    weight.onTrack,
    strength.onTrack
  ]);
  const health = consistency === null || onTrack === null
    ? null
    : consistency * HEALTH_CONSISTENCY_WEIGHT + onTrack * HEALTH_ON_TRACK_WEIGHT;
  const availableMeasures = [
    ...(consistency === null ? [] : ['consistency']),
    ...(onTrack === null ? [] : ['on-track'])
  ];

  return {
    foundationIds: ['consistency', 'on-track'],
    eligibleFoundationIds: availableMeasures,
    excludedFoundationIds: [],
    unresolvedFoundationIds: [],
    consistency,
    onTrack,
    health
  };
}
