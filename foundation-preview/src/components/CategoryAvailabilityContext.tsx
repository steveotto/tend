import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import {
  defaultFoundationPreferences,
  defaultCategoryPreferences,
  selectAvailableFoundations,
  selectAvailableCategories,
  selectAvailablePersonGroups
} from '../domain/category-availability.ts';
import type {
  AreaAvailabilityPreferences,
  CategoryPreferences,
  FoundationPreferences
} from '../domain/category-availability.ts';
import type { FoundationPreview, PersonPickerGroup } from '../domain/preview-data.ts';
import { foundationCatalogue } from '../domain/preview-data.ts';

type SharedAvailabilityPreferences = AreaAvailabilityPreferences & { prayerEnabled: boolean };

const CategoryAvailabilityContext = createContext<SharedAvailabilityPreferences>({
  categoryPreferences: defaultCategoryPreferences,
  foundationPreferences: defaultFoundationPreferences,
  prayerEnabled: true
});

export function CategoryAvailabilityProvider({
  preferences,
  foundationPreferences = defaultFoundationPreferences,
  prayerEnabled = true,
  children
}: {
  preferences: CategoryPreferences;
  foundationPreferences?: FoundationPreferences;
  prayerEnabled?: boolean;
  children: ReactNode;
}) {
  return (
    <CategoryAvailabilityContext.Provider value={{
      categoryPreferences: preferences,
      foundationPreferences,
      prayerEnabled
    }}>
      {children}
    </CategoryAvailabilityContext.Provider>
  );
}

export function useCategoryAvailability(): CategoryPreferences {
  return useContext(CategoryAvailabilityContext).categoryPreferences;
}

export function useAreaAvailability(): SharedAvailabilityPreferences {
  return useContext(CategoryAvailabilityContext);
}

export function usePrayerEnabled(): boolean {
  return useContext(CategoryAvailabilityContext).prayerEnabled;
}

export function useAvailableCategories() {
  return selectAvailableCategories(useCategoryAvailability());
}

export function useAvailableFoundations(foundations: readonly FoundationPreview[] = foundationCatalogue) {
  return selectAvailableFoundations(useAreaAvailability(), foundations);
}

export function useAvailablePersonGroups(groups: readonly PersonPickerGroup[]) {
  return selectAvailablePersonGroups(useCategoryAvailability(), groups);
}
