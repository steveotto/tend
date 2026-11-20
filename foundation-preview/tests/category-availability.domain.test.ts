import { describe, expect, it } from 'vitest';
import {
  defaultFoundationPreferences,
  defaultCategoryPreferences,
  isCategoryPreferences,
  isFoundationPreferences,
  selectAvailableCategories,
  selectAvailableFoundations,
  selectAvailableFoundationLinkedItems,
  selectAvailablePersonGroups
} from '../src/domain/category-availability.ts';
import {
  areas,
  createPersonPickerGroups,
  foundationCatalogue
} from '../src/domain/preview-data.ts';

describe('category availability', () => {
  it('enables all categories and child areas by default and rejects incomplete preference records', () => {
    expect(areas.every(area => defaultCategoryPreferences[area.id])).toBe(true);
    expect(isCategoryPreferences(defaultCategoryPreferences)).toBe(true);
    expect(isCategoryPreferences({ ...defaultCategoryPreferences, faith: undefined })).toBe(false);
    expect(isCategoryPreferences({ ...defaultCategoryPreferences, unknown: true })).toBe(false);
    expect(foundationCatalogue.every(foundation => defaultFoundationPreferences[foundation.id])).toBe(true);
    expect(isFoundationPreferences(defaultFoundationPreferences)).toBe(true);
    expect(isFoundationPreferences({ ...defaultFoundationPreferences, unknown: true })).toBe(false);
  });

  it('selects available categories, Foundations, and People classifications without mutating saved data', () => {
    const preferences = { ...defaultCategoryPreferences, faith: false, friendships: false };
    const availability = {
      categoryPreferences: preferences,
      foundationPreferences: defaultFoundationPreferences
    };
    const groups = createPersonPickerGroups();
    const foundations = selectAvailableFoundations(availability, foundationCatalogue);
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
    expect(selectAvailableFoundations({
      categoryPreferences: preferences as typeof defaultCategoryPreferences,
      foundationPreferences: defaultFoundationPreferences
    }, foundationCatalogue)).toEqual([]);
  });

  it('keeps cross-linked items available through any enabled Foundation', () => {
    const faithFoundation = foundationCatalogue.find(foundation => foundation.categoryId === 'faith')!;
    const marriageFoundation = foundationCatalogue.find(foundation => foundation.categoryId === 'marriage')!;
    const availability = {
      categoryPreferences: defaultCategoryPreferences,
      foundationPreferences: {
        ...defaultFoundationPreferences,
        [faithFoundation.id]: false
      }
    };
    const linkedItems = [
      { id: 'cross-linked', foundationIds: [faithFoundation.id, marriageFoundation.id] },
      { id: 'faith-only', foundationIds: [faithFoundation.id] },
      { id: 'unlinked', foundationIds: [] }
    ];

    expect(selectAvailableFoundationLinkedItems(
      availability,
      linkedItems,
      item => item.foundationIds
    ).map(item => item.id)).toEqual(['cross-linked']);
  });

  it('restores a category without changing its saved child preferences', () => {
    const healthChildren = foundationCatalogue.filter(foundation => foundation.categoryId === 'health');
    const childPreferences = {
      ...defaultFoundationPreferences,
      'health-cardio': false
    };
    const categoryOff = {
      categoryPreferences: { ...defaultCategoryPreferences, health: false },
      foundationPreferences: childPreferences
    };
    const categoryOn = {
      categoryPreferences: { ...categoryOff.categoryPreferences, health: true },
      foundationPreferences: categoryOff.foundationPreferences
    };

    expect(selectAvailableFoundations(categoryOff, healthChildren)).toEqual([]);
    expect(selectAvailableFoundations(categoryOn, healthChildren).map(item => item.id))
      .toEqual(healthChildren.filter(item => item.id !== 'health-cardio').map(item => item.id));
    expect(categoryOn.foundationPreferences['health-cardio']).toBe(false);
  });
});
