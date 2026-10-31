import { useEffect, useRef, useState } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import {
  cardioDataIssues,
  cardioGoalSettings,
  cardioRhythmOccurrenceError,
  addDateDays,
  cardioTargetsForDate,
  cardioWeekStart,
  deleteCardioRun,
  isCardioRun,
  parseCardioGoalInput,
  saveCardioGoals,
  saveCardioRun,
  selectCardioProgress,
  stepCardioGoalInput,
  validatedCardioRuns,
  validateCardioGoals
} from '../domain/cardio.ts';
import type { CardioData, CardioRun } from '../domain/cardio.ts';
import type { RhythmPreview } from '../domain/preview-data.ts';
import type { DatedRhythmCompletion } from '../domain/rhythm-completion.ts';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { NumericControl } from './NumericControl.tsx';
import { FitnessScoreSummary } from './FitnessScoreSummary.tsx';

export type CardioViewProps = {
  data: CardioData;
  today: string;
  rhythms: readonly RhythmPreview[];
  archivedRhythmIds: ReadonlySet<string>;
  datedRhythmCompletions: readonly DatedRhythmCompletion[];
  onChange: (data: CardioData) => string | null;
  pendingLogRequest?: { requestId: number; opener: HTMLButtonElement; rhythm?: RhythmPreview } | null;
  onLogRequestOpened?: (requestId: number) => void;
  onLogRequestClosed?: () => void;
  onQuickLog?: (event: MouseEvent<HTMLButtonElement>) => void;
};

type DialogState = { kind: 'goals' } | { kind: 'run'; run?: CardioRun; rhythm?: RhythmPreview };

export function CardioView({
  data,
  today,
  rhythms,
  archivedRhythmIds,
  datedRhythmCompletions,
  onChange,
  pendingLogRequest = null,
  onLogRequestOpened,
  onLogRequestClosed
}: CardioViewProps) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [actionError, setActionError] = useState('');
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const handledLogRequestRef = useRef<number | null>(null);
  const activeLogRequestRef = useRef<number | null>(null);
  const progress = selectCardioProgress(data, today);
  const runs = validatedCardioRuns(data, today).records;
  const issues = [
    ...cardioDataIssues(data, today),
    ...cardioLinkIssues(data, rhythms, archivedRhythmIds, datedRhythmCompletions)
  ];

  useEffect(() => {
    if (!dialog && openerRef.current?.isConnected) openerRef.current.focus();
  }, [dialog]);

  useEffect(() => {
    if (!pendingLogRequest || handledLogRequestRef.current === pendingLogRequest.requestId) return;
    handledLogRequestRef.current = pendingLogRequest.requestId;
    activeLogRequestRef.current = pendingLogRequest.requestId;
    openerRef.current = pendingLogRequest.opener;
    setDialog({ kind: 'run', ...(pendingLogRequest.rhythm ? { rhythm: pendingLogRequest.rhythm } : {}) });
    onLogRequestOpened?.(pendingLogRequest.requestId);
  }, [pendingLogRequest?.requestId]);

  function openDialog(next: DialogState, event: MouseEvent<HTMLButtonElement>) {
    openerRef.current = event.currentTarget;
    setDialog(next);
  }

  function closeDialog() {
    setDialog(null);
    if (activeLogRequestRef.current !== null) {
      activeLogRequestRef.current = null;
      onLogRequestClosed?.();
    }
  }

  function removeRun(run: CardioRun) {
    const result = deleteCardioRun(data, run.id);
    if (!result.deleted) return;
    const error = onChange(result.data);
    if (error) {
      setActionError(error);
      return;
    }
    setActionError('');
  }

  return (
    <main className="category-page cardio-page" aria-labelledby="cardio-title">
      <header className="category-page-heading">
        <div>
          <h1 id="cardio-title">Cardio</h1>
          <p>Track weekly runs and mileage against the goals you set.</p>
        </div>
      </header>
      <section className="cardio-progress" aria-label="Weekly cardio and run history">
          <section className="card cardio-progress-card" aria-labelledby="cardio-progress-title">
            <header className="cardio-card-heading">
              <div>
                <h2 id="cardio-progress-title">Weekly cardio</h2>
                <p>{formatDate(progress.weekStart)} – {formatDate(progress.weekEnd)} · Monday–Sunday</p>
              </div>
              <button type="button" className="btn mini ghost"
                onClick={event => openDialog({ kind: 'goals' }, event)}>Edit goals</button>
            </header>
            {progress.targetRuns === null || progress.targetMiles === null ? (
              null
            ) : (
              <>
                <div className="cardio-measures">
                  <CardioMeasure label="Runs this week" value={progress.runs} target={progress.targetRuns}
                    percent={progress.runProgress ?? 0} remaining={`${progress.remainingRuns} remaining`} />
                  <CardioMeasure label="Miles this week" value={progress.miles} target={progress.targetMiles}
                    percent={progress.mileageProgress ?? 0}
                    remaining={`${formatNumber(progress.remainingMiles ?? 0)} mi remaining`} />
                </div>
              </>
            )}
            <FitnessScoreSummary
                category="Cardio"
                consistency={progress.consistency}
                onTrack={progress.score}
                health={progress.health}
                consistencyCaption="Four completed weeks of run and distance goals."
                onTrackCaption="This week’s goal progress."
                setupRequired={
                  !data.trackingStartDate
                  || !data.targetHistory?.length
                  || progress.targetRuns === null
                  || progress.targetMiles === null
                }
                statusMessage={progress.health === null
                  && Boolean(data.trackingStartDate && data.targetHistory?.length)
                  && progress.targetRuns !== null
                  && progress.targetMiles !== null
                  ? 'Your score will appear as tracking builds.'
                  : null}
                onSetup={event => openDialog({ kind: 'goals' }, event)}
                evidenceDetails={(
                  <>
                    {progress.eligibleConsistencyWeeks > 0 && (
                      <p>
                        {progress.eligibleConsistencyWeeks} completed week
                        {progress.eligibleConsistencyWeeks === 1 ? '' : 's'} have eligible targets.
                      </p>
                    )}
                    {progress.consistencyUnavailableReason && (
                      <p>
                        {progress.consistencyUnavailableReason.includes('tracking start')
                          ? 'Set a tracking start date and save weekly goals to begin.'
                          : 'No completed week in the four-week lookback has full tracking and trustworthy goals yet.'}
                      </p>
                    )}
                    <p>
                      Only complete Monday–Sunday weeks with known targets count. Goal changes
                      start the following Monday; first-time setup applies to this week’s progress,
                      but its partial week is excluded from Consistency. Unavailable recent weeks
                      are not replaced with older weeks.
                    </p>
                  </>
                )}
            />
            <div className="cardio-week-strip" role="group" aria-label="Run activity Monday through Sunday">
              {progress.days.map(day => (
                <div key={day.date} className={`cardio-week-day${day.count ? ' has-run' : ''}${day.date === today ? ' is-today' : ''}`}
                  aria-label={`${formatLongDate(day.date)}: ${day.count} ${day.count === 1 ? 'run' : 'runs'}, ${formatNumber(day.miles)} miles`}>
                  <span>{formatWeekday(day.date).slice(0, 1)}</span>
                  <i aria-hidden="true">{day.count ? '●' : ''}</i>
                  <small>{Number(day.date.slice(8, 10))}</small>
                  {day.date === today && <span className="cardio-week-day__today">Today</span>}
                </div>
              ))}
            </div>
          </section>
          <section className="card cardio-history-card" aria-labelledby="cardio-history-title">
            <header className="cardio-card-heading">
              <div><h2 id="cardio-history-title">Run history</h2><p>Runs are grouped by their activity date.</p></div>
              <button type="button" className="btn mini"
                onClick={event => openDialog({ kind: 'run' }, event)}>Log run</button>
            </header>
            {runs.length === 0 ? <p className="cardio-empty">No valid runs logged yet.</p> : (
              <ol className="cardio-history-list">
                {[...runs].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).map(run => (
                  <li key={run.id}>
                    <div>
                      <strong>{formatNumber(run.distance)} mi</strong>
                      <time dateTime={run.date}>{formatLongDate(run.date)}</time>
                      {run.notes && <p>{run.notes}</p>}
                      {run.rhythmId && <small>Linked to {rhythms.find(item => item.id === run.rhythmId)?.title ?? 'an unresolved Rhythm'}</small>}
                    </div>
                    <div className="cardio-history-actions">
                      <button type="button" className="btn mini ghost" aria-label={`Edit run from ${formatLongDate(run.date)}`}
                        onClick={event => openDialog({ kind: 'run', run }, event)}>Edit</button>
                      <button type="button" className="btn mini ghost" aria-label={`Delete run from ${formatLongDate(run.date)}`}
                        onClick={() => removeRun(run)}>Delete</button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {actionError && <p className="goal-field-error" role="alert">{actionError}</p>}
          </section>
      </section>
      {dialog?.kind === 'goals' && (
        <CardioGoalsDialog data={data} today={today} onSave={onChange} onClose={closeDialog} />
      )}
      {dialog?.kind === 'run' && (
        <CardioRunDialog
          key={dialog.run?.id ?? dialog.rhythm?.id ?? 'new-run'}
          data={data}
          today={today}
          rhythms={rhythms}
          archivedRhythmIds={archivedRhythmIds}
          {...(dialog.run ? { run: dialog.run } : {})}
          {...(dialog.rhythm ? { initialRhythm: dialog.rhythm } : {})}
          onSave={onChange}
          onClose={closeDialog}
        />
      )}
      {issues.length > 0 && (
        <section className="cardio-data-issues" role="status" aria-label="Cardio data quality">
          <h2>Some Cardio data needs review</h2>
          <ul>{issues.map((issue, index) => <li key={`${issue}-${index}`}>{issue}</li>)}</ul>
        </section>
      )}
    </main>
  );
}

function CardioMeasure({ label, value, target, percent, remaining }: {
  label: string;
  value: number;
  target: number;
  percent: number;
  remaining: string;
}) {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <div className="cardio-measure">
      <div className="cardio-measure__heading"><span>{label}</span>
        <strong>{formatNumber(value)} <small>/ {formatNumber(target)}</small></strong></div>
      <div className="cardio-measure__track" role="meter" aria-label={label}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={width}
        aria-valuetext={`${Math.round(width)}% of weekly goal`}>
        <span style={{ width: `${width}%` }} />
      </div>
      <div className="cardio-measure__footer"><span>{Math.round(width)}%</span><small>{remaining}</small></div>
    </div>
  );
}

function CardioGoalsDialog({ data, today, onSave, onClose }: {
  data: CardioData;
  today: string;
  onSave: (data: CardioData) => string | null;
  onClose: () => void;
}) {
  const history = data.targetHistory ?? [];
  const selectedHistory = [...history].filter(item => item.effectiveDate > today).at(-1)
    ?? [...history].filter(item => item.effectiveDate <= today).at(-1);
  const goals = data.trackingStartDate
    ? selectedHistory ? cardioGoalSettings(selectedHistory) : cardioTargetsForDate(data, today)
    : cardioGoalSettings(data.goals);
  const rawGoals = typeof data.goals === 'object' && data.goals !== null
    ? data.goals as Record<string, unknown> : {};
  const [runs, setRuns] = useState(goals ? String(goals.weeklyRunTarget)
    : selectedHistory || data.trackingStartDate || rawGoals.weeklyRunTarget == null ? '' : String(rawGoals.weeklyRunTarget));
  const [miles, setMiles] = useState(goals ? String(goals.weeklyMileTarget)
    : selectedHistory || data.trackingStartDate || rawGoals.weeklyMileTarget == null ? '' : String(rawGoals.weeklyMileTarget));
  const [trackingStartDate, setTrackingStartDate] = useState(data.trackingStartDate ?? today);
  const [errors, setErrors] = useState<{ runs: string | null; miles: string | null; form: string | null }>({
    runs: null, miles: null, form: null
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const runTarget = parseCardioGoalInput(runs);
    const mileTarget = parseCardioGoalInput(miles);
    const nextErrors: { runs: string | null; miles: string | null; form: string | null } = {
      runs: null, miles: null, form: null
    };
    if (runs.trim() && (!Number.isInteger(runTarget) || (runTarget ?? 0) < 1 || (runTarget ?? 0) > 21)) {
      nextErrors.runs = 'Enter 1 to 21 runs per week.';
    }
    if (miles.trim() && (!Number.isFinite(mileTarget) || (mileTarget ?? 0) < 0.1 || (mileTarget ?? 0) > 1000)) {
      nextErrors.miles = 'Enter a distance from 0.1 to 1,000 miles.';
    }
    const validation = validateCardioGoals({ weeklyRunTarget: runTarget, weeklyMileTarget: mileTarget });
    if (validation) {
      if (runTarget === null && mileTarget !== null) nextErrors.runs = 'Set both weekly targets, or leave both blank.';
      if (mileTarget === null && runTarget !== null) nextErrors.miles = 'Set both weekly targets, or leave both blank.';
      if (!nextErrors.runs && !nextErrors.miles) nextErrors.form = validation;
    }
    if (nextErrors.runs || nextErrors.miles || nextErrors.form) {
      setErrors(nextErrors);
      return;
    }
    if (!data.trackingStartDate && (!trackingStartDate || trackingStartDate > today)) {
      setErrors({ runs: null, miles: null, form: 'Choose a Cardio tracking start date that is today or earlier.' });
      return;
    }
    const writeError = onSave(saveCardioGoals(data, {
      weeklyRunTarget: runTarget,
      weeklyMileTarget: mileTarget
    }, today, trackingStartDate));
    if (writeError) setErrors({ runs: null, miles: null, form: writeError });
    else onClose();
  }

  return (
    <MoneyGoalDialog title="Cardio goals" labelledBy="cardio-goals-title" titleId="cardio-goals-title"
      initialFocusId="cardio-goal-runs" onClose={onClose} closeLabel="Close Cardio goals">
      <form className="cardio-form" noValidate onSubmit={submit}>
        <p>Both weekly targets are needed to calculate Cardio progress. Leave both blank to clear them.</p>
        {!data.trackingStartDate && (
          <label className="cardio-tracking-start">Start Cardio tracking on
            <input type="date" max={today} value={trackingStartDate}
              onChange={event => setTrackingStartDate(event.currentTarget.value)} />
          </label>
        )}
        <div className="cardio-goal-inputs">
          <div className="cardio-goal-field">
            <NumericControl
              id="cardio-goal-runs"
              label="Runs per week"
              value={runs}
              min={1}
              max={21}
              step={1}
              inputMode="numeric"
              invalid={Boolean(errors.runs)}
              {...(errors.runs ? { describedBy: 'cardio-goal-runs-error' } : {})}
              decreaseLabel="Decrease runs per week by 1"
              increaseLabel="Increase runs per week by 1"
              onChange={value => {
                setRuns(value);
                setErrors(current => ({ ...current, runs: null, form: null }));
              }}
              onStep={direction => setRuns(value => stepCardioGoalInput(value, direction, 'runs'))}
            />
            {errors.runs && <small id="cardio-goal-runs-error" className="numeric-control__error" role="alert">{errors.runs}</small>}
          </div>
          {data.trackingStartDate ? (
            <p className="cardio-goal-effective-date">
              Upcoming targets: {runTargetText(runs)} runs/week and {mileTargetText(miles)} miles/week,
              effective Monday {formatLongDate(addDateDays(cardioWeekStart(today), 7))}. Current targets stay active through Sunday.
            </p>
          ) : (
            <p className="cardio-goal-effective-date">
              Tracking starts {formatLongDate(trackingStartDate)}. These goals affect this week’s progress immediately; this partial setup week is excluded from Consistency.
            </p>
          )}
          <div className="cardio-goal-field">
            <NumericControl
              id="cardio-goal-miles"
              label="Miles per week"
              value={miles}
              min={0.1}
              max={1000}
              step={0.1}
              invalid={Boolean(errors.miles)}
              {...(errors.miles ? { describedBy: 'cardio-goal-miles-error' } : {})}
              decreaseLabel="Decrease miles per week by 0.1"
              increaseLabel="Increase miles per week by 0.1"
              onChange={value => {
                setMiles(value);
                setErrors(current => ({ ...current, miles: null, form: null }));
              }}
              onStep={direction => setMiles(value => stepCardioGoalInput(value, direction, 'miles'))}
            />
            {errors.miles && <small id="cardio-goal-miles-error" className="numeric-control__error" role="alert">{errors.miles}</small>}
          </div>
        </div>
        {errors.form && <p className="goal-field-error" role="alert">{errors.form}</p>}
        <div className="profile-editor-actions">
          <button type="submit" className="btn mini">Save goals</button>
          <button type="button" className="btn mini ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </MoneyGoalDialog>
  );
}

function CardioRunDialog({
  data,
  today,
  rhythms,
  archivedRhythmIds,
  run,
  initialRhythm,
  onSave,
  onClose
}: {
  data: CardioData;
  today: string;
  rhythms: readonly RhythmPreview[];
  archivedRhythmIds: ReadonlySet<string>;
  run?: CardioRun;
  initialRhythm?: RhythmPreview;
  onSave: (data: CardioData) => string | null;
  onClose: () => void;
}) {
  const [date, setDate] = useState(run?.date ?? today);
  const [distance, setDistance] = useState(run ? String(run.distance) : '');
  const [notes, setNotes] = useState(run?.notes ?? '');
  const [rhythmId, setRhythmId] = useState(run?.rhythmId ?? initialRhythm?.id ?? '');
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const eligible = rhythms.filter(rhythm => rhythm.healthLogCapability === 'cardio');
  const selectedRhythm = rhythms.find(rhythm => rhythm.id === rhythmId);
  const associationError = rhythmId
    ? cardioRhythmOccurrenceError(selectedRhythm, date, today, archivedRhythmIds)
    : null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const numericDistance = Number(distance);
    if (!Number.isFinite(numericDistance) || numericDistance <= 0) {
      setError('Enter a distance greater than zero.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) {
      setError('Choose a valid activity date that is today or earlier.');
      return;
    }
    if (notes.length > 1000) {
      setError('Notes must be 1,000 characters or fewer.');
      return;
    }
    if (rhythmId && associationError) {
      setError(associationError);
      return;
    }
    const id = run?.id ?? `cardio-${globalThis.crypto.randomUUID()}`;
    const previous = data.runs.find((item): item is CardioRun => isCardioRun(item) && item.id === id);
    const sameLink = previous !== undefined && previous.rhythmId === rhythmId;
    const saved = saveCardioRun(data, {
      id,
      date,
      distance: numericDistance,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(rhythmId ? {
        rhythmId,
        rhythmOccurrence: date,
        completionId: sameLink && previous.completionId
          ? previous.completionId : `cardio-completion-${globalThis.crypto.randomUUID()}`
      } : {})
    }, today);
    if (!saved.valid) {
      setError(saved.error);
      return;
    }
    submitting.current = true;
    const saveError = onSave(saved.data);
    if (saveError) {
      submitting.current = false;
      setError(saveError);
    } else onClose();
  }

  return (
    <MoneyGoalDialog title={run ? 'Edit run' : 'Log run'} labelledBy="cardio-run-title" titleId="cardio-run-title"
      initialFocusId="cardio-run-date" onClose={onClose} closeLabel="Close run">
      <form className="cardio-form" onSubmit={submit}>
        <label>Activity date
          <input id="cardio-run-date" type="date" max={today} value={date}
            onChange={event => setDate(event.currentTarget.value)} required />
        </label>
        <label>Distance (miles)
          <input type="number" min="0.01" step="0.01" value={distance}
            onChange={event => setDistance(event.currentTarget.value)} required />
        </label>
        <label>Notes (optional)
          <textarea rows={3} maxLength={1000} value={notes} onChange={event => setNotes(event.currentTarget.value)} />
        </label>
        <label>Cardio Rhythm (optional)
          <select value={rhythmId} onChange={event => setRhythmId(event.currentTarget.value)}>
            <option value="">No linked Rhythm</option>
            {eligible.map(rhythm => <option key={rhythm.id} value={rhythm.id}>{rhythm.title}</option>)}
            {rhythmId && !eligible.some(rhythm => rhythm.id === rhythmId)
              && <option value={rhythmId}>Unresolved linked Rhythm</option>}
          </select>
        </label>
        {associationError && <p className="cardio-form__notice" role="status">{associationError}</p>}
        {error && <p className="goal-field-error" role="alert">{error}</p>}
        <div className="profile-editor-actions">
          <button type="submit" className="btn mini">{run ? 'Save changes' : 'Save run'}</button>
          <button type="button" className="btn mini ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </MoneyGoalDialog>
  );
}

function cardioLinkIssues(
  data: CardioData,
  rhythms: readonly RhythmPreview[],
  archivedRhythmIds: ReadonlySet<string>,
  completions: readonly DatedRhythmCompletion[]
): string[] {
  const issues: string[] = [];
  for (const value of data.runs) {
    if (!isCardioRun(value) || !value.rhythmId || !value.completionId) continue;
    const rhythm = rhythms.find(item => item.id === value.rhythmId);
    const matching = completions.filter(item => item.id === value.completionId);
    if (matching.length !== 1 || matching[0]?.rhythmId !== value.rhythmId
      || matching[0]?.effectiveDate !== value.date) {
      issues.push(`Run ${value.id} has a missing or conflicting owned completion; it was preserved.`);
      continue;
    }
    const error = cardioRhythmOccurrenceError(rhythm, value.date, '9999-12-31', archivedRhythmIds);
    if (error) issues.push(`Run ${value.id} has an unresolved Cardio Rhythm association; it was preserved.`);
  }
  return [...new Set(issues)];
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function runTargetText(value: string): string {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) ? formatNumber(parsed) : '—';
}

function mileTargetText(value: string): string {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) ? formatNumber(parsed) : '—';
}

function formatDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatLongDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatWeekday(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' });
}
