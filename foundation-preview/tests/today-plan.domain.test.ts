import { describe, expect, it } from 'vitest';
import { todayRhythms } from '../src/domain/preview-data.ts';
import { isRhythmEligibleForToday } from '../src/domain/category-rhythms.ts';
import {
  currentTodayBlock,
  migrateTodayViewSelection,
  selectTodayPlanGroups,
  selectTodayPlanSections,
  todayBlockRange,
  todayFocusContext
} from '../src/domain/today-plan.ts';
import { createDefaultTimeBlockSettings } from '../src/domain/time-blocks.ts';

describe('Today time-frame selectors', () => {
  it('uses the local block at exact boundaries and leaves the hidden overnight Sleep period unassigned', () => {
    expect(currentTodayBlock(new Date(2026, 9, 31, 5, 29))).toBeNull();
    expect(currentTodayBlock(new Date(2026, 9, 31, 5, 30))).toBe('early-morning');
    expect(currentTodayBlock(new Date(2026, 9, 31, 11, 29))).toBe('morning');
    expect(currentTodayBlock(new Date(2026, 9, 31, 11, 30))).toBe('lunch');
    expect(todayBlockRange('bedtime')).toBe('9:30pm – 10:00pm');
    expect(currentTodayBlock(new Date(2026, 9, 31, 22, 0))).toBeNull();
    expect(currentTodayBlock(new Date(2026, 11, 1, 3, 0))).toBeNull();
  });

  it('keeps scheduled Now empty during Sleep while leaving the other Today filters usable', () => {
    const instant = new Date(2026, 11, 1, 3, 0);
    const rhythms = [
      ...todayRhythms,
      { ...todayRhythms[0]!, id: 'all-day-rhythm', timeLabel: 'All day' },
      { ...todayRhythms[0]!, id: 'anytime-rhythm', timeLabel: 'Anytime' }
    ];

    expect(selectTodayPlanGroups(rhythms, 'scheduled', 'now', instant)).toEqual([]);
    expect(todayFocusContext('now', 'scheduled', instant)).toContain('Sleep');
    expect(selectTodayPlanGroups(rhythms, 'anytime', 'now', instant)
      .flatMap(group => group.rhythms.map(rhythm => rhythm.id)))
      .toEqual(['anytime-rhythm']);
    expect(selectTodayPlanGroups(rhythms, 'all-day', 'now', instant)
      .flatMap(group => group.rhythms.map(rhythm => rhythm.id)))
      .toEqual(['all-day-rhythm']);
    expect(selectTodayPlanGroups(rhythms, 'scheduled', 'everything-today', instant).length).toBeGreaterThan(0);
  });

  it('groups scheduled rhythms for Now, named blocks and Everything today without moving Anytime or All-day items', () => {
    const instant = new Date(2026, 9, 31, 10, 0);
    const rhythms = [
      ...todayRhythms,
      { ...todayRhythms[0]!, id: 'early-rhythm', timeLabel: 'Early morning' },
      { ...todayRhythms[0]!, id: 'all-day-rhythm', timeLabel: 'All day' },
      { ...todayRhythms[0]!, id: 'anytime-rhythm', timeLabel: 'Anytime' },
      { ...todayRhythms[0]!, id: 'untimed-rhythm', timeLabel: undefined }
    ];

    expect(selectTodayPlanGroups(rhythms, 'scheduled', 'now', instant)
      .flatMap(group => group.rhythms.map(rhythm => rhythm.id)))
      .toEqual(['sample-pray-together', 'untimed-rhythm']);
    expect(selectTodayPlanGroups(rhythms, 'scheduled', 'early-morning', instant)
      .flatMap(group => group.rhythms.map(rhythm => rhythm.id)))
      .toEqual(['early-rhythm']);
    expect(selectTodayPlanGroups(rhythms, 'scheduled', 'everything-today', instant)
      .flatMap(group => group.rhythms.map(rhythm => rhythm.id)))
      .toHaveLength(5);
    expect(selectTodayPlanGroups(rhythms, 'anytime', 'now', instant)
      .flatMap(group => group.rhythms.map(rhythm => rhythm.id)))
      .toEqual(['anytime-rhythm']);
    expect(selectTodayPlanGroups(rhythms, 'all-day', 'now', instant)
      .flatMap(group => group.rhythms.map(rhythm => rhythm.id)))
      .toEqual(['all-day-rhythm']);
  });

  it('builds All today sections in time order followed by Anytime and All-day', () => {
    const rhythms = [
      { ...todayRhythms[0]!, id: 'later', timeOfDay: 'evening' as const },
      { ...todayRhythms[0]!, id: 'flexible', timeOfDay: 'anytime' as const },
      { ...todayRhythms[0]!, id: 'earlier', timeOfDay: 'morning' as const },
      { ...todayRhythms[0]!, id: 'all-day', timeOfDay: 'all-day' as const }
    ];
    const sections = selectTodayPlanSections(
      rhythms,
      'all-today',
      new Date(2026, 9, 31, 10, 0)
    );

    expect(sections.map(section => section.id)).toEqual(['morning', 'evening', 'anytime', 'all-day']);
    expect(sections.map(section => section.category)).toEqual([
      'scheduled', 'scheduled', 'anytime', 'all-day'
    ]);
    expect(sections[0]?.range).toBe(todayBlockRange('morning'));
  });

  it('applies custom time-block names and keeps Now empty when no block is active', () => {
    const settings = createDefaultTimeBlockSettings();
    settings.blocks = settings.blocks.map(block => block.id === 'morning'
      ? { ...block, name: 'Quiet start' }
      : block);
    const rhythms = [{ ...todayRhythms[0]!, id: 'morning', timeOfDay: 'morning' as const }];
    const sections = selectTodayPlanSections(
      rhythms,
      'all-today',
      new Date(2026, 9, 31, 10, 0),
      settings
    );
    expect(sections[0]?.title).toBe('Quiet start');
    expect(selectTodayPlanSections(
      rhythms,
      'now',
      new Date(2026, 9, 31, 3, 0),
      settings
    )).toEqual([]);
  });

  it('migrates obsolete selections to one of the three valid Today tabs', () => {
    expect(migrateTodayViewSelection('now')).toBe('now');
    expect(migrateTodayViewSelection('anytime')).toBe('flexible');
    expect(migrateTodayViewSelection('all-day')).toBe('all-today');
    expect(migrateTodayViewSelection('everything-today')).toBe('all-today');
    expect(migrateTodayViewSelection('morning')).toBe('all-today');
    expect(migrateTodayViewSelection('scheduled')).toBe('now');
    expect(migrateTodayViewSelection('unknown')).toBe('now');
  });

  it('keeps due legacy Rhythms eligible while filtering through All today sections', () => {
    const instant = new Date(2026, 9, 25, 12, 0);
    const connection = todayRhythms.find(rhythm => rhythm.id === 'sample-connect')!;
    expect(isRhythmEligibleForToday(connection, '2026-10-25')).toBe(true);
    expect(selectTodayPlanSections([connection], 'all-today', instant).map(section => section.id))
      .toEqual(['evening']);
  });
});
