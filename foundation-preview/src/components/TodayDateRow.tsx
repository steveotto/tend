export type TodayDatePresentation = {
  abbreviatedWeekday: string;
  dayNumber: string;
  weekday: string;
  monthYear: string;
  accessibleDate: string;
};

export function formatTodayDate(instant: Date, locale?: string): TodayDatePresentation {
  return {
    abbreviatedWeekday: new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(instant),
    dayNumber: new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(instant),
    weekday: new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(instant),
    monthYear: new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(instant),
    accessibleDate: new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(instant)
  };
}

export function TodayDateRow({ instant, localDate }: { instant: Date; localDate: string }) {
  const date = formatTodayDate(instant);
  return (
    <time className="today-date-row" dateTime={localDate} aria-label={date.accessibleDate}>
      <span className="today-date-row__tile" aria-hidden="true">
        <span className="today-date-row__abbreviated-weekday">{date.abbreviatedWeekday}</span>
        <strong className="today-date-row__day">{date.dayNumber}</strong>
      </span>
      <span className="today-date-row__copy" aria-hidden="true">
        <span className="today-date-row__weekday">{date.weekday}</span>
        <span className="today-date-row__month-year">{date.monthYear}</span>
      </span>
    </time>
  );
}
