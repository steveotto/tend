import {
  cardioActivityCalorieEstimate,
  cardioActivityType,
  cardioDistanceFromMiles,
  cardioPaceSecondsPerUnit,
  formatCardioActivityDistance,
  formatCardioPace,
  selectCardioActivityComparisons
} from '../domain/cardio.ts';
import type { CardioActivity, CardioDistanceUnit } from '../domain/cardio.ts';
import type { WeightData } from '../domain/weight.ts';
import type { ReactNode } from 'react';
import {
  CardioActivityTypeIcon,
  CardioFlameIcon,
  CardioStopwatchIcon,
} from './CardioActivitySummary.tsx';

export function CardioActivityPerformance({
  activity,
  activities,
  weightData,
  today
}: {
  activity: CardioActivity;
  activities: readonly CardioActivity[];
  weightData: WeightData;
  today: string;
}) {
  const activityType = cardioActivityType(activity);
  const activityName = activityType === 'run' ? 'run' : 'walk';
  const unit = activity.distanceUnit ?? 'mi';
  const distanceInUnit = cardioDistanceFromMiles(activity.distance, unit);
  const pace = cardioPaceSecondsPerUnit(activity.durationSeconds, distanceInUnit);
  const estimate = cardioActivityCalorieEstimate(activity, weightData, today);
  const comparison = selectCardioActivityComparisons(activities, activity, weightData, today);
  const previous = comparison.previousActivity;
  const previousPace = previous
    ? cardioPaceSecondsPerUnit(
        previous.durationSeconds,
        cardioDistanceFromMiles(previous.distance, unit)
      )
    : null;
  const previousEstimate = previous
    ? cardioActivityCalorieEstimate(previous, weightData, today)
    : null;
  const sameDayActivity = activities.some(candidate =>
    candidate.id !== activity.id
      && candidate.date === activity.date
      && cardioActivityType(candidate) === activityType
  );
  const distanceIcon = <CardioActivityTypeIcon type={activityType} />;

  return (
    <div className="cardio-activity-performance">
      <dl className="cardio-activity-performance__metrics">
        <div>
          <span className="cardio-activity-performance__icon" aria-hidden="true"><CardioStopwatchIcon /></span>
          <dt>Time</dt>
          <dd>{formatDuration(activity.durationSeconds)}</dd>
        </div>
        <div>
          <span className="cardio-activity-performance__icon" aria-hidden="true">{distanceIcon}</span>
          <dt>Pace</dt>
          <dd>{formatCardioPace(pace, unit)}</dd>
        </div>
        <div>
          <span className="cardio-activity-performance__icon" aria-hidden="true"><CardioFlameIcon /></span>
          <dt aria-label="Estimated calories">Calories</dt>
          <dd>{estimate ? `${formatNumber(estimate.calories)} kcal` : '—'}</dd>
        </div>
      </dl>

      <section className="cardio-activity-comparison" aria-labelledby="cardio-activity-comparison-title">
        <h3 id="cardio-activity-comparison-title">
          {previous
            ? `Compared to previous ${formatCardioActivityDistance(previous).replace(/ (mile|miles)$/u, '-mile').replace(/ (kilometer|kilometers)$/u, '-kilometer')} ${activityName}`
            : `First ${activityName}`}
        </h3>
        {previous ? (
          <>
            <p className="cardio-activity-comparison__baseline">
              <time className="cardio-activity-comparison__baseline-item" dateTime={previous.date}>
                {formatShortDate(previous.date)}
              </time>
              {previous.durationSeconds !== undefined
                && Number.isSafeInteger(previous.durationSeconds)
                && previous.durationSeconds > 0 && (
                  <>
                    <span className="cardio-activity-comparison__baseline-separator" aria-hidden="true"> · </span>
                    <span className="cardio-activity-comparison__baseline-item">
                      {formatDuration(previous.durationSeconds)}
                    </span>
                  </>
                )}
              {previousPace !== null && (
                <>
                  <span className="cardio-activity-comparison__baseline-separator" aria-hidden="true"> · </span>
                  <span className="cardio-activity-comparison__baseline-item">
                    {formatCardioPace(previousPace, unit)}
                  </span>
                </>
              )}
              {previousEstimate && (
                <>
                  <span className="cardio-activity-comparison__baseline-separator" aria-hidden="true"> · </span>
                  <span className="cardio-activity-comparison__baseline-item">
                    {formatNumber(previousEstimate.calories)} kcal
                  </span>
                </>
              )}
            </p>
            <dl className="cardio-activity-comparison__deltas">
              <ComparisonDelta
                label="Pace"
                icon={<CardioStopwatchIcon />}
                value={formatPaceDelta(comparison.paceImprovementSeconds === null
                  ? null
                  : -comparison.paceImprovementSeconds, unit)}
              />
              <ComparisonDelta
                label="Calories"
                icon={<CardioFlameIcon />}
                value={formatQuantityDelta(comparison.calorieDelta, 'kcal')}
              />
              <ComparisonDelta
                label="Distance"
                icon={distanceIcon}
                value={formatQuantityDelta(comparison.distanceDelta, unit)}
              />
            </dl>
            <details className="cardio-activity-comparison__details">
              <summary>Comparison details</summary>
              <p>
                Distance and calories use the previous {activityName} on {formatLongDate(previous.date)}.
                {comparison.paceReferenceActivity
                  ? comparison.paceReferenceActivity.id === previous.id
                    ? ` Pace also uses this activity.`
                    : ` Pace uses the ${formatCardioActivityDistance(comparison.paceReferenceActivity)} on ${formatLongDate(comparison.paceReferenceActivity.date)}, within 5% of this distance.`
                  : ` Pace is unavailable because no earlier similar-distance ${activityName} with a recorded duration exists.`}
              </p>
            </details>
          </>
        ) : (
          <p>
            {sameDayActivity
              ? `No earlier dated ${activityName} is available; same-day activity times are not recorded, so their order is unknown.`
              : `No earlier ${activityName} is available for comparison.`}
          </p>
        )}
      </section>
    </div>
  );
}

function ComparisonDelta({
  label,
  icon,
  value,
}: {
  label: string;
  icon: ReactNode;
  value: { direction: 'up' | 'down' | 'same' | 'none'; text: string; unit?: string | undefined; interpretation: string; tone: 'positive' | 'negative' | 'neutral' };
}) {
  return (
    <div className="cardio-activity-comparison__delta">
      <dt>
        <span className="cardio-activity-comparison__delta-icon" aria-hidden="true">{icon}</span>
        <span>{label}</span>
      </dt>
      <dd>
        <strong className={value.tone === 'positive'
          ? 'cardio-activity-comparison__delta-value--positive'
          : value.tone === 'negative'
            ? 'cardio-activity-comparison__delta-value--negative'
            : 'cardio-activity-comparison__delta-value--neutral'}>
          {value.direction !== 'none' && (
            <span className="cardio-activity-comparison__delta-caret" aria-hidden="true">
              {value.direction === 'up' ? '▲' : value.direction === 'down' ? '▼' : '↔'}
            </span>
          )}
          {value.direction !== 'none' && ' '}
          <span className="cardio-activity-comparison__delta-text">{value.text}</span>
          {value.unit && ' '}
          {value.unit && <span className="cardio-activity-comparison__delta-unit">{value.unit}</span>}
        </strong>
        <span className="cardio-activity-comparison__interpretation">{value.interpretation}</span>
      </dd>
    </div>
  );
}

function formatPaceDelta(
  seconds: number | null,
  unit: CardioDistanceUnit
): { direction: 'up' | 'down' | 'same' | 'none'; text: string; unit?: string | undefined; interpretation: string; tone: 'positive' | 'negative' | 'neutral' } {
  if (seconds === null) return { direction: 'none', text: '—', interpretation: 'Not comparable', tone: 'neutral' };
  if (seconds === 0) return { direction: 'same', text: '0', unit: `/${unit}`, interpretation: 'Same', tone: 'neutral' };
  return {
    direction: seconds < 0 ? 'down' : 'up',
    text: `${seconds < 0 ? '−' : '+'}${formatPaceSeconds(Math.abs(seconds))}`,
    unit: `/${unit}`,
    interpretation: seconds < 0 ? 'Faster' : 'Slower',
    tone: seconds < 0 ? 'positive' : 'negative'
  };
}

function formatQuantityDelta(
  amount: number | null,
  unit: string
): { direction: 'up' | 'down' | 'same' | 'none'; text: string; unit?: string | undefined; interpretation: string; tone: 'positive' | 'negative' | 'neutral' } {
  if (amount === null) return { direction: 'none', text: '—', interpretation: 'Not comparable', tone: 'neutral' };
  if (amount === 0) return { direction: 'same', text: '0', unit, interpretation: 'Same', tone: 'neutral' };
  return {
    direction: amount > 0 ? 'up' : 'down',
    text: `${amount > 0 ? '+' : '−'}${formatNumber(Math.abs(amount))}`,
    unit,
    interpretation: amount > 0 ? 'Higher' : 'Lower',
    tone: amount > 0 ? 'positive' : 'negative'
  };
}

function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isSafeInteger(seconds) || seconds <= 0) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function formatPaceSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function formatLongDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatShortDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}
