import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { HealthInfoWhatCounts } from '../src/components/HealthInfoWhatCounts.tsx';
import { HealthScoreDetailsContent } from '../src/components/HealthScoreDetailsContent.tsx';
import { FitnessScoreSummary } from '../src/components/FitnessScoreSummary.tsx';
import {
  createHealthFitnessHealthContribution,
  createHealthFitnessRollup
} from '../src/components/HealthRollupDiagram.tsx';
import type { HealthRollupConfig } from '../src/components/HealthRollupDiagram.tsx';
import type { RhythmContributionSelection } from '../src/domain/rhythm-contribution.ts';

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

const rhythmContribution: RhythmContributionSelection = {
  overallScore: 60,
  categories: [
    { id: 'faith', label: 'Faith', categoryIconId: 'faith', score: 60 },
    { id: 'marriage', label: 'Marriage', categoryIconId: 'marriage', score: 0 }
  ],
  foundations: [
    {
      id: 'faith-prayer',
      label: 'Prayer',
      categoryLabel: 'Faith',
      foundationIconId: 'faith-prayer',
      score: null
    },
    {
      id: 'marriage-connection',
      label: 'Connection',
      categoryLabel: 'Marriage',
      foundationIconId: 'connection',
      score: 80
    }
  ],
  rhythm: { id: 'walk', label: 'Take a walk', score: 0 },
  unresolvedFoundationIds: []
};

afterEach(cleanup);

describe('static Health Info content', () => {
  it.each([
    {
      label: 'Foundation',
      highlightedGroup: 'foundations' as const,
      heading: 'How this Strength Foundation contributes',
      identity: {
        name: 'Strength',
        secondary: 'Health & Fitness',
        icon: { kind: 'foundation' as const, id: 'health-strength' }
      },
      categories: [{ id: 'health-fitness', label: 'Health & Fitness', score: 80, categoryIconId: 'health' as const }],
      foundations: [{ id: 'health-strength', label: 'Strength', score: 0, categoryLabel: 'Health & Fitness', foundationIconId: 'health-strength' }]
    },
    {
      label: 'Category',
      highlightedGroup: 'categories' as const,
      heading: 'How this Category contributes',
      identity: { name: 'Health & Fitness', icon: { kind: 'category' as const, id: 'health' as const } },
      categories: [{ id: 'health-fitness', label: 'Health & Fitness', score: null, categoryIconId: 'health' as const }],
      foundations: [
        { id: 'health-strength', label: 'Strength', score: 0, categoryLabel: 'Health & Fitness', foundationIconId: 'health-strength' },
        { id: 'health-cardio', label: 'Cardio', score: null, categoryLabel: 'Health & Fitness', foundationIconId: 'health-cardio' }
      ]
    }
  ])('renders the shared $label identity and contribution level', ({
    label,
    highlightedGroup,
    heading,
    identity,
    categories,
    foundations
  }) => {
    const config: HealthRollupConfig = {
      ...createHealthFitnessRollup(
        highlightedGroup === 'foundations' ? 'foundations' : 'category',
        highlightedGroup === 'foundations' ? 'strength' : 'health-fitness'
      ),
      healthContribution: {
        heading,
        highlightedGroup,
        highlightedItemId: highlightedGroup === 'foundations' ? 'health-strength' : 'health-fitness',
        overallScore: 60,
        categories,
        foundations,
        bottomGroupLabel: 'Linked Rhythms',
        bottomItem: {
          id: 'linked-rhythms',
          label: 'No linked Rhythms',
          score: null,
          showScore: false
        },
        identity
      }
    };
    render(
      <HealthScoreDetailsContent
        title={`${label} Health`}
        ariaLabel={`${label} Health details`}
        score={0}
        consistency={{ score: 0 }}
        onTrack={{ score: null, state: 'unavailable' }}
        consistencyCaption="Follow-through over time"
        onTrackCaption="How caught up you are"
        rollup={config}
      />
    );

    expect(screen.getByRole('group', {
      name: `${identity.icon.kind === 'foundation' ? 'Foundation' : 'Category'} identity: ${identity.name}${identity.secondary ? `, ${identity.secondary}` : ''}`
    })).toBeTruthy();
    expect(screen.getByRole('heading', { name: heading })).toBeTruthy();
    expect(document.querySelectorAll('.health-info-what-counts__contribution-group.is-featured')).toHaveLength(1);
    expect(document.querySelector(`.health-info-what-counts__contribution-group--${highlightedGroup}`)
      ?.classList.contains('is-featured')).toBe(true);
    const currentItem = document.querySelector('.health-info-what-counts__contribution-item.is-current');
    expect(currentItem).toBeTruthy();
    expect(currentItem?.textContent).toContain(highlightedGroup === 'foundations' ? 'Strength' : 'Health & Fitness');
    expect(within(currentItem as HTMLElement).getByText('Current item').className).toContain('visually-hidden');
    expect(screen.getByRole('button', { name: heading }).classList.contains('health-details-expandable-header'))
      .toBe(true);
    expect(document.querySelectorAll('.health-info-what-counts__contribution-item.is-current')).toHaveLength(1);
    if (highlightedGroup === 'categories') {
      expect(document.querySelectorAll(
        '.health-info-what-counts__contribution-group--foundations .health-info-what-counts__contribution-item.is-current'
      )).toHaveLength(0);
    }
    expect(screen.getByText('No linked Rhythms')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Strength score 0 out of 100' })).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'No linked Rhythms score unavailable' })).toBeNull();
    expect(screen.getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuenow')).toBe('0');
    expect(screen.getByRole('img', { name: 'On Track: Score unavailable' })).toBeTruthy();
  });

  it('keeps Cardio details tied to Run logs rather than generic Rhythm credit', async () => {
    const user = userEvent.setup();
    render(
      <FitnessScoreSummary
        category="Cardio"
        consistency={0}
        onTrack={80}
        health={20}
        consistencyCaption="Four completed weeks of run and distance goals."
        onTrackCaption="This week’s goal progress."
      />
    );

    await user.click(screen.getByRole('button', { name: 'Show Cardio Health scoring details' }));
    const dialog = screen.getByRole('dialog', { name: 'Cardio Health details' });
    expect(within(dialog).getByRole('group', { name: 'Foundation identity: Cardio, Health & Fitness' })).toBeTruthy();
    expect(within(dialog).getByRole('heading', { name: 'How this Cardio Foundation contributes' })).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'How this Cardio Foundation was scored' }));
    await user.click(within(dialog).getByRole('button', { name: 'How this Cardio Foundation contributes' }));
    expect(within(dialog).getByRole('heading', { name: 'Run logs' })).toBeTruthy();
    expect(within(dialog).getByRole('img', { name: 'Cardio score 20 out of 100' })).toBeTruthy();
    expect(within(dialog).getByLabelText('75% times 0 equals 0 points')).toBeTruthy();
    expect(within(dialog).getByLabelText('25% times 80 equals 20 points')).toBeTruthy();
    expect(within(dialog).queryByText('Linked Rhythms')).toBeNull();
  });

  it('rounds weighted panel Health values and marks rounded results approximate', () => {
    render(
      <HealthScoreDetailsContent
        title="Synthetic Health"
        ariaLabel="Synthetic Health details"
        score={60}
        consistency={{ score: 72.666 }}
        onTrack={{ score: 90.333 }}
        consistencyCaption="Follow-through over time"
        onTrackCaption="How caught up you are"
      />
    );

    expect(screen.getByLabelText('75% times 73 approximately equals 54 points')).toBeTruthy();
    expect(screen.getByLabelText('25% times 90 approximately equals 23 points')).toBeTruthy();
    expect(document.querySelectorAll('.rhythm-history-view__health-weight-formula strong')[0]?.textContent)
      .toBe('54 points');
    expect(document.querySelectorAll('.rhythm-history-view__health-weight-formula strong')[1]?.textContent)
      .toBe('23 points');
  });

  it('uses the authoritative Health & Fitness category and Foundation scores in its contribution flow', () => {
    const config: HealthRollupConfig = {
      ...createHealthFitnessRollup('category', 'health-fitness'),
      healthContribution: createHealthFitnessHealthContribution({
        overallHealthScore: 60,
        categoryHealthScore: null,
        strengthHealthScore: 0,
        cardioHealthScore: null,
        weightHealthScore: 80
      })
    };
    render(<HealthInfoWhatCounts config={config} />);

    expect(screen.getByRole('heading', { name: 'How this Category contributes' })).toBeTruthy();
    expect(document.querySelectorAll('.health-info-what-counts__contribution-group.is-featured')).toHaveLength(1);
    expect(document.querySelector('.health-info-what-counts__contribution-group--categories')
      ?.classList.contains('is-featured')).toBe(true);
    expect(document.querySelector('.health-info-what-counts__contribution-group--categories .health-info-what-counts__contribution-item')
      ?.classList.contains('is-current')).toBe(true);
    expect(screen.getByRole('img', { name: 'Your overall Health score 60 out of 100' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Health & Fitness score unavailable' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Strength score 0 out of 100' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Cardio score unavailable' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Weight score 80 out of 100' })).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Rhythms & logs score unavailable' })).toBeNull();
  });

  it('shows compact Category, Practices, and Linked Rhythms rows without individual examples', () => {
    render(<HealthInfoWhatCounts config={faithFlow} />);

    expect(screen.getByRole('heading', { name: 'What counts' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Practices' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Category' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Linked Rhythms' })).toBeTruthy();
    expect(screen.getByText('Faith')).toBeTruthy();
    expect(screen.queryByText('Prayer')).toBeNull();
    expect(screen.queryByText('Scripture')).toBeNull();
    expect(screen.queryByText('Morning prayer')).toBeNull();
    expect(screen.queryByText('Scripture reading')).toBeNull();
    expect(document.querySelectorAll('.health-info-what-counts__group')).toHaveLength(3);
    expect(document.querySelectorAll('.health-info-what-counts__arrow')).toHaveLength(2);
    expect([...document.querySelectorAll('.health-info-what-counts__group > h4')]
      .map(heading => heading.textContent))
      .toEqual(['Category', 'Practices', 'Linked Rhythms']);
    expect(screen.queryByRole('button')).toBeNull();
    expect(document.querySelector('.health-rollup__navigation')).toBeNull();
  });

  it('keeps the selected Practice identifiable and shows only its score inputs', () => {
    render(<HealthInfoWhatCounts config={{
      ...faithFlow,
      initialGroupId: 'foundations',
      initialItemId: 'prayer'
    }} />);

    expect(screen.getByText('Prayer')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Linked Rhythms' })).toBeTruthy();
    expect(screen.queryByText('Morning prayer')).toBeNull();
    expect(screen.queryByText('Faith')).toBeNull();
    expect(document.querySelectorAll('.health-info-what-counts__group')).toHaveLength(2);
    expect(document.querySelectorAll('.health-info-what-counts__arrow')).toHaveLength(1);
    expect(screen.queryByText('Scripture')).toBeNull();
    expect(screen.queryByText('Scripture reading')).toBeNull();
  });

  it('shows the four scored contribution levels in order with upward arrows', () => {
    render(<HealthInfoWhatCounts config={{ ...faithFlow, rhythmContribution }} />);

    expect(screen.getByRole('button', { name: 'How this Rhythm contributes' })
      .getAttribute('aria-expanded')).toBe('true');
    expect([...document.querySelectorAll('.health-info-what-counts__contribution-heading > h4')]
      .map(heading => heading.textContent))
      .toEqual(['Overall Health', 'Categories', 'Practices & Foundations', 'Rhythm']);
    expect(screen.getByText('Your overall Health')).toBeTruthy();
    expect(screen.getAllByText('Faith')).toHaveLength(2);
    expect(screen.getAllByText('Marriage')).toHaveLength(2);
    expect(screen.getByText('Prayer')).toBeTruthy();
    expect(screen.getByText('Connection')).toBeTruthy();
    expect(screen.getByText('Take a walk')).toBeTruthy();
    expect(document.querySelectorAll('.health-info-what-counts__contribution-arrow')).toHaveLength(3);
    expect(document.querySelectorAll('.health-info-what-counts__contribution-group--overall')).toHaveLength(1);
    expect(document.querySelector('.health-info-what-counts__contribution-group--rhythm')
      ?.classList.contains('is-featured')).toBe(true);
    const currentRhythm = screen.getByText('Take a walk')
      .closest<HTMLElement>('.health-info-what-counts__contribution-item');
    expect(currentRhythm?.classList.contains('is-current')).toBe(true);
    expect(within(currentRhythm!).getByText('Current item').className).toContain('visually-hidden');
    expect(screen.getByText('Prayer').closest('.health-info-what-counts__contribution-item')
      ?.classList.contains('is-current')).toBe(false);
    expect(screen.getByRole('img', { name: 'Your overall Health score 60 out of 100' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Marriage score 0 out of 100' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Prayer score unavailable' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Take a walk score 0 out of 100' })).toBeTruthy();
  });

  it('uses the shared item and badge structure for a long Rhythm name and unavailable score', () => {
    render(<HealthInfoWhatCounts config={{
      ...faithFlow,
      rhythmContribution: {
        ...rhythmContribution,
        rhythm: {
          ...rhythmContribution.rhythm,
          label: 'A very long synthetic Rhythm name that should wrap naturally',
          score: null
        }
      }
    }} />);

    const rhythmItem = screen.getByText('A very long synthetic Rhythm name that should wrap naturally')
      .closest<HTMLElement>('.health-info-what-counts__contribution-item');
    const foundationItem = screen.getByText('Connection')
      .closest<HTMLElement>('.health-info-what-counts__contribution-item');
    expect(rhythmItem).toBeTruthy();
    expect(foundationItem).toBeTruthy();
    for (const item of [rhythmItem!, foundationItem!]) {
      expect(item.children).toHaveLength(3);
      expect(item.children[1]?.classList.contains('health-info-what-counts__contribution-copy')).toBe(true);
      expect(item.children[2]?.classList.contains('category-health-badge')).toBe(true);
    }
    expect(rhythmItem?.querySelector('.health-info-what-counts__rhythm-icon svg')).toBeTruthy();
    expect(within(rhythmItem!).getByRole('img', { name: 'A very long synthetic Rhythm name that should wrap naturally score unavailable' }))
      .toBeTruthy();
    expect([...document.querySelectorAll('.health-info-what-counts__contribution-arrow')])
      .toHaveLength(3);
    expect([...document.querySelectorAll('.health-info-what-counts__contribution-arrow')]
      .every(arrow => arrow.getAttribute('aria-hidden') === 'true' && !arrow.querySelector('button')))
      .toBe(true);
  });

  it('highlights only the selected Foundation within a multi-item contribution group', () => {
    const diagram = createHealthFitnessHealthContribution({
      overallHealthScore: 60,
      categoryHealthScore: 70,
      strengthHealthScore: 80,
      cardioHealthScore: 50,
      weightHealthScore: 40
    });
    const config: HealthRollupConfig = {
      ...createHealthFitnessRollup('foundations', 'strength'),
      healthContribution: {
        ...diagram,
        highlightedGroup: 'foundations',
        highlightedItemId: 'health-strength',
        foundations: [
          { id: 'health-strength', label: 'Strength', score: 80, foundationIconId: 'health-strength' },
          { id: 'health-cardio', label: 'Cardio', score: 50, foundationIconId: 'health-cardio' }
        ]
      }
    };
    render(<HealthInfoWhatCounts config={config} />);

    const strength = screen.getByText('Strength').closest<HTMLElement>(
      '.health-info-what-counts__contribution-item'
    )!;
    const cardio = screen.getByText('Cardio').closest<HTMLElement>(
      '.health-info-what-counts__contribution-item'
    )!;
    expect(strength.classList.contains('is-current')).toBe(true);
    expect(within(strength).getByText('Current item')).toBeTruthy();
    expect(cardio.classList.contains('is-current')).toBe(false);
    expect(within(cardio).queryByText('Current item')).toBeNull();
  });

  it('supports an Overall Health item highlight when the diagram is opened from Overall Health', () => {
    const diagram = createHealthFitnessHealthContribution({
      overallHealthScore: 60,
      categoryHealthScore: 70,
      strengthHealthScore: 80,
      cardioHealthScore: 50,
      weightHealthScore: 40
    });
    render(<HealthInfoWhatCounts config={{
      ...createHealthFitnessRollup('category', 'health-fitness'),
      healthContribution: {
        ...diagram,
        highlightedGroup: 'overall',
        highlightedItemId: 'overall-health'
      }
    }} />);

    const overall = screen.getByText('Your overall Health').closest<HTMLElement>(
      '.health-info-what-counts__contribution-item'
    )!;
    expect(overall.classList.contains('is-current')).toBe(true);
    expect(within(overall).getByText('Current item')).toBeTruthy();
    expect(document.querySelectorAll('.health-info-what-counts__contribution-item.is-current')).toHaveLength(1);
  });

  it('collapses the complete contribution diagram and supports keyboard activation', async () => {
    const user = userEvent.setup();
    render(<HealthInfoWhatCounts config={{ ...faithFlow, rhythmContribution }} />);
    const toggle = screen.getByRole('button', { name: 'How this Rhythm contributes' });
    const content = document.getElementById(toggle.getAttribute('aria-controls')!)!;

    toggle.focus();
    await user.keyboard('{Enter}');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(content.hidden).toBe(true);

    await user.keyboard(' ');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(content.hidden).toBe(false);
  });

  it('keeps missing associations explicit without inventing a category', () => {
    render(<HealthInfoWhatCounts config={{
      ...faithFlow,
      rhythmContribution: {
        ...rhythmContribution,
        categories: [],
        foundations: [{
          id: 'missing-foundation',
          label: 'missing-foundation (unresolved)',
          categoryLabel: 'Category unavailable',
          score: null
        }],
        unresolvedFoundationIds: ['missing-foundation']
      }
    }} />);

    expect(screen.getByText('missing-foundation (unresolved)')).toBeTruthy();
    expect(screen.getByText('Category unavailable')).toBeTruthy();
    expect(screen.getByText('Category link unavailable for unresolved Foundations.')).toBeTruthy();
    expect(screen.queryByText('Faith')).toBeNull();
  });

  it('shows concise, accurate run-log inputs in the Cardio Foundation flow', () => {
    const config = createHealthFitnessRollup('foundations', 'cardio');
    render(<HealthInfoWhatCounts config={config} />);

    expect(screen.getByRole('heading', { name: 'Run logs' })).toBeTruthy();
    expect(screen.getByText('Cardio')).toBeTruthy();
    expect(screen.queryByText(/Runs → Cardio/)).toBeNull();
    expect(screen.queryByText('Workouts → Strength')).toBeNull();
    expect(screen.queryByText('Weigh-ins → Weight')).toBeNull();
  });

  it.each([
    ['strength', 'Strength'],
    ['weight', 'Weight']
  ] as const)('uses linked Rhythms as the %s Health input', (foundationId, label) => {
    render(<HealthInfoWhatCounts config={createHealthFitnessRollup('foundations', foundationId)} />);

    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Linked Rhythms' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Rhythms & logs' })).toBeNull();
  });

  it('places Health & Fitness, Foundations, and Rhythms & logs in scoring order', () => {
    render(<HealthInfoWhatCounts config={createHealthFitnessRollup('category', 'health-fitness')} />);

    expect([...document.querySelectorAll('.health-info-what-counts__group > h4')]
      .map(heading => heading.textContent))
      .toEqual(['Category', 'Foundations', 'Rhythms & logs']);
    expect(screen.getByText('Health & Fitness')).toBeTruthy();
    expect(screen.queryByText('Workouts → Strength')).toBeNull();
    expect(screen.queryByText('Runs → Cardio')).toBeNull();
  });

  it.each([0, 1, 24])('keeps the category diagram at three rows with %s linked Rhythms', count => {
    const config: HealthRollupConfig = {
      ...faithFlow,
      groups: faithFlow.groups.map(group => group.id === 'rhythms'
        ? {
            ...group,
            items: Array.from({ length: count }, (_, index) => ({
              id: `rhythm-${index}`,
              label: `Synthetic Rhythm ${index + 1}`,
              relatedItemIds: { foundations: ['prayer'], category: ['faith'] }
            }))
          }
        : group)
    };
    render(<HealthInfoWhatCounts config={config} />);

    expect(document.querySelectorAll('.health-info-what-counts__group')).toHaveLength(3);
    expect(document.querySelectorAll('.health-info-what-counts__arrow')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Linked Rhythms' })).toBeTruthy();
    expect(screen.queryByText(/Synthetic Rhythm/)).toBeNull();
  });

  it.each([
    {
      label: 'zero Consistency and 90% On Track in the paired gauges',
      score: 0,
      consistency: { score: 0, state: 'scored' as const },
      onTrack: { score: 90, state: 'scored' as const },
      expectedOverall: '0',
      expectedGauges: ['0', '90']
    },
    {
      label: 'an unavailable measure as a dash while retaining a valid zero',
      score: null,
      consistency: { score: 0, state: 'scored' as const },
      onTrack: { score: null, state: 'unavailable' as const },
      expectedOverall: '—',
      expectedGauges: ['0', '—']
    }
  ])('shows $label once with actual measure values', ({
    score,
    consistency,
    onTrack,
    expectedOverall,
    expectedGauges
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
    const breakdown = within(dialogContent).getByRole('region', { name: 'Faith Health details score summary' });
    const overallHeader = breakdown.querySelector('.health-score-breakdown__header')!;
    const overallBar = breakdown.querySelector('.health-score-meter')!;
    const gauges = breakdown.querySelector('.health-score-measures')!;
    const calculationHeading = within(dialogContent).getByRole('heading', { name: 'How Health is calculated' });
    expect(within(dialogContent).getByRole('heading', { name: 'Overall Health' })).toBeTruthy();
    expect(calculationHeading).toBeTruthy();
    expect(overallHeader.querySelector(':scope > span')?.textContent)
      .toBe(expectedOverall);
    expect(overallBar.compareDocumentPosition(gauges) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(gauges.compareDocumentPosition(calculationHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect([...gauges.querySelectorAll('.rhythm-score-circle__value')].map(value => value.textContent))
      .toEqual(expectedGauges);
    expect(within(dialogContent).getByText('75%')).toBeTruthy();
    expect(within(dialogContent).getByText('25%')).toBeTruthy();
    expect(within(dialogContent).getByText('Follow-through over time')).toBeTruthy();
    expect(within(dialogContent).getByText('How caught up you are')).toBeTruthy();
    expect(dialogContent.querySelector('.rhythm-history-view__health-weight-score')).toBeNull();
    expect(dialogContent.querySelector('.rhythm-history-view__health-weight-description')).toBeNull();
    expect(within(dialogContent).queryByText(/The average/)).toBeNull();
    expect(dialogContent.querySelectorAll('.health-score-meter')).toHaveLength(1);
    expect(dialogContent.querySelector('.health-rollup__navigation')).toBeNull();
  });
});
