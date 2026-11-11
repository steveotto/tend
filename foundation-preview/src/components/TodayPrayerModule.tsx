import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
import type { PersonPrayerRequest } from '../domain/person-prayers.ts';
import type {
  PersonId,
  PersonPickerGroup,
  PersonPreview
} from '../domain/preview-data.ts';
import { SELF_PREVIEW_PERSON } from '../domain/preview-data.ts';
import type { TimeBlockSettings } from '../domain/time-blocks.ts';
import {
  createPrayerSession,
  endPrayerSession,
  markPrayerSessionPrayed,
  movePrayerSession,
  prayerFrequencyLabel,
  prayerTimeOfDayLabel,
  prayerTimeframeOptions,
  selectActivePrayerRequests,
  togglePrayerSelectionGroup
} from '../domain/prayer-session.ts';
import type { PrayerSession, PrayerTimeframeId } from '../domain/prayer-session.ts';
import { PersonAvatar } from './PersonBadge.tsx';
import { useScrollLock } from '../hooks/useScrollLock.ts';

type TodayPrayerModuleProps = {
  people: readonly PersonPreview[];
  peopleGroups: readonly PersonPickerGroup[];
  requests: readonly PersonPrayerRequest[];
  evaluationInstant: Date;
  timeZone?: string;
  timeBlocks: TimeBlockSettings;
  onPray: (
    requestId: string,
    expectedUpdatedAt: string,
    actorId: PersonId,
    prayedById?: PersonId
  ) => string | null;
};

type SelectionDraft = {
  people: PersonId[];
  timeframe: PrayerTimeframeId;
  showingTimeframes: boolean;
};

export function TodayPrayerModule({
  people,
  peopleGroups,
  requests,
  evaluationInstant,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  timeBlocks,
  onPray
}: TodayPrayerModuleProps) {
  const [selectedPeople, setSelectedPeople] = useState<PersonId[]>(() => people.map(person => person.id));
  const [timeframe, setTimeframe] = useState<PrayerTimeframeId>('now');
  const [selection, setSelection] = useState<SelectionDraft | null>(null);
  const [session, setSession] = useState<PrayerSession | null>(null);
  const [sessionError, setSessionError] = useState('');
  const sessionCardRef = useRef<HTMLElement>(null);
  const activeRequests = useMemo(() => selectActivePrayerRequests(
    requests,
    selectedPeople,
    timeframe,
    evaluationInstant,
    timeBlocks,
    timeZone
  ), [requests, selectedPeople, timeframe, evaluationInstant, timeBlocks, timeZone]);
  const timeframeOptions = useMemo(
    () => prayerTimeframeOptions(requests, selectedPeople, evaluationInstant, timeBlocks, timeZone),
    [requests, selectedPeople, evaluationInstant, timeBlocks, timeZone]
  );
  const selectedTimeframeName = timeframeOptions.find(option => option.id === timeframe)?.label
    ?? 'Now';

  useEffect(() => {
    if (!session) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (event.altKey || event.ctrlKey || event.metaKey
        || target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(target.tagName)) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        setSession(current => current ? movePrayerSession(current, direction) : current);
        setSessionError('');
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        setSession(current => current ? endPrayerSession(current) : current);
      }
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [session !== null]);

  function openSelection() {
    setSelection({ people: [...selectedPeople], timeframe, showingTimeframes: false });
  }

  function togglePerson(personId: PersonId) {
    setSelection(current => {
      if (!current) return current;
      return {
        ...current,
        people: current.people.includes(personId)
          ? current.people.filter(id => id !== personId)
          : [...current.people, personId]
      };
    });
  }

  function selectedRequests(draft: SelectionDraft) {
    return selectActivePrayerRequests(
      requests,
      draft.people,
      draft.timeframe,
      evaluationInstant,
      timeBlocks,
      timeZone
    );
  }

  function startSession(draft: SelectionDraft) {
    const nextSession = createPrayerSession(selectedRequests(draft));
    if (!nextSession) return;
    setSelectedPeople([...draft.people]);
    setTimeframe(draft.timeframe);
    setSelection(null);
    setSessionError('');
    setSession(nextSession);
  }

  function startCurrentSession() {
    startSession({ people: selectedPeople, timeframe, showingTimeframes: false });
  }

  function markCurrentPrayed() {
    if (!session) return;
    const requestId = session.requestIds[session.index];
    const request = requests.find(item => item.id === requestId);
    if (!request || session.prayedIds.includes(request.id)) return;
    const prayedById = selectedPeople.includes(SELF_PREVIEW_PERSON.id)
      ? SELF_PREVIEW_PERSON.id
      : request.personId;
    const error = onPray(request.id, request.updatedAt, request.personId, prayedById);
    if (error) {
      setSessionError(error);
      return;
    }
    setSession(current => current ? markPrayerSessionPrayed(current, request.id) : current);
    setSessionError('');
  }

  const draftRequests = selection ? selectedRequests(selection) : [];
  const draftTimeframeOptions = prayerTimeframeOptions(
    requests,
    selection?.people ?? [],
    evaluationInstant,
    timeBlocks,
    timeZone
  );
  const selectedDraftTimeframe = selection
    ? draftTimeframeOptions.find(option => option.id === selection.timeframe)
    : undefined;
  const currentRequestId = session?.requestIds[session.index];
  const currentRequest = currentRequestId
    ? requests.find(request => request.id === currentRequestId)
    : undefined;
  const sessionComplete = session !== null
    && (session.ended || session.index >= session.requestIds.length);
  useLayoutEffect(() => {
    if (!session) return;
    if (session.ended || session.index >= session.requestIds.length) {
      document.getElementById('faithSessionTitle')?.focus({ preventScroll: true });
    } else {
      sessionCardRef.current?.focus({ preventScroll: true });
    }
  }, [session?.index, session?.ended]);
  const currentPerson = currentRequest
    ? people.find(person => person.id === currentRequest.personId)
    : undefined;
  const selectedGroupOrder = new Map<PersonId, number>();
  peopleGroups.forEach((group, index) => {
    for (const id of group.memberIds) {
      if (!selectedGroupOrder.has(id)) selectedGroupOrder.set(id, index);
    }
  });
  const orderedPeople = [...people].sort((left, right) =>
    (selectedGroupOrder.get(left.id) ?? peopleGroups.length)
      - (selectedGroupOrder.get(right.id) ?? peopleGroups.length)
    || left.displayName.localeCompare(right.displayName)
  );

  return (
    <>
      <section className="card prayer-entry-card" aria-labelledby="today-prayer-title">
        <div className="prayer-entry-card__heading">
          <h3 id="today-prayer-title">Prayer</h3>
        </div>
        <p className="prayer-entry-card__summary">
          {selectedPeople.length} {selectedPeople.length === 1 ? 'person' : 'people'} selected
          {' · '}{selectedTimeframeName}{' · '}
          {activeRequests.length} {activeRequests.length === 1 ? 'request' : 'requests'}
        </p>
        {activeRequests.length === 0 && (
          <p className="prayer-entry-card__prompt">No active requests match this selection.</p>
        )}
        <div className="prayer-entry-card__actions">
          <button type="button" className="btn mini ghost prayer-customize" onClick={openSelection}>
            Customize
          </button>
          <button
            type="button"
            className="prayer-session-start prayer-entry-card__session-start"
            disabled={activeRequests.length === 0}
            onClick={startCurrentSession}
          >
            Focused Prayer · {activeRequests.length}
          </button>
        </div>
      </section>

      <PrayerDialog
        open={selection !== null}
        className={`tend2-prayer-selection-dialog${
          selection?.showingTimeframes ? ' tend2-prayer-selection-dialog--timeframes' : ''
        }`}
        titleId="prayer-selection-title"
        onDismiss={() => setSelection(null)}
      >
        {selection && (
          <>
            <header className="tend2-prayer-selection-heading">
              <div>
                <span className="prayer-eyebrow">PRAYER</span>
                <h2 id="prayer-selection-title" tabIndex={-1}>
                  {selection.showingTimeframes ? 'Prayer timeframe' : 'Prayer selection'}
                </h2>
              </div>
              <button
                type="button"
                className="tend2-prayer-selection-close"
                aria-label="Close prayer selection"
                onClick={() => setSelection(null)}
              >
                ×
              </button>
            </header>
            {!selection.showingTimeframes ? (
              <>
                <div className="tend2-prayer-selection-section-heading">
                  <h3>Timeframe</h3>
                </div>
                <button
                  type="button"
                  className="tend2-prayer-selection-timeframe"
                  aria-label={`Change timeframe: ${selectedDraftTimeframe?.label ?? 'Now'}, ${
                    selectedDraftTimeframe?.description ?? 'Current time block'
                  }`}
                  onClick={() => setSelection(current => current
                    ? { ...current, showingTimeframes: true }
                    : current)}
                >
                  <span className="tend2-prayer-selection-timeframe-copy">
                    <strong>{selectedDraftTimeframe?.label ?? 'Now'}</strong>
                    <span className="tend2-prayer-selection-timeframe-description">
                      {selectedDraftTimeframe?.description ?? 'Current time block'}
                    </span>
                  </span>
                  <span aria-hidden="true">›</span>
                </button>
                <div className="tend2-prayer-selection-section">
                  <div className="tend2-prayer-selection-section-heading">
                    <h3>People</h3>
                    <div className="tend2-prayer-selection-actions">
                      <button type="button" onClick={() => setSelection(current => current
                        ? { ...current, people: people.map(person => person.id) }
                        : current)}>Select all</button>
                      <button type="button" onClick={() => setSelection(current => current
                        ? { ...current, people: [] }
                        : current)}>Clear</button>
                    </div>
                  </div>
                  <div className="tend2-prayer-selection-groups" role="group" aria-label="People categories">
                    {peopleGroups.map(group => {
                      const memberIds = group.memberIds.filter(id =>
                        people.some(person => person.id === id));
                      const selectedCount = memberIds.filter(id =>
                        selection.people.includes(id)).length;
                      const checked = selectedCount === 0
                        ? 'false'
                        : selectedCount === memberIds.length ? 'true' : 'mixed';
                      return (
                        <button
                          key={group.id}
                          type="button"
                          className={`tend2-prayer-selection-group${checked === 'true'
                            ? ' is-selected'
                            : checked === 'mixed' ? ' is-mixed' : ''}`}
                          role="checkbox"
                          aria-checked={checked}
                          disabled={memberIds.length === 0}
                          onClick={() => setSelection(current => current
                            ? {
                                ...current,
                                people: togglePrayerSelectionGroup(current.people, { memberIds })
                              }
                            : current)}
                        >
                          {group.label}
                        </button>
                      );
                    })}
                  </div>
                  {orderedPeople.length > 0 ? (
                    <div className="tend2-prayer-selection-people" role="group" aria-label="Select people">
                      {orderedPeople.map(person => {
                        const selected = selection.people.includes(person.id);
                        return (
                          <button
                            key={person.id}
                            type="button"
                            className={`tend2-prayer-selection-person${selected ? ' is-selected' : ''}`}
                            aria-pressed={selected}
                            onClick={() => togglePerson(person.id)}
                          >
                            <PersonAvatar person={person} />
                            <span>{person.displayName.split(/\s+/)[0]}</span>
                            <span className="tend2-prayer-selection-check" aria-hidden="true">✓</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="tend2-prayer-selection-empty">No people are available to select.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="tend2-prayer-timeframe-picker" role="radiogroup" aria-label="Prayer timeframe">
                {draftTimeframeOptions.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={selection.timeframe === option.id}
                    aria-current={option.isCurrent ? 'true' : undefined}
                    className={`tend2-prayer-timeframe-option${
                      selection.timeframe === option.id ? ' is-selected' : ''
                    }`}
                    onClick={() => setSelection(current => current
                      ? { ...current, timeframe: option.id }
                      : current)}
                  >
                    <span className="tend2-prayer-timeframe-copy">
                      <strong className="tend2-prayer-timeframe-label">{option.label}</strong>
                      <span className="tend2-prayer-timeframe-description">{option.description}</span>
                    </span>
                    <span className="tend2-prayer-timeframe-count">
                      {option.count} {option.count === 1 ? 'request' : 'requests'}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <footer className="tend2-prayer-selection-footer">
              <p>
                {draftRequests.length} {draftRequests.length === 1 ? 'request' : 'requests'} selected
              </p>
              <button type="button" className="btn ghost" onClick={() => {
                setSelectedPeople([...selection.people]);
                setTimeframe(selection.timeframe);
                setSelection(null);
              }}>
                Done
              </button>
              <button
                type="button"
                className="btn prayer-session-start"
                disabled={draftRequests.length === 0}
                onClick={() => startSession(selection)}
              >
                Start prayer
              </button>
            </footer>
          </>
        )}
      </PrayerDialog>

      <PrayerDialog
        open={session !== null}
        className="tend2-prayer-session-dialog"
        titleId="faithSessionTitle"
        onDismiss={() => setSession(null)}
      >
        {session && (sessionComplete ? (
          <div className="tend2-prayer-session-completion">
            <header className="tend2-prayer-session-heading">
              <span className="prayer-eyebrow">PRAYER TIME</span>
              <button type="button" className="btn mini ghost tend2-prayer-session-end" onClick={() => setSession(null)}>
                Finish
              </button>
            </header>
            <section className="card tend2-prayer-session-empty">
              <h1 id="faithSessionTitle" tabIndex={-1}>
                {session.ended ? 'Prayer session ended' : 'Prayer time complete'}
              </h1>
              <p>
                You marked {session.prayedIds.length} {session.prayedIds.length === 1 ? 'request' : 'requests'} prayed.
              </p>
            </section>
          </div>
        ) : (
          <div className="tend2-prayer-session-active">
            <header className="tend2-prayer-session-heading">
              <div>
                <span className="prayer-eyebrow">PRAYER TIME</span>
                <h1 id="faithSessionTitle" tabIndex={-1}>One request at a time</h1>
              </div>
              <button
                type="button"
                className="btn mini ghost tend2-prayer-session-end"
                onClick={() => setSession(current => current ? endPrayerSession(current) : current)}
              >
                End session
              </button>
            </header>
            <div className="tend2-prayer-session-progress" aria-live="polite">
              Request {session.index + 1} of {session.requestIds.length}
            </div>
            <div
              className="tend2-prayer-session-track"
              role="progressbar"
              aria-label="Prayer session progress"
              aria-valuemin={0}
              aria-valuemax={session.requestIds.length}
              aria-valuenow={session.index + 1}
            >
              <span style={{
                width: `${Math.round((session.index + 1) / session.requestIds.length * 100)}%`
              }} />
            </div>
            {currentRequest ? (
              <article
                ref={sessionCardRef}
                className="card tend2-prayer-session-card tend2-prayer-session-card--centered"
                tabIndex={-1}
              >
                {currentPerson && (
                  <div className="tend2-prayer-session-person tend2-prayer-session-person--centered">
                    <PersonAvatar person={currentPerson} />
                    <span>{currentPerson.displayName}</span>
                  </div>
                )}
                <h2>{currentRequest.title}</h2>
                {currentRequest.details && <p>{currentRequest.details}</p>}
                <div className="tend2-prayer-session-meta">
                  {prayerFrequencyLabel(currentRequest)} · {prayerTimeOfDayLabel(currentRequest, timeBlocks)}
                  {' · '}prayed {currentRequest.prayerLogs.length}
                  {' '}{currentRequest.prayerLogs.length === 1 ? 'time' : 'times'}
                </div>
              </article>
            ) : (
              <p className="tend2-prayer-session-unavailable" role="alert">
                This request is no longer available.
              </p>
            )}
            {sessionError && <p className="tend2-prayer-session-error" role="alert">{sessionError}</p>}
            <nav className="tend2-prayer-session-actions" aria-label="Prayer time actions">
              <button
                type="button"
                className="btn ghost"
                disabled={session.index === 0}
                onClick={() => {
                  setSession(current => current ? movePrayerSession(current, -1) : current);
                  setSessionError('');
                }}
              >
                Back
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setSession(current => current ? movePrayerSession(current, 1) : current);
                  setSessionError('');
                }}
              >
                Skip
              </button>
              <button
                type="button"
                className="btn tend2-prayer-session-prayed"
                disabled={!currentRequest || session.prayedIds.includes(currentRequest.id)}
                onClick={markCurrentPrayed}
              >
                Prayed
              </button>
            </nav>
            <p className="tend2-prayer-session-help">
              Only Prayed records a prayer. Use ← / → to move between requests.
            </p>
          </div>
        ))}
      </PrayerDialog>
    </>
  );
}

function PrayerDialog({
  open,
  className,
  titleId,
  onDismiss,
  children
}: {
  open: boolean;
  className: string;
  titleId: string;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useScrollLock(open);
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      document.getElementById(titleId)?.focus({ preventScroll: true });
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open, titleId]);

  function cancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    onDismiss();
  }

  return (
    <dialog
      ref={dialogRef}
      className={`prayer-dialog ${className}`}
      aria-labelledby={titleId}
      onCancel={cancel}
    >
      {children}
    </dialog>
  );
}
