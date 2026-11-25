import type { MouseEvent, RefObject } from 'react';

export function PersonProfileTabHeader({
  headingId,
  title,
  subtitle,
  actionLabel,
  actionRef,
  theme,
  onAction
}: {
  headingId?: string;
  title: string;
  subtitle: string;
  actionLabel?: string;
  actionRef?: RefObject<HTMLButtonElement | null>;
  theme?: 'prayer';
  onAction?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <header className={`person-profile-tab-header${theme ? ` person-profile-tab-header--${theme}` : ''}`}>
      <div className="person-profile-tab-header__copy">
        <h3 id={headingId}>{title}</h3>
        <p>{subtitle}</p>
      </div>
      {actionLabel && onAction && (
        <button
          ref={actionRef}
          className="btn mini person-profile-tab-header__action"
          type="button"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </header>
  );
}
