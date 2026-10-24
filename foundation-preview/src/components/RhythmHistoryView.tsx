import { useEffect, useId, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import type { PersonId, PersonPreview, RhythmPreview } from '../domain/preview-data.ts';
import { orderedCompletions } from '../domain/preview-data.ts';
import type { RhythmCompletion } from '../domain/preview-data.ts';
import type { DatedRhythmCompletion, RhythmCompletionRecord } from '../domain/rhythm-completion.ts';
import {
  prepareCompletionHistory,
  HEALTH_CONSISTENCY_WEIGHT,
  HEALTH_ON_TRACK_WEIGHT
} from '../domain/rhythm-history.ts';
import {
  localDateInTimeZone,
  selectDailyRhythmScore
} from '../domain/rhythm-scoring.ts';
import { isValidTimeZone } from '../domain/rhythm-schedule.ts';
import type {
  ScoredConsistencyMetric,
  ScoredOnTrackMetric,
  UnscoredMetric
} from '../domain/rhythm-scoring.ts';
import { scoreTone } from '../domain/score-tone.ts';
import { PersonBadgeList } from './PersonBadge.tsx';
import { RhythmArchivedBadge } from './RhythmArchivedBadge.tsx';
import { RhythmScheduleSummary } from './RhythmMetadata.tsx';
import { RhythmPersonalBadge } from './RhythmPersonalBadge.tsx';
import { RhythmScoreCircle } from './RhythmScoreCircle.tsx';
import { RhythmCompletionHistoryChart } from './RhythmCompletionHistoryChart.tsx';
import { RhythmCompletionForm } from './RhythmCompletionForm.tsx';
import { RhythmMetadataIcon } from './RhythmMetadataIcon.tsx';
import { RhythmCategoryBadges } from './RhythmCategoryBadges.tsx';

type MetricName = 'consistency' | 'onTrack';

const metricCopy = {
  consistency: {
    title: 'Consistency',
    shortDescription: 'Consistency over the applicable historical window'
  },
  onTrack: {
    title: 'On Track',
    shortDescription: 'Current follow-through for a daily Rhythm'
  }
} as const;

export function RhythmHistoryView({
  rhythm,
  people,
  onPersonSelect,
  archived = false,
  onClose,
  closeButtonRef,
  datedCompletions = [],
  completionHistoryAvailable = false,
  onUpdateCompletion,
  onDeleteCompletion,
  onEditRhythm
}: {
  rhythm: RhythmPreview;
  people?: readonly PersonPreview[];
  onPersonSelect?: (personId: PersonId) => void;
  archived?: boolean;
  onClose?: () => void;
  closeButtonRef?: { current: HTMLButtonElement | null };
  datedCompletions?: readonly DatedRhythmCompletion[];
  completionHistoryAvailable?: boolean;
  onUpdateCompletion?: (record: RhythmCompletionRecord) => string | null;
  onDeleteCompletion?: (completionId: string) => string | null;
  onEditRhythm?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const historyRecords: readonly RhythmCompletion[] | undefined =
    rhythm.completionHistory === undefined && !completionHistoryAvailable && datedCompletions.length === 0
      ? undefined
      : [...(rhythm.completionHistory ?? []), ...datedCompletions];
  const completions = prepareCompletionHistory(historyRecords);
  const scoringTimeZone = rhythm.scoring?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [scoringInstant, setScoringInstant] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setScoringInstant(new Date());
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  const asOfTimeZone = isValidTimeZone(scoringTimeZone)
    ? scoringTimeZone
    : Intl.DateTimeFormat().resolvedOptions().timeZone;
  const asOfDate = localDateInTimeZone(scoringInstant, asOfTimeZone);
  const scoringRecords: RhythmCompletionRecord[] = (historyRecords ?? []).map(record => ({
    ...record,
    rhythmId: rhythm.id
  }));
  const score = selectDailyRhythmScore({
    rhythmId: rhythm.id,
    ...(rhythm.schedule ? { schedule: rhythm.schedule } : {}),
    ...(rhythm.scoring ? { scoring: rhythm.scoring } : {}),
    records: scoringRecords,
    recordsAvailable: completionHistoryAvailable || rhythm.completionHistory !== undefined || datedCompletions.length > 0,
    archived,
    asOfDate,
    timeZone: scoringTimeZone
  });
  const historyViewRef = useRef<HTMLElement>(null);
  const loggedMomentsSummaryRef = useRef<HTMLElement>(null);
  const editButtonsRef = useRef(new Map<string, HTMLButtonElement>());
  const deleteButtonsRef = useRef(new Map<string, HTMLButtonElement>());
  const deleteCancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousEditingIdRef = useRef<string | null>(null);
  const previousDeleteIdRef = useRef<string | null>(null);
  const scoreDetailsId = useId();
  const sharedUnscoredExplanation = score.consistency.kind === 'unscored' && score.onTrack.kind === 'unscored'
    && score.consistency.explanation === score.onTrack.explanation;
  const [editingRecord, setEditingRecord] = useState<RhythmCompletionRecord | null>(null);
  const [scoreDetailsExpanded, setScoreDetailsExpanded] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [focusAfterDeleteId, setFocusAfterDeleteId] = useState<string | null>(null);
  const hasDescription = Boolean(rhythm.description?.trim());
  const editableRecordIds = new Set((historyRecords ?? []).map(record => record.id));

  useEffect(() => {
    historyViewRef.current?.focus();
  }, []);

  useEffect(() => {
    const previousId = previousEditingIdRef.current;
    if (previousId && !editingRecord) {
      editButtonsRef.current.get(previousId)?.focus();
    }
    previousEditingIdRef.current = editingRecord?.id ?? null;
  }, [editingRecord]);

  useEffect(() => {
    const previousId = previousDeleteIdRef.current;
    if (previousId && !deletingRecordId) {
      const targetId = focusAfterDeleteId ?? previousId;
      const target = deleteButtonsRef.current.get(targetId)
        ?? editButtonsRef.current.get(targetId)
        ?? loggedMomentsSummaryRef.current;
      target?.focus();
      setFocusAfterDeleteId(null);
      setDeleteError('');
    }
    previousDeleteIdRef.current = deletingRecordId;
  }, [deletingRecordId, focusAfterDeleteId, completions]);

  useEffect(() => {
    if (deletingRecordId) deleteCancelButtonRef.current?.focus();
  }, [deletingRecordId]);

  function confirmDelete() {
    if (!deletingRecordId || !onDeleteCompletion) return;
    const error = onDeleteCompletion(deletingRecordId);
    if (error) {
      setDeleteError(error);
      return;
    }
    const nextRecordId = datedCompletions.find(record => record.id !== deletingRecordId)?.id
      ?? orderedCompletions(historyRecords ?? []).find(record => record.id !== deletingRecordId)?.id
      ?? null;
    setFocusAfterDeleteId(nextRecordId);
    setDeletingRecordId(null);
  }

  return (
    <section
      ref={historyViewRef}
      className={`rhythm-history-view${onClose ? ' rhythm-history-view--dialog' : ''}`}
      role="region"
      aria-label={`History for ${rhythm.title}`}
      tabIndex={-1}
    >
      {editingRecord ? (
        <RhythmCompletionForm
          rhythm={rhythm}
          embedded
          initialRecord={editingRecord}
          onSave={record => onUpdateCompletion
            ? onUpdateCompletion(record)
            : 'This logged moment can no longer be edited.'}
          onCancel={() => setEditingRecord(null)}
        />
      ) : (
        <>
      <header className="rhythm-history-view__rhythm-header">
        <div className="rhythm-history-view__title-row">
          <div className="rhythm-history-view__title-copy">
            <h3 id="rhythm-details-title">{rhythm.title}</h3>
            {archived && <RhythmArchivedBadge />}
            {rhythm.personal && <RhythmPersonalBadge />}
          </div>
        </div>
        {onClose && (
          <button
            ref={closeButtonRef}
            type="button"
            className="today-rhythm-details__close today-rhythm-details__close--history"
            aria-label="Close details"
            onClick={onClose}
          >
            ×
          </button>
        )}
        {hasDescription && (
          <p className="rhythm-history-view__description">
            {rhythm.description}
          </p>
        )}
        {people && onPersonSelect && (
          <div className="rhythm-history-view__people">
            <PersonBadgeList people={people} rhythmTitle={rhythm.title} onSelect={onPersonSelect} />
          </div>
        )}
        <RhythmCategoryBadges rhythm={rhythm} />
        {(rhythm.cadence || rhythm.timeLabel) && (
          <p className="rhythm-history-view__schedule">
            <RhythmScheduleSummary cadence={rhythm.cadence} timeLabel={rhythm.timeLabel} />
          </p>
        )}
      </header>

      <section className="rhythm-history-view__score-section" aria-label="Health, Consistency, and On Track scores">
        <div className="rhythm-history-view__score-card">
          <div className="rhythm-history-view__score-card-controls">
            <button
              type="button"
              className="rhythm-history-view__score-info"
              aria-label={`${scoreDetailsExpanded ? 'Hide' : 'Show'} Consistency and On Track score details`}
              aria-expanded={scoreDetailsExpanded}
              aria-controls={scoreDetailsId}
              onClick={() => setScoreDetailsExpanded(expanded => !expanded)}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <circle cx="8" cy="8" r="6.25" />
                <path d="M8 7.2v4M8 4.8h.01" />
              </svg>
            </button>
          </div>
          <div className="rhythm-history-view__health-summary">
            <div className="rhythm-history-view__health-heading">
              <h3>Health</h3>
              <span className={score.healthScore === null ? 'is-unavailable' : undefined}>
                {score.healthScore === null ? '—' : Math.round(score.healthScore)}
              </span>
            </div>
            <HealthScoreMeter score={score.healthScore} />
          </div>
          <div className="rhythm-history-view__score-summary-divider" aria-hidden="true" />
          <div className="rhythm-history-view__score-grid">
            <RhythmMetricSummary
              name="consistency"
              metric={score.consistency}
              copy={metricCopy.consistency}
            />
            <RhythmMetricSummary
              name="onTrack"
              metric={score.onTrack}
              copy={metricCopy.onTrack}
            />
          </div>
          <div
            id={scoreDetailsId}
            className="rhythm-history-view__score-details-grid"
            role="group"
            aria-label="Consistency and On Track score details"
            hidden={!scoreDetailsExpanded}
          >
            {score.consistency.kind === 'scored'
              && score.onTrack.kind === 'scored'
              && score.healthScore !== null
              ? (
                <HealthCalculation
                  consistency={score.consistency.exactPercent}
                  onTrack={score.onTrack.score}
                  health={score.healthScore}
                />
              )
              : (
                <HealthCalculation />
              )}
            {sharedUnscoredExplanation ? null : (
              <div className="rhythm-history-view__score-details-columns">
                <div className="rhythm-history-view__score-details-column">
                  {score.consistency.kind === 'scored'
                    ? <ConsistencyScoreBreakdown metric={score.consistency} />
                    : <UnscoredBreakdown metric={score.consistency} />}
                </div>
                <div className="rhythm-history-view__score-details-column">
                  {score.onTrack.kind === 'scored'
                    ? <OnTrackScoreBreakdown metric={score.onTrack} />
                    : <UnscoredBreakdown metric={score.onTrack} />}
                </div>
              </div>
            )}
          </div>
        </div>
        <p className="rhythm-history-view__sample-notice" role="status">
          {score.kind === 'daily-score'
            ? score.healthScore !== null
              ? `Calculated from saved daily completion records · as of ${formatHistoryDate(score.asOfDate, false)}, ${new Date(`${score.asOfDate}T12:00:00`).getFullYear()}.`
              : score.consistency.kind === 'unscored'
                ? score.consistency.explanation
                : score.onTrack.kind === 'unscored'
                  ? score.onTrack.explanation
                  : 'Health is unavailable because both metrics must be scored.'
            : score.kind === 'invalid'
              ? `Scores unavailable: ${score.reason}`
              : score.reason.explanation}
          {score.kind === 'unscored' && score.reason.reasonCode === 'missing-tracking-start' && onEditRhythm && (
            <button
              type="button"
              className="rhythm-history-view__set-tracking"
              onClick={onEditRhythm}
            >
              Set tracking start
            </button>
          )}
        </p>
      </section>

      <section className="rhythm-history-view__completions" aria-labelledby="rhythm-history-completions-title">
        <h3 id="rhythm-history-completions-title">All completion history</h3>
        {completions.kind === 'recorded' && (
          <p className="rhythm-history-view__completion-summary" aria-label={`${completions.count} ${completions.count === 1 ? 'moment' : 'moments'} tended across ${completions.dailyCounts.length} ${completions.dailyCounts.length === 1 ? 'day' : 'days'}`}>
            <span className="rhythm-history-view__completion-total">
              <strong>{completions.count}</strong>
              <span>{completions.count === 1 ? 'moment tended' : 'moments tended'}</span>
            </span>
            <span className="rhythm-history-view__completion-span">
              across {completions.dailyCounts.length} {completions.dailyCounts.length === 1 ? 'day' : 'days'}
            </span>
          </p>
        )}
        <RhythmCompletionHistoryChart
          dailyCounts={completions.kind === 'recorded' ? completions.dailyCounts : []}
        />
        {completions.kind === 'unavailable' && (
          <p className="rhythm-history-view__empty">Dated completion history is unavailable for this Rhythm.</p>
        )}
        {completions.kind === 'empty' && (
          <p className="rhythm-history-view__empty rhythm-history-view__empty-notice">
            Your story starts with the first Tend.
          </p>
        )}
        <details className="rhythm-history-view__logged-moments">
          <summary ref={loggedMomentsSummaryRef}>Logged moments ({completions.kind === 'recorded' ? completions.count : 0})</summary>
          {completions.kind === 'recorded' ? (
            <ol>
              {completions.records.map(item => (
                <li className="rhythm-history-view__logged-entry" key={item.id}>
                  <div className="rhythm-history-view__logged-entry-content">
                    <div className="rhythm-history-view__logged-entry-copy">
                      <strong>{rhythm.title}</strong>
                      <p className="rhythm-history-view__logged-entry-date">
                        <time dateTime={item.effectiveDate}>{formatHistoryDate(item.effectiveDate)}</time>
                        <span aria-hidden="true"> · </span>
                        {item.localTime
                          ? <time dateTime={item.completedAt ?? item.effectiveDate}>{formatLocalTime(item.localTime)}</time>
                          : <span>Time not recorded</span>}
                      </p>
                      {item.memory && <p className="rhythm-history-view__logged-entry-memory">{item.memory}</p>}
                    </div>
                    {editableRecordIds.has(item.id) && (onUpdateCompletion || onDeleteCompletion) && (
                      <div className="rhythm-history-view__logged-entry-actions">
                        {onUpdateCompletion && <button
                          ref={node => {
                            if (node) editButtonsRef.current.set(item.id, node);
                            else editButtonsRef.current.delete(item.id);
                          }}
                          type="button"
                          className="rhythm-history-view__entry-action"
                          aria-label={`Edit logged moment for ${rhythm.title}, ${formatHistoryDate(item.effectiveDate)}${item.localTime ? ` at ${formatLocalTime(item.localTime)}` : ''}`}
                          onClick={() => {
                            const record = historyRecords?.find(candidate => candidate.id === item.id);
                            if (record) setEditingRecord({ ...record, rhythmId: rhythm.id });
                          }}
                        >
                          <RhythmMetadataIcon kind="edit" />
                        </button>}
                        {onDeleteCompletion && <button
                          ref={node => {
                            if (node) deleteButtonsRef.current.set(item.id, node);
                            else deleteButtonsRef.current.delete(item.id);
                          }}
                          type="button"
                          className="rhythm-history-view__entry-action"
                          aria-label={`Delete logged moment for ${rhythm.title}, ${formatHistoryDate(item.effectiveDate)}${item.localTime ? ` at ${formatLocalTime(item.localTime)}` : ''}`}
                          onClick={() => {
                            setDeleteError('');
                            setDeletingRecordId(item.id);
                          }}
                        >
                          <RhythmMetadataIcon kind="delete" />
                        </button>}
                      </div>
                    )}
                  </div>
                  {deletingRecordId === item.id && (
                    <div
                      className="rhythm-history-view__delete-confirmation"
                      role="alertdialog"
                      aria-labelledby={`delete-logged-moment-${item.id}`}
                    >
                      <strong id={`delete-logged-moment-${item.id}`}>
                        Delete {rhythm.title} from {formatHistoryDate(item.effectiveDate)}
                        {item.localTime ? ` at ${formatLocalTime(item.localTime)}` : ''}?
                      </strong>
                      {deleteError && <p role="alert">{deleteError}</p>}
                      <div className="rhythm-history-view__delete-actions">
                        <button
                          ref={deleteCancelButtonRef}
                          type="button"
                          className="btn mini ghost"
                          onClick={() => setDeletingRecordId(null)}
                        >
                          Cancel
                        </button>
                        <button type="button" className="btn mini" onClick={confirmDelete}>
                          Delete moment
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p>{completions.kind === 'unavailable' ? 'Dated moments are unavailable.' : 'No logged moments.'}</p>
          )}
        </details>
      </section>

        </>
      )}
    </section>
  );
}

type ScoreMetric =
  | ScoredConsistencyMetric
  | ScoredOnTrackMetric
  | UnscoredMetric
  | { kind: 'unavailable'; explanation: string };

function RhythmMetricSummary({
  name,
  metric,
  copy
}: {
  name: MetricName;
  metric: ScoreMetric;
  copy: (typeof metricCopy)[keyof typeof metricCopy];
}) {
  const headingId = `rhythm-score-${name}`;
  return (
    <section className="rhythm-history-view__score-summary" aria-labelledby={headingId}>
      <header className="rhythm-history-view__score-heading">
        <h3 id={headingId}>{copy.title}</h3>
      </header>
      <RhythmScoreCircle
        label={copy.title}
        score={metric.kind === 'scored' ? Math.round(metric.score) : null}
        state={metric.kind}
        {...(metric.kind === 'unscored' ? { explanation: metric.explanation } : {})}
      />
      <p className="rhythm-history-view__short-description">{copy.shortDescription}</p>
    </section>
  );
}

export function HealthScoreMeter({ score, illustrative = false }: { score: number | null; illustrative?: boolean }) {
  const available = score !== null;
  return (
    <div
      className={`rhythm-history-view__health-meter ${scoreTone(score)}`}
      role={available ? 'meter' : 'img'}
      aria-label={available ? 'Health score' : 'Health: Not enough data'}
      aria-valuemin={available ? 0 : undefined}
      aria-valuemax={available ? 100 : undefined}
      aria-valuenow={score ?? undefined}
      aria-valuetext={available ? `${Math.round(score)} out of 100${illustrative ? ', illustrative blend' : ''}` : undefined}
    >
      <span
        className="rhythm-history-view__health-meter-fill"
        aria-hidden="true"
        style={{ width: `${score ?? 0}%` }}
      />
    </div>
  );
}

function ConsistencyScoreBreakdown({ metric }: { metric: ScoredConsistencyMetric }) {
  const evidence = metric.evidence;
  const firstDate = evidence.occurrences[0]?.date;
  const lastDate = evidence.occurrences.at(-1)?.date;
  const rows = [
    { label: 'Scoring window', value: `${formatHistoryDate(evidence.windowStartDate, false)}–${formatHistoryDate(evidence.windowEndDate, false)}` },
    { label: 'Eligible daily occurrences', value: String(evidence.eligibleDueCount) },
    { label: 'Completed', value: String(evidence.completedCount) },
    { label: 'Not completed', value: String(evidence.notCompletedCount) }
  ];
  return (
    <>
      <BreakdownRows rows={rows} />
      <p className="rhythm-history-view__calculation">
        <span>
          {evidence.completedCount} ÷ {evidence.eligibleDueCount} × 100 = <strong>{Math.round(metric.score)}%</strong>
        </span>
      </p>
      <section className="rhythm-history-view__score-details">
        <h4>Your 30-day pattern</h4>
        <div
          className="rhythm-history-view__health-pattern"
          role="img"
          aria-label={`${evidence.eligibleDueCount} eligible daily occurrences from ${evidence.windowStartDate} through ${evidence.windowEndDate}: ${evidence.completedCount} completed and ${evidence.notCompletedCount} not completed.`}
        >
          {evidence.occurrences.map(item => (
            <span
              key={item.date}
              className={item.status === 'completed'
                ? 'rhythm-history-view__health-pattern-day'
                : 'rhythm-history-view__health-pattern-day rhythm-history-view__health-pattern-day--missed'}
              aria-hidden="true"
            />
          ))}
        </div>
        <div className="rhythm-history-view__pattern-legend" aria-hidden="true">
          <span><i className="rhythm-history-view__pattern-key" />{evidence.completedCount} completed</span>
          <span><i className="rhythm-history-view__pattern-key rhythm-history-view__pattern-key--missed" />{evidence.notCompletedCount} not completed</span>
        </div>
        {firstDate && lastDate && (
          <p className="rhythm-history-view__score-explanation">
            {formatHistoryDate(firstDate, false)}–{formatHistoryDate(lastDate, false)}. Today is excluded.
          </p>
        )}
      </section>
    </>
  );
}

function OnTrackScoreBreakdown({ metric }: { metric: ScoredOnTrackMetric }) {
  const evidence = metric.evidence;
  const fullOverdueDays = evidence.overdueDates.length;
  const startingScore = 100;
  const deductedPoints = evidence.deduction;
  const rows = [
    { label: 'Last tended', value: evidence.lastQualifyingCompletionDate
      ? formatHistoryDate(evidence.lastQualifyingCompletionDate, false)
      : 'None yet' },
    { label: 'Full overdue days', value: `${fullOverdueDays} days` },
    { label: 'Daily deduction', value: `${evidence.pointsPerOverdueDate} points` },
    { label: 'Today', value: 'No deduction' }
  ];
  return (
    <>
      <BreakdownRows rows={rows} />
      <p className="rhythm-history-view__calculation">
        <span>
          {startingScore} − {deductedPoints} = <strong>{metric.score}</strong>
        </span>
      </p>
      <section className="rhythm-history-view__score-details">
        <h4>How it changed</h4>
        <ol className="rhythm-history-view__score-history" aria-label="Daily On Track changes">
          {evidence.days.map(item => (
            <li key={item.date}>
              <span>
                {formatHistoryDate(item.date, false)} · {
                  item.status === 'tended' && item.date === evidence.days.at(-1)?.date
                    ? 'tended today'
                    : item.status === 'tended'
                      ? 'tended'
                      : item.status === 'today'
                        ? 'today · no deduction'
                        : 'not tended'
                }
              </span>
              <strong>{item.score}</strong>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

function UnscoredBreakdown({ metric }: { metric: UnscoredMetric }) {
  return (
    <section className="rhythm-history-view__score-details">
      <p className="rhythm-history-view__score-explanation">{metric.explanation}</p>
    </section>
  );
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

function formatHistoryDate(value: string, long = true): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', long
    ? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
    : { month: 'short', day: 'numeric' });
}

function formatScoreInput(score: number): string {
  return String(Number(score.toFixed(2)));
}

function HealthCalculation({
  consistency,
  onTrack,
  health
}: {
  consistency?: number | undefined;
  onTrack?: number | undefined;
  health?: number | undefined;
}) {
  const available = consistency !== undefined && onTrack !== undefined && health !== undefined;
  return (
    <section className="rhythm-history-view__health-calculation" aria-label="How Health is calculated">
      <h4>How Health is calculated</h4>
      {available ? (
        <>
          <p>
            Consistency: {formatScoreInput(consistency)} × {HEALTH_CONSISTENCY_WEIGHT * 100}% ={' '}
            {formatScoreInput(consistency * HEALTH_CONSISTENCY_WEIGHT)}
          </p>
          <p>
            On Track: {formatScoreInput(onTrack)} × {HEALTH_ON_TRACK_WEIGHT * 100}% ={' '}
            {formatScoreInput(onTrack * HEALTH_ON_TRACK_WEIGHT)}
          </p>
          <p className="rhythm-history-view__health-calculation-result">
            Health: {formatScoreInput(consistency * HEALTH_CONSISTENCY_WEIGHT)} +{' '}
            {formatScoreInput(onTrack * HEALTH_ON_TRACK_WEIGHT)} = <strong>{formatScoreInput(health)}</strong>
          </p>
        </>
      ) : (
        <p>Not enough data to calculate Health.</p>
      )}
    </section>
  );
}

function formatLocalTime(value: string): string {
  const [hourText, minute] = value.split(':');
  const hour = Number(hourText);
  return `${hour % 12 || 12}:${minute} ${hour < 12 ? 'AM' : 'PM'}`;
}
