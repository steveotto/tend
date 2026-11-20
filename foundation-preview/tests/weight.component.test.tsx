import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WeightView } from '../src/components/WeightView.tsx';
import { todayRhythms } from '../src/domain/preview-data.ts';
import type { CategoryScoreSelection } from '../src/domain/category-scoring.ts';
import { createWeightData, poundsToKilograms } from '../src/domain/weight.ts';
import type { WeightData } from '../src/domain/weight.ts';

afterEach(() => {
  cleanup();
  document.querySelectorAll('[data-test-weight-opener]').forEach(element => element.remove());
});

function renderWeight(
  data: WeightData = createWeightData(),
  today = '2026-10-22',
  healthScore?: CategoryScoreSelection,
  foundationNavigation = false
) {
  const onChange = vi.fn((_next: WeightData) => null);
  return {
    ...render(
    <WeightView
      data={data}
      today={today}
      {...(healthScore ? { healthScore } : {})}
      rhythms={[]}
      archivedRhythmIds={new Set()}
      datedRhythmCompletions={[]}
      onChange={onChange}
      foundationNavigation={foundationNavigation}
    />
    ),
    onChange
  };
}

describe('Weight preview presentation', () => {
  it('uses shared Rhythm cards and Foundation association controls in Rhythms', async () => {
    const user = userEvent.setup();
    const rhythm = {
      ...todayRhythms[0]!,
      id: 'weight-linked-rhythm',
      title: 'Steady Steps',
      primaryFoundationId: 'health-weight',
      healthLogCapability: 'weight' as const
    };
    const onAddLinkedRhythm = vi.fn();
    const onSaveFoundationAssociations = vi.fn();
    render(
      <WeightView
        data={createWeightData()}
        today="2026-10-22"
        rhythms={[rhythm]}
        archivedRhythmIds={new Set()}
        datedRhythmCompletions={[]}
        onChange={vi.fn(() => null)}
        foundationNavigation
        onAddLinkedRhythm={onAddLinkedRhythm}
        onSaveFoundationAssociations={onSaveFoundationAssociations}
      />
    );

    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    const rhythmsPanel = screen.getByRole('tabpanel', { name: 'Rhythms' });
    expect(within(rhythmsPanel).getByRole('heading', { name: /Linked Rhythms/ })).toBeTruthy();
    expect(within(rhythmsPanel).getByText('Steady Steps')).toBeTruthy();
    expect(within(rhythmsPanel).getByRole('button', { name: 'Add Rhythm' })).toBeTruthy();

    await user.click(within(rhythmsPanel).getByRole('button', { name: 'Manage links' }));
    const dialog = screen.getByRole('dialog', { name: 'Linked Rhythms' });
    await user.click(within(dialog).getByRole('checkbox', { name: /Steady Steps/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(onSaveFoundationAssociations).toHaveBeenCalledOnce();
    expect(onAddLinkedRhythm).not.toHaveBeenCalled();
  });

  it('uses keyboard-operable Progress, Weigh-Ins, and Rhythms Foundation panels', async () => {
    const user = userEvent.setup();
    const data: WeightData = {
      ...createWeightData(),
      goals: {
        startWeightKg: 90,
        startDate: '2026-10-01',
        targetWeightKg: 80,
        goalDate: '2026-11-01'
      },
      weighIns: [{ id: 'tab-measurement', date: '2026-10-20', weightKg: 87 }]
    };
    const { onChange } = renderWeight(data, '2026-10-22', undefined, true);
    const tabs = screen.getByRole('tablist', { name: 'Weight Foundation sections' });
    const insights = screen.getByRole('region', { name: 'Weight insights' });
    const progress = within(tabs).getByRole('tab', { name: 'Progress' });
    const measurements = within(tabs).getByRole('tab', { name: 'Weigh-Ins' });
    const rhythms = within(tabs).getByRole('tab', { name: 'Rhythms' });
    expect(progress.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel', { name: 'Progress' })).toBeTruthy();
    expect(within(insights).getByText('Explore your weight and progress toward your goal.')).toBeTruthy();
    expect(within(insights).getByText(
      'Weight Health reflects scheduled weigh-in Rhythms. Recorded weight, distance from the goal path, and the separate Goal Progress score do not affect it.'
    )).toBeTruthy();
    expect(insights.contains(tabs)).toBe(false);
    expect(insights.contains(document.querySelector('.foundation-health-card'))).toBe(false);
    expect(screen.getByRole('button', { name: 'Weight tracking settings' })).toBeTruthy();

    progress.focus();
    await user.keyboard('{End}');
    expect(rhythms.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('No Rhythms are linked to Weight yet.')).toBeTruthy();
    await user.keyboard('{Home}');
    expect(progress.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{ArrowRight}');
    expect(measurements.getAttribute('aria-selected')).toBe('true');
    expect(within(screen.getByRole('tabpanel', { name: 'Weigh-Ins' }))
      .getByText('Oct 20, 2026')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Add weigh-in' }));
    const dialog = screen.getByRole('dialog', { name: 'Add weigh-in' });
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: 'Add weigh-in' }));
    expect(document.activeElement).not.toBe(within(dialog).getByLabelText('Date'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(measurements.getAttribute('aria-selected')).toBe('true');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps its Foundation summary compact and shows measures and explanations in Health details', async () => {
    const user = userEvent.setup();
    renderWeight(createWeightData(), '2026-10-22', {
      foundationIds: ['health-weight'],
      eligibleFoundationIds: ['health-weight'],
      excludedFoundationIds: [],
      unresolvedFoundationIds: [],
      consistency: 80,
      onTrack: 40,
      health: 70
    }, true);

    expect(screen.getByRole('meter', { name: 'Weight Health score' }).getAttribute('aria-valuenow')).toBe('70');
    expect(screen.queryByRole('meter', { name: 'Consistency score' })).toBeNull();
    expect(screen.queryByRole('meter', { name: 'On Track score' })).toBeNull();
    const measureToggle = screen.getByRole('button', {
      name: 'Show Weight Health Consistency and On Track breakdown'
    });
    expect(measureToggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById(measureToggle.getAttribute('aria-controls')!)?.hidden).toBe(true);
    await user.click(measureToggle);
    expect(measureToggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuenow')).toBe('80');
    expect(screen.getByRole('meter', { name: 'On Track score' }).getAttribute('aria-valuenow')).toBe('40');
    expect(screen.getByText('Follow-through over time')).toBeTruthy();
    expect(screen.getByText('How up to date you are')).toBeTruthy();

    const info = screen.getByRole('button', { name: 'Show Weight Health scoring details' });
    await user.click(info);
    expect(info.getAttribute('aria-expanded')).toBe('true');
    expect(measureToggle.getAttribute('aria-expanded')).toBe('true');
    const dialog = screen.getByRole('dialog', { name: 'Weight Health details' });
    expect(dialog.classList.contains('dialog--phone-fullscreen')).toBe(true);
    expect(within(dialog).getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuenow')).toBe('80');
    expect(within(dialog).getByRole('meter', { name: 'On Track score' }).getAttribute('aria-valuenow')).toBe('40');
    const scoringToggle = within(dialog).getByRole('button', { name: 'How this Weight Foundation was scored' });
    expect(scoringToggle.getAttribute('aria-expanded')).toBe('false');
    await user.click(scoringToggle);
    expect(within(dialog).getByLabelText('75% times 80 equals 60 points')).toBeTruthy();
    expect(within(dialog).getByLabelText('25% times 40 equals 10 points')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'How this Weight Foundation contributes' }));
    await user.click(within(dialog).getByRole('button', { name: 'About Weight scoring' }));
    const scoringDialog = screen.getByRole('dialog', { name: 'Weight scoring' });
    expect(within(scoringDialog).getByText(
      'Weight Health reflects scheduled weigh-in Rhythms. Recorded weight, distance from the goal path, and the separate Goal Progress score do not affect it.'
    )).toBeTruthy();
    expect(within(scoringDialog).getByText(/Goal Progress score do not affect it/)).toBeTruthy();
    await user.keyboard('{Escape}');
    await user.keyboard('{Escape}');
    expect(measureToggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('preserves zero and unavailable states in Weight Health details', async () => {
    const user = userEvent.setup();
    renderWeight(createWeightData(), '2026-10-22', {
      foundationIds: ['health-weight'],
      eligibleFoundationIds: [],
      excludedFoundationIds: ['health-weight'],
      unresolvedFoundationIds: [],
      consistency: 0,
      onTrack: null,
      health: null
    }, true);

    expect(screen.getByRole('img', { name: 'Weight Health: Not enough data' })).toBeTruthy();
    expect(screen.queryByRole('meter', { name: 'Consistency score' })).toBeNull();
    expect(screen.queryByRole('img', { name: 'On Track: Score unavailable' })).toBeNull();
    const measureToggle = screen.getByRole('button', {
      name: 'Show Weight Health Consistency and On Track breakdown'
    });
    await user.click(measureToggle);
    expect(screen.getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuenow')).toBe('0');
    expect(screen.getByRole('img', { name: 'On Track: Score unavailable' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Show Weight Health scoring details' }));
    const dialog = screen.getByRole('dialog', { name: 'Weight Health details' });
    expect(within(dialog).getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuenow')).toBe('0');
    expect(within(dialog).getByRole('img', { name: 'On Track: Score unavailable' })).toBeTruthy();
    expect(within(dialog).getByRole('img', { name: 'Weight Health: Not enough data' })).toBeTruthy();
  });

  it('distinguishes recorded measurements, goal path, expected marker, and latest evidence', () => {
    const data: WeightData = {
      ...createWeightData(),
      goals: {
        startWeightKg: 90,
        startDate: '2026-10-01',
        targetWeightKg: 80,
        goalDate: '2026-11-01'
      },
      weighIns: [
        { id: 'record-1', date: '2026-10-18', weightKg: 88 },
        { id: 'record-2', date: '2026-10-20', weightKg: 87 }
      ]
    };
    const { container } = renderWeight(data);
    expect(screen.getByText('Latest recorded measurement · Oct 20, 2026')).toBeTruthy();
    expect(screen.getByText('Recorded measurement')).toBeTruthy();
    expect(screen.getByText('Goal path')).toBeTruthy();
    expect(screen.getAllByText('Expected today').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.weight-chart__record')).toHaveLength(2);
    expect(container.querySelector('.weight-chart__goal')).toBeTruthy();
  });

  it('keeps progress and history as separate stacked cards in empty and populated states', () => {
    const empty = renderWeight();
    const emptyProgress = empty.container.querySelector('.weight-progress');
    expect(emptyProgress?.querySelector('#weight-panel-progress .weight-progress-card')).toBeTruthy();
    expect(emptyProgress?.querySelector('#weight-panel-measurements .weight-history-card')).toBeTruthy();
    expect(screen.getByText('No valid weigh-ins to show.')).toBeTruthy();
    const addWeighIn = screen.getByRole('button', { name: 'Add weigh-in' });
    expect(screen.getAllByRole('button', { name: 'Add weigh-in' })).toHaveLength(1);
    expect(addWeighIn.closest('.weight-history-card')).toBeTruthy();

    cleanup();
    const populated = renderWeight({
      ...createWeightData(),
      weighIns: [{ id: 'spaced-history', date: '2026-10-20', weightKg: 80 }]
    });
    const populatedProgress = populated.container.querySelector('.weight-progress');
    expect(populatedProgress?.querySelector('#weight-panel-progress .weight-progress-card')).toBeTruthy();
    expect(populatedProgress?.querySelector('#weight-panel-measurements .weight-history-card')).toBeTruthy();
    expect(screen.getAllByText('Oct 20, 2026').length).toBeGreaterThan(0);
  });

  it('uses the shared full score meter and distinguishes unavailable from numeric zero', () => {
    renderWeight();
    const unavailableMeter = screen.getByRole('meter', { name: 'Weight progress score, separate from category and Foundation scores' });
    expect(unavailableMeter.getAttribute('aria-valuetext')).toBe('Score unavailable');
    expect(unavailableMeter.hasAttribute('aria-valuenow')).toBe(false);
    expect(unavailableMeter.className).not.toContain('preview-score-meter--compact');
    expect(unavailableMeter.querySelector('.category-health-spectrum')?.classList.contains('is-empty')).toBe(true);
    expect(unavailableMeter.querySelector('.preview-score-marker')).toBeNull();

    cleanup();
    const zero = renderWeight({
      ...createWeightData(),
      goals: {
        startWeightKg: 200,
        startDate: '2026-10-01',
        targetWeightKg: 180,
        goalDate: '2026-10-21'
      },
      weighIns: [{ id: 'zero-progress', date: '2026-10-11', weightKg: 210 }]
    }, '2026-10-11');
    const zeroMeter = screen.getByRole('meter', { name: 'Weight progress score, separate from category and Foundation scores' });
    expect(zeroMeter.getAttribute('aria-valuenow')).toBe('0');
    expect(zeroMeter.getAttribute('aria-valuetext')).toBe('0 out of 100');
    expect(zeroMeter.querySelector('.preview-score-marker')).toBeTruthy();
    expect(zero.container.querySelector('.preview-score-meter--compact')).toBeNull();
  });

  it('cancels without saving and records a positive unit-converted weigh-in', async () => {
    const user = userEvent.setup();
    const { onChange } = renderWeight();

    const opener = screen.getByRole('button', { name: 'Add weigh-in' });
    await user.click(opener);
    const dialog = screen.getByRole('dialog');
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: 'Add weigh-in' }));
    expect(document.activeElement).not.toBe(within(dialog).getByLabelText('Date'));
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);

    await user.click(screen.getByRole('button', { name: 'Add weigh-in' }));
    const reopened = screen.getByRole('dialog');
    await user.selectOptions(within(reopened).getByLabelText('Weight unit'), 'lb');
    await user.type(within(reopened).getByLabelText('Weight (lb)'), '180');
    await user.click(within(reopened).getByRole('button', { name: 'Save weigh-in' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const saved = onChange.mock.calls[0]![0];
    expect(saved.weighIns[0]).toMatchObject({ date: '2026-10-22' });
    expect((saved.weighIns[0] as { weightKg: number }).weightKg).toBe(poundsToKilograms(180));
  });

  it('opens a dispatched weigh-in request and restores focus after cancellation', async () => {
    const user = userEvent.setup();
    const opener = document.createElement('button');
    opener.dataset.testWeightOpener = 'true';
    document.body.append(opener);
    const onChange = vi.fn((_next: WeightData) => null);
    const onLogRequestClosed = vi.fn();
    render(
      <WeightView
        data={createWeightData()}
        today="2026-10-22"
        rhythms={[]}
        archivedRhythmIds={new Set()}
        datedRhythmCompletions={[]}
        onChange={onChange}
        pendingLogRequest={{ requestId: 1, opener }}
        onLogRequestClosed={onLogRequestClosed}
        foundationNavigation
        foundationActive
      />
    );
    const dialog = await screen.findByRole('dialog', { name: 'Add weigh-in' });
    expect(screen.getByRole('tab', { name: 'Weigh-Ins' }).getAttribute('aria-selected')).toBe('true');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(onLogRequestClosed).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(opener);
  });

  it('keeps the weigh-in dialog open and the draft intact when persistence reports an error', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn((_next: WeightData) => 'Synthetic storage rejected the write.');
    render(
      <WeightView
        data={createWeightData()}
        today="2026-10-22"
        rhythms={[]}
        archivedRhythmIds={new Set()}
        datedRhythmCompletions={[]}
        onChange={onChange}
      />
    );
    await user.click(screen.getAllByRole('button', { name: 'Add weigh-in' })[0]!);
    const dialog = screen.getByRole('dialog');
    const weight = within(dialog).getByLabelText('Weight (lb)');
    await user.type(weight, '180');
    await user.click(within(dialog).getByRole('button', { name: 'Save weigh-in' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert').textContent).toContain('Synthetic storage rejected');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect((weight as HTMLInputElement).value).toBe('180');
  });

  it('saves complete goals in canonical units and clears goals only after explicit save', async () => {
    const user = userEvent.setup();
    const { onChange } = renderWeight();
    await user.click(screen.getByRole('button', { name: 'Weight tracking settings' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.classList.contains('dialog--phone-fullscreen')).toBe(true);
    expect(dialog.querySelector('.fitness-goals-scroll')).toBeTruthy();
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: 'Weight goals' }));
    expect(document.activeElement).not.toBe(within(dialog).getByLabelText('Starting weight (lb)'));
    await user.type(within(dialog).getByLabelText('Starting weight (lb)'), '200');
    await user.type(within(dialog).getByLabelText('Starting date'), '2026-10-01');
    await user.type(within(dialog).getByLabelText('Target weight (lb)'), '180');
    await user.type(within(dialog).getByLabelText('Goal date'), '2026-11-01');
    await user.click(within(dialog).getByRole('button', { name: 'Save goals' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const saved = onChange.mock.calls[0]![0];
    expect(saved.goals).toMatchObject({
      startWeightKg: poundsToKilograms(200),
      targetWeightKg: poundsToKilograms(180),
      startDate: '2026-10-01',
      goalDate: '2026-11-01'
    });
  });

  it('accepts fractional weight entry through the shared numeric control', async () => {
    const user = userEvent.setup();
    const { onChange } = renderWeight();
    await user.click(screen.getByRole('button', { name: 'Weight tracking settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Weight goals' });
    const start = within(dialog).getByLabelText('Starting weight (lb)') as HTMLInputElement;
    const target = within(dialog).getByLabelText('Target weight (lb)') as HTMLInputElement;
    await user.type(start, '173.5');
    await user.type(within(dialog).getByLabelText('Starting date'), '2026-10-01');
    await user.type(target, '162.25');
    await user.type(within(dialog).getByLabelText('Goal date'), '2026-11-01');
    expect(start.value).toBe('173.5');
    expect(target.value).toBe('162.25');
    await user.click(within(dialog).getByRole('button', { name: 'Save goals' }));
    expect(onChange.mock.calls[0]?.[0].goals).toMatchObject({
      startWeightKg: poundsToKilograms(173.5),
      targetWeightKg: poundsToKilograms(162.25)
    });
  });

  it('allows unchanged saved goals and weigh-ins to save after switching display units', async () => {
    const user = userEvent.setup();
    const data: WeightData = {
      ...createWeightData(),
      displayUnit: 'kg',
      goals: {
        startWeightKg: 90,
        startDate: '2026-10-01',
        targetWeightKg: 80,
        goalDate: '2026-11-01'
      },
      weighIns: [{ id: 'canonical-record', date: '2026-10-20', weightKg: 82 }]
    };
    const { onChange } = renderWeight(data);

    await user.click(screen.getByRole('button', { name: 'Weight tracking settings' }));
    const goals = screen.getByRole('dialog', { name: 'Weight goals' });
    await user.selectOptions(within(goals).getByLabelText('Weight unit'), 'lb');
    expect(within(goals).getByLabelText('Starting weight (lb)')).toHaveProperty('value', '198.42');
    expect((within(goals).getByLabelText('Starting weight (lb)') as HTMLInputElement).checkValidity()).toBe(true);
    await user.click(within(goals).getByRole('button', { name: 'Save goals' }));
    expect(onChange.mock.calls[0]?.[0].goals).toMatchObject({
      startWeightKg: 90,
      targetWeightKg: 80
    });

    cleanup();
    const { onChange: measurementSave } = renderWeight(data);
    await user.click(screen.getByRole('button', { name: 'Edit weigh-in from Oct 20, 2026' }));
    const measurement = screen.getByRole('dialog', { name: 'Edit weigh-in' });
    await user.selectOptions(within(measurement).getByLabelText('Weight unit'), 'lb');
    const weight = within(measurement).getByLabelText('Weight (lb)') as HTMLInputElement;
    expect(weight.value).toBe('180.78');
    expect(weight.checkValidity()).toBe(true);
    await user.click(within(measurement).getByRole('button', { name: 'Save changes' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(measurementSave).toHaveBeenCalledOnce();
    expect(measurementSave.mock.calls[0]?.[0].weighIns).toEqual([
      expect.objectContaining({ id: 'canonical-record', weightKg: 82 })
    ]);
  });

  it('keeps trailing zeros out of controls and preserves fractional canonical values on unit-only saves', async () => {
    const user = userEvent.setup();
    const fractional: WeightData = {
      ...createWeightData(),
      displayUnit: 'kg',
      goals: {
        startWeightKg: 90.123,
        startDate: '2026-10-01',
        targetWeightKg: 80.987,
        goalDate: '2026-11-01'
      },
      weighIns: [{ id: 'fractional-record', date: '2026-10-20', weightKg: 82.321 }]
    };
    const { onChange } = renderWeight(fractional);

    await user.click(screen.getByRole('button', { name: 'Weight tracking settings' }));
    const goals = screen.getByRole('dialog', { name: 'Weight goals' });
    const start = within(goals).getByLabelText('Starting weight (kg)') as HTMLInputElement;
    expect(start.value).toBe('90.12');
    expect(start.step).toBe('any');
    await user.selectOptions(within(goals).getByLabelText('Weight unit'), 'lb');
    await user.click(within(goals).getByRole('button', { name: 'Save goals' }));
    expect(onChange.mock.calls[0]?.[0].goals).toMatchObject({
      startWeightKg: 90.123,
      targetWeightKg: 80.987
    });

    cleanup();
    const { onChange: measurementSave } = renderWeight(fractional);
    await user.click(screen.getByRole('button', { name: 'Edit weigh-in from Oct 20, 2026' }));
    const editor = screen.getByRole('dialog', { name: 'Edit weigh-in' });
    const weight = within(editor).getByLabelText('Weight (kg)') as HTMLInputElement;
    expect(weight.value).toBe('82.32');
    await user.selectOptions(within(editor).getByLabelText('Weight unit'), 'lb');
    await user.click(within(editor).getByRole('button', { name: 'Save changes' }));
    expect(measurementSave.mock.calls[0]?.[0].weighIns).toEqual([
      expect.objectContaining({ id: 'fractional-record', weightKg: 82.321 })
    ]);
  });

  it('uses whole-unit steppers for goals and weigh-ins without changing other fields', async () => {
    const user = userEvent.setup();
    const data: WeightData = {
      ...createWeightData(),
      displayUnit: 'lb',
      goals: {
        startWeightKg: poundsToKilograms(173),
        startDate: '2026-10-01',
        targetWeightKg: poundsToKilograms(160.5),
        goalDate: '2026-11-01'
      },
      weighIns: [{ id: 'step-record', date: '2026-10-20', weightKg: poundsToKilograms(173.5), notes: 'Keep note' }]
    };
    const { onChange } = renderWeight(data);
    await user.click(screen.getByRole('button', { name: 'Weight tracking settings' }));
    const goals = screen.getByRole('dialog', { name: 'Weight goals' });
    const start = within(goals).getByLabelText('Starting weight (lb)') as HTMLInputElement;
    const target = within(goals).getByLabelText('Target weight (lb)') as HTMLInputElement;
    expect(start.value).toBe('173');
    expect(target.value).toBe('160.5');
    await user.click(within(goals).getByRole('button', { name: 'Increase starting weight by 1 lb' }));
    expect(start.value).toBe('174');
    await user.click(within(goals).getByRole('button', { name: 'Save goals' }));
    expect(onChange.mock.calls[0]?.[0].goals).toMatchObject({
      startWeightKg: poundsToKilograms(174),
      targetWeightKg: poundsToKilograms(160.5),
      startDate: '2026-10-01',
      goalDate: '2026-11-01'
    });

    cleanup();
    const { onChange: measurementSave } = renderWeight(data);
    await user.click(screen.getByRole('button', { name: 'Edit weigh-in from Oct 20, 2026' }));
    const editor = screen.getByRole('dialog', { name: 'Edit weigh-in' });
    const weight = within(editor).getByLabelText('Weight (lb)') as HTMLInputElement;
    expect(weight.value).toBe('173.5');
    await user.click(within(editor).getByRole('button', { name: 'Increase weight by 1 lb' }));
    expect(weight.value).toBe('174.5');
    await user.click(within(editor).getByRole('button', { name: 'Save changes' }));
    expect(measurementSave.mock.calls[0]?.[0].weighIns).toEqual([
      expect.objectContaining({
        id: 'step-record',
        date: '2026-10-20',
        weightKg: poundsToKilograms(174.5),
        notes: 'Keep note'
      })
    ]);
  });

  it('keeps entered zero distinct from blank and reports invalid weigh-in input accessibly', async () => {
    const user = userEvent.setup();
    const { onChange } = renderWeight();
    await user.click(screen.getAllByRole('button', { name: 'Add weigh-in' })[0]!);
    const dialog = screen.getByRole('dialog', { name: 'Add weigh-in' });
    const weight = within(dialog).getByLabelText('Weight (lb)') as HTMLInputElement;
    await user.type(weight, '0');
    expect(weight.value).toBe('0');
    await user.click(within(dialog).getByRole('button', { name: 'Save weigh-in' }));
    expect(weight.getAttribute('aria-invalid')).toBe('true');
    expect(within(dialog).getByRole('alert').textContent).toContain('positive weight');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps history IDs through edits and deletes only the selected measurement', async () => {
    const user = userEvent.setup();
    const data: WeightData = {
      ...createWeightData(),
      weighIns: [{ id: 'history-id', date: '2026-10-20', weightKg: 82, notes: 'Recorded note' }]
    };
    const { onChange } = renderWeight(data);
    await user.click(screen.getByRole('button', { name: 'Edit weigh-in from Oct 20, 2026' }));
    const dialog = screen.getByRole('dialog');
    await user.clear(within(dialog).getByLabelText('Weight (lb)'));
    await user.type(within(dialog).getByLabelText('Weight (lb)'), '175');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(onChange.mock.calls[0]![0].weighIns).toEqual([
      expect.objectContaining({ id: 'history-id', notes: 'Recorded note' })
    ]);

    cleanup();
    const deleteChange = vi.fn((_next: WeightData) => null);
    render(
      <WeightView
        data={data}
        today="2026-10-22"
        rhythms={[]}
        archivedRhythmIds={new Set()}
        datedRhythmCompletions={[]}
        onChange={deleteChange}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Delete weigh-in from Oct 20, 2026' }));
    expect(deleteChange).toHaveBeenCalledTimes(1);
    expect(deleteChange.mock.calls[0]![0].weighIns).toEqual([]);
  });
});
