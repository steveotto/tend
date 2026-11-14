import { areas } from './preview-data.ts';
import type { CategoryId, FoundationPreview, PersonPickerGroup, PersonPickerGroupId } from './preview-data.ts';

export type CategoryPreferences = Readonly<Record<CategoryId, boolean>>;

export const defaultCategoryPreferences: CategoryPreferences = {
  faith: true,
  marriage: true,
  parenting: true,
  health: true,
  finances: true,
  friendships: true
};

const categoryIds = new Set<CategoryId>(areas.map(area => area.id));

export function isCategoryPreferences(value: unknown): value is CategoryPreferences {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return entries.length === areas.length
    && entries.every(([id, enabled]) => categoryIds.has(id as CategoryId) && typeof enabled === 'boolean')
    && areas.every(area => Object.hasOwn(value, area.id));
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

export function selectAvailableFoundations(
  preferences: CategoryPreferences,
  foundations: readonly FoundationPreview[]
): FoundationPreview[] {
  const availableIds = selectAvailableCategoryIds(preferences);
  return foundations.filter(foundation => availableIds.has(foundation.categoryId));
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
