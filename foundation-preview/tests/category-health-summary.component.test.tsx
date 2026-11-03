import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { CategoryScoreSelection } from '../src/domain/category-scoring.ts';
import { CategoryHealthSummary } from '../src/components/CategoryHealthSummary.tsx';

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
  explanation = 'Eligible Foundations contribute according to the existing category rules.'
}: {
  title?: string;
  itemTerm?: { singular: string; plural: string };
  score?: CategoryScoreSelection;
  explanation?: string;
} = {}) {
  return render(
    <CategoryHealthSummary
      title={title}
      itemTerm={itemTerm}
      score={score}
      explanation={explanation}
    />
  );
}

describe('shared Category Health summary', () => {
  afterEach(cleanup);

  it('uses the Rhythm Health header, bar, divider and side-by-side gauge order', () => {
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
    expect(screen.getByText('2 of 6 Foundations scored')).toBeTruthy();
    expect(screen.getByText('How regularly you show up')).toBeTruthy();
    expect(screen.getByText('Whether your Rhythms are up to date')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'How your Health score is calculated' })).toBeNull();
    expect(document.querySelectorAll('.preview-score-meter, .category-health-meter')).toHaveLength(0);
  });

  it('shows the shared 75/25 explanation before the gauges and category details after them', async () => {
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
    const [calculationId, detailsId] = info.getAttribute('aria-controls')!.split(/\s+/);
    expect(calculationId).toBeTruthy();
    expect(detailsId).toBeTruthy();
    const calculation = document.getElementById(calculationId!)!;
    const details = document.getElementById(detailsId!)!;
    expect(info.getAttribute('aria-expanded')).toBe('false');
    expect(calculation.hasAttribute('hidden')).toBe(true);
    expect(details.hasAttribute('hidden')).toBe(true);

    info.focus();
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(info);
    expect(info.getAttribute('aria-expanded')).toBe('true');
    expect(calculation.hasAttribute('hidden')).toBe(false);
    expect(details.hasAttribute('hidden')).toBe(false);
    expect(screen.getByRole('heading', { name: 'How your Health score is calculated' })).toBeTruthy();
    expect(within(calculation).getByText(/75%/)).toBeTruthy();
    expect(within(calculation).getByText(/25%/)).toBeTruthy();
    expect(within(details).getByText(
      'Eligible Foundations contribute according to the existing category rules.'
    )).toBeTruthy();
    expect(within(details).getByText(/Each eligible Foundation contributes equally/)).toBeTruthy();
    expect(within(details).getByText(/fixed 75% Consistency and 25% On Track weights/)).toBeTruthy();
    expect(within(details).getByText('— means unavailable; 0 is a valid score.')).toBeTruthy();
    expect(calculation.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const measures = screen.getByRole('group', { name: 'Consistency and On Track' });
    expect(details.compareDocumentPosition(measures) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();

    await user.keyboard('{Escape}');
    expect(info.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(info);
    expect(calculation.hasAttribute('hidden')).toBe(true);
    expect(details.hasAttribute('hidden')).toBe(true);
  });

  it('keeps unavailable values distinct from valid zero scores', () => {
    const { rerender } = renderCategory();
    expect(screen.getByText('No scored Foundations yet')).toBeTruthy();
    for (const name of ['Marriage Health: Not enough data', 'Consistency: Score unavailable', 'On Track: Score unavailable']) {
      expect(screen.getByRole('img', { name })).toBeTruthy();
    }

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
      />
    );
    for (const name of ['Marriage Health score', 'Consistency score', 'On Track score']) {
      expect(screen.getByRole('meter', { name }).getAttribute('aria-valuenow')).toBe('0');
    }
    expect(screen.getByText('1 of 6 Foundations scored')).toBeTruthy();
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
      />
    );
    expect(screen.getByText('2 of 9 Practices scored')).toBeTruthy();
    expect(screen.queryByText(/Foundations/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Show Faith Health scoring explanation' }));
    const details = screen.getByRole('region', { name: 'Faith Health calculation details' });
    expect(within(details).getByText(/chosen practices—not the strength of your faith/)).toBeTruthy();
    expect(within(details).getByText(/Each eligible Practice contributes equally/)).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'Faith Health score' }).getAttribute('aria-valuenow')).toBe('85');
  });
});
