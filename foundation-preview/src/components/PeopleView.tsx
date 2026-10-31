import { syntheticPeople } from '../domain/preview-data.ts';
import type { PersonPickerGroup, PersonId } from '../domain/preview-data.ts';
import { personGroupMemberIds, setPersonGroupMembership } from '../domain/preview-data.ts';
import type { FriendshipData } from '../domain/friendships.ts';
import { connectionsForPerson } from '../domain/friendships.ts';
import { PeopleCard } from './PeopleCard.tsx';

export function PeopleView({
  groups,
  friendships,
  today,
  onChangeGroups,
  onOpenPerson
}: {
  groups: readonly PersonPickerGroup[];
  friendships: FriendshipData;
  today: string;
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
          const lastConnection = connectionsForPerson(friendships, person.id)[0];
          return (
            <PeopleCard
              key={person.id}
              person={person}
              classifications={groups.filter(group => group.memberIds.includes(person.id))}
              {...(lastConnection
                ? { connectionRecency: `Last connected ${formatPersonDate(lastConnection.date, today)}` }
                : {})}
              onSelect={onOpenPerson}
              className="people-view__row"
            >
              <div className="people-view__friendship">
                <button
                  type="button"
                  aria-pressed={isFriend}
                  aria-label={`${isFriend ? 'Remove' : 'Mark'} ${person.displayName} as a friend`}
                  onClick={() => onChangeGroups(setPersonGroupMembership(groups, 'friends', person.id, !isFriend))}
                >
                  {isFriend ? 'Remove friend' : 'Mark as friend'}
                </button>
              </div>
            </PeopleCard>
          );
        })}
      </div>
    </section>
  );
}

function formatPersonDate(value: string, today: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year!, month! - 1, day!, 12).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(year !== Number(today.slice(0, 4)) ? { year: 'numeric' as const } : {})
  });
}
