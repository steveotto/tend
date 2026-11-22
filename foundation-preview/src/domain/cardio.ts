import { isValidDate } from './money-goals.ts';
import type { RhythmPreview } from './preview-data.ts';
import { hasRhythmOccurrenceForCompletion } from './rhythm-occurrences.ts';
import { isPeriodBasedRhythmSchedule, rhythmOccurrencePeriod } from './rhythm-occurrences.ts';
import { blendFitnessHealth } from './fitness-scoring.ts';
import { rhythmScheduleForDate } from './rhythm-schedule.ts';
import { rhythmSeasonForDate } from './rhythm-seasons.ts';
import type { RhythmSchedule } from './rhythm-schedule.ts';
import { validWeightMeasurements } from './weight.ts';
import type { WeightData, WeightMeasurement, WeightUnit } from './weight.ts';
import {
  deleteDatedCompletion,
  prepareDatedRhythmCompletion
} from './rhythm-completion.ts';
import type {
  ActiveRhythmCompletion,
  DatedRhythmCompletion
} from './rhythm-completion.ts';

export type CardioDistanceUnit = 'mi' | 'km';
export type CardioActivityType = 'run' | 'walk';

export type CardioCalorieEstimate =
  | {
    source: 'estimated';
    method: 'distance-weight-v1';
    weightKg: number;
    weightSource: 'weigh-in';
    weightDate: string;
    weightMeasurementId: string;
  }
  | {
    source: 'estimated';
    method: 'distance-weight-v1';
    weightKg: number;
    weightSource: 'manual';
  };

export type CardioEstimateWeightSetting = {
  weightKg: number;
  unit: WeightUnit;
};

export type CardioRun = {
  id: string;
  date: string;
  distance: number;
  activityType?: CardioActivityType;
  distanceUnit?: CardioDistanceUnit;
  durationSeconds?: number;
  calorieEstimate?: CardioCalorieEstimate;
  notes?: string;
  rhythmId?: string;
  rhythmOccurrence?: string;
  completionId?: string;
};

export type CardioActivity = CardioRun;

export function cardioActivityType(activity: CardioActivity): CardioActivityType {
  return activity.activityType ?? 'run';
}

export const MAX_CARDIO_RUN_DURATION_SECONDS = 7 * 24 * 60 * 60;

export function parseCardioRunDuration(
  hoursText: string,
  minutesText: string,
  secondsText: string
): { valid: true; durationSeconds: number | null } | { valid: false; error: string } {
  const parts = [hoursText, minutesText, secondsText] as const;
  if (parts.every(part => !part.trim())) return { valid: true, durationSeconds: null };
  const parsePart = (part: string): number | null => {
    if (!part.trim()) return 0;
    if (!/^\d+$/.test(part.trim())) return null;
    const parsed = Number(part);
    return Number.isSafeInteger(parsed) ? parsed : null;
  };
  const values = [parsePart(hoursText), parsePart(minutesText), parsePart(secondsText)] as const;
  const [hours, minutes, seconds] = values;
  if (hours === null || minutes === null || seconds === null
    || minutes > 59 || seconds > 59) {
    return { valid: false, error: 'Enter a valid duration using whole hours, minutes, and seconds.' };
  }
  const durationSeconds = hours * 3600 + minutes * 60 + seconds;
  if (!Number.isSafeInteger(durationSeconds) || durationSeconds <= 0
    || durationSeconds > MAX_CARDIO_RUN_DURATION_SECONDS) {
    return { valid: false, error: `Duration must be greater than zero and no longer than 7 days.` };
  }
  return { valid: true, durationSeconds };
}

export function cardioDistanceFromMiles(distanceMiles: number, unit: CardioDistanceUnit): number {
  return unit === 'km' ? distanceMiles * 1.609344 : distanceMiles;
}

export function cardioDistanceToMiles(distance: number, unit: CardioDistanceUnit): number {
  return unit === 'km' ? distance / 1.609344 : distance;
}

export function cardioPaceSecondsPerUnit(
  durationSeconds: number | null | undefined,
  distanceInUnit: number
): number | null {
  if (typeof durationSeconds !== 'number' || !Number.isSafeInteger(durationSeconds) || durationSeconds <= 0
    || !Number.isFinite(distanceInUnit) || distanceInUnit <= 0) return null;
  const pace = Math.round(durationSeconds / distanceInUnit);
  return Number.isSafeInteger(pace) && pace > 0 ? pace : null;
}

export function formatCardioPace(secondsPerUnit: number | null, unit: CardioDistanceUnit): string {
  if (secondsPerUnit === null || !Number.isSafeInteger(secondsPerUnit) || secondsPerUnit <= 0) return '—';
  return `${Math.floor(secondsPerUnit / 60)}:${String(secondsPerUnit % 60).padStart(2, '0')}/${unit}`;
}

export function formatCardioWeekRange(weekStart: string, weekEnd: string): string {
  if (!isValidDate(weekStart) || !isValidDate(weekEnd) || weekStart > weekEnd) return '';
  const start = new Date(`${weekStart}T12:00:00Z`);
  const end = new Date(`${weekEnd}T12:00:00Z`);
  const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const monthDayYear = new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
  });
  if (weekStart.slice(0, 4) !== weekEnd.slice(0, 4)) {
    return `${monthDayYear.format(start)} – ${monthDayYear.format(end)}`;
  }
  return `${monthDay.format(start)} – ${monthDay.format(end)}`;
}

export function formatCardioWeekdayRange(weekStart: string, weekEnd: string): string {
  if (!isValidDate(weekStart) || !isValidDate(weekEnd) || weekStart > weekEnd) return '';
  const formatWeekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' });
  return `${formatWeekday.format(new Date(`${weekStart}T12:00:00Z`))} – ${
    formatWeekday.format(new Date(`${weekEnd}T12:00:00Z`))
  }`;
}

export function formatCardioRunDistance(run: CardioRun): string {
  return formatCardioActivityDistance(run);
}

export function formatCardioActivityDistance(activity: CardioActivity): string {
  const unit = activity.distanceUnit ?? 'mi';
  const distance = cardioDistanceFromMiles(activity.distance, unit);
  const formatted = formatCardioNumber(distance);
  const isOne = Number(formatted.replaceAll(',', '')) === 1;
  const label = unit === 'mi'
    ? isOne ? 'mile' : 'miles'
    : isOne ? 'kilometer' : 'kilometers';
  return `${formatted} ${label}`;
}

export function formatCardioRunSummary(run: CardioRun): string {
  return formatCardioActivitySummary(run);
}

export function formatCardioActivitySummary(activity: CardioActivity): string {
  const unit = activity.distanceUnit ?? 'mi';
  const distance = cardioDistanceFromMiles(activity.distance, unit);
  return `${formatCardioNumber(distance)} ${unit === 'mi' ? 'mile' : 'kilometer'} ${cardioActivityType(activity)}`;
}

export function estimateCardioCalories(weightKg: number, distanceMiles: number): number | null {
  if (!Number.isFinite(weightKg) || weightKg <= 0
    || !Number.isFinite(distanceMiles) || distanceMiles <= 0) return null;
  const calories = Math.round(weightKg * distanceMiles * 1.609344);
  return Number.isSafeInteger(calories) && calories > 0 ? calories : null;
}

export function latestCardioWeightOnOrBefore(
  weightData: WeightData,
  runDate: string,
  today = runDate
): WeightMeasurement | null {
  if (!isValidDate(runDate) || !isValidDate(today) || runDate > today) return null;
  return validWeightMeasurements(weightData, today).records
    .filter(measurement => measurement.date <= runDate)
    .at(-1) ?? null;
}

export function cardioCalorieEstimateFromWeighIn(
  measurement: WeightMeasurement
): CardioCalorieEstimate {
  return {
    source: 'estimated',
    method: 'distance-weight-v1',
    weightKg: measurement.weightKg,
    weightSource: 'weigh-in',
    weightDate: measurement.date,
    weightMeasurementId: measurement.id
  };
}

export function cardioRunCalorieEstimate(
  run: CardioRun,
  weightData: WeightData,
  today = run.date
): { estimate: CardioCalorieEstimate; calories: number } | null {
  if (cardioActivityType(run) !== 'run') return null;
  const estimate = run.calorieEstimate
    ?? (() => {
      const measurement = latestCardioWeightOnOrBefore(weightData, run.date, today);
      return measurement ? cardioCalorieEstimateFromWeighIn(measurement) : null;
    })();
  if (!estimate) return null;
  const calories = estimateCardioCalories(estimate.weightKg, run.distance);
  return calories === null ? null : { estimate, calories };
}

export function cardioActivityCalorieEstimate(
  activity: CardioActivity,
  weightData: WeightData,
  today = activity.date
): { estimate: CardioCalorieEstimate; calories: number } | null {
  return cardioRunCalorieEstimate(activity, weightData, today);
}

export type CardioActivityTotals = {
  activityCount: number;
  runCount: number;
  walkCount: number;
  distanceMiles: number;
  durationActivityCount: number;
  /** @deprecated Legacy run-name alias; use durationActivityCount. */
  durationRunCount: number;
  durationSeconds: number | null;
  estimatedRunCount: number;
  estimatedCalories: number | null;
};

export function selectCardioActivityTotals(
  activities: readonly CardioActivity[],
  weightData: WeightData,
  today: string
): CardioActivityTotals {
  const validActivities = activities.filter(isCardioRun).filter(activity => activity.date <= today);
  const runs = validActivities.filter(activity => cardioActivityType(activity) === 'run');
  const walks = validActivities.filter(activity => cardioActivityType(activity) === 'walk');
  const durations = validActivities.flatMap(activity =>
    activity.durationSeconds === undefined ? [] : [activity.durationSeconds]
  );
  const estimates = runs.flatMap(run => {
    const estimate = cardioRunCalorieEstimate(run, weightData, today);
    return estimate ? [estimate.calories] : [];
  });
  return {
    activityCount: validActivities.length,
    runCount: runs.length,
    walkCount: walks.length,
    distanceMiles: validActivities.reduce((total, activity) => total + activity.distance, 0),
    durationActivityCount: durations.length,
    durationRunCount: durations.length,
    durationSeconds: durations.length ? durations.reduce((total, duration) => total + duration, 0) : null,
    estimatedRunCount: estimates.length,
    estimatedCalories: estimates.length ? estimates.reduce((total, calories) => total + calories, 0) : null
  };
}

export type CardioRunTotals = CardioActivityTotals;

export function selectCardioRunTotals(
  runs: readonly CardioRun[],
  weightData: WeightData,
  today: string
): CardioActivityTotals {
  return selectCardioActivityTotals(runs, weightData, today);
}

export type CardioActivityComparisons = {
  previousActivity: CardioActivity | null;
  similarDistanceActivity: CardioActivity | null;
  paceReferenceActivity: CardioActivity | null;
  distanceDelta: number | null;
  paceImprovementSeconds: number | null;
  calorieDelta: number | null;
  /** @deprecated Legacy run-name alias; use the activity fields. */
  previousRun: CardioActivity | null;
  /** @deprecated Legacy run-name alias; use the activity fields. */
  similarDistanceRun: CardioActivity | null;
  /** @deprecated Legacy run-name alias; use the activity fields. */
  paceReferenceRun: CardioActivity | null;
};

export type CardioRunComparisons = CardioActivityComparisons;

export function selectCardioActivityComparisons(
  activities: readonly CardioActivity[],
  activity: CardioActivity,
  weightData: WeightData,
  today = activity.date,
  similarDistanceTolerance = 0.05
): CardioActivityComparisons {
  if (!Number.isFinite(similarDistanceTolerance) || similarDistanceTolerance < 0
    || similarDistanceTolerance > 1) {
    return {
      previousActivity: null,
      similarDistanceActivity: null,
      paceReferenceActivity: null,
      distanceDelta: null,
      paceImprovementSeconds: null,
      calorieDelta: null,
      previousRun: null,
      similarDistanceRun: null,
      paceReferenceRun: null
    };
  }
  const ordered = [...activities]
    .filter(isCardioRun)
    .filter(candidate => cardioActivityType(candidate) === cardioActivityType(activity))
    .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
  const currentIndex = ordered.findIndex(item => item.id === activity.id);
  if (currentIndex < 0) {
    return {
      previousActivity: null,
      similarDistanceActivity: null,
      paceReferenceActivity: null,
      distanceDelta: null,
      paceImprovementSeconds: null,
      calorieDelta: null,
      previousRun: null,
      similarDistanceRun: null,
      paceReferenceRun: null
    };
  }
  const earlierActivities = ordered.slice(0, currentIndex).filter(item => item.date < activity.date);
  const previousActivity = earlierActivities.at(-1) ?? null;
  const similarDistanceActivity = earlierActivities.filter(candidate =>
    candidate.durationSeconds !== undefined
      && Math.abs(candidate.distance - activity.distance) / activity.distance <= similarDistanceTolerance
  ).at(-1) ?? null;
  const paceReferenceActivity = similarDistanceActivity;
  const unit = activity.distanceUnit ?? 'mi';
  const currentPace = cardioPaceSecondsPerUnit(
    activity.durationSeconds,
    cardioDistanceFromMiles(activity.distance, unit)
  );
  const referencePace = paceReferenceActivity
    ? cardioPaceSecondsPerUnit(
      paceReferenceActivity.durationSeconds,
      cardioDistanceFromMiles(paceReferenceActivity.distance, unit)
    )
    : null;
  const currentCalories = cardioRunCalorieEstimate(activity, weightData, today)?.calories ?? null;
  const previousCalories = previousActivity
    ? cardioRunCalorieEstimate(previousActivity, weightData, today)?.calories ?? null
    : null;
  return {
    previousActivity,
    similarDistanceActivity,
    paceReferenceActivity,
    distanceDelta: previousActivity
      ? (activity.distance - previousActivity.distance) * (unit === 'km' ? 1.609344 : 1)
      : null,
    paceImprovementSeconds: currentPace !== null && referencePace !== null
      ? referencePace - currentPace
      : null,
    calorieDelta: currentCalories !== null && previousCalories !== null
      ? currentCalories - previousCalories
      : null,
    previousRun: previousActivity,
    similarDistanceRun: similarDistanceActivity,
    paceReferenceRun: paceReferenceActivity
  };
}

export function selectCardioRunComparisons(
  runs: readonly CardioRun[],
  run: CardioRun,
  weightData: WeightData,
  today = run.date,
  similarDistanceTolerance = 0.05
): CardioRunComparisons {
  return selectCardioActivityComparisons(runs, run, weightData, today, similarDistanceTolerance);
}

export type CardioData = {
  goals: unknown;
  runs: unknown[];
  trackingStartDate?: string;
  targetHistory?: CardioTargetVersion[];
  estimateWeight?: unknown;
  [key: string]: unknown;
};

export type CardioTargetVersion = {
  effectiveDate: string;
  weeklyRunTarget: number | null;
  weeklyMileTarget: number | null;
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
  consistency: number | null;
  health: number | null;
  eligibleConsistencyWeeks: number;
  consistencyUnavailableReason: string | null;
  remainingRuns: number | null;
  remainingMiles: number | null;
  days: CardioDay[];
};

export const createCardioData = (): CardioData => ({
  goals: { weeklyRunTarget: null, weeklyMileTarget: null },
  runs: [],
  targetHistory: [],
  estimateWeight: null
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCardioCalorieEstimate(value: unknown): value is CardioCalorieEstimate {
  if (!isRecord(value) || value.source !== 'estimated'
    || value.method !== 'distance-weight-v1'
    || typeof value.weightKg !== 'number' || !Number.isFinite(value.weightKg) || value.weightKg <= 0) return false;
  if (value.weightSource === 'manual') {
    return Object.keys(value).every(key =>
      ['source', 'method', 'weightKg', 'weightSource'].includes(key)
    );
  }
  return value.weightSource === 'weigh-in'
    && typeof value.weightDate === 'string' && isValidDate(value.weightDate)
    && typeof value.weightMeasurementId === 'string'
    && value.weightMeasurementId.trim().length > 0
    && value.weightMeasurementId.length <= 160
    && Object.keys(value).every(key =>
      ['source', 'method', 'weightKg', 'weightSource', 'weightDate', 'weightMeasurementId'].includes(key)
    );
}

export function migrateCardioDataToV28(value: CardioData): CardioData {
  return {
    ...value,
    targetHistory: Array.isArray(value.targetHistory) ? value.targetHistory : []
  };
}

export function migrateCardioDataToV52(value: CardioData, weight: WeightData): CardioData {
  return {
    ...value,
    runs: value.runs.map(item => {
      if (!isCardioRun(item) || cardioActivityType(item) !== 'run'
        || item.calorieEstimate !== undefined) return item;
      const measurement = latestCardioWeightOnOrBefore(weight, item.date);
      return measurement
        ? { ...item, calorieEstimate: cardioCalorieEstimateFromWeighIn(measurement) }
        : item;
    })
  };
}

export function validateCardioDataShape(value: unknown, requireV28 = false): value is CardioData {
  if (!isRecord(value) || !Array.isArray(value.runs)
    || requireV28 && !Array.isArray(value.targetHistory)
    || value.estimateWeight !== undefined
      && value.estimateWeight !== null
      && !cardioEstimateWeightSetting(value.estimateWeight)
    || value.trackingStartDate !== undefined
      && (typeof value.trackingStartDate !== 'string' || !isValidDate(value.trackingStartDate))
    || value.targetHistory !== undefined
      && !validateCardioTargetHistory(value.targetHistory, value.trackingStartDate)) return false;
  return true;
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

export function cardioEstimateWeightSetting(value: unknown): CardioEstimateWeightSetting | null {
  if (!isRecord(value)
    || typeof value.weightKg !== 'number'
    || !Number.isFinite(value.weightKg)
    || value.weightKg <= 0
    || (value.unit !== 'lb' && value.unit !== 'kg')) return null;
  return { weightKg: value.weightKg, unit: value.unit };
}

export function cardioEstimateWeightIssues(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  return cardioEstimateWeightSetting(value)
    ? []
    : ['Cardio calorie estimate weight is incomplete or invalid and was preserved.'];
}

export function saveCardioEstimateWeight(
  data: CardioData,
  setting: CardioEstimateWeightSetting | null
): CardioData {
  if (setting === null) {
    const { estimateWeight, ...preserved } = data;
    void estimateWeight;
    return preserved;
  }
  return { ...data, estimateWeight: { weightKg: setting.weightKg, unit: setting.unit } };
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

export function parseCardioGoalInput(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function stepCardioGoalInput(
  value: string,
  direction: -1 | 1,
  field: 'runs' | 'miles'
): string {
  const minimum = field === 'runs' ? 1 : 0.1;
  const maximum = field === 'runs' ? 21 : 1000;
  const step = field === 'runs' ? 1 : 0.1;
  if (!value.trim()) return direction > 0 ? String(minimum) : '';
  const current = Number(value);
  if (!Number.isFinite(current)) return value;
  const next = Math.min(maximum, Math.max(minimum, current + direction * step));
  return field === 'runs' ? String(Math.trunc(next)) : String(Number(next.toFixed(10)));
}

export function saveCardioGoals(
  data: CardioData,
  goals: { weeklyRunTarget: number | null; weeklyMileTarget: number | null },
  today: string,
  trackingStartDate = today
): CardioData {
  if (!isValidDate(today) || !isValidDate(trackingStartDate) || trackingStartDate > today) return data;
  const history = data.targetHistory ?? [];
  if (!data.trackingStartDate) {
    if (goals.weeklyRunTarget === null && goals.weeklyMileTarget === null) {
      return { ...data, goals: { ...goals }, targetHistory: [] };
    }
    return {
      ...data,
      goals: { ...goals },
      trackingStartDate,
      targetHistory: [{ effectiveDate: trackingStartDate, ...goals }]
    };
  }
  const effectiveDate = addDateDays(cardioWeekStart(today), 7);
  const currentTargets = data.trackingStartDate
    ? cardioTargetsForDate(data, today)
    : cardioGoalSettings(data.goals);
  const retained = history.filter(version => version.effectiveDate < effectiveDate);
  const sameAsCurrent = currentTargets?.weeklyRunTarget === goals.weeklyRunTarget
    && currentTargets?.weeklyMileTarget === goals.weeklyMileTarget;
  return {
    ...data,
    targetHistory: sameAsCurrent ? retained : [...retained, { effectiveDate, ...goals }]
  };
}

export function isCardioRun(value: unknown): value is CardioRun {
  return isRecord(value)
    && typeof value.id === 'string' && value.id.trim().length > 0 && value.id.length <= 160
    && typeof value.date === 'string' && isValidDate(value.date)
    && typeof value.distance === 'number' && Number.isFinite(value.distance) && value.distance > 0
    && (value.activityType === undefined || value.activityType === 'run' || value.activityType === 'walk')
    && (value.distanceUnit === undefined || value.distanceUnit === 'mi' || value.distanceUnit === 'km')
    && (value.durationSeconds === undefined
      || typeof value.durationSeconds === 'number'
        && Number.isSafeInteger(value.durationSeconds) && value.durationSeconds > 0
        && value.durationSeconds <= MAX_CARDIO_RUN_DURATION_SECONDS)
    && (value.calorieEstimate === undefined
      || isCardioCalorieEstimate(value.calorieEstimate)
        && (value.calorieEstimate.weightSource !== 'weigh-in'
          || value.calorieEstimate.weightDate <= value.date))
    && (value.notes === undefined || typeof value.notes === 'string' && value.notes.length <= 1000)
    && ((value.rhythmId === undefined && value.rhythmOccurrence === undefined && value.completionId === undefined)
      || (typeof value.rhythmId === 'string' && value.rhythmId.length > 0
        && typeof value.rhythmOccurrence === 'string' && value.rhythmOccurrence === value.date
        && typeof value.completionId === 'string' && value.completionId.length > 0));
}

export function isCardioActivity(value: unknown): value is CardioActivity {
  return isCardioRun(value);
}

export function validatedCardioRuns(data: CardioData, today: string): {
  records: CardioRun[];
  issues: string[];
} {
  const issues: string[] = [];
  const byId = new Map<string, CardioRun[]>();
  data.runs.forEach((value, index) => {
    if (!isRecord(value)) {
      issues.push(`Activity ${index + 1} is malformed and was preserved.`);
      return;
    }
    if (typeof value.date === 'string' && isValidDate(value.date) && value.date > today) {
      issues.push(`Activity ${String(value.id || index + 1)} is future-dated and was preserved.`);
      return;
    }
    if (!isCardioRun(value)) {
      issues.push(`Activity ${String(value.id || index + 1)} has invalid fields and was preserved.`);
      return;
    }
    const records = byId.get(value.id) ?? [];
    records.push(value);
    byId.set(value.id, records);
  });
  const records = [...byId.values()].flatMap(items => {
    if (items.length > 1) {
      issues.push(`Activity ID ${items[0]!.id} is duplicated; its records were preserved but excluded.`);
      return [];
    }
    return items;
  }).sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
  return { records, issues };
}

export function validatedCardioActivities(data: CardioData, today: string): {
  records: CardioActivity[];
  issues: string[];
} {
  return validatedCardioRuns(data, today);
}

export function cardioDataIssues(data: CardioData, today: string): string[] {
  return [
    ...cardioGoalIssues(data.goals),
    ...cardioEstimateWeightIssues(data.estimateWeight),
    ...validatedCardioRuns(data, today).issues
  ];
}

export function selectCardioProgress(data: CardioData, evaluationDate: string): CardioProgress {
  const weekStart = cardioWeekStart(evaluationDate);
  const weekEnd = addDateDays(weekStart, 6);
  const validRuns = validatedCardioRuns(data, evaluationDate).records
    .filter(activity => cardioActivityType(activity) === 'run');
  const weekRuns = validRuns.filter(run => run.date >= weekStart && run.date <= evaluationDate);
  const runs = weekRuns.length;
  const miles = weekRuns.reduce((total, run) => total + run.distance, 0);
  const goals = data.trackingStartDate
    ? cardioTargetsForDate(data, evaluationDate)
    : cardioGoalSettings(data.goals);
  const runProgress = goals ? Math.min(100, runs / goals.weeklyRunTarget * 100) : null;
  const mileageProgress = goals ? Math.min(100, miles / goals.weeklyMileTarget * 100) : null;
  const onTrack = runProgress === null || mileageProgress === null
    ? null
    : Math.min(runProgress, mileageProgress);
  const consistency = selectCardioConsistency(data, validRuns, evaluationDate);
  const health = blendFitnessHealth(consistency.score, onTrack).health;
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
    score: onTrack,
    consistency: consistency.score,
    health,
    eligibleConsistencyWeeks: consistency.eligibleWeeks,
    consistencyUnavailableReason: consistency.reason,
    remainingRuns: goals ? Math.max(0, goals.weeklyRunTarget - runs) : null,
    remainingMiles: goals ? Math.max(0, goals.weeklyMileTarget - miles) : null,
    days
  };
}

export function selectCardioConsistency(
  data: CardioData,
  runs: readonly CardioRun[],
  evaluationDate: string
): { score: number | null; eligibleWeeks: number; reason: string | null } {
  if (!data.trackingStartDate || !isValidDate(data.trackingStartDate)) {
    return { score: null, eligibleWeeks: 0, reason: 'Set an explicit Cardio tracking start date and save weekly goals.' };
  }
  const runRecords = runs.filter(isCardioRun)
    .filter(activity => cardioActivityType(activity) === 'run');
  const currentWeekStart = cardioWeekStart(evaluationDate);
  const weeks: { start: string; end: string }[] = Array.from({ length: 4 }, (_, index) => {
    const start = addDateDays(currentWeekStart, -7 * (index + 1));
    return { start, end: addDateDays(start, 6) };
  }).reverse();
  const results: number[] = [];
  for (const week of weeks) {
    if (week.start < data.trackingStartDate || week.end > evaluationDate) continue;
    const targets = cardioTargetsForWeek(data, week.start, week.end);
    if (!targets || !cardioGoalSettings(targets)) continue;
    const weekRuns = runRecords.filter(run => run.date >= week.start && run.date <= week.end);
    const runProgress = Math.min(100, weekRuns.length / targets.weeklyRunTarget! * 100);
    const distance = weekRuns.reduce((total, run) => total + run.distance, 0);
    const distanceProgress = Math.min(100, distance / targets.weeklyMileTarget! * 100);
    results.push(Math.min(runProgress, distanceProgress));
  }
  return results.length
    ? { score: results.reduce((sum, score) => sum + score, 0) / results.length, eligibleWeeks: results.length, reason: null }
    : {
        score: null,
        eligibleWeeks: 0,
        reason: 'No completed week in the four-week lookback has full tracking and trustworthy targets.'
      };
}

export function cardioTargetsForDate(data: CardioData, date: string): CardioGoalSettings | null {
  const latest = (data.targetHistory ?? []).filter(version => version.effectiveDate <= date).at(-1);
  if (latest) return cardioGoalSettings(latest);
  return data.trackingStartDate ? null : cardioGoalSettings(data.goals);
}

function cardioTargetsForWeek(
  data: CardioData,
  start: string,
  end: string
): CardioTargetVersion | null {
  const history = data.targetHistory ?? [];
  const targets = history.filter(version => version.effectiveDate <= start).at(-1);
  if (!targets) return null;
  if (history.some(version => version.effectiveDate > start && version.effectiveDate <= end)) return null;
  return targets;
}

function validateCardioTargetHistory(value: unknown, trackingStartDate: unknown): value is CardioTargetVersion[] {
  if (!Array.isArray(value)) return false;
  if (trackingStartDate === undefined) return value.length === 0;
  if (typeof trackingStartDate !== 'string' || !isValidDate(trackingStartDate)
    || value.length === 0 || !isRecord(value[0]) || value[0].effectiveDate !== trackingStartDate) return false;
  let previousDate = '';
  for (const item of value) {
    if (!isRecord(item) || Object.keys(item).some(key =>
      !['effectiveDate', 'weeklyRunTarget', 'weeklyMileTarget'].includes(key))
      || typeof item.effectiveDate !== 'string' || !isValidDate(item.effectiveDate)
      || item.effectiveDate <= previousDate
      || typeof item.weeklyRunTarget !== 'number' && item.weeklyRunTarget !== null
      || typeof item.weeklyMileTarget !== 'number' && item.weeklyMileTarget !== null
      || (item.weeklyRunTarget === null) !== (item.weeklyMileTarget === null)
      || item.weeklyRunTarget !== null && !cardioGoalSettings(item)) return false;
    previousDate = item.effectiveDate;
  }
  return true;
}

function formatCardioNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
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
  return saveCardioActivity(data, {
    ...run,
    activityType: run.activityType ?? 'run'
  }, today);
}

export function saveCardioActivity(
  data: CardioData,
  activity: CardioActivity,
  today: string
): { valid: true; data: CardioData } | { valid: false; error: string } {
  if (!isCardioRun(activity) || activity.activityType === undefined || activity.date > today) {
    return { valid: false, error: 'Choose Run or Walk, enter a positive distance, and choose a valid activity date that is not in the future.' };
  }
  if (cardioActivityType(activity) === 'walk'
    && (activity.rhythmId !== undefined || activity.rhythmOccurrence !== undefined || activity.completionId !== undefined)) {
    return { valid: false, error: 'Only Runs can be linked to a Cardio Rhythm. No changes were saved.' };
  }
  const matches = data.runs.filter(value => isRecord(value) && value.id === activity.id);
  if (matches.length > 1 || matches.length === 1 && !isCardioRun(matches[0])) {
    return { valid: false, error: 'This activity ID is already in use.' };
  }
  if (data.runs.some(value => isRecord(value) && value.id !== activity.id
    && value.rhythmId === activity.rhythmId && value.rhythmOccurrence === activity.rhythmOccurrence
    && activity.rhythmId !== undefined)) {
    return { valid: false, error: 'An activity is already linked to this scheduled Rhythm occurrence.' };
  }
  return {
    valid: true,
    data: {
      ...data,
      runs: matches.length
        ? data.runs.map(value => {
            if (!isRecord(value) || value.id !== activity.id) return value;
            const updated: Record<string, unknown> = { ...value, ...activity };
            for (const key of [
              'activityType', 'distanceUnit', 'durationSeconds', 'calorieEstimate', 'notes',
              'rhythmId', 'rhythmOccurrence', 'completionId'
            ] as const) {
              if (!Object.hasOwn(activity, key)) delete updated[key];
            }
            return updated;
          })
        : [...data.runs, activity]
    }
  };
}

export function deleteCardioActivity(data: CardioData, id: string): {
  data: CardioData;
  deleted?: CardioActivity;
} {
  const deleted = data.runs.find((activity): activity is CardioActivity =>
    isCardioRun(activity) && activity.id === id
  );
  return {
    data: { ...data, runs: deleted ? data.runs.filter(item => item !== deleted) : [...data.runs] },
    ...(deleted ? { deleted } : {})
  };
}

export function deleteCardioRun(data: CardioData, id: string): {
  data: CardioData;
  deleted?: CardioRun;
} {
  return deleteCardioActivity(data, id);
}

function cardioRhythmScheduleForDate(rhythm: RhythmPreview, date: string): RhythmSchedule | undefined {
  return rhythmScheduleForDate(rhythm, date);
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
  if (!validateCardioDataShape(input.next, true)) {
    return { valid: false, error: 'Cardio goals or activities are malformed. No changes were saved.' };
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
    if (cardioActivityType(run) !== 'run'
      && (run.rhythmId !== undefined || run.rhythmOccurrence !== undefined || run.completionId !== undefined)) {
      return { valid: false, error: 'Only Runs can be linked to a Cardio Rhythm. No Cardio changes were saved.' };
    }
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
