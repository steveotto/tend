import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, MouseEvent, MutableRefObject } from 'react';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { PersonBadge } from './PersonBadge.tsx';
import { RhythmCard } from './Cards.tsx';
import { toggleBadgeGroup } from './BadgeSelectionPicker.tsx';
import { PeopleAssociationRow, PeopleBadgeSelectionPicker } from './PeopleAssociationControls.tsx';
import { StrengthMuscleSelection } from './StrengthMuscleSelection.tsx';
import { StrengthWorkoutSuggestionsDialog } from './StrengthWorkoutSuggestionsDialog.tsx';
import {
  createStrengthWorkout,
  deleteStrengthWorkout,
  deleteStrengthWorkoutLog,
  editStrengthWorkout,
  rankStrengthWorkouts,
  saveStrengthWorkoutLog,
  selectStrengthWorkoutHistory,
  selectStrengthMuscleScores,
  selectStrengthScore,
  strengthMuscleName as muscleName,
  strengthMuscles,
  validateStrengthSettings
} from '../domain/strength.ts';
import type {
  StrengthData,
  StrengthMode,
  StrengthMuscleId,
  StrengthMuscleScore,
  StrengthSavedWorkout,
  StrengthWorkoutSuggestion,
  StrengthWorkoutHistory,
  StrengthWorkoutLog
} from '../domain/strength.ts';
import { personById, syntheticPeople, type PersonId, type RhythmPreview } from '../domain/preview-data.ts';

type StrengthRhythm = {
  rhythm: RhythmPreview;
  mode: StrengthMode;
  workoutId?: string;
};

export type StrengthViewProps = {
  data: StrengthData;
  rhythms: readonly StrengthRhythm[];
  archivedRhythms?: readonly RhythmPreview[];
  completedRhythmIds: ReadonlySet<string>;
  evaluationDate: string;
  onChange: (next: StrengthData) => string | null;
  onAddRhythm: (event: MouseEvent<HTMLButtonElement>) => void;
  onEditRhythm: (rhythm: RhythmPreview, event: MouseEvent<HTMLButtonElement>) => void;
  onOpenRhythm: (rhythm: RhythmPreview, event: MouseEvent<HTMLButtonElement>) => void;
  pendingRhythmLog?: {
    requestId: number;
    rhythm: RhythmPreview;
    mode: StrengthMode;
    workoutId?: string;
  } | null;
  onRhythmLogOpened?: (requestId: number) => void;
  onRestoreRhythm?: (rhythmId: string) => void;
};

type FitnessTab = 'training' | 'workouts' | 'rhythms';
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

const strengthTabs = [
  { id: 'training', label: 'Training' },
  { id: 'workouts', label: 'Workouts' },
  { id: 'rhythms', label: 'Rhythms' }
] as const satisfies readonly { id: FitnessTab; label: string }[];

const workoutTabs = [
  { id: 'saved', label: 'Saved Workouts' },
  { id: 'history', label: 'History' }
] as const satisfies readonly { id: WorkoutsTab; label: string }[];

export function StrengthView({
  data,
  rhythms,
  archivedRhythms = [],
  completedRhythmIds,
  evaluationDate,
  onChange,
  onAddRhythm,
  onEditRhythm,
  onOpenRhythm,
  pendingRhythmLog = null,
  onRhythmLogOpened,
  onRestoreRhythm
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
  const [logTemplateSelection, setLogTemplateSelection] = useState('');
  const [logMuscleIds, setLogMuscleIds] = useState<StrengthMuscleId[]>([]);
  const [workoutPeople, setWorkoutPeople] = useState<PersonId[]>([]);
  const [pickerPeople, setPickerPeople] = useState<PersonId[]>([]);
  const [peoplePickerOpen, setPeoplePickerOpen] = useState(false);
  const [suggestionPickerOpen, setSuggestionPickerOpen] = useState(false);
  const [suggestionFocusSourceId, setSuggestionFocusSourceId] = useState<string | undefined>();
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const historyRowOpenerRef = useRef<HTMLButtonElement | null>(null);
  const historyRowRefs = useRef(new Map<string, HTMLButtonElement>());
  const focusAfterHistoryDeleteRef = useRef<string | null>(null);
  const restoreHistoryFocusRef = useRef(false);
  const historyTabRef = useRef<HTMLButtonElement | null>(null);
  const strengthTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const workoutTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const deleteLogButtonRef = useRef<HTMLButtonElement | null>(null);
  const historyDeleteCancelRef = useRef<HTMLButtonElement | null>(null);
  const restoreDeleteActionFocusRef = useRef(false);
  const peoplePickerOpenerRef = useRef<HTMLButtonElement | null>(null);
  const suggestionPickerOpenerRef = useRef<HTMLButtonElement | null>(null);
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
    if (!suggestionPickerOpen && restoreSuggestionPickerFocusRef.current) {
      suggestionPickerOpenerRef.current?.focus({ preventScroll: true });
      restoreSuggestionPickerFocusRef.current = false;
    }
  }, [suggestionPickerOpen]);

  useEffect(() => {
    if (!pendingRhythmLog) return;
    const rhythm = rhythms.find(item => item.rhythm.id === pendingRhythmLog.rhythm.id);
    if (!rhythm) return;
    openerRef.current = [...document.querySelectorAll<HTMLElement>('[data-strength-rhythm]')]
      .find(element => element.dataset.strengthRhythm === rhythm.rhythm.id)
      ?.querySelector<HTMLButtonElement>('button[aria-label^="Log workout"]') ?? null;
    const configuredWorkoutId = pendingRhythmLog.mode === 'specific'
      ? pendingRhythmLog.workoutId
      : pendingRhythmLog.mode === 'recommended'
        ? recommendations[0]?.id
        : undefined;
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
  }, [pendingRhythmLog, recommendations, rhythms, onRhythmLogOpened]);

  function openDialog(next: FitnessDialog, event: MouseEvent<HTMLButtonElement>) {
    restoreHistoryFocusRef.current = next.kind === 'log' && Boolean(next.log && historyRowOpenerRef.current);
    openerRef.current = next.kind === 'log' && next.log
      ? historyRowOpenerRef.current ?? event.currentTarget
      : event.currentTarget;
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
    setError('');
    draftWorkoutIdRef.current = null;
    draftLogIdRef.current = null;
    setPeoplePickerOpen(false);
    setDialog(null);
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

  function saveSettings(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = formEvent.currentTarget;
    const muscleIntervals = { ...data.settings.muscleIntervals };
    const preferredRestDays = { ...data.settings.preferredRestDays };
    for (const muscle of strengthMuscles) {
      const interval = Number(new FormData(form).get(`interval-${muscle.id}`));
      const rest = Number(new FormData(form).get(`rest-${muscle.id}`));
      muscleIntervals[muscle.id] = interval;
      preferredRestDays[muscle.id] = rest;
    }
    const errors = validateStrengthSettings({ muscleIntervals, preferredRestDays });
    const firstError = strengthMuscles.find(muscle => errors[muscle.id]);
    if (firstError) {
      setError(`${firstError.name}: ${errors[firstError.id]}`);
      form.querySelector<HTMLInputElement>(`[name="interval-${firstError.id}"]`)?.focus();
      return;
    }
    const saveError = onChange({ ...data, settings: { muscleIntervals, preferredRestDays } });
    if (saveError) setError(saveError);
    else closeDialog();
  }

  function saveTemplate(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = new FormData(formEvent.currentTarget);
    const muscleIds = strengthMuscles
      .filter(muscle => form.get(`muscle-${muscle.id}`) === 'on')
      .map(muscle => muscle.id);
    const existing = dialog?.kind === 'workout' ? dialog.workout : undefined;
    draftWorkoutIdRef.current ??= `strength-workout-${globalThis.crypto.randomUUID()}`;
    const suggestionSourceId = existing?.suggestionSourceId
      ?? (dialog?.kind === 'workout' ? dialog.suggestion?.sourceId : undefined);
    const workout: StrengthSavedWorkout = {
      ...(existing ?? {}),
      id: existing?.id ?? draftWorkoutIdRef.current,
      name: String(form.get('name') ?? '').trim(),
      muscleIds,
      sharedWith: [...workoutPeople],
      ...(suggestionSourceId === undefined ? {} : { suggestionSourceId })
    };
    const result = existing
      ? editStrengthWorkout(data.savedWorkouts, workout)
      : createStrengthWorkout(data.savedWorkouts, workout);
    if (!result.valid) {
      setError(result.error);
      return;
    }
    const saveError = onChange({ ...data, savedWorkouts: result.workouts });
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

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === 'ArrowRight' ? (index + 1) % strengthTabs.length
      : event.key === 'ArrowLeft' ? (index - 1 + strengthTabs.length) % strengthTabs.length
        : event.key === 'Home' ? 0
          : event.key === 'End' ? strengthTabs.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    setTab(strengthTabs[next]!.id);
    strengthTabRefs.current[next]?.focus();
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
      <header className="category-page-heading strength-page__heading">
        <div>
          <h1 id="strength-title">Strength</h1>
          <p>Training status follows your chosen intervals; it is separate from Rhythm Health and is not medical advice.</p>
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

      <div className="strength-tabs" role="tablist" aria-label="Strength views">
        {strengthTabs.map(({ id, label }, index) => (
          <button
            key={id}
            ref={element => {
              strengthTabRefs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`strength-tab-${id}`}
            aria-controls={`strength-panel-${id}`}
            aria-selected={tab === id}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
            onKeyDown={event => onTabKeyDown(event, index)}
          >
            {label}
          </button>
        ))}
      </div>

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
                      aria-label={`${muscle.name}, ${result.score === null ? 'score unavailable' : `${Math.round(result.score)} out of 100`}, ${result.status}`}
                      onClick={() => chooseMuscle(muscle.id)}
                    >
                      <span><strong>{muscle.name}</strong><b>{result.score === null ? '—' : Math.round(result.score)}</b></span>
                      <small>{result.status}</small>
                      <span className="strength-muscle-row__track" aria-hidden="true">
                        <i style={{ width: `${result.score === null ? 0 : Math.max(0, Math.min(100, result.score))}%` }} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="strength-muscle-detail" aria-live="polite">
              <h3>{selected.name} <strong>{selected.score === null ? '—' : Math.round(selected.score)}</strong></h3>
              <p>{selected.intervalDays === null ? 'Training interval unavailable.' : `Train every ${selected.intervalDays} days`}</p>
              <p>Preferred rest: {selected.preferredRestDays} full {selected.preferredRestDays === 1 ? 'day' : 'days'}</p>
              <p>Last trained: {selected.lastTrained ?? (selected.historyState === 'invalid' ? 'History unavailable' : 'Not logged yet')}</p>
            </div>
          </section>
          <section className="card strength-card" aria-labelledby="strength-recommendations-heading">
            <header className="strength-card-heading">
              <div><h2 id="strength-recommendations-heading">Suggested workouts</h2><p>Based on your training plan—not recovery or medical advice.</p></div>
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
                    <div className="strength-card-heading__actions">
                      <button
                        ref={suggestionPickerOpenerRef}
                        type="button"
                        className="btn mini ghost"
                        onClick={() => {
                          setSuggestionFocusSourceId(undefined);
                          setSuggestionPickerOpen(true);
                        }}
                      >
                        Browse suggested workouts
                      </button>
                      <button type="button" className="btn mini" onClick={event => openDialog({ kind: 'workout' }, event)}>Add workout</button>
                    </div>
                  </header>
                  {data.savedWorkouts.length ? (
                    <div className="strength-template-list">
                      {data.savedWorkouts.map(workout => (
                        <article key={workout.id} className="strength-template">
                          <div><h3>{workout.name}</h3><p>{workout.muscleIds.map(id => muscleName(id)).join(' · ')}</p>
                            {workout.sharedWith.length > 0 && (
                              <div className="strength-template__people" role="group" aria-label={`People associated with ${workout.name}`}>
                                {workout.sharedWith.map(id => <PersonBadge key={id} person={personById(id)} presentation="static" />)}
                              </div>
                            )}
                          </div>
                          <div className="strength-template__actions">
                            <button type="button" className="btn mini" onClick={event => openDialog({ kind: 'log', templateId: workout.id }, event)}>Log workout</button>
                            <button type="button" className="btn mini ghost" onClick={event => openDialog({ kind: 'workout', workout }, event)}>Edit</button>
                            <button type="button" className="btn mini ghost" onClick={() => removeTemplate(workout)}>Delete</button>
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

      <section id="strength-panel-rhythms" role="tabpanel" aria-labelledby="strength-tab-rhythms" hidden={tab !== 'rhythms'}>
      {tab === 'rhythms' && (
        <section className="card strength-card" aria-labelledby="strength-rhythms-heading">
          <header className="strength-card-heading">
            <div><h2 id="strength-rhythms-heading">Strength Rhythms</h2><p>Rhythms use the shared schedule, Seasons, history and completion records.</p></div>
            <button type="button" className="btn mini" onClick={onAddRhythm}>Add Rhythm</button>
          </header>
          {rhythms.length ? (
            <div className="strength-rhythm-list">
              {rhythms.map(({ rhythm, mode, workoutId }) => (
                <div key={rhythm.id} className="strength-rhythm-entry" data-strength-rhythm={rhythm.id}>
                  <RhythmCard
                    variant="simple"
                    rhythm={rhythm}
                    completed={completedRhythmIds.has(rhythm.id)}
                    onDetails={event => onOpenRhythm(rhythm, event)}
                    onTend={event => {
                      openDialog({
                        kind: 'log',
                        rhythm: { rhythm, mode, ...(workoutId ? { workoutId } : {}) },
                        ...(mode === 'specific'
                          ? { templateId: workoutId }
                          : mode === 'recommended' && recommendations[0]
                            ? { templateId: recommendations[0].id }
                            : {})
                      }, event);
                    }}
                    completionActionLabel="Log workout"
                    completedActionLabel="Logged"
                  />
                  <button type="button" className="btn mini ghost" onClick={event => openDialog({ kind: 'mode', setting: { rhythm, mode, ...(workoutId ? { workoutId } : {}) } }, event)}>Workout mode</button>
                  <button type="button" className="btn mini ghost" onClick={event => onEditRhythm(rhythm, event)}>Edit Rhythm</button>
                </div>
              ))}
            </div>
          ) : <p className="strength-empty">No strength Rhythms yet. Add a Rhythm to include your training in Today.</p>}
          {archivedRhythms.length > 0 && (
            <div className="strength-archived-rhythms">
              <h3>Archived Strength Rhythms</h3>
              {archivedRhythms.map(rhythm => (
                <div key={rhythm.id}><span>{rhythm.title}</span>
                  {onRestoreRhythm && <button type="button" className="btn mini ghost" onClick={() => onRestoreRhythm(rhythm.id)}>Restore</button>}
                </div>
              ))}
            </div>
          )}
          {error && !dialog && <p className="strength-form-error" role="alert">{error}</p>}
        </section>
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
            <p className="strength-dialog-intro">Set training intervals and preferred rest days. Rest days guide recommendations; they do not prevent manual workout logging.</p>
            <div className="strength-goals-table" role="table" aria-label="Training intervals and rest days">
              <div className="strength-goals-row strength-goals-row--head" role="row"><span role="columnheader">Muscle group</span><span role="columnheader">Train every (days)</span><span role="columnheader">Rest days</span></div>
              {strengthMuscles.map(muscle => (
                <div className="strength-goals-row" role="row" key={muscle.id}>
                  <span role="rowheader">{muscle.name}</span>
                  <label><span className="visually-hidden">{muscle.name} training interval in days</span><input name={`interval-${muscle.id}`} type="number" min="1" max="365" defaultValue={data.settings.muscleIntervals[muscle.id] ?? ''} required /></label>
                  <label><span className="visually-hidden">{muscle.name} preferred rest days</span><input name={`rest-${muscle.id}`} type="number" min={muscle.id === 'abs' ? 0 : 1} max="364" defaultValue={data.settings.preferredRestDays[muscle.id] ?? (muscle.id === 'abs' ? 0 : 1)} required /></label>
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
          onClose={closeDialog}
        >
          <form onSubmit={saveTemplate}>
            <label className="strength-form-field">Workout name<input name="name" maxLength={120} required defaultValue={dialog.workout?.name ?? dialog.suggestion?.name ?? ''} autoFocus /></label>
            <fieldset className="strength-checkbox-list"><legend>Muscle groups</legend>
              {strengthMuscles.map(muscle => <label key={muscle.id}><input type="checkbox" name={`muscle-${muscle.id}`} defaultChecked={dialog.workout?.muscleIds.includes(muscle.id) ?? dialog.suggestion?.muscleIds.includes(muscle.id) ?? false} />{muscle.name}</label>)}
            </fieldset>
            <section className="rhythm-editor__association" aria-label="Associations">
              <PeopleAssociationRow
                selectedPeople={syntheticPeople.filter(person => workoutPeople.includes(person.id))}
                openerRef={peoplePickerOpenerRef}
                onChoose={openPeoplePicker}
              />
            </section>
            {error && <p className="strength-form-error" role="alert">{error}</p>}
            <div className="money-goal-dialog__actions"><button type="submit" className="btn mini">Save workout</button><button type="button" className="btn mini ghost" onClick={closeDialog}>Cancel</button></div>
          </form>
        </MoneyGoalDialog>
      )}
      {detailLog && (
        <MoneyGoalDialog
          title={detailLog.workoutName ?? 'Custom workout'}
          intro={formatFitnessDate(detailLog.date)}
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
    </main>
  );
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
              fill={scoreFill(result.score)}
              tabIndex={0}
              role="button"
              aria-pressed={selectedId === id}
              aria-label={`${names.get(id)}, ${result.score === null ? 'score unavailable' : `${Math.round(result.score)} out of 100`}, ${result.status}`}
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
