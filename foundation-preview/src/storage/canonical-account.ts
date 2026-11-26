import {
  createEmptyPreviewData,
  createPreviewEnvelope,
  validatePreviewEnvelope
} from '../domain/preview-state.ts';
import type { PreviewEnvelope, PreviewData } from '../domain/preview-state.ts';
import { localDateString } from '../domain/money-goals.ts';
import type { PreviewAccountBackupApi, PreviewAccountBackupRecord } from './preview-account-backup.ts';
import type { PersonPrayerRequest } from '../domain/person-prayers.ts';
import type { PersonPreview } from '../domain/preview-data.ts';
import type { RhythmSchedule, RhythmTimeValue } from '../domain/rhythm-schedule.ts';
import { isRhythmTimeValue } from '../domain/rhythm-schedule.ts';

type SupabaseResult = { data: unknown; error: unknown };

export type CanonicalAccountSupabaseClient = {
  from: (table: 'tend_user_state') => {
    select: (columns: 'state,schema_version,revision,updated_at') => {
      maybeSingle: () => PromiseLike<SupabaseResult>;
    };
  };
  rpc: (
    functionName: 'tend_save_user_state',
    parameters: {
      p_state: Record<string, unknown>;
      p_expected_revision: number;
      p_schema_version: number;
    }
  ) => PromiseLike<SupabaseResult>;
};

export const CANONICAL_PREVIEW_ENVELOPE_KEY = 'tend2AuthenticatedEnvelope';
const CANONICAL_ACCOUNT_SCHEMA_VERSION = 1;

export class CanonicalAccountSaveError extends Error {
  constructor(
    readonly kind: 'stale' | 'request' | 'invalid' | 'unsupported',
    message: string
  ) {
    super(message);
    this.name = 'CanonicalAccountSaveError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalStructureCounts(state: Record<string, unknown>) {
  const people = Array.isArray(state.people) ? state.people : [];
  const prayers = Array.isArray(state.prayers) ? state.prayers : [];
  let prayerLogs = 0;
  let prayersWithNullPersonId = 0;
  for (const prayer of prayers) {
    if (!isRecord(prayer)) continue;
    if (Array.isArray(prayer.prayerLogs)) prayerLogs += prayer.prayerLogs.length;
    if (prayer.personId === null) prayersWithNullPersonId += 1;
  }
  return {
    people: people.length,
    prayers: prayers.length,
    prayerLogs,
    prayersWithNullPersonId
  };
}

function storedPreviewStructureCounts(state: Record<string, unknown>) {
  const rawEnvelope = state[CANONICAL_PREVIEW_ENVELOPE_KEY];
  const envelope = isRecord(rawEnvelope) ? rawEnvelope : null;
  const data = envelope && isRecord(envelope.data) ? envelope.data : null;
  const strength = data && isRecord(data.strength) ? data.strength : null;
  const weight = data && isRecord(data.weight) ? data.weight : null;
  const cardio = data && isRecord(data.cardio) ? data.cardio : null;
  const flexibility = data && isRecord(data.flexibility) ? data.flexibility : null;
  const count = (value: unknown) => Array.isArray(value) ? value.length : 0;
  const keyCount = (value: unknown) => isRecord(value) ? Object.keys(value).length : 0;
  const personDetails = Array.isArray(data?.personDetails) ? data.personDetails : [];
  const prayerRequests = Array.isArray(data?.prayerRequests) ? data.prayerRequests : [];
  return {
    present: rawEnvelope !== undefined && rawEnvelope !== null,
    schemaVersion: envelope && Number.isSafeInteger(envelope.schemaVersion)
      ? envelope.schemaVersion as number
      : null,
    people: count(data?.people),
    personDetails: count(data?.personDetails),
    personPhotos: personDetails.filter(details =>
      isRecord(details) && typeof details.photoDataUrl === 'string' && details.photoDataUrl.length > 0
    ).length,
    personNotes: count(data?.personNotes),
    personSparks: count(data?.personSparks),
    prayerRequests: prayerRequests.length,
    prayerLogs: prayerRequests.reduce((total, request) =>
      total + (isRecord(request) ? count(request.prayerLogs) : 0), 0),
    savedRhythms: count(data?.savedRhythms),
    datedRhythmCompletions: count(data?.datedRhythmCompletions),
    activeRhythmCompletions: count(data?.activeRhythmCompletions),
    rhythmCompletionOverrides: count(data?.rhythmCompletionOverrides),
    rhythmHistoryIds: count(data?.rhythmHistoryIds),
    strengthWorkouts: count(strength?.workouts),
    weightWeighIns: count(weight?.weighIns),
    cardioRuns: count(cardio?.runs),
    flexibilitySessions: count(flexibility?.sessions),
    categoryPreferenceKeys: keyCount(data?.categoryPreferences),
    foundationPreferenceKeys: keyCount(data?.foundationPreferences)
  };
}

function jsonValueType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function jsonValueTypeCounts(values: readonly unknown[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const type = jsonValueType(value);
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function sanitizedPrayerOwnerDiagnostic(
  prayer: Record<string, unknown>,
  canonicalPersonIds: ReadonlySet<string>
): string {
  const personId = prayer.personId;
  const objectKeys = isRecord(personId) ? Object.keys(personId).sort() : [];
  const ownerIdMatchesPerson = isRecord(personId) && typeof personId.id === 'string'
    ? canonicalPersonIds.has(personId.id)
    : null;
  const arrayIdMatchesPerson = Array.isArray(personId)
    ? personId.some(value => typeof value === 'string' && canonicalPersonIds.has(value))
    : null;
  const sharedWith = prayer.sharedWith;
  const diagnostic = {
    personIdType: jsonValueType(personId),
    ...(isRecord(personId) ? {
      personIdFieldTypes: Object.fromEntries(
        objectKeys.slice(0, 12).map(key => [key, jsonValueType(personId[key])])
      ),
      personIdFieldTypesTruncated: objectKeys.length > 12
    } : {}),
    ...(Array.isArray(personId) ? {
      personIdElementTypes: jsonValueTypeCounts(personId),
      personIdStringElementMatchesPerson: arrayIdMatchesPerson
    } : {}),
    personIdObjectIdMatchesPerson: ownerIdMatchesPerson,
    sharedWithType: jsonValueType(sharedWith),
    ...(Array.isArray(sharedWith) ? {
      sharedWithElementTypes: jsonValueTypeCounts(sharedWith)
    } : {})
  };
  return JSON.stringify(diagnostic);
}

function classicPrayerSharedWith(prayer: Record<string, unknown>): string[] {
  if (prayer.sharedWith === undefined) return [];
  if (!Array.isArray(prayer.sharedWith)
    || !prayer.sharedWith.every(personId => typeof personId === 'string')) {
    throw new Error('A canonical Prayer record has invalid participant references. No data was changed.');
  }
  return prayer.sharedWith;
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function errorCode(error: unknown): string {
  return isRecord(error) && typeof error.code === 'string' ? error.code : '';
}

function timestamp(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return undefined;
}

function validDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}

function prayerLogSignature(log: PersonPrayerRequest['prayerLogs'][number]): string {
  if (log.prayedAt !== undefined) return `timestamp:${Date.parse(log.prayedAt)}`;
  if (log.prayedOn !== undefined) return `date:${log.prayedOn}`;
  return 'undated';
}

function parseClassicPrayerLog(
  value: unknown,
  requestId: string,
  index: number
): PersonPrayerRequest['prayerLogs'][number] {
  const id = `${requestId}-log-${index}`;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const prayedAt = timestamp(value);
    if (prayedAt) return { id, prayedAt };
  }
  if (typeof value === 'string') {
    if (/^\d+$/.test(value)) {
      const prayedAt = timestamp(Number(value));
      if (prayedAt) return { id, prayedAt };
    }
    if (validDateOnly(value)) return { id, prayedOn: value };
    const prayedAt = timestamp(value);
    if (prayedAt) return { id, prayedAt };
  }
  if (isRecord(value)) {
    const rawTimestamp = value.ts ?? value.prayedAt;
    const rawDate = value.prayedOn ?? value.date;
    const prayedOn = validDateOnly(rawDate) ? rawDate : undefined;
    const prayedAt = prayedOn === undefined ? timestamp(rawTimestamp) : undefined;
    const knownKeys = ['id', 'ts', 'prayedAt', 'prayedOn', 'date', 'notes'];
    const hasUnknownFields = Object.keys(value).some(key => !knownKeys.includes(key));
    const notes = typeof value.notes === 'string' ? value.notes : undefined;
    if ((prayedAt || prayedOn) && !hasUnknownFields) {
      return {
        id,
        ...(prayedAt ? { prayedAt } : {}),
        ...(prayedOn ? { prayedOn } : {}),
        ...(notes ? { notes } : {})
      };
    }
  }
  return { id, editable: false };
}

function validatedStoredPreviewEnvelope(
  state: Record<string, unknown>,
  currentDate: string
): PreviewEnvelope | null {
  const value = state[CANONICAL_PREVIEW_ENVELOPE_KEY];
  if (value === undefined) return null;
  const validation = validatePreviewEnvelope(value, currentDate);
  if (!validation.valid) {
    const code = validation.diagnostic?.code ?? 'preview.validation.failed';
    const path = validation.diagnostic?.path ?? 'data';
    throw new Error(
      `The embedded Preview account data is ${validation.kind}. Diagnostic: ${code} at ${path}. No data was changed.`
    );
  }
  return validation.envelope;
}

function classicSchedule(prayer: Record<string, unknown>): RhythmSchedule | undefined {
  const endDate = typeof prayer.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(prayer.until)
    ? prayer.until
    : undefined;
  if (prayer.freq === 'daily') return endDate ? { frequency: 'daily', endDate } : { frequency: 'daily' };
  if (prayer.freq === 'weekly') {
    const weekday = Number(prayer.scheduleDow ?? (Array.isArray(prayer.weekdays) ? prayer.weekdays[0] : 1));
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return undefined;
    return {
      frequency: 'weekly',
      weekdays: [weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6],
      ...(endDate ? { endDate } : {})
    };
  }
  if (prayer.freq === 'selectdays' && Array.isArray(prayer.weekdays)) {
    const weekdays = [...new Set(prayer.weekdays.map(Number))]
      .filter(weekday => Number.isInteger(weekday) && weekday >= 0 && weekday <= 6)
      .sort((a, b) => a - b);
    if (weekdays.length === 0) return undefined;
    return {
      frequency: 'weekly',
      weeklyMode: 'select-days',
      weekdays: weekdays as (0 | 1 | 2 | 3 | 4 | 5 | 6)[],
      ...(endDate ? { endDate } : {})
    };
  }
  if (prayer.freq === 'monthly') {
    const day = Number(prayer.dayOfMonth ?? prayer.monthDay);
    if (!Number.isInteger(day) || day < 1 || day > 31) return undefined;
    return {
      frequency: 'monthly',
      pattern: { kind: 'dayOfMonth', day },
      ...(endDate ? { endDate } : {})
    };
  }
  return undefined;
}

function previewTime(value: unknown): RhythmTimeValue | undefined {
  return typeof value === 'string' && isRhythmTimeValue(value)
    ? value
    : undefined;
}

function previewSchedule(schedule: RhythmSchedule | undefined):
  | { freq: 'daily'; until?: string }
  | { freq: 'weekly'; weekdays: number[]; scheduleDow: number; until?: string }
  | { freq: 'selectdays'; weekdays: number[]; until?: string }
  | { freq: 'monthly'; dayOfMonth: number; until?: string }
  | null {
  if (!schedule) return null;
  const end = schedule.endDate ? { until: schedule.endDate } : {};
  if (schedule.frequency === 'daily') return { freq: 'daily', ...end };
  if (schedule.frequency === 'weekly') {
    const weekdays = [...schedule.weekdays];
    if (schedule.weeklyMode === 'select-days') return { freq: 'selectdays', weekdays, ...end };
    if (weekdays.length > 0) {
      const scheduleDow = weekdays[0];
      if (scheduleDow !== undefined) return { freq: 'weekly', weekdays, scheduleDow, ...end };
    }
    return null;
  }
  if (schedule.frequency === 'monthly' && schedule.pattern.kind === 'dayOfMonth'
    && typeof schedule.pattern.day === 'number') {
    return { freq: 'monthly', dayOfMonth: schedule.pattern.day, ...end };
  }
  return null;
}

export function convertClassicStateToPreviewEnvelope(
  state: unknown,
  currentDate = localDateString(new Date())
): PreviewEnvelope {
  if (!isRecord(state)) return createPreviewEnvelope(createEmptyPreviewData());
  const previousEnvelope = validatedStoredPreviewEnvelope(state, currentDate);
  const data: PreviewData = previousEnvelope
    ? createPreviewEnvelope(previousEnvelope.data).data
    : createEmptyPreviewData();
  if (state.people !== undefined && !Array.isArray(state.people)) {
    throw new Error('Canonical People records have an invalid collection shape. No data was changed.');
  }
  if (state.prayers !== undefined && !Array.isArray(state.prayers)) {
    throw new Error('Canonical Prayer records have an invalid collection shape. No data was changed.');
  }
  const classicPrayers = Array.isArray(state.prayers) ? state.prayers : [];
  const previousRequests = previousEnvelope?.data.prayerRequests ?? [];

  if (Array.isArray(state.people)) {
    const canonicalPeople = state.people.map((person): PersonPreview => {
      if (!isRecord(person) || typeof person.id !== 'string' || typeof person.name !== 'string') {
        throw new Error('A canonical Person record has an invalid structure. No data was changed.');
      }
      return { id: person.id as PersonPreview['id'], displayName: person.name };
    });
    const canonicalPeopleById = new Map(canonicalPeople.map(person => [person.id, person]));
    const mergedPeople = data.people.map(person => {
      const canonical = canonicalPeopleById.get(person.id);
      if (!canonical) return person;
      canonicalPeopleById.delete(person.id);
      return { ...person, displayName: canonical.displayName };
    });
    data.people = [
      ...mergedPeople,
      ...canonicalPeopleById.values()
    ];
  }

  const canonicalPersonIds = new Set(data.people.map(person => person.id));
  for (const prayer of classicPrayers) {
    if (!isRecord(prayer) || typeof prayer.id !== 'string') {
      throw new Error('A canonical Prayer record has an invalid structure. No data was changed.');
    }
    if (prayer.personId !== undefined
      && prayer.personId !== null
      && typeof prayer.personId !== 'string') {
      throw new Error(
        `A canonical Prayer record has an invalid owner reference. Diagnostic: ${
          sanitizedPrayerOwnerDiagnostic(prayer, canonicalPersonIds)
        }. No data was changed.`
      );
    }
    classicPrayerSharedWith(prayer);
  }
  const previousRequestsById = new Map(previousRequests.map(request => [request.id, request]));
  const canonicalRequests = classicPrayers.map((prayer): PersonPrayerRequest => {
    if (!isRecord(prayer) || typeof prayer.id !== 'string') {
      throw new Error('A canonical Prayer record has an invalid structure. No data was changed.');
    }
    const prayerId = prayer.id;
    const previousRequest = previousRequestsById.get(prayerId);
    const classicSharedWith = classicPrayerSharedWith(prayer);
    let previousRequestFields: Omit<PersonPrayerRequest, 'answeredAt' | 'archivedAt' | 'sharedWith'> | {} = {};
    if (previousRequest) {
      const {
        answeredAt: _answeredAt,
        archivedAt: _archivedAt,
        sharedWith: _sharedWith,
        ...fields
      } = previousRequest;
      previousRequestFields = fields;
    }
    const explicitlyUnassociated = prayer.personId === null;
    const personId = explicitlyUnassociated
      ? null
      : typeof prayer.personId === 'string'
        ? prayer.personId
        : typeof classicSharedWith[0] === 'string'
          ? classicSharedWith[0]
          : previousRequest?.personId ?? null;
    if (personId === null && !explicitlyUnassociated) {
      throw new Error('A canonical Prayer record has no resolvable owner. No data was changed.');
    }
    if (personId !== null && !data.people.some(person => person.id === personId)) {
      throw new Error(
        'A canonical Prayer request references a Person missing from the account and its saved Prayer metadata. No data was changed.'
      );
    }

    let logs: PersonPrayerRequest['prayerLogs'] = [];
    if (Array.isArray(prayer.prayerLogs)) {
      logs = prayer.prayerLogs.map((log, index) =>
        parseClassicPrayerLog(log, prayerId, index)
      );
      if (logs.length === 0) {
        const legacy = validDateOnly(prayer.lastPrayed)
          ? {
            id: `${prayerId}-legacy-log`,
              prayedOn: prayer.lastPrayed,
              editable: false as const
            }
          : timestamp(prayer.lastPrayed)
            ? {
                id: `${prayerId}-legacy-log`,
                prayedAt: timestamp(prayer.lastPrayed)!,
                editable: false as const
              }
            : null;
        if (legacy) logs = [legacy];
      }
      const previous = previousRequests.find(request => request.id === prayerId);
      if (previous) {
        const previousBySignature = new Map<string, PersonPrayerRequest['prayerLogs'][number][]>();
        for (const log of previous.prayerLogs) {
          const signature = prayerLogSignature(log);
          previousBySignature.set(signature, [...(previousBySignature.get(signature) ?? []), log]);
        }
        logs = logs.map(log => {
          const matches = previousBySignature.get(prayerLogSignature(log));
          const match = matches?.shift();
          return match ? { ...match } : log;
        });
      }
    } else {
      const legacy = validDateOnly(prayer.lastPrayed)
        ? {
          id: `${prayerId}-legacy-log`,
            prayedOn: prayer.lastPrayed,
            editable: false as const
          }
        : timestamp(prayer.lastPrayed)
          ? {
            id: `${prayerId}-legacy-log`,
            prayedAt: timestamp(prayer.lastPrayed)!,
            editable: false as const
            }
          : null;
      if (legacy) logs = [legacy];
    }

    if (logs.length === 0 && previousRequest?.prayerLogs.length) {
      logs = previousRequest.prayerLogs.map(log => ({ ...log }));
    }

    const createdAt = timestamp(prayer.added)
      ?? timestamp(prayer.createdAt)
      ?? previousRequest?.createdAt
      ?? '1970-01-01T00:00:00.000Z';
    const updatedAt = timestamp(prayer.updatedAt) ?? previousRequest?.updatedAt ?? createdAt;
    const hasCanonicalStatus = typeof prayer.answered === 'boolean' || typeof prayer.archived === 'boolean';
    const status = hasCanonicalStatus
      ? prayer.answered ? 'answered' : prayer.archived ? 'archived' : 'active'
      : previousRequest?.status ?? 'active';
    const schedule = classicSchedule(prayer) ?? previousRequest?.schedule;
    const timeOfDay = previewTime(prayer.tod) ?? previousRequest?.timeOfDay;
    const sharedWithSource = Array.isArray(prayer.sharedWith)
      ? classicSharedWith
      : previousRequest?.sharedWith ?? [];
    const sharedWith = personId === null
      ? [...sharedWithSource]
      : sharedWithSource.filter(id => id !== personId);
    return {
      ...previousRequestFields,
      id: prayerId,
      personId,
      ...(sharedWith.length > 0 ? { sharedWith } : {}),
      title: typeof prayer.text === 'string' ? prayer.text : previousRequest?.title ?? 'Prayer',
      ...(typeof prayer.details === 'string'
        ? { details: prayer.details }
        : previousRequest?.details === undefined ? {} : { details: previousRequest.details }),
      status,
      ...(schedule ? { schedule } : {}),
      ...(timeOfDay ? { timeOfDay } : {}),
      ...(previousRequest?.scoring === undefined ? {} : { scoring: previousRequest.scoring }),
      createdAt,
      updatedAt,
      ...(status === 'answered' && typeof prayer.answeredDate === 'string'
        ? { answeredAt: timestamp(prayer.answeredDate) ?? updatedAt }
        : status === 'answered' && previousRequest?.answeredAt
          ? { answeredAt: previousRequest.answeredAt }
        : {}),
      ...(status === 'archived' && typeof prayer.archivedDate === 'string'
        ? { archivedAt: timestamp(prayer.archivedDate) ?? updatedAt }
        : status === 'archived' && previousRequest?.archivedAt
          ? { archivedAt: previousRequest.archivedAt }
        : {}),
      prayerLogs: logs
    };
  });
  const canonicalRequestsById = new Map(canonicalRequests.map(request => [request.id, request]));
  data.prayerRequests = [
    ...previousRequests.map(request => canonicalRequestsById.get(request.id) ?? request),
    ...canonicalRequests.filter(request => !previousRequestsById.has(request.id))
  ];

  return createPreviewEnvelope(data);
}

export function mergePrayerRequestsIntoClassicState(
  state: Record<string, unknown>,
  envelope: PreviewEnvelope,
  currentDate = localDateString(new Date())
): Record<string, unknown> {
  if (state.prayers !== undefined && !Array.isArray(state.prayers)) {
    throw new CanonicalAccountSaveError(
      'invalid',
      'The canonical Prayer collection is invalid. No data was changed.'
    );
  }
  const existing = Array.isArray(state.prayers) ? state.prayers : [];
  const nextIds = new Set(envelope.data.prayerRequests.map(request => request.id));
  const unsupportedIds = new Set(
    existing.flatMap(prayer => {
      if (!isRecord(prayer) || typeof prayer.id !== 'string') return [];
      const frequency = prayer.freq;
      if (frequency === undefined) return [];
      if (frequency === 'daily' || frequency === 'weekly' || frequency === 'selectdays' || frequency === 'monthly') return [];
      return [prayer.id];
    })
  );
  for (const request of envelope.data.prayerRequests) {
    if (!unsupportedIds.has(request.id)) continue;
    const original = existing.find(prayer => isRecord(prayer) && prayer.id === request.id);
    if (!isRecord(original)) continue;
    const originalTitle = typeof original.text === 'string' ? original.text : 'Prayer';
    const originalDetails = typeof original.details === 'string' ? original.details : undefined;
    const originalShared = Array.isArray(original.sharedWith)
      ? original.sharedWith.filter((id): id is string => typeof id === 'string')
      : [];
    const originalStatus = original.answered ? 'answered' : original.archived ? 'archived' : 'active';
    const requestSharedWith = request.sharedWith ?? [];
    const changed = request.title !== originalTitle
      || (request.details ?? undefined) !== originalDetails
      || JSON.stringify(requestSharedWith) !== JSON.stringify(originalShared.filter(id => id !== request.personId))
      || request.status !== originalStatus
      || request.schedule !== undefined
      || request.timeOfDay !== undefined;
    if (changed) {
      throw new CanonicalAccountSaveError(
        'unsupported',
        'This existing prayer uses an unsupported Classic schedule. It was left unchanged; choose a supported frequency in a separately reviewed migration.'
      );
    }
  }
  const previousEnvelope = validatedStoredPreviewEnvelope(state, currentDate);
  const currentProjection = convertClassicStateToPreviewEnvelope(state, currentDate);
  const currentRequestsById = new Map(
    currentProjection.data.prayerRequests.map(request => [request.id, request])
  );
  const currentRequestIds = new Set(currentProjection.data.prayerRequests.map(request => request.id));
  const submittedRequestsById = new Map(
    envelope.data.prayerRequests.map(request => [request.id, request])
  );
  const unchangedUnassociatedPrayerIds = new Set(existing.flatMap(prayer => {
    if (!isRecord(prayer) || typeof prayer.id !== 'string' || prayer.personId !== null) return [];
    const currentRequest = currentRequestsById.get(prayer.id);
    const submittedRequest = submittedRequestsById.get(prayer.id);
    return currentRequest && submittedRequest
      && JSON.stringify(currentRequest) === JSON.stringify(submittedRequest)
      ? [prayer.id]
      : [];
  }));
  let previousIds = new Set<string>();
  if (previousEnvelope) {
    previousIds = new Set(
      previousEnvelope.data.prayerRequests.map(request => request.id)
    );
  }
  const preserved = existing.filter(prayer => {
    if (!isRecord(prayer) || typeof prayer.id !== 'string') return true;
    if (unsupportedIds.has(prayer.id)) return true;
    if (unchangedUnassociatedPrayerIds.has(prayer.id)) return true;
    if (nextIds.has(prayer.id)) return false;
    if (currentRequestIds.has(prayer.id)) return false;
    if (previousIds.has(prayer.id)) return false;
    return true;
  });
  const converted = envelope.data.prayerRequests
    .filter(request => !unsupportedIds.has(request.id)
      && !unchangedUnassociatedPrayerIds.has(request.id))
    .map((request) => {
    const original = existing.find(prayer => isRecord(prayer) && prayer.id === request.id);
    const schedule = previewSchedule(request.schedule);
    if (request.schedule !== undefined && schedule === null) {
      throw new CanonicalAccountSaveError(
        'unsupported',
        'This prayer schedule cannot be saved to the canonical Classic account. Choose Daily, selected weekdays, weekly, or a day-of-month monthly schedule.'
      );
    }
    const previousRequest = previousEnvelope?.data.prayerRequests
      .find(candidate => candidate.id === request.id);
    const previousLogs = previousRequest?.prayerLogs ?? [];
    const legacyOnly = request.prayerLogs.length > 0
      && request.prayerLogs.every(log => log.id.endsWith('-legacy-log'));
    const originalSharedWith = isRecord(original)
      && Array.isArray(original.sharedWith)
      && original.sharedWith.every(personId => typeof personId === 'string')
      ? original.sharedWith as string[]
      : null;
    const requestSharedWith = request.sharedWith ?? [];
    const preserveLegacyOwnerMembership = request.personId !== null
      && originalSharedWith?.includes(request.personId) === true
      && sameStrings(
        originalSharedWith.filter(personId => personId !== request.personId),
        requestSharedWith
      );
    const output: Record<string, unknown> = {
      ...(isRecord(original) ? original : {}),
      id: request.id,
      text: request.title,
      ...(request.details ? { details: request.details } : {}),
      personId: request.personId,
      sharedWith: preserveLegacyOwnerMembership ? originalSharedWith : requestSharedWith,
      updatedAt: request.updatedAt
    };
    if (request.details === undefined) delete output.details;
    delete output.answered;
    delete output.archived;
    delete output.answeredDate;
    delete output.archivedDate;
    if (request.status === 'answered') {
      output.answered = true;
      output.archived = false;
      if (request.answeredAt) output.answeredDate = request.answeredAt.slice(0, 10);
    } else if (request.status === 'archived') {
      output.answered = false;
      output.archived = true;
      if (request.archivedAt) output.archivedDate = request.archivedAt.slice(0, 10);
    } else {
      output.answered = false;
      output.archived = false;
    }

    if (request.schedule === undefined) {
      // Preserve unsupported or legacy Classic schedule fields. React does not
      // expose a Classic custom/quarterly/yearly mapping and must not strip it.
      if (isRecord(original)) {
        for (const key of ['freq', 'weekdays', 'scheduleDow', 'dayOfMonth', 'monthDay', 'until']) {
          if (Object.prototype.hasOwnProperty.call(original, key)) {
            output[key] = original[key];
          }
        }
      }
    } else if (schedule) {
      delete output.freq;
      delete output.weekdays;
      delete output.scheduleDow;
      delete output.dayOfMonth;
      delete output.monthDay;
      delete output.until;
      Object.assign(output, schedule);
    }

    if (request.timeOfDay === undefined) {
      if (!isRecord(original) || typeof original.tod !== 'string') delete output.tod;
      else output.tod = original.tod;
    }
    else output.tod = request.timeOfDay;

    if (typeof output.added !== 'string') output.added = request.createdAt.slice(0, 10);
    if (legacyOnly) {
      // The old lastPrayed field has no record identity; preserve it until a new
      // React log is added rather than converting it into an editable log.
      if (!isRecord(original) || typeof original.lastPrayed !== 'string') {
        const legacy = request.prayerLogs.find(log => log.prayedAt)?.prayedAt;
        if (legacy) output.lastPrayed = legacy.slice(0, 10);
      }
    } else {
      const rawLogs = Array.isArray(isRecord(original) ? original.prayerLogs : undefined)
        ? original.prayerLogs as unknown[]
        : [];
      const rawById = new Map<string, unknown>();
      const rawBySignature = new Map<string, unknown[]>();
      rawLogs.forEach((rawValue, index) => {
        const parsed = parseClassicPrayerLog(rawValue, request.id, index);
        const signature = prayerLogSignature(parsed);
        rawBySignature.set(signature, [...(rawBySignature.get(signature) ?? []), rawValue]);
      });
      previousLogs.forEach(previousLog => {
        const matches = rawBySignature.get(prayerLogSignature(previousLog));
        const rawValue = matches?.shift();
        if (rawValue !== undefined) rawById.set(previousLog.id, rawValue);
      });
      const prayerLogs = request.prayerLogs.map((log, index) => {
        const previousLog = previousLogs.find(candidate => candidate.id === log.id);
        const originalValue = rawById.get(log.id)
          ?? (log.id === `${request.id}-log-${index}` ? rawLogs[index] : undefined);
        const sourceLog = previousLog
          ?? (originalValue === undefined ? undefined : parseClassicPrayerLog(originalValue, request.id, index));
        if (originalValue !== undefined && sourceLog
          && prayerLogSignature(sourceLog) === prayerLogSignature(log)) {
          return originalValue;
        }
        if (log.prayedAt !== undefined) return Date.parse(log.prayedAt);
        if (log.prayedOn !== undefined) return log.prayedOn;
        return null;
      });
      output.prayerLogs = prayerLogs;
      output.prayed = prayerLogs.length;
      const latestTimestamp = request.prayerLogs
        .flatMap(log => log.prayedAt ? [Date.parse(log.prayedAt)] : [])
        .filter(Number.isFinite)
        .sort((left, right) => left - right)
        .at(-1);
      const latestDate = request.prayerLogs
        .flatMap(log => log.prayedOn ? [log.prayedOn] : [])
        .sort()
        .at(-1);
      if (latestTimestamp !== undefined) output.lastPrayed = new Date(latestTimestamp).toISOString();
      else if (latestDate !== undefined) output.lastPrayed = latestDate;
      else delete output.lastPrayed;
    }
    return output;
  });
  return {
    ...state,
    prayers: [...preserved, ...converted],
    [CANONICAL_PREVIEW_ENVELOPE_KEY]: envelope
  };
}

export function createCanonicalAccountApi(
  client: CanonicalAccountSupabaseClient,
  currentDate: () => string = () => localDateString(new Date())
): PreviewAccountBackupApi {
  let inFlightRead: Promise<PreviewAccountBackupRecord | null> | null = null;

  async function read(): Promise<PreviewAccountBackupRecord | null> {
    const { data, error } = await client
      .from('tend_user_state')
      .select('state,schema_version,revision,updated_at')
      .maybeSingle();
    if (error) throw new Error('The canonical Tend account state could not be read.');
    if (data === null) return null;
    if (!isRecord(data)
      || !isRecord(data.state)
      || !Number.isSafeInteger(data.revision)
      || !Number.isSafeInteger(data.schema_version)
      || !(data.updated_at === null || typeof data.updated_at === 'string')) {
      throw new Error('The canonical Tend account state is incomplete or invalid.');
    }
    if (data.schema_version !== CANONICAL_ACCOUNT_SCHEMA_VERSION) {
      throw new Error('The canonical Tend account schema is not supported. No data was changed.');
    }

    const document = convertClassicStateToPreviewEnvelope(data.state, currentDate());
    return {
      document,
      revision: data.revision as number,
      schemaVersion: document.schemaVersion,
      updatedAt: data.updated_at as string | null,
      canonicalStructure: {
        ...canonicalStructureCounts(data.state),
        embeddedPreview: storedPreviewStructureCounts(data.state)
      }
    };
  }

  return {
    read() {
      if (inFlightRead) return inFlightRead;
      inFlightRead = read();
      void inFlightRead.then(
        () => { inFlightRead = null; },
        () => { inFlightRead = null; }
      );
      return inFlightRead;
    },
    async save(document, expectedRevision) {
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
        throw new Error('The canonical Tend account revision is invalid.');
      }
      const { data, error } = await client
        .from('tend_user_state')
        .select('state,schema_version,revision,updated_at')
        .maybeSingle();
      if (error) throw new CanonicalAccountSaveError(
        'request',
        'The canonical Tend account state could not be loaded before saving.'
      );
      if (data !== null) {
        if (!isRecord(data)
          || !Number.isSafeInteger(data.revision)
          || !isRecord(data.state)
          || !Number.isSafeInteger(data.schema_version)) {
          throw new CanonicalAccountSaveError(
            'invalid',
            'The canonical Tend account state is incomplete or invalid. No data was changed.'
          );
        }
        if (data.schema_version !== CANONICAL_ACCOUNT_SCHEMA_VERSION) {
          throw new CanonicalAccountSaveError(
            'unsupported',
            'The canonical Tend account schema is not supported. No data was changed.'
          );
        }
        if (Number(data.revision) !== expectedRevision) {
          throw new CanonicalAccountSaveError(
            'stale',
            'The canonical Tend account changed before this save. No data was replaced.'
          );
        }
      } else if (expectedRevision !== 0) {
        throw new CanonicalAccountSaveError(
          'stale',
          'The canonical Tend account is no longer available. No data was replaced.'
        );
      }
      const baseState = isRecord(data) && isRecord(data.state) ? data.state : {};
      const nextState = mergePrayerRequestsIntoClassicState(baseState, document, currentDate());
      const result = await client.rpc('tend_save_user_state', {
        p_state: nextState,
        p_expected_revision: expectedRevision,
        p_schema_version: CANONICAL_ACCOUNT_SCHEMA_VERSION
      });
      if (result.error) {
        if (errorCode(result.error) === '40001'
          || errorCode(result.error) === 'P0001') {
          throw new CanonicalAccountSaveError(
            'stale',
            'The canonical Tend account changed before this save. No data was replaced.'
          );
        }
        throw new CanonicalAccountSaveError(
          'request',
          'The canonical Tend account state could not be saved.'
        );
      }
      const row = Array.isArray(result.data) ? result.data[0] : result.data;
      if (!isRecord(row) || !Number.isSafeInteger(Number(row.revision))) {
        throw new CanonicalAccountSaveError(
          'invalid',
          'The canonical Tend save returned no valid revision.'
        );
      }
      return Number(row.revision);
    }
  };
}
