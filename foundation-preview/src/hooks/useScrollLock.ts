import { useLayoutEffect } from 'react';

type LockedBodyState = {
  body: HTMLBodyElement;
  scrollY: number;
  styles: Map<string, { value: string; priority: string }>;
};

const lockedProperties = ['position', 'top', 'width', 'overflow', 'padding-right'];
let lockCount = 0;
let lockedBodyState: LockedBodyState | null = null;

function lockBodyScroll() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const body = document.querySelector<HTMLBodyElement>('body');
  if (!body) return;

  lockCount += 1;
  if (lockCount > 1) return;

  const styles = new Map(lockedProperties.map(property => [
    property,
    {
      value: body.style.getPropertyValue(property),
      priority: body.style.getPropertyPriority(property)
    }
  ]));
  const scrollY = window.scrollY;
  const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
  const currentPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;

  lockedBodyState = { body, scrollY, styles };
  body.style.position = 'fixed';
  body.style.top = `-${scrollY}px`;
  body.style.width = '100%';
  body.style.overflow = 'hidden';
  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
  }
}

function unlockBodyScroll() {
  if (lockCount === 0) return;
  lockCount -= 1;
  if (lockCount > 0 || !lockedBodyState) return;

  const { body, scrollY, styles } = lockedBodyState;
  lockedBodyState = null;
  for (const [property, { value, priority }] of styles) {
    if (value) body.style.setProperty(property, value, priority);
    else body.style.removeProperty(property);
  }
  if (scrollY !== 0) window.scrollTo(0, scrollY);
}

export function useScrollLock(locked: boolean) {
  useLayoutEffect(() => {
    if (!locked) return;
    lockBodyScroll();
    return unlockBodyScroll;
  }, [locked]);
}
