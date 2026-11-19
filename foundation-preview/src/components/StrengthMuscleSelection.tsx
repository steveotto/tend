import { strengthMuscles } from '../domain/strength.ts';
import type { StrengthMuscleId } from '../domain/strength.ts';
import { CheckboxTileOptions } from './CheckboxTileOptions.tsx';

export function StrengthMuscleSelection({
  selectedMuscleIds,
  onToggle,
  legendLabel = 'Muscles trained',
  hideLegend = false
}: {
  selectedMuscleIds: readonly StrengthMuscleId[];
  onToggle: (muscleId: StrengthMuscleId) => void;
  legendLabel?: string;
  hideLegend?: boolean;
}) {
  return (
    <fieldset className="strength-muscle-selection">
      <legend className={hideLegend ? 'visually-hidden' : undefined}>{legendLabel}</legend>
      <CheckboxTileOptions
        options={strengthMuscles.map(muscle => ({ id: muscle.id, label: muscle.name }))}
        selectedIds={selectedMuscleIds}
        onToggle={onToggle}
        tileClassName="strength-muscle-selection__tile"
      />
    </fieldset>
  );
}
