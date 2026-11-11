import { describe, expect, it } from 'vitest';
import { selectTodayCalendarEvents } from '../src/domain/calendar-events.ts';
import type { CalendarEvent } from '../src/domain/calendar-events.ts';

describe('Today calendar event selection', () => {
  it('keeps all-day civil dates stable and includes timed events crossing Today boundaries', () => {
    const today = new Date(2026, 10, 1, 12);
    const start = new Date(2026, 10, 1).getTime();
    const nextDay = new Date(2026, 10, 2).getTime();
    const events: CalendarEvent[] = [
      {
        id: 'all-day',
        sourceId: 'work',
        title: 'All day',
        calendarName: 'Work',
        kind: 'all-day',
        startDate: '2026-11-01',
        endDate: '2026-11-02'
      },
      {
        id: 'overnight',
        sourceId: 'home',
        title: 'Overnight',
        calendarName: 'Home',
        kind: 'timed',
        startAt: start - 60 * 60 * 1000,
        endAt: start + 60 * 60 * 1000
      },
      {
        id: 'tomorrow',
        sourceId: 'work',
        title: 'Tomorrow',
        calendarName: 'Work',
        kind: 'timed',
        startAt: nextDay,
        endAt: nextDay + 60 * 60 * 1000
      },
      {
        id: 'invalid',
        sourceId: 'work',
        title: 'Invalid',
        calendarName: 'Work',
        kind: 'timed',
        startAt: nextDay,
        endAt: start
      }
    ];

    expect(selectTodayCalendarEvents(events, today).map(event => event.id)).toEqual(['overnight', 'all-day']);
  });

  it('uses the local next-day boundary rather than assuming every day is 24 hours', () => {
    const today = new Date(2026, 2, 8, 12);
    const dayStart = new Date(2026, 2, 8).getTime();
    const nextDayStart = new Date(2026, 2, 9).getTime();
    const crossing: CalendarEvent = {
      id: 'boundary',
      sourceId: 'work',
      title: 'Boundary',
      calendarName: 'Work',
      kind: 'timed',
      startAt: nextDayStart - 1,
      endAt: nextDayStart + 1
    };

    expect(selectTodayCalendarEvents([crossing], today)).toHaveLength(1);
    expect(nextDayStart - dayStart).toBeGreaterThan(0);
  });
});
