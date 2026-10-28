import { describe, expect, it } from 'vitest';
import {
  activeIdForMarriageSuggestion,
  categoryRhythmGroup,
  isRhythmRelevantOnDate
} from '../src/domain/category-rhythms.ts';
import { marriageRhythmSuggestions } from '../src/domain/preview-data.ts';
import { validateRhythmDraft } from '../src/domain/rhythm-editor.ts';

describe('Category Rhythm selectors', () => {
  it('uses stable identities for known Marriage suggestions only', () => {
    expect(activeIdForMarriageSuggestion('marriage.daily-connection'))
      .toBe('user-rhythm-00000000-0000-4000-8000-000000000001');
    expect(activeIdForMarriageSuggestion('unknown-template')).toBeUndefined();
    const ids = marriageRhythmSuggestions.map(suggestion =>
      activeIdForMarriageSuggestion(suggestion.templateId)
    );
    expect(ids).toHaveLength(9);
    expect(new Set(ids).size).toBe(9);
    expect(ids.every(id => id?.startsWith('user-rhythm-'))).toBe(true);
  });

  it('groups known frequencies and keeps Custom schedules distinct', () => {
    expect(categoryRhythmGroup({ cadence: 'Daily' })).toBe('daily');
    expect(categoryRhythmGroup({ cadence: 'Weekly' })).toBe('weekly');
    expect(categoryRhythmGroup({
      cadence: 'Quarterly',
      schedule: {
        frequency: 'quarterly',
        monthInQuarter: 1,
        pattern: { kind: 'dayOfMonth', day: 1 }
      }
    })).toBe('seasonal');
    expect(categoryRhythmGroup({
      cadence: 'Every 2 weeks',
      schedule: {
        frequency: 'custom',
        unit: 'weeks',
        interval: 2,
        weekdays: [1],
        startDate: '2026-10-27'
      }
    })).toBe('custom');
    expect(categoryRhythmGroup({ cadence: 'Unsupported cadence' })).toBeNull();
  });

  it('uses the existing schedule occurrence selector to determine today relevance', () => {
    expect(isRhythmRelevantOnDate({
      cadence: 'Daily',
      schedule: { frequency: 'daily' }
    }, '2026-10-27')).toBe(true);
    expect(isRhythmRelevantOnDate({
      cadence: 'Monday',
      schedule: { frequency: 'weekly', weekdays: [1] }
    }, '2026-10-27')).toBe(false);
    expect(isRhythmRelevantOnDate({ cadence: 'Unsupported cadence' }, '2026-10-27')).toBe(false);
  });

  it('requires Marriage category membership for valid Marriage Foundation links', () => {
    const base = {
      title: 'Shared rhythm',
      description: '',
      cadence: 'Daily',
      timeLabel: 'Anytime',
      personIds: [],
      categoryIds: ['parenting'] as ('parenting' | 'marriage')[],
      schedule: { frequency: 'daily' as const },
      primaryFoundationId: 'connection',
      secondaryFoundationIds: []
    };
    expect(validateRhythmDraft(base).foundationIds)
      .toBe('Marriage Foundation links require the Marriage category.');
    expect(validateRhythmDraft({ ...base, categoryIds: ['marriage', 'parenting'] }))
      .toEqual({});
    expect(validateRhythmDraft({
      ...base,
      categoryIds: ['marriage'],
      primaryFoundationId: 'not-a-foundation'
    }).foundationIds).toBe('Choose each available Marriage Foundation at most once.');
  });
});
