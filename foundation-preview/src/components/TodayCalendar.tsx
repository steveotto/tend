import { useMemo } from 'react';
import { calendarEventTimeLabel, selectTodayCalendarEvents } from '../domain/calendar-events.ts';
import type { CalendarEvent, CalendarLoadState } from '../domain/calendar-events.ts';
import type { CalendarSource } from '../domain/calendar-sources.ts';
import { SettingsGearButton } from './SettingsGearButton.tsx';

type Props = {
  sources: readonly CalendarSource[];
  events: readonly CalendarEvent[];
  state: CalendarLoadState;
  today: Date;
  onSettings: () => void;
  onRetry?: () => void;
};

export function TodayCalendar({ sources, events, state, today, onSettings, onRetry }: Props) {
  const todaysEvents = useMemo(() => selectTodayCalendarEvents(events, today), [events, today]);
  return (
    <section aria-labelledby="calendar-heading" className="today-calendar-section">
      <header className="sectiontitle today-calendar__heading">
        <h2 id="calendar-heading">On your calendar</h2>
        <SettingsGearButton label="Calendar settings" onClick={onSettings} />
      </header>
      <div className="card calendar-card">
        {state.kind === 'loading' ? (
          <p className="empty" role="status">Loading calendars…</p>
        ) : state.kind === 'error' ? (
          <div className="today-calendar__message" role="alert">
            <p>Calendar events could not be refreshed. Your settings are unchanged.</p>
            {onRetry && <button type="button" className="btn mini ghost" onClick={onRetry}>Retry</button>}
          </div>
        ) : state.kind === 'not-configured' ? (
          <p className="empty" role="status">
            {sources.length === 0
              ? 'No calendars connected in this preview.'
              : 'Calendar loading is not enabled yet. Your saved sources have not been contacted.'}
          </p>
        ) : todaysEvents.length === 0 ? (
          <p className="empty" role="status">No events scheduled today.</p>
        ) : (
          <div className="today-calendar__events" aria-label="Today’s calendar events">
            {todaysEvents.map(event => (
              <article className="today-calendar__event" key={`${event.sourceId}:${event.id}`}>
                <span className="today-calendar__event-time">{calendarEventTimeLabel(event, today)}</span>
                <span className="today-calendar__event-title">{event.title}</span>
                <span className="today-calendar__event-calendar">{event.calendarName}</span>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
