import type { RhythmPreview } from './preview-data.ts';
import { areas } from './preview-data.ts';
import { effectiveRhythmSchedule } from './rhythm-schedule.ts';
import type { RhythmSchedule } from './rhythm-schedule.ts';
import {
  addCalendarDays,
  isPeriodBasedRhythmSchedule,
  isScheduledDate,
  rhythmOccurrencePeriod,
  selectNextScheduledOccurrence
} from './rhythm-occurrences.ts';
import { selectRhythmScore } from './rhythm-scoring.ts';

export type CategoryRhythmGroupId = 'daily' | 'weekly' | 'seasonal' | 'custom';

const legacyMarriageSuggestionRhythmIds: Readonly<Record<string, string>> = {
  'marriage.daily-connection': 'user-rhythm-00000000-0000-4000-8000-000000000001',
  'marriage.date-night': 'user-rhythm-00000000-0000-4000-8000-000000000002',
  'marriage.pray-together': 'user-rhythm-00000000-0000-4000-8000-000000000003',
  'marriage.dream-together': 'user-rhythm-00000000-0000-4000-8000-000000000004',
  'marriage.marriage-check-in': 'user-rhythm-00000000-0000-4000-8000-000000000005',
  'marriage.thoughtful-act-of-love': 'user-rhythm-00000000-0000-4000-8000-000000000006',
  'marriage.overnight-away': 'user-rhythm-00000000-0000-4000-8000-000000000007',
  'marriage.marriage-enrichment': 'user-rhythm-00000000-0000-4000-8000-000000000008',
  'marriage.week-away-together': 'user-rhythm-00000000-0000-4000-8000-000000000009'
};

export function activeIdForMarriageSuggestion(templateId: string): string | undefined {
  return legacyMarriageSuggestionRhythmIds[templateId];
}

const legacySuggestionSourceByRhythmId = new Map(
  Object.entries(legacyMarriageSuggestionRhythmIds).map(([sourceId, rhythmId]) => [rhythmId, sourceId])
);
const knownCategoryIds = new Set<string>(areas.map(area => area.id));

export function legacySuggestionSourceForRhythmId(rhythmId: string): string | undefined {
  return legacySuggestionSourceByRhythmId.get(rhythmId);
}

export function isValidSuggestionSourceId(sourceId: unknown): sourceId is string {
  if (typeof sourceId !== 'string') return false;
  const separator = sourceId.indexOf('.');
  if (separator <= 0 || separator === sourceId.length - 1) return false;
  const categoryId = sourceId.slice(0, separator);
  const templateId = sourceId.slice(separator + 1);
  return knownCategoryIds.has(categoryId) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(templateId);
}

export function rhythmsForSuggestionSource(
  rhythms: readonly RhythmPreview[],
  sourceId: string
): RhythmPreview[] {
  return rhythms.filter(rhythm => rhythm.suggestionSourceId === sourceId);
}

export function categoryRhythmGroup(
  rhythm: Pick<RhythmPreview, 'schedule' | 'cadence'>
): CategoryRhythmGroupId | null {
  const schedule = effectiveRhythmSchedule(rhythm.schedule, rhythm.cadence);
  if (schedule) return groupForSchedule(schedule);
  if (rhythm.cadence === 'Weekly' || rhythm.cadence === '3 times a week'
    || rhythm.cadence === '5 times a week') return 'weekly';
  if (rhythm.cadence === 'Quarterly') return 'seasonal';
  return null;
}

function groupForSchedule(schedule: RhythmSchedule): CategoryRhythmGroupId {
  if (schedule.frequency === 'daily') return 'daily';
  if (schedule.frequency === 'weekly') return 'weekly';
  if (schedule.frequency === 'monthly' || schedule.frequency === 'quarterly'
    || schedule.frequency === 'yearly') return 'seasonal';
  return 'custom';
}

export function isRhythmRelevantOnDate(
  rhythm: Pick<RhythmPreview, 'schedule' | 'cadence' | 'scoring' | 'createdLocalDate'>,
  asOfDate: string
): boolean {
  const schedule = effectiveRhythmSchedule(rhythm.schedule, rhythm.cadence);
  if (!schedule) return false;
  const next = selectNextScheduledOccurrence({
    schedule,
    ...(rhythm.scoring ? { scoring: rhythm.scoring } : {}),
    ...(rhythm.createdLocalDate ? { trackingStartDate: rhythm.createdLocalDate } : {}),
    asOfDate
  });
  return next.kind === 'found' && next.date === asOfDate;
}

export function isRhythmEligibleForToday(
  rhythm: Pick<RhythmPreview, 'schedule' | 'cadence' | 'scoring' | 'createdLocalDate' | 'status'>,
  asOfDate: string
): boolean {
  return effectiveRhythmSchedule(rhythm.schedule, rhythm.cadence)
    ? isRhythmRelevantOnDate(rhythm, asOfDate)
    : rhythm.status === 'Due today';
}

function rhythmScoreForToday(rhythm: RhythmPreview, asOfDate: string) {
  if (!rhythm.schedule) return null;
  return selectRhythmScore({
    rhythmId: rhythm.id,
    ...(rhythm.cadence === undefined ? {} : { cadence: rhythm.cadence }),
    schedule: rhythm.schedule,
    ...(rhythm.scoring ? { scoring: rhythm.scoring } : {}),
    ...(rhythm.createdLocalDate ? { createdLocalDate: rhythm.createdLocalDate } : {}),
    ...(rhythm.createdTimeZone ? { createdTimeZone: rhythm.createdTimeZone } : {}),
    ...(rhythm.dailyBackfillAllowed === undefined
      ? {}
      : { dailyBackfillAllowed: rhythm.dailyBackfillAllowed }),
    records: (rhythm.completionHistory ?? []).map(record => ({
      ...record,
      rhythmId: rhythm.id
    })),
    recordsAvailable: true,
    asOfDate,
    timeZone: rhythm.scoring?.timeZone ?? rhythm.createdTimeZone ?? 'UTC'
  });
}

function hasCompletedCurrentPeriodOccurrence(rhythm: RhythmPreview, asOfDate: string): boolean {
  if (!rhythm.schedule || !isPeriodBasedRhythmSchedule(rhythm.schedule)) return false;
  const result = rhythmScoreForToday(rhythm, asOfDate);
  if (!result) return false;
  return result.kind === 'rhythm-score'
    && result.consistency.kind === 'scored'
    && result.consistency.evidence.occurrences.some(occurrence =>
      occurrence.date === asOfDate && occurrence.status === 'completed'
    );
}

function hasSatisfiedCurrentWeeklyOccurrences(
  rhythm: RhythmPreview,
  completedRhythmIds: ReadonlySet<string>,
  asOfDate: string
): boolean {
  if (!rhythm.schedule || rhythm.schedule.frequency !== 'weekly'
    || rhythm.schedule.weekdays.length < 2) return false;
  const period = rhythmOccurrencePeriod(
    { frequency: 'weekly', weekdays: [1] },
    asOfDate
  );
  const history = rhythm.scoring?.scheduleHistory;
  let occurrenceCount = 0;
  for (let date = period.startDate; date <= period.endDate; date = addCalendarDays(date, 1)) {
    let schedule: RhythmSchedule | null | undefined;
    if (history) {
      const segment = [...history].reverse().find(item => item.startDate <= date);
      if (!segment) continue;
      if (segment.kind === 'unknown') return false;
      schedule = segment.schedule;
    } else {
      if (rhythm.createdLocalDate && date < rhythm.createdLocalDate) continue;
      schedule = rhythm.schedule;
    }
    if (!schedule || !isScheduledDate(schedule, date)) continue;
    occurrenceCount += 1;
    const hasDatedCompletion = (rhythm.completionHistory ?? [])
      .some(record => record.effectiveDate === date && record.effectiveDate <= asOfDate);
    if (!hasDatedCompletion && !(date === asOfDate && completedRhythmIds.has(rhythm.id))) {
      return false;
    }
  }
  return occurrenceCount > 0;
}

export function selectSatisfiedRhythmIds(
  rhythms: readonly RhythmPreview[],
  completedRhythmIds: ReadonlySet<string>,
  dateForRhythm: (rhythm: RhythmPreview) => string
): ReadonlySet<string> {
  return new Set(rhythms
    .filter(rhythm => {
      const asOfDate = dateForRhythm(rhythm);
      if (!isRhythmEligibleForToday(rhythm, asOfDate)) return false;
      if (rhythm.schedule && isPeriodBasedRhythmSchedule(rhythm.schedule)) {
        return completedRhythmIds.has(rhythm.id)
          || hasCompletedCurrentPeriodOccurrence(rhythm, asOfDate);
      }
      if (rhythm.schedule?.frequency === 'weekly' && rhythm.schedule.weekdays.length > 1) {
        return hasSatisfiedCurrentWeeklyOccurrences(rhythm, completedRhythmIds, asOfDate);
      }
      if (effectiveRhythmSchedule(rhythm.schedule, rhythm.cadence) !== undefined) {
        return completedRhythmIds.has(rhythm.id);
      }
      // Without a structured schedule, only the saved completion for this displayed
      // date is authoritative; descriptive cadence does not define a recurrence period.
      return completedRhythmIds.has(rhythm.id);
    })
    .map(rhythm => rhythm.id));
}

export function selectTendedRhythmDisplayIds(
  completedTodayRhythmIds: ReadonlySet<string>,
  satisfiedRhythmIds: ReadonlySet<string>
): ReadonlySet<string> {
  return new Set([...completedTodayRhythmIds, ...satisfiedRhythmIds]);
}
