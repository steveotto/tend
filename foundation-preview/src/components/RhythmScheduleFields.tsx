import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import type { ChangeEvent } from 'react';
import { validateRhythmSchedule } from '../domain/rhythm-schedule.ts';
import type {
  RhythmLocalDate,
  RhythmMonth,
  RhythmPattern,
  RhythmSchedule,
  RhythmWeekday
} from '../domain/rhythm-schedule.ts';
import { StyledSelect } from './StyledSelect.tsx';
import type { StyledSelectOption } from './StyledSelect.tsx';

type FrequencyChoice = 'daily' | 'weekly' | 'select-days' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
type PatternKind = RhythmPattern['kind'];
type CustomUnit = Extract<RhythmSchedule, { frequency: 'custom' }>['unit'];

type ScheduleFormState = {
  frequency?: FrequencyChoice;
  weekdays: RhythmWeekday[];
  patternKind: PatternKind;
  day: number | 'last';
  ordinal: 1 | 2 | 3 | 4 | 'last';
  patternWeekday: RhythmWeekday;
  month: RhythmMonth;
  monthInQuarter: 1 | 2 | 3;
  interval: string;
  unit: CustomUnit;
  startDate: string;
  hasEndDate: boolean;
  endDate: string;
};

const frequencyOptions: readonly StyledSelectOption<FrequencyChoice>[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'select-days', label: 'Select Days' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom' }
];

const weekdays: readonly { value: RhythmWeekday; label: string }[] = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
];

const months: readonly StyledSelectOption<string>[] = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
].map((label, index) => ({ value: String(index + 1), label }));

const ordinalOptions: readonly StyledSelectOption<string>[] = [
  { value: '1', label: 'First' },
  { value: '2', label: 'Second' },
  { value: '3', label: 'Third' },
  { value: '4', label: 'Fourth' },
  { value: 'last', label: 'Last' }
];

const dayOptions = (currentDay: number | 'last'): readonly StyledSelectOption<string>[] => [
  ...Array.from({ length: 28 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) })),
  { value: 'last', label: 'Last day' },
  ...(typeof currentDay === 'number' && currentDay > 28
    ? [{ value: String(currentDay), label: `${currentDay} (existing value)`, disabled: true }]
    : [])
];

const unitOptions: readonly StyledSelectOption<CustomUnit>[] = [
  { value: 'days', label: 'days' },
  { value: 'weeks', label: 'weeks' },
  { value: 'months', label: 'months' },
  { value: 'years', label: 'years' }
];

const patternOptions: readonly StyledSelectOption<PatternKind>[] = [
  { value: 'dayOfMonth', label: 'A date' },
  { value: 'ordinalWeekday', label: 'A day of the week' }
];

function localToday(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formFromSchedule(schedule?: RhythmSchedule): ScheduleFormState {
  const base: ScheduleFormState = {
    weekdays: [],
    patternKind: 'dayOfMonth',
    day: 1,
    ordinal: 1,
    patternWeekday: 0,
    month: 1,
    monthInQuarter: 1,
    interval: '1',
    unit: 'days',
    startDate: localToday(),
    hasEndDate: false,
    endDate: ''
  };
  if (!schedule) return base;

  const frequency: FrequencyChoice = schedule.frequency === 'weekly' && schedule.weekdays.length > 1
    ? 'select-days'
    : schedule.frequency;
  const schedulePattern = 'pattern' in schedule ? schedule.pattern : undefined;
  return {
    ...base,
    frequency,
    weekdays: 'weekdays' in schedule ? [...schedule.weekdays] : [],
    ...(schedulePattern?.kind === 'dayOfMonth'
      ? { patternKind: 'dayOfMonth' as const, day: schedulePattern.day }
      : {}),
    ...(schedulePattern?.kind === 'ordinalWeekday'
      ? { patternKind: 'ordinalWeekday' as const, ordinal: schedulePattern.ordinal, patternWeekday: schedulePattern.weekday }
      : {}),
    ...('month' in schedule ? { month: schedule.month } : {}),
    ...('monthInQuarter' in schedule ? { monthInQuarter: schedule.monthInQuarter } : {}),
    ...(schedule.frequency === 'custom' ? {
      interval: String(schedule.interval),
      unit: schedule.unit,
      startDate: schedule.startDate
    } : {}),
    hasEndDate: schedule.endDate !== undefined,
    endDate: schedule.endDate ?? ''
  };
}

function patternFrom(form: ScheduleFormState): RhythmPattern {
  return form.patternKind === 'dayOfMonth'
    ? { kind: 'dayOfMonth', day: form.day }
    : { kind: 'ordinalWeekday', ordinal: form.ordinal, weekday: form.patternWeekday };
}

function buildSchedule(form: ScheduleFormState): RhythmSchedule | undefined {
  if (!form.frequency) return undefined;
  const dates = form.hasEndDate ? { endDate: form.endDate as RhythmLocalDate } : {};
  let candidate: unknown;

  switch (form.frequency) {
    case 'daily':
      candidate = { frequency: 'daily', ...dates };
      break;
    case 'weekly':
      if (form.weekdays.length !== 1) return undefined;
      candidate = { frequency: 'weekly', weekdays: form.weekdays, ...dates };
      break;
    case 'select-days':
      candidate = { frequency: 'weekly', weekdays: form.weekdays, ...dates };
      break;
    case 'monthly':
      candidate = { frequency: 'monthly', pattern: patternFrom(form), ...dates };
      break;
    case 'quarterly':
      candidate = { frequency: 'quarterly', monthInQuarter: form.monthInQuarter, pattern: patternFrom(form), ...dates };
      break;
    case 'yearly':
      candidate = { frequency: 'yearly', month: form.month, pattern: patternFrom(form), ...dates };
      break;
    case 'custom': {
      const interval = Number(form.interval);
      if (form.unit === 'days') {
        candidate = { frequency: 'custom', unit: 'days', interval, startDate: form.startDate, ...dates };
      } else if (form.unit === 'weeks') {
        candidate = { frequency: 'custom', unit: 'weeks', interval, weekdays: form.weekdays, startDate: form.startDate, ...dates };
      } else if (form.unit === 'months') {
        candidate = { frequency: 'custom', unit: 'months', interval, pattern: patternFrom(form), startDate: form.startDate, ...dates };
      } else {
        candidate = {
          frequency: 'custom',
          unit: 'years',
          interval,
          month: form.month,
          pattern: patternFrom(form),
          startDate: form.startDate,
          ...dates
        };
      }
      break;
    }
  }

  const validation = validateRhythmSchedule(candidate);
  return validation.valid ? validation.schedule : undefined;
}

function dateInputValue(event: ChangeEvent<HTMLInputElement>): string {
  return event.currentTarget.value;
}

export function RhythmScheduleFields({
  schedule,
  error,
  onChange,
  children
}: {
  schedule?: RhythmSchedule | undefined;
  error?: string | undefined;
  onChange: (schedule: RhythmSchedule | undefined) => void;
  children: ReactNode;
}) {
  const [form, setForm] = useState(() => formFromSchedule(schedule));
  const weekdaysGroupId = useId();

  function update<K extends keyof ScheduleFormState>(field: K, value: ScheduleFormState[K]) {
    const next = { ...form, [field]: value };
    setForm(next);
    onChange(buildSchedule(next));
  }

  function toggleWeekday(weekday: RhythmWeekday, checked: boolean) {
    if (form.frequency === 'weekly') {
      if (checked) update('weekdays', [weekday]);
      return;
    }
    update('weekdays', checked
      ? [...form.weekdays, weekday]
      : form.weekdays.filter(selected => selected !== weekday));
  }

  const showPattern = form.frequency === 'monthly' || form.frequency === 'quarterly'
    || form.frequency === 'yearly'
    || form.frequency === 'custom' && (form.unit === 'months' || form.unit === 'years');
  const showWeekdays = form.frequency === 'weekly' || form.frequency === 'select-days'
    || form.frequency === 'custom' && form.unit === 'weeks';

  return (
    <div className="rhythm-schedule-fields">
      <div className="rhythm-schedule-fields__top-row">
        <div className="goal-field rhythm-schedule-fields__frequency">
          <label>Frequency</label>
          <StyledSelect
            label="Frequency"
            options={frequencyOptions}
            value={form.frequency ?? ''}
            placeholder="Choose a frequency"
            invalid={Boolean(error && !form.frequency)}
            onChange={frequency => update('frequency', frequency)}
          />
        </div>
        {children}
      </div>

      {form.frequency === 'custom' && (
        <div className="rhythm-schedule-fields__line rhythm-schedule-fields__repeat-every">
          <label htmlFor="rhythm-interval">Repeat every</label>
          <div className="goal-field rhythm-schedule-fields__number">
            <input
              id="rhythm-interval"
              type="number"
              min={1}
              max={365}
              step={1}
              value={form.interval}
              onChange={event => update('interval', event.currentTarget.value)}
            />
          </div>
          <div className="goal-field rhythm-schedule-fields__unit">
            <StyledSelect
              label="Repeat interval unit"
              options={unitOptions}
              value={form.unit}
              onChange={unit => update('unit', unit)}
            />
          </div>
        </div>
      )}

      {form.frequency === 'quarterly' && (
        <div className="rhythm-schedule-fields__line rhythm-schedule-fields__quarter-month">
          <span>In</span>
          <div className="goal-field">
            <StyledSelect
              label="Quarter months"
              options={[
                { value: '1', label: 'Jan · Apr · Jul · Oct' },
                { value: '2', label: 'Feb · May · Aug · Nov' },
                { value: '3', label: 'Mar · Jun · Sep · Dec' }
              ]}
              value={String(form.monthInQuarter)}
              onChange={value => update('monthInQuarter', Number(value) as 1 | 2 | 3)}
            />
          </div>
        </div>
      )}

      {showPattern && (
        <div className="rhythm-schedule-fields__pattern">
          <div className="rhythm-schedule-fields__pattern-picker">
            <span>Repeat on</span>
            <div className="goal-field">
              <StyledSelect
                label="Repeat on"
                options={patternOptions}
                value={form.patternKind}
                onChange={kind => update('patternKind', kind)}
              />
            </div>
          </div>
          {form.patternKind === 'dayOfMonth' ? (
            <div className="rhythm-schedule-fields__line">
              {form.frequency === 'yearly' ? (
                <>
                  <span>On</span>
                  <div className="goal-field rhythm-schedule-fields__month">
                    <StyledSelect
                      label="Month"
                      options={months}
                      value={String(form.month)}
                      onChange={value => update('month', Number(value) as RhythmMonth)}
                    />
                  </div>
                </>
              ) : form.frequency === 'custom' && form.unit === 'years' ? (
                <>
                  <span>In</span>
                  <div className="goal-field rhythm-schedule-fields__month">
                    <StyledSelect
                      label="Month"
                      options={months}
                      value={String(form.month)}
                      onChange={value => update('month', Number(value) as RhythmMonth)}
                    />
                  </div>
                  <span>on day</span>
                </>
              ) : (
                <span>On day</span>
              )}
              <div className="goal-field rhythm-schedule-fields__date">
                <StyledSelect
                  label="Date"
                  options={dayOptions(form.day)}
                  value={String(form.day)}
                  onChange={value => update('day', value === 'last' ? 'last' : Number(value))}
                />
              </div>
            </div>
          ) : (
            <div className="rhythm-schedule-fields__line">
              {form.frequency === 'custom' && form.unit === 'years' ? (
                <>
                  <span>In</span>
                  <div className="goal-field rhythm-schedule-fields__month">
                    <StyledSelect
                      label="Month"
                      options={months}
                      value={String(form.month)}
                      onChange={value => update('month', Number(value) as RhythmMonth)}
                    />
                  </div>
                  <span>on the</span>
                </>
              ) : (
                <span>On the</span>
              )}
              <div className="goal-field rhythm-schedule-fields__ordinal">
                <StyledSelect
                  label="Which week?"
                  options={ordinalOptions}
                  value={String(form.ordinal)}
                  onChange={value => update('ordinal', value === 'last' ? 'last' : Number(value) as 1 | 2 | 3 | 4)}
                />
              </div>
              <div className="goal-field rhythm-schedule-fields__pattern-weekday">
                <StyledSelect
                  label="Day"
                  options={weekdays.map(day => ({ value: String(day.value), label: day.label }))}
                  value={String(form.patternWeekday)}
                  onChange={value => update('patternWeekday', Number(value) as RhythmWeekday)}
                />
              </div>
              {form.frequency === 'yearly' && (
                <>
                  <span>of</span>
                  <div className="goal-field rhythm-schedule-fields__month">
                    <StyledSelect
                      label="Month"
                      options={months}
                      value={String(form.month)}
                      onChange={value => update('month', Number(value) as RhythmMonth)}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {showWeekdays && (
        <div
          className="rhythm-schedule-fields__weekday-row"
          role={form.frequency === 'weekly' ? 'radiogroup' : 'group'}
          aria-label={form.frequency === 'weekly' ? 'Choose one weekday' : 'Which days?'}
        >
          <span>On</span>
          <div className="rhythm-schedule-fields__weekday-list">
            {weekdays.map(day => (
              <label key={day.value} className="rhythm-schedule-fields__weekday">
                <input
                  type={form.frequency === 'weekly' ? 'radio' : 'checkbox'}
                  {...(form.frequency === 'weekly' ? { name: weekdaysGroupId } : {})}
                  aria-label={day.label}
                  checked={form.frequency === 'weekly'
                    ? form.weekdays.length === 1 && form.weekdays[0] === day.value
                    : form.weekdays.includes(day.value)}
                  onChange={event => toggleWeekday(day.value, event.currentTarget.checked)}
                />
                <span aria-hidden="true">{['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'][day.value]}</span>
              </label>
            ))}
          </div>
          {form.frequency === 'weekly' && form.weekdays.length !== 1 && (
            <span className="rhythm-schedule-fields__weekday-hint" role="status">
              Choose one weekday to replace the selected days.
            </span>
          )}
        </div>
      )}

      {form.frequency === 'custom' && (
        <div className="rhythm-schedule-fields__line rhythm-schedule-fields__start-date">
          <label htmlFor="rhythm-start-date">Starting on</label>
          <div className="goal-field">
            <input
              id="rhythm-start-date"
              type="date"
              value={form.startDate}
              onChange={event => update('startDate', dateInputValue(event))}
            />
          </div>
        </div>
      )}

      <label className="rhythm-schedule-fields__end-toggle">
        <input
          type="checkbox"
          checked={form.hasEndDate}
          onChange={event => update('hasEndDate', event.currentTarget.checked)}
        />
        <span>Set an end date</span>
      </label>
      {form.hasEndDate && (
        <div className="rhythm-schedule-fields__line rhythm-schedule-fields__end-date">
          <label htmlFor="rhythm-end-date">Ending on</label>
          <div className="goal-field">
            <input
              id="rhythm-end-date"
              type="date"
              value={form.endDate}
              onChange={event => update('endDate', dateInputValue(event))}
            />
          </div>
        </div>
      )}

      {error && <p className="goal-field-error" role="alert">{error}</p>}
    </div>
  );
}
