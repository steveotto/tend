import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import type { GlobalSearchResult, GlobalSearchSelection } from '../domain/global-search.ts';
import { areas } from '../domain/preview-data.ts';
import { AreaIcon } from './AreaIcon.tsx';

export type Destination = 'today' | 'focus' | 'people' | 'more' | (typeof areas)[number]['id'];
export type TextSize = 'small' | 'medium' | 'large';
export type CategoryTabNavigationRequest = {
  categoryId: Destination;
  requestId: number;
};

type AppNavigationProps = {
  destination: Destination;
  search: string;
  searchOpen: boolean;
  searchResults: GlobalSearchSelection;
  textSize: TextSize;
  onNavigate: (destination: Destination) => void;
  onSearchChange: (search: string) => void;
  onSearchClose: () => void;
  onSearchResult: (result: GlobalSearchResult) => void;
  onSearchToggle: () => void;
  onTextSizeChange: () => void;
};

export function AppNavigation({
  destination,
  search,
  searchOpen,
  searchResults,
  textSize,
  onNavigate,
  onSearchChange,
  onSearchClose,
  onSearchResult,
  onSearchToggle,
  onTextSizeChange
}: AppNavigationProps) {
  const [activeResultIndex, setActiveResultIndex] = useState(-1);
  const [expandedState, setExpandedState] = useState<{
    query: string;
    groupIds: ReadonlySet<string>;
  }>({ query: '', groupIds: new Set() });
  const expandedGroups = expandedState.query === search ? expandedState.groupIds : new Set<string>();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const mobileSearchToggleRef = useRef<HTMLButtonElement>(null);
  const displayedGroups = searchResults.groups.map(group => ({
    ...group,
    displayedResults: expandedGroups.has(group.id) ? group.allResults : group.results
  }));
  const displayedResults = displayedGroups.flatMap(group => group.displayedResults);
  const optionIds = displayedResults.map((_, index) => `tend-search-option-${index}`);
  const hasQuery = search.trim().length > 0;
  const statusText = !hasQuery
    ? ''
    : searchResults.isEmpty
      ? 'No results found.'
      : `${displayedResults.length} results shown across ${searchResults.groups.filter(group => group.totalCount > 0).length} groups.`;

  useEffect(() => {
    setActiveResultIndex(-1);
  }, [search]);

  useEffect(() => {
    if (!searchOpen) return;
    searchInputRef.current?.focus({ preventScroll: true });
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen && !hasQuery) return;
    function dismissOutsideSearch(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)
        || searchContainerRef.current?.contains(target)
        || mobileSearchToggleRef.current?.contains(target)) return;
      onSearchClose();
    }

    document.addEventListener('mousedown', dismissOutsideSearch);
    return () => document.removeEventListener('mousedown', dismissOutsideSearch);
  }, [hasQuery, onSearchClose, searchOpen]);

  function activateResult(result: GlobalSearchResult) {
    onSearchResult(result);
    onSearchClose();
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const resultCount = displayedResults.length;
    if (event.key === 'Escape') {
      event.preventDefault();
      onSearchClose();
      return;
    }
    if (resultCount === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveResultIndex(index => (index + 1) % resultCount);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveResultIndex(index => index <= 0 ? resultCount - 1 : index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveResultIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveResultIndex(resultCount - 1);
    } else if (event.key === 'Enter' && activeResultIndex >= 0) {
      event.preventDefault();
      const selectedResult = displayedResults[activeResultIndex];
      if (selectedResult) activateResult(selectedResult);
    }
  }

  function toggleGroupExpanded(groupId: string) {
    setExpandedState(current => {
      const next = new Set(current.query === search ? current.groupIds : []);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return { query: search, groupIds: next };
    });
    setActiveResultIndex(-1);
  }

  return (
    <>
      <header className="apphead">
        <div className="brand">
          <a
            href={import.meta.env.MODE === 'pages' ? '/' : '/app-preview.html'}
            aria-label="Tend Today"
            className="brand-home"
          >
            <img src="/brand/tend-logo.png" alt="Tend" />
          </a>
          <div className="brand-copy">
            <div className="brand-tagline">Tend to what matters</div>
          </div>
        </div>
        <div className="mobile-head-actions" aria-label="Quick controls">
          <button
            ref={mobileSearchToggleRef}
            type="button"
            className="mobile-head-button"
            aria-label={searchOpen ? 'Close search' : 'Open search'}
            aria-expanded={searchOpen}
            aria-controls="tendSearch"
            onClick={onSearchToggle}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>
          </button>
          <button
            type="button"
            className="mobile-head-button mobile-display-toggle"
            data-text-size={textSize}
            aria-label={`Today dashboard text size: ${textSize}. Tap to increase`}
            aria-pressed={textSize !== 'small'}
            title="Change Today text size"
            onClick={onTextSizeChange}
          >
            <span className="mobile-display-mark" aria-hidden="true">Aa</span>
            <span className="mobile-display-level" aria-hidden="true"><i /><i /><i /></span>
          </button>
        </div>
      </header>

      <div className="sticky-nav">
        <div className="nav-row nav-row-tools">
          <nav className="tabs" aria-label="Tools and navigation">
            <div className="utility-primary">
              <UtilityButton active={destination === 'today'} label="Today" onClick={() => onNavigate('today')} icon={<HomeIcon />} />
              <UtilityButton active={destination === 'focus'} label="Focus" onClick={() => onNavigate('focus')} icon={<span className="focus-nav-spark">✦</span>} />
              <UtilityButton active={destination === 'people'} label="People" onClick={() => onNavigate('people')} icon={<PeopleIcon />} />
              <UtilityButton active={destination === 'more'} label="More" ariaLabel="More, settings" onClick={() => onNavigate('more')} icon={<MenuIcon />} />
            </div>
            <div ref={searchContainerRef} className="utility-search">
              <span className="utility-search-icon" aria-hidden="true">⌕</span>
              <input
                ref={searchInputRef}
                id="tendSearch"
                type="search"
                placeholder="Search Tend..."
                aria-label="Search Tend"
                role="combobox"
                aria-autocomplete="list"
                aria-haspopup="listbox"
                aria-expanded={hasQuery}
                aria-controls="tend-search-results"
                aria-activedescendant={activeResultIndex >= 0 ? optionIds[activeResultIndex] : undefined}
                value={search}
                onChange={event => onSearchChange(event.currentTarget.value)}
                onKeyDown={handleSearchKeyDown}
              />
              {search && <button type="button" className="utility-search-clear" aria-label="Clear search" onClick={() => onSearchChange('')}>×</button>}
              {hasQuery && (
                <div
                  id="tend-search-results"
                  className={`utility-search-results${searchResults.isEmpty ? '' : ' utility-search-results--full-bleed'}`}
                  role="listbox"
                  aria-label="Search results"
                >
                  <p className="sr-only" aria-live="polite" aria-atomic="true">{statusText}</p>
                  {searchResults.isEmpty ? (
                    <p className="search-empty">No results found.</p>
                  ) : displayedGroups.filter(group => group.totalCount > 0).map(group => (
                    <section className="search-result-group" key={group.id} role="group" aria-label={group.label}>
                      <h3
                        aria-label={`${group.label} ${group.totalCount}`}
                        style={{ fontSize: 'var(--tend-type-category-label)' }}
                      >
                        {group.label}
                        <span style={{ fontSize: 'var(--tend-type-metadata)' }}>{group.totalCount}</span>
                      </h3>
                      {group.displayedResults.map(result => {
                        const index = displayedResults.indexOf(result);
                        return (
                          <button
                            id={optionIds[index]}
                            key={result.key}
                            type="button"
                            className="search-result"
                            role="option"
                            aria-selected={activeResultIndex === index}
                            onMouseMove={() => setActiveResultIndex(index)}
                            onClick={() => activateResult(result)}
                          >
                            <span className="search-result-main">
                              <strong style={{ fontSize: 'var(--tend-item-title-size)' }}>
                                {highlightMatch(result.title, search)}
                              </strong>
                              <small style={{ fontSize: 'var(--tend-type-description)' }}>
                                {highlightMatch(result.subtitle, search)}
                              </small>
                              {result.matchedContent && (
                                <small
                                  className="search-result-context"
                                  style={{ fontSize: 'var(--tend-type-description)' }}
                                >
                                  {highlightMatch(result.matchedContent, search)}
                                </small>
                              )}
                            </span>
                            <span className="search-result-tag" style={{ fontSize: 'var(--tend-type-category-label)' }}>
                              {result.tag}
                            </span>
                          </button>
                        );
                      })}
                      {group.remainingCount > 0 && (
                        <button
                          type="button"
                          className="search-result-more"
                          aria-expanded={expandedGroups.has(group.id)}
                          onClick={() => toggleGroupExpanded(group.id)}
                        >
                          {expandedGroups.has(group.id) ? 'Show less' : `+${group.remainingCount} more`}
                        </button>
                      )}
                    </section>
                  ))}
                </div>
              )}
            </div>
          </nav>
        </div>
        <div className="nav-row nav-row-areas">
          <span className="nav-row-label">Areas</span>
          <nav className="areanav" aria-label="Areas">
            {areas.map(area => (
              <button
                key={area.id}
                type="button"
                className={destination === area.id ? 'active' : ''}
                aria-current={destination === area.id ? 'page' : undefined}
                onClick={() => onNavigate(area.id)}
              >
                <span className="nav-ic" aria-hidden="true"><AreaIcon id={area.id} /></span>
                <span>{area.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}

function highlightMatch(text: string, query: string): ReactNode {
  const index = text.toLocaleLowerCase().indexOf(query.trim().toLocaleLowerCase());
  if (!query.trim() || index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + query.trim().length)}</mark>
      {text.slice(index + query.trim().length)}
    </>
  );
}

function UtilityButton({
  active,
  label,
  ariaLabel,
  icon,
  onClick
}: {
  active: boolean;
  label: string;
  ariaLabel?: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`utility-primary-button${active ? ' active' : ''}`} aria-label={ariaLabel} aria-current={active ? 'page' : undefined} onClick={onClick}>
      <span className="utility-nav-icon" aria-hidden="true">{icon}</span><span>{label}</span>
    </button>
  );
}

function HomeIcon() {
  return <svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></svg>;
}

function PeopleIcon() {
  return <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20v-1.5a6.5 6.5 0 0 1 13 0V20zM16 5a3.5 3.5 0 0 0 0 6.8M18 14a5.5 5.5 0 0 1 3.5 5.2V20h-3" /></svg>;
}

function MenuIcon() {
  return <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
}
