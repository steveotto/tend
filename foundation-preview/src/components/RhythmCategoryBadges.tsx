import { areas, type RhythmPreview } from '../domain/preview-data.ts';
import type { Destination } from './AppNavigation.tsx';
import { AreaIcon } from './AreaIcon.tsx';

export function RhythmCategoryBadges({
  rhythm,
  itemsOnly = false,
  presentation = 'interactive',
  onOpenCategory
}: {
  rhythm: RhythmPreview;
  itemsOnly?: boolean;
  presentation?: 'interactive' | 'static';
  onOpenCategory?: (categoryId: Destination, openerId: string) => void;
}) {
  const categories = areas.filter(area => rhythm.categoryIds?.includes(area.id) === true);
  if (categories.length === 0) return null;

  const badges = categories.map(category => {
    const visual = (
      <span className="rhythm-area-badge__visual" aria-hidden="true">
        <AreaIcon id={category.id} />
      </span>
    );
    return presentation === 'interactive' && onOpenCategory
      ? (
        <button
          key={category.id}
          id={`rhythm-category-badge-${rhythm.id}-${category.id}`}
          type="button"
          className="rhythm-area-badge"
          aria-label={category.label}
          title={category.label}
          data-tooltip={category.label}
          onClick={event => onOpenCategory(category.id, event.currentTarget.id)}
        >
          {visual}
        </button>
      )
      : (
        <span
          key={category.id}
          className="rhythm-area-badge"
          role="img"
          aria-label={category.label}
          title={category.label}
        >
          {visual}
        </span>
      );
  });
  if (itemsOnly) return <>{badges}</>;

  return (
    <div className="today-rhythm-details__categories" role="group" aria-label="Associated categories">
      {badges}
    </div>
  );
}
