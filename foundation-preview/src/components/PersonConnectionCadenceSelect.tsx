import type { ConnectionCadence } from '../domain/friendships.ts';
import { StyledSelect } from './StyledSelect.tsx';
import type { StyledSelectOption } from './StyledSelect.tsx';

export const connectionCadenceOptions: readonly StyledSelectOption<string>[] = [
  { value: 'none', label: 'No cadence' },
  { value: 'daily', label: 'Daily' },
  { value: 'twice-weekly', label: 'Twice weekly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'two-weeks', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' }
];

export function PersonConnectionCadenceSelect({
  id,
  value,
  onChange
}: {
  id: string;
  value: ConnectionCadence | null;
  onChange: (value: ConnectionCadence | null) => void;
}) {
  return (
    <StyledSelect
      id={id}
      label="Connection cadence"
      options={connectionCadenceOptions}
      value={value ?? 'none'}
      onChange={next => onChange(next === 'none' ? null : next as ConnectionCadence)}
    />
  );
}
