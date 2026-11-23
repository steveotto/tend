import { describe, expect, it } from 'vitest';
import { selectFocusData, selectFocusWindow } from '../src/domain/focus.ts';
import { createFriendshipData } from '../src/domain/friendships.ts';
import type { CalendarEvent } from '../src/domain/calendar-events.ts';
import type { RhythmPreview } from '../src/domain/preview-data.ts';
import { createDefaultTimeBlockSettings } from '../src/domain/time-blocks.ts';

describe('Focus window selector', () => {
  it('continues from the current block through the next selected block', () => {
    const settings = createDefaultTimeBlockSettings();
    settings.blocks = settings.blocks.map(block =>
      block.id === 'morning'
        ? { ...block, name: 'Quiet start', start: '09:30' }
        : block
    );
    const instant = new Date('2026-11-22T10:45:00Z');
    const window = selectFocusWindow(instant, settings, 'UTC', 'morning');

    expect(window?.name).toBe('Quiet start');
    expect(window?.nextName).toBe('Lunch');
    expect(window?.start).toBe(instant.getTime());
    expect(window?.end).toBe(Date.parse('2026-11-22T11:30:00Z'));
  });

  it('ends at midnight for the final selected block', () => {
    const settings = createDefaultTimeBlockSettings();
    settings.blocks = settings.blocks.filter(block =>
      block.id === 'morning' || block.id === 'bedtime'
    );
    const instant = new Date('2026-11-22T22:00:00Z');
    const window = selectFocusWindow(instant, settings, 'UTC', 'bedtime');

    expect(window?.nextName).toBeNull();
    expect(window?.end).toBe(Date.parse('2026-11-23T00:00:00Z'));
  });

  it('includes only fixed and due items in the current time window and omits completed/anytime items', () => {
    const settings = createDefaultTimeBlockSettings();
    const rhythm: RhythmPreview = {
      id: 'rhythm-morning',
      title: 'Morning walk',
      automation: 'manual',
      status: 'Due today',
      personIds: ['person-a'],
      schedule: { frequency: 'daily' },
      timeOfDay: 'morning'
    };
    const completed: RhythmPreview = {
      ...rhythm,
      id: 'rhythm-completed',
      title: 'Completed practice',
      schedule: { frequency: 'daily' }
    };
    const anytime: RhythmPreview = {
      ...rhythm,
      id: 'rhythm-anytime',
      title: 'Open practice',
      timeOfDay: 'anytime'
    };
    const event: CalendarEvent = {
      id: 'event-a',
      sourceId: 'source-a',
      sourceName: 'Home calendar',
      title: 'Dentist',
      startsAt: Date.parse('2026-11-22T10:30:00Z'),
      endsAt: Date.parse('2026-11-22T11:00:00Z'),
      allDay: false
    };

    const data = selectFocusData({
      instant: new Date('2026-11-22T10:15:00Z'),
      timeZone: 'UTC',
      settings,
      rhythms: [rhythm, completed, anytime],
      people: [{ id: 'person-a', displayName: 'Avery' }],
      friendships: createFriendshipData(),
      personHealthScores: new Map([['person-a', 72]]),
      calendarAvailable: true,
      calendarEvents: [event],
      completedRhythmIds: new Set(['rhythm-completed']),
      datedCompletions: [],
      blockId: 'morning'
    });

    expect(data?.items.map(item =>
      item.kind === 'calendar' ? item.title : item.rhythmId
    )).toEqual(['rhythm-morning', 'Dentist']);
  });

  it('reports known low-health people, excludes covered people, and omits unknown/zero fallbacks', () => {
    const settings = createDefaultTimeBlockSettings();
    const data = selectFocusData({
      instant: new Date('2026-11-22T10:15:00Z'),
      timeZone: 'UTC',
      settings,
      rhythms: [{
        id: 'rhythm-a',
        title: 'Call Avery',
        automation: 'manual',
        status: 'Due today',
        personIds: ['person-a'],
        schedule: { frequency: 'daily' },
        timeOfDay: 'morning'
      }],
      people: [
        { id: 'person-a', displayName: 'Avery' },
        { id: 'person-b', displayName: 'Morgan' },
        { id: 'person-c', displayName: 'Jordan' }
      ],
      friendships: createFriendshipData(),
      personHealthScores: new Map([
        ['person-a', 40],
        ['person-b', 70],
        ['person-c', null]
      ]),
      calendarAvailable: true,
      calendarEvents: [],
      completedRhythmIds: new Set(),
      datedCompletions: [],
      blockId: 'morning'
    });

    expect(data?.people.map(person => [person.personId, person.score])).toEqual([
      ['person-b', 70]
    ]);
  });

  it('does not include Calendar items when Calendar visibility is disabled', () => {
    const settings = createDefaultTimeBlockSettings();
    const data = selectFocusData({
      instant: new Date('2026-11-22T10:15:00Z'),
      timeZone: 'UTC',
      settings,
      rhythms: [],
      people: [],
      friendships: createFriendshipData(),
      personHealthScores: new Map(),
      calendarAvailable: false,
      calendarEvents: [{
        id: 'event-a',
        sourceId: 'source-a',
        sourceName: 'Home calendar',
        title: 'Dentist',
        startsAt: Date.parse('2026-11-22T10:30:00Z'),
        endsAt: Date.parse('2026-11-22T11:00:00Z'),
        allDay: false
      }],
      completedRhythmIds: new Set(),
      datedCompletions: []
    });

    expect(data?.items).toEqual([]);
  });
});
