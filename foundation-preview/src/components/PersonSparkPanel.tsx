import { useEffect, useRef, useState } from 'react';
import type { FriendshipData } from '../domain/friendships.ts';
import type { PersonId, PersonPickerGroup, PersonPreview } from '../domain/preview-data.ts';
import { syntheticPersonPickerGroups } from '../domain/preview-data.ts';
import { activePersonSparkCompletion } from '../domain/person-sparks.ts';
import type { PersonSpark, PersonSparkDraft } from '../domain/person-sparks.ts';
import { PersonSparkCard } from './PersonSparkCard.tsx';
import { PersonSparkEditorDialog } from './PersonSparkEditorDialog.tsx';

type EditorRequest = {
  spark: PersonSpark | null;
  key: number;
};

export function PersonSparkPanel({
  personId,
  people,
  peopleGroups = syntheticPersonPickerGroups,
  sparks,
  friendships,
  today,
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
  peopleGroups?: readonly PersonPickerGroup[];
  sparks: readonly PersonSpark[];
  friendships: FriendshipData;
  today: string;
  onCreate: (draft: PersonSparkDraft) => string | null;
  onUpdate: (sparkId: string, draft: PersonSparkDraft) => string | null;
  onArchive: (sparkId: string, archived: boolean) => string | null;
  onDelete: (sparkId: string, viewerId: PersonId) => string | null;
  onUndo: (sparkId: string) => string | null;
  onComplete: (spark: PersonSpark, opener: HTMLButtonElement) => void;
  onPersonSelect: (id: PersonId) => void;
}) {
  const [editor, setEditor] = useState<EditorRequest | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const archivedSummaryRef = useRef<HTMLElement>(null);
  const previousArchivedCount = useRef(0);
  const editorOpener = useRef<HTMLElement | null>(null);
  const editorWasOpen = useRef(false);
  const nextEditorKey = useRef(0);
  const personSparks = sparks.filter(spark =>
    spark.ownerId === personId || spark.sharedWith.includes(personId));
  const activeSparks = personSparks.filter(spark => !spark.archived);
  const archivedSparks = personSparks.filter(spark => spark.archived);

  useEffect(() => {
    if (editorWasOpen.current && !editor) {
      const returnTarget = editorOpener.current?.isConnected
        ? editorOpener.current
        : addButtonRef.current;
      returnTarget?.focus({ preventScroll: true });
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
    setEditor({ spark: null, key: ++nextEditorKey.current });
  }

  function openEdit(spark: PersonSpark, opener: HTMLButtonElement) {
    editorOpener.current = opener;
    setEditor({ spark, key: ++nextEditorKey.current });
  }

  function renderSpark(spark: PersonSpark) {
    const associatedPeople = [spark.ownerId, ...spark.sharedWith]
      .map(id => people.find(person => person.id === id))
      .filter((person): person is PersonPreview => person !== undefined);
    if (associatedPeople.length === 0) return null;
    const completion = activePersonSparkCompletion(spark);
    const linkedConnection = completion?.connectionId
      ? friendships.connections.find(connection => connection.id === completion.connectionId)
      : undefined;
    return (
      <li key={spark.id} className="person-spark-list__item">
        <PersonSparkCard
          spark={spark}
          associatedPeople={associatedPeople}
          {...(linkedConnection ? { linkedConnection } : {})}
          today={today}
          onComplete={onComplete}
          onEdit={openEdit}
          onPersonSelect={onPersonSelect}
        />
      </li>
    );
  }

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
      {editor && (
        <PersonSparkEditorDialog
          key={editor.key}
          spark={editor.spark}
          initialOwnerId={personId}
          viewerId={personId}
          people={people}
          peopleGroups={peopleGroups}
          friendships={friendships}
          onCreate={(_ownerId, draft) => onCreate(draft)}
          onUpdate={onUpdate}
          onArchive={onArchive}
          onDelete={onDelete}
          onUndo={onUndo}
          onClose={() => setEditor(null)}
        />
      )}
    </section>
  );
}
