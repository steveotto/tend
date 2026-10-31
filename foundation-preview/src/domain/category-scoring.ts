import type { FoundationPreview } from './preview-data.ts';
import type { FoundationScoreSelection } from './foundation-scoring.ts';
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

function isFiniteScore(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
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

  if (eligible.length === 0) {
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

  const consistency = eligible.reduce((total, item) => total + item.consistency, 0) / eligible.length;
  const onTrack = eligible.reduce((total, item) => total + item.onTrack, 0) / eligible.length;

  return {
    foundationIds,
    eligibleFoundationIds: eligible.map(item => item.id),
    excludedFoundationIds,
    unresolvedFoundationIds,
    consistency,
    onTrack,
    health: consistency * HEALTH_CONSISTENCY_WEIGHT + onTrack * HEALTH_ON_TRACK_WEIGHT
  };
}
