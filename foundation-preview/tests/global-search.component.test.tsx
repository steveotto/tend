import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppNavigation } from '../src/components/AppNavigation.tsx';
import type { GlobalSearchResult } from '../src/domain/global-search.ts';
import { selectGlobalSearchResults } from '../src/domain/global-search.ts';
import { createFriendshipData } from '../src/domain/friendships.ts';
import type { PersonPreview, RhythmPreview } from '../src/domain/preview-data.ts';
import type { PersonNote } from '../src/domain/person-notes.ts';
import type { PersonPrayerRequest } from '../src/domain/person-prayers.ts';
import type { GlobalSearchData } from '../src/domain/global-search.ts';

afterEach(cleanup);

const people: PersonPreview[] = [{ id: 'amy', displayName: 'Amy Sample' }];
const rhythms: RhythmPreview[] = [{
  id: 'amy-rhythm',
  title: 'Pray with Amy',
  automation: 'manual',
  status: 'Due today',
  personIds: ['amy'],
  categoryIds: ['faith']
}];
const prayerRequests: PersonPrayerRequest[] = [{
  id: 'amy-prayer',
  personId: 'amy',
  title: 'Family health',
  details: 'Pray for Amy’s family',
  status: 'active',
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
  prayerLogs: []
}];
const personNotes: PersonNote[] = [{
  id: 'amy-note',
  personId: 'amy',
  content: 'Ask about the garden project',
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z'
}];
const data = {
  people,
  rhythms,
  prayerRequests,
  personNotes,
  friendships: createFriendshipData()
};

function SearchHarness({
  onResult,
  searchData = data
}: {
  onResult: (result: GlobalSearchResult) => void;
  searchData?: GlobalSearchData;
}) {
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <AppNavigation
      destination="today"
      search={query}
      searchOpen={searchOpen}
      searchResults={selectGlobalSearchResults(query, searchData)}
      textSize="small"
      onNavigate={() => undefined}
      onSearchChange={setQuery}
      onSearchClose={() => {
        setQuery('');
        setSearchOpen(false);
      }}
      onSearchResult={onResult}
      onSearchToggle={() => setSearchOpen(open => !open)}
      onTextSizeChange={() => undefined}
    />
  );
}

describe('global search popover', () => {
  it('exposes an accessible live results list, highlights matches, and provides an empty state and clear action', async () => {
    const user = userEvent.setup();
    render(<SearchHarness onResult={vi.fn()} />);
    const input = screen.getByRole('combobox', { name: 'Search Tend' });

    await user.type(input, 'garden');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-controls')).toBe('tend-search-results');
    expect(screen.getByRole('listbox', { name: 'Search results' })).toBeTruthy();
    expect(screen.getByText('garden').tagName).toBe('MARK');
    expect(screen.getByText(/results shown across 1 groups/)).toBeTruthy();
    const option = screen.getByRole('option', { name: /Ask about the garden project/ });
    expect(option.querySelector('.search-result-main strong')?.getAttribute('style'))
      .toContain('font-size: var(--tend-item-title-size)');
    expect(option.querySelector('.search-result-main small')?.getAttribute('style'))
      .toContain('font-size: var(--tend-type-description)');
    expect(option.closest('[role="group"]')?.querySelector('h3')?.getAttribute('style'))
      .toContain('font-size: var(--tend-type-category-label)');
    expect(option.querySelector('.search-result-tag')?.getAttribute('style'))
      .toContain('font-size: var(--tend-type-category-label)');
    expect(screen.getByRole('listbox', { name: 'Search results' }).className)
      .toContain('utility-search-results--full-bleed');

    await user.clear(input);
    await user.type(input, 'nothing matches');
    expect(screen.getByText('No results found.', { selector: '.search-empty' })).toBeTruthy();
    expect(screen.getByRole('listbox', { name: 'Search results' }).className)
      .not.toContain('utility-search-results--full-bleed');

    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('listbox')).toBeNull();

    await user.type(input, 'family');
    expect(screen.getAllByText('family').every(element => element.tagName === 'MARK')).toBe(true);
  });

  it('supports arrow-key selection and Enter activation', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(<SearchHarness onResult={onResult} />);
    const input = screen.getByRole('combobox', { name: 'Search Tend' });
    await user.type(input, 'Amy');
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult.mock.calls[0]?.[0]).toMatchObject({
      kind: 'rhythm',
      rhythmId: 'amy-rhythm'
    });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('expands one result group past six and collapses it without changing its total count', async () => {
    const user = userEvent.setup();
    const searchData: GlobalSearchData = {
      ...data,
      rhythms: Array.from({ length: 7 }, (_, index) => ({
        id: `amy-rhythm-${index}`,
        title: `Amy rhythm ${index + 1}`,
        automation: 'manual' as const,
        status: 'Due today' as const,
        personIds: ['amy']
      }))
    };
    render(<SearchHarness onResult={vi.fn()} searchData={searchData} />);
    const input = screen.getByRole('combobox', { name: 'Search Tend' });
    await user.type(input, 'Amy');

    const rhythmGroup = screen.getByRole('group', { name: 'Rhythms' });
    expect(within(rhythmGroup).getAllByRole('option')).toHaveLength(6);
    expect(within(rhythmGroup).getByRole('heading', { name: 'Rhythms 7' })).toBeTruthy();
    await user.click(within(rhythmGroup).getByRole('button', { name: '+1 more' }));

    expect(within(rhythmGroup).getAllByRole('option')).toHaveLength(7);
    expect(within(rhythmGroup).getByRole('heading', { name: 'Rhythms 7' })).toBeTruthy();
    await user.click(within(rhythmGroup).getByRole('button', { name: 'Show less' }));

    expect(within(rhythmGroup).getAllByRole('option')).toHaveLength(6);
    expect(within(rhythmGroup).getByRole('heading', { name: 'Rhythms 7' })).toBeTruthy();
  });

  it('routes mouse selection through the supplied callback and closes mobile search', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(<SearchHarness onResult={onResult} />);
    await user.click(screen.getByRole('button', { name: 'Open search' }));
    const input = screen.getByRole('combobox', { name: 'Search Tend' });
    expect(document.activeElement).toBe(input);
    await user.type(input, 'Family health');
    const results = screen.getByRole('listbox', { name: 'Search results' });
    await user.click(within(results).getByRole('option', { name: /Family health.*Amy Sample.*Prayer/ }));

    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'prayer',
      requestId: 'amy-prayer',
      personId: 'amy'
    }));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open search' }).getAttribute('aria-expanded')).toBe('false');
  });

  it('closes and clears on an outside click', async () => {
    const user = userEvent.setup();
    render(<SearchHarness onResult={vi.fn()} />);
    const input = screen.getByRole('combobox', { name: 'Search Tend' });
    await user.click(screen.getByRole('button', { name: 'Open search' }));
    expect(document.activeElement).toBe(input);
    await user.type(input, 'Amy');
    await user.click(screen.getByRole('button', { name: 'Focus' }));

    expect((input as HTMLInputElement).value).toBe('');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open search' }).getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps the search toggle stable while search is open', async () => {
    const user = userEvent.setup();
    render(<SearchHarness onResult={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: 'Open search' });
    await user.click(toggle);
    const input = screen.getByRole('combobox', { name: 'Search Tend' });

    await user.click(screen.getByRole('button', { name: 'Close search' }));
    expect(screen.getByRole('button', { name: 'Open search' }).getAttribute('aria-expanded')).toBe('false');
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('closes and clears search on Escape', async () => {
    const user = userEvent.setup();
    render(<SearchHarness onResult={vi.fn()} />);
    const input = screen.getByRole('combobox', { name: 'Search Tend' });
    await user.type(input, 'Amy');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect((input as HTMLInputElement).value).toBe('');
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
