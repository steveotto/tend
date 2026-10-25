import {
  currencyFractionDigits,
  isValidDate,
  moneyInputValue,
  validateGoalDraft
} from './money-goals.ts';
import type { MoneyGoal } from './money-goals.ts';
import { goals as sampleGoals, todayRhythms } from './preview-data.ts';
import type { ActiveRhythmCompletion, DatedRhythmCompletion, RhythmCompletionRecord } from './rhythm-completion.ts';
import { localDateTimeInZone } from './rhythm-completion.ts';
import {
  validateSavedRhythms,
  validateSavedRhythmsV4,
  validateSavedRhythmsV7,
  validateSavedRhythmsV8
} from './rhythm-editor.ts';
import type { SavedRhythm } from './rhythm-editor.ts';
import { rhythmTimeValueFromLabel, rhythmTimeValueFromLegacyLabel } from './rhythm-schedule.ts';
import type { RhythmSchedule, RhythmScoringMetadata } from './rhythm-schedule.ts';

export const PREVIEW_BACKUP_FORMAT = 'tend.synthetic-preview';
export const PREVIEW_SCHEMA_VERSION = 8;

export type PreviewData = {
  goals: MoneyGoal[];
  completedRhythmIds: string[];
  savedRhythms: SavedRhythm[];
  archivedRhythmIds: string[];
  datedRhythmCompletions: DatedRhythmCompletion[];
  activeRhythmCompletions: ActiveRhythmCompletion[];
  rhythmCompletionOverrides: RhythmCompletionRecord[];
  removedSeedCompletionIds: string[];
};

export type PreviewEnvelope = {
  format: typeof PREVIEW_BACKUP_FORMAT;
  schemaVersion: typeof PREVIEW_SCHEMA_VERSION;
  data: PreviewData;
};

export type PreviewEnvelopeV4 = PreviewEnvelope;

type PreviewEnvelopeV1 = {
  format: typeof PREVIEW_BACKUP_FORMAT;
  schemaVersion: 1;
  data: {
    goals: MoneyGoal[];
    completedRhythmIds: string[];
  };
};

type PreviewEnvelopeV2 = {
  format: typeof PREVIEW_BACKUP_FORMAT;
  schemaVersion: 2;
  data: {
    goals: MoneyGoal[];
    completedRhythmIds: string[];
    savedRhythms: SavedRhythm[];
  };
};

export type PreviewValidationResult =
  | { valid: true; envelope: PreviewEnvelope; sourceSchemaVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 }
  | { valid: false; kind: 'invalid' | 'unsupported'; message: string };

const goalKeys = [
  'id', 'title', 'currency', 'direction', 'startingBalanceMinor', 'startDate',
  'targetBalanceMinor', 'targetDate', 'checkIns', 'correctionHistory'
];
const checkInKeys = ['id', 'effectiveDate', 'balanceMinor', 'note'];
const correctionKeys = ['effectiveDate', 'previousBalanceMinor', 'previousNote', 'replacedAt'];
const dataKeysV1 = ['goals', 'completedRhythmIds'];
const dataKeysV2 = ['goals', 'completedRhythmIds', 'savedRhythms'];
const dataKeysV3 = ['goals', 'completedRhythmIds', 'savedRhythms', 'archivedRhythmIds'];
const dataKeysV4 = dataKeysV3;
const dataKeysV5 = [...dataKeysV4, 'datedRhythmCompletions', 'activeRhythmCompletions'];
const dataKeysV6 = [...dataKeysV5, 'rhythmCompletionOverrides', 'removedSeedCompletionIds'];
const dataKeysV7 = dataKeysV6;
const dataKeysV8 = dataKeysV7;
const envelopeKeys = ['format', 'schemaVersion', 'data'];
const supportedRhythmIds = new Set(todayRhythms.map(rhythm => rhythm.id));
const builtInRhythmIds = new Set(todayRhythms.map(rhythm => rhythm.id));
const syntheticCompletionIds = new Set(
  todayRhythms.flatMap(rhythm => rhythm.completionHistory?.map(item => item.id) ?? [])
);
const syntheticCompletionRhythms = new Map(
  todayRhythms.flatMap(rhythm => (rhythm.completionHistory ?? []).map(item => [item.id, rhythm.id] as const))
);

export function createSamplePreviewData(): PreviewData {
  return {
    goals: sampleGoals.map(goal => ({
      ...goal,
      checkIns: goal.checkIns.map(checkIn => ({ ...checkIn })),
      correctionHistory: goal.correctionHistory.map(correction => ({ ...correction }))
    })),
    completedRhythmIds: [],
    savedRhythms: [],
    archivedRhythmIds: [],
    datedRhythmCompletions: [],
    activeRhythmCompletions: [],
    rhythmCompletionOverrides: [],
    removedSeedCompletionIds: []
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(record).every(key => allowed.includes(key));
}

function isNonEmptyText(value: unknown, maxLength = 160): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function isOptionalText(value: unknown, maxLength = 1000): value is string | undefined {
  return value === undefined || (typeof value === 'string' && value.length <= maxLength);
}

function isMinorUnitAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const timestamp = new Date(value);
  return !Number.isNaN(timestamp.getTime()) && timestamp.toISOString() === value;
}

function serializedTimeOfDay(rhythm: SavedRhythm) {
  const value = rhythm.timeOfDay
    ?? rhythmTimeValueFromLabel(rhythm.timeLabel)
    ?? rhythmTimeValueFromLegacyLabel(rhythm.timeLabel);
  if (!value) throw new Error(`No v4 time value is mapped for "${rhythm.timeLabel}".`);
  return value;
}

function validateGoal(value: unknown, goalIds: Set<string>, checkInIds: Set<string>, currentDate: string): value is MoneyGoal {
  if (!isRecord(value) || !hasOnlyKeys(value, goalKeys)) return false;
  if (!isNonEmptyText(value.id) || goalIds.has(value.id)) return false;
  if (!isNonEmptyText(value.title) || typeof value.currency !== 'string' || currencyFractionDigits(value.currency) === null) return false;
  if (value.direction !== 'increase' && value.direction !== 'decrease') return false;
  if (!isMinorUnitAmount(value.startingBalanceMinor) || !isMinorUnitAmount(value.targetBalanceMinor)) return false;
  if (typeof value.startDate !== 'string' || typeof value.targetDate !== 'string') return false;
  if (!Array.isArray(value.checkIns) || !Array.isArray(value.correctionHistory)) return false;

  const draftErrors = validateGoalDraft({
    title: value.title,
    currency: value.currency,
    direction: value.direction,
    startingBalance: moneyInputValue(value.startingBalanceMinor, value.currency),
    startDate: value.startDate,
    targetBalance: moneyInputValue(value.targetBalanceMinor, value.currency),
    targetDate: value.targetDate
  });
  if (Object.keys(draftErrors).length) return false;
  goalIds.add(value.id);

  const effectiveDates = new Set<string>();
  for (const checkIn of value.checkIns) {
    if (!isRecord(checkIn) || !hasOnlyKeys(checkIn, checkInKeys)) return false;
    if (!isNonEmptyText(checkIn.id) || checkInIds.has(checkIn.id)) return false;
    if (typeof checkIn.effectiveDate !== 'string' || !isValidDate(checkIn.effectiveDate)
      || checkIn.effectiveDate < value.startDate || checkIn.effectiveDate > currentDate
      || effectiveDates.has(checkIn.effectiveDate)) return false;
    if (!isMinorUnitAmount(checkIn.balanceMinor) || !isOptionalText(checkIn.note)) return false;
    checkInIds.add(checkIn.id);
    effectiveDates.add(checkIn.effectiveDate);
  }

  for (const correction of value.correctionHistory) {
    if (!isRecord(correction) || !hasOnlyKeys(correction, correctionKeys)) return false;
    if (typeof correction.effectiveDate !== 'string' || !isValidDate(correction.effectiveDate)
      || !effectiveDates.has(correction.effectiveDate)) return false;
    if (!isMinorUnitAmount(correction.previousBalanceMinor)
      || !isOptionalText(correction.previousNote)
      || !isCanonicalTimestamp(correction.replacedAt)) return false;
  }
  return true;
}

export function createPreviewEnvelope(data: PreviewData): PreviewEnvelope {
  return {
    format: PREVIEW_BACKUP_FORMAT,
    schemaVersion: PREVIEW_SCHEMA_VERSION,
    data: {
      goals: data.goals.map(goal => {
        const checkIns = goal.checkIns.map(checkIn => ({
          id: checkIn.id,
          effectiveDate: checkIn.effectiveDate,
          balanceMinor: checkIn.balanceMinor,
          ...(checkIn.note === undefined ? {} : { note: checkIn.note })
        }));
        const correctionHistory = goal.correctionHistory.map(correction => ({
          effectiveDate: correction.effectiveDate,
          previousBalanceMinor: correction.previousBalanceMinor,
          ...(correction.previousNote === undefined ? {} : { previousNote: correction.previousNote }),
          replacedAt: correction.replacedAt
        }));
        return {
          id: goal.id,
          title: goal.title,
          currency: goal.currency,
          direction: goal.direction,
          startingBalanceMinor: goal.startingBalanceMinor,
          startDate: goal.startDate,
          targetBalanceMinor: goal.targetBalanceMinor,
          targetDate: goal.targetDate,
          checkIns,
          correctionHistory
        };
      }),
      completedRhythmIds: [...data.completedRhythmIds],
      savedRhythms: data.savedRhythms.map(rhythm => ({
        id: rhythm.id,
        title: rhythm.title,
        ...(rhythm.description === undefined ? {} : { description: rhythm.description }),
        cadence: rhythm.cadence,
        timeLabel: rhythm.timeLabel,
        personIds: [...rhythm.personIds],
        categoryIds: [...rhythm.categoryIds],
        timeOfDay: serializedTimeOfDay(rhythm),
        ...(rhythm.schedule === undefined ? {} : { schedule: cloneRhythmSchedule(rhythm.schedule) }),
        ...(rhythm.personal === undefined ? {} : { personal: rhythm.personal }),
        ...(rhythm.scoring === undefined ? {} : { scoring: cloneRhythmScoring(rhythm.scoring) }),
        ...(rhythm.createdLocalDate === undefined ? {} : {
          createdLocalDate: rhythm.createdLocalDate,
          createdTimeZone: rhythm.createdTimeZone
        }),
        ...(rhythm.dailyBackfillAllowed === undefined ? {} : { dailyBackfillAllowed: rhythm.dailyBackfillAllowed })
      })),
      archivedRhythmIds: [...data.archivedRhythmIds],
      datedRhythmCompletions: data.datedRhythmCompletions.map(record => ({
        id: record.id,
        rhythmId: record.rhythmId,
        effectiveDate: record.effectiveDate,
        localTime: record.localTime,
        timeZone: record.timeZone,
        completedAt: record.completedAt,
        recordedAt: record.recordedAt,
        ...(record.memory === undefined ? {} : { memory: record.memory })
      })),
      activeRhythmCompletions: data.activeRhythmCompletions.map(item => ({
        rhythmId: item.rhythmId,
        completionId: item.completionId
      })),
      rhythmCompletionOverrides: data.rhythmCompletionOverrides.map(record => ({ ...record })),
      removedSeedCompletionIds: [...data.removedSeedCompletionIds]
    }
  };
}

function cloneRhythmSchedule(schedule: RhythmSchedule): RhythmSchedule {
  if ('weekdays' in schedule) return { ...schedule, weekdays: [...schedule.weekdays] };
  return { ...schedule };
}

function cloneRhythmScoring(scoring: RhythmScoringMetadata): RhythmScoringMetadata {
  return {
    trackingStartDate: scoring.trackingStartDate,
    timeZone: scoring.timeZone,
    scheduleHistory: scoring.scheduleHistory.map(segment => ({
      startDate: segment.startDate,
      ...(segment.endDate === undefined ? {} : { endDate: segment.endDate }),
      schedule: cloneRhythmSchedule(segment.schedule)
    }))
  };
}

export function validatePreviewEnvelope(value: unknown, currentDate: string): PreviewValidationResult {
  if (!isValidDate(currentDate)) {
    return { valid: false, kind: 'invalid', message: 'The current date used to validate this preview is invalid.' };
  }
  if (!isRecord(value) || !hasOnlyKeys(value, envelopeKeys)) {
    return { valid: false, kind: 'invalid', message: 'The backup envelope has an invalid structure.' };
  }
  if (value.format !== PREVIEW_BACKUP_FORMAT
    || (value.schemaVersion !== 1 && value.schemaVersion !== 2 && value.schemaVersion !== 3
      && value.schemaVersion !== 4 && value.schemaVersion !== 5
      && value.schemaVersion !== 6 && value.schemaVersion !== 7
      && value.schemaVersion !== PREVIEW_SCHEMA_VERSION)) {
    return { valid: false, kind: 'unsupported', message: 'This preview backup format or schema version is not supported.' };
  }
  const isV1 = value.schemaVersion === 1;
  const isV2 = value.schemaVersion === 2;
  const isV3 = value.schemaVersion === 3;
  const isV4 = value.schemaVersion === 4;
  const isV5 = value.schemaVersion === 5;
  const isV6 = value.schemaVersion === 6;
  const isV7 = value.schemaVersion === 7;
  const isV8 = value.schemaVersion === 8;
  const allowedDataKeys = isV1 ? dataKeysV1 : isV2 ? dataKeysV2
    : isV3 || isV4 ? dataKeysV3 : isV8 ? dataKeysV8 : isV7 ? dataKeysV7 : isV6 ? dataKeysV6 : dataKeysV5;
  if (!isRecord(value.data) || !hasOnlyKeys(value.data, allowedDataKeys)
    || !Array.isArray(value.data.goals) || !Array.isArray(value.data.completedRhythmIds)
    || ((isV5 || isV6 || isV7) && (!Array.isArray(value.data.datedRhythmCompletions)
      || !Array.isArray(value.data.activeRhythmCompletions)))
    || ((isV6 || isV7 || isV8) && (!Array.isArray(value.data.rhythmCompletionOverrides)
      || !Array.isArray(value.data.removedSeedCompletionIds)))) {
    return { valid: false, kind: 'invalid', message: 'Preview data must contain goals and completed Rhythm IDs.' };
  }
  if (!isV1 && !((isV4 || isV5 || isV6 || isV7 || isV8)
    ? isV8 ? validateSavedRhythmsV8(value.data.savedRhythms)
      : isV7 ? validateSavedRhythmsV7(value.data.savedRhythms) : validateSavedRhythmsV4(value.data.savedRhythms)
    : validateSavedRhythms(value.data.savedRhythms))) {
    return { valid: false, kind: 'invalid', message: 'Saved Rhythms contain invalid fields or unresolved references.' };
  }
  if (!isV1 && !isV2 && !Array.isArray(value.data.archivedRhythmIds)) {
    return { valid: false, kind: 'invalid', message: 'Archived Rhythm references must be a list of known Rhythm IDs.' };
  }

  const goalIds = new Set<string>();
  const checkInIds = new Set<string>();
  const goals: MoneyGoal[] = [];
  for (const goal of value.data.goals) {
    if (!validateGoal(goal, goalIds, checkInIds, currentDate)) {
      return { valid: false, kind: 'invalid', message: 'A goal, check-in, or correction record is invalid or duplicated.' };
    }
    goals.push(goal);
  }

  const completedRhythmIds = new Set<string>();
  const savedRhythmIds = new Set<string>(
    isV1 ? [] : (value.data.savedRhythms as SavedRhythm[]).map(rhythm => rhythm.id)
  );
  for (const rhythmId of value.data.completedRhythmIds) {
    if (typeof rhythmId !== 'string'
      || (!supportedRhythmIds.has(rhythmId) && !savedRhythmIds.has(rhythmId))
      || completedRhythmIds.has(rhythmId)) {
      return { valid: false, kind: 'invalid', message: 'Completed Rhythm references must be unique known Today or saved Rhythms.' };
    }
    completedRhythmIds.add(rhythmId);
  }

  const archivedRhythmIds = new Set<string>();
  const rawArchivedRhythmIds = isV1 || isV2 ? [] : value.data.archivedRhythmIds as unknown[];
  for (const rhythmId of rawArchivedRhythmIds) {
    if (typeof rhythmId !== 'string'
      || (!supportedRhythmIds.has(rhythmId) && !savedRhythmIds.has(rhythmId))
      || archivedRhythmIds.has(rhythmId)) {
      return { valid: false, kind: 'invalid', message: 'Archived Rhythm references must be unique known Today or saved Rhythms.' };
    }
    archivedRhythmIds.add(rhythmId);
  }

  let savedRhythms: SavedRhythm[];
  if (isV4 || isV5 || isV6 || isV7 || isV8) {
    savedRhythms = value.data.savedRhythms as SavedRhythm[];
  } else if (isV1) {
    savedRhythms = [];
  } else {
    savedRhythms = [];
    for (const rhythm of value.data.savedRhythms as SavedRhythm[]) {
      const timeOfDay = rhythmTimeValueFromLegacyLabel(rhythm.timeLabel);
      if (!timeOfDay) {
        return { valid: false, kind: 'invalid', message: `No v4 time value is mapped for "${rhythm.timeLabel}".` };
      }
      savedRhythms.push({ ...rhythm, timeOfDay });
    }
  }

  const datedRhythmCompletions: DatedRhythmCompletion[] = [];
  const completionIds = new Set<string>();
  const knownRhythmIds = new Set([...builtInRhythmIds, ...savedRhythmIds]);
  const rawDatedCompletions: unknown[] = isV5 || isV6 || isV7 || isV8 ? value.data.datedRhythmCompletions as unknown[] : [];
  for (const rawCompletion of rawDatedCompletions) {
    if (!isRecord(rawCompletion)
      || !hasOnlyKeys(rawCompletion, [
        'id', 'rhythmId', 'effectiveDate', 'localTime', 'timeZone',
        'completedAt', 'recordedAt', 'memory'
      ])) {
      return { valid: false, kind: 'invalid', message: 'A dated Rhythm completion has an invalid structure.' };
    }
    const record = rawCompletion;
    if (!isNonEmptyText(record.id) || completionIds.has(record.id) || syntheticCompletionIds.has(record.id)
      || !isNonEmptyText(record.rhythmId) || !knownRhythmIds.has(record.rhythmId)
      || typeof record.effectiveDate !== 'string' || !isValidDate(record.effectiveDate)
      || record.effectiveDate > currentDate
      || typeof record.localTime !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(record.localTime)
      || !isNonEmptyText(record.timeZone, 100)
      || !isCanonicalTimestamp(record.completedAt) || !isCanonicalTimestamp(record.recordedAt)
      || (typeof record.memory !== 'undefined' && !isOptionalText(record.memory, 1000))) {
      return { valid: false, kind: 'invalid', message: 'A dated Rhythm completion contains invalid fields or references.' };
    }
    let reconstructed: Date;
    try {
      reconstructed = localDateTimeInZone(record.effectiveDate, record.localTime, record.timeZone);
      new Intl.DateTimeFormat('en-US', { timeZone: record.timeZone });
    } catch {
      return { valid: false, kind: 'invalid', message: 'A dated Rhythm completion has an invalid local time or time zone.' };
    }
    if (reconstructed.toISOString() !== record.completedAt
      || Date.parse(record.completedAt) > Date.parse(record.recordedAt)) {
      return { valid: false, kind: 'invalid', message: 'A dated Rhythm completion has inconsistent event and record times.' };
    }
    completionIds.add(record.id);
    datedRhythmCompletions.push(record as DatedRhythmCompletion);
  }

  const activeRhythmCompletions: ActiveRhythmCompletion[] = [];
  const activeRhythmIds = new Set<string>();
  const activeCompletionIds = new Set<string>();
  const rawActiveCompletions: unknown[] = isV5 || isV6 || isV7 || isV8 ? value.data.activeRhythmCompletions as unknown[] : [];
  for (const rawAction of rawActiveCompletions) {
    if (!isRecord(rawAction) || !hasOnlyKeys(rawAction, ['rhythmId', 'completionId'])
      || typeof rawAction.rhythmId !== 'string' || !knownRhythmIds.has(rawAction.rhythmId)
      || typeof rawAction.completionId !== 'string'
      || activeRhythmIds.has(rawAction.rhythmId) || activeCompletionIds.has(rawAction.completionId)
      || !completedRhythmIds.has(rawAction.rhythmId)) {
      return { valid: false, kind: 'invalid', message: 'Active completion references must be unique completed Rhythm records.' };
    }
    const completion = datedRhythmCompletions.find(item => item.id === rawAction.completionId);
    if (!completion || completion.rhythmId !== rawAction.rhythmId) {
      return { valid: false, kind: 'invalid', message: 'An active completion must reference its matching dated record.' };
    }
    activeRhythmIds.add(rawAction.rhythmId);
    activeCompletionIds.add(rawAction.completionId);
    activeRhythmCompletions.push({
      rhythmId: rawAction.rhythmId,
      completionId: rawAction.completionId
    });
  }

  const rhythmCompletionOverrides: RhythmCompletionRecord[] = [];
  const overrideIds = new Set<string>();
  const rawOverrides: unknown[] = isV6 || isV7 || isV8 ? value.data.rhythmCompletionOverrides as unknown[] : [];
  for (const rawOverride of rawOverrides) {
    if (!isRecord(rawOverride) || !hasOnlyKeys(rawOverride, [
      'id', 'rhythmId', 'effectiveDate', 'localTime', 'timeZone', 'completedAt', 'recordedAt', 'memory'
    ])) {
      return { valid: false, kind: 'invalid', message: 'A seeded completion override has an invalid structure.' };
    }
    const record = rawOverride;
    if (!isNonEmptyText(record.id) || !syntheticCompletionRhythms.has(record.id)
      || overrideIds.has(record.id) || completionIds.has(record.id)
      || record.rhythmId !== syntheticCompletionRhythms.get(record.id)
      || typeof record.effectiveDate !== 'string' || !isValidDate(record.effectiveDate)
      || record.effectiveDate > currentDate
      || (typeof record.memory !== 'undefined' && !isOptionalText(record.memory, 1000))) {
      return { valid: false, kind: 'invalid', message: 'A seeded completion override contains invalid fields or references.' };
    }
    if (record.localTime === undefined) {
      if (record.timeZone !== undefined || record.completedAt !== undefined || record.recordedAt !== undefined) {
        return { valid: false, kind: 'invalid', message: 'An unrecorded completion time cannot include time metadata.' };
      }
    } else {
      if (typeof record.localTime !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(record.localTime)
        || !isNonEmptyText(record.timeZone, 100)
        || !isCanonicalTimestamp(record.completedAt)
        || (record.recordedAt !== undefined && !isCanonicalTimestamp(record.recordedAt))) {
        return { valid: false, kind: 'invalid', message: 'A seeded completion override has invalid time metadata.' };
      }
      let reconstructed: Date;
      try {
        reconstructed = localDateTimeInZone(record.effectiveDate, record.localTime, record.timeZone);
        new Intl.DateTimeFormat('en-US', { timeZone: record.timeZone });
      } catch {
        return { valid: false, kind: 'invalid', message: 'A seeded completion override has an invalid local time or time zone.' };
      }
      if (reconstructed.toISOString() !== record.completedAt
        || (record.recordedAt !== undefined
          && Date.parse(record.completedAt) > Date.parse(record.recordedAt))) {
        return { valid: false, kind: 'invalid', message: 'A seeded completion override has inconsistent event and record times.' };
      }
    }
    overrideIds.add(record.id);
    rhythmCompletionOverrides.push(record as RhythmCompletionRecord);
  }

  const removedSeedCompletionIds = new Set<string>();
  const rawRemovedIds: unknown[] = isV6 || isV7 || isV8 ? value.data.removedSeedCompletionIds as unknown[] : [];
  for (const id of rawRemovedIds) {
    if (typeof id !== 'string' || !syntheticCompletionIds.has(id)
      || removedSeedCompletionIds.has(id) || overrideIds.has(id)) {
      return { valid: false, kind: 'invalid', message: 'Removed seeded completion references must be unique known records without overrides.' };
    }
    removedSeedCompletionIds.add(id);
  }

  const envelopeData = {
    goals,
    completedRhythmIds: [...completedRhythmIds],
    savedRhythms,
    archivedRhythmIds: [...archivedRhythmIds],
    datedRhythmCompletions,
    activeRhythmCompletions,
    rhythmCompletionOverrides,
    removedSeedCompletionIds: [...removedSeedCompletionIds]
  };

  return {
    valid: true,
    envelope: createPreviewEnvelope(envelopeData),
    sourceSchemaVersion: value.schemaVersion
  };
}

export function parsePreviewBackup(text: string, currentDate: string): PreviewValidationResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { valid: false, kind: 'invalid', message: 'The selected file is not valid JSON.' };
  }
  return validatePreviewEnvelope(value, currentDate);
}

export function isVersionOnePreviewRaw(raw: string): boolean {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed)
      && parsed.format === PREVIEW_BACKUP_FORMAT
      && parsed.schemaVersion === 1;
  } catch {
    return false;
  }
}

export function isVersionTwoPreviewRaw(raw: string): boolean {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed)
      && parsed.format === PREVIEW_BACKUP_FORMAT
      && parsed.schemaVersion === 2;
  } catch {
    return false;
  }
}

export type LegacyPreviewEnvelope = PreviewEnvelopeV1;
export type PriorPreviewEnvelope = PreviewEnvelopeV2;
