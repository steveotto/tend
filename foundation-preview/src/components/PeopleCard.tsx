import type { ReactNode } from 'react';
import type { PersonId, PersonPickerGroup, PersonPreview } from '../domain/preview-data.ts';
import { BirthdayCakeIcon } from './BirthdayCakeIcon.tsx';
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
  className = '',
  identityClassName = '',
  connectionClassName = '',
  children
}: {
  person: PersonPreview;
  classifications: readonly Pick<PersonPickerGroup, 'id' | 'label'>[];
  relationshipLabel?: string;
  relationshipTone?: PersonPickerGroup['id'];
  birthday?: PersonBirthdayPresentation;
  connectionRecency?: string;
  onSelect: (personId: PersonId) => void;
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
            {birthday?.age !== undefined && <strong className="people-card__age">Age {birthday.age}</strong>}
            {birthday && (
              <span className="people-card__birthday">
                <BirthdayCakeIcon />
                <span className="people-card__birthday-date">{birthday.dateLabel}</span>
                <span className="people-card__birthday-separator" aria-hidden="true">•</span>
                <span className="people-card__birthday-countdown">{birthday.countdownLabel}</span>
              </span>
            )}
          </span>
        )}
      </button>
      {children && <div className="people-card__actions">{children}</div>}
    </article>
  );
}
