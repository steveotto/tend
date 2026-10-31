import { useState } from 'react';
import type { FormEvent } from 'react';
import type { PersonId } from '../domain/preview-data.ts';
import {
  connectionStyles,
  personDetailsDraft,
  validatePersonDetailsDraft
} from '../domain/person-details.ts';
import type {
  PersonDetails,
  PersonDetailsDraft,
  PersonDetailsDraftErrors
} from '../domain/person-details.ts';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';

export function PersonDetailsEditor({
  personId,
  personName,
  details,
  today,
  onSave,
  onClose
}: {
  personId: PersonId;
  personName: string;
  details?: PersonDetails;
  today: string;
  onSave: (draft: PersonDetailsDraft) => string | null;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => personDetailsDraft(details));
  const [errors, setErrors] = useState<PersonDetailsDraftErrors>({});
  const [saveError, setSaveError] = useState('');
  const titleId = `person-details-title-${personId}`;

  function update(field: keyof PersonDetailsDraft, value: string) {
    setDraft(current => ({ ...current, [field]: value }));
    setErrors(current => ({ ...current, [field]: undefined }));
    setSaveError('');
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validatePersonDetailsDraft(draft, today);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }
    const error = onSave(draft);
    if (error) {
      setSaveError(error);
      return;
    }
    onClose();
  }

  function fieldError(field: keyof PersonDetailsDraft) {
    const message = errors[field];
    return message ? <span className="goal-field-error" id={`person-details-error-${field}`}>{message}</span> : null;
  }

  return (
    <MoneyGoalDialog
      title={`Edit ${personName}`}
      titleId={titleId}
      labelledBy={titleId}
      dialogClassName="person-details-dialog"
      initialFocusId={`person-details-relationship-${personId}`}
      onClose={onClose}
    >
      <form className="person-details-editor" noValidate onSubmit={submit}>
        <p className="person-details-editor__hint">All details are optional. Changes stay in this synthetic preview.</p>
        <div className="goal-field">
          <label htmlFor={`person-details-relationship-${personId}`}>Relationship</label>
          <input
            id={`person-details-relationship-${personId}`}
            type="text"
            maxLength={80}
            value={draft.relationshipLabel}
            aria-invalid={Boolean(errors.relationshipLabel)}
            aria-describedby={errors.relationshipLabel ? 'person-details-error-relationshipLabel' : undefined}
            onChange={event => update('relationshipLabel', event.currentTarget.value)}
          />
          {fieldError('relationshipLabel')}
        </div>
        <fieldset className="person-details-editor__date">
          <legend>Birthday</legend>
          <label htmlFor={`person-details-birthday-${personId}`}>Month and day (MM-DD)</label>
          <input
            id={`person-details-birthday-${personId}`}
            type="text"
            inputMode="numeric"
            placeholder="MM-DD"
            pattern="(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])"
            value={draft.birthdayMonthDay}
            aria-invalid={Boolean(errors.birthdayMonthDay)}
            aria-describedby={errors.birthdayMonthDay ? 'person-details-error-birthdayMonthDay' : undefined}
            onChange={event => update('birthdayMonthDay', event.currentTarget.value)}
          />
          {fieldError('birthdayMonthDay')}
          <label htmlFor={`person-details-birth-year-${personId}`}>Birth year (leave blank if unknown)</label>
          <input
            id={`person-details-birth-year-${personId}`}
            type="text"
            inputMode="numeric"
            maxLength={4}
            placeholder="Unknown"
            value={draft.birthdayYear}
            aria-invalid={Boolean(errors.birthdayYear)}
            aria-describedby={errors.birthdayYear ? 'person-details-error-birthdayYear' : undefined}
            onChange={event => update('birthdayYear', event.currentTarget.value)}
          />
          {fieldError('birthdayYear')}
        </fieldset>
        <div className="goal-field">
          <label htmlFor={`person-details-anniversary-${personId}`}>Anniversary (MM-DD)</label>
          <input
            id={`person-details-anniversary-${personId}`}
            type="text"
            inputMode="numeric"
            placeholder="MM-DD"
            pattern="(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])"
            value={draft.anniversaryMonthDay}
            aria-invalid={Boolean(errors.anniversaryMonthDay)}
            aria-describedby={errors.anniversaryMonthDay ? 'person-details-error-anniversaryMonthDay' : undefined}
            onChange={event => update('anniversaryMonthDay', event.currentTarget.value)}
          />
          {fieldError('anniversaryMonthDay')}
        </div>
        <div className="goal-field">
          <label htmlFor={`person-details-style-${personId}`}>Preferred connection style</label>
          <select
            id={`person-details-style-${personId}`}
            value={draft.connectionStyle}
            aria-invalid={Boolean(errors.connectionStyle)}
            aria-describedby={errors.connectionStyle ? 'person-details-error-connectionStyle' : undefined}
            onChange={event => update('connectionStyle', event.currentTarget.value)}
          >
            <option value="">Not set</option>
            {connectionStyles.map(style => <option key={style.value} value={style.value}>{style.label}</option>)}
          </select>
          {fieldError('connectionStyle')}
        </div>
        {saveError && <p className="goal-field-error" role="alert">{saveError}</p>}
        <div className="money-goal-dialog__actions">
          <button type="submit" className="btn mini">Save details</button>
          <button type="button" className="btn mini ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </MoneyGoalDialog>
  );
}
