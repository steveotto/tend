import { useEffect, useRef, useState } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import { personById, syntheticPeople } from '../domain/preview-data.ts';
import type { PersonId } from '../domain/preview-data.ts';
import {
  deleteConnection,
  setFriendCadence
} from '../domain/friendships.ts';
import type {
  ConnectionCadence,
  ConnectionType,
  FriendshipConnection,
  FriendshipData
} from '../domain/friendships.ts';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { PersonBadge, PersonBadgeVisual } from './PersonBadge.tsx';

export const connectionTypeLabels: Record<ConnectionType, string> = {
  text: 'Text',
  call: 'Call',
  'time-together': 'Time Together'
};

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

export function ConnectionTypeActions({
  personId,
  onSelect
}: {
  personId: PersonId;
  onSelect: (type: ConnectionType, event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const person = personById(personId);
  return (
    <div className="friendships-quick-actions" role="group" aria-label={`Log a connection with ${person.displayName}`}>
      {(Object.keys(connectionTypeLabels) as ConnectionType[]).map(type => (
        <button
          key={type}
          type="button"
          className="friendships-quick-action"
          aria-label={`${connectionTypeLabels[type]} ${person.displayName}`}
          onClick={event => onSelect(type, event)}
        >
          <ConnectionTypeIcon type={type} />
          <span>{connectionTypeLabels[type]}</span>
        </button>
      ))}
    </div>
  );
}

export function FriendshipCadenceControl({
  personId,
  cadence,
  today,
  data,
  onChange
}: {
  personId: PersonId;
  cadence: ConnectionCadence | null;
  today: string;
  data: FriendshipData;
  onChange: (data: FriendshipData) => void;
}) {
  const person = personById(personId);
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      opener.current?.focus();
    }
  }, [open]);

  return (
    <>
      <button
        ref={opener}
        type="button"
        className="friendships-cadence-button"
        aria-haspopup="dialog"
        aria-label={`Change connection cadence for ${person.displayName}. Current: ${cadence ? cadenceLabels[cadence] : 'No cadence'}`}
        onClick={() => setOpen(true)}
      >
        {cadence ? cadenceLabels[cadence] : 'No cadence'}
        <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <MoneyGoalDialog
          title={`Connection cadence · ${person.displayName}`}
          titleId="friendships-cadence-title"
          labelledBy="friendships-cadence-title"
          closeLabel="Close connection cadence"
          onClose={() => setOpen(false)}
        >
          <div className="friendships-cadence-choices" role="group" aria-label="Connection cadence">
            {cadenceChoices.map(choice => {
              const selected = choice.value === cadence;
              return (
                <button
                  key={choice.label}
                  type="button"
                  className={selected ? 'friendships-cadence-choice friendships-cadence-choice--selected' : 'friendships-cadence-choice'}
                  aria-pressed={selected}
                  onClick={() => {
                    onChange(setFriendCadence(data, personId, choice.value, today));
                    setOpen(false);
                  }}
                >
                  {choice.label}
                </button>
              );
            })}
          </div>
        </MoneyGoalDialog>
      )}
    </>
  );
}

export function ConnectionHistoryList({
  connections,
  onEdit,
  onDelete,
  onPersonSelect
}: {
  connections: readonly FriendshipConnection[];
  onEdit: (connection: FriendshipConnection, event: MouseEvent<HTMLButtonElement>) => void;
  onDelete: (connectionId: string) => void;
  onPersonSelect: (personId: PersonId) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const deleteCancelButton = useRef<HTMLButtonElement>(null);
  const deleteOpener = useRef<HTMLButtonElement | null>(null);
  const editButtons = useRef(new Map<string, HTMLButtonElement>());
  const emptyHistoryMessage = useRef<HTMLParagraphElement>(null);
  const focusEditAfterDelete = useRef(false);
  const focusCloseAfterDelete = useRef(false);
  const returnToDelete = useRef(false);

  useEffect(() => {
    if (confirmingDeleteId !== null) deleteCancelButton.current?.focus();
    else if (returnToDelete.current) {
      returnToDelete.current = false;
      deleteOpener.current?.focus();
    }
    else if (focusEditAfterDelete.current) {
      focusEditAfterDelete.current = false;
      if (connections.length > 0) {
        [...editButtons.current.values()][0]?.focus();
      } else {
        focusCloseAfterDelete.current = true;
      }
    }
    if (focusCloseAfterDelete.current && connections.length === 0) {
      focusCloseAfterDelete.current = false;
      const closeButton = document.querySelector<HTMLButtonElement>('#friendships-history-dialog-close');
      if (closeButton) closeButton.focus();
      else emptyHistoryMessage.current?.focus();
    }
  }, [confirmingDeleteId, connections.length]);

  if (connections.length === 0) {
    return <p ref={emptyHistoryMessage} className="friendships-empty" tabIndex={-1}>No connections yet.</p>;
  }

  return (
    <ol className="friendships-history-list">
      {connections.map(connection => (
        <li key={connection.id} className="friendships-history-item">
          <div className="friendships-history-item__heading">
            <strong>{connectionTypeLabels[connection.type]}</strong>
            <time dateTime={connection.date}>{formatLocalDate(connection.date)}</time>
            {connection.time && <span>{formatLocalTime(connection.time)}</span>}
          </div>
          <div className="friendships-history-item__participants">
            {connection.participantIds.map(id => (
              <PersonBadge key={id} person={personById(id)} onSelect={onPersonSelect} />
            ))}
          </div>
          {expandedId === connection.id && (
            <p className="friendships-history-item__notes">
              {connection.notes || 'No notes.'}
            </p>
          )}
          <div className="friendships-actions">
            <button
              type="button"
              className="btn mini ghost"
              aria-expanded={expandedId === connection.id}
              onClick={() => setExpandedId(current => current === connection.id ? null : connection.id)}
            >
              {expandedId === connection.id ? 'Hide details' : 'Details'}
            </button>
            <button
              type="button"
              className="btn mini ghost"
              data-connection-edit={connection.id}
              ref={button => {
                if (button) editButtons.current.set(connection.id, button);
                else editButtons.current.delete(connection.id);
              }}
              onClick={event => onEdit(connection, event)}
            >
              Edit
            </button>
            <button
              type="button"
              className="btn mini ghost"
              data-connection-delete={connection.id}
              onClick={event => {
                deleteOpener.current = event.currentTarget;
                setConfirmingDeleteId(connection.id);
              }}
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
                  onClick={() => {
                    returnToDelete.current = true;
                    setConfirmingDeleteId(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn mini"
                  onClick={() => {
                    focusEditAfterDelete.current = true;
                    onDelete(connection.id);
                    setConfirmingDeleteId(null);
                    setExpandedId(null);
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
  );
}

export function ConnectionHistoryDialog({
  personId,
  connections,
  onEdit,
  onChange,
  data,
  onPersonSelect,
  onClose
}: {
  personId: PersonId;
  connections: readonly FriendshipConnection[];
  onEdit: (connection: FriendshipConnection, event: MouseEvent<HTMLButtonElement>) => void;
  onChange: (data: FriendshipData) => void;
  data: FriendshipData;
  onPersonSelect: (personId: PersonId) => void;
  onClose: () => void;
}) {
  const person = personById(personId);
  return (
    <MoneyGoalDialog
      title={`${person.displayName} · connection history`}
      titleId="friendships-history-title"
      labelledBy="friendships-history-title"
      closeLabel="Close connection history"
      closeButtonId="friendships-history-dialog-close"
      onClose={onClose}
    >
      <ConnectionHistoryList
        connections={connections}
        onEdit={onEdit}
        onDelete={id => onChange(deleteConnection(data, id))}
        onPersonSelect={onPersonSelect}
      />
    </MoneyGoalDialog>
  );
}

export function ConnectionEditor({
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

  function submit(event: FormEvent<HTMLFormElement>) {
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

function formatLocalDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year!, month! - 1, day!, 12).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatLocalTime(value: string): string {
  const [hour, minute] = value.split(':').map(Number);
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  });
}
