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

const fitnessExplanations = [
  { label: 'Strength', explanation: 'Averages active linked Strength Rhythms that have both Consistency and On Track scores.' },
  { label: 'Cardio', explanation: 'Consistency averages eligible completed weeks in the four-week lookback with full tracking and trustworthy targets.' },
  { label: 'Weight', explanation: 'Averages available scores from active linked Weight Rhythms separately for each measure.' },
  { label: 'Flexibility', explanation: 'Consistency averages regions with valid stretch history; On Track is not scored.' }
] as const;

function fitnessEvidence(rows: HealthAggregateEvidence['rows']): HealthAggregateEvidence {
  const consistencyScores = rows
    .map(row => row.consistency)
    .filter((score): score is number => score !== null);
  const onTrackScores = rows
    .map(row => row.onTrack)
    .filter((score): score is number => score !== null);
  const average = (scores: readonly number[]) => scores.length
    ? scores.reduce((total, score) => total + score, 0) / scores.length
    : null;
  return {
    heading: 'Health & Fitness measure scores',
    description: 'Available scores are averaged separately.',
    itemLabel: 'Measure',
    rows,
    consistencyAverage: average(consistencyScores),
    consistencyCount: consistencyScores.length,
    onTrackAverage: average(onTrackScores),
    onTrackCount: onTrackScores.length,
    averageLabels: {
      consistency: 'Average Consistency',
      onTrack: 'Average On Track'
    },
    notes: ['Unavailable scores are excluded.'],
    emptyState: 'No scores available yet.',
    showEmptyStateWhenNoAverages: true,
    weightSummary: null,
    areaExplanations: fitnessExplanations
  };
}

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
    expect(within(evidence).getByText('(60 + 60) ÷ 2 = 60')).toBeTruthy();
    expect(within(evidence).getByText('(100 + 100) ÷ 2 = 100')).toBeTruthy();
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

  it('rounds fractional Health values and marks rounded weighted and average equations approximate', async () => {
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
      .toBe('54 + 20 ≈ 75');
    expect(screen.getByLabelText('75% times 73 approximately equals 54 points')).toBeTruthy();
    expect(screen.getByLabelText('25% times 81 approximately equals 20 points')).toBeTruthy();
    expect(screen.getByText('(67 + 33) ÷ 2 ≈ 50')).toBeTruthy();
    expect(screen.getByText('(100 + 100) ÷ 2 = 100')).toBeTruthy();
  });

  it('shows the concise all-unavailable Health & Fitness state without a combined count', async () => {
    const user = userEvent.setup();
    const rows = [
      { id: 'strength', label: 'Strength', consistency: null, onTrack: null },
      { id: 'cardio', label: 'Cardio', consistency: null, onTrack: null },
      { id: 'weight', label: 'Weight', consistency: null, onTrack: null },
      { id: 'flexibility', label: 'Flexibility', consistency: null, onTrack: null }
    ] as const;
    const { container } = render(
      <HealthScoringDetailsCard
        title="How this Category was scored"
        healthScore={null}
        consistencyScore={null}
        onTrackScore={null}
        evidence={fitnessEvidence(rows)}
      />
    );

    await user.click(screen.getByRole('button', { name: 'How this Category was scored' }));
    const evidence = screen.getByRole('region', { name: 'Health & Fitness measure scores' });
    expect(within(evidence).getByText('Available scores are averaged separately.')).toBeTruthy();
    expect(within(evidence).getAllByRole('columnheader').map(header => header.textContent))
      .toEqual(['Measure', 'Consistency', 'On Track']);
    expect(within(evidence).getAllByRole('row')).toHaveLength(5);
    for (const label of ['Strength', 'Cardio', 'Weight', 'Flexibility']) {
      expect(within(evidence).getByRole('row', { name: `${label} — —` })).toBeTruthy();
    }
    expect(within(evidence).getByRole('status').textContent).toBe('No scores available yet.');
    const averages = evidence.querySelectorAll('.health-aggregate-evidence__averages p');
    expect(averages[0]?.textContent).toBe('Average Consistency—');
    expect(averages[1]?.textContent).toBe('Average On Track—');
    expect(within(evidence).getByText('Unavailable scores are excluded.')).toBeTruthy();
    expect(within(evidence).queryByText(/of 4/)).toBeNull();
    expect(container.querySelector('h4')?.textContent).toBe('How Health is calculated');
    expect(container.querySelector('.rhythm-health-scoring-card__formula--total')?.textContent)
      .toContain('One or both component scores are unavailable.');
    expect(within(container).queryByText('Consistency counts three times as much as On Track.')).toBeNull();
    expect(within(evidence).queryByText(/averages tracked stretch-region scores/i)).toBeNull();

    const areaDisclosure = within(evidence).getByRole('button', { name: 'How each area is scored' });
    expect(within(evidence).getByRole('heading', {
      level: 5,
      name: 'How each area is scored'
    })).toBeTruthy();
    expect(areaDisclosure.getAttribute('aria-expanded')).toBe('false');
    const areaContent = document.getElementById(areaDisclosure.getAttribute('aria-controls')!);
    expect(areaContent?.hasAttribute('hidden')).toBe(true);
    areaDisclosure.focus();
    await user.keyboard('{Enter}');
    expect(areaDisclosure.getAttribute('aria-expanded')).toBe('true');
    expect(areaContent?.hasAttribute('hidden')).toBe(false);
    for (const { label } of fitnessExplanations) {
      expect(within(areaContent!).getByText(`${label}:`)).toBeTruthy();
    }
  });

  it('keeps partially available measures independent and preserves zero as a valid score', async () => {
    const user = userEvent.setup();
    const rows = [
      { id: 'strength', label: 'Strength', consistency: 0, onTrack: null },
      { id: 'cardio', label: 'Cardio', consistency: null, onTrack: 80 },
      { id: 'weight', label: 'Weight', consistency: null, onTrack: null },
      { id: 'flexibility', label: 'Flexibility', consistency: null, onTrack: null }
    ] as const;
    render(
      <HealthScoringDetailsCard
        title="How this Category was scored"
        healthScore={null}
        consistencyScore={0}
        onTrackScore={80}
        evidence={fitnessEvidence(rows)}
      />
    );

    await user.click(screen.getByRole('button', { name: 'How this Category was scored' }));
    const evidence = screen.getByRole('region', { name: 'Health & Fitness measure scores' });
    expect(within(evidence).getByRole('row', { name: 'Strength 0 —' })).toBeTruthy();
    expect(within(evidence).getByRole('row', { name: 'Cardio — 80' })).toBeTruthy();
    const averages = evidence.querySelectorAll('.health-aggregate-evidence__averages p');
    expect(averages[0]?.textContent).toContain('Average Consistency0');
    expect(averages[0]?.textContent).toContain('= 0');
    expect(averages[1]?.textContent).toContain('Average On Track80');
    expect(within(evidence).queryByText('No scores available yet.')).toBeNull();
    expect(within(evidence).queryByText(/of 4/)).toBeNull();
  });

  it('shows all fully scored rows and averages with existing score formatting', async () => {
    const user = userEvent.setup();
    const rows = [
      { id: 'strength', label: 'Strength', consistency: 81.6, onTrack: 76 },
      { id: 'cardio', label: 'Cardio', consistency: 70, onTrack: 88 },
      { id: 'weight', label: 'Weight', consistency: 92, onTrack: 64 },
      { id: 'flexibility', label: 'Flexibility', consistency: 60, onTrack: null }
    ] as const;
    render(
      <HealthScoringDetailsCard
        title="How this Category was scored"
        healthScore={null}
        consistencyScore={75.9}
        onTrackScore={76}
        evidence={fitnessEvidence(rows)}
      />
    );

    await user.click(screen.getByRole('button', { name: 'How this Category was scored' }));
    const evidence = screen.getByRole('region', { name: 'Health & Fitness measure scores' });
    expect(within(evidence).getAllByRole('row')).toHaveLength(5);
    expect(within(evidence).getByRole('row', { name: 'Strength 82 76' })).toBeTruthy();
    expect(within(evidence).getByRole('row', { name: 'Cardio 70 88' })).toBeTruthy();
    expect(within(evidence).getByRole('row', { name: 'Weight 92 64' })).toBeTruthy();
    expect(within(evidence).getByRole('row', { name: 'Flexibility 60 —' })).toBeTruthy();
    const averages = evidence.querySelectorAll('.health-aggregate-evidence__averages p');
    expect(averages[0]?.textContent).toContain('≈ 76');
    expect(averages[1]?.textContent).toContain('= 76');
    expect(within(evidence).queryByText('No scores available yet.')).toBeNull();
    expect(within(evidence).getByText('Unavailable scores are excluded.')).toBeTruthy();
  });
});
