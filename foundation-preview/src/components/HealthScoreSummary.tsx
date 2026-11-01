import { useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { HealthScoreMeasures } from './HealthScoreBreakdown.tsx';

type HealthScoreSummaryProps = {
  title: string;
  score: number | null;
  consistency: number | null;
  onTrack: number | null;
  coverage: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  infoLabel?: string;
  detailsLabel?: string;
  consistencyDetailCaption?: string;
  onTrackDetailCaption?: string;
};

export function HealthScoreSummary({
  title,
  score,
  consistency,
  onTrack,
  coverage,
  expanded,
  onExpandedChange,
  children,
  className = '',
  ariaLabel,
  infoLabel = title,
  detailsLabel = `${title} scoring explanation`,
  consistencyDetailCaption = 'How regularly you show up.',
  onTrackDetailCaption = 'How caught up you are.'
}: HealthScoreSummaryProps) {
  const id = useId();
  const headingId = `${id}-heading`;
  const detailsId = `${id}-details`;
  const toggleRef = useRef<HTMLButtonElement>(null);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Escape' || !expanded) return;
    event.preventDefault();
    event.stopPropagation();
    onExpandedChange(false);
    toggleRef.current?.focus();
  }

  return (
    <section
      className={`card category-health-card category-health-summary ${className}`.trim()}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : headingId}
      onKeyDown={handleKeyDown}
    >
      <div className="category-health-heading">
        <div className="category-health-copy">
          <div className="category-health-summary__title-row">
            <h3 id={headingId}>{title}</h3>
            <button
              ref={toggleRef}
              type="button"
              className="rhythm-history-view__score-info"
              aria-label={`${expanded ? 'Hide' : 'Show'} ${infoLabel} scoring explanation`}
              aria-expanded={expanded}
              aria-controls={detailsId}
              onClick={() => onExpandedChange(!expanded)}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <circle cx="8" cy="8" r="6.25" />
                <path d="M8 7.2v4M8 4.8h.01" />
              </svg>
            </button>
          </div>
          <p className="category-health-status">{coverage}</p>
        </div>
        <HealthSummaryValue
          label={`${title} score`}
          score={score}
          className="category-health-score"
          decorative={expanded}
        />
      </div>

      {!expanded && (
        <div className="health-summary-breakdown" role="group" aria-label={`${title} summary measures`}>
          <SummaryMeasure label="Consistency" score={consistency} description="How regularly you show up" />
          <SummaryMeasure label="On Track" score={onTrack} description="How caught up you are" />
        </div>
      )}

      <div
        id={detailsId}
        className="category-health-summary__details"
        role="region"
        aria-label={detailsLabel}
        hidden={!expanded}
      >
        <HealthScoreMeasures
          healthScore={score}
          healthLabel={title}
          consistency={{ score: consistency, state: consistency === null ? 'unavailable' : 'scored' }}
          onTrack={{ score: onTrack, state: onTrack === null ? 'unavailable' : 'scored' }}
          consistencyCaption={consistencyDetailCaption}
          onTrackCaption={onTrackDetailCaption}
        />
        {children}
      </div>
    </section>
  );
}

function SummaryMeasure({
  label,
  score,
  description
}: {
  label: string;
  score: number | null;
  description: string;
}) {
  return (
    <div className="health-summary-item">
      <span className="health-summary-label">{label}</span>
      <HealthSummaryValue label={`${label} score`} score={score} className="health-summary-score" />
      <span className="category-health-summary__measure-description">{description}</span>
    </div>
  );
}

function HealthSummaryValue({
  label,
  score,
  className,
  decorative = false
}: {
  label: string;
  score: number | null;
  className: string;
  decorative?: boolean;
}) {
  const usableScore = score !== null && Number.isFinite(score)
    ? Math.max(0, Math.min(100, score))
    : null;

  if (decorative) {
    return (
      <span className={`${className}${usableScore === null ? ' neutral' : ''}`} aria-hidden="true">
        {usableScore === null ? '—' : Math.round(usableScore)}
      </span>
    );
  }

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
