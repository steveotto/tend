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
  showEvidence = true
}: {
  value: MetricValue;
  showEvidence?: boolean;
}) {
  if ('explanation' in value) {
    return (
      <div className="rhythm-season-impact__unavailable">
        <strong aria-label="Unavailable score">—</strong>
        <span>Unavailable</span>
        <p>{value.summary}</p>
        <details>
          <summary>Why unavailable</summary>
          <p>{value.explanation}</p>
        </details>
      </div>
    );
  }

  return (
    <div className="rhythm-season-impact__available">
      <p className="rhythm-season-impact__score">
        <strong>{value.score}</strong>
        <span aria-label="out of 100">/ 100</span>
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
  after
}: {
  before: RhythmScoreResult;
  after?: RhythmScoreResult | undefined;
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
      <h3>Score impact preview</h3>
      {noScoreChange && (
        <p className="rhythm-season-impact__no-change">
          No score change. The selector returns the same scores and evidence for this draft.
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
                <span className="rhythm-season-impact__responsive-label" aria-hidden="true">Before</span>
                <ImpactValue value={beforeValue} showEvidence={!sameEvidence} />
              </div>
              <div
                className="rhythm-season-impact__value rhythm-season-impact__value--after"
                role="group"
                aria-label={`After ${label}`}
              >
                <span className="rhythm-season-impact__responsive-label" aria-hidden="true">After</span>
                <ImpactValue value={afterValue} showEvidence={!sameEvidence} />
              </div>
              {sameEvidence && 'eligible' in beforeValue && beforeValue.eligible !== undefined
                && beforeValue.completed !== undefined && (
                  <p className="rhythm-season-impact__shared-evidence">
                    Both · {beforeValue.eligible} eligible · {beforeValue.completed} completed
                  </p>
                )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
