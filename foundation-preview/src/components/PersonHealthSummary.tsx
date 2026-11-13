import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { HealthMeasureAggregate } from '../domain/health-scoring.ts';
import type { PersonPreview } from '../domain/preview-data.ts';
import type { HealthRollupConfig } from './HealthRollupDiagram.tsx';
import type { HealthAggregateEvidence } from './HealthScoringDetailsCard.tsx';
import { formatScore } from '../domain/score-display.ts';
import { scoreTone } from '../domain/score-tone.ts';
import { CategoryHealthBadge } from './Cards.tsx';
import { HealthScoreBreakdown, HealthScoreInfoButton, HealthScoreMeasures } from './HealthScoreBreakdown.tsx';
import type { HealthScoreMetric } from './HealthScoreBreakdown.tsx';
import { HealthScoreDetailsContent } from './HealthScoreDetailsContent.tsx';
import { HealthInfoIdentityCard } from './HealthInfoIdentityCard.tsx';
import { HealthScoringDetailsCard } from './HealthScoringDetailsCard.tsx';
import { HealthScoreSummary } from './HealthScoreSummary.tsx';
import { HealthScoreDetailsDialog, useHealthDetailsNestedDialog } from './HealthScoreDetailsDialog.tsx';

export type PersonHealthComponentScore = {
  id?: 'rhythms' | 'connections' | 'prayer';
  label: string;
  score: number | null;
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
  headerStyle = 'summary'
}: PersonHealthSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const coverage = coverageLabel ?? (totalCount === 0
    ? emptyMessage ?? `No ${itemTerm} yet.`
    : `${eligibleCount} of ${totalCount} ${itemTerm}${totalCount === 1 ? '' : 's'} scored.`);
  const pluralTerm = `${itemTerm}${itemTerm.endsWith('s') ? '' : 's'}`;
  const countText = (count: number) => `${count} ${itemTerm}${count === 1 ? '' : 's'}`;

  return (
    <HealthScoreSummary
      className="person-component-health-summary"
      ariaLabel={`${title} summary`}
      title={title}
      score={health.health}
      consistency={health.consistency}
      onTrack={health.onTrack}
      coverage={coverage}
      consistencyDetailCaption="Follow-through over time"
      onTrackDetailCaption="How caught up you are"
      expanded={expanded}
      onExpandedChange={setExpanded}
      showMeasures={showMeasures}
      showMeasureCaptions={showMeasureCaptions}
      showHealthMeter={showHealthMeter}
      headerStyle={headerStyle}
      summaryContent={summaryContent}
      {...(detailsContent === undefined ? {} : { detailsContent })}
      {...(detailsDialogTitle === undefined ? {} : { detailsDialogTitle })}
      {...(detailsLabel === undefined ? {} : { detailsLabel })}
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
  expandedArea,
  controlIds,
  onSelectArea,
  expandedContent,
  areaDetails
}: {
  values: readonly PersonHealthComponentScore[];
  expandedArea?: 'rhythms' | 'connections' | 'prayer' | null;
  controlIds?: Readonly<Record<'rhythms' | 'connections' | 'prayer', string>>;
  onSelectArea?: (area: 'rhythms' | 'connections' | 'prayer') => void;
  expandedContent?: Readonly<Record<'rhythms' | 'connections' | 'prayer', ReactNode>>;
  areaDetails?: Readonly<Record<'rhythms' | 'connections' | 'prayer', {
    title: string;
    content: ReactNode;
  }>>;
}) {
  const [dialogArea, setDialogArea] = useState<PersonHealthComponentScore['id'] | null>(null);
  const scoreButtonRefs = useRef<Partial<Record<NonNullable<PersonHealthComponentScore['id']>, HTMLButtonElement | null>>>({});
  const setParentDialogInert = useHealthDetailsNestedDialog();
  const detailsId = useId();
  const dialogAreaDetails = dialogArea ? areaDetails?.[dialogArea] : undefined;

  return (
    <div className="person-health-component-scores" role="group" aria-label="Health by area">
      {values.map(({ id, label, score }) => {
        const value = score !== null && Number.isFinite(score) ? score : null;
        const available = value !== null;
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
          </>
        );
        if (id && (onSelectArea || areaDetails)) {
          const selectableArea = id;
          const expanded = onSelectArea
            ? expandedArea === selectableArea
            : dialogArea === selectableArea;
          const controlledRegion = onSelectArea
            ? controlIds?.[selectableArea]
            : expanded ? `${detailsId}-${selectableArea}` : undefined;
          return (
            <button
              type="button"
              ref={element => { scoreButtonRefs.current[selectableArea] = element; }}
              className={`person-health-component-score ${scoreTone(value)}`}
              aria-label={`${label} Health ${value === null ? 'unavailable' : formatScore(value)}`}
              {...(controlledRegion ? { 'aria-controls': controlledRegion } : {})}
              aria-expanded={expanded}
              {...(!onSelectArea && areaDetails ? { 'aria-haspopup': 'dialog' as const } : {})}
              key={id}
              onClick={() => {
                if (onSelectArea) {
                  onSelectArea(selectableArea);
                } else if (areaDetails?.[selectableArea]) {
                  setDialogArea(selectableArea);
                  setParentDialogInert(true);
                }
              }}
            >
              {content}
              <span className="visually-hidden">
                {expanded
                  ? areaDetails && !onSelectArea ? 'Health details open' : 'Health measures expanded'
                  : areaDetails && !onSelectArea ? 'Health details closed' : 'Health measures collapsed'}
              </span>
            </button>
          );
        }
        return (
          <div className={`person-health-component-score ${scoreTone(value)}`} key={label}>
            <span
              role={available ? 'meter' : 'img'}
              aria-label={available ? `${label} Health score` : `${label} Health score: unavailable`}
              aria-valuemin={available ? 0 : undefined}
              aria-valuemax={available ? 100 : undefined}
              aria-valuenow={value ?? undefined}
              aria-valuetext={value === null ? undefined : `${formatScore(value)} out of 100`}
            >
              {content}
            </span>
          </div>
        );
      })}
      {onSelectArea && controlIds && expandedContent && values.map(({ id }) => {
        if (!id) return null;
        return (
          <div
            key={`${id}-measures`}
            id={controlIds[id]}
            className="person-health-component-scores__expanded"
            role="region"
            hidden={expandedArea !== id}
          >
            {expandedArea === id ? expandedContent[id] : null}
          </div>
        );
      })}
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
    </div>
  );
}

export function PersonHealthAreaMeasures({
  label,
  detailsLabel = label,
  consistency,
  onTrack,
  detailsDialogTitle,
  detailsContent
}: {
  label: string;
  detailsLabel?: string;
  consistency: HealthScoreMetric;
  onTrack: HealthScoreMetric;
  detailsDialogTitle: string;
  detailsContent: ReactNode;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const infoButtonRef = useRef<HTMLButtonElement>(null);
  const setParentDialogInert = useHealthDetailsNestedDialog();
  const titleId = useId();
  const detailsId = useId();

  return (
    <section className="person-health-area-measures" aria-labelledby={titleId}>
      <header className="person-health-area-measures__header">
        <h4 id={titleId}>{label}</h4>
        <HealthScoreInfoButton
          ref={infoButtonRef}
          label={`Show ${detailsLabel} Health details`}
          expanded={detailsOpen}
          controls={detailsId}
          onClick={() => {
            setDetailsOpen(true);
            setParentDialogInert(true);
          }}
        />
      </header>
      <HealthScoreMeasures
        healthScore={null}
        consistency={consistency}
        onTrack={onTrack}
        consistencyCaption="Follow-through over time"
        onTrackCaption="How caught up you are"
        showHealthMeter={false}
        showCaptions
      />
      {detailsOpen && (
        <HealthScoreDetailsDialog
          title={detailsDialogTitle}
          onClose={() => {
            setDetailsOpen(false);
            setParentDialogInert(false);
            requestAnimationFrame(() => infoButtonRef.current?.focus({ preventScroll: true }));
          }}
        >
          <div id={detailsId} className="category-health-summary__details" role="region" aria-label={detailsDialogTitle}>
            {detailsContent}
          </div>
        </HealthScoreDetailsDialog>
      )}
    </section>
  );
}

export type PersonOverallHealthArea = {
  id: 'rhythms' | 'connections' | 'prayer';
  label: string;
  score: number | null;
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
  areaDetails: Readonly<Record<PersonOverallHealthArea['id'], {
    title: string;
    content: ReactNode;
  }>>;
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
          consistencyCaption="Follow-through over time"
          onTrackCaption="How caught up you are"
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
  unavailableInputs
}: {
  person: PersonPreview;
  areaLabel: 'Rhythm' | 'Connection' | 'Prayer';
  health: HealthMeasureAggregate;
  supportsMeasures: boolean;
  rollup: HealthRollupConfig;
  evidence?: HealthAggregateEvidence;
  unavailableExplanation?: string;
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
      consistencyCaption="Follow-through over time"
      onTrackCaption="How caught up you are"
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
                  {unavailableExplanation ?? `${title} scoring is unavailable in this preview.`}
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
