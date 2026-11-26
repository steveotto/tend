import { describe, expect, it } from 'vitest';
import { defaultAllItemsFilters, selectAllItems } from '../src/domain/all-items.ts';
import type { AllItemsFilters } from '../src/domain/all-items.ts';
import type { PersonPrayerRequest } from '../src/domain/person-prayers.ts';
import type { PersonSpark } from '../src/domain/person-sparks.ts';
import { todayRhythms } from '../src/domain/preview-data.ts';
import type { PersonId, RhythmPreview } from '../src/domain/preview-data.ts';

const personA: PersonId = 'sample-person-avery';
const personB: PersonId = 'sample-person-morgan';
const timestamp = '2026-10-31T12:00:00.000Z';

function rhythm(
  id: string,
  title: string,
  overrides: Partial<RhythmPreview> = {}
): RhythmPreview {
  return {
    id,
    title,
    automation: todayRhythms[0]!.automation,
    status: 'Not confirmed',
    personIds: [],
    ...overrides
  };
}

function spark(
  id: string,
  title: string,
  overrides: Partial<PersonSpark> = {}
): PersonSpark {
  return {
    id,
    title,
    ownerId: personA,
    sharedWith: [],
    archived: false,
    completed: false,
    completionHistory: [],
    ...overrides
  };
}

function prayer(
  id: string,
  title: string,
  overrides: Partial<PersonPrayerRequest> = {}
): PersonPrayerRequest {
  return {
    id,
    title,
    personId: personA,
    sharedWith: [],
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
    prayerLogs: [],
    ...overrides
  };
}

function filters(patch: Partial<AllItemsFilters>): AllItemsFilters {
  return { ...defaultAllItemsFilters, ...patch };
}

describe('All items selector', () => {
  it('combines type, person, frequency, and time filters with AND semantics', () => {
    const dailyRhythm = rhythm('daily', 'Daily practice', {
      personIds: [personA],
      schedule: { frequency: 'daily' },
      timeOfDay: 'morning'
    });
    const anytimeRhythm = rhythm('anytime', 'Anytime practice', {
      personIds: [personA],
      schedule: { frequency: 'daily' },
      timeOfDay: 'anytime'
    });
    const weeklyPrayer = prayer('weekly', 'Weekly request', {
      personId: personB,
      sharedWith: [personA],
      schedule: { frequency: 'weekly', weekdays: [1] },
      timeOfDay: 'afternoon'
    });
    const result = selectAllItems({
      rhythms: [dailyRhythm, anytimeRhythm],
      sparks: [spark('spark', 'Unscheduled Spark')],
      prayerRequests: [weeklyPrayer]
    }, filters({
      person: personA,
      frequency: 'weekly',
      timeOfDay: 'afternoon'
    }));

    expect(result.rhythms).toEqual([]);
    expect(result.sparks).toEqual([]);
    expect(result.prayerRequests).toEqual([weeklyPrayer]);
    expect(result.count).toBe(1);
  });

  it('matches any Person association without expanding a record into duplicates', () => {
    const sharedRhythm = rhythm('shared-rhythm', 'Shared rhythm', {
      personIds: [personA, personB],
      schedule: { frequency: 'weekly', weekdays: [1, 3] }
    });
    const sharedSpark = spark('shared-spark', 'Shared Spark', { sharedWith: [personB] });
    const sharedPrayer = prayer('shared-prayer', 'Shared request', {
      sharedWith: [personB],
      status: 'answered'
    });

    const result = selectAllItems({
      rhythms: [sharedRhythm],
      sparks: [sharedSpark],
      prayerRequests: [sharedPrayer]
    }, filters({ person: personB }));

    expect(result.rhythms).toEqual([sharedRhythm]);
    expect(result.sparks).toEqual([sharedSpark]);
    expect(result.prayerRequests).toEqual([sharedPrayer]);
    expect(result.count).toBe(3);
  });

  it('distinguishes a no-owner Prayer from one that still has Person associations', () => {
    const accountPrayer = prayer('account-prayer', 'Account request', {
      personId: null,
      sharedWith: []
    });
    const sharedAccountPrayer = prayer('shared-account-prayer', 'Shared account request', {
      personId: null,
      sharedWith: [personB]
    });

    const noPerson = selectAllItems({
      rhythms: [],
      sparks: [],
      prayerRequests: [accountPrayer, sharedAccountPrayer]
    }, filters({ person: 'none' }));
    expect(noPerson.prayerRequests).toEqual([accountPrayer]);

    const sharedPerson = selectAllItems({
      rhythms: [],
      sparks: [],
      prayerRequests: [accountPrayer, sharedAccountPrayer]
    }, filters({ person: personB }));
    expect(sharedPerson.prayerRequests).toEqual([sharedAccountPrayer]);
  });

  it('keeps unscheduled items discoverable and distinguishes Anytime from no time setting', () => {
    const noPersonUnscheduled = rhythm('no-person', 'Unscheduled rhythm', {
      personIds: []
    });
    const anytimeRhythm = rhythm('anytime', 'Anytime rhythm', {
      personIds: [personA],
      schedule: { frequency: 'daily' },
      timeOfDay: 'anytime'
    });
    const unscheduledSpark = spark('unscheduled-spark', 'Someday Spark');

    const noPerson = selectAllItems({
      rhythms: [noPersonUnscheduled],
      sparks: [unscheduledSpark],
      prayerRequests: []
    }, filters({
      person: 'none',
      frequency: 'not-scheduled',
      timeOfDay: 'not-applicable'
    }));
    expect(noPerson.rhythms).toEqual([noPersonUnscheduled]);
    expect(noPerson.sparks).toEqual([]);

    const anytime = selectAllItems({
      rhythms: [noPersonUnscheduled, anytimeRhythm],
      sparks: [unscheduledSpark],
      prayerRequests: []
    }, filters({ timeOfDay: 'anytime' }));
    expect(anytime.rhythms).toEqual([anytimeRhythm]);
    expect(anytime.sparks).toEqual([]);
  });

  it('retains completed, archived, and answered records and sorts each type by title', () => {
    const archivedRhythm = rhythm('archived-rhythm', 'Zulu rhythm');
    const completedSpark = spark('completed-spark', 'Bravo Spark', { completed: true });
    const archivedSpark = spark('archived-spark', 'Alpha Spark', { archived: true });
    const archivedPrayer = prayer('archived-prayer', 'Charlie request', { status: 'archived' });
    const answeredPrayer = prayer('answered-prayer', 'Able request', { status: 'answered' });

    const result = selectAllItems({
      rhythms: [archivedRhythm],
      sparks: [completedSpark, archivedSpark],
      prayerRequests: [archivedPrayer, answeredPrayer]
    }, defaultAllItemsFilters);

    expect(result.rhythms).toEqual([archivedRhythm]);
    expect(result.sparks.map(item => item.id)).toEqual(['archived-spark', 'completed-spark']);
    expect(result.prayerRequests.map(item => item.id)).toEqual(['answered-prayer', 'archived-prayer']);
  });

  it('supports all model frequencies, including custom intervals', () => {
    const customRhythm = rhythm('custom', 'Custom rhythm', {
      schedule: { frequency: 'custom', unit: 'days', interval: 3, startDate: '2026-10-01' }
    });
    const result = selectAllItems({
      rhythms: [customRhythm],
      sparks: [],
      prayerRequests: []
    }, filters({ frequency: 'custom' }));

    expect(result.rhythms).toEqual([customRhythm]);
  });

  it('maps supported legacy cadence labels without treating unknown labels as unscheduled', () => {
    const monthlyRhythm = rhythm('monthly', 'Monthly', { cadence: 'Monthly' });
    const biweeklyRhythm = rhythm('biweekly', 'Every two weeks', { cadence: 'Every 2 weeks' });
    const unknownCadence = rhythm('unknown', 'Unknown cadence', { cadence: 'Legacy cadence' });
    const unscheduledRhythm = rhythm('unscheduled', 'Unscheduled');
    const collections = {
      rhythms: [monthlyRhythm, biweeklyRhythm, unknownCadence, unscheduledRhythm],
      sparks: [],
      prayerRequests: []
    };

    expect(selectAllItems(collections, filters({ frequency: 'monthly' })).rhythms)
      .toEqual([monthlyRhythm]);
    expect(selectAllItems(collections, filters({ frequency: 'custom' })).rhythms)
      .toEqual([biweeklyRhythm]);
    expect(selectAllItems(collections, filters({ frequency: 'not-scheduled' })).rhythms)
      .toEqual([unscheduledRhythm]);
    expect(selectAllItems(collections, defaultAllItemsFilters).rhythms)
      .toEqual([biweeklyRhythm, monthlyRhythm, unknownCadence, unscheduledRhythm]);
  });
});
