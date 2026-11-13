import type { PreviewTextSize } from '../domain/preview-state.ts';

const sizes: { value: PreviewTextSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' }
];

export function TextSizeSettings({
  value,
  onChange
}: {
  value: PreviewTextSize;
  onChange: (value: PreviewTextSize) => void;
}) {
  return (
    <fieldset className="settings-text-size">
      <legend>Text size</legend>
      <p>Adjust text throughout this Preview.</p>
      <div className="settings-text-size__options">
        {sizes.map(size => (
          <label
            key={size.value}
            className={`settings-text-size__option${value === size.value ? ' settings-text-size__option--selected' : ''}`}
          >
            <input
              type="radio"
              name="preview-text-size"
              value={size.value}
              checked={value === size.value}
              onChange={() => onChange(size.value)}
            />
            <span>{size.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
