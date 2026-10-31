import { isValidDate } from './money-goals.ts';
import type { PersonId } from './preview-data.ts';
import { blendFitnessHealth } from './fitness-scoring.ts';

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
export type StrengthLoadMeaning = 'total' | 'per-dumbbell' | 'per-side' | 'bodyweight';
export type StrengthWorkoutSuggestionExercise = {
  name: string;
  muscleIds: readonly StrengthMuscleId[];
  equipment: string;
  loadMeaning?: StrengthLoadMeaning;
  notes?: string;
  sets: readonly ({ targetReps: number } | { targetDurationSeconds: number })[];
};
export type StrengthSupersetGroup = {
  id: string;
  exerciseIds: [string, string];
  restDurationSeconds: number;
  restDurationOverridden?: boolean;
};
export type StrengthWorkoutSuggestion = {
  sourceId: string;
  name: string;
  muscleIds: readonly StrengthMuscleId[];
  exercises: readonly StrengthWorkoutSuggestionExercise[];
  supersetExerciseIndexes?: readonly [number, number];
};

export type StrengthSettings = {
  muscleIntervals: Partial<Record<StrengthMuscleId, number>>;
  preferredRestDays: Partial<Record<StrengthMuscleId, number>>;
  betweenSetRestSeconds: Partial<Record<StrengthMuscleId, number>>;
  weightUnit: 'lb' | 'kg';
};

export type StrengthScoringSettingsVersion = {
  effectiveDate: string;
  muscleIntervals: Record<StrengthMuscleId, number>;
  preferredRestDays: Record<StrengthMuscleId, number>;
};

export type StrengthSavedWorkout = {
  id: string;
  name: string;
  muscleIds: StrengthMuscleId[];
  sharedWith: PersonId[];
  invalidMuscleIds?: boolean;
  suggestionSourceId?: string;
  exercises?: StrengthWorkoutExercise[];
  supersetGroups?: StrengthSupersetGroup[];
};

export type StrengthSetMeasurement =
  | { kind: 'reps' }
  | { kind: 'duration'; targetDurationSeconds: number };

export type StrengthLoad =
  | { kind: 'bodyweight' }
  | {
      kind: 'external';
      meaning: 'total' | 'per-dumbbell' | 'per-side';
      value: number;
      unit: 'lb' | 'kg';
    };

export type StrengthPlannedSet = {
  id: string;
  measurement?: StrengthSetMeasurement;
  targetReps?: number;
  targetLoad?: StrengthLoad;
};

export type StrengthWorkoutExercise = {
  id: string;
  name: string;
  muscleIds: StrengthMuscleId[];
  equipment: string;
  loadMeaning?: StrengthLoadMeaning;
  notes?: string;
  restDurationSeconds: number;
  restDurationOverridden?: boolean;
  sets: StrengthPlannedSet[];
};

export type StrengthSetPerformance =
  | { status: 'pending' }
  | { status: 'skipped' }
  | {
      status: 'performed';
      actualReps?: number;
      actualDurationSeconds?: number;
      actualLoad?: StrengthLoad;
      confirmedAt: string;
    };

export type StrengthWorkoutSetSnapshot = StrengthPlannedSet & StrengthSetPerformance;

export type StrengthWorkoutExerciseSnapshot = Omit<StrengthWorkoutExercise, 'sets'> & {
  sets: StrengthWorkoutSetSnapshot[];
};

export type StrengthSessionRestTimer =
  | { status: 'idle'; durationSeconds: number }
  | { status: 'running'; durationSeconds: number; deadlineAt: string }
  | { status: 'paused'; durationSeconds: number; remainingMilliseconds: number }
  | { status: 'complete'; durationSeconds: number };

export type StrengthExerciseTimer =
  | { status: 'idle'; elapsedMilliseconds: 0 }
  | { status: 'running'; elapsedMilliseconds: number; startedAt: string; exerciseId: string; setId: string }
  | { status: 'paused'; elapsedMilliseconds: number; exerciseId: string; setId: string };

export type StrengthGuidedSessionDraft = {
  id: string;
  templateId: string;
  workoutName: string;
  date: string;
  startedAt: string;
  timeZone: string;
  muscleIds: StrengthMuscleId[];
  sharedWith: PersonId[];
  currentExerciseIndex: number;
  currentSetId: string;
  autoStartRest?: boolean;
  restTimer?: StrengthSessionRestTimer;
  notes?: string;
  rhythmId?: string;
  rhythmOccurrence?: string;
  completionId?: string;
  supersetGroups?: StrengthSupersetGroup[];
  exerciseTimer?: StrengthExerciseTimer;
  exercises: StrengthWorkoutExerciseSnapshot[];
};

function suggestedExercise(
  name: string,
  muscleIds: readonly StrengthMuscleId[],
  equipment: string,
  reps: readonly number[],
  notes?: string,
  loadMeaning?: StrengthLoadMeaning
): StrengthWorkoutSuggestionExercise {
  return {
    name,
    muscleIds,
    equipment,
    ...(loadMeaning ? { loadMeaning } : {}),
    ...(notes ? { notes } : {}),
    sets: reps.map(targetReps => ({ targetReps }))
  };
}

function suggestedSets(count: number, reps: number): number[] {
  return Array.from({ length: count }, () => reps);
}

export const defaultStrengthBetweenSetRestSeconds: Readonly<Record<StrengthMuscleId, number>> = {
  chest: 180,
  back: 180,
  quads: 180,
  hamstrings: 180,
  biceps: 120,
  triceps: 120,
  shoulders: 120,
  abs: 120,
  calves: 120
};

export function resolveStrengthBetweenSetRestSeconds(
  muscleIds: readonly StrengthMuscleId[],
  settings: Pick<StrengthSettings, 'betweenSetRestSeconds'>,
  fallbackSeconds = 90
): number {
  const resolved = muscleIds
    .map(id => settings.betweenSetRestSeconds?.[id] ?? defaultStrengthBetweenSetRestSeconds[id])
    .filter(Number.isInteger);
  return resolved.length ? Math.max(...resolved) : fallbackSeconds;
}

export const strengthWorkoutSuggestions: readonly StrengthWorkoutSuggestion[] = [
  {
    sourceId: 'strength.upper-body',
    name: 'Upper Body',
    muscleIds: ['chest', 'back', 'biceps', 'triceps', 'shoulders'],
    exercises: [
      suggestedExercise('Bench Press', ['chest', 'triceps', 'shoulders'], 'Barbell', [12, 10, 8], undefined, 'total'),
      suggestedExercise('Pull-Up', ['back', 'biceps'], 'Pull-up bar', suggestedSets(3, 10), 'Aim for 10–15 reps per set.', 'bodyweight'),
      suggestedExercise('Overhead Press', ['shoulders', 'triceps'], 'Barbell', suggestedSets(3, 10), undefined, 'total'),
      suggestedExercise('Barbell Biceps Curl', ['biceps'], 'Barbell', suggestedSets(3, 8), undefined, 'total'),
      suggestedExercise('Cable Triceps Pressdown', ['triceps'], 'Cable', suggestedSets(3, 8), undefined, 'total')
    ]
  },
  {
    sourceId: 'strength.lower-body',
    name: 'Lower Body',
    muscleIds: ['quads', 'hamstrings', 'calves', 'back'],
    exercises: [
      suggestedExercise('Squat', ['quads', 'hamstrings'], 'Barbell', suggestedSets(3, 10), undefined, 'total'),
      suggestedExercise('Romanian Deadlift', ['hamstrings', 'back'], 'Barbell', suggestedSets(3, 8), undefined, 'total'),
      suggestedExercise('Calf Raise', ['calves'], 'Bodyweight', suggestedSets(3, 12), undefined, 'bodyweight')
    ]
  },
  {
    sourceId: 'strength.arms',
    name: 'Arms',
    muscleIds: ['biceps', 'triceps'],
    exercises: [
      suggestedExercise('Skull Crusher', ['triceps'], 'Barbell', suggestedSets(3, 10), undefined, 'total'),
      suggestedExercise('Incline Dumbbell Curl', ['biceps'], 'Dumbbells', suggestedSets(3, 10), undefined, 'per-dumbbell'),
      suggestedExercise('Cable Triceps Pressdown', ['triceps'], 'Cable', suggestedSets(3, 10), undefined, 'total'),
      suggestedExercise('Hammer Curl', ['biceps'], 'Dumbbells', suggestedSets(3, 10), undefined, 'per-dumbbell')
    ]
  },
  {
    sourceId: 'strength.back-biceps',
    name: 'Back & Biceps',
    muscleIds: ['back', 'biceps'],
    exercises: [
      suggestedExercise('Weighted Pull-Up', ['back', 'biceps'], 'Pull-up bar', suggestedSets(3, 10), undefined, 'total'),
      suggestedExercise('Cable Row', ['back', 'biceps'], 'Cable', suggestedSets(3, 10), undefined, 'total'),
      suggestedExercise('Incline Dumbbell Curl', ['biceps'], 'Dumbbells', suggestedSets(3, 10), undefined, 'per-dumbbell')
    ]
  },
  {
    sourceId: 'strength.chest-triceps',
    name: 'Chest & Triceps',
    muscleIds: ['chest', 'triceps', 'shoulders'],
    exercises: [
      suggestedExercise('Incline Dumbbell Press', ['chest', 'triceps', 'shoulders'], 'Dumbbells', suggestedSets(3, 10), undefined, 'per-dumbbell'),
      suggestedExercise('Incline Dumbbell Fly', ['chest', 'shoulders'], 'Dumbbells', suggestedSets(3, 10), undefined, 'per-dumbbell'),
      suggestedExercise('Triceps Extension', ['triceps'], 'Dumbbells', suggestedSets(3, 10), undefined, 'per-dumbbell')
    ]
  },
  {
    sourceId: 'strength.shoulders-quads',
    name: 'Shoulders & Quads',
    muscleIds: ['shoulders', 'quads', 'hamstrings', 'triceps'],
    exercises: [
      suggestedExercise('Barbell Squat', ['quads', 'hamstrings'], 'Barbell', suggestedSets(3, 10), undefined, 'total'),
      suggestedExercise('Military Press', ['shoulders', 'triceps'], 'Barbell', suggestedSets(3, 10), undefined, 'total'),
      suggestedExercise('Lateral Raise', ['shoulders'], 'Dumbbells', suggestedSets(3, 10), undefined, 'per-dumbbell'),
      suggestedExercise('Dumbbell Front Raise', ['shoulders'], 'Dumbbells', suggestedSets(3, 10), undefined, 'per-dumbbell')
    ]
  },
  {
    sourceId: 'strength.arms-shoulders',
    name: 'Arms & Shoulders',
    muscleIds: ['biceps', 'triceps', 'shoulders', 'back'],
    exercises: [
      suggestedExercise('Dumbbell Overhead Press', ['shoulders', 'triceps'], 'Dumbbells', suggestedSets(3, 10), undefined, 'per-dumbbell'),
      suggestedExercise('Incline Dumbbell Curl', ['biceps'], 'Dumbbells', suggestedSets(3, 10), undefined, 'per-dumbbell'),
      suggestedExercise('Cable Triceps Pressdown', ['triceps'], 'Cable', suggestedSets(3, 10), undefined, 'total'),
      suggestedExercise('Lateral Raise', ['shoulders'], 'Dumbbells', suggestedSets(3, 10), undefined, 'per-dumbbell'),
      suggestedExercise('Front Raise', ['shoulders'], 'Dumbbells', suggestedSets(3, 10), undefined, 'per-dumbbell'),
      suggestedExercise('Bent-Over Reverse Fly', ['shoulders', 'back'], 'Dumbbells', suggestedSets(3, 10), undefined, 'per-dumbbell')
    ]
  },
  {
    sourceId: 'strength.ab-roller',
    name: 'Ab Roller',
    muscleIds: ['abs'],
    exercises: [
      suggestedExercise('Ab Wheel Rollout', ['abs'], 'Ab wheel', suggestedSets(3, 20), undefined, 'bodyweight')
    ]
  },
  {
    sourceId: 'strength.power-abs',
    name: 'Power Abs',
    muscleIds: ['abs'],
    supersetExerciseIndexes: [0, 1],
    exercises: [
      suggestedExercise('Weighted Decline Sit-Up', ['abs'], 'Weight plate', suggestedSets(3, 10), undefined, 'total'),
      suggestedExercise('Roman Chair Leg Raise', ['abs'], 'Roman chair', suggestedSets(3, 10), undefined, 'bodyweight')
    ]
  },
  {
    sourceId: 'strength.plank',
    name: 'Plank',
    muscleIds: ['abs'],
    exercises: [{
      name: 'Plank',
      muscleIds: ['abs'],
      equipment: 'Bodyweight',
      loadMeaning: 'bodyweight',
      sets: [{ targetDurationSeconds: 180 }]
    }]
  }
];

export function createStrengthWorkoutSuggestionExercises(
  suggestion: StrengthWorkoutSuggestion,
  createId: () => string,
  settings: Pick<StrengthSettings, 'betweenSetRestSeconds'> = defaultStrengthData.settings
): StrengthWorkoutExercise[] {
  return suggestion.exercises.map(exercise => ({
    id: `strength-exercise-${createId()}`,
    name: exercise.name,
    muscleIds: [...exercise.muscleIds],
    equipment: exercise.equipment,
    ...(exercise.loadMeaning === undefined ? {} : { loadMeaning: exercise.loadMeaning }),
    ...(exercise.notes ? { notes: exercise.notes } : {}),
    restDurationSeconds: resolveStrengthBetweenSetRestSeconds(exercise.muscleIds, settings),
    restDurationOverridden: false,
    sets: exercise.sets.map(set => ({
      id: `strength-set-${createId()}`,
      ...( 'targetDurationSeconds' in set
        ? { measurement: { kind: 'duration' as const, targetDurationSeconds: set.targetDurationSeconds } }
        : { measurement: { kind: 'reps' as const }, targetReps: set.targetReps })
    }))
  }));
}

export function createStrengthWorkoutSuggestionSupersetGroups(
  suggestion: StrengthWorkoutSuggestion,
  exercises: readonly StrengthWorkoutExercise[],
  createId: () => string,
  settings: Pick<StrengthSettings, 'betweenSetRestSeconds'> = defaultStrengthData.settings
): StrengthSupersetGroup[] {
  const indexes = suggestion.supersetExerciseIndexes;
  if (!indexes) return [];
  const first = exercises[indexes[0]];
  const second = exercises[indexes[1]];
  if (!first || !second || indexes[1] !== indexes[0] + 1) return [];
  return [{
    id: `strength-superset-${createId()}`,
    exerciseIds: [first.id, second.id],
    restDurationSeconds: resolveStrengthBetweenSetRestSeconds(
      [...new Set([...first.muscleIds, ...second.muscleIds])],
      settings
    ),
    restDurationOverridden: false
  }];
}

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
  startedAt?: string;
  finishedAt?: string;
  timeZone?: string;
  sharedWith?: PersonId[];
  exercises?: StrengthWorkoutExerciseSnapshot[];
  supersetGroups?: StrengthSupersetGroup[];
};

export type StrengthExerciseVolume = {
  status: 'complete' | 'partial';
  value: number;
  unit: 'lb' | 'kg';
  meaning: 'total' | 'per-dumbbell' | 'per-side';
  label: 'Volume' | 'Added-load volume';
};

export type StrengthVolumeReference = {
  id: string;
  date: string;
  startedAt?: string;
};

export type StrengthExerciseVolumeComparison = {
  workout: StrengthWorkoutLog;
  volume: StrengthExerciseVolume;
  changePercent?: number;
};

export type StrengthRhythmMode = {
  rhythmId: string;
  mode: StrengthMode;
  workoutId?: string;
};

export type StrengthData = {
  settings: StrengthSettings;
  trackingStartDate?: string;
  scoringSettingsHistory?: StrengthScoringSettingsVersion[];
  savedWorkouts: StrengthSavedWorkout[];
  workouts: StrengthWorkoutLog[];
  rhythmModes: StrengthRhythmMode[];
  guidedSessionDraft?: StrengthGuidedSessionDraft;
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
  lastPerformed: string | null;
  consistency: number | null;
  onTrack: number | null;
  health: number | null;
  eligibleConsistencyWindows: number;
  creditedConsistencyWindows: number;
  consistencyUnavailableReason: string | null;
  onTrackUnavailableReason: string | null;
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
    preferredRestDays: Object.fromEntries(strengthMuscles.map(muscle => [muscle.id, muscle.id === 'abs' ? 0 : 1])),
    betweenSetRestSeconds: { ...defaultStrengthBetweenSetRestSeconds },
    weightUnit: 'lb'
  },
  scoringSettingsHistory: [],
  savedWorkouts: [],
  workouts: [],
  rhythmModes: []
};

export function createStrengthData(): StrengthData {
  return {
    settings: {
      muscleIntervals: { ...defaultStrengthData.settings.muscleIntervals },
      preferredRestDays: { ...defaultStrengthData.settings.preferredRestDays },
      betweenSetRestSeconds: { ...defaultStrengthData.settings.betweenSetRestSeconds },
      weightUnit: defaultStrengthData.settings.weightUnit
    },
    scoringSettingsHistory: [],
    savedWorkouts: [],
    workouts: [],
    rhythmModes: []
  };
}

export function clearStrengthGuidedSessionDraft(data: StrengthData): StrengthData {
  const next = { ...data };
  delete next.guidedSessionDraft;
  return next;
}

export function migrateStrengthDataToV25(value: StrengthData): StrengthData {
  const normalizeExercises = <T extends StrengthWorkoutExercise | StrengthWorkoutExerciseSnapshot>(exercises: T[]): T[] =>
    exercises.map(exercise => ({
      ...exercise,
      sets: exercise.sets.map(set => ({
        ...set,
        measurement: set.measurement ?? { kind: 'reps' }
      }))
    } as T));
  const normalizeGroups = (groups?: StrengthSupersetGroup[]) => groups ?? [];
  return {
    ...value,
    savedWorkouts: value.savedWorkouts.map(workout => ({
      ...workout,
      ...(workout.exercises === undefined ? {} : { exercises: normalizeExercises(workout.exercises) }),
      supersetGroups: normalizeGroups(workout.supersetGroups)
    })),
    workouts: value.workouts.map(log => ({
      ...log,
      ...(log.exercises === undefined ? {} : { exercises: normalizeExercises(log.exercises) }),
      supersetGroups: normalizeGroups(log.supersetGroups)
    })),
    ...(value.guidedSessionDraft === undefined ? {} : {
      guidedSessionDraft: {
        ...value.guidedSessionDraft,
        exercises: normalizeExercises(value.guidedSessionDraft.exercises),
        supersetGroups: normalizeGroups(value.guidedSessionDraft.supersetGroups),
        autoStartRest: value.guidedSessionDraft.autoStartRest ?? false,
        restTimer: value.guidedSessionDraft.restTimer ?? {
          status: 'idle',
          durationSeconds: value.guidedSessionDraft.exercises[
            value.guidedSessionDraft.currentExerciseIndex
          ]?.restDurationSeconds ?? 0
        },
        exerciseTimer: value.guidedSessionDraft.exerciseTimer ?? { status: 'idle', elapsedMilliseconds: 0 }
      }
    })
  };
}

export function migrateStrengthDataToV26(value: StrengthData): StrengthData {
  return {
    ...value,
    settings: {
      ...value.settings,
      betweenSetRestSeconds: {
        ...defaultStrengthBetweenSetRestSeconds,
        ...value.settings.betweenSetRestSeconds
      }
    }
  };
}

export function migrateStrengthDataToV27(value: StrengthData): StrengthData {
  return value;
}

export function migrateStrengthDataToV28(value: StrengthData): StrengthData {
  return {
    ...value,
    scoringSettingsHistory: Array.isArray(value.scoringSettingsHistory)
      ? value.scoringSettingsHistory
      : []
  };
}

export function validateStrengthData(
  value: unknown,
  allowGuidedSessionDraft = true,
  requireV25 = false,
  requireV26 = false,
  requireV28 = false
): value is StrengthData {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'settings', 'trackingStartDate', 'scoringSettingsHistory',
    'savedWorkouts', 'workouts', 'rhythmModes', 'guidedSessionDraft'
  ]) || !allowGuidedSessionDraft && value.guidedSessionDraft !== undefined
    || !isRecord(value.settings)
    || !hasOnlyKeys(value.settings, ['muscleIntervals', 'preferredRestDays', 'betweenSetRestSeconds', 'weightUnit'])
    || !isRecord(value.settings.muscleIntervals)
    || !isRecord(value.settings.preferredRestDays)
    || value.settings.betweenSetRestSeconds !== undefined && !isRecord(value.settings.betweenSetRestSeconds)
    || requireV26 && !isRecord(value.settings.betweenSetRestSeconds)
    || requireV28 && !Array.isArray(value.scoringSettingsHistory)
    || value.trackingStartDate !== undefined
      && (typeof value.trackingStartDate !== 'string' || !isValidDate(value.trackingStartDate))
    || value.scoringSettingsHistory !== undefined
      && !validateStrengthScoringSettingsHistory(value.scoringSettingsHistory, value.trackingStartDate)
    || (value.settings.weightUnit !== 'lb' && value.settings.weightUnit !== 'kg')
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
  if (value.settings.betweenSetRestSeconds !== undefined) {
    const betweenSetRestSeconds = value.settings.betweenSetRestSeconds as Record<string, unknown>;
    for (const muscle of strengthMuscles) {
      const duration = betweenSetRestSeconds[muscle.id];
      if (!Number.isInteger(duration) || Number(duration) < 0 || Number(duration) > 3600) return false;
    }
    if (Object.keys(betweenSetRestSeconds).some(id => !isStrengthMuscleId(id))) return false;
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
      || workout.suggestionSourceId !== undefined && !isNonEmptyText(workout.suggestionSourceId, 160)
      || requireV25 && (!Array.isArray(workout.supersetGroups)
        || workout.exercises !== undefined && !validateExercises(workout.exercises, false, true))
      || workout.exercises !== undefined && !validateExercises(workout.exercises, false, requireV25)
      || workout.supersetGroups !== undefined
        && !validateSupersetGroups(workout.supersetGroups, workout.exercises ?? [])) return false;
    workoutIds.add(workout.id);
  }

  const logIds = new Set<string>();
  const linkedCompletionIds = new Set<string>();
  for (const log of value.workouts) {
    if (!isRecord(log) || !hasOnlyKeys(log, [
      'id', 'date', 'muscleIds', 'notes', 'savedWorkoutId', 'workoutName',
      'rhythmId', 'rhythmOccurrence', 'completionId', 'startedAt', 'finishedAt', 'timeZone',
      'sharedWith', 'exercises', 'supersetGroups'
    ]) || !isNonEmptyText(log.id, 160) || logIds.has(log.id)
      || typeof log.date !== 'string' || !Array.isArray(log.muscleIds)
      || !log.muscleIds.every(isStrengthMuscleId)
      || !isOptionalText(log.notes, 1000)
      || !isOptionalText(log.savedWorkoutId, 160)
      || !isOptionalText(log.workoutName, 120)
      || !isOptionalText(log.rhythmId, 160)
      || !isOptionalText(log.rhythmOccurrence, 10)
      || !isOptionalText(log.completionId, 160)
      || log.sharedWith !== undefined && (!Array.isArray(log.sharedWith)
        || !log.sharedWith.every(isPersonId) || new Set(log.sharedWith).size !== log.sharedWith.length)
      || log.startedAt !== undefined && !isCanonicalInstant(log.startedAt)
      || log.finishedAt !== undefined && !isCanonicalInstant(log.finishedAt)
      || log.timeZone !== undefined && !isValidTimeZone(log.timeZone)
      || requireV25 && (!Array.isArray(log.supersetGroups)
        || log.exercises !== undefined && !validateExerciseSnapshots(log.exercises, true))
      || (log.startedAt === undefined) !== (log.finishedAt === undefined)
      || (log.startedAt === undefined) !== (log.timeZone === undefined)
      || log.startedAt !== undefined && log.finishedAt !== undefined && Date.parse(log.finishedAt) < Date.parse(log.startedAt)
      || log.exercises !== undefined && (!validateExerciseSnapshots(log.exercises)
        || log.startedAt === undefined || log.finishedAt === undefined || log.timeZone === undefined
        || !exerciseConfirmationsWithin(log.exercises, log.startedAt, log.finishedAt)
        || !exerciseMusclesMatchPerformedSets(log.exercises, log.muscleIds))
      || log.supersetGroups !== undefined
        && !validateSupersetGroups(log.supersetGroups, log.exercises ?? [])
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
  if (value.guidedSessionDraft !== undefined
    && !validateStrengthGuidedSessionDraft(value.guidedSessionDraft, requireV25)) return false;
  return true;
}

export function saveStrengthScoringSetup(
  data: StrengthData,
  trackingStartDate: string,
  effectiveDate: string
): StrengthData {
  const firstSetup = data.trackingStartDate === undefined;
  const nextTrackingStartDate = firstSetup ? trackingStartDate : data.trackingStartDate;
  if (!nextTrackingStartDate || !isValidDate(nextTrackingStartDate) || !isValidDate(effectiveDate)
    || effectiveDate < nextTrackingStartDate) return data;

  const history = [...(data.scoringSettingsHistory ?? [])];
  const nextVersion: StrengthScoringSettingsVersion = {
    effectiveDate: firstSetup ? nextTrackingStartDate : effectiveDate,
    muscleIntervals: Object.fromEntries(strengthMuscles.map(muscle => [
      muscle.id, Number(data.settings.muscleIntervals[muscle.id])
    ])) as Record<StrengthMuscleId, number>,
    preferredRestDays: Object.fromEntries(strengthMuscles.map(muscle => [
      muscle.id, Number(data.settings.preferredRestDays[muscle.id])
    ])) as Record<StrengthMuscleId, number>
  };
  if (!firstSetup && history.length > 0) {
    const latest = history.at(-1)!;
    if (effectiveDate < latest.effectiveDate) return data;
    const settingsMatch = strengthMuscles.every(muscle =>
      latest.muscleIntervals[muscle.id] === nextVersion.muscleIntervals[muscle.id]
      && latest.preferredRestDays[muscle.id] === nextVersion.preferredRestDays[muscle.id]);
    if (settingsMatch && effectiveDate !== latest.effectiveDate) return data;
  }
  const existingIndex = history.findIndex(version => version.effectiveDate === nextVersion.effectiveDate);
  if (existingIndex >= 0) history[existingIndex] = nextVersion;
  else history.push(nextVersion);
  history.sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate));
  return {
    ...data,
    trackingStartDate: nextTrackingStartDate,
    scoringSettingsHistory: history
  };
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
    } else {
      const betweenSets = settings.betweenSetRestSeconds?.[muscle.id];
      if (!Number.isInteger(betweenSets) || betweenSets! < 0 || betweenSets! > 3600) {
        errors[muscle.id] = 'Enter a whole number from 0 to 3600 seconds.';
      }
    }
  }
  return errors;
}

export function selectStrengthMuscleScores(
  data: Pick<StrengthData, 'settings' | 'workouts'>
    & Partial<Pick<StrengthData, 'trackingStartDate' | 'scoringSettingsHistory'>>,
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
    const historyState: StrengthHistoryState = invalidHistory
      ? 'invalid'
      : lastTrained ? 'trained' : 'never-trained';
    const daysSince = lastTrained ? Math.max(0, fitnessDateDifference(lastTrained, evaluationDate)) : null;
    const daysUntilDue = intervalDays === null || daysSince === null ? null : intervalDays - daysSince;
    const score = intervalDays === null || daysSince === null
      ? null
      : Math.max(0, 100 - 10 * Math.max(0, daysSince - intervalDays));
    const restDaysRemaining = !lastTrained || preferredRestDays === 0
      ? 0
      : Math.max(0, preferredRestDays + 1 - daysSince!);
    const eligible = restDaysRemaining === 0 && !invalidHistory;
    const consistencyStatus = invalidHistory
      ? 'Training history unavailable.'
      : daysUntilDue === null
        ? 'Not logged yet.'
        : daysUntilDue > 0
          ? `Due in ${daysUntilDue} ${daysUntilDue === 1 ? 'day.' : 'days.'}`
          : daysUntilDue === 0
            ? 'Due today.'
            : `${Math.abs(daysUntilDue)} ${Math.abs(daysUntilDue) === 1 ? 'day' : 'days'} overdue.`;
    const status = invalidHistory
      ? 'Training history unavailable.'
      : !lastTrained
        ? 'Not logged yet.'
      : !eligible
        ? `Resting · ready in ${restDaysRemaining} ${restDaysRemaining === 1 ? 'day.' : 'days.'}`
        : consistencyStatus;
    const scoringHistory = data.scoringSettingsHistory;
    const trackingStartDate = data.trackingStartDate;
    const consistency = selectStrengthConsistency(
      muscle.id,
      scoringHistory,
      trackingStartDate,
      data.workouts,
      evaluationDate
    );
    const activeScoringSettings = scoringHistory?.filter(item => item.effectiveDate <= evaluationDate).at(-1);
    const scoringInterval = activeScoringSettings?.muscleIntervals[muscle.id] ?? null;
    const performedDates = confirmedPerformedDates(data.workouts, muscle.id, evaluationDate);
    const lastPerformed = performedDates.at(-1) ?? null;
    const onTrackDaysSince = lastPerformed
      ? fitnessDateDifference(lastPerformed, evaluationDate)
      : null;
    const onTrack = scoringInterval === null || onTrackDaysSince === null
      ? null
      : Math.max(0, 100 - 10 * Math.max(0, onTrackDaysSince - scoringInterval));
    const health = blendFitnessHealth(consistency.score, onTrack).health;
    return {
      id: muscle.id, name: muscle.name, group: muscle.group,
      intervalDays, preferredRestDays, lastTrained, daysSince, daysUntilDue,
      restDaysRemaining, eligible, historyState, score,
      lastPerformed,
      consistency: consistency.score,
      onTrack,
      health,
      eligibleConsistencyWindows: consistency.eligibleWindows,
      creditedConsistencyWindows: consistency.creditedWindows,
      consistencyUnavailableReason: consistency.reason,
      onTrackUnavailableReason: onTrack === null
        ? scoringInterval === null
          ? 'Effective-dated Strength training settings are not available for this date.'
          : 'No confirmed performed set for this muscle is available.'
        : null,
      status, consistencyStatus
    };
  });
}

export function selectStrengthConsistency(
  muscleId: StrengthMuscleId,
  history: readonly StrengthScoringSettingsVersion[] | undefined,
  trackingStartDate: string | undefined,
  workouts: readonly StrengthWorkoutLog[],
  evaluationDate: string
): { score: number | null; eligibleWindows: number; creditedWindows: number; reason: string | null } {
  if (!trackingStartDate || !isValidDate(trackingStartDate)) {
    return {
      score: null, eligibleWindows: 0, creditedWindows: 0,
      reason: 'Set an explicit Strength tracking start date and save training settings.'
    };
  }
  if (!history?.length || history[0]?.effectiveDate !== trackingStartDate) {
    return {
      score: null, eligibleWindows: 0, creditedWindows: 0,
      reason: 'Effective-dated Strength interval and rest settings are unavailable.'
    };
  }
  if (!isValidDate(evaluationDate) || evaluationDate < trackingStartDate) {
    return {
      score: null, eligibleWindows: 0, creditedWindows: 0,
      reason: 'The Strength tracking period has not started.'
    };
  }

  const lookbackStart = addFitnessDays(evaluationDate, -27);
  let eligibleWindows = 0;
  let creditedWindows = 0;
  let untrustedWindows = 0;
  for (let index = 0; index < history.length; index += 1) {
    const version = history[index]!;
    const nextVersion = history[index + 1];
    const segmentEnd = nextVersion
      ? addFitnessDays(nextVersion.effectiveDate, -1)
      : evaluationDate;
    const interval = version.muscleIntervals[muscleId];
    let windowStart = version.effectiveDate;
    while (fitnessDateDifference(windowStart, segmentEnd) >= interval - 1) {
      const windowEnd = addFitnessDays(windowStart, interval - 1);
      if (windowStart >= lookbackStart && windowEnd <= segmentEnd && windowEnd <= evaluationDate) {
        const logs = workouts.filter(workout => workout.date >= windowStart && workout.date <= windowEnd
          && workout.muscleIds.includes(muscleId));
        if (logs.some(workout => !workout.exercises?.length)) {
          untrustedWindows += 1;
        } else {
          eligibleWindows += 1;
          if (logs.some(workout => workoutHasConfirmedPerformedMuscle(workout, muscleId))) {
            creditedWindows += 1;
          }
        }
      }
      windowStart = addFitnessDays(windowStart, interval);
    }
  }
  if (eligibleWindows === 0) {
    return {
      score: null, eligibleWindows: 0, creditedWindows: 0,
      reason: untrustedWindows > 0
        ? 'Some complete windows contain legacy workouts without trustworthy performed-set details.'
        : 'No complete interval window falls within the last 28 tracked local dates.'
    };
  }
  return {
    score: creditedWindows / eligibleWindows * 100,
    eligibleWindows,
    creditedWindows,
    reason: untrustedWindows > 0
      ? `${untrustedWindows} window${untrustedWindows === 1 ? '' : 's'} excluded because legacy workout details are incomplete.`
      : null
  };
}

function confirmedPerformedDates(
  workouts: readonly StrengthWorkoutLog[],
  muscleId: StrengthMuscleId,
  evaluationDate: string
): string[] {
  return [...new Set(workouts
    .filter(workout => workout.date <= evaluationDate && workoutHasConfirmedPerformedMuscle(workout, muscleId))
    .map(workout => workout.date))]
    .sort();
}

function workoutHasConfirmedPerformedMuscle(
  workout: StrengthWorkoutLog,
  muscleId: StrengthMuscleId
): boolean {
  return workout.exercises?.some(exercise => exercise.muscleIds.includes(muscleId)
    && exercise.sets.some(set => set.status === 'performed' && isCanonicalInstant(set.confirmedAt))) ?? false;
}

function addFitnessDays(date: string, days: number): string {
  if (!isValidDate(date)) return '';
  const [year, month, day] = date.split('-').map(Number);
  const result = new Date(Date.UTC(year!, month! - 1, day! + days));
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-${String(result.getUTCDate()).padStart(2, '0')}`;
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
  if (!validateStrengthWorkout(workout)) return { valid: false, error: 'Choose a name and at least one valid muscle group and exercise configuration.' };
  return { valid: true, workouts: [...savedWorkouts, normalizeStrengthSavedWorkout(workout)] };
}

export function editStrengthWorkout(
  savedWorkouts: readonly StrengthSavedWorkout[],
  workout: StrengthSavedWorkout
): { valid: true; workouts: StrengthSavedWorkout[] } | { valid: false; error: string } {
  if (!savedWorkouts.some(item => item.id === workout.id)) return { valid: false, error: 'This saved workout is unavailable.' };
  if (!validateStrengthWorkout(workout)) return { valid: false, error: 'Choose a name and at least one valid muscle group and exercise configuration.' };
  return { valid: true, workouts: savedWorkouts.map(item => item.id === workout.id ? normalizeStrengthSavedWorkout(workout) : item) };
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
    || log.muscleIds.some(id => !isStrengthMuscleId(id))
    || log.muscleIds.length === 0 && log.exercises === undefined
    || !isValidDate(log.date) || !isOptionalText(log.notes, 1000)
    || !isOptionalText(log.savedWorkoutId, 160)
    || !isOptionalText(log.workoutName, 120)
    || !isOptionalText(log.rhythmId, 160)
    || !isOptionalText(log.rhythmOccurrence, 10)
    || !isOptionalText(log.completionId, 160)
    || log.sharedWith !== undefined && (!Array.isArray(log.sharedWith)
      || !log.sharedWith.every(isPersonId) || new Set(log.sharedWith).size !== log.sharedWith.length)
    || log.startedAt !== undefined && !isCanonicalInstant(log.startedAt)
    || log.finishedAt !== undefined && !isCanonicalInstant(log.finishedAt)
    || log.timeZone !== undefined && !isValidTimeZone(log.timeZone)
    || (log.startedAt === undefined) !== (log.finishedAt === undefined)
    || (log.startedAt === undefined) !== (log.timeZone === undefined)
    || log.startedAt !== undefined && log.finishedAt !== undefined && Date.parse(log.finishedAt) < Date.parse(log.startedAt)
    || log.exercises !== undefined && (!validateExerciseSnapshots(log.exercises)
      || log.startedAt === undefined || log.finishedAt === undefined || log.timeZone === undefined
      || !exerciseConfirmationsWithin(log.exercises, log.startedAt, log.finishedAt)
      || !exerciseMusclesMatchPerformedSets(log.exercises, log.muscleIds))
    || log.rhythmId !== undefined && (!isNonEmptyText(log.rhythmId, 160)
      || typeof log.rhythmOccurrence !== 'string'
      || !isValidDate(log.rhythmOccurrence) || log.rhythmOccurrence !== log.date
      || !isNonEmptyText(log.completionId, 160))
    || (log.rhythmId === undefined) !== (log.rhythmOccurrence === undefined)
    || log.completionId !== undefined && (log.rhythmId === undefined || !isNonEmptyText(log.completionId, 160))) {
    return { valid: false, error: 'Enter a valid date and choose at least one muscle group.' };
  }
  if (log.exercises && !log.exercises.some(exercise =>
    exercise.sets.some(set => set.status === 'performed'))) {
    return { valid: false, error: 'Confirm at least one set before saving completed workout activity.' };
  }
  const existing = workouts.find(item => item.id === log.id);
  if (workouts.some(item => item.id !== log.id && item.rhythmId === log.rhythmId
    && item.rhythmOccurrence === log.rhythmOccurrence && log.rhythmId !== undefined)) {
    return { valid: false, error: 'A workout is already linked to this scheduled Rhythm occurrence.' };
  }
  return {
    valid: true,
    workouts: existing
      ? workouts.map(item => item.id === log.id ? normalizeStrengthWorkoutLog(log) : item)
      : [...workouts, normalizeStrengthWorkoutLog(log)]
  };
}

export function convertStrengthLoad(load: StrengthLoad, unit: 'lb' | 'kg'): StrengthLoad {
  if (load.kind === 'bodyweight' || load.unit === unit) return { ...load };
  const value = load.unit === 'lb' ? load.value * 0.45359237 : load.value / 0.45359237;
  return { ...load, value, unit };
}

export function updateStrengthSavedWorkoutRestOverride(
  workouts: readonly StrengthSavedWorkout[],
  templateId: string,
  target: { kind: 'exercise'; exerciseId: string } | { kind: 'superset'; groupId: string },
  durationSeconds: number
): { valid: true; workouts: StrengthSavedWorkout[] } | { valid: false; error: string } {
  if (!isNonEmptyText(templateId, 160) || !isPositiveInteger(durationSeconds, 3600)) {
    return { valid: false, error: 'Choose a saved workout and rest duration from 1 to 3,600 seconds.' };
  }
  const template = workouts.find(workout => workout.id === templateId);
  if (!template) return { valid: false, error: 'The originating saved workout is unavailable.' };
  if (target.kind === 'exercise') {
    if (!template.exercises?.some(exercise => exercise.id === target.exerciseId)) {
      return { valid: false, error: 'The exercise is no longer in the originating saved workout.' };
    }
    return {
      valid: true,
      workouts: workouts.map(workout => workout.id !== templateId ? workout : {
        ...workout,
        exercises: workout.exercises!.map(exercise => exercise.id !== target.exerciseId
          ? exercise
          : { ...exercise, restDurationSeconds: durationSeconds, restDurationOverridden: true })
      })
    };
  }
  if (!template.supersetGroups?.some(group => group.id === target.groupId)) {
    return { valid: false, error: 'The superset is no longer in the originating saved workout.' };
  }
  return {
    valid: true,
    workouts: workouts.map(workout => workout.id !== templateId ? workout : {
      ...workout,
      supersetGroups: workout.supersetGroups!.map(group => group.id !== target.groupId
        ? group
        : { ...group, restDurationSeconds: durationSeconds, restDurationOverridden: true })
    })
  };
}

export function selectStrengthExerciseVolume(
  exercise: StrengthWorkoutExerciseSnapshot,
  displayUnit: 'lb' | 'kg' = 'lb'
): StrengthExerciseVolume | null {
  const externalSets = exercise.sets.flatMap(set => {
    if (set.status !== 'performed' || set.measurement?.kind === 'duration'
      || !Number.isInteger(set.actualReps) || set.actualReps! < 1
      || set.actualLoad?.kind !== 'external') return [];
    return [{ load: set.actualLoad, reps: set.actualReps! }];
  });
  if (!externalSets.length) return null;
  const meaning = externalSets[0]!.load.meaning;
  if (externalSets.some(item => item.load.meaning !== meaning)) return null;
  const value = externalSets.reduce((total, item) => {
    const converted = convertStrengthLoad(item.load, displayUnit);
    return total + (converted.kind === 'external' ? converted.value * item.reps : 0);
  }, 0);
  const complete = exercise.sets.length > 0 && exercise.sets.every(set =>
    set.status === 'performed'
      && set.measurement?.kind !== 'duration'
      && Number.isInteger(set.actualReps)
      && set.actualReps! > 0
      && set.actualLoad?.kind === 'external'
      && set.actualLoad.meaning === meaning
  );
  return {
    status: complete ? 'complete' : 'partial',
    value,
    unit: displayUnit,
    meaning,
    label: isStrengthAddedLoadExercise(exercise) ? 'Added-load volume' : 'Volume'
  };
}

export function selectStrengthExerciseVolumeComparison(
  workouts: readonly StrengthWorkoutLog[],
  reference: StrengthVolumeReference,
  exercise: StrengthWorkoutExerciseSnapshot,
  displayUnit: 'lb' | 'kg' = 'lb'
): StrengthExerciseVolumeComparison | null {
  const currentVolume = selectStrengthExerciseVolume(exercise, displayUnit);
  const expectedMeaning = currentVolume?.meaning
    ?? (exercise.loadMeaning === 'total' || exercise.loadMeaning === 'per-dumbbell' || exercise.loadMeaning === 'per-side'
      ? exercise.loadMeaning
      : undefined);
  if (!expectedMeaning) return null;
  const previous = workouts
    .filter(workout => workout.id !== reference.id
      && (workout.date < reference.date
        || workout.date === reference.date && reference.startedAt !== undefined
          && workout.finishedAt !== undefined
          && Date.parse(workout.finishedAt) <= Date.parse(reference.startedAt))
      && workout.exercises?.some(candidate => candidate.id === exercise.id
        && candidate.equipment.trim().toLocaleLowerCase() === exercise.equipment.trim().toLocaleLowerCase()))
    .map(workout => ({
      workout,
      exercise: workout.exercises!.find(candidate => candidate.id === exercise.id)!
    }))
    .map(item => ({ ...item, volume: selectStrengthExerciseVolume(item.exercise, displayUnit) }))
    .filter((item): item is typeof item & { volume: StrengthExerciseVolume } =>
      item.volume !== null
      && item.volume.meaning === expectedMeaning)
    .sort((left, right) => right.workout.date.localeCompare(left.workout.date)
      || (right.workout.finishedAt ?? '').localeCompare(left.workout.finishedAt ?? ''))[0];
  if (!previous) return null;
  const compatible = currentVolume !== null && currentVolume.meaning === previous.volume.meaning;
  const canCompare = compatible && currentVolume.status === 'complete' && previous.volume.status === 'complete';
  return {
    workout: previous.workout,
    volume: previous.volume,
    ...(canCompare && previous.volume.value > 0
      ? { changePercent: (currentVolume.value - previous.volume.value) / previous.volume.value * 100 }
      : {})
  };
}

export function formatStrengthVolumeChangePercent(changePercent: number): string {
  const rounded = Math.round(changePercent);
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

export function isStrengthAddedLoadExercise(exercise: Pick<StrengthWorkoutExerciseSnapshot, 'name'>): boolean {
  return exercise.name === 'Weighted Pull-Up' || exercise.name === 'Weighted Decline Sit-Up';
}

export function createStrengthGuidedSession(
  template: StrengthSavedWorkout,
  session: {
    id: string;
    date: string;
    startedAt: string;
    timeZone: string;
    rhythmId?: string;
    completionId?: string;
  }
): { valid: true; session: StrengthGuidedSessionDraft } | { valid: false; error: string } {
  if (!validateStrengthWorkout(template) || !template.exercises?.length) {
    return { valid: false, error: 'This saved workout has no valid exercise plan.' };
  }
  if (!isNonEmptyText(session.id, 160) || !isValidDate(session.date)
    || !isCanonicalInstant(session.startedAt) || !isValidTimeZone(session.timeZone)) {
    return { valid: false, error: 'The guided workout session metadata is invalid.' };
  }
  const created: StrengthGuidedSessionDraft = {
    id: session.id,
    templateId: template.id,
    workoutName: template.name,
    date: session.date,
    startedAt: session.startedAt,
    timeZone: session.timeZone,
    muscleIds: [...template.muscleIds],
    sharedWith: [...template.sharedWith],
    currentExerciseIndex: 0,
    currentSetId: template.exercises[0]!.sets[0]!.id,
    autoStartRest: true,
    restTimer: { status: 'idle', durationSeconds: template.exercises[0]!.restDurationSeconds },
    ...(session.rhythmId === undefined ? {} : {
      rhythmId: session.rhythmId,
      rhythmOccurrence: session.date,
      ...(session.completionId === undefined ? {} : { completionId: session.completionId })
    }),
    supersetGroups: (template.supersetGroups ?? []).map(group => ({
      ...group,
      exerciseIds: [...group.exerciseIds] as [string, string]
    })),
    exerciseTimer: { status: 'idle', elapsedMilliseconds: 0 },
    exercises: template.exercises.map(exercise => ({
      ...cloneStrengthExercise(exercise),
      sets: exercise.sets.map(set => ({
        ...cloneStrengthSet(set),
        measurement: set.measurement ?? { kind: 'reps' },
        status: 'pending'
      }))
    }))
  };
  return validateStrengthGuidedSessionDraft(created)
    ? {
    valid: true,
    session: created
  }
    : { valid: false, error: 'The guided workout session metadata is invalid.' };
}

export function validateStrengthGuidedSessionDraft(
  value: unknown,
  requireV25 = false
): value is StrengthGuidedSessionDraft {
  return isRecord(value)
    && hasOnlyKeys(value, [
      'id', 'templateId', 'workoutName', 'date', 'startedAt', 'timeZone', 'muscleIds',
      'sharedWith', 'currentExerciseIndex', 'currentSetId', 'autoStartRest', 'restTimer',
      'notes', 'rhythmId', 'supersetGroups', 'exerciseTimer',
      'rhythmOccurrence', 'completionId', 'exercises'
    ])
    && isNonEmptyText(value.id, 160)
    && isNonEmptyText(value.templateId, 160)
    && isNonEmptyText(value.workoutName, 120)
    && typeof value.date === 'string'
    && isValidDate(value.date)
    && isCanonicalInstant(value.startedAt)
    && isValidTimeZone(value.timeZone)
    && Array.isArray(value.muscleIds)
    && value.muscleIds.length > 0
    && value.muscleIds.every(isStrengthMuscleId)
    && Array.isArray(value.exercises)
    && Array.isArray(value.sharedWith)
    && value.sharedWith.every(isPersonId)
    && new Set(value.sharedWith).size === value.sharedWith.length
    && Number.isInteger(value.currentExerciseIndex)
    && Number(value.currentExerciseIndex) >= 0
    && Number(value.currentExerciseIndex) < value.exercises.length
    && isNonEmptyText(value.currentSetId, 160)
    && (value.autoStartRest === undefined || typeof value.autoStartRest === 'boolean')
    && (!requireV25 || value.restTimer !== undefined && value.exerciseTimer !== undefined
      && Array.isArray(value.supersetGroups))
    && (value.restTimer === undefined || validateStrengthSessionRestTimer(value.restTimer))
    && (value.exerciseTimer === undefined || validateStrengthExerciseTimer(value.exerciseTimer))
    && (value.exerciseTimer === undefined
      || exerciseTimerReferencesTimedSet(value.exerciseTimer, value.exercises))
    && (value.supersetGroups === undefined || validateSupersetGroups(value.supersetGroups, value.exercises))
    && value.exercises[Number(value.currentExerciseIndex)]!.sets.some(
      (set: unknown) => isRecord(set) && set.id === value.currentSetId
    )
    && isOptionalText(value.notes, 1000)
    && isOptionalText(value.rhythmId, 160)
    && isOptionalText(value.rhythmOccurrence, 10)
    && isOptionalText(value.completionId, 160)
    && (value.rhythmId === undefined
      ? value.rhythmOccurrence === undefined && value.completionId === undefined
      : typeof value.rhythmOccurrence === 'string'
        && isValidDate(value.rhythmOccurrence) && value.rhythmOccurrence === value.date
        && isNonEmptyText(value.completionId, 160))
    && validateExerciseSnapshots(value.exercises, requireV25)
    && exerciseConfirmationsWithin(value.exercises, value.startedAt);
}

function validateStrengthSessionRestTimer(value: unknown): value is StrengthSessionRestTimer {
  if (!isRecord(value) || !isNonNegativeInteger(value.durationSeconds, 3600)) return false;
  switch (value.status) {
    case 'idle':
    case 'complete':
      return hasOnlyKeys(value, ['status', 'durationSeconds']);
    case 'running':
      return hasOnlyKeys(value, ['status', 'durationSeconds', 'deadlineAt'])
        && isPositiveInteger(value.durationSeconds, 3600)
        && isCanonicalInstant(value.deadlineAt);
    case 'paused':
      return hasOnlyKeys(value, ['status', 'durationSeconds', 'remainingMilliseconds'])
        && isPositiveInteger(value.durationSeconds, 3600)
        && isPositiveInteger(value.remainingMilliseconds, Number(value.durationSeconds) * 1000);
    default:
      return false;
  }
}

function isNonNegativeInteger(value: unknown, maximum: number): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= maximum;
}

function createRunningRestTimer(durationSeconds: number, startedAt: string): StrengthSessionRestTimer {
  if (durationSeconds === 0) return { status: 'idle', durationSeconds: 0 };
  return {
    status: 'running',
    durationSeconds,
    deadlineAt: new Date(Date.parse(startedAt) + durationSeconds * 1000).toISOString()
  };
}

export function confirmStrengthSessionSet(
  session: StrengthGuidedSessionDraft,
  exerciseId: string,
  setId: string,
  actualReps: number,
  confirmedAt: string,
  actualLoad?: StrengthLoad
): { valid: true; session: StrengthGuidedSessionDraft } | { valid: false; error: string } {
  if (!validateStrengthGuidedSessionDraft(session)
    || !isPositiveInteger(actualReps, 1000)
    || !isCanonicalInstant(confirmedAt)
    || Date.parse(confirmedAt) < Date.parse(session.startedAt)
    || actualLoad !== undefined && !validateStrengthLoad(actualLoad)) {
    return { valid: false, error: 'The confirmed set values or timestamp are invalid.' };
  }
  const selectedSet = session.exercises.find(item => item.id === exerciseId)?.sets.find(item => item.id === setId);
  if (!selectedSet || selectedSet.measurement?.kind === 'duration') {
    return { valid: false, error: 'A timed set must be recorded with a duration.' };
  }
  let found = false;
  let alreadyResolved = false;
  const exercises = session.exercises.map(exercise => exercise.id !== exerciseId
    ? exercise
    : {
        ...exercise,
        sets: exercise.sets.map(set => {
          if (set.id !== setId) return set;
          found = true;
          if (set.status !== 'pending') {
            alreadyResolved = true;
            return set;
          }
          return {
            ...set,
            status: 'performed' as const,
            actualReps,
            ...(actualLoad === undefined ? {} : { actualLoad: { ...actualLoad } }),
            confirmedAt
          };
        })
      });
  if (!found) return { valid: false, error: 'The selected exercise set is unavailable.' };
  if (alreadyResolved) return { valid: false, error: 'Only a pending set can be confirmed.' };
  const timer = session.restTimer;
  const next: StrengthGuidedSessionDraft = {
    ...session,
    exercises,
    ...(isStrengthSupersetRoundComplete(session, exercises, exerciseId, setId) && session.autoStartRest
      ? {
          restTimer: createRunningRestTimer(
            session.supersetGroups?.find(group => group.exerciseIds.includes(exerciseId))?.restDurationSeconds
              ?? timer?.durationSeconds ?? session.exercises.find(item => item.id === exerciseId)!.restDurationSeconds,
            confirmedAt
          )
        }
      : !session.supersetGroups?.some(group => group.exerciseIds.includes(exerciseId))
        && (session.autoStartRest || timer?.status === 'running')
      ? {
          restTimer: createRunningRestTimer(
            timer?.durationSeconds ?? session.exercises.find(item => item.id === exerciseId)!.restDurationSeconds,
            confirmedAt
          )
        }
      : {})
  };
  return validateStrengthGuidedSessionDraft(next)
    ? { valid: true, session: next }
    : { valid: false, error: 'The confirmed workout session is invalid.' };
}

function isStrengthSupersetRoundComplete(
  session: StrengthGuidedSessionDraft,
  exercises: StrengthWorkoutExerciseSnapshot[],
  exerciseId: string,
  setId: string
): boolean {
  const group = session.supersetGroups?.find(item => item.exerciseIds.includes(exerciseId));
  if (!group) return false;
  const currentExercise = session.exercises.find(item => item.id === exerciseId);
  const round = currentExercise?.sets.findIndex(item => item.id === setId) ?? -1;
  if (round < 0 || currentExercise?.sets[round]?.status !== 'pending') return false;
  return group.exerciseIds.every(id => {
    const member = exercises.find(item => item.id === id);
    const roundSet = member?.sets[round];
    return roundSet === undefined || roundSet.status === 'performed';
  });
}

export function confirmStrengthSessionDuration(
  session: StrengthGuidedSessionDraft,
  exerciseId: string,
  setId: string,
  actualDurationSeconds: number,
  confirmedAt: string
): { valid: true; session: StrengthGuidedSessionDraft } | { valid: false; error: string } {
  if (!validateStrengthGuidedSessionDraft(session)
    || !isPositiveInteger(actualDurationSeconds, 86_400)
    || !isCanonicalInstant(confirmedAt)
    || Date.parse(confirmedAt) < Date.parse(session.startedAt)) {
    return { valid: false, error: 'The confirmed duration or timestamp is invalid.' };
  }
  const selectedExercise = session.exercises.find(item => item.id === exerciseId);
  const selectedSet = selectedExercise?.sets.find(item => item.id === setId);
  if (selectedSet?.measurement?.kind !== 'duration' || selectedSet.status !== 'pending') {
    return { valid: false, error: 'Only a pending timed set can be confirmed with a duration.' };
  }
  const exercises = session.exercises.map(exercise => exercise.id !== exerciseId
    ? exercise
    : {
        ...exercise,
        sets: exercise.sets.map(set => set.id !== setId ? set : {
          ...set,
          status: 'performed' as const,
          actualDurationSeconds,
          confirmedAt
        })
      });
  const completesPair = isStrengthSupersetRoundComplete(session, exercises, exerciseId, setId);
  const group = session.supersetGroups?.find(item => item.exerciseIds.includes(exerciseId));
  const timer = session.restTimer;
  const next: StrengthGuidedSessionDraft = {
    ...session,
    exercises,
    ...(session.exerciseTimer !== undefined && session.exerciseTimer.status !== 'idle'
      && session.exerciseTimer.exerciseId === exerciseId && session.exerciseTimer.setId === setId
      ? { exerciseTimer: { status: 'idle' as const, elapsedMilliseconds: 0 } }
      : {}),
    ...(completesPair && session.autoStartRest
      ? { restTimer: createRunningRestTimer(group!.restDurationSeconds, confirmedAt) }
      : !group && (session.autoStartRest || timer?.status === 'running')
        ? {
            restTimer: createRunningRestTimer(
              timer?.durationSeconds ?? selectedExercise!.restDurationSeconds,
              confirmedAt
            )
          }
        : {})
  };
  return validateStrengthGuidedSessionDraft(next)
    ? { valid: true, session: next }
    : { valid: false, error: 'The confirmed workout session is invalid.' };
}

export function correctStrengthSessionDuration(
  session: StrengthGuidedSessionDraft,
  exerciseId: string,
  setId: string,
  actualDurationSeconds: number
): { valid: true; session: StrengthGuidedSessionDraft } | { valid: false; error: string } {
  if (!validateStrengthGuidedSessionDraft(session) || !isPositiveInteger(actualDurationSeconds, 86_400)) {
    return { valid: false, error: 'Enter an actual duration from 1 to 86,400 seconds.' };
  }
  let corrected = false;
  const exercises = session.exercises.map(exercise => exercise.id !== exerciseId
    ? exercise
    : {
        ...exercise,
        sets: exercise.sets.map(set => {
          if (set.id !== setId || set.status !== 'performed' || set.measurement?.kind !== 'duration') return set;
          corrected = true;
          return { ...set, actualDurationSeconds };
        })
      });
  return corrected
    ? { valid: true, session: { ...session, exercises } }
    : { valid: false, error: 'Only a performed timed set can be corrected.' };
}

export function selectStrengthExerciseTimerElapsedMilliseconds(
  timer: StrengthExerciseTimer,
  now: string
): number | null {
  if (!validateStrengthExerciseTimer(timer) || !isCanonicalInstant(now)) return null;
  return timer.status === 'running'
    ? timer.elapsedMilliseconds + Math.max(0, Date.parse(now) - Date.parse(timer.startedAt))
    : timer.elapsedMilliseconds;
}

export function startStrengthExerciseTimer(
  session: StrengthGuidedSessionDraft,
  startedAt: string
): { valid: true; session: StrengthGuidedSessionDraft } | { valid: false; error: string } {
  if (!validateStrengthGuidedSessionDraft(session) || !isCanonicalInstant(startedAt)) {
    return { valid: false, error: 'The exercise timer start time is invalid.' };
  }
  const selectedSet = session.exercises[session.currentExerciseIndex]!.sets
    .find(set => set.id === session.currentSetId);
  if (selectedSet?.measurement?.kind !== 'duration') {
    return { valid: false, error: 'The selected set is not timed.' };
  }
  if (session.exerciseTimer?.status === 'running') {
    return { valid: false, error: 'The exercise timer is already running.' };
  }
  if (session.exerciseTimer?.status === 'paused'
    && (session.exerciseTimer.exerciseId !== session.exercises[session.currentExerciseIndex]!.id
      || session.exerciseTimer.setId !== selectedSet.id)) {
    return { valid: false, error: 'Return to the timed set or reset its paused timer first.' };
  }
  const elapsedMilliseconds = session.exerciseTimer?.elapsedMilliseconds ?? 0;
  return {
    valid: true,
    session: {
      ...session,
      exerciseTimer: {
        status: 'running',
        elapsedMilliseconds,
        startedAt,
        exerciseId: session.exercises[session.currentExerciseIndex]!.id,
        setId: selectedSet.id
      },
      ...(session.restTimer?.status === 'running'
        ? { restTimer: { status: 'idle', durationSeconds: session.restTimer.durationSeconds } }
        : {})
    }
  };
}

export function pauseStrengthExerciseTimer(
  session: StrengthGuidedSessionDraft,
  pausedAt: string
): { valid: true; session: StrengthGuidedSessionDraft } | { valid: false; error: string } {
  const timer = session.exerciseTimer;
  if (!validateStrengthGuidedSessionDraft(session) || timer?.status !== 'running'
    || !isCanonicalInstant(pausedAt)) {
    return { valid: false, error: 'There is no running exercise timer to pause.' };
  }
  return {
    valid: true,
    session: {
      ...session,
      exerciseTimer: {
        status: 'paused',
        elapsedMilliseconds: timer.elapsedMilliseconds
          + Math.max(0, Date.parse(pausedAt) - Date.parse(timer.startedAt)),
        exerciseId: timer.exerciseId,
        setId: timer.setId
      }
    }
  };
}

export function resetStrengthExerciseTimer(
  session: StrengthGuidedSessionDraft
): { valid: true; session: StrengthGuidedSessionDraft } | { valid: false; error: string } {
  if (!validateStrengthGuidedSessionDraft(session)) {
    return { valid: false, error: 'The guided workout session is invalid.' };
  }
  return {
    valid: true,
    session: { ...session, exerciseTimer: { status: 'idle', elapsedMilliseconds: 0 } }
  };
}

export function selectStrengthSessionExecutionOrder(
  session: StrengthGuidedSessionDraft
): { exerciseId: string; setId: string; round: number; supersetGroupId?: string }[] {
  const order: { exerciseId: string; setId: string; round: number; supersetGroupId?: string }[] = [];
  for (let index = 0; index < session.exercises.length;) {
    const exercise = session.exercises[index]!;
    const group = session.supersetGroups?.find(item => item.exerciseIds[0] === exercise.id);
    if (!group) {
      exercise.sets.forEach((set, round) => order.push({ exerciseId: exercise.id, setId: set.id, round }));
      index += 1;
      continue;
    }
    const members = group.exerciseIds.map(id => session.exercises.find(item => item.id === id)!);
    const roundCount = Math.max(...members.map(item => item.sets.length));
    for (let round = 0; round < roundCount; round += 1) {
      for (const member of members) {
        const set = member.sets[round];
        if (set) order.push({
          exerciseId: member.id,
          setId: set.id,
          round,
          supersetGroupId: group.id
        });
      }
    }
    index += 2;
  }
  return order;
}

export function selectNextStrengthSessionSet(
  session: StrengthGuidedSessionDraft,
  exerciseId: string,
  setId: string
): { exerciseId: string; setId: string } | null {
  const order = selectStrengthSessionExecutionOrder(session);
  const currentIndex = order.findIndex(item => item.exerciseId === exerciseId && item.setId === setId);
  if (currentIndex < 0) return null;
  for (const item of order.slice(currentIndex + 1)) {
    const exercise = session.exercises.find(candidate => candidate.id === item.exerciseId);
    if (exercise?.sets.find(candidate => candidate.id === item.setId)?.status === 'pending') {
      return { exerciseId: item.exerciseId, setId: item.setId };
    }
  }
  return null;
}

export function setStrengthSessionAutoStartRest(
  session: StrengthGuidedSessionDraft,
  enabled: boolean
): { valid: true; session: StrengthGuidedSessionDraft } | { valid: false; error: string } {
  if (!validateStrengthGuidedSessionDraft(session) || typeof enabled !== 'boolean') {
    return { valid: false, error: 'The auto-start rest preference is invalid.' };
  }
  return { valid: true, session: { ...session, autoStartRest: enabled } };
}

export function setStrengthSessionRestDuration(
  session: StrengthGuidedSessionDraft,
  durationSeconds: number
): { valid: true; session: StrengthGuidedSessionDraft } | { valid: false; error: string } {
  if (!validateStrengthGuidedSessionDraft(session) || !isPositiveInteger(durationSeconds, 3600)) {
    return { valid: false, error: 'Choose a rest duration from 1 to 3,600 seconds.' };
  }
  return {
    valid: true,
    session: {
      ...session,
      restTimer: session.restTimer?.status === 'paused'
        ? { status: 'paused', durationSeconds, remainingMilliseconds: durationSeconds * 1000 }
        : { status: 'idle', durationSeconds }
    }
  };
}

export function setStrengthGuidedSessionRestPreference(
  session: StrengthGuidedSessionDraft,
  exerciseId: string,
  durationSeconds: number,
  supersetGroupId?: string
): { valid: true; session: StrengthGuidedSessionDraft } | { valid: false; error: string } {
  if (!validateStrengthGuidedSessionDraft(session) || !isPositiveInteger(durationSeconds, 3600)) {
    return { valid: false, error: 'Choose a rest duration from 1 to 3,600 seconds.' };
  }
  if (supersetGroupId !== undefined) {
    let found = false;
    const supersetGroups = (session.supersetGroups ?? []).map(group => {
      if (group.id !== supersetGroupId || !group.exerciseIds.includes(exerciseId)) return group;
      found = true;
      return { ...group, restDurationSeconds: durationSeconds, restDurationOverridden: true };
    });
    return found
      ? { valid: true, session: { ...session, supersetGroups } }
      : { valid: false, error: 'The selected superset is unavailable.' };
  }
  let found = false;
  const exercises = session.exercises.map(exercise => {
    if (exercise.id !== exerciseId) return exercise;
    found = true;
    return { ...exercise, restDurationSeconds: durationSeconds, restDurationOverridden: true };
  });
  return found
    ? { valid: true, session: { ...session, exercises } }
    : { valid: false, error: 'The selected exercise is unavailable.' };
}

export function startStrengthSessionRestTimer(
  session: StrengthGuidedSessionDraft,
  startedAt: string
): { valid: true; session: StrengthGuidedSessionDraft } | { valid: false; error: string } {
  if (!validateStrengthGuidedSessionDraft(session) || !isCanonicalInstant(startedAt)) {
    return { valid: false, error: 'The rest timer start time is invalid.' };
  }
  const durationSeconds = session.restTimer?.durationSeconds
    ?? session.exercises[session.currentExerciseIndex]!.restDurationSeconds;
  if (!isPositiveInteger(durationSeconds, 3600)) {
    return { valid: false, error: 'Choose a rest duration before starting the timer.' };
  }
  return { valid: true, session: { ...session, restTimer: createRunningRestTimer(durationSeconds, startedAt) } };
}

export function pauseStrengthSessionRestTimer(
  session: StrengthGuidedSessionDraft,
  pausedAt: string
): { valid: true; session: StrengthGuidedSessionDraft } | { valid: false; error: string } {
  if (!validateStrengthGuidedSessionDraft(session) || !isCanonicalInstant(pausedAt)
    || session.restTimer?.status !== 'running') {
    return { valid: false, error: 'There is no running rest timer to pause.' };
  }
  const remainingMilliseconds = Math.max(0, Date.parse(session.restTimer.deadlineAt) - Date.parse(pausedAt));
  return {
    valid: true,
    session: {
      ...session,
      restTimer: remainingMilliseconds === 0
        ? { status: 'complete', durationSeconds: session.restTimer.durationSeconds }
        : { status: 'paused', durationSeconds: session.restTimer.durationSeconds, remainingMilliseconds }
    }
  };
}

export function resumeStrengthSessionRestTimer(
  session: StrengthGuidedSessionDraft,
  resumedAt: string
): { valid: true; session: StrengthGuidedSessionDraft } | { valid: false; error: string } {
  if (!validateStrengthGuidedSessionDraft(session) || !isCanonicalInstant(resumedAt)
    || session.restTimer?.status !== 'paused') {
    return { valid: false, error: 'There is no paused rest timer to resume.' };
  }
  if (session.restTimer.remainingMilliseconds === 0) {
    return {
      valid: true,
      session: { ...session, restTimer: { status: 'complete', durationSeconds: session.restTimer.durationSeconds } }
    };
  }
  return {
    valid: true,
    session: {
      ...session,
      restTimer: {
        status: 'running',
        durationSeconds: session.restTimer.durationSeconds,
        deadlineAt: new Date(Date.parse(resumedAt) + session.restTimer.remainingMilliseconds).toISOString()
      }
    }
  };
}

export function resetStrengthSessionRestTimer(
  session: StrengthGuidedSessionDraft
): { valid: true; session: StrengthGuidedSessionDraft } | { valid: false; error: string } {
  if (!validateStrengthGuidedSessionDraft(session)) {
    return { valid: false, error: 'The guided workout session is invalid.' };
  }
  const durationSeconds = session.restTimer?.durationSeconds
    ?? session.exercises[session.currentExerciseIndex]!.restDurationSeconds;
  return { valid: true, session: { ...session, restTimer: { status: 'idle', durationSeconds } } };
}

export function completeStrengthSessionRestTimer(
  session: StrengthGuidedSessionDraft,
  completedAt: string
): { valid: true; session: StrengthGuidedSessionDraft } | { valid: false; error: string } {
  if (!validateStrengthGuidedSessionDraft(session) || !isCanonicalInstant(completedAt)
    || session.restTimer?.status !== 'running') {
    return { valid: false, error: 'There is no running rest timer to complete.' };
  }
  if (Date.parse(completedAt) < Date.parse(session.restTimer.deadlineAt)) {
    return { valid: false, error: 'The rest period has not reached its deadline.' };
  }
  return {
    valid: true,
    session: { ...session, restTimer: { status: 'complete', durationSeconds: session.restTimer.durationSeconds } }
  };
}

export function skipStrengthSessionSet(
  session: StrengthGuidedSessionDraft,
  exerciseId: string,
  setId: string
): { valid: true; session: StrengthGuidedSessionDraft } | { valid: false; error: string } {
  if (!validateStrengthGuidedSessionDraft(session)) {
    return { valid: false, error: 'The guided workout session is invalid.' };
  }
  let found = false;
  let alreadyResolved = false;
  const exercises = session.exercises.map(exercise => exercise.id !== exerciseId
    ? exercise
    : {
        ...exercise,
        sets: exercise.sets.map(set => {
          if (set.id !== setId) return set;
          found = true;
          if (set.status !== 'pending') {
            alreadyResolved = true;
            return set;
          }
          return { ...set, status: 'skipped' as const };
        })
      });
  if (!found) return { valid: false, error: 'The selected exercise set is unavailable.' };
  if (alreadyResolved) return { valid: false, error: 'Only a pending set can be skipped.' };
  return { valid: true, session: { ...session, exercises } };
}

export function finishStrengthGuidedSession(
  session: StrengthGuidedSessionDraft,
  logId: string,
  finishedAt: string
): { valid: true; log: StrengthWorkoutLog } | { valid: false; error: string } {
  if (!validateStrengthGuidedSessionDraft(session)
    || !isNonEmptyText(logId, 160)
    || !isCanonicalInstant(finishedAt)
    || Date.parse(finishedAt) < Date.parse(session.startedAt)
    || session.exercises.some(exercise => exercise.sets.some(set =>
      set.status === 'performed' && Date.parse(set.confirmedAt) > Date.parse(finishedAt)
    ))) {
    return { valid: false, error: 'The guided workout cannot be finished with invalid session timestamps.' };
  }
  const log: StrengthWorkoutLog = {
    id: logId,
    date: session.date,
    muscleIds: performedStrengthMuscleIds(session.exercises),
    ...(session.notes === undefined ? {} : { notes: session.notes }),
    savedWorkoutId: session.templateId,
    workoutName: session.workoutName,
    startedAt: session.startedAt,
    finishedAt,
    timeZone: session.timeZone,
    ...(session.sharedWith.length ? { sharedWith: [...session.sharedWith] } : {}),
    supersetGroups: (session.supersetGroups ?? []).map(group => ({
      ...group,
      exerciseIds: [...group.exerciseIds] as [string, string]
    })),
    ...(session.rhythmId === undefined ? {} : {
      rhythmId: session.rhythmId,
      rhythmOccurrence: session.date,
      completionId: session.completionId
    }),
    exercises: session.exercises.map(cloneStrengthExerciseSnapshot)
  };
  return { valid: true, log };
}

export function hasPerformedStrengthSessionSet(session: StrengthGuidedSessionDraft): boolean {
  return validateStrengthGuidedSessionDraft(session)
    && session.exercises.some(exercise => exercise.sets.some(set => set.status === 'performed'));
}

export type StrengthPreviousSetValues = {
  workout: StrengthWorkoutLog;
  reps?: number;
  load?: StrengthLoad;
  loadMeaningMismatch: boolean;
};

export function selectPreviousStrengthSetValues(
  workouts: readonly StrengthWorkoutLog[],
  session: StrengthGuidedSessionDraft,
  exerciseId: string,
  setIndex: number
): StrengthPreviousSetValues | null {
  const currentExercise = session.exercises.find(exercise => exercise.id === exerciseId);
  if (!currentExercise || !Number.isInteger(setIndex) || setIndex < 0) return null;
  const previous = workouts
    .filter(log => log.id !== session.id && log.savedWorkoutId === session.templateId
      && log.date <= session.date && log.exercises?.some(exercise => exercise.id === exerciseId))
    .sort((left, right) => right.date.localeCompare(left.date)
      || (right.finishedAt ?? '').localeCompare(left.finishedAt ?? ''))[0];
  if (!previous) return null;
  const previousExercise = previous.exercises?.find(exercise => exercise.id === exerciseId);
  const previousSet = previousExercise?.sets[setIndex];
  if (!previousExercise || !previousSet) {
    return { workout: previous, loadMeaningMismatch: false };
  }
  const isPerformed = previousSet.status === 'performed';
  const reps = isPerformed ? previousSet.actualReps : previousSet.targetReps;
  const load = isPerformed ? previousSet.actualLoad : previousSet.targetLoad;
  if (load === undefined) {
    return {
      workout: previous,
      ...(reps === undefined ? {} : { reps }),
      loadMeaningMismatch: false
    };
  }
  const currentLoad = currentExercise.sets[setIndex]?.targetLoad;
  const currentMeaning = currentLoad?.kind === 'bodyweight'
    ? 'bodyweight'
    : currentLoad?.kind === 'external'
      ? currentLoad.meaning
      : currentExercise.loadMeaning;
  const compatible = load.kind === 'bodyweight'
    ? currentMeaning === 'bodyweight'
    : currentMeaning === load.meaning;
  if (!compatible) {
    return {
      workout: previous,
      ...(reps === undefined ? {} : { reps }),
      loadMeaningMismatch: true
    };
  }
  return {
    workout: previous,
    ...(reps === undefined ? {} : { reps }),
    load: load.kind === 'external' && currentLoad?.kind === 'external'
      ? convertStrengthLoad(load, currentLoad.unit)
      : { ...load },
    loadMeaningMismatch: false
  };
}

export function moveStrengthSessionToSet(
  session: StrengthGuidedSessionDraft,
  exerciseIndex: number,
  setId: string
): { valid: true; session: StrengthGuidedSessionDraft } | { valid: false; error: string } {
  if (!validateStrengthGuidedSessionDraft(session)
    || !Number.isInteger(exerciseIndex) || exerciseIndex < 0 || exerciseIndex >= session.exercises.length
    || !session.exercises[exerciseIndex]!.sets.some(set => set.id === setId)) {
    return { valid: false, error: 'The selected exercise set is unavailable.' };
  }
  return {
    valid: true,
    session: {
      ...session,
      currentExerciseIndex: exerciseIndex,
      currentSetId: setId,
      ...(exerciseIndex !== session.currentExerciseIndex
        && (session.restTimer?.status === 'idle' || session.restTimer?.status === 'complete')
        ? {
            restTimer: {
              status: 'idle' as const,
              durationSeconds: session.exercises[exerciseIndex]!.restDurationSeconds
            }
          }
        : {})
    }
  };
}

export function updateStrengthGuidedSession(
  session: StrengthGuidedSessionDraft,
  changes: Partial<Pick<StrengthGuidedSessionDraft, 'date' | 'startedAt' | 'notes'>>
): { valid: true; session: StrengthGuidedSessionDraft } | { valid: false; error: string } {
  if (!validateStrengthGuidedSessionDraft(session)) {
    return { valid: false, error: 'The guided workout session is invalid.' };
  }
  const next = {
    ...session,
    ...changes,
    ...(changes.date === undefined || session.rhythmId === undefined
      ? {}
      : { rhythmOccurrence: changes.date })
  };
  return validateStrengthGuidedSessionDraft(next)
    ? { valid: true, session: next }
    : { valid: false, error: 'The workout date or start time cannot be later than a confirmed set.' };
}

export function updateStrengthGuidedExerciseNotes(
  session: StrengthGuidedSessionDraft,
  exerciseId: string,
  notes: string
): { valid: true; session: StrengthGuidedSessionDraft } | { valid: false; error: string } {
  if (!validateStrengthGuidedSessionDraft(session) || !isOptionalText(notes, 1000)) {
    return { valid: false, error: 'Exercise notes must be 1,000 characters or fewer.' };
  }
  let found = false;
  const exercises = session.exercises.map(exercise => {
    if (exercise.id !== exerciseId) return exercise;
    found = true;
    const updated = { ...exercise };
    if (notes) updated.notes = notes;
    else delete updated.notes;
    return updated;
  });
  return found
    ? { valid: true, session: { ...session, exercises } }
    : { valid: false, error: 'The selected exercise is unavailable.' };
}

export function updateStrengthGuidedExerciseLoadMeaning(
  session: StrengthGuidedSessionDraft,
  exerciseId: string,
  loadMeaning: StrengthLoadMeaning
): { valid: true; session: StrengthGuidedSessionDraft } | { valid: false; error: string } {
  if (!validateStrengthGuidedSessionDraft(session) || !isStrengthLoadMeaning(loadMeaning)) {
    return { valid: false, error: 'Choose a valid exercise load meaning.' };
  }
  let found = false;
  const exercises = session.exercises.map(exercise => {
    if (exercise.id !== exerciseId) return exercise;
    found = true;
    return { ...exercise, loadMeaning };
  });
  return found
    ? { valid: true, session: { ...session, exercises } }
    : { valid: false, error: 'The selected exercise is unavailable.' };
}

export function addStrengthSessionSet(
  session: StrengthGuidedSessionDraft,
  exerciseId: string,
  set: StrengthPlannedSet
): { valid: true; session: StrengthGuidedSessionDraft } | { valid: false; error: string } {
  if (!validateStrengthGuidedSessionDraft(session)) {
    return { valid: false, error: 'The current guided workout is invalid.' };
  }
  const exerciseIndex = session.exercises.findIndex(exercise => exercise.id === exerciseId);
  if (exerciseIndex < 0 || session.exercises.some(exercise => exercise.sets.some(item => item.id === set.id))) {
    return { valid: false, error: 'The selected exercise or set identity is unavailable.' };
  }
  const exercise = session.exercises[exerciseIndex]!;
  if (!validateExercises([{ ...exercise, sets: [set] }], false)) {
    return { valid: false, error: 'The extra set values are invalid.' };
  }
  const exercises = session.exercises.map((exercise, index) => index !== exerciseIndex
    ? exercise
    : { ...exercise, sets: [...exercise.sets, { ...cloneStrengthSet(set), status: 'pending' as const }] });
  return {
    valid: true,
    session: {
      ...session,
      exercises,
      currentExerciseIndex: exerciseIndex,
      currentSetId: set.id
    }
  };
}

export function correctStrengthSessionSet(
  session: StrengthGuidedSessionDraft,
  exerciseId: string,
  setId: string,
  actualReps: number,
  actualLoad?: StrengthLoad
): { valid: true; session: StrengthGuidedSessionDraft } | { valid: false; error: string } {
  if (!validateStrengthGuidedSessionDraft(session) || !isPositiveInteger(actualReps, 1000)
    || actualLoad !== undefined && !validateStrengthLoad(actualLoad)) {
    return { valid: false, error: 'The corrected set values are invalid.' };
  }
  let found = false;
  let performed = false;
  const exercises = session.exercises.map(exercise => exercise.id !== exerciseId
    ? exercise
    : {
        ...exercise,
        sets: exercise.sets.map(set => {
          if (set.id !== setId) return set;
          found = true;
          if (set.status !== 'performed') return set;
          performed = true;
          return {
            ...set,
            actualReps,
            ...(actualLoad === undefined ? {} : { actualLoad: { ...actualLoad } })
          };
        })
      });
  if (!found || !performed) return { valid: false, error: 'Only a performed set can be corrected.' };
  return { valid: true, session: { ...session, exercises } };
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

export type StrengthWorkoutHistoryGroup = {
  key: string;
  label: string;
  logs: StrengthWorkoutLog[];
};

export type StrengthWorkoutHistory = {
  total: number;
  visibleLogs: StrengthWorkoutLog[];
  groups: StrengthWorkoutHistoryGroup[];
  hasMore: boolean;
};

export function selectStrengthWorkoutHistory(
  workouts: readonly StrengthWorkoutLog[],
  visibleLimit = 10
): StrengthWorkoutHistory {
  const ordered = [...workouts].sort((a, b) => compareText(b.date, a.date) || compareText(b.id, a.id));
  const limit = Math.max(0, Math.floor(visibleLimit));
  const visibleLogs = ordered.slice(0, limit);
  const groups: StrengthWorkoutHistoryGroup[] = [];
  for (const log of visibleLogs) {
    const [year, month] = log.date.split('-');
    const key = `${year}-${month}`;
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      const monthDate = new Date(Date.UTC(Number(year), Number(month) - 1, 1, 12));
      group = {
        key,
        label: Number.isFinite(monthDate.getTime())
          ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(monthDate)
          : 'Date unavailable',
        logs: []
      };
      groups.push(group);
    }
    group.logs.push(log);
  }
  return {
    total: ordered.length,
    visibleLogs,
    groups,
    hasMore: visibleLogs.length < ordered.length
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

function validateStrengthScoringSettingsHistory(
  value: unknown,
  trackingStartDate: unknown
): value is StrengthScoringSettingsVersion[] {
  if (!Array.isArray(value)) return false;
  if (trackingStartDate === undefined) return value.length === 0;
  if (typeof trackingStartDate !== 'string' || !isValidDate(trackingStartDate)
    || value.length === 0 || !isRecord(value[0]) || value[0].effectiveDate !== trackingStartDate) return false;
  let previousDate = '';
  for (const version of value) {
    if (!isRecord(version) || !hasOnlyKeys(version, ['effectiveDate', 'muscleIntervals', 'preferredRestDays'])
      || typeof version.effectiveDate !== 'string' || !isValidDate(version.effectiveDate)
      || version.effectiveDate <= previousDate
      || !isRecord(version.muscleIntervals) || !isRecord(version.preferredRestDays)) return false;
    const intervals = version.muscleIntervals;
    const rests = version.preferredRestDays;
    if (Object.keys(intervals).length !== strengthMuscles.length
      || Object.keys(rests).length !== strengthMuscles.length) return false;
    for (const muscle of strengthMuscles) {
      const interval = intervals[muscle.id];
      const rest = rests[muscle.id];
      if (!Number.isInteger(interval) || Number(interval) < 1 || Number(interval) > 365
        || !Number.isInteger(rest) || Number(rest) < (muscle.id === 'abs' ? 0 : 1)
        || Number(rest) > 364 || Number(rest) >= Number(interval)) return false;
    }
    previousDate = version.effectiveDate;
  }
  return true;
}

function validateStrengthWorkout(value: StrengthSavedWorkout): boolean {
  return isNonEmptyText(value.id, 160) && isNonEmptyText(value.name, 120)
    && Array.isArray(value.muscleIds) && value.muscleIds.length > 0
    && value.muscleIds.every(isStrengthMuscleId)
    && Array.isArray(value.sharedWith) && value.sharedWith.every(isPersonId)
    && (value.suggestionSourceId === undefined || isNonEmptyText(value.suggestionSourceId, 160))
    && (value.exercises === undefined || validateExercises(value.exercises, false))
    && (value.supersetGroups === undefined
      || validateSupersetGroups(value.supersetGroups, value.exercises ?? []));
}

export function validateStrengthWorkoutExercise(value: unknown): value is StrengthWorkoutExercise {
  return validateExercises([value], false);
}

export function cloneStrengthSavedWorkout(workout: StrengthSavedWorkout): StrengthSavedWorkout {
  return {
    ...workout,
    muscleIds: [...workout.muscleIds],
    sharedWith: [...workout.sharedWith],
    ...(workout.exercises === undefined
      ? {}
      : { exercises: workout.exercises.map(cloneStrengthExercise) }),
    ...(workout.supersetGroups === undefined ? {} : {
      supersetGroups: cloneSupersetGroups(workout.supersetGroups)
    })
  };
}

export function cloneStrengthWorkoutLog(log: StrengthWorkoutLog): StrengthWorkoutLog {
  return {
    ...log,
    muscleIds: [...log.muscleIds],
    ...(log.sharedWith === undefined ? {} : { sharedWith: [...log.sharedWith] }),
    ...(log.exercises === undefined
      ? {}
      : { exercises: log.exercises.map(cloneStrengthExerciseSnapshot) }),
    ...(log.supersetGroups === undefined ? {} : {
      supersetGroups: cloneSupersetGroups(log.supersetGroups)
    })
  };
}

export function cloneStrengthGuidedSessionDraft(
  session: StrengthGuidedSessionDraft
): StrengthGuidedSessionDraft {
  return {
    ...session,
    muscleIds: [...session.muscleIds],
    sharedWith: [...session.sharedWith],
    ...(session.restTimer === undefined ? {} : { restTimer: { ...session.restTimer } }),
    ...(session.exerciseTimer === undefined ? {} : { exerciseTimer: { ...session.exerciseTimer } }),
    ...(session.supersetGroups === undefined ? {} : {
      supersetGroups: cloneSupersetGroups(session.supersetGroups)
    }),
    exercises: session.exercises.map(cloneStrengthExerciseSnapshot)
  };
}

function normalizeStrengthExercise<T extends StrengthWorkoutExercise | StrengthWorkoutExerciseSnapshot>(exercise: T): T {
  return {
    ...exercise,
    sets: exercise.sets.map(set => ({
      ...set,
      measurement: set.measurement ?? { kind: 'reps' }
    }))
  } as T;
}

function normalizeStrengthSavedWorkout(workout: StrengthSavedWorkout): StrengthSavedWorkout {
  const cloned = cloneStrengthSavedWorkout(workout);
  return {
    ...cloned,
    ...(cloned.exercises === undefined ? {} : { exercises: cloned.exercises.map(normalizeStrengthExercise) }),
    supersetGroups: cloned.supersetGroups ?? []
  };
}

function normalizeStrengthWorkoutLog(log: StrengthWorkoutLog): StrengthWorkoutLog {
  const cloned = cloneStrengthWorkoutLog(log);
  return {
    ...cloned,
    ...(cloned.exercises === undefined ? {} : { exercises: cloned.exercises.map(normalizeStrengthExercise) }),
    supersetGroups: cloned.supersetGroups ?? []
  };
}

function cloneStrengthExercise(exercise: StrengthWorkoutExercise): StrengthWorkoutExercise {
  return {
    ...exercise,
    muscleIds: [...exercise.muscleIds],
    sets: exercise.sets.map(cloneStrengthSet)
  };
}

function cloneStrengthSet(set: StrengthPlannedSet): StrengthPlannedSet {
  return {
    ...set,
    ...(set.measurement === undefined ? {} : { measurement: { ...set.measurement } }),
    ...(set.targetLoad === undefined ? {} : { targetLoad: { ...set.targetLoad } })
  };
}

function cloneStrengthExerciseSnapshot(
  exercise: StrengthWorkoutExerciseSnapshot
): StrengthWorkoutExerciseSnapshot {
  return {
    ...exercise,
    muscleIds: [...exercise.muscleIds],
    sets: exercise.sets.map(set => ({
      ...set,
      ...(set.measurement === undefined ? {} : { measurement: { ...set.measurement } }),
      ...(set.targetLoad === undefined ? {} : { targetLoad: { ...set.targetLoad } }),
      ...(set.status === 'performed' && set.actualLoad !== undefined
        ? { actualLoad: { ...set.actualLoad } }
        : {})
    }))
  };
}

function validateExercises(value: unknown, snapshots: false, requireV25?: boolean): value is StrengthWorkoutExercise[];
function validateExercises(value: unknown, snapshots: true, requireV25?: boolean): value is StrengthWorkoutExerciseSnapshot[];
function validateExercises(value: unknown, snapshots: boolean, requireV25 = false): boolean {
  if (!Array.isArray(value) || value.length === 0) return false;
  const exerciseIds = new Set<string>();
  for (const exercise of value) {
    if (!isRecord(exercise) || !isNonEmptyText(exercise.id, 160)
      || exerciseIds.has(exercise.id)
      || !isNonEmptyText(exercise.name, 120)
      || !Array.isArray(exercise.muscleIds) || exercise.muscleIds.length === 0
      || !exercise.muscleIds.every(isStrengthMuscleId)
      || new Set(exercise.muscleIds).size !== exercise.muscleIds.length
      || !isNonEmptyText(exercise.equipment, 80)
      || exercise.loadMeaning !== undefined && !isStrengthLoadMeaning(exercise.loadMeaning)
      || !isOptionalText(exercise.notes, 1000)
      || !Number.isInteger(exercise.restDurationSeconds)
      || Number(exercise.restDurationSeconds) < 0 || Number(exercise.restDurationSeconds) > 3600
      || exercise.restDurationOverridden !== undefined && typeof exercise.restDurationOverridden !== 'boolean'
      || !Array.isArray(exercise.sets) || exercise.sets.length === 0) return false;
    exerciseIds.add(exercise.id);
    const setIds = new Set<string>();
    for (const set of exercise.sets) {
      if (!isRecord(set) || !isNonEmptyText(set.id, 160) || setIds.has(set.id)) return false;
      const measurementKind = set.measurement === undefined
        ? 'reps'
        : isRecord(set.measurement) ? set.measurement.kind : undefined;
      if (requireV25 && set.measurement === undefined
        || set.measurement !== undefined && (!isRecord(set.measurement)
        || measurementKind === 'reps' && !hasOnlyKeys(set.measurement, ['kind'])
        || measurementKind === 'duration'
          && (!hasOnlyKeys(set.measurement, ['kind', 'targetDurationSeconds'])
            || !isPositiveInteger(set.measurement.targetDurationSeconds, 86_400))
        || measurementKind !== 'reps' && measurementKind !== 'duration')) return false;
      if (measurementKind === 'duration'
        ? set.targetReps !== undefined
        : set.targetReps !== undefined && !isPositiveInteger(set.targetReps, 1000)) return false;
      if (set.targetLoad !== undefined && !validateStrengthLoad(set.targetLoad)) return false;
      if (exercise.loadMeaning !== undefined) {
        const actualLoad = snapshots && set.status === 'performed' ? set.actualLoad : undefined;
        const loads = [set.targetLoad, actualLoad].filter((load): load is StrengthLoad => load !== undefined);
        if (exercise.loadMeaning === 'bodyweight'
          ? loads.some(load => load.kind !== 'bodyweight')
          : loads.some(load => load.kind !== 'external' || load.meaning !== exercise.loadMeaning)) return false;
      }
      setIds.add(set.id);
      if (snapshots) {
        if (!validateSetPerformance(set, measurementKind)) return false;
      } else if (!hasOnlyKeys(set, ['id', 'measurement', 'targetReps', 'targetLoad'])
        || (measurementKind === 'duration'
          ? !(isRecord(set.measurement)
            && isPositiveInteger(set.measurement.targetDurationSeconds, 86_400))
          : set.targetReps === undefined && set.targetLoad === undefined)) {
        return false;
      }
    }
    if (!snapshots && !hasOnlyKeys(exercise, [
      'id', 'name', 'muscleIds', 'equipment', 'loadMeaning', 'notes', 'restDurationSeconds',
      'restDurationOverridden', 'sets'
    ])) return false;
    if (snapshots && !hasOnlyKeys(exercise, [
      'id', 'name', 'muscleIds', 'equipment', 'loadMeaning', 'notes', 'restDurationSeconds',
      'restDurationOverridden', 'sets'
    ])) return false;
  }
  return true;
}

function validateSupersetGroups(value: unknown, exercises: unknown): value is StrengthSupersetGroup[] {
  if (!Array.isArray(value) || !Array.isArray(exercises)) return false;
  const ids = new Set<string>();
  const members = new Set<string>();
  for (const group of value) {
    if (!isRecord(group) || !hasOnlyKeys(group, [
      'id', 'exerciseIds', 'restDurationSeconds', 'restDurationOverridden'
    ])
      || !isNonEmptyText(group.id, 160) || ids.has(group.id)
      || !Array.isArray(group.exerciseIds) || group.exerciseIds.length !== 2
      || !group.exerciseIds.every(id => isNonEmptyText(id, 160))
      || group.exerciseIds[0] === group.exerciseIds[1]
      || !isNonNegativeInteger(group.restDurationSeconds, 3600)
      || group.restDurationOverridden !== undefined && typeof group.restDurationOverridden !== 'boolean') return false;
    const exerciseIds = group.exerciseIds as [string, string];
    const firstId = exerciseIds[0];
    const secondId = exerciseIds[1];
    const first = exercises.findIndex(item => isRecord(item) && item.id === firstId);
    const second = exercises.findIndex(item => isRecord(item) && item.id === secondId);
    if (first < 0 || second !== first + 1
      || members.has(firstId) || members.has(secondId)) return false;
    ids.add(group.id);
    members.add(firstId);
    members.add(secondId);
  }
  return true;
}

function cloneSupersetGroups(groups: readonly StrengthSupersetGroup[]): StrengthSupersetGroup[] {
  return groups.map(group => ({ ...group, exerciseIds: [...group.exerciseIds] as [string, string] }));
}

function validateStrengthExerciseTimer(value: unknown): value is StrengthExerciseTimer {
  if (!isRecord(value) || !isNonNegativeInteger(value.elapsedMilliseconds, Number.MAX_SAFE_INTEGER)) return false;
  switch (value.status) {
    case 'idle':
      return hasOnlyKeys(value, ['status', 'elapsedMilliseconds']) && value.elapsedMilliseconds === 0;
    case 'running':
      return hasOnlyKeys(value, ['status', 'elapsedMilliseconds', 'startedAt', 'exerciseId', 'setId'])
        && isCanonicalInstant(value.startedAt)
        && isNonEmptyText(value.exerciseId, 160)
        && isNonEmptyText(value.setId, 160);
    case 'paused':
      return hasOnlyKeys(value, ['status', 'elapsedMilliseconds', 'exerciseId', 'setId'])
        && isNonEmptyText(value.exerciseId, 160)
        && isNonEmptyText(value.setId, 160);
    default:
      return false;
  }
}

function exerciseTimerReferencesTimedSet(timer: unknown, exercises: unknown): boolean {
  if (!validateStrengthExerciseTimer(timer)) return false;
  if (timer.status === 'idle') return true;
  return Array.isArray(exercises) && exercises.some(exercise => isRecord(exercise)
    && exercise.id === timer.exerciseId && Array.isArray(exercise.sets)
    && exercise.sets.some(set => isRecord(set) && set.id === timer.setId
      && isRecord(set.measurement) && set.measurement.kind === 'duration'));
}

function validateSetPerformance(set: Record<string, unknown>, measurementKind: unknown): boolean {
  if (set.status === 'pending' || set.status === 'skipped') {
    return hasOnlyKeys(set, ['id', 'measurement', 'targetReps', 'targetLoad', 'status']);
  }
  if (set.status !== 'performed' || !isCanonicalInstant(set.confirmedAt)
    || set.actualLoad !== undefined && !validateStrengthLoad(set.actualLoad)) return false;
  const allowed = ['id', 'measurement', 'targetReps', 'targetLoad', 'status', 'actualLoad', 'confirmedAt'];
  return measurementKind === 'duration'
    ? hasOnlyKeys(set, [...allowed, 'actualDurationSeconds'])
      && isPositiveInteger(set.actualDurationSeconds, 86_400)
      && set.actualReps === undefined
    : hasOnlyKeys(set, [...allowed, 'actualReps'])
      && isPositiveInteger(set.actualReps, 1000)
      && set.actualDurationSeconds === undefined;
}

function validateExerciseSnapshots(value: unknown, requireV25 = false): value is StrengthWorkoutExerciseSnapshot[] {
  return validateExercises(value, true, requireV25);
}

function validateStrengthLoad(value: unknown): value is StrengthLoad {
  if (!isRecord(value)) return false;
  if (value.kind === 'bodyweight') return hasOnlyKeys(value, ['kind']);
  return value.kind === 'external'
    && hasOnlyKeys(value, ['kind', 'meaning', 'value', 'unit'])
    && (value.meaning === 'total' || value.meaning === 'per-dumbbell' || value.meaning === 'per-side')
    && (value.unit === 'lb' || value.unit === 'kg')
    && typeof value.value === 'number'
    && Number.isFinite(value.value)
    && value.value >= 0
    && value.value <= 10000;
}

function isStrengthLoadMeaning(value: unknown): value is StrengthLoadMeaning {
  return value === 'total' || value === 'per-dumbbell' || value === 'per-side' || value === 'bodyweight';
}

function exerciseConfirmationsWithin(
  exercises: unknown,
  startedAt: unknown,
  finishedAt?: unknown
): boolean {
  if (!Array.isArray(exercises) || !isCanonicalInstant(startedAt)) return false;
  const start = Date.parse(startedAt);
  const finish = finishedAt === undefined
    ? Number.POSITIVE_INFINITY
    : isCanonicalInstant(finishedAt) ? Date.parse(finishedAt) : Number.NaN;
  return exercises.every(exercise => isRecord(exercise)
    && Array.isArray(exercise.sets)
    && exercise.sets.every(set => isRecord(set)
      && (set.status !== 'performed'
        || isCanonicalInstant(set.confirmedAt)
          && Date.parse(set.confirmedAt) >= start
          && Date.parse(set.confirmedAt) <= finish)));
}

function exerciseMusclesMatchPerformedSets(exercises: unknown, muscleIds: unknown): boolean {
  if (!Array.isArray(muscleIds) || !muscleIds.every(isStrengthMuscleId)) return false;
  const expected = performedStrengthMuscleIds(exercises);
  return expected.length === muscleIds.length && expected.every((id, index) => id === muscleIds[index]);
}

function performedStrengthMuscleIds(exercises: unknown): StrengthMuscleId[] {
  if (!Array.isArray(exercises)) return [];
  const performed = new Set<StrengthMuscleId>();
  for (const exercise of exercises) {
    if (!isRecord(exercise) || !Array.isArray(exercise.muscleIds) || !Array.isArray(exercise.sets)
      || !exercise.muscleIds.every(isStrengthMuscleId)) continue;
    if (exercise.sets.some(set => isRecord(set) && set.status === 'performed')) {
      for (const muscleId of exercise.muscleIds) performed.add(muscleId);
    }
  }
  return strengthMuscles.filter(muscle => performed.has(muscle.id)).map(muscle => muscle.id);
}

function isPositiveInteger(value: unknown, maximum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= maximum;
}

function isCanonicalInstant(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function isValidTimeZone(value: unknown): value is string {
  if (!isNonEmptyText(value, 100)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
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
