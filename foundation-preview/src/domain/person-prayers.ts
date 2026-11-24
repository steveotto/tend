import { isValidPersonId } from './preview-data.ts';
import type { PersonId } from './preview-data.ts';
import { isValidDate } from './money-goals.ts';
import { addCalendarDays, rhythmSchedulesEqual } from './rhythm-occurrences.ts';
import {
  createRhythmSeason,
  createUnknownRhythmSeason,
  rhythmSeasonForDate,
  rhythmSeasonPaletteForOrdinal
} from './rhythm-seasons.ts';
import {
  isRhythmTimeValue,
  isValidTimeZone,
  validateRhythmSchedule,
  validateRhythmScoringMetadata
} from './rhythm-schedule.ts';
import type { RhythmSchedule, RhythmScoringMetadata, RhythmTimeValue } from './rhythm-schedule.ts';
import { localDateInTimeZone } from './rhythm-scoring.ts';

export type PrayerRequestStatus = 'active' | 'answered' | 'archived';

export type PersonPrayerLog = {
  id: string;
  prayedAt?: string;
  prayedOn?: string;
  notes?: string;
  editable?: false;
};

export type PersonPrayerRequest = {
  id: string;
  personId: PersonId;
  sharedWith?: PersonId[];
  title: string;
  details?: string;
  status: PrayerRequestStatus;
  schedule?: RhythmSchedule | undefined;
  timeOfDay?: RhythmTimeValue | undefined;
  scoring?: RhythmScoringMetadata;
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
  schedule?: RhythmSchedule | undefined;
  timeOfDay?: RhythmTimeValue | undefined;
};

export type PersonPrayerCommandResult =
  | { valid: true; requests: PersonPrayerRequest[] }
  | { valid: false; error: string };

export type PrayerScheduleScoringContext = {
  currentDate: string;
  timeZone: string;
};

export type PersonPrayerLogUndo = {
  requestId: string;
  log: PersonPrayerLog;
  index: number;
  expectedUpdatedAt: string;
};

export type PersonPrayerLogCommandResult =
  | { valid: true; requests: PersonPrayerRequest[]; undo?: PersonPrayerLogUndo }
  | { valid: false; error: string };

const requestMaxLength = 160;
const detailsMaxLength = 4_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
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
  personIds?: readonly PersonId[],
  allowScheduling = true,
  allowScheduleHistory = true
): value is PersonPrayerRequest[] {
  if (!Array.isArray(value)) return false;
  const knownPeople = knownPersonIds(personIds);
  const requestIds = new Set<string>();
  const logIds = new Set<string>();

  for (const candidate of value) {
    if (!isRecord(candidate)
      || Object.keys(candidate).some(key => ![
        'id', 'personId', 'sharedWith', 'title', 'details', 'status',
        'createdAt', 'updatedAt', 'answeredAt', 'archivedAt', 'prayerLogs',
        ...(allowScheduling ? ['schedule', 'timeOfDay'] : []),
        ...(allowScheduleHistory ? ['scoring'] : [])
      ].includes(key))) return false;
    const sharedWith = candidate.sharedWith === undefined ? [] : candidate.sharedWith;
    const logs = candidate.prayerLogs;
    const scheduleValidation = candidate.schedule === undefined
      ? undefined
      : validateRhythmSchedule(candidate.schedule);
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
      || scheduleValidation?.valid === false
      || candidate.timeOfDay !== undefined && !isRhythmTimeValue(candidate.timeOfDay)
      || candidate.scoring !== undefined && (!allowScheduleHistory
        || !isValidPrayerScoring(
          candidate.scoring,
          scheduleValidation?.valid ? scheduleValidation.schedule : undefined,
          candidate.timeOfDay
        ))
      || (candidate.status === 'answered'
        ? !isCanonicalTimestamp(candidate.answeredAt) || candidate.archivedAt !== undefined
        : candidate.status === 'archived'
          ? candidate.answeredAt !== undefined || !isCanonicalTimestamp(candidate.archivedAt)
          : candidate.answeredAt !== undefined || candidate.archivedAt !== undefined)
      || !Array.isArray(logs)) return false;

    for (const log of logs) {
      if (!isRecord(log)
        || Object.keys(log).some(key => !['id', 'prayedAt', 'prayedOn', 'notes', 'editable'].includes(key))
        || !isValidId(log.id)
        || logIds.has(log.id)
        || log.prayedAt !== undefined && log.prayedOn !== undefined
        || log.prayedAt !== undefined
          && !isCanonicalTimestamp(log.prayedAt)
        || log.prayedOn !== undefined
          && (typeof log.prayedOn !== 'string' || !isValidCalendarDate(log.prayedOn))
        || log.notes !== undefined
          && (typeof log.notes !== 'string' || log.notes.length > 1000)
        || log.editable !== undefined && log.editable !== false) return false;
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
  let lastPrayedAt: string | null = null;
  let latestInstant = Number.NEGATIVE_INFINITY;
  for (const log of request.prayerLogs) {
    if (log.prayedAt === undefined) continue;
    const instant = Date.parse(log.prayedAt);
    if (instant > latestInstant) {
      latestInstant = instant;
      lastPrayedAt = log.prayedAt;
    }
  }
  return {
    count: request.prayerLogs.length,
    lastPrayedAt
  };
}

export function personPrayerRequestDraft(request?: PersonPrayerRequest): PersonPrayerRequestDraft {
  return {
    title: request?.title ?? '',
    details: request?.details ?? '',
    sharedWith: [...(request?.sharedWith ?? [])],
    ...(request
      ? {
          ...(request.schedule ? { schedule: request.schedule } : {}),
          timeOfDay: request.timeOfDay ?? 'anytime'
        }
      : { schedule: { frequency: 'daily' }, timeOfDay: 'anytime' })
  };
}

export function createPersonPrayerRequest(
  requests: readonly PersonPrayerRequest[],
  input: PersonPrayerRequest,
  personIds: readonly PersonId[],
  scoringContext?: PrayerScheduleScoringContext
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
  const scheduleError = validateSchedule(input.schedule, input.timeOfDay);
  if (scheduleError) return { valid: false, error: scheduleError };
  let scoring = input.scoring;
  if (!scoring && input.schedule && scoringContext) {
    if (!isValidDate(scoringContext.currentDate) || !isValidTimeZone(scoringContext.timeZone)) {
      return { valid: false, error: 'The current local date and time zone are required to record Prayer schedule history.' };
    }
    scoring = {
      trackingStartDate: scoringContext.currentDate,
      timeZone: scoringContext.timeZone,
      scheduleHistory: [
        createRhythmSeason(
          input.id,
          scoringContext.currentDate,
          input.schedule,
          input.timeOfDay ?? 'anytime',
          undefined,
          rhythmSeasonPaletteForOrdinal(0)
        )
      ]
    };
  }
  if (!Array.isArray(input.prayerLogs) || input.prayerLogs.length !== 0) {
    return { valid: false, error: 'New requests cannot contain prayer history.' };
  }
  const nextRequest: PersonPrayerRequest = {
    ...input,
    sharedWith: [...(input.sharedWith ?? [])],
    ...(input.schedule ? { schedule: { ...input.schedule } } : {}),
    ...(scoring ? { scoring } : {}),
    prayerLogs: []
  };
  if (!validatePersonPrayerRequestsCollection([...requests, nextRequest], personIds)) {
    return { valid: false, error: 'The prayer request contains invalid schedule history or associations.' };
  }
  return {
    valid: true,
    requests: [...requests, nextRequest]
  };
}

export function updatePersonPrayerRequest(
  requests: readonly PersonPrayerRequest[],
  requestId: string,
  expectedUpdatedAt: string,
  actorId: PersonId,
  draft: PersonPrayerRequestDraft,
  updatedAt: string,
  personIds: readonly PersonId[],
  scoringContext?: PrayerScheduleScoringContext
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
  const scheduleError = validateSchedule(draft.schedule, draft.timeOfDay);
  if (scheduleError) return { valid: false, error: scheduleError };
  const scheduleChanged = !sameSchedule(existing.schedule, draft.schedule);
  const timeOfDayChanged = (existing.timeOfDay ?? 'anytime') !== (draft.timeOfDay ?? 'anytime');
  let scoring = existing.scoring;
  if ((scheduleChanged || timeOfDayChanged) && draft.schedule) {
    if (!scoringContext
      || !isValidDate(scoringContext.currentDate)
      || !isValidTimeZone(scoringContext.timeZone)) {
      return { valid: false, error: 'The current local date and time zone are required to preserve Prayer schedule history.' };
    }
    const revision = prayerScheduleRevision(
      existing,
      draft.schedule,
      draft.timeOfDay ?? 'anytime',
      scoringContext
    );
    if (!revision.valid) return revision;
    scoring = revision.scoring;
  } else if (scheduleChanged && !draft.schedule && existing.scoring) {
    return {
      valid: false,
      error: 'This prayer request has saved schedule history. Choose a supported schedule rather than removing its schedule.'
    };
  }
  const sharedWith = normalizeSharedWith(draft.sharedWith, existing.personId);
  if (!sharedWith) return { valid: false, error: 'Choose valid, unique people to share this request with.' };
  const details = draft.details.trim().length > 0 ? draft.details : undefined;
  const unchanged = existing.title === draft.title
    && (existing.details ?? '') === (details ?? '')
    && sameIds(existing.sharedWith ?? [], sharedWith)
    && !scheduleChanged
    && (existing.timeOfDay ?? 'anytime') === (draft.timeOfDay ?? 'anytime');
  const updatedRequests = requests.map(request => {
    if (request.id !== requestId) return request;
    const next = {
      ...request,
      title: draft.title,
      sharedWith,
      ...(draft.schedule ? { schedule: { ...draft.schedule } } : {}),
      ...(draft.timeOfDay ? { timeOfDay: draft.timeOfDay } : {}),
      ...(scoring ? { scoring } : {}),
      updatedAt: unchanged ? request.updatedAt : updatedAt
    };
    if (details === undefined) delete next.details;
    else next.details = details;
    if (!draft.schedule) delete next.schedule;
    if (!draft.timeOfDay) delete next.timeOfDay;
    if (!draft.schedule) delete next.scoring;
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

export function savePersonPrayerLog(
  requests: readonly PersonPrayerRequest[],
  requestId: string,
  expectedUpdatedAt: string,
  actorId: PersonId,
  log: PersonPrayerLog,
  updatedAt: string,
  personIds: readonly PersonId[]
): PersonPrayerLogCommandResult {
  const existing = requests.find(request => request.id === requestId);
  if (!existing || !canAccessRequest(existing, actorId)) {
    return { valid: false, error: 'This prayer request is no longer available from this profile.' };
  }
  if (existing.updatedAt !== expectedUpdatedAt) {
    return { valid: false, error: 'This prayer request changed before the prayer log could be saved.' };
  }
  if (!isCanonicalTimestamp(updatedAt) || Date.parse(updatedAt) < Date.parse(existing.updatedAt)) {
    return { valid: false, error: 'The prayer log update timestamp is invalid.' };
  }
  if (!isValidId(log.id)) {
    return { valid: false, error: 'The prayer log ID is invalid.' };
  }
  const matchingRequest = requests.find(request =>
    request.prayerLogs.some(item => item.id === log.id)
  );
  if (matchingRequest && matchingRequest.id !== requestId) {
    return { valid: false, error: 'This prayer log belongs to another request and cannot be changed here.' };
  }
  const currentLog = existing.prayerLogs.find(item => item.id === log.id);
  if (currentLog?.editable === false) {
    return {
      valid: false,
      error: 'This legacy prayer entry has no safely editable record identity. It was left unchanged.'
    };
  }
  if (log.editable === false || (log.prayedAt === undefined && log.prayedOn === undefined)) {
    return { valid: false, error: 'Choose a saved date for this prayer entry.' };
  }
  if (log.prayedAt !== undefined && !isCanonicalTimestamp(log.prayedAt)
    || log.prayedOn !== undefined && !isValidCalendarDate(log.prayedOn)
    || log.prayedAt !== undefined && log.prayedOn !== undefined
    || log.notes !== undefined && (typeof log.notes !== 'string' || log.notes.length > 1000)) {
    return { valid: false, error: 'Enter a valid prayer date, time, and notes.' };
  }
  if (!currentLog && requests.some(request => request.prayerLogs.some(item => item.id === log.id))) {
    return { valid: false, error: 'A prayer entry with this ID already exists.' };
  }

  const nextLog: PersonPrayerLog = {
    id: log.id,
    ...(log.prayedAt !== undefined ? { prayedAt: log.prayedAt } : {}),
    ...(log.prayedOn !== undefined ? { prayedOn: log.prayedOn } : {}),
    ...(log.notes !== undefined && log.notes.length > 0 ? { notes: log.notes } : {})
  };
  const nextRequest: PersonPrayerRequest = {
    ...existing,
    updatedAt,
    prayerLogs: currentLog
      ? existing.prayerLogs.map(item => item.id === log.id ? nextLog : item)
      : [...existing.prayerLogs, nextLog]
  };
  const nextRequests = requests.map(request => request.id === requestId ? nextRequest : request);
  if (!validatePersonPrayerRequestsCollection(nextRequests, personIds)) {
    return { valid: false, error: 'The saved prayer history is invalid.' };
  }
  return { valid: true, requests: nextRequests };
}

export function deletePersonPrayerLog(
  requests: readonly PersonPrayerRequest[],
  requestId: string,
  expectedUpdatedAt: string,
  actorId: PersonId,
  logId: string,
  updatedAt: string,
  personIds: readonly PersonId[]
): PersonPrayerLogCommandResult {
  const existing = requests.find(request => request.id === requestId);
  if (!existing || !canAccessRequest(existing, actorId)) {
    return { valid: false, error: 'This prayer request is no longer available from this profile.' };
  }
  if (existing.updatedAt !== expectedUpdatedAt) {
    return { valid: false, error: 'This prayer request changed before the prayer entry could be deleted.' };
  }
  if (!isCanonicalTimestamp(updatedAt) || Date.parse(updatedAt) < Date.parse(existing.updatedAt)) {
    return { valid: false, error: 'The prayer log update timestamp is invalid.' };
  }
  const index = existing.prayerLogs.findIndex(item => item.id === logId);
  if (index < 0) return { valid: false, error: 'This prayer entry is no longer available.' };
  const log = existing.prayerLogs[index]!;
  if (log.editable === false) {
    return {
      valid: false,
      error: 'This legacy prayer entry has no safely editable record identity. It was left unchanged.'
    };
  }
  const nextRequest = {
    ...existing,
    updatedAt,
    prayerLogs: existing.prayerLogs.filter(item => item.id !== logId)
  };
  const nextRequests = requests.map(request => request.id === requestId ? nextRequest : request);
  if (!validatePersonPrayerRequestsCollection(nextRequests, personIds)) {
    return { valid: false, error: 'The prayer history could not be updated safely.' };
  }
  return {
    valid: true,
    requests: nextRequests,
    undo: {
      requestId,
      log: { ...log },
      index,
      expectedUpdatedAt: updatedAt
    }
  };
}

export function undoDeletePersonPrayerLog(
  requests: readonly PersonPrayerRequest[],
  undo: PersonPrayerLogUndo,
  actorId: PersonId,
  updatedAt: string,
  personIds: readonly PersonId[]
): PersonPrayerLogCommandResult {
  const existing = requests.find(request => request.id === undo.requestId);
  if (!existing || !canAccessRequest(existing, actorId)) {
    return { valid: false, error: 'This prayer request is no longer available from this profile.' };
  }
  if (existing.updatedAt !== undo.expectedUpdatedAt) {
    return { valid: false, error: 'This prayer request changed after the entry was deleted. Reload before undoing.' };
  }
  if (!Number.isSafeInteger(undo.index) || undo.index < 0 || undo.index > existing.prayerLogs.length) {
    return { valid: false, error: 'The deleted prayer entry position is invalid and cannot be restored safely.' };
  }
  if (existing.prayerLogs.some(item => item.id === undo.log.id)) {
    return { valid: false, error: 'This prayer entry already exists and cannot be restored twice.' };
  }
  if (!isCanonicalTimestamp(updatedAt) || Date.parse(updatedAt) < Date.parse(existing.updatedAt)) {
    return { valid: false, error: 'The prayer log update timestamp is invalid.' };
  }
  const nextRequest = {
    ...existing,
    updatedAt,
    prayerLogs: [
      ...existing.prayerLogs.slice(0, Math.min(undo.index, existing.prayerLogs.length)),
      { ...undo.log },
      ...existing.prayerLogs.slice(Math.min(undo.index, existing.prayerLogs.length))
    ]
  };
  const nextRequests = requests.map(request => request.id === undo.requestId ? nextRequest : request);
  if (!validatePersonPrayerRequestsCollection(nextRequests, personIds)) {
    return { valid: false, error: 'The prayer entry could not be restored safely.' };
  }
  return { valid: true, requests: nextRequests };
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

function isValidPrayerScoring(
  value: unknown,
  schedule: RhythmSchedule | undefined,
  timeOfDay: unknown
): value is RhythmScoringMetadata {
  if (!schedule || !validateRhythmScoringMetadata(value)) return false;
  const latest = value.scheduleHistory.at(-1);
  return latest?.kind === 'scheduled'
    && rhythmSchedulesEqual(latest.schedule, schedule)
    && (latest.timeOfDay ?? 'anytime')
      === (isRhythmTimeValue(timeOfDay) ? timeOfDay : 'anytime');
}

function sameSchedule(left: RhythmSchedule | undefined, right: RhythmSchedule | undefined): boolean {
  if (left === undefined || right === undefined) return left === right;
  return rhythmSchedulesEqual(left, right);
}

function prayerScheduleRevision(
  request: PersonPrayerRequest,
  schedule: RhythmSchedule,
  timeOfDay: RhythmTimeValue,
  context: PrayerScheduleScoringContext
): { valid: true; scoring: RhythmScoringMetadata } | { valid: false; error: string } {
  const { currentDate, timeZone } = context;
  if (schedule.endDate !== undefined && schedule.endDate < currentDate) {
    return { valid: false, error: 'A new Prayer schedule end date cannot be before its effective date.' };
  }

  if (!request.scoring) {
    const coverageStart = legacyPrayerHistoryStart(request, timeZone, currentDate);
    const scheduleHistory = [
      ...(coverageStart && coverageStart < currentDate
        ? [createUnknownRhythmSeason(request.id, coverageStart)]
        : []),
      createRhythmSeason(
        request.id,
        currentDate,
        schedule,
        timeOfDay,
        undefined,
        rhythmSeasonPaletteForOrdinal(coverageStart && coverageStart < currentDate ? 1 : 0)
      )
    ];
    return {
      valid: true,
      scoring: { trackingStartDate: currentDate, timeZone, scheduleHistory }
    };
  }

  const scoring = request.scoring;
  if (!validateRhythmScoringMetadata(scoring)
    || scoring.timeZone !== timeZone) {
    return {
      valid: false,
      error: 'Saved Prayer schedule history is invalid or uses a different time zone; it was left unchanged.'
    };
  }
  if (currentDate < scoring.trackingStartDate) {
    return { valid: false, error: 'A Prayer schedule cannot change before its saved history starts.' };
  }
  const latest = scoring.scheduleHistory.at(-1);
  if (!latest || latest.kind !== 'scheduled'
    || !rhythmSeasonForDate(scoring.scheduleHistory, currentDate)
    || currentDate < latest.startDate
    || !request.schedule
    || !rhythmSchedulesEqual(latest.schedule, request.schedule)
    || (latest.timeOfDay ?? 'anytime') !== (request.timeOfDay ?? 'anytime')) {
    return { valid: false, error: 'The current Prayer schedule does not match its saved history.' };
  }

  const scheduleHistory = [...scoring.scheduleHistory];
  if (latest.startDate === currentDate) {
    scheduleHistory[scheduleHistory.length - 1] = {
      ...latest,
      schedule,
      timeOfDay
    };
  } else {
    const previousDate = addCalendarDays(currentDate, -1);
    if (!isValidDate(previousDate)) {
      return { valid: false, error: 'The Prayer schedule boundary cannot be represented safely.' };
    }
    const previous = scheduleHistory[scheduleHistory.length - 1]!;
    if (previous.kind !== 'scheduled') {
      return { valid: false, error: 'The previous Prayer schedule is unresolved and cannot be changed safely.' };
    }
    if (!previous.schedule.endDate || previous.schedule.endDate >= currentDate) {
      scheduleHistory[scheduleHistory.length - 1] = {
        ...previous,
        schedule: { ...previous.schedule, endDate: previousDate }
      };
    }
    const scheduledCount = scheduleHistory.filter(segment => segment.kind === 'scheduled').length;
    scheduleHistory.push(createRhythmSeason(
      request.id,
      currentDate,
      schedule,
      timeOfDay,
      undefined,
      rhythmSeasonPaletteForOrdinal(scheduledCount)
    ));
  }

  return {
    valid: true,
    scoring: { ...scoring, scheduleHistory }
  };
}

function legacyPrayerHistoryStart(
  request: PersonPrayerRequest,
  timeZone: string,
  currentDate: string
): string | undefined {
  const dates: string[] = [];
  const createdAt = Date.parse(request.createdAt);
  if (Number.isFinite(createdAt) && createdAt > 0) {
    const localDate = localDateInTimeZone(new Date(createdAt), timeZone);
    if (localDate <= currentDate) dates.push(localDate);
  }
  for (const log of request.prayerLogs) {
    const date = log.prayedOn
      ?? (log.prayedAt && isCanonicalTimestamp(log.prayedAt)
        ? localDateInTimeZone(new Date(log.prayedAt), timeZone)
        : undefined);
    if (date && isValidCalendarDate(date) && date <= currentDate) dates.push(date);
  }
  return dates.sort()[0];
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

function validateSchedule(
  schedule: RhythmSchedule | undefined,
  timeOfDay: RhythmTimeValue | undefined
): string | null {
  if (schedule !== undefined && !validateRhythmSchedule(schedule).valid) {
    return 'Choose a supported prayer frequency.';
  }
  if (timeOfDay !== undefined && !isRhythmTimeValue(timeOfDay)) {
    return 'Choose a supported prayer time of day.';
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
