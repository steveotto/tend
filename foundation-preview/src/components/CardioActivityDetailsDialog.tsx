import {
  cardioActivityCalorieEstimate,
  cardioActivityType,
  formatCardioActivityDistance
} from '../domain/cardio.ts';
import type { CardioActivity } from '../domain/cardio.ts';
import type { WeightData } from '../domain/weight.ts';
import type { RhythmPreview } from '../domain/preview-data.ts';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { CardioActivityTypeIcon } from './CardioActivitySummary.tsx';
import { CardioActivityPerformance } from './CardioActivityPerformance.tsx';

export function CardioActivityDetailsDialog({
  activity,
  activities,
  weightData,
  today,
  rhythms,
  archivedRhythms,
  onEdit,
  onClose
}: {
  activity: CardioActivity;
  activities: readonly CardioActivity[];
  weightData: WeightData;
  today: string;
  rhythms: readonly RhythmPreview[];
  archivedRhythms: readonly RhythmPreview[];
  onEdit: () => void;
  onClose: () => void;
}) {
  const activityType = cardioActivityType(activity);
  const estimate = cardioActivityCalorieEstimate(activity, weightData, today);
  const linkedRhythm = activity.rhythmId
    ? [...rhythms, ...archivedRhythms].find(rhythm => rhythm.id === activity.rhythmId)
    : undefined;
  const activityName = activityType === 'run' ? 'Run' : 'Walk';

  return (
    <MoneyGoalDialog
      title={`${activityName} details`}
      labelledBy="cardio-activity-details-title"
      titleId="cardio-activity-details-title"
      closeLabel={`Close ${activityType} details`}
      phoneFullScreen
      scrollableBody
      bodyClassName="cardio-activity-details"
      dialogClassName="cardio-activity-details-dialog"
      onClose={onClose}
    >
      <header className="cardio-activity-details__summary">
        <span className="cardio-activity-details__type-icon" aria-hidden="true">
          <CardioActivityTypeIcon type={activityType} />
        </span>
        <div className="cardio-activity-details__summary-copy">
          <span className="cardio-activity-details__type">{activityName}</span>
          <strong>{formatCardioActivityDistance(activity)}</strong>
          <p>
            <time dateTime={activity.date}>{formatLongDate(activity.date)}</time>
            <span> · </span>
            <span>{activity.durationSeconds
              ? `Duration ${formatDuration(activity.durationSeconds)}`
              : 'Time not recorded'}</span>
          </p>
        </div>
      </header>
      {activity.notes && (
        <section className="cardio-activity-details__notes" aria-label="Activity notes">
          <h3>Notes</h3>
          <p>{activity.notes}</p>
        </section>
      )}
      {(linkedRhythm || activity.rhythmId) && (
        <aside className="cardio-activity-details__rhythm">
          <strong>Linked Rhythm</strong>
          <span>{linkedRhythm?.title ?? 'Unresolved link'}</span>
        </aside>
      )}
      <CardioActivityPerformance activity={activity} activities={activities} weightData={weightData} today={today} />
      <details className="cardio-activity-details__estimate">
        <summary>How estimated calories are calculated</summary>
        {activityType === 'run' ? (
          <>
            <p>
              Estimated calories = saved body weight in kilograms × run distance in kilometers,
              rounded to the nearest kcal. This is a rough gross-energy estimate, not active calories;
              age, incline, and pace are not used.
            </p>
            <p>
              {estimate
                ? estimate.estimate.weightSource === 'weigh-in'
                  ? `Saved input: ${formatNumber(estimate.estimate.weightKg)} kg from ${formatLongDate(estimate.estimate.weightDate)}.`
                  : `Saved manual input: ${formatNumber(estimate.estimate.weightKg)} kg.`
                : '—: this run has no saved weight snapshot and no valid weigh-in on or before its date.'}
            </p>
          </>
        ) : (
          <p>
            Walking calories are unavailable because no walking estimate method has been validated.
            Saved run-weight inputs, if present on this record, are preserved but are not applied to Walks.
          </p>
        )}
      </details>
      <div className="cardio-activity-details__actions">
        <button type="button" className="btn mini cardio-activity-edit" onClick={onEdit}>Edit activity</button>
      </div>
    </MoneyGoalDialog>
  );
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

function formatDuration(seconds: number): string {
  if (!Number.isSafeInteger(seconds) || seconds <= 0) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}
