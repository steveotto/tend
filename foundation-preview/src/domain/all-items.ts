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

export type AllItemsTypeSelection = 'all' | readonly Exclude<AllItemsTypeFilter, 'all'>[];
export type AllItemsFrequencySelection = 'all' | readonly Exclude<AllItemsFrequencyFilter, 'all'>[];
export type AllItemsTimeSelection = 'all' | readonly Exclude<AllItemsTimeFilter, 'all'>[];
export type AllItemsPersonSelection = 'all' | readonly AllItemsPersonFilterValue[];
export type AllItemsPersonFilterValue = Exclude<AllItemsPersonFilter, 'all'>;

export type AllItemsFilters = {
  type: AllItemsTypeSelection;
  person: AllItemsPersonSelection;
  frequency: AllItemsFrequencySelection;
  timeOfDay: AllItemsTimeSelection;
  search: string;
};

export const defaultAllItemsFilters: AllItemsFilters = {
  type: 'all',
  person: 'all',
  frequency: 'all',
  timeOfDay: 'all',
  search: ''
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
  const rhythms = !matchesSelection(filters.type, 'rhythms')
    ? []
    : sortByTitle(collections.rhythms.filter(rhythm => {
        const timeLabel = legacyTimeLabel(rhythm);
        return matchesFilters({
        people: rhythm.personIds ?? [],
        frequency: rhythmFrequency(rhythm),
        timeOfDay: rhythm.timeOfDay
          ?? (timeLabel ? rhythmTimeValueFromLegacyLabel(timeLabel) : undefined)
          ?? null,
        title: rhythm.title,
        details: rhythm.description ?? ''
      }, filters);
      }));
  const sparks = !matchesSelection(filters.type, 'sparks')
    ? []
    : sortByTitle(collections.sparks.filter(spark => matchesFilters({
        people: [spark.ownerId, ...spark.sharedWith],
        frequency: 'not-scheduled',
        timeOfDay: null,
        title: spark.title,
        details: spark.description ?? ''
      }, filters)));
  const prayerRequests = !matchesSelection(filters.type, 'prayer-requests')
    ? []
    : sortByTitle(collections.prayerRequests.filter(request => matchesFilters({
        people: [...(request.personId === null ? [] : [request.personId]), ...(request.sharedWith ?? [])],
        frequency: request.schedule?.frequency ?? 'not-scheduled',
        timeOfDay: request.timeOfDay ?? null,
        title: request.title,
        details: request.details ?? ''
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
    title: string;
    details?: string;
  },
  filters: AllItemsFilters
): boolean {
  return matchesPersonSelection(filters.person, item.people)
    && matchesSelection(filters.frequency, item.frequency)
    && matchesTimeSelection(filters.timeOfDay, item.timeOfDay)
    && matchesSearch(filters.search, item.title, item.details);
}

function matchesSearch(search: string, title: string, details?: string): boolean {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) return true;
  return title.toLowerCase().includes(normalizedSearch)
    || (details?.toLowerCase().includes(normalizedSearch) ?? false);
}

function matchesPersonSelection(
  selection: AllItemsFilters['person'],
  people: readonly PersonId[]
): boolean {
  return selection === 'all' || selection.some(person =>
    person === 'none' ? people.length === 0 : people.includes(person)
  );
}

function matchesSelection<Value extends string>(
  selection: 'all' | readonly Value[],
  value: Value | null | undefined
): boolean {
  return selection === 'all' || (value !== null && value !== undefined && selection.includes(value));
}

function matchesTimeSelection(
  selection: AllItemsFilters['timeOfDay'],
  timeOfDay: RhythmTimeValue | null | undefined
): boolean {
  return selection === 'all' || selection.some(time =>
    time === 'not-applicable'
      ? timeOfDay === null || timeOfDay === undefined
      : time === timeOfDay
  );
}

function sortByTitle<T extends { id: string; title: string }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) =>
    left.title.localeCompare(right.title) || left.id.localeCompare(right.id)
  );
}
