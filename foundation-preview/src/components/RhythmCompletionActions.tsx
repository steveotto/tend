import type { RefObject } from 'react';
import type { MouseEvent } from 'react';

type RhythmCompletionActionsProps = {
  rhythmId: string;
  rhythmTitle: string;
  completed: boolean;
  actionLabel?: string | undefined;
  actionAccessibleLabel?: string | undefined;
  completedLabel?: string | undefined;
  onTend: (event: MouseEvent<HTMLButtonElement>) => void;
  tendButtonRef: RefObject<HTMLButtonElement | null>;
};

export function RhythmCompletionActions({
  rhythmId,
  rhythmTitle,
  completed,
  actionLabel = 'Tend',
  actionAccessibleLabel = actionLabel,
  completedLabel = 'Tended',
  onTend,
  tendButtonRef
}: RhythmCompletionActionsProps) {
  return (
    <>
      <button
        ref={tendButtonRef}
        data-rhythm-tend-button={rhythmId}
        type="button"
        className="rhythm-card__tend"
        aria-label={completed ? `${completedLabel} ${rhythmTitle}` : `${actionAccessibleLabel} ${rhythmTitle}`}
        disabled={completed}
        onClick={onTend}
      >
        <span>{completed ? completedLabel : actionLabel}</span>
      </button>
      <span className="visually-hidden" aria-live="polite" aria-atomic="true">
        {completed ? `${rhythmTitle} marked ${completedLabel.toLocaleLowerCase()}.` : ''}
      </span>
    </>
  );
}
