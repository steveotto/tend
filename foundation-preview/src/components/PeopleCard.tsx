import type { ReactNode } from 'react';
import type { PersonId, PersonPickerGroup, PersonPreview } from '../domain/preview-data.ts';
import type { areas } from '../domain/preview-data.ts';
import { PersonBadge } from './PersonBadge.tsx';
import { AreaIcon } from './AreaIcon.tsx';

type AreaId = (typeof areas)[number]['id'];

export function PeopleCard({
  person,
  classifications,
  relationshipLabel,
  connectionRecency,
  onSelect,
  className = '',
  identityClassName = '',
  connectionClassName = '',
  children
}: {
  person: PersonPreview;
  classifications: readonly Pick<PersonPickerGroup, 'id' | 'label'>[];
  relationshipLabel?: string;
  connectionRecency?: string;
  onSelect: (personId: PersonId) => void;
  className?: string;
  identityClassName?: string;
  connectionClassName?: string;
  children?: ReactNode;
}) {
  return (
    <article className={`people-card ${className}`.trim()}>
      <div className={`people-card__identity ${identityClassName}`.trim()}>
        <PersonBadge
          person={person}
          displayNameMode="full"
          onSelect={onSelect}
        />
        {relationshipLabel && <p className="people-card__relationship">{relationshipLabel}</p>}
        {classifications.length > 0 && (
          <div
            className="people-card__classifications"
            role="group"
            aria-label={`${person.displayName} classifications`}
          >
            {classifications.map(group => (
              <span className="people-card__classification" key={group.id}>
                <AreaIcon id={areaForGroup(group.id)} />
                {group.label}
              </span>
            ))}
          </div>
        )}
        {connectionRecency && (
          <p className={`people-card__connection ${connectionClassName}`.trim()}>{connectionRecency}</p>
        )}
      </div>
      {children && <div className="people-card__actions">{children}</div>}
    </article>
  );
}

function areaForGroup(groupId: PersonPickerGroup['id']): AreaId {
  return groupId === 'friends' ? 'friendships' : groupId;
}
