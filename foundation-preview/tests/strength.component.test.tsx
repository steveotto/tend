import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MouseEvent } from 'react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FitnessScoreSummary } from '../src/components/FitnessScoreSummary.tsx';
import { StrengthView } from '../src/components/StrengthView.tsx';
import type { CategoryScoreSelection } from '../src/domain/category-scoring.ts';
import {
  createStrengthData,
  createStrengthGuidedSession,
  confirmStrengthSessionSet,
  moveStrengthSessionToSet,
  saveStrengthScoringSetup,
  selectStrengthMuscleScores,
  strengthMuscleName,
  strengthWorkoutSuggestions
} from '../src/domain/strength.ts';
import type { StrengthData, StrengthMode, StrengthMuscleId, StrengthSavedWorkout, StrengthWorkoutLog } from '../src/domain/strength.ts';
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
  startRhythmLog = false,
  evaluationDate = '2026-10-22',
  healthScore?: CategoryScoreSelection,
  onStretchAfter?: (muscleIds: readonly StrengthMuscleId[], event: MouseEvent<HTMLButtonElement>) => void
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
      {...(healthScore ? { healthScore } : {})}
      rhythms={[{ rhythm, mode, ...(workoutId ? { workoutId } : {}) }]}
      evaluationDate={evaluationDate}
      onChange={onChange}
      {...(onStretchAfter ? { onStretchAfter } : {})}
      {...(opener
        ? { pendingRhythmLog: { requestId: 1, rhythm, mode, ...(workoutId ? { workoutId } : {}), opener } }
        : {})}
    />
  );
  return { ...result, onChange, rhythm, opener };
}

function confirmedWorkoutLog(
  date: string,
  id: string,
  muscleIds: StrengthWorkoutLog['muscleIds'] = ['chest']
): StrengthWorkoutLog {
  return {
    id,
    date,
    muscleIds,
    exercises: muscleIds.map(muscleId => ({
      id: `${id}-${muscleId}-exercise`,
      name: muscleId === 'chest' ? 'Bench Press' : `${strengthMuscleName(muscleId)} exercise`,
      muscleIds: [muscleId],
      equipment: 'Barbell',
      loadMeaning: 'total',
      restDurationSeconds: 60,
      sets: [{
        id: `${id}-${muscleId}-set`,
        targetReps: 8,
        status: 'performed',
        actualReps: 8,
        confirmedAt: `${date}T12:00:00.000Z`
      }]
    }))
  };
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

function guidedReplacementData(): StrengthData {
  const data = createStrengthData();
  const currentWorkout: StrengthSavedWorkout = {
    id: 'existing-guided-template',
    name: 'Current workout name',
    muscleIds: ['chest'],
    sharedWith: [],
    exercises: [{
      id: 'existing-guided-exercise',
      name: 'Bench Press',
      muscleIds: ['chest'],
      equipment: 'Barbell',
      loadMeaning: 'total',
      restDurationSeconds: 60,
      sets: [{ id: 'existing-guided-set', targetReps: 8 }]
    }]
  };
  data.savedWorkouts = [{
    id: 'replacement-guided-template',
    name: 'Next workout name',
    muscleIds: ['back'],
    sharedWith: [],
    exercises: [{
      id: 'replacement-guided-exercise',
      name: 'Row',
      muscleIds: ['back'],
      equipment: 'Dumbbells',
      loadMeaning: 'per-dumbbell',
      restDurationSeconds: 60,
      sets: [{ id: 'replacement-guided-set', targetReps: 8 }]
    }]
  }];
  const draft = createStrengthGuidedSession(currentWorkout, {
    id: 'existing-guided-session',
    date: '2026-10-22',
    startedAt: '2026-10-22T10:00:00.000Z',
    timeZone: 'UTC'
  });
  if (!draft.valid) throw new Error(draft.error);
  data.guidedSessionDraft = draft.session;
  return data;
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

function getSettingsMuscleSummary(dialog: HTMLElement, muscleName: string): HTMLElement {
  const summary = Array.from(dialog.querySelectorAll<HTMLElement>('.strength-setting-muscle__summary'))
    .find(element => element.querySelector('.strength-setting-muscle__name')?.textContent === muscleName);
  if (!summary) throw new Error(`Missing ${muscleName} settings summary`);
  return summary;
}

describe('Strength preview presentation', () => {
  it('uses the shared full-width action row and creates a saved workout from its renamed action', () => {
    const empty = renderStrength();
    fireEvent.click(screen.getByRole('tab', { name: 'Saved' }));
    const savedWorkouts = screen.getByRole('region', { name: 'Saved workouts' });
    expect(savedWorkouts.querySelector(':scope > .card')).toBeNull();
    const emptyActions = savedWorkouts.querySelector('.category-rhythm-entry-actions')!;
    expect([...emptyActions.querySelectorAll('button')].map(button => button.textContent?.trim()))
      .toEqual(['Create workout', 'Suggestions']);
    expect(emptyActions.classList.contains('category-rhythm-entry-actions')).toBe(true);
    expect(within(savedWorkouts).getByText('No saved workouts yet. Create one to quickly log your usual muscle groups.'))
      .toBeTruthy();
    expect(within(savedWorkouts).getByText('Workout templates are separate from recorded activity.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create workout' }));
    const creationDialog = screen.getByRole('dialog', { name: 'Add saved workout' });
    expect(creationDialog).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Workout name' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Add saved workout' })).toBeNull();
    empty.unmount();

    const data = createStrengthData();
    data.savedWorkouts = [{
      id: 'populated-saved-workout',
      name: 'Synthetic upper body',
      muscleIds: ['chest', 'back'],
      sharedWith: []
    }];
    renderStrength(data);
    fireEvent.click(screen.getByRole('tab', { name: 'Saved' }));
    const populatedWorkouts = screen.getByRole('region', { name: 'Saved workouts' });
    expect(populatedWorkouts.querySelector(':scope > .card')).toBeNull();
    const populatedActions = populatedWorkouts.querySelector('.category-rhythm-entry-actions')!;
    expect([...populatedActions.querySelectorAll('button')].map(button => button.textContent?.trim()))
      .toEqual(['Create workout', 'Suggestions']);
    expect(within(populatedWorkouts).getByRole('heading', { name: 'Synthetic upper body' })).toBeTruthy();
    expect(within(populatedWorkouts).queryByText('No saved workouts yet. Create one to quickly log your usual muscle groups.'))
      .toBeNull();
  });

  it('resumes or cancels an in-progress workout using its actual session name', async () => {
    const user = userEvent.setup();
    const data = guidedReplacementData();
    const { onChange } = renderStrength(data);
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    await user.click(screen.getByRole('button', { name: 'Start workout' }));

    const dialog = screen.getByRole('dialog', { name: 'Workout in progress' });
    expect(within(dialog).getByText(/Current workout name is in progress/)).toBeTruthy();
    expect(within(dialog).queryByRole('alert')).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Resume' }));
    expect(screen.getByRole('dialog', { name: 'Current workout name' })).toBeTruthy();
    expect(data.guidedSessionDraft?.workoutName).toBe('Current workout name');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('cancels the replacement choice without changing the saved session draft', async () => {
    const user = userEvent.setup();
    const data = guidedReplacementData();
    const currentDraft = data.guidedSessionDraft;
    const { onChange } = renderStrength(data);
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    await user.click(screen.getByRole('button', { name: 'Start workout' }));

    const dialog = screen.getByRole('dialog', { name: 'Workout in progress' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(data.guidedSessionDraft).toBe(currentDraft);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('replaces the choice screen with a named confirmation and keeps the draft on Keep workout', async () => {
    const user = userEvent.setup();
    const data = guidedReplacementData();
    const currentDraft = data.guidedSessionDraft;
    const { onChange } = renderStrength(data);
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    await user.click(screen.getByRole('button', { name: 'Start workout' }));

    const dialog = screen.getByRole('dialog', { name: 'Workout in progress' });
    expect(within(dialog).queryByText('Next workout name')).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Discard and start…' }));

    expect(screen.getByRole('dialog', { name: 'Discard Current workout name?' })).toBe(dialog);
    expect(within(dialog).getByText('Next workout name')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Discard and start' })).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Keep workout' }));

    expect(screen.getByRole('dialog', { name: 'Workout in progress' })).toBe(dialog);
    expect(data.guidedSessionDraft).toBe(currentDraft);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('starts the named replacement only after confirmation and preserves the old draft on failure', async () => {
    const user = userEvent.setup();
    const success = renderStatefulStrength(guidedReplacementData());
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    await user.click(screen.getByRole('button', { name: 'Start workout' }));
    let dialog = screen.getByRole('dialog', { name: 'Workout in progress' });
    await user.click(within(dialog).getByRole('button', { name: 'Discard and start…' }));
    dialog = screen.getByRole('dialog', { name: 'Discard Current workout name?' });
    expect(within(dialog).getByText('Next workout name')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Discard and start' }));

    expect(screen.getByRole('dialog', { name: 'Next workout name' })).toBeTruthy();
    expect(success.changes.at(-1)?.guidedSessionDraft?.workoutName).toBe('Next workout name');

    cleanup();
    const failedData = guidedReplacementData();
    const currentDraft = failedData.guidedSessionDraft;
    const failed = renderStrength(failedData, 'recommended', 'synthetic persistence failure');
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    await user.click(screen.getByRole('button', { name: 'Start workout' }));
    dialog = screen.getByRole('dialog', { name: 'Workout in progress' });
    expect(within(dialog).queryByRole('alert')).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Discard and start…' }));
    dialog = screen.getByRole('dialog', { name: 'Discard Current workout name?' });
    await user.click(within(dialog).getByRole('button', { name: 'Discard and start' }));

    expect(screen.getByRole('dialog', { name: 'Discard Current workout name?' })).toBe(dialog);
    expect(within(dialog).getByRole('alert').textContent)
      .toBe('Could not start the new workout. Your current workout is unchanged.');
    expect(failedData.guidedSessionDraft).toBe(currentDraft);
    expect(failed.onChange).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Next workout name' })).toBeNull();
  });

  it('shows the Recommended subtitle and one left-aligned Custom workout action before results or empty state', async () => {
    const empty = renderStrength();
    const emptyPanel = screen.getByRole('tabpanel', { name: 'Recommended' });
    expect(screen.getByRole('tab', { name: 'Recommended' }).getAttribute('aria-selected')).toBe('true');
    expect(emptyPanel.querySelector(':scope > .card')).toBeNull();
    const emptyHeading = within(emptyPanel).getByRole('heading', { name: 'Recommended workouts' });
    expect(within(emptyPanel).getByText('Suggestions based on your recent training.')).toBeTruthy();
    const emptyAction = within(emptyPanel).getByRole('button', { name: 'Custom workout' });
    const emptyMessage = within(emptyPanel).getByText('Save a workout to get recommendations, or log a custom workout.');
    expect(within(emptyPanel).getAllByRole('button', { name: 'Custom workout' })).toHaveLength(1);
    expect(emptyHeading.compareDocumentPosition(emptyAction) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(emptyAction.compareDocumentPosition(emptyMessage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(emptyAction.parentElement?.classList.contains('category-rhythm-entry-actions')).toBe(true);
    expect(within(emptyPanel).queryByText(/Suggested from your training goals/)).toBeNull();
    const emptyUser = userEvent.setup();
    await emptyUser.click(emptyAction);
    const emptyLogDialog = screen.getByRole('dialog', { name: 'Log workout' });
    expect(within(emptyLogDialog).getByRole('checkbox', { name: 'Chest' })).toHaveProperty('checked', false);
    await emptyUser.click(within(emptyLogDialog).getByRole('button', { name: 'Cancel' }));
    empty.unmount();

    const data = createStrengthData();
    data.savedWorkouts = [{
      id: 'recommended-upper',
      name: 'Upper body',
      muscleIds: ['chest', 'back'],
      sharedWith: []
    }];
    const user = userEvent.setup();
    renderStrength(data);
    const panel = screen.getByRole('tabpanel', { name: 'Recommended' });
    const action = within(panel).getByRole('button', { name: 'Custom workout' });
    const results = panel.querySelector('.strength-recommendations')!;
    expect(panel.querySelector(':scope > .card')).toBeNull();
    expect(within(panel).getByRole('heading', { name: 'Recommended workouts' })).toBeTruthy();
    expect(within(panel).getByText('Suggestions based on your recent training.')).toBeTruthy();
    expect(within(panel).getAllByRole('button', { name: 'Custom workout' })).toHaveLength(1);
    expect(action.parentElement?.classList.contains('category-rhythm-entry-actions')).toBe(true);
    expect(action.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const cards = results.querySelectorAll<HTMLElement>(':scope > .strength-recommendation');
    expect(cards).toHaveLength(1);
    const card = cards[0]!;
    expect(within(card).getByRole('heading', { name: 'Upper body' })).toBeTruthy();
    expect(within(card).getByText(/Targets two muscle groups/)).toBeTruthy();
    expect(within(card).getByText('Chest · Back')).toBeTruthy();
    await user.click(within(card).getByRole('button', { name: 'Log workout' }));
    let dialog = screen.getByRole('dialog', { name: 'Log workout' });
    expect(within(dialog).getByRole('checkbox', { name: 'Chest' })).toHaveProperty('checked', true);
    expect(within(dialog).getByRole('checkbox', { name: 'Back' })).toHaveProperty('checked', true);
    await user.click(within(dialog).getByRole('button', { name: 'Close workout log' }));
    await user.click(action);
    dialog = screen.getByRole('dialog', { name: 'Log workout' });
    expect(within(dialog).getByRole('checkbox', { name: 'Chest' })).toHaveProperty('checked', false);
  });

  it('offers an explicit Stretch after? handoff for selected workout muscle groups', async () => {
    const user = userEvent.setup();
    const onStretchAfter = vi.fn();
    const { onChange } = renderStrength(createStrengthData(), 'recommended', null, undefined, false,
      '2026-10-22', undefined, onStretchAfter);
    await user.click(screen.getByRole('button', { name: 'Custom workout' }));
    const dialog = screen.getByRole('dialog', { name: 'Log workout' });
    await user.click(within(dialog).getByRole('checkbox', { name: 'Chest' }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Biceps' }));
    await user.click(within(dialog).getByRole('button', { name: 'Stretch after?' }));

    expect(onStretchAfter).toHaveBeenCalledOnce();
    expect(onStretchAfter.mock.calls[0]?.[0]).toEqual(['chest', 'biceps']);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Log workout' })).toBeNull();
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
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
    const map = screen.getByRole('group', { name: 'Front muscle training status map' }) as HTMLElement;
    const chest = within(map).getByRole('button', { name: 'Chest, Health score unavailable, Not logged yet.' });
    chest.focus();
    await user.keyboard('{Enter}');
    expect(chest.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Chest details' })).toBeTruthy();
    const muscleList = screen.getByRole('group', { name: 'Muscle training status' });
    const frontRows = within(muscleList).getAllByRole('button');
    expect(frontRows.map(row => row.querySelector('strong')?.textContent))
      .toEqual(['Chest', 'Biceps', 'Shoulders', 'Abs', 'Quads']);
    expect([...map.querySelectorAll<SVGPathElement>('[data-muscle]')].map(path => path.dataset.muscle).sort())
      .toEqual(['abs', 'biceps', 'chest', 'quads', 'shoulders']);
    expect(map.querySelector('[data-muscle="back"]')).toBeNull();
    expect(map.querySelector('[data-muscle="calves"]')).toBeNull();
    expect(map.querySelector('[data-muscle="chest"]')?.getAttribute('d'))
      .toContain('M81 89Q96 80');
    expect(map.querySelector('[data-muscle="abs"]')?.getAttribute('d'))
      .toContain('M89 139L107 137');
    expect(map.querySelector('[data-muscle="quads"]')?.getAttribute('d'))
      .toContain('M73 206L105 205');

    await user.click(screen.getByRole('button', { name: 'Back' }));
    const backMap = screen.getByRole('group', { name: 'Back muscle training status map' });
    const backRows = within(muscleList).getAllByRole('button');
    expect(backRows.map(row => row.querySelector('strong')?.textContent))
      .toEqual(['Back', 'Triceps', 'Shoulders', 'Hamstrings', 'Calves']);
    expect(backMap.querySelector('[data-muscle="chest"]')).toBeNull();
    expect(backMap.querySelector('[data-muscle="quads"]')).toBeNull();
    expect(backMap.querySelector('[data-muscle="back"]')?.getAttribute('d'))
      .toContain('M81 89L107 81L107 178');
    expect(backMap.querySelector('[data-muscle="hamstrings"]')?.getAttribute('d'))
      .toContain('M73 213L105 214');
    expect(backMap.querySelector('[data-muscle="calves"]')?.getAttribute('d'))
      .toContain('M79 284L100 279');
    const backRow = within(muscleList).getByRole('button', { name: /Back\. Training status: No log/ });
    expect(backRow.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Back details' })).toBeTruthy();
    expect(backMap.querySelector('[data-muscle="back"]')?.getAttribute('aria-pressed')).toBe('true');

    await user.click(within(muscleList).getByRole('button', { name: /Shoulders\. Training status: No log/ }));
    await user.click(screen.getByRole('button', { name: 'Front' }));
    expect(screen.getByRole('heading', { name: 'Shoulders details' })).toBeTruthy();
    expect(within(muscleList).getByRole('button', { name: /Shoulders\. Training status: No log/ })
      .getAttribute('aria-pressed')).toBe('true');

    await user.click(screen.getByRole('button', { name: 'Back' }));
    const backCalvesPath = screen.getByRole('group', { name: 'Back muscle training status map' })
      .querySelector('[data-muscle="calves"]');
    if (!backCalvesPath) throw new Error('Back calves body-map path missing');
    await user.click(backCalvesPath);
    expect(screen.getByRole('heading', { name: 'Calves details' })).toBeTruthy();
    expect(within(muscleList).getByRole('button', { name: /Calves\. Training status: No log/ })
      .getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('group', { name: 'Back muscle training status map' })
      .querySelector('[data-muscle="calves"]')?.getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Front' }));
    expect(screen.getByRole('heading', { name: 'Chest details' })).toBeTruthy();
    expect(within(muscleList).getByRole('button', { name: /Chest\. Training status: No log/ })
      .getAttribute('aria-pressed')).toBe('true');
  });

  it('shows compact Strength gauges and opens scoring details in a modal', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    data.workouts = [{ id: 'legacy-chest', date: '2026-10-21', muscleIds: ['chest'] }];
    renderStrength(data);

    expect(screen.getByRole('heading', { name: 'Chest details' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Strength Health' })).toBeTruthy();
    const overallScores = document.querySelector('.strength-page > .fitness-score-summary') as HTMLElement;
    expect(overallScores.classList.contains('rhythm-history-view__score-card')).toBe(true);
    expect(within(overallScores).getByRole('img', { name: 'Strength Health: Not enough data' })).toBeTruthy();
    expect(within(overallScores).getByRole('img', { name: 'Consistency: Score unavailable' })).toBeTruthy();
    expect(within(overallScores).getByRole('img', { name: 'On Track: Score unavailable' })).toBeTruthy();
    expect(within(overallScores).queryByText('No approved overall Strength Health aggregate is available.')).toBeNull();
    expect(screen.queryByText(/effective-dated settings/i)).toBeNull();

    const details = within(overallScores).getByRole('button', { name: 'Show Strength Health scoring details' });
    expect(details.getAttribute('aria-expanded')).toBe('false');
    await user.click(details);
    const dialog = screen.getByRole('dialog', { name: 'Strength Health details' });
    expect(dialog.classList.contains('dialog--phone-fullscreen')).toBe(false);
    const explanation = within(dialog).getByRole('region', { name: 'Strength Health scoring details' });
    expect(within(explanation).getByRole('img', { name: 'Strength Health: Not enough data' })).toBeTruthy();
    const breakdown = within(explanation).getByRole('region', { name: 'Strength Health scoring details score summary' });
    expect(within(breakdown).getByRole('img', { name: 'Consistency: Score unavailable' })).toBeTruthy();
    expect(within(breakdown).getByRole('img', { name: 'On Track: Score unavailable' })).toBeTruthy();
    expect(breakdown.querySelector('.rhythm-history-view__health-weight-score')).toBeNull();
    const scoringToggle = within(explanation)
      .getByRole('button', { name: 'How this Strength Foundation was scored' });
    expect(scoringToggle.getAttribute('aria-expanded')).toBe('false');
    await user.click(scoringToggle);
    expect(within(explanation).getByRole('heading', { name: 'How Health is calculated' })).toBeTruthy();
    expect(within(explanation).getByText('75%')).toBeTruthy();
    expect(within(explanation).getByText('25%')).toBeTruthy();
    expect(within(explanation).getByRole('heading', { name: 'How this Strength Foundation contributes' })).toBeTruthy();
    await user.click(within(explanation).getByRole('button', { name: 'How this Strength Foundation contributes' }));
    expect(within(explanation).getByRole('heading', { name: 'Linked Rhythms' })).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'About Strength scoring' }));
    const scoringDialog = screen.getByRole('dialog', { name: 'Strength scoring' });
    expect(within(scoringDialog).getByText(/Strength Health reflects eligible Strength-linked Rhythm scores/)).toBeTruthy();
    await user.click(within(scoringDialog).getByRole('button', { name: 'Close scoring explanation' }));
    await user.click(within(dialog).getByRole('button', { name: 'Close Health details' }));

    const settingsButtons = screen.getAllByRole('button', { name: 'Strength settings' });
    expect(settingsButtons).toHaveLength(1);
    await user.click(settingsButtons[0]!);
    expect(screen.getByRole('dialog', { name: 'Strength settings' })).toBeTruthy();
  });

  it('keeps the overall score once and shows actual measures in Fitness Health details', async () => {
    const user = userEvent.setup();
    render(
      <FitnessScoreSummary
        category="Strength"
        health={81.5}
        consistency={75}
        onTrack={100}
        consistencyCaption="Consistency detail."
        onTrackCaption="On Track detail."
      />
    );

    await user.click(screen.getByRole('button', { name: 'Show Strength Health scoring details' }));
    const details = screen.getByRole('region', { name: 'Strength Health scoring details' });
    const scores = within(details).getByRole('region', { name: 'Strength Health scoring details score summary' });
    expect(within(scores).getByRole('meter', { name: 'Strength Health score' }).getAttribute('aria-valuenow')).toBe('81.5');
    expect(within(scores).getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuenow')).toBe('75');
    expect(within(scores).getByRole('meter', { name: 'On Track score' }).getAttribute('aria-valuenow')).toBe('100');
    expect(scores.querySelector('.rhythm-history-view__health-weight-score')).toBeNull();
    await user.click(within(details).getByRole('button', { name: 'How this Strength Foundation was scored' }));
    expect(within(details).getByRole('heading', { name: 'How Health is calculated' })).toBeTruthy();
  });

  it('keeps unavailable overall Strength Health separate from muscle On Track scores', () => {
    const data = createStrengthData();
    data.settings.muscleIntervals.chest = 7;
    const configured = saveStrengthScoringSetup(data, '2026-09-01', '2026-09-01');
    configured.workouts = [
      confirmedWorkoutLog('2026-09-01', 'score-first-window'),
      confirmedWorkoutLog('2026-09-08', 'score-second-window'),
      confirmedWorkoutLog('2026-09-20', 'score-third-window')
    ];
    renderStrength(configured, 'recommended', null, undefined, false, '2026-09-28');

    const overall = document.querySelector('.strength-page > .fitness-score-summary') as HTMLElement;
    expect(within(overall).getByRole('img', { name: 'Strength Health: Not enough data' })).toBeTruthy();
    expect(within(overall).getByRole('button', { name: 'Show Strength Health scoring details' })).toBeTruthy();
    const muscleList = screen.getByRole('group', { name: 'Muscle training status' });
    expect(within(muscleList).getByRole('button', { name: /Chest\. Training status: Overdue by 1 day/ })).toBeTruthy();
    const muscleDetail = document.querySelector('.strength-muscle-detail') as HTMLElement;
    expect(within(muscleDetail).queryByRole('meter')).toBeNull();
    expect(within(muscleDetail).queryByRole('button', { name: 'Show Strength Health scoring details' })).toBeNull();
    expect(within(muscleDetail).queryByRole('heading', { name: 'Consistency' })).toBeNull();
    expect(within(muscleDetail).queryByRole('heading', { name: 'On Track' })).toBeNull();
  });

  it('keeps Strength Health separate when muscle-grid scoring inputs change', () => {
    const data = createStrengthData();
    data.settings.muscleIntervals.chest = 7;
    const configured = saveStrengthScoringSetup(data, '2026-09-01', '2026-09-01');
    configured.workouts = [
      confirmedWorkoutLog('2026-09-01', 'separate-first-window'),
      confirmedWorkoutLog('2026-09-08', 'separate-second-window'),
      confirmedWorkoutLog('2026-09-20', 'separate-third-window')
    ];
    const healthScore: CategoryScoreSelection = {
      foundationIds: ['health-strength'],
      eligibleFoundationIds: ['health-strength'],
      excludedFoundationIds: [],
      unresolvedFoundationIds: [],
      consistency: 40,
      onTrack: 100,
      health: 55
    };
    const view = renderStrength(configured, 'recommended', null, undefined, false, '2026-09-28', healthScore);
    const summary = document.querySelector('.strength-page > .fitness-score-summary') as HTMLElement;
    const healthMeter = within(summary).getByRole('meter', { name: 'Strength Health score' });
    const muscleList = screen.getByRole('group', { name: 'Muscle training status' });

    expect(healthMeter.getAttribute('aria-valuenow')).toBe('55');
    expect(within(muscleList).getByRole('button', { name: /Chest\. Training status: Overdue by 1 day/ })).toBeTruthy();

    const changedMuscleSetup = createStrengthData();
    view.rerender(
      <StrengthView
        data={changedMuscleSetup}
        healthScore={healthScore}
        rhythms={[{ rhythm: view.rhythm, mode: 'recommended' }]}
        evaluationDate="2026-09-28"
        onChange={view.onChange}
      />
    );
    expect(within(summary).getByRole('meter', { name: 'Strength Health score' }).getAttribute('aria-valuenow'))
      .toBe('55');
    expect(within(muscleList).getByRole('button', { name: /Chest\. Training status: No log/ })).toBeTruthy();
  });

  it('shows selected muscle details in full-width rows and updates them when selection changes', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    data.settings.muscleIntervals.chest = 7;
    data.settings.muscleIntervals.back = 14;
    data.settings.preferredRestDays.back = 2;
    data.workouts = [
      { id: 'legacy-chest', date: '2026-10-20', muscleIds: ['chest'] },
      { id: 'legacy-back', date: '2026-10-20', muscleIds: ['back'] }
    ];
    renderStrength(data);

    const facts = document.querySelector('.strength-muscle-facts') as HTMLElement;
    expect(screen.getByRole('heading', { name: 'Chest details' })).toBeTruthy();
    expect(within(facts).getByText('Training interval')).toBeTruthy();
    expect(within(facts).getByText('Every 7 days')).toBeTruthy();
    expect(within(facts).getByText('Rest between workouts')).toBeTruthy();
    expect(within(facts).getByText('1 day')).toBeTruthy();
    expect(within(facts).getByText('Readiness')).toBeTruthy();
    expect(within(facts).getByText('Ready')).toBeTruthy();
    expect(within(facts).getByText('Last logged')).toBeTruthy();
    expect(within(facts).getByText('Oct 20, 2026')).toBeTruthy();
    expect(facts.querySelectorAll(':scope > div')).toHaveLength(4);

    const muscleDetail = document.querySelector('.strength-muscle-detail') as HTMLElement;
    expect(within(muscleDetail).queryByRole('meter')).toBeNull();
    expect(within(muscleDetail).queryByRole('button')).toBeNull();
    const muscleList = screen.getByRole('group', { name: 'Muscle training status' });
    expect(within(muscleList).getByRole('button', { name: /Chest\. Training status: Current/ })).toBeTruthy();
    expect(within(muscleList).getByRole('button', { name: /Chest\. Training status: Current/ }).textContent)
      .toContain('Next lift in 5d');

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'Back details' })).toBeTruthy();
    expect(within(facts).getByText('Every 14 days')).toBeTruthy();
    expect(within(facts).getByText('2 days')).toBeTruthy();
    expect(within(facts).getByText('Ready tomorrow')).toBeTruthy();
    expect(within(facts).getByText('Oct 20, 2026')).toBeTruthy();
    expect(within(muscleList).getByRole('button', { name: /Back\. Training status: Current/ }).textContent)
      .toContain('Next lift in 12d');
    await user.click(within(muscleList).getByRole('button', { name: /Shoulders\. Training status: No log/ }));
    expect(screen.getByRole('heading', { name: 'Shoulders details' })).toBeTruthy();
    expect(within(facts).getAllByText('Not logged yet')).toHaveLength(2);
  });

  it('shows status colors, last-workout labels, and next due dates for synthetic workouts', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    for (const muscle of ['chest', 'triceps', 'back', 'biceps', 'shoulders'] as const) {
      data.settings.muscleIntervals[muscle] = 7;
    }
    const configured = saveStrengthScoringSetup(data, '2026-10-20', '2026-10-20');
    configured.workouts = [
      confirmedWorkoutLog('2026-10-22', 'today-chest-triceps', ['chest', 'triceps']),
      confirmedWorkoutLog('2026-10-15', 'due-today-back', ['back']),
      confirmedWorkoutLog('2026-10-14', 'overdue-biceps', ['biceps']),
      confirmedWorkoutLog('2026-09-22', 'zero-shoulders', ['shoulders'])
    ];
    const scores = selectStrengthMuscleScores(configured, '2026-10-22');
    expect(scores.find(score => score.id === 'chest')?.consistency).toBeNull();
    expect(scores.find(score => score.id === 'chest')?.onTrack).toBe(100);
    renderStrength(configured);

    const muscleList = screen.getByRole('group', { name: 'Muscle training status' });
    const current = within(muscleList).getByRole('button', { name: /Chest\. Training status: Current/ });
    const frontNoLog = within(muscleList).getByRole('button', { name: /Abs\. Training status: No log/ });
    expect(current.textContent).toContain('Chest');
    expect(current.textContent).toContain('Today');
    expect(current.textContent).toContain('Next lift in 7d');
    expect(frontNoLog.textContent).toContain('No log yet');
    expect(frontNoLog.textContent).toContain('—');
    const overdue = within(muscleList).getByRole('button', { name: /Biceps\. Training status: Overdue by 1 day/ });
    expect(overdue.textContent).toContain('8d ago');
    expect(overdue.textContent).toContain('Overdue by 1d');

    await user.click(screen.getByRole('button', { name: 'Back' }));
    const due = within(muscleList).getByRole('button', { name: /Back\. Training status: Due today/ });
    const noLog = within(muscleList).getByRole('button', { name: /Hamstrings\. Training status: No log/ });
    expect(due.textContent).toContain('7d ago');
    expect(due.textContent).toContain('Due today');
    expect(noLog.textContent).toContain('No log yet');
    expect(noLog.textContent).toContain('—');
    expect(current.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Training status: Current');
    expect(due.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Training status: Due today');
    expect(overdue.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Training status: Overdue by 1 day');
    expect(noLog.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Training status: No log');
    expect(current.querySelector('.strength-muscle-row__status')?.classList.contains('strength-muscle-row__status--current'))
      .toBe(true);
    expect(due.querySelector('.strength-muscle-row__status')?.classList.contains('strength-muscle-row__status--due'))
      .toBe(true);
    expect(overdue.querySelector('.strength-muscle-row__status')?.classList.contains('strength-muscle-row__status--overdue'))
      .toBe(true);
    expect(noLog.querySelector('.strength-muscle-row__status')?.classList.contains('strength-muscle-row__status--unavailable'))
      .toBe(true);
    for (const row of [current, due, overdue, noLog]) {
      expect(row.querySelector('.strength-muscle-row__score')).toBeNull();
      expect(row.querySelector('.strength-muscle-row__track')).toBeNull();
      expect(row.querySelector('small')).toBeNull();
    }
    expect(screen.getAllByRole('button', { name: 'Show Strength Health scoring details' })).toHaveLength(1);
  });

  it('refreshes muscle timing after a workout is logged', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    data.settings.muscleIntervals.chest = 7;
    data.workouts = [{ id: 'previous-chest', date: '2026-10-15', muscleIds: ['chest'] }];
    const { changes } = renderStatefulStrength(data);
    const muscleList = screen.getByRole('group', { name: 'Muscle training status' });
    const chest = within(muscleList).getByRole('button', { name: /Chest\. Training status: Due today/ });
    expect(chest.textContent).toContain('7d ago');
    expect(chest.textContent).toContain('Due today');

    await user.click(screen.getByRole('button', { name: 'Custom workout' }));
    const dialog = screen.getByRole('dialog', { name: 'Log workout' });
    await user.click(within(dialog).getByRole('checkbox', { name: 'Chest' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save workout' }));

    expect(changes).toHaveLength(1);
    const refreshedChest = within(muscleList).getByRole('button', { name: /Chest\. Training status: Current/ });
    expect(refreshedChest.textContent).toContain('Today');
    expect(refreshedChest.textContent).toContain('Next lift in 7d');
    expect(within(document.querySelector('.strength-muscle-facts') as HTMLElement)
      .getByText('Oct 22, 2026')).toBeTruthy();
  });

  it('keeps legacy training status separate from unavailable Fitness Health', () => {
    const data = createStrengthData();
    data.settings.muscleIntervals.chest = 1;
    data.workouts = [{ id: 'old-chest', date: '2026-10-01', muscleIds: ['chest'] }];
    renderStrength(data);

    expect(screen.getByRole('meter', { name: 'Strength training status score' }).getAttribute('aria-valuenow')).toBe('0');
    const muscleList = screen.getByRole('group', { name: 'Muscle training status' });
    expect(within(muscleList).getByRole('button', { name: /Chest\. Training status: Overdue by 20 days/ })).toBeTruthy();
    expect(within(muscleList).getByRole('button', { name: /Abs\. Training status: No log/ })).toBeTruthy();
  });

  it('saves training goals with validation and returns focus to the opener on cancel', async () => {
    const user = userEvent.setup();
    const { onChange } = renderStrength();
    const opener = document.querySelector('.strength-map-card .settings-icon-button') as HTMLElement;
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Strength settings' });
    await user.click(getSettingsMuscleSummary(dialog, 'Chest'));
    const chestInterval = within(dialog).getByRole('spinbutton', { name: 'Chest training interval in days' });
    const chestRest = within(dialog).getByRole('spinbutton', { name: 'Chest preferred rest days' });
    await user.clear(chestInterval);
    await user.type(chestInterval, '1');
    await user.clear(chestRest);
    await user.type(chestRest, '1');
    await user.click(within(dialog).getByRole('button', { name: 'Save settings' }));
    expect(within(dialog).getByRole('alert').textContent).toMatch(/interval must exceed/i);
    expect(onChange).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(opener);
  });

  it('uses the same staged settings editor from the gear', async () => {
    const user = userEvent.setup();
    const { changes } = renderStatefulStrength();
    const opener = document.querySelector('.strength-map-card .settings-icon-button') as HTMLElement;

    await user.click(opener);
    let dialog = screen.getByRole('dialog', { name: 'Strength settings' });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Close Strength settings' }));
    expect(within(dialog).getByLabelText('Effective date')).toHaveProperty('value', '2026-10-22');
    expect(within(dialog).getByLabelText('Weight unit')).toHaveProperty('value', 'lb');
    expect(within(dialog).getByRole('heading', { name: 'Muscle groups' })).toBeTruthy();
    expect(within(dialog).getByText('Rest days guide recommendations. You can log anytime.')).toBeTruthy();
    expect(within(dialog).queryByText(/Tracking started/)).toBeNull();
    const chestRow = getSettingsMuscleSummary(dialog, 'Chest').closest('details')!;
    expect(chestRow.open).toBe(false);
    expect(getSettingsMuscleSummary(dialog, 'Chest').tagName).toBe('SUMMARY');
    expect(changes).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(changes).toHaveLength(0);

    await user.click(opener);
    dialog = screen.getByRole('dialog', { name: 'Strength settings' });
    fireEvent.change(within(dialog).getByLabelText('Effective date'), { target: { value: '2026-10-01' } });
    await user.selectOptions(within(dialog).getByLabelText('Weight unit'), 'kg');
    await user.click(within(dialog).getByRole('button', { name: 'Save settings' }));

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      trackingStartDate: '2026-10-01',
      settings: { weightUnit: 'kg' },
      scoringSettingsHistory: [expect.objectContaining({ effectiveDate: '2026-10-01' })]
    });
  });

  it('keeps muscle edits through collapse and reopen, reflects summaries, and saves the open row values', async () => {
    const user = userEvent.setup();
    const { changes } = renderStatefulStrength();
    const opener = document.querySelector('.strength-map-card .settings-icon-button') as HTMLElement;
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Strength settings' });
    const chestSummary = getSettingsMuscleSummary(dialog, 'Chest');
    const chestRow = chestSummary.closest('details')!;

    expect(chestRow.open).toBe(false);
    expect(chestSummary.tagName).toBe('SUMMARY');
    expect(chestSummary.textContent).toContain('Every 7 days');
    expect(chestSummary.textContent).toContain('1 rest day');
    await user.click(chestSummary);

    const interval = within(chestRow).getByRole('spinbutton', { name: 'Chest training interval in days' });
    const restDays = within(chestRow).getByRole('spinbutton', { name: 'Chest preferred rest days' });
    const betweenSets = within(chestRow).getByRole('combobox', { name: 'Chest rest between sets' });
    await user.clear(interval);
    await user.type(interval, '10');
    await user.clear(restDays);
    await user.type(restDays, '2');
    await user.selectOptions(betweenSets, 'custom');
    const customRest = within(chestRow).getByRole('spinbutton', { name: 'Chest custom rest between sets in seconds' });
    await user.clear(customRest);
    await user.type(customRest, '240');

    await user.click(chestSummary);
    expect(chestRow.open).toBe(false);
    expect(chestSummary.textContent).toContain('Every 10 days');
    expect(chestSummary.textContent).toContain('2 rest days');
    await user.click(chestSummary);
    expect(within(chestRow).getByRole('spinbutton', { name: 'Chest training interval in days' })).toHaveProperty('value', '10');
    expect(within(chestRow).getByRole('spinbutton', { name: 'Chest preferred rest days' })).toHaveProperty('value', '2');
    expect(within(chestRow).getByRole('combobox', { name: 'Chest rest between sets' })).toHaveProperty('value', 'custom');
    expect(within(chestRow).getByRole('spinbutton', { name: 'Chest custom rest between sets in seconds' })).toHaveProperty('value', '240');

    await user.click(within(dialog).getByRole('button', { name: 'Save settings' }));
    expect(changes).toHaveLength(1);
    expect(changes[0]?.settings).toMatchObject({
      muscleIntervals: { chest: 10 },
      preferredRestDays: { chest: 2 },
      betweenSetRestSeconds: { chest: 240 }
    });

    await user.click(opener);
    const cancelledDialog = screen.getByRole('dialog', { name: 'Strength settings' });
    expect(within(cancelledDialog).getByText('Tracking started Oct 22, 2026.')).toBeTruthy();
    await user.selectOptions(within(cancelledDialog).getByLabelText('Weight unit'), 'kg');
    await user.click(within(cancelledDialog).getByRole('button', { name: 'Cancel' }));
    expect(changes).toHaveLength(1);
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

    await user.click(document.querySelector('.strength-map-card .settings-icon-button') as HTMLElement);
    const dialog = screen.getByRole('dialog', { name: 'Strength settings' });
    await user.click(getSettingsMuscleSummary(dialog, 'Chest'));
    await user.click(getSettingsMuscleSummary(dialog, 'Abs'));
    const chestRest = within(dialog).getByRole('combobox', { name: 'Chest rest between sets' });
    const absRest = within(dialog).getByRole('combobox', { name: 'Abs rest between sets' });
    expect(chestRest).toHaveProperty('value', '180');
    expect(absRest).toHaveProperty('value', '120');

    await user.selectOptions(chestRest, 'custom');
    const customChest = within(dialog).getByRole('spinbutton', { name: 'Chest custom rest between sets in seconds' });
    await user.clear(customChest);
    await user.type(customChest, '240');
    await user.selectOptions(absRest, '90');
    await user.click(within(dialog).getByRole('button', { name: 'Save settings' }));

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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    await user.click(screen.getByRole('button', { name: 'Create workout' }));
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
    const picker = await screen.findByRole('dialog', { name: /Log workout for/ });
    expect(within(picker).getByRole('button', { name: 'Custom workout' })).toBeTruthy();
    await user.click(within(picker).getByRole('button', { name: 'Custom workout' }));
    const dialog = await screen.findByRole('dialog', { name: 'Log workout' });
    expect(within(dialog).getByLabelText('Workout date')).toHaveProperty('value', '2026-10-22');
    expect(within(dialog).getByLabelText('Saved workout (optional)')).toHaveProperty('value', '');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);
  });

  it('limits the linked Rhythm workout picker to three current recommendations and opens full-screen logging', async () => {
    const data = createStrengthData();
    data.savedWorkouts = [
      { id: 'rhythm-pick-1', name: 'Chest plan', muscleIds: ['chest'], sharedWith: [] },
      { id: 'rhythm-pick-2', name: 'Back plan', muscleIds: ['back'], sharedWith: [] },
      { id: 'rhythm-pick-3', name: 'Leg plan', muscleIds: ['quads'], sharedWith: [] },
      { id: 'rhythm-pick-4', name: 'Extra plan', muscleIds: ['calves'], sharedWith: [] }
    ];
    const user = userEvent.setup();
    const { onChange } = renderStrength(data, 'recommended', null, undefined, true);

    const picker = await screen.findByRole('dialog', { name: /Log workout for/ });
    expect(picker.classList.contains('dialog--phone-fullscreen')).toBe(true);
    const recommendations = picker.querySelectorAll<HTMLElement>('.strength-rhythm-workout-choice');
    expect(recommendations).toHaveLength(3);
    expect(within(picker).getByRole('button', { name: 'Custom workout' })).toBeTruthy();
    await user.click(within(recommendations[0]!).getByRole('button', { name: /^Log / }));

    const workoutDialog = await screen.findByRole('dialog', { name: 'Log workout' });
    expect(workoutDialog.classList.contains('dialog--phone-fullscreen')).toBe(true);
    await user.click(within(workoutDialog).getByRole('button', { name: 'Cancel' }));
    expect(onChange).not.toHaveBeenCalled();
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
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
    expect(screen.getByRole('tab', { name: 'Saved' }).getAttribute('aria-selected')).toBe('false');
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
    expect(screen.getByText('Your body, at a glance')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Resume workout' })).toBeTruthy();
    expect(screen.queryByRole('tablist', { name: 'Strength views' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Training' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Your body, at a glance' })).toBeTruthy();
    const list = screen.getByRole('tablist', { name: 'Strength workouts' });
    const recommended = within(list).getByRole('tab', { name: 'Recommended' });
    const saved = within(list).getByRole('tab', { name: 'Saved' });
    const history = within(list).getByRole('tab', { name: 'History' });
    expect(recommended.getAttribute('aria-selected')).toBe('true');
    expect(recommended.getAttribute('aria-controls')).toBe('strength-workout-panel-recommended');
    expect(document.getElementById('strength-workout-panel-recommended')?.getAttribute('aria-labelledby'))
      .toBe('strength-workout-tab-recommended');
    expect(saved.getAttribute('aria-selected')).toBe('false');
    expect(screen.getByRole('tabpanel', { name: 'Recommended' }).hidden).toBe(false);

    recommended.focus();
    await user.keyboard('{ArrowLeft}');
    expect(history.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(history);
    await user.keyboard('{Home}');
    expect(recommended.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{End}');
    expect(history.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{ArrowRight}');
    expect(recommended.getAttribute('aria-selected')).toBe('true');
    expect(recommended.getAttribute('tabindex')).toBe('0');
    await user.click(saved);
    expect(saved.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('button', { name: 'Resume workout' })).toBeTruthy();
    expect(data.guidedSessionDraft).toEqual(draft.session);
    expect(saved.getAttribute('tabindex')).toBe('0');
    expect(history.getAttribute('tabindex')).toBe('-1');
    expect(screen.getByRole('tabpanel', { name: 'Saved' }).getAttribute('aria-labelledby')).toBe('strength-workout-tab-saved');

    await user.click(history);

    const panel = screen.getByRole('tabpanel', { name: 'History' });
    expect((panel as HTMLElement).hidden).toBe(false);
    expect(panel.querySelector(':scope > .card')).toBeNull();
    expect(within(panel).getByText('Review your past workouts and the muscle groups you trained.')).toBeTruthy();
    expect(within(panel).queryByText(/^\d+ workouts? logged$/)).toBeNull();
    expect(within(panel).getByText('No workouts logged yet.')).toBeTruthy();
    expect(within(list).getByRole('tab', { name: 'History' })).toBeTruthy();
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    await user.click(screen.getByRole('tab', { name: 'History' }));
    const panel = screen.getByRole('tabpanel', { name: 'History' });
    expect(within(panel).getByText('Review your past workouts and the muscle groups you trained.')).toBeTruthy();
    expect(within(panel).queryByText(/^\d+ workouts? logged$/)).toBeNull();
    expect(panel.querySelector(':scope > .card')).toBeNull();
    expect(within(panel).getAllByRole('button', { name: /^View / })).toHaveLength(10);
    expect(within(panel).getByRole('button', { name: /View An exceptionally long workout name/ })
      .closest('li')?.classList.contains('strength-history-card')).toBe(true);
    const januaryHeading = within(panel).getByRole('heading', { name: 'January 2026' });
    expect(within(panel).getAllByRole('heading', { name: 'January 2026' })).toHaveLength(1);
    expect(januaryHeading.nextElementSibling?.tagName).toBe('OL');
    expect((januaryHeading.nextElementSibling as HTMLElement).querySelector('button')?.getAttribute('aria-label'))
      .toMatch(/^View /);
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
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
    expect(document.querySelector('.strength-history-page [role="status"]')?.textContent)
      .toBe('Workout updated. It is outside the currently shown recent entries.');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'History' }));
  });

  it('requires delete confirmation, restores focus on cancel, and focuses the History tab after deleting the only entry', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    data.workouts = [{ id: 'only-log', date: '2026-10-22', muscleIds: ['chest'], notes: 'Keep history accurate' }];
    const { changes } = renderStatefulStrength(data);
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    await user.click(screen.getByRole('tab', { name: 'History' }));
    expect(screen.getByText('Review your past workouts and the muscle groups you trained.')).toBeTruthy();
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
    expect(screen.getByText('Review your past workouts and the muscle groups you trained.')).toBeTruthy();
    expect(screen.getByText('No workouts logged yet.')).toBeTruthy();
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
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

    await user.click(screen.getByRole('tab', { name: 'Saved' }));
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    const createWorkout = screen.getByRole('button', { name: 'Create workout' });
    await user.click(createWorkout);
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
    expect(document.activeElement).toBe(within(editor).getByRole('button', { name: 'Choose people, Avery Brooks and Jordan Bell' }));
    expect(within(editor).getAllByRole('img').map(badge => badge.getAttribute('aria-label')))
      .toEqual(['Avery Brooks', 'Jordan Bell']);
    expect(editor.scrollTop).toBe(137);
    expect(onChange).not.toHaveBeenCalled();

    await user.click(within(editor).getByRole('button', { name: 'Save workout' }));
    expect(onChange).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(createWorkout);
    expect(onChange.mock.calls[0]?.[0].savedWorkouts[0]).toMatchObject({
      name: 'My workout',
      muscleIds: ['chest'],
      sharedWith: ['sample-person-avery', 'sample-person-jordan']
    });

    cleanup();
    const savedData = onChange.mock.calls[0]![0];
    const reloaded = renderStrength(savedData);
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    expect(screen.getByRole('img', { name: 'Avery Brooks' })).toBeTruthy();
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    const createWorkout = screen.getByRole('button', { name: 'Create workout' });
    await user.click(createWorkout);
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
    expect(document.activeElement).toBe(createWorkout);
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    await user.click(screen.getByRole('button', { name: 'Create workout' }));
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    const createWorkout = screen.getByRole('button', { name: 'Create workout' });
    await user.click(createWorkout);
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
    expect(document.activeElement).toBe(createWorkout);
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
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

  it('adds and resumes extra sets after the planned final set without changing the saved workout', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    const template: StrengthSavedWorkout = {
      id: 'extra-set-resume-template',
      name: 'Extra set resume',
      muscleIds: ['chest'],
      sharedWith: [],
      exercises: [{
        id: 'extra-set-resume-exercise',
        name: 'Bench Press',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        loadMeaning: 'total',
        restDurationSeconds: 60,
        sets: [{
          id: 'extra-set-resume-set',
          targetReps: 8,
          targetLoad: { kind: 'external', meaning: 'total', value: 100, unit: 'lb' }
        }]
      }]
    };
    data.savedWorkouts = [template];
    let { changes } = renderStatefulStrength(data);
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    await user.click(screen.getByRole('button', { name: 'Start workout' }));
    let dialog = screen.getByRole('dialog', { name: 'Extra set resume' });
    await user.click(within(dialog).getByRole('button', { name: 'Log set 1' }));
    expect(within(dialog).getByRole('button', { name: 'Add set' })).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Add set' }));
    expect(within(dialog).getByRole('button', { name: 'Set 2, pending' })).toBeTruthy();
    expect(changes.at(-1)?.savedWorkouts[0]?.exercises?.[0]?.sets).toHaveLength(1);

    const resumedData = changes.at(-1)!;
    cleanup();
    ({ changes } = renderStatefulStrength(resumedData));
    await user.click(screen.getByRole('button', { name: 'Resume workout' }));
    dialog = screen.getByRole('dialog', { name: 'Extra set resume' });
    expect(within(dialog).getByRole('button', { name: 'Set 2, pending' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Add set' })).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Log set 2' }));
    await user.click(within(dialog).getByRole('button', { name: 'Finish & review' }));
    await user.click(within(dialog).getByRole('button', { name: 'Finish & save' }));

    const finished = changes.at(-1)!;
    expect(finished.workouts[0]?.exercises?.[0]?.sets.map(item => item.status))
      .toEqual(['performed', 'performed']);
    expect(finished.savedWorkouts[0]?.exercises?.[0]?.sets).toEqual(template.exercises?.[0]?.sets);
  });

  it('prefers the matching prior-workout set over a newer current-workout set and converts its unit', async () => {
    const data = createStrengthData();
    data.settings.weightUnit = 'kg';
    const template: StrengthSavedWorkout = {
      id: 'prefill-priority-template',
      name: 'Prefill priority',
      muscleIds: ['chest'],
      sharedWith: [],
      exercises: [{
        id: 'prefill-priority-exercise',
        name: 'Bench Press',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        loadMeaning: 'total',
        restDurationSeconds: 60,
        sets: [
          { id: 'prefill-priority-set-1', targetReps: 8, targetLoad: { kind: 'external', meaning: 'total', value: 100, unit: 'lb' } },
          { id: 'prefill-priority-set-2', targetReps: 8, targetLoad: { kind: 'external', meaning: 'total', value: 110, unit: 'lb' } }
        ]
      }]
    };
    const created = createStrengthGuidedSession(template, {
      id: 'prefill-priority-session',
      date: '2026-10-22',
      startedAt: '2026-10-22T09:00:00.000Z',
      timeZone: 'UTC'
    });
    expect(created.valid).toBe(true);
    if (!created.valid) return;
    const performed = confirmStrengthSessionSet(
      created.session,
      'prefill-priority-exercise',
      'prefill-priority-set-2',
      8,
      '2026-10-22T09:15:00.000Z',
      { kind: 'external', meaning: 'total', value: 150, unit: 'lb' }
    );
    expect(performed.valid).toBe(true);
    if (!performed.valid) return;
    const selected = moveStrengthSessionToSet(performed.session, 0, 'prefill-priority-set-1');
    expect(selected.valid).toBe(true);
    if (!selected.valid) return;

    data.savedWorkouts = [template];
    data.guidedSessionDraft = selected.session;
    data.workouts = [{
      id: 'prefill-priority-previous-workout',
      date: '2026-10-20',
      startedAt: '2026-10-20T09:00:00.000Z',
      finishedAt: '2026-10-20T09:30:00.000Z',
      timeZone: 'UTC',
      savedWorkoutId: template.id,
      muscleIds: ['chest'],
      exercises: [{
        id: 'prefill-priority-exercise',
        name: 'Bench Press',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        loadMeaning: 'total',
        restDurationSeconds: 60,
        sets: [
          {
            id: 'prefill-priority-previous-set-1',
            targetReps: 8,
            status: 'performed',
            actualReps: 8,
            actualLoad: { kind: 'external', meaning: 'total', value: 120, unit: 'lb' },
            confirmedAt: '2026-10-20T09:10:00.000Z'
          },
          {
            id: 'prefill-priority-previous-set-2',
            targetReps: 8,
            status: 'performed',
            actualReps: 8,
            actualLoad: { kind: 'external', meaning: 'total', value: 130, unit: 'lb' },
            confirmedAt: '2026-10-20T09:20:00.000Z'
          }
        ]
      }]
    }];

    renderStatefulStrength(data);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Resume workout' }));
    const dialog = screen.getByRole('dialog', { name: 'Prefill priority' });
    expect(Number((within(dialog).getByRole('spinbutton', { name: 'Weight (kg)' }) as HTMLInputElement).value))
      .toBeCloseTo(54.4310844, 6);
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
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
    await user.click(within(dialog).getByRole('button', { name: 'Rest timer settings' }));
    const options = screen.getByRole('dialog', { name: 'Rest settings' });
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
    await user.click(within(dialog).getByRole('button', { name: 'Rest timer settings' }));
    const options = screen.getByRole('dialog', { name: 'Rest settings' });
    await user.clear(within(options).getByRole('spinbutton', { name: 'Minutes' }));
    await user.type(within(options).getByRole('spinbutton', { name: 'Minutes' }), '2');
    await user.click(within(options).getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('alert').textContent).toContain(
      'The custom rest duration was not applied because session persistence failed: storage conflict'
    );
    expect(screen.getByRole('alert').textContent).not.toContain('session rest changed');
    expect(within(dialog).getByRole('timer', { name: 'Rest countdown' }).textContent).toBe('03:00');
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
    await user.click(within(dialog).getByRole('button', { name: 'Rest timer settings' }));
    const options = screen.getByRole('dialog', { name: 'Rest settings' });
    await user.clear(within(options).getByRole('spinbutton', { name: 'Minutes' }));
    await user.type(within(options).getByRole('spinbutton', { name: 'Minutes' }), '2');
    await user.click(within(options).getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('alert').textContent).toContain('The custom rest duration could not be saved');
    expect(within(dialog).getByRole('timer', { name: 'Rest countdown' }).textContent).toBe('03:00');
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
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
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Saved' }));
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    await user.click(screen.getByRole('button', { name: 'Start workout' }));
    const dialog = screen.getByRole('dialog', { name: 'Rest defaults' });
    expect(dialog.classList.contains('dialog--phone-fullscreen')).toBe(true);
    const timer = within(dialog).getByRole('region', { name: 'Rest timer' });
    expect(within(timer).getByRole('timer', { name: 'Rest countdown' }).textContent).toBe('03:00');
    expect(within(timer).getByRole('button', { name: 'Start rest timer' })).toBeTruthy();
    expect(within(timer).queryByRole('button', { name: 'Start' })).toBeNull();
    const settingsButton = within(timer).getByRole('button', { name: 'Rest timer settings' });
    await user.click(settingsButton);
    const picker = screen.getByRole('dialog', { name: 'Rest settings' });
    expect(within(picker).getByRole('checkbox', { name: 'Auto-start rest' })).toHaveProperty('checked', true);
    expect(within(picker).getByRole('button', { name: '1:00' })).toBeTruthy();
    expect(within(picker).getByRole('button', { name: '1:30' })).toBeTruthy();
    expect(within(picker).getByRole('button', { name: '2:00' })).toBeTruthy();
    expect(within(picker).getByRole('button', { name: '2:30' })).toBeTruthy();
    expect(within(picker).getByRole('button', { name: '3:00' })).toBeTruthy();
    expect(settingsButton)
      .toHaveProperty('ariaExpanded', 'true');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Rest settings' })).toBeNull();
    expect(document.activeElement).toBe(settingsButton);
    await user.click(settingsButton);
    const restSettings = screen.getByRole('dialog', { name: 'Rest settings' });
    await user.click(within(restSettings).getByRole('button', { name: '2:30' }));
    expect(within(timer).getByRole('timer', { name: 'Rest countdown' }).textContent).toBe('03:00');
    expect(screen.getByRole('dialog', { name: 'Rest settings' })).toBeTruthy();
    await user.click(within(restSettings).getByRole('button', { name: 'Apply' }));
    expect(within(timer).getByRole('timer', { name: 'Rest countdown' }).textContent).toBe('02:30');
    expect(within(timer).queryByText('Paused · Tap to resume')).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Rest settings' })).toBeNull();
    expect(within(timer).getByRole('timer', { name: 'Rest countdown' }).textContent).toBe('02:30');
    expect(document.activeElement).toBe(settingsButton);
    await user.click(settingsButton);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Rest settings' })).toBeNull();
    expect(document.activeElement).toBe(settingsButton);

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

    const runningSession = changes.at(-1)?.guidedSessionDraft!;
    const runningTimer = runningSession.restTimer;
    await user.click(settingsButton);
    expect(screen.getByRole('dialog', { name: 'Rest settings' })).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Rest settings' })).toBeNull();
    expect(document.activeElement).toBe(settingsButton);
    expect(changes.at(-1)?.guidedSessionDraft?.restTimer).toEqual(runningTimer);
    expect(changes.at(-1)?.guidedSessionDraft?.currentExerciseIndex).toBe(runningSession.currentExerciseIndex);
    expect(changes.at(-1)?.guidedSessionDraft?.currentSetId).toBe(runningSession.currentSetId);
    expect(changes.at(-1)?.guidedSessionDraft?.exercises).toEqual(runningSession.exercises);

    const activeDeadline = changes.at(-1)?.guidedSessionDraft?.restTimer;
    await user.click(within(dialog).getByRole('button', { name: '2 of 2' }));
    await user.click(screen.getByRole('menuitem', { name: /Bench Press/ }));
    expect(changes.at(-1)?.guidedSessionDraft?.restTimer).toEqual(activeDeadline);
  });

  it('keeps rest settings as a cancelable draft and preserves a running countdown deadline on Apply', async () => {
    const user = userEvent.setup();
    const data = createStrengthData();
    data.savedWorkouts = [{
      id: 'rest-settings-draft-template',
      name: 'Rest settings draft',
      muscleIds: ['chest'],
      sharedWith: [],
      exercises: [{
        id: 'rest-settings-draft-exercise',
        name: 'Bench Press',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        loadMeaning: 'total',
        restDurationSeconds: 180,
        sets: [{
          id: 'rest-settings-draft-set',
          targetReps: 8,
          targetLoad: { kind: 'external', meaning: 'total', value: 100, unit: 'lb' }
        }]
      }]
    }];
    const { changes } = renderStatefulStrength(data);
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    await user.click(screen.getByRole('button', { name: 'Start workout' }));
    const workout = screen.getByRole('dialog', { name: 'Rest settings draft' });
    const timer = within(workout).getByRole('region', { name: 'Rest timer' });
    await user.click(within(workout).getByRole('button', { name: 'Log set 1' }));
    if (changes.at(-1)?.guidedSessionDraft?.restTimer?.status !== 'running') {
      await user.click(within(timer).getByRole('button', { name: 'Start rest timer' }));
    }
    const before = changes.at(-1)?.guidedSessionDraft;
    expect(before?.restTimer?.status).toBe('running');
    if (before?.restTimer?.status !== 'running') return;
    const priorAutoStart = before.autoStartRest === true;
    const priorExercises = before.exercises;
    const gear = within(timer).getByRole('button', { name: 'Rest timer settings' });
    await user.click(gear);
    let settings = screen.getByRole('dialog', { name: 'Rest settings' });
    expect(settings.tagName).toBe('DIALOG');
    expect(within(settings).getByRole('button', { name: '3:00' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(within(settings).getByRole('button', { name: '2:30' }));
    const autoStart = within(settings).getByRole('checkbox', { name: 'Auto-start rest' });
    await user.click(autoStart);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Rest settings' })).toBeNull();
    expect(document.activeElement).toBe(gear);
    expect(changes.at(-1)?.guidedSessionDraft?.restTimer).toEqual(before.restTimer);
    expect(changes.at(-1)?.guidedSessionDraft?.autoStartRest).toBe(priorAutoStart);

    await user.click(gear);
    settings = screen.getByRole('dialog', { name: 'Rest settings' });
    expect(within(settings).getByRole('button', { name: '3:00' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(settings).getByRole('checkbox', { name: 'Auto-start rest' }))
      .toHaveProperty('checked', priorAutoStart);
    await user.click(within(settings).getByRole('button', { name: '2:30' }));
    await user.click(within(settings).getByRole('checkbox', { name: 'Auto-start rest' }));
    await user.click(within(settings).getByRole('button', { name: 'Apply' }));
    const applied = changes.at(-1)?.guidedSessionDraft;
    expect(applied?.restTimer).toEqual({
      status: 'running',
      durationSeconds: 150,
      deadlineAt: before.restTimer.deadlineAt
    });
    expect(applied?.autoStartRest).toBe(!priorAutoStart);
    expect(applied?.exercises).toEqual(priorExercises);
    expect(document.activeElement).toBe(gear);

    await user.click(gear);
    settings = screen.getByRole('dialog', { name: 'Rest settings' });
    fireEvent.click(settings);
    expect(screen.queryByRole('dialog', { name: 'Rest settings' })).toBeNull();
    expect(changes.at(-1)?.guidedSessionDraft?.restTimer).toEqual(applied?.restTimer);
    expect(document.activeElement).toBe(gear);
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    await user.click(screen.getByRole('button', { name: 'Start workout' }));
    const dialog = screen.getByRole('dialog', { name: 'Sound toggles' });
    const timer = within(dialog).getByRole('region', { name: 'Rest timer' });
    await user.click(within(timer).getByRole('button', { name: 'Rest timer settings' }));
    const options = screen.getByRole('dialog', { name: 'Rest settings' });
    const sound = within(options).getByRole('checkbox', { name: 'Sound' });
    await user.click(sound);
    expect(within(timer).queryByText('Rest timer sound is on.')).toBeNull();
    expect(sound).toHaveProperty('checked', true);
    await user.click(within(options).getByRole('button', { name: 'Apply' }));
    expect(within(timer).getByRole('status').textContent).toBe('Rest timer sound is on.');
    expect(within(timer).queryByText('Rest timer sound is on.')?.classList.contains('visually-hidden')).toBe(true);
    await user.click(within(timer).getByRole('button', { name: 'Rest timer settings' }));
    const reopenedOptions = screen.getByRole('dialog', { name: 'Rest settings' });
    const reopenedSound = within(reopenedOptions).getByRole('checkbox', { name: 'Sound' });
    await user.click(reopenedSound);
    expect(within(timer).getByRole('status').textContent).toBe('Rest timer sound is on.');
    await user.click(within(reopenedOptions).getByRole('button', { name: 'Apply' }));
    expect(within(timer).queryByText('Rest timer sound is on.')).toBeNull();
    expect(reopenedSound).toHaveProperty('checked', false);
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
    await click(screen.getByRole('tab', { name: 'Saved' }));
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
    await click(screen.getByRole('tab', { name: 'Saved' }));
    await click(screen.getByRole('button', { name: 'Start workout' }));
    const dialog = screen.getByRole('dialog', { name: 'Sound rest' });
    const timer = within(dialog).getByRole('region', { name: 'Rest timer' });
    await click(within(timer).getByRole('button', { name: 'Rest timer settings' }));
    const options = screen.getByRole('dialog', { name: 'Rest settings' });
    const sound = within(options).getByRole('checkbox', { name: 'Sound' });
    expect(sound).toHaveProperty('checked', false);
    await click(sound);
    expect(within(timer).queryByText('Rest timer sound is on.')).toBeNull();
    expect(within(options).getByRole('heading', { name: 'Custom duration' })).toBeTruthy();
    fireEvent.change(within(options).getByRole('spinbutton', { name: 'Minutes' }), { target: { value: '0' } });
    fireEvent.change(within(options).getByRole('spinbutton', { name: 'Seconds' }), { target: { value: '1' } });
    await click(within(options).getByRole('button', { name: 'Apply' }));
    expect(changes.at(-1)?.savedWorkouts[0]?.exercises?.[0]).toMatchObject({
      restDurationSeconds: 1,
      restDurationOverridden: true
    });
    expect(changes.at(-1)?.guidedSessionDraft?.restTimer).toEqual({ status: 'idle', durationSeconds: 1 });
    expect(screen.queryByRole('dialog', { name: 'Rest settings' })).toBeNull();
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

    await click(within(timer).getByRole('button', { name: 'Rest timer settings' }));
    const resetOptions = screen.getByRole('dialog', { name: 'Rest settings' });
    await click(within(resetOptions).getByRole('button', { name: 'Reset rest timer' }));
    await click(within(timer).getByRole('button', { name: 'Start rest timer' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(oscillators).toHaveLength(8);
    expect(within(timer).getByRole('button', { name: 'Stop rest alarm' })).toBeTruthy();
    await click(within(timer).getByRole('button', { name: 'Rest timer settings' }));
    const soundSettings = screen.getByRole('dialog', { name: 'Rest settings' });
    await click(within(soundSettings).getByRole('checkbox', { name: 'Sound' }));
    await click(within(soundSettings).getByRole('button', { name: 'Apply' }));
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
    await click(screen.getByRole('tab', { name: 'Saved' }));
    await click(screen.getByRole('button', { name: 'Start workout' }));
    const finishDialog = screen.getByRole('dialog', { name: 'Sound rest' });
    const finishTimer = within(finishDialog).getByRole('region', { name: 'Rest timer' });
    await click(within(finishTimer).getByRole('button', { name: 'Rest timer settings' }));
    const finishSettings = screen.getByRole('dialog', { name: 'Rest settings' });
    await click(within(finishSettings).getByRole('checkbox', { name: 'Sound' }));
    await click(within(finishSettings).getByRole('button', { name: 'Apply' }));
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
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    await user.click(screen.getByRole('button', { name: 'Start workout' }));
    const dialog = screen.getByRole('dialog', { name: 'Suspended audio' });
    const timer = within(dialog).getByRole('region', { name: 'Rest timer' });
    await user.click(within(timer).getByRole('button', { name: 'Rest timer settings' }));
    const soundOptions = screen.getByRole('dialog', { name: 'Rest settings' });
    await user.click(within(soundOptions).getByRole('checkbox', { name: 'Sound' }));
    expect(within(timer).queryByText(
      'Audio is unavailable or suspended; the visual rest alert remains available.'
    )).toBeNull();
    await user.click(within(soundOptions).getByRole('button', { name: 'Apply' }));
    expect(await within(timer).findByText(
      'Audio is unavailable or suspended; the visual rest alert remains available.'
    )).toBeTruthy();
    await user.click(within(timer).getByRole('button', { name: 'Rest timer settings' }));
    expect(within(screen.getByRole('dialog', { name: 'Rest settings' }))
      .getByRole('checkbox', { name: 'Sound' })).toHaveProperty('checked', false);
  });
});
