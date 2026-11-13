import { describe, expect, it } from 'vitest';
import {
  hasSinglePersonCategory,
  resolvePersonCategory,
  resolvePersonCategoryGroups,
  setPersonCategory
} from '../src/domain/person-categories.ts';
import { createPersonPickerGroups } from '../src/domain/preview-data.ts';
import { createPreviewEnvelope, createSamplePreviewData, validatePreviewEnvelope } from '../src/domain/preview-state.ts';

describe('single Person categories', () => {
  it('resolves every conflicting combination by Marriage, Parenting, Friend priority', () => {
    expect(resolvePersonCategory(['friends', 'parenting'])).toBe('parenting');
    expect(resolvePersonCategory(['friends', 'marriage'])).toBe('marriage');
    expect(resolvePersonCategory(['parenting', 'marriage', 'friends'])).toBe('marriage');
    expect(resolvePersonCategory([])).toBeNull();
  });

  it('normalizes each Person once and reports aggregate conflict count', () => {
    const groups = [
      { id: 'marriage', label: 'Marriage', memberIds: ['p1', 'p2'] },
      { id: 'parenting', label: 'Parenting', memberIds: ['p1', 'p3'] },
      { id: 'friends', label: 'Friends', memberIds: ['p1', 'p3'] }
    ] as const;
    const resolved = resolvePersonCategoryGroups(groups);
    expect(resolved.resolvedPeople).toBe(2);
    expect(resolved.groups.map(group => group.memberIds)).toEqual([['p1', 'p2'], ['p3'], []]);
    expect(hasSinglePersonCategory(resolved.groups, 'p1')).toBe(true);
    expect(hasSinglePersonCategory(resolved.groups, 'p4')).toBe(true);
  });

  it('replaces only the selected Person category and supports explicit Not set', () => {
    const original = [
      { id: 'marriage', label: 'Marriage', memberIds: ['p1', 'p2'] },
      { id: 'parenting', label: 'Parenting', memberIds: ['p1'] },
      { id: 'friends', label: 'Friends', memberIds: ['p1', 'p3'] }
    ] as const;
    expect(setPersonCategory(original, 'p1', 'friends').map(group => group.memberIds))
      .toEqual([['p2'], [], ['p1', 'p3']]);
    expect(setPersonCategory(original, 'p1', null).map(group => group.memberIds))
      .toEqual([['p2'], [], ['p3']]);
  });

  it('resolves multiple categories at the preview import/validation boundary without changing the source envelope', () => {
    const envelope = createPreviewEnvelope(createSamplePreviewData());
    const person = envelope.data.people[0]!;
    envelope.data.peopleGroups = [
      { id: 'marriage', label: 'Marriage', memberIds: [person.id] },
      { id: 'parenting', label: 'Parenting', memberIds: [person.id] },
      { id: 'friends', label: 'Friends', memberIds: [person.id] }
    ];
    const sourceMemberships = envelope.data.peopleGroups.map(group => [...group.memberIds]);

    const result = validatePreviewEnvelope(envelope, '2026-10-31');

    expect(result).toMatchObject({ valid: true, resolvedPersonCategories: 1 });
    expect(envelope.data.peopleGroups.map(group => group.memberIds)).toEqual(sourceMemberships);
    if (result.valid) {
      expect(result.envelope.data.peopleGroups.map(group => group.memberIds))
        .toEqual([[person.id], [], []]);
    }
    const sampleGroups = createPersonPickerGroups();
    for (const id of ['sample-person-avery', 'sample-person-morgan', 'sample-person-jordan']) {
      expect(hasSinglePersonCategory(sampleGroups, id)).toBe(true);
    }
  });
});
