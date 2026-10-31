import { useId } from 'react';
import type { ReactNode } from 'react';
import { scoreTone } from '../domain/score-tone.ts';
import { RhythmScoreCircle } from './RhythmScoreCircle.tsx';

export type HealthScoreMetric = {
  score: number | null;
  state?: 'scored' | 'unscored' | 'unavailable';
  explanation?: string;
};

type HealthScoreMeasuresProps = {
  healthScore: number | null;
  consistency: HealthScoreMetric;
  onTrack: HealthScoreMetric;
  consistencyCaption: string;
  onTrackCaption: string;
  healthLabel?: string;
  showHealthMeter?: boolean;
  className?: string;
};

type HealthScoreBreakdownProps = Omit<HealthScoreMeasuresProps, 'healthScore'> & {
  title?: string;
  score: number | null;
  healthLabel?: string;
  ariaLabel?: string;
  headingAction?: ReactNode;
  showMeasures?: boolean;
};

export function HealthScoreBreakdown({
  title = 'Health',
  score,
  consistency,
  onTrack,
  consistencyCaption,
  onTrackCaption,
  healthLabel = 'Health',
  ariaLabel = 'Health score breakdown',
  headingAction,
  showMeasures = true,
  className = ''
}: HealthScoreBreakdownProps) {
  const displayScore = score !== null && Number.isFinite(score) ? Math.round(score) : null;

  return (
    <section className={`health-score-breakdown ${className}`.trim()} aria-label={ariaLabel}>
      <header className="health-score-breakdown__header">
        <h3>{title}</h3>
        <span className={displayScore === null ? 'is-unavailable' : undefined}>
          {displayScore ?? '—'}
        </span>
        {headingAction}
      </header>
      <HealthScoreMeter score={score} label={healthLabel} />
      {showMeasures && (
        <HealthScoreMeasures
          consistency={consistency}
          onTrack={onTrack}
          healthScore={score}
          consistencyCaption={consistencyCaption}
          onTrackCaption={onTrackCaption}
          healthLabel={healthLabel}
          showHealthMeter={false}
        />
      )}
    </section>
  );
}

export function HealthScoreMeasures({
  healthScore,
  consistency,
  onTrack,
  consistencyCaption,
  onTrackCaption,
  healthLabel = 'Health',
  showHealthMeter = true,
  className = ''
}: HealthScoreMeasuresProps) {
  return (
    <div className={`health-score-measures ${className}`.trim()}>
      {showHealthMeter && <HealthScoreMeter score={healthScore} label={healthLabel} />}
      <div className="health-score-measures__grid" role="group" aria-label="Consistency and On Track">
        <HealthScoreMeasure
          label="Consistency"
          metric={consistency}
          caption={consistencyCaption}
        />
        <HealthScoreMeasure
          label="On Track"
          metric={onTrack}
          caption={onTrackCaption}
        />
      </div>
    </div>
  );
}

export function HealthScoreMeter({
  score,
  label = 'Health',
  illustrative = false
}: {
  score: number | null;
  label?: string;
  illustrative?: boolean;
}) {
  const available = score !== null && Number.isFinite(score);
  return (
    <div
      className={`health-score-meter ${scoreTone(available ? score : null)}`}
      role={available ? 'meter' : 'img'}
      aria-label={available ? `${label} score` : `${label}: Not enough data`}
      aria-valuemin={available ? 0 : undefined}
      aria-valuemax={available ? 100 : undefined}
      aria-valuenow={available ? score : undefined}
      aria-valuetext={available ? `${Math.round(score)} out of 100${illustrative ? ', illustrative blend' : ''}` : undefined}
    >
      <span
        className="health-score-meter__fill"
        aria-hidden="true"
        style={{ width: `${available ? Math.max(0, Math.min(100, score)) : 0}%` }}
      />
    </div>
  );
}

function HealthScoreMeasure({
  label,
  metric,
  caption
}: {
  label: string;
  metric: HealthScoreMetric;
  caption: string;
}) {
  const headingId = useId();
  const state = metric.state ?? (metric.score === null ? 'unavailable' : 'scored');

  return (
    <section className="health-score-measures__item" aria-labelledby={headingId}>
      <h4 id={headingId}>{label}</h4>
      <RhythmScoreCircle
        label={label}
        score={state === 'scored' ? metric.score : null}
        state={state}
        {...(metric.explanation ? { explanation: metric.explanation } : {})}
      />
      <p>{caption}</p>
    </section>
  );
}
