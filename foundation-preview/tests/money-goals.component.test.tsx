import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GoalCard } from '../src/components/Cards.tsx';
import { TimelineChart } from '../src/components/TimelineChart.tsx';
import {
  formatMoney,
  goalProgressPercentage,
  goalDraftFrom,
  goalFromDraft,
  goalTimeline,
  latestCheckIn,
  localDateString,
  parseMoneyInput,
  remainingAmount,
  saveCheckIn,
  validateCheckInDraft,
  type GoalDraft,
  type MoneyGoal
} from '../src/domain/money-goals.ts';
import { goals } from '../src/domain/preview-data.ts';
import {
  createPreviewEnvelope,
  createSamplePreviewData,
  validatePreviewEnvelope
} from '../src/domain/preview-state.ts';

afterEach(cleanup);

const savings = goals[0]!;

describe('money goal domain', () => {
  it('parses and formats currency using integer minor units without floating point rounding', () => {
    expect(parseMoneyInput('12.3', 'USD')).toBe(1230);
    expect(parseMoneyInput('12.345', 'USD')).toBeNull();
    expect(parseMoneyInput('12', 'JPY')).toBe(12);
    expect(parseMoneyInput('1.234', 'KWD')).toBe(1234);
    expect(parseMoneyInput('1.2', 'ZZZ')).toBeNull();
    expect(formatMoney(1234, 'USD')).toBe('$12.34');
    expect(formatMoney(9_007_199_254_740_991, 'USD')).toBe('$90,071,992,547,409.91');
  });

  it('uses the local calendar date even when UTC is on the next day', () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    try {
      const beforeLocalMidnight = new Date('2026-10-21T01:30:00.000Z');
      expect(beforeLocalMidnight.toISOString().slice(0, 10)).toBe('2026-10-21');
      expect(localDateString(beforeLocalMidnight)).toBe('2026-10-20');
      expect(localDateString(new Date(2026, 9, 21, 0, 0, 0))).toBe('2026-10-21');
    } finally {
      if (previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimezone;
    }
  });

  it('validates explicit savings/debt direction and dates when constructing a goal', () => {
    const draft: GoalDraft = {
      title: 'Sample debt',
      currency: 'USD',
      direction: 'decrease',
      startingBalance: '100.00',
      startDate: '2026-10-21',
      targetBalance: '80.00',
      targetDate: '2027-01-01'
    };
    const result = goalFromDraft(draft, 'sample-debt-new');
    expect(result.errors).toEqual({});
    expect(result.goal?.direction).toBe('decrease');
    expect(result.goal?.startingBalanceMinor).toBe(10_000);

    expect(goalFromDraft({ ...draft, targetBalance: '120.00' }, 'bad-debt').errors.targetBalance)
      .toContain('decreasing goal');
    expect(goalFromDraft({ ...draft, targetDate: draft.startDate }, 'bad-dates').errors.targetDate)
      .toContain('after the starting date');
    expect(goalFromDraft({ ...draft, startDate: '2026-02-30' }, 'bad-start').errors.startDate)
      .toContain('valid starting date');
    expect(goalFromDraft({ ...draft, direction: 'increase', targetBalance: '80.00' }, 'bad-savings').errors.targetBalance)
      .toContain('increasing goal');

    const currencyEdit = goalFromDraft({ ...goalDraftFrom(savings), currency: 'EUR' }, savings.id, savings);
    expect(currencyEdit.errors.currency).toContain('cannot change');
    expect(goalFromDraft(goalDraftFrom(savings), savings.id, savings).goal?.checkIns).toEqual(savings.checkIns);
    expect(goalFromDraft(
      goalDraftFrom(savings),
      savings.id,
      { ...savings, supportingRhythmIds: ['archived-rhythm-id', 'missing-rhythm-id'] }
    ).goal?.supportingRhythmIds).toEqual(['archived-rhythm-id', 'missing-rhythm-id']);
  });

  it('calculates increasing and decreasing goal progress without exceeding the goal bounds', () => {
    const debt = goals[1]!;
    expect(goalProgressPercentage(savings, 200_000)).toBe(25);
    expect(goalProgressPercentage(savings, 1_000_000)).toBe(100);
    expect(goalProgressPercentage(savings, 50_000)).toBe(0);
    expect(goalProgressPercentage(debt, 662_500)).toBe(25);
    expect(goalProgressPercentage(debt, 100_000)).toBe(100);
    expect(goalProgressPercentage(debt, 1_000_000)).toBe(0);
  });

  it('sorts snapshots by effective date and replaces same-date check-ins while retaining the prior value', () => {
    const initial = saveCheckIn(savings, {
      effectiveDate: '2026-10-05',
      balance: '1180.00',
      note: 'Earlier observation'
    }, '2026-10-21T12:00:00.000Z', '2026-10-21').goal!;
    expect(initial.checkIns.map(item => item.effectiveDate)).toEqual([
      '2026-10-05',
      '2026-10-08',
      '2026-10-18'
    ]);

    const correctedEarlier = saveCheckIn(initial, {
      effectiveDate: '2026-10-05',
      balance: '1190.00',
      note: 'Corrected earlier observation'
    }, '2026-10-21T12:30:00.000Z', '2026-10-21');
    expect(correctedEarlier.goal?.correctionHistory).toEqual([{
      effectiveDate: '2026-10-05',
      previousBalanceMinor: 118_000,
      previousNote: 'Earlier observation',
      replacedAt: '2026-10-21T12:30:00.000Z'
    }]);

    const corrected = saveCheckIn(correctedEarlier.goal!, {
      effectiveDate: '2026-10-18',
      balance: '1300.00',
      note: 'Corrected observation'
    }, '2026-10-21T13:00:00.000Z', '2026-10-21');
    expect(corrected.corrected).toBe(true);
    expect(corrected.goal?.checkIns).toHaveLength(initial.checkIns.length);
    expect(corrected.goal?.checkIns.find(item => item.effectiveDate === '2026-10-18')?.id)
      .toBe(initial.checkIns.find(item => item.effectiveDate === '2026-10-18')?.id);
    expect(corrected.goal?.correctionHistory).toEqual([
      correctedEarlier.goal?.correctionHistory[0],
      {
        effectiveDate: '2026-10-18',
        previousBalanceMinor: 125_000,
        replacedAt: '2026-10-21T13:00:00.000Z'
      }
    ]);
    expect(latestCheckIn(corrected.goal!)?.balanceMinor).toBe(130_000);
    expect(remainingAmount(corrected.goal!, 130_000)).toBe(370_000);
    expect(goalTimeline(corrected.goal!).actual.map(point => point.date)).toEqual([
      '2026-10-05',
      '2026-10-08',
      '2026-10-18'
    ]);
  });

  it('allows a date-only correction and preserves its prior date, balance, note, and history', () => {
    const original = { ...savings.checkIns[1]!, note: 'Original check-in note' };
    const previousHistory = {
      effectiveDate: '2026-10-04',
      previousBalanceMinor: 105_000,
      previousNote: 'Earlier correction note',
      replacedAt: '2026-10-20T10:00:00.000Z'
    };
    const goal: MoneyGoal = {
      ...savings,
      checkIns: [savings.checkIns[0]!, original],
      correctionHistory: [previousHistory]
    };
    const corrected = saveCheckIn(goal, {
      effectiveDate: '2026-10-20',
      balance: '1250.00',
      note: 'Original check-in note'
    }, '2026-10-21T13:00:00.000Z', '2026-10-21', original);

    expect(corrected.errors).toEqual({});
    expect(corrected.corrected).toBe(true);
    expect(corrected.goal?.id).toBe(goal.id);
    expect(corrected.goal?.checkIns).toEqual([
      savings.checkIns[0],
      {
        id: original.id,
        effectiveDate: '2026-10-20',
        balanceMinor: 125_000,
        note: 'Original check-in note'
      }
    ]);
    expect(corrected.goal?.correctionHistory).toEqual([
      previousHistory,
      {
        effectiveDate: '2026-10-18',
        previousBalanceMinor: 125_000,
        previousNote: 'Original check-in note',
        replacedAt: '2026-10-21T13:00:00.000Z'
      }
    ]);
    expect(latestCheckIn(corrected.goal!)).toMatchObject({
      id: original.id,
      effectiveDate: '2026-10-20',
      balanceMinor: 125_000
    });
    expect(goalTimeline(corrected.goal!).actual.map(point => point.date)).toEqual([
      '2026-10-08',
      '2026-10-20'
    ]);

    const data = createSamplePreviewData();
    data.goals = data.goals.map(item => item.id === goal.id ? corrected.goal! : item);
    expect(validatePreviewEnvelope(createPreviewEnvelope(data), '2026-10-21')).toMatchObject({
      valid: true,
      envelope: {
        data: {
          goals: expect.arrayContaining([
            expect.objectContaining({ id: goal.id, correctionHistory: corrected.goal?.correctionHistory })
          ])
        }
      }
    });
  });

  it('combines date, balance, and note corrections and updates chart and progress ordering', () => {
    const original = { ...savings.checkIns[1]!, note: 'Original balance note' };
    const goal: MoneyGoal = {
      ...savings,
      checkIns: [savings.checkIns[0]!, original],
      correctionHistory: [{
        effectiveDate: '2026-10-05',
        previousBalanceMinor: 110_000,
        previousNote: 'Saved historical note',
        replacedAt: '2026-10-20T10:00:00.000Z'
      }]
    };
    const corrected = saveCheckIn(goal, {
      effectiveDate: '2026-10-20',
      balance: '1350.00',
      note: 'Corrected balance note'
    }, '2026-10-21T13:00:00.000Z', '2026-10-21', original);
    const updatedGoal = corrected.goal!;

    expect(updatedGoal.checkIns.find(checkIn => checkIn.id === original.id)).toEqual({
      id: original.id,
      effectiveDate: '2026-10-20',
      balanceMinor: 135_000,
      note: 'Corrected balance note'
    });
    expect(updatedGoal.correctionHistory).toEqual([
      goal.correctionHistory[0],
      {
        effectiveDate: '2026-10-18',
        previousBalanceMinor: 125_000,
        previousNote: 'Original balance note',
        replacedAt: '2026-10-21T13:00:00.000Z'
      }
    ]);
    expect(latestCheckIn(updatedGoal)?.id).toBe(original.id);
    expect(latestCheckIn(updatedGoal)?.effectiveDate).toBe('2026-10-20');
    expect(latestCheckIn(updatedGoal)?.balanceMinor).toBe(135_000);
    expect(goalProgressPercentage(updatedGoal, latestCheckIn(updatedGoal)!.balanceMinor)).toBe(9);
    expect(goalTimeline(updatedGoal).actual).toEqual([
      { date: '2026-10-08', value: 112_500 },
      { date: '2026-10-20', value: 135_000 }
    ]);
  });

  it('rejects a corrected date occupied by another check-in without changing either record', () => {
    const original = savings.checkIns[1]!;
    const draft = {
      effectiveDate: '2026-10-08',
      balance: '1350.00',
      note: 'Must not replace the other check-in'
    };
    const errors = validateCheckInDraft(savings, draft, '2026-10-21', original);
    expect(errors.effectiveDate).toContain('already occupies this date');
    expect(errors.effectiveDate).toContain('will not replace or merge it');

    const result = saveCheckIn(savings, draft, '2026-10-21T13:00:00.000Z', '2026-10-21', original);
    expect(result.goal).toBeUndefined();
    expect(result.errors.effectiveDate).toContain('already occupies this date');
    expect(savings.checkIns).toEqual(goals[0]!.checkIns);
    expect(savings.correctionHistory).toEqual([]);
  });

  it('preserves valid backward progress and rejects check-ins before the goal starts', () => {
    const backwards = saveCheckIn(savings, {
      effectiveDate: '2026-10-20',
      balance: '1100.00',
      note: ''
    }, '2026-10-21T12:00:00.000Z', '2026-10-21').goal!;
    expect(latestCheckIn(backwards)?.balanceMinor).toBe(110_000);
    expect(remainingAmount(backwards, 110_000)).toBe(390_000);

    const debt = goals[1]!;
    const increasedDebt = saveCheckIn(debt, {
      effectiveDate: '2026-10-20',
      balance: '7100.00',
      note: ''
    }, '2026-10-21T12:00:00.000Z', '2026-10-21').goal!;
    expect(latestCheckIn(increasedDebt)?.balanceMinor).toBe(710_000);
    expect(remainingAmount(increasedDebt, 710_000)).toBe(310_000);

    const backdated = validateCheckInDraft(savings, {
      effectiveDate: '2026-09-30',
      balance: '1200.00',
      note: ''
    }, '2026-10-21');
    expect(backdated.effectiveDate).toContain('before the starting date');
    const future = validateCheckInDraft(savings, {
      effectiveDate: '2026-10-22',
      balance: '1200.00',
      note: ''
    }, '2026-10-21');
    expect(future.effectiveDate).toContain('cannot be in the future');

    const rejectedFuture = saveCheckIn(
      savings,
      { effectiveDate: '2026-10-22', balance: '1300.00', note: '' },
      '2026-10-21T13:00:00.000Z',
      '2026-10-21'
    );
    expect(rejectedFuture.goal).toBeUndefined();
    expect(rejectedFuture.errors.effectiveDate).toContain('cannot be in the future');
  });
});

describe('goal preview components', () => {
  it('shows missing check-in data and the planned baseline without inventing actual points', () => {
    const goal: MoneyGoal = { ...savings, checkIns: [] };
    render(<GoalCard goal={goal} />);
    const card = screen.getByRole('article', { name: goal.title });
    expect(within(card).getByText('No check-ins yet')).toBeTruthy();
    expect(within(card).getByText(/Target balance · Jun 30, 2027/)).toBeTruthy();
    expect(within(card).getByText('No sample check-ins yet. Record an observed balance to begin.')).toBeTruthy();
    expect(within(card).getByText('Record a balance to calculate the amount remaining.')).toBeTruthy();
    expect(within(card).getByText('Unavailable until a check-in')).toBeTruthy();
    expect(within(card).queryByRole('progressbar')).toBeNull();
    const chart = within(card).getByRole('img', { name: /0 dated observed balance check-ins/ });
    expect(chart.querySelectorAll('circle')).toHaveLength(0);
    expect(chart.querySelectorAll('line')).toHaveLength(1);
  });

  it('labels the trajectory as planned and only renders dated observed check-in points', () => {
    const { container } = render(
      <TimelineChart
        timeline={goalTimeline(savings)}
        valueLabel="balance"
        formatValue={value => formatMoney(value, savings.currency)}
      />
    );
    expect(screen.getByText('Planned linear trajectory')).toBeTruthy();
    expect(screen.getByText(/Dots show observed check-ins only/)).toBeTruthy();
    expect(screen.getByRole('img', { name: /2 dated observed balance check-ins/ })).toBeTruthy();
    expect(container.querySelectorAll('.goal-timeline__actual')).toHaveLength(2);
    expect(container.querySelectorAll('.goal-timeline__planned')).toHaveLength(1);
  });

  it('renders shared goal cards for savings and debt with the correct direction labels', () => {
    render(
      <>
        {goals.map(goal => <GoalCard key={goal.id} goal={goal} />)}
      </>
    );

    expect(screen.getByRole('article', { name: 'Starter reserve' }).textContent).toContain('Savings goal');
    expect(screen.getByRole('article', { name: 'Debt payoff' }).textContent).toContain('Debt goal');
    expect(screen.getByText('$3,750.00 remaining')).toBeTruthy();
    expect(screen.getByText('$2,800.00 remaining')).toBeTruthy();
    expect(screen.getAllByText('Recorded Oct 18, 2026')).toHaveLength(2);
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
    expect(screen.getByRole('progressbar', { name: 'Progress toward Starter reserve' }).getAttribute('aria-valuenow')).toBe('6');
  });
});
