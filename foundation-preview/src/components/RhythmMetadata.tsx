import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';

type RhythmMetadataProps =
  | {
    variant: 'status';
    status: string;
    rhythmTitle?: string;
    completed?: boolean;
    onUndo?: (() => void) | undefined;
    tendButtonRef?: RefObject<HTMLButtonElement | null> | undefined;
  }
  | {
    variant: 'footer';
    cadence?: string | undefined;
    timeLabel?: string | undefined;
    lastTended: string;
    rhythmTitle?: string;
    completed?: boolean;
    onUndo?: (() => void) | undefined;
    tendButtonRef?: RefObject<HTMLButtonElement | null> | undefined;
  };

export function RhythmMetadata(props: RhythmMetadataProps) {
  if (props.variant === 'status') {
    return (
      <RhythmStatus
        status={props.status}
        rhythmTitle={props.rhythmTitle}
        completed={props.completed}
        onUndo={props.onUndo}
        tendButtonRef={props.tendButtonRef}
      />
    );
  }

  return (
    <div className="rhythm-metadata-footer">
      <RhythmScheduleSummary cadence={props.cadence} timeLabel={props.timeLabel} />
      <RhythmStatus
        className="rhythm-metadata-last-tended"
        status={props.lastTended}
        rhythmTitle={props.rhythmTitle}
        completed={props.completed}
        onUndo={props.onUndo}
        tendButtonRef={props.tendButtonRef}
      />
    </div>
  );
}

export function RhythmScheduleSummary({
  cadence,
  timeLabel
}: {
  cadence?: string | undefined;
  timeLabel?: string | undefined;
}) {
  return (
    <>
      {cadence && <span><MetadataIcon kind="recurrence" />{cadence}</span>}
      {timeLabel && <span><MetadataIcon kind="time" />{timeLabel}</span>}
    </>
  );
}

function RhythmStatus({
  status,
  rhythmTitle,
  completed = false,
  onUndo,
  tendButtonRef,
  className
}: {
  status: string;
  rhythmTitle?: string | undefined;
  completed?: boolean | undefined;
  onUndo?: (() => void) | undefined;
  tendButtonRef?: RefObject<HTMLButtonElement | null> | undefined;
  className?: string | undefined;
}) {
  const undoRef = useRef<HTMLButtonElement>(null);
  const restoreTendFocus = useRef(false);

  useLayoutEffect(() => {
    if (restoreTendFocus.current && !completed) {
      tendButtonRef?.current?.focus();
      restoreTendFocus.current = false;
    }
  }, [completed, tendButtonRef]);

  return (
    <span className={`rhythm-metadata-status-group${className ? ` ${className}` : ''}`}>
      {onUndo && (completed
        ? (
          <button
            ref={undoRef}
            type="button"
            className="rhythm-metadata-undo"
            aria-label={`Undo completion for ${rhythmTitle ?? 'this Rhythm'}`}
            title={`Undo completion for ${rhythmTitle ?? 'this Rhythm'}`}
            onClick={() => {
              restoreTendFocus.current = document.activeElement === undoRef.current;
              onUndo();
            }}
          >
            <UndoIcon />
          </button>
        )
        : null)}
      <MetadataIcon kind="last-tended" />
      <span className="rhythm-metadata-status">{status}</span>
    </span>
  );
}

function MetadataIcon({ kind }: { kind: 'recurrence' | 'time' | 'last-tended' }) {
  if (kind === 'recurrence') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M5.6 9A7 7 0 0 1 18 6.5L20 9M4 15l2 2.5A7 7 0 0 0 18.4 15" />
      </svg>
    );
  }
  if (kind === 'time') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M7.5 3v4M16.5 3v4M3.5 9h17M8 14l2.5 2.5L16 12" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg viewBox="0 4 24 24" aria-hidden="true">
      <path d="M9 8 5 12l4 4" />
      <path d="M5 12h8a6 6 0 1 1-5.7 7.9" />
    </svg>
  );
}
