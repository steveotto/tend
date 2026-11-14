import { describe, expect, it } from 'vitest';
import {
  defaultCategoryPreferences,
  isCategoryPreferences,
  selectAvailableCategories,
  selectAvailableFoundations,
  selectAvailablePersonGroups
} from '../src/domain/category-availability.ts';
import {
  areas,
  createPersonPickerGroups,
  foundationCatalogue
} from '../src/domain/preview-data.ts';

describe('category availability', () => {
  it('enables all existing categories by default and rejects incomplete preference records', () => {
    expect(areas.every(area => defaultCategoryPreferences[area.id])).toBe(true);
    expect(isCategoryPreferences(defaultCategoryPreferences)).toBe(true);
    expect(isCategoryPreferences({ ...defaultCategoryPreferences, faith: undefined })).toBe(false);
    expect(isCategoryPreferences({ ...defaultCategoryPreferences, unknown: true })).toBe(false);
  });

  it('selects available categories, Foundations, and People classifications without mutating saved data', () => {
    const preferences = { ...defaultCategoryPreferences, faith: false, friendships: false };
    const groups = createPersonPickerGroups();
    const foundations = selectAvailableFoundations(preferences, foundationCatalogue);
    const visibleGroups = selectAvailablePersonGroups(preferences, groups);

    expect(selectAvailableCategories(preferences).map(area => area.id))
      .toEqual(['marriage', 'parenting', 'health', 'finances']);
    expect(foundations.every(foundation => foundation.categoryId !== 'faith')).toBe(true);
    expect(visibleGroups.map(group => group.id)).not.toContain('friends');
    expect(groups.some(group => group.id === 'friends')).toBe(true);
  });

  it('supports the all-categories-disabled state as an empty availability selection', () => {
    const preferences = Object.fromEntries(areas.map(area => [area.id, false]));
    expect(selectAvailableCategories(preferences as typeof defaultCategoryPreferences)).toEqual([]);
    expect(selectAvailableFoundations(preferences as typeof defaultCategoryPreferences, foundationCatalogue)).toEqual([]);
  });
});
