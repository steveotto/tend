import type {
  FoundationCapabilities,
  FoundationLifecycle
} from '../../../src/domain/capabilities.ts';
import { useRef } from 'react';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import {
  formatMoney,
  goalTimeline,
  latestCheckIn,
  remainingAmount,
  type GoalCheckIn,
  type MoneyGoal
} from '../domain/money-goals.ts';
import {
  foundationTerminologyForCategory,
  rhythmLastTendedLabel,
  type FoundationPreview,
  type PersonId,
  type PersonPreview,
  type RhythmPreview
} from '../domain/preview-data.ts';
import { localDateInTimeZone } from '../domain/rhythm-occurrences.ts';
import { PersonBadgeList } from './PersonBadge.tsx';
import { RhythmArchivedBadge } from './RhythmArchivedBadge.tsx';
import { RhythmPersonalBadge } from './RhythmPersonalBadge.tsx';
import { RhythmMetadata } from './RhythmMetadata.tsx';
import { RhythmCompletionActions } from './RhythmCompletionActions.tsx';
import { TimelineChart } from './TimelineChart.tsx';
import { scoreTone } from '../domain/score-tone.ts';

type FoundationCardProps = {
  foundation: FoundationPreview;
  variant?: 'catalogue' | 'compact';
  icon?: ReactNode;
  lifecycle?: FoundationLifecycle;
  onComplete?: () => void;
  onReopen?: () => void;
  onSelect?: (event: MouseEvent<HTMLButtonElement>) => void;
  headingId?: string;
  selectButtonId?: string;
  score?: number | null;
  scoreLabel?: string;
  scoreEvidence?: string;
  illustrativeScore?: number | null;
  rhythmCoverage?: { scored: number; total: number };
  reserveDescriptionSpace?: boolean;
  children?: ReactNode;
};

function CompactCardBody({
  title,
  description,
  icon,
  headingId,
  interactive,
  reserveDescriptionSpace,
  children
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  headingId?: string;
  interactive: boolean;
  reserveDescriptionSpace: boolean;
  children?: ReactNode;
}) {
  return (
    <>
      {icon && <span className="foundation-card__icon" aria-hidden="true">{icon}</span>}
      <span className="foundation-card__content">
        {interactive
          ? <span className="foundation-card__title" id={headingId} role="heading" aria-level={3}>{title}</span>
          : <h3 className="foundation-card__title" id={headingId} tabIndex={-1}>{title}</h3>}
        <span className={`foundation-card__description${interactive || reserveDescriptionSpace
          ? ' foundation-card__description--reserved'
          : ''}`}>
          {description}
        </span>
        {children}
      </span>
    </>
  );
}

export function DetailNavigationCard({
  title,
  description,
  icon,
  onSelect
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      className="foundation-card foundation-card--compact foundation-card--interactive"
      type="button"
      aria-label={`${title}: ${description}`}
      onClick={onSelect}
    >
      <CompactCardBody
        title={title}
        description={description}
        icon={icon}
        interactive
        reserveDescriptionSpace
      />
      <span className="foundation-card__chevron" aria-hidden="true">›</span>
    </button>
  );
}

export function FoundationCard({
  foundation,
  variant = 'catalogue',
  icon,
  lifecycle = foundation.lifecycle,
  onComplete,
  onReopen,
  onSelect,
  headingId,
  selectButtonId,
  score,
  scoreLabel,
  scoreEvidence,
  illustrativeScore,
  rhythmCoverage,
  reserveDescriptionSpace = false,
  children
}: FoundationCardProps) {
  const completable = foundation.capabilities.completion !== 'ongoing';
  const isCompleted = lifecycle === 'completed';
  const resolvedHeadingId = headingId ?? `foundation-${foundation.id}`;
  const foundationTerm = foundationTerminologyForCategory(foundation.categoryId);
  const displayScore = score === undefined ? illustrativeScore : score;
  const displayScoreLabel = scoreLabel ?? `${foundation.name} illustrative score`;
  const coverageText = scoreEvidence ?? (rhythmCoverage
    ? rhythmCoverage.total === 0
      ? 'No linked sample Rhythms'
      : `${rhythmCoverage.scored} of ${rhythmCoverage.total} linked Rhythms have sample values`
    : undefined);

  if (variant === 'compact') {
    const content = (
      <>
        <CompactCardBody
          title={foundation.name}
          description={foundation.description}
          icon={icon}
          {...(onSelect
            ? headingId ? { headingId } : {}
            : { headingId: resolvedHeadingId })}
          interactive={Boolean(onSelect)}
          reserveDescriptionSpace={reserveDescriptionSpace}
        >
          {displayScore !== undefined && (
            <>
              {coverageText && <span className="foundation-card__coverage">{coverageText}</span>}
              <FoundationProgress
                label={displayScoreLabel}
                score={displayScore}
                decorative={Boolean(onSelect)}
              />
            </>
          )}
        </CompactCardBody>
        <span className={`foundation-card__score ${scoreTone(displayScore ?? null)}`} aria-hidden="true">
          {displayScore === null || displayScore === undefined ? '—' : Math.round(displayScore)}
        </span>
        {onSelect && <span className="foundation-card__chevron" aria-hidden="true">›</span>}
        {children}
      </>
    );

    if (onSelect) {
      const scoreName = displayScore === undefined || displayScore === null
        ? `${scoreLabel ?? 'score'} unavailable`
        : scoreLabel
          ? `${scoreLabel} ${Math.round(displayScore)} out of 100`
          : `illustrative score ${displayScore} out of 100`;
      const coverageName = coverageText ? `, ${coverageText}` : '';
      return (
        <button
          id={selectButtonId}
          data-foundation-select={selectButtonId ? foundation.id : undefined}
          className="foundation-card foundation-card--compact foundation-card--interactive"
          type="button"
          onClick={onSelect}
          aria-label={`Open ${foundation.name} ${foundationTerm.singular.toLowerCase()} details, ${scoreName}${coverageName}`}
        >
          {content}
        </button>
      );
    }

    return (
      <article
        className="foundation-card foundation-card--compact"
        aria-labelledby={resolvedHeadingId}
      >
        {content}
      </article>
    );
  }

  return (
    <article className="foundation-card" aria-labelledby={headingId ?? `foundation-${foundation.id}`}>
      <div className="card-heading">
        <div>
          <p className="eyebrow">{foundation.category} {foundationTerm.singular.toLowerCase()}</p>
          <h3 id={headingId ?? `foundation-${foundation.id}`} tabIndex={onSelect || headingId ? -1 : undefined}>{foundation.name}</h3>
        </div>
        <span className={`lifecycle-badge${isCompleted ? ' is-complete' : ''}`} aria-live="polite">
          {isCompleted ? 'Completed' : completable ? 'In progress' : 'Ongoing'}
        </span>
      </div>
      <p className="card-copy">{foundation.description}</p>
      <CapabilityList
        capabilities={foundation.capabilities}
        label={`${foundationTerm.singular} capabilities`}
      />
      {children}
      {onSelect && (
        <button
          id={selectButtonId}
          data-foundation-select={selectButtonId ? foundation.id : undefined}
          className="button button-secondary"
          type="button"
          onClick={onSelect}
          aria-label={`Details for ${foundation.name}`}
        >
          Details
        </button>
      )}
      {completable && (
        <button
          className="button button-secondary"
          type="button"
          onClick={isCompleted ? onReopen : onComplete}
          disabled={isCompleted ? !onReopen : !onComplete}
        >
          {isCompleted ? 'Reopen milestone' : 'Mark milestone complete'}
        </button>
      )}
    </article>
  );
}

export function FoundationProgress({
  label,
  score,
  decorative = false
}: {
  label: string;
  score: number | null;
  decorative?: boolean;
}) {
  const clampedScore = score !== null && Number.isFinite(score)
    ? Math.max(0, Math.min(100, score))
    : null;
  return (
    <span
      className="foundation-progress"
      role={decorative ? undefined : 'meter'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : label}
      aria-valuemin={decorative ? undefined : 0}
      aria-valuemax={decorative ? undefined : 100}
      {...(!decorative && clampedScore !== null ? { 'aria-valuenow': clampedScore } : {})}
      {...(!decorative && clampedScore === null ? { 'aria-valuetext': 'Score unavailable' } : {})}
    >
      <span
        className="foundation-progress__fill"
        style={{ width: `${clampedScore ?? 0}%` }}
        aria-hidden="true"
      />
    </span>
  );
}

export function CategoryHealthBadge({
  score,
  accessibleLabel,
  className,
  displayScore = score,
  variant = 'default'
}: {
  score: number | null;
  accessibleLabel?: string;
  className?: string;
  displayScore?: number | null;
  variant?: 'default' | 'neutral-labeled';
}) {
  return (
    <span
      className={`ma-score ${scoreTone(score)}${className ? ` ${className}` : ''}`}
      {...(accessibleLabel
        ? { role: 'img', 'aria-label': accessibleLabel }
        : { 'aria-hidden': true })}
    >
      {variant === 'neutral-labeled'
        ? (
          <>
            <span className="ma-score__label">Health</span>
            <span className="ma-score__value">{displayScore ?? '—'}</span>
          </>
        )
        : displayScore ?? '—'}
    </span>
  );
}

type GoalCardProps = {
  goal: MoneyGoal;
  onEdit?: () => void;
  onCheckIn?: () => void;
  onCorrectCheckIn?: (checkIn: GoalCheckIn) => void;
};

export function GoalCard({ goal, onEdit, onCheckIn, onCorrectCheckIn }: GoalCardProps) {
  const latest = latestCheckIn(goal);
  const remaining = latest ? remainingAmount(goal, latest.balanceMinor) : null;
  return (
    <article className="goal-card" aria-labelledby={`goal-${goal.id}`}>
      <div className="card-heading">
        <div>
          <p className="eyebrow">{goal.direction === 'increase' ? 'Savings goal' : 'Debt goal'} · {goal.currency}</p>
          <h3 id={`goal-${goal.id}`}>{goal.title}</h3>
        </div>
        <span className="goal-kind">Money</span>
      </div>
      <dl className="goal-values">
        <div>
          <dt>Latest recorded balance</dt>
          <dd>{latest ? formatMoney(latest.balanceMinor, goal.currency) : 'No check-ins yet'}</dd>
          {latest && <dd className="goal-date-detail">Recorded {formatDate(latest.effectiveDate)}</dd>}
        </div>
        <div>
          <dt>Target balance · {formatDate(goal.targetDate)}</dt>
          <dd>{formatMoney(goal.targetBalanceMinor, goal.currency)}</dd>
          <dd className="goal-date-detail">
            {remaining === null
              ? 'Record a balance to calculate the amount remaining.'
              : remaining < 0
                ? `${formatMoney(Math.abs(remaining), goal.currency)} beyond target`
                : `${formatMoney(remaining, goal.currency)} remaining`}
          </dd>
        </div>
      </dl>
      <TimelineChart
        timeline={goalTimeline(goal)}
        valueLabel="balance"
        formatValue={value => formatMoney(value, goal.currency)}
      />
      <section className="goal-check-ins" aria-label={`Balance check-ins for ${goal.title}`}>
        <h4>Recorded check-ins</h4>
        {goal.checkIns.length
          ? (
            <ul>
              {[...goal.checkIns].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate)).map(checkIn => (
                <li key={checkIn.id}>
                  <span>
                    <strong>{formatDate(checkIn.effectiveDate)} · {formatMoney(checkIn.balanceMinor, goal.currency)}</strong>
                    {checkIn.note && <small>{checkIn.note}</small>}
                  </span>
                  {onCorrectCheckIn && (
                    <button type="button" className="goal-text-button" onClick={() => onCorrectCheckIn(checkIn)}>
                      Correct
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )
          : <p className="goal-empty-state">No sample check-ins yet. Record an observed balance to begin.</p>}
      </section>
      {goal.correctionHistory.length > 0 && (
        <section className="goal-correction-history" aria-label={`Correction history for ${goal.title}`}>
          <h4>Correction history</h4>
          <ul>
            {goal.correctionHistory.map((correction, index) => (
              <li key={`${correction.effectiveDate}-${index}`}>
                {formatDate(correction.effectiveDate)}: previous value {formatMoney(correction.previousBalanceMinor, goal.currency)}
                {correction.previousNote && <small>{correction.previousNote}</small>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {(onEdit || onCheckIn) && (
        <footer className="goal-footer">
          {onEdit && <button type="button" className="btn mini ghost" onClick={onEdit}>Edit goal</button>}
          {onCheckIn && <button type="button" className="btn mini" onClick={onCheckIn}>Record check-in</button>}
        </footer>
      )}
    </article>
  );
}

export function IllustrativeScore({
  label,
  score,
  compact = false
}: {
  label: string;
  score: number | null;
  compact?: boolean;
}) {
  return (
    <div className={`illustrative-score${compact ? ' illustrative-score--compact' : ''}`}>
      <span>{score === null ? `${label} unavailable` : `${label} · ${score} (not calculated)`}</span>
      <ScoreMeter label={`${label}, ${score === null ? 'unavailable' : `${score} out of 100, illustrative only`}`} score={score} compact={compact} />
    </div>
  );
}

type RhythmCardBaseProps = {
  rhythm: RhythmPreview;
  headingId?: string;
  people?: readonly PersonPreview[];
  onPersonSelect?: (personId: PersonId) => void;
};

type RhythmCardProps = RhythmCardBaseProps & (
  | { variant?: 'catalogue'; icon?: ReactNode | undefined; onDetails?: (event: MouseEvent<HTMLButtonElement>) => void }
  | {
      variant: 'simple';
      completed?: boolean;
      archived?: boolean;
      completionActionLabel?: string;
      completedActionLabel?: string;
      onDetails: (event: MouseEvent<HTMLButtonElement>) => void;
      onTend?: (event: MouseEvent<HTMLButtonElement>) => void;
      onUndo?: () => void;
    }
  | { variant: 'suggestion'; icon?: ReactNode | undefined; onDetails: (event: MouseEvent<HTMLButtonElement>) => void }
);

export function ScoreMeter({
  label,
  score,
  compact = false,
  markerPlacement = 'above'
}: {
  label: string;
  score: number | null;
  compact?: boolean;
  markerPlacement?: 'above' | 'below';
}) {
  const clampedScore = score !== null && Number.isFinite(score)
    ? Math.max(0, Math.min(100, score))
    : null;
  return (
    <div
      className={`category-health-meter preview-score-meter${compact ? ' preview-score-meter--compact' : ''}${markerPlacement === 'below' ? ' preview-score-meter--marker-below' : ''}`}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      {...(clampedScore === null
        ? { 'aria-valuetext': 'Score unavailable' }
        : { 'aria-valuenow': clampedScore, 'aria-valuetext': `${clampedScore} out of 100` })}
    >
      <span className={`category-health-spectrum${clampedScore === null ? ' is-empty' : ''}`} aria-hidden="true" />
      {clampedScore !== null && (
        <span
          className="preview-score-marker"
          style={{ '--score': `${clampedScore}%` } as CSSProperties}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export function RhythmCard(props: RhythmCardProps) {
  const { rhythm, headingId, people, onPersonSelect } = props;
  const externallyAutomated = rhythm.automation === 'external';

  if (props.variant === 'simple') {
    return (
      <SimpleRhythmCard
        rhythm={rhythm}
        headingId={headingId ?? `rhythm-${rhythm.id}`}
        externallyAutomated={externallyAutomated}
        people={people}
        onPersonSelect={onPersonSelect}
        completed={props.completed === true}
        archived={props.archived === true}
        completionActionLabel={props.completionActionLabel}
        completedActionLabel={props.completedActionLabel}
        onDetails={props.onDetails}
        onTend={props.onTend}
        onUndo={props.onUndo}
      />
    );
  }
  if (props.variant === 'suggestion') {
    return (
      <SimpleRhythmCard
        rhythm={rhythm}
        headingId={headingId ?? `rhythm-${rhythm.id}`}
        externallyAutomated={externallyAutomated}
        people={people}
        onPersonSelect={onPersonSelect}
        suggestion
        icon={props.icon}
        onDetails={props.onDetails}
      />
    );
  }

  return (
    <article className="rhythm-card" aria-labelledby={headingId ?? `rhythm-${rhythm.id}`}>
      <div className="rhythm-icon" aria-hidden="true">{props.icon ?? '↻'}</div>
      <div className="rhythm-content">
        <RhythmCardSummary
          rhythm={rhythm}
          externallyAutomated={externallyAutomated}
          headingId={headingId ?? `rhythm-${rhythm.id}`}
        />
        <p className="rhythm-cadence">{rhythm.cadence} · {rhythm.status}</p>
        <RhythmPeople rhythm={rhythm} people={people} onPersonSelect={onPersonSelect} />
        {props.onDetails && <RhythmDetailsButton rhythm={rhythm} onDetails={props.onDetails} />}
      </div>
    </article>
  );
}

function SimpleRhythmCard({
  rhythm,
  headingId,
  externallyAutomated,
  people,
  onPersonSelect,
  completed = false,
  archived = false,
  completionActionLabel,
  completedActionLabel,
  suggestion = false,
  icon,
  onDetails,
  onTend,
  onUndo
}: {
  rhythm: RhythmPreview;
  headingId: string;
  externallyAutomated: boolean;
  people?: readonly PersonPreview[] | undefined;
  onPersonSelect?: ((personId: PersonId) => void) | undefined;
  completed?: boolean;
  archived?: boolean;
  completionActionLabel?: string | undefined;
  completedActionLabel?: string | undefined;
  suggestion?: boolean;
  icon?: ReactNode | undefined;
  onDetails: (event: MouseEvent<HTMLButtonElement>) => void;
  onTend?: ((event: MouseEvent<HTMLButtonElement>) => void) | undefined;
  onUndo?: (() => void) | undefined;
}) {
  const tendButtonRef = useRef<HTMLButtonElement>(null);
  const timeZone = rhythm.scoring?.timeZone
    ?? rhythm.createdTimeZone
    ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const asOfDate = localDateInTimeZone(new Date(), timeZone);

  return (
    <article className={`rhythm-card rhythm-card--simple${suggestion ? ' rhythm-card--suggestion' : ''}`} aria-labelledby={headingId}>
      {suggestion && icon && <span className="rhythm-icon rhythm-card__suggestion-icon" aria-hidden="true">{icon}</span>}
      <div className="rhythm-card__simple-content">
        <RhythmCardSummary
          rhythm={rhythm}
          externallyAutomated={externallyAutomated}
          headingId={headingId}
          showDescription={false}
          archived={archived}
        />
        <RhythmPeople rhythm={rhythm} people={people} onPersonSelect={onPersonSelect} />
      </div>
      <div className="rhythm-card__actions">
        <RhythmDetailsButton rhythm={rhythm} onDetails={onDetails} />
        {onTend && (
          <RhythmCompletionActions
            rhythmTitle={rhythm.title}
            completed={completed}
            actionLabel={completionActionLabel}
            completedLabel={completedActionLabel}
            onTend={onTend}
            tendButtonRef={tendButtonRef}
          />
        )}
      </div>
      <RhythmMetadata
        variant="status"
        status={suggestion ? 'Suggested sample' : rhythmLastTendedLabel(rhythm, completed, asOfDate)}
        rhythmTitle={rhythm.title}
        completed={completed}
        onUndo={suggestion ? undefined : onUndo}
        tendButtonRef={tendButtonRef}
      />
    </article>
  );
}

function RhythmPeople({
  rhythm,
  people,
  onPersonSelect
}: {
  rhythm: RhythmPreview;
  people?: readonly PersonPreview[] | undefined;
  onPersonSelect?: ((personId: PersonId) => void) | undefined;
}) {
  return people && onPersonSelect
    ? <PersonBadgeList people={people} rhythmTitle={rhythm.title} onSelect={onPersonSelect} />
    : null;
}

function RhythmDetailsButton({
  rhythm,
  onDetails,
  disabled = false
}: {
  rhythm: RhythmPreview;
  onDetails?: ((event: MouseEvent<HTMLButtonElement>) => void) | undefined;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="today-rhythm-card__details-toggle rhythm-info-button"
      aria-label={`Details for ${rhythm.title}`}
      onClick={onDetails ? event => onDetails(event) : undefined}
      disabled={disabled || !onDetails}
    >
      <svg className="rhythm-info-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15.3 3.3c-1.6 0-2.9 1.2-2.9 2.8s1.1 2.7 2.7 2.7c1.7 0 3-1.2 3-2.8s-1.1-2.7-2.8-2.7Z" />
        <path d="M14.6 9.8c-1 0-2 .3-3 .8l-2.4 1.2.5 1.1 1.2-.5-1.8 6.8c-.4 1.5.3 2.4 1.8 2.4 1 0 2-.3 3-.9l2.2-1.3-.6-1-1.1.6 1.6-6.7c.4-1.6-.1-2.5-1.4-2.5Z" />
      </svg>
    </button>
  );
}

function RhythmCardSummary({
  rhythm,
  externallyAutomated,
  headingId,
  titleClassName,
  descriptionClassName,
  archived = false,
  showDescription = true
}: {
  rhythm: RhythmPreview;
  externallyAutomated: boolean;
  headingId: string;
  titleClassName?: string;
  descriptionClassName?: string;
  archived?: boolean;
  showDescription?: boolean;
}) {
  return (
    <>
      <div className="rhythm-title-row">
        <h3 id={headingId} className={titleClassName}>{rhythm.title}</h3>
        {archived && <RhythmArchivedBadge />}
        {rhythm.personal && <RhythmPersonalBadge />}
        {externallyAutomated && <span className="automation-badge">Automated at bank</span>}
      </div>
      {showDescription && rhythm.description?.trim() && (
        <p className={descriptionClassName ?? 'card-copy'}>{rhythm.description}</p>
      )}
    </>
  );
}

function CapabilityList({
  capabilities,
  label
}: {
  capabilities: FoundationCapabilities;
  label: string;
}) {
  const labels = [
    capabilities.rhythms ? 'Supports Rhythms' : null,
    capabilities.numericGoals ? 'Supports numeric goals' : null,
    capabilities.completion === 'ongoing' ? 'Ongoing' : 'Completable milestone'
  ].filter((label): label is string => label !== null);

  return (
    <ul className="capability-list" aria-label={label}>
      {labels.map(label => <li key={label}>{label}</li>)}
    </ul>
  );
}

function formatDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}
