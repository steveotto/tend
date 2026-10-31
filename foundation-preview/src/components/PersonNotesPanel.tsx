import { useEffect, useRef, useState } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import { personById } from '../domain/preview-data.ts';
import type { PersonId } from '../domain/preview-data.ts';
import {
  formatPersonNoteDate,
  personNoteDraft,
  personNotesForPerson
} from '../domain/person-notes.ts';
import type { PersonNote, PersonNoteDraft } from '../domain/person-notes.ts';
import { toggleBadgeGroup } from './BadgeSelectionPicker.tsx';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { PeopleBadgeSelectionPicker } from './PeopleAssociationControls.tsx';
import { PersonBadgeVisual } from './PersonBadge.tsx';

type NoteEditorState =
  | { kind: 'new' }
  | { kind: 'edit'; note: PersonNote; expectedUpdatedAt: string };

export function PersonNotesPanel({
  personId,
  notes,
  onCreate,
  onUpdate,
  onDelete
}: {
  personId: PersonId;
  notes: readonly PersonNote[];
  onCreate: (draft: PersonNoteDraft) => string | null;
  onUpdate: (noteId: string, expectedUpdatedAt: string, actorId: PersonId, draft: PersonNoteDraft) => string | null;
  onDelete: (noteId: string, expectedUpdatedAt: string, actorId: PersonId) => string | null;
}) {
  const person = personById(personId);
  const visibleNotes = personNotesForPerson(notes, personId);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [editor, setEditor] = useState<NoteEditorState | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<PersonNote | null>(null);
  const addNoteOpener = useRef<HTMLButtonElement>(null);
  const detailOpener = useRef<HTMLButtonElement | null>(null);
  const editorOpener = useRef<HTMLElement | null>(null);
  const deleteOpener = useRef<HTMLButtonElement | null>(null);
  const wasEditorOpen = useRef(false);
  const wasDetailOpen = useRef(false);
  const wasDeleteOpen = useRef(false);
  const selectedNote = selectedNoteId === null
    ? null
    : visibleNotes.find(note => note.id === selectedNoteId) ?? null;

  useEffect(() => {
    if (editor) {
      wasEditorOpen.current = true;
      return;
    }
    if (wasEditorOpen.current) {
      wasEditorOpen.current = false;
      if (editorOpener.current?.isConnected) editorOpener.current.focus();
      else addNoteOpener.current?.focus();
    }
  }, [editor]);

  useEffect(() => {
    if (selectedNote) {
      wasDetailOpen.current = true;
      return;
    }
    if (wasDetailOpen.current) {
      wasDetailOpen.current = false;
      if (detailOpener.current?.isConnected) detailOpener.current.focus();
      else addNoteOpener.current?.focus();
    }
  }, [selectedNote]);

  useEffect(() => {
    if (deleteCandidate) {
      wasDeleteOpen.current = true;
      return;
    }
    if (wasDeleteOpen.current) {
      wasDeleteOpen.current = false;
      deleteOpener.current?.focus();
    }
  }, [deleteCandidate]);

  function openEditor(next: NoteEditorState, opener: HTMLElement) {
    editorOpener.current = opener;
    setEditor(next);
  }

  return (
    <>
      <section className="person-profile__panel marriage-view-panel" aria-labelledby={`person-notes-heading-${personId}`}>
        <div className="person-profile__section-heading">
          <h3 id={`person-notes-heading-${personId}`}>Notes ({visibleNotes.length})</h3>
          <button
            ref={addNoteOpener}
            type="button"
            className="btn mini"
            onClick={event => openEditor({ kind: 'new' }, event.currentTarget)}
          >
            Add note
          </button>
        </div>
        {visibleNotes.length === 0 ? (
          <p className="friendships-empty">No notes yet. Add a note to keep something meaningful in view.</p>
        ) : (
          <div className="person-notes-list" aria-label={`${person.displayName} notes`}>
            {visibleNotes.map(note => {
              const date = formatPersonNoteDate(note.updatedAt);
              const sharedPeople = (note.sharedWith ?? []).map(id => personById(id).displayName);
              return (
                <button
                  type="button"
                  className="person-notes-row"
                  key={note.id}
                  aria-label={`Open note updated ${date}`}
                  onClick={event => {
                    detailOpener.current = event.currentTarget;
                    setSelectedNoteId(note.id);
                  }}
                >
                  <span className="person-notes-row__preview">{note.content}</span>
                  <span className="person-notes-row__meta">
                    Updated {date}
                    {sharedPeople.length > 0 && ` · Shared with ${sharedPeople.join(', ')}`}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
      {selectedNote && (
        <PersonNoteDetailDialog
          actorId={personId}
          note={selectedNote}
          onEdit={event => openEditor(
            { kind: 'edit', note: selectedNote, expectedUpdatedAt: selectedNote.updatedAt },
            event.currentTarget
          )}
          onDelete={event => {
            deleteOpener.current = event.currentTarget;
            setDeleteCandidate(selectedNote);
          }}
          onClose={() => setSelectedNoteId(null)}
        />
      )}
      {editor && (
        <PersonNoteEditor
          actorId={personId}
          personName={person.displayName}
          {...(editor.kind === 'edit' ? { note: editor.note } : {})}
          onClose={() => setEditor(null)}
          onSave={draft => editor.kind === 'new'
            ? onCreate(draft)
            : onUpdate(editor.note.id, editor.expectedUpdatedAt, personId, draft)}
        />
      )}
      {deleteCandidate && (
        <PersonNoteDeleteDialog
          actorId={personId}
          note={deleteCandidate}
          onDelete={() => {
            const error = onDelete(deleteCandidate.id, deleteCandidate.updatedAt, personId);
            if (error) return error;
            setDeleteCandidate(null);
            setSelectedNoteId(null);
            return null;
          }}
          onClose={() => setDeleteCandidate(null)}
        />
      )}
    </>
  );
}

function PersonNoteDetailDialog({
  actorId,
  note,
  onEdit,
  onDelete,
  onClose
}: {
  actorId: PersonId;
  note: PersonNote;
  onEdit: (event: MouseEvent<HTMLButtonElement>) => void;
  onDelete: (event: MouseEvent<HTMLButtonElement>) => void;
  onClose: () => void;
}) {
  const primaryPerson = personById(note.personId);
  const sharedNames = (note.sharedWith ?? []).map(id => personById(id).displayName);
  const titleId = `person-note-title-${note.id}`;
  return (
    <MoneyGoalDialog
      titleId={titleId}
      labelledBy={titleId}
      dialogClassName="person-note-dialog"
      initialFocusId={`person-note-close-${note.id}`}
      closeButtonId={`person-note-close-${note.id}`}
      closeLabel="Close note"
      stopEscapePropagation
      onClose={onClose}
    >
      <article className="person-note-detail">
        <h2 id={titleId}>Note</h2>
        <p className="person-note-detail__meta">
          {note.personId === actorId ? `For ${primaryPerson.displayName}` : `Primary person: ${primaryPerson.displayName}`}
          {' · '}Updated {formatPersonNoteDate(note.updatedAt)}
        </p>
        {sharedNames.length > 0 && <p className="person-note-detail__meta">Shared with {sharedNames.join(', ')}</p>}
        <p className="person-note-detail__content">{note.content}</p>
        <div className="money-goal-dialog__actions">
          <button type="button" className="btn mini" onClick={onEdit}>Edit note</button>
          <button type="button" className="btn mini ghost" onClick={onDelete}>Delete note</button>
        </div>
      </article>
    </MoneyGoalDialog>
  );
}

function PersonNoteEditor({
  actorId,
  personName,
  note,
  onSave,
  onClose
}: {
  actorId: PersonId;
  personName: string;
  note?: PersonNote;
  onSave: (draft: PersonNoteDraft) => string | null;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => personNoteDraft(note));
  const [pickerDraft, setPickerDraft] = useState<PersonId[] | null>(null);
  const [error, setError] = useState('');
  const sharePeopleOpener = useRef<HTMLButtonElement>(null);
  const wasPickerOpen = useRef(false);
  const titleId = `person-note-editor-title-${note?.id ?? actorId}`;

  useEffect(() => {
    if (pickerDraft !== null) {
      wasPickerOpen.current = true;
      return;
    }
    if (wasPickerOpen.current) {
      wasPickerOpen.current = false;
      sharePeopleOpener.current?.focus();
    }
  }, [pickerDraft]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.content.trim().length === 0) {
      setError('Write something before saving this note.');
      return;
    }
    if (draft.content.length > 10_000) {
      setError('Keep the note to 10,000 characters or fewer.');
      return;
    }
    const saveError = onSave(draft);
    if (saveError) {
      setError(saveError);
      return;
    }
    onClose();
  }

  if (pickerDraft !== null) {
    return (
      <MoneyGoalDialog
        titleId={titleId}
        labelledBy={titleId}
        dialogClassName="person-note-dialog"
        stopEscapePropagation
        onClose={onClose}
      >
        <h2 id={titleId}>Share note</h2>
        <PeopleBadgeSelectionPicker
          selectedIds={pickerDraft}
          excludedIds={[note?.personId ?? actorId]}
          onToggle={id => setPickerDraft(current => current?.includes(id)
            ? current.filter(person => person !== id)
            : [...(current ?? []), id])}
          onToggleGroup={ids => setPickerDraft(current => toggleBadgeGroup(current ?? [], ids))}
          onDone={() => {
            setDraft(current => ({ ...current, sharedWith: pickerDraft }));
            setPickerDraft(null);
          }}
          onCancel={() => setPickerDraft(null)}
        />
      </MoneyGoalDialog>
    );
  }

  return (
    <MoneyGoalDialog
      titleId={titleId}
      labelledBy={titleId}
      dialogClassName="person-note-dialog"
      initialFocusId={`person-note-content-${note?.id ?? actorId}`}
      stopEscapePropagation
      onClose={onClose}
    >
      <h2 id={titleId}>{note ? 'Edit note' : `Add note for ${personName}`}</h2>
      {note && note.personId !== actorId && (
        <p className="person-note-editor__hint">Primary person: {personById(note.personId).displayName}. Ownership stays with them.</p>
      )}
      <form className="person-note-editor" noValidate onSubmit={submit}>
        <div className="goal-field">
          <label htmlFor={`person-note-content-${note?.id ?? actorId}`}>Note</label>
          <textarea
            id={`person-note-content-${note?.id ?? actorId}`}
            rows={7}
            maxLength={10_000}
            required
            value={draft.content}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `person-note-error-${note?.id ?? actorId}` : undefined}
            onChange={event => {
              const content = event.currentTarget.value;
              setDraft(current => ({ ...current, content }));
              setError('');
            }}
          />
          {error && <span className="goal-field-error" id={`person-note-error-${note?.id ?? actorId}`} role="alert">{error}</span>}
        </div>
        <div className="person-note-editor__sharing">
          <div className="person-note-editor__sharing-copy">
            <strong>Shared with</strong>
            <span>{draft.sharedWith.length > 0
              ? draft.sharedWith.map(id => personById(id).displayName).join(', ')
              : 'Only the primary person'}</span>
            {draft.sharedWith.length > 0 && (
              <span className="person-note-editor__badges">
                {draft.sharedWith.map(id => <PersonBadgeVisual key={id} person={personById(id)} />)}
              </span>
            )}
          </div>
          <button
            ref={sharePeopleOpener}
            type="button"
            className="btn mini ghost"
            onClick={() => setPickerDraft([...draft.sharedWith])}
          >
            Choose people
          </button>
        </div>
        <div className="money-goal-dialog__actions">
          <button type="submit" className="btn mini">{note ? 'Save changes' : 'Save note'}</button>
          <button type="button" className="btn mini ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </MoneyGoalDialog>
  );
}

function PersonNoteDeleteDialog({
  actorId,
  note,
  onDelete,
  onClose
}: {
  actorId: PersonId;
  note: PersonNote;
  onDelete: () => string | null;
  onClose: () => void;
}) {
  const [error, setError] = useState('');
  const isShared = (note.sharedWith?.length ?? 0) > 0;
  const titleId = `person-note-delete-title-${note.id}`;
  return (
    <MoneyGoalDialog
      titleId={titleId}
      labelledBy={titleId}
      dialogClassName="person-note-dialog"
      initialFocusId={`person-note-cancel-delete-${note.id}`}
      stopEscapePropagation
      onClose={onClose}
    >
      <h2 id={titleId}>Delete this note?</h2>
      <p>{isShared
        ? 'This removes the same note from all linked People profiles.'
        : `This permanently removes the note for ${personById(note.personId).displayName}.`}</p>
      {actorId !== note.personId && <p className="person-note-editor__hint">Primary person: {personById(note.personId).displayName}.</p>}
      {error && <p className="goal-field-error" role="alert">{error}</p>}
      <div className="money-goal-dialog__actions">
        <button id={`person-note-cancel-delete-${note.id}`} type="button" className="btn mini ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn mini" onClick={() => {
          const deleteError = onDelete();
          if (deleteError) setError(deleteError);
        }}>Delete note</button>
      </div>
    </MoneyGoalDialog>
  );
}
