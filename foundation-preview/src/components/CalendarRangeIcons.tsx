import type { ReactNode } from 'react';

type CalendarIconProps = { className?: string | undefined };

function CalendarOutline({
  className,
  children
}: CalendarIconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3.5" y="5.5" width="17" height="16" rx="2.5" />
      <path d="M8 3.75v3.5M16 3.75v3.5M3.75 10.25h16.5" />
      {children}
    </svg>
  );
}

export function CalendarOutlineIcon({ className }: CalendarIconProps) {
  return <CalendarOutline className={className}>{null}</CalendarOutline>;
}

export function CalendarTodayIcon({ className }: CalendarIconProps) {
  return (
    <CalendarOutline className={className}>
      <circle className="calendar-range-icon__dot calendar-range-icon__dot--today" cx="12" cy="15.75" r="3" />
    </CalendarOutline>
  );
}

export function CalendarWeekIcon({ className }: CalendarIconProps) {
  return (
    <CalendarOutline className={className}>
      {[5.8, 7.87, 9.93, 12, 14.07, 16.13, 18.2].map(x => (
        <circle className="calendar-range-icon__dot" cx={x} cy="15.75" r="1.05" key={x} />
      ))}
    </CalendarOutline>
  );
}

export function CalendarMonthIcon({ className }: CalendarIconProps) {
  return (
    <CalendarOutline className={className}>
      {[7.1, 10.37, 13.63, 16.9].flatMap(x => [13, 16.25, 19.5].map(y => (
        <circle className="calendar-range-icon__dot" cx={x} cy={y} r="1.05" key={`${x}-${y}`} />
      )))}
    </CalendarOutline>
  );
}
