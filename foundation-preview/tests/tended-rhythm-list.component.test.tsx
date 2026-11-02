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
  tendedRhythmIds,
  satisfiedRhythmIds,
  undoableRhythmIds = new Set<string>(),
  resetKey = 'today',
  onUndo = () => undefined
}: {
  tendedRhythmIds?: ReadonlySet<string>;
  satisfiedRhythmIds: ReadonlySet<string>;
  undoableRhythmIds?: ReadonlySet<string>;
  resetKey?: string;
  onUndo?: (rhythmId: string) => void;
}) {
  const [showTended, setShowTended] = useState(false);
  return (
    <TendedRhythmList
      rhythms={rhythms}
      tendedRhythmIds={tendedRhythmIds ?? satisfiedRhythmIds}
      satisfiedRhythmIds={satisfiedRhythmIds}
      undoableRhythmIds={undoableRhythmIds}
      showTended={showTended}
      onShowTendedChange={setShowTended}
      onUndo={onUndo}
      resetKey={resetKey}
    >
      {({ visibleRhythmIds, tendedRhythmIds: displayIds, itemProps }) => (
        <div>
          {rhythms.filter(rhythm => visibleRhythmIds.has(rhythm.id)).map(rhythm => (
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
  it('keeps a completed card briefly, then hides it while retaining an accessible undo action', () => {
    vi.useFakeTimers();
    const onUndo = vi.fn();
    const { rerender } = render(<Harness satisfiedRhythmIds={new Set()} undoableRhythmIds={new Set(['one'])} onUndo={onUndo} />);
    expect(screen.getByText('First Rhythm')).toBeTruthy();

    rerender(<Harness
      satisfiedRhythmIds={new Set(['one'])}
      undoableRhythmIds={new Set(['one'])}
      onUndo={onUndo}
    />);
    expect(screen.getByText('First Rhythm — Tended')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Tended');

    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText('First Rhythm — Tended').closest('.show-tended-list__item')?.classList.contains('is-fading')).toBe(true);
    act(() => vi.advanceTimersByTime(219));
    expect(screen.getByText('First Rhythm — Tended')).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('First Rhythm — Tended')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show tended (1)' }).getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Show tended (1)' }));
    expect(screen.getByText('First Rhythm — Tended')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo card' }));
    expect(onUndo).toHaveBeenCalledWith('one');
    rerender(<Harness satisfiedRhythmIds={new Set()} undoableRhythmIds={new Set()} onUndo={onUndo} />);
    expect(screen.getByText('First Rhythm')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();

    rerender(<Harness satisfiedRhythmIds={new Set(['one'])} undoableRhythmIds={new Set()} onUndo={onUndo} />);
    expect(screen.getByText('First Rhythm — Tended')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show tended (1)' }).getAttribute('aria-pressed')).toBe('true');
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
    expect(screen.getByRole('button', { name: 'Show tended (1)' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('does not restart the grace timer on rerender and cancels it when Show tended is enabled', () => {
    vi.useFakeTimers();
    const { rerender } = render(<Harness satisfiedRhythmIds={new Set()} />);
    rerender(<Harness satisfiedRhythmIds={new Set(['one'])} />);
    act(() => vi.advanceTimersByTime(3000));
    rerender(<Harness satisfiedRhythmIds={new Set(['one'])} />);
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByText('First Rhythm — Tended').closest('.show-tended-list__item')?.classList.contains('is-fading')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Show tended (1)' }));
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.getByText('First Rhythm — Tended')).toBeTruthy();
    expect(screen.getByText('First Rhythm — Tended').closest('.show-tended-list__item')?.classList.contains('is-fading')).toBe(false);
  });

  it('keeps an accessible card Undo after the transient notice expires', () => {
    vi.useFakeTimers();
    const onUndo = vi.fn();
    const { rerender } = render(<Harness satisfiedRhythmIds={new Set()} undoableRhythmIds={new Set(['one'])} onUndo={onUndo} />);
    rerender(<Harness
      satisfiedRhythmIds={new Set(['one'])}
      undoableRhythmIds={new Set(['one'])}
      onUndo={onUndo}
    />);
    act(() => vi.advanceTimersByTime(5220));
    fireEvent.click(screen.getByRole('button', { name: 'Show tended (1)' }));
    expect(screen.getByText('First Rhythm — Tended')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo card' }));
    expect(onUndo).toHaveBeenCalledWith('one');
  });

  it('cancels the removal timer when Undo is used during the grace period', () => {
    vi.useFakeTimers();
    const onUndo = vi.fn();
    const { rerender } = render(<Harness satisfiedRhythmIds={new Set()} undoableRhythmIds={new Set(['one'])} onUndo={onUndo} />);
    rerender(<Harness
      satisfiedRhythmIds={new Set(['one'])}
      undoableRhythmIds={new Set(['one'])}
      onUndo={onUndo}
    />);
    fireEvent.click(screen.getByRole('button', { name: 'Undo tending First Rhythm' }));
    rerender(<Harness satisfiedRhythmIds={new Set()} undoableRhythmIds={new Set()} onUndo={onUndo} />);
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.getByText('First Rhythm')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
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
    act(() => vi.advanceTimersByTime(5220));
    expect(screen.queryByText('First Rhythm — Tended')).toBeNull();
    expect(screen.queryByText('Second Rhythm — Tended')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show tended (2)' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Undo card' })[1]!);
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onUndo).toHaveBeenCalledWith('two');
  });

  it('moves focus to the Show tended control before removing a focused card', () => {
    vi.useFakeTimers();
    const { rerender } = render(<Harness satisfiedRhythmIds={new Set()} undoableRhythmIds={new Set(['one'])} />);
    const card = screen.getByText('First Rhythm').closest('[data-tended-rhythm-item]') as HTMLElement;
    card.focus();

    rerender(<Harness satisfiedRhythmIds={new Set(['one'])} undoableRhythmIds={new Set(['one'])} />);
    act(() => vi.advanceTimersByTime(5220));

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
