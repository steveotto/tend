import { HEALTH_CONSISTENCY_WEIGHT, HEALTH_ON_TRACK_WEIGHT } from '../domain/rhythm-history.ts';
import {
  formatHealthWeightedProduct,
  formatHealthWeightedSum,
  formatScore
} from '../domain/score-display.ts';

type HealthWeightPanelsProps = {
  consistencyScore?: number | null;
  onTrackScore?: number | null;
  consistencyCaption?: string;
  onTrackCaption?: string;
  consistencyDescription?: string;
  onTrackDescription?: string;
};

export function healthWeightContributions(
  consistencyScore: number | null,
  onTrackScore: number | null
): { consistency: number | null; onTrack: number | null } {
  return {
    consistency: consistencyScore !== null && Number.isFinite(consistencyScore)
      ? consistencyScore * HEALTH_CONSISTENCY_WEIGHT
      : null,
    onTrack: onTrackScore !== null && Number.isFinite(onTrackScore)
      ? onTrackScore * HEALTH_ON_TRACK_WEIGHT
      : null
  };
}

export function formatTruthfulWeightedSum(
  consistency: number,
  onTrack: number,
  total: number
): readonly [string, string, string, '=' | '≈'] {
  return formatHealthWeightedSum(consistency, onTrack, total);
}

export function HealthWeightPanels({
  consistencyScore,
  onTrackScore,
  consistencyCaption,
  onTrackCaption,
  consistencyDescription,
  onTrackDescription
}: HealthWeightPanelsProps) {
  const consistencyWeight = HEALTH_CONSISTENCY_WEIGHT * 100;
  const onTrackWeight = HEALTH_ON_TRACK_WEIGHT * 100;
  const contributions = healthWeightContributions(consistencyScore ?? null, onTrackScore ?? null);
  const consistencyContribution = consistencyScore === undefined ? undefined : contributions.consistency;
  const onTrackContribution = onTrackScore === undefined ? undefined : contributions.onTrack;
  const consistencyFormula = consistencyScore !== undefined
    && consistencyScore !== null
    && consistencyContribution !== null
    ? formatHealthWeightedProduct(consistencyScore, HEALTH_CONSISTENCY_WEIGHT)
    : null;
  const onTrackFormula = onTrackScore !== undefined
    && onTrackScore !== null
    && onTrackContribution !== null
    ? formatHealthWeightedProduct(onTrackScore, HEALTH_ON_TRACK_WEIGHT)
    : null;
  const accessibleScore = (score: number | null | undefined) =>
    score !== null && score !== undefined && Number.isFinite(score)
      ? formatScore(score)
      : 'unavailable';
  const formattedContribution = (value: number) => formatScore(value);

  return (
    <div className="rhythm-history-view__health-weight-panels">
      <div className="rhythm-history-view__health-weight-panel rhythm-history-view__health-weight-panel--consistency">
        <div className="rhythm-history-view__health-weight-value">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
            <path d="M8 3.5v4M16 3.5v4M3.5 9.5h17m-11 5 2 2 4-4" />
          </svg>
          <strong>{consistencyWeight}%</strong>
        </div>
        <span className="rhythm-history-view__health-weight-name">Consistency</span>
        {consistencyContribution !== undefined ? (
          <span
            className="rhythm-history-view__health-weight-formula"
            aria-label={`${consistencyWeight}% times ${accessibleScore(consistencyScore)} ${consistencyFormula?.operator === '≈' ? 'approximately equals' : 'equals'} ${consistencyContribution === null ? 'unavailable' : `${consistencyFormula?.contribution ?? formattedContribution(consistencyContribution)} points`}`}
          >
            <span>{consistencyWeight}% × {consistencyFormula?.score ?? '—'} {consistencyFormula?.operator ?? '='} </span>
            <strong>{consistencyFormula ? `${consistencyFormula.contribution} points` : '—'}</strong>
          </span>
        ) : consistencyScore !== undefined && (
          <span className="rhythm-history-view__health-weight-score">
            {consistencyScore !== null && Number.isFinite(consistencyScore)
              ? `${formatScore(consistencyScore)}%`
              : '—'}
          </span>
        )}
        {consistencyContribution === undefined && (
          <>
            <span className="rhythm-history-view__health-weight-subtitle">
              {consistencyCaption ?? consistencyDescription ?? 'Your longer-term pattern.'}
            </span>
            {consistencyCaption && consistencyDescription && (
              <span className="rhythm-history-view__health-weight-description">{consistencyDescription}</span>
            )}
          </>
        )}
      </div>
      <span className="rhythm-history-view__health-weight-plus" aria-hidden="true">+</span>
      <div className="rhythm-history-view__health-weight-panel rhythm-history-view__health-weight-panel--on-track">
        <div className="rhythm-history-view__health-weight-value">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="8" />
            <path d="M12 7v5l3 2" />
          </svg>
          <strong>{onTrackWeight}%</strong>
        </div>
        <span className="rhythm-history-view__health-weight-name">On Track</span>
        {onTrackContribution !== undefined ? (
          <span
            className="rhythm-history-view__health-weight-formula"
            aria-label={`${onTrackWeight}% times ${accessibleScore(onTrackScore)} ${onTrackFormula?.operator === '≈' ? 'approximately equals' : 'equals'} ${onTrackContribution === null ? 'unavailable' : `${onTrackFormula?.contribution ?? formattedContribution(onTrackContribution)} points`}`}
          >
            <span>{onTrackWeight}% × {onTrackFormula?.score ?? '—'} {onTrackFormula?.operator ?? '='} </span>
            <strong>{onTrackFormula ? `${onTrackFormula.contribution} points` : '—'}</strong>
          </span>
        ) : onTrackScore !== undefined && (
          <span className="rhythm-history-view__health-weight-score">
            {onTrackScore !== null && Number.isFinite(onTrackScore)
              ? `${formatScore(onTrackScore)}%`
              : '—'}
          </span>
        )}
        {onTrackContribution === undefined && (
          <>
            <span className="rhythm-history-view__health-weight-subtitle">
              {onTrackCaption ?? onTrackDescription ?? 'Up to date'}
            </span>
            {onTrackCaption && onTrackDescription && (
              <span className="rhythm-history-view__health-weight-description">{onTrackDescription}</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
