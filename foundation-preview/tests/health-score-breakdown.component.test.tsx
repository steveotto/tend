import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HealthScoreBreakdown } from '../src/components/HealthScoreBreakdown.tsx';

afterEach(cleanup);

describe('shared Health score breakdown', () => {
  it('shows the combined score and paired gauges, preserving numeric zero', () => {
    const { container } = render(
      <HealthScoreBreakdown
        score={0}
        consistency={{ score: 0 }}
        onTrack={{ score: 0 }}
        consistencyCaption="How often you show up."
        onTrackCaption="How caught up you are."
        ariaLabel="Strength Health scores"
      />
    );

    expect(screen.getByRole('heading', { name: 'Health' })).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'Health score' }).getAttribute('aria-valuenow')).toBe('0');
    expect(screen.getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuenow')).toBe('0');
    expect(screen.getByRole('meter', { name: 'On Track score' }).getAttribute('aria-valuenow')).toBe('0');
    expect(screen.getAllByText('0')).toHaveLength(3);
    expect(screen.getByText('How often you show up.')).toBeTruthy();
    expect(screen.getByText('How caught up you are.')).toBeTruthy();
    expect(container.querySelector('.health-score-measures__grid')?.children).toHaveLength(2);
  });

  it('keeps unavailable values neutral and preserves an available component when the other is missing', () => {
    render(
      <HealthScoreBreakdown
        score={null}
        healthLabel="Cardio Health"
        consistency={{ score: 67 }}
        onTrack={{ score: null }}
        consistencyCaption="Four completed weeks."
        onTrackCaption="This week’s goal progress."
      />
    );

    expect(screen.getByRole('img', { name: 'Cardio Health: Not enough data' }).classList.contains('neutral')).toBe(true);
    expect(screen.getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuenow')).toBe('67');
    const unavailableOnTrack = screen.getByRole('img', { name: 'On Track: Score unavailable' });
    expect(unavailableOnTrack.classList.contains('neutral')).toBe(true);
    expect(within(unavailableOnTrack).getByText('—')).toBeTruthy();
    expect(screen.getByText('Four completed weeks.')).toBeTruthy();
    expect(screen.getByText('This week’s goal progress.')).toBeTruthy();
  });
});
