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

export type WeightUnit = 'lb' | 'kg';
export type WeightMeasurement = {
  id: string;
  date: string;
  weightKg: number;
  notes?: string;
  rhythmId?: string;
  rhythmOccurrence?: string;
  completionId?: string;
};

export type WeightData = {
  displayUnit: unknown;
  goals: unknown;
  weighIns: unknown[];
  [key: string]: unknown;
};

export type WeightGoalDraft = {
  startWeight: string;
  startDate: string;
  targetWeight: string;
  goalDate: string;
  unit: WeightUnit;
};

export type WeightGoalSettings = {
  startWeightKg: number;
  startDate: string;
  targetWeightKg: number;
  goalDate: string;
};

export type WeightProgress = {
  latest: WeightMeasurement | null;
  expectedWeightKg: number | null;
  daysAhead: number | null;
  weightAheadKg: number | null;
  score: number | null;
  status: string;
  goalStatus?: string;
  latestAge: number | null;
  maintenance: boolean;
};

export const poundsToKilograms = (pounds: number): number => pounds * 0.45359237;
export const kilogramsToPounds = (kilograms: number): number => kilograms / 0.45359237;

export function weightValueInUnit(weightKg: number, unit: WeightUnit): number {
  return unit === 'lb' ? kilogramsToPounds(weightKg) : weightKg;
}

export function formatWeight(weightKg: number, unit: WeightUnit): string {
  const value = weightValueInUnit(weightKg, unit);
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

export function createWeightData(): WeightData {
  return {
    displayUnit: 'lb',
    goals: {
      startWeightKg: null,
      startDate: '',
      targetWeightKg: null,
      goalDate: ''
    },
    weighIns: []
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberField(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function validateWeightDataShape(value: unknown): value is WeightData {
  return isRecord(value) && Array.isArray(value.weighIns);
}

export function weightUnit(value: unknown): WeightUnit {
  return value === 'kg' ? 'kg' : 'lb';
}

export function weightGoalSettings(value: unknown): WeightGoalSettings | null {
  if (!isRecord(value)) return null;
  if (!numberField(value.startWeightKg) || !numberField(value.targetWeightKg)
    || typeof value.startDate !== 'string' || typeof value.goalDate !== 'string'
    || !isValidDate(value.startDate) || !isValidDate(value.goalDate)
    || value.goalDate <= value.startDate) return null;
  return {
    startWeightKg: value.startWeightKg,
    startDate: value.startDate,
    targetWeightKg: value.targetWeightKg,
    goalDate: value.goalDate
  };
}

export function weightGoalIssues(value: unknown): string[] {
  if (!isRecord(value)) return ['Weight goal settings are malformed and were preserved.'];
  const values = [value.startWeightKg, value.startDate, value.targetWeightKg, value.goalDate];
  if (values.every(item => item === null || item === '')) return [];
  if (!numberField(value.startWeightKg) || !numberField(value.targetWeightKg)
    || typeof value.startDate !== 'string' || !isValidDate(value.startDate)
    || typeof value.goalDate !== 'string' || !isValidDate(value.goalDate)
    || value.goalDate <= value.startDate) {
    return ['Weight goal settings are incomplete or invalid and were preserved.'];
  }
  return [];
}

export function validateWeightGoalDraft(draft: WeightGoalDraft): {
  valid: boolean;
  goals?: Record<string, unknown>;
  error?: string;
} {
  const values = [draft.startWeight.trim(), draft.startDate.trim(), draft.targetWeight.trim(), draft.goalDate.trim()];
  if (values.every(value => value === '')) {
    return {
      valid: true,
      goals: { startWeightKg: null, startDate: '', targetWeightKg: null, goalDate: '' }
    };
  }
  const startWeight = Number(draft.startWeight);
  const targetWeight = Number(draft.targetWeight);
  if (!draft.startWeight || !draft.targetWeight
    || !Number.isFinite(startWeight) || !Number.isFinite(targetWeight)
    || startWeight <= 0 || targetWeight <= 0
    || !isValidDate(draft.startDate) || !isValidDate(draft.goalDate)) {
    return { valid: false, error: 'Enter positive starting and target weights plus both valid dates, or clear all goal fields.' };
  }
  if (startWeight > 2000 || targetWeight > 2000) {
    return { valid: false, error: 'Weights must be 2,000 or less in the selected unit.' };
  }
  if (draft.goalDate <= draft.startDate) {
    return { valid: false, error: 'Goal date must be after the starting date.' };
  }
  return {
    valid: true,
    goals: {
      startWeightKg: draft.unit === 'lb' ? poundsToKilograms(startWeight) : startWeight,
      startDate: draft.startDate,
      targetWeightKg: draft.unit === 'lb' ? poundsToKilograms(targetWeight) : targetWeight,
      goalDate: draft.goalDate
    }
  };
}

export function validateCanonicalWeightGoals(input: {
  startWeightKg: number | null;
  startDate: string;
  targetWeightKg: number | null;
  goalDate: string;
}): string | null {
  const anyValue = input.startWeightKg !== null || input.targetWeightKg !== null
    || input.startDate !== '' || input.goalDate !== '';
  if (!anyValue) return null;
  if (!numberField(input.startWeightKg) || !numberField(input.targetWeightKg)
    || !isValidDate(input.startDate) || !isValidDate(input.goalDate)) {
    return 'Enter positive starting and target weights plus both valid dates, or clear all goal fields.';
  }
  if (input.goalDate <= input.startDate) return 'Goal date must be after the starting date.';
  return null;
}

export function saveWeightGoals(data: WeightData, goals: Record<string, unknown>, displayUnit: WeightUnit): WeightData {
  return {
    ...data,
    displayUnit,
    goals: { ...(isRecord(data.goals) ? data.goals : {}), ...goals }
  };
}

export function isWeightMeasurement(value: unknown): value is WeightMeasurement {
  return isRecord(value)
    && typeof value.id === 'string' && value.id.trim().length > 0 && value.id.length <= 160
    && typeof value.date === 'string' && isValidDate(value.date)
    && numberField(value.weightKg)
    && (value.notes === undefined || typeof value.notes === 'string' && value.notes.length <= 1000)
    && ((value.rhythmId === undefined && value.rhythmOccurrence === undefined && value.completionId === undefined)
      || (typeof value.rhythmId === 'string' && value.rhythmId.length > 0
        && typeof value.rhythmOccurrence === 'string' && value.rhythmOccurrence === value.date
        && typeof value.completionId === 'string' && value.completionId.length > 0));
}

export function saveWeightMeasurement(
  data: WeightData,
  measurement: WeightMeasurement,
  today: string
): { valid: true; data: WeightData } | { valid: false; error: string } {
  if (!isWeightMeasurement(measurement) || measurement.date > today) {
    return { valid: false, error: 'Enter a positive weight and a valid date that is not in the future.' };
  }
  const matchingIds = data.weighIns.filter((item): item is Record<string, unknown> =>
    isRecord(item) && item.id === measurement.id
  );
  if (matchingIds.length > 1 || matchingIds.length === 1 && !isWeightMeasurement(matchingIds[0])) {
    return { valid: false, error: 'This weigh-in ID is already in use.' };
  }
  const existing = matchingIds[0];
  if (data.weighIns.some(item => isRecord(item) && item.id !== measurement.id
    && item.rhythmId === measurement.rhythmId
    && item.rhythmOccurrence === measurement.rhythmOccurrence
    && measurement.rhythmId !== undefined)) {
    return { valid: false, error: 'A weigh-in is already linked to this scheduled Rhythm occurrence.' };
  }
  return {
    valid: true,
    data: {
      ...data,
      weighIns: existing
        ? data.weighIns.map(item => isRecord(item) && item.id === measurement.id
          ? { ...item, ...measurement }
          : item)
        : [...data.weighIns, measurement]
    }
  };
}

export function deleteWeightMeasurement(data: WeightData, id: string): {
  data: WeightData;
  deleted?: WeightMeasurement;
} {
  const deleted = data.weighIns.find((item): item is WeightMeasurement =>
    isWeightMeasurement(item) && item.id === id
  );
  return {
    data: {
      ...data,
      weighIns: deleted ? data.weighIns.filter(item => item !== deleted) : [...data.weighIns]
    },
    ...(deleted ? { deleted } : {})
  };
}

export function validWeightMeasurements(data: WeightData, today: string): {
  records: WeightMeasurement[];
  issues: string[];
} {
  const issues: string[] = [];
  const validById = new Map<string, WeightMeasurement[]>();
  data.weighIns.forEach((value, index) => {
    if (!isRecord(value)) {
      issues.push(`Weigh-in ${index + 1} is malformed and was preserved.`);
      return;
    }
    if (typeof value.date === 'string' && isValidDate(value.date) && value.date > today) {
      issues.push(`Weigh-in ${String(value.id || index + 1)} is future-dated and was preserved.`);
      return;
    }
    if (!isWeightMeasurement(value)) {
      issues.push(`Weigh-in ${String(value.id || index + 1)} has invalid fields and was preserved.`);
      return;
    }
    const records = validById.get(value.id) ?? [];
    records.push(value);
    validById.set(value.id, records);
  });
  const records = [...validById.values()].flatMap(items => {
    if (items.length > 1) {
      issues.push(`Weigh-in ID ${items[0]!.id} is duplicated; its records were preserved but excluded.`);
      return [];
    }
    return items;
  }).sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
  return { records, issues };
}

export function selectWeightProgress(data: WeightData, today: string): WeightProgress {
  const { records } = validWeightMeasurements(data, today);
  const latest = records.at(-1) ?? null;
  const goals = weightGoalSettings(data.goals);
  if (!latest) {
    if (!goals) return emptyProgress(null, 'Add your first weigh-in');
    const maintenance = goals.startWeightKg === goals.targetWeightKg;
    const elapsed = dateDifference(goals.startDate, today);
    const duration = dateDifference(goals.startDate, goals.goalDate);
    const expectedWeightKg = maintenance
      ? goals.startWeightKg
      : elapsed <= 0
        ? goals.startWeightKg
        : goals.startWeightKg + Math.sign(goals.targetWeightKg - goals.startWeightKg)
          * Math.abs(goals.targetWeightKg - goals.startWeightKg) * Math.max(0, Math.min(1, elapsed / duration));
    const status = maintenance ? 'Maintenance'
      : elapsed < 0 ? `Goal starts ${goals.startDate}`
        : elapsed === 0 ? 'Just started'
          : today > goals.goalDate ? 'Goal date passed' : 'Add your first weigh-in';
    return emptyProgress(null, status, expectedWeightKg, maintenance);
  }
  if (!goals) return emptyProgress(latest, 'Set a starting weight and goal date');
  if (goals.startWeightKg === goals.targetWeightKg) {
    return emptyProgress(latest, 'Maintenance', goals.startWeightKg, true);
  }
  const elapsed = dateDifference(goals.startDate, today);
  const duration = dateDifference(goals.startDate, goals.goalDate);
  const latestAge = Math.max(0, dateDifference(latest.date, today));
  const direction = Math.sign(goals.targetWeightKg - goals.startWeightKg);
  const dailyChange = Math.abs(goals.targetWeightKg - goals.startWeightKg) / duration;
  const expectedWeightKg = goals.startWeightKg + direction * dailyChange * Math.max(0, Math.min(duration, elapsed));
  if (elapsed <= 0) {
    return { ...emptyProgress(latest, elapsed < 0 ? `Goal starts ${goals.startDate}` : 'Just started', expectedWeightKg), latestAge };
  }
  const daysAhead = (latest.weightKg - expectedWeightKg) * direction / dailyChange;
  const daysBehind = Math.max(0, -daysAhead);
  const score = Math.max(0, Math.min(100, 100 - 5 * daysBehind));
  const reached = direction > 0 ? latest.weightKg >= goals.targetWeightKg : latest.weightKg <= goals.targetWeightKg;
  const displayedDays = Math.round(Math.abs(daysAhead) * 10) / 10;
  const status = daysAhead > 0 ? `${displayedDays} ${displayedDays === 1 ? 'day' : 'days'} ahead`
    : daysAhead < 0 ? `${displayedDays} ${displayedDays === 1 ? 'day' : 'days'} behind`
      : "On today's target";
  const goalStatus = today > goals.goalDate
    ? reached ? 'Goal reached' : 'Goal date passed'
    : today === goals.goalDate ? reached ? 'Goal reached' : 'Goal date'
      : undefined;
  return {
    latest, expectedWeightKg, daysAhead, weightAheadKg: Math.abs(daysAhead * dailyChange),
    score, status, ...(goalStatus ? { goalStatus } : {}), latestAge, maintenance: false
  };
}

export function weightDataIssues(data: WeightData, today: string): string[] {
  const measurementIssues = validWeightMeasurements(data, today).issues;
  const goalIssues = weightGoalIssues(data.goals);
  const unitIssues = data.displayUnit === 'lb' || data.displayUnit === 'kg'
    ? []
    : ['The saved Weight display unit is unsupported; values remain preserved.'];
  return [...goalIssues, ...unitIssues, ...measurementIssues];
}

export function weightRhythmOccurrenceError(
  rhythm: RhythmPreview | undefined,
  date: string,
  today: string,
  archivedRhythmIds: ReadonlySet<string>
): string | null {
  if (!rhythm || rhythm.healthLogCapability !== 'weight' || !rhythm.categoryIds?.includes('health')) {
    return 'Choose a Rhythm explicitly marked for weigh-in logging.';
  }
  if (archivedRhythmIds.has(rhythm.id)) return 'Restore this Rhythm before linking a weigh-in.';
  if (!isValidDate(date) || date > today) return 'Choose a valid weigh-in date that is not in the future.';
  const season = rhythm.scoring
    ? rhythmSeasonForDate(rhythm.scoring.scheduleHistory, date)
    : undefined;
  if (season?.kind === 'unknown') return 'This Rhythm’s schedule for that date is unresolved.';
  const schedule = weightRhythmScheduleForDate(rhythm, date);
  if (!schedule) return 'This Rhythm’s schedule for that date is unavailable.';
  if (!hasRhythmOccurrenceForCompletion(schedule, date, rhythm.scoring?.trackingStartDate)) {
    return 'This date is not a scheduled occurrence for the selected Rhythm.';
  }
  return null;
}

export function weightRhythmScheduleForDate(
  rhythm: RhythmPreview | undefined,
  date: string
): RhythmSchedule | undefined {
  if (!rhythm || !isValidDate(date)) return undefined;
  if (rhythm.scoring) {
    const season = rhythmSeasonForDate(rhythm.scoring.scheduleHistory, date);
    return season?.kind === 'scheduled' ? season.schedule : undefined;
  }
  return effectiveRhythmSchedule(rhythm.schedule, rhythm.cadence);
}

export type WeightCompletionState = {
  datedRhythmCompletions: DatedRhythmCompletion[];
  activeRhythmCompletions: ActiveRhythmCompletion[];
  completedRhythmIds: string[];
  rhythmHistoryIds: string[];
};

export type WeightSaveResult =
  | { valid: true; weight: WeightData; completionState: WeightCompletionState }
  | { valid: false; error: string };

export function saveWeightDataCommand(input: {
  previous: WeightData;
  next: WeightData;
  today: string;
  now: Date;
  rhythms: readonly RhythmPreview[];
  archivedRhythmIds: ReadonlySet<string>;
  editableRhythmIds: ReadonlySet<string>;
  completionState: WeightCompletionState;
}): WeightSaveResult {
  if (!validateWeightDataShape(input.next)) {
    return { valid: false, error: 'Weight settings or weigh-ins are malformed. No changes were saved.' };
  }
  const previousLogs = new Map(
    validWeightMeasurements(input.previous, input.today).records.map(log => [log.id, log])
  );
  const nextLogs = new Map(validWeightMeasurements(input.next, input.today).records.map(log => [log.id, log]));
  let datedRhythmCompletions = [...input.completionState.datedRhythmCompletions];
  let activeRhythmCompletions = [...input.completionState.activeRhythmCompletions];
  let completedRhythmIds = [...input.completionState.completedRhythmIds];
  let rhythmHistoryIds = [...input.completionState.rhythmHistoryIds];

  for (const previous of previousLogs.values()) {
    if (!previous.rhythmId || !previous.completionId) continue;
    const next = nextLogs.get(previous.id);
    if (next?.rhythmId === previous.rhythmId && next.completionId === previous.completionId) continue;
    const ownedCompletion = datedRhythmCompletions.find(item =>
      item.id === previous.completionId
      && item.rhythmId === previous.rhythmId
      && item.effectiveDate === previous.date
    );
    if (!ownedCompletion) {
      return {
        valid: false,
        error: 'The linked completion is missing or no longer belongs to this weigh-in. No Weight changes were saved.'
      };
    }
    const removed = deleteDatedCompletion(
      datedRhythmCompletions,
      activeRhythmCompletions,
      completedRhythmIds,
      previous.completionId
    );
    datedRhythmCompletions = removed.records;
    activeRhythmCompletions = removed.active;
    completedRhythmIds = removed.completedRhythmIds;
  }

  const timeParts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).formatToParts(input.now);
  const hour = Number(timeParts.find(part => part.type === 'hour')?.value);
  const minute = Number(timeParts.find(part => part.type === 'minute')?.value);
  const period = timeParts.find(part => part.type === 'dayPeriod')?.value.toUpperCase();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  for (const log of nextLogs.values()) {
    if (!log.rhythmId || !log.completionId) continue;
    const previous = previousLogs.get(log.id);
    const rhythm = input.rhythms.find(item => item.id === log.rhythmId);
    const linkError = weightRhythmOccurrenceError(rhythm, log.date, input.today, input.archivedRhythmIds);
    if (linkError || !rhythm || !input.editableRhythmIds.has(log.rhythmId)) {
      return {
        valid: false,
        error: `${linkError ?? 'The linked Weight Rhythm is not editable.'} No Weight changes were saved.`
      };
    }
    const ownsCompletion = previous?.rhythmId === log.rhythmId
      && previous.completionId === log.completionId;
    const existingCompletion = datedRhythmCompletions.find(item => item.id === log.completionId);
    if (existingCompletion && !ownsCompletion) {
      return {
        valid: false,
        error: 'This weigh-in references a completion owned by another activity. No Weight changes were saved.'
      };
    }
    if (ownsCompletion && !existingCompletion) {
      return { valid: false, error: 'The linked completion is missing. No Weight changes were saved.' };
    }
    if (ownsCompletion && existingCompletion && previous?.date === log.date) continue;

    const schedule = weightRhythmScheduleForDate(rhythm, log.date);
    if (!schedule) {
      return { valid: false, error: 'The linked Rhythm schedule is unavailable for that date. No Weight changes were saved.' };
    }
    const linkedHistory = [
      ...(rhythm.completionHistory ?? []),
      ...datedRhythmCompletions.filter(item => item.rhythmId === rhythm.id)
    ];
    const duplicate = linkedHistory.some(item => {
      if (item.id === log.completionId) return false;
      if (isPeriodBasedRhythmSchedule(schedule)) {
        const periodRange = rhythmOccurrencePeriod(schedule, log.date);
        return item.effectiveDate >= periodRange.startDate && item.effectiveDate <= periodRange.endDate;
      }
      return item.effectiveDate === log.date;
    });
    if (duplicate) {
      return {
        valid: false,
        error: 'This scheduled Weight Rhythm occurrence already has completion credit. No Weight changes were saved.'
      };
    }

    let completionHour = hour;
    let completionMinute = minute;
    let completionPeriod = period;
    if (existingCompletion) {
      const [hour24, minutePart] = existingCompletion.localTime.split(':').map(Number);
      completionHour = hour24! % 12 || 12;
      completionMinute = minutePart!;
      completionPeriod = hour24! >= 12 ? 'PM' : 'AM';
    }
    const completion = prepareDatedRhythmCompletion({
      id: log.completionId,
      rhythmId: log.rhythmId,
      effectiveDate: log.date,
      hour: completionHour,
      minute: completionMinute,
      period: completionPeriod === 'PM' ? 'PM' : 'AM',
      memory: existingCompletion?.memory ?? '',
      timeZone: existingCompletion?.timeZone ?? timeZone
    }, input.now);
    if (!completion.valid) {
      return {
        valid: false,
        error: completion.errors.time ?? completion.errors.effectiveDate
          ?? 'The linked completion time is invalid. No Weight changes were saved.'
      };
    }
    if (existingCompletion) {
      datedRhythmCompletions = datedRhythmCompletions.map(item =>
        item.id === log.completionId ? completion.record : item
      );
    } else {
      datedRhythmCompletions.push(completion.record);
    }

    if (log.date === input.today) {
      const active = activeRhythmCompletions.find(item => item.rhythmId === log.rhythmId);
      if (!active && !completedRhythmIds.includes(log.rhythmId)) {
        activeRhythmCompletions.push({ rhythmId: log.rhythmId, completionId: log.completionId });
        completedRhythmIds.push(log.rhythmId);
      }
    }
    if (!rhythmHistoryIds.includes(log.rhythmId)) rhythmHistoryIds.push(log.rhythmId);
  }

  return {
    valid: true,
    weight: input.next,
    completionState: {
      datedRhythmCompletions,
      activeRhythmCompletions,
      completedRhythmIds,
      rhythmHistoryIds
    }
  };
}

function emptyProgress(
  latest: WeightMeasurement | null,
  status: string,
  expectedWeightKg: number | null = null,
  maintenance = false
): WeightProgress {
  return {
    latest, expectedWeightKg, daysAhead: null, weightAheadKg: null,
    score: null, status, latestAge: latest ? 0 : null, maintenance
  };
}

function dateDifference(from: string, to: string): number {
  return Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}
