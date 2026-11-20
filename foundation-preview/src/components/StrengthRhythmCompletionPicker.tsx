import type { MouseEvent, RefObject } from 'react';
import type { StrengthWorkoutRhythmOption } from '../domain/strength-rhythm-linking.ts';
import { FitnessRhythmCompletionPicker } from './FitnessRhythmCompletionPicker.tsx';

type Props = {
  options: readonly StrengthWorkoutRhythmOption[];
  selectedRhythmId?: string;
  workoutOnlySelected?: boolean;
  selectionNotice?: string;
  onSelect: (rhythmId?: string) => void;
  onWorkoutOnlyChange?: (selected: boolean) => void;
  onCreateRhythm?: (event: MouseEvent<HTMLButtonElement>) => void;
  presentation?: 'manual' | 'guided';
  selectionRef?: RefObject<HTMLDivElement | null>;
  fieldsetRef?: RefObject<HTMLFieldSetElement | null>;
};

export function StrengthRhythmCompletionPicker({
  options,
  selectedRhythmId,
  workoutOnlySelected,
  selectionNotice,
  onSelect,
  onWorkoutOnlyChange,
  onCreateRhythm,
  presentation = 'manual',
  selectionRef,
  fieldsetRef
}: Props) {
  if (presentation !== 'guided') {
    return (
      <FitnessRhythmCompletionPicker
        options={options}
        {...(selectedRhythmId ? { selectedRhythmId } : {})}
        {...(selectionNotice ? { selectionNotice } : {})}
        onSelect={onSelect}
        {...(onCreateRhythm ? { onCreateRhythm } : {})}
        activity="workout"
        controlId="strength-workout-rhythm"
        {...(selectionRef ? { selectionRef } : {})}
      />
    );
  }

  const eligibleOptions = options.filter(option => option.eligible);
  const selectedOption = options.find(option => option.rhythm.id === selectedRhythmId);
  const noEligibleRhythms = eligibleOptions.length === 0;
  const workoutOnlyChecked = noEligibleRhythms || workoutOnlySelected === true;
  if (!onWorkoutOnlyChange) {
    throw new Error('Guided workout Rhythm selection requires a Workout only change handler.');
  }

  return (
    <fieldset
      ref={fieldsetRef}
      id="strength-workout-rhythm-selection"
      className="strength-rhythm-completion"
      tabIndex={-1}
      aria-label="Count toward a Rhythm"
    >
      <legend className="sr-only">Workout completion</legend>
      {!noEligibleRhythms && (
        <label className="strength-form-field strength-rhythm-completion__field" htmlFor="strength-guided-rhythm">
          <span>Count toward a Rhythm</span>
          <select
            id="strength-guided-rhythm"
            name="strengthGuidedRhythm"
            value={eligibleOptions.some(option => option.rhythm.id === selectedRhythmId) ? selectedRhythmId : ''}
            disabled={workoutOnlyChecked}
            onChange={event => onSelect(event.currentTarget.value || undefined)}
          >
            <option value="">Choose a Rhythm</option>
            {eligibleOptions.map(option => (
              <option key={option.rhythm.id} value={option.rhythm.id}>
                {option.rhythm.title}
              </option>
            ))}
          </select>
        </label>
      )}
      {selectedOption && !selectedOption.eligible && (
        <p className="strength-rhythm-completion__context" role="status">
          {selectedOption.rhythm.title} cannot be linked: {selectedOption.reason ?? 'it is unavailable for this date'}.
          {workoutOnlyChecked ? ' Saving Workout only will remove this unavailable link.' : ''}
        </p>
      )}
      {selectedRhythmId && !selectedOption && (
        <p className="strength-rhythm-completion__context" role="status">
          The selected Rhythm is unavailable. Saving Workout only will remove this unavailable link.
        </p>
      )}
      <label className={`checkbox-tile-options__tile strength-rhythm-completion__workout-only${workoutOnlyChecked ? ' is-selected' : ''}`}>
        <input
          type="checkbox"
          checked={workoutOnlyChecked}
          disabled={noEligibleRhythms}
          onChange={event => onWorkoutOnlyChange(event.currentTarget.checked)}
        />
        <span className="strength-rhythm-completion__workout-only-copy">
          <span>Workout only</span>
          <small>Save without completing a Rhythm.</small>
        </span>
      </label>
      {noEligibleRhythms && (
        <p className="strength-rhythm-completion__empty">
          No workout Rhythms are available for this date. Your workout will still be saved.
        </p>
      )}
      {selectionNotice && (
        <p className="strength-rhythm-completion__context" role="status">{selectionNotice}</p>
      )}
    </fieldset>
  );
}
