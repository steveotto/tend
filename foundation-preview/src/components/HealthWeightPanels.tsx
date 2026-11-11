import { HEALTH_CONSISTENCY_WEIGHT, HEALTH_ON_TRACK_WEIGHT } from '../domain/rhythm-history.ts';
import { formatScore } from '../domain/score-display.ts';

type HealthWeightPanelsProps = {
  consistencyScore?: number | null;
  onTrackScore?: number | null;
  maxFractionDigits?: number;
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
  total: number,
  maxFractionDigits?: number
): readonly [string, string, string, '=' | '≈'] {
  for (let precision = 0; precision <= Math.min(maxFractionDigits ?? 10, 10); precision += 1) {
    const scale = 10 ** precision;
    const consistencyUnits = Math.round(consistency * scale);
    const onTrackUnits = Math.round(onTrack * scale);
    const totalUnits = Math.round(total * scale);
    if (
      isCloseToPrecision(consistency, consistencyUnits / scale)
      && isCloseToPrecision(onTrack, onTrackUnits / scale)
      && isCloseToPrecision(total, totalUnits / scale)
      && consistencyUnits + onTrackUnits === totalUnits
    ) {
      return [
        formatAtPrecision(consistencyUnits / scale, precision),
        formatAtPrecision(onTrackUnits / scale, precision),
        formatAtPrecision(totalUnits / scale, precision),
        '='
      ];
    }
  }
  if (maxFractionDigits === undefined) {
    return [String(consistency), String(onTrack), String(total), '='];
  }
  const precision = Math.max(0, Math.min(maxFractionDigits, 10));
  const displayedConsistency = formatAtPrecision(consistency, precision);
  const displayedOnTrack = formatAtPrecision(onTrack, precision);
  const displayedTotal = formatAtPrecision(total, precision);
  const approximate = !isCloseToPrecision(consistency, Number(displayedConsistency))
    || !isCloseToPrecision(onTrack, Number(displayedOnTrack))
    || !isCloseToPrecision(total, Number(displayedTotal));
  const operator = !approximate
    && Number(displayedConsistency) + Number(displayedOnTrack) === Number(displayedTotal)
    ? '='
    : '≈';
  return [displayedConsistency, displayedOnTrack, displayedTotal, operator];
}

function formatAtPrecision(value: number, precision: number): string {
  if (precision === 0) return String(Math.round(value));
  return value.toFixed(precision).replace(/0+$/, '').replace(/\.$/, '');
}

function isCloseToPrecision(value: number, rounded: number): boolean {
  return Math.abs(value - rounded) <= 1e-10;
}

function weightedProductFormula(
  score: number,
  contribution: number,
  weight: number,
  maxFractionDigits?: number
): { score: string; contribution: string; operator: '=' | '≈' } {
  for (let precision = 0; precision <= Math.min(maxFractionDigits ?? 10, 10); precision += 1) {
    const scale = 10 ** precision;
    const scoreUnits = Math.round(score * scale);
    const contributionUnits = Math.round(contribution * scale);
    const displayedScore = scoreUnits / scale;
    const displayedContribution = contributionUnits / scale;
    if (
      isCloseToPrecision(score, displayedScore)
      && isCloseToPrecision(contribution, displayedContribution)
      && Math.abs(displayedScore * weight - displayedContribution) <= 1e-10
    ) {
      return {
        score: formatAtPrecision(displayedScore, precision),
        contribution: formatAtPrecision(displayedContribution, precision),
        operator: '='
      };
    }
  }
  if (maxFractionDigits === undefined) {
    return { score: String(score), contribution: String(contribution), operator: '=' };
  }
  const precision = Math.max(0, Math.min(maxFractionDigits, 10));
  const displayedScore = formatAtPrecision(score, precision);
  const displayedContribution = formatAtPrecision(contribution, precision);
  const approximate = !isCloseToPrecision(score, Number(displayedScore))
    || !isCloseToPrecision(contribution, Number(displayedContribution));
  const operator = !approximate
    && Number(displayedScore) * weight === Number(displayedContribution)
    ? '='
    : '≈';
  return { score: displayedScore, contribution: displayedContribution, operator };
}

export function HealthWeightPanels({
  consistencyScore,
  onTrackScore,
  maxFractionDigits = 0,
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
    ? weightedProductFormula(
        consistencyScore,
        consistencyContribution!,
        HEALTH_CONSISTENCY_WEIGHT,
        maxFractionDigits
      )
    : null;
  const onTrackFormula = onTrackScore !== undefined
    && onTrackScore !== null
    && onTrackContribution !== null
    ? weightedProductFormula(
        onTrackScore,
        onTrackContribution!,
        HEALTH_ON_TRACK_WEIGHT,
        maxFractionDigits
      )
    : null;
  const accessibleScore = (score: number | null | undefined) =>
    score !== null && score !== undefined && Number.isFinite(score)
      ? maxFractionDigits === undefined ? String(score) : formatAtPrecision(score, maxFractionDigits)
      : 'unavailable';
  const formattedContribution = (value: number) =>
    maxFractionDigits === undefined ? String(value) : formatAtPrecision(value, maxFractionDigits);

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
            aria-label={`${consistencyWeight}% times ${accessibleScore(consistencyScore)} ${consistencyFormula?.operator === '≈' ? 'approximately equals' : 'equals'} ${consistencyContribution === null ? 'unavailable' : `${formattedContribution(consistencyContribution)} points`}`}
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
            aria-label={`${onTrackWeight}% times ${accessibleScore(onTrackScore)} ${onTrackFormula?.operator === '≈' ? 'approximately equals' : 'equals'} ${onTrackContribution === null ? 'unavailable' : `${formattedContribution(onTrackContribution)} points`}`}
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
