import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { FriendshipData } from '../domain/friendships.ts';
import type { PersonId, PersonPickerGroup, PersonPreview } from '../domain/preview-data.ts';
import { syntheticPersonPickerGroups } from '../domain/preview-data.ts';
import type { PersonSpark, PersonSparkDraft } from '../domain/person-sparks.ts';
import {
  selectPersonSparksByStatus,
  type PersonSparkListStatus
} from '../domain/home-sparks.ts';
import { activePersonSparkCompletion } from '../domain/person-sparks.ts';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { PersonSparkCard } from './PersonSparkCard.tsx';
import { PersonSparkEditorDialog } from './PersonSparkEditorDialog.tsx';

type EditorRequest = {
  spark: PersonSpark | null;
  key: number;
};

const statuses: { id: PersonSparkListStatus; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'archived', label: 'Archived' }
];

export function SparksDialog({
  people,
  peopleGroups = syntheticPersonPickerGroups,
  sparks,
  friendships,
  today,
  initialSparkId,
  startWithAdd = false,
  onCreate,
  onUpdate,
  onArchive,
  onDelete,
  onUndo,
  onComplete,
  onPersonSelect,
  onClose
}: {
  people: readonly PersonPreview[];
  peopleGroups?: readonly PersonPickerGroup[];
  sparks: readonly PersonSpark[];
  friendships: FriendshipData;
  today: string;
  initialSparkId?: string;
  startWithAdd?: boolean;
  onCreate: (ownerId: PersonId, draft: PersonSparkDraft) => string | null;
  onUpdate: (sparkId: string, draft: PersonSparkDraft) => string | null;
  onArchive: (sparkId: string, archived: boolean) => string | null;
  onDelete: (sparkId: string, viewerId: PersonId) => string | null;
  onUndo: (sparkId: string) => string | null;
  onComplete: (spark: PersonSpark, opener: HTMLButtonElement) => void;
  onPersonSelect: (personId: PersonId) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const [status, setStatus] = useState<PersonSparkListStatus>('active');
  const [editor, setEditor] = useState<EditorRequest | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const libraryRef = useRef<HTMLElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const editorOpener = useRef<HTMLElement | null>(null);
  const editorWasOpen = useRef(false);
  const initialRequestHandled = useRef(false);
  const nextEditorKey = useRef(0);
  const currentSparks = selectPersonSparksByStatus(sparks, status);

  useEffect(() => {
    if (initialRequestHandled.current) return;
    initialRequestHandled.current = true;
    const initialSpark = initialSparkId
      ? sparks.find(spark => spark.id === initialSparkId)
      : undefined;
    if (!initialSpark && !startWithAdd) return;
    editorOpener.current = initialSparkId
      ? [...(libraryRef.current?.querySelectorAll<HTMLElement>('[data-person-spark-id]') ?? [])]
          .find(element => element.dataset.personSparkId === initialSparkId)
          ?.querySelector<HTMLElement>('.person-spark-card__disclosure') ?? null
      : addButtonRef.current;
    setEditor({ spark: initialSpark ?? null, key: ++nextEditorKey.current });
  }, [initialSparkId, sparks, startWithAdd]);

  useEffect(() => {
    if (editorWasOpen.current && !editor) {
      const returnTarget = editorOpener.current?.isConnected
        ? editorOpener.current
        : addButtonRef.current;
      returnTarget?.focus({ preventScroll: true });
    }
    editorWasOpen.current = editor !== null;
  }, [editor]);

  function openCreate() {
    editorOpener.current = addButtonRef.current;
    setEditor({ spark: null, key: ++nextEditorKey.current });
  }

  function openEdit(spark: PersonSpark, opener: HTMLButtonElement) {
    editorOpener.current = opener;
    setEditor({ spark, key: ++nextEditorKey.current });
  }

  function changeStatusFromKeyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const lastIndex = statuses.length - 1;
    const nextIndex = event.key === 'ArrowRight'
      ? (index + 1) % statuses.length
      : event.key === 'ArrowLeft'
        ? (index + lastIndex) % statuses.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? lastIndex
            : null;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = statuses[nextIndex]!;
    setStatus(next.id);
    tabRefs.current[nextIndex]?.focus();
  }

  function complete(spark: PersonSpark, opener: HTMLButtonElement) {
    onComplete(spark, opener);
  }

  function selectPerson(personId: PersonId) {
    onClose();
    onPersonSelect(personId);
  }

  function changeArchived(sparkId: string, archived: boolean) {
    const message = onArchive(sparkId, archived);
    if (!message) setStatus(archived ? 'archived' : 'active');
    return message;
  }

  function undo(sparkId: string) {
    const message = onUndo(sparkId);
    if (!message) setStatus('active');
    return message;
  }

  function viewerIdFor(spark: PersonSpark): PersonId {
    return people.find(person => person.id === spark.ownerId)?.id
      ?? spark.sharedWith.find(personId => people.some(person => person.id === personId))
      ?? people[0]?.id
      ?? spark.ownerId;
  }

  function renderSpark(spark: PersonSpark) {
    const associatedPeople = [spark.ownerId, ...spark.sharedWith]
      .map(id => people.find(person => person.id === id))
      .filter((person): person is PersonPreview => person !== undefined);
    const completion = activePersonSparkCompletion(spark);
    const linkedConnection = completion?.connectionId
      ? friendships.connections.find(connection => connection.id === completion.connectionId)
      : undefined;
    return (
      <li key={spark.id} className="person-spark-list__item" data-person-spark-id={spark.id}>
        <PersonSparkCard
          spark={spark}
          associatedPeople={associatedPeople}
          {...(linkedConnection ? { linkedConnection } : {})}
          today={today}
          onComplete={complete}
          onEdit={openEdit}
          onPersonSelect={selectPerson}
        />
      </li>
    );
  }

  return (
    <MoneyGoalDialog
      title="Sparks"
      titleId={titleId}
      labelledBy={titleId}
      intro="Your ideas for connecting."
      dialogClassName="sparks-library-dialog"
      phoneFullScreen
      scrollableBody
      closeLabel="Close Sparks"
      closeOnEscape
      stopEscapePropagation
      onClose={onClose}
    >
      <section ref={libraryRef} className="sparks-library" aria-labelledby={titleId}>
        <div className="sparks-library__toolbar">
          <div className="faith-practice-tabs sparks-library__tabs" role="tablist" aria-label="Spark status">
            {statuses.map((item, index) => {
              const count = selectPersonSparksByStatus(sparks, item.id).length;
              return (
                <button
                  key={item.id}
                  ref={element => { tabRefs.current[index] = element; }}
                  type="button"
                  role="tab"
                  id={`${titleId}-${item.id}-tab`}
                  aria-controls={`${titleId}-${item.id}-panel`}
                  aria-selected={status === item.id}
                  tabIndex={status === item.id ? 0 : -1}
                  onClick={() => setStatus(item.id)}
                  onKeyDown={event => changeStatusFromKeyboard(event, index)}
                >
                  {item.label} ({count})
                </button>
              );
            })}
          </div>
          <button
            ref={addButtonRef}
            type="button"
            className="person-spark-panel__add"
            onClick={openCreate}
            disabled={people.length === 0}
          >
            + Add Spark
          </button>
        </div>
        <div
          id={`${titleId}-${status}-panel`}
          className="sparks-library__panel"
          role="tabpanel"
          aria-labelledby={`${titleId}-${status}-tab`}
          tabIndex={0}
        >
          {currentSparks.length > 0
            ? <ul className="person-spark-list">{currentSparks.map(renderSpark)}</ul>
            : (
              <p className="sparks-library__empty">
                {status === 'active'
                  ? 'No active Sparks.'
                  : status === 'completed' ? 'No completed Sparks.' : 'No archived Sparks.'}
              </p>
            )}
        </div>
        {editor && (
          <PersonSparkEditorDialog
            key={editor.key}
            spark={editor.spark}
            {...(people[0] ? { initialOwnerId: people[0].id } : {})}
            viewerId={editor.spark ? viewerIdFor(editor.spark) : people[0]!.id}
            people={people}
            peopleGroups={peopleGroups}
            friendships={friendships}
            onCreate={onCreate}
            onUpdate={onUpdate}
            onArchive={changeArchived}
            onDelete={onDelete}
            onUndo={undo}
            onClose={() => setEditor(null)}
          />
        )}
      </section>
    </MoneyGoalDialog>
  );
}
