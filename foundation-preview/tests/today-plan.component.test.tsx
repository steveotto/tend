import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TodayView } from '../src/components/TodayView.tsx';
import type { TodayFocusId } from '../src/domain/today-plan.ts';
import { foundationCatalogue, todayRhythms } from '../src/domain/preview-data.ts';

afterEach(cleanup);

function TodayHarness() {
  const [focus, setFocus] = useState<TodayFocusId>('now');
  return (
    <TodayView
      greeting="Good morning"
      dateLabel="Saturday, October 31"
      evaluationInstant={new Date(2026, 9, 31, 10, 0)}
      localDate="2026-10-31"
      focus={focus}
      onFocusChange={setFocus}
      completedRhythms={new Set(['sample-pray-together'])}
      undoableRhythms={new Set()}
      rhythms={todayRhythms}
      rhythmScores={new Map()}
      search=""
      marriageExampleId="empty"
      onNavigate={vi.fn()}
      onMarriageExampleChange={vi.fn()}
      onPersonSelect={vi.fn()}
      foundations={foundationCatalogue}
      onOpenFoundation={vi.fn()}
      onHistory={vi.fn()}
      onTend={vi.fn()}
      onEditRhythm={vi.fn()}
      onUndo={vi.fn()}
    />
  );
}

function renderToday() {
  return render(<TodayHarness />);
}

describe('Today time-frame interaction', () => {
  it('defaults to Now, counts only the selected range, and keeps the selected block during the visit', async () => {
    const user = userEvent.setup();
    renderToday();
    const plan = screen.getByRole('region', { name: "Today's plan" });
    expect(within(plan).getByText('Now', { selector: 'summary span' })).toBeTruthy();
    expect(within(plan).getByText('Morning · 9:00am – 11:30am')).toBeTruthy();
    expect(within(plan).getByText('1 of 1 tended')).toBeTruthy();
    expect(within(plan).getByRole('article', { name: 'Pray together' })).toBeTruthy();
    expect(within(plan).queryByRole('article', { name: 'Daily connection' })).toBeNull();
    expect(within(plan).queryByRole('heading', { name: 'Your plan' })).toBeNull();

    await user.click(within(plan).getByText('Now', { selector: 'summary span' }));
    await user.click(within(plan).getByRole('button', { name: /Evening/ }));

    expect(within(plan).getByText('Evening · 6:00pm – 9:30pm')).toBeTruthy();
    expect(within(plan).getByText('0 of 1 tended')).toBeTruthy();
    expect(within(plan).getByRole('article', { name: 'Daily connection' })).toBeTruthy();
    expect(within(plan).queryByRole('article', { name: 'Pray together' })).toBeNull();
  });

  it('offers Everything today and the three preserved item-type tabs with ARIA selection', async () => {
    const user = userEvent.setup();
    renderToday();
    const plan = screen.getByRole('region', { name: "Today's plan" });
    await user.click(within(plan).getByText('Now', { selector: 'summary span' }));
    await user.click(within(plan).getByRole('button', { name: /Everything today/ }));

    expect(within(plan).getByText('1 of 3 tended')).toBeTruthy();
    for (const name of ['Pray together', 'Daily connection', 'Take a walk']) {
      expect(within(plan).getByRole('article', { name })).toBeTruthy();
    }
    for (const tabName of ['Scheduled', 'Anytime', 'All-day']) {
      expect(within(plan).getByRole('tab', { name: tabName })).toBeTruthy();
    }
    expect(within(plan).getByRole('tab', { name: 'Scheduled' }).getAttribute('aria-selected')).toBe('true');

    await user.click(within(plan).getByRole('tab', { name: 'Anytime' }));
    expect(within(plan).getByRole('tab', { name: 'Anytime' }).getAttribute('aria-selected')).toBe('true');
    expect(within(plan).getByText('No preferred time')).toBeTruthy();
    expect(within(plan).getByRole('status').textContent).toBe('No eligible Anytime rhythms.');
  });
});
