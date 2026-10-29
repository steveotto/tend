import { useId } from 'react';
import { strengthMuscles } from '../domain/strength.ts';
import type { StrengthMuscleId } from '../domain/strength.ts';

export function StrengthMuscleSelection({
  selectedMuscleIds,
  onToggle
}: {
  selectedMuscleIds: readonly StrengthMuscleId[];
  onToggle: (muscleId: StrengthMuscleId) => void;
}) {
  const idPrefix = useId();
  return (
    <fieldset className="strength-muscle-selection">
      <legend>Muscles trained</legend>
      {strengthMuscles.map(muscle => {
        const selected = selectedMuscleIds.includes(muscle.id);
        const inputId = `${idPrefix}-strength-log-muscle-${muscle.id}`;
        return (
          <label
            key={muscle.id}
            className={selected ? 'strength-muscle-selection__tile is-selected' : 'strength-muscle-selection__tile'}
            htmlFor={inputId}
          >
            <input
              id={inputId}
              type="checkbox"
              name={`muscle-${muscle.id}`}
              checked={selected}
              onChange={() => onToggle(muscle.id)}
            />
            <span>{muscle.name}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
