import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { RhythmSeasonCorrectionDialog } from '../src/components/RhythmSeasonCorrectionDialog.tsx';
import { todayRhythms } from '../src/domain/preview-data.ts';
import type { RhythmCompletionRecord } from '../src/domain/rhythm-completion.ts';
import type { RhythmScheduleHistorySegment, RhythmScoringMetadata } from '../src/domain/rhythm-schedule.ts';
import type { SelectRhythmScoreInput } from '../src/domain/rhythm-scoring.ts';
import { createRhythmSeason } from '../src/domain/rhythm-seasons.ts';

const rhythmId = 'season-correction-impact';
const daily = { frequency: 'daily' } as const;
const asOfDate = '2026-10-25';

function makeRecord(id: string, effectiveDate: string): RhythmCompletionRecord {
  return { id, rhythmId, effectiveDate };
}

function renderCorrection(
  scheduleHistory: readonly RhythmScheduleHistorySegment[],
  records: readonly RhythmCompletionRecord[]
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
      onSave={() => null}
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

afterEach(cleanup);

describe('shared Season correction score preview', () => {
  it('uses single-choice Weekly controls and keeps Select Days multi-choice during correction', async () => {
    const user = userEvent.setup();
    const records = [makeRecord('wed-1', '2026-10-07')];
    const season = createRhythmSeason(rhythmId, '2026-10-01', daily);
    renderCorrection([season], records);

    await choose(user, 'Frequency', 'Weekly');
    const weekdays = screen.getByRole('radiogroup', { name: 'Choose one weekday' });
    await user.click(within(weekdays).getByRole('radio', { name: 'Friday' }));
    await user.click(within(weekdays).getByRole('radio', { name: 'Monday' }));
    expect(within(weekdays).getAllByRole('radio').filter(radio =>
      (radio as HTMLInputElement).checked
    ).map(radio => (radio as HTMLInputElement).getAttribute('aria-label'))).toEqual(['Monday']);
    expect(screen.getByText('Every week on Monday.')).toBeTruthy();

    await choose(user, 'Frequency', 'Select Days');
    await user.click(screen.getByRole('checkbox', { name: 'Wednesday' }));
    expect((screen.getByRole('checkbox', { name: 'Monday' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'Wednesday' }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('Every week on Monday and Wednesday.')).toBeTruthy();
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

    const consistency = screen.getByRole('group', { name: 'Consistency comparison' });
    const beforeScore = scoreValue('Consistency', 'Before');
    const beforeEvidence = within(consistency).getByRole('group', { name: 'Before Consistency' }).textContent;
    await choose(user, 'Frequency', 'Select Days');
    await user.click(screen.getByRole('checkbox', { name: 'Wednesday' }));

    const afterScore = scoreValue('Consistency', 'After');
    const afterEvidence = within(consistency).getByRole('group', { name: 'After Consistency' }).textContent;
    expect(screen.getByText('Every week on Wednesday.')).toBeTruthy();
    expect(afterScore).not.toBe(beforeScore);
    expect(afterEvidence).not.toBe(beforeEvidence);
    expect(afterEvidence).toContain('3 eligible · 2 completed');
    expect(screen.getByText(/3 logs fall outside this proposed schedule \(Thursday, Tuesday\)/)).toBeTruthy();
    expect(screen.queryByText(/Thursday logs will not count toward a Monday\/Wednesday\/Friday schedule/)).toBeNull();

    await user.click(screen.getByRole('checkbox', { name: 'Wednesday' }));
    expect(screen.getByRole('alert').textContent).toContain('Choose a complete, valid schedule');
    expect(within(screen.getByRole('group', { name: 'After Consistency' })).getByText('Unavailable')).toBeTruthy();
    expect(screen.getAllByText('Proposed schedule is invalid.')).toHaveLength(3);
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
    expect(screen.getByText('No score change. The selector returns the same scores and evidence for this draft.')).toBeTruthy();
    expect(screen.getByText('Every week on Sunday.')).toBeTruthy();
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

    const initialEvidence = screen.getByRole('group', { name: 'After Consistency' }).textContent;
    await choose(user, 'Frequency', 'Monthly');
    expect(screen.getByText('The 1st day of every month.')).toBeTruthy();
    const monthlyEvidence = screen.getByRole('group', { name: 'After Consistency' }).textContent;
    expect(monthlyEvidence).not.toBe(initialEvidence);

    await choose(user, 'Repeat on', 'A day of the week');
    expect(screen.getByText('The first Sunday of every month.')).toBeTruthy();
    const patternEvidence = screen.getByRole('group', { name: 'After Consistency' }).textContent;
    expect(patternEvidence).not.toBe(monthlyEvidence);

    fireEvent.change(screen.getByLabelText('Starting date'), { target: { value: '2026-10-05' } });
    expect(screen.getByText(/Affected dates: Oct 5, 2026/)).toBeTruthy();
    const startBoundaryEvidence = screen.getByRole('group', { name: 'After Consistency' }).textContent;
    expect(startBoundaryEvidence).not.toBe(patternEvidence);

    await user.click(screen.getByLabelText('Set an end date'));
    fireEvent.change(screen.getByLabelText('Ending on'), { target: { value: '2026-10-20' } });
    expect(screen.getByText(/Affected dates: Oct 5, 2026 – Oct 20, 2026/)).toBeTruthy();
    const endBoundaryEvidence = screen.getByRole('group', { name: 'After Consistency' }).textContent;
    expect(endBoundaryEvidence).not.toBe(startBoundaryEvidence);
    expect(screen.getByText('The first Sunday of every month, ending October 20, 2026.')).toBeTruthy();
  });
});
