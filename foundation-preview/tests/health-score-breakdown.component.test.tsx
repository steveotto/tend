import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HealthScoreBreakdown } from '../src/components/HealthScoreBreakdown.tsx';
import { HealthScoreSummary } from '../src/components/HealthScoreSummary.tsx';

afterEach(cleanup);

describe('shared Health score breakdown', () => {
  it('uses the same bounded score typography for card and detail variants', () => {
    const { container } = render(
      <>
        <HealthScoreSummary
          title="Connections Health"
          score={36}
          consistency={14}
          onTrack={100}
          coverage="1 of 1 connections scored."
          expanded={false}
          onExpandedChange={() => undefined}
        >
          <span>Summary fixture</span>
        </HealthScoreSummary>
        <HealthScoreBreakdown
          title="Connections Health"
          score={36}
          consistency={{ score: 14 }}
          onTrack={{ score: 100 }}
          consistencyCaption="Follow-through over time."
          onTrackCaption="How caught up you are."
          size="detail"
        />
      </>
    );
    const card = container.querySelector('.health-score-summary--card') as HTMLElement;
    const detail = container.querySelector('.health-score-breakdown--detail') as HTMLElement;
    const constrainedSize = 'clamp(20px, calc(1.5rem * var(--app-text-scale, 1)), 28px)';

    expect(card.style.getPropertyValue('--health-score-value-size')).toBe(constrainedSize);
    expect(detail.style.getPropertyValue('--health-score-value-size')).toBe(constrainedSize);
    expect(card.querySelector('.category-health-score')?.textContent).toBe('36');
    expect(detail.querySelector('.health-score-breakdown__header > span')?.textContent).toBe('36');
    expect(card.querySelectorAll('.rhythm-score-circle--card .rhythm-score-circle__value'))
      .toHaveLength(2);
    expect(detail.querySelectorAll('.rhythm-score-circle--detail .rhythm-score-circle__value'))
      .toHaveLength(2);
    expect([...card.querySelectorAll('.rhythm-score-circle__value')].map(node => node.textContent))
      .toEqual([...detail.querySelectorAll('.rhythm-score-circle__value')].map(node => node.textContent));
  });

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
    expect(container.querySelectorAll('.rhythm-score-circle__value')).toHaveLength(2);
    expect([...container.querySelectorAll('.rhythm-score-circle__value')].map(node => node.textContent)).toEqual(['0', '0']);
    expect(screen.queryByText('How often you show up.')).toBeNull();
    expect(screen.queryByText('How caught up you are.')).toBeNull();
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
        consistencyCaption="Four completed weeks."
        onTrackCaption="This week’s goal progress."
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
    expect(screen.queryByText('Four completed weeks.')).toBeNull();
    expect(screen.queryByText('This week’s goal progress.')).toBeNull();
    expect(screen.getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuetext')).toBe('67 out of 100');
    expect(unavailableOnTrack.querySelector('.rhythm-score-circle__track')).toBeTruthy();
  });

  it('keeps perfect component scores readable in the paired shared gauges', () => {
    const { container } = render(
      <HealthScoreBreakdown
        score={100}
        consistency={{ score: 100 }}
        onTrack={{ score: 100 }}
        consistencyCaption="Every eligible opportunity was completed."
        onTrackCaption="The current week is complete."
      />
    );
    const grid = container.querySelector('.health-score-measures__grid');
    expect(grid?.children).toHaveLength(2);
    expect(screen.getByRole('meter', { name: 'Health score' }).getAttribute('aria-valuenow')).toBe('100');
    expect(screen.getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuenow')).toBe('100');
    expect(screen.getByRole('meter', { name: 'On Track score' }).getAttribute('aria-valuenow')).toBe('100');
    expect([...grid!.querySelectorAll('.rhythm-score-circle__value')].map(node => node.textContent)).toEqual(['100', '100']);
    expect(screen.queryByText('Every eligible opportunity was completed.')).toBeNull();
    expect(screen.queryByText('The current week is complete.')).toBeNull();
  });
});
