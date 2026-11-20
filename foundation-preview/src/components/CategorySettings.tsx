import { useState } from 'react';
import type { CategoryPreferences } from '../domain/category-availability.ts';
import type { FoundationPreferences } from '../domain/category-availability.ts';
import { areas, foundationCatalogue, foundationTerminologyForCategory } from '../domain/preview-data.ts';
import type { CategoryId } from '../domain/preview-data.ts';
import { AreaIcon } from './AreaIcon.tsx';
import { MarriageIcon } from './MarriageIcon.tsx';
import { SettingsSwitch } from './SettingsSwitch.tsx';

export function CategorySettings({
  preferences,
  foundationPreferences,
  onChange,
  onFoundationChange
}: {
  preferences: CategoryPreferences;
  foundationPreferences: FoundationPreferences;
  onChange: (categoryId: CategoryId, enabled: boolean) => void;
  onFoundationChange: (foundationId: string, enabled: boolean) => void;
}) {
  const [expandedCategories, setExpandedCategories] = useState<ReadonlySet<CategoryId>>(new Set());

  function toggleExpanded(categoryId: CategoryId) {
    setExpandedCategories(previous => {
      const next = new Set(previous);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  return (
    <div className="category-settings">
      <p>Choose the areas you want to focus on. Turning one off keeps its data and linked Rhythms.</p>
      <ul className="category-settings__list">
        {areas.map(area => {
          const term = foundationTerminologyForCategory(area.id);
          const children = foundationCatalogue.filter(foundation => foundation.categoryId === area.id);
          const expanded = expandedCategories.has(area.id);
          const childListId = `category-settings-${area.id}-children`;
          return (
            <li className="category-settings__item" key={area.id}>
              <div className="category-settings__category-row">
                <button
                  type="button"
                  className="category-settings__expand"
                  aria-expanded={expanded}
                  aria-controls={childListId}
                  onClick={() => toggleExpanded(area.id)}
                >
                  <span className="category-settings__identity">
                    <AreaIcon id={area.id} />
                    <span>{area.label}</span>
                  </span>
                  <span className="category-settings__expand-label">
                    {expanded ? 'Hide' : 'Show'} {term.plural}
                  </span>
                  <span className="category-settings__chevron" aria-hidden="true">{expanded ? '⌄' : '›'}</span>
                </button>
                <SettingsSwitch
                  label={area.label}
                  checked={preferences[area.id]}
                  onChange={enabled => onChange(area.id, enabled)}
                />
              </div>
              <ul
                className="category-settings__children"
                id={childListId}
                hidden={!expanded}
                aria-label={`${area.label} ${term.plural}`}
              >
                {children.map(foundation => (
                  <li className="category-settings__child" key={foundation.id}>
                    <span className="category-settings__child-identity">
                      <MarriageIcon group="foundations" id={foundation.iconId ?? foundation.id} />
                      <span>
                        <span className="category-settings__child-name">{foundation.name}</span>
                        <span className="category-settings__child-term">{term.singular}</span>
                      </span>
                    </span>
                    <SettingsSwitch
                      label={`${foundation.name} ${term.singular}`}
                      checked={foundationPreferences[foundation.id] === true}
                      onChange={enabled => onFoundationChange(foundation.id, enabled)}
                    />
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
