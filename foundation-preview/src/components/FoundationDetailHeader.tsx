import type { FoundationPreview } from '../domain/preview-data.ts';
import type { ReactNode } from 'react';
import { formatScore } from '../domain/score-display.ts';
import { CategoryHealthBadge } from './Cards.tsx';
import { MarriageIcon } from './MarriageIcon.tsx';

export function FoundationDetailHeader({
  foundation,
  headingId,
  score,
  scoreLabel,
  scoreAction
}: {
  foundation: FoundationPreview;
  headingId: string;
  score?: number | null;
  scoreLabel?: string;
  scoreAction?: ReactNode;
}) {
  const scoreName = scoreLabel ?? `${foundation.name} Health`;
  const scoreAvailable = score !== undefined && score !== null && Number.isFinite(score);
  return (
    <header className="foundation-detail-header">
      <span className="foundation-card__icon" aria-hidden="true">
        <MarriageIcon group="foundations" id={foundation.iconId ?? foundation.id} />
      </span>
      <div className="foundation-detail-header__copy">
        <div className="foundation-detail-header__title-row">
          <h2 id={headingId} tabIndex={-1}>{foundation.name}</h2>
          {(score !== undefined || scoreAction) && (
            <div className="foundation-detail-header__actions">
              {score !== undefined && (
                <CategoryHealthBadge
                  score={scoreAvailable ? score : null}
                  displayScore={scoreAvailable ? score : null}
                  accessibleLabel={scoreAvailable
                    ? `${scoreName} ${formatScore(score)} out of 100`
                    : `${scoreName} score unavailable`}
                  appearance="rounded"
                />
              )}
              {scoreAction}
            </div>
          )}
        </div>
        <p>{foundation.description}</p>
      </div>
    </header>
  );
}
