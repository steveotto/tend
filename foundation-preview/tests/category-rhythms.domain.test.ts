import { describe, expect, it } from 'vitest';
import {
  activeIdForMarriageSuggestion,
  categoryRhythmGroup,
  isRhythmRelevantOnDate,
  isValidSuggestionSourceId,
  legacySuggestionSourceForRhythmId,
  rhythmsForSuggestionSource
} from '../src/domain/category-rhythms.ts';
import {
  foundationCatalogue,
  faithPractices,
  faithRhythmSuggestionGroups,
  faithRhythmSuggestions,
  marriageRhythmSuggestions,
  parentingRhythmSuggestionGroups,
  parentingRhythmSuggestions
} from '../src/domain/preview-data.ts';
import type { PersonId, RhythmPreview } from '../src/domain/preview-data.ts';
import type { RhythmWeekday } from '../src/domain/rhythm-schedule.ts';
import { createRhythmDraft, saveRhythmDraft, validateRhythmDraft } from '../src/domain/rhythm-editor.ts';

describe('Category Rhythm selectors', () => {
  it('defines the ten Parenting suggestions with exact source IDs, recommendation groups, and owned Foundations', () => {
    expect(parentingRhythmSuggestionGroups.map(group => group.title)).toEqual([
      'Daily Connection',
      'Weekly & Regular',
      'Seasonal & Annual'
    ]);
    expect(parentingRhythmSuggestions.map(suggestion => [
      suggestion.sourceId,
      suggestion.title,
      suggestion.scheduleHint
    ])).toEqual([
      ['parenting.daily-connection', 'Daily Connection', 'Daily · Flexible'],
      ['parenting.walk-together', 'Walk Together', 'Weekly · Flexible'],
      ['parenting.prayer-conversation', 'Prayer & Conversation', 'Daily · Flexible'],
      ['parenting.one-on-one-time', 'One-on-One Time', 'Every 2 weeks · Flexible'],
      ['parenting.encouraging-text', 'Encouraging Text', 'Weekly · Flexible'],
      ['parenting.call-catch-up', 'Call & Catch Up', 'Weekly · Flexible'],
      ['parenting.special-outing', 'Special Outing', 'Quarterly · Flexible'],
      ['parenting.teach-life-skill', 'Teach a Life Skill', 'Quarterly · Flexible'],
      ['parenting.life-stage-check-in', 'Life-Stage Check-In', 'Weekly · Flexible recommendation'],
      ['parenting.trip-together', 'Trip Together', 'Yearly · Flexible']
    ]);

    const parentingFoundationIds = new Set(foundationCatalogue
      .filter(foundation => foundation.categoryId === 'parenting')
      .map(foundation => foundation.id));
    const linkedFoundationIds = new Set(parentingRhythmSuggestions.flatMap(suggestion => [
      suggestion.primaryFoundationId,
      ...suggestion.secondaryFoundationIds
    ]));
    expect([...linkedFoundationIds].sort()).toEqual([
      'parenting-communication-trust',
      'parenting-connection-belonging',
      'parenting-encouragement-affirmation',
      'parenting-fun-memories',
      'parenting-guidance-equipping',
      'parenting-spiritual-growth'
    ]);
    expect([...linkedFoundationIds].every(id => parentingFoundationIds.has(id))).toBe(true);
    expect(new Set(parentingRhythmSuggestions.map(suggestion => suggestion.sourceId)).size).toBe(10);
    expect(parentingRhythmSuggestions.every(suggestion => suggestion.sourceId.startsWith('parenting.'))).toBe(true);
    expect(parentingRhythmSuggestions.find(suggestion =>
      suggestion.sourceId === 'parenting.life-stage-check-in'
    )?.frequencyGuidance).toContain('Weekly is a starting recommendation');
  });

  it('defines all nine Faith suggestions with stable sources, grouped recommendations and existing Practice IDs', () => {
    expect(faithRhythmSuggestionGroups.map(group => group.title)).toEqual([
      'Daily & Regular',
      'Weekly',
      'Monthly'
    ]);
    expect(faithRhythmSuggestions.map(suggestion => [
      suggestion.sourceId,
      suggestion.title,
      suggestion.scheduleHint
    ])).toEqual([
      ['faith.sabbath', 'Sabbath', 'Weekly · Flexible'],
      ['faith.pray-together', 'Pray Together', 'Daily · Flexible'],
      ['faith.fasting', 'Fasting', 'Weekly · Flexible'],
      ['faith.solitude-silence', 'Solitude & Silence', 'Select Days · Flexible'],
      ['faith.generosity-practice', 'Generosity Practice', 'Monthly · Flexible'],
      ['faith.community-gathering', 'Community Gathering', 'Weekly · Flexible'],
      ['faith.serve-someone', 'Serve Someone', 'Weekly · Flexible'],
      ['faith.share-your-story', 'Share Your Story', 'Monthly · Flexible'],
      ['faith.bible-reading', 'Bible Reading', 'Daily · Flexible']
    ]);

    const practiceIds = new Set(faithPractices.map(practice => practice.id));
    expect(faithRhythmSuggestions.map(suggestion => suggestion.primaryFoundationId)).toEqual([
      'faith-sabbath',
      'faith-prayer',
      'faith-fasting',
      'faith-solitude',
      'faith-generosity',
      'faith-community',
      'faith-service',
      'faith-witness',
      'faith-scripture'
    ]);
    expect(faithRhythmSuggestions.every(suggestion =>
      practiceIds.has(suggestion.primaryFoundationId)
      && suggestion.secondaryFoundationIds.every(id => practiceIds.has(id))
      && isValidSuggestionSourceId(suggestion.sourceId)
    )).toBe(true);
    expect(new Set(faithRhythmSuggestions.map(suggestion => suggestion.sourceId)).size).toBe(9);
    expect(faithRhythmSuggestions.some(suggestion => suggestion.title === 'Other')).toBe(false);
  });

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
    expect(legacySuggestionSourceForRhythmId(ids[0]!)).toBe('marriage.daily-connection');
    expect(legacySuggestionSourceForRhythmId('user-rhythm-00000000-0000-4000-8000-000000000099')).toBeUndefined();
  });

  it('keeps suggestion source identity distinct from uniquely saved Rhythm instances', () => {
    const firstDraft = {
      ...createRhythmDraft(['marriage']),
      title: 'Daily Connection',
      personIds: ['sample-person-avery'] as PersonId[],
      schedule: { frequency: 'weekly' as const, weekdays: [1] as RhythmWeekday[] }
    };
    const first = saveRhythmDraft(
      [],
      firstDraft,
      'user-rhythm-11111111-1111-4111-8111-111111111111',
      'create',
      undefined,
      undefined,
      { suggestionSourceId: 'marriage.daily-connection' }
    );
    expect(first.errors).toEqual({});
    expect(first.savedRhythms?.[0]?.suggestionSourceId).toBe('marriage.daily-connection');

    const secondDraft = {
      ...firstDraft,
      title: 'Daily Connection',
      personIds: ['sample-person-morgan'] as PersonId[],
      schedule: { frequency: 'weekly' as const, weekdays: [3] as RhythmWeekday[] }
    };
    const second = saveRhythmDraft(
      first.savedRhythms!,
      secondDraft,
      'user-rhythm-22222222-2222-4222-8222-222222222222',
      'create',
      undefined,
      undefined,
      { suggestionSourceId: 'marriage.daily-connection' }
    );
    expect(second.errors).toEqual({});
    expect(second.savedRhythms).toHaveLength(2);
    expect(second.savedRhythms?.map(rhythm => rhythm.id)).toEqual([
      'user-rhythm-11111111-1111-4111-8111-111111111111',
      'user-rhythm-22222222-2222-4222-8222-222222222222'
    ]);
    expect(second.savedRhythms?.map(rhythm => rhythm.personIds)).toEqual([
      ['sample-person-avery'],
      ['sample-person-morgan']
    ]);
    expect(second.savedRhythms?.map(rhythm => rhythm.schedule?.frequency === 'weekly'
      ? rhythm.schedule.weekdays
      : [])).toEqual([[1], [3]]);

    const renamed = saveRhythmDraft(
      second.savedRhythms!,
      { ...secondDraft, title: 'Our Daily Connection' },
      'user-rhythm-22222222-2222-4222-8222-222222222222',
      'edit'
    );
    expect(renamed.savedRhythms?.find(rhythm => rhythm.id.endsWith('222222222222'))).toMatchObject({
      title: 'Our Daily Connection',
      suggestionSourceId: 'marriage.daily-connection'
    });

    const previews: RhythmPreview[] = [
      { id: 'one', title: 'Same title', automation: 'manual', status: 'Due today', suggestionSourceId: 'marriage.daily-connection' },
      { id: 'two', title: 'Same title', automation: 'manual', status: 'Due today', suggestionSourceId: 'marriage.daily-connection' },
      { id: 'manual', title: 'Same title', automation: 'manual', status: 'Due today' },
      { id: 'other-source', title: 'Same title', automation: 'manual', status: 'Due today', suggestionSourceId: 'marriage.date-night' }
    ];
    expect(rhythmsForSuggestionSource(previews, 'marriage.daily-connection').map(rhythm => rhythm.id))
      .toEqual(['one', 'two']);
    const parenting = saveRhythmDraft([], {
      ...createRhythmDraft(['parenting']),
      title: 'Connection time',
      personIds: []
    }, 'user-rhythm-33333333-3333-4333-8333-333333333333', 'create',
    undefined, undefined, { suggestionSourceId: 'parenting.test-recommendation' });
    expect(parenting.savedRhythms?.[0]?.suggestionSourceId).toBe('parenting.test-recommendation');
    expect(saveRhythmDraft([], firstDraft, 'user-rhythm-44444444-4444-4444-8444-444444444444', 'create',
      undefined, undefined, { suggestionSourceId: 'unknown-template' }).savedRhythms).toBeUndefined();
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

  it('validates Foundation ownership from the catalogue for any Category', () => {
    const base = {
      title: 'Shared rhythm',
      description: '',
      cadence: 'Daily',
      timeLabel: 'Anytime',
      personIds: [],
      categoryIds: ['parenting'] as ('parenting' | 'marriage' | 'finances')[],
      schedule: { frequency: 'daily' as const },
      primaryFoundationId: 'connection',
      secondaryFoundationIds: []
    };
    expect(validateRhythmDraft(base).foundationIds)
      .toBe('Assign the Marriage category or unlink these Foundation links: Connection.');
    expect(validateRhythmDraft({ ...base, categoryIds: ['marriage', 'parenting'] }))
      .toEqual({});

    const financeFoundation = foundationCatalogue.find(item => item.id === 'finance-example-milestone')!;
    const fixtureCatalogue = [...foundationCatalogue, {
      ...financeFoundation,
      id: 'synthetic-finance-ownership-fixture',
      name: 'Synthetic finance Foundation'
    }];
    const financeDraft = {
      ...base,
      primaryFoundationId: 'synthetic-finance-ownership-fixture',
      categoryIds: ['parenting'] as ('parenting' | 'marriage' | 'finances')[]
    };
    expect(validateRhythmDraft(financeDraft, fixtureCatalogue).foundationIds)
      .toBe('Assign the Finances category or unlink these Foundation links: Synthetic finance Foundation.');
    expect(validateRhythmDraft({
      ...financeDraft,
      categoryIds: ['finances']
    }, fixtureCatalogue)).toEqual({});

    expect(validateRhythmDraft({
      ...base,
      categoryIds: ['marriage'],
      primaryFoundationId: 'not-a-foundation'
    }).foundationIds).toBe('Remove or resolve unavailable Foundation links before saving: not-a-foundation.');
  });
});
