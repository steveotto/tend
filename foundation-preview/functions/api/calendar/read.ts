import { handleCalendarRead } from '../../../src/domain/calendar-reader.ts';

const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeExceptionType(error: unknown): string {
  const type = error instanceof Error ? error.constructor.name : typeof error;
  return /^[A-Za-z][A-Za-z0-9]{0,39}$/.test(type) ? type : 'UnknownError';
}

function errorResponse(requestId: string): Response {
  return new Response(JSON.stringify({
    code: 'reader-internal-error',
    error: 'The Calendar reader encountered an internal error.'
  }), {
    status: 500,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-tend-calendar-request-id': requestId
    }
  });
}

export async function onRequest(context: { request: Request }): Promise<Response> {
  const providedRequestId = context.request.headers.get('x-tend-calendar-request-id');
  const requestId = providedRequestId && requestIdPattern.test(providedRequestId)
    ? providedRequestId
    : globalThis.crypto.randomUUID();
  const requestStartedAt = performance.now();
  let stage: string | null = null;
  let stageStartedAt = requestStartedAt;
  const log = (entry: Record<string, unknown>) => {
    console.log(JSON.stringify({
      event: 'calendar_reader',
      requestId,
      ...entry
    }));
  };
  const finishStage = (outcome: 'completed' | 'failed') => {
    if (!stage) return;
    log({
      stage,
      outcome,
      elapsedMs: Math.max(0, Math.round(performance.now() - stageStartedAt))
    });
  };

  try {
    const response = await handleCalendarRead(context.request, {
      onStage: nextStage => {
        if (stage) finishStage('completed');
        stage = nextStage;
        stageStartedAt = performance.now();
        log({ stage, outcome: 'started' });
      },
      onException: (failedStage, error) => {
        log({
          stage: failedStage,
          outcome: 'exception',
          exceptionType: safeExceptionType(error),
          elapsedMs: Math.max(0, Math.round(performance.now() - stageStartedAt))
        });
        if (!stage) {
          stage = 'request_complete';
          stageStartedAt = performance.now();
        }
      }
    });
    finishStage('completed');
    const headers = new Headers(response.headers);
    headers.set('x-tend-calendar-request-id', requestId);
    log({
      stage: 'request_complete',
      outcome: response.ok ? 'ok' : 'http_failure',
      status: response.status,
      elapsedMs: Math.max(0, Math.round(performance.now() - requestStartedAt))
    });
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  } catch (error) {
    log({
      stage,
      outcome: 'runtime_exception',
      exceptionType: safeExceptionType(error),
      elapsedMs: Math.max(0, Math.round(performance.now() - stageStartedAt))
    });
    log({
      stage: 'request_complete',
      outcome: 'runtime_exception',
      status: 500,
      elapsedMs: Math.max(0, Math.round(performance.now() - requestStartedAt))
    });
    return errorResponse(requestId);
  }
}
