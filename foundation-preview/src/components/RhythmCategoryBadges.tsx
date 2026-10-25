import { areas, type RhythmPreview } from '../domain/preview-data.ts';
import { AreaIcon } from './AreaIcon.tsx';

export function RhythmCategoryBadges({
  rhythm,
  itemsOnly = false
}: {
  rhythm: RhythmPreview;
  itemsOnly?: boolean;
}) {
  const categories = areas.filter(area => rhythm.categoryIds?.includes(area.id) === true);
  if (categories.length === 0) return null;

  const badges = categories.map(category => (
    <span
      key={category.id}
      className="rhythm-area-badge"
      role="img"
      aria-label={category.label}
      title={category.label}
    >
      <AreaIcon id={category.id} />
    </span>
  ));
  if (itemsOnly) return <>{badges}</>;

  return (
    <div className="today-rhythm-details__categories" role="group" aria-label="Associated categories">
      {badges}
    </div>
  );
}
