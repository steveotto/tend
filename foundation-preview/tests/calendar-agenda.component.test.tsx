import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CalendarAgendaSection } from '../src/components/CalendarAgendaSection.tsx';
import { CalendarEventRow } from '../src/components/CalendarEventRow.tsx';
import type { CalendarEvent } from '../src/domain/calendar-events.ts';
import type { CalendarSource } from '../src/domain/calendar-sources.ts';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    json: async () => body
  } as Response;
}

function event(
  id: string,
  title: string,
  sourceId: string,
  startsAt: number,
  allDay = false
): CalendarEvent {
  return {
    id,
    title,
    sourceId,
    sourceName: sourceId,
    startsAt,
    endsAt: startsAt + 30 * 60_000,
    allDay
  };
}

function renderCalendar(sources: CalendarSource[], readerEnabled = true) {
  return render(
    <CalendarAgendaSection
      sources={sources}
      timeZone="UTC"
      readerEnabled={readerEnabled}
    />
  );
}

function expectNoCalendarSettingsShortcut() {
  expect(screen.queryByRole('button', { name: /settings/i })).toBeNull();
}

function expectNoCalendarOuterCard() {
  const section = document.querySelector('.today-calendar-section');
  expect(section?.querySelector('.calendar-agenda-content')).toBeTruthy();
  expect(section?.querySelector('.card, .calendar-card')).toBeNull();
}

describe('upcoming calendar agenda', () => {
  it('renders the date tile, long title, secondary date detail, and relative label', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-30T23:30:00Z'));
    const allDay = event(
      'all-day',
      'A synthetic all-day item with a title that should wrap instead of being clipped',
      'Synthetic calendar',
      Date.parse('2026-12-01T00:00:00Z'),
      true
    );
    const future = event(
      'future',
      'A synthetic timed item with enough words to exercise the flexible row layout',
      'Synthetic calendar',
      Date.parse('2026-12-05T09:00:00Z')
    );
    render(
      <ol aria-label="Synthetic calendar events">
        <CalendarEventRow event={allDay} now={Date.now()} timeZone="UTC" />
        <CalendarEventRow event={future} now={Date.now()} timeZone="UTC" />
      </ol>
    );

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.querySelector('.calendar-event__month')?.textContent).toBe('DEC');
    expect(rows[0]?.querySelector('.calendar-event__day')?.textContent).toBe('1');
    expect(rows[0]?.querySelector('.calendar-event__date-time')?.textContent).toBe('Tue, Dec 1 · All day');
    expect(rows[0]?.querySelector('.calendar-event__relative')?.textContent).toBe('Tomorrow');
    expect(rows[1]?.querySelector('.calendar-event__month')?.textContent).toBe('DEC');
    expect(rows[1]?.querySelector('.calendar-event__day')?.textContent).toBe('5');
    expect(rows[1]?.querySelector('.calendar-event__date-time')?.textContent)
      .toBe('Sat, Dec 5 · 9:00 AM–9:30 AM');
    expect(rows[1]?.querySelector('.calendar-event__relative')?.textContent).toBe('in 5d');
    expect(screen.getByText(future.title)).toBeTruthy();
  });

  it('distinguishes no calendars and disabled calendars', () => {
    const empty = renderCalendar([]);
    expect(screen.getByText('Connect a calendar')).toBeTruthy();
    expect(screen.getByText('More → Settings → Calendar.')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Calendar date range' })).toBeNull();
    expect(screen.getByRole('status').classList.contains('calendar-event--status')).toBe(true);
    expectNoCalendarSettingsShortcut();
    expectNoCalendarOuterCard();
    empty.unmount();

    renderCalendar([{ id: 'disabled', name: 'Disabled', url: 'https://p.icloud.com/a', enabled: false }]);
    expect(screen.getByText('Enable a calendar')).toBeTruthy();
    expect(screen.getByText('More → Settings → Calendar.')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Calendar date range' })).toBeNull();
    expectNoCalendarSettingsShortcut();
  });

  it('shows loading and range-specific event-sized empty states', async () => {
    const user = userEvent.setup();
    let resolveRead!: (value: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>(resolve => {
      resolveRead = resolve;
    }));
    vi.stubGlobal('fetch', fetchMock);
    renderCalendar([{ id: 'calendar', name: 'Home', url: 'https://p.icloud.com/a' }]);

    expect(screen.getByRole('status').classList.contains('calendar-event--status')).toBe(true);
    const loadingStatus = screen.getByRole('status');
    expect(loadingStatus.getAttribute('aria-live')).toBe('polite');
    expect(screen.getByText('Loading events…')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Calendar date range' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Today' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Today' }).getAttribute('title')).toBe('Today');
    expectNoCalendarSettingsShortcut();
    expectNoCalendarOuterCard();
    await act(async () => {
      resolveRead(response({ events: [], issueCount: 0 }));
      await Promise.resolve();
    });
    expect(await screen.findByText('No events today.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Week' }));
    expect(screen.getByText('No events in the next 7 days.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Month' }));
    expect(screen.getByText('No events in the next month.')).toBeTruthy();
    expect(screen.getByRole('status').classList.contains('calendar-event--status')).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expectNoCalendarSettingsShortcut();
  });

  it('keeps visible events while refreshing and announces a quiet update', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-14T10:00:00Z'));
    const source = { id: 'calendar', name: 'Synthetic', url: 'https://p.icloud.com/a' };
    const firstEvent = event('visible', 'Synthetic visible event', source.name, Date.parse('2026-11-14T12:00:00Z'));
    let resolveRefresh!: (value: Response) => void;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ events: [firstEvent], issueCount: 0 }))
      .mockImplementationOnce(() => new Promise<Response>(resolve => {
        resolveRefresh = resolve;
      }));
    vi.stubGlobal('fetch', fetchMock);
    const view = renderCalendar([source]);
    expect(await screen.findByText(firstEvent.title)).toBeTruthy();

    view.rerender(
      <CalendarAgendaSection
        sources={[{ ...source }]}
        timeZone="UTC"
        readerEnabled
      />
    );

    expect(screen.getByText(firstEvent.title)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Updating events…');
    expect(screen.queryByText('Loading events…')).toBeNull();
    expect(screen.getByRole('list', { name: 'Calendar events for today' })).toBeTruthy();

    await act(async () => {
      resolveRefresh(response({ events: [firstEvent], issueCount: 0 }));
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.queryByText('Updating events…')).toBeNull());
  });

  it('uses identical calendar outlines with the requested Today, Week, and Month marks', () => {
    renderCalendar([{ id: 'calendar', name: 'Home', url: 'https://p.icloud.com/a' }], false);
    const buttons = ['Today', 'Week', 'Month'].map(name =>
      screen.getByRole('button', { name })
    );
    const icons = buttons.map(button => button.querySelector('svg'));
    expect(icons.every(Boolean)).toBe(true);
    expect(icons.map(icon => icon?.getAttribute('viewBox'))).toEqual([
      '0 0 24 24',
      '0 0 24 24',
      '0 0 24 24'
    ]);
    expect(icons.map(icon => [...icon!.children].slice(0, 2).map(shape => shape.outerHTML)))
      .toEqual([0, 1, 2].map(() => [
        '<rect x="3.5" y="5.5" width="17" height="16" rx="2.5"></rect>',
        '<path d="M8 3.75v3.5M16 3.75v3.5M3.75 10.25h16.5"></path>'
      ]));
    expect(icons.map(icon => icon?.querySelectorAll('.calendar-range-icon__dot').length))
      .toEqual([1, 7, 12]);
    expect(icons[0]?.querySelector('.calendar-range-icon__dot')?.getAttribute('r')).toBe('3');
  });

  it('derives Today, Week, and Month from one loaded month window', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-08T12:00:00Z'));
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as {
        source: CalendarSource;
        now: number;
        rangeStart: number;
        rangeEnd: number;
      };
      expect(Number.isSafeInteger(request.now)).toBe(true);
      expect(request.rangeStart).toBe(Date.parse('2026-11-08T00:00:00Z'));
      expect(request.rangeEnd).toBe(Date.parse('2026-12-08T00:00:00Z'));
      if (request.source.id === 'first') {
        return response({
          events: [
            event('later', 'Later tomorrow', 'First', Date.parse('2026-11-09T09:00:00Z')),
            event('today', 'Later today', 'First', Date.parse('2026-11-08T13:00:00Z'))
          ],
          issueCount: 0
        });
      }
      const allDay = event('all-day', 'All day tomorrow', 'Second', Date.parse('2026-11-09T00:00:00Z'), true);
      const inProgress = {
        ...event('in-progress', 'In-progress event', 'Second', Date.parse('2026-11-08T11:30:00Z')),
        endsAt: Date.parse('2026-11-08T12:30:00Z')
      };
      return response({
        events: [
          inProgress,
          allDay
        ],
        issueCount: 0
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderCalendar([
      { id: 'first', name: 'First', url: 'https://p.icloud.com/a' },
      { id: 'second', name: 'Second', url: 'https://p.icloud.com/b' }
    ]);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const todayList = screen.getByRole('list', { name: 'Calendar events for today' });
    expect([...todayList.querySelectorAll('.calendar-event strong')].map(element => element.textContent)).toEqual([
      'In-progress event',
      'Later today'
    ]);
    expect(todayList.querySelectorAll('.calendar-event')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Today' }).getAttribute('aria-pressed')).toBe('true');

    await user.click(screen.getByRole('button', { name: 'Week' }));
    const weekList = screen.getByRole('list', { name: 'Calendar events for week' });
    expect([...weekList.querySelectorAll('.calendar-event strong')].map(element => element.textContent)).toEqual([
      'In-progress event',
      'Later today',
      'All day tomorrow',
      'Later tomorrow'
    ]);
    expect(weekList.querySelectorAll('.calendar-event')).toHaveLength(4);
    expect(screen.getByText('Week · Nov 8–14')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Week' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Month' }));
    expect(screen.getByRole('list', { name: 'Calendar events for month' })).toBeTruthy();
    expect(screen.getByText('Month · Nov 8–Dec 7')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const list = screen.getByRole('list', { name: 'Calendar events for month' });
    expect([...list.querySelectorAll('.calendar-event strong')].map(element => element.textContent)).toEqual([
      'In-progress event',
      'Later today',
      'All day tomorrow',
      'Later tomorrow'
    ]);
    expect(list.querySelectorAll('.calendar-event')).toHaveLength(4);
    expect(list.textContent).toContain('Nov 8 · 11:30 AM–12:30 PM');
    expect(list.textContent).toContain('Nov 8 · 1:00 PM–1:30 PM');
    expect(list.textContent).toContain('Nov 9 · All day');
    expectNoCalendarSettingsShortcut();
    expectNoCalendarOuterCard();
  });

  it('keeps successful events when a source fails and retries only after user action', async () => {
    const user = userEvent.setup();
    const now = Date.now();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as { source: CalendarSource };
      if (request.source.id === 'broken') return response({ error: 'unavailable' }, 502);
      return response({
        events: [
          event('later', '<img src=x> afternoon', 'Home', now + 2 * 60 * 60_000),
          event('earlier', 'Morning appointment', 'Home', now)
        ],
        issueCount: 0
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderCalendar([
      { id: 'home', name: 'Home', url: 'https://p.icloud.com/a' },
      { id: 'broken', name: 'Backup', url: 'https://p.icloud.com/b' }
    ]);

    expect(await screen.findByText('Morning appointment')).toBeTruthy();
    expect(screen.getByText('<img src=x> afternoon')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Some calendars could not be loaded.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry calendars' })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    expectNoCalendarOuterCard();
    await user.click(screen.getByRole('button', { name: 'Retry calendars' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(screen.getByRole('button', { name: 'Retry calendars' })).toBeTruthy();
    expectNoCalendarOuterCard();
  });

  it.each([
    ['reader-unavailable', 'The local calendar reader could not be reached.'],
    ['url-not-allowed', 'The saved link is not an allowed public iCloud feed URL.'],
    ['redirect-not-allowed', 'The feed redirected outside the allowed public iCloud host policy.'],
    ['url-target-not-public', 'The feed host resolved to a non-public network address and was blocked.'],
    ['dns-resolution-failed', 'The allowed feed host could not be resolved on this network.'],
    ['upstream-timeout', 'The calendar server did not respond before the local reader timed out.'],
    ['upstream-tls-failed', 'A secure connection to the calendar server could not be established.'],
    ['upstream-network-failed', 'The calendar server could not be reached from this network.'],
    ['feed-http-rejected', 'The calendar server returned an unsuccessful HTTP response.'],
    ['feed-type-rejected', 'The calendar server response was not identified as a calendar feed.'],
    ['feed-too-large', 'The calendar feed exceeded the local reader size limit.'],
    ['redirect-limit', 'The feed exceeded the local redirect limit.'],
    ['feed-retrieval-failed', 'The reader was reached, but the calendar feed could not be retrieved.'],
    ['feed-parse-failed', 'The feed was retrieved, but its calendar data could not be parsed.']
  ])('reports safe %s diagnostics', async (code, message) => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ code, error: 'safe generic error' }, 422)));
    renderCalendar([{ id: 'home', name: 'Home', url: 'https://p.icloud.com/private' }]);

    expect(await screen.findByText('Calendar events could not be loaded.')).toBeTruthy();
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Calendar date range' })).toBeTruthy();
    expectNoCalendarSettingsShortcut();
    expectNoCalendarOuterCard();
  });

  it('classifies a failed same-origin request as reader-unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Network request failed');
    }));
    renderCalendar([{ id: 'home', name: 'Home', url: 'https://p.icloud.com/private' }]);

    expect(await screen.findByText('Calendar events could not be loaded.')).toBeTruthy();
    expect(screen.getByText('The local calendar reader could not be reached.')).toBeTruthy();
    expectNoCalendarSettingsShortcut();
  });

  it('shows only safe byte-count metadata for an oversized feed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({
      code: 'feed-too-large',
      error: 'Calendar feed failed.',
      feedBytes: 5_242_881,
      limitBytes: 5_242_880
    }, 502)));
    renderCalendar([{ id: 'home', name: 'Home', url: 'https://p.icloud.com/private' }]);

    expect(await screen.findByText('Calendar events could not be loaded.')).toBeTruthy();
    expect(screen.getByText('The calendar feed exceeded the local reader size limit.')).toBeTruthy();
  });

  it('removes a source’s events from view when that source is disabled', async () => {
    const fetchMock = vi.fn(async () => response({
      events: [event('event-1', 'A private synthetic appointment', 'Home', Date.now())],
      issueCount: 0
    }));
    vi.stubGlobal('fetch', fetchMock);
    const sources: CalendarSource[] = [{
      id: 'home',
      name: 'Home',
      url: 'https://p.icloud.com/a',
      enabled: true
    }];
    const view = renderCalendar(sources);

    expect(await screen.findByText('A private synthetic appointment')).toBeTruthy();
    view.rerender(
      <CalendarAgendaSection
        sources={[{ ...sources[0]!, enabled: false }]}
        timeZone="UTC"
        readerEnabled
      />
    );

    expect(await screen.findByText('Enable a calendar')).toBeTruthy();
    expect(screen.getByText('More → Settings → Calendar.')).toBeTruthy();
    expect(screen.queryByText('A private synthetic appointment')).toBeNull();
  });
});
