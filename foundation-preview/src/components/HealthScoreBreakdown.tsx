import { forwardRef, useId, useState } from 'react';
import type { KeyboardEventHandler, ReactNode } from 'react';
import { scoreTone } from '../domain/score-tone.ts';
import { formatScore } from '../domain/score-display.ts';
import { RhythmScoreCircle } from './RhythmScoreCircle.tsx';
import { HEALTH_MEASURE_CAPTIONS } from './health-measure-captions.ts';

export type HealthScoreMetric = {
  score: number | null;
  state?: 'scored' | 'unscored' | 'unavailable';
  explanation?: string;
};

export const HealthScoreInfoButton = forwardRef<HTMLButtonElement, {
  label: string;
  expanded: boolean;
  controls: string;
  onClick: () => void;
}>(({ label, expanded, controls, onClick }, ref) => (
  <button
    ref={ref}
    type="button"
    className="rhythm-history-view__score-info"
    aria-label={label}
    aria-haspopup="dialog"
    aria-expanded={expanded}
    aria-controls={controls}
    onClick={onClick}
  >
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 7.2v4M8 4.8h.01" />
    </svg>
  </button>
));
HealthScoreInfoButton.displayName = 'HealthScoreInfoButton';

export function HealthScoreDisclosureButton({
  label,
  expanded,
  controls,
  onClick
}: {
  label: string;
  expanded: boolean;
  controls: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="health-score-breakdown__measure-toggle"
      aria-label={`${expanded ? 'Hide' : 'Show'} ${label} breakdown`}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onClick}
    >
      <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
        <path d="M2.5 4.5 6 8l3.5-3.5" />
      </svg>
    </button>
  );
}

export function HealthScoreDisclosurePanel({
  id,
  expanded,
  children,
  className = ''
}: {
  id: string;
  expanded: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      id={id}
      className={`health-score-breakdown__disclosure ${className}`.trim()}
      hidden={!expanded}
    >
      {children}
    </div>
  );
}

type HealthScoreMeasuresProps = {
  healthScore: number | null;
  consistency: HealthScoreMetric;
  onTrack: HealthScoreMetric;
  healthLabel?: string;
  showHealthMeter?: boolean;
  showCaptions?: boolean;
  className?: string;
};

type HealthScoreBreakdownProps = Omit<HealthScoreMeasuresProps, 'healthScore'> & {
  title?: string;
  titleAriaLabel?: string;
  titleId?: string;
  score: number | null;
  healthLabel?: string;
  ariaLabel?: string;
  headingAction?: ReactNode;
  showMeasures?: boolean;
  showMeasureCaptions?: boolean;
  measureDisclosure?: boolean;
  measureDisclosureLabel?: string;
  children?: ReactNode;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
};

export function HealthScoreBreakdown({
  title = 'Health',
  titleAriaLabel,
  titleId,
  score,
  consistency,
  onTrack,
  healthLabel = 'Health',
  ariaLabel = 'Health score breakdown',
  headingAction,
  showMeasures = true,
  showMeasureCaptions = false,
  measureDisclosure = false,
  measureDisclosureLabel,
  children,
  onKeyDown,
  className = ''
}: HealthScoreBreakdownProps) {
  const [measuresExpanded, setMeasuresExpanded] = useState(false);
  const measuresId = useId();
  const titleBoundary = title.lastIndexOf(' ');
  const titlePrefix = titleBoundary >= 0 ? title.slice(0, titleBoundary + 1) : '';
  const titleSuffix = title.slice(titleBoundary + 1);
  const disclosureLabel = measureDisclosureLabel ?? titleAriaLabel ?? title;
  const displayScore = score === null || !Number.isFinite(score) ? null : formatScore(score);
  const hasMeasures = showMeasures || measureDisclosure;
  const measures = hasMeasures ? (
    <HealthScoreMeasures
      consistency={consistency}
      onTrack={onTrack}
      healthScore={score}
      showCaptions={measureDisclosure || showMeasureCaptions}
      healthLabel={healthLabel}
      showHealthMeter={false}
    />
  ) : null;

  return (
    <section
      className={`health-score-breakdown ${className}`.trim()}
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
    >
      <header className="health-score-breakdown__header">
        {measureDisclosure && hasMeasures ? (
          <div className="health-score-breakdown__title">
            <h3 id={titleId} aria-label={titleAriaLabel ?? title}>
              {titlePrefix}
              <span className="health-score-breakdown__title-end">
                {titleSuffix}
                <HealthScoreDisclosureButton
                  label={`${disclosureLabel} Consistency and On Track`}
                  expanded={measuresExpanded}
                  controls={measuresId}
                  onClick={() => setMeasuresExpanded(expanded => !expanded)}
                />
              </span>
            </h3>
          </div>
        ) : (
          <h3 id={titleId}>{title}</h3>
        )}
        <span className={displayScore === null ? 'is-unavailable' : undefined}>
          {displayScore ?? '—'}
        </span>
        {headingAction}
      </header>
      <HealthScoreMeter score={score} label={healthLabel} />
      {measureDisclosure
        ? measures && (
          <HealthScoreDisclosurePanel
            id={measuresId}
            className="health-score-breakdown__measures"
            expanded={measuresExpanded}
          >
            {measures}
          </HealthScoreDisclosurePanel>
        )
        : measures}
      {children}
    </section>
  );
}

export function HealthScoreMeasures({
  healthScore,
  consistency,
  onTrack,
  healthLabel = 'Health',
  showHealthMeter = true,
  showCaptions = false,
  className = ''
}: HealthScoreMeasuresProps) {
  return (
    <div className={`health-score-measures ${className}`.trim()}>
      {showHealthMeter && <HealthScoreMeter score={healthScore} label={healthLabel} />}
      <div className="health-score-measures__grid" role="group" aria-label="Consistency and On Track">
        <HealthScoreMeasure
          label="Consistency"
          metric={consistency}
          caption={HEALTH_MEASURE_CAPTIONS.consistency}
          showCaption={showCaptions}
        />
        <HealthScoreMeasure
          label="On Track"
          metric={onTrack}
          caption={HEALTH_MEASURE_CAPTIONS.onTrack}
          showCaption={showCaptions}
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
  const normalizedLabel = /\bscores?\s*$/i.test(label.trim())
    ? label.trim()
    : `${label.trim()} score`;
  return (
    <div
      className={`health-score-meter ${scoreTone(available ? score : null)}`}
      role={available ? 'meter' : 'img'}
      aria-label={available ? normalizedLabel : `${label.trim()}: Not enough data`}
      aria-valuemin={available ? 0 : undefined}
      aria-valuemax={available ? 100 : undefined}
      aria-valuenow={available ? score : undefined}
      aria-valuetext={available ? `${formatScore(score)} out of 100${illustrative ? ', illustrative blend' : ''}` : undefined}
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
  caption,
  showCaption
}: {
  label: string;
  metric: HealthScoreMetric;
  caption: string;
  showCaption: boolean;
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
      {showCaption && <p className="health-score-measures__caption">{caption}</p>}
    </section>
  );
}
