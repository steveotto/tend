import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { CardioView } from '../src/components/CardioView.tsx';
import {
  cardioDistanceToMiles,
  createCardioData,
  isCardioRun,
  saveCardioGoals
} from '../src/domain/cardio.ts';
import type { CardioData } from '../src/domain/cardio.ts';
import { createWeightData } from '../src/domain/weight.ts';
import type { WeightData } from '../src/domain/weight.ts';
import { todayRhythms } from '../src/domain/preview-data.ts';
import type { RhythmPreview } from '../src/domain/preview-data.ts';
import { CardioRunnerIcon, CardioWalkIcon } from '../src/components/CardioActivitySummary.tsx';

afterEach(() => {
  cleanup();
  document.querySelectorAll('[data-test-cardio-opener]').forEach(element => element.remove());
});

it('uses the supplied filled walk silhouette with a 128 viewBox and currentColor', () => {
  const { container } = render(<CardioWalkIcon />);
  const svg = container.querySelector('svg');
  expect(svg?.getAttribute('viewBox')).toBe('0 0 128 128');
  expect(svg?.getAttribute('fill')).toBe('currentColor');
  expect(svg?.getAttribute('aria-hidden')).toBe('true');
  expect(svg?.hasAttribute('width')).toBe(false);
  expect(svg?.hasAttribute('height')).toBe(false);
  expect(svg?.querySelectorAll('path')).toHaveLength(2);
});

it('uses the single shared filled runner silhouette with the original viewBox and paths', () => {
  const { container } = render(<CardioRunnerIcon />);
  const svg = container.querySelector('svg');
  expect(svg?.getAttribute('viewBox')).toBe('0 0 1167 1280');
  expect(svg?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
  expect(svg?.getAttribute('aria-hidden')).toBe('true');
  expect(svg?.hasAttribute('width')).toBe(false);
  expect(svg?.hasAttribute('height')).toBe(false);
  expect(svg?.querySelector('g')?.getAttribute('transform')).toBe('translate(0.000000,1280.000000) scale(0.100000,-0.100000)');
  expect(svg?.querySelector('g')?.getAttribute('fill')).toBe('currentColor');
  expect(svg?.querySelectorAll('path')).toHaveLength(2);
});

function renderCardio(
  data: CardioData = createCardioData(),
  options: { saveError?: string; weightData?: WeightData } = {}
) {
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
        {...(options.weightData ? { weightData: options.weightData } : {})}
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

function CardioStateHarness({ initialData }: { initialData: CardioData }) {
  const [data, setData] = useState(initialData);
  return (
    <CardioView
      data={data}
      today="2026-10-22"
      rhythms={[cardioRhythm()]}
      archivedRhythmIds={new Set()}
      datedRhythmCompletions={[]}
      onChange={next => {
        setData(next);
        return null;
      }}
      foundationNavigation
      foundationActive
    />
  );
}

describe('Cardio preview presentation', () => {
  it('organizes the Foundation into keyboard-operable Insights, Activities, and Rhythms panels', async () => {
    const user = userEvent.setup();
    const data: CardioData = {
      ...saveCardioGoals(createCardioData(), {
        weeklyRunTarget: 2,
        weeklyMileTarget: 8
      }, '2026-10-22', '2026-10-19'),
      runs: [{ id: 'tab-run', date: '2026-10-22', distance: 3 }]
    };
    const onAddLinkedRhythm = vi.fn();
    render(
      <CardioView
        data={data}
        today="2026-10-22"
        rhythms={[]}
        archivedRhythmIds={new Set()}
        datedRhythmCompletions={[]}
        onChange={vi.fn(() => null)}
        onAddLinkedRhythm={onAddLinkedRhythm}
        foundationNavigation
        foundationActive
      />
    );

    const tabs = screen.getByRole('tablist', { name: 'Cardio Foundation sections' });
    const insights = screen.getByRole('region', { name: 'Activity insights' });
    const progress = within(tabs).getByRole('tab', { name: 'Insights' });
    const activities = within(tabs).getByRole('tab', { name: 'Activities' });
    const rhythms = within(tabs).getByRole('tab', { name: 'Rhythms' });
    expect(progress.getAttribute('aria-selected')).toBe('true');
    expect(progress.getAttribute('tabindex')).toBe('0');
    expect(activities.getAttribute('tabindex')).toBe('-1');
    expect(screen.getByRole('tabpanel', { name: 'Insights' })).toBeTruthy();
    expect(within(insights).getByText('Explore your activity and weekly progress.')).toBeTruthy();
    expect(within(insights).getByText(
      'Your Cardio Health comes from logged runs and weekly goals. Tending a Rhythm alone doesn’t count as a run.'
    )).toBeTruthy();
    expect(insights.contains(tabs)).toBe(false);
    expect(insights.contains(document.querySelector('.foundation-health-card'))).toBe(false);
    expect(screen.getByRole('button', { name: 'Cardio tracking settings' })).toBeTruthy();

    progress.focus();
    await user.keyboard('{ArrowRight}');
    expect(activities.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(activities);
    expect(screen.getByRole('tabpanel', { name: 'Activities' })).toBeTruthy();
    expect(within(screen.getByRole('tabpanel', { name: 'Activities' })).getByText('Oct 22, 2026')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Add activity' }));
    expect(screen.getByRole('dialog', { name: 'Log activity' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(activities.getAttribute('aria-selected')).toBe('true');

    activities.focus();
    await user.keyboard('{End}');
    expect(rhythms.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('No Rhythms are linked to Cardio yet.')).toBeTruthy();
    expect(document.querySelector('.strength-rhythms-empty')?.classList.contains('strength-rhythms-empty')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Add Rhythm' }));
    expect(onAddLinkedRhythm.mock.calls[0]?.[0]).toBe('health-cardio');

    rhythms.focus();
    await user.keyboard('{ArrowRight}');
    expect(progress.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{End}');
    await user.keyboard('{Home}');
    expect(progress.getAttribute('aria-selected')).toBe('true');
    expect(progress.getAttribute('tabindex')).toBe('0');
    expect(rhythms.getAttribute('tabindex')).toBe('-1');
  });

  it('preserves the existing activities tab identifier and routes Rhythm logging to Activities', async () => {
    const user = userEvent.setup();
    const opener = document.createElement('button');
    opener.dataset.testCardioOpener = 'true';
    document.body.append(opener);
    const props = {
      data: createCardioData(),
      today: '2026-10-22',
      rhythms: [cardioRhythm()],
      archivedRhythmIds: new Set<string>(),
      datedRhythmCompletions: [],
      onChange: vi.fn(() => null),
      foundationNavigation: true,
      foundationActive: true
    } as const;
    const view = render(<CardioView {...props} />);
    const tabs = screen.getByRole('tablist', { name: 'Cardio Foundation sections' });
    const activities = within(tabs).getByRole('tab', { name: 'Activities' });
    expect(activities.getAttribute('id')).toBe('cardio-tab-activities');
    expect(activities.getAttribute('aria-controls')).toBe('cardio-panel-activities');
    await user.click(activities);
    view.rerender(<CardioView {...props} />);
    expect(activities.getAttribute('aria-selected')).toBe('true');

    const onLogRequestClosed = vi.fn();
    view.rerender(
      <CardioView
        {...props}
        pendingLogRequest={{ requestId: 7, opener, rhythm: cardioRhythm() }}
        onLogRequestClosed={onLogRequestClosed}
      />
    );
    expect(screen.getByRole('tab', { name: 'Activities' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('dialog', { name: 'Log activity' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onLogRequestClosed).toHaveBeenCalledOnce();
  });

  it('shows linked Cardio Rhythms and keeps association controls available', async () => {
    const user = userEvent.setup();
    const rhythm = { ...cardioRhythm(), primaryFoundationId: 'health-cardio' };
    const onSaveFoundationAssociations = vi.fn(() => null);
    render(
      <CardioView
        data={createCardioData()}
        today="2026-10-22"
        rhythms={[rhythm]}
        archivedRhythmIds={new Set()}
        datedRhythmCompletions={[]}
        onChange={vi.fn(() => null)}
        onSaveFoundationAssociations={onSaveFoundationAssociations}
        foundationNavigation
      />
    );
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    expect(screen.getByText('Run rhythm')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Linked Rhythms · 1' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Manage links' }));
    const associations = screen.getByRole('dialog', { name: 'Linked Rhythms' });
    expect((within(associations).getByRole('checkbox', { name: /Run rhythm/ }) as HTMLInputElement).checked).toBe(true);
    await user.click(associations.querySelector('.money-goal-dialog__close')!);
    expect(onSaveFoundationAssociations).not.toHaveBeenCalled();
  });

  it('shows weekly totals, separate goal progress, a fixed calendar, and compact nonduplicated run history', async () => {
    const user = userEvent.setup();
    const data = saveCardioGoals({
      ...createCardioData(),
      runs: [
        { id: 'run-this-week', date: '2026-10-22', distance: 3, notes: 'Treadmill' },
        { id: 'run-prior-week', date: '2026-10-16', distance: 5, notes: 'Track session' }
      ]
    }, { weeklyRunTarget: 2, weeklyMileTarget: 8 }, '2026-10-22', '2026-10-19');
    const { container } = renderCardio(data);
    expect(screen.getByRole('button', { name: 'Cardio tracking settings' })).toBeTruthy();
    const weekSummary = screen.getByRole('region', { name: 'This week' });
    expect(within(weekSummary).getByText('Distance')).toBeTruthy();
    expect(within(weekSummary).getByText('Total time')).toBeTruthy();
    expect(within(weekSummary).getByText('Calories')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Oct 19 – Oct 25' })).toBeTruthy();
    expect(screen.getByText('Monday – Sunday')).toBeTruthy();
    expect(screen.getByText('Number of runs')).toBeTruthy();
    expect(screen.getByText('Weekly distance')).toBeTruthy();
    const measureCards = container.querySelectorAll('.cardio-measure');
    expect(measureCards).toHaveLength(2);
    expect(measureCards[0]?.textContent).toContain('Weekly distance');
    expect(measureCards[0]?.textContent).toContain('This week');
    expect(measureCards[1]?.textContent).toContain('Number of runs');
    expect(measureCards[0]?.querySelector('.cardio-measure__progress')).toBeTruthy();
    expect(measureCards[0]?.querySelector('.cardio-measure__progress')?.getAttribute('aria-hidden')).toBe('true');
    const goalProgress = within(container.querySelector('.cardio-measures') as HTMLElement)
      .getAllByRole('progressbar');
    expect(goalProgress.map(meter => meter.getAttribute('aria-label'))).toEqual([
      'Weekly distance',
      'Number of runs'
    ]);
    const summaryElement = container.querySelector('.cardio-weekly-summary');
    const measures = container.querySelector('.cardio-measures');
    const calendar = container.querySelector('.cardio-progress-card');
    expect(summaryElement && measures && calendar
      && summaryElement.compareDocumentPosition(measures) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(measures && calendar
      && measures.compareDocumentPosition(calendar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const measureToggle = screen.getByRole('button', {
      name: 'Show Cardio Health Consistency and On Track breakdown'
    });
    expect(measureToggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById(measureToggle.getAttribute('aria-controls')!)?.hidden).toBe(true);
    await user.click(measureToggle);
    const onTrack = screen.getByRole('meter', { name: 'On Track score' });
    expect(onTrack.getAttribute('aria-valuenow')).toBe('38');
    expect(onTrack.querySelector('.rhythm-score-circle__progress')?.getAttribute('stroke-dashoffset')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Cardio Health: Not enough data' })).toBeTruthy();
    expect(container.querySelector('.cardio-week-day.is-today')?.textContent).toContain('Today');
    expect(screen.getAllByText('Oct 16, 2026').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Oct 22, 2026').length).toBeGreaterThan(0);
    const historyList = container.querySelector('.cardio-history-list');
    expect(historyList?.textContent).toContain('5 mile run');
    expect(historyList?.textContent).not.toContain('3 miles');
    expect(historyList?.textContent).not.toContain('Treadmill');
    expect(historyList?.textContent).not.toContain('Track session');
    expect(historyList?.querySelectorAll('.cardio-activity-row')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Latest Activity' })).toBeTruthy();
    const latestCard = container.querySelector('.cardio-latest-activity');
    expect(latestCard?.querySelector('.cardio-latest-activity__header')?.textContent).not.toContain('Duration');
    expect(latestCard?.querySelectorAll('.cardio-activity-performance__icon')).toHaveLength(3);
    expect(screen.getByRole('heading', { name: 'Activity History' })).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Number of runs' }).getAttribute('aria-valuenow')).toBe('50');
    expect(screen.getByRole('progressbar', { name: 'Weekly distance' }).getAttribute('aria-valuenow')).toBe('37.5');
  });

  it('caps goal fills at 100 percent while preserving exceeded totals and zero remaining amounts', () => {
    const data = saveCardioGoals({
      ...createCardioData(),
      runs: [
        { id: 'run-one', date: '2026-10-22', distance: 5.2, durationSeconds: 3600 },
        { id: 'run-two', date: '2026-10-22', distance: 5, durationSeconds: 1800 }
      ]
    }, { weeklyRunTarget: 1, weeklyMileTarget: 8 }, '2026-10-22', '2026-10-19');
    const { container } = renderCardio(data);
    const weeklyDistance = screen.getByRole('progressbar', { name: 'Weekly distance' });
    const numberOfRuns = screen.getByRole('progressbar', { name: 'Number of runs' });
    expect(weeklyDistance.getAttribute('aria-valuenow')).toBe('100');
    expect(weeklyDistance.getAttribute('aria-valuetext')).toContain('128');
    expect(numberOfRuns.getAttribute('aria-valuenow')).toBe('100');
    expect(numberOfRuns.getAttribute('aria-valuetext')).toContain('200');
    expect(container.querySelector('.cardio-measure__progress > span')?.getAttribute('style'))
      .toContain('width: 100%');
    expect(screen.getAllByText('2.2 mi above goal').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1 above goal').length).toBeGreaterThan(0);
  });

  it('shows Goal reached exactly at the weekly target', () => {
    const data = saveCardioGoals({
      ...createCardioData(),
      runs: [{ id: 'run-one', date: '2026-10-22', distance: 8, durationSeconds: 3600 }]
    }, { weeklyRunTarget: 1, weeklyMileTarget: 8 }, '2026-10-22', '2026-10-19');
    renderCardio(data);

    expect(screen.getAllByText('Goal reached').length).toBeGreaterThanOrEqual(2);
  });

  it('shortens Activity History and expands it with an All Activities action', async () => {
    const user = userEvent.setup();
    const data: CardioData = {
      ...createCardioData(),
      runs: Array.from({ length: 7 }, (_, index) => ({
        id: `history-${index}`,
        date: `2026-10-${String(22 - index).padStart(2, '0')}`,
        distance: 3 + index * 0.1,
        durationSeconds: 1800 + index * 60
      }))
    };
    const { container } = renderCardio(data);
    const history = container.querySelector('.cardio-history-card');
    expect(history?.querySelectorAll('.cardio-activity-row')).toHaveLength(5);
    expect(history?.querySelectorAll('.cardio-activity-row__type-icon')).toHaveLength(5);
    await user.click(within(history as HTMLElement).getByRole('button', { name: 'All Activities' }));
    expect(history?.querySelectorAll('.cardio-activity-row')).toHaveLength(6);
    expect(within(history as HTMLElement).queryByRole('button', { name: 'All Activities' })).toBeNull();
  });

  it('renders mixed Run and Walk history with shared type icons and truthful pace states', () => {
    const data: CardioData = {
      ...createCardioData(),
      runs: [
        { id: 'new-run', date: '2026-10-22', distance: 5, durationSeconds: 2400, activityType: 'run' },
        { id: 'walk', date: '2026-10-21', distance: 2, durationSeconds: 2400, activityType: 'walk' },
        { id: 'older-run', date: '2026-10-20', distance: 5, durationSeconds: 2700, activityType: 'run' },
        { id: 'previous-run', date: '2026-10-19', distance: 5, durationSeconds: 3000, activityType: 'run' }
      ]
    };
    const { container } = renderCardio(data);
    const walkRow = screen.getByRole('button', { name: /Open walk details for 2 miles/ });
    expect(walkRow.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 128 128');
    expect(walkRow.textContent).toContain('Oct 21, 2026');
    expect(within(walkRow).queryByText(/Pace unchanged|Faster|Slower/)).toBeNull();

    const runRow = screen.getByRole('button', { name: /Open run details for 5 miles, on Oct 20, 2026/ });
    expect(runRow.querySelector('.cardio-activity-row__pace-cardio-chip')?.textContent).toContain('▼');
    expect(runRow.querySelector('.cardio-activity-row__pace-cardio-chip')?.textContent).toContain('/mi');
    expect(runRow.getAttribute('aria-label')).toContain('seconds per mile faster');
    expect(container.querySelectorAll('.cardio-activity-row')).toHaveLength(3);
  });

  it('labels partial weekly and all-history summaries while normalizing saved distance units', () => {
    const data: CardioData = {
      ...createCardioData(),
      runs: [
        {
          id: 'week-with-estimate',
          date: '2026-10-19',
          distance: 2,
          durationSeconds: 1200,
          calorieEstimate: {
            source: 'estimated',
            method: 'distance-weight-v1',
            weightKg: 70,
            weightSource: 'manual'
          }
        },
        {
          id: 'week-kilometers',
          date: '2026-10-20',
          distance: cardioDistanceToMiles(10, 'km'),
          distanceUnit: 'km'
        },
        { id: 'older-run', date: '2026-10-16', distance: 3 }
      ]
    };
    renderCardio(data);

    const week = screen.getByRole('region', { name: 'This week' });
    expect(within(week).getByText('8.21 mi')).toBeTruthy();
    expect(within(week).getByText('20:00')).toBeTruthy();
    expect(within(week).getByText('Partial total · duration for 1 of 2 activities')).toBeTruthy();
    expect(within(week).getByText('225')).toBeTruthy();
    expect(within(week).getByText('kcal')).toBeTruthy();
    expect(within(week).getByText('Calories available for 1 of 2 activities')).toBeTruthy();

    const allActivities = screen.getByRole('region', { name: 'All Activities' });
    expect(within(allActivities).getByText('3')).toBeTruthy();
    expect(within(allActivities).getByText('11.21')).toBeTruthy();
    expect(within(allActivities).getByText('mi')).toBeTruthy();
    expect(within(allActivities).getByText('225')).toBeTruthy();
    expect(within(allActivities).getByText('kcal')).toBeTruthy();
    expect(within(allActivities).getByText('Calories available for 1 of 3 activities')).toBeTruthy();
    expect(within(allActivities).getByText('All-time totals.')).toBeTruthy();
  });

  it('opens the selected calendar run in Runs, shares details with history, and refreshes views after edit and delete', async () => {
    const user = userEvent.setup();
    const data: CardioData = {
      ...createCardioData(),
      runs: [
        { id: 'same-day-a', date: '2026-10-22', distance: 3 },
        { id: 'same-day-b', date: '2026-10-22', distance: 5 },
        { id: 'monday-four', date: '2026-10-19', distance: 4, durationSeconds: 2400 }
      ]
    };
    render(<CardioStateHarness initialData={data} />);

    const marker = screen.getByRole('button', { name: /View 2 activities.*3 mile run.*5 mile run/ });
    const tooltipId = marker.getAttribute('aria-describedby');
    expect(tooltipId).toBeTruthy();
    expect(document.getElementById(tooltipId!)?.textContent).toBe('3 mile run · 5 mile run');
    expect(marker.getAttribute('aria-haspopup')).toBe('dialog');
    expect(marker.getAttribute('aria-expanded')).toBe('false');
    await user.click(marker);
    const popover = screen.getByRole('dialog', { name: /Activities on/ });
    expect(within(popover).getByText('3 mile run')).toBeTruthy();
    expect(within(popover).getByText('5 mile run')).toBeTruthy();
    await user.click(within(popover).getByRole('button', { name: /Details for 3 mile run/ }));

    expect(screen.getByRole('tab', { name: 'Activities' }).getAttribute('aria-selected')).toBe('true');
    let details = screen.getByRole('dialog', { name: 'Run details' });
    expect(within(details).getByText('3 miles')).toBeTruthy();
    expect(within(details).getByText('October 22, 2026')).toBeTruthy();
    expect(within(details).getByText('Time not recorded')).toBeTruthy();
    expect(within(details).getByText(/rough gross-energy estimate, not active calories/)).toBeTruthy();
    const comparison = within(details).getByRole('region', { name: /Compared to previous 4-mile run/ });
    expect(within(comparison).getByRole('heading', { name: 'Compared to previous 4-mile run' })).toBeTruthy();
    expect(within(comparison).getByText(/Oct 19, 2026/)).toBeTruthy();
    expect(within(comparison).getByText('Pace')).toBeTruthy();
    expect(within(comparison).getByText('Pace')).toBeTruthy();
    expect(within(comparison).getByText('Calories')).toBeTruthy();
    expect(within(comparison).getByText('Distance')).toBeTruthy();
    await user.click(within(details).getByRole('button', { name: 'Edit activity' }));

    const edit = screen.getByRole('dialog', { name: 'Edit run' });
    const distance = within(edit).getByLabelText('Distance (miles)');
    await user.clear(distance);
    await user.type(distance, '6');
    await user.click(within(edit).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit run' })).toBeNull());
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/Open run details for 6 miles/);
    expect(within(screen.getByRole('region', { name: 'All Activities' })).getByText('15')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'All Activities' })).getByText('mi')).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'Insights' }));
    const updatedMarker = screen.getByRole('button', { name: /View 2 activities/ });
    expect(updatedMarker.getAttribute('aria-label')).toContain('5 mile run');
    expect(updatedMarker.getAttribute('aria-label')).toContain('6 mile run');
    await user.click(screen.getByRole('tab', { name: 'Activities' }));
    const editedRow = screen.getByRole('button', { name: /Open run details for 6 miles/ });
    await user.click(editedRow);
    details = screen.getByRole('dialog', { name: 'Run details' });
    await user.click(within(details).getByRole('button', { name: 'Edit activity' }));
    const deleteEditor = screen.getByRole('dialog', { name: 'Edit run' });
    await user.click(within(deleteEditor).getByRole('button', { name: 'Delete run' }));
    const confirmation = screen.getByRole('dialog', { name: 'Delete this run?' });
    await user.click(within(confirmation).getByRole('button', { name: 'Keep activity' }));
    expect(screen.getByRole('dialog', { name: 'Edit run' })).toBeTruthy();
    await user.click(within(deleteEditor).getByRole('button', { name: 'Delete run' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Delete this run?' }))
      .getByRole('button', { name: 'Delete run' }));

    await waitFor(() => expect(within(screen.getByRole('region', { name: 'All Activities' }))
      .getByText('2')).toBeTruthy());
    expect(within(screen.getByRole('region', { name: 'All Activities' })).getByText('9')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'All Activities' })).getByText('mi')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Latest Activity' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Open latest run details for 5 miles/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Open run details for 6 miles/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Open run details for 4 miles/ })).toBeTruthy();
  });

  it('names missing Cardio setup and distinguishes it from insufficient completed-week history', async () => {
    const user = userEvent.setup();
    renderCardio();
    expect(screen.getByText(
      'Set a tracking start date and weekly Run and distance goals in Activity insights settings.'
    )).toBeTruthy();
    expect(screen.queryByText(/Set up tracking to see your scores/)).toBeNull();
    expect(screen.queryByText(/Set both weekly run and mileage goals/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Cardio tracking settings' }));
    const settings = screen.getByRole('dialog', { name: 'Cardio goals' });
    expect(settings.classList.contains('dialog--phone-fullscreen')).toBe(true);
    expect(settings.querySelector('.fitness-goals-scroll')).toBeTruthy();
    expect(within(settings).getByRole('button', { name: 'Save goals' })).toBeTruthy();
    expect(within(settings).getByRole('button', { name: 'Cancel' })).toBeTruthy();

    cleanup();
    const data: CardioData = saveCardioGoals(createCardioData(), {
      weeklyRunTarget: 2,
      weeklyMileTarget: 8
    }, '2026-10-22', '2026-10-19');
    renderCardio(data);
    expect(screen.getByText(
      'Complete one Monday–Sunday week with saved run and distance goals before a Cardio Health score is available. Cardio Health uses your run logs and weekly goals.'
    )).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Show Cardio Health scoring details' }));
    const dialog = screen.getByRole('dialog', { name: 'Cardio Health details' });
    const details = screen.getByRole('region', { name: 'Cardio Health scoring details' });
    const breakdown = within(details).getByRole('region', { name: 'Cardio Health scoring details score summary' });
    expect(within(breakdown).getByRole('heading', { name: 'Consistency' })).toBeTruthy();
    expect(within(breakdown).getByRole('heading', { name: 'On Track' })).toBeTruthy();
    expect(within(details).getByText('Follow-through over time')).toBeTruthy();
    expect(within(details).getByText('How up to date you are')).toBeTruthy();
    expect(within(details).queryByText(/four most recently completed weeks/)).toBeNull();
    expect(within(details).queryByText(/This week’s run and distance goal progress/)).toBeNull();
    expect(within(details).getByText('75%')).toBeTruthy();
    expect(within(details).getByText('25%')).toBeTruthy();
    expect(within(details).queryByText(/training interval/i)).toBeNull();
    await user.click(within(details).getByRole('button', { name: 'How this Cardio Foundation was scored' }));
    expect(within(details).getByText(/Monday–Sunday weeks with known targets/)).toBeTruthy();
    await user.click(within(details).getByRole('button', { name: 'How this Cardio Foundation contributes' }));
    await user.click(within(dialog).getByRole('button', { name: 'About Cardio scoring' }));
    const scoringDialog = screen.getByRole('dialog', { name: 'Cardio scoring' });
    expect(within(scoringDialog).getByText(
      'Your Cardio Health comes from logged runs and weekly goals. Tending a Rhythm alone doesn’t count as a run.'
    )).toBeTruthy();
  });

  it('saves and clears complete weekly goals while rejecting a partial pair', async () => {
    const user = userEvent.setup();
    const { onChange } = renderCardio();
    await user.click(screen.getByRole('button', { name: 'Cardio tracking settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Cardio goals' });
    expect(dialog.classList.contains('dialog--phone-fullscreen')).toBe(true);
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
    await user.click(screen.getByRole('button', { name: 'Cardio tracking settings' }));
    const edit = screen.getByRole('dialog', { name: 'Cardio goals' });
    await user.clear(within(edit).getByLabelText('Miles per week'));
    await user.click(within(edit).getByRole('button', { name: 'Save goals' }));
    expect(screen.getByRole('alert').textContent).toContain('both weekly');
    expect(next).not.toHaveBeenCalled();
  });

  it('uses labeled integrated steppers for blank and fractional weekly goals', async () => {
    const user = userEvent.setup();
    const { onChange } = renderCardio();
    await user.click(screen.getByRole('button', { name: 'Cardio tracking settings' }));
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
    await user.click(screen.getByRole('button', { name: 'Cardio tracking settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Cardio goals' });
    const runs = within(dialog).getByLabelText('Runs per week') as HTMLInputElement;
    await user.type(runs, '0');
    await user.click(within(dialog).getByRole('button', { name: 'Save goals' }));
    expect(runs.value).toBe('0');
    expect(runs.getAttribute('aria-invalid')).toBe('true');
    expect(within(dialog).getByText('Enter 1 to 21 runs per week.')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('logs a date-only run without focusing the date field and restores focus after Cancel or Escape', async () => {
    const user = userEvent.setup();
    const { onChange } = renderCardio();
    const opener = screen.getByRole('button', { name: 'Add activity' });
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Log activity' });
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: 'Log activity' }));
    await user.selectOptions(within(dialog).getByLabelText('Activity type'), 'run');
    expect(document.activeElement).not.toBe(within(dialog).getByLabelText('Activity date'));
    expect(within(dialog).queryByLabelText(/time/i)).toBeNull();
    await user.type(within(dialog).getByLabelText('Distance (miles)'), '3');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);

    await user.click(opener);
    const retry = screen.getByRole('dialog', { name: 'Log activity' });
    await user.selectOptions(within(retry).getByLabelText('Activity type'), 'run');
    await user.type(within(retry).getByLabelText('Distance (miles)'), '3');
    fireEvent(retry, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);

    await user.click(opener);
    const savedDialog = screen.getByRole('dialog', { name: 'Log activity' });
    await user.selectOptions(within(savedDialog).getByLabelText('Activity type'), 'run');
    await user.type(within(savedDialog).getByLabelText('Distance (miles)'), '3');
    await user.click(within(savedDialog).getByRole('button', { name: 'Save activity' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0].runs[0]).toMatchObject({
      date: '2026-10-22',
      distance: 3
    });
    expect(document.activeElement).toBe(opener);
  });

  it('requires an explicit Run or Walk type and preserves Walks without run calorie estimates', async () => {
    const user = userEvent.setup();
    const { onChange } = renderCardio();
    await user.click(screen.getByRole('button', { name: 'Add activity' }));
    const dialog = screen.getByRole('dialog', { name: 'Log activity' });

    await user.type(within(dialog).getByLabelText('Distance (miles)'), '2');
    await user.click(within(dialog).getByRole('button', { name: 'Save activity' }));
    expect(onChange).not.toHaveBeenCalled();

    await user.selectOptions(within(dialog).getByLabelText('Activity type'), 'walk');
    expect(within(dialog).getAllByText('—').length).toBeGreaterThanOrEqual(2);
    await user.click(within(dialog).getByRole('button', { name: 'Save activity' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0].runs[0]).toMatchObject({
      date: '2026-10-22',
      distance: 2,
      activityType: 'walk'
    });
  });

  it('calculates and saves optional run duration and pace in the selected distance unit', async () => {
    const user = userEvent.setup();
    const { onChange } = renderCardio();
    await user.click(screen.getByRole('button', { name: 'Add activity' }));
    const dialog = screen.getByRole('dialog', { name: 'Log activity' });
    await user.selectOptions(within(dialog).getByLabelText('Activity type'), 'run');

    await user.selectOptions(within(dialog).getByLabelText('Distance unit'), 'km');
    await user.type(within(dialog).getByLabelText('Distance (kilometers)'), '10');
    await user.type(within(dialog).getByLabelText('Hours'), '1');
    expect(within(dialog).getByText('6:00 per kilometer')).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Save activity' }));
    expect(onChange.mock.calls[0]?.[0].runs[0]).toMatchObject({
      distanceUnit: 'km',
      durationSeconds: 3600
    });
    expect(Number((onChange.mock.calls[0]?.[0].runs[0] as { distance: number }).distance))
      .toBeCloseTo(10 / 1.609344, 5);
  });

  it('estimates calories with the latest non-future weigh-in, explains the formula, and saves its snapshot', async () => {
    const user = userEvent.setup();
    const weightData: WeightData = {
      ...createWeightData(),
      displayUnit: 'kg',
      weighIns: [
        { id: 'before-run', date: '2026-10-21', weightKg: 70 },
        { id: 'after-run', date: '2026-10-23', weightKg: 90 }
      ]
    };
    const { onChange } = renderCardio(createCardioData(), { weightData });
    await user.click(screen.getByRole('button', { name: 'Add activity' }));
    const dialog = screen.getByRole('dialog', { name: 'Log activity' });
    await user.selectOptions(within(dialog).getByLabelText('Activity type'), 'run');
    await user.type(within(dialog).getByLabelText('Distance (miles)'), '5');

    expect(within(dialog).getByText('563 kcal')).toBeTruthy();
    expect(within(dialog).getByText(/Using 70 kg recorded on Oct 21, 2026/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Save activity' }));
    expect(onChange.mock.calls[0]?.[0].runs[0]).toMatchObject({
      calorieEstimate: {
        source: 'estimated',
        method: 'distance-weight-v1',
        weightKg: 70,
        weightSource: 'weigh-in',
        weightDate: '2026-10-21',
        weightMeasurementId: 'before-run'
      }
    });

    cleanup();
    renderCardio(createCardioData(), { weightData });
    await user.click(screen.getByRole('button', { name: 'Add activity' }));
    const helpDialog = screen.getByRole('dialog', { name: 'Log activity' });
    await user.selectOptions(within(helpDialog).getByLabelText('Activity type'), 'run');
    await user.click(helpDialog.querySelector('.cardio-calorie-estimate__help summary')!);
    expect(within(helpDialog).getByText(/rough gross-energy estimate, not active calories/)).toBeTruthy();
    expect(within(helpDialog).getByText(/age, incline, and pace are not used/)).toBeTruthy();
  });

  it('uses the separate estimate-weight setting and keeps manual weight out of the activity editor', async () => {
    const user = userEvent.setup();
    const { onChange } = renderCardio();
    await user.click(screen.getByRole('button', { name: 'Cardio tracking settings' }));
    const settings = screen.getByRole('dialog', { name: 'Cardio goals' });
    await user.type(within(settings).getByLabelText('Estimate weight'), '154');
    await user.click(within(settings).getByRole('button', { name: 'Save goals' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      estimateWeight: { weightKg: expect.any(Number), unit: 'lb' }
    }));

    cleanup();
    const estimateData = onChange.mock.calls[0]?.[0];
    const rerendered = renderCardio(estimateData);
    await user.click(screen.getByRole('button', { name: 'Add activity' }));
    const dialog = screen.getByRole('dialog', { name: 'Log activity' });
    await user.selectOptions(within(dialog).getByLabelText('Activity type'), 'run');
    await user.type(within(dialog).getByLabelText('Distance (miles)'), '5');
    expect(within(dialog).queryByLabelText(/Body weight for estimate/)).toBeNull();
    expect(within(dialog).getByText(/Using saved estimate weight 154 lb/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Save activity' }));
    const savedRun = rerendered.onChange.mock.calls[0]?.[0].runs[0];
    expect(isCardioRun(savedRun)).toBe(true);
    if (!isCardioRun(savedRun)) return;
    expect(savedRun.calorieEstimate).toMatchObject({
      source: 'estimated',
      method: 'distance-weight-v1',
      weightSource: 'manual'
    });
    expect(savedRun.calorieEstimate?.weightKg).toBeCloseTo(69.853, 2);
  });

  it('compares distance with the previous run and pace only with a similar-distance run in details', async () => {
    const user = userEvent.setup();
    const weightData: WeightData = {
      ...createWeightData(),
      weighIns: [{ id: 'run-weight', date: '2026-10-18', weightKg: 70 }]
    };
    const data: CardioData = {
      ...createCardioData(),
      runs: [
        { id: 'similar-run', date: '2026-10-19', distance: 6, durationSeconds: 3600 },
        { id: 'previous-run', date: '2026-10-21', distance: 3, durationSeconds: 1800 },
        { id: 'current-run', date: '2026-10-22', distance: 6.2, durationSeconds: 2976 }
      ]
    };
    renderCardio(data, { weightData });
    await user.click(screen.getByRole('button', { name: /Open latest run details for 6.2 miles/ }));
    const details = screen.getByRole('dialog', { name: 'Run details' });
    expect(details.textContent).toContain('Time');
    expect(details.textContent).toContain('Pace');
    expect(details.textContent).toContain('Pace uses the');
    expect(details.textContent).toContain('+3.2 mi');
    expect(details.textContent).toContain('2:00');
    expect(details.textContent).toContain('Faster');
    expect(details.textContent).toContain('+360 kcal');
    expect(details.textContent).toContain('Pace uses the 6 miles on October 19, 2026');
    await user.click(within(details).getByRole('button', { name: 'Close run details' }));
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
    await user.click(screen.getByRole('button', { name: /Open latest run details for 3 miles/ }));
    await user.click(within(screen.getByRole('dialog', { name: 'Run details' }))
      .getByRole('button', { name: 'Edit activity' }));
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
    await user.click(screen.getByRole('button', { name: /Open latest run details for 4 miles/ }));
    await user.click(within(screen.getByRole('dialog', { name: 'Run details' }))
      .getByRole('button', { name: 'Edit activity' }));
    const deleteEditor = screen.getByRole('dialog', { name: 'Edit run' });
    expect(document.activeElement).not.toBe(within(deleteEditor).getByLabelText('Activity date'));
    await user.click(within(deleteEditor).getByRole('button', { name: 'Delete run' }));
    const confirmation = screen.getByRole('dialog', { name: 'Delete this run?' });
    await user.click(within(confirmation).getByRole('button', { name: 'Delete run' }));
    expect(deleteChange.mock.calls[0]![0].runs).toEqual([
      expect.objectContaining({ id: 'untouched-run', distance: 2 })
    ]);
  });

  it('retains the run draft when persistence fails', async () => {
    const user = userEvent.setup();
    const { onChange } = renderCardio(createCardioData(), { saveError: 'Synthetic write failed.' });

    await user.click(screen.getByRole('button', { name: /Add activity/ }));
    const dialog = screen.getByRole('dialog', { name: 'Log activity' });
    await user.selectOptions(within(dialog).getByLabelText('Activity type'), 'run');
    const distance = within(dialog).getByLabelText('Distance (miles)');
    await user.type(distance, '4.5');
    await user.click(within(dialog).getByRole('button', { name: 'Save activity' }));
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
    const dialog = await screen.findByRole('dialog', { name: 'Log activity' });
    expect((within(dialog).getByLabelText('Cardio Rhythm (optional)') as HTMLSelectElement).value).toBe(rhythm.id);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(onLogRequestClosed).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(opener);
  });
});
