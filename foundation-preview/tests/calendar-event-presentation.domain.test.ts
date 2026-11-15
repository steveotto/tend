import { describe, expect, it } from 'vitest';
import { formatCalendarEventPresentation } from '../src/domain/calendar-event-presentation.ts';
import type { CalendarEvent } from '../src/domain/calendar-events.ts';

function event(
  startsAt: string,
  endsAt: string,
  allDay = false
): CalendarEvent {
  const start = Date.parse(startsAt);
  return {
    id: 'synthetic-event',
    sourceId: 'synthetic-calendar',
    sourceName: 'Synthetic calendar',
    title: 'Synthetic appointment',
    startsAt: start,
    endsAt: Date.parse(endsAt),
    allDay
  };
}

describe('calendar event row date presentation', () => {
  it('formats a timed event with its local weekday/date, time range, and today label', () => {
    const presentation = formatCalendarEventPresentation(
      event('2026-11-30T14:00:00Z', '2026-11-30T15:15:00Z'),
      Date.parse('2026-11-30T12:00:00Z'),
      'UTC'
    );

    expect(presentation).toEqual({
      month: 'NOV',
      day: '30',
      dateTime: 'Mon, Nov 30 · 2:00 PM–3:15 PM',
      relativeDate: 'Today',
      isPast: false
    });
  });

  it('formats all-day events and relative labels across a month and year boundary', () => {
    const decFirst = formatCalendarEventPresentation(
      event('2026-12-01T00:00:00Z', '2026-12-02T00:00:00Z', true),
      Date.parse('2026-11-30T23:30:00Z'),
      'UTC'
    );
    const decFifth = formatCalendarEventPresentation(
      event('2026-12-05T09:00:00Z', '2026-12-05T10:00:00Z'),
      Date.parse('2026-11-30T23:30:00Z'),
      'UTC'
    );
    const janFirst = formatCalendarEventPresentation(
      event('2027-01-01T09:00:00Z', '2027-01-01T10:00:00Z'),
      Date.parse('2026-12-31T23:30:00Z'),
      'UTC'
    );

    expect(decFirst).toEqual({
      month: 'DEC',
      day: '1',
      dateTime: 'Tue, Dec 1 · All day',
      relativeDate: 'Tomorrow',
      isPast: false
    });
    expect(decFifth.month).toBe('DEC');
    expect(decFifth.relativeDate).toBe('in 5d');
    expect(janFirst).toEqual({
      month: 'JAN',
      day: '1',
      dateTime: 'Fri, Jan 1 · 9:00 AM–10:00 AM',
      relativeDate: 'Tomorrow',
      isPast: false
    });
  });

  it('formats event date, clock time, and relative day in the selected timezone', () => {
    const presentation = formatCalendarEventPresentation(
      event('2026-12-01T00:30:00Z', '2026-12-01T01:00:00Z'),
      Date.parse('2026-11-30T23:30:00Z'),
      'America/Los_Angeles'
    );

    expect(presentation).toEqual({
      month: 'NOV',
      day: '30',
      dateTime: 'Mon, Nov 30 · 4:30 PM–5:00 PM',
      relativeDate: 'Today',
      isPast: false
    });
  });

  it('marks only timed events that ended today as past', () => {
    const now = Date.parse('2026-11-30T12:00:00Z');
    expect(formatCalendarEventPresentation(
      event('2026-11-30T10:00:00Z', '2026-11-30T11:00:00Z'),
      now,
      'UTC'
    ).isPast).toBe(true);
    expect(formatCalendarEventPresentation(
      event('2026-11-30T11:00:00Z', '2026-11-30T12:00:00Z'),
      now,
      'UTC'
    ).isPast).toBe(true);
    expect(formatCalendarEventPresentation(
      event('2026-11-30T11:30:00Z', '2026-11-30T12:30:00Z'),
      now,
      'UTC'
    ).isPast).toBe(false);
    expect(formatCalendarEventPresentation(
      event('2026-11-30T13:00:00Z', '2026-11-30T14:00:00Z'),
      now,
      'UTC'
    ).isPast).toBe(false);
    expect(formatCalendarEventPresentation(
      event('2026-11-29T10:00:00Z', '2026-11-29T11:00:00Z'),
      now,
      'UTC'
    ).isPast).toBe(false);
    expect(formatCalendarEventPresentation(
      event('2026-11-30T09:00:00Z', '2026-11-30T10:00:00Z', true),
      now,
      'UTC'
    ).isPast).toBe(false);
  });

  it('uses local end-date boundaries in the selected timezone', () => {
    const eventEndingAtLocalNov30 = event(
      '2026-12-01T00:00:00Z',
      '2026-12-01T00:30:00Z'
    );
    expect(formatCalendarEventPresentation(
      eventEndingAtLocalNov30,
      Date.parse('2026-12-01T00:30:00Z'),
      'America/Los_Angeles'
    ).isPast).toBe(true);
    expect(formatCalendarEventPresentation(
      event('2026-12-01T00:30:00Z', '2026-12-01T01:30:00Z'),
      Date.parse('2026-12-01T01:00:00Z'),
      'America/Los_Angeles'
    ).isPast).toBe(false);
    expect(formatCalendarEventPresentation(
      eventEndingAtLocalNov30,
      Date.parse('2026-12-01T08:00:00Z'),
      'America/Los_Angeles'
    ).isPast).toBe(false);
  });

  it('uses the parsed default end timestamp when a timed event has no end', () => {
    const missingEnd = event('2026-11-30T10:00:00Z', '2026-11-30T10:00:00Z');
    expect(formatCalendarEventPresentation(
      missingEnd,
      Date.parse('2026-11-30T10:01:00Z'),
      'UTC'
    ).isPast).toBe(true);
  });
});
