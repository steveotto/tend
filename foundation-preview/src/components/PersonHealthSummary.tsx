import { useState } from 'react';
import type { ReactNode } from 'react';
import type { HealthMeasureAggregate } from '../domain/health-scoring.ts';
import { formatScore } from '../domain/score-display.ts';
import { scoreTone } from '../domain/score-tone.ts';
import { HealthScoreSummary } from './HealthScoreSummary.tsx';

export type PersonHealthComponentScore = {
  label: string;
  score: number | null;
};

type PersonHealthSummaryProps = {
  title: string;
  health: HealthMeasureAggregate;
  itemTerm: string;
  totalCount: number;
  eligibleCount: number;
  excludedCount?: number;
  unresolvedCount?: number;
  archivedCount?: number;
  unscoredCount?: number;
  coverageLabel?: string;
  emptyMessage?: string;
  showMeasures?: boolean;
  showHealthMeter?: boolean;
  summaryContent?: ReactNode;
  headerStyle?: 'summary' | 'category';
};

export function PersonHealthSummary({
  title,
  health,
  itemTerm,
  totalCount,
  eligibleCount,
  excludedCount = 0,
  unresolvedCount = 0,
  archivedCount = 0,
  unscoredCount = 0,
  coverageLabel,
  emptyMessage,
  showMeasures = true,
  showHealthMeter = false,
  summaryContent,
  headerStyle = 'summary'
}: PersonHealthSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const coverage = coverageLabel ?? (totalCount === 0
    ? emptyMessage ?? `No ${itemTerm} yet.`
    : `${eligibleCount} of ${totalCount} ${itemTerm}${totalCount === 1 ? '' : 's'} scored.`);
  const pluralTerm = `${itemTerm}${itemTerm.endsWith('s') ? '' : 's'}`;
  const countText = (count: number) => `${count} ${itemTerm}${count === 1 ? '' : 's'}`;

  return (
    <HealthScoreSummary
      className="person-component-health-summary"
      ariaLabel={`${title} summary`}
      title={title}
      score={health.health}
      consistency={health.consistency}
      onTrack={health.onTrack}
      coverage={coverage}
      expanded={expanded}
      onExpandedChange={setExpanded}
      showMeasures={showMeasures}
      showHealthMeter={showHealthMeter}
      headerStyle={headerStyle}
      summaryContent={summaryContent}
      consistencyDescription={`The average Consistency score of eligible ${pluralTerm}.`}
      onTrackDescription={`The average On Track score of eligible ${pluralTerm}.`}
    >
      <p className="category-health-summary__explanation">
        Each scored {itemTerm} counts equally.
      </p>
      <p className="category-health-summary__explanation">
        Only {pluralTerm} with both measures scored count; missing and unscored values are excluded, not treated as zero.
      </p>
      {excludedCount > 0 && (
        <p className="category-health-summary__explanation">
          {countText(excludedCount)} {excludedCount === 1 ? 'is' : 'are'} excluded for missing measures.
        </p>
      )}
      {unresolvedCount > 0 && (
        <p className="category-health-summary__explanation">
          {countText(unresolvedCount)} have unresolved scores.
        </p>
      )}
      {unscoredCount > 0 && (
        <p className="category-health-summary__explanation">
          {countText(unscoredCount)} do not have scored measures yet.
        </p>
      )}
      {archivedCount > 0 && (
        <p className="category-health-summary__explanation">
          {countText(archivedCount)} {archivedCount === 1 ? 'is' : 'are'} archived and excluded.
        </p>
      )}
    </HealthScoreSummary>
  );
}

export function PersonHealthComponentScores({
  values
}: {
  values: readonly PersonHealthComponentScore[];
}) {
  return (
    <div className="person-health-component-scores" role="group" aria-label="Health by area">
      {values.map(({ label, score }) => {
        const value = score !== null && Number.isFinite(score) ? score : null;
        const available = value !== null;
        return (
          <div className={`person-health-component-score ${scoreTone(value)}`} key={label}>
            <span
              role={available ? 'meter' : 'img'}
              aria-label={available ? `${label} Health score` : `${label} Health score: unavailable`}
              aria-valuemin={available ? 0 : undefined}
              aria-valuemax={available ? 100 : undefined}
              aria-valuenow={value ?? undefined}
              aria-valuetext={value === null ? undefined : `${formatScore(value)} out of 100`}
            >
              {formatScore(value)}
            </span>
            <span aria-hidden="true">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
