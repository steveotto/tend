import { describe, expect, it } from 'vitest';
import { selectFocusData, selectFocusRhythms } from '../src/domain/focus.ts';
import { defaultCategoryPreferences, setCategoryPreference } from '../src/domain/category-availability.ts';
import { createFriendshipData } from '../src/domain/friendships.ts';
import type { CalendarEvent } from '../src/domain/calendar-events.ts';
import type { RhythmPreview } from '../src/domain/preview-data.ts';
import type { RhythmScoreSelection } from '../src/domain/rhythm-scoring.ts';
import { createDefaultTimeBlockSettings } from '../src/domain/time-blocks.ts';
import type { RhythmTimeValue } from '../src/domain/rhythm-schedule.ts';

const consistencyEvidence = {
  frequency: 'daily' as const,
  windowStartDate: '2026-10-01',
  windowEndDate: '2026-10-27',
  eligibleDueCount: 1,
  completedCount: 1,
  notCompletedCount: 0,
  limitedHistoryDays: null,
  todayIncluded: true,
  occurrences: []
};

function scored(value: number): RhythmScoreSelection {
  return {
    kind: 'rhythm-score',
    asOfDate: '2026-10-27',
    timeZone: 'UTC',
    trackingStartDate: '2026-10-01',
    consistency: {
      kind: 'scored',
      score: value,
      exactPercent: value,
      evidence: consistencyEvidence
    },
    onTrack: {
      kind: 'scored',
      score: value,
      evidence: {
        lastQualifyingCompletionDate: '2026-10-27',
        missedOccurrenceCount: 0,
        pointsPerMissedOccurrence: 10,
        deduction: 0,
        occurrences: [],
        repeatedZeroScoreSpans: [],
        scheduleChanges: []
      }
    },
    healthScore: value
  };
}

function rhythm(id: string, title: string, timeOfDay: RhythmTimeValue): RhythmPreview {
  return {
    id,
    title,
    automation: 'manual',
    status: 'Due today',
    schedule: { frequency: 'daily' },
    timeOfDay
  };
}

function event(
  id: string,
  title: string,
  startsAt: string,
  endsAt: string
): CalendarEvent {
  return {
    id,
    sourceId: 'source-a',
    sourceName: 'Home calendar',
    title,
    startsAt: Date.parse(startsAt),
    endsAt: Date.parse(endsAt),
    allDay: false
  };
}

describe('Focus horizon selector', () => {
  it('deduplicates active Rhythms and removes those linked only to unavailable categories', () => {
    const active: RhythmPreview = {
      ...rhythm('active', 'Active Rhythm', 'morning'),
      categoryIds: ['faith']
    };
    const unavailable: RhythmPreview = {
      ...rhythm('unavailable', 'Hidden Marriage Rhythm', 'morning'),
      categoryIds: ['marriage']
    };
    const crossCategory: RhythmPreview = {
      ...rhythm('cross-category', 'Cross-category Rhythm', 'morning'),
      categoryIds: ['marriage', 'faith']
    };
    const standalone = rhythm('standalone', 'Standalone Rhythm', 'morning');

    expect(selectFocusRhythms(
      [active, active, unavailable, crossCategory, standalone],
      new Set(['faith'])
    ).map(item => item.id)).toEqual(['active', 'cross-category', 'standalone']);
  });

  it('selects Now and the next two configured blocks and sorts each block by available Health', () => {
    const settings = createDefaultTimeBlockSettings();
    settings.blocks = settings.blocks.map(block =>
      block.id === 'morning' ? { ...block, name: 'Deep work' } : block
    );
    const rhythms = [
      rhythm('echo', 'Echo walk', 'morning'),
      rhythm('alpha', 'Alpha walk', 'morning'),
      rhythm('low', 'Low-scoring walk', 'morning'),
      rhythm('unscored', 'Unscored walk', 'morning'),
      rhythm('lunch', 'Lunch check-in', 'lunch'),
      rhythm('afternoon', 'Afternoon stretch', 'afternoon'),
      rhythm('anytime', 'Flexible reading', 'anytime')
    ];
    const data = selectFocusData({
      instant: new Date('2026-11-22T10:15:00Z'),
      timeZone: 'UTC',
      settings,
      rhythms,
      rhythmScores: new Map([
        ['echo', scored(60)],
        ['alpha', scored(60)],
        ['low', scored(20)],
        ['lunch', scored(35)],
        ['afternoon', scored(40)]
      ]),
      people: [],
      friendships: createFriendshipData(),
      personHealthScores: new Map(),
      calendarAvailable: false,
      calendarEvents: [],
      completedRhythmIds: new Set(),
      datedCompletions: []
    });

    expect(data?.blocks.map(block => [block.name, block.rangeLabel])).toEqual([
      ['Deep work', '9:00am–11:30am'],
      ['Lunch', '11:30am–1:30pm'],
      ['Afternoon', '1:30pm–4:30pm']
    ]);
    expect(data?.blocks.map(block => block.rhythms.map(item => item.rhythmId))).toEqual([
      ['low', 'alpha', 'echo', 'unscored'],
      ['lunch'],
      ['afternoon']
    ]);
    expect(data?.blocks.flatMap(block => block.rhythms).some(item => item.rhythmId === 'anytime')).toBe(false);
  });

  it('labels tomorrow and overnight blocks using the configured timezone across midnight and DST', () => {
    const settings = createDefaultTimeBlockSettings();
    settings.blocks = [
      { id: 'morning', name: 'Custom morning', start: '06:00' },
      { id: 'evening', name: 'Late session', start: '20:00' }
    ];
    settings.sleepStart = '23:00';

    const fallBack = selectFocusData({
      instant: new Date('2026-11-23T09:00:00Z'),
      timeZone: 'America/Los_Angeles',
      settings,
      rhythms: [],
      rhythmScores: new Map(),
      people: [],
      friendships: createFriendshipData(),
      personHealthScores: new Map(),
      calendarAvailable: false,
      calendarEvents: [],
      completedRhythmIds: new Set(),
      datedCompletions: []
    });
    expect(fallBack?.blocks.map(block => [block.id, block.localDate, block.dateLabel])).toEqual([
      ['sleep', '2026-11-22', 'Overnight · began yesterday'],
      ['morning', '2026-11-23', null],
      ['evening', '2026-11-23', null]
    ]);

    const springForward = selectFocusData({
      instant: new Date('2026-03-08T09:30:00Z'),
      timeZone: 'America/Los_Angeles',
      settings,
      rhythms: [],
      rhythmScores: new Map(),
      people: [],
      friendships: createFriendshipData(),
      personHealthScores: new Map(),
      calendarAvailable: false,
      calendarEvents: [],
      completedRhythmIds: new Set(),
      datedCompletions: []
    });
    expect(springForward?.blocks[0]?.startsAt).toBe(Date.parse('2026-03-08T07:00:00Z'));
    expect(springForward?.blocks[0]?.endsAt).toBe(Date.parse('2026-03-08T13:00:00Z'));
    expect(springForward?.blocks[1]?.localDate).toBe('2026-03-08');
  });

  it('labels tomorrow blocks and keeps them after the current overnight interval', () => {
    const data = selectFocusData({
      instant: new Date('2026-11-22T21:45:00Z'),
      timeZone: 'UTC',
      settings: createDefaultTimeBlockSettings(),
      rhythms: [rhythm('tomorrow', 'Tomorrow morning', 'early-morning')],
      rhythmScores: new Map(),
      people: [],
      friendships: createFriendshipData(),
      personHealthScores: new Map(),
      calendarAvailable: false,
      calendarEvents: [],
      completedRhythmIds: new Set(),
      datedCompletions: []
    });

    expect(data?.blocks.map(block => [block.id, block.localDate, block.dateLabel])).toEqual([
      ['bedtime', '2026-11-22', null],
      ['sleep', '2026-11-22', 'Overnight · into tomorrow'],
      ['early-morning', '2026-11-23', 'Tomorrow']
    ]);
    expect(data?.blocks[2]?.rhythms.map(item => item.rhythmId)).toEqual(['tomorrow']);
  });

  it('does not move a missed Rhythm from an earlier block into Now', () => {
    const data = selectFocusData({
      instant: new Date('2026-11-22T10:15:00Z'),
      timeZone: 'UTC',
      settings: createDefaultTimeBlockSettings(),
      rhythms: [rhythm('missed', 'Missed morning walk', 'early-morning')],
      rhythmScores: new Map(),
      people: [],
      friendships: createFriendshipData(),
      personHealthScores: new Map(),
      calendarAvailable: false,
      calendarEvents: [],
      completedRhythmIds: new Set(),
      datedCompletions: []
    });

    expect(data?.blocks.flatMap(block => block.rhythms)).toEqual([]);
  });

  it('excludes yesterday’s missed Evening occurrence until today’s occurrence enters the horizon', () => {
    const eveningRhythm: RhythmPreview = {
      id: 'daily-connection',
      title: 'Daily connection',
      automation: 'manual',
      status: 'Due today',
      timeLabel: 'Evening',
      schedule: { frequency: 'daily' },
      scoring: {
        trackingStartDate: '2026-11-22',
        timeZone: 'UTC',
        scheduleHistory: [{
          kind: 'scheduled',
          id: 'evening-season',
          startDate: '2026-11-22',
          schedule: { frequency: 'daily' },
          timeOfDay: 'evening',
          paletteToken: 'fern'
        }]
      }
    };
    const instant = new Date('2026-11-23T14:55:00Z');
    const data = selectFocusData({
      instant,
      timeZone: 'America/Los_Angeles',
      settings: createDefaultTimeBlockSettings(),
      rhythms: [eveningRhythm],
      rhythmScores: new Map(),
      people: [],
      friendships: createFriendshipData(),
      personHealthScores: new Map(),
      calendarAvailable: false,
      calendarEvents: [],
      completedRhythmIds: new Set(),
      datedCompletions: []
    });

    expect(data?.blocks.map(block => [block.name, block.localDate, block.rhythms])).toEqual([
      ['Early morning', '2026-11-23', []],
      ['Morning', '2026-11-23', []],
      ['Lunch', '2026-11-23', []]
    ]);
    expect(data?.blocks.flatMap(block => block.rhythms)).toEqual([]);

    const todayOccurrence = selectFocusData({
      instant: new Date('2026-11-24T04:30:00Z'),
      timeZone: 'America/Los_Angeles',
      settings: createDefaultTimeBlockSettings(),
      rhythms: [eveningRhythm],
      rhythmScores: new Map(),
      people: [],
      friendships: createFriendshipData(),
      personHealthScores: new Map(),
      calendarAvailable: false,
      calendarEvents: [],
      completedRhythmIds: new Set(),
      datedCompletions: []
    });
    expect(todayOccurrence?.blocks.map(block => block.name)).toEqual([
      'Evening',
      'Bedtime',
      'Sleep'
    ]);
    expect(todayOccurrence?.blocks.map(block =>
      block.rhythms.map(item => item.rhythmId)
    )).toEqual([
      ['daily-connection'],
      [],
      []
    ]);
    expect(eveningRhythm.timeOfDay).toBeUndefined();
    expect(eveningRhythm.timeLabel).toBe('Evening');
  });

  it('keeps custom overnight boundaries but excludes past custom-block occurrences', () => {
    const settings = createDefaultTimeBlockSettings();
    const customEvening = 'custom-time-block:11111111-1111-4111-8111-111111111111';
    const customNightCheck = 'custom-time-block:22222222-2222-4222-8222-222222222222';
    const customNightClose = 'custom-time-block:33333333-3333-4333-8333-333333333333';
    settings.blocks = [
      { id: customEvening, name: 'Evening review', start: '20:00' },
      { id: customNightCheck, name: 'Night check', start: '21:30' },
      { id: customNightClose, name: 'Night close', start: '23:00' }
    ];
    settings.sleepStart = '23:30';
    const nightRhythm: RhythmPreview = {
      id: 'night-close',
      title: 'Close the day',
      automation: 'manual',
      status: 'Due today',
      schedule: { frequency: 'daily' },
      timeOfDay: customNightClose,
      scoring: {
        trackingStartDate: '2026-11-22',
        timeZone: 'UTC',
        scheduleHistory: [{
          kind: 'scheduled',
          id: 'night-close-season',
          startDate: '2026-11-22',
          schedule: { frequency: 'daily' },
          timeOfDay: customNightClose,
          paletteToken: 'fern'
        }]
      }
    };

    const data = selectFocusData({
      instant: new Date('2026-11-23T06:00:00Z'),
      timeZone: 'UTC',
      settings,
      rhythms: [nightRhythm],
      rhythmScores: new Map(),
      people: [],
      friendships: createFriendshipData(),
      personHealthScores: new Map(),
      calendarAvailable: false,
      calendarEvents: [],
      completedRhythmIds: new Set(),
      datedCompletions: []
    });

    expect(data?.blocks.map(block => [block.name, block.localDate])).toEqual([
      ['Sleep', '2026-11-22'],
      ['Evening review', '2026-11-23'],
      ['Night check', '2026-11-23']
    ]);
    expect(data?.blocks.flatMap(block => block.rhythms)).toEqual([]);
  });

  it('does not duplicate the current occurrence across horizon blocks', () => {
    const data = selectFocusData({
      instant: new Date('2026-11-23T10:15:00Z'),
      timeZone: 'UTC',
      settings: createDefaultTimeBlockSettings(),
      rhythms: [rhythm('daily-morning', 'Daily morning practice', 'morning')],
      rhythmScores: new Map(),
      people: [],
      friendships: createFriendshipData(),
      personHealthScores: new Map(),
      calendarAvailable: false,
      calendarEvents: [],
      completedRhythmIds: new Set(),
      datedCompletions: []
    });

    expect(data?.blocks.flatMap(block => block.rhythms.map(item => item.rhythmId)))
      .toEqual(['daily-morning']);
  });

  it('keeps completed Rhythms visible, deduplicates them across the horizon, and orders plans separately', () => {
    const settings = createDefaultTimeBlockSettings();
    const completed = rhythm('completed', 'Morning practice', 'morning');
    const eventB = event('event-b', 'Dentist', '2026-11-22T10:45:00Z', '2026-11-22T11:00:00Z');
    const eventA = event('event-a', 'Planning', '2026-11-22T10:30:00Z', '2026-11-22T10:45:00Z');
    const data = selectFocusData({
      instant: new Date('2026-11-22T10:15:00Z'),
      timeZone: 'UTC',
      settings,
      rhythms: [completed],
      rhythmScores: new Map(),
      people: [],
      friendships: createFriendshipData(),
      personHealthScores: new Map(),
      calendarAvailable: true,
      calendarEvents: [eventB, eventA],
      completedRhythmIds: new Set(['completed']),
      datedCompletions: []
    });

    expect(data?.blocks[0]?.rhythms.map(item => [item.rhythmId, item.completed])).toEqual([
      ['completed', true]
    ]);
    expect(data?.blocks[0]?.calendarEvents.map(item => item.title)).toEqual(['Planning', 'Dentist']);
    expect(data?.blocks.slice(1).flatMap(block => block.calendarEvents)).toEqual([]);
  });

  it('selects up to two people strictly below 70, excluding unavailable scores and preserving precision', () => {
    const people = [
      { id: 'avery', displayName: 'Avery' },
      { id: 'morgan', displayName: 'Morgan' },
      { id: 'jordan', displayName: 'Jordan' },
      { id: 'casey', displayName: 'Casey' },
      { id: 'sam', displayName: 'Sam' }
    ];
    const data = selectFocusData({
      instant: new Date('2026-11-22T10:15:00Z'),
      timeZone: 'UTC',
      settings: createDefaultTimeBlockSettings(),
      rhythms: [],
      rhythmScores: new Map(),
      people,
      peopleGroups: [
        { id: 'marriage', label: 'Marriage', memberIds: ['avery', 'morgan'] },
        { id: 'parenting', label: 'Parenting', memberIds: ['jordan'] },
        { id: 'friends', label: 'Friends', memberIds: ['casey', 'sam'] },
        { id: 'dating', label: 'Dating partner', memberIds: [] }
      ],
      friendships: createFriendshipData(),
      personHealthScores: new Map([
        ['avery', 19.375],
        ['morgan', 69.9],
        ['jordan', 70],
        ['casey', null],
        ['sam', Number.NaN]
      ]),
      calendarAvailable: false,
      calendarEvents: [],
      completedRhythmIds: new Set(),
      datedCompletions: []
    });

    expect(data?.people).toEqual([
      { personId: 'avery', score: 19.375, recencyLabel: 'No connection logged' },
      { personId: 'morgan', score: 69.9, recencyLabel: 'No connection logged' }
    ]);
  });

  it('prioritizes relationship groups, deduplicates multiple memberships, and breaks score ties stably', () => {
    const people = [
      { id: 'shared', displayName: 'Morgan' },
      { id: 'marriage-a', displayName: 'Avery' },
      { id: 'marriage-b', displayName: 'Zoe' },
      { id: 'parenting', displayName: 'Jordan' },
      { id: 'friend', displayName: 'Casey' }
    ];
    const data = selectFocusData({
      instant: new Date('2026-11-22T10:15:00Z'),
      timeZone: 'UTC',
      settings: createDefaultTimeBlockSettings(),
      rhythms: [],
      rhythmScores: new Map(),
      people,
      peopleGroups: [
        { id: 'marriage', label: 'Marriage', memberIds: ['shared', 'marriage-b', 'marriage-a'] },
        { id: 'parenting', label: 'Parenting', memberIds: ['shared', 'parenting'] },
        { id: 'friends', label: 'Friends', memberIds: ['friend'] },
        { id: 'dating', label: 'Dating partner', memberIds: [] }
      ],
      categoryPreferences: defaultCategoryPreferences,
      friendships: createFriendshipData(),
      personHealthScores: new Map([
        ['shared', 68],
        ['marriage-a', 60],
        ['marriage-b', 60],
        ['parenting', 0],
        ['friend', 1]
      ]),
      calendarAvailable: false,
      calendarEvents: [],
      completedRhythmIds: new Set(),
      datedCompletions: []
    });

    expect(data?.people.map(person => [person.personId, person.score])).toEqual([
      ['marriage-a', 60],
      ['marriage-b', 60]
    ]);

    const sharedFirst = selectFocusData({
      instant: new Date('2026-11-22T10:15:00Z'),
      timeZone: 'UTC',
      settings: createDefaultTimeBlockSettings(),
      rhythms: [],
      rhythmScores: new Map(),
      people: [people[0]!, people[3]!, people[4]!],
      peopleGroups: [
        { id: 'marriage', label: 'Marriage', memberIds: ['shared'] },
        { id: 'parenting', label: 'Parenting', memberIds: ['shared', 'parenting'] },
        { id: 'friends', label: 'Friends', memberIds: ['friend'] },
        { id: 'dating', label: 'Dating partner', memberIds: [] }
      ],
      categoryPreferences: defaultCategoryPreferences,
      friendships: createFriendshipData(),
      personHealthScores: new Map([
        ['shared', 68],
        ['parenting', 0],
        ['friend', 1]
      ]),
      calendarAvailable: false,
      calendarEvents: [],
      completedRhythmIds: new Set(),
      datedCompletions: []
    });
    expect(sharedFirst?.people.map(person => person.personId)).toEqual(['shared', 'parenting']);
  });

  it('gives Dating partner priority when Dating is enabled and omits unavailable or unknown scores', () => {
    const preferences = setCategoryPreference(defaultCategoryPreferences, 'dating', true);
    const data = selectFocusData({
      instant: new Date('2026-11-22T10:15:00Z'),
      timeZone: 'UTC',
      settings: createDefaultTimeBlockSettings(),
      rhythms: [],
      rhythmScores: new Map(),
      people: [
        { id: 'dating-z', displayName: 'Zoe' },
        { id: 'dating-a', displayName: 'Avery' },
        { id: 'parenting', displayName: 'Jordan' },
        { id: 'friend', displayName: 'Casey' },
        { id: 'unknown', displayName: 'Taylor' }
      ],
      peopleGroups: [
        { id: 'marriage', label: 'Marriage', memberIds: [] },
        { id: 'dating', label: 'Dating partner', memberIds: ['dating-z', 'dating-a'] },
        { id: 'parenting', label: 'Parenting', memberIds: ['parenting'] },
        { id: 'friends', label: 'Friends', memberIds: ['friend', 'unknown'] }
      ],
      categoryPreferences: preferences,
      friendships: createFriendshipData(),
      personHealthScores: new Map([
        ['dating-z', 60],
        ['dating-a', 60],
        ['parenting', 1],
        ['friend', 0],
        ['unknown', null]
      ]),
      calendarAvailable: false,
      calendarEvents: [],
      completedRhythmIds: new Set(),
      datedCompletions: []
    });

    expect(data?.people.map(person => person.personId)).toEqual(['dating-a', 'dating-z']);
  });

  it('omits plans when Calendar is disabled', () => {
    const data = selectFocusData({
      instant: new Date('2026-11-22T10:15:00Z'),
      timeZone: 'UTC',
      settings: createDefaultTimeBlockSettings(),
      rhythms: [],
      rhythmScores: new Map(),
      people: [],
      friendships: createFriendshipData(),
      personHealthScores: new Map(),
      calendarAvailable: false,
      calendarEvents: [event('event-a', 'Dentist', '2026-11-22T10:30:00Z', '2026-11-22T11:00:00Z')],
      completedRhythmIds: new Set(),
      datedCompletions: []
    });

    expect(data?.blocks.flatMap(block => block.calendarEvents)).toEqual([]);
  });
});
