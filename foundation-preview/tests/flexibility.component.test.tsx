import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlexibilityView } from '../src/components/FlexibilityView.tsx';
import type { FlexibilityViewProps } from '../src/components/FlexibilityView.tsx';
import type { CategoryScoreSelection } from '../src/domain/category-scoring.ts';
import {
  createFlexibilityData,
  createFlexibilityGuidedSession,
  flexibilityRoutineSuggestions
} from '../src/domain/flexibility.ts';
import type { FlexibilityData, SavedFlexibilityRoutine } from '../src/domain/flexibility.ts';
import type { HealthAggregateEvidence } from '../src/components/HealthScoringDetailsCard.tsx';
import { todayRhythms } from '../src/domain/preview-data.ts';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const unscoredHealthScore: CategoryScoreSelection = {
  foundationIds: ['health-flexibility'],
  eligibleFoundationIds: [],
  excludedFoundationIds: [],
  unresolvedFoundationIds: [],
  consistency: null,
  onTrack: null,
  health: null
};

const unscoredEvidence: HealthAggregateEvidence = {
  heading: 'Linked Rhythm scores',
  description: 'Each eligible linked Rhythm counts equally.',
  itemLabel: 'Rhythm',
  rows: [],
  consistencyAverage: null,
  consistencyCount: 0,
  onTrackAverage: null,
  onTrackCount: 0,
  coverage: '0 of 0 linked Rhythms scored.',
  weightSummary: 'Consistency contributes 75% and On Track contributes 25%.',
  emptyState: 'Link a stretch Rhythm to the Flexibility Foundation; scores appear after its first occurrence is due.'
};

function StatefulFlexibility({
  initialData = createFlexibilityData(),
  healthScore = unscoredHealthScore,
  scoringEvidence = unscoredEvidence,
  unlinkedStretchRhythmTitles = [],
  rhythms,
  onAddLinkedRhythm,
  onSaveFoundationAssociations,
  onDataChange
}: {
  initialData?: FlexibilityData;
  healthScore?: CategoryScoreSelection;
  scoringEvidence?: HealthAggregateEvidence;
  unlinkedStretchRhythmTitles?: readonly string[];
  rhythms?: FlexibilityViewProps['rhythms'];
  onAddLinkedRhythm?: FlexibilityViewProps['onAddLinkedRhythm'];
  onSaveFoundationAssociations?: FlexibilityViewProps['onSaveFoundationAssociations'];
  onDataChange?: (data: FlexibilityData) => void;
}) {
  const [data, setData] = useState<FlexibilityData>(initialData);
  return (
    <FlexibilityView
      data={data}
      today="2026-10-23"
      healthScore={healthScore}
      scoringEvidence={scoringEvidence}
      unlinkedStretchRhythmTitles={unlinkedStretchRhythmTitles}
      {...(rhythms ? { rhythms } : {})}
      {...(onAddLinkedRhythm ? { onAddLinkedRhythm } : {})}
      {...(onSaveFoundationAssociations ? { onSaveFoundationAssociations } : {})}
      onChange={next => {
        setData(next);
        onDataChange?.(next);
        return null;
      }}
    />
  );
}

describe('Flexibility foundation presentation', () => {
  it('defaults to Body and uses automatic arrow, Home, and End tab activation', async () => {
    const user = userEvent.setup();
    render(<StatefulFlexibility />);
    const tablist = screen.getByRole('tablist', { name: 'Flexibility sections' });
    const bodyTab = within(tablist).getByRole('tab', { name: 'Body' });
    const routinesTab = within(tablist).getByRole('tab', { name: 'Routines' });
    const rhythmsTab = within(tablist).getByRole('tab', { name: 'Rhythms' });
    expect(bodyTab.getAttribute('aria-selected')).toBe('true');
    expect(bodyTab.getAttribute('tabindex')).toBe('0');
    expect(routinesTab.getAttribute('tabindex')).toBe('-1');
    expect(document.getElementById(bodyTab.getAttribute('aria-controls')!)?.getAttribute('aria-labelledby'))
      .toBe(bodyTab.id);

    bodyTab.focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(routinesTab);
    expect(routinesTab.getAttribute('aria-selected')).toBe('true');
    expect(routinesTab.getAttribute('tabindex')).toBe('0');
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(rhythmsTab);
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(bodyTab);
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(rhythmsTab);
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(bodyTab);
    expect(bodyTab.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(rhythmsTab);
    expect(rhythmsTab.getAttribute('aria-selected')).toBe('true');
  });

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
    expect(chestRow.getAttribute('aria-label')).toContain('Not logged yet. Last stretched: No log yet.');
    expect(within(chestRow).getByRole('img', { name: 'Stretch status: Not logged yet.' })).toBeTruthy();
    expect(within(chestRow).getByText('No log yet')).toBeTruthy();
    expect(within(chestRow).getByText('— · Every 3 days')).toBeTruthy();
    expect(frontMap.querySelector('[data-region="chest"]')?.getAttribute('aria-label'))
      .toContain('Every 3 days. Last stretched: No log yet.');
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
      .toContain('Not logged yet.');
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
    await user.click(screen.getByRole('button', { name: /Calves\. Not logged yet\./ }));
    await user.click(screen.getByRole('button', { name: 'Front' }));
    expect(container.querySelector('.flexibility-region[aria-pressed="true"]')?.textContent)
      .toContain('Neck');
    expect(container.querySelectorAll('.flexibility-region')).toHaveLength(6);
  });

  it('uses linked Rhythm scores, explains the 75/25 blend, and keeps region data diagnostic', async () => {
    const user = userEvent.setup();
    const healthScore: CategoryScoreSelection = {
      ...unscoredHealthScore,
      eligibleFoundationIds: ['health-flexibility'],
      consistency: 80,
      onTrack: 60,
      health: 75
    };
    const scoringEvidence: HealthAggregateEvidence = {
      ...unscoredEvidence,
      rows: [{ id: 'stretch-rhythm', label: 'Morning stretch', consistency: 80, onTrack: 60 }],
      consistencyAverage: 80,
      consistencyCount: 1,
      onTrackAverage: 60,
      onTrackCount: 1,
      coverage: '1 of 1 linked Rhythms scored.'
    };
    const { container } = render(
      <StatefulFlexibility
        healthScore={healthScore}
        scoringEvidence={scoringEvidence}
        unlinkedStretchRhythmTitles={['Evening stretch']}
      />
    );

    expect(container.querySelector('.flexibility-summary')?.classList.contains('rhythm-history-view__score-card')).toBe(true);
    expect(screen.getByRole('heading', { name: 'Flexibility Health' })).toBeTruthy();
    expect(container.querySelectorAll('.flexibility-summary .health-score-measures__item')).toHaveLength(2);
    expect(screen.getByRole('meter', { name: 'On Track score' }).getAttribute('aria-valuetext'))
      .toBe('60 out of 100');
    expect(screen.getByText('These stretch Rhythms are not included in Flexibility Health because they are not linked to the Flexibility Foundation: Evening stretch. Link them in their Foundation associations to include their scores.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show Flexibility Health scoring details' })).toBeTruthy();
    expect(container.querySelector('.flexibility-map-card')?.compareDocumentPosition(
      container.querySelector('.flexibility-routine-collection')!
    )).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    await user.click(screen.getByRole('button', { name: 'Show Flexibility Health scoring details' }));
    const healthDialog = screen.getByRole('dialog', { name: 'Flexibility Health details' });
    expect(healthDialog.classList.contains('dialog--phone-fullscreen')).toBe(true);
    expect(healthDialog.querySelector('.health-score-details-dialog__body')).toBeTruthy();
    const scoringDisclosure = within(healthDialog).getByRole('button', { name: 'How this Flexibility Foundation was scored' });
    expect(scoringDisclosure.getAttribute('aria-expanded')).toBe('false');
    await user.click(scoringDisclosure);
    expect(within(healthDialog).getByText(/averages Consistency and On Track from active linked stretch Rhythms equally/)).toBeTruthy();
    expect(within(healthDialog).getByRole('region', { name: 'Linked Rhythm scores' })).toBeTruthy();
    expect(within(healthDialog).getByText('Morning stretch')).toBeTruthy();
    expect(within(healthDialog).getByText('Consistency contributes 75% and On Track contributes 25%.')).toBeTruthy();
    expect(within(healthDialog).getByText(/Evening stretch/)).toBeTruthy();
    await user.click(within(healthDialog).getByRole('button', { name: 'Close Health details' }));
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Show Flexibility Health scoring details' }));
    });
    expect(screen.getByRole('heading', { name: 'Body overview' })).toBeTruthy();
    expect(screen.getByRole('tablist', { name: 'Flexibility sections' })).toBeTruthy();
    expect(screen.queryByText('Suggested next stretch')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Daily Stretch' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Log Shoulders' }));
    expect(screen.getByRole('dialog', { name: 'Log a stretch' })).toBeTruthy();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('tab', { name: 'Routines' }));
    expect(screen.getByText('No stretches logged yet.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'History' })).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'Body' }));
    await user.click(screen.getByRole('button', { name: 'Stretch interval settings' }));
    const intervalDialog = screen.getByRole('dialog', { name: 'Stretch intervals' });
    expect(intervalDialog.classList.contains('dialog--phone-fullscreen')).toBe(true);
    expect(intervalDialog.querySelector('.flexibility-settings-dialog__body')).toBeTruthy();
  });

  it('shows a not-yet-scored state and the first-due explanation for linked stretch Rhythms', async () => {
    const user = userEvent.setup();
    const scoringEvidence: HealthAggregateEvidence = {
      ...unscoredEvidence,
      coverage: '0 of 1 linked Rhythms scored.',
      emptyState: 'Scores appear after an eligible linked Rhythm has its first due occurrence.'
    };
    render(<StatefulFlexibility scoringEvidence={scoringEvidence} />);

    expect(screen.getByText('Flexibility Health is not yet scored. 0 of 1 linked Rhythms scored.'))
      .toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Show Flexibility Health scoring details' }));
    const dialog = screen.getByRole('dialog', { name: 'Flexibility Health details' });
    await user.click(within(dialog).getByRole('button', {
      name: 'How this Flexibility Foundation was scored'
    }));
    expect(within(dialog).getByText(
      'Scores appear after an eligible linked Rhythm has its first due occurrence.'
    )).toBeTruthy();
  });

  it('uses diagnostic status colors for current, due, overdue, and unlogged regions', async () => {
    const user = userEvent.setup();
    const data: FlexibilityData = {
      ...createFlexibilityData(),
      sessions: [
        { id: 'due-soon', date: '2026-10-20', regionIds: ['hamstrings'] },
        { id: 'due-today', date: '2026-10-21', regionIds: ['neck'] },
        { id: 'current', date: '2026-10-23', regionIds: ['shoulders'] },
        { id: 'overdue', date: '2026-10-11', regionIds: ['glutes'] }
      ]
    };
    const { container } = render(<StatefulFlexibility initialData={data} />);
    await user.click(screen.getByRole('button', { name: 'Back' }));

    const hamstrings = [...container.querySelectorAll<HTMLButtonElement>('.flexibility-region')]
      .find(row => row.getAttribute('aria-label')?.startsWith('Hamstrings'))!;
    const glutes = [...container.querySelectorAll<HTMLButtonElement>('.flexibility-region')]
      .find(row => row.getAttribute('aria-label')?.startsWith('Glutes'))!;
    const calves = [...container.querySelectorAll<HTMLButtonElement>('.flexibility-region')]
      .find(row => row.getAttribute('aria-label')?.startsWith('Calves'))!;
    const neck = [...container.querySelectorAll<HTMLButtonElement>('.flexibility-region')]
      .find(row => row.getAttribute('aria-label')?.startsWith('Neck'))!;
    const shoulders = [...container.querySelectorAll<HTMLButtonElement>('.flexibility-region')]
      .find(row => row.getAttribute('aria-label')?.startsWith('Shoulders'))!;
    expect(hamstrings.getAttribute('aria-label')).toContain('1 day overdue.');
    expect(hamstrings.querySelector('.strength-muscle-row__status')?.className)
      .toContain('strength-muscle-row__status--overdue');
    expect(glutes.getAttribute('aria-label')).toContain('10 days overdue.');
    expect(glutes.querySelector('.strength-muscle-row__status')?.className)
      .toContain('strength-muscle-row__status--overdue');
    expect(neck.getAttribute('aria-label')).toContain('Due today.');
    expect(neck.querySelector('.strength-muscle-row__status')?.className)
      .toContain('strength-muscle-row__status--due');
    expect(shoulders.getAttribute('aria-label')).toContain('Due in 3 days.');
    expect(shoulders.querySelector('.strength-muscle-row__status')?.className)
      .toContain('strength-muscle-row__status--current');
    expect(calves.querySelector('.strength-muscle-row__status')?.className)
      .toContain('strength-muscle-row__status--unavailable');
  });

  it('saves, resumes, edits, and deletes stretch records with updated diagnostic history', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { container } = render(<StatefulFlexibility />);
    await user.click(screen.getByRole('button', { name: 'Log Shoulders' }));
    const dialog = screen.getByRole('dialog', { name: 'Log a stretch' });
    await user.click(within(dialog).getByRole('checkbox', { name: 'Hamstrings' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Notes (optional)' }), 'Easy session');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('tab', { name: 'Routines' }));
    await user.click(screen.getByRole('button', { name: 'Resume manual stretch log' }));
    const resumedDialog = screen.getByRole('dialog', { name: 'Log a stretch' });
    expect((within(resumedDialog).getByRole('textbox', { name: 'Notes (optional)' }) as HTMLTextAreaElement).value)
      .toBe('Easy session');
    await user.click(within(resumedDialog).getByRole('button', { name: 'Save stretch' }));
    await user.click(screen.getByRole('tab', { name: 'Body' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    const hamstrings = [...container.querySelectorAll<HTMLElement>('.flexibility-region')]
      .find(row => row.textContent?.includes('Hamstrings'))!;
    expect(hamstrings.getAttribute('aria-label')).toContain('Due in 2 days.');
    expect(within(hamstrings).getByRole('img', { name: 'Stretch status: Due in 2 days.' })).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'Routines' }));
    await user.click(screen.getByRole('button', { name: /^Edit$/ }));
    const editDialog = screen.getByRole('dialog', { name: 'Edit stretch session' });
    fireEvent.change(within(editDialog).getByLabelText('Date'), { target: { value: '2026-10-19' } });
    await user.click(within(editDialog).getByRole('button', { name: 'Save stretch' }));
    await user.click(screen.getByRole('tab', { name: 'Body' }));
    const updatedHamstrings = [...container.querySelectorAll<HTMLElement>('.flexibility-region')]
      .find(row => row.textContent?.includes('Hamstrings'))!;
    expect(updatedHamstrings.getAttribute('aria-label')).toContain('2 days overdue.');
    expect(within(updatedHamstrings).getByRole('img', { name: 'Stretch status: 2 days overdue.' })).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'Routines' }));
    await user.click(screen.getByRole('button', { name: /^Delete$/ }));
    expect(confirm).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('tab', { name: 'Body' }));
    const deletedHamstrings = [...container.querySelectorAll<HTMLElement>('.flexibility-region')]
      .find(row => row.textContent?.includes('Hamstrings'))!;
    expect(deletedHamstrings.getAttribute('aria-label')).toContain('Not logged yet.');
    expect(within(deletedHamstrings).getByText('No log yet')).toBeTruthy();
  });

  it('saves preset intervals with keyboard and retains uncovered saved values as custom', async () => {
    const user = userEvent.setup();
    const data = createFlexibilityData();
    data.settings.intervals.hamstrings = 6;
    const changes: FlexibilityData[] = [];
    render(<StatefulFlexibility initialData={data} onDataChange={next => changes.push(next)} />);
    await user.click(screen.getByRole('button', { name: 'Stretch interval settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Stretch intervals' });
    const hamstrings = within(dialog).getByRole('combobox', { name: 'Hamstrings stretch interval' });
    expect(hamstrings.textContent).toContain('Custom · Every 6 days');
    expect((within(dialog).getByRole('textbox', { name: 'Hamstrings custom interval in days' }) as HTMLInputElement)
      .value).toBe('6');

    const abs = within(dialog).getByRole('combobox', { name: 'Abs stretch interval' });
    await user.click(abs);
    await user.keyboard('{Home}{Enter}');
    expect(abs.textContent).toBe('Every 1 day');
    expect(within(dialog).queryByRole('textbox', { name: 'Abs custom interval in days' })).toBeNull();

    await user.click(within(dialog).getByRole('button', { name: 'Save intervals' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(changes.at(-1)?.settings.intervals.abs).toBe(1);
    expect(changes.at(-1)?.settings.intervals.hamstrings).toBe(6);
  });

  it('validates custom values and discards unsaved interval edits on Cancel', async () => {
    const user = userEvent.setup();
    const data = createFlexibilityData();
    data.settings.intervals.hamstrings = 6;
    const onDataChange = vi.fn();
    render(<StatefulFlexibility initialData={data} onDataChange={onDataChange} />);
    await user.click(screen.getByRole('button', { name: 'Stretch interval settings' }));
    let dialog = screen.getByRole('dialog', { name: 'Stretch intervals' });
    const interval = within(dialog).getByRole('textbox', { name: 'Hamstrings custom interval in days' });
    await user.clear(interval);
    await user.type(interval, '366');
    await user.click(within(dialog).getByRole('button', { name: 'Save intervals' }));
    expect(within(dialog).getByRole('alert').textContent).toContain('from 1 to 365');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onDataChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Stretch interval settings' }));
    dialog = screen.getByRole('dialog', { name: 'Stretch intervals' });
    expect((within(dialog).getByRole('textbox', { name: 'Hamstrings custom interval in days' }) as HTMLInputElement)
      .value).toBe('6');
    expect(within(dialog).getByRole('combobox', { name: 'Hamstrings stretch interval' }).textContent)
      .toContain('Custom · Every 6 days');
    await user.click(within(dialog).getByRole('button', { name: 'Close stretch intervals' }));
    expect(onDataChange).not.toHaveBeenCalled();
  });

  it('logs, edits, and deletes Abs through the shared stretch-session flow', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { container } = render(<StatefulFlexibility />);
    await user.click(screen.getByRole('button', { name: 'Log Shoulders' }));
    let dialog = screen.getByRole('dialog', { name: 'Log a stretch' });
    await user.click(within(dialog).getByRole('checkbox', { name: 'Abs' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save stretch' }));

    expect(screen.getByText(/0 of 0 linked Rhythms scored\./)).toBeTruthy();
    const absRow = container.querySelector<HTMLButtonElement>('.flexibility-region[aria-label^="Abs"]');
    expect(absRow?.getAttribute('aria-label')).toContain('Due in 3 days.');

    await user.click(screen.getByRole('tab', { name: 'Routines' }));
    await user.click(screen.getByRole('button', { name: /^Edit$/ }));
    dialog = screen.getByRole('dialog', { name: 'Edit stretch session' });
    fireEvent.change(within(dialog).getByLabelText('Date'), { target: { value: '2026-10-19' } });
    await user.click(within(dialog).getByRole('button', { name: 'Save stretch' }));
    expect(container.querySelector('.flexibility-region[aria-label^="Abs"]')?.getAttribute('aria-label'))
      .toContain('1 day overdue.');

    await user.click(screen.getByRole('button', { name: /^Delete$/ }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(screen.getByText(/0 of 0 linked Rhythms scored\./)).toBeTruthy();
    expect(container.querySelector('.flexibility-region[aria-label^="Abs"]')?.getAttribute('aria-label'))
      .toContain('Not logged yet.');
  });

  it('previews and edits a suggested routine before saving without creating activity', async () => {
    const user = userEvent.setup();
    const { container } = render(<StatefulFlexibility />);
    await user.click(screen.getByRole('tab', { name: 'Routines' }));
    await user.click(screen.getByRole('button', { name: 'Add routine' }));
    const picker = screen.getByRole('dialog', { name: 'Add routine' });
    expect(within(picker).getByRole('heading', { name: 'Create your own' })).toBeTruthy();
    expect(within(picker).getByRole('heading', { name: 'Daily Stretch' })).toBeTruthy();
    expect(within(picker).getByText(/6 stretches · About 10 min/)).toBeTruthy();
    await user.click(within(picker).getAllByText('Preview routine')[0]!);
    expect(within(picker).getAllByText('Downward Dog').length).toBeGreaterThan(0);
    await user.click(within(picker).getAllByRole('button', { name: 'Customize' })[0]!);
    const editor = screen.getByRole('dialog', { name: 'Preview routine' });
    expect(within(editor).getByLabelText('Estimated duration 10 min 50 sec including holds and preparation')).toBeTruthy();
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

    expect(screen.getByRole('tab', { name: 'Routines' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Evening Stretch' })).toBeTruthy();
    expect(screen.getByText(/0 of 0 linked Rhythms scored\./)).toBeTruthy();
    expect(container.querySelector('.flexibility-history__list')).toBeNull();
    await user.click(container.querySelector('.strength-template__menu summary')!);
    await user.click(screen.getByRole('button', { name: 'Edit routine' }));
    const savedEditor = screen.getByRole('dialog', { name: 'Edit routine' });
    await user.clear(within(savedEditor).getByLabelText('Routine name'));
    await user.type(within(savedEditor).getByLabelText('Routine name'), 'Evening Stretch Updated');
    await user.click(within(savedEditor).getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('heading', { name: 'Evening Stretch Updated' })).toBeTruthy();
  });

  it('creates a blank saved routine through the shared editor without logging a stretch', async () => {
    const user = userEvent.setup();
    const { container } = render(<StatefulFlexibility />);
    await user.click(screen.getByRole('tab', { name: 'Routines' }));
    await user.click(screen.getByRole('button', { name: 'Add routine' }));
    await user.click(screen.getByRole('button', { name: 'Create' }));
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
    expect(screen.getByText(/0 of 0 linked Rhythms scored\./)).toBeTruthy();
    expect(container.querySelector('.flexibility-history__list')).toBeNull();
  });

  it('returns to the routine library with an unsaved draft available to continue', async () => {
    const user = userEvent.setup();
    render(<StatefulFlexibility />);
    await user.click(screen.getByRole('tab', { name: 'Routines' }));
    await user.click(screen.getByRole('button', { name: 'Add routine' }));
    await user.click(screen.getByRole('button', { name: 'Create' }));
    const editor = screen.getByRole('dialog', { name: 'Create routine' });
    await user.type(within(editor).getByLabelText('Routine name'), 'Discarded draft');
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
    const library = screen.getByRole('dialog', { name: 'Add routine' });
    await user.click(within(library).getByRole('button', { name: 'Continue editing' }));
    const resumedEditor = screen.getByRole('dialog', { name: 'Create routine' });
    expect((within(resumedEditor).getByLabelText('Routine name') as HTMLInputElement).value)
      .toBe('Discarded draft');
    await user.click(within(resumedEditor).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('heading', { name: 'Discarded draft' })).toBeNull();
  });

  it('offers the accurate guided and quick-log choices and records selected regions only on quick log', async () => {
    const user = userEvent.setup();
    const routine = flexibilityRoutineSuggestions[0]!;
    const savedRoutine: SavedFlexibilityRoutine = {
      ...routine,
      id: 'saved-quick-log',
      name: 'Quick log routine'
    };
    const { container } = render(<StatefulFlexibility initialData={{
      ...createFlexibilityData(),
      savedRoutines: [savedRoutine]
    }} />);

    await user.click(screen.getByRole('tab', { name: 'Routines' }));
    await user.click(screen.getByRole('button', { name: 'Stretch' }));
    expect(screen.getByText('Time each stretch and track each side.')).toBeTruthy();
    expect(screen.getByText('Record the regions you stretched.')).toBeTruthy();
    const choiceDialog = screen.getByRole('dialog', { name: 'Quick log routine' });
    await user.click(within(choiceDialog).getByRole('button', { name: /Quick log/ }));
    const logDialog = screen.getByRole('dialog', { name: 'Log a stretch' });
    expect(logDialog.querySelectorAll('input[type="checkbox"]:checked').length)
      .toBeGreaterThan(0);
    await user.click(within(logDialog).getByRole('button', { name: 'Save stretch' }));

    expect(screen.getByRole('heading', { name: 'History' })).toBeTruthy();
    const historyEntry = container.querySelector('.flexibility-history__list li');
    expect(historyEntry?.textContent).toContain('Manual stretch');
    expect(historyEntry?.textContent).toMatch(/Hamstrings|Shoulders|Back|Glutes|Calves|Neck/);
  });

  it('resumes an in-progress guided stretch session without creating history', async () => {
    const user = userEvent.setup();
    const routine = flexibilityRoutineSuggestions[0]!;
    const savedRoutine: SavedFlexibilityRoutine = {
      ...routine,
      id: 'saved-resume',
      name: 'Resume stretch routine'
    };
    const draftResult = createFlexibilityGuidedSession(savedRoutine, {
      id: 'guided-draft',
      date: '2026-10-23',
      startedAt: '2026-10-23T09:00:00.000Z',
      timeZone: 'UTC'
    });
    expect(draftResult.valid).toBe(true);
    if (!draftResult.valid) return;
    render(<StatefulFlexibility initialData={{
      ...createFlexibilityData(),
      savedRoutines: [savedRoutine],
      guidedSessionDraft: draftResult.session
    }} />);

    expect(screen.getByRole('tab', { name: 'Routines' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('button', { name: 'Resume session' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Resume session' }));
    const session = screen.getByRole('dialog', { name: 'Resume stretch routine' });
    expect(within(session).getByRole('heading', { name: 'Downward Dog' })).toBeTruthy();
    expect(screen.getByText('No stretches logged yet.')).toBeTruthy();
  });

  it('shows empty and populated linked-Rhythm panels and preserves the association entry point', async () => {
    const user = userEvent.setup();
    const onAddLinkedRhythm = vi.fn();
    const onSaveFoundationAssociations = vi.fn(() => null);
    const linkedRhythm = {
      ...todayRhythms[0]!,
      id: 'flexibility-stretch-rhythm',
      title: 'Morning stretches',
      categoryIds: ['health'] as const,
      primaryFoundationId: 'health-flexibility'
    };
    const { rerender } = render(<StatefulFlexibility
      onAddLinkedRhythm={onAddLinkedRhythm}
      onSaveFoundationAssociations={onSaveFoundationAssociations}
    />);
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    expect(screen.getByText('No Rhythms are linked to Flexibility yet.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Linked Rhythms · 0' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Manage links' }));
    const emptyAssociationDialog = screen.getByRole('dialog', { name: 'Linked Rhythms' });
    expect(within(emptyAssociationDialog).getByRole('heading', { name: 'No rhythms to link yet' }))
      .toBeTruthy();
    await user.click(within(emptyAssociationDialog).getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Add Rhythm' }));
    expect(onAddLinkedRhythm.mock.calls[0]?.[0]).toBe('health-flexibility');

    rerender(<StatefulFlexibility
      rhythms={[linkedRhythm]}
      onAddLinkedRhythm={onAddLinkedRhythm}
      onSaveFoundationAssociations={onSaveFoundationAssociations}
    />);
    expect(screen.getByRole('heading', { name: 'Linked Rhythms · 1' })).toBeTruthy();
    expect(screen.getByText('Morning stretches')).toBeTruthy();
    expect(screen.queryByText('No Rhythms are linked to Flexibility yet.')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Manage links' }));
    const associationDialog = screen.getByRole('dialog', { name: 'Linked Rhythms' });
    expect((within(associationDialog).getByRole('checkbox', {
      name: /Morning stretches/
    }) as HTMLInputElement).checked).toBe(true);
  });

  it('shows the three newest manual sessions first and reveals older history on request', async () => {
    const user = userEvent.setup();
    const data: FlexibilityData = {
      ...createFlexibilityData(),
      sessions: [
        { id: 'stretch-old', date: '2026-10-18', regionIds: ['neck'] },
        { id: 'stretch-newest', date: '2026-10-22', regionIds: ['hamstrings'] },
        { id: 'stretch-middle', date: '2026-10-20', regionIds: ['shoulders'] },
        { id: 'stretch-recent', date: '2026-10-21', regionIds: ['back'] }
      ]
    };
    const { container } = render(<StatefulFlexibility initialData={data} />);
    await user.click(screen.getByRole('tab', { name: 'Routines' }));
    const historyList = container.querySelector('.flexibility-history__list')!;
    const firstThree = [...historyList.querySelectorAll('li strong')].map(item => item.textContent);
    expect(firstThree).toEqual([
      '2026-10-22 · Manual stretch',
      '2026-10-21 · Manual stretch',
      '2026-10-20 · Manual stretch'
    ]);
    await user.click(screen.getByRole('button', { name: 'View all' }));
    expect(historyList.querySelectorAll('li')).toHaveLength(4);
    expect(historyList.querySelector('li:last-child strong')?.textContent)
      .toBe('2026-10-18 · Manual stretch');
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
    await user.click(screen.getByRole('tab', { name: 'Routines' }));
    await user.click(screen.getByRole('button', { name: 'Stretch' }));
    await user.click(screen.getByRole('button', { name: /Guided session/ }));
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
    expect((within(dialog).getByLabelText('Stretch side') as HTMLSelectElement).value).toBe('right');
    expect(within(dialog).getByText('Right side')).toBeTruthy();
    expect(within(dialog).getByRole('timer').textContent).toBe('0:00');
    await user.click(within(holdProgress).getByRole('button', { name: 'Left hold, pending' }));
    expect((within(dialog).getByLabelText('Stretch side') as HTMLSelectElement).value).toBe('left');
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
    expect((within(dialog).getByLabelText('Stretch side') as HTMLSelectElement).value).toBe('right');
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

  it('shows Both sides prominently for bilateral stretches', async () => {
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
    await user.click(screen.getByRole('tab', { name: 'Routines' }));
    await user.click(screen.getByRole('button', { name: 'Stretch' }));
    await user.click(screen.getByRole('button', { name: /Guided session/ }));
    const dialog = screen.getByRole('dialog', { name: 'Bilateral routine' });
    expect(within(dialog).getByRole('heading', { name: 'Downward Dog' })).toBeTruthy();
    expect(within(dialog).getByText('Both sides')).toBeTruthy();
    expect(within(dialog).getByText('Targets Hamstrings, Calves, Shoulders')).toBeTruthy();
    const progress = within(dialog).getByRole('group', { name: 'Downward Dog hold progress' });
    expect(within(progress).getByRole('button', { name: 'Both sides hold, pending' })).toBeTruthy();
    expect(within(progress).getAllByRole('button')).toHaveLength(2);
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
    await user.click(screen.getByRole('tab', { name: 'Routines' }));
    await user.click(screen.getByRole('button', { name: 'Stretch' }));
    await user.click(screen.getByRole('button', { name: /Guided session/ }));
    const dialog = screen.getByRole('dialog', { name: 'Two stretch routine' });
    expect(within(dialog).getByRole('button', { name: '1 of 2' })).toBeTruthy();

    let progress = within(dialog).getByRole('group', { name: 'Downward Dog hold progress' });
    expect(within(progress).getByRole('button', { name: 'Both sides hold, pending' })).toBeTruthy();
    expect(within(progress).queryByText('L')).toBeNull();
    await user.click(within(progress).getByRole('button', { name: 'Add round' }));
    expect(within(progress).getByRole('button', { name: 'Both sides hold, pending, round 2' })).toBeTruthy();
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
