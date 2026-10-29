import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import {
  addOrUpdateConnection,
  connectionsForPerson,
  deleteConnection,
  friendConnectionStatus,
  selectFriendStatuses,
  setFriendCadence
} from '../domain/friendships.ts';
import type {
  ConnectionCadence,
  ConnectionType,
  FriendshipConnection,
  FriendshipData
} from '../domain/friendships.ts';
import { personById, personGroupMemberIds, syntheticPeople, syntheticPersonPickerGroups } from '../domain/preview-data.ts';
import type {
  FoundationPreview,
  PersonId,
  PersonPickerGroup,
  RhythmPreview
} from '../domain/preview-data.ts';
import { isEditableRhythmId } from '../domain/rhythm-editor.ts';
import { peopleForRhythm } from '../domain/preview-data.ts';
import { rhythmHealthScore } from '../domain/rhythm-scoring.ts';
import type { RhythmScoreResult } from '../domain/rhythm-scoring.ts';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { ArchivedRhythmsDialog } from './ArchivedRhythmsDialog.tsx';
import { RhythmDetailsDialog } from './RhythmDetailsDialog.tsx';
import { PersonBadge } from './PersonBadge.tsx';
import { PersonBadgeVisual } from './PersonBadge.tsx';
import { AreaIcon } from './AreaIcon.tsx';
import type { Destination } from './AppNavigation.tsx';

type FriendshipTab = 'today' | 'friends' | 'rhythms';

const friendshipTabs: { id: FriendshipTab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'friends', label: 'Friends' },
  { id: 'rhythms', label: 'Rhythms' }
];

const cadenceLabels: Record<ConnectionCadence, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  'two-weeks': 'Every two weeks',
  monthly: 'Monthly'
};
const cadenceChoices: { value: ConnectionCadence | null; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'two-weeks', label: 'Every two weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: null, label: 'No cadence' }
];

const connectionTypeLabels: Record<ConnectionType, string> = {
  text: 'Text',
  call: 'Call',
  'time-together': 'Time Together'
};

type FriendshipsViewProps = {
  data: FriendshipData;
  peopleGroups?: readonly PersonPickerGroup[];
  today: string;
  rhythms: readonly RhythmPreview[];
  archivedRhythms: readonly RhythmPreview[];
  foundations: readonly FoundationPreview[];
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>;
  completedRhythms: ReadonlySet<string>;
  undoableRhythms: ReadonlySet<string>;
  onChange: (data: FriendshipData) => void;
  onAddRhythm: (event: MouseEvent<HTMLButtonElement>) => void;
  onEditRhythm: (rhythm: RhythmPreview, event: MouseEvent<HTMLButtonElement>) => void;
  onRhythmHistory: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onTend: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onUndo: (id: string) => void;
  onPersonSelect: (id: PersonId) => void;
  onGoToPeople: () => void;
  onRestoreRhythm: (id: string) => void;
  onOpenFoundation: (foundationId: string, openerId: string) => void;
  onOpenCategory: (categoryId: Destination, openerId: string) => void;
};

export function FriendshipsView({
  data,
  peopleGroups = syntheticPersonPickerGroups,
  today,
  rhythms,
  archivedRhythms,
  foundations,
  rhythmScores,
  completedRhythms,
  undoableRhythms,
  onChange,
  onAddRhythm,
  onEditRhythm,
  onRhythmHistory,
  onTend,
  onUndo,
  onPersonSelect,
  onGoToPeople,
  onRestoreRhythm,
  onOpenFoundation,
  onOpenCategory
}: FriendshipsViewProps) {
  const [tab, setTab] = useState<FriendshipTab>('today');
  const [cadencePersonId, setCadencePersonId] = useState<PersonId | null>(null);
  const [historyPersonId, setHistoryPersonId] = useState<PersonId | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [connectionEditor, setConnectionEditor] = useState<{
    record?: FriendshipConnection;
    participantId?: PersonId;
    type?: ConnectionType;
  } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [expandedConnectionId, setExpandedConnectionId] = useState<string | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const cadenceOpener = useRef<HTMLButtonElement | null>(null);
  const historyOpener = useRef<HTMLButtonElement | null>(null);
  const connectionOpener = useRef<HTMLButtonElement | null>(null);
  const wasCadenceOpen = useRef(false);
  const wasHistoryOpen = useRef(false);
  const wasEditorOpen = useRef(false);
  const wasArchiveOpen = useRef(false);
  const archiveOpener = useRef<HTMLButtonElement | null>(null);
  const deleteCancelButton = useRef<HTMLButtonElement | null>(null);
  const focusHistoryAfterDelete = useRef(false);

  useEffect(() => {
    if (cadencePersonId !== null) {
      wasCadenceOpen.current = true;
      return;
    }
    if (wasCadenceOpen.current) {
      wasCadenceOpen.current = false;
      cadenceOpener.current?.focus();
    }
  }, [cadencePersonId]);

  useEffect(() => {
    if (historyPersonId !== null) {
      wasHistoryOpen.current = true;
      return;
    }
    if (wasHistoryOpen.current) {
      wasHistoryOpen.current = false;
      historyOpener.current?.focus();
    }
  }, [historyPersonId]);

  useEffect(() => {
    if (connectionEditor) {
      wasEditorOpen.current = true;
      return;
    }
    if (wasEditorOpen.current) {
      wasEditorOpen.current = false;
      if (connectionOpener.current?.isConnected) {
        connectionOpener.current.focus();
      } else if (historyPersonId !== null) {
        document.querySelector<HTMLButtonElement>('#friendships-history-dialog-close')?.focus();
      } else {
        const selectedIndex = friendshipTabs.findIndex(item => item.id === tab);
        tabRefs.current[selectedIndex]?.focus();
      }
    }
  }, [connectionEditor, historyPersonId, tab]);

  useEffect(() => {
    if (showArchived) {
      wasArchiveOpen.current = true;
      return;
    }
    if (wasArchiveOpen.current) {
      wasArchiveOpen.current = false;
      archiveOpener.current?.focus();
    }
  }, [showArchived]);

  function selectTab(next: FriendshipTab) {
    setTab(next);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let target: number | null = null;
    if (event.key === 'ArrowRight') target = (index + 1) % friendshipTabs.length;
    else if (event.key === 'ArrowLeft') target = (index - 1 + friendshipTabs.length) % friendshipTabs.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = friendshipTabs.length - 1;
    if (target === null) return;
    event.preventDefault();
    const next = friendshipTabs[target]!;
    setTab(next.id);
    tabRefs.current[target]?.focus();
  }

  function setCadence(personId: PersonId, cadence: ConnectionCadence | null) {
    onChange(setFriendCadence(data, personId, cadence, today));
  }

  function openHistory(personId: PersonId, event: MouseEvent<HTMLButtonElement>) {
    historyOpener.current = event.currentTarget;
    setExpandedConnectionId(null);
    setHistoryPersonId(personId);
  }

  function openNewConnection(
    event: MouseEvent<HTMLButtonElement>,
    participantId?: PersonId,
    type: ConnectionType = 'text'
  ) {
    connectionOpener.current = event.currentTarget;
    setConnectionEditor({ ...(participantId ? { participantId } : {}), type });
  }

  function openEditConnection(record: FriendshipConnection, event: MouseEvent<HTMLButtonElement>) {
    connectionOpener.current = event.currentTarget;
    setConnectionEditor({ record });
  }

  function saveConnection(connection: FriendshipConnection): string | null {
    const next = addOrUpdateConnection(data, connection);
    onChange(next);
    return null;
  }

  const friendIds = personGroupMemberIds(peopleGroups, 'friends');
  const statuses = selectFriendStatuses(data, friendIds, today);
  const dueStatuses = statuses.filter(status => status.due);
  const configuredCadenceCount = statuses.filter(status => status.cadence !== null).length;
  const activeHistory = historyPersonId === null
    ? []
    : connectionsForPerson(data, historyPersonId);
  const editorParticipantIds = connectionEditor
    ? connectionEditor.record?.participantIds ?? (connectionEditor.participantId ? [connectionEditor.participantId] : [])
    : [];
  const cadencePerson = cadencePersonId === null ? null : personById(cadencePersonId);

  useEffect(() => {
    if (confirmingDeleteId !== null) deleteCancelButton.current?.focus();
    else if (focusHistoryAfterDelete.current) {
      focusHistoryAfterDelete.current = false;
      document.querySelector<HTMLButtonElement>('.friendships-history-item [data-connection-edit]')
        ?.focus();
      if (!document.activeElement?.matches('.friendships-history-item [data-connection-edit]')) {
        document.querySelector<HTMLButtonElement>('#friendships-history-dialog-close')?.focus();
      }
    }
  }, [confirmingDeleteId, activeHistory.length]);

  return (
    <main className="category-page friendships-page" aria-labelledby="friendships-page-title">
      <header className="category-page-heading">
        <h2 id="friendships-page-title" tabIndex={-1}>Friendships</h2>
        <span className="menu-area-icon"><AreaIcon id="friendships" variant="today-summary" /></span>
      </header>
      <div className="faith-view-nav marriage-view-nav" role="tablist" aria-label="Friendships">
        {friendshipTabs.map((item, index) => (
          <button
            key={item.id}
            ref={element => { tabRefs.current[index] = element; }}
            id={`friendships-tab-${item.id}`}
            type="button"
            role="tab"
            aria-controls={`friendships-panel-${item.id}`}
            aria-selected={tab === item.id}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => selectTab(item.id)}
            onKeyDown={event => handleTabKeyDown(event, index)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section
        id="friendships-panel-today"
        className="friendships-panel marriage-view-panel"
        role="tabpanel"
        aria-labelledby="friendships-tab-today"
        hidden={tab !== 'today'}
      >
        {statuses.length === 0 ? (
          <div className="friendships-empty-state">
            <p>No friends yet.</p>
            <button type="button" className="btn mini ghost" onClick={onGoToPeople}>Go to People</button>
          </div>
        ) : dueStatuses.length > 0 ? (
          <div className="friendships-due-list">
            {dueStatuses.map(status => (
              <DueFriendRow
                key={status.personId}
                status={status}
                today={today}
                onLog={event => openNewConnection(event, status.personId)}
              />
            ))}
          </div>
        ) : configuredCadenceCount === 0 ? (
          <p className="friendships-empty">No connection cadences set.</p>
        ) : (
          <p className="friendships-caught-up">You’re caught up.</p>
        )}
      </section>

      <section
        id="friendships-panel-friends"
        className="friendships-panel marriage-view-panel"
        role="tabpanel"
        aria-labelledby="friendships-tab-friends"
        hidden={tab !== 'friends'}
      >
        <div className="friendships-section-heading">
          <h3>Friends</h3>
        </div>
        {statuses.length === 0 ? (
          <div className="friendships-empty-state">
            <p>No friends yet.</p>
            <p>Add people and mark them as friends.</p>
            <button type="button" className="btn mini ghost" onClick={onGoToPeople}>Go to People</button>
          </div>
        ) : (
          <div className="friendships-friend-list">
            {statuses.map(status => (
              <FriendRow
                key={status.personId}
                status={status}
                today={today}
                connections={connectionsForPerson(data, status.personId)}
                onPersonSelect={onPersonSelect}
                onCadenceOpen={event => {
                  cadenceOpener.current = event.currentTarget;
                  setCadencePersonId(status.personId);
                }}
                onHistory={event => openHistory(status.personId, event)}
                onQuickLog={(type, event) => openNewConnection(event, status.personId, type)}
              />
            ))}
          </div>
        )}
      </section>

      <section
        id="friendships-panel-rhythms"
        className="friendships-panel marriage-view-panel"
        role="tabpanel"
        aria-labelledby="friendships-tab-rhythms"
        hidden={tab !== 'rhythms'}
      >
        <div className="friendships-section-heading">
          <h3>Rhythms</h3>
          <button type="button" className="btn mini" onClick={onAddRhythm}>Add Rhythm</button>
        </div>
        {rhythms.length > 0 ? (
          <div className="marriage-rhythm-list current-plan-item-group">
            {rhythms.map(rhythm => (
              <RhythmDetailsDialog
                key={rhythm.id}
                rhythm={rhythm}
                inline
                headingId={`friendships-rhythm-${rhythm.id}`}
                people={peopleForRhythm(rhythm)}
                foundations={foundations}
                onPersonSelect={onPersonSelect}
                onOpenFoundation={onOpenFoundation}
                onOpenCategory={onOpenCategory}
                completed={completedRhythms.has(rhythm.id)}
                healthScore={rhythmHealthScore(rhythmScores.get(rhythm.id))}
                onHistory={event => onRhythmHistory(rhythm.id, event)}
                {...(isEditableRhythmId(rhythm.id)
                  ? {
                      onTend: (event: MouseEvent<HTMLButtonElement>) => onTend(rhythm.id, event),
                      onEdit: (event: MouseEvent<HTMLButtonElement>) => onEditRhythm(rhythm, event),
                      ...(completedRhythms.has(rhythm.id) && undoableRhythms.has(rhythm.id)
                        ? { onUndo: () => onUndo(rhythm.id) }
                        : {})
                    }
                  : {})}
                onClose={() => undefined}
              />
            ))}
          </div>
        ) : (
          <p className="friendships-empty">No active Rhythms yet.</p>
        )}
        <button
          ref={archiveOpener}
          type="button"
          className="category-archived-rhythms-toggle"
          aria-haspopup="dialog"
          onClick={() => setShowArchived(true)}
        >
          Archived rhythms ({archivedRhythms.length})
        </button>
      </section>

      {cadencePerson && (
        <MoneyGoalDialog
          title={`Connection cadence · ${cadencePerson.displayName}`}
          titleId="friendships-cadence-title"
          labelledBy="friendships-cadence-title"
          closeLabel="Close connection cadence"
          onClose={() => setCadencePersonId(null)}
        >
          <div className="friendships-cadence-choices" role="group" aria-label="Connection cadence">
            {cadenceChoices.map(choice => {
              const selected = choice.value === (statuses.find(status => status.personId === cadencePerson.id)?.cadence ?? null);
              return (
                <button
                  key={choice.label}
                  type="button"
                  className={selected ? 'friendships-cadence-choice friendships-cadence-choice--selected' : 'friendships-cadence-choice'}
                  aria-pressed={selected}
                  onClick={() => {
                    setCadence(cadencePerson.id, choice.value);
                    setCadencePersonId(null);
                  }}
                >
                  {choice.label}
                </button>
              );
            })}
          </div>
        </MoneyGoalDialog>
      )}
      {historyPersonId !== null && (
        <MoneyGoalDialog
          title={`${personById(historyPersonId).displayName} · connection history`}
          titleId="friendships-history-title"
          labelledBy="friendships-history-title"
          closeLabel="Close connection history"
          closeButtonId="friendships-history-dialog-close"
          onClose={() => setHistoryPersonId(null)}
        >
          {activeHistory.length === 0 ? (
            <p className="friendships-empty">No connections yet.</p>
          ) : (
            <ol className="friendships-history-list">
              {activeHistory.map(connection => (
                <li key={connection.id} className="friendships-history-item">
                  <div className="friendships-history-item__heading">
                    <strong>{connectionTypeLabels[connection.type]}</strong>
                    <time dateTime={connection.date}>{formatLocalDate(connection.date)}</time>
                    {connection.time && <span>{formatLocalTime(connection.time)}</span>}
                  </div>
                  <div className="friendships-history-item__participants">
                    {connection.participantIds.map(id => (
                      <PersonBadge key={id} person={personById(id)} presentation="static" />
                    ))}
                  </div>
                  {expandedConnectionId === connection.id && (
                    <p className="friendships-history-item__notes">
                      {connection.notes || 'No notes.'}
                    </p>
                  )}
                  <div className="friendships-actions">
                    <button
                      type="button"
                      className="btn mini ghost"
                      aria-expanded={expandedConnectionId === connection.id}
                      onClick={() => setExpandedConnectionId(current => current === connection.id ? null : connection.id)}
                    >
                      {expandedConnectionId === connection.id ? 'Hide details' : 'Details'}
                    </button>
                    <button
                      type="button"
                      className="btn mini ghost"
                      data-connection-edit={connection.id}
                      onClick={event => openEditConnection(connection, event)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn mini ghost"
                      data-connection-delete={connection.id}
                      onClick={() => setConfirmingDeleteId(connection.id)}
                    >
                      Delete
                    </button>
                  </div>
                  {confirmingDeleteId === connection.id && (
                    <div className="friendships-delete-confirmation" role="alertdialog"
                      aria-labelledby={`friendship-delete-title-${connection.id}`}>
                      <p id={`friendship-delete-title-${connection.id}`}>
                        Delete this connection from the history of all its participants?
                      </p>
                      <div className="friendships-actions">
                        <button
                          ref={deleteCancelButton}
                          type="button"
                          className="btn mini ghost"
                          onClick={() => setConfirmingDeleteId(null)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn mini"
                          onClick={() => {
                            focusHistoryAfterDelete.current = true;
                            onChange(deleteConnection(data, connection.id));
                            setConfirmingDeleteId(null);
                            setExpandedConnectionId(null);
                          }}
                        >
                          Delete connection
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </MoneyGoalDialog>
      )}
      {connectionEditor && (
        <ConnectionEditor
          key={connectionEditor.record?.id ?? connectionEditor.participantId ?? 'new'}
          {...(connectionEditor.record ? { record: connectionEditor.record } : {})}
          initialParticipantIds={editorParticipantIds}
          {...(connectionEditor.type ? { initialType: connectionEditor.type } : {})}
          today={today}
          onSave={saveConnection}
          onClose={() => setConnectionEditor(null)}
        />
      )}
      {showArchived && (
        <ArchivedRhythmsDialog
          rhythms={archivedRhythms}
          completedRhythms={completedRhythms}
          onPersonSelect={onPersonSelect}
          onRestore={onRestoreRhythm}
          onClose={() => setShowArchived(false)}
        />
      )}
    </main>
  );
}

function DueFriendRow({
  status,
  today,
  onLog
}: {
  status: ReturnType<typeof friendConnectionStatus>;
  today: string;
  onLog: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const person = personById(status.personId);
  return (
    <article className="friendships-due-row">
      <div className="friendships-person">
        <PersonBadge person={person} presentation="static" displayNameMode="full" />
        <div className="friendships-person__details">
          <p>{status.cadence ? cadenceLabels[status.cadence] : 'No cadence'}</p>
          <p>{status.lastConnection
            ? `Last connected ${formatFriendDate(status.lastConnection.date, today)}`
            : 'No connections yet'}</p>
        </div>
      </div>
      <button type="button" className="btn mini" onClick={onLog}>Log connection</button>
    </article>
  );
}

function FriendRow({
  status,
  today,
  connections,
  onPersonSelect,
  onCadenceOpen,
  onHistory,
  onQuickLog
}: {
  status: ReturnType<typeof friendConnectionStatus>;
  today: string;
  connections: FriendshipConnection[];
  onPersonSelect: (id: PersonId) => void;
  onCadenceOpen: (event: MouseEvent<HTMLButtonElement>) => void;
  onHistory: (event: MouseEvent<HTMLButtonElement>) => void;
  onQuickLog: (type: ConnectionType, event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const person = personById(status.personId);
  const last = connections[0] ?? null;
  return (
    <article className="friendships-friend-row">
      <div className="friendships-friend-row__identity">
        <PersonBadge person={person} displayNameMode="full" onSelect={onPersonSelect} />
        <p className="friendships-friend-row__last">
          {last ? `Last connected ${formatFriendDate(last.date, today)}` : 'No connections yet'}
        </p>
      </div>
      <button
        type="button"
        className="friendships-cadence-button"
        aria-haspopup="dialog"
        aria-label={`Change connection cadence for ${person.displayName}. Current: ${status.cadence ? cadenceLabels[status.cadence] : 'No cadence'}`}
        onClick={onCadenceOpen}
      >
        {status.cadence ? cadenceLabels[status.cadence] : 'No cadence'}
        <span aria-hidden="true">⌄</span>
      </button>
      <div className="friendships-quick-actions" role="group" aria-label={`Log a connection with ${person.displayName}`}>
        {(Object.keys(connectionTypeLabels) as ConnectionType[]).map(type => (
          <button
            key={type}
            type="button"
            className="friendships-quick-action"
            aria-label={`${connectionTypeLabels[type]} ${person.displayName}`}
            onClick={event => onQuickLog(type, event)}
          >
            <ConnectionTypeIcon type={type} />
            <span>{connectionTypeLabels[type]}</span>
          </button>
        ))}
      </div>
      <button type="button" className="friendships-history-button" onClick={onHistory}>
        View connections{connections.length > 0 ? ` (${connections.length})` : ''}
        </button>
    </article>
  );
}

function ConnectionTypeIcon({ type }: { type: ConnectionType }) {
  if (type === 'text') {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
        <path d="M3.5 4.5h13v9h-7l-4 3v-3h-2z" />
      </svg>
    );
  }
  if (type === 'call') {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
        <path d="M6 3.5 4 5c.3 5.2 5.8 10.7 11 11l1.5-2-3-3-2 1c-1.6-.7-2.8-1.9-3.5-3.5l1-2z" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="14" cy="8" r="2" />
      <path d="M2.5 16c.2-2.5 2-4 4.5-4s4.3 1.5 4.5 4m.2-3.3c2.8-.5 5.3.8 5.8 3.3" />
    </svg>
  );
}

function ConnectionEditor({
  record,
  initialParticipantIds,
  initialType,
  today,
  onSave,
  onClose
}: {
  record?: FriendshipConnection;
  initialParticipantIds: PersonId[];
  initialType?: ConnectionType;
  today: string;
  onSave: (record: FriendshipConnection) => string | null;
  onClose: () => void;
}) {
  const [type, setType] = useState<ConnectionType>(record?.type ?? initialType ?? 'text');
  const [date, setDate] = useState(record?.date ?? today);
  const [time, setTime] = useState(record?.time ?? '');
  const [participantIds, setParticipantIds] = useState<PersonId[]>(initialParticipantIds);
  const [notes, setNotes] = useState(record?.notes ?? '');
  const [error, setError] = useState('');
  function submit(event: import('react').FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!date) {
      setError('Choose a connection date.');
      return;
    }
    if (participantIds.length === 0) {
      setError('Choose at least one participant.');
      return;
    }
    const {
      time: _previousTime,
      notes: _previousNotes,
      ...existingFields
    } = record ?? {};
    const next: FriendshipConnection = {
      ...existingFields,
      id: record?.id ?? `friendship-connection-${globalThis.crypto.randomUUID()}`,
      type,
      date,
      ...(time ? { time } : {}),
      participantIds,
      ...(notes.trim() ? { notes: notes.trim() } : {})
    };
    const saveError = onSave(next);
    if (saveError) {
      setError(saveError);
      return;
    }
    onClose();
  }

  return (
    <MoneyGoalDialog
      title={record ? 'Edit connection' : 'Log connection'}
      titleId="friendship-connection-title"
      labelledBy="friendship-connection-title"
      initialFocusId="friendship-connection-type"
      onClose={onClose}
    >
      <form className="friendships-connection-form" onSubmit={submit} noValidate>
        <label>
          <span>Connection type</span>
          <select
            id="friendship-connection-type"
            value={type}
            onChange={event => setType(event.currentTarget.value as ConnectionType)}
          >
            {Object.entries(connectionTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <div className="friendships-date-fields">
          <label>
            <span>Date</span>
            <input type="date" value={date} onChange={event => setDate(event.currentTarget.value)} required />
          </label>
          <label>
            <span>Time (optional)</span>
            <input type="time" value={time} onChange={event => setTime(event.currentTarget.value)} />
          </label>
        </div>
        <fieldset className="friendships-participants">
          <legend>Actual participants</legend>
          {syntheticPeople.map(person => (
            <label key={person.id}>
              <input
                type="checkbox"
                checked={participantIds.includes(person.id)}
                onChange={() => setParticipantIds(current => current.includes(person.id)
                  ? current.filter(id => id !== person.id)
                  : [...current, person.id])}
              />
              <PersonBadgeVisual person={person} />
            </label>
          ))}
        </fieldset>
        <label>
          <span>Notes (optional)</span>
          <textarea maxLength={4000} value={notes} onChange={event => setNotes(event.currentTarget.value)} />
        </label>
        {error && <p className="friendships-form-error" role="alert">{error}</p>}
        <div className="money-goal-dialog__actions">
          <button type="submit" className="btn mini">{record ? 'Save changes' : 'Save connection'}</button>
          <button type="button" className="btn mini ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </MoneyGoalDialog>
  );
}

function formatLocalDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year!, month! - 1, day!, 12).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatFriendDate(value: string, today: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const currentYear = Number(today.slice(0, 4));
  return new Date(year!, month! - 1, day!, 12).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(year !== currentYear ? { year: 'numeric' as const } : {})
  });
}

function formatLocalTime(value: string): string {
  const [hour, minute] = value.split(':').map(Number);
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  });
}
