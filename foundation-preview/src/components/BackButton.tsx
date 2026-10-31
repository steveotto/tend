import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  onClick: () => void;
};

export function BackButton({ children, onClick }: Props) {
  return (
    <button type="button" className="tend-back-button" onClick={onClick}>
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="m10 3-5 5 5 5" />
      </svg>
      <span>{children}</span>
    </button>
  );
}
