import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, MouseEvent, MutableRefObject } from 'react';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { PersonBadge } from './PersonBadge.tsx';
import { toggleBadgeGroup } from './BadgeSelectionPicker.tsx';
import { PeopleAssociationRow, PeopleBadgeSelectionPicker } from './PeopleAssociationControls.tsx';
import { StrengthMuscleSelection } from './StrengthMuscleSelection.tsx';
import { StrengthMuscleGroupsDisclosure } from './StrengthMuscleGroupsDisclosure.tsx';
import { formatStrengthRest } from './strength-format.ts';
import { StrengthWorkoutSuggestionsDialog } from './StrengthWorkoutSuggestionsDialog.tsx';
import { StrengthExerciseEditor } from './StrengthExerciseEditor.tsx';
import { StrengthExerciseResults } from './StrengthExerciseResults.tsx';
import { StrengthGuidedSessionDialog } from './StrengthGuidedSessionDialog.tsx';
import { StrengthRhythmCompletionPicker } from './StrengthRhythmCompletionPicker.tsx';
import { StrengthWorkoutOnlyConfirmationDialog } from './StrengthWorkoutOnlyConfirmationDialog.tsx';
import { FitnessScoreSummary } from './FitnessScoreSummary.tsx';
import { FoundationRoutineSummary } from './FoundationRoutineSummary.tsx';
import { FoundationSectionHeading } from './FoundationSectionHeading.tsx';
import { FoundationRhythmAssociationDialog } from './FoundationRhythmAssociationDialog.tsx';
import { FoundationRhythmGroup } from './FoundationRhythmGroup.tsx';
import {
  createStrengthBodyMapConfig,
  FitnessBodyMapLayout,
  FitnessBodyMapRegionRow
} from './FitnessBodyMap.tsx';
import { FitnessSessionResumeBanner } from './FitnessSessionResumeBanner.tsx';
import { RhythmMetadataIcon } from './RhythmMetadataIcon.tsx';
import { ToolZone } from './ToolZone.tsx';
import type { CategoryScoreSelection } from '../domain/category-scoring.ts';
import { SettingsGearButton } from './SettingsGearButton.tsx';
import { foundationRhythmIds } from '../domain/foundation-rhythm-associations.ts';
import {
  selectStrengthWorkoutRhythmOptions,
  type StrengthRhythmSetting
} from '../domain/strength-rhythm-linking.ts';
import type { DatedRhythmCompletion } from '../domain/rhythm-completion.ts';
import type { FoundationRhythmAssociationChange } from '../domain/foundation-rhythm-associations.ts';
import type { RhythmScoreResult } from '../domain/rhythm-scoring.ts';
import type { HealthAggregateEvidence } from './HealthScoringDetailsCard.tsx';
import { SegmentedTabs } from './SegmentedTabs.tsx';
import type { SegmentedTab } from './SegmentedTabs.tsx';
import {
  cloneStrengthSavedWorkout,
  clearStrengthGuidedSessionDraft,
  createStrengthGuidedSession,
  createStrengthWorkoutSuggestionExercises,
  createStrengthWorkoutSuggestionSupersetGroups,
  createStrengthWorkout,
  deleteStrengthWorkout,
  deleteStrengthWorkoutLog,
  editStrengthWorkout,
  rankStrengthWorkouts,
  defaultStrengthBetweenSetRestSeconds,
  resolveStrengthBetweenSetRestSeconds,
  saveStrengthWorkoutLog,
  selectStrengthWorkoutHistory,
  selectStrengthMuscleScores,
  saveStrengthScoringSetup,
  selectStrengthScore,
  strengthMuscleName as muscleName,
  strengthMuscles,
  updateStrengthSavedWorkoutRestOverride,
  validateStrengthSettings
} from '../domain/strength.ts';
import type {
  StrengthData,
  StrengthMode,
  StrengthMuscleId,
  StrengthMuscleScore,
  StrengthSavedWorkout,
  StrengthWorkoutExercise,
  StrengthSupersetGroup,
  StrengthWorkoutSuggestion,
  StrengthWorkoutHistory,
  StrengthWorkoutLog
} from '../domain/strength.ts';
import type { StrengthGuidedSessionDraft } from '../domain/strength.ts';
import {
  personById,
  syntheticPeople,
  syntheticPersonPickerGroups,
  type PersonId,
  type PersonPickerGroup,
  type PersonPreview,
  type RhythmPreview,
  type FoundationPreview,
  foundationCatalogue
} from '../domain/preview-data.ts';
import type { Destination } from './AppNavigation.tsx';

type StrengthRhythm = StrengthRhythmSetting;

export type StrengthViewProps = {
  data: StrengthData;
  healthScore?: CategoryScoreSelection;
  overallHealthScore?: number | null;
  categoryHealthScore?: number | null;
  people?: readonly PersonPreview[];
  peopleGroups?: readonly PersonPickerGroup[];
  rhythms: readonly StrengthRhythm[];
  archivedRhythms?: readonly RhythmPreview[];
  datedRhythmCompletions?: readonly DatedRhythmCompletion[];
  foundations?: readonly FoundationPreview[];
  rhythmScores?: ReadonlyMap<string, RhythmScoreResult>;
  completedRhythms?: ReadonlySet<string>;
  undoableRhythms?: ReadonlySet<string>;
  evaluationDate: string;
  onChange: (next: StrengthData) => string | null;
  onAddLinkedRhythm?: (foundationId: string, event: MouseEvent<HTMLButtonElement>) => void;
  onSaveFoundationAssociations?: (
    foundationId: string,
    changes: readonly FoundationRhythmAssociationChange[]
  ) => string | null;
  onRhythmHistory?: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onEditRhythm?: (rhythm: RhythmPreview, event: MouseEvent<HTMLButtonElement>) => void;
  onTend?: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onUndo?: (id: string) => void;
  onPersonSelect?: (personId: PersonId) => void;
  onOpenFoundation?: (foundationId: string, openerId: string) => void;
  onOpenCategory?: (categoryId: Destination, openerId: string) => void;
  pendingRhythmLog?: {
    requestId: number;
    rhythm: RhythmPreview;
    mode: StrengthMode;
    workoutId?: string;
    opener?: HTMLButtonElement;
  } | null;
  onRhythmLogOpened?: (requestId: number) => void;
  onRhythmLogClosed?: () => void;
  quickStartRequest?: { requestId: number; opener: HTMLButtonElement } | null;
  onQuickStartClosed?: () => void;
  pendingRhythmModeRequest?: {
    requestId: number;
    setting: StrengthRhythm;
    opener: HTMLButtonElement;
  } | null;
  onRhythmModeRequestOpened?: (requestId: number) => void;
  onRhythmModeRequestClosed?: () => void;
  foundationNavigation?: boolean;
  foundationActive?: boolean;
  healthScoringEvidence?: HealthAggregateEvidence;
};

type StrengthTab = 'workouts' | 'body' | 'rhythms';

type FitnessDialog =
  | { kind: 'goals' }
  | { kind: 'rhythm-workout-picker'; rhythm: StrengthRhythm }
  | { kind: 'workout-browser' }
  | {
      kind: 'workout';
      workout?: StrengthSavedWorkout;
      suggestion?: StrengthWorkoutSuggestion;
      returnToBrowser?: boolean;
    }
  | { kind: 'workout-choice'; workout: StrengthSavedWorkout }
  | {
      kind: 'log';
      log?: StrengthWorkoutLog;
      templateId?: string;
      rhythm?: StrengthRhythm;
      quick?: boolean;
      fallbackNote?: string;
    }
  | { kind: 'history'; log: StrengthWorkoutLog }
  | { kind: 'mode'; setting: StrengthRhythm };

type ExerciseEditorState = {
  exercise: StrengthWorkoutExercise;
};

type QuickLogEditor =
  | { kind: 'date'; date: string; initialDate: string; initialRhythmId?: string }
  | { kind: 'muscles'; muscleIds: StrengthMuscleId[] };

type PendingGuidedStart = {
  workout: StrengthSavedWorkout;
  rhythm?: StrengthRhythm;
  requestId?: number;
};

const strengthTabs = [
  { id: 'body', label: 'Body', tabId: 'strength-tab-body', panelId: 'strength-panel-body' },
  { id: 'workouts', label: 'Workouts', tabId: 'strength-tab-workouts', panelId: 'strength-panel-workouts' },
  { id: 'rhythms', label: 'Rhythms', tabId: 'strength-tab-rhythms', panelId: 'strength-panel-rhythms' }
] as const satisfies readonly SegmentedTab<StrengthTab>[];
export function StrengthView({
  data,
  healthScore,
  overallHealthScore = null,
  categoryHealthScore = null,
  people = syntheticPeople,
  peopleGroups = syntheticPersonPickerGroups,
  rhythms,
  archivedRhythms = [],
  datedRhythmCompletions = [],
  foundations = foundationCatalogue,
  rhythmScores = new Map(),
  completedRhythms = new Set(),
  undoableRhythms = new Set(),
  evaluationDate,
  onChange,
  onAddLinkedRhythm,
  onSaveFoundationAssociations,
  onRhythmHistory,
  onEditRhythm,
  onTend,
  onUndo,
  onPersonSelect,
  onOpenFoundation,
  onOpenCategory,
  pendingRhythmLog = null,
  onRhythmLogOpened,
  onRhythmLogClosed,
  quickStartRequest = null,
  onQuickStartClosed,
  pendingRhythmModeRequest = null,
  onRhythmModeRequestOpened,
  onRhythmModeRequestClosed,
  foundationNavigation = false,
  foundationActive = true,
  healthScoringEvidence
}: StrengthViewProps) {
  const [strengthTab, setStrengthTab] = useState<StrengthTab>(() =>
    pendingRhythmLog || quickStartRequest
      ? 'workouts'
      : pendingRhythmModeRequest
        ? 'rhythms'
        : foundationNavigation ? 'body' : 'workouts'
  );
  const wasFoundationActiveRef = useRef(false);
  const [associationDialogOpen, setAssociationDialogOpen] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [historyAnnouncement, setHistoryAnnouncement] = useState('');
  const [workoutActionMessage, setWorkoutActionMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [confirmingLogDelete, setConfirmingLogDelete] = useState(false);
  const [deleteLogError, setDeleteLogError] = useState('');
  const [bodyView, setBodyView] = useState<'front' | 'back'>('front');
  const [selectedMuscleId, setSelectedMuscleId] = useState<StrengthMuscleId>('chest');
  const [dialog, setDialog] = useState<FitnessDialog | null>(null);
  const [error, setError] = useState('');
  const [betweenSetRestChoices, setBetweenSetRestChoices] = useState<Partial<Record<StrengthMuscleId, string>>>({});
  const [customBetweenSetSeconds, setCustomBetweenSetSeconds] = useState<Partial<Record<StrengthMuscleId, string>>>({});
  const [settingsIntervalDrafts, setSettingsIntervalDrafts] = useState<Partial<Record<StrengthMuscleId, string>>>({});
  const [settingsRestDayDrafts, setSettingsRestDayDrafts] = useState<Partial<Record<StrengthMuscleId, string>>>({});
  const [logTemplateSelection, setLogTemplateSelection] = useState('');
  const [logMuscleIds, setLogMuscleIds] = useState<StrengthMuscleId[]>([]);
  const [logDate, setLogDate] = useState(evaluationDate);
  const [selectedWorkoutRhythmId, setSelectedWorkoutRhythmId] = useState<string | undefined>();
  const [rhythmSelectionNotice, setRhythmSelectionNotice] = useState('');
  const [pendingUnlinkedLog, setPendingUnlinkedLog] = useState<StrengthWorkoutLog | null>(null);
  const [workoutOnlySaveError, setWorkoutOnlySaveError] = useState('');
  const [quickLogEditor, setQuickLogEditor] = useState<QuickLogEditor | null>(null);
  const [workoutPeople, setWorkoutPeople] = useState<PersonId[]>([]);
  const [draftWorkoutName, setDraftWorkoutName] = useState('');
  const [workoutEditorReturn, setWorkoutEditorReturn] = useState<{
    workout?: StrengthSavedWorkout;
    suggestion?: StrengthWorkoutSuggestion;
  } | null>(null);
  const [draftWorkoutMuscles, setDraftWorkoutMuscles] = useState<StrengthMuscleId[]>([]);
  const [draftExercises, setDraftExercises] = useState<StrengthWorkoutExercise[]>([]);
  const [draftSupersetGroups, setDraftSupersetGroups] = useState<StrengthSupersetGroup[]>([]);
  const [exerciseEditor, setExerciseEditor] = useState<ExerciseEditorState | null>(null);
  const [pickerPeople, setPickerPeople] = useState<PersonId[]>([]);
  const [peoplePickerOpen, setPeoplePickerOpen] = useState(false);
  const [suggestionFocusSourceId, setSuggestionFocusSourceId] = useState<string | undefined>();
  const [guidedSessionOpen, setGuidedSessionOpen] = useState(false);
  const [pendingGuidedStart, setPendingGuidedStart] = useState<PendingGuidedStart | null>(null);
  const [confirmingGuidedStartDiscard, setConfirmingGuidedStartDiscard] = useState(false);
  const [guidedSessionError, setGuidedSessionError] = useState('');
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const historyRowOpenerRef = useRef<HTMLButtonElement | null>(null);
  const historyRowRefs = useRef(new Map<string, HTMLButtonElement>());
  const focusAfterHistoryDeleteRef = useRef<string | null>(null);
  const restoreHistoryFocusRef = useRef(false);
  const historyBackRef = useRef<HTMLButtonElement | null>(null);
  const workoutAddButtonRef = useRef<HTMLButtonElement | null>(null);
  const deleteLogButtonRef = useRef<HTMLButtonElement | null>(null);
  const historyDeleteCancelRef = useRef<HTMLButtonElement | null>(null);
  const restoreDeleteActionFocusRef = useRef(false);
  const peoplePickerOpenerRef = useRef<HTMLButtonElement | null>(null);
  const exerciseEditorOpenerRef = useRef<HTMLButtonElement | null>(null);
  const guidedSessionOpenerRef = useRef<HTMLElement | null>(null);
  const workoutRhythmSelectionRef = useRef<HTMLDivElement | null>(null);
  const workoutLogSubmissionRef = useRef(false);
  const acknowledgedUnlinkedLogIdRef = useRef<string | null>(null);
  const workoutCompletionIdsRef = useRef(new Map<string, string>());
  const handledRhythmRequestRef = useRef<number | null>(null);
  const handledQuickStartRequestRef = useRef<number | null>(null);
  const quickStartRequestIdRef = useRef<number | null>(null);
  const rhythmLogRequestIdRef = useRef<number | null>(null);
  const handledRhythmModeRequestRef = useRef<number | null>(null);
  const rhythmModeRequestIdRef = useRef<number | null>(null);
  const restorePeoplePickerFocusRef = useRef(false);
  const draftWorkoutIdRef = useRef<string | null>(null);
  const draftLogIdRef = useRef<string | null>(null);
  const scores = useMemo(() => selectStrengthMuscleScores(data, evaluationDate), [data, evaluationDate]);
  const trainingStatusScore = selectStrengthScore(scores);
  const recommendations = useMemo(() => rankStrengthWorkouts(scores, data.savedWorkouts), [data.savedWorkouts, scores]);
  const selected = scores.find(item => item.id === selectedMuscleId)!;
  const visibleMuscles = visibleStrengthMuscles(bodyView);
  const history = useMemo(
    () => selectStrengthWorkoutHistory(data.workouts, showAllHistory ? Number.MAX_SAFE_INTEGER : 3),
    [data.workouts, showAllHistory]
  );
  const orderedHistory = useMemo(
    () => selectStrengthWorkoutHistory(data.workouts, Number.MAX_SAFE_INTEGER).visibleLogs,
    [data.workouts]
  );
  const activeStrengthRhythms = useMemo(
    () => rhythms
      .map(item => item.rhythm)
      .filter(rhythm => foundationRhythmIds(rhythm).includes('health-strength')),
    [rhythms]
  );
  const archivedStrengthRhythms = useMemo(
    () => archivedRhythms.filter(rhythm => foundationRhythmIds(rhythm).includes('health-strength')),
    [archivedRhythms]
  );
  const strengthFoundation = foundations.find(foundation => foundation.id === 'health-strength');
  const detailLog = dialog?.kind === 'history' ? dialog.log : undefined;
  const detailRhythm = detailLog?.rhythmId
    ? rhythms.find(item => item.rhythm.id === detailLog.rhythmId)?.rhythm
      ?? archivedRhythms.find(item => item.id === detailLog.rhythmId)
    : undefined;
  const workoutRhythmOptions = useMemo(() => {
    if (dialog?.kind !== 'log') return [];
    return selectStrengthWorkoutRhythmOptions(
      rhythms,
      archivedRhythms,
      datedRhythmCompletions,
      logDate,
      (dialog.templateId ?? dialog.log?.savedWorkoutId ?? logTemplateSelection) || undefined,
      dialog.rhythm?.rhythm.id ?? dialog.log?.rhythmId
    );
  }, [archivedRhythms, datedRhythmCompletions, dialog, logDate, logTemplateSelection, rhythms]);
  const contextualTemplate = dialog?.kind === 'log' && dialog.templateId
    ? data.savedWorkouts.find(workout => workout.id === dialog.templateId)
    : undefined;
  const isContextualLog = dialog?.kind === 'log' && Boolean(dialog.templateId);
  const contextualWorkoutName = contextualTemplate?.name
    ?? (dialog?.kind === 'log' && dialog.templateId ? 'Saved workout unavailable' : undefined);
  const logIntro = dialog?.kind === 'log'
    ? (dialog.quick ? dialog.fallbackNote : contextualWorkoutName)
    : undefined;

  useEffect(() => {
    if (!foundationNavigation) return;
    if (!foundationActive) {
      wasFoundationActiveRef.current = false;
      return;
    }
    if (wasFoundationActiveRef.current) return;
    wasFoundationActiveRef.current = true;
    if (!pendingRhythmLog && !quickStartRequest && !pendingRhythmModeRequest) {
      setStrengthTab('body');
    }
  }, [
    foundationActive,
    foundationNavigation,
    pendingRhythmLog?.requestId,
    pendingRhythmModeRequest?.requestId,
    quickStartRequest?.requestId
  ]);

  useEffect(() => {
    if (dialog) return;
    const focusAfterDelete = focusAfterHistoryDeleteRef.current;
    if (focusAfterDelete) {
      focusAfterHistoryDeleteRef.current = null;
      const target = historyRowRefs.current.get(focusAfterDelete);
      if (target?.isConnected) target.focus({ preventScroll: true });
      else if (historyBackRef.current?.isConnected) historyBackRef.current.focus({ preventScroll: true });
      else workoutAddButtonRef.current?.focus({ preventScroll: true });
      return;
    }
    if (restoreHistoryFocusRef.current) {
      restoreHistoryFocusRef.current = false;
      if (historyRowOpenerRef.current?.isConnected) historyRowOpenerRef.current.focus({ preventScroll: true });
      else if (historyBackRef.current?.isConnected) historyBackRef.current.focus({ preventScroll: true });
      else workoutAddButtonRef.current?.focus({ preventScroll: true });
      return;
    }
    if (openerRef.current?.isConnected) openerRef.current.focus({ preventScroll: true });
  }, [data.workouts, dialog]);

  useEffect(() => {
    if (confirmingLogDelete) historyDeleteCancelRef.current?.focus({ preventScroll: true });
    else if (restoreDeleteActionFocusRef.current) {
      restoreDeleteActionFocusRef.current = false;
      deleteLogButtonRef.current?.focus({ preventScroll: true });
    }
  }, [confirmingLogDelete]);

  useEffect(() => {
    if (!peoplePickerOpen && restorePeoplePickerFocusRef.current) {
      peoplePickerOpenerRef.current?.focus({ preventScroll: true });
      restorePeoplePickerFocusRef.current = false;
    }
  }, [peoplePickerOpen]);

  useEffect(() => {
    if (!exerciseEditor) exerciseEditorOpenerRef.current?.focus({ preventScroll: true });
  }, [exerciseEditor]);

  useEffect(() => {
    if (!guidedSessionOpen && guidedSessionOpenerRef.current?.isConnected) {
      guidedSessionOpenerRef.current.focus({ preventScroll: true });
    }
  }, [guidedSessionOpen]);

  useEffect(() => {
    if (!pendingRhythmLog || handledRhythmRequestRef.current === pendingRhythmLog.requestId) return;
    handledRhythmRequestRef.current = pendingRhythmLog.requestId;
    rhythmLogRequestIdRef.current = pendingRhythmLog.requestId;
    const rhythmEntry = rhythms.find(item => item.rhythm.id === pendingRhythmLog.rhythm.id);
    if (!rhythmEntry) return;
    setStrengthTab('workouts');
    openerRef.current = pendingRhythmLog.opener
      ?? [...document.querySelectorAll<HTMLElement>('[data-strength-rhythm]')]
      .find(element => element.dataset.strengthRhythm === rhythmEntry.rhythm.id)
      ?.querySelector<HTMLButtonElement>('button[aria-label^="Log workout"]') ?? null;
    guidedSessionOpenerRef.current = openerRef.current;
    const rhythmSetting: StrengthRhythm = {
      rhythm: rhythmEntry.rhythm,
      mode: pendingRhythmLog.mode,
      ...(pendingRhythmLog.workoutId ? { workoutId: pendingRhythmLog.workoutId } : {})
    };
    if (pendingRhythmLog.mode === 'recommended') {
      setDialog({ kind: 'rhythm-workout-picker', rhythm: rhythmSetting });
      onRhythmLogOpened?.(pendingRhythmLog.requestId);
      return;
    }
    startRhythmWorkout(rhythmSetting, pendingRhythmLog.mode === 'specific'
      ? pendingRhythmLog.workoutId
      : undefined);
    onRhythmLogOpened?.(pendingRhythmLog.requestId);
  }, [pendingRhythmLog?.requestId]);

  function startRhythmWorkout(rhythm: StrengthRhythm, workoutId?: string) {
    const configuredWorkout = data.savedWorkouts.find(workout => workout.id === workoutId);
    const selectedRhythm: StrengthRhythm = {
      ...rhythm,
      mode: workoutId ? 'specific' : 'custom',
      ...(workoutId ? { workoutId } : {})
    };
    if (configuredWorkout?.exercises?.length) {
      const request: PendingGuidedStart = {
        workout: configuredWorkout,
        rhythm: selectedRhythm,
        ...(rhythmLogRequestIdRef.current === null
          ? {}
          : { requestId: rhythmLogRequestIdRef.current })
      };
      setDialog(null);
      if (data.guidedSessionDraft) setPendingGuidedStart(request);
      else if (!startGuidedWorkout(request)) setPendingGuidedStart(request);
      return;
    }
    setError('');
    setLogTemplateSelection(workoutId ?? '');
    setLogMuscleIds(configuredWorkout?.muscleIds ?? []);
    setLogDate(evaluationDate);
    draftLogIdRef.current = `strength-log-${globalThis.crypto.randomUUID()}`;
    const rhythmOptions = selectStrengthWorkoutRhythmOptions(
      rhythms,
      archivedRhythms,
      datedRhythmCompletions,
      evaluationDate,
      workoutId,
      selectedRhythm.rhythm.id
    );
    const selectedOption = rhythmOptions.find(option => option.rhythm.id === selectedRhythm.rhythm.id);
    setSelectedWorkoutRhythmId(selectedOption?.eligible ? selectedRhythm.rhythm.id : undefined);
    setRhythmSelectionNotice(selectedOption?.eligible
      ? ''
      : `${selectedRhythm.rhythm.title} is not available for the selected date, so it was not linked.`);
    setPendingUnlinkedLog(null);
    setWorkoutOnlySaveError('');
    acknowledgedUnlinkedLogIdRef.current = null;
    workoutLogSubmissionRef.current = false;
    setDialog({
      kind: 'log',
      rhythm: selectedRhythm,
      ...(workoutId ? { templateId: workoutId } : {})
    });
  }

  useEffect(() => {
    if (!quickStartRequest || handledQuickStartRequestRef.current === quickStartRequest.requestId) return;
    handledQuickStartRequestRef.current = quickStartRequest.requestId;
    setStrengthTab('workouts');
    quickStartRequestIdRef.current = data.guidedSessionDraft ? quickStartRequest.requestId : null;
    openerRef.current = quickStartRequest.opener;
    guidedSessionOpenerRef.current = quickStartRequest.opener;
    if (data.guidedSessionDraft) {
      setGuidedSessionError('');
      setGuidedSessionOpen(true);
    }
  }, [quickStartRequest?.requestId]);

  useEffect(() => {
    if (!pendingRhythmModeRequest
      || handledRhythmModeRequestRef.current === pendingRhythmModeRequest.requestId) return;
    handledRhythmModeRequestRef.current = pendingRhythmModeRequest.requestId;
    rhythmModeRequestIdRef.current = pendingRhythmModeRequest.requestId;
    setStrengthTab('rhythms');
    openerRef.current = pendingRhythmModeRequest.opener;
    setError('');
    setDialog({ kind: 'mode', setting: pendingRhythmModeRequest.setting });
    onRhythmModeRequestOpened?.(pendingRhythmModeRequest.requestId);
  }, [pendingRhythmModeRequest?.requestId]);

  function consumeRhythmRequest(request: PendingGuidedStart) {
    if (request.requestId !== undefined) onRhythmLogOpened?.(request.requestId);
  }

  function startGuidedWorkout(request: PendingGuidedStart): boolean {
    if (request.workout.exercises?.some(exercise => exercise.loadMeaning === undefined)) {
      setGuidedSessionError('Set a load meaning for each exercise in the workout editor before starting.');
      return false;
    }
    const startedAt = new Date().toISOString();
    const result = createStrengthGuidedSession(request.workout, {
      id: `strength-session-${globalThis.crypto.randomUUID()}`,
      date: evaluationDate,
      startedAt,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...(request.rhythm ? {
        rhythmId: request.rhythm.rhythm.id,
        completionId: `strength-completion-${globalThis.crypto.randomUUID()}`
      } : {})
    });
    if (!result.valid) {
      setGuidedSessionError(result.error);
      return false;
    }
    const saveError = onChange({ ...data, guidedSessionDraft: result.session });
    if (saveError) {
      setGuidedSessionError(saveError);
      return false;
    }
    setGuidedSessionError('');
    setGuidedSessionOpen(true);
    setPendingGuidedStart(null);
    setConfirmingGuidedStartDiscard(false);
    consumeRhythmRequest(request);
    return true;
  }

  function updateGuidedSession(session: StrengthGuidedSessionDraft): string | null {
    const saveError = onChange({ ...data, guidedSessionDraft: session });
    setGuidedSessionError(saveError ?? '');
    return saveError;
  }

  function applyGuidedCustomRestDuration(
    session: StrengthGuidedSessionDraft,
    durationSeconds: number,
    exerciseId: string,
    supersetGroupId?: string
  ): { applied: boolean; message?: string } {
    const target = supersetGroupId
      ? { kind: 'superset' as const, groupId: supersetGroupId }
      : { kind: 'exercise' as const, exerciseId };
    const saved = updateStrengthSavedWorkoutRestOverride(
      data.savedWorkouts, session.templateId, target, durationSeconds
    );
    if (!saved.valid) {
      const saveError = onChange({ ...data, guidedSessionDraft: session });
      const message = saveError
        ? `The custom rest duration was not applied because session persistence failed: ${saveError}`
        : 'Rest updated for this session, but the originating template is unavailable, so it was not saved as a default.';
      setGuidedSessionError(message);
      return { applied: !saveError, message };
    }
    const saveError = onChange({
      ...data,
      savedWorkouts: saved.workouts,
      guidedSessionDraft: session
    });
    setGuidedSessionError(saveError ?? '');
    return saveError
      ? { applied: false, message: `The custom rest duration could not be saved: ${saveError}` }
      : { applied: true };
  }

  function editGuidedExerciseDetails(exerciseId: string, opener: HTMLButtonElement) {
    const workout = data.savedWorkouts.find(item => item.id === data.guidedSessionDraft?.templateId);
    const exercise = workout?.exercises?.find(item => item.id === exerciseId);
    if (!workout || !exercise) {
      setGuidedSessionError('The saved workout template is unavailable. Use Exercise details in the session to set this snapshot.');
      return;
    }
    setGuidedSessionOpen(false);
    openDialog({ kind: 'workout', workout }, undefined, opener);
  }

  function saveGuidedWorkout(log: StrengthWorkoutLog): string | null {
    const result = saveStrengthWorkoutLog(data.workouts, log);
    if (!result.valid) return result.error;
    const saveError = onChange({
      ...clearStrengthGuidedSessionDraft(data),
      workouts: result.workouts,
    });
    if (saveError) return saveError;
    rhythmLogRequestIdRef.current = null;
    setGuidedSessionOpen(false);
    setGuidedSessionError('');
    setHistoryAnnouncement('Workout saved.');
    return null;
  }

  function discardGuidedSession(): string | null {
    const saveError = onChange(clearStrengthGuidedSessionDraft(data));
    setGuidedSessionError(saveError ?? '');
    if (!saveError) {
      setGuidedSessionOpen(false);
      setGuidedSessionError('');
    }
    return saveError;
  }

  function resumeGuidedWorkout() {
    const request = pendingGuidedStart;
    setGuidedSessionOpen(true);
    setPendingGuidedStart(null);
    setConfirmingGuidedStartDiscard(false);
    if (request) {
      if (request.rhythm && data.guidedSessionDraft?.rhythmId !== request.rhythm.rhythm.id) {
        setGuidedSessionError('The existing workout is being resumed; the pending Health Rhythm was not completed.');
      }
      consumeRhythmRequest(request);
    }
  }

  function closeQuickLogEditor() {
    if (quickLogEditor?.kind === 'date') {
      setLogDate(quickLogEditor.initialDate);
      setSelectedWorkoutRhythmId(quickLogEditor.initialRhythmId);
      setRhythmSelectionNotice('');
    }
    setQuickLogEditor(null);
  }

  function changeWorkoutLogDate(nextDate: string) {
    acknowledgedUnlinkedLogIdRef.current = null;
    setLogDate(nextDate);
    setRhythmSelectionNotice('');
    if (!selectedWorkoutRhythmId || dialog?.kind !== 'log' || dialog.log) return;

    const options = selectStrengthWorkoutRhythmOptions(
      rhythms,
      archivedRhythms,
      datedRhythmCompletions,
      nextDate,
      (dialog.templateId ?? logTemplateSelection) || undefined,
      dialog.rhythm?.rhythm.id
    );
    const selectedOption = options.find(option => option.rhythm.id === selectedWorkoutRhythmId);
    if (selectedOption?.eligible) return;

    const selectedRhythm = selectedOption?.rhythm
      ?? rhythms.find(item => item.rhythm.id === selectedWorkoutRhythmId)?.rhythm
      ?? archivedRhythms.find(item => item.id === selectedWorkoutRhythmId);
    setSelectedWorkoutRhythmId(undefined);
    setRhythmSelectionNotice(
      `${selectedRhythm?.title ?? 'The selected Rhythm'} is no longer available for the selected date, so the link was cleared.`
    );
  }

  function cancelGuidedStart() {
    if (pendingGuidedStart) consumeRhythmRequest(pendingGuidedStart);
    setPendingGuidedStart(null);
    setConfirmingGuidedStartDiscard(false);
    setGuidedSessionError('');
    if (rhythmLogRequestIdRef.current !== null) {
      rhythmLogRequestIdRef.current = null;
      onRhythmLogClosed?.();
    }
  }

  function discardAndStartGuidedWorkout() {
    if (!pendingGuidedStart) return;
    const request = pendingGuidedStart;
    if (!startGuidedWorkout(request)) {
      setGuidedSessionError('Could not start the new workout. Your current workout is unchanged.');
    }
  }

  function openWorkoutChoice(workout: StrengthSavedWorkout, event: MouseEvent<HTMLButtonElement>) {
    guidedSessionOpenerRef.current = event.currentTarget;
    openDialog({ kind: 'workout-choice', workout }, event);
  }

  function chooseGuidedWorkout() {
    if (dialog?.kind !== 'workout-choice') return;
    const workout = dialog.workout;
    const exercises = workout.exercises ?? [];
    const hasGuidedPlan = exercises.length > 0
      && exercises.every(exercise => exercise.sets.length > 0 && exercise.loadMeaning !== undefined);
    if (!hasGuidedPlan) {
      openDialog({
        kind: 'log',
        templateId: workout.id,
        quick: true,
        fallbackNote: 'This workout does not have a complete exercise plan, so this quick log records muscle groups only.'
      });
      return;
    }
    setDialog(null);
    setGuidedSessionError('');
    const request = { workout };
    if (data.guidedSessionDraft) {
      setPendingGuidedStart(request);
      setConfirmingGuidedStartDiscard(false);
    } else if (!startGuidedWorkout(request)) {
      setPendingGuidedStart(request);
    }
  }

  function openDialog(
    next: FitnessDialog,
    event?: MouseEvent<HTMLButtonElement>,
    focusOpener?: HTMLButtonElement
  ) {
    if (next.kind === 'goals') {
      setSettingsIntervalDrafts(Object.fromEntries(strengthMuscles.map(muscle => [
        muscle.id,
        String(data.settings.muscleIntervals[muscle.id] ?? '')
      ])));
      setSettingsRestDayDrafts(Object.fromEntries(strengthMuscles.map(muscle => [
        muscle.id,
        String(data.settings.preferredRestDays[muscle.id] ?? (muscle.id === 'abs' ? 0 : 1))
      ])));
      const currentPreferences = Object.fromEntries(strengthMuscles.map(muscle => [
        muscle.id,
        data.settings.betweenSetRestSeconds[muscle.id]
          ?? defaultStrengthBetweenSetRestSeconds[muscle.id]
      ])) as Record<StrengthMuscleId, number>;
      setBetweenSetRestChoices(Object.fromEntries(strengthMuscles.map(muscle => {
        const seconds = currentPreferences[muscle.id];
        return [muscle.id, [60, 90, 120, 150, 180].includes(seconds) ? String(seconds) : 'custom'];
      })));
      setCustomBetweenSetSeconds(Object.fromEntries(strengthMuscles.map(muscle => [
        muscle.id,
        String(data.settings.betweenSetRestSeconds[muscle.id] ?? defaultStrengthBetweenSetRestSeconds[muscle.id])
      ])));
    }
    restoreHistoryFocusRef.current = next.kind === 'log' && Boolean(next.log && historyRowOpenerRef.current);
    openerRef.current = next.kind === 'log' && next.log
      ? historyRowOpenerRef.current ?? event?.currentTarget ?? null
      : focusOpener ?? event?.currentTarget ?? openerRef.current;
    setError('');
    setRhythmSelectionNotice('');
    setLogTemplateSelection(next.kind === 'log'
      ? next.templateId ?? next.log?.savedWorkoutId ?? ''
      : '');
    setLogMuscleIds(next.kind === 'log'
      ? [...(next.log?.muscleIds
        ?? data.savedWorkouts.find(workout => workout.id === next.templateId)?.muscleIds
        ?? [])]
      : []);
    setLogDate(next.kind === 'log' ? next.log?.date ?? evaluationDate : evaluationDate);
    if (next.kind === 'log') {
      const explicitRhythmId = next.log
        ? next.log.rhythmId
        : next.rhythm?.rhythm.id;
      const options = selectStrengthWorkoutRhythmOptions(
        rhythms,
        archivedRhythms,
        datedRhythmCompletions,
        next.log?.date ?? evaluationDate,
        next.templateId ?? next.log?.savedWorkoutId ?? undefined,
        explicitRhythmId
      );
      setSelectedWorkoutRhythmId(
        next.log
          ? next.log.rhythmId
          : explicitRhythmId && options.some(option => option.rhythm.id === explicitRhythmId && option.eligible)
            ? explicitRhythmId
            : undefined
      );
      if (!next.log && explicitRhythmId) {
        const selectedOption = options.find(option => option.rhythm.id === explicitRhythmId);
        if (!selectedOption?.eligible) {
          const selectedRhythm = selectedOption?.rhythm
            ?? next.rhythm?.rhythm
            ?? rhythms.find(item => item.rhythm.id === explicitRhythmId)?.rhythm
            ?? archivedRhythms.find(item => item.id === explicitRhythmId);
          setRhythmSelectionNotice(
            `${selectedRhythm?.title ?? 'The selected Rhythm'} is not available for the selected date, so it was not linked.`
          );
        }
      }
    } else {
      setSelectedWorkoutRhythmId(undefined);
    }
    setPendingUnlinkedLog(null);
    setWorkoutOnlySaveError('');
    acknowledgedUnlinkedLogIdRef.current = null;
    workoutLogSubmissionRef.current = false;
    setQuickLogEditor(null);
    draftWorkoutIdRef.current = next.kind === 'workout' ? next.workout?.id ?? null : null;
    setDraftWorkoutName(next.kind === 'workout'
      ? next.workout?.name ?? next.suggestion?.name ?? ''
      : '');
    setWorkoutEditorReturn(next.kind === 'workout' && next.returnToBrowser
      ? {
          ...(next.workout ? { workout: next.workout } : {}),
          ...(next.suggestion ? { suggestion: next.suggestion } : {})
        }
      : null);
    setWorkoutPeople(next.kind === 'workout' ? [...(next.workout?.sharedWith ?? [])] : []);
    setDraftWorkoutMuscles(next.kind === 'workout'
      ? [...(next.workout?.muscleIds ?? next.suggestion?.muscleIds ?? [])]
      : []);
    const exercises = next.kind !== 'workout'
      ? []
      : next.workout
        ? cloneStrengthSavedWorkout(next.workout).exercises ?? []
        : next.suggestion
          ? createStrengthWorkoutSuggestionExercises(
            next.suggestion,
            () => globalThis.crypto.randomUUID(),
            data.settings
          )
          : [];
    setDraftExercises(exercises);
    setDraftSupersetGroups(next.kind !== 'workout'
      ? []
      : next.workout?.supersetGroups ?? (next.suggestion
        ? createStrengthWorkoutSuggestionSupersetGroups(
            next.suggestion,
            exercises,
            () => globalThis.crypto.randomUUID(),
            data.settings
          )
        : []));
    setExerciseEditor(null);
    setPickerPeople([]);
    setPeoplePickerOpen(false);
    draftLogIdRef.current = next.kind === 'log'
      ? next.log?.id ?? `strength-log-${globalThis.crypto.randomUUID()}`
      : null;
    setDialog(next);
  }

  function saveRhythmMode(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (dialog?.kind !== 'mode') return;
    const form = new FormData(formEvent.currentTarget);
    const mode = String(form.get('mode')) as StrengthMode;
    const workoutId = String(form.get('workoutId') ?? '');
    if (!['recommended', 'specific', 'custom'].includes(mode)) {
      setError('Choose a supported workout mode.');
      return;
    }
    if (mode === 'specific' && !data.savedWorkouts.some(workout => workout.id === workoutId)) {
      setError('Select an available saved workout.');
      return;
    }
    const rhythmId = dialog.setting.rhythm.id;
    const rhythmModes = [
      ...data.rhythmModes.filter(setting => setting.rhythmId !== rhythmId),
      { rhythmId, mode, ...(mode === 'specific' ? { workoutId } : {}) }
    ];
    const saveError = onChange({ ...data, rhythmModes });
    if (saveError) setError(saveError);
    else closeDialog();
  }

  function closeDialog() {
    const closesRhythmLog = dialog?.kind === 'rhythm-workout-picker'
      || dialog?.kind === 'log' && Boolean(dialog.rhythm);
    const closesRhythmMode = dialog?.kind === 'mode';
    setError('');
    setRhythmSelectionNotice('');
    setPendingUnlinkedLog(null);
    setWorkoutOnlySaveError('');
    acknowledgedUnlinkedLogIdRef.current = null;
    draftWorkoutIdRef.current = null;
    draftLogIdRef.current = null;
    setDraftExercises([]);
    setDraftSupersetGroups([]);
    setDraftWorkoutName('');
    setWorkoutEditorReturn(null);
    setExerciseEditor(null);
    setPeoplePickerOpen(false);
    setQuickLogEditor(null);
    setDialog(null);
    if (closesRhythmLog && rhythmLogRequestIdRef.current !== null) {
      rhythmLogRequestIdRef.current = null;
      onRhythmLogClosed?.();
    }
    if (closesRhythmMode && rhythmModeRequestIdRef.current !== null) {
      rhythmModeRequestIdRef.current = null;
      onRhythmModeRequestClosed?.();
    }
  }

  function openWorkoutBrowser(event: MouseEvent<HTMLButtonElement>) {
    openerRef.current = event.currentTarget;
    setSuggestionFocusSourceId(undefined);
    setWorkoutEditorReturn(null);
    setDialog({ kind: 'workout-browser' });
  }

  function openSuggestedWorkout(
    suggestion: StrengthWorkoutSuggestion,
    workout: StrengthSavedWorkout | undefined,
    _event: MouseEvent<HTMLButtonElement>
  ) {
    setSuggestionFocusSourceId(suggestion.sourceId);
    openDialog({
      kind: 'workout',
      suggestion,
      returnToBrowser: true,
      ...(workout ? { workout } : {})
    });
  }

  function continueWorkoutDraft() {
    if (!workoutEditorReturn) return;
    setDialog({
      kind: 'workout',
      returnToBrowser: true,
      ...workoutEditorReturn
    });
  }

  function openPeoplePicker() {
    setPickerPeople([...workoutPeople]);
    setPeoplePickerOpen(true);
  }

  function closePeoplePicker(apply: boolean) {
    if (apply) setWorkoutPeople([...pickerPeople]);
    restorePeoplePickerFocusRef.current = true;
    setPeoplePickerOpen(false);
  }

  function addExercise(event: MouseEvent<HTMLButtonElement>) {
    exerciseEditorOpenerRef.current = event.currentTarget;
    setExerciseEditor({
      exercise: {
        id: `strength-exercise-${globalThis.crypto.randomUUID()}`,
        name: '',
        muscleIds: [],
        equipment: '',
        restDurationSeconds: resolveStrengthBetweenSetRestSeconds([], data.settings),
        restDurationOverridden: false,
        sets: [{ id: `strength-set-${globalThis.crypto.randomUUID()}` }]
      }
    });
  }

  function editExercise(exercise: StrengthWorkoutExercise, event: MouseEvent<HTMLButtonElement>) {
    exerciseEditorOpenerRef.current = event.currentTarget;
    setExerciseEditor({ exercise });
  }

  function finishExerciseEditor(exercise: StrengthWorkoutExercise) {
    const index = draftExercises.findIndex(item => item.id === exercise.id);
    const next = index < 0
      ? [...draftExercises, exercise]
      : draftExercises.map(item => item.id === exercise.id ? exercise : item);
    setDraftExercises(next);
    setDraftSupersetGroups(groups => groups.map(group => {
      if (group.restDurationOverridden !== false || !group.exerciseIds.includes(exercise.id)) return group;
      const first = next.find(item => item.id === group.exerciseIds[0]);
      const second = next.find(item => item.id === group.exerciseIds[1]);
      if (!first || !second) return group;
      return {
        ...group,
        restDurationSeconds: resolveStrengthBetweenSetRestSeconds(
          [...new Set([...first.muscleIds, ...second.muscleIds])],
          data.settings
        )
      };
    }));
    setExerciseEditor(null);
  }

  function moveExercise(exerciseId: string, offset: -1 | 1) {
    const index = draftExercises.findIndex(item => item.id === exerciseId);
    const destination = index + offset;
    if (index < 0 || destination < 0 || destination >= draftExercises.length) return;
    const next = [...draftExercises];
    [next[index], next[destination]] = [next[destination]!, next[index]!];
    setDraftExercises(next);
    setDraftSupersetGroups(groups => groups.filter(group => {
      const first = next.findIndex(item => item.id === group.exerciseIds[0]);
      const second = next.findIndex(item => item.id === group.exerciseIds[1]);
      return second === first + 1;
    }));
  }

  function removeExercise(exerciseId: string) {
    setDraftExercises(current => current.filter(item => item.id !== exerciseId));
    setDraftSupersetGroups(groups => groups.filter(group => !group.exerciseIds.includes(exerciseId)));
  }

  function updateSupersetRest(groupId: string, restDurationSeconds: number) {
    setDraftSupersetGroups(groups => groups.map(group =>
      group.id === groupId ? { ...group, restDurationSeconds, restDurationOverridden: true } : group
    ));
  }

  function pairWithNext(exerciseId: string) {
    const index = draftExercises.findIndex(item => item.id === exerciseId);
    const first = draftExercises[index];
    const second = draftExercises[index + 1];
    if (!first || !second || draftSupersetGroups.some(group =>
      group.exerciseIds.includes(first.id) || group.exerciseIds.includes(second.id)
    )) return;
    setDraftSupersetGroups(groups => [...groups, {
      id: `strength-superset-${globalThis.crypto.randomUUID()}`,
      exerciseIds: [first.id, second.id],
      restDurationSeconds: resolveStrengthBetweenSetRestSeconds(
        [...new Set([...first.muscleIds, ...second.muscleIds])],
        data.settings
      ),
      restDurationOverridden: false
    }]);
  }

  function saveSettings(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = formEvent.currentTarget;
    const formData = new FormData(form);
    const muscleIntervals = { ...data.settings.muscleIntervals };
    const preferredRestDays = { ...data.settings.preferredRestDays };
    const betweenSetRestSeconds = { ...data.settings.betweenSetRestSeconds };
    const weightUnit = String(formData.get('strength-weight-unit') ?? data.settings.weightUnit ?? 'lb') === 'kg' ? 'kg' : 'lb';
    const trackingStartDate = String(formData.get('strength-tracking-start') ?? data.trackingStartDate ?? '');
    const effectiveDate = String(formData.get('strength-settings-effective-date') ?? trackingStartDate);
    for (const muscle of strengthMuscles) {
      const interval = Number(formData.get(`interval-${muscle.id}`));
      const rest = Number(formData.get(`rest-${muscle.id}`));
      const restChoice = String(formData.get(`between-sets-${muscle.id}`) ?? '');
      const customSecondsRaw = String(formData.get(`between-sets-custom-${muscle.id}`) ?? '');
      const customSeconds = customSecondsRaw.trim() === '' ? Number.NaN : Number(customSecondsRaw);
      muscleIntervals[muscle.id] = interval;
      preferredRestDays[muscle.id] = rest;
      betweenSetRestSeconds[muscle.id] = restChoice === 'custom' ? customSeconds : Number(restChoice);
    }
    const errors = validateStrengthSettings({
      muscleIntervals,
      preferredRestDays,
      betweenSetRestSeconds,
      weightUnit
    });
    const firstError = strengthMuscles.find(muscle => errors[muscle.id]);
    if (firstError) {
      setError(`${firstError.name}: ${errors[firstError.id]}`);
      const firstInvalidField = form.querySelector<HTMLInputElement>(`[name="interval-${firstError.id}"]`);
      const firstInvalidRow = firstInvalidField?.closest<HTMLDetailsElement>('.strength-setting-muscle');
      if (firstInvalidRow) firstInvalidRow.open = true;
      firstInvalidField?.focus();
      return;
    }
    if (!data.trackingStartDate && (!trackingStartDate || trackingStartDate > evaluationDate)) {
      setError('Choose a Strength tracking start date that is today or earlier.');
      form.querySelector<HTMLInputElement>('[name="strength-tracking-start"]')?.focus();
      return;
    }
    const latestSettingsDate = data.scoringSettingsHistory?.at(-1)?.effectiveDate ?? data.trackingStartDate ?? '';
    if (data.trackingStartDate && (!effectiveDate || effectiveDate < latestSettingsDate || effectiveDate > evaluationDate)) {
      setError('Choose a settings effective date between the latest saved settings and today.');
      form.querySelector<HTMLInputElement>('[name="strength-settings-effective-date"]')?.focus();
      return;
    }
    const nextData = saveStrengthScoringSetup({
      ...data,
      settings: { muscleIntervals, preferredRestDays, betweenSetRestSeconds, weightUnit }
    }, trackingStartDate || evaluationDate, effectiveDate || trackingStartDate || evaluationDate);
    const saveError = onChange(nextData);
    if (saveError) setError(saveError);
    else closeDialog();
  }

  function saveTemplate(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = new FormData(formEvent.currentTarget);
    const muscleIds = [...draftWorkoutMuscles];
    const existing = dialog?.kind === 'workout' ? dialog.workout : undefined;
    if (draftExercises.some(exercise => exercise.loadMeaning === undefined)) {
      setError('Set a load meaning for every exercise before saving this workout.');
      return;
    }
    draftWorkoutIdRef.current ??= `strength-workout-${globalThis.crypto.randomUUID()}`;
    const suggestionSourceId = existing?.suggestionSourceId
      ?? (dialog?.kind === 'workout' ? dialog.suggestion?.sourceId : undefined);
    const workoutBase: Partial<StrengthSavedWorkout> = existing ? { ...existing } : {};
    delete workoutBase.exercises;
    const workout: StrengthSavedWorkout = {
      ...workoutBase,
      id: existing?.id ?? draftWorkoutIdRef.current,
      name: String(form.get('name') ?? '').trim(),
      muscleIds,
      sharedWith: [...workoutPeople],
      ...(draftExercises.length ? { exercises: draftExercises } : {}),
      supersetGroups: draftSupersetGroups,
      ...(suggestionSourceId === undefined ? {} : { suggestionSourceId })
    };
    const result = existing
      ? editStrengthWorkout(data.savedWorkouts, workout)
      : createStrengthWorkout(data.savedWorkouts, workout);
    if (!result.valid) {
      setError(result.error);
      return;
    }
    const updatedTemplate = result.workouts.find(item => item.id === workout.id);
    const guidedSessionDraft = data.guidedSessionDraft?.templateId === workout.id && updatedTemplate?.exercises
      ? {
          ...data.guidedSessionDraft,
          exercises: data.guidedSessionDraft.exercises.map(sessionExercise => {
            const templateExercise = updatedTemplate.exercises?.find(item => item.id === sessionExercise.id);
            return templateExercise?.loadMeaning === undefined
              ? sessionExercise
              : { ...sessionExercise, loadMeaning: templateExercise.loadMeaning };
          })
        }
      : data.guidedSessionDraft;
    const saveError = onChange({
      ...data,
      savedWorkouts: result.workouts,
      ...(guidedSessionDraft === undefined ? {} : { guidedSessionDraft })
    });
    if (saveError) setError(saveError);
    else closeDialog();
  }

  function workoutCompletionId(logId: string, rhythmId: string, existing?: StrengthWorkoutLog): string {
    if (existing?.rhythmId === rhythmId && existing.completionId) return existing.completionId;
    const key = `${logId}:${rhythmId}`;
    const completionId = workoutCompletionIdsRef.current.get(key)
      ?? `strength-completion-${globalThis.crypto.randomUUID()}`;
    workoutCompletionIdsRef.current.set(key, completionId);
    return completionId;
  }

  function persistWorkoutLog(log: StrengthWorkoutLog, existing?: StrengthWorkoutLog): string | null {
    if (workoutLogSubmissionRef.current) return null;
    const result = saveStrengthWorkoutLog(data.workouts, log);
    if (!result.valid) {
      setError(result.error);
      if (pendingUnlinkedLog) setWorkoutOnlySaveError(result.error);
      return result.error;
    }

    workoutLogSubmissionRef.current = true;
    const saveError = onChange({ ...data, workouts: result.workouts });
    if (saveError) {
      workoutLogSubmissionRef.current = false;
      setError(saveError);
      if (pendingUnlinkedLog) setWorkoutOnlySaveError(saveError);
      return saveError;
    }
    if (existing) {
      const updatedHistory = selectStrengthWorkoutHistory(
        result.workouts,
        showAllHistory ? Number.MAX_SAFE_INTEGER : 3
      );
      const remainsVisible = updatedHistory.visibleLogs.some(item => item.id === existing.id);
      setHistoryAnnouncement(remainsVisible
        ? 'Workout updated.'
        : 'Workout updated. It is outside the latest three entries.');
      if (!remainsVisible) setShowAllHistory(true);
    }
    closeDialog();
    return null;
  }

  function saveLog(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (dialog?.kind !== 'log') return;
    const form = new FormData(formEvent.currentTarget);
    const selectedTemplateId = dialog.templateId ?? String(form.get('savedWorkoutId') ?? '');
    const template = data.savedWorkouts.find(item => item.id === selectedTemplateId);
    const muscleIds = strengthMuscles.filter(muscle => logMuscleIds.includes(muscle.id)).map(muscle => muscle.id);
    const existing = dialog.log;
    draftLogIdRef.current ??= `strength-log-${globalThis.crypto.randomUUID()}`;
    const log: StrengthWorkoutLog = {
      ...(existing ? {
        id: existing.id,
        ...(existing.rhythmId ? { rhythmId: existing.rhythmId } : {}),
        ...(existing.rhythmOccurrence ? { rhythmOccurrence: existing.rhythmOccurrence } : {}),
        ...(existing.completionId ? { completionId: existing.completionId } : {})
      } : {}),
      id: existing?.id ?? draftLogIdRef.current,
      date: logDate,
      muscleIds,
      ...(String(form.get('notes') ?? '').trim() ? { notes: String(form.get('notes')).trim() } : {}),
      ...(template
        ? { savedWorkoutId: template.id, workoutName: template.name }
        : selectedTemplateId
          ? {
              ...(existing?.savedWorkoutId === selectedTemplateId ? { savedWorkoutId: selectedTemplateId } : {}),
              ...(existing?.savedWorkoutId === selectedTemplateId && existing.workoutName
                ? { workoutName: existing.workoutName }
                : {})
            }
          : {})
    };
    const selectedRhythmId = existing ? existing.rhythmId : selectedWorkoutRhythmId;
    if (dialog.rhythm && selectedRhythmId === dialog.rhythm.rhythm.id
      && dialog.rhythm.mode === 'specific' && !template) {
      setError('The selected saved workout is unavailable. Edit the Rhythm or choose a custom workout.');
      return;
    }
    if (selectedRhythmId && !existing) {
      const option = workoutRhythmOptions.find(item => item.rhythm.id === selectedRhythmId);
      if (!option?.eligible) {
        setError(option?.reason ?? 'Choose a Rhythm that is eligible for this date, or choose not to link this workout.');
        return;
      }
      log.rhythmId = selectedRhythmId;
      log.rhythmOccurrence = log.date;
      log.completionId = workoutCompletionId(log.id, selectedRhythmId);
    } else if (existing?.rhythmId && existing.rhythmOccurrence) {
      log.rhythmId = existing.rhythmId;
      log.rhythmOccurrence = log.date;
      if (existing.completionId) log.completionId = existing.completionId;
    }

    setError('');
    setWorkoutOnlySaveError('');
    const validation = saveStrengthWorkoutLog(data.workouts, log);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    if (!existing && !log.rhythmId && acknowledgedUnlinkedLogIdRef.current !== log.id) {
      setPendingUnlinkedLog(log);
      return;
    }
    persistWorkoutLog(log, existing);
  }

  function removeTemplate(workout: StrengthSavedWorkout) {
    const next = deleteStrengthWorkout(data.savedWorkouts, workout.id);
    const saveError = onChange({ ...data, savedWorkouts: next });
    if (saveError) setError(saveError);
    else closeDialog();
  }

  function duplicateTemplate(workout: StrengthSavedWorkout) {
    setWorkoutActionMessage(null);
    const duplicate = cloneStrengthSavedWorkout(workout);
    duplicate.id = `strength-workout-${globalThis.crypto.randomUUID()}`;
    duplicate.name = `${workout.name.slice(0, 113).trimEnd()} (copy)`;
    const result = createStrengthWorkout(data.savedWorkouts, duplicate);
    if (!result.valid) {
      setWorkoutActionMessage({ text: result.error, error: true });
      return;
    }
    const saveError = onChange({ ...data, savedWorkouts: result.workouts });
    setWorkoutActionMessage(saveError
      ? { text: saveError, error: true }
      : { text: `${duplicate.name} duplicated.`, error: false });
  }

  function removeLog(log: StrengthWorkoutLog) {
    const result = deleteStrengthWorkoutLog(data.workouts, log.id);
    if (!result.deleted) return;
    const removedIndex = orderedHistory.findIndex(item => item.id === log.id);
    const nextLog = result.workouts.length
      ? selectStrengthWorkoutHistory(result.workouts, Number.MAX_SAFE_INTEGER)
        .visibleLogs[Math.min(Math.max(removedIndex, 0), result.workouts.length - 1)]
      : undefined;
    focusAfterHistoryDeleteRef.current = nextLog?.id ?? null;
    const saveError = onChange({ ...data, workouts: result.workouts });
    if (saveError) {
      focusAfterHistoryDeleteRef.current = null;
      setDeleteLogError(saveError);
      return;
    }
    setConfirmingLogDelete(false);
    setDeleteLogError('');
    setHistoryAnnouncement('Workout deleted.');
    setDialog(null);
  }

  function openHistoryDetails(log: StrengthWorkoutLog, event: MouseEvent<HTMLButtonElement>) {
    historyRowOpenerRef.current = event.currentTarget;
    restoreHistoryFocusRef.current = true;
    openerRef.current = event.currentTarget;
    setError('');
    setDeleteLogError('');
    setConfirmingLogDelete(false);
    setDialog({ kind: 'history', log });
  }

  function chooseMuscle(id: StrengthMuscleId) {
    setSelectedMuscleId(id);
    const muscle = strengthMuscles.find(item => item.id === id)!;
    if (!muscle[bodyView]) setBodyView(muscle.front ? 'front' : 'back');
  }

  function chooseBodyView(view: 'front' | 'back') {
    const muscles = visibleStrengthMuscles(view);
    if (!muscles.some(muscle => muscle.id === selectedMuscleId) && muscles[0]) {
      setSelectedMuscleId(muscles[0].id);
    }
    setBodyView(view);
  }

  return (
    <section
      className="category-page strength-page"
      {...(!foundationNavigation && { 'aria-labelledby': 'strength-title' })}
    >
      {!foundationNavigation && (
        <header className="marriage-section-heading strength-page__heading">
          <div>
            <h3 id="strength-title">Strength</h3>
            <p>Your training, at a glance.</p>
          </div>
        </header>
      )}

      <FitnessScoreSummary
        category="Strength"
        healthTitle="Strength Health"
        {...(foundationNavigation ? { cardTitle: 'Health' } : {})}
        className={`rhythm-history-view__score-card${foundationNavigation ? ' foundation-health-card' : ''}`}
        consistency={healthScore?.consistency ?? null}
        onTrack={healthScore?.onTrack ?? null}
        health={healthScore?.health ?? null}
        showMeasures={!foundationNavigation}
        overallHealthScore={overallHealthScore}
        categoryHealthScore={categoryHealthScore}
        linkedRhythmCount={healthScoringEvidence
          ? healthScoringEvidence.rows.length + (healthScoringEvidence.otherCount ?? 0)
          : rhythms.filter(item => foundationRhythmIds(item.rhythm).includes('health-strength')).length}
        {...(healthScoringEvidence ? { scoringEvidence: healthScoringEvidence } : {})}
        compact
        summaryExplanation="Strength Health reflects eligible Strength-linked Rhythm scores. Your body, at a glance and its muscle scores and readiness remain training feedback and do not contribute."
      />
      {data.guidedSessionDraft && !guidedSessionOpen && (
        <FitnessSessionResumeBanner
          ariaLabel="Workout in progress"
          sessionName={data.guidedSessionDraft.workoutName}
          status="Workout in progress"
          onResume={button => {
            guidedSessionOpenerRef.current = button;
            setGuidedSessionError('');
            setGuidedSessionOpen(true);
          }}
        />
      )}
      {guidedSessionError && !guidedSessionOpen && !pendingGuidedStart
        && <p className="strength-form-error" role="alert">{guidedSessionError}</p>}

      <SegmentedTabs
        tabs={strengthTabs}
        selectedTabId={strengthTab}
        ariaLabel="Strength sections"
        onChange={setStrengthTab}
      />
      <div className="strength-section-panels">
        <section
          id="strength-panel-body"
          className="strength-section-panel strength-section-panel--body"
          role="tabpanel"
          aria-labelledby="strength-tab-body"
          hidden={strengthTab !== 'body'}
        >
          <FoundationSectionHeading
            title="Body overview"
            subtitle={
              <span
                className="strength-legacy-status"
                role="meter"
                aria-label="Strength training status score"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={trainingStatusScore ?? undefined}
                aria-valuetext={trainingStatusScore === null ? 'Score unavailable' : `${trainingStatusScore} out of 100`}
              >
                <span>Training status</span><strong>{trainingStatusScore ?? '—'}</strong>
              </span>
            }
          />
          <ToolZone
            className="strength-map-card"
            icon={<RhythmMetadataIcon kind="history" />}
            purposeLabel="Body insights"
            subtitle="See which muscles you’ve trained and what’s ready next."
            scoringFootnote="Your linked Rhythms determine Strength Health."
            headerAction={(
              <SettingsGearButton
                label="Strength settings"
                onClick={event => openDialog({ kind: 'goals' }, event)}
                expanded={dialog?.kind === 'goals'}
              />
            )}
          >
            <div className="strength-map-toolbar" role="group" aria-label="Body map view">
              {(['front', 'back'] as const).map(view => (
                <button key={view} type="button" aria-pressed={bodyView === view} onClick={() => chooseBodyView(view)}>
                  {view === 'front' ? 'Front' : 'Back'}
                </button>
              ))}
            </div>
            <FitnessBodyMapLayout
                config={createStrengthBodyMapConfig(scores)}
                view={bodyView}
                selectedId={selectedMuscleId}
                onSelect={chooseMuscle}
                listLabel="Muscle training status"
              >
                {visibleMuscles.map(muscle => {
                  const result = scores.find(item => item.id === muscle.id)!;
                  const trainingStatus = strengthMuscleTrainingStatus(result);
                  const lastWorkoutLabel = strengthLastWorkoutLabel(result);
                  const nextDueLabel = strengthNextDueLabel(result);
                  return (
                    <FitnessBodyMapRegionRow
                      key={muscle.id}
                      name={muscle.name}
                      selected={selectedMuscleId === muscle.id}
                      statusTone={trainingStatus.tone}
                      statusLabel={`Training status: ${trainingStatus.label}`}
                      lastActivity={lastWorkoutLabel}
                      nextDueLabel={nextDueLabel}
                      ariaLabel={`${muscle.name}. Training status: ${trainingStatus.label}. Last workout: ${lastWorkoutLabel}. ${
                        nextDueLabel === '—' ? 'Next lift unavailable.' : `${nextDueLabel}.`
                      }`}
                      onSelect={() => chooseMuscle(muscle.id)}
                    />
                  );
                })}
            </FitnessBodyMapLayout>
            <div className="strength-muscle-detail" aria-live="polite">
              <h3 className="strength-muscle-detail__title">{selected.name} details</h3>
              <dl className="strength-muscle-facts">
                <div>
                  <dt>Training interval</dt>
                  <dd>{selected.intervalDays === null
                    ? 'Unavailable'
                    : `Every ${selected.intervalDays} ${selected.intervalDays === 1 ? 'day' : 'days'}`}</dd>
                </div>
                <div>
                  <dt>Rest between workouts</dt>
                  <dd><span className="strength-muscle-facts__compact">{selected.preferredRestDays} {selected.preferredRestDays === 1 ? 'day' : 'days'}</span></dd>
                </div>
                <div>
                  <dt>Readiness</dt>
                  <dd>{strengthReadiness(selected)}</dd>
                </div>
                <div>
                  <dt>Last logged</dt>
                  <dd>{selected.lastTrained
                    ? formatFitnessDate(selected.lastTrained)
                    : selected.historyState === 'invalid' ? 'Unavailable' : 'Not logged yet'}</dd>
                </div>
              </dl>
            </div>
          </ToolZone>
        </section>

        <section
          id="strength-panel-workouts"
          className="strength-section-panel"
          role="tabpanel"
          aria-labelledby="strength-tab-workouts"
          hidden={strengthTab !== 'workouts'}
        >
        <section className="strength-workouts">
          <section className="strength-workout-section" aria-labelledby="saved-workouts-heading">
              <FoundationSectionHeading
                title="My workouts"
                headingId="saved-workouts-heading"
                subtitle="Your routines, ready when you are."
                actions={<button
                  ref={workoutAddButtonRef}
                  type="button"
                  className="btn mini ghost strength-workouts__add"
                  aria-label="Add workout"
                  onClick={openWorkoutBrowser}
                >
                  <span aria-hidden="true">+</span> Add
                </button>}
              />
            {workoutActionMessage && (
              <p
                className={workoutActionMessage.error ? 'strength-form-error' : 'strength-history-status'}
                role={workoutActionMessage.error ? 'alert' : 'status'}
              >
                {workoutActionMessage.text}
              </p>
            )}
            {data.savedWorkouts.length ? (
              <div className="strength-template-list">
                {data.savedWorkouts.map(workout => (
                  <article key={workout.id} className="strength-template">
                    <FoundationRoutineSummary
                      className="strength-template__content"
                      title={workout.name}
                      description={workout.muscleIds.map(id => muscleName(id)).join(' · ')
                        || 'Muscle selection unavailable'}
                      {...(workout.exercises && workout.exercises.length > 0 ? {
                        metadata: `${workout.exercises.length} ${
                          workout.exercises.length === 1 ? 'exercise' : 'exercises'
                        } · ${workout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0)} planned sets`,
                        metadataClassName: 'strength-template__exercise-summary'
                      } : {})}
                    >
                      {workout.sharedWith.length > 0 && (
                        <div className="strength-template__people" role="group" aria-label={`People associated with ${workout.name}`}>
                          {workout.sharedWith.map(id => <PersonBadge key={id} person={personById(people, id)} presentation="static" />)}
                        </div>
                      )}
                    </FoundationRoutineSummary>
                    <details className="strength-template__menu">
                      <summary aria-label={`Actions for ${workout.name}`}>⋯</summary>
                      <div className="strength-template__menu-items">
                        <button type="button" onClick={event => {
                          openDialog({ kind: 'workout', workout }, event);
                          event.currentTarget.closest('details')?.removeAttribute('open');
                        }}>Edit workout</button>
                        <button type="button" onClick={event => {
                          duplicateTemplate(workout);
                          event.currentTarget.closest('details')?.removeAttribute('open');
                        }}>Duplicate workout</button>
                        <button type="button" onClick={event => {
                          removeTemplate(workout);
                          event.currentTarget.closest('details')?.removeAttribute('open');
                        }}>Delete workout</button>
                      </div>
                    </details>
                    <div className="strength-template__actions">
                      <button type="button" className="btn mini" onClick={event => openWorkoutChoice(workout, event)}>Workout</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className="strength-empty">No workouts saved yet.</p>}
          </section>
          <section className="strength-workout-section strength-history-page" aria-labelledby="strength-history-heading">
            <FoundationSectionHeading
              title="History"
              headingId="strength-history-heading"
              subtitle="Your completed workouts."
              actions={showAllHistory ? (
                <button
                  ref={historyBackRef}
                  type="button"
                  className="btn mini ghost"
                  onClick={() => setShowAllHistory(false)}
                >
                  Back to Workouts
                </button>
              ) : (
                <button
                  type="button"
                  className="btn mini ghost"
                  aria-label="Log workout"
                  onClick={event => openDialog({ kind: 'log' }, event)}
                >
                  <span aria-hidden="true">+</span> Log workout
                </button>
              )}
            />
            {historyAnnouncement && <p className="strength-history-status" role="status">{historyAnnouncement}</p>}
            <StrengthWorkoutHistory
              history={history}
              rowRefs={historyRowRefs}
              onOpen={openHistoryDetails}
            />
            {!showAllHistory && history.hasMore && (
              <div className="strength-history-page__actions">
                <button
                  ref={historyBackRef}
                  type="button"
                  className="btn mini ghost"
                  onClick={() => setShowAllHistory(true)}
                >
                  View all
                </button>
              </div>
            )}
          </section>
        </section>
      </section>
      <section
        id="strength-panel-rhythms"
        className="strength-section-panel"
        role="tabpanel"
        aria-labelledby="strength-tab-rhythms"
        hidden={strengthTab !== 'rhythms'}
      >
        <section className="marriage-foundation-support strength-rhythms-panel" aria-labelledby="strength-linked-rhythms-title">
          <FoundationSectionHeading
            title="Linked Rhythms"
            headingId="strength-linked-rhythms-title"
            accessibleName={`Linked Rhythms · ${activeStrengthRhythms.length}`}
            secondary={<span className="strength-linked-rhythms-count" aria-hidden="true">{activeStrengthRhythms.length}</span>}
            subtitle="Your routines for building strength."
            actions={
              <>
              {onSaveFoundationAssociations && (
                <button
                  type="button"
                  className="btn mini ghost"
                  aria-haspopup="dialog"
                  onClick={() => setAssociationDialogOpen(true)}
                >
                  Manage links
                </button>
              )}
              {onAddLinkedRhythm && (
                <button
                  type="button"
                  className="btn mini"
                  onClick={event => onAddLinkedRhythm('health-strength', event)}
                >
                  Add Rhythm
                </button>
              )}
              </>
            }
          />
          {activeStrengthRhythms.length > 0 && (
            <FoundationRhythmGroup
              people={people}
              rhythms={activeStrengthRhythms}
              archivedRhythmIds={archivedStrengthRhythms.map(rhythm => rhythm.id)}
              headingId="strength-linked-rhythms-title"
              rhythmScores={rhythmScores}
              completedRhythms={completedRhythms}
              undoableRhythms={undoableRhythms}
              foundations={foundations}
              categoryToken="strength"
              {...(onTend ? { onTend } : {})}
              {...(onUndo ? { onUndo } : {})}
              {...(onEditRhythm ? { onEditRhythm } : {})}
              {...(onRhythmHistory ? { onRhythmHistory } : {})}
              {...(onPersonSelect ? { onPersonSelect } : {})}
              {...(onOpenFoundation ? { onOpenFoundation } : {})}
              {...(onOpenCategory ? { onOpenCategory } : {})}
              completionActionLabelFor={() => 'Log'}
              completionActionAccessibleLabelFor={rhythm =>
                rhythm.healthLogCapability === 'cardio'
                  ? 'Log run'
                  : rhythm.healthLogCapability === 'weight'
                    ? 'Log weigh-in'
                    : rhythm.healthLogCapability === 'flexibility'
                      ? 'Start stretch routine'
                      : 'Log workout'}
              completedActionLabelFor={rhythm =>
                rhythm.healthLogCapability === 'weight'
                  ? 'Weighed in'
                  : rhythm.healthLogCapability === 'flexibility'
                    ? 'Stretched'
                    : 'Logged'}
            />
          )}
          {activeStrengthRhythms.length === 0 && (
            <div className="strength-rhythms-empty">
              <p>No Rhythms are linked to Strength yet.</p>
            </div>
          )}
        </section>
      </section>
      </div>

      {associationDialogOpen && strengthFoundation && onSaveFoundationAssociations && (
      <FoundationRhythmAssociationDialog
        key={strengthFoundation.id}
        foundation={strengthFoundation}
        rhythms={[
          ...rhythms.map(({ rhythm }) => ({ rhythm, archived: false })),
          ...archivedRhythms.map(rhythm => ({ rhythm, archived: true }))
        ]}
        onSave={changes => onSaveFoundationAssociations(strengthFoundation.id, changes)}
        onClose={() => setAssociationDialogOpen(false)}
      />
      )}
      {dialog?.kind === 'goals' && (
        <MoneyGoalDialog
          title="Strength settings"
          labelledBy="strength-settings-title"
          titleId="strength-settings-title"
          closeLabel="Close Strength settings"
          closeButtonId="strength-settings-close"
          initialFocusId="strength-settings-close"
          bodyClassName="strength-settings-body"
          dialogClassName="money-goal-dialog--strength-settings"
          phoneFullScreen
          onClose={closeDialog}
        >
          <form className="strength-settings-form" onSubmit={saveSettings}>
            <div className="strength-settings-scroll">
              <section className="strength-settings-general" aria-label="General">
                <h3>General</h3>
                <div className="strength-settings-general__rows">
                  {!data.trackingStartDate ? (
                    <label className="strength-settings-general__row">
                      <span>Effective date</span>
                      <input type="date" name="strength-tracking-start" aria-label="Effective date"
                        max={evaluationDate} defaultValue={evaluationDate} required />
                    </label>
                  ) : (
                    <label className="strength-settings-general__row">
                      <span>Effective date</span>
                      <input type="date" name="strength-settings-effective-date" aria-label="Effective date"
                        min={data.scoringSettingsHistory?.at(-1)?.effectiveDate ?? data.trackingStartDate}
                        max={evaluationDate} defaultValue={evaluationDate} required />
                    </label>
                  )}
                  <label className="strength-settings-general__row">
                    <span>Weight unit</span>
                    <select name="strength-weight-unit" aria-label="Weight unit" defaultValue={data.settings.weightUnit}>
                      <option value="lb">lb</option>
                      <option value="kg">kg</option>
                    </select>
                  </label>
                </div>
              </section>
              <section className="strength-settings-muscles" aria-labelledby="strength-settings-muscles-heading">
                <h3 id="strength-settings-muscles-heading">Muscle groups</h3>
                <p className="strength-dialog-intro">Rest days guide recommendations. You can log anytime.</p>
                <div className="strength-settings-muscle-list">
                  {strengthMuscles.map(muscle => {
                    const interval = settingsIntervalDrafts[muscle.id] ?? String(data.settings.muscleIntervals[muscle.id] ?? '');
                    const restDays = settingsRestDayDrafts[muscle.id]
                      ?? String(data.settings.preferredRestDays[muscle.id] ?? (muscle.id === 'abs' ? 0 : 1));
                    const restValue = Number(restDays);
                    return (
                      <details className="strength-setting-muscle" key={muscle.id}>
                        <summary className="strength-setting-muscle__summary">
                          <span className="strength-setting-muscle__name">{muscle.name}</span>
                          <span className="strength-setting-muscle__values">
                            {interval.trim() ? `Every ${interval} days` : 'Interval not set'}
                            <span aria-hidden="true"> · </span>
                            {restDays} rest {restValue === 1 ? 'day' : 'days'}
                          </span>
                          <span className="strength-setting-muscle__chevron" aria-hidden="true">⌄</span>
                        </summary>
                        <div className="strength-setting-muscle__fields">
                          <label>
                            <span className="strength-goals-row__field-label">Train every (days)</span>
                            <input aria-label={`${muscle.name} training interval in days`} name={`interval-${muscle.id}`}
                              type="number" min="1" max="365" value={interval} required
                              onChange={event => {
                                const value = event.currentTarget.value;
                                setSettingsIntervalDrafts(current => ({ ...current, [muscle.id]: value }));
                              }} />
                          </label>
                          <label>
                            <span className="strength-goals-row__field-label">Rest days</span>
                            <input aria-label={`${muscle.name} preferred rest days`} name={`rest-${muscle.id}`}
                              type="number" min={muscle.id === 'abs' ? 0 : 1} max="364" value={restDays} required
                              onChange={event => {
                                const value = event.currentTarget.value;
                                setSettingsRestDayDrafts(current => ({ ...current, [muscle.id]: value }));
                              }} />
                          </label>
                          <div className="strength-goals-row__between-sets">
                            <label className="strength-setting-muscle__rest-field" htmlFor={`between-sets-${muscle.id}`}>
                              <span className="strength-goals-row__field-label">Rest between sets</span>
                              <select id={`between-sets-${muscle.id}`} name={`between-sets-${muscle.id}`}
                                aria-label={`${muscle.name} rest between sets`}
                                value={betweenSetRestChoices[muscle.id]
                                  ?? String(data.settings.betweenSetRestSeconds[muscle.id] ?? defaultStrengthBetweenSetRestSeconds[muscle.id])}
                                onChange={event => {
                                  const choice = event.currentTarget.value;
                                  setBetweenSetRestChoices(current => ({
                                    ...current,
                                    [muscle.id]: choice
                                  }));
                                }}>
                                {[60, 90, 120, 150, 180].map(seconds => (
                                  <option key={seconds} value={seconds}>{formatStrengthRest(seconds)}</option>
                                ))}
                                <option value="custom">Custom</option>
                              </select>
                            </label>
                            {betweenSetRestChoices[muscle.id] === 'custom' && (
                              <label className="strength-goals-row__custom">
                                <span className="visually-hidden">{muscle.name} custom rest between sets in seconds</span>
                                <input name={`between-sets-custom-${muscle.id}`} type="number" min="0" max="3600"
                                  value={customBetweenSetSeconds[muscle.id]
                                    ?? String(data.settings.betweenSetRestSeconds[muscle.id] ?? defaultStrengthBetweenSetRestSeconds[muscle.id])}
                                  onChange={event => {
                                    const seconds = event.currentTarget.value;
                                    setCustomBetweenSetSeconds(current => ({
                                      ...current,
                                      [muscle.id]: seconds
                                    }));
                                  }} />
                              </label>
                            )}
                          </div>
                        </div>
                      </details>
                    );
                  })}
                </div>
                {data.trackingStartDate && (
                  <p className="strength-settings-tracking-note">Tracking started {formatFitnessDate(data.trackingStartDate)}.</p>
                )}
              </section>
              {error && <p className="strength-form-error" role="alert">{error}</p>}
            </div>
            <div className="money-goal-dialog__actions strength-settings-actions">
              <button type="submit" className="btn mini">Save settings</button>
              <button type="button" className="btn mini ghost" onClick={closeDialog}>Cancel</button>
            </div>
          </form>
        </MoneyGoalDialog>
      )}
      {dialog?.kind === 'mode' && (
        <MoneyGoalDialog
          title={`Workout mode for ${dialog.setting.rhythm.title}`}
          labelledBy="strength-mode-title"
          titleId="strength-mode-title"
          closeLabel="Close workout mode"
          bodyClassName="strength-dialog-body"
          onClose={closeDialog}
        >
          <form onSubmit={saveRhythmMode}>
            <label className="strength-form-field">Workout mode
              <select name="mode" defaultValue={dialog.setting.mode}>
                <option value="recommended">Recommended Workout</option>
                <option value="specific">Specific Workout</option>
                <option value="custom">Custom Workout</option>
              </select>
            </label>
            <label className="strength-form-field">Saved workout
              <select name="workoutId" defaultValue={dialog.setting.workoutId ?? ''}>
                <option value="">Select a workout</option>
                {dialog.setting.workoutId
                  && !data.savedWorkouts.some(workout => workout.id === dialog.setting.workoutId)
                  && <option value={dialog.setting.workoutId}>Saved workout unavailable</option>}
                {data.savedWorkouts.map(workout => <option key={workout.id} value={workout.id}>{workout.name} · {workout.muscleIds.map(muscleName).join(', ')}</option>)}
              </select>
            </label>
            {error && <p className="strength-form-error" role="alert">{error}</p>}
            <div className="money-goal-dialog__actions"><button type="submit" className="btn mini">Save mode</button><button type="button" className="btn mini ghost" onClick={closeDialog}>Cancel</button></div>
          </form>
        </MoneyGoalDialog>
      )}
      {dialog?.kind === 'rhythm-workout-picker' && (
        <MoneyGoalDialog
          title={`Log workout for ${dialog.rhythm.rhythm.title}`}
          labelledBy="strength-rhythm-workout-picker-title"
          titleId="strength-rhythm-workout-picker-title"
          closeLabel="Close workout choices"
          dialogClassName="money-goal-dialog--strength-rhythm-workout-picker"
          bodyClassName="strength-dialog-body"
          phoneFullScreen
          onClose={closeDialog}
        >
          <p>Choose a current recommendation or use Quick log.</p>
          {recommendations.length > 0 ? (
            <div className="strength-rhythm-workout-choices" aria-label="Current workout recommendations">
              {recommendations.slice(0, 3).map(recommendation => (
                <article className="strength-rhythm-workout-choice" key={recommendation.id}>
                  <div>
                    <h3>{recommendation.name}</h3>
                    <p>{recommendation.reason}</p>
                    <small>{recommendation.muscles.map(muscle => muscle.name).join(' · ')}</small>
                  </div>
                  <button
                    type="button"
                    className="btn mini"
                    onClick={() => startRhythmWorkout(dialog.rhythm, recommendation.id)}
                  >
                    Log {recommendation.name}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="strength-rhythm-workout-picker__empty" role="status">
              No current recommendations. You can still use Quick log.
            </p>
          )}
          <div className="money-goal-dialog__actions">
            <button type="button" className="btn mini" onClick={() => startRhythmWorkout(dialog.rhythm)}>
              Quick log
            </button>
            <button type="button" className="btn mini ghost" onClick={closeDialog}>Cancel</button>
          </div>
        </MoneyGoalDialog>
      )}
      {dialog?.kind === 'workout-browser' && (
        <MoneyGoalDialog
          title="Add workout"
          labelledBy="strength-workout-suggestions-title"
          titleId="strength-workout-suggestions-title"
          initialFocusId={suggestionFocusSourceId
            ? `strength-workout-suggestion-action-${suggestionFocusSourceId}`
            : 'strength-workout-suggestions-title'}
          closeLabel="Close Add workout"
          phoneFullScreen
          bodyClassName="strength-dialog-body"
          dialogClassName="money-goal-dialog--strength-suggestions"
          onClose={closeDialog}
        >
          <StrengthWorkoutSuggestionsDialog
            savedWorkouts={data.savedWorkouts}
            hasDraft={workoutEditorReturn !== null}
            onCreate={() => {
              setSuggestionFocusSourceId(undefined);
              openDialog({ kind: 'workout', returnToBrowser: true });
            }}
            onContinueEditing={continueWorkoutDraft}
            onAdd={(suggestion, event) => openSuggestedWorkout(suggestion, undefined, event)}
            onEdit={(suggestion, workout, event) => openSuggestedWorkout(suggestion, workout, event)}
          />
        </MoneyGoalDialog>
      )}
      {dialog?.kind === 'workout' && (
        <MoneyGoalDialog
          title={dialog.workout ? 'Edit saved workout' : 'Create workout'}
          {...(dialog.returnToBrowser
            ? {
                titleLeadingAction: (
                  <button
                    type="button"
                    className="btn mini ghost"
                    aria-label="Back to Add workout"
                    onClick={() => setDialog({ kind: 'workout-browser' })}
                  >
                    Back
                  </button>
                )
              }
            : {})}
          labelledBy="strength-workout-title"
          titleId="strength-workout-title"
          closeLabel="Close saved workout editor"
          bodyClassName="strength-dialog-body"
          dialogClassName="money-goal-dialog--strength-workout-editor"
          phoneFullScreen={Boolean(dialog.returnToBrowser)}
          onClose={closeDialog}
        >
          <form className="strength-workout-editor" onSubmit={saveTemplate}>
            <label className="strength-form-field">Workout name<input
              name="name"
              maxLength={120}
              required
              value={draftWorkoutName}
              onChange={event => setDraftWorkoutName(event.currentTarget.value)}
              autoFocus
            /></label>
            <StrengthMuscleGroupsDisclosure
              selectedMuscleIds={draftWorkoutMuscles}
              onToggle={muscleId => setDraftWorkoutMuscles(current => current.includes(muscleId)
                ? current.filter(id => id !== muscleId)
                : [...current, muscleId])}
            />
            <section className="rhythm-editor__association" aria-label="Associations">
              <PeopleAssociationRow
                selectedPeople={people.filter(person => workoutPeople.includes(person.id))}
                openerRef={peoplePickerOpenerRef}
                onChoose={openPeoplePicker}
              />
            </section>
            <section className="strength-exercises" aria-labelledby="strength-exercises-title">
              <div className="strength-exercises__heading">
                <h3 id="strength-exercises-title">Exercises</h3>
                <button type="button" className="btn mini ghost" onClick={addExercise}>
                  <span aria-hidden="true">+</span> Add exercise
                </button>
              </div>
              {draftExercises.length === 0
                ? <p className="strength-exercises__empty">No exercises added. This workout can still be logged as before.</p>
                : (
                  <ol className="strength-exercises__list">
                    {draftExercises.map((exercise, index) => {
                      const group = draftSupersetGroups.find(item => item.exerciseIds.includes(exercise.id));
                      const isGroupFirst = group?.exerciseIds[0] === exercise.id;
                      const nextIsGrouped = draftSupersetGroups.some(item =>
                        item.exerciseIds.includes(draftExercises[index + 1]?.id ?? '')
                      );
                      const partner = group?.exerciseIds
                        .map(id => draftExercises.find(item => item.id === id))
                        .find(item => item?.id !== exercise.id);
                      return (
                      <li key={exercise.id} className={[
                        'strength-exercises__item',
                        group && (isGroupFirst
                          ? 'strength-exercises__item--superset-first'
                          : 'strength-exercises__item--superset-second')
                      ].filter(Boolean).join(' ')}>
                        <h4 className="strength-exercises__heading-name" aria-label={exercise.name}>
                          <button
                            type="button"
                            className="strength-exercises__edit"
                            aria-label={`Edit ${exercise.name}`}
                            onClick={event => editExercise(exercise, event)}
                          >
                            <span className="strength-exercises__name">{exercise.name}</span>
                            <span className="strength-exercises__meta">
                              {exercise.equipment} · {formatPlannedSetSummary(exercise.sets)} · Rest {formatStrengthRest(exercise.restDurationSeconds)}
                            </span>
                            {group && <span className="strength-exercises__superset-badge">Superset</span>}
                            <span className="strength-exercises__chevron" aria-hidden="true">›</span>
                          </button>
                        </h4>
                        <details className="strength-exercises__menu">
                          <summary aria-label={`Actions for ${exercise.name}`}>⋯</summary>
                          <div className="strength-exercises__menu-items">
                            <button type="button" onClick={event => {
                              editExercise(exercise, event);
                              event.currentTarget.closest('details')?.removeAttribute('open');
                            }}>Edit</button>
                            <button type="button" aria-label={`Move ${exercise.name} up`} disabled={index === 0} onClick={event => {
                              moveExercise(exercise.id, -1);
                              event.currentTarget.closest('details')?.removeAttribute('open');
                            }}>Move up</button>
                            <button type="button" aria-label={`Move ${exercise.name} down`} disabled={index === draftExercises.length - 1} onClick={event => {
                              moveExercise(exercise.id, 1);
                              event.currentTarget.closest('details')?.removeAttribute('open');
                            }}>Move down</button>
                            {group ? (
                              <button type="button" onClick={event => {
                                setDraftSupersetGroups(groups => groups.filter(item => item.id !== group.id));
                                event.currentTarget.closest('details')?.removeAttribute('open');
                              }} aria-label={`Unpair ${exercise.name}${partner ? ` and ${partner.name}` : ''}`}>Unpair</button>
                            ) : index < draftExercises.length - 1 && !nextIsGrouped ? (
                              <button type="button" onClick={event => {
                                pairWithNext(exercise.id);
                                event.currentTarget.closest('details')?.removeAttribute('open');
                              }}>Pair with next</button>
                            ) : null}
                            <button type="button" aria-label={`Remove ${exercise.name}`} onClick={event => {
                              removeExercise(exercise.id);
                              event.currentTarget.closest('details')?.removeAttribute('open');
                            }}>Remove</button>
                          </div>
                        </details>
                        {group && isGroupFirst && (
                          <div className="strength-exercises__superset-controls">
                            <label className="strength-form-field">
                              Pair rest
                              <select aria-label={`Rest after ${exercise.name} superset round`}
                                value={[60, 90, 120, 150, 180].includes(group.restDurationSeconds)
                                  ? String(group.restDurationSeconds) : 'custom'}
                                onChange={event => {
                                  if (event.currentTarget.value !== 'custom') {
                                    updateSupersetRest(group.id, Number(event.currentTarget.value));
                                  }
                                }}>
                                {[60, 90, 120, 150, 180].map(seconds => (
                                  <option key={seconds} value={seconds}>{formatStrengthRest(seconds)}</option>
                                ))}
                                <option value="custom">Custom</option>
                              </select>
                            </label>
                            {![60, 90, 120, 150, 180].includes(group.restDurationSeconds) && (
                              <label className="strength-form-field">
                                Custom pair rest in seconds
                                <input type="number" min="0" max="3600" step="1"
                                  aria-label="Custom pair rest in seconds"
                                  value={group.restDurationSeconds}
                                  onChange={event => {
                                    const seconds = Number(event.currentTarget.value);
                                    if (Number.isInteger(seconds) && seconds >= 0 && seconds <= 3600) {
                                      updateSupersetRest(group.id, seconds);
                                    }
                                  }} />
                              </label>
                            )}
                          </div>
                        )}
                      </li>
                    );})}
                  </ol>
                )}
            </section>
            {error && <p className="strength-form-error" role="alert">{error}</p>}
            <div className="money-goal-dialog__actions"><button type="submit" className="btn mini">Save workout</button><button type="button" className="btn mini ghost" onClick={closeDialog}>Cancel</button></div>
          </form>
        </MoneyGoalDialog>
      )}
      {exerciseEditor && dialog?.kind === 'workout' && (
        <StrengthExerciseEditor
          key={exerciseEditor.exercise.id}
          exercise={exerciseEditor.exercise}
          weightUnit={data.settings.weightUnit}
          settings={data.settings}
          onDone={finishExerciseEditor}
          onCancel={() => setExerciseEditor(null)}
        />
      )}
      {detailLog && (
        <MoneyGoalDialog
          title={detailLog.workoutName ?? 'Custom workout'}
          intro={formatStrengthWorkoutDateTime(detailLog)}
          labelledBy="strength-history-detail-title"
          titleId="strength-history-detail-title"
          closeLabel="Close workout details"
          bodyClassName="strength-dialog-body"
          onClose={closeDialog}
        >
          <div className="strength-history-detail">
            <section aria-labelledby="strength-history-detail-muscles">
              <h3 id="strength-history-detail-muscles">Muscles trained</h3>
              <p>{detailLog.muscleIds.map(muscleName).join(' · ') || 'Muscle selection unavailable'}</p>
            </section>
            {detailLog.exercises?.length ? (
              <div className="strength-exercise-results-list">
                {detailLog.exercises.map(exercise => {
                  const group = detailLog.supersetGroups?.find(candidate => candidate.exerciseIds.includes(exercise.id));
                  const memberIndex = group?.exerciseIds.indexOf(exercise.id) ?? -1;
                  const partner = group && memberIndex >= 0
                    ? detailLog.exercises?.find(item => item.id === group.exerciseIds[1 - memberIndex])
                    : undefined;
                  return (
                    <StrengthExerciseResults
                      key={exercise.id}
                      exercise={exercise}
                      workouts={data.workouts}
                      reference={detailLog}
                      preferredWeightUnit={data.settings.weightUnit}
                      presentation="history"
                      {...(group ? {
                        supersetContext: `Superset with ${partner?.name ?? 'exercise unavailable'} · Pair rest ${formatStrengthRest(group.restDurationSeconds)}`
                      } : {})}
                    />
                  );
                })}
              </div>
            ) : (
              <p className="strength-history-detail__unavailable">Exercise details were not recorded for this workout.</p>
            )}
            {detailLog.notes && (
              <section aria-labelledby="strength-history-detail-notes">
                <h3 id="strength-history-detail-notes">Notes</h3>
                <p className="strength-history-detail__notes">{detailLog.notes}</p>
              </section>
            )}
            {detailLog.rhythmId && (
              <section aria-labelledby="strength-history-detail-rhythm">
                <h3 id="strength-history-detail-rhythm">Linked Rhythm</h3>
                <p>{detailRhythm?.title ?? 'Rhythm unavailable'}</p>
                {detailLog.rhythmOccurrence && <p>Occurrence: {formatFitnessDate(detailLog.rhythmOccurrence)}</p>}
              </section>
            )}
            {deleteLogError && <p className="strength-form-error" role="alert">{deleteLogError}</p>}
            {confirmingLogDelete ? (
              <div className="strength-history-delete-confirmation" role="alertdialog" aria-labelledby="strength-history-delete-title">
                <h3 id="strength-history-delete-title">Delete this workout?</h3>
                <p>This removes the workout log and only its linked completion.</p>
                <div className="money-goal-dialog__actions">
                  <button
                    ref={historyDeleteCancelRef}
                    type="button"
                    className="btn mini ghost"
                    onClick={() => {
                      restoreDeleteActionFocusRef.current = true;
                      setConfirmingLogDelete(false);
                      setDeleteLogError('');
                    }}
                  >
                    Cancel
                  </button>
                  <button type="button" className="btn mini danger" onClick={() => removeLog(detailLog)}>Delete workout</button>
                </div>
              </div>
            ) : (
              <div className="money-goal-dialog__actions">
                <button type="button" className="btn mini" onClick={event => openDialog({ kind: 'log', log: detailLog }, event)}>Edit</button>
                <button
                  ref={deleteLogButtonRef}
                  type="button"
                  className="btn mini ghost"
                  onClick={() => {
                    setDeleteLogError('');
                    setConfirmingLogDelete(true);
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </MoneyGoalDialog>
      )}
      {peoplePickerOpen && dialog?.kind === 'workout' && (
        <MoneyGoalDialog
          labelledBy="rhythm-association-picker-title"
          closeLabel="Close people picker"
          initialFocusId="rhythm-association-picker-title"
          stopEscapePropagation
          portalToBody
          dialogClassName="money-goal-dialog--association-picker"
          onClose={() => closePeoplePicker(false)}
        >
          <PeopleBadgeSelectionPicker
            people={people}
            selectedIds={pickerPeople}
            onToggle={id => setPickerPeople(current =>
              current.includes(id) ? current.filter(selected => selected !== id) : [...current, id]
            )}
            onToggleGroup={ids => setPickerPeople(current => toggleBadgeGroup(current, ids))}
            groups={peopleGroups}
            onDone={() => closePeoplePicker(true)}
            onCancel={() => closePeoplePicker(false)}
          />
        </MoneyGoalDialog>
      )}
      {dialog?.kind === 'workout-choice' && (
        <MoneyGoalDialog
          title={dialog.workout.name}
          intro="How do you want to record this workout?"
          labelledBy="strength-workout-choice-title"
          titleId="strength-workout-choice-title"
          closeLabel="Close workout choices"
          dialogClassName="money-goal-dialog--strength-workout-choice"
          bodyClassName="strength-dialog-body"
          onClose={closeDialog}
        >
          <div className="strength-workout-choice">
            <button type="button" className="strength-workout-choice__option strength-workout-choice__option--guided"
              onClick={chooseGuidedWorkout}>
              <span className="strength-workout-choice__icon strength-workout-choice__icon--guided" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M6.5 9v6M4 10v4M8.5 7.5v9M15.5 7.5v9M20 10v4M17.5 9v6M8.5 12h7" />
                </svg>
              </span>
              <span className="strength-workout-choice__copy">
                <strong>Full workout</strong>
                <span>Full guided session with the timer. Log each set, rep, and weight as you go.</span>
              </span>
              <span className="strength-workout-choice__tag">Tracks details</span>
            </button>
            <button type="button" className="strength-workout-choice__option strength-workout-choice__option--quick"
              onClick={() => openDialog({
                kind: 'log',
                templateId: dialog.workout.id,
                quick: true
              })}>
              <span className="strength-workout-choice__icon strength-workout-choice__icon--quick" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
              </span>
              <span className="strength-workout-choice__copy">
                <strong>Quick log</strong>
                <span>Records the completion and muscle groups only. No set-by-set entry.</span>
              </span>
            </button>
          </div>
          <div className="money-goal-dialog__actions">
            <button type="button" className="strength-workout-choice__cancel" onClick={closeDialog}>Cancel</button>
          </div>
        </MoneyGoalDialog>
      )}
      {dialog?.kind === 'log' && (
        <MoneyGoalDialog
          title={dialog.quick ? contextualWorkoutName ?? 'Log workout' : dialog.log ? 'Edit workout log' : 'Log workout'}
          {...(logIntro ? { intro: logIntro } : {})}
          labelledBy="strength-log-title"
          titleId="strength-log-title"
          closeLabel="Close workout log"
          bodyClassName="strength-dialog-body"
          dialogClassName={dialog.quick
            ? 'money-goal-dialog--strength-quick-log'
            : 'money-goal-dialog--fitness-log'}
          phoneFullScreen={!dialog.quick || Boolean(dialog.rhythm)}
          scrollableBody={!dialog.quick}
          onClose={closeDialog}
        >
          <form className="fitness-log-form" onSubmit={saveLog}>
            {!isContextualLog && !dialog.quick && (
              <label className="strength-form-field">Saved workout (optional)
                <select
                  name="savedWorkoutId"
                  value={logTemplateSelection}
                  onChange={event => {
                    const workoutId = event.currentTarget.value;
                    acknowledgedUnlinkedLogIdRef.current = null;
                    setLogTemplateSelection(workoutId);
                    setLogMuscleIds(data.savedWorkouts.find(workout => workout.id === workoutId)?.muscleIds ?? []);
                  }}
                >
                  <option value="">Custom workout</option>
                  {logTemplateSelection && !data.savedWorkouts.some(workout => workout.id === logTemplateSelection) && (
                    <option value={logTemplateSelection}>Saved workout unavailable</option>
                  )}
                  {data.savedWorkouts.map(workout => <option key={workout.id} value={workout.id}>{workout.name}</option>)}
                </select>
              </label>
            )}
            {dialog.quick ? (
              <>
                <input type="hidden" name="date" value={logDate} />
                <div className="strength-quick-log__rows">
                  <button
                    type="button"
                    className="strength-quick-log__row"
                    aria-haspopup="dialog"
                    onClick={() => setQuickLogEditor({
                      kind: 'date',
                      date: logDate,
                      initialDate: logDate,
                      ...(selectedWorkoutRhythmId ? { initialRhythmId: selectedWorkoutRhythmId } : {})
                    })}
                  >
                    <span className="strength-quick-log__row-copy">
                      <strong>Date</strong>
                      <span>{formatQuickLogDate(logDate, evaluationDate)}</span>
                    </span>
                    <span className="strength-quick-log__chevron" aria-hidden="true">›</span>
                  </button>
                  <button
                    type="button"
                    className="strength-quick-log__row"
                    aria-haspopup="dialog"
                    onClick={() => setQuickLogEditor({ kind: 'muscles', muscleIds: [...logMuscleIds] })}
                  >
                    <span className="strength-quick-log__row-copy">
                      <strong>Muscle groups</strong>
                      <span>
                        {strengthMuscles.filter(muscle => logMuscleIds.includes(muscle.id))
                          .map(muscle => muscle.name).join(' · ') || 'Choose at least one group'}
                      </span>
                    </span>
                    <span className="strength-quick-log__chevron" aria-hidden="true">›</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <label className="strength-form-field" htmlFor="strength-log-date">Workout date<input
                  id="strength-log-date"
                  name="date"
                  type="date"
                  max={evaluationDate}
                  value={logDate}
                  onChange={event => {
                    changeWorkoutLogDate(event.currentTarget.value);
                  }}
                  required
                /></label>
                <StrengthMuscleSelection
                  selectedMuscleIds={logMuscleIds}
                  legendLabel="Muscles trained"
                  onToggle={muscleId => {
                    acknowledgedUnlinkedLogIdRef.current = null;
                    setLogMuscleIds(current => current.includes(muscleId)
                      ? current.filter(selectedMuscleId => selectedMuscleId !== muscleId)
                      : [...current, muscleId]);
                  }}
                />
              </>
            )}
            {!dialog.log && (
              <StrengthRhythmCompletionPicker
                selectionRef={workoutRhythmSelectionRef}
                options={workoutRhythmOptions}
                {...(selectedWorkoutRhythmId ? { selectedRhythmId: selectedWorkoutRhythmId } : {})}
                {...(rhythmSelectionNotice ? { selectionNotice: rhythmSelectionNotice } : {})}
                onSelect={rhythmId => {
                  acknowledgedUnlinkedLogIdRef.current = null;
                  setSelectedWorkoutRhythmId(rhythmId);
                  setRhythmSelectionNotice('');
                }}
                {...(onAddLinkedRhythm ? {
                  onCreateRhythm: event => onAddLinkedRhythm('health-strength', event)
                } : {})}
              />
            )}
            {!dialog.quick && (
              <label className="strength-form-field">Notes<textarea
                name="notes"
                maxLength={1000}
                defaultValue={dialog.log?.notes ?? ''}
                onChange={() => { acknowledgedUnlinkedLogIdRef.current = null; }}
              /></label>
            )}
            {error && <p className="strength-form-error" role="alert">{error}</p>}
            <div className="money-goal-dialog__actions">
              <button
                type="submit"
                className="btn mini"
                disabled={Boolean(dialog.quick && logMuscleIds.length === 0)}
              >
                Save workout
              </button>
              <button type="button" className="btn mini ghost" onClick={closeDialog}>Cancel</button>
            </div>
          </form>
        </MoneyGoalDialog>
      )}
      {pendingUnlinkedLog && dialog?.kind === 'log' && (
        <StrengthWorkoutOnlyConfirmationDialog
          error={workoutOnlySaveError}
          onClose={() => {
            setPendingUnlinkedLog(null);
            setWorkoutOnlySaveError('');
          }}
          onChooseRhythm={() => {
            setPendingUnlinkedLog(null);
            setWorkoutOnlySaveError('');
            requestAnimationFrame(() => workoutRhythmSelectionRef.current?.focus({ preventScroll: true }));
          }}
          onSaveWorkoutOnly={() => {
            acknowledgedUnlinkedLogIdRef.current = pendingUnlinkedLog.id;
            setWorkoutOnlySaveError('');
            persistWorkoutLog(pendingUnlinkedLog);
          }}
        />
      )}
      {quickLogEditor?.kind === 'date' && (
        <MoneyGoalDialog
          title="Choose workout date"
          labelledBy="strength-quick-log-date-title"
          titleId="strength-quick-log-date-title"
          closeLabel="Close date picker"
          initialFocusId="strength-quick-log-date-input"
          dialogClassName="money-goal-dialog--strength-quick-log-editor"
          bodyClassName="strength-dialog-body"
          onClose={closeQuickLogEditor}
        >
          <label className="strength-form-field" htmlFor="strength-quick-log-date-input">
            Workout date
            <input
              id="strength-quick-log-date-input"
              type="date"
              min={data.trackingStartDate ?? '1900-01-01'}
              max={evaluationDate}
              value={quickLogEditor.date}
              onChange={event => {
                const date = event.currentTarget.value;
                setQuickLogEditor(current => current?.kind === 'date'
                  ? { ...current, date }
                  : current);
                if (date >= (data.trackingStartDate ?? '1900-01-01') && date <= evaluationDate) {
                  changeWorkoutLogDate(date);
                }
              }}
              required
            />
          </label>
          <div className="money-goal-dialog__actions">
            <button
              type="button"
              className="btn mini"
              disabled={!quickLogEditor.date || quickLogEditor.date > evaluationDate
                || quickLogEditor.date < (data.trackingStartDate ?? '1900-01-01')}
              onClick={() => setQuickLogEditor(null)}
            >
              Done
            </button>
            <button type="button" className="btn mini ghost" onClick={closeQuickLogEditor}>Cancel</button>
          </div>
        </MoneyGoalDialog>
      )}
      {quickLogEditor?.kind === 'muscles' && (
        <MoneyGoalDialog
          title="Choose muscle groups"
          labelledBy="strength-quick-log-muscles-title"
          titleId="strength-quick-log-muscles-title"
          closeLabel="Close muscle-group selection"
          dialogClassName="money-goal-dialog--strength-quick-log-editor"
          bodyClassName="strength-dialog-body"
          onClose={() => setQuickLogEditor(null)}
        >
          <StrengthMuscleSelection
            selectedMuscleIds={quickLogEditor.muscleIds}
            legendLabel="Muscle groups"
            hideLegend
            onToggle={muscleId => {
              acknowledgedUnlinkedLogIdRef.current = null;
              setQuickLogEditor(current => current?.kind === 'muscles'
                ? {
                    ...current,
                    muscleIds: current.muscleIds.includes(muscleId)
                      ? current.muscleIds.filter(selected => selected !== muscleId)
                      : [...current.muscleIds, muscleId]
                  }
                : current);
            }}
          />
          {quickLogEditor.muscleIds.length === 0 && (
            <p className="strength-form-error" role="status">Select at least one muscle group to apply.</p>
          )}
          <div className="money-goal-dialog__actions">
            <button
              type="button"
              className="btn mini"
              disabled={quickLogEditor.muscleIds.length === 0}
              onClick={() => {
                acknowledgedUnlinkedLogIdRef.current = null;
                setLogMuscleIds([...quickLogEditor.muscleIds]);
                setQuickLogEditor(null);
              }}
            >
              Apply
            </button>
            <button type="button" className="btn mini ghost" onClick={() => setQuickLogEditor(null)}>Cancel</button>
          </div>
        </MoneyGoalDialog>
      )}
      {pendingGuidedStart && !guidedSessionOpen && (
        <MoneyGoalDialog
          title={data.guidedSessionDraft
            ? confirmingGuidedStartDiscard
              ? `Discard ${data.guidedSessionDraft.workoutName}?`
              : 'Workout in progress'
            : `Start ${pendingGuidedStart.workout.name}?`}
          intro={data.guidedSessionDraft
            ? confirmingGuidedStartDiscard
              ? 'If the replacement saves, this workout’s unfinished progress will be removed.'
              : `${data.guidedSessionDraft.workoutName} is in progress. Resume it or choose to start another workout.`
            : 'This workout will be saved as an in-progress draft until you finish and review it.'}
          labelledBy="strength-guided-start-title"
          titleId="strength-guided-start-title"
          closeLabel={confirmingGuidedStartDiscard ? 'Cancel workout replacement' : 'Close workout start options'}
          bodyClassName="strength-dialog-body"
          onClose={cancelGuidedStart}
        >
          <div className="strength-guided-start">
            {guidedSessionError && <p className="strength-form-error" role="alert">{guidedSessionError}</p>}
            {data.guidedSessionDraft ? (
              confirmingGuidedStartDiscard ? (
                <>
                  {pendingGuidedStart.workout.name.trim() && (
                    <p>Start instead: <strong>{pendingGuidedStart.workout.name}</strong></p>
                  )}
                  <div className="money-goal-dialog__actions">
                    <button type="button" className="btn mini danger" onClick={discardAndStartGuidedWorkout}>Discard and start</button>
                    <button type="button" className="btn mini ghost" onClick={() => {
                      setConfirmingGuidedStartDiscard(false);
                      setGuidedSessionError('');
                    }}>Keep workout</button>
                  </div>
                </>
              ) : (
                <>
                  {pendingGuidedStart.rhythm && data.guidedSessionDraft.rhythmId !== pendingGuidedStart.rhythm.rhythm.id
                    && <p role="status">Resuming this session will leave {pendingGuidedStart.rhythm.rhythm.title} uncompleted.</p>}
                  <div className="money-goal-dialog__actions">
                    <button type="button" className="btn mini" onClick={resumeGuidedWorkout}>Resume</button>
                    <button type="button" className="btn mini danger" onClick={() => {
                      setGuidedSessionError('');
                      setConfirmingGuidedStartDiscard(true);
                    }}>Discard and start…</button>
                    <button type="button" className="btn mini ghost" onClick={cancelGuidedStart}>Cancel</button>
                  </div>
                </>
              )
            ) : (
              <div className="money-goal-dialog__actions">
                {pendingGuidedStart.workout.exercises?.some(exercise => exercise.loadMeaning === undefined) && (
                  <button type="button" className="btn mini ghost" onClick={event => {
                    const workout = pendingGuidedStart.workout;
                    setPendingGuidedStart(null);
                    openDialog({ kind: 'workout', workout }, event);
                  }}>Set up exercise details</button>
                )}
                <button type="button" className="btn mini" onClick={() => startGuidedWorkout(pendingGuidedStart)}>Retry start</button>
                <button type="button" className="btn mini ghost" onClick={cancelGuidedStart}>Cancel</button>
              </div>
            )}
          </div>
        </MoneyGoalDialog>
      )}
      {guidedSessionOpen && data.guidedSessionDraft && (
        <StrengthGuidedSessionDialog
          key={data.guidedSessionDraft.id}
          people={people}
          rhythms={rhythms}
          archivedRhythms={archivedRhythms}
          datedRhythmCompletions={datedRhythmCompletions}
          {...(onAddLinkedRhythm ? { onAddLinkedRhythm } : {})}
          session={data.guidedSessionDraft}
          workouts={data.workouts}
          preferredWeightUnit={data.settings.weightUnit}
          onChange={updateGuidedSession}
          onFinish={saveGuidedWorkout}
          onApplyCustomRestDuration={applyGuidedCustomRestDuration}
          onDiscard={discardGuidedSession}
          onEditExerciseDetails={editGuidedExerciseDetails}
          onClose={() => {
            setGuidedSessionOpen(false);
            if (rhythmLogRequestIdRef.current !== null) {
              rhythmLogRequestIdRef.current = null;
              onRhythmLogClosed?.();
            }
            if (quickStartRequestIdRef.current !== null) {
              quickStartRequestIdRef.current = null;
              onQuickStartClosed?.();
            }
          }}
        />
      )}
    </section>
  );
}

function formatPlannedSet(set: StrengthWorkoutExercise['sets'][number]): string {
  if (set.measurement?.kind === 'duration') {
    const seconds = set.measurement.targetDurationSeconds;
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} time`;
  }
  return `${set.targetReps ?? '—'} reps`;
}

function formatPlannedSetSummary(sets: StrengthWorkoutExercise['sets']): string {
  if (!sets.length) return 'No planned sets';
  const formatted = sets.map(formatPlannedSet);
  if (formatted.every(value => value === formatted[0])) {
    return `${sets.length} × ${formatted[0]}`;
  }
  const allReps = sets.every(set => set.measurement?.kind !== 'duration');
  if (allReps) {
    return `${sets.length} sets · ${sets.map(set => set.targetReps ?? '—').join(' / ')} reps`;
  }
  const allTimed = sets.every(set => set.measurement?.kind === 'duration');
  if (allTimed) {
    return `${sets.length} sets · ${formatted.map(value => value.replace(/ time$/, '')).join(' / ')} time`;
  }
  return `${sets.length} sets · ${formatted.join(' / ')}`;
}

function StrengthWorkoutHistory({
  history,
  rowRefs,
  onOpen,
  onShowMore
}: {
  history: StrengthWorkoutHistory;
  rowRefs: MutableRefObject<Map<string, HTMLButtonElement>>;
  onOpen: (log: StrengthWorkoutLog, event: MouseEvent<HTMLButtonElement>) => void;
  onShowMore?: () => void;
}) {
  if (!history.total) return <p className="strength-empty">No workouts recorded yet.</p>;
  return (
    <div className="strength-history">
      {history.groups.map(group => (
        <section key={group.key} className="strength-history-month" aria-labelledby={`strength-history-month-${group.key}`}>
          <h3 id={`strength-history-month-${group.key}`}>{group.label}</h3>
          <ol>
            {group.logs.map(log => (
              <li key={log.id} className="strength-history-card">
                <button
                  ref={element => {
                    if (element) rowRefs.current.set(log.id, element);
                    else rowRefs.current.delete(log.id);
                  }}
                  type="button"
                  className="strength-history-row"
                  aria-label={`View ${log.workoutName ?? 'Custom workout'}, ${formatFitnessDate(log.date)}, ${log.muscleIds.map(muscleName).join(', ') || 'muscle selection unavailable'}`}
                  onClick={event => onOpen(log, event)}
                >
                  <span className="strength-history-row__content">
                    <strong>{log.workoutName ?? 'Custom workout'}</strong>
                    <span>{formatFitnessDate(log.date)}</span>
                    <span>{log.muscleIds.map(muscleName).join(' · ') || 'Muscle selection unavailable'}</span>
                  </span>
                  <span className="strength-history-row__chevron" aria-hidden="true">›</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      ))}
      {history.hasMore && onShowMore && (
        <button type="button" className="btn mini ghost strength-history-more" onClick={onShowMore}>
          Show 10 more
        </button>
      )}
    </div>
  );
}

function visibleStrengthMuscles(view: 'front' | 'back') {
  return strengthMuscles.filter(muscle => muscle[view]);
}

function formatFitnessDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
    : 'Date unavailable';
}

function formatQuickLogDate(value: string, today: string): string {
  const date = new Date(`${value}T12:00:00`);
  const todayDate = new Date(`${today}T12:00:00`);
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(todayDate.getTime())) return 'Date unavailable';
  const [year, month, day] = value.split('-').map(Number);
  const [todayYear, todayMonth, todayDay] = today.split('-').map(Number);
  const daysAgo = (Date.UTC(todayYear!, todayMonth! - 1, todayDay!)
    - Date.UTC(year!, month! - 1, day!)) / 86_400_000;
  const label = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(date);
  if (daysAgo === 0) return `Today, ${label}`;
  if (daysAgo === 1) return `Yesterday, ${label}`;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

function strengthReadiness(score: StrengthMuscleScore): string {
  if (score.historyState === 'invalid') return 'Unavailable';
  if (!score.lastTrained) return 'Not logged yet';
  if (score.restDaysRemaining === 1) return 'Ready tomorrow';
  if (score.restDaysRemaining > 1) return `Ready in ${score.restDaysRemaining} days`;
  return 'Ready';
}

function strengthLastWorkoutLabel(score: StrengthMuscleScore): string {
  if (score.historyState === 'invalid') return 'Unavailable';
  if (score.daysSince === null) return 'No log yet';
  if (score.daysSince === 0) return 'Today';
  return `${score.daysSince}d ago`;
}

function strengthNextDueLabel(score: StrengthMuscleScore): string {
  if (score.daysUntilDue === null) return '—';
  if (score.daysUntilDue < 0) return `Overdue by ${Math.abs(score.daysUntilDue)}d`;
  if (score.daysUntilDue === 0) return 'Due today';
  return `Next lift in ${score.daysUntilDue}d`;
}

function strengthMuscleTrainingStatus(score: StrengthMuscleScore): {
  label: string;
  tone: 'current' | 'due' | 'overdue' | 'unavailable';
} {
  if (score.historyState === 'invalid') {
    return { label: 'History unavailable', tone: 'unavailable' };
  }
  if (!score.lastTrained) return { label: 'No log', tone: 'unavailable' };
  if (score.daysUntilDue === null) {
    return { label: 'Interval unavailable', tone: 'unavailable' };
  }
  if (score.daysUntilDue < 0) {
    const daysOverdue = Math.abs(score.daysUntilDue);
    return {
      label: `Overdue by ${daysOverdue} ${daysOverdue === 1 ? 'day' : 'days'}`,
      tone: 'overdue'
    };
  }
  if (score.daysUntilDue === 0) return { label: 'Due today', tone: 'due' };
  return { label: 'Current', tone: 'current' };
}

function formatStrengthWorkoutDateTime(log: StrengthWorkoutLog): string {
  if (!log.startedAt || !log.finishedAt || !log.timeZone) return formatFitnessDate(log.date);
  const start = new Date(log.startedAt);
  const finish = new Date(log.finishedAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(finish.getTime())) return formatFitnessDate(log.date);
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: log.timeZone
  });
  return `${formatFitnessDate(log.date)} · ${formatter.format(start)}–${formatter.format(finish)}`;
}
