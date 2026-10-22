import type { RefObject } from 'react';

type RhythmCompletionActionsProps = {
  rhythmTitle: string;
  completed: boolean;
  onTend: () => void;
  tendButtonRef: RefObject<HTMLButtonElement | null>;
};

export function RhythmCompletionActions({
  rhythmTitle,
  completed,
  onTend,
  tendButtonRef
}: RhythmCompletionActionsProps) {
  return (
    <>
      <button
        ref={tendButtonRef}
        type="button"
        className="rhythm-card__tend"
        aria-label={completed ? `Tended ${rhythmTitle}` : `Tend ${rhythmTitle}`}
        disabled={completed}
        onClick={onTend}
      >
        <span>{completed ? 'Tended' : 'Tend'}</span>
      </button>
      <span className="visually-hidden" aria-live="polite" aria-atomic="true">
        {completed ? `${rhythmTitle} marked tended.` : ''}
      </span>
    </>
  );
}
