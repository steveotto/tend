import { useId, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { HealthScoreBreakdown, HealthScoreInfoButton } from './HealthScoreBreakdown.tsx';
import { HealthScoreDetailsDialog } from './HealthScoreDetailsDialog.tsx';
import { HealthScoreDetailsContent } from './HealthScoreDetailsContent.tsx';
import { createHealthFitnessRollup } from './HealthRollupDiagram.tsx';
import type { HealthRollupConfig } from './HealthRollupDiagram.tsx';
import type { HealthAggregateEvidence } from './HealthScoringDetailsCard.tsx';

type FitnessScoreSummaryProps = {
  category: 'Strength' | 'Cardio' | 'Weight';
  healthTitle?: string;
  consistency: number | null;
  onTrack: number | null;
  health: number | null;
  consistencyCaption: string;
  onTrackCaption: string;
  setupRequired?: boolean;
  statusMessage?: string | null;
  summaryExplanation?: string;
  className?: string;
  compact?: boolean;
  showSetupAction?: boolean;
  onSetup?: (event: MouseEvent<HTMLButtonElement>) => void;
  evidenceDetails?: ReactNode;
  rollup?: HealthRollupConfig;
  overallHealthScore?: number | null;
  categoryHealthScore?: number | null;
  linkedRhythmCount?: number;
  scoringEvidence?: HealthAggregateEvidence;
  scoringExplanation?: ReactNode;
};

const scoreExplanations = {
  Strength: {
    consistency: 'How often you trained in completed periods over the last 28 days.',
    onTrack: 'How recently you trained compared with your schedule.'
  },
  Cardio: {
    consistency: 'How consistently you met both weekly run and distance goals across the four most recently completed weeks.',
    onTrack: 'This week’s run and distance goal progress.'
  },
  Weight: {
    consistency: 'How consistently you completed scheduled weigh-in Rhythms.',
    onTrack: 'Whether you are caught up with weigh-ins due on those Rhythms.'
  }
} as const;

export function FitnessScoreSummary({
  category,
  healthTitle = 'Health',
  consistency,
  onTrack,
  health,
  consistencyCaption,
  onTrackCaption,
  setupRequired = false,
  statusMessage = null,
  summaryExplanation,
  className = '',
  showSetupAction = true,
  onSetup,
  evidenceDetails,
  rollup,
  overallHealthScore = null,
  categoryHealthScore = null,
  linkedRhythmCount = 0,
  scoringEvidence,
  scoringExplanation
}: FitnessScoreSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const infoButtonRef = useRef<HTMLButtonElement>(null);
  const defaultRollup = createHealthFitnessRollup('foundations', category.toLowerCase());
  const activeRollup = rollup ?? {
    ...defaultRollup,
    groups: defaultRollup.groups.map(group => group.id === 'foundations'
      ? {
          ...group,
          items: group.items.map(item => item.id === category.toLowerCase()
            ? {
                ...item,
                details: [
                  scoreExplanations[category].consistency,
                  scoreExplanations[category].onTrack
                ]
              }
            : item)
        }
      : group)
  };
  const defaultContribution = {
      heading: `How this ${category} Foundation contributes`,
      highlightedGroup: 'foundations',
      highlightedItemId: `health-${category.toLowerCase()}`,
      scoringInfo: {
        groupId: 'foundations',
        triggerLabel: `About ${category} scoring`,
        title: `${category} scoring`,
        paragraphs: [
          scoreExplanations[category].consistency,
          scoreExplanations[category].onTrack
        ]
      },
      overallScore: overallHealthScore,
      categories: [{
        id: 'health-fitness',
        label: 'Health & Fitness',
        score: categoryHealthScore,
        categoryIconId: 'health'
      }],
      foundations: [{
        id: `health-${category.toLowerCase()}`,
        label: category,
        score: health,
        categoryLabel: 'Health & Fitness',
        foundationIconId: `health-${category.toLowerCase()}`
      }],
      bottomGroupLabel: category === 'Cardio' ? 'Run logs' : 'Linked Rhythms',
      bottomItem: {
        id: category === 'Cardio' ? 'run-logs' : 'linked-rhythms',
        label: category === 'Cardio'
          ? 'Run logs'
          : linkedRhythmCount > 0 ? 'Linked Rhythms' : 'No linked Rhythms',
        score: null,
        showScore: false
      },
      identity: {
        name: category,
        secondary: 'Health & Fitness',
        icon: { kind: 'foundation', id: `health-${category.toLowerCase()}` }
      }
    } satisfies NonNullable<HealthRollupConfig['healthContribution']>;
  const currentContribution = activeRollup.healthContribution ?? defaultContribution;
  const contributionRollup: HealthRollupConfig = {
    ...activeRollup,
    healthContribution: {
      ...currentContribution,
      scoringInfo: {
        ...(currentContribution.scoringInfo ?? {
          groupId: 'foundations',
          triggerLabel: `About ${category} scoring`,
          title: `${category} scoring`,
          paragraphs: []
        }),
        paragraphs: [
          ...(summaryExplanation ? [summaryExplanation] : []),
          ...(currentContribution.scoringInfo?.paragraphs ?? [])
        ]
      }
    }
  };
  const infoButton = (
    <HealthScoreInfoButton
      ref={infoButtonRef}
      label={`Show ${category} Health scoring details`}
      expanded={expanded}
      controls={detailsId}
      onClick={() => setExpanded(value => !value)}
    />
  );
  const message = setupRequired
    ? 'Set up tracking to see your scores.'
    : statusMessage;

  return (
    <section className={`fitness-score-summary ${className}`.trim()} aria-label={`${category} scores`}>
      <HealthScoreBreakdown
        title={healthTitle}
        score={health}
        size="card"
        healthLabel={`${category} Health`}
        ariaLabel={`${category} Health scores`}
        consistency={{ score: consistency }}
        onTrack={{ score: onTrack }}
        consistencyCaption={consistencyCaption}
        onTrackCaption={onTrackCaption}
        headingAction={infoButton}
        showMeasures
      />
      {message && (
        <div className="fitness-score-summary__status" role="status">
          <p>{message}</p>
          {setupRequired && onSetup && showSetupAction && (
            <button type="button" className="btn mini ghost" onClick={onSetup}>
              {category === 'Strength' ? 'Strength settings' : 'Set up tracking'}
            </button>
          )}
        </div>
      )}
      {expanded && (
        <HealthScoreDetailsDialog
          title={`${category} Health details`}
          phoneFullScreen={false}
          onClose={() => {
            setExpanded(false);
            requestAnimationFrame(() => infoButtonRef.current?.focus());
          }}
        >
          <div id={detailsId} className="fitness-score-summary__details" role="region"
            aria-label={`${category} Health scoring details`}>
            <HealthScoreDetailsContent
              title={healthTitle}
              ariaLabel={`${category} Health scoring details`}
              score={health}
              healthLabel={`${category} Health`}
              consistency={{ score: consistency }}
              onTrack={{ score: onTrack }}
              consistencyCaption={consistencyCaption}
              onTrackCaption={onTrackCaption}
              consistencyDescription={scoreExplanations[category].consistency}
              onTrackDescription={scoreExplanations[category].onTrack}
              rollup={contributionRollup}
              scoringDisclosureTitle={`How this ${category} Foundation was scored`}
              {...(scoringEvidence ? { scoringEvidence } : {})}
              initialContributionExpanded={false}
              scoringExplanation={(
                <>
                  {summaryExplanation && <p>{summaryExplanation}</p>}
                  {category === 'Strength' && <p>Rest readiness is shown separately.</p>}
                  {scoringExplanation}
                  {evidenceDetails && (
                    <div className="fitness-score-summary__evidence">
                      {evidenceDetails}
                    </div>
                  )}
                </>
              )}
            />
          </div>
        </HealthScoreDetailsDialog>
      )}
    </section>
  );
}
