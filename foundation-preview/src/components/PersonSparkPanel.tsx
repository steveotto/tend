import { useEffect, useRef, useState } from 'react';
import type { FriendshipData } from '../domain/friendships.ts';
import type { PersonId, PersonPickerGroup, PersonPreview } from '../domain/preview-data.ts';
import { syntheticPersonPickerGroups } from '../domain/preview-data.ts';
import {
  activePersonSparkCompletion,
  personSparksForPerson,
  selectOpenPersonSparks
} from '../domain/person-sparks.ts';
import type { PersonSpark, PersonSparkDraft } from '../domain/person-sparks.ts';
import { selectPersonSparksByStatus } from '../domain/home-sparks.ts';
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
  onPersonSelect,
  allItems = false,
  allItemsEntry = false
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
  allItems?: boolean;
  allItemsEntry?: boolean;
}) {
  const [editor, setEditor] = useState<EditorRequest | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const archivedSummaryRef = useRef<HTMLElement>(null);
  const previousArchivedCount = useRef(0);
  const editorOpener = useRef<HTMLElement | null>(null);
  const editorWasOpen = useRef(false);
  const nextEditorKey = useRef(0);
  const personSparks = allItems ? sparks : personSparksForPerson(sparks, personId);
  const activeSparks = selectOpenPersonSparks(personSparks);
  const archivedSparks = selectPersonSparksByStatus(personSparks, 'archived');

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
    if (associatedPeople.length === 0 && !allItems) return null;
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
    <section
      className={`person-spark-panel${allItems ? ' person-spark-panel--all-items' : ''}${allItemsEntry ? ' person-spark-panel--all-items-entry' : ''}`}
      {...(allItems
        ? allItemsEntry ? {} : { 'aria-label': 'Sparks' }
        : { 'aria-labelledby': `person-sparks-heading-${personId}` })}
    >
      {!allItems && (
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
      )}
      {allItems ? (
        <ul className="person-spark-list">{personSparks.map(renderSpark)}</ul>
      ) : activeSparks.length > 0 ? (
        <ul className="person-spark-list">{activeSparks.map(renderSpark)}</ul>
      ) : (
        <p className="person-spark-panel__empty">
          {personSparks.length > 0 ? 'No open Sparks yet.' : 'No Sparks yet.'}
        </p>
      )}
      {!allItems && archivedSparks.length > 0 && (
        <details className="person-spark-panel__archived">
          <summary ref={archivedSummaryRef}>Archived Sparks ({archivedSparks.length})</summary>
          <ul className="person-spark-list">{archivedSparks.map(renderSpark)}</ul>
        </details>
      )}
      {editor && (
        <PersonSparkEditorDialog
          key={editor.key}
          spark={editor.spark}
          initialOwnerId={editor.spark?.ownerId ?? personId}
          viewerId={allItems ? editor.spark?.ownerId ?? personId : personId}
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
