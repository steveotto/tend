import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CardioView } from '../src/components/CardioView.tsx';
import { createCardioData } from '../src/domain/cardio.ts';
import type { CardioData } from '../src/domain/cardio.ts';
import { todayRhythms } from '../src/domain/preview-data.ts';
import type { RhythmPreview } from '../src/domain/preview-data.ts';

afterEach(() => {
  cleanup();
  document.querySelectorAll('[data-test-cardio-opener]').forEach(element => element.remove());
});

function renderCardio(data: CardioData = createCardioData(), options: { saveError?: string } = {}) {
  const rhythm = cardioRhythm();
  const onChange = vi.fn((_next: CardioData) => options.saveError ?? null);
  return {
    ...render(
      <CardioView
        data={data}
        today="2026-10-22"
        rhythms={[rhythm]}
        archivedRhythmIds={new Set()}
        datedRhythmCompletions={[]}
        onChange={onChange}
      />
    ),
    onChange,
    rhythm
  };
}

function cardioRhythm(): RhythmPreview {
  const source = todayRhythms[0]!;
  const { scoring: _scoring, completionHistory: _history, ...base } = source;
  return {
    ...base,
    id: 'cardio-component-rhythm',
    title: 'Run rhythm',
    categoryIds: ['health'],
    schedule: { frequency: 'daily' },
    healthLogCapability: 'cardio'
  };
}

describe('Cardio preview presentation', () => {
  it('shows separate weekly run/mileage measures, score, today strip, and all historical runs', () => {
    const data: CardioData = {
      ...createCardioData(),
      goals: { weeklyRunTarget: 2, weeklyMileTarget: 8 },
      runs: [
        { id: 'run-this-week', date: '2026-10-22', distance: 3 },
        { id: 'run-prior-week', date: '2026-10-16', distance: 5 }
      ]
    };
    const { container } = renderCardio(data);
    expect(screen.getByText('Runs this week')).toBeTruthy();
    expect(screen.getByText('Miles this week')).toBeTruthy();
    const onTrack = screen.getByRole('meter', { name: 'On Track score' });
    expect(onTrack.getAttribute('aria-valuenow')).toBe('38');
    expect(onTrack.getAttribute('style')).toContain('37.5%');
    expect(screen.getByRole('img', { name: 'Cardio Health: Not enough data' })).toBeTruthy();
    expect(container.querySelector('.cardio-week-day.is-today')?.textContent).toContain('Today');
    expect(screen.getByText('Oct 16, 2026')).toBeTruthy();
    expect(screen.getByText('Oct 22, 2026')).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'Runs this week' }).getAttribute('aria-valuenow')).toBe('50');
    expect(screen.getByRole('meter', { name: 'Miles this week' }).getAttribute('aria-valuenow')).toBe('37.5');
  });

  it('shows one tracking setup callout and explains Cardio’s completed-week and current-week measures', async () => {
    const user = userEvent.setup();
    renderCardio();
    expect(screen.getByText('Set up tracking to see your scores.')).toBeTruthy();
    expect(screen.queryByText(/Set both weekly run and mileage goals/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Set up tracking' }));
    expect(screen.getByRole('dialog', { name: 'Cardio goals' })).toBeTruthy();

    cleanup();
    const data: CardioData = {
      ...createCardioData(),
      goals: { weeklyRunTarget: 2, weeklyMileTarget: 8 }
    };
    renderCardio(data);
    await user.click(screen.getByRole('button', { name: 'Show Cardio Health scoring details' }));
    const details = screen.getByRole('region', { name: 'Cardio Health scoring details' });
    expect(within(details).getByText(/four most recently completed weeks/)).toBeTruthy();
    expect(within(details).getByText(/This week’s run and distance goal progress/)).toBeTruthy();
    expect(within(details).getByText(/75% Consistency \+ 25% On Track/)).toBeTruthy();
    expect(within(details).queryByText(/training interval/i)).toBeNull();
    await user.click(within(details).getByText('Details'));
    expect(within(details).getByText(/Monday–Sunday weeks with known targets/)).toBeTruthy();
  });

  it('saves and clears complete weekly goals while rejecting a partial pair', async () => {
    const user = userEvent.setup();
    const { onChange } = renderCardio();
    await user.click(screen.getByRole('button', { name: 'Edit goals' }));
    const dialog = screen.getByRole('dialog', { name: 'Cardio goals' });
    await user.type(within(dialog).getByLabelText('Runs per week'), '2');
    await user.type(within(dialog).getByLabelText('Miles per week'), '8');
    await user.click(within(dialog).getByRole('button', { name: 'Save goals' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      goals: { weeklyRunTarget: 2, weeklyMileTarget: 8 }
    }));

    cleanup();
    const next = vi.fn((_data: CardioData) => null);
    render(
      <CardioView data={{ ...createCardioData(), goals: { weeklyRunTarget: 2, weeklyMileTarget: 8 } }}
        today="2026-10-22" rhythms={[]} archivedRhythmIds={new Set()}
        datedRhythmCompletions={[]} onChange={next} />
    );
    await user.click(screen.getByRole('button', { name: 'Edit goals' }));
    const edit = screen.getByRole('dialog', { name: 'Cardio goals' });
    await user.clear(within(edit).getByLabelText('Miles per week'));
    await user.click(within(edit).getByRole('button', { name: 'Save goals' }));
    expect(screen.getByRole('alert').textContent).toContain('both weekly');
    expect(next).not.toHaveBeenCalled();
  });

  it('uses labeled integrated steppers for blank and fractional weekly goals', async () => {
    const user = userEvent.setup();
    const { onChange } = renderCardio();
    await user.click(screen.getByRole('button', { name: 'Edit goals' }));
    const dialog = screen.getByRole('dialog', { name: 'Cardio goals' });
    const runs = within(dialog).getByLabelText('Runs per week') as HTMLInputElement;
    const miles = within(dialog).getByLabelText('Miles per week') as HTMLInputElement;

    expect(runs.value).toBe('');
    expect(runs.inputMode).toBe('numeric');
    expect(runs.min).toBe('1');
    expect(miles.value).toBe('');
    expect(miles.inputMode).toBe('decimal');
    await user.click(within(dialog).getByRole('button', { name: 'Decrease runs per week by 1' }));
    expect(runs.value).toBe('');
    await user.click(within(dialog).getByRole('button', { name: 'Increase runs per week by 1' }));
    await user.click(within(dialog).getByRole('button', { name: 'Increase miles per week by 0.1' }));
    expect(runs.value).toBe('1');
    expect(miles.value).toBe('0.1');

    await user.clear(miles);
    await user.type(miles, '8.5');
    await user.click(within(dialog).getByRole('button', { name: 'Save goals' }));
    expect(onChange.mock.calls[0]?.[0].goals).toEqual({ weeklyRunTarget: 1, weeklyMileTarget: 8.5 });
  });

  it('keeps entered zero distinct from blank and exposes a field-level target error', async () => {
    const user = userEvent.setup();
    const { onChange } = renderCardio();
    await user.click(screen.getByRole('button', { name: 'Edit goals' }));
    const dialog = screen.getByRole('dialog', { name: 'Cardio goals' });
    const runs = within(dialog).getByLabelText('Runs per week') as HTMLInputElement;
    await user.type(runs, '0');
    await user.click(within(dialog).getByRole('button', { name: 'Save goals' }));
    expect(runs.value).toBe('0');
    expect(runs.getAttribute('aria-invalid')).toBe('true');
    expect(within(dialog).getByText('Enter 1 to 21 runs per week.')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('logs a date-only run through explicit save and restores focus after Cancel or Escape', async () => {
    const user = userEvent.setup();
    const { onChange } = renderCardio();
    const opener = screen.getByRole('button', { name: 'Log run' });
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Log run' });
    expect(within(dialog).queryByLabelText(/time/i)).toBeNull();
    await user.type(within(dialog).getByLabelText('Distance (miles)'), '3');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);

    await user.click(opener);
    const retry = screen.getByRole('dialog', { name: 'Log run' });
    await user.type(within(retry).getByLabelText('Distance (miles)'), '3');
    fireEvent(retry, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);

    await user.click(opener);
    const savedDialog = screen.getByRole('dialog', { name: 'Log run' });
    await user.type(within(savedDialog).getByLabelText('Distance (miles)'), '3');
    await user.click(within(savedDialog).getByRole('button', { name: 'Save run' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0].runs[0]).toMatchObject({
      date: '2026-10-22',
      distance: 3
    });
    expect(document.activeElement).toBe(opener);
  });

  it('edits a run under the same ID and deletes only the selected run', async () => {
    const user = userEvent.setup();
    const existing: CardioData = {
      ...createCardioData(),
      runs: [
        { id: 'stable-run', date: '2026-10-22', distance: 3 },
        { id: 'untouched-run', date: '2026-10-21', distance: 2 }
      ]
    };
    const { onChange } = renderCardio(existing);
    await user.click(screen.getByRole('button', { name: /Edit run from Oct 22/ }));
    const editor = screen.getByRole('dialog', { name: 'Edit run' });
    const distance = within(editor).getByLabelText('Distance (miles)');
    await user.clear(distance);
    await user.type(distance, '4');
    await user.click(within(editor).getByRole('button', { name: 'Save changes' }));
    expect(onChange.mock.calls[0]![0].runs).toContainEqual(
      expect.objectContaining({ id: 'stable-run', distance: 4 })
    );
    expect(onChange.mock.calls[0]![0].runs).toContainEqual(
      expect.objectContaining({ id: 'untouched-run', distance: 2 })
    );

    cleanup();
    const afterEdit = { ...existing, runs: [
      { id: 'stable-run', date: '2026-10-22', distance: 4 },
      { id: 'untouched-run', date: '2026-10-21', distance: 2 }
    ] };
    const { onChange: deleteChange } = renderCardio(afterEdit);
    await user.click(screen.getByRole('button', { name: /Delete run from Oct 22/ }));
    expect(deleteChange.mock.calls[0]![0].runs).toEqual([
      expect.objectContaining({ id: 'untouched-run', distance: 2 })
    ]);
  });

  it('retains the run draft when persistence fails', async () => {
    const user = userEvent.setup();
    const { onChange } = renderCardio(createCardioData(), { saveError: 'Synthetic write failed.' });

    await user.click(screen.getByRole('button', { name: /Log run/ }));
    const dialog = screen.getByRole('dialog', { name: 'Log run' });
    const distance = within(dialog).getByLabelText('Distance (miles)');
    await user.type(distance, '4.5');
    await user.click(within(dialog).getByRole('button', { name: 'Save run' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert').textContent).toContain('Synthetic write failed');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect((distance as HTMLInputElement).value).toBe('4.5');
  });

  it('opens a dispatched Cardio Rhythm log request and restores focus after cancellation', async () => {
    const user = userEvent.setup();
    const rhythm = cardioRhythm();
    const opener = document.createElement('button');
    opener.dataset.testCardioOpener = 'true';
    document.body.append(opener);
    const onChange = vi.fn((_data: CardioData) => null);
    const onLogRequestClosed = vi.fn();
    render(
      <CardioView
        data={createCardioData()}
        today="2026-10-22"
        rhythms={[rhythm]}
        archivedRhythmIds={new Set()}
        datedRhythmCompletions={[]}
        onChange={onChange}
        pendingLogRequest={{ requestId: 1, opener, rhythm }}
        onLogRequestClosed={onLogRequestClosed}
      />
    );
    const dialog = await screen.findByRole('dialog', { name: 'Log run' });
    expect((within(dialog).getByLabelText('Cardio Rhythm (optional)') as HTMLSelectElement).value).toBe(rhythm.id);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(onLogRequestClosed).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(opener);
  });
});
