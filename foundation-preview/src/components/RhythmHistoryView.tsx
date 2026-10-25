import { useEffect, useId, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { PersonId, PersonPreview, RhythmPreview } from '../domain/preview-data.ts';
import { orderedCompletions } from '../domain/preview-data.ts';
import type { RhythmCompletion } from '../domain/preview-data.ts';
import type { DatedRhythmCompletion, RhythmCompletionRecord } from '../domain/rhythm-completion.ts';
import type {
  RhythmScheduleHistorySegment,
  RhythmScheduleSegment
} from '../domain/rhythm-schedule.ts';
import type { RhythmSeasonEditDraft } from '../domain/rhythm-season-edit.ts';
import type { RhythmSeasonDeletionUndo } from '../domain/rhythm-season-delete.ts';
import {
  prepareCompletionHistory,
  HEALTH_CONSISTENCY_WEIGHT,
  HEALTH_ON_TRACK_WEIGHT
} from '../domain/rhythm-history.ts';
import {
  localDateInTimeZone,
  selectRhythmScore
} from '../domain/rhythm-scoring.ts';
import { formatRhythmSchedule, rhythmTimeOptions } from '../domain/rhythm-schedule.ts';
import {
  rhythmSeasonInclusiveEndDate,
  rhythmSeasonPaletteForId
} from '../domain/rhythm-seasons.ts';
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
import { RhythmMetadataIcon } from './RhythmMetadataIcon.tsx';
import { RhythmPersonalBadge } from './RhythmPersonalBadge.tsx';
import { RhythmScoreCircle } from './RhythmScoreCircle.tsx';
import { RhythmCompletionHistoryChart } from './RhythmCompletionHistoryChart.tsx';
import { RhythmCompletionForm } from './RhythmCompletionForm.tsx';
import { RhythmCategoryBadges } from './RhythmCategoryBadges.tsx';
import { RhythmSeasonCorrectionDialog } from './RhythmSeasonCorrectionDialog.tsx';
import type { RhythmSeasonEditDialogDraft } from './RhythmSeasonCorrectionDialog.tsx';
import { RhythmSeasonDeleteDialog } from './RhythmSeasonDeleteDialog.tsx';

type MetricName = 'consistency' | 'onTrack';

const occurrenceKindByFrequency = {
  daily: 'eligible day',
  weekly: 'scheduled day',
  monthly: 'due date',
  quarterly: 'due date',
  yearly: 'due date',
  custom: 'scheduled occurrence'
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
  onDeleteCompletion,
  onChooseSchedule,
  onEditSeason,
  onDeleteSeason,
  seasonDeletionUndo,
  onUndoSeasonDeletion
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
  onChooseSchedule?: (event: MouseEvent<HTMLButtonElement>) => void;
  onEditSeason?: (rhythmId: string, draft: RhythmSeasonEditDraft) => string | null;
  onDeleteSeason?: (rhythmId: string, seasonId: string) => string | null;
  seasonDeletionUndo?: RhythmSeasonDeletionUndo | null;
  onUndoSeasonDeletion?: () => string | null;
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
  const scoringInput = {
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
  } as const;
  const score = selectRhythmScore(scoringInput);
  const scheduleConversionHandler = !rhythm.schedule && rhythm.cadence !== 'Daily'
    ? onChooseSchedule
    : undefined;
  const historyViewRef = useRef<HTMLElement>(null);
  const historyBodyRef = useRef<HTMLDivElement>(null);
  const logMomentDialogRef = useRef<HTMLDialogElement>(null);
  const loggedMomentsSummaryRef = useRef<HTMLElement>(null);
  const logMomentButtonRef = useRef<HTMLButtonElement>(null);
  const editButtonsRef = useRef(new Map<string, HTMLButtonElement>());
  const seasonEditButtonsRef = useRef(new Map<string, HTMLButtonElement>());
  const seasonCardRefs = useRef(new Map<string, HTMLElement>());
  const seasonEditOpenerRef = useRef<HTMLButtonElement | null>(null);
  const seasonDeleteOpenerRef = useRef<HTMLButtonElement | null>(null);
  const seasonUndoButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonsRef = useRef(new Map<string, HTMLButtonElement>());
  const deleteCancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousEditingIdRef = useRef<string | null>(null);
  const previousLoggingMomentRef = useRef(false);
  const previousDeleteIdRef = useRef<string | null>(null);
  const scoreDetailsId = useId();
  const healthCalculationId = useId();
  const seasonsDisclosureId = useId();
  const seasonsContentId = useId();
  const [seasonsDisclosure, setSeasonsDisclosure] = useState({
    rhythmId: rhythm.id,
    expanded: false
  });
  const seasonsInfoExpanded = seasonsDisclosure.rhythmId === rhythm.id && seasonsDisclosure.expanded;
  const [expandedEarlierSeasonIds, setExpandedEarlierSeasonIds] = useState<Set<string>>(() => new Set());
  const scheduleSeasons = rhythm.scoring?.scheduleHistory ?? [];
  const availableSeasonUndo = seasonDeletionUndo?.rhythmId === rhythm.id ? seasonDeletionUndo : null;
  const knownSeasonCount = scheduleSeasons.filter(season => season.kind === 'scheduled').length
    || (scheduleSeasons.length === 0 && rhythm.schedule ? 1 : 0);
  const unknownSeason = scheduleSeasons.find(season => season.kind === 'unknown');
  const sharedUnscoredExplanation = score.consistency.kind === 'unscored' && score.onTrack.kind === 'unscored'
    && score.consistency.explanation === score.onTrack.explanation;
  const [editingRecord, setEditingRecord] = useState<RhythmCompletionRecord | null>(null);
  const [loggingMoment, setLoggingMoment] = useState(false);
  const [loggedMomentsExpanded, setLoggedMomentsExpanded] = useState(false);
  const [logAnnouncement, setLogAnnouncement] = useState('');
  const [scoreDetailsExpanded, setScoreDetailsExpanded] = useState(false);
  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null);
  const [pendingSeasonEditDraft, setPendingSeasonEditDraft] = useState<{
    seasonId: string;
    draft: RhythmSeasonEditDialogDraft;
  } | null>(null);
  const [deletingSeasonId, setDeletingSeasonId] = useState<string | null>(null);
  const [seasonUndoError, setSeasonUndoError] = useState('');
  const [seasonDeleteStatus, setSeasonDeleteStatus] = useState('');
  const [focusRestoredSeasonId, setFocusRestoredSeasonId] = useState<string | null>(null);
  const seasonDeletionSavedRef = useRef(false);
  const transitioningToDeleteRef = useRef(false);
  const previousDeletingSeasonIdRef = useRef<string | null>(null);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [focusAfterDeleteId, setFocusAfterDeleteId] = useState<string | null>(null);
  useEffect(() => {
    setSeasonsDisclosure({ rhythmId: rhythm.id, expanded: false });
  }, [rhythm.id]);
  const hasDescription = Boolean(rhythm.description?.trim());
  const editableRecordIds = new Set((historyRecords ?? []).map(record => record.id));
  const editingSeason = scheduleSeasons.find(season => season.id === editingSeasonId);
  const deletingSeason = scheduleSeasons.find(season => season.id === deletingSeasonId);
  const editingSeasonIndex = editingSeason
    ? scheduleSeasons.findIndex(season => season.id === editingSeason.id)
    : -1;
  const editingSeasonPrevious = editingSeasonIndex > 0 ? scheduleSeasons[editingSeasonIndex - 1] : undefined;
  const canDeleteEditingSeason = !archived
    && Boolean(onDeleteSeason)
    && editingSeason?.kind === 'scheduled'
    && editingSeasonIndex > 0
    && editingSeasonPrevious?.kind === 'scheduled';
  const editingSeasonDeleteRestriction = editingSeasonIndex === 0
    ? 'The first Season cannot be deleted.'
    : editingSeason?.kind === 'unknown'
      ? 'An unknown-history interval cannot be deleted until its schedule is set.'
      : editingSeasonPrevious?.kind === 'unknown'
        ? 'This Season cannot be deleted until the earlier schedule is set.'
        : 'This Season cannot be deleted.';

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

  useEffect(() => {
    if (!editingSeasonId) {
      if (transitioningToDeleteRef.current) transitioningToDeleteRef.current = false;
      else if (!pendingSeasonEditDraft) seasonEditOpenerRef.current?.focus();
    }
  }, [editingSeasonId, pendingSeasonEditDraft]);

  useEffect(() => {
    if (previousDeletingSeasonIdRef.current && !deletingSeasonId) {
      if (seasonDeletionSavedRef.current) {
        seasonUndoButtonRef.current?.focus();
        seasonDeletionSavedRef.current = false;
      } else if (!pendingSeasonEditDraft) {
        seasonDeleteOpenerRef.current?.focus();
      }
    }
    previousDeletingSeasonIdRef.current = deletingSeasonId;
  }, [deletingSeasonId, availableSeasonUndo, pendingSeasonEditDraft]);

  useEffect(() => {
    if (!focusRestoredSeasonId || availableSeasonUndo?.season.id === focusRestoredSeasonId) return;
    (seasonEditButtonsRef.current.get(focusRestoredSeasonId)
      ?? historyViewRef.current)?.focus();
    setFocusRestoredSeasonId(null);
  }, [focusRestoredSeasonId, availableSeasonUndo, scheduleSeasons]);

  function openSeasonEditor(season: RhythmScheduleHistorySegment, opener: HTMLButtonElement) {
    seasonEditOpenerRef.current = opener;
    setEditingSeasonId(season.id);
  }

  function confirmSeasonDeletion(rhythmId: string, seasonId: string): string | null {
    if (!onDeleteSeason) return 'Season deletion is unavailable.';
    const error = onDeleteSeason(rhythmId, seasonId);
    if (!error) {
      seasonDeletionSavedRef.current = true;
      setPendingSeasonEditDraft(null);
      setSeasonDeleteStatus('Season removed. Logged moments were preserved.');
      setSeasonUndoError('');
    }
    return error;
  }

  function requestSeasonDeletion(seasonId: string, draft: RhythmSeasonEditDialogDraft) {
    seasonDeleteOpenerRef.current = seasonEditOpenerRef.current;
    setPendingSeasonEditDraft({ seasonId, draft });
    transitioningToDeleteRef.current = true;
    setEditingSeasonId(null);
    setDeletingSeasonId(seasonId);
  }

  function closeSeasonEditor() {
    setEditingSeasonId(null);
    setPendingSeasonEditDraft(null);
  }

  function closeSeasonDeleteDialog() {
    setDeletingSeasonId(null);
    if (!seasonDeletionSavedRef.current && pendingSeasonEditDraft) {
      setEditingSeasonId(pendingSeasonEditDraft.seasonId);
    } else {
      setPendingSeasonEditDraft(null);
    }
  }

  function undoSeasonDeletion() {
    if (!onUndoSeasonDeletion || !availableSeasonUndo) return;
    const restoredId = availableSeasonUndo.season.id;
    const error = onUndoSeasonDeletion();
    if (error) {
      setSeasonUndoError(error);
      return;
    }
    setSeasonDeleteStatus('Season restored. Logged moments were preserved.');
    setSeasonUndoError('');
    setFocusRestoredSeasonId(restoredId);
  }

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
      <div
        ref={historyBodyRef}
        className={`rhythm-history-view__body${onClose ? ' rhythm-history-view__body--dialog' : ''}`}
      >
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
        {(archived || rhythm.personal) && (
          <div className="rhythm-history-view__badges">
            {archived && <RhythmArchivedBadge />}
            {rhythm.personal && <RhythmPersonalBadge />}
          </div>
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
            {sharedUnscoredExplanation
              ? scheduleConversionHandler && score.onTrack.kind === 'unscored'
                ? (
                  <div className="rhythm-history-view__score-details-columns">
                    <div className="rhythm-history-view__score-details-column">
                      <UnscoredBreakdown
                        metric={score.onTrack}
                        onChooseSchedule={scheduleConversionHandler}
                      />
                    </div>
                  </div>
                )
                : null
              : (
              <div className="rhythm-history-view__score-details-columns">
                <div className="rhythm-history-view__score-details-column">
                  {score.consistency.kind === 'scored'
                    ? <ConsistencyScoreBreakdown metric={score.consistency} />
                    : (
                      <UnscoredBreakdown
                        metric={score.consistency}
                        {...(scheduleConversionHandler ? { onChooseSchedule: scheduleConversionHandler } : {})}
                      />
                    )}
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
          {unknownSeason
            ? 'Some earlier dates have no known schedule. Use the action in Seasons to review those logs.'
            : score.kind === 'rhythm-score'
            ? score.healthScore !== null
              ? `Calculated from saved completion records · as of ${formatHistoryDate(score.asOfDate, false)}, ${new Date(`${score.asOfDate}T12:00:00`).getFullYear()}.`
              : `${score.consistency.kind === 'unscored' ? `Consistency: ${score.consistency.explanation}` : ''}${score.consistency.kind === 'unscored' && score.onTrack.kind === 'unscored' ? ' ' : ''}${score.onTrack.kind === 'unscored' ? `On Track: ${score.onTrack.explanation}` : ''} Health requires both scores.`
            : score.kind === 'invalid'
              ? `Scores unavailable: ${score.reason}`
              : score.reason.explanation}
        </p>
      </section>

      <section className="rhythm-history-view__completions" aria-labelledby="rhythm-history-completions-title">
        <section className="rhythm-history-view__seasons">
            <header className="rhythm-history-view__seasons-header">
              <h3 id={seasonsDisclosureId}>Seasons</h3>
              <span className="rhythm-history-view__seasons-count">
                {knownSeasonCount} {knownSeasonCount === 1 ? 'season' : 'seasons'}
              </span>
              <button
                type="button"
                className="rhythm-history-view__score-info rhythm-history-view__seasons-info"
                aria-label={`${seasonsInfoExpanded ? 'Hide' : 'Show'} Seasons`}
                aria-expanded={seasonsInfoExpanded}
                aria-controls={seasonsContentId}
                onClick={() => setSeasonsDisclosure({
                  rhythmId: rhythm.id,
                  expanded: !seasonsInfoExpanded
                })}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <circle cx="8" cy="8" r="6.25" />
                  <path d="M8 7.1v4M8 4.85h.01" />
                </svg>
              </button>
            </header>
            <div
              id={seasonsContentId}
              className="rhythm-history-view__seasons-expanded"
              hidden={!seasonsInfoExpanded}
            >
              <p className="rhythm-history-view__seasons-info-copy">
                Schedule changes preserve earlier schedules, logged moments stay with this rhythm, and correcting earlier schedules can change historical scores.
              </p>
              <SeasonsHistory
                rhythm={rhythm}
                seasons={scheduleSeasons}
                asOfDate={asOfDate}
                {...(onChooseSchedule ? { onChooseSchedule } : {})}
                canChooseSchedule={!archived && Boolean(onChooseSchedule)}
                idPrefix={seasonsDisclosureId}
                historyBodyRef={historyBodyRef}
                seasonCardRefs={seasonCardRefs.current}
                expandedSeasonIds={expandedEarlierSeasonIds}
                canEdit={!archived && Boolean(onEditSeason)}
                editButtonRefs={seasonEditButtonsRef.current}
                onEditSeason={(season, opener) => openSeasonEditor(season, opener)}
                onToggleEarlierSeason={id => setExpandedEarlierSeasonIds(current => {
                  const next = new Set(current);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })}
              />
              {availableSeasonUndo && onUndoSeasonDeletion && (
                <div className="rhythm-history-view__season-undo" role="status" aria-live="polite">
                  <span>{seasonDeleteStatus || 'A Season was removed. You can undo this change.'}</span>
                  <button
                    ref={seasonUndoButtonRef}
                    type="button"
                    className="rhythm-history-view__season-edit"
                    onClick={undoSeasonDeletion}
                  >
                    Undo
                  </button>
                  {seasonUndoError && <span role="alert">{seasonUndoError}</span>}
                </div>
              )}
            </div>
            <div className="rhythm-history-view__seasons-divider" />
        </section>
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
      {editingSeason && rhythm.scoring && rhythm.schedule && onEditSeason && (
        <RhythmSeasonCorrectionDialog
          rhythm={rhythm}
          season={editingSeason}
          scoringInput={scoringInput}
          records={scoringRecords}
          suggestedStartDate={scoringRecords
            .map(record => record.effectiveDate)
            .filter(date => date >= editingSeason.startDate)
            .sort()[0] ?? rhythm.scoring.trackingStartDate}
          {...(pendingSeasonEditDraft?.seasonId === editingSeason.id
            ? { initialDraft: pendingSeasonEditDraft.draft }
            : {})}
          canDelete={canDeleteEditingSeason}
          {...(editingSeasonDeleteRestriction
            ? { deleteRestriction: editingSeasonDeleteRestriction }
            : {})}
          onSave={draft => onEditSeason(rhythm.id, draft)}
          {...(canDeleteEditingSeason
            ? { onRequestDelete: (draft: RhythmSeasonEditDialogDraft) => requestSeasonDeletion(editingSeason.id, draft) }
            : {})}
          onClose={closeSeasonEditor}
        />
      )}
      {deletingSeason?.kind === 'scheduled' && rhythm.scoring && rhythm.schedule && onDeleteSeason && (
        <RhythmSeasonDeleteDialog
          rhythm={rhythm}
          season={deletingSeason}
          scoringInput={scoringInput}
          records={scoringRecords}
          onDelete={confirmSeasonDeletion}
          onClose={closeSeasonDeleteDialog}
        />
      )}
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

function SeasonsHistory({
  rhythm,
  seasons,
  asOfDate,
  onChooseSchedule,
  canChooseSchedule,
  idPrefix,
  historyBodyRef,
  seasonCardRefs,
  expandedSeasonIds,
  onToggleEarlierSeason,
  canEdit,
  editButtonRefs,
  onEditSeason
}: {
  rhythm: RhythmPreview;
  seasons: readonly RhythmScheduleHistorySegment[];
  asOfDate: string;
  onChooseSchedule?: (event: MouseEvent<HTMLButtonElement>) => void;
  canChooseSchedule: boolean;
  idPrefix: string;
  historyBodyRef: { current: HTMLDivElement | null };
  seasonCardRefs: Map<string, HTMLElement>;
  expandedSeasonIds: ReadonlySet<string>;
  onToggleEarlierSeason: (id: string) => void;
  canEdit: boolean;
  editButtonRefs: Map<string, HTMLButtonElement>;
  onEditSeason: (season: RhythmScheduleHistorySegment, opener: HTMLButtonElement) => void;
}) {
  const [highlightedSeasonId, setHighlightedSeasonId] = useState<string | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current);
  }, []);

  const currentIndex = seasons.reduce(
    (found, season, index) => season.startDate <= asOfDate ? index : found,
    -1
  );
  const current = currentIndex >= 0 && seasons[currentIndex]?.kind === 'scheduled'
    ? seasons[currentIndex]
    : undefined;
  const displayCurrent: SeasonCardSchedule | undefined = current ?? (
    seasons.length === 0 && rhythm.schedule
      ? {
          kind: 'scheduled',
          id: `current-schedule:${rhythm.id}`,
          schedule: rhythm.schedule,
          ...(rhythm.timeOfDay ? { timeOfDay: rhythm.timeOfDay } : {}),
          paletteToken: rhythmSeasonPaletteForId(rhythm.id)
        }
      : undefined
  );
  const previous = (current ? seasons.slice(0, currentIndex) : seasons).map((season, index) => ({
    season,
    index
  })).reverse();
  const timeline = current && seasons.length > 1
    ? seasons.slice(0, currentIndex + 1).map((season, index) => {
    const endDate = index < currentIndex
      ? rhythmSeasonInclusiveEndDate(seasons, index) ?? season.startDate
      : asOfDate;
    const duration = Math.max(1, Math.floor(
      (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${season.startDate}T00:00:00Z`)) / 86_400_000
    ) + 1);
    return { season, endDate, duration };
    })
    : [];
  const currentName = displayCurrent?.name?.trim();
  const focusSeasonCard = (seasonId: string) => {
    const body = historyBodyRef.current;
    const card = seasonCardRefs.get(seasonId);
    if (!body || !card) return;
    const bodyBounds = body.getBoundingClientRect();
    const cardBounds = card.getBoundingClientRect();
    let scrollDelta = 0;
    if (cardBounds.top < bodyBounds.top) scrollDelta = cardBounds.top - bodyBounds.top;
    else if (cardBounds.bottom > bodyBounds.bottom) scrollDelta = cardBounds.bottom - bodyBounds.bottom;
    if (scrollDelta !== 0) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduceMotion) body.scrollTop += scrollDelta;
      else body.scrollTo({ top: body.scrollTop + scrollDelta, behavior: 'smooth' });
    }
    card.focus({ preventScroll: true });
    setHighlightedSeasonId(seasonId);
    if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = window.setTimeout(() => setHighlightedSeasonId(null), 1400);
  };

  return (
    <div className="rhythm-history-view__seasons-content">
      {!displayCurrent && (
        <div className="rhythm-history-view__seasons-choose">
          <p>Choose a schedule to see your current Season.</p>
          {canChooseSchedule && onChooseSchedule && (
            <button
              type="button"
              className="rhythm-history-view__unknown-schedule-action"
              onClick={onChooseSchedule}
            >
              Choose a schedule
            </button>
          )}
        </div>
      )}
      {timeline.length > 1 && (
        <>
          <p className="rhythm-history-view__seasons-intro">See how your schedule has changed.</p>
          <div
            className="rhythm-history-view__seasons-timeline"
            role="group"
            aria-label="Schedule history timeline. Segment lengths show elapsed calendar time, not performance."
          >
            {timeline.map(({ season, endDate, duration }) => {
              const label = season.kind === 'unknown'
                ? 'Earlier schedule needs details'
                : season.name?.trim() || formatRhythmSchedule(season.schedule, 'compact');
              const dateRange = `${formatHistoryDate(season.startDate, false)} to ${formatHistoryDate(endDate, false)}`;
              return (
                <button
                  key={season.id}
                  type="button"
                  className={`rhythm-history-view__season-timeline-segment ${seasonVisualClass(season.kind, season.paletteToken)}`}
                  style={{ flexGrow: duration }}
                  aria-label={`Go to ${label}, ${dateRange}`}
                  onClick={() => focusSeasonCard(season.id)}
                />
              );
            })}
          </div>
        </>
      )}
      {displayCurrent && (
        <SeasonCard
          seasonKind="scheduled"
          paletteToken={displayCurrent.paletteToken}
          seasonId={displayCurrent.id}
          idPrefix={idPrefix}
          cardRefs={seasonCardRefs}
          highlighted={highlightedSeasonId === displayCurrent.id}
          title={currentName || formatRhythmSchedule(displayCurrent.schedule, 'compact')}
          dateRange={displayCurrent.startDate
            ? `${formatSeasonDate(displayCurrent.startDate)} – Present`
            : 'Start date not recorded'}
          isCurrent
          metadata={seasonMetadata(displayCurrent)}
          actions={(
            <>
              {current && canEdit && (
                <SeasonEditButton
                  seasonId={current.id}
                  label={currentName || formatRhythmSchedule(current.schedule, 'compact')}
                  editButtonRefs={editButtonRefs}
                  onEditSeason={onEditSeason}
                  season={current}
                />
              )}
              {!current && canChooseSchedule && onChooseSchedule && (
                <SeasonEditButton
                  seasonId={displayCurrent.id}
                  label={currentName || formatRhythmSchedule(displayCurrent.schedule, 'compact')}
                  editButtonRefs={editButtonRefs}
                  onChooseSchedule={onChooseSchedule}
                />
              )}
            </>
          )}
        />
      )}
      {previous.length > 0 && (
        <section className="rhythm-history-view__earlier-seasons">
          <h4>Earlier Seasons</h4>
          {previous.map(({ season, index }) => {
            const expanded = expandedSeasonIds.has(season.id);
            const endDate = rhythmSeasonInclusiveEndDate(seasons, index) ?? season.startDate;
            const heading = season.kind === 'unknown'
              ? 'Earlier schedule needs details'
              : season.name?.trim() || formatRhythmSchedule(season.schedule, 'compact');
            const detailsId = `${idPrefix}-entry-${index}`;
            const hasDetails = season.kind === 'unknown'
              ? Boolean(season.descriptiveCadence)
              : Boolean(season.name?.trim() || season.note);
            return (
              <SeasonCard
                key={season.id}
                seasonKind={season.kind}
                paletteToken={season.paletteToken}
                seasonId={season.id}
                idPrefix={idPrefix}
                cardRefs={seasonCardRefs}
                highlighted={highlightedSeasonId === season.id}
                title={heading}
                dateRange={`${formatSeasonDate(season.startDate)} – ${formatSeasonDate(endDate)}`}
                metadata={season.kind === 'scheduled' ? seasonMetadata(season) : undefined}
                actions={(
                  <>
                    {season.kind === 'unknown' ? (
                      <button
                        ref={element => {
                          if (element) editButtonRefs.set(season.id, element);
                          else editButtonRefs.delete(season.id);
                        }}
                        type="button"
                        className="rhythm-history-view__unknown-schedule-action"
                        disabled={!canEdit}
                        onClick={event => onEditSeason(season, event.currentTarget)}
                      >
                        Set earlier schedule
                      </button>
                    ) : canEdit && (
                      <SeasonEditButton
                        seasonId={season.id}
                        label={heading}
                        editButtonRefs={editButtonRefs}
                        onEditSeason={onEditSeason}
                        season={season}
                      />
                    )}
                    {hasDetails && (
                      <button
                        type="button"
                        className="rhythm-history-view__season-expand"
                        aria-expanded={expanded}
                        aria-controls={detailsId}
                        aria-label={`${expanded ? 'Hide' : 'Show'} details for ${heading}`}
                        onClick={() => onToggleEarlierSeason(season.id)}
                      >
                        {expanded ? 'Hide' : 'Details'}
                      </button>
                    )}
                  </>
                )}
                details={hasDetails && (
                  <div id={detailsId} hidden={!expanded}>
                  {season.kind === 'unknown'
                    ? season.descriptiveCadence && (
                      <p className="rhythm-history-view__season-schedule">
                        Original description: {season.descriptiveCadence}
                      </p>
                    )
                    : (
                      <>
                        <p className="rhythm-history-view__season-schedule">
                          {formatRhythmSchedule(season.schedule, 'detailed')}
                        </p>
                        {season.note && <p className="rhythm-history-view__season-note">{season.note}</p>}
                      </>
                    )}
                  </div>
                )}
              />
            );
          })}
        </section>
      )}
      {previous.length > 0 && (
        <p className="rhythm-history-view__seasons-explanation">
          Earlier dates keep their earlier schedule. Your logged moments stay with this rhythm.
        </p>
      )}
    </div>
  );
}

type SeasonCardSchedule = Pick<
  RhythmScheduleSegment,
  'kind' | 'id' | 'schedule' | 'name' | 'note' | 'timeOfDay' | 'paletteToken'
> & { startDate?: string };

function seasonVisualClass(
  kind: RhythmScheduleHistorySegment['kind'],
  paletteToken: RhythmScheduleHistorySegment['paletteToken']
): string {
  if (kind === 'unknown') return 'rhythm-history-view__season-visual--unknown';
  return `rhythm-history-view__season-visual--${paletteToken}`;
}

function SeasonCard({
  seasonKind,
  paletteToken,
  seasonId,
  idPrefix,
  cardRefs,
  highlighted,
  title,
  dateRange,
  isCurrent = false,
  metadata,
  actions,
  details,
  note
}: {
  seasonKind: RhythmScheduleHistorySegment['kind'];
  paletteToken: RhythmScheduleHistorySegment['paletteToken'];
  seasonId: string;
  idPrefix: string;
  cardRefs: Map<string, HTMLElement>;
  highlighted: boolean;
  title: string;
  dateRange: string;
  isCurrent?: boolean;
  metadata?: ReactNode;
  actions?: ReactNode;
  details?: ReactNode;
  note?: string;
}) {
  const headingId = `${idPrefix}-season-heading-${seasonId}`;
  return (
    <article
      ref={element => {
        if (element) cardRefs.set(seasonId, element);
        else cardRefs.delete(seasonId);
      }}
      className={`rhythm-history-view__season-card ${seasonVisualClass(seasonKind, paletteToken)}${highlighted ? ' rhythm-history-view__season-card--highlighted' : ''}`}
      aria-labelledby={headingId}
      tabIndex={-1}
    >
      <div className="rhythm-history-view__season-card-header">
        <h4 id={headingId}>{title}</h4>
        {isCurrent && <span className="rhythm-history-view__season-current-badge">Current</span>}
        {actions && <div className="rhythm-history-view__season-card-actions">{actions}</div>}
      </div>
      <p className="rhythm-history-view__season-date-range">{dateRange}</p>
      {metadata && <div className="rhythm-history-view__season-card-metadata">{metadata}</div>}
      {note && <p className="rhythm-history-view__season-note">{note}</p>}
      {details}
    </article>
  );
}

type SeasonEditButtonProps = {
  seasonId: string;
  label: string;
  editButtonRefs: Map<string, HTMLButtonElement>;
} & (
  | {
      season: RhythmScheduleHistorySegment;
      onEditSeason: (season: RhythmScheduleHistorySegment, opener: HTMLButtonElement) => void;
      onChooseSchedule?: never;
    }
  | {
      season?: never;
      onEditSeason?: never;
      onChooseSchedule: (event: MouseEvent<HTMLButtonElement>) => void;
    }
);

function SeasonEditButton(props: SeasonEditButtonProps) {
  const { seasonId, label, editButtonRefs } = props;
  return (
    <button
      ref={element => {
        if (element) editButtonRefs.set(seasonId, element);
        else editButtonRefs.delete(seasonId);
      }}
      type="button"
      className="today-rhythm-details__edit-icon"
      aria-label={`Edit ${label}`}
      onClick={event => props.season
        ? props.onEditSeason(props.season, event.currentTarget)
        : props.onChooseSchedule(event)}
    >
      <span className="today-rhythm-details__edit-visual" aria-hidden="true">
        <RhythmMetadataIcon kind="edit" />
      </span>
    </button>
  );
}

function seasonMetadata(season: SeasonCardSchedule): ReactNode {
  const hasName = Boolean(season.name?.trim());
  const timeLabel = seasonTimeLabel(season);
  return (
    <>
      {hasName && (
        <p className="rhythm-history-view__season-schedule">
          {formatRhythmSchedule(season.schedule, 'detailed')}
        </p>
      )}
      {timeLabel && <p className="rhythm-history-view__season-schedule">{timeLabel}</p>}
    </>
  );
}

function seasonTimeLabel(season: Pick<RhythmScheduleSegment, 'timeOfDay'>): string | undefined {
  if (!season.timeOfDay) return undefined;
  return rhythmTimeOptions.find(option => option.value === season.timeOfDay)?.label;
}

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
    { label: 'Missed occurrences', value: String(evidence.missedOccurrenceCount) },
    { label: 'Per miss', value: `${evidence.pointsPerMissedOccurrence} points` }
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
            <li
              key={item.key}
              className={`rhythm-history-view__score-history-entry--${item.kind}`}
              aria-label={onTrackHistoryEntryDescription(item, evidence)}
            >
              <span>{onTrackHistoryEntryLabel(item)}</span>
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
  entry: ReturnType<typeof onTrackHistoryDisplayEntries>[number]
): string {
  if (entry.kind === 'schedule-change') {
    return `${formatHistoryDate(entry.date, false)} · Schedule changed`;
  }
  if (entry.kind === 'zero-score-span') {
    return `${entry.occurrenceCount} more misses · ${formatHistoryDate(entry.startDate, false)}–${formatHistoryDate(entry.endDate, false)}`;
  }
  if (entry.status === 'today') {
    return `Today · ${formatHistoryDate(entry.date, false)}`;
  }
  return `${formatHistoryDate(entry.date, false)} · ${entry.status === 'completed' ? 'Tended' : 'Missed'}`;
}

function onTrackHistoryEntryDescription(
  entry: ReturnType<typeof onTrackHistoryDisplayEntries>[number],
  evidence: ScoredOnTrackMetric['evidence']
): string {
  if (entry.kind === 'schedule-change') {
    return `Schedule changed on ${formatHistoryDate(entry.date)}. On Track score at that point: ${entry.score}.`;
  }
  if (entry.kind === 'zero-score-span') {
    const unit = entry.occurrenceCount === 1 ? 'additional missed occurrence' : 'additional missed occurrences';
    return `On Track remained at 0 through ${entry.occurrenceCount} ${unit} from ${formatHistoryDate(entry.startDate)} through ${formatHistoryDate(entry.endDate)}.`;
  }
  const date = formatHistoryDate(entry.date);
  if (entry.status === 'completed') {
    return `Qualifying completion on ${date} reset the missed-occurrence count and On Track score to 100.`;
  }
  if (entry.status === 'missed') {
    return `Missed scheduled occurrence on ${date}; ${evidence.pointsPerMissedOccurrence}-point deduction applied. Resulting On Track score: ${entry.score}.`;
  }
  return `Current On Track state as of ${date}; today is pending and is not counted as missed. Current score: ${entry.score}.`;
}

function UnscoredBreakdown({
  metric,
  onChooseSchedule
}: {
  metric: UnscoredMetric;
  onChooseSchedule?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <section className="rhythm-history-view__score-details">
      <p className="rhythm-history-view__score-explanation">{metric.explanation}</p>
      {onChooseSchedule && (
        <button
          type="button"
          className="rhythm-history-view__score-history-toggle"
          onClick={onChooseSchedule}
        >
          Choose a schedule to calculate On Track
        </button>
      )}
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

function formatSeasonDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
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
