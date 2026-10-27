import { useId, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { formatRhythmSchedule } from '../domain/rhythm-schedule.ts';
import type { RhythmSchedule } from '../domain/rhythm-schedule.ts';

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
    schedule?: RhythmSchedule | undefined;
    timeLabel?: string | undefined;
    lastTended: string;
    statusIcon?: 'last-tended' | 'none';
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
      <RhythmScheduleSummary
        cadence={props.cadence}
        schedule={props.schedule}
        timeLabel={props.timeLabel}
      />
      <RhythmStatus
        className="rhythm-metadata-last-tended"
        undoBeforeStatus
        status={props.lastTended}
        showIcon={props.statusIcon !== 'none'}
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
  schedule,
  timeLabel,
  timeAccessibleLabel,
  presentation = 'compact'
}: {
  cadence?: string | undefined;
  schedule?: RhythmSchedule | undefined;
  timeLabel?: string | undefined;
  timeAccessibleLabel?: string | undefined;
  presentation?: 'compact' | 'detailed';
}) {
  const fullScheduleId = useId();
  const scheduleText = schedule
    ? formatRhythmSchedule(schedule, presentation)
    : cadence;
  const detailedSchedule = schedule && presentation === 'compact'
    ? formatRhythmSchedule(schedule, 'detailed')
    : undefined;
  return (
    <span className="rhythm-metadata-schedule-group">
      {scheduleText && (
        <span aria-describedby={detailedSchedule ? fullScheduleId : undefined}>
          <MetadataIcon kind="recurrence" />
          <span>{scheduleText}</span>
        </span>
      )}
      {detailedSchedule && (
        <span id={fullScheduleId} className="visually-hidden">Full schedule: {detailedSchedule}</span>
      )}
      {timeLabel && (
        <span>
          <MetadataIcon kind="time" />
          <span aria-label={timeAccessibleLabel}>{timeLabel}</span>
        </span>
      )}
    </span>
  );
}

function RhythmStatus({
  status,
  rhythmTitle,
  completed = false,
  onUndo,
  tendButtonRef,
  className,
  undoBeforeStatus = false,
  showIcon = true
}: {
  status: string;
  rhythmTitle?: string | undefined;
  completed?: boolean | undefined;
  onUndo?: (() => void) | undefined;
  tendButtonRef?: RefObject<HTMLButtonElement | null> | undefined;
  className?: string | undefined;
  undoBeforeStatus?: boolean;
  showIcon?: boolean;
}) {
  const undoRef = useRef<HTMLButtonElement>(null);
  const restoreTendFocus = useRef(false);

  useLayoutEffect(() => {
    if (restoreTendFocus.current && !completed) {
      tendButtonRef?.current?.focus();
      restoreTendFocus.current = false;
    }
  }, [completed, tendButtonRef]);

  const undoButton = onUndo && completed
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
    : null;
  const statusGroup = (
    <span className="rhythm-metadata-status-group">
      {showIcon && <MetadataIcon kind="last-tended" />}
      <span className="rhythm-metadata-status">{status}</span>
    </span>
  );

  if (undoBeforeStatus) {
    return (
      <span className={`rhythm-metadata-status-cluster${className ? ` ${className}` : ''}`}>
        {undoButton}
        {statusGroup}
      </span>
    );
  }

  return (
    <span className={`rhythm-metadata-status-group${className ? ` ${className}` : ''}`}>
      {undoButton}
      <MetadataIcon kind="last-tended" />
      <span className="rhythm-metadata-status">{status}</span>
    </span>
  );
}

function MetadataIcon({ kind }: { kind: 'recurrence' | 'time' | 'last-tended' }) {
  if (kind === 'recurrence') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M3 12a9 9 0 0 1 15.36-6.36L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-15.36 6.36L3 16" />
        <path d="M8 16H3v5" />
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
