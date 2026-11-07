import {
  HEALTH_CONSISTENCY_WEIGHT,
  HEALTH_ON_TRACK_WEIGHT
} from './rhythm-history.ts';

export type HealthMeasureValues = {
  consistency: number;
  onTrack: number;
};

export type HealthMeasureAggregate = {
  consistency: number | null;
  onTrack: number | null;
  health: number | null;
};

export function aggregateHealthMeasures(
  eligibleMeasures: readonly HealthMeasureValues[]
): HealthMeasureAggregate {
  if (eligibleMeasures.length === 0) {
    return { consistency: null, onTrack: null, health: null };
  }

  const consistency = eligibleMeasures.reduce((total, item) => total + item.consistency, 0)
    / eligibleMeasures.length;
  const onTrack = eligibleMeasures.reduce((total, item) => total + item.onTrack, 0)
    / eligibleMeasures.length;

  return {
    consistency,
    onTrack,
    health: consistency * HEALTH_CONSISTENCY_WEIGHT + onTrack * HEALTH_ON_TRACK_WEIGHT
  };
}
