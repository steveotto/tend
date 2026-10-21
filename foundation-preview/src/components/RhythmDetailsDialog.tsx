import { useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';
import type { RhythmPreview } from '../domain/preview-data.ts';

type RhythmDetailsDialogProps = {
  rhythm: RhythmPreview;
  completed: boolean;
  onTend: () => void;
  onClose: () => void;
};

export function RhythmDetailsDialog({ rhythm, completed, onTend, onClose }: RhythmDetailsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    dialog.querySelector<HTMLElement>('[data-details-title]')?.focus();
  }, []);

  function closeFromEvent(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="today-rhythm-details-dialog"
      aria-labelledby="rhythm-details-title"
      onClick={closeFromEvent}
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div className="today-rhythm-details__surface">
        <header className="today-rhythm-details__header">
          <h2 id="rhythm-details-title" data-details-title tabIndex={-1}>{rhythm.title}</h2>
          <button type="button" className="today-rhythm-details__close" aria-label="Close details" onClick={onClose}>×</button>
        </header>
        <div className="today-rhythm-details__content">
          <div className="today-rhythm-details__main">
            <div className="today-rhythm-details__copy">
              <p className="tend-type-description today-rhythm-details__description">{rhythm.description}</p>
              <div className="today-rhythm-details__badges">{rhythm.cadence} · {rhythm.timeLabel}</div>
            </div>
            <div className="today-rhythm-details__actions">
              <button type="button" className="btn mini rhythm-card__tend" onClick={onTend} disabled={completed}>{completed ? 'Tended ✓' : 'Tend'}</button>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
