import { useEffect, useMemo, useState } from 'react';
import {
  formatCalendarRangeLabel,
  getCalendarRangeWindow,
  selectCalendarEventsForRange
} from '../domain/calendar-events.ts';
import type { CalendarEvent, CalendarRange } from '../domain/calendar-events.ts';
import type { CalendarSource } from '../domain/calendar-sources.ts';
import {
  CalendarOutlineIcon,
  CalendarMonthIcon,
  CalendarTodayIcon,
  CalendarWeekIcon
} from './CalendarRangeIcons.tsx';
import { CalendarEventRow } from './CalendarEventRow.tsx';

type CalendarReaderState = {
  kind: 'idle' | 'loading' | 'ready' | 'error';
  events: CalendarEvent[];
  failures: Array<{
    sourceName: string;
    code: CalendarReadFailureCode;
    upstreamStatus?: number;
    feedBytes?: number;
    limitBytes?: number;
  }>;
  issueCount: number;
};

type CalendarReadFailureCode =
  | 'reader-unavailable'
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

class CalendarReadError extends Error {
  constructor(
    readonly code: CalendarReadFailureCode,
    readonly upstreamStatus?: number,
    readonly feedBytes?: number,
    readonly limitBytes?: number
  ) {
    super(code);
  }
}

function isCalendarReadFailureCode(value: unknown): value is CalendarReadFailureCode {
  return value === 'reader-unavailable'
    || value === 'invalid-request'
    || value === 'url-not-allowed'
    || value === 'redirect-not-allowed'
    || value === 'url-target-not-public'
    || value === 'dns-resolution-failed'
    || value === 'upstream-timeout'
    || value === 'upstream-tls-failed'
    || value === 'upstream-network-failed'
    || value === 'feed-http-rejected'
    || value === 'feed-type-rejected'
    || value === 'feed-too-large'
    || value === 'redirect-limit'
    || value === 'feed-retrieval-failed'
    || value === 'feed-parse-failed';
}

function failureDescription(code: CalendarReadFailureCode): string {
  switch (code) {
    case 'reader-unavailable':
      return 'The local calendar reader could not be reached.';
    case 'invalid-request':
      return 'The calendar request was rejected as invalid.';
    case 'url-not-allowed':
      return 'The saved link is not an allowed public iCloud feed URL.';
    case 'redirect-not-allowed':
      return 'The feed redirected outside the allowed public iCloud host policy.';
    case 'url-target-not-public':
      return 'The feed host resolved to a non-public network address and was blocked.';
    case 'dns-resolution-failed':
      return 'The allowed feed host could not be resolved on this network.';
    case 'upstream-timeout':
      return 'The calendar server did not respond before the local reader timed out.';
    case 'upstream-tls-failed':
      return 'A secure connection to the calendar server could not be established.';
    case 'upstream-network-failed':
      return 'The calendar server could not be reached from this network.';
    case 'feed-http-rejected':
      return 'The calendar server returned an unsuccessful HTTP response.';
    case 'feed-type-rejected':
      return 'The calendar server response was not identified as a calendar feed.';
    case 'feed-too-large':
      return 'The calendar feed exceeded the local reader size limit.';
    case 'redirect-limit':
      return 'The feed exceeded the local redirect limit.';
    case 'feed-retrieval-failed':
      return 'The reader was reached, but the calendar feed could not be retrieved.';
    case 'feed-parse-failed':
      return 'The feed was retrieved, but its calendar data could not be parsed.';
  }
}

function isCalendarEvent(value: unknown): value is CalendarEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Record<string, unknown>;
  return typeof event.id === 'string'
    && typeof event.sourceId === 'string'
    && typeof event.sourceName === 'string'
    && typeof event.title === 'string'
    && typeof event.startsAt === 'number'
    && Number.isFinite(event.startsAt)
    && typeof event.endsAt === 'number'
    && Number.isFinite(event.endsAt)
    && typeof event.allDay === 'boolean';
}

async function loadSource(
  source: CalendarSource,
  now: number,
  range: { start: number; end: number },
  timeZone: string,
  signal: AbortSignal
): Promise<{ events: CalendarEvent[]; issueCount: number }> {
  let response: Response;
  try {
    response = await fetch('/api/calendar/read', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        source,
        now,
        rangeStart: range.start,
        rangeEnd: range.end,
        timeZone
      }),
      signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new CalendarReadError('reader-unavailable');
  }
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new CalendarReadError('reader-unavailable');
  }
  if (!response.ok) {
    const code = result && typeof result === 'object' && 'code' in result && isCalendarReadFailureCode(result.code)
      ? result.code
      : 'feed-retrieval-failed';
    const upstreamStatus = result && typeof result === 'object' && 'upstreamStatus' in result
      && typeof result.upstreamStatus === 'number'
      && Number.isInteger(result.upstreamStatus)
      && result.upstreamStatus >= 100
      && result.upstreamStatus <= 599
      ? result.upstreamStatus
      : undefined;
    const feedBytes = result && typeof result === 'object' && 'feedBytes' in result
      && typeof result.feedBytes === 'number'
      && Number.isSafeInteger(result.feedBytes)
      && result.feedBytes >= 0
      ? result.feedBytes
      : undefined;
    const limitBytes = result && typeof result === 'object' && 'limitBytes' in result
      && typeof result.limitBytes === 'number'
      && Number.isSafeInteger(result.limitBytes)
      && result.limitBytes > 0
      ? result.limitBytes
      : undefined;
    throw new CalendarReadError(code, upstreamStatus, feedBytes, limitBytes);
  }
  if (!response.ok
    || !result
    || typeof result !== 'object'
    || !('events' in result)
    || !Array.isArray(result.events)
    || !result.events.every(isCalendarEvent)
    || !('issueCount' in result)
    || typeof result.issueCount !== 'number'
    || !Number.isSafeInteger(result.issueCount)
    || result.issueCount < 0) {
    throw new CalendarReadError('reader-unavailable');
  }
  return { events: result.events, issueCount: result.issueCount };
}

export function CalendarAgendaSection({
  sources,
  timeZone,
  readerEnabled
}: {
  sources: readonly CalendarSource[];
  timeZone: string;
  readerEnabled: boolean;
}) {
  const [retryCount, setRetryCount] = useState(0);
  const [selectedRange, setSelectedRange] = useState<CalendarRange>('today');
  const [state, setState] = useState<CalendarReaderState>({
    kind: 'idle',
    events: [],
    failures: [],
    issueCount: 0
  });
  const enabledSources = useMemo(
    () => sources.filter(source => source.enabled !== false),
    [sources]
  );

  useEffect(() => {
    if (!readerEnabled || enabledSources.length === 0) {
      setState({ kind: 'ready', events: [], failures: [], issueCount: 0 });
      return;
    }

    const controller = new AbortController();
    const now = Date.now();
    const coverage = getCalendarRangeWindow('month', now, timeZone);
    setState(previous => ({
      ...previous,
      kind: 'loading',
      failures: [],
      issueCount: 0
    }));
    void Promise.all(enabledSources.map(async source => {
      try {
        return {
          source,
          result: await loadSource(source, now, coverage, timeZone, controller.signal),
          error: null
        };
      } catch (error) {
        return {
          source,
          result: null,
          error: error instanceof CalendarReadError
            ? {
              code: error.code,
              upstreamStatus: error.upstreamStatus,
              feedBytes: error.feedBytes,
              limitBytes: error.limitBytes
            }
            : { code: 'reader-unavailable' as const }
        };
      }
    })).then(results => {
      if (controller.signal.aborted) return;
      const failures = results
        .filter(result => result.result === null)
        .map(result => ({
          sourceName: result.source.name,
          code: result.error?.code ?? 'reader-unavailable',
          ...(result.error?.upstreamStatus ? { upstreamStatus: result.error.upstreamStatus } : {}),
          ...(result.error?.feedBytes !== undefined ? { feedBytes: result.error.feedBytes } : {}),
          ...(result.error?.limitBytes !== undefined ? { limitBytes: result.error.limitBytes } : {})
        }));
      const events = results.flatMap(result => result.result?.events ?? [])
        .sort((left, right) => left.startsAt - right.startsAt);
      const issueCount = results.reduce((count, result) => count + (result.result?.issueCount ?? 0), 0);
      setState({
        kind: events.length > 0 || failures.length === 0 ? 'ready' : 'error',
        events,
        failures,
        issueCount
      });
    });

    return () => controller.abort();
  }, [enabledSources, readerEnabled, retryCount, timeZone]);

  const hasConfiguredSources = sources.length > 0;
  const hasEnabledSources = enabledSources.length > 0;
  const busy = readerEnabled && hasEnabledSources && (state.kind === 'idle' || state.kind === 'loading');
  const now = Date.now();
  const selectedWindow = getCalendarRangeWindow(selectedRange, now, timeZone);
  const visibleEvents = useMemo(
    () => selectCalendarEventsForRange(state.events, selectedWindow),
    [selectedWindow.start, selectedWindow.end, state.events]
  );
  const rangeLabel = formatCalendarRangeLabel(selectedRange, selectedWindow, timeZone);
  const emptyLabel = selectedRange === 'today'
    ? 'No events today.'
    : selectedRange === 'week'
      ? 'No events in the next 7 days.'
      : 'No events in the next month.';
  const showRangeControl = hasConfiguredSources && hasEnabledSources;
  const statusContent = !hasConfiguredSources
    ? {
      title: 'Connect a calendar',
      description: 'More → Settings → Calendar.'
    }
    : !hasEnabledSources
      ? {
        title: 'Enable a calendar',
        description: 'More → Settings → Calendar.'
      }
      : !readerEnabled
        ? {
          title: 'Calendar reading is unavailable',
          description: 'Calendar reading is available only in the isolated local preview.'
        }
        : busy
          ? {
            title: 'Loading events…',
            description: ''
          }
          : state.kind === 'error'
            ? {
              title: 'Calendar events could not be loaded.',
              description: failureDescription(state.failures[0]?.code ?? 'reader-unavailable')
            }
            : visibleEvents.length === 0
              ? {
                title: emptyLabel,
                description: ''
              }
              : null;

  return (
    <section className="today-calendar-section" aria-labelledby="calendar-heading">
      <div className="sectiontitle calendar-section-title">
        <div className="calendar-heading-row">
          <h2 id="calendar-heading">On your calendar</h2>
          {showRangeControl && (
            <div className="calendar-range-control" role="group" aria-label="Calendar date range">
              {([
                ['today', 'Today'],
                ['week', 'Week'],
                ['month', 'Month']
              ] as const).map(([range, label]) => (
                <button
                  type="button"
                  className="calendar-range-control__button"
                  aria-label={label}
                  aria-pressed={selectedRange === range}
                  title={label}
                  key={range}
                  onClick={() => setSelectedRange(range)}
                >
                  {range === 'today'
                    ? <CalendarTodayIcon />
                    : range === 'week'
                      ? <CalendarWeekIcon />
                      : <CalendarMonthIcon />}
                </button>
              ))}
            </div>
          )}
        </div>
        {showRangeControl && <p className="calendar-range-label" aria-live="polite">{rangeLabel}</p>}
      </div>
      <div className="calendar-agenda-content" aria-busy={busy}>
        {statusContent && !(busy && visibleEvents.length > 0) ? (
          <div
            className={`calendar-event calendar-event--status${busy ? ' calendar-event--loading' : ''}`}
            role="status"
            aria-live="polite"
          >
            <span className="calendar-event__date-tile calendar-event__date-tile--status" aria-hidden="true">
              <CalendarOutlineIcon />
            </span>
            <span className="calendar-event__details">
              {busy
                ? <span className="calendar-event__loading-label">{statusContent.title}</span>
                : <strong>{statusContent.title}</strong>}
              {statusContent.description && (
                <span className="calendar-event__date-time">{statusContent.description}</span>
              )}
              {state.kind === 'error' && (
                <button
                  type="button"
                  className="btn mini ghost calendar-retry-button"
                  onClick={() => setRetryCount(count => count + 1)}
                >
                  Retry
                </button>
              )}
            </span>
          </div>
        ) : (
          <>
            <ol className="calendar-events" aria-label={`Calendar events for ${selectedRange}`}>
              {visibleEvents.map(event => (
                <CalendarEventRow key={event.id} event={event} now={now} timeZone={timeZone} />
              ))}
            </ol>
            {busy && visibleEvents.length > 0 && (
              <p className="calendar-updating" role="status" aria-live="polite">
                Updating events…
              </p>
            )}
          </>
        )}
        {state.issueCount > 0 && (
          <p className="calendar-feed-issue" role="status">
            Some calendar entries could not be read.
          </p>
        )}
        {state.failures.length > 0 && state.kind !== 'error' && (
          <div className="calendar-partial-failure" role="status">
            <p className="calendar-feed-failure calendar-feed-failure--partial">
              Some calendars could not be loaded.
            </p>
            <button
              type="button"
              className="btn mini ghost calendar-retry-button"
              onClick={() => setRetryCount(count => count + 1)}
            >
              Retry calendars
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
