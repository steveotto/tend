import { useEffect, useRef, useState } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import { personById, syntheticPeople } from '../domain/preview-data.ts';
import type { PersonId, PersonPreview } from '../domain/preview-data.ts';
import { setPersonConnectionCadence } from '../domain/friendships.ts';
import type {
  ConnectionCadence,
  ConnectionType,
  FriendshipConnection,
  FriendshipData
} from '../domain/friendships.ts';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { PersonBadgeVisual } from './PersonBadge.tsx';
import { PersonConnectionCadenceSelect } from './PersonConnectionCadenceSelect.tsx';
import { StyledSelect } from './StyledSelect.tsx';
import type { StyledSelectOption } from './StyledSelect.tsx';

export const connectionTypeLabels: Record<ConnectionType, string> = {
  text: 'Text',
  call: 'Call',
  'time-together': 'Time Together'
};
const connectionTypes = ['text', 'call', 'time-together'] as const;
const connectionTypeOptions: readonly StyledSelectOption<ConnectionType>[] =
  connectionTypes.map(value => ({ value, label: connectionTypeLabels[value] }));
const unconfirmedConnectionTypeOptions: readonly StyledSelectOption<ConnectionType | ''>[] = [
  { value: '', label: 'Choose type' },
  ...connectionTypeOptions
];

export function ConnectionTypeActions({
  personId,
  people = syntheticPeople,
  onSelect
}: {
  personId: PersonId;
  people?: readonly PersonPreview[];
  onSelect: (type: ConnectionType, event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const person = personById(people, personId);
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
  people = syntheticPeople,
  cadence,
  today,
  data,
  onChange
}: {
  personId: PersonId;
  people?: readonly PersonPreview[];
  cadence: ConnectionCadence | null;
  today: string;
  data: FriendshipData;
  onChange: (data: FriendshipData) => void;
}) {
  void people;
  return (
    <PersonConnectionCadenceSelect
      id={`friendships-cadence-${personId}`}
      value={cadence}
      onChange={next => onChange(setPersonConnectionCadence(data, personId, next, today))}
    />
  );
}

export function ConnectionHistoryList({
  connections,
  onEdit
}: {
  connections: readonly FriendshipConnection[];
  onEdit: (connection: FriendshipConnection, event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const emptyHistoryMessage = useRef<HTMLParagraphElement>(null);

  if (connections.length === 0) {
    return <p ref={emptyHistoryMessage} className="friendships-empty" tabIndex={-1}>No connections yet.</p>;
  }

  return (
    <ol className="friendships-history-list">
      {connections.map(connection => {
        const notes = connection.notes?.trim();
        const notesId = `friendships-connection-notes-${connection.id}`;
        return (
          <li key={connection.id} className="friendships-history-item">
            <button
              type="button"
              className="tended-rhythm-done-row friendships-connection-row"
              aria-label={`${connectionTypeLabels[connection.type]} connection, ${formatLocalDate(connection.date)}${connection.time ? ` at ${formatLocalTime(connection.time)}` : ''}. Open details.`}
              {...(notes ? { 'aria-describedby': notesId } : {})}
              onClick={event => onEdit(connection, event)}
            >
              <span className="friendships-connection-row__heading">
                <span className="friendships-connection-row__icon" aria-hidden="true">
                  <ConnectionTypeIcon type={connection.type} />
                </span>
                <span className="friendships-connection-row__title">{connectionTypeLabels[connection.type]}</span>
              </span>
              <span className="friendships-connection-row__chevron" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="none">
                  <path d="m5 3 5 5-5 5" />
                </svg>
              </span>
              {notes && <span id={notesId} className="friendships-connection-row__notes">{notes}</span>}
              <span className="friendships-connection-row__footer">
                <time dateTime={connection.date}>{formatLocalDate(connection.date)}</time>
                {connection.time && (
                  <time dateTime={`${connection.date}T${connection.time}`}>
                    {formatLocalTime(connection.time)}
                  </time>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function ConnectionHistoryDialog({
  personId,
  people = syntheticPeople,
  connections,
  onEdit,
  onClose
}: {
  personId: PersonId;
  people?: readonly PersonPreview[];
  connections: readonly FriendshipConnection[];
  onEdit: (connection: FriendshipConnection, event: MouseEvent<HTMLButtonElement>) => void;
  onClose: () => void;
}) {
  const person = personById(people, personId);
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
      />
    </MoneyGoalDialog>
  );
}

export function ConnectionEditor({
  record,
  people = syntheticPeople,
  initialParticipantIds,
  initialType,
  initialDate,
  requireTypeConfirmation = false,
  sparkTitle,
  today,
  onSave,
  onDelete,
  onClose
}: {
  record?: FriendshipConnection;
  people?: readonly PersonPreview[];
  initialParticipantIds: PersonId[];
  initialType?: ConnectionType;
  initialDate?: string;
  requireTypeConfirmation?: boolean;
  sparkTitle?: string;
  today: string;
  onSave: (record: FriendshipConnection) => string | null;
  onDelete?: (connectionId: string) => string | null;
  onClose: () => void;
}) {
  const [type, setType] = useState<ConnectionType | ''>(
    record?.type ?? initialType ?? (requireTypeConfirmation ? '' : 'text')
  );
  const [date, setDate] = useState(record?.date ?? initialDate ?? today);
  const [time, setTime] = useState(record?.time ?? '');
  const [participantIds, setParticipantIds] = useState<PersonId[]>(initialParticipantIds);
  const [notes, setNotes] = useState(record?.notes ?? '');
  const [error, setError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deleteTrigger = useRef<HTMLButtonElement>(null);
  const deleteCancel = useRef<HTMLButtonElement>(null);
  const returnToDelete = useRef(false);

  useEffect(() => {
    if (confirmingDelete) {
      deleteCancel.current?.focus();
    } else if (returnToDelete.current) {
      returnToDelete.current = false;
      deleteTrigger.current?.focus();
    }
  }, [confirmingDelete]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!date) {
      setError('Choose a connection date.');
      return;
    }
    if (!type) {
      setError('Choose the actual connection type.');
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
      title={sparkTitle ? 'Log a connection for this Spark' : record ? 'Connection details' : 'Log connection'}
      titleId="friendship-connection-title"
      labelledBy="friendship-connection-title"
      {...(sparkTitle
        ? { intro: `Completing “${sparkTitle}” will save one Connection record. Confirm the type, actual date and participants before saving.` }
        : {})}
      initialFocusId="friendship-connection-type"
      closeLabel="Close connection editor"
      phoneFullScreen
      onClose={onClose}
    >
      <form className="friendships-connection-form" onSubmit={submit} noValidate>
        <label>
          <span>Connection type</span>
          <StyledSelect
            id="friendship-connection-type"
            label="Connection type"
            options={requireTypeConfirmation ? unconfirmedConnectionTypeOptions : connectionTypeOptions}
            value={type}
            matchTriggerWidth
            containerClassName="friendships-connection-type"
            triggerClassName="friendships-connection-type__trigger"
            onChange={setType}
          />
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
          {people.map(person => (
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
        <div className="friendships-connection-notes">
          <label>
            <span>Notes (optional)</span>
            <textarea
              aria-describedby="friendship-connection-note-count"
              maxLength={4000}
              value={notes}
              onChange={event => setNotes(event.currentTarget.value)}
            />
          </label>
          <span id="friendship-connection-note-count" className="friendships-connection-form__note-count" aria-live="polite">
            {notes.length} / 4,000 characters
          </span>
        </div>
        {error && <p className="friendships-form-error" role="alert">{error}</p>}
        <div className="money-goal-dialog__actions">
          <button type="submit" className="btn mini">{record ? 'Save changes' : 'Save connection'}</button>
          <button type="button" className="btn mini ghost" onClick={onClose}>Cancel</button>
        </div>
        {record && onDelete && (
          <div className="friendships-connection-delete">
            <button
              ref={deleteTrigger}
              type="button"
              className="friendships-connection-delete__button"
              aria-label="Delete connection"
              onClick={() => {
                setDeleteError('');
                setConfirmingDelete(true);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 4v5m4-5v5" />
              </svg>
              <span>Delete connection</span>
            </button>
          </div>
        )}
        {confirmingDelete && record && onDelete && (
          <div
            className="friendships-delete-confirmation"
            role="alertdialog"
            aria-labelledby="friendship-connection-delete-title"
          >
            <p id="friendship-connection-delete-title">
              {record.sparkId
                ? 'Delete this Spark connection from every participant’s history and restore its Spark to pending?'
                : 'Delete this connection from the history of all its participants?'}
            </p>
            {deleteError && <p className="friendships-form-error" role="alert">{deleteError}</p>}
            <div className="friendships-actions">
              <button
                ref={deleteCancel}
                type="button"
                className="btn mini ghost"
                onClick={() => {
                  returnToDelete.current = true;
                  setDeleteError('');
                  setConfirmingDelete(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn mini"
                onClick={() => {
                  const deleteErrorMessage = onDelete(record.id);
                  if (deleteErrorMessage) {
                    setDeleteError(deleteErrorMessage);
                    return;
                  }
                  onClose();
                }}
              >
                {record.sparkId ? 'Delete and restore Spark' : 'Delete connection'}
              </button>
            </div>
          </div>
        )}
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
