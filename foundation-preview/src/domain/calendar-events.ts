export type CalendarEvent =
  | {
      id: string;
      sourceId: string;
      title: string;
      calendarName: string;
      kind: 'all-day';
      startDate: string;
      endDate: string;
    }
  | {
      id: string;
      sourceId: string;
      title: string;
      calendarName: string;
      kind: 'timed';
      startAt: number;
      endAt: number;
    };

export type CalendarLoadState =
  | { kind: 'not-configured' }
  | { kind: 'loading' }
  | { kind: 'loaded' }
  | { kind: 'error' };

function localDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

export function selectTodayCalendarEvents(
  events: readonly CalendarEvent[],
  today: Date
): CalendarEvent[] {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const dateKey = localDateKey(start);
  return events.filter(event => {
    if (event.kind === 'all-day') {
      return /^\d{4}-\d{2}-\d{2}$/.test(event.startDate)
        && /^\d{4}-\d{2}-\d{2}$/.test(event.endDate)
        && event.startDate <= dateKey
        && dateKey < event.endDate;
    }
    return Number.isFinite(event.startAt)
      && Number.isFinite(event.endAt)
      && event.startAt < event.endAt
      && event.startAt < end.getTime()
      && event.endAt > start.getTime();
  }).sort((left, right) => {
    const leftStart = left.kind === 'all-day' ? start.getTime() : left.startAt;
    const rightStart = right.kind === 'all-day' ? start.getTime() : right.startAt;
    return leftStart - rightStart || left.id.localeCompare(right.id);
  });
}

export function calendarEventTimeLabel(event: CalendarEvent, today: Date): string {
  if (event.kind === 'all-day') return 'All day';
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = dayStart.getTime();
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const end = dayEnd.getTime();
  const time = (instant: number) => new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(instant));
  if (event.startAt < start) return `Until ${time(event.endAt)}`;
  if (event.endAt > end) return `${time(event.startAt)} · continues overnight`;
  return `${time(event.startAt)} – ${time(event.endAt)}`;
}
