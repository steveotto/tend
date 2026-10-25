import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RhythmDetailsDialog } from '../src/components/RhythmDetailsDialog.tsx';
import { HealthScoreMeter, RhythmHistoryView } from '../src/components/RhythmHistoryView.tsx';
import { RhythmScoreCircle } from '../src/components/RhythmScoreCircle.tsx';
import {
  dailyRhythmScoreExample,
  calculateBlendedHealth,
  prepareCompletionHistory,
  prepareDailyCompletionCounts,
  prepareRhythmScoreExample,
  resolveSeedCompletionRecords,
  rhythmScoreExampleFor,
  unavailableRhythmScoreExample
} from '../src/domain/rhythm-history.ts';
import { scoreTone } from '../src/domain/score-tone.ts';
import { marriageRhythms, syntheticPeople, todayRhythms } from '../src/domain/preview-data.ts';
import type { DatedRhythmCompletion } from '../src/domain/rhythm-completion.ts';
import { addCalendarDays, localDateInTimeZone } from '../src/domain/rhythm-scoring.ts';
import type { RhythmSchedule } from '../src/domain/rhythm-schedule.ts';
import { localDateString } from '../src/domain/money-goals.ts';

afterEach(cleanup);

const connection = marriageRhythms.find(rhythm => rhythm.id === 'sample-marriage-connection')!;
const todayConnection = todayRhythms.find(rhythm => rhythm.id === 'sample-connect')!;

function savedRecord(id: string, effectiveDate: string, localTime: string, memory?: string): DatedRhythmCompletion {
  return {
    id,
    rhythmId: todayConnection.id,
    effectiveDate,
    localTime,
    timeZone: 'UTC',
    completedAt: `${effectiveDate}T${localTime}:00.000Z`,
    recordedAt: '2026-10-22T11:00:00.000Z',
    ...(memory === undefined ? {} : { memory })
  };
}

function scoredTodayFixture() {
  const asOfDate = localDateInTimeZone(new Date(), 'UTC');
  const trackingStartDate = addCalendarDays(asOfDate, -30);
  const schedule = { frequency: 'daily' as const };
  const scoring = {
    trackingStartDate,
    timeZone: 'UTC',
    scheduleHistory: [{ startDate: trackingStartDate, schedule }]
  };
  const records = Array.from({ length: 30 }, (_, index) => ({
    date: addCalendarDays(trackingStartDate, index)
  }))
    .filter((_, index) => index >= 4 && index <= 26)
    .map(({ date }, index) => ({
      ...savedRecord(`scored-${index}`, date, '12:00'),
      recordedAt: `${date}T12:01:00.000Z`
    }));
  return {
    rhythm: {
      ...todayConnection,
      schedule,
      createdLocalDate: trackingStartDate,
      createdTimeZone: 'UTC',
      scoring,
      completionHistory: []
    },
    records
  };
}

function rhythmForSchedule(schedule: RhythmSchedule, trackingStartDate: string) {
  return {
    ...todayConnection,
    id: `score-fixture-${schedule.frequency}-${trackingStartDate}`,
    schedule,
    createdLocalDate: trackingStartDate,
    createdTimeZone: 'UTC',
    scoring: {
      trackingStartDate,
      timeZone: 'UTC',
      scheduleHistory: [{ startDate: trackingStartDate, schedule }]
    },
    completionHistory: []
  };
}

function shortTestDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isDatedRecord(record: DatedRhythmCompletion | import('../src/domain/rhythm-completion.ts').RhythmCompletionRecord): record is DatedRhythmCompletion {
  return Boolean(record.localTime && record.timeZone && record.completedAt && record.recordedAt);
}

function EditableHistoryHarness() {
  const [records, setRecords] = useState([
    savedRecord('editable-newer', '2026-10-21', '10:10'),
    savedRecord('editable-older', '2026-10-19', '09:15', 'A long memory\nthat preserves its line break.')
  ]);
  return (
    <RhythmHistoryView
      rhythm={todayConnection}
      datedCompletions={records}
      completionHistoryAvailable
      onUpdateCompletion={record => {
        if (!isDatedRecord(record)) {
          return 'A complete time is required in this fixture.';
        }
        setRecords(current => current.map(item => item.id === record.id ? record : item));
        return null;
      }}
      onDeleteCompletion={id => {
        setRecords(current => current.filter(item => item.id !== id));
        return null;
      }}
    />
  );
}

describe('shared Rhythm history', () => {
  it('refreshes daily scores at scoring-timezone midnight and after returning from suspension', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-24T03:59:00.000Z'));
    try {
      const trackingStartDate = '2026-10-20';
      const schedule = { frequency: 'daily' as const };
      const rhythm = {
        ...todayConnection,
        schedule,
        createdLocalDate: trackingStartDate,
        createdTimeZone: 'America/New_York',
        scoring: {
          trackingStartDate,
          timeZone: 'America/New_York',
          scheduleHistory: [{ startDate: trackingStartDate, schedule }]
        },
        completionHistory: []
      };
      const completed = {
        ...savedRecord('midnight-check', '2026-10-22', '12:00'),
        timeZone: 'America/New_York'
      };
      render(
        <RhythmHistoryView
          rhythm={rhythm}
          datedCompletions={[completed]}
          completionHistoryAvailable
        />
      );

      const expectScores = (health: string, consistency: string, onTrack: string) => {
        expect(screen.getByRole('meter', { name: 'Health score' }).getAttribute('aria-valuenow')).toBe(health);
        expect(screen.getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuenow')).toBe(consistency);
        expect(screen.getByRole('meter', { name: 'On Track score' }).getAttribute('aria-valuenow')).toBe(onTrack);
      };
      const expectChartToday = (date: string) => {
        const days = [...screen.getByRole('list', {
          name: 'Recorded completion count by date'
        }).querySelectorAll('li')];
        expect(days.at(-1)?.querySelector('time')?.getAttribute('dateTime')).toBe(date);
        expect(days.at(-1)?.querySelector('time')?.textContent).toBe('Today');
        expect(days.at(-1)?.getAttribute('aria-label')).toContain('no completion recorded yet, today');
      };
      expectScores('50', '33', '100');
      expectChartToday('2026-10-23');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(120_000);
      });
      expectScores('41.25', '25', '90');
      expectChartToday('2026-10-24');

      act(() => {
        vi.setSystemTime(new Date('2026-10-25T04:01:00.000Z'));
        fireEvent(document, new Event('visibilitychange'));
      });
      expectScores('35', '20', '80');
      expectChartToday('2026-10-25');
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the full-details recording draft open when saving fails', async () => {
    const user = userEvent.setup();
    const onSaveCompletion = vi.fn(() => 'The preview could not save this completion.');
    const onClose = vi.fn();
    render(
      <RhythmDetailsDialog
        rhythm={todayConnection}
        onSaveCompletion={onSaveCompletion}
        onClose={onClose}
      />
    );

    const details = screen.getByRole('dialog', { name: todayConnection.title });
    await user.click(within(details).getByRole('button', { name: `Tend ${todayConnection.title}` }));
    const recording = screen.getByRole('dialog', { name: 'When did you tend it?' });
    const memory = within(recording).getByLabelText(/Notes/);
    await user.type(memory, 'Keep this draft.');
    await user.click(within(recording).getByRole('button', { name: 'Save' }));

    expect(onSaveCompletion).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'When did you tend it?' })).toBe(recording);
    expect(within(recording).getByLabelText(/Notes/)).toHaveProperty('value', 'Keep this draft.');
    expect(within(recording).getByRole('alert').textContent)
      .toBe('The preview could not save this completion.');
  });

  it('resolves seeded completion overrides and tombstones by stable ID', () => {
    const original = todayConnection.completionHistory!;
    const result = resolveSeedCompletionRecords(original, [{
      id: original[0]!.id,
      rhythmId: todayConnection.id,
      effectiveDate: '2026-10-16',
      memory: 'Edited fixture memory.'
    }], [original[1]!.id]);
    expect(result).toEqual([
      {
        id: original[0]!.id,
        rhythmId: todayConnection.id,
        effectiveDate: '2026-10-16',
        memory: 'Edited fixture memory.'
      },
      original[2]
    ]);
    expect(resolveSeedCompletionRecords(undefined, [], [])).toBeUndefined();
    expect(resolveSeedCompletionRecords([], [], [])).toEqual([]);
  });

  it('prepares the explicit daily illustration consistently without deriving it from completion logs', () => {
    const example = prepareRhythmScoreExample(dailyRhythmScoreExample);

    expect(rhythmScoreExampleFor(todayConnection.id)).toBe(dailyRhythmScoreExample);
    expect(rhythmScoreExampleFor(connection.id)).toBeUndefined();
    expect(example).toMatchObject({
      asOfDate: '2026-10-23',
      healthScore: 75,
      consistency: {
        kind: 'scored',
        score: 77,
        eligibleDueCount: 30,
        completedCount: 23,
        notCompletedCount: 7,
        exactPercent: 76.66666666666667
      },
      onTrack: {
        kind: 'scored',
        score: 70,
        lastTendedDate: '2026-10-19',
        missedOccurrenceCount: 3,
        pointsPerMissedOccurrence: 10
      }
    });
    if (example.consistency.kind !== 'scored' || example.onTrack.kind !== 'scored') {
      throw new Error('The explicit daily illustration should be scored.');
    }
    expect(example.consistency.occurrences).toHaveLength(30);
    expect(example.consistency.occurrences.filter(item => item.status === 'completed')).toHaveLength(23);
    expect(example.consistency.occurrences.filter(item => item.status === 'not-completed')).toHaveLength(7);
    expect(example.consistency.occurrences[0]?.date).toBe('2026-09-23');
    expect(example.consistency.occurrences.at(-1)?.date).toBe('2026-10-22');
    expect(example.onTrack.occurrences.map(item => [item.date, item.status, item.score])).toEqual([
      ['2026-10-19', 'completed', 100],
      ['2026-10-20', 'missed', 90],
      ['2026-10-21', 'missed', 80],
      ['2026-10-22', 'missed', 70],
      ['2026-10-23', 'today', 70]
    ]);
    expect(prepareCompletionHistory(todayConnection.completionHistory)).toMatchObject({
      kind: 'recorded',
      count: 3,
      firstDate: '2026-10-17',
      lastDate: '2026-10-20',
      dailyCounts: [
        { date: '2026-10-17', count: 1, recordIds: ['sample-connect-2026-10-17'] },
        { date: '2026-10-18', count: 1, recordIds: ['sample-connect-2026-10-18'] },
        { date: '2026-10-19', count: 0, recordIds: [] },
        { date: '2026-10-20', count: 1, recordIds: ['sample-connect-2026-10-20'] }
      ]
    });
    expect(prepareCompletionHistory(connection.completionHistory)).toMatchObject({
      kind: 'recorded',
      count: 3,
      firstDate: '2026-10-17',
      lastDate: '2026-10-20',
      dailyCounts: [
        { date: '2026-10-17', count: 1, recordIds: ['sample-marriage-connection-2026-10-17'] },
        { date: '2026-10-18', count: 1, recordIds: ['sample-marriage-connection-2026-10-18'] },
        { date: '2026-10-19', count: 0, recordIds: [] },
        { date: '2026-10-20', count: 1, recordIds: ['sample-marriage-connection-2026-10-20'] }
      ]
    });
    expect(example.consistency.occurrences).not.toEqual(connection.completionHistory);
  });

  it('blends Health from validated unrounded Consistency and On Track scores', () => {
    expect(calculateBlendedHealth(80, 40)).toBe(70);
    expect(calculateBlendedHealth(0, 100)).toBe(25);
    expect(calculateBlendedHealth(0, 0)).toBe(0);
    expect(calculateBlendedHealth(null, 40)).toBeNull();
    expect(calculateBlendedHealth(80, null)).toBeNull();
    const unrounded = calculateBlendedHealth(76.66666666666667, 70);
    expect(unrounded).toBe(75);
    expect(Math.round(unrounded!)).toBe(75);
    const fractional = calculateBlendedHealth(0.49, 1.49);
    expect(fractional).toBeCloseTo(0.74);
    expect(Math.round(fractional!)).toBe(1);
    for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, -0.01, 100.01]) {
      expect(() => calculateBlendedHealth(invalid, 50)).toThrow(RangeError);
      expect(() => calculateBlendedHealth(50, invalid)).toThrow(RangeError);
    }
  });

  it('keeps zero eligible due occurrences unscored and unavailable data distinct', () => {
    const zeroEligible = prepareRhythmScoreExample({
      ...dailyRhythmScoreExample,
      consistencyOccurrences: []
    });
    expect(zeroEligible.consistency).toEqual({
      kind: 'unscored',
      explanation: 'There are no eligible due occurrences in this window, so Consistency is unscored.'
    });
    expect(zeroEligible.healthScore).toBeNull();
    expect(zeroEligible.onTrack).toMatchObject({ kind: 'scored', score: 70 });

    const noQualifyingTend = prepareRhythmScoreExample({
      ...dailyRhythmScoreExample,
      onTrack: {
        ...dailyRhythmScoreExample.onTrack,
        days: [{ date: dailyRhythmScoreExample.asOfDate, status: 'as-of' }]
      }
    });
    expect(noQualifyingTend.onTrack.kind).toBe('unscored');
    expect(unavailableRhythmScoreExample.healthScore).toBeNull();
    expect(unavailableRhythmScoreExample.consistency.kind).toBe('unavailable');
    expect(unavailableRhythmScoreExample.onTrack.kind).toBe('unavailable');
  });

  it('renders accessible score circles with scored zero, unscored and unavailable states', () => {
    const { rerender } = render(<RhythmScoreCircle label="Health" score={0} state="scored" />);
    const meter = screen.getByRole('meter', { name: 'Health score' });
    expect(meter.getAttribute('aria-valuenow')).toBe('0');
    expect(meter.getAttribute('aria-valuetext')).toBe('0 out of 100');
    expect(screen.getByText('0')).toBeTruthy();

    rerender(<RhythmScoreCircle label="Health" score={null} state="unscored" />);
    expect(screen.getByRole('img', { name: 'Health: Unscored because there are no eligible due occurrences' }))
      .toBeTruthy();
    expect(screen.getByText('unscored')).toBeTruthy();

    rerender(<RhythmScoreCircle label="Health" score={null} state="unavailable" />);
    expect(screen.getByRole('img', { name: 'Health: Score unavailable' })).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('unavailable')).toBeTruthy();
    expect([scoreTone(80), scoreTone(79), scoreTone(50), scoreTone(0), scoreTone(null)]).toEqual([
      'green', 'yellow', 'yellow', 'red', 'neutral'
    ]);
  });

  it('renders the Health bar with accessible zero and unavailable states', () => {
    const { rerender } = render(<HealthScoreMeter score={0} />);
    const zeroMeter = screen.getByRole('meter', { name: 'Health score' });
    expect(zeroMeter.getAttribute('aria-valuenow')).toBe('0');
    expect(zeroMeter.getAttribute('aria-valuetext')).toBe('0 out of 100');
    expect(zeroMeter.classList.contains('red')).toBe(true);
    expect(zeroMeter.querySelector('.rhythm-history-view__health-meter-fill')?.getAttribute('style')).toContain('0%');

    rerender(<HealthScoreMeter score={null} />);
    const unavailable = screen.getByRole('img', { name: 'Health: Not enough data' });
    expect(unavailable.hasAttribute('aria-valuenow')).toBe(false);
    expect(unavailable.classList.contains('neutral')).toBe(true);
    expect(unavailable.querySelector('.rhythm-history-view__health-meter-fill')?.getAttribute('style')).toContain('0%');
  });

  it('prepares out-of-order dated records as chronological daily counts without losing IDs', () => {
    const dailyCounts = prepareDailyCompletionCounts([
      { id: 'later', effectiveDate: '2026-03-10' },
      { id: 'same-day-a', effectiveDate: '2026-03-08' },
      { id: 'middle', effectiveDate: '2026-03-09' },
      { id: 'same-day-b', effectiveDate: '2026-03-08' }
    ]);

    expect(dailyCounts).toEqual([
      { date: '2026-03-08', count: 2, recordIds: ['same-day-a', 'same-day-b'] },
      { date: '2026-03-09', count: 1, recordIds: ['middle'] },
      { date: '2026-03-10', count: 1, recordIds: ['later'] }
    ]);
    expect(prepareDailyCompletionCounts([
      { id: 'latest', effectiveDate: '2026-10-20' }
    ], '2026-10-24')).toEqual([
      { date: '2026-10-20', count: 1, recordIds: ['latest'] },
      { date: '2026-10-21', count: 0, recordIds: [] },
      { date: '2026-10-22', count: 0, recordIds: [] },
      { date: '2026-10-23', count: 0, recordIds: [] },
      { date: '2026-10-24', count: 0, recordIds: [] }
    ]);
    expect(prepareDailyCompletionCounts([
      { id: 'dst-start', effectiveDate: '2026-03-07' }
    ], '2026-03-10').map(item => item.date)).toEqual([
      '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10'
    ]);
  });

  it('prepares a single local date and keeps empty and unavailable history distinct', () => {
    expect(prepareDailyCompletionCounts([
      { id: 'one', effectiveDate: '2026-11-01' }
    ])).toEqual([{ date: '2026-11-01', count: 1, recordIds: ['one'] }]);
    expect(prepareDailyCompletionCounts([
      { id: 'future', effectiveDate: '2026-11-02' }
    ], '2026-11-01')).toEqual([]);
    expect(prepareCompletionHistory([])).toEqual({ kind: 'empty', records: [] });
    expect(prepareCompletionHistory(undefined)).toEqual({ kind: 'unavailable' });
  });

  it('keeps illustrative scores out of ordinary Today views and preserves factual completion history', async () => {
    const user = userEvent.setup();
    render(
      <RhythmHistoryView
        rhythm={todayConnection}
        people={syntheticPeople.slice(0, 2)}
        onPersonSelect={() => undefined}
      />
    );
    const history = screen.getByRole('region', { name: 'History for Daily connection' });
    const title = within(history).getByRole('heading', { name: 'Daily connection' });
    const schedule = within(history).getByText('Daily');
    const description = within(history).getByText('Set aside a few minutes to share how your day went.');
    const people = within(history).getByRole('group', { name: 'People associated with Daily connection' });
    expect(title.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(description.compareDocumentPosition(people) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(people.compareDocumentPosition(schedule) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(history).getByText('Daily')).toBeTruthy();
    expect(within(history).getByText('Evening')).toBeTruthy();
    const completionSummary = history.querySelector('.rhythm-history-view__completion-summary')!;
    expect(completionSummary.querySelector('.rhythm-history-view__completion-total strong')?.textContent).toBe('3');
    expect(completionSummary.querySelector('.rhythm-history-view__completion-total > span')?.textContent)
      .toBe('moments tended');
    const today = localDateString(new Date());
    const displayedDates = [];
    for (let date = '2026-10-17'; date <= today; date = addCalendarDays(date, 1)) {
      displayedDates.push(date);
    }
    expect(completionSummary.querySelector('.rhythm-history-view__completion-span')?.textContent)
      .toBe(`across ${displayedDates.length} days`);
    expect(within(history).queryByRole('heading', { name: 'Recent opportunities' })).toBeNull();
    expect(within(history).queryByText(/past opportunities completed/)).toBeNull();
    expect(history.querySelector('.rhythm-history-view__opportunity-list, .rhythm-history-view__legend')).toBeNull();
    expect(within(history).queryByText(/Illustrative example/)).toBeNull();
    expect(screen.getByRole('meter', { name: 'Health score' })).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'Consistency score' })).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'On Track score' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Set tracking start' })).toBeNull();
    expect(screen.getByRole('status').textContent).not.toContain('Confirm when tracking starts');
    const scoreSection = within(history).getByRole('region', { name: 'Health, Consistency, and On Track scores' });
    const completionSection = within(history).getByRole('region', { name: 'All completion history' });
    expect(scoreSection.compareDocumentPosition(completionSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(completionSection.querySelector('.rhythm-history-view__logged-moments')).toBeTruthy();

    const chart = within(history).getByRole('list', { name: 'Recorded completion count by date' });
    const chartDates = [...chart.querySelectorAll('time')].map(time => time.getAttribute('dateTime'));
    expect(chartDates).toEqual(displayedDates);
    expect([...chart.querySelectorAll('li')].slice(0, 4).map(item => item.getAttribute('aria-label'))).toEqual([
      'Saturday, October 17, 2026: 1 completion',
      'Sunday, October 18, 2026: 1 completion',
      'Monday, October 19, 2026: no recorded completions',
      'Tuesday, October 20, 2026: 1 completion'
    ]);
    const todayLabel = new Date(`${today}T12:00:00Z`).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
    });
    expect([...chart.querySelectorAll('li')].at(-1)?.getAttribute('aria-label'))
      .toBe(`${todayLabel}: no completion recorded yet, today`);
    expect(chart.querySelectorAll('.rhythm-history-view__completion-zero').length).toBe(displayedDates.length - 3);
    expect(chart.querySelectorAll('.rhythm-history-view__completion-bar')).toHaveLength(3);
    expect(within(history).getByRole('region', {
      name: 'Completion history chart; scroll horizontally for older dates'
    }).getAttribute('tabindex')).toBe('0');

    await user.click(within(history).getByText('Logged moments (3)'));
    const loggedList = history.querySelector('.rhythm-history-view__logged-moments ol') as HTMLOListElement;
    expect([...loggedList.querySelectorAll('time')].map(time => time.getAttribute('dateTime'))).toEqual([
      '2026-10-20', '2026-10-18', '2026-10-17'
    ]);
    expect(loggedList.querySelector('.rhythm-history-view__logged-entry-date')?.textContent)
      .toContain('Time not recorded');
    expect(within(loggedList).queryByRole('button', { name: /^Edit logged moment/ })).toBeNull();
    expect(within(loggedList).queryByRole('button', { name: /^Delete logged moment/ })).toBeNull();
    expect(loggedList.querySelectorAll('li')).toHaveLength(
      [...chart.querySelectorAll('li')].reduce((total, day) => (
        total + Number(day.getAttribute('aria-label')?.match(/: (\d+) completion/)?.[1] ?? 0)
      ), 0)
    );
  });

  it('uses singular total/span wording for one actual dated record', () => {
    const singleRecordRhythm = { ...todayConnection, completionHistory: [] };
    render(
      <RhythmHistoryView
        rhythm={singleRecordRhythm}
        datedCompletions={[savedRecord('single-record', '2026-10-23', '12:00')]}
        completionHistoryAvailable
      />
    );

    const completionSection = screen.getByRole('region', { name: 'All completion history' });
    const summary = completionSection.querySelector('.rhythm-history-view__completion-summary')!;
    expect(summary.querySelector('.rhythm-history-view__completion-total strong')?.textContent).toBe('1');
    expect(summary.querySelector('.rhythm-history-view__completion-total > span')?.textContent)
      .toBe('moment tended');
    const chartDays = Math.floor((Date.parse(`${localDateString(new Date())}T00:00:00Z`)
      - Date.parse('2026-10-23T00:00:00Z')) / 86_400_000) + 1;
    expect(summary.querySelector('.rhythm-history-view__completion-span')?.textContent)
      .toBe(`across ${chartDays} ${chartDays === 1 ? 'day' : 'days'}`);
    expect(within(completionSection).getByRole('listitem', {
      name: `Friday, October 23, 2026: 1 completion${localDateString(new Date()) === '2026-10-23' ? ', today' : ''}`
    })).toBeTruthy();
  });

  it('shows Health and both breakdowns from one saved daily-occurrence result', async () => {
    const user = userEvent.setup();
    const { rhythm, records } = scoredTodayFixture();
    render(
      <RhythmHistoryView
        rhythm={rhythm}
        datedCompletions={records}
        completionHistoryAvailable
      />
    );

    expect(screen.getAllByRole('meter')).toHaveLength(3);
    const healthMeter = screen.getByRole('meter', { name: 'Health score' });
    expect(Number(healthMeter.getAttribute('aria-valuenow'))).toBeCloseTo(76.98);
    expect(healthMeter.getAttribute('aria-valuetext')).toBe('77 out of 100');
    expect(screen.getByRole('heading', { name: 'Health' })).toBeTruthy();
    expect(screen.queryByText('75% Consistency · 25% On Track')).toBeNull();
    expect(screen.getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuenow')).toBe('79');
    expect(screen.getByRole('meter', { name: 'On Track score' }).getAttribute('aria-valuenow')).toBe('70');
    expect(screen.getByText('How often you show up')).toBeTruthy();
    expect(screen.getByText('How caught up you are')).toBeTruthy();
    const consistency = screen.getByRole('region', { name: 'Consistency' });
    const onTrack = screen.getByRole('region', { name: 'On Track' });
    const info = screen.getByRole('button', { name: 'Show Consistency and On Track score details' });
    const controlledIds = info.getAttribute('aria-controls')!.split(' ');
    const healthCalculationDisclosure = document.getElementById(controlledIds[0]!)!;
    const details = document.getElementById(controlledIds[1]!)!;
    expect(controlledIds).toHaveLength(2);
    expect(healthCalculationDisclosure.classList.contains('rhythm-history-view__health-calculation-disclosure')).toBe(true);
    expect(details.hidden).toBe(true);
    expect(healthCalculationDisclosure.hidden).toBe(true);
    expect(document.querySelectorAll('.rhythm-history-view__score-card')).toHaveLength(1);
    expect(document.querySelectorAll('.rhythm-history-view__score-summary')).toHaveLength(2);
    expect(document.querySelectorAll('.rhythm-history-view__score-summary-divider')).toHaveLength(1);
    expect(document.querySelectorAll('.rhythm-history-view__score-info')).toHaveLength(1);
    expect(info.getAttribute('aria-expanded')).toBe('false');
    expect(info.getAttribute('aria-controls')).toBe(`${healthCalculationDisclosure.id} ${details.id}`);
    expect(getComputedStyle(healthCalculationDisclosure).display).toBe('none');
    expect(within(consistency).queryByText('30 moments')).toBeNull();
    expect(within(onTrack).queryByText('3 days')).toBeNull();
    await user.click(info);
    expect(details.hidden).toBe(false);
    expect(healthCalculationDisclosure.hidden).toBe(false);
    expect(info.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(info);
    expect(info.getAttribute('aria-label')).toBe('Hide Consistency and On Track score details');
    expect(screen.getByRole('group', { name: 'Consistency and On Track score details' })).toBe(details);
    const healthCalculation = healthCalculationDisclosure.querySelector('.rhythm-history-view__health-calculation') as HTMLElement;
    expect(within(healthCalculation).getByRole('heading', { name: 'How your Health score is calculated' })).toBeTruthy();
    const explanation = healthCalculation.querySelector('.visually-hidden') as HTMLElement;
    expect(healthCalculation.getAttribute('aria-describedby')).toBe(explanation.id);
    expect(screen.getByRole('region', { name: 'How your Health score is calculated' })).toBe(healthCalculation);
    expect(explanation.textContent?.replace(/\s+/g, ' ').trim())
      .toBe("Health is weighted 75 percent Consistency and 25 percent On Track. These are fixed formula weights, not this Rhythm's current scores.");
    expect(within(healthCalculation).queryByText('Fixed formula weights')).toBeNull();
    const weightPanels = [...healthCalculation.querySelectorAll('.rhythm-history-view__health-weight-panel')];
    expect(weightPanels).toHaveLength(2);
    expect(weightPanels.map(panel => [
      panel.querySelector('.rhythm-history-view__health-weight-value strong')?.textContent,
      panel.querySelector('.rhythm-history-view__health-weight-name')?.textContent,
      panel.querySelector('.rhythm-history-view__health-weight-subtitle')?.textContent
    ])).toEqual([
      ['75%', 'Consistency', 'Your longer-term pattern.'],
      ['25%', 'On Track', 'Up to date']
    ]);
    expect(healthCalculation.querySelectorAll('.rhythm-history-view__health-weight-panel svg[aria-hidden="true"]')).toHaveLength(2);
    expect(healthCalculation.textContent).not.toMatch(/[×=]/);
    const scoreCard = document.querySelector('.rhythm-history-view__score-card')!;
    const orderedSections = [...scoreCard.children]
      .filter(element => element.classList.contains('rhythm-history-view__health-summary')
        || element.classList.contains('rhythm-history-view__health-calculation-disclosure')
        || element.classList.contains('rhythm-history-view__score-summary-divider')
        || element.classList.contains('rhythm-history-view__score-grid')
        || element.classList.contains('rhythm-history-view__score-details-grid'))
      .map(element => element.className.split(' ').find(className => className.startsWith('rhythm-history-view__')));
    expect(orderedSections).toEqual([
      'rhythm-history-view__health-summary',
      'rhythm-history-view__health-calculation-disclosure',
      'rhythm-history-view__score-summary-divider',
      'rhythm-history-view__score-grid',
      'rhythm-history-view__score-details-grid'
    ]);
    const healthDetails = details.querySelector('.rhythm-history-view__score-details-column:first-child') as HTMLElement;
    const onTrackDetails = details.querySelector('.rhythm-history-view__score-details-column:last-child') as HTMLElement;
    expect(within(healthDetails).getByText('29', { exact: true })).toBeTruthy();
    expect(within(healthDetails).getByText('23', { exact: true })).toBeTruthy();
    const consistencyRows = [...healthDetails.querySelectorAll('.rhythm-history-view__breakdown-rows > div')];
    expect(consistencyRows.map(row => [
      row.querySelector('dt')?.textContent,
      row.querySelector('dd')?.textContent
    ])).toEqual([
      ['Dates', consistencyRows[0]?.querySelector('dd')?.textContent],
      ['Completed', '23'],
      ['Scheduled', '29']
    ]);
    expect(consistencyRows[0]?.querySelector('dd')?.textContent)
      .toMatch(/^[A-Z][a-z]{2} \d{1,2}–[A-Z][a-z]{2} \d{1,2}$/);
    expect(within(healthDetails).queryByText('Scoring window')).toBeNull();
    expect(within(healthDetails).queryByText('Eligible scheduled occurrences')).toBeNull();
    const healthFormula = healthDetails.querySelector('.rhythm-history-view__calculation')!;
    expect(healthFormula.textContent?.replace(/\s+/g, '')).toBe('23÷29×100=79%');
    expect(healthFormula.querySelector('strong')?.textContent).toBe('79%');
    expect(within(healthDetails).queryByText('Not completed', { exact: true })).toBeNull();
    const pattern = within(healthDetails).getByRole('list', {
      name: /29 eligible daily occurrences from .* through .*: 23 completed and 6 not completed\./
    });
    expect(pattern.querySelectorAll('.rhythm-history-view__health-pattern-day:not(.rhythm-history-view__health-pattern-day--missed)'))
      .toHaveLength(23);
    expect(pattern.querySelectorAll('.rhythm-history-view__health-pattern-day--missed'))    .toHaveLength(6);
    expect(within(pattern).getAllByRole('listitem')[0]?.getAttribute('aria-label')).toMatch(/eligible day$/);
    expect(within(pattern).getAllByRole('listitem')[0]?.getAttribute('aria-label')).toMatch(/completed|not completed/);
    expect(within(healthDetails).getByText('23 completed')).toBeTruthy();
    expect(within(healthDetails).getByText('6 not completed')).toBeTruthy();

    expect(within(onTrackDetails).getByText(/Last tended/)).toBeTruthy();
    expect(within(onTrackDetails).queryByText('Today', { exact: true })).toBeNull();
    expect(within(onTrackDetails).queryByText('No deduction')).toBeNull();
    const lastTendedDate = addCalendarDays(localDateInTimeZone(new Date(), 'UTC'), -4);
    expect(within(onTrackDetails).getAllByText(new RegExp(shortTestDate(lastTendedDate))).length).toBeGreaterThan(0);
    expect(within(onTrackDetails).getByText('3')).toBeTruthy();
    expect(within(onTrackDetails).getByText('10 points')).toBeTruthy();
    const onTrackFormula = onTrackDetails.querySelector('.rhythm-history-view__calculation')!;
    expect(onTrackFormula.textContent?.replace(/\s+/g, '')).toBe('100−30=70');
    expect(onTrackFormula.querySelector('strong')?.textContent).toBe('70');
    const onTrackItems = within(onTrackDetails).getAllByRole('listitem').map(item => {
      const label = item.querySelector('span')?.textContent?.replace(/\s+/g, ' ').trim();
      const score = item.querySelector('strong')?.textContent;
      return `${label} ${score}`;
    });
    expect(onTrackItems).toHaveLength(5);
    expect(within(onTrackDetails).getByRole('button', { name: 'Show earlier steps' })).toBeTruthy();
    expect(onTrackItems[0]).toMatch(/· tended · reset 100$/);
    expect(onTrackItems.slice(1, 4).every(item => item.includes('not tended'))).toBe(true);
    expect(onTrackItems.at(-1)).toMatch(/today · current state 70$/);
    expect(screen.getByText(/Calculated from saved completion records/)).toBeTruthy();
    expect(within(healthDetails).queryByText(/eligible due occurrence counts once|overdue time|pre-activation|Foundation-weighted|Health windows are/)).toBeNull();
    expect(within(onTrackDetails).queryByText(/calendar-day span|floors at zero|rules for weekly/)).toBeNull();
    expect(within(healthDetails).queryByText(/76\.7|→/)).toBeNull();
    expect(within(details).getByRole('heading', { name: 'Your scheduled pattern' })).toBeTruthy();
    expect(within(details).getByRole('heading', { name: 'How it changed' })).toBeTruthy();
  });

  it('renders eligible Consistency occurrences and independently scores Custom On Track', async () => {
    const user = userEvent.setup();
    const asOfDate = localDateInTimeZone(new Date(), 'UTC');
    const trackingStartDate = addCalendarDays(asOfDate, -900);
    const cases: { schedule: RhythmSchedule; expectedKind: string; weekday?: RegExp }[] = [
      { schedule: { frequency: 'weekly', weekdays: [1, 3, 5] }, expectedKind: 'scheduled day', weekday: /^(Monday|Wednesday|Friday),/ },
      { schedule: { frequency: 'weekly', weekdays: [1] }, expectedKind: 'scheduled day', weekday: /^Monday,/ },
      { schedule: { frequency: 'monthly', pattern: { kind: 'dayOfMonth', day: 15 } }, expectedKind: 'due date' },
      { schedule: { frequency: 'quarterly', monthInQuarter: 1, pattern: { kind: 'dayOfMonth', day: 15 } }, expectedKind: 'due date' },
      { schedule: { frequency: 'yearly', month: 1, pattern: { kind: 'dayOfMonth', day: 15 } }, expectedKind: 'due date' }
    ];

    for (const [index, fixture] of cases.entries()) {
      const view = render(
        <RhythmHistoryView
          rhythm={{ ...rhythmForSchedule(fixture.schedule, trackingStartDate), id: `frequency-fixture-${index}` }}
          completionHistoryAvailable
        />
      );
      await user.click(screen.getByRole('button', { name: 'Show Consistency and On Track score details' }));
      const pattern = screen.getByRole('list', { name: /eligible .* occurrences from/ });
      const cells = within(pattern).getAllByRole('listitem');
      expect(cells.length).toBeGreaterThan(0);
      expect(cells.every(cell => cell.getAttribute('aria-label')?.endsWith(fixture.expectedKind))).toBe(true);
      if (fixture.weekday) {
        expect(cells.every(cell => fixture.weekday!.test(cell.getAttribute('aria-label') ?? ''))).toBe(true);
      }
      expect(cells.some(cell => cell.getAttribute('aria-label')?.includes('not completed'))).toBe(true);
      view.unmount();
    }

    const customSchedule: RhythmSchedule = {
      frequency: 'custom',
      unit: 'days',
      interval: 3,
      startDate: trackingStartDate
    };
    render(
      <RhythmHistoryView
        rhythm={rhythmForSchedule(customSchedule, trackingStartDate)}
        completionHistoryAvailable
      />
    );
    await user.click(screen.getByRole('button', { name: 'Show Consistency and On Track score details' }));
    expect(screen.getByText('Consistency for Custom intervals is unavailable because a lookback policy has not been approved.')).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'On Track score' })).toBeTruthy();
    expect(screen.queryByRole('list', { name: /eligible .* occurrences from/ })).toBeNull();
    expect(screen.queryByText(/÷ .* × 100/)).toBeNull();
  });

  it('offers an explicit schedule-conversion action for descriptive cadence without inferring weekdays', async () => {
    const user = userEvent.setup();
    const onChooseSchedule = vi.fn();
    const cadenceOnly = {
      ...todayConnection,
      cadence: '3 times a week',
      completionHistory: []
    };
    delete cadenceOnly.schedule;
    delete cadenceOnly.scoring;
    render(
      <RhythmHistoryView
        rhythm={cadenceOnly}
        completionHistoryAvailable
        onChooseSchedule={onChooseSchedule}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Show Consistency and On Track score details' }));
    expect(document.querySelector('.rhythm-history-view__score-explanation')?.textContent)
      .toBe('Choose a schedule to calculate On Track. Descriptive cadence alone does not define due dates.');
    const conversion = screen.getByRole('button', { name: 'Choose a schedule to calculate On Track' });
    await user.click(conversion);
    expect(onChooseSchedule).toHaveBeenCalledOnce();
    expect(screen.queryByRole('meter', { name: 'On Track score' })).toBeNull();
  });

  it('bounds On Track history, expands in batches, preserves totals and restores focus when collapsed', async () => {
    const user = userEvent.setup();
    const asOfDate = localDateInTimeZone(new Date(), 'UTC');
    const trackingStartDate = '1900-01-01';
    const rhythm = rhythmForSchedule({ frequency: 'daily' }, trackingStartDate);
    const { rerender } = render(
      <RhythmHistoryView rhythm={rhythm} completionHistoryAvailable />
    );
    await user.click(screen.getByRole('button', { name: 'Show Consistency and On Track score details' }));

    const timeline = screen.getByRole('list', { name: 'On Track score changes' });
    const initialScore = screen.getByRole('meter', { name: 'On Track score' }).getAttribute('aria-valuenow');
    const initialFormula = document.querySelector('.rhythm-history-view__score-details-column:last-child .rhythm-history-view__calculation')?.textContent;
    const earlier = screen.getByRole('button', { name: 'Show earlier steps' });
    expect(earlier.getAttribute('aria-controls')).toBe(timeline.id);
    expect(earlier.getAttribute('aria-expanded')).toBe('false');
    expect(within(timeline).getAllByRole('listitem')).toHaveLength(5);
    expect(within(timeline).getAllByRole('listitem').at(-1)?.textContent).toContain('current state');
    expect(within(timeline).getAllByRole('listitem').map(item => item.textContent).join(' '))
      .toMatch(/earlier occurrences at 0/);

    earlier.focus();
    await user.keyboard('{Enter}');
    expect(earlier.getAttribute('aria-expanded')).toBe('true');
    expect(within(timeline).getAllByRole('listitem')).toHaveLength(10);
    await user.click(screen.getByRole('button', { name: 'Show earlier steps' }));
    expect(within(timeline).getAllByRole('listitem').length).toBeLessThanOrEqual(15);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Show less' }));
    expect(within(timeline).getAllByRole('listitem').some(item =>
      item.textContent?.includes('not tended · deduction') && item.querySelector('strong')?.textContent === '0'
    )).toBe(true);
    expect(within(timeline).getAllByRole('listitem').some(item =>
      item.textContent?.includes('earlier occurrences at 0')
    )).toBe(true);

    const showLess = screen.getByRole('button', { name: 'Show less' });
    expect(showLess.getAttribute('aria-controls')).toBe(timeline.id);
    expect(showLess.getAttribute('aria-expanded')).toBe('true');
    showLess.focus();
    await user.keyboard('{Enter}');
    expect(within(timeline).getAllByRole('listitem')).toHaveLength(5);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Show earlier steps' }));
    expect(screen.getByRole('meter', { name: 'On Track score' }).getAttribute('aria-valuenow')).toBe(initialScore);
    expect(document.querySelector('.rhythm-history-view__score-details-column:last-child .rhythm-history-view__calculation')?.textContent)
      .toBe(initialFormula);

    rerender(
      <RhythmHistoryView
        rhythm={rhythmForSchedule({ frequency: 'daily' }, addCalendarDays(asOfDate, -8))}
        completionHistoryAvailable
      />
    );
    expect(screen.getByRole('button', { name: 'Show Consistency and On Track score details' })
      .getAttribute('aria-expanded')).toBe('false');
    await user.click(screen.getByRole('button', { name: 'Show Consistency and On Track score details' }));
    expect(screen.getByRole('list', { name: 'On Track score changes' })).toBeTruthy();
    expect(within(screen.getByRole('list', { name: 'On Track score changes' })).getAllByRole('listitem'))
      .toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Show earlier steps' }).getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps a completed-today state visible when the short timeline has no disclosure', async () => {
    const user = userEvent.setup();
    const asOfDate = localDateInTimeZone(new Date(), 'UTC');
    const rhythm = rhythmForSchedule({ frequency: 'daily' }, asOfDate);
    const record = {
      ...savedRecord('completed-today', asOfDate, '12:00'),
      rhythmId: rhythm.id
    };
    render(
      <RhythmHistoryView
        rhythm={rhythm}
        datedCompletions={[record]}
        completionHistoryAvailable
      />
    );
    await user.click(screen.getByRole('button', { name: 'Show Consistency and On Track score details' }));
    const timeline = screen.getByRole('list', { name: 'On Track score changes' });
    expect(within(timeline).getAllByRole('listitem')).toHaveLength(1);
    expect(within(timeline).getByText(/tended today · current state/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show earlier steps' })).toBeNull();
    expect(screen.getByRole('meter', { name: 'On Track score' }).getAttribute('aria-valuenow')).toBe('100');
  });

  it('toggles both score breakdowns with the shared Info control by pointer and keyboard', async () => {
    const user = userEvent.setup();
    render(<RhythmHistoryView rhythm={todayConnection} />);
    const info = screen.getByRole('button', { name: 'Show Consistency and On Track score details' });
    const [healthCalculationId, detailsId] = info.getAttribute('aria-controls')!.split(' ');
    const healthCalculation = document.getElementById(healthCalculationId!)!;
    const details = document.getElementById(detailsId!)!;

    await user.click(info);
    expect(details.hidden).toBe(false);
    expect(healthCalculation.hidden).toBe(false);
    expect(info.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(info);

    await user.click(info);
    expect(details.hidden).toBe(true);
    expect(healthCalculation.hidden).toBe(true);
    expect(info.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(info);

    await user.keyboard('{Enter}');
    expect(details.hidden).toBe(false);
    expect(healthCalculation.hidden).toBe(false);
    expect(info.getAttribute('aria-expanded')).toBe('true');
    await user.keyboard(' ');
    expect(details.hidden).toBe(true);
    expect(healthCalculation.hidden).toBe(true);
    expect(info.getAttribute('aria-expanded')).toBe('false');
  });

  it('derives the automatic start from the oldest dated completion and shows short-history context', async () => {
    const user = userEvent.setup();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const currentDate = localDateInTimeZone(new Date(), timeZone);
    const firstRecordedDate = addCalendarDays(currentDate, -3);
    render(
      <RhythmHistoryView
        rhythm={{ ...todayConnection, completionHistory: [] }}
        datedCompletions={[{
          ...savedRecord('first-recorded', firstRecordedDate, '12:00'),
          timeZone
        }]}
        completionHistoryAvailable
      />
    );
    expect(screen.getByRole('meter', { name: 'On Track score' }).getAttribute('aria-valuenow')).toBe('80');
    const consistency = screen.getByRole('meter', { name: 'Consistency score' });
    expect(consistency.getAttribute('aria-valuenow')).toBe('33');
    expect(consistency).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Show Consistency and On Track score details' }));
    expect(screen.getByText(/Based on 3 days of tracking/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Set tracking start' })).toBeNull();
  });

  it('announces the short confirmed tracking period beside the matching breakdown', async () => {
    const user = userEvent.setup();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const currentDate = localDateInTimeZone(new Date(), timeZone);
    const trackingStartDate = addCalendarDays(currentDate, -3);
    const schedule = { frequency: 'daily' as const };
    render(
      <RhythmHistoryView
        rhythm={{
          ...todayConnection,
          schedule,
          scoring: {
            trackingStartDate,
            timeZone,
            scheduleHistory: [{ startDate: trackingStartDate, schedule }]
          },
          completionHistory: []
        }}
        datedCompletions={[
          savedRecord('short-history-one', trackingStartDate, '12:00'),
          savedRecord('short-history-two', addCalendarDays(trackingStartDate, 1), '12:00')
        ].map(record => ({ ...record, timeZone }))}
        completionHistoryAvailable
      />
    );

    expect(screen.getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuenow')).toBe('67');
    expect(screen.getByRole('meter', { name: 'On Track score' }).getAttribute('aria-valuenow')).toBe('90');
    expect(screen.getByRole('meter', { name: 'Health score' }).getAttribute('aria-valuenow')).toBe('72.5');
    await user.click(screen.getByRole('button', { name: 'Show Consistency and On Track score details' }));
    const details = screen.getByRole('group', { name: 'Consistency and On Track score details' });
    expect(within(details).getByText(/Based on 3 days of tracking/)).toBeTruthy();
    expect(details.querySelector('.rhythm-history-view__calculation')?.textContent?.replace(/\s+/g, ''))
      .toBe('2÷3×100=67%');
  });

  it('orders history metadata and actual associations before schedule metadata', () => {
    render(
      <RhythmHistoryView
        rhythm={{ ...connection, categoryIds: ['marriage', 'faith'] }}
        people={syntheticPeople.slice(0, 2)}
        onPersonSelect={() => undefined}
      />
    );

    const metadata = document.querySelector('.rhythm-history-view__metadata') as HTMLElement;
    const header = document.querySelector('.rhythm-history-view__rhythm-header') as HTMLElement;
    expect(within(header).getByRole('heading', { name: 'Daily Connection' })).toBeTruthy();
    const description = within(metadata).getByText('Make a little room each day to connect in a way that fits your life.') as HTMLElement;
    const people = within(metadata).getByRole('group', { name: 'People associated with Daily Connection' }) as HTMLElement;
    const categories = within(metadata).getByRole('group', { name: 'Associated categories' }) as HTMLElement;
    const schedule = within(metadata).getByText('5 times a week') as HTMLElement;
    const order = (before: Node, after: Node) => Boolean(
      before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING
    );

    expect(description.nextElementSibling).toBe(people.parentElement);
    expect(order(people, categories)).toBe(true);
    expect(order(categories, schedule)).toBe(true);
    expect(within(categories).getAllByRole('img').map(icon => icon.getAttribute('aria-label'))).toEqual([
      'Faith',
      'Marriage'
    ]);
  });

  it('keeps Close in an independent header column from long title and description content', () => {
    const title = 'A deliberately long Rhythm title that wraps across multiple lines in a narrow dialog';
    const description = 'A long description with enough words to wrap several times and verify that none can flow underneath the top-right Close control.';
    render(
      <RhythmHistoryView
        rhythm={{ ...todayConnection, title, description }}
        onClose={() => undefined}
      />
    );

    const header = document.querySelector('.rhythm-history-view__rhythm-header') as HTMLElement;
    const body = document.querySelector('.rhythm-history-view__body') as HTMLElement;
    const titleRow = header.querySelector('.rhythm-history-view__title-row')!;
    const closeButton = within(header).getByRole('button', { name: 'Close details' });
    expect(titleRow.contains(closeButton)).toBe(false);
    expect(within(header).getByRole('heading', { name: title })).toBeTruthy();
    expect(within(body).getByText(description)).toBeTruthy();
    expect(within(header).queryByText(description)).toBeNull();
    expect(header.classList.contains('rhythm-history-view__rhythm-header')).toBe(true);
    expect(closeButton.classList.contains('today-rhythm-details__close--history')).toBe(true);
    expect(closeButton.getAttribute('aria-label')).toBe('Close details');
  });

  it('keeps the modal heading and Close in the fixed header while history content is in its scroll body', () => {
    render(<RhythmHistoryView rhythm={todayConnection} onClose={() => undefined} />);

    const header = document.querySelector('.rhythm-history-view__rhythm-header') as HTMLElement;
    const body = document.querySelector('.rhythm-history-view__body--dialog') as HTMLElement;
    expect(within(header).getAllByRole('heading', { name: 'Daily connection' })).toHaveLength(1);
    expect(within(header).getAllByRole('button', { name: 'Close details' })).toHaveLength(1);
    expect(within(header).queryByText('Health')).toBeNull();
    expect(within(body).getByText('Health')).toBeTruthy();
    expect(within(body).getByRole('heading', { name: 'All completion history' })).toBeTruthy();
    expect(body.querySelector('.rhythm-history-view__logged-moments')).toBeTruthy();
    expect(body.contains(header)).toBe(false);
  });

  it('keeps the shared Info control keyboard-focusable', () => {
    render(<RhythmHistoryView rhythm={todayConnection} />);

    const disclosure = screen.getByRole('button', { name: 'Show Consistency and On Track score details' });
    disclosure.focus();
    expect(document.activeElement).toBe(disclosure);
  });

  it('distinguishes missing facts and fixtures without deriving or inventing data', async () => {
    const user = userEvent.setup();
    const rhythmWithoutHistory = {
      ...todayConnection,
      id: 'unillustrated-rhythm',
      completionHistory: undefined
    };
    const { rerender } = render(<RhythmHistoryView rhythm={rhythmWithoutHistory} />);

    expect(screen.getByRole('img', { name: 'Health: Not enough data' })).toBeTruthy();
    expect(screen.queryByText('Not enough data.')).toBeNull();
    expect(document.querySelector('.rhythm-history-view__health-heading > span')?.textContent).toBe('—');
    expect(document.querySelector('.rhythm-history-view__health-meter')?.classList.contains('neutral')).toBe(true);
    expect(document.querySelector('.rhythm-history-view__health-meter-fill')?.getAttribute('style')).toContain('0%');
    expect(screen.getByText('Dated completion history is unavailable for this Rhythm.')).toBeTruthy();
    expect(screen.queryByText('Your story starts with the first Tend.')).toBeNull();
    expect(screen.queryByRole('list', { name: 'Recorded completion count by date' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Show Consistency and On Track score details' }));
    const unavailableCalculation = document.querySelector('.rhythm-history-view__health-calculation') as HTMLElement;
    expect(within(unavailableCalculation).getByRole('heading', { name: 'How your Health score is calculated' })).toBeTruthy();
    expect(within(unavailableCalculation).getByText('75%', { exact: true })).toBeTruthy();
    expect(within(unavailableCalculation).getByText('25%', { exact: true })).toBeTruthy();
    expect(within(unavailableCalculation).getByText(/Health requires both scores/)).toBeTruthy();
    expect(unavailableCalculation.querySelectorAll('.rhythm-history-view__health-unavailable')).toHaveLength(1);
    expect(unavailableCalculation.textContent).not.toMatch(/[×=]/);
    rerender(<RhythmHistoryView rhythm={{ ...rhythmWithoutHistory, completionHistory: [] }} />);
    expect(screen.getByText('Your story starts with the first Tend.')).toBeTruthy();
    expect(screen.queryByText('Dated completion history is unavailable for this Rhythm.')).toBeNull();
    expect(document.querySelector('.rhythm-history-view__chart-placeholder-plot')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'unillustrated-rhythm' })).toBeNull();
    expect(prepareCompletionHistory(undefined)).toEqual({ kind: 'unavailable' });
    expect(prepareCompletionHistory([])).toEqual({ kind: 'empty', records: [] });
  });

  it('scores ordinary Daily Rhythms from dated history without confirmed scoring metadata', () => {
    const structuredDailyWithoutStart = {
      ...todayConnection,
      schedule: { frequency: 'daily' as const }
    };
    render(<RhythmHistoryView rhythm={structuredDailyWithoutStart} />);

    expect(screen.getByRole('meter', { name: 'Health score' })).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'Consistency score' })).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'On Track score' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).not.toContain('Confirm when tracking starts');
    expect(document.querySelector('.rhythm-history-view__completion-total strong')?.textContent).toBe('3');
    expect(screen.queryByText('Dated completion history is unavailable for this Rhythm.')).toBeNull();
  });

  it('keeps the rhythm title first and omits absent details while allowing long-title wrapping', () => {
    const longTitle = 'A deliberately long rhythm title that must wrap naturally without a description or schedule';
    const rhythmWithoutDetails = {
      ...todayConnection,
      title: longTitle,
      cadence: undefined,
      timeLabel: undefined,
      description: '   '
    };
    render(
      <RhythmHistoryView
        rhythm={rhythmWithoutDetails}
        people={syntheticPeople.slice(0, 2)}
        onPersonSelect={() => undefined}
        onClose={() => undefined}
      />
    );

    const title = screen.getByRole('heading', { name: longTitle });
    const people = screen.getByRole('group', { name: `People associated with ${longTitle}` });
    expect(title.compareDocumentPosition(people) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const titleRow = title.closest('.rhythm-history-view__title-row') as HTMLElement | null;
    expect(titleRow).toBeTruthy();
    const header = titleRow!.parentElement as HTMLElement;
    expect(within(header).getByRole('button', { name: 'Close details' })).toBeTruthy();
    expect(titleRow!.querySelector('button')).toBeNull();
    expect(document.querySelector('.rhythm-history-view__schedule')).toBeNull();
    expect(document.querySelector('.rhythm-history-view__description')).toBeNull();
    expect(screen.getAllByRole('heading', { name: longTitle })).toHaveLength(1);
  });

  it('prefills the shared editor, updates the full log while preserving identity, and restores Edit focus', async () => {
    const user = userEvent.setup();
    const record = savedRecord('editable-record', '2026-10-20', '10:10');
    const onUpdate = vi.fn(() => null);
    render(
      <RhythmHistoryView
        rhythm={todayConnection}
        datedCompletions={[record]}
        completionHistoryAvailable
        onUpdateCompletion={onUpdate}
      />
    );
    await user.click(screen.getByText('Logged moments (4)'));
    const editLabel = /Edit logged moment for Daily connection, Tuesday, October 20, 2026 at 10:10 AM/;
    await user.click(screen.getByRole('button', { name: editLabel }));

    expect(screen.getByRole('heading', { name: 'Edit logged moment' })).toBeTruthy();
    expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe('2026-10-20');
    expect(screen.getByRole('spinbutton', { name: 'Hour' }).getAttribute('aria-valuetext')).toBe('10');
    expect(screen.getByRole('spinbutton', { name: 'Minute' }).getAttribute('aria-valuetext')).toBe('10');
    expect(screen.getByRole('spinbutton', { name: 'AM / PM' }).getAttribute('aria-valuetext')).toBe('AM');

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-18' } });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: editLabel }));
    await user.click(screen.getByRole('button', { name: editLabel }));
    expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe('2026-10-20');

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-19' } });
    fireEvent.change(screen.getByLabelText(/Notes/), { target: { value: 'First line\nSecond line' } });
    fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Minute' }), { key: 'ArrowDown' });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onUpdate).toHaveBeenCalledOnce();
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      id: record.id,
      rhythmId: record.rhythmId,
      effectiveDate: '2026-10-19',
      localTime: '10:11',
      timeZone: 'UTC',
      recordedAt: record.recordedAt,
      memory: 'First line\nSecond line'
    }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: editLabel }));
  });

  it.each(['Cancel', 'Escape', 'Close'] as const)(
    'discards a new Logged moments draft with %s and restores the logging opener',
    async action => {
      const user = userEvent.setup();
      const onSave = vi.fn(() => null);
      const onClose = vi.fn();
      render(
        <RhythmHistoryView
          rhythm={{ ...todayConnection, completionHistory: [] }}
          completionHistoryAvailable
          onSaveCompletion={onSave}
          onClose={onClose}
        />
      );
      await user.click(screen.getByText('Logged moments (0)'));
      const history = screen.getByRole('region', { name: `History for ${todayConnection.title}` });
      const opener = screen.getByRole('button', { name: '+ Log a moment' });
      expect(opener.classList.contains('button')).toBe(true);
      expect(opener.classList.contains('button-secondary')).toBe(true);
      await user.click(opener);
      const recording = screen.getByRole('dialog', { name: 'When did you tend it?' });
      expect(recording.getAttribute('aria-modal')).toBe('true');
      expect(history.hasAttribute('inert')).toBe(true);
      expect(history.querySelector('.rhythm-history-view__logged-moments')).toBeTruthy();
      expect(within(recording).getByRole('heading', { name: 'When did you tend it?' })).toBeTruthy();
      expect(recording.contains(document.activeElement)).toBe(true);
      expect(within(recording).getByRole('button', { name: 'Cancel logging moment' }).getAttribute('type'))
        .toBe('button');
      fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-14' } });
      fireEvent.change(screen.getByLabelText(/Notes/), { target: { value: 'Unsaved note' } });

      if (action === 'Cancel') {
        await user.click(screen.getByRole('button', { name: 'Cancel' }));
      } else if (action === 'Escape') {
        await user.keyboard('{Escape}');
      } else {
        await user.click(screen.getByRole('button', { name: 'Cancel logging moment' }));
      }

      expect(onSave).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.queryByRole('heading', { name: 'When did you tend it?' })).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: '+ Log a moment' }));
      expect(screen.getByText('Logged moments (0)')).toBeTruthy();
      expect((screen.getByRole('button', { name: '+ Log a moment' }).closest('details') as HTMLDetailsElement).open)
        .toBe(true);
    }
  );

  it('traps keyboard focus in the logging popup and keeps a failed draft open', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => 'The preview could not save this completion.');
    render(
      <RhythmHistoryView
        rhythm={{ ...todayConnection, completionHistory: [] }}
        completionHistoryAvailable
        onSaveCompletion={onSave}
      />
    );
    await user.click(screen.getByText('Logged moments (0)'));
    await user.click(screen.getByRole('button', { name: '+ Log a moment' }));

    const recording = screen.getByRole('dialog', { name: 'When did you tend it?' });
    const focusable = Array.from(recording.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '' } });
    await user.click(within(recording).getByRole('button', { name: 'Save' }));
    expect(within(recording).getByLabelText('Date').getAttribute('aria-invalid')).toBe('true');
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-14' } });
    fireEvent.change(screen.getByLabelText(/Notes/), { target: { value: 'Keep this draft.' } });
    await user.click(within(recording).getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('dialog', { name: 'When did you tend it?' })).toBe(recording);
    expect(within(recording).getByLabelText(/Notes/)).toHaveProperty('value', 'Keep this draft.');
    expect(within(recording).getByRole('alert').textContent)
      .toBe('The preview could not save this completion.');
  });

  it.each(['Cancel', 'Escape', 'Close click', 'Close keyboard'] as const)(
    'dismisses a logged-moment draft with %s and returns to its Edit control',
    async action => {
      const user = userEvent.setup();
      const record = savedRecord('dismiss-edit', '2026-10-16', '10:10', 'Original note');
      const onUpdate = vi.fn(() => null);
      const onClose = vi.fn();
      render(
        <RhythmHistoryView
          rhythm={todayConnection}
          datedCompletions={[record]}
          completionHistoryAvailable
          onUpdateCompletion={onUpdate}
          onClose={onClose}
        />
      );
      await user.click(screen.getByText(/^Logged moments/));
      const editLabel = /Edit logged moment for Daily connection, Friday, October 16, 2026 at 10:10 AM/;
      await user.click(screen.getByRole('button', { name: editLabel }));
      fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-18' } });
      fireEvent.change(screen.getByLabelText(/Notes/), { target: { value: 'Unsaved note' } });

      if (action === 'Cancel') {
        await user.click(screen.getByRole('button', { name: action }));
      } else if (action === 'Escape') {
        await user.keyboard('{Escape}');
      } else {
        const close = screen.getByRole('button', { name: 'Cancel editing logged moment' });
        expect(close.getAttribute('type')).toBe('button');
        if (action === 'Close keyboard') {
          close.focus();
          await user.keyboard(' ');
        } else {
          await user.click(close);
        }
      }

      expect(onUpdate).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.queryByRole('heading', { name: 'Edit logged moment' })).toBeNull();
      expect(screen.getByText('Original note')).toBeTruthy();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: editLabel }));
    }
  );

  it.each(['Cancel', 'Escape', 'Close click', 'Close keyboard'] as const)(
    'dismisses full-details completion entry with %s and restores Tend focus',
    async action => {
      const user = userEvent.setup();
      const onSave = vi.fn(() => null);
      const onClose = vi.fn();
      render(<RhythmDetailsDialog rhythm={connection} onSaveCompletion={onSave} onClose={onClose} />);
      await user.click(screen.getByRole('button', { name: 'Tend Daily Connection' }));
      const formDialog = screen.getByRole('dialog', { name: 'When did you tend it?' });
      fireEvent.change(within(formDialog).getByLabelText('Date'), { target: { value: '2026-10-18' } });
      fireEvent.change(within(formDialog).getByLabelText(/Notes/), { target: { value: 'Unsaved note' } });

      if (action === 'Cancel') {
        await user.click(within(formDialog).getByRole('button', { name: action }));
      } else if (action === 'Escape') {
        await user.keyboard('{Escape}');
      } else {
        const close = within(formDialog).getByRole('button', { name: 'Close completion' });
        if (action === 'Close keyboard') {
          close.focus();
          await user.keyboard('{Enter}');
        } else {
          await user.click(close);
        }
      }

      expect(onSave).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog', { name: 'Daily Connection' })).toBeTruthy();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tend Daily Connection' }));
    }
  );

  it('omits empty memory, preserves long multiline memory, and confirms deletion of one record', async () => {
    const user = userEvent.setup();
    render(<EditableHistoryHarness />);
    await user.click(screen.getByText('Logged moments (5)'));

    const entries = document.querySelectorAll('.rhythm-history-view__logged-entry');
    const emptyMemoryEntry = [...entries].find(entry => entry.textContent?.includes('Wednesday, October 21, 2026'))!;
    expect(emptyMemoryEntry.querySelector('.rhythm-history-view__logged-entry-memory')).toBeNull();
    const memoryEntry = [...entries].find(entry => entry.textContent?.includes('Monday, October 19, 2026'))!;
    expect(memoryEntry.querySelector('.rhythm-history-view__logged-entry-memory')?.textContent)
      .toBe('A long memory\nthat preserves its line break.');

    const deleteLabel = /Delete logged moment for Daily connection, Wednesday, October 21, 2026 at 10:10 AM/;
    await user.click(screen.getByRole('button', { name: deleteLabel }));
    const confirmation = screen.getByRole('alertdialog');
    expect(within(confirmation).getByText(/Delete Daily connection from Wednesday, October 21, 2026 at 10:10 AM/)).toBeTruthy();
    expect(document.activeElement).toBe(within(confirmation).getByRole('button', { name: 'Cancel' }));
    await user.click(within(confirmation).getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: deleteLabel }));

    await user.click(screen.getByRole('button', { name: deleteLabel }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete moment' }));
    expect(screen.getByText('Logged moments (4)')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', {
      name: /Delete logged moment for Daily connection, Monday, October 19, 2026 at 9:15 AM/
    }));
    expect(document.querySelector('.rhythm-history-view__completion-total strong')?.textContent).toBe('4');
    const chart = screen.getByRole('list', { name: 'Recorded completion count by date' });
    expect([...chart.querySelectorAll('li')].reduce((total, day) =>
      total + Number(day.getAttribute('aria-label')?.match(/: (\d+)/)?.[1] ?? 0), 0
    )).toBe(4);
    expect(chart.querySelector('li:last-child time')?.getAttribute('dateTime'))
      .toBe(localDateString(new Date()));
    expect(chart.querySelector('li:last-child')?.getAttribute('aria-label'))
      .toContain('no completion recorded yet, today');
  });

  it('keeps the chart through today when the latest completion is edited and deleted', async () => {
    const user = userEvent.setup();
    render(<EditableHistoryHarness />);
    await user.click(screen.getByText('Logged moments (5)'));

    const editButton = screen.getByRole('button', {
      name: /Edit logged moment for Daily connection, Wednesday, October 21, 2026 at 10:10 AM/
    });
    await user.click(editButton);
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-22' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    let chart = screen.getByRole('list', { name: 'Recorded completion count by date' });
    expect(chart.querySelector('li:last-child time')?.getAttribute('dateTime'))
      .toBe(localDateString(new Date()));
    expect(within(chart).getByRole('listitem', {
      name: 'Thursday, October 22, 2026: 1 completion'
    })).toBeTruthy();

    await user.click(screen.getByRole('button', {
      name: /Delete logged moment for Daily connection, Thursday, October 22, 2026 at 10:10 AM/
    }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete moment' }));

    chart = screen.getByRole('list', { name: 'Recorded completion count by date' });
    expect(chart.querySelector('li:last-child time')?.getAttribute('dateTime'))
      .toBe(localDateString(new Date()));
    expect(chart.querySelector('li:last-child')?.getAttribute('aria-label'))
      .toContain('no completion recorded yet, today');
    expect(within(chart).queryByRole('listitem', {
      name: 'Thursday, October 22, 2026: 1 completion'
    })).toBeNull();
  });

  it('keeps archived history read-only and routes its close action to the outer modal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<RhythmDetailsDialog rhythm={connection} archived onClose={onClose} />);
    const historyButton = screen.getByRole('button', { name: 'View scores and history for Daily Connection' });
    await user.click(historyButton);

    expect(screen.getByRole('region', { name: 'History for Daily Connection' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Tend/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Edit / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete logged moment/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Close details' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps the existing modal Close control in its independent header column', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<RhythmDetailsDialog rhythm={connection} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'View scores and history for Daily Connection' }));

    const history = screen.getByRole('region', { name: 'History for Daily Connection' });
    expect(document.activeElement).toBe(history);
    expect(history.tabIndex).toBe(-1);

    const title = screen.getByRole('heading', { name: 'Daily Connection' });
    const titleRow = title.closest('.rhythm-history-view__title-row') as HTMLElement | null;
    expect(titleRow).toBeTruthy();
    await user.tab();
    const closeButton = within(titleRow!.parentElement as HTMLElement).getByRole('button', { name: 'Close details' });
    expect(document.activeElement).toBe(closeButton);
    await user.click(closeButton);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('opens history with Enter and preserves keyboard tab order through controls', async () => {
    const user = userEvent.setup();
    render(
      <RhythmDetailsDialog
        rhythm={todayConnection}
        onClose={vi.fn()}
        onUpdateCompletion={() => null}
        onDeleteCompletion={() => null}
      />
    );

    const historyButton = screen.getByRole('button', {
      name: `View scores and history for ${todayConnection.title}`
    });
    let reachedHistoryButton = false;
    for (let index = 0; index < 12 && !reachedHistoryButton; index += 1) {
      await user.tab();
      reachedHistoryButton = document.activeElement === historyButton;
    }
    expect(reachedHistoryButton).toBe(true);
    await user.keyboard('{Enter}');

    const history = screen.getByRole('region', { name: `History for ${todayConnection.title}` });
    expect(document.activeElement).toBe(history);
    expect(history.tabIndex).toBe(-1);

    const tabUntil = async (target: HTMLElement) => {
      for (let index = 0; index < 24 && document.activeElement !== target; index += 1) {
        await user.tab();
      }
      return document.activeElement === target;
    };

    await user.tab();
    const closeButton = screen.getByRole('button', { name: 'Close details' });
    expect(document.activeElement).toBe(closeButton);

    const healthDisclosure = screen.getByRole('button', { name: 'Show Consistency and On Track score details' });
    expect(await tabUntil(healthDisclosure)).toBe(true);

    const chart = screen.getByRole('region', {
      name: 'Completion history chart; scroll horizontally for older dates'
    });
    expect(await tabUntil(chart)).toBe(true);

    const loggedMoments = screen.getByText('Logged moments (3)');
    expect(await tabUntil(loggedMoments)).toBe(true);
    await user.keyboard(' ');

    const editButton = screen.getAllByRole('button', {
      name: /Edit logged moment for Daily connection/
    })[0]!;
    expect(await tabUntil(editButton)).toBe(true);
    const deleteButton = screen.getAllByRole('button', {
      name: /Delete logged moment for Daily connection/
    })[0]!;
    expect(await tabUntil(deleteButton)).toBe(true);
  });

  it('keeps seeded completion entries read-only when mutation callbacks are absent', async () => {
    const user = userEvent.setup();
    render(<RhythmHistoryView rhythm={todayConnection} completionHistoryAvailable />);
    await user.click(screen.getByText('Logged moments (3)'));
    expect(screen.queryByRole('button', { name: /Edit logged moment for Daily connection/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete logged moment for Daily connection/ })).toBeNull();
  });

  it('routes Escape through the existing outer dialog close flow', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<RhythmDetailsDialog rhythm={connection} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'View scores and history for Daily Connection' }));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });
});
