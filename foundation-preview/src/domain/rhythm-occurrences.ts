import { isValidDate } from './money-goals.ts';
import {
  isValidTimeZone,
  validateRhythmScoringMetadata,
  validateRhythmSchedule
} from './rhythm-schedule.ts';
import type { RhythmSchedule, RhythmScoringMetadata, RhythmScheduleHistorySegment } from './rhythm-schedule.ts';
import { rhythmSeasonForDate } from './rhythm-seasons.ts';

export type NextScheduledOccurrence =
  | { kind: 'found'; date: string }
  | { kind: 'none' }
  | { kind: 'unavailable'; reason: string };

export function localDateInTimeZone(value: Date, timeZone: string): string {
  if (!Number.isFinite(value.getTime())) throw new RangeError('The scoring instant is invalid.');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(value);
  const fields = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

export function addCalendarDays(value: string, amount: number): string {
  if (!isValidDate(value) || !Number.isInteger(amount)) throw new RangeError('A valid calendar date and whole-day offset are required.');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year!, month! - 1, day! + amount);
  date.setUTCHours(0, 0, 0, 0);
  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('-');
}

export function dateParts(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split('-').map(Number);
  return { year: year!, month: month!, day: day! };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthIndex(value: string): number {
  const { year, month } = dateParts(value);
  return year * 12 + month - 1;
}

export function calendarDaysInclusive(start: string, end: string): number {
  if (start > end) return 0;
  return Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
}

function canonicalValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalValue).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalValue(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? '';
}

export function rhythmSchedulesEqual(left: RhythmSchedule, right: RhythmSchedule): boolean {
  return canonicalValue(left) === canonicalValue(right);
}

function patternMatches(pattern: Extract<RhythmSchedule, { frequency: 'monthly' }>['pattern'], date: string): boolean {
  const { year, month, day } = dateParts(date);
  if (pattern.kind === 'dayOfMonth') {
    return pattern.day === 'last'
      ? day === daysInMonth(year, month)
      : day === pattern.day;
  }
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  if (weekday !== pattern.weekday) return false;
  if (pattern.ordinal === 'last') return day + 7 > daysInMonth(year, month);
  return Math.floor((day - 1) / 7) + 1 === pattern.ordinal;
}

export function isScheduledDate(schedule: RhythmSchedule, date: string): boolean {
  if (schedule.endDate !== undefined && date > schedule.endDate) return false;
  const { year, month } = dateParts(date);
  if (schedule.frequency === 'daily') return true;
  if (schedule.frequency === 'weekly') {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    return schedule.weekdays.includes(weekday as (typeof schedule.weekdays)[number]);
  }
  if (schedule.frequency === 'monthly') return patternMatches(schedule.pattern, date);
  if (schedule.frequency === 'quarterly') {
    return (month - 1) % 3 + 1 === schedule.monthInQuarter && patternMatches(schedule.pattern, date);
  }
  if (schedule.frequency === 'yearly') {
    return month === schedule.month && patternMatches(schedule.pattern, date);
  }
  if (date < schedule.startDate) return false;
  if (schedule.unit === 'days') {
    return (calendarDaysInclusive(schedule.startDate, date) - 1) % schedule.interval === 0;
  }
  if (schedule.unit === 'weeks') {
    const startWeekday = new Date(`${schedule.startDate}T00:00:00Z`).getUTCDay();
    const dateWeekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const startWeekMonday = addCalendarDays(schedule.startDate, -((startWeekday + 6) % 7));
    const dateWeekMonday = addCalendarDays(date, -((dateWeekday + 6) % 7));
    const weekOffset = Math.floor((calendarDaysInclusive(startWeekMonday, dateWeekMonday) - 1) / 7);
    return weekOffset % schedule.interval === 0
      && schedule.weekdays.includes(dateWeekday as (typeof schedule.weekdays)[number]);
  }
  if (schedule.unit === 'months') {
    return (monthIndex(date) - monthIndex(schedule.startDate)) % schedule.interval === 0
      && patternMatches(schedule.pattern, date);
  }
  return (year - dateParts(schedule.startDate).year) % schedule.interval === 0
    && month === schedule.month
    && patternMatches(schedule.pattern, date);
}

function scheduleAt(segments: readonly RhythmScheduleHistorySegment[], date: string): RhythmSchedule | undefined {
  const season = rhythmSeasonForDate(segments, date);
  return season?.kind === 'scheduled' ? season.schedule : undefined;
}

function searchHorizonDays(schedule: RhythmSchedule): number {
  if (schedule.frequency === 'daily') return 0;
  if (schedule.frequency === 'weekly') return 7;
  if (schedule.frequency === 'monthly' || schedule.frequency === 'quarterly') return 366;
  if (schedule.frequency === 'yearly') return 1_464;
  if (schedule.unit === 'days') return schedule.interval;
  if (schedule.unit === 'weeks') return schedule.interval * 7 + 7;
  if (schedule.unit === 'months') return schedule.interval * 31 + 31;
  return schedule.interval * 4 * 366 + 366;
}

export function selectNextScheduledOccurrence(input: {
  schedule: RhythmSchedule;
  scoring?: RhythmScoringMetadata;
  trackingStartDate?: string;
  asOfDate: string;
}): NextScheduledOccurrence {
  if (!isValidDate(input.asOfDate) || !validateRhythmSchedule(input.schedule).valid) {
    return { kind: 'unavailable', reason: 'The schedule or local date is invalid.' };
  }

  const segments = input.scoring?.scheduleHistory;
  if (input.scoring) {
    const latest = input.scoring.scheduleHistory.at(-1);
    if (!validateRhythmScoringMetadata(input.scoring) || !isValidTimeZone(input.scoring.timeZone)
      || !latest || latest.kind !== 'scheduled' || !rhythmSchedulesEqual(latest.schedule, input.schedule)) {
      return { kind: 'unavailable', reason: 'The saved schedule history is invalid or does not match the current schedule.' };
    }
  }

  const startDate = [
    input.asOfDate,
    input.scoring?.trackingStartDate,
    input.trackingStartDate
  ].filter((date): date is string => date !== undefined).sort().at(-1)!;
  const horizonDate = addCalendarDays(startDate, searchHorizonDays(input.schedule));
  const searchEnd = horizonDate > '9999-12-31' ? '9999-12-31' : horizonDate;
  const effectiveEnd = input.schedule.endDate && input.schedule.endDate < searchEnd
    ? input.schedule.endDate
    : searchEnd;

  for (let date = startDate; date <= effectiveEnd; date = addCalendarDays(date, 1)) {
    const schedule = segments ? scheduleAt(segments, date) : input.schedule;
    if (!schedule) {
      return { kind: 'unavailable', reason: 'The schedule history does not cover the next occurrence period.' };
    }
    if (isScheduledDate(schedule, date)) return { kind: 'found', date };
  }
  return { kind: 'none' };
}
