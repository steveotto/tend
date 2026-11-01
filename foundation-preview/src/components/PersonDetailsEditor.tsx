import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { ConnectionCadence } from '../domain/friendships.ts';
import type { PersonId, PersonPickerGroupId } from '../domain/preview-data.ts';
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
import { PersonAvatar } from './PersonBadge.tsx';
import { compressPersonPhoto } from './person-photo.ts';

const cadenceOptions: readonly { value: ConnectionCadence; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'two-weeks', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' }
];

const categoryOptions: readonly { id: PersonPickerGroupId; label: string }[] = [
  { id: 'marriage', label: 'Marriage' },
  { id: 'parenting', label: 'Parenting' },
  { id: 'friends', label: 'Friend' }
];

export function PersonDetailsEditor({
  personId,
  personName,
  details,
  today,
  cadence,
  categoryIds = [],
  onSave,
  onClose
}: {
  personId: PersonId;
  personName: string;
  details?: PersonDetails;
  today: string;
  cadence?: ConnectionCadence | null;
  categoryIds?: readonly PersonPickerGroupId[];
  onSave: (draft: PersonDetailsDraft) => string | null;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => personDetailsDraft(details, cadence, categoryIds));
  const [errors, setErrors] = useState<PersonDetailsDraftErrors>({});
  const [saveError, setSaveError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoRequest = useRef(0);
  const titleId = `person-details-title-${personId}`;
  const isFriend = draft.categoryIds.includes('friends');
  const avatarPerson = {
    id: personId,
    displayName: personName,
    ...(draft.photoDataUrl ? { avatarUrl: draft.photoDataUrl } : {})
  };

  function update<K extends keyof PersonDetailsDraft>(field: K, value: PersonDetailsDraft[K]) {
    setDraft(current => ({ ...current, [field]: value }));
    setErrors(current => ({ ...current, [field]: undefined }));
    setSaveError('');
  }

  function changeDate(field: 'birthdayDate' | 'anniversaryDate', value: string) {
    update(field, value);
    if (value) update(field === 'birthdayDate' ? 'birthdayYearUnknown' : 'anniversaryYearUnknown', false);
  }

  function clearDate(field: 'birthdayDate' | 'anniversaryDate') {
    update(field, '');
    update(field === 'birthdayDate' ? 'birthdayYearUnknown' : 'anniversaryYearUnknown', false);
  }

  async function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    const request = ++photoRequest.current;
    setPhotoBusy(true);
    setPhotoError('');
    try {
      const photoDataUrl = await compressPersonPhoto(file);
      if (photoRequest.current === request) update('photoDataUrl', photoDataUrl);
    } catch (error) {
      if (photoRequest.current === request) {
        setPhotoError(error instanceof Error ? error.message : 'The selected photo could not be prepared.');
      }
    } finally {
      if (photoRequest.current === request) setPhotoBusy(false);
    }
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
      title={`Person settings — ${personName}`}
      titleId={titleId}
      labelledBy={titleId}
      dialogClassName="person-details-dialog"
      initialFocusId={`person-details-category-${personId}`}
      onClose={onClose}
    >
      <form className="person-details-editor" noValidate onSubmit={submit}>
        <div className="person-details-editor__scroll">
          <section className="person-details-editor__section" aria-labelledby={`person-section-${personId}`}>
            <h3 id={`person-section-${personId}`}>Person</h3>
            <div className="person-details-editor__photo">
              <span className="person-details-editor__photo-preview">
                <PersonAvatar person={avatarPerson} />
              </span>
              <div className="person-details-editor__photo-controls">
                <input
                  id={`person-photo-${personId}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label={`Choose photo for ${personName}`}
                  onChange={selectPhoto}
                  disabled={photoBusy}
                />
                <label className="btn mini ghost" htmlFor={`person-photo-${personId}`}>
                  Choose photo
                </label>
                {draft.photoDataUrl && (
                  <button type="button" className="btn mini ghost" onClick={() => update('photoDataUrl', '')}>
                    Remove photo
                  </button>
                )}
              </div>
              <p className="person-details-editor__help">Photos are cropped to a circle and saved with this preview.</p>
              {photoBusy && <p className="person-details-editor__help" role="status">Preparing photo…</p>}
              {photoError && <p className="goal-field-error" role="alert">{photoError}</p>}
              {fieldError('photoDataUrl')}
            </div>
            <div className="goal-field person-details-editor__category-field">
              <span>Category</span>
              <details className="person-details-editor__category-picker">
                <summary
                  id={`person-details-category-${personId}`}
                  aria-label={`Category: ${categoryOptions
                    .filter(option => draft.categoryIds.includes(option.id))
                    .map(option => option.label)
                    .join(', ') || 'none selected'}`}
                >
                  {categoryOptions
                    .filter(option => draft.categoryIds.includes(option.id))
                    .map(option => option.label)
                    .join(', ') || 'Choose categories'}
                </summary>
                <fieldset>
                  <legend>Select one or more categories</legend>
                  {categoryOptions.map(option => (
                    <label key={option.id}>
                      <input
                        type="checkbox"
                        checked={draft.categoryIds.includes(option.id)}
                        onChange={event => update(
                          'categoryIds',
                          event.currentTarget.checked
                            ? [...draft.categoryIds, option.id]
                            : draft.categoryIds.filter(id => id !== option.id)
                        )}
                      />
                      {option.label}
                    </label>
                  ))}
                </fieldset>
              </details>
            </div>
            <div className="person-details-editor__date-grid">
              <div className="goal-field">
                <label htmlFor={`person-details-birthday-${personId}`}>Birthday</label>
                <input
                  id={`person-details-birthday-${personId}`}
                  type="date"
                  value={draft.birthdayDate}
                  aria-invalid={Boolean(errors.birthdayDate)}
                  aria-describedby={[
                    errors.birthdayDate ? 'person-details-error-birthdayDate' : '',
                    draft.birthdayYearUnknown && details?.birthday
                      ? `person-details-partial-birthday-${personId}`
                      : ''
                  ].filter(Boolean).join(' ') || undefined}
                  onChange={event => changeDate('birthdayDate', event.currentTarget.value)}
                />
                {draft.birthdayYearUnknown && details?.birthday && (
                  <span className="person-details-editor__help" id={`person-details-partial-birthday-${personId}`}>
                    Saved date: {formatPartialDate(details.birthday.monthDay)}. Choose a full date to replace it.
                  </span>
                )}
                <button type="button" className="btn mini ghost" onClick={() => clearDate('birthdayDate')}>
                  Clear birthday
                </button>
                {fieldError('birthdayDate')}
              </div>
              <div className="goal-field">
                <label htmlFor={`person-details-anniversary-${personId}`}>Anniversary</label>
                <input
                  id={`person-details-anniversary-${personId}`}
                  type="date"
                  value={draft.anniversaryDate}
                  aria-invalid={Boolean(errors.anniversaryDate)}
                  aria-describedby={[
                    errors.anniversaryDate ? 'person-details-error-anniversaryDate' : '',
                    draft.anniversaryYearUnknown && details?.anniversary
                      ? `person-details-partial-anniversary-${personId}`
                      : ''
                  ].filter(Boolean).join(' ') || undefined}
                  onChange={event => changeDate('anniversaryDate', event.currentTarget.value)}
                />
                {draft.anniversaryYearUnknown && details?.anniversary && (
                  <span className="person-details-editor__help" id={`person-details-partial-anniversary-${personId}`}>
                    Saved date: {formatPartialDate(details.anniversary.monthDay)}. Choose a full date to replace it.
                  </span>
                )}
                <button type="button" className="btn mini ghost" onClick={() => clearDate('anniversaryDate')}>
                  Clear anniversary
                </button>
                {fieldError('anniversaryDate')}
              </div>
            </div>
          </section>
          <section className="person-details-editor__section" aria-labelledby={`connection-section-${personId}`}>
            <h3 id={`connection-section-${personId}`}>Connection</h3>
            <div className="person-details-editor__date-grid">
              <label className="goal-field" htmlFor={`person-details-cadence-${personId}`}>
                <span>Connection cadence</span>
                <select
                  id={`person-details-cadence-${personId}`}
                  value={draft.connectionCadence}
                  disabled={!isFriend}
                  aria-invalid={Boolean(errors.connectionCadence)}
                  aria-describedby={!isFriend
                    ? `person-details-cadence-help-${personId}`
                    : errors.connectionCadence ? 'person-details-error-connectionCadence' : undefined}
                  onChange={event => update('connectionCadence', event.currentTarget.value)}
                >
                  <option value="">Not set</option>
                  {cadenceOptions.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
                </select>
                {!isFriend && (
                  <span className="person-details-editor__help" id={`person-details-cadence-help-${personId}`}>
                    Select Friend to edit this person’s connection cadence.
                  </span>
                )}
                {fieldError('connectionCadence')}
              </label>
              <label className="goal-field" htmlFor={`person-details-style-${personId}`}>
                <span>Love language</span>
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
              </label>
            </div>
          </section>
        </div>
        {saveError && <p className="goal-field-error" role="alert">{saveError}</p>}
        <div className="money-goal-dialog__actions person-details-editor__actions">
          <button type="submit" className="btn mini" disabled={photoBusy}>Save</button>
          <button type="button" className="btn mini ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </MoneyGoalDialog>
  );
}

function formatPartialDate(monthDay: string): string {
  const [month, day] = monthDay.split('-').map(Number);
  return new Date(Date.UTC(2000, month! - 1, day!)).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  });
}
