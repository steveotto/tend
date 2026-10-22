import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import {
  marriageFoundations,
  orderedCompletions,
  rhythmLastTendedLabel,
  type PersonId,
  type PersonPreview,
  type RhythmPreview
} from '../domain/preview-data.ts';
import { MarriageIcon } from './MarriageIcon.tsx';
import { PersonBadgeList } from './PersonBadge.tsx';
import { RhythmArchivedBadge } from './RhythmArchivedBadge.tsx';
import { RhythmMetadata } from './RhythmMetadata.tsx';
import { RhythmCompletionActions } from './RhythmCompletionActions.tsx';

type RhythmDetailsDialogProps = {
  rhythm: RhythmPreview;
  people?: readonly PersonPreview[];
  onPersonSelect?: (personId: PersonId) => void;
  completed?: boolean;
  onTend?: () => void;
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
  onTend,
  onUndo,
  onEdit,
  archived = false,
  embedded = false,
  onClose
}: RhythmDetailsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const historyBackRef = useRef<HTMLButtonElement>(null);
  const tendButtonRef = useRef<HTMLButtonElement>(null);
  const wasHistoryRef = useRef(false);
  const wasArchivedRef = useRef(archived);
  const [showHistory, setShowHistory] = useState(false);
  const completionHistory = orderedCompletions(rhythm.completionHistory);
  const foundationIds = [rhythm.primaryFoundationId, ...(rhythm.secondaryFoundationIds ?? [])]
    .filter((id): id is string => Boolean(id));
  const associatedFoundations = marriageFoundations.filter(foundation => foundationIds.includes(foundation.id));
  const hasHistoryControl = archived || rhythm.illustrativeScore !== undefined || rhythm.completionHistory !== undefined;
  const scoreDescription = rhythm.illustrativeScore == null
    ? 'unavailable'
    : String(rhythm.illustrativeScore);
  const scoreTone = rhythm.illustrativeScore == null
    ? 'neutral'
    : rhythm.illustrativeScore >= 80
      ? 'green'
      : rhythm.illustrativeScore <= 40
        ? 'red'
        : 'yellow';

  useEffect(() => {
    if (embedded) {
      titleRef.current?.focus();
      return;
    }
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    dialog.focus();
  }, [embedded]);

  useEffect(() => {
    if (showHistory) {
      historyBackRef.current?.focus();
    } else if (wasHistoryRef.current) {
      historyButtonRef.current?.focus();
    }
    wasHistoryRef.current = showHistory;
  }, [showHistory]);

  useEffect(() => {
    if (archived && !wasArchivedRef.current) closeButtonRef.current?.focus();
    wasArchivedRef.current = archived;
  }, [archived]);

  function closeFromEvent(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  const surface = (
    <div className="today-rhythm-details__surface">
        <header className="today-rhythm-details__header">
          {showHistory && (
            <button
              ref={historyBackRef}
              type="button"
              className="today-rhythm-details__back"
              onClick={() => setShowHistory(false)}
            >
              <MetadataIcon kind="back" />
              Back
            </button>
          )}
          <div className="today-rhythm-details__title-group">
            <h2 ref={titleRef} id="rhythm-details-title" tabIndex={embedded ? -1 : undefined}>{rhythm.title}</h2>
            {!embedded && onEdit && (
              <button
                type="button"
                className="today-rhythm-details__edit-icon"
                aria-label={`Edit ${rhythm.title}`}
                onClick={event => onEdit(event)}
              >
                <MetadataIcon kind="edit" />
              </button>
            )}
            {archived && <RhythmArchivedBadge />}
          </div>
          {!embedded && (
            <button
              ref={closeButtonRef}
              type="button"
              className="today-rhythm-details__close"
              aria-label="Close details"
              onClick={onClose}
            >
              ×
            </button>
          )}
        </header>

        {archived && !embedded && (
          <p className="today-rhythm-details__archived-note" role="status">
            Archived · not in active lists. This Rhythm’s identity, associations, and completion history are retained.
          </p>
        )}

        {showHistory
          ? (
            <section className="rhythm-history today-rhythm-details__history" role="region" aria-label={`Sample completion history for ${rhythm.title}`}>
              <h3>Dated history</h3>
              {rhythm.completionHistory === undefined
                ? <p>History is unavailable for this sample.</p>
                : completionHistory.length > 0
                  ? (
                    <ol>
                      {completionHistory.map(event => (
                        <li key={event.id}>{formatHistoryDate(event.effectiveDate)}</li>
                      ))}
                    </ol>
                  )
                  : <p>No sample completions recorded.</p>}
            </section>
          )
          : (
            <>
              <div className="today-rhythm-details__content">
                <div className="today-rhythm-details__summary">
                  {rhythm.description?.trim() && (
                    <p className="tend-type-description today-rhythm-details__description">{rhythm.description}</p>
                  )}
                  {people && onPersonSelect && (
                    <PersonBadgeList people={people} rhythmTitle={rhythm.title} onSelect={onPersonSelect} />
                  )}
                  {associatedFoundations.length > 0 && (
                    <div className="today-rhythm-details__foundations" role="group" aria-label="Associated categories">
                      {associatedFoundations.map(foundation => (
                        <span
                          key={foundation.id}
                          className="today-rhythm-details__foundation"
                          role="img"
                          aria-label={foundation.name}
                          title={foundation.name}
                        >
                          <MarriageIcon group="foundations" id={foundation.iconId ?? foundation.id} />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {(onTend || hasHistoryControl) && (
                  <div className="today-rhythm-details__actions">
                    {onTend && (
                      <RhythmCompletionActions
                        rhythmTitle={rhythm.title}
                        completed={completed}
                        onTend={onTend}
                        tendButtonRef={tendButtonRef}
                      />
                    )}
                    {hasHistoryControl && (
                      <button
                        ref={historyButtonRef}
                        type="button"
                        className={`today-rhythm-details__history-button ${scoreTone}`}
                        aria-label={`View history for ${rhythm.title}; illustrative score ${scoreDescription}`}
                        onClick={() => setShowHistory(true)}
                      >
                        <span aria-hidden="true">{rhythm.illustrativeScore ?? '—'}</span>
                        <MetadataIcon kind="history" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              <footer className="today-rhythm-details__footer">
                <RhythmMetadata
                  variant="footer"
                  cadence={rhythm.cadence}
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

  return (
    <dialog
      ref={dialogRef}
      className="today-rhythm-details-dialog"
      aria-labelledby="rhythm-details-title"
      tabIndex={-1}
      onClick={closeFromEvent}
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
      {surface}
    </dialog>
  );
}

function MetadataIcon({ kind }: { kind: 'back' | 'history' | 'edit' }) {
  if (kind === 'back') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19 12H5M11 18l-6-6 6-6" />
      </svg>
    );
  }
  if (kind === 'edit') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m4 16.5-.8 4.3 4.3-.8L19.8 7.7a2.2 2.2 0 0 0-3.1-3.1L4 16.5Z" />
        <path d="m14.9 6.4 3.1 3.1" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 19V5M4 19h16" />
      <path d="m7 15 4-4 3 2 5-6" />
    </svg>
  );
}

function formatHistoryDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}
