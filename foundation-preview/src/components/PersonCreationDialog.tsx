import { useState } from 'react';
import type { FormEvent } from 'react';
import type { PersonPickerGroupId, PersonPreview } from '../domain/preview-data.ts';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';

const classifications: readonly { id: PersonPickerGroupId; label: string }[] = [
  { id: 'marriage', label: 'Marriage' },
  { id: 'parenting', label: 'Parenting' },
  { id: 'friends', label: 'Friends' }
];

export function PersonCreationDialog({
  existingPeople,
  onCreate,
  onClose
}: {
  existingPeople: readonly PersonPreview[];
  onCreate: (person: PersonPreview, groupIds: readonly PersonPickerGroupId[]) => string | null;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [groupIds, setGroupIds] = useState<PersonPickerGroupId[]>([]);
  const [error, setError] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const displayName = name.trim();
    if (!displayName || displayName.length > 120) {
      setError('Enter a name with no more than 120 characters.');
      return;
    }
    const id = `person-${globalThis.crypto.randomUUID()}`;
    if (existingPeople.some(person => person.id === id)) {
      setError('A person with this generated ID already exists. Try again.');
      return;
    }
    const saveError = onCreate({ id, displayName }, groupIds);
    if (saveError) {
      setError(saveError);
      return;
    }
    onClose();
  }

  return (
    <MoneyGoalDialog
      title="Add person"
      titleId="person-create-title"
      labelledBy="person-create-title"
      dialogClassName="person-details-dialog"
      initialFocusId="person-create-name"
      onClose={onClose}
    >
      <form className="person-details-editor" noValidate onSubmit={submit}>
        <div className="person-details-editor__scroll">
          <label className="goal-field" htmlFor="person-create-name">
            <span>Name</span>
            <input
              id="person-create-name"
              type="text"
              autoComplete="off"
              maxLength={120}
              required
              value={name}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'person-create-error' : undefined}
              onChange={event => {
                setName(event.currentTarget.value);
                setError('');
              }}
            />
          </label>
          <fieldset className="person-create-classifications">
            <legend>Classifications (optional)</legend>
            <p>Choose only classifications that apply. You can change them later.</p>
            <div className="person-create-classifications__choices">
              {classifications.map(classification => {
                const selected = groupIds.includes(classification.id);
                return (
                  <button
                    key={classification.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setGroupIds(current => selected
                      ? current.filter(id => id !== classification.id)
                      : [...current, classification.id])}
                  >
                    {classification.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
          {error && <p className="goal-field-error" id="person-create-error" role="alert">{error}</p>}
        </div>
        <div className="money-goal-dialog__actions">
          <button type="submit" className="btn mini">Add person</button>
          <button type="button" className="btn mini ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </MoneyGoalDialog>
  );
}
