import { scoreTone } from '../domain/score-tone.ts';
import { formatScore } from '../domain/score-display.ts';

export function RhythmScoreCircle({
  label,
  score,
  state,
  explanation
}: {
  label: string;
  score: number | null;
  state: 'scored' | 'unscored' | 'unavailable';
  explanation?: string;
}) {
  const available = state === 'scored' && score !== null;
  const displayScore = available ? formatScore(score) : null;
  const valueText = available
    ? `${displayScore}%`
    : state === 'unscored'
      ? `Unscored because ${explanation ?? 'there are no eligible due occurrences'}`
      : 'Score unavailable';
  const circumference = 2 * Math.PI * 43;
  const boundedPercent = available ? Math.max(0, Math.min(100, score)) : 0;

  return (
    <span
      className={`rhythm-score-circle ${scoreTone(available ? score : null)} is-${state}`}
      role={available ? 'meter' : 'img'}
      aria-label={available ? `${label} score` : `${label}: ${valueText}`}
      {...(available
        ? {
            'aria-valuemin': 0,
            'aria-valuemax': 100,
            'aria-valuenow': Math.round(score),
            'aria-valuetext': valueText
          }
        : {})}
    >
        <svg className="rhythm-score-circle__ring" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          <circle className="rhythm-score-circle__track" cx="50" cy="50" r="43" />
          {available && boundedPercent > 0 && (
            <circle
              className="rhythm-score-circle__progress"
              cx="50"
              cy="50"
              r="43"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - boundedPercent / 100)}
            />
          )}
        </svg>
        <span className="rhythm-score-circle__value" aria-hidden="true">
          {displayScore === null ? '—' : `${displayScore}%`}
        </span>
    </span>
  );
}
