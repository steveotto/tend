import { useId } from 'react';
import type { ReactNode } from 'react';

export type ToolZoneProps = {
  icon: ReactNode;
  purposeLabel: string;
  subtitle: string;
  scoringFootnote: string;
  children: ReactNode;
  className?: string;
  headingId?: string;
  headerAction?: ReactNode;
  explanationAction?: ReactNode;
};

export function ToolZone({
  icon,
  purposeLabel,
  subtitle,
  scoringFootnote,
  children,
  className = '',
  headingId,
  headerAction,
  explanationAction
}: ToolZoneProps) {
  const generatedHeadingId = useId();
  const resolvedHeadingId = headingId ?? generatedHeadingId;
  const actions = headerAction || explanationAction;

  return (
    <section
      className={`tool-zone ${className}`.trim()}
      aria-labelledby={resolvedHeadingId}
    >
      <header className="tool-zone__header">
        <span className="tool-zone__icon" aria-hidden="true">{icon}</span>
        <div className="tool-zone__intro">
          <h3 id={resolvedHeadingId} className="tool-zone__purpose">{purposeLabel}</h3>
          <p className="tool-zone__subtitle">{subtitle}</p>
        </div>
        {actions && (
          <div className="tool-zone__actions">
            {headerAction}
            {explanationAction && (
              <span className="tool-zone__explanation">{explanationAction}</span>
            )}
          </div>
        )}
      </header>
      <div className="tool-zone__content">{children}</div>
      <p className="tool-zone__footnote">{scoringFootnote}</p>
    </section>
  );
}

export function ToolZoneTrendingUpIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3.5 17.5 9 12l3.5 3.5L20 8" />
      <path d="M14.5 8H20v5.5" />
    </svg>
  );
}
