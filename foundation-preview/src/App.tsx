import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { AppNavigation } from './components/AppNavigation.tsx';
import type { Destination, TextSize } from './components/AppNavigation.tsx';
import { MarriageView } from './components/MarriageView.tsx';
import { RhythmDetailsDialog } from './components/RhythmDetailsDialog.tsx';
import { RhythmCompletionDialog } from './components/RhythmCompletionDialog.tsx';
import { FinanceGoalsView } from './components/FinanceGoalsView.tsx';
import { PreviewDataControls } from './components/PreviewDataControls.tsx';
import type { PreviewPersistenceStatus } from './components/PreviewDataControls.tsx';
import { PersonProfilePlaceholder } from './components/PersonProfilePlaceholder.tsx';
import { RhythmEditor } from './components/RhythmEditor.tsx';
import { TodayView } from './components/TodayView.tsx';
import {
  marriageRhythms,
  personById,
  peopleForRhythm,
  todayRhythms,
  type MarriageExampleId,
  type PersonId,
  type RhythmPreview
} from './domain/preview-data.ts';
import {
  saveCheckIn,
  type CheckInDraft,
  type CheckInDraftErrors,
  type GoalCheckIn,
  localDateString,
  type MoneyGoal
} from './domain/money-goals.ts';
import { createSamplePreviewData, parsePreviewBackup } from './domain/preview-state.ts';
import type { PreviewData } from './domain/preview-state.ts';
import type { DatedRhythmCompletion, RhythmCompletionRecord } from './domain/rhythm-completion.ts';
import {
  deleteDatedCompletion,
  removeActionCompletion,
  rhythmCompletionStateForDate
} from './domain/rhythm-completion.ts';
import { resolveSeedCompletionRecords } from './domain/rhythm-history.ts';
import { localDateInTimeZone } from './domain/rhythm-scoring.ts';
import {
  activeTodayRhythms,
  archiveRhythmId,
  archivedTodayRhythms,
  isEditableRhythmId,
  resolveTodayRhythms,
  restoreRhythmId,
  rhythmsForCategory,
  saveRhythmDraft
} from './domain/rhythm-editor.ts';
import type { RhythmDraft, RhythmDraftErrors } from './domain/rhythm-editor.ts';
import type { RhythmSeasonEditDraft } from './domain/rhythm-season-edit.ts';
import { editRhythmSeason } from './domain/rhythm-season-edit.ts';
import { rhythmScheduleSummary, rhythmTimeLabel } from './domain/rhythm-schedule.ts';
import { rhythmSchedulesEqual } from './domain/rhythm-occurrences.ts';
import {
  browserPreviewStorage,
  listenForPreviewChanges,
  loadV2RecoveryCopy,
  loadV1RecoveryCopy,
  loadV3RecoveryCopy,
  loadV4RecoveryCopy,
  loadV5RecoveryCopy,
  loadV6RecoveryCopy,
  loadV7RecoveryCopy,
  loadV8RecoveryCopy,
  loadV9RecoveryCopy,
  loadV10RecoveryCopy,
  loadPreview,
  writePreview
} from './storage/preview-storage.ts';

const destinationLabels: Record<Exclude<Destination, 'today'>, string> = {
  focus: 'Focus',
  people: 'People',
  more: 'More',
  faith: 'Faith',
  marriage: 'Marriage',
  parenting: 'Parenting',
  health: 'Health & Fitness',
  finances: 'Finances',
  friendships: 'Friendships'
};

function isDatedCompletionRecord(record: RhythmCompletionRecord): record is DatedRhythmCompletion {
  return typeof record.localTime === 'string'
    && typeof record.timeZone === 'string'
    && typeof record.completedAt === 'string'
    && typeof record.recordedAt === 'string';
}

export function App() {
  const [destination, setDestination] = useState<Destination>('today');
  const [previewData, setPreviewData] = useState<PreviewData>(createSamplePreviewData);
  const [hydrated, setHydrated] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [persistenceStatus, setPersistenceStatus] = useState<PreviewPersistenceStatus>({ kind: 'loading' });
  const [v1RecoveryCopy, setV1RecoveryCopy] = useState<string | null>(null);
  const [v1RecoveryError, setV1RecoveryError] = useState<string | null>(null);
  const [v2RecoveryCopy, setV2RecoveryCopy] = useState<string | null>(null);
  const [v2RecoveryError, setV2RecoveryError] = useState<string | null>(null);
  const [v3RecoveryCopy, setV3RecoveryCopy] = useState<string | null>(null);
  const [v3RecoveryError, setV3RecoveryError] = useState<string | null>(null);
  const [v4RecoveryCopy, setV4RecoveryCopy] = useState<string | null>(null);
  const [v4RecoveryError, setV4RecoveryError] = useState<string | null>(null);
  const [v5RecoveryCopy, setV5RecoveryCopy] = useState<string | null>(null);
  const [v5RecoveryError, setV5RecoveryError] = useState<string | null>(null);
  const [v6RecoveryCopy, setV6RecoveryCopy] = useState<string | null>(null);
  const [v6RecoveryError, setV6RecoveryError] = useState<string | null>(null);
  const [v7RecoveryCopy, setV7RecoveryCopy] = useState<string | null>(null);
  const [v7RecoveryError, setV7RecoveryError] = useState<string | null>(null);
  const [v8RecoveryCopy, setV8RecoveryCopy] = useState<string | null>(null);
  const [v8RecoveryError, setV8RecoveryError] = useState<string | null>(null);
  const [v9RecoveryCopy, setV9RecoveryCopy] = useState<string | null>(null);
  const [v9RecoveryError, setV9RecoveryError] = useState<string | null>(null);
  const [v10RecoveryCopy, setV10RecoveryCopy] = useState<string | null>(null);
  const [v10RecoveryError, setV10RecoveryError] = useState<string | null>(null);
  const expectedRaw = useRef<string | null>(null);
  const externalRaw = useRef<string | null>(null);
  const skipNextAutosave = useRef(false);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [textSize, setTextSize] = useState<TextSize>('small');
  const [marriageExampleId, setMarriageExampleId] = useState<MarriageExampleId>('populated');
  const [selectedPersonId, setSelectedPersonId] = useState<PersonId | null>(null);
  const [activeRhythmId, setActiveRhythmId] = useState<string | null>(null);
  const [detailsInitialView, setDetailsInitialView] = useState<'details' | 'history'>('details');
  const [completionDialogRhythmId, setCompletionDialogRhythmId] = useState<string | null>(null);
  const [rhythmEditor, setRhythmEditor] = useState<{
    id: string;
    rhythm?: (typeof todayRhythms)[number];
  } | null>(null);
  const dialogOpener = useRef<HTMLButtonElement | null>(null);
  const completionDialogOpener = useRef<HTMLButtonElement | null>(null);
  const rhythmEditorOpener = useRef<HTMLButtonElement | null>(null);
  const wasDetailsOpen = useRef(false);
  const wasRhythmEditorOpen = useRef(false);

  const dateLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).format(new Date());
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  function rhythmWithSavedCompletions(rhythm: RhythmPreview): RhythmPreview {
    const seededRecords = resolveSeedCompletionRecords(
      rhythm.completionHistory,
      previewData.rhythmCompletionOverrides,
      previewData.removedSeedCompletionIds
    );
    const datedRecords = previewData.datedRhythmCompletions.filter(item => item.rhythmId === rhythm.id);
    const completionHistory = seededRecords === undefined && datedRecords.length === 0
      ? undefined
      : [...(seededRecords ?? []), ...datedRecords];
    return completionHistory === undefined
      ? rhythm
      : { ...rhythm, completionHistory };
  }
  const allTodayRhythms = resolveTodayRhythms(previewData.savedRhythms).map(rhythmWithSavedCompletions);
  const editableTodayRhythms = activeTodayRhythms(allTodayRhythms, previewData.archivedRhythmIds);
  const archivedRhythms = archivedTodayRhythms(allTodayRhythms, previewData.archivedRhythmIds);
  const userRhythms = editableTodayRhythms.filter(rhythm =>
    previewData.savedRhythms.some(saved => saved.id === rhythm.id)
  );
  const marriageCategoryRhythms = rhythmsForCategory(userRhythms, 'marriage');
  const activeRhythm = [
    ...allTodayRhythms,
    ...marriageRhythms.map(rhythmWithSavedCompletions)
  ].find(rhythm => rhythm.id === activeRhythmId) ?? null;
  const selectedPerson = selectedPersonId === null ? null : personById(selectedPersonId);
  const activeRhythmIsToday = activeRhythm !== null && editableTodayRhythms.some(rhythm => rhythm.id === activeRhythm.id);
  const activeRhythmIsArchived = activeRhythm !== null && previewData.archivedRhythmIds.includes(activeRhythm.id);
  const activeRhythmForDetails = activeRhythm;
  const completionDialogRhythm = completionDialogRhythmId
    ? allTodayRhythms.find(rhythm => rhythm.id === completionDialogRhythmId) ?? null
    : null;
  const currentDate = localDateString(new Date());
  const initialLoadDate = useRef(currentDate).current;
  const completionStates = new Map(allTodayRhythms.map(rhythm => {
    const timeZone = rhythm.scoring?.timeZone
      ?? rhythm.createdTimeZone
      ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    const effectiveDate = localDateInTimeZone(new Date(), timeZone);
    const state = rhythmCompletionStateForDate(
      rhythm.id,
      effectiveDate,
      previewData.completedRhythmIds,
      previewData.activeRhythmCompletions,
      (rhythm.completionHistory ?? []).map(record => ({ ...record, rhythmId: rhythm.id }))
    );
    return [rhythm.id, state] as const;
  }));
  const completedRhythms = new Set(
    [...completionStates].filter(([, state]) => state.completed).map(([id]) => id)
  );
  const undoableRhythms = new Set(
    [...completionStates].filter(([, state]) => state.undoable).map(([id]) => id)
  );
  const moneyGoals = previewData.goals;

  function refreshV1RecoveryCopy() {
    const result = loadV1RecoveryCopy(browserPreviewStorage());
    if (result.kind === 'loaded') {
      setV1RecoveryCopy(result.raw);
      setV1RecoveryError(null);
    } else {
      setV1RecoveryCopy(null);
      setV1RecoveryError(result.message);
    }
  }

  function refreshV2RecoveryCopy() {
    const result = loadV2RecoveryCopy(browserPreviewStorage());
    if (result.kind === 'loaded') {
      setV2RecoveryCopy(result.raw);
      setV2RecoveryError(null);
    } else {
      setV2RecoveryCopy(null);
      setV2RecoveryError(result.message);
    }
  }

  function refreshV3RecoveryCopy() {
    const result = loadV3RecoveryCopy(browserPreviewStorage());
    if (result.kind === 'loaded') {
      setV3RecoveryCopy(result.raw);
      setV3RecoveryError(null);
    } else {
      setV3RecoveryCopy(null);
      setV3RecoveryError(result.message);
    }
  }

  function refreshV4RecoveryCopy() {
    const result = loadV4RecoveryCopy(browserPreviewStorage());
    if (result.kind === 'loaded') {
      setV4RecoveryCopy(result.raw);
      setV4RecoveryError(null);
    }
    else {
      setV4RecoveryCopy(null);
      setV4RecoveryError(result.message);
    }
  }

  function refreshV5RecoveryCopy() {
    const result = loadV5RecoveryCopy(browserPreviewStorage());
    if (result.kind === 'loaded') {
      setV5RecoveryCopy(result.raw);
      setV5RecoveryError(null);
    } else {
      setV5RecoveryCopy(null);
      setV5RecoveryError(result.message);
    }
  }

  function refreshV6RecoveryCopy() {
    const result = loadV6RecoveryCopy(browserPreviewStorage());
    if (result.kind === 'loaded') {
      setV6RecoveryCopy(result.raw);
      setV6RecoveryError(null);
    } else {
      setV6RecoveryCopy(null);
      setV6RecoveryError(result.message);
    }

  }

  function refreshV7RecoveryCopy() {
    const result = loadV7RecoveryCopy(browserPreviewStorage());
    if (result.kind === 'loaded') {
      setV7RecoveryCopy(result.raw);
      setV7RecoveryError(null);
    } else {
      setV7RecoveryCopy(null);
      setV7RecoveryError(result.message);
    }
  }

  function refreshV8RecoveryCopy() {
    const result = loadV8RecoveryCopy(browserPreviewStorage());
    if (result.kind === 'loaded') {
      setV8RecoveryCopy(result.raw);
      setV8RecoveryError(null);
    } else {
      setV8RecoveryCopy(null);
      setV8RecoveryError(result.message);
    }
  }

  function refreshV9RecoveryCopy() {
    const result = loadV9RecoveryCopy(browserPreviewStorage());
    if (result.kind === 'loaded') {
      setV9RecoveryCopy(result.raw);
      setV9RecoveryError(null);
    } else {
      setV9RecoveryCopy(null);
      setV9RecoveryError(result.message);
    }
    refreshV10RecoveryCopy();
  }

  function refreshV10RecoveryCopy() {
    const result = loadV10RecoveryCopy(browserPreviewStorage());
    if (result.kind === 'loaded') {
      setV10RecoveryCopy(result.raw);
      setV10RecoveryError(null);
    } else {
      setV10RecoveryCopy(null);
      setV10RecoveryError(result.message);
    }
  }

  useEffect(() => {
    refreshV1RecoveryCopy();
    refreshV2RecoveryCopy();
    refreshV3RecoveryCopy();
    refreshV4RecoveryCopy();
    refreshV5RecoveryCopy();
    refreshV6RecoveryCopy();
    refreshV7RecoveryCopy();
    refreshV8RecoveryCopy();
    refreshV9RecoveryCopy();
    const loaded = loadPreview(browserPreviewStorage(), initialLoadDate);
    if (loaded.kind === 'loaded') {
      expectedRaw.current = loaded.raw;
      skipNextAutosave.current = true;
      setPreviewData(loaded.data);
      setPersistenceStatus({ kind: 'saved' });
      setAutoSaveEnabled(true);
    } else if (loaded.kind === 'missing') {
      expectedRaw.current = null;
      setPreviewData(createSamplePreviewData());
      setPersistenceStatus({ kind: 'saving' });
      setAutoSaveEnabled(true);
    } else if (loaded.kind === 'corrupt' || loaded.kind === 'unsupported') {
      expectedRaw.current = loaded.raw;
      setPersistenceStatus({ kind: loaded.kind, raw: loaded.raw, message: loaded.message });
    } else {
      setPersistenceStatus({ kind: 'unavailable', message: loaded.message });
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !autoSaveEnabled) return;
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    const saved = writePreview(browserPreviewStorage(), previewData, expectedRaw.current, { currentDate });
    refreshV1RecoveryCopy();
    refreshV2RecoveryCopy();
    refreshV3RecoveryCopy();
    refreshV4RecoveryCopy();
    refreshV5RecoveryCopy();
    refreshV6RecoveryCopy();
    refreshV7RecoveryCopy();
    refreshV8RecoveryCopy();
    refreshV9RecoveryCopy();
    if (saved.kind === 'saved') {
      expectedRaw.current = saved.raw;
      setPersistenceStatus({ kind: 'saved' });
    } else if (saved.kind === 'conflict') {
      externalRaw.current = saved.actualRaw;
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'conflict' });
    } else {
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'error', message: saved.message });
    }
  }, [previewData, hydrated, autoSaveEnabled]);

  useEffect(() => {
    if (!hydrated) return;
    return listenForPreviewChanges(newValue => {
      if (newValue === expectedRaw.current) return;
      externalRaw.current = newValue;
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'conflict' });
    });
  }, [hydrated]);

  useEffect(() => {
    document.documentElement.dataset.mobileTextSize = textSize === 'small' ? 'normal' : textSize === 'medium' ? 'large' : 'larger';
    document.documentElement.dataset.mobileTextSizeLevel = textSize === 'large' ? 'larger' : textSize;
  }, [textSize]);

  useEffect(() => {
    if (activeRhythmId) {
      wasDetailsOpen.current = true;
      return;
    }
    if (!wasDetailsOpen.current) return;
    wasDetailsOpen.current = false;
    if (dialogOpener.current?.isConnected) dialogOpener.current.focus();
    else document.querySelector<HTMLButtonElement>('.utility-primary-button[aria-current="page"]')?.focus();
  }, [activeRhythmId]);

  useEffect(() => {
    if (completionDialogRhythmId !== null) return;
    const opener = completionDialogOpener.current;
    if (opener?.isConnected) {
      if (opener.disabled) {
        opener.closest('article')
          ?.querySelector<HTMLButtonElement>(
            '.today-rhythm-details__history-button, .today-rhythm-card__details-toggle'
          )
          ?.focus();
      } else {
        opener.focus();
      }
    }
    completionDialogOpener.current = null;
  }, [completionDialogRhythmId]);

  useEffect(() => {
    if (rhythmEditor) {
      wasRhythmEditorOpen.current = true;
      return;
    }
    if (!wasRhythmEditorOpen.current) return;
    wasRhythmEditorOpen.current = false;
    if (rhythmEditorOpener.current?.isConnected) rhythmEditorOpener.current.focus();
    else document.querySelector<HTMLButtonElement>('.today-archived-rhythms-toggle')?.focus();
  }, [rhythmEditor]);

  function navigate(next: Destination, personId?: PersonId) {
    setDestination(next);
    setSelectedPersonId(personId ?? null);
    setSearch('');
    setSearchOpen(false);
    document.body.classList.remove('mobile-search-open');
  }

  function closeSearch() {
    setSearch('');
    setSearchOpen(false);
    document.body.classList.remove('mobile-search-open');
  }

  function toggleSearch() {
    const next = !searchOpen;
    setSearchOpen(next);
    document.body.classList.toggle('mobile-search-open', next);
    if (!next) setSearch('');
  }

  function openRhythmHistory(id: string, event: MouseEvent<HTMLButtonElement>) {
    dialogOpener.current = event.currentTarget;
    setDetailsInitialView('history');
    setActiveRhythmId(id);
  }

  function openCompletion(id: string, event: MouseEvent<HTMLButtonElement>) {
    if (!isEditableRhythmId(id) || completedRhythms.has(id)
      || previewData.archivedRhythmIds.includes(id)) return;
    completionDialogOpener.current = event.currentTarget;
    setCompletionDialogRhythmId(id);
  }

  function openRhythmEditor(
    event: MouseEvent<HTMLButtonElement>,
    rhythm?: (typeof todayRhythms)[number]
  ) {
    rhythmEditorOpener.current = event.currentTarget;
    setRhythmEditor({
      id: rhythm?.id ?? `user-rhythm-${globalThis.crypto.randomUUID()}`,
      ...(rhythm ? { rhythm } : {})
    });
  }

  function saveRhythm(draft: RhythmDraft): RhythmDraftErrors {
    if (!rhythmEditor) return { title: 'The Rhythm editor is no longer active.' };
    const scoringTimeZone = rhythmEditor.rhythm?.scoring?.timeZone
      ?? rhythmEditor.rhythm?.createdTimeZone
      ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    const hasDatedCompletionHistory = previewData.rhythmHistoryIds.includes(rhythmEditor.id)
      || (rhythmEditor.rhythm?.completionHistory?.length ?? 0) > 0;
    const result = saveRhythmDraft(
      previewData.savedRhythms,
      draft,
      rhythmEditor.id,
      rhythmEditor.rhythm ? 'edit' : 'create',
      {
        currentDate: localDateInTimeZone(new Date(), scoringTimeZone),
        deviceTimeZone: scoringTimeZone,
        hasDatedCompletionHistory
      }
    );
    const savedRhythms = result.savedRhythms;
    if (!savedRhythms) return result.errors;
    const nextData: PreviewData = {
      ...previewData,
      savedRhythms,
      ...(hasDatedCompletionHistory && !previewData.rhythmHistoryIds.includes(rhythmEditor.id)
        ? { rhythmHistoryIds: [...previewData.rhythmHistoryIds, rhythmEditor.id] }
        : {})
    };
    const written = writePreview(browserPreviewStorage(), nextData, expectedRaw.current, { currentDate });
    refreshV1RecoveryCopy();
    refreshV2RecoveryCopy();
    refreshV3RecoveryCopy();
    refreshV4RecoveryCopy();
    refreshV5RecoveryCopy();
    refreshV6RecoveryCopy();
    refreshV7RecoveryCopy();
    refreshV8RecoveryCopy();
    refreshV9RecoveryCopy();
    if (written.kind === 'conflict') {
      externalRaw.current = written.actualRaw;
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'conflict' });
      return { title: 'Preview storage changed in another tab. No Rhythm changes were saved.' };
    }
    if (written.kind === 'error') {
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'error', message: written.message });
      return { title: `Preview could not save this Rhythm. ${written.message}` };
    }
    expectedRaw.current = written.raw;
    externalRaw.current = null;
    skipNextAutosave.current = true;
    setPreviewData(nextData);
    setAutoSaveEnabled(true);
    setPersistenceStatus({ kind: 'saved' });
    setRhythmEditor(null);
    return result.errors;
  }

  function saveSeasonCorrection(rhythmId: string, draft: RhythmSeasonEditDraft): string | null {
    if (!activeRhythmIsToday || activeRhythmIsArchived) {
      return 'This Rhythm is read-only.';
    }
    const savedRhythm = previewData.savedRhythms.find(rhythm => rhythm.id === rhythmId);
    if (!savedRhythm?.schedule || !savedRhythm.scoring) {
      return 'This Rhythm no longer has editable schedule history.';
    }
    const result = editRhythmSeason(rhythmId, savedRhythm.schedule, savedRhythm.scoring, draft);
    if (!result.valid) return result.error;

    const savedRhythms = previewData.savedRhythms.map(rhythm => rhythm.id !== rhythmId
      ? rhythm
      : {
          ...rhythm,
          ...(rhythm.schedule && rhythmSchedulesEqual(rhythm.schedule, result.schedule)
            ? {}
            : { cadence: rhythmScheduleSummary(result.schedule) }),
          schedule: result.schedule,
          scoring: result.scoring,
          ...(result.activeTimeOfDay === undefined ? {} : {
            timeOfDay: result.activeTimeOfDay,
            timeLabel: rhythmTimeLabel(result.activeTimeOfDay)
          })
        });
    const nextData: PreviewData = { ...previewData, savedRhythms };
    const written = writePreview(browserPreviewStorage(), nextData, expectedRaw.current, { currentDate });
    refreshV1RecoveryCopy();
    refreshV2RecoveryCopy();
    refreshV3RecoveryCopy();
    refreshV4RecoveryCopy();
    refreshV5RecoveryCopy();
    refreshV6RecoveryCopy();
    refreshV7RecoveryCopy();
    refreshV8RecoveryCopy();
    refreshV9RecoveryCopy();
    if (written.kind === 'conflict') {
      externalRaw.current = written.actualRaw;
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'conflict' });
      return 'Preview storage changed in another tab. No schedule changes were saved.';
    }
    if (written.kind === 'error') {
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'error', message: written.message });
      return `Preview could not save this schedule correction. ${written.message}`;
    }
    expectedRaw.current = written.raw;
    externalRaw.current = null;
    skipNextAutosave.current = true;
    setPreviewData(nextData);
    setAutoSaveEnabled(true);
    setPersistenceStatus({ kind: 'saved' });
    return null;
  }

  function archiveRhythm(id: string) {
    setPreviewData(previous => {
      const archivedRhythmIds = archiveRhythmId(previous.savedRhythms, previous.archivedRhythmIds, id);
      return archivedRhythmIds
        ? { ...previous, archivedRhythmIds }
        : previous;
    });
    setRhythmEditor(null);
  }

  function restoreRhythm(id: string) {
    setPreviewData(previous => {
      const archivedRhythmIds = restoreRhythmId(previous.savedRhythms, previous.archivedRhythmIds, id);
      return archivedRhythmIds
        ? { ...previous, archivedRhythmIds }
        : previous;
    });
  }

  function saveDatedCompletion(candidate: RhythmCompletionRecord, source: 'tend' | 'history' = 'tend'): string | null {
    if (!isDatedCompletionRecord(candidate)) {
      return 'A new completion must include its selected local time. No completion was saved.';
    }
    const record = candidate;
    const isTendAction = source === 'tend';
    if (!isEditableRhythmId(record.rhythmId)
      || !resolveTodayRhythms(previewData.savedRhythms).some(rhythm => rhythm.id === record.rhythmId)
      || previewData.archivedRhythmIds.includes(record.rhythmId)
      || (isTendAction && completedRhythms.has(record.rhythmId))) {
      return 'This Rhythm cannot be completed right now. No completion was saved.';
    }
    setPreviewData(previous => {
      if (isTendAction && completedRhythms.has(record.rhythmId)) return previous;
      return {
        ...previous,
        datedRhythmCompletions: [...previous.datedRhythmCompletions, record],
        rhythmHistoryIds: previous.rhythmHistoryIds.includes(record.rhythmId)
          ? previous.rhythmHistoryIds
          : [...previous.rhythmHistoryIds, record.rhythmId],
        ...(isTendAction
          ? {
              completedRhythmIds: previous.completedRhythmIds.includes(record.rhythmId)
                ? previous.completedRhythmIds
                : [...previous.completedRhythmIds, record.rhythmId],
              activeRhythmCompletions: [
                ...previous.activeRhythmCompletions.filter(item => item.rhythmId !== record.rhythmId),
                { rhythmId: record.rhythmId, completionId: record.id }
              ]
            }
          : {})
      };
    });
    return null;
  }

  function updateDatedCompletion(record: RhythmCompletionRecord): string | null {
    const existing = previewData.datedRhythmCompletions.find(item => item.id === record.id);
    if (!isEditableRhythmId(record.rhythmId)
      || previewData.archivedRhythmIds.includes(record.rhythmId)
      || !resolveTodayRhythms(previewData.savedRhythms).some(rhythm => rhythm.id === record.rhythmId)) {
      return 'This logged moment can no longer be edited. No changes were saved.';
    }
    if (existing) {
      if (existing.rhythmId !== record.rhythmId || !isDatedCompletionRecord(record)) {
        return 'A recorded time must remain complete and valid. No changes were saved.';
      }
      setPreviewData(previous => ({
        ...previous,
        datedRhythmCompletions: previous.datedRhythmCompletions.map(item =>
          item.id === record.id && item.rhythmId === record.rhythmId
            ? { ...record, recordedAt: item.recordedAt }
            : item
        )
      }));
      return null;
    }
    const seedRecord = todayRhythms
      .find(rhythm => rhythm.id === record.rhythmId)
      ?.completionHistory?.find(item => item.id === record.id);
    if (!seedRecord || previewData.removedSeedCompletionIds.includes(record.id)) {
      return 'This logged moment can no longer be edited. No changes were saved.';
    }
    if (record.localTime
      ? (!record.timeZone || !record.completedAt)
      : record.timeZone !== undefined || record.completedAt !== undefined || record.recordedAt !== undefined) {
      return 'The completion time is incomplete. No changes were saved.';
    }
    setPreviewData(previous => ({
      ...previous,
      rhythmCompletionOverrides: [
        ...previous.rhythmCompletionOverrides.filter(item => item.id !== record.id),
        { ...record }
      ],
      rhythmHistoryIds: previous.rhythmHistoryIds.includes(record.rhythmId)
        ? previous.rhythmHistoryIds
        : [...previous.rhythmHistoryIds, record.rhythmId]
    }));
    return null;
  }

  function deleteDatedCompletionRecord(completionId: string): string | null {
    const record = previewData.datedRhythmCompletions.find(item => item.id === completionId);
    const seedRhythmId = todayRhythms.find(rhythm =>
      rhythm.completionHistory?.some(item => item.id === completionId)
    )?.id;
    const rhythmId = record?.rhythmId ?? seedRhythmId;
    if (!rhythmId || !isEditableRhythmId(rhythmId)
      || previewData.archivedRhythmIds.includes(rhythmId)
      || !resolveTodayRhythms(previewData.savedRhythms).some(rhythm => rhythm.id === rhythmId)) {
      return 'This logged moment can no longer be deleted. No changes were made.';
    }
    if (!record) {
      setPreviewData(previous => ({
        ...previous,
        rhythmCompletionOverrides: previous.rhythmCompletionOverrides.filter(item => item.id !== completionId),
        removedSeedCompletionIds: previous.removedSeedCompletionIds.includes(completionId)
          ? previous.removedSeedCompletionIds
          : [...previous.removedSeedCompletionIds, completionId],
        rhythmHistoryIds: previous.rhythmHistoryIds.includes(rhythmId)
          ? previous.rhythmHistoryIds
          : [...previous.rhythmHistoryIds, rhythmId]
      }));
      return null;
    }
    setPreviewData(previous => {
      const result = deleteDatedCompletion(
        previous.datedRhythmCompletions,
        previous.activeRhythmCompletions,
        previous.completedRhythmIds,
        completionId
      );
      return {
        ...previous,
        datedRhythmCompletions: result.records,
        activeRhythmCompletions: result.active,
        completedRhythmIds: result.completedRhythmIds
      };
    });
    return null;
  }

  function undoTend(id: string) {
    setPreviewData(previous => {
      const completionIndex = previous.completedRhythmIds.indexOf(id);
      if (completionIndex === -1
        || !resolveTodayRhythms(previous.savedRhythms).some(rhythm => rhythm.id === id)) return previous;
      const reversed = removeActionCompletion(
        previous.datedRhythmCompletions,
        previous.activeRhythmCompletions,
        id
      );
      return {
        ...previous,
        datedRhythmCompletions: reversed.records,
        activeRhythmCompletions: reversed.active,
        completedRhythmIds: [
          ...previous.completedRhythmIds.slice(0, completionIndex),
          ...previous.completedRhythmIds.slice(completionIndex + 1)
        ]
      };
    });
  }

  function saveGoal(goal: MoneyGoal) {
    setPreviewData(previous => ({
      ...previous,
      goals: previous.goals.some(item => item.id === goal.id)
        ? previous.goals.map(item => item.id === goal.id ? goal : item)
        : [...previous.goals, goal]
    }));
  }

  function saveGoalCheckIn(
    goalId: string,
    draft: CheckInDraft,
    correctingCheckIn?: GoalCheckIn
  ): CheckInDraftErrors {
    const goal = previewData.goals.find(item => item.id === goalId);
    if (!goal) return { balance: 'This example goal is no longer available.' };
    const result = saveCheckIn(goal, draft, new Date().toISOString(), currentDate, correctingCheckIn);
    const updatedGoal = result.goal;
    if (!updatedGoal) {
      return result.errors;
    }

    const nextData: PreviewData = {
      ...previewData,
      goals: previewData.goals.map(item => item.id === goalId ? updatedGoal : item)
    };
    skipNextAutosave.current = true;
    setPreviewData(nextData);
    const written = writePreview(browserPreviewStorage(), nextData, expectedRaw.current, { currentDate });
    refreshV1RecoveryCopy();
    refreshV2RecoveryCopy();
    refreshV3RecoveryCopy();
    refreshV4RecoveryCopy();
    refreshV5RecoveryCopy();
    refreshV6RecoveryCopy();
    refreshV7RecoveryCopy();
    refreshV8RecoveryCopy();
    refreshV9RecoveryCopy();
    if (written.kind === 'saved') {
      expectedRaw.current = written.raw;
      externalRaw.current = null;
      setAutoSaveEnabled(true);
      setPersistenceStatus({ kind: 'saved' });
    } else if (written.kind === 'conflict') {
      externalRaw.current = written.actualRaw;
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'conflict' });
    } else {
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'error', message: written.message });
    }
    return result.errors;
  }

  function finishWrite(resultData: PreviewData, allowUnrecoverableReplacement = false): string | null {
    const written = writePreview(browserPreviewStorage(), resultData, expectedRaw.current, {
      allowUnrecoverableReplacement,
      currentDate
    });
    refreshV1RecoveryCopy();
    refreshV2RecoveryCopy();
    refreshV3RecoveryCopy();
    refreshV4RecoveryCopy();
    refreshV5RecoveryCopy();
    refreshV6RecoveryCopy();
    refreshV7RecoveryCopy();
    refreshV8RecoveryCopy();
    refreshV9RecoveryCopy();
    if (written.kind === 'saved') {
      expectedRaw.current = written.raw;
      externalRaw.current = null;
      skipNextAutosave.current = true;
      setPreviewData(resultData);
      setAutoSaveEnabled(true);
      setPersistenceStatus({ kind: 'saved' });
      return null;
    }
    if (written.kind === 'conflict') {
      externalRaw.current = written.actualRaw;
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'conflict' });
      return 'Preview storage changed in another tab. No data was replaced.';
    }
    setAutoSaveEnabled(false);
    setPersistenceStatus({ kind: 'error', message: written.message });
    return written.message;
  }

  function reloadExternal(): string | null {
    const raw = externalRaw.current;
    if (raw === null) {
      expectedRaw.current = null;
      return finishWrite(createSamplePreviewData());
    }
    const parsed = parsePreviewBackup(raw, currentDate);
    if (!parsed.valid) {
      expectedRaw.current = raw;
      externalRaw.current = null;
      setAutoSaveEnabled(false);
      setPersistenceStatus({
        kind: parsed.kind === 'unsupported' ? 'unsupported' : 'corrupt',
        raw,
        message: parsed.message
      });
      return parsed.message;
    }
    expectedRaw.current = raw;
    externalRaw.current = null;
    skipNextAutosave.current = true;
    setPreviewData(parsed.envelope.data);
    setAutoSaveEnabled(true);
    setPersistenceStatus({ kind: 'saved' });
    return null;
  }

  function replaceExternal(): string | null {
    const written = writePreview(browserPreviewStorage(), previewData, externalRaw.current, {
      allowUnrecoverableReplacement: true,
      currentDate
    });
    refreshV1RecoveryCopy();
    refreshV2RecoveryCopy();
    refreshV3RecoveryCopy();
    refreshV4RecoveryCopy();
    refreshV5RecoveryCopy();
    refreshV6RecoveryCopy();
    refreshV7RecoveryCopy();
    refreshV8RecoveryCopy();
    refreshV9RecoveryCopy();
    if (written.kind === 'saved') {
      expectedRaw.current = written.raw;
      externalRaw.current = null;
      skipNextAutosave.current = true;
      setAutoSaveEnabled(true);
      setPersistenceStatus({ kind: 'saved' });
      return null;
    }
    if (written.kind === 'conflict') {
      externalRaw.current = written.actualRaw;
      setPersistenceStatus({ kind: 'conflict' });
      return 'Preview storage changed again in another tab. No data was replaced.';
    }
    setPersistenceStatus({ kind: 'error', message: written.message });
    return written.message;
  }

  function retrySave() {
    skipNextAutosave.current = true;
    setAutoSaveEnabled(true);
    const written = writePreview(browserPreviewStorage(), previewData, expectedRaw.current, { currentDate });
    refreshV1RecoveryCopy();
    refreshV2RecoveryCopy();
    refreshV3RecoveryCopy();
    refreshV4RecoveryCopy();
    refreshV5RecoveryCopy();
    refreshV6RecoveryCopy();
    refreshV7RecoveryCopy();
    refreshV8RecoveryCopy();
    refreshV9RecoveryCopy();
    if (written.kind === 'saved') {
      expectedRaw.current = written.raw;
      setPersistenceStatus({ kind: 'saved' });
    } else if (written.kind === 'conflict') {
      externalRaw.current = written.actualRaw;
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'conflict' });
    } else {
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'error', message: written.message });
    }
  }

  return (
    <div className="wrap tend-app-preview" data-text-size={textSize}>
      <AppNavigation
        destination={destination}
        search={search}
        searchOpen={searchOpen}
        textSize={textSize}
        onNavigate={navigate}
        onSearchChange={setSearch}
        onSearchClose={closeSearch}
        onSearchToggle={toggleSearch}
        onTextSizeChange={() => setTextSize(size => size === 'small' ? 'medium' : size === 'medium' ? 'large' : 'small')}
      />
      <div id="view">
        {!hydrated
          ? <p role="status">Loading saved preview data…</p>
          : destination === 'today'
          ? (
            <TodayView
              greeting={greeting}
              dateLabel={dateLabel}
              completedRhythms={completedRhythms}
              undoableRhythms={undoableRhythms}
              rhythms={editableTodayRhythms}
              archivedRhythms={archivedRhythms}
              search={search}
              marriageExampleId={marriageExampleId}
              onNavigate={navigate}
              onMarriageExampleChange={setMarriageExampleId}
              onPersonSelect={personId => navigate('people', personId)}
              onHistory={openRhythmHistory}
              onTend={openCompletion}
              onEditRhythm={(rhythm, event) => openRhythmEditor(event, rhythm)}
              onUndo={undoTend}
              onAddRhythm={event => openRhythmEditor(event)}
              onRestoreRhythm={restoreRhythm}
            />
          )
          : destination === 'marriage'
            ? (
              <MarriageView
                marriageExampleId={marriageExampleId}
                onMarriageExampleChange={setMarriageExampleId}
                onPersonSelect={personId => navigate('people', personId)}
                onPartnerProfile={() => navigate('people')}
                userRhythms={marriageCategoryRhythms}
                completedRhythms={completedRhythms}
                undoableRhythms={undoableRhythms}
                onRhythmDetails={(id, event) => {
                  dialogOpener.current = event.currentTarget;
                  setDetailsInitialView('details');
                  setActiveRhythmId(id);
                }}
                onTend={openCompletion}
                onUndo={undoTend}
              />
            )
          : destination === 'finances'
            ? (
              <FinanceGoalsView
                goals={moneyGoals}
                currentDate={currentDate}
                onSaveGoal={saveGoal}
                onSaveCheckIn={saveGoalCheckIn}
                onToday={() => navigate('today')}
              />
            )
          : destination === 'people' && selectedPerson
            ? <PersonProfilePlaceholder person={selectedPerson} backLabel="Today" onBack={() => navigate('today')} />
          : <PlaceholderPage destination={destination} onToday={() => navigate('today')} />}
      </div>
      <PreviewDataControls
        data={previewData}
        status={persistenceStatus}
        currentDate={currentDate}
        onImport={data => finishWrite(data, true)}
        onReset={() => finishWrite(createSamplePreviewData(), true)}
        onRetrySave={retrySave}
        onReloadExternal={reloadExternal}
        onReplaceExternal={replaceExternal}
        v1RecoveryCopy={v1RecoveryCopy}
        v1RecoveryError={v1RecoveryError}
        v2RecoveryCopy={v2RecoveryCopy}
        v2RecoveryError={v2RecoveryError}
        v3RecoveryCopy={v3RecoveryCopy}
        v3RecoveryError={v3RecoveryError}
        v4RecoveryCopy={v4RecoveryCopy}
        v4RecoveryError={v4RecoveryError}
        v5RecoveryCopy={v5RecoveryCopy}
        v5RecoveryError={v5RecoveryError}
        v6RecoveryCopy={v6RecoveryCopy}
        v6RecoveryError={v6RecoveryError}
        v7RecoveryCopy={v7RecoveryCopy}
        v7RecoveryError={v7RecoveryError}
        v8RecoveryCopy={v8RecoveryCopy}
        v8RecoveryError={v8RecoveryError}
        v9RecoveryCopy={v9RecoveryCopy}
        v9RecoveryError={v9RecoveryError}
        v10RecoveryCopy={v10RecoveryCopy}
        v10RecoveryError={v10RecoveryError}
      />
      <footer className="preview-footer">
        <span>Synthetic preview data stays separate from Tend accounts.</span>
        <a href="/preview.html">Component catalogue</a>
      </footer>
      {activeRhythm && (
        <RhythmDetailsDialog
          key={activeRhythm.id}
          rhythm={activeRhythmForDetails!}
          initialView={detailsInitialView}
          datedCompletions={[]}
          completionHistoryAvailable={activeRhythmIsToday || activeRhythmIsArchived}
          {...(activeRhythmIsToday && isEditableRhythmId(activeRhythm.id) && !activeRhythmIsArchived
            ? { onLogCompletion: record => saveDatedCompletion(record, 'history') }
            : {})}
          {...(activeRhythmIsToday && isEditableRhythmId(activeRhythm.id) && !activeRhythmIsArchived
            ? {
                onUpdateCompletion: updateDatedCompletion,
                onDeleteCompletion: deleteDatedCompletionRecord
              }
            : {})}
          {...(activeRhythmIsToday && isEditableRhythmId(activeRhythm.id) && !activeRhythmIsArchived
            ? { onEditSeason: saveSeasonCorrection }
            : {})}
          people={peopleForRhythm(activeRhythm)}
          archived={activeRhythmIsArchived}
          onPersonSelect={personId => {
            setActiveRhythmId(null);
            dialogOpener.current = null;
            navigate('people', personId);
          }}
          {...(activeRhythmIsToday
            ? {
                completed: completedRhythms.has(activeRhythm.id),
                ...(!activeRhythmIsArchived ? { onSaveCompletion: saveDatedCompletion } : {}),
                ...(undoableRhythms.has(activeRhythm.id) ? { onUndo: () => undoTend(activeRhythm.id) } : {}),
                ...(isEditableRhythmId(activeRhythm.id)
                  ? {
                      onEdit: event => openRhythmEditor(event, activeRhythm)
                    }
                  : {})
              }
            : {
                completed: completedRhythms.has(activeRhythm.id),
                ...(undoableRhythms.has(activeRhythm.id) ? { onUndo: () => undoTend(activeRhythm.id) } : {})
              })}
          onClose={() => setActiveRhythmId(null)}
        />
      )}
      {completionDialogRhythm && (
        <RhythmCompletionDialog
          rhythm={completionDialogRhythm}
          onSave={saveDatedCompletion}
          onClose={() => setCompletionDialogRhythmId(null)}
        />
      )}
      {rhythmEditor && (
        <RhythmEditor
          {...(rhythmEditor.rhythm ? { rhythm: rhythmEditor.rhythm } : {})}
          hasDatedCompletionHistory={
            previewData.rhythmHistoryIds.includes(rhythmEditor.id)
            || (rhythmEditor.rhythm?.completionHistory?.length ?? 0) > 0
          }
          onSave={saveRhythm}
          {...(rhythmEditor.rhythm ? { onArchive: archiveRhythm } : {})}
          onClose={() => setRhythmEditor(null)}
        />
      )}
    </div>
  );
}

function PlaceholderPage({ destination, onToday }: { destination: Exclude<Destination, 'today'>; onToday: () => void }) {
  return (
    <main className="category-page preview-placeholder" aria-labelledby="placeholder-title">
      <header className="category-page-heading">
        <h2 id="placeholder-title">{destinationLabels[destination]}</h2>
        <span className="hint">This destination is not implemented in this preview.</span>
      </header>
      <section className="card placeholder-card">
        <p className="empty">Only the Today view is active. This preview uses sample data and does not connect to your Tend account.</p>
        <button type="button" className="btn mini" onClick={onToday}>Back to Today</button>
      </section>
    </main>
  );
}
