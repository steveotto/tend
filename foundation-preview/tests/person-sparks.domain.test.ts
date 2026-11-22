import { describe, expect, it } from 'vitest';
import { analyzeLegacyTendImport } from '../src/domain/legacy-import.ts';
import {
  completePersonSpark,
  createPersonSpark,
  deletePersonConnection,
  deletePersonSpark,
  savePersonConnection,
  setPersonSparkArchived,
  undoPersonSparkCompletion,
  updatePersonSpark,
  validatePersonSparkConnectionLinks,
  validatePersonSparksCollection
} from '../src/domain/person-sparks.ts';
import type { PersonSpark } from '../src/domain/person-sparks.ts';
import { createFriendshipData } from '../src/domain/friendships.ts';
import type { FriendshipConnection } from '../src/domain/friendships.ts';

const ownerId = 'sample-person-avery';
const sharedId = 'sample-person-morgan';
const connection: FriendshipConnection = {
  id: 'connection-from-spark',
  type: 'time-together',
  date: '2026-10-28',
  time: '18:30',
  participantIds: [ownerId, sharedId]
};

function pendingSpark(overrides: Partial<PersonSpark> = {}): PersonSpark {
  return {
    id: 'spark-one',
    ownerId,
    title: 'Visit the garden',
    description: 'Walk through the botanical garden.',
    sharedWith: [sharedId],
    archived: false,
    completed: false,
    completionHistory: [],
    ...overrides
  };
}

describe('person Sparks', () => {
  it('creates and edits one-off Sparks without changing connections or timing metadata', () => {
    const created = createPersonSpark([], ownerId, {
      title: '  Go to the market  ',
      description: '  Try the new bakery.  ',
      sharedWith: [sharedId, sharedId, ownerId]
    }, 'spark-created');

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value[0]).toMatchObject({
      id: 'spark-created',
      title: 'Go to the market',
      description: 'Try the new bakery.',
      sharedWith: [sharedId],
      archived: false,
      completed: false,
      completionHistory: []
    });

    const original = pendingSpark({
      legacyTiming: { by: '2026-12-01', time: 'Evening' },
      legacyAreas: ['marriage'],
      legacyData: { oldField: 'preserved' }
    });
    const updated = updatePersonSpark([original], original.id, {
      title: '  Visit the gallery ',
      sharedWith: []
    }, [ownerId, sharedId]);
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value[0]).toMatchObject({
      title: 'Visit the gallery',
      sharedWith: [],
      legacyTiming: original.legacyTiming,
      legacyAreas: original.legacyAreas,
      legacyData: original.legacyData
    });
    expect(createFriendshipData().connections).toEqual([]);
  });

  it('archives without scoring, then completes exactly once from a saved connection and undoes explicitly', () => {
    const spark = pendingSpark();
    const archived = setPersonSparkArchived([spark], spark.id, true);
    expect(archived[0]?.completed).toBe(false);
    expect(createFriendshipData().connections).toEqual([]);

    const completed = completePersonSpark([spark], createFriendshipData(), spark.id, connection);
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;
    expect(completed.value.sparks[0]?.completed).toBe(true);
    expect(completed.value.friendships.connections).toEqual([{
      ...connection,
      sparkId: spark.id,
      sparkOwnerId: ownerId
    }]);
    expect(validatePersonSparkConnectionLinks(completed.value.sparks, completed.value.friendships)).toBe(true);
    expect(completePersonSpark(completed.value.sparks, completed.value.friendships, spark.id, {
      ...connection,
      id: 'second-connection'
    })).toMatchObject({ ok: false });

    const undone = undoPersonSparkCompletion(
      completed.value.sparks,
      completed.value.friendships,
      spark.id
    );
    expect(undone.ok).toBe(true);
    if (!undone.ok) return;
    expect(undone.value.sparks[0]?.completed).toBe(false);
    expect(undone.value.sparks[0]?.completionHistory[0]).toMatchObject({
      source: 'connection',
      connectionId: connection.id,
      undone: true
    });
    expect(undone.value.friendships.connections).toEqual([]);
    expect(validatePersonSparkConnectionLinks(undone.value.sparks, undone.value.friendships)).toBe(true);
  });

  it('keeps a linked connection as an ordinary connection when its Spark is deleted', () => {
    const completed = completePersonSpark([pendingSpark()], createFriendshipData(), 'spark-one', connection);
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;

    const deleted = deletePersonSpark(completed.value.sparks, completed.value.friendships, 'spark-one', ownerId);
    expect(deleted.ok).toBe(true);
    if (!deleted.ok) return;
    expect(deleted.value.sparks).toEqual([]);
    expect(deleted.value.friendships.connections).toEqual([connection]);
    expect(validatePersonSparkConnectionLinks(deleted.value.sparks, deleted.value.friendships)).toBe(true);
  });

  it('keeps linked edits in sync and restores a Spark to pending when the connection is deleted', () => {
    const completed = completePersonSpark([pendingSpark()], createFriendshipData(), 'spark-one', connection);
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;
    const edited = savePersonConnection(completed.value.sparks, completed.value.friendships, {
      ...connection,
      date: '2026-10-29',
      time: '19:00'
    });
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.value.sparks[0]?.completionHistory[0]).toMatchObject({
      date: '2026-10-29',
      time: '19:00'
    });

    const deleted = deletePersonConnection(
      edited.value.sparks,
      edited.value.friendships,
      connection.id
    );
    expect(deleted.ok).toBe(true);
    if (!deleted.ok) return;
    expect(deleted.value.sparks[0]?.completed).toBe(false);
    expect(deleted.value.sparks[0]?.completionHistory[0]?.undone).toBe(true);
    expect(deleted.value.friendships.connections).toEqual([]);
  });

  it('validates distinct source-event completions and rejects broken connection links', () => {
    const imported = pendingSpark({
      completed: true,
      completionHistory: [{
        id: 'legacy-event-1',
        source: 'legacy',
        legacyEventId: 'legacy-event-1',
        completedAt: '2026-10-28T18:30:00.000Z',
        date: '2026-10-28',
        time: '18:30',
        participantIds: [ownerId, sharedId]
      }]
    });
    expect(validatePersonSparksCollection([imported], [ownerId, sharedId])).toBe(true);
    expect(validatePersonSparkConnectionLinks([imported], createFriendshipData())).toBe(true);
    expect(validatePersonSparkConnectionLinks([pendingSpark({
      completed: true,
      completionHistory: [{
        id: 'missing-link',
        source: 'connection',
        date: '2026-10-28',
        connectionId: 'missing-connection'
      }]
    })], createFriendshipData())).toBe(false);
  });
});

describe('Classic Spark import', () => {
  it('preserves one-off Spark data, shared people, completion timestamps, and source event links without scoring them', () => {
    const timestamp = Date.parse('2026-10-28T18:30:00.000Z');
    const source = JSON.stringify({
      people: [
        {
          id: 'owner-one',
          name: 'Taylor Example',
          sparks: [{
            id: 'spark-one',
            text: 'Visit the garden',
            details: 'See the autumn flowers.',
            sharedWith: ['person-two'],
            areas: ['marriage'],
            by: '2026-12-01',
            time: 'Evening',
            done: true,
            doneTs: timestamp,
            customLegacyField: 'retain'
          }]
        },
        { id: 'person-two', name: 'Jordan Example' }
      ],
      events: [{
        id: 'spark-event-one',
        type: 'quality',
        ts: timestamp,
        personId: 'owner-one',
        personIds: ['owner-one', 'person-two'],
        origin: 'spark',
        sparkId: 'spark-one',
        sparkOwnerId: 'owner-one',
        note: 'Spark landed'
      }]
    });

    const result = analyzeLegacyTendImport(source, '2026-10-31');
    expect(result.report.source.sparks).toBe(1);
    expect(result.report.supported.sparks).toBe(1);
    expect(result.report.ambiguous).toEqual([]);
    expect(result.report.invalid).toEqual([]);
    expect(result.candidate?.personSparks).toEqual([{
      id: 'spark-one',
      ownerId: result.candidate?.people[0]?.id,
      title: 'Visit the garden',
      description: 'See the autumn flowers.',
      sharedWith: ['person-two'],
      archived: false,
      completed: true,
      completionHistory: [{
        id: 'legacy-spark-completion-spark-event-one',
        source: 'legacy',
        date: '2026-10-28',
        time: '18:30',
        completedAt: '2026-10-28T18:30:00.000Z',
        legacyEventId: 'spark-event-one',
        participantIds: ['owner-one', 'person-two']
      }],
      legacyTiming: { by: '2026-12-01', time: 'Evening' },
      legacyAreas: ['marriage'],
      legacyData: expect.objectContaining({ customLegacyField: 'retain' })
    }]);
    expect(result.candidate?.friendships.connections).toEqual([]);
    expect(result.candidate && validatePersonSparksCollection(
      result.candidate.personSparks,
      result.candidate.people.map(person => person.id)
    )).toBe(true);
  });

  it('reports unresolved people and malformed Spark data and retains exact source text in recovery', () => {
    const source = JSON.stringify({
      people: [{
        id: 'owner-one',
        name: 'Taylor Example',
        sparks: [{
          id: 'spark-one',
          text: 'Call a friend',
          sharedWith: ['missing-person'],
          done: false
        }]
      }]
    });
    const result = analyzeLegacyTendImport(source, '2026-10-31');
    expect(result.candidate).toBeNull();
    expect(result.report.ambiguous).toContainEqual({
      path: '/people/0/sparks/0/sharedWith',
      count: 1
    });
    expect(JSON.parse(result.recoveryPackage)).toMatchObject({ sourceText: source });
  });
});
