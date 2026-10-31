import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StrengthView } from '../src/components/StrengthView.tsx';
import {
  createStrengthData,
  createStrengthGuidedSession,
  saveStrengthScoringSetup,
  strengthMuscleName,
  strengthWorkoutSuggestions
} from '../src/domain/strength.ts';
import type { StrengthData, StrengthMode, StrengthSavedWorkout } from '../src/domain/strength.ts';
import { todayRhythms } from '../src/domain/preview-data.ts';
import type { CategoryId } from '../src/domain/preview-data.ts';

const testRestorers: Array<() => void> = [];

afterEach(() => {
  cleanup();
  document.querySelectorAll('[data-test-rhythm-opener]').forEach(element => element.remove());
  vi.useRealTimers();
  vi.unstubAllGlobals();
  for (const restore of testRestorers.splice(0)) restore();
});

function renderStrength(
  data = createStrengthData(),
  mode: StrengthMode = 'recommended',
  saveError: string | null = null,
  workoutId?: string,
  startRhythmLog = false
) {
  const onChange = vi.fn((_next: StrengthData) => saveError);
  const rhythm = {
    ...todayRhythms[0]!,
    id: 'health-strength-rhythm',
    categoryIds: ['health'] as CategoryId[]
  };
  const opener = startRhythmLog ? document.createElement('button') : undefined;
  if (opener) {
    opener.dataset.testRhythmOpener = 'true';
    document.body.append(opener);
  }
  const result = render(
    <StrengthView
      data={data}
      rhythms={[{ rhythm, mode, ...(workoutId ? { workoutId } : {}) }]}
      evaluationDate="2026-10-22"
      onChange={onChange}
      {...(opener
        ? { pendingRhythmLog: { requestId: 1, rhythm, mode, ...(workoutId ? { workoutId } : {}), opener } }
        : {})}
    />
  );
  return { ...result, onChange, rhythm, opener };
}

function renderStatefulStrength(initialData = createStrengthData()) {
  const changes: StrengthData[] = [];
  const rhythm = {
    ...todayRhythms[0]!,
    id: 'health-strength-rhythm',
    categoryIds: ['health'] as CategoryId[]
  };
  function StatefulStrength() {
    const [data, setData] = useState(initialData);
    return (
      <StrengthView
        data={data}
        rhythms={[{ rhythm, mode: 'recommended' }]}
        evaluationDate="2026-10-22"
        onChange={next => {
          changes.push(next);
          setData(next);
          return null;
        }}
      />
    );
  }
  return { ...render(<StatefulStrength />), changes };
}

async function openSavedWorkoutMenu(
  user: ReturnType<typeof userEvent.setup>,
  workoutName: string
): Promise<HTMLElement> {
  const card = screen.getByRole('heading', { name: workoutName }).closest('article');
  if (!card) throw new Error(`Saved workout card not found: ${workoutName}`);
  const summary = card.querySelector('.strength-template__menu > summary');
  if (!(summary instanceof HTMLElement)) throw new Error(`Saved workout actions not found: ${workoutName}`);
  await user.click(summary);
  return card;
}

async function expandMuscleDisclosure(
  user: ReturnType<typeof userEvent.setup>,
  container: HTMLElement
) {
  const disclosure = container.querySelector<HTMLDetailsElement>('.strength-muscle-disclosure');
  if (disclosure && !disclosure.open) {
    const summary = disclosure.querySelector('summary');
    if (summary) await user.click(summary);
  }
}

describe('Strength preview presentation', () => {
  it('uses the shared full-width action row for empty and populated Saved Workouts', () => {
    const empty = renderStrength();
    fireEvent.click(screen.getByRole('tab', { name: 'Workouts' }));
    const savedWorkouts = screen.getByRole('region', { name: 'Saved workouts' });
    const emptyActions = savedWorkouts.querySelector('.category-rhythm-entry-actions')!;
    expect([...emptyActions.querySelectorAll('button')].map(button => button.textContent?.trim()))
      .toEqual(['Add workout', 'Suggestions']);
    expect(emptyActions.classList.contains('category-rhythm-entry-actions')).toBe(true);
    expect(within(savedWorkouts).getByText('No saved workouts yet. Create one to quickly log your usual muscle groups.'))
      .toBeTruthy();
    expect(within(savedWorkouts).getByText('Workout templates are separate from recorded activity.')).toBeTruthy();
    empty.unmount();

    const data = createStrengthData();
    data.savedWorkouts = [{
      id: 'populated-saved-workout',
      name: 'Synthetic upper body',
      muscleIds: ['chest', 'back'],
      sharedWith: []
    }];
    renderStrength(data);
    fireEvent.click(screen.getByRole('tab', { name: 'Workouts' }));
    const populatedWorkouts = screen.getByRole('region', { name: 'Saved workouts' });
    const populatedActions = populatedWorkouts.querySelector('.category-rhythm-entry-actions')!;
    expect([...populatedActions.querySelectorAll('button')].map(button => button.textContent?.trim()))
      .toEqual(['Add workout', 'Suggestions']);
    expect(within(populatedWorkouts).getByRole('heading', { name: 'Synthetic upper body' })).toBeTruthy();
    expect(within(populatedWorkouts).queryByText('No saved workouts yet. Create one to quickly log your usual muscle groups.'))
      .toBeNull();
  });

  it('keeps Saved Workout cards on full-width rows with overflow actions and an Add exercises route', async () => {
    const data = createStrengthData();
    data.savedWorkouts = [
      {
        id: 'long-saved-card',
        name: 'A deliberately long saved workout title that wraps naturally',
        muscleIds: ['chest', 'back', 'biceps', 'triceps', 'shoulders', 'abs', 'quads', 'hamstrings', 'calves'],
        sharedWith: [],
        exercises: [{
          id: 'saved-card-exercise',
          name: 'Bench Press',
          muscleIds: ['chest'],
          equipment: 'Barbell',
          loadMeaning: 'total',
          restDurationSeconds: 180,
          sets: [{ id: 'saved-card-set-1', targetReps: 10 }, { id: 'saved-card-set-2', targetReps: 10 }, { id: 'saved-card-set-3', targetReps: 10 }]
        }]
      },
      {
        id: 'empty-saved-card',
        name: 'Exercise-free template',
        muscleIds: ['back', 'biceps'],
        sharedWith: []
      }
    ];
    const user = userEvent.setup();
    renderStrength(data);
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    const savedRegion = screen.getByRole('region', { name: 'Saved workouts' });
    const longCard = within(savedRegion)
      .getByRole('heading', { name: 'A deliberately long saved workout title that wraps naturally' })
      .closest('article')!;
    expect(longCard.classList.contains('strength-template')).toBe(true);
    expect(longCard.querySelector('.strength-template__content')).toBeTruthy();
    expect(within(longCard).getByText(strengthMuscleName('chest') + ' · Back · Biceps · Triceps · Shoulders · Abs · Quads · Hamstrings · Calves'))
      .toBeTruthy();
    expect(within(longCard).getByText('1 exercise · 3 planned sets')).toBeTruthy();
    expect(within(longCard).getByRole('button', { name: 'Start workout' })).toBeTruthy();
    expect(within(longCard).getByRole('button', { name: 'Log workout' })).toBeTruthy();
    expect(longCard.querySelector<HTMLDetailsElement>('.strength-template__menu')?.open).toBe(false);
    await user.click(longCard.querySelector('.strength-template__menu > summary')!);
    expect(within(longCard).getByRole('button', { name: 'Edit workout' })).toBeTruthy();
    expect(within(longCard).getByRole('button', { name: 'Delete workout' })).toBeTruthy();

    const emptyCard = within(savedRegion).getByRole('heading', { name: 'Exercise-free template' }).closest('article')!;
    await user.click(within(emptyCard).getByRole('button', { name: 'Add exercises' }));
    const editor = screen.getByRole('dialog', { name: 'Edit saved workout' });
    expect(within(editor).getByRole('button', { name: 'Add exercise' })).toBeTruthy();
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
  });

  it('saves every suggestion with its editable load meaning and only declared supersets', async () => {
    const user = userEvent.setup();
    const { changes } = renderStatefulStrength();
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    await user.click(screen.getByRole('button', { name: 'Suggestions' }));

    for (const suggestion of strengthWorkoutSuggestions) {
      const picker = screen.getByRole('dialog', { name: 'Suggested workouts' });
      const row = within(picker).getByRole('heading', { name: suggestion.name }).closest('article')!;
      await user.click(within(row).getByRole('button', { name: 'Add' }));
      const editor = screen.getByRole('dialog', { name: 'Add saved workout' });
      expect(within(editor).queryByText('Set a load meaning for every exercise before saving this workout.')).toBeNull();
      await user.click(within(editor).getByRole('button', { name: 'Save workout' }));
      const saved = changes.at(-1)?.savedWorkouts.find(item => item.suggestionSourceId === suggestion.sourceId);
      expect(saved).toBeTruthy();
      expect(saved?.exercises?.every(exercise => exercise.loadMeaning !== undefined)).toBe(true);
      expect(saved?.exercises?.flatMap(exercise => exercise.sets).every(set => set.targetLoad === undefined)).toBe(true);
      expect(saved?.supersetGroups).toHaveLength(suggestion.sourceId === 'strength.power-abs' ? 1 : 0);
    }

    expect(changes).toHaveLength(strengthWorkoutSuggestions.length);
  });

  it('keeps pairing in the exercise overflow menu and summarizes repeated targets once', async () => {
    const user = userEvent.setup();
    const { changes } = renderStatefulStrength();
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    await user.click(screen.getByRole('button', { name: 'Suggestions' }));
    const picker = screen.getByRole('dialog', { name: 'Suggested workouts' });
    const suggestion = strengthWorkoutSuggestions.find(item => item.sourceId === 'strength.arms-shoulders')!;
    await user.click(within(within(picker).getByRole('heading', { name: suggestion.name }).closest('article')!)
      .getByRole('button', { name: 'Add' }));
    const editor = screen.getByRole('dialog', { name: 'Add saved workout' });
    const firstExercise = within(editor).getByRole('button', { name: /Edit Dumbbell Overhead Press/ });
    expect(firstExercise.textContent).toContain('Dumbbells · 3 × 10 reps · Rest 2:00');
    expect(editor.querySelector('.strength-exercises__pair')).toBeNull();
    expect(editor.querySelectorAll('.strength-exercises__superset-badge')).toHaveLength(0);

    const firstMenu = editor.querySelector('.strength-exercises__menu > summary')!;
    await user.click(firstMenu);
    await user.click(within(firstExercise.closest('li')!)
      .getByRole('button', { name: 'Pair with next' }));
    expect(editor.querySelectorAll('.strength-exercises__superset-badge')).toHaveLength(2);
    expect(editor.querySelectorAll('.strength-exercises__superset-controls')).toHaveLength(1);
    await user.click(editor.querySelector('.strength-exercises__menu > summary')!);
    await user.click(within(editor).getByRole('button', { name: 'Unpair Dumbbell Overhead Press and Incline Dumbbell Curl' }));
    expect(editor.querySelectorAll('.strength-exercises__superset-badge')).toHaveLength(0);
    expect(changes).toHaveLength(0);
  });

  it('renders the interactive body map and changes selected muscle by keyboard', async () => {
    const user = userEvent.setup();
    renderStrength();

    expect(screen.getByRole('group', { name: 'Front muscle training status map' })).toBeTruthy();
    const map = screen.getByRole('group', { name: 'Front muscle training status map' });
    const chest = within(map).getByRole('button', { name: 'Chest, Health score unavailable, Not logged yet.' });
    chest.focus();
    await user.keyboard('{Enter}');
    expect(chest.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('heading', { name: /Chest/ })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('group', { name: 'Back muscle training status map' })).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Muscle training status' }))
      .getByRole('button', { name: 'Back, Health score unavailable, Not logged yet.' })).toBeTruthy();
  });

  it('uses the paired Health gauges and one tracking setup callout', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    data.workouts = [{ id: 'legacy-chest', date: '2026-10-21', muscleIds: ['chest'] }];
    renderStrength(data);

    expect(screen.getByRole('heading', { name: 'Chest' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Health' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Strength Health: Not enough data' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Consistency: Score unavailable' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'On Track: Score unavailable' })).toBeTruthy();
    expect(screen.getByText('Set up tracking to see your scores.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Set up tracking' })).toBeTruthy();
    expect(screen.queryByText(/effective-dated settings/i)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Set up tracking' }));
    expect(screen.getByRole('dialog', { name: 'Strength training goals' })).toBeTruthy();
  });

  it('shows compact training facts and separates logged readiness from score evidence', async () => {
    const user = userEvent.setup();
    const data = saveStrengthScoringSetup(createStrengthData(), '2026-10-01', '2026-10-01');
    data.workouts = [{ id: 'legacy-chest', date: '2026-10-21', muscleIds: ['chest'] }];
    renderStrength(data);

    const facts = document.querySelector('.strength-muscle-facts') as HTMLElement;
    expect(within(facts).getByText('Training interval')).toBeTruthy();
    expect(within(facts).getByText('Every 7 days')).toBeTruthy();
    expect(within(facts).getByText('Rest between training')).toBeTruthy();
    expect(within(facts).getByText('1 day')).toBeTruthy();
    expect(within(facts).getByText('Readiness')).toBeTruthy();
    expect(within(facts).getByText('Ready tomorrow')).toBeTruthy();
    expect(within(facts).getByText('Last logged')).toBeTruthy();
    expect(within(facts).getByText('Oct 21, 2026')).toBeTruthy();
    expect(screen.getByText('Your score will appear as tracking builds.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Show Strength Health scoring details' }));
    const explanation = screen.getByRole('region', { name: 'Strength Health scoring details' });
    expect(within(explanation).getByText('How often you trained in completed periods over the last 28 days.')).toBeTruthy();
    expect(within(explanation).getByText('How recently you trained compared with your schedule.')).toBeTruthy();
    expect(within(explanation).getByText('75% Consistency + 25% On Track.')).toBeTruthy();
    await user.click(within(explanation).getByText('Details'));
    expect(within(explanation).getByText('Readiness uses logged workout dates; scoring requires confirmed performed sets.')).toBeTruthy();
  });

  it('keeps legacy training status separate from unavailable Fitness Health', () => {
    const data = createStrengthData();
    data.settings.muscleIntervals.chest = 1;
    data.workouts = [{ id: 'old-chest', date: '2026-10-01', muscleIds: ['chest'] }];
    renderStrength(data);

    expect(screen.getByRole('meter', { name: 'Strength training status score' }).getAttribute('aria-valuenow')).toBe('0');
    const muscleList = screen.getByRole('group', { name: 'Muscle training status' });
    expect(within(muscleList).getByRole('button', { name: 'Chest, Health score unavailable, 20 days overdue.' })).toBeTruthy();
    expect(within(muscleList).getByRole('button', { name: 'Abs, Health score unavailable, Not logged yet.' })).toBeTruthy();
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

  it('edits per-muscle between-set preferences without changing saved workouts or history', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    data.savedWorkouts = [{
      id: 'preserved-workout',
      name: 'Existing Chest',
      muscleIds: ['chest'],
      sharedWith: [],
      exercises: [{
        id: 'preserved-exercise',
        name: 'Bench Press',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        restDurationSeconds: 75,
        restDurationOverridden: true,
        sets: [{ id: 'preserved-set', targetReps: 8 }]
      }]
    }];
    data.workouts = [{ id: 'preserved-history', date: '2026-10-20', muscleIds: ['chest'] }];
    const savedWorkouts = structuredClone(data.savedWorkouts);
    const workouts = structuredClone(data.workouts);
    const { onChange } = renderStrength(data);

    await user.click(screen.getByRole('button', { name: 'Training goals' }));
    const dialog = screen.getByRole('dialog', { name: 'Strength training goals' });
    const chestRest = within(dialog).getByRole('combobox', { name: 'Chest rest between sets' });
    const absRest = within(dialog).getByRole('combobox', { name: 'Abs rest between sets' });
    expect(chestRest).toHaveProperty('value', '180');
    expect(absRest).toHaveProperty('value', '120');

    await user.selectOptions(chestRest, 'custom');
    const customChest = within(dialog).getByRole('spinbutton', { name: 'Chest custom rest between sets in seconds' });
    await user.clear(customChest);
    await user.type(customChest, '240');
    await user.selectOptions(absRest, '90');
    await user.click(within(dialog).getByRole('button', { name: 'Save goals' }));

    expect(onChange).toHaveBeenCalledOnce();
    const next = onChange.mock.calls[0]![0];
    expect(next.settings.betweenSetRestSeconds).toMatchObject({ chest: 240, abs: 90 });
    expect(next.savedWorkouts).toEqual(savedWorkouts);
    expect(next.workouts).toEqual(workouts);
  });

  it('follows muscle defaults for new exercises until the user explicitly overrides rest', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    data.settings.betweenSetRestSeconds.chest = 240;
    const { changes } = renderStatefulStrength(data);
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    await user.click(screen.getByRole('button', { name: 'Add workout' }));
    const workoutDialog = screen.getByRole('dialog', { name: 'Add saved workout' });
    await user.type(within(workoutDialog).getByRole('textbox', { name: 'Workout name' }), 'Chest draft');
    await user.click(within(workoutDialog).getByRole('checkbox', { name: 'Chest' }));
    await user.click(within(workoutDialog).getByRole('button', { name: 'Add exercise' }));
    const exerciseDialog = screen.getByRole('dialog', { name: 'Add exercise' });
    await user.type(within(exerciseDialog).getByRole('textbox', { name: 'Exercise name' }), 'Press');
    await user.type(within(exerciseDialog).getByRole('textbox', { name: 'Equipment' }), 'Barbell');
    await user.click(within(exerciseDialog).getByRole('checkbox', { name: 'Chest' }));
    await user.selectOptions(within(exerciseDialog).getByLabelText('Load meaning'), 'total');
    expect(within(exerciseDialog).getByRole('combobox', { name: 'Rest duration' })).toHaveProperty('value', 'custom');
    expect(within(exerciseDialog).getByRole('spinbutton', { name: 'Custom rest duration in seconds' })).toHaveProperty('value', '240');

    await user.selectOptions(within(exerciseDialog).getByRole('combobox', { name: 'Rest duration' }), '90');
    await user.click(within(exerciseDialog).getByRole('checkbox', { name: 'Chest' }));
    await user.click(within(exerciseDialog).getByRole('checkbox', { name: 'Biceps' }));
    expect(within(exerciseDialog).getByRole('combobox', { name: 'Rest duration' })).toHaveProperty('value', '90');
    await user.type(within(exerciseDialog).getByRole('spinbutton', { name: 'Set 1 reps' }), '8');
    await user.click(within(exerciseDialog).getByRole('button', { name: 'Done' }));
    await user.click(within(workoutDialog).getByRole('button', { name: 'Save workout' }));
    expect(changes[0]?.savedWorkouts[0]?.exercises?.[0]).toMatchObject({
      restDurationSeconds: 90,
      restDurationOverridden: true,
      muscleIds: ['biceps']
    });
  });

  it('opens a linked workout log from a dispatched Rhythm request and restores focus on cancellation', async () => {
    const user = userEvent.setup();
    const { onChange, opener } = renderStrength(createStrengthData(), 'recommended', null, undefined, true);
    const dialog = await screen.findByRole('dialog', { name: 'Log workout' });
    expect(within(dialog).getByLabelText('Workout date')).toHaveProperty('value', '2026-10-22');
    expect(within(dialog).getByLabelText('Saved workout (optional)')).toHaveProperty('value', '');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);
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
    const { onChange, rhythm } = renderStrength(data, 'specific', null, 'saved-upper', true);
    const dialog = await screen.findByRole('dialog', { name: 'Log workout' });
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
    const data = createStrengthData();
    const template: StrengthSavedWorkout = {
      id: 'tab-state-template',
      name: 'Tab state',
      muscleIds: ['chest'],
      sharedWith: [],
      exercises: [{
        id: 'tab-state-exercise',
        name: 'Bench Press',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        restDurationSeconds: 180,
        sets: [{ id: 'tab-state-set', targetReps: 8, targetLoad: { kind: 'external', meaning: 'total', value: 100, unit: 'lb' } }]
      }]
    };
    const draft = createStrengthGuidedSession(template, {
      id: 'tab-state-session',
      date: '2026-10-30',
      startedAt: '2026-10-30T12:00:00.000Z',
      timeZone: 'UTC'
    });
    expect(draft.valid).toBe(true);
    if (!draft.valid) return;
    data.guidedSessionDraft = draft.session;
    renderStrength(data);
    expect(screen.getByRole('heading', { name: 'Strength' }).tagName).toBe('H3');
    expect(screen.getByText('Your training, at a glance.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Resume workout' })).toBeTruthy();
    const list = screen.getByRole('tablist', { name: 'Strength views' });
    expect(list.classList.contains('segmented-tabs--compact')).toBe(true);
    const training = within(list).getByRole('tab', { name: 'Training' });
    const workouts = within(list).getByRole('tab', { name: 'Workouts' });
    expect(training.getAttribute('aria-controls')).toBe('strength-panel-training');
    expect(document.getElementById('strength-panel-training')?.getAttribute('aria-labelledby')).toBe('strength-tab-training');
    expect(workouts.getAttribute('aria-selected')).toBe('false');

    training.focus();
    await user.keyboard('{ArrowLeft}');
    expect(workouts.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(workouts);
    await user.keyboard('{Home}');
    expect(training.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{End}');
    expect(workouts.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{ArrowLeft}');
    expect(training.getAttribute('aria-selected')).toBe('true');
    expect(training.getAttribute('tabindex')).toBe('0');
    await user.click(workouts);
    expect(workouts.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('button', { name: 'Resume workout' })).toBeTruthy();
    expect(data.guidedSessionDraft).toEqual(draft.session);
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
      workoutName: 'Upper Body',
      startedAt: '2026-10-22T13:15:00.000Z',
      finishedAt: '2026-10-22T14:00:00.000Z',
      timeZone: 'America/New_York'
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
    expect(within(details).getByText('Exercise details were not recorded for this workout.')).toBeTruthy();
    expect(within(details).getByText('Oct 22, 2026 · 9:15 AM–10:00 AM')).toBeTruthy();
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
    const savedCard = await openSavedWorkoutMenu(user, 'Upper body');
    await user.click(within(savedCard).getByRole('button', { name: 'Edit workout' }));
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
    await expandMuscleDisclosure(user, editor);
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
    const savedCard = await openSavedWorkoutMenu(user, 'Partner session');
    await user.click(within(savedCard).getByRole('button', { name: 'Edit workout' }));
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
    await user.click(screen.getByRole('button', { name: 'Suggestions' }));
    let picker = screen.getByRole('dialog', { name: 'Suggested workouts' });
    expect(within(picker).getByText('Choose a starting point. Make it yours.')).toBeTruthy();
    for (const suggestion of strengthWorkoutSuggestions) {
      const row = within(picker).getByRole('heading', { name: suggestion.name }).closest('article');
      expect(row).toBeTruthy();
      expect(within(row!).getByText(suggestion.muscleIds.map(strengthMuscleName).join(' · '))).toBeTruthy();
      expect(within(row!).getByRole('button', { name: 'Add' })).toBeTruthy();
    }
    expect(within(within(picker).getByRole('heading', { name: 'Power Abs' }).closest('article')!)
      .getByText(/Superset/)).toBeTruthy();
    expect(within(within(picker).getByRole('heading', { name: 'Plank' }).closest('article')!)
      .getByText(/1 timed set/)).toBeTruthy();

    const upperRow = within(picker).getByRole('heading', { name: 'Upper Body' }).closest('article')!;
    await user.click(within(upperRow).getByRole('button', { name: 'Add' }));
    let editor = screen.getByRole('dialog', { name: 'Add saved workout' });
    expect(within(editor).getByRole('textbox', { name: 'Workout name' })).toHaveProperty('value', 'Upper Body');
    await expandMuscleDisclosure(user, editor);
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

  it('saves and starts the Power Abs draft with alternating pair order and pair rest', async () => {
    const user = userEvent.setup();
    const { changes } = renderStatefulStrength();
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    await user.click(screen.getByRole('button', { name: 'Suggestions' }));
    const picker = screen.getByRole('dialog', { name: 'Suggested workouts' });
    const powerAbs = within(picker).getByRole('heading', { name: 'Power Abs' }).closest('article')!;
    expect(within(powerAbs).getByText(/Superset/)).toBeTruthy();
    await user.click(within(powerAbs).getByRole('button', { name: 'Add' }));

    const editor = screen.getByRole('dialog', { name: 'Add saved workout' });
    expect(editor.querySelectorAll('.strength-exercises__superset-badge')).toHaveLength(2);
    const pairRest = within(editor).getByRole('combobox', { name: 'Rest after Weighted Decline Sit-Up superset round' });
    expect(pairRest).toHaveProperty('value', '120');
    await user.selectOptions(pairRest, '150');
    await user.click(within(editor).getByRole('button', { name: 'Edit Weighted Decline Sit-Up' }));
    const exerciseEditor = screen.getByRole('dialog', { name: 'Edit exercise' });
    await user.selectOptions(within(exerciseEditor).getByLabelText('Load meaning'), 'total');
    await user.click(within(exerciseEditor).getByRole('button', { name: 'Done' }));
    await user.click(within(editor).getByRole('button', { name: 'Save workout' }));
    await user.click(screen.getByRole('button', { name: 'Close suggested workouts' }));

    const savedRegion = screen.getByRole('region', { name: 'Saved workouts' });
    const savedCard = within(savedRegion).getByRole('heading', { name: 'Power Abs' }).closest('article')!;
    await user.click(within(savedCard).getByRole('button', { name: 'Start workout' }));
    const session = screen.getByRole('dialog', { name: 'Power Abs' });
    expect(within(session).getByText('1 of 2')).toBeTruthy();
    expect(session.querySelector('.strength-guided__superset-context')?.textContent?.replace(/\s+/g, ' '))
      .toContain('Superset · Round 1 of 3 · Next: Roman Chair Leg Raise');
    const dateTimeFields = session.querySelector('#strength-guided-date-time-fields') as HTMLDivElement;
    expect(dateTimeFields.hidden).toBe(true);
    const dateTimeToggle = within(session).getByRole('button', { name: 'Edit date and time' });
    expect(dateTimeToggle.getAttribute('aria-expanded')).toBe('false');
    await user.click(dateTimeToggle);
    expect(dateTimeToggle.getAttribute('aria-expanded')).toBe('true');
    expect(dateTimeFields.hidden).toBe(false);
    expect(within(dateTimeFields).getByLabelText('Workout date')).toBeTruthy();
    expect(dateTimeFields.textContent).toMatch(/Start time \(.+\)/);
    await user.click(within(session).getByRole('button', { name: 'Done' }));
    expect(dateTimeFields.hidden).toBe(true);
    await user.click(within(session).getByRole('button', { name: 'Log set 1' }));
    expect(within(session).getByRole('heading', { name: 'Roman Chair Leg Raise' })).toBeTruthy();
    expect(session.querySelector('.strength-guided__superset-context')?.textContent?.replace(/\s+/g, ' '))
      .toContain('Superset · Round 1 of 3 · Next: Weighted Decline Sit-Up');
    expect(within(session).getByText('Tap to start')).toBeTruthy();
    await user.click(within(session).getByRole('button', { name: 'Log set 1' }));
    expect(within(session).getByText(/Superset · Round 2 of 3/)).toBeTruthy();
    expect(within(session).getByText(/Resting · Tap to pause/)).toBeTruthy();
    expect(changes.at(-1)?.workouts).toEqual([]);
    expect(changes.at(-1)?.guidedSessionDraft?.exercises.flatMap(item => item.sets)
      .filter(item => item.status === 'performed')).toHaveLength(2);
    const saved = changes.at(-1)?.savedWorkouts[0]!;
    expect(saved.supersetGroups?.[0]).toMatchObject({
      restDurationSeconds: 150,
      restDurationOverridden: true
    });
    expect(saved.supersetGroups?.[0]?.exerciseIds).toEqual(saved.exercises?.map(item => item.id));
    expect(new Set([
      saved.id,
      saved.supersetGroups?.[0]?.id,
      ...saved.exercises!.map(item => item.id),
      ...saved.exercises!.flatMap(item => item.sets.map(set => set.id))
    ]).size).toBe(10);
  });

  it('edits the Plank time target and resumes explicit early-duration logging', async () => {
    const user = userEvent.setup();
    const { changes } = renderStatefulStrength();
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    await user.click(screen.getByRole('button', { name: 'Suggestions' }));
    const picker = screen.getByRole('dialog', { name: 'Suggested workouts' });
    const plank = within(picker).getByRole('heading', { name: 'Plank' }).closest('article')!;
    expect(within(plank).getByText(/1 timed set/)).toBeTruthy();
    await user.click(within(plank).getByRole('button', { name: 'Add' }));
    let editor = screen.getByRole('dialog', { name: 'Add saved workout' });
    await user.click(within(editor).getByRole('button', { name: 'Edit Plank' }));
    const exerciseEditor = screen.getByRole('dialog', { name: 'Edit exercise' });
    expect(within(exerciseEditor).getByRole('combobox', { name: 'Set measurement' })).toHaveProperty('value', 'duration');
    expect((within(exerciseEditor).getByRole('spinbutton', { name: 'Set 1 target minutes' }) as HTMLInputElement).value).toBe('3');
    expect((within(exerciseEditor).getByRole('spinbutton', { name: 'Set 1 target seconds' }) as HTMLInputElement).value).toBe('0');
    await user.click(within(exerciseEditor).getByRole('button', { name: 'Done' }));
    editor = screen.getByRole('dialog', { name: 'Add saved workout' });
    await user.click(within(editor).getByRole('button', { name: 'Save workout' }));
    await user.click(screen.getByRole('button', { name: 'Close suggested workouts' }));
    const savedRegion = screen.getByRole('region', { name: 'Saved workouts' });
    const savedCard = within(savedRegion).getByRole('heading', { name: 'Plank' }).closest('article')!;
    await user.click(within(savedCard).getByRole('button', { name: 'Start workout' }));

    let session = screen.getByRole('dialog', { name: 'Plank' });
    expect(within(session).getByText('Target · 03:00')).toBeTruthy();
    const timer = within(session).getByRole('region', { name: 'Timed exercise' });
    await user.click(within(timer).getByRole('button', { name: 'Start' }));
    expect(changes.at(-1)?.guidedSessionDraft?.exercises[0]?.sets[0]?.status).toBe('pending');
    await user.click(within(timer).getByRole('button', { name: 'Pause' }));
    const resumedData = changes.at(-1)!;
    expect(resumedData.guidedSessionDraft?.exerciseTimer?.status).toBe('paused');
    cleanup();

    const resumed = renderStatefulStrength(resumedData);
    await user.click(screen.getByRole('button', { name: 'Resume workout' }));
    session = screen.getByRole('dialog', { name: 'Plank' });
    const resumedTimer = within(session).getByRole('region', { name: 'Timed exercise' });
    await user.click(within(resumedTimer).getByRole('button', { name: 'Resume' }));
    await user.clear(within(resumedTimer).getByRole('spinbutton', { name: 'Actual minutes' }));
    await user.clear(within(resumedTimer).getByRole('spinbutton', { name: 'Actual seconds' }));
    await user.type(within(resumedTimer).getByRole('spinbutton', { name: 'Actual seconds' }), '40');
    await user.click(within(session).getByRole('button', { name: 'Log set 1' }));
    expect(resumed.changes.at(-1)?.guidedSessionDraft?.exercises[0]?.sets[0]).toMatchObject({
      status: 'performed',
      actualDurationSeconds: 40
    });
    await user.click(within(session).getByRole('button', { name: 'Finish & review' }));
    const plankResults = within(session).getByRole('region', { name: 'Plank set summary' });
    expect(within(plankResults).getByText('Set 1')).toBeTruthy();
    expect(within(plankResults).getByText('0:40')).toBeTruthy();
    expect(within(plankResults).getByText('Performed')).toBeTruthy();
    expect(within(plankResults).getByText('Volume unavailable')).toBeTruthy();
    await user.click(within(session).getByRole('button', { name: 'Finish & save' }));
    expect(resumed.changes.at(-1)?.workouts).toHaveLength(1);
    expect(resumed.changes.at(-1)?.workouts[0]?.exercises?.[0]?.sets[0]).toMatchObject({
      measurement: { kind: 'duration', targetDurationSeconds: 180 },
      actualDurationSeconds: 40
    });
  });

  it('saves an editable suggestion plan with independent IDs and leaves the catalogue unchanged', async () => {
    const user = userEvent.setup();
    const upperSuggestion = strengthWorkoutSuggestions.find(item => item.sourceId === 'strength.upper-body')!;
    const originalCatalogueExercises = structuredClone(upperSuggestion.exercises);
    const initialData = createStrengthData();
    initialData.savedWorkouts = [{
      id: 'existing-manual-workout',
      name: 'Existing manual workout',
      muscleIds: ['chest'],
      sharedWith: []
    }];
    initialData.workouts = [{
      id: 'existing-history-record',
      date: '2026-10-20',
      muscleIds: ['chest'],
      workoutName: 'Previously logged session'
    }];
    const { changes } = renderStatefulStrength(initialData);
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    await user.click(screen.getByRole('button', { name: 'Suggestions' }));

    const picker = screen.getByRole('dialog', { name: 'Suggested workouts' });
    const upperRow = within(picker).getByRole('heading', { name: 'Upper Body' }).closest('article')!;
    expect(within(upperRow).getByText('5 exercises · 15 planned sets')).toBeTruthy();
    await user.click(within(upperRow).getByRole('button', { name: 'Add' }));

    let editor = screen.getByRole('dialog', { name: 'Add saved workout' });
    const names = [...editor.querySelectorAll('.strength-exercises__name')].map(element => element.textContent);
    expect(names).toEqual(upperSuggestion.exercises.map(exercise => exercise.name));
    const bench = within(editor).getByRole('button', { name: 'Edit Bench Press' });
    await user.click(bench);
    let exerciseEditor = screen.getByRole('dialog', { name: 'Edit exercise' });
    expect(within(exerciseEditor).getByRole('spinbutton', { name: 'Set 1 reps' })).toHaveProperty('value', '12');
    expect(within(exerciseEditor).getByRole('spinbutton', { name: 'Set 2 reps' })).toHaveProperty('value', '10');
    expect(within(exerciseEditor).getByRole('spinbutton', { name: 'Set 3 reps' })).toHaveProperty('value', '8');
    expect(within(exerciseEditor).getByRole('spinbutton', { name: 'Set 1 weight in lb' })).toHaveProperty('value', '');
    await user.click(within(exerciseEditor).getByRole('button', { name: 'Done' }));
    await user.click(within(editor).getByRole('button', { name: 'Save workout' }));

    expect(changes).toHaveLength(1);
    expect(changes[0]!.savedWorkouts.find(workout => workout.id === 'existing-manual-workout'))
      .toEqual(initialData.savedWorkouts[0]);
    expect(changes[0]!.workouts).toEqual(initialData.workouts);
    const saved = changes[0]!.savedWorkouts.find(workout =>
      workout.suggestionSourceId === upperSuggestion.sourceId
    )!;
    expect(saved.exercises?.map(exercise => exercise.name)).toEqual(upperSuggestion.exercises.map(exercise => exercise.name));
    expect(saved.exercises?.map(exercise => exercise.sets.map(set => set.targetReps))).toEqual(
      upperSuggestion.exercises.map(exercise => exercise.sets.map(set => 'targetReps' in set ? set.targetReps : undefined))
    );
    expect(saved.exercises?.flatMap(exercise => exercise.sets).every(set => set.targetLoad === undefined)).toBe(true);
    const identities = [
      saved.id,
      ...(saved.exercises ?? []).map(exercise => exercise.id),
      ...(saved.exercises ?? []).flatMap(exercise => exercise.sets.map(set => set.id))
    ];
    expect(new Set(identities).size).toBe(identities.length);
    expect(upperSuggestion.exercises).toEqual(originalCatalogueExercises);

    await user.click(screen.getByRole('button', { name: 'Close suggested workouts' }));
    const savedWorkout = screen.getByRole('heading', { name: 'Upper Body' }).closest('article')!;
    expect(within(savedWorkout).getByRole('button', { name: 'Start workout' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Suggestions' }));
    const savedSuggestionRow = within(screen.getByRole('dialog', { name: 'Suggested workouts' }))
      .getByRole('heading', { name: 'Upper Body' }).closest('article')!;
    await user.click(within(savedSuggestionRow).getByRole('button', { name: 'Edit' }));
    editor = screen.getByRole('dialog', { name: 'Edit saved workout' });
    await user.click(within(editor).getByRole('button', { name: 'Edit Bench Press' }));
    exerciseEditor = screen.getByRole('dialog', { name: 'Edit exercise' });
    const exerciseName = within(exerciseEditor).getByRole('textbox', { name: 'Exercise name' });
    await user.clear(exerciseName);
    await user.type(exerciseName, 'Changed draft only');
    await user.click(within(exerciseEditor).getByRole('button', { name: 'Done' }));
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));

    expect(changes).toHaveLength(1);
    expect(changes[0]!.savedWorkouts.find(workout => workout.id === saved.id)?.exercises?.[0]?.name)
      .toBe('Bench Press');
    expect(upperSuggestion.exercises).toEqual(originalCatalogueExercises);
  });

  it('saves a suggestion with source identity, then edits the actual saved template without losing its source', async () => {
    const user = userEvent.setup();
    const { changes } = renderStatefulStrength();
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    const browse = screen.getByRole('button', { name: 'Suggestions' });
    await user.click(browse);
    const picker = screen.getByRole('dialog', { name: 'Suggested workouts' });
    const upperRow = within(picker).getByRole('heading', { name: 'Upper Body' }).closest('article')!;
    await user.click(within(upperRow).getByRole('button', { name: 'Add' }));
    let editor = screen.getByRole('dialog', { name: 'Add saved workout' });
    await user.clear(within(editor).getByRole('textbox', { name: 'Workout name' }));
    await user.type(within(editor).getByRole('textbox', { name: 'Workout name' }), 'My upper session');
    await expandMuscleDisclosure(user, editor);
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
    await expandMuscleDisclosure(user, editor);
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
    await user.click(screen.getByRole('button', { name: 'Suggestions' }));
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
    const savedCard = await openSavedWorkoutMenu(user, 'Arm day A');
    await user.click(within(savedCard).getByRole('button', { name: 'Delete workout' }));
    expect(deleteChanges).toHaveLength(1);
    expect(deleteChanges[0]?.savedWorkouts).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Suggestions' }));
    picker = screen.getByRole('dialog', { name: 'Suggested workouts' });
    armsRow = within(picker).getByRole('heading', { name: 'Arms' }).closest('article')!;
    expect(within(armsRow).queryByRole('status')).toBeNull();
    expect(within(armsRow).getByRole('button', { name: 'Add' })).toBeTruthy();
  });

  it('creates ordered exercises and planned sets with independent load meanings and stable IDs', async () => {
    const user = userEvent.setup();
    const { changes } = renderStatefulStrength();
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    await user.click(screen.getByRole('button', { name: 'Add workout' }));
    let workoutDialog = screen.getByRole('dialog', { name: 'Add saved workout' });
    await user.type(within(workoutDialog).getByRole('textbox', { name: 'Workout name' }), 'Upper strength');
    await user.click(within(workoutDialog).getByRole('checkbox', { name: 'Chest' }));
    await user.click(within(workoutDialog).getByRole('button', { name: 'Add exercise' }));

    let exerciseDialog = screen.getByRole('dialog', { name: 'Add exercise' });
    await user.type(within(exerciseDialog).getByRole('textbox', { name: 'Exercise name' }), 'Bench Press');
    await user.type(within(exerciseDialog).getByRole('textbox', { name: 'Equipment' }), 'Barbell');
    await user.click(within(exerciseDialog).getByRole('checkbox', { name: 'Chest' }));
    await user.selectOptions(within(exerciseDialog).getByLabelText('Load meaning'), 'total');
    const benchWeights = [135, 155, 175, 195, 205];
    for (const [index, weight] of benchWeights.entries()) {
      if (index > 0) await user.click(within(exerciseDialog).getByRole('button', { name: 'Add set' }));
      await user.type(within(exerciseDialog).getByRole('spinbutton', { name: `Set ${index + 1} weight in lb` }), String(weight));
      await user.type(within(exerciseDialog).getByRole('spinbutton', { name: `Set ${index + 1} reps` }), '10');
    }
    await user.selectOptions(within(exerciseDialog).getByLabelText('Rest duration'), '180');
    await user.type(within(exerciseDialog).getByRole('textbox', { name: /^Exercise notes/ }), 'Smooth tempo');
    const exerciseOpener = within(workoutDialog).getByRole('button', { name: 'Add exercise' });
    await user.click(within(exerciseDialog).getByRole('button', { name: 'Done' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(document.activeElement).toBe(exerciseOpener);
    expect(changes).toHaveLength(0);

    await user.click(within(workoutDialog).getByRole('button', { name: 'Add exercise' }));
    exerciseDialog = screen.getByRole('dialog', { name: 'Add exercise' });
    await user.type(within(exerciseDialog).getByRole('textbox', { name: 'Exercise name' }), 'Tricep Extensions');
    await user.type(within(exerciseDialog).getByRole('textbox', { name: 'Equipment' }), 'Dumbbells');
    await user.click(within(exerciseDialog).getByRole('checkbox', { name: 'Triceps' }));
    await user.selectOptions(within(exerciseDialog).getByLabelText('Load meaning'), 'per-dumbbell');
    await user.type(within(exerciseDialog).getByRole('spinbutton', { name: 'Set 1 weight in lb' }), '40');
    await user.type(within(exerciseDialog).getByRole('spinbutton', { name: 'Set 1 reps' }), '10');
    await user.click(within(exerciseDialog).getByRole('button', { name: 'Add set' }));
    await user.type(within(exerciseDialog).getByRole('spinbutton', { name: 'Set 2 weight in lb' }), '40');
    await user.type(within(exerciseDialog).getByRole('spinbutton', { name: 'Set 2 reps' }), '10');
    await user.click(within(exerciseDialog).getByRole('button', { name: 'Add set' }));
    await user.type(within(exerciseDialog).getByRole('spinbutton', { name: 'Set 3 weight in lb' }), '40');
    await user.type(within(exerciseDialog).getByRole('spinbutton', { name: 'Set 3 reps' }), '8');
    await user.selectOptions(within(exerciseDialog).getByLabelText('Rest duration'), '120');
    await user.click(within(exerciseDialog).getByRole('button', { name: 'Done' }));

    await user.click(within(workoutDialog).getByRole('button', { name: 'Move Bench Press down' }));
    await user.click(within(workoutDialog).getByRole('button', { name: 'Save workout' }));
    expect(changes).toHaveLength(1);
    const saved = changes[0]!.savedWorkouts[0]!;
    expect(saved).toMatchObject({
      name: 'Upper strength',
      muscleIds: ['chest'],
      sharedWith: [],
      exercises: [
        {
          name: 'Tricep Extensions',
          equipment: 'Dumbbells',
          muscleIds: ['triceps'],
          restDurationSeconds: 120,
          sets: [
            { targetReps: 10, targetLoad: { kind: 'external', meaning: 'per-dumbbell', value: 40, unit: 'lb' } },
            { targetReps: 10, targetLoad: { kind: 'external', meaning: 'per-dumbbell', value: 40, unit: 'lb' } },
            { targetReps: 8, targetLoad: { kind: 'external', meaning: 'per-dumbbell', value: 40, unit: 'lb' } }
          ]
        },
        {
          name: 'Bench Press',
          equipment: 'Barbell',
          notes: 'Smooth tempo',
          restDurationSeconds: 180,
          sets: benchWeights.map(value => ({
            targetReps: 10,
            targetLoad: { kind: 'external', meaning: 'total', value, unit: 'lb' }
          }))
        }
      ]
    });
    expect(new Set(saved.exercises?.map(exercise => exercise.id)).size).toBe(2);
    expect(new Set(saved.exercises?.flatMap(exercise => exercise.sets.map(set => set.id))).size).toBe(8);
    expect(saved.exercises?.[1]?.sets.map(set => set.id)).toHaveLength(5);

    cleanup();
    const reopened = renderStatefulStrength(changes[0]!);
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    let savedCard = await openSavedWorkoutMenu(user, 'Upper strength');
    await user.click(within(savedCard).getByRole('button', { name: 'Edit workout' }));
    workoutDialog = screen.getByRole('dialog', { name: 'Edit saved workout' });
    const benchRow = within(workoutDialog).getByRole('heading', { name: 'Bench Press' }).closest('li')!;
    await user.click(within(benchRow).getByRole('button', { name: 'Edit' }));
    exerciseDialog = screen.getByRole('dialog', { name: 'Edit exercise' });
    expect(within(exerciseDialog).getByRole('spinbutton', { name: 'Set 1 weight in lb' })).toHaveProperty('value', '135');
    expect(within(exerciseDialog).getByRole('spinbutton', { name: 'Set 5 reps' })).toHaveProperty('value', '10');
    await user.clear(within(exerciseDialog).getByRole('spinbutton', { name: 'Set 1 weight in lb' }));
    await user.type(within(exerciseDialog).getByRole('spinbutton', { name: 'Set 1 weight in lb' }), '140');
    await user.click(within(exerciseDialog).getByRole('button', { name: 'Remove set 5' }));
    const originalBenchId = saved.exercises?.[1]?.id;
    const originalFirstSetId = saved.exercises?.[1]?.sets[0]?.id;
    await user.click(within(exerciseDialog).getByRole('button', { name: 'Done' }));
    expect(document.activeElement).toBe(within(benchRow).getByRole('button', { name: 'Edit' }));
    await user.click(within(workoutDialog).getByRole('button', { name: 'Remove Tricep Extensions' }));
    await user.click(within(workoutDialog).getByRole('button', { name: 'Save workout' }));
    expect(reopened.changes).toHaveLength(1);
    const edited = reopened.changes[0]!.savedWorkouts[0]!;
    expect(edited.exercises).toHaveLength(1);
    expect(edited.exercises?.[0]?.id).toBe(originalBenchId);
    expect(edited.exercises?.[0]?.sets).toHaveLength(4);
    expect(edited.exercises?.[0]?.sets[0]).toMatchObject({
      id: originalFirstSetId,
      targetLoad: { kind: 'external', meaning: 'total', value: 140, unit: 'lb' }
    });
    expect(changes).toHaveLength(1);
    savedCard = await openSavedWorkoutMenu(user, 'Upper strength');
    await user.click(within(savedCard).getByRole('button', { name: 'Edit workout' }));
    workoutDialog = screen.getByRole('dialog', { name: 'Edit saved workout' });
    await user.click(within(workoutDialog).getByRole('button', { name: 'Remove Bench Press' }));
    await user.click(within(workoutDialog).getByRole('button', { name: 'Save workout' }));
    expect(reopened.changes).toHaveLength(2);
    expect(reopened.changes[1]!.savedWorkouts[0]).not.toHaveProperty('exercises');
  });

  it('keeps exercise drafts isolated across child Escape, bodyweight validation, and parent Cancel', async () => {
    const user = userEvent.setup();
    const { onChange } = renderStrength();
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    const addWorkout = screen.getByRole('button', { name: 'Add workout' });
    await user.click(addWorkout);
    let workoutDialog = screen.getByRole('dialog', { name: 'Add saved workout' });
    const workoutName = within(workoutDialog).getByRole('textbox', { name: 'Workout name' });
    await user.type(workoutName, 'Bodyweight day');
    const addExercise = within(workoutDialog).getByRole('button', { name: 'Add exercise' });
    await user.click(addExercise);
    let exerciseDialog = screen.getByRole('dialog', { name: 'Add exercise' });
    await user.type(within(exerciseDialog).getByRole('textbox', { name: 'Exercise name' }), 'Push-up');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Add exercise' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Add saved workout' })).toBe(workoutDialog);
    expect(document.activeElement).toBe(addExercise);
    expect(within(workoutDialog).getByRole('textbox', { name: 'Workout name' })).toHaveProperty('value', 'Bodyweight day');
    expect(onChange).not.toHaveBeenCalled();

    await user.click(addExercise);
    exerciseDialog = screen.getByRole('dialog', { name: 'Add exercise' });
    await user.type(within(exerciseDialog).getByRole('textbox', { name: 'Exercise name' }), 'Draft only');
    await user.click(within(exerciseDialog).getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(addExercise);
    expect(within(workoutDialog).queryByRole('heading', { name: 'Draft only' })).toBeNull();

    await user.click(addExercise);
    exerciseDialog = screen.getByRole('dialog', { name: 'Add exercise' });
    await user.type(within(exerciseDialog).getByRole('textbox', { name: 'Exercise name' }), 'Push-up');
    await user.type(within(exerciseDialog).getByRole('textbox', { name: 'Equipment' }), 'Bodyweight');
    await user.click(within(exerciseDialog).getByRole('checkbox', { name: 'Chest' }));
    await user.selectOptions(within(exerciseDialog).getByLabelText('Load meaning'), 'total');
    await user.selectOptions(within(exerciseDialog).getByLabelText('Load meaning'), 'bodyweight');
    expect(within(exerciseDialog).queryByRole('spinbutton', { name: /weight/i })).toBeNull();
    await user.click(within(exerciseDialog).getByRole('button', { name: 'Done' }));
    exerciseDialog = screen.getByRole('dialog', { name: 'Add exercise' });
    expect(within(exerciseDialog).getByText(/1 to 1000/)).toBeTruthy();
    await user.type(within(exerciseDialog).getByRole('spinbutton', { name: /Set 1 reps/ }), '12');
    await user.selectOptions(within(exerciseDialog).getByLabelText('Rest duration'), 'custom');
    await user.clear(within(exerciseDialog).getByRole('spinbutton', { name: 'Custom rest duration in seconds' }));
    await user.type(within(exerciseDialog).getByRole('spinbutton', { name: 'Custom rest duration in seconds' }), '240');
    await user.type(within(exerciseDialog).getByRole('textbox', { name: /^Exercise notes/ }), 'Pause at the bottom');
    await user.click(within(exerciseDialog).getByRole('button', { name: 'Done' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(within(workoutDialog).getByRole('heading', { name: 'Push-up' })).toBeTruthy();
    await user.click(within(workoutDialog).getByRole('button', { name: 'Cancel' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(addWorkout);
  });

  it('keeps exercise-free saved workouts valid and does not change completed history when editing a template', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    data.savedWorkouts = [{
      id: 'legacy-template',
      name: 'Legacy Bench',
      muscleIds: ['chest'],
      sharedWith: ['sample-person-morgan']
    }];
    data.workouts = [{
      id: 'completed-bench',
      date: '2026-10-21',
      muscleIds: ['chest'],
      savedWorkoutId: 'legacy-template',
      workoutName: 'Legacy Bench',
      startedAt: '2026-10-21T10:00:00.000Z',
      finishedAt: '2026-10-21T10:30:00.000Z',
      timeZone: 'UTC',
      exercises: [{
        id: 'historical-bench',
        name: 'Bench Press',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        restDurationSeconds: 180,
        sets: [{
          id: 'historical-bench-set',
          targetReps: 10,
          targetLoad: { kind: 'external', meaning: 'total', value: 135, unit: 'lb' },
          status: 'performed',
          actualReps: 10,
          actualLoad: { kind: 'external', meaning: 'total', value: 135, unit: 'lb' },
          confirmedAt: '2026-10-21T10:10:00.000Z'
        }]
      }]
    }];
    const historyBefore = structuredClone(data.workouts);
    const { onChange } = renderStrength(data);
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    const savedCard = await openSavedWorkoutMenu(user, 'Legacy Bench');
    await user.click(within(savedCard).getByRole('button', { name: 'Edit workout' }));
    let workoutDialog = screen.getByRole('dialog', { name: 'Edit saved workout' });
    await user.clear(within(workoutDialog).getByRole('textbox', { name: 'Workout name' }));
    await user.type(within(workoutDialog).getByRole('textbox', { name: 'Workout name' }), 'Renamed Bench');
    expect(within(workoutDialog).getByRole('button', { name: 'Choose people, Morgan Reed' })).toBeTruthy();
    await user.click(within(workoutDialog).getByRole('button', { name: 'Add exercise' }));
    let exerciseDialog = screen.getByRole('dialog', { name: 'Add exercise' });
    await user.type(within(exerciseDialog).getByRole('textbox', { name: 'Exercise name' }), 'Bench Press');
    await user.type(within(exerciseDialog).getByRole('textbox', { name: 'Equipment' }), 'Barbell');
    await user.click(within(exerciseDialog).getByRole('checkbox', { name: 'Chest' }));
    await user.selectOptions(within(exerciseDialog).getByLabelText('Load meaning'), 'total');
    expect(within(exerciseDialog).getByText('Muscle groups', { selector: '.strength-muscle-disclosure__label' })).toBeTruthy();
    expect(within(exerciseDialog).getByText('Exercise details', { selector: 'summary > span:first-child' })).toBeTruthy();
    expect(within(exerciseDialog).queryByLabelText('Weight unit')).toBeNull();
    await user.type(within(exerciseDialog).getByRole('spinbutton', { name: /Set 1 weight in /i }), '70');
    await user.type(within(exerciseDialog).getByRole('spinbutton', { name: 'Set 1 reps' }), '8');
    await user.click(within(exerciseDialog).getByRole('button', { name: 'Done' }));
    await user.click(within(workoutDialog).getByRole('button', { name: 'Save workout' }));
    expect(onChange).toHaveBeenCalledOnce();
    const next = onChange.mock.calls[0]![0];
    expect(next.savedWorkouts[0]).toMatchObject({
      id: 'legacy-template',
      name: 'Renamed Bench',
      sharedWith: ['sample-person-morgan'],
      exercises: [{
        name: 'Bench Press',
        sets: [{ targetLoad: { kind: 'external', meaning: 'total', value: 70, unit: data.settings.weightUnit } }]
      }]
    });
    expect(next.workouts).toEqual(historyBefore);
    expect(next.workouts[0]?.workoutName).toBe('Legacy Bench');
  });

  it('starts, resumes, skips, adds an extra set, reviews, and saves one immutable guided workout', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    data.savedWorkouts = [{
      id: 'guided-workout-template',
      name: 'Upper body',
      muscleIds: ['chest', 'triceps'],
      sharedWith: ['sample-person-avery'],
      exercises: [
        {
          id: 'guided-bench',
          name: 'Bench Press',
          muscleIds: ['chest'],
          equipment: 'Barbell',
          loadMeaning: 'total',
          restDurationSeconds: 180,
          sets: [135, 155, 175, 195, 205].map((weight, index) => ({
            id: `guided-bench-set-${index + 1}`,
            targetReps: 10,
            targetLoad: { kind: 'external' as const, meaning: 'total' as const, value: weight, unit: 'lb' as const }
          }))
        },
        {
          id: 'guided-triceps',
          name: 'Tricep Extensions',
          muscleIds: ['triceps'],
          equipment: 'Dumbbells',
          loadMeaning: 'per-dumbbell',
          restDurationSeconds: 120,
          sets: [10, 10, 8].map((reps, index) => ({
            id: `guided-triceps-set-${index + 1}`,
            targetReps: reps,
            targetLoad: { kind: 'external' as const, meaning: 'per-dumbbell' as const, value: 40, unit: 'lb' as const }
          }))
        }
      ]
    }];
    data.workouts = [{
      id: 'guided-previous-workout',
      date: '2026-10-20',
      muscleIds: ['chest'],
      savedWorkoutId: 'guided-workout-template',
      workoutName: 'Upper body',
      startedAt: '2026-10-20T10:00:00.000Z',
      finishedAt: '2026-10-20T10:30:00.000Z',
      timeZone: 'UTC',
      exercises: [{
        id: 'guided-bench',
        name: 'Bench Press',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        restDurationSeconds: 180,
        sets: [{
          id: 'guided-bench-set-1',
          targetReps: 10,
          targetLoad: { kind: 'external', meaning: 'total', value: 135, unit: 'lb' },
          status: 'performed',
          actualReps: 8,
          actualLoad: { kind: 'external', meaning: 'total', value: 120, unit: 'lb' },
          confirmedAt: '2026-10-20T10:10:00.000Z'
        }]
      }]
    }];
    const { changes } = renderStatefulStrength(data);
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    const startButton = screen.getByRole('button', { name: 'Start workout' });
    await user.click(startButton);

    let dialog = screen.getByRole('dialog', { name: 'Upper body' });
    expect(within(dialog).getByText(/Previous matching workout/)).toBeTruthy();
    expect(within(dialog).getByText('Last workout · Set 1')).toBeTruthy();
    expect(within(dialog).getByText('120 lb total × 8 reps')).toBeTruthy();
    const exerciseChoice = within(dialog).getByRole('button', { name: '1 of 2' });
    expect(exerciseChoice).toBeTruthy();
    await user.click(exerciseChoice);
    const navigationMenu = screen.getByRole('menu', { name: 'Workout navigation' });
    expect(navigationMenu.style.position).toBe('fixed');
    const benchMenuItem = within(navigationMenu).getByRole('menuitem', { name: /Bench Press/ });
    expect(document.activeElement).toBe(benchMenuItem);
    await user.click(within(dialog).getByRole('spinbutton', { name: 'Weight (lb)' }));
    expect(screen.queryByRole('menu', { name: 'Workout navigation' })).toBeNull();
    expect(document.activeElement).toBe(within(dialog).getByRole('spinbutton', { name: 'Weight (lb)' }));
    await user.click(exerciseChoice);
    const reopenedNavigationMenu = screen.getByRole('menu', { name: 'Workout navigation' });
    expect(document.activeElement).toBe(within(reopenedNavigationMenu).getByRole('menuitem', { name: /Bench Press/ }));
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(within(reopenedNavigationMenu).getByRole('menuitem', { name: /Tricep Extensions/ }));
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(within(reopenedNavigationMenu).getByRole('menuitem', { name: /Bench Press/ }));
    await user.click(within(reopenedNavigationMenu).getByRole('menuitem', { name: /Tricep Extensions/ }));
    expect(document.activeElement).toBe(exerciseChoice);
    expect(within(dialog).getByRole('heading', { name: 'Tricep Extensions' })).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: '2 of 2' }));
    await user.click(screen.getByRole('menuitem', { name: /Bench Press/ }));
    const progress = within(dialog).getByRole('group', { name: 'Bench Press set progress' });
    const firstSet = within(progress).getByRole('button', { name: 'Set 1, pending' });
    expect(firstSet.getAttribute('aria-current')).toBe('step');
    expect(firstSet.textContent).toBe('1');
    await user.click(within(dialog).getByRole('button', { name: 'Increase weight by 5 lb' }));
    expect((within(dialog).getByRole('spinbutton', { name: 'Weight (lb)' }) as HTMLInputElement).value).toBe('125');
    await user.clear(within(dialog).getByRole('spinbutton', { name: 'Weight (lb)' }));
    await user.type(within(dialog).getByRole('spinbutton', { name: 'Weight (lb)' }), '140');
    await user.clear(within(dialog).getByRole('spinbutton', { name: 'Reps' }));
    await user.type(within(dialog).getByRole('spinbutton', { name: 'Reps' }), '8');
    await user.click(within(dialog).getByRole('button', { name: 'Log set 1' }));
    expect(within(dialog).getByText('140 lb total × 8 reps')).toBeTruthy();
    expect(within(dialog).getByText('This workout · Last set')).toBeTruthy();
    expect(within(progress).getByRole('button', { name: /Set 1, performed/ }).textContent).toBe('✓');
    expect(changes.at(-1)?.guidedSessionDraft?.exercises[0]?.sets[0]).toMatchObject({
      status: 'performed',
      actualReps: 8,
      actualLoad: { value: 140, unit: 'lb', meaning: 'total' }
    });
    expect((within(dialog).getByRole('spinbutton', { name: 'Weight (lb)' }) as HTMLInputElement).value).toBe('140');
    await user.clear(within(dialog).getByRole('spinbutton', { name: 'Weight (lb)' }));
    await user.type(within(dialog).getByRole('spinbutton', { name: 'Weight (lb)' }), '145');
    await user.click(within(progress).getByRole('button', { name: 'Set 1, performed, 140 lb total × 8 reps' }));
    expect(within(dialog).queryByRole('button', { name: 'Save correction' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Save changes' })).toBeNull();
    await user.click(within(progress).getByRole('button', { name: 'Set 2, pending' }));
    expect((within(dialog).getByRole('spinbutton', { name: 'Weight (lb)' }) as HTMLInputElement).value).toBe('145');

    const resumedData = changes.at(-1)!;
    cleanup();
    const { changes: resumedChanges } = renderStatefulStrength(resumedData);
    const resume = screen.getByRole('button', { name: 'Resume workout' });
    await user.click(resume);
    dialog = screen.getByRole('dialog', { name: 'Upper body' });
    expect(within(dialog).getByRole('button', { name: 'Set 2, pending' })).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Skip set' }));
    expect(within(dialog).getByRole('button', { name: 'Set 2, skipped' }).textContent).toBe('×');
    await user.click(within(dialog).getByRole('button', { name: 'Next exercise' }));
    expect(within(dialog).getByRole('heading', { name: 'Tricep Extensions' })).toBeTruthy();
    expect((within(dialog).getByRole('spinbutton', { name: 'Weight (lb)' }) as HTMLInputElement).value).toBe('40');
    await user.click(within(dialog).getByRole('button', { name: 'Set 3, pending' }));
    await user.click(within(dialog).getByRole('button', { name: 'Add set' }));
    expect(within(dialog).getByRole('button', { name: 'Set 4, pending' })).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Notes' }));
    const notesDialog = screen.getByRole('dialog', { name: 'Workout notes' });
    await user.type(within(notesDialog).getByRole('textbox', { name: 'Notes for Tricep Extensions' }), 'Keep elbows steady.');
    await user.type(within(notesDialog).getByRole('textbox', { name: 'Workout notes' }), 'Steady session.');
    await user.click(within(notesDialog).getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Notes' }));
    await user.click(within(dialog).getByRole('button', { name: 'Notes' }));
    const reopenedNotes = screen.getByRole('dialog', { name: 'Workout notes' });
    expect((within(reopenedNotes).getByRole('textbox', { name: 'Notes for Tricep Extensions' }) as HTMLTextAreaElement).value).toBe('');
    expect((within(reopenedNotes).getByRole('textbox', { name: 'Workout notes' }) as HTMLTextAreaElement).value).toBe('');
    await user.type(within(reopenedNotes).getByRole('textbox', { name: 'Notes for Tricep Extensions' }), 'Keep elbows steady.');
    await user.type(within(reopenedNotes).getByRole('textbox', { name: 'Workout notes' }), 'Steady session.');
    await user.click(within(reopenedNotes).getByRole('button', { name: 'Done' }));
    await user.click(within(dialog).getByRole('button', { name: '2 of 2' }));
    await user.click(screen.getByRole('menuitem', { name: 'Finish & review' }));
    expect(within(dialog).getByRole('heading', { name: 'Session summary' })).toBeTruthy();
    expect(within(dialog).getByText(/1 performed · 1 skipped · 7 unfinished/)).toBeTruthy();
    expect(within(dialog).getByRole('group', { name: 'Workout participants' }).textContent).toContain('Avery');
    await user.click(within(dialog).getByRole('button', { name: 'Finish & save' }));

    const finished = resumedChanges.at(-1)!;
    expect(finished.guidedSessionDraft).toBeUndefined();
    expect(finished.workouts).toHaveLength(2);
    expect(finished.workouts[0]).toMatchObject({ id: 'guided-previous-workout' });
    expect(finished.workouts[1]).toMatchObject({
      savedWorkoutId: 'guided-workout-template',
      workoutName: 'Upper body',
      sharedWith: ['sample-person-avery'],
      notes: 'Steady session.',
      muscleIds: ['chest']
    });
    expect(finished.workouts[1]?.exercises?.[0]?.sets.map(set => set.status))
      .toEqual(['performed', 'skipped', 'pending', 'pending', 'pending']);
    expect(finished.workouts[1]?.exercises?.[0]?.sets[0]).toMatchObject({
      actualReps: 8,
      actualLoad: { value: 140, unit: 'lb', meaning: 'total' }
    });
    expect(finished.workouts[1]?.exercises?.[1]).toMatchObject({
      id: 'guided-triceps',
      notes: 'Keep elbows steady.'
    });
    expect(finished.workouts[1]?.exercises?.[1]?.sets.map(set => set.status))
      .toEqual(['pending', 'pending', 'pending', 'pending']);
    expect(finished.savedWorkouts[0]?.exercises?.[0]?.sets[0]?.targetLoad).toEqual({
      kind: 'external', meaning: 'total', value: 135, unit: 'lb'
    });
  });

  it('carries current-session weight as an editable gray value and reviews precise exercise volume by set', async () => {
    const data = createStrengthData();
    data.savedWorkouts = [{
      id: 'volume-review-template',
      name: 'Volume review',
      muscleIds: ['chest'],
      sharedWith: [],
      exercises: [{
        id: 'volume-review-bench',
        name: 'Bench Press',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        loadMeaning: 'total',
        restDurationSeconds: 180,
        sets: [
          { id: 'volume-review-set-1', targetReps: 12, targetLoad: { kind: 'external', meaning: 'total', value: 135, unit: 'lb' } },
          { id: 'volume-review-set-2', targetReps: 10, targetLoad: { kind: 'external', meaning: 'total', value: 145, unit: 'lb' } },
          { id: 'volume-review-set-3', targetReps: 8, targetLoad: { kind: 'external', meaning: 'total', value: 155, unit: 'lb' } }
        ]
      }]
    }];
    const user = userEvent.setup();
    let { changes } = renderStatefulStrength(data);
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    await user.click(screen.getByRole('button', { name: 'Start workout' }));
    let dialog = screen.getByRole('dialog', { name: 'Volume review' });
    const chooser = within(dialog).getByRole('button', { name: '1 of 1' });
    expect(chooser.classList.contains('strength-guided__exercise-menu-trigger')).toBe(true);

    await user.click(within(dialog).getByRole('button', { name: 'Log set 1' }));
    const carriedWeight = within(dialog).getByRole('spinbutton', { name: 'Weight (lb)' }) as HTMLInputElement;
    expect(carriedWeight.value).toBe('135');
    expect(carriedWeight.classList.contains('strength-guided__weight-input--carried')).toBe(true);
    const resumedData = changes.at(-1)!;
    cleanup();
    ({ changes } = renderStatefulStrength(resumedData));
    await user.click(screen.getByRole('button', { name: 'Resume workout' }));
    dialog = screen.getByRole('dialog', { name: 'Volume review' });
    const resumedWeight = within(dialog).getByRole('spinbutton', { name: 'Weight (lb)' }) as HTMLInputElement;
    expect(resumedWeight.value).toBe('135');
    expect(resumedWeight.classList.contains('strength-guided__weight-input--carried')).toBe(true);
    await user.click(within(dialog).getByRole('button', { name: 'Increase weight by 5 lb' }));
    expect(resumedWeight.value).toBe('140');
    expect(resumedWeight.classList.contains('strength-guided__weight-input--carried')).toBe(false);
    await user.clear(resumedWeight);
    await user.type(resumedWeight, '145');
    expect(resumedWeight.classList.contains('strength-guided__weight-input--carried')).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Log set 2' }));

    const carriedThird = within(dialog).getByRole('spinbutton', { name: 'Weight (lb)' }) as HTMLInputElement;
    expect(carriedThird.value).toBe('145');
    expect(carriedThird.classList.contains('strength-guided__weight-input--carried')).toBe(true);
    await user.clear(carriedThird);
    await user.type(carriedThird, '155');
    await user.click(within(dialog).getByRole('button', { name: 'Log set 3' }));
    expect(carriedThird.classList.contains('strength-guided__weight-input--carried')).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Finish & review' }));

    const results = within(dialog).getByRole('region', { name: 'Bench Press set summary' });
    const rows = within(results).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows.map(row => row.textContent)).toEqual([
      expect.stringContaining('Set 1'),
      expect.stringContaining('Set 2'),
      expect.stringContaining('Set 3')
    ]);
    expect(within(results).getByText('Volume: 4,310 lb')).toBeTruthy();
    expect(within(results).getByText('Previous: unavailable')).toBeTruthy();
    expect(changes.at(-1)?.guidedSessionDraft?.exercises[0]?.sets.map(set =>
      set.status === 'performed' && set.actualLoad?.kind === 'external' ? set.actualLoad.value : null
    ))
      .toEqual([135, 145, 155]);
    await user.click(within(dialog).getByRole('button', { name: 'Finish & save' }));
    await user.click(screen.getByRole('tab', { name: 'History' }));
    await user.click(screen.getByRole('button', { name: /View Volume review/ }));
    const historyDialog = screen.getByRole('dialog', { name: 'Volume review' });
    const historyResults = within(historyDialog).getByRole('region', { name: 'Bench Press results' });
    expect(within(historyResults).getByText('Volume: 4,310 lb')).toBeTruthy();
    expect(within(historyResults).getAllByRole('listitem')).toHaveLength(3);
    expect(within(historyDialog).queryByText('Exercise and set results')).toBeNull();
  });

  it('keeps bodyweight sessions weight-free and pauses through Escape without discarding the draft', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    data.savedWorkouts = [{
      id: 'bodyweight-template',
      name: 'Push-ups',
      muscleIds: ['chest'],
      sharedWith: [],
      exercises: [{
        id: 'push-up-exercise',
        name: 'Push-up',
        muscleIds: ['chest'],
        equipment: 'Bodyweight',
        loadMeaning: 'bodyweight',
        restDurationSeconds: 60,
        sets: [{ id: 'push-up-set', targetReps: 12, targetLoad: { kind: 'bodyweight' } }]
      }]
    }];
    const { changes } = renderStatefulStrength(data);
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    const startButton = screen.getByRole('button', { name: 'Start workout' });
    await user.click(startButton);
    let dialog = screen.getByRole('dialog', { name: 'Push-ups' });
    expect(within(dialog).queryByRole('spinbutton', { name: /Weight/ })).toBeNull();
    expect(within(dialog).getByRole('group', { name: 'Bodyweight load' })).toBeTruthy();
    expect(within(within(dialog).getByRole('group', { name: 'Bodyweight load' })).getByText('Bodyweight')).toBeTruthy();
    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));
    expect(screen.queryByRole('dialog', { name: 'Push-ups' })).toBeNull();
    expect(document.activeElement).toBe(startButton);
    expect(changes.at(-1)?.guidedSessionDraft?.exercises[0]?.sets[0]?.status).toBe('pending');
    await user.click(screen.getByRole('button', { name: 'Resume workout' }));
    dialog = screen.getByRole('dialog', { name: 'Push-ups' });
    expect((within(dialog).getByRole('spinbutton', { name: 'Reps' }) as HTMLInputElement).value).toBe('12');
  });

  it('applies custom rest to a resumable session when its originating template was deleted', async () => {
    const data = createStrengthData();
    const template: StrengthSavedWorkout = {
      id: 'deleted-custom-rest-template',
      name: 'Deleted template rest',
      muscleIds: ['chest'],
      sharedWith: [],
      exercises: [{
        id: 'deleted-custom-rest-exercise',
        name: 'Bench Press',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        loadMeaning: 'total',
        restDurationSeconds: 180,
        sets: [{ id: 'deleted-custom-rest-set', targetReps: 8 }]
      }]
    };
    const session = createStrengthGuidedSession(template, {
      id: 'deleted-custom-rest-session',
      date: '2026-10-22',
      startedAt: '2026-10-22T09:00:00.000Z',
      timeZone: 'UTC'
    });
    expect(session.valid).toBe(true);
    if (!session.valid) return;
    data.guidedSessionDraft = session.session;
    const { changes } = renderStatefulStrength(data);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Resume workout' }));
    const dialog = screen.getByRole('dialog', { name: 'Deleted template rest' });
    await user.click(within(dialog).getByRole('button', { name: /Rest duration .* timer options/ }));
    const options = screen.getByRole('dialog', { name: 'Rest timer options' });
    await user.clear(within(options).getByRole('spinbutton', { name: 'Minutes' }));
    await user.type(within(options).getByRole('spinbutton', { name: 'Minutes' }), '2');
    await user.click(within(options).getByRole('button', { name: 'Apply' }));
    expect(changes.at(-1)?.guidedSessionDraft?.restTimer).toEqual({ status: 'idle', durationSeconds: 120 });
    expect(changes.at(-1)?.guidedSessionDraft?.exercises[0]?.restDurationSeconds).toBe(120);
    expect(changes.at(-1)?.savedWorkouts).toEqual([]);
    expect(within(dialog).getByRole('status').textContent).toContain(
      'Rest updated for this session, but the originating template is unavailable'
    );
  });

  it('does not claim custom rest was applied when a deleted-template session cannot be saved', async () => {
    const data = createStrengthData();
    const template: StrengthSavedWorkout = {
      id: 'unavailable-custom-rest-template',
      name: 'Unavailable template rest',
      muscleIds: ['chest'],
      sharedWith: [],
      exercises: [{
        id: 'unavailable-custom-rest-exercise',
        name: 'Bench Press',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        loadMeaning: 'total',
        restDurationSeconds: 180,
        sets: [{ id: 'unavailable-custom-rest-set', targetReps: 8 }]
      }]
    };
    const session = createStrengthGuidedSession(template, {
      id: 'unavailable-custom-rest-session',
      date: '2026-10-22',
      startedAt: '2026-10-22T09:00:00.000Z',
      timeZone: 'UTC'
    });
    expect(session.valid).toBe(true);
    if (!session.valid) return;
    data.guidedSessionDraft = session.session;
    renderStrength(data, 'recommended', 'storage conflict');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Resume workout' }));
    const dialog = screen.getByRole('dialog', { name: 'Unavailable template rest' });
    await user.click(within(dialog).getByRole('button', { name: /Rest duration .* timer options/ }));
    const options = screen.getByRole('dialog', { name: 'Rest timer options' });
    await user.clear(within(options).getByRole('spinbutton', { name: 'Minutes' }));
    await user.type(within(options).getByRole('spinbutton', { name: 'Minutes' }), '2');
    await user.click(within(options).getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('alert').textContent).toContain(
      'The custom rest duration was not applied because session persistence failed: storage conflict'
    );
    expect(screen.getByRole('alert').textContent).not.toContain('session rest changed');
    expect(within(dialog).getByRole('button', { name: /Rest duration 03:00/ })).toBeTruthy();
  });

  it('does not apply or claim a custom default when session persistence reports a conflict', async () => {
    const data = createStrengthData();
    const template: StrengthSavedWorkout = {
      id: 'conflicted-custom-rest-template',
      name: 'Conflicted custom rest',
      muscleIds: ['chest'],
      sharedWith: [],
      exercises: [{
        id: 'conflicted-custom-rest-exercise',
        name: 'Bench Press',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        loadMeaning: 'total',
        restDurationSeconds: 180,
        sets: [{ id: 'conflicted-custom-rest-set', targetReps: 8 }]
      }]
    };
    const session = createStrengthGuidedSession(template, {
      id: 'conflicted-custom-rest-session',
      date: '2026-10-22',
      startedAt: '2026-10-22T09:00:00.000Z',
      timeZone: 'UTC'
    });
    expect(session.valid).toBe(true);
    if (!session.valid) return;
    data.savedWorkouts = [template];
    data.guidedSessionDraft = session.session;
    const { onChange } = renderStrength(data, 'recommended', 'storage conflict');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Resume workout' }));
    const dialog = screen.getByRole('dialog', { name: 'Conflicted custom rest' });
    await user.click(within(dialog).getByRole('button', { name: /Rest duration .* timer options/ }));
    const options = screen.getByRole('dialog', { name: 'Rest timer options' });
    await user.clear(within(options).getByRole('spinbutton', { name: 'Minutes' }));
    await user.type(within(options).getByRole('spinbutton', { name: 'Minutes' }), '2');
    await user.click(within(options).getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('alert').textContent).toContain('The custom rest duration could not be saved');
    expect(within(dialog).getByRole('button', { name: /Rest duration 03:00/ })).toBeTruthy();
    expect(onChange.mock.calls.at(-1)?.[0].savedWorkouts[0]?.exercises?.[0]?.restDurationSeconds).toBe(120);
    expect(data.savedWorkouts[0]?.exercises?.[0]?.restDurationSeconds).toBe(180);
  });

  it('keeps unset load blank and lets a legacy workout correct load meaning in the editor', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    data.savedWorkouts = [{
      id: 'blank-load-template',
      name: 'Blank load',
      muscleIds: ['chest'],
      sharedWith: [],
      exercises: [{
        id: 'blank-load-exercise',
        name: 'Bench Press',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        restDurationSeconds: 180,
        sets: [{ id: 'blank-load-set', targetReps: 8 }]
      }]
    }];
    const { changes } = renderStatefulStrength(data);
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    await user.click(screen.getByRole('button', { name: 'Start workout' }));
    let editor = screen.getByRole('dialog', { name: 'Edit saved workout' });
    await user.click(within(editor).getByRole('button', { name: 'Edit Bench Press' }));
    let exerciseEditor = screen.getByRole('dialog', { name: 'Edit exercise' });
    expect(within(exerciseEditor).getByLabelText('Load meaning')).toHaveProperty('value', '');
    await user.selectOptions(within(exerciseEditor).getByLabelText('Load meaning'), 'total');
    await user.click(within(exerciseEditor).getByRole('button', { name: 'Done' }));
    await user.click(within(editor).getByRole('button', { name: 'Save workout' }));

    await user.click(screen.getByRole('button', { name: 'Start workout' }));
    const dialog = screen.getByRole('dialog', { name: 'Blank load' });
    const weight = within(dialog).getByRole('spinbutton', { name: 'Weight (lb)' }) as HTMLInputElement;
    expect(weight.value).toBe('');
    expect(weight.placeholder).toBe('—');
    expect(within(dialog).getByText('No previous set')).toBeTruthy();

    await user.type(weight, '0');
    await user.click(within(dialog).getByRole('button', { name: 'Log set 1' }));
    expect(changes.at(-1)?.guidedSessionDraft?.exercises[0]?.sets[0]).toMatchObject({
      status: 'performed',
      actualLoad: { kind: 'external', meaning: 'total', value: 0, unit: 'lb' }
    });
  });

  it('keeps guided-session start errors visible and does not show a false saved state', async () => {
    const data = createStrengthData();
    data.savedWorkouts = [{
      id: 'start-error-template',
      name: 'Bench',
      muscleIds: ['chest'],
      sharedWith: [],
      exercises: [{
        id: 'start-error-exercise',
        name: 'Bench Press',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        loadMeaning: 'total',
        restDurationSeconds: 60,
        sets: [{ id: 'start-error-set', targetReps: 8, targetLoad: { kind: 'external', meaning: 'total', value: 100, unit: 'lb' } }]
      }]
    }];
    renderStrength(data, 'recommended', 'Preview storage changed in another tab.');
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Workouts' }));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Start workout' }));
    expect(screen.getByRole('alert').textContent).toContain('Preview storage changed');
    expect(screen.getByRole('dialog', { name: 'Start Bench?' })).toBeTruthy();
  });

  it('uses exercise-specific rest defaults and auto-starts only after a performed set', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    data.savedWorkouts = [{
      id: 'rest-default-template',
      name: 'Rest defaults',
      muscleIds: ['chest', 'triceps'],
      sharedWith: [],
      exercises: [
        {
          id: 'rest-bench',
          name: 'Bench Press',
          muscleIds: ['chest'],
          equipment: 'Barbell',
          loadMeaning: 'total',
          restDurationSeconds: 180,
          sets: [
            { id: 'rest-bench-1', targetReps: 8, targetLoad: { kind: 'external', meaning: 'total', value: 100, unit: 'lb' } },
            { id: 'rest-bench-2', targetReps: 8, targetLoad: { kind: 'external', meaning: 'total', value: 100, unit: 'lb' } }
          ]
        },
        {
          id: 'rest-triceps',
          name: 'Tricep Extensions',
          muscleIds: ['triceps'],
          equipment: 'Dumbbells',
          loadMeaning: 'per-dumbbell',
          restDurationSeconds: 120,
          sets: [{ id: 'rest-triceps-1', targetReps: 10, targetLoad: { kind: 'external', meaning: 'per-dumbbell', value: 40, unit: 'lb' } }]
        }
      ]
    }];
    const { changes } = renderStatefulStrength(data);
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    await user.click(screen.getByRole('button', { name: 'Start workout' }));
    const dialog = screen.getByRole('dialog', { name: 'Rest defaults' });
    const timer = within(dialog).getByRole('region', { name: 'Rest timer' });
    expect(within(timer).getByRole('timer', { name: 'Rest countdown' }).textContent).toBe('03:00');
    expect(within(timer).getByRole('button', { name: 'Start rest timer' })).toBeTruthy();
    expect(within(timer).queryByRole('button', { name: 'Start' })).toBeNull();
    const durationButton = within(timer).getByRole('button', { name: 'Rest duration 03:00; timer options' });
    await user.click(durationButton);
    const picker = screen.getByRole('dialog', { name: 'Rest timer options' });
    expect(within(picker).getByRole('checkbox', { name: 'Auto-start rest' })).toHaveProperty('checked', true);
    expect(within(picker).getByRole('button', { name: '01:00' })).toBeTruthy();
    expect(within(picker).getByRole('button', { name: '01:30' })).toBeTruthy();
    expect(within(picker).getByRole('button', { name: '02:00' })).toBeTruthy();
    expect(within(picker).getByRole('button', { name: '02:30' })).toBeTruthy();
    expect(within(picker).getByRole('button', { name: '03:00' })).toBeTruthy();
    expect(durationButton)
      .toHaveProperty('ariaExpanded', 'true');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Rest timer options' })).toBeNull();
    expect(document.activeElement).toBe(durationButton);
    await user.click(durationButton);
    await user.click(within(screen.getByRole('dialog', { name: 'Rest timer options' }))
      .getByRole('button', { name: '02:30' }));
    expect(within(timer).getByRole('timer', { name: 'Rest countdown' }).textContent).toBe('02:30');
    expect(within(timer).queryByText('Paused · Tap to resume')).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Rest timer options' })).toBeNull();
    const updatedDurationButton = within(timer).getByRole('button', { name: 'Rest duration 02:30; timer options' });
    expect(document.activeElement).toBe(updatedDurationButton);
    await user.click(updatedDurationButton);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Rest timer options' })).toBeNull();
    expect(document.activeElement).toBe(updatedDurationButton);

    const exerciseChoice = within(dialog).getByRole('button', { name: '1 of 2' });
    await user.click(exerciseChoice);
    await user.click(screen.getByRole('menuitem', { name: /Tricep Extensions/ }));
    expect(within(timer).getByRole('timer', { name: 'Rest countdown' }).textContent).toBe('02:00');
    await user.click(within(dialog).getByRole('button', { name: '2 of 2' }));
    await user.click(screen.getByRole('menuitem', { name: /Bench Press/ }));
    expect(within(timer).getByRole('timer', { name: 'Rest countdown' }).textContent).toBe('03:00');
    await user.clear(within(dialog).getByRole('spinbutton', { name: 'Reps' }));
    await user.type(within(dialog).getByRole('spinbutton', { name: 'Reps' }), '7');
    expect(changes.at(-1)?.guidedSessionDraft?.restTimer).toMatchObject({ status: 'idle', durationSeconds: 180 });
    await user.click(within(dialog).getByRole('button', { name: 'Skip set' }));
    expect(changes.at(-1)?.guidedSessionDraft?.restTimer).toMatchObject({ status: 'idle', durationSeconds: 180 });

    await user.click(within(dialog).getByRole('button', { name: 'Log set 2' }));
    expect(changes.at(-1)?.guidedSessionDraft).toMatchObject({
      autoStartRest: true,
      restTimer: { status: 'running', durationSeconds: 180 }
    });
    expect(changes.at(-1)?.guidedSessionDraft?.exercises[0]?.sets.map(item => item.status))
      .toEqual(['skipped', 'performed']);

    const activeDeadline = changes.at(-1)?.guidedSessionDraft?.restTimer;
    await user.click(within(dialog).getByRole('button', { name: '2 of 2' }));
    await user.click(screen.getByRole('menuitem', { name: /Bench Press/ }));
    expect(changes.at(-1)?.guidedSessionDraft?.restTimer).toEqual(activeDeadline);
  });

  it('announces sound changes accessibly without a permanent visible status note', async () => {
    class ReadyAudioContext {
      state: AudioContextState = 'running';
      resume = vi.fn(async () => undefined);
      close = vi.fn(async () => { this.state = 'closed'; });
    }
    const audioContextDescriptor = Object.getOwnPropertyDescriptor(window, 'AudioContext');
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: ReadyAudioContext });
    testRestorers.push(() => {
      if (audioContextDescriptor) Object.defineProperty(window, 'AudioContext', audioContextDescriptor);
      else Reflect.deleteProperty(window, 'AudioContext');
    });
    const user = userEvent.setup();
    const data = createStrengthData();
    data.savedWorkouts = [{
      id: 'rest-sound-template',
      name: 'Sound toggles',
      muscleIds: ['chest'],
      sharedWith: [],
      exercises: [{
        id: 'sound-exercise',
        name: 'Bench Press',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        loadMeaning: 'total',
        restDurationSeconds: 60,
        sets: [{ id: 'sound-set', targetReps: 8, targetLoad: { kind: 'external', meaning: 'total', value: 100, unit: 'lb' } }]
      }]
    }];
    const { changes } = renderStatefulStrength(data);
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    await user.click(screen.getByRole('button', { name: 'Start workout' }));
    const dialog = screen.getByRole('dialog', { name: 'Sound toggles' });
    const timer = within(dialog).getByRole('region', { name: 'Rest timer' });
    await user.click(within(timer).getByRole('button', { name: /Rest duration .* timer options/ }));
    const options = screen.getByRole('dialog', { name: 'Rest timer options' });
    const sound = within(options).getByRole('checkbox', { name: 'Sound' });
    await user.click(sound);
    expect(within(timer).getByRole('status').textContent).toBe('Rest timer sound is on.');
    expect(within(timer).queryByText('Rest timer sound is on.')?.classList.contains('visually-hidden')).toBe(true);
    await user.click(sound);
    expect(within(timer).queryByText('Rest timer sound is on.')).toBeNull();
    expect(sound).toHaveProperty('checked', false);
    expect(changes.at(-1)?.guidedSessionDraft?.restTimer).toMatchObject({ durationSeconds: 60 });
  });

  it('recomputes a resumed countdown from its deadline and does not replay a stale alert', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-30T12:00:00.000Z'));
    const click = async (target: HTMLElement) => {
      await act(async () => {
        fireEvent.click(target);
        await Promise.resolve();
      });
    };
    const data = createStrengthData();
    data.savedWorkouts = [{
      id: 'rest-resume-template',
      name: 'Resume rest',
      muscleIds: ['chest'],
      sharedWith: [],
      exercises: [{
        id: 'rest-resume-exercise',
        name: 'Bench Press',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        loadMeaning: 'total',
        restDurationSeconds: 60,
        sets: [{ id: 'rest-resume-set', targetReps: 8, targetLoad: { kind: 'external', meaning: 'total', value: 100, unit: 'lb' } }]
      }]
    }];
    const { changes } = renderStatefulStrength(data);
    await click(screen.getByRole('tab', { name: 'Workouts' }));
    await click(screen.getByRole('button', { name: 'Start workout' }));
    let dialog = screen.getByRole('dialog', { name: 'Resume rest' });
    const timer = within(dialog).getByRole('region', { name: 'Rest timer' });
    await click(within(timer).getByRole('button', { name: 'Start rest timer' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(within(timer).getByRole('timer', { name: 'Rest countdown' }).textContent).toBe('00:45');
    await click(within(timer).getByRole('button', { name: 'Pause rest timer' }));
    expect(changes.at(-1)?.guidedSessionDraft?.restTimer).toMatchObject({
      status: 'paused',
      durationSeconds: 60,
      remainingMilliseconds: 45000
    });
    const pausedData = changes.at(-1)!;
    cleanup();

    vi.setSystemTime(new Date('2026-10-30T12:00:30.000Z'));
    const { changes: resumedChanges } = renderStatefulStrength(pausedData);
    await click(screen.getByRole('button', { name: 'Resume workout' }));
    dialog = screen.getByRole('dialog', { name: 'Resume rest' });
    const resumedTimer = within(dialog).getByRole('region', { name: 'Rest timer' });
    expect(within(resumedTimer).getByRole('timer', { name: 'Rest countdown' }).textContent).toBe('00:45');
    await click(within(resumedTimer).getByRole('button', { name: 'Resume rest timer' }));
    const runningData = resumedChanges.at(-1)!;
    const runningTimer = runningData.guidedSessionDraft?.restTimer;
    expect(runningTimer?.status).toBe('running');
    if (runningTimer?.status !== 'running') return;
    const deadline = Date.parse(runningTimer.deadlineAt);
    cleanup();

    vi.setSystemTime(new Date(deadline + 1000));
    const { changes: expiredChanges } = renderStatefulStrength(runningData);
    await click(screen.getByRole('button', { name: 'Resume workout' }));
    dialog = screen.getByRole('dialog', { name: 'Resume rest' });
    const expiredTimer = within(dialog).getByRole('region', { name: 'Rest timer' });
    expect(within(expiredTimer).getByText('Rest complete')).toBeTruthy();
    expect(within(expiredTimer).queryByRole('button', { name: 'Stop alarm' })).toBeNull();
    expect(within(expiredTimer).getByRole('status').textContent).toBe('');
    expect(expiredChanges.at(-1)?.guidedSessionDraft?.restTimer).toMatchObject({
      status: 'complete',
      durationSeconds: 60
    });
    expect(expiredChanges.at(-1)?.guidedSessionDraft?.exercises[0]?.sets[0]?.status).toBe('pending');
    expect(expiredChanges.at(-1)?.workouts).toHaveLength(0);
  });

  it('requires sound opt-in, repeats the chime until stopped, and cleans up audio', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-30T12:00:00.000Z'));
    const click = async (target: HTMLElement) => {
      await act(async () => {
        fireEvent.click(target);
        await Promise.resolve();
      });
    };
    const oscillators: Array<{
      type: OscillatorType;
      frequency: { value: number };
      onended: (() => void) | null;
      connect: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
    }> = [];
    const audioContexts: Array<{ close: ReturnType<typeof vi.fn> }> = [];
    class FakeAudioContext {
      state: AudioContextState = 'running';
      currentTime = 0;
      destination = {} as AudioDestinationNode;
      resume = vi.fn(async () => undefined);
      close = vi.fn(async () => { this.state = 'closed'; });
      constructor() {
        audioContexts.push(this);
      }
      createOscillator() {
        let oscillator: (typeof oscillators)[number];
        oscillator = {
          type: 'sine',
          frequency: { value: 0 },
          onended: null,
          connect: vi.fn(),
          disconnect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(() => {
            window.setTimeout(() => oscillator.onended?.(), 350);
          })
        };
        oscillators.push(oscillator);
        return oscillator as unknown as OscillatorNode;
      }
      createGain() {
        return {
          gain: {
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn()
          },
          connect: vi.fn(),
          disconnect: vi.fn()
        } as unknown as GainNode;
      }
    }
    const audioContextDescriptor = Object.getOwnPropertyDescriptor(window, 'AudioContext');
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: FakeAudioContext });
    testRestorers.push(() => {
      if (audioContextDescriptor) Object.defineProperty(window, 'AudioContext', audioContextDescriptor);
      else Reflect.deleteProperty(window, 'AudioContext');
    });
    const data = createStrengthData();
    data.savedWorkouts = [{
      id: 'rest-sound-template',
      name: 'Sound rest',
      muscleIds: ['chest'],
      sharedWith: [],
      exercises: [{
        id: 'rest-sound-exercise',
        name: 'Bench Press',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        loadMeaning: 'total',
        restDurationSeconds: 60,
        sets: [{ id: 'rest-sound-set', targetReps: 8, targetLoad: { kind: 'external', meaning: 'total', value: 100, unit: 'lb' } }]
      }]
    }];
    const { changes } = renderStatefulStrength(data);
    await click(screen.getByRole('tab', { name: 'Workouts' }));
    await click(screen.getByRole('button', { name: 'Start workout' }));
    const dialog = screen.getByRole('dialog', { name: 'Sound rest' });
    const timer = within(dialog).getByRole('region', { name: 'Rest timer' });
    await click(within(timer).getByRole('button', { name: /Rest duration .* timer options/ }));
    const options = screen.getByRole('dialog', { name: 'Rest timer options' });
    const sound = within(options).getByRole('checkbox', { name: 'Sound' });
    expect(sound).toHaveProperty('checked', false);
    await click(sound);
    expect(within(timer).getByRole('status').textContent).toBe('Rest timer sound is on.');
    expect(within(options).getByRole('heading', { name: 'Custom duration' })).toBeTruthy();
    fireEvent.change(within(options).getByRole('spinbutton', { name: 'Minutes' }), { target: { value: '0' } });
    fireEvent.change(within(options).getByRole('spinbutton', { name: 'Seconds' }), { target: { value: '1' } });
    await click(within(options).getByRole('button', { name: 'Apply' }));
    expect(changes.at(-1)?.savedWorkouts[0]?.exercises?.[0]).toMatchObject({
      restDurationSeconds: 1,
      restDurationOverridden: true
    });
    expect(changes.at(-1)?.guidedSessionDraft?.restTimer).toEqual({ status: 'idle', durationSeconds: 1 });
    expect(screen.queryByRole('dialog', { name: 'Rest timer options' })).toBeNull();
    await click(within(timer).getByRole('button', { name: 'Start rest timer' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(within(timer).getByText('Tap to stop')).toBeTruthy();
    const restAlarmButton = within(timer).getByRole('button', { name: 'Stop rest alarm' });
    expect(oscillators).toHaveLength(2);
    expect(changes.filter(item => item.guidedSessionDraft?.restTimer?.status === 'complete')).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(oscillators).toHaveLength(6);
    await click(restAlarmButton);
    expect(within(timer).queryByRole('button', { name: 'Stop rest alarm' })).toBeNull();
    expect(oscillators.every(oscillator => oscillator.stop.mock.calls.length > 0)).toBe(true);

    await click(within(timer).getByRole('button', { name: /Rest duration .* timer options/ }));
    const resetOptions = screen.getByRole('dialog', { name: 'Rest timer options' });
    await click(within(resetOptions).getByRole('button', { name: 'Reset rest timer' }));
    await click(within(timer).getByRole('button', { name: 'Start rest timer' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(oscillators).toHaveLength(8);
    expect(within(timer).getByRole('button', { name: 'Stop rest alarm' })).toBeTruthy();
    await click(within(timer).getByRole('button', { name: /Rest duration .* timer options/ }));
    await click(within(screen.getByRole('dialog', { name: 'Rest timer options' }))
      .getByRole('checkbox', { name: 'Sound' }));
    expect(within(timer).queryByRole('button', { name: 'Stop rest alarm' })).toBeNull();
    expect(changes.filter(item => item.guidedSessionDraft?.restTimer?.status === 'complete')).toHaveLength(2);

    await click(within(dialog).getByRole('button', { name: '1 of 1' }));
    await click(screen.getByRole('menuitem', { name: 'Discard workout' }));
    const discardDialog = screen.getByRole('alertdialog', { name: 'Discard this workout?' });
    await click(within(discardDialog).getByRole('button', { name: 'Discard workout' }));
    expect(screen.queryByRole('dialog', { name: 'Sound rest' })).toBeNull();
    expect(audioContexts[0]?.close).toHaveBeenCalledOnce();
    expect(changes.at(-1)?.guidedSessionDraft).toBeUndefined();

    cleanup();
    const { changes: finishChanges } = renderStatefulStrength(data);
    await click(screen.getByRole('tab', { name: 'Workouts' }));
    await click(screen.getByRole('button', { name: 'Start workout' }));
    const finishDialog = screen.getByRole('dialog', { name: 'Sound rest' });
    const finishTimer = within(finishDialog).getByRole('region', { name: 'Rest timer' });
    await click(within(finishTimer).getByRole('button', { name: /Rest duration .* timer options/ }));
    await click(within(screen.getByRole('dialog', { name: 'Rest timer options' }))
      .getByRole('checkbox', { name: 'Sound' }));
    await click(within(finishDialog).getByRole('button', { name: 'Log set 1' }));
    await click(within(finishDialog).getByRole('button', { name: 'Finish & review' }));
    await click(within(finishDialog).getByRole('button', { name: 'Finish & save' }));
    expect(screen.queryByRole('dialog', { name: 'Finish & review' })).toBeNull();
    expect(audioContexts[1]?.close).toHaveBeenCalledOnce();
    expect(finishChanges.at(-1)?.guidedSessionDraft).toBeUndefined();
    expect(finishChanges.at(-1)?.workouts).toHaveLength(1);
  });

  it('keeps the previous timer state visible when draft persistence conflicts', async () => {
    const data = createStrengthData();
    const template: StrengthSavedWorkout = {
      id: 'rest-conflict-template',
      name: 'Rest conflict',
      muscleIds: ['chest'],
      sharedWith: [],
      exercises: [{
        id: 'rest-conflict-exercise',
        name: 'Bench Press',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        loadMeaning: 'total',
        restDurationSeconds: 180,
        sets: [{ id: 'rest-conflict-set', targetReps: 8, targetLoad: { kind: 'external' as const, meaning: 'total' as const, value: 100, unit: 'lb' as const } }]
      }]
    };
    data.savedWorkouts = [template];
    const draft = createStrengthGuidedSession(template, {
      id: 'rest-conflict-session',
      date: '2026-10-30',
      startedAt: '2026-10-30T12:00:00.000Z',
      timeZone: 'UTC'
    });
    expect(draft.valid).toBe(true);
    if (!draft.valid) return;
    data.guidedSessionDraft = draft.session;
    renderStrength(data, 'recommended', 'Preview storage changed in another tab.');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Resume workout' }));
    const dialog = screen.getByRole('dialog', { name: 'Rest conflict' });
    const timer = within(dialog).getByRole('region', { name: 'Rest timer' });
    await user.click(within(timer).getByRole('button', { name: 'Start rest timer' }));
    expect(screen.getByRole('alert').textContent).toContain('Preview storage changed');
    expect(within(timer).getByRole('timer', { name: 'Rest countdown' }).textContent).toBe('03:00');
    expect(draft.session.restTimer).toMatchObject({ status: 'idle', durationSeconds: 180 });
  });

  it('does not claim sound is enabled when the browser keeps audio suspended', async () => {
    class SuspendedAudioContext {
      state: AudioContextState = 'suspended';
      resume = vi.fn(async () => undefined);
      close = vi.fn(async () => { this.state = 'closed'; });
    }
    const audioContextDescriptor = Object.getOwnPropertyDescriptor(window, 'AudioContext');
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: SuspendedAudioContext });
    testRestorers.push(() => {
      if (audioContextDescriptor) Object.defineProperty(window, 'AudioContext', audioContextDescriptor);
      else Reflect.deleteProperty(window, 'AudioContext');
    });
    const user = userEvent.setup();
    const data = createStrengthData();
    data.savedWorkouts = [{
      id: 'suspended-audio-template',
      name: 'Suspended audio',
      muscleIds: ['chest'],
      sharedWith: [],
      exercises: [{
        id: 'suspended-audio-exercise',
        name: 'Bench Press',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        loadMeaning: 'total',
        restDurationSeconds: 60,
        sets: [{ id: 'suspended-audio-set', targetReps: 8, targetLoad: { kind: 'external', meaning: 'total', value: 100, unit: 'lb' } }]
      }]
    }];
    renderStatefulStrength(data);
    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    await user.click(screen.getByRole('button', { name: 'Start workout' }));
    const dialog = screen.getByRole('dialog', { name: 'Suspended audio' });
    const timer = within(dialog).getByRole('region', { name: 'Rest timer' });
    await user.click(within(timer).getByRole('button', { name: /Rest duration .* timer options/ }));
    const soundOptions = screen.getByRole('dialog', { name: 'Rest timer options' });
    await user.click(within(soundOptions).getByRole('checkbox', { name: 'Sound' }));
    expect(await within(timer).findByText(
      'Audio is unavailable or suspended; the visual rest alert remains available.'
    )).toBeTruthy();
    expect(within(screen.getByRole('dialog', { name: 'Rest timer options' }))
      .getByRole('checkbox', { name: 'Sound' })).toHaveProperty('checked', false);
  });
});
