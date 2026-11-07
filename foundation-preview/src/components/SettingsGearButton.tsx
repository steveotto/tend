import type { MouseEvent, RefObject } from 'react';

export function SettingsGearButton({
  label,
  onClick,
  buttonRef
}: {
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className="settings-icon-button"
      aria-label={label}
      aria-haspopup="dialog"
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M10.3 2.5h3.4l.5 1.9 1.4.6 1.7-.8 2.5 2.5-.8 1.7.6 1.4 1.9.5v3.4l-1.9.5-.6 1.4.8 1.7-2.5 2.5-1.7-.8-1.4.6-.5 1.9h-3.4l-.5-1.9-1.4-.6-1.7.8-2.5-2.5.8-1.7-.6-1.4-1.9-.5v-3.4l1.9-.5.6-1.4-.8-1.7 2.5-2.5 1.7.8 1.4-.6z" />
        <circle cx="12" cy="12" r="3.2" />
      </svg>
    </button>
  );
}
