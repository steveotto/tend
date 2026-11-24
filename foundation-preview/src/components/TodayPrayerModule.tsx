import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { PersonId, PersonPickerGroup, PersonPreview } from '../domain/preview-data.ts';
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
import { toggleBadgeGroup } from './BadgeSelectionPicker.tsx';
import { PeopleBadgeSelectionPicker } from './PeopleAssociationControls.tsx';
import { PersonBadgeVisual } from './PersonBadge.tsx';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';

type SelectionDraft = {
  people: PersonId[];
  timeframe: PrayerTimeframeId;
  showingTimeframes: boolean;
};

function PrayerSelectionActionButtons({
  disabled,
  onCancel,
  onPray
}: {
  disabled: boolean;
  onCancel: () => void;
  onPray: () => void;
}) {
  return (
    <>
      <button
        type="button"
        className="btn mini ghost prayer-selection-cancel"
        onClick={onCancel}
      >
        Cancel
      </button>
      <button
        type="button"
        className="btn mini prayer-selection-pray"
        data-prayer-selection-start
        disabled={disabled}
        onClick={onPray}
      >
        Pray
      </button>
    </>
  );
}

export type PrayerDataStatus = 'loading' | 'ready' | 'error';

export type TodayPrayerModuleProps = {
  people: readonly PersonPreview[];
  peopleGroups: readonly PersonPickerGroup[];
  requests: readonly PrayerRequestPreview[];
  dataStatus?: PrayerDataStatus;
  dataError?: string;
  enabled?: boolean;
  evaluationInstant?: Date;
  timeZone?: string;
  onPray: (requestId: string, expectedUpdatedAt: string, actorId: PersonId) => string | null;
};

export function TodayPrayerModule({
  people,
  peopleGroups,
  requests,
  dataStatus = 'ready',
  dataError,
  enabled = true,
  evaluationInstant = new Date(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  onPray
}: TodayPrayerModuleProps) {
  const [selectedPeople, setSelectedPeople] = useState<PersonId[]>(() =>
    dataStatus === 'ready' ? people.map(person => person.id) : []);
  const [timeframe, setTimeframe] = useState<PrayerTimeframeId>('now');
  const [selection, setSelection] = useState<SelectionDraft | null>(null);
  const [session, setSession] = useState<PrayerSession | null>(null);
  const [sessionError, setSessionError] = useState('');
  const sessionCardRef = useRef<HTMLElement>(null);
  const previousPeopleScope = useRef<{
    peopleKey: string;
    dataStatus: PrayerDataStatus;
  } | null>(null);
  const peopleKey = JSON.stringify(people.map(person => person.id));
  const peopleById = useMemo(() => new Map(people.map(person => [person.id, person])), [people]);
  const availablePeopleIds = useMemo(() => new Set(people.map(person => person.id)), [peopleKey]);
  const selectedPeopleInAccount = useMemo(
    () => selectedPeople.filter(id => availablePeopleIds.has(id)),
    [selectedPeople, availablePeopleIds]
  );

  useEffect(() => {
    const previous = previousPeopleScope.current;
    previousPeopleScope.current = { peopleKey, dataStatus };
    if (dataStatus !== 'ready') {
      setSelectedPeople([]);
      setSelection(null);
      setSession(null);
      setSessionError('');
      return;
    }

    const personIds = people.map(person => person.id);
    setSelectedPeople(current => {
      if (!previous
        || previous.dataStatus !== 'ready'
        || previous.peopleKey === JSON.stringify([]) && personIds.length > 0) {
        return personIds;
      }
      return current.filter(id => availablePeopleIds.has(id));
    });
    setSelection(current => current
      ? { ...current, people: current.people.filter(id => availablePeopleIds.has(id)) }
      : current);
  }, [dataStatus, peopleKey, availablePeopleIds]);

  const activeRequests = useMemo(() => dataStatus === 'ready'
    ? selectActivePrayerRequests(
        requests,
        selectedPeopleInAccount,
        timeframe,
        evaluationInstant,
        timeZone
      )
    : [], [dataStatus, requests, selectedPeopleInAccount, timeframe, evaluationInstant, timeZone]);
  const timeframeOptions = useMemo(() => dataStatus === 'ready'
    ? prayerTimeframeOptions(requests, selectedPeopleInAccount, evaluationInstant, timeZone)
    : [], [dataStatus, requests, selectedPeopleInAccount, evaluationInstant, timeZone]);
  const selectedTimeframeName = timeframeOptions.find(option => option.id === timeframe)?.label ?? 'Now';
  const draftRequests = selection && dataStatus === 'ready'
    ? selectActivePrayerRequests(requests, selection.people, selection.timeframe, evaluationInstant, timeZone)
    : [];
  const draftTimeframeOptions = selection && dataStatus === 'ready'
    ? prayerTimeframeOptions(requests, selection.people, evaluationInstant, timeZone)
    : [];
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
    ? peopleById.get(currentRequest.personId)
    : undefined;

  useEffect(() => {
    if (!session || !enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (event.altKey || event.ctrlKey || event.metaKey
        || target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(target.tagName)) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        setSession(current => {
          if (!current) return current;
          const nextIndex = current.index + direction;
          return nextIndex < 0 || nextIndex >= current.requestIds.length
            ? current
            : movePrayerSession(current, direction);
        });
        setSessionError('');
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        setSession(current => current ? endPrayerSession(current) : current);
      }
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [session !== null, enabled]);

  useLayoutEffect(() => {
    if (!session || !enabled) return;
    if (sessionComplete) {
      document.getElementById('today-prayer-session-title')?.focus({ preventScroll: true });
    } else {
      sessionCardRef.current?.focus({ preventScroll: true });
    }
  }, [session?.index, session?.ended, sessionComplete, enabled]);

  function openSelection() {
    if (dataStatus !== 'ready' || people.length === 0) return;
    setSelection({ people: [...selectedPeopleInAccount], timeframe, showingTimeframes: false });
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
    if (!enabled || dataStatus !== 'ready') return;
    const nextSession = createPrayerSession(selectedRequests(draft));
    if (!nextSession) return;
    setSelectedPeople([...draft.people]);
    setTimeframe(draft.timeframe);
    setSelection(null);
    setSessionError('');
    setSession(nextSession);
  }

  function togglePerson(personId: PersonId) {
    if (!availablePeopleIds.has(personId)) return;
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

  function toggleGroup(ids: readonly PersonId[]) {
    setSelection(current => {
      if (!current) return current;
      return {
        ...current,
        people: toggleBadgeGroup(current.people, ids.filter(id => availablePeopleIds.has(id)))
      };
    });
  }

  function markCurrentPrayed() {
    if (!enabled || !session || !currentRequest || session.prayedIds.includes(currentRequest.id)) return;
    const actorId = selectedPeopleInAccount.find(id =>
      id === currentRequest.personId || currentRequest.sharedWith?.includes(id) === true);
    if (!actorId || !currentRequest.updatedAt) {
      setSessionError('This saved request is no longer available for prayer recording. Reload the current data and try again.');
      return;
    }
    const error = onPray(currentRequest.id, currentRequest.updatedAt, actorId);
    if (error) {
      setSessionError(error);
      return;
    }
    setSession(current => current
      ? markPrayerSessionPrayed(current, currentRequest.id)
      : current);
    setSessionError('');
  }

  const emptyMessage = people.length === 0
    ? requests.length === 0
      ? 'No people or prayer requests are available yet.'
      : 'No people are available to select.'
    : requests.some(request => request.status === 'active')
      ? 'No active requests match this selection.'
      : 'No active prayer requests are saved for these people.';

  return (
    <>
      <section className="today-prayer-section" aria-labelledby="today-prayer-title" hidden={!enabled}>
        <div className="sectiontitle"><h2 id="today-prayer-title">Prayer</h2></div>
        <section className="prayer-entry-module" aria-label="Pray">
          <div className="prayer-entry-summary">
            <div className="prayer-entry-summary-line">
              <strong>
                {selectedPeopleInAccount.length} {selectedPeopleInAccount.length === 1 ? 'person' : 'people'} selected
                {' · '}{selectedTimeframeName}
              </strong>
            </div>
            {dataStatus === 'loading' && (
              <span className="prayer-entry-empty" role="status">Loading saved Prayer data…</span>
            )}
            {dataStatus === 'error' && (
              <span className="prayer-entry-empty" role="alert">
                {dataError ?? 'Saved Prayer data could not be loaded. No example data is shown.'}
              </span>
            )}
            {dataStatus === 'ready' && activeRequests.length === 0 && (
              <span className="prayer-entry-empty">{emptyMessage}</span>
            )}
          </div>
          <div className="prayer-entry-actions">
            <button
              type="button"
              className="btn mini ghost"
              data-prayer-selection-open
              disabled={dataStatus !== 'ready' || people.length === 0}
              onClick={openSelection}
            >
              Customize
            </button>
            <button
              type="button"
              className="btn mini faith-start-prayer"
              data-prayer-session-start
              aria-label={`Pray for ${activeRequests.length} ${
                activeRequests.length === 1 ? 'request' : 'requests'
              }`}
              disabled={dataStatus !== 'ready' || activeRequests.length === 0}
              onClick={() => startSession({
                people: [...selectedPeopleInAccount],
                timeframe,
                showingTimeframes: false
              })}
            >
              <span>Pray</span>
              <span className="prayer-entry-count" aria-hidden="true">{activeRequests.length}</span>
            </button>
          </div>
        </section>
      </section>

      {enabled && dataStatus === 'ready' && (
        <PrayerDialog
          open={selection !== null && dataStatus === 'ready'}
          className="prayer-selection-dialog prayer-theme"
          titleId="today-prayer-selection-title"
          onDismiss={() => setSelection(null)}
        >
          {selection && dataStatus === 'ready' && (
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
                  <section className="prayer-selection-section" aria-label="Prayer timeframe">
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
                  <PeopleBadgeSelectionPicker
                    title="People"
                    theme="prayer"
                    people={people}
                    groups={peopleGroups}
                    selectedIds={selection.people}
                    onToggle={togglePerson}
                    onToggleGroup={toggleGroup}
                    emptyMessage="No people are available to select."
                    description={(
                      <div className="prayer-selection-bulk">
                        <button
                          type="button"
                          className="btn mini ghost"
                          data-prayer-selection-people="all"
                          onClick={() => setSelection(current => current
                            ? { ...current, people: people.map(person => person.id) }
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
                    )}
                    status={(
                      <span className="prayer-selection-count" aria-live="polite">
                        {draftRequests.length} {draftRequests.length === 1 ? 'request' : 'requests'} selected
                      </span>
                    )}
                    actionButtons={(
                      <PrayerSelectionActionButtons
                        disabled={draftRequests.length === 0}
                        onCancel={() => setSelection(null)}
                        onPray={() => startSession(selection)}
                      />
                    )}
                    onDone={() => setSelection(null)}
                    onCancel={() => setSelection(null)}
                  />
                  {draftRequests.length === 0 && (
                    <p className="prayer-selection-empty" aria-live="polite">
                      No active requests match this selection. Choose different people or a different timeframe to pray.
                    </p>
                  )}
                </div>
              )}
            </div>
            {selection.showingTimeframes && (
              <div className="prayer-selection-count" aria-live="polite">
                {draftRequests.length} {draftRequests.length === 1 ? 'request' : 'requests'} selected
              </div>
            )}
            {selection.showingTimeframes && (
              <footer className="prayer-selection-footer">
                <div className="prayer-selection-footer-actions">
                  <PrayerSelectionActionButtons
                    disabled={draftRequests.length === 0}
                    onCancel={() => setSelection(null)}
                    onPray={() => startSession(selection)}
                  />
                </div>
              </footer>
            )}
            </>
          )}
        </PrayerDialog>
      )}

      {enabled && dataStatus === 'ready' && (
        <PrayerDialog
          open={session !== null}
          className="faith-page faith-prayer-session"
          titleId="today-prayer-session-title"
          onDismiss={() => setSession(null)}
        >
          {session && (sessionComplete ? (
          <section className="faith-session-complete">
            <span className="faith-eyebrow">PRAYER TIME</span>
            <div className="faith-session-complete__card">
              <h1 id="today-prayer-session-title" tabIndex={-1}>
                {session.ended ? 'Prayer session ended' : 'Prayer time complete'}
              </h1>
              <p>You marked {session.prayedIds.length} {session.prayedIds.length === 1 ? 'request' : 'requests'} prayed.</p>
              <div className="faith-session-actions">
                <button type="button" className="btn faith-session-close" onClick={() => setSession(null)}>
                  Finish
                </button>
              </div>
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
                disabled={session.index <= 0}
                onClick={() => setSession(current => current ? movePrayerSession(current, -1) : current)}
              >
                Back
              </button>
              <button
                type="button"
                className="btn ghost"
                data-faith-session-skip
                disabled={session.index >= session.requestIds.length - 1}
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
        )          )}
        </PrayerDialog>
      )}
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
  if (!open) return null;
  return (
    <MoneyGoalDialog
      dialogClassName={className}
      labelledBy={titleId}
      initialFocusId={titleId}
      stopEscapePropagation
      phoneFullScreen
      onClose={onDismiss}
    >
      {children}
    </MoneyGoalDialog>
  );
}
