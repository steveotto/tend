import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import type { FoundationPreview, PersonId, RhythmPreview } from '../domain/preview-data.ts';
import type { Destination } from './AppNavigation.tsx';
import { peopleForRhythm } from '../domain/preview-data.ts';
import { RhythmCard } from './Cards.tsx';
import { RhythmDetailsDialog } from './RhythmDetailsDialog.tsx';

type ArchivedRhythmsDialogProps = {
  rhythms: readonly RhythmPreview[];
  foundations?: readonly FoundationPreview[];
  completedRhythms: ReadonlySet<string>;
  onPersonSelect: (personId: PersonId) => void;
  onOpenFoundation?: (foundationId: string, openerId: string) => void;
  onOpenCategory?: (categoryId: Destination, openerId: string) => void;
  onRestore: (id: string) => void;
  onClose: () => void;
};

export function ArchivedRhythmsDialog({
  rhythms,
  foundations,
  completedRhythms,
  onPersonSelect,
  onOpenFoundation,
  onOpenCategory,
  onRestore,
  onClose
}: ArchivedRhythmsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const emptyHeadingRef = useRef<HTMLHeadingElement>(null);
  const restoreButtons = useRef(new Map<string, HTMLButtonElement>());
  const detailsOpeners = useRef(new Map<string, HTMLButtonElement>());
  const restoreIndexRef = useRef<number | null>(null);
  const wasDetailOpenRef = useRef(false);
  const lastSelectedRhythmId = useRef<string | null>(null);
  const [selectedRhythmId, setSelectedRhythmId] = useState<string | null>(null);
  const selectedRhythm = rhythms.find(rhythm => rhythm.id === selectedRhythmId) ?? null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    closeButtonRef.current?.focus();
    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
    };
  }, []);

  useEffect(() => {
    if (wasDetailOpenRef.current && selectedRhythmId === null) {
      const rhythmId = lastSelectedRhythmId.current;
      if (rhythmId) detailsOpeners.current.get(rhythmId)?.focus();
    }
    wasDetailOpenRef.current = selectedRhythmId !== null;
  }, [selectedRhythmId]);

  useEffect(() => {
    const restoredIndex = restoreIndexRef.current;
    if (restoredIndex === null) return;
    restoreIndexRef.current = null;
    if (rhythms.length === 0) {
      emptyHeadingRef.current?.focus();
      return;
    }
    const nextRhythm = rhythms[Math.min(restoredIndex, rhythms.length - 1)];
    if (nextRhythm) restoreButtons.current.get(nextRhythm.id)?.focus();
  }, [rhythms]);

  function openDetails(id: string, event: MouseEvent<HTMLButtonElement>) {
    lastSelectedRhythmId.current = id;
    detailsOpeners.current.set(id, event.currentTarget);
    setSelectedRhythmId(id);
  }

  const navigateToFoundation = onOpenFoundation
    ? (foundationId: string, openerId: string) => {
        onClose();
        onOpenFoundation(foundationId, openerId);
      }
    : undefined;
  const navigateToCategory = onOpenCategory
    ? (categoryId: Destination, openerId: string) => {
        onClose();
        onOpenCategory(categoryId, openerId);
      }
    : undefined;

  return (
    <dialog
      ref={dialogRef}
      id="archived-rhythms-dialog"
      className="archived-rhythms-dialog"
      aria-labelledby="archived-rhythms-dialog-title"
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <header className="archived-rhythms-dialog__header">
        <h2 id="archived-rhythms-dialog-title">Archived rhythms</h2>
        <button
          ref={closeButtonRef}
          type="button"
          className="today-rhythm-details__close"
          aria-label="Close archived rhythms"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="archived-rhythms-dialog__content">
        {selectedRhythm && (
          <div className="archived-rhythms-dialog__detail">
            <p className="archived-rhythms-dialog__note" role="status">
              Archived · identity and history are retained.
            </p>
            <RhythmDetailsDialog
              rhythm={selectedRhythm}
              {...(foundations ? { foundations } : {})}
              people={peopleForRhythm(selectedRhythm)}
              completed={completedRhythms.has(selectedRhythm.id)}
              archived
              embedded
              onPersonSelect={onPersonSelect}
              {...(navigateToFoundation ? { onOpenFoundation: navigateToFoundation } : {})}
              {...(navigateToCategory ? { onOpenCategory: navigateToCategory } : {})}
              onClose={onClose}
            />
            <button
              type="button"
              className="archived-rhythms-dialog__back"
              onClick={() => setSelectedRhythmId(null)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 12H5m6 6-6-6 6-6" />
              </svg>
              Back to archived rhythms
            </button>
          </div>
        )}
        <div hidden={selectedRhythm !== null}>
          {rhythms.length === 0
            ? (
              <div className="archived-rhythms-dialog__empty">
                <h3 ref={emptyHeadingRef} tabIndex={-1}>No archived Rhythms</h3>
                <p>Rhythms you archive will appear here with their history preserved.</p>
              </div>
            )
            : (
              <div className="archived-rhythms-dialog__list" aria-label="Archived Rhythms">
                {rhythms.map((rhythm, index) => (
                  <div className="archived-rhythms-dialog__item" key={rhythm.id}>
                    <RhythmCard
                      rhythm={rhythm}
                      people={peopleForRhythm(rhythm)}
                      onPersonSelect={onPersonSelect}
                      variant="simple"
                      completed={completedRhythms.has(rhythm.id)}
                      archived
                      onDetails={event => openDetails(rhythm.id, event)}
                    />
                    <button
                      ref={button => {
                        if (button) restoreButtons.current.set(rhythm.id, button);
                        else restoreButtons.current.delete(rhythm.id);
                      }}
                      type="button"
                      className="archived-rhythms-dialog__restore"
                      aria-label={`Restore rhythm ${rhythm.title}`}
                      onClick={() => {
                        restoreIndexRef.current = index;
                        onRestore(rhythm.id);
                      }}
                    >
                      Restore rhythm
                    </button>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </dialog>
  );
}
