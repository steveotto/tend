import { describe, expect, it } from 'vitest';
import {
  formatCalendarRangeLabel,
  getCalendarRangeWindow,
  parseCalendarFeedForLocalDate,
  parseCalendarFeedForRange,
  parseCalendarFeedForUpcoming,
  selectCalendarEventsForRange
} from '../src/domain/calendar-events.ts';

const source = { id: 'calendar-source-test', name: 'Synthetic calendar' };

function calendar(events: string, extra = ''): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    extra,
    events,
    'END:VCALENDAR'
  ].filter(Boolean).join('\r\n');
}

const newYorkTimeZone = [
  'BEGIN:VTIMEZONE',
  'TZID:America/New_York',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:-0500',
  'TZOFFSETTO:-0400',
  'TZNAME:EDT',
  'DTSTART:19700308T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:-0400',
  'TZOFFSETTO:-0500',
  'TZNAME:EST',
  'DTSTART:19701101T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
  'END:STANDARD',
  'END:VTIMEZONE'
].join('\r\n');

describe('calendar feed reader', () => {
  it('calculates local Today, Week, and Month boundaries with calendar arithmetic', () => {
    const now = Date.parse('2026-03-08T16:00:00Z');
    const today = getCalendarRangeWindow('today', now, 'America/New_York');
    const week = getCalendarRangeWindow('week', now, 'America/New_York');
    const month = getCalendarRangeWindow('month', now, 'America/New_York');

    expect(today).toEqual({
      start: Date.parse('2026-03-08T05:00:00Z'),
      end: Date.parse('2026-03-09T04:00:00Z')
    });
    expect(week).toEqual({
      start: Date.parse('2026-03-08T05:00:00Z'),
      end: Date.parse('2026-03-15T04:00:00Z')
    });
    expect(month.end).toBe(Date.parse('2026-04-08T04:00:00Z'));
    expect(formatCalendarRangeLabel('week', week, 'America/New_York')).toBe('Week · Mar 8–14');

    const midnightTransition = getCalendarRangeWindow(
      'today',
      Date.parse('2019-09-08T12:00:00Z'),
      'America/Santiago'
    );
    expect(new Intl.DateTimeFormat('en', {
      timeZone: 'America/Santiago',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).format(midnightTransition.start)).toBe('01:00');
    expect(midnightTransition.end - midnightTransition.start).toBe(23 * 60 * 60_000);

    const januaryEnd = getCalendarRangeWindow('month', Date.parse('2027-01-31T12:00:00Z'), 'UTC');
    expect(new Date(januaryEnd.end).toISOString()).toBe('2027-02-28T00:00:00.000Z');
    const leapMonthEnd = getCalendarRangeWindow('month', Date.parse('2028-01-31T12:00:00Z'), 'UTC');
    expect(new Date(leapMonthEnd.end).toISOString()).toBe('2028-02-29T00:00:00.000Z');
  });

  it('selects overlapping timed, all-day, overnight, and recurring occurrences with exclusive ends', () => {
    const raw = calendar([
      'BEGIN:VEVENT',
      'UID:before-boundary',
      'DTSTART:20261108T230000Z',
      'DTEND:20261109T000000Z',
      'SUMMARY:Ends at range start',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:multi-day-all-day',
      'DTSTART;VALUE=DATE:20261107',
      'DTEND;VALUE=DATE:20261110',
      'SUMMARY:Multi-day all day',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:overnight',
      'DTSTART:20261108T233000Z',
      'DTEND:20261109T003000Z',
      'SUMMARY:Overnight',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:all-day',
      'DTSTART;VALUE=DATE:20261109',
      'DTEND;VALUE=DATE:20261110',
      'SUMMARY:All day',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:daily',
      'DTSTART:20261108T090000Z',
      'DTEND:20261108T093000Z',
      'RRULE:FREQ=DAILY;COUNT=4',
      'SUMMARY:Daily occurrence',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:after-boundary',
      'DTSTART:20261110T000000Z',
      'DTEND:20261110T003000Z',
      'SUMMARY:Starts at range end',
      'END:VEVENT'
    ].join('\r\n'));
    const result = parseCalendarFeedForRange(
      raw,
      source,
      Date.parse('2026-11-09T00:00:00Z'),
      Date.parse('2026-11-10T00:00:00Z'),
      'UTC'
    );

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.events.map(event => [event.title, event.startsAt, event.allDay])).toEqual([
      ['Multi-day all day', Date.parse('2026-11-07T00:00:00Z'), true],
      ['Overnight', Date.parse('2026-11-08T23:30:00Z'), false],
      ['All day', Date.parse('2026-11-09T00:00:00Z'), true],
      ['Daily occurrence', Date.parse('2026-11-09T09:00:00Z'), false]
    ].sort((left, right) => Number(left[1]) - Number(right[1])));
    expect(result.events.map(event => event.title)).not.toContain('Ends at range start');
    expect(result.events.map(event => event.title)).not.toContain('Starts at range end');
  });

  it('deduplicates the same occurrence within a source but retains separate sources', () => {
    const same = {
      id: 'same-occurrence',
      sourceId: 'source-a',
      sourceName: 'A',
      title: 'Same occurrence',
      startsAt: Date.parse('2026-11-09T09:00:00Z'),
      endsAt: Date.parse('2026-11-09T09:30:00Z'),
      allDay: false
    };
    const duplicate = { ...same, title: 'Duplicate copy' };
    const otherSource = { ...same, sourceId: 'source-b', sourceName: 'B' };

    expect(selectCalendarEventsForRange(
      [same, duplicate, otherSource],
      { start: Date.parse('2026-11-09T00:00:00Z'), end: Date.parse('2026-11-10T00:00:00Z') }
    )).toEqual([duplicate, otherSource]);
  });

  it('selects the next three events, including an in-progress event and a future all-day event', () => {
    const raw = calendar([
      'BEGIN:VEVENT',
      'UID:finished',
      'DTSTART:20261108T100000Z',
      'DTEND:20261108T103000Z',
      'SUMMARY:Finished event',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:in-progress',
      'DTSTART:20261108T113000Z',
      'DTEND:20261108T123000Z',
      'SUMMARY:In-progress event',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:later-today',
      'DTSTART:20261108T130000Z',
      'DTEND:20261108T133000Z',
      'SUMMARY:Later today',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:all-day-tomorrow',
      'DTSTART;VALUE=DATE:20261109',
      'DTEND;VALUE=DATE:20261110',
      'SUMMARY:All day tomorrow',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:later-tomorrow',
      'DTSTART:20261109T090000Z',
      'DTEND:20261109T093000Z',
      'SUMMARY:Later tomorrow',
      'END:VEVENT'
    ].join('\r\n'));

    const result = parseCalendarFeedForUpcoming(
      raw,
      source,
      Date.parse('2026-11-08T12:00:00Z'),
      'UTC'
    );
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.events.map(event => [event.title, event.startsAt, event.allDay])).toEqual([
      ['In-progress event', Date.parse('2026-11-08T11:30:00Z'), false],
      ['Later today', Date.parse('2026-11-08T13:00:00Z'), false],
      ['All day tomorrow', Date.parse('2026-11-09T00:00:00Z'), true]
    ]);
  });

  it('expands recurrence from the requested instant and returns no more than three future occurrences', () => {
    const raw = calendar([
      'BEGIN:VEVENT',
      'UID:daily-upcoming',
      'DTSTART:20261107T110000Z',
      'DTEND:20261107T113000Z',
      'RRULE:FREQ=DAILY;COUNT=6',
      'SUMMARY:Daily upcoming',
      'END:VEVENT'
    ].join('\r\n'));

    const result = parseCalendarFeedForUpcoming(
      raw,
      source,
      Date.parse('2026-11-08T12:00:00Z'),
      'UTC'
    );
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.events.map(event => new Date(event.startsAt).toISOString())).toEqual([
      '2026-11-09T11:00:00.000Z',
      '2026-11-10T11:00:00.000Z',
      '2026-11-11T11:00:00.000Z'
    ]);
  });

  it('orders timed and all-day events, including an event spanning midnight', () => {
    const raw = calendar([
      'BEGIN:VEVENT',
      'UID:overnight',
      'DTSTART:20261107T233000Z',
      'DTEND:20261108T003000Z',
      'SUMMARY:Overnight',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:all-day',
      'DTSTART;VALUE=DATE:20261108',
      'DTEND;VALUE=DATE:20261110',
      'SUMMARY:All-day visit',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:morning',
      'DTSTART:20261108T080000Z',
      'DTEND:20261108T083000Z',
      'SUMMARY:Morning',
      'END:VEVENT'
    ].join('\r\n'));

    const result = parseCalendarFeedForLocalDate(raw, source, '2026-11-08', 'UTC');
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.events.map(event => [event.title, event.allDay])).toEqual([
      ['Overnight', false],
      ['All-day visit', true],
      ['Morning', false]
    ]);
  });

  it('expands recurrence rules and applies moved and cancelled exceptions', () => {
    const raw = calendar([
      'BEGIN:VEVENT',
      'UID:daily',
      'DTSTART:20261101T090000Z',
      'DTEND:20261101T093000Z',
      'RRULE:FREQ=DAILY;COUNT=7',
      'SUMMARY:Daily meeting',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:daily',
      'RECURRENCE-ID:20261103T090000Z',
      'DTSTART:20261103T110000Z',
      'DTEND:20261103T113000Z',
      'SUMMARY:Moved meeting',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:daily',
      'RECURRENCE-ID:20261104T090000Z',
      'DTSTART:20261104T090000Z',
      'DTEND:20261104T093000Z',
      'STATUS:CANCELLED',
      'SUMMARY:Cancelled meeting',
      'END:VEVENT'
    ].join('\r\n'));

    const result = parseCalendarFeedForLocalDate(raw, source, '2026-11-03', 'UTC');
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.issues).toEqual([]);
    expect(result.events.map(event => [event.title, new Date(event.startsAt).toISOString()])).toEqual([
      ['Moved meeting', '2026-11-03T11:00:00.000Z']
    ]);

    const cancelled = parseCalendarFeedForLocalDate(raw, source, '2026-11-04', 'UTC');
    expect(cancelled.valid && cancelled.events).toEqual([]);
  });

  it('uses the feed time zone across a daylight-saving transition and the viewer local-day boundary', () => {
    const raw = calendar([
      'BEGIN:VEVENT',
      'UID:weekly',
      'DTSTART;TZID=America/New_York:20260301T090000',
      'DTEND;TZID=America/New_York:20260301T100000',
      'RRULE:FREQ=WEEKLY;COUNT=3',
      'SUMMARY:Weekly check-in',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:spring-forward',
      'DTSTART;TZID=America/New_York:20260308T013000',
      'DTEND;TZID=America/New_York:20260308T033000',
      'SUMMARY:Spring-forward event',
      'END:VEVENT'
    ].join('\r\n'), newYorkTimeZone);

    const result = parseCalendarFeedForLocalDate(raw, source, '2026-03-08', 'America/New_York');
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.events.map(event => [event.title, event.startsAt, event.endsAt])).toEqual([
      ['Spring-forward event', Date.parse('2026-03-08T06:30:00Z'), Date.parse('2026-03-08T07:30:00Z')],
      ['Weekly check-in', Date.parse('2026-03-08T13:00:00Z'), Date.parse('2026-03-08T14:00:00Z')]
    ]);

    const boundaryFeed = calendar([
      'BEGIN:VEVENT',
      'UID:before-spring-day',
      'DTSTART:20260308T043000Z',
      'DTEND:20260308T044500Z',
      'SUMMARY:Before spring day',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:inside-spring-day',
      'DTSTART:20260308T053000Z',
      'DTEND:20260308T054500Z',
      'SUMMARY:Inside spring day',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:after-spring-day',
      'DTSTART:20260309T043000Z',
      'DTEND:20260309T044500Z',
      'SUMMARY:After spring day',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:before-fall-day',
      'DTSTART:20261101T033000Z',
      'DTEND:20261101T034500Z',
      'SUMMARY:Before fall day',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:inside-fall-day',
      'DTSTART:20261101T043000Z',
      'DTEND:20261101T044500Z',
      'SUMMARY:Inside fall day',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:after-fall-day',
      'DTSTART:20261102T053000Z',
      'DTEND:20261102T054500Z',
      'SUMMARY:After fall day',
      'END:VEVENT'
    ].join('\r\n'));
    const springBoundary = parseCalendarFeedForLocalDate(
      boundaryFeed,
      source,
      '2026-03-08',
      'America/New_York'
    );
    const fallBoundary = parseCalendarFeedForLocalDate(
      boundaryFeed,
      source,
      '2026-11-01',
      'America/New_York'
    );
    expect(springBoundary.valid && springBoundary.events.map(event => event.title)).toEqual(['Inside spring day']);
    expect(fallBoundary.valid && fallBoundary.events.map(event => event.title)).toEqual(['Inside fall day']);
  });

  it('reports invalid feeds and unresolved exceptions without exposing feed text', () => {
    const malformed = parseCalendarFeedForLocalDate('<not a calendar>', source, '2026-11-08', 'UTC');
    expect(malformed).toEqual({
      valid: false,
      events: [],
      issues: [{ eventNumber: null, kind: 'invalid-feed' }]
    });

    const orphan = calendar([
      'BEGIN:VEVENT',
      'UID:missing-master',
      'RECURRENCE-ID:20261108T080000Z',
      'DTSTART:20261108T090000Z',
      'DTEND:20261108T093000Z',
      'SUMMARY:Orphan',
      'END:VEVENT'
    ].join('\r\n'));
    const result = parseCalendarFeedForLocalDate(orphan, source, '2026-11-08', 'UTC');
    expect(result.valid && result.issues).toEqual([
      { eventNumber: 1, kind: 'unresolved-exception' }
    ]);
  });
});
