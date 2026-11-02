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
  satisfiedRhythmIds,
  undoableRhythmIds = new Set<string>(),
  resetKey = 'today',
  onUndo = () => undefined
}: {
  satisfiedRhythmIds: ReadonlySet<string>;
  undoableRhythmIds?: ReadonlySet<string>;
  resetKey?: string;
  onUndo?: (rhythmId: string) => void;
}) {
  const [showTended, setShowTended] = useState(false);
  return (
    <TendedRhythmList
      rhythms={rhythms}
      satisfiedRhythmIds={satisfiedRhythmIds}
      undoableRhythmIds={undoableRhythmIds}
      showTended={showTended}
      onShowTendedChange={setShowTended}
      onUndo={onUndo}
      resetKey={resetKey}
    >
      {({ visibleRhythmIds, itemProps }) => (
        <div>
          {rhythms.filter(rhythm => visibleRhythmIds.has(rhythm.id)).map(rhythm => (
            <div key={rhythm.id} tabIndex={0} {...itemProps(rhythm.id)}>{rhythm.title}</div>
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
    expect(screen.getByText('First Rhythm')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Tended');

    act(() => vi.advanceTimersByTime(1400));
    expect(screen.queryByText('First Rhythm')).toBeNull();
    expect(screen.getByRole('button', { name: 'Undo tending First Rhythm' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show tended (1)' }).getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Undo tending First Rhythm' }));
    expect(onUndo).toHaveBeenCalledWith('one');
    rerender(<Harness satisfiedRhythmIds={new Set()} undoableRhythmIds={new Set()} onUndo={onUndo} />);
    expect(screen.getByText('First Rhythm')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show tended (0)' }));
    rerender(<Harness satisfiedRhythmIds={new Set(['one'])} undoableRhythmIds={new Set()} onUndo={onUndo} />);
    expect(screen.getByText('First Rhythm')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show tended (1)' }).getAttribute('aria-pressed')).toBe('true');
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
    expect(screen.getByText('First Rhythm')).toBeTruthy();
    expect(screen.getByText('Second Rhythm')).toBeTruthy();
    act(() => vi.advanceTimersByTime(1400));
    expect(screen.queryByText('First Rhythm')).toBeNull();
    expect(screen.queryByText('Second Rhythm')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Undo tending Second Rhythm' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onUndo).toHaveBeenCalledWith('two');
  });

  it('moves focus to the Show tended control before removing a focused card', () => {
    vi.useFakeTimers();
    const { rerender } = render(<Harness satisfiedRhythmIds={new Set()} undoableRhythmIds={new Set(['one'])} />);
    const card = screen.getByText('First Rhythm').closest('[data-tended-rhythm-item]') as HTMLElement;
    card.focus();

    rerender(<Harness satisfiedRhythmIds={new Set(['one'])} undoableRhythmIds={new Set(['one'])} />);
    act(() => vi.advanceTimersByTime(1400));

    expect(screen.queryByText('First Rhythm')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Show tended (1)' }));
  });

  it('cancels a pending removal when the list filter changes and cleans timers on unmount', () => {
    vi.useFakeTimers();
    const { rerender, unmount } = render(<Harness satisfiedRhythmIds={new Set()} />);
    rerender(<Harness satisfiedRhythmIds={new Set(['one'])} undoableRhythmIds={new Set(['one'])} />);
    expect(screen.getByText('First Rhythm')).toBeTruthy();

    rerender(<Harness satisfiedRhythmIds={new Set(['one'])} undoableRhythmIds={new Set(['one'])} resetKey="anytime" />);
    expect(screen.queryByText('First Rhythm')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
