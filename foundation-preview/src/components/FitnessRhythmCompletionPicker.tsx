import type { MouseEvent, RefObject } from 'react';
import type { RhythmPreview } from '../domain/preview-data.ts';

type RhythmOption = {
  rhythm: RhythmPreview;
  eligible: boolean;
  suggested: boolean;
  explicit: boolean;
  reason?: string;
};

type Props = {
  options: readonly RhythmOption[];
  selectedRhythmId?: string;
  selectionNotice?: string;
  onSelect: (rhythmId?: string) => void;
  onCreateRhythm?: (event: MouseEvent<HTMLButtonElement>) => void;
  activity: 'workout' | 'stretch';
  controlId: string;
  selectionRef?: RefObject<HTMLDivElement | null>;
};

export function FitnessRhythmCompletionPicker({
  options,
  selectedRhythmId,
  selectionNotice,
  onSelect,
  onCreateRhythm,
  activity,
  controlId,
  selectionRef
}: Props) {
  const eligibleCount = options.filter(option => option.eligible).length;
  const selectedOption = options.find(option => option.rhythm.id === selectedRhythmId);
  const activityNoun = activity === 'workout' ? 'workout' : 'stretch';
  const activityPlural = `${activityNoun} Rhythms`;
  const healthName = activity === 'workout' ? 'Strength Health' : 'Flexibility Health';
  const emptyHistoryCopy = activity === 'workout'
    ? 'Your workout will still be saved to history and update Body insights.'
    : 'Your stretch will still be saved to history and update stretch-region insights.';

  return (
    <div
      ref={selectionRef}
      id={`${controlId}-selection`}
      className="strength-rhythm-completion"
      tabIndex={-1}
      role="group"
      aria-label="Link to a Rhythm"
    >
      {eligibleCount === 0
        ? (
          <>
            <strong className="strength-rhythm-completion__label">Link to a Rhythm</strong>
            <p className="strength-rhythm-completion__empty">
              {options.length === 0
                ? `No ${activityPlural} are set up yet.`
                : `No ${activityPlural} are available for this date.`}
            </p>
            {selectionNotice && (
              <p className="strength-rhythm-completion__context" role="status">{selectionNotice}</p>
            )}
            {selectedOption && (
              <p className="strength-rhythm-completion__context">
                {selectedOption.rhythm.title} remains selected, but {selectedOption.reason?.toLowerCase()
                  ?? 'it is not eligible for this date'}.
              </p>
            )}
            {onCreateRhythm && (
              <button
                type="button"
                className="strength-rhythm-completion__create"
                onClick={onCreateRhythm}
              >
                Create a Rhythm
              </button>
            )}
            <p className="strength-rhythm-completion__context">
              {emptyHistoryCopy} To contribute to {healthName}, link it to an eligible Rhythm.
            </p>
          </>
        )
        : (
          <>
            <label className="strength-form-field strength-rhythm-completion__field" htmlFor={controlId}>
              <span>
                Link to a Rhythm <span className="strength-rhythm-completion__optional">(optional)</span>
              </span>
              <select
                id={controlId}
                name={`${activity}Rhythm`}
                value={selectedRhythmId ?? ''}
                onChange={event => onSelect(event.currentTarget.value || undefined)}
              >
                <option value="">Don’t link to a Rhythm</option>
                {selectedRhythmId && !selectedOption && (
                  <option value={selectedRhythmId} disabled>Selected Rhythm unavailable</option>
                )}
                {selectedOption && !selectedOption.eligible && (
                  <option value={selectedOption.rhythm.id} disabled>
                    {selectedOption.rhythm.title} — unavailable
                  </option>
                )}
                {options.filter(option => option.eligible).map(option => (
                  <option key={option.rhythm.id} value={option.rhythm.id}>
                    {option.rhythm.title}
                  </option>
                ))}
              </select>
            </label>
            {selectionNotice && (
              <p className="strength-rhythm-completion__context" role="status">{selectionNotice}</p>
            )}
            <p className="strength-rhythm-completion__context">
              {selectedOption?.eligible
                ? `Also records a completion for ${selectedOption.rhythm.title}.`
                : selectedOption
                  ? `${selectedOption.rhythm.title} is not available for this date: ${selectedOption.reason}.`
                  : selectedRhythmId
                    ? 'The selected Rhythm is unavailable for this date.'
                    : `Saved to ${activityNoun} history. Won’t contribute to ${healthName}.`}
            </p>
          </>
        )}
    </div>
  );
}
