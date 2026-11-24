import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { FriendshipConnection, FriendshipData } from '../domain/friendships.ts';
import type { PersonId, PersonPickerGroup, PersonPreview } from '../domain/preview-data.ts';
import { syntheticPersonPickerGroups } from '../domain/preview-data.ts';
import { activePersonSparkCompletion } from '../domain/person-sparks.ts';
import type { PersonSpark, PersonSparkDraft } from '../domain/person-sparks.ts';
import { PeopleAssociationRow, PeopleBadgeSelectionPicker } from './PeopleAssociationControls.tsx';
import { toggleBadgeGroup } from './BadgeSelectionPicker.tsx';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { PersonDateField } from './PersonDateField.tsx';
import { RhythmMetadataIcon } from './RhythmMetadataIcon.tsx';

type Confirmation =
  | { kind: 'discard' }
  | { kind: 'delete' }
  | { kind: 'undo' };

export function PersonSparkEditorDialog({
  spark,
  initialOwnerId,
  viewerId,
  people,
  peopleGroups = syntheticPersonPickerGroups,
  friendships,
  onCreate,
  onUpdate,
  onArchive,
  onDelete,
  onUndo,
  onClose
}: {
  spark: PersonSpark | null;
  initialOwnerId?: PersonId;
  viewerId: PersonId;
  people: readonly PersonPreview[];
  peopleGroups?: readonly PersonPickerGroup[];
  friendships: FriendshipData;
  onCreate: (ownerId: PersonId, draft: PersonSparkDraft) => string | null;
  onUpdate: (sparkId: string, draft: PersonSparkDraft) => string | null;
  onArchive: (sparkId: string, archived: boolean) => string | null;
  onDelete: (sparkId: string, viewerId: PersonId) => string | null;
  onUndo: (sparkId: string) => string | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const [draft, setDraft] = useState<PersonSparkDraft>(() => spark
    ? draftFromSpark(spark)
    : { title: '', sharedWith: [] });
  const ownerId: PersonId | '' = initialOwnerId ?? people[0]?.id ?? '';
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [peoplePickerOpen, setPeoplePickerOpen] = useState(false);
  const [peoplePickerSelection, setPeoplePickerSelection] = useState<PersonId[]>([]);
  const [error, setError] = useState('');
  const [confirmationError, setConfirmationError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const peoplePickerOpenerRef = useRef<HTMLButtonElement>(null);
  const initialDraft = spark ? draftFromSpark(spark) : { title: '', sharedWith: [] };
  const effectiveOwnerId = spark?.ownerId ?? ownerId;
  const pickerPeople = people;
  const pickerPeopleIds = new Set(pickerPeople.map(person => person.id));
  const selectedPeople = pickerPeople.filter(person =>
    person.id === effectiveOwnerId || draft.sharedWith.includes(person.id));
  const unavailableSharedIds = draft.sharedWith.filter(personId => !pickerPeopleIds.has(personId));
  const unavailablePickerIds = peoplePickerSelection.filter(personId =>
    personId !== effectiveOwnerId && !pickerPeopleIds.has(personId));
  const linkedConnection = spark ? linkedConnectionFor(spark, friendships) : undefined;

  function updateDraft(patch: Partial<PersonSparkDraft>) {
    setDraft(current => ({ ...current, ...patch }));
    setError('');
  }

  function requestClose() {
    if (!draftsEqual(draft, initialDraft)) {
      setConfirmation({ kind: 'discard' });
      setConfirmationError('');
      return;
    }
    onClose();
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    if (!effectiveOwnerId) {
      setError('Choose a person for this Spark.');
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    const message = spark
      ? onUpdate(spark.id, draft)
      : onCreate(effectiveOwnerId, draft);
    if (message) {
      submittingRef.current = false;
      setSubmitting(false);
      setError(message);
      return;
    }
    onClose();
  }

  function confirm() {
    if (!confirmation) return;
    if (confirmation.kind === 'discard') {
      setConfirmation(null);
      setConfirmationError('');
      onClose();
      return;
    }
    const message = confirmation.kind === 'delete'
      ? spark ? onDelete(spark.id, viewerId) : 'This Spark is no longer available.'
      : spark ? onUndo(spark.id) : 'This Spark is no longer available.';
    if (message) {
      setConfirmationError(message);
      return;
    }
    setConfirmation(null);
    setConfirmationError('');
    onClose();
  }

  function restore() {
    if (!spark) return;
    const message = onArchive(spark.id, false);
    if (message) {
      setError(message);
      return;
    }
    onClose();
  }

  function openPeoplePicker() {
    setPeoplePickerSelection([...new Set([effectiveOwnerId, ...draft.sharedWith])]);
    setPeoplePickerOpen(true);
  }

  function closePeoplePicker(commit: boolean) {
    if (commit) {
      updateDraft({ sharedWith: peoplePickerSelection.filter(id => id !== effectiveOwnerId) });
    }
    setPeoplePickerOpen(false);
  }

  function togglePerson(personId: PersonId) {
    setPeoplePickerSelection(current => current.includes(personId)
      ? current.filter(id => id !== personId)
      : [...current, personId]);
  }

  function togglePeopleGroup(personIds: readonly PersonId[]) {
    setPeoplePickerSelection(current => toggleBadgeGroup(
      current,
      personIds.filter(id => id !== effectiveOwnerId)
    ));
  }

  const confirmationTitle = confirmation?.kind === 'discard'
    ? 'Discard unsaved Spark changes?'
    : confirmation?.kind === 'undo'
      ? 'Undo this Spark completion?'
      : confirmation?.kind === 'delete'
        ? spark?.ownerId === viewerId
          ? `Delete "${spark?.title ?? 'this Spark'}"?`
          : `Remove "${spark?.title ?? 'this Spark'}" from this person?`
        : '';
  const confirmationMessage = confirmation?.kind === 'discard'
    ? 'Your edits have not been saved.'
    : confirmation?.kind === 'undo'
      ? 'The linked connection will be removed from every participant’s history. The Spark will return to pending and the connection will no longer count as a logged connection.'
      : confirmation?.kind === 'delete'
        ? spark?.ownerId === viewerId
          ? 'The Spark and its saved completion history will be deleted. Any linked connection will remain in Connections as a regular connection and continue to count there.'
          : 'This removes the Spark association from this person only. The owner, other people, and any linked connection remain unchanged.'
        : '';
  const confirmationActionLabel = confirmation?.kind === 'discard'
    ? 'Discard changes'
    : confirmation?.kind === 'undo'
      ? 'Undo completion'
      : confirmation?.kind === 'delete'
        ? spark?.ownerId === viewerId ? 'Delete Spark' : 'Remove from person'
        : '';

  return (
    <>
      <MoneyGoalDialog
        title={spark ? 'Edit Spark' : 'Add Spark'}
        titleId={titleId}
        labelledBy={titleId}
        dialogClassName="person-spark-dialog"
        phoneFullScreen
        scrollableBody
        closeLabel={spark ? 'Close Edit Spark' : 'Close Add Spark'}
        closeOnEscape
        stopEscapePropagation
        onClose={requestClose}
      >
        <form className="person-spark-form" onSubmit={save}>
          <div className="person-spark-form__fields">
            <div className="goal-field person-spark-form__field">
              <label htmlFor={`person-spark-title-${titleId}`}>Title</label>
              <input
                id={`person-spark-title-${titleId}`}
                value={draft.title}
                maxLength={180}
                required
                onChange={event => updateDraft({ title: event.currentTarget.value })}
              />
            </div>
            <div className="goal-field person-spark-form__field">
              <label htmlFor={`person-spark-description-${titleId}`}>Description (optional)</label>
              <textarea
                id={`person-spark-description-${titleId}`}
                value={draft.description ?? ''}
                maxLength={4000}
                rows={4}
                onChange={event => updateDraft({ description: event.currentTarget.value })}
              />
            </div>
            <div className="goal-field person-spark-form__field">
              <label htmlFor={`person-spark-due-date-${titleId}`}>Due date (optional)</label>
            <PersonDateField
              id={`person-spark-due-date-${titleId}`}
              label="Due date"
              value={draft.dueDate ?? ''}
              onChange={value => {
                if (value) updateDraft({ dueDate: value });
                else {
                  setDraft(current => {
                    const { dueDate: _dueDate, ...rest } = current;
                    return rest;
                  });
                  setError('');
                }
              }}
              inputClassName="person-spark-form__date"
            />
              <span className="person-spark-form__hint">Leave blank for Someday.</span>
            </div>
          </div>
          {spark && !people.some(person => person.id === spark.ownerId) && (
            <p className="person-spark-form__hint">The Spark’s owner is hidden by current availability settings.</p>
          )}
          <PeopleAssociationRow
            selectedPeople={selectedPeople}
            unavailableIds={unavailableSharedIds}
            openerRef={peoplePickerOpenerRef}
            onChoose={openPeoplePicker}
          />
          {spark?.completed && (
            <div className="person-spark-form__completion">
              <strong>Completed</strong>
              <span>{formatCompletion(spark)}</span>
              {linkedConnection && (
                <span>
                  Logged as {connectionTypeLabel(linkedConnection)}.
                  This saved connection is the Spark’s only scoring record.
                </span>
              )}
            </div>
          )}
          {error && <p className="person-spark-panel__error" role="alert">{error}</p>}
          {spark && (
            <div className="person-spark-form__secondary-actions">
              {spark.archived && (
                <button type="button" className="btn mini ghost" onClick={restore}>
                  Restore Spark
                </button>
              )}
              {spark.completed && (
                <button
                  type="button"
                  className="btn mini ghost"
                  onClick={() => setConfirmation({ kind: 'undo' })}
                >
                  Undo completion
                </button>
              )}
              <button
                type="button"
                className="friendships-connection-delete__button person-spark-form__delete-button"
                onClick={() => setConfirmation({ kind: 'delete' })}
              >
                <RhythmMetadataIcon kind="delete" />
                Delete Spark
              </button>
            </div>
          )}
          <div className="money-goal-dialog__actions person-spark-form__actions">
            <button type="button" className="btn mini ghost" onClick={requestClose}>Cancel</button>
            <button type="submit" className="btn mini" disabled={submitting}>
              {spark ? 'Save changes' : 'Create Spark'}
            </button>
          </div>
        </form>
      </MoneyGoalDialog>
      {peoplePickerOpen && (
        <MoneyGoalDialog
          title="Choose people"
          titleId={`${titleId}-people-title`}
          labelledBy={`${titleId}-people-title`}
          initialFocusId="rhythm-association-picker-title"
          dialogClassName="money-goal-dialog--association-picker money-goal-dialog--people-picker"
          phoneFullScreen
          scrollableBody
          closeLabel="Close people picker"
          closeOnEscape
          stopEscapePropagation
          portalToBody
          onClose={() => closePeoplePicker(false)}
        >
          <PeopleBadgeSelectionPicker
            people={pickerPeople}
            selectedIds={peoplePickerSelection}
            unavailableSelectedIds={unavailablePickerIds}
            fixedSelectedIds={effectiveOwnerId ? [effectiveOwnerId] : []}
            groups={peopleGroups}
            onToggle={togglePerson}
            onToggleGroup={togglePeopleGroup}
            onDone={() => closePeoplePicker(true)}
            onCancel={() => closePeoplePicker(false)}
          />
        </MoneyGoalDialog>
      )}
      {confirmation && (
        <MoneyGoalDialog
          title={confirmationTitle}
          titleId={`${titleId}-confirmation`}
          labelledBy={`${titleId}-confirmation`}
          dialogClassName="person-spark-dialog person-spark-dialog--confirm"
          phoneFullScreen
          scrollableBody
          closeLabel="Close confirmation"
          closeOnEscape
          stopEscapePropagation
          onClose={() => {
            setConfirmation(null);
            setConfirmationError('');
          }}
        >
          <div className="person-spark-confirm">
            <p>{confirmationMessage}</p>
            {confirmationError && <p className="person-spark-panel__error" role="alert">{confirmationError}</p>}
            <div className="person-spark-form__actions">
              <button
                type="button"
                className="btn mini ghost"
                onClick={() => {
                  setConfirmation(null);
                  setConfirmationError('');
                }}
              >
                Cancel
              </button>
              <button type="button" className="btn mini" onClick={confirm}>{confirmationActionLabel}</button>
            </div>
          </div>
        </MoneyGoalDialog>
      )}
    </>
  );
}

function draftFromSpark(spark: PersonSpark): PersonSparkDraft {
  return {
    title: spark.title,
    ...(spark.description !== undefined ? { description: spark.description } : {}),
    ...(spark.dueDate !== undefined ? { dueDate: spark.dueDate } : {}),
    sharedWith: [...spark.sharedWith]
  };
}

function draftsEqual(first: PersonSparkDraft, second: PersonSparkDraft): boolean {
  return first.title === second.title
    && first.description === second.description
    && first.dueDate === second.dueDate
    && first.sharedWith.length === second.sharedWith.length
    && first.sharedWith.every((id, index) => id === second.sharedWith[index]);
}

function formatCompletion(spark: PersonSpark): string {
  const completion = [...spark.completionHistory].reverse().find(item => item.undone !== true);
  if (!completion) return 'Date not recorded';
  if (completion.completedAt) {
    return new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
      .format(new Date(completion.completedAt));
  }
  if (!completion.date) return 'Date not recorded';
  const [year, month, day] = completion.date.split('-').map(Number);
  return new Date(year!, month! - 1, day!, 12).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

function linkedConnectionFor(
  spark: PersonSpark,
  friendships: FriendshipData
): FriendshipConnection | undefined {
  const completion = activePersonSparkCompletion(spark);
  return completion?.connectionId
    ? friendships.connections.find(connection => connection.id === completion.connectionId)
    : undefined;
}

function connectionTypeLabel(connection: FriendshipConnection): string {
  if (connection.type === 'spark') return 'Spark';
  if (connection.type === 'rhythm') return 'Rhythm';
  if (connection.type === 'time-together') return 'Time Together';
  return connection.type === 'call' ? 'Call' : 'Text';
}
