import { isValidPersonId } from './preview-data.ts';
import type { PersonId } from './preview-data.ts';

export type PrayerRequestStatus = 'active' | 'answered' | 'archived';

export type PersonPrayerLog = {
  id: string;
  prayedAt: string;
};

export type PersonPrayerRequest = {
  id: string;
  personId: PersonId;
  sharedWith?: PersonId[];
  title: string;
  details?: string;
  status: PrayerRequestStatus;
  createdAt: string;
  updatedAt: string;
  answeredAt?: string;
  archivedAt?: string;
  prayerLogs: PersonPrayerLog[];
};

export type PersonPrayerRequestDraft = {
  title: string;
  details: string;
  sharedWith: PersonId[];
};

export type PersonPrayerCommandResult =
  | { valid: true; requests: PersonPrayerRequest[] }
  | { valid: false; error: string };

const requestMaxLength = 160;
const detailsMaxLength = 4_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 160
    && value.trim() === value;
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return false;
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return false;
  const canonical = timestamp.toISOString();
  return canonical === value || canonical.replace(/\.000Z$/, 'Z') === value;
}

function knownPersonIds(ids: readonly PersonId[] | undefined): Set<PersonId> | null {
  return ids === undefined ? null : new Set(ids);
}

export function validatePersonPrayerRequestsCollection(
  value: unknown,
  personIds?: readonly PersonId[]
): value is PersonPrayerRequest[] {
  if (!Array.isArray(value)) return false;
  const knownPeople = knownPersonIds(personIds);
  const requestIds = new Set<string>();
  const logIds = new Set<string>();

  for (const candidate of value) {
    if (!isRecord(candidate)
      || Object.keys(candidate).some(key => ![
        'id', 'personId', 'sharedWith', 'title', 'details', 'status',
        'createdAt', 'updatedAt', 'answeredAt', 'archivedAt', 'prayerLogs'
      ].includes(key))) return false;
    const sharedWith = candidate.sharedWith === undefined ? [] : candidate.sharedWith;
    const logs = candidate.prayerLogs;
    if (!isValidId(candidate.id)
      || requestIds.has(candidate.id)
      || !isValidPersonId(candidate.personId)
      || knownPeople !== null && !knownPeople.has(candidate.personId)
      || !Array.isArray(sharedWith)
      || !sharedWith.every(isValidPersonId)
      || knownPeople !== null && sharedWith.some(id => !knownPeople.has(id))
      || sharedWith.includes(candidate.personId)
      || new Set(sharedWith).size !== sharedWith.length
      || typeof candidate.title !== 'string'
      || candidate.title.trim().length === 0
      || candidate.title.length > requestMaxLength
      || candidate.details !== undefined
        && (typeof candidate.details !== 'string' || candidate.details.length > detailsMaxLength)
      || candidate.status !== 'active' && candidate.status !== 'answered' && candidate.status !== 'archived'
      || !isCanonicalTimestamp(candidate.createdAt)
      || !isCanonicalTimestamp(candidate.updatedAt)
      || Date.parse(candidate.updatedAt) < Date.parse(candidate.createdAt)
      || (candidate.status === 'answered'
        ? !isCanonicalTimestamp(candidate.answeredAt) || candidate.archivedAt !== undefined
        : candidate.status === 'archived'
          ? candidate.answeredAt !== undefined || !isCanonicalTimestamp(candidate.archivedAt)
          : candidate.answeredAt !== undefined || candidate.archivedAt !== undefined)
      || !Array.isArray(logs)) return false;

    for (const log of logs) {
      if (!isRecord(log)
        || Object.keys(log).some(key => !['id', 'prayedAt'].includes(key))
        || !isValidId(log.id)
        || logIds.has(log.id)
        || !isCanonicalTimestamp(log.prayedAt)
        || Date.parse(log.prayedAt) < Date.parse(candidate.createdAt)) return false;
      logIds.add(log.id);
    }
    requestIds.add(candidate.id);
  }
  return true;
}

export function personPrayerRequestsForPerson(
  requests: readonly PersonPrayerRequest[],
  personId: PersonId
): PersonPrayerRequest[] {
  const statusOrder: Record<PrayerRequestStatus, number> = {
    active: 0,
    answered: 1,
    archived: 2
  };
  return requests
    .filter(request => request.personId === personId || request.sharedWith?.includes(personId))
    .sort((a, b) => statusOrder[a.status] - statusOrder[b.status]
      || b.updatedAt.localeCompare(a.updatedAt)
      || a.id.localeCompare(b.id));
}

export function activePrayerRequestCount(
  requests: readonly PersonPrayerRequest[],
  personId: PersonId
): number {
  return personPrayerRequestsForPerson(requests, personId)
    .filter(request => request.status === 'active').length;
}

export function prayerRequestHistorySummary(request: PersonPrayerRequest): {
  count: number;
  lastPrayedAt: string | null;
} {
  return {
    count: request.prayerLogs.length,
    lastPrayedAt: request.prayerLogs.reduce<string | null>(
      (latest, log) => latest === null || log.prayedAt > latest ? log.prayedAt : latest,
      null
    )
  };
}

export function personPrayerRequestDraft(request?: PersonPrayerRequest): PersonPrayerRequestDraft {
  return {
    title: request?.title ?? '',
    details: request?.details ?? '',
    sharedWith: [...(request?.sharedWith ?? [])]
  };
}

export function createPersonPrayerRequest(
  requests: readonly PersonPrayerRequest[],
  input: PersonPrayerRequest,
  personIds: readonly PersonId[]
): PersonPrayerCommandResult {
  if (!isValidId(input.id) || requests.some(request => request.id === input.id)) {
    return { valid: false, error: 'A unique prayer request ID is required.' };
  }
  if (!personIds.includes(input.personId)) {
    return { valid: false, error: 'Choose an existing primary person.' };
  }
  if (input.status !== 'active' || input.answeredAt !== undefined || input.archivedAt !== undefined) {
    return { valid: false, error: 'New prayer requests must start active.' };
  }
  if (!isCanonicalTimestamp(input.createdAt) || input.createdAt !== input.updatedAt) {
    return { valid: false, error: 'The prayer request timestamp is invalid.' };
  }
  const draftError = validateDraft(input.title, input.details ?? '', input.sharedWith ?? [], input.personId, personIds);
  if (draftError) return { valid: false, error: draftError };
  if (!Array.isArray(input.prayerLogs) || input.prayerLogs.length !== 0) {
    return { valid: false, error: 'New requests cannot contain prayer history.' };
  }
  return {
    valid: true,
    requests: [...requests, {
      ...input,
      sharedWith: [...(input.sharedWith ?? [])],
      prayerLogs: []
    }]
  };
}

export function updatePersonPrayerRequest(
  requests: readonly PersonPrayerRequest[],
  requestId: string,
  expectedUpdatedAt: string,
  actorId: PersonId,
  draft: PersonPrayerRequestDraft,
  updatedAt: string,
  personIds: readonly PersonId[]
): PersonPrayerCommandResult {
  const existing = requests.find(request => request.id === requestId);
  if (!existing || !canAccessRequest(existing, actorId)) {
    return { valid: false, error: 'This prayer request is no longer available from this profile.' };
  }
  if (existing.updatedAt !== expectedUpdatedAt) {
    return { valid: false, error: 'This prayer request changed while you were editing. Reload it before saving.' };
  }
  if (!isCanonicalTimestamp(updatedAt) || Date.parse(updatedAt) < Date.parse(existing.updatedAt)) {
    return { valid: false, error: 'The prayer request timestamp is invalid.' };
  }
  const draftError = validateDraft(draft.title, draft.details, draft.sharedWith, existing.personId, personIds);
  if (draftError) return { valid: false, error: draftError };
  const sharedWith = normalizeSharedWith(draft.sharedWith, existing.personId);
  if (!sharedWith) return { valid: false, error: 'Choose valid, unique people to share this request with.' };
  const details = draft.details.trim().length > 0 ? draft.details : undefined;
  const unchanged = existing.title === draft.title
    && (existing.details ?? '') === (details ?? '')
    && sameIds(existing.sharedWith ?? [], sharedWith);
  const updatedRequests = requests.map(request => {
    if (request.id !== requestId) return request;
    const next = { ...request, title: draft.title, sharedWith, updatedAt: unchanged ? request.updatedAt : updatedAt };
    if (details === undefined) delete next.details;
    else next.details = details;
    return next;
  });
  return {
    valid: true,
    requests: updatedRequests
  };
}

export type PrayerRequestTransition = 'answer' | 'archive' | 'reopen';

export function transitionPersonPrayerRequest(
  requests: readonly PersonPrayerRequest[],
  requestId: string,
  expectedUpdatedAt: string,
  actorId: PersonId,
  transition: PrayerRequestTransition,
  updatedAt: string
): PersonPrayerCommandResult {
  const existing = requests.find(request => request.id === requestId);
  if (!existing || !canAccessRequest(existing, actorId)) {
    return { valid: false, error: 'This prayer request is no longer available from this profile.' };
  }
  if (existing.updatedAt !== expectedUpdatedAt) {
    return { valid: false, error: 'This prayer request changed before it could be updated.' };
  }
  if (!isCanonicalTimestamp(updatedAt) || Date.parse(updatedAt) < Date.parse(existing.updatedAt)) {
    return { valid: false, error: 'The prayer request timestamp is invalid.' };
  }
  const next: PersonPrayerRequest = { ...existing, updatedAt };
  delete next.answeredAt;
  delete next.archivedAt;
  if (transition === 'answer') {
    next.status = 'answered';
    next.answeredAt = updatedAt;
  } else if (transition === 'archive') {
    next.status = 'archived';
    next.archivedAt = updatedAt;
  } else {
    next.status = 'active';
  }
  return { valid: true, requests: requests.map(request => request.id === requestId ? next : request) };
}

export function recordPersonPrayer(
  requests: readonly PersonPrayerRequest[],
  requestId: string,
  expectedUpdatedAt: string,
  actorId: PersonId,
  log: PersonPrayerLog,
  personIds: readonly PersonId[]
): PersonPrayerCommandResult {
  const existing = requests.find(request => request.id === requestId);
  if (!existing || !canAccessRequest(existing, actorId)) {
    return { valid: false, error: 'This prayer request is no longer available from this profile.' };
  }
  if (existing.updatedAt !== expectedUpdatedAt) {
    return { valid: false, error: 'This prayer request changed before it could be logged.' };
  }
  if (existing.status !== 'active') {
    return { valid: false, error: 'Only active requests can be marked Prayed.' };
  }
  if (!isValidId(log.id)
    || requests.some(request => request.prayerLogs.some(item => item.id === log.id))
    || !isCanonicalTimestamp(log.prayedAt)
    || Date.parse(log.prayedAt) < Date.parse(existing.updatedAt)) {
    return { valid: false, error: 'The prayer log is invalid.' };
  }
  const updatedAt = log.prayedAt;
  const next = { ...existing, prayerLogs: [...existing.prayerLogs, { ...log }], updatedAt };
  if (!validatePersonPrayerRequestsCollection(
    requests.map(request => request.id === requestId ? next : request),
    personIds
  )) {
    return { valid: false, error: 'Prayer history is invalid.' };
  }
  return { valid: true, requests: requests.map(request => request.id === requestId ? next : request) };
}

export function deletePersonPrayerRequest(
  requests: readonly PersonPrayerRequest[],
  requestId: string,
  expectedUpdatedAt: string,
  actorId: PersonId
): PersonPrayerCommandResult {
  const existing = requests.find(request => request.id === requestId);
  if (!existing || existing.personId !== actorId) {
    return { valid: false, error: 'Only the primary person can delete this prayer request.' };
  }
  if (existing.updatedAt !== expectedUpdatedAt) {
    return { valid: false, error: 'This prayer request changed before it could be deleted.' };
  }
  return { valid: true, requests: requests.filter(request => request.id !== requestId) };
}

export function unlinkPersonPrayerRequest(
  requests: readonly PersonPrayerRequest[],
  requestId: string,
  expectedUpdatedAt: string,
  actorId: PersonId,
  updatedAt: string
): PersonPrayerCommandResult {
  const existing = requests.find(request => request.id === requestId);
  if (!existing || existing.personId === actorId || !existing.sharedWith?.includes(actorId)) {
    return { valid: false, error: 'This prayer request is not shared with this profile.' };
  }
  if (existing.updatedAt !== expectedUpdatedAt) {
    return { valid: false, error: 'This prayer request changed before it could be removed from this profile.' };
  }
  if (!isCanonicalTimestamp(updatedAt) || Date.parse(updatedAt) < Date.parse(existing.updatedAt)) {
    return { valid: false, error: 'The prayer request timestamp is invalid.' };
  }
  return {
    valid: true,
    requests: requests.map(request => request.id === requestId
      ? {
          ...request,
          sharedWith: request.sharedWith!.filter(id => id !== actorId),
          updatedAt
        }
      : request)
  };
}

function canAccessRequest(request: PersonPrayerRequest, actorId: PersonId): boolean {
  return request.personId === actorId || request.sharedWith?.includes(actorId) === true;
}

function validateDraft(
  title: string,
  details: string,
  sharedWith: readonly PersonId[],
  primaryPersonId: PersonId,
  personIds: readonly PersonId[]
): string | null {
  if (typeof title !== 'string' || title.trim().length === 0 || title.length > requestMaxLength) {
    return `Enter a title with no more than ${requestMaxLength} characters.`;
  }
  if (typeof details !== 'string' || details.length > detailsMaxLength) {
    return `Keep details to ${detailsMaxLength} characters or fewer.`;
  }
  if (!Array.isArray(sharedWith)
    || !sharedWith.every(id => isValidPersonId(id) && personIds.includes(id))
    || new Set(sharedWith).size !== sharedWith.length
    || sharedWith.includes(primaryPersonId)) {
    return 'Choose valid, unique people to share this request with.';
  }
  return null;
}

function normalizeSharedWith(sharedWith: readonly PersonId[], primaryPersonId: PersonId): PersonId[] | null {
  if (!Array.isArray(sharedWith)
    || !sharedWith.every(isValidPersonId)
    || new Set(sharedWith).size !== sharedWith.length
    || sharedWith.includes(primaryPersonId)) return null;
  return [...sharedWith];
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}
