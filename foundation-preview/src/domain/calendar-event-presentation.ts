import type { CalendarEvent } from './calendar-events.ts';

type CalendarEventPresentation = {
  month: string;
  day: string;
  dateTime: string;
  relativeDate: string;
};

type LocalDateParts = { year: number; month: number; day: number };

function localDateParts(instant: number, timeZone: string): LocalDateParts {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }).formatToParts(new Date(instant));
  const values = Object.fromEntries(parts.map(part => [part.type, Number(part.value)]));
  return {
    year: values.year!,
    month: values.month!,
    day: values.day!
  };
}

function dateOrdinal({ year, month, day }: LocalDateParts): number {
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function abbreviatedDate(instant: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  }).format(new Date(instant));
}

function formattedTime(instant: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(instant));
}

function relativeDateLabel(daysFromToday: number): string {
  if (daysFromToday < -1) return 'Earlier';
  if (daysFromToday === -1) return 'Yesterday';
  if (daysFromToday === 0) return 'Today';
  if (daysFromToday === 1) return 'Tomorrow';
  return `in ${daysFromToday}d`;
}

export function formatCalendarEventPresentation(
  event: CalendarEvent,
  now: number,
  timeZone: string
): CalendarEventPresentation {
  const start = new Date(event.startsAt);
  const startParts = localDateParts(event.startsAt, timeZone);
  const todayParts = localDateParts(now, timeZone);
  const daysFromToday = dateOrdinal(startParts) - dateOrdinal(todayParts);
  const dateTime = event.allDay
    ? `${abbreviatedDate(event.startsAt, timeZone)} · All day`
    : `${abbreviatedDate(event.startsAt, timeZone)} · ${formattedTime(event.startsAt, timeZone)}${
      event.endsAt > event.startsAt
        ? `–${dateOrdinal(localDateParts(event.endsAt, timeZone)) === dateOrdinal(startParts)
          ? ''
          : `${abbreviatedDate(event.endsAt, timeZone)}, `}${formattedTime(event.endsAt, timeZone)}`
        : ''
    }`;

  return {
    month: new Intl.DateTimeFormat('en-US', { timeZone, month: 'short' })
      .format(start)
      .toLocaleUpperCase('en-US'),
    day: String(startParts.day),
    dateTime,
    relativeDate: relativeDateLabel(daysFromToday)
  };
}
