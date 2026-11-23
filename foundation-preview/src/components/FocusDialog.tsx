import { useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';
import type { FocusData } from '../domain/focus.ts';
import type { PersonPreview, RhythmPreview } from '../domain/preview-data.ts';
import { PersonAvatar } from './PersonBadge.tsx';
import { RhythmCompletionActions } from './RhythmCompletionActions.tsx';
import { useScrollLock } from '../hooks/useScrollLock.ts';

type FocusDialogProps = {
  data: FocusData;
  people: readonly PersonPreview[];
  rhythms: readonly RhythmPreview[];
  completedRhythmIds: ReadonlySet<string>;
  onClose: () => void;
  onPersonSelect: (personId: string) => void;
  onRhythmSelect: (rhythm: RhythmPreview, event: MouseEvent<HTMLButtonElement>) => void;
  onTendRhythm: (rhythmId: string, event: MouseEvent<HTMLButtonElement>) => void;
};

export function FocusDialog({
  data,
  people,
  rhythms,
  completedRhythmIds,
  onClose,
  onPersonSelect,
  onRhythmSelect,
  onTendRhythm
}: FocusDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const tendButtonRef = useRef<HTMLButtonElement>(null);
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
  const until = data.window.nextName
    ? `until ${data.window.nextName.toLocaleLowerCase()}`
    : 'through tonight';

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
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div className="focus-dialog__surface">
        <header className="focus-head">
          <div>
            <div className="focus-eyebrow">Tend · Focus</div>
            <h2 id="focus-title" ref={titleRef} tabIndex={-1}>{data.window.name}</h2>
            <p>Just what&apos;s fixed or due, {until}.</p>
          </div>
          <button type="button" className="iconbtn focus-close" aria-label="Close Focus" onClick={onClose}>×</button>
        </header>

        <section className="focus-group" aria-labelledby="focus-coming-up">
          <div className="focus-group-head">
            <h3 id="focus-coming-up">Coming up</h3>
            <span>{data.items.length} fixed plan{data.items.length === 1 ? '' : 's'}</span>
          </div>
          {data.items.length === 0
            ? <div className="focus-empty">No fixed plans left in this window.</div>
            : (
              <div className="focus-items">
                {data.items.map(item => {
                  if (item.kind === 'calendar') {
                    return (
                      <article className="focus-item" key={item.id}>
                        <time className="focus-time">
                          {new Intl.DateTimeFormat('en-US', {
                            hour: 'numeric',
                            minute: '2-digit'
                          }).format(new Date(item.time)).replace(':00', '')}
                        </time>
                        <div className="focus-item-main">
                          <strong>{item.title}</strong>
                          <small>{item.sourceName}</small>
                        </div>
                        <div className="focus-badges">
                          <span className="focus-kind calendar">Calendar</span>
                        </div>
                      </article>
                    );
                  }

                  const rhythm = rhythmsById.get(item.rhythmId);
                  if (!rhythm) return null;
                  const peopleForRhythm = item.personIds
                    .map(personId => peopleById.get(personId))
                    .filter((person): person is PersonPreview => Boolean(person));
                  return (
                    <article className="focus-item focus-rhythm-item" key={`rhythm:${item.rhythmId}`}>
                      <time className={`focus-time${item.overdueDate ? ' focus-time--overdue' : ''}`}>
                        {item.timeLabel}
                      </time>
                      <button
                        type="button"
                        className="focus-item-main focus-rhythm-title"
                        onClick={event => onRhythmSelect(rhythm, event)}
                        aria-label={`Open details for ${rhythm.title}`}
                      >
                        <strong>{rhythm.title}</strong>
                        {rhythm.description && <small>{rhythm.description}</small>}
                      </button>
                      <div className="focus-badges">
                        {peopleForRhythm.slice(0, 2).map(person => (
                          <button
                            type="button"
                            className="focus-person-badge"
                            key={person.id}
                            onClick={() => onPersonSelect(person.id)}
                            aria-label={`Open ${person.displayName}`}
                          >
                            <span className="focus-avatar"><PersonAvatar person={person} /></span>
                            <span>{person.displayName}</span>
                          </button>
                        ))}
                      </div>
                      <RhythmCompletionActions
                        rhythmId={rhythm.id}
                        rhythmTitle={rhythm.title}
                        completed={completedRhythmIds.has(rhythm.id)}
                        onTend={event => onTendRhythm(rhythm.id, event)}
                        tendButtonRef={tendButtonRef}
                      />
                    </article>
                  );
                })}
              </div>
            )}
        </section>

        <section className="focus-group" aria-labelledby="focus-people">
          <div className="focus-group-head">
            <h3 id="focus-people">People to notice</h3>
            <span>below 75</span>
          </div>
          {data.people.length === 0
            ? <div className="focus-empty">No extra touchpoints need your attention.</div>
            : data.people.map(personNotice => {
              const person = peopleById.get(personNotice.personId);
              if (!person) return null;
              return (
                <button
                  type="button"
                  className="focus-person"
                  key={person.id}
                  onClick={() => onPersonSelect(person.id)}
                >
                  <span className="focus-avatar"><PersonAvatar person={person} /></span>
                  <span className="focus-person-main">
                    <strong>{person.displayName}</strong>
                    <small>{personNotice.recencyLabel}</small>
                  </span>
                  <span className="focus-score" aria-label={`Overall health score ${personNotice.score}`}>
                    {personNotice.score}
                  </span>
                </button>
              );
            })}
        </section>
        <footer className="focus-footer">Flexible items stay on your dashboard.</footer>
      </div>
    </dialog>
  );
}
