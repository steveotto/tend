import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FinanceGoalsView } from '../src/components/FinanceGoalsView.tsx';
import {
  FINANCE_PLANNING_SPENDING_ID,
  FINANCE_SAVING_RESERVES_ID,
  financeFoundations,
  foundationCatalogue,
  goals,
  syntheticPeople,
  todayRhythms
} from '../src/domain/preview-data.ts';
import type { RhythmPreview } from '../src/domain/preview-data.ts';
import type { MoneyGoal } from '../src/domain/money-goals.ts';
import type { CategoryRhythmSuggestionCatalogue } from '../src/components/MarriageView.tsx';

afterEach(cleanup);

const financeSuggestionCatalogue: CategoryRhythmSuggestionCatalogue = {
  title: 'Finance rhythm suggestions',
  groups: [{
    id: 'weekly',
    title: 'Weekly',
    subtitle: 'Give regular attention to everyday money decisions.',
    suggestions: [{
      sourceId: 'finances.review-budget',
      categoryId: 'finances',
      rhythm: {
        id: 'finances.review-budget',
        title: 'Review your budget',
        description: 'Review planned spending and adjust upcoming choices as needed.',
        cadence: 'Weekly',
        timeLabel: 'Anytime',
        automation: 'manual',
        status: 'Not confirmed',
        primaryFoundationId: FINANCE_PLANNING_SPENDING_ID,
        secondaryFoundationIds: [],
        categoryIds: ['finances']
      },
      scheduleHint: 'Weekly · Flexible',
      icon: null,
      recommendedFrequency: 'weekly'
    }]
  }]
};

const financeRhythm: RhythmPreview = {
  ...todayRhythms[0]!,
  id: 'finance-savings-review',
  title: 'Review savings transfer',
  cadence: 'Weekly',
  timeLabel: 'Friday',
  categoryIds: ['finances'],
  primaryFoundationId: FINANCE_SAVING_RESERVES_ID,
  secondaryFoundationIds: []
};

function renderFinance({
  goalData = goals,
  rhythms = [financeRhythm],
  archivedRhythms = [],
  categoryRhythms = rhythms,
  archivedCategoryRhythms = archivedRhythms,
  suggestionCatalogue = financeSuggestionCatalogue
}: {
  goalData?: readonly MoneyGoal[];
  rhythms?: readonly RhythmPreview[];
  archivedRhythms?: readonly RhythmPreview[];
  categoryRhythms?: readonly RhythmPreview[];
  archivedCategoryRhythms?: readonly RhythmPreview[];
  suggestionCatalogue?: CategoryRhythmSuggestionCatalogue;
} = {}) {
  const callbacks = {
    onSaveGoal: vi.fn(),
    onSaveCheckIn: vi.fn(() => ({})),
    onSaveFoundationAssociations: vi.fn(() => null),
    onAddLinkedRhythm: vi.fn(),
    onAddRhythm: vi.fn(),
    onAddSuggestion: vi.fn(),
    onTendRhythm: vi.fn(),
    onUndoRhythm: vi.fn(),
    onRestoreRhythm: vi.fn(),
    onEditRhythm: vi.fn(),
    onRhythmHistory: vi.fn(),
    onPersonSelect: vi.fn(),
    onOpenFoundation: vi.fn(),
    onOpenCategory: vi.fn(),
    onToday: vi.fn()
  };
  const view = render(
    <FinanceGoalsView
      goals={goalData}
      currentDate="2026-10-21"
      financeFoundations={financeFoundations}
      rhythms={rhythms}
      archivedRhythms={archivedRhythms}
      categoryRhythms={categoryRhythms}
      archivedCategoryRhythms={archivedCategoryRhythms}
      suggestionCatalogue={suggestionCatalogue}
      people={syntheticPeople}
      foundations={foundationCatalogue}
      rhythmScores={new Map()}
      archivedRhythmIds={archivedRhythms.map(rhythm => rhythm.id)}
      completedRhythms={new Set()}
      undoableRhythms={new Set()}
      onSaveGoal={callbacks.onSaveGoal}
      onSaveCheckIn={callbacks.onSaveCheckIn}
      onSaveFoundationAssociations={callbacks.onSaveFoundationAssociations}
      onAddLinkedRhythm={callbacks.onAddLinkedRhythm}
      onAddRhythm={callbacks.onAddRhythm}
      onAddSuggestion={callbacks.onAddSuggestion}
      onTendRhythm={callbacks.onTendRhythm}
      onUndoRhythm={callbacks.onUndoRhythm}
      onRestoreRhythm={callbacks.onRestoreRhythm}
      onEditRhythm={callbacks.onEditRhythm}
      onRhythmHistory={callbacks.onRhythmHistory}
      onPersonSelect={callbacks.onPersonSelect}
      onOpenFoundation={callbacks.onOpenFoundation}
      onOpenCategory={callbacks.onOpenCategory}
      onToday={callbacks.onToday}
    />
  );
  return { ...view, callbacks };
}

describe('Finance goals view', () => {
  it('shows five shared Foundation cards and opens a Foundation detail with Health and linked Rhythms', async () => {
    const user = userEvent.setup();
    const { callbacks } = renderFinance();
    const foundations = screen.getByRole('tabpanel', { name: 'Foundations' });
    const home = screen.getByRole('button', { name: 'Home' });
    expect(home.className).toContain('tend-back-button--plain');
    await user.click(home);
    expect(callbacks.onToday).toHaveBeenCalledOnce();
    for (const name of [
      'Planning & Spending',
      'Saving & Reserves',
      'Debt Reduction',
      'Investing & Future',
      'Generosity'
    ]) {
      expect(within(foundations).getByRole('button', { name: new RegExp(`Open ${name}`) })).toBeTruthy();
    }

    await user.click(within(foundations).getByRole('button', { name: /Open Saving & Reserves/ }));
    expect(screen.getByRole('heading', { name: 'Saving & Reserves' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Finances' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Home' })).toBeNull();
    expect(screen.getByRole('main').querySelector('.category-header--hero')).toBeNull();
    expect(screen.getByRole('button', { name: 'Back to Finance Foundations' }).className)
      .toContain('tend-back-button--plain');
    expect(screen.getByRole('img', { name: 'Saving & Reserves Health: Not enough data' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Linked Rhythms · 1' })).toBeTruthy();
    expect(screen.getByText('Review savings transfer')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Add Rhythm' }));
    expect(callbacks.onAddLinkedRhythm).toHaveBeenCalledWith(
      FINANCE_SAVING_RESERVES_ID,
      expect.any(Object)
    );
    await user.click(screen.getByRole('button', { name: 'Back to Finance Foundations' }));
    expect(screen.getByRole('heading', { name: 'Finances' })).toBeTruthy();
    expect(screen.getByRole('tabpanel', { name: 'Foundations' })).toBeTruthy();
  });

  it('defaults to Foundations and keeps the Foundation panel focused while Goals retain balances', async () => {
    const user = userEvent.setup();
    renderFinance();

    expect(screen.getByRole('tab', { name: 'Foundations' }).getAttribute('aria-selected')).toBe('true');
    const foundations = screen.getByRole('tabpanel', { name: 'Foundations' });
    const foundationList = foundations.querySelector('.marriage-foundation-list');
    expect(within(foundations).queryByRole('heading', { name: 'Overview' })).toBeNull();
    expect(foundations.children).toHaveLength(1);
    expect(foundations.firstElementChild).toBe(foundationList);
    expect(foundationList?.querySelectorAll('.foundation-card')).toHaveLength(5);
    expect(within(foundations).queryByText(/Balances are manually tracked values/)).toBeNull();
    expect(foundations.querySelector('.strength-section-heading')).toBeNull();
    expect(screen.getByRole('button', { name: 'Home' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back to Today' })).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Goals' }));
    expect(screen.getByRole('tab', { name: 'Goals' }).getAttribute('aria-selected')).toBe('true');
    const progressTracker = screen.getByRole('region', { name: 'Progress tracker' });
    expect(within(progressTracker).getByText(
      'Dated check-ins update progress; completing a Rhythm never changes a goal balance.'
    )).toBeTruthy();
    expect(within(progressTracker).getByText('Goal balances don’t change your Health score.')).toBeTruthy();
    expect(within(progressTracker).getByText(/Balances are manually tracked values, not bank balances or a complete financial picture/)).toBeTruthy();
    const savingsGoal = within(progressTracker).getByRole('article', { name: 'Starter reserve' });
    const debtGoal = within(progressTracker).getByRole('article', { name: 'Debt payoff' });
    expect(within(savingsGoal).getByText('$1,250.00')).toBeTruthy();
    expect(within(debtGoal).getByText('$6,800.00')).toBeTruthy();
    expect(within(progressTracker).getByRole('button', { name: '+ Add' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back to Today' })).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    expect(screen.getByRole('heading', { name: 'Your Rhythms' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Home' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back to Today' })).toBeNull();
  });

  it('uses the shared arrow, Home, and End keyboard pattern for panel tabs', async () => {
    const user = userEvent.setup();
    renderFinance();
    const foundations = screen.getByRole('tab', { name: 'Foundations' });
    const goalsTab = screen.getByRole('tab', { name: 'Goals' });
    const rhythmsTab = screen.getByRole('tab', { name: 'Rhythms' });

    foundations.focus();
    await user.keyboard('{ArrowRight}');
    expect(goalsTab.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(goalsTab);
    await user.keyboard('{End}');
    expect(rhythmsTab.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{ArrowRight}');
    expect(foundations.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{Home}');
    expect(foundations.getAttribute('aria-selected')).toBe('true');
  });

  it('keeps Finance-category Rhythm membership separate from scoring eligibility and supports shared add/archive controls', async () => {
    const user = userEvent.setup();
    const categoryOnlyRhythm = {
      ...financeRhythm,
      id: 'finance-category-only',
      title: 'Unlinked Finance routine',
      primaryFoundationId: null,
      secondaryFoundationIds: []
    };
    const linkedOutsideFinanceCategory = {
      ...financeRhythm,
      id: 'finance-linked-outside-category',
      title: 'Linked but not Finance-category',
      categoryIds: ['health'] as const
    };
    const archivedFinanceRhythm = {
      ...categoryOnlyRhythm,
      id: 'archived-finance-routine',
      title: 'Archived Finance routine'
    };
    const { callbacks } = renderFinance({
      rhythms: [financeRhythm, categoryOnlyRhythm, linkedOutsideFinanceCategory],
      archivedRhythms: [archivedFinanceRhythm],
      categoryRhythms: [financeRhythm, categoryOnlyRhythm],
      archivedCategoryRhythms: [archivedFinanceRhythm]
    });

    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    const panel = screen.getByRole('tabpanel', { name: 'Rhythms' });
    expect(within(panel).getByText('Review savings transfer')).toBeTruthy();
    expect(within(panel).getByText('Unlinked Finance routine')).toBeTruthy();
    expect(within(panel).queryByText('Linked but not Finance-category')).toBeNull();
    expect(within(panel).getByText(
      'Finance-category Rhythms are listed here; only eligible linked Rhythms affect Finance Health.'
    )).toBeTruthy();

    await user.click(within(panel).getByRole('button', { name: 'Add Rhythm' }));
    expect(callbacks.onAddRhythm).toHaveBeenCalledOnce();
    const suggestions = within(panel).getByRole('button', { name: 'Suggestions' });
    expect((suggestions as HTMLButtonElement).disabled).toBe(false);
    expect(suggestions.getAttribute('title')).toBeNull();
    await user.click(suggestions);
    const picker = screen.getByRole('dialog', { name: 'Finance rhythm suggestions' });
    expect(within(picker).getByText('Review your budget')).toBeTruthy();
    await user.click(within(picker).getByRole('button', { name: 'Add' }));
    expect(callbacks.onAddSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: 'finances.review-budget',
        categoryId: 'finances',
        rhythm: expect.objectContaining({
          primaryFoundationId: FINANCE_PLANNING_SPENDING_ID
        })
      }),
      expect.anything(),
      expect.any(Function)
    );

    const archiveOpener = within(panel).getByRole('button', { name: 'Archived rhythms (1)' });
    await user.click(archiveOpener);
    const archive = document.querySelector<HTMLDialogElement>('.archived-rhythms-dialog');
    expect(archive).toBeTruthy();
    expect(within(archive!).getByRole('heading', { name: 'Archived rhythms' })).toBeTruthy();
    expect(within(archive!).getByText('Archived Finance routine')).toBeTruthy();
    await user.click(within(archive!).getByRole('button', { name: 'Restore rhythm Archived Finance routine' }));
    expect(callbacks.onRestoreRhythm).toHaveBeenCalledWith('archived-finance-routine');
    await user.click(within(archive!).getByRole('button', { name: 'Close archived rhythms' }));
    await waitFor(() => expect(document.activeElement).toBe(archiveOpener));

    await user.click(screen.getByRole('tab', { name: 'Goals' }));
    const goal = screen.getByRole('article', { name: 'Starter reserve' });
    expect(within(goal).queryByRole('button', { name: /supporting Rhythm/i })).toBeNull();
  });

  it('shows missing balances as unavailable rather than zero', () => {
    renderFinance({ goalData: goals.map(goal => ({ ...goal, checkIns: [] })) });
    expect(screen.getAllByText('Unavailable')).toHaveLength(2);
    expect(screen.getAllByText('Remaining amount unavailable until a check-in.')).toHaveLength(2);
    expect(screen.queryByText('$0.00')).toBeNull();
  });

  it('uses compact accessible goal cards with direct check-in and details actions', async () => {
    const user = userEvent.setup();
    renderFinance();
    await user.click(screen.getByRole('tab', { name: 'Goals' }));

    const card = screen.getByRole('article', { name: 'Starter reserve' });
    expect(within(card).getByText('Savings increase')).toBeTruthy();
    expect(within(card).getByText('$1,250.00')).toBeTruthy();
    expect(within(card).queryByRole('button', { name: /supporting Rhythm/i })).toBeNull();
    expect(within(card).getByRole('progressbar', { name: 'Progress toward Starter reserve' })).toBeTruthy();
    expect(card.querySelector('button button')).toBeNull();

    const checkIn = within(card).getByRole('button', { name: 'Check in' });
    await user.click(checkIn);
    expect(screen.getByRole('dialog', { name: 'Record balance check-in' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(document.activeElement).toBe(checkIn));

    const detailsTrigger = within(card).getByRole('button', { name: 'View details for Starter reserve' });
    await user.click(detailsTrigger);
    const details = screen.getByRole('dialog', { name: 'Starter reserve' });
    expect(details.classList.contains('dialog--phone-fullscreen')).toBe(true);
    const insights = within(details).getByRole('region', { name: 'Balance progress' });
    expect(within(insights).getByText('Goal balances don’t change your Health score.')).toBeTruthy();
    expect(within(insights).getByRole('article', { name: 'Starter reserve' })).toBeTruthy();
    expect(details.querySelector('h2')?.closest('.tool-zone')).toBeNull();
    expect(within(details).getByRole('img', { name: /Planned linear trajectory/ })).toBeTruthy();
    expect(within(details).getByRole('region', { name: 'Balance check-ins for Starter reserve' })).toBeTruthy();
    await user.click(within(details).getByRole('button', { name: 'Close goal details' }));
    await waitFor(() => expect(document.activeElement).toBe(detailsTrigger));
  });

  it('uses the goal insights zone for savings and debt details with empty and recorded check-ins', async () => {
    const user = userEvent.setup();
    const examples = [
      { ...goals[0]!, checkIns: [] },
      goals[1]!
    ];

    for (const goal of examples) {
      const view = renderFinance({ goalData: [goal] });
      await user.click(screen.getByRole('tab', { name: 'Goals' }));
      await user.click(screen.getByRole('button', { name: `View details for ${goal.title}` }));
      const details = screen.getByRole('dialog', { name: goal.title });
      const insights = within(details).getByRole('region', { name: 'Balance progress' });
      const trajectory = within(insights).getByRole('img', { name: /Planned linear trajectory/ });
      expect(trajectory.getAttribute('aria-label')).toContain(
        `${goal.checkIns.length} dated observed balance check-in`
      );
      if (goal.checkIns.length === 0) {
        expect(within(insights).getByText('No sample check-ins yet. Record an observed balance to begin.')).toBeTruthy();
      } else {
        expect(within(insights).getByText('Recorded check-ins')).toBeTruthy();
        expect(within(insights).getByText('$6,800.00')).toBeTruthy();
      }
      await user.click(within(details).getByRole('button', { name: 'Close goal details' }));
      view.unmount();
    }
  });

  it('keeps check-ins, correction history, and editing available without exposing legacy Rhythm links', async () => {
    const user = userEvent.setup();
    const goal = {
      ...goals[0]!,
      supportingRhythmIds: [financeRhythm.id, 'missing-rhythm'],
      correctionHistory: [{
        effectiveDate: '2026-10-18',
        previousBalanceMinor: 120000,
        previousNote: 'Prior observed amount',
        replacedAt: '2026-10-21T12:00:00.000Z'
      }]
    };
    renderFinance({ goalData: [goal] });
    await user.click(screen.getByRole('tab', { name: 'Goals' }));
    await user.click(screen.getByRole('button', { name: 'View details for Starter reserve' }));

    let details = screen.getByRole('dialog', { name: 'Starter reserve' });
    expect(within(details).getByRole('region', { name: 'Correction history for Starter reserve' })).toBeTruthy();
    expect(within(details).queryByText(/Unavailable saved reference/)).toBeNull();
    expect(within(details).queryByText(/Supporting Rhythms/)).toBeNull();
    expect(within(details).queryByRole('button', { name: /supporting Rhythm/i })).toBeNull();
    expect(within(details).getByText('Goal balances don’t change your Health score.')).toBeTruthy();

    await user.click(within(details).getAllByRole('button', { name: 'Correct' })[0]!);
    expect(screen.getByRole('dialog', { name: 'Correct balance check-in' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    details = screen.getByRole('dialog', { name: 'Starter reserve' });
    await user.click(within(details).getByRole('button', { name: 'Edit goal' }));
    expect(screen.getByRole('dialog', { name: 'Edit goal' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    details = screen.getByRole('dialog', { name: 'Starter reserve' });
  });

  it('opens a supported template as an editable draft without adding unsupported balance types', async () => {
    const user = userEvent.setup();
    renderFinance();
    await user.click(screen.getByRole('tab', { name: 'Goals' }));
    await user.click(screen.getByRole('button', { name: '+ Add' }));

    const library = screen.getByRole('dialog', { name: 'Add a goal' });
    expect(within(library).getByRole('heading', { name: 'Create your own' })).toBeTruthy();
    expect(within(library).getByRole('link', { name: /Ramsey Solutions/ }).getAttribute('href'))
      .toBe('https://www.ramseysolutions.com/dave-ramsey-7-baby-steps');
    expect(within(library).queryByText(/retirement contribution target/i)).toBeNull();
    expect(within(library).getByText(/Ongoing contributions, spending limits, and giving flows/)).toBeTruthy();

    await user.click(within(library).getByRole('button', { name: 'Customize Starter emergency fund' }));
    const editor = screen.getByRole('dialog', { name: 'Create goal' });
    expect((within(editor).getByLabelText('Title') as HTMLInputElement).value).toBe('Starter emergency fund');
    expect((within(editor).getByLabelText('Goal type') as HTMLSelectElement).value).toBe('increase');
    expect((within(editor).getByLabelText('Target balance') as HTMLInputElement).value).toBe('1000.00');
    expect(screen.getByRole('button', { name: 'Close goal editor' })).toBeTruthy();
  });

  it('does not treat hidden legacy goal Rhythm IDs as Foundation links or Finance Health contributors', async () => {
    const user = userEvent.setup();
    const goalWithLink = { ...goals[0]!, supportingRhythmIds: [financeRhythm.id] };
    const rhythmWithoutFoundation = {
      ...financeRhythm,
      primaryFoundationId: null,
      secondaryFoundationIds: []
    };
    renderFinance({
      goalData: [goalWithLink],
      rhythms: [rhythmWithoutFoundation]
    });

    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    const panel = screen.getByRole('tabpanel', { name: 'Rhythms' });
    expect(within(panel).getByText('Review savings transfer')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Health' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Finance Health: Not enough data' })).toBeTruthy();
  });

});
