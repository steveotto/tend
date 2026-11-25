import { describe, expect, it } from 'vitest';
import { defaultCategoryPreferences, setCategoryPreference } from '../src/domain/category-availability.ts';
import {
  formatPersonSparkDueDate,
  selectHomePersonSparks,
  selectPersonSparksByStatus,
  selectSparksVisibleToPeople,
  selectSparkVisiblePeople
} from '../src/domain/home-sparks.ts';
import { selectOpenPersonSparks } from '../src/domain/person-sparks.ts';
import type { PersonSpark } from '../src/domain/person-sparks.ts';

function spark(id: string, overrides: Partial<PersonSpark> = {}): PersonSpark {
  return {
    id,
    ownerId: 'owner',
    title: `Spark ${id}`,
    sharedWith: [],
    archived: false,
    completed: false,
    completionHistory: [],
    ...overrides
  };
}

describe('Home Spark selection', () => {
  it('orders due and past-due Sparks by date, fills with Someday, excludes future, and caps at three', () => {
    const sparks = [
      spark('someday-first'),
      spark('future', { dueDate: '2026-11-24' }),
      spark('today', { dueDate: '2026-11-23' }),
      spark('past-later', { dueDate: '2026-11-22' }),
      spark('past-first', { dueDate: '2026-11-20' }),
      spark('someday-second')
    ];

    expect(selectHomePersonSparks(sparks, '2026-11-23').map(item => item.id)).toEqual([
      'past-first',
      'past-later',
      'today'
    ]);
    expect(selectHomePersonSparks(sparks.slice(0, 2), '2026-11-23').map(item => item.id))
      .toEqual(['someday-first']);
  });

  it('keeps stable input ordering among equal dates and Someday ideas', () => {
    const sparks = [
      spark('second', { dueDate: '2026-11-23' }),
      spark('first', { dueDate: '2026-11-23' }),
      spark('someday-a'),
      spark('someday-b')
    ];
    expect(selectHomePersonSparks(sparks, '2026-11-23').map(item => item.id)).toEqual([
      'second',
      'first',
      'someday-a'
    ]);
  });

  it('filters people and Sparks by enabled relationship groups without dropping shared records', () => {
    const people = [
      { id: 'married', displayName: 'Married' },
      { id: 'dating', displayName: 'Dating' },
      { id: 'parent', displayName: 'Parent' },
      { id: 'friend', displayName: 'Friend' }
    ];
    const groups = [
      { id: 'marriage' as const, label: 'Marriage', memberIds: ['married'] },
      { id: 'dating' as const, label: 'Dating partner', memberIds: ['dating'] },
      { id: 'parenting' as const, label: 'Parenting', memberIds: ['parent'] },
      { id: 'friends' as const, label: 'Friends', memberIds: ['friend'] }
    ];
    const preferences = setCategoryPreference(defaultCategoryPreferences, 'dating', true);
    const visiblePeople = selectSparkVisiblePeople(people, groups, preferences);
    const sparks = [
      spark('visible-shared', { ownerId: 'married', sharedWith: ['dating'] }),
      spark('hidden', { ownerId: 'married' }),
      spark('parenting', { ownerId: 'parent' })
    ];

    expect(visiblePeople.map(person => person.id)).toEqual(['dating', 'parent', 'friend']);
    expect(selectSparksVisibleToPeople(sparks, visiblePeople).map(item => item.id))
      .toEqual(['visible-shared', 'parenting']);
  });

  it('keeps Active, Completed, and Archived states distinct and each record in one section', () => {
    const sparks = [
      spark('active-future', { dueDate: '2026-11-24' }),
      spark('completed', { completed: true, dueDate: '2026-11-21' }),
      spark('archived', { archived: true }),
      spark('archived-completed', { archived: true, completed: true })
    ];

    const active = selectPersonSparksByStatus(sparks, 'active');
    const completed = selectPersonSparksByStatus(sparks, 'completed');
    const archived = selectPersonSparksByStatus(sparks, 'archived');
    expect(selectOpenPersonSparks(sparks).map(item => item.id)).toEqual(['active-future']);
    expect(active.map(item => item.id)).toEqual(['active-future']);
    expect(completed.map(item => item.id)).toEqual(['completed']);
    expect(archived.map(item => item.id)).toEqual(['archived', 'archived-completed']);
    expect(new Set([...active, ...completed, ...archived].map(item => item.id)).size).toBe(sparks.length);
  });

  it('formats date-only labels without treating future dates as due today', () => {
    expect(formatPersonSparkDueDate('2026-11-23', '2026-11-23')).toBe('Due today');
    expect(formatPersonSparkDueDate('2026-11-24', '2026-11-23')).toBe('Due Nov 24, 2026');
    expect(formatPersonSparkDueDate(undefined, '2026-11-23')).toBe('Someday');
  });
});
