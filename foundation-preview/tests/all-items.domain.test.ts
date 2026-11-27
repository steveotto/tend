import { describe, expect, it } from 'vitest';
import {
  defaultAllItemsFilters,
  orderAllItems,
  selectAllItems,
  selectArchivedRhythms
} from '../src/domain/all-items.ts';
import type { AllItemsFilters, AllItemsSort, AllItemsSortField } from '../src/domain/all-items.ts';
import type { PersonPrayerRequest } from '../src/domain/person-prayers.ts';
import type { PersonSpark } from '../src/domain/person-sparks.ts';
import { todayRhythms } from '../src/domain/preview-data.ts';
import type { PersonId, PersonPreview, RhythmPreview } from '../src/domain/preview-data.ts';
import { rhythmTimeOptions } from '../src/domain/rhythm-schedule.ts';

const personA: PersonId = 'sample-person-avery';
const personB: PersonId = 'sample-person-morgan';
const timestamp = '2026-10-31T12:00:00.000Z';
const people: PersonPreview[] = [
  { id: personA, displayName: 'Avery Example' },
  { id: personB, displayName: 'Morgan Example' }
];

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

function orderedIds(
  collections: {
    rhythms: readonly RhythmPreview[];
    sparks: readonly PersonSpark[];
    prayerRequests: readonly PersonPrayerRequest[];
    archivedRhythmIds?: ReadonlySet<string>;
  },
  field: AllItemsSortField,
  direction: AllItemsSort['direction'] = 'ascending',
  filterPatch: Partial<AllItemsFilters> = {}
): string[] {
  const selection = selectAllItems(collections, filters(filterPatch));
  return orderAllItems(selection, { field, direction }, people, rhythmTimeOptions)
    .map(entry => `${entry.kind}:${entry.item.id}`);
}

describe('All items selector', () => {
  it('selects only archived Rhythms and applies Person, frequency, time, and search filters', () => {
    const alexLinked = rhythm('alex-linked', 'Daily Alex practice', {
      personIds: [personA],
      description: 'Call Alex',
      schedule: { frequency: 'daily' },
      timeOfDay: 'morning'
    });
    const unassociated = rhythm('unassociated', 'Quiet reflection', {
      personIds: [],
      schedule: { frequency: 'weekly', weekdays: [1] },
      timeOfDay: 'anytime'
    });
    const active = rhythm('active', 'Active rhythm', {
      personIds: [personA],
      schedule: { frequency: 'daily' }
    });
    const archivedIds = new Set([alexLinked.id, unassociated.id]);

    expect(selectArchivedRhythms([alexLinked, unassociated, active], archivedIds, filters({
      type: ['rhythms']
    })).map(item => item.id)).toEqual([alexLinked.id, unassociated.id]);
    expect(selectArchivedRhythms([alexLinked, unassociated], archivedIds, filters({
      type: ['rhythms'],
      person: [personA],
      frequency: ['daily'],
      timeOfDay: ['morning'],
      search: 'alex'
    }))).toEqual([alexLinked]);
    expect(selectArchivedRhythms([alexLinked, unassociated], archivedIds, filters({
      type: ['rhythms'],
      person: ['none'],
      search: 'quiet'
    }))).toEqual([unassociated]);
  });
  it('combines type, person, frequency, and time selections with AND semantics', () => {
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
      person: [personA],
      frequency: ['weekly'],
      timeOfDay: ['afternoon']
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
    }, filters({ person: [personB] }));

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
    }, filters({ person: ['none'] }));
    expect(noPerson.prayerRequests).toEqual([accountPrayer]);

    const sharedPerson = selectAllItems({
      rhythms: [],
      sparks: [],
      prayerRequests: [accountPrayer, sharedAccountPrayer]
    }, filters({ person: [personB] }));
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
      person: ['none'],
      frequency: ['not-scheduled'],
      timeOfDay: ['not-applicable']
    }));
    expect(noPerson.rhythms).toEqual([noPersonUnscheduled]);
    expect(noPerson.sparks).toEqual([]);

    const anytime = selectAllItems({
      rhythms: [noPersonUnscheduled, anytimeRhythm],
      sparks: [unscheduledSpark],
      prayerRequests: []
    }, filters({ timeOfDay: ['anytime'] }));
    expect(anytime.rhythms).toEqual([anytimeRhythm]);
    expect(anytime.sparks).toEqual([]);
  });

  it('excludes archived Rhythms while retaining archived Sparks and Prayers', () => {
    const archivedRhythm = rhythm('archived-rhythm', 'Zulu rhythm');
    const completedSpark = spark('completed-spark', 'Bravo Spark', { completed: true });
    const archivedSpark = spark('archived-spark', 'Alpha Spark', { archived: true });
    const archivedPrayer = prayer('archived-prayer', 'Charlie request', { status: 'archived' });
    const answeredPrayer = prayer('answered-prayer', 'Able request', { status: 'answered' });

    const result = selectAllItems({
      rhythms: [archivedRhythm],
      archivedRhythmIds: new Set([archivedRhythm.id]),
      sparks: [completedSpark, archivedSpark],
      prayerRequests: [archivedPrayer, answeredPrayer]
    }, defaultAllItemsFilters);

    expect(result.rhythms).toEqual([]);
    expect(result.sparks.map(item => item.id)).toEqual(['archived-spark', 'completed-spark']);
    expect(result.prayerRequests.map(item => item.id)).toEqual(['answered-prayer', 'archived-prayer']);
    expect(result.count).toBe(4);
    expect(selectAllItems({
      rhythms: [archivedRhythm],
      archivedRhythmIds: new Set([archivedRhythm.id]),
      sparks: [],
      prayerRequests: []
    }, filters({ search: 'Zulu' })).count).toBe(0);
  });

  it('supports all model frequencies, including custom intervals', () => {
    const customRhythm = rhythm('custom', 'Custom rhythm', {
      schedule: { frequency: 'custom', unit: 'days', interval: 3, startDate: '2026-10-01' }
    });
    const result = selectAllItems({
      rhythms: [customRhythm],
      sparks: [],
      prayerRequests: []
    }, filters({ frequency: ['custom'] }));

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

    expect(selectAllItems(collections, filters({ frequency: ['monthly'] })).rhythms)
      .toEqual([monthlyRhythm]);
    expect(selectAllItems(collections, filters({ frequency: ['custom'] })).rhythms)
      .toEqual([biweeklyRhythm]);
    expect(selectAllItems(collections, filters({ frequency: ['not-scheduled'] })).rhythms)
      .toEqual([unscheduledRhythm]);
    expect(selectAllItems(collections, defaultAllItemsFilters).rhythms)
      .toEqual([biweeklyRhythm, monthlyRhythm, unknownCadence, unscheduledRhythm]);
  });

  it('matches any value in a multi-select and ANDs the separate filter groups', () => {
    const dailyRhythm = rhythm('multi-daily', 'Daily practice', {
      personIds: [personA],
      schedule: { frequency: 'daily' },
      timeOfDay: 'morning'
    });
    const weeklyPrayer = prayer('multi-weekly', 'Weekly request', {
      personId: personB,
      schedule: { frequency: 'weekly', weekdays: [1] },
      timeOfDay: 'afternoon'
    });
    const collections = {
      rhythms: [dailyRhythm],
      sparks: [],
      prayerRequests: [weeklyPrayer]
    };
    const multiple = selectAllItems(collections, filters({
      type: ['rhythms', 'prayer-requests'],
      person: [personA, personB],
      frequency: ['daily', 'weekly'],
      timeOfDay: ['morning', 'afternoon']
    }));

    expect(multiple.rhythms).toEqual([dailyRhythm]);
    expect(multiple.prayerRequests).toEqual([weeklyPrayer]);
    expect(multiple.count).toBe(2);

    const separateFiltersAnd = selectAllItems(collections, filters({
      type: ['rhythms', 'prayer-requests'],
      person: [personA, personB],
      frequency: ['daily', 'weekly'],
      timeOfDay: ['morning']
    }));
    expect(separateFiltersAnd.rhythms).toEqual([dailyRhythm]);
    expect(separateFiltersAnd.prayerRequests).toEqual([]);
  });

  it('matches title and existing details text while ignoring case and surrounding spaces', () => {
    const detailedRhythm = rhythm('rhythm-detail', 'Morning walk', {
      description: 'Call Avery after breakfast'
    });
    const detailedSpark = spark('spark-detail', 'Read quietly', {
      description: 'Choose the evening devotional'
    });
    const detailedPrayer = prayer('prayer-detail', 'Family request', {
      details: 'Pray for wisdom about work'
    });
    const collections = {
      rhythms: [detailedRhythm],
      sparks: [detailedSpark],
      prayerRequests: [detailedPrayer]
    };

    expect(selectAllItems(collections, filters({ search: '  MORNING  ' })).rhythms)
      .toEqual([detailedRhythm]);
    expect(selectAllItems(collections, filters({ search: 'evening devotional' })).sparks)
      .toEqual([detailedSpark]);
    expect(selectAllItems(collections, filters({ search: 'wisdom about' })).prayerRequests)
      .toEqual([detailedPrayer]);
  });

  it('combines text search with the existing filters and excludes private notes and history', () => {
    const matchingPrayer = prayer('matching-prayer', 'Hospital visit', {
      details: 'Bring encouragement',
      personId: personB,
      prayerLogs: [{ id: 'private-log', notes: 'private-only log text' }]
    });
    const otherPrayer = prayer('other-prayer', 'Hospital planning', {
      details: 'Coordinate meals',
      personId: personA
    });
    const result = selectAllItems({
      rhythms: [],
      sparks: [],
      prayerRequests: [matchingPrayer, otherPrayer]
    }, filters({
      type: ['prayer-requests'],
      person: [personB],
      search: 'encouragement'
    }));

    expect(result.prayerRequests).toEqual([matchingPrayer]);

    const privateLogOnly = selectAllItems({
      rhythms: [],
      sparks: [],
      prayerRequests: [matchingPrayer]
    }, filters({ search: 'private-only' }));
    expect(privateLogOnly.prayerRequests).toEqual([]);
  });

  it('sorts mixed item types by title in both directions and uses stable ID ties', () => {
    const collections = {
      rhythms: [
        rhythm('rhythm-z', 'Shared title'),
        rhythm('rhythm-a', 'Shared title')
      ],
      sparks: [spark('spark', 'Bravo Spark')],
      prayerRequests: [prayer('prayer', 'Alpha request')]
    };

    expect(orderedIds(collections, 'title')).toEqual([
      'prayer-request:prayer',
      'spark:spark',
      'rhythm:rhythm-a',
      'rhythm:rhythm-z'
    ]);
    expect(orderedIds(collections, 'title', 'descending')).toEqual([
      'rhythm:rhythm-a',
      'rhythm:rhythm-z',
      'spark:spark',
      'prayer-request:prayer'
    ]);
  });

  it('groups by the existing item-type order, then title, in both directions', () => {
    const collections = {
      rhythms: [rhythm('z-rhythm', 'Zulu rhythm'), rhythm('a-rhythm', 'Able rhythm')],
      sparks: [spark('z-spark', 'Zulu Spark'), spark('a-spark', 'Able Spark')],
      prayerRequests: [prayer('z-prayer', 'Zulu request'), prayer('a-prayer', 'Able request')]
    };

    expect(orderedIds(collections, 'type')).toEqual([
      'rhythm:a-rhythm', 'rhythm:z-rhythm',
      'spark:a-spark', 'spark:z-spark',
      'prayer-request:a-prayer', 'prayer-request:z-prayer'
    ]);
    expect(orderedIds(collections, 'type', 'descending')).toEqual([
      'prayer-request:a-prayer', 'prayer-request:z-prayer',
      'spark:a-spark', 'spark:z-spark',
      'rhythm:a-rhythm', 'rhythm:z-rhythm'
    ]);
  });

  it('sorts by the alphabetically first associated Person and keeps missing values last', () => {
    const collections = {
      rhythms: [
        rhythm('morgan', 'Morgan-linked', { personIds: [personB] }),
        rhythm('multi', 'Avery-first', { personIds: [personB, personA] }),
        rhythm('none', 'No Person', { personIds: [] })
      ],
      sparks: [],
      prayerRequests: []
    };

    expect(orderedIds(collections, 'person')).toEqual([
      'rhythm:multi',
      'rhythm:morgan',
      'rhythm:none'
    ]);
    expect(orderedIds(collections, 'person', 'descending')).toEqual([
      'rhythm:morgan',
      'rhythm:multi',
      'rhythm:none'
    ]);
  });

  it('uses the saved associations for Person sorting across Rhythms, Sparks, and Prayer requests', () => {
    const collections = {
      rhythms: [rhythm('rhythm-morgan', 'Morgan Rhythm', { personIds: [personB] })],
      sparks: [spark('spark-avery', 'Avery Spark', {
        ownerId: personB,
        sharedWith: [personA]
      })],
      prayerRequests: [
        prayer('prayer-morgan', 'Morgan Prayer', { personId: personB }),
        prayer('prayer-none', 'No Person', { personId: null, sharedWith: [] })
      ]
    };

    expect(orderedIds(collections, 'person')).toEqual([
      'spark:spark-avery',
      'prayer-request:prayer-morgan',
      'rhythm:rhythm-morgan',
      'prayer-request:prayer-none'
    ]);
    expect(orderedIds(collections, 'person', 'descending')).toEqual([
      'prayer-request:prayer-morgan',
      'rhythm:rhythm-morgan',
      'spark:spark-avery',
      'prayer-request:prayer-none'
    ]);
  });

  it('uses the configured chronological time order and keeps not-applicable last both ways', () => {
    const collections = {
      rhythms: [
        rhythm('evening', 'Evening', { timeOfDay: 'evening' }),
        rhythm('early', 'Early morning', { timeOfDay: 'early-morning' }),
        rhythm('anytime', 'Anytime', { timeOfDay: 'anytime' })
      ],
      sparks: [spark('spark', 'No time')],
      prayerRequests: [prayer('morning', 'Morning', { timeOfDay: 'morning' })]
    };

    expect(orderedIds(collections, 'time-of-day')).toEqual([
      'rhythm:anytime',
      'rhythm:early',
      'prayer-request:morning',
      'rhythm:evening',
      'spark:spark'
    ]);
    expect(orderedIds(collections, 'time-of-day', 'descending')).toEqual([
      'rhythm:evening',
      'prayer-request:morning',
      'rhythm:early',
      'rhythm:anytime',
      'spark:spark'
    ]);
  });

  it('uses schedule frequency order rather than labels and keeps unscheduled values last', () => {
    const collections = {
      rhythms: [
        rhythm('yearly', 'Yearly', { schedule: { frequency: 'yearly', month: 1, pattern: { kind: 'dayOfMonth', day: 1 } } }),
        rhythm('daily', 'Daily', { schedule: { frequency: 'daily' } }),
        rhythm('monthly', 'Monthly', { schedule: { frequency: 'monthly', pattern: { kind: 'dayOfMonth', day: 1 } } }),
        rhythm('biweekly', 'Every two weeks', {
          cadence: 'Every 2 weeks',
          schedule: { frequency: 'custom', unit: 'weeks', interval: 2, weekdays: [1], startDate: '2026-10-01' }
        }),
        rhythm('weekly', 'Weekly', { schedule: { frequency: 'weekly', weekdays: [1] } }),
        rhythm('unscheduled', 'Unscheduled')
      ],
      sparks: [spark('spark', 'No frequency')],
      prayerRequests: [
        prayer('quarterly', 'Quarterly', {
          schedule: { frequency: 'quarterly', monthInQuarter: 1, pattern: { kind: 'dayOfMonth', day: 1 } }
        })
      ]
    };

    expect(orderedIds(collections, 'frequency')).toEqual([
      'rhythm:daily',
      'rhythm:weekly',
      'rhythm:monthly',
      'prayer-request:quarterly',
      'rhythm:yearly',
      'rhythm:biweekly',
      'spark:spark',
      'rhythm:unscheduled'
    ]);
    expect(orderedIds(collections, 'frequency', 'descending')).toEqual([
      'rhythm:biweekly',
      'rhythm:yearly',
      'prayer-request:quarterly',
      'rhythm:monthly',
      'rhythm:weekly',
      'rhythm:daily',
      'spark:spark',
      'rhythm:unscheduled'
    ]);
  });

  it('applies search and filters before sorting, excludes archived Rhythms, and leaves inputs unchanged', () => {
    const rhythms = Object.freeze([
      rhythm('z-active', 'Zulu active', { description: 'shared query', schedule: { frequency: 'daily' } }),
      rhythm('a-active', 'Able active', { description: 'shared query', schedule: { frequency: 'weekly', weekdays: [1] } }),
      rhythm('archived', 'Archived shared query', { description: 'shared query' })
    ]);
    const collections = {
      rhythms,
      sparks: [spark('spark', 'Spark shared query')],
      prayerRequests: [prayer('prayer', 'Prayer shared query')],
      archivedRhythmIds: new Set(['archived'])
    };

    expect(orderedIds(collections, 'title', 'descending', {
      search: 'shared query',
      type: ['rhythms', 'sparks'],
      frequency: ['daily', 'weekly']
    })).toEqual([
      'rhythm:z-active',
      'rhythm:a-active'
    ]);
    expect(rhythms.map(item => item.id)).toEqual(['z-active', 'a-active', 'archived']);
  });

  it('retains the current grouped order unless a different sort is explicitly selected', () => {
    const collections = {
      rhythms: [rhythm('rhythm', 'A rhythm')],
      sparks: [spark('spark', 'A Spark')],
      prayerRequests: [prayer('prayer', 'A request')]
    };

    expect(orderedIds(collections, 'grouped')).toEqual([
      'rhythm:rhythm',
      'spark:spark',
      'prayer-request:prayer'
    ]);
  });
});
