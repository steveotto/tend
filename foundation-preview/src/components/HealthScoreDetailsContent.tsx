import { useId } from 'react';
import type { ReactNode } from 'react';
import type { HealthScoreMetric } from './HealthScoreBreakdown.tsx';
import { HealthScoreBreakdown } from './HealthScoreBreakdown.tsx';
import { HealthInfoWhatCounts } from './HealthInfoWhatCounts.tsx';
import { HealthInfoIdentityCard } from './HealthInfoIdentityCard.tsx';
import { HealthWeightPanels } from './HealthWeightPanels.tsx';
import type { HealthRollupConfig } from './HealthRollupDiagram.tsx';
import type { HealthInfoIdentity } from '../domain/rhythm-contribution.ts';
import { HealthScoringDetailsCard } from './HealthScoringDetailsCard.tsx';
import type { HealthAggregateEvidence } from './HealthScoringDetailsCard.tsx';

export function HealthScoreDetailsContent({
  title,
  ariaLabel,
  score,
  healthLabel = title,
  consistency,
  onTrack,
  unavailableExplanation,
  rollup,
  healthIdentity,
  rhythmIdentity,
  children,
  scoringDetails,
  scoringCard,
  scoringDisclosureTitle,
  scoringEvidence,
  scoringExplanation,
  showScoreNote = true,
  initialContributionExpanded = true,
  summaryTitle,
  showMeasures = true
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
  healthIdentity?: HealthInfoIdentity;
  rhythmIdentity?: { name: string; schedule?: string };
  children?: ReactNode;
  scoringDetails?: ReactNode;
  scoringCard?: ReactNode;
  scoringDisclosureTitle?: string;
  scoringEvidence?: HealthAggregateEvidence;
  scoringExplanation?: ReactNode;
  showScoreNote?: boolean;
  initialContributionExpanded?: boolean;
  summaryTitle?: string;
  showMeasures?: boolean;
}) {
  const calculationId = useId();
  const identity = healthIdentity
    ?? rollup?.healthContribution?.identity
    ?? (rhythmIdentity
      ? {
          name: rhythmIdentity.name,
          ...(rhythmIdentity.schedule ? { secondary: rhythmIdentity.schedule } : {}),
          icon: { kind: 'rhythm' as const }
        }
      : undefined);
  const consistencyScore = consistency.state === undefined || consistency.state === 'scored'
    ? consistency.score
    : null;
  const onTrackScore = onTrack.state === undefined || onTrack.state === 'scored'
    ? onTrack.score
    : null;
  return (
    <div className="health-score-details-content">
      {identity && <HealthInfoIdentityCard identity={identity} />}
      <section className="health-info-summary-card" aria-label="Health summary">
        <HealthScoreBreakdown
          title={summaryTitle ?? 'Overall Health'}
          score={score}
          size="detail"
          healthLabel={healthLabel ?? summaryTitle ?? 'Overall Health'}
          ariaLabel={`${ariaLabel} score summary`}
          consistency={consistency}
          onTrack={onTrack}
          consistencyCaption="Follow-through over time"
          onTrackCaption="How caught up you are"
          showMeasures={showMeasures}
          showMeasureCaptions={showMeasures}
        />
        {!scoringCard && !scoringDisclosureTitle && (
          <>
            <section
              className="health-info-calculation"
              aria-labelledby={calculationId}
            >
              <h3 id={calculationId}>How Health is calculated</h3>
              <HealthWeightPanels
                consistencyScore={consistencyScore}
                onTrackScore={onTrackScore}
              />
              {unavailableExplanation && (
                <p className="health-info-calculation__note">{unavailableExplanation}</p>
              )}
            </section>
            {children}
          </>
        )}
      </section>
      {scoringCard}
      {!scoringCard && scoringDisclosureTitle && (
        <HealthScoringDetailsCard
          title={scoringDisclosureTitle}
          healthScore={score}
          consistencyScore={consistencyScore}
          onTrackScore={onTrackScore}
          {...(scoringEvidence ? { evidence: scoringEvidence } : {})}
        >
          {scoringExplanation}
        </HealthScoringDetailsCard>
      )}
      {rollup && (
        <section className="health-info-contribution-card" aria-label="Health contribution">
          <HealthInfoWhatCounts
            config={rollup}
            initialContributionExpanded={initialContributionExpanded}
          >
            {scoringDetails}
          </HealthInfoWhatCounts>
        </section>
      )}
      {showScoreNote && (
        <footer className="health-score-details-content__score-note">
          <p>— unavailable · 0 is a valid score</p>
        </footer>
      )}
    </div>
  );
}
