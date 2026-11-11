import { aggregateHealthMeasures } from './health-scoring.ts';
import type { HealthMeasureAggregate, HealthMeasureValues } from './health-scoring.ts';
import type { PersonId, RhythmPreview } from './preview-data.ts';
import { connectionsForPerson } from './friendships.ts';
import type { ConnectionCadence, FriendshipData } from './friendships.ts';
import type {
  RhythmScoreResult,
  ScoredConsistencyMetric,
  ScoredOnTrackMetric
} from './rhythm-scoring.ts';
import { selectRhythmScore } from './rhythm-scoring.ts';
import type { RhythmSchedule } from './rhythm-schedule.ts';

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

export type PersonConnectionHealthSelection = HealthMeasureAggregate & {
  configured: boolean;
  connectionIds: readonly string[];
  scoringResult: RhythmScoreResult | undefined;
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

function connectionSchedule(cadence: ConnectionCadence, startDate: string): RhythmSchedule {
  const [year, month, day] = startDate.split('-').map(Number);
  const weekday = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
  if (cadence === 'daily') {
    return {
      frequency: 'custom',
      unit: 'days',
      interval: 7,
      startDate,
      targetPeriod: { targetCount: 7, onTrack: 'decay' }
    };
  }
  if (cadence === 'weekly') {
    return { frequency: 'weekly', weekdays: [weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6] };
  }
  if (cadence === 'monthly') {
    return { frequency: 'monthly', pattern: { kind: 'dayOfMonth', day: day! } };
  }
  if (cadence === 'twice-weekly') {
    return {
      frequency: 'custom',
      unit: 'days',
      interval: 7,
      startDate,
      targetPeriod: { targetCount: 2, onTrack: 'decay' }
    };
  }
  if (cadence === 'two-weeks') {
    return {
      frequency: 'custom',
      unit: 'days',
      interval: 14,
      startDate,
      targetPeriod: { targetCount: 1, onTrack: 'decay' }
    };
  }
  return {
    frequency: 'daily'
  };
}

export function selectPersonConnectionHealth(
  personId: PersonId,
  friendships: FriendshipData,
  asOfDate: string,
  timeZone: string
): PersonConnectionHealthSelection {
  const cadence = friendships.cadenceSettings.find(setting => setting.personId === personId);
  const connectionIds = connectionsForPerson(friendships, personId)
    .filter(connection => connection.deleted !== true
      && connection.isDeleted !== true
      && connection.deletedAt == null
      && connection.deleted_at == null)
    .map(connection => connection.id);
  if (!cadence) {
    return {
      configured: false,
      connectionIds,
      scoringResult: undefined,
      consistency: null,
      onTrack: null,
      health: null
    };
  }

  const schedule = connectionSchedule(cadence.cadence, cadence.setOn);
  const records = connectionsForPerson(friendships, personId)
    .filter(connection => connection.deleted !== true
      && connection.isDeleted !== true
      && connection.deletedAt == null
      && connection.deleted_at == null)
    .map(connection => ({
      id: `connection:${connection.id}`,
      rhythmId: `person-connection:${personId}`,
      effectiveDate: connection.date
    }));
  const scoringResult = selectRhythmScore({
    rhythmId: `person-connection:${personId}`,
    schedule,
    createdLocalDate: cadence.setOn,
    createdTimeZone: timeZone,
    records,
    recordsAvailable: true,
    asOfDate,
    timeZone
  });
  const measures: HealthMeasureValues[] = isScoredMeasures(scoringResult)
    ? [{
        consistency: scoringResult.consistency.score,
        onTrack: scoringResult.onTrack.score
      }]
    : [];
  return {
    configured: true,
    connectionIds,
    scoringResult,
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

export function selectPersonOverallHealth(
  rhythms: Pick<PersonRhythmHealthSelection, 'consistency' | 'onTrack'>,
  configuredComponents: readonly {
    id: string;
    consistency: number | null;
    onTrack: number | null;
    scoringStatus?: 'available' | 'unavailable';
  }[] = []
): PersonHealthSelection {
  return selectPersonHealth([
    { id: 'rhythms', consistency: rhythms.consistency, onTrack: rhythms.onTrack },
    ...configuredComponents
  ]);
}
