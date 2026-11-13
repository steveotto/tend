import type { ReactNode } from 'react';

type TodayTimeframeProgress = {
  text: string;
  accessibleLabel: string;
};

type TodayTimeframeHeaderProps = {
  title: string;
  timeRange?: string | undefined;
  headingId?: string;
  progress?: TodayTimeframeProgress;
  trailingContent?: ReactNode;
  disclosure?: {
    id: string;
    panelId: string;
    expanded: boolean;
    onToggle: () => void;
  };
};

export function TodayTimeframeHeader({
  title,
  timeRange,
  headingId,
  progress,
  trailingContent,
  disclosure
}: TodayTimeframeHeaderProps) {
  const content = (
    <span className="today-timeframe-header__content">
      <span className="today-timeframe-header__title-row">
        <span className="today-plan__view-heading">{title}</span>
        {(progress || trailingContent || disclosure) && (
          <span className="today-timeframe-header__meta">
            {trailingContent}
            {progress && (
              <span
                className="today-timeframe-header__progress"
                {...(disclosure ? { 'aria-hidden': true } : {})}
              >
                {progress.text}
              </span>
            )}
            {disclosure && (
              <svg className="today-plan__accordion-chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d={disclosure.expanded ? 'm3 10 5-5 5 5' : 'm3 6 5 5 5-5'} />
              </svg>
            )}
          </span>
        )}
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
            aria-label={`${title}${timeRange ? `, ${timeRange}` : ''}${progress ? `, ${progress.accessibleLabel}` : ''}`}
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
