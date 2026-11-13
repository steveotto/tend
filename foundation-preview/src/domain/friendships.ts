import { isValidDate } from './money-goals.ts';
import { isValidPersonId } from './preview-data.ts';
import type { PersonPreview } from './preview-data.ts';
import type { PersonId } from './preview-data.ts';

export const connectionCadences = ['daily', 'weekly', 'two-weeks', 'monthly', 'twice-weekly'] as const;
export type ConnectionCadence = (typeof connectionCadences)[number];
export type ConnectionType = 'text' | 'call' | 'time-together';

export type PersonConnectionCadenceSetting = {
  personId: PersonId;
  cadence: ConnectionCadence;
  setOn: string;
  [key: string]: unknown;
};
export type FriendshipCadenceSetting = PersonConnectionCadenceSetting;

export type FriendshipConnection = {
  id: string;
  type: ConnectionType;
  date: string;
  time?: string;
  participantIds: PersonId[];
  notes?: string;
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
const connectionTypes = new Set<ConnectionType>(['text', 'call', 'time-together']);

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
  for (const connection of value.connections) {
    if (!isRecord(connection)) return false;
    const id = connection.id;
    if (typeof id !== 'string') return false;
    const connectionId = String(id);
    if (!connectionId.trim() || connectionId.length > 160 || connectionIds.has(connectionId)
      || !connectionTypes.has(connection.type as ConnectionType)
      || typeof connection.date !== 'string' || !isValidDate(connection.date)
      || (connection.time !== undefined && !isValidTime(connection.time))
      || !isUniquePersonIds(connection.participantIds) || connection.participantIds.length === 0
      || connection.participantIds.some(personId => !knownPeople.has(personId))
      || (connection.notes !== undefined
        && (typeof connection.notes !== 'string' || connection.notes.length > 4000))) return false;
    connectionIds.add(connectionId);
  }
  return true;
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
      const { time: _time, notes: _notes, ...existingFields } = item;
      return { ...existingFields, ...connection };
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

export function latestValidConnection(
  connections: readonly FriendshipConnection[]
): FriendshipConnection | null {
  return connections
    .filter(connection => isValidDate(connection.date)
      && connection.deleted !== true
      && connection.isDeleted !== true
      && connection.deletedAt == null
      && connection.deleted_at == null)
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
  const lastConnection = connectionsForPerson(data, personId)[0] ?? null;
  if (!cadence) {
    return { personId, cadence: null, lastConnection, nextDueDate: null, due: false, weeklyProgress: null };
  }
  if (cadence.cadence === 'twice-weekly') {
    const weekStart = localWeekStart(today);
    const weekEnd = addDateDays(weekStart, 6);
    const qualifyingDays = new Set(
      connectionsForPerson(data, personId)
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
