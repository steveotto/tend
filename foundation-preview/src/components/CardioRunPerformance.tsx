import {
  cardioDistanceFromMiles,
  cardioPaceSecondsPerUnit,
  cardioRunCalorieEstimate,
  formatCardioPace,
  selectCardioRunComparisons
} from '../domain/cardio.ts';
import type { CardioRun } from '../domain/cardio.ts';
import type { WeightData } from '../domain/weight.ts';

export function CardioRunPerformance({
  run,
  runs,
  weightData,
  today
}: {
  run: CardioRun;
  runs: readonly CardioRun[];
  weightData: WeightData;
  today: string;
}) {
  const unit = run.distanceUnit ?? 'mi';
  const distance = cardioDistanceFromMiles(run.distance, unit);
  const pace = cardioPaceSecondsPerUnit(run.durationSeconds, distance);
  const calories = cardioRunCalorieEstimate(run, weightData, today)?.calories ?? null;
  const comparison = selectCardioRunComparisons(runs, run, weightData, today);
  const paceReferenceLabel = comparison.paceReferenceRun
    ? comparison.paceReferenceRun.id === comparison.previousRun?.id
      ? 'Average pace'
      : 'Pace vs similar-distance run'
    : 'Average pace';

  return (
    <div className="cardio-run-performance">
      <dl className="cardio-run-performance__metrics">
        <div><dt>Distance</dt><dd>{formatNumber(distance)} {unit}</dd></div>
        <div><dt>Duration</dt><dd>{formatDuration(run.durationSeconds)}</dd></div>
        <div><dt>Average pace</dt><dd>{formatCardioPace(pace, unit)}</dd></div>
        <div><dt>Estimated Calories</dt><dd>{calories === null ? 'Unavailable' : `${formatNumber(calories)} kcal`}</dd></div>
      </dl>
      <div className="cardio-run-performance__comparison" role="group" aria-label="Run performance comparison">
        {comparison.previousRun ? (
          <>
            <p>
              Compared with {formatDate(comparison.previousRun.date)}
              {comparison.similarDistanceRun && comparison.similarDistanceRun.id !== comparison.previousRun.id
                ? ` · pace vs similar-distance run from ${formatDate(comparison.similarDistanceRun.date)}`
                : ''}
            </p>
            <ul>
              <li>
                <span>Distance</span>
                <DeltaValue value={formatDistanceDelta(comparison.distanceDelta, unit)}
                  tone={toneForSignedValue(comparison.distanceDelta)} />
              </li>
              <li>
                <span>{paceReferenceLabel}</span>
                <DeltaValue value={formatPaceImprovement(comparison.paceImprovementSeconds)}
                  tone={toneForPaceImprovement(comparison.paceImprovementSeconds)} />
              </li>
              <li>
                <span>Estimated Calories</span>
                <DeltaValue value={formatCalorieDelta(comparison.calorieDelta)} tone="neutral" />
              </li>
            </ul>
          </>
        ) : (
          <p>First run · no previous comparison.</p>
        )}
      </div>
    </div>
  );
}

function DeltaValue({ value, tone }: { value: string; tone: 'positive' | 'muted' | 'neutral' }) {
  return (
    <span className={`cardio-run-performance__delta cardio-run-performance__delta--${tone}`}
      aria-label={value}>
      {value}
    </span>
  );
}

function toneForSignedValue(value: number | null): 'positive' | 'muted' {
  return value !== null && value > 0 ? 'positive' : 'muted';
}

function toneForPaceImprovement(value: number | null): 'positive' | 'muted' {
  return value !== null && value > 0 ? 'positive' : 'muted';
}

function formatDistanceDelta(value: number | null, unit: 'mi' | 'km'): string {
  if (value === null) return 'Unavailable';
  if (value === 0) return 'Same';
  return `${value > 0 ? '▲ +' : '▼ −'}${formatNumber(Math.abs(value))} ${unit}`;
}

function formatPaceImprovement(value: number | null): string {
  if (value === null) return 'Unavailable';
  if (value === 0) return 'Same';
  const delta = `${Math.floor(Math.abs(value) / 60)}:${String(Math.abs(value) % 60).padStart(2, '0')}`;
  return value > 0 ? `▲ ${delta} faster` : `▼ ${delta} slower`;
}

function formatCalorieDelta(value: number | null): string {
  if (value === null) return 'Unavailable';
  if (value === 0) return 'Same';
  return `${value > 0 ? '▲ +' : '▼ −'}${formatNumber(Math.abs(value))} kcal`;
}

function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isSafeInteger(seconds) || seconds <= 0) return 'Unavailable';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string): string {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  });
}
