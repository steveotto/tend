import { describe, expect, it } from 'vitest';
import {
  formatHealthAverageEquation,
  formatHealthPercentResult,
  formatHealthValue,
  formatHealthWeightedProduct,
  formatHealthWeightedSum,
  formatScore
} from '../src/domain/score-display.ts';

describe('shared Health display formatting', () => {
  it.each([
    [0, '0'],
    [49, '49'],
    [50, '50'],
    [79, '79'],
    [80, '80'],
    [100, '100'],
    [36.25, '36'],
    [36.5, '37']
  ])('formats %s as a whole score', (score, expected) => {
    expect(formatScore(score)).toBe(expected);
  });

  it('keeps unavailable and non-finite scores distinct from zero', () => {
    expect(formatScore(null)).toBe('—');
    expect(formatScore(Number.NaN)).toBe('—');
    expect(formatScore(Number.POSITIVE_INFINITY)).toBe('—');
  });

  it('rounds to the nearest whole number while preserving zero and unavailable values', () => {
    expect(formatHealthValue(0)).toBe('0');
    expect(formatHealthValue(0.49)).toBe('0');
    expect(formatHealthValue(0.5)).toBe('1');
    expect(formatHealthValue(14.5)).toBe('15');
    expect(formatHealthValue(null)).toBe('—');
    expect(formatHealthValue(Number.NaN)).toBe('—');
  });

  it('marks rounded weighted calculations approximate and exact integer equations equal', () => {
    expect(formatHealthWeightedProduct(14, 0.75))
      .toEqual({ score: '14', contribution: '11', operator: '≈' });
    expect(formatHealthWeightedProduct(76, 0.75))
      .toEqual({ score: '76', contribution: '57', operator: '=' });
    expect(formatHealthWeightedSum(54.4995, 20.3085, 74.808))
      .toEqual(['54', '20', '75', '≈']);
    expect(formatHealthWeightedSum(57, 12, 69))
      .toEqual(['57', '12', '69', '=']);
  });

  it('uses the authoritative average and marks equations approximate when displayed inputs round', () => {
    expect(formatHealthAverageEquation([60, 80], 70, 2))
      .toBe('(60 + 80) ÷ 2 = 70');
    expect(formatHealthAverageEquation([80.4, 79.6], 80, 2))
      .toBe('(80 + 80) ÷ 2 ≈ 80');
    expect(formatHealthAverageEquation([66.666, 33.333, 100], 66.666333, 3, true))
      .toBe('(67 + 33 + 100) ÷ 3 ≈ 67');
    expect(formatHealthAverageEquation([], null, 0)).toBe('—');
  });

  it('rounds percentage results and marks fractional ratios approximate', () => {
    expect(formatHealthPercentResult(23 / 29 * 100, 23 / 29 * 100))
      .toEqual({ value: '79', operator: '≈' });
    expect(formatHealthPercentResult(75, 75))
      .toEqual({ value: '75', operator: '=' });
    expect(formatHealthPercentResult(0, 0))
      .toEqual({ value: '0', operator: '=' });
  });
});
