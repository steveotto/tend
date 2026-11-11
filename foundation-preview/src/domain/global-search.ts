import { areas } from './preview-data.ts';
import type { PersonId, PersonPreview, RhythmPreview } from './preview-data.ts';
import type { FriendshipData, FriendshipConnection } from './friendships.ts';
import type { PersonNote } from './person-notes.ts';
import type { PersonPrayerRequest } from './person-prayers.ts';

export type GlobalSearchGroupId = 'people' | 'rhythms' | 'prayers' | 'notes';

type SearchResultBase = {
  key: string;
  group: GlobalSearchGroupId;
  title: string;
  subtitle: string;
  tag: string;
  matchedContent?: string;
};

export type GlobalSearchResult =
  | (SearchResultBase & {
      kind: 'person';
      group: 'people';
      personId: PersonId;
    })
  | (SearchResultBase & {
      kind: 'rhythm';
      group: 'rhythms';
      rhythmId: string;
    })
  | (SearchResultBase & {
      kind: 'prayer';
      group: 'prayers';
      requestId: string;
      personId: PersonId;
    })
  | (SearchResultBase & {
      kind: 'person-note';
      group: 'notes';
      noteId: string;
      personId: PersonId;
    })
  | (SearchResultBase & {
      kind: 'prayer-note';
      group: 'notes';
      requestId: string;
      personId: PersonId;
    })
  | (SearchResultBase & {
      kind: 'connection-note';
      group: 'notes';
      connectionId: string;
      personId: PersonId;
    });

export type GlobalSearchResultGroup = {
  id: GlobalSearchGroupId;
  label: string;
  results: readonly GlobalSearchResult[];
  allResults: readonly GlobalSearchResult[];
  totalCount: number;
  remainingCount: number;
};

export type GlobalSearchSelection = {
  groups: readonly GlobalSearchResultGroup[];
  hasQuery: boolean;
  isEmpty: boolean;
  visibleResults: readonly GlobalSearchResult[];
};

export type GlobalSearchData = {
  people: readonly PersonPreview[];
  rhythms: readonly RhythmPreview[];
  prayerRequests: readonly PersonPrayerRequest[];
  personNotes: readonly PersonNote[];
  friendships: FriendshipData;
};

const groupDefinitions: readonly { id: GlobalSearchGroupId; label: string }[] = [
  { id: 'people', label: 'People' },
  { id: 'rhythms', label: 'Rhythms' },
  { id: 'prayers', label: 'Prayers' },
  { id: 'notes', label: 'Notes' }
];

const resultsPerGroup = 6;

const connectionTypeLabels: Record<FriendshipConnection['type'], string> = {
  text: 'Text',
  call: 'Call',
  'time-together': 'Time Together'
};

function normalized(value: string): string {
  return value.toLocaleLowerCase();
}

function matches(query: string, ...values: (string | undefined)[]): boolean {
  return values.some(value => value !== undefined && normalized(value).includes(query));
}

function personName(personsById: ReadonlyMap<PersonId, PersonPreview>, personId: PersonId): string | undefined {
  return personsById.get(personId)?.displayName;
}

function noteTitle(content: string): string {
  const excerpt = content.trim().replace(/\s+/g, ' ');
  return excerpt.length > 96 ? `${excerpt.slice(0, 93)}…` : excerpt;
}

function createGroup(
  id: GlobalSearchGroupId,
  label: string,
  allResults: readonly GlobalSearchResult[]
): GlobalSearchResultGroup {
  return {
    id,
    label,
    results: allResults.slice(0, resultsPerGroup),
    allResults,
    totalCount: allResults.length,
    remainingCount: Math.max(0, allResults.length - resultsPerGroup)
  };
}

export function selectGlobalSearchResults(
  input: string,
  data: GlobalSearchData
): GlobalSearchSelection {
  const query = normalized(input.trim());
  const hasQuery = query.length > 0;
  if (!hasQuery) {
    return {
      groups: groupDefinitions.map(group => createGroup(group.id, group.label, [])),
      hasQuery: false,
      isEmpty: false,
      visibleResults: []
    };
  }

  const peopleById = new Map(data.people.map(person => [person.id, person]));
  const groupResults: Record<GlobalSearchGroupId, GlobalSearchResult[]> = {
    people: [],
    rhythms: [],
    prayers: [],
    notes: []
  };

  for (const person of data.people) {
    if (!matches(query, person.displayName)) continue;
    groupResults.people.push({
      key: `person:${person.id}`,
      kind: 'person',
      group: 'people',
      personId: person.id,
      title: person.displayName,
      subtitle: 'Person',
      tag: 'Person'
    });
  }

  for (const rhythm of data.rhythms) {
    const associatedNames = (rhythm.personIds ?? [])
      .map(id => personName(peopleById, id))
      .filter((name): name is string => name !== undefined);
    const categoryLabels = (rhythm.categoryIds ?? []).flatMap(id => {
      const area = areas.find(candidate => candidate.id === id);
      return area ? [area.label] : [];
    });
    if (!matches(query, rhythm.title, ...associatedNames, ...categoryLabels)) continue;
    groupResults.rhythms.push({
      key: `rhythm:${rhythm.id}`,
      kind: 'rhythm',
      group: 'rhythms',
      rhythmId: rhythm.id,
      title: rhythm.title,
      subtitle: associatedNames.join(', ') || categoryLabels.join(', ') || 'Rhythm',
      tag: categoryLabels[0] ?? 'Rhythm'
    });
  }

  for (const request of data.prayerRequests) {
    const ownerName = personName(peopleById, request.personId);
    if (!matches(query, request.title, request.details, ownerName)) continue;
    groupResults.prayers.push({
      key: `prayer:${request.id}`,
      kind: 'prayer',
      group: 'prayers',
      requestId: request.id,
      personId: request.personId,
      title: request.title,
      subtitle: ownerName ?? 'Prayer request',
      tag: 'Prayer',
      ...(request.details && matches(query, request.details) ? { matchedContent: request.details } : {})
    });
    if (request.details && matches(query, request.details)) {
      groupResults.notes.push({
        key: `prayer-note:${request.id}`,
        kind: 'prayer-note',
        group: 'notes',
        requestId: request.id,
        personId: request.personId,
        title: noteTitle(request.details),
        subtitle: ownerName ?? 'Prayer note',
        tag: 'Prayer note'
      });
    }
  }

  for (const note of data.personNotes) {
    const ownerName = personName(peopleById, note.personId);
    if (!matches(query, note.content, ownerName)) continue;
    groupResults.notes.push({
      key: `person-note:${note.id}`,
      kind: 'person-note',
      group: 'notes',
      noteId: note.id,
      personId: note.personId,
      title: noteTitle(note.content),
      subtitle: ownerName ?? 'Person note',
      tag: 'Note'
    });
  }

  for (const connection of data.friendships.connections) {
    if (!connection.notes) continue;
    const participantNames = connection.participantIds
      .map(id => personName(peopleById, id))
      .filter((name): name is string => name !== undefined);
    if (!matches(query, connection.notes, ...participantNames)) continue;
    const ownerId = connection.participantIds.find(id =>
      matches(query, personName(peopleById, id))
    ) ?? connection.participantIds[0];
    if (!ownerId) continue;
    groupResults.notes.push({
      key: `connection-note:${connection.id}`,
      kind: 'connection-note',
      group: 'notes',
      connectionId: connection.id,
      personId: ownerId,
      title: noteTitle(connection.notes),
      subtitle: `${connectionTypeLabels[connection.type]} · ${participantNames.join(', ') || 'Connection'}`,
      tag: 'Note'
    });
  }

  const groups = groupDefinitions.map(group =>
    createGroup(group.id, group.label, groupResults[group.id])
  );
  const visibleResults = groups.flatMap(group => group.results);
  return {
    groups,
    hasQuery,
    isEmpty: visibleResults.length === 0,
    visibleResults
  };
}
