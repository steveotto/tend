import { useState } from 'react';
import type { HealthMeasureAggregate } from '../domain/health-scoring.ts';
import { HealthScoreSummary } from './HealthScoreSummary.tsx';

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
  emptyMessage
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
    >
      <p className="category-health-summary__explanation">
        Each scored {itemTerm} counts equally.
      </p>
      <p className="category-health-summary__explanation">
        Health combines 75% Consistency and 25% On Track.
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
