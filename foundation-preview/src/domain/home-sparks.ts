import { selectAvailablePersonGroups } from './category-availability.ts';
import type { CategoryPreferences } from './category-availability.ts';
import type { PersonPickerGroup, PersonPreview } from './preview-data.ts';
import type { PersonSpark } from './person-sparks.ts';

export type PersonSparkListStatus = 'active' | 'completed' | 'archived';

export function selectSparkVisiblePeople(
  people: readonly PersonPreview[],
  groups: readonly PersonPickerGroup[],
  preferences: CategoryPreferences
): PersonPreview[] {
  const knownPeople = new Set(people.map(person => person.id));
  const visibleIds = new Set(
    selectAvailablePersonGroups(preferences, groups)
      .flatMap(group => group.memberIds)
      .filter(personId => knownPeople.has(personId))
  );
  return people.filter(person => visibleIds.has(person.id));
}

export function selectSparksVisibleToPeople(
  sparks: readonly PersonSpark[],
  people: readonly PersonPreview[]
): PersonSpark[] {
  const visibleIds = new Set(people.map(person => person.id));
  return sparks.filter(spark =>
    visibleIds.has(spark.ownerId) || spark.sharedWith.some(personId => visibleIds.has(personId))
  );
}

export function selectHomePersonSparks(
  sparks: readonly PersonSpark[],
  today: string,
  limit = 3
): PersonSpark[] {
  const active = sparks
    .map((spark, index) => ({ spark, index }))
    .filter(({ spark }) => !spark.archived && !spark.completed);
  const due = active
    .filter(({ spark }) => spark.dueDate !== undefined && spark.dueDate <= today)
    .sort(compareDatedSparks);
  const someday = active
    .filter(({ spark }) => spark.dueDate === undefined)
    .sort((left, right) => left.index - right.index || left.spark.id.localeCompare(right.spark.id));
  return [...due, ...someday].slice(0, Math.max(0, limit)).map(({ spark }) => spark);
}

export function selectPersonSparksByStatus(
  sparks: readonly PersonSpark[],
  status: PersonSparkListStatus
): PersonSpark[] {
  return sparks
    .map((spark, index) => ({ spark, index }))
    .filter(({ spark }) => status === 'archived'
      ? spark.archived
      : status === 'completed'
        ? !spark.archived && spark.completed
        : !spark.archived && !spark.completed)
    .sort(compareDatedSparks)
    .map(({ spark }) => spark);
}

export function formatPersonSparkDueDate(dueDate: string | undefined, today: string): string {
  if (!dueDate) return 'Someday';
  if (dueDate === today) return 'Due today';
  const [year, month, day] = dueDate.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return `Due ${new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date)}`;
}

function compareDatedSparks(
  left: { spark: PersonSpark; index: number },
  right: { spark: PersonSpark; index: number }
): number {
  const leftDate = left.spark.dueDate ?? '\uffff';
  const rightDate = right.spark.dueDate ?? '\uffff';
  return leftDate.localeCompare(rightDate)
    || left.index - right.index
    || left.spark.id.localeCompare(right.spark.id);
}
