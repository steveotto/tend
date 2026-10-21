import {
  currencyFractionDigits,
  isValidDate,
  moneyInputValue,
  validateGoalDraft
} from './money-goals.ts';
import type { MoneyGoal } from './money-goals.ts';
import { goals as sampleGoals, todayRhythms } from './preview-data.ts';

export const PREVIEW_BACKUP_FORMAT = 'tend.synthetic-preview';
export const PREVIEW_SCHEMA_VERSION = 1;

export type PreviewData = {
  goals: MoneyGoal[];
  completedRhythmIds: string[];
};

export type PreviewEnvelope = {
  format: typeof PREVIEW_BACKUP_FORMAT;
  schemaVersion: typeof PREVIEW_SCHEMA_VERSION;
  data: PreviewData;
};

export type PreviewValidationResult =
  | { valid: true; envelope: PreviewEnvelope }
  | { valid: false; kind: 'invalid' | 'unsupported'; message: string };

const goalKeys = [
  'id', 'title', 'currency', 'direction', 'startingBalanceMinor', 'startDate',
  'targetBalanceMinor', 'targetDate', 'checkIns', 'correctionHistory'
];
const checkInKeys = ['id', 'effectiveDate', 'balanceMinor', 'note'];
const correctionKeys = ['effectiveDate', 'previousBalanceMinor', 'previousNote', 'replacedAt'];
const dataKeys = ['goals', 'completedRhythmIds'];
const envelopeKeys = ['format', 'schemaVersion', 'data'];
const supportedRhythmIds = new Set(todayRhythms.map(rhythm => rhythm.id));

export function createSamplePreviewData(): PreviewData {
  return {
    goals: sampleGoals.map(goal => ({
      ...goal,
      checkIns: goal.checkIns.map(checkIn => ({ ...checkIn })),
      correctionHistory: goal.correctionHistory.map(correction => ({ ...correction }))
    })),
    completedRhythmIds: []
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
      completedRhythmIds: [...data.completedRhythmIds]
    }
  };
}

export function validatePreviewEnvelope(value: unknown, currentDate: string): PreviewValidationResult {
  if (!isValidDate(currentDate)) {
    return { valid: false, kind: 'invalid', message: 'The current date used to validate this preview is invalid.' };
  }
  if (!isRecord(value) || !hasOnlyKeys(value, envelopeKeys)) {
    return { valid: false, kind: 'invalid', message: 'The backup envelope has an invalid structure.' };
  }
  if (value.format !== PREVIEW_BACKUP_FORMAT || value.schemaVersion !== PREVIEW_SCHEMA_VERSION) {
    return { valid: false, kind: 'unsupported', message: 'This preview backup format or schema version is not supported.' };
  }
  if (!isRecord(value.data) || !hasOnlyKeys(value.data, dataKeys)
    || !Array.isArray(value.data.goals) || !Array.isArray(value.data.completedRhythmIds)) {
    return { valid: false, kind: 'invalid', message: 'Preview data must contain goals and completed Rhythm IDs.' };
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
  for (const rhythmId of value.data.completedRhythmIds) {
    if (typeof rhythmId !== 'string' || !supportedRhythmIds.has(rhythmId) || completedRhythmIds.has(rhythmId)) {
      return { valid: false, kind: 'invalid', message: 'Completed Rhythm references must be unique known Today examples.' };
    }
    completedRhythmIds.add(rhythmId);
  }

  return {
    valid: true,
    envelope: createPreviewEnvelope({
      goals,
      completedRhythmIds: [...completedRhythmIds]
    })
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
