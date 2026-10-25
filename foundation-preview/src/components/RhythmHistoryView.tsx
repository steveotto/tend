import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import {
  latestOnTrackHistoryEntries,
  onTrackHistoryDisplayEntries
} from '../domain/rhythm-score-presentation.ts';
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

const occurrenceKindByFrequency = {
  daily: 'eligible day',
  weekly: 'scheduled day',
  monthly: 'due date',
  quarterly: 'due date',
  yearly: 'due date'
} as const;

const metricCopy = {
  consistency: {
    title: 'Consistency',
    shortDescription: 'How often you show up'
  },
  onTrack: {
    title: 'On Track',
    shortDescription: 'How caught up you are'
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
  onSaveCompletion,
  onUpdateCompletion,
  onDeleteCompletion
}: {
  rhythm: RhythmPreview;
  people?: readonly PersonPreview[];
  onPersonSelect?: (personId: PersonId) => void;
  archived?: boolean;
  onClose?: () => void;
  closeButtonRef?: { current: HTMLButtonElement | null };
  datedCompletions?: readonly DatedRhythmCompletion[];
  completionHistoryAvailable?: boolean;
  onSaveCompletion?: (record: RhythmCompletionRecord) => string | null;
  onUpdateCompletion?: (record: RhythmCompletionRecord) => string | null;
  onDeleteCompletion?: (completionId: string) => string | null;
}) {
  const historyRecords: readonly RhythmCompletion[] | undefined =
    rhythm.completionHistory === undefined && !completionHistoryAvailable && datedCompletions.length === 0
      ? undefined
      : [...(rhythm.completionHistory ?? []), ...datedCompletions];
  const scoringTimeZone = rhythm.scoring?.timeZone
    ?? rhythm.createdTimeZone
    ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
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
  const completions = prepareCompletionHistory(historyRecords, asOfDate);
  const scoringRecords: RhythmCompletionRecord[] = (historyRecords ?? []).map(record => ({
    ...record,
    rhythmId: rhythm.id
  }));
  const score = selectDailyRhythmScore({
    rhythmId: rhythm.id,
    ...(rhythm.cadence ? { cadence: rhythm.cadence } : {}),
    ...(rhythm.schedule ? { schedule: rhythm.schedule } : {}),
    ...(rhythm.scoring ? { scoring: rhythm.scoring } : {}),
    ...(rhythm.createdLocalDate ? { createdLocalDate: rhythm.createdLocalDate } : {}),
    ...(rhythm.createdTimeZone ? { createdTimeZone: rhythm.createdTimeZone } : {}),
    ...(rhythm.dailyBackfillAllowed === undefined ? {} : { dailyBackfillAllowed: rhythm.dailyBackfillAllowed }),
    records: scoringRecords,
    recordsAvailable: completionHistoryAvailable || rhythm.completionHistory !== undefined || datedCompletions.length > 0,
    archived,
    asOfDate,
    timeZone: scoringTimeZone
  });
  const historyViewRef = useRef<HTMLElement>(null);
  const logMomentDialogRef = useRef<HTMLDialogElement>(null);
  const loggedMomentsSummaryRef = useRef<HTMLElement>(null);
  const logMomentButtonRef = useRef<HTMLButtonElement>(null);
  const editButtonsRef = useRef(new Map<string, HTMLButtonElement>());
  const deleteButtonsRef = useRef(new Map<string, HTMLButtonElement>());
  const deleteCancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousEditingIdRef = useRef<string | null>(null);
  const previousLoggingMomentRef = useRef(false);
  const previousDeleteIdRef = useRef<string | null>(null);
  const scoreDetailsId = useId();
  const healthCalculationId = useId();
  const sharedUnscoredExplanation = score.consistency.kind === 'unscored' && score.onTrack.kind === 'unscored'
    && score.consistency.explanation === score.onTrack.explanation;
  const [editingRecord, setEditingRecord] = useState<RhythmCompletionRecord | null>(null);
  const [loggingMoment, setLoggingMoment] = useState(false);
  const [loggedMomentsExpanded, setLoggedMomentsExpanded] = useState(false);
  const [logAnnouncement, setLogAnnouncement] = useState('');
  const [scoreDetailsExpanded, setScoreDetailsExpanded] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [focusAfterDeleteId, setFocusAfterDeleteId] = useState<string | null>(null);
  const hasDescription = Boolean(rhythm.description?.trim());
  const editableRecordIds = new Set((historyRecords ?? []).map(record => record.id));

  function dismissEditingRecord() {
    setEditingRecord(null);
  }

  function dismissLoggingMoment() {
    setLoggingMoment(false);
  }

  useEffect(() => {
    historyViewRef.current?.focus();
  }, []);

  useEffect(() => {
    setScoreDetailsExpanded(false);
  }, [rhythm.id]);

  useEffect(() => {
    const previousId = previousEditingIdRef.current;
    if (previousId && !editingRecord) {
      editButtonsRef.current.get(previousId)?.focus();
    }
    previousEditingIdRef.current = editingRecord?.id ?? null;
  }, [editingRecord]);

  useEffect(() => {
    if (previousLoggingMomentRef.current && !loggingMoment) {
      logMomentButtonRef.current?.focus();
    }
    previousLoggingMomentRef.current = loggingMoment;
  }, [loggingMoment]);

  useEffect(() => {
    if (!loggingMoment) return;
    const dialog = logMomentDialogRef.current;
    if (!dialog) return;
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    dialog.querySelector<HTMLElement>('.rhythm-completion-form__heading')?.focus({ preventScroll: true });
  }, [loggingMoment]);

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
    <>
    <section
      ref={historyViewRef}
      className={`rhythm-history-view${onClose ? ' rhythm-history-view--dialog' : ''}`}
      role="region"
      aria-label={`History for ${rhythm.title}`}
      tabIndex={-1}
      inert={loggingMoment}
    >
      <header className="rhythm-history-view__rhythm-header">
        <div className="rhythm-history-view__title-row">
          <div className="rhythm-history-view__title-copy">
            <h3 id="rhythm-details-title">{rhythm.title}</h3>
          </div>
        </div>
        {onClose && (
          <button
            ref={closeButtonRef}
            type="button"
            className="today-rhythm-details__close today-rhythm-details__close--history"
            aria-label={editingRecord ? 'Cancel editing logged moment' : 'Close details'}
            onClick={editingRecord ? dismissEditingRecord : onClose}
          >
            ×
          </button>
        )}
      </header>
      <div className={`rhythm-history-view__body${onClose ? ' rhythm-history-view__body--dialog' : ''}`}>
      {editingRecord ? (
        <RhythmCompletionForm
          rhythm={rhythm}
          embedded
          headingId="rhythm-history-completion-title"
          initialRecord={editingRecord}
          onSave={record => onUpdateCompletion
            ? onUpdateCompletion(record)
            : 'This logged moment can no longer be edited.'}
          onCancel={dismissEditingRecord}
          onSaved={dismissEditingRecord}
        />
      ) : (
        <>
      <div className="rhythm-history-view__metadata">
        {(archived || rhythm.personal) && (
          <div className="rhythm-history-view__badges">
            {archived && <RhythmArchivedBadge />}
            {rhythm.personal && <RhythmPersonalBadge />}
          </div>
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
        {(rhythm.cadence || rhythm.schedule || rhythm.timeLabel) && (
          <p className="rhythm-history-view__schedule">
            <RhythmScheduleSummary
              cadence={rhythm.cadence}
              schedule={rhythm.schedule}
              timeLabel={rhythm.timeLabel}
              presentation="detailed"
            />
          </p>
        )}
      </div>

      <section className="rhythm-history-view__score-section" aria-label="Health, Consistency, and On Track scores">
        <div className="rhythm-history-view__score-card">
          <div className="rhythm-history-view__score-card-controls">
            <button
              type="button"
              className="rhythm-history-view__score-info"
              aria-label={`${scoreDetailsExpanded ? 'Hide' : 'Show'} Consistency and On Track score details`}
              aria-expanded={scoreDetailsExpanded}
              aria-controls={`${healthCalculationId} ${scoreDetailsId}`}
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
          <div
            id={healthCalculationId}
            className="rhythm-history-view__health-calculation-disclosure"
            hidden={!scoreDetailsExpanded}
          >
            {score.consistency.kind === 'scored'
              && score.onTrack.kind === 'scored'
              && score.healthScore !== null
              ? (
                <HealthCalculation />
              )
              : (
                <HealthCalculation
                  explanation={healthUnavailableExplanation(score.consistency, score.onTrack)}
                />
              )}
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
            {sharedUnscoredExplanation ? null : (
              <div className="rhythm-history-view__score-details-columns">
                <div className="rhythm-history-view__score-details-column">
                  {score.consistency.kind === 'scored'
                    ? <ConsistencyScoreBreakdown metric={score.consistency} />
                    : <UnscoredBreakdown metric={score.consistency} />}
                </div>
                <div className="rhythm-history-view__score-details-column">
                  {score.onTrack.kind === 'scored'
                    ? <OnTrackScoreBreakdown key={rhythm.id} metric={score.onTrack} />
                    : <UnscoredBreakdown metric={score.onTrack} />}
                </div>
              </div>
            )}
          </div>
        </div>
        <p className="rhythm-history-view__sample-notice" role="status">
          {score.kind === 'rhythm-score'
            ? score.healthScore !== null
              ? `Calculated from saved completion records · as of ${formatHistoryDate(score.asOfDate, false)}, ${new Date(`${score.asOfDate}T12:00:00`).getFullYear()}.`
              : `${score.consistency.kind === 'unscored' ? `Consistency: ${score.consistency.explanation}` : ''}${score.consistency.kind === 'unscored' && score.onTrack.kind === 'unscored' ? ' ' : ''}${score.onTrack.kind === 'unscored' ? `On Track: ${score.onTrack.explanation}` : ''} Health requires both scores.`
            : score.kind === 'invalid'
              ? `Scores unavailable: ${score.reason}`
              : score.reason.explanation}
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
          todayDate={asOfDate}
        />
        {completions.kind === 'unavailable' && (
          <p className="rhythm-history-view__empty">Dated completion history is unavailable for this Rhythm.</p>
        )}
        {completions.kind === 'empty' && (
          <p className="rhythm-history-view__empty rhythm-history-view__empty-notice">
            Your story starts with the first Tend.
          </p>
        )}
        <details
          className="rhythm-history-view__logged-moments"
          open={loggedMomentsExpanded}
          onToggle={event => setLoggedMomentsExpanded(event.currentTarget.open)}
        >
          <summary ref={loggedMomentsSummaryRef}>Logged moments ({completions.kind === 'recorded' ? completions.count : 0})</summary>
          {onSaveCompletion && (
            <div className="rhythm-history-view__log-moment-row">
              <button
                ref={logMomentButtonRef}
                type="button"
                className="button button-secondary rhythm-history-view__log-moment"
                onClick={() => {
                  setLogAnnouncement('');
                  setLoggedMomentsExpanded(true);
                  setLoggingMoment(true);
                }}
              >
                + Log a moment
              </button>
            </div>
          )}
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
        {logAnnouncement && (
          <p className="visually-hidden" role="status" aria-live="polite">{logAnnouncement}</p>
        )}
      </section>
      {loggingMoment && onSaveCompletion && createPortal(
        <dialog
          ref={logMomentDialogRef}
          className="rhythm-history-view__log-dialog"
          aria-labelledby="rhythm-history-completion-title"
          aria-modal="true"
          onClick={event => {
            if (event.target === event.currentTarget) dismissLoggingMoment();
          }}
          onCancel={event => {
            event.preventDefault();
            dismissLoggingMoment();
          }}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              dismissLoggingMoment();
              return;
            }
            if (event.key !== 'Tab') return;
            const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            ));
            if (!focusable.length) {
              event.preventDefault();
              event.currentTarget.focus();
              return;
            }
            const first = focusable[0]!;
            const last = focusable[focusable.length - 1]!;
            if (event.shiftKey && (document.activeElement === first || !event.currentTarget.contains(document.activeElement))) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || !event.currentTarget.contains(document.activeElement))) {
              event.preventDefault();
              first.focus();
            }
          }}
        >
          <header className="rhythm-history-view__log-dialog-header">
            <button
              type="button"
              className="today-rhythm-details__close"
              aria-label="Cancel logging moment"
              onClick={dismissLoggingMoment}
            >
              ×
            </button>
          </header>
          <RhythmCompletionForm
            rhythm={rhythm}
            embedded
            headingId="rhythm-history-completion-title"
            onSave={onSaveCompletion}
            onCancel={dismissLoggingMoment}
            onSaved={() => {
              dismissLoggingMoment();
              setLogAnnouncement('Moment logged.');
            }}
          />
        </dialog>,
        document.body
      )}

          </>
        )}
        </div>
      </section>
      </>
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
    { label: 'Dates', value: `${formatHistoryDate(evidence.windowStartDate, false)}–${formatHistoryDate(evidence.windowEndDate, false)}` },
    { label: 'Completed', value: String(evidence.completedCount) },
    { label: 'Scheduled', value: String(evidence.eligibleDueCount) }
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
        <h4>Your scheduled pattern</h4>
        <div
          className="rhythm-history-view__health-pattern"
          role="list"
          aria-label={`${evidence.eligibleDueCount} eligible ${evidence.frequency} occurrences from ${evidence.windowStartDate} through ${evidence.windowEndDate}: ${evidence.completedCount} completed and ${evidence.notCompletedCount} not completed.`}
        >
          {evidence.occurrences.map(item => (
            <span
              key={item.date}
              role="listitem"
              aria-label={`${formatHistoryDate(item.date, true)}: ${item.status === 'completed' ? 'completed' : 'not completed'} ${
                occurrenceKindByFrequency[evidence.frequency]
              }`}
              className={item.status === 'completed'
                ? 'rhythm-history-view__health-pattern-day'
                : 'rhythm-history-view__health-pattern-day rhythm-history-view__health-pattern-day--missed'}
            />
          ))}
        </div>
        <div className="rhythm-history-view__pattern-legend" aria-hidden="true">
          <span><i className="rhythm-history-view__pattern-key" />{evidence.completedCount} completed</span>
          <span><i className="rhythm-history-view__pattern-key rhythm-history-view__pattern-key--missed" />{evidence.notCompletedCount} not completed</span>
        </div>
        {firstDate && lastDate && (
          <p className="rhythm-history-view__score-explanation">
            {evidence.limitedHistoryDays !== null
              ? `Based on ${evidence.limitedHistoryDays} ${evidence.limitedHistoryDays === 1 ? 'day' : 'days'} of tracking. `
              : ''}
            {formatHistoryDate(firstDate, false)}–{formatHistoryDate(lastDate, false)}. {
              evidence.frequency === 'daily'
                ? evidence.todayIncluded ? 'Today’s completed occurrence is included.' : 'Today is pending and excluded.'
                : 'Today is excluded.'
            }
          </p>
        )}
      </section>
    </>
  );
}

function OnTrackScoreBreakdown({ metric }: { metric: ScoredOnTrackMetric }) {
  const evidence = metric.evidence;
  const historyId = useId();
  const showEarlierButtonRef = useRef<HTMLButtonElement>(null);
  const showLessButtonRef = useRef<HTMLButtonElement>(null);
  const focusAfterDisclosureRef = useRef<'earlier' | 'less' | null>(null);
  const entries = onTrackHistoryDisplayEntries(evidence);
  const [visibleEntryCount, setVisibleEntryCount] = useState(5);
  const isExpanded = visibleEntryCount > 5;
  const visibleEntries = latestOnTrackHistoryEntries(entries, visibleEntryCount);
  const startingScore = 100;
  const deductedPoints = evidence.deduction;
  const rows = [
    { label: 'Last tended', value: evidence.lastQualifyingCompletionDate
      ? formatHistoryDate(evidence.lastQualifyingCompletionDate, false)
      : 'None yet' },
    { label: 'Full overdue days', value: `${evidence.overdueCount} days` },
    { label: 'Daily deduction', value: `${evidence.pointsPerOverdueDate} points` }
  ];
  useEffect(() => {
    if (focusAfterDisclosureRef.current === 'earlier') showEarlierButtonRef.current?.focus();
    if (focusAfterDisclosureRef.current === 'less') showLessButtonRef.current?.focus();
    focusAfterDisclosureRef.current = null;
  }, [visibleEntryCount]);
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
        <ol id={historyId} className="rhythm-history-view__score-history" aria-label="On Track score changes">
          {visibleEntries.map(item => (
            <li key={item.key} className={`rhythm-history-view__score-history-entry--${item.kind}`}>
              <span>{onTrackHistoryEntryLabel(item, item.kind === 'day'
                && item.date === evidence.days.at(-1)?.date)}</span>
              <strong>{item.score}</strong>
            </li>
          ))}
        </ol>
        {(visibleEntryCount < entries.length || isExpanded) && (
          <div className="rhythm-history-view__score-history-controls">
            {visibleEntryCount < entries.length && (
              <button
                ref={showEarlierButtonRef}
                type="button"
                className="rhythm-history-view__score-history-toggle"
                aria-controls={historyId}
                aria-expanded={isExpanded}
                onClick={() => {
                  const nextCount = Math.min(visibleEntryCount + 5, entries.length);
                  if (nextCount === entries.length) focusAfterDisclosureRef.current = 'less';
                  setVisibleEntryCount(nextCount);
                }}
              >
                Show earlier steps
              </button>
            )}
            {isExpanded && (
              <button
                ref={showLessButtonRef}
                type="button"
                className="rhythm-history-view__score-history-toggle"
                aria-controls={historyId}
                aria-expanded={isExpanded}
                onClick={() => {
                  focusAfterDisclosureRef.current = 'earlier';
                  setVisibleEntryCount(5);
                }}
              >
                Show less
              </button>
            )}
          </div>
        )}
      </section>
    </>
  );
}

function onTrackHistoryEntryLabel(
  entry: ReturnType<typeof onTrackHistoryDisplayEntries>[number],
  isCurrentDay: boolean
): string {
  if (entry.kind === 'schedule-change') {
    return `${formatHistoryDate(entry.date, true)} · schedule changed`;
  }
  if (entry.kind === 'zero-score-span') {
    const unit = entry.occurrenceCount === 1 ? 'scheduled day' : 'earlier scheduled days';
    return `${entry.occurrenceCount} ${unit} at 0 · ${formatHistoryDate(entry.startDate, false)}–${formatHistoryDate(entry.endDate, false)}`;
  }
  const status = entry.status === 'tended'
    ? isCurrentDay ? 'tended today · current state' : 'tended · reset'
    : entry.status === 'today'
      ? 'today · current state'
      : 'not tended · deduction';
  return `${formatHistoryDate(entry.date, false)} · ${status}`;
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

function HealthCalculation({ explanation }: { explanation?: string }) {
  const consistencyWeight = HEALTH_CONSISTENCY_WEIGHT * 100;
  const onTrackWeight = HEALTH_ON_TRACK_WEIGHT * 100;
  const titleId = useId();
  const descriptionId = useId();
  return (
    <section
      className="rhythm-history-view__health-calculation"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div className="rhythm-history-view__health-calculation-heading">
        <h4 id={titleId}>How your Health score is calculated</h4>
      </div>
      <p id={descriptionId} className="visually-hidden">
        Health is weighted {consistencyWeight} percent Consistency and {onTrackWeight} percent On Track.
        These are fixed formula weights, not this Rhythm&apos;s current scores.
      </p>
      <div className="rhythm-history-view__health-weight-panels">
        <div className="rhythm-history-view__health-weight-panel rhythm-history-view__health-weight-panel--consistency">
          <div className="rhythm-history-view__health-weight-value">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
              <path d="M8 3.5v4M16 3.5v4M3.5 9.5h17m-11 5 2 2 4-4" />
            </svg>
            <strong>{consistencyWeight}%</strong>
          </div>
          <span className="rhythm-history-view__health-weight-name">Consistency</span>
          <span className="rhythm-history-view__health-weight-subtitle">Your longer-term pattern.</span>
        </div>
        <div className="rhythm-history-view__health-weight-panel rhythm-history-view__health-weight-panel--on-track">
          <div className="rhythm-history-view__health-weight-value">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="12" cy="12" r="8" />
              <path d="M12 7v5l3 2" />
            </svg>
            <strong>{onTrackWeight}%</strong>
          </div>
          <span className="rhythm-history-view__health-weight-name">On Track</span>
          <span className="rhythm-history-view__health-weight-subtitle">Up to date</span>
        </div>
      </div>
      {explanation && (
        <p className="rhythm-history-view__health-unavailable">{explanation}</p>
      )}
    </section>
  );
}

function healthUnavailableExplanation(
  consistency: ScoredConsistencyMetric | UnscoredMetric,
  onTrack: ScoredOnTrackMetric | UnscoredMetric
): string {
  const reasons = [
    ...(consistency.kind === 'unscored' ? [`Consistency: ${consistency.explanation}`] : []),
    ...(onTrack.kind === 'unscored' ? [`On Track: ${onTrack.explanation}`] : [])
  ];
  return `Health requires both scores. ${reasons.join(' ')}`;
}

function formatLocalTime(value: string): string {
  const [hourText, minute] = value.split(':');
  const hour = Number(hourText);
  return `${hour % 12 || 12}:${minute} ${hour < 12 ? 'AM' : 'PM'}`;
}
