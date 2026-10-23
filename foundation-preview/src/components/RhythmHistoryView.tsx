import { useEffect, useId, useRef, useState } from 'react';
import type { PersonId, PersonPreview, RhythmPreview } from '../domain/preview-data.ts';
import { orderedCompletions } from '../domain/preview-data.ts';
import type { RhythmCompletion } from '../domain/preview-data.ts';
import type { DatedRhythmCompletion, RhythmCompletionRecord } from '../domain/rhythm-completion.ts';
import {
  prepareCompletionHistory,
  prepareRhythmScoreExample,
  rhythmScoreExampleFor,
  unavailableRhythmScoreExample
} from '../domain/rhythm-history.ts';
import type { PreparedRhythmScoreExample } from '../domain/rhythm-history.ts';
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
  onUpdateCompletion?: (record: RhythmCompletionRecord) => string | null;
  onDeleteCompletion?: (completionId: string) => string | null;
}) {
  const scoreFixture = rhythmScoreExampleFor(rhythm.id);
  const scoreExample = scoreFixture
    ? prepareRhythmScoreExample(scoreFixture)
    : unavailableRhythmScoreExample;
  const historyRecords: readonly RhythmCompletion[] | undefined =
    rhythm.completionHistory === undefined && !completionHistoryAvailable && datedCompletions.length === 0
      ? undefined
      : [...(rhythm.completionHistory ?? []), ...datedCompletions];
  const completions = prepareCompletionHistory(historyRecords);
  const historyViewRef = useRef<HTMLElement>(null);
  const loggedMomentsSummaryRef = useRef<HTMLElement>(null);
  const editButtonsRef = useRef(new Map<string, HTMLButtonElement>());
  const deleteButtonsRef = useRef(new Map<string, HTMLButtonElement>());
  const deleteCancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousEditingIdRef = useRef<string | null>(null);
  const previousDeleteIdRef = useRef<string | null>(null);
  const scoreDetailsId = useId();
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
              <span className={scoreExample.healthScore === null ? 'is-unavailable' : undefined}>
                {scoreExample.healthScore === null ? '—' : Math.round(scoreExample.healthScore)}
              </span>
            </div>
            <HealthScoreMeter score={scoreExample.healthScore} />
            <p className="rhythm-history-view__health-caption">
              {scoreExample.healthScore === null ? 'Not enough data.' : '75% Consistency · 25% On Track'}
            </p>
          </div>
          <div className="rhythm-history-view__score-grid">
            <RhythmMetricSummary
              name="consistency"
              metric={scoreExample.consistency}
              copy={metricCopy.consistency}
            />
            <RhythmMetricSummary
              name="onTrack"
              metric={scoreExample.onTrack}
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
            {scoreExample.consistency.kind === 'scored'
              && scoreExample.onTrack.kind === 'scored'
              && scoreExample.healthScore !== null
              ? (
                <p className="rhythm-history-view__blended-calculation">
                  <span>Health calculation: </span>
                  {formatScoreInput(scoreExample.consistency.exactPercent)} × 75% + {formatScoreInput(scoreExample.onTrack.score)} × 25% ={' '}
                  <strong>{Math.round(scoreExample.healthScore)}</strong>
                </p>
              )
              : (
                <p className="rhythm-history-view__blended-unavailable">Not enough data to calculate Health.</p>
              )}
            <div className="rhythm-history-view__score-details-columns">
            <div className="rhythm-history-view__score-details-column">
              {scoreExample.consistency.kind === 'scored'
                ? <ConsistencyScoreBreakdown metric={scoreExample.consistency} />
                : <UnscoredBreakdown metric={scoreExample.consistency} />}
            </div>
            <div className="rhythm-history-view__score-details-column">
              {scoreExample.onTrack.kind === 'scored'
                ? <OnTrackScoreBreakdown metric={scoreExample.onTrack} />
                : <UnscoredBreakdown metric={scoreExample.onTrack} />}
            </div>
            </div>
          </div>
        </div>
        <p className="rhythm-history-view__sample-notice">
          {scoreFixture
            ? `Illustrative example · not from saved logs · as of ${formatHistoryDate(scoreExample.asOfDate, false)}, ${new Date(`${scoreExample.asOfDate}T12:00:00`).getFullYear()}.`
              : 'Illustrative breakdown unavailable for this Rhythm.'}
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

type ScoreMetric = PreparedRhythmScoreExample['consistency'] | PreparedRhythmScoreExample['onTrack'];
type ScoredConsistencyMetric = Extract<PreparedRhythmScoreExample['consistency'], { kind: 'scored' }>;
type ScoredOnTrackMetric = Extract<PreparedRhythmScoreExample['onTrack'], { kind: 'scored' }>;
type UnavailableScoreMetric = Extract<ScoreMetric, { kind: 'unscored' | 'unavailable' }>;

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
        score={metric.kind === 'scored' ? metric.score : null}
        state={metric.kind}
      />
      <p className="rhythm-history-view__short-description">{copy.shortDescription}</p>
    </section>
  );
}

export function HealthScoreMeter({ score }: { score: number | null }) {
  const available = score !== null;
  return (
    <div
      className={`rhythm-history-view__health-meter ${scoreTone(score)}`}
      role={available ? 'meter' : 'img'}
      aria-label={available ? 'Health score' : 'Health: Not enough data'}
      aria-valuemin={available ? 0 : undefined}
      aria-valuemax={available ? 100 : undefined}
      aria-valuenow={score ?? undefined}
      aria-valuetext={available ? `${Math.round(score)} out of 100, illustrative blend` : undefined}
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
  const firstDate = metric.occurrences[0]?.date;
  const lastDate = metric.occurrences.at(-1)?.date;
  const rows = [
    { label: 'Looking back', value: '30 days' },
    { label: 'Scheduled', value: `${metric.eligibleDueCount} moments` },
    { label: 'Completed', value: `${metric.completedCount} moments` },
    { label: 'Not completed', value: `${metric.notCompletedCount} moments` }
  ];
  return (
    <>
      <BreakdownRows rows={rows} />
      <p className="rhythm-history-view__calculation">
        <span>
          {metric.completedCount} ÷ {metric.eligibleDueCount} × 100 = <strong>{metric.score}%</strong>
        </span>
      </p>
      <section className="rhythm-history-view__score-details">
        <h4>Your 30-day pattern</h4>
        <div
          className="rhythm-history-view__health-pattern"
          role="img"
          aria-label={`Thirty eligible daily due moments: ${metric.completedCount} completed and ${metric.notCompletedCount} not completed.`}
        >
          {metric.occurrences.map(item => (
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
          <span><i className="rhythm-history-view__pattern-key" />{metric.completedCount} completed</span>
          <span><i className="rhythm-history-view__pattern-key rhythm-history-view__pattern-key--missed" />{metric.notCompletedCount} not completed</span>
        </div>
        {firstDate && lastDate && (
          <p className="rhythm-history-view__score-explanation">
            {formatHistoryDate(firstDate, false)}–{formatHistoryDate(lastDate, false)}. The example’s as-of date is not included as a due occurrence.
          </p>
        )}
      </section>
    </>
  );
}

function OnTrackScoreBreakdown({ metric }: { metric: ScoredOnTrackMetric }) {
  const fullOverdueDays = metric.fullOverdueDates.length;
  const startingScore = metric.days.find(item => item.status === 'tended')?.score ?? metric.score;
  const deductedPoints = fullOverdueDays * metric.pointsPerFullUntendedDay;
  const rows = [
    { label: 'Last tended', value: formatHistoryDate(metric.lastTendedDate, false) },
    { label: 'Full overdue days', value: `${fullOverdueDays} days` },
    { label: 'Daily deduction', value: `${metric.pointsPerFullUntendedDay} points` },
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
        <ol className="rhythm-history-view__score-history" aria-label="Illustrative daily On Track changes">
          {metric.days.map(item => (
            <li key={item.date}>
              <span>
                {formatHistoryDate(item.date, false)} · {
                  item.status === 'tended'
                    ? 'tended'
                    : item.status === 'as-of'
                      ? 'today in example'
                      : 'not tended'
                }
              </span>
              <strong>{item.status === 'as-of' ? `Still ${item.score}` : item.score}</strong>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

function UnscoredBreakdown({ metric }: { metric: UnavailableScoreMetric }) {
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

function formatLocalTime(value: string): string {
  const [hourText, minute] = value.split(':');
  const hour = Number(hourText);
  return `${hour % 12 || 12}:${minute} ${hour < 12 ? 'AM' : 'PM'}`;
}
