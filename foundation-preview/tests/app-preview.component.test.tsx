import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App.tsx';
import { CatalogApp } from '../src/CatalogApp.tsx';
import { localDateString } from '../src/domain/money-goals.ts';
import { PREVIEW_STORAGE_KEY } from '../src/storage/preview-storage.ts';
import { installMemoryStorage } from './memory-storage.ts';

beforeEach(installMemoryStorage);
afterEach(() => {
  cleanup();
  window.localStorage.removeItem(PREVIEW_STORAGE_KEY);
});

describe('Tend Today preview', () => {
  it('composes the shared RhythmCard contract in the app and catalogue views', () => {
    const { container } = render(<App />);
    const todayCard = screen.getByRole('article', { name: 'Pray together' });
    expect(todayCard.classList.contains('rhythm-card')).toBe(true);
    expect(todayCard.querySelector('.today-rhythm-card__actions')).not.toBeNull();
    expect(within(todayCard).getByRole('button', { name: 'Tend' })).toBeTruthy();
    const todayCardCount = container.querySelectorAll('.today-rhythm-card').length;

    cleanup();
    const catalogue = render(<CatalogApp />);
    const catalogueCard = screen.getByRole('article', { name: 'Monthly savings transfer' });
    expect(catalogueCard.classList.contains('rhythm-card')).toBe(true);
    expect(catalogueCard.querySelector('.rhythm-content')).not.toBeNull();
    expect(catalogue.container.querySelectorAll('.rhythm-card')).toHaveLength(1);
    expect(todayCardCount).toBe(3);
  });

  it('records a local Tend action once and keeps the completion in memory', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole('button', { name: 'Tend' })[0]!);

    expect(screen.getByText('1 of 3 tended')).toBeTruthy();
    const completed = screen.getByRole('button', { name: 'Tended ✓' });
    expect(completed.matches(':disabled')).toBe(true);
    expect(completed.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByRole('button', { name: 'Tend' })).toHaveLength(2);
  });

  it('opens an accessible details dialog and restores focus on Escape', async () => {
    const user = userEvent.setup();
    render(<App />);
    const opener = screen.getByRole('button', { name: 'Details for Pray together' });

    await user.click(opener);
    const dialog = await screen.findByRole('dialog', { name: 'Pray together' });
    expect(dialog.querySelector('[data-details-title]')).toBe(document.activeElement);

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(opener);
  });

  it('switches plan tabs and filters the sample Rhythms', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('tab', { name: 'Anytime' }));
    expect(screen.getByRole('tabpanel').textContent).toContain('No anytime Rhythms in this sample.');
    await user.click(screen.getByRole('tab', { name: 'Scheduled' }));

    await user.type(screen.getByRole('searchbox', { name: 'Search sample Rhythms' }), 'walk');
    expect(screen.getByRole('article', { name: 'Take a walk' })).toBeTruthy();
    expect(screen.queryByRole('article', { name: 'Pray together' })).toBeNull();
  });

  it('moves focus and selection through plan tabs with arrows, Home, and End', async () => {
    const user = userEvent.setup();
    render(<App />);

    const scheduled = screen.getByRole('tab', { name: 'Scheduled' });
    const anytime = screen.getByRole('tab', { name: 'Anytime' });
    const allDay = screen.getByRole('tab', { name: 'All-day' });
    const panel = screen.getByRole('tabpanel');

    expect(scheduled.getAttribute('aria-selected')).toBe('true');
    expect(scheduled.getAttribute('tabindex')).toBe('0');
    expect(panel.getAttribute('aria-labelledby')).toBe(scheduled.id);

    scheduled.focus();
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(allDay);
    expect(allDay.getAttribute('aria-selected')).toBe('true');
    expect(allDay.getAttribute('tabindex')).toBe('0');
    expect(scheduled.getAttribute('tabindex')).toBe('-1');

    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(scheduled);
    expect(scheduled.getAttribute('aria-selected')).toBe('true');

    await user.keyboard('{End}');
    expect(document.activeElement).toBe(allDay);
    expect(panel.getAttribute('aria-labelledby')).toBe(allDay.id);

    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(scheduled);
    expect(scheduled.getAttribute('aria-selected')).toBe('true');
    expect(anytime.getAttribute('tabindex')).toBe('-1');
  });

  it('opens Finances examples, adds a direction-validated goal, and records a dated balance', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Finances' }));
    expect(screen.getByRole('heading', { name: 'Goal examples' })).toBeTruthy();
    expect(screen.getByText(/Examples only · taxonomy not finalized/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Add example goal' }));
    const editor = screen.getByRole('dialog', { name: 'Add example goal' });
    await user.type(within(editor).getByLabelText('Title'), 'Car payoff');
    await user.selectOptions(within(editor).getByLabelText('Goal direction'), 'decrease');
    await user.type(within(editor).getByLabelText('Starting balance'), '100.00');
    fireEvent.change(within(editor).getByLabelText('Starting date'), { target: { value: '2026-10-01' } });
    await user.type(within(editor).getByLabelText('Target balance'), '120.00');
    fireEvent.change(within(editor).getByLabelText('Target date'), { target: { value: '2027-01-01' } });
    await user.click(within(editor).getByRole('button', { name: 'Add goal' }));
    expect(within(editor).getByText('A decreasing goal needs a target below its starting balance.')).toBeTruthy();

    const target = within(editor).getByLabelText('Target balance');
    await user.clear(target);
    await user.type(target, '80.00');
    await user.click(within(editor).getByRole('button', { name: 'Add goal' }));

    let goal = screen.getByRole('article', { name: 'Car payoff' });
    expect(within(goal).getByText('No check-ins yet')).toBeTruthy();
    await user.click(within(goal).getByRole('button', { name: 'Record check-in' }));
    const checkIn = screen.getByRole('dialog', { name: 'Record balance check-in' });
    expect((within(checkIn).getByLabelText('Effective date') as HTMLInputElement).value).toBe(localDateString(new Date()));
    await user.type(within(checkIn).getByLabelText('Current balance'), '90.00');
    await user.type(within(checkIn).getByLabelText('Note (optional)'), 'Manual sample observation');
    await user.click(within(checkIn).getByRole('button', { name: 'Save check-in' }));

    expect(within(goal).getByText('$90.00')).toBeTruthy();
    expect(within(goal).getByText('$10.00 remaining')).toBeTruthy();
    expect(within(goal).getByText('Manual sample observation')).toBeTruthy();

    await user.click(within(goal).getByRole('button', { name: 'Edit goal' }));
    const editGoal = screen.getByRole('dialog', { name: 'Edit example goal' });
    const title = within(editGoal).getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Car payoff example');
    await user.click(within(editGoal).getByRole('button', { name: 'Save goal' }));
    goal = screen.getByRole('article', { name: 'Car payoff example' });
    expect(within(goal).getByText('$90.00')).toBeTruthy();
    expect(within(goal).getByText('Manual sample observation')).toBeTruthy();
  });

  it('corrects a same-date check-in with history and restores it after remount', async () => {
    const user = userEvent.setup();
    const openFinances = async () => {
      await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Finances' }));
    };
    render(<App />);
    await openFinances();
    let goal = screen.getByRole('article', { name: 'Starter reserve' });
    await user.click(within(goal).getAllByRole('button', { name: 'Correct' })[0]!);
    const dialog = screen.getByRole('dialog', { name: 'Correct balance check-in' });
    expect(within(dialog).getByRole('status').textContent).toContain('retains the previous value');
    expect(within(dialog).getByRole('status').textContent).toContain('date is fixed');
    expect(within(dialog).getByLabelText('Effective date').hasAttribute('readonly')).toBe(true);
    const balance = within(dialog).getByLabelText('Current balance');
    await user.clear(balance);
    await user.type(balance, '1350.00');
    await user.click(within(dialog).getByRole('button', { name: 'Save correction' }));

    goal = screen.getByRole('article', { name: 'Starter reserve' });
    expect(within(goal).getByText('$1,350.00')).toBeTruthy();
    expect(within(goal).getByText(/previous value \$1,250\.00/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Today' }));
    await openFinances();
    expect(within(screen.getByRole('article', { name: 'Starter reserve' })).getByText('$1,350.00')).toBeTruthy();

    cleanup();
    render(<App />);
    await openFinances();
    expect(within(screen.getByRole('article', { name: 'Starter reserve' })).getByText('$1,350.00')).toBeTruthy();
    expect(within(screen.getByRole('article', { name: 'Starter reserve' })).getByText(/previous value \$1,250\.00/)).toBeTruthy();
  });

  it('routes implemented navigation to an explicit placeholder and back to Today', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    expect(screen.getByRole('heading', { name: 'Marriage' })).toBeTruthy();
    expect(screen.getByText('This destination is not implemented in this preview.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Back to Today' }));
    expect(screen.getByRole('heading', { name: 'Your plan' })).toBeTruthy();
  });

  it('increases the Today text size with the mobile display control', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /text size: small/i }));
    expect(document.documentElement.dataset.mobileTextSize).toBe('large');
    expect(document.documentElement.dataset.mobileTextSizeLevel).toBe('medium');
  });
});
