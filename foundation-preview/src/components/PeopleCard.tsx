import type { ReactNode } from 'react';
import type { MouseEvent } from 'react';
import type { PersonId, PersonPickerGroup, PersonPickerGroupId, PersonPreview } from '../domain/preview-data.ts';
import { PersonAvatar } from './PersonBadge.tsx';

type PersonBirthdayPresentation = {
  dateLabel: string;
  countdownLabel: string;
  age?: number;
};

export function PeopleCard({
  person,
  classifications,
  relationshipLabel,
  relationshipTone,
  birthday,
  connectionRecency,
  onSelect,
  onToggleClassification,
  onEditPerson,
  className = '',
  identityClassName = '',
  connectionClassName = '',
  children
}: {
  person: PersonPreview;
  classifications: readonly Pick<PersonPickerGroup, 'id' | 'label'>[];
  relationshipLabel?: string;
  relationshipTone?: PersonPickerGroupId;
  birthday?: PersonBirthdayPresentation;
  connectionRecency?: string;
  onSelect: (personId: PersonId) => void;
  onToggleClassification?: (groupId: PersonPickerGroupId, selected: boolean) => void;
  onEditPerson?: (personId: PersonId, event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  identityClassName?: string;
  connectionClassName?: string;
  children?: ReactNode;
}) {
  return (
    <article className={`people-card ${className}`.trim()}>
      <button
        type="button"
        className={`people-card__open ${identityClassName}`.trim()}
        aria-label={`Open profile for ${person.displayName}`}
        onClick={() => onSelect(person.id)}
      >
        <span className="people-card__header">
          <span className="people-card__identity">
            <PersonAvatar person={person} />
            <span className="people-card__identity-copy">
              <span className="people-card__name">{person.displayName}</span>
              {relationshipLabel && (
                <span className="people-card__relationship">
                  {relationshipTone && (
                    <span
                      className={`people-card__relationship-dot people-card__relationship-dot--${relationshipTone}`}
                      aria-hidden="true"
                    />
                  )}
                  {relationshipLabel}
                </span>
              )}
            </span>
          </span>
          <span className="people-card__score" aria-label="Person score unavailable">—</span>
        </span>
        <span className="people-card__health">
          <span className="people-card__health-track" aria-hidden="true" />
          <span className="people-card__health-status">Score unavailable</span>
        </span>
        <span className="people-card__connection-block">
          <span className="people-card__meta-row">
            <span className={`people-card__connection ${connectionClassName}`.trim()}>
              {connectionRecency ?? 'No connections yet'}
            </span>
            {classifications.length > 0 && (
              <span className="people-card__classifications" role="group" aria-label={`${person.displayName} classifications`}>
                {classifications.map(group => (
                  <span className={`people-card__classification people-card__classification--${group.id}`} key={group.id}>
                    <span aria-hidden="true" />
                    {group.label}
                  </span>
                ))}
              </span>
            )}
          </span>
        </span>
        {(birthday?.age !== undefined || birthday) && (
          <span className="people-card__birthday-footer">
            {birthday?.age !== undefined && <span className="people-card__age">Age {birthday.age}</span>}
            {birthday && (
              <span className="people-card__birthday">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" />
                  <path d="M8 13h2m4 0h2m-8 4h2m4 0h2" />
                </svg>
                <span className="people-card__birthday-date">{birthday.dateLabel}</span>
                <span className="people-card__birthday-countdown">{birthday.countdownLabel}</span>
              </span>
            )}
          </span>
        )}
      </button>
      {(onToggleClassification || onEditPerson) && (
        <details className="people-card__menu">
          <summary aria-label={`More actions for ${person.displayName}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="5" cy="12" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="19" cy="12" r="1.5" />
            </svg>
          </summary>
          <div className="people-card__menu-content">
            {onEditPerson && (
            <button
              type="button"
              aria-label={`Edit details for ${person.displayName}`}
              onClick={event => onEditPerson(person.id, event)}
            >
              Edit details
            </button>
            )}
            {onToggleClassification && (
              <>
                <span className="people-card__menu-label">Classifications</span>
                {(['marriage', 'parenting', 'friends'] as const).map(groupId => {
                  const group = classifications.find(item => item.id === groupId);
                  const selected = group !== undefined;
                  const label = group?.label ?? classificationLabel(groupId);
                  return (
                    <button
                      key={groupId}
                      type="button"
                      aria-pressed={selected}
                      onClick={event => {
                        onToggleClassification(groupId, !selected);
                        const menu = event.currentTarget.closest('details');
                        if (menu) menu.open = false;
                      }}
                    >
                      {selected ? 'Remove' : 'Add'} {label}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </details>
      )}
      {children && <div className="people-card__actions">{children}</div>}
    </article>
  );
}

function classificationLabel(groupId: PersonPickerGroupId): string {
  if (groupId === 'marriage') return 'Marriage';
  if (groupId === 'parenting') return 'Parenting';
  return 'Friends';
}
