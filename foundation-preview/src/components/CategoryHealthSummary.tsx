import { useId, useState } from 'react';
import type { CategoryScoreSelection } from '../domain/category-scoring.ts';
import { HealthWeightPanels } from './HealthWeightPanels.tsx';
import type { FoundationTerminology } from '../domain/preview-data.ts';

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
  const id = useId();
  const headingId = `${id}-heading`;
  const detailsId = `${id}-details`;
  const scoredCount = score.eligibleFoundationIds.length;
  const coverage = scoredCount === 0
    ? `No scored ${itemTerm.plural} yet`
    : `${scoredCount} of ${score.foundationIds.length} ${itemTerm.plural} scored`;

  return (
    <section
      className="card category-health-card category-health-summary"
      aria-labelledby={headingId}
    >
      <div className="category-health-heading">
        <div className="category-health-copy">
          <div className="category-health-summary__title-row">
            <h3 id={headingId}>{categoryLabel} Health</h3>
            <button
              type="button"
              className="rhythm-history-view__score-info"
              aria-label={`${expanded ? 'Hide' : 'Show'} ${categoryLabel} scoring explanation`}
              aria-expanded={expanded}
              aria-controls={detailsId}
              onClick={() => setExpanded(value => !value)}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <circle cx="8" cy="8" r="6.25" />
                <path d="M8 7.2v4M8 4.8h.01" />
              </svg>
            </button>
          </div>
          <p className="category-health-status">{coverage}</p>
        </div>
        <CategoryHealthValue
          label={`${categoryLabel} Health score`}
          score={score.health}
          className="category-health-score"
        />
      </div>

      <div className="health-summary-breakdown" role="group" aria-label={`${categoryLabel} summary measures`}>
        <SummaryMeasure label="Consistency" description="How regularly you show up" score={score.consistency} />
        <SummaryMeasure label="On Track" description="How caught up you are" score={score.onTrack} />
      </div>

      <div
        id={detailsId}
        className="category-health-summary__details"
        role="region"
        aria-label={`${categoryLabel} Health explanation`}
        hidden={!expanded}
      >
        {explanationIntro && (
          <p className="category-health-summary__interpretation">{explanationIntro}</p>
        )}
        <p className="category-health-summary__explanation">
          Each scored {itemTerm.singular} counts equally.
        </p>
        <HealthWeightPanels consistencyDescription="" onTrackDescription="" />
        <p className="category-health-summary__explanation">
          {itemTerm.plural} need both scores to count.
        </p>
        {interpretationNote && (
          <p className="category-health-summary__interpretation">{interpretationNote}</p>
        )}
      </div>
    </section>
  );
}

function SummaryMeasure({
  label,
  description,
  score
}: {
  label: string;
  description: string;
  score: number | null;
}) {
  return (
    <div className="health-summary-item">
      <span className="health-summary-label">{label}</span>
      <CategoryHealthValue
        label={`${label} score`}
        score={score}
        className="health-summary-score"
      />
      <span className="category-health-summary__measure-description">{description}</span>
    </div>
  );
}

function CategoryHealthValue({
  label,
  score,
  className
}: {
  label: string;
  score: number | null;
  className: string;
}) {
  const usableScore = score !== null && Number.isFinite(score)
    ? Math.max(0, Math.min(100, score))
    : null;

  return (
    <span
      className={`${className}${usableScore === null ? ' neutral' : ''}`}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      {...(usableScore === null
        ? { 'aria-valuetext': 'Score unavailable' }
        : { 'aria-valuenow': usableScore, 'aria-valuetext': `${usableScore} out of 100` })}
    >
      {usableScore === null ? '—' : Math.round(usableScore)}
    </span>
  );
}
