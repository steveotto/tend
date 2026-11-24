import { isValidDate } from './money-goals.ts';
import type { PersonId, PersonPreview } from './preview-data.ts';
import {
  addOrUpdateConnection,
  deleteConnection,
  detachSparkCompletionOwnership,
  isSparkCompletionConnectionUnchanged,
  sparkCompletionConnectionSnapshot
} from './friendships.ts';
import type { FriendshipConnection, FriendshipData } from './friendships.ts';

export type PersonSparkCompletion = {
  id: string;
  source: 'connection' | 'legacy';
  date?: string;
  time?: string;
  completedAt?: string;
  connectionId?: string;
  legacyEventId?: string;
  participantIds?: PersonId[];
  undone?: boolean;
};

export type PersonSpark = {
  id: string;
  ownerId: PersonId;
  title: string;
  description?: string;
  dueDate?: string;
  sharedWith: PersonId[];
  archived: boolean;
  completed: boolean;
  completionHistory: PersonSparkCompletion[];
  legacyTiming?: {
    by?: string | null;
    time?: string | null;
  };
  legacyAreas?: string[];
  legacyData?: Record<string, unknown>;
};

export type PersonSparkDraft = Pick<PersonSpark, 'title' | 'sharedWith'> & {
  description?: string;
  dueDate?: string;
};

type SparkCommandResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function activePersonSparkCompletion(spark: PersonSpark): PersonSparkCompletion | null {
  for (let index = spark.completionHistory.length - 1; index >= 0; index--) {
    const completion = spark.completionHistory[index];
    if (completion && completion.undone !== true) return completion;
  }
  return null;
}

export function personSparksForPerson(
  sparks: readonly PersonSpark[],
  personId: PersonId
): PersonSpark[] {
  return sparks.filter(spark => spark.ownerId === personId || spark.sharedWith.includes(personId));
}

export function selectOpenPersonSparks(sparks: readonly PersonSpark[]): PersonSpark[] {
  return sparks.filter(spark => !spark.archived && !spark.completed);
}

export function validatePersonSparksCollection(
  value: unknown,
  knownPersonIds: readonly PersonId[]
): value is PersonSpark[] {
  if (!Array.isArray(value)) return false;
  const people = new Set(knownPersonIds);
  const sparkIds = new Set<string>();

  for (const candidate of value) {
    if (!isRecord(candidate)) return false;
    const ownerId = candidate.ownerId;
    const sharedWith = candidate.sharedWith;
    if (typeof candidate.id !== 'string'
      || !candidate.id.trim()
      || candidate.id.length > 160
      || sparkIds.has(candidate.id)
      || typeof ownerId !== 'string'
      || !people.has(ownerId)
      || typeof candidate.title !== 'string'
      || !candidate.title.trim()
      || candidate.title.length > 180
      || (candidate.description !== undefined
        && (typeof candidate.description !== 'string' || candidate.description.length > 4000))
      || (candidate.dueDate !== undefined
        && (typeof candidate.dueDate !== 'string' || !isValidDate(candidate.dueDate)))
      || !isUniqueKnownPeople(sharedWith, people)
      || sharedWith.includes(ownerId)
      || typeof candidate.archived !== 'boolean'
      || typeof candidate.completed !== 'boolean'
      || !Array.isArray(candidate.completionHistory)) return false;

    sparkIds.add(candidate.id);
    const completionIds = new Set<string>();
    let activeCount = 0;
    for (const rawCompletion of candidate.completionHistory) {
      if (!isRecord(rawCompletion)
        || typeof rawCompletion.id !== 'string'
        || !rawCompletion.id.trim()
        || rawCompletion.id.length > 200
        || completionIds.has(rawCompletion.id)
        || (rawCompletion.source !== 'connection' && rawCompletion.source !== 'legacy')
        || (rawCompletion.date !== undefined
          && (typeof rawCompletion.date !== 'string' || !isValidDate(rawCompletion.date)))
        || (rawCompletion.time !== undefined
          && (typeof rawCompletion.time !== 'string' || !isValidTime(rawCompletion.time)))
        || (rawCompletion.completedAt !== undefined
          && !isCanonicalInstant(rawCompletion.completedAt))
        || (rawCompletion.connectionId !== undefined
          && (typeof rawCompletion.connectionId !== 'string' || !rawCompletion.connectionId.trim()))
        || (rawCompletion.legacyEventId !== undefined
          && (typeof rawCompletion.legacyEventId !== 'string' || !rawCompletion.legacyEventId.trim()))
        || (rawCompletion.participantIds !== undefined
          && !isUniqueKnownPeople(rawCompletion.participantIds, people))
        || (rawCompletion.undone !== undefined && typeof rawCompletion.undone !== 'boolean')
        || (rawCompletion.source === 'connection'
          && (typeof rawCompletion.connectionId !== 'string'
            || typeof rawCompletion.date !== 'string'
            || !isValidDate(rawCompletion.date)))
        || (rawCompletion.source === 'legacy' && rawCompletion.connectionId !== undefined)) return false;
      completionIds.add(rawCompletion.id);
      if (rawCompletion.undone !== true) activeCount++;
    }

    if ((candidate.completed && activeCount !== 1) || (!candidate.completed && activeCount !== 0)) return false;
    const legacyTiming = candidate.legacyTiming;
    if (legacyTiming !== undefined
      && (!isRecord(legacyTiming)
        || (legacyTiming.by !== undefined
          && legacyTiming.by !== null
          && typeof legacyTiming.by !== 'string')
        || (legacyTiming.time !== undefined
          && legacyTiming.time !== null
          && typeof legacyTiming.time !== 'string'))) return false;
    if (candidate.legacyAreas !== undefined
      && (!Array.isArray(candidate.legacyAreas)
        || candidate.legacyAreas.some(area => typeof area !== 'string'))) return false;
    if (candidate.legacyData !== undefined && !isRecord(candidate.legacyData)) return false;
  }

  return true;
}

export function validatePersonSparkConnectionLinks(
  sparks: readonly PersonSpark[],
  friendships: FriendshipData
): boolean {
  const bySpark = new Map(sparks.map(spark => [spark.id, spark]));
  const claimedConnections = new Set<string>();

  for (const spark of sparks) {
    const completion = activePersonSparkCompletion(spark);
    if (!completion || completion.source !== 'connection') continue;
    const connectionId = completion.connectionId;
    const connection = friendships.connections.find(item => item.id === connectionId);
    if (!connection
      || connection.sparkId !== spark.id
      || connection.sparkOwnerId !== spark.ownerId
      || connection.date !== completion.date
      || connection.time !== completion.time
      || claimedConnections.has(connection.id)) return false;
    claimedConnections.add(connection.id);
  }

  for (const connection of friendships.connections) {
    if (connection.sparkId === undefined && connection.sparkOwnerId === undefined) continue;
    if (typeof connection.sparkId !== 'string' || typeof connection.sparkOwnerId !== 'string') return false;
    const spark = bySpark.get(connection.sparkId);
    const completion = spark && activePersonSparkCompletion(spark);
    if (!spark || spark.ownerId !== connection.sparkOwnerId
      || !spark.completed
      || completion?.source !== 'connection'
      || completion.connectionId !== connection.id) return false;
  }
  return true;
}

export function createPersonSpark(
  sparks: readonly PersonSpark[],
  ownerId: PersonId,
  draft: PersonSparkDraft,
  id: string
): SparkCommandResult<PersonSpark[]> {
  if (!id.trim() || sparks.some(spark => spark.id === id)) {
    return { ok: false, error: 'This Spark ID is already in use.' };
  }
  const title = draft.title.trim();
  if (!title) return { ok: false, error: 'Add a title for this Spark.' };
  if (draft.dueDate !== undefined && draft.dueDate !== '' && !isValidDate(draft.dueDate)) {
    return { ok: false, error: 'Choose a valid due date or leave it blank.' };
  }
  const spark: PersonSpark = {
    id,
    ownerId,
    title,
    ...(draft.description?.trim() ? { description: draft.description.trim() } : {}),
    ...(draft.dueDate ? { dueDate: draft.dueDate } : {}),
    sharedWith: [...new Set(draft.sharedWith.filter(personId => personId !== ownerId))],
    archived: false,
    completed: false,
    completionHistory: []
  };
  return { ok: true, value: [...sparks, spark] };
}

export function updatePersonSpark(
  sparks: readonly PersonSpark[],
  sparkId: string,
  draft: PersonSparkDraft,
  knownPersonIds: readonly PersonId[]
): SparkCommandResult<PersonSpark[]> {
  const current = sparks.find(spark => spark.id === sparkId);
  if (!current) return { ok: false, error: 'This Spark is no longer available.' };
  const title = draft.title.trim();
  if (!title) return { ok: false, error: 'Add a title for this Spark.' };
  if (draft.dueDate !== undefined && draft.dueDate !== '' && !isValidDate(draft.dueDate)) {
    return { ok: false, error: 'Choose a valid due date or leave it blank.' };
  }
  const known = new Set(knownPersonIds);
  const sharedWith = [...new Set(draft.sharedWith.filter(personId =>
    personId !== current.ownerId && known.has(personId)))];
  const updated = sparks.map(spark => {
    if (spark.id !== sparkId) return spark;
    const { description: _description, dueDate: _dueDate, ...preserved } = spark;
    const description = draft.description?.trim();
    return {
      ...preserved,
      title,
      ...(description ? { description } : {}),
      ...(draft.dueDate ? { dueDate: draft.dueDate } : {}),
      sharedWith
    };
  });
  return {
    ok: true,
    value: updated
  };
}

export function setPersonSparkArchived(
  sparks: readonly PersonSpark[],
  sparkId: string,
  archived: boolean
): PersonSpark[] {
  return sparks.map(spark => spark.id === sparkId ? { ...spark, archived } : spark);
}

export function completePersonSpark(
  sparks: readonly PersonSpark[],
  friendships: FriendshipData,
  sparkId: string,
  record: FriendshipConnection
): SparkCommandResult<{ sparks: PersonSpark[]; friendships: FriendshipData }> {
  const spark = sparks.find(item => item.id === sparkId);
  if (!spark || spark.archived) return { ok: false, error: 'This Spark is no longer available.' };
  if (spark.completed || friendships.connections.some(item =>
    item.sparkId === spark.id || item.id === record.id)) {
    return { ok: false, error: 'This Spark has already been completed or linked.' };
  }
  if (!isValidDate(record.date) || record.participantIds.length === 0) {
    return { ok: false, error: 'Choose a valid date and at least one actual participant.' };
  }
  const connectionBase: FriendshipConnection = {
    ...record,
    type: 'spark',
    sparkId: spark.id,
    sparkOwnerId: spark.ownerId,
    sparkTitleSnapshot: spark.title
  };
  const connection: FriendshipConnection = {
    ...connectionBase,
    ownedBySparkCompletion: true,
    sparkConnectionSnapshot: sparkCompletionConnectionSnapshot(connectionBase)
  };
  const completion: PersonSparkCompletion = {
    id: connection.id,
    source: 'connection',
    date: connection.date,
    ...(connection.time ? { time: connection.time } : {}),
    connectionId: connection.id
  };
  return {
    ok: true,
    value: {
      sparks: sparks.map(item => item.id === spark.id
        ? { ...item, completed: true, completionHistory: [...item.completionHistory, completion] }
        : item),
      friendships: addOrUpdateConnection(friendships, connection)
    }
  };
}

export function undoPersonSparkCompletion(
  sparks: readonly PersonSpark[],
  friendships: FriendshipData,
  sparkId: string
): SparkCommandResult<{ sparks: PersonSpark[]; friendships: FriendshipData }> {
  const spark = sparks.find(item => item.id === sparkId);
  const completion = spark && activePersonSparkCompletion(spark);
  if (!spark || !spark.completed || !completion) {
    return { ok: false, error: 'This Spark has no active completion to undo.' };
  }
  const linkedConnection = completion.source === 'connection'
    ? friendships.connections.find(item => item.id === completion.connectionId)
    : undefined;
  if (completion.source === 'connection' && !linkedConnection) {
    return { ok: false, error: 'The linked connection is missing; no data was changed.' };
  }
  const preserveEditedConnection = linkedConnection?.ownedBySparkCompletion === true
    && !isSparkCompletionConnectionUnchanged(linkedConnection);
  return {
    ok: true,
    value: {
      sparks: sparks.map(item => item.id === sparkId
        ? {
            ...item,
            completed: false,
            completionHistory: item.completionHistory.map(entry => entry.id === completion.id
              ? { ...entry, undone: true }
              : entry)
          }
        : item),
      friendships: linkedConnection
        ? preserveEditedConnection
          ? {
              ...friendships,
              connections: friendships.connections.map(item => item.id === linkedConnection.id
                ? detachSparkCompletionOwnership(item)
                : item)
            }
          : deleteConnection(friendships, linkedConnection.id)
        : friendships
    }
  };
}

export function savePersonConnection(
  sparks: readonly PersonSpark[],
  friendships: FriendshipData,
  record: FriendshipConnection
): SparkCommandResult<{ sparks: PersonSpark[]; friendships: FriendshipData }> {
  const existing = friendships.connections.find(item => item.id === record.id);
  if (existing?.sparkId) {
    const spark = sparks.find(item => item.id === existing.sparkId);
    const completion = spark && activePersonSparkCompletion(spark);
    if (!spark || !completion || completion.connectionId !== record.id) {
      return { ok: false, error: 'The linked Spark is inconsistent; no data was changed.' };
    }
    const linkedRecord = { ...record, sparkId: spark.id, sparkOwnerId: spark.ownerId };
    const nextSparks = sparks.map(item => {
      if (item.id !== spark.id) return item;
      return {
        ...item,
        completionHistory: item.completionHistory.map(entry => {
          if (entry.id !== completion.id) return entry;
          const { time: _time, ...preserved } = entry;
          return {
            ...preserved,
            date: linkedRecord.date,
            ...(linkedRecord.time ? { time: linkedRecord.time } : {})
          };
        })
      };
    });
    return { ok: true, value: { sparks: nextSparks, friendships: addOrUpdateConnection(friendships, linkedRecord) } };
  }
  return {
    ok: true,
    value: { sparks: [...sparks], friendships: addOrUpdateConnection(friendships, record) }
  };
}

export function deletePersonConnection(
  sparks: readonly PersonSpark[],
  friendships: FriendshipData,
  connectionId: string
): SparkCommandResult<{ sparks: PersonSpark[]; friendships: FriendshipData }> {
  const connection = friendships.connections.find(item => item.id === connectionId);
  if (!connection) return { ok: false, error: 'This connection is no longer available.' };
  if (!connection.sparkId) {
    return { ok: true, value: { sparks: [...sparks], friendships: deleteConnection(friendships, connectionId) } };
  }
  const spark = sparks.find(item => item.id === connection.sparkId);
  const completion = spark && activePersonSparkCompletion(spark);
  if (!spark || !completion || completion.connectionId !== connectionId) {
    return { ok: false, error: 'The linked Spark is inconsistent; no data was changed.' };
  }
  return {
    ok: true,
    value: {
      sparks: sparks.map(item => item.id === spark.id
        ? {
            ...item,
            completed: false,
            completionHistory: item.completionHistory.map(entry => entry.id === completion.id
              ? { ...entry, undone: true }
              : entry)
          }
        : item),
      friendships: deleteConnection(friendships, connectionId)
    }
  };
}

export function deletePersonSpark(
  sparks: readonly PersonSpark[],
  friendships: FriendshipData,
  sparkId: string,
  viewerId: PersonId
): SparkCommandResult<{ sparks: PersonSpark[]; friendships: FriendshipData }> {
  const spark = sparks.find(item => item.id === sparkId);
  if (!spark) return { ok: false, error: 'This Spark is no longer available.' };
  if (spark.ownerId !== viewerId) {
    return {
      ok: true,
      value: {
        sparks: sparks.map(item => item.id === sparkId
          ? { ...item, sharedWith: item.sharedWith.filter(id => id !== viewerId) }
          : item),
        friendships: { ...friendships, connections: [...friendships.connections] }
      }
    };
  }
  return {
    ok: true,
    value: {
      sparks: sparks.filter(item => item.id !== sparkId),
      friendships: {
        ...friendships,
        connections: friendships.connections.map(connection => {
          if (connection.sparkId !== sparkId) return connection;
          const {
            sparkId: _sparkId,
            sparkOwnerId: _sparkOwnerId,
            sparkConnectionSnapshot: _snapshot,
            ownedBySparkCompletion: _owned,
            ...preservedConnection
          } = connection;
          return preservedConnection;
        })
      }
    }
  };
}

export function personSparkBadges(
  spark: PersonSpark,
  people: readonly PersonPreview[]
): PersonPreview[] {
  const visibleIds = new Set([spark.ownerId, ...spark.sharedWith]);
  return people.filter(person => visibleIds.has(person.id));
}

export function validatePersonSparkConnections(
  sparks: readonly PersonSpark[],
  friendships: FriendshipData
): boolean {
  return validatePersonSparkConnectionLinks(sparks, friendships);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUniqueKnownPeople(value: unknown, known: ReadonlySet<string>): value is PersonId[] {
  return Array.isArray(value)
    && value.every(id => typeof id === 'string' && known.has(id))
    && new Set(value).size === value.length;
}

function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isCanonicalInstant(value: unknown): value is string {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    && (parsed.toISOString() === value || parsed.toISOString().replace(/\.000Z$/, 'Z') === value);
}
