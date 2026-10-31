import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, MouseEvent, MutableRefObject } from 'react';
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
import { FitnessScoreSummary } from './FitnessScoreSummary.tsx';
import { roundFitnessScore } from '../domain/fitness-scoring.ts';
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
  selectStrengthScore,
  saveStrengthScoringSetup,
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
  type RhythmPreview
} from '../domain/preview-data.ts';

type StrengthRhythm = {
  rhythm: RhythmPreview;
  mode: StrengthMode;
  workoutId?: string;
};

export type StrengthViewProps = {
  data: StrengthData;
  peopleGroups?: readonly PersonPickerGroup[];
  rhythms: readonly StrengthRhythm[];
  archivedRhythms?: readonly RhythmPreview[];
  evaluationDate: string;
  onChange: (next: StrengthData) => string | null;
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
};

type FitnessTab = 'training' | 'workouts';
type WorkoutsTab = 'saved' | 'history';
type FitnessDialog =
  | { kind: 'goals' }
  | {
      kind: 'workout';
      workout?: StrengthSavedWorkout;
      suggestion?: StrengthWorkoutSuggestion;
      returnToSuggestions?: boolean;
    }
  | { kind: 'log'; log?: StrengthWorkoutLog; templateId?: string; rhythm?: StrengthRhythm }
  | { kind: 'history'; log: StrengthWorkoutLog }
  | { kind: 'mode'; setting: StrengthRhythm };

type ExerciseEditorState = {
  exercise: StrengthWorkoutExercise;
};

type PendingGuidedStart = {
  workout: StrengthSavedWorkout;
  rhythm?: StrengthRhythm;
  requestId?: number;
};

const strengthTabs = [
  { id: 'training', label: 'Training', tabId: 'strength-tab-training', panelId: 'strength-panel-training' },
  { id: 'workouts', label: 'Workouts', tabId: 'strength-tab-workouts', panelId: 'strength-panel-workouts' }
] as const satisfies readonly SegmentedTab<FitnessTab>[];

const workoutTabs = [
  { id: 'saved', label: 'Saved Workouts' },
  { id: 'history', label: 'History' }
] as const satisfies readonly { id: WorkoutsTab; label: string }[];

export function StrengthView({
  data,
  peopleGroups = syntheticPersonPickerGroups,
  rhythms,
  archivedRhythms = [],
  evaluationDate,
  onChange,
  pendingRhythmLog = null,
  onRhythmLogOpened,
  onRhythmLogClosed,
  quickStartRequest = null,
  onQuickStartClosed,
  pendingRhythmModeRequest = null,
  onRhythmModeRequestOpened,
  onRhythmModeRequestClosed
}: StrengthViewProps) {
  const [tab, setTab] = useState<FitnessTab>('training');
  const [workoutsTab, setWorkoutsTab] = useState<WorkoutsTab>('saved');
  const [visibleHistoryLimit, setVisibleHistoryLimit] = useState(10);
  const [historyAnnouncement, setHistoryAnnouncement] = useState('');
  const [confirmingLogDelete, setConfirmingLogDelete] = useState(false);
  const [deleteLogError, setDeleteLogError] = useState('');
  const [bodyView, setBodyView] = useState<'front' | 'back'>('front');
  const [selectedMuscleId, setSelectedMuscleId] = useState<StrengthMuscleId>('chest');
  const [dialog, setDialog] = useState<FitnessDialog | null>(null);
  const [error, setError] = useState('');
  const [betweenSetRestChoices, setBetweenSetRestChoices] = useState<Partial<Record<StrengthMuscleId, string>>>({});
  const [customBetweenSetSeconds, setCustomBetweenSetSeconds] = useState<Partial<Record<StrengthMuscleId, string>>>({});
  const [logTemplateSelection, setLogTemplateSelection] = useState('');
  const [logMuscleIds, setLogMuscleIds] = useState<StrengthMuscleId[]>([]);
  const [workoutPeople, setWorkoutPeople] = useState<PersonId[]>([]);
  const [draftWorkoutMuscles, setDraftWorkoutMuscles] = useState<StrengthMuscleId[]>([]);
  const [draftExercises, setDraftExercises] = useState<StrengthWorkoutExercise[]>([]);
  const [draftSupersetGroups, setDraftSupersetGroups] = useState<StrengthSupersetGroup[]>([]);
  const [exerciseEditor, setExerciseEditor] = useState<ExerciseEditorState | null>(null);
  const [pickerPeople, setPickerPeople] = useState<PersonId[]>([]);
  const [peoplePickerOpen, setPeoplePickerOpen] = useState(false);
  const [suggestionPickerOpen, setSuggestionPickerOpen] = useState(false);
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
  const historyTabRef = useRef<HTMLButtonElement | null>(null);
  const workoutTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const deleteLogButtonRef = useRef<HTMLButtonElement | null>(null);
  const historyDeleteCancelRef = useRef<HTMLButtonElement | null>(null);
  const restoreDeleteActionFocusRef = useRef(false);
  const peoplePickerOpenerRef = useRef<HTMLButtonElement | null>(null);
  const exerciseEditorOpenerRef = useRef<HTMLButtonElement | null>(null);
  const suggestionPickerOpenerRef = useRef<HTMLButtonElement | null>(null);
  const guidedSessionOpenerRef = useRef<HTMLElement | null>(null);
  const handledRhythmRequestRef = useRef<number | null>(null);
  const handledQuickStartRequestRef = useRef<number | null>(null);
  const quickStartRequestIdRef = useRef<number | null>(null);
  const rhythmLogRequestIdRef = useRef<number | null>(null);
  const handledRhythmModeRequestRef = useRef<number | null>(null);
  const rhythmModeRequestIdRef = useRef<number | null>(null);
  const restorePeoplePickerFocusRef = useRef(false);
  const restoreSuggestionPickerFocusRef = useRef(false);
  const draftWorkoutIdRef = useRef<string | null>(null);
  const draftLogIdRef = useRef<string | null>(null);
  const scores = useMemo(() => selectStrengthMuscleScores(data, evaluationDate), [data, evaluationDate]);
  const score = selectStrengthScore(scores);
  const recommendations = useMemo(() => rankStrengthWorkouts(scores, data.savedWorkouts), [data.savedWorkouts, scores]);
  const selected = scores.find(item => item.id === selectedMuscleId)!;
  const history = useMemo(
    () => selectStrengthWorkoutHistory(data.workouts, visibleHistoryLimit),
    [data.workouts, visibleHistoryLimit]
  );
  const orderedHistory = useMemo(
    () => selectStrengthWorkoutHistory(data.workouts, Number.MAX_SAFE_INTEGER).visibleLogs,
    [data.workouts]
  );
  const detailLog = dialog?.kind === 'history' ? dialog.log : undefined;
  const detailRhythm = detailLog?.rhythmId
    ? rhythms.find(item => item.rhythm.id === detailLog.rhythmId)?.rhythm
      ?? archivedRhythms.find(item => item.id === detailLog.rhythmId)
    : undefined;
  const contextualTemplate = dialog?.kind === 'log' && dialog.templateId
    ? data.savedWorkouts.find(workout => workout.id === dialog.templateId)
    : undefined;
  const isContextualLog = dialog?.kind === 'log' && Boolean(dialog.templateId);
  const contextualWorkoutName = contextualTemplate?.name
    ?? (dialog?.kind === 'log' && dialog.templateId ? 'Saved workout unavailable' : undefined);

  useEffect(() => {
    if (dialog) return;
    const focusAfterDelete = focusAfterHistoryDeleteRef.current;
    if (focusAfterDelete) {
      focusAfterHistoryDeleteRef.current = null;
      const target = historyRowRefs.current.get(focusAfterDelete);
      if (target?.isConnected) target.focus({ preventScroll: true });
      else if (historyTabRef.current?.isConnected) historyTabRef.current.focus({ preventScroll: true });
      return;
    }
    if (restoreHistoryFocusRef.current) {
      restoreHistoryFocusRef.current = false;
      if (historyRowOpenerRef.current?.isConnected) historyRowOpenerRef.current.focus({ preventScroll: true });
      else if (historyTabRef.current?.isConnected) historyTabRef.current.focus({ preventScroll: true });
      return;
    }
    if (openerRef.current?.isConnected) openerRef.current.focus({ preventScroll: true });
  }, [data.workouts, dialog]);

  useEffect(() => {
    if (confirmingLogDelete) historyDeleteCancelRef.current?.focus();
    else if (restoreDeleteActionFocusRef.current) {
      restoreDeleteActionFocusRef.current = false;
      deleteLogButtonRef.current?.focus();
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
    if (!suggestionPickerOpen && restoreSuggestionPickerFocusRef.current) {
      suggestionPickerOpenerRef.current?.focus({ preventScroll: true });
      restoreSuggestionPickerFocusRef.current = false;
    }
  }, [suggestionPickerOpen]);

  useEffect(() => {
    if (!guidedSessionOpen && guidedSessionOpenerRef.current?.isConnected) {
      guidedSessionOpenerRef.current.focus({ preventScroll: true });
    }
  }, [guidedSessionOpen]);

  useEffect(() => {
    if (!pendingRhythmLog || handledRhythmRequestRef.current === pendingRhythmLog.requestId) return;
    handledRhythmRequestRef.current = pendingRhythmLog.requestId;
    rhythmLogRequestIdRef.current = pendingRhythmLog.requestId;
    const rhythm = rhythms.find(item => item.rhythm.id === pendingRhythmLog.rhythm.id);
    if (!rhythm) return;
    openerRef.current = pendingRhythmLog.opener
      ?? [...document.querySelectorAll<HTMLElement>('[data-strength-rhythm]')]
      .find(element => element.dataset.strengthRhythm === rhythm.rhythm.id)
      ?.querySelector<HTMLButtonElement>('button[aria-label^="Log workout"]') ?? null;
    guidedSessionOpenerRef.current = openerRef.current;
    const configuredWorkoutId = pendingRhythmLog.mode === 'specific'
      ? pendingRhythmLog.workoutId
      : pendingRhythmLog.mode === 'recommended'
        ? recommendations[0]?.id
        : undefined;
    const configuredWorkout = data.savedWorkouts.find(workout => workout.id === configuredWorkoutId);
    if (configuredWorkout?.exercises?.length) {
      const request: PendingGuidedStart = {
        workout: configuredWorkout,
        rhythm,
        requestId: pendingRhythmLog.requestId
      };
      if (data.guidedSessionDraft) setPendingGuidedStart(request);
      else if (!startGuidedWorkout(request)) setPendingGuidedStart(request);
      onRhythmLogOpened?.(pendingRhythmLog.requestId);
      return;
    }
    setError('');
    setLogTemplateSelection(configuredWorkoutId ?? '');
    setLogMuscleIds(data.savedWorkouts.find(workout => workout.id === configuredWorkoutId)?.muscleIds ?? []);
    draftLogIdRef.current = `strength-log-${globalThis.crypto.randomUUID()}`;
    setDialog({
      kind: 'log',
      rhythm,
      ...(configuredWorkoutId ? { templateId: configuredWorkoutId } : {})
    });
    onRhythmLogOpened?.(pendingRhythmLog.requestId);
  }, [pendingRhythmLog?.requestId]);

  useEffect(() => {
    if (!quickStartRequest || handledQuickStartRequestRef.current === quickStartRequest.requestId) return;
    handledQuickStartRequestRef.current = quickStartRequest.requestId;
    quickStartRequestIdRef.current = data.guidedSessionDraft ? quickStartRequest.requestId : null;
    openerRef.current = quickStartRequest.opener;
    guidedSessionOpenerRef.current = quickStartRequest.opener;
    if (data.guidedSessionDraft) {
      setGuidedSessionError('');
      setGuidedSessionOpen(true);
    } else {
      setTab('workouts');
      setWorkoutsTab('saved');
    }
  }, [quickStartRequest?.requestId]);

  useEffect(() => {
    if (!pendingRhythmModeRequest
      || handledRhythmModeRequestRef.current === pendingRhythmModeRequest.requestId) return;
    handledRhythmModeRequestRef.current = pendingRhythmModeRequest.requestId;
    rhythmModeRequestIdRef.current = pendingRhythmModeRequest.requestId;
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
    setTab('workouts');
    setWorkoutsTab('saved');
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
    setTab('workouts');
    setWorkoutsTab('history');
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

  function cancelGuidedStart() {
    if (pendingGuidedStart) consumeRhythmRequest(pendingGuidedStart);
    setPendingGuidedStart(null);
    setConfirmingGuidedStartDiscard(false);
    if (rhythmLogRequestIdRef.current !== null) {
      rhythmLogRequestIdRef.current = null;
      onRhythmLogClosed?.();
    }
  }

  function discardAndStartGuidedWorkout() {
    if (!pendingGuidedStart) return;
    const request = pendingGuidedStart;
    startGuidedWorkout(request);
  }

  function startWorkoutFromButton(
    workout: StrengthSavedWorkout,
    event: MouseEvent<HTMLButtonElement>,
    rhythm?: StrengthRhythm
  ) {
    guidedSessionOpenerRef.current = event.currentTarget;
    const request = { workout, ...(rhythm ? { rhythm } : {}) };
    if (!data.guidedSessionDraft && workout.exercises?.some(exercise => exercise.loadMeaning === undefined)) {
      openDialog({ kind: 'workout', workout }, event);
      setError('Choose a load meaning for each exercise, then save the workout before starting.');
      return;
    }
    if (data.guidedSessionDraft) {
      setPendingGuidedStart(request);
      setConfirmingGuidedStartDiscard(false);
      return;
    }
    if (!startGuidedWorkout(request)) setPendingGuidedStart(request);
  }

  function openDialog(
    next: FitnessDialog,
    event?: MouseEvent<HTMLButtonElement>,
    focusOpener?: HTMLButtonElement
  ) {
    if (next.kind === 'goals') {
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
    setLogTemplateSelection(next.kind === 'log'
      ? next.templateId ?? next.log?.savedWorkoutId ?? ''
      : '');
    setLogMuscleIds(next.kind === 'log'
      ? [...(next.log?.muscleIds
        ?? data.savedWorkouts.find(workout => workout.id === next.templateId)?.muscleIds
        ?? [])]
      : []);
    draftWorkoutIdRef.current = next.kind === 'workout' ? next.workout?.id ?? null : null;
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
    const returnToSuggestions = dialog?.kind === 'workout' && dialog.returnToSuggestions;
    const closesRhythmLog = dialog?.kind === 'log' && Boolean(dialog.rhythm);
    const closesRhythmMode = dialog?.kind === 'mode';
    setError('');
    draftWorkoutIdRef.current = null;
    draftLogIdRef.current = null;
    setDraftExercises([]);
    setDraftSupersetGroups([]);
    setExerciseEditor(null);
    setPeoplePickerOpen(false);
    setDialog(null);
    if (closesRhythmLog && rhythmLogRequestIdRef.current !== null) {
      rhythmLogRequestIdRef.current = null;
      onRhythmLogClosed?.();
    }
    if (closesRhythmMode && rhythmModeRequestIdRef.current !== null) {
      rhythmModeRequestIdRef.current = null;
      onRhythmModeRequestClosed?.();
    }
    if (returnToSuggestions) {
      setSuggestionPickerOpen(true);
      restoreSuggestionPickerFocusRef.current = false;
    }
  }

  function closeSuggestionPicker() {
    restoreSuggestionPickerFocusRef.current = true;
    setSuggestionPickerOpen(false);
  }

  function openSuggestedWorkout(
    suggestion: StrengthWorkoutSuggestion,
    workout: StrengthSavedWorkout | undefined,
    event: MouseEvent<HTMLButtonElement>
  ) {
    setSuggestionFocusSourceId(suggestion.sourceId);
    setSuggestionPickerOpen(false);
    restoreSuggestionPickerFocusRef.current = false;
    openDialog({
      kind: 'workout',
      suggestion,
      returnToSuggestions: true,
      ...(workout ? { workout } : {})
    }, event);
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
      form.querySelector<HTMLInputElement>(`[name="interval-${firstError.id}"]`)?.focus();
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

  function saveLog(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = new FormData(formEvent.currentTarget);
    const selectedTemplateId = dialog?.kind === 'log' && dialog.templateId
      ? dialog.templateId
      : String(form.get('savedWorkoutId') ?? '');
    const template = data.savedWorkouts.find(item => item.id === selectedTemplateId);
    const muscleIds = strengthMuscles.filter(muscle => logMuscleIds.includes(muscle.id)).map(muscle => muscle.id);
    const existing = dialog?.kind === 'log' ? dialog.log : undefined;
    draftLogIdRef.current ??= `strength-log-${globalThis.crypto.randomUUID()}`;
    const log: StrengthWorkoutLog = {
      ...(existing ? {
        id: existing.id,
        ...(existing.rhythmId ? { rhythmId: existing.rhythmId } : {}),
        ...(existing.rhythmOccurrence ? { rhythmOccurrence: existing.rhythmOccurrence } : {}),
        ...(existing.completionId ? { completionId: existing.completionId } : {})
      } : {}),
      id: existing?.id ?? draftLogIdRef.current,
      date: String(form.get('date') ?? ''),
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
    if (dialog?.kind === 'log' && dialog.rhythm) {
      if (dialog.rhythm.mode === 'specific' && !template) {
        setError('The selected saved workout is unavailable. Edit the Rhythm or choose a custom workout.');
        return;
      }
      log.rhythmId = dialog.rhythm.rhythm.id;
      log.rhythmOccurrence = log.date;
      log.completionId = existing?.completionId ?? `strength-completion-${globalThis.crypto.randomUUID()}`;
    }
    if (existing?.rhythmId && existing.rhythmOccurrence) {
      log.rhythmId = existing.rhythmId;
      log.rhythmOccurrence = log.date;
      if (existing.completionId) log.completionId = existing.completionId;
    }
    const result = saveStrengthWorkoutLog(data.workouts, log);
    if (!result.valid) {
      setError(result.error);
      return;
    }
    const saveError = onChange({ ...data, workouts: result.workouts });
    if (saveError) setError(saveError);
    else {
      if (existing) {
        const updatedHistory = selectStrengthWorkoutHistory(result.workouts, visibleHistoryLimit);
        const remainsVisible = updatedHistory.visibleLogs.some(item => item.id === existing.id);
        setHistoryAnnouncement(remainsVisible
          ? 'Workout updated.'
          : 'Workout updated. It is outside the currently shown recent entries.');
        setTab('workouts');
        setWorkoutsTab('history');
      }
      closeDialog();
    }
  }

  function removeTemplate(workout: StrengthSavedWorkout) {
    const next = deleteStrengthWorkout(data.savedWorkouts, workout.id);
    const saveError = onChange({ ...data, savedWorkouts: next });
    if (saveError) setError(saveError);
    else closeDialog();
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

  function onWorkoutsTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === 'ArrowRight' ? (index + 1) % workoutTabs.length
      : event.key === 'ArrowLeft' ? (index - 1 + workoutTabs.length) % workoutTabs.length
        : event.key === 'Home' ? 0
          : event.key === 'End' ? workoutTabs.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    setWorkoutsTab(workoutTabs[next]!.id);
    workoutTabRefs.current[next]?.focus();
  }

  function chooseMuscle(id: StrengthMuscleId) {
    setSelectedMuscleId(id);
    const muscle = strengthMuscles.find(item => item.id === id)!;
    if (!muscle[bodyView]) setBodyView(muscle.front ? 'front' : 'back');
  }

  return (
    <main className="category-page strength-page" aria-labelledby="strength-title">
      <header className="marriage-section-heading strength-page__heading">
        <div>
          <h3 id="strength-title">Strength</h3>
          <p>Your training, at a glance.</p>
        </div>
        <div
          className="strength-page__score"
          role="meter"
          aria-label="Strength training status score"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={score ?? undefined}
          aria-valuetext={score === null ? 'Score unavailable' : `${score} out of 100`}
        >
          <span>Training status</span><strong>{score === null ? '—' : score}</strong>
        </div>
      </header>

      <SegmentedTabs
        tabs={strengthTabs}
        selectedTabId={tab}
        ariaLabel="Strength views"
        onChange={setTab}
        variant="compact"
      />
      {data.guidedSessionDraft && !guidedSessionOpen && (
        <aside className="strength-guided-banner" aria-label="Workout in progress">
          <div>
            <strong>{data.guidedSessionDraft.workoutName} is in progress</strong>
            <span>Your confirmed sets are saved in this preview draft.</span>
          </div>
          <button type="button" className="btn mini" onClick={event => {
            guidedSessionOpenerRef.current = event.currentTarget;
            setGuidedSessionError('');
            setGuidedSessionOpen(true);
          }}>Resume workout</button>
        </aside>
      )}
      {guidedSessionError && !guidedSessionOpen && !pendingGuidedStart
        && <p className="strength-form-error" role="alert">{guidedSessionError}</p>}

      <section id="strength-panel-training" role="tabpanel" aria-labelledby="strength-tab-training" hidden={tab !== 'training'}>
      {tab === 'training' && (
        <div className="strength-view-grid">
          <section className="card strength-card strength-map-card" aria-labelledby="strength-map-heading">
            <header className="strength-card-heading">
              <div><h2 id="strength-map-heading">Your body, at a glance</h2><p>Choose a muscle group to see its training status.</p></div>
              <button ref={openerRef} type="button" className="btn mini ghost" onClick={event => openDialog({ kind: 'goals' }, event)}>Training goals</button>
            </header>
            <div className="strength-map-toolbar" role="group" aria-label="Body map view">
              {(['front', 'back'] as const).map(view => (
                <button key={view} type="button" aria-pressed={bodyView === view} onClick={() => setBodyView(view)}>
                  {view === 'front' ? 'Front' : 'Back'}
                </button>
              ))}
            </div>
            <div className="strength-map-layout">
              <StrengthBodyMap view={bodyView} scores={scores} selectedId={selectedMuscleId} onSelect={chooseMuscle} />
              <div className="strength-muscle-list" role="group" aria-label="Muscle training status">
                {strengthMuscles.map(muscle => {
                  const result = scores.find(item => item.id === muscle.id)!;
                  return (
                    <button
                      key={muscle.id}
                      type="button"
                      className="strength-muscle-row"
                      aria-pressed={selectedMuscleId === muscle.id}
                      aria-label={`${muscle.name}, Health ${result.health === null ? 'score unavailable' : `${roundFitnessScore(result.health)} out of 100`}, ${result.status}`}
                      onClick={() => chooseMuscle(muscle.id)}
                    >
                      <span><strong>{muscle.name}</strong><b>{roundFitnessScore(result.health) ?? '—'}</b></span>
                      <small>{result.status}</small>
                      <span className="strength-muscle-row__track" aria-hidden="true">
                        <i style={{ width: `${result.health === null ? 0 : Math.max(0, Math.min(100, result.health))}%` }} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="strength-muscle-detail" aria-live="polite">
              <h3 className="strength-muscle-detail__title">{selected.name}</h3>
              <FitnessScoreSummary
                category="Strength"
                consistency={selected.consistency}
                onTrack={selected.onTrack}
                health={selected.health}
                consistencyCaption="How often you show up."
                onTrackCaption="How recently you trained."
                setupRequired={
                  (!data.trackingStartDate || !data.scoringSettingsHistory?.length)
                  && selected.historyState !== 'invalid'
                }
                statusMessage={selected.historyState === 'invalid'
                  ? 'Training history is unavailable.'
                  : selected.health === null
                    && data.trackingStartDate
                    && data.scoringSettingsHistory?.length
                    ? 'Your score will appear as tracking builds.'
                    : null}
                onSetup={event => openDialog({ kind: 'goals' }, event)}
                evidenceDetails={(
                  <>
                    <p>Evaluated through {formatFitnessDate(evaluationDate)}.</p>
                    {selected.eligibleConsistencyWindows > 0 && (
                      <p>
                        {selected.creditedConsistencyWindows} of {selected.eligibleConsistencyWindows}
                        {' '}eligible periods credited.
                      </p>
                    )}
                    {strengthConsistencyEvidence(selected.consistencyUnavailableReason) && (
                      <p>{strengthConsistencyEvidence(selected.consistencyUnavailableReason)}</p>
                    )}
                    {selected.onTrackUnavailableReason && (
                      <p>{strengthOnTrackEvidence(selected.onTrackUnavailableReason)}</p>
                    )}
                    {selected.lastPerformed && (
                      <p>Last confirmed performance: {formatFitnessDate(selected.lastPerformed)}.</p>
                    )}
                    <p>Readiness uses logged workout dates; scoring requires confirmed performed sets.</p>
                  </>
                )}
              />
              <dl className="strength-muscle-facts">
                <div>
                  <dt>Training interval</dt>
                  <dd>{selected.intervalDays === null
                    ? 'Unavailable'
                    : `Every ${selected.intervalDays} ${selected.intervalDays === 1 ? 'day' : 'days'}`}</dd>
                </div>
                <div>
                  <dt>Rest between training</dt>
                  <dd>{selected.preferredRestDays} {selected.preferredRestDays === 1 ? 'day' : 'days'}</dd>
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
          </section>
          <section className="card strength-card" aria-labelledby="strength-recommendations-heading">
            <header className="strength-card-heading">
              <div><h2 id="strength-recommendations-heading">Recommended workouts</h2><p>Suggested from your training goals and when you last trained each muscle group.</p></div>
              <button type="button" className="btn mini" onClick={event => openDialog({ kind: 'log' }, event)}>Custom workout</button>
            </header>
            {recommendations.length ? (
              <div className="strength-recommendations">
                {recommendations.map(item => (
                  <article key={item.id} className="strength-recommendation">
                    <div><h3>{item.name}</h3><p>{item.reason}</p><small>{item.muscles.map(muscle => muscle.name).join(' · ')}</small></div>
                    <button type="button" className="btn mini" onClick={event => openDialog({ kind: 'log', templateId: item.id }, event)}>Log workout</button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="strength-empty">
                {data.savedWorkouts.length === 0
                  ? 'Save a workout to get recommendations, or log a custom workout.'
                  : 'No saved workout is eligible right now. You can still log a custom workout.'}
              </div>
            )}
          </section>
        </div>
      )}
      </section>

      <section id="strength-panel-workouts" role="tabpanel" aria-labelledby="strength-tab-workouts" hidden={tab !== 'workouts'}>
        {tab === 'workouts' && (
          <>
            <div className="strength-tabs strength-tabs--secondary" role="tablist" aria-label="Workouts views">
              {workoutTabs.map(({ id, label }, index) => (
                <button
                  key={id}
                  ref={element => {
                    workoutTabRefs.current[index] = element;
                    if (id === 'history') historyTabRef.current = element;
                  }}
                  type="button"
                  role="tab"
                  id={`strength-workout-tab-${id}`}
                  aria-controls={`strength-workout-panel-${id}`}
                  aria-selected={workoutsTab === id}
                  tabIndex={workoutsTab === id ? 0 : -1}
                  onClick={() => setWorkoutsTab(id)}
                  onKeyDown={event => onWorkoutsTabKeyDown(event, index)}
                >
                  {label}
                </button>
              ))}
            </div>
            <section id="strength-workout-panel-saved" role="tabpanel" aria-labelledby="strength-workout-tab-saved" hidden={workoutsTab !== 'saved'}>
              {workoutsTab === 'saved' && (
                <section className="card strength-card" aria-labelledby="saved-workouts-heading">
                  <header className="strength-card-heading">
                    <div><h2 id="saved-workouts-heading">Saved workouts</h2><p>Workout templates are separate from recorded activity.</p></div>
                  </header>
                  <div className="category-rhythm-entry-actions">
                    <button type="button" className="btn mini" onClick={event => openDialog({ kind: 'workout' }, event)}>
                      Add workout
                    </button>
                    <button
                      ref={suggestionPickerOpenerRef}
                      type="button"
                      className="btn mini ghost"
                      onClick={() => {
                        setSuggestionFocusSourceId(undefined);
                        setSuggestionPickerOpen(true);
                      }}
                    >
                      Suggestions
                    </button>
                  </div>
                  {data.savedWorkouts.length ? (
                    <div className="strength-template-list">
                      {data.savedWorkouts.map(workout => (
                        <article key={workout.id} className="strength-template">
                          <div className="strength-template__content">
                            <h3>{workout.name}</h3>
                            <p>{workout.muscleIds.map(id => muscleName(id)).join(' · ') || 'Muscle selection unavailable'}</p>
                            {workout.exercises && workout.exercises.length > 0 && (
                              <p className="strength-template__exercise-summary">
                                {workout.exercises.length} {workout.exercises.length === 1 ? 'exercise' : 'exercises'} · {workout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0)} planned sets
                              </p>
                            )}
                            {workout.sharedWith.length > 0 && (
                              <div className="strength-template__people" role="group" aria-label={`People associated with ${workout.name}`}>
                                {workout.sharedWith.map(id => <PersonBadge key={id} person={personById(id)} presentation="static" />)}
                              </div>
                            )}
                          </div>
                          <details className="strength-template__menu">
                            <summary aria-label={`Actions for ${workout.name}`}>⋯</summary>
                            <div className="strength-template__menu-items">
                              <button type="button" onClick={event => {
                                openDialog({ kind: 'workout', workout }, event);
                                event.currentTarget.closest('details')?.removeAttribute('open');
                              }}>Edit workout</button>
                              <button type="button" onClick={event => {
                                removeTemplate(workout);
                                event.currentTarget.closest('details')?.removeAttribute('open');
                              }}>Delete workout</button>
                            </div>
                          </details>
                          <div className="strength-template__actions">
                            {workout.exercises && workout.exercises.length > 0 && (
                              <button type="button" className="btn mini" onClick={event => startWorkoutFromButton(workout, event)}>Start workout</button>
                            )}
                            <button type="button" className="btn mini ghost" onClick={event => openDialog({ kind: 'log', templateId: workout.id }, event)}>Log workout</button>
                            {(!workout.exercises || workout.exercises.length === 0) && (
                              <button type="button" className="btn mini ghost"
                                onClick={event => openDialog({ kind: 'workout', workout }, event)}>
                                Add exercises
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : <p className="strength-empty">No saved workouts yet. Create one to quickly log your usual muscle groups.</p>}
                </section>
              )}
            </section>
            <section id="strength-workout-panel-history" role="tabpanel" aria-labelledby="strength-workout-tab-history" hidden={workoutsTab !== 'history'}>
              {workoutsTab === 'history' && (
                <section className="card strength-card strength-history-page" aria-labelledby="strength-history-heading">
                  <header className="strength-card-heading">
                    <div>
                      <h2 id="strength-history-heading">Workout history</h2>
                      <p>{history.total} {history.total === 1 ? 'workout' : 'workouts'} logged</p>
                    </div>
                  </header>
                  {historyAnnouncement && <p className="strength-history-status" role="status">{historyAnnouncement}</p>}
                  <StrengthWorkoutHistory
                    history={history}
                    rowRefs={historyRowRefs}
                    onOpen={openHistoryDetails}
                    onShowMore={() => setVisibleHistoryLimit(limit => limit + 10)}
                  />
                </section>
              )}
            </section>
          </>
        )}
      </section>

      {dialog?.kind === 'goals' && (
        <MoneyGoalDialog
          title="Strength training goals"
          labelledBy="strength-goals-title"
          titleId="strength-goals-title"
          closeLabel="Close Strength training goals"
          bodyClassName="strength-dialog-body"
          onClose={closeDialog}
        >
          <form onSubmit={saveSettings}>
            <p className="strength-dialog-intro">Set how often to train each muscle, rest days between training, and rest between exercise sets. Rest days guide recommendations; they do not prevent manual workout logging.</p>
            {!data.trackingStartDate ? (
              <label className="strength-form-field">Start Strength tracking on
                <input type="date" name="strength-tracking-start" max={evaluationDate} defaultValue={evaluationDate} required />
              </label>
            ) : (
              <>
                <p className="strength-dialog-intro">Strength tracking started {data.trackingStartDate}.</p>
                <label className="strength-form-field">Training settings effective from
                  <input type="date" name="strength-settings-effective-date"
                    min={data.scoringSettingsHistory?.at(-1)?.effectiveDate ?? data.trackingStartDate}
                    max={evaluationDate} defaultValue={evaluationDate} required />
                </label>
              </>
            )}
            <label className="strength-form-field">Strength weight unit
              <select name="strength-weight-unit" defaultValue={data.settings.weightUnit}>
                <option value="lb">lb</option>
                <option value="kg">kg</option>
              </select>
            </label>
            <div className="strength-goals-table" role="table" aria-label="Training intervals, rest days, and rest between sets">
              <div className="strength-goals-row strength-goals-row--head" role="row"><span role="columnheader">Muscle group</span><span role="columnheader">Train every (days)</span><span role="columnheader">Rest days between training</span><span role="columnheader">Between sets</span></div>
              {strengthMuscles.map(muscle => (
                <div className="strength-goals-row" role="row" key={muscle.id}>
                  <span role="rowheader">{muscle.name}</span>
                  <label><span className="strength-goals-row__field-label">Train every (days)</span><input aria-label={`${muscle.name} training interval in days`} name={`interval-${muscle.id}`} type="number" min="1" max="365" defaultValue={data.settings.muscleIntervals[muscle.id] ?? ''} required /></label>
                  <label><span className="strength-goals-row__field-label">Rest days between training</span><input aria-label={`${muscle.name} preferred rest days`} name={`rest-${muscle.id}`} type="number" min={muscle.id === 'abs' ? 0 : 1} max="364" defaultValue={data.settings.preferredRestDays[muscle.id] ?? (muscle.id === 'abs' ? 0 : 1)} required /></label>
                  <div className="strength-goals-row__between-sets">
                    <label className="visually-hidden" htmlFor={`between-sets-${muscle.id}`}>{muscle.name} rest between sets</label>
                    <select id={`between-sets-${muscle.id}`} name={`between-sets-${muscle.id}`}
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
              ))}
            </div>
            {error && <p className="strength-form-error" role="alert">{error}</p>}
            <div className="money-goal-dialog__actions"><button type="submit" className="btn mini">Save goals</button><button type="button" className="btn mini ghost" onClick={closeDialog}>Cancel</button></div>
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
      {dialog?.kind === 'workout' && (
        <MoneyGoalDialog
          title={dialog.workout ? 'Edit saved workout' : 'Add saved workout'}
          labelledBy="strength-workout-title"
          titleId="strength-workout-title"
          closeLabel="Close saved workout editor"
          bodyClassName="strength-dialog-body"
          dialogClassName="money-goal-dialog--strength-workout-editor"
          onClose={closeDialog}
        >
          <form className="strength-workout-editor" onSubmit={saveTemplate}>
            <label className="strength-form-field">Workout name<input name="name" maxLength={120} required defaultValue={dialog.workout?.name ?? dialog.suggestion?.name ?? ''} autoFocus /></label>
            <StrengthMuscleGroupsDisclosure
              selectedMuscleIds={draftWorkoutMuscles}
              onToggle={muscleId => setDraftWorkoutMuscles(current => current.includes(muscleId)
                ? current.filter(id => id !== muscleId)
                : [...current, muscleId])}
            />
            <section className="rhythm-editor__association" aria-label="Associations">
              <PeopleAssociationRow
                selectedPeople={syntheticPeople.filter(person => workoutPeople.includes(person.id))}
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
      {dialog?.kind === 'log' && (
        <MoneyGoalDialog
          title={dialog.log ? 'Edit workout log' : 'Log workout'}
          {...(contextualWorkoutName ? { intro: contextualWorkoutName } : {})}
          labelledBy="strength-log-title"
          titleId="strength-log-title"
          closeLabel="Close workout log"
          bodyClassName="strength-dialog-body"
          onClose={closeDialog}
        >
          <form onSubmit={saveLog}>
            {!isContextualLog && (
              <label className="strength-form-field">Saved workout (optional)
                <select
                  name="savedWorkoutId"
                  value={logTemplateSelection}
                  onChange={event => {
                    const workoutId = event.currentTarget.value;
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
            <label className="strength-form-field">Workout date<input name="date" type="date" max={evaluationDate} defaultValue={dialog.log?.date ?? evaluationDate} required /></label>
            <StrengthMuscleSelection
              selectedMuscleIds={logMuscleIds}
              onToggle={muscleId => setLogMuscleIds(current =>
                current.includes(muscleId)
                  ? current.filter(selectedMuscleId => selectedMuscleId !== muscleId)
                  : [...current, muscleId]
              )}
            />
            <label className="strength-form-field">Notes<textarea name="notes" maxLength={1000} defaultValue={dialog.log?.notes ?? ''} /></label>
            {error && <p className="strength-form-error" role="alert">{error}</p>}
            <div className="money-goal-dialog__actions"><button type="submit" className="btn mini">Save workout</button><button type="button" className="btn mini ghost" onClick={closeDialog}>Cancel</button></div>
          </form>
        </MoneyGoalDialog>
      )}
      {suggestionPickerOpen && (
        <StrengthWorkoutSuggestionsDialog
          savedWorkouts={data.savedWorkouts}
          {...(suggestionFocusSourceId ? { focusSourceId: suggestionFocusSourceId } : {})}
          onAdd={(suggestion, event) => openSuggestedWorkout(suggestion, undefined, event)}
          onEdit={(suggestion, workout, event) => openSuggestedWorkout(suggestion, workout, event)}
          onClose={closeSuggestionPicker}
        />
      )}
      {pendingGuidedStart && !guidedSessionOpen && (
        <MoneyGoalDialog
          title={data.guidedSessionDraft ? 'Workout in progress' : `Start ${pendingGuidedStart.workout.name}?`}
          intro={data.guidedSessionDraft
            ? 'A saved session must be resumed or explicitly discarded before another can start.'
            : 'This workout will be saved as an in-progress draft until you finish and review it.'}
          labelledBy="strength-guided-start-title"
          titleId="strength-guided-start-title"
          closeLabel="Close workout start options"
          bodyClassName="strength-dialog-body"
          onClose={cancelGuidedStart}
        >
          <div className="strength-guided-start">
            {guidedSessionError && <p className="strength-form-error" role="alert">{guidedSessionError}</p>}
            {data.guidedSessionDraft ? (
              <>
                <p>Current session: <strong>{data.guidedSessionDraft.workoutName}</strong></p>
                {pendingGuidedStart.rhythm && data.guidedSessionDraft.rhythmId !== pendingGuidedStart.rhythm.rhythm.id
                  && <p role="status">Resuming this session will leave {pendingGuidedStart.rhythm.rhythm.title} uncompleted.</p>}
                <div className="money-goal-dialog__actions">
                  <button type="button" className="btn mini" onClick={resumeGuidedWorkout}>Resume current workout</button>
                  <button type="button" className="btn mini danger" onClick={() => setConfirmingGuidedStartDiscard(true)}>Discard and start selected workout</button>
                  <button type="button" className="btn mini ghost" onClick={cancelGuidedStart}>Cancel</button>
                </div>
              </>
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
            {confirmingGuidedStartDiscard && (
              <section className="strength-guided__discard" role="alertdialog" aria-labelledby="strength-guided-start-discard-title">
                <h3 id="strength-guided-start-discard-title">Discard the current session?</h3>
                <p>Its unfinished progress will be removed. The selected workout will start only if its draft saves successfully.</p>
                <div className="money-goal-dialog__actions">
                  <button type="button" className="btn mini danger" onClick={discardAndStartGuidedWorkout}>Discard and start</button>
                  <button type="button" className="btn mini ghost" onClick={() => setConfirmingGuidedStartDiscard(false)}>Keep current session</button>
                </div>
              </section>
            )}
          </div>
        </MoneyGoalDialog>
      )}
      {guidedSessionOpen && data.guidedSessionDraft && (
        <StrengthGuidedSessionDialog
          key={data.guidedSessionDraft.id}
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
    </main>
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

function StrengthBodyMap({
  view,
  scores,
  selectedId,
  onSelect
}: {
  view: 'front' | 'back';
  scores: readonly StrengthMuscleScore[];
  selectedId: StrengthMuscleId;
  onSelect: (id: StrengthMuscleId) => void;
}) {
  const visibleIds = view === 'front'
    ? ['shoulders', 'chest', 'biceps', 'abs', 'quads', 'calves'] as const
    : ['shoulders', 'back', 'triceps', 'hamstrings', 'calves'] as const;
  const paths: Partial<Record<StrengthMuscleId, string>> = {
    shoulders: 'M93 79Q65 74 54 98L53 114L74 107L80 86Z M127 79Q155 74 166 98L167 114L146 107L140 86Z',
    chest: 'M81 89Q96 80 108 87L107 129Q86 137 76 122Z M139 89Q124 80 112 87L113 129Q134 137 144 122Z',
    back: 'M81 89L107 81L107 193L91 195L81 158L76 117Z M139 89L113 81L113 193L129 195L139 158L144 117Z',
    biceps: 'M52 116L71 112L66 145L57 162L44 153Z M168 116L149 112L154 145L163 162L176 153Z',
    triceps: 'M52 116L71 112L66 145L57 162L44 153Z M168 116L149 112L154 145L163 162L176 153Z',
    abs: 'M89 139L107 137L107 190L90 197L83 163Z M131 139L113 137L113 190L130 197L137 163Z',
    quads: 'M73 206L105 205L101 265L83 272L74 259Z M147 206L115 205L119 265L137 272L146 259Z',
    hamstrings: 'M73 213L105 214L101 265L83 272L74 259Z M147 213L115 214L119 265L137 272L146 259Z',
    calves: 'M79 284L100 279L95 317L82 318Z M141 284L120 279L125 317L138 318Z'
  };
  const names = new Map(strengthMuscles.map(muscle => [muscle.id, muscle.name]));
  return (
    <div className="strength-map-wrap">
      <svg className="strength-body-svg" viewBox="0 0 220 350" role="group" aria-label={`${view === 'front' ? 'Front' : 'Back'} muscle training status map`}>
        <g fill="var(--tend-mist)" aria-hidden="true"><ellipse cx="110" cy="36" rx="23" ry="28" /><path d="M98 60L97 73Q57 72 48 99L30 181L23 207Q22 218 34 220L47 202L64 139L72 162L69 210L74 294L78 335L99 335L107 244L113 244L121 335L142 335L146 294L151 210L148 162L156 139L173 202L186 220Q198 218 197 207L190 181L172 99Q163 72 123 73L122 60Z" /></g>
        {visibleIds.map(id => {
          const result = scores.find(item => item.id === id)!;
          return (
            <path
              key={id}
              className="strength-body-muscle"
              data-muscle={id}
              d={paths[id]}
              fill={scoreFill(result.health)}
              tabIndex={0}
              role="button"
              aria-pressed={selectedId === id}
              aria-label={`${names.get(id)}, Health ${result.health === null ? 'score unavailable' : `${roundFitnessScore(result.health)} out of 100`}, ${result.status}`}
              onClick={() => onSelect(id)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(id);
                }
              }}
            />
          );
        })}
      </svg>
    </div>
  );
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
  onShowMore: () => void;
}) {
  if (!history.total) return <p className="strength-empty">No workouts logged yet.</p>;
  return (
    <div className="strength-history">
      {history.groups.map(group => (
        <section key={group.key} className="strength-history-month" aria-labelledby={`strength-history-month-${group.key}`}>
          <h3 id={`strength-history-month-${group.key}`}>{group.label}</h3>
          <ol>
            {group.logs.map(log => (
              <li key={log.id}>
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
      {history.hasMore && <button type="button" className="btn mini ghost strength-history-more" onClick={onShowMore}>Show 10 more</button>}
    </div>
  );
}

function scoreFill(score: number | null): string {
  if (score === null) return 'var(--score-neutral)';
  return score >= 80 ? 'var(--score-green)' : score >= 50 ? 'var(--score-yellow)' : 'var(--score-red)';
}

function formatFitnessDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
    : 'Date unavailable';
}

function strengthReadiness(score: StrengthMuscleScore): string {
  if (score.historyState === 'invalid') return 'Unavailable';
  if (!score.lastTrained) return 'Not logged yet';
  if (score.restDaysRemaining === 1) return 'Ready tomorrow';
  if (score.restDaysRemaining > 1) return `Ready in ${score.restDaysRemaining} days`;
  return 'Ready';
}

function strengthConsistencyEvidence(reason: string | null): string | null {
  if (!reason) return null;
  if (reason.includes('legacy') || reason.includes('incomplete')) {
    return 'Some periods were excluded because their workout set details are incomplete.';
  }
  if (reason.includes('No complete interval')) {
    return 'No complete training interval fits in the current 28-day window yet.';
  }
  if (reason.includes('not started')) return 'Strength tracking has not started yet.';
  if (reason.includes('tracking start')) return 'Set a tracking start date and save training settings to begin.';
  if (reason.includes('settings')) return 'Training settings are not available for this date.';
  return 'Consistency evidence is unavailable.';
}

function strengthOnTrackEvidence(reason: string): string {
  if (reason.includes('confirmed performed set')) {
    return 'No confirmed performed sets are recorded for this muscle group yet.';
  }
  if (reason.includes('settings')) return 'Training settings are not available for this date.';
  return 'On Track evidence is unavailable.';
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
