import type { ReactNode } from 'react';

type TodayTimeframeHeaderProps = {
  title: string;
  timeRange?: string | undefined;
  headingId?: string;
  trailingContent?: ReactNode;
  disclosure?: {
    id: string;
    panelId: string;
    expanded: boolean;
    progress: string;
    onToggle: () => void;
  };
};

export function TodayTimeframeHeader({
  title,
  timeRange,
  headingId,
  trailingContent,
  disclosure
}: TodayTimeframeHeaderProps) {
  const content = (
    <span className="today-timeframe-header__content">
      <span className="today-timeframe-header__title-row">
        <span className="today-plan__view-heading">{title}</span>
        {disclosure
          ? (
            <span className="today-timeframe-header__meta">
              <span className="today-plan__accordion-progress">{disclosure.progress}</span>
              <svg className="today-plan__accordion-chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d={disclosure.expanded ? 'm3 10 5-5 5 5' : 'm3 6 5 5 5-5'} />
              </svg>
            </span>
          )
          : trailingContent}
      </span>
      {timeRange && <span className="today-timeframe-header__range">{timeRange}</span>}
    </span>
  );

  return (
    <h4 id={headingId} className="today-timeframe-header">
      {disclosure
        ? (
          <button
            type="button"
            id={disclosure.id}
            className="today-timeframe-header__disclosure"
            aria-label={`${title}${timeRange ? `, ${timeRange}` : ''}, ${disclosure.progress}`}
            aria-expanded={disclosure.expanded}
            aria-controls={disclosure.panelId}
            onClick={disclosure.onToggle}
          >
            {content}
          </button>
        )
        : content}
    </h4>
  );
}
