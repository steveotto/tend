import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RhythmDetailsDialog } from '../src/components/RhythmDetailsDialog.tsx';
import { HealthScoreMeter, RhythmHistoryView } from '../src/components/RhythmHistoryView.tsx';
import { RhythmMetadata } from '../src/components/RhythmMetadata.tsx';
import {
  formatRhythmSeasonDateRange,
  RhythmSeasonCard
} from '../src/components/RhythmSeasonCard.tsx';
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
import type { RhythmPreview } from '../src/domain/preview-data.ts';
import type { DatedRhythmCompletion } from '../src/domain/rhythm-completion.ts';
import { addCalendarDays, localDateInTimeZone } from '../src/domain/rhythm-scoring.ts';
import type { RhythmSchedule } from '../src/domain/rhythm-schedule.ts';
import {
  createRhythmSeason,
  createUnknownRhythmSeason,
  rhythmSeasonPaletteAssignments,
  rhythmSeasonPaletteForOrdinal
} from '../src/domain/rhythm-seasons.ts';
import { localDateString } from '../src/domain/money-goals.ts';
import { formatRhythmSchedule } from '../src/domain/rhythm-schedule.ts';
import { historyButtonName } from './history-button-name.ts';

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

function seasonDateLabel(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function scoredTodayFixture() {
  const asOfDate = localDateInTimeZone(new Date(), 'UTC');
  const trackingStartDate = addCalendarDays(asOfDate, -30);
  const schedule = { frequency: 'daily' as const };
  const scoring = {
    trackingStartDate,
    timeZone: 'UTC',
    scheduleHistory: [createRhythmSeason('history-fixture', trackingStartDate, schedule)]
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
      scheduleHistory: [createRhythmSeason('history-fixture', trackingStartDate, schedule)]
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
  it('formats Season date ranges compactly while retaining full accessible dates', () => {
    expect(formatRhythmSeasonDateRange('2026-09-01', '2026-10-16')).toEqual({
      display: 'Sep 1 – Oct 16, 2026',
      accessible: 'Sep 1, 2026 – Oct 16, 2026'
    });
    expect(formatRhythmSeasonDateRange('2026-10-17', '2026-10-20')).toEqual({
      display: 'Oct 17 – Oct 20, 2026',
      accessible: 'Oct 17, 2026 – Oct 20, 2026'
    });
    expect(formatRhythmSeasonDateRange('2025-12-01', '2026-01-31')).toEqual({
      display: 'Dec 1, 2025 – Jan 31, 2026',
      accessible: 'Dec 1, 2025 – Jan 31, 2026'
    });
    expect(formatRhythmSeasonDateRange('2026-10-25', undefined, 'Present')).toEqual({
      display: 'Oct 25, 2026 – Present',
      accessible: 'Oct 25, 2026 – Present'
    });
    expect(formatRhythmSeasonDateRange(undefined, '2026-10-16')).toEqual({
      display: 'Start unknown – Oct 16, 2026',
      accessible: 'Start date not recorded – Oct 16, 2026'
    });
  });

  it('shortens missing Season metadata visibly and keeps the complete labels accessible', () => {
    render(
      <RhythmSeasonCard
        seasonKind="unknown"
        paletteToken="clay"
        seasonId="unknown-season"
        title="Earlier schedule needs details"
        dateRange={{ endDate: '2026-10-19' }}
        timeLabel="Time of day not recorded"
        scheduleLabel="Schedule details unavailable."
      />
    );
    const card = screen.getByRole('article', { name: 'Earlier schedule needs details' });
    const timeframe = card.querySelector('.rhythm-history-view__season-card-timeframe')!;
    const metadata = card.querySelector('.rhythm-history-view__season-card-metadata')!;
    expect(timeframe.textContent).toBe('Start unknown – Oct 19, 2026');
    expect(timeframe.getAttribute('aria-label')).toBe('Start date not recorded – Oct 19, 2026');
    expect(metadata.textContent).toContain('Time unknown');
    expect(metadata.querySelector('[aria-label="Time of day not recorded"]')).toBeTruthy();
  });

  it('shows a collapsed single known Season without an Earlier heading or timeline', async () => {
    const user = userEvent.setup();
    const startDate = localDateInTimeZone(new Date(), 'UTC');
    const schedule = { frequency: 'daily' as const };
    const season = createRhythmSeason(todayConnection.id, startDate, schedule);
    render(
      <RhythmHistoryView
        rhythm={{
          ...todayConnection,
          schedule,
          completionHistory: [],
          scoring: {
            trackingStartDate: startDate,
            timeZone: 'UTC',
            scheduleHistory: [season]
          }
        }}
      />
    );
    const history = screen.getByRole('region', { name: `History for ${todayConnection.title}` });
    expect(within(history).getByText('1 season')).toBeTruthy();
    expect(within(history).queryByRole('button', { name: 'Add a Season' })).toBeNull();
    expect(within(history).getByRole('button', { name: 'Show Seasons' }).getAttribute('aria-expanded'))
      .toBe('false');
    expect(within(history).queryByRole('heading', { name: 'Earlier Seasons' })).toBeNull();
    expect(within(history).queryByRole('group', { name: /schedule history timeline/i })).toBeNull();

    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
    expect(within(history).getByRole('heading', { name: 'Daily' })).toBeTruthy();
    const card = within(history).getByRole('heading', { name: 'Daily' }).closest('article')!;
    expect(card.querySelector('.rhythm-history-view__season-card-timeframe')?.textContent)
      .toBe(`${seasonDateLabel(startDate)} – Present`);
    expect(card.querySelector('.rhythm-history-view__season-date-range')).toBeNull();
    expect(within(history).queryByRole('heading', { name: 'Earlier Seasons' })).toBeNull();
    expect(within(history).queryByRole('group', { name: /schedule history timeline/i })).toBeNull();
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it('defaults a display-only current Season to the earliest dated log', async () => {
    const user = userEvent.setup();
    const schedule = { frequency: 'daily' as const };
    const onChooseSchedule = vi.fn();
    const onEditSeason = vi.fn(() => null);
    render(
      <RhythmHistoryView
        rhythm={{ ...todayConnection, schedule }}
        onChooseSchedule={onChooseSchedule}
        onEditSeason={onEditSeason}
      />
    );
    const history = screen.getByRole('region', { name: `History for ${todayConnection.title}` });
    expect(within(history).getByText('1 season')).toBeTruthy();
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
    expect(within(history).getByRole('heading', { name: 'Daily' })).toBeTruthy();
    expect(within(history).getByText('Start unknown – Present')).toBeTruthy();
    expect(within(history).getByRole('button', { name: 'Edit Daily' })).toBeTruthy();
    const opener = within(history).getByRole('button', { name: 'Edit Daily' });
    await user.click(opener);
    const editor = screen.getByRole('dialog', { name: 'Edit season' });
    expect(within(editor).getByRole('combobox', { name: /^Frequency:/ }).textContent).toContain('Daily');
    const startDate = within(editor).getByLabelText('Starting date');
    expect(startDate).toHaveProperty('value', '2026-10-17');
    await user.click(within(editor).getByRole('button', { name: 'Starting date help' }));
    expect(screen.getByRole('dialog', { name: 'Starting date' }).textContent)
      .toContain('Starting date defaults to the earliest logged moment, or today if there are no logs.');
    await user.click(screen.getByRole('button', { name: 'Close starting date help' }));
    expect(onChooseSchedule).not.toHaveBeenCalled();
    fireEvent(editor, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog', { name: 'Edit season' })).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(onEditSeason).not.toHaveBeenCalled();
  });

  it('defaults a display-only current Season to today when there are no dated logs', async () => {
    const user = userEvent.setup();
    const schedule = { frequency: 'daily' as const };
    const rhythm = {
      ...todayConnection,
      schedule,
      completionHistory: [],
      scoring: { trackingStartDate: '2026-10-01', timeZone: 'UTC', scheduleHistory: [] }
    };
    render(<RhythmHistoryView rhythm={rhythm} onEditSeason={() => null} />);
    const history = screen.getByRole('region', { name: `History for ${todayConnection.title}` });
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
    await user.click(within(history).getByRole('button', { name: 'Edit Daily' }));

    expect(screen.getByLabelText('Starting date'))
      .toHaveProperty('value', localDateInTimeZone(new Date(), 'UTC'));
  });

  it('shows the Add Season action only inside the expanded Seasons section for editable history', async () => {
    const user = userEvent.setup();
    const startDate = localDateInTimeZone(new Date(), 'UTC');
    const schedule = { frequency: 'daily' as const };
    const season = createRhythmSeason(todayConnection.id, startDate, schedule);
    const onEditSeason = vi.fn(() => null);
    render(
      <RhythmHistoryView
        rhythm={{
          ...todayConnection,
          schedule,
          completionHistory: [],
          scoring: { trackingStartDate: startDate, timeZone: 'UTC', scheduleHistory: [season] }
        }}
        onEditSeason={onEditSeason}
      />
    );
    const history = screen.getByRole('region', { name: `History for ${todayConnection.title}` });
    const header = within(history).getByRole('heading', { name: 'Seasons' }).parentElement!;
    expect(header.querySelector('.rhythm-history-view__seasons-count')?.textContent).toBe('1 season');
    expect(within(header).getByRole('button', { name: 'Show Seasons' })).toBeTruthy();
    expect(within(history).queryByRole('button', { name: 'Add a Season' })).toBeNull();

    const toggle = within(header).getByRole('button', { name: 'Show Seasons' });
    toggle.focus();
    await user.keyboard('{Enter}');
    const content = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    const addButton = within(content).getByRole('button', { name: 'Add a Season' });
    expect(content.contains(addButton)).toBe(true);
    const addRow = addButton.parentElement!;
    expect(addRow.className).toContain('rhythm-history-view__season-add-row');
    expect(addRow.querySelector('.rhythm-history-view__seasons-info-copy')?.textContent)
      .toBe('Seasons organize your schedule as it changes. Your logs stay saved, and each is scored using the schedule in place at the time.');
    addButton.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: 'Add a season' })).toBeTruthy();
    expect(onEditSeason).not.toHaveBeenCalled();
  });

  it('shows an unrecorded start date in the current card footer without inventing a date', async () => {
    const user = userEvent.setup();
    const rhythm = {
      ...todayConnection,
      schedule: { frequency: 'daily' as const },
      completionHistory: [],
      scoring: { trackingStartDate: '2026-10-01', timeZone: 'UTC', scheduleHistory: [] }
    };
    render(<RhythmHistoryView rhythm={rhythm} onEditSeason={() => null} />);
    const history = screen.getByRole('region', { name: `History for ${todayConnection.title}` });
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
    const card = within(history).getByRole('heading', { name: 'Daily' }).closest('article')!;
    expect(card.querySelector('.rhythm-history-view__season-card-timeframe')?.textContent)
      .toBe('Start unknown – Present');
    expect(card.querySelector('.rhythm-history-view__season-card-timeframe')?.getAttribute('aria-label'))
      .toBe('Start date not recorded – Present');
    expect(card.querySelector('.rhythm-history-view__season-card-metadata')?.textContent)
      .toContain('Time unknown');
    expect(card.querySelector('.rhythm-history-view__season-card-metadata [aria-label="Time of day not recorded"]'))
      .toBeTruthy();
  });

  it('shows a single structured Season with saved logs and keeps archived schedules read-only', async () => {
    const user = userEvent.setup();
    const asOfDate = localDateInTimeZone(new Date(), 'UTC');
    const schedule = { frequency: 'daily' as const };
    const season = createRhythmSeason(todayConnection.id, asOfDate, schedule);
    const rhythm = {
      ...todayConnection,
      schedule,
      completionHistory: [],
      scoring: {
        trackingStartDate: asOfDate,
        timeZone: 'UTC',
        scheduleHistory: [season]
      }
    };
    const onChooseSchedule = vi.fn();
    render(
      <RhythmHistoryView
        rhythm={rhythm}
        datedCompletions={[savedRecord('single-season-log', asOfDate, '09:30')]}
        completionHistoryAvailable
        onChooseSchedule={onChooseSchedule}
        archived
      />
    );
    const history = screen.getByRole('region', { name: `History for ${todayConnection.title}` });
    expect(within(history).getByText('1 season')).toBeTruthy();
    expect(within(history).getByText(/Logged moments \(\d+\)/).textContent).toBe('Logged moments (1)');
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
    expect(within(history).getByRole('heading', { name: 'Daily' })).toBeTruthy();
    expect(within(history).queryByRole('button', { name: 'Edit Daily' })).toBeNull();
    expect(within(history).queryByRole('button', { name: 'Choose a schedule' })).toBeNull();
    expect(within(history).queryByRole('button', { name: 'Add a Season' })).toBeNull();
    expect(onChooseSchedule).not.toHaveBeenCalled();
  });

  it('shows Choose a schedule for descriptive and missing schedules while counting unknown history', async () => {
    const user = userEvent.setup();
    const onChooseSchedule = vi.fn();
    const unknownStart = addCalendarDays(localDateInTimeZone(new Date(), 'UTC'), -10);
    const cases: RhythmPreview[] = [
      { ...todayConnection, cadence: '3 times a week' },
      {
        ...todayConnection,
        cadence: 'A few times weekly',
        scoring: {
          trackingStartDate: unknownStart,
          timeZone: 'UTC',
          scheduleHistory: [createUnknownRhythmSeason(todayConnection.id, unknownStart, 'A few times weekly')]
        }
      }
    ];
    for (const rhythm of cases) {
      const { unmount } = render(
        <RhythmHistoryView rhythm={rhythm} onChooseSchedule={onChooseSchedule} archived />
      );
      const history = screen.getByRole('region', { name: `History for ${todayConnection.title}` });
      expect(within(history).getByText(rhythm.scoring ? '1 season' : '0 seasons')).toBeTruthy();
      await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
      expect(within(history).getByText('Choose a schedule to see your current Season.')).toBeTruthy();
      expect(within(history).queryByRole('button', { name: 'Choose a schedule' })).toBeNull();
      expect(within(history).queryByRole('button', { name: /^Edit / })).toBeNull();
      if (rhythm.scoring?.scheduleHistory[0]?.kind === 'unknown') {
        expect(within(history).getByRole('button', { name: 'Set earlier schedule' }).hasAttribute('disabled'))
          .toBe(true);
      }
      unmount();
    }
    expect(onChooseSchedule).not.toHaveBeenCalled();
  });

  it('offers the schedule chooser in editable history when no structured schedule exists', async () => {
    const user = userEvent.setup();
    const onChooseSchedule = vi.fn();
    render(
      <RhythmHistoryView
        rhythm={{ ...todayConnection, cadence: '3 times a week' }}
        onChooseSchedule={onChooseSchedule}
      />
    );
    const history = screen.getByRole('region', { name: `History for ${todayConnection.title}` });
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
    await user.click(within(history).getByRole('button', { name: 'Choose a schedule' }));
    expect(onChooseSchedule).toHaveBeenCalledOnce();
  });

  it('keeps one-season Seasons available with a singular count and hidden Undo until expanded', async () => {
    const user = userEvent.setup();
    const asOfDate = localDateInTimeZone(new Date(), 'UTC');
    const schedule = { frequency: 'daily' as const };
    const season = createRhythmSeason(todayConnection.id, asOfDate, schedule);
    const scoring = {
      trackingStartDate: asOfDate,
      timeZone: 'UTC',
      scheduleHistory: [season]
    };
    render(
      <RhythmHistoryView
        rhythm={{ ...todayConnection, schedule, scoring }}
        seasonDeletionUndo={{
          rhythmId: todayConnection.id,
          season,
          index: 1,
          expectedScoring: scoring,
          expectedSchedule: schedule,
          expectedCadence: 'Daily',
          expectedTimeLabel: 'Anytime',
          restoreSchedule: schedule,
          restoreCadence: 'Daily',
          restoreTimeLabel: 'Anytime',
          restoreTrackingStartDate: asOfDate
        }}
        onUndoSeasonDeletion={() => null}
      />
    );
    const history = screen.getByRole('region', { name: `History for ${todayConnection.title}` });
    expect(within(history).getByRole('heading', { name: 'Seasons' })).toBeTruthy();
    expect(within(history).getByText('1 season')).toBeTruthy();
    expect(within(history).getByRole('button', { name: 'Show Seasons' }).getAttribute('aria-expanded'))
      .toBe('false');
    expect(within(history).queryByRole('button', { name: 'Undo' })).toBeNull();
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
    expect(within(history).getByRole('button', { name: 'Hide Seasons' }).getAttribute('aria-expanded'))
      .toBe('true');
    expect(within(history).getByRole('button', { name: 'Undo' })).toBeTruthy();
  });

  it('resets Seasons to collapsed when the displayed Rhythm changes or history is reopened', async () => {
    const user = userEvent.setup();
    const asOfDate = localDateInTimeZone(new Date(), 'UTC');
    const firstStart = addCalendarDays(asOfDate, -10);
    const currentSchedule = { frequency: 'daily' as const };
    const rhythm = {
      ...todayConnection,
      scoring: {
        trackingStartDate: firstStart,
        timeZone: 'UTC',
        scheduleHistory: [
          createRhythmSeason(todayConnection.id, firstStart, { frequency: 'weekly', weekdays: [1] }),
          createRhythmSeason(todayConnection.id, asOfDate, currentSchedule)
        ]
      }
    };
    const { rerender, unmount } = render(<RhythmHistoryView rhythm={rhythm} />);
    let history = screen.getByRole('region', { name: `History for ${todayConnection.title}` });
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
    expect(within(history).getByRole('button', { name: 'Hide Seasons' })).toBeTruthy();

    const otherRhythm = {
      ...rhythm,
      id: 'sample-other-rhythm',
      title: 'Another Rhythm',
      scoring: {
        ...rhythm.scoring,
        scheduleHistory: [
          createRhythmSeason('sample-other-rhythm', firstStart, { frequency: 'weekly', weekdays: [1] }),
          createRhythmSeason('sample-other-rhythm', asOfDate, currentSchedule)
        ]
      }
    };
    rerender(<RhythmHistoryView rhythm={otherRhythm} />);
    history = screen.getByRole('region', { name: 'History for Another Rhythm' });
    expect(within(history).getByRole('button', { name: 'Show Seasons' }).getAttribute('aria-expanded'))
      .toBe('false');
    expect(within(history).queryByRole('heading', { name: 'Earlier Seasons' })).toBeNull();

    unmount();
    render(<RhythmHistoryView rhythm={otherRhythm} />);
    history = screen.getByRole('region', { name: 'History for Another Rhythm' });
    expect(within(history).getByRole('button', { name: 'Show Seasons' }).getAttribute('aria-expanded'))
      .toBe('false');
  });

  it('shows the expanded Seasons history, accessible info disclosure and clickable duration-based timeline', async () => {
    const user = userEvent.setup();
    const asOfDate = localDateInTimeZone(new Date(), 'UTC');
    const firstStart = addCalendarDays(asOfDate, -297);
    const secondStart = addCalendarDays(asOfDate, -207);
    const currentStart = addCalendarDays(asOfDate, -24);
      const rhythm = {
        ...todayConnection,
        schedule: { frequency: 'weekly' as const, weekdays: [1, 3] as (1 | 3)[] },
        completionHistory: [],
        scoring: {
          trackingStartDate: firstStart,
          timeZone: 'UTC',
          scheduleHistory: [
            {
              ...createRhythmSeason(todayConnection.id, firstStart, { frequency: 'daily' }, 'afternoon'),
              name: 'Daily grounding',
              note: 'A preserved note.'
            },
            createRhythmSeason(todayConnection.id, secondStart, {
              frequency: 'weekly',
              weekdays: [1, 3]
            }, 'evening'),
            {
              ...createRhythmSeason(todayConnection.id, currentStart, {
                frequency: 'weekly',
                weekdays: [1, 3]
              }, 'morning'),
              name: 'Avery time'
            }
          ]
        }
      };
      render(<RhythmHistoryView rhythm={rhythm} archived onDeleteSeason={() => null} />);
      const history = screen.getByRole('region', { name: `History for ${todayConnection.title}` });
      const seasonsHeading = within(history).getByRole('heading', { name: 'Seasons' });
      expect(within(history).queryByRole('button', { name: /Delete Season/ })).toBeNull();
      const completionHeading = within(history).getByRole('heading', { name: 'All completion history' });
      expect(seasonsHeading.compareDocumentPosition(completionHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      const info = within(history).getByRole('button', { name: 'Show Seasons' });
      expect(info.getAttribute('aria-expanded')).toBe('false');
      expect(info.getAttribute('aria-controls')).toBeTruthy();
      const controlledContent = document.getElementById(info.getAttribute('aria-controls')!)!;
      expect(controlledContent.hidden).toBe(true);
      expect(controlledContent.querySelector('.rhythm-history-view__seasons-info-copy')?.textContent)
        .toBe('Seasons organize your schedule as it changes. Your logs stay saved, and each is scored using the schedule in place at the time.');
      expect(controlledContent.querySelector('.rhythm-history-view__seasons-content__intro')).toBeNull();
      expect(within(history).queryByRole('button', { name: /Go to .*Oct/ })).toBeNull();
      expect(within(history).queryByRole('button', { name: 'Edit Avery time' })).toBeNull();
      expect(history.querySelector('.rhythm-history-view__seasons-divider')).not.toBeNull();
      info.focus();
      await user.keyboard('{Enter}');
      expect(document.activeElement).toBe(info);
      expect(info.getAttribute('aria-expanded')).toBe('true');
      expect(controlledContent.hidden).toBe(false);
      expect(within(history).getAllByText(
        'Seasons organize your schedule as it changes. Your logs stay saved, and each is scored using the schedule in place at the time.'
      )).toHaveLength(1);
      expect(within(history).queryByText('See how your schedule has changed.')).toBeNull();
      expect(within(history).queryByText('Earlier dates keep their earlier schedule. Your logged moments stay with this rhythm.')).toBeNull();
      expect(within(history).getByRole('heading', { name: 'Avery time' })).toBeTruthy();
      expect(within(history).getByText(`${seasonDateLabel(currentStart)} – Present`)).toBeTruthy();
      expect(history.querySelectorAll('.rhythm-history-view__season-card-footer')).toHaveLength(3);
      expect(within(history).queryByText('Current')).toBeNull();
      const currentHeading = within(history).getByRole('heading', { name: 'Current Season' });
      const earlierHeading = within(history).getByRole('heading', { name: 'Earlier Seasons' });
      expect(currentHeading.className).toBe(earlierHeading.className);
      expect(earlierHeading.parentElement?.querySelector('.rhythm-history-view__season-cards')?.children)
        .toHaveLength(2);
      const currentCard = within(history).getByRole('heading', { name: 'Avery time' }).closest('article')!;
      expect(currentCard.querySelector('.rhythm-history-view__season-current-badge')).toBeNull();
      const currentFooter = currentCard?.querySelector('.rhythm-history-view__season-card-footer')!;
      const currentFooterGroup = currentFooter.querySelector('.rhythm-metadata-schedule-group')!;
      expect([...currentFooterGroup.children]
        .filter(item => !item.classList.contains('visually-hidden'))
        .map(item => item.querySelector('span')?.textContent ?? item.textContent))
        .toEqual(['Mon · Wed', 'Morning']);
      expect(currentFooter.querySelectorAll('svg')).toHaveLength(2);
      expect(currentFooter.querySelector('.rhythm-history-view__season-card-timeframe')?.textContent)
        .toBe(`${seasonDateLabel(currentStart)} – Present`);
      expect(currentCard?.querySelector('.rhythm-history-view__season-date-range')).toBeNull();
      expect(currentHeading.compareDocumentPosition(currentCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(within(history).getByRole('heading', { name: 'Earlier Seasons' })).toBeTruthy();
      expect(within(history).getByText('3 seasons')).toBeTruthy();

      const earlierSection = earlierHeading.parentElement!;
      const earlierHeadings = [...earlierSection.querySelectorAll('.rhythm-history-view__season-card h4')];
      expect(earlierHeadings.map(heading => heading.textContent)).toEqual([
        'Mon · Wed',
        'Daily grounding'
      ]);
      const earlierCard = earlierHeadings[0]?.closest('article')!;
      const earlierFooterGroup = earlierCard.querySelector('.rhythm-metadata-schedule-group')!;
      expect([...earlierFooterGroup.children]
        .filter(item => !item.classList.contains('visually-hidden'))
        .map(item => item.querySelector('span')?.textContent ?? item.textContent))
        .toEqual(['Mon · Wed', 'Evening']);
      expect(currentCard.className).toContain('rhythm-history-view__season-card');
      expect(earlierCard.className).toContain('rhythm-history-view__season-card');
      const assignedPalette = rhythmSeasonPaletteAssignments(rhythm.scoring.scheduleHistory);
      expect(currentCard.className)
        .toContain(`rhythm-history-view__season-visual--${assignedPalette.get(rhythm.scoring.scheduleHistory[2]!.id)}`);
      expect(earlierCard.className)
        .toContain(`rhythm-history-view__season-visual--${assignedPalette.get(rhythm.scoring.scheduleHistory[1]!.id)}`);
      const firstCard = within(earlierSection).getByRole('heading', { name: 'Daily grounding' }).closest('article')!;
      expect(firstCard.className)
        .toContain(`rhythm-history-view__season-visual--${assignedPalette.get(rhythm.scoring.scheduleHistory[0]!.id)}`);
      expect(within(earlierSection).queryByText('Current')).toBeNull();
      expect(within(history).getByText('A preserved note.')).toBeTruthy();
      const dailyCard = within(earlierSection).getByRole('heading', { name: 'Daily grounding' }).closest('article')!;
      const dailyFooterGroup = dailyCard.querySelector('.rhythm-metadata-schedule-group')!;
      expect([...dailyFooterGroup.children]
        .filter(item => !item.classList.contains('visually-hidden'))
        .map(item => item.querySelector('span')?.textContent ?? item.textContent))
        .toEqual(['Daily', 'Afternoon']);
      expect(firstCard.querySelector('.rhythm-history-view__season-card-timeframe')?.textContent)
        .toBe(`${shortTestDate(firstStart)} – ${seasonDateLabel(addCalendarDays(secondStart, -1))}`);
      expect(firstCard.querySelector('.rhythm-history-view__season-card-timeframe')?.getAttribute('aria-label'))
        .toBe(`${seasonDateLabel(firstStart)} – ${seasonDateLabel(addCalendarDays(secondStart, -1))}`);
      expect(within(history).queryByRole('button', { name: /details for/i })).toBeNull();
      const timelineSegments = [...history.querySelectorAll<HTMLElement>(
        '.rhythm-history-view__season-timeline-segment'
      )];
      expect(timelineSegments).toHaveLength(3);
      expect(timelineSegments[0]?.getAttribute('aria-label'))
        .toContain(`${shortTestDate(firstStart)} to ${shortTestDate(addCalendarDays(secondStart, -1))}`);
      expect(timelineSegments[0]?.className)
        .toContain(`rhythm-history-view__season-visual--${assignedPalette.get(rhythm.scoring.scheduleHistory[0]!.id)}`);
      expect(timelineSegments[2]?.className)
        .toContain(`rhythm-history-view__season-visual--${assignedPalette.get(rhythm.scoring.scheduleHistory[2]!.id)}`);
      expect(timelineSegments.map(segment => Number((segment as HTMLElement).style.flexGrow)))
        .toEqual([90, 183, 25]);
      expect(within(history).queryByRole('button', { name: /Change schedule|Edit Season|Delete Season/ })).toBeNull();

      await user.click(within(history).getByRole('button', { name: 'Hide Seasons' }));
      expect(controlledContent.hidden).toBe(true);
      expect(within(history).queryByRole('button', { name: /Go to .*Oct/ })).toBeNull();
      expect(within(history).getByRole('button', { name: 'Show Seasons' }).getAttribute('aria-expanded'))
        .toBe('false');
      await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
      expect(controlledContent.hidden).toBe(false);

      const firstTimelineButton = timelineSegments[0]!;
      expect(firstTimelineButton.tagName).toBe('BUTTON');
      expect(firstTimelineButton.getAttribute('aria-label')).toContain('Daily grounding');
      firstTimelineButton.focus();
      await user.keyboard('{Enter}');
      expect(document.activeElement).toBe(earlierHeadings[1]?.closest('article'));
      expect(earlierHeadings[1]?.closest('article')?.className).toContain('rhythm-history-view__season-card--highlighted');
      expect(currentCard.className).not.toContain('rhythm-history-view__season-card--highlighted');

      cleanup();
      render(<RhythmHistoryView rhythm={rhythm} onEditSeason={() => null} />);
      const editableHistory = screen.getByRole('region', { name: `History for ${todayConnection.title}` });
      await user.click(within(editableHistory).getByRole('button', { name: 'Show Seasons' }));
      expect(within(editableHistory).getByText('A preserved note.')).toBeTruthy();
      expect(within(editableHistory).queryByRole('button', { name: /details for/i })).toBeNull();
      const editableEarlierCard = within(editableHistory).getByRole('heading', { name: 'Daily grounding' }).closest('article')!;
      const earlierEditButton = within(editableEarlierCard).getByRole('button', { name: 'Edit Daily grounding' });
      expect(editableEarlierCard.querySelector('.rhythm-history-view__season-card-actions')?.children).toHaveLength(1);
      expect(earlierEditButton.className).toContain('today-rhythm-details__edit-icon');
      const editButton = within(editableHistory).getByRole('button', { name: 'Edit Avery time' });
      expect(editButton.className).toContain('today-rhythm-details__edit-icon');
      expect(editButton.querySelector('.today-rhythm-details__edit-visual svg')).toBeTruthy();
  });

  it('shows distinct accessible Health scores for current and historical Season cards', async () => {
    const user = userEvent.setup();
    const rhythmId = 'season-health-card-fixture';
    const asOfDate = localDateInTimeZone(new Date(), 'UTC');
    const firstStart = addCalendarDays(asOfDate, -5);
    const currentStart = addCalendarDays(asOfDate, -2);
    const firstEnd = addCalendarDays(currentStart, -1);
    const currentSchedule = { frequency: 'daily' as const };
    const firstSeason = {
      ...createRhythmSeason(rhythmId, firstStart, currentSchedule, 'morning', 'season-health-earlier', 'plum'),
      name: 'Earlier daily plan'
    };
    const currentSeason = {
      ...createRhythmSeason(rhythmId, currentStart, currentSchedule, 'evening', 'season-health-current', 'fern'),
      name: 'Current daily plan'
    };
    const completionFor = (id: string, date: string) => ({
      ...savedRecord(id, date, '12:00'),
      rhythmId
    });
    const rhythm = {
      ...todayConnection,
      id: rhythmId,
      schedule: currentSchedule,
      createdLocalDate: firstStart,
      createdTimeZone: 'UTC',
      scoring: {
        trackingStartDate: firstStart,
        timeZone: 'UTC',
        scheduleHistory: [firstSeason, currentSeason]
      }
    };
    render(
      <RhythmHistoryView
        rhythm={rhythm}
        datedCompletions={[
          completionFor('earlier-season-tend', firstEnd),
          completionFor('current-season-tend', addCalendarDays(asOfDate, -1))
        ]}
      />
    );
    const history = screen.getByRole('region', { name: `History for ${rhythm.title}` });
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));

    const currentCard = within(history).getByRole('heading', { name: 'Current daily plan' }).closest('article')!;
    const earlierCard = within(history).getByRole('heading', { name: 'Earlier daily plan' }).closest('article')!;
    const currentHealth = within(currentCard).getByRole('img', { name: 'Season Health: 63 out of 100' });
    const earlierHealth = within(earlierCard).getByRole('img', { name: 'Season Health: 50 out of 100' });
    expect(currentHealth.querySelector('.ma-score__label')?.textContent).toBe('Health');
    expect(currentHealth.querySelector('.ma-score__value')?.textContent).toBe('63');
    expect(earlierHealth.querySelector('.ma-score__label')?.textContent).toBe('Health');
    expect(earlierHealth.querySelector('.ma-score__value')?.textContent).toBe('50');
    expect(currentCard.querySelector('.rhythm-history-view__season-current-badge')).toBeNull();
    expect(currentCard.querySelector('.rhythm-history-view__season-health-badge')?.className)
      .toContain('rhythm-history-view__season-health-badge');
    expect(earlierCard.querySelector('.rhythm-history-view__season-health-badge')?.className)
      .toContain('rhythm-history-view__season-health-badge');
  });

  it('shows upcoming Season cards with their own schedule and time footer', async () => {
    const user = userEvent.setup();
    const asOfDate = localDateInTimeZone(new Date(), 'UTC');
    const futureStart = addCalendarDays(asOfDate, 14);
    const currentSchedule = { frequency: 'daily' as const };
    const futureSchedule = {
      frequency: 'monthly' as const,
      pattern: { kind: 'dayOfMonth' as const, day: 15 }
    };
    const rhythm = {
      ...todayConnection,
      schedule: currentSchedule,
      timeOfDay: 'morning' as const,
      scoring: {
        trackingStartDate: asOfDate,
        timeZone: 'UTC',
        scheduleHistory: [
          createRhythmSeason(todayConnection.id, asOfDate, currentSchedule, 'morning'),
          createRhythmSeason(todayConnection.id, futureStart, futureSchedule, 'bedtime'),
          createUnknownRhythmSeason(todayConnection.id, addCalendarDays(futureStart, 30))
        ]
      }
    };
    render(<RhythmHistoryView rhythm={rhythm} archived />);
    const history = screen.getByRole('region', { name: `History for ${todayConnection.title}` });
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));

    const upcoming = within(history).getByRole('heading', { name: 'Upcoming Seasons' }).parentElement!;
    const futureCard = within(upcoming).getByRole('heading', { name: 'Monthly · 15th' }).closest('article')!;
    expect([...futureCard.querySelectorAll<HTMLElement>(
      '.rhythm-metadata-schedule-group > span:not(.visually-hidden)'
    )].map(item => item.textContent)).toEqual(['Monthly · 15th', 'Bedtime']);
    expect(futureCard.querySelector('.rhythm-history-view__season-card-timeframe')?.textContent)
      .toBe(`${shortTestDate(futureStart)} – ${seasonDateLabel(addCalendarDays(futureStart, 29))}`);
    const unknownFuture = within(upcoming)
      .getByRole('heading', { name: 'Upcoming schedule needs details' }).closest('article')!;
    const unavailableHealth = within(unknownFuture).getByRole('img', { name: 'Season Health unavailable' });
    expect(unavailableHealth.querySelector('.ma-score__label')?.textContent).toBe('Health');
    expect(unavailableHealth.querySelector('.ma-score__value')?.textContent).toBe('—');
    expect(unknownFuture.querySelector('.rhythm-history-view__season-card-metadata')?.textContent)
      .toContain('Schedule details unavailable.');
    expect(unknownFuture.querySelector('.rhythm-history-view__season-card-metadata')?.textContent)
      .toContain('Time unknown');
    expect(unknownFuture.querySelector('.rhythm-history-view__season-card-metadata [aria-label="Time of day not recorded"]'))
      .toBeTruthy();
    expect(unknownFuture.querySelector('.rhythm-history-view__season-card-timeframe')?.textContent)
      .toBe(`${seasonDateLabel(addCalendarDays(futureStart, 30))} – Upcoming`);
    expect(within(upcoming).queryByRole('button', { name: /details for/i })).toBeNull();
  });

  it('uses each Season palette token for its matching card and timeline segment across palette cycles', async () => {
    const user = userEvent.setup();
    const asOfDate = localDateInTimeZone(new Date(), 'UTC');
    const scheduleHistory = Array.from({ length: 7 }, (_, index) => {
      const startDate = addCalendarDays(asOfDate, index - 6);
      return createRhythmSeason(
        todayConnection.id,
        startDate,
        { frequency: 'weekly', weekdays: [index as 0 | 1 | 2 | 3 | 4 | 5 | 6] },
        undefined,
        undefined,
        rhythmSeasonPaletteForOrdinal(index)
      );
    });
    render(
      <RhythmHistoryView
        rhythm={{
          ...todayConnection,
          schedule: scheduleHistory.at(-1)!.schedule,
          scoring: {
            trackingStartDate: scheduleHistory[0]!.startDate,
            timeZone: 'UTC',
            scheduleHistory
          }
        }}
      />
    );
    const history = screen.getByRole('region', { name: `History for ${todayConnection.title}` });
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));

    const timelineSegments = [...history.querySelectorAll<HTMLElement>(
      '.rhythm-history-view__season-timeline-segment'
    )];
    const cards = [...history.querySelectorAll<HTMLElement>('.rhythm-history-view__season-card')];
    expect(timelineSegments).toHaveLength(7);
    expect(cards).toHaveLength(7);
    scheduleHistory.forEach((season, index) => {
      const visualClass = `rhythm-history-view__season-visual--${season.paletteToken}`;
      expect(timelineSegments[index]?.classList.contains(visualClass)).toBe(true);
      expect(cards[cards.length - 1 - index]?.classList.contains(visualClass)).toBe(true);
    });
    expect(scheduleHistory.map(season => season.paletteToken)).toEqual([
      'fern', 'sage', 'sky', 'ocean', 'plum', 'fern', 'sage'
    ]);
  });

  it('renders colliding stored colors distinctly and consistently across timeline and cards', async () => {
    const user = userEvent.setup();
    const asOfDate = localDateInTimeZone(new Date(), 'UTC');
    const scheduleHistory = Array.from({ length: 3 }, (_, index) =>
      createRhythmSeason(
        todayConnection.id,
        addCalendarDays(asOfDate, index - 2),
        { frequency: 'daily' },
        undefined,
        `same-color-season-${index}`,
        'fern'
      )
    );
    render(
      <RhythmHistoryView
        rhythm={{
          ...todayConnection,
          schedule: { frequency: 'daily' },
          scoring: {
            trackingStartDate: scheduleHistory[0]!.startDate,
            timeZone: 'UTC',
            scheduleHistory
          }
        }}
      />
    );
    const history = screen.getByRole('region', { name: `History for ${todayConnection.title}` });
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));

    const timelineSegments = [...history.querySelectorAll<HTMLElement>(
      '.rhythm-history-view__season-timeline-segment'
    )];
    const cards = [...history.querySelectorAll<HTMLElement>('.rhythm-history-view__season-card')];
    const assignedColors = scheduleHistory.map((_, index) => {
      const card = cards[cards.length - 1 - index];
      const assignedClass = card?.className.split(' ').find(className =>
        className.startsWith('rhythm-history-view__season-visual--')
      );
      expect(assignedClass).toBeTruthy();
      expect(timelineSegments[index]?.className).toContain(assignedClass);
      return assignedClass;
    });
    expect(new Set(assignedColors).size).toBe(3);
    expect(assignedColors[0]).toBe('rhythm-history-view__season-visual--fern');
    expect(assignedColors.slice(0, 3)).toEqual([
      'rhythm-history-view__season-visual--fern',
      'rhythm-history-view__season-visual--sage',
      'rhythm-history-view__season-visual--sky'
    ]);
  });

  it('shows unknown history as neutral and offers its repair action only in the timeline row', async () => {
    const user = userEvent.setup();
    const asOfDate = localDateInTimeZone(new Date(), 'UTC');
    const currentSchedule = { frequency: 'weekly' as const, weekdays: [1] as (1)[] };
    const unknownStart = addCalendarDays(asOfDate, -20);
    const rhythm = {
      ...todayConnection,
      schedule: currentSchedule,
      scoring: {
        trackingStartDate: asOfDate,
        timeZone: 'UTC',
        scheduleHistory: [
          { ...createUnknownRhythmSeason(todayConnection.id, unknownStart), descriptiveCadence: 'A few times weekly' },
          createRhythmSeason(todayConnection.id, asOfDate, currentSchedule)
        ]
      }
    };
    render(<RhythmHistoryView rhythm={rhythm} onEditSeason={() => null} />);
    const history = screen.getByRole('region', { name: `History for ${todayConnection.title}` });
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
    expect(within(history).getByRole('heading', { name: 'Earlier schedule needs details' })).toBeTruthy();
    expect(within(history).getByText('Original description: A few times weekly')).toBeTruthy();
    expect(within(history).queryByRole('button', { name: /details for/i })).toBeNull();
    expect(within(history).getByText(`${shortTestDate(unknownStart)} – ${seasonDateLabel(addCalendarDays(asOfDate, -1))}`)).toBeTruthy();
    expect(within(history).getByRole('button', { name: 'Set earlier schedule' })).toBeTruthy();
    expect(within(history).getAllByRole('button', { name: 'Set earlier schedule' })).toHaveLength(1);
    const unknownEntry = within(history).getByRole('heading', { name: 'Earlier schedule needs details' }).closest('article')!;
    expect(unknownEntry.className).toContain('rhythm-history-view__season-card');
    expect(unknownEntry.className).toContain('rhythm-history-view__season-visual--unknown');
    expect(unknownEntry.querySelector('.rhythm-history-view__season-card-timeframe')?.textContent)
      .toBe(`${shortTestDate(unknownStart)} – ${seasonDateLabel(addCalendarDays(asOfDate, -1))}`);
    expect(unknownEntry.querySelector('.rhythm-history-view__season-card-timeframe')?.getAttribute('aria-label'))
      .toBe(`${seasonDateLabel(unknownStart)} – ${seasonDateLabel(addCalendarDays(asOfDate, -1))}`);
    await user.click(within(unknownEntry).getByRole('button', { name: 'Set earlier schedule' }));
    expect(screen.getByRole('dialog', { name: 'Set earlier schedule' })).toBeTruthy();
  });

  it('keeps one-day current timeline segments operable and focuses their matching card under reduced motion', async () => {
    const user = userEvent.setup();
    const currentDate = localDateInTimeZone(new Date(), 'UTC');
    const previousDate = addCalendarDays(currentDate, -20);
    const schedule = { frequency: 'daily' as const };
    const rhythm = {
      ...todayConnection,
      schedule,
      scoring: {
        trackingStartDate: previousDate,
        timeZone: 'UTC',
        scheduleHistory: [
          createRhythmSeason(todayConnection.id, previousDate, { frequency: 'weekly', weekdays: [1] }),
          createRhythmSeason(todayConnection.id, currentDate, schedule)
        ]
      }
    };
    render(<RhythmHistoryView rhythm={rhythm} />);
    const history = screen.getByRole('region', { name: `History for ${todayConnection.title}` });
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
    const segments = within(history).getAllByRole('button', { name: /Go to .*Oct/ });
    expect(segments).toHaveLength(2);
    expect(segments[1]?.getAttribute('aria-label')).toContain(`${shortTestDate(currentDate)} to ${shortTestDate(currentDate)}`);
    expect((segments[1] as HTMLButtonElement).style.flexGrow).toBe('1');

    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => true
    })) as typeof window.matchMedia;
    try {
      await user.click(segments[1]!);
    } finally {
      window.matchMedia = originalMatchMedia;
    }

    const currentCard = within(history).getByRole('heading', { name: 'Daily' }).closest('article')!;
    expect(document.activeElement).toBe(currentCard);
    expect(currentCard.className).toContain('rhythm-history-view__season-card--highlighted');
    expect(screen.queryByRole('dialog', { name: 'Edit season' })).toBeNull();
  });

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
          scheduleHistory: [createRhythmSeason('history-fixture', trackingStartDate, schedule)]
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
    expect(zeroMeter.querySelector('.health-score-meter__fill')?.getAttribute('style')).toContain('0%');

    rerender(<HealthScoreMeter score={null} />);
    const unavailable = screen.getByRole('img', { name: 'Health: Not enough data' });
    expect(unavailable.hasAttribute('aria-valuenow')).toBe(false);
    expect(unavailable.classList.contains('neutral')).toBe(true);
    expect(unavailable.querySelector('.health-score-meter__fill')?.getAttribute('style')).toContain('0%');
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
    const schedule = history.querySelector('.rhythm-history-view__schedule')!;
    const description = within(history).getByText('Set aside a few minutes to share how your day went.');
    const people = within(history).getByRole('group', { name: 'People associated with Daily connection' });
    expect(title.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(description.compareDocumentPosition(people) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(people.compareDocumentPosition(schedule) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(schedule.textContent).toContain('Daily');
    const summaryGroup = schedule.querySelector('.rhythm-metadata-schedule-group')!;
    expect([...summaryGroup.children]
      .filter(item => !item.classList.contains('visually-hidden'))
      .map(item => item.querySelector('span')?.textContent ?? item.textContent))
      .toEqual(['Daily', 'Evening']);
    expect(schedule.querySelectorAll('svg')).toHaveLength(2);
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

  it.each([
    ['daily', { frequency: 'daily' } satisfies RhythmSchedule, 'Daily', 'Morning'],
    ['selected days', {
      frequency: 'weekly',
      weeklyMode: 'select-days',
      weekdays: [1, 3, 5]
    } satisfies RhythmSchedule, 'Select days · Mon · Wed · Fri', 'Evening'],
    ['Monday, Wednesday, Friday', {
      frequency: 'weekly',
      weekdays: [1, 3, 5]
    } satisfies RhythmSchedule, 'Mon · Wed · Fri', 'Evening'],
    ['weekday frequency', {
      frequency: 'weekly',
      weekdays: [1, 2, 3, 4, 5]
    } satisfies RhythmSchedule, 'Weekdays', 'Afternoon'],
    ['monthly', {
      frequency: 'monthly',
      pattern: { kind: 'dayOfMonth', day: 15 }
    } satisfies RhythmSchedule, 'Monthly · 15th', 'Bedtime']
  ])('uses the compact Rhythm footer wording for %s schedules', (_label, schedule, expected, timeLabel) => {
    const rhythm = {
      id: 'schedule-summary-contract',
      title: 'Schedule summary',
      automation: 'manual' as const,
      status: 'Due today' as const,
      schedule,
      timeLabel
    };
    render(
      <>
        <RhythmHistoryView rhythm={rhythm} />
        <RhythmMetadata
          variant="footer"
          schedule={schedule}
          timeLabel={timeLabel}
          lastTended="Not yet tended"
        />
      </>
    );
    const history = screen.getByRole('region', { name: 'History for Schedule summary' });
    const summary = history.querySelector('.rhythm-history-view__schedule')!;
    const group = summary.querySelector('.rhythm-metadata-schedule-group')!;
    const visibleLabels = [...group.children]
      .filter(item => !item.classList.contains('visually-hidden'))
      .map(item => item.querySelector('span')?.textContent ?? item.textContent);
    expect(formatRhythmSchedule(schedule, 'compact')).toBe(expected);
    expect(visibleLabels).toEqual([expected, timeLabel]);
    expect(summary.querySelectorAll('svg')).toHaveLength(2);
    expect(summary.className).toContain('rhythm-metadata-footer');
    expect(group).toBeTruthy();
    const footerGroup = document.querySelector('.rhythm-metadata-footer:not(.rhythm-history-view__schedule) .rhythm-metadata-schedule-group')!;
    const footerLabels = [...footerGroup.children]
      .filter(item => !item.classList.contains('visually-hidden'))
      .map(item => item.querySelector('span')?.textContent ?? item.textContent);
    expect(visibleLabels).toEqual(footerLabels);
  });

  it('uses the active Season schedule and time in the detail summary', () => {
    const asOfDate = localDateInTimeZone(new Date(), 'UTC');
    const currentSchedule: RhythmSchedule = {
      frequency: 'weekly',
      weeklyMode: 'select-days',
      weekdays: [2, 4]
    };
    const activeSeason = createRhythmSeason(
      'effective-detail-summary',
      addCalendarDays(asOfDate, -30),
      currentSchedule,
      'bedtime'
    );
    render(
      <RhythmHistoryView
        rhythm={{
          id: 'effective-detail-summary',
          title: 'Season-backed schedule',
          automation: 'manual',
          status: 'Due today',
          schedule: currentSchedule,
          timeLabel: 'Stale time',
          scoring: {
            trackingStartDate: activeSeason.startDate,
            timeZone: 'UTC',
            scheduleHistory: [activeSeason]
          }
        }}
      />
    );
    const summary = screen.getByRole('region', { name: 'History for Season-backed schedule' })
      .querySelector('.rhythm-history-view__schedule')!;
    expect(summary.textContent).toContain(formatRhythmSchedule(currentSchedule, 'compact'));
    expect(summary.textContent).toContain('Bedtime');
    expect(summary.textContent).not.toContain('Stale time');
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
    expect(document.querySelectorAll('.health-score-measures__item')).toHaveLength(2);
    expect(document.querySelectorAll('.rhythm-history-view__score-summary-divider')).toHaveLength(1);
    expect(document.querySelectorAll('.rhythm-history-view__score-card .rhythm-history-view__score-info')).toHaveLength(1);
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
        || element.classList.contains('health-score-breakdown')
        || element.classList.contains('rhythm-history-view__health-calculation-disclosure')
        || element.classList.contains('rhythm-history-view__score-summary-divider')
        || element.classList.contains('health-score-measures')
        || element.classList.contains('rhythm-history-view__score-details-grid'))
      .map(element => element.className.split(' ').find(className =>
        className.startsWith('rhythm-history-view__')
        || className === 'health-score-breakdown'
        || className === 'health-score-measures'
      ));
    expect(orderedSections).toEqual([
      'health-score-breakdown',
      'rhythm-history-view__health-calculation-disclosure',
      'rhythm-history-view__score-summary-divider',
      'health-score-measures',
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
    expect(within(onTrackDetails).getByText('Per miss')).toBeTruthy();
    expect(within(onTrackDetails).queryByText('Per missed occurrence')).toBeNull();
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
    expect(onTrackItems[0]).toBe(`${shortTestDate(lastTendedDate)} · Tended 100`);
    expect(onTrackItems.slice(1, 4).every(item => item.includes(' · Missed '))).toBe(true);
    expect(onTrackItems.at(-1)).toBe(`Today · ${shortTestDate(localDateInTimeZone(new Date(), 'UTC'))} 70`);
    const completedEntry = within(onTrackDetails).getAllByRole('listitem')[0]!;
    expect(completedEntry.getAttribute('aria-label')).toMatch(
      /Qualifying completion on .* reset the missed-occurrence count and On Track score to 100/
    );
    const missedEntry = within(onTrackDetails).getAllByRole('listitem')[1]!;
    expect(missedEntry.getAttribute('aria-label')).toMatch(
      /Missed scheduled occurrence on .* 10-point deduction applied\. Resulting On Track score: \d+\./
    );
    const todayEntry = within(onTrackDetails).getAllByRole('listitem').at(-1)!;
    expect(todayEntry.getAttribute('aria-label')).toMatch(
      /Current On Track state as of .* today is pending and is not counted as missed/
    );
    expect(screen.getByText(/Calculated from saved completion records/)).toBeTruthy();
    expect(within(healthDetails).queryByText(/eligible due occurrence counts once|overdue time|pre-activation|Foundation-weighted|Health windows are/)).toBeNull();
    expect(within(onTrackDetails).queryByText(/calendar-day span|floors at zero|rules for weekly/)).toBeNull();
    expect(within(healthDetails).queryByText(/76\.7|→/)).toBeNull();
    expect(within(details).getByRole('heading', { name: 'Your scheduled pattern' })).toBeTruthy();
    expect(within(details).getByRole('heading', { name: 'How it changed' })).toBeTruthy();
  });

  it('explains shared monthly-period credit while retaining every logged moment', async () => {
    const user = userEvent.setup();
    const trackingStartDate = '2026-10-01';
    const schedule: RhythmSchedule = {
      frequency: 'monthly',
      pattern: { kind: 'dayOfMonth', day: 1 }
    };
    const records = [
      savedRecord('period-oct-17', '2026-10-17', '09:00'),
      savedRecord('period-oct-18', '2026-10-18', '09:00'),
      savedRecord('period-oct-20', '2026-10-20', '09:00')
    ];
    const rhythm = {
      ...todayConnection,
      id: 'monthly-period-copy',
      schedule,
      createdLocalDate: trackingStartDate,
      createdTimeZone: 'UTC',
      scoring: {
        trackingStartDate,
        timeZone: 'UTC',
        scheduleHistory: [createRhythmSeason('monthly-period-copy', trackingStartDate, schedule)]
      },
      completionHistory: []
    };
    render(
      <RhythmHistoryView
        rhythm={rhythm}
        datedCompletions={records}
        completionHistoryAvailable
      />
    );
    const history = screen.getByRole('region', { name: `History for ${todayConnection.title}` });
    await user.click(within(history).getByRole('button', {
      name: 'Show Consistency and On Track score details'
    }));
    const scoreDetails = within(history).getByRole('group', {
      name: 'Consistency and On Track score details'
    });
    expect(within(scoreDetails).getByText(
      'Any completion in its eligible calendar period counts once; extra logs stay in your history.'
    )).toBeTruthy();
    expect(within(scoreDetails).getByRole('listitem', {
      name: /.*October 1, 2026: completed due date; eligible period .*October 1, 2026 through .*October 31, 2026/
    })).toBeTruthy();

    expect(within(scoreDetails).getByRole('listitem', {
      name: /Completion on .*October 17, 2026 satisfied the occurrence due .*October 1, 2026 within its eligible period, .*October 1, 2026–.*October 31, 2026\. Extra logs stay in your history\./
    })).toBeTruthy();
    expect(within(history).getByText('Logged moments (3)')).toBeTruthy();
  });

  it('renders eligible Consistency occurrences and independently scores Custom On Track', async () => {
    const user = userEvent.setup();
    const asOfDate = localDateInTimeZone(new Date(), 'UTC');
    const trackingStartDate = addCalendarDays(asOfDate, -900);
    const cases: { schedule: RhythmSchedule; expectedKind: string; weekday?: RegExp }[] = [
      { schedule: { frequency: 'weekly', weekdays: [1, 3, 5] }, expectedKind: 'scheduled day', weekday: /^(Monday|Wednesday|Friday),/ },
      { schedule: { frequency: 'weekly', weekdays: [1] }, expectedKind: 'scheduled day', weekday: /^Monday,/ },
      { schedule: { frequency: 'weekly', weekdays: [1], weeklyMode: 'select-days' }, expectedKind: 'scheduled day', weekday: /^Monday,/ },
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
      expect(cells.every(cell => cell.getAttribute('aria-label')?.includes(fixture.expectedKind))).toBe(true);
      const periodBased = fixture.schedule.frequency === 'monthly'
        || fixture.schedule.frequency === 'quarterly'
        || fixture.schedule.frequency === 'yearly'
        || fixture.schedule.frequency === 'weekly' && fixture.schedule.weekdays.length === 1
          && fixture.schedule.weeklyMode !== 'select-days';
      expect(cells.every(cell => cell.getAttribute('aria-label')?.includes('eligible period') === periodBased)).toBe(true);
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
    expect(within(timeline).getAllByRole('listitem').at(-1)?.querySelector('span')?.textContent)
      .toBe(`Today · ${shortTestDate(asOfDate)}`);
    expect(within(timeline).getAllByRole('listitem').map(item => item.textContent).join(' '))
      .toMatch(/more misses/);

    earlier.focus();
    await user.keyboard('{Enter}');
    expect(earlier.getAttribute('aria-expanded')).toBe('true');
    expect(within(timeline).getAllByRole('listitem')).toHaveLength(10);
    await user.click(screen.getByRole('button', { name: 'Show earlier steps' }));
    expect(within(timeline).getAllByRole('listitem').length).toBeLessThanOrEqual(15);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Show less' }));
    expect(within(timeline).getAllByRole('listitem').some(item =>
      item.getAttribute('aria-label')?.includes('additional missed occurrences')
        && item.querySelector('strong')?.textContent === '0'
    )).toBe(true);
    expect(within(timeline).getAllByRole('listitem').some(item =>
      item.querySelector('span')?.textContent?.includes('more misses ·')
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
    const todayEntry = within(timeline).getByRole('listitem');
    expect(todayEntry.querySelector('span')?.textContent)
      .toBe(`${shortTestDate(asOfDate)} · Tended`);
    expect(todayEntry.getAttribute('aria-label')).toMatch(
      /Qualifying completion on .* reset the missed-occurrence count and On Track score to 100/
    );
    expect(screen.queryByRole('button', { name: 'Show earlier steps' })).toBeNull();
    expect(screen.getByRole('meter', { name: 'On Track score' }).getAttribute('aria-valuenow')).toBe('100');
  });

  it('labels a pending current date as current state rather than as a missed occurrence', async () => {
    const user = userEvent.setup();
    const asOfDate = localDateInTimeZone(new Date(), 'UTC');
    const rhythm = rhythmForSchedule({ frequency: 'daily' }, addCalendarDays(asOfDate, -1));
    render(<RhythmHistoryView rhythm={rhythm} completionHistoryAvailable />);
    await user.click(screen.getByRole('button', { name: 'Show Consistency and On Track score details' }));
    const timeline = screen.getByRole('list', { name: 'On Track score changes' });
    const entries = within(timeline).getAllByRole('listitem');
    expect(entries.map(entry => entry.querySelector('span')?.textContent)).toEqual([
      `${shortTestDate(addCalendarDays(asOfDate, -1))} · Missed`,
      `Today · ${shortTestDate(asOfDate)}`
    ]);
    expect(entries[0]?.getAttribute('aria-label')).toMatch(/Missed scheduled occurrence on/);
    expect(entries[1]?.getAttribute('aria-label')).toMatch(/today is pending and is not counted as missed/);
  });

  it('keeps schedule changes distinct in the compact On Track history', async () => {
    const user = userEvent.setup();
    const asOfDate = localDateInTimeZone(new Date(), 'UTC');
    const trackingStartDate = addCalendarDays(asOfDate, -5);
    const changeDate = addCalendarDays(asOfDate, -2);
    const earlierSchedule = { frequency: 'daily' as const };
    const currentSchedule = { frequency: 'weekly' as const, weekdays: [1] as (1)[] };
    const rhythm = {
      ...rhythmForSchedule(currentSchedule, trackingStartDate),
      scoring: {
        trackingStartDate,
        timeZone: 'UTC',
        scheduleHistory: [
          createRhythmSeason(todayConnection.id, trackingStartDate, earlierSchedule),
          createRhythmSeason(todayConnection.id, changeDate, currentSchedule)
        ]
      }
    };
    render(<RhythmHistoryView rhythm={rhythm} completionHistoryAvailable />);
    await user.click(screen.getByRole('button', { name: 'Show Consistency and On Track score details' }));
    const timeline = screen.getByRole('list', { name: 'On Track score changes' });
    const scheduleChange = within(timeline).getAllByRole('listitem').find(entry =>
      entry.querySelector('span')?.textContent === `${shortTestDate(changeDate)} · Schedule changed`
    );
    expect(scheduleChange).toBeTruthy();
    expect(scheduleChange?.getAttribute('aria-label')).toMatch(
      /Schedule changed on .* On Track score at that point: \d+\./
    );
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
            scheduleHistory: [createRhythmSeason('history-fixture', trackingStartDate, schedule)]
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
    expect(within(body).getByRole('heading', { name: 'Health' })).toBeTruthy();
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
    expect(document.querySelector('.health-score-breakdown__header > span')?.textContent).toBe('—');
    expect(document.querySelector('.health-score-meter')?.classList.contains('neutral')).toBe(true);
    expect(document.querySelector('.health-score-meter__fill')?.getAttribute('style')).toContain('0%');
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

  it('shows the effective Daily Season from sample cadence with and without completion records', async () => {
    const user = userEvent.setup();
    const structuredDailyWithoutStart = { ...todayConnection };
    render(<RhythmHistoryView rhythm={structuredDailyWithoutStart} />);

    expect(screen.getByRole('meter', { name: 'Health score' })).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'Consistency score' })).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'On Track score' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).not.toContain('Confirm when tracking starts');
    expect(document.querySelector('.rhythm-history-view__completion-total strong')?.textContent).toBe('3');
    expect(screen.queryByText('Dated completion history is unavailable for this Rhythm.')).toBeNull();
    let history = screen.getByRole('region', { name: `History for ${todayConnection.title}` });
    expect(within(history).getByText('1 season')).toBeTruthy();
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
    expect(within(history).getByRole('heading', { name: 'Daily' })).toBeTruthy();
    expect(within(history).getByText('Start unknown – Present')).toBeTruthy();

    cleanup();
    render(
      <RhythmHistoryView
        rhythm={{ ...todayConnection, completionHistory: [] }}
      />
    );
    history = screen.getByRole('region', { name: `History for ${todayConnection.title}` });
    expect(within(history).getByText('1 season')).toBeTruthy();
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
    expect(within(history).getByRole('heading', { name: 'Daily' })).toBeTruthy();
    expect(document.querySelector('.rhythm-history-view__completion-total strong')?.textContent ?? '0')
      .toBe('0');
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
    const historyButton = screen.getByRole('button', { name: historyButtonName('View scores and history for Daily Connection') });
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
    await user.click(screen.getByRole('button', { name: historyButtonName('View scores and history for Daily Connection') }));

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
      name: historyButtonName(`View scores and history for ${todayConnection.title}`)
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
    await user.click(screen.getByRole('button', { name: historyButtonName('View scores and history for Daily Connection') }));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });
});
