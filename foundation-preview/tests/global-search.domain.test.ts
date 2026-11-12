import { describe, expect, it } from 'vitest';
import { createFriendshipData } from '../src/domain/friendships.ts';
import type { FriendshipConnection } from '../src/domain/friendships.ts';
import type { PersonNote } from '../src/domain/person-notes.ts';
import type { PersonPrayerRequest } from '../src/domain/person-prayers.ts';
import type { PersonPreview, RhythmPreview } from '../src/domain/preview-data.ts';
import { selectGlobalSearchResults } from '../src/domain/global-search.ts';

const amy: PersonPreview = { id: 'person-amy', displayName: 'Amy Sample' };
const sam: PersonPreview = { id: 'person-sam', displayName: 'Sam Example' };

function rhythm(id: string, title: string, personIds: string[] = []): RhythmPreview {
  return {
    id,
    title,
    description: 'A sample description',
    automation: 'manual',
    status: 'Not confirmed',
    personIds,
    categoryIds: ['faith']
  };
}

function prayer(id: string, title: string, personId = amy.id): PersonPrayerRequest {
  return {
    id,
    personId,
    title,
    details: 'A sample prayer detail',
    status: 'active',
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    prayerLogs: []
  };
}

function note(id: string, content: string, personId = amy.id): PersonNote {
  return {
    id,
    personId,
    content,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z'
  };
}

function connectionNote(id: string, content: string): FriendshipConnection {
  return {
    id,
    type: 'call',
    date: '2026-11-01',
    participantIds: [amy.id, sam.id],
    notes: content
  };
}

describe('global search selector', () => {
  it('matches case-insensitive substrings in people, rhythms, prayer details, and note content', () => {
    const data = {
      people: [amy, sam],
      rhythms: [rhythm('walk', 'Take a walk')],
      prayerRequests: [prayer('prayer', 'Family', sam.id)],
      personNotes: [note('note', 'Remember the coastal trail')],
      friendships: {
        ...createFriendshipData(),
        connections: [connectionNote('connection-note', 'Ask about the new garden')]
      }
    };

    const results = selectGlobalSearchResults('COASTAL', data);
    const notesGroup = results.groups.find(group => group.id === 'notes')!;
    expect(results.isEmpty).toBe(false);
    expect(notesGroup.results.map(result => result.title)).toEqual(['Remember the coastal trail']);
    expect(notesGroup.results[0]?.kind).toBe('person-note');

    const prayerDetails = selectGlobalSearchResults('SAMPLE PRAYER DETAIL', data);
    expect(prayerDetails.groups.find(group => group.id === 'prayers')?.results[0])
      .toMatchObject({ kind: 'prayer', requestId: 'prayer' });
    expect(prayerDetails.groups.find(group => group.id === 'notes')?.results[0])
      .toMatchObject({ kind: 'prayer-note', requestId: 'prayer' });

    const connectionText = selectGlobalSearchResults('new garden', data);
    expect(connectionText.groups.find(group => group.id === 'notes')?.results[0]?.kind)
      .toBe('connection-note');

    expect(selectGlobalSearchResults('not found', data).isEmpty).toBe(true);
  });

  it('includes owning-person names when matching related records', () => {
    const results = selectGlobalSearchResults('aMy', {
      people: [amy, sam],
      rhythms: [rhythm('amy-rhythm', 'Morning walk', [amy.id])],
      prayerRequests: [prayer('amy-prayer', 'Family')],
      personNotes: [note('amy-note', 'A note without the name')],
      friendships: {
        ...createFriendshipData(),
        connections: [connectionNote('amy-connection-note', 'A call note without the name')]
      }
    });

    expect(results.groups.map(group => group.id)).toEqual(['people', 'rhythms', 'prayers', 'notes']);
    expect(results.groups.map(group => group.results.map(result => result.kind))).toEqual([
      ['person'],
      ['rhythm'],
      ['prayer'],
      ['person-note', 'connection-note']
    ]);
    expect(results.groups.find(group => group.id === 'notes')?.results[1])
      .toMatchObject({ kind: 'connection-note', personId: amy.id });
  });

  it('keeps stable group ordering, caps each group at six, and reports remaining counts', () => {
    const people = Array.from({ length: 8 }, (_, index) => ({
      id: `amy-${index}`,
      displayName: `Amy ${index}`
    }));
    const results = selectGlobalSearchResults('Amy', {
      people,
      rhythms: Array.from({ length: 8 }, (_, index) => rhythm(`rhythm-${index}`, `Amy rhythm ${index}`)),
      prayerRequests: Array.from({ length: 8 }, (_, index) => prayer(`prayer-${index}`, `Amy prayer ${index}`)),
      personNotes: Array.from({ length: 8 }, (_, index) => note(`note-${index}`, `Amy note ${index}`)),
      friendships: createFriendshipData()
    });

    expect(results.groups.map(group => group.id)).toEqual(['people', 'rhythms', 'prayers', 'notes']);
    expect(results.groups.map(group => group.results.length)).toEqual([6, 6, 6, 6]);
    expect(results.groups.map(group => group.totalCount)).toEqual([8, 8, 8, 8]);
    expect(results.groups.map(group => group.remainingCount)).toEqual([2, 2, 2, 2]);
    expect(results.groups.find(group => group.id === 'people')?.results[0]?.tag).toBe('Person');
    expect(results.groups.find(group => group.id === 'rhythms')?.results[0]?.tag).toBe('Faith');
    expect(results.groups.find(group => group.id === 'prayers')?.results[0]?.tag).toBe('Prayer');
    expect(results.groups.find(group => group.id === 'notes')?.results[0]?.tag).toBe('Note');
  });
});
