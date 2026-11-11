import { useState } from 'react';
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
import { HealthInfoWhatCounts } from './HealthInfoWhatCounts.tsx';

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
      size="card"
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
          {countText(unscoredCount)} {unscoredCount === 1 ? 'does' : 'do'} not have scored measures yet.
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
  onSelectArea
}: {
  values: readonly PersonHealthComponentScore[];
  expandedArea?: 'rhythms' | 'connections' | 'prayer' | null;
  controlIds?: Readonly<Record<'rhythms' | 'connections' | 'prayer', string>>;
  onSelectArea?: (area: 'rhythms' | 'connections' | 'prayer') => void;
}) {
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
        if (id && onSelectArea && controlIds) {
          return (
            <button
              type="button"
              className={`person-health-component-score ${scoreTone(value)}`}
              aria-label={`${label} Health ${value === null ? 'unavailable' : formatScore(value)}`}
              aria-controls={controlIds[id]}
              aria-expanded={expandedArea === id}
              key={id}
              onClick={() => onSelectArea(id)}
            >
              {content}
              <span className="visually-hidden">
                {expandedArea === id ? 'Health card open' : 'Health card closed'}
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
              aria-valuenow={value === null ? undefined : Math.round(value)}
              aria-valuetext={value === null ? undefined : `${formatScore(value)} out of 100`}
            >
              {content}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export type PersonOverallHealthArea = {
  id: 'rhythms' | 'connections' | 'prayer';
  label: string;
  score: number | null;
};

export function formatPersonOverallHealthFormula(
  areas: readonly PersonOverallHealthArea[],
  overallScore: number | null
): string | null {
  const eligible = areas.filter(area => area.score !== null && Number.isFinite(area.score));
  if (eligible.length === 0 || overallScore === null || !Number.isFinite(overallScore)) return null;

  if (eligible.length === 1) {
    const area = eligible[0]!;
    const approximate = area.score !== Math.round(area.score!) || overallScore !== Math.round(overallScore);
    return `${area.label} ${formatFormulaScore(area.score!)} ${approximate ? '≈' : '→'} Overall ${formatFormulaScore(overallScore)}`;
  }

  const displayedScores = eligible.map(area => formatFormulaScore(area.score!));
  const displayedMean = displayedScores.reduce((total, score) => total + Number(score), 0)
    / displayedScores.length;
  const displayedOverall = Number(formatFormulaScore(overallScore));
  const approximate = eligible.some(area => area.score !== Math.round(area.score!))
    || overallScore !== Math.round(overallScore)
    || Math.abs(displayedMean - displayedOverall) >= 1e-10;
  return `(${displayedScores.join(' + ')}) ÷ ${displayedScores.length} ${approximate ? '≈' : '='} ${formatFormulaScore(overallScore)}`;
}

function formatFormulaScore(score: number): string {
  return String(Math.round(score));
}

export function PersonOverallHealthDetails({
  person,
  overallScore,
  health,
  areas,
  rollup
}: {
  person: PersonPreview;
  overallScore: number | null;
  health: HealthMeasureAggregate;
  areas: readonly PersonOverallHealthArea[];
  rollup: HealthRollupConfig;
}) {
  const formula = formatPersonOverallHealthFormula(areas, overallScore);
  const eligibleAreas = areas.filter(area => area.score !== null && Number.isFinite(area.score));

  return (
    <div className="health-score-details-content person-overall-health-details">
      <HealthInfoIdentityCard
        identity={{ name: person.displayName, icon: { kind: 'person' }, person }}
      />
      <section className="health-info-summary-card" aria-label="Overall Health summary">
        <HealthScoreBreakdown
          title="Overall Health"
          score={overallScore}
          size="detail"
          healthLabel="Overall Health"
          ariaLabel="Overall Health score summary"
          consistency={{ score: health.consistency, state: health.consistency === null ? 'unavailable' : 'scored' }}
          onTrack={{ score: health.onTrack, state: health.onTrack === null ? 'unavailable' : 'scored' }}
          consistencyCaption="Follow-through over time"
          onTrackCaption="How caught up you are"
          showMeasures
          showMeasureCaptions
        >
          <PersonHealthComponentScores values={areas} />
        </HealthScoreBreakdown>
      </section>
      <HealthScoringDetailsCard
        title="How Overall Health was scored"
        healthScore={overallScore}
        consistencyScore={null}
        onTrackScore={null}
        formulaContent={(
          <section className="person-overall-health-formula" aria-label="Eligible area scores and formula">
          <h4>Eligible area scores</h4>
          {eligibleAreas.length > 0 ? (
              <>
                <ul>
                  {eligibleAreas.map(area => (
                    <li key={area.id}>
                      <span>{area.label}</span>
                      <strong>{formatFormulaScore(area.score!)}</strong>
                    </li>
                  ))}
                </ul>
                <p className="rhythm-health-scoring-card__formula rhythm-health-scoring-card__formula--total">
                  {formula}
                </p>
              </>
            ) : (
              <p className="health-aggregate-evidence__empty">No areas have scored data yet.</p>
            )}
            <p className="person-overall-health-formula__note">
              Available areas count equally. Unavailable areas are left out.
            </p>
            <p className="person-overall-health-formula__note">
              {eligibleAreas.length} of {areas.length} components scored; {areas.length - eligibleAreas.length} excluded or unscored.
            </p>
          </section>
        )}
      />
      <section className="health-info-contribution-card" aria-label="Overall Health contribution">
        <HealthInfoWhatCounts config={rollup} initialContributionExpanded={false} />
      </section>
      <footer className="health-score-details-content__score-note">
        <p>— unavailable · 0 is a valid score</p>
      </footer>
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
  unavailableInputs,
  scoringExplanation
}: {
  person: PersonPreview;
  areaLabel: 'Rhythms' | 'Connections' | 'Prayer';
  health: HealthMeasureAggregate;
  supportsMeasures: boolean;
  rollup: HealthRollupConfig;
  evidence?: HealthAggregateEvidence;
  unavailableExplanation?: string;
  unavailableInputs?: ReactNode;
  scoringExplanation?: ReactNode;
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
        icon: areaLabel === 'Rhythms'
          ? { kind: 'rhythm' }
          : areaLabel === 'Connections'
            ? { kind: 'connection' }
            : { kind: 'prayer' }
      }}
      showMeasures
      showScoreNote
      scoringCard={(
        <HealthScoringDetailsCard
          title={`How ${title} was scored`}
          healthScore={health.health}
          consistencyScore={supportsMeasures ? health.consistency : null}
          onTrackScore={supportsMeasures ? health.onTrack : null}
          maxFractionDigits={0}
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
        >
          {scoringExplanation}
        </HealthScoringDetailsCard>
      )}
      rollup={rollup}
      initialContributionExpanded={false}
    />
  );
}
