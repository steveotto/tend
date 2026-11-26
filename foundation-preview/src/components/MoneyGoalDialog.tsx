import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { RefObject } from 'react';
import { calculateAnchoredPopoverPosition } from './AnchoredPopover.tsx';
import { useScrollLock } from '../hooks/useScrollLock.ts';

type MoneyGoalDialogProps = {
  eyebrow?: string;
  title?: string;
  titleLeadingAction?: ReactNode;
  intro?: string;
  children: ReactNode;
  closeLabel?: string;
  closeButtonId?: string;
  labelledBy?: string;
  titleId?: string;
  initialFocusId?: string;
  stopEscapePropagation?: boolean;
  closeOnEscape?: boolean;
  portalToBody?: boolean;
  dialogId?: string;
  dismissOnBackdrop?: boolean;
  dialogClassName?: string;
  phoneFullScreen?: boolean;
  scrollableBody?: boolean;
  inert?: boolean;
  surfaceClassName?: string;
  bodyClassName?: string;
  anchorRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
};

export function MoneyGoalDialog({
  eyebrow,
  title,
  titleLeadingAction,
  intro,
  children,
  closeLabel,
  closeButtonId,
  labelledBy,
  titleId,
  initialFocusId,
  stopEscapePropagation = false,
  closeOnEscape = false,
  portalToBody = false,
  dialogId,
  dismissOnBackdrop = false,
  dialogClassName,
  phoneFullScreen = false,
  scrollableBody = false,
  inert = false,
  surfaceClassName,
  bodyClassName,
  anchorRef,
  onClose
}: MoneyGoalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useScrollLock(true);

  useLayoutEffect(() => {
    const dialogElement = dialogRef.current;
    if (!dialogElement) return;
    const activeDialog: HTMLDialogElement = dialogElement;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      && document.activeElement !== document.body
      ? document.activeElement
      : null;
    if (typeof activeDialog.showModal === 'function') activeDialog.showModal();
    else activeDialog.setAttribute('open', '');
    const findById = (id: string | undefined) => id
      ? [...activeDialog.querySelectorAll<HTMLElement>('[id]')].find(element => element.id === id) ?? null
      : null;
    const requestedTarget = findById(initialFocusId);
    const safeRequestedTarget = requestedTarget
      && !requestedTarget.matches('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
      && !requestedTarget.matches(':disabled')
      ? requestedTarget
      : null;
    const initialTarget = safeRequestedTarget
      ?? findById(labelledBy)
      ?? activeDialog.querySelector<HTMLElement>('h1, h2, h3, [role="heading"]')
      ?? activeDialog;
    const restoreTabIndex = initialTarget !== activeDialog
      && initialTarget.getAttribute('tabindex') === null;
    if (restoreTabIndex) initialTarget.setAttribute('tabindex', '-1');
    initialTarget.focus({ preventScroll: true });

    const anchorReference = anchorRef;
    function closeAndRestoreFocus() {
      if (activeDialog.open && typeof activeDialog.close === 'function') activeDialog.close();
      else activeDialog.removeAttribute('open');
      if (restoreTabIndex) initialTarget.removeAttribute('tabindex');
      if (!previouslyFocused) return;
      window.requestAnimationFrame(() => {
        const containingDialog = previouslyFocused.closest('dialog');
        const competingDialogOpen = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')]
          .some(dialog => dialog !== containingDialog && !dialog.contains(previouslyFocused));
        if (competingDialogOpen
          || (document.activeElement !== document.body && document.activeElement !== previouslyFocused)) return;
        if (previouslyFocused.isConnected
          && !previouslyFocused.matches(':disabled')
          && !previouslyFocused.closest('[inert], [hidden]')
          && !(containingDialog instanceof HTMLDialogElement && !containingDialog.open)) {
          previouslyFocused.focus({ preventScroll: true });
        }
      });
    }

    if (!anchorReference) {
      return closeAndRestoreFocus;
    }
    const activeAnchorReference: RefObject<HTMLElement | null> = anchorReference;

    function syncPosition() {
      const anchor = activeAnchorReference.current;
      if (!anchor) return;
      const visibleViewport = window.visualViewport;
      const viewport = {
        left: visibleViewport?.offsetLeft ?? 0,
        top: visibleViewport?.offsetTop ?? 0,
        width: visibleViewport?.width || window.innerWidth || document.documentElement.clientWidth,
        height: visibleViewport?.height || window.innerHeight || document.documentElement.clientHeight
      };
      const panelBounds = activeDialog.getBoundingClientRect();
      const panelHeight = Math.max(panelBounds.height, activeDialog.scrollHeight, 420);
      const constrained = viewport.width <= 700 || viewport.height <= 560;

      function center(fullScreen: boolean) {
        activeDialog.dataset.anchorPlacement = 'center';
        if (fullScreen) activeDialog.dataset.viewportConstrained = 'true';
        else delete activeDialog.dataset.viewportConstrained;
        const width = fullScreen ? viewport.width : Math.min(panelBounds.width || 360, viewport.width - 24);
        const height = fullScreen ? viewport.height : Math.min(panelBounds.height || 420, viewport.height - 24);
        activeDialog.style.position = 'fixed';
        activeDialog.style.inset = 'auto';
        activeDialog.style.left = `${viewport.left + Math.max(0, (viewport.width - width) / 2)}px`;
        activeDialog.style.top = `${viewport.top + Math.max(0, (viewport.height - height) / 2)}px`;
        activeDialog.style.right = 'auto';
        activeDialog.style.bottom = 'auto';
        activeDialog.style.margin = '0';
        activeDialog.style.maxWidth = `${viewport.width}px`;
        activeDialog.style.maxHeight = `${viewport.height}px`;
        if (fullScreen) {
          activeDialog.style.width = `${viewport.width}px`;
          activeDialog.style.height = `${viewport.height}px`;
        } else {
          activeDialog.style.removeProperty('width');
          activeDialog.style.removeProperty('height');
        }
      }

      if (phoneFullScreen && viewport.width <= 700) {
        center(true);
        return;
      }

      if (constrained) {
        center(viewport.height <= 480);
        return;
      }

      activeDialog.style.removeProperty('width');
      activeDialog.style.removeProperty('height');
      const position = calculateAnchoredPopoverPosition(
        anchor.getBoundingClientRect(),
        { ...panelBounds, height: panelHeight },
        viewport
      );
      if (position.maxHeight < Math.min(panelHeight, 360)) {
        center(false);
        return;
      }
      delete activeDialog.dataset.viewportConstrained;
      activeDialog.dataset.anchorPlacement = 'anchored';
      activeDialog.style.position = 'fixed';
      activeDialog.style.inset = 'auto';
      activeDialog.style.left = `${position.left}px`;
      activeDialog.style.top = `${position.top}px`;
      activeDialog.style.right = 'auto';
      activeDialog.style.bottom = 'auto';
      activeDialog.style.margin = '0';
      activeDialog.style.maxWidth = `${position.maxWidth}px`;
      activeDialog.style.maxHeight = `${position.maxHeight}px`;
    }

    syncPosition();
    window.addEventListener('resize', syncPosition);
    window.addEventListener('scroll', syncPosition, true);
    window.visualViewport?.addEventListener('resize', syncPosition);
    window.visualViewport?.addEventListener('scroll', syncPosition);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncPosition);
    observer?.observe(activeDialog);
    observer?.observe(activeAnchorReference.current ?? activeDialog);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', syncPosition);
      window.removeEventListener('scroll', syncPosition, true);
      window.visualViewport?.removeEventListener('resize', syncPosition);
      window.visualViewport?.removeEventListener('scroll', syncPosition);
      closeAndRestoreFocus();
    };
  }, [initialFocusId, labelledBy, anchorRef, phoneFullScreen]);

  const closeControl = closeLabel && (
    <button
      id={closeButtonId}
      type="button"
      className="money-goal-dialog__close"
      aria-label={closeLabel}
      onClick={onClose}
    >
      ×
    </button>
  );
  const titleContent = title && (titleLeadingAction ? (
    <div className="money-goal-dialog__title-row">
      {titleLeadingAction}
      <h2
        id={titleId ?? 'money-goal-dialog-title'}
        tabIndex={-1}
      >
        {title}
      </h2>
    </div>
  ) : (
    <h2
      id={titleId ?? 'money-goal-dialog-title'}
      tabIndex={-1}
    >
      {title}
    </h2>
  ));
  const dialogContent = bodyClassName ? <div className={bodyClassName}>{children}</div> : children;

  const dialog = (
    <dialog
      ref={dialogRef}
      id={dialogId}
      inert={inert}
      tabIndex={-1}
      className={[
        'money-goal-dialog',
        dialogClassName,
        phoneFullScreen ? 'dialog--phone-fullscreen' : '',
        scrollableBody ? 'money-goal-dialog--scrollable-body' : ''
      ].filter(Boolean).join(' ')}
      aria-modal="true"
      aria-labelledby={labelledBy ?? 'money-goal-dialog-title'}
      onCancel={event => {
        event.preventDefault();
        if (stopEscapePropagation) event.stopPropagation();
        onClose();
      }}
      onKeyDown={event => {
        if (event.key === 'Escape' && closeOnEscape) {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        } else if (stopEscapePropagation && event.key === 'Escape') {
          event.stopPropagation();
        }
      }}
      onClick={event => {
        if (dismissOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <div className={['money-goal-dialog__surface', surfaceClassName].filter(Boolean).join(' ')}>
        {scrollableBody ? (
          <>
            <header className="money-goal-dialog__persistent-header">
              <div className="money-goal-dialog__heading">
                {eyebrow && <p className="money-goal-dialog__eyebrow">{eyebrow}</p>}
                {titleContent}
              </div>
              {closeControl}
            </header>
            <div
              className="money-goal-dialog__scroll-region"
              role="region"
              aria-label={title ? `${title} content` : 'Dialog content'}
              tabIndex={0}
              onKeyDown={event => {
                if (event.target !== event.currentTarget) return;
                const region = event.currentTarget;
                const pageStep = Math.max(40, region.clientHeight - 32);
                const maximum = Math.max(0, region.scrollHeight - region.clientHeight);
                const key = event.key;
                if (key === 'ArrowDown') region.scrollTop = Math.min(maximum, region.scrollTop + 40);
                else if (key === 'ArrowUp') region.scrollTop = Math.max(0, region.scrollTop - 40);
                else if (key === 'PageDown') region.scrollTop = Math.min(maximum, region.scrollTop + pageStep);
                else if (key === 'PageUp') region.scrollTop = Math.max(0, region.scrollTop - pageStep);
                else if (key === 'Home') region.scrollTop = 0;
                else if (key === 'End') region.scrollTop = maximum;
                else return;
                event.preventDefault();
              }}
            >
              {intro && <p className="money-goal-dialog__intro">{intro}</p>}
              {dialogContent}
            </div>
          </>
        ) : (
          <>
            {closeControl}
            {eyebrow && <p className="money-goal-dialog__eyebrow">{eyebrow}</p>}
            {titleContent}
            {intro && <p className="money-goal-dialog__intro">{intro}</p>}
            {dialogContent}
          </>
        )}
      </div>
    </dialog>
  );
  return portalToBody ? createPortal(dialog, document.body) : dialog;
}
