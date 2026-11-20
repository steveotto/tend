import { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScrollLock } from '../src/hooks/useScrollLock.ts';
import { MoneyGoalDialog } from '../src/components/MoneyGoalDialog.tsx';

function Lock({ locked }: { locked: boolean }) {
  useScrollLock(locked);
  return null;
}

function NestedLocks() {
  const [firstLocked, setFirstLocked] = useState(true);
  const [secondLocked, setSecondLocked] = useState(true);
  return (
    <>
      <Lock locked={firstLocked} />
      <Lock locked={secondLocked} />
      <button onClick={() => setFirstLocked(false)}>Close first</button>
      <button onClick={() => setSecondLocked(false)}>Close second</button>
    </>
  );
}

function NestedDialogs() {
  const [parentOpen, setParentOpen] = useState(false);
  const [childOpen, setChildOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setParentOpen(true)}>Open parent</button>
      {parentOpen && (
        <MoneyGoalDialog
          title="Parent dialog"
          labelledBy="parent-dialog-heading"
          titleId="parent-dialog-heading"
          initialFocusId="date-field"
          onClose={() => setParentOpen(false)}
          closeLabel="Close parent"
          inert={childOpen}
        >
          <input id="date-field" type="date" />
          <button type="button" onClick={() => setChildOpen(true)}>Open child</button>
          <button type="button" onClick={() => setParentOpen(false)}>Save parent</button>
          {childOpen && (
            <MoneyGoalDialog
              title="Child dialog"
              labelledBy="child-dialog-heading"
              titleId="child-dialog-heading"
              onClose={() => setChildOpen(false)}
              closeLabel="Close child"
              portalToBody
            >
              <button type="button" onClick={() => setChildOpen(false)}>Close child content</button>
            </MoneyGoalDialog>
          )}
        </MoneyGoalDialog>
      )}
    </>
  );
}

describe('useScrollLock', () => {
  let originalScrollY: PropertyDescriptor | undefined;
  let originalInnerWidth: PropertyDescriptor | undefined;
  let originalClientWidth: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');
    originalInnerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    originalClientWidth = Object.getOwnPropertyDescriptor(document.documentElement, 'clientWidth');
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  afterEach(() => {
    document.body.removeAttribute('style');
    if (originalScrollY) Object.defineProperty(window, 'scrollY', originalScrollY);
    if (originalInnerWidth) Object.defineProperty(window, 'innerWidth', originalInnerWidth);
    if (originalClientWidth) Object.defineProperty(document.documentElement, 'clientWidth', originalClientWidth);
    vi.restoreAllMocks();
  });

  it('fixes the body and restores its styles and scroll position after close', () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 120 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 1000 });
    const scrollTo = vi.mocked(window.scrollTo);
    document.body.style.cssText = 'position:relative; top:3px; width:90%; overflow:auto; padding-right:7px';

    const { rerender } = render(<Lock locked />);

    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-120px');
    expect(document.body.style.width).toBe('100%');
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.paddingRight).toBe('31px');

    rerender(<Lock locked={false} />);

    expect(document.body.style.cssText).toBe(
      'position: relative; top: 3px; width: 90%; overflow: auto; padding-right: 7px;'
    );
    expect(scrollTo).toHaveBeenCalledWith(0, 120);
  });

  it('keeps scrolling locked until the last nested modal closes', () => {
    render(<NestedLocks />);
    expect(document.body.style.position).toBe('fixed');

    act(() => screen.getByRole('button', { name: 'Close first' }).click());
    expect(document.body.style.position).toBe('fixed');

    act(() => screen.getByRole('button', { name: 'Close second' }).click());
    expect(document.body.style.position).toBe('');
  });

  it('restores scrolling when a locked modal unmounts', () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 75 });
    const { unmount } = render(<Lock locked />);
    expect(document.body.style.position).toBe('fixed');

    unmount();

    expect(document.body.style.position).toBe('');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 75);
  });

  it('focuses a dialog heading instead of a date field and preserves nested locks and focus', () => {
    const queuedFrames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      queuedFrames.push(callback);
      return queuedFrames.length;
    });
    const flushFrames = () => act(() => {
      for (const callback of queuedFrames.splice(0)) callback(0);
    });
    render(<NestedDialogs />);
    const opener = screen.getByRole('button', { name: 'Open parent' });
    opener.focus();
    fireEvent.click(opener);
    const parent = screen.getByRole('dialog', { name: 'Parent dialog' });
    const parentHeading = screen.getByRole('heading', { name: 'Parent dialog' });
    expect(document.activeElement).toBe(parentHeading);
    expect(document.activeElement).not.toBe(parent.querySelector('#date-field'));
    expect(document.body.style.position).toBe('fixed');

    const childOpener = within(parent).getByRole('button', { name: 'Open child' });
    childOpener.focus();
    fireEvent.click(childOpener);
    expect(screen.getByRole('heading', { name: 'Child dialog' })).toBe(document.activeElement);
    fireEvent.click(screen.getByRole('button', { name: 'Close child content' }));
    expect(document.body.style.position).toBe('fixed');
    flushFrames();
    expect(document.activeElement).toBe(childOpener);

    fireEvent.click(within(parent).getByRole('button', { name: 'Save parent' }));
    expect(document.body.style.position).toBe('');
    flushFrames();
    expect(document.activeElement).toBe(opener);
  });
});
