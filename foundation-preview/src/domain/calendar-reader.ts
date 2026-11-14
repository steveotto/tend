import {
  calendarFeedUrlError,
  validateCalendarSources
} from './calendar-sources.ts';
import { parseCalendarFeedForRange } from './calendar-events.ts';

const maximumRequestBytes = 16_384;
const maximumFeedBytes = 5 * 1_048_576;
const maximumRangeMs = 32 * 86_400_000;
const maximumRedirects = 3;
const requestTimeoutMs = 10_000;

type CalendarFailureCode =
  | 'invalid-request'
  | 'url-not-allowed'
  | 'redirect-not-allowed'
  | 'url-target-not-public'
  | 'dns-resolution-failed'
  | 'upstream-timeout'
  | 'upstream-tls-failed'
  | 'upstream-network-failed'
  | 'feed-http-rejected'
  | 'feed-type-rejected'
  | 'feed-too-large'
  | 'redirect-limit'
  | 'feed-retrieval-failed'
  | 'feed-parse-failed';

type FailureMetadata = {
  upstreamStatus?: number;
  feedBytes?: number;
  limitBytes?: number;
};

class CalendarReaderError extends Error {
  constructor(
    readonly code: CalendarFailureCode,
    readonly metadata: FailureMetadata = {}
  ) {
    super(code);
  }
}

function failureResponse(
  status: number,
  code: CalendarFailureCode,
  metadata: FailureMetadata = {}
): Response {
  const messages: Record<CalendarFailureCode, string> = {
    'invalid-request': 'Calendar request is invalid.',
    'url-not-allowed': 'The saved link is not an allowed public iCloud feed URL.',
    'redirect-not-allowed': 'The feed redirected outside the allowed public iCloud host policy.',
    'url-target-not-public': 'The feed host resolved to a non-public network address and was blocked.',
    'dns-resolution-failed': 'The allowed feed host could not be resolved.',
    'upstream-timeout': 'The calendar server did not respond before the reader timed out.',
    'upstream-tls-failed': 'A secure connection to the calendar server could not be established.',
    'upstream-network-failed': 'The calendar server could not be reached.',
    'feed-http-rejected': 'The calendar server returned an unsuccessful HTTP response.',
    'feed-type-rejected': 'The calendar server response was not identified as a calendar feed.',
    'feed-too-large': 'The calendar feed exceeded the reader size limit.',
    'redirect-limit': 'The feed exceeded the redirect limit.',
    'feed-retrieval-failed': 'The calendar feed could not be retrieved.',
    'feed-parse-failed': 'The feed could not be parsed as a calendar.'
  };
  return jsonResponse(status, {
    code,
    error: messages[code],
    ...(Number.isInteger(metadata.upstreamStatus) ? { upstreamStatus: metadata.upstreamStatus } : {}),
    ...(Number.isSafeInteger(metadata.feedBytes) && (metadata.feedBytes ?? -1) >= 0
      ? { feedBytes: metadata.feedBytes }
      : {}),
    ...(Number.isSafeInteger(metadata.limitBytes) && (metadata.limitBytes ?? 0) > 0
      ? { limitBytes: metadata.limitBytes }
      : {})
  });
}

function jsonResponse(status: number, value: unknown, additionalHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...additionalHeaders
    }
  });
}

function validInstant(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && Number.isFinite(new Date(value).getTime());
}

function parseFeedUrl(raw: string, redirect = false): URL {
  const normalized = !redirect && /^webcal:/i.test(raw)
    ? raw.replace(/^webcal:/i, 'https:')
    : raw;
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new CalendarReaderError(redirect ? 'redirect-not-allowed' : 'url-not-allowed');
  }
  if (calendarFeedUrlError(normalized)
    || url.protocol !== 'https:'
    || (redirect && /^webcal:/i.test(raw))) {
    throw new CalendarReaderError(redirect ? 'redirect-not-allowed' : 'url-not-allowed');
  }
  return url;
}

async function readRequestBody(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumRequestBytes) {
        await reader.cancel();
        throw new CalendarReaderError('invalid-request', { limitBytes: maximumRequestBytes });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validRequestInput(value: unknown): value is {
  source: { id: string; name: string; url: string };
  now: number;
  rangeStart: number;
  rangeEnd: number;
  timeZone: string;
} {
  if (!isRecord(value)
    || Object.keys(value).some(key => !['source', 'now', 'rangeStart', 'rangeEnd', 'timeZone'].includes(key))
    || !isRecord(value.source)
    || !validInstant(value.now)
    || !validInstant(value.rangeStart)
    || !validInstant(value.rangeEnd)
    || value.rangeEnd <= value.rangeStart
    || value.rangeEnd - value.rangeStart > maximumRangeMs
    || typeof value.timeZone !== 'string'
    || value.timeZone.length === 0
    || value.timeZone.length > 100) {
    return false;
  }

  const source = value.source;
  if (source.kind === 'controlled-test' || source.enabled === false) return false;
  const validation = validateCalendarSources([source]);
  return validation.valid;
}

async function readFeed(
  rawUrl: string,
  fetchImpl: typeof fetch,
  signal: AbortSignal
): Promise<string> {
  let url = parseFeedUrl(rawUrl);
  for (let redirect = 0; redirect <= maximumRedirects; redirect += 1) {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: 'GET',
        headers: { accept: 'text/calendar' },
        redirect: 'manual',
        cache: 'no-store',
        signal
      });
    } catch (error) {
      if (signal.aborted || (error instanceof Error && error.name === 'TimeoutError')) {
        throw new CalendarReaderError('upstream-timeout');
      }
      throw new CalendarReaderError('upstream-network-failed');
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) throw new CalendarReaderError('feed-retrieval-failed');
      if (redirect === maximumRedirects) throw new CalendarReaderError('redirect-limit');
      try {
        url = parseFeedUrl(new URL(location, url).href, true);
      } catch (error) {
        if (error instanceof CalendarReaderError) throw error;
        throw new CalendarReaderError('redirect-not-allowed');
      }
      continue;
    }

    if (response.status !== 200) {
      await response.body?.cancel();
      throw new CalendarReaderError('feed-http-rejected', { upstreamStatus: response.status });
    }
    if (response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'text/calendar') {
      await response.body?.cancel();
      throw new CalendarReaderError('feed-type-rejected');
    }

    const declaredSize = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredSize) && declaredSize > maximumFeedBytes) {
      await response.body?.cancel();
      throw new CalendarReaderError('feed-too-large', {
        ...(Number.isSafeInteger(declaredSize) ? { feedBytes: declaredSize } : {}),
        limitBytes: maximumFeedBytes
      });
    }

    const reader = response.body?.getReader();
    if (!reader) return '';
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maximumFeedBytes) {
          await reader.cancel();
          throw new CalendarReaderError('feed-too-large', {
            feedBytes: size,
            limitBytes: maximumFeedBytes
          });
        }
        chunks.push(value);
      }
    } catch (error) {
      if (error instanceof CalendarReaderError) throw error;
      if (signal.aborted || (error instanceof Error && error.name === 'TimeoutError')) {
        throw new CalendarReaderError('upstream-timeout');
      }
      throw new CalendarReaderError('upstream-network-failed');
    } finally {
      reader.releaseLock();
    }

    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(body);
    } catch {
      throw new CalendarReaderError('feed-parse-failed');
    }
  }
  throw new CalendarReaderError('feed-retrieval-failed');
}

export async function handleCalendarRead(
  request: Request,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}
): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' }, { allow: 'POST' });
  }

  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');
  if (!origin) {
    return jsonResponse(403, { code: 'invalid-request', error: 'Calendar request origin is not allowed.' });
  }
  try {
    if (new URL(origin).origin !== requestUrl.origin) {
      return jsonResponse(403, { code: 'invalid-request', error: 'Calendar request origin is not allowed.' });
    }
  } catch {
    return jsonResponse(403, { code: 'invalid-request', error: 'Calendar request origin is not allowed.' });
  }

  const declaredRequestSize = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredRequestSize) && declaredRequestSize > maximumRequestBytes) {
    return failureResponse(413, 'invalid-request', { limitBytes: maximumRequestBytes });
  }
  if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
    return failureResponse(400, 'invalid-request');
  }

  let input: unknown;
  try {
    input = JSON.parse(await readRequestBody(request));
  } catch (error) {
    const tooLarge = error instanceof CalendarReaderError && error.metadata.limitBytes === maximumRequestBytes;
    return failureResponse(tooLarge ? 413 : 400, 'invalid-request', tooLarge
      ? { limitBytes: maximumRequestBytes }
      : {});
  }
  if (!validRequestInput(input)) {
    const source = isRecord(input) && isRecord(input.source) ? input.source : null;
    const rejectedUrl = source && typeof source.url === 'string'
      ? calendarFeedUrlError(source.url) !== null
      : false;
    return failureResponse(rejectedUrl ? 422 : 400, rejectedUrl ? 'url-not-allowed' : 'invalid-request');
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: input.timeZone }).format();
  } catch {
    return failureResponse(400, 'invalid-request');
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? requestTimeoutMs
  );
  try {
    const raw = await readFeed(input.source.url, options.fetchImpl ?? fetch, controller.signal);
    const parsed = parseCalendarFeedForRange(
      raw,
      { id: input.source.id, name: input.source.name },
      input.rangeStart,
      input.rangeEnd,
      input.timeZone
    );
    if (!parsed.valid) return failureResponse(422, 'feed-parse-failed');
    return jsonResponse(200, { events: parsed.events, issueCount: parsed.issues.length });
  } catch (error) {
    const readerError = error instanceof CalendarReaderError
      ? error
      : controller.signal.aborted
        ? new CalendarReaderError('upstream-timeout')
        : new CalendarReaderError('feed-retrieval-failed');
    const status = readerError.code === 'url-not-allowed'
      || readerError.code === 'redirect-not-allowed'
      || readerError.code === 'url-target-not-public'
      ? 422
      : 502;
    return failureResponse(status, readerError.code, readerError.metadata);
  } finally {
    clearTimeout(timeout);
  }
}
