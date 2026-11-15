import { describe, expect, it, vi } from 'vitest';
import { onRequest } from '../functions/api/calendar/read.ts';
import { handleCalendarRead } from '../src/domain/calendar-reader.ts';

const now = Date.UTC(2026, 10, 14, 12);
const source = {
  id: 'calendar-source-fixture',
  name: 'Synthetic fixture',
  url: 'webcal://p123-caldav.icloud.com/published/fixture'
};
const feed = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Tend//Synthetic Test//EN',
  'BEGIN:VEVENT',
  'UID:synthetic-event@test.invalid',
  'DTSTART:20261114T130000Z',
  'DTEND:20261114T140000Z',
  'SUMMARY:Synthetic event',
  'END:VEVENT',
  'END:VCALENDAR',
  ''
].join('\r\n');

function request(
  body: unknown,
  options: { origin?: string; method?: string; contentType?: string; requestId?: string } = {}
): Request {
  const init: RequestInit = {
    method: options.method ?? 'POST',
    headers: {
      ...(options.origin ? { origin: options.origin } : { origin: 'https://tendwhatmatters.com' }),
      'content-type': options.contentType ?? 'application/json',
      ...(options.requestId ? { 'x-tend-calendar-request-id': options.requestId } : {})
    }
  };
  if (init.method !== 'GET') init.body = JSON.stringify(body);
  return new Request('https://tendwhatmatters.com/api/calendar/read', init);
}

function validBody(sourceOverride: unknown = source) {
  return {
    source: sourceOverride,
    now,
    rangeStart: now,
    rangeEnd: now + 31 * 86_400_000,
    timeZone: 'UTC'
  };
}

function calendarResponse(body = feed, headers: HeadersInit = {}): Response {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/calendar; charset=utf-8', ...headers }
  });
}

describe('Cloudflare Pages Calendar reader', () => {
  it('processes a larger synthetic feed within the configured feed-size bound', async () => {
    const manyEvents = Array.from({ length: 1_000 }, (_, index) => [
      'BEGIN:VEVENT',
      `UID:synthetic-${index}`,
      'DTSTART:20261114T130000Z',
      'DTEND:20261114T140000Z',
      `SUMMARY:Synthetic event ${index}`,
      'END:VEVENT'
    ].join('\r\n')).join('\r\n');
    const largerFeed = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Tend//Synthetic Test//EN',
      manyEvents,
      'END:VCALENDAR',
      ''
    ].join('\r\n');
    const fetchImpl = vi.fn<typeof fetch>(async () => calendarResponse(largerFeed));
    const response = await handleCalendarRead(request(validBody()), { fetchImpl });
    const result = await response.json() as {
      events: Array<{ title: string }>;
      issueCount: number;
    };

    expect(new TextEncoder().encode(largerFeed).byteLength).toBeLessThan(5 * 1_048_576);
    expect(response.status).toBe(200);
    expect(result.events).toHaveLength(1_000);
    expect(result.issueCount).toBe(0);
  });

  it('parses recurrence and reports malformed entries as sanitized issues', async () => {
    const mixedFeed = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Tend//Synthetic Test//EN',
      'BEGIN:VEVENT',
      'UID:daily-fixture',
      'DTSTART:20261114T130000Z',
      'DTEND:20261114T140000Z',
      'RRULE:FREQ=DAILY;COUNT=4',
      'SUMMARY:Synthetic recurring event',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:malformed-fixture',
      'DTSTART:NOT-A-DATE',
      'SUMMARY:Malformed secret entry',
      'END:VEVENT',
      'END:VCALENDAR',
      ''
    ].join('\r\n');
    const fetchImpl = vi.fn<typeof fetch>(async () => calendarResponse(mixedFeed));
    const response = await handleCalendarRead(request(validBody()), { fetchImpl });
    const responseText = await response.clone().text();
    const result = JSON.parse(responseText) as {
      events: Array<{ title: string }>;
      issueCount: number;
    };

    expect(response.status).toBe(200);
    expect(result.events.map(event => event.title)).toEqual([
      'Synthetic recurring event',
      'Synthetic recurring event',
      'Synthetic recurring event',
      'Synthetic recurring event'
    ]);
    expect(result.issueCount).toBe(1);
    expect(responseText).not.toContain('Malformed secret entry');
  });

  it('parses a synthetic iCalendar feed and normalizes webcal to HTTPS', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => calendarResponse());
    const response = await handleCalendarRead(request(validBody()), { fetchImpl });
    const result = await response.json() as {
      events: Array<{ title: string; sourceId: string; startsAt: number }>;
      issueCount: number;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(result.issueCount).toBe(0);
    expect(result.events).toEqual([expect.objectContaining({
      title: 'Synthetic event',
      sourceId: source.id,
      startsAt: Date.UTC(2026, 10, 14, 13)
    })]);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [target, init] = fetchImpl.mock.calls[0]!;
    expect(String(target)).toBe('https://p123-caldav.icloud.com/published/fixture');
    expect(init).toMatchObject({
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store'
    });
  });

  it('maps the Pages Function route to the Calendar API for unsupported methods', async () => {
    const response = await onRequest({
      request: request(null, { method: 'GET' })
    });

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
  });

  it('correlates safe stage telemetry without logging feed or event content', async () => {
    const requestId = 'c3b19aa7-9e44-4c5f-9f7d-26770998f56a';
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => calendarResponse()));
    const response = await onRequest({
      request: request(validBody(), { requestId })
    });
    const result = await response.json() as { events: unknown[]; issueCount: number };
    const entries = log.mock.calls.map(([entry]) => JSON.parse(String(entry)) as {
      requestId: string;
      stage?: string;
      outcome?: string;
      elapsedMs?: number;
      status?: number;
    });

    expect(response.headers.get('x-tend-calendar-request-id')).toBe(requestId);
    expect(result.events).toHaveLength(1);
    expect(entries.every(entry => entry.requestId === requestId)).toBe(true);
    expect(entries.map(entry => entry.stage)).toEqual(expect.arrayContaining([
      'request_validation',
      'request_body',
      'upstream_fetch',
      'feed_parse',
      'response_serialization',
      'request_complete'
    ]));
    const elapsedValues = entries.flatMap(entry => entry.elapsedMs === undefined ? [] : [entry.elapsedMs]);
    expect(elapsedValues.every(value => Number.isSafeInteger(value) && value >= 0)).toBe(true);
    expect(entries.find(entry => entry.stage === 'request_complete')).toMatchObject({
      outcome: 'ok',
      status: 200
    });
    const loggedText = log.mock.calls.map(([entry]) => String(entry)).join('\n');
    expect(loggedText).not.toContain('Synthetic event');
    expect(loggedText).not.toContain(source.url);
  });

  it('distinguishes a serialized client error from a serialization failure', async () => {
    const requestId = 'c3b19aa7-9e44-4c5f-9f7d-26770998f56a';
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const response = await onRequest({
      request: request({}, { requestId, contentType: 'text/plain' })
    });
    const entries = log.mock.calls.map(([entry]) => JSON.parse(String(entry)) as {
      requestId: string;
      stage?: string;
      outcome?: string;
      status?: number;
    });

    expect(response.status).toBe(400);
    expect(entries).toContainEqual(expect.objectContaining({
      requestId,
      stage: 'response_serialization',
      outcome: 'completed'
    }));
    expect(entries).toContainEqual(expect.objectContaining({
      requestId,
      stage: 'request_complete',
      outcome: 'http_failure',
      status: 400
    }));
  });

  it('logs only the exception class for an upstream runtime error', async () => {
    const requestId = 'c3b19aa7-9e44-4c5f-9f7d-26770998f56a';
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('private upstream response detail');
    }));
    const response = await onRequest({
      request: request(validBody(), { requestId })
    });
    const entries = log.mock.calls.map(([entry]) => JSON.parse(String(entry)) as {
      requestId: string;
      stage?: string;
      outcome?: string;
      exceptionType?: string;
    });
    const exceptionEntry = entries.find(entry => entry.outcome === 'exception');
    const loggedText = log.mock.calls.map(([entry]) => String(entry)).join('\n');

    expect(response.status).toBe(502);
    expect(exceptionEntry).toMatchObject({
      requestId,
      stage: 'upstream_fetch',
      exceptionType: 'TypeError'
    });
    expect(loggedText).not.toContain('private upstream response detail');
    expect(loggedText).not.toContain(source.url);
  });

  it('returns a server-generated correlation ID when the supplied ID is malformed', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const response = await onRequest({
      request: request(null, { requestId: 'private-not-an-id', method: 'GET' })
    });
    const requestId = response.headers.get('x-tend-calendar-request-id');

    expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(log.mock.calls.map(([entry]) => String(entry)).join('\n'))
      .not.toContain('private-not-an-id');
  });

  it('rejects disallowed URLs without making an upstream request or echoing private text', async () => {
    const secretUrl = 'https://calendar.example.invalid/private-secret-token.ics';
    const fetchImpl = vi.fn<typeof fetch>();
    const response = await handleCalendarRead(
      request(validBody({ ...source, url: secretUrl })),
      { fetchImpl }
    );
    const result = await response.text();

    expect(response.status).toBe(422);
    expect(result).toContain('"code":"url-not-allowed"');
    expect(result).not.toContain(secretUrl);
    expect(result).not.toContain('private-secret-token');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects cross-origin redirects before fetching the redirected target', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, {
      status: 302,
      headers: { location: 'https://attacker.example/private.ics' }
    }));
    const response = await handleCalendarRead(request(validBody()), { fetchImpl });
    const result = await response.text();

    expect(response.status).toBe(422);
    expect(result).toContain('"code":"redirect-not-allowed"');
    expect(result).not.toContain('attacker.example');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('validates each redirect and follows only HTTPS iCloud destinations', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: { location: '/published/redirected-fixture' }
      }))
      .mockResolvedValueOnce(calendarResponse());
    const response = await handleCalendarRead(request(validBody()), { fetchImpl });

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[1]?.[0])).toBe(
      'https://p123-caldav.icloud.com/published/redirected-fixture'
    );
  });

  it('returns a sanitized retrieval failure for upstream errors', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(
      'upstream-private-response',
      { status: 503 }
    ));
    const response = await handleCalendarRead(request(validBody()), { fetchImpl });
    const result = await response.text();

    expect(response.status).toBe(502);
    expect(result).toContain('"code":"feed-http-rejected"');
    expect(result).toContain('"upstreamStatus":503');
    expect(result).not.toContain('upstream-private-response');
    expect(result).not.toContain(source.url);
  });

  it('reports parsing failures without exposing feed contents', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => calendarResponse(
      'not-a-calendar secret-event-content'
    ));
    const response = await handleCalendarRead(request(validBody()), { fetchImpl });
    const result = await response.text();

    expect(response.status).toBe(422);
    expect(result).toContain('"code":"feed-parse-failed"');
    expect(result).not.toContain('secret-event-content');
  });

  it('enforces method, origin, request-size, and range limits', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => calendarResponse());
    const methodResponse = await handleCalendarRead(request(null, { method: 'GET' }), { fetchImpl });
    const originResponse = await handleCalendarRead(
      request(validBody(), { origin: 'https://attacker.example' }),
      { fetchImpl }
    );
    const largeBody = JSON.stringify({ ...validBody(), padding: 'x'.repeat(17_000) });
    const largeResponse = await handleCalendarRead(new Request(
      'https://tendwhatmatters.com/api/calendar/read',
      {
        method: 'POST',
        headers: {
          origin: 'https://tendwhatmatters.com',
          'content-type': 'application/json'
        },
        body: largeBody
      }
    ), { fetchImpl });
    const missingOrigin = await handleCalendarRead(new Request(
      'https://tendwhatmatters.com/api/calendar/read',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validBody())
      }
    ), { fetchImpl });
    const wideRangeResponse = await handleCalendarRead(request({
      ...validBody(),
      rangeEnd: now + 33 * 86_400_000
    }), { fetchImpl });

    expect(methodResponse.status).toBe(405);
    expect(methodResponse.headers.get('allow')).toBe('POST');
    expect(originResponse.status).toBe(403);
    expect(missingOrigin.status).toBe(403);
    expect(largeResponse.status).toBe(413);
    expect(wideRangeResponse.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects overlarge feeds before reading their body', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => calendarResponse('', {
      'content-length': String(5 * 1_048_576 + 1)
    }));
    const response = await handleCalendarRead(request(validBody()), { fetchImpl });
    const result = await response.json() as { code: string; limitBytes: number };

    expect(response.status).toBe(502);
    expect(result.code).toBe('feed-too-large');
    expect(result.limitBytes).toBe(5 * 1_048_576);
  });

  it('bounds upstream fetch time and maps aborts to a safe timeout response', async () => {
    const fetchImpl = vi.fn<typeof fetch>((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    const response = await handleCalendarRead(request(validBody()), {
      fetchImpl,
      timeoutMs: 1
    });
    const result = await response.json() as { code: string };

    expect(response.status).toBe(502);
    expect(result.code).toBe('upstream-timeout');
  });
});
