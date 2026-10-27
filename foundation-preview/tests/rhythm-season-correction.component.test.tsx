import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RhythmSeasonCorrectionDialog } from '../src/components/RhythmSeasonCorrectionDialog.tsx';
import { todayRhythms } from '../src/domain/preview-data.ts';
import type { RhythmCompletionRecord } from '../src/domain/rhythm-completion.ts';
import type { RhythmScheduleHistorySegment, RhythmScoringMetadata } from '../src/domain/rhythm-schedule.ts';
import { selectRhythmScore } from '../src/domain/rhythm-scoring.ts';
import type { SelectRhythmScoreInput } from '../src/domain/rhythm-scoring.ts';
import type { RhythmSeasonEditDraft, RhythmSeasonEditTarget } from '../src/domain/rhythm-season-edit.ts';
import { createRhythmSeason, createUnknownRhythmSeason } from '../src/domain/rhythm-seasons.ts';

const rhythmId = 'season-correction-impact';
const daily = { frequency: 'daily' } as const;
const asOfDate = '2026-10-25';

function makeRecord(id: string, effectiveDate: string): RhythmCompletionRecord {
  return { id, rhythmId, effectiveDate };
}

function renderCorrection(
  scheduleHistory: readonly RhythmScheduleHistorySegment[],
  records: readonly RhythmCompletionRecord[],
  onSave: (draft: RhythmSeasonEditDraft) => string | null = () => null,
  createdLocalDate = '2026-10-01',
  targetSeason?: RhythmSeasonEditTarget,
  canDelete = false,
  onRequestDelete?: () => void
) {
  const latestSeason = scheduleHistory.at(-1)!;
  const schedule = latestSeason.kind === 'scheduled' ? latestSeason.schedule : daily;
  const scoring: RhythmScoringMetadata = {
    trackingStartDate: scheduleHistory.find(segment => segment.kind === 'scheduled')?.startDate
      ?? scheduleHistory[0]!.startDate,
    timeZone: 'UTC',
    scheduleHistory: [...scheduleHistory]
  };
  const scoringInput: SelectRhythmScoreInput = {
    rhythmId,
    schedule,
    scoring,
    records,
    recordsAvailable: true,
    asOfDate,
    timeZone: 'UTC',
    createdLocalDate,
    createdTimeZone: 'UTC'
  };
  const rhythm = {
    ...todayRhythms[0]!,
    id: rhythmId,
    title: 'Season correction impact',
    schedule,
    scoring
  };
  render(
    <RhythmSeasonCorrectionDialog
      rhythm={rhythm}
      season={targetSeason ?? latestSeason}
      scoringInput={scoringInput}
      records={records}
      canDelete={canDelete}
      onSave={onSave}
      onClose={() => {}}
      {...(onRequestDelete ? { onRequestDelete: () => onRequestDelete() } : {})}
    />
  );
}

function renderDisplayOnlyCurrentSeason(
  records: readonly RhythmCompletionRecord[],
  onSave: (draft: RhythmSeasonEditDraft) => string | null = () => null
) {
  const schedule = { frequency: 'daily' } as const;
  const season: RhythmSeasonEditTarget = {
    kind: 'scheduled',
    id: `current-schedule:${rhythmId}`,
    schedule,
    timeOfDay: 'anytime',
    paletteToken: 'fern'
  };
  const scoringInput: SelectRhythmScoreInput = {
    rhythmId,
    schedule,
    records,
    recordsAvailable: true,
    asOfDate,
    timeZone: 'UTC',
    createdLocalDate: '2026-10-01',
    createdTimeZone: 'UTC'
  };
  const rhythm = {
    ...todayRhythms[0]!,
    id: rhythmId,
    title: 'Season correction impact',
    schedule,
    timeOfDay: 'anytime' as const
  };
  render(
    <RhythmSeasonCorrectionDialog
      rhythm={rhythm}
      season={season}
      scoringInput={scoringInput}
      records={records}
      canDelete={false}
      onSave={onSave}
      onClose={() => {}}
    />
  );
}

function renderNewSeason(
  scheduleHistory: readonly RhythmScheduleHistorySegment[],
  onSave: (draft: RhythmSeasonEditDraft) => string | null = () => null,
  records: readonly RhythmCompletionRecord[] = []
) {
  const current = scheduleHistory.at(-1);
  if (current?.kind !== 'scheduled' || !current.timeOfDay) {
    throw new Error('Fixture needs a scheduled current Season with a time of day.');
  }
  const scoring: RhythmScoringMetadata = {
    trackingStartDate: scheduleHistory.find(segment => segment.kind === 'scheduled')!.startDate,
    timeZone: 'UTC',
    scheduleHistory: [...scheduleHistory]
  };
  const season: RhythmSeasonEditTarget = {
    kind: 'scheduled',
    id: `new-season:${rhythmId}`,
    schedule: current.schedule,
    timeOfDay: current.timeOfDay,
    paletteToken: current.paletteToken
  };
  const scoringInput: SelectRhythmScoreInput = {
    rhythmId,
    schedule: current.schedule,
    scoring,
    records,
    recordsAvailable: true,
    asOfDate,
    timeZone: 'UTC'
  };
  render(
    <RhythmSeasonCorrectionDialog
      rhythm={{ ...todayRhythms[0]!, id: rhythmId, schedule: current.schedule, scoring }}
      season={season}
      scoringInput={scoringInput}
      records={records}
      canDelete={false}
      onSave={onSave}
      onClose={() => {}}
    />
  );
}

async function choose(user: ReturnType<typeof userEvent.setup>, label: string, option: string) {
  const trigger = screen.getByRole('combobox', { name: new RegExp(`^${label}:`) });
  await user.click(trigger);
  await user.click(screen.getByRole('option', { name: option }));
}

function scoreValue(metric: string, side: 'Before' | 'After'): string | undefined {
  const cell = screen.getByRole('group', { name: `${side} ${metric}` });
  return cell.querySelector('.rhythm-season-impact__score strong')?.textContent;
}

function proposedSummaryText(): string {
  const comparison = screen.getByRole('group', { name: 'Saved and proposed schedules' });
  const proposed = within(comparison).getByText('Proposed').parentElement?.textContent ?? '';
  const effectiveRange = document.querySelector('.rhythm-season-correction__effective-range')?.textContent ?? '';
  return `${proposed} ${effectiveRange}`;
}

function savedSummaryText(): string {
  const comparison = screen.getByRole('group', { name: 'Saved and proposed schedules' });
  return within(comparison).getByText('Saved').parentElement?.textContent ?? '';
}

function comparisonSummaryText(): string {
  const comparison = screen.getByRole('group', { name: 'Saved and proposed schedules' });
  return comparison.textContent ?? '';
}

function comesBefore(first: Element, second: Element): boolean {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

afterEach(cleanup);

describe('shared Season correction score preview', () => {
  it('keeps an invalid first-Season start draft and identifies the earliest logged date', async () => {
    const user = userEvent.setup();
    const first = createRhythmSeason(rhythmId, '2026-10-01', daily, 'morning', 'season-first');
    const current = createRhythmSeason(rhythmId, '2026-10-20', daily, 'evening', 'season-current');
    const records = [makeRecord('first-log', '2026-10-10')];
    renderCorrection([first, current], records, () => null, '2026-10-01', first);
    const startDate = screen.getByLabelText('Starting date');

    fireEvent.change(startDate, { target: { value: '2026-10-11' } });

    expect(screen.getByRole('alert').textContent)
      .toBe('The first Season cannot start after the earliest logged moment (2026-10-10).');
    expect(startDate).toHaveProperty('value', '2026-10-11');
    await user.clear(startDate);
    fireEvent.change(startDate, { target: { value: '2026-10-09' } });
    expect(screen.queryByText(/cannot start after the earliest logged moment/)).toBeNull();
    expect(startDate).toHaveProperty('value', '2026-10-09');
  });

  it('previews an Add Season range with one score column and no disclosure when no activity is in range', async () => {
    const user = userEvent.setup();
    const current = createRhythmSeason(rhythmId, '2026-10-01', daily, 'morning', 'season-current');
    const onSave = vi.fn(() => null);
    renderNewSeason([current], onSave, [
      makeRecord('outside-before', '2026-10-10'),
      makeRecord('future', '2026-10-28')
    ]);

    expect(screen.getByRole('dialog', { name: 'Add a season' })).toBeTruthy();
    expect(screen.getByText('Set a schedule for a date range. Existing seasons will adjust to fit.')).toBeTruthy();
    expect(screen.getByLabelText('Starting date')).toHaveProperty('value', asOfDate);
    await user.clear(screen.getByLabelText('Starting date'));
    fireEvent.change(screen.getByLabelText('Starting date'), { target: { value: '2026-10-17' } });
    await user.click(screen.getByLabelText('Set an end date'));
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-10-20' } });

    expect(screen.getByText('Scheduled season will be split.')).toBeTruthy();
    const impact = screen.getByRole('region', { name: 'Score impact preview' });
    expect(within(impact).getByRole('heading', { name: 'Score' })).toBeTruthy();
    expect(within(impact).queryByRole('heading', { name: 'Before' })).toBeNull();
    expect(within(impact).queryByRole('heading', { name: 'After' })).toBeNull();
    expect(within(impact).getByText('No recorded activity in this date range.')).toBeTruthy();
    expect(within(impact).queryByText('Why the scores change')).toBeNull();
    expect(within(impact).queryByText(/No score change|produces the same scores/)).toBeNull();
    expect(screen.queryByText('Affected historical scores may change.')).toBeNull();
    expect(screen.queryByText('No recorded activity is affected.')).toBeNull();
    expect(screen.getByRole('group', { name: 'New season schedule' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Saved and proposed schedules' })).toBeNull();
    for (const metric of ['Consistency', 'On Track', 'Health']) {
      expect(within(impact).getByRole('group', { name: `Score ${metric}` })
        .querySelector('.rhythm-season-impact__score strong')?.textContent).toBe('—');
    }
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      segmentId: `new-season:${rhythmId}`,
      startDate: '2026-10-17',
      endDate: '2026-10-20'
    }));
  });

  it('scores only recorded activity inside an Add Season range and ignores future/out-of-range logs', async () => {
    const user = userEvent.setup();
    const current = createRhythmSeason(rhythmId, '2026-10-01', daily, 'morning', 'season-current');
    renderNewSeason([current], () => null, [
      makeRecord('outside-before', '2026-10-10'),
      makeRecord('inside', '2026-10-19'),
      makeRecord('future', '2026-10-28')
    ]);
    await user.clear(screen.getByLabelText('Starting date'));
    fireEvent.change(screen.getByLabelText('Starting date'), { target: { value: '2026-10-17' } });
    await user.click(screen.getByLabelText('Set an end date'));
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-10-20' } });
    await choose(user, 'Frequency', 'Weekly');
    await user.click(screen.getByRole('radio', { name: 'Monday' }));

    const impact = screen.getByRole('region', { name: 'Score impact preview' });
    expect(within(impact).getByRole('heading', { name: 'Score' })).toBeTruthy();
    expect(within(impact).queryByRole('heading', { name: 'Before' })).toBeNull();
    expect(within(impact).queryByText('No recorded activity in this date range.')).toBeNull();
    expect(within(impact).getByRole('group', { name: 'Score Consistency' }).textContent).toContain('100');
    expect(within(impact).getByRole('group', { name: 'Score On Track' })
      .querySelector('.rhythm-season-impact__score strong')?.textContent).not.toBe('—');
    expect(within(impact).queryByText('Why the scores change')).toBeNull();
    expect(screen.getByText('Affected historical scores may change.')).toBeTruthy();
  });

  it('does not score future-only activity in a future Add Season range', async () => {
    const user = userEvent.setup();
    const current = createRhythmSeason(rhythmId, '2026-10-01', daily, 'morning', 'season-current');
    renderNewSeason([current], () => null, [makeRecord('future', '2026-10-29')]);
    await user.clear(screen.getByLabelText('Starting date'));
    fireEvent.change(screen.getByLabelText('Starting date'), { target: { value: '2026-10-28' } });
    await user.click(screen.getByLabelText('Set an end date'));
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-10-31' } });

    const impact = screen.getByRole('region', { name: 'Score impact preview' });
    expect(within(impact).getByText('No activity in this date range is eligible to score yet.')).toBeTruthy();
    for (const metric of ['Consistency', 'On Track', 'Health']) {
      expect(within(impact).getByRole('group', { name: `Score ${metric}` })
        .querySelector('.rhythm-season-impact__score strong')?.textContent).toBe('—');
    }
    expect(screen.queryByText('Affected historical scores may change.')).toBeNull();
  });

  it('shows the earlier-scoring warning only for a valid extending draft and retains it after a failed Apply', async () => {
    const user = userEvent.setup();
    const current = createRhythmSeason(rhythmId, '2026-10-01', daily, 'morning', 'season-current');
    const onSave = vi.fn(() => 'Synthetic persistence failure.');
    renderNewSeason([current], onSave);

    expect(screen.queryByText('This adds earlier scheduled dates to your scores. Dates without a log will count as missed.')).toBeNull();
    await user.clear(screen.getByLabelText('Starting date'));
    fireEvent.change(screen.getByLabelText('Starting date'), { target: { value: '2026-09-01' } });
    expect(screen.getByText('This adds earlier scheduled dates to your scores. Dates without a log will count as missed.')).toBeTruthy();
    expect(screen.getByText('Earlier scheduled range: Sep 1, 2026 – Sep 30, 2026.')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Synthetic persistence failure.')).toBeTruthy();
    expect(screen.getByText('This adds earlier scheduled dates to your scores. Dates without a log will count as missed.')).toBeTruthy();
  });

  it('does not show an earlier-scoring warning when a draft starts at the existing tracking boundary', async () => {
    const user = userEvent.setup();
    const current = createRhythmSeason(rhythmId, '2026-10-01', daily, 'morning', 'season-current');
    const onSave = vi.fn(() => null);
    renderNewSeason([current], onSave);
    await user.clear(screen.getByLabelText('Starting date'));
    fireEvent.change(screen.getByLabelText('Starting date'), { target: { value: '2026-10-01' } });

    expect(screen.queryByText('This adds earlier scheduled dates to your scores. Dates without a log will count as missed.')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(current.startDate).toBe('2026-10-01');
  });

  it('shows the saved tracked score when there are no logs and keeps an invalid proposal unavailable', () => {
    const season = createRhythmSeason(rhythmId, '2026-10-17', daily);
    renderCorrection([season], [makeRecord('outside', '2026-10-10')]);
    const impact = screen.getByRole('region', { name: 'Score impact preview' });
    expect(within(impact).getByRole('columnheader', { name: 'Before' })).toBeTruthy();
    expect(within(impact).getByRole('columnheader', { name: 'After' })).toBeTruthy();
    expect(within(impact).getByText('No recorded activity in this date range.')).toBeTruthy();
    expect(screen.queryByText(/Before and After use the Rhythm scoring selector through the affected range end/))
      .toBeNull();
    expect(screen.queryByText(/Suggested starting date:/)).toBeNull();
    expect(within(impact).queryByText('Why the scores change')).toBeNull();
    expect(within(impact).getByRole('group', { name: 'Before Consistency' })
      .querySelector('.rhythm-season-impact__score strong')?.textContent).toBe('0');
    expect(within(impact).getByRole('group', { name: 'Before On Track' })
      .querySelector('.rhythm-season-impact__score strong')?.textContent).toBe('20');
    expect(within(impact).getByRole('group', { name: 'Before Health' })
      .querySelector('.rhythm-season-impact__score strong')?.textContent).toBe('5');
    for (const metric of ['Consistency', 'On Track', 'Health']) {
      expect(within(impact).getByRole('group', { name: `After ${metric}` }).textContent)
        .toContain('Proposed schedule is invalid.');
    }
  });

  it('preserves tracked missed scores when opening an unchanged historical Season draft', () => {
    const v2 = createRhythmSeason(
      rhythmId,
      '2026-08-01',
      { frequency: 'daily', endDate: '2026-09-30' },
      'morning',
      'season-v2',
      'plum'
    );
    const preDev = createRhythmSeason(
      rhythmId,
      '2026-10-01',
      { frequency: 'daily', endDate: '2026-10-13' },
      'morning',
      'season-pre-dev',
      'clay'
    );
    const selectDays = createRhythmSeason(
      rhythmId,
      '2026-10-17',
      { frequency: 'weekly', weekdays: [0, 2, 5, 6] },
      'morning',
      'season-selected-days',
      'ocean'
    );
    const current = createRhythmSeason(
      rhythmId,
      '2026-10-21',
      { frequency: 'daily', endDate: '2026-10-26' },
      'morning',
      'season-current',
      'sage'
    );
    const directScore = selectRhythmScore({
      rhythmId,
      schedule: v2.schedule,
      scoring: {
        trackingStartDate: v2.startDate,
        timeZone: 'UTC',
        scheduleHistory: [v2, preDev, selectDays, current]
      },
      records: [],
      recordsAvailable: true,
      asOfDate: '2026-09-30',
      timeZone: 'UTC',
      createdLocalDate: '2026-08-01',
      createdTimeZone: 'UTC'
    });
    expect(directScore).toMatchObject({
      kind: 'rhythm-score',
      consistency: {
        kind: 'scored',
        score: 0,
        evidence: { windowStartDate: '2026-09-01', windowEndDate: '2026-09-29', eligibleDueCount: 29, completedCount: 0 }
      },
      onTrack: { kind: 'scored', score: 0, evidence: { missedOccurrenceCount: 60 } },
      healthScore: 0
    });
    renderCorrection(
      [v2, preDev, selectDays, current],
      [
        makeRecord('oct-17', '2026-10-17'),
        makeRecord('oct-18', '2026-10-18'),
        makeRecord('oct-20', '2026-10-20')
      ],
      () => null,
      '2026-08-01',
      v2
    );

    const saved = screen.getByRole('region', { name: 'Your saved schedule' });
    expect(saved.querySelector('.rhythm-history-view__season-health-badge .ma-score__value')?.textContent)
      .toBe('0');
    expect(saved.querySelector('.rhythm-history-view__season-health-badge')?.getAttribute('aria-label'))
      .toBe('Season Health: 0 out of 100');
    expect(screen.getByLabelText('Starting date')).toHaveProperty('value', '2026-08-01');
    const impact = screen.getByRole('region', { name: 'Score impact preview' });
    for (const metric of ['Consistency', 'On Track', 'Health']) {
      expect(within(impact).getByRole('group', { name: `Before ${metric}` })
        .querySelector('.rhythm-season-impact__score strong')?.textContent).toBe('0');
      expect(within(impact).getByRole('group', { name: `After ${metric}` })
        .querySelector('.rhythm-season-impact__score strong')?.textContent).toBe('0');
    }

    cleanup();
    renderCorrection(
      [v2, preDev, selectDays, current],
      [
        makeRecord('oct-17', '2026-10-17'),
        makeRecord('oct-18', '2026-10-18'),
        makeRecord('oct-20', '2026-10-20')
      ],
      () => null,
      '2026-08-01',
      preDev
    );
    const preDevSaved = screen.getByRole('region', { name: 'Your saved schedule' });
    expect(preDevSaved.querySelector('.rhythm-history-view__season-health-badge .ma-score__value')?.textContent)
      .toBe('0');
    expect(screen.getByLabelText('Starting date')).toHaveProperty('value', '2026-10-01');
    const preDevImpact = screen.getByRole('region', { name: 'Score impact preview' });
    for (const metric of ['Consistency', 'On Track', 'Health']) {
      expect(within(preDevImpact).getByRole('group', { name: `Before ${metric}` })
        .querySelector('.rhythm-season-impact__score strong')?.textContent).toBe('0');
      expect(within(preDevImpact).getByRole('group', { name: `After ${metric}` })
        .querySelector('.rhythm-season-impact__score strong')?.textContent).toBe('0');
    }
  });

  it('keeps the known previous cadence and derives a complete current Season proposal from the controlled draft', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn((_draft: RhythmSeasonEditDraft) => null);
    renderDisplayOnlyCurrentSeason([
      makeRecord('later', '2026-10-20'),
      makeRecord('earliest', '2026-10-17')
    ], onSave);

    expect(document.activeElement).toBe(screen.getByLabelText('Season name (optional)'));
    expect(document.activeElement).not.toBe(screen.getByLabelText('Starting date'));
    const savedSchedule = screen.getByRole('region', { name: 'Your saved schedule' });
    expect(savedSchedule.textContent).toContain('Every day');
    expect(savedSchedule.querySelector('.rhythm-history-view__season-card-timeframe')?.textContent)
      .toBe('Start unknown – Present');
    expect(savedSchedule.querySelector('.rhythm-history-view__season-card-timeframe')?.getAttribute('aria-label'))
      .toBe('Start date not recorded – Present');
    expect(savedSchedule.querySelector('.rhythm-history-view__season-card')?.className)
      .toContain('rhythm-history-view__season-visual--fern');
    expect(savedSchedule.querySelector('button')).toBeNull();
    expect(screen.getByLabelText('Starting date')).toHaveProperty('value', '2026-10-17');
    await choose(user, 'Frequency', 'Weekly');
    await user.click(screen.getByRole('radio', { name: 'Monday' }));
    await user.type(screen.getByLabelText('Season name (optional)'), 'Special Season');
    expect(savedSchedule.textContent).toContain('Every day');
    expect(savedSchedule.textContent).not.toContain('Every week on Monday');
    await user.click(screen.getByLabelText('Set an end date'));

    const endDate = screen.getByLabelText('End date');
    expect(endDate).toHaveProperty('value', asOfDate);
    expect(screen.getAllByText('Oct 17, 2026 – Oct 25, 2026')).toHaveLength(2);
    expect(savedSummaryText()).toContain('Daily · Anytime');
    expect(comparisonSummaryText()).not.toContain('Special Season');
    const comparison = screen.getByRole('group', { name: 'Saved and proposed schedules' });
    expect(within(comparison).getByText('Saved')).toBeTruthy();
    expect(within(comparison).getByText('Proposed')).toBeTruthy();
    expect(comparison.textContent).not.toContain('will be replaced');
    const logSummary = document.querySelector('.rhythm-season-correction__log-summary > p')?.textContent ?? '';
    expect(logSummary).toMatch(/^All 2 logs stay saved · .*(count|credit)/);
    expect(proposedSummaryText()).toContain('Every week on Monday · Anytime');
    expect(proposedSummaryText()).toContain('Oct 17, 2026 – Oct 25, 2026');
    expect(document.querySelector('.rhythm-season-correction__effective-range')?.textContent)
      .toBe('Oct 17, 2026 – Oct 25, 2026');
    await choose(user, 'Time of day', 'Early morning');
    expect(proposedSummaryText()).toContain('Every week on Monday · Early morning');
    expect(document.querySelector('.rhythm-season-correction__effective-range')?.textContent)
      .toBe('Oct 17, 2026 – Oct 25, 2026');
    expect(screen.queryByText('Choose a complete, valid schedule to preview its impact.')).toBeNull();
    fireEvent.change(endDate, { target: { value: '2026-10-24' } });
    expect(proposedSummaryText()).toContain('Oct 17, 2026 – Oct 24, 2026');
    expect(screen.getAllByText('Oct 17, 2026 – Oct 24, 2026')).toHaveLength(2);
    fireEvent.change(endDate, { target: { value: '2026-10-29' } });
    expect(screen.getAllByText('Oct 17, 2026 – Oct 29, 2026')).toHaveLength(2);
    expect(screen.getByText(/All 2 logs stay saved ·/)).toBeTruthy();

    await user.click(screen.getByLabelText('Set an end date'));
    expect(screen.queryByLabelText('End date')).toBeNull();
    expect(proposedSummaryText()).toContain('Oct 17, 2026 – Present');
    expect(screen.getAllByText('Oct 17, 2026 – Present')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      startDate: '2026-10-17',
      schedule: { frequency: 'weekly', weekdays: [1] },
      timeOfDay: 'early-morning',
      name: 'Special Season'
    }));
  });

  it('identifies an empty enabled end date without hiding the selected cadence', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => null);
    renderDisplayOnlyCurrentSeason([makeRecord('earliest', '2026-10-17')], onSave);
    await choose(user, 'Frequency', 'Weekly');
    await user.click(screen.getByRole('radio', { name: 'Monday' }));
    await user.click(screen.getByLabelText('Set an end date'));
    const endDate = screen.getByLabelText('End date');
    fireEvent.change(endDate, { target: { value: '' } });

    expect(screen.getByRole('alert').textContent).toBe('Choose a valid end date.');
    expect(proposedSummaryText()).toContain('Every week on Monday');
    expect(proposedSummaryText()).toContain('Choose a valid end date');
    expect(screen.getAllByText('Choose a valid end date')).toHaveLength(2);
    expect(screen.queryByText('Choose a complete, valid schedule to preview its impact.')).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Score impact preview' }))
      .getByText(/The proposed schedule is invalid; On Track is unavailable/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows the display-only starting-date default in a nested accessible modal', async () => {
    const user = userEvent.setup();
    renderDisplayOnlyCurrentSeason([]);
    expect(screen.queryByText('Choose a starting date to establish this current Season.')).toBeNull();
    const hintButton = screen.getByRole('button', { name: 'Starting date help' });
    expect(hintButton.getAttribute('aria-haspopup')).toBe('dialog');
    expect(screen.queryByRole('dialog', { name: 'Starting date' })).toBeNull();

    await user.click(hintButton);
    const helpDialog = screen.getByRole('dialog', { name: 'Starting date' });
    expect(helpDialog.textContent).toContain(
      'Starting date defaults to the earliest logged moment, or today if there are no logs. Change it if this schedule began on a different date.'
    );
    fireEvent.keyDown(helpDialog, { key: 'Escape' });
    fireEvent(helpDialog, new Event('cancel', { bubbles: false, cancelable: true }));
    expect(screen.queryByRole('dialog', { name: 'Starting date' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Edit season' })).toBeTruthy();
  });

  it('keeps the correction fields in the requested order and summarizes the calculated affected dates', async () => {
    const user = userEvent.setup();
    const season = createRhythmSeason(rhythmId, '2026-10-01', daily);
    renderCorrection([season], [makeRecord('in-range', '2026-10-20')]);

    const name = screen.getByLabelText('Season name (optional)');
    const affectedDates = document.querySelector('.rhythm-season-correction__affected-dates strong')!;
    const startingDate = screen.getByLabelText('Starting date');
    const frequency = screen.getByRole('combobox', { name: /^Frequency:/ });
    const timeOfDay = screen.getByRole('combobox', { name: /^Time of day:/ });
    const endDate = screen.getByLabelText('Set an end date');
    const savedHeading = screen.getByRole('heading', { name: 'Your saved schedule' });
    const changeHeading = screen.getByRole('heading', { name: 'Make your changes' });
    const reviewHeading = screen.getByRole('heading', { name: 'Review the impact' });
    const comparison = screen.getByRole('group', { name: 'Saved and proposed schedules' });
    const effectiveRange = screen.getByLabelText(/^Affected dates:/);
    const impact = screen.getByRole('region', { name: 'Score impact preview' });
    const confirm = screen.getByRole('button', { name: 'Apply' });

    expect(comesBefore(savedHeading, changeHeading)).toBe(true);
    expect(comesBefore(changeHeading, reviewHeading)).toBe(true);
    expect(comesBefore(name, startingDate)).toBe(true);
    expect(comesBefore(startingDate, frequency)).toBe(true);
    expect(comesBefore(frequency, timeOfDay)).toBe(true);
    expect(comesBefore(timeOfDay, endDate)).toBe(true);
    expect(comesBefore(endDate, affectedDates)).toBe(true);
    expect(comesBefore(affectedDates, reviewHeading)).toBe(true);
    expect(comesBefore(reviewHeading, comparison)).toBe(true);
    expect(comesBefore(comparison, effectiveRange)).toBe(true);
    expect(comesBefore(effectiveRange, impact)).toBe(true);
    expect(comesBefore(impact, confirm)).toBe(true);

    await user.click(endDate);
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-10-20' } });
    expect(document.querySelector('.rhythm-season-correction__affected-dates strong')?.textContent)
      .toBe('Oct 1, 2026 – Oct 20, 2026');
  });

  it('presents the three editor steps with supporting descriptions and the current badge', () => {
    renderDisplayOnlyCurrentSeason([]);

    expect(screen.getByText('This is your current schedule for this season.')).toBeTruthy();
    expect(screen.getByText('Update the details for this season.')).toBeTruthy();
    expect(screen.getByText('See how your changes affect your data.')).toBeTruthy();
    expect(screen.getByText('Current')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.getByLabelText('Set an end date')).toBeTruthy();
  });

  it('orders Apply, Cancel, and optional Delete in both DOM and keyboard order', async () => {
    const user = userEvent.setup();
    const season = createRhythmSeason(rhythmId, '2026-10-01', daily);
    const onRequestDelete = vi.fn();
    renderCorrection([season], [], () => null, '2026-10-01', season, true, onRequestDelete);

    const actionBar = document.querySelector('.rhythm-season-correction__action-bar')!;
    const buttons = [...actionBar.querySelectorAll('button')];
    expect(buttons.map(button => button.textContent)).toEqual(['Apply', 'Cancel', 'Delete season']);
    expect(buttons.map(button => button.classList.contains('rhythm-season-correction__apply')))
      .toEqual([true, false, false]);

    buttons[0]!.focus();
    expect(document.activeElement).toBe(buttons[0]);
    await user.tab();
    expect(document.activeElement).toBe(buttons[1]);
    await user.tab();
    expect(document.activeElement).toBe(buttons[2]);
  });

  it('shows No change for matching scores and the calculated difference for changed scores', async () => {
    const user = userEvent.setup();
    const season = createRhythmSeason(rhythmId, '2026-10-01', daily);
    renderCorrection([season], [makeRecord('monday-log', '2026-10-19')]);

    const impact = screen.getByRole('region', { name: 'Score impact preview' });
    expect(within(impact).getByRole('columnheader', { name: 'Change' })).toBeTruthy();
    expect(document.querySelectorAll('.rhythm-season-impact__change')).toHaveLength(3);
    expect(document.querySelectorAll('.rhythm-season-impact__change').length).toBe(3);
    expect([...document.querySelectorAll('.rhythm-season-impact__change')].every(cell =>
      cell.textContent === 'No change'
    )).toBe(true);

    await choose(user, 'Frequency', 'Weekly');
    await user.click(screen.getByRole('radio', { name: 'Monday' }));
    const deltas = [...impact.querySelectorAll('.rhythm-season-impact__row--change')].map(row => {
      const scores = [...row.querySelectorAll('.rhythm-season-impact__score strong')]
        .map(score => Number(score.textContent));
      const difference = scores[1]! - scores[0]!;
      const expected = difference === 0
        ? 'No change'
        : `${difference > 0 ? '+' : '−'}${Math.abs(difference)}`;
      return {
        expected,
        displayed: row.querySelector('.rhythm-season-impact__change')?.textContent
      };
    });
    expect(deltas.some(delta => delta.expected !== 'No change')).toBe(true);
    for (const delta of deltas) expect(delta.displayed).toBe(delta.expected);
  });

  it('shows the selected earlier Season as a read-only saved baseline while its draft changes', async () => {
    const user = userEvent.setup();
    const earlier = {
      ...createRhythmSeason(rhythmId, '2026-10-01', daily, 'morning', 'season-earlier', 'clay'),
      name: 'Earlier pace'
    };
    const current = createRhythmSeason(
      rhythmId,
      '2026-10-20',
      { frequency: 'weekly', weekdays: [1, 3, 5] },
      'evening',
      'season-current',
      'fern'
    );
    renderCorrection([earlier, current], [], () => null, '2026-10-01', earlier);

    const saved = screen.getByRole('region', { name: 'Your saved schedule' });
    const card = saved.querySelector('.rhythm-history-view__season-card')!;
    expect(within(saved).getByRole('heading', { name: 'Earlier pace' })).toBeTruthy();
    expect(card.querySelector('.rhythm-history-view__season-card-timeframe')?.textContent)
      .toBe('Oct 1 – Oct 19, 2026');
    expect(card.querySelector('.rhythm-history-view__season-card-timeframe')?.getAttribute('aria-label'))
      .toBe('Oct 1, 2026 – Oct 19, 2026');
    expect(card.querySelector('.rhythm-history-view__season-current-badge')).toBeNull();
    expect(within(saved).getByRole('img', { name: 'Season Health: 0 out of 100' })
      .querySelector('.ma-score__value')?.textContent).toBe('0');
    expect(card.querySelector('button')).toBeNull();
    expect(saved.textContent).toContain('Every day');
    expect(saved.textContent).toContain('Morning');
    expect(savedSummaryText()).toBe('SavedDaily · Morning');
    expect(within(saved).getByRole('img', { name: 'Season Health: 0 out of 100' })
      .querySelector('.ma-score__value')?.textContent).toBe('0');

    await choose(user, 'Frequency', 'Weekly');
    await user.click(screen.getByRole('radio', { name: 'Thursday' }));
    await user.type(screen.getByLabelText('Season name (optional)'), ' Changed draft');
    expect(saved.textContent).toContain('Earlier pace');
    expect(saved.textContent).toContain('Every day');
    expect(saved.textContent).not.toContain('Changed draft');
  });

  it('keeps unknown saved schedule and time values explicit in the shared baseline card', () => {
    const unknown = createUnknownRhythmSeason(rhythmId, '2026-10-01', 'A few times weekly');
    renderCorrection([unknown], [], () => null, '2026-10-01', unknown);

    const saved = screen.getByRole('region', { name: 'Your saved schedule' });
    const card = saved.querySelector('.rhythm-history-view__season-card')!;
    expect(within(saved).getByRole('heading', { name: 'Earlier schedule details unavailable' })).toBeTruthy();
    expect(saved.textContent).toContain('Schedule details unavailable.');
    expect(saved.textContent).toContain('Time unknown');
    expect(card.querySelector('.rhythm-history-view__season-card-metadata [aria-label="Time of day not recorded"]'))
      .toBeTruthy();
    expect(card.querySelector('.rhythm-history-view__season-card-timeframe')?.textContent)
      .toBe('Oct 1, 2026 – End date not recorded');
    expect(card.className).toContain('rhythm-history-view__season-visual--unknown');
    expect(card.querySelector('.rhythm-history-view__season-current-badge')).toBeNull();
    expect(card.querySelector('button')).toBeNull();
    expect(savedSummaryText()).toContain('Original description: A few times weekly · Time not recorded');
    expect(savedSummaryText()).not.toContain('Anytime');
  });

  it('keeps score values concise and exposes explanation evidence in one native disclosure', async () => {
    const user = userEvent.setup();
    const season = createRhythmSeason(rhythmId, '2026-10-01', daily);
    renderCorrection([season], [makeRecord('in-range', '2026-10-20')]);
    const impact = screen.getByRole('region', { name: 'Score impact preview' });
    const afterConsistency = within(impact).getByRole('group', { name: 'After Consistency' });
    expect(afterConsistency.textContent).not.toContain('/ 100');
    expect(afterConsistency.querySelector('.visually-hidden')?.textContent).toBe('out of 100');
    const details = within(impact).getByText('Why the scores change').closest('details')!;
    expect(details.open).toBe(false);
    const summary = within(details).getByText('Why the scores change');
    summary.focus();
    expect(summary.tagName).toBe('SUMMARY');
    expect(document.activeElement).toBe(summary);
    await user.click(summary);
    expect(details.open).toBe(true);
    expect(details.textContent).toContain('scheduled days');
    expect(details.textContent).toContain('missed days');
    expect(details.textContent).not.toContain('Derived from');
  });

  it('explains the daily-to-weekdays 9/3-to-5/1 change without excluding saved logs', async () => {
    const user = userEvent.setup();
    const season = createRhythmSeason(rhythmId, '2026-10-17', daily);
    renderCorrection([season], [
      makeRecord('sat', '2026-10-17'),
      makeRecord('tue', '2026-10-20'),
      makeRecord('sun', '2026-10-25')
    ], () => null, '2026-10-17');
    const details = screen.getByText('Why the scores change').closest('details')!;
    await user.click(within(details).getByText('Why the scores change'));

    expect(details.textContent).toContain('3 of 9 · 33%');
    expect(details.textContent).toContain('9 scheduled days · 3 completed');
    await choose(user, 'Frequency', 'Select Days');
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
      await user.click(screen.getByRole('checkbox', { name: day }));
    }
    expect(details.textContent).toContain('1 of 5 · 20%');
    expect(details.textContent).toContain('5 scheduled days · 1 completed');
    expect(details.textContent).toContain('scheduled count decreases by 4 days');
    expect(details.textContent).toContain('completed occurrences decreases from 3 to 1');
    expect(screen.getByText(/All 3 logs stay saved · 1 of 3 logs qualify for 1 schedule credit/)).toBeTruthy();
    const logDetails = screen.getByText('Log details').closest('details')!;
    await user.click(within(logDetails).getByText('Log details'));
    expect(logDetails.textContent).toContain('1 log qualifies for 1 scheduled occurrence');
    expect(logDetails.textContent).toContain('2 other affected logs do not match a scheduled occurrence');
  });

  it('uses single-choice Weekly controls and keeps Select Days multi-choice during correction', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn((_draft: RhythmSeasonEditDraft) => null);
    const records = [makeRecord('wed-1', '2026-10-07')];
    const season = createRhythmSeason(rhythmId, '2026-10-01', daily);
    renderCorrection([season], records, onSave);

    await choose(user, 'Frequency', 'Weekly');
    const weekdays = screen.getByRole('radiogroup', { name: 'Choose one weekday' });
    await user.click(within(weekdays).getByRole('radio', { name: 'Friday' }));
    await user.click(within(weekdays).getByRole('radio', { name: 'Monday' }));
    expect(within(weekdays).getAllByRole('radio').filter(radio =>
      (radio as HTMLInputElement).checked
    ).map(radio => (radio as HTMLInputElement).getAttribute('aria-label'))).toEqual(['Monday']);
    expect(proposedSummaryText()).toContain('Every week on Monday');

    await choose(user, 'Frequency', 'Select Days');
    await user.click(screen.getByRole('checkbox', { name: 'Wednesday' }));
    expect((screen.getByRole('checkbox', { name: 'Monday' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'Wednesday' }) as HTMLInputElement).checked).toBe(true);
    expect(proposedSummaryText()).toContain('Every week on Monday and Wednesday');
    await user.click(screen.getByRole('checkbox', { name: 'Wednesday' }));
    expect(proposedSummaryText()).toContain('Selected days: Monday');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0]?.[0].schedule).toEqual({
      frequency: 'weekly',
      weekdays: [1],
      weeklyMode: 'select-days'
    });
  });

  it('uses period matching when explaining monthly log eligibility', async () => {
    const user = userEvent.setup();
    const season = createRhythmSeason(rhythmId, '2026-10-01', daily);
    renderCorrection([season], [
      makeRecord('oct-6', '2026-10-06'),
      makeRecord('oct-14', '2026-10-14'),
      makeRecord('oct-20', '2026-10-20')
    ]);

    await choose(user, 'Frequency', 'Monthly');
    expect(screen.getByText('All 3 logs stay saved · October receives 1 completion credit')).toBeTruthy();
    const details = screen.getByText('Why the scores change').closest('details')!;
    await user.click(within(details).getByText('Why the scores change'));
    expect(details.textContent).toContain('1 of 1 · 100%');
    const logDetails = screen.getByText('Log details').closest('details')!;
    await user.click(within(logDetails).getByText('Log details'));
    expect(logDetails.textContent).toContain('3 logs qualify across 1 credited occurrence; 2 extra logs do not add credit');
  });

  it('distinguishes total saved history from logs inside the affected date range', async () => {
    const season = createRhythmSeason(rhythmId, '2026-10-17', daily);
    renderCorrection([season], [
      makeRecord('before-season', '2026-10-10'),
      makeRecord('inside-season', '2026-10-20')
    ]);

    expect(screen.getByText(/All 2 logs stay saved ·/)).toBeTruthy();
    const logDetails = screen.getByText('Log details').closest('details')!;
    expect(logDetails.open).toBe(false);
    await userEvent.setup().click(within(logDetails).getByText('Log details'));
    expect(logDetails.textContent).toContain('1 of 2 logs fall within the affected date range.');
  });

  it('shows different last qualifying completion dates when the proposed weekday changes eligibility', async () => {
    const user = userEvent.setup();
    const season = createRhythmSeason(rhythmId, '2026-10-17', daily);
    renderCorrection([season], [
      makeRecord('monday', '2026-10-19'),
      makeRecord('tuesday', '2026-10-20')
    ]);
    const details = screen.getByText('Why the scores change').closest('details')!;
    await user.click(within(details).getByText('Why the scores change'));
    expect(details.textContent).toContain('Last qualifying Tend Oct 20, 2026');

    await choose(user, 'Frequency', 'Select Days');
    await user.click(screen.getByRole('checkbox', { name: 'Monday' }));
    expect(details.textContent).toContain('Last qualifying Tend Oct 19, 2026');
  });

  it('recomputes selector scores and evidence from changed weekday drafts and rejects invalid drafts', async () => {
    const user = userEvent.setup();
    const records = [
      makeRecord('thu-1', '2026-10-01'),
      makeRecord('wed-1', '2026-10-07'),
      makeRecord('tue-1', '2026-10-20'),
      makeRecord('wed-2', '2026-10-21'),
      makeRecord('thu-2', '2026-10-22')
    ];
    const season = createRhythmSeason(rhythmId, '2026-10-01', daily);
    renderCorrection([season], records);

    const beforeScore = scoreValue('Consistency', 'Before');
    await choose(user, 'Frequency', 'Select Days');
    await user.click(screen.getByRole('checkbox', { name: 'Wednesday' }));

    const afterScore = scoreValue('Consistency', 'After');
    expect(proposedSummaryText()).toContain('Selected days: Wednesday');
    expect(afterScore).not.toBe(beforeScore);
    const impactDetails = screen.getByText('Why the scores change').closest('details')!;
    await user.click(within(impactDetails).getByText('Why the scores change'));
    expect(impactDetails.textContent).toContain('2 of 3 · 67%');
    await user.click(screen.getByRole('checkbox', { name: 'Monday' }));
    expect(impactDetails.textContent).toContain('2 of 6 · 33%');
    expect(screen.getByText(/3 other affected logs do not match a scheduled occurrence/)).toBeTruthy();
    expect(screen.queryByText(/Thursday logs will not count toward a Monday\/Wednesday\/Friday schedule/)).toBeNull();
    await user.click(screen.getByRole('checkbox', { name: 'Wednesday' }));
    await user.click(screen.getByRole('checkbox', { name: 'Monday' }));
    expect(screen.getByRole('alert').textContent).toContain('Choose at least one weekday');
    expect(within(screen.getByRole('group', { name: 'After Consistency' })).getByText('Unavailable')).toBeTruthy();
    expect(screen.getByText(/The proposed schedule is invalid; On Track is unavailable/)).toBeTruthy();
  });

  it('reports no score change when an edited current boundary starts today and leaves past evidence unchanged', async () => {
    const user = userEvent.setup();
    const previous = createRhythmSeason(rhythmId, '2026-10-01', daily);
    const current = createRhythmSeason(rhythmId, asOfDate, daily);
    const records = [
      makeRecord('wed-1', '2026-10-07'),
      makeRecord('wed-2', '2026-10-14'),
      makeRecord('wed-3', '2026-10-21')
    ];
    renderCorrection([previous, current], records);
    const before = ['Consistency', 'On Track', 'Health'].map(metric => scoreValue(metric, 'Before'));

    await choose(user, 'Frequency', 'Select Days');
    await user.click(screen.getByRole('checkbox', { name: 'Sunday' }));

    const after = ['Consistency', 'On Track', 'Health'].map(metric => scoreValue(metric, 'After'));
    expect(after).toEqual(before);
    expect(screen.getByText('No recorded activity in this date range.')).toBeTruthy();
    expect(screen.queryByText('No score change. The proposed schedule produces the same scores.')).toBeNull();
    expect(proposedSummaryText()).toContain('Selected days: Sunday');
  });

  it('recomputes proposed scores for recurrence-pattern and date-boundary edits', async () => {
    const user = userEvent.setup();
    const records = [
      makeRecord('oct-6', '2026-10-06'),
      makeRecord('oct-7', '2026-10-07'),
      makeRecord('oct-15', '2026-10-15'),
      makeRecord('oct-20', '2026-10-20'),
      makeRecord('oct-21', '2026-10-21')
    ];
    const season = createRhythmSeason(rhythmId, '2026-10-01', daily);
    renderCorrection([season], records);

    const initialScore = scoreValue('Consistency', 'After');
    await choose(user, 'Frequency', 'Monthly');
    expect(proposedSummaryText()).toContain('The 1st day of every month');
    expect(screen.getByRole('group', { name: 'Repeat on' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'On day' })).toBeTruthy();
    expect(scoreValue('Consistency', 'After')).not.toBe(initialScore);

    await choose(user, 'Repeat on', 'A day of the week');
    const onThe = screen.getByRole('group', { name: 'On the' });
    const ordinalWeekday = within(onThe).getByRole('group', { name: 'Ordinal and weekday' });
    expect(within(ordinalWeekday).getByRole('combobox', { name: 'Which week?: First' })).toBeTruthy();
    expect(within(ordinalWeekday).getByRole('combobox', { name: 'Day: Sunday' })).toBeTruthy();
    expect(proposedSummaryText()).toContain('The first Sunday of every month');
    const patternScore = scoreValue('Consistency', 'After');
    expect(patternScore).toBeTruthy();
    const impactDetails = screen.getByText('Why the scores change').closest('details')!;
    await user.click(within(impactDetails).getByText('Why the scores change'));
    const patternDetails = impactDetails.textContent;

    fireEvent.change(screen.getByLabelText('Starting date'), { target: { value: '2026-10-05' } });
    expect(screen.getAllByText('Oct 5, 2026 – Present')).toHaveLength(2);
    const startBoundaryEvidence = screen.getByRole('group', { name: 'After Consistency' }).textContent;
    expect(startBoundaryEvidence).toContain('Unavailable');
    expect(impactDetails.textContent).not.toBe(patternDetails);
    const startBoundaryDetails = impactDetails.textContent;

    await user.click(screen.getByLabelText('Set an end date'));
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-10-20' } });
    expect(screen.getAllByText('Oct 5, 2026 – Oct 20, 2026')).toHaveLength(2);
    const endBoundaryEvidence = screen.getByRole('group', { name: 'After Consistency' }).textContent;
    expect(endBoundaryEvidence).toContain('Unavailable');
    expect(proposedSummaryText()).toContain('The first Sunday of every month');
    expect(proposedSummaryText()).toContain('Oct 5, 2026 – Oct 20, 2026');
    expect(impactDetails.textContent).not.toBe(startBoundaryDetails);
    expect(impactDetails.textContent).toContain('No eligible occurrences.');
  });
});
