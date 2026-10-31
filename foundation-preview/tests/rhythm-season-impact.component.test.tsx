import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { RhythmSeasonImpact } from '../src/components/RhythmSeasonImpact.tsx';
import { selectRhythmScore } from '../src/domain/rhythm-scoring.ts';
import type { RhythmCompletionRecord } from '../src/domain/rhythm-completion.ts';
import type { RhythmScoringMetadata } from '../src/domain/rhythm-schedule.ts';
import type { RhythmScoreResult, UnscoredRhythmSelection } from '../src/domain/rhythm-scoring.ts';
import { createRhythmSeason } from '../src/domain/rhythm-seasons.ts';

const rhythmId = 'season-impact-fixture';
const schedule = { frequency: 'daily' } as const;

function score(
  records: readonly RhythmCompletionRecord[] = [],
  recordsAvailable = true,
  asOfDate = '2026-10-03'
): RhythmScoreResult {
  const scoring: RhythmScoringMetadata = {
    trackingStartDate: '2026-10-01',
    timeZone: 'UTC',
    scheduleHistory: [createRhythmSeason(rhythmId, '2026-10-01', schedule)]
  };
  return selectRhythmScore({
    rhythmId,
    schedule,
    scoring,
    records,
    recordsAvailable,
    createdLocalDate: '2026-10-01',
    createdTimeZone: 'UTC',
    asOfDate,
    timeZone: 'UTC'
  });
}

function completed(id: string, effectiveDate: string): RhythmCompletionRecord {
  return { id, rhythmId, effectiveDate };
}

function cell(metric: string, side: 'Before' | 'After') {
  const comparison = screen.getByRole('group', { name: `${metric} comparison` });
  return within(comparison).getByRole('group', { name: `${side} ${metric}` });
}

function visibleScore(target: HTMLElement): string | undefined {
  return target.querySelector('.rhythm-season-impact__score strong')?.textContent ?? undefined;
}

afterEach(cleanup);

describe('shared Rhythm season impact comparison', () => {
  it('renders an Add Season single-score view without comparison or disclosure controls', () => {
    render(
      <RhythmSeasonImpact
        mode="single"
        singleScore={score([completed('out-of-range', '2026-09-01')])}
        noRecordedActivity
        singleMessage="No recorded activity in this date range."
      />
    );
    const impact = screen.getByRole('region', { name: 'Score impact preview' });
    expect(within(impact).getByRole('heading', { name: 'Score' })).toBeTruthy();
    expect(within(impact).queryByRole('heading', { name: 'Before' })).toBeNull();
    expect(within(impact).queryByRole('heading', { name: 'After' })).toBeNull();
    expect(within(impact).getByText('No recorded activity in this date range.')).toBeTruthy();
    expect(within(impact).queryByText('Why the scores change')).toBeNull();
    expect(within(impact).queryByText(/No score change|produces the same scores/)).toBeNull();
    for (const metric of ['Consistency', 'On Track', 'Health']) {
      expect(within(impact).getByRole('group', { name: `Score ${metric}` })
        .querySelector('.rhythm-season-impact__score strong')?.textContent).toBe('—');
    }
  });

  it('compares selector values and reports matching evidence only once', () => {
    const unchanged = score([completed('one', '2026-10-01')]);
    render(<RhythmSeasonImpact before={unchanged} after={unchanged} />);

    expect(screen.getByRole('heading', { name: 'Before' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'After' })).toBeTruthy();
    for (const metric of ['Consistency', 'On Track', 'Health']) {
      expect(visibleScore(cell(metric, 'Before'))).toBe(
        visibleScore(cell(metric, 'After'))
      );
      const scoreDescription = cell(metric, 'Before').querySelector('.rhythm-season-impact__score strong');
      expect(scoreDescription?.nextElementSibling?.textContent).toBe('out of 100');
      expect(cell(metric, 'Before').querySelector('.rhythm-season-impact__score')?.textContent).not.toContain('/ 100');
    }
    expect(screen.getAllByText(/Both · \d+ eligible · \d+ completed/)).toHaveLength(2);
    expect(screen.queryByText(/No score change|produces the same scores/)).toBeNull();
    expect(cell('Consistency', 'Before').textContent).not.toContain('eligible');
    expect(cell('Consistency', 'After').textContent).not.toContain('eligible');
    expect(screen.getByRole('heading', { name: 'Before' }).tagName).toBe('H4');
    expect(screen.getByRole('heading', { name: 'After' }).tagName).toBe('H4');
  });

  it('shows lower numeric scores without a success or failure judgment and keeps changed evidence distinct', () => {
    const before = score([completed('first', '2026-10-01'), completed('second', '2026-10-02')]);
    const after = score();
    render(<RhythmSeasonImpact before={before} after={after} />);

    expect(visibleScore(cell('Consistency', 'Before'))).toBe('100');
    expect(visibleScore(cell('Consistency', 'After'))).toBe('0');
    expect(cell('Consistency', 'Before').textContent).toContain('2 eligible · 2 completed');
    expect(cell('Consistency', 'After').textContent).toContain('2 eligible · 0 completed');
    expect(screen.queryByText(/improv|worsen|better|worse/i)).toBeNull();
  });

  it('shows unavailable-to-numeric and numeric-to-unavailable transitions with concise and expandable reasons', () => {
    const ready = score([completed('one', '2026-10-01')]);
    const unavailable = score([], false);
    render(<RhythmSeasonImpact before={unavailable} after={ready} />);

    const beforeConsistency = cell('Consistency', 'Before');
    expect(beforeConsistency.textContent).toContain('—');
    expect(beforeConsistency.textContent).toContain('Unavailable');
    expect(beforeConsistency.textContent).toContain('Completion history is unavailable.');
    expect(visibleScore(cell('Consistency', 'After'))).toBeDefined();

    cleanup();
    render(<RhythmSeasonImpact before={ready} after={unavailable} />);
    expect(visibleScore(cell('On Track', 'Before'))).toBeDefined();
    const afterOnTrack = cell('On Track', 'After');
    expect(afterOnTrack.textContent).toContain('—');
    expect(afterOnTrack.textContent).toContain('Unavailable');
    expect(afterOnTrack.textContent).toContain('Completion history is unavailable.');
  });

  it('uses the real tracking baseline when there is no qualifying completion and shows the score floor', async () => {
    const user = userEvent.setup();
    const firstDay = score([], true, '2026-10-01');
    render(
      <RhythmSeasonImpact
        before={firstDay}
        after={firstDay}
        beforeSchedule={schedule}
        afterSchedule={schedule}
        detailsDisclosure
      />
    );
    const disclosure = screen.getByText('Why the scores change');
    await user.click(disclosure);
    expect(screen.getAllByText(/No qualifying Tend yet; tracking began Oct 1, 2026/)).toHaveLength(2);

    cleanup();
    const floor = score([], true, '2026-10-21');
    render(
      <RhythmSeasonImpact
        before={floor}
        after={floor}
        beforeSchedule={schedule}
        afterSchedule={schedule}
        detailsDisclosure
      />
    );
    await user.click(screen.getByText('Why the scores change'));
    expect(screen.getAllByText('max(0, 100 − 10 × 20) = 0')).toHaveLength(2);
    expect(screen.getAllByText('20 missed days')).toHaveLength(2);
  });

  it('keeps the complete long unavailable reason available without pushing values into another metric', async () => {
    const detail = `A schedule change cannot be reconstructed: ${'the unknown earlier schedule leaves additional relevant dates uncovered. '.repeat(8)}`;
    const metric = {
      kind: 'unscored' as const,
      reasonCode: 'unsupported-history' as const,
      explanation: detail
    };
    const unavailable: UnscoredRhythmSelection = {
      kind: 'unscored',
      asOfDate: '2026-10-03',
      timeZone: 'UTC',
      reason: metric,
      consistency: metric,
      onTrack: metric,
      healthScore: null
    };
    const user = userEvent.setup();
    render(<RhythmSeasonImpact before={unavailable} after={score()} />);

    const beforeConsistency = cell('Consistency', 'Before');
    expect(beforeConsistency.textContent).toContain('Schedule history is incomplete.');
    const disclosure = within(beforeConsistency).getByText('Why unavailable');
    await user.click(disclosure);
    expect(beforeConsistency.querySelector('details p')?.textContent).toBe(detail);
    expect(visibleScore(cell('On Track', 'After'))).toBeDefined();
  });

  it('renders the invalid-proposal state with an unavailable After value', () => {
    render(<RhythmSeasonImpact before={score()} />);
    const afterHealth = cell('Health', 'After');
    expect(afterHealth.textContent).toContain('—');
    expect(afterHealth.textContent).toContain('Unavailable');
    expect(afterHealth.textContent).toContain('Proposed schedule is invalid.');
    expect(within(afterHealth).getByText('Why unavailable')).toBeTruthy();
  });
});
