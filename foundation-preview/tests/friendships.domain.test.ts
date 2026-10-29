import { describe, expect, it } from 'vitest';
import {
  addConnectionCadence,
  addOrUpdateConnection,
  connectionsForPerson,
  createFriendshipData,
  deleteConnection,
  friendConnectionStatus,
  selectFriendStatuses,
  migrateLegacyFriendshipDataV19,
  setFriendCadence,
  validateFriendshipData,
  validateLegacyFriendshipDataV19
} from '../src/domain/friendships.ts';
import type { FriendshipConnection } from '../src/domain/friendships.ts';
import { localDateInTimeZone } from '../src/domain/rhythm-occurrences.ts';
import {
  createPersonPickerGroups,
  migrateLegacyFriendIdsIntoPeopleGroups,
  personGroupMemberIds,
  setPersonGroupMembership
} from '../src/domain/preview-data.ts';
import type { PersonId } from '../src/domain/preview-data.ts';

const avery: PersonId = 'sample-person-avery';
const morgan: PersonId = 'sample-person-morgan';
const jordan: PersonId = 'sample-person-jordan';

function event(
  id: string,
  date: string,
  participantIds: FriendshipConnection['participantIds'],
  extra: Partial<FriendshipConnection> = {}
): FriendshipConnection {
  return { id, type: 'text', date, participantIds, ...extra };
}

describe('Friendships cadence and connection history', () => {
  it('starts a new cadence from its explicit set date and applies an inclusive due-date boundary', () => {
    const data = setFriendCadence(createFriendshipData(), avery, 'weekly', '2026-03-01');

    expect(friendConnectionStatus(data, avery, '2026-03-07')).toMatchObject({
      cadence: 'weekly',
      lastConnection: null,
      nextDueDate: '2026-03-08',
      due: false
    });
    expect(friendConnectionStatus(data, avery, '2026-03-08').due).toBe(true);
    expect(friendConnectionStatus(data, avery, '2026-03-09').due).toBe(true);
  });

  it('keeps No cadence distinct from caught-up cadence state', () => {
    const data = createFriendshipData();
    expect(friendConnectionStatus(data, avery, '2026-03-01')).toMatchObject({
      cadence: null,
      nextDueDate: null,
      due: false
    });
    expect(selectFriendStatuses(data, [avery], '2026-03-01')).toHaveLength(1);
  });

  it('uses the latest actual connection as anchor and cadence changes do not rewrite history', () => {
    let data = setFriendCadence(createFriendshipData(), avery, 'monthly', '2026-01-01');
    const connection = event('event-1', '2026-01-31', [avery], { notes: 'Original note' });
    data = addOrUpdateConnection(data, connection);

    expect(friendConnectionStatus(data, avery, '2026-02-28').nextDueDate).toBe('2026-02-28');
    data = setFriendCadence(data, avery, 'weekly', '2026-02-10');
    expect(data.connections).toEqual([connection]);
    expect(friendConnectionStatus(data, avery, '2026-02-07')).toMatchObject({
      nextDueDate: '2026-02-07',
      due: true
    });
  });

  it('adds elapsed intervals by local calendar date with safe month-end handling', () => {
    expect(addConnectionCadence('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(addConnectionCadence('2028-01-31', 'monthly')).toBe('2028-02-29');
    expect(addConnectionCadence('2026-12-31', 'monthly')).toBe('2027-01-31');
    expect(addConnectionCadence('2026-02-28', 'two-weeks')).toBe('2026-03-14');
    expect(addConnectionCadence('not-a-date', 'weekly')).toBeNull();
  });

  it('uses timezone-local dates across DST without treating an elapsed week as fixed milliseconds', () => {
    const beforeDstInNewYork = localDateInTimeZone(
      new Date('2026-03-08T04:30:00.000Z'),
      'America/New_York'
    );
    const afterDstInNewYork = localDateInTimeZone(
      new Date('2026-03-08T08:30:00.000Z'),
      'America/New_York'
    );
    expect(beforeDstInNewYork).toBe('2026-03-07');
    expect(afterDstInNewYork).toBe('2026-03-08');
    expect(addConnectionCadence(afterDstInNewYork, 'weekly')).toBe('2026-03-15');
  });

  it('stores one group event and derives histories only for its actual participants', () => {
    let data = createFriendshipData();
    const shared = event('group-event', '2026-04-04', [avery, morgan]);
    data = addOrUpdateConnection(data, shared);

    expect(connectionsForPerson(data, avery)).toEqual([shared]);
    expect(connectionsForPerson(data, morgan)).toEqual([shared]);
    expect(connectionsForPerson(data, jordan)).toEqual([]);
    expect(friendConnectionStatus(data, avery, '2026-04-05').lastConnection).toEqual(shared);
    expect(friendConnectionStatus(data, morgan, '2026-04-05').lastConnection).toEqual(shared);
    expect(friendConnectionStatus(data, jordan, '2026-04-05').lastConnection).toBeNull();
  });

  it('sorts same-day history deterministically, using time then stable identity', () => {
    let data = createFriendshipData();
    data = addOrUpdateConnection(data, event('event-a', '2026-05-01', [avery], { time: '10:00' }));
    data = addOrUpdateConnection(data, event('event-c', '2026-05-01', [avery], { time: '11:00' }));
    data = addOrUpdateConnection(data, event('event-b', '2026-05-01', [avery], { time: '11:00' }));
    expect(connectionsForPerson(data, avery).map(record => record.id))
      .toEqual(['event-c', 'event-b', 'event-a']);
    expect(friendConnectionStatus(data, avery, '2026-05-01').lastConnection?.id).toBe('event-c');
  });

  it('updates and deletes a shared event once, recalculating all participant histories', () => {
    let data = addOrUpdateConnection(
      createFriendshipData(),
      event('stable-event-id', '2026-06-01', [avery, morgan], { notes: 'Before edit' })
    );
    data = addOrUpdateConnection(data, {
      ...data.connections[0]!,
      date: '2026-06-03',
      participantIds: [avery],
      notes: 'After edit'
    });
    expect(data.connections).toHaveLength(1);
    expect(data.connections[0]).toMatchObject({
      id: 'stable-event-id',
      date: '2026-06-03',
      participantIds: [avery],
      notes: 'After edit'
    });
    expect(connectionsForPerson(data, morgan)).toEqual([]);
    expect(friendConnectionStatus(data, avery, '2026-06-04').lastConnection?.date)
      .toBe('2026-06-03');

    data = deleteConnection(data, 'stable-event-id');
    expect(data.connections).toEqual([]);
    expect(connectionsForPerson(data, avery)).toEqual([]);
  });

  it('anchors a first cadence on the date changed when there is no connection history', () => {
    let data = setFriendCadence(createFriendshipData(), avery, 'daily', '2026-07-01');
    expect(friendConnectionStatus(data, avery, '2026-07-02').due).toBe(true);
    data = setFriendCadence(data, avery, 'monthly', '2026-07-31');
    expect(friendConnectionStatus(data, avery, '2026-08-30')).toMatchObject({
      nextDueDate: '2026-08-31',
      due: false
    });
  });

  it('reports malformed and unresolved records instead of discarding them', () => {
    const valid = {
      ...createFriendshipData(),
      cadenceSettings: [{ personId: avery, cadence: 'weekly', setOn: '2026-01-01' }],
      connections: [event('valid', '2026-01-01', [avery])]
    };
    expect(validateFriendshipData(valid)).toBe(true);
    expect(validateFriendshipData({
      ...valid,
      connections: [event('broken', '2026-01-01', ['unknown-person' as typeof avery])]
    })).toBe(false);
    expect(validateFriendshipData({ ...valid, connections: [event('duplicate', 'bad', [avery])] })).toBe(false);
    expect(validateFriendshipData({ ...valid, friendIds: [avery] })).toBe(false);
  });

  it('preserves unknown fields when commands update known relationship state', () => {
    const data = {
      ...createFriendshipData(),
      importedMetadata: { source: 'fixture' },
    };
    expect(setFriendCadence(data, avery, 'weekly', '2026-01-01').importedMetadata)
      .toEqual({ source: 'fixture' });
  });

  it('uses People friend categorization as the only membership source without mutating friendship records', () => {
    const legacy = {
      ...createFriendshipData(),
      friendIds: [avery, morgan],
      cadenceSettings: [{ personId: avery, cadence: 'weekly' as const, setOn: '2026-01-01' }],
      connections: [event('shared', '2026-01-02', [avery, morgan])]
    };
    expect(validateLegacyFriendshipDataV19(legacy)).toBe(true);
    const migratedFriendships = migrateLegacyFriendshipDataV19(legacy);
    const migratedGroups = migrateLegacyFriendIdsIntoPeopleGroups(createPersonPickerGroups(), legacy.friendIds);
    expect(personGroupMemberIds(migratedGroups, 'friends')).toEqual([avery, morgan]);
    expect(migratedFriendships).toMatchObject({
      cadenceSettings: legacy.cadenceSettings,
      connections: legacy.connections
    });

    const unclassified = setPersonGroupMembership(migratedGroups, 'friends', avery, false);
    expect(personGroupMemberIds(unclassified, 'friends')).toEqual([morgan]);
    expect(migratedFriendships.connections).toEqual(legacy.connections);
    expect(migratedFriendships.cadenceSettings).toEqual(legacy.cadenceSettings);
    const restored = setPersonGroupMembership(unclassified, 'friends', avery, true);
    expect(personGroupMemberIds(restored, 'friends')).toEqual([morgan, avery]);
  });
});
