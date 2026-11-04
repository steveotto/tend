import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HealthInfoWhatCounts } from '../src/components/HealthInfoWhatCounts.tsx';
import { HealthScoreDetailsContent } from '../src/components/HealthScoreDetailsContent.tsx';
import { createHealthFitnessRollup } from '../src/components/HealthRollupDiagram.tsx';
import type { HealthRollupConfig } from '../src/components/HealthRollupDiagram.tsx';

const faithFlow: HealthRollupConfig = {
  groups: [
    {
      id: 'rhythms',
      label: 'Rhythms',
      items: [
        {
          id: 'prayer-rhythm',
          label: 'Morning prayer',
          explanation: 'Scheduled completions feed the Rhythm score.',
          relatedItemIds: { foundations: ['prayer'], category: ['faith'] }
        },
        {
          id: 'scripture-rhythm',
          label: 'Scripture reading',
          relatedItemIds: { foundations: ['scripture'], category: ['faith'] }
        }
      ],
      emptyItem: { id: 'no-rhythms', label: 'No Rhythms' }
    },
    {
      id: 'foundations',
      label: 'Practices',
      items: [
        {
          id: 'prayer',
          label: 'Prayer',
          foundationIconId: 'faith-prayer',
          explanation: 'Eligible linked Rhythm scores contribute.',
          relatedItemIds: { rhythms: ['prayer-rhythm'], category: ['faith'] }
        },
        {
          id: 'scripture',
          label: 'Scripture',
          foundationIconId: 'faith-scripture',
          relatedItemIds: { rhythms: ['scripture-rhythm'], category: ['faith'] }
        }
      ]
    },
    {
      id: 'category',
      label: 'Category',
      items: [{
        id: 'faith',
        label: 'Faith',
        categoryIconId: 'faith',
        explanation: 'Eligible Practices contribute to category Health.',
        relatedItemIds: { foundations: ['prayer', 'scripture'] }
      }]
    }
  ],
  initialGroupId: 'category',
  initialItemId: 'faith'
};

afterEach(cleanup);

describe('static Health Info content', () => {
  it('shows the Category flow and all relationships without carousel controls', () => {
    render(<HealthInfoWhatCounts config={faithFlow} />);

    expect(screen.getByRole('heading', { name: 'What counts' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Rhythms' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Practices' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Category' })).toBeTruthy();
    expect(screen.getByText('Faith')).toBeTruthy();
    expect(screen.getByText('Prayer')).toBeTruthy();
    expect(screen.getByText('Scripture')).toBeTruthy();
    expect(screen.getByText('Morning prayer')).toBeTruthy();
    expect(screen.getByText('Scripture reading')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(document.querySelector('.health-rollup__navigation')).toBeNull();
  });

  it('opens a Foundation flow on that item and only its linked Rhythms', () => {
    render(<HealthInfoWhatCounts config={{
      ...faithFlow,
      initialGroupId: 'foundations',
      initialItemId: 'prayer'
    }} />);

    expect(screen.getByText('Prayer')).toBeTruthy();
    expect(screen.getByText('Morning prayer')).toBeTruthy();
    expect(screen.getByText('Faith')).toBeTruthy();
    expect(screen.queryByText('Scripture')).toBeNull();
    expect(screen.queryByText('Scripture reading')).toBeNull();
  });

  it('opens a Rhythm flow with scheduled completions and its linked destinations', () => {
    render(<HealthInfoWhatCounts config={{
      ...faithFlow,
      initialGroupId: 'rhythms',
      initialItemId: 'prayer-rhythm'
    }} />);

    expect(screen.getByRole('heading', { name: 'Scheduled completions' })).toBeTruthy();
    expect(screen.getByText('Morning prayer')).toBeTruthy();
    expect(screen.getByText('Prayer')).toBeTruthy();
    expect(screen.getByText('Faith')).toBeTruthy();
    expect(screen.queryByText('Scripture reading')).toBeNull();
  });

  it('shows the Cardio run-log and weekly-goal inputs in the Foundation flow', () => {
    const config = createHealthFitnessRollup('foundations', 'cardio');
    render(<HealthInfoWhatCounts config={config} />);

    expect(screen.getByText('Runs → Cardio')).toBeTruthy();
    expect(screen.getByText('Cardio uses saved run logs against weekly run and distance goals.')).toBeTruthy();
    expect(screen.getByText('Cardio')).toBeTruthy();
    expect(screen.queryByText('Workouts → Strength')).toBeNull();
    expect(screen.queryByText('Weigh-ins → Weight')).toBeNull();
  });

  it.each([
    {
      label: 'scored zero and a partially available measure',
      score: 0,
      consistency: { score: 0, state: 'scored' as const },
      onTrack: { score: null, state: 'unavailable' as const },
      expectedOverall: '0',
      expectedConsistency: '0%',
      expectedOnTrack: '—'
    },
    {
      label: 'fully unavailable measures',
      score: null,
      consistency: { score: null, state: 'unavailable' as const },
      onTrack: { score: null, state: 'unavailable' as const },
      expectedOverall: '—',
      expectedConsistency: '—',
      expectedOnTrack: '—'
    }
  ])('shows $label once with actual measure values', ({
    score,
    consistency,
    onTrack,
    expectedOverall,
    expectedConsistency,
    expectedOnTrack
  }) => {
    render(
      <HealthScoreDetailsContent
        title="Faith Health"
        ariaLabel="Faith Health details"
        score={score}
        consistency={consistency}
        onTrack={onTrack}
        consistencyCaption="How regularly you follow through"
        onTrackCaption="How caught up you are."
        rollup={faithFlow}
      />
    );

    const dialogContent = document.querySelector<HTMLElement>('.health-score-details-content')!;
    const measureValues = [...dialogContent.querySelectorAll('.rhythm-history-view__health-weight-score')]
      .map(value => value.textContent);
    expect(within(dialogContent).getByRole('heading', { name: 'Overall Health' })).toBeTruthy();
    expect(within(dialogContent).getByRole('heading', { name: 'How Health is calculated' })).toBeTruthy();
    expect(dialogContent.querySelector('.health-score-breakdown__header > span')?.textContent)
      .toBe(expectedOverall);
    expect(measureValues).toEqual([expectedConsistency, expectedOnTrack]);
    expect(within(dialogContent).getByText('75%')).toBeTruthy();
    expect(within(dialogContent).getByText('25%')).toBeTruthy();
    expect(within(dialogContent).getByText('How regularly you follow through')).toBeTruthy();
    expect(within(dialogContent).getByText('How caught up you are.')).toBeTruthy();
    expect(dialogContent.querySelectorAll('.health-score-meter')).toHaveLength(1);
    expect(dialogContent.querySelector('.health-score-measures')).toBeNull();
    expect(dialogContent.querySelector('.health-rollup__navigation')).toBeNull();
  });
});
