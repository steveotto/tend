import { afterEach, describe, expect, it } from 'vitest';
import {
  createLocalCalendarReaderServer,
  isPublicAddress,
  parseFeedUrl
} from '../local-calendar-reader.mjs';
import { CONTROLLED_CALENDAR_TEST_URL } from '../src/domain/calendar-sources.ts';

let server: ReturnType<typeof createLocalCalendarReaderServer> | null = null;
let origin = '';

async function startReader() {
  server = createLocalCalendarReaderServer();
  await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Reader did not bind to a local port.');
  origin = `http://127.0.0.1:${address.port}`;
}

async function readControlledFeed() {
  const now = Date.now();
  return fetch(`${origin}/api/calendar/read`, {
    method: 'POST',
    headers: {
      origin: 'http://127.0.0.1:5303',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      source: {
        id: 'calendar-source-controlled',
        name: 'Controlled test calendar',
        url: CONTROLLED_CALENDAR_TEST_URL,
        kind: 'controlled-test'
      },
      now,
      rangeStart: now - 60 * 60_000,
      rangeEnd: now + 31 * 24 * 60 * 60_000,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    })
  });
}

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server!.close(error => error ? reject(error) : resolve());
    });
    server = null;
  }
});

describe('local calendar reader', () => {
  it('normalizes webcal links before URL parsing without relaxing host checks', () => {
    expect(parseFeedUrl('webcal://p123-caldav.icloud.com/published/example').protocol).toBe('https:');
    expect(parseFeedUrl('https://p123-caldav.icloud.com/published/example').protocol).toBe('https:');
    expect(() => parseFeedUrl('webcal://calendar.example.invalid/feed')).toThrow();
    expect(() => parseFeedUrl('webcal://user:password@p123-caldav.icloud.com/feed')).toThrow();
  });

  it('fetches the controlled ICS fixture over HTTP and parses timed, all-day, and recurring events', async () => {
    await startReader();
    const response = await readControlledFeed();
    expect(response.status).toBe(200);
    const result = await response.json() as {
      events: Array<{ title: string; allDay: boolean; startsAt: number }>;
      issueCount: number;
    };

    expect(result.issueCount).toBe(0);
    expect(result.events.map(event => event.title)).toEqual([
      'Controlled all-day event',
      'Controlled timed event',
      'Controlled recurring event',
      'Controlled recurring event',
      'Controlled recurring event'
    ]);
    expect(result.events[0]?.allDay).toBe(true);
    expect(result.events[1]?.allDay).toBe(false);
    expect(result.events.slice(1).every(event => !event.allDay)).toBe(true);
    expect(result.events.map(event => event.startsAt)).toEqual(
      [...result.events.map(event => event.startsAt)].sort((left, right) => left - right)
    );

    const date = new Intl.DateTimeFormat('en-CA').format(new Date());
    const fixture = await fetch(`${origin}/__test/controlled-calendar.ics?date=${date}`);
    expect(fixture.headers.get('content-type')).toContain('text/calendar');
    expect(await fixture.text()).toContain('RRULE:FREQ=DAILY;COUNT=3');
  });

  it('rejects unsupported hosts without echoing the supplied URL', async () => {
    await startReader();
    const privateUrl = 'https://calendar.example.invalid/private-secret-token.ics';
    const response = await fetch(`${origin}/api/calendar/read`, {
      method: 'POST',
      headers: {
        origin: 'http://127.0.0.1:5303',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        source: { id: 'calendar-source-unsupported', name: 'Unsupported source', url: privateUrl },
        now: Date.now(),
        rangeStart: Date.now(),
        rangeEnd: Date.now() + 60_000,
        timeZone: 'UTC'
      })
    });

    expect(response.status).toBe(422);
    const error = await response.json() as { code: string; error: string };
    expect(error.code).toBe('url-not-allowed');
    expect(error.error).toContain('public iCloud feed');
    expect(JSON.stringify(error)).not.toContain(privateUrl);
    expect(JSON.stringify(error)).not.toContain('private-secret-token');
  });

  it('restricts upstream addresses and rejects cross-origin requests', async () => {
    expect(isPublicAddress('8.8.8.8')).toBe(true);
    expect(isPublicAddress('127.0.0.1')).toBe(false);
    expect(isPublicAddress('10.0.0.1')).toBe(false);
    expect(isPublicAddress('169.254.1.1')).toBe(false);
    expect(isPublicAddress('::1')).toBe(false);
    expect(isPublicAddress('fd00::1')).toBe(false);
    expect(isPublicAddress('2001:4860:4860::8888')).toBe(true);

    await startReader();
    const response = await fetch(`${origin}/api/calendar/read`, {
      method: 'POST',
      headers: {
        origin: 'https://attacker.example',
        'content-type': 'application/json'
      },
      body: '{}'
    });
    expect(response.status).toBe(403);
  });
});
