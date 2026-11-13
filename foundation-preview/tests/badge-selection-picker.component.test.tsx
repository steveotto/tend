import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { BadgeSelectionPicker, toggleBadgeGroup } from '../src/components/BadgeSelectionPicker.tsx';
import { PersonBadgeVisual } from '../src/components/PersonBadge.tsx';
import { syntheticPeople, syntheticPersonPickerGroups } from '../src/domain/preview-data.ts';
import type { PersonId } from '../src/domain/preview-data.ts';

afterEach(cleanup);

describe('shared badge selection picker', () => {
  it('toggles whole groups for none, partial, and all selections while preserving outside IDs', () => {
    const marriage = ['sample-person-avery', 'sample-person-morgan'] as PersonId[];
    const friends = ['sample-person-avery', 'sample-person-jordan'] as PersonId[];
    const noSelection = toggleBadgeGroup<PersonId>([], marriage);
    expect(noSelection).toEqual(['sample-person-avery', 'sample-person-morgan']);
    expect(toggleBadgeGroup(noSelection, marriage)).toEqual([]);

    const partial = toggleBadgeGroup<PersonId>(['sample-person-avery'], marriage);
    expect(partial).toEqual(['sample-person-avery', 'sample-person-morgan']);

    const outsideSelection = ['sample-person-morgan'] as PersonId[];
    const overlapping = toggleBadgeGroup(outsideSelection, friends);
    expect(overlapping).toEqual([
      'sample-person-morgan',
      'sample-person-avery',
      'sample-person-jordan'
    ]);
    expect(toggleBadgeGroup(overlapping, friends)).toEqual(['sample-person-morgan']);
  });

  it('derives aria-pressed from all selected IDs and keeps individual people independently toggleable', async () => {
    const user = userEvent.setup();
    const groups = [
      { id: 'group-a', label: 'Group A', memberIds: ['sample-person-avery', 'sample-person-morgan'] },
      { id: 'group-b', label: 'Group B', memberIds: ['sample-person-morgan', 'sample-person-jordan'] },
      { id: 'group-c', label: 'Group C', memberIds: ['sample-person-avery', 'sample-person-jordan'] },
      { id: 'empty', label: 'Empty', memberIds: [] }
    ];
    function InteractivePicker() {
      const [selectedIds, setSelectedIds] = useState<PersonId[]>(['sample-person-avery']);
      return (
        <BadgeSelectionPicker
          title="Choose people"
          items={syntheticPeople}
          selectedIds={selectedIds}
          getLabel={person => person.displayName}
          renderBadge={person => <PersonBadgeVisual person={person} />}
          groups={groups}
          onToggle={id => setSelectedIds(current =>
            current.includes(id) ? current.filter(selected => selected !== id) : [...current, id]
          )}
          onToggleGroup={ids => setSelectedIds(current => toggleBadgeGroup(current, ids))}
          onDone={() => {}}
          onCancel={() => {}}
        />
      );
    }

    render(<InteractivePicker />);
    const picker = screen.getByRole('region', { name: 'Choose people' });
    const marriage = within(picker).getByRole('button', { name: 'Select Group A people' });
    const parenting = within(picker).getByRole('button', { name: 'Select Group B people' });
    const friends = within(picker).getByRole('button', { name: 'Select Group C people' });
    const emptyGroup = within(picker).getByRole('button', { name: 'Select Empty people' });

    expect(marriage.dataset.selected).toBe('false');
    expect(marriage.getAttribute('aria-pressed')).toBe('false');
    expect(document.getElementById(marriage.getAttribute('aria-describedby')!)?.textContent)
      .toContain('Activate to select all Group A members.');
    expect(parenting.dataset.selected).toBe('false');
    expect(friends.dataset.selected).toBe('false');
    expect(emptyGroup.hasAttribute('disabled')).toBe(true);
    expect(document.getElementById(emptyGroup.getAttribute('aria-describedby')!)?.textContent)
      .toContain('No people belong to Empty');
    expect(within(picker).queryByRole('searchbox')).toBeNull();
    expect(within(picker).queryByText(/^\d+ selected$/)).toBeNull();

    await user.click(marriage);
    expect(marriage.dataset.selected).toBe('true');
    expect(marriage.getAttribute('aria-pressed')).toBe('true');
    expect(document.getElementById(marriage.getAttribute('aria-describedby')!)?.textContent)
      .toBe('All Group A members are selected. Activate to deselect all Group A members.');
    expect(parenting.dataset.selected).toBe('false');
    expect(friends.dataset.selected).toBe('false');
    await user.click(marriage);
    expect(marriage.dataset.selected).toBe('false');
    expect(marriage.getAttribute('aria-pressed')).toBe('false');

    const morgan = within(picker).getByRole('button', { name: 'Morgan Reed' });
    expect(morgan.getAttribute('aria-pressed')).toBe('false');
    await user.click(morgan);
    expect(morgan.getAttribute('aria-pressed')).toBe('true');
    expect(marriage.dataset.selected).toBe('false');

    await user.click(parenting);
    expect(parenting.dataset.selected).toBe('true');
    expect(marriage.dataset.selected).toBe('false');
    expect(friends.dataset.selected).toBe('false');
    const avery = within(picker).getByRole('button', { name: 'Avery Brooks' });
    expect(avery.getAttribute('aria-pressed')).toBe('false');
    await user.click(avery);
    expect(marriage.dataset.selected).toBe('true');
    expect(parenting.dataset.selected).toBe('true');
    expect(friends.dataset.selected).toBe('true');
    await user.click(morgan);
    expect(marriage.dataset.selected).toBe('false');
    expect(parenting.dataset.selected).toBe('false');
    expect(friends.dataset.selected).toBe('true');
    await user.click(parenting);
    expect(parenting.dataset.selected).toBe('true');
    expect(friends.dataset.selected).toBe('true');
    await user.click(parenting);
    expect(parenting.dataset.selected).toBe('false');
    expect(avery.getAttribute('aria-pressed')).toBe('true');
    expect(morgan.getAttribute('aria-pressed')).toBe('false');
  });

  it('shows first names while keeping full names available to assistive technology', () => {
    render(
      <BadgeSelectionPicker
        title="Choose people"
        items={syntheticPeople}
        selectedIds={[]}
        getLabel={person => person.displayName}
        renderBadge={person => <PersonBadgeVisual person={person} />}
        groups={syntheticPersonPickerGroups}
        onToggle={() => {}}
        onToggleGroup={() => {}}
        onDone={() => {}}
        onCancel={() => {}}
      />
    );
    const picker = screen.getByRole('region', { name: 'Choose people' });

    expect(within(picker).getByRole('button', { name: 'Avery Brooks' })).toBeTruthy();
    expect(within(picker).getByText('Avery')).toBeTruthy();
    expect(within(picker).queryByText('Avery Brooks')).toBeNull();
    expect(within(picker).queryByText(/^\d+ selected$/)).toBeNull();
  });
});
