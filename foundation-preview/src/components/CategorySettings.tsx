import type { CategoryPreferences } from '../domain/category-availability.ts';
import { areas } from '../domain/preview-data.ts';
import type { CategoryId } from '../domain/preview-data.ts';
import { AreaIcon } from './AreaIcon.tsx';

export function CategorySettings({
  preferences,
  onChange
}: {
  preferences: CategoryPreferences;
  onChange: (categoryId: CategoryId, enabled: boolean) => void;
}) {
  return (
    <div className="category-settings">
      <p>Choose the areas you want to use. Turning one off keeps its saved data.</p>
      <ul className="category-settings__list">
        {areas.map(area => (
          <li className="category-settings__item" key={area.id}>
            <label>
              <span className="category-settings__identity">
                <AreaIcon id={area.id} />
                <span>{area.label}</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                aria-label={area.label}
                checked={preferences[area.id]}
                onChange={event => onChange(area.id, event.currentTarget.checked)}
              />
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
