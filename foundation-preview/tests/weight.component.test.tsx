import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WeightView } from '../src/components/WeightView.tsx';
import { createWeightData, poundsToKilograms } from '../src/domain/weight.ts';
import type { WeightData } from '../src/domain/weight.ts';

afterEach(cleanup);

function renderWeight(data: WeightData = createWeightData()) {
  const onChange = vi.fn((_next: WeightData) => null);
  return {
    ...render(
    <WeightView
      data={data}
      today="2026-10-22"
      rhythms={[]}
      archivedRhythmIds={new Set()}
      completedRhythmIds={new Set()}
      datedRhythmCompletions={[]}
      onChange={onChange}
      onAddRhythm={vi.fn()}
      onEditRhythm={vi.fn()}
      onOpenRhythm={vi.fn()}
    />
    ),
    onChange
  };
}

describe('Weight preview presentation', () => {
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

  it('cancels without saving and records a positive unit-converted weigh-in', async () => {
    const user = userEvent.setup();
    const { onChange } = renderWeight();

    const opener = screen.getAllByRole('button', { name: 'Add weigh-in' })[0]!;
    await user.click(opener);
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);

    await user.click(screen.getAllByRole('button', { name: 'Add weigh-in' })[0]!);
    const reopened = screen.getByRole('dialog');
    await user.selectOptions(within(reopened).getByLabelText('Weight unit'), 'lb');
    await user.type(within(reopened).getByLabelText('Weight (lb)'), '180');
    await user.click(within(reopened).getByRole('button', { name: 'Save weigh-in' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const saved = onChange.mock.calls[0]![0];
    expect(saved.weighIns[0]).toMatchObject({ date: '2026-10-22' });
    expect((saved.weighIns[0] as { weightKg: number }).weightKg).toBe(poundsToKilograms(180));
  });

  it('supports arrow, Home, and End navigation with roving focus and tab selection', async () => {
    const user = userEvent.setup();
    renderWeight();
    const progress = screen.getByRole('tab', { name: 'Progress' });
    const rhythms = screen.getByRole('tab', { name: 'Rhythms' });

    expect(progress.getAttribute('aria-selected')).toBe('true');
    expect(progress.getAttribute('aria-controls')).toBe('weight-panel-progress');
    expect(rhythms.getAttribute('tabindex')).toBe('-1');
    progress.focus();
    await user.keyboard('{ArrowRight}');
    expect(rhythms.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(rhythms);
    expect(screen.getByRole('tabpanel', { name: 'Rhythms' })).toBeTruthy();
    expect(screen.queryByRole('tabpanel', { name: 'Progress' })).toBeNull();

    await user.keyboard('{ArrowRight}');
    expect(progress.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{End}');
    expect(rhythms.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{Home}');
    expect(progress.getAttribute('aria-selected')).toBe('true');
    expect(progress.getAttribute('tabindex')).toBe('0');
    expect(rhythms.getAttribute('tabindex')).toBe('-1');
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
        completedRhythmIds={new Set()}
        datedRhythmCompletions={[]}
        onChange={onChange}
        onAddRhythm={vi.fn()}
        onEditRhythm={vi.fn()}
        onOpenRhythm={vi.fn()}
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
    await user.click(screen.getByRole('button', { name: 'Edit goals' }));
    const dialog = screen.getByRole('dialog');
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

    await user.click(screen.getByRole('button', { name: 'Edit goals' }));
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
        completedRhythmIds={new Set()}
        datedRhythmCompletions={[]}
        onChange={deleteChange}
        onAddRhythm={vi.fn()}
        onEditRhythm={vi.fn()}
        onOpenRhythm={vi.fn()}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Delete weigh-in from Oct 20, 2026' }));
    expect(deleteChange).toHaveBeenCalledTimes(1);
    expect(deleteChange.mock.calls[0]![0].weighIns).toEqual([]);
  });
});
