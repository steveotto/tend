import type { PersonId, PersonPickerGroup, PersonPickerGroupId } from './preview-data.ts';

export const personCategoryPriority: readonly PersonPickerGroupId[] = [
  'marriage',
  'parenting',
  'friends'
];

export function resolvePersonCategory(
  categories: readonly PersonPickerGroupId[]
): PersonPickerGroupId | null {
  return personCategoryPriority.find(category => categories.includes(category)) ?? null;
}

export function resolvePersonCategoryGroups(
  groups: readonly PersonPickerGroup[]
): { groups: PersonPickerGroup[]; resolvedPeople: number } {
  const personIds = new Set(groups.flatMap(group => [...group.memberIds]));
  let resolvedPeople = 0;
  const memberships = new Map<PersonId, PersonPickerGroupId | null>();

  for (const personId of personIds) {
    const categories = groups
      .filter(group => group.memberIds.includes(personId))
      .map(group => group.id);
    if (categories.length > 1) resolvedPeople += 1;
    memberships.set(personId, resolvePersonCategory(categories));
  }

  return {
    groups: groups.map(group => ({
      ...group,
      memberIds: group.memberIds.filter(personId => memberships.get(personId) === group.id)
    })),
    resolvedPeople
  };
}

export function hasSinglePersonCategory(
  groups: readonly PersonPickerGroup[],
  personId: PersonId
): boolean {
  const categories = groups.filter(group => group.memberIds.includes(personId)).map(group => group.id);
  return categories.length <= 1 && resolvePersonCategory(categories) === (categories[0] ?? null);
}

export function setPersonCategory(
  groups: readonly PersonPickerGroup[],
  personId: PersonId,
  category: PersonPickerGroupId | null
): PersonPickerGroup[] {
  return groups.map(group => {
    const shouldBeMember = group.id === category;
    if (group.memberIds.includes(personId) === shouldBeMember) return group;
    return {
      ...group,
      memberIds: shouldBeMember
        ? [...group.memberIds, personId]
        : group.memberIds.filter(id => id !== personId)
    };
  });
}
