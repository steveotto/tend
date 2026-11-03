export function formatScore(score: number | null): string {
  return score === null || !Number.isFinite(score) ? '—' : String(Math.round(score));
}
