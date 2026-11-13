import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { connectionCadences } from '../domain/friendships.ts';
import type { ConnectionCadence } from '../domain/friendships.ts';
import { resolvePersonCategory } from '../domain/person-categories.ts';
import type { PersonId, PersonPickerGroupId } from '../domain/preview-data.ts';
import {
  connectionStyles,
  personDetailsDraft,
  relationshipGroups,
  validatePersonDetailsDraft
} from '../domain/person-details.ts';
import type {
  PersonDetails,
  PersonDetailsDraft,
  PersonDetailsDraftErrors
} from '../domain/person-details.ts';
import { HelpPopover } from './HelpPopover.tsx';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { PersonAvatar } from './PersonBadge.tsx';
import { PersonDateField } from './PersonDateField.tsx';
import { PersonConnectionCadenceSelect } from './PersonConnectionCadenceSelect.tsx';
import { StyledSelect } from './StyledSelect.tsx';
import type { StyledSelectOption } from './StyledSelect.tsx';
import { compressPersonPhoto } from './person-photo.ts';

const categoryOptions: readonly StyledSelectOption<string>[] = [
  { value: 'not-set', label: 'Not set' },
  { value: 'marriage', label: 'Marriage' },
  { value: 'parenting', label: 'Parenting' },
  { value: 'friends', label: 'Friend' }
];

const loveLanguageOptions: readonly StyledSelectOption<string>[] = [
  { value: 'not-set', label: 'Not set' },
  ...connectionStyles.map(style => ({ value: style.value, label: style.label }))
];

const relationshipOptions: readonly StyledSelectOption<string>[] = [
  { value: 'not-set', label: 'Not set' },
  ...relationshipGroups.flatMap(group => group.values.map(value => ({
    value,
    label: value,
    group: group.label
  }))),
  { value: 'custom', label: 'Custom...' }
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
  const categoryValue = (draft.categoryChanged
    ? draft.categoryIds[0]
    : resolvePersonCategory(draft.categoryIds)) ?? 'not-set';
  const currentCadence = connectionCadences.find(value => value === draft.connectionCadence) ?? null;
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
    update(
      field === 'birthdayDate' ? 'birthdayYearUnknown' : 'anniversaryYearUnknown',
      !/^\d{4}-\d{2}-\d{2}$/.test(value)
    );
  }

  function changeCategory(value: string) {
    const categoryIds: PersonPickerGroupId[] = value === 'not-set'
      ? []
      : value === 'marriage' || value === 'parenting' || value === 'friends'
        ? [value]
        : [];
    setDraft(current => ({ ...current, categoryIds, categoryChanged: true }));
    setErrors(current => {
      const { categoryIds: _categoryError, ...remaining } = current;
      return remaining;
    });
    setSaveError('');
  }

  function changeRelationship(value: string) {
    setDraft(current => ({
      ...current,
      relationshipChoice: value,
      relationshipLabel: value === 'custom'
        ? current.relationshipChoice === 'custom' ? current.relationshipLabel : ''
        : value === 'not-set' ? '' : value,
      relationshipChanged: true
    }));
    setErrors(current => {
      const { relationshipChoice: _choiceError, relationshipLabel: _labelError, ...remaining } = current;
      return remaining;
    });
    setSaveError('');
  }

  function changeRelationshipLabel(value: string) {
    setDraft(current => ({ ...current, relationshipLabel: value, relationshipChanged: true }));
    setErrors(current => {
      const { relationshipLabel: _labelError, ...remaining } = current;
      return remaining;
    });
    setSaveError('');
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
      titleId={titleId}
      labelledBy={titleId}
      dialogClassName="person-details-dialog"
      phoneFullScreen
      title={`Person settings — ${personName}`}
      intro={draft.relationshipLabel.trim() || 'Relationship not set'}
      closeLabel="Close Person settings"
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
                <button
                  type="button"
                  className="btn mini ghost"
                  disabled={!draft.photoDataUrl || photoBusy}
                  onClick={() => update('photoDataUrl', '')}
                >
                  Remove photo
                </button>
              </div>
              <p className="person-details-editor__help">Crops to a circle for their card.</p>
              {photoBusy && <p className="person-details-editor__help" role="status">Preparing photo…</p>}
              {photoError && <p className="goal-field-error" role="alert">{photoError}</p>}
              {fieldError('photoDataUrl')}
            </div>
            <div className="person-details-editor__date-grid">
              <div className="goal-field">
                <label htmlFor={`person-details-relationship-${personId}`}>Relationship</label>
                <StyledSelect
                  id={`person-details-relationship-${personId}`}
                  label="Relationship"
                  options={relationshipOptions}
                  value={draft.relationshipChoice}
                  onChange={changeRelationship}
                  describedBy={[
                    errors.relationshipChoice ? 'person-details-error-relationshipChoice' : '',
                    errors.relationshipLabel ? 'person-details-error-relationshipLabel' : ''
                  ].filter(Boolean).join(' ') || undefined}
                  invalid={Boolean(errors.relationshipChoice || errors.relationshipLabel)}
                />
                {draft.relationshipChoice === 'custom' && (
                  <input
                    className="person-details-editor__custom-relationship"
                    aria-label="Custom relationship"
                    maxLength={80}
                    value={draft.relationshipLabel}
                    onChange={event => changeRelationshipLabel(event.currentTarget.value)}
                    placeholder="Enter relationship"
                  />
                )}
                {fieldError('relationshipChoice')}
                {fieldError('relationshipLabel')}
              </div>
              <div className="goal-field">
                <label htmlFor={`person-details-category-${personId}`}>Category</label>
                <StyledSelect
                  id={`person-details-category-${personId}`}
                  label="Category"
                  options={categoryOptions}
                  value={categoryValue}
                  onChange={changeCategory}
                  describedBy={errors.categoryIds ? 'person-details-error-categoryIds' : undefined}
                  invalid={Boolean(errors.categoryIds)}
                />
                {fieldError('categoryIds')}
              </div>
            </div>
            <div className="person-details-editor__date-grid">
              <div className="goal-field">
                <label htmlFor={`person-details-birthday-${personId}`}>Birthday</label>
                <PersonDateField
                  id={`person-details-birthday-${personId}`}
                  label="Birthday"
                  value={draft.birthdayDate}
                  invalid={Boolean(errors.birthdayDate)}
                  describedBy={[
                    errors.birthdayDate ? 'person-details-error-birthdayDate' : '',
                    /^\d{2}-\d{2}$/.test(draft.birthdayDate)
                      ? `person-details-partial-birthday-${personId}`
                      : ''
                  ].filter(Boolean).join(' ') || undefined}
                  onChange={value => changeDate('birthdayDate', value)}
                />
                {/^\d{2}-\d{2}$/.test(draft.birthdayDate) && details?.birthday && (
                  <span className="person-details-editor__help" id={`person-details-partial-birthday-${personId}`}>
                    Clear the saved partial date or enter a full date to replace it.
                  </span>
                )}
                {fieldError('birthdayDate')}
              </div>
              <div className="goal-field">
                <label htmlFor={`person-details-anniversary-${personId}`}>Anniversary</label>
                <PersonDateField
                  id={`person-details-anniversary-${personId}`}
                  label="Anniversary"
                  value={draft.anniversaryDate}
                  invalid={Boolean(errors.anniversaryDate)}
                  describedBy={[
                    errors.anniversaryDate ? 'person-details-error-anniversaryDate' : '',
                    /^\d{2}-\d{2}$/.test(draft.anniversaryDate)
                      ? `person-details-partial-anniversary-${personId}`
                      : ''
                  ].filter(Boolean).join(' ') || undefined}
                  onChange={value => changeDate('anniversaryDate', value)}
                />
                {/^\d{2}-\d{2}$/.test(draft.anniversaryDate) && details?.anniversary && (
                  <span className="person-details-editor__help" id={`person-details-partial-anniversary-${personId}`}>
                    Clear the saved partial date or enter a full date to replace it.
                  </span>
                )}
                {fieldError('anniversaryDate')}
              </div>
            </div>
          </section>
          <section className="person-details-editor__section" aria-labelledby={`connection-section-${personId}`}>
            <h3 id={`connection-section-${personId}`}>Connection</h3>
            <div className="person-details-editor__date-grid">
              <div className="goal-field">
                <div className="person-details-editor__label-row">
                  <label htmlFor={`person-details-cadence-${personId}`}>Connection cadence</label>
                  <HelpPopover label="About connection cadence">
                    Daily, weekly, every two weeks, and monthly use the selected interval from your latest logged connection. Twice weekly means connecting on any two different days from Monday through Sunday; multiple connections on one day count once. Unmet weekly progress is not an overdue date.
                  </HelpPopover>
                </div>
                <PersonConnectionCadenceSelect
                  id={`person-details-cadence-${personId}`}
                  value={currentCadence}
                  onChange={value => update('connectionCadence', value ?? '')}
                />
                {fieldError('connectionCadence')}
              </div>
              <div className="goal-field">
                <label htmlFor={`person-details-style-${personId}`}>Love language</label>
                <StyledSelect
                  id={`person-details-style-${personId}`}
                  label="Love language"
                  options={loveLanguageOptions}
                  value={draft.connectionStyle || 'not-set'}
                  invalid={Boolean(errors.connectionStyle)}
                  describedBy={errors.connectionStyle ? 'person-details-error-connectionStyle' : undefined}
                  onChange={value => update('connectionStyle', value === 'not-set' ? '' : value)}
                />
                {fieldError('connectionStyle')}
              </div>
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
