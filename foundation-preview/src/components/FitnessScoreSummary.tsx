import { useId, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { HealthScoreBreakdown } from './HealthScoreBreakdown.tsx';

type FitnessScoreSummaryProps = {
  category: 'Strength' | 'Cardio';
  consistency: number | null;
  onTrack: number | null;
  health: number | null;
  consistencyCaption: string;
  onTrackCaption: string;
  setupRequired?: boolean;
  statusMessage?: string | null;
  onSetup?: (event: MouseEvent<HTMLButtonElement>) => void;
  evidenceDetails?: ReactNode;
};

const scoreExplanations = {
  Strength: {
    consistency: 'How often you trained in completed periods over the last 28 days.',
    onTrack: 'How recently you trained compared with your schedule.'
  },
  Cardio: {
    consistency: 'How consistently you met both weekly run and distance goals across the four most recently completed weeks.',
    onTrack: 'This week’s run and distance goal progress.'
  }
} as const;

export function FitnessScoreSummary({
  category,
  consistency,
  onTrack,
  health,
  consistencyCaption,
  onTrackCaption,
  setupRequired = false,
  statusMessage = null,
  onSetup,
  evidenceDetails
}: FitnessScoreSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const infoButton = (
    <button
      type="button"
      className="rhythm-history-view__score-info fitness-score-summary__info"
      aria-label={`${expanded ? 'Hide' : 'Show'} ${category} Health scoring details`}
      aria-expanded={expanded}
      aria-controls={detailsId}
      onClick={() => setExpanded(value => !value)}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <circle cx="8" cy="8" r="6.25" />
        <path d="M8 7.2v4M8 4.8h.01" />
      </svg>
    </button>
  );
  const message = setupRequired
    ? 'Set up tracking to see your scores.'
    : statusMessage;

  return (
    <section className="fitness-score-summary" aria-label={`${category} scores`}>
      <HealthScoreBreakdown
        title="Health"
        score={health}
        healthLabel={`${category} Health`}
        ariaLabel={`${category} Health scores`}
        consistency={{ score: consistency }}
        onTrack={{ score: onTrack }}
        consistencyCaption={consistencyCaption}
        onTrackCaption={onTrackCaption}
        headingAction={infoButton}
      />
      {message && (
        <div className="fitness-score-summary__status" role="status">
          <p>{message}</p>
          {setupRequired && onSetup && (
            <button type="button" className="btn mini ghost" onClick={onSetup}>
              Set up tracking
            </button>
          )}
        </div>
      )}
      <div
        id={detailsId}
        className="fitness-score-summary__details"
        role="region"
        aria-label={`${category} Health scoring details`}
        hidden={!expanded}
      >
        <p><strong>Consistency</strong> {scoreExplanations[category].consistency}</p>
        <p><strong>On Track</strong> {scoreExplanations[category].onTrack}</p>
        <p><strong>Health</strong> 75% Consistency + 25% On Track.</p>
        {category === 'Strength' && <p>Rest readiness is shown separately.</p>}
        {evidenceDetails && (
          <details className="fitness-score-summary__evidence">
            <summary>Details</summary>
            {evidenceDetails}
          </details>
        )}
      </div>
    </section>
  );
}
