import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useScoringInstant } from '../src/components/useScoringInstant.ts';
import { localDateString } from '../src/domain/money-goals.ts';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Today evaluation clock', () => {
  it('uses the existing scoring clock through local midnight and foreground refresh', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 27, 23, 59, 30));

    function ClockDate() {
      const instant = useScoringInstant();
      return <output>{localDateString(instant)}</output>;
    }

    const view = render(<ClockDate />);
    expect(screen.getByText('2026-10-27')).toBeTruthy();

    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByText('2026-10-28')).toBeTruthy();

    act(() => {
      vi.setSystemTime(new Date(2026, 10, 2, 12, 0));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.getByText('2026-11-02')).toBeTruthy();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
