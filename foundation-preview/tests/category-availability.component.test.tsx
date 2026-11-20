import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CategoryAvailabilityProvider } from '../src/components/CategoryAvailabilityContext.tsx';
import { PeopleView } from '../src/components/PeopleView.tsx';
import { CategorySettings } from '../src/components/CategorySettings.tsx';
import {
  createHealthFitnessHealthContribution,
  createHealthFitnessRollup
} from '../src/components/HealthRollupDiagram.tsx';
import { RhythmCategoryBadges } from '../src/components/RhythmCategoryBadges.tsx';
import { RhythmEditor } from '../src/components/RhythmEditor.tsx';
import {
  defaultCategoryPreferences,
  defaultFoundationPreferences
} from '../src/domain/category-availability.ts';
import {
  createPersonPickerGroups,
  createSamplePeople,
  foundationCatalogue,
  todayRhythms
} from '../src/domain/preview-data.ts';
import { createFriendshipData } from '../src/domain/friendships.ts';
import type { RhythmDraft, RhythmDraftErrors } from '../src/domain/rhythm-editor.ts';

describe('category availability component behavior', () => {
  afterEach(cleanup);

  it('keeps category switches separate from the expanded child-area switches', async () => {
    const user = userEvent.setup();
    const onCategoryChange = vi.fn();
    const onFoundationChange = vi.fn();
    render(
      <CategorySettings
        preferences={defaultCategoryPreferences}
        foundationPreferences={defaultFoundationPreferences}
        onChange={onCategoryChange}
        onFoundationChange={onFoundationChange}
      />
    );

    expect(screen.getByText('Choose the areas you want to focus on. Turning one off keeps its data and linked Rhythms.')).toBeTruthy();
    expect(screen.queryByRole('switch', { name: 'Strength Foundation' })).toBeNull();
    await user.click(screen.getByRole('button', { name: /Health.*Show Foundations/ }));
    const strengthSwitch = screen.getByRole('switch', { name: 'Strength Foundation' });
    expect((strengthSwitch as HTMLInputElement).checked).toBe(true);

    await user.click(screen.getByRole('switch', { name: 'Health & Fitness' }));
    await user.click(strengthSwitch);
    expect(onCategoryChange).toHaveBeenCalledWith('health', false);
    expect(onFoundationChange).toHaveBeenCalledWith('health-strength', false);
  });

  it('limits Health breakdown names and contribution nodes to enabled Foundations', () => {
    const enabledIds = new Set(['health-strength', 'health-cardio']);
    const rollup = createHealthFitnessRollup('category', 'health-fitness', enabledIds);
    const foundationGroup = rollup.groups.find(group => group.id === 'foundations');
    const rhythmGroup = rollup.groups.find(group => group.id === 'rhythms-logs');
    const categoryItem = rollup.groups.find(group => group.id === 'category')?.items[0];
    const contribution = createHealthFitnessHealthContribution({
      overallHealthScore: 80,
      categoryHealthScore: 75,
      strengthHealthScore: 70,
      cardioHealthScore: 80,
      weightHealthScore: 90,
      flexibilityHealthScore: 95,
      enabledFoundationIds: enabledIds
    });

    expect(foundationGroup?.items.map(item => item.id)).toEqual(['strength', 'cardio']);
    expect(rhythmGroup?.items.map(item => item.id)).toEqual(['strength-logs', 'cardio-logs']);
    expect(categoryItem?.explanation).not.toContain('Weight');
    expect(contribution.foundations.map(foundation => foundation.id))
      .toEqual(['health-strength', 'health-cardio']);

    const disabledRollup = createHealthFitnessRollup('category', 'health-fitness', new Set());
    const disabledCategoryItem = disabledRollup.groups
      .find(group => group.id === 'category')?.items[0];
    expect(disabledRollup.groups.find(group => group.id === 'foundations')?.items).toEqual([]);
    expect(disabledRollup.groups.find(group => group.id === 'rhythms-logs')?.items).toEqual([]);
    expect(disabledCategoryItem?.explanation)
      .toBe('No Health & Fitness Foundations are enabled, so this Category is unscored.');
  });

  it('restores saved Rhythm category links when a category is re-enabled', () => {
    const rhythm = { ...todayRhythms[0]!, categoryIds: ['faith'] as const };
    const view = render(
      <CategoryAvailabilityProvider preferences={{ ...defaultCategoryPreferences, faith: false }}>
        <RhythmCategoryBadges rhythm={rhythm} presentation="static" />
      </CategoryAvailabilityProvider>
    );

    expect(screen.queryByRole('group', { name: 'Associated categories' })).toBeNull();
    view.rerender(
      <CategoryAvailabilityProvider preferences={defaultCategoryPreferences}>
        <RhythmCategoryBadges rhythm={rhythm} presentation="static" />
      </CategoryAvailabilityProvider>
    );
    expect(screen.getByRole('img', { name: 'Faith' })).toBeTruthy();
  });

  it('hides disabled People filters and relationship badges without hiding People', () => {
    const preferences = {
      ...defaultCategoryPreferences,
      marriage: false,
      parenting: false,
      friendships: false
    };
    const people = createSamplePeople();
    render(
      <CategoryAvailabilityProvider preferences={preferences}>
        <PeopleView
          people={people}
          groups={createPersonPickerGroups()}
          friendships={createFriendshipData()}
          today="2026-11-14"
          onOpenPerson={vi.fn()}
        />
      </CategoryAvailabilityProvider>
    );

    const filters = screen.getByRole('group', { name: 'Filter People by classification' });
    expect(within(filters).getByRole('button', { name: 'All' })).toBeTruthy();
    expect(within(filters).queryByRole('button', { name: 'Marriage' })).toBeNull();
    expect(within(filters).queryByRole('button', { name: 'Parenting' })).toBeNull();
    expect(within(filters).queryByRole('button', { name: 'Friends' })).toBeNull();
    expect(screen.getAllByRole('article')).toHaveLength(people.length);
    expect(screen.queryByRole('group', { name: /relationship group/ })).toBeNull();
  });

  it('keeps hidden category and Foundation links when saving another Rhythm field', async () => {
    const user = userEvent.setup();
    const preferences = { ...defaultCategoryPreferences, faith: false };
    const practice = foundationCatalogue.find(foundation => foundation.categoryId === 'faith')!;
    const rhythm = {
      ...todayRhythms[0]!,
      categoryIds: ['faith'] as const,
      primaryFoundationId: practice.id,
      secondaryFoundationIds: []
    };
    const saveDraft = vi.fn((_draft: RhythmDraft): RhythmDraftErrors => ({}));
    render(
      <CategoryAvailabilityProvider preferences={preferences}>
        <RhythmEditor rhythm={rhythm} onSave={saveDraft} onClose={vi.fn()} />
      </CategoryAvailabilityProvider>
    );

    await user.click(screen.getByRole('button', { name: /^Choose categories/ }));
    expect(await screen.findByRole('heading', { name: 'Choose categories' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Faith' })).toBeNull();
    expect(screen.queryByRole('button', { name: practice.name })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Done' }));

    const title = screen.getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Updated while Faith is disabled');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(saveDraft).toHaveBeenCalledOnce();
    expect(saveDraft.mock.calls[0]?.[0]).toMatchObject({
      title: 'Updated while Faith is disabled',
      categoryIds: ['faith'],
      primaryFoundationId: practice.id
    });
  });

  it('hides a disabled child from the Rhythm picker but preserves its link on unrelated edits', async () => {
    const user = userEvent.setup();
    const foundation = foundationCatalogue.find(item => item.id === 'health-strength')!;
    const rhythm = {
      ...todayRhythms[0]!,
      categoryIds: ['health'] as const,
      primaryFoundationId: foundation.id,
      secondaryFoundationIds: []
    };
    const saveDraft = vi.fn((_draft: RhythmDraft): RhythmDraftErrors => ({}));
    render(
      <CategoryAvailabilityProvider
        preferences={defaultCategoryPreferences}
        foundationPreferences={{
          ...defaultFoundationPreferences,
          [foundation.id]: false
        }}
      >
        <RhythmEditor rhythm={rhythm} onSave={saveDraft} onClose={vi.fn()} />
      </CategoryAvailabilityProvider>
    );

    expect(screen.queryByRole('img', { name: /Strength/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: /^Choose categories/ }));
    expect(await screen.findByRole('heading', { name: 'Choose categories' })).toBeTruthy();
    const categories = screen.getByRole('group', { name: 'Available categories' });
    await user.click(within(categories).getByRole('button', { name: 'Health & Fitness' }));
    const foundationChoices = screen.getByRole('group', { name: 'Health & Fitness Foundations' });
    expect(within(foundationChoices).queryByRole('button', { name: foundation.name })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(saveDraft.mock.calls[0]?.[0]).toMatchObject({
      categoryIds: ['health'],
      primaryFoundationId: foundation.id
    });
  });
});
