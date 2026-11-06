import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { formatScore } from '../domain/score-display.ts';
import { HEALTH_CONSISTENCY_WEIGHT, HEALTH_ON_TRACK_WEIGHT } from '../domain/rhythm-history.ts';
import { HealthDetailsExpandableHeader } from './HealthDetailsExpandableHeader.tsx';
import { HealthWeightPanels, formatTruthfulWeightedSum } from './HealthWeightPanels.tsx';

export type HealthScoringEvidenceRow = {
  id: string;
  label: string;
  consistency: number | null;
  onTrack: number | null;
};

export type HealthAggregateEvidence = {
  heading: string;
  description: string;
  itemLabel: string;
  rows: readonly HealthScoringEvidenceRow[];
  otherCount?: number;
  consistencyAverage: number | null;
  consistencyCount: number;
  onTrackAverage: number | null;
  onTrackCount: number;
  coverage: string;
  notes?: readonly string[];
  emptyState?: string;
};

export function HealthScoringDetailsCard({
  title,
  healthScore,
  consistencyScore,
  onTrackScore,
  evidence,
  children,
  initialExpanded = false
}: {
  title: string;
  healthScore: number | null;
  consistencyScore: number | null;
  onTrackScore: number | null;
  evidence?: HealthAggregateEvidence;
  children?: ReactNode;
  initialExpanded?: boolean;
}) {
  const headingId = useId();
  const contentId = useId();
  const [expanded, setExpanded] = useState(initialExpanded);
  const weightedValues = consistencyScore === null || onTrackScore === null || healthScore === null
    ? null
    : formatTruthfulWeightedSum(
        consistencyScore * HEALTH_CONSISTENCY_WEIGHT,
        onTrackScore * HEALTH_ON_TRACK_WEIGHT,
        healthScore
      );

  return (
    <section className="rhythm-health-scoring-card health-scoring-details-card" aria-labelledby={headingId}>
      <HealthDetailsExpandableHeader
        id={headingId}
        contentId={contentId}
        title={title}
        expanded={expanded}
        onToggle={() => setExpanded(value => !value)}
      />
      <div id={contentId} className="rhythm-health-scoring-card__content" hidden={!expanded}>
        <section className="rhythm-health-scoring-card__calculation health-scoring-details-card__calculation">
          <h4>How Health is calculated</h4>
          <p>Consistency counts three times as much as On Track.</p>
          <HealthWeightPanels
            consistencyScore={consistencyScore}
            onTrackScore={onTrackScore}
          />
          <p className="rhythm-health-scoring-card__formula rhythm-health-scoring-card__formula--total">
            {weightedValues
              ? <><span>{weightedValues[0]} + {weightedValues[1]} = </span><strong>{weightedValues[2]}</strong></>
              : <span>One or both component scores are unavailable.</span>}
          </p>
        </section>
        {evidence && <AggregateEvidence evidence={evidence} />}
        {children}
      </div>
    </section>
  );
}

function AggregateEvidence({ evidence }: { evidence: HealthAggregateEvidence }) {
  const { rows, otherCount = 0 } = evidence;
  return (
    <section className="health-aggregate-evidence" aria-label={evidence.heading}>
      <div className="health-aggregate-evidence__heading">
        <h4>{evidence.heading}</h4>
        <p>{evidence.description}</p>
      </div>
      {rows.length > 0 || otherCount > 0 ? (
        <>
          <div className="health-aggregate-evidence__table-wrap">
            <table className="health-aggregate-evidence__table">
              <thead>
                <tr>
                  <th scope="col">{evidence.itemLabel}</th>
                  <th scope="col">Consistency</th>
                  <th scope="col">On Track</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id}>
                    <th scope="row">{row.label}</th>
                    <td>{displayEvidenceScore(row.consistency)}</td>
                    <td>{displayEvidenceScore(row.onTrack)}</td>
                  </tr>
                ))}
                {otherCount > 0 && (
                  <tr className="health-aggregate-evidence__other-row">
                    <th scope="row">
                      Other {otherCount} {evidence.itemLabel}{otherCount === 1 ? '' : 's'}
                    </th>
                    <td>—</td>
                    <td>—</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && (
            <p className="health-aggregate-evidence__empty">
              {evidence.emptyState ?? `No eligible ${evidence.itemLabel.toLowerCase()} inputs are available.`}
            </p>
          )}
        </>
      ) : (
        <p className="health-aggregate-evidence__empty">
          {evidence.emptyState ?? `No eligible ${evidence.itemLabel.toLowerCase()} inputs are available.`}
        </p>
      )}
      <div className="health-aggregate-evidence__averages">
        <AverageRow
          label="Consistency average"
          rows={rows}
          measure="consistency"
          count={evidence.consistencyCount}
          average={evidence.consistencyAverage}
        />
        <AverageRow
          label="On Track average"
          rows={rows}
          measure="onTrack"
          count={evidence.onTrackCount}
          average={evidence.onTrackAverage}
        />
      </div>
      <p className="health-aggregate-evidence__coverage">{evidence.coverage}</p>
      {evidence.notes?.map(note => (
        <p className="health-aggregate-evidence__note" key={note}>{note}</p>
      ))}
    </section>
  );
}

function AverageRow({
  label,
  rows,
  measure,
  count,
  average
}: {
  label: string;
  rows: readonly HealthScoringEvidenceRow[];
  measure: 'consistency' | 'onTrack';
  count: number;
  average: number | null;
}) {
  const values = rows
    .map(row => row[measure])
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const formula = average === null || count === 0
    ? '—'
    : values.length !== count || values.length > 2
      ? `Σ ${count} eligible scores ÷ ${count} = ${formatExact(average)}`
      : `${values.map(formatExact).join(' + ')}${values.length > 1 ? ` ÷ ${count}` : ` ÷ ${count}`} = ${formatExact(average)}`;
  return (
    <p>
      <span>{label}</span>
      <strong>{formula}</strong>
    </p>
  );
}

function displayEvidenceScore(score: number | null): string {
  return score === null || !Number.isFinite(score) ? '—' : formatScore(score);
}

function formatExact(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 10 });
}
