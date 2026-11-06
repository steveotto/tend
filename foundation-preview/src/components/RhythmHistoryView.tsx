import { useEffect, useId, useRef, useState } from 'react';
import { useScoringInstant } from './useScoringInstant.ts';
import type { MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import type { FoundationPreview, PersonId, PersonPreview, RhythmPreview } from '../domain/preview-data.ts';
import { orderedCompletions } from '../domain/preview-data.ts';
import type { RhythmCompletion } from '../domain/preview-data.ts';
import type { DatedRhythmCompletion, RhythmCompletionRecord } from '../domain/rhythm-completion.ts';
import type {
  RhythmScheduleHistorySegment,
  RhythmScheduleSegment
} from '../domain/rhythm-schedule.ts';
import type { RhythmSeasonEditDraft } from '../domain/rhythm-season-edit.ts';
import type { RhythmSeasonEditTarget } from '../domain/rhythm-season-edit.ts';
import type { RhythmSeasonDeletionUndo } from '../domain/rhythm-season-delete.ts';
import { deleteRhythmSeason } from '../domain/rhythm-season-delete.ts';
import {
  prepareCompletionHistory
} from '../domain/rhythm-history.ts';
import {
  localDateInTimeZone,
  selectRhythmScore,
  selectRhythmSeasonScore
} from '../domain/rhythm-scoring.ts';
import type { SelectRhythmScoreInput } from '../domain/rhythm-scoring.ts';
import {
  effectiveRhythmSchedule,
  formatRhythmSchedule,
  rhythmTimeLabel
} from '../domain/rhythm-schedule.ts';
import {
  rhythmSeasonInclusiveEndDate,
  rhythmSeasonPaletteAssignments,
  rhythmSeasonPaletteForOrdinal
} from '../domain/rhythm-seasons.ts';
import { isValidTimeZone } from '../domain/rhythm-schedule.ts';
import type {
  ScoredConsistencyMetric,
  ScoredOnTrackMetric,
  UnscoredMetric
} from '../domain/rhythm-scoring.ts';
import { RhythmArchivedBadge } from './RhythmArchivedBadge.tsx';
import { RhythmScheduleSummary } from './RhythmMetadata.tsx';
import { RhythmSeasonCard } from './RhythmSeasonCard.tsx';
import { RhythmMetadataIcon } from './RhythmMetadataIcon.tsx';
import { RhythmPersonalBadge } from './RhythmPersonalBadge.tsx';
import { HealthScoreBreakdown, HealthScoreInfoButton, HealthScoreMeasures } from './HealthScoreBreakdown.tsx';
import { HealthScoreDetailsDialog } from './HealthScoreDetailsDialog.tsx';
export { HealthScoreMeter } from './HealthScoreBreakdown.tsx';
import { RhythmCompletionHistoryChart } from './RhythmCompletionHistoryChart.tsx';
import { RhythmCompletionForm } from './RhythmCompletionForm.tsx';
import { RhythmAssociationRows } from './RhythmAssociationRows.tsx';
import { RhythmSeasonCorrectionDialog } from './RhythmSeasonCorrectionDialog.tsx';
import type { RhythmSeasonEditDialogDraft } from './RhythmSeasonCorrectionDialog.tsx';
import { RhythmSeasonDeleteDialog } from './RhythmSeasonDeleteDialog.tsx';
import { HealthScoreDetailsContent } from './HealthScoreDetailsContent.tsx';
import { RhythmHealthScoringDetails } from './RhythmHealthScoringDetails.tsx';
import type { HealthRollupConfig } from './HealthRollupDiagram.tsx';
import { selectRhythmContribution } from '../domain/rhythm-contribution.ts';
import type { RhythmScoreResult } from '../domain/rhythm-scoring.ts';
import type { Destination } from './AppNavigation.tsx';
import { useRhythmTimeOptions } from './TimeBlocksContext.tsx';
import { isValidDate } from '../domain/money-goals.ts';
import type { StrengthMode } from '../domain/strength.ts';
import { hasFoundationIcon, hasRhythmIcon, MarriageIcon } from './MarriageIcon.tsx';
import { RhythmRepeatIcon } from './RhythmMetadata.tsx';

const metricCopy = {
  consistency: {
    title: 'Consistency',
    shortDescription: 'Follow-through over time'
  },
  onTrack: {
    title: 'On Track',
    shortDescription: 'How caught up you are'
  }
} as const;

export function RhythmHistoryView({
  rhythm,
  healthWorkoutSetting,
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
  onUndoSeasonDeletion,
  seasonRangeUndo,
  onUndoSeasonRange,
  onOpenCategory,
  foundations,
  rhythmScores,
  categoryHealthScores,
  archivedRhythmIds,
  relatedRhythms = [rhythm],
  onOpenFoundation
}: {
  rhythm: RhythmPreview;
  healthWorkoutSetting?: { mode: StrengthMode; workoutName?: string };
  people?: readonly PersonPreview[];
  foundations?: readonly FoundationPreview[];
  relatedRhythms?: readonly RhythmPreview[];
  rhythmScores?: ReadonlyMap<string, RhythmScoreResult>;
  categoryHealthScores?: ReadonlyMap<string, number | null>;
  archivedRhythmIds?: readonly string[];
  onPersonSelect?: (personId: PersonId) => void;
  onOpenFoundation?: (foundationId: string, openerId: string) => void;
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
  seasonRangeUndo?: { rhythmId: string } | null;
  onUndoSeasonRange?: () => string | null;
  onOpenCategory?: (categoryId: Destination, openerId: string) => void;
}) {
  const timeOptions = useRhythmTimeOptions();
  const historyRecords: readonly RhythmCompletion[] | undefined =
    rhythm.completionHistory === undefined && !completionHistoryAvailable && datedCompletions.length === 0
      ? undefined
      : [...(rhythm.completionHistory ?? []), ...datedCompletions];
  const scoringTimeZone = rhythm.scoring?.timeZone
    ?? rhythm.createdTimeZone
    ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const scoringInstant = useScoringInstant();
  const asOfTimeZone = isValidTimeZone(scoringTimeZone)
    ? scoringTimeZone
    : Intl.DateTimeFormat().resolvedOptions().timeZone;
  const asOfDate = localDateInTimeZone(scoringInstant, asOfTimeZone);
  const completions = prepareCompletionHistory(historyRecords, asOfDate);
  const completionCount = completions.kind === 'recorded' ? completions.count : 0;
  const loggedMomentsCount = completions.kind === 'unavailable' ? '—' : String(completionCount);
  const scoringRecords: RhythmCompletionRecord[] = (historyRecords ?? []).map(record => ({
    ...record,
    rhythmId: rhythm.id
  }));
  const effectiveSchedule = effectiveRhythmSchedule(rhythm.schedule, rhythm.cadence);
  const scoringInput = {
    rhythmId: rhythm.id,
    ...(rhythm.cadence ? { cadence: rhythm.cadence } : {}),
    ...(effectiveSchedule ? { schedule: effectiveSchedule } : {}),
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
  const reliableCreatedLocalDate = rhythm.createdLocalDate
    && isValidDate(rhythm.createdLocalDate)
    && rhythm.createdLocalDate <= asOfDate
    ? rhythm.createdLocalDate
    : undefined;
  const createdDateScore = reliableCreatedLocalDate
    ? selectRhythmScore({
        ...scoringInput,
        asOfDate: reliableCreatedLocalDate,
        timeZone: rhythm.createdTimeZone && isValidTimeZone(rhythm.createdTimeZone)
          ? rhythm.createdTimeZone
          : asOfTimeZone
      })
    : null;
  const createdOnTrackScore = createdDateScore?.kind === 'rhythm-score'
    && createdDateScore.onTrack.kind === 'scored'
    ? createdDateScore.onTrack.score
    : null;
  const contributionScores = new Map(rhythmScores ?? []);
  contributionScores.set(rhythm.id, score);
  const rhythmContribution = selectRhythmContribution({
    rhythm,
    foundations: foundations ?? [],
    relatedRhythms,
    rhythmScores: contributionScores,
    archivedRhythmIds: archived
      ? [...new Set([rhythm.id, ...(archivedRhythmIds ?? [])])]
      : archivedRhythmIds ?? [],
    categoryHealthScores: categoryHealthScores ?? new Map(),
    rhythmHealthScore: score.healthScore
  });
  const rhythmRollup: HealthRollupConfig = {
    groups: [],
    initialGroupId: 'rhythms',
    initialItemId: rhythm.id,
    rhythmContribution,
    scoringInfo: {
      groupId: 'rhythm',
      triggerLabel: 'About Rhythm scoring',
      title: 'Rhythm scoring',
      paragraphs: ['Health combines Consistency and On Track using the established Rhythm scoring policy.']
    }
  };
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
  const scoreInfoButtonRef = useRef<HTMLButtonElement>(null);
  const previousEditingIdRef = useRef<string | null>(null);
  const previousLoggingMomentRef = useRef(false);
  const previousDeleteIdRef = useRef<string | null>(null);
  const scoreDetailsId = useId();
  const seasonsDisclosureId = useId();
  const seasonsContentId = useId();
  const [seasonsDisclosure, setSeasonsDisclosure] = useState({
    rhythmId: rhythm.id,
    expanded: false
  });
  const seasonsInfoExpanded = seasonsDisclosure.rhythmId === rhythm.id && seasonsDisclosure.expanded;
  const scheduleSeasons = rhythm.scoring?.scheduleHistory ?? [];
  const currentHistorySeason = [...scheduleSeasons].reverse().find(season => season.startDate <= asOfDate);
  const hasCurrentHistoricalSchedule = currentHistorySeason?.kind === 'scheduled';
  const detailSchedule = currentHistorySeason?.kind === 'scheduled'
    ? currentHistorySeason.schedule
    : effectiveSchedule;
  const detailTimeLabel = currentHistorySeason?.kind === 'scheduled' && currentHistorySeason.timeOfDay
    ? rhythmTimeLabel(currentHistorySeason.timeOfDay, timeOptions)
    : rhythm.timeOfDay
      ? rhythmTimeLabel(rhythm.timeOfDay, timeOptions)
      : rhythm.timeLabel;
  const rhythmIdentitySchedule = [
    detailSchedule ? formatRhythmSchedule(detailSchedule, 'compact') : rhythm.cadence,
    detailTimeLabel
  ].filter((part): part is string => Boolean(part)).join(' · ');
  const displayOnlyCurrentSeason: SeasonCardSchedule | undefined = effectiveSchedule && !hasCurrentHistoricalSchedule
    ? {
        kind: 'scheduled',
        id: `current-schedule:${rhythm.id}`,
        schedule: effectiveSchedule,
        ...(rhythm.timeOfDay ? { timeOfDay: rhythm.timeOfDay } : {}),
        paletteToken: rhythmSeasonPaletteForOrdinal(
          scheduleSeasons.filter(season => season.kind === 'scheduled').length
        )
      }
    : undefined;
  const availableSeasonUndo = seasonDeletionUndo?.rhythmId === rhythm.id ? seasonDeletionUndo : null;
  const availableSeasonRangeUndo = seasonRangeUndo?.rhythmId === rhythm.id ? seasonRangeUndo : null;
  const seasonCount = scheduleSeasons.length
    + (effectiveSchedule && !hasCurrentHistoricalSchedule ? 1 : 0);
  const unknownSeason = scheduleSeasons.find(season => season.kind === 'unknown');
  const scoreNotice = unknownSeason
    ? 'Some earlier dates have no known schedule. Use the action in Seasons to review those logs.'
    : score.kind === 'rhythm-score'
      ? score.healthScore === null
        ? `${score.consistency.kind === 'unscored' ? `Consistency: ${score.consistency.explanation}` : ''}${score.consistency.kind === 'unscored' && score.onTrack.kind === 'unscored' ? ' ' : ''}${score.onTrack.kind === 'unscored' ? `On Track: ${score.onTrack.explanation}` : ''} Health requires both scores.`
        : null
      : score.kind === 'invalid'
        ? `Scores unavailable: ${score.reason}`
        : score.reason.explanation;
  const activityIconId = rhythm.iconId
    ?? (rhythm.healthLogCapability === 'workout' ? 'health-strength'
      : rhythm.healthLogCapability === 'cardio' ? 'health-cardio'
        : rhythm.healthLogCapability === 'weight' ? 'health-weight'
          : undefined);
  const activityLabel = rhythm.healthLogCapability === 'workout' ? 'Workout'
    : rhythm.healthLogCapability === 'cardio' ? 'Run'
      : rhythm.healthLogCapability === 'weight' ? 'Weigh-in'
        : 'Rhythm';
  const workoutModeLabel = rhythm.healthLogCapability === 'workout'
    && healthWorkoutSetting?.mode === 'specific'
    ? `Specific workout${healthWorkoutSetting.workoutName ? ` · ${healthWorkoutSetting.workoutName}` : ''}`
    : rhythm.healthLogCapability === 'workout'
      && healthWorkoutSetting?.mode === 'custom'
      ? 'Custom workout'
      : undefined;
  const [editingRecord, setEditingRecord] = useState<RhythmCompletionRecord | null>(null);
  const [loggingMoment, setLoggingMoment] = useState(false);
  const [loggedMomentsExpanded, setLoggedMomentsExpanded] = useState(false);
  const [logAnnouncement, setLogAnnouncement] = useState('');
  const [scoreDetailsExpanded, setScoreDetailsExpanded] = useState(false);
  const closeScoreDetails = () => {
    setScoreDetailsExpanded(false);
    requestAnimationFrame(() => scoreInfoButtonRef.current?.focus());
  };
  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null);
  const [displayOnlyEditingSeason, setDisplayOnlyEditingSeason] = useState<SeasonCardSchedule | null>(null);
  const [pendingSeasonEditDraft, setPendingSeasonEditDraft] = useState<{
    seasonId: string;
    draft: RhythmSeasonEditDialogDraft;
  } | null>(null);
  const [deletingSeasonId, setDeletingSeasonId] = useState<string | null>(null);
  const [seasonUndoError, setSeasonUndoError] = useState('');
  const [seasonDeleteStatus, setSeasonDeleteStatus] = useState('');
  const [seasonRangeUndoError, setSeasonRangeUndoError] = useState('');
  const [seasonRangeUndoStatus, setSeasonRangeUndoStatus] = useState('');
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
  const editingSeason = scheduleSeasons.find(season => season.id === editingSeasonId)
    ?? (displayOnlyEditingSeason?.id === editingSeasonId ? displayOnlyEditingSeason : undefined);
  const deletingSeason = scheduleSeasons.find(season => season.id === deletingSeasonId);
  const editingSeasonIndex = editingSeason
    ? scheduleSeasons.findIndex(season => season.id === editingSeason.id)
    : -1;
  const editingSeasonPrevious = editingSeasonIndex > 0 ? scheduleSeasons[editingSeasonIndex - 1] : undefined;
  const editingSeasonDeletePreview = editingSeason?.kind === 'scheduled'
    && rhythm.scoring
    ? deleteRhythmSeason(
        rhythm.id,
        effectiveSchedule ?? editingSeason.schedule,
        rhythm.scoring,
        editingSeason.id,
        scoringRecords,
        asOfDate
      )
    : undefined;
  const canDeleteEditingSeason = !archived
    && Boolean(onDeleteSeason)
    && editingSeason?.kind === 'scheduled'
    && (editingSeasonIndex === 0
      ? editingSeasonDeletePreview?.valid === true
      : editingSeasonIndex > 0 && editingSeasonPrevious?.kind === 'scheduled');
  const editingSeasonDeleteRestriction = editingSeasonIndex === 0
    ? editingSeasonDeletePreview && !editingSeasonDeletePreview.valid
      ? editingSeasonDeletePreview.error
      : 'The first Season cannot be deleted.'
    : editingSeasonIndex < 0
      ? 'Choose a starting date to establish this current Season.'
    : editingSeason?.kind === 'unknown'
      ? 'An unknown-history interval cannot be deleted until its schedule is set.'
      : editingSeasonPrevious?.kind === 'unknown'
        ? 'This Season cannot be deleted until the earlier schedule is set.'
        : 'This Season cannot be deleted.';

  function dismissEditingRecord() {
    setEditingRecord(null);
  }

  function undoSeasonRange() {
    if (!onUndoSeasonRange || !availableSeasonRangeUndo) return;
    const error = onUndoSeasonRange();
    if (error) {
      setSeasonRangeUndoError(error);
      return;
    }
    setSeasonRangeUndoStatus('Season change undone. Logged moments were preserved.');
    setSeasonRangeUndoError('');
  }

  function dismissLoggingMoment() {
    setLoggingMoment(false);
  }

  useEffect(() => {
    historyViewRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    setScoreDetailsExpanded(false);
  }, [rhythm.id]);

  useEffect(() => {
    const previousId = previousEditingIdRef.current;
    if (previousId && !editingRecord) {
      editButtonsRef.current.get(previousId)?.focus({ preventScroll: true });
    }
    previousEditingIdRef.current = editingRecord?.id ?? null;
  }, [editingRecord]);

  useEffect(() => {
    if (previousLoggingMomentRef.current && !loggingMoment) {
      logMomentButtonRef.current?.focus({ preventScroll: true });
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
      target?.focus({ preventScroll: true });
      setFocusAfterDeleteId(null);
      setDeleteError('');
    }
    previousDeleteIdRef.current = deletingRecordId;
  }, [deletingRecordId, focusAfterDeleteId, completions]);

  useEffect(() => {
    if (deletingRecordId) deleteCancelButtonRef.current?.focus({ preventScroll: true });
  }, [deletingRecordId]);

  useEffect(() => {
    if (!editingSeasonId) {
      if (transitioningToDeleteRef.current) transitioningToDeleteRef.current = false;
      else if (!pendingSeasonEditDraft) seasonEditOpenerRef.current?.focus({ preventScroll: true });
    }
  }, [editingSeasonId, pendingSeasonEditDraft]);

  useEffect(() => {
    if (previousDeletingSeasonIdRef.current && !deletingSeasonId) {
      if (seasonDeletionSavedRef.current) {
        seasonUndoButtonRef.current?.focus({ preventScroll: true });
        seasonDeletionSavedRef.current = false;
      } else if (!pendingSeasonEditDraft) {
        seasonDeleteOpenerRef.current?.focus({ preventScroll: true });
      }
    }
    previousDeletingSeasonIdRef.current = deletingSeasonId;
  }, [deletingSeasonId, availableSeasonUndo, pendingSeasonEditDraft]);

  useEffect(() => {
    if (!focusRestoredSeasonId || availableSeasonUndo?.season.id === focusRestoredSeasonId) return;
    (seasonEditButtonsRef.current.get(focusRestoredSeasonId)
      ?? historyViewRef.current)?.focus({ preventScroll: true });
    setFocusRestoredSeasonId(null);
  }, [focusRestoredSeasonId, availableSeasonUndo, scheduleSeasons]);

  function openSeasonEditor(season: RhythmSeasonEditTarget, opener: HTMLButtonElement) {
    seasonEditOpenerRef.current = opener;
    setDisplayOnlyEditingSeason(season.startDate === undefined ? season : null);
    setEditingSeasonId(season.id);
  }

  function openAddSeason(opener: HTMLButtonElement) {
    if (!detailSchedule) return;
    const { endDate: _endDate, ...scheduleWithoutEndDate } = detailSchedule;
    openSeasonEditor({
      kind: 'scheduled',
      id: `new-season:${rhythm.id}`,
      schedule: scheduleWithoutEndDate,
      ...(currentHistorySeason?.kind === 'scheduled' && currentHistorySeason.timeOfDay
        ? { timeOfDay: currentHistorySeason.timeOfDay }
        : rhythm.timeOfDay ? { timeOfDay: rhythm.timeOfDay } : {}),
      paletteToken: rhythmSeasonPaletteForOrdinal(
        scheduleSeasons.filter(season => season.kind === 'scheduled').length
      )
    }, opener);
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
    setDisplayOnlyEditingSeason(null);
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
          <div className="rhythm-history-view__header-actions">
            {availableSeasonRangeUndo && onUndoSeasonRange && (
              <button
                type="button"
                className="rhythm-history-view__season-range-undo"
                aria-label="Undo season change"
                title="Undo season change"
                onClick={undoSeasonRange}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M9 14 4 9l5-5" />
                  <path d="M4.5 9H14a6 6 0 0 1 0 12h-2" />
                </svg>
              </button>
            )}
            <button
              ref={closeButtonRef}
              type="button"
              className="today-rhythm-details__close today-rhythm-details__close--history"
              aria-label={editingRecord ? 'Cancel editing logged moment' : 'Close details'}
              onClick={editingRecord ? dismissEditingRecord : onClose}
            >
              ×
            </button>
          </div>
        )}
        <p className="rhythm-history-view__undo-announcement" aria-live="polite">
          {seasonRangeUndoStatus
            || (availableSeasonRangeUndo ? 'A Season change was saved. You can undo it.' : '')}
        </p>
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
      <section className="rhythm-history-view__details-card rhythm-history-view__card" aria-label="Rhythm details">
        <div className="rhythm-history-view__activity-summary">
          <span className="rhythm-history-view__activity-icon" aria-hidden="true">
            {activityIconId && hasFoundationIcon(activityIconId)
              ? <MarriageIcon group="foundations" id={activityIconId} />
              : activityIconId && hasRhythmIcon(activityIconId)
                ? <MarriageIcon group="rhythms" id={activityIconId} />
                : <RhythmRepeatIcon />}
          </span>
          <div className="rhythm-history-view__activity-copy">
            <div className="rhythm-history-view__activity-title">
              <span>{activityLabel}</span>
              {rhythm.healthLogCapability === 'workout'
                && healthWorkoutSetting?.mode === 'recommended'
                && <span className="rhythm-history-view__recommended">Recommended</span>}
            </div>
            {workoutModeLabel && (
              <p className="rhythm-history-view__activity-configuration">{workoutModeLabel}</p>
            )}
          </div>
        </div>
        <div className="rhythm-history-view__metadata">
        {hasDescription && (
          <p className="rhythm-history-view__description">
            {rhythm.description}
          </p>
        )}
        <RhythmAssociationRows
          rhythm={rhythm}
          {...(people ? { people } : {})}
          {...(foundations ? { foundations } : {})}
          {...(onPersonSelect ? { onPersonSelect } : {})}
          {...(onOpenCategory ? { onOpenCategory } : {})}
          {...(onOpenFoundation ? { onOpenFoundation } : {})}
        />
        {(rhythm.cadence || detailSchedule || detailTimeLabel) && (
          <>
            <div className="rhythm-history-view__metadata-divider" aria-hidden="true" />
            <div className="rhythm-history-view__schedule rhythm-metadata-footer">
              <RhythmScheduleSummary
                {...(!detailSchedule ? { cadence: rhythm.cadence } : {})}
                {...(detailSchedule ? { schedule: detailSchedule } : {})}
                {...(detailTimeLabel ? { timeLabel: detailTimeLabel } : {})}
              />
            </div>
          </>
        )}
        {(archived || rhythm.personal) && (
          <div className="rhythm-history-view__badges">
            {archived && <RhythmArchivedBadge />}
            {rhythm.personal && <RhythmPersonalBadge />}
          </div>
        )}
        </div>
      </section>
      {seasonRangeUndoError && (
        <p className="rhythm-history-view__undo-error" role="alert">{seasonRangeUndoError}</p>
      )}

      <section className="rhythm-history-view__score-section rhythm-history-view__card" aria-label="Health, Consistency, and On Track scores">
        <div className="rhythm-history-view__score-card">
          <HealthScoreBreakdown
            title="Health"
            score={score.healthScore}
            consistency={{
              score: score.consistency.kind === 'scored' ? score.consistency.score : null,
              state: score.consistency.kind,
              ...(score.consistency.kind === 'unscored' ? { explanation: score.consistency.explanation } : {})
            }}
            onTrack={{
              score: score.onTrack.kind === 'scored' ? score.onTrack.score : null,
              state: score.onTrack.kind,
              ...(score.onTrack.kind === 'unscored' ? { explanation: score.onTrack.explanation } : {})
            }}
            consistencyCaption={metricCopy.consistency.shortDescription}
            onTrackCaption={metricCopy.onTrack.shortDescription}
            ariaLabel="Health score summary"
            headingAction={(
              <HealthScoreInfoButton
                ref={scoreInfoButtonRef}
                label="Show Consistency and On Track score details"
                controls={scoreDetailsId}
                expanded={scoreDetailsExpanded}
                onClick={() => setScoreDetailsExpanded(expanded => !expanded)}
              />
            )}
            showMeasures={false}
          />
          <div className="rhythm-history-view__score-summary-divider" aria-hidden="true" />
          <HealthScoreMeasures
            healthScore={score.healthScore}
            consistency={{
              score: score.consistency.kind === 'scored' ? score.consistency.score : null,
              state: score.consistency.kind,
              ...(score.consistency.kind === 'unscored' ? { explanation: score.consistency.explanation } : {})
            }}
            onTrack={{
              score: score.onTrack.kind === 'scored' ? score.onTrack.score : null,
              state: score.onTrack.kind,
              ...(score.onTrack.kind === 'unscored' ? { explanation: score.onTrack.explanation } : {})
            }}
            consistencyCaption={metricCopy.consistency.shortDescription}
            onTrackCaption={metricCopy.onTrack.shortDescription}
            showHealthMeter={false}
            showCaptions
          />
          {scoreDetailsExpanded && (
            <HealthScoreDetailsDialog
              title="Rhythm Health details"
              titleLeadingAction={(
                <button
                  type="button"
                  className="rhythm-history-view__health-details-back"
                  aria-label="Back to Rhythm details"
                  onClick={closeScoreDetails}
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                    <path d="m10.5 3.5-4.5 4.5 4.5 4.5" />
                  </svg>
                </button>
              )}
              showCloseButton={false}
              onClose={closeScoreDetails}
              className="rhythm-history-view__health-details-dialog"
            >
              <HealthScoreDetailsContent
                key={rhythm.id}
                title="Health"
                ariaLabel="Rhythm Health score details"
                score={score.healthScore}
                consistency={{
                  score: score.consistency.kind === 'scored' ? score.consistency.score : null,
                  state: score.consistency.kind,
                  ...(score.consistency.kind === 'unscored' ? { explanation: score.consistency.explanation } : {})
                }}
                onTrack={{
                  score: score.onTrack.kind === 'scored' ? score.onTrack.score : null,
                  state: score.onTrack.kind,
                  ...(score.onTrack.kind === 'unscored' ? { explanation: score.onTrack.explanation } : {})
                }}
                consistencyCaption={metricCopy.consistency.shortDescription}
                onTrackCaption={metricCopy.onTrack.shortDescription}
                rollup={rhythmRollup}
                rhythmIdentity={{
                  name: rhythm.title,
                  ...(rhythmIdentitySchedule ? { schedule: rhythmIdentitySchedule } : {})
                }}
                showScoreNote={false}
                initialContributionExpanded={false}
                scoringCard={(
                  <RhythmHealthScoringDetails
                    id={scoreDetailsId}
                    consistency={score.consistency}
                    onTrack={score.onTrack}
                    healthScore={score.healthScore}
                    {...(score.consistency.kind === 'scored'
                      && score.onTrack.kind === 'scored'
                      && score.healthScore !== null
                      ? {}
                      : { unavailableExplanation: healthUnavailableExplanation(score.consistency, score.onTrack) })}
                    {...(effectiveSchedule ? { schedule: effectiveSchedule } : {})}
                    asOfDate={asOfDate}
                    {...(reliableCreatedLocalDate
                      ? { createdLocalDate: reliableCreatedLocalDate }
                      : {})}
                    createdOnTrackScore={createdOnTrackScore}
                    {...(scheduleConversionHandler
                      ? { onChooseSchedule: scheduleConversionHandler }
                      : {})}
                    formatDate={formatHistoryDate}
                    initiallyExpanded={false}
                  />
                )}
              />
            </HealthScoreDetailsDialog>
          )}
        </div>
        {scoreNotice && (
          <p className="rhythm-history-view__sample-notice" role="status">{scoreNotice}</p>
        )}
      </section>

      <section className="rhythm-history-view__completions rhythm-history-view__card" aria-labelledby="rhythm-history-completions-title">
        <h3 id="rhythm-history-completions-title">All completion history</h3>
        {(completions.kind === 'recorded' || completions.kind === 'empty') && (
          <p className="rhythm-history-view__completion-summary" aria-label={`${completionCount} ${completionCount === 1 ? 'moment' : 'moments'} tended${completions.kind === 'recorded' ? ` across ${completions.dailyCounts.length} ${completions.dailyCounts.length === 1 ? 'day' : 'days'}` : ''}`}>
            <span className="rhythm-history-view__completion-total">
              <strong>{completionCount}</strong>
              <span>{completionCount === 1 ? 'moment tended' : 'moments tended'}</span>
            </span>
            {completions.kind === 'recorded' && (
              <span className="rhythm-history-view__completion-span">
                across {completions.dailyCounts.length} {completions.dailyCounts.length === 1 ? 'day' : 'days'}
              </span>
            )}
          </p>
        )}
        {completions.kind === 'recorded' && (
          <RhythmCompletionHistoryChart dailyCounts={completions.dailyCounts} todayDate={asOfDate} />
        )}
        {completions.kind === 'unavailable' && (
          <p className="rhythm-history-view__empty">Dated completion history is unavailable for this Rhythm.</p>
        )}
        {completions.kind === 'empty' && (
          <p className="rhythm-history-view__empty rhythm-history-view__empty-notice">
            Your story starts with the first Tend.
          </p>
        )}
      </section>
      <section className="rhythm-history-view__seasons rhythm-history-view__card">
        <header className="rhythm-history-view__seasons-header">
          <h3 id={seasonsDisclosureId}>Seasons</h3>
          <span className="rhythm-history-view__seasons-count">
            {seasonCount} {seasonCount === 1 ? 'season' : 'seasons'}
          </span>
          <button
            type="button"
            className="rhythm-history-view__score-info rhythm-history-view__seasons-info"
            aria-label={`${seasonsInfoExpanded ? 'Hide' : 'Show'} Seasons explanation`}
            aria-expanded={seasonsInfoExpanded}
            aria-controls={seasonsContentId}
            onClick={() => setSeasonsDisclosure({
              rhythmId: rhythm.id,
              expanded: !seasonsInfoExpanded
            })}
          >
            <svg className="disclosure-chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d={seasonsInfoExpanded ? 'm3 10 5-5 5 5' : 'm3 6 5 5 5-5'} />
            </svg>
          </button>
        </header>
        <div
          id={seasonsContentId}
          className="rhythm-history-view__seasons-explanation"
          hidden={!seasonsInfoExpanded}
        >
          <p className="rhythm-history-view__seasons-info-copy">
            Seasons organize your schedule as it changes. Your logs stay saved, and each is scored using the schedule in place at the time.
          </p>
        </div>
        <SeasonsHistory
          {...(displayOnlyCurrentSeason ? { displayOnlyCurrentSeason } : {})}
          seasons={scheduleSeasons}
          asOfDate={asOfDate}
          scoreInput={scoringInput}
          overallHealthScore={score.healthScore}
          {...(onChooseSchedule ? { onChooseSchedule } : {})}
          canChooseSchedule={!archived && Boolean(onChooseSchedule)}
          historyBodyRef={historyBodyRef}
          seasonCardRefs={seasonCardRefs.current}
          canEdit={!archived && Boolean(onEditSeason)}
          editButtonRefs={seasonEditButtonsRef.current}
          onEditSeason={(season, opener) => openSeasonEditor(season, opener)}
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
        {!archived && onEditSeason && detailSchedule && (
          <div className="rhythm-history-view__season-add-row">
            <button
              type="button"
              className="btn mini ghost rhythm-history-view__season-add"
              aria-label="Add a Season"
              onClick={event => openAddSeason(event.currentTarget)}
            >
              + Add Season
            </button>
          </div>
        )}
      </section>
      <details
        className="rhythm-history-view__logged-moments rhythm-history-view__card"
        open={loggedMomentsExpanded}
        onToggle={event => setLoggedMomentsExpanded(event.currentTarget.open)}
      >
        <summary
          ref={loggedMomentsSummaryRef}
          role="button"
          aria-label={`Logged moments (${completions.kind === 'unavailable' ? 'unavailable' : completionCount})`}
          aria-expanded={loggedMomentsExpanded}
        >
          <span className="rhythm-history-view__logged-heading">Logged moments</span>
          <span className="rhythm-history-view__logged-count" aria-hidden="true">
            {loggedMomentsCount}
          </span>
          <svg
            className={`disclosure-chevron${loggedMomentsExpanded ? ' disclosure-chevron--expanded' : ''}`}
            viewBox="0 0 16 16"
            aria-hidden="true"
            focusable="false"
          >
            <path d="m3 6 5 5 5-5" />
          </svg>
        </summary>
        {onSaveCompletion && (
          <div className="rhythm-history-view__log-moment-row">
            <button
              ref={logMomentButtonRef}
              type="button"
              className="btn mini ghost rhythm-history-view__log-moment"
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
      {editingSeason && effectiveSchedule && onEditSeason && (
        <RhythmSeasonCorrectionDialog
          rhythm={{ ...rhythm, schedule: effectiveSchedule }}
          season={editingSeason}
          scoringInput={scoringInput}
          records={scoringRecords}
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

function SeasonsHistory({
  displayOnlyCurrentSeason,
  seasons,
  asOfDate,
  scoreInput,
  overallHealthScore,
  onChooseSchedule,
  canChooseSchedule,
  historyBodyRef,
  seasonCardRefs,
  canEdit,
  editButtonRefs,
  onEditSeason
}: {
  displayOnlyCurrentSeason?: SeasonCardSchedule;
  seasons: readonly RhythmScheduleHistorySegment[];
  asOfDate: string;
  scoreInput: SelectRhythmScoreInput;
  overallHealthScore: number | null;
  onChooseSchedule?: (event: MouseEvent<HTMLButtonElement>) => void;
  canChooseSchedule: boolean;
  historyBodyRef: { current: HTMLDivElement | null };
  seasonCardRefs: Map<string, HTMLElement>;
  canEdit: boolean;
  editButtonRefs: Map<string, HTMLButtonElement>;
  onEditSeason: (season: RhythmSeasonEditTarget, opener: HTMLButtonElement) => void;
}) {
  const timeOptions = useRhythmTimeOptions();
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
  const paletteAssignments = rhythmSeasonPaletteAssignments(seasons);
  const displayCurrent: SeasonCardSchedule | undefined = current ?? displayOnlyCurrentSeason;
  const healthForSeason = (season: RhythmScheduleHistorySegment, endDate?: string) => {
    const result = selectRhythmSeasonScore(scoreInput, season, endDate);
    return result.kind === 'rhythm-score' ? result.healthScore : null;
  };
  const displayOnlyHealthScore = displayCurrent && !current && !scoreInput.scoring
    ? overallHealthScore
    : null;
  const currentDisplay = displayCurrent && current
    ? { ...displayCurrent, paletteToken: paletteAssignments.get(current.id) ?? current.paletteToken }
    : displayCurrent;
  const previous = (currentIndex >= 0
    ? seasons.slice(0, currentIndex + (current ? 0 : 1))
    : []).map((season, index) => ({
    season,
    index
  })).reverse();
  const upcoming = currentIndex >= 0 ? seasons.slice(currentIndex + 1) : seasons;
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
  const currentTimeLabel = currentDisplay ? seasonTimeLabel(currentDisplay, timeOptions) : undefined;
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
                className={`rhythm-history-view__season-timeline-segment ${seasonVisualClass(
                  season.kind,
                  paletteAssignments.get(season.id) ?? season.paletteToken
                )}`}
                style={{ flexGrow: duration }}
                aria-label={`Go to ${label}, ${dateRange}`}
                onClick={() => focusSeasonCard(season.id)}
              />
            );
          })}
        </div>
      )}
      {currentDisplay && (
        <section className="rhythm-history-view__season-group">
          <h4 className="rhythm-history-view__season-group-title">Current Season</h4>
          <div className="rhythm-history-view__season-cards">
            <RhythmSeasonCard
              seasonKind="scheduled"
              paletteToken={currentDisplay.paletteToken}
              seasonId={currentDisplay.id}
              cardRefs={seasonCardRefs}
              highlighted={highlightedSeasonId === currentDisplay.id}
              title={currentName || formatRhythmSchedule(currentDisplay.schedule, 'compact')}
              dateRange={{
                ...(currentDisplay.startDate ? { startDate: currentDisplay.startDate } : {}),
                endLabel: 'Present'
              }}
              healthScore={current ? healthForSeason(current) : displayOnlyHealthScore}
              schedule={currentDisplay.schedule}
              timeLabel={currentTimeLabel ?? 'Time of day not recorded'}
              actions={(
                canEdit ? (
                  <SeasonEditButton
                    seasonId={currentDisplay.id}
                    label={currentName || formatRhythmSchedule(currentDisplay.schedule, 'compact')}
                    editButtonRefs={editButtonRefs}
                    onEditSeason={onEditSeason}
                    season={currentDisplay}
                  />
                ) : undefined
              )}
            />
          </div>
        </section>
      )}
      {currentDisplay && previous.length > 0 && (
        <div className="rhythm-history-view__seasons-divider" aria-hidden="true" />
      )}
      {previous.length > 0 && (
        <section className="rhythm-history-view__season-group">
          <h4 className="rhythm-history-view__season-group-title">Earlier Seasons</h4>
          <div className="rhythm-history-view__season-cards">
            {previous.map(({ season, index }) => {
              const endDate = rhythmSeasonInclusiveEndDate(seasons, index) ?? season.startDate;
              const timeLabel = season.kind === 'scheduled' ? seasonTimeLabel(season, timeOptions) : undefined;
              const heading = season.kind === 'unknown'
                ? 'Earlier schedule needs details'
                : season.name?.trim() || formatRhythmSchedule(season.schedule, 'compact');
              return (
                <RhythmSeasonCard
                  key={season.id}
                  seasonKind={season.kind}
                  paletteToken={paletteAssignments.get(season.id) ?? season.paletteToken}
                  seasonId={season.id}
                  cardRefs={seasonCardRefs}
                  highlighted={highlightedSeasonId === season.id}
                  title={heading}
                  dateRange={{ startDate: season.startDate, endDate }}
                  healthScore={healthForSeason(season, endDate)}
                  {...(season.kind === 'scheduled'
                    ? {
                        schedule: season.schedule,
                        timeLabel: timeLabel ?? 'Time of day not recorded'
                      }
                    : {})}
                  {...(season.kind === 'unknown' ? {
                    scheduleLabel: 'Schedule details unavailable.',
                    timeLabel: 'Time of day not recorded'
                  } : {})}
                  {...(season.kind === 'unknown'
                    ? season.descriptiveCadence
                      ? { note: `Original description: ${season.descriptiveCadence}` }
                      : {}
                    : season.note
                      ? { note: season.note }
                      : {})}
                  actions={(
                    season.kind === 'unknown' ? (
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
                    ) : canEdit ? (
                      <SeasonEditButton
                        seasonId={season.id}
                        label={heading}
                        editButtonRefs={editButtonRefs}
                        onEditSeason={onEditSeason}
                        season={season}
                      />
                    ) : undefined
                  )}
                />
              );
            })}
          </div>
        </section>
      )}
      {upcoming.length > 0 && (
        <section className="rhythm-history-view__season-group">
          <h4 className="rhythm-history-view__season-group-title">Upcoming Seasons</h4>
          <div className="rhythm-history-view__season-cards">
            {upcoming.map((season, offset) => {
              const index = currentIndex >= 0 ? currentIndex + 1 + offset : offset;
              const endDate = rhythmSeasonInclusiveEndDate(seasons, index);
              const timeLabel = season.kind === 'scheduled' ? seasonTimeLabel(season, timeOptions) : undefined;
              const heading = season.kind === 'unknown'
                ? 'Upcoming schedule needs details'
                : season.name?.trim() || formatRhythmSchedule(season.schedule, 'compact');
              return (
                <RhythmSeasonCard
                  key={season.id}
                  seasonKind={season.kind}
                  paletteToken={paletteAssignments.get(season.id) ?? season.paletteToken}
                  seasonId={season.id}
                  cardRefs={seasonCardRefs}
                  highlighted={highlightedSeasonId === season.id}
                  title={heading}
                  dateRange={{
                    startDate: season.startDate,
                    ...(endDate ? { endDate } : { endLabel: 'Upcoming' })
                  }}
                  healthScore={null}
                  {...(season.kind === 'scheduled'
                    ? {
                        schedule: season.schedule,
                        timeLabel: timeLabel ?? 'Time of day not recorded'
                      }
                    : {
                        scheduleLabel: 'Schedule details unavailable.',
                        timeLabel: 'Time of day not recorded'
                      })}
                  {...(season.kind === 'unknown' && season.descriptiveCadence
                    ? { note: `Original description: ${season.descriptiveCadence}` }
                    : season.kind === 'scheduled' && season.note
                      ? { note: season.note }
                      : {})}
                  actions={(
                    season.kind === 'unknown' ? (
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
                        Set schedule details
                      </button>
                    ) : canEdit ? (
                      <SeasonEditButton
                        seasonId={season.id}
                        label={heading}
                        editButtonRefs={editButtonRefs}
                        onEditSeason={onEditSeason}
                        season={season}
                      />
                    ) : undefined
                  )}
                />
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

type SeasonCardSchedule = Pick<
  RhythmScheduleSegment,
  'kind' | 'id' | 'schedule' | 'name' | 'note' | 'timeOfDay' | 'paletteToken'
> & { startDate?: string | undefined };

function seasonVisualClass(
  kind: RhythmScheduleHistorySegment['kind'],
  paletteToken: RhythmScheduleHistorySegment['paletteToken']
): string {
  if (kind === 'unknown') return 'rhythm-history-view__season-visual--unknown';
  return `rhythm-history-view__season-visual--${paletteToken}`;
}

type SeasonEditButtonProps = {
  seasonId: string;
  label: string;
  editButtonRefs: Map<string, HTMLButtonElement>;
} & (
  | {
      season: RhythmSeasonEditTarget;
      onEditSeason: (season: RhythmSeasonEditTarget, opener: HTMLButtonElement) => void;
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

function seasonTimeLabel(
  season: Pick<RhythmScheduleSegment, 'timeOfDay'>,
  timeOptions: ReturnType<typeof useRhythmTimeOptions>
): string | undefined {
  if (!season.timeOfDay) return undefined;
  return timeOptions.find(option => option.value === season.timeOfDay)?.label;
}

function formatHistoryDate(value: string, long = true): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', long
    ? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
    : { month: 'short', day: 'numeric' });
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
