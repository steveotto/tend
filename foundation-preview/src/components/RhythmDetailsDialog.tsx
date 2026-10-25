import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import {
  rhythmLastTendedLabel,
  type PersonId,
  type PersonPreview,
  type RhythmPreview
} from '../domain/preview-data.ts';
import { PersonBadgeList } from './PersonBadge.tsx';
import { RhythmArchivedBadge } from './RhythmArchivedBadge.tsx';
import { RhythmPersonalBadge } from './RhythmPersonalBadge.tsx';
import { RhythmMetadata } from './RhythmMetadata.tsx';
import { RhythmCompletionActions } from './RhythmCompletionActions.tsx';
import { RhythmHistoryView } from './RhythmHistoryView.tsx';
import { RhythmCompletionForm } from './RhythmCompletionForm.tsx';
import type { DatedRhythmCompletion, RhythmCompletionRecord } from '../domain/rhythm-completion.ts';
import { RhythmMetadataIcon } from './RhythmMetadataIcon.tsx';
import { RhythmCategoryBadges } from './RhythmCategoryBadges.tsx';

type RhythmDetailsDialogProps = {
  rhythm: RhythmPreview;
  inline?: boolean;
  initialView?: 'details' | 'history';
  onTend?: (event: MouseEvent<HTMLButtonElement>) => void;
  onHistory?: (event: MouseEvent<HTMLButtonElement>) => void;
  headingId?: string;
  people?: readonly PersonPreview[];
  onPersonSelect?: (personId: PersonId) => void;
  completed?: boolean;
  datedCompletions?: readonly DatedRhythmCompletion[];
  completionHistoryAvailable?: boolean;
  onSaveCompletion?: (record: RhythmCompletionRecord) => string | null;
  onLogCompletion?: (record: RhythmCompletionRecord) => string | null;
  onUpdateCompletion?: (record: RhythmCompletionRecord) => string | null;
  onDeleteCompletion?: (completionId: string) => string | null;
  onUndo?: () => void;
  onEdit?: (event: MouseEvent<HTMLButtonElement>) => void;
  archived?: boolean;
  embedded?: boolean;
  onClose: () => void;
};

export function RhythmDetailsDialog({
  rhythm,
  people,
  onPersonSelect,
  completed = false,
  datedCompletions = [],
  completionHistoryAvailable = false,
  onSaveCompletion,
  onLogCompletion,
  onUpdateCompletion,
  onDeleteCompletion,
  onUndo,
  onEdit,
  archived = false,
  embedded = false,
  inline = false,
  initialView = 'details',
  onTend,
  onHistory,
  headingId,
  onClose
}: RhythmDetailsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const tendButtonRef = useRef<HTMLButtonElement>(null);
  const wasCompletionRef = useRef(false);
  const wasArchivedRef = useRef(archived);
  const [showHistory, setShowHistory] = useState(initialView === 'history');
  const [showCompletion, setShowCompletion] = useState(false);
  const titleId = headingId ?? (inline ? `today-rhythm-${rhythm.id}-title` : 'rhythm-details-title');
  useEffect(() => {
    if (inline) return;
    if (embedded) {
      titleRef.current?.focus();
      return;
    }
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    dialog.focus();
  }, [embedded, inline]);

  useEffect(() => {
    if (!showCompletion && wasCompletionRef.current) {
      if (completed) closeButtonRef.current?.focus();
      else tendButtonRef.current?.focus();
    }
    wasCompletionRef.current = showCompletion;
  }, [showCompletion, completed]);

  function closeCompletion() {
    setShowCompletion(false);
  }

  useEffect(() => {
    if (archived && !wasArchivedRef.current) closeButtonRef.current?.focus();
    wasArchivedRef.current = archived;
  }, [archived]);

  function closeFromEvent(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  const hasSummaryContent = Boolean(rhythm.description?.trim())
    || Boolean(people?.length && onPersonSelect)
    || Boolean(rhythm.categoryIds?.length);
  const hasPeople = Boolean(people?.length && onPersonSelect);
  const hasCategories = Boolean(rhythm.categoryIds?.length);

  const detailsActions = (
    <div className="today-rhythm-details__actions">
      {((inline && onTend) || (!inline && onSaveCompletion)) && !archived && (
        <RhythmCompletionActions
          rhythmTitle={rhythm.title}
          completed={completed}
          onTend={inline ? onTend! : () => setShowCompletion(true)}
          tendButtonRef={tendButtonRef}
        />
      )}
      <button
        type="button"
        className="today-rhythm-details__history-button"
        aria-label={`View scores and history for ${rhythm.title}`}
        onClick={inline ? event => onHistory?.(event) : () => setShowHistory(true)}
      >
        <RhythmMetadataIcon kind="history" />
      </button>
    </div>
  );

  const surface = (
    <div className={`today-rhythm-details__surface${showCompletion ? ' today-rhythm-details__surface--completion' : ''}`}>
        {!showHistory && (
        <header className={`today-rhythm-details__header${showCompletion ? ' today-rhythm-details__header--completion' : ''}`}>
          {!showHistory && !showCompletion && (
            <div className="today-rhythm-details__title-group">
              {inline
                ? <h3 ref={titleRef} id={titleId}>{rhythm.title}</h3>
                : <h2 ref={titleRef} id={titleId} tabIndex={embedded ? -1 : undefined}>{rhythm.title}</h2>}
              {(!embedded || inline) && onEdit && (
                <button
                  type="button"
                  className="today-rhythm-details__edit-icon"
                  aria-label={`Edit ${rhythm.title}`}
                  onClick={event => onEdit(event)}
                >
                  <span className="today-rhythm-details__edit-visual" aria-hidden="true">
                    <RhythmMetadataIcon kind="edit" />
                  </span>
                </button>
              )}
              {archived && <RhythmArchivedBadge />}
              {rhythm.personal && <RhythmPersonalBadge />}
            </div>
          )}
          {inline && !showCompletion && detailsActions}
          {!embedded && !inline && (
            <button
              ref={closeButtonRef}
              type="button"
              className={`today-rhythm-details__close${showCompletion ? ' today-rhythm-details__close--completion' : ''}`}
              aria-label={showCompletion ? 'Close completion' : 'Close details'}
              onClick={showCompletion ? closeCompletion : onClose}
            >
              ×
            </button>
          )}
        </header>
        )}

        {archived && !embedded && !inline && !showHistory && (
          <p className="today-rhythm-details__archived-note" role="status">
            Archived · not in active lists. This Rhythm’s identity, associations, and completion history are retained.
          </p>
        )}

        {showCompletion && onSaveCompletion
          ? (
            <RhythmCompletionForm
              rhythm={rhythm}
              embedded
              dialogLayout
              headingId="rhythm-details-title"
              onSave={record => {
                return onSaveCompletion(record);
              }}
              onCancel={closeCompletion}
              onSaved={onClose}
            />
          )
          : showHistory
          ? (
            <RhythmHistoryView
              rhythm={rhythm}
              datedCompletions={datedCompletions}
              completionHistoryAvailable={completionHistoryAvailable}
              {...(onUpdateCompletion ? { onUpdateCompletion } : {})}
              {...(onDeleteCompletion ? { onDeleteCompletion } : {})}
              {...(onLogCompletion ? { onSaveCompletion: onLogCompletion } : {})}
              {...(people ? { people } : {})}
              {...(onPersonSelect ? { onPersonSelect } : {})}
              onClose={onClose}
              closeButtonRef={closeButtonRef}
              archived={archived}
            />
          )
          : (
            <>
              <div className="today-rhythm-details__content">
                {(!inline || hasSummaryContent) && (
                  <div className="today-rhythm-details__summary">
                    {rhythm.description?.trim() && (
                      <p className="tend-type-description today-rhythm-details__description">{rhythm.description}</p>
                    )}
                    {inline
                      ? (hasPeople || hasCategories) && (
                        <div
                          className="today-rhythm-details__association-row"
                          role="group"
                          aria-label={`Associations for ${rhythm.title}`}
                        >
                          {hasPeople && people && onPersonSelect && (
                            <PersonBadgeList
                              people={people}
                              rhythmTitle={rhythm.title}
                              onSelect={onPersonSelect}
                              collapsedLimit={2}
                              itemsOnly
                            />
                          )}
                          {hasCategories && <RhythmCategoryBadges rhythm={rhythm} itemsOnly />}
                        </div>
                      )
                      : (
                        <>
                          {people && onPersonSelect && (
                            <PersonBadgeList people={people} rhythmTitle={rhythm.title} onSelect={onPersonSelect} />
                          )}
                          <RhythmCategoryBadges rhythm={rhythm} />
                        </>
                      )}
                  </div>
                )}
                {!inline && detailsActions}
              </div>
              <footer className="today-rhythm-details__footer">
                <RhythmMetadata
                  variant="footer"
                  cadence={rhythm.cadence}
                  schedule={rhythm.schedule}
                  timeLabel={rhythm.timeLabel}
                  lastTended={rhythmLastTendedLabel(rhythm, completed)}
                  rhythmTitle={rhythm.title}
                  completed={completed}
                  onUndo={onUndo}
                  tendButtonRef={tendButtonRef}
                />
              </footer>
            </>
          )}
    </div>
  );

  if (embedded) {
    return (
      <section
        className="today-rhythm-details-dialog today-rhythm-details-dialog--embedded"
        aria-labelledby="rhythm-details-title"
        role="region"
      >
        {surface}
      </section>
    );
  }

  if (inline) {
    return (
      <article
        className="today-rhythm-details-dialog today-rhythm-details-dialog--inline"
        aria-labelledby={titleId}
      >
        {surface}
      </article>
    );
  }

  return (
    <dialog
      ref={dialogRef}
      className={`today-rhythm-details-dialog${showHistory ? ' today-rhythm-details-dialog--history' : ''}`}
      aria-labelledby="rhythm-details-title"
      tabIndex={-1}
      onClick={closeFromEvent}
      onCancel={event => {
        event.preventDefault();
        if (showCompletion) closeCompletion();
        else onClose();
      }}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          if (showCompletion) closeCompletion();
          else onClose();
        }
      }}
    >
      {surface}
    </dialog>
  );
}
