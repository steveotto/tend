import { areas, syntheticPeople, todayRhythms } from './preview-data.ts';
import type { PersonId, RhythmPreview } from './preview-data.ts';
import {
  rhythmTimeOptions,
  rhythmTimeValueFromLabel,
  rhythmScheduleSummary,
  validateRhythmSchedule
} from './rhythm-schedule.ts';
import type { RhythmSchedule, RhythmTimeLabel, RhythmTimeValue } from './rhythm-schedule.ts';

export const rhythmCadences = [
  'Daily',
  '3 times a week',
  '5 times a week',
  'Weekly',
  'Quarterly'
] as const;

export const rhythmTimes = ['Morning', 'Afternoon', 'Evening', 'Anytime'] as const;

export type RhythmCadence = (typeof rhythmCadences)[number];
export type RhythmTime = (typeof rhythmTimes)[number];
export type RhythmCategoryId = (typeof areas)[number]['id'];

export type SavedRhythm = {
  id: string;
  title: string;
  description?: string;
  cadence: string;
  timeLabel: RhythmTime | RhythmTimeLabel;
  personIds: PersonId[];
  categoryIds: RhythmCategoryId[];
  timeOfDay?: RhythmTimeValue;
  schedule?: RhythmSchedule;
  personal?: boolean;
};

export type RhythmDraft = {
  title: string;
  description: string;
  cadence: string;
  timeLabel: string;
  personIds: PersonId[];
  categoryIds: RhythmCategoryId[];
  schedule?: RhythmSchedule;
  scheduleEditing?: boolean;
  personal?: boolean;
};

export type RhythmDraftErrors = Partial<Record<keyof RhythmDraft | 'schedule', string>>;

const existingEditableIds = new Set(todayRhythms.map(rhythm => rhythm.id));
const personIds = new Set(syntheticPeople.map(person => person.id));
const categoryIds = new Set(areas.map(area => area.id));
const savedRhythmKeys = ['id', 'title', 'description', 'cadence', 'timeLabel', 'personIds', 'categoryIds'];
const savedRhythmV4Keys = [...savedRhythmKeys, 'timeOfDay', 'schedule', 'personal'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every(key => keys.includes(key));
}

function isUniqueKnownValues<T extends string>(values: unknown, knownValues: Set<string>): values is T[] {
  if (!Array.isArray(values)) return false;
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== 'string' || !knownValues.has(value) || seen.has(value)) return false;
    seen.add(value);
  }
  return true;
}

export function isEditableRhythmId(id: string): boolean {
  return existingEditableIds.has(id) || /^user-rhythm-[0-9a-f-]{36}$/i.test(id);
}

export function validateSavedRhythms(value: unknown): value is SavedRhythm[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  for (const record of value) {
    if (!isRecord(record) || !hasOnlyKeys(record, savedRhythmKeys)) return false;
    if (typeof record.id !== 'string' || !isEditableRhythmId(record.id) || ids.has(record.id)) return false;
    if (typeof record.title !== 'string' || record.title.trim().length === 0 || record.title.length > 80) return false;
    if (record.description !== undefined
      && (typeof record.description !== 'string' || record.description.length > 1000)) return false;
    if (!rhythmCadences.includes(record.cadence as RhythmCadence)
      || !rhythmTimes.includes(record.timeLabel as RhythmTime)) return false;
    if (!isUniqueKnownValues<PersonId>(record.personIds, personIds)
      || !isUniqueKnownValues<RhythmCategoryId>(record.categoryIds, categoryIds)) return false;
    ids.add(record.id);
  }
  return true;
}

export function validateSavedRhythmsV4(value: unknown): value is SavedRhythm[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  const labels = new Set<string>(rhythmTimeOptions.map(option => option.label));
  for (const record of value) {
    if (!isRecord(record) || !hasOnlyKeys(record, savedRhythmV4Keys)) return false;
    if (typeof record.cadence !== 'string' || record.cadence.trim().length === 0 || record.cadence.length > 160) return false;
    if (typeof record.timeLabel !== 'string' || !labels.has(record.timeLabel)) return false;
    if (rhythmTimeValueFromLabel(record.timeLabel) !== record.timeOfDay) return false;
    if (record.personal !== undefined && typeof record.personal !== 'boolean') return false;
    if (record.schedule !== undefined && !validateRhythmSchedule(record.schedule).valid) return false;

    const legacyCompatibleRecord = {
      id: record.id,
      title: record.title,
      ...(record.description === undefined ? {} : { description: record.description }),
      cadence: rhythmCadences.includes(record.cadence as RhythmCadence) ? record.cadence : 'Daily',
      timeLabel: rhythmTimes.includes(record.timeLabel as RhythmTime) ? record.timeLabel : 'Anytime',
      personIds: record.personIds,
      categoryIds: record.categoryIds
    };
    if (!validateSavedRhythms([legacyCompatibleRecord])) return false;
    const id = record.id as string;
    if (ids.has(id)) return false;
    ids.add(id);
  }
  return true;
}

export function rhythmDraftFrom(rhythm: RhythmPreview, categoryIds: readonly RhythmCategoryId[] = []): RhythmDraft {
  return {
    title: rhythm.title,
    description: rhythm.description ?? '',
    cadence: rhythm.cadence ?? 'Daily',
    timeLabel: rhythm.timeLabel ?? 'Anytime',
    personIds: [...(rhythm.personIds ?? [])],
    categoryIds: [...categoryIds],
    ...(rhythm.schedule === undefined ? {} : { schedule: rhythm.schedule }),
    scheduleEditing: rhythm.schedule !== undefined,
    ...(rhythm.personal === undefined ? {} : { personal: rhythm.personal })
  };
}

export function validateRhythmDraft(draft: RhythmDraft): RhythmDraftErrors {
  const errors: RhythmDraftErrors = {};
  if (!draft.title.trim()) errors.title = 'Enter a Rhythm title.';
  else if (draft.title.trim().length > 80) errors.title = 'Use 80 characters or fewer.';
  if (draft.description.length > 1000) errors.description = 'Use 1,000 characters or fewer.';
  if (typeof draft.cadence !== 'string' || draft.cadence.trim().length === 0 || draft.cadence.length > 160) {
    errors.cadence = 'Choose a supported cadence.';
  }
  if (rhythmTimeValueFromLabel(draft.timeLabel) === undefined) errors.timeLabel = 'Choose a time of day.';
  if (draft.scheduleEditing && draft.schedule === undefined) {
    errors.schedule = 'Complete the schedule details before saving.';
  } else if (draft.schedule !== undefined && !validateRhythmSchedule(draft.schedule).valid) {
    errors.schedule = 'Choose a valid schedule.';
  }
  if (!isUniqueKnownValues<PersonId>(draft.personIds, personIds)) {
    errors.personIds = 'Choose each available synthetic person at most once.';
  }
  if (!isUniqueKnownValues<RhythmCategoryId>(draft.categoryIds, categoryIds)) {
    errors.categoryIds = 'Choose each available category at most once.';
  }
  return errors;
}

export function saveRhythmDraft(
  savedRhythms: readonly SavedRhythm[],
  draft: RhythmDraft,
  id: string,
  mode: 'create' | 'edit'
): { savedRhythms?: SavedRhythm[]; errors: RhythmDraftErrors } {
  const errors = validateRhythmDraft(draft);
  const hasSavedRecord = savedRhythms.some(rhythm => rhythm.id === id);
  if (mode === 'create') {
    if (!/^user-rhythm-[0-9a-f-]{36}$/i.test(id) || hasSavedRecord || existingEditableIds.has(id)) {
      errors.title = 'A new Rhythm needs a unique preview ID.';
    }
  } else if (!isEditableRhythmId(id) || (!hasSavedRecord && !existingEditableIds.has(id))) {
    errors.title = 'This Rhythm is not eligible for editing.';
  }
  if (savedRhythms.filter(rhythm => rhythm.id === id).length > 1) {
    errors.title = 'This Rhythm has conflicting saved edits and cannot be changed.';
  }
  if (Object.keys(errors).length > 0) return { errors };

  const existing = savedRhythms.find(rhythm => rhythm.id === id);
  const timeOfDay = rhythmTimeValueFromLabel(draft.timeLabel);
  const scheduleChanged = draft.schedule !== undefined && draft.schedule !== existing?.schedule;
  const cadence = draft.schedule
    ? scheduleChanged || existing === undefined
      ? rhythmScheduleSummary(draft.schedule)
      : existing.cadence
    : existing?.cadence ?? draft.cadence;
  const schedule = draft.schedule ?? existing?.schedule;
  const saved: SavedRhythm = {
    id,
    title: draft.title.trim(),
    ...(draft.description.length === 0 ? {} : { description: draft.description }),
    cadence,
    timeLabel: draft.timeLabel as RhythmTimeLabel,
    personIds: [...draft.personIds],
    categoryIds: [...draft.categoryIds],
    ...(schedule === undefined ? {} : { schedule }),
    ...(draft.personal === undefined
      ? existing?.personal === undefined ? {} : { personal: existing.personal }
      : { personal: draft.personal }),
    ...(timeOfDay === undefined ? {} : { timeOfDay })
  };
  return {
    savedRhythms: [
      ...savedRhythms.filter(rhythm => rhythm.id !== id),
      saved
    ],
    errors
  };
}

export function resolveTodayRhythms(savedRhythms: readonly SavedRhythm[]): RhythmPreview[] {
  const savedById = new Map(savedRhythms.map(rhythm => [rhythm.id, rhythm]));
  const editable = todayRhythms.map(rhythm => {
    const saved = savedById.get(rhythm.id);
    if (!saved) return rhythm;
    return {
      ...rhythm,
      title: saved.title,
      description: saved.description,
      cadence: saved.cadence,
      timeLabel: saved.timeLabel,
      personIds: saved.personIds,
      categoryIds: saved.categoryIds,
      ...(saved.schedule === undefined ? {} : { schedule: saved.schedule }),
      ...(saved.personal === undefined ? {} : { personal: saved.personal })
    };
  });

  const custom = savedRhythms
    .filter(rhythm => !existingEditableIds.has(rhythm.id))
    .map(rhythm => ({
      id: rhythm.id,
      title: rhythm.title,
      ...(rhythm.description === undefined ? {} : { description: rhythm.description }),
      cadence: rhythm.cadence,
      timeLabel: rhythm.timeLabel,
      automation: 'manual' as const,
      status: 'Due today' as const,
      personIds: rhythm.personIds,
      categoryIds: rhythm.categoryIds,
      ...(rhythm.schedule === undefined ? {} : { schedule: rhythm.schedule }),
      ...(rhythm.personal === undefined ? {} : { personal: rhythm.personal })
    }));

  return [...editable, ...custom];
}

export function activeTodayRhythms(
  rhythms: readonly RhythmPreview[],
  archivedRhythmIds: readonly string[]
): RhythmPreview[] {
  const archived = new Set(archivedRhythmIds);
  return rhythms.filter(rhythm => !archived.has(rhythm.id));
}

export function archivedTodayRhythms(
  rhythms: readonly RhythmPreview[],
  archivedRhythmIds: readonly string[]
): RhythmPreview[] {
  const archived = new Set(archivedRhythmIds);
  return rhythms.filter(rhythm => archived.has(rhythm.id));
}

export function archiveRhythmId(
  savedRhythms: readonly SavedRhythm[],
  archivedRhythmIds: readonly string[],
  id: string
): string[] | undefined {
  if (!resolveTodayRhythms(savedRhythms).some(rhythm => rhythm.id === id)
    || archivedRhythmIds.includes(id)) return undefined;
  return [...archivedRhythmIds, id];
}

export function restoreRhythmId(
  savedRhythms: readonly SavedRhythm[],
  archivedRhythmIds: readonly string[],
  id: string
): string[] | undefined {
  if (!resolveTodayRhythms(savedRhythms).some(rhythm => rhythm.id === id)
    || !archivedRhythmIds.includes(id)) return undefined;
  return archivedRhythmIds.filter(archivedId => archivedId !== id);
}

export function rhythmsForCategory(
  rhythms: readonly RhythmPreview[],
  categoryId: RhythmCategoryId
): RhythmPreview[] {
  return rhythms.filter(rhythm => rhythm.categoryIds?.includes(categoryId) === true);
}
