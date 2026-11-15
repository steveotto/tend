import type { MouseEvent, RefObject } from 'react';
import type { StrengthWorkoutRhythmOption } from '../domain/strength-rhythm-linking.ts';

type Props = {
  options: readonly StrengthWorkoutRhythmOption[];
  selectedRhythmId?: string;
  onSelect: (rhythmId?: string) => void;
  onCreateRhythm?: (event: MouseEvent<HTMLButtonElement>) => void;
  fieldsetRef?: RefObject<HTMLFieldSetElement | null>;
};

export function StrengthRhythmCompletionPicker({
  options,
  selectedRhythmId,
  onSelect,
  onCreateRhythm,
  fieldsetRef
}: Props) {
  const eligibleCount = options.filter(option => option.eligible).length;

  return (
    <fieldset
      ref={fieldsetRef}
      id="strength-workout-rhythm-selection"
      className="strength-rhythm-completion"
      tabIndex={-1}
    >
      <legend>Count toward a Rhythm</legend>
      {options.length === 0
        ? <p className="strength-rhythm-completion__empty">No eligible workout Rhythms for this date.</p>
        : (
          <div className="strength-rhythm-completion__options">
            {options.map(option => (
              <label
                key={option.rhythm.id}
                className="strength-rhythm-completion__option"
              >
                <input
                  type="radio"
                  name="strength-workout-rhythm"
                  value={option.rhythm.id}
                  checked={selectedRhythmId === option.rhythm.id}
                  disabled={!option.eligible}
                  onChange={() => onSelect(option.rhythm.id)}
                />
                <span className="strength-rhythm-completion__copy">
                  <span>{option.rhythm.title}</span>
                  {option.reason && <small>{option.reason}</small>}
                  {!option.reason && option.explicit && <small>From this Rhythm</small>}
                  {!option.reason && !option.explicit && option.suggested && <small>Suggested for this workout</small>}
                </span>
              </label>
            ))}
          </div>
        )}
      <label className="strength-rhythm-completion__option">
        <input
          type="radio"
          name="strength-workout-rhythm"
          value="workout-only"
          checked={selectedRhythmId === undefined}
          onChange={() => onSelect(undefined)}
        />
        <span>Workout only</span>
      </label>
      {eligibleCount === 0 && onCreateRhythm && (
        <button
          type="button"
          className="btn mini ghost strength-rhythm-completion__create"
          onClick={onCreateRhythm}
        >
          Create a workout Rhythm
        </button>
      )}
    </fieldset>
  );
}
