import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TodayPrayerModule } from '../src/components/TodayPrayerModule.tsx';
import { syntheticPrayerRequests } from '../src/domain/preview-data.ts';

afterEach(cleanup);

describe('Today Prayer module', () => {
  it('shows the focused prayer action and runs an accessible, selectable prayer session', async () => {
    const user = userEvent.setup();
    const onPray = vi.fn(() => null);
    render(
      <TodayPrayerModule
        requests={syntheticPrayerRequests}
        evaluationInstant={new Date('2026-11-11T13:30:00.000Z')}
        timeZone="UTC"
        onPray={onPray}
      />
    );

    expect(screen.getByRole('heading', { name: 'Prayer' })).toBeTruthy();
    const module = screen.getByRole('region', { name: 'Focused Prayer' });
    expect(within(module).queryByRole('heading', { name: 'Prayer' })).toBeNull();
    expect(module.querySelector('.prayer-entry-summary')?.textContent).not.toContain('requests');
    expect(module.querySelector('.prayer-entry-count')?.textContent).toBe('2');
    expect(screen.getByRole('button', { name: 'Start focused prayer for 2 requests' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Customize' }));

    const selection = screen.getByRole('dialog', { name: 'Prayer selection' });
    expect(document.body.style.position).toBe('fixed');
    expect(within(selection).getByRole('heading', { name: 'Timeframe' })).toBeTruthy();
    expect(within(selection).getByRole('heading', { name: 'People' })).toBeTruthy();
    expect(within(selection).getByRole('button', { name: /Change timeframe, currently Now/ })).toBeTruthy();
    expect(within(selection).getByText('2 requests selected')).toBeTruthy();

    await user.click(within(selection).getByRole('button', { name: /Change timeframe/ }));
    const timeframePicker = within(selection).getByRole('group', { name: 'Prayer timeframes' });
    await user.click(within(timeframePicker).getByRole('button', { name: /Morning/ }));
    expect(within(selection).getByRole('button', { name: /Change timeframe, currently Morning/ })).toBeTruthy();
    expect(within(selection).getByText('1 request selected')).toBeTruthy();

    await user.click(within(selection).getByRole('button', { name: 'Deselect Avery Brooks' }));
    expect(within(selection).getByRole('button', { name: 'Select Avery Brooks' })).toBeTruthy();
    await user.click(within(selection).getByRole('button', { name: 'Start prayer' }));

    const session = screen.getByRole('dialog', { name: 'One request at a time' });
    expect(within(session).getByText('Request 1 of 1')).toBeTruthy();
    expect(within(session).getByRole('heading', { name: 'Patience during a busy week' })).toBeTruthy();
    expect(within(session).getByRole('progressbar', { name: 'Prayer session progress' })).toBeTruthy();
    await user.click(within(session).getByRole('button', { name: 'Prayed' }));
    expect(onPray).toHaveBeenCalledWith('sample-prayer-request-family');
    expect(within(session).getByRole('heading', { name: 'Prayer time complete' })).toBeTruthy();
    expect(within(session).getByText('You marked 1 request prayed.')).toBeTruthy();
    await user.click(within(session).getByRole('button', { name: 'Finish' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.position).toBe('');
  });

  it('disables starting a session when no active synthetic requests match', () => {
    render(
      <TodayPrayerModule
        requests={syntheticPrayerRequests.filter(request => request.status !== 'active')}
        evaluationInstant={new Date('2026-11-11T13:30:00.000Z')}
        timeZone="UTC"
        onPray={() => null}
      />
    );
    expect(screen.getByRole('button', { name: 'Start focused prayer for 0 requests' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('No active requests match this selection.')).toBeTruthy();
  });
});
