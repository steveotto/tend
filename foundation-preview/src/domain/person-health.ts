import { aggregateHealthMeasures } from './health-scoring.ts';
import type { HealthMeasureAggregate, HealthMeasureValues } from './health-scoring.ts';
import type { PersonId, RhythmPreview } from './preview-data.ts';
import type {
  RhythmScoreResult,
  ScoredConsistencyMetric,
  ScoredOnTrackMetric
} from './rhythm-scoring.ts';

export type PersonRhythmHealthSelection = HealthMeasureAggregate & {
  rhythmIds: readonly string[];
  activeRhythmIds: readonly string[];
  eligibleRhythmIds: readonly string[];
  excludedRhythmIds: readonly string[];
  unresolvedRhythmIds: readonly string[];
  archivedRhythmIds: readonly string[];
};

export type PersonHealthSelection = HealthMeasureAggregate & {
  componentIds: readonly string[];
  eligibleComponentIds: readonly string[];
  excludedComponentIds: readonly string[];
  unscoredComponentIds: readonly string[];
};

type FullyScoredRhythm = Extract<RhythmScoreResult, { kind: 'rhythm-score' }> & {
  consistency: ScoredConsistencyMetric;
  onTrack: ScoredOnTrackMetric;
};

function isScoredMeasures(score: RhythmScoreResult | undefined): score is FullyScoredRhythm {
  return score?.kind === 'rhythm-score'
    && score.consistency.kind === 'scored'
    && score.onTrack.kind === 'scored'
    && Number.isFinite(score.consistency.score)
    && Number.isFinite(score.onTrack.score);
}

export function selectPersonRhythmHealth(
  personId: PersonId,
  rhythms: readonly RhythmPreview[],
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>,
  archivedRhythmIds: ReadonlySet<string>
): PersonRhythmHealthSelection {
  const seen = new Set<string>();
  const rhythmIds: string[] = [];
  const activeRhythmIds: string[] = [];
  const eligibleRhythmIds: string[] = [];
  const excludedRhythmIds: string[] = [];
  const unresolvedRhythmIds: string[] = [];
  const archivedIds: string[] = [];
  const measures: HealthMeasureValues[] = [];

  for (const rhythm of rhythms) {
    if (seen.has(rhythm.id) || !rhythm.personIds?.includes(personId)) continue;
    seen.add(rhythm.id);
    rhythmIds.push(rhythm.id);

    if (archivedRhythmIds.has(rhythm.id)) {
      archivedIds.push(rhythm.id);
      continue;
    }

    activeRhythmIds.push(rhythm.id);
    const score = rhythmScores.get(rhythm.id);
    if (!score) {
      unresolvedRhythmIds.push(rhythm.id);
      continue;
    }
    if (!isScoredMeasures(score)) {
      excludedRhythmIds.push(rhythm.id);
      continue;
    }

    eligibleRhythmIds.push(rhythm.id);
    measures.push({
      consistency: score.consistency.score,
      onTrack: score.onTrack.score
    });
  }

  return {
    rhythmIds,
    activeRhythmIds,
    eligibleRhythmIds,
    excludedRhythmIds,
    unresolvedRhythmIds,
    archivedRhythmIds: archivedIds,
    ...aggregateHealthMeasures(measures)
  };
}

export function selectPersonHealth(
  components: readonly {
    id: string;
    consistency: number | null;
    onTrack: number | null;
    scoringStatus?: 'available' | 'unavailable';
  }[]
): PersonHealthSelection {
  const componentIds: string[] = [];
  const eligibleComponentIds: string[] = [];
  const excludedComponentIds: string[] = [];
  const unscoredComponentIds: string[] = [];
  const seen = new Set<string>();
  const measures: HealthMeasureValues[] = [];

  for (const component of components) {
    if (seen.has(component.id)) continue;
    seen.add(component.id);
    componentIds.push(component.id);

    if (component.scoringStatus === 'unavailable') {
      unscoredComponentIds.push(component.id);
      continue;
    }

    if (typeof component.consistency !== 'number'
      || !Number.isFinite(component.consistency)
      || typeof component.onTrack !== 'number'
      || !Number.isFinite(component.onTrack)) {
      excludedComponentIds.push(component.id);
      continue;
    }

    eligibleComponentIds.push(component.id);
    measures.push({
      consistency: component.consistency,
      onTrack: component.onTrack
    });
  }

  return {
    componentIds,
    eligibleComponentIds,
    excludedComponentIds,
    unscoredComponentIds,
    ...aggregateHealthMeasures(measures)
  };
}
