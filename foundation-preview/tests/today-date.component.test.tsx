import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TodayDateRow, formatTodayDate } from '../src/components/TodayDateRow.tsx';
import { useScoringInstant } from '../src/components/useScoringInstant.ts';
import { localDateString } from '../src/domain/money-goals.ts';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Today date presentation', () => {
  it('formats the calendar tile and adjacent localized date across a month/year boundary', () => {
    expect(formatTodayDate(new Date(2026, 10, 2), 'en-US')).toEqual({
      abbreviatedWeekday: 'Mon',
      dayNumber: '2',
      weekday: 'Monday',
      monthYear: 'November 2026',
      accessibleDate: 'Monday, November 2, 2026'
    });
    expect(formatTodayDate(new Date(2027, 0, 1), 'en-US')).toMatchObject({
      abbreviatedWeekday: 'Fri',
      dayNumber: '1',
      weekday: 'Friday',
      monthYear: 'January 2027',
      accessibleDate: 'Friday, January 1, 2027'
    });
  });

  it('uses the existing scoring clock through local midnight and foreground refresh', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 27, 23, 59, 30));

    function ClockDate() {
      const instant = useScoringInstant();
      return <TodayDateRow instant={instant} localDate={localDateString(instant)} />;
    }

    const view = render(<ClockDate />);
    const date = screen.getByLabelText('Tuesday, October 27, 2026');
    expect(date.getAttribute('dateTime')).toBe('2026-10-27');

    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByLabelText('Wednesday, October 28, 2026').getAttribute('dateTime')).toBe('2026-10-28');

    act(() => {
      vi.setSystemTime(new Date(2026, 10, 2, 12, 0));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.getByLabelText('Monday, November 2, 2026').getAttribute('dateTime')).toBe('2026-11-02');
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
