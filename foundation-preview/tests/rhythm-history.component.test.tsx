import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
        fullOverdueDates: ['2026-10-20', '2026-10-21', '2026-10-22'],
        pointsPerFullUntendedDay: 10
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
    expect(example.onTrack.days.map(item => [item.date, item.status, item.score])).toEqual([
      ['2026-10-19', 'tended', 100],
      ['2026-10-20', 'not-tended', 90],
      ['2026-10-21', 'not-tended', 80],
      ['2026-10-22', 'not-tended', 70],
      ['2026-10-23', 'as-of', 70]
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
    expect(meter.getAttribute('aria-valuetext')).toBe('0 out of 100, illustrative example');
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
    expect(zeroMeter.getAttribute('aria-valuetext')).toBe('0 out of 100, illustrative blend');
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
  });

  it('prepares a single local date and keeps empty and unavailable history distinct', () => {
    expect(prepareDailyCompletionCounts([
      { id: 'one', effectiveDate: '2026-11-01' }
    ])).toEqual([{ date: '2026-11-01', count: 1, recordIds: ['one'] }]);
    expect(prepareCompletionHistory([])).toEqual({ kind: 'empty', records: [] });
    expect(prepareCompletionHistory(undefined)).toEqual({ kind: 'unavailable' });
  });

  it('shows the available Today example with factual counts and newest-first logs', async () => {
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
    expect(completionSummary.querySelector('.rhythm-history-view__completion-span')?.textContent)
      .toBe('across 4 days');
    expect(within(history).queryByRole('heading', { name: 'Recent opportunities' })).toBeNull();
    expect(within(history).queryByText(/past opportunities completed/)).toBeNull();
    expect(history.querySelector('.rhythm-history-view__opportunity-list, .rhythm-history-view__legend')).toBeNull();
    expect(within(history).getByText('Illustrative example · not from saved logs · as of Oct 23, 2026.')).toBeTruthy();
    const scoreSection = within(history).getByRole('region', { name: 'Health, Consistency, and On Track scores' });
    const completionSection = within(history).getByRole('region', { name: 'All completion history' });
    expect(scoreSection.compareDocumentPosition(completionSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(completionSection.querySelector('.rhythm-history-view__logged-moments')).toBeTruthy();

    const chart = within(history).getByRole('list', { name: 'Recorded completion count by date' });
    const chartDates = [...chart.querySelectorAll('time')].map(time => time.getAttribute('dateTime'));
    expect(chartDates).toEqual(['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20']);
    expect([...chart.querySelectorAll('li')].map(item => item.getAttribute('aria-label'))).toEqual([
      'Saturday, October 17, 2026: 1 completion',
      'Sunday, October 18, 2026: 1 completion',
      'Monday, October 19, 2026: no recorded completions',
      'Tuesday, October 20, 2026: 1 completion'
    ]);
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
    expect(summary.querySelector('.rhythm-history-view__completion-span')?.textContent)
      .toBe('across 1 day');
    expect(within(completionSection).getByRole('listitem', {
      name: 'Friday, October 23, 2026: 1 completion, today'
    })).toBeTruthy();
  });

  it('shows the approved Health and On Track breakdowns within their shared details region', async () => {
    const user = userEvent.setup();
    render(<RhythmHistoryView rhythm={todayConnection} />);

    expect(screen.getAllByRole('meter')).toHaveLength(3);
    const healthMeter = screen.getByRole('meter', { name: 'Health score' });
    expect(healthMeter.getAttribute('aria-valuenow')).toBe('75');
    expect(healthMeter.getAttribute('aria-valuetext')).toBe('75 out of 100, illustrative blend');
    expect(screen.getByRole('heading', { name: 'Health' })).toBeTruthy();
    expect(screen.getByText('75% Consistency · 25% On Track')).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuenow')).toBe('77');
    expect(screen.getByRole('meter', { name: 'On Track score' }).getAttribute('aria-valuenow')).toBe('70');
    expect(screen.getByText('Consistency over the applicable historical window')).toBeTruthy();
    expect(screen.getByText('Current follow-through for a daily Rhythm')).toBeTruthy();
    const consistency = screen.getByRole('region', { name: 'Consistency' });
    const onTrack = screen.getByRole('region', { name: 'On Track' });
    const info = screen.getByRole('button', { name: 'Show Consistency and On Track score details' });
    const details = document.getElementById(info.getAttribute('aria-controls')!)!;
    expect(details.hidden).toBe(true);
    expect(document.querySelectorAll('.rhythm-history-view__score-card')).toHaveLength(1);
    expect(document.querySelectorAll('.rhythm-history-view__score-summary')).toHaveLength(2);
    expect(document.querySelectorAll('.rhythm-history-view__score-info')).toHaveLength(1);
    expect(info.getAttribute('aria-expanded')).toBe('false');
    expect(info.getAttribute('aria-controls')).toBe(details.id);
    expect(within(consistency).queryByText('30 moments')).toBeNull();
    expect(within(onTrack).queryByText('3 days')).toBeNull();
    await user.click(info);
    expect(details.hidden).toBe(false);
    expect(info.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(info);
    expect(info.getAttribute('aria-label')).toBe('Hide Consistency and On Track score details');
    expect(screen.getByRole('group', { name: 'Consistency and On Track score details' })).toBe(details);
    const blendedCalculation = details.querySelector('.rhythm-history-view__blended-calculation')!;
    expect(blendedCalculation.textContent?.replace(/\s+/g, ' ').trim())
      .toBe('Health calculation: 76.67 × 75% + 70 × 25% = 75');
    const healthDetails = details.querySelector('.rhythm-history-view__score-details-column:first-child') as HTMLElement;
    const onTrackDetails = details.querySelector('.rhythm-history-view__score-details-column:last-child') as HTMLElement;
    expect(within(healthDetails).getByText('30 moments')).toBeTruthy();
    expect(within(healthDetails).getByText('23 moments')).toBeTruthy();
    expect(within(healthDetails).getByText('7 moments')).toBeTruthy();
    expect(within(healthDetails).getByText('Scheduled')).toBeTruthy();
    const healthFormula = healthDetails.querySelector('.rhythm-history-view__calculation')!;
    expect(healthFormula.textContent?.replace(/\s+/g, '')).toBe('23÷30×100=77%');
    expect(healthFormula.querySelector('strong')?.textContent).toBe('77%');
    const pattern = within(healthDetails).getByRole('img', {
      name: 'Thirty eligible daily due moments: 23 completed and 7 not completed.'
    });
    expect(pattern.querySelectorAll('.rhythm-history-view__health-pattern-day:not(.rhythm-history-view__health-pattern-day--missed)'))
      .toHaveLength(23);
    expect(pattern.querySelectorAll('.rhythm-history-view__health-pattern-day--missed')).toHaveLength(7);
    expect(within(healthDetails).getByText('23 completed')).toBeTruthy();
    expect(within(healthDetails).getByText('7 not completed')).toBeTruthy();

    expect(within(onTrackDetails).getByText(/Last tended/)).toBeTruthy();
    expect(within(onTrackDetails).getByText('Oct 19')).toBeTruthy();
    expect(within(onTrackDetails).getByText('3 days')).toBeTruthy();
    expect(within(onTrackDetails).getByText('10 points')).toBeTruthy();
    const onTrackFormula = onTrackDetails.querySelector('.rhythm-history-view__calculation')!;
    expect(onTrackFormula.textContent?.replace(/\s+/g, '')).toBe('100−30=70');
    expect(onTrackFormula.querySelector('strong')?.textContent).toBe('70');
    expect(within(onTrackDetails).getAllByRole('listitem').map(item => {
      const label = item.querySelector('span')?.textContent?.replace(/\s+/g, ' ').trim();
      const score = item.querySelector('strong')?.textContent;
      return `${label} ${score}`;
    })).toEqual([
      'Oct 19 · tended 100',
      'Oct 20 · not tended 90',
      'Oct 21 · not tended 80',
      'Oct 22 · not tended 70',
      'Oct 23 · today in example Still 70'
    ]);
    expect(screen.getAllByText('Illustrative example · not from saved logs · as of Oct 23, 2026.')).toHaveLength(1);
    expect(within(healthDetails).queryByText(/eligible due occurrence counts once|overdue time|pre-activation|Foundation-weighted|Health windows are/)).toBeNull();
    expect(within(onTrackDetails).queryByText(/calendar-day span|floors at zero|rules for weekly/)).toBeNull();
    expect(within(healthDetails).queryByText(/76\.7|→/)).toBeNull();
    expect(within(details).getByRole('heading', { name: 'Your 30-day pattern' })).toBeTruthy();
    expect(within(details).getByRole('heading', { name: 'How it changed' })).toBeTruthy();
  });

  it('toggles both score breakdowns with the shared Info control by pointer and keyboard', async () => {
    const user = userEvent.setup();
    render(<RhythmHistoryView rhythm={todayConnection} />);
    const info = screen.getByRole('button', { name: 'Show Consistency and On Track score details' });
    const details = document.getElementById(info.getAttribute('aria-controls')!)!;

    await user.click(info);
    expect(details.hidden).toBe(false);
    expect(info.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(info);

    await user.click(info);
    expect(details.hidden).toBe(true);
    expect(info.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(info);

    await user.keyboard('{Enter}');
    expect(details.hidden).toBe(false);
    expect(info.getAttribute('aria-expanded')).toBe('true');
    await user.keyboard(' ');
    expect(details.hidden).toBe(true);
    expect(info.getAttribute('aria-expanded')).toBe('false');
  });

  it('orders shared header details and actual associations before schedule metadata', () => {
    render(
      <RhythmHistoryView
        rhythm={{ ...connection, categoryIds: ['marriage', 'faith'] }}
        people={syntheticPeople.slice(0, 2)}
        onPersonSelect={() => undefined}
      />
    );

    const header = document.querySelector('.rhythm-history-view__rhythm-header') as HTMLElement;
    const title = within(header).getByRole('heading', { name: 'Daily Connection' }) as HTMLElement;
    const description = within(header).getByText('Make a little room each day to connect in a way that fits your life.') as HTMLElement;
    const people = within(header).getByRole('group', { name: 'People associated with Daily Connection' }) as HTMLElement;
    const categories = within(header).getByRole('group', { name: 'Associated categories' }) as HTMLElement;
    const schedule = within(header).getByText('5 times a week') as HTMLElement;
    const order = (before: Node, after: Node) => Boolean(
      before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING
    );

    expect(order(title, description)).toBe(true);
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
    const titleRow = header.querySelector('.rhythm-history-view__title-row')!;
    const closeButton = within(header).getByRole('button', { name: 'Close details' });
    expect(titleRow.contains(closeButton)).toBe(false);
    expect(within(header).getByRole('heading', { name: title })).toBeTruthy();
    expect(within(header).getByText(description)).toBeTruthy();
    expect(header.classList.contains('rhythm-history-view__rhythm-header')).toBe(true);
    expect(closeButton.classList.contains('today-rhythm-details__close--history')).toBe(true);
    expect(closeButton.getAttribute('aria-label')).toBe('Close details');
  });

  it('keeps the shared Info control keyboard-focusable', () => {
    render(<RhythmHistoryView rhythm={todayConnection} />);

    const disclosure = screen.getByRole('button', { name: 'Show Consistency and On Track score details' });
    disclosure.focus();
    expect(document.activeElement).toBe(disclosure);
  });

  it('distinguishes missing facts and fixtures without deriving or inventing data', () => {
    const rhythmWithoutHistory = {
      ...todayConnection,
      id: 'unillustrated-rhythm',
      completionHistory: undefined
    };
    const { rerender } = render(<RhythmHistoryView rhythm={rhythmWithoutHistory} />);

    expect(screen.getByRole('img', { name: 'Health: Not enough data' })).toBeTruthy();
    expect(screen.getByText('Not enough data.')).toBeTruthy();
    expect(document.querySelector('.rhythm-history-view__health-heading > span')?.textContent).toBe('—');
    expect(document.querySelector('.rhythm-history-view__health-meter')?.classList.contains('neutral')).toBe(true);
    expect(document.querySelector('.rhythm-history-view__health-meter-fill')?.getAttribute('style')).toContain('0%');
    expect(screen.getByText('Dated completion history is unavailable for this Rhythm.')).toBeTruthy();
    expect(screen.queryByText('Your story starts with the first Tend.')).toBeNull();
    expect(screen.queryByRole('list', { name: 'Recorded completion count by date' })).toBeNull();
    rerender(<RhythmHistoryView rhythm={{ ...rhythmWithoutHistory, completionHistory: [] }} />);
    expect(screen.getByText('Your story starts with the first Tend.')).toBeTruthy();
    expect(screen.queryByText('Dated completion history is unavailable for this Rhythm.')).toBeNull();
    expect(document.querySelector('.rhythm-history-view__chart-placeholder-plot')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'unillustrated-rhythm' })).toBeNull();
    expect(prepareCompletionHistory(undefined)).toEqual({ kind: 'unavailable' });
    expect(prepareCompletionHistory([])).toEqual({ kind: 'empty', records: [] });
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
