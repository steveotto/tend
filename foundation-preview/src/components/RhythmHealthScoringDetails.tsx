import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import type { MouseEvent } from 'react';
import { addCalendarDays, calendarDaysInclusive } from '../domain/rhythm-occurrences.ts';
import type {
  ScoredConsistencyMetric,
  ScoredOnTrackMetric,
  UnscoredMetric
} from '../domain/rhythm-scoring.ts';
import { isOnceWeeklyRhythmSchedule, isPeriodBasedRhythmSchedule } from '../domain/rhythm-occurrences.ts';
import {
  ON_TRACK_SCORE_HISTORY_DISPLAY_LIMIT,
  latestOnTrackHistoryEntries,
  onTrackHistoryDisplayEntries,
  recentOnTrackHistoryEntries
} from '../domain/rhythm-score-presentation.ts';
import { rhythmWeekdayName } from '../domain/rhythm-schedule.ts';
import type { RhythmSchedule } from '../domain/rhythm-schedule.ts';
import { formatHealthPercentResult, formatScore } from '../domain/score-display.ts';
import { CategoryHealthBadge } from './Cards.tsx';
import { HealthDetailsExpandableHeader } from './HealthDetailsExpandableHeader.tsx';
import {
  HealthWeightPanels,
  formatTruthfulWeightedSum,
  healthWeightContributions
} from './HealthWeightPanels.tsx';

type FormatDate = (value: string, long?: boolean) => string;

export function RhythmHealthScoringDetails({
  id,
  consistency,
  onTrack,
  healthScore,
  unavailableExplanation,
  schedule,
  asOfDate,
  createdLocalDate,
  createdOnTrackScore,
  onChooseSchedule,
  formatDate,
  activity = 'rhythm',
  initiallyExpanded = true
}: {
  id: string;
  consistency: ScoredConsistencyMetric | UnscoredMetric;
  onTrack: ScoredOnTrackMetric | UnscoredMetric;
  healthScore: number | null;
  unavailableExplanation?: string;
  schedule?: RhythmSchedule;
  asOfDate: string;
  createdLocalDate?: string;
  createdOnTrackScore: number | null;
  onChooseSchedule?: (event: MouseEvent<HTMLButtonElement>) => void;
  formatDate: FormatDate;
  activity?: 'rhythm' | 'prayer';
  initiallyExpanded?: boolean;
}) {
  const headingId = useId();
  const contentId = useId();
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const consistencyScore = consistency.kind === 'scored' ? consistency.score : null;
  const onTrackScore = onTrack.kind === 'scored' ? onTrack.score : null;
  const sharedUnscoredExplanation = consistency.kind === 'unscored'
    && onTrack.kind === 'unscored'
    && consistency.explanation === onTrack.explanation;
  const contributions = healthWeightContributions(consistencyScore, onTrackScore);
  const scoreHistory = onTrack.kind === 'scored'
    ? onTrackHistoryDisplayEntries(onTrack.evidence, createdLocalDate, createdOnTrackScore)
    : [];
  const contributionsFormula = contributions.consistency === null
    || contributions.onTrack === null
    || healthScore === null
    ? null
    : formatTruthfulWeightedSum(contributions.consistency, contributions.onTrack, healthScore);

  return (
    <section
      id={id}
      className="rhythm-health-scoring-card"
      role="group"
      aria-labelledby={headingId}
    >
      <HealthDetailsExpandableHeader
        id={headingId}
        contentId={contentId}
        title={activity === 'prayer' ? 'How this prayer request was scored' : 'How this Rhythm was scored'}
        expanded={expanded}
        onToggle={() => setExpanded(value => !value)}
      />
      <div id={contentId} className="rhythm-health-scoring-card__content" hidden={!expanded}>
        <section className="rhythm-health-scoring-card__calculation" aria-labelledby={`${headingId}-calculation`}>
          <h4 id={`${headingId}-calculation`}>How Health is calculated</h4>
          <p>Consistency counts three times as much as On Track.</p>
          <HealthWeightPanels
            consistencyScore={consistencyScore}
            onTrackScore={onTrackScore}
          />
          <p
            className="rhythm-health-scoring-card__formula rhythm-health-scoring-card__formula--total"
            aria-label={contributionsFormula
              ? `${contributionsFormula[0]} plus ${contributionsFormula[1]} ${contributionsFormula[3] === '≈' ? 'approximately equals' : 'equals'} ${contributionsFormula[2]}`
              : 'Health contribution total unavailable'}
          >
            {contributionsFormula
              ? <><span>{contributionsFormula[0]} + {contributionsFormula[1]} {contributionsFormula[3]} </span><strong>{contributionsFormula[2]}</strong></>
              : '—'}
          </p>
          {unavailableExplanation && (
            <p className="rhythm-health-scoring-card__unavailable">{unavailableExplanation}</p>
          )}
        </section>

        <MetricSection
          title="Consistency"
          subtitle={activity === 'prayer'
            ? 'Consistency measures follow-through on this request over time'
            : 'Consistency measures your follow-through over time'}
          score={consistencyScore}
          label="Consistency score"
        >
          {consistency.kind === 'scored'
            ? <ConsistencyEvidence
                metric={consistency}
              {...(schedule ? { schedule } : {})}
                asOfDate={asOfDate}
                formatDate={formatDate}
                activity={activity}
              />
            : <UnscoredEvidence
                metric={consistency}
                activity={activity}
              {...(!sharedUnscoredExplanation && onChooseSchedule ? { onChooseSchedule } : {})}
              />}
        </MetricSection>

        <MetricSection
          title="On Track"
          subtitle={activity === 'prayer'
            ? 'On Track measures how caught up you are with this request'
            : 'On Track measures how caught up you are'}
          score={onTrackScore}
          label="On Track score"
        >
          {onTrack.kind === 'scored'
            ? (
              <OnTrackEvidence
                metric={onTrack}
                entries={scoreHistory}
                asOfDate={asOfDate}
                formatDate={formatDate}
                  activity={activity}
              />
            )
            : <UnscoredEvidence
                metric={onTrack}
                  activity={activity}
                {...(sharedUnscoredExplanation && onChooseSchedule ? { onChooseSchedule } : {})}
              />}
        </MetricSection>
      </div>
    </section>
  );
}

function MetricSection({
  title,
  subtitle,
  score,
  label,
  children
}: {
  title: string;
  subtitle: string;
  score: number | null;
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="rhythm-health-scoring-card__metric" aria-label={`${title} scoring evidence`}>
      <header>
        <h4>{title}</h4>
        <CategoryHealthBadge
          score={score}
          accessibleLabel={score === null ? `${label}: unavailable` : `${label}: ${formatScore(score)}`}
          className="rhythm-health-scoring-card__badge"
          appearance="rounded"
        />
      </header>
      <p className="rhythm-health-scoring-card__subtitle">{subtitle}</p>
      {children}
    </section>
  );
}

function ConsistencyEvidence({
  metric,
  schedule,
  asOfDate,
  formatDate,
  activity
}: {
  metric: ScoredConsistencyMetric;
  schedule?: RhythmSchedule;
  asOfDate: string;
  formatDate: FormatDate;
  activity: 'rhythm' | 'prayer';
}) {
  const evidence = metric.evidence;
  const measuredDays = evidence.limitedHistoryDays
    ?? calendarDaysInclusive(evidence.windowStartDate, evidence.windowEndDate);
  const formula = `${evidence.completedCount} ÷ ${evidence.eligibleDueCount} × 100`;
  const result = formatHealthPercentResult(
    evidence.eligibleDueCount > 0
      ? evidence.completedCount / evidence.eligibleDueCount * 100
      : 0,
    metric.score
  );
  return (
    <>
      <BreakdownRows rows={[
        {
          label: evidence.frequency === 'daily'
            && evidence.windowStartDate === addCalendarDays(asOfDate, -29)
            ? 'Last 30 days'
            : 'Dates',
          value: `${formatDate(evidence.windowStartDate, false)}–${formatDate(evidence.windowEndDate, false)}`
        },
        { label: activity === 'prayer' ? 'Prayed' : 'Completed', value: String(evidence.completedCount) },
        { label: 'Scheduled', value: String(evidence.eligibleDueCount) }
      ]} />
      <p className="rhythm-health-scoring-card__formula rhythm-health-scoring-card__formula--consistency">
        <span>{formula} {result.operator} <strong>{result.value}%</strong></span>
      </p>
      <p className="rhythm-health-scoring-card__measurement">
        <strong>{consistencyFrequencyName(evidence.frequency)}</strong> frequency based on {measuredDays}{' '}
        {measuredDays === 1 ? 'day' : 'days'} of tracking.
      </p>
      {consistencyEligibilityNote(schedule, activity)}
    </>
  );
}

function consistencyFrequencyName(frequency: ScoredConsistencyMetric['evidence']['frequency']): string {
  switch (frequency) {
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    case 'quarterly':
      return 'Quarterly';
    case 'yearly':
      return 'Yearly';
    case 'custom':
      return 'Custom interval';
  }
}

function consistencyEligibilityNote(
  schedule: RhythmSchedule | undefined,
  activity: 'rhythm' | 'prayer'
): ReactNode {
  if (!schedule) return null;
  if (isOnceWeeklyRhythmSchedule(schedule)) {
    const plannedDay = rhythmWeekdayName(schedule.weekdays[0]!);
    return (
      <p className="rhythm-health-scoring-card__note">
        Once each week. Any day counts; {plannedDay} is your planned day.{' '}
        Each eligible week counts once.
      </p>
    );
  }
  if (isPeriodBasedRhythmSchedule(schedule)) {
    return (
      <p className="rhythm-health-scoring-card__note">
        Any {activity === 'prayer' ? 'prayer' : 'completion'} in its eligible calendar period
        {' '}counts once; extra logs stay in your history.
      </p>
    );
  }
  return null;
}

function OnTrackEvidence({
  metric,
  entries,
  asOfDate,
  formatDate,
  activity
}: {
  metric: ScoredOnTrackMetric;
  entries: ReturnType<typeof onTrackHistoryDisplayEntries>;
  asOfDate: string;
  formatDate: FormatDate;
  activity: 'rhythm' | 'prayer';
}) {
  const historyId = useId();
  const [showFullHistory, setShowFullHistory] = useState(false);
  const evidence = metric.evidence;
  const recentHistoryInWindow = recentOnTrackHistoryEntries(entries, asOfDate);
  const recentEntries = latestOnTrackHistoryEntries(
    recentHistoryInWindow,
    ON_TRACK_SCORE_HISTORY_DISPLAY_LIMIT
  );
  const hasFullHistoryAlternate = entries.length !== recentEntries.length
    || entries.some((entry, index) => entry !== recentEntries[index]);
  const formula = evidence.lastQualifyingCompletionDate === null
    ? null
    : evidence.missedOccurrenceCount * evidence.pointsPerMissedOccurrence > 100
      ? `max(0, 100 − (${evidence.missedOccurrenceCount} × ${evidence.pointsPerMissedOccurrence}))`
      : `100 − (${evidence.missedOccurrenceCount} × ${evidence.pointsPerMissedOccurrence})`;
  const firstQualifyingAction = activity === 'prayer' ? 'prayer' : 'Tend';
  const visibleEntries = showFullHistory ? entries : recentEntries;
  return (
    <>
      <BreakdownRows rows={[
        {
          label: activity === 'prayer' ? 'Last prayed' : 'Last tended',
          value: evidence.lastQualifyingCompletionDate
            ? formatDate(evidence.lastQualifyingCompletionDate, false)
            : 'None yet'
        },
        { label: 'Missed occurrences', value: String(evidence.missedOccurrenceCount) },
        {
          label: 'Per miss',
          value: `${evidence.pointsPerMissedOccurrence} points${formula === null
            ? ` after the first qualifying ${firstQualifyingAction}`
            : ''}`
        }
      ]} />
      <p className="rhythm-health-scoring-card__formula rhythm-health-scoring-card__formula--on-track">
        <span>{formula === null
          ? <><strong>0</strong> until the first qualifying {firstQualifyingAction}</>
          : <>{formula} = <strong>{formatScore(metric.score)}</strong></>}</span>
      </p>
      <section className="rhythm-health-scoring-card__history" aria-labelledby={`${historyId}-title`}>
        <h5 id={`${historyId}-title`}>Recent score history</h5>
        {!showFullHistory && (
          <p className="rhythm-health-scoring-card__history-count">
            Last 30 days{recentHistoryInWindow.length > ON_TRACK_SCORE_HISTORY_DISPLAY_LIMIT ? ' · Latest 5 entries' : ''}
          </p>
        )}
        <ol id={historyId} aria-label="On Track score changes">
          {visibleEntries.map(entry => (
            <li
              key={entry.key}
              className={`rhythm-health-scoring-card__history-entry rhythm-health-scoring-card__history-entry--${entry.kind === 'occurrence' ? entry.status : entry.kind}`}
              aria-label={historyEntryDescription(entry, metric, formatDate, activity)}
            >
              <span className="rhythm-health-scoring-card__history-dot" aria-hidden="true" />
              <span>{historyEntryLabel(entry, formatDate, activity)}</span>
              <strong>{formatScore(entry.score)}</strong>
            </li>
          ))}
        </ol>
        {!showFullHistory && recentEntries.length === 0 && (
          <p className="rhythm-health-scoring-card__history-empty" role="status">
            No score history in the last 30 days.
          </p>
        )}
        {hasFullHistoryAlternate && (
          <button
            type="button"
            className="rhythm-health-scoring-card__history-toggle"
            aria-expanded={showFullHistory}
            aria-controls={historyId}
            onClick={() => setShowFullHistory(value => !value)}
          >
            {showFullHistory ? 'Show recent history' : 'Show full history'}
          </button>
        )}
      </section>
    </>
  );
}

function historyEntryLabel(
  entry: ReturnType<typeof onTrackHistoryDisplayEntries>[number],
  formatDate: FormatDate,
  activity: 'rhythm' | 'prayer'
): string {
  if (entry.kind === 'created') {
    return `${formatDate(entry.date, false)} · ${activity === 'prayer' ? 'Prayer request created' : 'Created'}`;
  }
  if (entry.kind === 'schedule-change') return `${formatDate(entry.date, false)} · Schedule changed`;
  if (entry.kind === 'zero-score-span') {
    return `${entry.occurrenceCount} more misses · ${formatDate(entry.startDate, false)}–${formatDate(entry.endDate, false)}`;
  }
  if (entry.status === 'today') return `Today · ${formatDate(entry.date, false)}`;
  return `${formatDate(entry.date, false)} · ${entry.status === 'completed'
    ? activity === 'prayer' ? 'Prayed' : 'Tended'
    : 'Missed'}`;
}

function historyEntryDescription(
  entry: ReturnType<typeof onTrackHistoryDisplayEntries>[number],
  metric: ScoredOnTrackMetric,
  formatDate: FormatDate,
  activity: 'rhythm' | 'prayer'
): string {
  const subject = activity === 'prayer' ? 'Prayer request' : 'Rhythm';
  const action = activity === 'prayer' ? 'Prayer' : 'Completion';
  if (entry.kind === 'created') {
    return `${subject} created on ${formatDate(entry.date)}. On Track score at creation: ${formatScore(entry.score)}.`;
  }
  if (entry.kind === 'schedule-change') {
    return `Schedule changed on ${formatDate(entry.date)}. On Track score at that point: ${formatScore(entry.score)}.`;
  }
  if (entry.kind === 'zero-score-span') {
    const unit = entry.occurrenceCount === 1 ? 'additional missed occurrence' : 'additional missed occurrences';
    return `On Track remained at 0 through ${entry.occurrenceCount} ${unit} from ${formatDate(entry.startDate)} through ${formatDate(entry.endDate)}.`;
  }
  if (entry.status === 'completed') {
    if (entry.periodStartDate && entry.eligibleEndDate && entry.completionDate) {
      return `${action} on ${formatDate(entry.completionDate)} satisfied the occurrence due ${formatDate(entry.date)} within its eligible period, ${formatDate(entry.periodStartDate)}–${formatDate(entry.eligibleEndDate)}. Extra logs stay in your history.`;
    }
    return `Qualifying ${activity === 'prayer' ? 'prayer' : 'completion'} on ${formatDate(entry.date)} reset the missed-occurrence count and On Track score to 100.`;
  }
  if (entry.status === 'missed') {
    const period = entry.periodStartDate && entry.eligibleEndDate
      ? ` in the eligible period ${formatDate(entry.periodStartDate)}–${formatDate(entry.eligibleEndDate)}`
      : '';
    const occurrenceIndex = metric.evidence.occurrences.findIndex(occurrence =>
      occurrence.status === 'missed' && occurrence.date === entry.date
    );
    const hasEarlierQualifyingCompletion = occurrenceIndex >= 0
      && metric.evidence.occurrences.slice(0, occurrenceIndex)
        .some(occurrence => occurrence.status === 'completed');
    if (!hasEarlierQualifyingCompletion) {
      const firstQualifyingAction = activity === 'prayer' ? 'prayer' : 'Tend';
      return `Missed scheduled occurrence on ${formatDate(entry.date)}${period} before the first qualifying ${firstQualifyingAction}; On Track stays at 0 until then.`;
    }
    return `Missed scheduled occurrence on ${formatDate(entry.date)}${period}; ${metric.evidence.pointsPerMissedOccurrence}-point deduction applied. Resulting On Track score: ${formatScore(entry.score)}.`;
  }
  return `Current On Track state as of ${formatDate(entry.date)}. Current score: ${formatScore(entry.score)}.`;
}

function UnscoredEvidence({
  metric,
  onChooseSchedule,
  activity
}: {
  metric: UnscoredMetric;
  onChooseSchedule?: (event: MouseEvent<HTMLButtonElement>) => void;
  activity: 'rhythm' | 'prayer';
}) {
  const explanation = activity === 'prayer'
    ? prayerUnscoredExplanation(metric)
    : metric.explanation;
  return (
    <div className="rhythm-health-scoring-card__unscored">
      <p>{explanation}</p>
      {onChooseSchedule && (
        <button type="button" onClick={onChooseSchedule}>
          Choose a schedule to calculate On Track
        </button>
      )}
    </div>
  );
}

function prayerUnscoredExplanation(metric: UnscoredMetric): string {
  switch (metric.reasonCode) {
    case 'ready-for-first-tend':
      return 'Ready for your first prayer.';
    case 'unsupported-schedule':
      return 'Set a supported prayer frequency to calculate Health.';
    case 'history-unavailable':
      return 'Prayer history is unavailable, so this request cannot be scored.';
    case 'not-started':
      return 'This prayer schedule has not started yet.';
    case 'inactive':
      return metric.explanation.includes('has ended')
        ? 'This prayer schedule has ended, so its score is not accruing.'
        : 'This prayer request is inactive, so its score is not accruing.';
    case 'no-eligible-occurrences':
      return 'No scheduled prayer opportunities to measure yet.';
    case 'timezone-uncertain':
      return 'Prayer Health is unavailable because the prayer history time zone is uncertain.';
    case 'unsupported-history':
      return metric.explanation
        .replaceAll('This Rhythm', 'This prayer request')
        .replaceAll('Rhythm’s', 'prayer request’s')
        .replaceAll('scheduled moments', 'scheduled prayer opportunities');
  }
}

function BreakdownRows({ rows }: { rows: readonly { label: string; value: string }[] }) {
  return (
    <dl className="rhythm-history-view__breakdown-rows">
      {rows.map(row => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
