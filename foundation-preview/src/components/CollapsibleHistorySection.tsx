import type { ReactNode } from 'react';

export function CollapsibleHistorySection({
  className,
  label,
  accessibleLabel,
  count,
  expanded,
  onExpandedChange,
  summaryRef,
  children
}: {
  className: string;
  label: string;
  accessibleLabel?: string;
  count: number | string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  summaryRef?: { current: HTMLElement | null };
  children: ReactNode;
}) {
  return (
    <details
      className={className}
      open={expanded}
      onToggle={event => onExpandedChange(event.currentTarget.open)}
    >
      <summary
        ref={element => {
          if (summaryRef) summaryRef.current = element;
        }}
        role="button"
        aria-label={accessibleLabel ?? `${label} (${count})`}
        aria-expanded={expanded}
      >
        <span className="rhythm-history-view__logged-heading">{label}</span>
        <span className="rhythm-history-view__logged-count" aria-hidden="true">{count}</span>
        <svg
          className={`disclosure-chevron${expanded ? ' disclosure-chevron--expanded' : ''}`}
          viewBox="0 0 16 16"
          aria-hidden="true"
          focusable="false"
        >
          <path d="m3 6 5 5 5-5" />
        </svg>
      </summary>
      {children}
    </details>
  );
}
