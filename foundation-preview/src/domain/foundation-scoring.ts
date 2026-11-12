import { averageScores } from '../../../src/scoring/engine.ts';
import type { RhythmPreview } from './preview-data.ts';
import { foundationRhythmIds } from './foundation-rhythm-associations.ts';
import { localDateInTimeZone, selectSharedEngineRhythmScore } from './rhythm-scoring.ts';
import type {
  RhythmScoreResult,
  ScoredConsistencyMetric,
  ScoredOnTrackMetric
} from './rhythm-scoring.ts';
import { effectiveRhythmSchedule, isValidTimeZone } from './rhythm-schedule.ts';

export type FoundationScoreSelection = {
  foundationId: string;
  linkedRhythmIds: readonly string[];
  activeLinkedRhythmIds: readonly string[];
  eligibleRhythmIds: readonly string[];
  archivedRhythmIds: readonly string[];
  unresolvedRhythmIds: readonly string[];
  excludedRhythms: readonly {
    rhythmId: string;
    score: RhythmScoreResult;
  }[];
  consistency: number | null;
  onTrack: number | null;
  health: number | null;
};

export function selectFoundationRhythmScores(
  rhythms: readonly RhythmPreview[],
  archivedRhythmIds: readonly string[],
  historyAvailableRhythmIds: ReadonlySet<string>,
  evaluationInstant: Date,
  localTimeZone: string
): ReadonlyMap<string, RhythmScoreResult> {
  const archived = new Set(archivedRhythmIds);
  return new Map(rhythms.map(rhythm => {
    const timeZone = rhythm.scoring?.timeZone
      ?? rhythm.createdTimeZone
      ?? localTimeZone;
    const dateTimeZone = isValidTimeZone(timeZone) ? timeZone : localTimeZone;
    const schedule = effectiveRhythmSchedule(rhythm.schedule, rhythm.cadence);
    const records = (rhythm.completionHistory ?? []).map(record => ({
      ...record,
      rhythmId: rhythm.id
    }));
    return [
      rhythm.id,
      selectSharedEngineRhythmScore({
        rhythmId: rhythm.id,
        ...(rhythm.cadence ? { cadence: rhythm.cadence } : {}),
        ...(schedule ? { schedule } : {}),
        ...(rhythm.scoring ? { scoring: rhythm.scoring } : {}),
        ...(rhythm.createdLocalDate ? { createdLocalDate: rhythm.createdLocalDate } : {}),
        ...(rhythm.createdTimeZone ? { createdTimeZone: rhythm.createdTimeZone } : {}),
        ...(rhythm.dailyBackfillAllowed === undefined ? {} : { dailyBackfillAllowed: rhythm.dailyBackfillAllowed }),
        records,
        recordsAvailable: rhythm.completionHistory !== undefined || historyAvailableRhythmIds.has(rhythm.id),
        archived: archived.has(rhythm.id),
        asOfDate: localDateInTimeZone(evaluationInstant, dateTimeZone),
        timeZone
      })
    ] as const;
  }));
}

function isScoredConsistency(
  metric: RhythmScoreResult['consistency']
): metric is ScoredConsistencyMetric {
  return metric.kind === 'scored';
}

function isScoredOnTrack(
  metric: RhythmScoreResult['onTrack']
): metric is ScoredOnTrackMetric {
  return metric.kind === 'scored';
}

export function selectFoundationScore(
  foundationId: string,
  rhythms: readonly RhythmPreview[],
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>,
  archivedRhythmIds: readonly string[]
): FoundationScoreSelection {
  const archived = new Set(archivedRhythmIds);
  const seen = new Set<string>();
  const linkedRhythmIds: string[] = [];

  for (const rhythm of rhythms) {
    if (seen.has(rhythm.id) || !foundationRhythmIds(rhythm).includes(foundationId)) continue;
    seen.add(rhythm.id);
    linkedRhythmIds.push(rhythm.id);
  }

  const activeLinkedRhythmIds = linkedRhythmIds.filter(id => !archived.has(id));
  const archivedLinkedRhythmIds = linkedRhythmIds.filter(id => archived.has(id));
  const eligible: { rhythmId: string; consistency: number; onTrack: number }[] = [];
  const unresolvedRhythmIds: string[] = [];
  const excludedRhythms: { rhythmId: string; score: RhythmScoreResult }[] = [];

  for (const rhythmId of activeLinkedRhythmIds) {
    const score = rhythmScores.get(rhythmId);
    if (!score) {
      unresolvedRhythmIds.push(rhythmId);
      continue;
    }
    if (score.kind !== 'rhythm-score'
      || !isScoredConsistency(score.consistency)
      || !isScoredOnTrack(score.onTrack)) {
      excludedRhythms.push({ rhythmId, score });
      continue;
    }
    eligible.push({
      rhythmId,
      consistency: score.consistency.score,
      onTrack: score.onTrack.score
    });
  }

  const averages = averageScores(eligible);
  if (averages.health === null) {
    return {
      foundationId,
      linkedRhythmIds,
      activeLinkedRhythmIds,
      eligibleRhythmIds: [],
      archivedRhythmIds: archivedLinkedRhythmIds,
      unresolvedRhythmIds,
      excludedRhythms,
      consistency: null,
      onTrack: null,
      health: null
    };
  }

  return {
    foundationId,
    linkedRhythmIds,
    activeLinkedRhythmIds,
    eligibleRhythmIds: eligible.map(item => item.rhythmId),
    archivedRhythmIds: archivedLinkedRhythmIds,
    unresolvedRhythmIds,
    excludedRhythms,
    consistency: averages.consistency,
    onTrack: averages.onTrack,
    health: averages.health
  };
}
