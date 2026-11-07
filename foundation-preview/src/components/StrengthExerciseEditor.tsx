import { useState } from 'react';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { StrengthMuscleGroupsDisclosure } from './StrengthMuscleGroupsDisclosure.tsx';
import { formatStrengthRest } from './strength-format.ts';
import {
  resolveStrengthBetweenSetRestSeconds,
  validateStrengthWorkoutExercise
} from '../domain/strength.ts';
import type {
  StrengthLoad,
  StrengthLoadMeaning,
  StrengthMuscleId,
  StrengthSettings,
  StrengthWorkoutExercise
} from '../domain/strength.ts';

type ExerciseEditorSet = {
  id: string;
  reps: string;
  durationMinutes: string;
  durationSeconds: string;
  load: string;
};

type ExerciseEditorDraft = {
  id: string;
  name: string;
  muscleIds: StrengthMuscleId[];
  equipment: string;
  notes: string;
  restDurationOverridden: boolean;
  restMinutes: string;
  restSeconds: string;
  restChoice: string;
  measurement: 'reps' | 'duration';
  meaning: StrengthLoadMeaning | '';
  unit: 'lb' | 'kg';
  sets: ExerciseEditorSet[];
};

type StrengthExerciseEditorProps = {
  exercise: StrengthWorkoutExercise;
  weightUnit?: 'lb' | 'kg';
  settings: Pick<StrengthSettings, 'betweenSetRestSeconds'>;
  onDone: (exercise: StrengthWorkoutExercise) => void;
  onCancel: () => void;
};

const restChoices = [
  { value: 60, label: '1:00' },
  { value: 90, label: '1:30' },
  { value: 120, label: '2:00' },
  { value: 150, label: '2:30' },
  { value: 180, label: '3:00' }
] as const;

function isStrengthLoad(value: StrengthLoad | undefined): value is Extract<StrengthLoad, { kind: 'external' }> {
  return value?.kind === 'external';
}

function initialDraft(exercise: StrengthWorkoutExercise, preferredWeightUnit: 'lb' | 'kg' = 'lb'): ExerciseEditorDraft {
  const firstLoad = exercise.sets.find(set => set.targetLoad !== undefined)?.targetLoad;
  const externalLoad = isStrengthLoad(firstLoad) ? firstLoad : undefined;
  return {
    id: exercise.id,
    name: exercise.name,
    muscleIds: [...exercise.muscleIds],
    equipment: exercise.equipment,
    notes: exercise.notes ?? '',
    restDurationOverridden: exercise.restDurationOverridden ?? true,
    restMinutes: String(Math.floor(exercise.restDurationSeconds / 60)),
    restSeconds: String(exercise.restDurationSeconds % 60),
    restChoice: restChoices.some(choice => choice.value === exercise.restDurationSeconds)
      ? String(exercise.restDurationSeconds)
      : 'custom',
    measurement: exercise.sets[0]?.measurement?.kind === 'duration' ? 'duration' : 'reps',
    meaning: exercise.loadMeaning
      ?? externalLoad?.meaning
      ?? (firstLoad?.kind === 'bodyweight' ? 'bodyweight' : ''),
    unit: externalLoad?.unit ?? preferredWeightUnit,
    sets: exercise.sets.map(set => ({
      id: set.id,
      reps: set.targetReps === undefined ? '' : String(set.targetReps),
      durationMinutes: set.measurement?.kind === 'duration'
        ? String(Math.floor(set.measurement.targetDurationSeconds / 60)) : '',
      durationSeconds: set.measurement?.kind === 'duration'
        ? String(set.measurement.targetDurationSeconds % 60) : '',
      load: isStrengthLoad(set.targetLoad) ? String(set.targetLoad.value) : ''
    }))
  };
}

function makeSet(): ExerciseEditorSet {
  return {
    id: `strength-set-${globalThis.crypto.randomUUID()}`,
    reps: '',
    durationMinutes: '',
    durationSeconds: '',
    load: ''
  };
}

export function StrengthExerciseEditor({
  exercise,
  weightUnit = 'lb',
  settings,
  onDone,
  onCancel
}: StrengthExerciseEditorProps) {
  const [draft, setDraft] = useState(() => initialDraft(exercise, weightUnit));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isRestPreset = draft.restChoice !== 'custom';
  const loadMeaningSummary = draft.meaning === 'bodyweight'
    ? 'Bodyweight'
    : draft.meaning === 'total'
      ? 'Total weight'
      : draft.meaning === 'per-dumbbell'
        ? 'Per dumbbell'
        : draft.meaning === 'per-side' ? 'Per side' : 'Choose load meaning';

  function update<K extends keyof ExerciseEditorDraft>(key: K, value: ExerciseEditorDraft[K]) {
    setDraft(current => ({ ...current, [key]: value }));
    setErrors(current => {
      const errorKey = key === 'restMinutes' || key === 'restSeconds' ? 'rest' : String(key);
      if (!current[errorKey] && !current.sets) return current;
      const next = { ...current };
      delete next[errorKey];
      if (key === 'sets') delete next.sets;
      return next;
    });
  }

  function toggleMuscle(id: StrengthMuscleId) {
    setDraft(current => {
      const muscleIds = current.muscleIds.includes(id)
        ? current.muscleIds.filter(selected => selected !== id)
        : [...current.muscleIds, id];
      const restDurationSeconds = current.restDurationOverridden
        ? Number(current.restMinutes) * 60 + Number(current.restSeconds)
        : resolveStrengthBetweenSetRestSeconds(muscleIds, settings);
      return {
        ...current,
        muscleIds,
        ...(current.restDurationOverridden ? {} : {
          restMinutes: String(Math.floor(restDurationSeconds / 60)),
          restSeconds: String(restDurationSeconds % 60),
          restChoice: restChoices.some(choice => choice.value === restDurationSeconds)
            ? String(restDurationSeconds) : 'custom'
        })
      };
    });
    setErrors(current => {
      if (!current.muscles) return current;
      const next = { ...current };
      delete next.muscles;
      return next;
    });
  }

  function setRestDuration(seconds: number) {
    setDraft(current => ({
      ...current,
      restDurationOverridden: true,
      restMinutes: String(Math.floor(seconds / 60)),
      restSeconds: String(seconds % 60),
      restChoice: restChoices.some(choice => choice.value === seconds) ? String(seconds) : 'custom'
    }));
    setErrors(current => {
      const next = { ...current };
      delete next.rest;
      return next;
    });
  }

  function updateSet(index: number, patch: Partial<ExerciseEditorSet>) {
    setDraft(current => ({
      ...current,
      sets: current.sets.map((set, setIndex) =>
        setIndex === index ? { ...set, ...patch } : set
      )
    }));
    setErrors(current => {
      const next = { ...current };
      delete next[`reps-${index}`];
      delete next[`load-${index}`];
      delete next[`duration-${index}`];
      delete next.sets;
      return next;
    });
  }

  function removeSet(index: number) {
    update('sets', draft.sets.filter((_, setIndex) => setIndex !== index));
    setErrors(current => Object.fromEntries(
      Object.entries(current).filter(([key]) => !/^(reps|load)-\d+$/.test(key))
    ));
  }

  function save() {
    const nextErrors: Record<string, string> = {};
    if (!draft.name.trim()) nextErrors.name = 'Enter an exercise name.';
    if (!draft.equipment.trim()) nextErrors.equipment = 'Enter the equipment or Bodyweight.';
    if (!draft.muscleIds.length) nextErrors.muscles = 'Choose at least one muscle group.';
    if (!draft.meaning) nextErrors.meaning = 'Choose how this exercise load is measured.';
    const restMinutes = draft.restMinutes.trim() === '' ? Number.NaN : Number(draft.restMinutes);
    const restSeconds = draft.restSeconds.trim() === '' ? Number.NaN : Number(draft.restSeconds);
    const restDurationSeconds = restMinutes * 60 + restSeconds;
    if (
      !Number.isInteger(restMinutes)
      || restMinutes < 0
      || restMinutes > 60
      || !Number.isInteger(restSeconds)
      || restSeconds < 0
      || restSeconds > 59
      || !Number.isInteger(restDurationSeconds)
      || restDurationSeconds > 3600
    ) {
      nextErrors.rest = 'Enter a duration from 0:00 to 60:00.';
    }

    const sets = draft.sets.map((set, index) => {
      let measurement: NonNullable<StrengthWorkoutExercise['sets'][number]['measurement']> = { kind: 'reps' };
      let targetReps: number | undefined;
      if (draft.measurement === 'duration') {
        const minutes = set.durationMinutes.trim() === '' ? Number.NaN : Number(set.durationMinutes);
        const seconds = set.durationSeconds.trim() === '' ? Number.NaN : Number(set.durationSeconds);
        const durationSeconds = minutes * 60 + seconds;
        if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440
          || !Number.isInteger(seconds) || seconds < 0 || seconds > 59
          || !Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 86_400) {
          nextErrors[`duration-${index}`] = 'Enter a target from 0:01 to 24:00:00.';
        } else {
          measurement = { kind: 'duration', targetDurationSeconds: durationSeconds };
        }
      } else {
        const actualReps = set.reps.trim() === '' ? Number.NaN : Number(set.reps);
        if (!Number.isInteger(actualReps) || actualReps < 1 || actualReps > 1000) {
          nextErrors[`reps-${index}`] = 'Enter a whole number from 1 to 1000.';
        }
        targetReps = Number.isInteger(actualReps) && actualReps >= 1 && actualReps <= 1000
          ? actualReps
          : undefined;
        measurement = { kind: 'reps' };
      }
      if (draft.meaning === 'bodyweight') {
        return {
          id: set.id,
          measurement,
          ...(targetReps === undefined ? {} : { targetReps }),
          targetLoad: { kind: 'bodyweight' as const }
        };
      }
      const load = set.load.trim() === '' ? undefined : Number(set.load);
      if (load !== undefined && (!Number.isFinite(load) || load < 0 || load > 10000)) {
        nextErrors[`load-${index}`] = 'Enter a load from 0 to 10000, or leave it blank.';
      }
      return {
        id: set.id,
        measurement,
        ...(targetReps === undefined ? {} : { targetReps }),
        ...(draft.meaning === ''
          || load === undefined || !Number.isFinite(load) || load < 0 || load > 10000
          ? {}
          : { targetLoad: { kind: 'external' as const, meaning: draft.meaning, value: load, unit: draft.unit } })
      };
    });

    const next: StrengthWorkoutExercise = {
      id: draft.id,
      name: draft.name.trim(),
      muscleIds: [...draft.muscleIds],
      equipment: draft.equipment.trim(),
      ...(draft.meaning ? { loadMeaning: draft.meaning } : {}),
      ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
      restDurationSeconds,
      restDurationOverridden: draft.restDurationOverridden,
      sets
    };
    if (!validateStrengthWorkoutExercise(next)) {
      if (!nextErrors.name && !draft.name.trim()) nextErrors.name = 'Enter an exercise name.';
      if (!nextErrors.equipment && !draft.equipment.trim()) nextErrors.equipment = 'Enter the equipment or Bodyweight.';
      if (!nextErrors.muscles && !draft.muscleIds.length) nextErrors.muscles = 'Choose at least one muscle group.';
      if (!Object.keys(nextErrors).length) nextErrors.sets = 'Add a valid planned set.';
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    onDone(next);
  }

  return (
    <MoneyGoalDialog
      title={exercise.name ? 'Edit exercise' : 'Add exercise'}
      labelledBy="strength-exercise-editor-title"
      titleId="strength-exercise-editor-title"
      closeLabel="Close exercise editor"
      bodyClassName="strength-dialog-body strength-exercise-editor"
      dialogClassName="money-goal-dialog--strength-exercise-editor"
      stopEscapePropagation
      portalToBody
      onClose={onCancel}
    >
      <div onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }
      }}>
        <section className="strength-exercise-editor__group" aria-labelledby="strength-exercise-group-title">
          <h3 id="strength-exercise-group-title">Exercise</h3>
          <label className="strength-form-field">
            Exercise name
            <input autoFocus value={draft.name} maxLength={120} aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'strength-exercise-name-error' : undefined}
              onChange={event => update('name', event.currentTarget.value)} />
            {errors.name && <span id="strength-exercise-name-error" className="strength-form-error">{errors.name}</span>}
          </label>
          <label className="strength-form-field">
            Equipment
            <input value={draft.equipment} maxLength={80} placeholder="For example, Barbell"
              aria-invalid={Boolean(errors.equipment)}
              aria-describedby={errors.equipment ? 'strength-exercise-equipment-error' : undefined}
              onChange={event => update('equipment', event.currentTarget.value)} />
            {errors.equipment && <span id="strength-exercise-equipment-error" className="strength-form-error">{errors.equipment}</span>}
          </label>
          <StrengthMuscleGroupsDisclosure
            selectedMuscleIds={draft.muscleIds}
            onToggle={toggleMuscle}
            label="Muscle groups"
          />
          {errors.muscles && <p className="strength-form-error" role="alert">{errors.muscles}</p>}
        </section>

        <section className="strength-exercise-editor__group" aria-labelledby="strength-exercise-sets-title">
          <h3 id="strength-exercise-sets-title">Sets</h3>
          <label className="strength-form-field">
            Measurement
            <select aria-label="Set measurement" value={draft.measurement} onChange={event => {
              const measurement = event.currentTarget.value as ExerciseEditorDraft['measurement'];
              update('measurement', measurement);
              setErrors(current => {
                const next = { ...current };
                Object.keys(next).filter(key => key.startsWith('reps-') || key.startsWith('duration-'))
                  .forEach(key => delete next[key]);
                return next;
              });
            }}>
              <option value="reps">Reps</option>
              <option value="duration">Time</option>
            </select>
          </label>
          <details className="strength-editor-disclosure strength-exercise-editor__details" open={Boolean(errors.meaning)}>
            <summary>
              <span>Exercise details</span>
              <span className="strength-exercise-editor__details-summary">{loadMeaningSummary}</span>
              <span aria-hidden="true">›</span>
            </summary>
            <div className="strength-exercise-editor__details-content">
              <label className="strength-form-field">
                Weight measured as
                <select aria-label="Load meaning" value={draft.meaning}
                  aria-invalid={Boolean(errors.meaning)}
                  aria-describedby={errors.meaning ? 'strength-exercise-meaning-error' : undefined}
                  onChange={event => {
                    const meaning = event.currentTarget.value as ExerciseEditorDraft['meaning'];
                    update('meaning', meaning);
                  }}>
                  <option value="">Choose load meaning</option>
                  <option value="total">Total weight</option>
                  <option value="per-dumbbell">Per dumbbell</option>
                  <option value="per-side">Per side</option>
                  <option value="bodyweight">Bodyweight</option>
                </select>
                {errors.meaning && <span id="strength-exercise-meaning-error" className="strength-form-error">{errors.meaning}</span>}
              </label>
            </div>
          </details>

          <table className={draft.meaning === 'bodyweight'
            ? 'strength-exercise-editor__table is-bodyweight'
            : 'strength-exercise-editor__table'}>
            <thead>
              <tr>
                <th scope="col">Set</th>
                <th scope="col">{draft.meaning !== 'bodyweight' ? `Weight (${weightUnit})` : 'Weight'}</th>
                <th scope="col">{draft.measurement === 'duration' ? 'Time target' : 'Reps'}</th>
                <th scope="col"><span className="visually-hidden">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {draft.sets.map((set, index) => (
                <tr key={set.id}>
                  <th scope="row">{index + 1}</th>
                  <td>{draft.meaning === 'bodyweight'
                    ? <span className="strength-exercise-editor__bodyweight">Bodyweight</span>
                    : (
                      <label>
                        <span className="visually-hidden">Set {index + 1} weight in {draft.unit}</span>
                        <input type="number" min="0" max="10000" step="any" inputMode="decimal" value={set.load}
                          aria-invalid={Boolean(errors[`load-${index}`])}
                          aria-describedby={errors[`load-${index}`] ? `strength-exercise-load-error-${index}` : undefined}
                          onChange={event => updateSet(index, { load: event.currentTarget.value })} />
                        {errors[`load-${index}`] && <span id={`strength-exercise-load-error-${index}`} className="strength-form-error">{errors[`load-${index}`]}</span>}
                      </label>
                    )}</td>
                  <td>
                    {draft.measurement === 'duration' ? (
                      <>
                        <div className="strength-exercise-editor__duration-input">
                          <label>
                            <span className="visually-hidden">Set {index + 1} target minutes</span>
                            <input type="number" min="0" max="1440" step="1" inputMode="numeric"
                              value={set.durationMinutes}
                              onChange={event => updateSet(index, { durationMinutes: event.currentTarget.value })} />
                          </label>
                          <span aria-hidden="true">:</span>
                          <label>
                            <span className="visually-hidden">Set {index + 1} target seconds</span>
                            <input type="number" min="0" max="59" step="1" inputMode="numeric"
                              value={set.durationSeconds}
                              onChange={event => updateSet(index, { durationSeconds: event.currentTarget.value })} />
                          </label>
                        </div>
                        {errors[`duration-${index}`] && <span className="strength-form-error" role="alert">{errors[`duration-${index}`]}</span>}
                      </>
                    ) : (
                      <label>
                        <span className="visually-hidden">Set {index + 1} reps</span>
                        <input type="number" min="1" max="1000" step="1" inputMode="numeric" required value={set.reps}
                          aria-invalid={Boolean(errors[`reps-${index}`])}
                          aria-describedby={errors[`reps-${index}`] ? `strength-exercise-reps-error-${index}` : undefined}
                          onChange={event => updateSet(index, { reps: event.currentTarget.value })} />
                        {errors[`reps-${index}`] && <span id={`strength-exercise-reps-error-${index}`} className="strength-form-error">{errors[`reps-${index}`]}</span>}
                      </label>
                    )}
                  </td>
                  <td>
                    <button type="button" className="strength-exercise-editor__set-remove"
                      aria-label={`Remove set ${index + 1}`} onClick={() => removeSet(index)}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {draft.sets.length === 0 && <p className="strength-exercise-editor__help">Add at least one planned set.</p>}
          {errors.sets && <p className="strength-form-error" role="alert">{errors.sets}</p>}
          <button type="button" className="strength-editor-link" aria-label="Add set" onClick={() => update('sets', [...draft.sets, makeSet()])}>
            + Add set
          </button>
        </section>

        <section className="strength-exercise-editor__group" aria-labelledby="strength-exercise-rest-title">
          <h3 id="strength-exercise-rest-title">Rest and notes</h3>
          <details className="strength-editor-disclosure">
            <summary><span>Rest between sets</span><strong>{formatStrengthRest(Number(draft.restMinutes || 0) * 60 + Number(draft.restSeconds || 0))}</strong><span aria-hidden="true">›</span></summary>
            <div className="strength-exercise-editor__rest-options">
              <label className="strength-form-field">Preset
                <select aria-label="Rest duration" value={draft.restChoice} onChange={event => {
                  const choice = event.currentTarget.value;
                  if (choice !== 'custom') {
                    setRestDuration(Number(choice));
                  } else {
                    update('restChoice', choice);
                  }
                }}>
                  {restChoices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                  <option value="custom">Custom</option>
                </select>
              </label>
              {!isRestPreset && (
                <label className="strength-form-field">
                  Custom rest duration in seconds
                  <input type="number" min="0" max="3600" step="1" inputMode="numeric" value={Number(draft.restMinutes || 0) * 60 + Number(draft.restSeconds || 0)}
                    aria-label="Custom rest duration in seconds"
                    aria-invalid={Boolean(errors.rest)} aria-describedby={errors.rest ? 'strength-exercise-rest-error' : undefined}
                    onChange={event => {
                      const totalSeconds = Number(event.currentTarget.value);
                      const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.min(3600, totalSeconds)) : 0;
                      setRestDuration(safeSeconds);
                    }} />
                </label>
              )}
              {errors.rest && <span id="strength-exercise-rest-error" className="strength-form-error">{errors.rest}</span>}
            </div>
          </details>
          <details className="strength-editor-disclosure strength-exercise-editor__notes">
            <summary>
              <span>{draft.notes.trim() ? 'Notes' : 'Add notes'}</span>
              {draft.notes.trim() && <span className="strength-exercise-editor__notes-preview">{draft.notes.trim()}</span>}
              <span aria-hidden="true">›</span>
            </summary>
            <label className="strength-form-field">Exercise notes
              <textarea maxLength={1000} value={draft.notes} onChange={event => update('notes', event.currentTarget.value)} />
            </label>
          </details>
        </section>
        <div className="money-goal-dialog__actions">
          <button type="button" className="btn mini" onClick={save}>Done</button>
          <button type="button" className="btn mini ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </MoneyGoalDialog>
  );
}
