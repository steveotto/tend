import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  foundationTerminologyForCategory,
  type FoundationPreview,
  type RhythmPreview
} from '../domain/preview-data.ts';
import { resolveRhythmFoundationLinks } from '../domain/foundation-rhythm-associations.ts';
import { hasFoundationIcon, MarriageIcon } from './MarriageIcon.tsx';

type RhythmFoundationBadgesProps = {
  rhythm: RhythmPreview;
  foundations: readonly FoundationPreview[];
  presentation?: 'interactive' | 'static';
  onOpenFoundation?: (foundationId: string, openerId: string) => void;
};

export function RhythmFoundationBadges({
  rhythm,
  foundations,
  presentation = 'interactive',
  onOpenFoundation
}: RhythmFoundationBadgesProps) {
  const interactive = presentation === 'interactive' && onOpenFoundation !== undefined;
  const { foundations: resolvedFoundations, unresolvedIds } = resolveRhythmFoundationLinks(rhythm, foundations);
  const displayableFoundations = resolvedFoundations.filter(foundation =>
    hasFoundationIcon(foundation.iconId ?? foundation.id)
  );
  const displayableIds = new Set(displayableFoundations.map(foundation => foundation.id));
  const unresolvedCount = unresolvedIds.length
    + resolvedFoundations.filter(foundation => !displayableIds.has(foundation.id)).length;
  const linkTerms = terminologyForLinks(
    resolvedFoundations,
    rhythm.categoryIds ?? []
  );
  const termPlural = linkTerms.plural;
  const visibleCount = displayableFoundations.length >= 4 ? 2 : displayableFoundations.length;
  const visibleFoundations = displayableFoundations.slice(0, visibleCount);
  const overflowFoundations = displayableFoundations.slice(visibleCount);
  const overflowGroups = overflowFoundations.reduce<Array<{
    categoryId: string;
    category: string;
    foundations: FoundationPreview[];
  }>>((groups, foundation) => {
    let group = groups.find(candidate => candidate.categoryId === foundation.categoryId);
    if (!group) {
      group = {
        categoryId: foundation.categoryId,
        category: `${foundation.category} ${foundationTerminologyForCategory(foundation.categoryId).plural}`,
        foundations: []
      };
      groups.push(group);
    }
    group.foundations.push(foundation);
    return groups;
  }, []);
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);

  useEffect(() => {
    if (!isOverflowOpen) return;

    function dismissOutside(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setIsOverflowOpen(false);
    }

    function dismissEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setIsOverflowOpen(false);
      setPopoverStyle(null);
      triggerRef.current?.focus();
    }

    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissEscape);
    };
  }, [isOverflowOpen]);

  useLayoutEffect(() => {
    if (!isOverflowOpen) return;

    function positionPopover() {
      const trigger = triggerRef.current;
      const popover = popoverRef.current;
      if (!trigger || !popover) return;

      const margin = 12;
      const gap = 4;
      const bounds = trigger.getBoundingClientRect();
      const popupBounds = popover.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      const left = Math.max(
        margin,
        Math.min(bounds.left, viewportWidth - popupBounds.width - margin)
      );
      const below = viewportHeight - bounds.bottom - gap - margin;
      const above = bounds.top - gap - margin;
      const placeAbove = below < popupBounds.height && above > below;
      const availableHeight = Math.max(100, placeAbove ? above : below);
      const top = placeAbove
        ? Math.max(margin, bounds.top - gap - Math.min(popupBounds.height, availableHeight))
        : Math.min(bounds.bottom + gap, viewportHeight - margin - Math.min(popupBounds.height, availableHeight));
      setPopoverStyle({
        position: 'fixed',
        top,
        left,
        maxHeight: availableHeight,
        visibility: 'visible'
      });
    }

    positionPopover();
    window.addEventListener('resize', positionPopover);
    window.addEventListener('scroll', positionPopover, true);
    return () => {
      window.removeEventListener('resize', positionPopover);
      window.removeEventListener('scroll', positionPopover, true);
    };
  }, [isOverflowOpen]);

  useLayoutEffect(() => {
    if (isOverflowOpen) {
      popoverRef.current?.querySelector<HTMLButtonElement>('.rhythm-foundation-popover__item')?.focus();
    }
  }, [isOverflowOpen]);

  if (displayableFoundations.length === 0 && unresolvedCount === 0) return null;

  function showPopover(event: MouseEvent<HTMLButtonElement>) {
    triggerRef.current = event.currentTarget;
    setPopoverStyle(null);
    setIsOverflowOpen(open => !open);
  }

  function openFoundation(foundationId: string) {
    const openerId = triggerRef.current?.id;
    setIsOverflowOpen(false);
    if (openerId) onOpenFoundation?.(foundationId, openerId);
  }

  function handlePopoverKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = [...(popoverRef.current?.querySelectorAll<HTMLButtonElement>('.rhythm-foundation-popover__item') ?? [])];
    if (items.length === 0) return;
    const index = items.findIndex(item => item === document.activeElement);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowDown') nextIndex = (index + 1 + items.length) % items.length;
    else if (event.key === 'ArrowUp') nextIndex = (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = items.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    items[nextIndex]?.focus();
  }

  const badges = (
    <>
      {visibleFoundations.map(foundation => {
        const categoryLabel = foundation.categoryId === 'faith'
          ? `${foundation.category} ${foundationTerminologyForCategory(foundation.categoryId).singular}`
          : foundation.category;
        const badgeLabel = `${categoryLabel}: ${foundation.name}`;
        const tooltipLabel = `${categoryLabel} · ${foundation.name}`;
        const visual = (
          <span className="rhythm-foundation-badge__visual" aria-hidden="true">
            <MarriageIcon group="foundations" id={foundation.iconId ?? foundation.id} />
          </span>
        );
        return interactive
          ? (
            <button
              key={foundation.id}
              id={`rhythm-foundation-badge-${rhythm.id}-${foundation.id}`}
              type="button"
              className="rhythm-foundation-badge"
              aria-label={badgeLabel}
              title={badgeLabel}
              data-tooltip={tooltipLabel}
              onClick={event => onOpenFoundation(foundation.id, event.currentTarget.id)}
            >
              {visual}
            </button>
          )
          : (
            <span
              key={foundation.id}
              className="rhythm-foundation-badge"
              role="img"
              aria-label={badgeLabel}
              title={badgeLabel}
            >
              {visual}
            </span>
          );
      })}
      {overflowFoundations.length > 0 && (
        interactive
          ? (
            <button
              id={`rhythm-foundation-badge-${rhythm.id}-overflow`}
              type="button"
              className="rhythm-foundation-badge rhythm-foundation-badge--overflow"
              aria-label={`Open ${overflowFoundations.length} more linked ${termPlural}`}
              aria-haspopup="dialog"
              aria-expanded={isOverflowOpen}
              title={`${overflowFoundations.length} more ${termPlural}`}
              data-tooltip={`${overflowFoundations.length} more ${termPlural}`}
              onClick={showPopover}
            >
              <span className="rhythm-foundation-badge__visual" aria-hidden="true">+{overflowFoundations.length}</span>
            </button>
          )
          : (
            <span
              className="rhythm-foundation-badge rhythm-foundation-badge--overflow"
              role="img"
              aria-label={`${overflowFoundations.length} more linked ${termPlural}`}
              title={`${overflowFoundations.length} more ${termPlural}`}
            >
              <span className="rhythm-foundation-badge__visual" aria-hidden="true">+{overflowFoundations.length}</span>
            </span>
          )
      )}
      {unresolvedCount > 0 && (
        <span className="visually-hidden">
          {unresolvedCount} linked {unresolvedCount === 1 ? linkTerms.singular : termPlural} could not be resolved.
        </span>
      )}
    </>
  );
  const associationBadges = interactive
    ? (
      <div
        className="rhythm-foundation-badges"
        role="group"
        aria-label={`${termPlural} linked to ${rhythm.title}`}
        data-unresolved-foundation-count={unresolvedCount || undefined}
      >
        {badges}
      </div>
    )
    : (
      <span
        className="rhythm-foundation-badges"
        role="group"
        aria-label={`${termPlural} linked to ${rhythm.title}`}
        data-unresolved-foundation-count={unresolvedCount || undefined}
      >
        {badges}
      </span>
    );

  return (
    <>
      {associationBadges}
      {interactive && isOverflowOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          className="rhythm-foundation-popover"
          role="dialog"
          aria-label={`${overflowFoundations.length} more linked ${termPlural}`}
          style={{ ...popoverStyle, visibility: popoverStyle ? 'visible' : 'hidden' }}
          onKeyDown={handlePopoverKeyDown}
        >
          {overflowGroups.map(group => (
            <section className="rhythm-foundation-popover__group" key={group.category}>
              <h3 className="rhythm-foundation-popover__heading">
                {group.category}
              </h3>
              <ul>
                {group.foundations.map(foundation => (
                  <li key={foundation.id}>
                    <button
                      type="button"
                      className="rhythm-foundation-popover__item"
                      aria-label={foundation.categoryId === 'faith'
                        ? `${foundation.category} Practice: ${foundation.name}`
                        : `${foundation.category}: ${foundation.name}`}
                      onClick={() => openFoundation(foundation.id)}
                    >
                      <span className="rhythm-foundation-popover__icon" aria-hidden="true">
                        <MarriageIcon group="foundations" id={foundation.iconId ?? foundation.id} />
                      </span>
                      <span className="rhythm-foundation-popover__name">{foundation.name}</span>
                      <span className="rhythm-foundation-popover__chevron" aria-hidden="true">›</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

function terminologyForLinks(
  foundations: readonly FoundationPreview[],
  categoryIds: readonly string[]
): { singular: string; plural: string } {
  const categories = foundations.length > 0
    ? foundations.map(foundation => foundation.categoryId)
    : categoryIds;
  const terms = [...new Map(categories.map(categoryId => {
    const term = foundationTerminologyForCategory(categoryId);
    return [term.singular, term] as const;
  })).values()];
  if (terms.length === 1) return terms[0]!;
  if (terms.some(term => term.singular === 'Practice')) {
    return { singular: 'Practice and Foundation', plural: 'Practices and Foundations' };
  }
  return foundationTerminologyForCategory();
}
