import type {
  FoundationCapabilities,
  FoundationLifecycle
} from '../../../src/domain/capabilities.ts';
import type { MouseEvent } from 'react';
import {
  formatMoney,
  goalTimeline,
  latestCheckIn,
  remainingAmount,
  type GoalCheckIn,
  type MoneyGoal
} from '../domain/money-goals.ts';
import type { FoundationPreview, RhythmPreview } from '../domain/preview-data.ts';
import { TimelineChart } from './TimelineChart.tsx';

type FoundationCardProps = {
  foundation: FoundationPreview;
  lifecycle?: FoundationLifecycle;
  onComplete?: () => void;
  onReopen?: () => void;
};

export function FoundationCard({
  foundation,
  lifecycle = foundation.lifecycle,
  onComplete,
  onReopen
}: FoundationCardProps) {
  const completable = foundation.capabilities.completion !== 'ongoing';
  const isCompleted = lifecycle === 'completed';

  return (
    <article className="foundation-card" aria-labelledby={`foundation-${foundation.id}`}>
      <div className="card-heading">
        <div>
          <p className="eyebrow">{foundation.category} foundation</p>
          <h3 id={`foundation-${foundation.id}`}>{foundation.name}</h3>
        </div>
        <span className={`lifecycle-badge${isCompleted ? ' is-complete' : ''}`} aria-live="polite">
          {isCompleted ? 'Completed' : completable ? 'In progress' : 'Ongoing'}
        </span>
      </div>
      <p className="card-copy">{foundation.description}</p>
      <CapabilityList capabilities={foundation.capabilities} />
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


type RhythmCardProps = {
  rhythm: RhythmPreview;
  variant?: 'catalogue' | 'today';
  completed?: boolean;
  onTend?: () => void;
  onDetails?: (event: MouseEvent<HTMLButtonElement>) => void;
};

export function RhythmCard({
  rhythm,
  variant = 'catalogue',
  completed = false,
  onTend,
  onDetails
}: RhythmCardProps) {
  const externallyAutomated = rhythm.automation === 'external';

  if (variant === 'today') {
    return (
      <article className="rhythm-card card today-rhythm-card" aria-labelledby={`rhythm-${rhythm.id}`}>
        <div className="pi-main">
          <RhythmCardSummary
            rhythm={rhythm}
            externallyAutomated={externallyAutomated}
            titleClassName="tend-type-title"
            descriptionClassName="tend-type-description"
          />
          <span className="rhythm-card__meta">{rhythm.cadence} · {rhythm.timeLabel}</span>
        </div>
        <div className="today-rhythm-card__actions">
          <button
            type="button"
            className="btn mini rhythm-card__tend"
            aria-pressed={completed}
            disabled={completed || !onTend}
            onClick={onTend}
          >
            {completed ? 'Tended ✓' : 'Tend'}
          </button>
          <button
            type="button"
            className="today-rhythm-card__details-toggle"
            aria-label={`Details for ${rhythm.title}`}
            onClick={onDetails ? event => onDetails(event) : undefined}
            disabled={!onDetails}
          >
            Details
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="rhythm-card" aria-labelledby={`rhythm-${rhythm.id}`}>
      <div className="rhythm-icon" aria-hidden="true">↻</div>
      <div className="rhythm-content">
        <RhythmCardSummary rhythm={rhythm} externallyAutomated={externallyAutomated} />
        <p className="rhythm-cadence">{rhythm.cadence} · {rhythm.status}</p>
      </div>
    </article>
  );
}

function RhythmCardSummary({
  rhythm,
  externallyAutomated,
  titleClassName,
  descriptionClassName
}: {
  rhythm: RhythmPreview;
  externallyAutomated: boolean;
  titleClassName?: string;
  descriptionClassName?: string;
}) {
  return (
    <>
      <div className="rhythm-title-row">
        <h3 id={`rhythm-${rhythm.id}`} className={titleClassName}>{rhythm.title}</h3>
        {externallyAutomated && <span className="automation-badge">Automated at bank</span>}
      </div>
      <p className={descriptionClassName ?? 'card-copy'}>{rhythm.description}</p>
    </>
  );
}

function CapabilityList({ capabilities }: { capabilities: FoundationCapabilities }) {
  const labels = [
    capabilities.rhythms ? 'Supports Rhythms' : null,
    capabilities.numericGoals ? 'Supports numeric goals' : null,
    capabilities.completion === 'ongoing' ? 'Ongoing' : 'Completable milestone'
  ].filter((label): label is string => label !== null);

  return (
    <ul className="capability-list" aria-label="Foundation capabilities">
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
