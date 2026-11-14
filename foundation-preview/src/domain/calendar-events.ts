import ICAL from 'ical.js';
import type { CalendarSource } from './calendar-sources.ts';

export type CalendarEvent = {
  id: string;
  sourceId: string;
  sourceName: string;
  title: string;
  startsAt: number;
  endsAt: number;
  allDay: boolean;
};

export type CalendarFeedIssue = {
  eventNumber: number | null;
  kind: 'invalid-feed' | 'invalid-event' | 'unresolved-exception' | 'duration-too-long' | 'expansion-limit';
};

export type CalendarFeedResult =
  | { valid: false; events: []; issues: [CalendarFeedIssue] }
  | { valid: true; events: CalendarEvent[]; issues: CalendarFeedIssue[] };

type DateParts = { year: number; month: number; day: number };
type CalendarQuery =
  | { kind: 'local-day'; localDate: string }
  | { kind: 'upcoming'; now: number }
  | { kind: 'range'; start: number; end: number };

export type CalendarRange = 'today' | 'week' | 'month';
export type CalendarRangeWindow = { start: number; end: number };

const maximumRecurringDurationDays = 366;
const maximumOccurrencesPerEvent = 50_000;

function parseLocalDate(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

function localDateKey(parts: DateParts): string {
  return `${parts.year.toString().padStart(4, '0')}-${parts.month.toString().padStart(2, '0')}-${parts.day.toString().padStart(2, '0')}`;
}

function shiftDate(parts: DateParts, days: number): DateParts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function shiftMonth(parts: DateParts): DateParts {
  const year = parts.month === 12 ? parts.year + 1 : parts.year;
  const month = parts.month === 12 ? 1 : parts.month + 1;
  return {
    year,
    month,
    day: Math.min(parts.day, ICAL.Time.daysInMonth(month, year))
  };
}

function partsAt(instant: number, timeZone: string): DateParts & { hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(instant));
  const values = Object.fromEntries(parts.map(part => [part.type, Number(part.value)]));
  return {
    year: values.year!,
    month: values.month!,
    day: values.day!,
    hour: values.hour!,
    minute: values.minute!,
    second: values.second!
  };
}

function zonedDateTimeToInstant(parts: DateParts, timeZone: string): number {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day);
  let guess = target;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const actual = partsAt(guess, timeZone);
    const represented = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second
    );
    const difference = target - represented;
    if (difference === 0) return guess;
    guess += difference;
  }

  const targetDate = localDateKey(parts);
  let low = Math.floor((target - 3 * 86_400_000) / 1000);
  let high = Math.ceil((target + 3 * 86_400_000) / 1000);
  const dateAt = (seconds: number) => localDateKey(partsAt(seconds * 1000, timeZone));
  if (dateAt(low) >= targetDate || dateAt(high) < targetDate) {
    throw new RangeError('Could not resolve the local calendar day in the selected time zone.');
  }
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (dateAt(middle) >= targetDate) high = middle;
    else low = middle;
  }
  return high * 1000;
}

function localDayRange(parts: DateParts, timeZone: string): { start: number; end: number } {
  return {
    start: zonedDateTimeToInstant(parts, timeZone),
    end: zonedDateTimeToInstant(shiftDate(parts, 1), timeZone)
  };
}

export function getCalendarRangeWindow(
  range: CalendarRange,
  now: number,
  timeZone: string
): CalendarRangeWindow {
  if (!Number.isSafeInteger(now) || !Number.isFinite(new Date(now).getTime())) {
    throw new RangeError('A valid instant is required to calculate a calendar range.');
  }
  const today = partsAt(now, timeZone);
  const start = zonedDateTimeToInstant(today, timeZone);
  const endDate = range === 'today'
    ? shiftDate(today, 1)
    : range === 'week'
      ? shiftDate(today, 7)
      : shiftMonth(today);
  return { start, end: zonedDateTimeToInstant(endDate, timeZone) };
}

export function formatCalendarRangeLabel(
  range: CalendarRange,
  window: CalendarRangeWindow,
  timeZone: string
): string {
  const shortDate = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone
  });
  if (range === 'today') {
    return `Today · ${new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone
    }).format(window.start)}`;
  }
  const first = partsAt(window.start, timeZone);
  const last = partsAt(window.end - 1, timeZone);
  const startDate = shortDate.format(window.start);
  const endDate = first.month === last.month && first.year === last.year
    ? String(last.day)
    : shortDate.format(window.end - 1);
  const label = range === 'week' ? 'Week' : 'Month';
  return `${label} · ${startDate}–${endDate}`;
}

export function selectCalendarEventsForRange(
  events: readonly CalendarEvent[],
  window: CalendarRangeWindow
): CalendarEvent[] {
  const unique = new Map<string, CalendarEvent>();
  for (const event of events) {
    if (event.endsAt <= window.start || event.startsAt >= window.end) continue;
    unique.set(`${event.sourceId}\u0000${event.id}`, event);
  }
  return [...unique.values()].sort(
    (left, right) => left.startsAt - right.startsAt || left.id.localeCompare(right.id)
  );
}

function dateOnlyKey(time: ICAL.Time): string {
  return `${time.year.toString().padStart(4, '0')}-${time.month.toString().padStart(2, '0')}-${time.day.toString().padStart(2, '0')}`;
}

function eventDurationDays(event: ICAL.Event): number {
  const seconds = Math.abs(event.duration.toSeconds());
  return Number.isFinite(seconds) ? Math.ceil(seconds / 86_400) : Number.POSITIVE_INFINITY;
}

function isWithinLocalDay(
  start: ICAL.Time,
  end: ICAL.Time,
  allDay: boolean,
  localDate: string,
  range: { start: number; end: number },
  timedEndsAt: number
): boolean {
  if (allDay) {
    return dateOnlyKey(start) < localDateKey(shiftDate(parseLocalDate(localDate)!, 1))
      && dateOnlyKey(end) > localDate;
  }
  const startMs = start.toJSDate().getTime();
  return startMs < range.end && timedEndsAt > range.start;
}

function eventStartsAt(time: ICAL.Time, allDay: boolean, timeZone: string): number {
  return allDay
    ? zonedDateTimeToInstant(parseLocalDate(dateOnlyKey(time))!, timeZone)
    : time.toJSDate().getTime();
}

function eventEndsAt(time: ICAL.Time, allDay: boolean, timeZone: string): number {
  return allDay
    ? zonedDateTimeToInstant(parseLocalDate(dateOnlyKey(time))!, timeZone)
    : time.toJSDate().getTime();
}

function parseCalendarFeed(
  raw: string,
  source: Pick<CalendarSource, 'id' | 'name'>,
  query: CalendarQuery,
  timeZone: string
): CalendarFeedResult {
  const date = query.kind === 'local-day' ? parseLocalDate(query.localDate) : null;
  if ((query.kind === 'local-day' && !date)
    || (query.kind === 'upcoming'
      && (!Number.isSafeInteger(query.now) || !Number.isFinite(new Date(query.now).getTime())))
    || (query.kind === 'range'
      && (!Number.isSafeInteger(query.start)
        || !Number.isFinite(new Date(query.start).getTime())
        || !Number.isSafeInteger(query.end)
        || !Number.isFinite(new Date(query.end).getTime())
        || query.end <= query.start))) {
    return { valid: false, events: [], issues: [{ eventNumber: null, kind: 'invalid-feed' }] };
  }

  let calendar: ICAL.Component;
  let localDay: { start: number; end: number } | null = null;
  try {
    if (date) localDay = localDayRange(date, timeZone);
    new Intl.DateTimeFormat('en', { timeZone }).format();
    calendar = ICAL.Component.fromString(raw);
    if (calendar.name !== 'vcalendar') throw new TypeError('Expected a VCALENDAR component.');
  } catch {
    return { valid: false, events: [], issues: [{ eventNumber: null, kind: 'invalid-feed' }] };
  }

  const components = calendar.getAllSubcomponents('vevent');
  const masters = components.filter(component => !component.hasProperty('recurrence-id'));
  const masterIds = new Set(masters.map(component => component.getFirstPropertyValue('uid')).filter(
    (uid): uid is string => typeof uid === 'string'
  ));
  const issues: CalendarFeedIssue[] = [];
  components.forEach((component, index) => {
    if (component.hasProperty('recurrence-id')) {
      const uid = component.getFirstPropertyValue('uid');
      if (typeof uid !== 'string' || !masterIds.has(uid)) {
        issues.push({ eventNumber: index + 1, kind: 'unresolved-exception' });
      }
    }
  });

  const events: CalendarEvent[] = [];
  masters.forEach((component, componentIndex) => {
    const eventNumber = componentIndex + 1;
    try {
      const event = new ICAL.Event(component);
      if (!event.startDate) {
        issues.push({ eventNumber, kind: 'invalid-event' });
        return;
      }
      const recurrenceDurationDays = eventDurationDays(event);
      if (event.isRecurring() && recurrenceDurationDays > maximumRecurringDurationDays) {
        issues.push({ eventNumber, kind: 'duration-too-long' });
        return;
      }
      const iterator = event.isRecurring() ? event.iterator() : null;
      let occurrenceCount = 0;
      let includedOccurrenceCount = 0;
      while (true) {
        const occurrence = iterator ? iterator.next() : occurrenceCount === 0 ? event.startDate : null;
        if (!occurrence) break;
        occurrenceCount += 1;
        if (occurrenceCount > maximumOccurrencesPerEvent) {
          issues.push({ eventNumber, kind: 'expansion-limit' });
          break;
        }
        const details = event.getOccurrenceDetails(occurrence);
        const start = details.startDate;
        const end = details.endDate;
        const occurrenceAllDay = start.isDate;
        const startsAt = eventStartsAt(start, occurrenceAllDay, timeZone);
        const duration = details.item.endDate.toJSDate().getTime()
          - details.item.startDate.toJSDate().getTime();
        const timedEndsAt = startsAt + duration;
        if (component.getFirstPropertyValue('status') === 'CANCELLED'
          || details.item.component.getFirstPropertyValue('status') === 'CANCELLED') continue;
        const endsAt = occurrenceAllDay
          ? eventEndsAt(end, true, timeZone)
          : timedEndsAt;
        if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt < startsAt) {
          issues.push({ eventNumber, kind: 'invalid-event' });
          continue;
        }
        const inQuery = query.kind === 'local-day'
          ? isWithinLocalDay(start, end, occurrenceAllDay, query.localDate, localDay!, timedEndsAt)
          : query.kind === 'upcoming'
            ? endsAt > query.now
            : endsAt > query.start && startsAt < query.end;
        if (!inQuery) {
          if (query.kind === 'local-day') {
            if (occurrenceAllDay
              ? dateOnlyKey(start) > localDateKey(shiftDate(date!, 1))
              : start.toJSDate().getTime() >= localDay!.end) break;
          } else if (query.kind === 'upcoming' && startsAt >= query.now) {
            break;
          } else if (query.kind === 'range' && startsAt >= query.end) {
            break;
          }
          continue;
        }
        const uid = event.uid || `event-${eventNumber}`;
        events.push({
          id: `${source.id}:${uid}:${start.toICALString()}`,
          sourceId: source.id,
          sourceName: source.name,
          title: details.item.summary || '(untitled)',
          startsAt,
          endsAt,
          allDay: occurrenceAllDay
        });
        includedOccurrenceCount += 1;
        if (query.kind === 'upcoming' && includedOccurrenceCount >= 3) break;
      }
    } catch {
      issues.push({ eventNumber, kind: 'invalid-event' });
    }
  });

  events.sort((left, right) => left.startsAt - right.startsAt);
  return {
    valid: true,
    events: query.kind === 'upcoming' ? events.slice(0, 3) : events,
    issues
  };
}

export function parseCalendarFeedForLocalDate(
  raw: string,
  source: Pick<CalendarSource, 'id' | 'name'>,
  localDate: string,
  timeZone: string
): CalendarFeedResult {
  return parseCalendarFeed(raw, source, { kind: 'local-day', localDate }, timeZone);
}

export function parseCalendarFeedForUpcoming(
  raw: string,
  source: Pick<CalendarSource, 'id' | 'name'>,
  now: number,
  timeZone: string
): CalendarFeedResult {
  return parseCalendarFeed(raw, source, { kind: 'upcoming', now }, timeZone);
}

export function parseCalendarFeedForRange(
  raw: string,
  source: Pick<CalendarSource, 'id' | 'name'>,
  start: number,
  end: number,
  timeZone: string
): CalendarFeedResult {
  return parseCalendarFeed(raw, source, { kind: 'range', start, end }, timeZone);
}
