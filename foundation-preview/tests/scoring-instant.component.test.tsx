import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useScoringInstant } from '../src/components/useScoringInstant.ts';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('refreshes across midnight and on return to the page, then cleans up its timer', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-27T23:59:30Z'));
  function Clock() {
    return <output aria-label="Evaluation instant">{useScoringInstant().toISOString()}</output>;
  }
  const view = render(<Clock />);
  expect(screen.getByLabelText('Evaluation instant').textContent).toBe('2026-10-27T23:59:30.000Z');
  act(() => { vi.advanceTimersByTime(60_000); });
  expect(screen.getByLabelText('Evaluation instant').textContent).toBe('2026-10-28T00:00:30.000Z');
  act(() => {
    vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
    window.dispatchEvent(new Event('focus'));
  });
  expect(screen.getByLabelText('Evaluation instant').textContent).toBe('2026-10-29T12:00:00.000Z');
  act(() => {
    vi.setSystemTime(new Date('2026-10-30T12:00:00Z'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(screen.getByLabelText('Evaluation instant').textContent).toBe('2026-10-30T12:00:00.000Z');
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
