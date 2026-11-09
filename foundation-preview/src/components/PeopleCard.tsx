import type { ReactNode } from 'react';
import type { PersonId, PersonPickerGroup, PersonPreview } from '../domain/preview-data.ts';
import { resolvePersonCategory } from '../domain/person-categories.ts';
import { CategoryHealthBadge } from './Cards.tsx';
import { BirthdayCakeIcon } from './BirthdayCakeIcon.tsx';
import { personFirstName, PersonAvatar } from './PersonBadge.tsx';

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
  score,
  onSelect,
  className = '',
  identityClassName = '',
  children
}: {
  person: PersonPreview;
  classifications: readonly Pick<PersonPickerGroup, 'id' | 'label'>[];
  relationshipLabel?: string;
  relationshipTone?: PersonPickerGroup['id'];
  birthday?: PersonBirthdayPresentation;
  connectionRecency?: { date: string; label: string };
  score?: number | null;
  onSelect: (personId: PersonId) => void;
  className?: string;
  identityClassName?: string;
  children?: ReactNode;
}) {
  const displayScore = score !== null && score !== undefined && Number.isFinite(score) ? score : null;
  const relationshipGroupId = resolvePersonCategory(classifications.map(group => group.id));
  const relationshipGroup = relationshipGroupId
    ? classifications.find(group => group.id === relationshipGroupId)
    : undefined;

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
              <span className="people-card__name">{personFirstName(person.displayName)}</span>
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
          <CategoryHealthBadge
            score={displayScore}
            appearance="rounded"
            className="people-card__score"
            accessibleLabel={`Person Health ${displayScore === null ? 'unavailable' : displayScore}`}
          />
        </span>
        {(connectionRecency || relationshipGroup) && (
          <span className="people-card__meta-row">
            {connectionRecency && (
              <span className="people-card__connection-detail">
                <span className="people-card__connection-icon" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="none" focusable="false">
                    <path d="M4.25 4.75h11.5v8H9l-3.5 2.5v-2.5H4.25z" />
                    <path d="M7 8h6M7 10.5h4" />
                  </svg>
                </span>
                <span className="people-card__connection-copy">
                  <span className="people-card__connection-label">Connected</span>
                  <time className="people-card__connection-time" dateTime={connectionRecency.date}>
                    {connectionRecency.label}
                  </time>
                </span>
              </span>
            )}
            {relationshipGroup && (
              <span className="people-card__classifications" role="group" aria-label={`${person.displayName} relationship group`}>
                <span className={`people-card__classification people-card__classification--${relationshipGroup.id}`}>
                  <span aria-hidden="true" />
                  {relationshipGroup.label}
                </span>
              </span>
            )}
          </span>
        )}
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
