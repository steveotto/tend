import {
  createEmptyPreviewData,
  createPreviewEnvelope
} from '../domain/preview-state.ts';
import type { PreviewEnvelope, PreviewData } from '../domain/preview-state.ts';
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

function storedPreviewEnvelope(state: Record<string, unknown>): PreviewEnvelope | null {
  const value = state[CANONICAL_PREVIEW_ENVELOPE_KEY];
  if (!isRecord(value) || value.format !== 'tend.synthetic-preview'
    || !isRecord(value.data) || !Array.isArray(value.data.prayerRequests)) return null;
  return value as unknown as PreviewEnvelope;
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

export function convertClassicStateToPreviewEnvelope(state: unknown): PreviewEnvelope {
  const data: PreviewData = createEmptyPreviewData();
  if (!isRecord(state)) return createPreviewEnvelope(data);
  const previousEnvelope = storedPreviewEnvelope(state);
  const previousRequests = previousEnvelope?.data.prayerRequests ?? [];

  if (Array.isArray(state.people)) {
    data.people = state.people.flatMap((person): PersonPreview[] => {
      if (!isRecord(person) || typeof person.id !== 'string' || typeof person.name !== 'string') return [];
      return [{ id: person.id as PersonPreview['id'], displayName: person.name }];
    });
  }

  const canonicalPersonIds = new Set(data.people.map(person => person.id));
  const referencedPersonIds = new Set<string>();
  if (Array.isArray(state.prayers)) {
    for (const prayer of state.prayers) {
      if (!isRecord(prayer)) continue;
      if (typeof prayer.personId === 'string') referencedPersonIds.add(prayer.personId);
      if (Array.isArray(prayer.sharedWith)) {
        prayer.sharedWith.forEach(id => {
          if (typeof id === 'string') referencedPersonIds.add(id);
        });
      }
    }
  }
  const previousPeople = previousEnvelope?.data.people;
  if (Array.isArray(previousPeople)) {
    for (const person of previousPeople) {
      if (!isRecord(person)
        || typeof person.id !== 'string'
        || typeof person.displayName !== 'string'
        || canonicalPersonIds.has(person.id)
        || !referencedPersonIds.has(person.id)) continue;
      data.people.push({
        id: person.id as PersonPreview['id'],
        displayName: person.displayName,
        ...(typeof person.avatarUrl === 'string' ? { avatarUrl: person.avatarUrl } : {})
      });
    }
  }

  if (Array.isArray(state.prayers)) {
    data.prayerRequests = state.prayers.flatMap((prayer): PersonPrayerRequest[] => {
      if (!isRecord(prayer) || typeof prayer.id !== 'string') return [];
      const personId = typeof prayer.personId === 'string'
        ? prayer.personId
        : Array.isArray(prayer.sharedWith) && typeof prayer.sharedWith[0] === 'string'
          ? prayer.sharedWith[0]
          : null;
      if (personId === null) return [];
      if (!data.people.some(person => person.id === personId)) {
        throw new Error(
          'A canonical Prayer request references a Person missing from the account and its saved Prayer metadata. No data was changed.'
        );
      }

      let logs: PersonPrayerRequest['prayerLogs'] = [];
      if (Array.isArray(prayer.prayerLogs)) {
        logs = prayer.prayerLogs.map((log, index) =>
          parseClassicPrayerLog(log, prayer.id as string, index)
        );
        if (logs.length === 0) {
          const legacy = validDateOnly(prayer.lastPrayed)
            ? {
                id: `${prayer.id}-legacy-log`,
                prayedOn: prayer.lastPrayed,
                editable: false as const
              }
            : timestamp(prayer.lastPrayed)
              ? {
                  id: `${prayer.id}-legacy-log`,
                  prayedAt: timestamp(prayer.lastPrayed)!,
                  editable: false as const
                }
              : null;
          if (legacy) logs = [legacy];
        }
        const previous = previousRequests.find(request => request.id === prayer.id);
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
              id: `${prayer.id}-legacy-log`,
              prayedOn: prayer.lastPrayed,
              editable: false as const
            }
          : timestamp(prayer.lastPrayed)
            ? {
                id: `${prayer.id}-legacy-log`,
                prayedAt: timestamp(prayer.lastPrayed)!,
                editable: false as const
              }
            : null;
        if (legacy) logs = [legacy];
      }

      const createdAt = timestamp(prayer.added) ?? timestamp(prayer.createdAt) ?? '1970-01-01T00:00:00.000Z';
      const updatedAt = timestamp(prayer.updatedAt) ?? createdAt;
      const status = prayer.answered ? 'answered' : prayer.archived ? 'archived' : 'active';
      const schedule = classicSchedule(prayer);
      const timeOfDay = previewTime(prayer.tod);
      const previousRequest = previousRequests.find(request => request.id === prayer.id);
      const sharedWith = Array.isArray(prayer.sharedWith)
        ? prayer.sharedWith.filter((id): id is string => typeof id === 'string')
        : [];
      return [{
        id: prayer.id,
        personId: personId as PersonPrayerRequest['personId'],
        ...(sharedWith.length > 0 ? { sharedWith } : {}),
        title: typeof prayer.text === 'string' ? prayer.text : 'Prayer',
        ...(typeof prayer.details === 'string' ? { details: prayer.details } : {}),
        status,
        ...(schedule ? { schedule } : {}),
        ...(timeOfDay ? { timeOfDay } : {}),
        ...(previousRequest?.scoring === undefined ? {} : { scoring: previousRequest.scoring }),
        createdAt,
        updatedAt,
        ...(status === 'answered' && typeof prayer.answeredDate === 'string'
          ? { answeredAt: timestamp(prayer.answeredDate) ?? updatedAt }
          : {}),
        ...(status === 'archived' && typeof prayer.archivedDate === 'string'
          ? { archivedAt: timestamp(prayer.archivedDate) ?? updatedAt }
          : {}),
        prayerLogs: logs
      }];
    });
  }

  return createPreviewEnvelope(data);
}

export function mergePrayerRequestsIntoClassicState(
  state: Record<string, unknown>,
  envelope: PreviewEnvelope
): Record<string, unknown> {
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
    const changed = request.title !== originalTitle
      || (request.details ?? undefined) !== originalDetails
      || JSON.stringify(request.sharedWith ?? []) !== JSON.stringify(originalShared)
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
  const previousEnvelope = storedPreviewEnvelope(state);
  let previousIds = new Set<string>();
  if (previousEnvelope) {
    previousIds = new Set(
      previousEnvelope.data.prayerRequests.map(request => request.id)
    );
  }
  const preserved = existing.filter(prayer => {
    if (!isRecord(prayer) || typeof prayer.id !== 'string') return true;
    if (unsupportedIds.has(prayer.id)) return true;
    if (nextIds.has(prayer.id)) return false;
    if (previousIds.has(prayer.id)) return false;
    return true;
  });
  const converted = envelope.data.prayerRequests
    .filter(request => !unsupportedIds.has(request.id))
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
    const output: Record<string, unknown> = {
      ...(isRecord(original) ? original : {}),
      id: request.id,
      text: request.title,
      ...(request.details ? { details: request.details } : {}),
      personId: request.personId,
      sharedWith: request.sharedWith ?? [],
      updatedAt: request.updatedAt
    };
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
  client: CanonicalAccountSupabaseClient
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

    const document = convertClassicStateToPreviewEnvelope(data.state);
    return {
      document,
      revision: data.revision as number,
      schemaVersion: document.schemaVersion,
      updatedAt: data.updated_at as string | null
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
      const nextState = mergePrayerRequestsIntoClassicState(baseState, document);
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
