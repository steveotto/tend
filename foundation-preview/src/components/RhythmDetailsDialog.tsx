import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import {
  areas,
  rhythmLastActivityLabel,
  type FoundationPreview,
  type PersonId,
  type PersonPreview,
  type RhythmPreview
} from '../domain/preview-data.ts';
import { localDateInTimeZone } from '../domain/rhythm-occurrences.ts';
import { RhythmArchivedBadge } from './RhythmArchivedBadge.tsx';
import { RhythmPersonalBadge } from './RhythmPersonalBadge.tsx';
import { RhythmMetadata } from './RhythmMetadata.tsx';
import { RhythmCompletionActions } from './RhythmCompletionActions.tsx';
import { RhythmHistoryView } from './RhythmHistoryView.tsx';
import { RhythmCompletionForm } from './RhythmCompletionForm.tsx';
import type { DatedRhythmCompletion, RhythmCompletionRecord } from '../domain/rhythm-completion.ts';
import type { RhythmSeasonEditDraft } from '../domain/rhythm-season-edit.ts';
import type { RhythmSeasonDeletionUndo } from '../domain/rhythm-season-delete.ts';
import { RhythmMetadataIcon } from './RhythmMetadataIcon.tsx';
import { formatScore } from '../domain/score-display.ts';
import { foundationRhythmIds } from '../domain/foundation-rhythm-associations.ts';
import type { Destination } from './AppNavigation.tsx';
import { RhythmAssociationRows } from './RhythmAssociationRows.tsx';
import { rhythmTimeLabel } from '../domain/rhythm-schedule.ts';
import { useRhythmTimeOptions } from './TimeBlocksContext.tsx';
import { scoreTone } from '../domain/score-tone.ts';
import type { RhythmScoreResult } from '../domain/rhythm-scoring.ts';
import type { StrengthMode } from '../domain/strength.ts';

type RhythmDetailsDialogProps = {
  rhythm: RhythmPreview;
  healthScore?: number | null;
  healthWorkoutSetting?: { mode: StrengthMode; workoutName?: string };
  inline?: boolean;
  initialView?: 'details' | 'history';
  statusLabel?: string;
  completionActionLabel?: string;
  completionActionAccessibleLabel?: string;
  completedActionLabel?: string;
  onTend?: (event: MouseEvent<HTMLButtonElement>) => void;
  onHistory?: (event: MouseEvent<HTMLButtonElement>) => void;
  headingId?: string;
  people?: readonly PersonPreview[];
  foundations?: readonly FoundationPreview[];
  relatedRhythms?: readonly RhythmPreview[];
  rhythmScores?: ReadonlyMap<string, RhythmScoreResult>;
  categoryHealthScores?: ReadonlyMap<string, number | null>;
  archivedRhythmIds?: readonly string[];
  onPersonSelect?: (personId: PersonId) => void;
  onOpenFoundation?: (foundationId: string, openerId: string) => void;
  onOpenCategory?: (categoryId: Destination, openerId: string) => void;
  completed?: boolean;
  datedCompletions?: readonly DatedRhythmCompletion[];
  completionHistoryAvailable?: boolean;
  onSaveCompletion?: (record: RhythmCompletionRecord) => string | null;
  onLogCompletion?: (record: RhythmCompletionRecord) => string | null;
  onUpdateCompletion?: (record: RhythmCompletionRecord) => string | null;
  onDeleteCompletion?: (completionId: string) => string | null;
  onEditSeason?: (rhythmId: string, draft: RhythmSeasonEditDraft) => string | null;
  onDeleteSeason?: (rhythmId: string, seasonId: string) => string | null;
  seasonDeletionUndo?: RhythmSeasonDeletionUndo | null;
  onUndoSeasonDeletion?: () => string | null;
  seasonRangeUndo?: { rhythmId: string } | null;
  onUndoSeasonRange?: () => string | null;
  onUndo?: () => void;
  onEdit?: (event: MouseEvent<HTMLButtonElement>) => void;
  archived?: boolean;
  embedded?: boolean;
  onClose: () => void;
};

export function RhythmDetailsDialog({
  rhythm,
  healthScore = null,
  healthWorkoutSetting,
  people,
  foundations,
  relatedRhythms,
  rhythmScores,
  categoryHealthScores,
  archivedRhythmIds,
  onPersonSelect,
  onOpenFoundation,
  onOpenCategory,
  completed = false,
  datedCompletions = [],
  completionHistoryAvailable = false,
  onSaveCompletion,
  onLogCompletion,
  onUpdateCompletion,
  onDeleteCompletion,
  onEditSeason,
  onDeleteSeason,
  seasonDeletionUndo,
  onUndoSeasonDeletion,
  seasonRangeUndo,
  onUndoSeasonRange,
  onUndo,
  onEdit,
  archived = false,
  embedded = false,
  inline = false,
  initialView = 'details',
  statusLabel,
  completionActionLabel,
  completionActionAccessibleLabel,
  completedActionLabel,
  onTend,
  onHistory,
  headingId,
  onClose
}: RhythmDetailsDialogProps) {
  const timeOptions = useRhythmTimeOptions();
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
      titleRef.current?.focus({ preventScroll: true });
      return;
    }
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    dialog.focus({ preventScroll: true });
  }, [embedded, inline]);

  useEffect(() => {
    if (!showCompletion && wasCompletionRef.current) {
      if (completed) closeButtonRef.current?.focus({ preventScroll: true });
      else tendButtonRef.current?.focus({ preventScroll: true });
    }
    wasCompletionRef.current = showCompletion;
  }, [showCompletion, completed]);

  function closeCompletion() {
    setShowCompletion(false);
  }

  useEffect(() => {
    if (archived && !wasArchivedRef.current) closeButtonRef.current?.focus({ preventScroll: true });
    wasArchivedRef.current = archived;
  }, [archived]);

  function closeFromEvent(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  const hasPeople = Boolean(people?.length && onPersonSelect);
  const hasCategories = Boolean(rhythm.categoryIds?.some(id => areas.some(area => area.id === id)));
  const hasFoundationLinks = Boolean(!inline && foundations && foundationRhythmIds(rhythm).length);
  const scoringTimeZone = rhythm.scoring?.timeZone
    ?? rhythm.createdTimeZone
    ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const asOfDate = localDateInTimeZone(new Date(), scoringTimeZone);
  const timeLabel = rhythm.timeOfDay
    ? rhythmTimeLabel(rhythm.timeOfDay, timeOptions)
    : rhythm.timeLabel;

  const completionAction = ((inline && onTend) || (!inline && (onSaveCompletion || onTend))) && !archived
    ? (
      <RhythmCompletionActions
        rhythmTitle={rhythm.title}
        completed={completed}
        actionLabel={completionActionLabel}
        actionAccessibleLabel={completionActionAccessibleLabel}
        completedLabel={completedActionLabel}
        onTend={inline || onTend ? onTend! : () => setShowCompletion(true)}
        tendButtonRef={tendButtonRef}
      />
    )
    : null;
  const hasAssociations = hasPeople || hasCategories || hasFoundationLinks;
  const historyAction = (
    <button
      type="button"
      className="today-rhythm-details__history-button"
      data-score-tone={inline ? scoreTone(healthScore) : undefined}
      aria-label={inline
        ? `View scores and history for ${rhythm.title}, Health ${healthScore === null
          ? 'unavailable'
          : `${formatScore(healthScore)} out of 100`}`
        : `View scores and history for ${rhythm.title}`}
      onClick={inline ? event => onHistory?.(event) : () => setShowHistory(true)}
    >
      <span className="today-rhythm-details__history-content">
        <RhythmMetadataIcon kind="history" />
        {inline && <span className="today-rhythm-details__history-score">{formatScore(healthScore)}</span>}
      </span>
    </button>
  );
  const detailsActions = inline
    ? completionAction && (
      <div className={`today-rhythm-details__actions today-rhythm-details__actions--inline${
        hasAssociations ? ' today-rhythm-details__actions--inline-with-associations' : ''
      }`}>
        {completionAction}
      </div>
    )
    : (
      <div className="today-rhythm-details__actions">
        {completionAction}
        {historyAction}
      </div>
    );
  const editButton = (!embedded || inline) && onEdit && (
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
  );
  const hasInlineDescription = Boolean(rhythm.description?.trim());

  const surface = (
    <div className={`today-rhythm-details__surface${showCompletion ? ' today-rhythm-details__surface--completion' : ''}`}>
        {!showHistory && (
        <header className={`today-rhythm-details__header${showCompletion ? ' today-rhythm-details__header--completion' : ''}`}>
          {!showHistory && !showCompletion && (
            <div className="today-rhythm-details__title-group">
              {inline
                ? (
                  <div className="today-rhythm-details__title-copy">
                    <div className="today-rhythm-details__title-score-row">
                      <h3 ref={titleRef} id={titleId}>{rhythm.title}</h3>
                      {historyAction}
                    </div>
                    {hasInlineDescription && (
                      <p className="today-rhythm-details__description">{rhythm.description}</p>
                    )}
                  </div>
                )
                : <h2 ref={titleRef} id={titleId} tabIndex={embedded ? -1 : undefined}>{rhythm.title}</h2>}
              {!inline && editButton}
              {archived && <RhythmArchivedBadge />}
              {rhythm.personal && <RhythmPersonalBadge />}
              {!inline && rhythm.healthLogCapability === 'cardio' && rhythm.healthRunTarget && (
                <p className="today-rhythm-details__activity-target">
                  Run target · {rhythm.healthRunTarget.distance} {rhythm.healthRunTarget.unit}
                </p>
              )}
            </div>
          )}
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

        <div className={`today-rhythm-details__body${showHistory ? ' today-rhythm-details__body--history' : ''}`}>
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
                {...(healthWorkoutSetting ? { healthWorkoutSetting } : {})}
                datedCompletions={datedCompletions}
                completionHistoryAvailable={completionHistoryAvailable}
                {...(onUpdateCompletion ? { onUpdateCompletion } : {})}
                {...(onDeleteCompletion ? { onDeleteCompletion } : {})}
                {...(onEditSeason ? { onEditSeason } : {})}
                {...(onDeleteSeason ? { onDeleteSeason } : {})}
                {...(seasonDeletionUndo !== undefined ? { seasonDeletionUndo } : {})}
                {...(onUndoSeasonDeletion ? { onUndoSeasonDeletion } : {})}
                {...(seasonRangeUndo !== undefined ? { seasonRangeUndo } : {})}
                {...(onUndoSeasonRange ? { onUndoSeasonRange } : {})}
                {...(onLogCompletion ? { onSaveCompletion: onLogCompletion } : {})}
                {...(onEdit ? { onChooseSchedule: onEdit } : {})}
                {...(onEdit ? { onEditRhythm: onEdit } : {})}
                {...(people ? { people } : {})}
                {...(onPersonSelect ? { onPersonSelect } : {})}
                {...(onOpenCategory ? { onOpenCategory } : {})}
                {...(foundations ? { foundations } : {})}
                {...(relatedRhythms ? { relatedRhythms } : {})}
                {...(rhythmScores ? { rhythmScores } : {})}
                {...(categoryHealthScores ? { categoryHealthScores } : {})}
                {...(archivedRhythmIds ? { archivedRhythmIds } : {})}
                {...(onOpenFoundation ? { onOpenFoundation } : {})}
                onClose={onClose}
                closeButtonRef={closeButtonRef}
                archived={archived}
              />
            )
            : (
              <>
                <div
                  className={`today-rhythm-details__content${inline ? ' today-rhythm-details__content--inline' : ''}`}
                >
                  {inline ? (
                    <>
                      {rhythm.healthLogCapability === 'cardio' && rhythm.healthRunTarget && (
                        <p className="today-rhythm-details__activity-target">
                          Run target · {rhythm.healthRunTarget.distance} {rhythm.healthRunTarget.unit}
                        </p>
                      )}
                      {hasAssociations && (
                        <div
                          className="today-rhythm-details__association-row"
                          role="group"
                          aria-label={`Associations for ${rhythm.title}`}
                        >
                          <RhythmAssociationRows
                            rhythm={rhythm}
                            {...(hasPeople && people ? { people } : {})}
                            {...(foundations ? { foundations } : {})}
                            {...(onPersonSelect ? { onPersonSelect } : {})}
                            {...(onOpenCategory ? { onOpenCategory } : {})}
                            {...(onOpenFoundation ? { onOpenFoundation } : {})}
                            showFoundationLinks={!inline}
                          />
                        </div>
                      )}
                      {!showCompletion && detailsActions}
                    </>
                  ) : (
                    <>
                      <div className="today-rhythm-details__summary">
                        {rhythm.description?.trim() && (
                          <p className="tend-type-description today-rhythm-details__description">{rhythm.description}</p>
                        )}
                        <RhythmAssociationRows
                          rhythm={rhythm}
                          {...(people ? { people } : {})}
                          {...(foundations ? { foundations } : {})}
                          {...(onPersonSelect ? { onPersonSelect } : {})}
                          {...(onOpenCategory ? { onOpenCategory } : {})}
                          {...(onOpenFoundation ? { onOpenFoundation } : {})}
                          showFoundationLinks={!inline}
                        />
                      </div>
                      {detailsActions}
                    </>
                  )}
                </div>
                <footer className="today-rhythm-details__footer">
                  <RhythmMetadata
                    variant="footer"
                    cadence={rhythm.cadence}
                    schedule={rhythm.schedule}
                    timeLabel={timeLabel}
                    lastTended={statusLabel ?? rhythmLastActivityLabel(rhythm, asOfDate)}
                    rhythmTitle={rhythm.title}
                    completed={completed}
                    onUndo={onUndo}
                    tendButtonRef={tendButtonRef}
                  />
                </footer>
              </>
            )}
        </div>
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
      className={`today-rhythm-details-dialog dialog--phone-fullscreen${showHistory ? ' today-rhythm-details-dialog--history' : ''}`}
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
