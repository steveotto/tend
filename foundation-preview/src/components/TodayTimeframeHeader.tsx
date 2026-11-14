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
            {disclosure && (
              <svg className="today-plan__accordion-toggle-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <path d={expanded ? 'M5 10h10' : 'M5 10h10M10 5v10'} />
              </svg>
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
            {content}
          </button>
        )
        : content}
    </h4>
  );
}
