import type { CSSProperties } from 'react';
import { scoreTone } from '../domain/score-tone.ts';

export function RhythmScoreCircle({
  label,
  score,
  state
}: {
  label: string;
  score: number | null;
  state: 'scored' | 'unscored' | 'unavailable';
}) {
  const available = state === 'scored' && score !== null;
  const boundedScore = available ? Math.min(100, Math.max(0, score)) : 0;
  const valueText = available
    ? `${score} out of 100, illustrative example`
    : state === 'unscored'
      ? 'Unscored because there are no eligible due occurrences'
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
            'aria-valuenow': score,
            'aria-valuetext': valueText
          }
        : {})}
      style={{ '--rhythm-score': `${boundedScore}%` } as CSSProperties}
    >
      <span className="rhythm-score-circle__value" aria-hidden="true">{available ? score : '—'}</span>
      <span className="rhythm-score-circle__out-of" aria-hidden="true">
        {state === 'scored' ? 'out of 100' : state}
      </span>
    </span>
  );
}
