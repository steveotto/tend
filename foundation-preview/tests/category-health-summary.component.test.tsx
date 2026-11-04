import { cleanup, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MouseEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CategoryScoreSelection } from '../src/domain/category-scoring.ts';
import { todayRhythms } from '../src/domain/preview-data.ts';
import type { RhythmPreview } from '../src/domain/preview-data.ts';
import { CategoryHealthSummary } from '../src/components/CategoryHealthSummary.tsx';
import type { HealthRollupConfig } from '../src/components/HealthRollupDiagram.tsx';

function categoryRollup(title: string): HealthRollupConfig {
  return {
    groups: [{
      id: 'category',
      label: 'Category',
      items: [{ id: title, label: title }]
    }],
    initialGroupId: 'category',
    initialItemId: title
  };
}

function categoryScore({
  foundationIds = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'],
  eligibleFoundationIds = [],
  consistency = null,
  onTrack = null,
  health = null
}: Partial<CategoryScoreSelection> = {}): CategoryScoreSelection {
  return {
    foundationIds,
    eligibleFoundationIds,
    excludedFoundationIds: [],
    unresolvedFoundationIds: [],
    consistency,
    onTrack,
    health
  };
}

function renderCategory({
  title = 'Marriage Health',
  itemTerm = { singular: 'Foundation', plural: 'Foundations' },
  score = categoryScore(),
  explanation = 'Eligible Foundations contribute according to the existing category rules.',
  unlinkedRhythms = [],
  onEditRhythm
}: {
  title?: string;
  itemTerm?: { singular: string; plural: string };
  score?: CategoryScoreSelection;
  explanation?: string;
  unlinkedRhythms?: readonly RhythmPreview[];
  onEditRhythm?: (rhythm: RhythmPreview, event: MouseEvent<HTMLButtonElement>) => void;
} = {}) {
  return render(
    <CategoryHealthSummary
      title={title}
      itemTerm={itemTerm}
      score={score}
      explanation={explanation}
      unlinkedRhythms={unlinkedRhythms}
      rollup={categoryRollup(title)}
      {...(onEditRhythm ? { onEditRhythm } : {})}
    />
  );
}

describe('shared Category Health summary', () => {
  afterEach(cleanup);

  it('keeps the Health heading, overall bar, and titled gauges compact', () => {
    renderCategory({
      score: categoryScore({
        eligibleFoundationIds: ['connection', 'trust'],
        consistency: 82.5,
        onTrack: 100,
        health: 86.875
      })
    });

    const root = screen.getByRole('region', { name: 'Marriage Health summary' });
    const header = root.querySelector('.health-score-breakdown__header')!;
    const bar = root.querySelector('.health-score-breakdown__header + .health-score-meter')!;
    const divider = root.querySelector('.rhythm-history-view__score-summary-divider')!;
    const measures = root.querySelector('.health-score-measures')!;
    expect(screen.getByRole('heading', { name: 'Marriage Health' })).toBeTruthy();
    expect(root.querySelector('.health-score-breakdown__header button')).toBeTruthy();
    expect(header.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bar.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(divider.compareDocumentPosition(measures) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'Marriage Health score' }).getAttribute('aria-valuenow')).toBe('86.875');
    expect(screen.getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuenow')).toBe('83');
    expect(screen.getByRole('meter', { name: 'On Track score' }).getAttribute('aria-valuenow')).toBe('100');
    expect(screen.queryByText('2 of 6 Foundations scored')).toBeNull();
    expect(screen.queryByText('How regularly you show up')).toBeNull();
    expect(screen.queryByText('Whether your Rhythms are up to date')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'How your Health score is calculated' })).toBeNull();
    expect(document.querySelectorAll('.preview-score-meter, .category-health-meter')).toHaveLength(0);
  });

  it('opens the shared scoring explanation and category counts in a focus-returning dialog', async () => {
    const user = userEvent.setup();
    renderCategory({
      score: categoryScore({
        eligibleFoundationIds: ['f1'],
        consistency: 70,
        onTrack: 100,
        health: 77.5
      })
    });

    const info = screen.getByRole('button', { name: 'Show Marriage Health scoring explanation' });
    expect(info.querySelector('svg circle')).toBeTruthy();
    expect(info.textContent).toBe('');
    expect(info.getAttribute('aria-expanded')).toBe('false');

    await user.click(info);
    expect(info.getAttribute('aria-expanded')).toBe('true');
    const dialog = screen.getByRole('dialog', { name: 'Marriage Health details' });
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: 'Marriage Health details' }));
    const details = within(dialog).getByRole('region', { name: 'Marriage Health calculation details' });
    expect(screen.getByRole('heading', { name: 'Overall Health' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'How Health is calculated' })).toBeTruthy();
    expect(within(dialog).getByText('75%')).toBeTruthy();
    expect(within(dialog).getByText('70%')).toBeTruthy();
    expect(within(dialog).getByText('25%')).toBeTruthy();
    expect(within(dialog).getByText('100%')).toBeTruthy();
    expect(within(details).getByText('1 of 6 Foundations scored.')).toBeTruthy();
    expect(within(details).getByText(
      'Eligible Foundations contribute according to the existing category rules.'
    )).toBeTruthy();
    expect(within(details).getByText(/Each eligible Foundation contributes equally/)).toBeTruthy();
    expect(within(details).getByText('— means unavailable; 0 is a valid score.')).toBeTruthy();
    const breakdown = within(details).getByRole('region', { name: 'Marriage Health calculation details score summary' });
    expect(within(breakdown).getByRole('meter', { name: 'Marriage Health score' }).getAttribute('aria-valuenow')).toBe('77.5');
    expect(breakdown.querySelector('.health-score-measures')).toBeNull();
    expect(dialog.querySelectorAll('.health-score-meter')).toHaveLength(1);

    await user.click(within(dialog).getByRole('button', { name: 'Close Health details' }));
    await waitFor(() => expect(document.activeElement).toBe(info));
    expect(info.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('dialog', { name: 'Marriage Health details' })).toBeNull();
  });

  it('explains unlinked Rhythm exclusions and exposes an accessible edit action', async () => {
    const user = userEvent.setup();
    const rhythm = { ...todayRhythms[0]!, id: 'legacy-faith-rhythm', title: 'Legacy prayer' };
    const onEditRhythm = vi.fn();
    renderCategory({
      title: 'Faith Health',
      itemTerm: { singular: 'Practice', plural: 'Practices' },
      unlinkedRhythms: [rhythm],
      onEditRhythm
    });

    await user.click(screen.getByRole('button', { name: 'Show Faith Health scoring explanation' }));
    const details = screen.getByRole('region', { name: 'Faith Health calculation details' });
    expect(within(details).getByText(/1 Rhythm isn’t included yet/)).toBeTruthy();
    expect(within(details).getByText(/Each needs a matching Practice/)).toBeTruthy();
    expect(within(details).getByRole('button', { name: 'Edit Legacy prayer' })).toBeTruthy();
    await user.click(within(details).getByRole('button', { name: 'Edit Legacy prayer' }));
    expect(onEditRhythm).toHaveBeenCalledOnce();
    expect(onEditRhythm.mock.calls[0]?.[0]).toBe(rhythm);
  });

  it('keeps unavailable values distinct from valid zero scores in summaries and details', async () => {
    const user = userEvent.setup();
    const { rerender } = renderCategory();
    expect(screen.queryByText('No scored Foundations yet.')).toBeNull();
    for (const name of ['Marriage Health: Not enough data', 'Consistency: Score unavailable', 'On Track: Score unavailable']) {
      expect(screen.getByRole('img', { name })).toBeTruthy();
    }
    await user.click(screen.getByRole('button', { name: 'Show Marriage Health scoring explanation' }));
    const unavailableDialog = screen.getByRole('dialog', { name: 'Marriage Health details' });
    const unavailableDetails = within(unavailableDialog).getByRole('region', {
      name: 'Marriage Health calculation details score summary'
    });
    expect(within(unavailableDetails).getByRole('img', { name: 'Marriage Health: Not enough data' })).toBeTruthy();
    expect(unavailableDetails.querySelector('.health-score-measures')).toBeNull();
    expect([...unavailableDialog.querySelectorAll('.rhythm-history-view__health-weight-score')]
      .map(value => value.textContent)).toEqual(['—', '—']);
    await user.click(within(unavailableDialog).getByRole('button', { name: 'Close Health details' }));

    rerender(
      <CategoryHealthSummary
        title="Marriage Health"
        itemTerm={{ singular: 'Foundation', plural: 'Foundations' }}
        score={categoryScore({
          eligibleFoundationIds: ['connection'],
          consistency: 0,
          onTrack: 0,
          health: 0
        })}
        explanation="Eligible Foundations contribute according to the existing category rules."
        rollup={categoryRollup('Marriage Health')}
      />
    );
    for (const name of ['Marriage Health score', 'Consistency score', 'On Track score']) {
      expect(screen.getByRole('meter', { name }).getAttribute('aria-valuenow')).toBe('0');
    }
    expect(screen.getAllByText('0%')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Show Marriage Health scoring explanation' }));
    const zeroDialog = screen.getByRole('dialog', { name: 'Marriage Health details' });
    const zeroDetails = within(zeroDialog).getByRole('region', {
      name: 'Marriage Health calculation details score summary'
    });
    expect(within(zeroDetails).getByRole('meter', { name: 'Marriage Health score' }).getAttribute('aria-valuenow')).toBe('0');
    expect(zeroDetails.querySelector('.health-score-measures')).toBeNull();
    expect([...zeroDialog.querySelectorAll('.rhythm-history-view__health-weight-score')]
      .map(value => value.textContent)).toEqual(['0%', '0%']);
  });

  it('keeps long category titles accessible and Faith-specific Practice wording', async () => {
    const user = userEvent.setup();
    const longTitle = 'Encouragement and Meaningful Family Connections Health';
    const { rerender } = renderCategory({ title: longTitle });
    expect(screen.getByRole('heading', { name: longTitle })).toBeTruthy();
    expect(screen.getByRole('button', { name: `Show ${longTitle} scoring explanation` })).toBeTruthy();

    rerender(
      <CategoryHealthSummary
        title="Faith Health"
        itemTerm={{ singular: 'Practice', plural: 'Practices' }}
        explanation="Your score reflects follow-through on your chosen practices—not the strength of your faith."
        score={categoryScore({
          foundationIds: Array.from({ length: 9 }, (_, index) => `faith-${index}`),
          eligibleFoundationIds: ['faith-prayer', 'faith-scripture'],
          consistency: 80,
          onTrack: 100,
          health: 85
        })}
        rollup={categoryRollup('Faith Health')}
      />
    );
    expect(screen.queryByText('2 of 9 Practices scored.')).toBeNull();
    expect(screen.queryByText(/Foundations/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Show Faith Health scoring explanation' }));
    const dialog = screen.getByRole('dialog', { name: 'Faith Health details' });
    const details = within(dialog).getByRole('region', { name: 'Faith Health calculation details' });
    expect(within(details).getByText('2 of 9 Practices scored.')).toBeTruthy();
    expect(within(details).getByText(/chosen practices—not the strength of your faith/)).toBeTruthy();
    expect(within(details).getByText(/Each eligible Practice contributes equally/)).toBeTruthy();
    expect(within(dialog).getByRole('meter', { name: 'Faith Health score' }).getAttribute('aria-valuenow')).toBe('85');
  });

  it.each([
    ['Faith Health', { singular: 'Practice', plural: 'Practices' }, 'Faith follows its selected Practices.'],
    ['Marriage Health', { singular: 'Foundation', plural: 'Foundations' }, 'Marriage follows its selected Foundations.'],
    ['Parenting Health', { singular: 'Foundation', plural: 'Foundations' }, 'Parenting follows its selected Foundations.'],
    ['Health & Fitness Health', { singular: 'Foundation', plural: 'Foundations' }, 'Health & Fitness follows its selected Foundations.']
  ])('uses the circled info button to open the %s explanation', async (title, itemTerm, explanation) => {
    const user = userEvent.setup();
    renderCategory({ title, itemTerm, explanation });
    const button = screen.getByRole('button', { name: `Show ${title} scoring explanation` });
    expect(button.querySelector('svg circle')).toBeTruthy();
    await user.click(button);
    const dialog = screen.getByRole('dialog', { name: `${title} details` });
    expect(within(dialog).getByRole('region', { name: `${title} calculation details` }).textContent)
      .toContain(explanation);
  });
});
