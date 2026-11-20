import {
  convertStrengthLoad,
  isStrengthAddedLoadExercise,
  selectStrengthExerciseVolume,
  selectStrengthExerciseVolumeComparison,
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
  const volumeComparison = selectStrengthExerciseVolumeComparison(
    workouts, reference, exercise, preferredWeightUnit
  );
  const previousVolume = volumeComparison?.volume ?? null;
  const headline = formatHeadlineDelta(
    progress.currentBest,
    progress.previousBest,
    Boolean(progress.previousExercise),
    preferredWeightUnit
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
              {preferredWeightUnit}{progress.currentBest ? formatMeaning(progress.currentBest.meaning) : ''}
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
          const accessibleValue = set.status === 'performed'
            && set.actualLoad?.kind === 'external'
            && set.actualLoad.meaning === 'per-dumbbell'
            ? `${formatPerformedSet(set, preferredWeightUnit, exercise, true)}${set.label ? ` · ${set.label}` : ''}`
            : null;
          const setProgress = formatSetProgress(progress.sets[index]!, index + 1, preferredWeightUnit);
          return (
            <li key={set.id} className={`strength-exercise-results__set strength-exercise-results__set--${set.status}`}>
              <span className="strength-exercise-results__set-number">Set {index + 1}</span>
              <span
                className="strength-exercise-results__set-value"
                aria-label={accessibleValue ?? undefined}
              >
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
      <div className="strength-exercise-results__volume" role="group" aria-label="Exercise volume comparison">
        <strong className="strength-exercise-results__volume-heading">
          {formatVolumeHeading(exercise, volume)}
        </strong>
        <div className="strength-exercise-results__volume-grid">
          <div className="strength-exercise-results__volume-group">
            <span className="strength-exercise-results__volume-label">Last session</span>
            <span className="strength-exercise-results__volume-value">
              {previousVolume
                ? formatVolumeValue(previousVolume)
                : progress.previousExercise
                  ? 'No comparable previous session'
                  : 'No previous session'}
            </span>
          </div>
          <div className="strength-exercise-results__volume-group strength-exercise-results__volume-group--current">
            <span className="strength-exercise-results__volume-label">This session</span>
            <span className="strength-exercise-results__volume-current">
              <span className="strength-exercise-results__volume-value">
                {volume ? formatVolumeValue(volume) : 'Unavailable'}
              </span>
              {volumeComparison?.changeValue !== undefined && (
                <span
                  className={`strength-exercise-results__set-delta${volumeComparison.changeValue <= 0
                    ? ' strength-exercise-results__set-delta--muted'
                    : ''}`}
                  aria-label={formatVolumeDeltaDescription(
                    volumeComparison.changeValue,
                    preferredWeightUnit,
                    volume?.meaning ?? previousVolume?.meaning
                  )}
                >
                  {formatVolumeDelta(volumeComparison.changeValue, preferredWeightUnit)}
                </span>
              )}
            </span>
          </div>
        </div>
        {roughEstimate && <span className="strength-exercise-results__footnote">* rough estimate at high rep ranges</span>}
      </div>
      {exercise.notes && <p className="strength-exercise-results__notes">Exercise notes: {exercise.notes}</p>}
    </section>
  );
}

function formatPerformedSet(
  set: Extract<StrengthWorkoutExerciseSnapshot['sets'][number], { status: 'performed' }>,
  preferredWeightUnit: 'lb' | 'kg',
  exercise: StrengthWorkoutExerciseSnapshot,
  includeDumbbellMeaning = false
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
  const meaning = load.meaning === 'per-dumbbell' && !includeDumbbellMeaning
    ? ''
    : formatMeaning(load.meaning);
  const loadLabel = `${formatVolume(load.value, load.unit)}${isStrengthAddedLoadExercise(exercise) ? ' added' : meaning}`;
  return `${loadLabel} × ${reps}`;
}

type ExerciseVolume = NonNullable<ReturnType<typeof selectStrengthExerciseVolume>>;

function formatVolumeHeading(
  exercise: StrengthWorkoutExerciseSnapshot,
  volume: ExerciseVolume | null
): string {
  const base = volume?.label ?? (isStrengthAddedLoadExercise(exercise) ? 'Added-load volume' : 'Volume');
  const meaning = volume?.meaning ?? (
    exercise.loadMeaning === 'total' || exercise.loadMeaning === 'per-dumbbell' || exercise.loadMeaning === 'per-side'
      ? exercise.loadMeaning
      : undefined
  );
  return `${base}${meaning === 'per-dumbbell' ? ' (per dumbbell)' : meaning === 'per-side' ? ' (per side)' : ''}`;
}

function formatVolumeValue(volume: ExerciseVolume): string {
  return `${formatVolume(volume.value, volume.unit)}${volume.status === 'partial' ? ' · partial' : ''}`;
}

function formatVolumeDelta(changeValue: number, unit: 'lb' | 'kg'): string {
  if (changeValue === 0) return 'Same';
  return `${changeValue > 0 ? '▲ +' : '▼ -'}${formatNumber(Math.abs(changeValue))} ${unit}`;
}

function formatVolumeDeltaDescription(
  changeValue: number,
  unit: 'lb' | 'kg',
  meaning: ExerciseVolume['meaning'] | undefined
): string {
  if (changeValue === 0) return 'Exercise volume is the same as the previous session.';
  const unitName = unit === 'lb' ? 'pounds' : 'kilograms';
  const direction = changeValue > 0 ? 'higher' : 'lower';
  return `Exercise volume is ${formatNumber(Math.abs(changeValue))} ${unitName}${formatMeaning(meaning ?? 'total')} ${direction} than the previous session.`;
}

type HeadlineDelta = {
  text: string;
  accessibleName: string;
  tone: 'positive' | 'muted' | 'baseline' | 'unavailable';
};

function formatHeadlineDelta(
  current: StrengthOneRepMaxEstimate | null,
  previous: StrengthOneRepMaxEstimate | null,
  hasPreviousSession: boolean,
  unit: 'lb' | 'kg'
): HeadlineDelta {
  if (!current) {
    return { text: 'Unavailable', accessibleName: 'Estimated 1RM unavailable', tone: 'unavailable' };
  }
  const unitName = unit === 'lb' ? 'pounds' : 'kilograms';
  const currentDescription = `Estimated one-rep maximum is ${formatNumber(current.value)} ${unitName}${formatMeaning(current.meaning)}`;
  const deltaDescription = (magnitude: number, direction: 'higher' | 'lower') =>
    `Estimated one-rep maximum is ${formatNumber(magnitude)} ${unitName}${formatMeaning(current.meaning)} ${direction} than the previous session.`;
  if (!hasPreviousSession) {
    return {
      text: 'Baseline',
      accessibleName: `${currentDescription}; baseline with no previous session.`,
      tone: 'baseline'
    };
  }
  if (!previous || current.meaning !== previous.meaning) {
    return {
      text: 'No comparison',
      accessibleName: `${currentDescription}; no comparable previous estimate.`,
      tone: 'unavailable'
    };
  }
  const delta = current.value - previous.value;
  if (delta > 0) {
    return {
      text: `▲ +${formatNumber(delta)} ${unit} vs. last`,
      accessibleName: deltaDescription(delta, 'higher'),
      tone: 'positive'
    };
  }
  if (delta < 0) {
    return {
      text: `▼ −${formatNumber(Math.abs(delta))} ${unit} vs. last`,
      accessibleName: deltaDescription(Math.abs(delta), 'lower'),
      tone: 'muted'
    };
  }
  return {
    text: 'Same as last',
    accessibleName: `${currentDescription}, same as the previous session.`,
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
