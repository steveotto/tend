import { createEmptyPreviewData, createPreviewEnvelope, validatePreviewEnvelope } from './preview-state.ts';
import type { PreviewData } from './preview-state.ts';
import { isValidPersonPhotoDataUrl, isValidMonthDay } from './person-details.ts';
import type { PersonDetails } from './person-details.ts';
import { isValidPersonId } from './preview-data.ts';
import type { CategoryId, PersonId, PersonPickerGroupId } from './preview-data.ts';
import { createStrengthData, strengthMuscles } from './strength.ts';
import type { StrengthMuscleId, StrengthSavedWorkout, StrengthWorkoutLog } from './strength.ts';
import { poundsToKilograms, validateWeightDataShape } from './weight.ts';
import type { WeightMeasurement } from './weight.ts';
import { cardioGoalSettings, validateCardioDataShape } from './cardio.ts';
import type { CardioRun } from './cardio.ts';
import { createFriendshipData } from './friendships.ts';
import type { ConnectionCadence, FriendshipConnection } from './friendships.ts';
import { resolvePersonCategoryGroups } from './person-categories.ts';
import { validatePersonNotesCollection } from './person-notes.ts';
import type { PersonNote } from './person-notes.ts';
import { isValidTimeZone, rhythmTimeLabel, rhythmTimeValueFromLegacyLabel } from './rhythm-schedule.ts';
import type { RhythmPattern, RhythmSchedule, RhythmTimeValue, RhythmWeekday } from './rhythm-schedule.ts';
import { isValidDate } from './money-goals.ts';
import { readLegacy } from '../../../src/domain/legacy-reader.ts';

export type LegacyImportIssue = {
  path: string;
  count: number;
};

export type LegacyImportExclusion = {
  path: string;
  sourceId: string;
  sourceRhythmId: string;
  reason: string;
};

export type LegacyImportReport = {
  source: {
    people: number;
    rhythms: number;
    events: number;
    notes: number;
    strengthTemplates: number;
    strengthLogs: number;
    cardioRuns: number;
    weightMeasurements: number;
  };
  supported: {
    people: number;
    details: number;
    classifications: number;
    rhythms: number;
    rhythmCompletions: number;
    connections: number;
    cadences: number;
    notes: number;
    strengthSettings: number;
    strengthTemplates: number;
    strengthLogs: number;
    cardioGoals: number;
    cardioRuns: number;
    weightGoals: number;
    weightMeasurements: number;
  };
  unsupported: LegacyImportIssue[];
  ambiguous: LegacyImportIssue[];
  invalid: LegacyImportIssue[];
  excluded: LegacyImportExclusion[];
  resolvedCategoryConflicts: number;
  remappedIds: number;
  remappedRhythmIds: number;
};

export type LegacyImportDryRun = {
  report: LegacyImportReport;
  candidate: PreviewData | null;
  recoveryPackage: string;
};

const legacyTimeValues = new Set<RhythmTimeValue>([
  'anytime', 'all-day', 'early-morning', 'morning', 'lunch',
  'afternoon', 'way-home', 'evening', 'bedtime'
]);
const legacyTimeAliases = new Map<string, RhythmTimeValue>([
  ['early', 'early-morning'],
  ['allday', 'all-day'],
  ['commute', 'way-home']
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function addIssue(issues: LegacyImportIssue[], path: string, count = 1): void {
  const existing = issues.find(issue => issue.path === path);
  if (existing) existing.count += count;
  else issues.push({ path, count });
}

function recordCount(value: unknown): number {
  return Array.isArray(value) ? value.length : value === undefined ? 0 : 1;
}

function deterministicId(sourceId: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const character of sourceId) {
    hash ^= BigInt(character.codePointAt(0)!);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `legacy-person-${hash.toString(16).padStart(16, '0')}`;
}

function deterministicRhythmId(sourceId: string, salt = ''): string {
  const first = deterministicId(`rhythm:${salt}:${sourceId}`).slice(-16);
  const second = deterministicId(`rhythm:${salt}:second:${sourceId}`).slice(-16);
  const third = deterministicId(`rhythm:${salt}:third:${sourceId}`).slice(-4);
  return `user-rhythm-${first}${second}${third}`;
}

function isNonEmptyText(value: unknown, maxLength = 160): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function timestampParts(value: unknown): { iso: string; date: string; time: string } | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const iso = date.toISOString();
  return { iso, date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

function canonicalInstant(value: unknown): value is string {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    && (parsed.toISOString() === value || parsed.toISOString().replace(/\.000Z$/, 'Z') === value);
}

// Mirror fixed defaults from the legacy recurrence evaluator, never its current-date fallbacks.
function legacyInteger(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return Number(value);
  return undefined;
}

function legacyDefaultedInteger(value: unknown, fallback: number): number | undefined {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = legacyInteger(value);
  return parsed === undefined ? undefined : parsed || fallback;
}

function sourceSchedule(row: Record<string, unknown>): RhythmSchedule | null {
  const frequency = row.freq;
  const endDate = row.until === undefined || row.until === null || row.until === '' ? undefined : row.until;
  if (endDate !== undefined && (typeof endDate !== 'string' || !isValidDate(endDate))) return null;
  const end = endDate === undefined ? {} : { endDate };
  const weekdayList = Array.isArray(row.weekdays) && row.weekdays.length > 0
    ? row.weekdays
    : Array.isArray(row.scheduleDows) && row.scheduleDows.length > 0
      ? row.scheduleDows
      : row.scheduleDow !== undefined && row.scheduleDow !== null && row.scheduleDow !== ''
        ? [row.scheduleDow]
        : null;
  const weekdaysFrom = (source: unknown[] | null): RhythmWeekday[] | null => {
    if (!source?.length) return null;
    const values = source.map(legacyInteger);
    if (values.some(value => value === undefined || value < 0 || value > 6)
      || new Set(values).size !== values.length) return null;
    return values as RhythmWeekday[];
  };
  const pattern = (patternFrequency: string): RhythmPattern | null => {
    if (row.monthlyMode === 'onThe') {
      const sourceOrdinal = legacyDefaultedInteger(row.ord, 1);
      const weekday = legacyDefaultedInteger(row.ordWeekday, 0);
      if (sourceOrdinal === undefined || weekday === undefined || weekday < 0 || weekday > 6) return null;
      const ordinal = sourceOrdinal === 5 ? 'last'
        : sourceOrdinal === 1 || sourceOrdinal === 2 || sourceOrdinal === 3 || sourceOrdinal === 4
          ? sourceOrdinal
          : null;
      return ordinal === null ? null : { kind: 'ordinalWeekday', ordinal, weekday: weekday as RhythmWeekday };
    }
    const sourceDay = patternFrequency === 'quarterly' || patternFrequency === 'custom' ? row.dayOfMonth
      : patternFrequency === 'yearly' ? row.monthDay
        : row.dayOfMonth ?? row.monthDay;
    const day = sourceDay === 'last' ? 'last' : legacyDefaultedInteger(sourceDay, 1);
    return day === 'last' || day !== undefined && day >= 1 && day <= 31
      ? { kind: 'dayOfMonth', day }
      : null;
  };
  const sourceStartDate = row.start || row.added; // Legacy recurrence uses the stored added date as its anchor.
  const startDate = typeof sourceStartDate === 'string' && isValidDate(sourceStartDate)
    ? sourceStartDate
    : null;
  if (frequency === 'daily') return { frequency: 'daily', ...end };
  if (frequency === 'weekly' || frequency === 'selectdays') {
    const weekdays = weekdaysFrom(weekdayList)
      ?? (weekdayList === null || weekdayList.length === 0 ? [1] : null);
    return weekdays ? { frequency: 'weekly', weekdays, ...end } : null;
  }
  if (frequency === 'biweekly') {
    const weekdays = weekdaysFrom(weekdayList)
      ?? (weekdayList === null || weekdayList.length === 0 ? [0] : null);
    if (!startDate || !weekdays || weekdays.length !== 1) return null;
    return { frequency: 'custom', unit: 'weeks', interval: 2, weekdays, startDate, ...end };
  }
  if (frequency === 'twicewk') {
    if (!startDate) return null;
    return { frequency: 'custom', unit: 'days', interval: 3, startDate, ...end };
  }
  if (frequency === 'monthly' || frequency === 'quarterly' || frequency === 'yearly') {
    const datePattern = pattern(frequency);
    if (!datePattern) return null;
    if (frequency === 'monthly') return { frequency: 'monthly', pattern: datePattern, ...end };
    if (frequency === 'quarterly') {
      const monthInQuarter = legacyInteger(row.qmonth);
      if (monthInQuarter !== 1 && monthInQuarter !== 2 && monthInQuarter !== 3) return null;
      return { frequency: 'quarterly', monthInQuarter, pattern: datePattern, ...end };
    }
    const month = row.month === undefined || row.month === null || row.month === '' || row.month === 0 || row.month === '0'
      ? 1
      : legacyInteger(row.month);
    if (!Number.isInteger(month) || Number(month) < 1 || Number(month) > 12) return null;
    return { frequency: 'yearly', month: month as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12, pattern: datePattern, ...end };
  }
  if (frequency === 'custom') {
    const unit = row.unit;
    const interval = row.every;
    if (typeof interval !== 'number' || !Number.isInteger(interval) || interval < 1 || interval > 365
      || !startDate) return null;
    if (unit === 'days') return { frequency: 'custom', unit: 'days', interval, startDate, ...end };
    if (unit === 'weeks') {
      const weekdays = weekdaysFrom(weekdayList);
      return weekdays ? { frequency: 'custom', unit: 'weeks', interval, startDate, weekdays, ...end } : null;
    }
    if (unit === 'months') {
      const datePattern = pattern('custom');
      return datePattern ? { frequency: 'custom', unit: 'months', interval, startDate, pattern: datePattern, ...end } : null;
    }
    if (unit === 'years') {
      const datePattern = pattern('custom');
      const month = row.month === undefined || row.month === null || row.month === '' || row.month === 0 || row.month === '0'
        ? 1
        : legacyInteger(row.month);
      if (!datePattern || !Number.isInteger(month) || Number(month) < 1 || Number(month) > 12) return null;
      return { frequency: 'custom', unit: 'years', interval, startDate, month: month as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12, pattern: datePattern, ...end };
    }
  }
  return null;
}

function sourceTimeOfDay(value: unknown): RhythmTimeValue | undefined {
  if (typeof value !== 'string') return undefined;
  const alias = legacyTimeAliases.get(value);
  if (alias) return alias;
  return legacyTimeValues.has(value as RhythmTimeValue)
    ? value as RhythmTimeValue
    : rhythmTimeValueFromLegacyLabel(value);
}

function sourceDate(value: unknown): { monthDay: string; year?: number } | null {
  if (typeof value !== 'string') return null;
  const full = /^(\d{4})-(\d{2}-\d{2})$/.exec(value);
  if (full) {
    const year = Number(full[1]);
    if (!Number.isInteger(year) || year < 1 || !isValidMonthDay(full[2]!)) return null;
    return { monthDay: full[2]!, year };
  }
  if (/^\d{2}-\d{2}$/.test(value) && isValidMonthDay(value)) return { monthDay: value };
  return null;
}

function groupForArea(value: unknown): PersonPickerGroupId | null {
  if (value === 'marriage' || value === 'parenting') return value;
  if (value === 'friendships') return 'friends';
  return null;
}

function createRecoveryPackage(
  originalText: string,
  report: LegacyImportReport,
  parseError?: string,
  excludedRecords: { path: string; sourceRecord: Record<string, unknown> }[] = []
): string {
  return JSON.stringify({
    format: 'tend.legacy-import-recovery',
    schemaVersion: 1,
    sourceText: originalText,
    report,
    excludedRecords,
    ...(parseError ? { parseError } : {})
  }, null, 2);
}

export function analyzeLegacyTendImport(originalText: string, currentDate: string): LegacyImportDryRun {
  const report: LegacyImportReport = {
    source: {
      people: 0,
      rhythms: 0,
      events: 0,
      notes: 0,
      strengthTemplates: 0,
      strengthLogs: 0,
      cardioRuns: 0,
      weightMeasurements: 0
    },
    supported: {
      people: 0,
      details: 0,
      classifications: 0,
      rhythms: 0,
      rhythmCompletions: 0,
      connections: 0,
      cadences: 0,
      notes: 0,
      strengthSettings: 0,
      strengthTemplates: 0,
      strengthLogs: 0,
      cardioGoals: 0,
      cardioRuns: 0,
      weightGoals: 0,
      weightMeasurements: 0
    },
    unsupported: [],
    ambiguous: [],
    invalid: [],
    excluded: [],
    resolvedCategoryConflicts: 0,
    remappedIds: 0,
    remappedRhythmIds: 0
  };
  let document;
  try {
    document = readLegacy(originalText);
  } catch {
    addIssue(report.invalid, '/');
    return { report, candidate: null, recoveryPackage: createRecoveryPackage(originalText, report, 'Source is not valid legacy JSON.') };
  }

  const state = document.state;
  report.source.people = recordCount(state.people);
  report.source.rhythms = document.rhythms.length;
  report.source.events = recordCount(state.events);
  report.source.notes = recordCount(state.personNotes);
  if (isRecord(state.fitness)) {
    report.source.strengthTemplates = recordCount(state.fitness.savedWorkouts);
    report.source.strengthLogs = recordCount(state.fitness.workouts);
    report.source.cardioRuns = recordCount(state.fitness.runs);
    report.source.weightMeasurements = recordCount(state.fitness.weighIns);
  }
  for (const issue of document.issues) {
    if (issue.code === 'unresolved-rhythm') continue;
    const target = issue.code === 'duplicate-id' ? report.ambiguous : report.invalid;
    addIssue(target, issue.path);
  }
  if (!Array.isArray(state.people)) {
    addIssue(report.invalid, '/people');
    return { report, candidate: null, recoveryPackage: createRecoveryPackage(originalText, report) };
  }

  const sourceRows: Record<string, unknown>[] = [];
  const sourceIds = new Set<string>();
  const reservedIds = new Set<string>();
  state.people.forEach((value, index) => {
    const path = `/people/${index}`;
    if (!isRecord(value)) {
      addIssue(report.invalid, path);
      return;
    }
    if (typeof value.id !== 'string' || value.id.trim().length === 0) {
      addIssue(report.invalid, `${path}/id`);
      return;
    }
    if (sourceIds.has(value.id)) {
      return;
    }
    sourceIds.add(value.id);
    sourceRows.push(value);
    if (isValidPersonId(value.id)) reservedIds.add(value.id);
  });

  const candidate = createEmptyPreviewData();
  candidate.strength = createStrengthData();
  const details: PersonDetails[] = [];
  const groups = new Map<PersonPickerGroupId, PersonId[]>([
    ['marriage', []],
    ['parenting', []],
    ['friends', []]
  ]);
  const mappedIds = new Set<PersonId>();
  const personIdMap = new Map<string, PersonId>();

  for (const [index, row] of sourceRows.entries()) {
    const sourceId = row.id as string;
    let id: PersonId = sourceId;
    if (!isValidPersonId(sourceId)) {
      id = deterministicId(sourceId);
      let suffix = 2;
      while (reservedIds.has(id) || mappedIds.has(id)) {
        id = `${deterministicId(sourceId)}-${suffix++}`;
      }
      report.remappedIds++;
    }
    if (typeof row.name !== 'string' || row.name.trim().length === 0 || row.name.length > 120) {
      addIssue(report.invalid, `/people/${index}/name`);
      continue;
    }
    mappedIds.add(id);
    personIdMap.set(sourceId, id);
    candidate.people.push({ id, displayName: row.name });
    report.supported.people++;

    const detail: PersonDetails = { personId: id };
    let hasDetails = false;
    if (row.relation !== undefined) {
      if (typeof row.relation !== 'string' || (row.relation.length > 80)) {
        addIssue(report.invalid, `/people/${index}/relation`);
      } else if (row.relation.length > 0) {
        if (row.relation.trim().length === 0) {
          addIssue(report.invalid, `/people/${index}/relation`);
        } else {
          detail.relationshipLabel = row.relation;
          hasDetails = true;
        }
      }
    }
    for (const field of ['birthday', 'anniversary'] as const) {
      const sourceDateValue = row[field];
      if (sourceDateValue === undefined || sourceDateValue === '') continue;
      const parsed = sourceDate(sourceDateValue);
      if (!parsed) {
        addIssue(report.invalid, `/people/${index}/${field}`);
        continue;
      }
      detail[field] = parsed;
      hasDetails = true;
    }
    if (row.photo !== undefined && row.photo !== '') {
      if (typeof row.photo !== 'string' || !isValidPersonPhotoDataUrl(row.photo)) {
        addIssue(report.invalid, `/people/${index}/photo`);
      } else {
        detail.photoDataUrl = row.photo;
        hasDetails = true;
      }
    }
    if (hasDetails) {
      details.push(detail);
      report.supported.details++;
    }
    const group = groupForArea(row.area);
    if (group) {
      groups.get(group)!.push(id);
      report.supported.classifications++;
    } else if (row.area !== undefined && row.area !== '') {
      addIssue(report.unsupported, `/people/${index}/area`);
    }
    for (const key of Object.keys(row)) {
      if (![
        'id', 'name', 'relation', 'area', 'birthday', 'anniversary', 'photo', 'rhythms',
        'connectCadence', 'connectCadenceSetOn', 'cadenceSetOn', 'cadenceDays'
      ].includes(key)) {
        addIssue(report.unsupported, `/people/${index}/${key}`);
      }
    }
  }

  const rhythmIds = new Set<string>();
  const rhythmIdMap = new Map<string, string>();
  const reservedRhythmIds = new Set(
    document.rhythms
      .map(rhythm => rhythm.value.id)
      .filter((id): id is string => typeof id === 'string'
        && /^user-rhythm-[0-9a-f-]{36}$/i.test(id))
  );
  const usedRhythmIds = new Set<string>();
  for (const rhythm of document.rhythms) {
    const sourceId = rhythm.value.id;
    if (typeof sourceId !== 'string' || sourceId.trim().length === 0 || rhythmIds.has(sourceId)) continue;
    rhythmIds.add(sourceId);
    let targetId = /^user-rhythm-[0-9a-f-]{36}$/i.test(sourceId) ? sourceId : '';
    if (!targetId) {
      let salt = 0;
      do {
        targetId = deterministicRhythmId(sourceId, String(salt++));
      } while (reservedRhythmIds.has(targetId) || usedRhythmIds.has(targetId));
      report.remappedRhythmIds++;
    }
    usedRhythmIds.add(targetId);
    rhythmIdMap.set(sourceId, targetId);
  }

  const categoryIds = new Set<CategoryId>(['faith', 'marriage', 'parenting', 'health', 'finances', 'friendships']);
  const sourceRhythmKeys = new Set([
    'id', 'text', 'title', 'description', 'freq', 'cadence', 'tod', 'weekdays', 'scheduleDows',
    'scheduleDow', 'every', 'unit', 'until', 'start', 'monthlyMode', 'dayOfMonth', 'monthDay',
    'ord', 'ordWeekday', 'qmonth', 'month', 'added', 'areas', 'area', 'category', 'personId',
    'personIds', 'sharedWith', 'ownerId', 'personal', 'fitnessType', 'type', 'healthSubcategory',
    'strengthMode', 'workoutId', 'paused', 'archived', 'disabled'
  ]);
  const importedRhythmIds = new Set<string>();
  const knownMuscles = new Set<string>(strengthMuscles.map(muscle => muscle.id));
  for (const rhythm of document.rhythms) {
    const row = rhythm.value;
    const sourceId = row.id;
    if (typeof sourceId !== 'string' || !rhythmIdMap.has(sourceId)) continue;
    if (row.paused === true || row.disabled === true) {
      addIssue(report.unsupported, `${rhythm.path}/paused`);
      continue;
    }
    const title = typeof row.title === 'string' ? row.title : row.text;
    if (!isNonEmptyText(title, 80)) {
      addIssue(report.invalid, `${rhythm.path}/text`);
      continue;
    }
    if (row.description !== undefined && (typeof row.description !== 'string' || row.description.length > 1000)) {
      addIssue(report.invalid, `${rhythm.path}/description`);
      continue;
    }
    const sourcePersonIds: unknown[] = [];
    if (rhythm.ownerId !== null) sourcePersonIds.push(rhythm.ownerId);
    if (row.personId !== undefined) {
      if (rhythm.ownerId !== null && row.personId === rhythm.ownerId) {
        addIssue(report.unsupported, `${rhythm.path}/personId`);
      } else {
        sourcePersonIds.push(row.personId);
      }
    }
    if (Array.isArray(row.personIds)) sourcePersonIds.push(...row.personIds);
    else if (row.personIds !== undefined) addIssue(report.invalid, `${rhythm.path}/personIds`);
    if (Array.isArray(row.sharedWith)) sourcePersonIds.push(...row.sharedWith);
    else if (row.sharedWith !== undefined) addIssue(report.invalid, `${rhythm.path}/sharedWith`);
    const personRefs: PersonId[] = [];
    for (const sourcePersonId of sourcePersonIds) {
      if (typeof sourcePersonId !== 'string' || !personIdMap.has(sourcePersonId)) {
        addIssue(report.ambiguous, `${rhythm.path}/personIds`);
        continue;
      }
      const targetPersonId = personIdMap.get(sourcePersonId)!;
      if (personRefs.includes(targetPersonId)) addIssue(report.ambiguous, `${rhythm.path}/personIds`);
      else personRefs.push(targetPersonId);
    }
    const sourceCategories = Array.isArray(row.areas)
      ? row.areas
      : row.area !== undefined ? [row.area]
        : row.category !== undefined ? [row.category] : [];
    if (row.areas !== undefined && !Array.isArray(row.areas)) {
      addIssue(report.invalid, `${rhythm.path}/areas`);
      continue;
    }
    const categories: CategoryId[] = [];
    for (const category of sourceCategories) {
      if (typeof category !== 'string' || !categoryIds.has(category as CategoryId)) {
        addIssue(report.unsupported, `${rhythm.path}/areas`);
        continue;
      }
      if (!categories.includes(category as CategoryId)) categories.push(category as CategoryId);
    }
    if (['workout', 'cardio', 'weighin'].includes(String(row.fitnessType ?? row.type))
      && !categories.includes('health')) categories.push('health');
    let schedule: RhythmSchedule | null = null;
    if (row.freq !== undefined && row.freq !== null && row.freq !== '') {
      schedule = sourceSchedule(row);
      if (!schedule) addIssue(report.unsupported, `${rhythm.path}/freq`);
    }
    const timeOfDay = sourceTimeOfDay(row.tod === undefined ? 'anytime' : row.tod);
    if (!timeOfDay) {
      addIssue(report.unsupported, `${rhythm.path}/tod`);
      continue;
    }
    if (row.archived !== undefined && typeof row.archived !== 'boolean') {
      addIssue(report.invalid, `${rhythm.path}/archived`);
      continue;
    }
    if (row.personal !== undefined && typeof row.personal !== 'boolean') {
      addIssue(report.invalid, `${rhythm.path}/personal`);
      continue;
    }
    const cadence = typeof row.cadence === 'string' && row.cadence.trim()
      ? row.cadence
      : schedule?.frequency === 'daily' ? 'Daily'
        : schedule?.frequency === 'weekly' ? 'Weekly'
          : schedule?.frequency === 'quarterly' ? 'Quarterly'
            : schedule?.frequency === 'monthly' ? 'Monthly'
              : schedule?.frequency === 'yearly' ? 'Yearly'
                : schedule?.frequency === 'custom' ? `Every ${schedule.interval} ${schedule.unit}`
                  : typeof row.freq === 'string' ? row.freq : '';
    if (!isNonEmptyText(cadence)) {
      addIssue(report.invalid, `${rhythm.path}/freq`);
      continue;
    }
    const targetRhythm = {
      id: rhythmIdMap.get(sourceId)!,
      title,
      ...(row.description === undefined ? {} : { description: row.description }),
      cadence,
      timeLabel: rhythmTimeLabel(timeOfDay),
      timeOfDay,
      personIds: personRefs,
      categoryIds: categories,
      ...(schedule ? { schedule } : {}),
      ...(typeof row.personal === 'boolean' ? { personal: row.personal } : {}),
      ...(row.archived === true ? { archivedRhythm: true } : {})
    };
    if (row.archived === true) candidate.archivedRhythmIds.push(targetRhythm.id);
    const { archivedRhythm: _archivedRhythm, ...savedRhythm } = targetRhythm;
    candidate.savedRhythms.push(savedRhythm);
    importedRhythmIds.add(targetRhythm.id);
    report.supported.rhythms++;
    const fitnessType = row.fitnessType ?? row.type;
    if (fitnessType === 'workout' && typeof row.strengthMode === 'string') {
      if (row.strengthMode === 'specific' || row.strengthMode === 'recommended' || row.strengthMode === 'custom') {
        candidate.strength.rhythmModes.push({
          rhythmId: targetRhythm.id,
          mode: row.strengthMode,
          ...(row.strengthMode === 'specific' && typeof row.workoutId === 'string'
            ? { workoutId: row.workoutId } : {})
        });
      } else {
        addIssue(report.unsupported, `${rhythm.path}/strengthMode`);
      }
    }
    for (const key of Object.keys(row)) {
      if (!sourceRhythmKeys.has(key)) addIssue(report.unsupported, `${rhythm.path}/${key}`);
    }
  }

  const importedConnections: FriendshipConnection[] = [];
  const connectionType = (event: Record<string, unknown>): FriendshipConnection['type'] | null => {
    const sourceType = event.type ?? event.kind;
    if (sourceType === 'text') return 'text';
    if (sourceType === 'call') return 'call';
    if (sourceType === 'inperson') return 'time-together';
    return null;
  };
  const sourceFitness = isRecord(state.fitness) ? state.fitness : null;
  const fitnessRows = sourceFitness
    ? ['workouts', 'runs', 'weighIns'].flatMap(key => Array.isArray(sourceFitness[key])
      ? sourceFitness[key] as unknown[] : [])
    : [];
  const referencedEventIds = new Set<string>();
  for (const value of fitnessRows) {
    if (!isRecord(value)) continue;
    for (const key of ['id', 'completionId', 'eventId']) {
      if (typeof value[key] === 'string') referencedEventIds.add(value[key] as string);
    }
  }
  for (const event of document.events) {
    for (const key of ['fitnessLogId', 'completionId']) {
      if (typeof event.value[key] === 'string') {
        referencedEventIds.add(event.value[key] as string);
      }
    }
  }
  const excludedEventPaths = new Set<string>();
  const excludedRecoveryRecords: { path: string; sourceRecord: Record<string, unknown> }[] = [];
  for (const event of document.events) {
    const row = event.value;
    const sourceId = row.id;
    const sourceRhythmId = row.rhythmId;
    const eventHasReaderDefect = document.issues.some(issue =>
      issue.path === event.path && (issue.code === 'duplicate-id' || issue.code === 'missing-id'));
    const type = row.type ?? row.kind;
    if (typeof sourceId !== 'string' || !sourceId.trim()
      || typeof sourceRhythmId !== 'string' || !sourceRhythmId.trim()
      || rhythmIdMap.has(sourceRhythmId)
      || connectionType(row) !== null
      || typeof type !== 'string' || !type.trim()
      || !timestampParts(row.ts)
      || row.fitnessLogId !== undefined
      || referencedEventIds.has(sourceId)
      || eventHasReaderDefect) continue;

    const exclusion: LegacyImportExclusion = {
      path: event.path,
      sourceId,
      sourceRhythmId,
      reason: 'Unsupported historical event kind has a Rhythm ID absent from every source Rhythm location; the event is excluded without inferring a replacement association.'
    };
    report.excluded.push(exclusion);
    addIssue(report.unsupported, `${event.path}/type`);
    excludedEventPaths.add(event.path);
    excludedRecoveryRecords.push({ path: event.path, sourceRecord: row });
  }
  const fitnessEventsByLogId = new Map<string, { value: Record<string, unknown>; path: string }[]>();
  for (const event of document.events) {
    const row = event.value;
    if (excludedEventPaths.has(event.path)) continue;
    if (row.fitnessLogId !== undefined) {
      if (typeof row.fitnessLogId !== 'string' || row.fitnessLogId.trim().length === 0) {
        addIssue(report.ambiguous, `${event.path}/fitnessLogId`);
      } else {
        const linked = fitnessEventsByLogId.get(row.fitnessLogId) ?? [];
        linked.push({ value: row, path: event.path });
        fitnessEventsByLogId.set(row.fitnessLogId, linked);
        for (const key of Object.keys(row)) {
          if (!['id', 'ts', 'areaId', 'personId', 'type', 'kind', 'title', 'note',
            'rhythmId', 'fitnessLogId', 'rhythmOccurrence', 'fitnessType', 'weight',
            'completionNote'].includes(key)) {
            addIssue(report.unsupported, `${event.path}/${key}`);
          }
        }
        if (row.weight !== undefined) addIssue(report.unsupported, `${event.path}/weight`);
      }
      continue;
    }
    if (row.rhythmId !== undefined && row.rhythmId !== null
      && (typeof row.rhythmId !== 'string' || !row.rhythmId.trim())) {
      addIssue(report.ambiguous, `${event.path}/rhythmId`);
      continue;
    }
    if (typeof row.rhythmId === 'string') {
      const rhythmId = rhythmIdMap.get(row.rhythmId);
      if (!rhythmId) {
        addIssue(report.ambiguous, `${event.path}/rhythmId`);
        continue;
      }
      if (!importedRhythmIds.has(rhythmId)) {
        addIssue(report.unsupported, `${event.path}/rhythmId`);
        continue;
      }
      if (row.date !== undefined && row.rhythmOccurrence !== undefined
        && row.date !== row.rhythmOccurrence) {
        addIssue(report.ambiguous, `${event.path}/date`);
        continue;
      }
      const completionDate = row.rhythmOccurrence ?? row.date;
      const parts = timestampParts(row.ts);
      if (typeof completionDate !== 'string' || !isValidDate(completionDate) || !parts
        || parts.date !== completionDate) {
        addIssue(report.unsupported, `${event.path}/ts`);
        continue;
      }
      if (completionDate > currentDate) {
        addIssue(report.invalid, `${event.path}/ts`);
        continue;
      }
      const id = isNonEmptyText(row.id)
        ? `legacy-completion-${row.id}`
        : `legacy-completion-${deterministicId(`${event.path}:${row.rhythmId}`)}`;
      for (const key of Object.keys(row)) {
        if (!['id', 'rhythmId', 'rhythmOccurrence', 'date', 'ts', 'completionNote', 'type', 'kind', 'areaId'].includes(key)) {
          addIssue(report.unsupported, `${event.path}/${key}`);
        }
      }
      const memory = typeof row.completionNote === 'string' ? row.completionNote : undefined;
      candidate.datedRhythmCompletions.push({
        id,
        rhythmId,
        effectiveDate: completionDate,
        localTime: parts.time,
        timeZone: 'UTC',
        completedAt: parts.iso,
        recordedAt: parts.iso,
        ...(memory?.trim() ? { memory } : {})
      });
      report.supported.rhythmCompletions++;
      continue;
    }
    const type = connectionType(row);
    if (!type) {
      addIssue(report.unsupported, `${event.path}/type`);
      continue;
    }
    const sourcePeople: unknown[] = [];
    if (row.personId !== undefined) sourcePeople.push(row.personId);
    if (Array.isArray(row.personIds)) sourcePeople.push(...row.personIds);
    else if (row.personIds !== undefined) {
      addIssue(report.invalid, `${event.path}/personIds`);
      continue;
    }
    if (sourcePeople.length === 0) {
      addIssue(report.unsupported, `${event.path}/personId`);
      continue;
    }
    const participants: PersonId[] = [];
    for (const sourcePerson of sourcePeople) {
      if (typeof sourcePerson !== 'string' || !personIdMap.has(sourcePerson)) {
        addIssue(report.ambiguous, `${event.path}/personIds`);
        continue;
      }
      const targetPerson = personIdMap.get(sourcePerson)!;
      if (participants.includes(targetPerson)) addIssue(report.ambiguous, `${event.path}/personIds`);
      else participants.push(targetPerson);
    }
    if (participants.length !== sourcePeople.length) continue;
    let date: string;
    let time: string | undefined;
    if (typeof row.date === 'string' && isValidDate(row.date)) {
      date = row.date;
      if (row.time !== undefined && (typeof row.time !== 'string'
        || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(row.time))) {
        addIssue(report.invalid, `${event.path}/time`);
        continue;
      }
      time = typeof row.time === 'string' ? row.time : undefined;
    } else {
      addIssue(report.unsupported, `${event.path}/date`);
      continue;
    }
    if (date > currentDate) {
      addIssue(report.invalid, `${event.path}/date`);
      continue;
    }
    if (!isNonEmptyText(row.id)) {
      addIssue(report.invalid, `${event.path}/id`);
      continue;
    }
    if (row.note !== undefined && (typeof row.note !== 'string' || row.note.length > 4000)) {
      addIssue(report.invalid, `${event.path}/note`);
      continue;
    }
    for (const key of Object.keys(row)) {
      if (!['id', 'type', 'kind', 'personId', 'personIds', 'date', 'time', 'note'].includes(key)) {
        addIssue(report.unsupported, `${event.path}/${key}`);
      }
    }
    importedConnections.push({
      id: row.id,
      type,
      date,
      ...(time ? { time } : {}),
      participantIds: participants,
      ...(typeof row.note === 'string' && row.note ? { notes: row.note } : {})
    });
    report.supported.connections++;
  }

  const cadenceMap: Record<string, ConnectionCadence> = {
    daily: 'daily',
    weekly: 'weekly',
    biweekly: 'two-weeks',
    monthly: 'monthly'
  };
  const cadenceSettings = createFriendshipData().cadenceSettings;
  for (const [index, row] of sourceRows.entries()) {
    if (row.connectCadence === undefined) {
      if (row.connectCadenceSetOn !== undefined || row.cadenceSetOn !== undefined || row.cadenceDays !== undefined) {
        addIssue(report.unsupported, `/people/${index}/connectCadence`);
      }
      continue;
    }
    const cadence = typeof row.connectCadence === 'string' ? cadenceMap[row.connectCadence] : undefined;
    const setOn = row.connectCadenceSetOn ?? row.cadenceSetOn;
    const personId = personIdMap.get(row.id as string);
    if (!cadence) {
      addIssue(report.unsupported, `/people/${index}/connectCadence`);
      continue;
    }
    if (row.cadenceDays !== undefined) {
      addIssue(report.unsupported, `/people/${index}/cadenceDays`);
      continue;
    }
    if (!personId || typeof setOn !== 'string' || !isValidDate(setOn)) {
      addIssue(report.unsupported, `/people/${index}/connectCadenceSetOn`);
      continue;
    }
    cadenceSettings.push({ personId, cadence, setOn });
    report.supported.cadences++;
  }

  const sourceNotes = state.personNotes;
  const importedNotes: PersonNote[] = [];
  const noteIds = new Set<string>();
  if (sourceNotes !== undefined) {
    if (!Array.isArray(sourceNotes)) {
      addIssue(report.invalid, '/personNotes');
    } else {
      for (const [index, value] of sourceNotes.entries()) {
        const path = `/personNotes/${index}`;
        if (!isRecord(value)) {
          addIssue(report.invalid, path);
          continue;
        }
        const noteFields = new Set(['id', 'personId', 'sharedWith', 'content', 'createdAt', 'updatedAt']);
        const unsupportedNoteFields = Object.keys(value).filter(key => !noteFields.has(key));
        if (unsupportedNoteFields.length > 0) {
          for (const key of unsupportedNoteFields) addIssue(report.unsupported, `${path}/${key}`);
          continue;
        }
        if (typeof value.personId !== 'string' || !personIdMap.has(value.personId)) {
          addIssue(report.ambiguous, `${path}/personId`);
          continue;
        }
        if (!isNonEmptyText(value.id) || !canonicalInstant(value.createdAt) || !canonicalInstant(value.updatedAt)
          || typeof value.content !== 'string' || !value.content.trim() || value.content.length > 10_000
          || Date.parse(value.updatedAt) < Date.parse(value.createdAt)) {
          addIssue(report.invalid, path);
          continue;
        }
        if (noteIds.has(value.id)) {
          addIssue(report.ambiguous, `${path}/id`);
          continue;
        }
        const sharedWith = Array.isArray(value.sharedWith) ? value.sharedWith : [];
        if (value.sharedWith !== undefined && !Array.isArray(value.sharedWith)) {
          addIssue(report.invalid, `${path}/sharedWith`);
          continue;
        }
        const mappedShared = sharedWith.map(id => typeof id === 'string' ? personIdMap.get(id) : undefined);
        if (mappedShared.some(id => !id) || new Set(sharedWith).size !== sharedWith.length
          || sharedWith.includes(value.personId)) {
          addIssue(report.ambiguous, `${path}/sharedWith`);
          continue;
        }
        importedNotes.push({
          id: value.id,
          personId: personIdMap.get(value.personId)!,
          ...(mappedShared.length ? { sharedWith: mappedShared as PersonId[] } : {}),
          content: value.content,
          createdAt: value.createdAt,
          updatedAt: value.updatedAt
        });
        noteIds.add(value.id);
        report.supported.notes++;
      }
      if (!validatePersonNotesCollection(importedNotes, candidate.people.map(person => person.id))) {
        addIssue(report.invalid, '/personNotes');
      }
    }
  }

  candidate.personNotes = importedNotes;
  candidate.friendships = { ...createFriendshipData(), cadenceSettings, connections: importedConnections };
  candidate.rhythmHistoryIds = [...importedRhythmIds];

  if (state.fitness !== undefined) {
    if (!isRecord(state.fitness)) {
      addIssue(report.invalid, '/fitness');
    } else {
      const fitness = state.fitness;
      const settings = fitness.settings;
      candidate.strength = createStrengthData();
      if (settings !== undefined && !isRecord(settings)) {
        addIssue(report.invalid, '/fitness/settings');
      } else if (isRecord(settings)) {
        const strengthSettings = candidate.strength.settings;
        for (const [sourceKey, targetKey] of [
          ['muscleIntervals', 'muscleIntervals'],
          ['preferredRestDays', 'preferredRestDays']
        ] as const) {
          const sourceValue = settings[sourceKey];
          if (sourceValue === undefined) continue;
          if (!isRecord(sourceValue)) {
            addIssue(report.invalid, `/fitness/settings/${sourceKey}`);
            continue;
          }
          const mapped = { ...strengthSettings[targetKey] };
          for (const [muscleId, number] of Object.entries(sourceValue)) {
            if (!knownMuscles.has(muscleId) || !Number.isInteger(number)) {
              addIssue(report.invalid, `/fitness/settings/${sourceKey}/${muscleId}`);
              continue;
            }
            mapped[muscleId as StrengthMuscleId] = number as number;
          }
          strengthSettings[targetKey] = mapped;
        }
        if (settings.weightUnit !== undefined) {
          if (settings.weightUnit !== 'lb' && settings.weightUnit !== 'kg') {
            addIssue(report.invalid, '/fitness/settings/weightUnit');
          } else {
            strengthSettings.weightUnit = settings.weightUnit;
            candidate.weight.displayUnit = settings.weightUnit;
          }
        }
        report.supported.strengthSettings = Number(
          settings.muscleIntervals !== undefined
          || settings.preferredRestDays !== undefined
          || settings.weightUnit !== undefined
        );

        const runTarget = settings.weeklyRunTarget;
        const mileTarget = settings.weeklyMileTarget;
        if (runTarget !== undefined || mileTarget !== undefined) {
          if (runTarget === null && mileTarget === null) {
            candidate.cardio.goals = { weeklyRunTarget: null, weeklyMileTarget: null };
          } else if (typeof runTarget === 'number' && typeof mileTarget === 'number'
            && cardioGoalSettings({ weeklyRunTarget: runTarget, weeklyMileTarget: mileTarget })) {
            candidate.cardio.goals = { weeklyRunTarget: runTarget, weeklyMileTarget: mileTarget };
            report.supported.cardioGoals++;
          } else {
            addIssue(report.invalid, '/fitness/settings/weeklyRunTarget');
          }
        }

        const weightValues = [
          settings.startWeight, settings.startDate, settings.targetWeight, settings.goalDate
        ];
        if (weightValues.some(value => value !== undefined && value !== null && value !== '')) {
          const weightUnit = settings.weightUnit === undefined ? 'lb' : settings.weightUnit;
          if ((weightUnit !== 'lb' && weightUnit !== 'kg')
            || typeof settings.startWeight !== 'number' || settings.startWeight <= 0
            || typeof settings.targetWeight !== 'number' || settings.targetWeight <= 0
            || typeof settings.startDate !== 'string' || !isValidDate(settings.startDate)
            || typeof settings.goalDate !== 'string' || !isValidDate(settings.goalDate)
            || settings.goalDate <= settings.startDate
            || settings.startDate > currentDate) {
            addIssue(report.invalid, '/fitness/settings/startWeight');
          } else {
            candidate.weight.displayUnit = weightUnit;
            candidate.weight.goals = {
              startWeightKg: weightUnit === 'lb' ? poundsToKilograms(settings.startWeight) : settings.startWeight,
              startDate: settings.startDate,
              targetWeightKg: weightUnit === 'lb' ? poundsToKilograms(settings.targetWeight) : settings.targetWeight,
              goalDate: settings.goalDate
            };
            report.supported.weightGoals++;
          }
        }
        const knownSettingKeys = new Set([
          'muscleIntervals', 'preferredRestDays', 'weightUnit', 'weeklyRunTarget',
          'weeklyMileTarget', 'startWeight', 'startDate', 'targetWeight', 'goalDate'
        ]);
        for (const key of Object.keys(settings)) {
          if (!knownSettingKeys.has(key)) addIssue(report.unsupported, `/fitness/settings/${key}`);
        }
      }

      const mapPersonList = (value: unknown, path: string): PersonId[] | null => {
        if (value === undefined) return [];
        if (!Array.isArray(value)) {
          addIssue(report.invalid, path);
          return null;
        }
        const mapped: PersonId[] = [];
        for (const sourceId of value) {
          if (typeof sourceId !== 'string' || !personIdMap.has(sourceId)) {
            addIssue(report.ambiguous, path);
            return null;
          }
          const targetId = personIdMap.get(sourceId)!;
          if (mapped.includes(targetId)) {
            addIssue(report.ambiguous, path);
            return null;
          }
          mapped.push(targetId);
        }
        return mapped;
      };
      const fitnessArray = (key: string): unknown[] => {
        const value = fitness[key];
        if (value === undefined) return [];
        if (!Array.isArray(value)) {
          addIssue(report.invalid, `/fitness/${key}`);
          return [];
        }
        return value;
      };
      const importedFitnessEventIds = new Set<string>();
      const fitnessCompletionFor = (
        raw: Record<string, unknown>,
        kind: 'workout' | 'cardio' | 'weighin',
        path: string
      ): { rhythmId: string; rhythmOccurrence: string; completionId: string } | null | undefined => {
        const hasLink = raw.rhythmId !== undefined || raw.rhythmOccurrence !== undefined
          || raw.completionId !== undefined || raw.fitnessType !== undefined;
        if (!hasLink) return undefined;
        if (typeof raw.rhythmId !== 'string' || typeof raw.rhythmOccurrence !== 'string'
          || !isValidDate(raw.rhythmOccurrence) || raw.rhythmOccurrence !== raw.date
          || raw.fitnessType !== kind || raw.completionId !== undefined) {
          addIssue(report.ambiguous, `${path}/rhythmId`);
          return null;
        }
        const rhythmId = rhythmIdMap.get(raw.rhythmId);
        const sourceRhythm = document.rhythms.find(item => item.value.id === raw.rhythmId)?.value;
        const expectedType = sourceRhythm?.fitnessType ?? sourceRhythm?.type;
        if (!rhythmId || !importedRhythmIds.has(rhythmId) || expectedType !== kind) {
          addIssue(report.ambiguous, `${path}/rhythmId`);
          return null;
        }
        const matchingEvents = fitnessEventsByLogId.get(raw.id as string) ?? [];
        if (matchingEvents.length !== 1) {
          addIssue(report.ambiguous, `${path}/fitnessLogId`);
          return null;
        }
        const event = matchingEvents[0]!.value;
        const parts = timestampParts(event.ts);
        if (event.rhythmId !== raw.rhythmId || event.rhythmOccurrence !== raw.rhythmOccurrence
          || event.fitnessType !== kind || !isNonEmptyText(event.id)
          || !parts || parts.date !== raw.rhythmOccurrence
          || typeof event.completionNote === 'string' && event.completionNote.length > 1000) {
          addIssue(report.ambiguous, `${path}/fitnessLogId`);
          return null;
        }
        const completionId = `legacy-completion-${event.id}`;
        if (candidate.datedRhythmCompletions.some(completion => completion.id === completionId)) {
          addIssue(report.ambiguous, `${path}/fitnessLogId`);
          return null;
        }
        candidate.datedRhythmCompletions.push({
          id: completionId,
          rhythmId,
          effectiveDate: raw.rhythmOccurrence,
          localTime: parts.time,
          timeZone: 'UTC',
          completedAt: parts.iso,
          recordedAt: parts.iso,
          ...(typeof event.completionNote === 'string' && event.completionNote.trim()
            ? { memory: event.completionNote } : {})
        });
        importedFitnessEventIds.add(event.id);
        report.supported.rhythmCompletions++;
        return { rhythmId, rhythmOccurrence: raw.rhythmOccurrence, completionId };
      };
      const legacyTemplates = fitnessArray('savedWorkouts');
      const templateIds = new Set<string>();
      const templates: StrengthSavedWorkout[] = [];
      for (const [index, raw] of legacyTemplates.entries()) {
        const path = `/fitness/savedWorkouts/${index}`;
        if (!isRecord(raw) || !isNonEmptyText(raw.id) || !isNonEmptyText(raw.name, 120)
          || !Array.isArray(raw.muscleIds)
          || !raw.muscleIds.every(id => typeof id === 'string' && knownMuscles.has(id))
          || raw.muscleIds.length === 0 || new Set(raw.muscleIds).size !== raw.muscleIds.length) {
          addIssue(report.invalid, path);
          continue;
        }
        if (templateIds.has(raw.id)) {
          addIssue(report.ambiguous, `${path}/id`);
          continue;
        }
        const sharedWith = mapPersonList(raw.sharedWith, `${path}/sharedWith`);
        if (!sharedWith) continue;
        templateIds.add(raw.id);
        templates.push({
          id: raw.id,
          name: raw.name,
          muscleIds: raw.muscleIds as StrengthMuscleId[],
          sharedWith
        });
        report.supported.strengthTemplates++;
        for (const key of Object.keys(raw)) {
          if (!['id', 'name', 'muscleIds', 'sharedWith'].includes(key)) {
            addIssue(report.unsupported, `${path}/${key}`);
          }
        }
      }
      candidate.strength.savedWorkouts = templates;

      const legacyWorkouts = fitnessArray('workouts');
      const workoutIds = new Set<string>();
      const workouts: StrengthWorkoutLog[] = [];
      for (const [index, raw] of legacyWorkouts.entries()) {
        const path = `/fitness/workouts/${index}`;
        if (!isRecord(raw) || !isNonEmptyText(raw.id) || typeof raw.date !== 'string'
          || !isValidDate(raw.date) || raw.date > currentDate
          || !Array.isArray(raw.muscleIds) || raw.muscleIds.length === 0
          || !raw.muscleIds.every(id => typeof id === 'string' && knownMuscles.has(id))
          || new Set(raw.muscleIds).size !== raw.muscleIds.length) {
          addIssue(report.invalid, path);
          continue;
        }
        if (workoutIds.has(raw.id)) {
          addIssue(report.ambiguous, `${path}/id`);
          continue;
        }
        if (raw.exercises !== undefined || raw.supersetGroups !== undefined) {
          addIssue(report.unsupported, `${path}/exercises`);
          continue;
        }
        if (raw.savedWorkoutId !== undefined
          && (typeof raw.savedWorkoutId !== 'string' || !templateIds.has(raw.savedWorkoutId))) {
          addIssue(report.ambiguous, `${path}/savedWorkoutId`);
          continue;
        }
        const hasWorkoutTimes = raw.startedAt !== undefined || raw.finishedAt !== undefined || raw.timeZone !== undefined;
        if (hasWorkoutTimes && (!canonicalInstant(raw.startedAt) || !canonicalInstant(raw.finishedAt)
          || !isValidTimeZone(raw.timeZone))) {
          addIssue(report.invalid, `${path}/startedAt`);
          continue;
        }
        if (raw.notes !== undefined && (typeof raw.notes !== 'string' || raw.notes.length > 1000)
          || raw.workoutName !== undefined && (typeof raw.workoutName !== 'string' || raw.workoutName.length > 120)) {
          addIssue(report.invalid, path);
          continue;
        }
        const sharedWith = mapPersonList(raw.sharedWith, `${path}/sharedWith`);
        if (!sharedWith) continue;
        const completionLink = fitnessCompletionFor(raw, 'workout', path);
        if (completionLink === null) continue;
        workoutIds.add(raw.id);
        workouts.push({
          id: raw.id,
          date: raw.date,
          muscleIds: raw.muscleIds as StrengthMuscleId[],
          ...(typeof raw.notes === 'string' && raw.notes ? { notes: raw.notes } : {}),
          ...(typeof raw.savedWorkoutId === 'string' ? { savedWorkoutId: raw.savedWorkoutId } : {}),
          ...(typeof raw.workoutName === 'string' && raw.workoutName ? { workoutName: raw.workoutName } : {}),
          ...(hasWorkoutTimes ? {
            startedAt: raw.startedAt as string,
            finishedAt: raw.finishedAt as string,
            timeZone: raw.timeZone as string
          } : {}),
          ...(completionLink ? completionLink : {}),
          ...(sharedWith.length ? { sharedWith } : {})
        });
        report.supported.strengthLogs++;
        for (const key of Object.keys(raw)) {
          if (![
            'id', 'date', 'muscleIds', 'notes', 'savedWorkoutId', 'workoutName',
            'sharedWith', 'rhythmId', 'rhythmOccurrence', 'completionId', 'fitnessType', 'exercises',
            'supersetGroups', 'startedAt', 'finishedAt', 'timeZone'
          ].includes(key)) addIssue(report.unsupported, `${path}/${key}`);
        }
      }
      candidate.strength.workouts = workouts;

      const legacyRuns = fitnessArray('runs');
      const runs: CardioRun[] = [];
      const runIds = new Set<string>();
      for (const [index, raw] of legacyRuns.entries()) {
        const path = `/fitness/runs/${index}`;
        if (isRecord(raw) && raw.unit !== undefined && raw.unit !== 'mi') {
          addIssue(report.unsupported, `${path}/unit`);
          continue;
        }
        if (!isRecord(raw) || !isNonEmptyText(raw.id) || typeof raw.date !== 'string'
          || !isValidDate(raw.date) || raw.date > currentDate
          || !isNonNegativeNumber(raw.distance) || raw.distance <= 0
          || raw.notes !== undefined && (typeof raw.notes !== 'string' || raw.notes.length > 1000)) {
          addIssue(report.invalid, path);
          continue;
        }
        if (runIds.has(raw.id)) {
          addIssue(report.ambiguous, `${path}/id`);
          continue;
        }
        const completionLink = fitnessCompletionFor(raw, 'cardio', path);
        if (completionLink === null) continue;
        runs.push({
          id: raw.id,
          date: raw.date,
          distance: raw.distance,
          ...(typeof raw.notes === 'string' && raw.notes ? { notes: raw.notes } : {}),
          ...(completionLink ? completionLink : {})
        });
        runIds.add(raw.id);
        report.supported.cardioRuns++;
        for (const key of Object.keys(raw)) {
          if (!['id', 'date', 'distance', 'unit', 'notes', 'rhythmId',
            'rhythmOccurrence', 'completionId', 'fitnessType'].includes(key)) {
            addIssue(report.unsupported, `${path}/${key}`);
          }
        }
      }
      candidate.cardio.runs = runs;

      const legacyMeasurements = fitnessArray('weighIns');
      const measurements: WeightMeasurement[] = [];
      const measurementIds = new Set<string>();
      const displayUnit = candidate.weight.displayUnit === 'kg' ? 'kg' : 'lb';
      for (const [index, raw] of legacyMeasurements.entries()) {
        const path = `/fitness/weighIns/${index}`;
        if (isRecord(raw) && raw.unit !== undefined && raw.unit !== 'lb' && raw.unit !== 'kg') {
          addIssue(report.unsupported, `${path}/unit`);
          continue;
        }
        const unit = isRecord(raw) && (raw.unit === 'lb' || raw.unit === 'kg') ? raw.unit : displayUnit;
        if (!isRecord(raw) || !isNonEmptyText(raw.id) || typeof raw.date !== 'string'
          || !isValidDate(raw.date) || raw.date > currentDate
          || !isNonNegativeNumber(raw.weight) || raw.weight <= 0
          || raw.unit !== undefined && raw.unit !== 'lb' && raw.unit !== 'kg'
          || raw.notes !== undefined && (typeof raw.notes !== 'string' || raw.notes.length > 1000)) {
          addIssue(report.invalid, path);
          continue;
        }
        if (measurementIds.has(raw.id)) {
          addIssue(report.ambiguous, `${path}/id`);
          continue;
        }
        if (raw.unit === undefined) {
          addIssue(report.unsupported, `${path}/unit`);
          continue;
        }
        const completionLink = fitnessCompletionFor(raw, 'weighin', path);
        if (completionLink === null) continue;
        measurements.push({
          id: raw.id,
          date: raw.date,
          weightKg: unit === 'lb' ? poundsToKilograms(raw.weight) : raw.weight,
          ...(typeof raw.notes === 'string' && raw.notes ? { notes: raw.notes } : {}),
          ...(completionLink ? completionLink : {})
        });
        measurementIds.add(raw.id);
        report.supported.weightMeasurements++;
        for (const key of Object.keys(raw)) {
          if (!['id', 'date', 'weight', 'unit', 'notes', 'rhythmId',
            'rhythmOccurrence', 'completionId', 'fitnessType'].includes(key)) {
            addIssue(report.unsupported, `${path}/${key}`);
          }
        }
      }
      candidate.weight.weighIns = measurements;

      for (const events of fitnessEventsByLogId.values()) {
        for (const event of events) {
          if (typeof event.value.id !== 'string' || !importedFitnessEventIds.has(event.value.id)) {
            addIssue(report.ambiguous, `${event.path}/fitnessLogId`);
          }
        }
      }

      const knownFitnessKeys = new Set([
        'version', 'settings', 'rhythms', 'savedWorkouts', 'workouts', 'runs', 'weighIns'
      ]);
      for (const key of Object.keys(fitness)) {
        if (!knownFitnessKeys.has(key)) addIssue(report.unsupported, `/fitness/${key}`, recordCount(fitness[key]));
      }
      if (!validateWeightDataShape(candidate.weight)) addIssue(report.invalid, '/fitness/weighIns');
      if (!validateCardioDataShape(candidate.cardio, true)) addIssue(report.invalid, '/fitness/runs');
    }
  }

  const consumedRootKeys = new Set([
    'people', 'version', 'schemaVersion', 'databaseVersion', 'rhythms', 'areaRhythms',
    'events', 'personNotes', 'fitness'
  ]);
  for (const key of Object.keys(state)) {
    if (!consumedRootKeys.has(key)) addIssue(report.unsupported, `/${key}`, recordCount(state[key]));
  }

  candidate.personDetails = details;
  const importedGroups = candidate.peopleGroups.map(group => ({
    ...group,
    memberIds: groups.get(group.id) ?? []
  }));
  const resolvedCategories = resolvePersonCategoryGroups(importedGroups);
  candidate.peopleGroups = resolvedCategories.groups;
  report.resolvedCategoryConflicts = resolvedCategories.resolvedPeople;
  report.supported.classifications = candidate.peopleGroups.reduce(
    (total, group) => total + group.memberIds.length,
    0
  );
  const validation = validatePreviewEnvelope(createPreviewEnvelope(candidate), currentDate);
  if (!validation.valid) addIssue(report.invalid, '/people');

  const candidateIsSafe = report.invalid.length === 0 && report.ambiguous.length === 0 && validation.valid;
  const recoveryPackage = createRecoveryPackage(originalText, report, undefined, excludedRecoveryRecords);
  return {
    report,
    candidate: candidateIsSafe ? candidate : null,
    recoveryPackage
  };
}
