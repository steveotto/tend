import { useLayoutEffect, useRef, useState } from 'react';
import type { RefObject, ReactNode, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  anchorRef: RefObject<HTMLElement | null>;
  label: string;
  role?: 'dialog' | 'menu';
  className: string;
  children: ReactNode;
  onClose: () => void;
};

export function AnchoredPopover({
  anchorRef,
  label,
  role = 'dialog',
  className,
  children,
  onClose
}: Props) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [position, setPosition] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    function position() {
      const anchor = anchorRef.current;
      const popover = popoverRef.current;
      if (!anchor || !popover) return;
      const bounds = anchor.getBoundingClientRect();
      const panel = popover.getBoundingClientRect();
      const margin = 12;
      const gap = 6;
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      const width = panel.width || 280;
      const height = panel.height || 240;
      const left = Math.max(margin, Math.min(bounds.left, viewportWidth - width - margin));
      const below = Math.max(0, viewportHeight - bounds.bottom - gap - margin);
      const above = Math.max(0, bounds.top - gap - margin);
      const placeAbove = below < height && above > below;
      const availableHeight = placeAbove ? above : below;
      const visibleHeight = Math.min(height, availableHeight);
      const top = placeAbove
        ? Math.max(margin, bounds.top - gap - visibleHeight)
        : bounds.bottom + gap;
      setPosition({ top, left, maxHeight: availableHeight });
    }

    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    window.visualViewport?.addEventListener('resize', position);
    window.visualViewport?.addEventListener('scroll', position);
    popoverRef.current?.querySelector<HTMLElement>(
      role === 'menu' ? '[role="menuitem"]' : 'button, input, select, textarea'
    )?.focus({ preventScroll: true });

    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      window.visualViewport?.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('scroll', position);
      anchorRef.current?.focus({ preventScroll: true });
    };
  }, [anchorRef, role]);

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
      role={role}
      aria-label={label}
      style={{
        position: 'fixed',
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        maxHeight: position?.maxHeight ?? 0,
        visibility: position ? 'visible' : 'hidden'
      }}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>,
    portalTarget
  );
}
