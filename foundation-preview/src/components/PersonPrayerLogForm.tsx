import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { isValidDate, localDateString } from '../domain/money-goals.ts';
import { prepareDatedRhythmCompletion } from '../domain/rhythm-completion.ts';
import type { CompletionDraftErrors } from '../domain/rhythm-completion.ts';
import type { PersonPrayerLog, PersonPrayerRequest } from '../domain/person-prayers.ts';
import { CompletionDateTimeFields } from './CompletionDateTimeFields.tsx';
import { CompletionNotesField } from './CompletionNotesField.tsx';

type PrayerLogDraft = {
  effectiveDate: string;
  hour: number;
  minute: number;
  period: 'AM' | 'PM';
  notes: string;
};

function localDraftAt(date: Date): PrayerLogDraft {
  const hour = date.getHours();
  return {
    effectiveDate: localDateString(date),
    hour: hour % 12 || 12,
    minute: date.getMinutes(),
    period: hour < 12 ? 'AM' : 'PM',
    notes: ''
  };
}

function draftFromLog(log: PersonPrayerLog, timeZone: string): PrayerLogDraft {
  if (log.prayedOn) {
    return {
      effectiveDate: log.prayedOn,
      hour: 12,
      minute: 0,
      period: 'AM',
      notes: log.notes ?? ''
    };
  }
  if (!log.prayedAt) {
    return { effectiveDate: '', hour: 12, minute: 0, period: 'AM', notes: log.notes ?? '' };
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h12'
  }).formatToParts(new Date(log.prayedAt));
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  const hour = Number(value('hour'));
  const minute = Number(value('minute'));
  return {
    effectiveDate: `${value('year')}-${value('month')}-${value('day')}`,
    hour: Number.isInteger(hour) ? hour : 12,
    minute: Number.isInteger(minute) ? minute : 0,
    period: value('dayPeriod') === 'PM' ? 'PM' : 'AM',
    notes: log.notes ?? ''
  };
}

export function PersonPrayerLogForm({
  request,
  initialLog,
  timeZone,
  onSave,
  onCancel
}: {
  request: PersonPrayerRequest;
  initialLog?: PersonPrayerLog;
  timeZone: string;
  onSave: (log: PersonPrayerLog) => string | null;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => initialLog
    ? draftFromLog(initialLog, timeZone)
    : localDraftAt(new Date()));
  const [hasTime, setHasTime] = useState(() => initialLog ? Boolean(initialLog.prayedAt) : true);
  const [errors, setErrors] = useState<CompletionDraftErrors>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  function change<K extends keyof PrayerLogDraft>(key: K, value: PrayerLogDraft[K]) {
    setDraft(current => ({ ...current, [key]: value }));
    setErrors(current => ({
      ...current,
      [key === 'hour' || key === 'minute' || key === 'period' ? 'time' : key === 'notes' ? 'memory' : 'effectiveDate']:
        undefined
    }));
    setFormError('');
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const id = initialLog?.id ?? (() => {
      try {
        return globalThis.crypto.randomUUID();
      } catch {
        setFormError('A secure prayer entry ID could not be created. No entry was saved.');
        return null;
      }
    })();
    if (!id) return;

    if (!hasTime) {
      const currentDate = localDateString(new Date());
      const nextErrors: CompletionDraftErrors = {};
      if (!isValidDate(draft.effectiveDate)) nextErrors.effectiveDate = 'Choose a valid date.';
      else if (draft.effectiveDate > currentDate) {
        nextErrors.effectiveDate = 'Choose a date that is not in the future.';
      }
      if (draft.notes.length > 1000) nextErrors.memory = 'Notes must be 1,000 characters or fewer.';
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        return;
      }
      submitting.current = true;
      setBusy(true);
      const error = onSave({
        id,
        prayedOn: draft.effectiveDate,
        ...(draft.notes ? { notes: draft.notes } : {})
      });
      if (error) {
        submitting.current = false;
        setBusy(false);
        setFormError(error);
        return;
      }
      return;
    }

    const prepared = prepareDatedRhythmCompletion({
      id,
      rhythmId: request.id,
      effectiveDate: draft.effectiveDate,
      hour: draft.hour,
      minute: draft.minute,
      period: draft.period,
      memory: draft.notes,
      timeZone
    }, new Date());
    if (!prepared.valid) {
      setErrors(prepared.errors);
      return;
    }
    let prayedAt = prepared.record.completedAt;
    if (initialLog?.prayedAt) {
      const originalDraft = draftFromLog(initialLog, timeZone);
      const timeUnchanged = originalDraft.hour === draft.hour
        && originalDraft.minute === draft.minute
        && originalDraft.period === draft.period;
      if (timeUnchanged) {
        const remainder = Date.parse(initialLog.prayedAt) % 60_000;
        prayedAt = new Date(Date.parse(prayedAt) + remainder).toISOString();
      }
    }
    submitting.current = true;
    setBusy(true);
    const error = onSave({
      id,
      prayedAt,
      ...(draft.notes ? { notes: draft.notes } : {})
    });
    if (error) {
      submitting.current = false;
      setBusy(false);
      setFormError(error);
    }
  }

  return (
    <form className="person-prayer-log-form" onSubmit={submit}>
      <h4>{initialLog ? 'Edit logged prayer' : 'Log a prayer'}</h4>
      {initialLog && !initialLog.prayedAt && !initialLog.prayedOn && (
        <p className="person-prayer-log-form__guidance">
          This entry has no saved date. Choose one only if you know it.
        </p>
      )}
      <CompletionDateTimeFields
        date={draft.effectiveDate}
        hour={draft.hour}
        minute={draft.minute}
        period={draft.period}
        hasTime={hasTime}
        dateError={errors.effectiveDate}
        timeError={errors.time}
        idPrefix={`prayer-log-${request.id}`}
        onDateChange={value => change('effectiveDate', value)}
        onHourChange={value => change('hour', value)}
        onMinuteChange={value => change('minute', value)}
        onPeriodChange={value => change('period', value)}
        onAddTime={() => {
          const current = localDraftAt(new Date());
          setDraft(value => ({
            ...value,
            hour: current.hour,
            minute: current.minute,
            period: current.period
          }));
          setHasTime(true);
          setErrors(value => {
            const next = { ...value };
            delete next.time;
            return next;
          });
        }}
      />
      <CompletionNotesField
        id={`prayer-log-${request.id}-notes`}
        value={draft.notes}
        {...(errors.memory ? { error: errors.memory } : {})}
        onChange={value => change('notes', value)}
      />
      {formError && <p className="rhythm-completion-form__error" role="alert">{formError}</p>}
      <div className="person-prayer-log-form__actions">
        <button type="submit" className="btn mini" disabled={busy}>
          {initialLog ? 'Save changes' : 'Save prayer'}
        </button>
        <button type="button" className="btn mini ghost" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
