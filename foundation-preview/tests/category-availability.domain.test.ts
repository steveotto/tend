import { describe, expect, it } from 'vitest';
import {
  defaultFoundationPreferences,
  defaultCategoryPreferences,
  isDefaultCategoryPreferencesCompatible,
  isDefaultFoundationPreferencesCompatible,
  isCategoryPreferences,
  isFoundationPreferences,
  migrateCategoryPreferences,
  migrateFoundationPreferences,
  normalizeCategoryPreferences,
  setCategoryPreference,
  selectAvailableCategoryIds,
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
  it('keeps Dating optional by default and rejects incomplete preference records', () => {
    expect(defaultCategoryPreferences.dating).toBe(false);
    expect(defaultCategoryPreferences.marriage).toBe(true);
    expect(areas.every(area => area.id === 'dating' || defaultCategoryPreferences[area.id])).toBe(true);
    expect(isCategoryPreferences(defaultCategoryPreferences)).toBe(true);
    expect(isCategoryPreferences({ ...defaultCategoryPreferences, faith: undefined })).toBe(false);
    expect(isCategoryPreferences({ ...defaultCategoryPreferences, unknown: true })).toBe(false);
    expect(foundationCatalogue.every(foundation => defaultFoundationPreferences[foundation.id])).toBe(true);
    expect(isFoundationPreferences(defaultFoundationPreferences)).toBe(true);
    expect(isFoundationPreferences({ ...defaultFoundationPreferences, unknown: true })).toBe(false);
  });

  it('migrates only exact pre-Dating preference records and adds no Dating people', () => {
    const legacyCategories = Object.fromEntries(
      areas.filter(area => area.id !== 'dating').map(area => [area.id, true])
    );
    const legacyFoundations = Object.fromEntries(
      foundationCatalogue
        .filter(foundation => foundation.categoryId !== 'dating')
        .map(foundation => [foundation.id, true])
    );
    const migratedCategories = migrateCategoryPreferences(legacyCategories);
    const migratedFoundations = migrateFoundationPreferences(legacyFoundations);

    expect(migratedCategories).toEqual({ ...legacyCategories, dating: false });
    expect(migratedFoundations).toMatchObject({
      'dating-connection': true,
      'dating-communication': true,
      'dating-fun-adventure': true,
      'dating-trust-honesty': true,
      'dating-shared-faith': true,
      'dating-direction': true
    });
    expect(isDefaultCategoryPreferencesCompatible(legacyCategories)).toBe(true);
    expect(isDefaultFoundationPreferencesCompatible(legacyFoundations)).toBe(true);
    expect(migrateCategoryPreferences({ ...legacyCategories, unknown: true })).toBeNull();
    expect(migrateFoundationPreferences({ ...legacyFoundations, unknown: true })).toBeNull();
    expect(createPersonPickerGroups().find(group => group.id === 'dating')?.memberIds).toEqual([]);
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
    expect(foundations.some(foundation => foundation.categoryId === 'dating')).toBe(false);
    expect(foundations.every(foundation => foundation.categoryId !== 'faith')).toBe(true);
    expect(visibleGroups.map(group => group.id)).not.toContain('friends');
    expect(groups.some(group => group.id === 'friends')).toBe(true);
    expect(visibleGroups.map(group => group.id)).not.toContain('dating');
    expect(groups.find(group => group.id === 'dating')?.memberIds).toEqual([]);
  });

  it('enables Dating exclusively and filters its Foundations and People group', () => {
    const preferences = setCategoryPreference(defaultCategoryPreferences, 'dating', true);
    const availability = {
      categoryPreferences: preferences,
      foundationPreferences: defaultFoundationPreferences
    };
    const foundations = selectAvailableFoundations(availability, foundationCatalogue);
    const groups = selectAvailablePersonGroups(preferences, createPersonPickerGroups());
    const oneFoundationDisabled = selectAvailableFoundations({
      categoryPreferences: preferences,
      foundationPreferences: {
        ...defaultFoundationPreferences,
        'dating-direction': false
      }
    }, foundationCatalogue);

    expect(selectAvailableCategories(preferences).map(area => area.id))
      .toContain('dating');
    expect(selectAvailableCategoryIds(preferences).has('marriage')).toBe(false);
    expect(preferences.marriage).toBe(false);
    expect(preferences.dating).toBe(true);
    expect(foundations.filter(foundation => foundation.categoryId === 'dating')).toHaveLength(6);
    expect(oneFoundationDisabled.filter(foundation => foundation.categoryId === 'dating').map(foundation => foundation.id))
      .toEqual(['dating-connection', 'dating-communication', 'dating-fun-adventure', 'dating-trust-honesty', 'dating-shared-faith']);
    expect(groups.map(group => group.id)).toContain('dating');
    expect(defaultCategoryPreferences.marriage).toBe(true);
  });

  it('enforces both selection directions, supports neither, and normalizes legacy dual enablement to Marriage', () => {
    const datingOnly = setCategoryPreference(defaultCategoryPreferences, 'dating', true);
    const marriageAgain = setCategoryPreference(datingOnly, 'marriage', true);
    const neither = setCategoryPreference(marriageAgain, 'marriage', false);
    const bothLegacy = { ...defaultCategoryPreferences, dating: true };

    expect(datingOnly).toMatchObject({ marriage: false, dating: true });
    expect(marriageAgain).toMatchObject({ marriage: true, dating: false });
    expect(neither).toMatchObject({ marriage: false, dating: false });
    expect(isCategoryPreferences(neither)).toBe(true);
    expect(isCategoryPreferences(bothLegacy)).toBe(false);
    expect(normalizeCategoryPreferences(bothLegacy))
      .toMatchObject({ marriage: true, dating: false });
    expect(migrateCategoryPreferences(bothLegacy))
      .toMatchObject({ marriage: true, dating: false });
    expect(migrateCategoryPreferences({ ...defaultCategoryPreferences, marriage: false, dating: true }))
      .toMatchObject({ marriage: false, dating: true });
    expect(migrateCategoryPreferences(neither))
      .toMatchObject({ marriage: false, dating: false });
    expect(selectAvailableCategories(bothLegacy).map(area => area.id))
      .not.toContain('dating');
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
