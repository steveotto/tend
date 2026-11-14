import { createServer } from 'node:http';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import * as https from 'node:https';
import { pathToFileURL } from 'node:url';
import { parseCalendarFeedForRange } from './src/domain/calendar-events.ts';
import {
  calendarFeedUrlError,
  CONTROLLED_CALENDAR_TEST_URL
} from './src/domain/calendar-sources.ts';

const maximumRequestBytes = 16_384;
const maximumFeedBytes = 5 * 1_048_576;
const maximumRedirects = 3;
const requestTimeoutMs = 10_000;
const controlledFeedPath = '/__test/controlled-calendar.ics';

class CalendarReaderError extends Error {
  constructor(code, metadata = {}) {
    super(code);
    this.code = code;
    this.metadata = metadata;
  }
}

function failureResponse(response, status, code, metadata = {}) {
  const messages = {
    'invalid-request': 'Calendar request is invalid.',
    'url-not-allowed': 'The saved link is not an allowed public iCloud feed URL.',
    'redirect-not-allowed': 'The feed redirected outside the allowed public iCloud host policy.',
    'url-target-not-public': 'The feed host resolved to a non-public network address and was blocked.',
    'dns-resolution-failed': 'The allowed feed host could not be resolved on this network.',
    'upstream-timeout': 'The calendar server did not respond before the local reader timed out.',
    'upstream-tls-failed': 'A secure connection to the calendar server could not be established.',
    'upstream-network-failed': 'The calendar server could not be reached from this network.',
    'feed-http-rejected': 'The calendar server returned an unsuccessful HTTP response.',
    'feed-type-rejected': 'The calendar server response was not identified as a calendar feed.',
    'feed-too-large': 'The calendar feed exceeded the local reader size limit.',
    'redirect-limit': 'The feed exceeded the local redirect limit.',
    'feed-retrieval-failed': 'Calendar feed could not be retrieved.',
    'feed-parse-failed': 'Calendar feed data could not be parsed.'
  };
  sendJson(response, status, {
    code,
    error: messages[code] ?? 'Calendar request failed.',
    ...(Number.isInteger(metadata.upstreamStatus) ? { upstreamStatus: metadata.upstreamStatus } : {}),
    ...(Number.isSafeInteger(metadata.feedBytes) && metadata.feedBytes >= 0
      ? { feedBytes: metadata.feedBytes }
      : {}),
    ...(Number.isSafeInteger(metadata.limitBytes) && metadata.limitBytes > 0
      ? { limitBytes: metadata.limitBytes }
      : {})
  });
}

function networkFailureCode(error) {
  if (error instanceof CalendarReaderError) return error.code;
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code === 'ETIMEDOUT') return 'upstream-timeout';
  if (code.startsWith('ERR_TLS') || code.startsWith('CERT_') || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
    return 'upstream-tls-failed';
  }
  return 'upstream-network-failed';
}

function isIpv4Public(address) {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some(value => value < 0 || value > 255)) return false;
  const [a, b, c] = octets;
  return !(a === 0 || a === 10 || a === 127
    || a === 169 && b === 254
    || a === 172 && b >= 16 && b <= 31
    || a === 192 && b === 0 && c === 0
    || a === 192 && b === 0 && c === 2
    || a === 192 && b === 88 && c === 99
    || a === 192 && b === 168
    || a === 198 && (b === 18 || b === 19)
    || a === 198 && b === 51 && c === 100
    || a === 203 && b === 0 && c === 113
    || a >= 224);
}

function isIpv6Global(address) {
  const value = address.toLowerCase().split('%')[0] ?? '';
  if (!value.startsWith('2') && !value.startsWith('3')) return false;
  if (/^2001:db8(?::|$)/.test(value)) return false;
  return true;
}

export function isPublicAddress(address) {
  const family = isIP(address);
  return family === 4 ? isIpv4Public(address) : family === 6 && isIpv6Global(address);
}

export function parseFeedUrl(raw, isRedirect = false) {
  const code = isRedirect ? 'redirect-not-allowed' : 'url-not-allowed';
  const normalizedRaw = !isRedirect && /^webcal:/i.test(raw)
    ? raw.replace(/^webcal:/i, 'https:')
    : raw;
  let url;
  try {
    url = new URL(normalizedRaw);
  } catch {
    throw new CalendarReaderError(code);
  }
  if (calendarFeedUrlError(normalizedRaw)
    || url.protocol !== 'https:'
    || (isRedirect && /^webcal:/i.test(raw))) {
    throw new CalendarReaderError(code);
  }
  return url;
}

async function lookupPublicHost(hostname) {
  let addresses;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new CalendarReaderError('dns-resolution-failed');
  }
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new CalendarReaderError('url-target-not-public');
  }
  return addresses;
}

function fetchHttps(url, addresses) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: 'GET',
      agent: false,
      headers: { accept: 'text/calendar' },
      lookup(_hostname, options, callback) {
        if (options?.all) callback(null, addresses);
        else {
          const firstAddress = addresses[0];
          if (!firstAddress) callback(new CalendarReaderError('feed-retrieval-failed'));
          else callback(null, firstAddress.address, firstAddress.family);
        }
      }
    }, response => {
      const location = response.headers.location;
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && typeof location === 'string') {
        response.resume();
        response.once('end', () => resolve({ redirect: location }));
        return;
      }
      const contentType = response.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase();
      if (response.statusCode !== 200) {
        response.resume();
        response.once('end', () => reject(new CalendarReaderError('feed-http-rejected', {
          upstreamStatus: response.statusCode
        })));
        return;
      }
      if (contentType !== 'text/calendar') {
        response.resume();
        response.once('end', () => reject(new CalendarReaderError('feed-type-rejected')));
        return;
      }
      if (Number(response.headers['content-length']) > maximumFeedBytes) {
        response.resume();
        const contentLength = Number(response.headers['content-length']);
        response.once('end', () => reject(new CalendarReaderError('feed-too-large', {
          ...(Number.isSafeInteger(contentLength) ? { feedBytes: contentLength } : {}),
          limitBytes: maximumFeedBytes
        })));
        return;
      }
      const chunks = [];
      let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > maximumFeedBytes) {
          response.destroy(new CalendarReaderError('feed-too-large', {
            feedBytes: size,
            limitBytes: maximumFeedBytes
          }));
          return;
        }
        chunks.push(chunk);
      });
      response.once('end', () => resolve({ body: Buffer.concat(chunks).toString('utf8') }));
      response.once('error', error => reject(
        error instanceof CalendarReaderError
          ? error
          : new CalendarReaderError(networkFailureCode(error))
      ));
    });
    request.setTimeout(requestTimeoutMs, () => request.destroy(new CalendarReaderError('upstream-timeout')));
    request.once('error', error => reject(
      error instanceof CalendarReaderError
        ? error
        : new CalendarReaderError(networkFailureCode(error))
    ));
    request.end();
  });
}

async function readICloudFeed(rawUrl) {
  let url = parseFeedUrl(rawUrl);
  for (let redirect = 0; redirect <= maximumRedirects; redirect += 1) {
    const addresses = await lookupPublicHost(url.hostname);
    const result = await fetchHttps(url, addresses);
    if (!result.redirect) return result.body;
    if (redirect === maximumRedirects) throw new CalendarReaderError('redirect-limit');
    let next;
    try {
      next = new URL(result.redirect, url);
    } catch {
      throw new CalendarReaderError('redirect-not-allowed');
    }
    url = parseFeedUrl(next.href, true);
  }
  throw new CalendarReaderError('feed-retrieval-failed');
}

function controlledFeed(localDate, now) {
  const [year, month, day] = localDate.split('-').map(Number);
  const formatDate = value => value.toISOString().slice(0, 10).replaceAll('-', '');
  const formatDateTime = value => value.toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  const current = formatDate(new Date(Date.UTC(year, month - 1, day)));
  const next = formatDate(new Date(Date.UTC(year, month - 1, day + 1)));
  const timedStart = new Date(now + 60 * 60_000);
  const timedEnd = new Date(timedStart.getTime() + 30 * 60_000);
  const recurringStart = new Date(now + 2 * 60 * 60_000);
  const recurringEnd = new Date(recurringStart.getTime() + 30 * 60_000);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tend//Controlled Local Calendar Test//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    'UID:controlled-all-day@test.invalid',
    `DTSTART;VALUE=DATE:${current}`,
    `DTEND;VALUE=DATE:${next}`,
    'SUMMARY:Controlled all-day event',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:controlled-timed@test.invalid',
    `DTSTART:${formatDateTime(timedStart)}`,
    `DTEND:${formatDateTime(timedEnd)}`,
    'SUMMARY:Controlled timed event',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:controlled-recurring@test.invalid',
    `DTSTART:${formatDateTime(recurringStart)}`,
    `DTEND:${formatDateTime(recurringEnd)}`,
    'RRULE:FREQ=DAILY;COUNT=3',
    'SUMMARY:Controlled recurring event',
    'END:VEVENT',
    'END:VCALENDAR',
    ''
  ].join('\r\n');
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidInstant(value) {
  return Number.isSafeInteger(value) && Number.isFinite(new Date(value).getTime());
}

function localDateKey(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(instant));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isLocalOrigin(origin) {
  if (typeof origin !== 'string') return false;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'http:'
      && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost');
  } catch {
    return false;
  }
}

function sendJson(response, status, result) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  response.end(JSON.stringify(result));
}

async function readRequestBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumRequestBytes) throw new Error('request-too-large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function isValidSource(source) {
  return !!source
    && typeof source.id === 'string'
    && source.id.length > 0
    && source.id.length <= 120
    && typeof source.name === 'string'
    && source.name.trim().length > 0
    && source.name.length <= 60
    && typeof source.url === 'string'
    && source.url.length <= 4096
    && (source.kind === undefined || source.kind === 'controlled-test');
}

export function createLocalCalendarReaderServer() {
  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (request.method === 'GET' && requestUrl.pathname === '/health') {
      sendJson(response, 200, { ready: true });
      return;
    }
    if (request.method === 'GET' && requestUrl.pathname === controlledFeedPath) {
      const date = requestUrl.searchParams.get('date');
      if (!isValidDate(date)) {
        sendJson(response, 400, { error: 'A valid local date is required.' });
        return;
      }
      const requestedNowText = requestUrl.searchParams.get('now');
      const requestedNow = requestedNowText === null ? Number.NaN : Number(requestedNowText);
      const now = isValidInstant(requestedNow) ? requestedNow : Date.now();
      response.writeHead(200, {
        'content-type': 'text/calendar; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff'
      });
      response.end(controlledFeed(date, now));
      return;
    }
    if (request.method !== 'POST' || requestUrl.pathname !== '/api/calendar/read') {
      sendJson(response, 404, { error: 'Not found.' });
      return;
    }
    if (!isLocalOrigin(request.headers.origin)) {
      failureResponse(response, 403, 'request-rejected');
      return;
    }
    const declaredLength = Number(request.headers['content-length']);
    if (declaredLength > maximumRequestBytes) {
      request.resume();
      sendJson(response, 413, { code: 'invalid-request', error: 'Calendar request is too large.' });
      return;
    }

    try {
      let input;
      try {
        input = JSON.parse(await readRequestBody(request));
      } catch (error) {
        const tooLarge = error instanceof Error && error.message === 'request-too-large';
        sendJson(response, tooLarge ? 413 : 400, {
          code: 'invalid-request',
          error: tooLarge ? 'Calendar request is too large.' : 'Calendar request is invalid.'
        });
        return;
      }
      const { source, now, rangeStart, rangeEnd, timeZone } = input;
      if (!isValidSource(source)
        || !isValidInstant(now)
        || !isValidInstant(rangeStart)
        || !isValidInstant(rangeEnd)
        || rangeEnd <= rangeStart
        || typeof timeZone !== 'string'
        || timeZone.length === 0
        || timeZone.length > 100) {
        failureResponse(response, 400, 'invalid-request');
        return;
      }
      try {
        new Intl.DateTimeFormat('en', { timeZone }).format();
      } catch {
        failureResponse(response, 400, 'invalid-request');
        return;
      }
      const localDate = localDateKey(now, timeZone);

      let raw;
      if (source.kind === 'controlled-test') {
        if (source.url !== CONTROLLED_CALENDAR_TEST_URL) {
          failureResponse(response, 400, 'invalid-request');
          return;
        }
        const address = server.address();
        if (!address || typeof address === 'string') throw new CalendarReaderError('feed-retrieval-failed');
        const fixture = await fetch(
          `http://127.0.0.1:${address.port}${controlledFeedPath}?date=${localDate}&now=${now}`
        );
        if (!fixture.ok || !fixture.headers.get('content-type')?.startsWith('text/calendar')) {
          throw new CalendarReaderError('feed-retrieval-failed');
        }
        raw = await fixture.text();
      } else {
        raw = await readICloudFeed(source.url);
      }

      const feedBytes = Buffer.byteLength(raw, 'utf8');
      if (feedBytes > maximumFeedBytes) {
        throw new CalendarReaderError('feed-too-large', {
          feedBytes,
          limitBytes: maximumFeedBytes
        });
      }
      const parsed = parseCalendarFeedForRange(raw, {
        id: source.id,
        name: source.name
      }, rangeStart, rangeEnd, timeZone);
      if (!parsed.valid) {
        failureResponse(response, 422, 'feed-parse-failed');
        return;
      }
      sendJson(response, 200, { events: parsed.events, issueCount: parsed.issues.length });
    } catch (error) {
      const tooLarge = error instanceof Error && error.message === 'request-too-large';
      if (tooLarge) {
        sendJson(response, 413, { code: 'invalid-request', error: 'Calendar request is too large.' });
        return;
      }
      const code = error instanceof CalendarReaderError
        ? error.code
        : 'feed-retrieval-failed';
      const invalid = code === 'invalid-request';
      const urlRejected = code === 'url-not-allowed'
        || code === 'redirect-not-allowed'
        || code === 'url-target-not-public';
      failureResponse(response, invalid ? 400 : urlRejected ? 422 : 502, code, error instanceof CalendarReaderError ? error.metadata : {});
    }
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.TEND_CALENDAR_READER_PORT ?? 8787);
  const server = createLocalCalendarReaderServer();
  server.listen(port, '127.0.0.1', () => {
    const address = server.address();
    if (typeof address === 'object' && address) {
      process.stdout.write(`Local calendar reader ready at http://127.0.0.1:${address.port}\n`);
    }
  });
}
