import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

type MoneyGoalDialogProps = {
  title?: string;
  intro?: string;
  children: ReactNode;
  closeLabel?: string;
  labelledBy?: string;
  initialFocusId?: string;
  surfaceClassName?: string;
  onClose: () => void;
};

export function MoneyGoalDialog({
  title,
  intro,
  children,
  closeLabel,
  labelledBy,
  initialFocusId,
  surfaceClassName,
  onClose
}: MoneyGoalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    if (initialFocusId) {
      document.getElementById(initialFocusId)?.focus({ preventScroll: true });
    }
    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
    };
  }, [initialFocusId]);

  return (
    <dialog
      ref={dialogRef}
      className="money-goal-dialog"
      aria-labelledby={labelledBy ?? 'money-goal-dialog-title'}
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className={['money-goal-dialog__surface', surfaceClassName].filter(Boolean).join(' ')}>
        {closeLabel && (
          <button
            type="button"
            className="money-goal-dialog__close"
            aria-label={closeLabel}
            onClick={onClose}
          >
            ×
          </button>
        )}
        {title && <h2 id="money-goal-dialog-title">{title}</h2>}
        {intro && <p className="money-goal-dialog__intro">{intro}</p>}
        {children}
      </div>
    </dialog>
  );
}
