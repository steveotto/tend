import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PersonBadgeList } from '../src/components/PersonBadge.tsx';
import { PersonLinkIcon } from '../src/components/PersonLinkIcon.tsx';
import { RhythmDetailsDialog } from '../src/components/RhythmDetailsDialog.tsx';
import connectionSvg from '../src/assets/tend-approved-icons/foundations/connection.svg?raw';
import { syntheticPeople, todayRhythms } from '../src/domain/preview-data.ts';
import type { RhythmPreview } from '../src/domain/preview-data.ts';

afterEach(cleanup);

function peopleForCount(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    ...syntheticPeople[index % syntheticPeople.length]!,
    displayName: `${syntheticPeople[index % syntheticPeople.length]!.displayName} ${index + 1}`
  }));
}

describe('shared people badge overflow', () => {
  it('renders the registered Connection foundation geometry inline with currentColor', () => {
    const { container } = render(<PersonLinkIcon />);
    const renderedSvg = container.querySelector('svg');
    const sourceSvg = new DOMParser()
      .parseFromString(connectionSvg, 'image/svg+xml')
      .documentElement;
    expect(renderedSvg).toBeTruthy();
    expect(renderedSvg?.getAttribute('viewBox')).toBe('0 0 64 64');
    expect(renderedSvg?.getAttribute('fill')).toBe('none');
    expect(renderedSvg?.getAttribute('stroke')).toBe('currentColor');
    expect(renderedSvg?.getAttribute('stroke-width')).toBe('5');
    expect(renderedSvg?.getAttribute('stroke-linecap')).toBe('round');
    expect(renderedSvg?.getAttribute('stroke-linejoin')).toBe('round');
    expect(renderedSvg?.getAttribute('aria-hidden')).toBe('true');
    expect(renderedSvg?.getAttribute('focusable')).toBe('false');
    const shapeAttributes = (element: Element) => [...element.attributes]
      .map(attribute => [attribute.name, attribute.value])
      .sort(([left], [right]) => left!.localeCompare(right!));
    expect([...renderedSvg!.children].map(element => [
      element.tagName.toLowerCase(),
      shapeAttributes(element)
    ])).toEqual([...sourceSvg.children].map(element => [
      element.tagName.toLowerCase(),
      shapeAttributes(element)
    ]));
  });

  it.each([0, 1, 2, 3, 4, 5])('shows the expected collapsed people badges for %i associated people', count => {
    const people = peopleForCount(count);
    render(
      <PersonBadgeList
        people={people}
        rhythmTitle="A shared Rhythm"
        onSelect={() => undefined}
        collapsedLimit={2}
      />
    );

    const group = screen.queryByRole('group', { name: 'People associated with A shared Rhythm' });
    if (count === 0) {
      expect(group).toBeNull();
      return;
    }
    const personButtons = within(group!).getAllByRole('button', { name: /^Open synthetic profile/ });
    const expectedVisible = count > 3 ? 2 : count;
    expect(personButtons).toHaveLength(expectedVisible);
    expect(personButtons.map(button => button.querySelector('.person-badge-name')?.textContent))
      .toEqual(people.slice(0, expectedVisible).map(person => person.displayName.split(' ')[0]));

    if (count > 3) {
      const overflow = within(group!).getByRole('button', {
        name: `Show ${count - 2} more people associated with A shared Rhythm`
      });
      expect(overflow.getAttribute('aria-expanded')).toBe('false');
      expect(overflow.textContent).toBe(`+${count - 2} more`);
    } else {
      expect(within(group!).queryByRole('button', { name: /Show \d+ more people/ })).toBeNull();
    }
  });

  it('expands and collapses by keyboard, restores the collapsed control focus, and activates revealed profiles', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const people = peopleForCount(5);
    render(
      <PersonBadgeList
        people={people}
        rhythmTitle="A shared Rhythm"
        onSelect={onSelect}
        collapsedLimit={2}
      />
    );
    const group = screen.getByRole('group', { name: 'People associated with A shared Rhythm' });
    const more = within(group).getByRole('button', { name: 'Show 3 more people associated with A shared Rhythm' });
    more.focus();
    await user.keyboard('{Enter}');

    const revealedPerson = within(group).getByRole('button', {
      name: `Open synthetic profile for ${people[2]!.displayName}`
    });
    expect(document.activeElement).toBe(revealedPerson);
    expect(within(group).getAllByRole('button', { name: /^Open synthetic profile/ })).toHaveLength(5);
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(people[2]!.id);

    const showLess = within(group).getByRole('button', { name: 'Show fewer people associated with A shared Rhythm' });
    expect(showLess.getAttribute('aria-expanded')).toBe('true');
    showLess.focus();
    await user.keyboard(' ');
    expect(document.activeElement).toBe(showLess);
    expect(within(group).getAllByRole('button', { name: /^Open synthetic profile/ })).toHaveLength(2);
    expect(within(group).getByRole('button', {
      name: 'Show 3 more people associated with A shared Rhythm'
    })).toBe(showLess);
  });

  it('keeps people lists unrestricted unless a collapsed limit is requested', () => {
    const people = peopleForCount(5);
    render(<PersonBadgeList people={people} rhythmTitle="Picker" onSelect={() => undefined} />);
    expect(screen.getAllByRole('button', { name: /^Open synthetic profile/ })).toHaveLength(5);
    expect(screen.queryByRole('button', { name: /more people associated/ })).toBeNull();
  });

  it('shows the shared Person + Link marker only when connection logging is enabled for attached people', () => {
    const people = peopleForCount(3);
    const rhythm = {
      ...todayRhythms[0]!,
      personIds: people.map(person => person.id),
      categoryIds: [],
      alsoLogConnection: true
    };
    const props = {
      rhythm,
      inline: true,
      people,
      onPersonSelect: () => undefined,
      onClose: () => undefined
    };
    const { rerender } = render(<RhythmDetailsDialog {...props} />);
    const peopleGroupName = `People associated with ${rhythm.title}`;
    const peopleGroup = screen.getByRole('group', { name: peopleGroupName });
    const indicator = within(peopleGroup).getByRole('img', { name: 'Also logs a connection.' });
    const lastPersonBadge = within(peopleGroup).getByRole('button', {
      name: `Open synthetic profile for ${people[2]!.displayName}`
    });

    expect(lastPersonBadge.compareDocumentPosition(indicator) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(indicator.getAttribute('title')).toBe('Also logs a connection.');
    expect(indicator.getAttribute('data-tooltip')).toBe('Also logs a connection.');
    expect(indicator.querySelector('svg')?.getAttribute('stroke')).toBe('currentColor');
    expect(indicator.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 64 64');
    expect(indicator.querySelector('svg')?.getAttribute('stroke-width')).toBe('5');

    indicator.focus();
    expect(document.activeElement).toBe(indicator);

    rerender(<RhythmDetailsDialog {...props} rhythm={{ ...rhythm, alsoLogConnection: false }} />);
    expect(screen.queryByRole('img', { name: 'Also logs a connection.' })).toBeNull();

    const unsetRhythm: RhythmPreview = { ...rhythm };
    delete unsetRhythm.alsoLogConnection;
    rerender(<RhythmDetailsDialog {...props} rhythm={unsetRhythm} />);
    expect(screen.queryByRole('img', { name: 'Also logs a connection.' })).toBeNull();

    rerender(
      <RhythmDetailsDialog
        {...props}
        rhythm={{ ...rhythm, personIds: [], alsoLogConnection: true }}
        people={[]}
      />
    );
    expect(screen.queryByRole('img', { name: 'Also logs a connection.' })).toBeNull();
    expect(screen.queryByRole('group', { name: peopleGroupName })).toBeNull();
  });

  it('keeps category badges after expanded people and the Show less control', async () => {
    const user = userEvent.setup();
    const onPersonSelect = vi.fn();
    const rhythm = {
      ...todayRhythms[0]!,
      categoryIds: ['faith', 'marriage'] as const
    };
    const people = peopleForCount(5);
    render(
      <RhythmDetailsDialog
        rhythm={rhythm}
        inline
        people={people}
        onPersonSelect={onPersonSelect}
        onTend={() => undefined}
        onClose={() => undefined}
      />
    );
    const associationRow = screen.getByRole('group', { name: `Associations for ${rhythm.title}` });
    const more = within(associationRow).getByRole('button', {
      name: `Show 3 more people associated with ${rhythm.title}`
    });
    const firstCategory = within(associationRow).getAllByRole('img')[0]!;
    expect(more.compareDocumentPosition(firstCategory) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    more.focus();
    await user.keyboard('{Enter}');
    const showLess = within(associationRow).getByRole('button', {
      name: `Show fewer people associated with ${rhythm.title}`
    });
    const revealedPerson = within(associationRow).getByRole('button', {
      name: `Open synthetic profile for ${people[4]!.displayName}`
    });
    expect(showLess.compareDocumentPosition(firstCategory) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    revealedPerson.focus();
    await user.keyboard('{Enter}');
    expect(onPersonSelect).toHaveBeenCalledExactlyOnceWith(people[4]!.id);
  });
});
