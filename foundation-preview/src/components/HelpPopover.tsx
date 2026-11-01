import { useEffect, useRef, useState } from 'react';

export function HelpPopover({ label, children }: { label: string; children: string }) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const popoverId = `help-popover-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  useEffect(() => {
    if (!open) return;
    const dismissOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismissOutside);
    return () => document.removeEventListener('pointerdown', dismissOutside);
  }, [open]);

  return (
    <span
      ref={rootRef}
      className="help-popover"
      onKeyDown={event => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="help-popover__trigger"
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        aria-describedby={open ? popoverId : undefined}
        onClick={() => setOpen(current => !current)}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="8" />
          <path d="M8 7.3a2.1 2.1 0 1 1 3.6 1.5c-.9.8-1.6 1.1-1.6 2.3m0 2v.1" />
        </svg>
      </button>
      {open && <span id={popoverId} className="help-popover__content" role="tooltip">{children}</span>}
    </span>
  );
}
