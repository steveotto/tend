import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FinanceGoalsView } from '../src/components/FinanceGoalsView.tsx';
import { financeFoundation, foundationCatalogue, goals, syntheticPeople, todayRhythms } from '../src/domain/preview-data.ts';
import type { RhythmPreview } from '../src/domain/preview-data.ts';
import type { GoalRhythmAssociationChange, MoneyGoal } from '../src/domain/money-goals.ts';

afterEach(cleanup);

const financeRhythm: RhythmPreview = {
  ...todayRhythms[0]!,
  id: 'finance-savings-review',
  title: 'Review savings transfer',
  cadence: 'Weekly',
  timeLabel: 'Friday',
  categoryIds: ['finances'],
  primaryFoundationId: financeFoundation.id,
  secondaryFoundationIds: []
};

function renderFinance({
  goalData = goals,
  financeCategoryEnabled = true,
  rhythms = [financeRhythm],
  archivedRhythms = []
}: {
  goalData?: readonly MoneyGoal[];
  financeCategoryEnabled?: boolean;
  rhythms?: readonly RhythmPreview[];
  archivedRhythms?: readonly RhythmPreview[];
} = {}) {
  const callbacks = {
    onSaveGoal: vi.fn(),
    onSaveCheckIn: vi.fn(() => ({})),
    onSaveGoalRhythms: vi.fn((_goalId: string, _changes: readonly GoalRhythmAssociationChange[]) => null),
    onSaveFoundationAssociations: vi.fn(() => null),
    onAddLinkedRhythm: vi.fn(),
    onCreateRhythmFromGoal: vi.fn(),
    onTendRhythm: vi.fn(),
    onUndoRhythm: vi.fn(),
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
      financeFoundation={financeFoundation}
      financeCategoryEnabled={financeCategoryEnabled}
      rhythms={rhythms}
      archivedRhythms={archivedRhythms}
      categoryRhythms={rhythms}
      archivedCategoryRhythms={archivedRhythms}
      people={syntheticPeople}
      foundations={foundationCatalogue}
      rhythmScores={new Map()}
      archivedRhythmIds={archivedRhythms.map(rhythm => rhythm.id)}
      completedRhythms={new Set()}
      undoableRhythms={new Set()}
      onSaveGoal={callbacks.onSaveGoal}
      onSaveCheckIn={callbacks.onSaveCheckIn}
      onSaveGoalRhythms={callbacks.onSaveGoalRhythms}
      onSaveFoundationAssociations={callbacks.onSaveFoundationAssociations}
      onAddLinkedRhythm={callbacks.onAddLinkedRhythm}
      onCreateRhythmFromGoal={callbacks.onCreateRhythmFromGoal}
      onTendRhythm={callbacks.onTendRhythm}
      onUndoRhythm={callbacks.onUndoRhythm}
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
  it('defaults to Overview, keeps balances separate, and navigates to Goals', async () => {
    const user = userEvent.setup();
    renderFinance();

    expect(screen.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Savings' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Debt' })).toBeTruthy();
    const overview = screen.getByRole('tabpanel', { name: 'Overview' });
    expect(within(overview).getByText('$1,250.00')).toBeTruthy();
    expect(within(overview).getByText('$6,800.00')).toBeTruthy();
    expect(within(overview).getByText(/Savings increased by \$125\.00/)).toBeTruthy();
    expect(within(overview).getByText(/Debt reduced by \$200\.00/)).toBeTruthy();
    expect(screen.queryByText(/combined total/i)).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Goals' }));
    expect(screen.getByRole('tab', { name: 'Goals' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('heading', { name: 'My goals' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '+ Add' })).toBeTruthy();
  });

  it('uses the shared arrow, Home, and End keyboard pattern for panel tabs', async () => {
    const user = userEvent.setup();
    renderFinance();
    const overview = screen.getByRole('tab', { name: 'Overview' });
    const goalsTab = screen.getByRole('tab', { name: 'Goals' });
    const rhythmsTab = screen.getByRole('tab', { name: 'Rhythms' });

    overview.focus();
    await user.keyboard('{ArrowRight}');
    expect(goalsTab.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(goalsTab);
    await user.keyboard('{End}');
    expect(rhythmsTab.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{ArrowRight}');
    expect(overview.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{Home}');
    expect(overview.getAttribute('aria-selected')).toBe('true');
  });

  it('shows missing balances as unavailable rather than zero', () => {
    renderFinance({ goalData: goals.map(goal => ({ ...goal, checkIns: [] })) });
    expect(screen.getAllByText('Unavailable')).toHaveLength(4);
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
    expect(within(card).getByRole('button', { name: 'Add a supporting Rhythm' })).toBeTruthy();
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
    expect(within(details).getByRole('img', { name: /Planned linear trajectory/ })).toBeTruthy();
    expect(within(details).getByRole('region', { name: 'Balance check-ins for Starter reserve' })).toBeTruthy();
    await user.click(within(details).getByRole('button', { name: 'Close goal details' }));
    await waitFor(() => expect(document.activeElement).toBe(detailsTrigger));
  });

  it('keeps check-in corrections, correction history, edit, and Rhythm links available in details', async () => {
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
    expect(within(details).getByText('Unavailable saved reference: missing-rhythm')).toBeTruthy();
    expect(within(details).getByText('Linked to the Finance Foundation.')).toBeTruthy();

    await user.click(within(details).getAllByRole('button', { name: 'Correct' })[0]!);
    expect(screen.getByRole('dialog', { name: 'Correct balance check-in' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    details = screen.getByRole('dialog', { name: 'Starter reserve' });
    await user.click(within(details).getByRole('button', { name: 'Edit goal' }));
    expect(screen.getByRole('dialog', { name: 'Edit goal' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    details = screen.getByRole('dialog', { name: 'Starter reserve' });
    await user.click(within(details).getByRole('button', { name: 'Manage supporting Rhythms' }));
    expect(screen.getByRole('dialog', { name: 'Supporting Rhythms' })).toBeTruthy();
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

  it('saves an explicit goal-to-Rhythm link without tending or scoring the Rhythm', async () => {
    const user = userEvent.setup();
    const { callbacks } = renderFinance();
    await user.click(screen.getByRole('tab', { name: 'Goals' }));
    await user.click(screen.getAllByRole('button', { name: 'Add a supporting Rhythm' })[0]!);

    const dialog = screen.getByRole('dialog', { name: 'Supporting Rhythms' });
    expect(within(dialog).getByText(/Goal links do not qualify Rhythms for scoring/)).toBeTruthy();
    const checkbox = within(dialog).getByRole('checkbox', { name: /Review savings transfer/ });
    await user.click(checkbox);
    await user.click(within(dialog).getByRole('button', { name: 'Save links' }));

    expect(callbacks.onSaveGoalRhythms).toHaveBeenCalledWith(
      goals[0]!.id,
      [{ rhythmId: financeRhythm.id, linked: true }]
    );
    expect(callbacks.onTendRhythm).not.toHaveBeenCalled();
    expect(callbacks.onSaveGoal).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Supporting Rhythms' })).toBeNull();
  });

  it('closes goal-link management before starting the shared Rhythm editor', async () => {
    const user = userEvent.setup();
    const { callbacks } = renderFinance();
    await user.click(screen.getByRole('tab', { name: 'Goals' }));
    await user.click(screen.getAllByRole('button', { name: 'Add a supporting Rhythm' })[0]!);
    const dialog = screen.getByRole('dialog', { name: 'Supporting Rhythms' });
    await user.click(within(dialog).getByRole('button', { name: 'Create a Finance Rhythm' }));

    expect(callbacks.onCreateRhythmFromGoal).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Supporting Rhythms' })).toBeNull();
  });

  it('does not treat a goal link as a Foundation link or a Finance Health contributor', async () => {
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
    expect(within(panel).getByText('No Rhythms are linked to Finances yet.')).toBeTruthy();
    expect(within(panel).queryByText('Review savings transfer')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Health' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Finance Health: Not enough data' })).toBeTruthy();
  });

  it('retains existing goal links while Finances is disabled and offers no new eligible link', async () => {
    const user = userEvent.setup();
    const linkedGoal = { ...goals[0]!, supportingRhythmIds: [financeRhythm.id] };
    renderFinance({
      financeCategoryEnabled: false,
      goalData: [linkedGoal],
      rhythms: [financeRhythm]
    });
    await user.click(screen.getByRole('tab', { name: 'Goals' }));
    await user.click(screen.getByRole('button', { name: 'View details for Starter reserve' }));
    await user.click(screen.getByRole('button', { name: 'Manage supporting Rhythms' }));

    const dialog = screen.getByRole('dialog', { name: 'Supporting Rhythms' });
    expect(within(dialog).getByRole('status').textContent).toMatch(/Finances is disabled/);
    expect((within(dialog).getByRole('checkbox', { name: /Review savings transfer/ }) as HTMLInputElement).checked).toBe(true);
    expect(within(dialog).queryByRole('button', { name: 'Create a Finance Rhythm' })).toBeNull();
  });
});
