import { effectiveRhythmSchedule, rhythmTimeValueFromLegacyLabel } from './rhythm-schedule.ts';
import type { RhythmTimeOption, RhythmTimeValue } from './rhythm-schedule.ts';
import type { PersonPrayerRequest } from './person-prayers.ts';
import type { PersonSpark } from './person-sparks.ts';
import type { PersonId, PersonPreview, RhythmPreview } from './preview-data.ts';

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
  archivedRhythmIds?: ReadonlySet<string>;
  sparks: readonly PersonSpark[];
  prayerRequests: readonly PersonPrayerRequest[];
};

export type AllItemsSelection = {
  rhythms: RhythmPreview[];
  sparks: PersonSpark[];
  prayerRequests: PersonPrayerRequest[];
  count: number;
};

export type AllItemsSortField =
  | 'grouped'
  | 'title'
  | 'type'
  | 'person'
  | 'time-of-day'
  | 'frequency';
export type AllItemsSortDirection = 'ascending' | 'descending';
export type AllItemsSort = {
  field: AllItemsSortField;
  direction: AllItemsSortDirection;
};
export type AllItemsResultItem =
  | { kind: 'rhythm'; item: RhythmPreview }
  | { kind: 'spark'; item: PersonSpark }
  | { kind: 'prayer-request'; item: PersonPrayerRequest };

export function selectAllItems(
  collections: AllItemsCollections,
  filters: AllItemsFilters
): AllItemsSelection {
  const rhythms = !matchesSelection(filters.type, 'rhythms')
    ? []
    : sortByTitle(collections.rhythms.filter(rhythm => {
        if (collections.archivedRhythmIds?.has(rhythm.id)) return false;
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

export function orderAllItems(
  selection: AllItemsSelection,
  sort: AllItemsSort,
  people: readonly PersonPreview[],
  timeOptions: readonly RhythmTimeOption[]
): AllItemsResultItem[] {
  const items: AllItemsResultItem[] = [
    ...selection.rhythms.map(item => ({ kind: 'rhythm' as const, item })),
    ...selection.sparks.map(item => ({ kind: 'spark' as const, item })),
    ...selection.prayerRequests.map(item => ({ kind: 'prayer-request' as const, item }))
  ];
  if (sort.field === 'grouped') return items;

  const peopleById = new Map(people.map(person => [person.id, person]));
  const timeOrder = new Map(timeOptions.map((option, index) => [option.value, index]));
  const direction = sort.direction === 'ascending' ? 1 : -1;
  const field = sort.field;

  return items.sort((left, right) => {
    const leftValue = sortValue(left, field, peopleById, timeOrder);
    const rightValue = sortValue(right, field, peopleById, timeOrder);
    const primary = compareSortValues(leftValue, rightValue, direction);
    if (primary !== 0) return primary;

    return left.item.title.localeCompare(right.item.title)
      || left.item.id.localeCompare(right.item.id)
      || left.kind.localeCompare(right.kind);
  });
}

export function selectArchivedRhythms(
  rhythms: readonly RhythmPreview[],
  archivedRhythmIds: ReadonlySet<string>,
  filters: AllItemsFilters
): RhythmPreview[] {
  if (!matchesSelection(filters.type, 'rhythms')) return [];
  return sortByTitle(rhythms.filter(rhythm =>
    archivedRhythmIds.has(rhythm.id)
    && (() => {
      const legacyTimeLabelValue = legacyTimeLabel(rhythm);
      return matchesFilters({
        people: rhythm.personIds ?? [],
        frequency: rhythmFrequency(rhythm),
        timeOfDay: rhythm.timeOfDay
          ?? (legacyTimeLabelValue ? rhythmTimeValueFromLegacyLabel(legacyTimeLabelValue) : undefined)
          ?? null,
        title: rhythm.title,
        details: rhythm.description ?? ''
      }, filters);
    })()
  ));
}

function legacyTimeLabel(rhythm: RhythmPreview): string | undefined {
  if (!('timeLabel' in rhythm)) return undefined;
  return typeof rhythm.timeLabel === 'string' ? rhythm.timeLabel : undefined;
}

function rhythmFrequency(
  rhythm: RhythmPreview
): Exclude<AllItemsFrequencyFilter, 'all'> | null {
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

type SortValue = string | number | null;

function sortValue(
  item: AllItemsResultItem,
  field: Exclude<AllItemsSortField, 'grouped'>,
  peopleById: ReadonlyMap<PersonId, PersonPreview>,
  timeOrder: ReadonlyMap<string, number>
): SortValue {
  switch (field) {
    case 'title':
      return item.item.title;
    case 'type':
      return item.kind === 'rhythm' ? 0 : item.kind === 'spark' ? 1 : 2;
    case 'person':
      return associatedPeople(item)
        .map(id => peopleById.get(id))
        .filter((person): person is PersonPreview => person !== undefined)
        .sort((left, right) =>
          left.displayName.localeCompare(right.displayName) || left.id.localeCompare(right.id)
        )[0]?.displayName ?? null;
    case 'time-of-day': {
      const legacyLabel = item.kind === 'rhythm' ? legacyTimeLabel(item.item) : undefined;
      const timeOfDay = item.kind === 'rhythm'
        ? item.item.timeOfDay
          ?? (legacyLabel ? rhythmTimeValueFromLegacyLabel(legacyLabel) : undefined)
        : item.kind === 'prayer-request'
          ? item.item.timeOfDay
          : undefined;
      return timeOfDay === undefined ? null : timeOrder.get(timeOfDay) ?? null;
    }
    case 'frequency': {
      const frequency = item.kind === 'rhythm'
        ? rhythmFrequency(item.item)
        : item.kind === 'prayer-request'
          ? item.item.schedule?.frequency ?? null
          : null;
      return frequency === null || frequency === 'not-scheduled'
        ? null
        : frequencyOrder[frequency];
    }
  }
}

function associatedPeople(item: AllItemsResultItem): readonly PersonId[] {
  if (item.kind === 'rhythm') return item.item.personIds ?? [];
  if (item.kind === 'spark') return [item.item.ownerId, ...item.item.sharedWith];
  return [
    ...(item.item.personId === null ? [] : [item.item.personId]),
    ...(item.item.sharedWith ?? [])
  ];
}

const frequencyOrder: Record<Exclude<AllItemsFrequencyFilter, 'all' | 'not-scheduled'>, number> = {
  daily: 0,
  weekly: 1,
  monthly: 2,
  quarterly: 3,
  yearly: 4,
  custom: 5
};

function compareSortValues(left: SortValue, right: SortValue, direction: 1 | -1): number {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  const compared = typeof left === 'number' && typeof right === 'number'
    ? left - right
    : String(left).localeCompare(String(right));
  return compared * direction;
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
