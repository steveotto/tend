import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { areas, syntheticPeople } from '../domain/preview-data.ts';
import type { RhythmPreview } from '../domain/preview-data.ts';
import {
  rhythmCadences,
  rhythmDraftFrom,
  rhythmTimes
} from '../domain/rhythm-editor.ts';
import type {
  RhythmCategoryId,
  RhythmDraft,
  RhythmDraftErrors
} from '../domain/rhythm-editor.ts';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';

const emptyDraft: RhythmDraft = {
  title: '',
  description: '',
  cadence: 'Daily',
  timeLabel: 'Anytime',
  personIds: [],
  categoryIds: []
};

type RhythmEditorProps = {
  rhythm?: RhythmPreview;
  onSave: (draft: RhythmDraft) => RhythmDraftErrors;
  onArchive?: (id: string) => void;
  onClose: () => void;
};

export function RhythmEditor({ rhythm, onSave, onArchive, onClose }: RhythmEditorProps) {
  const [draft, setDraft] = useState<RhythmDraft>(() =>
    rhythm ? rhythmDraftFrom(rhythm, rhythm.categoryIds ?? []) : emptyDraft
  );
  const [errors, setErrors] = useState<RhythmDraftErrors>({});
  const [showArchiveConfirmation, setShowArchiveConfirmation] = useState(false);
  const archiveButtonRef = useRef<HTMLButtonElement>(null);
  const archiveConfirmButtonRef = useRef<HTMLButtonElement>(null);
  const wasConfirmingArchiveRef = useRef(false);

  useEffect(() => {
    if (showArchiveConfirmation) archiveConfirmButtonRef.current?.focus();
    else if (wasConfirmingArchiveRef.current) archiveButtonRef.current?.focus();
    wasConfirmingArchiveRef.current = showArchiveConfirmation;
  }, [showArchiveConfirmation]);

  function update<K extends keyof RhythmDraft>(field: K, value: RhythmDraft[K]) {
    setDraft(previous => ({ ...previous, [field]: value }));
    setErrors(previous => {
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }

  function togglePerson(personId: (typeof syntheticPeople)[number]['id'], checked: boolean) {
    update('personIds', checked
      ? [...draft.personIds, personId]
      : draft.personIds.filter(id => id !== personId));
  }

  function toggleCategory(categoryId: RhythmCategoryId, checked: boolean) {
    update('categoryIds', checked
      ? [...draft.categoryIds, categoryId]
      : draft.categoryIds.filter(id => id !== categoryId));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = onSave(draft);
    setErrors(nextErrors);
  }

  function handleSelect<K extends 'cadence' | 'timeLabel'>(
    field: K,
    event: ChangeEvent<HTMLSelectElement>
  ) {
    update(field, event.currentTarget.value);
  }

  function fieldError(field: keyof RhythmDraft) {
    return errors[field]
      ? <span className="goal-field-error" id={`rhythm-error-${field}`}>{errors[field]}</span>
      : null;
  }

  return (
    <MoneyGoalDialog
      title={rhythm ? 'Edit Rhythm' : 'Add Rhythm'}
      intro="Synthetic preview only. Cadence is descriptive; this preview does not calculate future occurrences."
      onClose={onClose}
    >
      <form className="rhythm-editor" onSubmit={submit} noValidate>
        <div className="goal-field">
          <label htmlFor="rhythm-title">Title</label>
          <input
            id="rhythm-title"
            autoFocus
            maxLength={80}
            value={draft.title}
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? 'rhythm-error-title' : undefined}
            onChange={event => update('title', event.currentTarget.value)}
          />
          {fieldError('title')}
        </div>
        <div className="goal-field">
          <label htmlFor="rhythm-description">Description (optional)</label>
          <textarea
            id="rhythm-description"
            rows={3}
            maxLength={1000}
            value={draft.description}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? 'rhythm-error-description' : undefined}
            onChange={event => update('description', event.currentTarget.value)}
          />
          {fieldError('description')}
        </div>
        <div className="goal-form-grid">
          <div className="goal-field">
            <label htmlFor="rhythm-cadence">Cadence</label>
            <select
              id="rhythm-cadence"
              value={draft.cadence}
              aria-invalid={Boolean(errors.cadence)}
              aria-describedby={errors.cadence ? 'rhythm-error-cadence' : undefined}
              onChange={event => handleSelect('cadence', event)}
            >
              {rhythmCadences.map(cadence => <option key={cadence} value={cadence}>{cadence}</option>)}
            </select>
            {fieldError('cadence')}
          </div>
          <div className="goal-field">
            <label htmlFor="rhythm-time">Time of day</label>
            <select
              id="rhythm-time"
              value={draft.timeLabel}
              aria-invalid={Boolean(errors.timeLabel)}
              aria-describedby={errors.timeLabel ? 'rhythm-error-timeLabel' : undefined}
              onChange={event => handleSelect('timeLabel', event)}
            >
              {rhythmTimes.map(time => <option key={time} value={time}>{time}</option>)}
            </select>
            {fieldError('timeLabel')}
          </div>
        </div>

        <fieldset className="rhythm-editor-options">
          <legend>People</legend>
          <div className="rhythm-editor-options__list">
            {syntheticPeople.map(person => (
              <label key={person.id} className="rhythm-editor-choice">
                <input
                  type="checkbox"
                  checked={draft.personIds.includes(person.id)}
                  onChange={event => togglePerson(person.id, event.currentTarget.checked)}
                />
                <span>{person.displayName}</span>
              </label>
            ))}
          </div>
          {fieldError('personIds')}
        </fieldset>

        <fieldset className="rhythm-editor-options">
          <legend>Categories</legend>
          <div className="rhythm-editor-options__list">
            {areas.map(area => (
              <label key={area.id} className="rhythm-editor-choice">
                <input
                  type="checkbox"
                  checked={draft.categoryIds.includes(area.id)}
                  onChange={event => toggleCategory(area.id, event.currentTarget.checked)}
                />
                <span>{area.label}</span>
              </label>
            ))}
          </div>
          {fieldError('categoryIds')}
        </fieldset>

        {Object.keys(errors).length > 0 && (
          <p className="goal-form-error-summary" role="alert">Review the highlighted Rhythm fields.</p>
        )}
        <div className="rhythm-editor__action-row">
          <div className="money-goal-dialog__actions rhythm-editor__primary-actions">
            <button type="submit" className="btn mini">{rhythm ? 'Save Rhythm' : 'Add Rhythm'}</button>
            <button type="button" className="btn mini ghost" onClick={onClose}>Cancel</button>
          </div>
          {rhythm && onArchive && (
            <button
              ref={archiveButtonRef}
              type="button"
              className="rhythm-editor__archive-button"
              aria-label={`Archive ${rhythm.title}`}
              onClick={() => setShowArchiveConfirmation(true)}
            >
              Archive
            </button>
          )}
        </div>
      </form>
      {showArchiveConfirmation && rhythm && onArchive && (
        <section
          className="rhythm-editor__archive-confirmation"
          role="alertdialog"
          aria-labelledby="rhythm-archive-confirmation-title"
          aria-describedby="rhythm-archive-confirmation-description"
        >
          <h3 id="rhythm-archive-confirmation-title">Archive {rhythm.title}?</h3>
          <p id="rhythm-archive-confirmation-description">
            This Rhythm will leave active Today and category lists. Its identity, associations, and completion history will be retained.
          </p>
          <div className="money-goal-dialog__actions">
            <button
              ref={archiveConfirmButtonRef}
              type="button"
              className="rhythm-editor__archive-confirm"
              aria-label={`Confirm archive ${rhythm.title}`}
              onClick={() => onArchive(rhythm.id)}
            >
              Archive rhythm
            </button>
            <button
              type="button"
              className="btn mini ghost"
              onClick={() => setShowArchiveConfirmation(false)}
            >
              Cancel
            </button>
          </div>
        </section>
      )}
    </MoneyGoalDialog>
  );
}
