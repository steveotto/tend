import { useId } from 'react';
import type { ReactNode } from 'react';
import type { RhythmScheduleHistorySegment, RhythmSchedule } from '../domain/rhythm-schedule.ts';
import { CategoryHealthBadge } from './Cards.tsx';
import { RhythmScheduleSummary } from './RhythmMetadata.tsx';

export function formatRhythmSeasonDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(year!, month! - 1, day!, 12)));
}

function formatRhythmSeasonDateWithoutYear(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(year!, month! - 1, day!, 12)));
}

export function formatRhythmSeasonDateRange(
  startDate: string | undefined,
  endDate: string | undefined,
  endLabel = 'End date not recorded'
): { display: string; accessible: string } {
  const fullStart = startDate ? formatRhythmSeasonDate(startDate) : 'Start date not recorded';
  const fullEnd = endDate ? formatRhythmSeasonDate(endDate) : endLabel;
  const sameYear = startDate !== undefined
    && endDate !== undefined
    && startDate.slice(0, 4) === endDate.slice(0, 4);
  const displayStart = !startDate
    ? 'Start unknown'
    : sameYear
      ? formatRhythmSeasonDateWithoutYear(startDate)
      : fullStart;
  const displayEnd = endDate ? formatRhythmSeasonDate(endDate) : endLabel;
  return {
    display: `${displayStart} – ${displayEnd}`,
    accessible: `${fullStart} – ${fullEnd}`
  };
}

export function RhythmSeasonCard({
  seasonKind,
  paletteToken,
  seasonId,
  title,
  dateRange,
  healthScore = null,
  schedule,
  timeLabel,
  scheduleLabel,
  actions,
  note,
  statusLabel,
  highlighted = false,
  cardRefs
}: {
  seasonKind: RhythmScheduleHistorySegment['kind'];
  paletteToken: RhythmScheduleHistorySegment['paletteToken'];
  seasonId: string;
  title: string;
  dateRange?: { startDate?: string; endDate?: string; endLabel?: string };
  healthScore?: number | null;
  schedule?: RhythmSchedule;
  timeLabel?: string;
  scheduleLabel?: string;
  actions?: ReactNode;
  note?: string;
  statusLabel?: string;
  highlighted?: boolean;
  cardRefs?: Map<string, HTMLElement>;
}) {
  const headingId = useId();
  const seasonColorClass = seasonKind === 'unknown'
    ? 'rhythm-history-view__season-visual--unknown'
    : `rhythm-history-view__season-visual--${paletteToken}`;
  const hasFooter = Boolean(schedule || scheduleLabel || timeLabel || dateRange);
  const displayedTimeLabel = timeLabel === 'Time of day not recorded' ? 'Time unknown' : timeLabel;
  const formattedDateRange = dateRange
    ? formatRhythmSeasonDateRange(dateRange.startDate, dateRange.endDate, dateRange.endLabel)
    : undefined;

  return (
    <article
      ref={cardRefs ? element => {
        if (element) cardRefs.set(seasonId, element);
        else cardRefs.delete(seasonId);
      } : undefined}
      className={`rhythm-history-view__season-card ${seasonColorClass}${highlighted ? ' rhythm-history-view__season-card--highlighted' : ''}`}
      aria-labelledby={headingId}
      tabIndex={cardRefs ? -1 : undefined}
    >
      <div className="rhythm-history-view__season-card-header">
        <div className="rhythm-history-view__season-card-title-row">
          <h4 id={headingId}>{title}</h4>
          {statusLabel && <span className="rhythm-history-view__season-card-status">{statusLabel}</span>}
          {actions && <div className="rhythm-history-view__season-card-actions">{actions}</div>}
        </div>
        <CategoryHealthBadge
          score={healthScore}
          displayScore={healthScore === null ? null : Math.round(healthScore)}
          accessibleLabel={healthScore === null
            ? 'Season Health unavailable'
            : `Season Health: ${Math.round(healthScore)} out of 100`}
          className="rhythm-history-view__season-health-badge"
          variant="neutral-labeled"
        />
      </div>
      {note && <p className="rhythm-history-view__season-note">{note}</p>}
      {hasFooter && (
        <footer className="rhythm-history-view__season-card-footer">
          <span className="rhythm-history-view__season-card-metadata">
            {schedule
              ? (
                <RhythmScheduleSummary
                  schedule={schedule}
                  timeLabel={displayedTimeLabel}
                  {...(displayedTimeLabel !== timeLabel && timeLabel
                    ? { timeAccessibleLabel: timeLabel }
                    : {})}
                />
              )
              : scheduleLabel}
            {!schedule && displayedTimeLabel && (
              <span aria-label={displayedTimeLabel !== timeLabel ? timeLabel : undefined}>
                {displayedTimeLabel}
              </span>
            )}
          </span>
          {formattedDateRange && (
            <span
              className="rhythm-history-view__season-card-timeframe"
              aria-label={formattedDateRange.display !== formattedDateRange.accessible
                ? formattedDateRange.accessible
                : undefined}
            >
              {formattedDateRange.display}
            </span>
          )}
        </footer>
      )}
    </article>
  );
}
