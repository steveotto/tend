export type ScoreTone = 'green' | 'yellow' | 'red' | 'neutral';

export function scoreTone(score: number | null): ScoreTone {
  if (score === null) return 'neutral';
  if (score >= 80) return 'green';
  if (score >= 50) return 'yellow';
  return 'red';
}
