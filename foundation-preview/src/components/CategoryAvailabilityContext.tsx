import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import {
  defaultCategoryPreferences,
  selectAvailableCategories,
  selectAvailablePersonGroups
} from '../domain/category-availability.ts';
import type { CategoryPreferences } from '../domain/category-availability.ts';
import type { PersonPickerGroup } from '../domain/preview-data.ts';

const CategoryAvailabilityContext = createContext<CategoryPreferences>(defaultCategoryPreferences);

export function CategoryAvailabilityProvider({
  preferences,
  children
}: {
  preferences: CategoryPreferences;
  children: ReactNode;
}) {
  return (
    <CategoryAvailabilityContext.Provider value={preferences}>
      {children}
    </CategoryAvailabilityContext.Provider>
  );
}

export function useCategoryAvailability(): CategoryPreferences {
  return useContext(CategoryAvailabilityContext);
}

export function useAvailableCategories() {
  return selectAvailableCategories(useCategoryAvailability());
}

export function useAvailablePersonGroups(groups: readonly PersonPickerGroup[]) {
  return selectAvailablePersonGroups(useCategoryAvailability(), groups);
}
