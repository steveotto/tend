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

describe('shared Category Health summary', () => {
  afterEach(cleanup);

  it('shows selector-provided coverage and rounded accessible values without redundant meters', () => {
    render(
      <CategoryHealthSummary
        categoryLabel="Parenting"
        score={categoryScore({
          eligibleFoundationIds: ['connection', 'trust'],
          consistency: 82.5,
          onTrack: 100,
          health: 86.875
        })}
      />
    );

    expect(screen.getByRole('heading', { name: 'Parenting Health' })).toBeTruthy();
    expect(screen.getByText('2 of 6 Foundations scored')).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'Parenting Health score' }).getAttribute('aria-valuenow')).toBe('86.875');
    expect(screen.getByText('87', { selector: '.category-health-score' })).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuenow')).toBe('82.5');
    expect(screen.getByText('83', { selector: '.health-summary-score' })).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'On Track score' }).getAttribute('aria-valuenow')).toBe('100');
    expect(screen.getByText('How regularly you show up')).toBeTruthy();
    expect(screen.getByText('How caught up you are')).toBeTruthy();
    expect(document.querySelectorAll('.preview-score-meter')).toHaveLength(0);
    expect(document.querySelectorAll('.category-health-meter')).toHaveLength(0);
  });

  it.each([
    ['empty', categoryScore({ foundationIds: [] })],
    ['fully unscorable', categoryScore({
      excludedFoundationIds: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6']
    })]
  ])('shows unavailable values for an %s Category', (_state, score) => {
    render(<CategoryHealthSummary categoryLabel="Marriage" score={score} />);

    expect(screen.getByText('No scored Foundations yet')).toBeTruthy();
    for (const name of ['Marriage Health score', 'Consistency score', 'On Track score']) {
      const meter = screen.getByRole('meter', { name });
      expect(meter.getAttribute('aria-valuenow')).toBeNull();
      expect(meter.getAttribute('aria-valuetext')).toBe('Score unavailable');
      expect(meter.textContent).toBe('—');
    }
    expect(screen.queryByText(/0 of \d+ Foundations scored/)).toBeNull();
  });

  it('preserves numeric zero in all score values', () => {
    render(
      <CategoryHealthSummary
        categoryLabel="Marriage"
        score={categoryScore({
          eligibleFoundationIds: ['connection'],
          consistency: 0,
          onTrack: 0,
          health: 0
        })}
      />
    );

    for (const name of ['Marriage Health score', 'Consistency score', 'On Track score']) {
      expect(screen.getByRole('meter', { name }).getAttribute('aria-valuenow')).toBe('0');
    }
    expect(screen.getByText('1 of 6 Foundations scored')).toBeTruthy();
  });

  it('keeps the weight explanation collapsed until the accessible info button is activated', async () => {
    const user = userEvent.setup();
    render(
      <CategoryHealthSummary
        categoryLabel="Encouragement & Affirmation"
        score={categoryScore()}
      />
    );

    const info = screen.getByRole('button', { name: 'Show Encouragement & Affirmation scoring explanation' });
    const detailsId = info.getAttribute('aria-controls')!;
    expect(info.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById(detailsId)?.hasAttribute('hidden')).toBe(true);

    info.focus();
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(info);
    expect(info.getAttribute('aria-expanded')).toBe('true');
    const details = screen.getByRole('region', { name: 'Encouragement & Affirmation Health explanation' });
    expect(within(details).getByText('Each scored Foundation counts equally.')).toBeTruthy();
    expect(within(details).getByRole('img', {
      name: 'Encouragement & Affirmation Health: Not enough data'
    })).toBeTruthy();
    expect(within(details).getByRole('img', { name: 'Consistency: Score unavailable' })).toBeTruthy();
    expect(within(details).getByRole('img', { name: 'On Track: Score unavailable' })).toBeTruthy();
    expect(within(details).getByText('Health combines 75% Consistency and 25% On Track.')).toBeTruthy();
    expect(within(details).getByText('Foundations need both scores to count.')).toBeTruthy();
    expect(details.querySelector('.rhythm-history-view__health-weight-panels')).toBeNull();
    expect(details.querySelector('.health-score-measures__grid')).toBeTruthy();
    await user.click(info);
    expect(info.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById(detailsId)?.hasAttribute('hidden')).toBe(true);
  });

  it('wraps long Category names in the shared heading without changing its accessible label', () => {
    render(
      <CategoryHealthSummary
        categoryLabel="Encouragement and Meaningful Family Connections"
        score={categoryScore()}
      />
    );

    expect(screen.getByRole('heading', {
      name: 'Encouragement and Meaningful Family Connections Health'
    })).toBeTruthy();
    expect(screen.getByRole('button', {
      name: 'Show Encouragement and Meaningful Family Connections scoring explanation'
    })).toBeTruthy();
  });

  it('uses configured Faith Practice terminology and framing without changing score values', async () => {
    const user = userEvent.setup();
    render(
      <CategoryHealthSummary
        categoryLabel="Faith"
        itemTerm={{ singular: 'Practice', plural: 'Practices' }}
        explanationIntro="Your score reflects follow-through on your chosen practices—not the strength of your faith."
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
    expect(screen.getByRole('meter', { name: 'Faith Health score' }).getAttribute('aria-valuenow')).toBe('85');
    expect(screen.queryByText(/Foundations/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Show Faith scoring explanation' }));
    const explanation = screen.getByRole('region', { name: 'Faith Health explanation' });
    expect(within(explanation).getByText(
      'Your score reflects follow-through on your chosen practices—not the strength of your faith.'
    )).toBeTruthy();
    expect(within(explanation).getByText('Each scored Practice counts equally.')).toBeTruthy();
    expect(within(explanation).getByText('Practices need both scores to count.')).toBeTruthy();
    expect(within(explanation).getByText('Health combines 75% Consistency and 25% On Track.')).toBeTruthy();
    expect(within(explanation).getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuenow')).toBe('80');
    expect(within(explanation).getByRole('meter', { name: 'On Track score' }).getAttribute('aria-valuenow')).toBe('100');
  });
});
