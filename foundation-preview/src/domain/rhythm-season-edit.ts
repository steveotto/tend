import { isValidDate } from './money-goals.ts';
import type {
  RhythmSchedule,
  RhythmScheduleHistorySegment,
  RhythmScheduleSegment,
  RhythmScoringMetadata,
  RhythmTimeValue
} from './rhythm-schedule.ts';
import {
  isValidTimeZone,
  rhythmTimeOptions,
  validateRhythmSchedule,
  validateRhythmScoringMetadata
} from './rhythm-schedule.ts';
import {
  createRhythmSeason,
  ensureRhythmSeasonHistoryCoverage,
  rhythmSeasonPaletteForOrdinal
} from './rhythm-seasons.ts';

export type RhythmSeasonEditDraft = {
  segmentId: string;
  startDate: string;
  endDate?: string;
  schedule: RhythmSchedule;
  timeOfDay: RhythmTimeValue;
  name: string;
};

export type RhythmSeasonEditTarget = RhythmScheduleHistorySegment
  | (Omit<RhythmScheduleSegment, 'startDate'> & { startDate?: undefined });

export type RhythmSeasonEditResult =
  | {
      valid: true;
      scoring: RhythmScoringMetadata;
      schedule: RhythmSchedule;
      activeTimeOfDay?: RhythmTimeValue;
    }
  | { valid: false; error: string };

export type RhythmSeasonHistoryCoverage = {
  effectiveStartDate?: string;
  earliestCompletionDate?: string;
  previousTimeOfDay?: RhythmTimeValue;
};

export function editRhythmSeason(
  rhythmId: string,
  currentSchedule: RhythmSchedule,
  scoring: RhythmScoringMetadata,
  draft: RhythmSeasonEditDraft
): RhythmSeasonEditResult {
  const index = scoring.scheduleHistory.findIndex(segment => segment.id === draft.segmentId);
  if (index < 0) return { valid: false, error: 'This schedule period is no longer available.' };
  if (!isValidDate(draft.startDate) || !validateRhythmSchedule(draft.schedule).valid
    || !rhythmTimeOptions.some(option => option.value === draft.timeOfDay)
    || draft.name.length > 80) {
    return { valid: false, error: 'Check the schedule, starting date, time of day, and optional name.' };
  }

  const selected = scoring.scheduleHistory[index]!;
  const previous = scoring.scheduleHistory[index - 1];
  const next = scoring.scheduleHistory[index + 1];
  if (previous && draft.startDate <= previous.startDate) {
    return { valid: false, error: 'The starting date must be after the preceding schedule period.' };
  }
  if (next && draft.startDate >= next.startDate) {
    return { valid: false, error: 'The starting date must be before the next schedule period.' };
  }
  if (draft.schedule.endDate !== undefined && next && draft.schedule.endDate >= next.startDate) {
    return { valid: false, error: 'The schedule end date must be before the next schedule period.' };
  }

  const name = draft.name.trim();
  const history: RhythmScheduleHistorySegment[] = [...scoring.scheduleHistory];
  if (selected.kind === 'unknown' && draft.startDate > selected.startDate) {
    const earlierScheduledCount = history.slice(0, index)
      .filter(segment => segment.kind === 'scheduled').length;
    history.splice(index, 1,
      selected,
      createRhythmSeason(
        rhythmId,
        draft.startDate,
        draft.schedule,
        draft.timeOfDay,
        undefined,
        rhythmSeasonPaletteForOrdinal(earlierScheduledCount)
      )
    );
    const inserted = history[index + 1]!;
    history[index + 1] = {
      ...inserted,
      ...(name ? { name } : {}),
      ...(selected.descriptiveCadence ? { contextCadence: selected.descriptiveCadence } : {})
    };
  } else {
    const earlierScheduledCount = history.slice(0, index)
      .filter(segment => segment.kind === 'scheduled').length;
    const replacement = createRhythmSeason(
      rhythmId,
      draft.startDate,
      draft.schedule,
      draft.timeOfDay,
      selected.id,
      selected.kind === 'unknown'
        ? rhythmSeasonPaletteForOrdinal(earlierScheduledCount)
        : selected.paletteToken
    );
    history[index] = {
      ...replacement,
      ...(name ? { name } : {}),
      ...(selected.kind === 'unknown'
        ? selected.descriptiveCadence ? { contextCadence: selected.descriptiveCadence } : {}
        : {
            ...(selected.note === undefined ? {} : { note: selected.note }),
            ...(selected.contextCadence === undefined ? {} : { contextCadence: selected.contextCadence })
          })
    };
  }

  const firstScheduled = history.find(segment => segment.kind === 'scheduled');
  if (!firstScheduled || history.at(-1)?.kind !== 'scheduled') {
    return { valid: false, error: 'At least one known schedule and a known current schedule are required.' };
  }
  const nextScoring: RhythmScoringMetadata = {
    ...scoring,
    trackingStartDate: firstScheduled.startDate,
    scheduleHistory: history
  };
  const active = history.at(-1);
  return {
    valid: true,
    scoring: nextScoring,
    schedule: active?.kind === 'scheduled' ? active.schedule : currentSchedule,
    ...(index === scoring.scheduleHistory.length - 1 ? { activeTimeOfDay: draft.timeOfDay } : {})
  };
}

export function establishCurrentRhythmSeason(
  rhythmId: string,
  currentSchedule: RhythmSchedule,
  scoring: RhythmScoringMetadata | undefined,
  timeZone: string,
  asOfDate: string,
  draft: RhythmSeasonEditDraft,
  coverage?: RhythmSeasonHistoryCoverage
): RhythmSeasonEditResult {
  if (!isValidDate(draft.startDate) || draft.startDate > asOfDate
    || !validateRhythmSchedule(draft.schedule).valid
    || !rhythmTimeOptions.some(option => option.value === draft.timeOfDay)
    || draft.name.length > 80) {
    return { valid: false, error: 'Choose a valid starting date on or before today and check the schedule, time of day, and optional name.' };
  }
  if (!isValidTimeZone(timeZone) || !validateRhythmSchedule(currentSchedule).valid) {
    return { valid: false, error: 'The current schedule or time zone is unavailable.' };
  }
  for (const date of [coverage?.effectiveStartDate, coverage?.earliestCompletionDate]) {
    if (date !== undefined && !isValidDate(date)) {
      return { valid: false, error: 'Earlier schedule history contains an invalid date.' };
    }
  }

  const coverageStart = [
    coverage?.effectiveStartDate,
    coverage?.earliestCompletionDate
  ].filter((date): date is string => date !== undefined).sort()[0];
  const history = scoring
    ? coverageStart
      ? ensureRhythmSeasonHistoryCoverage(rhythmId, scoring.scheduleHistory, coverageStart)
      : [...scoring.scheduleHistory]
    : [];
  const nextIndex = history.findIndex(segment => segment.startDate >= draft.startDate);
  const index = nextIndex < 0 ? history.length : nextIndex;
  const previous = history[index - 1];
  const next = history[index];
  if (previous && draft.startDate <= previous.startDate) {
    return { valid: false, error: 'The starting date must be after the preceding schedule period.' };
  }
  if (next?.startDate === draft.startDate) {
    return { valid: false, error: 'A schedule period already starts on this date.' };
  }
  if (next && draft.schedule.endDate !== undefined && draft.schedule.endDate >= next.startDate) {
    return { valid: false, error: 'The schedule end date must be before the next schedule period.' };
  }
  if (history.some(segment => segment.id === draft.segmentId)) {
    return { valid: false, error: 'This schedule period already exists.' };
  }

  const scheduledBefore = history.slice(0, index)
    .filter(segment => segment.kind === 'scheduled').length;
  const season = createRhythmSeason(
    rhythmId,
    draft.startDate,
    draft.schedule,
    draft.timeOfDay,
    undefined,
    rhythmSeasonPaletteForOrdinal(scheduledBefore)
  );
  const name = draft.name.trim();
  const namedSeason = name ? { ...season, name } : season;
  const scheduleHistory = [...history];
  if (!scoring && coverageStart && coverageStart < draft.startDate) {
    const previousSeason = createRhythmSeason(
      rhythmId,
      coverageStart,
      currentSchedule,
      coverage?.previousTimeOfDay,
      undefined,
      rhythmSeasonPaletteForOrdinal(0)
    );
    scheduleHistory.splice(index, 0, previousSeason, namedSeason);
  } else {
    scheduleHistory.splice(index, 0, namedSeason);
  }
  const firstScheduled = scheduleHistory.find(segment => segment.kind === 'scheduled');
  if (!firstScheduled) return { valid: false, error: 'A known current schedule is required.' };

  const nextScoring: RhythmScoringMetadata = {
    trackingStartDate: firstScheduled.startDate,
    timeZone: scoring?.timeZone ?? timeZone,
    scheduleHistory
  };
  if (!validateRhythmScoringMetadata(nextScoring)) {
    return { valid: false, error: 'This date cannot be added without overlapping existing schedule history.' };
  }
  const activeSeason = [...scheduleHistory].reverse().find(segment => segment.startDate <= asOfDate);
  return {
    valid: true,
    scoring: nextScoring,
    schedule: activeSeason?.kind === 'scheduled' ? activeSeason.schedule : currentSchedule,
    ...(activeSeason?.kind === 'scheduled' ? { activeTimeOfDay: activeSeason.timeOfDay ?? draft.timeOfDay } : {})
  };
}
