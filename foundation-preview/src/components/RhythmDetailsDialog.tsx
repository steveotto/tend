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
  onClose
}: RhythmDetailsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const historyBackRef = useRef<HTMLButtonElement>(null);
  const tendButtonRef = useRef<HTMLButtonElement>(null);
  const wasHistoryRef = useRef(false);
  const [showHistory, setShowHistory] = useState(false);
  const completionHistory = orderedCompletions(rhythm.completionHistory);
  const foundationIds = [rhythm.primaryFoundationId, ...(rhythm.secondaryFoundationIds ?? [])]
    .filter((id): id is string => Boolean(id));
  const associatedFoundations = marriageFoundations.filter(foundation => foundationIds.includes(foundation.id));
  const hasHistoryControl = rhythm.illustrativeScore !== undefined || rhythm.completionHistory !== undefined;
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
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    dialog.focus();
  }, []);

  useEffect(() => {
    if (showHistory) {
      historyBackRef.current?.focus();
    } else if (wasHistoryRef.current) {
      historyButtonRef.current?.focus();
    }
    wasHistoryRef.current = showHistory;
  }, [showHistory]);

  function closeFromEvent(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
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
          <h2 id="rhythm-details-title">{rhythm.title}</h2>
          {onEdit && (
            <button
              type="button"
              className="today-rhythm-details__edit"
              onClick={event => onEdit(event)}
            >
              Edit
            </button>
          )}
          <button
            type="button"
            className="today-rhythm-details__close"
            aria-label="Close details"
            onClick={onClose}
          >
            ×
          </button>
        </header>

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
    </dialog>
  );
}

function MetadataIcon({ kind }: { kind: 'back' | 'history' }) {
  if (kind === 'back') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19 12H5M11 18l-6-6 6-6" />
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
