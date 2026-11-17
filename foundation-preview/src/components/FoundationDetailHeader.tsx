import type { FoundationPreview } from '../domain/preview-data.ts';
import { MarriageIcon } from './MarriageIcon.tsx';

export function FoundationDetailHeader({
  foundation,
  headingId
}: {
  foundation: FoundationPreview;
  headingId: string;
}) {
  return (
    <header className="foundation-detail-header foundation-detail-header--hero">
      <div className="foundation-detail-header__copy">
        <h2 id={headingId} tabIndex={-1}>{foundation.name}</h2>
        <p>{foundation.description}</p>
      </div>
      <span className="page-hero-header__icon page-hero-header__icon--foundation foundation-detail-header__icon" aria-hidden="true">
        <MarriageIcon group="foundations" id={foundation.iconId ?? foundation.id} />
      </span>
    </header>
  );
}
