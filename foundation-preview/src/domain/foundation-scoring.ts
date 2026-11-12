import { averageScores } from '../../../src/scoring/engine.ts';
import type { RhythmPreview } from './preview-data.ts';
import { foundationRhythmIds } from './foundation-rhythm-associations.ts';
import { localDateInTimeZone, selectSharedEngineRhythmScore } from './rhythm-scoring.ts';
import type {
  RhythmScoreResult,
  ScoredConsistencyMetric,
  ScoredOnTrackMetric
} from './rhythm-scoring.ts';
import {
  effectiveRhythmSchedule,
  isValidTimeZone,
  rhythmTimeValueFromLabel
} from './rhythm-schedule.ts';
import {
  DEFAULT_TIME_BLOCK_SETTINGS,
  timeBlockIdFromRhythmValue
} from './time-blocks.ts';
import type { TimeBlockSettings } from './time-blocks.ts';

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
  localTimeZone: string,
  timeBlockSettings: TimeBlockSettings = DEFAULT_TIME_BLOCK_SETTINGS
): ReadonlyMap<string, RhythmScoreResult> {
  const archived = new Set(archivedRhythmIds);
  return new Map(rhythms.map(rhythm => {
    const timeZone = rhythm.scoring?.timeZone
      ?? rhythm.createdTimeZone
      ?? localTimeZone;
    const dateTimeZone = isValidTimeZone(timeZone) ? timeZone : localTimeZone;
    const asOfDate = localDateInTimeZone(evaluationInstant, dateTimeZone);
    const schedule = effectiveRhythmSchedule(rhythm.schedule, rhythm.cadence);
    const activeTimeSegment = rhythm.scoring?.scheduleHistory
      .filter(segment => segment.startDate <= asOfDate)
      .at(-1);
    const rhythmTimeValue = activeTimeSegment?.kind === 'unknown'
      ? undefined
      : activeTimeSegment?.kind === 'scheduled' && activeTimeSegment.timeOfDay !== undefined
        ? activeTimeSegment.timeOfDay
        : rhythm.timeOfDay ?? rhythmTimeValueFromLabel(rhythm.timeLabel ?? '');
    const timeBlockId = rhythmTimeValue
      ? timeBlockIdFromRhythmValue(rhythmTimeValue)
      : undefined;
    const dueTime = timeBlockSettings.blocks.find(block => block.id === timeBlockId)?.start;
    const asOfTime = dueTime === undefined
      ? undefined
      : localTimeInTimeZone(evaluationInstant, dateTimeZone);
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
        asOfDate,
        ...(asOfTime && dueTime ? { asOfTime, dueTime } : {}),
        timeZone
      })
    ] as const;
  }));
}

function localTimeInTimeZone(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(instant);
  const hour = parts.find(part => part.type === 'hour')?.value;
  const minute = parts.find(part => part.type === 'minute')?.value;
  if (!hour || !minute) throw new RangeError('Could not determine local scoring time.');
  return `${hour}:${minute}`;
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
