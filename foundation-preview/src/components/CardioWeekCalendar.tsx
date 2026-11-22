import { useId, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { formatCardioActivitySummary } from '../domain/cardio.ts';
import type { CardioActivity, CardioProgress } from '../domain/cardio.ts';
import { AnchoredPopover } from './AnchoredPopover.tsx';

type CardioWeekDay = CardioProgress['days'][number];

export function CardioWeekCalendar({
  days,
  activities,
  today,
  onActivityDetails
}: {
  days: readonly CardioWeekDay[];
  activities: readonly CardioActivity[];
  today: string;
  onActivityDetails: (activity: CardioActivity, opener: HTMLButtonElement) => void;
}) {
  const [openDate, setOpenDate] = useState<string | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const id = useId();
  const activeActivities = openDate
    ? activities.filter(activity => activity.date === openDate)
      .sort((left, right) => left.id.localeCompare(right.id))
    : [];
  const activeDate = openDate;

  function togglePopover(date: string, event: MouseEvent<HTMLButtonElement>) {
    anchorRef.current = event.currentTarget;
    setOpenDate(current => current === date ? null : date);
  }

  function showDetails(activity: CardioActivity) {
    const opener = anchorRef.current;
    setOpenDate(null);
    if (opener instanceof HTMLButtonElement) onActivityDetails(activity, opener);
  }

  return (
    <>
      <div className="cardio-week-strip" role="group" aria-label="Cardio activities Monday through Sunday">
        {days.map(day => {
          const dayActivities = activities.filter(activity => activity.date === day.date)
            .sort((left, right) => left.id.localeCompare(right.id));
          const activitySummaries = dayActivities.map(formatCardioActivitySummary);
          const tooltipId = `${id}-summary-${day.date}`;
          const dayLabel = `${formatWeekday(day.date)}, ${formatLongDate(day.date)}`;
          return (
            <div
              key={day.date}
              className={`cardio-week-day${dayActivities.length ? ' has-activity' : ''}${day.date === today ? ' is-today' : ''}`}
              role="group"
              aria-label={`${dayLabel}: ${dayActivities.length} ${dayActivities.length === 1 ? 'activity' : 'activities'}`}
            >
              <span>{formatWeekday(day.date).slice(0, 1)}</span>
              {dayActivities.length > 0 ? (
                <>
                  <button
                    ref={element => {
                      if (element && openDate === day.date) anchorRef.current = element;
                    }}
                    type="button"
                    className="cardio-week-day__marker"
                    aria-label={`View ${dayActivities.length === 1 ? 'activity' : `${dayActivities.length} activities`} on ${dayLabel}: ${activitySummaries.join(', ')}`}
                    aria-describedby={tooltipId}
                    aria-haspopup="dialog"
                    aria-expanded={openDate === day.date}
                    onClick={event => togglePopover(day.date, event)}
                  >
                    <span aria-hidden="true">●</span>
                    {dayActivities.length > 1 && <small aria-hidden="true">{dayActivities.length}</small>}
                  </button>
                  <span className="cardio-week-day__summary" id={tooltipId} role="tooltip">
                    {activitySummaries.join(' · ')}
                  </span>
                </>
              ) : (
                <span className="cardio-week-day__marker-placeholder" aria-hidden="true" />
              )}
              <small>{Number(day.date.slice(8, 10))}</small>
              {day.date === today && <span className="cardio-week-day__today">Today</span>}
            </div>
          );
        })}
      </div>
      {activeDate && activeActivities.length > 0 && (
        <AnchoredPopover
          anchorRef={anchorRef}
          id={`${id}-popover`}
          label={`Activities on ${formatLongDate(activeDate)}`}
          className="cardio-week-activity-popover"
          onClose={() => setOpenDate(null)}
        >
          <h3>Activities on {formatLongDate(activeDate)}</h3>
          <ul>
            {activeActivities.map(activity => (
              <li key={activity.id}>
                <span>{formatCardioActivitySummary(activity)}</span>
                <button type="button" className="btn mini ghost"
                  aria-label={`Details for ${formatCardioActivitySummary(activity)} on ${formatLongDate(activity.date)}`}
                  onClick={() => showDetails(activity)}>
                  Details
                </button>
              </li>
            ))}
          </ul>
        </AnchoredPopover>
      )}
    </>
  );
}

function formatWeekday(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' });
}

function formatLongDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}
