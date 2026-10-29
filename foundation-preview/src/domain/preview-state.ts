import {
  currencyFractionDigits,
  isValidDate,
  moneyInputValue,
  validateGoalDraft
} from './money-goals.ts';
import type { MoneyGoal } from './money-goals.ts';
import { goals as sampleGoals, todayRhythms } from './preview-data.ts';
import {
  createPersonPickerGroups,
  migrateLegacyFriendIdsIntoPeopleGroups,
  validatePersonPickerGroups
} from './preview-data.ts';
import type { ActiveRhythmCompletion, DatedRhythmCompletion, RhythmCompletionRecord } from './rhythm-completion.ts';
import { localDateTimeInZone } from './rhythm-completion.ts';
import {
  validateSavedRhythms,
  validateSavedRhythmsV4,
  validateSavedRhythmsV7,
  validateSavedRhythmsV8,
  validateSavedRhythmsV9,
  validateSavedRhythmsV11,
  validateSavedRhythmsV12,
  validateSavedRhythmsV13,
  validateSavedRhythmsV14,
  validateSavedRhythmsV17,
  validateSavedRhythmsV18
} from './rhythm-editor.ts';
import { validateSavedRhythmsV10 } from './rhythm-editor.ts';
import type { SavedRhythm } from './rhythm-editor.ts';
import { rhythmTimeValueFromLabel, rhythmTimeValueFromLegacyLabel } from './rhythm-schedule.ts';
import type {
  RhythmSchedule,
  RhythmScheduleHistorySegment,
  RhythmScoringMetadata,
  RhythmScoringMetadataV8
} from './rhythm-schedule.ts';
import {
  createRhythmSeason,
  createUnknownRhythmSeason,
  rhythmSeasonPaletteForOrdinal
} from './rhythm-seasons.ts';
import { legacySuggestionSourceForRhythmId } from './category-rhythms.ts';
import { createStrengthData, validateStrengthData } from './strength.ts';
import type { StrengthData } from './strength.ts';
import { createWeightData, validateWeightDataShape } from './weight.ts';
import type { WeightData } from './weight.ts';
import { createCardioData, validateCardioDataShape } from './cardio.ts';
import type { CardioData } from './cardio.ts';
import {
  createFriendshipData,
  getLegacyFriendIdsV19,
  migrateLegacyFriendshipDataV19,
  validateFriendshipData,
  validateLegacyFriendshipDataV19
} from './friendships.ts';
import type { FriendshipData } from './friendships.ts';

export const PREVIEW_BACKUP_FORMAT = 'tend.synthetic-preview';
export const PREVIEW_SCHEMA_VERSION = 20;

export type PreviewData = {
  goals: MoneyGoal[];
  completedRhythmIds: string[];
  savedRhythms: SavedRhythm[];
  archivedRhythmIds: string[];
  datedRhythmCompletions: DatedRhythmCompletion[];
  activeRhythmCompletions: ActiveRhythmCompletion[];
  rhythmCompletionOverrides: RhythmCompletionRecord[];
  removedSeedCompletionIds: string[];
  rhythmHistoryIds: string[];
  strength: StrengthData;
  weight: WeightData;
  cardio: CardioData;
  friendships: FriendshipData;
  peopleGroups: ReturnType<typeof createPersonPickerGroups>;
  [key: string]: unknown;
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
  | { valid: true; envelope: PreviewEnvelope; sourceSchemaVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 }
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
const dataKeysV9 = dataKeysV8;
const dataKeysV10 = [...dataKeysV9, 'rhythmHistoryIds'];
const dataKeysV11 = dataKeysV10;
const dataKeysV12 = dataKeysV11;
const dataKeysV13 = dataKeysV12;
const dataKeysV14 = dataKeysV13;
const dataKeysV15 = [...dataKeysV14, 'strength'];
const dataKeysV16 = dataKeysV15;
const dataKeysV17 = [...dataKeysV16, 'weight'];
const dataKeysV18 = [...dataKeysV17, 'cardio'];
const dataKeysV19 = [...dataKeysV18, 'friendships'];
const dataKeysV20 = [...dataKeysV19, 'peopleGroups'];
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
    removedSeedCompletionIds: [],
    rhythmHistoryIds: [],
    strength: createStrengthData(),
    weight: createWeightData(),
    cardio: createCardioData(),
    friendships: createFriendshipData(),
    peopleGroups: createPersonPickerGroups()
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
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return false;
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return false;
  const canonical = timestamp.toISOString();
  return canonical === value || canonical.replace(/\.000Z$/, 'Z') === value;
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
      ...data,
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
        ...(rhythm.primaryFoundationId === undefined ? {} : { primaryFoundationId: rhythm.primaryFoundationId }),
        ...(rhythm.secondaryFoundationIds === undefined
          ? {}
          : { secondaryFoundationIds: [...rhythm.secondaryFoundationIds] }),
        ...(rhythm.suggestionSourceId === undefined ? {} : { suggestionSourceId: rhythm.suggestionSourceId }),
        ...(rhythm.healthLogCapability === undefined ? {} : { healthLogCapability: rhythm.healthLogCapability }),
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
      removedSeedCompletionIds: [...data.removedSeedCompletionIds],
      rhythmHistoryIds: [...data.rhythmHistoryIds],
      strength: {
        settings: {
          muscleIntervals: { ...data.strength.settings.muscleIntervals },
          preferredRestDays: { ...data.strength.settings.preferredRestDays }
        },
        savedWorkouts: data.strength.savedWorkouts.map(workout => ({
          ...workout,
          muscleIds: [...workout.muscleIds],
          sharedWith: [...workout.sharedWith]
        })),
        workouts: data.strength.workouts.map(workout => ({ ...workout, muscleIds: [...workout.muscleIds] })),
        rhythmModes: data.strength.rhythmModes.map(mode => ({ ...mode }))
      },
      weight: {
        ...data.weight,
        goals: isRecord(data.weight.goals) ? { ...data.weight.goals } : data.weight.goals,
        weighIns: data.weight.weighIns.map(record => isRecord(record) ? { ...record } : record)
      },
      cardio: {
        ...data.cardio,
        goals: isRecord(data.cardio.goals) ? { ...data.cardio.goals } : data.cardio.goals,
        runs: data.cardio.runs.map(record => isRecord(record) ? { ...record } : record)
      },
      friendships: {
        ...data.friendships,
        cadenceSettings: data.friendships.cadenceSettings.map(setting => ({ ...setting })),
        connections: data.friendships.connections.map(connection => ({
          ...connection,
          participantIds: [...connection.participantIds]
        }))
      },
      peopleGroups: data.peopleGroups.map(group => ({ ...group, memberIds: [...group.memberIds] }))
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
      ...segment,
      ...(segment.kind === 'scheduled' ? { schedule: cloneRhythmSchedule(segment.schedule) } : {})
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
      && value.schemaVersion !== 6 && value.schemaVersion !== 7 && value.schemaVersion !== 8
      && value.schemaVersion !== 9
      && value.schemaVersion !== 10 && value.schemaVersion !== 11 && value.schemaVersion !== 12 && value.schemaVersion !== 13
      && value.schemaVersion !== 14 && value.schemaVersion !== 15 && value.schemaVersion !== 16
      && value.schemaVersion !== 17 && value.schemaVersion !== 18
      && value.schemaVersion !== 19
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
  const isV9 = value.schemaVersion === 9;
  const isV10 = value.schemaVersion === 10;
  const isV11 = value.schemaVersion === 11;
  const isV12 = value.schemaVersion === 12;
  const isV13 = value.schemaVersion === 13;
  const isV14 = value.schemaVersion === 14;
  const isV15 = value.schemaVersion === 15;
  const isV16 = value.schemaVersion === 16;
  const isV17 = value.schemaVersion === 17;
  const isV18 = value.schemaVersion === 18;
  const isV19 = value.schemaVersion === 19;
  const isV20 = value.schemaVersion === 20;
  const hasCurrentFriendshipsData = isV19 || isV20;
  const hasCardio = isV18 || hasCurrentFriendshipsData;
  const allowedDataKeys = isV1 ? dataKeysV1 : isV2 ? dataKeysV2
    : isV3 || isV4 ? dataKeysV3
      : isV20 ? dataKeysV20 : isV19 ? dataKeysV19 : isV18 ? dataKeysV18 : isV17 ? dataKeysV17 : isV16 ? dataKeysV16 : isV15 ? dataKeysV15 : isV14 ? dataKeysV14 : isV13 ? dataKeysV13
        : isV11 || isV12 ? dataKeysV12 : isV10 ? dataKeysV10
      : isV8 || isV9 ? dataKeysV8 : isV7 ? dataKeysV7 : isV6 ? dataKeysV6 : dataKeysV5;
  if (!isRecord(value.data) || (!hasCurrentFriendshipsData && !hasOnlyKeys(value.data, allowedDataKeys))
    || !Array.isArray(value.data.goals) || !Array.isArray(value.data.completedRhythmIds)
    || ((isV5 || isV6 || isV7 || isV8 || isV9 || isV10 || isV11 || isV12 || isV13 || isV14 || isV15 || isV16 || isV17 || hasCurrentFriendshipsData)
      && (!Array.isArray(value.data.datedRhythmCompletions)
      || !Array.isArray(value.data.activeRhythmCompletions)))
    || ((isV6 || isV7 || isV8 || isV9 || isV10 || isV11 || isV12 || isV13 || isV14 || isV15 || isV16 || isV17 || hasCurrentFriendshipsData) && (!Array.isArray(value.data.rhythmCompletionOverrides)
      || !Array.isArray(value.data.removedSeedCompletionIds)))) {
    return { valid: false, kind: 'invalid', message: 'Preview data must contain goals and completed Rhythm IDs.' };
  }
  if ((isV10 || isV11 || isV12 || isV13 || isV14 || isV15 || isV16 || isV17 || isV18 || hasCurrentFriendshipsData) && !Array.isArray(value.data.rhythmHistoryIds)) {
    return { valid: false, kind: 'invalid', message: 'Rhythm history references must be a list.' };
  }
  if (!isV1 && !((isV4 || isV5 || isV6 || isV7 || isV8 || isV9 || isV10 || isV11 || isV12 || isV13 || isV14 || isV15 || isV16 || isV17 || isV18 || hasCurrentFriendshipsData)
    ? isV18 || hasCurrentFriendshipsData ? validateSavedRhythmsV18(value.data.savedRhythms)
      : isV17 ? validateSavedRhythmsV17(value.data.savedRhythms)
      : isV14 || isV15 || isV16 ? validateSavedRhythmsV14(value.data.savedRhythms)
      : isV13 ? validateSavedRhythmsV13(value.data.savedRhythms)
      : isV12 ? validateSavedRhythmsV12(value.data.savedRhythms)
      : isV11 ? validateSavedRhythmsV11(value.data.savedRhythms)
      : isV10 ? validateSavedRhythmsV10(value.data.savedRhythms)
      : isV9 ? validateSavedRhythmsV9(value.data.savedRhythms)
      : isV8 ? validateSavedRhythmsV8(value.data.savedRhythms)
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
  if (hasCurrentFriendshipsData || isV18 || isV17 || isV16 || isV15 || isV14 || isV13 || isV12 || isV11 || isV10 || isV9) {
    savedRhythms = value.data.savedRhythms as SavedRhythm[];
  } else if (isV7 || isV8) {
    savedRhythms = (value.data.savedRhythms as SavedRhythm[]).map(rhythm => {
      if (!rhythm.scoring) return rhythm;
      const legacyScoring = rhythm.scoring as unknown as RhythmScoringMetadataV8;
      return {
        ...rhythm,
        scoring: {
          trackingStartDate: legacyScoring.trackingStartDate,
          timeZone: legacyScoring.timeZone,
          scheduleHistory: legacyScoring.scheduleHistory.map((segment, ordinal) =>
            createRhythmSeason(
              rhythm.id,
              segment.startDate,
              segment.schedule,
              undefined,
              undefined,
              rhythmSeasonPaletteForOrdinal(ordinal)
            ))
        }
      };
    });
  } else if (isV4 || isV5 || isV6) {
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
  const rawDatedCompletions: unknown[] = isV5 || isV6 || isV7 || isV8 || isV9 || isV10 || isV11 || isV12 || isV13 || isV14 || isV15 || isV16 || isV17 || isV18 || hasCurrentFriendshipsData
    ? value.data.datedRhythmCompletions as unknown[] : [];
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
  const rawActiveCompletions: unknown[] = isV5 || isV6 || isV7 || isV8 || isV9 || isV10 || isV11 || isV12 || isV13 || isV14 || isV15 || isV16 || isV17 || isV18 || hasCurrentFriendshipsData
    ? value.data.activeRhythmCompletions as unknown[] : [];
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
  const rawOverrides: unknown[] = isV6 || isV7 || isV8 || isV9 || isV10 || isV11 || isV12 || isV13 || isV14 || isV15 || isV16 || isV17 || isV18 || hasCurrentFriendshipsData
    ? value.data.rhythmCompletionOverrides as unknown[] : [];
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
  const rawRemovedIds: unknown[] = isV6 || isV7 || isV8 || isV9 || isV10 || isV11 || isV12 || isV13 || isV14 || isV15 || isV16 || isV17 || isV18 || hasCurrentFriendshipsData
    ? value.data.removedSeedCompletionIds as unknown[] : [];
  for (const id of rawRemovedIds) {
    if (typeof id !== 'string' || !syntheticCompletionIds.has(id)
      || removedSeedCompletionIds.has(id) || overrideIds.has(id)) {
      return { valid: false, kind: 'invalid', message: 'Removed seeded completion references must be unique known records without overrides.' };
    }
    removedSeedCompletionIds.add(id);
  }

  const rhythmHistoryIds = new Set<string>();
  const rawRhythmHistoryIds: unknown[] = isV10 || isV11 || isV12 || isV13 || isV14 || isV15 || isV16 || isV17 || isV18 || hasCurrentFriendshipsData
    ? value.data.rhythmHistoryIds as unknown[]
    : datedRhythmCompletions.map(record => record.rhythmId);
  for (const rhythmId of rawRhythmHistoryIds) {
    if (typeof rhythmId !== 'string' || !knownRhythmIds.has(rhythmId) || rhythmHistoryIds.has(rhythmId)) {
      return { valid: false, kind: 'invalid', message: 'Rhythm history references must be unique known Rhythms.' };
    }
    rhythmHistoryIds.add(rhythmId);
  }
  if ((isV10 || isV11 || isV12 || isV13 || isV14 || isV15 || isV16 || isV17 || isV18 || hasCurrentFriendshipsData) && datedRhythmCompletions.some(record => !rhythmHistoryIds.has(record.rhythmId))) {
    return { valid: false, kind: 'invalid', message: 'Dated completion history must retain its Rhythm history marker.' };
  }

  const datesByRhythm = new Map<string, string[]>();
  for (const record of [...datedRhythmCompletions, ...rhythmCompletionOverrides]) {
    const dates = datesByRhythm.get(record.rhythmId) ?? [];
    dates.push(record.effectiveDate);
    datesByRhythm.set(record.rhythmId, dates);
  }
  savedRhythms = savedRhythms.map(rhythm => {
    const suggestionSourceId = !isV14 && !isV15 && !isV16 && !isV17 && !isV18 && !hasCurrentFriendshipsData && rhythm.suggestionSourceId === undefined
      ? legacySuggestionSourceForRhythmId(rhythm.id)
      : rhythm.suggestionSourceId;
    if (!rhythm.scoring && suggestionSourceId === rhythm.suggestionSourceId) return rhythm;
    if (!rhythm.scoring) {
      return suggestionSourceId === undefined ? rhythm : { ...rhythm, suggestionSourceId };
    }
    const history: RhythmScheduleHistorySegment[] = rhythm.scoring.scheduleHistory.map(segment =>
      segment.kind === 'unknown'
        ? segment
        : { ...segment, kind: 'scheduled' }
    );
    const first = history[0];
    const earliestLog = datesByRhythm.get(rhythm.id)?.sort()[0];
    if (first?.kind === 'scheduled' && earliestLog && earliestLog < first.startDate) {
      const seededCadence = todayRhythms.find(item => item.id === rhythm.id)?.cadence;
      history.unshift(createUnknownRhythmSeason(
        rhythm.id,
        earliestLog,
        seededCadence && !todayRhythms.find(item => item.id === rhythm.id)?.schedule
          ? seededCadence
          : undefined
      ));
    }
    return {
      ...rhythm,
      ...(suggestionSourceId === undefined ? {} : { suggestionSourceId }),
      scoring: { ...rhythm.scoring, scheduleHistory: history }
    };
  });

  const strength = isV15 || isV16 || isV17 || isV18 || hasCurrentFriendshipsData ? value.data.strength : createStrengthData();
  if (!validateStrengthData(strength)) {
    return { valid: false, kind: 'invalid', message: 'Strength settings, workouts, or workout history are invalid.' };
  }
  const linkedWorkoutCompletionIds = new Set<string>();
  for (const log of strength.workouts) {
    if (!log.rhythmId || !log.completionId) continue;
    const rhythm = savedRhythms.find(item => item.id === log.rhythmId);
    const completion = datedRhythmCompletions.find(item => item.id === log.completionId);
    if (!rhythm?.categoryIds.includes('health')
      || !completion
      || completion.rhythmId !== log.rhythmId
      || completion.effectiveDate !== log.rhythmOccurrence
      || completion.effectiveDate !== log.date
      || linkedWorkoutCompletionIds.has(log.completionId)) {
      return {
        valid: false,
        kind: 'invalid',
        message: 'A linked Strength workout must reference its Health Rhythm and matching completion.'
      };
    }

    linkedWorkoutCompletionIds.add(log.completionId);
  }

  const weight = isV17 || isV18 || hasCurrentFriendshipsData ? value.data.weight : createWeightData();
  if (!validateWeightDataShape(weight)) {
    return { valid: false, kind: 'invalid', message: 'Weight data must retain its settings and weigh-in records.' };
  }
  const cardio = hasCardio ? value.data.cardio : createCardioData();
  if (!validateCardioDataShape(cardio)) {
    return { valid: false, kind: 'invalid', message: 'Cardio data must retain its goals and run records.' };
  }
  const legacyFriendships = isV19 && validateLegacyFriendshipDataV19(value.data.friendships)
    ? value.data.friendships
    : null;
  const friendships = isV20
    ? value.data.friendships
    : legacyFriendships
      ? migrateLegacyFriendshipDataV19(legacyFriendships)
      : createFriendshipData();
  if ((isV19 && !legacyFriendships) || !validateFriendshipData(friendships)) {
    return { valid: false, kind: 'invalid', message: 'Friendships contain invalid people, cadence settings, or connection records.' };
  }
  const peopleGroups = isV20
    ? value.data.peopleGroups
    : migrateLegacyFriendIdsIntoPeopleGroups(
        createPersonPickerGroups(),
        legacyFriendships ? getLegacyFriendIdsV19(legacyFriendships) : []
      );
  if (!validatePersonPickerGroups(peopleGroups)) {
    return { valid: false, kind: 'invalid', message: 'People categories must contain unique known people.' };
  }

  const envelopeData = {
    ...(hasCurrentFriendshipsData ? value.data : {}),
    goals,
    completedRhythmIds: [...completedRhythmIds],
    savedRhythms,
    archivedRhythmIds: [...archivedRhythmIds],
    datedRhythmCompletions,
    activeRhythmCompletions,
    rhythmCompletionOverrides,
    removedSeedCompletionIds: [...removedSeedCompletionIds],
    rhythmHistoryIds: [...rhythmHistoryIds],
    strength,
    weight,
    cardio,
    friendships,
    peopleGroups
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
