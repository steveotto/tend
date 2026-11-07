import { useState } from 'react';
import type { FormEvent } from 'react';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { StyledSelect } from './StyledSelect.tsx';
import { flexibilityRegions } from '../domain/flexibility.ts';
import { estimateFlexibilityRoutineSeconds } from '../domain/flexibility.ts';
import type { FlexibilityRegionId, SavedFlexibilityRoutine } from '../domain/flexibility.ts';

type RoutineEditorErrors = {
  routineName?: string | undefined;
  noStretches?: string | undefined;
  stretches: Record<string, { name?: string; holdSeconds?: string; regions?: string }>;
};

export function FlexibilityRoutineEditorDialog({
  routine,
  onSave,
  onClose
}: {
  routine: SavedFlexibilityRoutine;
  onSave: (routine: SavedFlexibilityRoutine) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<SavedFlexibilityRoutine>(() => clone(routine));
  const [expandedStretchIds, setExpandedStretchIds] = useState<Set<string>>(
    () => new Set(routine.stretches[0] ? [routine.stretches[0].id] : [])
  );
  const [errors, setErrors] = useState<RoutineEditorErrors>({ stretches: {} });
  const estimatedSeconds = estimateFlexibilityRoutineSeconds(draft);

  function updateStretch(index: number, patch: Partial<SavedFlexibilityRoutine['stretches'][number]>) {
    setDraft(current => ({
      ...current,
      stretches: current.stretches.map((stretch, itemIndex) =>
        itemIndex === index ? { ...stretch, ...patch } : stretch)
    }));
    const id = draft.stretches[index]?.id;
    if (id) {
      setErrors(current => {
        const existing = current.stretches[id];
        if (!existing) return current;
        const next = { ...existing };
        if ('name' in patch) delete next.name;
        if ('holdSeconds' in patch) delete next.holdSeconds;
        if ('regionIds' in patch) delete next.regions;
        const stretches = { ...current.stretches };
        if (Object.keys(next).length > 0) stretches[id] = next;
        else delete stretches[id];
        return { ...current, stretches };
      });
    }
  }

  function toggleRegion(index: number, id: FlexibilityRegionId) {
    const stretch = draft.stretches[index]!;
    const regionIds = stretch.regionIds.includes(id)
      ? stretch.regionIds.filter(regionId => regionId !== id)
      : [...stretch.regionIds, id];
    updateStretch(index, { regionIds });
  }

  function addStretch() {
    const id = `stretch-${globalThis.crypto.randomUUID()}`;
    setDraft(current => ({
      ...current,
      stretches: [...current.stretches, {
        id,
        name: '',
        regionIds: [],
        sideMode: 'each',
        holdSeconds: 30
      }]
    }));
    setExpandedStretchIds(current => new Set(current).add(id));
    setErrors(current => ({ ...current, noStretches: undefined }));
  }

  function removeStretch(index: number) {
    setDraft(current => ({
      ...current,
      stretches: current.stretches.filter((_, itemIndex) => itemIndex !== index)
    }));
    const removedId = draft.stretches[index]?.id;
    if (removedId) {
      setExpandedStretchIds(current => {
        const next = new Set(current);
        next.delete(removedId);
        return next;
      });
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const stretchErrors: typeof errors.stretches = {};
    for (const stretch of draft.stretches) {
      const current: typeof errors.stretches[string] = {};
      if (!stretch.name.trim()) current.name = 'Enter a stretch name.';
      if (!Number.isInteger(stretch.holdSeconds) || stretch.holdSeconds < 1 || stretch.holdSeconds > 3600) {
        current.holdSeconds = 'Enter a hold from 1 to 3,600 seconds.';
      }
      if (stretch.regionIds.length === 0) current.regions = 'Choose at least one target region.';
      if (Object.keys(current).length > 0) stretchErrors[stretch.id] = current;
    }
    const routineNameError = draft.name.trim() ? undefined : 'Enter a routine name.';
    const noStretchesError = draft.stretches.length ? undefined : 'Add at least one stretch.';
    setErrors({
      ...(routineNameError ? { routineName: routineNameError } : {}),
      ...(noStretchesError ? { noStretches: noStretchesError } : {}),
      stretches: stretchErrors
    });
    if (routineNameError || noStretchesError || Object.keys(stretchErrors).length > 0) {
      const firstInvalid = draft.stretches.find(stretch => stretchErrors[stretch.id]);
      if (firstInvalid) {
        setExpandedStretchIds(current => new Set(current).add(firstInvalid.id));
      }
      return;
    }
    onSave({ ...draft, name: draft.name.trim() });
  }

  const isSuggestion = routine.id.startsWith('suggestion-');
  const isNewRoutine = routine.id.startsWith('new-routine-');
  const title = isSuggestion ? 'Preview routine' : isNewRoutine ? 'Create routine' : 'Edit routine';
  const preparationOptions = [
    { value: '0', label: 'Off' },
    { value: '3', label: '3 seconds' },
    { value: '5', label: '5 seconds' },
    { value: '10', label: '10 seconds' }
  ] as const;

  return (
    <MoneyGoalDialog
      title={title}
      closeLabel="Close routine editor"
      closeOnEscape
      dismissOnBackdrop
      portalToBody
      phoneFullScreen
      initialFocusId="flexibility-routine-name"
      dialogClassName="flexibility-routine-editor"
      onClose={onClose}
    >
      <form className="flexibility-routine-editor__form" onSubmit={save}>
        <div className="flexibility-routine-editor__body">
          <section className="flexibility-routine-editor__details" aria-label="Routine details">
            <label className="strength-form-field">Routine name
              <input id="flexibility-routine-name" value={draft.name}
                aria-invalid={Boolean(errors.routineName)}
                aria-describedby={errors.routineName ? 'flexibility-routine-name-error' : undefined}
                onChange={event => {
                  const name = event.currentTarget.value;
                  setDraft(current => ({ ...current, name }));
                  setErrors(current => ({ ...current, routineName: undefined }));
                }} />
            </label>
            {errors.routineName && <p id="flexibility-routine-name-error" className="flexibility-routine-editor__field-error">{errors.routineName}</p>}
            <label className="strength-form-field">Get-ready countdown
              <StyledSelect
                label="Get-ready countdown"
                value={String(draft.preparationSeconds)}
                options={preparationOptions}
                containerClassName="flexibility-routine-editor__select"
                onChange={value => setDraft(current => ({
                  ...current,
                  preparationSeconds: Number(value) as 0 | 3 | 5 | 10
                }))}
              />
            </label>
            <p className="flexibility-routine-editor__estimate"
              aria-label={`Estimated duration ${formatDuration(estimatedSeconds)} including holds and preparation`}>
              <span className="flexibility-routine-editor__clock" aria-hidden="true">◷</span>
              <span>About {formatApproximateDuration(estimatedSeconds)}</span>
            </p>
          </section>
          <div className="flexibility-routine-editor__stretches">
            {draft.stretches.map((stretch, index) => {
              const stretchError = errors.stretches[stretch.id];
              const summary = stretch.sideMode === 'both'
                ? `${stretch.holdSeconds} sec · Both sides`
                : `${stretch.holdSeconds} sec per side · Left + right`;
              return (
                <details
                  key={stretch.id}
                  className="flexibility-routine-editor__stretch"
                  open={expandedStretchIds.has(stretch.id)}
                  onToggle={event => {
                    const isOpen = event.currentTarget.open;
                    setExpandedStretchIds(current => {
                      const next = new Set(current);
                      if (isOpen) next.add(stretch.id);
                      else next.delete(stretch.id);
                      return next;
                    });
                  }}
                >
                  <summary className="flexibility-routine-editor__stretch-summary">
                    <span className="flexibility-routine-editor__number">{index + 1}</span>
                    <span className="flexibility-routine-editor__summary-copy">
                      <strong>{stretch.name.trim() || `Stretch ${index + 1}`}</strong>
                      <span>{summary}</span>
                    </span>
                    <span className="flexibility-routine-editor__chevron" aria-hidden="true">⌄</span>
                  </summary>
                  <div className="flexibility-routine-editor__stretch-content">
                    <label className="strength-form-field">Stretch name
                      <input value={stretch.name}
                        aria-invalid={Boolean(stretchError?.name)}
                        aria-describedby={stretchError?.name ? `flex-stretch-name-error-${index}` : undefined}
                        onChange={event => updateStretch(index, { name: event.currentTarget.value })} />
                    </label>
                    {stretchError?.name && <p id={`flex-stretch-name-error-${index}`} className="flexibility-routine-editor__field-error">{stretchError.name}</p>}
                    <div className="flexibility-routine-editor__field-row">
                      <label className="strength-form-field">Hold (seconds)
                        <input type="number" min="1" max="3600" step="1" inputMode="numeric"
                          value={stretch.holdSeconds}
                          aria-invalid={Boolean(stretchError?.holdSeconds)}
                          aria-describedby={stretchError?.holdSeconds ? `flex-stretch-hold-error-${index}` : undefined}
                          onChange={event => updateStretch(index, { holdSeconds: Number(event.currentTarget.value) })} />
                      </label>
                      <label className="strength-form-field">Sides
                        <select value={stretch.sideMode}
                          onChange={event => updateStretch(index, { sideMode: event.currentTarget.value as 'both' | 'each' })}>
                          <option value="each">Left and right</option>
                          <option value="both">Both sides</option>
                        </select>
                      </label>
                    </div>
                    {stretchError?.holdSeconds && <p id={`flex-stretch-hold-error-${index}`} className="flexibility-routine-editor__field-error">{stretchError.holdSeconds}</p>}
                    <fieldset className="flexibility-routine-editor__region-field">
                      <legend>Target regions</legend>
                      <div className="flexibility-routine-editor__regions">
                        {flexibilityRegions.map(region => {
                          const checked = stretch.regionIds.includes(region.id);
                          return (
                            <label key={region.id} className={`flexibility-routine-editor__region-chip${checked ? ' is-selected' : ''}`}>
                              <input type="checkbox" checked={checked}
                                aria-label={region.name}
                                onChange={() => toggleRegion(index, region.id)} />
                              <span aria-hidden="true">{checked ? '✓' : ''}</span>
                              {region.name}
                            </label>
                          );
                        })}
                      </div>
                      {stretchError?.regions && <p id={`flex-stretch-regions-error-${index}`} className="flexibility-routine-editor__field-error" role="alert">{stretchError.regions}</p>}
                    </fieldset>
                    <label className="strength-form-field">Instructions (optional)
                      <textarea rows={2} maxLength={500} value={stretch.instructions ?? ''}
                        onChange={event => updateStretch(index, { instructions: event.currentTarget.value })} />
                    </label>
                    <button type="button" className="strength-editor-link"
                      onClick={() => removeStretch(index)}>Remove stretch</button>
                  </div>
                </details>
              );
            })}
          </div>
          {errors.noStretches && <p className="flexibility-routine-editor__field-error" role="alert">{errors.noStretches}</p>}
          <button type="button" className="strength-editor-link" onClick={addStretch}>+ Add stretch</button>
        </div>
        <div className="money-goal-dialog__actions flexibility-routine-editor__actions">
          <button type="button" className="btn mini ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn mini">
            {isSuggestion ? 'Add to Saved' : isNewRoutine ? 'Save routine' : 'Save changes'}
          </button>
        </div>
      </form>
    </MoneyGoalDialog>
  );
}

function clone(routine: SavedFlexibilityRoutine): SavedFlexibilityRoutine {
  return { ...routine, stretches: routine.stretches.map(stretch => ({ ...stretch, regionIds: [...stretch.regionIds] })) };
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes} min${remainder ? ` ${remainder} sec` : ''}` : `${remainder} sec`;
}

function formatApproximateDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}
