import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PeopleView } from '../src/components/PeopleView.tsx';
import { createFriendshipData } from '../src/domain/friendships.ts';
import { createPersonPickerGroups, createSamplePeople } from '../src/domain/preview-data.ts';
import type { PersonPickerGroupId, PersonPreview } from '../src/domain/preview-data.ts';

afterEach(() => cleanup());

describe('People creation', () => {
  it('creates a new stable identity with only the explicitly selected classifications', async () => {
    const user = userEvent.setup();
    const onCreatePerson = vi.fn((_person: PersonPreview, _groupIds: readonly PersonPickerGroupId[]) => null);
    render(
      <PeopleView
        people={createSamplePeople()}
        groups={createPersonPickerGroups()}
        friendships={createFriendshipData()}
        today="2026-10-31"
        onOpenPerson={vi.fn()}
        onCreatePerson={onCreatePerson}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Add person' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'Taylor Example');
    await user.click(within(dialog).getByRole('combobox', { name: 'Category: Not set' }));
    await user.click(within(dialog).getByRole('option', { name: 'Marriage' }));
    await user.click(within(dialog).getByRole('button', { name: 'Add person' }));

    expect(onCreatePerson).toHaveBeenCalledOnce();
    const [person, classifications] = onCreatePerson.mock.calls[0]!;
    expect(person).toMatchObject({ displayName: 'Taylor Example' });
    expect(person.id).toMatch(/^person-[0-9a-f-]{36}$/);
    expect(classifications).toEqual(['marriage']);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('retains the name and classification draft after a failed save', async () => {
    const user = userEvent.setup();
    const onCreatePerson = vi.fn((_person: PersonPreview, _groupIds: readonly PersonPickerGroupId[]) =>
      'Preview storage changed in another tab.');
    render(
      <PeopleView
        people={createSamplePeople()}
        groups={createPersonPickerGroups()}
        friendships={createFriendshipData()}
        today="2026-10-31"
        onOpenPerson={vi.fn()}
        onCreatePerson={onCreatePerson}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Add person' }));
    const dialog = screen.getByRole('dialog');
    const name = within(dialog).getByLabelText('Name');
    await user.type(name, 'Taylor Example');
    const category = within(dialog).getByRole('combobox', { name: 'Category: Not set' });
    await user.click(category);
    await user.click(within(dialog).getByRole('option', { name: 'Friend' }));
    await user.click(within(dialog).getByRole('button', { name: 'Add person' }));

    expect((await within(dialog).findByRole('alert')).textContent).toContain('Preview storage changed');
    expect((name as HTMLInputElement).value).toBe('Taylor Example');
    expect(within(dialog).getByRole('combobox', { name: 'Category: Friend' })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  });
});
