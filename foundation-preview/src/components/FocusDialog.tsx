import { useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';
import type { FocusBlock, FocusData } from '../domain/focus.ts';
import {
  type FoundationPreview,
  type PersonPreview,
  type RhythmPreview
} from '../domain/preview-data.ts';
import type { RhythmScoreResult } from '../domain/rhythm-scoring.ts';
import { rhythmHealthScore } from '../domain/rhythm-scoring.ts';
import { formatScore } from '../domain/score-display.ts';
import { CategoryHealthBadge } from './Cards.tsx';
import { PersonAvatar } from './PersonBadge.tsx';
import { RhythmDetailsDialog } from './RhythmDetailsDialog.tsx';
import { TendedRhythmItems } from './TendedRhythmItems.tsx';
import { TendedRhythmList } from './TendedRhythmList.tsx';
import { useScrollLock } from '../hooks/useScrollLock.ts';
import type { Destination } from './AppNavigation.tsx';

type FocusDialogProps = {
  data: FocusData;
  people: readonly PersonPreview[];
  rhythms: readonly RhythmPreview[];
  foundations: readonly FoundationPreview[];
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>;
  categoryHealthScores: ReadonlyMap<string, number | null>;
  undoableRhythmIds: ReadonlySet<string>;
  todayDate: string;
  timeZone: string;
  initializing?: boolean;
  onClose: () => void;
  onPersonSelect: (personId: string) => void;
  onOpenFoundation: (foundationId: string, openerId: string) => void;
  onOpenCategory: (categoryId: Destination, openerId: string) => void;
  onRhythmHistory: (rhythmId: string, event: MouseEvent<HTMLButtonElement>) => void;
  onEditRhythm: (rhythm: RhythmPreview, event: MouseEvent<HTMLButtonElement>) => void;
  onTendRhythm: (rhythmId: string, event: MouseEvent<HTMLButtonElement>) => void;
  onUndoRhythm: (rhythmId: string) => void;
};

function formatClockTime(instant: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(instant)).replace(':00', '');
}

export function FocusDialog({
  data,
  people,
  rhythms,
  foundations,
  rhythmScores,
  categoryHealthScores,
  undoableRhythmIds,
  todayDate,
  timeZone,
  initializing = false,
  onClose,
  onPersonSelect,
  onOpenFoundation,
  onOpenCategory,
  onRhythmHistory,
  onEditRhythm,
  onTendRhythm,
  onUndoRhythm
}: FocusDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useScrollLock(true);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  function closeFromBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  const peopleById = new Map(people.map(person => [person.id, person]));
  const rhythmsById = new Map(rhythms.map(rhythm => [rhythm.id, rhythm]));

  function renderRhythmItems(
    group: Pick<FocusBlock, 'id' | 'localDate' | 'rhythms'>,
    options: { emptyMessage?: string } = {}
  ) {
    const groupRhythms = group.rhythms
      .map(item => rhythmsById.get(item.rhythmId))
      .filter((rhythm): rhythm is RhythmPreview => Boolean(rhythm));
    if (groupRhythms.length === 0) {
      return options.emptyMessage
        ? <p className="focus-empty">{options.emptyMessage}</p>
        : null;
    }

    const tendedIds = new Set(group.rhythms.filter(item => item.completed).map(item => item.rhythmId));
    const undoableIds = group.localDate === todayDate
      ? new Set(groupRhythms
          .filter(rhythm => undoableRhythmIds.has(rhythm.id))
          .map(rhythm => rhythm.id))
      : new Set<string>();

    return (
      <TendedRhythmList
        rhythms={groupRhythms}
        tendedRhythmIds={tendedIds}
        satisfiedRhythmIds={tendedIds}
        undoableRhythmIds={undoableIds}
        onUndo={onUndoRhythm}
        resetKey={`focus:${group.localDate}:${group.id}`}
        displayMode="done-rows"
        todayDate={group.localDate}
        renderControls={false}
        initializing={initializing}
      >
        {({
            tendedRhythmIds: displayedTendedIds,
            tendedDisplayItems,
            expandedTendedRhythmIds,
            onToggleTendedRhythm,
            onUndoTendedRhythm,
            itemProps
          }) => {
          const renderRhythmCard = (rhythm: RhythmPreview) => {
            const score = rhythmHealthScore(rhythmScores.get(rhythm.id));
            return (
              <RhythmDetailsDialog
                rhythm={rhythm}
                inline
                headingId={`focus-${group.localDate}-${group.id}-${rhythm.id}`}
                people={people.filter(person => rhythm.personIds?.includes(person.id))}
                foundations={foundations}
                relatedRhythms={rhythms}
                rhythmScores={rhythmScores}
                categoryHealthScores={categoryHealthScores}
                onPersonSelect={onPersonSelect}
                onOpenFoundation={onOpenFoundation}
                onOpenCategory={onOpenCategory}
                completed={displayedTendedIds.has(rhythm.id)}
                healthScore={score}
                onTend={event => onTendRhythm(rhythm.id, event)}
                {...((rhythm.healthLogCapability || rhythm.categoryIds?.includes('health'))
                  ? {
                      completionActionLabel: 'Log',
                      completionActionAccessibleLabel: rhythm.healthLogCapability === 'cardio'
                        ? 'Log run'
                        : rhythm.healthLogCapability === 'weight'
                          ? 'Log weigh-in'
                          : rhythm.healthLogCapability === 'flexibility'
                            ? 'Start stretch routine'
                            : 'Log workout',
                      completedActionLabel: rhythm.healthLogCapability === 'weight'
                        ? 'Weighed in'
                        : rhythm.healthLogCapability === 'flexibility'
                          ? 'Stretched'
                          : 'Logged'
                    }
                  : {})}
                onHistory={event => onRhythmHistory(rhythm.id, event)}
                onEdit={event => onEditRhythm(rhythm, event)}
                {...(undoableIds.has(rhythm.id) && !rhythm.healthLogCapability
                  ? { onUndo: () => onUndoTendedRhythm(rhythm.id) }
                  : {})}
                onClose={() => undefined}
              />
            );
          };
          return (
            <TendedRhythmItems
              className="focus-rhythm-list"
              rhythms={groupRhythms}
              tendedRhythmIds={displayedTendedIds}
              displayItems={tendedDisplayItems}
              expandedRhythmIds={expandedTendedRhythmIds}
              onToggleRhythm={onToggleTendedRhythm}
              itemProps={itemProps}
              renderRhythmCard={renderRhythmCard}
              renderExpandedRhythm={item => renderRhythmCard(item.rhythm)}
            />
          );
        }}
      </TendedRhythmList>
    );
  }

  function renderTimeBlock(block: FocusBlock) {
    const blockRhythms = block.rhythms
      .map(item => rhythmsById.get(item.rhythmId))
      .filter((rhythm): rhythm is RhythmPreview => Boolean(rhythm));
    const completedCount = block.rhythms.filter(item => item.completed).length;

    return (
      <article className="focus-block" key={`${block.localDate}:${block.id}`}>
        <header className="focus-block__header">
          <div className="focus-block__copy">
            <h4>{block.name}</h4>
            <p>{block.rangeLabel}</p>
            {block.dateLabel && <span className="focus-block__date">{block.dateLabel}</span>}
          </div>
          <span className="focus-block__count">
            {completedCount} of {blockRhythms.length} tended
          </span>
        </header>

        {renderRhythmItems(block, { emptyMessage: 'No eligible Rhythms in this time block.' })}

        {block.calendarEvents.length > 0 && (
          <section className="focus-calendar" aria-label={`${block.name} Calendar plans`}>
            <h5>Calendar</h5>
            <ol>
              {block.calendarEvents.map(event => (
                <li key={event.id}>
                  <time dateTime={new Date(event.time).toISOString()}>
                    {formatClockTime(event.time, timeZone)}
                  </time>
                  <span className="focus-calendar__copy">
                    <strong>{event.title}</strong>
                    <small>{event.sourceName}</small>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </article>
    );
  }

  return (
    <dialog
      ref={dialogRef}
      className="focus-dialog"
      aria-labelledby="focus-title"
      tabIndex={-1}
      onClick={closeFromBackdrop}
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={event => {
        const target = event.target;
        if (event.key === 'Escape'
          && target instanceof Element
          && target.closest('dialog') === event.currentTarget) {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div className="focus-dialog__surface">
        <header className="focus-head">
          <div className="focus-head__copy">
            <h2 id="focus-title" ref={titleRef} tabIndex={-1}>Focus</h2>
          </div>
          <button type="button" className="iconbtn focus-close" aria-label="Close Focus" onClick={onClose}>×</button>
        </header>

        <p className="focus-intro">Now and the next two blocks. Anytime Rhythms stay on Today.</p>

        <section className="focus-horizon" aria-labelledby="focus-now-heading">
          <h3 id="focus-now-heading">Now</h3>
          {renderTimeBlock(data.blocks[0])}
        </section>

        <section className="focus-horizon" aria-labelledby="focus-coming-up">
          <h3 id="focus-coming-up">Coming up</h3>
          {data.blocks.slice(1).map(block => renderTimeBlock(block))}
        </section>

        <section className="focus-people" aria-labelledby="focus-people-heading">
          <div className="focus-section-heading">
            <h3 id="focus-people-heading">People who need attention</h3>
            <span>Health below 70</span>
          </div>
          {data.people.length === 0
            ? <p className="focus-empty">No one needs extra attention right now.</p>
            : data.people.map(personNotice => {
              const person = peopleById.get(personNotice.personId);
              if (!person) return null;
              const scoreLabel = formatScore(personNotice.score);
              return (
                <button
                  type="button"
                  className="focus-person"
                  key={person.id}
                  aria-label={`Open ${person.displayName} profile, Person Health ${scoreLabel}, ${personNotice.recencyLabel}`}
                  onClick={() => onPersonSelect(person.id)}
                >
                  <span className="focus-avatar"><PersonAvatar person={person} /></span>
                  <span className="focus-person__copy">
                    <strong>{person.displayName}</strong>
                    <small>{personNotice.recencyLabel}</small>
                  </span>
                  <CategoryHealthBadge
                    score={personNotice.score}
                    accessibleLabel={`Person Health ${scoreLabel} out of 100`}
                    className="focus-person__score"
                    appearance="rounded"
                  />
                  <span className="focus-person__chevron" aria-hidden="true">›</span>
                </button>
              );
            })}
        </section>
      </div>
    </dialog>
  );
}
