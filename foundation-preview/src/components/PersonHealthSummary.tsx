import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { HealthMeasureAggregate } from '../domain/health-scoring.ts';
import type { PersonPreview } from '../domain/preview-data.ts';
import type { HealthRollupConfig } from './HealthRollupDiagram.tsx';
import type { HealthAggregateEvidence } from './HealthScoringDetailsCard.tsx';
import { formatScore } from '../domain/score-display.ts';
import { scoreTone } from '../domain/score-tone.ts';
import { CategoryHealthBadge } from './Cards.tsx';
import { HealthScoreBreakdown } from './HealthScoreBreakdown.tsx';
import { HealthScoreDetailsContent } from './HealthScoreDetailsContent.tsx';
import { HealthInfoIdentityCard } from './HealthInfoIdentityCard.tsx';
import { HealthScoringDetailsCard } from './HealthScoringDetailsCard.tsx';
import { HealthScoreSummary } from './HealthScoreSummary.tsx';
import { HealthScoreDetailsDialog, useHealthDetailsNestedDialog } from './HealthScoreDetailsDialog.tsx';

export type PersonHealthComponentScore = {
  id?: 'rhythms' | 'connections' | 'prayer';
  label: string;
  score: number | null;
  unavailableReason?: string;
};

type PersonHealthSummaryProps = {
  title: string;
  health: HealthMeasureAggregate;
  itemTerm: string;
  totalCount: number;
  eligibleCount: number;
  excludedCount?: number;
  unresolvedCount?: number;
  archivedCount?: number;
  unscoredCount?: number;
  coverageLabel?: string;
  emptyMessage?: string;
  showMeasures?: boolean;
  showMeasureCaptions?: boolean;
  showHealthMeter?: boolean;
  summaryContent?: ReactNode;
  detailsContent?: ReactNode;
  detailsDialogTitle?: string;
  detailsLabel?: string;
  headerStyle?: 'summary' | 'category';
  ariaLabel?: string;
  summaryDisclosureLabel?: string;
  infoLabel?: string;
  scoreLabel?: string;
  progressLabel?: string;
};

export function PersonHealthSummary({
  title,
  health,
  itemTerm,
  totalCount,
  eligibleCount,
  excludedCount = 0,
  unresolvedCount = 0,
  archivedCount = 0,
  unscoredCount = 0,
  coverageLabel,
  emptyMessage,
  showMeasures = true,
  showMeasureCaptions = false,
  showHealthMeter = false,
  summaryContent,
  detailsContent,
  detailsDialogTitle,
  detailsLabel,
  headerStyle = 'summary',
  ariaLabel,
  summaryDisclosureLabel,
  infoLabel,
  scoreLabel,
  progressLabel
}: PersonHealthSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const [componentScoresExpanded, setComponentScoresExpanded] = useState(false);
  const coverage = coverageLabel ?? (totalCount === 0
    ? emptyMessage ?? `No ${itemTerm} yet.`
    : `${eligibleCount} of ${totalCount} ${itemTerm}${totalCount === 1 ? '' : 's'} scored.`);
  const pluralTerm = `${itemTerm}${itemTerm.endsWith('s') ? '' : 's'}`;
  const countText = (count: number) => `${count} ${itemTerm}${count === 1 ? '' : 's'}`;

  return (
    <HealthScoreSummary
      className="person-component-health-summary"
      ariaLabel={ariaLabel ?? `${title} summary`}
      title={title}
      score={health.health}
      consistency={health.consistency}
      onTrack={health.onTrack}
      coverage={coverage}
      expanded={expanded}
      onExpandedChange={setExpanded}
      {...(headerStyle === 'category' && summaryContent !== undefined
        ? {
            summaryDisclosure: {
              label: summaryDisclosureLabel ?? `${title} component scores`,
              expanded: componentScoresExpanded,
              onExpandedChange: setComponentScoresExpanded
            }
          }
        : {})}
      showMeasures={showMeasures}
      showMeasureCaptions={showMeasureCaptions}
      showHealthMeter={showHealthMeter}
      headerStyle={headerStyle}
      summaryContent={summaryContent}
      {...(detailsContent === undefined ? {} : { detailsContent })}
      {...(detailsDialogTitle === undefined ? {} : { detailsDialogTitle })}
      {...(detailsLabel === undefined ? {} : { detailsLabel })}
      {...(infoLabel === undefined ? {} : { infoLabel })}
      {...(scoreLabel === undefined ? {} : { scoreLabel })}
      {...(progressLabel === undefined ? {} : { progressLabel })}
      consistencyDescription={`The average Consistency score of eligible ${pluralTerm}.`}
      onTrackDescription={`The average On Track score of eligible ${pluralTerm}.`}
    >
      <p className="category-health-summary__explanation">
        Each scored {itemTerm} counts equally.
      </p>
      <p className="category-health-summary__explanation">
        Only {pluralTerm} with both measures scored count; missing and unscored values are excluded, not treated as zero.
      </p>
      {excludedCount > 0 && (
        <p className="category-health-summary__explanation">
          {countText(excludedCount)} {excludedCount === 1 ? 'is' : 'are'} excluded for missing measures.
        </p>
      )}
      {unresolvedCount > 0 && (
        <p className="category-health-summary__explanation">
          {countText(unresolvedCount)} have unresolved scores.
        </p>
      )}
      {unscoredCount > 0 && (
        <p className="category-health-summary__explanation">
          {countText(unscoredCount)} do not have scored measures yet.
        </p>
      )}
      {archivedCount > 0 && (
        <p className="category-health-summary__explanation">
          {countText(archivedCount)} {archivedCount === 1 ? 'is' : 'are'} archived and excluded.
        </p>
      )}
    </HealthScoreSummary>
  );
}

export function PersonHealthComponentScores({
  values,
  areaDetails
}: {
  values: readonly PersonHealthComponentScore[];
  areaDetails?: Partial<Readonly<Record<'rhythms' | 'connections' | 'prayer', {
    title: string;
    content: ReactNode;
  }>>>;
}) {
  const [dialogArea, setDialogArea] = useState<PersonHealthComponentScore['id'] | null>(null);
  const scoreButtonRefs = useRef<Partial<Record<NonNullable<PersonHealthComponentScore['id']>, HTMLButtonElement | null>>>({});
  const setParentDialogInert = useHealthDetailsNestedDialog();
  const detailsId = useId();
  const dialogAreaDetails = dialogArea ? areaDetails?.[dialogArea] : undefined;

  return (
    <>
      <div
        className="person-health-component-scores-container"
        data-count={values.length}
      >
        <div
          className="person-health-component-scores"
          role="group"
          aria-label="Health by area"
          data-count={values.length}
        >
          {values.map(({ id, label, score, unavailableReason }) => {
            const value = score !== null && Number.isFinite(score) ? score : null;
            const available = value !== null;
            const showReason = id !== undefined && areaDetails?.[id] !== undefined;
            const reasonId = id && unavailableReason
              ? `${detailsId}-unavailable-${id}`
              : undefined;
            const content = (
              <>
                <CategoryHealthBadge
                  score={value}
                  appearance="rounded"
                  className="person-health-component-score__badge"
                />
                <span className="person-health-component-score__label">
                  {label}
                </span>
                {reasonId && (
                  <span
                    id={reasonId}
                    className={`person-health-component-score__reason${showReason ? '' : ' visually-hidden'}`}
                  >
                    {unavailableReason}
                  </span>
                )}
              </>
            );
            if (id && areaDetails) {
              const selectableArea = id;
              const expanded = dialogArea === selectableArea;
              return (
                <button
                  type="button"
                  ref={element => { scoreButtonRefs.current[selectableArea] = element; }}
                  className={`person-health-component-score ${scoreTone(value)}`}
                  aria-label={`${label} Health ${value === null ? 'unavailable' : formatScore(value)}`}
                  {...(reasonId ? { 'aria-describedby': reasonId } : {})}
                  aria-expanded={expanded}
                  aria-haspopup="dialog"
                  key={id}
                  onClick={() => {
                    setDialogArea(selectableArea);
                    setParentDialogInert(true);
                  }}
                >
                  {content}
                  <span className="visually-hidden">
                    {expanded ? 'Health details open' : 'Health details closed'}
                  </span>
                </button>
              );
            }
            return (
              <div
                className={`person-health-component-score ${scoreTone(value)}`}
                role={available ? 'meter' : 'img'}
                aria-label={available ? `${label} Health score` : `${label} Health score: unavailable`}
                {...(reasonId ? { 'aria-describedby': reasonId } : {})}
                aria-valuemin={available ? 0 : undefined}
                aria-valuemax={available ? 100 : undefined}
                aria-valuenow={value ?? undefined}
                aria-valuetext={value === null ? undefined : `${formatScore(value)} out of 100`}
                key={label}
              >
                {content}
              </div>
            );
          })}
        </div>
      </div>
      {dialogAreaDetails && dialogArea && (
        <HealthScoreDetailsDialog
          title={dialogAreaDetails.title}
          onClose={() => {
            setDialogArea(null);
            setParentDialogInert(false);
            requestAnimationFrame(() => scoreButtonRefs.current[dialogArea]?.focus({ preventScroll: true }));
          }}
        >
          <div
            id={`${detailsId}-${dialogArea}`}
            className="category-health-summary__details"
            role="region"
            aria-label={dialogAreaDetails.title}
          >
            {dialogAreaDetails.content}
          </div>
        </HealthScoreDetailsDialog>
      )}
    </>
  );
}

export type PersonOverallHealthArea = {
  id: 'rhythms' | 'connections' | 'prayer';
  label: string;
  score: number | null;
  unavailableReason?: string;
};

export function PersonOverallHealthDetails({
  person,
  overallScore,
  areas,
  areaDetails
}: {
  person: PersonPreview;
  overallScore: number | null;
  areas: readonly PersonOverallHealthArea[];
  areaDetails: Partial<Readonly<Record<PersonOverallHealthArea['id'], {
    title: string;
    content: ReactNode;
  }>>>;
}) {
  const eligibleAreas = areas.filter(area => area.score !== null && Number.isFinite(area.score));
  const noScoresAvailable = eligibleAreas.length === 0;

  return (
    <div className="health-score-details-content person-overall-health-details">
      <HealthInfoIdentityCard
        identity={{ name: person.displayName, icon: { kind: 'person' }, person }}
      />
      <section className="health-info-summary-card" aria-label="Overall Health summary">
        <HealthScoreBreakdown
          title="Overall Health"
          score={overallScore}
          healthLabel="Overall Health"
          ariaLabel="Overall Health score summary"
          consistency={{ score: null, state: 'unavailable' }}
          onTrack={{ score: null, state: 'unavailable' }}
          showMeasures={false}
        >
          <PersonHealthComponentScores values={areas} areaDetails={areaDetails} />
        </HealthScoreBreakdown>
      </section>
      <HealthScoringDetailsCard
        title="How Overall Health was scored"
        healthScore={overallScore}
        consistencyScore={null}
        onTrackScore={null}
        formulaContent={(
          <section className="person-overall-health-formula" aria-label="Area Health scores">
            <ul>
              {areas.map(area => (
                <li key={area.id}>
                  <span>{area.label}</span>
                  <strong>{formatScore(area.score)}</strong>
                </li>
              ))}
            </ul>
            <p className="rhythm-health-scoring-card__formula rhythm-health-scoring-card__formula--total person-overall-health-formula__result">
              <span>Overall Health</span>
              <strong>{formatScore(overallScore)}</strong>
            </p>
            {noScoresAvailable && (
              <p className="health-aggregate-evidence__empty">No scores available yet.</p>
            )}
            <p className="person-overall-health-formula__note">
              Available areas count equally.
            </p>
          </section>
        )}
      />
    </div>
  );
}

export function PersonHealthAreaDetails({
  person,
  areaLabel,
  health,
  supportsMeasures,
  rollup,
  evidence,
  unavailableExplanation,
  scoringExplanation,
  unavailableInputs
}: {
  person: PersonPreview;
  areaLabel: 'Rhythm' | 'Connection' | 'Prayer';
  health: HealthMeasureAggregate;
  supportsMeasures: boolean;
  rollup: HealthRollupConfig;
  evidence?: HealthAggregateEvidence;
  unavailableExplanation?: string;
  scoringExplanation?: string;
  unavailableInputs?: ReactNode;
}) {
  const title = `${areaLabel} Health`;
  const measure = (score: number | null) => ({
    score,
    state: score === null || !supportsMeasures ? 'unavailable' as const : 'scored' as const
  });

  return (
    <HealthScoreDetailsContent
      title={title}
      summaryTitle={title}
      ariaLabel={`${person.displayName}’s ${title} details`}
      score={health.health}
      healthLabel={title}
      consistency={measure(health.consistency)}
      onTrack={measure(health.onTrack)}
      healthIdentity={{
        name: person.displayName,
        secondary: title,
        icon: { kind: 'person' },
        person
      }}
      showMeasures={supportsMeasures}
      showScoreNote={false}
      scoringCard={(
        <HealthScoringDetailsCard
          title={`How ${title} was scored`}
          healthScore={health.health}
          consistencyScore={supportsMeasures ? health.consistency : null}
          onTrackScore={supportsMeasures ? health.onTrack : null}
          {...(evidence ? { evidence } : {})}
          {...(supportsMeasures ? {} : {
            formulaContent: (
              <section className="health-aggregate-evidence">
                <p className="health-aggregate-evidence__empty">
                  {health.health === null
                    ? unavailableExplanation ?? `${title} scoring is unavailable in this preview.`
                    : scoringExplanation ?? `${title} uses its available score only.`}
                </p>
                {unavailableInputs}
              </section>
            )
          })}
        />
      )}
      rollup={rollup}
      initialContributionExpanded={false}
    />
  );
}
