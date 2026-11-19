import { useId } from 'react';

export type CheckboxTileOption<Id extends string> = {
  id: Id;
  label: string;
};

export function CheckboxTileOptions<Id extends string>({
  options,
  selectedIds,
  onToggle,
  className,
  tileClassName
}: {
  options: readonly CheckboxTileOption<Id>[];
  selectedIds: readonly Id[];
  onToggle: (id: Id) => void;
  className?: string;
  tileClassName?: string;
}) {
  const idPrefix = useId();
  return (
    <div className={['checkbox-tile-options', className].filter(Boolean).join(' ')}>
      {options.map(option => {
        const selected = selectedIds.includes(option.id);
        const inputId = `${idPrefix}-option-${option.id}`;
        return (
          <label
            key={option.id}
            className={[
              'checkbox-tile-options__tile',
              selected ? 'is-selected' : '',
              tileClassName ?? ''
            ].filter(Boolean).join(' ')}
            htmlFor={inputId}
          >
            <input
              id={inputId}
              type="checkbox"
              name={`${idPrefix}-${option.id}`}
              checked={selected}
              onChange={() => onToggle(option.id)}
            />
            <span>{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}
