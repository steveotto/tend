import { effectiveRhythmSchedule, rhythmTimeValueFromLegacyLabel } from './rhythm-schedule.ts';
import type { RhythmTimeValue } from './rhythm-schedule.ts';
import type { PersonPrayerRequest } from './person-prayers.ts';
import type { PersonSpark } from './person-sparks.ts';
import type { PersonId, RhythmPreview } from './preview-data.ts';

export type AllItemsTypeFilter = 'all' | 'rhythms' | 'sparks' | 'prayer-requests';
export type AllItemsFrequencyFilter =
  | 'all'
  | 'not-scheduled'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | 'custom';
export type AllItemsTimeFilter = 'all' | 'not-applicable' | RhythmTimeValue;
export type AllItemsPersonFilter = 'all' | 'none' | PersonId;

export type AllItemsFilters = {
  type: AllItemsTypeFilter;
  person: AllItemsPersonFilter;
  frequency: AllItemsFrequencyFilter;
  timeOfDay: AllItemsTimeFilter;
};

export const defaultAllItemsFilters: AllItemsFilters = {
  type: 'all',
  person: 'all',
  frequency: 'all',
  timeOfDay: 'all'
};

export type AllItemsCollections = {
  rhythms: readonly RhythmPreview[];
  sparks: readonly PersonSpark[];
  prayerRequests: readonly PersonPrayerRequest[];
};

export type AllItemsSelection = {
  rhythms: RhythmPreview[];
  sparks: PersonSpark[];
  prayerRequests: PersonPrayerRequest[];
  count: number;
};

export function selectAllItems(
  collections: AllItemsCollections,
  filters: AllItemsFilters
): AllItemsSelection {
  const rhythms = filters.type === 'sparks' || filters.type === 'prayer-requests'
    ? []
    : sortByTitle(collections.rhythms.filter(rhythm => {
        const timeLabel = legacyTimeLabel(rhythm);
        return matchesFilters({
        people: rhythm.personIds ?? [],
        frequency: rhythmFrequency(rhythm),
        timeOfDay: rhythm.timeOfDay
          ?? (timeLabel ? rhythmTimeValueFromLegacyLabel(timeLabel) : undefined)
          ?? null
      }, filters);
      }));
  const sparks = filters.type === 'rhythms' || filters.type === 'prayer-requests'
    ? []
    : sortByTitle(collections.sparks.filter(spark => matchesFilters({
        people: [spark.ownerId, ...spark.sharedWith],
        frequency: 'not-scheduled',
        timeOfDay: null
      }, filters)));
  const prayerRequests = filters.type === 'rhythms' || filters.type === 'sparks'
    ? []
    : sortByTitle(collections.prayerRequests.filter(request => matchesFilters({
        people: [...(request.personId === null ? [] : [request.personId]), ...(request.sharedWith ?? [])],
        frequency: request.schedule?.frequency ?? 'not-scheduled',
        timeOfDay: request.timeOfDay ?? null
      }, filters)));

  return {
    rhythms,
    sparks,
    prayerRequests,
    count: rhythms.length + sparks.length + prayerRequests.length
  };
}

function legacyTimeLabel(rhythm: RhythmPreview): string | undefined {
  if (!('timeLabel' in rhythm)) return undefined;
  return typeof rhythm.timeLabel === 'string' ? rhythm.timeLabel : undefined;
}

function rhythmFrequency(rhythm: RhythmPreview): AllItemsFrequencyFilter | null {
  const schedule = effectiveRhythmSchedule(rhythm.schedule, rhythm.cadence);
  if (schedule) return schedule.frequency;
  switch (rhythm.cadence) {
    case 'Daily':
      return 'daily';
    case 'Weekly':
    case '3 times a week':
    case '5 times a week':
    case 'Select Days':
      return 'weekly';
    case 'Monthly':
    case 'Monthly · 1st':
      return 'monthly';
    case 'Quarterly':
    case 'Every 3 months':
      return 'quarterly';
    case 'Yearly':
      return 'yearly';
    case 'Every 2 weeks':
      return 'custom';
    default:
      return rhythm.cadence ? null : 'not-scheduled';
  }
}

function matchesFilters(
  item: {
    people: readonly PersonId[];
    frequency: AllItemsFrequencyFilter | null;
    timeOfDay: RhythmTimeValue | null | undefined;
  },
  filters: AllItemsFilters
): boolean {
  if (filters.person === 'none' && item.people.length !== 0) return false;
  if (filters.person !== 'all' && filters.person !== 'none' && !item.people.includes(filters.person)) return false;
  if (filters.frequency !== 'all' && filters.frequency !== item.frequency) return false;
  if (filters.timeOfDay === 'not-applicable' && item.timeOfDay != null) return false;
  if (filters.timeOfDay !== 'all' && filters.timeOfDay !== 'not-applicable'
    && item.timeOfDay !== filters.timeOfDay) return false;
  return true;
}

function sortByTitle<T extends { id: string; title: string }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) =>
    left.title.localeCompare(right.title) || left.id.localeCompare(right.id)
  );
}
