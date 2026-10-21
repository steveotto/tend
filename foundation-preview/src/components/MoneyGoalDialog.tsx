import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

type MoneyGoalDialogProps = {
  title: string;
  intro: string;
  children: ReactNode;
  onClose: () => void;
};

export function MoneyGoalDialog({ title, intro, children, onClose }: MoneyGoalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="money-goal-dialog"
      aria-labelledby="money-goal-dialog-title"
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="money-goal-dialog__surface">
        <h2 id="money-goal-dialog-title">{title}</h2>
        <p className="money-goal-dialog__intro">{intro}</p>
        {children}
      </div>
    </dialog>
  );
}
