import type { CalendarEvent } from '../domain/calendar-events.ts';
import { formatCalendarEventPresentation } from '../domain/calendar-event-presentation.ts';

export function CalendarEventRow({
  event,
  now,
  timeZone
}: {
  event: CalendarEvent;
  now: number;
  timeZone: string;
}) {
  const presentation = formatCalendarEventPresentation(event, now, timeZone);
  return (
    <li className="calendar-event">
      <time className="calendar-event__date-tile" dateTime={new Date(event.startsAt).toISOString()}>
        <span className="calendar-event__month">{presentation.month}</span>
        <span className="calendar-event__day">{presentation.day}</span>
      </time>
      <span className="calendar-event__details">
        <strong>{event.title}</strong>
        <span className="calendar-event__date-time">{presentation.dateTime}</span>
      </span>
      <span className="calendar-event__relative">{presentation.relativeDate}</span>
    </li>
  );
}
