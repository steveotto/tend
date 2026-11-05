import { useLayoutEffect, useRef, useState } from 'react';
import type { RefObject, ReactNode, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  anchorRef: RefObject<HTMLElement | null>;
  id?: string;
  label: string;
  role?: 'dialog' | 'menu';
  className: string;
  mobileSheet?: boolean;
  initialFocusSelector?: string;
  children: ReactNode;
  onClose: () => void;
};

type Bounds = Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>;
type ViewportBounds = { left: number; top: number; width: number; height: number };
type PopoverPosition = { top: number; left: number; maxHeight: number; maxWidth: number };

export function calculateAnchoredPopoverPosition(
  anchor: Bounds,
  panel: Bounds,
  viewport: ViewportBounds,
  margin = 12,
  gap = 6,
  mobileSheet = false
): PopoverPosition {
  if (mobileSheet && viewport.width <= 700) {
    const maxHeight = Math.max(0, viewport.height - margin);
    const visibleHeight = Math.min(panel.height || 240, maxHeight);
    return {
      top: viewport.top + viewport.height - visibleHeight,
      left: viewport.left,
      maxHeight,
      maxWidth: viewport.width
    };
  }

  const maxWidth = Math.max(0, viewport.width - margin * 2);
  const panelWidth = Math.min(panel.width || 280, maxWidth);
  const left = Math.max(
    viewport.left + margin,
    Math.min(anchor.left, viewport.left + viewport.width - panelWidth - margin)
  );
  const viewportBottom = viewport.top + viewport.height;
  const below = Math.max(0, viewportBottom - anchor.bottom - gap - margin);
  const above = Math.max(0, anchor.top - viewport.top - gap - margin);
  const panelHeight = panel.height || 240;
  const placeAbove = below < panelHeight && above > below;
  const availableHeight = Math.min(
    Math.max(0, viewport.height - margin * 2),
    placeAbove ? above : below
  );
  const visibleHeight = Math.min(panelHeight, availableHeight);
  const desiredTop = placeAbove
    ? anchor.top - gap - visibleHeight
    : anchor.bottom + gap;
  const maxTop = Math.max(
    viewport.top + margin,
    viewportBottom - margin - visibleHeight
  );
  const top = Math.min(Math.max(viewport.top + margin, desiredTop), maxTop);
  return { top, left, maxHeight: availableHeight, maxWidth };
}

export function AnchoredPopover({
  anchorRef,
  id,
  label,
  role = 'dialog',
  className,
  mobileSheet = false,
  initialFocusSelector,
  children,
  onClose
}: Props) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  useLayoutEffect(() => {
    function position() {
      const anchor = anchorRef.current;
      const popover = popoverRef.current;
      if (!anchor || !popover) return;
      const bounds = anchor.getBoundingClientRect();
      const panelBounds = popover.getBoundingClientRect();
      const panel = {
        ...panelBounds,
        height: Math.max(panelBounds.height, popover.scrollHeight)
      };
      const visibleViewport = window.visualViewport;
      const next = calculateAnchoredPopoverPosition(
        bounds,
        panel,
        {
          left: visibleViewport?.offsetLeft ?? 0,
          top: visibleViewport?.offsetTop ?? 0,
          width: visibleViewport?.width ?? document.documentElement.clientWidth,
          height: visibleViewport?.height ?? document.documentElement.clientHeight
        },
        12,
        6,
        mobileSheet
      );
      setPosition(previous => previous
        && previous.top === next.top
        && previous.left === next.left
        && previous.maxHeight === next.maxHeight
        && previous.maxWidth === next.maxWidth
        ? previous
        : next);
    }

    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    window.visualViewport?.addEventListener('resize', position);
    window.visualViewport?.addEventListener('scroll', position);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(position);
    if (anchorRef.current) observer?.observe(anchorRef.current);
    if (popoverRef.current) observer?.observe(popoverRef.current);
    const mutations = typeof MutationObserver === 'undefined' ? null : new MutationObserver(position);
    if (popoverRef.current) {
      mutations?.observe(popoverRef.current, { childList: true, characterData: true, subtree: true });
    }
    const firstFocusable = initialFocusSelector
      ? popoverRef.current?.querySelector<HTMLElement>(initialFocusSelector)
      : null;
    (firstFocusable ?? popoverRef.current?.querySelector<HTMLElement>(
      role === 'menu' ? '[role="menuitem"]' : 'button, input, select, textarea'
    ))?.focus({ preventScroll: true });

    return () => {
      observer?.disconnect();
      mutations?.disconnect();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      window.visualViewport?.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('scroll', position);
      anchorRef.current?.focus({ preventScroll: true });
    };
  }, [anchorRef, mobileSheet, role]);

  useLayoutEffect(() => {
    function dismissOutside(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)
        || popoverRef.current?.contains(target)
        || anchorRef.current?.contains(target)) return;
      onCloseRef.current();
    }
    document.addEventListener('pointerdown', dismissOutside, true);
    return () => document.removeEventListener('pointerdown', dismissOutside, true);
  }, [anchorRef]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (role !== 'menu') return;
    const items = [...(popoverRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [])];
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? items.length - 1
        : step ? (current + step + items.length) % items.length : -1;
    if (next >= 0) {
      event.preventDefault();
      items[next]?.focus();
    }
  }

  if (typeof document === 'undefined') return null;
  const portalTarget = anchorRef.current?.closest('dialog') ?? document.body;
  return createPortal(
    <div
      ref={popoverRef}
      className={className}
      id={id}
      role={role}
      aria-label={label}
      data-mobile-sheet={mobileSheet || undefined}
      style={{
        boxSizing: 'border-box',
        position: 'fixed',
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        maxHeight: position?.maxHeight ?? 0,
        maxWidth: position?.maxWidth ?? 0,
        visibility: position ? 'visible' : 'hidden'
      }}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>,
    portalTarget
  );
}
