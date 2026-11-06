import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { createHealthFitnessRollup, HealthRollupDiagram } from '../src/components/HealthRollupDiagram.tsx';
import type { HealthRollupConfig } from '../src/components/HealthRollupDiagram.tsx';

const config: HealthRollupConfig = {
  groups: [
    {
      id: 'rhythms',
      label: 'Rhythms',
      items: [
        {
          id: 'prayer-rhythm',
          label: 'Morning prayer',
          explanation: 'Rhythm scoring explanation.',
          relatedItemIds: { foundations: ['prayer'], categories: ['faith'] }
        },
        {
          id: 'scripture-rhythm',
          label: 'Scripture reading',
          explanation: 'Another Rhythm scoring explanation.',
          relatedItemIds: { foundations: ['scripture'], categories: ['faith'] }
        }
      ],
      emptyItem: {
        id: 'no-rhythms',
        label: 'No Rhythms',
        explanation: 'No Rhythms are linked to this Foundation or Practice.',
        usesStandardWeights: false
      }
    },
    {
      id: 'foundations',
      label: 'Practices',
      items: [
        {
          id: 'prayer',
          label: 'Prayer',
          foundationIconId: 'faith-prayer',
          explanation: 'Prayer scoring explanation.',
          relatedItemIds: { rhythms: ['prayer-rhythm'], categories: ['faith'] }
        },
        {
          id: 'scripture',
          label: 'Scripture',
          foundationIconId: 'faith-scripture',
          explanation: 'Scripture scoring explanation.',
          relatedItemIds: { rhythms: ['scripture-rhythm'], categories: ['faith'] }
        },
        {
          id: 'empty',
          label: 'Service',
          foundationIconId: 'faith-service',
          explanation: 'Service scoring explanation.',
          relatedItemIds: { rhythms: [], categories: ['faith', 'health'] }
        }
      ]
    },
    {
      id: 'categories',
      label: 'Categories',
      items: [
        {
          id: 'faith',
          label: 'Faith',
          categoryIconId: 'faith',
          explanation: 'Faith scoring explanation.',
          relatedItemIds: { foundations: ['prayer', 'scripture', 'empty'] }
        },
        {
          id: 'health',
          label: 'Health & Fitness',
          categoryIconId: 'health',
          explanation: 'Health scoring explanation.',
          relatedItemIds: { foundations: ['empty'] }
        }
      ]
    }
  ],
  initialGroupId: 'categories',
  initialItemId: 'faith'
};

afterEach(cleanup);

describe('Health scoring rollup diagram', () => {
  it('uses Health & Fitness logs and Foundation measures', () => {
    const fitness = createHealthFitnessRollup('category', 'health-fitness');
    expect(fitness.groups.map(group => group.label)).toEqual(['Rhythms & logs', 'Foundations', 'Category']);
    expect(fitness.groups[0]?.items.map(item => item.label)).toEqual([
      'Workouts → Strength',
      'Weigh-ins → Weight',
      'Runs → Cardio'
    ]);
    expect(fitness.groups[0]?.items[2]?.explanation).toContain('saved run logs');
    expect(fitness.groups[2]?.items[0]?.categoryIconId).toBe('health');
    expect(fitness.groups[1]?.items[0]?.foundationIconId).toBe('health-strength');
  });

  it('shows one card per group, features the opening category, and browses with bounded arrows', async () => {
    const user = userEvent.setup();
    render(<HealthRollupDiagram config={config} />);

    expect(screen.getAllByRole('button')).toHaveLength(7);
    expect(screen.getByRole('button', { name: 'Faith' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Faith' })).toBeTruthy();
    expect(screen.getByText('75%')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Previous categories' }).hasAttribute('disabled')).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Next categories' }));
    expect(screen.getByRole('button', { name: 'Health & Fitness' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Health & Fitness' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next categories' }).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByText('Faith scoring explanation.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Next practices' })).toBeNull();
  });

  it('filters lower cards when a category or Foundation changes and features arrow selections', async () => {
    const user = userEvent.setup();
    render(<HealthRollupDiagram config={config} />);

    await user.click(screen.getByRole('button', { name: 'Prayer' }));
    expect(screen.getByRole('button', { name: 'Prayer' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Morning prayer' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Scripture reading' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Prayer' })).toBeTruthy();
    expect(screen.getByText('75%')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Next practices' }));
    expect(screen.getByRole('button', { name: 'Scripture' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Scripture reading' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Morning prayer' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Scripture' })).toBeTruthy();
    expect(screen.queryByText('Prayer scoring explanation.')).toBeNull();
  });

  it('shows an explicit No Rhythms card when the selected Foundation has none', async () => {
    const user = userEvent.setup();
    render(<HealthRollupDiagram config={config} />);

    await user.click(screen.getByRole('button', { name: 'Prayer' }));
    await user.click(screen.getByRole('button', { name: 'Next practices' }));
    await user.click(screen.getByRole('button', { name: 'Next practices' }));
    await user.click(screen.getByRole('button', { name: 'No Rhythms' }));

    expect(screen.getByRole('button', { name: 'Service' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'No Rhythms' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Previous rhythms' })).toBeNull();
    expect(document.querySelector('.health-rollup__feature .rhythm-history-view__health-weight-panels')).toBeNull();
    expect(screen.getByText('No Rhythms are linked to this Foundation or Practice.')).toBeTruthy();
  });

  it('supports keyboard focus and activation with selected state announced by buttons', async () => {
    const user = userEvent.setup();
    render(<HealthRollupDiagram config={config} />);

    await user.tab();
    const faith = screen.getByRole('button', { name: 'Faith' });
    expect(document.activeElement).toBe(faith);
    await user.tab();
    const next = screen.getByRole('button', { name: 'Next categories' });
    expect(document.activeElement).toBe(next);
    await user.tab();
    const prayer = screen.getByRole('button', { name: 'Prayer' });
    expect(document.activeElement).toBe(prayer);
    await user.keyboard('{Enter}');
    expect(prayer.getAttribute('aria-pressed')).toBe('true');
    await user.tab();
    const nextPractice = screen.getByRole('button', { name: 'Next practices' });
    expect(document.activeElement).toBe(nextPractice);
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Scripture' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('narrows Fitness log cards to the selected Foundation and retains accurate Cardio labels', async () => {
    const user = userEvent.setup();
    render(<HealthRollupDiagram config={createHealthFitnessRollup('category', 'health-fitness')} />);

    await user.click(screen.getByRole('button', { name: 'Strength' }));
    expect(screen.getByRole('button', { name: 'Strength' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Workouts → Strength' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Runs → Cardio' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Next foundations' }));
    await user.click(screen.getByRole('button', { name: 'Next foundations' }));
    expect(screen.getByRole('button', { name: 'Cardio' })).toBeTruthy();
    const runLogs = screen.getByRole('button', { name: 'Runs → Cardio' });
    expect(runLogs).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Workouts → Strength' })).toBeNull();
    await user.click(runLogs);
    expect(screen.getByText(/Cardio Health uses saved run logs/)).toBeTruthy();
  });
});
