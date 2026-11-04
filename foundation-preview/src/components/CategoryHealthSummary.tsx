import { useId, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import type { CategoryScoreSelection } from '../domain/category-scoring.ts';
import type { RhythmPreview } from '../domain/preview-data.ts';
import { HealthScoreBreakdown, HealthScoreInfoButton, HealthScoreMeasures } from './HealthScoreBreakdown.tsx';
import { HealthScoreDetailsDialog } from './HealthScoreDetailsDialog.tsx';
import type { HealthScoreMetric } from './HealthScoreBreakdown.tsx';
import { HealthScoreDetailsContent } from './HealthScoreDetailsContent.tsx';
import type { HealthRollupConfig } from './HealthRollupDiagram.tsx';

type CategoryHealthSummaryProps = {
  title: string;
  itemTerm: {
    singular: string;
    plural: string;
  };
  score: CategoryScoreSelection;
  explanation: string;
  unlinkedRhythms?: readonly RhythmPreview[];
  onEditRhythm?: (rhythm: RhythmPreview, event: MouseEvent<HTMLButtonElement>) => void;
  interpretationNote?: string;
  describeRollup?: boolean;
  coverageLabel?: string;
  consistencyDescription?: string;
  onTrackDescription?: string;
  rollup: HealthRollupConfig;
};

export function CategoryHealthSummary({
  title,
  itemTerm,
  score,
  explanation,
  unlinkedRhythms = [],
  onEditRhythm,
  interpretationNote,
  describeRollup = true,
  coverageLabel,
  consistencyDescription,
  onTrackDescription,
  rollup
}: CategoryHealthSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const infoButtonRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const titleId = `${id}-title`;
  const detailsId = `${id}-details`;
  const coverage = coverageLabel ?? (score.eligibleFoundationIds.length === 0
    ? `No scored ${itemTerm.plural} yet`
    : `${score.eligibleFoundationIds.length} of ${score.foundationIds.length} ${itemTerm.plural} scored`);
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

  const closeDetails = () => {
    setExpanded(false);
    requestAnimationFrame(() => infoButtonRef.current?.focus());
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
      consistency={consistencyMetric}
      onTrack={onTrackMetric}
      consistencyCaption="How regularly you show up"
      onTrackCaption="Whether your Rhythms are up to date"
      headingAction={(
        <HealthScoreInfoButton
          ref={infoButtonRef}
          label={`Show ${title} scoring explanation`}
          expanded={expanded}
          controls={detailsId}
          onClick={() => setExpanded(current => !current)}
        />
      )}
    >
      <div className="rhythm-history-view__score-summary-divider" aria-hidden="true" />
      <HealthScoreMeasures
        healthScore={score.health}
        consistency={consistencyMetric}
        onTrack={onTrackMetric}
        consistencyCaption="How regularly you show up"
        onTrackCaption="Whether your Rhythms are up to date"
        showHealthMeter={false}
      />
      {expanded && (
        <HealthScoreDetailsDialog title={`${title} details`} onClose={closeDetails}>
          <div id={detailsId} className="category-health-summary__details" role="region" aria-label={`${title} calculation details`}>
            <HealthScoreDetailsContent
              title={title}
              ariaLabel={`${title} calculation details`}
              score={score.health}
              healthLabel={title}
              consistency={consistencyMetric}
              onTrack={onTrackMetric}
              consistencyCaption="How regularly you show up"
              onTrackCaption="Whether your Rhythms are up to date"
              consistencyDescription={consistencyDescription
                ?? `The average Consistency score of eligible ${itemTerm.plural.toLowerCase()}.`}
              onTrackDescription={onTrackDescription
                ?? `The average On Track score of eligible ${itemTerm.plural.toLowerCase()}.`}
              rollup={rollup}
            >
              <p>{coverage.endsWith('.') ? coverage : `${coverage}.`}</p>
              {explanation && <p>{explanation}</p>}
              {interpretationNote && <p>{interpretationNote}</p>}
              {unlinkedRhythms.length > 0 && (
                <section className="category-health-summary__unlinked" aria-label="Rhythms missing required links">
                  <p>
                    {unlinkedRhythms.length} {unlinkedRhythms.length === 1 ? 'Rhythm isn’t' : 'Rhythms aren’t'} included yet.
                    Each needs a matching {itemTerm.singular} to contribute to this category&apos;s Health.
                    Linking it does not guarantee an immediate score; eligible history is still required.
                  </p>
                  {onEditRhythm && (
                    <ul>
                      {unlinkedRhythms.map(rhythm => (
                        <li key={rhythm.id}>
                          <button
                            type="button"
                            className="category-health-summary__edit-rhythm"
                            onClick={event => onEditRhythm(rhythm, event)}
                          >
                            Edit {rhythm.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}
              {describeRollup && (
                <p>
                  Each eligible {itemTerm.singular} contributes equally to the category&apos;s average
                  Consistency and On Track scores. Both scores must be available to count.
                </p>
              )}
            </HealthScoreDetailsContent>
          </div>
        </HealthScoreDetailsDialog>
      )}
    </HealthScoreBreakdown>
  );
}
