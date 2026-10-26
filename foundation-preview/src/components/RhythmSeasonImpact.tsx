import type {
  RhythmScoreResult,
  ScoredConsistencyMetric,
  ScoredOnTrackMetric,
  UnscoredReasonCode
} from '../domain/rhythm-scoring.ts';

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
  hideHeading = false
}: {
  before: RhythmScoreResult;
  after?: RhythmScoreResult | undefined;
  detailsDisclosure?: boolean;
  hideHeading?: boolean;
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
  const comparisons = rows.map(row => ({
    ...row,
    beforeValue: metricValue(before, row.name),
    afterValue: after ? metricValue(after, row.name) : afterUnavailable
  }));
  const noScoreChange = after !== undefined && comparisons.every(({ beforeValue, afterValue }) =>
    JSON.stringify(beforeValue) === JSON.stringify(afterValue)
  );

  return (
    <section
      className="rhythm-season-correction__impact"
      aria-label="Score impact preview"
      aria-live="polite"
    >
      {!hideHeading && <h3>Score impact preview</h3>}
      {noScoreChange && (
        <p className="rhythm-season-impact__no-change">
          No score change. The proposed schedule produces the same scores and evidence.
        </p>
      )}
      <div className="rhythm-season-impact__comparison">
        <span className="rhythm-season-impact__metric-heading" aria-hidden="true" />
        <h4>Before</h4>
        <h4>After</h4>
        {comparisons.map(({ name, label, beforeValue, afterValue }) => {
          const sameEvidence = 'eligible' in beforeValue && 'eligible' in afterValue
            && beforeValue.eligible !== undefined && afterValue.eligible !== undefined
            && beforeValue.completed !== undefined && afterValue.completed !== undefined
            && beforeValue.eligible === afterValue.eligible
            && beforeValue.completed === afterValue.completed;

          return (
            <div
              className="rhythm-season-impact__row"
              key={name}
              role="group"
              aria-label={`${label} comparison`}
            >
              <h4 className="rhythm-season-impact__metric">{label}</h4>
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
              {!detailsDisclosure && sameEvidence && 'eligible' in beforeValue && beforeValue.eligible !== undefined
                && beforeValue.completed !== undefined && (
                  <p className="rhythm-season-impact__shared-evidence">
                    Both · {beforeValue.eligible} eligible · {beforeValue.completed} completed
                  </p>
                )}
            </div>
          );
        })}
      </div>
      {detailsDisclosure && (
        <details className="rhythm-season-impact__details">
          <summary>Score calculation details</summary>
          <div className="rhythm-season-impact__details-content">
            {!after && (
              <p className="rhythm-season-impact__details-note">
                Proposed schedule is invalid; After scores are unavailable until the required fields are complete.
              </p>
            )}
            {comparisons.map(({ name, label, beforeValue, afterValue }) => {
              const sameEvidence = 'eligible' in beforeValue && 'eligible' in afterValue
                && beforeValue.eligible !== undefined && afterValue.eligible !== undefined
                && beforeValue.completed !== undefined && afterValue.completed !== undefined
                && beforeValue.eligible === afterValue.eligible
                && beforeValue.completed === afterValue.completed;
              return (
                <div className="rhythm-season-impact__details-row" key={name}>
                  <strong>{label}</strong>
                  <p>{sameEvidence
                    ? `Before and after: ${beforeValue.eligible} eligible · ${beforeValue.completed} completed`
                    : `Before: ${impactDetails(beforeValue)}`}
                  </p>
                  {after && !sameEvidence && (
                    <p>After: {impactDetails(afterValue)}</p>
                  )}
                </div>
              );
            })}
          </div>
        </details>
      )}
    </section>
  );
}

function impactDetails(value: MetricValue): string {
  if ('explanation' in value) return `${value.summary} ${value.explanation}`;
  if ('eligible' in value && value.eligible !== undefined && value.completed !== undefined) {
    return `${value.eligible} eligible · ${value.completed} completed`;
  }
  return 'Derived from the Consistency and On Track scores.';
}
