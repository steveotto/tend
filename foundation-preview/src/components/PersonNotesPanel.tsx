import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent, MouseEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { personById, syntheticPeople } from '../domain/preview-data.ts';
import type { PersonId, PersonPickerGroup, PersonPreview } from '../domain/preview-data.ts';
import {
  formatPersonNoteDate,
  personNoteDraft,
  personNotesForPerson
} from '../domain/person-notes.ts';
import type { PersonNote, PersonNoteDraft } from '../domain/person-notes.ts';
import { toggleBadgeGroup } from './BadgeSelectionPicker.tsx';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { PeopleAssociationRow, PeopleBadgeSelectionPicker } from './PeopleAssociationControls.tsx';
import { PersonBadge } from './PersonBadge.tsx';
import { useScrollLock } from '../hooks/useScrollLock.ts';

type NoteEditorState =
  | { kind: 'new' }
  | { kind: 'edit'; note: PersonNote; expectedUpdatedAt: string };

type PendingNoteHandoff =
  | { kind: 'new'; personId: PersonId }
  | { kind: 'edit'; personId: PersonId; noteId: string }
  | { kind: 'detail'; personId: PersonId; noteId: string };

export function PersonNotesIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
      <path d="M5 2.75h8.5L16 5.2v12.05H5z" />
      <path d="M13.5 2.75V5.5H16M8 9h5M8 12h5M8 15h3" />
    </svg>
  );
}

function otherPeopleForNote(
  note: PersonNote,
  actorId: PersonId,
  people: readonly PersonPreview[]
): PersonPreview[] {
  const seen = new Set<PersonId>();
  return [note.personId, ...(note.sharedWith ?? [])].flatMap(id => {
    if (id === actorId || seen.has(id)) return [];
    seen.add(id);
    return [personById(people, id)];
  });
}

export function PersonNotesPanel({
  personId,
  people = syntheticPeople,
  peopleGroups,
  notes,
  canEdit,
  onCreate,
  onUpdate,
  onDelete,
  drawerOpen,
  drawerId,
  openerRef,
  onDrawerClose,
  onDrawerOpen
}: {
  personId: PersonId;
  people?: readonly PersonPreview[];
  peopleGroups: readonly PersonPickerGroup[];
  notes: readonly PersonNote[];
  canEdit: boolean;
  onCreate: (draft: PersonNoteDraft) => string | null;
  onUpdate: (noteId: string, expectedUpdatedAt: string, actorId: PersonId, draft: PersonNoteDraft) => string | null;
  onDelete: (noteId: string, expectedUpdatedAt: string, actorId: PersonId) => string | null;
  drawerOpen: boolean;
  drawerId: string;
  openerRef: RefObject<HTMLButtonElement | null>;
  onDrawerClose: () => void;
  onDrawerOpen: () => void;
}) {
  const person = personById(people, personId);
  const visibleNotes = personNotesForPerson(notes, personId);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [editor, setEditor] = useState<NoteEditorState | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<PersonNote | null>(null);
  const [pendingHandoff, setPendingHandoff] = useState<PendingNoteHandoff | null>(null);
  const addNoteOpener = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const drawerCloseButton = useRef<HTMLButtonElement>(null);
  const previousPersonId = useRef(personId);
  const detailOpener = useRef<HTMLButtonElement | null>(null);
  const editorOpener = useRef<HTMLElement | null>(null);
  const deleteOpener = useRef<HTMLButtonElement | null>(null);
  const skipDrawerFocusRestore = useRef(false);
  const dragStartY = useRef<number | null>(null);
  const dragStartedOnHandle = useRef(false);
  const wasEditorOpen = useRef(false);
  const wasDetailOpen = useRef(false);
  const wasDeleteOpen = useRef(false);
  const selectedNote = selectedNoteId === null
    ? null
    : visibleNotes.find(note => note.id === selectedNoteId) ?? null;

  useScrollLock(drawerOpen);

  useLayoutEffect(() => {
    if (previousPersonId.current === personId) return;
    previousPersonId.current = personId;
    setSelectedNoteId(null);
    setEditor(null);
    setDeleteCandidate(null);
    setPendingHandoff(null);
  }, [personId]);

  useLayoutEffect(() => {
    const dialog = drawerRef.current;
    if (!dialog) return;
    if (drawerOpen) {
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
      }
      drawerCloseButton.current?.focus({ preventScroll: true });
    } else if (dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
      if (!skipDrawerFocusRestore.current) {
        openerRef.current?.focus({ preventScroll: true });
      }
      skipDrawerFocusRestore.current = false;
    }
  }, [drawerOpen, openerRef]);

  useLayoutEffect(() => {
    const dialog = drawerRef.current;
    return () => {
      if (!dialog?.open) return;
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    };
  }, []);

  useEffect(() => {
    if (drawerOpen || !pendingHandoff) return;
    if (pendingHandoff.personId !== personId) {
      setPendingHandoff(null);
      return;
    }
    if (pendingHandoff.kind === 'new') {
      setEditor({ kind: 'new' });
    } else if (pendingHandoff.kind === 'edit') {
      const note = visibleNotes.find(item => item.id === pendingHandoff.noteId);
      if (note) {
        setEditor({ kind: 'edit', note, expectedUpdatedAt: note.updatedAt });
      } else {
        onDrawerOpen();
      }
    } else if (visibleNotes.some(note => note.id === pendingHandoff.noteId)) {
      setSelectedNoteId(pendingHandoff.noteId);
    } else {
      onDrawerOpen();
    }
    setPendingHandoff(null);
  }, [drawerOpen, onDrawerOpen, pendingHandoff, personId, visibleNotes]);

  useEffect(() => {
    if (editor) {
      wasEditorOpen.current = true;
      return;
    }
    if (wasEditorOpen.current) {
      wasEditorOpen.current = false;
      const returnToDetail = selectedNoteId
        ? document.getElementById(`person-note-edit-${selectedNoteId}`)
        : null;
      if (editorOpener.current?.isConnected) editorOpener.current.focus({ preventScroll: true });
      else if (returnToDetail instanceof HTMLElement) returnToDetail.focus({ preventScroll: true });
      else addNoteOpener.current?.focus({ preventScroll: true });
    }
  }, [editor, selectedNoteId]);

  useEffect(() => {
    if (selectedNote) {
      wasDetailOpen.current = true;
      return;
    }
    if (wasDetailOpen.current) {
      wasDetailOpen.current = false;
      onDrawerOpen();
      if (detailOpener.current?.isConnected) detailOpener.current.focus({ preventScroll: true });
      else addNoteOpener.current?.focus({ preventScroll: true });
    }
  }, [onDrawerOpen, selectedNote]);

  useEffect(() => {
    if (deleteCandidate) {
      wasDeleteOpen.current = true;
      return;
    }
    if (wasDeleteOpen.current) {
      wasDeleteOpen.current = false;
      if (deleteOpener.current?.isConnected) deleteOpener.current.focus({ preventScroll: true });
      else if (selectedNoteId) {
        document.getElementById(`person-note-delete-${selectedNoteId}`)?.focus({ preventScroll: true });
      } else {
        addNoteOpener.current?.focus({ preventScroll: true });
      }
    }
  }, [deleteCandidate, selectedNoteId]);

  function openEditor(next: NoteEditorState, opener: HTMLElement) {
    editorOpener.current = opener;
    setEditor(next);
  }

  function beginDrag(event: ReactPointerEvent<HTMLElement>) {
    if (event.target instanceof Element
      && event.target.closest('button')
      && !event.target.closest('[data-notes-drag-handle]')) return;
    dragStartY.current = event.clientY;
    dragStartedOnHandle.current = event.target instanceof Element
      && event.target.closest('[data-notes-drag-handle]') !== null;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function endDrag(event: ReactPointerEvent<HTMLElement>) {
    const startY = dragStartY.current;
    dragStartY.current = null;
    const startedOnHandle = dragStartedOnHandle.current;
    dragStartedOnHandle.current = false;
    if (startY !== null
      && (event.clientY - startY >= 72
        || (startedOnHandle && Math.abs(event.clientY - startY) <= 8))) onDrawerClose();
  }

  return (
    <>
      <dialog
        ref={drawerRef}
        id={drawerId}
        className="person-notes-drawer"
        aria-modal="true"
        aria-labelledby={`person-notes-drawer-title-${personId}`}
        onCancel={event => {
          event.preventDefault();
          onDrawerClose();
        }}
        onClick={event => {
          if (event.target === event.currentTarget) onDrawerClose();
        }}
      >
        <div className="person-notes-drawer__surface">
          <div
            className="person-notes-drawer__drag-region"
            onPointerDown={beginDrag}
            onPointerUp={endDrag}
            onPointerCancel={() => {
              dragStartY.current = null;
              dragStartedOnHandle.current = false;
            }}
          >
            <button
              type="button"
              className="person-notes-drawer__handle"
              data-notes-drag-handle
              aria-label="Collapse notes drawer"
              onClick={onDrawerClose}
            >
              <span className="person-notes-drawer__handle-visual" aria-hidden="true" />
            </button>
            <header className="person-notes-drawer__header">
              <h2 id={`person-notes-drawer-title-${personId}`}>
                <PersonNotesIcon />
                <span>Notes</span>
              </h2>
              <div className="person-notes-drawer__header-actions">
                <button
                  ref={addNoteOpener}
                  type="button"
                  className="person-notes-drawer__add"
                  onClick={event => {
                    editorOpener.current = event.currentTarget;
                    skipDrawerFocusRestore.current = true;
                    setPendingHandoff({ kind: 'new', personId });
                    onDrawerClose();
                  }}
                >
                  + Add note
                </button>
                <button
                  ref={drawerCloseButton}
                  type="button"
                  className="person-notes-drawer__close"
                  aria-label="Close notes"
                  onClick={onDrawerClose}
                >
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
                    <path d="m5 8 5 5 5-5" />
                  </svg>
                </button>
              </div>
            </header>
          </div>
          <div
            className="person-notes-drawer__scroll-region"
            role="region"
            aria-label={`${person.displayName} notes`}
            tabIndex={0}
          >
            {visibleNotes.length === 0 ? (
              <p className="friendships-empty">No notes yet. Add a note to keep something meaningful in view.</p>
            ) : (
              <div className="person-notes-list">
                {visibleNotes.map(note => {
                  const date = formatPersonNoteDate(note.updatedAt);
                  const sharedPeople = otherPeopleForNote(note, personId, people);
                  return (
                    <article
                      className="person-notes-row"
                      key={note.id}
                      aria-label={`Note updated ${date}`}
                    >
                      <button
                        type="button"
                        className="person-notes-row__open"
                        aria-label={`Open note updated ${date}`}
                        onClick={event => {
                          detailOpener.current = event.currentTarget;
                          skipDrawerFocusRestore.current = true;
                          setPendingHandoff({ kind: 'detail', personId, noteId: note.id });
                          onDrawerClose();
                        }}
                      >
                        <span className="person-notes-row__preview">{note.content}</span>
                        <span className="person-notes-row__meta">
                          <time className="person-notes-row__date" dateTime={note.updatedAt}>{date}</time>
                        </span>
                        {sharedPeople.length > 0 && (
                          <span
                            className="person-notes-row__people"
                            role="group"
                            aria-label="Other people associated with this note"
                          >
                            {sharedPeople.map((sharedPerson, index) => (
                              <PersonBadge
                                key={`${sharedPerson.id}-${index}`}
                                person={sharedPerson}
                                presentation="static"
                              />
                            ))}
                          </span>
                        )}
                      </button>
                      {canEdit && (
                        <button
                          id={`person-note-card-edit-${note.id}`}
                          type="button"
                          className="person-notes-row__edit"
                          aria-label={`Edit note updated ${date}`}
                          onClick={event => {
                            editorOpener.current = event.currentTarget;
                            skipDrawerFocusRestore.current = true;
                            setPendingHandoff({ kind: 'edit', personId, noteId: note.id });
                            onDrawerClose();
                          }}
                        >
                          <span className="person-notes-row__edit-visual" aria-hidden="true">
                            <svg viewBox="0 0 20 20" fill="none" focusable="false">
                              <path d="m12.9 3.1 4 4M4 16l3.5-.7L16 6.8a1.7 1.7 0 0 0-2.4-2.4L5.1 13 4 16Z" />
                            </svg>
                          </span>
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
          <p className="person-notes-drawer__total">
            {visibleNotes.length} {visibleNotes.length === 1 ? 'note' : 'notes'} total
          </p>
        </div>
      </dialog>
      {selectedNote && !editor && !deleteCandidate && (
        <PersonNoteDetailDialog
          actorId={personId}
          people={people}
          note={selectedNote}
          canEdit={canEdit}
          onEdit={event => openEditor(
            { kind: 'edit', note: selectedNote, expectedUpdatedAt: selectedNote.updatedAt },
            event.currentTarget
          )}
          onDelete={event => {
            deleteOpener.current = event.currentTarget;
            setDeleteCandidate(selectedNote);
          }}
          onClose={() => {
            setSelectedNoteId(null);
            onDrawerOpen();
          }}
        />
      )}
      {editor && (
        <PersonNoteEditor
          actorId={personId}
          people={people}
          peopleGroups={peopleGroups}
          personName={person.displayName}
          {...(editor.kind === 'edit' ? { note: editor.note } : {})}
          onClose={() => {
            setEditor(null);
            if (selectedNoteId === null) onDrawerOpen();
          }}
          onSave={draft => editor.kind === 'new'
            ? onCreate(draft)
            : onUpdate(editor.note.id, editor.expectedUpdatedAt, personId, draft)}
        />
      )}
      {deleteCandidate && (
        <PersonNoteDeleteDialog
          actorId={personId}
          people={people}
          note={deleteCandidate}
          onDelete={() => {
            const error = onDelete(deleteCandidate.id, deleteCandidate.updatedAt, personId);
            if (error) return error;
            setDeleteCandidate(null);
            setSelectedNoteId(null);
            onDrawerOpen();
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
  people,
  note,
  canEdit,
  onEdit,
  onDelete,
  onClose
}: {
  actorId: PersonId;
  people: readonly PersonPreview[];
  note: PersonNote;
  canEdit: boolean;
  onEdit: (event: MouseEvent<HTMLButtonElement>) => void;
  onDelete: (event: MouseEvent<HTMLButtonElement>) => void;
  onClose: () => void;
}) {
  const primaryPerson = personById(people, note.personId);
  const otherPeople = otherPeopleForNote(note, actorId, people);
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
        {otherPeople.length > 0 && (
          <div className="person-note-detail__people" role="group" aria-label="Other people associated with this note">
            {otherPeople.map((otherPerson, index) => (
              <PersonBadge
                key={`${otherPerson.id}-${index}`}
                person={otherPerson}
                presentation="static"
              />
            ))}
          </div>
        )}
        <p className="person-note-detail__content">{note.content}</p>
        <div className="money-goal-dialog__actions">
          {canEdit && (
            <button
              id={`person-note-edit-${note.id}`}
              type="button"
              className="btn mini"
              onClick={onEdit}
            >
              Edit note
            </button>
          )}
          <button
            id={`person-note-delete-${note.id}`}
            type="button"
            className="btn mini ghost"
            onClick={onDelete}
          >
            Delete note
          </button>
        </div>
      </article>
    </MoneyGoalDialog>
  );
}

function PersonNoteEditor({
  actorId,
  people,
  peopleGroups,
  personName,
  note,
  onSave,
  onClose
}: {
  actorId: PersonId;
  people: readonly PersonPreview[];
  peopleGroups: readonly PersonPickerGroup[];
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
  const ownerId = note?.personId ?? actorId;
  const selectedAssociationIds = [ownerId, ...draft.sharedWith];
  const selectedPeople = selectedAssociationIds.map(id => personById(people, id));

  useEffect(() => {
    if (pickerDraft !== null) {
      wasPickerOpen.current = true;
      return;
    }
    if (wasPickerOpen.current) {
      wasPickerOpen.current = false;
      sharePeopleOpener.current?.focus({ preventScroll: true });
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
          people={people}
          groups={peopleGroups}
          selectedIds={pickerDraft}
          fixedSelectedIds={[ownerId]}
          onToggle={id => {
            if (id === ownerId) return;
            setPickerDraft(current => current?.includes(id)
              ? current.filter(person => person !== id)
              : [...(current ?? []), id]);
          }}
          onToggleGroup={ids => setPickerDraft(current => {
            const toggled = toggleBadgeGroup(current ?? [], ids);
            return toggled.includes(ownerId) ? toggled : [ownerId, ...toggled];
          })}
          onDone={() => {
            setDraft(current => ({
              ...current,
              sharedWith: pickerDraft.filter(id => id !== ownerId)
            }));
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
        <p className="person-note-editor__hint">Primary person: {personById(people, note.personId).displayName}. Ownership stays with them.</p>
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
        <PeopleAssociationRow
          selectedPeople={selectedPeople}
          openerRef={sharePeopleOpener}
          onChoose={() => setPickerDraft([...selectedAssociationIds])}
        />
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
  people,
  note,
  onDelete,
  onClose
}: {
  actorId: PersonId;
  people: readonly PersonPreview[];
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
        : `This permanently removes the note for ${personById(people, note.personId).displayName}.`}</p>
      {actorId !== note.personId && <p className="person-note-editor__hint">Primary person: {personById(people, note.personId).displayName}.</p>}
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
