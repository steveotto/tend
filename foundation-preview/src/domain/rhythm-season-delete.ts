import type { RhythmSchedule, RhythmScheduleHistorySegment, RhythmScoringMetadata, RhythmTimeLabel, RhythmTimeValue } from './rhythm-schedule.ts';
import { rhythmTimeOptions, validateRhythmSchedule, validateRhythmScoringMetadata } from './rhythm-schedule.ts';
import { rhythmSchedulesEqual } from './rhythm-occurrences.ts';
import { rhythmSeasonForDate, rhythmSeasonPaletteAssignments } from './rhythm-seasons.ts';
import type { RhythmCompletionRecord } from './rhythm-completion.ts';
import { isValidDate } from './money-goals.ts';

export type RhythmSeasonDeletionUndo = {
  rhythmId: string;
  season: Extract<RhythmScheduleHistorySegment, { kind: 'scheduled' }>;
  index: number;
  expectedScoring: RhythmScoringMetadata;
  expectedSchedule: RhythmSchedule;
  expectedCadence: string;
  expectedTimeLabel: string;
  expectedTimeOfDay?: RhythmTimeValue;
  restoreSchedule: RhythmSchedule;
  restoreCadence: string;
  restoreTimeLabel: RhythmTimeLabel;
  restoreTimeOfDay?: RhythmTimeValue;
  restoreTrackingStartDate: string;
};

export type RhythmSeasonDeletionResult =
  | {
      valid: true;
      scoring: RhythmScoringMetadata;
      schedule: RhythmSchedule;
      activeTimeOfDay?: RhythmTimeValue;
      deletedSeason: Extract<RhythmScheduleHistorySegment, { kind: 'scheduled' }>;
      index: number;
      restoreTrackingStartDate: string;
    }
  | { valid: false; error: string };

export type RhythmSeasonUndoResult =
  | {
      valid: true;
      scoring: RhythmScoringMetadata;
      schedule: RhythmSchedule;
      cadence: string;
      timeLabel: RhythmTimeLabel;
      timeOfDay?: RhythmTimeValue;
    }
  | { valid: false; error: string };

export function deleteRhythmSeason(
  rhythmId: string,
  currentSchedule: RhythmSchedule,
  scoring: RhythmScoringMetadata,
  seasonId: string,
  records: readonly RhythmCompletionRecord[],
  asOfDate?: string
): RhythmSeasonDeletionResult {
  if (!validateRhythmScoringMetadata(scoring) || !validateRhythmSchedule(currentSchedule).valid) {
    return { valid: false, error: 'This Rhythm has invalid schedule history and cannot be changed.' };
  }
  const paletteAssignments = rhythmSeasonPaletteAssignments(scoring.scheduleHistory);
  const assignedHistory = scoring.scheduleHistory.map(season => season.kind === 'scheduled'
    ? { ...season, paletteToken: paletteAssignments.get(season.id)! }
    : season);
  const latest = assignedHistory.at(-1);
  const referenceDate = asOfDate ?? latest?.startDate;
  const currentSeason = referenceDate ? rhythmSeasonForDate(assignedHistory, referenceDate) : undefined;
  if (latest?.kind !== 'scheduled' || currentSeason?.kind !== 'scheduled'
    || !rhythmSchedulesEqual(currentSeason.schedule, currentSchedule)) {
    return { valid: false, error: 'The current schedule does not match the schedule effective today.' };
  }
  const index = assignedHistory.findIndex(season => season.id === seasonId);
  if (index < 0) return { valid: false, error: 'This Season is no longer available.' };

  const selected = assignedHistory[index]!;
  if (selected.kind !== 'scheduled') {
    return { valid: false, error: 'Earlier schedule needs details; repair it instead of deleting it.' };
  }
  if (index === 0) {
    const next = assignedHistory[1];
    if (!next) {
      return { valid: false, error: 'The only remaining Season cannot be deleted. You can edit its schedule.' };
    }
    const hasLoggedMoments = records.some(record => {
      if (record.rhythmId !== rhythmId) return false;
      if (!isValidDate(record.effectiveDate)) return true;
      return record.effectiveDate >= selected.startDate && record.effectiveDate < next.startDate;
    });
    if (hasLoggedMoments) {
      return {
        valid: false,
        error: 'This season contains logged moments and can’t be deleted. You can edit its schedule.'
      };
    }
    const scheduleHistory = assignedHistory.slice(1);
    const firstKnown = scheduleHistory.find(segment => segment.kind === 'scheduled');
    if (!firstKnown) {
      return { valid: false, error: 'A known schedule is required after deleting this Season.' };
    }
    const nextScoring: RhythmScoringMetadata = {
      ...scoring,
      trackingStartDate: firstKnown.startDate,
      scheduleHistory
    };
    if (!validateRhythmScoringMetadata(nextScoring)) {
      return { valid: false, error: 'Removing this boundary would make the schedule history invalid.' };
    }
    const activeSeason = referenceDate ? rhythmSeasonForDate(scheduleHistory, referenceDate) : undefined;
    return {
      valid: true,
      scoring: nextScoring,
      schedule: activeSeason?.kind === 'scheduled' ? activeSeason.schedule : currentSchedule,
      ...(activeSeason?.kind === 'scheduled' && activeSeason.timeOfDay !== undefined
        ? { activeTimeOfDay: activeSeason.timeOfDay }
        : {}),
      deletedSeason: selected,
      index,
      restoreTrackingStartDate: scoring.trackingStartDate
    };
  }

  const previous = assignedHistory[index - 1]!;
  if (previous.kind !== 'scheduled') {
    return { valid: false, error: 'The preceding schedule needs details, so this boundary cannot be removed safely.' };
  }
  if (previous.schedule.endDate !== undefined) {
    return { valid: false, error: 'The preceding schedule has an end date and cannot safely cover this Season.' };
  }

  const scheduleHistory = assignedHistory.filter(season => season.id !== seasonId);
  const nextScoring: RhythmScoringMetadata = { ...scoring, scheduleHistory };
  if (!validateRhythmScoringMetadata(nextScoring)) {
    return { valid: false, error: 'Removing this boundary would make the schedule history invalid.' };
  }
  const activeSeason = referenceDate ? rhythmSeasonForDate(scheduleHistory, referenceDate) : undefined;
  if (activeSeason?.kind !== 'scheduled') {
    return { valid: false, error: 'A known current schedule is required to remove this Season.' };
  }
  const activeTimeOfDay = currentSeason.id === selected.id
    ? activeSeason.timeOfDay ?? previous.timeOfDay
    : undefined;
  if (currentSeason.id === selected.id && activeTimeOfDay === undefined) {
    return { valid: false, error: 'The preceding Season has no saved time of day. Edit it before deleting the current Season.' };
  }
  return {
    valid: true,
    scoring: nextScoring,
    schedule: activeSeason.schedule,
    ...(activeTimeOfDay === undefined ? {} : { activeTimeOfDay }),
    deletedSeason: selected,
    index,
    restoreTrackingStartDate: scoring.trackingStartDate
  };
}

export function restoreDeletedRhythmSeason(
  rhythmId: string,
  currentSchedule: RhythmSchedule,
  scoring: RhythmScoringMetadata,
  cadence: string,
  timeLabel: string,
  timeOfDay: RhythmTimeValue | undefined,
  undo: RhythmSeasonDeletionUndo,
  records: readonly RhythmCompletionRecord[]
): RhythmSeasonUndoResult {
  const unchanged = undo.rhythmId === rhythmId
    && JSON.stringify(scoring) === JSON.stringify(undo.expectedScoring)
    && rhythmSchedulesEqual(currentSchedule, undo.expectedSchedule)
    && cadence === undo.expectedCadence
    && timeLabel === undo.expectedTimeLabel
    && timeOfDay === undo.expectedTimeOfDay;
  if (!unchanged) {
    return {
      valid: false,
      error: 'Schedule history changed after deletion. This Season cannot be safely restored without overwriting those changes.'
    };
  }
  if (undo.index < 0 || undo.index > scoring.scheduleHistory.length
    || scoring.scheduleHistory.some(season => season.id === undo.season.id)) {
    return { valid: false, error: 'This Season can no longer be restored safely.' };
  }

  const scheduleHistory = [...scoring.scheduleHistory];
  const previous = scheduleHistory[undo.index - 1];
  const next = scheduleHistory[undo.index];
  if ((previous && previous.startDate >= undo.season.startDate)
    || (next && undo.season.startDate >= next.startDate)) {
    return { valid: false, error: 'Current Season boundaries conflict with the deleted Season.' };
  }
  scheduleHistory.splice(undo.index, 0, undo.season);
  const nextScoring: RhythmScoringMetadata = {
    ...scoring,
    trackingStartDate: undo.restoreTrackingStartDate,
    scheduleHistory
  };
  if (!validateRhythmScoringMetadata(nextScoring)) {
    return { valid: false, error: 'Restoring this Season would make the schedule history invalid.' };
  }
  const recordIds = new Set<string>();
  if (records.some(record => {
    if (record.rhythmId !== rhythmId) return false;
    if (!record.id.trim() || !isValidDate(record.effectiveDate) || recordIds.has(record.id)) return true;
    recordIds.add(record.id);
    return false;
  })) {
    return { valid: false, error: 'Completion history is invalid, so this Season cannot be restored safely.' };
  }
  if (!rhythmTimeOptions.some(option => option.value === undo.restoreTimeOfDay)
    && undo.restoreTimeOfDay !== undefined) {
    return { valid: false, error: 'The saved time of day is no longer supported.' };
  }
  return {
    valid: true,
    scoring: nextScoring,
    schedule: undo.restoreSchedule,
    cadence: undo.restoreCadence,
    timeLabel: undo.restoreTimeLabel,
    ...(undo.restoreTimeOfDay === undefined ? {} : { timeOfDay: undo.restoreTimeOfDay })
  };
}
