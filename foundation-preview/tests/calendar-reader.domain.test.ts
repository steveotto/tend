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
  options: { origin?: string; method?: string; contentType?: string } = {}
): Request {
  const init: RequestInit = {
    method: options.method ?? 'POST',
    headers: {
      ...(options.origin ? { origin: options.origin } : { origin: 'https://tendwhatmatters.com' }),
      'content-type': options.contentType ?? 'application/json'
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
