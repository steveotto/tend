import { isValidDate } from './money-goals.ts';
import type {
  RhythmSchedule,
  RhythmScheduleHistorySegment,
  RhythmScoringMetadata,
  RhythmTimeValue
} from './rhythm-schedule.ts';
import { validateRhythmSchedule, rhythmTimeOptions } from './rhythm-schedule.ts';
import { createRhythmSeason } from './rhythm-seasons.ts';

export type RhythmSeasonEditDraft = {
  segmentId: string;
  startDate: string;
  schedule: RhythmSchedule;
  timeOfDay: RhythmTimeValue;
  name: string;
};

export type RhythmSeasonEditResult =
  | {
      valid: true;
      scoring: RhythmScoringMetadata;
      schedule: RhythmSchedule;
      activeTimeOfDay?: RhythmTimeValue;
    }
  | { valid: false; error: string };

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
    history.splice(index, 1,
      selected,
      createRhythmSeason(rhythmId, draft.startDate, draft.schedule, draft.timeOfDay)
    );
    const inserted = history[index + 1]!;
    history[index + 1] = {
      ...inserted,
      ...(name ? { name } : {}),
      ...(selected.descriptiveCadence ? { contextCadence: selected.descriptiveCadence } : {})
    };
  } else {
    const replacement = createRhythmSeason(
      rhythmId,
      draft.startDate,
      draft.schedule,
      draft.timeOfDay,
      selected.id
    );
    history[index] = {
      ...replacement,
      paletteToken: selected.paletteToken,
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
