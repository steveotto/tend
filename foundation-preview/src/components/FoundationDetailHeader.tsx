import type { FoundationPreview } from '../domain/preview-data.ts';
import { MarriageIcon } from './MarriageIcon.tsx';
import { PageHeroHeaderStack } from './PageHeroHeaderStack.tsx';

export function FoundationDetailHeader({
  foundation,
  headingId,
  backLabel,
  onBack
}: {
  foundation: FoundationPreview;
  headingId: string;
  backLabel: string;
  onBack: () => void;
}) {
  return (
    <PageHeroHeaderStack backLabel={backLabel} onBack={onBack}>
      <header className="foundation-detail-header foundation-detail-header--hero">
        <span className="foundation-detail-header__circles" aria-hidden="true">
          <span className="foundation-detail-header__circle foundation-detail-header__circle--top-right" />
          <span className="foundation-detail-header__circle foundation-detail-header__circle--bottom-right" />
          <span className="foundation-detail-header__circle foundation-detail-header__circle--bottom-left" />
        </span>
        <div className="foundation-detail-header__copy page-hero-header__copy">
          <h2 id={headingId} tabIndex={-1}>{foundation.name}</h2>
          <p>{foundation.description}</p>
        </div>
        <span className="page-hero-header__icon page-hero-header__icon--foundation foundation-detail-header__icon" aria-hidden="true">
          <MarriageIcon group="foundations" id={foundation.iconId ?? foundation.id} />
        </span>
      </header>
    </PageHeroHeaderStack>
  );
}
