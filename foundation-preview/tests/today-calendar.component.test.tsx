import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TodayCalendar } from '../src/components/TodayCalendar.tsx';
import type { CalendarEvent } from '../src/domain/calendar-events.ts';

afterEach(cleanup);

describe('TodayCalendar', () => {
  const today = new Date(2026, 10, 6, 12);

  it('shows read-only event text safely, including all-day labels and calendar names', () => {
    const day = '2026-11-06';
    const events: CalendarEvent[] = [{
      id: 'synthetic-1',
      sourceId: 'work',
      title: '<script>synthetic</script>',
      calendarName: 'Work & Home',
      kind: 'all-day',
      startDate: day,
      endDate: '2026-11-07'
    }];
    const { container } = render(
      <TodayCalendar sources={[]} events={events} state={{ kind: 'loaded' }} today={today} onSettings={() => undefined} />
    );

    expect(screen.getByText('All day')).toBeTruthy();
    expect(screen.getByText('<script>synthetic</script>')).toBeTruthy();
    expect(screen.getByText('Work & Home')).toBeTruthy();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
  });

  it('announces loading and offers an explicit retry on failure', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender } = render(
      <TodayCalendar sources={[]} events={[]} state={{ kind: 'loading' }} today={today} onSettings={() => undefined} />
    );
    expect(screen.getByRole('status').textContent).toBe('Loading calendars…');

    rerender(
      <TodayCalendar
        sources={[]}
        events={[]}
        state={{ kind: 'error' }}
        today={today}
        onSettings={() => undefined}
        onRetry={onRetry}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert').textContent).toContain('Your settings are unchanged.');
  });

  it('does not imply a clear calendar when sources have not been fetched', () => {
    render(
      <TodayCalendar
        sources={[{ id: 'calendar-source-1', name: 'Work', url: 'https://p123-caldav.icloud.com/published/test' }]}
        events={[]}
        state={{ kind: 'not-configured' }}
        today={today}
        onSettings={() => undefined}
      />
    );

    expect(screen.getByRole('status').textContent).toContain('Your saved sources have not been contacted.');
    expect(screen.queryByText('No events scheduled today.')).toBeNull();
  });

  it('keeps calendar settings in a single top-level gear action', async () => {
    const user = userEvent.setup();
    const onSettings = vi.fn();
    const { container } = render(
      <TodayCalendar
        sources={[]}
        events={[]}
        state={{ kind: 'loaded' }}
        today={today}
        onSettings={onSettings}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Calendar settings' }));
    expect(onSettings).toHaveBeenCalledOnce();
    expect(container.querySelector('.today-calendar__heading .settings-icon-button')).toBeTruthy();
    expect(container.querySelector('.calendar-card .settings-icon-button')).toBeNull();
  });
});
