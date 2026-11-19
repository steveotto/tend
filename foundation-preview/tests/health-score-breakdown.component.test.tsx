import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
        showMeasureCaptions
        ariaLabel="Strength Health scores"
      />
    );

    expect(screen.getByRole('heading', { name: 'Health' })).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'Health score' }).getAttribute('aria-valuenow')).toBe('0');
    expect(screen.getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuenow')).toBe('0');
    expect(screen.getByRole('meter', { name: 'On Track score' }).getAttribute('aria-valuenow')).toBe('0');
    expect(container.querySelectorAll('.rhythm-score-circle__value')).toHaveLength(2);
    expect([...container.querySelectorAll('.rhythm-score-circle__value')].map(node => node.textContent)).toEqual(['0', '0']);
    expect(screen.getByText('Follow-through over time')).toBeTruthy();
    expect(screen.getByText('How up to date you are')).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuetext')).toBe('0 out of 100');
    expect(container.querySelector('.health-score-measures__grid')?.children).toHaveLength(2);
  });

  it('keeps unavailable values neutral and preserves an available component when the other is missing', () => {
    render(
      <HealthScoreBreakdown
        score={null}
        healthLabel="Cardio Health"
        consistency={{ score: 67 }}
        onTrack={{ score: null }}
      />
    );

    expect(screen.getByRole('img', { name: 'Cardio Health: Not enough data' }).classList.contains('neutral')).toBe(true);
    expect(screen.getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuenow')).toBe('67');
    expect(screen.getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuetext')).toBe('67 out of 100');
    const unavailableOnTrack = screen.getByRole('img', { name: 'On Track: Score unavailable' });
    expect(unavailableOnTrack.classList.contains('neutral')).toBe(true);
    expect(within(unavailableOnTrack).getByText('—')).toBeTruthy();
    expect(unavailableOnTrack.classList.contains('is-unavailable')).toBe(true);
    expect(within(unavailableOnTrack).queryByText('unavailable')).toBeNull();
    expect(screen.getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuetext')).toBe('67 out of 100');
    expect(unavailableOnTrack.querySelector('.rhythm-score-circle__track')).toBeTruthy();
  });

  it('keeps perfect component scores readable in the paired shared gauges', () => {
    const { container } = render(
      <HealthScoreBreakdown
        score={100}
        consistency={{ score: 100 }}
        onTrack={{ score: 100 }}
      />
    );
    const grid = container.querySelector('.health-score-measures__grid');
    expect(grid?.children).toHaveLength(2);
    expect(screen.getByRole('meter', { name: 'Health score' }).getAttribute('aria-valuenow')).toBe('100');
    expect(screen.getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuenow')).toBe('100');
    expect(screen.getByRole('meter', { name: 'On Track score' }).getAttribute('aria-valuenow')).toBe('100');
    expect([...grid!.querySelectorAll('.rhythm-score-circle__value')].map(node => node.textContent)).toEqual(['100', '100']);
  });

  it('supports a compact shared Health card without reserving gauge space', () => {
    const { container } = render(
      <HealthScoreBreakdown
        title="Connection Health"
        score={72}
        healthLabel="Connection Foundation Health"
        consistency={{ score: 60 }}
        onTrack={{ score: 90 }}
        headingAction={<button type="button">Info</button>}
        showMeasures={false}
      />
    );

    expect(screen.getByRole('heading', { name: 'Connection Health' })).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'Connection Foundation Health score' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Info' })).toBeTruthy();
    expect(container.querySelector('.health-score-measures')).toBeNull();
    expect(screen.queryByRole('meter', { name: 'Consistency score' })).toBeNull();
    expect(screen.queryByRole('meter', { name: 'On Track score' })).toBeNull();
  });

  it('opts compact Fitness summaries into independent accessible measure disclosures', async () => {
    const user = userEvent.setup();
    render(
      <>
        <HealthScoreBreakdown
          title="Weight Health"
          score={0}
          healthLabel="Weight Health"
          consistency={{ score: 0 }}
          onTrack={{ score: null }}
          ariaLabel="Weight Health summary"
          measureDisclosure
          showMeasures={false}
        />
        <HealthScoreBreakdown
          title="Flexibility Health"
          score={null}
          healthLabel="Flexibility Health"
          consistency={{ score: 67 }}
          onTrack={{ score: null }}
          ariaLabel="Flexibility Health summary"
          measureDisclosure
          showMeasures={false}
        />
      </>
    );

    const weightToggle = screen.getByRole('button', {
      name: 'Show Weight Health Consistency and On Track breakdown'
    });
    const flexibilityToggle = screen.getByRole('button', {
      name: 'Show Flexibility Health Consistency and On Track breakdown'
    });
    const chevron = weightToggle.querySelector('svg');
    expect(weightToggle.getAttribute('aria-expanded')).toBe('false');
    expect(flexibilityToggle.getAttribute('aria-expanded')).toBe('false');
    expect(chevron?.getAttribute('viewBox')).toBe('0 0 12 12');
    expect(chevron?.getAttribute('aria-hidden')).toBe('true');
    expect(chevron?.querySelector('path')?.getAttribute('d')).toBe('M2.5 4.5 6 8l3.5-3.5');
    expect(weightToggle.children).toHaveLength(1);
    expect(weightToggle.getAttribute('aria-controls')).not.toBe(flexibilityToggle.getAttribute('aria-controls'));
    expect(document.getElementById(weightToggle.getAttribute('aria-controls')!)?.hidden).toBe(true);
    expect(document.getElementById(flexibilityToggle.getAttribute('aria-controls')!)?.hidden).toBe(true);
    expect(screen.queryByRole('meter', { name: 'Consistency score' })).toBeNull();

    weightToggle.focus();
    await user.keyboard('{Enter}');
    expect(weightToggle.getAttribute('aria-expanded')).toBe('true');
    expect(flexibilityToggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('meter', { name: 'Weight Health score' }).getAttribute('aria-valuenow')).toBe('0');
    const weight = screen.getByRole('region', { name: 'Weight Health summary' });
    expect(within(weight).getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuenow')).toBe('0');
    expect(within(weight).getByRole('img', { name: 'On Track: Score unavailable' })).toBeTruthy();
    expect(within(weight).getByText('Follow-through over time')).toBeTruthy();
    expect(within(weight).getByText('How up to date you are')).toBeTruthy();

    await user.click(flexibilityToggle);
    expect(weightToggle.getAttribute('aria-expanded')).toBe('true');
    expect(flexibilityToggle.getAttribute('aria-expanded')).toBe('true');
    const flexibility = screen.getByRole('region', { name: 'Flexibility Health summary' });
    expect(within(flexibility).getByRole('img', { name: 'Flexibility Health: Not enough data' })).toBeTruthy();
    expect(within(flexibility).getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuenow')).toBe('67');
    expect(within(flexibility).getByRole('img', { name: 'On Track: Score unavailable' })).toBeTruthy();
    expect(within(flexibility).getByText('Follow-through over time')).toBeTruthy();
    expect(within(flexibility).getByText('How up to date you are')).toBeTruthy();
  });
});
