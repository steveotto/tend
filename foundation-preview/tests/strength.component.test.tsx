import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StrengthView } from '../src/components/StrengthView.tsx';
import { createStrengthData, strengthMuscleName, strengthWorkoutSuggestions } from '../src/domain/strength.ts';
import type { StrengthData, StrengthMode } from '../src/domain/strength.ts';
import { todayRhythms } from '../src/domain/preview-data.ts';
import type { CategoryId } from '../src/domain/preview-data.ts';

afterEach(cleanup);

function renderStrength(
  data = createStrengthData(),
  mode: StrengthMode = 'recommended',
  saveError: string | null = null,
  workoutId?: string
) {
  const onChange = vi.fn((_next: StrengthData) => saveError);
  const rhythm = {
    ...todayRhythms[0]!,
    id: 'health-strength-rhythm',
    categoryIds: ['health'] as CategoryId[]
  };
  const result = render(
    <StrengthView
      data={data}
      rhythms={[{ rhythm, mode, ...(workoutId ? { workoutId } : {}) }]}
      completedRhythmIds={new Set()}
      evaluationDate="2026-10-22"
      onChange={onChange}
      onAddRhythm={vi.fn()}
      onEditRhythm={vi.fn()}
      onOpenRhythm={vi.fn()}
    />
  );
  return { ...result, onChange, rhythm };
}

function renderStatefulStrength(initialData = createStrengthData()) {
  const changes: StrengthData[] = [];
  const rhythm = {
    ...todayRhythms[0]!,
    id: 'health-strength-rhythm',
    categoryIds: ['health'] as CategoryId[]
  };
  const onAddRhythm = vi.fn();
  const onEditRhythm = vi.fn();
  const onOpenRhythm = vi.fn();
  function StatefulStrength() {
    const [data, setData] = useState(initialData);
    return (
      <StrengthView
        data={data}
        rhythms={[{ rhythm, mode: 'recommended' }]}
        completedRhythmIds={new Set()}
        evaluationDate="2026-10-22"
        onChange={next => {
          changes.push(next);
          setData(next);
          return null;
        }}
        onAddRhythm={onAddRhythm}
        onEditRhythm={onEditRhythm}
        onOpenRhythm={onOpenRhythm}
      />
    );
  }
  return { ...render(<StatefulStrength />), changes };
}

describe('Strength preview presentation', () => {
  it('renders the interactive body map and changes selected muscle by keyboard', async () => {
    const user = userEvent.setup();
    renderStrength();

    expect(screen.getByRole('group', { name: 'Front muscle training status map' })).toBeTruthy();
    const map = screen.getByRole('group', { name: 'Front muscle training status map' });
    const chest = within(map).getByRole('button', { name: 'Chest, score unavailable, Not logged yet.' });
    chest.focus();
    await user.keyboard('{Enter}');
    expect(chest.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('heading', { name: /Chest/ })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('group', { name: 'Back muscle training status map' })).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Muscle training status' }))
      .getByRole('button', { name: 'Back, score unavailable, Not logged yet.' })).toBeTruthy();
  });

  it('preserves zero and accessible unavailable labels in the muscle list and summary', () => {
    const data = createStrengthData();
    data.settings.muscleIntervals.chest = 1;
    data.workouts = [{ id: 'old-chest', date: '2026-10-01', muscleIds: ['chest'] }];
    renderStrength(data);

    expect(screen.getByRole('meter', { name: 'Strength training status score' }).getAttribute('aria-valuenow')).toBe('0');
    const muscleList = screen.getByRole('group', { name: 'Muscle training status' });
    expect(within(muscleList).getByRole('button', { name: 'Chest, 0 out of 100, 20 days overdue.' })).toBeTruthy();
    expect(within(muscleList).getByRole('button', { name: 'Abs, score unavailable, Not logged yet.' })).toBeTruthy();
  });

  it('saves training goals with validation and returns focus to the opener on cancel', async () => {
    const user = userEvent.setup();
    const { onChange } = renderStrength();
    const opener = screen.getByRole('button', { name: 'Training goals' });
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Strength training goals' });
    const chestInterval = within(dialog).getByRole('spinbutton', { name: 'Chest training interval in days' });
    const chestRest = within(dialog).getByRole('spinbutton', { name: 'Chest preferred rest days' });
    await user.clear(chestInterval);
    await user.type(chestInterval, '1');
    await user.clear(chestRest);
    await user.type(chestRest, '1');
    await user.click(within(dialog).getByRole('button', { name: 'Save goals' }));
    expect(within(dialog).getByRole('alert').textContent).toMatch(/interval must exceed/i);
    expect(onChange).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(opener);
  });

  it('uses the shared Rhythm card action to open a linked workout log and preserve cancellation', async () => {
    const user = userEvent.setup();
    const { onChange, rhythm } = renderStrength();
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    const action = screen.getByRole('button', { name: /^Log workout/ });
    await user.click(action);
    const dialog = screen.getByRole('dialog', { name: 'Log workout' });
    expect(within(dialog).getByLabelText('Workout date')).toHaveProperty('value', '2026-10-22');
    expect(within(dialog).getByLabelText('Saved workout (optional)')).toHaveProperty('value', '');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(action);

    await user.click(action);
    const reopened = screen.getByRole('dialog', { name: 'Log workout' });
    await user.click(within(reopened).getByRole('checkbox', { name: 'Chest' }));
    await user.click(within(reopened).getByRole('button', { name: 'Save workout' }));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0]?.[0].workouts[0]).toMatchObject({
      rhythmId: rhythm.id,
      rhythmOccurrence: '2026-10-22',
      date: '2026-10-22',
      muscleIds: ['chest']
    });
    expect(onChange.mock.calls[0]?.[0].workouts[0]?.completionId).toBeTruthy();
  });

  it('preselects a contextual workout and lets the user edit the actual muscles trained', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    data.savedWorkouts = [{
      id: 'saved-upper',
      name: 'Upper Body',
      muscleIds: ['chest', 'back', 'biceps', 'triceps', 'shoulders'],
      sharedWith: []
    }];
    const { onChange } = renderStrength(data);
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    await user.click(screen.getByRole('button', { name: 'Log workout' }));

    const dialog = screen.getByRole('dialog', { name: 'Log workout' });
    expect(within(dialog).getByText('Upper Body')).toBeTruthy();
    expect(within(dialog).queryByLabelText('Saved workout (optional)')).toBeNull();
    for (const muscle of ['Chest', 'Back', 'Biceps', 'Triceps', 'Shoulders']) {
      expect(within(dialog).getByRole('checkbox', { name: muscle })).toHaveProperty('checked', true);
    }

    await user.click(within(dialog).getByRole('checkbox', { name: 'Chest' }));
    await user.click(within(dialog).getByText('Back'));
    await user.click(within(dialog).getByText('Abs'));
    const triceps = within(dialog).getByRole('checkbox', { name: 'Triceps' });
    triceps.focus();
    await user.keyboard(' ');
    await user.type(within(dialog).getByRole('textbox', { name: 'Notes' }), 'Actual session');
    expect(triceps).toHaveProperty('checked', false);
    expect(within(dialog).getByRole('checkbox', { name: 'Abs' })).toHaveProperty('checked', true);

    await user.click(within(dialog).getByRole('button', { name: 'Save workout' }));
    const saved = onChange.mock.calls[0]?.[0];
    expect(saved?.workouts[0]).toMatchObject({
      savedWorkoutId: 'saved-upper',
      workoutName: 'Upper Body',
      muscleIds: ['biceps', 'shoulders', 'abs'],
      notes: 'Actual session'
    });
    expect(saved?.savedWorkouts[0]?.muscleIds).toEqual(['chest', 'back', 'biceps', 'triceps', 'shoulders']);
    expect(data.savedWorkouts[0]?.muscleIds).toEqual(['chest', 'back', 'biceps', 'triceps', 'shoulders']);
  });

  it('keeps a specific Strength Rhythm linked when its workout selection is adjusted', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    data.savedWorkouts = [{
      id: 'saved-upper',
      name: 'Upper Body',
      muscleIds: ['chest', 'back', 'biceps', 'triceps', 'shoulders'],
      sharedWith: []
    }];
    const { onChange, rhythm } = renderStrength(data, 'specific', null, 'saved-upper');
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    await user.click(screen.getByRole('button', { name: /^Log workout/ }));
    const dialog = screen.getByRole('dialog', { name: 'Log workout' });
    expect(within(dialog).getByText('Upper Body')).toBeTruthy();
    expect(within(dialog).queryByLabelText('Saved workout (optional)')).toBeNull();
    await user.click(within(dialog).getByRole('checkbox', { name: 'Chest' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save workout' }));
    expect(onChange.mock.calls[0]?.[0].workouts[0]).toMatchObject({
      savedWorkoutId: 'saved-upper',
      muscleIds: ['back', 'biceps', 'triceps', 'shoulders'],
      rhythmId: rhythm.id,
      rhythmOccurrence: '2026-10-22'
    });
    expect(onChange.mock.calls[0]?.[0].workouts[0]?.completionId).toBeTruthy();
  });

  it('edits only the logged muscle snapshot and preserves the template and other history rows', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    data.savedWorkouts = [{
      id: 'saved-upper',
      name: 'Upper Body',
      muscleIds: ['chest', 'back', 'shoulders'],
      sharedWith: []
    }];
    data.workouts = [
      { id: 'edit-this-log', date: '2026-10-22', muscleIds: ['chest'], savedWorkoutId: 'saved-upper', workoutName: 'Upper Body' },
      { id: 'keep-this-log', date: '2026-10-21', muscleIds: ['abs'], savedWorkoutId: 'saved-upper', workoutName: 'Upper Body' }
    ];
    const { onChange } = renderStrength(data);
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    await user.click(screen.getByRole('tab', { name: 'History' }));
    const row = screen.getByRole('button', { name: /View Upper Body, Oct 22, 2026/ });
    await user.click(row);
    const details = screen.getByRole('dialog', { name: 'Upper Body' });
    await user.click(within(details).getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit workout log' });
    expect(within(dialog).getByRole('checkbox', { name: 'Chest' })).toHaveProperty('checked', true);
    expect(within(dialog).getByRole('checkbox', { name: 'Back' })).toHaveProperty('checked', false);
    await user.click(within(dialog).getByRole('checkbox', { name: 'Chest' }));
    await user.click(within(dialog).getByText('Abs'));
    await user.click(within(dialog).getByRole('button', { name: 'Save workout' }));

    const saved = onChange.mock.calls[0]?.[0];
    expect(saved?.workouts).toEqual([
      expect.objectContaining({ id: 'edit-this-log', muscleIds: ['abs'], savedWorkoutId: 'saved-upper' }),
      data.workouts[1]
    ]);
    expect(saved?.savedWorkouts[0]?.muscleIds).toEqual(['chest', 'back', 'shoulders']);
    expect(screen.getByRole('tab', { name: 'Workouts' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'History' }).getAttribute('aria-selected')).toBe('true');
  });

  it('provides keyboard-accessible Strength tabs and an empty History state with correct counts', async () => {
    const user = userEvent.setup();
    renderStrength();
    const list = screen.getByRole('tablist', { name: 'Strength views' });
    const training = within(list).getByRole('tab', { name: 'Training' });
    const workouts = within(list).getByRole('tab', { name: 'Workouts' });
    const rhythms = within(list).getByRole('tab', { name: 'Rhythms' });
    expect(workouts.getAttribute('aria-selected')).toBe('false');

    training.focus();
    await user.keyboard('{ArrowLeft}');
    expect(rhythms.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(rhythms);
    await user.keyboard('{Home}');
    expect(training.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{End}');
    expect(rhythms.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{ArrowLeft}');
    expect(workouts.getAttribute('aria-selected')).toBe('true');
    expect(workouts.getAttribute('tabindex')).toBe('0');
    const savedTabs = screen.getByRole('tablist', { name: 'Workouts views' });
    const saved = within(savedTabs).getByRole('tab', { name: 'Saved Workouts' });
    const history = within(savedTabs).getByRole('tab', { name: 'History' });
    expect(saved.getAttribute('aria-selected')).toBe('true');
    expect(saved.getAttribute('tabindex')).toBe('0');
    expect(history.getAttribute('tabindex')).toBe('-1');
    expect(screen.getByRole('tabpanel', { name: 'Workouts' }).getAttribute('aria-labelledby')).toBe('strength-tab-workouts');

    history.focus();
    await user.keyboard('{ArrowRight}');
    expect(saved.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(saved);
    await user.keyboard('{ArrowLeft}');
    expect(history.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{Home}');
    expect(saved.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{End}');
    expect(history.getAttribute('aria-selected')).toBe('true');
    await user.click(history);

    const panel = screen.getByRole('tabpanel', { name: 'History' });
    expect((panel as HTMLElement).hidden).toBe(false);
    expect(within(panel).getByText('0 workouts logged')).toBeTruthy();
    expect(within(panel).getByText('No workouts logged yet.')).toBeTruthy();
    expect(within(list).queryByRole('tab', { name: 'History' })).toBeNull();
  });

  it('shows ten newest workouts, incrementally reveals grouped months, and opens full details', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    data.workouts = [
      ...Array.from({ length: 12 }, (_, index) => ({
        id: `jan-${String(index).padStart(2, '0')}`,
        date: `2026-01-${String(31 - index).padStart(2, '0')}`,
        muscleIds: ['chest'] as ('chest')[],
        ...(index === 0 ? {
          workoutName: 'An exceptionally long workout name that should wrap naturally without truncation',
          notes: 'A full note that remains available in the details view. '.repeat(8)
        } : { workoutName: 'January session' })
      })),
      ...Array.from({ length: 10 }, (_, index) => ({
        id: `dec-${String(index).padStart(2, '0')}`,
        date: `2025-12-${String(31 - index).padStart(2, '0')}`,
        muscleIds: ['back'] as ('back')[],
        workoutName: 'December session'
      })),
      ...Array.from({ length: 3 }, (_, index) => ({
        id: `nov-${String(index).padStart(2, '0')}`,
        date: `2025-11-${String(30 - index).padStart(2, '0')}`,
        muscleIds: ['abs'] as ('abs')[],
        workoutName: 'November session'
      }))
    ];
    renderStrength(data);
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    await user.click(screen.getByRole('tab', { name: 'History' }));
    const panel = screen.getByRole('tabpanel', { name: 'History' });
    expect(within(panel).getByText('25 workouts logged')).toBeTruthy();
    expect(within(panel).getAllByRole('button', { name: /^View / })).toHaveLength(10);
    expect(within(panel).getAllByRole('heading', { name: 'January 2026' })).toHaveLength(1);
    expect(within(panel).queryByRole('heading', { name: 'December 2025' })).toBeNull();

    await user.click(within(panel).getByRole('button', { name: 'Show 10 more' }));
    expect(within(panel).getAllByRole('button', { name: /^View / })).toHaveLength(20);
    expect(within(panel).getAllByRole('heading', { name: 'January 2026' })).toHaveLength(1);
    expect(within(panel).getByRole('heading', { name: 'December 2025' })).toBeTruthy();
    await user.click(within(panel).getByRole('button', { name: 'Show 10 more' }));
    expect(within(panel).getAllByRole('button', { name: /^View / })).toHaveLength(25);
    expect(within(panel).queryByRole('button', { name: 'Show 10 more' })).toBeNull();
    expect(within(panel).getByRole('heading', { name: 'November 2025' })).toBeTruthy();

    const firstRow = within(panel).getByRole('button', { name: /exceptionally long workout name/ });
    await user.click(firstRow);
    const details = screen.getByRole('dialog', { name: /exceptionally long workout name/ });
    expect(within(details).getByText(/full note that remains available in the details view/)).toBeTruthy();
    expect(within(details).getByText('Chest')).toBeTruthy();
    await user.click(within(details).getByRole('button', { name: 'Close workout details' }));
    expect(document.activeElement).toBe(firstRow);
  });

  it('uses the logged muscle snapshot in History even when its saved template has changed', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    data.savedWorkouts = [{
      id: 'template-edited-after-log',
      name: 'Upper Body',
      muscleIds: ['quads'],
      sharedWith: []
    }];
    data.workouts = [{
      id: 'historical-snapshot',
      date: '2026-10-22',
      muscleIds: ['chest', 'back'],
      savedWorkoutId: 'template-edited-after-log',
      workoutName: 'Upper Body'
    }];
    renderStrength(data);
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    await user.click(screen.getByRole('tab', { name: 'History' }));
    const row = screen.getByRole('button', { name: /View Upper Body.*Chest, Back/ });
    expect(row.textContent).toContain('Chest · Back');
    await user.click(row);
    const details = screen.getByRole('dialog', { name: 'Upper Body' });
    expect(within(details).getByText('Chest · Back')).toBeTruthy();
    expect(within(details).queryByText('Quads')).toBeNull();
  });

  it('updates the visible-history announcement when an edited date moves outside the loaded range', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    data.workouts = Array.from({ length: 11 }, (_, index) => ({
      id: `history-${index}`,
      date: `2026-10-${String(22 - index).padStart(2, '0')}`,
      muscleIds: ['chest'] as ('chest')[],
      workoutName: `Workout ${index}`
    }));
    const { changes } = renderStatefulStrength(data);
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    await user.click(screen.getByRole('tab', { name: 'History' }));
    const firstRow = screen.getByRole('button', { name: /View Workout 0/ });
    await user.click(firstRow);
    const details = screen.getByRole('dialog', { name: 'Workout 0' });
    await user.click(within(details).getByRole('button', { name: 'Edit' }));
    const editor = screen.getByRole('dialog', { name: 'Edit workout log' });
    const dateInput = within(editor).getByLabelText('Workout date');
    await user.clear(dateInput);
    await user.type(dateInput, '2026-01-01');
    await user.click(within(editor).getByRole('button', { name: 'Save workout' }));
    expect(changes.at(-1)?.workouts.find(log => log.id === 'history-0')?.date).toBe('2026-01-01');
    expect(screen.getByRole('status').textContent).toBe('Workout updated. It is outside the currently shown recent entries.');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'History' }));
  });

  it('requires delete confirmation, restores focus on cancel, and focuses the History tab after deleting the only entry', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    data.workouts = [{ id: 'only-log', date: '2026-10-22', muscleIds: ['chest'], notes: 'Keep history accurate' }];
    const { changes } = renderStatefulStrength(data);
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    await user.click(screen.getByRole('tab', { name: 'History' }));
    expect(screen.getByText('1 workout logged')).toBeTruthy();
    const row = screen.getByRole('button', { name: /View Custom workout/ });
    await user.click(row);
    let details = screen.getByRole('dialog', { name: 'Custom workout' });
    const deleteAction = within(details).getByRole('button', { name: 'Delete' });
    await user.click(deleteAction);
    const confirmation = within(details).getByRole('alertdialog', { name: 'Delete this workout?' });
    await user.click(within(confirmation).getByRole('button', { name: 'Cancel' }));
    const restoredDeleteAction = within(details).getByRole('button', { name: 'Delete' });
    expect(document.activeElement).toBe(restoredDeleteAction);

    await user.click(restoredDeleteAction);
    details = screen.getByRole('dialog', { name: 'Custom workout' });
    const deleteConfirmation = within(details).getByRole('alertdialog', { name: 'Delete this workout?' });
    await user.click(within(deleteConfirmation).getByRole('button', { name: 'Delete workout' }));
    expect(changes.at(-1)?.workouts).toEqual([]);
    expect(screen.queryByRole('dialog', { name: 'Custom workout' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'History' }));
    expect(screen.getByText('0 workouts logged')).toBeTruthy();
  });

  it('keeps general logging selectable, reinitializes muscles when the template changes, and supports custom work', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    data.savedWorkouts = [
      { id: 'upper', name: 'Upper Body', muscleIds: ['chest', 'back', 'shoulders'], sharedWith: [] },
      { id: 'lower', name: 'Lower Body', muscleIds: ['quads', 'hamstrings', 'calves'], sharedWith: [] }
    ];
    const { onChange } = renderStrength(data);
    await user.click(screen.getByRole('button', { name: 'Custom workout' }));
    let dialog = screen.getByRole('dialog', { name: 'Log workout' });
    const workoutSelect = within(dialog).getByLabelText('Saved workout (optional)');
    expect(workoutSelect).toHaveProperty('value', '');
    await user.selectOptions(workoutSelect, 'upper');
    for (const muscle of ['Chest', 'Back', 'Shoulders']) {
      expect(within(dialog).getByRole('checkbox', { name: muscle })).toHaveProperty('checked', true);
    }
    await user.selectOptions(workoutSelect, 'lower');
    for (const muscle of ['Quads', 'Hamstrings', 'Calves']) {
      expect(within(dialog).getByRole('checkbox', { name: muscle })).toHaveProperty('checked', true);
    }
    expect(within(dialog).getByRole('checkbox', { name: 'Chest' })).toHaveProperty('checked', false);

    await user.selectOptions(workoutSelect, '');
    expect(within(dialog).getByRole('checkbox', { name: 'Quads' })).toHaveProperty('checked', false);
    await user.click(within(dialog).getByText('Abs'));
    await user.type(within(dialog).getByRole('textbox', { name: 'Notes' }), 'Custom session');
    expect(within(dialog).getByRole('checkbox', { name: 'Abs' })).toHaveProperty('checked', true);
    await user.click(within(dialog).getByRole('button', { name: 'Save workout' }));
    expect(onChange.mock.calls[0]?.[0].workouts[0]).toMatchObject({
      muscleIds: ['abs'],
      notes: 'Custom session'
    });
    expect(onChange.mock.calls[0]?.[0].workouts[0]?.savedWorkoutId).toBeUndefined();
  });

  it('allows manually logging a muscle that is currently resting', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    data.workouts = [{ id: 'chest-today', date: '2026-10-22', muscleIds: ['chest'] }];
    data.settings.preferredRestDays.chest = 5;
    renderStrength(data);
    await user.click(screen.getByRole('button', { name: 'Custom workout' }));
    const dialog = screen.getByRole('dialog', { name: 'Log workout' });
    const chest = within(dialog).getByRole('checkbox', { name: 'Chest' });
    expect(chest).toHaveProperty('disabled', false);
    await user.click(chest);
    expect(chest).toHaveProperty('checked', true);
  });

  it('keeps a failed log draft open and cancels without creating a workout', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    data.savedWorkouts = [{
      id: 'saved-upper',
      name: 'Upper Body',
      muscleIds: ['chest', 'back', 'biceps', 'triceps', 'shoulders'],
      sharedWith: []
    }];
    const { onChange } = renderStrength(data, 'recommended', 'Preview storage failed.');
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    const opener = screen.getByRole('button', { name: 'Log workout' });
    await user.click(opener);
    let dialog = screen.getByRole('dialog', { name: 'Log workout' });
    await user.click(within(dialog).getByRole('checkbox', { name: 'Chest' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save workout' }));
    dialog = screen.getByRole('dialog', { name: 'Log workout' });
    expect(within(dialog).getByRole('alert').textContent).toBe('Preview storage failed.');
    expect(within(dialog).getByRole('checkbox', { name: 'Chest' })).toHaveProperty('checked', false);
    expect(onChange).toHaveBeenCalledOnce();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onChange).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(opener);
  });

  it('closes the workout log with Escape and restores focus without saving', async () => {
    const user = userEvent.setup();
    const { onChange } = renderStrength();
    const opener = screen.getByRole('button', { name: 'Custom workout' });
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Log workout' });
    await user.click(within(dialog).getByRole('checkbox', { name: 'Chest' }));
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog', { name: 'Log workout' })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);
  });

  it('keeps recommendations, templates and history separate from shared Rhythm content', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    data.savedWorkouts = [{
      id: 'saved-upper',
      name: 'Upper body',
      muscleIds: ['chest', 'back'],
      sharedWith: ['sample-person-avery']
    }];
    const { onChange } = renderStrength(data);
    expect(screen.getByRole('heading', { name: 'Upper body' })).toBeTruthy();
    expect(screen.getByText(/Targets two muscle groups/)).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    expect(screen.getByRole('img', { name: 'Avery Brooks' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Edit$/ }));
    const dialog = screen.getByRole('dialog', { name: 'Edit saved workout' });
    await user.clear(within(dialog).getByRole('textbox', { name: 'Workout name' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Workout name' }), 'Renamed upper');
    await user.click(within(dialog).getByRole('button', { name: 'Save workout' }));
    expect(onChange.mock.calls.at(-1)?.[0].savedWorkouts[0]).toMatchObject({ id: 'saved-upper', name: 'Renamed upper' });
  });

  it('uses the shared People row and picker for add drafts without saving on Done or Cancel', async () => {
    const user = userEvent.setup();
    const { onChange } = renderStrength();
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    const addWorkout = screen.getByRole('button', { name: 'Add workout' });
    await user.click(addWorkout);
    const editor = screen.getByRole('dialog', { name: 'Add saved workout' });
    await user.type(within(editor).getByRole('textbox', { name: 'Workout name' }), 'My workout');
    await user.click(within(editor).getByRole('checkbox', { name: 'Chest' }));
    editor.scrollTop = 137;
    const peopleRow = within(editor).getByRole('button', { name: 'Choose people' });

    expect(within(editor).getByText('People')).toBeTruthy();
    expect(within(peopleRow).getByText('Choose people')).toBeTruthy();
    expect(within(peopleRow).getByText('›')).toBeTruthy();

    await user.click(peopleRow);
    let picker = screen.getByRole('dialog', { name: 'Choose people' });
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    expect(editor.isConnected).toBe(true);
    expect(document.activeElement?.closest('dialog')).toBe(picker);
    expect(editor.scrollTop).toBe(137);
    await user.click(within(picker).getByRole('button', { name: 'Jordan Bell' }));
    await user.click(within(picker).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('dialog', { name: 'Add saved workout' })).toBe(editor);
    expect(document.activeElement).toBe(peopleRow);
    expect(within(editor).queryByRole('img', { name: 'Jordan Bell' })).toBeNull();
    expect(within(editor).getByRole('textbox', { name: 'Workout name' })).toHaveProperty('value', 'My workout');
    expect(within(editor).getByRole('checkbox', { name: 'Chest' })).toHaveProperty('checked', true);
    expect(editor.scrollTop).toBe(137);
    expect(onChange).not.toHaveBeenCalled();

    await user.click(peopleRow);
    picker = screen.getByRole('dialog', { name: 'Choose people' });
    await user.click(within(picker).getByRole('button', { name: 'Avery Brooks' }));
    await user.click(within(picker).getByRole('button', { name: 'Select Parenting people' }));
    expect(within(picker).getByRole('button', { name: 'Avery Brooks' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(within(picker).getByRole('button', { name: 'Done' }));
    expect(document.activeElement).toBe(within(editor).getByRole('button', { name: 'Choose people, Avery Brooks, Morgan Reed and Jordan Bell' }));
    expect(within(editor).getAllByRole('img').map(badge => badge.getAttribute('aria-label')))
      .toEqual(['Avery Brooks', 'Morgan Reed', 'Jordan Bell']);
    expect(editor.scrollTop).toBe(137);
    expect(onChange).not.toHaveBeenCalled();

    await user.click(within(editor).getByRole('button', { name: 'Save workout' }));
    expect(onChange).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(addWorkout);
    expect(onChange.mock.calls[0]?.[0].savedWorkouts[0]).toMatchObject({
      name: 'My workout',
      muscleIds: ['chest'],
      sharedWith: ['sample-person-avery', 'sample-person-morgan', 'sample-person-jordan']
    });

    cleanup();
    const savedData = onChange.mock.calls[0]![0];
    const reloaded = renderStrength(savedData);
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    expect(screen.getByRole('img', { name: 'Avery Brooks' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Morgan Reed' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Jordan Bell' })).toBeTruthy();
    expect(reloaded.onChange).not.toHaveBeenCalled();
  });

  it('keeps the existing People associations selected while editing and saves explicit changes', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    data.savedWorkouts = [{
      id: 'saved-with-people',
      name: 'Partner session',
      muscleIds: ['back'],
      sharedWith: ['sample-person-morgan']
    }];
    const { onChange } = renderStrength(data);
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    await user.click(screen.getByRole('button', { name: /^Edit$/ }));
    const editor = screen.getByRole('dialog', { name: 'Edit saved workout' });
    const peopleRow = within(editor).getByRole('button', { name: 'Choose people, Morgan Reed' });
    expect(within(peopleRow).getByRole('img', { name: 'Morgan Reed' })).toBeTruthy();

    await user.click(peopleRow);
    const picker = screen.getByRole('dialog', { name: 'Choose people' });
    expect(within(picker).getByRole('button', { name: 'Morgan Reed' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(within(picker).getByRole('button', { name: 'Morgan Reed' }));
    await user.click(within(picker).getByRole('button', { name: 'Avery Brooks' }));
    await user.click(within(picker).getByRole('button', { name: 'Done' }));
    expect(within(editor).getByRole('img', { name: 'Avery Brooks' })).toBeTruthy();
    expect(within(editor).queryByRole('img', { name: 'Morgan Reed' })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();

    await user.click(within(editor).getByRole('button', { name: 'Save workout' }));
    expect(onChange.mock.calls[0]?.[0].savedWorkouts[0]).toMatchObject({
      id: 'saved-with-people',
      muscleIds: ['back'],
      sharedWith: ['sample-person-avery']
    });
  });

  it('closes only the foreground People picker on Escape and cancels the unsaved workout draft', async () => {
    const user = userEvent.setup();
    const { onChange } = renderStrength();
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    const addWorkout = screen.getByRole('button', { name: 'Add workout' });
    await user.click(addWorkout);
    const editor = screen.getByRole('dialog', { name: 'Add saved workout' });
    const peopleRow = within(editor).getByRole('button', { name: 'Choose people' });
    await user.click(peopleRow);
    const picker = screen.getByRole('dialog', { name: 'Choose people' });
    await user.click(within(picker).getByRole('button', { name: 'Avery Brooks' }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Choose people' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Add saved workout' })).toBe(editor);
    expect(document.activeElement).toBe(peopleRow);
    expect(within(editor).queryByRole('img', { name: 'Avery Brooks' })).toBeNull();
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(addWorkout);
  });

  it('shows all approved Suggestions and returns from canceled review without saving', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    data.savedWorkouts = [{
      id: 'manual-shoulders-squats',
      name: 'Shoulders & Squats',
      muscleIds: ['shoulders', 'quads'],
      sharedWith: []
    }];
    const { changes } = renderStatefulStrength(data);
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    await user.click(screen.getByRole('button', { name: 'Browse suggested workouts' }));
    let picker = screen.getByRole('dialog', { name: 'Suggested workouts' });
    expect(within(picker).getByText('Choose a starting point. Make it yours.')).toBeTruthy();
    for (const suggestion of strengthWorkoutSuggestions) {
      const row = within(picker).getByRole('heading', { name: suggestion.name }).closest('article');
      expect(row).toBeTruthy();
      expect(within(row!).getByText(suggestion.muscleIds.map(strengthMuscleName).join(' · '))).toBeTruthy();
      expect(within(row!).getByRole('button', { name: 'Add' })).toBeTruthy();
    }

    const upperRow = within(picker).getByRole('heading', { name: 'Upper Body' }).closest('article')!;
    await user.click(within(upperRow).getByRole('button', { name: 'Add' }));
    let editor = screen.getByRole('dialog', { name: 'Add saved workout' });
    expect(within(editor).getByRole('textbox', { name: 'Workout name' })).toHaveProperty('value', 'Upper Body');
    for (const muscle of ['Chest', 'Back', 'Biceps', 'Triceps', 'Shoulders']) {
      expect(within(editor).getByRole('checkbox', { name: muscle })).toHaveProperty('checked', true);
    }
    expect(within(editor).getByRole('button', { name: 'Choose people' })).toBeTruthy();
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
    picker = screen.getByRole('dialog', { name: 'Suggested workouts' });
    expect(changes).toHaveLength(0);
    expect(within(picker).getByRole('heading', { name: 'Upper Body' }).closest('article'))
      .toBeTruthy();
    expect(within(within(picker).getByRole('heading', { name: 'Upper Body' }).closest('article')!)
      .getByRole('button', { name: 'Add' })).toBeTruthy();
  });

  it('saves a suggestion with source identity, then edits the actual saved template without losing its source', async () => {
    const user = userEvent.setup();
    const { changes } = renderStatefulStrength();
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    const browse = screen.getByRole('button', { name: 'Browse suggested workouts' });
    await user.click(browse);
    const picker = screen.getByRole('dialog', { name: 'Suggested workouts' });
    const upperRow = within(picker).getByRole('heading', { name: 'Upper Body' }).closest('article')!;
    await user.click(within(upperRow).getByRole('button', { name: 'Add' }));
    let editor = screen.getByRole('dialog', { name: 'Add saved workout' });
    await user.clear(within(editor).getByRole('textbox', { name: 'Workout name' }));
    await user.type(within(editor).getByRole('textbox', { name: 'Workout name' }), 'My upper session');
    await user.click(within(editor).getByRole('checkbox', { name: 'Back' }));
    await user.dblClick(within(editor).getByRole('button', { name: 'Save workout' }));

    expect(changes).toHaveLength(1);
    const saved = changes[0]!.savedWorkouts.find(workout =>
      workout.suggestionSourceId === 'strength.upper-body'
    )!;
    expect(saved).toMatchObject({
      name: 'My upper session',
      muscleIds: ['chest', 'biceps', 'triceps', 'shoulders'],
      sharedWith: [],
      suggestionSourceId: 'strength.upper-body'
    });
    const addedPicker = screen.getByRole('dialog', { name: 'Suggested workouts' });
    const addedRow = within(addedPicker).getByRole('heading', { name: 'Upper Body' }).closest('article')!;
    expect(within(addedRow).getByRole('status').textContent).toContain('Added');
    await user.click(within(addedRow).getByRole('button', { name: 'Edit' }));
    editor = screen.getByRole('dialog', { name: 'Edit saved workout' });
    expect(within(editor).getByRole('textbox', { name: 'Workout name' })).toHaveProperty('value', 'My upper session');
    expect(within(editor).getByRole('checkbox', { name: 'Back' })).toHaveProperty('checked', false);
    expect(within(editor).getByRole('checkbox', { name: 'Chest' })).toHaveProperty('checked', true);
    await user.clear(within(editor).getByRole('textbox', { name: 'Workout name' }));
    await user.type(within(editor).getByRole('textbox', { name: 'Workout name' }), 'Renamed upper');
    await user.click(within(editor).getByRole('button', { name: 'Save workout' }));
    expect(changes).toHaveLength(2);
    expect(changes[1]!.savedWorkouts.find(workout => workout.id === saved.id)).toMatchObject({
      name: 'Renamed upper',
      suggestionSourceId: 'strength.upper-body'
    });
    expect(screen.getByRole('dialog', { name: 'Suggested workouts' })).toBeTruthy();
  });

  it('offers an explicit instance choice for multiple source-linked templates and reopens deleted suggestions', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    data.savedWorkouts = [
      {
        id: 'arms-one',
        name: 'Arm day A',
        muscleIds: ['biceps', 'triceps'],
        sharedWith: [],
        suggestionSourceId: 'strength.arms'
      },
      {
        id: 'arms-two',
        name: 'Arm day B',
        muscleIds: ['biceps', 'triceps'],
        sharedWith: [],
        suggestionSourceId: 'strength.arms'
      }
    ];
    const { changes } = renderStatefulStrength(data);
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    await user.click(screen.getByRole('button', { name: 'Browse suggested workouts' }));
    let picker = screen.getByRole('dialog', { name: 'Suggested workouts' });
    let armsRow = within(picker).getByRole('heading', { name: 'Arms' }).closest('article')!;
    expect(within(armsRow).getByRole('status').textContent).toContain('2 added');
    await user.click(within(armsRow).getByRole('button', { name: 'Edit' }));
    const choices = within(armsRow).getByRole('group', { name: 'Choose a saved Arms workout to edit' });
    expect(within(choices).getByText('Arm day A')).toBeTruthy();
    expect(within(choices).getByText('Arm day B')).toBeTruthy();
    await user.click(within(choices).getAllByRole('button', { name: 'Edit' })[1]!);
    const editor = screen.getByRole('dialog', { name: 'Edit saved workout' });
    expect(within(editor).getByRole('textbox', { name: 'Workout name' })).toHaveProperty('value', 'Arm day B');
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
    picker = screen.getByRole('dialog', { name: 'Suggested workouts' });
    expect(changes).toHaveLength(0);

    cleanup();
    const singleLinked = createStrengthData();
    singleLinked.savedWorkouts = [data.savedWorkouts[0]!];
    const { changes: deleteChanges } = renderStatefulStrength(singleLinked);
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    await user.click(screen.getByRole('button', { name: /^Delete$/ }));
    expect(deleteChanges).toHaveLength(1);
    expect(deleteChanges[0]?.savedWorkouts).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Browse suggested workouts' }));
    picker = screen.getByRole('dialog', { name: 'Suggested workouts' });
    armsRow = within(picker).getByRole('heading', { name: 'Arms' }).closest('article')!;
    expect(within(armsRow).queryByRole('status')).toBeNull();
    expect(within(armsRow).getByRole('button', { name: 'Add' })).toBeTruthy();
  });
});
