import { useId } from 'react';
import { HEALTH_CONSISTENCY_WEIGHT, HEALTH_ON_TRACK_WEIGHT } from '../domain/rhythm-history.ts';
import { HealthWeightPanels } from './HealthWeightPanels.tsx';

export function HealthScoreExplanation({
  title = 'How your Health score is calculated',
  subject = 'Rhythm',
  explanation,
  consistencyDescription,
  onTrackDescription,
  showPanels = true
}: {
  title?: string;
  subject?: string;
  explanation?: string;
  consistencyDescription?: string;
  onTrackDescription?: string;
  showPanels?: boolean;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const consistencyWeight = HEALTH_CONSISTENCY_WEIGHT * 100;
  const onTrackWeight = HEALTH_ON_TRACK_WEIGHT * 100;

  return (
    <section
      className="rhythm-history-view__health-calculation"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div className="rhythm-history-view__health-calculation-heading">
        <h4 id={titleId}>{title}</h4>
      </div>
      <p id={descriptionId} className="visually-hidden">
        Health is weighted {consistencyWeight} percent Consistency and {onTrackWeight} percent On Track.
        These are fixed formula weights, not this {subject}&apos;s current scores.
      </p>
      {showPanels && (
        <HealthWeightPanels
          {...(consistencyDescription === undefined ? {} : { consistencyDescription })}
          {...(onTrackDescription === undefined ? {} : { onTrackDescription })}
        />
      )}
      {explanation && (
        <p className="rhythm-history-view__health-unavailable">{explanation}</p>
      )}
    </section>
  );
}
