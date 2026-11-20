import {
  convertStrengthLoad,
  isStrengthAddedLoadExercise,
  selectStrengthExerciseVolume,
  selectStrengthExerciseProgress
} from '../domain/strength.ts';
import type {
  StrengthOneRepMaxEstimate,
  StrengthExerciseSetProgress,
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
  const progress = selectStrengthExerciseProgress(
    workouts, reference, exercise, preferredWeightUnit
  );
  const previousVolume = progress.previousExercise
    ? selectStrengthExerciseVolume(progress.previousExercise, preferredWeightUnit)
    : null;
  const headline = formatHeadlineDelta(
    progress.currentBest,
    progress.previousBest,
    Boolean(progress.previousExercise)
  );
  const roughEstimate = (progress.currentBest?.reps ?? 0) > 15;
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
      <div className="strength-exercise-results__headline">
        <div className="strength-exercise-results__headline-main">
          <span className="strength-exercise-results__headline-label">
            {roughEstimate ? 'EST. 1RM*' : 'EST. 1RM'}
          </span>
          <span className="strength-exercise-results__headline-value">
            {progress.currentBest ? formatNumber(progress.currentBest.value) : '—'}
            <span>
              lb{progress.currentBest ? formatMeaning(progress.currentBest.meaning) : ''}
            </span>
          </span>
        </div>
        <span className={`strength-exercise-results__headline-delta strength-exercise-results__headline-delta--${headline.tone}`}
          aria-label={headline.accessibleName}>
          {headline.text}
        </span>
      </div>
      <ol className="strength-exercise-results__sets">
        {exercise.sets.map((set, index) => {
          const value = set.status === 'performed'
            ? formatPerformedSet(set, preferredWeightUnit, exercise)
            : null;
          const setProgress = formatSetProgress(progress.sets[index]!, index + 1, preferredWeightUnit);
          return (
            <li key={set.id} className={`strength-exercise-results__set strength-exercise-results__set--${set.status}`}>
              <span className="strength-exercise-results__set-number">Set {index + 1}</span>
              <span className="strength-exercise-results__set-value">
                {value ?? (set.status === 'skipped' ? 'Skipped' : 'Unfinished')}
                {set.label && <span className="strength-exercise-results__set-label"> · {set.label}</span>}
              </span>
              <span className={`strength-exercise-results__set-delta strength-exercise-results__set-delta--${setProgress.tone}`}
                aria-label={setProgress.accessibleName}>
                {setProgress.text}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="strength-exercise-results__volume" aria-label="Exercise volume">
        <span>
          Volume {formatVolumeSummary(volume)}
          {progress.previousExercise && ` · last session ${formatVolumeSummary(previousVolume)}`}
        </span>
        {roughEstimate && <span className="strength-exercise-results__footnote">* rough estimate at high rep ranges</span>}
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

type ExerciseVolume = NonNullable<ReturnType<typeof selectStrengthExerciseVolume>>;

function formatVolumeSummary(volume: ExerciseVolume | null): string {
  if (!volume) return 'unavailable';
  return `${formatVolume(volume.value, volume.unit)}${formatMeaning(volume.meaning)}${volume.status === 'partial' ? ' · partial' : ''}`;
}

type HeadlineDelta = {
  text: string;
  accessibleName: string;
  tone: 'positive' | 'muted' | 'baseline' | 'unavailable';
};

function formatHeadlineDelta(
  current: StrengthOneRepMaxEstimate | null,
  previous: StrengthOneRepMaxEstimate | null,
  hasPreviousSession: boolean
): HeadlineDelta {
  if (!current) {
    return { text: 'Unavailable', accessibleName: 'Estimated 1RM unavailable', tone: 'unavailable' };
  }
  const currentLabel = `Est. 1RM ${formatNumber(current.value)} pounds${formatMeaning(current.meaning)}`;
  if (!hasPreviousSession) {
    return {
      text: 'Baseline',
      accessibleName: `${currentLabel}, baseline with no previous session`,
      tone: 'baseline'
    };
  }
  if (!previous || current.meaning !== previous.meaning) {
    return {
      text: 'No comparison',
      accessibleName: `${currentLabel}, no comparable previous estimate`,
      tone: 'unavailable'
    };
  }
  const delta = current.value - previous.value;
  if (delta > 0) {
    return {
      text: `▲ +${formatNumber(delta)} vs. last`,
      accessibleName: `${currentLabel}, up ${formatNumber(delta)} pounds from last session`,
      tone: 'positive'
    };
  }
  if (delta < 0) {
    return {
      text: `▼ ${formatNumber(delta)} vs. last`,
      accessibleName: `${currentLabel}, down ${formatNumber(Math.abs(delta))} pounds from last session`,
      tone: 'muted'
    };
  }
  return {
    text: 'Same as last',
    accessibleName: `${currentLabel}, same as last session`,
    tone: 'muted'
  };
}

type SetDelta = {
  text: string;
  accessibleName: string;
  tone: 'positive' | 'muted' | 'first' | 'unavailable';
};

function formatSetProgress(
  progress: StrengthExerciseSetProgress,
  setNumber: number,
  unit: 'lb' | 'kg'
): SetDelta {
  const label = `Set ${setNumber}`;
  if (progress.kind === 'first-log') {
    return { text: 'First log', accessibleName: `${label}: first log`, tone: 'first' };
  }
  if (progress.kind === 'same') {
    return { text: 'Same', accessibleName: `${label}: same as last session`, tone: 'muted' };
  }
  if (progress.kind === 'not-performed') {
    const text = progress.status === 'skipped' ? 'Skipped' : 'Unfinished';
    return { text, accessibleName: `${label}: ${text.toLowerCase()}`, tone: 'unavailable' };
  }
  if (progress.kind === 'unavailable') {
    return { text: 'No comparison', accessibleName: `${label}: no comparable previous performance`, tone: 'unavailable' };
  }

  const changes = [
    ...(progress.weightDelta !== null && progress.weightDelta !== 0
      ? [{ value: progress.weightDelta, unit: unit === 'lb' ? 'pound' : 'kilogram' }]
      : []),
    ...(progress.repsDelta !== null && progress.repsDelta !== 0
      ? [{ value: progress.repsDelta, unit: 'rep' }]
      : [])
  ];
  if (changes.length === 0) {
    const text = progress.weightDelta === 0 ? 'Same weight' : 'Same reps';
    return { text, accessibleName: `${label}: ${text.toLowerCase()}`, tone: 'muted' };
  }

  const directions = new Set(changes.map(change => Math.sign(change.value)));
  const commonDirection = directions.size === 1;
  const arrowFor = (value: number) => value > 0 ? '▲' : '▼';
  const amountFor = (value: number, dimension: string) =>
    `${value > 0 ? '+' : ''}${formatNumber(value, 1)} ${dimension === 'rep' ? 'rep' : unit}`;
  const text = commonDirection
    ? `${arrowFor(changes[0]!.value)} ${changes.map(change => amountFor(change.value, change.unit)).join(' · ')}`
    : changes.map(change => `${arrowFor(change.value)} ${amountFor(change.value, change.unit)}`).join(' · ');
  const description = changes.map(change =>
    `${change.value > 0 ? 'up' : 'down'} ${formatNumber(Math.abs(change.value), 1)} ${change.unit}${change.unit === 'rep' && Math.abs(change.value) === 1 ? '' : 's'}`
  ).join(' and ');
  return {
    text,
    accessibleName: `${label}: ${description}`,
    tone: directions.has(-1) ? 'muted' : 'positive'
  };
}

function formatVolume(value: number, unit: 'lb' | 'kg'): string {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)} ${unit}`;
}

function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value);
}

function formatMeaning(meaning: 'total' | 'per-dumbbell' | 'per-side'): string {
  return meaning === 'total' ? '' : meaning === 'per-dumbbell' ? ' per dumbbell' : ' per side';
}
