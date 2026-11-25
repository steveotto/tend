import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { localDateString } from '../domain/money-goals.ts';
import {
  prepareDatedRhythmCompletion,
  prepareUndatedRhythmCompletionEdit
} from '../domain/rhythm-completion.ts';
import type {
  CompletionDraft,
  CompletionDraftErrors,
  RhythmCompletionRecord
} from '../domain/rhythm-completion.ts';
import { syntheticPeople } from '../domain/preview-data.ts';
import type { PersonPreview, RhythmPreview } from '../domain/preview-data.ts';
import type { PersonId } from '../domain/preview-data.ts';
import { PeopleParticipantPicker } from './PeopleParticipantPicker.tsx';
import { CompletionDateTimeFields } from './CompletionDateTimeFields.tsx';
import { CompletionNotesField } from './CompletionNotesField.tsx';

function localDraftAt(date: Date): CompletionDraft {
  const hour = date.getHours();
  return {
    effectiveDate: localDateString(date),
    hour: hour % 12 || 12,
    minute: date.getMinutes(),
    period: hour < 12 ? 'AM' : 'PM',
    memory: ''
  };
}

export function RhythmCompletionForm({
  rhythm,
  embedded = false,
  dialogLayout = false,
  headingId = 'rhythm-details-title',
  initialRecord,
  onSave,
  onCancel,
  onSaved,
  people = syntheticPeople
}: {
  rhythm: RhythmPreview;
  embedded?: boolean;
  dialogLayout?: boolean;
  headingId?: string;
  initialRecord?: RhythmCompletionRecord;
  onSave: (record: RhythmCompletionRecord, connectionParticipantIds?: PersonId[]) => string | null;
  onCancel: () => void;
  onSaved: () => void;
  people?: readonly PersonPreview[];
}) {
  const [draft, setDraft] = useState(() => initialRecord
    ? draftFromRecord(initialRecord)
    : localDraftAt(new Date()));
  const [hasTime, setHasTime] = useState(() => !initialRecord || Boolean(initialRecord.localTime));
  const [timeWasSupplied, setTimeWasSupplied] = useState(() => !initialRecord || Boolean(initialRecord.localTime));
  const [errors, setErrors] = useState<CompletionDraftErrors>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const creationId = useRef<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [logConnection, setLogConnection] = useState(() =>
    !initialRecord && Boolean(rhythm.alsoLogConnection) && (rhythm.personIds?.length ?? 0) > 0
  );
  const [connectionParticipantIds, setConnectionParticipantIds] = useState<PersonId[]>(() =>
    !initialRecord ? [...(rhythm.personIds ?? [])] as PersonId[] : []
  );
  const [connectionError, setConnectionError] = useState('');

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  function change<K extends keyof CompletionDraft>(key: K, value: CompletionDraft[K]) {
    setDraft(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key === 'hour' || key === 'minute' || key === 'period' ? 'time' : key]: undefined }));
    setFormError('');
    if (key === 'hour' || key === 'minute' || key === 'period') setTimeWasSupplied(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;

    let newId = initialRecord?.id ?? creationId.current ?? undefined;
    if (!newId) {
      try {
        newId = globalThis.crypto.randomUUID();
        creationId.current = newId;
      } catch {
        setFormError('A secure completion ID could not be created. No completion was saved.');
        return;
      }
    }
    if (logConnection && connectionParticipantIds.length === 0) {
      setConnectionError('Choose at least one person, or skip the connection.');
      return;
    }
    if (!hasTime) {
      const result = prepareUndatedRhythmCompletionEdit({
        id: newId,
        rhythmId: initialRecord?.rhythmId ?? rhythm.id,
        effectiveDate: draft.effectiveDate,
        memory: draft.memory
      }, new Date());
      if (!result.valid) {
        setErrors(result.errors);
        return;
      }
      submitting.current = true;
      setBusy(true);
      const error = onSave(
        result.record,
        logConnection ? connectionParticipantIds : undefined
      );
      if (error) {
        submitting.current = false;
        setBusy(false);
        setFormError(error);
        return;
      }
      onSaved();
      return;
    }
    if (!timeWasSupplied) {
      setErrors({ time: 'Choose a time, or leave it unrecorded.' });
      return;
    }

    const now = new Date();
    const result = prepareDatedRhythmCompletion({
      ...draft,
      id: newId,
      rhythmId: initialRecord?.rhythmId ?? rhythm.id,
      timeZone: initialRecord?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
    }, now);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }

    submitting.current = true;
    setBusy(true);
    const { recordedAt: generatedRecordedAt, ...datedRecord } = result.record;
    const record = initialRecord
      ? {
          ...datedRecord,
          id: initialRecord.id,
          rhythmId: initialRecord.rhythmId,
          ...(initialRecord.recordedAt ? { recordedAt: initialRecord.recordedAt } : {})
        }
      : { ...result.record, recordedAt: generatedRecordedAt };
    const error = onSave(
      record,
      logConnection ? connectionParticipantIds : undefined
    );
    if (error) {
      submitting.current = false;
      setBusy(false);
      setFormError(error);
      return;
    }
    onSaved();
  }

  const form = (
    <form
      className={[
        'rhythm-completion-form',
        embedded ? 'rhythm-completion-form--embedded' : '',
        dialogLayout ? 'rhythm-completion-form--dialog-layout' : ''
      ].filter(Boolean).join(' ')}
      onSubmit={submit}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <h3 ref={headingRef} id={headingId} className="rhythm-completion-form__heading" tabIndex={-1}>
        {initialRecord ? 'Edit logged moment' : 'When did you tend it?'}
      </h3>
      {embedded && <p className="rhythm-completion-form__rhythm">{rhythm.title}</p>}
      <CompletionDateTimeFields
        date={draft.effectiveDate}
        hour={draft.hour}
        minute={draft.minute}
        period={draft.period}
        hasTime={hasTime}
        dateError={errors.effectiveDate}
        timeError={errors.time}
        idPrefix="rhythm-completion"
        onDateChange={value => change('effectiveDate', value)}
        onHourChange={value => change('hour', value)}
        onMinuteChange={value => change('minute', value)}
        onPeriodChange={value => change('period', value)}
        onAddTime={() => {
          setHasTime(true);
          setErrors(current => {
            const next = { ...current };
            delete next.time;
            return next;
          });
        }}
      />

      {!initialRecord && Boolean(rhythm.alsoLogConnection) && (rhythm.personIds?.length ?? 0) > 0 && (
        <fieldset className="rhythm-completion-form__connection">
          <legend>Connection</legend>
          <label className="rhythm-completion-form__connection-toggle">
            <input
              type="checkbox"
              checked={logConnection}
              onChange={event => {
                setLogConnection(event.currentTarget.checked);
                setConnectionError('');
              }}
            />
            <span>Also log a connection</span>
          </label>
          {logConnection && (
            <PeopleParticipantPicker
              people={people}
              selectedIds={connectionParticipantIds}
              onChange={(personId, selected) => {
                setConnectionParticipantIds(current => selected
                  ? [...new Set([...current, personId])]
                  : current.filter(id => id !== personId));
                setConnectionError('');
              }}
            />
          )}
          {connectionError && <p className="rhythm-completion-form__error" role="alert">{connectionError}</p>}
        </fieldset>
      )}

      <CompletionNotesField
        id="rhythm-completion-notes"
        value={draft.memory}
        {...(errors.memory ? { error: errors.memory } : {})}
        onChange={value => change('memory', value)}
      />
      {formError && <p className="rhythm-completion-form__error" role="alert">{formError}</p>}

      <div className="money-goal-dialog__actions rhythm-completion-form__actions">
        <button type="submit" className="btn mini" disabled={busy}>Save</button>
        <button type="button" className="btn mini ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );

  return form;
}

function draftFromRecord(record: RhythmCompletionRecord): CompletionDraft {
  const [hourText = '00', minuteText = '00'] = record.localTime?.split(':') ?? [];
  const hour = Number(hourText);
  return {
    effectiveDate: record.effectiveDate,
    hour: hour % 12 || 12,
    minute: Number(minuteText),
    period: hour < 12 ? 'AM' : 'PM',
    memory: record.memory ?? ''
  };
}
