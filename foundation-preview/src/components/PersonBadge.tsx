import type { PersonId, PersonPreview } from '../domain/preview-data.ts';

export function PersonBadge({
  person,
  onSelect
}: {
  person: PersonPreview;
  onSelect: (personId: PersonId) => void;
}) {
  return (
    <button
      type="button"
      className="rhythm-person-badge"
      aria-label={`Open synthetic profile for ${person.displayName}`}
      data-person-id={person.id}
      onClick={() => onSelect(person.id)}
    >
      <span className="person-badge-visual">
        <span className="person-badge-avatar" aria-hidden="true">
          {person.avatarUrl
            ? <img src={person.avatarUrl} alt="" />
            : <span>{personInitials(person.displayName)}</span>}
        </span>
        <span className="person-badge-name">{personFirstName(person.displayName)}</span>
      </span>
    </button>
  );
}

export function PersonBadgeList({
  people,
  rhythmTitle,
  onSelect
}: {
  people: readonly PersonPreview[];
  rhythmTitle: string;
  onSelect: (personId: PersonId) => void;
}) {
  if (people.length === 0) return null;
  return (
    <div className="rhythm-person-badge-list" role="group" aria-label={`People associated with ${rhythmTitle}`}>
      {people.map(person => (
        <PersonBadge key={person.id} person={person} onSelect={onSelect} />
      ))}
    </div>
  );
}

function personInitials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(part => [...part][0] ?? '').join('').toLocaleUpperCase();
}

function personFirstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}
