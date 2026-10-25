import { useEffect, useRef, useState } from 'react';
import type { DailyCompletionCount } from '../domain/rhythm-history.ts';
import { localDateString } from '../domain/money-goals.ts';

const PLOT_HEIGHT = 200;
const CHART_HEIGHT = 224;

export function RhythmCompletionHistoryChart({
  dailyCounts,
  todayDate = localDateString(new Date())
}: {
  dailyCounts: readonly DailyCompletionCount[];
  todayDate?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const latestDate = dailyCounts.at(-1)?.date;
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const scrollRegion = scrollRef.current;
    if (!scrollRegion) return;

    const updateOverflow = () => {
      setHasOverflow(scrollRegion.scrollWidth > scrollRegion.clientWidth);
    };
    updateOverflow();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateOverflow);
      observer.observe(scrollRegion);
      if (scrollRegion.firstElementChild) observer.observe(scrollRegion.firstElementChild);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateOverflow);
    return () => window.removeEventListener('resize', updateOverflow);
  }, [dailyCounts.length, latestDate]);

  useEffect(() => {
    const chartScroll = scrollRef.current;
    if (chartScroll && chartScroll.scrollWidth > chartScroll.clientWidth) {
      chartScroll.scrollLeft = chartScroll.scrollWidth;
    }
  }, [latestDate]);

  if (dailyCounts.length === 0) {
    return (
      <div className="rhythm-history-view__chart-placeholder" aria-hidden="true">
        <div className="rhythm-history-view__chart-placeholder-plot" />
      </div>
    );
  }

  const maxCount = Math.max(1, ...dailyCounts.map(item => item.count));

  return (
    <div className="rhythm-history-view__chart-section">
      <div
        ref={scrollRef}
        className="rhythm-history-view__chart-scroll"
        role="region"
        aria-label="Completion history chart; scroll horizontally for older dates"
        tabIndex={0}
        onScroll={() => {
          if (scrollRef.current) {
            setHasOverflow(scrollRef.current.scrollWidth > scrollRef.current.clientWidth);
          }
        }}
      >
        <ol
          className="rhythm-history-view__chart"
          aria-label="Recorded completion count by date"
          style={{ height: `${CHART_HEIGHT}px` }}
        >
          {dailyCounts.map(item => {
            const isToday = item.date === todayDate;
            const dateLabel = formatHistoryDate(item.date);
            return (
              <li
                key={item.date}
                aria-label={item.count === 0
                  ? `${dateLabel}: ${isToday ? 'no completion recorded yet, today' : 'no recorded completions'}`
                  : `${dateLabel}: ${item.count} ${item.count === 1 ? 'completion' : 'completions'}${isToday ? ', today' : ''}`}
              >
                <div
                  className="rhythm-history-view__completion-bar-area"
                  style={{ height: `${PLOT_HEIGHT}px` }}
                >
                  <span className="rhythm-history-view__completion-track" aria-hidden="true" />
                  {item.count > 0 ? (
                    <div
                      className="rhythm-history-view__completion-bar"
                      style={{ height: `${(item.count / maxCount) * 100}%` }}
                    >
                      <span className="rhythm-history-view__bar-value">{item.count}</span>
                    </div>
                  ) : (
                    <span
                      className="rhythm-history-view__completion-zero"
                      aria-hidden="true"
                    >
                      –
                    </span>
                  )}
                </div>
                <time dateTime={item.date}>
                  {isToday ? 'Today' : formatHistoryDate(item.date, false)}
                </time>
              </li>
            );
          })}
        </ol>
      </div>
      {hasOverflow && (
        <p className="rhythm-history-view__chart-hint">Scroll horizontally to explore older history.</p>
      )}
    </div>
  );
}

function formatHistoryDate(value: string, long = true): string {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', {
    ...(long ? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' }),
    timeZone: 'UTC'
  });
}
