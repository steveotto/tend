import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import type { RhythmPreview } from '../domain/preview-data.ts';
import { TimeDial } from './TimeDial.tsx';

const hours = Array.from({ length: 12 }, (_, index) => index + 1);
const minutes = Array.from({ length: 60 }, (_, index) => index);
const periods = ['AM', 'PM'] as const;
const compactTimePickerBreakpoint = 400;

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
  onSaved
}: {
  rhythm: RhythmPreview;
  embedded?: boolean;
  dialogLayout?: boolean;
  headingId?: string;
  initialRecord?: RhythmCompletionRecord;
  onSave: (record: RhythmCompletionRecord) => string | null;
  onCancel: () => void;
  onSaved: () => void;
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
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dialsRef = useRef<HTMLDivElement>(null);
  const preservePeriodFocus = useRef(false);
  const [compactTimePicker, setCompactTimePicker] = useState(false);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  useLayoutEffect(() => {
    const dials = dialsRef.current;
    if (dials === null) return;

    const updateLayout = () => {
      const width = dials.clientWidth || dials.getBoundingClientRect().width;
      if (!width) return;
      const nextCompact = width <= compactTimePickerBreakpoint;
      if (nextCompact === compactTimePicker) return;
      preservePeriodFocus.current = Boolean(dials.querySelector('.time-dial--period :focus'));
      setCompactTimePicker(nextCompact);
    };

    const observer = typeof ResizeObserver === 'function'
      ? new ResizeObserver(updateLayout)
      : undefined;
    observer?.observe(dials);
    window.addEventListener('resize', updateLayout);
    updateLayout();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateLayout);
    };
  }, [compactTimePicker]);

  useLayoutEffect(() => {
    if (!preservePeriodFocus.current) return;
    preservePeriodFocus.current = false;
    const period = dialsRef.current?.querySelector('.time-dial--period');
    const target = compactTimePicker
      ? period?.querySelector<HTMLButtonElement>('.time-dial__period-option[aria-pressed="true"]')
      : period?.querySelector<HTMLElement>('[role="spinbutton"]');
    target?.focus({ preventScroll: true });
  }, [compactTimePicker]);

  function change<K extends keyof CompletionDraft>(key: K, value: CompletionDraft[K]) {
    setDraft(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key === 'hour' || key === 'minute' || key === 'period' ? 'time' : key]: undefined }));
    setFormError('');
    if (key === 'hour' || key === 'minute' || key === 'period') setTimeWasSupplied(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;

    const id = initialRecord?.id;
    let newId = id;
    if (!newId) {
      try {
        newId = globalThis.crypto.randomUUID();
      } catch {
        setFormError('A secure completion ID could not be created. No completion was saved.');
        return;
      }
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
      const error = onSave(result.record);
      if (error) {
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
    const error = onSave(record);
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
      <label className="rhythm-completion-form__date-label" htmlFor="rhythm-completion-date">Date</label>
      <input
        id="rhythm-completion-date"
        className="rhythm-completion-form__date"
        type="date"
        value={draft.effectiveDate}
        aria-invalid={Boolean(errors.effectiveDate)}
        aria-describedby={errors.effectiveDate ? 'rhythm-completion-date-error' : undefined}
        onChange={event => change('effectiveDate', event.currentTarget.value)}
      />
      {errors.effectiveDate && <p id="rhythm-completion-date-error" className="rhythm-completion-form__error">{errors.effectiveDate}</p>}

      {hasTime ? (
        <fieldset className="rhythm-completion-form__time">
          <legend>Time</legend>
          <div
            ref={dialsRef}
            className="rhythm-completion-form__dials"
            data-layout={compactTimePicker ? 'narrow' : 'wide'}
          >
            <TimeDial
              label="Hour"
              values={hours}
              value={draft.hour}
              formatValue={String}
              onChange={value => change('hour', value)}
              className="time-dial--hour"
            />
            <TimeDial
              label="Minute"
              values={minutes}
              value={draft.minute}
              formatValue={value => String(value).padStart(2, '0')}
              onChange={value => change('minute', value)}
              shortcuts={[0, 15, 30, 45]}
              shortcutAriaLabel={value => `Set minutes to ${String(value).padStart(2, '0')}`}
              className="time-dial--minute"
            />
            <TimeDial
              label="AM / PM"
              values={periods}
              value={draft.period}
              formatValue={value => value}
              onChange={value => change('period', value)}
              compactToggle={compactTimePicker}
              className="time-dial--period"
            />
          </div>
          {errors.time && <p className="rhythm-completion-form__error" role="alert">{errors.time}</p>}
        </fieldset>
      ) : (
        <div className="rhythm-completion-form__add-time">
          <button type="button" className="btn mini ghost" onClick={() => {
            setHasTime(true);
              setErrors(current => {
                const next = { ...current };
                delete next.time;
                return next;
              });
          }}>
            Add time
          </button>
          {errors.time && <p className="rhythm-completion-form__error" role="alert">{errors.time}</p>}
        </div>
      )}

      <label className="rhythm-completion-form__memory-label" htmlFor="rhythm-completion-notes">Notes <span>Optional</span></label>
      <textarea
        id="rhythm-completion-notes"
        value={draft.memory}
        maxLength={1000}
        rows={3}
        aria-invalid={Boolean(errors.memory)}
        aria-describedby={errors.memory ? 'rhythm-completion-notes-error' : undefined}
        onChange={event => change('memory', event.currentTarget.value)}
      />
      {errors.memory && <p id="rhythm-completion-notes-error" className="rhythm-completion-form__error">{errors.memory}</p>}
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
