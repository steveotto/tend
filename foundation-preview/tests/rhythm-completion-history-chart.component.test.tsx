import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RhythmCompletionHistoryChart } from '../src/components/RhythmCompletionHistoryChart.tsx';
import { localDateString } from '../src/domain/money-goals.ts';
import type { DailyCompletionCount } from '../src/domain/rhythm-history.ts';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const localToday = localDateString(new Date());

describe('RhythmCompletionHistoryChart', () => {
  it('shows chronological count-based bars, full-height tracks and a decorative zero marker', () => {
    const dailyCounts: DailyCompletionCount[] = [
      { date: '2026-10-17', count: 2, recordIds: ['first', 'second'] },
      { date: '2026-10-18', count: 1, recordIds: ['third'] },
      { date: '2026-10-19', count: 0, recordIds: [] },
      { date: '2026-10-20', count: 1, recordIds: ['fourth'] }
    ];
    render(<RhythmCompletionHistoryChart dailyCounts={dailyCounts} />);

    const chart = screen.getByRole('list', { name: 'Recorded completion count by date' });
    const days = within(chart).getAllByRole('listitem');
    expect(days.map(day => day.getAttribute('aria-label'))).toEqual([
      'Saturday, October 17, 2026: 2 completions',
      'Sunday, October 18, 2026: 1 completion',
      'Monday, October 19, 2026: no recorded completions',
      'Tuesday, October 20, 2026: 1 completion'
    ]);
    expect(days.map(day => day.querySelector('time')?.getAttribute('dateTime'))).toEqual(
      dailyCounts.map(item => item.date)
    );
    expect(days[0]!.querySelector('.rhythm-history-view__completion-bar')?.getAttribute('style'))
      .toContain('height: 100%');
    expect(days[0]!.querySelector('.rhythm-history-view__bar-value')?.textContent).toBe('2');
    expect(days[1]!.querySelector('.rhythm-history-view__completion-bar')?.getAttribute('style'))
      .toContain('height: 50%');
    expect(days[2]!.querySelector('.rhythm-history-view__completion-bar')).toBeNull();
    expect(days[2]!.querySelector('.rhythm-history-view__completion-zero')?.textContent).toBe('–');
    expect(days[2]!.querySelector('.rhythm-history-view__completion-zero')?.getAttribute('aria-hidden')).toBe('true');
    expect(days[2]!.querySelector('.rhythm-history-view__completion-track')?.getAttribute('aria-hidden')).toBe('true');
    expect(days[0]!.querySelector('.rhythm-history-view__completion-bar-area')?.getAttribute('style'))
      .toContain('height: 200px');
    expect(screen.queryByText('Scroll horizontally to explore older history.')).toBeNull();

    const scrollRegion = screen.getByRole('region', {
      name: 'Completion history chart; scroll horizontally for older dates'
    });
    expect(scrollRegion.getAttribute('tabindex')).toBe('0');
    scrollRegion.focus();
    expect(document.activeElement).toBe(scrollRegion);
  });

  it('labels the actual local current date and renders an empty chart placeholder without invented entries', () => {
    render(
      <RhythmCompletionHistoryChart
        dailyCounts={[{ date: localToday, count: 1, recordIds: ['today'] }]}
      />
    );

    const today = screen.getByRole('listitem', {
      name: new RegExp(`${formatLongDate(localToday)}: 1 completion, today`)
    });
    expect(today.querySelector('time')?.getAttribute('dateTime')).toBe(localToday);
    expect(today.querySelector('time')?.textContent).toBe('Today');
    expect(screen.queryByText('Scroll horizontally to explore older history.')).toBeNull();

    cleanup();
    render(<RhythmCompletionHistoryChart dailyCounts={[]} />);
    expect(screen.queryByRole('list', { name: 'Recorded completion count by date' })).toBeNull();
    expect(screen.queryByRole('region', {
      name: 'Completion history chart; scroll horizontally for older dates'
    })).toBeNull();
    expect(document.querySelector('.rhythm-history-view__chart-placeholder-plot')).toBeTruthy();
    expect(document.querySelector('.rhythm-history-view__chart-placeholder-plot')?.textContent).toBe('');
    expect(screen.queryByText('Scroll horizontally to explore older history.')).toBeNull();
  });

  it('labels an empty current-day marker as not logged yet', () => {
    render(
      <RhythmCompletionHistoryChart
        dailyCounts={[{ date: '2026-10-24', count: 0, recordIds: [] }]}
        todayDate="2026-10-24"
      />
    );

    expect(screen.getByRole('listitem', {
      name: 'Saturday, October 24, 2026: no completion recorded yet, today'
    })).toBeTruthy();
    expect(document.querySelector('.rhythm-history-view__completion-zero')?.textContent).toBe('–');
    expect(document.querySelector('.rhythm-history-view__completion-zero')?.getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelector('.rhythm-history-view__chart time')?.getAttribute('dateTime')).toBe('2026-10-24');
    expect(document.querySelector('.rhythm-history-view__chart time')?.textContent).toBe('Today');
  });

  it('starts overflowing histories at the newest dates and does not reset scrolling for same-range updates', () => {
    const original = Array.from({ length: 11 }, (_, index) => ({
      date: `2026-10-${String(index + 1).padStart(2, '0')}`,
      count: 1,
      recordIds: [`record-${index}`]
    }));
    const updated = [
      ...original,
      { date: '2026-10-12', count: 2, recordIds: ['record-11'] }
    ];
    const { rerender } = render(<RhythmCompletionHistoryChart dailyCounts={original} />);
    const scrollRegion = screen.getByRole('region', {
      name: 'Completion history chart; scroll horizontally for older dates'
    });
    Object.defineProperties(scrollRegion, {
      scrollWidth: { configurable: true, value: 980 },
      clientWidth: { configurable: true, value: 449 }
    });
    rerender(<RhythmCompletionHistoryChart dailyCounts={updated} />);

    expect(scrollRegion.scrollLeft).toBe(980);
    fireEvent.scroll(scrollRegion);
    expect(screen.getByText('Scroll horizontally to explore older history.')).toBeTruthy();

    scrollRegion.scrollLeft = 321;
    rerender(<RhythmCompletionHistoryChart dailyCounts={updated.map((item, index) => ({
      ...item,
      count: index === 10 ? 2 : item.count
    }))} />);
    expect(scrollRegion.scrollLeft).toBe(321);
    expect(screen.getByText('Scroll horizontally to explore older history.')).toBeTruthy();
    expect(within(screen.getByRole('list', { name: 'Recorded completion count by date' }))
      .getAllByRole('listitem')[0]?.querySelector('time')?.getAttribute('dateTime')).toBe('2026-10-01');
  });

  it('preserves exact date keys across daylight-saving calendar boundaries', () => {
    render(
      <RhythmCompletionHistoryChart
        dailyCounts={[
          { date: '2026-03-08', count: 1, recordIds: ['one'] },
          { date: '2026-03-09', count: 0, recordIds: [] },
          { date: '2026-03-10', count: 1, recordIds: ['two'] }
        ]}
      />
    );

    expect([...document.querySelectorAll('.rhythm-history-view__chart time')]
      .map(time => time.getAttribute('dateTime'))).toEqual([
      '2026-03-08', '2026-03-09', '2026-03-10'
    ]);
  });
});

function formatLongDate(value: string): string {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  });
}
