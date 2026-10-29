import {
  areas,
  foundationCatalogue,
  foundationTerminologyForCategory,
  marriageRhythms,
  syntheticPeople,
  todayRhythms,
  type CategoryId
} from './preview-data.ts';
import type { FoundationPreview, PersonId, RhythmPreview } from './preview-data.ts';
import {
  effectiveRhythmSchedule,
  rhythmTimeOptions,
  rhythmTimeLabel,
  rhythmTimeValueFromLabel,
  rhythmScheduleSummary,
  validateRhythmSchedule,
  validateRhythmScoringMetadata,
  validateRhythmScoringMetadataV10,
  validateRhythmScoringMetadataV11,
  validateRhythmScoringMetadataV8,
  isValidTimeZone
} from './rhythm-schedule.ts';
import type { RhythmSchedule, RhythmScoringMetadata, RhythmTimeLabel, RhythmTimeValue } from './rhythm-schedule.ts';
import {
  createRhythmSeason,
  createUnknownRhythmSeason,
  ensureRhythmSeasonHistoryCoverage,
  rhythmSeasonPaletteForOrdinal
} from './rhythm-seasons.ts';
import { isValidDate } from './money-goals.ts';
import { rhythmSchedulesEqual } from './rhythm-occurrences.ts';
import { rhythmSeasonForDate } from './rhythm-seasons.ts';
import { resolveRhythmSeasonRange } from './rhythm-season-range.ts';
import { foundationOwnershipError } from './foundation-rhythm-associations.ts';
import { isValidSuggestionSourceId } from './category-rhythms.ts';

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
export type RhythmCategoryId = CategoryId;

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
  scoring?: RhythmScoringMetadata;
  createdLocalDate?: string;
  createdTimeZone?: string;
  dailyBackfillAllowed?: boolean;
  primaryFoundationId?: string | null;
  secondaryFoundationIds?: string[];
  suggestionSourceId?: string;
  healthLogCapability?: 'weight' | 'cardio';
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
  originalSchedule?: RhythmSchedule;
  originalScoring?: RhythmScoringMetadata;
  seasonName?: string;
  primaryFoundationId?: string | null;
  secondaryFoundationIds?: string[];
  healthLogCapability?: 'weight' | 'cardio';
};

export type RhythmDraftErrors = Partial<Record<keyof RhythmDraft | 'schedule' | 'foundationIds', string>>;

export function createRhythmDraft(categoryIds: readonly RhythmCategoryId[] = []): RhythmDraft {
  return {
    title: '',
    description: '',
    cadence: 'Daily',
    timeLabel: 'Anytime',
    personIds: [],
    categoryIds: [...categoryIds],
    schedule: { frequency: 'daily' },
    scheduleEditing: true,
    personal: false
  };
}

const existingEditableIds = new Set(todayRhythms.map(rhythm => rhythm.id));
const fixtureRhythmIds = new Set([...todayRhythms, ...marriageRhythms].map(rhythm => rhythm.id));
const personIds = new Set(syntheticPeople.map(person => person.id));
const categoryIds = new Set(areas.map(area => area.id));
const savedRhythmKeys = ['id', 'title', 'description', 'cadence', 'timeLabel', 'personIds', 'categoryIds'];
const savedRhythmV4Keys = [...savedRhythmKeys, 'timeOfDay', 'schedule', 'personal'];
const savedRhythmV7Keys = [...savedRhythmV4Keys, 'scoring'];
const savedRhythmV8Keys = [...savedRhythmV7Keys, 'createdLocalDate', 'createdTimeZone', 'dailyBackfillAllowed'];
const savedRhythmV9Keys = savedRhythmV8Keys;
const savedRhythmV13Keys = [...savedRhythmV9Keys, 'primaryFoundationId', 'secondaryFoundationIds'];
const savedRhythmV14Keys = [...savedRhythmV13Keys, 'suggestionSourceId'];
const savedRhythmV17Keys = [...savedRhythmV14Keys, 'healthLogCapability'];
const savedRhythmV18Keys = savedRhythmV17Keys;

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

function isKnownSavedRhythmId(id: string): boolean {
  return fixtureRhythmIds.has(id) || /^user-rhythm-[0-9a-f-]{36}$/i.test(id);
}

export function validateSavedRhythms(value: unknown): value is SavedRhythm[] {
  return validateSavedRhythmsWithIdPolicy(value, isEditableRhythmId);
}

function validateSavedRhythmsWithIdPolicy(
  value: unknown,
  acceptsId: (id: string) => boolean
): value is SavedRhythm[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  for (const record of value) {
    if (!isRecord(record) || !hasOnlyKeys(record, savedRhythmKeys)) return false;
    if (typeof record.id !== 'string' || !acceptsId(record.id) || ids.has(record.id)) return false;
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
  return validateSavedRhythmsWithKeys(value, savedRhythmV4Keys, 'none');
}

export function validateSavedRhythmsV7(value: unknown): value is SavedRhythm[] {
  return validateSavedRhythmsWithKeys(value, savedRhythmV7Keys, 'v8');
}

export function validateSavedRhythmsV8(value: unknown): value is SavedRhythm[] {
  return validateSavedRhythmsWithKeys(value, savedRhythmV8Keys, 'v8');
}

export function validateSavedRhythmsV9(value: unknown): value is SavedRhythm[] {
  return validateSavedRhythmsWithKeys(value, savedRhythmV9Keys, 'v10');
}

export function validateSavedRhythmsV10(value: unknown): value is SavedRhythm[] {
  return validateSavedRhythmsWithKeys(value, savedRhythmV9Keys, 'v10');
}

export function validateSavedRhythmsV11(value: unknown): value is SavedRhythm[] {
  return validateSavedRhythmsWithKeys(value, savedRhythmV9Keys, 'v11');
}

export function validateSavedRhythmsV12(value: unknown): value is SavedRhythm[] {
  return validateSavedRhythmsWithKeys(value, savedRhythmV9Keys, 'v12');
}

export function validateSavedRhythmsV13(value: unknown): value is SavedRhythm[] {
  if (!validateSavedRhythmsWithKeys(value, savedRhythmV13Keys, 'v12', true)) return false;
  return validateFoundationAssociations(value);
}

export function validateSavedRhythmsV14(value: unknown): value is SavedRhythm[] {
  if (!validateSavedRhythmsWithKeys(value, savedRhythmV14Keys, 'v12', true)) return false;
  if (!validateFoundationAssociations(value)) return false;
  return value.every(record =>
    record.suggestionSourceId === undefined || isValidSuggestionSourceId(record.suggestionSourceId)
  );
}

export function validateSavedRhythmsV17(value: unknown): value is SavedRhythm[] {
  return validateSavedRhythmsWithCapability(value, savedRhythmV17Keys, 'weight');
}

export function validateSavedRhythmsV18(value: unknown): value is SavedRhythm[] {
  return validateSavedRhythmsWithCapability(value, savedRhythmV18Keys, 'weight', 'cardio');
}

function validateSavedRhythmsWithCapability(
  value: unknown,
  allowedKeys: readonly string[],
  ...capabilities: Array<'weight' | 'cardio'>
): value is SavedRhythm[] {
  if (!validateSavedRhythmsWithKeys(value, allowedKeys, 'v12', true)) return false;
  if (!validateFoundationAssociations(value)) return false;
  return value.every(record =>
    (record.suggestionSourceId === undefined || isValidSuggestionSourceId(record.suggestionSourceId))
    && (record.healthLogCapability === undefined
      || capabilities.includes(record.healthLogCapability)
        && record.categoryIds.includes('health'))
  );
}

function validateFoundationAssociations(value: unknown): value is SavedRhythm[] {
  if (!Array.isArray(value)) return false;
  return value.every(record => {
    if (!isRecord(record)) return false;
    if (record.primaryFoundationId !== undefined && record.primaryFoundationId !== null
      && (typeof record.primaryFoundationId !== 'string' || record.primaryFoundationId.length === 0)) return false;
    if (record.secondaryFoundationIds !== undefined) {
      if (!Array.isArray(record.secondaryFoundationIds)) return false;
      const seen = new Set<string>();
      for (const id of record.secondaryFoundationIds) {
        if (typeof id !== 'string' || id.length === 0 || id === record.primaryFoundationId || seen.has(id)) return false;
        seen.add(id);
      }
    }
    return true;
  });
}

function validateSavedRhythmsWithKeys(
  value: unknown,
  allowedKeys: readonly string[],
  scoringVersion: 'none' | 'v8' | 'v10' | 'v11' | 'v12',
  allowMarriageFixtureIds = false
): value is SavedRhythm[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  const labels = new Set<string>(rhythmTimeOptions.map(option => option.label));
  for (const record of value) {
    if (!isRecord(record) || !hasOnlyKeys(record, allowedKeys)) return false;
    if (typeof record.cadence !== 'string' || record.cadence.trim().length === 0 || record.cadence.length > 160) return false;
    if (typeof record.timeLabel !== 'string' || !labels.has(record.timeLabel)) return false;
    if (rhythmTimeValueFromLabel(record.timeLabel) !== record.timeOfDay) return false;
    if (record.personal !== undefined && typeof record.personal !== 'boolean') return false;
    if (record.schedule !== undefined
      && !validateRhythmSchedule(record.schedule, scoringVersion === 'v12').valid) return false;
    if ((record.createdLocalDate === undefined) !== (record.createdTimeZone === undefined)
      || record.createdLocalDate !== undefined
        && (typeof record.createdLocalDate !== 'string' || !isValidDate(record.createdLocalDate)
          || !isValidTimeZone(record.createdTimeZone))) return false;
    if (record.dailyBackfillAllowed !== undefined && typeof record.dailyBackfillAllowed !== 'boolean') return false;
    if (record.scoring !== undefined) {
      const validScoring = scoringVersion === 'v8'
        ? validateRhythmScoringMetadataV8(record.scoring)
        : scoringVersion === 'v10'
          ? validateRhythmScoringMetadataV10(record.scoring)
          : scoringVersion === 'v11'
            ? validateRhythmScoringMetadataV11(record.scoring)
            : validateRhythmScoringMetadata(record.scoring);
      if (!validScoring || record.schedule === undefined || !isRecord(record.scoring)
        || !Array.isArray(record.scoring.scheduleHistory)) return false;
      const matchingSchedule = record.scoring.scheduleHistory.some(segment =>
        isRecord(segment)
        && JSON.stringify(segment.schedule) === JSON.stringify(record.schedule)
      );
      if (!matchingSchedule) return false;
    }

    const legacyCompatibleRecord = {
      id: record.id,
      title: record.title,
      ...(record.description === undefined ? {} : { description: record.description }),
      cadence: rhythmCadences.includes(record.cadence as RhythmCadence) ? record.cadence : 'Daily',
      timeLabel: rhythmTimes.includes(record.timeLabel as RhythmTime) ? record.timeLabel : 'Anytime',
      personIds: record.personIds,
      categoryIds: record.categoryIds
    };
    const validLegacyRecord = allowMarriageFixtureIds
      ? validateSavedRhythmsWithIdPolicy([legacyCompatibleRecord], isKnownSavedRhythmId)
      : validateSavedRhythms([legacyCompatibleRecord]);
    if (!validLegacyRecord) return false;
    const id = record.id as string;
    if (ids.has(id)) return false;
    ids.add(id);
  }
  return true;
}

export function rhythmDraftFrom(
  rhythm: RhythmPreview,
  categoryIds: readonly RhythmCategoryId[] = [],
  asOfDate?: string
): RhythmDraft {
  const currentSeason = asOfDate
    ? rhythmSeasonForDate(rhythm.scoring?.scheduleHistory ?? [], asOfDate)
    : rhythm.scoring?.scheduleHistory.at(-1);
  const originalSchedule = currentSeason?.kind === 'unknown'
    ? undefined
    : currentSeason?.kind === 'scheduled'
      ? currentSeason.schedule
      : effectiveRhythmSchedule(rhythm.schedule, rhythm.cadence);
  return {
    title: rhythm.title,
    description: rhythm.description ?? '',
    cadence: rhythm.cadence ?? 'Daily',
    timeLabel: currentSeason?.kind === 'scheduled' && currentSeason.timeOfDay
      ? rhythmTimeLabel(currentSeason.timeOfDay)
      : rhythm.timeLabel ?? 'Anytime',
    personIds: [...(rhythm.personIds ?? [])],
    categoryIds: [...categoryIds],
    ...(originalSchedule === undefined ? {} : { schedule: originalSchedule }),
    ...(originalSchedule === undefined ? {} : { originalSchedule }),
    ...(rhythm.scoring === undefined ? {} : {
      originalScoring: rhythm.scoring
    }),
    ...(currentSeason?.kind === 'scheduled' && currentSeason.name
      ? { seasonName: currentSeason.name }
      : {}),
    scheduleEditing: originalSchedule !== undefined && rhythm.schedule !== undefined,
    ...(rhythm.personal === undefined ? {} : { personal: rhythm.personal }),
    ...(rhythm.primaryFoundationId === undefined ? {} : { primaryFoundationId: rhythm.primaryFoundationId }),
    ...(rhythm.secondaryFoundationIds === undefined ? {} : { secondaryFoundationIds: [...rhythm.secondaryFoundationIds] }),
    ...(rhythm.healthLogCapability === undefined ? {} : { healthLogCapability: rhythm.healthLogCapability })
  };
}

export function validateRhythmDraft(
  draft: RhythmDraft,
  foundations: readonly FoundationPreview[] = foundationCatalogue
): RhythmDraftErrors {
  const errors: RhythmDraftErrors = {};
  if (!draft.title.trim()) errors.title = 'Enter a Rhythm title.';
  else if (draft.title.trim().length > 80) errors.title = 'Use 80 characters or fewer.';
  if (draft.description.length > 1000) errors.description = 'Use 1,000 characters or fewer.';
  if ((draft.seasonName?.length ?? 0) > 80) errors.seasonName = 'Use 80 characters or fewer.';
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
  if (draft.healthLogCapability !== undefined
    && ((draft.healthLogCapability !== 'weight' && draft.healthLogCapability !== 'cardio')
      || !draft.categoryIds.includes('health'))) {
    errors.categoryIds = 'Fitness logging capability requires the Health & Fitness category.';
  }
  const foundationIds = [
    ...(draft.primaryFoundationId ? [draft.primaryFoundationId] : []),
    ...(draft.secondaryFoundationIds ?? [])
  ];
  if (new Set(foundationIds).size !== foundationIds.length) {
    const term = draft.categoryIds.length === 1
      ? foundationTerminologyForCategory(draft.categoryIds[0]).singular
      : 'Foundation';
    errors.foundationIds = `Choose each ${term} at most once.`;
  } else {
    const ownershipError = foundationOwnershipError(draft.categoryIds, foundationIds, foundations);
    if (ownershipError) errors.foundationIds = ownershipError;
  }
  return errors;
}

export function saveRhythmDraft(
  savedRhythms: readonly SavedRhythm[],
  draft: RhythmDraft,
  id: string,
  mode: 'create' | 'edit',
  scoringContext?: {
    currentDate: string;
    deviceTimeZone: string;
    hasDatedCompletionHistory?: boolean;
    effectiveStartDate?: string;
    earliestDatedCompletionDate?: string;
  },
  foundations: readonly FoundationPreview[] = foundationCatalogue,
  options: { suggestionSourceId?: string } = {}
): { savedRhythms?: SavedRhythm[]; errors: RhythmDraftErrors } {
  const errors = validateRhythmDraft(draft, foundations);
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
  if (options.suggestionSourceId !== undefined && !isValidSuggestionSourceId(options.suggestionSourceId)) {
    errors.title = 'This suggestion source is no longer available.';
    return { errors };
  }
  const timeOfDay = rhythmTimeValueFromLabel(draft.timeLabel);
  const originalSchedule = draft.originalSchedule ?? existing?.schedule;
  const scheduleChanged = draft.schedule !== undefined
    ? originalSchedule !== undefined
      ? !rhythmSchedulesEqual(draft.schedule, originalSchedule)
      : true
    : false;
  const hasDatedCompletionHistory = scoringContext?.hasDatedCompletionHistory ?? false;
  for (const date of [scoringContext?.effectiveStartDate, scoringContext?.earliestDatedCompletionDate]) {
    if (date !== undefined && !isValidDate(date)) {
      errors.schedule = 'Earlier schedule history contains an invalid date.';
      return { errors };
    }
  }
  const historicalCoverageStart = hasDatedCompletionHistory
    ? [
        scoringContext?.effectiveStartDate,
        scoringContext?.earliestDatedCompletionDate
      ].filter((date): date is string => date !== undefined).sort()[0]
    : undefined;
  let scoring = draft.originalScoring ?? existing?.scoring;
  let initializedScheduleHistory = false;
  if (mode === 'create' && !scoring && draft.schedule && scoringContext
    && isValidDate(scoringContext.currentDate) && isValidTimeZone(scoringContext.deviceTimeZone)) {
    scoring = {
      trackingStartDate: scoringContext.currentDate,
      timeZone: scoringContext.deviceTimeZone,
      scheduleHistory: [
        createRhythmSeason(
          id,
          scoringContext.currentDate,
          draft.schedule,
          undefined,
          undefined,
          rhythmSeasonPaletteForOrdinal(0)
        )
      ]
    };
    initializedScheduleHistory = true;
  } else if (!scoring && mode === 'edit' && scheduleChanged && draft.schedule
    && scoringContext && isValidDate(scoringContext.currentDate)
    && isValidTimeZone(scoringContext.deviceTimeZone)) {
    const hasEarlierHistory = hasDatedCompletionHistory
      && historicalCoverageStart !== undefined
      && historicalCoverageStart < scoringContext.currentDate;
    const currentSeasonOrdinal = hasEarlierHistory && originalSchedule ? 1 : 0;
    const currentSeason = createRhythmSeason(
      id,
      scoringContext.currentDate,
      draft.schedule,
      undefined,
      undefined,
      rhythmSeasonPaletteForOrdinal(currentSeasonOrdinal)
    );
    const seasonName = draft.seasonName?.trim();
    const namedCurrentSeason = seasonName ? { ...currentSeason, name: seasonName } : currentSeason;
    scoring = {
      trackingStartDate: hasEarlierHistory
        ? historicalCoverageStart ?? scoringContext.currentDate
        : scoringContext.currentDate,
      timeZone: scoringContext.deviceTimeZone,
      scheduleHistory: hasEarlierHistory
        ? [
            originalSchedule
              ? createRhythmSeason(
                  id,
                  historicalCoverageStart ?? scoringContext.currentDate,
                  originalSchedule,
                  undefined,
                  undefined,
                  rhythmSeasonPaletteForOrdinal(0)
                )
              : createUnknownRhythmSeason(id, historicalCoverageStart ?? scoringContext.currentDate),
            namedCurrentSeason
          ]
        : [namedCurrentSeason]
    };
    initializedScheduleHistory = true;
  }
  if (scoring && scheduleChanged && draft.schedule && !initializedScheduleHistory) {
    const currentDate = scoringContext?.currentDate;
    if (!currentDate || !isValidDate(currentDate)
      || !scoringContext || !isValidTimeZone(scoringContext.deviceTimeZone)) {
      errors.schedule = 'The current local date and time zone are required to preserve schedule history.';
      return { errors };
    }
    if (currentDate < scoring.trackingStartDate) {
      errors.schedule = 'A schedule cannot change before its saved schedule history starts.';
      return { errors };
    }
    const latestSegment = scoring.scheduleHistory.at(-1);
    const hasUpcomingSegment = latestSegment !== undefined && latestSegment.startDate > currentDate;
    const currentSegment = hasUpcomingSegment
      ? rhythmSeasonForDate(scoring.scheduleHistory, currentDate)
      : latestSegment;
    if (!currentSegment || currentSegment.kind !== 'scheduled') {
      errors.schedule = 'The current schedule history cannot be changed safely.';
      return { errors };
    }
    if (currentDate < currentSegment.startDate) {
      errors.schedule = 'A schedule cannot change before the current schedule-history segment starts.';
      return { errors };
    }
    if (hasUpcomingSegment) {
      if (!timeOfDay) {
        errors.timeLabel = 'Choose a time of day.';
        return { errors };
      }
      const rangeResult = resolveRhythmSeasonRange({
        rhythmId: id,
        currentSchedule: currentSegment.schedule,
        scoring,
        timeZone: scoringContext.deviceTimeZone,
        asOfDate: currentDate,
        draft: {
          segmentId: currentSegment.id,
          startDate: currentDate,
          schedule: draft.schedule,
          timeOfDay,
          name: draft.seasonName ?? currentSegment.name ?? ''
        }
      });
      if (!rangeResult.valid) {
        errors.schedule = rangeResult.error;
        return { errors };
      }
      scoring = rangeResult.scoring;
    } else {
      const segments = scoring.scheduleHistory.map(segment => ({ ...segment }));
      const currentIndex = segments.findIndex(segment => segment.id === currentSegment.id);
      if (!hasDatedCompletionHistory) {
        segments[currentIndex] = { ...currentSegment, schedule: draft.schedule };
      } else if (currentSegment.startDate === currentDate) {
        const name = draft.seasonName === undefined ? currentSegment.name : draft.seasonName.trim();
        const { name: _previousName, ...withoutName } = currentSegment;
        segments[currentIndex] = {
          ...withoutName,
          schedule: draft.schedule,
          ...(name ? { name } : {})
        };
      } else {
        const knownSeasonCount = segments.filter(segment => segment.kind === 'scheduled').length;
        const season = createRhythmSeason(
          id,
          currentDate,
          draft.schedule,
          undefined,
          undefined,
          rhythmSeasonPaletteForOrdinal(knownSeasonCount)
        );
        const name = draft.seasonName?.trim();
        segments.splice(currentIndex + 1, 0, name ? { ...season, name } : season);
      }
      const coveredSegments = historicalCoverageStart
        ? ensureRhythmSeasonHistoryCoverage(id, segments, historicalCoverageStart)
        : segments;
      scoring = { ...scoring, scheduleHistory: coveredSegments };
    }
  }
  const activeSeason = scoring && scoringContext?.currentDate
    ? rhythmSeasonForDate(scoring.scheduleHistory, scoringContext.currentDate)
    : scoring?.scheduleHistory.at(-1);
  const activeSchedule = activeSeason?.kind === 'scheduled' ? activeSeason.schedule : undefined;
  const scheduleDefinition = (value: RhythmSchedule) => {
    const { endDate: _endDate, ...definition } = value;
    return JSON.stringify(definition);
  };
  if (scoring && draft.schedule
    && (!activeSchedule || scheduleDefinition(activeSchedule) !== scheduleDefinition(draft.schedule))) {
    errors.schedule = 'The active schedule does not match its saved schedule history.';
    return { errors };
  }
  const storedSchedule = activeSchedule
    ?? (scheduleChanged ? draft.schedule : existing?.schedule);
  const cadence = scheduleChanged && draft.schedule
    ? rhythmScheduleSummary(storedSchedule ?? draft.schedule)
    : existing?.cadence ?? draft.cadence;
  const schedule = storedSchedule;
  const suggestionSourceId = options.suggestionSourceId ?? existing?.suggestionSourceId;
  const saved: SavedRhythm = {
    id,
    title: draft.title.trim(),
    ...(draft.description.length === 0 ? {} : { description: draft.description }),
    cadence,
    timeLabel: draft.timeLabel as RhythmTimeLabel,
    personIds: [...draft.personIds],
    categoryIds: [...draft.categoryIds],
    ...(schedule === undefined ? {} : { schedule }),
    ...(scoring === undefined ? {} : { scoring }),
    ...(existing?.createdLocalDate === undefined
      ? mode === 'create' && scoringContext && isValidDate(scoringContext.currentDate)
        && isValidTimeZone(scoringContext.deviceTimeZone)
        ? {
            createdLocalDate: scoringContext.currentDate,
            createdTimeZone: scoringContext.deviceTimeZone,
            dailyBackfillAllowed: true
          }
        : {}
      : {
          createdLocalDate: existing.createdLocalDate,
          createdTimeZone: existing.createdTimeZone,
          ...(existing.dailyBackfillAllowed === undefined
            ? {}
            : { dailyBackfillAllowed: existing.dailyBackfillAllowed })
        }),
    ...(existing?.createdLocalDate === undefined && mode !== 'create' && scheduleChanged && scoring
      ? { dailyBackfillAllowed: false }
      : existing?.dailyBackfillAllowed !== undefined
        ? { dailyBackfillAllowed: existing.dailyBackfillAllowed }
        : {}),
    ...(draft.personal === undefined
      ? existing?.personal === undefined ? {} : { personal: existing.personal }
      : { personal: draft.personal }),
    ...(timeOfDay === undefined ? {} : { timeOfDay }),
    ...(draft.primaryFoundationId === undefined
      ? existing?.primaryFoundationId === undefined ? {} : { primaryFoundationId: existing.primaryFoundationId }
      : { primaryFoundationId: draft.primaryFoundationId }),
    ...(draft.secondaryFoundationIds === undefined
      ? existing?.secondaryFoundationIds === undefined ? {} : { secondaryFoundationIds: [...existing.secondaryFoundationIds] }
      : { secondaryFoundationIds: [...draft.secondaryFoundationIds] }),
    ...(suggestionSourceId === undefined ? {} : { suggestionSourceId }),
    ...(draft.healthLogCapability === undefined
      ? existing?.healthLogCapability === undefined ? {} : { healthLogCapability: existing.healthLogCapability }
      : { healthLogCapability: draft.healthLogCapability })
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
  const editable = todayRhythms.map(rhythm => applySavedRhythmOverrides(rhythm, savedById.get(rhythm.id)));

  const custom = savedRhythms
    .filter(rhythm => !fixtureRhythmIds.has(rhythm.id))
    .map(rhythm => applySavedRhythmOverrides({
      id: rhythm.id,
      title: rhythm.title,
      cadence: rhythm.cadence,
      timeLabel: rhythm.timeLabel,
      automation: 'manual' as const,
      status: 'Due today' as const,
      personIds: rhythm.personIds,
      categoryIds: rhythm.categoryIds
    }, rhythm));

  return [...editable, ...custom];
}

export function applySavedRhythmOverrides(
  rhythm: RhythmPreview,
  saved?: SavedRhythm
): RhythmPreview {
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
    ...(saved.scoring === undefined ? {} : { scoring: saved.scoring }),
    ...(saved.timeOfDay === undefined ? {} : { timeOfDay: saved.timeOfDay }),
    ...(saved.createdLocalDate === undefined ? {} : {
      createdLocalDate: saved.createdLocalDate,
      createdTimeZone: saved.createdTimeZone
    }),
    ...(saved.dailyBackfillAllowed === undefined ? {} : { dailyBackfillAllowed: saved.dailyBackfillAllowed }),
    ...(saved.personal === undefined ? {} : { personal: saved.personal }),
    ...(saved.primaryFoundationId === undefined ? {} : { primaryFoundationId: saved.primaryFoundationId }),
    ...(saved.secondaryFoundationIds === undefined
      ? {}
      : { secondaryFoundationIds: saved.secondaryFoundationIds }),
    ...(saved.suggestionSourceId === undefined ? {} : { suggestionSourceId: saved.suggestionSourceId }),
    ...(saved.healthLogCapability === undefined ? {} : { healthLogCapability: saved.healthLogCapability })
  };
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
