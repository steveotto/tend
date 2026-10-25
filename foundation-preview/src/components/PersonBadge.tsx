import { useLayoutEffect, useRef, useState } from 'react';
import type { Ref } from 'react';
import type { PersonId, PersonPreview } from '../domain/preview-data.ts';

export function PersonBadge({
  person,
  onSelect,
  buttonRef
}: {
  person: PersonPreview;
  onSelect: (personId: PersonId) => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className="rhythm-person-badge"
      aria-label={`Open synthetic profile for ${person.displayName}`}
      data-person-id={person.id}
      onClick={() => onSelect(person.id)}
    >
      <PersonBadgeVisual person={person} />
    </button>
  );
}

export function PersonBadgeVisual({ person }: { person: PersonPreview }) {
  return (
    <span className="person-badge-visual">
      <span className="person-badge-avatar" aria-hidden="true">
        {person.avatarUrl
          ? <img src={person.avatarUrl} alt="" />
          : <span>{personInitials(person.displayName)}</span>}
      </span>
      <span className="person-badge-name">{personFirstName(person.displayName)}</span>
    </span>
  );
}

export function PersonBadgeList({
  people,
  rhythmTitle,
  onSelect,
  itemsOnly = false,
  collapsedLimit
}: {
  people: readonly PersonPreview[];
  rhythmTitle: string;
  onSelect: (personId: PersonId) => void;
  itemsOnly?: boolean;
  collapsedLimit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const showOverflow = collapsedLimit !== undefined && people.length > Math.max(3, collapsedLimit);
  const visiblePeople = showOverflow && !expanded ? people.slice(0, collapsedLimit) : people;
  const overflowCount = showOverflow ? people.length - collapsedLimit : 0;
  const overflowButtonRef = useRef<HTMLButtonElement>(null);
  const firstRevealedPersonRef = useRef<HTMLButtonElement>(null);
  const focusFirstRevealedPerson = useRef(false);

  useLayoutEffect(() => {
    if (expanded && focusFirstRevealedPerson.current) {
      firstRevealedPersonRef.current?.focus();
      focusFirstRevealedPerson.current = false;
    }
  }, [expanded]);

  const badges = visiblePeople.map((person, index) => (
    <PersonBadge
      key={`${person.id}-${index}`}
      person={person}
      onSelect={onSelect}
      {...(expanded && showOverflow && index === collapsedLimit
        ? { buttonRef: firstRevealedPersonRef }
        : {})}
    />
  ));
  const overflowControl = showOverflow && (
    <button
      ref={overflowButtonRef}
      type="button"
      className={expanded ? 'rhythm-person-badge-show-less' : 'rhythm-person-badge-overflow'}
      aria-expanded={expanded}
      aria-label={expanded
        ? `Show fewer people associated with ${rhythmTitle}`
        : `Show ${overflowCount} more ${overflowCount === 1 ? 'person' : 'people'} associated with ${rhythmTitle}`}
      onClick={() => {
        if (!expanded) focusFirstRevealedPerson.current = true;
        setExpanded(value => !value);
      }}
    >
      {expanded ? 'Show less' : <span className="rhythm-person-badge-overflow__visual">+{overflowCount} more</span>}
    </button>
  );
  if (people.length === 0) return null;
  if (itemsOnly) return <>{badges}{overflowControl}</>;

  return (
    <div className="rhythm-person-badge-list" role="group" aria-label={`People associated with ${rhythmTitle}`}>
      {badges}
      {overflowControl}
    </div>
  );
}

function personInitials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(part => [...part][0] ?? '').join('').toLocaleUpperCase();
}

function personFirstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}
