import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, FocusEvent } from 'react';
import type { RhythmPreview } from '../domain/preview-data.ts';
import {
  selectTendedRhythmDisplayItems,
  type TendedRhythmDisplayItem
} from '../domain/category-rhythms.ts';

type TendedNotice = {
  key: number;
  rhythmId: string;
  title: string;
  undoable: boolean;
};

type TendedRhythmListRenderState = {
  visibleRhythmIds: ReadonlySet<string>;
  tendedRhythmIds: ReadonlySet<string>;
  tendedDisplayItems: readonly TendedRhythmDisplayItem[];
  expandedTendedRhythmIds: ReadonlySet<string>;
  onToggleTendedRhythm: (rhythmId: string) => void;
  onUndoTendedRhythm: (rhythmId: string) => void;
  controls: ReactNode;
  itemProps: (rhythmId: string) => {
    className: string;
    'data-tended-rhythm-item': string;
    inert: boolean;
    onFocusCapture: (event: FocusEvent<HTMLDivElement>) => void;
    onBlurCapture: (event: FocusEvent<HTMLDivElement>) => void;
  };
};

type Props = {
  rhythms: readonly RhythmPreview[];
  tendedRhythmIds: ReadonlySet<string>;
  satisfiedRhythmIds: ReadonlySet<string>;
  undoableRhythmIds: ReadonlySet<string>;
  showTended?: boolean;
  onShowTendedChange?: (show: boolean) => void;
  onUndo: (rhythmId: string) => void;
  resetKey: string;
  showProgress?: boolean;
  progressDisclosure?: boolean;
  keepToggleWhenEmpty?: boolean;
  displayMode?: 'toggle' | 'done-rows';
  todayDate?: string;
  renderControls?: boolean;
  initializing?: boolean;
  children: (state: TendedRhythmListRenderState) => ReactNode;
};

const CARD_GRACE_MS = 3000;
const CARD_FADE_MS = 800;
const CARD_COLLAPSE_MS = 260;
const NOTICE_DURATION_MS = CARD_GRACE_MS + CARD_FADE_MS + CARD_COLLAPSE_MS + 5000;

export function TendedRhythmList({
  rhythms,
  tendedRhythmIds,
  satisfiedRhythmIds,
  undoableRhythmIds,
  showTended = false,
  onShowTendedChange = () => undefined,
  onUndo,
  resetKey,
  showProgress = false,
  progressDisclosure = false,
  keepToggleWhenEmpty = false,
  displayMode = 'toggle',
  todayDate = '',
  renderControls = true,
  initializing = false,
  children
}: Props) {
  const [pendingRemovalIds, setPendingRemovalIds] = useState<ReadonlySet<string>>(new Set());
  const [fadingIds, setFadingIds] = useState<ReadonlySet<string>>(new Set());
  const [collapsingIds, setCollapsingIds] = useState<ReadonlySet<string>>(new Set());
  const [notices, setNotices] = useState<readonly TendedNotice[]>([]);
  const removeTimers = useRef(new Map<string, number>());
  const noticeTimers = useRef(new Map<number, number>());
  const nextNoticeKey = useRef(0);
  const previousSatisfiedIds = useRef<ReadonlySet<string> | null>(null);
  const previousResetKey = useRef(resetKey);
  const previousItemIds = useRef('');
  const previousShowTended = useRef(showTended);
  const showTendedRef = useRef(showTended);
  const wasInitializing = useRef(initializing);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const lastFocusedRhythmId = useRef<string | null>(null);
  const focusedRhythmId = useRef<string | null>(null);
  const pendingUndoFocusId = useRef<string | null>(null);
  const itemIdsKey = rhythms.map(rhythm => rhythm.id).join('\u001f');
  const displayResetKey = `${resetKey}\u001f${itemIdsKey}`;
  const previousDisplayResetKey = useRef(displayResetKey);
  const [expandedTendedRhythmIds, setExpandedTendedRhythmIds] = useState<ReadonlySet<string>>(new Set());
  const rhythmIds = useMemo(
    () => new Set(itemIdsKey ? itemIdsKey.split('\u001f') : []),
    [itemIdsKey]
  );
  const satisfactionKey = [...satisfiedRhythmIds].sort().join('\u001f');
  const tendedKey = [...tendedRhythmIds].sort().join('\u001f');
  const undoableKey = [...undoableRhythmIds].sort().join('\u001f');
  const tendedCount = rhythms.filter(rhythm => tendedRhythmIds.has(rhythm.id)).length;
  const hasToggle = displayMode === 'toggle' && (rhythms.length > 0 || keepToggleWhenEmpty);
  const tendedDisplayItems = useMemo(
    () => displayMode === 'done-rows'
      ? selectTendedRhythmDisplayItems(rhythms, tendedRhythmIds, todayDate)
      : [],
    [displayMode, rhythms, tendedRhythmIds, todayDate]
  );
  const visibleRhythmIds = useMemo(
    () => {
      if (displayMode === 'done-rows') return new Set(rhythms.map(rhythm => rhythm.id));
      const previousSatisfied = previousSatisfiedIds.current;
      return new Set(rhythms
        .filter(rhythm => showTended
          || !satisfiedRhythmIds.has(rhythm.id)
          || pendingRemovalIds.has(rhythm.id)
          || previousSatisfied !== null && !previousSatisfied.has(rhythm.id))
        .map(rhythm => rhythm.id));
    },
    [displayMode, rhythms, showTended, satisfiedRhythmIds, pendingRemovalIds]
  );

  function clearTimers() {
    for (const timer of removeTimers.current.values()) window.clearTimeout(timer);
    for (const timer of noticeTimers.current.values()) window.clearTimeout(timer);
    removeTimers.current.clear();
    noticeTimers.current.clear();
  }

  function focusDoneRow(rhythmId: string) {
    const button = [...document.querySelectorAll<HTMLButtonElement>('[data-tended-rhythm-done-button]')]
      .find(candidate => candidate.dataset.tendedRhythmDoneButton === rhythmId);
    if (!button) return;
    button.focus({ preventScroll: true });
    focusedRhythmId.current = rhythmId;
  }

  function clearRemovalTimers() {
    for (const timer of removeTimers.current.values()) window.clearTimeout(timer);
    removeTimers.current.clear();
  }

  function prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  function clearForRhythm(rhythmId: string) {
    const timer = removeTimers.current.get(rhythmId);
    if (timer !== undefined) window.clearTimeout(timer);
    removeTimers.current.delete(rhythmId);
    setPendingRemovalIds(current => {
      if (!current.has(rhythmId)) return current;
      const next = new Set(current);
      next.delete(rhythmId);
      return next;
    });
    setFadingIds(current => {
      if (!current.has(rhythmId)) return current;
      const next = new Set(current);
      next.delete(rhythmId);
      return next;
    });
    setCollapsingIds(current => {
      if (!current.has(rhythmId)) return current;
      const next = new Set(current);
      next.delete(rhythmId);
      return next;
    });
    setNotices(current => {
      const removed = current.filter(notice => notice.rhythmId !== rhythmId);
      for (const notice of current) {
        if (notice.rhythmId !== rhythmId) continue;
        const noticeTimer = noticeTimers.current.get(notice.key);
        if (noticeTimer !== undefined) window.clearTimeout(noticeTimer);
        noticeTimers.current.delete(notice.key);
      }
      return removed;
    });
  }

  function moveFocusBeforeRemoval(rhythmId: string) {
    const activeElement = document.activeElement;
    const focusedItem = activeElement?.closest<HTMLElement>('[data-tended-rhythm-item]');
    if (focusedItem?.dataset.tendedRhythmItem === rhythmId || activeElement === document.body) {
      toggleRef.current?.focus({ preventScroll: true });
    }
  }

  function toggleTendedRhythm(rhythmId: string) {
    setExpandedTendedRhythmIds(current => {
      const next = new Set(current);
      if (next.has(rhythmId)) next.delete(rhythmId);
      else next.add(rhythmId);
      return next;
    });
  }

  function undoTendedRhythm(rhythmId: string) {
    pendingUndoFocusId.current = rhythmId;
    clearForRhythm(rhythmId);
    onUndo(rhythmId);
  }

  useLayoutEffect(() => {
    if (previousDisplayResetKey.current === displayResetKey) return;
    previousDisplayResetKey.current = displayResetKey;
    setExpandedTendedRhythmIds(new Set());
  }, [displayResetKey]);

  useLayoutEffect(() => {
    const currentSatisfied = new Set(satisfiedRhythmIds);
    const showTendedEnabled = displayMode === 'toggle' && !previousShowTended.current && showTended;
    previousShowTended.current = showTended;
    showTendedRef.current = showTended;

    if (showTendedEnabled) {
      clearRemovalTimers();
      setPendingRemovalIds(new Set());
      setFadingIds(new Set());
      setCollapsingIds(new Set());
    }

    const filterChanged = previousResetKey.current !== resetKey
      || previousItemIds.current !== itemIdsKey;

    if (initializing || wasInitializing.current || previousSatisfiedIds.current === null || filterChanged) {
      if (filterChanged) {
        const activeElement = document.activeElement;
        const focusedItem = activeElement?.closest<HTMLElement>('[data-tended-rhythm-item]');
        const focusedId = focusedItem?.dataset.tendedRhythmItem ?? lastFocusedRhythmId.current;
        if (focusedId && (!rhythmIds.has(focusedId)
          || !showTended && currentSatisfied.has(focusedId))) {
          toggleRef.current?.focus({ preventScroll: true });
        }
      }
      clearTimers();
      setPendingRemovalIds(new Set());
      setFadingIds(new Set());
      setCollapsingIds(new Set());
      setNotices([]);
      previousSatisfiedIds.current = currentSatisfied;
      previousResetKey.current = resetKey;
      previousItemIds.current = itemIdsKey;
      wasInitializing.current = initializing;
      return;
    }

    const previouslySatisfied = previousSatisfiedIds.current;
    for (const id of previouslySatisfied) {
      if (!currentSatisfied.has(id)) clearForRhythm(id);
    }

    for (const rhythm of rhythms) {
      if (!currentSatisfied.has(rhythm.id) || previouslySatisfied.has(rhythm.id)) continue;
      const noticeKey = nextNoticeKey.current++;
      setNotices(current => [...current, {
        key: noticeKey,
        rhythmId: rhythm.id,
        title: rhythm.title,
        undoable: undoableRhythmIds.has(rhythm.id) && !rhythm.healthLogCapability
      }]);
      const noticeTimer = window.setTimeout(() => {
        setNotices(current => current.filter(notice => notice.key !== noticeKey));
        noticeTimers.current.delete(noticeKey);
      }, NOTICE_DURATION_MS);
      noticeTimers.current.set(noticeKey, noticeTimer);

      if (displayMode === 'done-rows' && focusedRhythmId.current === rhythm.id) {
        focusDoneRow(rhythm.id);
      }

      if (displayMode === 'toggle' && !showTended) {
        setPendingRemovalIds(current => new Set(current).add(rhythm.id));
        const graceTimer = window.setTimeout(() => {
          if (showTendedRef.current) return;
          if (prefersReducedMotion()) {
            moveFocusBeforeRemoval(rhythm.id);
            setPendingRemovalIds(current => {
              const next = new Set(current);
              next.delete(rhythm.id);
              return next;
            });
            removeTimers.current.delete(rhythm.id);
            return;
          }
          setFadingIds(current => new Set(current).add(rhythm.id));
          const fadeTimer = window.setTimeout(() => {
            moveFocusBeforeRemoval(rhythm.id);
            setCollapsingIds(current => new Set(current).add(rhythm.id));
            const collapseTimer = window.setTimeout(() => {
              setPendingRemovalIds(current => {
                const next = new Set(current);
                next.delete(rhythm.id);
                return next;
              });
              setFadingIds(current => {
                const next = new Set(current);
                next.delete(rhythm.id);
                return next;
              });
              setCollapsingIds(current => {
                const next = new Set(current);
                next.delete(rhythm.id);
                return next;
              });
              removeTimers.current.delete(rhythm.id);
            }, CARD_COLLAPSE_MS);
            removeTimers.current.set(rhythm.id, collapseTimer);
          }, CARD_FADE_MS);
          removeTimers.current.set(rhythm.id, fadeTimer);
        }, CARD_GRACE_MS);
        removeTimers.current.set(rhythm.id, graceTimer);
      }
    }
    previousSatisfiedIds.current = currentSatisfied;
    previousResetKey.current = resetKey;
    previousItemIds.current = itemIdsKey;
    wasInitializing.current = false;
  }, [
    satisfactionKey,
    undoableKey,
    displayMode,
    itemIdsKey,
    resetKey,
    initializing,
    showTended,
    itemIdsKey,
    satisfactionKey,
    undoableKey,
    rhythmIds
  ]);

  useLayoutEffect(() => {
    const rhythmId = pendingUndoFocusId.current;
    if (!rhythmId || tendedRhythmIds.has(rhythmId)) return;
    const button = [...document.querySelectorAll<HTMLButtonElement>('[data-rhythm-tend-button]')]
      .find(candidate => candidate.dataset.rhythmTendButton === rhythmId);
    button?.focus({ preventScroll: true });
    pendingUndoFocusId.current = null;
  }, [tendedKey, tendedRhythmIds]);

  useEffect(() => () => clearTimers(), []);

  function itemProps(rhythmId: string) {
    return {
      className: `show-tended-list__item${fadingIds.has(rhythmId) ? ' is-fading' : ''}${collapsingIds.has(rhythmId) ? ' is-collapsing' : ''}`,
      'data-tended-rhythm-item': rhythmId,
      inert: collapsingIds.has(rhythmId),
      onFocusCapture: () => {
        lastFocusedRhythmId.current = rhythmId;
        focusedRhythmId.current = rhythmId;
      },
      onBlurCapture: (event: FocusEvent<HTMLDivElement>) => {
        const nextFocused = event.relatedTarget;
        if (nextFocused && !event.currentTarget.contains(nextFocused as Node)
          && focusedRhythmId.current === rhythmId) {
          focusedRhythmId.current = null;
        }
      }
    };
  }

  const toggle = hasToggle ? (
    <button
      ref={toggleRef}
      type="button"
      className={`show-tended-list__toggle${showProgress ? ' show-tended-list__toggle--text' : ' btn mini ghost'}`}
      aria-pressed={showTended}
      onClick={() => onShowTendedChange(!showTended)}
    >
      {showTended ? 'Hide tended' : 'Show tended'}{showProgress ? '' : ` (${tendedCount})`}
    </button>
  ) : null;

  const controls = (showProgress || hasToggle || notices.length > 0) ? (
    <div className={`show-tended-list__controls${showProgress ? ' show-tended-list__controls--progress' : ''}`}>
      {showProgress ? (
        <div className="show-tended-list__progress-row">
          {progressDisclosure && hasToggle ? (
            <button
              type="button"
              className="show-tended-list__disclosure"
              aria-label={`${showTended ? 'Hide' : 'Show'} tended Rhythms, ${tendedCount} of ${rhythms.length} tended`}
              aria-expanded={showTended}
              onClick={() => onShowTendedChange(!showTended)}
            >
              <span className="show-tended-list__progress show-tended-list__disclosure-content" aria-live="polite">
                <svg className="show-tended-list__progress-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <circle cx="8" cy="8" r="6.25" />
                  <path d="m4.8 8.1 2.1 2.1 4.3-4.4" />
                </svg>
                <span>{tendedCount} of {rhythms.length} tended</span>
                <svg className="show-tended-list__disclosure-chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <path d={showTended ? 'm3 10 5-5 5 5' : 'm3 6 5 5 5-5'} />
                </svg>
              </span>
            </button>
          ) : (
            <>
              <span className="show-tended-list__progress" aria-live="polite">
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <circle cx="8" cy="8" r="6.25" />
                  <path d="m4.8 8.1 2.1 2.1 4.3-4.4" />
                </svg>
                {tendedCount} of {rhythms.length} tended
              </span>
              {toggle}
            </>
          )}
        </div>
      ) : toggle}
      {notices.map(notice => (
        <div className="show-tended-list__notice" key={notice.key} role="status" aria-live="polite" aria-atomic="true">
          <span className="visually-hidden">
            Tended {notice.title}. {showTended
              ? 'The completed Rhythm remains visible.'
              : displayMode === 'done-rows'
                ? 'It collapsed to a compact row in its original position.'
                : 'It will be removed from the active list shortly.'}
          </span>
          <span aria-hidden="true">Tended{notice.undoable ? ' · ' : ''}</span>
          {notice.undoable && (
            <button
              type="button"
              className="show-tended-list__undo"
              aria-label={`Undo tending ${notice.title}`}
              onClick={() => {
                undoTendedRhythm(notice.rhythmId);
              }}
            >
              Undo
            </button>
          )}
        </div>
      ))}
    </div>
  ) : null;

  return renderControls ? (
    <>
      {controls}
      {children({
        visibleRhythmIds,
        tendedRhythmIds,
        tendedDisplayItems,
        expandedTendedRhythmIds,
        onToggleTendedRhythm: toggleTendedRhythm,
        onUndoTendedRhythm: undoTendedRhythm,
        controls,
        itemProps
      })}
    </>
  ) : children({
    visibleRhythmIds,
    tendedRhythmIds,
    tendedDisplayItems,
    expandedTendedRhythmIds,
    onToggleTendedRhythm: toggleTendedRhythm,
    onUndoTendedRhythm: undoTendedRhythm,
    controls,
    itemProps
  });
}
