import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { AnchoredPopover } from './AnchoredPopover.tsx';
import { NumericControl } from './NumericControl.tsx';
import { PersonBadge } from './PersonBadge.tsx';
import { StrengthExerciseResults } from './StrengthExerciseResults.tsx';
import {
  addStrengthSessionSet,
  confirmStrengthSessionSet,
  convertStrengthLoad,
  correctStrengthSessionSet,
  correctStrengthSessionDuration,
  finishStrengthGuidedSession,
  hasPerformedStrengthSessionSet,
  isStrengthAddedLoadExercise,
  moveStrengthSessionToSet,
  completeStrengthSessionRestTimer,
  confirmStrengthSessionDuration,
  pauseStrengthSessionRestTimer,
  pauseStrengthExerciseTimer,
  resetStrengthSessionRestTimer,
  resumeStrengthSessionRestTimer,
  selectPreviousStrengthSetValues,
  selectNextStrengthSessionSet,
  selectStrengthExerciseTimerElapsedMilliseconds,
  setStrengthSessionAutoStartRest,
  setStrengthGuidedSessionRestPreference,
  setStrengthSessionRestDuration,
  skipStrengthSessionSet,
  startStrengthSessionRestTimer,
  startStrengthExerciseTimer,
  resetStrengthExerciseTimer,
  updateStrengthGuidedExerciseNotes,
  updateStrengthGuidedSession
} from '../domain/strength.ts';
import type {
  StrengthGuidedSessionDraft,
  StrengthLoad,
  StrengthLoadMeaning,
  StrengthPlannedSet,
  StrengthSessionRestTimer,
  StrengthWorkoutLog
} from '../domain/strength.ts';
import { localDateTimeInZone } from '../domain/rhythm-completion.ts';
import { syntheticPeople } from '../domain/preview-data.ts';

type Props = {
  session: StrengthGuidedSessionDraft;
  workouts: readonly StrengthWorkoutLog[];
  preferredWeightUnit?: 'lb' | 'kg';
  onChange: (session: StrengthGuidedSessionDraft) => string | null;
  onFinish: (log: StrengthWorkoutLog) => string | null;
  onApplyCustomRestDuration: (
    session: StrengthGuidedSessionDraft,
    durationSeconds: number,
    exerciseId: string,
    supersetGroupId?: string
  ) => { applied: boolean; message?: string };
  onDiscard: () => string | null;
  onClose: () => void;
  onEditExerciseDetails: (exerciseId: string, opener: HTMLButtonElement) => void;
};

type SetInput = {
  reps: string;
  durationMinutes: string;
  durationSeconds: string;
  load: string;
  meaning: string;
  unit: 'lb' | 'kg';
  loadSource: 'carried' | 'confirmed' | 'fallback' | 'user';
};

const LOAD_MEANING_ERROR = 'Choose a load meaning in Exercise details before logging this exercise.';
const INVALID_LOAD_ERROR = 'Enter a valid load value, or leave it blank.';

export function StrengthGuidedSessionDialog({
  session,
  workouts,
  preferredWeightUnit = 'lb',
  onChange,
  onFinish,
  onApplyCustomRestDuration,
  onDiscard,
  onClose,
  onEditExerciseDetails
}: Props) {
  const [reviewing, setReviewing] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [editingDateTime, setEditingDateTime] = useState(false);
  const [timerOptionsOpen, setTimerOptionsOpen] = useState(false);
  const [exerciseMenuOpen, setExerciseMenuOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [exerciseNotesDraft, setExerciseNotesDraft] = useState('');
  const [workoutNotesDraft, setWorkoutNotesDraft] = useState('');
  const [customRestMinutes, setCustomRestMinutes] = useState('0');
  const [customRestSeconds, setCustomRestSeconds] = useState('0');
  const [error, setError] = useState('');
  const exercise = session.exercises[session.currentExerciseIndex]!;
  const setIndex = exercise.sets.findIndex(set => set.id === session.currentSetId);
  const set = exercise.sets[setIndex]!;
  const isTimedSet = set.measurement?.kind === 'duration';
  const targetDurationSeconds = set.measurement?.kind === 'duration' ? set.measurement.targetDurationSeconds : 0;
  const exerciseTimer = session.exerciseTimer ?? { status: 'idle' as const, elapsedMilliseconds: 0 };
  const timerExerciseId = exerciseTimer.status === 'idle' ? undefined : exerciseTimer.exerciseId;
  const timerSetId = exerciseTimer.status === 'idle' ? undefined : exerciseTimer.setId;
  const timerMatchesCurrentSet = timerExerciseId === undefined
    || timerExerciseId === exercise.id && timerSetId === set.id;
  const timerExercise = session.exercises.find(item => item.id === timerExerciseId);
  const timerSetIndex = timerExercise?.sets.findIndex(item => item.id === timerSetId) ?? -1;
  const previous = selectPreviousStrengthSetValues(workouts, session, exercise.id, setIndex);
  const lastSet = useMemo(() => session.exercises
    .flatMap(item => item.sets
      .filter(setItem => setItem.status === 'performed')
      .map(setItem => ({ exercise: item, set: setItem })))
    .sort((left, right) => right.set.confirmedAt.localeCompare(left.set.confirmedAt))[0], [session.exercises]);
  const timeFields = localSessionDateTime(session);
  const currentInputKey = sessionInputKey(exercise.id, set.id);
  const earlierLoad = earlierPerformedLoad(session, exercise.id, setIndex, exercise.loadMeaning, preferredWeightUnit);
  const initialInput = () => createInput(set, previous, preferredWeightUnit, exercise.loadMeaning, earlierLoad);
  const [input, setInput] = useState<SetInput>(initialInput);
  const restTimer: StrengthSessionRestTimer = session.restTimer
    ?? { status: 'idle', durationSeconds: exercise.restDurationSeconds };
  const runningDeadline = restTimer.status === 'running' ? restTimer.deadlineAt : null;
  const [remainingMilliseconds, setRemainingMilliseconds] = useState(() => restTimerMilliseconds(restTimer));
  const [exerciseElapsedMilliseconds, setExerciseElapsedMilliseconds] = useState(() =>
    selectStrengthExerciseTimerElapsedMilliseconds(exerciseTimer, new Date().toISOString()) ?? 0
  );
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundMessage, setSoundMessage] = useState('');
  const [alertPlaying, setAlertPlaying] = useState(false);
  const [timerAnnouncement, setTimerAnnouncement] = useState('');
  const timerOptionsButtonRef = useRef<HTMLButtonElement>(null);
  const exerciseMenuButtonRef = useRef<HTMLButtonElement>(null);
  const notesButtonRef = useRef<HTMLButtonElement>(null);
  const setInputDraftsRef = useRef(new Map<string, SetInput>());
  const notesWasOpenRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const alertOscillatorsRef = useRef<Set<OscillatorNode>>(new Set());
  const alertIntervalRef = useRef<number | null>(null);
  const alertableDeadlineRef = useRef<string | null>(null);
  const expiryHandledRef = useRef<string | null>(null);
  const timerWasHiddenRef = useRef(document.visibilityState === 'hidden');

  useEffect(() => {
    setInput(setInputDraftsRef.current.get(currentInputKey)
      ?? createInput(set, previous, preferredWeightUnit, exercise.loadMeaning, earlierLoad));
  }, [currentInputKey, session.currentExerciseIndex, session.currentSetId, exercise.loadMeaning]);

  useEffect(() => {
    if (notesOpen) {
      notesWasOpenRef.current = true;
      setExerciseNotesDraft(exercise.notes ?? '');
      setWorkoutNotesDraft(session.notes ?? '');
    } else if (notesWasOpenRef.current) {
      notesWasOpenRef.current = false;
      notesButtonRef.current?.focus({ preventScroll: true });
    }
  }, [notesOpen, exercise.id]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  useEffect(() => {
    setCustomRestMinutes(String(Math.floor(restTimer.durationSeconds / 60)));
    setCustomRestSeconds(String(restTimer.durationSeconds % 60));
    if (restTimer.status !== 'running') {
      setRemainingMilliseconds(restTimerMilliseconds(restTimer));
    }
  }, [restTimer.status, restTimer.durationSeconds, runningDeadline,
    restTimer.status === 'paused' ? restTimer.remainingMilliseconds : null]);

  useEffect(() => {
    const refresh = () => setExerciseElapsedMilliseconds(
      selectStrengthExerciseTimerElapsedMilliseconds(exerciseTimer, new Date().toISOString()) ?? 0
    );
    refresh();
    if (exerciseTimer.status !== 'running') return;
    const interval = window.setInterval(refresh, 200);
    return () => window.clearInterval(interval);
  }, [exerciseTimer]);

  useEffect(() => {
    if (!runningDeadline) return;
    const deadlineAt = runningDeadline;
    let lastClockCheck = Date.now();
    const refresh = () => {
      const now = Date.now();
      const remaining = Math.max(0, Date.parse(deadlineAt) - now);
      setRemainingMilliseconds(remaining);
      if (document.visibilityState === 'hidden') timerWasHiddenRef.current = true;
      if (remaining === 0 && expiryHandledRef.current !== deadlineAt) {
        expiryHandledRef.current = deadlineAt;
        const isStale = timerWasHiddenRef.current
          || document.visibilityState !== 'visible'
          || now - lastClockCheck > 2000;
        const canAnnounce = alertableDeadlineRef.current === deadlineAt && !isStale;
        const result = completeStrengthSessionRestTimer(session, new Date(now).toISOString());
        if (!result.valid) {
          setError(result.error);
        } else {
          const saveError = onChange(result.session);
          if (saveError) {
            setError(saveError);
          } else if (canAnnounce) {
            setTimerAnnouncement('Rest complete.');
            if (soundEnabled) playRestAlert();
          }
        }
      }
      lastClockCheck = now;
    };
    const interval = window.setInterval(refresh, 200);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    refresh();
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [runningDeadline, session, onChange, soundEnabled]);

  useEffect(() => () => {
    if (alertIntervalRef.current !== null) window.clearInterval(alertIntervalRef.current);
    alertIntervalRef.current = null;
    for (const oscillator of alertOscillatorsRef.current) {
      oscillator.onended = null;
      try { oscillator.stop(); } catch { /* The oscillator may already have ended. */ }
      oscillator.disconnect();
    }
    alertOscillatorsRef.current.clear();
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== 'closed') void context.close();
  }, []);

  function apply(next: StrengthGuidedSessionDraft) {
    const saveError = onChange(next);
    setError(saveError ?? '');
    if (!saveError) afterRestTimerChange(next);
    return !saveError;
  }

  function playRestAlert() {
    const context = audioContextRef.current;
    if (!context || context.state !== 'running') {
      setSoundMessage('Rest complete. Sound is unavailable or suspended; the visual alert remains available.');
      return;
    }
    if (alertIntervalRef.current !== null) return;
    try {
      const chime = () => {
        if (context.state !== 'running') return;
        [659.25, 783.99].forEach((frequency, index) => {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          const startAt = context.currentTime + index * 0.28;
          oscillator.type = 'sine';
          oscillator.frequency.value = frequency;
          gain.gain.setValueAtTime(0.0001, startAt);
          gain.gain.linearRampToValueAtTime(0.035, startAt + 0.025);
          gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.24);
          oscillator.connect(gain);
          gain.connect(context.destination);
          alertOscillatorsRef.current.add(oscillator);
          oscillator.onended = () => {
            alertOscillatorsRef.current.delete(oscillator);
            oscillator.disconnect();
            gain.disconnect();
          };
          oscillator.start(startAt);
          oscillator.stop(startAt + 0.25);
        });
      };
      setAlertPlaying(true);
      chime();
      alertIntervalRef.current = window.setInterval(chime, 1500);
    } catch {
      silenceRestAlert();
      setSoundMessage('Rest complete. Sound could not be played; the visual alert remains available.');
    }
  }

  async function enableSound() {
    const AudioContextConstructor = window.AudioContext;
    if (!AudioContextConstructor) {
      setSoundMessage('Audio is unavailable in this browser; the visual rest alert will still be shown.');
      return;
    }
    try {
      const context = audioContextRef.current?.state === 'closed'
        ? new AudioContextConstructor()
        : audioContextRef.current ?? new AudioContextConstructor();
      await context.resume();
      if (context.state !== 'running') {
        if (audioContextRef.current === context) audioContextRef.current = null;
        await context.close();
        setSoundEnabled(false);
        setSoundMessage('Audio is unavailable or suspended; the visual rest alert remains available.');
        return;
      }
      audioContextRef.current = context;
      setSoundEnabled(true);
      setSoundMessage('Rest timer sound is on.');
      if (restTimer.status === 'running' && Date.parse(restTimer.deadlineAt) > Date.now()) {
        alertableDeadlineRef.current = restTimer.deadlineAt;
        timerWasHiddenRef.current = false;
      }
    } catch {
      setSoundMessage('Audio could not be enabled; the visual rest alert remains available.');
    }
  }

  function disableSound() {
    setSoundEnabled(false);
    setSoundMessage('');
    silenceRestAlert();
  }

  function silenceRestAlert() {
    if (alertIntervalRef.current !== null) {
      window.clearInterval(alertIntervalRef.current);
      alertIntervalRef.current = null;
    }
    for (const oscillator of alertOscillatorsRef.current) {
      oscillator.onended = null;
      try { oscillator.stop(); } catch { /* The oscillator may already have ended. */ }
      oscillator.disconnect();
    }
    alertOscillatorsRef.current.clear();
    setAlertPlaying(false);
  }

  function setRestDuration(seconds: number) {
    const changed = setStrengthSessionRestDuration(session, seconds);
    if (!changed.valid) setError(changed.error);
    else {
      const restarted = restTimer.status === 'running'
        ? startStrengthSessionRestTimer(changed.session, new Date().toISOString())
        : changed;
      if (!restarted.valid) {
        setError(restarted.error);
        return;
      }
      alertableDeadlineRef.current = null;
      expiryHandledRef.current = null;
      setTimerAnnouncement('');
      silenceRestAlert();
      apply(restarted.session);
    }
  }

  function applyCustomRestDuration(seconds: number) {
    const preference = setStrengthGuidedSessionRestPreference(
      session, exercise.id, seconds, superset?.id
    );
    if (!preference.valid) {
      setError(preference.error);
      return;
    }
    const changed = setStrengthSessionRestDuration(preference.session, seconds);
    if (!changed.valid) {
      setError(changed.error);
      return;
    }
    const restarted = restTimer.status === 'running'
      ? startStrengthSessionRestTimer(changed.session, new Date().toISOString())
      : changed;
    if (!restarted.valid) {
      setError(restarted.error);
      return;
    }
    const result = onApplyCustomRestDuration(
      restarted.session,
      seconds,
      exercise.id,
      superset?.id
    );
    if (!result.applied) {
      setError(result.message ?? 'The custom rest duration could not be saved.');
      return;
    }
    afterRestTimerChange(restarted.session);
    setError('');
    setTimerAnnouncement(result.message ?? '');
    setTimerOptionsOpen(false);
  }

  function afterRestTimerChange(next: StrengthGuidedSessionDraft) {
    const nextDeadline = next.restTimer?.status === 'running' ? next.restTimer.deadlineAt : null;
    const currentDeadline = session.restTimer?.status === 'running' ? session.restTimer.deadlineAt : null;
    if (currentDeadline && nextDeadline !== currentDeadline) {
      silenceRestAlert();
      alertableDeadlineRef.current = null;
      expiryHandledRef.current = null;
      setTimerAnnouncement('');
    }
    if (nextDeadline && nextDeadline !== currentDeadline) {
      silenceRestAlert();
      alertableDeadlineRef.current = nextDeadline;
      expiryHandledRef.current = null;
      timerWasHiddenRef.current = false;
      setTimerAnnouncement('');
    }
  }

  function updateInput(changes: Partial<SetInput>) {
    setInput(current => {
      const next = {
        ...current,
        ...changes,
        ...(Object.hasOwn(changes, 'load') ? { loadSource: 'user' as const } : {})
      };
      setInputDraftsRef.current.set(currentInputKey, next);
      return next;
    });
  }

  function openTimerOptions() {
    setCustomRestMinutes(String(Math.floor(restTimer.durationSeconds / 60)));
    setCustomRestSeconds(String(restTimer.durationSeconds % 60));
    setTimerOptionsOpen(true);
  }

  function saveNotes() {
    const exerciseNotes = updateStrengthGuidedExerciseNotes(session, exercise.id, exerciseNotesDraft);
    if (!exerciseNotes.valid) {
      setError(exerciseNotes.error);
      return;
    }
    const workoutNotes = updateStrengthGuidedSession(exerciseNotes.session, { notes: workoutNotesDraft });
    if (!workoutNotes.valid) {
      setError(workoutNotes.error);
      return;
    }
    if (apply(workoutNotes.session)) setNotesOpen(false);
  }

  function startRestTimer() {
    const result = startStrengthSessionRestTimer(session, new Date().toISOString());
    if (!result.valid) setError(result.error);
    else {
      setTimerAnnouncement('');
      silenceRestAlert();
      apply(result.session);
    }
  }

  function activateRestTimer() {
    if (restTimer.status === 'running') {
      pauseRestTimer();
    } else if (restTimer.status === 'paused') {
      resumeRestTimer();
    } else if (restTimer.status === 'complete') {
      if (alertPlaying) {
        silenceRestAlert();
        setTimerAnnouncement('Rest complete. Alarm stopped.');
      }
    } else {
      startRestTimer();
    }
  }

  function pauseRestTimer() {
    const result = pauseStrengthSessionRestTimer(session, new Date().toISOString());
    if (!result.valid) setError(result.error);
    else {
      alertableDeadlineRef.current = null;
      apply(result.session);
    }
  }

  function resumeRestTimer() {
    const result = resumeStrengthSessionRestTimer(session, new Date().toISOString());
    if (!result.valid) setError(result.error);
    else apply(result.session);
  }

  function resetRestTimer() {
    const result = resetStrengthSessionRestTimer(session);
    if (!result.valid) setError(result.error);
    else {
      alertableDeadlineRef.current = null;
      expiryHandledRef.current = null;
      setTimerAnnouncement('');
      silenceRestAlert();
      apply(result.session);
    }
  }

  function moveToNextPending(next: StrengthGuidedSessionDraft) {
    const nextSet = selectNextStrengthSessionSet(next, exercise.id, set.id);
    if (!nextSet) return next;
    const nextIndex = next.exercises.findIndex(item => item.id === nextSet.exerciseId);
    const moved = moveStrengthSessionToSet(next, nextIndex, nextSet.setId);
    return moved.valid ? moved.session : next;
  }

  function confirmSet() {
    if (exercise.loadMeaning === undefined) {
      setError(LOAD_MEANING_ERROR);
      setExerciseMenuOpen(true);
      return;
    }
    const confirmedAt = new Date().toISOString();
    if (isTimedSet) {
      const providedSeconds = input.durationMinutes.trim() === '' && input.durationSeconds.trim() === ''
        ? null
        : Number(input.durationMinutes) * 60 + Number(input.durationSeconds);
      const elapsedSeconds = Math.floor(
        (timerMatchesCurrentSet
          ? selectStrengthExerciseTimerElapsedMilliseconds(exerciseTimer, confirmedAt) ?? 0
          : 0) / 1000
      );
      const actualDurationSeconds = providedSeconds ?? (elapsedSeconds > 0 ? elapsedSeconds : Number.NaN);
      if (!Number.isInteger(actualDurationSeconds) || actualDurationSeconds < 1 || actualDurationSeconds > 86_400) {
        setError('Enter an actual duration from 0:01 to 24:00:00, or run the exercise timer.');
        return;
      }
      const result = set.status === 'performed'
        ? correctStrengthSessionDuration(session, exercise.id, set.id, actualDurationSeconds)
        : confirmStrengthSessionDuration(session, exercise.id, set.id, actualDurationSeconds, confirmedAt);
      if (!result.valid) {
        setError(result.error);
        return;
      }
      apply(set.status === 'performed' ? result.session : moveToNextPending(result.session));
      return;
    }
    const reps = Number(input.reps);
    if (!Number.isInteger(reps) || reps < 1 || reps > 1000) {
      setError('Enter whole-number reps from 1 to 1,000.');
      return;
    }
    const load = readLoad(input, set.targetLoad, set.status === 'performed' ? set.actualLoad : undefined);
    if (load === null) {
      setError(INVALID_LOAD_ERROR);
      return;
    }
    const result = set.status === 'performed'
      ? correctStrengthSessionSet(session, exercise.id, set.id, reps, load ?? undefined)
      : confirmStrengthSessionSet(session, exercise.id, set.id, reps, confirmedAt, load ?? undefined);
    if (!result.valid) {
      setError(result.error);
      return;
    }
    apply(set.status === 'performed' ? result.session : moveToNextPending(result.session));
  }

  function startExerciseTiming() {
    const result = startStrengthExerciseTimer(session, new Date().toISOString());
    if (result.valid) apply(result.session);
    else setError(result.error);
  }

  function pauseExerciseTiming() {
    const result = pauseStrengthExerciseTimer(session, new Date().toISOString());
    if (result.valid) apply(result.session);
    else setError(result.error);
  }

  function resetExerciseTiming() {
    const result = resetStrengthExerciseTimer(session);
    if (result.valid) {
      updateInput({ durationMinutes: '', durationSeconds: '' });
      apply(result.session);
    } else setError(result.error);
  }

  function returnToTimedSet() {
    if (exerciseTimer.status === 'idle') return;
    const exerciseIndex = session.exercises.findIndex(item => item.id === exerciseTimer.exerciseId);
    const timedSet = session.exercises[exerciseIndex]?.sets.find(item => item.id === exerciseTimer.setId);
    if (exerciseIndex < 0 || !timedSet) return;
    selectSet(exerciseIndex, timedSet.id);
  }

  function skipSet() {
    const result = skipStrengthSessionSet(session, exercise.id, set.id);
    if (!result.valid) {
      setError(result.error);
      return;
    }
    apply(moveToNextPending(result.session));
  }

  function nextExercise() {
    if (session.currentExerciseIndex >= session.exercises.length - 1) return;
    const nextIndex = session.currentExerciseIndex + 1;
    const nextExercise = session.exercises[nextIndex]!;
    const target = nextExercise.sets.find(item => item.status === 'pending') ?? nextExercise.sets[0]!;
    const result = moveStrengthSessionToSet(session, nextIndex, target.id);
    if (result.valid) apply(result.session);
    else setError(result.error);
  }

  function addSet() {
    const last = exercise.sets.at(-1)!;
    const extra: StrengthPlannedSet = {
      id: `strength-session-set-${globalThis.crypto.randomUUID()}`,
      ...(last.measurement === undefined ? {} : { measurement: { ...last.measurement } }),
      ...(last.targetReps === undefined ? {} : { targetReps: last.targetReps }),
      ...(last.targetLoad === undefined ? {} : { targetLoad: { ...last.targetLoad } })
    };
    const result = addStrengthSessionSet(session, exercise.id, extra);
    if (result.valid) apply(result.session);
    else setError(result.error);
  }

  function adjustInput(field: 'load' | 'reps', direction: -1 | 1) {
    setInput(current => {
      const currentValue = Number(current[field]);
      const step = field === 'reps' ? 1 : 5;
      const minimum = field === 'reps' ? 1 : 0;
      const maximum = field === 'reps' ? 1000 : 10000;
      const value = Number.isFinite(currentValue) ? currentValue : minimum;
      const next = {
        ...current,
        [field]: String(Math.min(maximum, Math.max(minimum, value + direction * step))),
        ...(field === 'load' ? { loadSource: 'user' as const } : {})
      };
      setInputDraftsRef.current.set(currentInputKey, next);
      return next;
    });
  }

  function updateDateTime(date: string, time: string) {
    try {
      const startedAt = localDateTimeInZone(date, time, session.timeZone).toISOString();
      const result = updateStrengthGuidedSession(session, { date, startedAt });
      if (result.valid) apply(result.session);
      else setError(result.error);
    } catch {
      setError('That local workout time is unavailable in this time zone.');
    }
  }

  function finish() {
    if (!hasPerformedStrengthSessionSet(session)) {
      setError('Confirm at least one set before saving completed activity.');
      return;
    }
    const result = finishStrengthGuidedSession(
      session,
      `guided-workout-${session.id}`,
      new Date().toISOString()
    );
    if (!result.valid) {
      setError(result.error);
      return;
    }
    const saveError = onFinish(result.log);
    if (saveError) setError(saveError);
  }

  function selectSet(exerciseIndex: number, setId: string) {
    setInputDraftsRef.current.set(currentInputKey, input);
    const result = moveStrengthSessionToSet(session, exerciseIndex, setId);
    if (result.valid) {
      let nextSession = result.session;
      if (exerciseIndex !== session.currentExerciseIndex && restTimer.status === 'idle') {
        const selectedExercise = nextSession.exercises[exerciseIndex]!;
        const selectedSuperset = nextSession.supersetGroups?.find(group => group.exerciseIds.includes(selectedExercise.id));
        const durationSeconds = selectedSuperset?.restDurationSeconds ?? selectedExercise.restDurationSeconds;
        const changedRest = setStrengthSessionRestDuration(nextSession, durationSeconds);
        if (changedRest.valid) nextSession = changedRest.session;
      }
      setError('');
      const selectedExercise = nextSession.exercises[exerciseIndex]!;
      const selectedSet = selectedExercise.sets.find(item => item.id === setId)!;
      const selectedKey = sessionInputKey(selectedExercise.id, selectedSet.id);
      const selectedPrevious = selectPreviousStrengthSetValues(
        workouts, nextSession, selectedExercise.id, selectedExercise.sets.indexOf(selectedSet)
      );
      const carriedLoad = earlierPerformedLoad(nextSession, selectedExercise.id,
        selectedExercise.sets.indexOf(selectedSet), selectedExercise.loadMeaning, preferredWeightUnit);
      setInput(setInputDraftsRef.current.get(selectedKey)
        ?? createInput(selectedSet, selectedPrevious, preferredWeightUnit, selectedExercise.loadMeaning, carriedLoad));
      apply(nextSession);
    } else setError(result.error);
  }

  const currentLoad = set.status === 'performed' ? set.actualLoad : set.targetLoad;
  const loadInputLabel = isStrengthAddedLoadExercise(exercise) ? 'Added weight' : 'Weight';
  const exerciseExternalLoad = exercise.sets
    .map(item => item.targetLoad)
    .find((load): load is Extract<StrengthLoad, { kind: 'external' }> => load?.kind === 'external');
  const previousWorkout = previous?.workout;
  const previousWorkoutExercise = previousWorkout?.exercises?.find(item => item.id === exercise.id);
  const previousWorkoutSet = previousWorkoutExercise?.sets[setIndex];
  const previousPerformance = previousWorkoutSet?.status === 'performed'
    ? formatSet(previousWorkoutSet, preferredWeightUnit)
    : null;
  const superset = session.supersetGroups?.find(group => group.exerciseIds.includes(exercise.id));
  const supersetRoundCount = superset
    ? Math.max(...superset.exerciseIds.map(id => session.exercises.find(item => item.id === id)?.sets.length ?? 0))
    : 0;
  const nextExecution = selectNextStrengthSessionSet(session, exercise.id, set.id);
  const nextExecutionExercise = nextExecution
    ? session.exercises.find(item => item.id === nextExecution.exerciseId)
    : undefined;
  const exerciseElapsedSeconds = Math.floor(exerciseElapsedMilliseconds / 1000);
  const hasPendingSets = session.exercises.some(item => item.sets.some(itemSet => itemSet.status === 'pending'));
  const performedSetChanged = set.status === 'performed' && (isTimedSet
    ? Number(input.durationMinutes || 0) * 60 + Number(input.durationSeconds || 0) !== (set.actualDurationSeconds ?? 0)
    : Number(input.reps) !== (set.actualReps ?? 0)
      || !loadsEqual(readLoad(input, set.targetLoad, set.actualLoad), set.actualLoad));
  const canFinishFromEntry = set.status === 'performed' && !performedSetChanged && !hasPendingSets;
  const timedTargetReached = isTimedSet && exerciseElapsedMilliseconds >= targetDurationSeconds * 1000;
  const restTimerAction = restTimer.status === 'running'
    ? 'Pause rest timer'
    : restTimer.status === 'paused'
      ? 'Resume rest timer'
      : restTimer.status === 'complete' && alertPlaying
        ? 'Stop rest alarm'
        : 'Start rest timer';
  const finishReview = () => {
    setReviewing(true);
    setError('');
  };

  return (
    <>
      <MoneyGoalDialog
        title={reviewing ? 'Finish & review' : session.workoutName}
        intro={reviewing ? 'Review completed, skipped, and unfinished sets before saving.' : 'Guided workout'}
        labelledBy="strength-guided-session-title"
        titleId="strength-guided-session-title"
        closeLabel="Pause and close workout"
        bodyClassName="strength-dialog-body strength-guided"
        dialogClassName="strength-guided-dialog"
        onClose={onClose}
      >
      {reviewing ? (
        <div className="strength-guided__review">
          <label className="strength-form-field">Workout date
            <input type="date" value={session.date} onChange={event => updateDateTime(event.currentTarget.value, timeFields.time)} />
          </label>
          <label className="strength-form-field">Workout start time ({session.timeZone})
            <input type="time" value={timeFields.time} onChange={event => updateDateTime(session.date, event.currentTarget.value)} />
          </label>
          <section aria-labelledby="guided-review-summary">
            <h3 id="guided-review-summary">Session summary</h3>
            <p>{performedSetCount(session)} performed · {countStatus(session, 'skipped')} skipped · {countStatus(session, 'pending')} unfinished</p>
            <div className="strength-guided__participants" role="group" aria-label="Workout participants">
              <span>Participants:</span>
              {session.sharedWith.length
                ? session.sharedWith.map(id => {
                    const person = syntheticPeople.find(item => item.id === id);
                    return person ? <PersonBadge key={id} person={person} presentation="static" /> : null;
                  })
                : <span>None</span>}
            </div>
            {session.notes && <p>Workout notes: {session.notes}</p>}
          </section>
          <div className="strength-exercise-results-list">
            {session.exercises.map(item => {
              const group = session.supersetGroups?.find(candidate => candidate.exerciseIds.includes(item.id));
              const memberIndex = group?.exerciseIds.indexOf(item.id) ?? -1;
              const partner = group && memberIndex >= 0
                ? session.exercises.find(exercise => exercise.id === group.exerciseIds[1 - memberIndex])
                : undefined;
              return (
                <StrengthExerciseResults
                  key={item.id}
                  exercise={item}
                  workouts={workouts}
                  reference={session}
                  preferredWeightUnit={preferredWeightUnit}
                  presentation="review"
                  {...(group ? {
                    supersetContext: `Superset with ${partner?.name ?? 'exercise unavailable'} · Pair rest ${formatDuration(group.restDurationSeconds)}`
                  } : {})}
                />
              );
            })}
          </div>
          {error && <p className="strength-form-error" role="alert">{error}</p>}
          <div className="money-goal-dialog__actions">
            <button type="button" className="btn mini ghost" onClick={() => { setReviewing(false); setError(''); }}>Return to workout</button>
            <button type="button" className="btn mini" disabled={!hasPerformedStrengthSessionSet(session)} onClick={finish}>Finish & save</button>
          </div>
        </div>
      ) : (
        <div className="strength-guided__content">
          <div className="strength-guided__header-meta">
            <div className="strength-guided__date-summary">
              <p>{formatDate(session.date)} · {formatSessionTime(session)}</p>
              <button
                type="button"
                className="strength-guided__date-toggle"
                aria-controls="strength-guided-date-time-fields"
                aria-expanded={editingDateTime}
                onClick={() => setEditingDateTime(value => !value)}
              >
                {editingDateTime ? 'Done' : 'Edit date and time'}
              </button>
            </div>
            <div
              id="strength-guided-date-time-fields"
              className="strength-guided__metadata"
              hidden={!editingDateTime}
            >
              <label className="strength-form-field">Workout date
                <input type="date" value={session.date} onChange={event => updateDateTime(event.currentTarget.value, timeFields.time)} />
              </label>
              <label className="strength-form-field">Start time ({session.timeZone})
                <input type="time" value={timeFields.time} onChange={event => updateDateTime(session.date, event.currentTarget.value)} />
              </label>
              {previousWorkout && <p>Previous matching workout: {formatDate(previousWorkout.date)}</p>}
            </div>
          </div>
          <section className="strength-guided__exercise" aria-labelledby="strength-guided-exercise-heading">
            <div className="strength-guided__exercise-heading">
              <div>
                <h3 id="strength-guided-exercise-heading">{exercise.name}</h3>
                <p className="strength-guided__equipment">
                  {exercise.loadMeaning === 'bodyweight'
                    ? 'Bodyweight'
                    : `${exercise.equipment}${exercise.loadMeaning
                      ? ` · ${loadMeaningName(exercise.loadMeaning)} · ${exerciseExternalLoad?.unit ?? preferredWeightUnit}`
                      : ' · Load meaning not set'}`}
                </p>
              </div>
              <nav className="strength-guided__exercise-nav" aria-label="Workout exercises">
                <button
                  ref={exerciseMenuButtonRef}
                  type="button"
                  className="strength-guided__exercise-menu-trigger"
                  aria-haspopup="menu"
                  aria-expanded={exerciseMenuOpen}
                  onClick={() => setExerciseMenuOpen(true)}
                >
                  {session.currentExerciseIndex + 1} of {session.exercises.length}
                  <span aria-hidden="true">⌄</span>
                </button>
              </nav>
            </div>
            {exerciseMenuOpen && (
              <AnchoredPopover
                anchorRef={exerciseMenuButtonRef}
                label="Workout navigation"
                role="menu"
                className="strength-guided__exercise-menu"
                onClose={() => setExerciseMenuOpen(false)}
              >
                {session.exercises.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    aria-current={index === session.currentExerciseIndex ? 'true' : undefined}
                    onClick={() => {
                      const target = item.sets.find(candidate => candidate.status === 'pending') ?? item.sets[0]!;
                      selectSet(index, target.id);
                      setExerciseMenuOpen(false);
                    }}
                  >
                    <span>{item.name}</span>
                    {index === session.currentExerciseIndex && <span aria-hidden="true">✓</span>}
                  </button>
                ))}
                <div className="strength-guided__exercise-menu-separator" role="separator" />
                <button type="button" role="menuitem" onClick={() => {
                  setExerciseMenuOpen(false);
                  finishReview();
                }}>Finish &amp; review</button>
                <button type="button" role="menuitem" onClick={() => {
                  setExerciseMenuOpen(false);
                  setConfirmingDiscard(true);
                }} className="strength-guided__exercise-menu-destructive">Discard workout</button>
                <button type="button" role="menuitem" onClick={() => {
                  setExerciseMenuOpen(false);
                  if (exerciseMenuButtonRef.current) onEditExerciseDetails(exercise.id, exerciseMenuButtonRef.current);
                }}>Edit exercise details</button>
              </AnchoredPopover>
            )}
            {superset && (
              <p className="strength-guided__superset-context">
                Superset · Round {setIndex + 1} of {supersetRoundCount}
                {nextExecutionExercise && <span> · Next: {nextExecutionExercise.name}</span>}
              </p>
            )}
            <div className="strength-guided__set-strip" role="group" aria-label={`${exercise.name} set progress`}>
              {exercise.sets.map((item, index) => (
                <Fragment key={item.id}>
                  {index > 0 && <span className="strength-guided__set-connector" aria-hidden="true" />}
                  <button
                    type="button"
                    className={`strength-guided__set strength-guided__set--${item.status}`}
                    aria-label={`Set ${index + 1}, ${item.status}${item.status === 'performed' ? `, ${formatSet(item, preferredWeightUnit)}` : ''}`}
                    aria-current={item.id === session.currentSetId ? 'step' : undefined}
                    onClick={() => selectSet(session.currentExerciseIndex, item.id)}
                  >
                    <span aria-hidden="true">
                      {item.status === 'performed' ? '✓' : item.status === 'skipped' ? '×' : index + 1}
                    </span>
                  </button>
                </Fragment>
              ))}
            </div>
          </section>
          <section className="strength-rest-timer" aria-label="Rest timer">
            <div className={`strength-rest-timer__clock-wrap${restTimer.status === 'complete' && alertPlaying ? ' strength-rest-timer__clock-wrap--silence' : ''}`}>
              <button
                type="button"
                className="strength-rest-timer__clock-action"
                aria-label={restTimerAction}
                disabled={restTimer.status === 'idle' && restTimer.durationSeconds === 0}
                onClick={activateRestTimer}
              >
                <span className="strength-rest-timer__clock" role="timer" aria-label="Rest countdown">
                  {formatRestClock(remainingMilliseconds)}
                </span>
                <span className="strength-rest-timer__clock-status">
                  {restTimer.status === 'complete'
                    ? alertPlaying ? 'Tap to stop' : 'Rest complete'
                    : restTimer.status === 'running'
                      ? 'Resting · Tap to pause'
                      : restTimer.status === 'paused'
                        ? 'Paused · Tap to resume'
                        : restTimer.durationSeconds > 0
                          ? 'Tap to start'
                          : 'Choose a duration'}
                </span>
              </button>
              <button
                ref={timerOptionsButtonRef}
                type="button"
                className="strength-rest-timer__options-trigger"
                aria-label={`Rest duration ${formatRestClock(restTimer.durationSeconds * 1000)}; timer options`}
                aria-haspopup="dialog"
                aria-expanded={timerOptionsOpen}
                onClick={openTimerOptions}
              >Rest · {formatRestClock(restTimer.durationSeconds * 1000)} ⌄</button>
            </div>
            <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
              {[timerAnnouncement, soundMessage].filter(Boolean).join(' ')}
            </p>
          </section>
          {timerOptionsOpen && (
            <AnchoredPopover
              anchorRef={timerOptionsButtonRef}
              label="Rest timer options"
              className="strength-rest-timer__options"
              onClose={() => setTimerOptionsOpen(false)}
            >
              <div className="strength-rest-duration-picker__presets" role="group" aria-label="Rest duration presets">
                {[60, 90, 120, 150, 180].map(seconds => (
                  <button type="button" key={seconds} className="btn mini ghost"
                    aria-pressed={restTimer.durationSeconds === seconds}
                    onClick={() => { setRestDuration(seconds); setTimerOptionsOpen(false); }}>
                    {formatRestClock(seconds * 1000)}
                  </button>
                ))}
              </div>
              <section className="strength-rest-duration-picker__custom" aria-labelledby="strength-custom-rest-heading">
                <h3 id="strength-custom-rest-heading">Custom duration</h3>
                <div className="strength-rest-duration-picker__custom-fields">
                  <label className="strength-form-field">Minutes
                    <input type="number" inputMode="numeric" min="0" max="60" step="1"
                      value={customRestMinutes}
                      onChange={event => setCustomRestMinutes(event.currentTarget.value)} />
                  </label>
                  <label className="strength-form-field">Seconds
                    <input type="number" inputMode="numeric" min="0" max="59" step="1"
                      value={customRestSeconds}
                      onChange={event => setCustomRestSeconds(event.currentTarget.value)} />
                  </label>
                  <button type="button" className="btn mini"
                    disabled={!Number.isInteger(Number(customRestMinutes))
                      || Number(customRestMinutes) < 0 || Number(customRestMinutes) > 60
                      || !Number.isInteger(Number(customRestSeconds))
                      || Number(customRestSeconds) < 0 || Number(customRestSeconds) > 59
                      || Number(customRestMinutes) * 60 + Number(customRestSeconds) < 1
                      || Number(customRestMinutes) * 60 + Number(customRestSeconds) > 3600}
                    onClick={() => applyCustomRestDuration(
                      Number(customRestMinutes) * 60 + Number(customRestSeconds)
                    )}>Apply</button>
                </div>
              </section>
              <label className="strength-rest-timer__option">
                <input type="checkbox" checked={soundEnabled}
                  onChange={() => soundEnabled ? disableSound() : void enableSound()} />
                Sound
              </label>
              <label className="strength-rest-timer__option">
                <input type="checkbox" checked={session.autoStartRest === true}
                  onChange={event => {
                    const result = setStrengthSessionAutoStartRest(session, event.currentTarget.checked);
                    if (result.valid) apply(result.session);
                    else setError(result.error);
                  }} />
                Auto-start rest
              </label>
              <button type="button" className="strength-guided__reset-timer" onClick={() => {
                resetRestTimer();
                setTimerOptionsOpen(false);
              }}>Reset rest timer</button>
            </AnchoredPopover>
          )}
          <section className="strength-guided__entry" aria-label={`Set ${setIndex + 1} entry`}>
            <div className="strength-guided__performance-references">
              <div className="strength-guided__performance">
                <span>{lastSet?.exercise.id !== exercise.id && lastSet
                  ? `This workout · Last set · ${lastSet.exercise.name}`
                  : 'This workout · Last set'}</span>
                <strong className={lastSet ? undefined : 'strength-guided__previous-value--empty'}>
                  {lastSet ? formatSet(lastSet.set, preferredWeightUnit) : 'No previous set'}
                </strong>
              </div>
              <div className="strength-guided__performance">
                <div className="strength-guided__previous-meta">
                  <span>Last workout · Set {setIndex + 1}</span>
                  {previousPerformance && previousWorkout
                    && <time dateTime={previousWorkout.date}>{formatDate(previousWorkout.date)}</time>}
                </div>
                <strong className={previousPerformance ? undefined : 'strength-guided__previous-value--empty'}>
                  {previousPerformance ?? 'No previous performance'}
                </strong>
              </div>
            </div>
            {previous?.loadMeaningMismatch && (
              <p className="strength-guided__notice">Previous load meaning differs; not copied.</p>
            )}
            {set.status === 'skipped' && <p className="strength-guided__notice">This set was skipped. It will remain skipped in the workout record.</p>}
            {set.status !== 'skipped' && (
              isTimedSet ? (
                <section className="strength-guided__exercise-timer" aria-label="Timed exercise">
                  <p>Target · {formatDuration(targetDurationSeconds)}</p>
                  <strong role="timer" aria-label="Exercise elapsed time">{formatDuration(exerciseElapsedSeconds)}</strong>
                  <p>{!timerMatchesCurrentSet
                    ? `Timer continues for ${timerExercise?.name ?? 'another exercise'}${timerSetIndex >= 0 ? ` · Set ${timerSetIndex + 1}` : ''}.`
                    : timedTargetReached
                      ? 'Target reached · Log set when ready.'
                      : 'Exercise time · separate from rest'}</p>
                  <div className="strength-guided__timer-actions">
                    {exerciseTimer.status === 'running'
                      ? <button type="button" className="btn mini ghost" onClick={pauseExerciseTiming}>Pause</button>
                      : exerciseTimer.status === 'paused' && !timerMatchesCurrentSet
                        ? <button type="button" className="btn mini ghost" onClick={returnToTimedSet}>Return to timed set</button>
                        : <button type="button" className="btn mini ghost" onClick={startExerciseTiming}>
                          {exerciseTimer.status === 'paused' ? 'Resume' : 'Start'}
                        </button>}
                    <button type="button" className="btn mini ghost" onClick={resetExerciseTiming}>Reset</button>
                  </div>
                  <div className="strength-guided__duration-entry">
                    <label className="strength-form-field">Actual minutes
                      <input type="number" min="0" max="1440" step="1" inputMode="numeric"
                        value={input.durationMinutes}
                        onChange={event => {
                          const durationMinutes = event.currentTarget.value;
                          updateInput({ durationMinutes });
                        }} />
                    </label>
                    <label className="strength-form-field">Actual seconds
                      <input type="number" min="0" max="59" step="1" inputMode="numeric"
                        value={input.durationSeconds}
                        onChange={event => {
                          const durationSeconds = event.currentTarget.value;
                          updateInput({ durationSeconds });
                        }} />
                    </label>
                  </div>
                  <p className="strength-guided__timer-note">The target never confirms a set automatically. Logging records the actual duration.</p>
                </section>
              ) : (
                <>
                  <div className="strength-guided__inputs" role="group" aria-label="Current set values">
                    {exercise.loadMeaning === 'bodyweight' || currentLoad?.kind === 'bodyweight' || input.meaning === 'bodyweight' ? (
                      <div className="strength-guided__input-module strength-guided__input-module--bodyweight" role="group" aria-label="Bodyweight load">
                        <span className="strength-guided__input-label">Load</span>
                        <strong>Bodyweight</strong>
                      </div>
                    ) : (
                      <NumericControl
                        id="strength-guided-weight"
                        label={`${loadInputLabel} (${input.unit})`}
                        groupLabel={`${loadInputLabel} in ${input.unit}`}
                        value={input.load}
                        min={0}
                        max={10000}
                        step="any"
                        placeholder="—"
                        className="strength-guided__input-module"
                        {...(set.status === 'pending' && input.loadSource === 'carried'
                          ? { inputClassName: 'strength-guided__weight-input--carried' }
                          : {})}
                        stepperClassName="strength-guided__steppers"
                        decreaseLabel={`Decrease weight by 5 ${input.unit}`}
                        increaseLabel={`Increase weight by 5 ${input.unit}`}
                        onChange={load => updateInput({ load })}
                        onStep={direction => adjustInput('load', direction)}
                      />
                    )}
                    <NumericControl
                      id="strength-guided-reps"
                      label="Reps"
                      value={input.reps}
                      min={1}
                      max={1000}
                      step={1}
                      inputMode="numeric"
                      required
                      className="strength-guided__input-module"
                      stepperClassName="strength-guided__steppers"
                      decreaseLabel="Decrease reps by 1"
                      increaseLabel="Increase reps by 1"
                      groupLabel="Repetitions"
                      onChange={reps => updateInput({ reps })}
                      onStep={direction => adjustInput('reps', direction)}
                    />
                  </div>
                </>
              )
            )}
            {error && <p className="strength-form-error" role="alert">{error}</p>}
            <div className="strength-guided__actions">
              {set.status === 'pending' && (
                <button type="button" className="btn mini strength-guided__confirm" onClick={confirmSet}>
                  {`Log set ${setIndex + 1}`}
                </button>
              )}
              {set.status === 'performed' && performedSetChanged && (
                <button type="button" className="btn mini strength-guided__confirm" onClick={confirmSet}>
                  Save changes
                </button>
              )}
              {canFinishFromEntry && (
                <button type="button" className="btn mini strength-guided__confirm" onClick={finishReview}>
                  Finish &amp; review
                </button>
              )}
              <div className="strength-guided__secondary-actions">
                {set.status === 'pending' && <button type="button" className="btn mini ghost" onClick={skipSet}>Skip set</button>}
                {session.currentExerciseIndex < session.exercises.length - 1 && (
                  <div>
                    <button type="button" className="btn mini ghost" onClick={nextExercise}>Next exercise</button>
                    <p className="strength-guided__up-next">Up next · {session.exercises[session.currentExerciseIndex + 1]!.name}</p>
                  </div>
                )}
              </div>
              {setIndex === exercise.sets.length - 1 && (
                <button type="button" className="btn mini ghost strength-guided__add-set" onClick={addSet}>Add set</button>
              )}
            </div>
          </section>
          <div className="strength-guided__footer">
            <div className="strength-guided__footer-actions">
              <button ref={notesButtonRef} type="button" className="btn mini ghost strength-guided__notes-button"
                onClick={() => setNotesOpen(true)}>Notes</button>
            </div>
          </div>
          {confirmingDiscard && (
            <section className="strength-guided__discard" role="alertdialog" aria-labelledby="strength-guided-discard-title">
              <h3 id="strength-guided-discard-title">Discard this workout?</h3>
              <p>Only the in-progress draft will be removed. No completed activity has been saved.</p>
              <div className="money-goal-dialog__actions">
                <button type="button" className="btn mini danger" onClick={() => {
                  const discardError = onDiscard();
                  if (discardError) setError(discardError);
                }}>Discard workout</button>
                <button type="button" className="btn mini ghost" onClick={() => setConfirmingDiscard(false)}>Keep workout</button>
              </div>
            </section>
          )}
        </div>
      )}
      </MoneyGoalDialog>
      {notesOpen && (
        <MoneyGoalDialog
          title="Workout notes"
          labelledBy="strength-guided-notes-title"
          titleId="strength-guided-notes-title"
          closeLabel="Close workout notes"
          dialogClassName="strength-guided-notes-dialog"
          bodyClassName="strength-guided-notes"
          stopEscapePropagation
          closeOnEscape
          dismissOnBackdrop
          onClose={() => setNotesOpen(false)}
        >
          <label className="strength-form-field">Notes for {exercise.name}
            <textarea maxLength={1000} value={exerciseNotesDraft}
              onChange={event => setExerciseNotesDraft(event.currentTarget.value)} />
          </label>
          <label className="strength-form-field">Workout notes
            <textarea maxLength={1000} value={workoutNotesDraft}
              onChange={event => setWorkoutNotesDraft(event.currentTarget.value)} />
          </label>
          {error && <p className="strength-form-error" role="alert">{error}</p>}
          <div className="money-goal-dialog__actions">
            <button type="button" className="btn mini ghost" onClick={() => setNotesOpen(false)}>Cancel</button>
            <button type="button" className="btn mini" onClick={saveNotes}>Done</button>
          </div>
        </MoneyGoalDialog>
      )}
    </>
  );
}

function sessionInputKey(exerciseId: string, setId: string): string {
  return `${exerciseId}:${setId}`;
}

function earlierPerformedLoad(
  session: StrengthGuidedSessionDraft,
  exerciseId: string,
  beforeSetIndex: number,
  loadMeaning: StrengthLoadMeaning | undefined,
  preferredWeightUnit: 'lb' | 'kg'
): StrengthLoad | undefined {
  if (!loadMeaning || loadMeaning === 'bodyweight') return undefined;
  const exercise = session.exercises.find(item => item.id === exerciseId);
  let load: StrengthLoad | undefined;
  for (const item of exercise?.sets.slice(0, beforeSetIndex) ?? []) {
    if (item.status === 'performed') load = item.actualLoad;
  }
  if (load?.kind !== 'external' || load.meaning !== loadMeaning) return undefined;
  const converted = convertStrengthLoad(load, preferredWeightUnit);
  return converted.kind === 'external' ? converted : undefined;
}

function loadsEqual(left: StrengthLoad | null | undefined, right: StrengthLoad | null | undefined): boolean {
  if (!left || !right) return left === right;
  if (left.kind !== right.kind) return false;
  if (left.kind === 'bodyweight' || right.kind === 'bodyweight') return true;
  const convertedRight = convertStrengthLoad(right, left.unit);
  return convertedRight.kind === 'external'
    && left.meaning === convertedRight.meaning
    && left.value === convertedRight.value;
}

function createInput(
  set: StrengthGuidedSessionDraft['exercises'][number]['sets'][number],
  previous: ReturnType<typeof selectPreviousStrengthSetValues>,
  preferredWeightUnit: 'lb' | 'kg' = 'lb',
  loadMeaning?: StrengthLoadMeaning,
  earlierLoad?: StrengthLoad
): SetInput {
  const load = set.status === 'performed' ? set.actualLoad : undefined;
  const carriedLoad = load === undefined ? earlierLoad : undefined;
  const initialLoad = load ?? earlierLoad ?? previous?.load ?? set.targetLoad;
  const displayLoad = initialLoad?.kind === 'external'
    ? convertStrengthLoad(initialLoad, preferredWeightUnit)
    : initialLoad;
  const reps = set.status === 'performed' ? set.actualReps : previous?.reps ?? set.targetReps;
  const durationSeconds = set.status === 'performed' && set.actualDurationSeconds !== undefined
    ? set.actualDurationSeconds : 0;
  return {
    reps: reps === undefined ? '' : String(reps),
    durationMinutes: durationSeconds ? String(Math.floor(durationSeconds / 60)) : '',
    durationSeconds: durationSeconds ? String(durationSeconds % 60) : '',
    load: displayLoad?.kind === 'external' ? String(displayLoad.value) : '',
    meaning: displayLoad?.kind === 'external' ? displayLoad.meaning
      : displayLoad?.kind === 'bodyweight' ? 'bodyweight'
        : loadMeaning ?? '',
    unit: displayLoad?.kind === 'external' ? displayLoad.unit : preferredWeightUnit,
    loadSource: load !== undefined ? 'confirmed' : carriedLoad !== undefined ? 'carried' : 'fallback'
  };
}

function readLoad(input: SetInput, target?: StrengthLoad, actual?: StrengthLoad): StrengthLoad | null | undefined {
  const type = actual ?? target;
  if (type?.kind === 'bodyweight' || input.meaning === 'bodyweight') return { kind: 'bodyweight' };
  if (input.load.trim() === '') return undefined;
  if (!input.meaning) return null;
  const value = Number(input.load);
  if (input.load.trim() === '' || !Number.isFinite(value) || value < 0 || value > 10000) return null;
  if (input.meaning !== 'total' && input.meaning !== 'per-dumbbell' && input.meaning !== 'per-side') return null;
  return { kind: 'external', meaning: input.meaning, value, unit: input.unit };
}

function localSessionDateTime(session: StrengthGuidedSessionDraft): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: session.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(session.startedAt));
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    time: `${value('hour')}:${value('minute')}`
  };
}

function formatSessionTime(session: StrengthGuidedSessionDraft): string {
  const date = new Date(session.startedAt);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: session.timeZone
      }).format(date)
    : 'Time unavailable';
}

function formatLoad(load: StrengthLoad, preferredWeightUnit: 'lb' | 'kg' = 'lb'): string {
  if (load.kind === 'bodyweight') return 'Bodyweight';
  if (load.kind !== 'external') return 'Bodyweight';
  const displayLoad = load.unit === preferredWeightUnit ? load : convertStrengthLoad(load, preferredWeightUnit);
  if (displayLoad.kind !== 'external') return 'Bodyweight';
  return `${displayLoad.value} ${displayLoad.unit} ${loadMeaningName(displayLoad.meaning)}`;
}

function loadMeaningName(meaning: 'total' | 'per-dumbbell' | 'per-side'): string {
  return meaning === 'total' ? 'total' : meaning === 'per-dumbbell' ? 'per dumbbell' : 'per side';
}

function formatSet(
  set: StrengthGuidedSessionDraft['exercises'][number]['sets'][number],
  preferredWeightUnit: 'lb' | 'kg' = 'lb'
): string {
  if (set.measurement?.kind === 'duration') {
    if (set.status !== 'performed') return `${formatDuration(set.measurement.targetDurationSeconds)} planned`;
    return `${formatDuration(set.actualDurationSeconds ?? 0)} time`;
  }
  if (set.status !== 'performed') return set.targetReps === undefined ? 'Not performed' : `${set.targetReps} reps planned`;
  return `${set.actualLoad ? `${formatLoad(set.actualLoad, preferredWeightUnit)} × ` : ''}${set.actualReps ?? 'Reps unavailable'} reps`;
}

function performedSetCount(session: StrengthGuidedSessionDraft): number {
  return countStatus(session, 'performed');
}

function countStatus(session: StrengthGuidedSessionDraft, status: 'pending' | 'skipped' | 'performed'): number {
  return session.exercises.reduce((total, item) =>
    total + item.sets.filter(set => set.status === status).length, 0);
}

function formatDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
    : 'Date unavailable';
}

function restTimerMilliseconds(timer: StrengthSessionRestTimer, now = Date.now()): number {
  switch (timer.status) {
    case 'idle':
      return timer.durationSeconds * 1000;
    case 'running':
      return Math.max(0, Date.parse(timer.deadlineAt) - now);
    case 'paused':
      return timer.remainingMilliseconds;
    case 'complete':
      return 0;
  }
}

function formatRestClock(milliseconds: number): string {
  const totalSeconds = Math.ceil(Math.max(0, milliseconds) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const remainder = whole % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}
