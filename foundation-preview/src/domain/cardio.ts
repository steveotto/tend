import { isValidDate } from './money-goals.ts';
import type { RhythmPreview } from './preview-data.ts';
import { hasRhythmOccurrenceForCompletion } from './rhythm-occurrences.ts';
import { isPeriodBasedRhythmSchedule, rhythmOccurrencePeriod } from './rhythm-occurrences.ts';
import { effectiveRhythmSchedule } from './rhythm-schedule.ts';
import { rhythmSeasonForDate } from './rhythm-seasons.ts';
import type { RhythmSchedule } from './rhythm-schedule.ts';
import {
  deleteDatedCompletion,
  prepareDatedRhythmCompletion
} from './rhythm-completion.ts';
import type {
  ActiveRhythmCompletion,
  DatedRhythmCompletion
} from './rhythm-completion.ts';

export type CardioRun = {
  id: string;
  date: string;
  distance: number;
  notes?: string;
  rhythmId?: string;
  rhythmOccurrence?: string;
  completionId?: string;
};

export type CardioData = {
  goals: unknown;
  runs: unknown[];
  [key: string]: unknown;
};

export type CardioGoalSettings = {
  weeklyRunTarget: number;
  weeklyMileTarget: number;
};

export type CardioDay = {
  date: string;
  count: number;
  miles: number;
};

export type CardioProgress = {
  weekStart: string;
  weekEnd: string;
  runs: number;
  miles: number;
  targetRuns: number | null;
  targetMiles: number | null;
  runProgress: number | null;
  mileageProgress: number | null;
  score: number | null;
  remainingRuns: number | null;
  remainingMiles: number | null;
  days: CardioDay[];
};

export const createCardioData = (): CardioData => ({
  goals: { weeklyRunTarget: null, weeklyMileTarget: null },
  runs: []
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateCardioDataShape(value: unknown): value is CardioData {
  return isRecord(value) && Array.isArray(value.runs);
}

export function cardioGoalSettings(value: unknown): CardioGoalSettings | null {
  if (!isRecord(value)) return null;
  const { weeklyRunTarget, weeklyMileTarget } = value;
  return Number.isInteger(weeklyRunTarget) && Number(weeklyRunTarget) > 0 && Number(weeklyRunTarget) <= 21
    && typeof weeklyMileTarget === 'number' && Number.isFinite(weeklyMileTarget)
    && weeklyMileTarget > 0 && weeklyMileTarget <= 1000
    ? { weeklyRunTarget: Number(weeklyRunTarget), weeklyMileTarget }
    : null;
}

export function cardioGoalIssues(value: unknown): string[] {
  if (!isRecord(value)) return ['Cardio goals are malformed and were preserved.'];
  const { weeklyRunTarget, weeklyMileTarget } = value;
  if (weeklyRunTarget === null && weeklyMileTarget === null) return [];
  if (cardioGoalSettings(value)) return [];
  return ['Cardio goals are incomplete or invalid and were preserved.'];
}

export function validateCardioGoals(value: {
  weeklyRunTarget: number | null;
  weeklyMileTarget: number | null;
}): string | null {
  if (value.weeklyRunTarget === null && value.weeklyMileTarget === null) return null;
  if (value.weeklyRunTarget === null || value.weeklyMileTarget === null) {
    return 'Set both weekly run and mileage targets, or leave both blank.';
  }
  if (!Number.isInteger(value.weeklyRunTarget) || value.weeklyRunTarget < 1 || value.weeklyRunTarget > 21
    || !Number.isFinite(value.weeklyMileTarget) || value.weeklyMileTarget <= 0 || value.weeklyMileTarget > 1000) {
    return 'Enter a positive weekly target within the listed limits.';
  }
  return null;
}

export function saveCardioGoals(
  data: CardioData,
  goals: { weeklyRunTarget: number | null; weeklyMileTarget: number | null }
): CardioData {
  return { ...data, goals: { ...goals } };
}

export function isCardioRun(value: unknown): value is CardioRun {
  return isRecord(value)
    && typeof value.id === 'string' && value.id.trim().length > 0 && value.id.length <= 160
    && typeof value.date === 'string' && isValidDate(value.date)
    && typeof value.distance === 'number' && Number.isFinite(value.distance) && value.distance > 0
    && (value.notes === undefined || typeof value.notes === 'string' && value.notes.length <= 1000)
    && ((value.rhythmId === undefined && value.rhythmOccurrence === undefined && value.completionId === undefined)
      || (typeof value.rhythmId === 'string' && value.rhythmId.length > 0
        && typeof value.rhythmOccurrence === 'string' && value.rhythmOccurrence === value.date
        && typeof value.completionId === 'string' && value.completionId.length > 0));
}

export function validatedCardioRuns(data: CardioData, today: string): {
  records: CardioRun[];
  issues: string[];
} {
  const issues: string[] = [];
  const byId = new Map<string, CardioRun[]>();
  data.runs.forEach((value, index) => {
    if (!isRecord(value)) {
      issues.push(`Run ${index + 1} is malformed and was preserved.`);
      return;
    }
    if (typeof value.date === 'string' && isValidDate(value.date) && value.date > today) {
      issues.push(`Run ${String(value.id || index + 1)} is future-dated and was preserved.`);
      return;
    }
    if (!isCardioRun(value)) {
      issues.push(`Run ${String(value.id || index + 1)} has invalid fields and was preserved.`);
      return;
    }
    const records = byId.get(value.id) ?? [];
    records.push(value);
    byId.set(value.id, records);
  });
  const records = [...byId.values()].flatMap(items => {
    if (items.length > 1) {
      issues.push(`Run ID ${items[0]!.id} is duplicated; its records were preserved but excluded.`);
      return [];
    }
    return items;
  }).sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
  return { records, issues };
}

export function cardioDataIssues(data: CardioData, today: string): string[] {
  return [...cardioGoalIssues(data.goals), ...validatedCardioRuns(data, today).issues];
}

export function selectCardioProgress(data: CardioData, evaluationDate: string): CardioProgress {
  const weekStart = cardioWeekStart(evaluationDate);
  const weekEnd = addDateDays(weekStart, 6);
  const valid = validatedCardioRuns(data, evaluationDate).records;
  const weekRuns = valid.filter(run => run.date >= weekStart && run.date <= evaluationDate);
  const runs = weekRuns.length;
  const miles = weekRuns.reduce((total, run) => total + run.distance, 0);
  const goals = cardioGoalSettings(data.goals);
  const runProgress = goals ? Math.min(100, runs / goals.weeklyRunTarget * 100) : null;
  const mileageProgress = goals ? Math.min(100, miles / goals.weeklyMileTarget * 100) : null;
  const score = runProgress === null || mileageProgress === null
    ? null
    : Math.round(Math.min(runProgress, mileageProgress));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDateDays(weekStart, index);
    const dayRuns = weekRuns.filter(run => run.date === date);
    return { date, count: dayRuns.length, miles: dayRuns.reduce((total, run) => total + run.distance, 0) };
  });
  return {
    weekStart,
    weekEnd,
    runs,
    miles,
    targetRuns: goals?.weeklyRunTarget ?? null,
    targetMiles: goals?.weeklyMileTarget ?? null,
    runProgress,
    mileageProgress,
    score,
    remainingRuns: goals ? Math.max(0, goals.weeklyRunTarget - runs) : null,
    remainingMiles: goals ? Math.max(0, goals.weeklyMileTarget - miles) : null,
    days
  };
}

export function cardioWeekStart(date: string): string {
  if (!isValidDate(date)) return '';
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDateDays(date, -((weekday + 6) % 7));
}

export function addDateDays(date: string, days: number): string {
  if (!isValidDate(date)) return '';
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

export function saveCardioRun(
  data: CardioData,
  run: CardioRun,
  today: string
): { valid: true; data: CardioData } | { valid: false; error: string } {
  if (!isCardioRun(run) || run.date > today) {
    return { valid: false, error: 'Enter a positive distance and a valid activity date that is not in the future.' };
  }
  const matches = data.runs.filter(value => isRecord(value) && value.id === run.id);
  if (matches.length > 1 || matches.length === 1 && !isCardioRun(matches[0])) {
    return { valid: false, error: 'This run ID is already in use.' };
  }
  if (data.runs.some(value => isRecord(value) && value.id !== run.id
    && value.rhythmId === run.rhythmId && value.rhythmOccurrence === run.rhythmOccurrence
    && run.rhythmId !== undefined)) {
    return { valid: false, error: 'A run is already linked to this scheduled Rhythm occurrence.' };
  }
  return {
    valid: true,
    data: {
      ...data,
      runs: matches.length
        ? data.runs.map(value => isRecord(value) && value.id === run.id ? { ...value, ...run } : value)
        : [...data.runs, run]
    }
  };
}

export function deleteCardioRun(data: CardioData, id: string): {
  data: CardioData;
  deleted?: CardioRun;
} {
  const deleted = data.runs.find((run): run is CardioRun => isCardioRun(run) && run.id === id);
  return {
    data: { ...data, runs: deleted ? data.runs.filter(item => item !== deleted) : [...data.runs] },
    ...(deleted ? { deleted } : {})
  };
}

function cardioRhythmScheduleForDate(rhythm: RhythmPreview, date: string): RhythmSchedule | undefined {
  if (rhythm.scoring) {
    const season = rhythmSeasonForDate(rhythm.scoring.scheduleHistory, date);
    return season?.kind === 'scheduled' ? season.schedule : undefined;
  }
  return effectiveRhythmSchedule(rhythm.schedule, rhythm.cadence);
}

export function cardioRhythmOccurrenceError(
  rhythm: RhythmPreview | undefined,
  date: string,
  today: string,
  archivedRhythmIds: ReadonlySet<string>
): string | null {
  if (!rhythm || rhythm.healthLogCapability !== 'cardio' || !rhythm.categoryIds?.includes('health')) {
    return 'Choose a Rhythm explicitly marked for run logging.';
  }
  if (archivedRhythmIds.has(rhythm.id)) return 'Restore this Rhythm before linking a run.';
  if (!isValidDate(date) || date > today) return 'Choose a valid run date that is not in the future.';
  const season = rhythm.scoring
    ? rhythmSeasonForDate(rhythm.scoring.scheduleHistory, date)
    : undefined;
  if (season?.kind === 'unknown') return 'This Rhythm’s schedule for that date is unresolved.';
  const schedule = cardioRhythmScheduleForDate(rhythm, date);
  if (!schedule) return 'This Rhythm’s schedule for that date is unavailable.';
  if (!hasRhythmOccurrenceForCompletion(schedule, date, rhythm.scoring?.trackingStartDate)) {
    return 'This date is not a scheduled occurrence for the selected Rhythm.';
  }
  return null;
}

export type CardioCompletionState = {
  datedRhythmCompletions: DatedRhythmCompletion[];
  activeRhythmCompletions: ActiveRhythmCompletion[];
  completedRhythmIds: string[];
  rhythmHistoryIds: string[];
};

export type CardioSaveResult =
  | { valid: true; cardio: CardioData; completionState: CardioCompletionState }
  | { valid: false; error: string };

export function saveCardioDataCommand(input: {
  previous: CardioData;
  next: CardioData;
  today: string;
  now: Date;
  rhythms: readonly RhythmPreview[];
  archivedRhythmIds: ReadonlySet<string>;
  editableRhythmIds: ReadonlySet<string>;
  completionState: CardioCompletionState;
}): CardioSaveResult {
  if (!validateCardioDataShape(input.next)) {
    return { valid: false, error: 'Cardio goals or runs are malformed. No changes were saved.' };
  }
  const previousRuns = new Map(validatedCardioRuns(input.previous, input.today).records.map(run => [run.id, run]));
  const nextRuns = new Map(validatedCardioRuns(input.next, input.today).records.map(run => [run.id, run]));
  const previousCompletions = new Map(input.completionState.datedRhythmCompletions.map(item => [item.id, item]));
  let datedRhythmCompletions = [...input.completionState.datedRhythmCompletions];
  let activeRhythmCompletions = [...input.completionState.activeRhythmCompletions];
  let completedRhythmIds = [...input.completionState.completedRhythmIds];
  let rhythmHistoryIds = [...input.completionState.rhythmHistoryIds];

  for (const previous of previousRuns.values()) {
    if (!previous.rhythmId || !previous.completionId) continue;
    const next = nextRuns.get(previous.id);
    if (next?.rhythmId === previous.rhythmId && next.completionId === previous.completionId
      && next.date === previous.date) continue;
    const owned = datedRhythmCompletions.find(item =>
      item.id === previous.completionId && item.rhythmId === previous.rhythmId
      && item.effectiveDate === previous.date
    );
    if (!owned) {
      return { valid: false, error: 'The linked completion is missing or no longer belongs to this run. No Cardio changes were saved.' };
    }
    const removed = deleteDatedCompletion(datedRhythmCompletions, activeRhythmCompletions, completedRhythmIds, previous.completionId);
    datedRhythmCompletions = removed.records;
    activeRhythmCompletions = removed.active;
    completedRhythmIds = removed.completedRhythmIds;
  }

  const timeParts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true
  }).formatToParts(input.now);
  const defaultHour = Number(timeParts.find(part => part.type === 'hour')?.value);
  const defaultMinute = Number(timeParts.find(part => part.type === 'minute')?.value);
  const defaultPeriod = timeParts.find(part => part.type === 'dayPeriod')?.value.toUpperCase();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  for (const run of nextRuns.values()) {
    if (!run.rhythmId || !run.completionId) continue;
    const previous = previousRuns.get(run.id);
    const rhythm = input.rhythms.find(item => item.id === run.rhythmId);
    const associationError = cardioRhythmOccurrenceError(rhythm, run.date, input.today, input.archivedRhythmIds);
    if (associationError || !rhythm || !input.editableRhythmIds.has(run.rhythmId)) {
      return { valid: false, error: `${associationError ?? 'The linked Cardio Rhythm is not editable.'} No Cardio changes were saved.` };
    }
    const sameOwnedLink = previous?.rhythmId === run.rhythmId && previous.completionId === run.completionId;
    const liveCompletion = datedRhythmCompletions.find(item => item.id === run.completionId);
    if (liveCompletion && !sameOwnedLink) {
      return { valid: false, error: 'This run references a completion owned by another activity. No Cardio changes were saved.' };
    }
    const previousOwnedCompletion = sameOwnedLink ? previousCompletions.get(run.completionId) : undefined;
    if (sameOwnedLink && !previousOwnedCompletion) {
      return { valid: false, error: 'The linked completion is missing. No Cardio changes were saved.' };
    }
    if (sameOwnedLink && previous?.date === run.date) continue;
    const schedule = cardioRhythmScheduleForDate(rhythm, run.date);
    if (!schedule) {
      return { valid: false, error: 'The linked Rhythm schedule is unavailable for that date. No Cardio changes were saved.' };
    }
    const duplicate = [
      ...(rhythm.completionHistory ?? []),
      ...datedRhythmCompletions.filter(item => item.rhythmId === rhythm.id)
    ].some(item => {
      if (item.id === run.completionId) return false;
      if (isPeriodBasedRhythmSchedule(schedule)) {
        const period = rhythmOccurrencePeriod(schedule, run.date);
        return item.effectiveDate >= period.startDate && item.effectiveDate <= period.endDate;
      }
      return item.effectiveDate === run.date;
    });
    if (duplicate) {
      return { valid: false, error: 'This scheduled Cardio Rhythm occurrence already has completion credit. No Cardio changes were saved.' };
    }

    let hour = defaultHour;
    let minute = defaultMinute;
    let period = defaultPeriod;
    if (previousOwnedCompletion) {
      const [hour24, minutePart] = previousOwnedCompletion.localTime.split(':').map(Number);
      hour = hour24! % 12 || 12;
      minute = minutePart!;
      period = hour24! >= 12 ? 'PM' : 'AM';
    }
    const prepared = prepareDatedRhythmCompletion({
      id: run.completionId,
      rhythmId: run.rhythmId,
      effectiveDate: run.date,
      hour,
      minute,
      period: period === 'PM' ? 'PM' : 'AM',
      memory: previousOwnedCompletion?.memory ?? '',
      timeZone: previousOwnedCompletion?.timeZone ?? timeZone
    }, input.now);
    if (!prepared.valid) {
      return { valid: false, error: prepared.errors.time ?? prepared.errors.effectiveDate ?? 'The linked completion is invalid. No Cardio changes were saved.' };
    }
    datedRhythmCompletions.push(prepared.record);
    if (run.date === input.today) {
      if (!activeRhythmCompletions.some(item => item.rhythmId === run.rhythmId)
        && !completedRhythmIds.includes(run.rhythmId)) {
        activeRhythmCompletions.push({ rhythmId: run.rhythmId, completionId: run.completionId });
        completedRhythmIds.push(run.rhythmId);
      }
    }
    if (!rhythmHistoryIds.includes(run.rhythmId)) rhythmHistoryIds.push(run.rhythmId);
  }

  return {
    valid: true,
    cardio: input.next,
    completionState: { datedRhythmCompletions, activeRhythmCompletions, completedRhythmIds, rhythmHistoryIds }
  };
}
