import { isValidDate } from './money-goals.ts';
import type { PersonId } from './preview-data.ts';

export const strengthMuscles = [
  { id: 'chest', name: 'Chest', group: 'Upper body', front: true, back: false },
  { id: 'back', name: 'Back', group: 'Upper body', front: false, back: true },
  { id: 'biceps', name: 'Biceps', group: 'Upper body', front: true, back: false },
  { id: 'triceps', name: 'Triceps', group: 'Upper body', front: false, back: true },
  { id: 'shoulders', name: 'Shoulders', group: 'Upper body', front: true, back: true },
  { id: 'abs', name: 'Abs', group: 'Core', front: true, back: false },
  { id: 'quads', name: 'Quads', group: 'Lower body', front: true, back: false },
  { id: 'hamstrings', name: 'Hamstrings', group: 'Lower body', front: false, back: true },
  { id: 'calves', name: 'Calves', group: 'Lower body', front: true, back: true }
] as const;

export type StrengthMuscleId = (typeof strengthMuscles)[number]['id'];
export type StrengthHistoryState = 'trained' | 'never-trained' | 'invalid';
export type StrengthMode = 'recommended' | 'specific' | 'custom';
export type StrengthWorkoutSuggestion = {
  sourceId: string;
  name: string;
  muscleIds: readonly StrengthMuscleId[];
};

export type StrengthSettings = {
  muscleIntervals: Partial<Record<StrengthMuscleId, number>>;
  preferredRestDays: Partial<Record<StrengthMuscleId, number>>;
};

export type StrengthSavedWorkout = {
  id: string;
  name: string;
  muscleIds: StrengthMuscleId[];
  sharedWith: PersonId[];
  invalidMuscleIds?: boolean;
  suggestionSourceId?: string;
};

export const strengthWorkoutSuggestions = [
  { sourceId: 'strength.upper-body', name: 'Upper Body', muscleIds: ['chest', 'back', 'biceps', 'triceps', 'shoulders'] },
  { sourceId: 'strength.lower-body', name: 'Lower Body', muscleIds: ['quads', 'hamstrings', 'calves'] },
  { sourceId: 'strength.arms', name: 'Arms', muscleIds: ['biceps', 'triceps'] },
  { sourceId: 'strength.back-biceps', name: 'Back & Biceps', muscleIds: ['back', 'biceps'] },
  { sourceId: 'strength.chest-triceps', name: 'Chest & Triceps', muscleIds: ['chest', 'triceps'] },
  { sourceId: 'strength.shoulders-quads', name: 'Shoulders & Quads', muscleIds: ['shoulders', 'quads'] },
  { sourceId: 'strength.arms-shoulders', name: 'Arms & Shoulders', muscleIds: ['biceps', 'triceps', 'shoulders'] }
] as const satisfies readonly StrengthWorkoutSuggestion[];

export function strengthMuscleName(id: StrengthMuscleId): string {
  return strengthMuscles.find(muscle => muscle.id === id)!.name;
}

export type StrengthWorkoutLog = {
  id: string;
  date: string;
  muscleIds: StrengthMuscleId[];
  notes?: string;
  savedWorkoutId?: string;
  workoutName?: string;
  rhythmId?: string;
  rhythmOccurrence?: string;
  completionId?: string;
};

export type StrengthRhythmMode = {
  rhythmId: string;
  mode: StrengthMode;
  workoutId?: string;
};

export type StrengthData = {
  settings: StrengthSettings;
  savedWorkouts: StrengthSavedWorkout[];
  workouts: StrengthWorkoutLog[];
  rhythmModes: StrengthRhythmMode[];
};

export type StrengthMuscleScore = {
  id: StrengthMuscleId;
  name: string;
  group: string;
  intervalDays: number | null;
  preferredRestDays: number;
  lastTrained: string | null;
  daysSince: number | null;
  daysUntilDue: number | null;
  restDaysRemaining: number;
  eligible: boolean;
  historyState: StrengthHistoryState;
  score: number | null;
  status: string;
  consistencyStatus: string;
};

export type StrengthWorkoutRecommendation = {
  id: string;
  name: string;
  muscleIds: StrengthMuscleId[];
  muscles: { id: StrengthMuscleId; name: string }[];
  averageNeed: number;
  reason: string;
};

export const defaultStrengthData: StrengthData = {
  settings: {
    muscleIntervals: Object.fromEntries(strengthMuscles.map(muscle => [muscle.id, 7])),
    preferredRestDays: Object.fromEntries(strengthMuscles.map(muscle => [muscle.id, muscle.id === 'abs' ? 0 : 1]))
  },
  savedWorkouts: [],
  workouts: [],
  rhythmModes: []
};

export function createStrengthData(): StrengthData {
  return {
    settings: {
      muscleIntervals: { ...defaultStrengthData.settings.muscleIntervals },
      preferredRestDays: { ...defaultStrengthData.settings.preferredRestDays }
    },
    savedWorkouts: [],
    workouts: [],
    rhythmModes: []
  };
}

export function validateStrengthData(value: unknown): value is StrengthData {
  if (!isRecord(value) || !hasOnlyKeys(value, ['settings', 'savedWorkouts', 'workouts', 'rhythmModes'])
    || !isRecord(value.settings)
    || !hasOnlyKeys(value.settings, ['muscleIntervals', 'preferredRestDays'])
    || !isRecord(value.settings.muscleIntervals)
    || !isRecord(value.settings.preferredRestDays)
    || !Array.isArray(value.savedWorkouts)
    || !Array.isArray(value.workouts)
    || !Array.isArray(value.rhythmModes)) return false;

  for (const [id, interval] of Object.entries(value.settings.muscleIntervals)) {
    if (!isStrengthMuscleId(id) || !Number.isInteger(interval) || Number(interval) < 1 || Number(interval) > 365) return false;
  }
  for (const [id, rest] of Object.entries(value.settings.preferredRestDays)) {
    if (!isStrengthMuscleId(id) || !Number.isInteger(rest)
      || Number(rest) < (id === 'abs' ? 0 : 1) || Number(rest) > 364) return false;
  }
  for (const muscle of strengthMuscles) {
    const interval = value.settings.muscleIntervals[muscle.id];
    const rest = value.settings.preferredRestDays[muscle.id];
    if (typeof interval === 'number' && typeof rest === 'number' && interval <= rest) return false;
  }

  const workoutIds = new Set<string>();
  for (const workout of value.savedWorkouts) {
    if (!isRecord(workout) || !isNonEmptyText(workout.id, 160) || workoutIds.has(workout.id)
      || !isNonEmptyText(workout.name, 120) || !Array.isArray(workout.muscleIds)
      || !workout.muscleIds.every(isStrengthMuscleId) || !Array.isArray(workout.sharedWith)
      || !workout.sharedWith.every(isPersonId)
      || workout.invalidMuscleIds !== undefined && typeof workout.invalidMuscleIds !== 'boolean'
      || workout.suggestionSourceId !== undefined && !isNonEmptyText(workout.suggestionSourceId, 160)) return false;
    workoutIds.add(workout.id);
  }

  const logIds = new Set<string>();
  const linkedCompletionIds = new Set<string>();
  for (const log of value.workouts) {
    if (!isRecord(log) || !hasOnlyKeys(log, [
      'id', 'date', 'muscleIds', 'notes', 'savedWorkoutId', 'workoutName',
      'rhythmId', 'rhythmOccurrence', 'completionId'
    ]) || !isNonEmptyText(log.id, 160) || logIds.has(log.id)
      || typeof log.date !== 'string' || !Array.isArray(log.muscleIds)
      || !log.muscleIds.every(isStrengthMuscleId)
      || !isOptionalText(log.notes, 1000)
      || !isOptionalText(log.savedWorkoutId, 160)
      || !isOptionalText(log.workoutName, 120)
      || !isOptionalText(log.rhythmId, 160)
      || !isOptionalText(log.rhythmOccurrence, 10)
      || !isOptionalText(log.completionId, 160)
      || (log.rhythmId === undefined) !== (log.rhythmOccurrence === undefined)
      || log.rhythmId !== undefined && (!log.completionId || linkedCompletionIds.has(log.completionId)
        || typeof log.rhythmOccurrence !== 'string'
        || !isValidDate(log.rhythmOccurrence) || log.rhythmOccurrence !== log.date)
      || log.completionId !== undefined && !log.rhythmId) return false;
    logIds.add(log.id);
    if (log.completionId) linkedCompletionIds.add(log.completionId);
  }

  const rhythmIds = new Set<string>();
  for (const setting of value.rhythmModes) {
    if (!isRecord(setting) || !hasOnlyKeys(setting, ['rhythmId', 'mode', 'workoutId'])
      || !isNonEmptyText(setting.rhythmId, 160) || rhythmIds.has(setting.rhythmId)
      || !['recommended', 'specific', 'custom'].includes(String(setting.mode))
      || setting.workoutId !== undefined && !isNonEmptyText(setting.workoutId, 160)) return false;
    rhythmIds.add(setting.rhythmId);
  }
  return true;
}

export function validateStrengthSettings(
  settings: StrengthSettings
): Partial<Record<StrengthMuscleId, string>> {
  const errors: Partial<Record<StrengthMuscleId, string>> = {};
  for (const muscle of strengthMuscles) {
    const interval = settings.muscleIntervals[muscle.id];
    const rest = settings.preferredRestDays[muscle.id];
    if (!Number.isInteger(interval) || interval! < 1 || interval! > 365) {
      errors[muscle.id] = 'Enter a whole number from 1 to 365.';
    } else if (!Number.isInteger(rest) || rest! < (muscle.id === 'abs' ? 0 : 1) || rest! > 364) {
      errors[muscle.id] = muscle.id === 'abs' ? 'Enter 0 to 364 rest days.' : 'Enter 1 to 364 rest days.';
    } else if (interval! <= rest!) {
      errors[muscle.id] = 'Training interval must exceed preferred rest days.';
    }
  }
  return errors;
}

export function selectStrengthMuscleScores(
  data: Pick<StrengthData, 'settings' | 'workouts'>,
  evaluationDate: string
): StrengthMuscleScore[] {
  const intervals = data?.settings?.muscleIntervals ?? {};
  const restDays = data?.settings?.preferredRestDays ?? {};
  const workouts = Array.isArray(data?.workouts) ? data.workouts : [];
  return strengthMuscles.map(muscle => {
    const matching = workouts.filter(workout => Array.isArray(workout?.muscleIds)
      && workout.muscleIds.includes(muscle.id));
    const invalidHistory = matching.some(workout => !isValidDate(workout.date));
    const lastTrained = matching
      .filter(workout => isValidDate(workout.date) && workout.date <= evaluationDate)
      .map(workout => workout.date)
      .sort()
      .at(-1) ?? null;
    const rawInterval = Number(intervals[muscle.id]);
    const intervalDays = Number.isInteger(rawInterval) && rawInterval > 0 ? rawInterval : null;
    const rawRest = Number(restDays[muscle.id]);
    const preferredRestDays = Number.isInteger(rawRest) && rawRest >= (muscle.id === 'abs' ? 0 : 1)
      ? rawRest
      : muscle.id === 'abs' ? 0 : 1;
    if (!lastTrained) {
      const status = invalidHistory ? 'Training history unavailable.' : 'Not logged yet.';
      return {
        id: muscle.id, name: muscle.name, group: muscle.group,
        intervalDays, preferredRestDays, lastTrained: null, daysSince: null,
        daysUntilDue: null, restDaysRemaining: 0, eligible: !invalidHistory,
        historyState: invalidHistory ? 'invalid' : 'never-trained', score: null,
        status, consistencyStatus: status
      };
    }

    const daysSince = Math.max(0, fitnessDateDifference(lastTrained, evaluationDate));
    const daysUntilDue = intervalDays === null ? null : intervalDays - daysSince;
    const score = intervalDays === null
      ? null
      : Math.max(0, 100 - 10 * Math.max(0, daysSince - intervalDays));
    const restDaysRemaining = preferredRestDays === 0
      ? 0
      : Math.max(0, preferredRestDays + 1 - daysSince);
    const eligible = restDaysRemaining === 0 && !invalidHistory;
    const consistencyStatus = intervalDays === null
      ? 'Training interval unavailable.'
      : daysUntilDue! > 0
        ? `Due in ${daysUntilDue} ${daysUntilDue === 1 ? 'day.' : 'days.'}`
        : daysUntilDue === 0
          ? 'Due today.'
          : `${Math.abs(daysUntilDue!)} ${Math.abs(daysUntilDue!) === 1 ? 'day' : 'days'} overdue.`;
    const status = invalidHistory
      ? 'Training history unavailable.'
      : !eligible
        ? `Resting · ready in ${restDaysRemaining} ${restDaysRemaining === 1 ? 'day.' : 'days.'}`
        : consistencyStatus;
    return {
      id: muscle.id, name: muscle.name, group: muscle.group,
      intervalDays, preferredRestDays, lastTrained, daysSince, daysUntilDue,
      restDaysRemaining, eligible, historyState: invalidHistory ? 'invalid' : 'trained',
      score, status, consistencyStatus
    };
  });
}

export function selectStrengthScore(scores: readonly StrengthMuscleScore[]): number | null {
  const available = scores.map(item => item.score).filter((score): score is number => Number.isFinite(score));
  return available.length ? Math.round(available.reduce((total, score) => total + score, 0) / available.length) : null;
}

export function rankStrengthWorkouts(
  scores: readonly StrengthMuscleScore[],
  savedWorkouts: readonly StrengthSavedWorkout[]
): StrengthWorkoutRecommendation[] {
  const scoreById = new Map(scores.map(item => [item.id, item]));
  const ranked: (StrengthWorkoutRecommendation & { combination: string })[] = [];
  for (const workout of savedWorkouts) {
    if (!workout || workout.invalidMuscleIds || !workout.id.trim() || !workout.name.trim()
      || !Array.isArray(workout.muscleIds)) continue;
    const muscleIds = [...new Set(workout.muscleIds)];
    if (!muscleIds.length || muscleIds.some(id => !scoreById.has(id))) continue;
    const muscles = muscleIds.map(id => scoreById.get(id)!);
    if (muscles.some(item => item.eligible !== true || item.historyState === 'invalid')) continue;
    const needs = muscles.map(item => item.historyState === 'never-trained'
      || item.lastTrained === null && item.score === null
      ? 100
      : Number.isFinite(item.score) && item.score! >= 0 && item.score! <= 100
        ? 100 - item.score!
        : null);
    if (needs.some(need => need === null)) continue;
    const averageNeed = needs.reduce<number>((total, need) => total + (need ?? 0), 0) / needs.length;
    if (averageNeed <= 0) continue;
    const neverTrained = muscles.filter(item => item.historyState === 'never-trained'
      || item.lastTrained === null && item.score === null).length;
    const countWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const neverText = countWords[neverTrained] ?? String(neverTrained);
    const muscleText = countWords[muscles.length] ?? String(muscles.length);
    const reason = neverTrained
      ? `Targets ${neverText} muscle group${neverTrained === 1 ? '' : 's'} that ${neverTrained === 1 ? "hasn't" : "haven't"} been trained yet.`
      : `Targets ${muscleText} muscle group${muscles.length === 1 ? '' : 's'} with the lowest current consistency.`;
    ranked.push({
      id: workout.id,
      name: workout.name.trim(),
      muscleIds,
      muscles: muscles.map(item => ({ id: item.id, name: item.name })),
      averageNeed,
      reason,
      combination: [...muscleIds].sort().join('|')
    });
  }
  ranked.sort((left, right) => right.averageNeed - left.averageNeed
    || compareText(left.name.toLowerCase(), right.name.toLowerCase())
    || compareText(left.id, right.id));
  const seenIds = new Set<string>();
  const seenCombinations = new Set<string>();
  return ranked.filter(item => {
    if (seenIds.has(item.id) || seenCombinations.has(item.combination)) return false;
    seenIds.add(item.id);
    seenCombinations.add(item.combination);
    return true;
  }).slice(0, 2).map(({ combination: _combination, ...item }) => item);
}

export function createStrengthWorkout(
  savedWorkouts: readonly StrengthSavedWorkout[],
  workout: StrengthSavedWorkout
): { valid: true; workouts: StrengthSavedWorkout[] } | { valid: false; error: string } {
  if (savedWorkouts.some(item => item.id === workout.id)) return { valid: false, error: 'This workout already exists.' };
  if (!validateStrengthWorkout(workout)) return { valid: false, error: 'Choose a name and at least one valid muscle group.' };
  return { valid: true, workouts: [...savedWorkouts, cloneStrengthWorkout(workout)] };
}

export function editStrengthWorkout(
  savedWorkouts: readonly StrengthSavedWorkout[],
  workout: StrengthSavedWorkout
): { valid: true; workouts: StrengthSavedWorkout[] } | { valid: false; error: string } {
  if (!savedWorkouts.some(item => item.id === workout.id)) return { valid: false, error: 'This saved workout is unavailable.' };
  if (!validateStrengthWorkout(workout)) return { valid: false, error: 'Choose a name and at least one valid muscle group.' };
  return { valid: true, workouts: savedWorkouts.map(item => item.id === workout.id ? cloneStrengthWorkout(workout) : item) };
}

export function deleteStrengthWorkout(
  savedWorkouts: readonly StrengthSavedWorkout[],
  id: string
): StrengthSavedWorkout[] {
  return savedWorkouts.filter(workout => workout.id !== id);
}

export function saveStrengthWorkoutLog(
  workouts: readonly StrengthWorkoutLog[],
  log: StrengthWorkoutLog
): { valid: true; workouts: StrengthWorkoutLog[] } | { valid: false; error: string } {
  if (!isNonEmptyText(log.id, 160) || !Array.isArray(log.muscleIds)
    || !log.muscleIds.length || log.muscleIds.some(id => !isStrengthMuscleId(id))
    || !isValidDate(log.date) || log.notes && log.notes.length > 1000
    || log.rhythmId !== undefined && (!isNonEmptyText(log.rhythmId, 160)
      || typeof log.rhythmOccurrence !== 'string'
      || !isValidDate(log.rhythmOccurrence) || log.rhythmOccurrence !== log.date
      || !isNonEmptyText(log.completionId, 160))
    || log.completionId !== undefined && !isNonEmptyText(log.completionId, 160)) {
    return { valid: false, error: 'Enter a valid date and choose at least one muscle group.' };
  }
  const existing = workouts.find(item => item.id === log.id);
  if (workouts.some(item => item.id !== log.id && item.rhythmId === log.rhythmId
    && item.rhythmOccurrence === log.rhythmOccurrence && log.rhythmId !== undefined)) {
    return { valid: false, error: 'A workout is already linked to this scheduled Rhythm occurrence.' };
  }
  return {
    valid: true,
    workouts: existing
      ? workouts.map(item => item.id === log.id ? { ...log, muscleIds: [...log.muscleIds] } : item)
      : [...workouts, { ...log, muscleIds: [...log.muscleIds] }]
  };
}

export function deleteStrengthWorkoutLog(
  workouts: readonly StrengthWorkoutLog[],
  id: string
): { workouts: StrengthWorkoutLog[]; deleted?: StrengthWorkoutLog } {
  const deleted = workouts.find(item => item.id === id);
  return {
    workouts: deleted ? workouts.filter(item => item.id !== id) : [...workouts],
    ...(deleted ? { deleted } : {})
  };
}

function fitnessDateDifference(from: string, to: string): number {
  const fromDay = fitnessDayNumber(from);
  const toDay = fitnessDayNumber(to);
  return fromDay === null || toDay === null ? 0 : toDay - fromDay;
}

function fitnessDayNumber(value: string): number | null {
  if (!isValidDate(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return Math.floor(Date.UTC(year!, month! - 1, day!) / 86_400_000);
}

function validateStrengthWorkout(value: StrengthSavedWorkout): boolean {
  return isNonEmptyText(value.id, 160) && isNonEmptyText(value.name, 120)
    && Array.isArray(value.muscleIds) && value.muscleIds.length > 0
    && value.muscleIds.every(isStrengthMuscleId)
    && Array.isArray(value.sharedWith) && value.sharedWith.every(isPersonId)
    && (value.suggestionSourceId === undefined || isNonEmptyText(value.suggestionSourceId, 160));
}

function cloneStrengthWorkout(workout: StrengthSavedWorkout): StrengthSavedWorkout {
  return { ...workout, muscleIds: [...workout.muscleIds], sharedWith: [...workout.sharedWith] };
}

function isStrengthMuscleId(value: unknown): value is StrengthMuscleId {
  return typeof value === 'string' && strengthMuscles.some(muscle => muscle.id === value);
}

function isPersonId(value: unknown): value is PersonId {
  return value === 'sample-person-avery' || value === 'sample-person-morgan' || value === 'sample-person-jordan';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(record).every(key => allowed.includes(key));
}

function isNonEmptyText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function isOptionalText(value: unknown, maxLength: number): value is string | undefined {
  return value === undefined || typeof value === 'string' && value.length <= maxLength;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
