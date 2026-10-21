import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CatalogApp } from '../src/CatalogApp.tsx';
import { FoundationCard, GoalCard, RhythmCard } from '../src/components/Cards.tsx';
import { financeFoundation, goals, marriageFoundation, rhythms } from '../src/domain/preview-data.ts';

afterEach(cleanup);

describe('shared preview components', () => {
  it('shows an ongoing Marriage foundation without a completion action', () => {
    render(<FoundationCard foundation={marriageFoundation} />);

    expect(screen.getByRole('heading', { name: 'Connection' })).toBeTruthy();
    expect(screen.getByText('Ongoing', { selector: '.lifecycle-badge' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /mark milestone complete/i })).toBeNull();
  });

  it('supports an explicit local lifecycle change for a completable Finance milestone', () => {
    const { rerender } = render(
      <FoundationCard foundation={financeFoundation} onComplete={() => undefined} />
    );

    expect(screen.getByText('In progress')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark milestone complete' })).toBeTruthy();
    rerender(
      <FoundationCard
        foundation={financeFoundation}
        lifecycle="completed"
        onReopen={() => undefined}
      />
    );
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reopen milestone' })).toBeTruthy();
  });

  it('uses the same goal-card structure for increasing savings and decreasing debt', () => {
    const { container } = render(
      <>
        {goals.map(goal => <GoalCard goal={goal} key={goal.id} />)}
      </>
    );

    expect(container.querySelectorAll('.goal-card')).toHaveLength(2);
    expect(screen.getByText(/Savings goal · USD/)).toBeTruthy();
    expect(screen.getByText(/Debt goal · USD/)).toBeTruthy();
    expect(screen.getByText('$1,250.00')).toBeTruthy();
    expect(screen.getByText('$6,800.00')).toBeTruthy();
    expect(screen.getByText(/Target balance · Dec 31, 2027/)).toBeTruthy();
  });

  it('labels bank automation without implying a completion or balance change', () => {
    const rhythm = rhythms[0]!;
    const { rerender } = render(<RhythmCard rhythm={rhythm} />);
    const catalogueCard = screen.getByRole('article', { name: rhythm.title });
    expect(within(catalogueCard).getByRole('heading', { name: rhythm.title, level: 3 })).toBeTruthy();
    expect(within(catalogueCard).getByText(rhythm.description)).toBeTruthy();
    expect(within(catalogueCard).getByText('Automated at bank')).toBeTruthy();
    expect(within(catalogueCard).getByText(/Not confirmed/, { selector: '.rhythm-cadence' })).toBeTruthy();
    expect(within(catalogueCard).queryByRole('button')).toBeNull();

    rerender(
      <RhythmCard
        rhythm={rhythm}
        variant="today"
        onTend={() => undefined}
        onDetails={() => undefined}
      />
    );
    const todayCard = screen.getByRole('article', { name: rhythm.title });
    expect(within(todayCard).getByRole('heading', { name: rhythm.title, level: 3 })).toBeTruthy();
    expect(within(todayCard).getByText(rhythm.description)).toBeTruthy();
    expect(within(todayCard).getByText('Automated at bank')).toBeTruthy();
    const todayMetadata = todayCard.querySelector('.rhythm-card__meta')?.textContent ?? '';
    expect(todayMetadata).toContain(rhythm.cadence);
    expect(todayMetadata).toContain(rhythm.timeLabel);
    expect(within(todayCard).getByRole('button', { name: 'Tend' })).toBeTruthy();
    expect(within(todayCard).getByRole('button', { name: 'Details for Monthly savings transfer' })).toBeTruthy();
  });

  it('changes only the local fixture through a keyboard-operable milestone action', async () => {
    const user = userEvent.setup();
    render(<CatalogApp />);

    await user.tab();
    await user.tab();
    const completeButton = screen.getByRole('button', { name: 'Mark milestone complete' });
    expect(document.activeElement).toBe(completeButton);
    await user.keyboard('{Enter}');

    expect(screen.getByText('Completed')).toBeTruthy();
    expect(screen.getByText(/Not confirmed/, { selector: '.rhythm-cadence' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Reopen milestone' }));
    expect(screen.getByText('In progress')).toBeTruthy();
  });
});
