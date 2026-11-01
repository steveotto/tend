import { useEffect, useRef, useState } from 'react';
import { createSamplePeople } from '../domain/preview-data.ts';
import type { PersonPickerGroup, PersonId, PersonPickerGroupId, PersonPreview } from '../domain/preview-data.ts';
import type { FriendshipData } from '../domain/friendships.ts';
import { connectionsForPerson } from '../domain/friendships.ts';
import { PeopleCard } from './PeopleCard.tsx';
import {
  birthdayCardSummary,
  personDetailsForId
} from '../domain/person-details.ts';
import type { PersonDetails } from '../domain/person-details.ts';
import { PersonCreationDialog } from './PersonCreationDialog.tsx';

const classificationFilters: readonly { id: PersonPickerGroupId | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'marriage', label: 'Marriage' },
  { id: 'parenting', label: 'Parenting' },
  { id: 'friends', label: 'Friends' }
];

export function PeopleView({
  people = createSamplePeople(),
  groups,
  friendships,
  today,
  personDetails = [],
  onOpenPerson,
  onCreatePerson
}: {
  people?: readonly PersonPreview[];
  groups: readonly PersonPickerGroup[];
  friendships: FriendshipData;
  today: string;
  personDetails?: readonly PersonDetails[];
  onOpenPerson: (personId: PersonId) => void;
  onCreatePerson?: (person: PersonPreview, groupIds: readonly PersonPickerGroupId[]) => string | null;
}) {
  const [selectedFilter, setSelectedFilter] = useState<PersonPickerGroupId | 'all'>('all');
  const [addingPerson, setAddingPerson] = useState(false);
  const addPersonButton = useRef<HTMLButtonElement>(null);
  const wasAddingPerson = useRef(false);
  const visiblePeople = selectedFilter === 'all'
    ? people
    : people.filter(person =>
        groups.some(group => group.id === selectedFilter && group.memberIds.includes(person.id))
      );

  useEffect(() => {
    if (addingPerson) {
      wasAddingPerson.current = true;
      return;
    }
    if (wasAddingPerson.current) {
      wasAddingPerson.current = false;
      addPersonButton.current?.focus();
    }
  }, [addingPerson]);

  return (
    <main className="category-page people-view" aria-labelledby="people-view-title">
      <header className="category-page-heading">
        <h1 id="people-view-title">People</h1>
        {onCreatePerson && (
          <button
            ref={addPersonButton}
            type="button"
            className="btn mini"
            onClick={() => setAddingPerson(true)}
          >
            Add person
          </button>
        )}
      </header>
      <div className="people-view__filters" role="group" aria-label="Filter People by classification">
        {classificationFilters.map(filter => (
          <button
            key={filter.id}
            type="button"
            className={`people-view__filter people-view__filter--${filter.id}`}
            aria-pressed={selectedFilter === filter.id}
            onClick={() => setSelectedFilter(filter.id)}
          >
            {filter.id !== 'all' && <span aria-hidden="true" />}
            {filter.label}
          </button>
        ))}
      </div>
      {visiblePeople.length > 0 ? (
        <div className="people-view__list">
          {visiblePeople.map(person => {
            const lastConnection = connectionsForPerson(friendships, person.id)[0];
            const details = personDetailsForId(personDetails, person.id);
            const displayPerson = details?.photoDataUrl
              ? { ...person, avatarUrl: details.photoDataUrl }
              : person;
            const birthday = details?.birthday
              ? birthdayCardSummary(details.birthday, today) ?? undefined
              : undefined;
            const personClassifications = groups.filter(group => group.memberIds.includes(person.id));
            const tone = personClassifications[0]?.id;
            return (
              <PeopleCard
                key={person.id}
                person={displayPerson}
                classifications={personClassifications}
                {...(details?.relationshipLabel ? { relationshipLabel: details.relationshipLabel } : {})}
                {...(tone ? { relationshipTone: tone } : {})}
                {...(birthday ? { birthday } : {})}
                {...(lastConnection
                  ? { connectionRecency: formatConnectionRecency(lastConnection.date, today) }
                  : {})}
                onSelect={onOpenPerson}
                className="people-view__row"
              />
            );
          })}
        </div>
      ) : (
        <p className="people-view__empty">No people match these classifications.</p>
      )}
      {addingPerson && onCreatePerson && (
        <PersonCreationDialog
          existingPeople={people}
          onCreate={onCreatePerson}
          onClose={() => setAddingPerson(false)}
        />
      )}
    </main>
  );
}

function formatConnectionRecency(value: string, today: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const [todayYear, todayMonth, todayDay] = today.split('-').map(Number);
  const date = Date.UTC(year!, month! - 1, day!);
  const current = Date.UTC(todayYear!, todayMonth! - 1, todayDay!);
  const days = Math.floor((current - date) / 86_400_000);
  if (days < 0) return `Connected ${new Date(year!, month! - 1, day!, 12).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  if (days === 0) return 'Connected today';
  if (days === 1) return 'Connected yesterday';
  if (days < 7) return `Connected ${days} days ago`;
  if (days < 35) return `Connected ${Math.floor(days / 7)} wk ago`;
  if (days < 365) return `Connected ${Math.floor(days / 30)} mo ago`;
  return `Connected ${Math.floor(days / 365)} yr ago`;
}
