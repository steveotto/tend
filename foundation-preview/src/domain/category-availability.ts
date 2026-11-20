import { areas } from './preview-data.ts';
import { foundationCatalogue } from './preview-data.ts';
import type {
  CategoryId,
  FoundationPreview,
  PersonPickerGroup,
  PersonPickerGroupId
} from './preview-data.ts';

export type CategoryPreferences = Readonly<Record<CategoryId, boolean>>;
export type FoundationPreferences = Readonly<Record<string, boolean>>;
export type AreaAvailabilityPreferences = {
  categoryPreferences: CategoryPreferences;
  foundationPreferences: FoundationPreferences;
};

export const defaultCategoryPreferences: CategoryPreferences = {
  faith: true,
  marriage: true,
  parenting: true,
  health: true,
  finances: true,
  friendships: true
};

export const defaultFoundationPreferences: FoundationPreferences = Object.fromEntries(
  foundationCatalogue.map(foundation => [foundation.id, true])
);

const categoryIds = new Set<CategoryId>(areas.map(area => area.id));
const foundationsById = new Map(foundationCatalogue.map(foundation => [foundation.id, foundation]));
const foundationIds = new Set(foundationsById.keys());

export function isCategoryPreferences(value: unknown): value is CategoryPreferences {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return entries.length === areas.length
    && entries.every(([id, enabled]) => categoryIds.has(id as CategoryId) && typeof enabled === 'boolean')
    && areas.every(area => Object.hasOwn(value, area.id));
}

export function isFoundationPreferences(value: unknown): value is FoundationPreferences {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return entries.length === foundationIds.size
    && entries.every(([id, enabled]) => foundationIds.has(id) && typeof enabled === 'boolean')
    && [...foundationIds].every(id => Object.hasOwn(value, id));
}

export function selectAvailableCategories(
  preferences: CategoryPreferences
): typeof areas[number][] {
  return areas.filter(area => preferences[area.id]);
}

export function selectAvailableCategoryIds(
  preferences: CategoryPreferences
): ReadonlySet<CategoryId> {
  return new Set(selectAvailableCategories(preferences).map(area => area.id));
}

export function isCategoryEnabled(
  preferences: CategoryPreferences,
  categoryId: string | null
): boolean {
  return categoryId !== null
    && categoryIds.has(categoryId as CategoryId)
    && preferences[categoryId as CategoryId] === true;
}

export function isFoundationEnabled(
  availability: AreaAvailabilityPreferences,
  foundationId: string
): boolean {
  const foundation = foundationsById.get(foundationId);
  return foundation !== undefined
    && isCategoryEnabled(availability.categoryPreferences, foundation.categoryId)
    && availability.foundationPreferences[foundationId] === true;
}

export function selectAvailableFoundations(
  availability: AreaAvailabilityPreferences,
  foundations: readonly FoundationPreview[] = foundationCatalogue
): FoundationPreview[] {
  return foundations.filter(foundation => isFoundationEnabled(availability, foundation.id));
}

export function selectAvailableFoundationIds(
  availability: AreaAvailabilityPreferences,
  foundations: readonly FoundationPreview[] = foundationCatalogue
): ReadonlySet<string> {
  return new Set(selectAvailableFoundations(availability, foundations).map(foundation => foundation.id));
}

export function selectAvailableFoundationLinkedItems<T>(
  availability: AreaAvailabilityPreferences,
  items: readonly T[],
  linkedFoundationIds: (item: T) => readonly string[]
): T[] {
  return items.filter(item =>
    linkedFoundationIds(item).some(id => isFoundationEnabled(availability, id))
  );
}

export function selectCategoryAssociationsForValidation(
  preferences: CategoryPreferences,
  categoryIds: readonly string[],
  foundationIds: readonly string[],
  foundations: readonly FoundationPreview[]
): { categoryIds: string[]; foundationIds: string[] } {
  const knownCategoryIds = new Set(areas.map(area => area.id));
  const foundationById = new Map(foundations.map(foundation => [foundation.id, foundation]));
  return {
    categoryIds: categoryIds.filter(id =>
      !knownCategoryIds.has(id as CategoryId) || isCategoryEnabled(preferences, id)
    ),
    foundationIds: foundationIds.filter(id => {
      const ownerCategoryId = foundationById.get(id)?.categoryId;
      return ownerCategoryId === undefined || isCategoryEnabled(preferences, ownerCategoryId);
    })
  };
}

export function categoryIdForPersonGroup(groupId: PersonPickerGroupId): CategoryId | null {
  if (groupId === 'friends') return 'friendships';
  return groupId;
}

export function selectAvailablePersonGroups(
  preferences: CategoryPreferences,
  groups: readonly PersonPickerGroup[]
): PersonPickerGroup[] {
  return groups.filter(group => {
    const categoryId = categoryIdForPersonGroup(group.id);
    return categoryId !== null && isCategoryEnabled(preferences, categoryId);
  });
}
