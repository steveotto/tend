import {
  convertStrengthLoad,
  formatStrengthVolumeChangePercent,
  isStrengthAddedLoadExercise,
  selectStrengthExerciseVolume,
  selectStrengthExerciseVolumeComparison
} from '../domain/strength.ts';
import type {
  StrengthGuidedSessionDraft,
  StrengthWorkoutExerciseSnapshot,
  StrengthWorkoutLog
} from '../domain/strength.ts';

type Props = {
  exercise: StrengthWorkoutExerciseSnapshot;
  workouts: readonly StrengthWorkoutLog[];
  reference: Pick<StrengthGuidedSessionDraft, 'id' | 'date' | 'startedAt'> | Pick<StrengthWorkoutLog, 'id' | 'date' | 'startedAt'>;
  preferredWeightUnit: 'lb' | 'kg';
  presentation: 'history' | 'review';
  supersetContext?: string;
};

const loadMeaningLabels = {
  total: 'total weight',
  'per-dumbbell': 'per dumbbell',
  'per-side': 'per side',
  bodyweight: 'bodyweight'
} as const;

export function StrengthExerciseResults({
  exercise,
  workouts,
  reference,
  preferredWeightUnit,
  presentation,
  supersetContext
}: Props) {
  const volume = selectStrengthExerciseVolume(exercise, preferredWeightUnit);
  const previous = selectStrengthExerciseVolumeComparison(
    workouts, reference, exercise, preferredWeightUnit
  );
  const loadMeaning = isStrengthAddedLoadExercise(exercise)
    ? 'added weight'
    : exercise.loadMeaning ? loadMeaningLabels[exercise.loadMeaning] : null;
  const equipmentContext = loadMeaning && exercise.equipment.toLowerCase() !== loadMeaning.toLowerCase()
    ? `${exercise.equipment} · ${loadMeaning}`
    : exercise.equipment;

  return (
    <section
      className={`strength-exercise-results strength-exercise-results--${presentation}`}
      aria-label={`${exercise.name} ${presentation === 'history' ? 'results' : 'set summary'}`}
    >
      <h3>{exercise.name}</h3>
      {supersetContext && <p className="strength-exercise-results__superset">{supersetContext}</p>}
      <p className="strength-exercise-results__equipment">
        {equipmentContext}
      </p>
      <ol className="strength-exercise-results__sets">
        {exercise.sets.map((set, index) => {
          const value = set.status === 'performed'
            ? formatPerformedSet(set, preferredWeightUnit, exercise)
            : null;
          return (
            <li key={set.id} className={`strength-exercise-results__set strength-exercise-results__set--${set.status}`}>
              <span className="strength-exercise-results__set-number">Set {index + 1}</span>
              <span className="strength-exercise-results__set-value">
                {value ?? (set.status === 'skipped' ? 'Skipped' : 'Unfinished')}
                {presentation === 'history' && set.status === 'performed'
                  && <time dateTime={set.confirmedAt}> · {formatConfirmedAt(set.confirmedAt)}</time>}
              </span>
              {set.status === 'performed' && (
                <span className="strength-exercise-results__status strength-exercise-results__status--performed">
                  Performed
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <div className="strength-exercise-results__volume" aria-label="Exercise volume comparison">
        <span>
          {volume
            ? `${volume.label}: ${formatVolume(volume.value, volume.unit)}${formatMeaning(volume.meaning)}${volume.status === 'partial' ? ' · partial' : ''}`
            : 'Volume unavailable'}
        </span>
        <span>
          {previous
            ? `Previous: ${formatVolume(previous.volume.value, previous.volume.unit)}${formatMeaning(previous.volume.meaning)}${previous.volume.status === 'partial' ? ' · partial' : ''}`
            : 'Previous: unavailable'}
        </span>
        {previous?.changePercent !== undefined
          && <span>Change: {formatStrengthVolumeChangePercent(previous.changePercent)}</span>}
      </div>
      {exercise.notes && <p className="strength-exercise-results__notes">Exercise notes: {exercise.notes}</p>}
    </section>
  );
}

function formatPerformedSet(
  set: Extract<StrengthWorkoutExerciseSnapshot['sets'][number], { status: 'performed' }>,
  preferredWeightUnit: 'lb' | 'kg',
  exercise: StrengthWorkoutExerciseSnapshot
): string {
  if (set.measurement?.kind === 'duration') {
    const seconds = set.actualDurationSeconds ?? 0;
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }
  const reps = set.actualReps === undefined ? 'Reps unavailable' : `${set.actualReps} reps`;
  if (set.actualLoad?.kind === 'bodyweight') return `Bodyweight × ${reps}`;
  if (set.actualLoad?.kind !== 'external') return reps;
  const load = set.actualLoad.unit === preferredWeightUnit
    ? set.actualLoad
    : convertStrengthLoad(set.actualLoad, preferredWeightUnit);
  if (load.kind !== 'external') return reps;
  const loadLabel = `${formatVolume(load.value, load.unit)}${isStrengthAddedLoadExercise(exercise) ? ' added' : formatMeaning(load.meaning)}`;
  return `${loadLabel} × ${reps}`;
}

function formatVolume(value: number, unit: 'lb' | 'kg'): string {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)} ${unit}`;
}

function formatMeaning(meaning: 'total' | 'per-dumbbell' | 'per-side'): string {
  return meaning === 'total' ? '' : meaning === 'per-dumbbell' ? ' per dumbbell' : ' per side';
}

function formatConfirmedAt(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date)
    : 'Time unavailable';
}
