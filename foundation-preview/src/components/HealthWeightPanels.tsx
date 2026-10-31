import { HEALTH_CONSISTENCY_WEIGHT, HEALTH_ON_TRACK_WEIGHT } from '../domain/rhythm-history.ts';

type HealthWeightPanelsProps = {
  consistencyDescription?: string;
  onTrackDescription?: string;
};

export function HealthWeightPanels({
  consistencyDescription = 'Your longer-term pattern.',
  onTrackDescription = 'Up to date'
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
        {consistencyDescription && (
          <span className="rhythm-history-view__health-weight-subtitle">{consistencyDescription}</span>
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
        {onTrackDescription && (
          <span className="rhythm-history-view__health-weight-subtitle">{onTrackDescription}</span>
        )}
      </div>
    </div>
  );
}
