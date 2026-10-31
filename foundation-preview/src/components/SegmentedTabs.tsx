import { useRef } from 'react';
import type { KeyboardEvent } from 'react';

export type SegmentedTab<TabId extends string> = {
  id: TabId;
  label: string;
  tabId: string;
  panelId: string;
};

export function SegmentedTabs<TabId extends string>({
  tabs,
  selectedTabId,
  ariaLabel,
  onChange,
  variant = 'default'
}: {
  tabs: readonly SegmentedTab<TabId>[];
  selectedTabId: TabId;
  ariaLabel: string;
  onChange: (tabId: TabId) => void;
  variant?: 'default' | 'compact';
}) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let target: number;
    if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') target = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = tabs.length - 1;
    else return;
    event.preventDefault();
    const nextTab = tabs[target]!;
    onChange(nextTab.id);
    tabRefs.current[target]?.focus();
  }

  return (
    <div
      className={`faith-view-nav marriage-view-nav segmented-tabs--count-${tabs.length}${variant === 'compact' ? ' segmented-tabs--compact' : ''}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={element => { tabRefs.current[index] = element; }}
          type="button"
          role="tab"
          id={tab.tabId}
          aria-controls={tab.panelId}
          aria-selected={selectedTabId === tab.id}
          tabIndex={selectedTabId === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={event => onKeyDown(event, index)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
