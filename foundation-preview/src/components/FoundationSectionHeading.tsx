import type { ReactNode } from 'react';

export type FoundationSectionHeadingProps = {
  title: string;
  headingId?: string;
  accessibleName?: string;
  secondary?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
};

export function FoundationSectionHeading({
  title,
  headingId,
  accessibleName,
  secondary,
  subtitle,
  actions
}: FoundationSectionHeadingProps) {
  return (
    <header className="strength-section-heading">
      <div className="strength-section-heading__title">
        <div className="strength-section-heading__title-row">
          <h3 id={headingId} aria-label={accessibleName}>{title}</h3>
          {secondary && <span className="strength-section-heading__secondary">{secondary}</span>}
        </div>
        {subtitle && <p className="strength-section-heading__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="strength-section-heading__actions">{actions}</div>}
    </header>
  );
}
