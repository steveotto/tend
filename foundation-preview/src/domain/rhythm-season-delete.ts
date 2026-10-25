import type { RhythmSchedule, RhythmScheduleHistorySegment, RhythmScoringMetadata, RhythmTimeLabel, RhythmTimeValue } from './rhythm-schedule.ts';
import { rhythmTimeOptions, validateRhythmSchedule, validateRhythmScoringMetadata } from './rhythm-schedule.ts';
import { rhythmSchedulesEqual } from './rhythm-occurrences.ts';

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
};

export type RhythmSeasonDeletionResult =
  | {
      valid: true;
      scoring: RhythmScoringMetadata;
      schedule: RhythmSchedule;
      activeTimeOfDay?: RhythmTimeValue;
      deletedSeason: Extract<RhythmScheduleHistorySegment, { kind: 'scheduled' }>;
      index: number;
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
  currentSchedule: RhythmSchedule,
  scoring: RhythmScoringMetadata,
  seasonId: string
): RhythmSeasonDeletionResult {
  if (!validateRhythmScoringMetadata(scoring) || !validateRhythmSchedule(currentSchedule).valid) {
    return { valid: false, error: 'This Rhythm has invalid schedule history and cannot be changed.' };
  }
  const latest = scoring.scheduleHistory.at(-1);
  if (latest?.kind !== 'scheduled' || !rhythmSchedulesEqual(latest.schedule, currentSchedule)) {
    return { valid: false, error: 'The current schedule does not match its saved history.' };
  }
  const index = scoring.scheduleHistory.findIndex(season => season.id === seasonId);
  if (index < 0) return { valid: false, error: 'This Season is no longer available.' };
  if (index === 0) return { valid: false, error: 'The first Season cannot be deleted. Edit it to correct its schedule.' };

  const selected = scoring.scheduleHistory[index]!;
  if (selected.kind !== 'scheduled') {
    return { valid: false, error: 'Earlier schedule needs details; repair it instead of deleting it.' };
  }
  const previous = scoring.scheduleHistory[index - 1]!;
  if (previous.kind !== 'scheduled') {
    return { valid: false, error: 'The preceding schedule needs details, so this boundary cannot be removed safely.' };
  }
  if (previous.schedule.endDate !== undefined) {
    return { valid: false, error: 'The preceding schedule has an end date and cannot safely cover this Season.' };
  }

  const scheduleHistory = scoring.scheduleHistory.filter(season => season.id !== seasonId);
  const nextScoring: RhythmScoringMetadata = { ...scoring, scheduleHistory };
  if (!validateRhythmScoringMetadata(nextScoring)) {
    return { valid: false, error: 'Removing this boundary would make the schedule history invalid.' };
  }
  const activeSeason = scheduleHistory.at(-1);
  if (activeSeason?.kind !== 'scheduled') {
    return { valid: false, error: 'A known current schedule is required to remove this Season.' };
  }
  const activeTimeOfDay = index === scoring.scheduleHistory.length - 1
    ? previous.timeOfDay
    : undefined;
  if (index === scoring.scheduleHistory.length - 1 && activeTimeOfDay === undefined) {
    return { valid: false, error: 'The preceding Season has no saved time of day. Edit it before deleting the current Season.' };
  }
  return {
    valid: true,
    scoring: nextScoring,
    schedule: activeSeason.schedule,
    ...(activeTimeOfDay === undefined ? {} : { activeTimeOfDay }),
    deletedSeason: selected,
    index
  };
}

export function restoreDeletedRhythmSeason(
  rhythmId: string,
  currentSchedule: RhythmSchedule,
  scoring: RhythmScoringMetadata,
  cadence: string,
  timeLabel: string,
  timeOfDay: RhythmTimeValue | undefined,
  undo: RhythmSeasonDeletionUndo
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
  if (undo.index < 1 || scoring.scheduleHistory.some(season => season.id === undo.season.id)) {
    return { valid: false, error: 'This Season can no longer be restored safely.' };
  }

  const scheduleHistory = [...scoring.scheduleHistory];
  scheduleHistory.splice(undo.index, 0, undo.season);
  const nextScoring: RhythmScoringMetadata = { ...scoring, scheduleHistory };
  if (!validateRhythmScoringMetadata(nextScoring)) {
    return { valid: false, error: 'Restoring this Season would make the schedule history invalid.' };
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
