import type { ReactNode } from 'react';
import { areas } from '../domain/preview-data.ts';
import { AreaIcon } from './AreaIcon.tsx';

export type Destination = 'today' | 'focus' | 'people' | 'more' | (typeof areas)[number]['id'];
export type TextSize = 'small' | 'medium' | 'large';

type AppNavigationProps = {
  destination: Destination;
  search: string;
  searchOpen: boolean;
  textSize: TextSize;
  onNavigate: (destination: Destination) => void;
  onSearchChange: (search: string) => void;
  onSearchClose: () => void;
  onSearchToggle: () => void;
  onTextSizeChange: () => void;
};

export function AppNavigation({
  destination,
  search,
  searchOpen,
  textSize,
  onNavigate,
  onSearchChange,
  onSearchClose,
  onSearchToggle,
  onTextSizeChange
}: AppNavigationProps) {
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).format(new Date());

  return (
    <>
      <header className="apphead">
        <div className="brand">
          <a href="/app-preview.html" aria-label="Tend Today" className="brand-home">
            <img src="/brand/tend-logo.png" alt="Tend" />
          </a>
          <div className="brand-copy">
            <div className="sub">{dateLabel}</div>
            <div className="brand-tagline">Tend to what matters</div>
          </div>
        </div>
        <div className="mobile-head-actions" aria-label="Quick controls">
          <button
            type="button"
            className="mobile-head-button"
            aria-label={searchOpen ? 'Close search' : 'Open search'}
            aria-expanded={searchOpen}
            aria-controls="tendSearch"
            disabled={destination !== 'today'}
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
            <label className="utility-search">
              <span className="utility-search-icon" aria-hidden="true">⌕</span>
              <input
                id="tendSearch"
                type="search"
                placeholder="Search Tend..."
                aria-label="Search sample Rhythms"
                value={search}
                disabled={destination !== 'today'}
                onChange={event => onSearchChange(event.currentTarget.value)}
                onKeyDown={event => {
                  if (event.key === 'Escape') onSearchClose();
                }}
              />
              {search && <button type="button" className="utility-search-clear" aria-label="Clear search" onClick={() => onSearchChange('')}>×</button>}
            </label>
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
