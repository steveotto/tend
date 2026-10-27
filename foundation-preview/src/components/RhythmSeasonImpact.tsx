import type {
  RhythmScoreResult,
  ScoredConsistencyMetric,
  ScoredOnTrackMetric,
  UnscoredReasonCode
} from '../domain/rhythm-scoring.ts';
import { formatRhythmSchedule } from '../domain/rhythm-schedule.ts';
import type { RhythmSchedule } from '../domain/rhythm-schedule.ts';
import { isScheduledDate } from '../domain/rhythm-occurrences.ts';

type MetricName = 'consistency' | 'onTrack' | 'health';
type MetricValue =
  | { score: number; eligible?: number; completed?: number }
  | { explanation: string; summary: string };

function unscoredSummary(reasonCode: UnscoredReasonCode): string {
  const summaries: Record<UnscoredReasonCode, string> = {
    'ready-for-first-tend': 'Waiting for the first Tend.',
    'unsupported-schedule': 'Schedule is not supported.',
    'unsupported-history': 'Schedule history is incomplete.',
    'no-eligible-occurrences': 'No eligible occurrences.',
    'not-started': 'Tracking has not started.',
    inactive: 'Rhythm is inactive.',
    'history-unavailable': 'Completion history is unavailable.',
    'timezone-uncertain': 'Time zone is uncertain.'
  };
  return summaries[reasonCode];
}

function metricValue(result: RhythmScoreResult, name: MetricName): MetricValue {
  if (name === 'health') {
    if (result.kind === 'invalid') return { explanation: result.reason, summary: 'Schedule is invalid.' };
    if (result.kind === 'unscored') {
      return {
        explanation: result.reason.explanation,
        summary: unscoredSummary(result.reason.reasonCode)
      };
    }
    return result.healthScore === null
      ? {
          explanation: 'Health requires both Consistency and On Track to be available.',
          summary: 'A component score is unavailable.'
        }
      : { score: Math.round(result.healthScore) };
  }

  if (name === 'consistency') {
    const metric = result.consistency;
    return metric.kind === 'unscored'
      ? { explanation: metric.explanation, summary: unscoredSummary(metric.reasonCode) }
      : consistencyValue(metric);
  }

  const metric = result.onTrack;
  return metric.kind === 'unscored'
    ? { explanation: metric.explanation, summary: unscoredSummary(metric.reasonCode) }
    : onTrackValue(metric);
}

function consistencyValue(metric: ScoredConsistencyMetric): MetricValue {
  return {
    score: Math.round(metric.score),
    eligible: metric.evidence.eligibleDueCount,
    completed: metric.evidence.completedCount
  };
}

function onTrackValue(metric: ScoredOnTrackMetric): MetricValue {
  const occurrences = metric.evidence.occurrences.filter(occurrence => occurrence.status !== 'today');
  return {
    score: metric.score,
    eligible: occurrences.length,
    completed: occurrences.filter(occurrence => occurrence.status === 'completed').length
  };
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(`${date}T12:00:00Z`));
}

function occurrenceUnit(schedule?: RhythmSchedule): string {
  if (!schedule) return 'occurrences';
  if (schedule.frequency === 'daily') return 'days';
  if (schedule.frequency === 'weekly') {
    return schedule.weekdays.length === 1 && schedule.weeklyMode !== 'select-days'
      ? 'weeks'
      : 'days';
  }
  return 'occurrences';
}

function countedUnit(unit: string, count: number): string {
  return count === 1 ? unit.replace(/s$/, '') : unit;
}

function scheduleLabel(schedule?: RhythmSchedule): string {
  return schedule
    ? formatRhythmSchedule(schedule, 'detailed').replace(/\.$/, '')
    : 'Schedule details unavailable';
}

type ConsistencyDetails =
  | {
      kind: 'scored';
      label: string;
      scheduled: number;
      completed: number;
      percentage: number;
      unit: string;
      startDate: string;
      endDate: string;
    }
  | { kind: 'unavailable'; label: string; message: string };

function consistencyDetails(result: RhythmScoreResult, schedule?: RhythmSchedule): ConsistencyDetails {
  const label = scheduleLabel(schedule);
  const metric = result.consistency;
  return metric.kind === 'scored'
    ? {
        kind: 'scored',
        label,
        scheduled: metric.evidence.eligibleDueCount,
        completed: metric.evidence.completedCount,
        percentage: Math.round(metric.exactPercent),
        unit: occurrenceUnit(schedule),
        startDate: metric.evidence.windowStartDate,
        endDate: metric.evidence.windowEndDate
      }
    : { kind: 'unavailable', label, message: `${unscoredSummary(metric.reasonCode)} ${metric.explanation}` };
}

type OnTrackDetails =
  | {
      kind: 'scored';
      label: string;
      lastCompletionDate: string | null;
      trackingStartDate: string | null;
      missed: number;
      score: number;
      unit: string;
      pendingToday: boolean;
    }
  | { kind: 'unavailable'; label: string; message: string };

function onTrackDetails(result: RhythmScoreResult, schedule?: RhythmSchedule): OnTrackDetails {
  const label = scheduleLabel(schedule);
  const metric = result.onTrack;
  if (metric.kind === 'unscored') {
    const baseline = result.kind === 'rhythm-score' && result.trackingStartDate
      ? `No qualifying Tend yet; tracking began ${formatDate(result.trackingStartDate)}. `
      : '';
    return {
      kind: 'unavailable',
      label,
      message: `${baseline}${unscoredSummary(metric.reasonCode)} ${metric.explanation}`
    };
  }
  const hasCompletedOccurrenceToday = metric.evidence.occurrences.some(occurrence =>
    occurrence.date === result.asOfDate && occurrence.status === 'completed'
  );
  const pendingToday = schedule !== undefined
    && result.kind === 'rhythm-score'
    && isScheduledDate(schedule, result.asOfDate)
    && !hasCompletedOccurrenceToday;
  return {
    kind: 'scored',
    label,
    lastCompletionDate: metric.evidence.lastQualifyingCompletionDate,
    trackingStartDate: result.kind === 'rhythm-score' ? result.trackingStartDate : null,
    missed: metric.evidence.missedOccurrenceCount,
    score: metric.score,
    unit: occurrenceUnit(schedule),
    pendingToday
  };
}

function ConsistencyDetailsPanel({
  side,
  details
}: {
  side: 'Before' | 'After';
  details: ConsistencyDetails;
}) {
  return (
    <div className={`rhythm-season-impact__explanation-panel rhythm-season-impact__explanation-panel--${side.toLowerCase()}`}>
      <strong>{side}</strong>
      <span>{details.label}</span>
      {details.kind === 'scored' ? (
        <>
          <b>{details.completed} of {details.scheduled} · {details.percentage}%</b>
          <span>{details.scheduled} scheduled {countedUnit(details.unit, details.scheduled)} · {details.completed} completed</span>
          <span>Measured {formatDate(details.startDate)} – {formatDate(details.endDate)}</span>
        </>
      ) : (
        <span className="rhythm-season-impact__explanation-unavailable">{details.message}</span>
      )}
    </div>
  );
}

function OnTrackDetailsPanel({
  side,
  details
}: {
  side: 'Before' | 'After';
  details: OnTrackDetails;
}) {
  return (
    <div className={`rhythm-season-impact__explanation-panel rhythm-season-impact__explanation-panel--${side.toLowerCase()}`}>
      <strong>{side}</strong>
      <span>{details.label}</span>
      {details.kind === 'scored' ? (
        <>
          <span>{details.lastCompletionDate
            ? `Last qualifying Tend ${formatDate(details.lastCompletionDate)}`
            : details.trackingStartDate
              ? `No qualifying Tend yet · tracking began ${formatDate(details.trackingStartDate)}`
              : 'No qualifying completion or tracking baseline is recorded.'}</span>
          <b>{details.missed} missed {countedUnit(details.unit, details.missed)}</b>
          <span>{details.missed > 10
            ? `max(0, 100 − 10 × ${details.missed}) = ${details.score}`
            : `100 − 10 × ${details.missed} = ${details.score}`}</span>
          {details.pendingToday && (
            <span>Today’s scheduled occurrence is pending and is not a miss.</span>
          )}
        </>
      ) : (
        <span className="rhythm-season-impact__explanation-unavailable">{details.message}</span>
      )}
    </div>
  );
}

function ScoreChangeExplanation({
  before,
  after,
  beforeSchedule,
  afterSchedule
}: {
  before: RhythmScoreResult;
  after?: RhythmScoreResult | undefined;
  beforeSchedule?: RhythmSchedule | undefined;
  afterSchedule?: RhythmSchedule | undefined;
}) {
  const afterResult = after;
  const beforeConsistency = consistencyDetails(before, beforeSchedule);
  const afterConsistency = afterResult
    ? consistencyDetails(afterResult, afterSchedule)
    : { kind: 'unavailable' as const, label: scheduleLabel(afterSchedule), message: 'The proposed schedule is invalid; consistency is unavailable.' };
  const beforeOnTrack = onTrackDetails(before, beforeSchedule);
  const afterOnTrack = afterResult
    ? onTrackDetails(afterResult, afterSchedule)
    : { kind: 'unavailable' as const, label: scheduleLabel(afterSchedule), message: 'The proposed schedule is invalid; On Track is unavailable.' };
  const consistencyChange = beforeConsistency.kind === 'scored' && afterConsistency.kind === 'scored'
    ? consistencyChangeMessage(beforeConsistency, afterConsistency)
    : undefined;

  return (
    <details className="rhythm-season-impact__details">
      <summary>Why the scores change</summary>
      <div className="rhythm-season-impact__details-content">
        <section className="rhythm-season-impact__explanation" aria-labelledby="rhythm-impact-consistency-heading">
          <h5 id="rhythm-impact-consistency-heading">Consistency</h5>
          <div className="rhythm-season-impact__explanation-panels">
            <ConsistencyDetailsPanel side="Before" details={beforeConsistency} />
            <ConsistencyDetailsPanel side="After" details={afterConsistency} />
          </div>
          {consistencyChange && <p className="rhythm-season-impact__change-note">{consistencyChange}</p>}
        </section>
        <section className="rhythm-season-impact__explanation" aria-labelledby="rhythm-impact-on-track-heading">
          <h5 id="rhythm-impact-on-track-heading">On Track</h5>
          <p className="rhythm-season-impact__deduction-note">
            −10 per missed occurrence; completed occurrences reset the count; the score floors at 0.
          </p>
          <div className="rhythm-season-impact__explanation-panels">
            <OnTrackDetailsPanel side="Before" details={beforeOnTrack} />
            <OnTrackDetailsPanel side="After" details={afterOnTrack} />
          </div>
        </section>
      </div>
    </details>
  );
}

function consistencyChangeMessage(
  before: Extract<ConsistencyDetails, { kind: 'scored' }>,
  after: Extract<ConsistencyDetails, { kind: 'scored' }>
): string | undefined {
  const changes: string[] = [];
  if (before.scheduled !== after.scheduled) {
    if (before.unit === after.unit) {
      const direction = after.scheduled < before.scheduled ? 'decreases' : 'increases';
      const difference = Math.abs(after.scheduled - before.scheduled);
      changes.push(`scheduled count ${direction} by ${difference} ${countedUnit(after.unit, difference)}`);
    } else {
      changes.push(`scheduled count changes from ${before.scheduled} ${before.unit} to ${after.scheduled} ${after.unit}`);
    }
  }
  if (before.completed !== after.completed) {
    const direction = after.completed < before.completed ? 'decreases' : 'increases';
    changes.push(`completed occurrences ${direction} from ${before.completed} to ${after.completed}`);
  }
  return changes.length > 0
    ? `In the measured ranges above, ${changes.join('; ')}.`
    : undefined;
}

function ImpactValue({
  value,
  showEvidence = true,
  showUnavailableDetails = true
}: {
  value: MetricValue;
  showEvidence?: boolean;
  showUnavailableDetails?: boolean;
}) {
  if ('explanation' in value) {
    return (
      <div className="rhythm-season-impact__unavailable">
        <strong aria-label="Unavailable score">—</strong>
        <span>Unavailable</span>
        {showUnavailableDetails && (
          <>
            <p>{value.summary}</p>
            <details>
              <summary>Why unavailable</summary>
              <p>{value.explanation}</p>
            </details>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rhythm-season-impact__available">
      <p className="rhythm-season-impact__score">
        <strong>{value.score}</strong>
        <span className="visually-hidden">out of 100</span>
      </p>
      {showEvidence && 'eligible' in value && value.eligible !== undefined
        && value.completed !== undefined && (
          <p className="rhythm-season-impact__evidence">
            {value.eligible} eligible · {value.completed} completed
          </p>
        )}
    </div>
  );
}

export function RhythmSeasonImpact({
  before,
  after,
  detailsDisclosure = false,
  hideHeading = false,
  showChange = false,
  beforeSchedule,
  afterSchedule,
  mode = 'comparison',
  singleScore,
  noRecordedActivity = false,
  noScorableActivity = false,
  singleMessage
}: {
  before?: RhythmScoreResult | undefined;
  after?: RhythmScoreResult | undefined;
  detailsDisclosure?: boolean;
  hideHeading?: boolean;
  showChange?: boolean;
  beforeSchedule?: RhythmSchedule | undefined;
  afterSchedule?: RhythmSchedule | undefined;
  mode?: 'comparison' | 'single';
  singleScore?: RhythmScoreResult | undefined;
  noRecordedActivity?: boolean;
  noScorableActivity?: boolean;
  singleMessage?: string;
}) {
  const afterUnavailable: MetricValue = {
    explanation: 'The proposed schedule change is not valid, so its impact cannot be calculated.',
    summary: 'Proposed schedule is invalid.'
  };
  const rows: { name: MetricName; label: string }[] = [
    { name: 'consistency', label: 'Consistency' },
    { name: 'onTrack', label: 'On Track' },
    { name: 'health', label: 'Health' }
  ];
  const beforeUnavailable: MetricValue = {
    explanation: 'The saved schedule is unavailable for this date range.',
    summary: 'Saved schedule is unavailable.'
  };
  const comparisons = mode === 'comparison' ? rows.map(row => ({
    ...row,
    beforeValue: before ? metricValue(before, row.name) : beforeUnavailable,
    afterValue: after ? metricValue(after, row.name) : afterUnavailable
  })) : [];
  const singleValues = rows.map(row => ({
    ...row,
    value: singleScore ? metricValue(singleScore, row.name) : afterUnavailable
  }));

  return (
    <section
      className="rhythm-season-correction__impact"
      aria-label="Score impact preview"
      aria-live="polite"
    >
      {!hideHeading && <h3>Score impact preview</h3>}
      {mode === 'comparison' && noRecordedActivity && (
        <p className="rhythm-season-impact__single-message">No recorded activity in this date range.</p>
      )}
      {mode === 'comparison' && !noRecordedActivity && noScorableActivity && (
        <p className="rhythm-season-impact__single-message">No activity in this date range is eligible to score yet.</p>
      )}
      {mode === 'single' && singleMessage && <p className="rhythm-season-impact__single-message">{singleMessage}</p>}
      <div
        className={`rhythm-season-impact__comparison${mode === 'single' ? ' rhythm-season-impact__comparison--single' : ''}${showChange && mode === 'comparison' ? ' rhythm-season-impact__comparison--with-change' : ''}`}
        {...(showChange && mode === 'comparison'
          ? { role: 'table' as const, 'aria-label': 'Score comparison' }
          : {})}
      >
        {mode === 'single' ? (
          <>
            <span className="rhythm-season-impact__metric-heading" aria-hidden="true" />
            <h4>Score</h4>
          </>
        ) : (
          showChange ? (
            <div className="rhythm-season-impact__table-header" role="row">
              <h4 role="columnheader">Metric</h4>
              <h4 role="columnheader">Before</h4>
              <h4 role="columnheader">After</h4>
              <h4 role="columnheader">Change</h4>
            </div>
          ) : (
            <>
              <span className="rhythm-season-impact__metric-heading" aria-hidden="true" />
              <h4>Before</h4>
              <h4>After</h4>
            </>
          )
        )}
        {mode === 'single'
          ? singleValues.map(({ name, label, value }) => (
              <div className="rhythm-season-impact__row rhythm-season-impact__row--single" key={name}>
                <h4 className="rhythm-season-impact__metric">{label}</h4>
                <div className="rhythm-season-impact__value" role="group" aria-label={`Score ${label}`}>
                  {noRecordedActivity || noScorableActivity ? (
                    <div className="rhythm-season-impact__available">
                      <p className="rhythm-season-impact__score"><strong aria-label={`${label} score unavailable`}>—</strong></p>
                    </div>
                  ) : <ImpactValue value={value} showEvidence={false} />}
                </div>
              </div>
            ))
          : comparisons.map(({ name, label, beforeValue, afterValue }) => {
              const sameEvidence = 'eligible' in beforeValue && 'eligible' in afterValue
                && beforeValue.eligible !== undefined && afterValue.eligible !== undefined
                && beforeValue.completed !== undefined && afterValue.completed !== undefined
                && beforeValue.eligible === afterValue.eligible
                && beforeValue.completed === afterValue.completed;
              const beforeScore = 'score' in beforeValue ? beforeValue.score : undefined;
              const afterScore = 'score' in afterValue ? afterValue.score : undefined;
              const scoreChange = beforeScore !== undefined && afterScore !== undefined
                ? afterScore - beforeScore
                : undefined;

              return (
                <div
                  className={`rhythm-season-impact__row${showChange ? ' rhythm-season-impact__row--change' : ''}`}
                  key={name}
                  role={showChange ? 'row' : 'group'}
                  {...(!showChange ? { 'aria-label': `${label} comparison` } : {})}
                >
                  <h4 className="rhythm-season-impact__metric" {...(showChange ? { role: 'rowheader' as const } : {})}>{label}</h4>
                  <div role={showChange ? 'cell' : undefined}>
                    <div
                      className="rhythm-season-impact__value rhythm-season-impact__value--before"
                      role="group"
                      aria-label={`Before ${label}`}
                    >
                      <ImpactValue
                        value={beforeValue}
                        showEvidence={!detailsDisclosure && !sameEvidence}
                        showUnavailableDetails={!detailsDisclosure}
                      />
                    </div>
                  </div>
                  <div role={showChange ? 'cell' : undefined}>
                    <div
                      className="rhythm-season-impact__value rhythm-season-impact__value--after"
                      role="group"
                      aria-label={`After ${label}`}
                    >
                      <ImpactValue
                        value={afterValue}
                        showEvidence={!detailsDisclosure && !sameEvidence}
                        showUnavailableDetails={!detailsDisclosure}
                      />
                    </div>
                  </div>
                  {showChange && (
                    <div className="rhythm-season-impact__change" role="cell">
                      {scoreChange === undefined
                        ? <span aria-label="Change unavailable">—</span>
                        : scoreChange === 0
                          ? <span>No change</span>
                          : <span>{scoreChange > 0 ? '+' : '−'}{Math.abs(scoreChange)}</span>}
                    </div>
                  )}
                  {!noScorableActivity && !detailsDisclosure && sameEvidence && 'eligible' in beforeValue && beforeValue.eligible !== undefined
                    && beforeValue.completed !== undefined && (
                      <p className="rhythm-season-impact__shared-evidence">
                        Both · {beforeValue.eligible} eligible · {beforeValue.completed} completed
                      </p>
                    )}
                </div>
              );
            })}
      </div>
      {mode === 'comparison' && detailsDisclosure && before && (
        <ScoreChangeExplanation
          before={before}
          after={after}
          beforeSchedule={beforeSchedule}
          afterSchedule={afterSchedule}
        />
      )}
    </section>
  );
}
