import { describe, expect, it } from 'vitest';
import {
  defaultCategoryPreferences,
  defaultFoundationPreferences,
  selectAvailableFoundationLinkedItems
} from '../src/domain/category-availability.ts';
import {
  datingFoundationIds,
  datingFoundations,
  datingRhythmSuggestionGroups,
  datingRhythmSuggestions,
  foundationCatalogue
} from '../src/domain/preview-data.ts';

const expectedSuggestions = [
  ['dating.plan-date', 'Plan a date together', 'dating-connection', 'weekly', 'Weekly'],
  ['dating.meaningful-check-in', 'Share a meaningful check-in', 'dating-connection', 'daily', 'Daily'],
  ['dating.know-you-question', 'Ask a question that helps us know each other better', 'dating-connection', 'weekly', 'Weekly'],
  ['dating.distraction-free-conversation', 'Have a distraction-free conversation', 'dating-communication', 'weekly', 'Weekly'],
  ['dating.listen-without-interrupting', 'Practice listening without interrupting', 'dating-communication', 'weekly', 'Weekly'],
  ['dating.communication-check-in', 'Check in on how we communicate', 'dating-communication', 'monthly', 'Monthly'],
  ['dating.try-new-activity', 'Try a new activity together', 'dating-fun-adventure', 'monthly', 'Monthly'],
  ['dating.take-turns-planning', 'Take turns planning a date', 'dating-fun-adventure', 'every-two-weeks', 'Every 2 weeks'],
  ['dating.explore-somewhere-new', 'Explore somewhere new', 'dating-fun-adventure', 'monthly', 'Monthly'],
  ['dating.commitments-check-in', 'Check in on commitments we made', 'dating-trust-honesty', 'weekly', 'Weekly'],
  ['dating.expectations', 'Discuss expectations openly', 'dating-trust-honesty', 'monthly', 'Monthly'],
  ['dating.boundaries', 'Check in on personal boundaries', 'dating-trust-honesty', 'monthly', 'Monthly'],
  ['dating.pray-together', 'Pray together', 'dating-shared-faith', 'weekly', 'Weekly'],
  ['dating.learning', 'Discuss something you are learning', 'dating-shared-faith', 'weekly', 'Weekly'],
  ['dating.gathering', 'Attend a faith gathering together', 'dating-shared-faith', 'weekly', 'Weekly'],
  ['dating.relationship-intentions', 'Discuss relationship intentions', 'dating-direction', 'monthly', 'Monthly'],
  ['dating.future-hopes', 'Talk about future hopes', 'dating-direction', 'monthly', 'Monthly'],
  ['dating.expectations-align', 'Check whether expectations still align', 'dating-direction', 'every-three-months', 'Every 3 months']
] as const;

describe('Dating Rhythm suggestions', () => {
  it('keeps six Dating Foundations independently associated and unscored by default', () => {
    expect(datingFoundations.map(foundation => foundation.id)).toEqual(datingFoundationIds);
    expect(foundationCatalogue.filter(foundation => foundation.categoryId === 'dating'))
      .toEqual(datingFoundations);
    expect(datingFoundations.every(foundation => foundation.categoryId === 'dating')).toBe(true);
    expect(datingFoundations.every(foundation => foundation.illustrativeScore === undefined)).toBe(true);
  });

  it('provides all 18 stable, described suggestions with their approved Foundation and frequency', () => {
    expect(datingRhythmSuggestions.map(suggestion => [
      suggestion.sourceId,
      suggestion.title,
      suggestion.primaryFoundationId,
      suggestion.recommendedFrequency,
      suggestion.cadence
    ])).toEqual(expectedSuggestions);
    expect(new Set(datingRhythmSuggestions.map(suggestion => suggestion.sourceId)).size).toBe(18);
    const knownFoundationIds = new Set<string>(datingFoundationIds);
    expect(datingRhythmSuggestions.every(suggestion =>
      suggestion.description.trim().length > 0
      && suggestion.scheduleHint.trim().length > 0
      && suggestion.secondaryFoundationIds.every(id => knownFoundationIds.has(id))
    )).toBe(true);

    for (const foundation of datingFoundations) {
      const group = datingRhythmSuggestionGroups.find(item => item.id === foundation.id.slice('dating-'.length));
      const suggestions = datingRhythmSuggestions.filter(item => item.primaryFoundationId === foundation.id);
      expect(group).toBeDefined();
      expect(suggestions).toHaveLength(3);
      expect(suggestions.every(item => item.groupId === group?.id)).toBe(true);
    }
  });

  it('keeps approved long intervals distinct and omits superseded or duplicated boundary suggestions', () => {
    const biweekly = datingRhythmSuggestions.find(item =>
      item.recommendedFrequency === 'every-two-weeks'
    );
    const trimonthly = datingRhythmSuggestions.find(item =>
      item.recommendedFrequency === 'every-three-months'
    );
    expect(biweekly?.scheduleHint).toContain('Every 2 weeks');
    expect(trimonthly?.scheduleHint).toContain('Every 3 months');
    expect(datingRhythmSuggestions.filter(item =>
      item.title.toLowerCase().includes('boundar')
    )).toHaveLength(1);
    expect(datingRhythmSuggestions.map(item => item.title)).not.toContain('Revisit an unresolved conversation');
    expect(datingRhythmSuggestions.map(item => item.title)).not.toContain('Follow through on a commitment');
  });

  it('filters Dating suggestions through the shared category and Foundation availability selector', () => {
    const linkedFoundationIds = (suggestion: typeof datingRhythmSuggestions[number]) => [
      suggestion.primaryFoundationId,
      ...suggestion.secondaryFoundationIds
    ];
    const disabledCategory = selectAvailableFoundationLinkedItems(
      {
        categoryPreferences: defaultCategoryPreferences,
        foundationPreferences: defaultFoundationPreferences
      },
      datingRhythmSuggestions,
      linkedFoundationIds
    );
    expect(disabledCategory).toEqual([]);

    const directionDisabled = selectAvailableFoundationLinkedItems(
      {
        categoryPreferences: {
          ...defaultCategoryPreferences,
          marriage: false,
          dating: true
        },
        foundationPreferences: {
          ...defaultFoundationPreferences,
          'dating-direction': false
        }
      },
      datingRhythmSuggestions,
      linkedFoundationIds
    );
    expect(directionDisabled).toHaveLength(15);
    expect(directionDisabled.some(suggestion =>
      suggestion.primaryFoundationId === 'dating-direction'
    )).toBe(false);
  });
});
