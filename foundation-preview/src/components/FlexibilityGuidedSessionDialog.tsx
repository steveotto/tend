import { Fragment, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AnchoredPopover } from './AnchoredPopover.tsx';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { SettingsGearButton } from './SettingsGearButton.tsx';
import { StyledSelect } from './StyledSelect.tsx';
import { localDateTimeInZone } from '../domain/rhythm-completion.ts';
import {
  addFlexibilityGuidedRound,
  advanceFlexibilityGuidedTimer,
  completeFlexibilityGuidedHold,
  pauseFlexibilityGuidedHold,
  resumeFlexibilityGuidedHold,
  restartFlexibilityGuidedHold,
  selectFlexibilityGuidedHold,
  skipFlexibilityGuidedHold,
  startFlexibilityGuidedHold
} from '../domain/flexibility.ts';
import type {
  FlexibilityData,
  FlexibilityGuidedHold,
  FlexibilityGuidedSessionDraft,
  FlexibilityGuidedTimer,
  FlexibilityTimerDirection
} from '../domain/flexibility.ts';

type Props = {
  session: FlexibilityGuidedSessionDraft;
  onChange: (session: FlexibilityGuidedSessionDraft, timerPreferences?: FlexibilityData['timerPreferences']) => string | null;
  onFinish: (session: FlexibilityGuidedSessionDraft) => string | null;
  onClose: () => void;
};

type TimerSettingsDraft = {
  holdSeconds: string;
  preparationSeconds: 0 | 3 | 5 | 10;
  timerDirection: FlexibilityTimerDirection;
  soundEnabled: boolean;
};

export function FlexibilityGuidedSessionDialog({ session, onChange, onFinish, onClose }: Props) {
  const [editingDateTime, setEditingDateTime] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmingEarlyEnd, setConfirmingEarlyEnd] = useState(false);
  const [actualSeconds, setActualSeconds] = useState('');
  const [error, setError] = useState('');
  const [clockNow, setClockNow] = useState(Date.now());
  const [settingsDraft, setSettingsDraft] = useState<TimerSettingsDraft>(() => settingsFor(session));
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const holdNavigationButtonRef = useRef<HTMLButtonElement>(null);
  const [holdNavigationOpen, setHoldNavigationOpen] = useState(false);
  const wasSettingsOpen = useRef(false);
  const hold = session.holds[session.currentHoldIndex]!;
  const stretchPositions = session.holds.filter((item, index, holds) =>
    holds.findIndex(candidate => candidate.stretchId === item.stretchId) === index);
  const stretchPosition = stretchPositions.findIndex(item => item.stretchId === hold.stretchId) + 1;
  const currentStretchHolds = session.holds.flatMap((item, index) =>
    item.stretchId === hold.stretchId ? [{ item, index }] : []);
  const hasMultipleStretchRounds = new Set(currentStretchHolds.map(({ item }) => item.round)).size > 1;
  const nextPendingIndex = nextPendingHoldIndex(session);
  const remainingPendingCount = session.holds.filter((item, index) =>
    index !== session.currentHoldIndex && item.status === 'pending').length;
  const timer = session.timer;
  const active = timer.phase === 'preparing' || timer.phase === 'holding';
  const targetReached = timer.phase === 'complete';
  const timerDirection = hold.timerDirection ?? session.timerDirection;
  const currentMilliseconds = timerMilliseconds(timer, hold, timerDirection, clockNow);
  const holdLabel = sideLabel(hold);
  const dateTime = sessionDateTime(session);
  const sameStretchNext = nextPendingIndex >= 0
    && session.holds[nextPendingIndex]!.stretchId === hold.stretchId;
  const allFinished = session.holds.every(item => item.status !== 'pending');

  useEffect(() => {
    const sync = () => {
      setClockNow(Date.now());
      const result = advanceFlexibilityGuidedTimer(session, new Date().toISOString());
      if (result.valid && result.changed) save(result.session);
    };
    sync();
    if (!active) return;
    const interval = window.setInterval(sync, 150);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, [session.timer.phase, session.timer.deadlineAt, active]);

  useEffect(() => {
    if (timer.phase !== 'complete' || !session.soundEnabled || !window.AudioContext) return;
    const context = new window.AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 660;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);
    oscillator.onended = () => { void context.close(); };
  }, [session.id, session.currentHoldIndex, session.soundEnabled, timer.phase]);

  useEffect(() => {
    if (settingsOpen) wasSettingsOpen.current = true;
    else if (wasSettingsOpen.current) {
      wasSettingsOpen.current = false;
      settingsButtonRef.current?.focus({ preventScroll: true });
    }
  }, [settingsOpen]);

  useEffect(() => {
    setSettingsDraft(settingsFor(session));
  }, [session.id, session.preparationSeconds, session.timerDirection, session.soundEnabled]);

  function save(next: FlexibilityGuidedSessionDraft, preferences?: FlexibilityData['timerPreferences']) {
    const message = onChange(next, preferences);
    setError(message ?? '');
    return !message;
  }

  function update(patch: Partial<FlexibilityGuidedSessionDraft>) {
    save({ ...session, ...patch });
  }

  function begin() {
    const advanced = advanceFlexibilityGuidedTimer(session, new Date().toISOString());
    const base = advanced.valid ? advanced.session : session;
    const result = startFlexibilityGuidedHold(base, new Date().toISOString());
    if (!result.valid) setError(result.error);
    else save(result.session);
  }

  function pauseOrResume() {
    const result = timer.phase === 'paused'
      ? resumeFlexibilityGuidedHold(session, new Date().toISOString())
      : pauseFlexibilityGuidedHold(session, new Date().toISOString());
    if (!result.valid) setError(result.error);
    else save(result.session);
  }

  function restart() {
    const result = restartFlexibilityGuidedHold(session);
    if (!result.valid) setError(result.error);
    else {
      setConfirmingEarlyEnd(false);
      setActualSeconds('');
      save(result.session);
    }
  }

  function completeCurrent(actual?: number) {
    const result = completeFlexibilityGuidedHold(session, new Date().toISOString(), actual);
    if (!result.valid) {
      setError(result.error);
      return;
    }
    const nextIndex = nextPendingHoldIndex(result.session);
    const next = nextIndex >= 0
      ? selectFlexibilityGuidedHold(result.session, nextIndex)
      : { valid: true as const, session: result.session };
    if (next.valid) {
      setConfirmingEarlyEnd(false);
      setActualSeconds('');
      save(next.session);
    }
  }

  function skipCurrent() {
    const skipped = skipFlexibilityGuidedHold(session);
    if (!skipped.valid) {
      setError(skipped.error);
      return;
    }
    const nextIndex = nextPendingHoldIndex(skipped.session);
    const next = nextIndex >= 0
      ? selectFlexibilityGuidedHold(skipped.session, nextIndex)
      : { valid: true as const, session: skipped.session };
    if (next.valid) save(next.session);
  }

  function changeHold(index: number) {
    const result = selectFlexibilityGuidedHold(session, index);
    if (!result.valid) setError(result.error);
    else save(result.session);
  }

  function addRound() {
    const result = addFlexibilityGuidedRound(session, hold.stretchId);
    if (!result.valid) setError(result.error);
    else save(result.session);
  }

  function openSettings() {
    setSettingsDraft(settingsFor(session));
    setSettingsOpen(true);
  }

  function applySettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const seconds = Number(settingsDraft.holdSeconds);
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 3600) {
      setError('Enter a hold duration from 1 to 3,600 seconds.');
      return;
    }
    const next = {
      ...session,
      preparationSeconds: settingsDraft.preparationSeconds,
      timerDirection: settingsDraft.timerDirection,
      soundEnabled: settingsDraft.soundEnabled
    };
    const upcoming = next.holds.findIndex((item, index) =>
      index >= session.currentHoldIndex && item.status === 'pending'
      && !(active && index === session.currentHoldIndex));
    if (upcoming >= 0) {
      next.holds = next.holds.map((item, index) =>
        index === upcoming ? {
          ...item,
          targetSeconds: seconds,
          preparationSeconds: settingsDraft.preparationSeconds,
          timerDirection: settingsDraft.timerDirection
        } : item);
    }
    const preferences = {
      holdSeconds: seconds,
      preparationSeconds: settingsDraft.preparationSeconds,
      timerDirection: settingsDraft.timerDirection,
      soundEnabled: settingsDraft.soundEnabled
    };
    if (save(next, preferences)) setSettingsOpen(false);
  }

  function finish() {
    const message = onFinish(session);
    setError(message ?? '');
  }

  return (
    <>
      <MoneyGoalDialog
        title={session.routineName}
        intro="Guided stretch session"
        labelledBy="flexibility-guided-title"
        titleId="flexibility-guided-title"
        closeLabel="Pause and close stretch session"
        bodyClassName="strength-dialog-body strength-guided flexibility-guided"
        dialogClassName="strength-guided-dialog flexibility-guided-dialog"
        phoneFullScreen
        onClose={onClose}
      >
        <div className="strength-guided__content">
          <div className="strength-guided__header-meta">
            <div className="strength-guided__date-summary">
              <p>{session.date} · {dateTime.time}</p>
              <button type="button" className="strength-guided__date-toggle"
                aria-controls="flexibility-guided-date-time-fields"
                aria-expanded={editingDateTime} onClick={() => setEditingDateTime(value => !value)}>
                {editingDateTime ? 'Done' : 'Edit date and time'}
              </button>
            </div>
            <div id="flexibility-guided-date-time-fields" className="strength-guided__metadata"
              hidden={!editingDateTime}>
              <label className="strength-form-field">Session date
                <input type="date" value={session.date}
                  onChange={event => {
                    const date = event.currentTarget.value;
                    update({
                      date,
                      ...(session.linkedRhythmId ? { rhythmOccurrence: date } : {})
                    });
                  }} />
              </label>
              <label className="strength-form-field">Start time
                <input type="time" value={dateTime.time}
                  onChange={event => update({
                    startedAt: sessionInstant(session.date, event.currentTarget.value, session.timeZone)
                  })} />
              </label>
            </div>
          </div>
          <label className="strength-form-field flexibility-guided__notes">
            Session notes (optional)
            <textarea rows={2} maxLength={1000} value={session.notes}
              onChange={event => update({ notes: event.currentTarget.value })} />
          </label>

          <section className="strength-guided__exercise" aria-labelledby="flexibility-current-stretch">
            <div className="strength-guided__exercise-heading">
              <div>
                <h3 id="flexibility-current-stretch">{hold.stretchName}</h3>
                <p className="strength-guided__side-indicator" aria-live="polite">{holdLabel}</p>
                <p className="strength-guided__equipment">
                  Targets {hold.regionIds.map(id => regionName(id)).join(', ')}
                </p>
              </div>
              <nav className="strength-guided__exercise-nav" aria-label="Stretch navigation">
                <button
                  ref={holdNavigationButtonRef}
                  type="button"
                  className="strength-guided__exercise-menu-trigger"
                  aria-haspopup="menu"
                  aria-expanded={holdNavigationOpen}
                  onClick={() => setHoldNavigationOpen(true)}
                >
                  {stretchPosition} of {stretchPositions.length}
                  <span aria-hidden="true">⌄</span>
                </button>
              </nav>
            </div>
            {holdNavigationOpen && (
              <AnchoredPopover
                anchorRef={holdNavigationButtonRef}
                label="Stretch navigation"
                role="menu"
                className="strength-guided__exercise-menu"
                onClose={() => setHoldNavigationOpen(false)}
              >
                {stretchPositions.map((item, position) => {
                  const pendingIndex = session.holds.findIndex(holdItem =>
                    holdItem.stretchId === item.stretchId && holdItem.status === 'pending');
                  const index = pendingIndex >= 0
                    ? pendingIndex
                    : session.holds.findIndex(holdItem => holdItem.stretchId === item.stretchId);
                  return (
                  <button
                    key={item.stretchId}
                    type="button"
                    role="menuitem"
                    aria-current={item.stretchId === hold.stretchId ? 'true' : undefined}
                    onClick={() => {
                      changeHold(index);
                      setHoldNavigationOpen(false);
                    }}
                  >
                    <span>{position + 1}. {item.stretchName}</span>
                    {item.stretchId === hold.stretchId && <span aria-hidden="true">✓</span>}
                  </button>
                  );
                })}
              </AnchoredPopover>
            )}
            <div className="flexibility-guided__controls">
              <label>Hold duration
                <input type="number" min="1" max="3600" step="1" inputMode="numeric"
                  aria-label="Hold duration in seconds" value={hold.targetSeconds}
                  disabled={active || hold.status !== 'pending'}
                  onChange={event => {
                    const targetSeconds = Number(event.currentTarget.value);
                    if (Number.isInteger(targetSeconds) && targetSeconds > 0 && targetSeconds <= 3600) {
                      update({ holds: session.holds.map((item, index) =>
                        index === session.currentHoldIndex ? { ...item, targetSeconds } : item) });
                    }
                  }} />
              </label>
              <label>Side
                <select aria-label="Stretch side" value={hold.side}
                  disabled={active || hold.status !== 'pending'}
                  onChange={event => {
                    const side = event.currentTarget.value as FlexibilityGuidedHold['side'];
                    update({ holds: session.holds.map((item, index) =>
                      index === session.currentHoldIndex ? { ...item, side } : item) });
                  }}>
                  <option value="left">Left</option><option value="right">Right</option><option value="both">Both</option>
                </select>
              </label>
            </div>
            <div className="strength-guided__set-strip flexibility-guided__rounds"
              role="group" aria-label={`${hold.stretchName} hold progress`}>
              {currentStretchHolds.map(({ item, index }, progressIndex) => (
                <Fragment key={item.id}>
                  {progressIndex > 0 && <span className="strength-guided__set-connector" aria-hidden="true" />}
                  <button type="button"
                    className={`strength-guided__set strength-guided__set--${item.status === 'completed' ? 'performed' : item.status}`}
                    aria-label={`${holdSideProgressLabel(item)}, ${item.status}${hasMultipleStretchRounds ? `, round ${item.round}` : ''}`}
                    aria-current={index === session.currentHoldIndex ? 'step' : undefined}
                    onClick={() => changeHold(index)}>
                    <span aria-hidden="true">
                      {item.status === 'completed' ? '✓'
                        : item.status === 'skipped' ? '×'
                          : holdProgressLabel(item, hasMultipleStretchRounds)}
                    </span>
                  </button>
                </Fragment>
              ))}
              <button type="button" className="strength-guided__set strength-guided__set--add"
                aria-label="Add round" onClick={addRound}><span aria-hidden="true">+</span></button>
            </div>
          </section>

          <section className="strength-rest-timer flexibility-guided__timer" aria-label="Stretch hold timer">
            <div className="strength-rest-timer__clock-wrap">
              <div className="strength-rest-timer__clock-action">
                <span className="strength-rest-timer__clock" role="timer" aria-live="off">
                  {formatClock(currentMilliseconds)}
                </span>
                <span className="strength-rest-timer__clock-status">
                  {timer.phase === 'preparing' ? 'Get ready'
                    : timer.phase === 'complete' ? 'Hold complete'
                      : timer.phase === 'paused' ? 'Paused'
                        : timer.phase === 'holding' ? 'Stretch hold in progress' : 'Ready when you are'}
                </span>
              </div>
              <SettingsGearButton
                label="Stretch timer settings"
                onClick={openSettings}
                buttonRef={settingsButtonRef}
              />
            </div>
            <p className="flexibility-guided__target">Hold duration · {formatClock(hold.targetSeconds * 1000)}</p>
            {session.routineSnapshot.stretches.find(stretch => stretch.id === hold.stretchId)?.instructions
              && <p className="flexibility-guided__instruction">
                {session.routineSnapshot.stretches.find(stretch => stretch.id === hold.stretchId)?.instructions}
              </p>}
            <div className="flexibility-guided__timer-actions">
              {timer.phase === 'idle' || timer.phase === 'complete'
                ? <button type="button" className="btn mini" onClick={begin}>Start stretch</button>
                : <button type="button" className="btn mini ghost" onClick={pauseOrResume}>
                  {timer.phase === 'paused' ? 'Resume' : 'Pause'}
                </button>}
              <button type="button" className="btn mini ghost" onClick={restart}>Restart</button>
            </div>
          </section>

          {confirmingEarlyEnd ? (
            <div className="flexibility-guided__early-confirm">
              <label>Actual held seconds
                <input type="number" min="1" max={hold.targetSeconds} step="1" inputMode="numeric"
                  value={actualSeconds} onChange={event => setActualSeconds(event.currentTarget.value)} />
              </label>
              <button type="button" className="btn mini" onClick={() => completeCurrent(Number(actualSeconds))}
                disabled={!actualSeconds}>Confirm actual hold</button>
              <button type="button" className="btn mini ghost" onClick={() => setConfirmingEarlyEnd(false)}>Cancel</button>
            </div>
          ) : (
            <div className="strength-guided__actions flexibility-guided__actions">
              {targetReached && hold.status === 'pending' && remainingPendingCount > 0 && (
                <button type="button" className="btn mini strength-guided__confirm"
                  onClick={() => completeCurrent()}>
                  {sameStretchNext ? 'Save hold & next side' : 'Save hold & next stretch'}
                </button>
              )}
              {targetReached && hold.status === 'pending' && remainingPendingCount === 0 && (
                <button type="button" className="btn mini strength-guided__confirm" onClick={() => completeCurrent()}>
                  Save final hold
                </button>
              )}
              {timer.phase === 'holding' && hold.status === 'pending' && (
                <button type="button" className="btn mini ghost" onClick={() => setConfirmingEarlyEnd(true)}>
                  End hold early…
                </button>
              )}
              {hold.status === 'pending' && (
                <button type="button" className="btn mini ghost" onClick={skipCurrent}>Skip hold</button>
              )}
              {allFinished && (
                <button type="button" className="btn mini strength-guided__confirm" onClick={finish}>Finish session</button>
              )}
            </div>
          )}
          {error && <p className="strength-form-error" role="alert">{error}</p>}
        </div>
      </MoneyGoalDialog>
      {settingsOpen && (
        <MoneyGoalDialog
          title="Stretch timer settings"
          labelledBy="flexibility-timer-settings-title"
          titleId="flexibility-timer-settings-title"
          initialFocusId="flexibility-timer-settings-title"
          closeLabel="Close stretch timer settings"
          closeOnEscape
          stopEscapePropagation
          dismissOnBackdrop
          portalToBody
          dialogClassName="money-goal-dialog--strength-rest-settings flexibility-timer-settings"
          anchorRef={settingsButtonRef}
          onClose={() => setSettingsOpen(false)}
        >
          <form className="strength-rest-settings__content flexibility-timer-settings__content" onSubmit={applySettings}>
            <section className="strength-rest-duration-picker__custom flexibility-timer-settings__duration"
              aria-labelledby="flexibility-hold-duration-heading">
              <h3 id="flexibility-hold-duration-heading">Hold duration</h3>
              <div className="strength-rest-duration-picker__presets" role="group" aria-label="Hold duration presets">
                {[15, 30, 45, 60].map(seconds => (
                  <button key={seconds} type="button"
                    className="btn mini ghost"
                    aria-pressed={Number(settingsDraft.holdSeconds) === seconds}
                    onClick={() => setSettingsDraft(current => ({ ...current, holdSeconds: String(seconds) }))}>
                    {seconds}s
                  </button>
                ))}
              </div>
              <label className="strength-form-field flexibility-timer-settings__custom-field">
                Custom duration (seconds)
                <input type="number" min="1" max="3600" step="1" inputMode="numeric"
                  value={settingsDraft.holdSeconds}
                  onChange={event => {
                    const holdSeconds = event.currentTarget.value;
                    setSettingsDraft(current => ({ ...current, holdSeconds }));
                  }} />
              </label>
            </section>
            <div className="flexibility-timer-settings__select">
              <span>Get-ready countdown</span>
              <StyledSelect
                label="Get-ready countdown"
                triggerAriaLabel="Get-ready countdown"
                value={String(settingsDraft.preparationSeconds)}
                options={[
                  { value: '0', label: 'Off' },
                  { value: '3', label: '3 seconds' },
                  { value: '5', label: '5 seconds' },
                  { value: '10', label: '10 seconds' }
                ]}
                onChange={value => {
                  const seconds = Number(value);
                  if (seconds === 0 || seconds === 3 || seconds === 5 || seconds === 10) {
                    setSettingsDraft(current => ({
                      ...current,
                      preparationSeconds: seconds
                    }));
                  }
                }}
              />
            </div>
            <fieldset className="flexibility-timer-settings__direction">
              <legend>Timer display</legend>
              <label><input type="radio" name="stretch-timer-direction" value="down"
                checked={settingsDraft.timerDirection === 'down'}
                onChange={() => setSettingsDraft(current => ({ ...current, timerDirection: 'down' }))} /> Count down</label>
              <label><input type="radio" name="stretch-timer-direction" value="up"
                checked={settingsDraft.timerDirection === 'up'}
                onChange={() => setSettingsDraft(current => ({ ...current, timerDirection: 'up' }))} /> Count up</label>
            </fieldset>
            <label className="strength-rest-timer__option"><input type="checkbox" checked={settingsDraft.soundEnabled}
              onChange={event => {
                const soundEnabled = event.currentTarget.checked;
                setSettingsDraft(current => ({ ...current, soundEnabled }));
              }} />
              Sound</label>
            {active && <p>Changes apply to the next hold; this timer stays unchanged.</p>}
            <div className="strength-rest-settings__actions">
              <button type="button" className="btn mini ghost flexibility-timer-settings__cancel"
                onClick={() => setSettingsOpen(false)}>Cancel</button>
              <button type="submit" className="btn mini strength-rest-settings__apply flexibility-timer-settings__apply">
                Apply
              </button>
            </div>
          </form>
        </MoneyGoalDialog>
      )}
    </>
  );
}

function settingsFor(session: FlexibilityGuidedSessionDraft): TimerSettingsDraft {
  const currentHold = session.holds[session.currentHoldIndex];
  return {
    holdSeconds: String(currentHold?.targetSeconds ?? 30),
    preparationSeconds: currentHold?.preparationSeconds ?? session.preparationSeconds,
    timerDirection: currentHold?.timerDirection ?? session.timerDirection,
    soundEnabled: session.soundEnabled
  };
}

function timerMilliseconds(timer: FlexibilityGuidedTimer, hold: FlexibilityGuidedHold,
  direction: FlexibilityTimerDirection, now: number): number {
  if (timer.phase === 'preparing' && timer.deadlineAt) return Math.max(0, Date.parse(timer.deadlineAt) - now);
  if (timer.phase === 'holding' && timer.deadlineAt && timer.holdStartedAt) {
    return direction === 'up'
      ? Math.min(hold.targetSeconds * 1000, Math.max(0, now - Date.parse(timer.holdStartedAt)))
      : Math.max(0, Date.parse(timer.deadlineAt) - now);
  }
  if (timer.phase === 'paused') {
    const remaining = timer.remainingMilliseconds ?? 0;
    return direction === 'up'
      ? Math.min(hold.targetSeconds * 1000, timer.elapsedBeforePauseMilliseconds ?? 0)
      : remaining;
  }
  return timer.phase === 'complete' ? hold.targetSeconds * 1000 : 0;
}

function formatClock(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function sideLabel(hold: FlexibilityGuidedHold): string {
  return hold.side === 'both' ? 'Both sides' : hold.side === 'left' ? 'Left side' : 'Right side';
}

function holdSideProgressLabel(hold: FlexibilityGuidedHold): string {
  return hold.side === 'both' ? 'Both sides hold' : `${hold.side === 'left' ? 'Left' : 'Right'} hold`;
}

function holdProgressLabel(hold: FlexibilityGuidedHold, multipleRounds: boolean): string {
  if (hold.side === 'both') return String(hold.round);
  const side = hold.side === 'left' ? 'L' : 'R';
  return multipleRounds && hold.round > 1 ? `${side}${hold.round}` : side;
}

function nextPendingHoldIndex(session: FlexibilityGuidedSessionDraft): number {
  const afterCurrent = session.holds.findIndex((item, index) =>
    index > session.currentHoldIndex && item.status === 'pending');
  return afterCurrent >= 0
    ? afterCurrent
    : session.holds.findIndex((item, index) =>
      index < session.currentHoldIndex && item.status === 'pending');
}

function regionName(id: string): string {
  return id === 'hip-flexors' ? 'Hip flexors' : id[0]!.toUpperCase() + id.slice(1);
}

function sessionDateTime(session: FlexibilityGuidedSessionDraft): { time: string } {
  const date = new Date(session.startedAt);
  if (Number.isNaN(date.getTime())) return { time: '—' };
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: session.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const hour = parts.find(part => part.type === 'hour')?.value ?? '—';
  const minute = parts.find(part => part.type === 'minute')?.value ?? '—';
  return { time: `${hour}:${minute}` };
}

function sessionInstant(date: string, time: string, timeZone: string): string {
  return localDateTimeInZone(date, time, timeZone).toISOString();
}
