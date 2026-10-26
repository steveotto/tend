import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RhythmSeasonCorrectionDialog } from '../src/components/RhythmSeasonCorrectionDialog.tsx';
import { todayRhythms } from '../src/domain/preview-data.ts';
import type { RhythmCompletionRecord } from '../src/domain/rhythm-completion.ts';
import type { RhythmScheduleHistorySegment, RhythmScoringMetadata } from '../src/domain/rhythm-schedule.ts';
import type { SelectRhythmScoreInput } from '../src/domain/rhythm-scoring.ts';
import type { RhythmSeasonEditDraft, RhythmSeasonEditTarget } from '../src/domain/rhythm-season-edit.ts';
import { createRhythmSeason } from '../src/domain/rhythm-seasons.ts';

const rhythmId = 'season-correction-impact';
const daily = { frequency: 'daily' } as const;
const asOfDate = '2026-10-25';

function makeRecord(id: string, effectiveDate: string): RhythmCompletionRecord {
  return { id, rhythmId, effectiveDate };
}

function renderCorrection(
  scheduleHistory: readonly RhythmScheduleHistorySegment[],
  records: readonly RhythmCompletionRecord[],
  onSave: (draft: RhythmSeasonEditDraft) => string | null = () => null
) {
  const latestSeason = scheduleHistory.at(-1)!;
  const schedule = latestSeason.kind === 'scheduled' ? latestSeason.schedule : daily;
  const scoring: RhythmScoringMetadata = {
    trackingStartDate: scheduleHistory.find(segment => segment.kind === 'scheduled')!.startDate,
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
    createdLocalDate: '2026-10-01',
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
      season={latestSeason}
      scoringInput={scoringInput}
      records={records}
      suggestedStartDate={scheduleHistory[0]!.startDate}
      canDelete={false}
      onSave={onSave}
      onClose={() => {}}
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
  const proposed = within(comparison).getByText('Proposed schedule').parentElement?.textContent ?? '';
  const effectiveRange = document.querySelector('.rhythm-season-correction__effective-range')?.textContent ?? '';
  return `${proposed} ${effectiveRange}`;
}

function comesBefore(first: Element, second: Element): boolean {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

afterEach(cleanup);

describe('shared Season correction score preview', () => {
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
    expect(savedSchedule.textContent).toContain('Start date not recorded');
    expect(savedSchedule.querySelector('.rhythm-season-correction__saved-schedule')?.classList
      .contains('rhythm-history-view__season-visual--fern')).toBe(true);
    expect(screen.getByLabelText('Starting date')).toHaveProperty('value', '2026-10-17');
    await choose(user, 'Frequency', 'Weekly');
    await user.click(screen.getByRole('radio', { name: 'Monday' }));
    await user.type(screen.getByLabelText('Season name (optional)'), 'Special Season');
    expect(savedSchedule.textContent).toContain('Every day');
    expect(savedSchedule.textContent).not.toContain('Every week on Monday');
    await user.click(screen.getByLabelText('Set an end date'));

    const endDate = screen.getByLabelText('End date');
    expect(endDate).toHaveProperty('value', asOfDate);
    expect(screen.getByText('Oct 17, 2026 – Oct 25, 2026')).toBeTruthy();
    expect(proposedSummaryText()).toContain('Special Season · Every week on Monday');
    expect(proposedSummaryText()).toContain('Effective Oct 17, 2026 – Oct 25, 2026 · Anytime');
    expect(screen.queryByText('Choose a complete, valid schedule to preview its impact.')).toBeNull();
    fireEvent.change(endDate, { target: { value: '2026-10-24' } });
    expect(proposedSummaryText()).toContain('Effective Oct 17, 2026 – Oct 24, 2026 · Anytime');
    expect(screen.getByText('Oct 17, 2026 – Oct 24, 2026')).toBeTruthy();
    fireEvent.change(endDate, { target: { value: '2026-10-29' } });
    expect(screen.getByText('Oct 17, 2026 – Oct 29, 2026')).toBeTruthy();
    expect(screen.getByText('All logs remain saved (2 total); 2 fall within the affected period.')).toBeTruthy();

    await user.click(screen.getByLabelText('Set an end date'));
    expect(screen.queryByLabelText('End date')).toBeNull();
    expect(proposedSummaryText()).toContain('Effective Oct 17, 2026 – Present · Anytime');
    expect(screen.getByText('Oct 17, 2026 – Present')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      startDate: '2026-10-17',
      schedule: { frequency: 'weekly', weekdays: [1] },
      timeOfDay: 'anytime',
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
    expect(proposedSummaryText()).toContain('Effective Choose a valid end date · Anytime');
    expect(screen.getByText('Choose a valid end date')).toBeTruthy();
    expect(screen.queryByText('Choose a complete, valid schedule to preview its impact.')).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Score impact preview' }))
      .getByText(/Proposed schedule is invalid; After scores are unavailable/)).toBeTruthy();
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
    renderCorrection([season], []);

    const name = screen.getByLabelText('Season name (optional)');
    const affectedDates = screen.getByText('Oct 1, 2026 – Present');
    const startingDate = screen.getByLabelText('Starting date');
    const frequency = screen.getByRole('combobox', { name: /^Frequency:/ });
    const timeOfDay = screen.getByRole('combobox', { name: /^Time of day:/ });
    const endDate = screen.getByLabelText('Set an end date');
    const savedHeading = screen.getByRole('heading', { name: 'Your saved schedule' });
    const changeHeading = screen.getByRole('heading', { name: 'Make your changes' });
    const reviewHeading = screen.getByRole('heading', { name: 'Review the impact' });
    const comparison = screen.getByRole('group', { name: 'Saved and proposed schedules' });
    const effectiveRange = screen.getByText(/^Effective /);
    const impact = screen.getByRole('region', { name: 'Score impact preview' });
    const confirm = screen.getByRole('button', { name: 'Apply' });

    expect(comesBefore(savedHeading, changeHeading)).toBe(true);
    expect(comesBefore(changeHeading, reviewHeading)).toBe(true);
    expect(comesBefore(name, affectedDates)).toBe(true);
    expect(comesBefore(affectedDates, startingDate)).toBe(true);
    expect(comesBefore(startingDate, frequency)).toBe(true);
    expect(comesBefore(frequency, timeOfDay)).toBe(true);
    expect(comesBefore(timeOfDay, endDate)).toBe(true);
    expect(comesBefore(endDate, reviewHeading)).toBe(true);
    expect(comesBefore(reviewHeading, comparison)).toBe(true);
    expect(comesBefore(comparison, effectiveRange)).toBe(true);
    expect(comesBefore(effectiveRange, impact)).toBe(true);
    expect(comesBefore(impact, confirm)).toBe(true);

    await user.click(endDate);
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-10-20' } });
    expect(screen.getByText('Oct 1, 2026 – Oct 20, 2026')).toBeTruthy();
  });

  it('keeps score values concise and exposes calculation evidence in one disclosure', async () => {
    const user = userEvent.setup();
    const season = createRhythmSeason(rhythmId, '2026-10-01', daily);
    renderCorrection([season], []);
    const impact = screen.getByRole('region', { name: 'Score impact preview' });
    const afterConsistency = within(impact).getByRole('group', { name: 'After Consistency' });
    expect(afterConsistency.textContent).not.toContain('/ 100');
    expect(afterConsistency.querySelector('.visually-hidden')?.textContent).toBe('out of 100');
    const details = within(impact).getByText('Score calculation details').closest('details')!;
    expect(details.open).toBe(false);
    await user.click(within(details).getByText('Score calculation details'));
    expect(details.open).toBe(true);
    expect(details.textContent).toContain('eligible');
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
      makeRecord('oct-14', '2026-10-14')
    ]);

    await choose(user, 'Frequency', 'Monthly');
    expect(screen.getByText('All logs remain saved (2 total); 2 fall within the affected period.')).toBeTruthy();
    expect(screen.queryByText(/will not receive scoring credit under the proposed schedule/)).toBeNull();
    const details = screen.getByText('Score calculation details').closest('details')!;
    await user.click(within(details).getByText('Score calculation details'));
    expect(details.textContent).toContain('1 eligible · 1 completed');
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
    const impactDetails = screen.getByText('Score calculation details').closest('details')!;
    await user.click(within(impactDetails).getByText('Score calculation details'));
    expect(impactDetails.textContent).toContain('3 eligible · 2 completed');
    await user.click(screen.getByRole('checkbox', { name: 'Monday' }));
    expect(impactDetails.textContent).toContain('6 eligible · 2 completed');
    expect(screen.getByText(/3 logged moments \(Oct 1, 2026, Oct 20, 2026, Oct 22, 2026\) will not receive scoring credit under the proposed schedule/)).toBeTruthy();
    expect(screen.queryByText(/Thursday logs will not count toward a Monday\/Wednesday\/Friday schedule/)).toBeNull();
    await user.click(screen.getByRole('checkbox', { name: 'Wednesday' }));
    await user.click(screen.getByRole('checkbox', { name: 'Monday' }));
    expect(screen.getByRole('alert').textContent).toContain('Choose at least one weekday');
    expect(within(screen.getByRole('group', { name: 'After Consistency' })).getByText('Unavailable')).toBeTruthy();
    expect(screen.getByText(/Proposed schedule is invalid; After scores are unavailable/)).toBeTruthy();
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
    expect(screen.getByText('No score change. The proposed schedule produces the same scores and evidence.')).toBeTruthy();
    expect(proposedSummaryText()).toContain('Selected days: Sunday');
  });

  it('recomputes proposed scores for recurrence-pattern and date-boundary edits', async () => {
    const user = userEvent.setup();
    const records = [
      makeRecord('oct-1', '2026-10-01'),
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
    const impactDetails = screen.getByText('Score calculation details').closest('details')!;
    await user.click(within(impactDetails).getByText('Score calculation details'));
    const patternDetails = impactDetails.textContent;

    fireEvent.change(screen.getByLabelText('Starting date'), { target: { value: '2026-10-05' } });
    expect(screen.getByText('Oct 5, 2026 – Present')).toBeTruthy();
    const startBoundaryEvidence = screen.getByRole('group', { name: 'After Consistency' }).textContent;
    expect(startBoundaryEvidence).toContain('Unavailable');
    expect(impactDetails.textContent).not.toBe(patternDetails);
    const startBoundaryDetails = impactDetails.textContent;

    await user.click(screen.getByLabelText('Set an end date'));
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-10-20' } });
    expect(screen.getByText('Oct 5, 2026 – Oct 20, 2026')).toBeTruthy();
    const endBoundaryEvidence = screen.getByRole('group', { name: 'After Consistency' }).textContent;
    expect(endBoundaryEvidence).toContain('Unavailable');
    expect(proposedSummaryText()).toContain('The first Sunday of every month');
    expect(proposedSummaryText()).toContain('Effective Oct 5, 2026 – Oct 20, 2026 · Anytime');
    expect(impactDetails.textContent).not.toBe(startBoundaryDetails);
    expect(impactDetails.textContent).toContain('Rhythm is inactive.');
  });
});
