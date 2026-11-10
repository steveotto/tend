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
    initialItemId: title,
    healthContribution: {
      heading: 'How this Category contributes',
      highlightedGroup: 'categories',
      highlightedItemId: title,
      overallScore: null,
      categories: [{
        id: title,
        label: title,
        score: null,
        categoryIconId: 'marriage'
      }],
      foundations: [],
      bottomGroupLabel: 'Linked Rhythms',
      bottomItem: {
        id: 'linked-rhythms',
        label: 'No linked Rhythms',
        score: null,
        showScore: false
      },
      identity: {
        name: title,
        icon: { kind: 'category', id: 'marriage' }
      }
    }
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

  it('opens scoring details in a nested dialog and preserves the parent dialog state', async () => {
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
    const scoringToggle = within(dialog).getByRole('button', { name: 'How this Category was scored' });
    const contributionToggle = within(dialog).getByRole('button', { name: 'How this Category contributes' });
    expect(scoringToggle.getAttribute('aria-expanded')).toBe('false');
    expect(contributionToggle.getAttribute('aria-expanded')).toBe('false');
    await user.click(scoringToggle);
    expect(scoringToggle.getAttribute('aria-expanded')).toBe('true');
    expect(within(details).getByRole('heading', { name: 'How Health is calculated' })).toBeTruthy();
    expect(within(dialog).getByText('75%')).toBeTruthy();
    expect([...dialog.querySelectorAll('.rhythm-score-circle__value')].map(node => node.textContent))
      .toEqual(['70', '100']);
    expect(within(dialog).getByLabelText('75% times 70 approximately equals 53 points')).toBeTruthy();
    expect(within(dialog).getByLabelText('25% times 100 equals 25 points')).toBeTruthy();
    expect(dialog.querySelector('.rhythm-health-scoring-card__formula--total')?.textContent)
      .toContain('53 + 25 ≈ 78');
    expect(dialog.querySelector('.health-info-summary-card')).toBeTruthy();
    expect(dialog.querySelector('.health-info-contribution-card')).toBeTruthy();
    expect(within(details).queryByText('1 of 6 Foundations scored')).toBeNull();
    expect(within(details).getByText(
      'Eligible Foundations contribute according to the existing category rules.'
    )).toBeTruthy();
    expect(within(dialog).getByText('— unavailable · 0 is a valid score')).toBeTruthy();
    const breakdown = within(details).getByRole('region', { name: 'Marriage Health calculation details score summary' });
    expect(within(breakdown).getByRole('heading', { name: 'Overall Health' })).toBeTruthy();
    expect(within(breakdown).getByRole('meter', { name: 'Marriage Health score' }).getAttribute('aria-valuenow')).toBe('77.5');
    expect(within(breakdown).getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuenow')).toBe('70');
    expect(within(breakdown).getByRole('meter', { name: 'On Track score' }).getAttribute('aria-valuenow')).toBe('100');
    expect(breakdown.querySelector('.rhythm-history-view__health-weight-score')).toBeNull();
    expect(breakdown.querySelector('.rhythm-history-view__health-weight-description')).toBeNull();
    expect(dialog.querySelectorAll('.health-score-meter')).toHaveLength(1);

    const dialogBody = dialog.querySelector('.health-score-details-dialog__body') as HTMLElement;
    expect(contributionToggle.getAttribute('aria-expanded')).toBe('false');
    await user.click(contributionToggle);
    expect(contributionToggle.getAttribute('aria-expanded')).toBe('true');
    await user.click(scoringToggle);
    expect(scoringToggle.getAttribute('aria-expanded')).toBe('false');
    expect(contributionToggle.getAttribute('aria-expanded')).toBe('true');
    await user.click(scoringToggle);
    expect(scoringToggle.getAttribute('aria-expanded')).toBe('true');
    const scoringInfoTrigger = within(dialog).getByRole('button', { name: 'About Foundation scoring' });
    dialogBody.scrollTop = 137;
    await user.click(scoringInfoTrigger);
    const scoringDialog = screen.getByRole('dialog', { name: 'Foundation scoring' });
    expect(dialog.hasAttribute('inert')).toBe(true);
    expect(within(scoringDialog).getByText('1 of 6 Foundations scored')).toBeTruthy();
    expect(within(scoringDialog).getByText(
      'Eligible Foundations contribute according to the existing category rules.'
    )).toBeTruthy();
    expect(within(scoringDialog).getByText(
      'Each eligible Foundation counts equally. Both Consistency and On Track must be available to count.'
    )).toBeTruthy();
    expect(document.querySelectorAll('dialog[open]')).toHaveLength(2);
    expect(document.activeElement).toBe(within(scoringDialog).getByRole('heading', { name: 'Foundation scoring' }));
    expect(dialogBody.scrollTop).toBe(137);

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Foundation scoring' })).toBeNull();
      expect(dialog.hasAttribute('inert')).toBe(false);
      expect(document.activeElement).toBe(scoringInfoTrigger);
    });
    expect(screen.getByRole('dialog', { name: 'Marriage Health details' })).toBe(dialog);
    expect(contributionToggle.getAttribute('aria-expanded')).toBe('true');
    expect(dialogBody.scrollTop).toBe(137);

    await user.click(within(dialog).getByRole('button', { name: 'Close Health details' }));
    await waitFor(() => expect(document.activeElement).toBe(info));
    expect(info.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('dialog', { name: 'Marriage Health details' })).toBeNull();
    await user.click(info);
    const reopenedDialog = screen.getByRole('dialog', { name: 'Marriage Health details' });
    expect(within(reopenedDialog).getByRole('button', { name: 'How this Category was scored' }).getAttribute('aria-expanded')).toBe('false');
    expect(within(reopenedDialog).getByRole('button', { name: 'How this Category contributes' }).getAttribute('aria-expanded')).toBe('false');
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
    await user.click(screen.getByRole('button', { name: 'How this Category contributes' }));
    await user.click(screen.getByRole('button', { name: 'About Practice scoring' }));
    const scoringDialog = screen.getByRole('dialog', { name: 'Practice scoring' });
    expect(within(scoringDialog).getByText(/1 Rhythm isn’t included yet/)).toBeTruthy();
    expect(within(scoringDialog).getByText(/Each needs a matching Practice/)).toBeTruthy();
    expect(within(scoringDialog).getByRole('button', { name: 'Edit Legacy prayer' })).toBeTruthy();
    await user.click(within(scoringDialog).getByRole('button', { name: 'Edit Legacy prayer' }));
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
    expect(within(unavailableDetails).getByRole('img', { name: 'Consistency: Score unavailable' })).toBeTruthy();
    expect(within(unavailableDetails).getByRole('img', { name: 'On Track: Score unavailable' })).toBeTruthy();
    expect(unavailableDetails.querySelector('.rhythm-history-view__health-weight-score')).toBeNull();
    expect(within(unavailableDialog).getByLabelText('75% times unavailable equals unavailable')).toBeTruthy();
    expect(within(unavailableDialog).getByLabelText('25% times unavailable equals unavailable')).toBeTruthy();
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
    expect([...document.querySelectorAll('.rhythm-score-circle__value')].map(node => node.textContent))
      .toEqual(['0', '0']);
    await user.click(screen.getByRole('button', { name: 'Show Marriage Health scoring explanation' }));
    const zeroDialog = screen.getByRole('dialog', { name: 'Marriage Health details' });
    const zeroDetails = within(zeroDialog).getByRole('region', {
      name: 'Marriage Health calculation details score summary'
    });
    expect(within(zeroDetails).getByRole('meter', { name: 'Marriage Health score' }).getAttribute('aria-valuenow')).toBe('0');
    expect(within(zeroDetails).getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuenow')).toBe('0');
    expect(within(zeroDetails).getByRole('meter', { name: 'On Track score' }).getAttribute('aria-valuenow')).toBe('0');
    expect(zeroDetails.querySelector('.rhythm-history-view__health-weight-score')).toBeNull();
    expect(within(zeroDialog).getByLabelText('75% times 0 equals 0 points')).toBeTruthy();
    expect(within(zeroDialog).getByLabelText('25% times 0 equals 0 points')).toBeTruthy();
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
          eligibleFoundationIds: ['faith-prayer'],
          consistency: 80,
          onTrack: 100,
          health: 85
        })}
        rollup={categoryRollup('Faith Health')}
      />
    );
    expect(screen.queryByText('1 of 9 Practices scored')).toBeNull();
    expect(screen.queryByText(/Foundations/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Show Faith Health scoring explanation' }));
    const dialog = screen.getByRole('dialog', { name: 'Faith Health details' });
    const scoringToggle = within(dialog).getByRole('button', { name: 'How this Category was scored' });
    expect(scoringToggle.getAttribute('aria-expanded')).toBe('false');
    await user.click(scoringToggle);
    await user.click(within(dialog).getByRole('button', { name: 'How this Category contributes' }));
    await user.click(within(dialog).getByRole('button', { name: 'About Practice scoring' }));
    const scoringDialog = screen.getByRole('dialog', { name: 'Practice scoring' });
    expect(within(scoringDialog).getByText('1 of 9 Practices scored')).toBeTruthy();
    expect(within(scoringDialog).getByText(/chosen practices—not the strength of your faith/)).toBeTruthy();
    expect(within(scoringDialog).getByText(/Each eligible Practice counts equally/)).toBeTruthy();
    await user.click(within(scoringDialog).getByRole('button', { name: 'Close scoring explanation' }));
    expect(within(dialog).getByRole('meter', { name: 'Faith Health score' }).getAttribute('aria-valuenow')).toBe('85');
  });

  it.each([
    ['Faith Health', { singular: 'Practice', plural: 'Practices' }, 'Faith follows its selected Practices.'],
    ['Marriage Health', { singular: 'Foundation', plural: 'Foundations' }, 'Marriage follows its selected Foundations.'],
    ['Parenting Health', { singular: 'Foundation', plural: 'Foundations' }, 'Parenting follows its selected Foundations.'],
    ['Health & Fitness Health', { singular: 'measure', plural: 'measures' }, 'Health & Fitness follows its selected measures.']
  ])('uses the circled info button to open the %s explanation', async (title, itemTerm, explanation) => {
    const user = userEvent.setup();
    renderCategory({ title, itemTerm, explanation });
    const button = screen.getByRole('button', { name: `Show ${title} scoring explanation` });
    expect(button.querySelector('svg circle')).toBeTruthy();
    await user.click(button);
    const dialog = screen.getByRole('dialog', { name: `${title} details` });
    const scoringTerm = itemTerm.singular === 'measure' ? 'Measure' : itemTerm.singular;
    await user.click(within(dialog).getByRole('button', { name: 'How this Category contributes' }));
    await user.click(within(dialog).getByRole('button', { name: `About ${scoringTerm} scoring` }));
    const scoringDialog = screen.getByRole('dialog', { name: `${scoringTerm} scoring` });
    expect(within(scoringDialog).getByRole('region', { name: `${scoringTerm} scoring details` }).textContent)
      .toContain(explanation);
  });
});
