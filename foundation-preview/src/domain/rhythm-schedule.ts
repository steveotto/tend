import { isValidDate } from './money-goals.ts';

export const rhythmTimeOptions = [
  { value: 'anytime', label: 'Anytime' },
  { value: 'all-day', label: 'All day' },
  { value: 'early-morning', label: 'Early morning' },
  { value: 'morning', label: 'Morning' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'way-home', label: 'Way home' },
  { value: 'evening', label: 'Evening' },
  { value: 'bedtime', label: 'Bedtime' }
] as const;

export type RhythmTimeValue = (typeof rhythmTimeOptions)[number]['value'];
export type RhythmTimeLabel = (typeof rhythmTimeOptions)[number]['label'];
export type RhythmLocalDate = string;
export type RhythmWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type RhythmMonth = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type RhythmPattern =
  | { kind: 'dayOfMonth'; day: number | 'last' }
  | { kind: 'ordinalWeekday'; ordinal: 1 | 2 | 3 | 4 | 'last'; weekday: RhythmWeekday };

type ScheduleDates = { endDate?: RhythmLocalDate };

export type RhythmSchedule =
  | ({ frequency: 'daily' } & ScheduleDates)
  | ({ frequency: 'weekly'; weekdays: RhythmWeekday[] } & ScheduleDates)
  | ({ frequency: 'monthly'; pattern: RhythmPattern } & ScheduleDates)
  | ({ frequency: 'quarterly'; monthInQuarter: 1 | 2 | 3; pattern: RhythmPattern } & ScheduleDates)
  | ({ frequency: 'yearly'; month: RhythmMonth; pattern: RhythmPattern } & ScheduleDates)
  | { frequency: 'custom'; unit: 'days'; interval: number; startDate: RhythmLocalDate; endDate?: RhythmLocalDate }
  | { frequency: 'custom'; unit: 'weeks'; interval: number; weekdays: RhythmWeekday[]; startDate: RhythmLocalDate; endDate?: RhythmLocalDate }
  | { frequency: 'custom'; unit: 'months'; interval: number; pattern: RhythmPattern; startDate: RhythmLocalDate; endDate?: RhythmLocalDate }
  | { frequency: 'custom'; unit: 'years'; interval: number; month: RhythmMonth; pattern: RhythmPattern; startDate: RhythmLocalDate; endDate?: RhythmLocalDate };

export type RhythmScheduleSegment = {
  startDate: RhythmLocalDate;
  endDate?: RhythmLocalDate;
  schedule: RhythmSchedule;
};

export type RhythmScoringMetadata = {
  trackingStartDate: RhythmLocalDate;
  timeZone: string;
  scheduleHistory: RhythmScheduleSegment[];
};

export type RhythmScheduleValidation =
  | { valid: true; schedule: RhythmSchedule }
  | { valid: false; errors: string[] };

const timeValueByLabel = new Map<string, RhythmTimeValue>(
  rhythmTimeOptions.map(option => [option.label, option.value])
);
const labelByTimeValue: Record<RhythmTimeValue, RhythmTimeLabel> = {
  anytime: 'Anytime',
  'all-day': 'All day',
  'early-morning': 'Early morning',
  morning: 'Morning',
  lunch: 'Lunch',
  afternoon: 'Afternoon',
  'way-home': 'Way home',
  evening: 'Evening',
  bedtime: 'Bedtime'
};
const legacyTimeValues = new Map<string, RhythmTimeValue>([
  ['Anytime', 'anytime'],
  ['Morning', 'morning'],
  ['Afternoon', 'afternoon'],
  ['Evening', 'evening']
]);
const weekdays = new Set([0, 1, 2, 3, 4, 5, 6]);
const months = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
const commonKeys = ['frequency', 'endDate'];
const customKeys = ['frequency', 'unit', 'interval', 'startDate', 'endDate'];
const patternKeys = {
  dayOfMonth: ['kind', 'day'],
  ordinalWeekday: ['kind', 'ordinal', 'weekday']
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every(key => keys.includes(key));
}

function isWeekday(value: unknown): value is RhythmWeekday {
  return typeof value === 'number' && Number.isInteger(value) && weekdays.has(value);
}

function isWeekdayList(value: unknown): value is RhythmWeekday[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  const selected = new Set<number>();
  for (const weekday of value) {
    if (!isWeekday(weekday) || selected.has(weekday)) return false;
    selected.add(weekday);
  }
  return true;
}

function isMonth(value: unknown): value is RhythmMonth {
  return typeof value === 'number' && Number.isInteger(value) && months.has(value);
}

function isPattern(value: unknown): value is RhythmPattern {
  if (!isRecord(value) || typeof value.kind !== 'string') return false;
  if (value.kind === 'dayOfMonth') {
    return hasOnlyKeys(value, patternKeys.dayOfMonth)
      && (value.day === 'last'
        || typeof value.day === 'number' && Number.isInteger(value.day) && value.day >= 1 && value.day <= 31);
  }
  if (value.kind === 'ordinalWeekday') {
    return hasOnlyKeys(value, patternKeys.ordinalWeekday)
      && (value.ordinal === 1 || value.ordinal === 2 || value.ordinal === 3 || value.ordinal === 4 || value.ordinal === 'last')
      && isWeekday(value.weekday);
  }
  return false;
}

function isValidOptionalEndDate(record: Record<string, unknown>): boolean {
  if (record.endDate === undefined) return true;
  if (typeof record.endDate !== 'string' || !isValidDate(record.endDate)) return false;
  if (record.startDate !== undefined) {
    return typeof record.startDate === 'string'
      && isValidDate(record.startDate)
      && record.endDate >= record.startDate;
  }
  return true;
}

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 100) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

function isRhythmSchedule(value: unknown): value is RhythmSchedule {
  if (!isRecord(value) || typeof value.frequency !== 'string') {
    return false;
  }

  let valid = false;
  if (value.frequency === 'daily') {
    valid = hasOnlyKeys(value, commonKeys) && isValidOptionalEndDate(value);
  } else if (value.frequency === 'weekly') {
    valid = hasOnlyKeys(value, [...commonKeys, 'weekdays'])
      && isWeekdayList(value.weekdays)
      && isValidOptionalEndDate(value);
  } else if (value.frequency === 'monthly') {
    valid = hasOnlyKeys(value, [...commonKeys, 'pattern'])
      && isPattern(value.pattern)
      && isValidOptionalEndDate(value);
  } else if (value.frequency === 'quarterly') {
    valid = hasOnlyKeys(value, [...commonKeys, 'monthInQuarter', 'pattern'])
      && (value.monthInQuarter === 1 || value.monthInQuarter === 2 || value.monthInQuarter === 3)
      && isPattern(value.pattern)
      && isValidOptionalEndDate(value);
  } else if (value.frequency === 'yearly') {
    valid = hasOnlyKeys(value, [...commonKeys, 'month', 'pattern'])
      && isMonth(value.month)
      && isPattern(value.pattern)
      && isValidOptionalEndDate(value);
  } else if (value.frequency === 'custom') {
    const commonValid = Number.isInteger(value.interval)
      && typeof value.interval === 'number'
      && value.interval >= 1
      && value.interval <= 365
      && typeof value.startDate === 'string'
      && isValidDate(value.startDate)
      && isValidOptionalEndDate(value);
    if (commonValid && value.unit === 'days') {
      valid = hasOnlyKeys(value, customKeys);
    } else if (commonValid && value.unit === 'weeks') {
      valid = hasOnlyKeys(value, [...customKeys, 'weekdays']) && isWeekdayList(value.weekdays);
    } else if (commonValid && value.unit === 'months') {
      valid = hasOnlyKeys(value, [...customKeys, 'pattern']) && isPattern(value.pattern);
    } else if (commonValid && value.unit === 'years') {
      valid = hasOnlyKeys(value, [...customKeys, 'month', 'pattern'])
        && isMonth(value.month)
        && isPattern(value.pattern);
    }
  }

  return valid;
}

export function validateRhythmSchedule(value: unknown): RhythmScheduleValidation {
  if (isRhythmSchedule(value)) return { valid: true, schedule: value };
  return {
    valid: false,
    errors: [isRecord(value) ? 'The schedule contains missing, invalid, or unsupported fields.' : 'Choose a supported schedule.']
  };
}

export function validateRhythmScoringMetadata(value: unknown): value is RhythmScoringMetadata {
  if (!isRecord(value) || !hasOnlyKeys(value, ['trackingStartDate', 'timeZone', 'scheduleHistory'])
    || typeof value.trackingStartDate !== 'string' || !isValidDate(value.trackingStartDate)
    || !isValidTimeZone(value.timeZone) || !Array.isArray(value.scheduleHistory)
    || value.scheduleHistory.length === 0) return false;

  let expectedStart = value.trackingStartDate;
  for (let index = 0; index < value.scheduleHistory.length; index += 1) {
    const segment: unknown = value.scheduleHistory[index];
    if (!isRecord(segment) || !hasOnlyKeys(segment, ['startDate', 'endDate', 'schedule'])
      || segment.startDate !== expectedStart || typeof segment.startDate !== 'string'
      || !isValidDate(segment.startDate) || !validateRhythmSchedule(segment.schedule).valid) return false;
    const isLast = index === value.scheduleHistory.length - 1;
    if (isLast !== (segment.endDate === undefined)) return false;
    if (segment.endDate !== undefined) {
      if (typeof segment.endDate !== 'string' || !isValidDate(segment.endDate)
        || segment.endDate < segment.startDate) return false;
      const [year, month, day] = segment.endDate.split('-').map(Number);
      const nextDate = new Date(0);
      nextDate.setUTCFullYear(year!, month! - 1, day! + 1);
      nextDate.setUTCHours(0, 0, 0, 0);
      expectedStart = [
        String(nextDate.getUTCFullYear()).padStart(4, '0'),
        String(nextDate.getUTCMonth() + 1).padStart(2, '0'),
        String(nextDate.getUTCDate()).padStart(2, '0')
      ].join('-');
    }
  }
  return true;
}

export function rhythmTimeLabel(value: RhythmTimeValue): RhythmTimeLabel {
  return labelByTimeValue[value];
}

export function rhythmTimeValueFromLabel(label: string): RhythmTimeValue | undefined {
  return timeValueByLabel.get(label);
}

export function rhythmTimeValueFromLegacyLabel(label: string): RhythmTimeValue | undefined {
  return legacyTimeValues.get(label);
}

function weekdayName(weekday: RhythmWeekday): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekday]!;
}

function monthName(month: RhythmMonth): string {
  return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month - 1]!;
}

function ordinalWord(ordinal: number | 'last'): string {
  if (ordinal === 'last') return 'last';
  return ['first', 'second', 'third', 'fourth'][ordinal - 1] ?? `${ordinal}th`;
}

function dayOrdinal(day: number): string {
  const remainder = day % 100;
  const suffix = remainder >= 11 && remainder <= 13
    ? 'th'
    : day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd' : day % 10 === 3 ? 'rd' : 'th';
  return `${day}${suffix}`;
}

function patternDescription(pattern: RhythmPattern): string {
  return pattern.kind === 'dayOfMonth'
    ? pattern.day === 'last' ? 'last day' : `${dayOrdinal(pattern.day)} day`
    : `${ordinalWord(pattern.ordinal)} ${weekdayName(pattern.weekday)}`;
}

function naturalList(items: readonly string[]): string {
  if (items.length < 2) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}

function weekdayListSummary(selected: readonly RhythmWeekday[]): string {
  return naturalList([...selected].sort((left, right) => left - right).map(weekdayName));
}

function formatLocalDate(value: RhythmLocalDate): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(year!, month! - 1, day!));
}

export function rhythmScheduleSummary(schedule: RhythmSchedule): string {
  let summary: string;
  switch (schedule.frequency) {
    case 'daily':
      summary = 'Every day';
      break;
    case 'weekly':
      summary = schedule.weekdays.length
        ? `Every week on ${weekdayListSummary(schedule.weekdays)}`
        : 'Every week';
      break;
    case 'monthly':
      summary = `The ${patternDescription(schedule.pattern)} of every month`;
      break;
    case 'quarterly':
      summary = `The ${patternDescription(schedule.pattern)} of the ${ordinalWord(schedule.monthInQuarter)} month of every quarter`;
      break;
    case 'yearly':
      summary = `The ${patternDescription(schedule.pattern)} of ${monthName(schedule.month)} every year`;
      break;
    case 'custom':
      if (schedule.unit === 'days') {
        summary = `Every ${schedule.interval} ${schedule.interval === 1 ? 'day' : 'days'}`;
      } else if (schedule.unit === 'weeks') {
        summary = `Every ${schedule.interval} ${schedule.interval === 1 ? 'week' : 'weeks'}`
          + (schedule.weekdays.length ? ` on ${weekdayListSummary(schedule.weekdays)}` : '');
      } else if (schedule.unit === 'months') {
        summary = `Every ${schedule.interval} ${schedule.interval === 1 ? 'month' : 'months'} on ${patternDescription(schedule.pattern)}`;
      } else {
        summary = `Every ${schedule.interval} ${schedule.interval === 1 ? 'year' : 'years'} in ${monthName(schedule.month)} on ${patternDescription(schedule.pattern)}`;
      }
      summary += `, starting ${formatLocalDate(schedule.startDate)}`;
      break;
  }
  if (schedule.endDate) summary += `${schedule.frequency === 'custom' ? ' and ending' : ', ending'} ${formatLocalDate(schedule.endDate)}`;
  return `${summary}.`;
}

export function rhythmSummary(schedule: RhythmSchedule, timeOfDay: RhythmTimeValue): string {
  return `${rhythmScheduleSummary(schedule).replace(/\.$/, '')} · ${rhythmTimeLabel(timeOfDay)}.`;
}
