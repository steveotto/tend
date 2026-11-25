import {
  calendarFeedUrlError,
  validateCalendarSources
} from './calendar-sources.ts';
import {
  parseCalendarFeedForRange,
  type CalendarExpansionLimitDiagnostic
} from './calendar-events.ts';

const maximumRequestBytes = 16_384;
const maximumFeedBytes = 5 * 1_048_576;
const maximumRangeMs = 32 * 86_400_000;
const maximumRedirects = 3;
const maximumRetryAfterMs = 1_000;
const feedReadProgressBytes = 1_048_576;
const feedReadProgressChunks = 16;
const maximumFeedReadProgressEvents = 16;
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
  | 'feed-parse-failed'
  | 'feed-expansion-limit';

type FailureMetadata = {
  upstreamStatus?: number;
  feedBytes?: number;
  limitBytes?: number;
};

export type CalendarReaderStage =
  | 'request_validation'
  | 'request_body'
  | 'upstream_request'
  | 'upstream_fetch'
  | 'feed_body_read'
  | 'feed_decode'
  | 'feed_parse'
  | 'response_serialization';

type CalendarReaderSubstage =
  | 'feed_url_prepare'
  | 'upstream_request_prepare'
  | 'upstream_request'
  | 'upstream_response_headers'
  | 'feed_body_read'
  | 'feed_buffer_copy'
  | 'feed_decode';

type SafeContentEncoding = 'none' | 'gzip' | 'br' | 'deflate' | 'other';

type CalendarReaderSubstageDetails = {
  elapsedMs?: number;
  status?: number;
  declaredBytes?: number;
  feedBytes?: number;
  chunkCount?: number;
  contentEncoding?: SafeContentEncoding;
  calendarContentType?: boolean;
  hasLocationHeader?: boolean;
};

type CalendarReaderSubstageOutcome = 'started' | 'progress' | 'completed';

function safeContentEncoding(headers: Headers): SafeContentEncoding {
  const value = headers.get('content-encoding');
  if (!value) return 'none';
  const normalized = value.trim().toLowerCase();
  return normalized === 'gzip' || normalized === 'br' || normalized === 'deflate'
    ? normalized
    : 'other';
}

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
  metadata: FailureMetadata = {},
  respond: typeof jsonResponse = jsonResponse
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
    'feed-parse-failed': 'The feed could not be parsed as a calendar.',
    'feed-expansion-limit': 'The calendar feed contains too many events to process safely for this date range.'
  };
  return respond(status, {
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

function jsonResponse(
  status: number,
  value: unknown,
  additionalHeaders: HeadersInit = {},
  onSerialize?: () => void
): Response {
  onSerialize?.();
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

function upstreamRetryDelayMs(response: Response): number | null {
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter === null) return 200 + Math.floor(Math.random() * 200);

  const seconds = Number(retryAfter);
  const requestedDelay = Number.isFinite(seconds)
    ? seconds * 1_000
    : Date.parse(retryAfter) - Date.now();
  return Number.isFinite(requestedDelay)
    && requestedDelay >= 0
    && requestedDelay <= maximumRetryAfterMs
    ? requestedDelay
    : null;
}

function waitForRetry(signal: AbortSignal, delayMs: number): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise(resolve => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const finish = () => {
      clearTimeout(timeoutId);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    timeoutId = setTimeout(finish, delayMs);
    signal.addEventListener('abort', finish, { once: true });
  });
}

async function readFeed(
  rawUrl: string,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
  onException?: (stage: CalendarReaderStage, error: unknown) => void,
  onSubstage?: (
    substage: CalendarReaderSubstage,
    outcome: CalendarReaderSubstageOutcome,
    details?: CalendarReaderSubstageDetails
  ) => void
): Promise<string> {
  const urlPrepareStartedAt = performance.now();
  onSubstage?.('feed_url_prepare', 'started');
  let url = parseFeedUrl(rawUrl);
  onSubstage?.('feed_url_prepare', 'completed', {
    elapsedMs: Math.max(0, Math.round(performance.now() - urlPrepareStartedAt))
  });
  let transientRetryUsed = false;
  for (let redirect = 0; redirect <= maximumRedirects; redirect += 1) {
    let response: Response | null = null;
    let declaredLength: number | null = null;
    let calendarContentType = false;
    while (true) {
      const requestPrepareStartedAt = performance.now();
      onSubstage?.('upstream_request_prepare', 'started');
      const requestOptions: RequestInit = {
        method: 'GET',
        headers: { accept: 'text/calendar' },
        redirect: 'manual',
        cache: 'no-store',
        signal
      };
      onSubstage?.('upstream_request_prepare', 'completed', {
        elapsedMs: Math.max(0, Math.round(performance.now() - requestPrepareStartedAt))
      });
      const requestStartedAt = performance.now();
      onSubstage?.('upstream_request', 'started');
      try {
        response = await fetchImpl(url, requestOptions);
      } catch (error) {
        onException?.('upstream_request', error);
        if (signal.aborted || (error instanceof Error && error.name === 'TimeoutError')) {
          throw new CalendarReaderError('upstream-timeout');
        }
        throw new CalendarReaderError('upstream-network-failed');
      }
      onSubstage?.('upstream_request', 'completed', {
        elapsedMs: Math.max(0, Math.round(performance.now() - requestStartedAt)),
        status: response.status
      });

      const responseHeadersStartedAt = performance.now();
      onSubstage?.('upstream_response_headers', 'started');
      const responseStatus = response.status;
      const contentLengthHeader = response.headers.get('content-length');
      declaredLength = contentLengthHeader === null ? null : Number(contentLengthHeader);
      const contentType = response.headers.get('content-type');
      calendarContentType = contentType?.split(';', 1)[0]?.trim().toLowerCase() === 'text/calendar';
      onSubstage?.('upstream_response_headers', 'completed', {
        elapsedMs: Math.max(0, Math.round(performance.now() - responseHeadersStartedAt)),
        status: responseStatus,
        ...(declaredLength !== null && Number.isSafeInteger(declaredLength) && declaredLength >= 0
          ? { declaredBytes: declaredLength }
          : {}),
        contentEncoding: safeContentEncoding(response.headers),
        calendarContentType,
        hasLocationHeader: response.headers.has('location')
      });

      const retryableStatus = responseStatus === 500
        || responseStatus === 502
        || responseStatus === 503
        || responseStatus === 504;
      if (!retryableStatus || transientRetryUsed) break;

      const delayMs = upstreamRetryDelayMs(response);
      if (delayMs === null) break;
      transientRetryUsed = true;
      await response.body?.cancel();
      await waitForRetry(signal, delayMs);
      if (signal.aborted) throw new CalendarReaderError('upstream-timeout');
    }
    if (!response) throw new CalendarReaderError('feed-retrieval-failed');

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
    if (!calendarContentType) {
      await response.body?.cancel();
      throw new CalendarReaderError('feed-type-rejected');
    }

    if (declaredLength !== null && Number.isFinite(declaredLength) && declaredLength > maximumFeedBytes) {
      await response.body?.cancel();
      throw new CalendarReaderError('feed-too-large', {
        ...(Number.isSafeInteger(declaredLength) ? { feedBytes: declaredLength } : {}),
        limitBytes: maximumFeedBytes
      });
    }

    const bodyReadStartedAt = performance.now();
    onSubstage?.('feed_body_read', 'started');
    const reader = response.body?.getReader();
    if (!reader) {
      onSubstage?.('feed_body_read', 'completed', {
        elapsedMs: Math.max(0, Math.round(performance.now() - bodyReadStartedAt)),
        feedBytes: 0,
        chunkCount: 0
      });
      onSubstage?.('feed_buffer_copy', 'started');
      onSubstage?.('feed_buffer_copy', 'completed', {
        elapsedMs: 0,
        feedBytes: 0,
        chunkCount: 0
      });
      onSubstage?.('feed_decode', 'started');
      onSubstage?.('feed_decode', 'completed', { elapsedMs: 0, feedBytes: 0 });
      return '';
    }
    const chunks: Uint8Array[] = [];
    let size = 0;
    let chunkCount = 0;
    let progressEventCount = 0;
    let nextProgressBytes = feedReadProgressBytes;
    let nextProgressChunks = feedReadProgressChunks;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunkCount += 1;
        size += value.byteLength;
        if (progressEventCount < maximumFeedReadProgressEvents
          && (size >= nextProgressBytes || chunkCount >= nextProgressChunks)) {
          onSubstage?.('feed_body_read', 'progress', {
            elapsedMs: Math.max(0, Math.round(performance.now() - bodyReadStartedAt)),
            feedBytes: size,
            chunkCount
          });
          progressEventCount += 1;
          nextProgressBytes = size + feedReadProgressBytes;
          nextProgressChunks = Math.max(
            chunkCount + feedReadProgressChunks,
            chunkCount * 2
          );
        }
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
      onException?.('feed_body_read', error);
      if (signal.aborted || (error instanceof Error && error.name === 'TimeoutError')) {
        throw new CalendarReaderError('upstream-timeout');
      }
      throw new CalendarReaderError('upstream-network-failed');
    } finally {
      reader.releaseLock();
    }

    onSubstage?.('feed_body_read', 'completed', {
      elapsedMs: Math.max(0, Math.round(performance.now() - bodyReadStartedAt)),
      feedBytes: size,
      chunkCount
    });
    onSubstage?.('feed_buffer_copy', 'started');
    const copyStartedAt = performance.now();
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    onSubstage?.('feed_buffer_copy', 'completed', {
      elapsedMs: Math.max(0, Math.round(performance.now() - copyStartedAt)),
      feedBytes: size,
      chunkCount
    });
    onSubstage?.('feed_decode', 'started');
    const decodeStartedAt = performance.now();
    try {
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(body);
      onSubstage?.('feed_decode', 'completed', {
        elapsedMs: Math.max(0, Math.round(performance.now() - decodeStartedAt)),
        feedBytes: size
      });
      return decoded;
    } catch (error) {
      onException?.('feed_decode', error);
      throw new CalendarReaderError('feed-parse-failed');
    }
  }
  throw new CalendarReaderError('feed-retrieval-failed');
}

export async function handleCalendarRead(
  request: Request,
  options: {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    onStage?: (stage: CalendarReaderStage) => void;
    onException?: (stage: CalendarReaderStage, error: unknown) => void;
    onSubstage?: (
      substage: CalendarReaderSubstage,
      outcome: CalendarReaderSubstageOutcome,
      details?: CalendarReaderSubstageDetails
    ) => void;
    onDiagnostic?: (diagnostic: CalendarExpansionLimitDiagnostic) => void;
  } = {}
): Promise<Response> {
  let stage: CalendarReaderStage = 'request_validation';
  options.onStage?.(stage);
  const respond = (
    status: number,
    value: unknown,
    additionalHeaders: HeadersInit = {}
  ) => jsonResponse(status, value, additionalHeaders, () => {
    stage = 'response_serialization';
    options.onStage?.(stage);
  });
  const fail = (
    status: number,
    code: CalendarFailureCode,
    metadata: FailureMetadata = {}
  ) => failureResponse(status, code, metadata, respond);

  if (request.method !== 'POST') {
    return respond(405, { error: 'Method not allowed.' }, { allow: 'POST' });
  }

  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');
  if (!origin) {
    return respond(403, { code: 'invalid-request', error: 'Calendar request origin is not allowed.' });
  }
  try {
    if (new URL(origin).origin !== requestUrl.origin) {
      return respond(403, { code: 'invalid-request', error: 'Calendar request origin is not allowed.' });
    }
  } catch {
    return respond(403, { code: 'invalid-request', error: 'Calendar request origin is not allowed.' });
  }

  const declaredRequestSize = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredRequestSize) && declaredRequestSize > maximumRequestBytes) {
    return fail(413, 'invalid-request', { limitBytes: maximumRequestBytes });
  }
  if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
    return fail(400, 'invalid-request');
  }

  let input: unknown;
  try {
    stage = 'request_body';
    options.onStage?.(stage);
    input = JSON.parse(await readRequestBody(request));
  } catch (error) {
    const tooLarge = error instanceof CalendarReaderError && error.metadata.limitBytes === maximumRequestBytes;
    if (!(error instanceof SyntaxError) && !(error instanceof CalendarReaderError)) {
      options.onException?.(stage, error);
    }
    return fail(tooLarge ? 413 : 400, 'invalid-request', tooLarge
      ? { limitBytes: maximumRequestBytes }
      : {});
  }
  if (!validRequestInput(input)) {
    const source = isRecord(input) && isRecord(input.source) ? input.source : null;
    const rejectedUrl = source && typeof source.url === 'string'
      ? calendarFeedUrlError(source.url) !== null
      : false;
    return fail(rejectedUrl ? 422 : 400, rejectedUrl ? 'url-not-allowed' : 'invalid-request');
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: input.timeZone }).format();
  } catch {
    return fail(400, 'invalid-request');
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? requestTimeoutMs
  );
  try {
    stage = 'upstream_fetch';
    options.onStage?.(stage);
    const raw = await readFeed(
      input.source.url,
      options.fetchImpl ?? fetch,
      controller.signal,
      options.onException,
      options.onSubstage
    );
    stage = 'feed_parse';
    options.onStage?.(stage);
    const parsed = parseCalendarFeedForRange(
      raw,
      { id: input.source.id, name: input.source.name },
      input.rangeStart,
      input.rangeEnd,
      input.timeZone
    );
    if (!parsed.valid) {
      if (parsed.expansionLimit) options.onDiagnostic?.(parsed.expansionLimit);
      const code = parsed.issues.some(issue => issue.kind === 'expansion-limit')
        ? 'feed-expansion-limit'
        : 'feed-parse-failed';
      return fail(422, code);
    }
    return respond(200, { events: parsed.events, issueCount: parsed.issues.length });
  } catch (error) {
    if (!(error instanceof CalendarReaderError)) options.onException?.(stage, error);
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
    return fail(status, readerError.code, readerError.metadata);
  } finally {
    clearTimeout(timeout);
  }
}
