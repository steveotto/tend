import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { AppNavigation } from '../src/components/AppNavigation.tsx';
import { selectGlobalSearchResults } from '../src/domain/global-search.ts';
import { createFriendshipData } from '../src/domain/friendships.ts';
import type { PersonPreview } from '../src/domain/preview-data.ts';
import type { GlobalSearchData } from '../src/domain/global-search.ts';
import type { GlobalSearchResult } from '../src/domain/global-search.ts';

afterEach(() => {
  cleanup();
  document.body.classList.remove('mobile-search-open');
});

const people: PersonPreview[] = [{ id: 'amy', displayName: 'Amy Sample' }];
const searchData: GlobalSearchData = {
  people,
  rhythms: [],
  prayerRequests: [],
  personNotes: [],
  friendships: createFriendshipData()
};

function MobileSearchHarness({ onResult }: { onResult: (result: GlobalSearchResult) => void }) {
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <AppNavigation
      destination="people"
      search={query}
      searchOpen={searchOpen}
      searchResults={selectGlobalSearchResults(query, searchData)}
      textSize="small"
      onNavigate={() => undefined}
      onSearchChange={setQuery}
      onSearchClose={() => {
        setQuery('');
        setSearchOpen(false);
        document.body.classList.remove('mobile-search-open');
      }}
      onSearchResult={onResult}
      onSearchToggle={() => {
        const next = !searchOpen;
        setSearchOpen(next);
        document.body.classList.toggle('mobile-search-open', next);
      }}
      onTextSizeChange={() => undefined}
    />
  );
}

describe('responsive global search results', () => {
  it('shows matching results in the labeled mobile search dialog', async () => {
    const user = userEvent.setup();
    const originalWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 650 });
    render(<MobileSearchHarness onResult={() => undefined} />);

    try {
      await user.click(screen.getByRole('button', { name: 'Open search' }));
      const input = screen.getByRole('combobox', { name: 'Search Tend' });
      await user.type(input, 'Amy');
      const dialog = screen.getByRole('dialog', { name: 'Search Tend' });

      expect(window.innerWidth).toBe(650);
      expect(document.body.classList.contains('mobile-search-open')).toBe(true);
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(screen.getByRole('option', { name: /Amy Sample/ })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Close search' })).toBeTruthy();
    } finally {
      if (originalWidth) Object.defineProperty(window, 'innerWidth', originalWidth);
    }
  });
});
