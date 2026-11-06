import { useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { HealthScoreInfoButton, HealthScoreMeasures, HealthScoreMeter } from './HealthScoreBreakdown.tsx';
import { formatScore } from '../domain/score-display.ts';
import { HealthScoreDetailsDialog } from './HealthScoreDetailsDialog.tsx';
import { HealthScoreDetailsContent } from './HealthScoreDetailsContent.tsx';

type HealthScoreSummaryProps = {
  title: string;
  score: number | null;
  consistency: number | null;
  onTrack: number | null;
  coverage: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  children: ReactNode;
  summaryContent?: ReactNode;
  className?: string;
  ariaLabel?: string;
  infoLabel?: string;
  detailsLabel?: string;
  showMeasures?: boolean;
  showHealthMeter?: boolean;
  consistencyDetailCaption?: string;
  onTrackDetailCaption?: string;
  consistencyDescription?: string;
  onTrackDescription?: string;
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
  summaryContent,
  className = '',
  ariaLabel,
  infoLabel = title,
  detailsLabel = `${title} scoring explanation`,
  showMeasures = true,
  showHealthMeter = false,
  consistencyDetailCaption = 'How regularly you show up.',
  onTrackDetailCaption = 'How caught up you are.',
  consistencyDescription,
  onTrackDescription
}: HealthScoreSummaryProps) {
  const id = useId();
  const headingId = `${id}-heading`;
  const detailsId = `${id}-details`;
  const toggleRef = useRef<HTMLButtonElement>(null);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Escape' || !expanded) return;
    event.stopPropagation();
  }

  function closeDetails() {
    onExpandedChange(false);
    requestAnimationFrame(() => toggleRef.current?.focus());
  }

  return (
    <section
      className={`card category-health-card category-health-summary health-score-summary ${className}`.trim()}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : headingId}
      onKeyDown={handleKeyDown}
    >
      <div className="category-health-heading">
        <div className="category-health-copy">
          <div className="category-health-summary__title-row">
            <h3 id={headingId}>{title}</h3>
            <HealthScoreInfoButton
              ref={toggleRef}
              label={`Show ${infoLabel} scoring explanation`}
              expanded={expanded}
              controls={detailsId}
              onClick={() => onExpandedChange(!expanded)}
            />
          </div>
        </div>
        <HealthSummaryValue
          label={`${title} score`}
          score={score}
          className="category-health-score"
          decorative={expanded}
        />
      </div>

      {showMeasures ? (
        <HealthScoreMeasures
          healthScore={score}
          healthLabel={title}
          consistency={{ score: consistency, state: consistency === null ? 'unavailable' : 'scored' }}
          onTrack={{ score: onTrack, state: onTrack === null ? 'unavailable' : 'scored' }}
          consistencyCaption={consistencyDetailCaption}
          onTrackCaption={onTrackDetailCaption}
          showHealthMeter={showHealthMeter}
        />
      ) : showHealthMeter ? (
        <HealthScoreMeter score={score} label={`${title} progress`} />
      ) : null}
      {summaryContent}
      {expanded && (
        <HealthScoreDetailsDialog title={`${title} details`} onClose={closeDetails}>
          <div id={detailsId} className="category-health-summary__details" role="region" aria-label={detailsLabel}>
            <HealthScoreDetailsContent
              title={title}
              ariaLabel={detailsLabel}
              score={score}
              consistency={{ score: consistency }}
              onTrack={{ score: onTrack }}
              consistencyCaption={consistencyDetailCaption}
              onTrackCaption={onTrackDetailCaption}
              {...(consistencyDescription === undefined ? {} : { consistencyDescription })}
              {...(onTrackDescription === undefined ? {} : { onTrackDescription })}
            >
              <p>{coverage}</p>
              {children}
            </HealthScoreDetailsContent>
          </div>
        </HealthScoreDetailsDialog>
      )}
    </section>
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
        {formatScore(usableScore)}
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
        : { 'aria-valuenow': usableScore, 'aria-valuetext': `${formatScore(usableScore)} out of 100` })}
    >
      {formatScore(usableScore)}
    </span>
  );
}
