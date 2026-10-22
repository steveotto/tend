import type { MarriageExampleId } from '../domain/preview-data.ts';

export function MarriageExampleSelector({
  value,
  onChange
}: {
  value: MarriageExampleId;
  onChange: (value: MarriageExampleId) => void;
}) {
  return (
    <label className="marriage-example-selector">
      <span>Marriage example</span>
      <select
        value={value}
        onChange={event => onChange(event.currentTarget.value === 'empty' ? 'empty' : 'populated')}
      >
        <option value="populated">Populated example</option>
        <option value="empty">Empty example</option>
      </select>
    </label>
  );
}
