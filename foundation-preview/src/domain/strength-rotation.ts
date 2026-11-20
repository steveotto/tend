import { addCalendarDays, isScheduledDate } from './rhythm-occurrences.ts';
import type { DatedRhythmCompletion } from './rhythm-completion.ts';
import type { RhythmPreview } from './preview-data.ts';
import { isValidDate } from './money-goals.ts';
import { rhythmScheduleForDate } from './rhythm-schedule.ts';
import type {
  StrengthGuidedSessionDraft,
  StrengthRhythmMode,
  StrengthRotationAdvanceMode,
  StrengthRotationVersion,
  StrengthSavedWorkout,
  StrengthWorkoutLog
} from './strength.ts';

export type StrengthRotationAssignment =
  | {
      kind: 'assigned';
      workoutId: string;
      workoutName: string;
      rotationIndex: number;
      available: true;
    }
  | {
      kind: 'repair';
      workoutId: string;
      workoutName: string;
      rotationIndex: number;
      available: false;
      reason: string;
    }
  | { kind: 'unavailable'; reason: string };

export type StrengthRotationInput = {
  rhythm: RhythmPreview;
  setting?: StrengthRhythmMode;
  date: string;
  workouts: readonly StrengthWorkoutLog[];
  savedWorkouts: readonly StrengthSavedWorkout[];
  completions: readonly DatedRhythmCompletion[];
  activeDraft?: StrengthGuidedSessionDraft;
  excludeWorkoutLogId?: string;
};

export type StrengthRotationModeUpdate = {
  prior?: StrengthRhythmMode;
  rhythm: RhythmPreview;
  mode: StrengthRhythmMode['mode'];
  workoutId?: string;
  rotationWorkoutIds: readonly string[];
  advanceMode: StrengthRotationAdvanceMode;
  savedWorkouts: readonly StrengthSavedWorkout[];
  workouts: readonly StrengthWorkoutLog[];
  completions: readonly DatedRhythmCompletion[];
  activeDraft?: StrengthGuidedSessionDraft;
  asOfDate: string;
  scheduleChanged?: boolean;
};

export type StrengthRotationModeUpdateResult =
  | { valid: true; setting: StrengthRhythmMode }
  | { valid: false; error: string };

function rotationVersionForDate(
  history: readonly StrengthRotationVersion[],
  date: string
): StrengthRotationVersion | undefined {
  return history.find(version =>
    date >= version.effectiveFrom
    && (version.effectiveUntil === undefined || date < version.effectiveUntil)
  );
}

function dueOnDate(rhythm: RhythmPreview, date: string): boolean | null {
  const schedule = rhythmScheduleForDate(rhythm, date);
  return schedule === undefined ? null : isScheduledDate(schedule, date);
}

function matchingCompletedWorkout(
  input: StrengthRotationInput,
  date: string,
  version: StrengthRotationVersion
): boolean {
  return input.workouts.some(log =>
    log.id !== input.excludeWorkoutLogId
    && log.rhythmId === input.rhythm.id
    && log.date === date
    && log.rhythmOccurrence === date
    && log.savedWorkoutId !== undefined
    && version.workoutIds.includes(log.savedWorkoutId)
    && log.completionId !== undefined
    && input.completions.some(completion =>
      completion.id === log.completionId
      && completion.rhythmId === input.rhythm.id
      && completion.effectiveDate === date
    )
  );
}

function rotationIndexForDate(
  version: StrengthRotationVersion,
  input: StrengthRotationInput,
  date: string
): { index: number } | { error: string } {
  let index = version.startIndex;
  for (let cursor = version.effectiveFrom; cursor < date; cursor = addCalendarDays(cursor, 1)) {
    if (version.effectiveUntil !== undefined && cursor >= version.effectiveUntil) break;
    const due = dueOnDate(input.rhythm, cursor);
    if (due === null) return { error: 'The Rhythm schedule history is unavailable for this rotation.' };
    if (!due) continue;
    if (version.advanceMode === 'each-scheduled-occurrence') {
      index = (index + 1) % version.workoutIds.length;
    } else if (matchingCompletedWorkout(input, cursor, version)) {
      index = (index + 1) % version.workoutIds.length;
    }
  }
  return { index };
}

export function selectStrengthRotationAssignment(input: StrengthRotationInput): StrengthRotationAssignment {
  if (!isValidDate(input.date)) return { kind: 'unavailable', reason: 'Choose a valid workout date.' };
  const history = input.setting?.rotationHistory;
  const version = history ? rotationVersionForDate(history, input.date) : undefined;
  if (!version) return { kind: 'unavailable', reason: 'No workout rotation is active for this date.' };
  const due = dueOnDate(input.rhythm, input.date);
  if (due === null) return { kind: 'unavailable', reason: 'The Rhythm schedule for this date is unavailable.' };
  if (!due) return { kind: 'unavailable', reason: 'This Rhythm is not due on this date.' };
  if (input.rhythm.scoring?.trackingStartDate && input.date < input.rhythm.scoring.trackingStartDate) {
    return { kind: 'unavailable', reason: 'This Rhythm is not active on this date.' };
  }
  const result = rotationIndexForDate(version, input, input.date);
  if ('error' in result) return { kind: 'unavailable', reason: result.error };
  const workoutId = version.workoutIds[result.index]!;
  const workoutName = version.workoutNames[result.index]!;
  if (!input.savedWorkouts.some(workout => workout.id === workoutId)) {
    return {
      kind: 'repair',
      workoutId,
      workoutName,
      rotationIndex: result.index,
      available: false,
      reason: `“${workoutName}” is unavailable. Edit this Rhythm’s rotation to repair it.`
    };
  }
  return {
    kind: 'assigned',
    workoutId,
    workoutName,
    rotationIndex: result.index,
    available: true
  };
}

function nextScheduledOccurrence(
  input: Omit<StrengthRotationInput, 'setting' | 'date'> & { asOfDate: string },
  notBeforeDate: string,
  includeNotBefore: boolean
): { date: string } | { error: string } {
  if (!isValidDate(input.asOfDate) || !isValidDate(notBeforeDate)) {
    return { error: 'Choose a valid date before configuring this rotation.' };
  }
  const startDate = notBeforeDate > input.asOfDate ? notBeforeDate : input.asOfDate;
  let cursor = includeNotBefore ? startDate : addCalendarDays(startDate, 1);
  const endDate = addCalendarDays(cursor, 3660);
  for (; cursor <= endDate; cursor = addCalendarDays(cursor, 1)) {
    const due = dueOnDate(input.rhythm, cursor);
    if (due === null) return { error: 'The Rhythm schedule history is unavailable for a future rotation occurrence.' };
    if (!due || input.rhythm.scoring?.trackingStartDate && cursor < input.rhythm.scoring.trackingStartDate) continue;
    const completed = input.completions.some(completion =>
      completion.rhythmId === input.rhythm.id && completion.effectiveDate === cursor
    );
    const hasWorkout = input.workouts.some(log =>
      log.rhythmId === input.rhythm.id && log.date === cursor
    );
    if (!completed && !hasWorkout) return { date: cursor };
  }
  return { error: 'This Rhythm has no upcoming scheduled workout occurrence.' };
}

function indexAfterVersion(
  version: StrengthRotationVersion,
  input: StrengthRotationInput
): { index: number } | { error: string } {
  const boundary = version.effectiveUntil;
  if (!boundary) return { index: version.startIndex };
  return rotationIndexForDate(version, input, boundary);
}

function carryRotationIndex(
  previousVersion: StrengthRotationVersion | undefined,
  nextWorkoutIds: readonly string[],
  input: StrengthRotationInput
): { index: number } | { error: string } {
  if (!previousVersion) return { index: 0 };
  const progress = previousVersion.effectiveUntil
    ? indexAfterVersion(previousVersion, input)
    : rotationIndexForDate(previousVersion, input, input.date);
  if ('error' in progress) return progress;
  const currentId = previousVersion.workoutIds[progress.index]!;
  const exactIndex = nextWorkoutIds.indexOf(currentId);
  if (exactIndex >= 0) return { index: exactIndex };
  for (let offset = 1; offset <= previousVersion.workoutIds.length; offset++) {
    const nextId = previousVersion.workoutIds[(progress.index + offset) % previousVersion.workoutIds.length]!;
    const nextIndex = nextWorkoutIds.indexOf(nextId);
    if (nextIndex >= 0) return { index: nextIndex };
  }
  return { index: 0 };
}

function versionEquals(
  version: StrengthRotationVersion,
  ids: readonly string[],
  names: readonly string[],
  advanceMode: StrengthRotationAdvanceMode
): boolean {
  return version.advanceMode === advanceMode
    && version.workoutIds.length === ids.length
    && version.workoutIds.every((id, index) => id === ids[index])
    && version.workoutNames.every((name, index) => name === names[index]);
}

export function updateStrengthRhythmMode(
  input: StrengthRotationModeUpdate
): StrengthRotationModeUpdateResult {
  const previous = input.prior;
  const history = [...(previous?.rotationHistory ?? [])];
  const openVersion = history.at(-1)?.effectiveUntil === undefined ? history.at(-1) : undefined;

  if (input.mode !== 'rotation') {
    if (openVersion) {
      const activeDraftDate = input.activeDraft?.rhythmId === input.rhythm.id
        ? input.activeDraft.rhythmOccurrence ?? input.asOfDate
        : input.asOfDate;
      const next = nextScheduledOccurrence(input, activeDraftDate, false);
      const closeDate = 'date' in next ? next.date : addCalendarDays(activeDraftDate, 1);
      if (closeDate <= openVersion.effectiveFrom) {
        history.pop();
      } else {
        history[history.length - 1] = { ...openVersion, effectiveUntil: closeDate };
      }
    }
    return {
      valid: true,
      setting: {
        rhythmId: input.rhythm.id,
        mode: input.mode,
        ...(input.mode === 'specific' && input.workoutId ? { workoutId: input.workoutId } : {}),
        ...(history.length > 0 ? { rotationHistory: history } : {})
      }
    };
  }

  const ids = [...input.rotationWorkoutIds];
  if (ids.length < 2 || new Set(ids).size !== ids.length) {
    return { valid: false, error: 'Select at least two distinct saved workouts for the rotation.' };
  }
  const workoutsById = new Map(input.savedWorkouts.map(workout => [workout.id, workout]));
  const selectedWorkouts = ids.map(id => workoutsById.get(id));
  if (selectedWorkouts.some(workout => workout === undefined)) {
    return { valid: false, error: 'Every selected rotation workout must be available. Remove unavailable workouts or save them again.' };
  }
  const names = selectedWorkouts.map(workout => workout!.name);
  if (openVersion && previous?.mode === 'rotation'
    && !input.scheduleChanged && versionEquals(openVersion, ids, names, input.advanceMode)) {
    return { valid: true, setting: { ...previous, rotationHistory: history } };
  }

  const activeDraftDate = input.activeDraft?.rhythmId === input.rhythm.id
    ? input.activeDraft.rhythmOccurrence ?? input.asOfDate
    : input.asOfDate;
  const scheduleEffectiveDate = input.scheduleChanged
    ? input.rhythm.scoring?.scheduleHistory.at(-1)?.startDate
    : undefined;
  const notBeforeDate = scheduleEffectiveDate && scheduleEffectiveDate > activeDraftDate
    ? scheduleEffectiveDate
    : activeDraftDate;
  const includeNotBefore = input.activeDraft?.rhythmId !== input.rhythm.id
    || scheduleEffectiveDate !== undefined
      && scheduleEffectiveDate > input.asOfDate
      && scheduleEffectiveDate > activeDraftDate;
  const next = nextScheduledOccurrence(input, notBeforeDate, includeNotBefore);
  if (!('date' in next)) return { valid: false, error: next.error };
  const effectiveFrom = next.date;
  const previousVersion = openVersion ?? history.at(-1);
  const progress = carryRotationIndex(previousVersion, ids, {
    rhythm: input.rhythm,
    date: effectiveFrom,
    workouts: input.workouts,
    savedWorkouts: input.savedWorkouts,
    completions: input.completions,
    ...(input.activeDraft === undefined ? {} : { activeDraft: input.activeDraft })
  });
  if ('error' in progress) return { valid: false, error: progress.error };

  if (openVersion) {
    if (effectiveFrom <= openVersion.effectiveFrom) {
      history[history.length - 1] = {
        effectiveFrom,
        workoutIds: ids,
        workoutNames: names,
        advanceMode: input.advanceMode,
        startIndex: progress.index
      };
    } else {
      history[history.length - 1] = { ...openVersion, effectiveUntil: effectiveFrom };
      history.push({
        effectiveFrom,
        workoutIds: ids,
        workoutNames: names,
        advanceMode: input.advanceMode,
        startIndex: progress.index
      });
    }
  } else {
    history.push({
      effectiveFrom,
      workoutIds: ids,
      workoutNames: names,
      advanceMode: input.advanceMode,
      startIndex: progress.index
    });
  }
  return {
    valid: true,
    setting: {
      rhythmId: input.rhythm.id,
      mode: 'rotation',
      rotationHistory: history
    }
  };
}
