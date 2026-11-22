import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { FriendshipConnection, FriendshipData } from '../domain/friendships.ts';
import type { PersonId, PersonPreview } from '../domain/preview-data.ts';
import { activePersonSparkCompletion } from '../domain/person-sparks.ts';
import type { PersonSpark, PersonSparkDraft } from '../domain/person-sparks.ts';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { PersonSparkCard } from './PersonSparkCard.tsx';
import { PersonBadgeVisual } from './PersonBadge.tsx';
import { RhythmMetadataIcon } from './RhythmMetadataIcon.tsx';

type EditorState = {
  spark: PersonSpark | null;
  draft: PersonSparkDraft;
  initialDraft: PersonSparkDraft;
};

type Confirmation =
  | { kind: 'discard' }
  | { kind: 'delete'; spark: PersonSpark }
  | { kind: 'undo'; spark: PersonSpark };

export function PersonSparkPanel({
  personId,
  people,
  sparks,
  friendships,
  onCreate,
  onUpdate,
  onArchive,
  onDelete,
  onUndo,
  onComplete,
  onPersonSelect
}: {
  personId: PersonId;
  people: readonly PersonPreview[];
  sparks: readonly PersonSpark[];
  friendships: FriendshipData;
  onCreate: (draft: PersonSparkDraft) => string | null;
  onUpdate: (sparkId: string, draft: PersonSparkDraft) => string | null;
  onArchive: (sparkId: string, archived: boolean) => string | null;
  onDelete: (sparkId: string, viewerId: PersonId) => string | null;
  onUndo: (sparkId: string) => string | null;
  onComplete: (spark: PersonSpark, opener: HTMLButtonElement) => void;
  onPersonSelect: (id: PersonId) => void;
}) {
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [error, setError] = useState('');
  const [confirmationError, setConfirmationError] = useState('');
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const archivedSummaryRef = useRef<HTMLElement>(null);
  const previousArchivedCount = useRef(0);
  const editorOpener = useRef<HTMLElement | null>(null);
  const editorWasOpen = useRef(false);
  const personSparks = sparks.filter(spark =>
    spark.ownerId === personId || spark.sharedWith.includes(personId));
  const activeSparks = personSparks.filter(spark => !spark.archived);
  const archivedSparks = personSparks.filter(spark => spark.archived);
  const titleId = `person-spark-editor-title-${personId}`;
  const confirmTitleId = `person-spark-confirm-title-${personId}`;

  useEffect(() => {
    if (editorWasOpen.current && !editor && editorOpener.current?.isConnected) {
      editorOpener.current.focus({ preventScroll: true });
    }
    editorWasOpen.current = editor !== null;
  }, [editor]);

  useEffect(() => {
    if (archivedSparks.length > previousArchivedCount.current) {
      archivedSummaryRef.current?.focus({ preventScroll: true });
    }
    previousArchivedCount.current = archivedSparks.length;
  }, [archivedSparks.length]);

  function openCreate() {
    editorOpener.current = addButtonRef.current;
    setError('');
    setEditor({
      spark: null,
      draft: { title: '', sharedWith: [] },
      initialDraft: { title: '', sharedWith: [] }
    });
  }

  function openEdit(spark: PersonSpark, opener: HTMLButtonElement) {
    const draft = draftFromSpark(spark);
    editorOpener.current = opener;
    setError('');
    setEditor({ spark, draft, initialDraft: draft });
  }

  function updateDraft(patch: Partial<PersonSparkDraft>) {
    setEditor(current => current
      ? { ...current, draft: { ...current.draft, ...patch } }
      : current);
    setError('');
  }

  function requestEditorClose() {
    if (!editor) return;
    if (!draftsEqual(editor.draft, editor.initialDraft)) {
      setConfirmation({ kind: 'discard' });
      setConfirmationError('');
    } else {
      setEditor(null);
      setError('');
    }
  }

  function saveEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    const message = editor.spark
      ? onUpdate(editor.spark.id, editor.draft)
      : onCreate(editor.draft);
    if (message) {
      setError(message);
      return;
    }
    setEditor(null);
    setError('');
  }

  function requestDelete(spark: PersonSpark) {
    setConfirmation({ kind: 'delete', spark });
    setConfirmationError('');
  }

  function requestUndo(spark: PersonSpark) {
    setConfirmation({ kind: 'undo', spark });
    setConfirmationError('');
  }

  function confirm() {
    if (!confirmation) return;
    if (confirmation.kind === 'discard') {
      setEditor(null);
      setConfirmation(null);
      setError('');
      setConfirmationError('');
      return;
    }
    const message = confirmation.kind === 'delete'
      ? onDelete(confirmation.spark.id, personId)
      : onUndo(confirmation.spark.id);
    if (message) {
      setConfirmationError(message);
      return;
    }
    if (confirmation.kind === 'delete') {
      setEditor(null);
      window.requestAnimationFrame(() => addButtonRef.current?.focus({ preventScroll: true }));
    } else if (confirmation.kind === 'undo') {
      setEditor(null);
    }
    setConfirmation(null);
    setConfirmationError('');
    setError('');
  }

  function changeArchived(spark: PersonSpark, archived: boolean) {
    const message = onArchive(spark.id, archived);
    if (message) {
      setError(message);
      return;
    }
    setEditor(null);
  }

  function renderSpark(spark: PersonSpark) {
    const owner = people.find(person => person.id === spark.ownerId);
    if (!owner) return null;
    const associatedPeople = [owner, ...spark.sharedWith
      .map(id => people.find(person => person.id === id))
      .filter((person): person is PersonPreview => person !== undefined)];
    const activeCompletion = activePersonSparkCompletion(spark);
    const linkedConnection = activeCompletion?.connectionId
      ? friendships.connections.find(connection => connection.id === activeCompletion.connectionId)
      : undefined;
    return (
      <li key={spark.id} className="person-spark-list__item">
        <PersonSparkCard
          spark={spark}
          associatedPeople={associatedPeople}
          {...(linkedConnection ? { linkedConnection } : {})}
          onComplete={onComplete}
          onEdit={openEdit}
          onPersonSelect={onPersonSelect}
        />
      </li>
    );
  }

  const confirmationTitle = confirmation?.kind === 'discard'
    ? 'Discard unsaved Spark changes?'
    : confirmation?.kind === 'undo'
      ? 'Undo this Spark completion?'
      : confirmation?.kind === 'delete'
        ? confirmation.spark.ownerId === personId
          ? 'Delete this Spark?'
          : 'Remove this Spark from this person?'
        : '';
  const confirmationMessage = confirmation?.kind === 'discard'
    ? 'Your edits have not been saved.'
    : confirmation?.kind === 'undo'
      ? 'The linked connection will be removed from every participant’s history. The Spark will return to pending and the connection will no longer count as a logged connection.'
      : confirmation?.kind === 'delete'
        ? confirmation.spark.ownerId === personId
          ? 'The Spark and its saved completion history will be deleted. Any linked connection will remain in Connections as a regular connection and continue to count there.'
          : 'This removes the Spark association from this person only. The owner, other people, and any linked connection remain unchanged.'
        : '';
  const confirmActionLabel = confirmation?.kind === 'discard'
    ? 'Discard changes'
    : confirmation?.kind === 'undo'
      ? 'Undo completion'
      : confirmation?.kind === 'delete'
        ? confirmation.spark.ownerId === personId ? 'Delete Spark' : 'Remove from person'
        : '';

  return (
    <section className="person-spark-panel" aria-labelledby={`person-sparks-heading-${personId}`}>
      <header className="person-spark-panel__heading">
        <div>
          <h3 id={`person-sparks-heading-${personId}`}>Sparks</h3>
          <p>One-off ideas for connecting someday.</p>
        </div>
        <button
          ref={addButtonRef}
          type="button"
          className="person-spark-panel__add"
          onClick={openCreate}
        >
          + Add Spark
        </button>
      </header>
      {activeSparks.length > 0 ? (
        <ul className="person-spark-list">{activeSparks.map(renderSpark)}</ul>
      ) : (
        <p className="person-spark-panel__empty">No Sparks yet.</p>
      )}
      {archivedSparks.length > 0 && (
        <details className="person-spark-panel__archived">
          <summary ref={archivedSummaryRef}>Archived Sparks ({archivedSparks.length})</summary>
          <ul className="person-spark-list">{archivedSparks.map(renderSpark)}</ul>
        </details>
      )}
      {error && !editor && <p className="person-spark-panel__error" role="alert">{error}</p>}

      {editor && (
        <MoneyGoalDialog
          title={editor.spark ? 'Spark details' : 'Add Spark'}
          titleId={titleId}
          labelledBy={titleId}
          dialogClassName="person-spark-dialog"
          phoneFullScreen
          scrollableBody
          closeLabel="Close Spark details"
          closeOnEscape
          stopEscapePropagation
          onClose={requestEditorClose}
        >
          <form className="person-spark-form" onSubmit={saveEditor}>
            <label>
              Title
              <input
                value={editor.draft.title}
                maxLength={180}
                required
                onChange={event => updateDraft({ title: event.currentTarget.value })}
              />
            </label>
            <label>
              Description (optional)
              <textarea
                value={editor.draft.description ?? ''}
                maxLength={4000}
                rows={4}
                onChange={event => updateDraft({ description: event.currentTarget.value })}
              />
            </label>
            <fieldset className="person-spark-form__people">
              <legend>Associated people</legend>
              {people.filter(person => person.id !== (editor.spark?.ownerId ?? personId)).map(person => (
                <label key={person.id}>
                  <input
                    type="checkbox"
                    checked={editor.draft.sharedWith.includes(person.id)}
                    onChange={() => updateDraft({
                      sharedWith: editor.draft.sharedWith.includes(person.id)
                        ? editor.draft.sharedWith.filter(id => id !== person.id)
                        : [...editor.draft.sharedWith, person.id]
                    })}
                  />
                  <PersonBadgeVisual person={person} />
                </label>
              ))}
            </fieldset>
            {editor.spark?.completed && (
              <div className="person-spark-form__completion">
                <strong>Completed</strong>
                <span>{formatCompletion(editor.spark)}</span>
                {linkedConnectionFor(editor.spark, friendships) && (
                  <span>
                    Logged as {linkedConnectionFor(editor.spark, friendships)!.type === 'time-together'
                      ? 'Time Together'
                      : linkedConnectionFor(editor.spark, friendships)!.type === 'call' ? 'Call' : 'Text'}.
                    This saved connection is the Spark’s only scoring record.
                  </span>
                )}
              </div>
            )}
            {error && <p className="person-spark-panel__error" role="alert">{error}</p>}
            <div className="person-spark-form__actions">
              <button type="button" className="btn mini ghost" onClick={requestEditorClose}>Cancel</button>
              <button type="submit" className="btn mini">{editor.spark ? 'Save changes' : 'Save Spark'}</button>
            </div>
            {editor.spark && (
              <>
                {!editor.spark.completed && (
                  <div className="person-spark-form__management">
                    <button
                      type="button"
                      className="btn mini ghost"
                      onClick={() => changeArchived(editor.spark!, !editor.spark!.archived)}
                    >
                      {editor.spark.archived ? 'Restore Spark' : 'Archive Spark'}
                    </button>
                  </div>
                )}
                {editor.spark.completed && (
                  <div className="person-spark-form__management">
                    <button
                      type="button"
                      className="btn mini ghost"
                      onClick={() => requestUndo(editor.spark!)}
                    >
                      Undo completion
                    </button>
                  </div>
                )}
              </>
            )}
            {editor.spark && (
              <div className="person-spark-form__delete">
                <button
                  type="button"
                  className="person-spark-form__delete-button"
                  aria-label={editor.spark.ownerId === personId
                    ? `Delete ${editor.spark.title}`
                    : `Remove ${editor.spark.title} from this person`}
                  onClick={() => requestDelete(editor.spark!)}
                >
                  <RhythmMetadataIcon kind="delete" />
                  {editor.spark.ownerId === personId ? 'Delete Spark' : 'Remove from this person'}
                </button>
              </div>
            )}
          </form>
        </MoneyGoalDialog>
      )}

      {confirmation && (
        <MoneyGoalDialog
          title={confirmationTitle}
          titleId={confirmTitleId}
          labelledBy={confirmTitleId}
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
              <button type="button" className="btn mini" onClick={confirm}>{confirmActionLabel}</button>
            </div>
          </div>
        </MoneyGoalDialog>
      )}
    </section>
  );
}

function draftFromSpark(spark: PersonSpark): PersonSparkDraft {
  return {
    title: spark.title,
    ...(spark.description !== undefined ? { description: spark.description } : {}),
    sharedWith: [...spark.sharedWith]
  };
}

function draftsEqual(first: PersonSparkDraft, second: PersonSparkDraft): boolean {
  return first.title === second.title
    && first.description === second.description
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
