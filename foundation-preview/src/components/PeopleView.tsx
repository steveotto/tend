import { useEffect, useRef, useState } from 'react';
import { createSamplePeople } from '../domain/preview-data.ts';
import type { PersonPickerGroup, PersonId, PersonPickerGroupId, PersonPreview } from '../domain/preview-data.ts';
import type { FriendshipData } from '../domain/friendships.ts';
import {
  formatConnectionRecency,
  latestValidConnectionForPerson
} from '../domain/friendships.ts';
import { resolvePersonCategory } from '../domain/person-categories.ts';
import { PeopleCard } from './PeopleCard.tsx';
import {
  birthdayCardSummary,
  personDetailsForId,
  personWithSavedPhoto
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
  healthScores,
  onOpenPerson,
  onCreatePerson
}: {
  people?: readonly PersonPreview[];
  groups: readonly PersonPickerGroup[];
  friendships: FriendshipData;
  today: string;
  personDetails?: readonly PersonDetails[];
  healthScores?: ReadonlyMap<PersonId, number | null>;
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
            const lastConnection = latestValidConnectionForPerson(friendships, person.id);
            const connectionLabel = lastConnection
              ? formatConnectionRecency(lastConnection.date, today)
              : null;
            const details = personDetailsForId(personDetails, person.id);
            const displayPerson = personWithSavedPhoto(person, personDetails);
            const birthday = details?.birthday
              ? birthdayCardSummary(details.birthday, today) ?? undefined
              : undefined;
            const personClassifications = groups.filter(group => group.memberIds.includes(person.id));
            const tone = resolvePersonCategory(personClassifications.map(group => group.id)) ?? undefined;
            return (
              <PeopleCard
                key={person.id}
                person={displayPerson}
                classifications={personClassifications}
                {...(details?.relationshipLabel ? { relationshipLabel: details.relationshipLabel } : {})}
                {...(tone ? { relationshipTone: tone } : {})}
                {...(birthday ? { birthday } : {})}
                {...(lastConnection && connectionLabel
                  ? { connectionRecency: {
                      date: lastConnection.date,
                      label: connectionLabel
                    } }
                  : {})}
                score={healthScores?.get(person.id) ?? null}
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
