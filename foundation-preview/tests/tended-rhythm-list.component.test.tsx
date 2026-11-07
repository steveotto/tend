import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TendedRhythmList } from '../src/components/TendedRhythmList.tsx';
import type { RhythmPreview } from '../src/domain/preview-data.ts';

const rhythms: readonly RhythmPreview[] = [
  { id: 'one', title: 'First Rhythm', automation: 'manual', status: 'Due today' },
  { id: 'two', title: 'Second Rhythm', automation: 'manual', status: 'Due today' }
];

function Harness({
  rhythms: displayRhythms = rhythms,
  tendedRhythmIds,
  satisfiedRhythmIds,
  undoableRhythmIds = new Set<string>(),
  resetKey = 'today',
  showProgress = false,
  keepToggleWhenEmpty = false,
  onUndo = () => undefined
}: {
  rhythms?: readonly RhythmPreview[];
  tendedRhythmIds?: ReadonlySet<string>;
  satisfiedRhythmIds: ReadonlySet<string>;
  undoableRhythmIds?: ReadonlySet<string>;
  resetKey?: string;
  showProgress?: boolean;
  keepToggleWhenEmpty?: boolean;
  onUndo?: (rhythmId: string) => void;
}) {
  const [showTended, setShowTended] = useState(false);
  return (
    <TendedRhythmList
      rhythms={displayRhythms}
      tendedRhythmIds={tendedRhythmIds ?? satisfiedRhythmIds}
      satisfiedRhythmIds={satisfiedRhythmIds}
      undoableRhythmIds={undoableRhythmIds}
      showTended={showTended}
      onShowTendedChange={setShowTended}
      onUndo={onUndo}
      resetKey={resetKey}
      showProgress={showProgress}
      keepToggleWhenEmpty={keepToggleWhenEmpty}
    >
      {({ visibleRhythmIds, tendedRhythmIds: displayIds, itemProps }) => (
        <div>
          {displayRhythms.filter(rhythm => visibleRhythmIds.has(rhythm.id)).map(rhythm => (
            <div key={rhythm.id} tabIndex={0} {...itemProps(rhythm.id)}>
              {rhythm.title}{displayIds.has(rhythm.id) ? ' — Tended' : ''}
              {displayIds.has(rhythm.id) && undoableRhythmIds.has(rhythm.id) && (
                <button type="button" onClick={() => onUndo(rhythm.id)}>Undo card</button>
              )}
            </div>
          ))}
        </div>
      )}
    </TendedRhythmList>
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Show tended list', () => {
  it('keeps an empty progress count as text and omits the inactive toggle', () => {
    render(<Harness rhythms={[]} satisfiedRhythmIds={new Set()} showProgress />);

    expect(screen.getByText('0 of 0 tended')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Show tended|Hide tended/ })).toBeNull();
  });

  it('omits empty-list controls outside Today while preserving Today empty-filter controls', () => {
    const { rerender } = render(<Harness rhythms={[]} satisfiedRhythmIds={new Set()} />);
    expect(screen.queryByRole('button', { name: /Show tended|Hide tended/ })).toBeNull();
    expect(document.querySelector('.show-tended-list__controls')).toBeNull();

    rerender(<Harness
      rhythms={[]}
      satisfiedRhythmIds={new Set()}
      showProgress
      keepToggleWhenEmpty
    />);
    expect(screen.getByRole('button', { name: 'Show tended' })).toBeTruthy();
  });

  it('keeps a completed card briefly, then hides it while retaining an accessible undo action', () => {
    vi.useFakeTimers();
    const onUndo = vi.fn();
    const { rerender } = render(<Harness satisfiedRhythmIds={new Set()} undoableRhythmIds={new Set(['one'])} onUndo={onUndo} />);
    const originalItem = screen.getByText('First Rhythm').closest('[data-tended-rhythm-item]');

    rerender(<Harness
      satisfiedRhythmIds={new Set(['one'])}
      undoableRhythmIds={new Set(['one'])}
      onUndo={onUndo}
    />);
    expect(screen.getByText('First Rhythm — Tended')).toBeTruthy();
    expect(screen.getByText('First Rhythm — Tended').closest('[data-tended-rhythm-item]')).toBe(originalItem);
    expect(originalItem?.getAttribute('hidden')).toBeNull();
    expect(originalItem?.classList.contains('is-fading')).toBe(false);
    expect(screen.getByRole('status').textContent).toContain('Tended');

    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByText('First Rhythm — Tended').closest('.show-tended-list__item')?.classList.contains('is-fading')).toBe(true);
    act(() => vi.advanceTimersByTime(799));
    expect(screen.getByText('First Rhythm — Tended')).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText('First Rhythm — Tended').closest('.show-tended-list__item')?.classList.contains('is-collapsing')).toBe(true);
    act(() => vi.advanceTimersByTime(259));
    expect(screen.getByText('First Rhythm — Tended')).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('First Rhythm — Tended')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show tended (1)' }).getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Show tended (1)' }));
    expect(screen.getByText('First Rhythm — Tended')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hide tended (1)' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Undo card' }));
    expect(onUndo).toHaveBeenCalledWith('one');
    rerender(<Harness satisfiedRhythmIds={new Set()} undoableRhythmIds={new Set()} onUndo={onUndo} />);
    expect(screen.getByText('First Rhythm')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hide tended (0)' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('status')).toBeNull();

    rerender(<Harness satisfiedRhythmIds={new Set(['one'])} undoableRhythmIds={new Set()} onUndo={onUndo} />);
    expect(screen.getByText('First Rhythm — Tended')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hide tended (1)' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('uses the same saved-today state for the card and count while an unsatisfied schedule stays visible', () => {
    render(<Harness
      tendedRhythmIds={new Set(['one'])}
      satisfiedRhythmIds={new Set()}
      undoableRhythmIds={new Set(['one'])}
    />);
    expect(screen.getByText('First Rhythm — Tended')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show tended (1)' })).toBeTruthy();
    expect(screen.getByText('Second Rhythm')).toBeTruthy();
  });

  it('hides already-tended cards immediately on load and reveals them with Show tended', () => {
    vi.useFakeTimers();
    render(<Harness tendedRhythmIds={new Set(['one'])} satisfiedRhythmIds={new Set(['one'])} />);
    expect(screen.queryByText('First Rhythm — Tended')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show tended (1)' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('status')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'Show tended (1)' }));
    expect(screen.getByText('First Rhythm — Tended')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hide tended (1)' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('does not restart the grace timer on state or object-reference churn and cancels removal when Show tended is enabled', () => {
    vi.useFakeTimers();
    const { rerender } = render(<Harness satisfiedRhythmIds={new Set()} />);
    rerender(<Harness satisfiedRhythmIds={new Set(['one'])} />);
    act(() => vi.advanceTimersByTime(2000));
    rerender(<Harness
      rhythms={rhythms.map(rhythm => ({ ...rhythm }))}
      satisfiedRhythmIds={new Set(['one'])}
    />);
    expect(vi.getTimerCount()).toBe(2);
    act(() => vi.advanceTimersByTime(999));
    expect(screen.getByText('First Rhythm — Tended').closest('.show-tended-list__item')?.classList.contains('is-fading')).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText('First Rhythm — Tended').closest('.show-tended-list__item')?.classList.contains('is-fading')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Show tended (1)' }));
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.getByText('First Rhythm — Tended')).toBeTruthy();
    expect(screen.getByText('First Rhythm — Tended').closest('.show-tended-list__item')?.classList.contains('is-fading')).toBe(false);
  });

  it('cancels the three-second grace delay when Undo is used before fading starts', () => {
    vi.useFakeTimers();
    const onUndo = vi.fn();
    const { rerender } = render(<Harness satisfiedRhythmIds={new Set()} undoableRhythmIds={new Set(['one'])} onUndo={onUndo} />);
    rerender(<Harness satisfiedRhythmIds={new Set(['one'])} undoableRhythmIds={new Set(['one'])} onUndo={onUndo} />);
    fireEvent.click(screen.getByRole('button', { name: 'Undo tending First Rhythm' }));
    expect(onUndo).toHaveBeenCalledWith('one');

    rerender(<Harness satisfiedRhythmIds={new Set()} undoableRhythmIds={new Set()} onUndo={onUndo} />);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText('First Rhythm')).toBeTruthy();
    expect(screen.getByText('First Rhythm').closest('.show-tended-list__item')?.classList.contains('is-fading')).toBe(false);
  });

  it('keeps Undo available during the space-collapse phase', () => {
    vi.useFakeTimers();
    const onUndo = vi.fn();
    const { rerender } = render(<Harness satisfiedRhythmIds={new Set()} undoableRhythmIds={new Set(['one'])} onUndo={onUndo} />);
    rerender(<Harness
      satisfiedRhythmIds={new Set(['one'])}
      undoableRhythmIds={new Set(['one'])}
      onUndo={onUndo}
    />);
    act(() => vi.advanceTimersByTime(3800));
    expect(screen.getByText('First Rhythm — Tended').closest('.show-tended-list__item')?.classList.contains('is-collapsing')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Undo tending First Rhythm' }));
    rerender(<Harness satisfiedRhythmIds={new Set()} undoableRhythmIds={new Set(['one'])} onUndo={onUndo} />);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('First Rhythm')).toBeTruthy();
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('cancels the fade when Undo is used during the animation', () => {
    vi.useFakeTimers();
    const onUndo = vi.fn();
    const { rerender } = render(<Harness satisfiedRhythmIds={new Set()} undoableRhythmIds={new Set(['one'])} onUndo={onUndo} />);
    rerender(<Harness satisfiedRhythmIds={new Set(['one'])} undoableRhythmIds={new Set(['one'])} onUndo={onUndo} />);
    act(() => vi.advanceTimersByTime(3200));
    fireEvent.click(screen.getByRole('button', { name: 'Undo tending First Rhythm' }));
    rerender(<Harness satisfiedRhythmIds={new Set()} undoableRhythmIds={new Set()} onUndo={onUndo} />);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('First Rhythm')).toBeTruthy();
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('removes completed cards after the grace period without animating for reduced motion', () => {
    vi.useFakeTimers();
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as typeof window.matchMedia;
    try {
      const { rerender } = render(<Harness satisfiedRhythmIds={new Set()} />);
      rerender(<Harness satisfiedRhythmIds={new Set(['one'])} />);
      act(() => vi.advanceTimersByTime(3000));
      expect(screen.queryByText('First Rhythm — Tended')).toBeNull();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('restores a removed Rhythm in its original order with Undo', () => {
    vi.useFakeTimers();
    const onUndo = vi.fn();
    const { container, rerender } = render(<Harness satisfiedRhythmIds={new Set()} undoableRhythmIds={new Set(['two'])} onUndo={onUndo} />);
    rerender(<Harness
      satisfiedRhythmIds={new Set(['two'])}
      undoableRhythmIds={new Set(['two'])}
      onUndo={onUndo}
    />);
    act(() => vi.advanceTimersByTime(4070));
    expect(screen.queryByText('Second Rhythm — Tended')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show tended (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo card' }));
    expect(onUndo).toHaveBeenCalledWith('two');
    rerender(<Harness satisfiedRhythmIds={new Set()} undoableRhythmIds={new Set()} onUndo={onUndo} />);
    expect(Array.from(container.querySelectorAll('[data-tended-rhythm-item]')).map(item => item.getAttribute('data-tended-rhythm-item')))
      .toEqual(['one', 'two']);
  });

  it('keeps the completion Undo available briefly after the card is removed', () => {
    vi.useFakeTimers();
    const onUndo = vi.fn();
    const { rerender } = render(<Harness satisfiedRhythmIds={new Set()} undoableRhythmIds={new Set(['one'])} onUndo={onUndo} />);
    rerender(<Harness satisfiedRhythmIds={new Set(['one'])} undoableRhythmIds={new Set(['one'])} onUndo={onUndo} />);
    act(() => vi.advanceTimersByTime(4060));
    expect(screen.queryByText('First Rhythm — Tended')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Undo tending First Rhythm' }));
    expect(onUndo).toHaveBeenCalledWith('one');
  });

  it('keeps rapid completions and undo actions associated with their own Rhythm', () => {
    vi.useFakeTimers();
    const onUndo = vi.fn();
    const { rerender } = render(<Harness satisfiedRhythmIds={new Set()} undoableRhythmIds={new Set(['one', 'two'])} onUndo={onUndo} />);
    rerender(<Harness
      satisfiedRhythmIds={new Set(['one', 'two'])}
      undoableRhythmIds={new Set(['one', 'two'])}
      onUndo={onUndo}
    />);
    expect(screen.getByText('First Rhythm — Tended')).toBeTruthy();
    expect(screen.getByText('Second Rhythm — Tended')).toBeTruthy();
    act(() => vi.advanceTimersByTime(4060));
    expect(screen.queryByText('First Rhythm — Tended')).toBeNull();
    expect(screen.queryByText('Second Rhythm — Tended')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show tended (2)' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Undo card' })[1]!);
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onUndo).toHaveBeenCalledWith('two');
  });

  it('runs staggered completion timers independently', () => {
    vi.useFakeTimers();
    const onUndo = vi.fn();
    const { rerender } = render(<Harness satisfiedRhythmIds={new Set()} undoableRhythmIds={new Set(['one', 'two'])} onUndo={onUndo} />);
    rerender(<Harness
      satisfiedRhythmIds={new Set(['one'])}
      undoableRhythmIds={new Set(['one', 'two'])}
      onUndo={onUndo}
    />);
    act(() => vi.advanceTimersByTime(1000));
    rerender(<Harness
      satisfiedRhythmIds={new Set(['one', 'two'])}
      undoableRhythmIds={new Set(['one', 'two'])}
      onUndo={onUndo}
    />);

    act(() => vi.advanceTimersByTime(2000));
    const first = screen.getByText('First Rhythm — Tended').closest('.show-tended-list__item')!;
    const second = screen.getByText('Second Rhythm — Tended').closest('.show-tended-list__item')!;
    expect(first.classList.contains('is-fading')).toBe(true);
    expect(second.classList.contains('is-fading')).toBe(false);

    act(() => vi.advanceTimersByTime(1000));
    expect(first.classList.contains('is-collapsing')).toBe(true);
    expect(second.classList.contains('is-fading')).toBe(true);
    act(() => vi.advanceTimersByTime(60));
    expect(screen.queryByText('First Rhythm — Tended')).toBeNull();
    expect(screen.getByText('Second Rhythm — Tended')).toBeTruthy();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByText('Second Rhythm — Tended')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show tended (2)' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Undo card' })[1]!);
    expect(onUndo).toHaveBeenCalledWith('two');
  });

  it('moves focus to the Show tended control before removing a focused card', () => {
    vi.useFakeTimers();
    const { rerender } = render(<Harness satisfiedRhythmIds={new Set()} undoableRhythmIds={new Set(['one'])} />);
    const card = screen.getByText('First Rhythm').closest('[data-tended-rhythm-item]') as HTMLElement;
    card.focus();

    rerender(<Harness satisfiedRhythmIds={new Set(['one'])} undoableRhythmIds={new Set(['one'])} />);
    act(() => vi.advanceTimersByTime(4060));

    expect(screen.queryByText('First Rhythm — Tended')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Show tended (1)' }));
  });

  it('cancels a pending removal when the list filter changes and cleans timers on unmount', () => {
    vi.useFakeTimers();
    const { rerender, unmount } = render(<Harness satisfiedRhythmIds={new Set()} />);
    rerender(<Harness satisfiedRhythmIds={new Set(['one'])} undoableRhythmIds={new Set(['one'])} />);
    expect(screen.getByText('First Rhythm — Tended')).toBeTruthy();

    rerender(<Harness satisfiedRhythmIds={new Set(['one'])} undoableRhythmIds={new Set(['one'])} resetKey="anytime" />);
    expect(screen.queryByText('First Rhythm — Tended')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
