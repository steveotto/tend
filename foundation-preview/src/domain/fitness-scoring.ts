export const FITNESS_SCORING_POLICY_VERSION = 1;
export const FITNESS_HEALTH_CONSISTENCY_WEIGHT = 0.75;
export const FITNESS_HEALTH_ON_TRACK_WEIGHT = 0.25;

export type FitnessScoreComponents = {
  consistency: number | null;
  onTrack: number | null;
  health: number | null;
};

export function blendFitnessHealth(
  consistency: number | null,
  onTrack: number | null
): FitnessScoreComponents {
  const validConsistency = isScore(consistency) ? consistency : null;
  const validOnTrack = isScore(onTrack) ? onTrack : null;
  return {
    consistency: validConsistency,
    onTrack: validOnTrack,
    health: validConsistency === null || validOnTrack === null
      ? null
      : validConsistency * FITNESS_HEALTH_CONSISTENCY_WEIGHT
        + validOnTrack * FITNESS_HEALTH_ON_TRACK_WEIGHT
  };
}

export function roundFitnessScore(score: number | null): number | null {
  return isScore(score) ? Math.round(score) : null;
}

function isScore(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0 && value <= 100;
}
