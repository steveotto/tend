import type { ReactNode } from 'react';

type TodayTimeframeProgress = {
  text: string;
  accessibleLabel: string;
};

type TodayTimeframeHeaderProps = {
  title: string;
  timeRange?: string | undefined;
  headingId?: string;
  agendaState?: 'expanded' | 'collapsed';
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
  agendaState,
  progress,
  trailingContent,
  disclosure
}: TodayTimeframeHeaderProps) {
  const expanded = disclosure?.expanded ?? agendaState === 'expanded';
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
          </span>
        )}
      </span>
      {timeRange && <span className="today-timeframe-header__range">{timeRange}</span>}
    </span>
  );

  return (
    <h4
      id={headingId}
      className={`today-timeframe-header today-timeframe-header--${expanded ? 'expanded' : 'collapsed'}`}
    >
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
            <svg
              className={`today-plan__agenda-marker today-plan__agenda-marker--${expanded ? 'expanded' : 'collapsed'}`}
              viewBox="0 0 20 20"
              aria-hidden="true"
              focusable="false"
            >
              <circle cx="10" cy="10" r="9" />
              <path d={expanded ? 'M6 10h8' : 'M6 10h8M10 6v8'} />
            </svg>
            {content}
          </button>
        )
        : content}
    </h4>
  );
}
