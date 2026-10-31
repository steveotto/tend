import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

type MoneyGoalDialogProps = {
  eyebrow?: string;
  title?: string;
  intro?: string;
  children: ReactNode;
  closeLabel?: string;
  closeButtonId?: string;
  labelledBy?: string;
  titleId?: string;
  initialFocusId?: string;
  stopEscapePropagation?: boolean;
  closeOnEscape?: boolean;
  portalToBody?: boolean;
  dialogId?: string;
  dismissOnBackdrop?: boolean;
  dialogClassName?: string;
  surfaceClassName?: string;
  bodyClassName?: string;
  onClose: () => void;
};

export function MoneyGoalDialog({
  eyebrow,
  title,
  intro,
  children,
  closeLabel,
  closeButtonId,
  labelledBy,
  titleId,
  initialFocusId,
  stopEscapePropagation = false,
  closeOnEscape = false,
  portalToBody = false,
  dialogId,
  dismissOnBackdrop = false,
  dialogClassName,
  surfaceClassName,
  bodyClassName,
  onClose
}: MoneyGoalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
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

  const dialog = (
    <dialog
      ref={dialogRef}
      id={dialogId}
      className={['money-goal-dialog', dialogClassName].filter(Boolean).join(' ')}
      aria-labelledby={labelledBy ?? 'money-goal-dialog-title'}
      onCancel={event => {
        event.preventDefault();
        if (stopEscapePropagation) event.stopPropagation();
        onClose();
      }}
      onKeyDown={event => {
        if (event.key === 'Escape' && closeOnEscape) {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        } else if (stopEscapePropagation && event.key === 'Escape') {
          event.stopPropagation();
        }
      }}
      onClick={event => {
        if (dismissOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <div className={['money-goal-dialog__surface', surfaceClassName].filter(Boolean).join(' ')}>
        {closeLabel && (
          <button
            id={closeButtonId}
            type="button"
            className="money-goal-dialog__close"
            aria-label={closeLabel}
            onClick={onClose}
          >
            ×
          </button>
        )}
        {eyebrow && <p className="money-goal-dialog__eyebrow">{eyebrow}</p>}
        {title && <h2 id={titleId ?? 'money-goal-dialog-title'}>{title}</h2>}
        {intro && <p className="money-goal-dialog__intro">{intro}</p>}
        {bodyClassName ? <div className={bodyClassName}>{children}</div> : children}
      </div>
    </dialog>
  );
  return portalToBody ? createPortal(dialog, document.body) : dialog;
}
