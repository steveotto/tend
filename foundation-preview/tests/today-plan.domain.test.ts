import { describe, expect, it } from 'vitest';
import { todayRhythms } from '../src/domain/preview-data.ts';
import { currentTodayBlock, selectTodayPlanGroups, todayBlockRange } from '../src/domain/today-plan.ts';

describe('Today time-frame selectors', () => {
  it('uses the local block at exact boundaries and wraps the bedtime block overnight', () => {
    expect(currentTodayBlock(new Date(2026, 9, 31, 5, 29))).toBe('bedtime');
    expect(currentTodayBlock(new Date(2026, 9, 31, 5, 30))).toBe('early');
    expect(currentTodayBlock(new Date(2026, 9, 31, 11, 29))).toBe('morning');
    expect(currentTodayBlock(new Date(2026, 9, 31, 11, 30))).toBe('lunch');
    expect(todayBlockRange('bedtime')).toBe('9:30pm – 5:30am (next day)');
    expect(currentTodayBlock(new Date(2026, 11, 1, 3, 0))).toBe('bedtime');
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
    expect(selectTodayPlanGroups(rhythms, 'scheduled', 'early', instant)
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
});
