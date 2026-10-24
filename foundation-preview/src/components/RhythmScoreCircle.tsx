import type { CSSProperties } from 'react';
import { scoreTone } from '../domain/score-tone.ts';

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
  const boundedScore = available ? Math.min(100, Math.max(0, score)) : 0;
  const displayScore = available ? Math.round(score) : null;
  const valueText = available
    ? `${displayScore} out of 100`
    : state === 'unscored'
      ? `Unscored because ${explanation ?? 'there are no eligible due occurrences'}`
      : 'Score unavailable';
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
      style={{ '--rhythm-score': `${boundedScore}%` } as CSSProperties}
    >
      <span className="rhythm-score-circle__value" aria-hidden="true">{displayScore ?? '—'}</span>
      <span className="rhythm-score-circle__out-of" aria-hidden="true">
        {state === 'scored' ? 'out of 100' : state}
      </span>
    </span>
  );
}
