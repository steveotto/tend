import { useLayoutEffect, useRef, useState } from 'react';
import { TimeDial } from './TimeDial.tsx';

const hours = Array.from({ length: 12 }, (_, index) => index + 1);
const minutes = Array.from({ length: 60 }, (_, index) => index);
const periods = ['AM', 'PM'] as const;
const compactTimePickerBreakpoint = 400;

export function CompletionDateTimeFields({
  date,
  hour,
  minute,
  period,
  hasTime,
  dateError,
  timeError,
  idPrefix,
  onDateChange,
  onHourChange,
  onMinuteChange,
  onPeriodChange,
  onAddTime
}: {
  date: string;
  hour: number;
  minute: number;
  period: 'AM' | 'PM';
  hasTime: boolean;
  dateError: string | undefined;
  timeError: string | undefined;
  idPrefix: string;
  onDateChange: (value: string) => void;
  onHourChange: (value: number) => void;
  onMinuteChange: (value: number) => void;
  onPeriodChange: (value: 'AM' | 'PM') => void;
  onAddTime: () => void;
}) {
  const dialsRef = useRef<HTMLDivElement>(null);
  const preservePeriodFocus = useRef(false);
  const [compactTimePicker, setCompactTimePicker] = useState(false);

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
    const periodDial = dialsRef.current?.querySelector('.time-dial--period');
    const target = compactTimePicker
      ? periodDial?.querySelector<HTMLButtonElement>('.time-dial__period-option[aria-pressed="true"]')
      : periodDial?.querySelector<HTMLElement>('[role="spinbutton"]');
    target?.focus({ preventScroll: true });
  }, [compactTimePicker]);

  return (
    <>
      <label className="rhythm-completion-form__date-label" htmlFor={`${idPrefix}-date`}>Date</label>
      <input
        id={`${idPrefix}-date`}
        className="rhythm-completion-form__date"
        type="date"
        value={date}
        aria-invalid={Boolean(dateError)}
        aria-describedby={dateError ? `${idPrefix}-date-error` : undefined}
        onChange={event => onDateChange(event.currentTarget.value)}
      />
      {dateError && (
        <p id={`${idPrefix}-date-error`} className="rhythm-completion-form__error">{dateError}</p>
      )}

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
              value={hour}
              formatValue={String}
              onChange={onHourChange}
              className="time-dial--hour"
            />
            <TimeDial
              label="Minute"
              values={minutes}
              value={minute}
              formatValue={value => String(value).padStart(2, '0')}
              onChange={onMinuteChange}
              shortcuts={[0, 15, 30, 45]}
              shortcutAriaLabel={value => `Set minutes to ${String(value).padStart(2, '0')}`}
              className="time-dial--minute"
            />
            <TimeDial
              label="AM / PM"
              values={periods}
              value={period}
              formatValue={value => value}
              onChange={onPeriodChange}
              compactToggle={compactTimePicker}
              className="time-dial--period"
            />
          </div>
          {timeError && <p className="rhythm-completion-form__error" role="alert">{timeError}</p>}
        </fieldset>
      ) : (
        <div className="rhythm-completion-form__add-time">
          <button type="button" className="btn mini ghost" onClick={onAddTime}>Add time</button>
          {timeError && <p className="rhythm-completion-form__error" role="alert">{timeError}</p>}
        </div>
      )}
    </>
  );
}
