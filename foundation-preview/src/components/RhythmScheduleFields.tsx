import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import type { ChangeEvent } from 'react';
import { isValidDate } from '../domain/money-goals.ts';
import { validateRhythmSchedule } from '../domain/rhythm-schedule.ts';
import type {
  RhythmFrequencyRecommendation,
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
  patternKind?: PatternKind;
  day?: number | 'last';
  ordinal?: 1 | 2 | 3 | 4 | 'last';
  patternWeekday?: RhythmWeekday;
  month?: RhythmMonth;
  monthInQuarter?: 1 | 2 | 3;
  interval: string;
  unit: CustomUnit;
  startDate: string;
  hasEndDate: boolean;
  endDate: string;
};

const frequencyOptions: readonly StyledSelectOption<FrequencyChoice>[] = [
  { value: 'select-days', label: 'Select Days' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
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

const dayOptions = (currentDay?: number | 'last'): readonly StyledSelectOption<string>[] => [
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

function formFromSchedule(
  schedule?: RhythmSchedule,
  requireExplicitChoices = false,
  initialFrequency?: RhythmFrequencyRecommendation
): ScheduleFormState {
  const recommendedFrequency = initialFrequency === 'every-two-weeks'
    ? 'custom'
    : initialFrequency;
  const everyTwoWeeks = schedule === undefined && initialFrequency === 'every-two-weeks';
  const base: ScheduleFormState = {
    weekdays: [],
    ...(schedule === undefined && recommendedFrequency ? { frequency: recommendedFrequency } : {}),
    ...(!requireExplicitChoices || schedule ? {
      patternKind: 'dayOfMonth' as const,
      day: 1,
      ordinal: 1 as const,
      patternWeekday: 0 as const,
      month: 1 as const,
      monthInQuarter: 1 as const
    } : {}),
    interval: everyTwoWeeks ? '2' : '1',
    unit: everyTwoWeeks ? 'weeks' : 'days',
    startDate: localToday(),
    hasEndDate: false,
    endDate: ''
  };
  if (!schedule) return base;

  const frequency: FrequencyChoice = schedule.frequency === 'weekly'
    && (schedule.weeklyMode === 'select-days' || schedule.weekdays.length > 1)
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

function patternFrom(form: ScheduleFormState): RhythmPattern | undefined {
  if (form.patternKind === 'dayOfMonth' && form.day !== undefined) {
    return { kind: 'dayOfMonth', day: form.day };
  }
  if (form.patternKind === 'ordinalWeekday'
    && form.ordinal !== undefined && form.patternWeekday !== undefined) {
    return { kind: 'ordinalWeekday', ordinal: form.ordinal, weekday: form.patternWeekday };
  }
  return undefined;
}

export type RhythmScheduleFieldsDraft = {
  schedule?: RhythmSchedule;
  displaySchedule?: RhythmSchedule;
  hasEndDate: boolean;
  endDate: string;
  validationMessage?: string;
  validationField?: 'weekdays';
};

function buildSchedule(form: ScheduleFormState): RhythmScheduleFieldsDraft {
  if (!form.frequency) {
    return {
      hasEndDate: form.hasEndDate,
      endDate: form.endDate,
      validationMessage: 'Choose a frequency.'
    };
  }
  if (form.frequency === 'weekly' && form.weekdays.length !== 1) {
    return {
      hasEndDate: form.hasEndDate,
      endDate: form.endDate,
      validationMessage: 'Choose one day.',
      validationField: 'weekdays'
    };
  }
  if ((form.frequency === 'select-days' || form.frequency === 'custom' && form.unit === 'weeks')
    && form.weekdays.length === 0) {
    return {
      hasEndDate: form.hasEndDate,
      endDate: form.endDate,
      validationMessage: 'Choose at least one day.',
      validationField: 'weekdays'
    };
  }
  const pattern = patternFrom(form);
  if ((form.frequency === 'monthly' || form.frequency === 'quarterly' || form.frequency === 'yearly'
    || form.frequency === 'custom' && (form.unit === 'months' || form.unit === 'years'))
    && !pattern) {
    return {
      hasEndDate: form.hasEndDate,
      endDate: form.endDate,
      validationMessage: 'Choose a complete date or day pattern.'
    };
  }
  if (form.frequency === 'quarterly' && form.monthInQuarter === undefined) {
    return {
      hasEndDate: form.hasEndDate,
      endDate: form.endDate,
      validationMessage: 'Choose which months to use in each quarter.'
    };
  }
  if (form.frequency === 'yearly' && form.month === undefined) {
    return {
      hasEndDate: form.hasEndDate,
      endDate: form.endDate,
      validationMessage: 'Choose a month.'
    };
  }
  let candidate: unknown;

  switch (form.frequency) {
    case 'daily':
      candidate = { frequency: 'daily' };
      break;
    case 'weekly':
      candidate = { frequency: 'weekly', weekdays: form.weekdays };
      break;
    case 'select-days':
      candidate = {
        frequency: 'weekly',
        weekdays: form.weekdays,
        ...(form.weekdays.length === 1 ? { weeklyMode: 'select-days' } : {})
      };
      break;
    case 'monthly':
      candidate = { frequency: 'monthly', pattern: pattern! };
      break;
    case 'quarterly':
      candidate = { frequency: 'quarterly', monthInQuarter: form.monthInQuarter!, pattern: pattern! };
      break;
    case 'yearly':
      candidate = { frequency: 'yearly', month: form.month!, pattern: pattern! };
      break;
    case 'custom': {
      const interval = Number(form.interval);
      if (form.unit === 'days') {
        candidate = { frequency: 'custom', unit: 'days', interval, startDate: form.startDate };
      } else if (form.unit === 'weeks') {
        candidate = { frequency: 'custom', unit: 'weeks', interval, weekdays: form.weekdays, startDate: form.startDate };
      } else if (form.unit === 'months') {
        candidate = { frequency: 'custom', unit: 'months', interval, pattern: pattern!, startDate: form.startDate };
      } else {
        candidate = {
          frequency: 'custom',
          unit: 'years',
          interval,
          month: form.month!,
          pattern: pattern!,
          startDate: form.startDate
        };
      }
      break;
    }
  }

  const validation = validateRhythmSchedule(candidate);
  if (!validation.valid) {
    const message = form.frequency === 'custom' && !isValidDate(form.startDate)
      ? 'Choose a valid recurrence starting date.'
      : 'Complete the schedule details.';
    return {
      hasEndDate: form.hasEndDate,
      endDate: form.endDate,
      validationMessage: message
    };
  }
  const displaySchedule = validation.schedule;
  if (!form.hasEndDate) {
    return { schedule: displaySchedule, displaySchedule, hasEndDate: false, endDate: '' };
  }
  if (!isValidDate(form.endDate)) {
    return {
      displaySchedule,
      hasEndDate: true,
      endDate: form.endDate,
      validationMessage: 'Choose a valid end date.'
    };
  }
  const scheduleWithEndDate = validateRhythmSchedule({
    ...displaySchedule,
    endDate: form.endDate as RhythmLocalDate
  });
  if (!scheduleWithEndDate.valid) {
    return {
      displaySchedule,
      hasEndDate: true,
      endDate: form.endDate,
      validationMessage: 'Choose a valid end date.'
    };
  }
  return {
    schedule: scheduleWithEndDate.schedule,
    displaySchedule: scheduleWithEndDate.schedule,
    hasEndDate: true,
    endDate: form.endDate
  };
}

function dateInputValue(event: ChangeEvent<HTMLInputElement>): string {
  return event.currentTarget.value;
}

export function RhythmScheduleFields({
  schedule,
  error,
  onChange,
  onDraftChange,
  onEndDateValidationChange,
  defaultEndDate,
  requireExplicitChoices = false,
  showScheduleControls = true,
  endDatePlacement = 'after-recurrence',
  initialFrequency,
  frequencyGuidance,
  children
}: {
  schedule?: RhythmSchedule | undefined;
  error?: string | undefined;
  onChange: (schedule: RhythmSchedule | undefined) => void;
  onDraftChange?: (draft: RhythmScheduleFieldsDraft) => void;
  onEndDateValidationChange?: (message: string | undefined) => void;
  defaultEndDate?: string;
  requireExplicitChoices?: boolean;
  showScheduleControls?: boolean;
  endDatePlacement?: 'after-time' | 'after-recurrence';
  initialFrequency?: RhythmFrequencyRecommendation;
  frequencyGuidance?: string;
  children: ReactNode;
}) {
  const [form, setForm] = useState(() => formFromSchedule(schedule, requireExplicitChoices, initialFrequency));
  const weekdaysGroupId = useId();
  const weekdaysErrorId = `${useId()}-weekdays-error`;
  const patternTypeLabelId = `${useId()}-pattern-type-label`;
  const patternDetailsLabelId = `${useId()}-pattern-details-label`;

  function update<K extends keyof ScheduleFormState>(field: K, value: ScheduleFormState[K]) {
    const next = { ...form, [field]: value };
    setForm(next);
    const result = buildSchedule(next);
    onChange(result.schedule);
    onDraftChange?.(result);
    onEndDateValidationChange?.(result.hasEndDate
      && (result.validationMessage === 'Choose a frequency.'
        || result.validationMessage === 'Choose a valid end date.')
      ? result.validationMessage
      : undefined);
  }

  function toggleEndDate(hasEndDate: boolean) {
    const next = {
      ...form,
      hasEndDate,
      endDate: hasEndDate && !form.endDate
        ? defaultEndDate ?? localToday()
        : form.endDate
    };
    setForm(next);
    const result = buildSchedule(next);
    onChange(result.schedule);
    onDraftChange?.(result);
    onEndDateValidationChange?.(result.hasEndDate
      && (result.validationMessage === 'Choose a frequency.'
        || result.validationMessage === 'Choose a valid end date.')
      ? result.validationMessage
      : undefined);
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
  const missingWeekdays = (form.frequency === 'select-days' || form.frequency === 'custom' && form.unit === 'weeks')
    && form.weekdays.length === 0;
  const weekdaysError = form.frequency === 'weekly' && form.weekdays.length !== 1
    ? 'Choose one day.'
    : missingWeekdays && (error !== undefined || onDraftChange !== undefined)
      ? 'Choose at least one day.'
      : undefined;
  const showScheduleError = error && !(weekdaysError
    && (error === 'Complete the schedule details before saving.' || error === 'Choose a valid schedule.'));
  const endDateControl = (
    <>
      <div className="rhythm-schedule-fields__end-date-row">
        <label className="rhythm-schedule-fields__end-toggle">
          <input
            type="checkbox"
            checked={form.hasEndDate}
            onChange={event => toggleEndDate(event.currentTarget.checked)}
          />
          <span>Set an end date</span>
        </label>
        {form.hasEndDate && (
          <div className="goal-field rhythm-schedule-fields__end-date">
            <input
              id="rhythm-end-date"
              type="date"
              aria-label="End date"
              value={form.endDate}
              onChange={event => update('endDate', dateInputValue(event))}
            />
          </div>
        )}
      </div>
      {form.hasEndDate && !form.frequency && (
        <p className="rhythm-schedule-fields__end-date-prerequisite" role="status">
          Choose a frequency before setting an end date.
        </p>
      )}
    </>
  );

  return (
    <div className="rhythm-schedule-fields">
      <div className="rhythm-schedule-fields__top-row">
        {showScheduleControls && (
          <div className="goal-field rhythm-schedule-fields__frequency">
            <label>Frequency</label>
            <StyledSelect
              label="Frequency"
              options={frequencyOptions}
              value={form.frequency ?? ''}
              placeholder="Choose frequency"
              invalid={Boolean(error && !form.frequency)}
              onChange={frequency => update('frequency', frequency)}
            />
          </div>
        )}
        {children}
      </div>
      {endDatePlacement === 'after-time' && endDateControl}
      {showScheduleControls && frequencyGuidance && (
        <p className="rhythm-schedule-fields__guidance">{frequencyGuidance}</p>
      )}

      {showScheduleControls && form.frequency === 'custom' && (
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

      {showScheduleControls && form.frequency === 'quarterly' && (
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
              value={form.monthInQuarter === undefined ? '' : String(form.monthInQuarter)}
              placeholder="Choose months"
              onChange={value => update('monthInQuarter', Number(value) as 1 | 2 | 3)}
            />
          </div>
        </div>
      )}

      {showScheduleControls && showPattern && (
        <div className="rhythm-schedule-fields__pattern-grid">
          <div
            className="goal-field rhythm-schedule-fields__pattern-column"
            role="group"
            aria-labelledby={patternTypeLabelId}
          >
            <span id={patternTypeLabelId} className="rhythm-schedule-fields__pattern-label">Repeat on</span>
            <StyledSelect
              label="Repeat on"
              options={patternOptions}
              value={form.patternKind ?? ''}
              placeholder="Choose a pattern"
              onChange={kind => update('patternKind', kind)}
            />
          </div>
          <div
            className="goal-field rhythm-schedule-fields__pattern-column"
            role="group"
            aria-labelledby={patternDetailsLabelId}
          >
            <span id={patternDetailsLabelId} className="rhythm-schedule-fields__pattern-label">
              {form.patternKind === 'dayOfMonth' ? 'On day' : form.patternKind === 'ordinalWeekday' ? 'On the' : 'Pattern details'}
            </span>
            {form.patternKind === undefined
              ? <p className="rhythm-schedule-fields__pattern-prompt">Choose a pattern first.</p>
              : form.patternKind === 'dayOfMonth' ? (
              <div className="rhythm-schedule-fields__pattern-controls">
                {(form.frequency === 'yearly' || form.frequency === 'custom' && form.unit === 'years') && (
                  <>
                    <span>{form.frequency === 'yearly' ? 'On' : 'In'}</span>
                    <StyledSelect
                      label="Month"
                      options={months}
                      value={form.month === undefined ? '' : String(form.month)}
                      placeholder="Choose a month"
                      onChange={value => update('month', Number(value) as RhythmMonth)}
                    />
                  </>
                )}
                <StyledSelect
                  label="Date"
                  options={dayOptions(form.day)}
                  value={form.day === undefined ? '' : String(form.day)}
                  placeholder="Choose a date"
                  onChange={value => update('day', value === 'last' ? 'last' : Number(value))}
                />
              </div>
            ) : (
              <>
                <div
                  className="rhythm-schedule-fields__pattern-controls rhythm-schedule-fields__ordinal-weekday"
                  role="group"
                  aria-label="Ordinal and weekday"
                >
                  <StyledSelect
                    label="Which week?"
                    options={ordinalOptions}
                    value={form.ordinal === undefined ? '' : String(form.ordinal)}
                    placeholder="Choose a week"
                    onChange={value => update('ordinal', value === 'last' ? 'last' : Number(value) as 1 | 2 | 3 | 4)}
                  />
                  <StyledSelect
                    label="Day"
                    options={weekdays.map(day => ({ value: String(day.value), label: day.label }))}
                    value={form.patternWeekday === undefined ? '' : String(form.patternWeekday)}
                    placeholder="Choose a day"
                    onChange={value => update('patternWeekday', Number(value) as RhythmWeekday)}
                  />
                </div>
                {(form.frequency === 'yearly' || form.frequency === 'custom' && form.unit === 'years') && (
                  <div className="rhythm-schedule-fields__pattern-controls rhythm-schedule-fields__pattern-month">
                    <span>{form.frequency === 'yearly' ? 'Of' : 'In'}</span>
                    <StyledSelect
                      label="Month"
                      options={months}
                      value={form.month === undefined ? '' : String(form.month)}
                      placeholder="Choose a month"
                      onChange={value => update('month', Number(value) as RhythmMonth)}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {showScheduleControls && showWeekdays && (
        <div
          className={`rhythm-schedule-fields__weekday-row${weekdaysError ? ' rhythm-schedule-fields__weekday-row--invalid' : ''}`}
          role={form.frequency === 'weekly' ? 'radiogroup' : 'group'}
          aria-label={form.frequency === 'weekly' ? 'Choose one weekday' : 'Which days?'}
          aria-invalid={weekdaysError ? true : undefined}
          aria-describedby={weekdaysError ? weekdaysErrorId : undefined}
          aria-errormessage={weekdaysError ? weekdaysErrorId : undefined}
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
          {weekdaysError && (
            <span id={weekdaysErrorId} className="rhythm-schedule-fields__weekday-error" role="status">
              {weekdaysError}
            </span>
          )}
        </div>
      )}

      {showScheduleControls && form.frequency === 'custom' && (
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

      {endDatePlacement === 'after-recurrence' && endDateControl}

      {showScheduleError && <p className="goal-field-error" role="alert">{error}</p>}
    </div>
  );
}
