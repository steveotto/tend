import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CardioView } from '../src/components/CardioView.tsx';
import { createCardioData, isCardioRun, saveCardioGoals } from '../src/domain/cardio.ts';
import type { CardioData } from '../src/domain/cardio.ts';
import { createWeightData } from '../src/domain/weight.ts';
import type { WeightData } from '../src/domain/weight.ts';
import { todayRhythms } from '../src/domain/preview-data.ts';
import type { RhythmPreview } from '../src/domain/preview-data.ts';

afterEach(() => {
  cleanup();
  document.querySelectorAll('[data-test-cardio-opener]').forEach(element => element.remove());
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

describe('Cardio preview presentation', () => {
  it('organizes the Foundation into keyboard-operable Progress, Activities, and Rhythms panels', async () => {
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
    const progress = within(tabs).getByRole('tab', { name: 'Progress' });
    const activities = within(tabs).getByRole('tab', { name: 'Activities' });
    const rhythms = within(tabs).getByRole('tab', { name: 'Rhythms' });
    expect(progress.getAttribute('aria-selected')).toBe('true');
    expect(progress.getAttribute('tabindex')).toBe('0');
    expect(activities.getAttribute('tabindex')).toBe('-1');
    expect(screen.getByRole('tabpanel', { name: 'Progress' })).toBeTruthy();
    expect(within(insights).getByText('Explore your activity and weekly progress.')).toBeTruthy();
    expect(within(insights).getByText(
      'Cardio Health uses run logs and saved weekly goals. Completing a Rhythm without a saved run adds no Cardio credit.'
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
    await user.click(screen.getByRole('button', { name: 'Log run' }));
    expect(screen.getByRole('dialog', { name: 'Log run' })).toBeTruthy();
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

  it('preserves active tab selection and routes explicit Rhythm logging to Activities', async () => {
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
    expect(screen.getByRole('dialog', { name: 'Log run' })).toBeTruthy();
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

  it('shows separate weekly run/mileage measures, expandable score, today strip, and all historical runs', async () => {
    const user = userEvent.setup();
    const data = saveCardioGoals({
      ...createCardioData(),
      runs: [
        { id: 'run-this-week', date: '2026-10-22', distance: 3, notes: 'Treadmill' },
        { id: 'run-prior-week', date: '2026-10-16', distance: 5, notes: 'Track session' }
      ]
    }, { weeklyRunTarget: 2, weeklyMileTarget: 8 }, '2026-10-22', '2026-10-19');
    const { container } = renderCardio(data);
    const controls = screen.getByRole('group', { name: 'Cardio tracking controls' });
    expect(within(controls).getByRole('button', { name: 'Cardio tracking settings' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Set up tracking' })).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Weekly cardio and run history' }))
      .getAllByRole('button', { name: 'Log run' })).toHaveLength(1);
    expect(screen.getByText('Runs this week')).toBeTruthy();
    expect(screen.getByText('Miles this week')).toBeTruthy();
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
    expect(screen.getByText('Oct 16, 2026')).toBeTruthy();
    expect(screen.getByText('Oct 22, 2026')).toBeTruthy();
    const historyList = container.querySelector('.cardio-history-list');
    expect(historyList?.textContent).toContain('3 miles');
    expect(historyList?.textContent).not.toContain('Treadmill');
    expect(historyList?.textContent).not.toContain('Track session');
    expect(historyList?.textContent).toContain('Duration');
    expect(historyList?.textContent).toContain('Average pace');
    expect(historyList?.textContent).toContain('Estimated Calories');
    expect(historyList?.textContent).toContain('Unavailable');
    expect(historyList?.querySelectorAll('.cardio-history-actions button')).toHaveLength(2);
    expect([...historyList!.querySelectorAll('.cardio-history-actions button')]
      .every(button => button.textContent === 'Edit')).toBe(true);
    expect(screen.getByRole('meter', { name: 'Runs this week' }).getAttribute('aria-valuenow')).toBe('50');
    expect(screen.getByRole('meter', { name: 'Miles this week' }).getAttribute('aria-valuenow')).toBe('37.5');
  });

  it('names missing Cardio setup and distinguishes it from insufficient completed-week history', async () => {
    const user = userEvent.setup();
    renderCardio();
    expect(screen.getByText(
      'Set a Cardio tracking start date and save weekly run and distance goals. Cardio Health uses your run logs and saved goals.'
    )).toBeTruthy();
    expect(screen.queryByText(/Set up tracking to see your scores/)).toBeNull();
    expect(screen.queryByText(/Set both weekly run and mileage goals/)).toBeNull();
    const controls = screen.getByRole('group', { name: 'Cardio tracking controls' });
    await user.click(within(controls).getByRole('button', { name: 'Cardio tracking settings' }));
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
    expect(within(scoringDialog).getByText(/Cardio Health uses run logs and saved weekly goals/)).toBeTruthy();
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
    const opener = screen.getByRole('button', { name: 'Log run' });
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Log run' });
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: 'Log run' }));
    expect(document.activeElement).not.toBe(within(dialog).getByLabelText('Activity date'));
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

  it('calculates and saves optional run duration and pace in the selected distance unit', async () => {
    const user = userEvent.setup();
    const { onChange } = renderCardio();
    await user.click(screen.getByRole('button', { name: 'Log run' }));
    const dialog = screen.getByRole('dialog', { name: 'Log run' });

    await user.selectOptions(within(dialog).getByLabelText('Distance unit'), 'km');
    await user.type(within(dialog).getByLabelText('Distance (kilometers)'), '10');
    await user.type(within(dialog).getByLabelText('Hours'), '1');
    expect(within(dialog).getByText('6:00 per kilometer')).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Save run' }));
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
    await user.click(screen.getByRole('button', { name: 'Log run' }));
    const dialog = screen.getByRole('dialog', { name: 'Log run' });
    await user.type(within(dialog).getByLabelText('Distance (miles)'), '5');

    expect(within(dialog).getByText('563 kcal')).toBeTruthy();
    expect(within(dialog).getByText(/Using 70 kg recorded on Oct 21, 2026/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Save run' }));
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
    await user.click(screen.getByRole('button', { name: 'Log run' }));
    const helpDialog = screen.getByRole('dialog', { name: 'Log run' });
    await user.click(helpDialog.querySelector('.cardio-calorie-estimate__help summary')!);
    expect(within(helpDialog).getByText(/gross energy expenditure, not active calories/)).toBeTruthy();
    expect(within(helpDialog).getByText(/does not use age or height/)).toBeTruthy();
  });

  it('allows a manual weight when no dated measurement exists and keeps calories unavailable when omitted', async () => {
    const user = userEvent.setup();
    const { onChange } = renderCardio();
    await user.click(screen.getByRole('button', { name: 'Log run' }));
    const dialog = screen.getByRole('dialog', { name: 'Log run' });
    await user.type(within(dialog).getByLabelText('Distance (miles)'), '5');
    expect(within(dialog).getByText('Unavailable')).toBeTruthy();
    await user.type(within(dialog).getByLabelText('Body weight for estimate (lb)'), '154');
    expect(within(dialog).getByText(/Using manually entered 154 lb/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Save run' }));
    const savedRun = onChange.mock.calls[0]?.[0].runs[0];
    expect(isCardioRun(savedRun)).toBe(true);
    if (!isCardioRun(savedRun)) return;
    expect(savedRun.calorieEstimate).toMatchObject({
      source: 'estimated',
      method: 'distance-weight-v1',
      weightSource: 'manual'
    });
    expect(savedRun.calorieEstimate?.weightKg).toBeCloseTo(69.853, 2);
  });

  it('compares distance with the previous run and pace with the similar-distance run', () => {
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
    const { container } = renderCardio(data, { weightData });
    const latestRun = container.querySelector('.cardio-history-list li');
    expect(latestRun?.textContent).toContain('Average pace');
    expect(latestRun?.textContent).toContain('Pace vs similar-distance run');
    expect(latestRun?.textContent).toContain('▲ +3.2 mi');
    expect(latestRun?.textContent).toContain('▲ 2:00 faster');
    expect(latestRun?.textContent).toContain('▲ +360 kcal');
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
    const runCard = screen.getByRole('button', { name: /Edit run from Oct 22/ });
    expect(screen.queryByRole('button', { name: /Delete run from Oct 22/ })).toBeNull();
    await user.click(runCard);
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
