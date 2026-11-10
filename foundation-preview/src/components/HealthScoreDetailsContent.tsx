import { useId } from 'react';
import type { ReactNode } from 'react';
import type { HealthScoreMetric } from './HealthScoreBreakdown.tsx';
import { HealthScoreBreakdown } from './HealthScoreBreakdown.tsx';
import { HealthInfoWhatCounts } from './HealthInfoWhatCounts.tsx';
import { HealthWeightPanels } from './HealthWeightPanels.tsx';
import type { HealthRollupConfig } from './HealthRollupDiagram.tsx';

export function HealthScoreDetailsContent({
  title,
  ariaLabel,
  score,
  healthLabel = title,
  consistency,
  onTrack,
  consistencyCaption,
  onTrackCaption,
  consistencyDescription,
  onTrackDescription,
  unavailableExplanation,
  rollup,
  children
}: {
  title: string;
  ariaLabel: string;
  score: number | null;
  healthLabel?: string;
  consistency: HealthScoreMetric;
  onTrack: HealthScoreMetric;
  consistencyCaption: string;
  onTrackCaption: string;
  consistencyDescription?: string;
  onTrackDescription?: string;
  unavailableExplanation?: string;
  rollup?: HealthRollupConfig;
  children?: ReactNode;
}) {
  const calculationId = useId();
  return (
    <div className="health-score-details-content">
      <HealthScoreBreakdown
        title="Overall Health"
        score={score}
        healthLabel={healthLabel}
        ariaLabel={`${ariaLabel} score summary`}
        consistency={consistency}
        onTrack={onTrack}
        consistencyCaption={consistencyCaption}
        onTrackCaption={onTrackCaption}
        showMeasures={false}
      />
      <section
        className="health-info-calculation"
        aria-labelledby={calculationId}
      >
        <h3 id={calculationId}>How Health is calculated</h3>
        <HealthWeightPanels
          consistencyScore={consistency.state === 'unscored' || consistency.state === 'unavailable'
            ? null
            : consistency.score}
          onTrackScore={onTrack.state === 'unscored' || onTrack.state === 'unavailable'
            ? null
            : onTrack.score}
          consistencyCaption="How regularly you follow through"
          onTrackCaption="How caught up you are."
          {...(consistencyDescription === undefined ? {} : { consistencyDescription })}
          {...(onTrackDescription === undefined ? {} : { onTrackDescription })}
        />
        {unavailableExplanation && (
          <p className="health-info-calculation__note">{unavailableExplanation}</p>
        )}
      </section>
      {rollup
        ? <HealthInfoWhatCounts config={rollup}>{children}</HealthInfoWhatCounts>
        : children}
      <footer className="health-score-details-content__score-note">
        {(rollup?.footer ?? ['— means unavailable; 0 is a valid score.'])
          .map(note => <p key={note}>{note}</p>)}
      </footer>
    </div>
  );
}
