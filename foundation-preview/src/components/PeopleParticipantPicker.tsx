import type { PersonId, PersonPreview } from '../domain/preview-data.ts';
import { PersonBadgeVisual } from './PersonBadge.tsx';

export function PeopleParticipantPicker({
  people,
  selectedIds,
  onChange,
  legend = 'Actual participants'
}: {
  people: readonly PersonPreview[];
  selectedIds: readonly PersonId[];
  onChange: (personId: PersonId, selected: boolean) => void;
  legend?: string;
}) {
  return (
    <fieldset className="friendships-participants">
      <legend>{legend}</legend>
      {people.length === 0
        ? <p className="friendships-participants__empty" role="status">No People are available for this Rhythm.</p>
        : people.map(person => (
          <label key={person.id}>
            <input
              type="checkbox"
              aria-label={person.displayName}
              checked={selectedIds.includes(person.id)}
              onChange={event => onChange(person.id, event.currentTarget.checked)}
            />
            <PersonBadgeVisual person={person} />
          </label>
        ))}
    </fieldset>
  );
}
