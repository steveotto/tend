import { describe, expect, it } from 'vitest';
import { formatScore } from '../src/domain/score-display.ts';

describe('formatScore', () => {
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
});
