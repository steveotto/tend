import { isValidDate } from './money-goals.ts';
import { isValidPersonId } from './preview-data.ts';
import { isValidTimeZone } from './rhythm-schedule.ts';
import type { PersonPreview } from './preview-data.ts';
import type { PersonId } from './preview-data.ts';

export const connectionCadences = ['daily', 'weekly', 'two-weeks', 'monthly', 'twice-weekly'] as const;
export type ConnectionCadence = (typeof connectionCadences)[number];
export type ConnectionType = 'text' | 'call' | 'time-together' | 'rhythm' | 'spark';

export type PersonConnectionCadenceSetting = {
  personId: PersonId;
  cadence: ConnectionCadence;
  setOn: string;
  [key: string]: unknown;
};
export type FriendshipCadenceSetting = PersonConnectionCadenceSetting;

export type RhythmCompletionConnectionSnapshot = {
  date: string;
  time?: string;
  timeZone?: string;
  participantIds: PersonId[];
  notes?: string;
  title: string;
};

export type SparkCompletionConnectionSnapshot = {
  type: ConnectionType;
  date: string;
  time?: string;
  timeZone?: string;
  participantIds: PersonId[];
  notes?: string;
  title: string;
};

export type FriendshipConnection = {
  id: string;
  type: ConnectionType;
  date: string;
  time?: string;
  participantIds: PersonId[];
  notes?: string;
  timeZone?: string;
  rhythmId?: string;
  completionId?: string;
  rhythmTitleSnapshot?: string;
  rhythmConnectionSnapshot?: RhythmCompletionConnectionSnapshot;
  ownedByRhythmCompletion?: boolean;
  sparkId?: string;
  sparkOwnerId?: PersonId;
  sparkTitleSnapshot?: string;
  sparkConnectionSnapshot?: SparkCompletionConnectionSnapshot;
  ownedBySparkCompletion?: boolean;
  [key: string]: unknown;
};

export type FriendshipData = {
  cadenceSettings: FriendshipCadenceSetting[];
  connections: FriendshipConnection[];
  [key: string]: unknown;
};

export type LegacyFriendshipDataV19 = {
  friendIds: PersonId[];
  cadenceSettings: FriendshipCadenceSetting[];
  connections: FriendshipConnection[];
  [key: string]: unknown;
};

export type FriendConnectionStatus = {
  personId: PersonId;
  cadence: ConnectionCadence | null;
  lastConnection: FriendshipConnection | null;
  nextDueDate: string | null;
  due: boolean;
  weeklyProgress: {
    qualifyingDays: number;
    targetDays: 2;
    weekStart: string;
    weekEnd: string;
    met: boolean;
    label: string;
  } | null;
};

const cadenceSet = new Set<string>(connectionCadences);
const connectionTypes = new Set<ConnectionType>(['text', 'call', 'time-together', 'rhythm', 'spark']);

export function createFriendshipData(): FriendshipData {
  return { cadenceSettings: [], connections: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPersonId(value: unknown): value is PersonId {
  return isValidPersonId(value);
}

function isUniquePersonIds(value: unknown): value is PersonId[] {
  return Array.isArray(value)
    && value.every(isPersonId)
    && new Set(value).size === value.length;
}

function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function validateFriendshipData(
  value: unknown,
  knownPersonIds: readonly PersonId[]
): value is FriendshipData {
  if (!isRecord(value) || Object.hasOwn(value, 'friendIds')
    || !Array.isArray(value.cadenceSettings) || !Array.isArray(value.connections)) return false;

  const knownPeople = new Set(knownPersonIds);
  const cadencePeople = new Set<string>();
  for (const setting of value.cadenceSettings) {
    if (!isRecord(setting)) return false;
    const personId = setting.personId;
    if (!isPersonId(personId) || !knownPeople.has(personId)) return false;
    const personKey = String(personId);
    if (!cadenceSet.has(String(setting.cadence))
      || typeof setting.setOn !== 'string' || !isValidDate(setting.setOn)
      || cadencePeople.has(personKey)) return false;
    cadencePeople.add(personKey);
  }

  const connectionIds = new Set<string>();
  const ownedCompletionIds = new Set<string>();
  const ownedSparkIds = new Set<string>();
  for (const connection of value.connections) {
    if (!isRecord(connection)) return false;
    const id = connection.id;
    if (typeof id !== 'string') return false;
    const connectionId = String(id);
    if (!connectionId.trim() || connectionId.length > 160 || connectionIds.has(connectionId)
      || !connectionTypes.has(connection.type as ConnectionType)
      || typeof connection.date !== 'string' || !isValidDate(connection.date)
      || (connection.time !== undefined && !isValidTime(connection.time))
      || (connection.timeZone !== undefined && !isValidTimeZone(connection.timeZone))
      || (connection.time === undefined && connection.timeZone !== undefined)
      || (connection.rhythmId !== undefined
        && (typeof connection.rhythmId !== 'string' || !connection.rhythmId.trim() || connection.rhythmId.length > 160))
      || (connection.completionId !== undefined
        && (typeof connection.completionId !== 'string' || !connection.completionId.trim() || connection.completionId.length > 160))
      || (connection.rhythmTitleSnapshot !== undefined
        && (typeof connection.rhythmTitleSnapshot !== 'string'
          || !connection.rhythmTitleSnapshot.trim()
          || connection.rhythmTitleSnapshot.length > 160))
      || (connection.sparkId !== undefined
        && (typeof connection.sparkId !== 'string'
          || !connection.sparkId.trim()
          || connection.sparkId.length > 160))
      || (connection.sparkOwnerId !== undefined
        && (!isPersonId(connection.sparkOwnerId) || !knownPeople.has(connection.sparkOwnerId)))
      || ((connection.sparkId === undefined) !== (connection.sparkOwnerId === undefined))
      || (connection.sparkTitleSnapshot !== undefined
        && (typeof connection.sparkTitleSnapshot !== 'string'
          || !connection.sparkTitleSnapshot.trim()
          || connection.sparkTitleSnapshot.length > 180))
      || (connection.ownedByRhythmCompletion !== undefined
        && typeof connection.ownedByRhythmCompletion !== 'boolean')
      || (connection.ownedByRhythmCompletion === true
        && !hasUnclaimedRhythmCompletionOwnership(connection, ownedCompletionIds))
      || (connection.ownedBySparkCompletion !== undefined
        && typeof connection.ownedBySparkCompletion !== 'boolean')
      || (connection.ownedBySparkCompletion === true
        && !hasUnclaimedSparkCompletionOwnership(connection, ownedSparkIds))
      || (connection.rhythmConnectionSnapshot !== undefined
        && !isRhythmCompletionConnectionSnapshot(
          connection.rhythmConnectionSnapshot,
          knownPeople
        ))
      || (connection.sparkConnectionSnapshot !== undefined
        && !isSparkCompletionConnectionSnapshot(
          connection.sparkConnectionSnapshot,
          knownPeople
        ))
      || !isUniquePersonIds(connection.participantIds) || connection.participantIds.length === 0
      || connection.participantIds.some(personId => !knownPeople.has(personId))
      || (connection.notes !== undefined
        && (typeof connection.notes !== 'string' || connection.notes.length > 4000))) return false;
    if (connection.ownedByRhythmCompletion === true
      && connection.rhythmConnectionSnapshot !== undefined
      && !rhythmConnectionSnapshotMatchesConnection(
        connection.rhythmConnectionSnapshot,
        connection
      )) return false;
    if (connection.ownedBySparkCompletion === true && typeof connection.sparkId === 'string') {
      ownedSparkIds.add(connection.sparkId);
    }
    connectionIds.add(connectionId);
    if (connection.ownedByRhythmCompletion === true
      && typeof connection.completionId === 'string') {
      ownedCompletionIds.add(connection.completionId);
    }
  }
  return true;
}

function hasUnclaimedSparkCompletionOwnership(
  connection: Record<string, unknown>,
  ownedSparkIds: ReadonlySet<string>
): boolean {
  return typeof connection.sparkId === 'string'
    && typeof connection.sparkOwnerId === 'string'
    && typeof connection.sparkTitleSnapshot === 'string'
    && isRecord(connection.sparkConnectionSnapshot)
    && !ownedSparkIds.has(connection.sparkId);
}

function isSparkCompletionConnectionSnapshot(
  value: unknown,
  knownPeople: ReadonlySet<PersonId>
): value is SparkCompletionConnectionSnapshot {
  if (!isRecord(value)
    || !connectionTypes.has(value.type as ConnectionType)
    || typeof value.date !== 'string'
    || !isValidDate(value.date)
    || (value.time !== undefined && !isValidTime(value.time))
    || (value.timeZone !== undefined && !isValidTimeZone(value.timeZone))
    || (value.time === undefined && value.timeZone !== undefined)
    || !isUniquePersonIds(value.participantIds)
    || value.participantIds.length === 0
    || value.participantIds.some(personId => !knownPeople.has(personId))
    || typeof value.title !== 'string'
    || !value.title.trim()
    || value.title.length > 180
    || (value.notes !== undefined
      && (typeof value.notes !== 'string' || value.notes.length > 4000))) return false;
  return true;
}

function sparkConnectionSnapshotMatchesConnection(
  snapshot: SparkCompletionConnectionSnapshot,
  connection: Record<string, unknown>
): boolean {
  const participantIds = connection.participantIds;
  return connection.type === snapshot.type
    && Array.isArray(participantIds)
    && snapshot.date === connection.date
    && snapshot.time === connection.time
    && snapshot.timeZone === connection.timeZone
    && snapshot.notes === connection.notes
    && snapshot.title === connection.sparkTitleSnapshot
    && snapshot.participantIds.length === participantIds.length
    && snapshot.participantIds.every((id, index) => id === participantIds[index]);
}

function isRhythmCompletionConnectionSnapshot(
  value: unknown,
  knownPeople: ReadonlySet<PersonId>
): value is RhythmCompletionConnectionSnapshot {
  if (!isRecord(value)
    || typeof value.date !== 'string'
    || !isValidDate(value.date)
    || (value.time !== undefined && !isValidTime(value.time))
    || (value.timeZone !== undefined && !isValidTimeZone(value.timeZone))
    || (value.time === undefined && value.timeZone !== undefined)
    || !isUniquePersonIds(value.participantIds)
    || value.participantIds.length === 0
    || value.participantIds.some(personId => !knownPeople.has(personId))
    || typeof value.title !== 'string'
    || !value.title.trim()
    || value.title.length > 160
    || (value.notes !== undefined
      && (typeof value.notes !== 'string' || value.notes.length > 4000))) return false;
  return value.time === undefined || value.timeZone !== undefined;
}

function hasUnclaimedRhythmCompletionOwnership(
  connection: Record<string, unknown>,
  ownedCompletionIds: ReadonlySet<string>
): boolean {
  return connection.type === 'rhythm'
    && typeof connection.rhythmId === 'string'
    && typeof connection.completionId === 'string'
    && typeof connection.rhythmTitleSnapshot === 'string'
    && !ownedCompletionIds.has(connection.completionId);
}

function rhythmConnectionSnapshotMatchesConnection(
  snapshot: RhythmCompletionConnectionSnapshot,
  connection: Record<string, unknown>
): boolean {
  const participantIds = connection.participantIds;
  return Array.isArray(participantIds)
    && snapshot.date === connection.date
    && snapshot.time === connection.time
    && snapshot.timeZone === connection.timeZone
    && snapshot.notes === connection.notes
    && snapshot.title === connection.rhythmTitleSnapshot
    && snapshot.participantIds.length === participantIds.length
    && snapshot.participantIds.every((id, index) => id === participantIds[index]);
}

export function rhythmCompletionConnectionSnapshot(
  connection: Pick<
    FriendshipConnection,
    'date' | 'time' | 'timeZone' | 'participantIds' | 'notes' | 'rhythmTitleSnapshot'
  >
): RhythmCompletionConnectionSnapshot {
  return {
    date: connection.date,
    ...(connection.time ? { time: connection.time } : {}),
    ...(connection.timeZone ? { timeZone: connection.timeZone } : {}),
    participantIds: [...connection.participantIds],
    ...(connection.notes ? { notes: connection.notes } : {}),
    title: connection.rhythmTitleSnapshot ?? ''
  };
}

export function isRhythmCompletionConnectionUnchanged(
  connection: FriendshipConnection
): boolean {
  return connection.ownedByRhythmCompletion === true
    && connection.rhythmConnectionSnapshot !== undefined
    && rhythmConnectionSnapshotMatchesConnection(connection.rhythmConnectionSnapshot, connection);
}

export function sparkCompletionConnectionSnapshot(
  connection: Pick<
    FriendshipConnection,
    'type' | 'date' | 'time' | 'timeZone' | 'participantIds' | 'notes' | 'sparkTitleSnapshot'
  >
): SparkCompletionConnectionSnapshot {
  return {
    type: connection.type,
    date: connection.date,
    ...(connection.time ? { time: connection.time } : {}),
    ...(connection.timeZone ? { timeZone: connection.timeZone } : {}),
    participantIds: [...connection.participantIds],
    ...(connection.notes ? { notes: connection.notes } : {}),
    title: connection.sparkTitleSnapshot ?? ''
  };
}

export function isSparkCompletionConnectionUnchanged(
  connection: FriendshipConnection
): boolean {
  return connection.ownedBySparkCompletion === true
    && connection.sparkConnectionSnapshot !== undefined
    && sparkConnectionSnapshotMatchesConnection(
      connection.sparkConnectionSnapshot,
      connection
    );
}

export function validateLegacyFriendshipDataV19(
  value: unknown,
  knownPersonIds: readonly PersonId[]
): value is LegacyFriendshipDataV19 {
  if (!isRecord(value) || !isUniquePersonIds(value.friendIds)) return false;
  const knownPeople = new Set(knownPersonIds);
  if (value.friendIds.some(personId => !knownPeople.has(personId))) return false;
  const { friendIds: _friendIds, ...friendships } = value;
  return validateFriendshipData(friendships, knownPersonIds);
}

export function migrateLegacyFriendshipDataV19(value: LegacyFriendshipDataV19): FriendshipData {
  const { friendIds: _friendIds, ...friendships } = value;
  return friendships;
}

export function getLegacyFriendIdsV19(value: LegacyFriendshipDataV19): PersonId[] {
  return [...value.friendIds];
}

export function setPersonConnectionCadence(
  data: FriendshipData,
  personId: PersonId,
  cadence: ConnectionCadence | null,
  setOn: string
): FriendshipData {
  if (!isValidDate(setOn)) return data;
  const previous = data.cadenceSettings.find(item => item.personId === personId);
  if (cadence === null) {
    if (!previous) return data;
    return {
      ...data,
      cadenceSettings: data.cadenceSettings.filter(item => item.personId !== personId)
    };
  }
  if (previous?.cadence === cadence) return data;
  const next = { ...(previous ?? {}), personId, cadence, setOn };
  return {
    ...data,
    cadenceSettings: [
      ...data.cadenceSettings.filter(item => item.personId !== personId),
      next
    ]
  };
}

export const setFriendCadence = setPersonConnectionCadence;

export function addOrUpdateConnection(
  data: FriendshipData,
  connection: FriendshipConnection
): FriendshipData {
  const existingIndex = data.connections.findIndex(item => item.id === connection.id);
  if (existingIndex < 0) return { ...data, connections: [...data.connections, connection] };
  return {
    ...data,
    connections: data.connections.map(item => {
      if (item.id !== connection.id) return item;
      const existingFields = { ...item };
      delete existingFields.time;
      delete existingFields.timeZone;
      delete existingFields.notes;
      const detachedRhythmCompletion = item.ownedByRhythmCompletion === true
        && connection.ownedByRhythmCompletion !== true
        && connection.rhythmId === undefined
        && connection.completionId === undefined
        && connection.rhythmConnectionSnapshot === undefined;
      if (detachedRhythmCompletion) {
        delete existingFields.rhythmId;
        delete existingFields.completionId;
        delete existingFields.ownedByRhythmCompletion;
        delete existingFields.rhythmConnectionSnapshot;
      }
      return { ...existingFields, ...connection };
    })
  };
}

export function detachRhythmCompletionOwnership(
  connection: FriendshipConnection
): FriendshipConnection {
  const {
    rhythmId: _rhythmId,
    completionId: _completionId,
    rhythmConnectionSnapshot: _snapshot,
    ownedByRhythmCompletion: _owned,
    ...preserved
  } = connection;
  return preserved;
}

export function detachSparkCompletionOwnership(
  connection: FriendshipConnection
): FriendshipConnection {
  const {
    sparkId: _sparkId,
    sparkOwnerId: _sparkOwnerId,
    sparkConnectionSnapshot: _snapshot,
    ownedBySparkCompletion: _owned,
    ...preserved
  } = connection;
  return preserved;
}

export function reconcileDirectRhythmConnectionEdit(
  existing: FriendshipConnection | undefined,
  next: FriendshipConnection
): FriendshipConnection {
  if (existing?.ownedByRhythmCompletion !== true) return next;
  const changed = existing.type !== next.type
    || existing.date !== next.date
    || existing.time !== next.time
    || existing.timeZone !== next.timeZone
    || existing.notes !== next.notes
    || existing.participantIds.length !== next.participantIds.length
    || existing.participantIds.some((id, index) => id !== next.participantIds[index]);
  return changed ? detachRhythmCompletionOwnership(next) : next;
}

export function reconcileRhythmCompletionConnection(
  connection: FriendshipConnection,
  completion: {
    effectiveDate: string;
    localTime?: string;
    timeZone?: string;
    memory?: string;
  }
): FriendshipConnection {
  const { time: _time, timeZone: _timeZone, notes: _notes, ...preserved } = connection;
  return {
    ...preserved,
    date: completion.effectiveDate,
    ...(completion.localTime
      ? {
          time: completion.localTime,
          ...(completion.timeZone ? { timeZone: completion.timeZone } : {})
        }
      : {}),
    ...(completion.memory?.trim() ? { notes: completion.memory } : {}),
    rhythmConnectionSnapshot: rhythmCompletionConnectionSnapshot({
      ...preserved,
      date: completion.effectiveDate,
      ...(completion.localTime
        ? {
            time: completion.localTime,
            ...(completion.timeZone ? { timeZone: completion.timeZone } : {})
          }
        : {}),
      ...(completion.memory?.trim() ? { notes: completion.memory } : {})
    })
  };
}

export function deleteConnection(data: FriendshipData, connectionId: string): FriendshipData {
  return {
    ...data,
    connections: data.connections.filter(item => item.id !== connectionId)
  };
}

export function connectionsForPerson(
  data: FriendshipData,
  personId: PersonId
): FriendshipConnection[] {
  return data.connections
    .filter(connection => connection.participantIds.includes(personId))
    .slice()
    .sort(compareConnectionsNewestFirst);
}

function isActiveConnection(connection: FriendshipConnection): boolean {
  return connection.deleted !== true
    && connection.isDeleted !== true
    && connection.deletedAt == null
    && connection.deleted_at == null;
}

export function eligibleConnectionsForPerson(
  data: FriendshipData,
  personId: PersonId,
  asOfDate: string
): FriendshipConnection[] {
  if (!isValidDate(asOfDate)) return [];
  return connectionsForPerson(data, personId)
    .filter(connection => isValidDate(connection.date)
      && connection.date <= asOfDate
      && isActiveConnection(connection));
}

export function latestValidConnection(
  connections: readonly FriendshipConnection[]
): FriendshipConnection | null {
  return connections
    .filter(connection => isValidDate(connection.date) && isActiveConnection(connection))
    .slice()
    .sort(compareConnectionsNewestFirst)[0] ?? null;
}

export function latestValidConnectionForPerson(
  data: FriendshipData,
  personId: PersonId
): FriendshipConnection | null {
  return latestValidConnection(connectionsForPerson(data, personId));
}

export function formatConnectionRecency(date: string, today: string): string | null {
  if (!isValidDate(date) || !isValidDate(today)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [todayYear, todayMonth, todayDay] = today.split('-').map(Number);
  const timestamp = Date.UTC(year!, month! - 1, day!);
  const current = Date.UTC(todayYear!, todayMonth! - 1, todayDay!);
  const days = Math.floor((current - timestamp) / 86_400_000);
  if (days < 0) {
    return new Date(year!, month! - 1, day!, 12).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
  }
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 35) return `${Math.floor(days / 7)} wk ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return `${Math.floor(days / 365)} yr ago`;
}

function compareConnectionsNewestFirst(a: FriendshipConnection, b: FriendshipConnection): number {
  return b.date.localeCompare(a.date)
    || (b.time ?? '').localeCompare(a.time ?? '')
    || b.id.localeCompare(a.id);
}

export function addConnectionCadence(date: string, cadence: ConnectionCadence): string | null {
  if (!isValidDate(date)) return null;
  if (cadence === 'twice-weekly') return null;
  const [year, month, day] = date.split('-').map(Number);
  const result = new Date(Date.UTC(year!, month! - 1, day!));
  if (cadence === 'daily') result.setUTCDate(result.getUTCDate() + 1);
  else if (cadence === 'weekly') result.setUTCDate(result.getUTCDate() + 7);
  else if (cadence === 'two-weeks') result.setUTCDate(result.getUTCDate() + 14);
  else {
    const targetMonth = month! - 1 + 1;
    const lastDay = new Date(Date.UTC(year!, targetMonth + 1, 0)).getUTCDate();
    result.setUTCFullYear(year!, targetMonth, Math.min(day!, lastDay));
  }
  return result.toISOString().slice(0, 10);
}

export function connectionStatusForPerson(
  data: FriendshipData,
  personId: PersonId,
  today: string
): FriendConnectionStatus {
  const cadence = data.cadenceSettings.find(item => item.personId === personId);
  const eligibleConnections = eligibleConnectionsForPerson(data, personId, today);
  const lastConnection = eligibleConnections[0] ?? null;
  if (!cadence) {
    return { personId, cadence: null, lastConnection, nextDueDate: null, due: false, weeklyProgress: null };
  }
  if (cadence.cadence === 'twice-weekly') {
    const weekStart = localWeekStart(today);
    const weekEnd = addDateDays(weekStart, 6);
    const qualifyingDays = new Set(
      eligibleConnections
        .map(connection => connection.date)
        .filter(date => date >= weekStart && date <= weekEnd && date <= today)
    ).size;
    const met = qualifyingDays >= 2;
    const weeklyProgress = {
      qualifyingDays,
      targetDays: 2 as const,
      weekStart,
      weekEnd,
      met,
      label: met ? 'Weekly goal met' : `${qualifyingDays} of 2 days this week`
    };
    return {
      personId,
      cadence: cadence.cadence,
      lastConnection,
      nextDueDate: null,
      due: !met,
      weeklyProgress
    };
  }
  const anchorDate = lastConnection?.date ?? cadence.setOn;
  const nextDueDate = addConnectionCadence(anchorDate, cadence.cadence);
  return {
    personId,
    cadence: cadence.cadence,
    lastConnection,
    nextDueDate,
    due: nextDueDate !== null && isValidDate(today) && today >= nextDueDate,
    weeklyProgress: null
  };
}

export const friendConnectionStatus = connectionStatusForPerson;

export function localWeekStart(date: string): string {
  if (!isValidDate(date)) return date;
  const [year, month, day] = date.split('-').map(Number);
  const dateValue = new Date(Date.UTC(year!, month! - 1, day!));
  const daysSinceMonday = (dateValue.getUTCDay() + 6) % 7;
  dateValue.setUTCDate(dateValue.getUTCDate() - daysSinceMonday);
  return dateValue.toISOString().slice(0, 10);
}

function addDateDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const result = new Date(Date.UTC(year!, month! - 1, day!));
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export function selectConnectionStatuses(
  data: FriendshipData,
  personIds: readonly PersonId[],
  today: string,
  people: readonly PersonPreview[]
): FriendConnectionStatus[] {
  return personIds
    .map(personId => connectionStatusForPerson(data, personId, today))
    .sort((a, b) => {
      if (a.due !== b.due) return a.due ? -1 : 1;
      if (a.weeklyProgress && b.weeklyProgress
        && a.weeklyProgress.qualifyingDays !== b.weeklyProgress.qualifyingDays) {
        return b.weeklyProgress.qualifyingDays - a.weeklyProgress.qualifyingDays;
      }
      return (a.nextDueDate ?? '9999-12-31').localeCompare(b.nextDueDate ?? '9999-12-31')
        || (people.find(person => person.id === a.personId)?.displayName ?? a.personId)
          .localeCompare(people.find(person => person.id === b.personId)?.displayName ?? b.personId);
    });
}

export function selectFriendStatuses(
  data: FriendshipData,
  friendIds: readonly PersonId[],
  today: string,
  people: readonly PersonPreview[]
): FriendConnectionStatus[] {
  return selectConnectionStatuses(data, friendIds, today, people);
}
