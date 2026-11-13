export type HealthEquationOperator = '=' | '≈';

export function formatHealthValue(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '—' : String(Math.round(value));
}

export function formatScore(score: number | null): string {
  return formatHealthValue(score);
}

export function formatHealthWeightedProduct(
  score: number,
  weight: number
): { score: string; contribution: string; operator: HealthEquationOperator } {
  const exactContribution = score * weight;
  const roundedContribution = Math.round(exactContribution);
  const exact = Number.isInteger(score)
    && Number.isInteger(exactContribution)
    && Number.isInteger(roundedContribution);
  return {
    score: formatHealthValue(score),
    contribution: formatHealthValue(exactContribution),
    operator: exact ? '=' : '≈'
  };
}

export function formatHealthWeightedSum(
  consistency: number,
  onTrack: number,
  total: number
): readonly [string, string, string, HealthEquationOperator] {
  const exact = Number.isInteger(consistency)
    && Number.isInteger(onTrack)
    && Number.isInteger(total)
    && consistency + onTrack === total;
  return [
    formatHealthValue(consistency),
    formatHealthValue(onTrack),
    formatHealthValue(total),
    exact ? '=' : '≈'
  ];
}

export function formatHealthAverageEquation(
  values: readonly number[],
  average: number | null,
  count: number,
  includeAllValues = false
): string {
  if (average === null || !Number.isFinite(average) || count === 0) return '—';

  const exactMean = values.length === count
    && values.every(Number.isInteger)
    && Number.isInteger(average)
    && values.reduce((total, value) => total + value, 0) / count === average;
  const left = values.length === count && (values.length <= 2 || includeAllValues)
    ? `${values.length > 1 ? `(${values.map(formatHealthValue).join(' + ')})` : formatHealthValue(values[0] ?? null)} ÷ ${count}`
    : `Σ ${count} eligible scores ÷ ${count}`;
  return `${left} ${exactMean ? '=' : '≈'} ${formatHealthValue(average)}`;
}

export function formatHealthPercentResult(
  exactPercent: number,
  displayedPercent: number
): { value: string; operator: HealthEquationOperator } {
  const exact = Number.isInteger(exactPercent)
    && Number.isInteger(displayedPercent)
    && exactPercent === displayedPercent;
  return {
    value: formatHealthValue(displayedPercent),
    operator: exact ? '=' : '≈'
  };
}
