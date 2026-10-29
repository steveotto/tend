import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, MouseEvent } from 'react';
import {
  deleteWeightMeasurement,
  formatWeight,
  isWeightMeasurement,
  poundsToKilograms,
  saveWeightGoals,
  saveWeightMeasurement,
  selectWeightProgress,
  validateCanonicalWeightGoals,
  validWeightMeasurements,
  weightDataIssues,
  weightGoalSettings,
  weightRhythmOccurrenceError,
  weightUnit,
  weightValueInUnit
} from '../domain/weight.ts';
import type { WeightData, WeightMeasurement, WeightUnit } from '../domain/weight.ts';
import type { RhythmPreview } from '../domain/preview-data.ts';
import type { DatedRhythmCompletion } from '../domain/rhythm-completion.ts';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { RhythmCard, ScoreMeter } from './Cards.tsx';

export type WeightViewProps = {
  data: WeightData;
  today: string;
  rhythms: readonly RhythmPreview[];
  archivedRhythmIds: ReadonlySet<string>;
  completedRhythmIds: ReadonlySet<string>;
  datedRhythmCompletions: readonly DatedRhythmCompletion[];
  onChange: (data: WeightData) => string | null;
  onAddRhythm: (event: MouseEvent<HTMLButtonElement>) => void;
  onEditRhythm: (rhythm: RhythmPreview, event: MouseEvent<HTMLButtonElement>) => void;
  onOpenRhythm: (rhythm: RhythmPreview, event: MouseEvent<HTMLButtonElement>) => void;
};

type DialogState = { kind: 'goals' } | { kind: 'weigh-in'; measurement?: WeightMeasurement; rhythm?: RhythmPreview };

export function WeightView({
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
}: WeightViewProps) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [tab, setTab] = useState<'progress' | 'rhythms'>('progress');
  const [actionError, setActionError] = useState('');
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const progress = selectWeightProgress(data, today);
  const measurements = validWeightMeasurements(data, today);
  const issues = [
    ...weightDataIssues(data, today),
    ...weightLinkIssues(data, rhythms, archivedRhythmIds, today, datedRhythmCompletions)
  ];
  const weightRhythms = rhythms.filter(rhythm => rhythm.healthLogCapability === 'weight');

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

  function removeMeasurement(measurement: WeightMeasurement) {
    const result = deleteWeightMeasurement(data, measurement.id);
    if (!result.deleted) return;
    const error = onChange(result.data);
    if (error) {
      setActionError(error);
      return;
    }
    setActionError('');
  }

  return (
    <main className="category-page weight-page" aria-labelledby="weight-title">
      <header className="category-page-heading">
        <div>
          <h1 id="weight-title">Weight</h1>
          <p>Recorded weigh-ins and a separate estimate along your goal path.</p>
        </div>
      </header>
      <div className="weight-tabs" role="tablist" aria-label="Weight views">
        <button ref={element => { tabRefs.current[0] = element; }} type="button" role="tab"
          id="weight-tab-progress" aria-controls="weight-panel-progress"
          aria-selected={tab === 'progress'} tabIndex={tab === 'progress' ? 0 : -1}
          onClick={() => setTab('progress')} onKeyDown={event => onTabKeyDown(event, 0)}>Progress</button>
        <button ref={element => { tabRefs.current[1] = element; }} type="button" role="tab"
          id="weight-tab-rhythms" aria-controls="weight-panel-rhythms"
          aria-selected={tab === 'rhythms'} tabIndex={tab === 'rhythms' ? 0 : -1}
          onClick={() => setTab('rhythms')} onKeyDown={event => onTabKeyDown(event, 1)}>Rhythms</button>
      </div>
      {tab === 'progress' ? (
        <section id="weight-panel-progress" role="tabpanel" aria-labelledby="weight-tab-progress">
          <section className="card weight-progress-card" aria-labelledby="weight-progress-heading">
            <header className="weight-card-heading">
              <div><h2 id="weight-progress-heading">Body weight progress</h2>
                <p>{progress.latest
                  ? `Latest recorded measurement · ${formatDate(progress.latest.date)}`
                  : 'No valid weigh-in recorded yet.'}</p>
              </div>
              <button type="button" className="btn mini ghost"
                onClick={event => openDialog({ kind: 'goals' }, event)}>Edit goals</button>
            </header>
            {progress.latest && (
              <div className="weight-latest-record" aria-label="Latest recorded measurement">
                <span>Latest recorded</span>
                <strong>{formatWeight(progress.latest.weightKg, weightUnit(data.displayUnit))} {weightUnit(data.displayUnit)}</strong>
                <time dateTime={progress.latest.date}>{formatDate(progress.latest.date)}</time>
              </div>
            )}
            {progress.latest && (progress.latestAge ?? 0) > 0 && (
              <p className="weight-stale-notice">
                The estimate below uses the {formatDate(progress.latest.date)} measurement; it is not a measurement of today’s weight.
              </p>
            )}
            <div className="weight-metrics">
              <div><span>Expected today</span>
                <strong>{progress.expectedWeightKg === null ? '—' : `${formatWeight(progress.expectedWeightKg, weightUnit(data.displayUnit))} ${weightUnit(data.displayUnit)}`}</strong>
                <small>{progress.latest ? 'Goal-path estimate' : progress.status}</small>
              </div>
              <div><span>Progress score</span>
                <strong>{progress.score === null ? '—' : `${Math.round(progress.score)} / 100`}</strong>
                <small>{progress.goalStatus ?? progress.status}</small>
              </div>
              <div><span>Goal weight</span>
                <strong>{weightGoalSettings(data.goals)
                  ? `${formatWeight(weightGoalSettings(data.goals)!.targetWeightKg, weightUnit(data.displayUnit))} ${weightUnit(data.displayUnit)}`
                  : '—'}</strong>
                <small>{weightGoalSettings(data.goals)?.goalDate
                  ? `By ${formatDate(weightGoalSettings(data.goals)!.goalDate)}`
                  : 'Set a complete goal'}</small>
              </div>
            </div>
            <ScoreMeter label="Weight progress score, separate from category and Foundation scores"
              score={progress.score} compact />
            <WeightChart
              data={data}
              today={today}
              measurements={measurements.records}
              expectedWeightKg={progress.expectedWeightKg}
            />
            <details className="weight-calculation-info">
              <summary>How the estimate is calculated</summary>
              <p>The estimate follows a straight goal path between the dates you set. Progress compares that estimate with your latest valid recorded measurement. The score is unavailable without a complete goal and a valid measurement, and is reduced by five points per day behind, down to zero.</p>
            </details>
          </section>
          <section className="card weight-history-card" aria-labelledby="weight-history-heading">
            <header className="weight-card-heading">
              <div><h2 id="weight-history-heading">Weigh-in history</h2>
                <p>Measurements are stored independently from workout templates.</p>
              </div>
              <button type="button" className="btn mini"
                onClick={event => openDialog({ kind: 'weigh-in' }, event)}>Add weigh-in</button>
            </header>
            {measurements.records.length === 0
              ? <p className="weight-empty">No valid weigh-ins to show.</p>
              : <ol className="weight-history-list">
                {[...measurements.records].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).map(measurement => (
                  <li key={measurement.id}>
                    <div><strong>{formatWeight(measurement.weightKg, weightUnit(data.displayUnit))} {weightUnit(data.displayUnit)}</strong>
                      <time dateTime={measurement.date}>{formatDate(measurement.date)}</time>
                      {measurement.notes && <p>{measurement.notes}</p>}
                      {measurement.rhythmId && <small>Linked to {rhythms.find(item => item.id === measurement.rhythmId)?.title ?? 'an unresolved Rhythm'}</small>}
                    </div>
                    <div className="weight-history-actions">
                      <button type="button" className="btn mini ghost" aria-label={`Edit weigh-in from ${formatDate(measurement.date)}`}
                        onClick={event => openDialog({ kind: 'weigh-in', measurement }, event)}>Edit</button>
                      <button type="button" className="btn mini ghost" aria-label={`Delete weigh-in from ${formatDate(measurement.date)}`}
                        onClick={() => removeMeasurement(measurement)}>Delete</button>
                    </div>
                  </li>
                ))}
              </ol>}
            {actionError && <p className="goal-field-error" role="alert">{actionError}</p>}
          </section>
          <button type="button" className="money-goals-back" onClick={event => openDialog({ kind: 'weigh-in' }, event)}>
            Add weigh-in
          </button>
        </section>
      ) : (
        <section id="weight-panel-rhythms" role="tabpanel" aria-labelledby="weight-tab-rhythms"
          className="card weight-rhythms-card">
          <header className="weight-card-heading">
            <div><h2>Weight Rhythms</h2><p>Only Rhythms explicitly enabled for weigh-in logging appear here.</p></div>
            <button type="button" className="btn mini" onClick={onAddRhythm}>Add Weight Rhythm</button>
          </header>
          {weightRhythms.length > 0 ? (
            <div className="weight-rhythm-list">
              {weightRhythms.map(rhythm => (
                <div className="weight-rhythm-entry" key={rhythm.id}>
                  <RhythmCard
                    variant="simple"
                    rhythm={rhythm}
                    completed={completedRhythmIds.has(rhythm.id)}
                    onDetails={event => onOpenRhythm(rhythm, event)}
                    onTend={event => openDialog({ kind: 'weigh-in', rhythm }, event)}
                    completionActionLabel="Log weigh-in"
                    completedActionLabel="Logged"
                  />
                  <button type="button" className="btn mini ghost" onClick={event => onEditRhythm(rhythm, event)}>
                    Edit Rhythm
                  </button>
                </div>
              ))}
            </div>
          ) : <p className="weight-empty">No Rhythms are marked for weigh-in logging yet. Add one or edit a Health &amp; Fitness Rhythm.</p>}
        </section>
      )}
      {issues.length > 0 && (
        <section className="weight-data-issues" role="status" aria-label="Weight data quality">
          <h2>Some Weight data needs review</h2>
          <ul>{issues.map((issue, index) => <li key={`${issue}-${index}`}>{issue}</li>)}</ul>
        </section>
      )}
      {dialog?.kind === 'goals' && (
        <WeightGoalsDialog
          key="weight-goals"
          data={data}
          onSave={onChange}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'weigh-in' && (
        <WeightLogDialog
          key={dialog.measurement?.id ?? dialog.rhythm?.id ?? 'new-weigh-in'}
          data={data}
          today={today}
          rhythms={rhythms}
          archivedRhythmIds={archivedRhythmIds}
          {...(dialog.measurement ? { measurement: dialog.measurement } : {})}
          {...(dialog.rhythm ? { initialRhythm: dialog.rhythm } : {})}
          onSave={onChange}
          onClose={() => setDialog(null)}
        />
      )}
    </main>
  );
}

function WeightGoalsDialog({
  data,
  onSave,
  onClose
}: {
  data: WeightData;
  onSave: (data: WeightData) => string | null;
  onClose: () => void;
}) {
  const current = weightGoalSettings(data.goals);
  const [unit, setUnit] = useState<WeightUnit>(weightUnit(data.displayUnit));
  const [startKg, setStartKg] = useState<number | null>(current?.startWeightKg ?? null);
  const [startDate, setStartDate] = useState(current?.startDate ?? '');
  const [targetKg, setTargetKg] = useState<number | null>(current?.targetWeightKg ?? null);
  const [goalDate, setGoalDate] = useState(current?.goalDate ?? '');
  const [error, setError] = useState('');
  const malformed = weightDataIssues(data, '9999-12-31').some(issue => issue.includes('goal settings'));

  function inputValue(value: number | null): string {
    return value === null ? '' : weightValueInUnit(value, unit).toFixed(2);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const goalError = validateCanonicalWeightGoals({ startWeightKg: startKg, startDate, targetWeightKg: targetKg, goalDate });
    if (goalError) {
      setError(goalError);
      return;
    }
    const anyValue = startKg !== null || targetKg !== null || startDate !== '' || goalDate !== '';
    if (anyValue && (weightValueInUnit(startKg!, unit) > 2000 || weightValueInUnit(targetKg!, unit) > 2000)) {
      setError('Weights must be 2,000 or less in the selected unit.');
      return;
    }
    const goals = anyValue
      ? { startWeightKg: startKg, startDate, targetWeightKg: targetKg, goalDate }
      : { startWeightKg: null, startDate: '', targetWeightKg: null, goalDate: '' };
    const writeError = onSave(saveWeightGoals(data, goals, unit));
    if (writeError) setError(writeError);
    else onClose();
  }

  return (
    <MoneyGoalDialog title="Weight goals" labelledBy="weight-goals-title" titleId="weight-goals-title"
      initialFocusId="weight-goal-start" onClose={onClose} closeLabel="Close Weight goals">
      <form className="weight-form" onSubmit={submit}>
        {malformed && (
          <p className="weight-form__notice" role="status">
            Saved goal values are invalid and remain preserved until you replace or clear them.
          </p>
        )}
        <label>Weight unit
          <select value={unit} onChange={event => setUnit(event.currentTarget.value as WeightUnit)}>
            <option value="lb">Pounds (lb)</option>
            <option value="kg">Kilograms (kg)</option>
          </select>
        </label>
        <div className="weight-form__grid">
          <label>Starting weight ({unit})
            <input id="weight-goal-start" type="number" min="0.1" max="2000" step="0.01"
              value={inputValue(startKg)}
              onChange={event => setStartKg(event.currentTarget.value === '' ? null
                : unit === 'lb' ? poundsToKilograms(Number(event.currentTarget.value)) : Number(event.currentTarget.value))} />
          </label>
          <label>Starting date
            <input type="date" value={startDate} onChange={event => setStartDate(event.currentTarget.value)} />
          </label>
          <label>Target weight ({unit})
            <input type="number" min="0.1" max="2000" step="0.01"
              value={inputValue(targetKg)}
              onChange={event => setTargetKg(event.currentTarget.value === '' ? null
                : unit === 'lb' ? poundsToKilograms(Number(event.currentTarget.value)) : Number(event.currentTarget.value))} />
          </label>
          <label>Goal date
            <input type="date" value={goalDate} onChange={event => setGoalDate(event.currentTarget.value)} />
          </label>
        </div>
        {malformed && (
          <button type="button" className="btn mini ghost" onClick={() => {
            setStartKg(null); setStartDate(''); setTargetKg(null); setGoalDate('');
            setError('Invalid saved goal values will be cleared when you save.');
          }}>Clear invalid saved goals</button>
        )}
        {error && <p className="goal-field-error" role="alert">{error}</p>}
        <div className="profile-editor-actions">
          <button type="submit" className="btn mini">Save goals</button>
          <button type="button" className="btn mini ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </MoneyGoalDialog>
  );
}

function WeightLogDialog({
  data,
  today,
  rhythms,
  archivedRhythmIds,
  measurement,
  initialRhythm,
  onSave,
  onClose
}: {
  data: WeightData;
  today: string;
  rhythms: readonly RhythmPreview[];
  archivedRhythmIds: ReadonlySet<string>;
  measurement?: WeightMeasurement;
  initialRhythm?: RhythmPreview;
  onSave: (data: WeightData) => string | null;
  onClose: () => void;
}) {
  const [unit, setUnit] = useState<WeightUnit>(weightUnit(data.displayUnit));
  const [weightKg, setWeightKg] = useState<number | null>(measurement?.weightKg ?? null);
  const [date, setDate] = useState(measurement?.date ?? today);
  const [notes, setNotes] = useState(measurement?.notes ?? '');
  const [rhythmId, setRhythmId] = useState(measurement?.rhythmId ?? initialRhythm?.id ?? '');
  const [error, setError] = useState('');
  const eligibleRhythms = rhythms.filter(rhythm => rhythm.healthLogCapability === 'weight');
  const selectedRhythm = rhythms.find(rhythm => rhythm.id === rhythmId);
  const associationError = rhythmId
    ? weightRhythmOccurrenceError(selectedRhythm, date, today, archivedRhythmIds)
    : null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (weightKg === null || !Number.isFinite(weightKg) || weightKg <= 0 || weightValueInUnit(weightKg, unit) > 2000) {
      setError('Enter a positive weight within the listed limit.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) {
      setError('Choose a valid date that is not in the future.');
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
    const id = measurement?.id ?? `weight-${globalThis.crypto.randomUUID()}`;
    const previous = data.weighIns.find((item): item is WeightMeasurement =>
      isWeightMeasurement(item) && item.id === id
    );
    const sameLink = previous !== undefined && previous.rhythmId === rhythmId;
    const record: WeightMeasurement = {
      id, date, weightKg, ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(rhythmId ? {
        rhythmId,
        rhythmOccurrence: date,
        completionId: sameLink && previous.completionId
          ? previous.completionId
          : `weight-completion-${globalThis.crypto.randomUUID()}`
      } : {})
    };
    const saved = saveWeightMeasurement({ ...data, displayUnit: unit }, record, today);
    if (!saved.valid) {
      setError(saved.error);
      return;
    }
    const saveError = onSave(saved.data);
    if (saveError) setError(saveError);
    else onClose();
  }

  return (
    <MoneyGoalDialog title={measurement ? 'Edit weigh-in' : 'Add weigh-in'}
      labelledBy="weight-entry-title" titleId="weight-entry-title"
      initialFocusId="weight-entry-date" onClose={onClose} closeLabel="Close weigh-in">
      <form className="weight-form" onSubmit={submit}>
        <label>Date
          <input id="weight-entry-date" type="date" max={today} value={date}
            onChange={event => setDate(event.currentTarget.value)} required />
        </label>
        <label>Weight unit
          <select value={unit} onChange={event => setUnit(event.currentTarget.value as WeightUnit)}>
            <option value="lb">Pounds (lb)</option>
            <option value="kg">Kilograms (kg)</option>
          </select>
        </label>
        <label>Weight ({unit})
          <input type="number" min="0.1" max="2000" step="0.01" value={
            weightKg === null ? '' : weightValueInUnit(weightKg, unit).toFixed(2)
          } onChange={event => setWeightKg(event.currentTarget.value === '' ? null
            : unit === 'lb' ? poundsToKilograms(Number(event.currentTarget.value)) : Number(event.currentTarget.value))}
          required />
        </label>
        <label>Notes (optional)
          <textarea rows={3} maxLength={1000} value={notes} onChange={event => setNotes(event.currentTarget.value)} />
        </label>
        <label>Weight Rhythm (optional)
          <select value={rhythmId} onChange={event => setRhythmId(event.currentTarget.value)}>
            <option value="">No linked Rhythm</option>
            {eligibleRhythms.map(rhythm => <option key={rhythm.id} value={rhythm.id}>{rhythm.title}</option>)}
            {rhythmId && !eligibleRhythms.some(rhythm => rhythm.id === rhythmId)
              && <option value={rhythmId}>Unresolved linked Rhythm</option>}
          </select>
        </label>
        {associationError && <p className="weight-form__notice" role="status">{associationError}</p>}
        {error && <p className="goal-field-error" role="alert">{error}</p>}
        <div className="profile-editor-actions">
          <button type="submit" className="btn mini">{measurement ? 'Save changes' : 'Save weigh-in'}</button>
          <button type="button" className="btn mini ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </MoneyGoalDialog>
  );
}

function WeightChart({
  data,
  today,
  measurements,
  expectedWeightKg
}: {
  data: WeightData;
  today: string;
  measurements: readonly WeightMeasurement[];
  expectedWeightKg: number | null;
}) {
  const goals = weightGoalSettings(data.goals);
  const unit = weightUnit(data.displayUnit);
  const dates = [
    ...(goals ? [goals.startDate, goals.goalDate] : []),
    ...measurements.map(item => item.date),
    ...(expectedWeightKg !== null && goals ? [today] : [])
  ].sort();
  if (!dates.length) {
    return <p className="weight-chart-empty">Set a complete goal or add a valid weigh-in to see the chart.</p>;
  }
  const start = dates[0]!;
  const end = dates.at(-1)!;
  const startNumber = dayNumber(start);
  const endNumber = Math.max(startNumber + 1, dayNumber(end));
  const visibleValues = [
    ...measurements.map(item => weightValueInUnit(item.weightKg, unit)),
    ...(goals ? [weightValueInUnit(goals.startWeightKg, unit), weightValueInUnit(goals.targetWeightKg, unit)] : []),
    ...(expectedWeightKg === null ? [] : [weightValueInUnit(expectedWeightKg, unit)])
  ];
  const low = Math.min(...visibleValues);
  const high = Math.max(...visibleValues);
  const pad = Math.max((high - low) * 0.15, 1);
  const min = low - pad;
  const max = high + pad;
  const x = (date: string) => 56 + (dayNumber(date) - startNumber) / (endNumber - startNumber) * 344;
  const y = (kg: number) => 18 + (max - weightValueInUnit(kg, unit)) / (max - min) * 176;
  const goalPath = goals
    ? `M ${x(goals.startDate)} ${y(goals.startWeightKg)} L ${x(goals.goalDate)} ${y(goals.targetWeightKg)}`
    : null;
  const showExpected = goals && expectedWeightKg !== null;
  return (
    <div className="weight-chart-wrap">
      <svg className="weight-chart" viewBox="0 0 420 240" role="img"
        aria-label={`Weight chart in ${unit}. Dots are recorded weigh-ins. Dashed line is the goal path${showExpected ? ' with an expected-today marker' : ''}.`}>
        {[0, 1, 2, 3].map(index => {
          const value = max - (max - min) * index / 3;
          const py = 18 + 176 * index / 3;
          return <g key={index}><line x1="56" y1={py} x2="400" y2={py} className="weight-chart__grid" />
            <text x="49" y={py + 4} textAnchor="end">{value.toFixed(1)}</text></g>;
        })}
        {goalPath && <path className="weight-chart__goal" d={goalPath}><title>Planned goal path</title></path>}
        {measurements.map(item => (
          <circle key={item.id} className="weight-chart__record" cx={x(item.date)} cy={y(item.weightKg)} r="5">
            <title>{`${formatDate(item.date)}: ${formatWeight(item.weightKg, unit)} ${unit}, recorded`}</title>
          </circle>
        ))}
        {showExpected && <g className="weight-chart__expected">
          <circle cx={x(today)} cy={y(expectedWeightKg!)} r="7" />
          <title>{`${formatDate(today)} expected: ${formatWeight(expectedWeightKg!, unit)} ${unit}; based on the goal path`}</title>
        </g>}
        <text x="56" y="221">{formatAxisDate(start)}</text>
        <text x="400" y="221" textAnchor="end">{formatAxisDate(end)}</text>
      </svg>
      <div className="weight-chart-legend" aria-label="Chart legend">
        <span><i className="weight-chart-legend__record" />Recorded measurement</span>
        {goals && <span><i className="weight-chart-legend__goal" />Goal path</span>}
        {showExpected && <span><i className="weight-chart-legend__expected" />Expected today</span>}
        <span className="weight-chart-legend__unit">Values in {unit}</span>
      </div>
    </div>
  );
}

function weightLinkIssues(
  data: WeightData,
  rhythms: readonly RhythmPreview[],
  archived: ReadonlySet<string>,
  today: string,
  completions: readonly DatedRhythmCompletion[]
): string[] {
  const issues: string[] = [];
  const seenCompletionIds = new Set<string>();
  data.weighIns.forEach((value, index) => {
    if (!isWeightMeasurement(value) || !value.rhythmId || !value.completionId) return;
    if (seenCompletionIds.has(value.completionId)) {
      issues.push(`Weigh-in ${index + 1} shares a completion reference; the records were preserved but may not both receive credit.`);
      return;
    }
    seenCompletionIds.add(value.completionId);
    const rhythm = rhythms.find(item => item.id === value.rhythmId);
    const error = weightRhythmOccurrenceError(rhythm, value.date, today, archived);
    if (error) issues.push(`Weigh-in ${value.id} has an unresolved Rhythm link: ${error}`);
    const completion = completions.find(item => item.id === value.completionId);
    if (!completion || completion.rhythmId !== value.rhythmId || completion.effectiveDate !== value.date) {
      issues.push(`Weigh-in ${value.id} has an unresolved completion reference; the record was preserved.`);
    }
  });
  return issues;
}

function formatDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00Z`));
}

function formatAxisDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00Z`));
}

function dayNumber(value: string): number {
  return Math.floor(Date.parse(`${value}T00:00:00Z`) / 86_400_000);
}
