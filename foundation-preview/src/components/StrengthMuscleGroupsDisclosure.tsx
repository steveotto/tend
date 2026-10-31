import { strengthMuscles } from '../domain/strength.ts';
import type { StrengthMuscleId } from '../domain/strength.ts';
import { StrengthMuscleSelection } from './StrengthMuscleSelection.tsx';

export function StrengthMuscleGroupsDisclosure({
  selectedMuscleIds,
  onToggle,
  label = 'Muscle groups'
}: {
  selectedMuscleIds: readonly StrengthMuscleId[];
  onToggle: (muscleId: StrengthMuscleId) => void;
  label?: string;
}) {
  const selectedNames = strengthMuscles
    .filter(muscle => selectedMuscleIds.includes(muscle.id))
    .map(muscle => muscle.name);

  return (
    <details className="strength-muscle-disclosure">
      <summary>
        <span className="strength-muscle-disclosure__label">{label}</span>
        <span className="strength-muscle-disclosure__selection">
          {selectedNames.length ? selectedNames.join(', ') : 'Choose muscle groups'}
        </span>
        <span className="strength-muscle-disclosure__chevron" aria-hidden="true">›</span>
      </summary>
      <StrengthMuscleSelection
        selectedMuscleIds={selectedMuscleIds}
        onToggle={onToggle}
        legendLabel={label}
        hideLegend
      />
    </details>
  );
}
