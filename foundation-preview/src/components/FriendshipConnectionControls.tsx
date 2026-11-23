import { useEffect, useRef, useState } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import { personById, syntheticPeople } from '../domain/preview-data.ts';
import type { PersonId, PersonPreview } from '../domain/preview-data.ts';
import { localDateString } from '../domain/money-goals.ts';
import { setPersonConnectionCadence } from '../domain/friendships.ts';
import type {
  ConnectionCadence,
  ConnectionType,
  FriendshipConnection,
  FriendshipData
} from '../domain/friendships.ts';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { PeopleParticipantPicker } from './PeopleParticipantPicker.tsx';
import { PersonConnectionCadenceSelect } from './PersonConnectionCadenceSelect.tsx';
import { StyledSelect } from './StyledSelect.tsx';
import type { StyledSelectOption } from './StyledSelect.tsx';
import { CompletionDateTimeFields } from './CompletionDateTimeFields.tsx';

export const connectionTypeLabels: Record<ConnectionType, string> = {
  text: 'Text',
  call: 'Call',
  'time-together': 'Time Together',
  rhythm: 'Rhythm',
  spark: 'Spark'
};
const connectionTypes = ['text', 'call', 'time-together'] as const;
const connectionTypeOptions: readonly StyledSelectOption<ConnectionType>[] =
  connectionTypes.map(value => ({ value, label: connectionTypeLabels[value] }));

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
      {connectionTypes.map(type => (
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
        const sparkSource = connection.sparkTitleSnapshot !== undefined
          || connection.sparkId !== undefined
          || connection.type === 'spark';
        const rhythmSource = !sparkSource && (
          connection.rhythmTitleSnapshot !== undefined
          || connection.rhythmId !== undefined
          || connection.type === 'rhythm'
        );
        const sourceKind = sparkSource ? 'spark' : rhythmSource ? 'rhythm' : 'manual';
        const sourceLabel = sourceKind === 'spark'
          ? 'Spark'
          : sourceKind === 'rhythm'
            ? 'Rhythm'
            : 'Manual';
        const sourceTitle = sourceKind === 'spark'
          ? connection.sparkTitleSnapshot
          : sourceKind === 'rhythm'
            ? connection.rhythmTitleSnapshot
            : undefined;
        const title = sourceTitle?.trim() || connectionTypeLabels[connection.type];
        const formattedDate = formatLocalDate(connection.date);
        const formattedTime = connection.time ? formatLocalTime(connection.time) : null;
        const accessibleTitle = title === sourceLabel || title === `${sourceLabel} connection`
          ? `${sourceLabel} connection`
          : `${title}, ${sourceLabel} connection`;
        return (
          <li key={connection.id} className="friendships-history-item">
            <button
              type="button"
              className="tended-rhythm-done-row friendships-connection-row"
              aria-label={`${accessibleTitle}, ${formattedDate}${formattedTime ? ` at ${formattedTime}` : ''}. Open details.`}
              onClick={event => onEdit(connection, event)}
            >
              <span
                className={`tended-rhythm-done-row__check friendships-connection-row__check friendships-connection-row__check--${sourceKind}`}
                aria-hidden="true"
              >
                ✓
              </span>
              <span className="friendships-connection-row__content">
                <span className="tended-rhythm-done-row__title friendships-connection-row__title">
                  {title}
                </span>
                <span className="friendships-connection-row__source-type">{sourceLabel}</span>
              </span>
              <span className="tended-rhythm-done-row__time friendships-connection-row__timestamp">
                <time dateTime={connection.time
                  ? `${connection.date}T${connection.time}`
                  : connection.date}
                >
                  {formattedDate}
                </time>
                {formattedTime && (
                  <>
                    <span aria-hidden="true">·</span>
                    <time dateTime={`${connection.date}T${connection.time}`}>
                      {formattedTime}
                    </time>
                  </>
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
  sparkTitle?: string;
  today: string;
  onSave: (record: FriendshipConnection) => string | null;
  onDelete?: (connectionId: string) => string | null;
  onClose: () => void;
}) {
  const sparkInitialDateTime = useRef<{
    date: string;
    hour: number;
    minute: number;
    period: 'AM' | 'PM';
  } | null>(null);
  if (sparkTitle && !record && sparkInitialDateTime.current === null) {
    const now = new Date();
    const hour24 = now.getHours();
    sparkInitialDateTime.current = {
      date: localDateString(now),
      hour: hour24 % 12 || 12,
      minute: now.getMinutes(),
      period: hour24 < 12 ? 'AM' : 'PM'
    };
  }
  const sourceUsesSharedDateTime = Boolean(sparkTitle || record?.type === 'spark');
  const initialSourceTime = record?.time?.split(':') ?? [];
  const initialHour24 = initialSourceTime[0] !== undefined
    ? Number(initialSourceTime[0])
    : sparkInitialDateTime.current?.hour
      ? (sparkInitialDateTime.current.period === 'PM'
          ? (sparkInitialDateTime.current.hour % 12) + 12
          : sparkInitialDateTime.current.hour % 12)
      : 12;
  const initialMinute = initialSourceTime[1] !== undefined
    ? Number(initialSourceTime[1])
    : sparkInitialDateTime.current?.minute ?? 0;
  const [type, setType] = useState<ConnectionType | ''>(
    record?.type ?? (sparkTitle ? 'spark' : initialType ?? 'text')
  );
  const [date, setDate] = useState(record?.date
    ?? initialDate
    ?? sparkInitialDateTime.current?.date
    ?? today);
  const [time, setTime] = useState(record?.time ?? '');
  const [hour, setHour] = useState(initialHour24 % 12 || 12);
  const [minute, setMinute] = useState(initialMinute);
  const [period, setPeriod] = useState<'AM' | 'PM'>(
    initialHour24 < 12 ? 'AM' : 'PM'
  );
  const [hasTime, setHasTime] = useState(sourceUsesSharedDateTime
    ? record ? Boolean(record.time) : true
    : true);
  const [participantIds, setParticipantIds] = useState<PersonId[]>(initialParticipantIds);
  const [notes, setNotes] = useState(record?.notes ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const creationId = useRef<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deleteTrigger = useRef<HTMLButtonElement>(null);
  const deleteCancel = useRef<HTMLButtonElement>(null);
  const returnToDelete = useRef(false);
  const isOwnedRhythmConnection = record?.ownedByRhythmCompletion === true;
  const sourceTitle = record?.sparkTitleSnapshot ?? record?.rhythmTitleSnapshot;
  const sourceLabel = record?.sparkTitleSnapshot !== undefined || record?.sparkId !== undefined
    ? 'Spark'
    : record?.rhythmTitleSnapshot !== undefined || record?.rhythmId !== undefined
      ? 'Rhythm'
      : null;

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
    if (submitting.current) return;
    if (!date) {
      setError('Choose a connection date.');
      return;
    }
    const sourceTime = sourceUsesSharedDateTime
      ? hasTime
        ? `${String((hour % 12) + (period === 'PM' ? 12 : 0)).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
        : ''
      : time;
    if (sourceUsesSharedDateTime && hasTime
      && !/^([01]\d|2[0-3]):[0-5]\d$/.test(sourceTime)) {
      setError('Choose a valid connection time.');
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
    let id = record?.id ?? creationId.current;
    if (!id) {
      try {
        id = `friendship-connection-${globalThis.crypto.randomUUID()}`;
        creationId.current = id;
      } catch {
        setError('A secure Connection ID could not be created. No connection was saved.');
        return;
      }
    }
    const {
      time: _previousTime,
      timeZone: _previousTimeZone,
      notes: _previousNotes,
      ...existingFields
    } = record ?? {};
    const next: FriendshipConnection = {
      ...existingFields,
      id,
      type,
      date,
      ...(sourceTime ? {
        time: sourceTime,
        ...(record?.timeZone
          ? { timeZone: record.timeZone }
          : sourceUsesSharedDateTime
            ? { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
            : {})
      } : {}),
      participantIds,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(sparkTitle ? { sparkTitleSnapshot: sparkTitle } : {})
    };
    submitting.current = true;
    setBusy(true);
    const saveError = onSave(next);
    if (saveError) {
      submitting.current = false;
      setBusy(false);
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
        ? { intro: `Completing “${sparkTitle}” will save one Spark connection. Confirm the actual date and participants before saving.` }
        : {})}
      initialFocusId={sparkTitle ? 'friendship-connection-date' : 'friendship-connection-type'}
      closeLabel="Close connection editor"
      phoneFullScreen
      {...(sourceUsesSharedDateTime ? { scrollableBody: true } : {})}
      onClose={onClose}
    >
      <form className="friendships-connection-form" onSubmit={submit} noValidate>
        {sparkTitle ? (
          <p className="friendships-connection-form__source-context">
            <strong>Spark</strong>
            <span>{sparkTitle}</span>
          </p>
        ) : (
          <label>
            <span>Connection type</span>
            <StyledSelect
              id="friendship-connection-type"
              label="Connection type"
              options={record?.type === 'rhythm' || record?.type === 'spark'
                ? [...connectionTypeOptions, { value: record.type, label: connectionTypeLabels[record.type] }]
                : connectionTypeOptions}
              value={type}
              matchTriggerWidth
              containerClassName="friendships-connection-type"
              triggerClassName="friendships-connection-type__trigger"
              onChange={setType}
            />
          </label>
        )}
        {record && sourceTitle && sourceLabel && (
          <p className="friendships-connection-form__source-context">
            <strong>{sourceLabel}</strong>
            <span>{sourceTitle}</span>
          </p>
        )}
        {sourceUsesSharedDateTime ? (
          <CompletionDateTimeFields
            date={date}
            hour={hour}
            minute={minute}
            period={period}
            hasTime={hasTime}
            idPrefix="friendship-connection"
            dateError={undefined}
            timeError={undefined}
            onDateChange={setDate}
            onHourChange={setHour}
            onMinuteChange={setMinute}
            onPeriodChange={setPeriod}
            onAddTime={() => setHasTime(true)}
          />
        ) : (
          <div className="friendships-date-fields">
            <label>
              <span>Date</span>
              <input
                id="friendship-connection-date"
                type="date"
                value={date}
                onChange={event => setDate(event.currentTarget.value)}
                required
              />
            </label>
            <label>
              <span>Time (optional)</span>
              <input type="time" value={time} onChange={event => setTime(event.currentTarget.value)} />
            </label>
          </div>
        )}
        <PeopleParticipantPicker
          people={people}
          selectedIds={participantIds}
          onChange={(personId, selected) => setParticipantIds(current => selected
            ? current.includes(personId) ? current : [...current, personId]
            : current.filter(id => id !== personId))}
        />
        {isOwnedRhythmConnection && (
          <p className="friendships-connection-form__ownership-note">
            Saving changes keeps the Rhythm title as context and detaches this Connection from the completion, so undoing that completion will not remove it.
          </p>
        )}
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
          <button type="submit" className="btn mini" disabled={busy}>
            {record ? 'Save changes' : 'Save connection'}
          </button>
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
  if (type === 'spark') {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
        <path d="m10 1.5 2.2 6.3 6.3 2.2-6.3 2.2L10 18.5l-2.2-6.3L1.5 10l6.3-2.2z" />
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
