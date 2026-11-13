import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
import {
  syntheticPeople,
  syntheticPersonPickerGroups
} from '../domain/preview-data.ts';
import type { PersonId, PersonPickerGroup } from '../domain/preview-data.ts';
import {
  createPrayerSession,
  endPrayerSession,
  markPrayerSessionPrayed,
  movePrayerSession,
  prayerTimeOfDayLabel,
  prayerTimeframeOptions,
  selectActivePrayerRequests
} from '../domain/prayer-session.ts';
import type { PrayerRequestPreview, PrayerSession, PrayerTimeframeId } from '../domain/prayer-session.ts';
import { PersonBadgeVisual } from './PersonBadge.tsx';
import { useScrollLock } from '../hooks/useScrollLock.ts';

type SelectionDraft = {
  people: PersonId[];
  timeframe: PrayerTimeframeId;
  showingTimeframes: boolean;
};

type TodayPrayerModuleProps = {
  requests: readonly PrayerRequestPreview[];
  evaluationInstant?: Date;
  timeZone?: string;
  onPray: (requestId: string) => string | null;
};

export function TodayPrayerModule({
  requests,
  evaluationInstant = new Date(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  onPray
}: TodayPrayerModuleProps) {
  const [selectedPeople, setSelectedPeople] = useState<PersonId[]>(() =>
    syntheticPeople.map(person => person.id));
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
    timeZone
  ), [requests, selectedPeople, timeframe, evaluationInstant, timeZone]);
  const timeframeOptions = useMemo(() => prayerTimeframeOptions(
    requests,
    selectedPeople,
    evaluationInstant,
    timeZone
  ), [requests, selectedPeople, evaluationInstant, timeZone]);
  const selectedTimeframeName = timeframeOptions.find(option => option.id === timeframe)?.label ?? 'Now';
  const draftRequests = selection
    ? selectActivePrayerRequests(requests, selection.people, selection.timeframe, evaluationInstant, timeZone)
    : [];
  const draftTimeframeOptions = prayerTimeframeOptions(
    requests,
    selection?.people ?? [],
    evaluationInstant,
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
  const currentPerson = currentRequest
    ? syntheticPeople.find(person => person.id === currentRequest.personId)
    : undefined;

  useEffect(() => {
    if (!session) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (event.altKey || event.ctrlKey || event.metaKey
        || target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(target.tagName)) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        setSession(current => current
          ? movePrayerSession(current, event.key === 'ArrowRight' ? 1 : -1)
          : current);
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

  useLayoutEffect(() => {
    if (!session) return;
    if (sessionComplete) {
      document.getElementById('today-prayer-session-title')?.focus({ preventScroll: true });
    } else {
      sessionCardRef.current?.focus({ preventScroll: true });
    }
  }, [session?.index, session?.ended, sessionComplete]);

  function openSelection() {
    setSelection({ people: [...selectedPeople], timeframe, showingTimeframes: false });
  }

  function selectedRequests(draft: SelectionDraft) {
    return selectActivePrayerRequests(
      requests,
      draft.people,
      draft.timeframe,
      evaluationInstant,
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

  function toggleGroup(group: PersonPickerGroup) {
    setSelection(current => {
      if (!current) return current;
      const selected = new Set(current.people);
      const memberIds = group.memberIds.filter(id => syntheticPeople.some(person => person.id === id));
      const allSelected = memberIds.length > 0 && memberIds.every(id => selected.has(id));
      for (const id of memberIds) {
        if (allSelected) selected.delete(id);
        else selected.add(id);
      }
      return { ...current, people: [...selected] };
    });
  }

  function markCurrentPrayed() {
    if (!session || !currentRequest || session.prayedIds.includes(currentRequest.id)) return;
    const error = onPray(currentRequest.id);
    if (error) {
      setSessionError(error);
      return;
    }
    setSession(current => current
      ? markPrayerSessionPrayed(current, currentRequest.id)
      : current);
    setSessionError('');
  }

  const orderedPeople = [...syntheticPeople].sort((left, right) => {
    const groupIndex = (id: PersonId) => {
      const index = syntheticPersonPickerGroups.findIndex(group => group.memberIds.includes(id));
      return index < 0 ? syntheticPersonPickerGroups.length : index;
    };
    return groupIndex(left.id) - groupIndex(right.id)
      || left.displayName.localeCompare(right.displayName);
  });

  return (
    <>
      <section className="today-prayer-section" aria-labelledby="today-prayer-title">
        <div className="sectiontitle"><h2 id="today-prayer-title">Prayer</h2></div>
        <section className="prayer-entry-module" aria-label="Focused Prayer">
          <div className="prayer-entry-summary">
            <div className="prayer-entry-summary-line">
              <strong>
                {selectedPeople.length} {selectedPeople.length === 1 ? 'person' : 'people'} selected
                {' · '}{selectedTimeframeName}
              </strong>
            </div>
            {activeRequests.length === 0 && (
              <span className="prayer-entry-empty">No active requests match this selection.</span>
            )}
          </div>
          <div className="prayer-entry-actions">
            <button type="button" className="btn mini ghost" data-prayer-selection-open onClick={openSelection}>
              Customize
            </button>
            <button
              type="button"
              className="btn mini faith-start-prayer"
              data-prayer-session-start
              aria-label={`Start focused prayer for ${activeRequests.length} ${
                activeRequests.length === 1 ? 'request' : 'requests'
              }`}
              disabled={activeRequests.length === 0}
              onClick={() => startSession({
                people: [...selectedPeople],
                timeframe,
                showingTimeframes: false
              })}
            >
              <span>Focused Prayer</span>
              <span className="prayer-entry-count" aria-hidden="true">{activeRequests.length}</span>
            </button>
          </div>
        </section>
      </section>

      <PrayerDialog
        open={selection !== null}
        className="prayer-selection-dialog"
        titleId="today-prayer-selection-title"
        onDismiss={() => setSelection(null)}
      >
        {selection && (
          <>
            <header className="prayer-selection-header">
              <h3 id="today-prayer-selection-title" tabIndex={-1}>
                {selection.showingTimeframes ? 'Prayer timeframe' : 'Prayer selection'}
              </h3>
              <button
                type="button"
                className="prayer-selection-close"
                aria-label="Close prayer selection"
                onClick={() => setSelection(null)}
              >
                ×
              </button>
            </header>
            <div className="prayer-selection-body" data-prayer-selection-body>
              {selection.showingTimeframes ? (
                <div className="prayer-selection-time-view">
                  <button
                    type="button"
                    className="btn mini ghost prayer-selection-back"
                    data-prayer-selection-back
                    onClick={() => setSelection(current => current
                      ? { ...current, showingTimeframes: false }
                      : current)}
                  >
                    Back
                  </button>
                  <h4>Timeframe</h4>
                  <div className="prayer-timeframe-picker__options" role="group" aria-label="Prayer timeframes">
                    {draftTimeframeOptions.map(option => (
                      <button
                        key={option.id}
                        type="button"
                        className={`prayer-timeframe-picker__option${
                          selection.timeframe === option.id ? ' is-selected' : ''
                        }${option.isCurrent ? ' is-current' : ''}`}
                        data-prayer-time-option={option.id}
                        aria-pressed={selection.timeframe === option.id}
                        onClick={() => setSelection(current => current
                          ? { ...current, timeframe: option.id, showingTimeframes: false }
                          : current)}
                      >
                        <span className="prayer-timeframe-picker__label">{option.label}</span>
                        <span className="prayer-timeframe-picker__description">{option.timeDescription}</span>
                        <span className="prayer-timeframe-picker__count">
                          {option.count} {option.count === 1 ? 'request' : 'requests'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="prayer-selection-people-view">
                  <section className="prayer-selection-section">
                    <h4>Timeframe</h4>
                    <button
                      type="button"
                      className="prayer-timeframe-picker__trigger"
                      data-prayer-selection-time-open
                      aria-label={`Change timeframe, currently ${selectedDraftTimeframe?.label ?? 'Now'}. ${
                        selectedDraftTimeframe?.timeDescription ?? ''
                      }`}
                      onClick={() => setSelection(current => current
                        ? { ...current, showingTimeframes: true }
                        : current)}
                    >
                      <span className="prayer-timeframe-picker__summary">
                        <strong>{selectedDraftTimeframe?.label ?? 'Now'}</strong>
                        <span>{selectedDraftTimeframe?.timeDescription ?? ''}</span>
                      </span>
                      <span className="prayer-timeframe-picker__chevron" aria-hidden="true">›</span>
                    </button>
                  </section>
                  <section className="prayer-selection-section">
                    <div className="prayer-selection-people-heading">
                      <h4>People</h4>
                      <div className="prayer-selection-bulk">
                        <button
                          type="button"
                          className="btn mini ghost"
                          data-prayer-selection-people="all"
                          onClick={() => setSelection(current => current
                            ? { ...current, people: syntheticPeople.map(person => person.id) }
                            : current)}
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          className="btn mini ghost"
                          data-prayer-selection-people="clear"
                          onClick={() => setSelection(current => current ? { ...current, people: [] } : current)}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div className="prayer-selection-groups" role="group" aria-label="People categories">
                      {syntheticPersonPickerGroups.map(group => {
                        const memberIds = group.memberIds.filter(id =>
                          syntheticPeople.some(person => person.id === id));
                        const count = memberIds.filter(id => selection.people.includes(id)).length;
                        const checked = count === 0 ? 'false' : count === memberIds.length ? 'true' : 'mixed';
                        return (
                          <button
                            key={group.id}
                            type="button"
                            className={`prayer-selection-group${checked === 'true'
                              ? ' is-selected'
                              : checked === 'mixed' ? ' is-mixed' : ''}`}
                            role="checkbox"
                            aria-checked={checked}
                            disabled={memberIds.length === 0}
                            data-prayer-selection-group={group.id}
                            onClick={() => toggleGroup(group)}
                          >
                            {group.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="prayer-selection-people" role="group" aria-label="Select people">
                      {orderedPeople.map(person => {
                        const selected = selection.people.includes(person.id);
                        return (
                          <button
                            key={person.id}
                            type="button"
                            className={`prayer-selection-person${selected ? ' is-selected' : ''}`}
                            data-prayer-selection-person={person.id}
                            aria-pressed={selected}
                            aria-label={`${selected ? 'Deselect' : 'Select'} ${person.displayName}`}
                            onClick={() => togglePerson(person.id)}
                          >
                            <PersonBadgeVisual person={person} />
                            <span className="prayer-selection-check" aria-hidden="true">✓</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                  {draftRequests.length === 0 && (
                    <p className="prayer-selection-empty" aria-live="polite">
                      No active requests match these selections.
                    </p>
                  )}
                </div>
              )}
            </div>
            <footer className="prayer-selection-footer">
              <p className="prayer-selection-count" aria-live="polite">
                {draftRequests.length} {draftRequests.length === 1 ? 'request' : 'requests'} selected
              </p>
              <div className="prayer-selection-footer-actions">
                <button
                  type="button"
                  className="btn mini ghost"
                  data-prayer-selection-done
                  onClick={() => {
                    setSelectedPeople([...selection.people]);
                    setTimeframe(selection.timeframe);
                    setSelection(null);
                  }}
                >
                  Done
                </button>
                <button
                  type="button"
                  className="btn mini faith-start-prayer"
                  data-prayer-selection-start
                  disabled={draftRequests.length === 0}
                  onClick={() => startSession(selection)}
                >
                  Start prayer
                </button>
              </div>
            </footer>
          </>
        )}
      </PrayerDialog>

      <PrayerDialog
        open={session !== null}
        className="faith-page faith-prayer-session"
        titleId="today-prayer-session-title"
        onDismiss={() => setSession(null)}
      >
        {session && (sessionComplete ? (
          <section className="card faith-session-empty">
            <h1 id="today-prayer-session-title" tabIndex={-1}>
              {session.ended ? 'Prayer session ended' : 'Prayer time complete'}
            </h1>
            <p>You marked {session.prayedIds.length} {session.prayedIds.length === 1 ? 'request' : 'requests'} prayed.</p>
            <div className="faith-session-actions">
              <button type="button" className="btn faith-session-close" onClick={() => setSession(null)}>
                Finish
              </button>
            </div>
          </section>
        ) : (
          <>
            <header className="faith-session-heading">
              <div>
                <span className="faith-eyebrow">PRAYER TIME</span>
                <h1 id="today-prayer-session-title" tabIndex={-1}>One request at a time</h1>
              </div>
              <button
                type="button"
                className="btn mini ghost faith-session-end"
                onClick={() => setSession(current => current ? endPrayerSession(current) : current)}
              >
                End session
              </button>
            </header>
            <div className="faith-session-progress" aria-live="polite">
              Request {session.index + 1} of {session.requestIds.length}
            </div>
            <div
              className="faith-session-track"
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
                className="card faith-session-card"
                tabIndex={-1}
              >
                {currentPerson && (
                  <div className="faith-session-person">
                    <PersonBadgeVisual person={currentPerson} />
                  </div>
                )}
                <h2>{currentRequest.title}</h2>
                {currentRequest.details && <p>{currentRequest.details}</p>}
                <div className="faith-session-meta">
                  {prayerTimeOfDayLabel(currentRequest.timeOfDay)} · prayed {currentRequest.prayedCount}
                  {' '}{currentRequest.prayedCount === 1 ? 'time' : 'times'}
                  {currentRequest.lastPrayedAt
                    ? ` · last prayed ${new Date(currentRequest.lastPrayedAt).toLocaleDateString()}`
                    : ''}
                </div>
              </article>
            ) : (
              <p className="faith-session-empty" role="alert">This request is no longer available.</p>
            )}
            {sessionError && <p className="faith-session-help" role="alert">{sessionError}</p>}
            <nav className="faith-session-actions" aria-label="Prayer time actions">
              <button
                type="button"
                className="btn ghost"
                data-faith-session-back
                disabled={session.index === 0}
                onClick={() => setSession(current => current ? movePrayerSession(current, -1) : current)}
              >
                Back
              </button>
              <button
                type="button"
                className="btn ghost"
                data-faith-session-skip
                onClick={() => setSession(current => current ? movePrayerSession(current, 1) : current)}
              >
                Skip
              </button>
              <button
                type="button"
                className="btn faith-session-prayed"
                data-faith-session-prayed={currentRequest?.id}
                disabled={!currentRequest || session.prayedIds.includes(currentRequest.id)}
                onClick={markCurrentPrayed}
              >
                Prayed
              </button>
            </nav>
            <p className="faith-session-help">
              Only Prayed records a prayer. <span className="faith-session-keyboard-help">Use ← / → to move between requests.</span>
            </p>
          </>
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
      className={className}
      aria-labelledby={titleId}
      onCancel={cancel}
    >
      {children}
    </dialog>
  );
}
