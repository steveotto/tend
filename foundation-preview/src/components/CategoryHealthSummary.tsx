import { useState } from 'react';
import type { CategoryScoreSelection } from '../domain/category-scoring.ts';
import type { FoundationTerminology } from '../domain/preview-data.ts';
import { HealthScoreSummary } from './HealthScoreSummary.tsx';

type CategoryHealthSummaryProps = {
  categoryLabel: string;
  score: CategoryScoreSelection;
  itemTerm?: FoundationTerminology;
  explanationIntro?: string;
  interpretationNote?: string;
};

export function CategoryHealthSummary({
  categoryLabel,
  score,
  itemTerm = { singular: 'Foundation', plural: 'Foundations' },
  explanationIntro,
  interpretationNote
}: CategoryHealthSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const scoredCount = score.eligibleFoundationIds.length;
  const coverage = scoredCount === 0
    ? `No scored ${itemTerm.plural} yet`
    : `${scoredCount} of ${score.foundationIds.length} ${itemTerm.plural} scored`;

  return (
    <HealthScoreSummary
      title={`${categoryLabel} Health`}
      score={score.health}
      consistency={score.consistency}
      onTrack={score.onTrack}
      coverage={coverage}
      expanded={expanded}
      onExpandedChange={setExpanded}
      infoLabel={categoryLabel}
      detailsLabel={`${categoryLabel} Health explanation`}
      consistencyDetailCaption="How often you show up."
    >
      {explanationIntro && (
        <p className="category-health-summary__interpretation">{explanationIntro}</p>
      )}
      <p className="category-health-summary__explanation">
        Each scored {itemTerm.singular} counts equally.
      </p>
      <p className="category-health-summary__explanation">
        Health combines 75% Consistency and 25% On Track.
      </p>
      <p className="category-health-summary__explanation">
        {itemTerm.plural} need both scores to count.
      </p>
      {interpretationNote && (
        <p className="category-health-summary__interpretation">{interpretationNote}</p>
      )}
    </HealthScoreSummary>
  );
}
