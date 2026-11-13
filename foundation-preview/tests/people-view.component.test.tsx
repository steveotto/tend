import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PeopleView } from '../src/components/PeopleView.tsx';
import { createEmptyPreviewData } from '../src/domain/preview-state.ts';
import { syntheticPeople } from '../src/domain/preview-data.ts';

describe('PeopleView', () => {
  it('shows first names and an accessible zero Health score while retaining full-name navigation', () => {
    const person = {
      ...syntheticPeople[0]!,
      displayName: 'Alexandria Brooks-Williams'
    };
    const onOpenPerson = vi.fn();
    render(
      <PeopleView
        people={[person]}
        groups={[]}
        friendships={createEmptyPreviewData().friendships}
        today="2026-10-19"
        healthScores={new Map([[person.id, 0]])}
        onOpenPerson={onOpenPerson}
      />
    );

    const profileButton = screen.getByRole('button', {
      name: 'Open profile for Alexandria Brooks-Williams'
    });
    expect(within(profileButton).getByText('Alexandria')).toBeTruthy();
    expect(within(profileButton).queryByText(person.displayName)).toBeNull();
    expect(within(profileButton).getByRole('img', { name: 'Person Health 0' }).textContent).toBe('0');

    fireEvent.click(profileButton);
    expect(onOpenPerson).toHaveBeenCalledExactlyOnceWith(person.id);
  });
});
