import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlexibilityView } from '../src/components/FlexibilityView.tsx';
import { createFlexibilityData, flexibilityRoutineSuggestions } from '../src/domain/flexibility.ts';
import type { FlexibilityData, SavedFlexibilityRoutine } from '../src/domain/flexibility.ts';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function StatefulFlexibility({ initialData = createFlexibilityData() }: { initialData?: FlexibilityData }) {
  const [data, setData] = useState<FlexibilityData>(initialData);
  return (
    <>
      <FlexibilityView
        data={data}
        today="2026-10-23"
        onChange={next => {
          setData(next);
          return null;
        }}
      />
      <output data-testid="flexibility-state" hidden>{JSON.stringify(data)}</output>
    </>
  );
}

describe('Flexibility foundation presentation', () => {
  it('exposes all ten regions on the shared front/back map with keyboard selection', async () => {
    const user = userEvent.setup();
    const { container } = render(<StatefulFlexibility />);
    const frontMap = screen.getByRole('group', { name: 'Front Stretch schedule stretching map' });
    const frontList = screen.getByRole('group', { name: 'Stretch schedule status' });
    const frontRegionIds = [...frontMap.querySelectorAll<SVGPathElement>('[data-region]')]
      .map(region => region.dataset.region);
    expect(frontRegionIds).toEqual(['neck', 'shoulders', 'chest', 'abs', 'hip-flexors', 'quads']);
    expect(container.querySelector('.flexibility-map-card')?.classList.contains('strength-card')).toBe(true);
    expect(container.querySelector('.flexibility-map-card')?.querySelector('.strength-card-heading')).toBeTruthy();
    expect(screen.getByText('Choose a region to see its stretch status.')).toBeTruthy();
    expect(container.querySelector('.flexibility-map-layout')).toBeNull();
    expect([...frontList.querySelectorAll<HTMLButtonElement>('.flexibility-region')]
      .map(row => row.querySelector('strong')?.textContent))
      .toEqual(['Neck', 'Shoulders', 'Chest', 'Abs', 'Hip flexors', 'Quads']);
    expect(frontList.querySelector('[aria-label^="Calves"]')).toBeNull();
    expect(frontList.querySelector('[aria-label^="Back"]')).toBeNull();
    const chestRow = frontList.querySelector<HTMLButtonElement>('[aria-label^="Chest"]')!;
    expect(chestRow.getAttribute('aria-label')).toContain('Consistency score: unavailable');
    expect(within(chestRow).getByRole('img', { name: 'Stretch status: Not logged yet.' })).toBeTruthy();
    expect(within(chestRow).getByText('No log yet')).toBeTruthy();
    expect(within(chestRow).getByText('—')).toBeTruthy();
    expect(chestRow.querySelector('.flexibility-region__score')).toBeNull();
    const layout = container.querySelector('.strength-map-layout');
    expect(layout?.firstElementChild?.classList.contains('strength-map-wrap')).toBe(true);
    expect(layout?.lastElementChild).toBe(frontList);
    expect(frontMap.querySelector('[data-region="back"]')).toBeNull();
    expect(frontMap.querySelector('[data-region="calves"]')).toBeNull();
    expect(frontMap.querySelector('[data-region="chest"]')?.getAttribute('d'))
      .toContain('M81 89Q96 80');
    expect(frontMap.querySelector('[data-region="abs"]')?.getAttribute('d'))
      .toContain('M89 139L107 137L107 190');
    expect(frontMap.querySelector('[data-region="abs"]')?.getAttribute('fill'))
      .toBe('var(--score-neutral)');
    expect(frontList.querySelector('[aria-label^="Abs"]')?.getAttribute('aria-label'))
      .toContain('Consistency score: unavailable');
    expect(frontMap.querySelector('[data-region="hip-flexors"]')?.getAttribute('d'))
      .toContain('M75 188Q89 184');
    expect(frontMap.querySelector('[data-region="quads"]')?.getAttribute('d'))
      .toContain('M73 206L105 205');
    const hipFlexor = frontMap.querySelector<SVGPathElement>('[data-region="hip-flexors"]')!;
    fireEvent.keyDown(hipFlexor, { key: 'Enter' });
    const hipFlexorRow = [...container.querySelectorAll<HTMLElement>('.flexibility-region')]
      .find(row => row.textContent?.includes('Hip flexors'))!;
    expect(hipFlexorRow.getAttribute('aria-pressed')).toBe('true');

    await user.click(screen.getByRole('button', { name: 'Back' }));
    const backMap = screen.getByRole('group', { name: 'Back Stretch schedule stretching map' });
    const backList = screen.getByRole('group', { name: 'Stretch schedule status' });
    expect(container.querySelector('.flexibility-region[aria-pressed="true"]')?.textContent)
      .toContain('Neck');
    const backRegionIds = [...backMap.querySelectorAll<SVGPathElement>('[data-region]')]
      .map(region => region.dataset.region);
    expect(backRegionIds).toEqual(['neck', 'shoulders', 'back', 'glutes', 'hamstrings', 'calves']);
    expect([...backList.querySelectorAll<HTMLButtonElement>('.flexibility-region')]
      .map(row => row.querySelector('strong')?.textContent))
      .toEqual(['Neck', 'Shoulders', 'Back', 'Glutes', 'Hamstrings', 'Calves']);
    expect(new Set([...frontRegionIds, ...backRegionIds]).size).toBe(10);
    expect(backMap.querySelector('[data-region="glutes"]')).toBeTruthy();
    expect(backMap.querySelector('[data-region="back"]')?.getAttribute('d'))
      .toContain('M81 89L107 81L107 178');
    expect(backMap.querySelector('[data-region="glutes"]')?.getAttribute('d'))
      .toContain('M72 180Q88 173');
    expect(backMap.querySelector('[data-region="glutes"]')?.getAttribute('fill'))
      .toBe('var(--score-neutral)');
    expect(backMap.querySelector('[data-region="hamstrings"]')?.getAttribute('d'))
      .toContain('M73 213L105 214');
    expect(backMap.querySelector('[data-region="calves"]')?.getAttribute('d'))
      .toContain('M79 284L100 279');
    expect(backMap.querySelector('[data-region="chest"]')).toBeNull();
    expect(backMap.querySelector('[data-region="abs"]')).toBeNull();
    expect(backMap.querySelector('[data-region="hip-flexors"]')).toBeNull();
    expect(backMap.querySelector('[data-region="quads"]')).toBeNull();
    await user.click(backMap.querySelector<SVGPathElement>('[data-region="shoulders"]')!);
    expect(backMap.querySelector('[data-region="shoulders"]')?.getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Front' }));
    expect(screen.getByRole('group', { name: 'Front Stretch schedule stretching map' })
      .querySelector('[data-region="shoulders"]')?.getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: /Calves\. Consistency score: unavailable/ }));
    await user.click(screen.getByRole('button', { name: 'Front' }));
    expect(container.querySelector('.flexibility-region[aria-pressed="true"]')?.textContent)
      .toContain('Neck');
    expect(container.querySelectorAll('.flexibility-region')).toHaveLength(6);
  });

  it('uses shared Health and card styling without adding unsupported measures', async () => {
    const user = userEvent.setup();
    const { container } = render(<StatefulFlexibility />);

    expect(container.querySelector('.flexibility-summary')?.classList.contains('rhythm-history-view__score-card')).toBe(true);
    expect(screen.getByRole('heading', { name: 'Flexibility Health' })).toBeTruthy();
    expect(screen.getByText('0 of 10 stretch regions tracked')).toBeTruthy();
    expect(container.querySelector('.flexibility-summary .health-score-measures')).toBeNull();
    expect(container.querySelector('.flexibility-map-card')?.compareDocumentPosition(
      container.querySelector('.flexibility-routine-collection')!
    )).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByRole('heading', { name: 'Stretch routines' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Recommended stretches' })).toBeTruthy();
    expect(screen.getByText('Save a routine to get recommendations, or log a custom stretch.')).toBeTruthy();
    expect(screen.queryByText('Suggested next stretch')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Daily Stretch' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Custom stretch' }));
    expect(screen.getByRole('dialog', { name: 'Log a stretch' })).toBeTruthy();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('tab', { name: 'History' }));
    expect(screen.getByText('No stretches logged yet.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Stretch history' })).toBeTruthy();
    expect(container.querySelector('#flexibility-panel-history .card')).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Recommended' }));
    await user.click(screen.getByRole('button', { name: 'Stretch interval settings' }));
    expect(screen.getByRole('dialog', { name: 'Stretch intervals' })).toBeTruthy();
  });

  it('uses Strength status squares for tracked, overdue, zero, and unavailable scores', async () => {
    const user = userEvent.setup();
    const data: FlexibilityData = {
      ...createFlexibilityData(),
      sessions: [
        { id: 'due-soon', date: '2026-10-20', regionIds: ['hamstrings'] },
        { id: 'zero-score', date: '2026-10-11', regionIds: ['glutes'] }
      ]
    };
    const { container } = render(
      <FlexibilityView data={data} today="2026-10-23" onChange={() => null} />
    );
    await user.click(screen.getByRole('button', { name: 'Back' }));

    const hamstrings = [...container.querySelectorAll<HTMLButtonElement>('.flexibility-region')]
      .find(row => row.getAttribute('aria-label')?.startsWith('Hamstrings'))!;
    const glutes = [...container.querySelectorAll<HTMLButtonElement>('.flexibility-region')]
      .find(row => row.getAttribute('aria-label')?.startsWith('Glutes'))!;
    const calves = [...container.querySelectorAll<HTMLButtonElement>('.flexibility-region')]
      .find(row => row.getAttribute('aria-label')?.startsWith('Calves'))!;
    expect(hamstrings.getAttribute('aria-label')).toContain('Consistency score: 90');
    expect(hamstrings.querySelector('.strength-muscle-row__status')?.className)
      .toContain('strength-muscle-row__status--due');
    expect(glutes.getAttribute('aria-label')).toContain('Consistency score: 0');
    expect(glutes.querySelector('.strength-muscle-row__status')?.className)
      .toContain('strength-muscle-row__status--overdue');
    expect(calves.querySelector('.strength-muscle-row__status')?.className)
      .toContain('strength-muscle-row__status--unavailable');
  });

  it('saves, resumes, edits, and deletes stretch records with history-derived scores', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { container } = render(<StatefulFlexibility />);
    await user.click(screen.getByRole('button', { name: 'Custom stretch' }));
    const dialog = screen.getByRole('dialog', { name: 'Log a stretch' });
    await user.click(within(dialog).getByRole('checkbox', { name: 'Hamstrings' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Notes (optional)' }), 'Easy session');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    await user.click(screen.getByRole('button', { name: 'Resume manual stretch log' }));
    const resumedDialog = screen.getByRole('dialog', { name: 'Log a stretch' });
    expect((within(resumedDialog).getByRole('textbox', { name: 'Notes (optional)' }) as HTMLTextAreaElement).value)
      .toBe('Easy session');
    await user.click(within(resumedDialog).getByRole('button', { name: 'Save stretch' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    const hamstrings = [...container.querySelectorAll<HTMLElement>('.flexibility-region')]
      .find(row => row.textContent?.includes('Hamstrings'))!;
    expect(hamstrings.getAttribute('aria-label')).toContain('Consistency score: 100');
    expect(within(hamstrings).getByRole('img', { name: 'Stretch status: Due in 2 days.' })).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'History' }));
    await user.click(screen.getByRole('button', { name: /^Edit$/ }));
    const editDialog = screen.getByRole('dialog', { name: 'Edit stretch session' });
    fireEvent.change(within(editDialog).getByLabelText('Date'), { target: { value: '2026-10-19' } });
    await user.click(within(editDialog).getByRole('button', { name: 'Save stretch' }));
    const updatedHamstrings = [...container.querySelectorAll<HTMLElement>('.flexibility-region')]
      .find(row => row.textContent?.includes('Hamstrings'))!;
    expect(updatedHamstrings.getAttribute('aria-label')).toContain('Consistency score: 80');
    expect(within(updatedHamstrings).getByRole('img', { name: 'Stretch status: 2 days overdue.' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /^Delete$/ }));
    expect(confirm).toHaveBeenCalledOnce();
    const deletedHamstrings = [...container.querySelectorAll<HTMLElement>('.flexibility-region')]
      .find(row => row.textContent?.includes('Hamstrings'))!;
    expect(deletedHamstrings.getAttribute('aria-label')).toContain('Consistency score: unavailable');
    expect(within(deletedHamstrings).getByText('No log yet')).toBeTruthy();
  });

  it('saves editable per-region stretch intervals', async () => {
    const user = userEvent.setup();
    render(<StatefulFlexibility />);
    await user.click(screen.getByRole('button', { name: 'Stretch interval settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Stretch intervals' });
    fireEvent.change(within(dialog).getByLabelText('Hamstrings interval in days'), {
      target: { value: '5' }
    });
    fireEvent.change(within(dialog).getByLabelText('Abs interval in days'), {
      target: { value: '4' }
    });
    await user.click(within(dialog).getByRole('button', { name: 'Save intervals' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('logs, edits, and deletes Abs through the shared stretch-session flow', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { container } = render(<StatefulFlexibility />);
    await user.click(screen.getByRole('button', { name: 'Custom stretch' }));
    let dialog = screen.getByRole('dialog', { name: 'Log a stretch' });
    await user.click(within(dialog).getByRole('checkbox', { name: 'Abs' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save stretch' }));

    expect(screen.getByText('1 of 10 stretch regions tracked')).toBeTruthy();
    const absRow = container.querySelector<HTMLButtonElement>('.flexibility-region[aria-label^="Abs"]');
    expect(absRow?.getAttribute('aria-label')).toContain('Consistency score: 100');

    await user.click(screen.getByRole('tab', { name: 'History' }));
    await user.click(screen.getByRole('button', { name: /^Edit$/ }));
    dialog = screen.getByRole('dialog', { name: 'Edit stretch session' });
    fireEvent.change(within(dialog).getByLabelText('Date'), { target: { value: '2026-10-19' } });
    await user.click(within(dialog).getByRole('button', { name: 'Save stretch' }));
    expect(container.querySelector('.flexibility-region[aria-label^="Abs"]')?.getAttribute('aria-label'))
      .toContain('Consistency score: 90');

    await user.click(screen.getByRole('button', { name: /^Delete$/ }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(screen.getByText('0 of 10 stretch regions tracked')).toBeTruthy();
    expect(container.querySelector('.flexibility-region[aria-label^="Abs"]')?.getAttribute('aria-label'))
      .toContain('Consistency score: unavailable');
  });

  it('previews and edits a suggested routine before saving without creating activity', async () => {
    const user = userEvent.setup();
    const { container } = render(<StatefulFlexibility />);
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    await user.click(screen.getByRole('button', { name: 'Suggestions' }));
    const picker = screen.getByRole('dialog', { name: 'Suggested stretch routines' });
    expect(within(picker).getByRole('heading', { name: 'Daily Stretch' })).toBeTruthy();
    await user.click(within(picker).getByRole('button', { name: 'Preview and edit Daily Stretch' }));
    const editor = screen.getByRole('dialog', { name: 'Preview routine' });
    expect(within(editor).getByLabelText('Estimated duration 13 min including holds and preparation')).toBeTruthy();
    expect(editor.querySelectorAll('.flexibility-routine-editor__stretch')).toHaveLength(6);
    expect(editor.querySelectorAll('.flexibility-routine-editor__stretch[open]')).toHaveLength(1);
    const firstStretch = editor.querySelector('.flexibility-routine-editor__stretch')!;
    expect(within(firstStretch as HTMLElement).getAllByRole('checkbox')).toHaveLength(10);
    await user.click(within(firstStretch as HTMLElement).getByText('60 sec · Both sides'));
    expect(firstStretch.hasAttribute('open')).toBe(false);
    await user.click(within(firstStretch as HTMLElement).getByText('Downward Dog'));
    expect(firstStretch.hasAttribute('open')).toBe(true);
    await user.clear(within(editor).getByLabelText('Routine name'));
    await user.type(within(editor).getByLabelText('Routine name'), 'Evening Stretch');
    await user.click(within(editor).getByRole('button', { name: 'Add to Saved' }));

    expect(screen.getByRole('tab', { name: 'Saved' }).getAttribute('aria-selected')).toBe('true');
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    expect(screen.getByRole('heading', { name: 'Evening Stretch' })).toBeTruthy();
    expect(screen.getByText('0 of 10 stretch regions tracked')).toBeTruthy();
    expect(container.querySelector('.flexibility-history__list')).toBeNull();
    await user.click(screen.getByRole('button', { name: /^Edit$/ }));
    const savedEditor = screen.getByRole('dialog', { name: 'Edit routine' });
    await user.clear(within(savedEditor).getByLabelText('Routine name'));
    await user.type(within(savedEditor).getByLabelText('Routine name'), 'Evening Stretch Updated');
    await user.click(within(savedEditor).getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('heading', { name: 'Evening Stretch Updated' })).toBeTruthy();
  });

  it('creates a blank saved routine through the shared editor without logging a stretch', async () => {
    const user = userEvent.setup();
    const { container } = render(<StatefulFlexibility />);
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    await user.click(screen.getByRole('button', { name: 'Create routine' }));
    const editor = screen.getByRole('dialog', { name: 'Create routine' });
    await user.click(within(editor).getByRole('button', { name: 'Save routine' }));
    expect(within(editor).getByRole('alert').textContent).toContain('Add at least one stretch');
    await user.type(within(editor).getByLabelText('Routine name'), 'Morning routine');
    await user.click(within(editor).getByRole('button', { name: '+ Add stretch' }));
    await user.type(within(editor).getByLabelText('Stretch name'), 'Hamstring stretch');
    const stretchCard = editor.querySelector('.flexibility-routine-editor__stretch')!;
    const summary = within(stretchCard as HTMLElement).getByText('30 sec per side · Left + right');
    await user.click(summary);
    expect(stretchCard.hasAttribute('open')).toBe(false);
    await user.click(within(stretchCard as HTMLElement).getByText('Hamstring stretch'));
    expect((within(stretchCard as HTMLElement).getByLabelText('Stretch name') as HTMLInputElement).value)
      .toBe('Hamstring stretch');
    await user.click(within(stretchCard as HTMLElement).getByText('30 sec per side · Left + right'));
    await user.click(within(editor).getByRole('button', { name: 'Save routine' }));
    expect(stretchCard.hasAttribute('open')).toBe(true);
    expect(within(stretchCard as HTMLElement).getByRole('alert').textContent)
      .toContain('Choose at least one target region');
    const hamstrings = within(stretchCard as HTMLElement).getByRole('checkbox', { name: 'Hamstrings' });
    hamstrings.focus();
    await user.keyboard(' ');
    expect((hamstrings as HTMLInputElement).checked).toBe(true);
    await user.click(within(editor).getByRole('button', { name: 'Save routine' }));

    expect(screen.getByRole('heading', { name: 'Morning routine' })).toBeTruthy();
    expect(screen.getByText('0 of 10 stretch regions tracked')).toBeTruthy();
    expect(container.querySelector('.flexibility-history__list')).toBeNull();
  });

  it('cancels routine edits without adding a saved template', async () => {
    const user = userEvent.setup();
    render(<StatefulFlexibility />);
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    await user.click(screen.getByRole('button', { name: 'Create routine' }));
    const editor = screen.getByRole('dialog', { name: 'Create routine' });
    await user.type(within(editor).getByLabelText('Routine name'), 'Discarded draft');
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Create routine' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Discarded draft' })).toBeNull();
    expect(screen.getByText('No saved routines yet. Create one or choose a suggestion.')).toBeTruthy();
  });

  it('keeps the existing region recommendation actionable when no saved routine matches', async () => {
    const user = userEvent.setup();
    const base = flexibilityRoutineSuggestions[2]!;
    const unrelatedRoutine: SavedFlexibilityRoutine = {
      ...base,
      id: 'saved-shoulders',
      name: 'Shoulder routine',
      stretches: [{
        ...base.stretches[0]!,
        id: 'shoulder-stretch',
        regionIds: ['shoulders']
      }]
    };
    const initialData: FlexibilityData = {
      ...createFlexibilityData(),
      sessions: [{ id: 'old-hamstrings', date: '2026-10-19', regionIds: ['hamstrings'] }],
      savedRoutines: [unrelatedRoutine]
    };
    render(<StatefulFlexibility initialData={initialData} />);
    expect(screen.getByText(/Hamstrings are 2 days overdue/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Log suggested regions' }));
    const dialog = screen.getByRole('dialog', { name: 'Log a stretch' });
    expect((within(dialog).getByRole('checkbox', { name: 'Hamstrings' }) as HTMLInputElement).checked).toBe(true);
  });

  it('guides holds without strength controls and applies timer changes to the next hold', async () => {
    const user = userEvent.setup();
    const base = flexibilityRoutineSuggestions[0]!;
    const routine: SavedFlexibilityRoutine = {
      ...base,
      id: 'saved-shoulder',
      name: 'Shoulder Routine',
      preparationSeconds: 0 as const,
      stretches: [{
        ...base.stretches[1]!,
        id: 'shoulders',
        holdSeconds: 30,
        regionIds: ['shoulders']
      }]
    };
    const initialData: FlexibilityData = {
      ...createFlexibilityData(),
      savedRoutines: [routine],
      timerPreferences: {
        holdSeconds: 30,
        preparationSeconds: 0,
        timerDirection: 'down',
        soundEnabled: false
      }
    };
    render(<StatefulFlexibility initialData={initialData} />);
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    await user.click(screen.getByRole('button', { name: /^Start$/ }));
    const dialog = screen.getByRole('dialog', { name: 'Shoulder Routine' });
    expect(within(dialog).getByRole('heading', { name: 'Shoulder Stretch' })).toBeTruthy();
    expect(within(dialog).getByText('Left side')).toBeTruthy();
    expect(within(dialog).getByText('Targets Shoulders')).toBeTruthy();
    expect(within(dialog).queryByText(/Targets .*· .*side/)).toBeNull();
    const navigationButton = within(dialog).getByRole('button', { name: '1 of 1' });
    expect(navigationButton).toBeTruthy();
    await user.click(navigationButton);
    const navigationMenu = screen.getByRole('menu', { name: 'Stretch navigation' });
    const menuItems = within(navigationMenu).getAllByRole('menuitem');
    expect(menuItems).toHaveLength(1);
    expect(document.activeElement).toBe(menuItems[0]);
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(navigationButton);

    const holdProgress = within(dialog).getByRole('group', { name: 'Shoulder Stretch hold progress' });
    expect(within(holdProgress).getAllByRole('button')).toHaveLength(3);
    expect(within(holdProgress).getByRole('button', { name: 'Left hold, pending' })).toBeTruthy();
    expect(within(holdProgress).getByRole('button', { name: 'Right hold, pending' })).toBeTruthy();
    expect(within(holdProgress).queryByText('×')).toBeNull();
    await user.click(within(holdProgress).getByRole('button', { name: 'Right hold, pending' }));
    expect(within(dialog).queryByLabelText('Stretch side')).toBeNull();
    expect(within(dialog).getByText('Right side')).toBeTruthy();
    expect(within(dialog).getByRole('timer').textContent).toBe('0:00');
    await user.click(within(holdProgress).getByRole('button', { name: 'Left hold, pending' }));
    expect(within(dialog).getByText('Left side')).toBeTruthy();
    expect(within(dialog).queryByText(/Weight|Reps|Log set|rest timer/i)).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Start stretch' }));
    expect(within(dialog).getByRole('timer').textContent).toMatch(/^0:2[0-9]$/);
    await user.click(within(dialog).getByRole('button', { name: 'Stretch timer settings' }));
    const settings = screen.getByRole('dialog', { name: 'Stretch timer settings' });
    expect(within(settings).getByLabelText('Custom duration (seconds)')).toBeTruthy();
    expect(within(settings).getByRole('combobox', { name: 'Get-ready countdown' })).toBeTruthy();
    await user.click(within(settings).getByRole('button', { name: '15s' }));
    await user.click(within(settings).getByLabelText('Count up'));
    await user.click(within(settings).getByRole('combobox', { name: 'Get-ready countdown' }));
    await user.click(screen.getByRole('option', { name: '3 seconds' }));
    await user.click(within(settings).getByRole('button', { name: 'Apply' }));
    expect(within(dialog).getByText('Hold duration · 0:30')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Skip hold' }));
    expect(within(dialog).getByText('Right side')).toBeTruthy();
    const skippedLeftHold = within(dialog).getByRole('button', { name: 'Left hold, skipped' });
    expect(skippedLeftHold.className).toContain('strength-guided__set--skipped');
    expect(within(skippedLeftHold).getByText('×')).toBeTruthy();
    expect((within(dialog).getByLabelText('Hold duration in seconds') as HTMLInputElement).value).toBe('15');
    await user.click(within(dialog).getByRole('button', { name: 'Start stretch' }));
    expect(within(dialog).getByRole('timer').textContent).toMatch(/^0:0[0-3]$/);
    expect(within(dialog).getByText('Hold duration · 0:15')).toBeTruthy();
    expect(within(dialog).getByText('Get ready')).toBeTruthy();
  });

  it('guides both sides as separate, prominently labeled holds', async () => {
    const user = userEvent.setup();
    const base = flexibilityRoutineSuggestions[0]!;
    const routine: SavedFlexibilityRoutine = {
      ...base,
      id: 'saved-downward-dog',
      name: 'Bilateral routine',
      preparationSeconds: 0,
      stretches: [{
        ...base.stretches[0]!,
        id: 'downward-dog',
        holdSeconds: 30,
        regionIds: ['hamstrings', 'calves', 'shoulders']
      }]
    };
    const initialData: FlexibilityData = {
      ...createFlexibilityData(),
      savedRoutines: [routine]
    };
    render(<StatefulFlexibility initialData={initialData} />);
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    await user.click(screen.getByRole('button', { name: /^Start$/ }));
    const dialog = screen.getByRole('dialog', { name: 'Bilateral routine' });
    expect(within(dialog).getByRole('heading', { name: 'Downward Dog' })).toBeTruthy();
    expect(within(dialog).getByText('Left side')).toBeTruthy();
    expect(within(dialog).getByText('Targets Hamstrings, Calves, Shoulders')).toBeTruthy();
    const progress = within(dialog).getByRole('group', { name: 'Downward Dog hold progress' });
    expect(within(progress).getByRole('button', { name: 'Left hold, pending' })).toBeTruthy();
    expect(within(progress).getByRole('button', { name: 'Right hold, pending' })).toBeTruthy();
    expect(within(progress).getAllByRole('button')).toHaveLength(3);
    expect(within(dialog).queryByLabelText('Stretch side')).toBeNull();
  });

  it('saves Left then Right and automatically advances to the next stretch', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-23T12:00:00.000Z'));
    try {
      const user = userEvent.setup();
      const base = flexibilityRoutineSuggestions[0]!;
      const routine: SavedFlexibilityRoutine = {
        ...base,
        id: 'guided-auto-advance',
        name: 'Guided progression',
        preparationSeconds: 0,
        stretches: [
          { ...base.stretches[0]!, id: 'downward-dog', holdSeconds: 1 },
          { ...base.stretches[1]!, id: 'shoulders', holdSeconds: 1 }
        ]
      };
      render(<StatefulFlexibility initialData={{
        ...createFlexibilityData(),
        savedRoutines: [routine],
        timerPreferences: {
          holdSeconds: 1,
          preparationSeconds: 0,
          timerDirection: 'down',
          soundEnabled: false
        }
      }} />);
      await user.click(screen.getByRole('tab', { name: 'Saved' }));
      await user.click(screen.getByRole('button', { name: /^Start$/ }));
      const dialog = screen.getByRole('dialog', { name: 'Guided progression' });
      expect(within(dialog).getByText('Left side')).toBeTruthy();
      expect(within(dialog).getByText('Up next · Shoulder Stretch')).toBeTruthy();

      for (const [second, nextSide] of [[1, 'Right side'], [2, 'Left side']] as const) {
        await user.click(within(dialog).getByRole('button', { name: 'Start stretch' }));
        await act(async () => {
          vi.setSystemTime(new Date(`2026-10-23T12:00:0${second}Z`));
          fireEvent.focus(window);
        });
        const saveLabel = second === 1 ? 'Save hold & next side' : 'Save hold & next stretch';
        await user.click(within(dialog).getByRole('button', { name: saveLabel }));
        expect(within(dialog).getByText(nextSide)).toBeTruthy();
      }

      expect(within(dialog).getByRole('heading', { name: 'Shoulder Stretch' })).toBeTruthy();
      expect(within(dialog).getByRole('button', { name: '2 of 2' })).toBeTruthy();
      const savedDraft = JSON.parse(screen.getByTestId('flexibility-state').textContent ?? '{}') as FlexibilityData;
      expect(savedDraft.guidedSessionDraft?.holds.slice(0, 2).map(item => ({
        side: item.side,
        status: item.status
      }))).toEqual([
        { side: 'left', status: 'completed' },
        { side: 'right', status: 'completed' }
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('skipping the final side of a stretch automatically advances to the next stretch', async () => {
    const user = userEvent.setup();
    const base = flexibilityRoutineSuggestions[0]!;
    const routine: SavedFlexibilityRoutine = {
      ...base,
      id: 'skip-final-guided-step',
      name: 'Skip progression',
      preparationSeconds: 0,
      stretches: [base.stretches[1]!, base.stretches[2]!]
    };
    render(<StatefulFlexibility initialData={{
      ...createFlexibilityData(),
      savedRoutines: [routine]
    }} />);
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    await user.click(screen.getByRole('button', { name: /^Start$/ }));
    const dialog = screen.getByRole('dialog', { name: 'Skip progression' });
    expect(within(dialog).getByText('Left side')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Skip hold' }));
    expect(within(dialog).getByText('Right side')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Skip hold' }));
    expect(within(dialog).getByRole('heading', { name: 'Chest Stretch' })).toBeTruthy();
    expect(within(dialog).getByText('Left side')).toBeTruthy();
  });

  it('edits saved session notes from the bottom Notes sheet', async () => {
    const user = userEvent.setup();
    const base = flexibilityRoutineSuggestions[0]!;
    const routine: SavedFlexibilityRoutine = {
      ...base,
      id: 'notes-guided-routine',
      name: 'Notes routine',
      preparationSeconds: 0,
      stretches: [base.stretches[0]!]
    };
    render(<StatefulFlexibility initialData={{
      ...createFlexibilityData(),
      savedRoutines: [routine]
    }} />);
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    await user.click(screen.getByRole('button', { name: /^Start$/ }));
    const dialog = screen.getByRole('dialog', { name: 'Notes routine' });
    expect(within(dialog).queryByLabelText('Session notes (optional)')).toBeNull();
    const notesButton = within(dialog).getByRole('button', { name: 'Notes' });
    await user.click(notesButton);
    const notesSheet = screen.getByRole('dialog', { name: 'Stretch session notes' });
    const notesField = within(notesSheet).getByRole('textbox', { name: 'Session notes' });
    await user.type(notesField, 'Keep my balance steady');
    await user.click(within(notesSheet).getByRole('button', { name: 'Done' }));
    expect(document.activeElement).toBe(notesButton);
    await user.click(notesButton);
    const reopenedSheet = screen.getByRole('dialog', { name: 'Stretch session notes' });
    expect((within(reopenedSheet).getByRole('textbox', { name: 'Session notes' }) as HTMLTextAreaElement).value)
      .toBe('Keep my balance steady');
  });

  it('limits hold progress to the current stretch and adds bilateral or paired rounds', async () => {
    const user = userEvent.setup();
    const base = flexibilityRoutineSuggestions[0]!;
    const routine: SavedFlexibilityRoutine = {
      ...base,
      id: 'saved-two-stretches',
      name: 'Two stretch routine',
      preparationSeconds: 0,
      stretches: [base.stretches[0]!, base.stretches[3]!]
    };
    const initialData: FlexibilityData = {
      ...createFlexibilityData(),
      savedRoutines: [routine]
    };
    render(<StatefulFlexibility initialData={initialData} />);
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    await user.click(screen.getByRole('button', { name: /^Start$/ }));
    const dialog = screen.getByRole('dialog', { name: 'Two stretch routine' });
    expect(within(dialog).getByRole('button', { name: '1 of 2' })).toBeTruthy();

    let progress = within(dialog).getByRole('group', { name: 'Downward Dog hold progress' });
    expect(within(progress).getByRole('button', { name: 'Left hold, pending' })).toBeTruthy();
    expect(within(progress).getByRole('button', { name: 'Right hold, pending' })).toBeTruthy();
    await user.click(within(progress).getByRole('button', { name: 'Add round' }));
    expect(within(progress).getByRole('button', { name: 'Left hold, pending, round 2' })).toBeTruthy();
    expect(within(progress).getByRole('button', { name: 'Right hold, pending, round 2' })).toBeTruthy();
    expect(within(dialog).getByRole('timer').textContent).toBe('0:00');
    expect(within(dialog).getByRole('button', { name: '1 of 2' })).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: '1 of 2' }));
    const navigation = screen.getByRole('menu', { name: 'Stretch navigation' });
    const items = within(navigation).getAllByRole('menuitem');
    expect(items).toHaveLength(2);
    await user.click(items[1]!);
    expect(within(dialog).getByRole('button', { name: '2 of 2' })).toBeTruthy();

    progress = within(dialog).getByRole('group', { name: 'Hamstring Stretch hold progress' });
    expect(within(progress).getByRole('button', { name: 'Left hold, pending' })).toBeTruthy();
    expect(within(progress).getByRole('button', { name: 'Right hold, pending' })).toBeTruthy();
    expect(within(progress).queryByText('×')).toBeNull();
    await user.click(within(progress).getByRole('button', { name: 'Add round' }));
    expect(within(progress).getByRole('button', { name: 'Left hold, pending, round 2' })).toBeTruthy();
    expect(within(progress).getByRole('button', { name: 'Right hold, pending, round 2' })).toBeTruthy();
    expect([...within(progress).getAllByRole('button')].map(button =>
      button.getAttribute('aria-label')?.replace(/, pending(?:, round \d+)?$/, '')
    ).slice(0, 4)).toEqual([
      'Left hold', 'Right hold', 'Left hold', 'Right hold'
    ]);
  });
});
