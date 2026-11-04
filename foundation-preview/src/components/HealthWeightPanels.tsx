import { HEALTH_CONSISTENCY_WEIGHT, HEALTH_ON_TRACK_WEIGHT } from '../domain/rhythm-history.ts';
import { formatScore } from '../domain/score-display.ts';

type HealthWeightPanelsProps = {
  consistencyScore?: number | null;
  onTrackScore?: number | null;
  consistencyCaption?: string;
  onTrackCaption?: string;
  consistencyDescription?: string;
  onTrackDescription?: string;
};

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
        {consistencyScore !== undefined && (
          <span className="rhythm-history-view__health-weight-score">
            {consistencyScore !== null && Number.isFinite(consistencyScore)
              ? `${formatScore(consistencyScore)}%`
              : '—'}
          </span>
        )}
        <span className="rhythm-history-view__health-weight-subtitle">
          {consistencyCaption ?? consistencyDescription ?? 'Your longer-term pattern.'}
        </span>
        {consistencyCaption && consistencyDescription && (
          <span className="rhythm-history-view__health-weight-description">{consistencyDescription}</span>
        )}
      </div>
      <div className="rhythm-history-view__health-weight-panel rhythm-history-view__health-weight-panel--on-track">
        <div className="rhythm-history-view__health-weight-value">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="8" />
            <path d="M12 7v5l3 2" />
          </svg>
          <strong>{onTrackWeight}%</strong>
        </div>
        <span className="rhythm-history-view__health-weight-name">On Track</span>
        {onTrackScore !== undefined && (
          <span className="rhythm-history-view__health-weight-score">
            {onTrackScore !== null && Number.isFinite(onTrackScore)
              ? `${formatScore(onTrackScore)}%`
              : '—'}
          </span>
        )}
        <span className="rhythm-history-view__health-weight-subtitle">
          {onTrackCaption ?? onTrackDescription ?? 'Up to date'}
        </span>
        {onTrackCaption && onTrackDescription && (
          <span className="rhythm-history-view__health-weight-description">{onTrackDescription}</span>
        )}
      </div>
    </div>
  );
}
