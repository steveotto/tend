import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import {
  formatHealthAverageEquation,
  formatScore
} from '../domain/score-display.ts';
import { HEALTH_CONSISTENCY_WEIGHT, HEALTH_ON_TRACK_WEIGHT } from '../domain/rhythm-history.ts';
import { HealthDetailsExpandableHeader } from './HealthDetailsExpandableHeader.tsx';
import { HealthWeightPanels, formatTruthfulWeightedSum } from './HealthWeightPanels.tsx';
import { CategoryHealthBadge } from './Cards.tsx';

export type HealthScoringEvidenceRow = {
  id: string;
  label: string;
  consistency: number | null;
  onTrack: number | null;
  context?: string;
};

export type HealthScoringExcludedEvidenceRow = {
  id: string;
  label: string;
  context?: string;
  reason: string;
};

export type HealthAreaScoringExplanation = {
  label: string;
  explanation: string;
};

export type HealthAggregateEvidence = {
  heading: string;
  description?: string;
  itemLabel: string;
  rows: readonly HealthScoringEvidenceRow[];
  otherCount?: number;
  consistencyAverage: number | null;
  consistencyCount: number;
  onTrackAverage: number | null;
  onTrackCount: number;
  coverage?: string;
  excludedRows?: readonly HealthScoringExcludedEvidenceRow[];
  notes?: readonly string[];
  emptyState?: string;
  showEmptyStateWhenNoAverages?: boolean;
  averageLabels?: {
    consistency: string;
    onTrack: string;
  };
  weightSummary?: string | null;
  areaExplanations?: readonly HealthAreaScoringExplanation[];
  presentation?: 'person-rhythm';
  countLabel?: string;
};

export function HealthScoringDetailsCard({
  title,
  healthScore,
  consistencyScore,
  onTrackScore,
  evidence,
  formulaContent,
  children,
  initialExpanded = false
}: {
  title: string;
  healthScore: number | null;
  consistencyScore: number | null;
  onTrackScore: number | null;
  evidence?: HealthAggregateEvidence;
  formulaContent?: ReactNode;
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
        {formulaContent ?? (
          <section className="rhythm-health-scoring-card__calculation health-scoring-details-card__calculation">
            <h4>How Health is calculated</h4>
            {evidence?.weightSummary !== null && (
              <p>{evidence?.weightSummary ?? 'Consistency counts three times as much as On Track.'}</p>
            )}
            <HealthWeightPanels
              consistencyScore={consistencyScore}
              onTrackScore={onTrackScore}
            />
            <p className="rhythm-health-scoring-card__formula rhythm-health-scoring-card__formula--total">
              {weightedValues
                ? <><span>{weightedValues[0]} + {weightedValues[1]} {weightedValues[3]} </span><strong>{weightedValues[2]}</strong></>
                : <span>One or both component scores are unavailable.</span>}
            </p>
          </section>
        )}
        {evidence && (
          <AggregateEvidence
            evidence={evidence}
          />
        )}
        {children}
      </div>
    </section>
  );
}

function AggregateEvidence({ evidence }: {
  evidence: HealthAggregateEvidence;
}) {
  const { rows, otherCount = 0 } = evidence;
  const personRhythmPresentation = evidence.presentation === 'person-rhythm';
  const excludedRows = evidence.excludedRows ?? [];
  const noAveragesAvailable = evidence.consistencyAverage === null && evidence.onTrackAverage === null;
  return (
    <section
      className={`health-aggregate-evidence${personRhythmPresentation ? ' health-aggregate-evidence--person-rhythm' : ''}`}
      aria-label={evidence.heading}
    >
      <div className="health-aggregate-evidence__heading">
        <h4>{evidence.heading}</h4>
        {evidence.countLabel && (
          <div className="health-aggregate-evidence__heading-meta">
            <span className="health-aggregate-evidence__count">{evidence.countLabel}</span>
            {personRhythmPresentation && (
              <details className="health-aggregate-evidence__info">
                <summary aria-label="Scored Rhythm eligibility information">i</summary>
                <span>Active linked Rhythms with both scores available count equally.</span>
              </details>
            )}
          </div>
        )}
        {evidence.description && <p>{evidence.description}</p>}
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
                    <th scope="row">
                      <span>{row.label}</span>
                      {!personRhythmPresentation && row.context && <small>{row.context}</small>}
                    </th>
                    <td>{personRhythmPresentation
                      ? <CategoryHealthBadge
                          score={row.consistency}
                          appearance="rounded"
                          className="health-aggregate-evidence__score"
                          accessibleLabel={`${row.label} Consistency: ${displayEvidenceScore(row.consistency)}`}
                        />
                      : displayEvidenceScore(row.consistency)}
                    </td>
                    <td>{personRhythmPresentation
                      ? <CategoryHealthBadge
                          score={row.onTrack}
                          appearance="rounded"
                          className="health-aggregate-evidence__score"
                          accessibleLabel={`${row.label} On Track: ${displayEvidenceScore(row.onTrack)}`}
                        />
                      : displayEvidenceScore(row.onTrack)}
                    </td>
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
      {evidence.showEmptyStateWhenNoAverages && noAveragesAvailable && rows.length > 0 && (
        <p className="health-aggregate-evidence__empty" role="status">
          {evidence.emptyState ?? 'No scores available yet.'}
        </p>
      )}
      {excludedRows.length > 0 && (personRhythmPresentation ? (
        <details className="health-aggregate-evidence__not-scored">
          <summary>Not scored ({excludedRows.length})</summary>
          <ul>
            {excludedRows.map(row => (
              <li key={row.id}>
                <strong>{row.label}</strong>
                <span>{row.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <section className="health-aggregate-evidence__excluded" aria-label="Excluded inputs">
          <h5>Excluded inputs</h5>
          <ul>
            {excludedRows.map(row => (
              <li key={row.id}>
                <strong>{row.label}</strong>
                {row.context && <span>{row.context}</span>}
                <span>{row.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="health-aggregate-evidence__averages">
        <AverageRow
          label={evidence.averageLabels?.consistency ?? 'Consistency average'}
          rows={rows}
          measure="consistency"
          count={evidence.consistencyCount}
          average={evidence.consistencyAverage}
          compact={personRhythmPresentation}
        />
        <AverageRow
          label={evidence.averageLabels?.onTrack ?? 'On Track average'}
          rows={rows}
          measure="onTrack"
          count={evidence.onTrackCount}
          average={evidence.onTrackAverage}
          compact={personRhythmPresentation}
        />
      </div>
      {!personRhythmPresentation && evidence.coverage && (
        <p className="health-aggregate-evidence__coverage">{evidence.coverage}</p>
      )}
      {!personRhythmPresentation && evidence.notes?.map(note => (
        <p className="health-aggregate-evidence__note" key={note}>{note}</p>
      ))}
      {evidence.areaExplanations && evidence.areaExplanations.length > 0 && (
        <AreaScoringDisclosure explanations={evidence.areaExplanations} />
      )}
    </section>
  );
}

function AreaScoringDisclosure({
  explanations
}: {
  explanations: readonly HealthAreaScoringExplanation[];
}) {
  const headingId = useId();
  const contentId = useId();
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="health-scoring-details-card__area-scoring" aria-labelledby={headingId}>
      <HealthDetailsExpandableHeader
        id={headingId}
        contentId={contentId}
        title="How each area is scored"
        expanded={expanded}
        onToggle={() => setExpanded(value => !value)}
        headingLevel="h5"
      />
      <div id={contentId} className="rhythm-health-scoring-card__content" hidden={!expanded}>
        {explanations.map(({ label, explanation }) => (
          <p key={label}><strong>{label}:</strong> {explanation}</p>
        ))}
      </div>
    </section>
  );
}

function AverageRow({
  label,
  rows,
  measure,
  count,
  average,
  compact
}: {
  label: string;
  rows: readonly HealthScoringEvidenceRow[];
  measure: 'consistency' | 'onTrack';
  count: number;
  average: number | null;
  compact: boolean;
}) {
  const values = rows
    .map(row => row[measure])
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const formula = formatHealthAverageEquation(values, average, count);
  return (
    <p>
      <span>{label}</span>
      <strong>{compact ? formatScore(average) : formula}</strong>
    </p>
  );
}

function displayEvidenceScore(score: number | null): string {
  return score === null || !Number.isFinite(score) ? '—' : formatScore(score);
}
