import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TendedRhythmList } from '../src/components/TendedRhythmList.tsx';
import { TendedRhythmItems } from '../src/components/TendedRhythmItems.tsx';
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

  function DoneRowsHarness({
    rhythms: displayRhythms,
    tendedRhythmIds: initialTendedRhythmIds,
    todayDate = '2026-03-10',
    resetKey = 'today'
  }: {
    rhythms: readonly RhythmPreview[];
    tendedRhythmIds: ReadonlySet<string>;
    todayDate?: string;
    resetKey?: string;
  }) {
    const [tendedRhythmIds, setTendedRhythmIds] = useState(initialTendedRhythmIds);
    return (
      <TendedRhythmList
        rhythms={displayRhythms}
        tendedRhythmIds={tendedRhythmIds}
        satisfiedRhythmIds={tendedRhythmIds}
        undoableRhythmIds={new Set(displayRhythms.map(rhythm => rhythm.id))}
        displayMode="done-rows"
        todayDate={todayDate}
        onUndo={rhythmId => setTendedRhythmIds(current => {
          const next = new Set(current);
          next.delete(rhythmId);
          return next;
        })}
        resetKey={resetKey}
      >
        {({
            tendedRhythmIds: displayedTendedIds,
            tendedDisplayItems,
            expandedTendedRhythmIds,
            onToggleTendedRhythm,
            onUndoTendedRhythm,
            itemProps
          }) => (
          <TendedRhythmItems
              className="test-rhythm-list"
              rhythms={displayRhythms}
              tendedRhythmIds={displayedTendedIds}
              displayItems={tendedDisplayItems}
              expandedRhythmIds={expandedTendedRhythmIds}
              onToggleRhythm={onToggleTendedRhythm}
              itemProps={itemProps}
              renderRhythmCard={rhythm => (
                <article data-testid="full-card" aria-label={rhythm.title}>
                  <span>{`Full card: ${rhythm.title}`}</span>
                  <button
                    type="button"
                    data-rhythm-tend-button={rhythm.id}
                    aria-label={`Tend ${rhythm.title}`}
                    onClick={() => setTendedRhythmIds(current => new Set(current).add(rhythm.id))}
                  >
                    Tend
                  </button>
                </article>
              )}
              renderExpandedRhythm={item => (
                <article data-testid="expanded-card">
                  Full card: {item.rhythm.title}
                  <button
                    type="button"
                    aria-label={`Undo tending ${item.rhythm.title}`}
                    onClick={() => onUndoTendedRhythm(item.rhythm.id)}
                  >
                    Undo
                  </button>
                </article>
              )}
          />
        )}
      </TendedRhythmList>
    );
  }

  describe('Tended Rhythm done rows', () => {
    const displayRhythms: readonly RhythmPreview[] = [
      { id: 'late', title: 'Evening walk', automation: 'manual', status: 'Due today', completionHistory: [{
        id: 'late-completion',
        effectiveDate: '2026-03-10',
        localTime: '17:30',
        completedAt: '2026-03-10T21:30:00.000Z'
      }] },
      { id: 'active', title: 'Read together', automation: 'manual', status: 'Due today' },
      { id: 'yesterday', title: 'Morning prayer', automation: 'manual', status: 'Due today', completionHistory: [{
        id: 'yesterday-completion',
        effectiveDate: '2026-03-09',
        localTime: '07:12',
        completedAt: '2026-03-09T11:12:00.000Z'
      }] },
      { id: 'early', title: 'Midday walk', automation: 'manual', status: 'Due today', completionHistory: [{
        id: 'early-completion',
        effectiveDate: '2026-03-10',
        localTime: '12:05',
        completedAt: '2026-03-10T16:05:00.000Z'
      }] }
    ];

    it('keeps compact rows in their original order and time group without a separate section', () => {
      const { container } = render(<DoneRowsHarness rhythms={displayRhythms} tendedRhythmIds={new Set([
        'late',
        'yesterday',
        'early'
      ])} />);

      const items = [...container.querySelectorAll<HTMLElement>('[data-tended-rhythm-item]')];
      expect(items.map(item => item.dataset.tendedRhythmItem)).toEqual([
        'late',
        'active',
        'yesterday',
        'early'
      ]);
      const doneRows = screen.getAllByRole('button').filter(button =>
        button.classList.contains('tended-rhythm-done-row')
      );
      expect(doneRows.map(button => button.getAttribute('aria-label'))).toEqual([
        'Evening walk, Tended 5:30 pm',
        'Morning prayer, Tended yesterday',
        'Midday walk, Tended 12:05 pm'
      ]);
      expect(doneRows.every(button => button.getAttribute('aria-expanded') === 'false')).toBe(true);
      expect(screen.queryByRole('button', { name: /Show tended|Hide tended/ })).toBeNull();
      expect(screen.queryByTestId('expanded-card')).toBeNull();
      expect(doneRows[0]?.querySelector('button')).toBeNull();
      expect(screen.queryByRole('heading', { name: 'Tended today' })).toBeNull();
      expect(screen.getByTestId('full-card').textContent).toContain('Read together');
      expect(doneRows[1]?.classList.contains('tended-rhythm-done-row--carry-over')).toBe(true);
    });

    it('replaces a focused card with a compact row at the same position and announces the change', async () => {
      const user = userEvent.setup();
      const { container } = render(<DoneRowsHarness
        rhythms={displayRhythms}
        tendedRhythmIds={new Set(['late'])}
      />);
      await user.click(screen.getByRole('button', { name: 'Tend Read together' }));

      const row = screen.getByRole('button', { name: 'Read together, Tended today' });
      expect([...container.querySelectorAll<HTMLElement>('[data-tended-rhythm-item]')]
        .map(item => item.dataset.tendedRhythmItem)).toEqual([
          'late',
          'active',
          'yesterday',
          'early'
        ]);
      expect(row.closest('.test-rhythm-list')).toBeTruthy();
      expect(document.activeElement).toBe(row);
      expect(screen.getByRole('status').textContent)
        .toContain('It collapsed to a compact row in its original position.');
    });

    it('expands and collapses in place, then restores the card in that slot on Undo', async () => {
      const user = userEvent.setup();
      const { container } = render(<DoneRowsHarness rhythms={displayRhythms} tendedRhythmIds={new Set(['late'])} />);

      const row = screen.getByRole('button', { name: 'Evening walk, Tended 5:30 pm' });
      const lateItem = row.closest('[data-tended-rhythm-item]')!;
      const initialOrder = [...container.querySelectorAll<HTMLElement>('[data-tended-rhythm-item]')]
        .map(item => item.dataset.tendedRhythmItem);
      expect(initialOrder).toEqual(['late', 'active', 'yesterday', 'early']);
      expect(row.getAttribute('aria-expanded')).toBe('false');
      await user.click(row);
      expect(row.getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByTestId('expanded-card').textContent).toContain('Full card: Evening walk');
      expect(row.closest('[data-tended-rhythm-item]')).toBe(lateItem);
      expect([...container.querySelectorAll<HTMLElement>('[data-tended-rhythm-item]')]
        .map(item => item.dataset.tendedRhythmItem)).toEqual(initialOrder);

      await user.click(row);
      expect(row.getAttribute('aria-expanded')).toBe('false');
      expect(screen.queryByTestId('expanded-card')).toBeNull();

      await user.click(row);
      await user.click(screen.getByRole('button', { name: 'Undo tending Evening walk' }));
      expect(screen.queryByRole('button', { name: 'Evening walk, Tended 5:30 pm' })).toBeNull();
      expect(screen.getByRole('article', { name: 'Evening walk' })).toBeTruthy();
      expect([...container.querySelectorAll<HTMLElement>('[data-tended-rhythm-item]')]
        .map(item => item.dataset.tendedRhythmItem)).toEqual(initialOrder);
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tend Evening walk' }));
    });

    it('resets expanded state when the displayed Today list changes', () => {
      const { rerender } = render(<DoneRowsHarness
        rhythms={displayRhythms}
        tendedRhythmIds={new Set(['late'])}
      />);
      const row = screen.getByRole('button', { name: 'Evening walk, Tended 5:30 pm' });
      fireEvent.click(row);
      expect(row.getAttribute('aria-expanded')).toBe('true');

      rerender(<DoneRowsHarness
        rhythms={displayRhythms}
        tendedRhythmIds={new Set(['late'])}
        resetKey="tomorrow"
      />);
      expect(screen.getByRole('button', { name: 'Evening walk, Tended 5:30 pm' })
        .getAttribute('aria-expanded')).toBe('false');
    });
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
