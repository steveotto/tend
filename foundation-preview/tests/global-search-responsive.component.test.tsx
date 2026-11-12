import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Root, type Rule } from 'postcss';
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

function mediaRule(
  root: Root,
  maxWidth: number,
  selectorIncludes: string,
  viewportWidth: number
): Rule | undefined {
  if (viewportWidth > maxWidth) return undefined;
  let match: postcss.Rule | undefined;
  root.walkAtRules('media', atRule => {
    const breakpoint = /max-width:\s*(\d+)px/.exec(atRule.params);
    if (!breakpoint || Number(breakpoint[1]) !== maxWidth) return;
    atRule.walkRules(rule => {
      if (rule.selector.includes(selectorIncludes)) match = rule;
    });
  });
  return match;
}

function declarationValue(rule: Rule | undefined, property: string): string | undefined {
  let value: string | undefined;
  rule?.walkDecls(property, declaration => {
    value = declaration.value;
  });
  return value;
}

function specificity(selector: string): readonly [number, number, number] {
  const ids = selector.match(/#[\w-]+/g)?.length ?? 0;
  const classes = selector.match(/\.[\w-]+/g)?.length ?? 0;
  const elements = selector.match(/(?:^|[\s>+~])(?:[a-z][\w-]*)/gi)?.length ?? 0;
  return [ids, classes, elements];
}

function compareSpecificity(first: readonly number[], second: readonly number[]): number {
  for (let index = 0; index < 3; index += 1) {
    const difference = (first[index] ?? 0) - (second[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

describe('responsive global search results', () => {
  it('shows matching People results in the narrow mobile search UI', async () => {
    const user = userEvent.setup();
    const originalWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 650 });
    render(<MobileSearchHarness onResult={() => undefined} />);

    try {
      await user.click(screen.getByRole('button', { name: 'Open search' }));
      const input = screen.getByRole('combobox', { name: 'Search Tend' });
      await user.type(input, 'Amy');

      expect(window.innerWidth).toBe(650);
      expect(document.body.classList.contains('mobile-search-open')).toBe(true);
      expect(screen.getByRole('option', { name: /Amy Sample/ })).toBeTruthy();
    } finally {
      if (originalWidth) Object.defineProperty(window, 'innerWidth', originalWidth);
    }
  });

  it('keeps the narrow fixed panel top rule ahead of the later mobile rule in the cascade', () => {
    const previewStyles = postcss.parse(readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8'));
    const sharedStyles = postcss.parse(readFileSync(resolve(process.cwd(), '../tend.css'), 'utf8'));
    const narrowRule = mediaRule(previewStyles, 650, '.utility-search-results--full-bleed', 650);
    const sharedMobileRule = mediaRule(sharedStyles, 720, 'body.mobile-search-open .utility-search-results', 650);

    expect(declarationValue(narrowRule, 'top'))
      .toBe('calc(env(safe-area-inset-top) + 128px)');
    expect(declarationValue(sharedMobileRule, 'top'))
      .toBe('calc(100% + 8px)');
    expect(declarationValue(narrowRule, 'position'))
      .toBe('fixed');
    expect(narrowRule).toBeDefined();
    expect(sharedMobileRule).toBeDefined();
    expect(compareSpecificity(specificity(narrowRule?.selector ?? ''), specificity(sharedMobileRule?.selector ?? '')))
      .toBeGreaterThan(0);
    expect(mediaRule(previewStyles, 650, '.utility-search-results--full-bleed', 651)).toBeUndefined();
  });
});
