import type { RhythmScoreResult } from '../domain/rhythm-scoring.ts';

function metricSummary(result: RhythmScoreResult, name: 'consistency' | 'onTrack'): string {
  const metric = result[name];
  if (metric.kind === 'unscored') return `Unavailable — ${metric.explanation}`;
  if ('eligibleDueCount' in metric.evidence) {
    return `${metric.score.toFixed(0)} / 100 · ${metric.evidence.eligibleDueCount} eligible, ${metric.evidence.completedCount} completed`;
  }
  const occurrences = metric.evidence.occurrences.filter(occurrence => occurrence.status !== 'today');
  const completedCount = occurrences.filter(occurrence => occurrence.status === 'completed').length;
  return `${metric.score} / 100 · ${occurrences.length} eligible, ${completedCount} completed`;
}

function healthSummary(result: RhythmScoreResult): string {
  if (result.kind === 'invalid') return `Unavailable — ${result.reason}`;
  if (result.kind === 'unscored') return `Unavailable — ${result.reason.explanation}`;
  return result.healthScore === null
    ? 'Unavailable — both Consistency and On Track must be available.'
    : `${Math.round(result.healthScore)} / 100`;
}

export function RhythmSeasonImpact({
  before,
  after
}: {
  before: RhythmScoreResult;
  after?: RhythmScoreResult | undefined;
}) {
  const afterSummary = (summary: (result: RhythmScoreResult) => string) => after
    ? summary(after)
    : 'Unavailable — the proposed schedule change is not valid.';
  return (
    <section className="rhythm-season-correction__impact" aria-label="Score impact preview" aria-live="polite">
      <h3>Before and after</h3>
      {(['consistency', 'onTrack'] as const).map(metric => (
        <div key={metric}>
          <strong>{metric === 'consistency' ? 'Consistency' : 'On Track'}</strong>
          <p>Before: {metricSummary(before, metric)}</p>
          <p>After: {afterSummary(result => metricSummary(result, metric))}</p>
        </div>
      ))}
      <div>
        <strong>Health</strong>
        <p>Before: {healthSummary(before)}</p>
        <p>After: {afterSummary(healthSummary)}</p>
      </div>
    </section>
  );
}
