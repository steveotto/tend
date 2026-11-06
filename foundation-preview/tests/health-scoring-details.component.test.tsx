import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { HealthScoringDetailsCard } from '../src/components/HealthScoringDetailsCard.tsx';
import type { HealthAggregateEvidence } from '../src/components/HealthScoringDetailsCard.tsx';

const categoryEvidence: HealthAggregateEvidence = {
  heading: 'Foundation scores',
  description: 'Each eligible Foundation counts equally.',
  itemLabel: 'Foundation',
  rows: [
    { id: 'connection', label: 'Connection', consistency: 60, onTrack: 100 },
    { id: 'adventure', label: 'Fun & Adventure', consistency: 60, onTrack: 100 }
  ],
  otherCount: 4,
  consistencyAverage: 60,
  consistencyCount: 2,
  onTrackAverage: 100,
  onTrackCount: 2,
  coverage: '2 of 6 Foundations scored.',
  notes: ['Unscored Foundations are excluded from this average.']
};

describe('shared Health scoring details card', () => {
  afterEach(cleanup);

  it('starts collapsed, then presents weighted outputs and selector-backed aggregate evidence', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <HealthScoringDetailsCard
        title="How this Category was scored"
        healthScore={70}
        consistencyScore={60}
        onTrackScore={100}
        evidence={categoryEvidence}
      />
    );

    const toggle = screen.getByRole('button', { name: 'How this Category was scored' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    const content = document.getElementById(toggle.getAttribute('aria-controls')!);
    expect(content?.hasAttribute('hidden')).toBe(true);

    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(content?.hasAttribute('hidden')).toBe(false);
    expect(screen.getByRole('heading', { name: 'How Health is calculated' })).toBeTruthy();
    expect(screen.getByText('Consistency counts three times as much as On Track.')).toBeTruthy();
    expect(document.querySelector('.rhythm-health-scoring-card__formula--total')?.textContent)
      .toBe('45 + 25 = 70');
    const evidence = screen.getByRole('region', { name: 'Foundation scores' });
    expect(within(evidence).getByRole('row', { name: /Connection 60 100/ })).toBeTruthy();
    expect(within(evidence).getByRole('row', { name: /Fun & Adventure 60 100/ })).toBeTruthy();
    expect(within(evidence).getByRole('row', { name: /Other 4 Foundations — —/ })).toBeTruthy();
    expect(within(evidence).getByText('60 + 60 ÷ 2 = 60')).toBeTruthy();
    expect(within(evidence).getByText('100 + 100 ÷ 2 = 100')).toBeTruthy();
    expect(within(evidence).getByText('2 of 6 Foundations scored.')).toBeTruthy();
    expect(within(evidence).getByText('Unscored Foundations are excluded from this average.')).toBeTruthy();

    rerender(
      <HealthScoringDetailsCard
        title="How this Category was scored"
        healthScore={70}
        consistencyScore={60}
        onTrackScore={100}
        evidence={categoryEvidence}
      />
    );
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('preserves valid zero and unavailable inputs and has a clear no-input state', async () => {
    const user = userEvent.setup();
    const mixedEvidence: HealthAggregateEvidence = {
      heading: 'Practice scores',
      description: 'Each eligible Practice counts equally.',
      itemLabel: 'Practice',
      rows: [{ id: 'prayer', label: 'Prayer', consistency: 0, onTrack: null }],
      consistencyAverage: 0,
      consistencyCount: 1,
      onTrackAverage: null,
      onTrackCount: 0,
      coverage: '1 of 1 linked Practices has a Consistency score.',
      emptyState: 'No eligible linked Rhythms have both scores available.'
    };
    const { rerender } = render(
      <HealthScoringDetailsCard
        title="How this Practice was scored"
        healthScore={null}
        consistencyScore={0}
        onTrackScore={null}
        evidence={mixedEvidence}
      />
    );
    await user.click(screen.getByRole('button', { name: 'How this Practice was scored' }));
    const evidence = screen.getByRole('region', { name: 'Practice scores' });
    expect(within(evidence).getByRole('row', { name: /Prayer 0 —/ })).toBeTruthy();
    expect(within(evidence).getByText('0 ÷ 1 = 0')).toBeTruthy();
    expect(within(evidence).getByText('1 of 1 linked Practices has a Consistency score.')).toBeTruthy();
    expect(screen.getByText('One or both component scores are unavailable.')).toBeTruthy();

    rerender(
      <HealthScoringDetailsCard
        title="How this Practice was scored"
        healthScore={null}
        consistencyScore={null}
        onTrackScore={null}
        evidence={{
          ...mixedEvidence,
          heading: 'Linked Rhythm scores',
          rows: [],
          consistencyAverage: null,
          consistencyCount: 0,
          onTrackAverage: null,
          onTrackCount: 0,
          coverage: '0 of 0 linked Rhythms scored.',
          emptyState: 'No eligible linked Rhythms have both scores available.'
        }}
      />
    );
    expect(screen.getByRole('button', { name: 'How this Practice was scored' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('No eligible linked Rhythms have both scores available.')).toBeTruthy();
    expect(screen.getByText('0 of 0 linked Rhythms scored.')).toBeTruthy();
  });

  it('shows full-precision component products and aggregate averages', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <HealthScoringDetailsCard
        title="How this Category was scored"
        healthScore={74.808}
        consistencyScore={72.666}
        onTrackScore={81.234}
        evidence={{
          heading: 'Foundation scores',
          description: 'Each eligible Foundation counts equally.',
          itemLabel: 'Foundation',
          rows: [
            { id: 'one', label: 'One', consistency: 66.666, onTrack: 100 },
            { id: 'two', label: 'Two', consistency: 33.333, onTrack: 100 }
          ],
          consistencyAverage: 49.9995,
          consistencyCount: 2,
          onTrackAverage: 100,
          onTrackCount: 2,
          coverage: '2 of 2 Foundations scored.'
        }}
      />
    );
    await user.click(screen.getByRole('button', { name: 'How this Category was scored' }));
    expect(container.querySelector('.rhythm-health-scoring-card__formula--total')?.textContent)
      .toBe('54.4995 + 20.3085 = 74.808');
    expect(screen.getByLabelText('75% times 72.666 equals 54.4995 points')).toBeTruthy();
    expect(screen.getByLabelText('25% times 81.234 equals 20.3085 points')).toBeTruthy();
    expect(screen.getByText('66.666 + 33.333 ÷ 2 = 49.9995')).toBeTruthy();
    expect(screen.getByText('100 + 100 ÷ 2 = 100')).toBeTruthy();
  });
});
