import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, MouseEvent } from 'react';
import {
  cardioDataIssues,
  cardioGoalSettings,
  cardioRhythmOccurrenceError,
  deleteCardioRun,
  isCardioRun,
  saveCardioGoals,
  saveCardioRun,
  selectCardioProgress,
  validatedCardioRuns,
  validateCardioGoals
} from '../domain/cardio.ts';
import type { CardioData, CardioRun } from '../domain/cardio.ts';
import type { RhythmPreview } from '../domain/preview-data.ts';
import type { DatedRhythmCompletion } from '../domain/rhythm-completion.ts';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { RhythmCard, ScoreMeter } from './Cards.tsx';

export type CardioViewProps = {
  data: CardioData;
  today: string;
  rhythms: readonly RhythmPreview[];
  archivedRhythmIds: ReadonlySet<string>;
  completedRhythmIds: ReadonlySet<string>;
  datedRhythmCompletions: readonly DatedRhythmCompletion[];
  onChange: (data: CardioData) => string | null;
  onAddRhythm: (event: MouseEvent<HTMLButtonElement>) => void;
  onEditRhythm: (rhythm: RhythmPreview, event: MouseEvent<HTMLButtonElement>) => void;
  onOpenRhythm: (rhythm: RhythmPreview, event: MouseEvent<HTMLButtonElement>) => void;
};

type DialogState = { kind: 'goals' } | { kind: 'run'; run?: CardioRun; rhythm?: RhythmPreview };

export function CardioView({
  data,
  today,
  rhythms,
  archivedRhythmIds,
  completedRhythmIds,
  datedRhythmCompletions,
  onChange,
  onAddRhythm,
  onEditRhythm,
  onOpenRhythm
}: CardioViewProps) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [tab, setTab] = useState<'progress' | 'rhythms'>('progress');
  const [actionError, setActionError] = useState('');
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const progress = selectCardioProgress(data, today);
  const runs = validatedCardioRuns(data, today).records;
  const cardioRhythms = rhythms.filter(rhythm => rhythm.healthLogCapability === 'cardio');
  const issues = [
    ...cardioDataIssues(data, today),
    ...cardioLinkIssues(data, rhythms, archivedRhythmIds, datedRhythmCompletions)
  ];

  useEffect(() => {
    if (!dialog && openerRef.current?.isConnected) openerRef.current.focus();
  }, [dialog]);

  function openDialog(next: DialogState, event: MouseEvent<HTMLButtonElement>) {
    openerRef.current = event.currentTarget;
    setDialog(next);
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === 'ArrowRight' ? (index + 1) % 2
      : event.key === 'ArrowLeft' ? (index - 1 + 2) % 2
        : event.key === 'Home' ? 0
          : event.key === 'End' ? 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    setTab(next === 0 ? 'progress' : 'rhythms');
    tabRefs.current[next]?.focus();
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
      <div className="cardio-tabs" role="tablist" aria-label="Cardio views">
        <button ref={element => { tabRefs.current[0] = element; }} type="button" role="tab"
          id="cardio-tab-progress" aria-controls="cardio-panel-progress"
          aria-selected={tab === 'progress'} tabIndex={tab === 'progress' ? 0 : -1}
          onClick={() => setTab('progress')} onKeyDown={event => onTabKeyDown(event, 0)}>Progress</button>
        <button ref={element => { tabRefs.current[1] = element; }} type="button" role="tab"
          id="cardio-tab-rhythms" aria-controls="cardio-panel-rhythms"
          aria-selected={tab === 'rhythms'} tabIndex={tab === 'rhythms' ? 0 : -1}
          onClick={() => setTab('rhythms')} onKeyDown={event => onTabKeyDown(event, 1)}>Rhythms</button>
      </div>
      {tab === 'progress' ? (
        <section id="cardio-panel-progress" role="tabpanel" aria-labelledby="cardio-tab-progress">
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
              <p className="cardio-empty">Set both weekly run and mileage goals to track progress.</p>
            ) : (
              <>
                <div className="cardio-measures">
                  <CardioMeasure label="Runs this week" value={progress.runs} target={progress.targetRuns}
                    percent={progress.runProgress ?? 0} remaining={`${progress.remainingRuns} remaining`} />
                  <CardioMeasure label="Miles this week" value={progress.miles} target={progress.targetMiles}
                    percent={progress.mileageProgress ?? 0}
                    remaining={`${formatNumber(progress.remainingMiles ?? 0)} mi remaining`} />
                </div>
                <ScoreMeter label="Cardio score, lower of run and mileage goal progress"
                  score={progress.score} compact />
                <details className="cardio-calculation-info">
                  <summary>How weekly progress is calculated</summary>
                  <p>The week runs Monday through Sunday. Runs count on their activity dates. The Cardio score is the rounded lower percentage of run and mileage goals; each percentage caps at 100%, while recorded totals remain uncapped.</p>
                </details>
              </>
            )}
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
      ) : (
        <section id="cardio-panel-rhythms" role="tabpanel" aria-labelledby="cardio-tab-rhythms"
          className="card cardio-rhythms-card">
          <header className="cardio-card-heading">
            <div><h2>Cardio Rhythms</h2><p>Only Rhythms explicitly enabled for run logging appear here.</p></div>
            <button type="button" className="btn mini" onClick={onAddRhythm}>Add Cardio Rhythm</button>
          </header>
          {cardioRhythms.length > 0 ? (
            <div className="cardio-rhythm-list">
              {cardioRhythms.map(rhythm => (
                <div className="cardio-rhythm-entry" key={rhythm.id}>
                  <RhythmCard
                    variant="simple"
                    rhythm={rhythm}
                    completed={completedRhythmIds.has(rhythm.id)}
                    onDetails={event => onOpenRhythm(rhythm, event)}
                    onTend={event => openDialog({ kind: 'run', rhythm }, event)}
                    completionActionLabel="Log run"
                    completedActionLabel="Logged"
                  />
                  <button type="button" className="btn mini ghost" onClick={event => onEditRhythm(rhythm, event)}>
                    Edit Rhythm
                  </button>
                </div>
              ))}
            </div>
          ) : <p className="cardio-empty">No Rhythms are marked for run logging yet. Add one or edit a Health &amp; Fitness Rhythm.</p>}
        </section>
      )}
      {dialog?.kind === 'goals' && (
        <CardioGoalsDialog data={data} onSave={onChange} onClose={() => setDialog(null)} />
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
          onClose={() => setDialog(null)}
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

function CardioGoalsDialog({ data, onSave, onClose }: {
  data: CardioData;
  onSave: (data: CardioData) => string | null;
  onClose: () => void;
}) {
  const goals = cardioGoalSettings(data.goals);
  const rawGoals = typeof data.goals === 'object' && data.goals !== null
    ? data.goals as Record<string, unknown> : {};
  const [runs, setRuns] = useState(goals ? String(goals.weeklyRunTarget)
    : rawGoals.weeklyRunTarget == null ? '' : String(rawGoals.weeklyRunTarget));
  const [miles, setMiles] = useState(goals ? String(goals.weeklyMileTarget)
    : rawGoals.weeklyMileTarget == null ? '' : String(rawGoals.weeklyMileTarget));
  const [error, setError] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const runTarget = runs.trim() ? Number(runs) : null;
    const mileTarget = miles.trim() ? Number(miles) : null;
    if (runs.trim() && (!Number.isInteger(runTarget) || (runTarget ?? 0) > 21)
      || miles.trim() && (!Number.isFinite(mileTarget) || (mileTarget ?? 0) > 1000)) {
      setError('Enter a positive weekly target within the listed limits.');
      return;
    }
    const validation = validateCardioGoals({ weeklyRunTarget: runTarget, weeklyMileTarget: mileTarget });
    if (validation) {
      setError(validation);
      return;
    }
    const writeError = onSave(saveCardioGoals(data, {
      weeklyRunTarget: runTarget,
      weeklyMileTarget: mileTarget
    }));
    if (writeError) setError(writeError);
    else onClose();
  }

  return (
    <MoneyGoalDialog title="Cardio goals" labelledBy="cardio-goals-title" titleId="cardio-goals-title"
      initialFocusId="cardio-goal-runs" onClose={onClose} closeLabel="Close Cardio goals">
      <form className="cardio-form" onSubmit={submit}>
        <p>Both weekly targets are needed to calculate Cardio progress. Leave both blank to clear them.</p>
        <label>Runs per week
          <input id="cardio-goal-runs" type="number" min="1" max="21" step="1" value={runs}
            onChange={event => setRuns(event.currentTarget.value)} />
        </label>
        <label>Miles per week
          <input type="number" min="0.1" max="1000" step="0.1" value={miles}
            onChange={event => setMiles(event.currentTarget.value)} />
        </label>
        {error && <p className="goal-field-error" role="alert">{error}</p>}
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

function formatDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatLongDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatWeekday(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' });
}
