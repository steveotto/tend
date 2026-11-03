import { useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { CategoryScoreSelection } from '../domain/category-scoring.ts';
import { HealthScoreBreakdown, HealthScoreMeasures } from './HealthScoreBreakdown.tsx';
import type { HealthScoreMetric } from './HealthScoreBreakdown.tsx';
import { HealthScoreExplanation } from './HealthScoreExplanation.tsx';

type CategoryHealthSummaryProps = {
  title: string;
  itemTerm: {
    singular: string;
    plural: string;
  };
  score: CategoryScoreSelection;
  explanation: string;
  interpretationNote?: string;
  describeRollup?: boolean;
};

export function CategoryHealthSummary({
  title,
  itemTerm,
  score,
  explanation,
  interpretationNote,
  describeRollup = true
}: CategoryHealthSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const infoButtonRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const titleId = `${id}-title`;
  const calculationId = `${id}-calculation`;
  const detailsId = `${id}-details`;
  const coverage = score.eligibleFoundationIds.length === 0
    ? `No scored ${itemTerm.plural} yet`
    : `${score.eligibleFoundationIds.length} of ${score.foundationIds.length} ${itemTerm.plural} scored`;
  const consistencyMetric: HealthScoreMetric = {
    score: score.consistency,
    state: score.consistency === null ? 'unavailable' : 'scored',
    ...(score.consistency === null ? { explanation: 'No eligible items are available.' } : {})
  };
  const onTrackMetric: HealthScoreMetric = {
    score: score.onTrack,
    state: score.onTrack === null ? 'unavailable' : 'scored',
    ...(score.onTrack === null ? { explanation: 'No eligible items are available.' } : {})
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && expanded) {
      event.preventDefault();
      setExpanded(false);
      infoButtonRef.current?.focus();
    }
  };

  return (
    <HealthScoreBreakdown
      className="rhythm-history-view__score-card category-health-summary"
      title={title}
      titleId={titleId}
      score={score.health}
      healthLabel={title}
      ariaLabel={`${title} summary`}
      showMeasures={false}
      onKeyDown={handleKeyDown}
      consistency={consistencyMetric}
      onTrack={onTrackMetric}
      consistencyCaption="How regularly you show up"
      onTrackCaption="Whether your Rhythms are up to date"
      headingAction={(
        <button
          ref={infoButtonRef}
          type="button"
          className="rhythm-history-view__score-info"
          aria-label={`Show ${title} scoring explanation`}
          aria-expanded={expanded}
          aria-controls={`${calculationId} ${detailsId}`}
          onClick={() => setExpanded(current => !current)}
        >
          <span aria-hidden="true">i</span>
        </button>
      )}
    >
      <div id={calculationId} hidden={!expanded}>
        <HealthScoreExplanation
          title="How your Health score is calculated"
          subject="category"
          consistencyDescription={`The average Consistency score of eligible ${itemTerm.plural.toLowerCase()}.`}
          onTrackDescription={`The average On Track score of eligible ${itemTerm.plural.toLowerCase()}.`}
        />
      </div>
      <div className="rhythm-history-view__score-summary-divider" aria-hidden="true" />
      <HealthScoreMeasures
        healthScore={score.health}
        consistency={consistencyMetric}
        onTrack={onTrackMetric}
        consistencyCaption="How regularly you show up"
        onTrackCaption="Whether your Rhythms are up to date"
        showHealthMeter={false}
      />
      <p className="category-health-summary__coverage">{coverage}</p>
      <div
        id={detailsId}
        className="category-health-summary__details"
        role="region"
        aria-label={`${title} calculation details`}
        hidden={!expanded}
      >
        {explanation && <p>{explanation}</p>}
        {interpretationNote && <p>{interpretationNote}</p>}
        {describeRollup && (
          <>
            <p>
              Each eligible {itemTerm.singular} contributes equally to the category&apos;s average
              Consistency and On Track scores. Both scores must be available to count.
            </p>
            <p>
              Category Health blends those averages using the same fixed 75% Consistency and 25%
              On Track weights.
            </p>
          </>
        )}
        <p>— means unavailable; 0 is a valid score.</p>
      </div>
    </HealthScoreBreakdown>
  );
}
