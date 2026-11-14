import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CategoryAvailabilityProvider } from '../src/components/CategoryAvailabilityContext.tsx';
import { PeopleView } from '../src/components/PeopleView.tsx';
import { RhythmCategoryBadges } from '../src/components/RhythmCategoryBadges.tsx';
import { RhythmEditor } from '../src/components/RhythmEditor.tsx';
import {
  defaultCategoryPreferences
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
    await user.click(screen.getByRole('button', { name: 'Apply' }));

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
});
