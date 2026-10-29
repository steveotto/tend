import { syntheticPeople } from '../domain/preview-data.ts';
import type { PersonPickerGroup, PersonId } from '../domain/preview-data.ts';
import { personGroupMemberIds, setPersonGroupMembership } from '../domain/preview-data.ts';
import { PersonBadge } from './PersonBadge.tsx';

export function PeopleView({
  groups,
  onChangeGroups,
  onOpenPerson
}: {
  groups: readonly PersonPickerGroup[];
  onChangeGroups: (next: PersonPickerGroup[]) => void;
  onOpenPerson: (personId: PersonId) => void;
}) {
  const friends = new Set(personGroupMemberIds(groups, 'friends'));

  return (
    <section className="category-page people-view" aria-labelledby="people-view-title">
      <header className="category-page-heading">
        <h1 id="people-view-title">People</h1>
      </header>
      <div className="people-view__list">
        {syntheticPeople.map(person => {
          const isFriend = friends.has(person.id);
          return (
            <article key={person.id} className="people-view__row">
              <PersonBadge
                person={person}
                displayNameMode="full"
                presentation="interactive"
                onSelect={onOpenPerson}
              />
              <div className="people-view__friendship">
                {isFriend && <span className="people-view__friend-status">Friend</span>}
                <button
                  type="button"
                  aria-pressed={isFriend}
                  aria-label={`${isFriend ? 'Remove' : 'Mark'} ${person.displayName} as a friend`}
                  onClick={() => onChangeGroups(setPersonGroupMembership(groups, 'friends', person.id, !isFriend))}
                >
                  {isFriend ? 'Remove friend' : 'Mark as friend'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
