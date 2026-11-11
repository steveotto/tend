import { createPortal } from 'react-dom';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import {
  areas,
  foundationCatalogue,
  foundationTerminologyForCategory,
  type FoundationPreview,
  type RhythmPreview
} from '../domain/preview-data.ts';
import { foundationRhythmIds } from '../domain/foundation-rhythm-associations.ts';
import type { RhythmCategoryId } from '../domain/rhythm-editor.ts';
import type { Destination } from './AppNavigation.tsx';
import { AreaIcon } from './AreaIcon.tsx';

type RhythmCategoryBadgesProps = {
  rhythm: RhythmPreview;
  itemsOnly?: boolean;
  presentation?: 'interactive' | 'static' | 'edit-labeled';
  foundations?: readonly FoundationPreview[];
  onOpenCategory?: (categoryId: Destination, openerId: string) => void;
};

type CategoryBadgeProps = {
  rhythmId: string;
  categoryId: RhythmCategoryId;
  tooltipLabel: string;
  accessibleLabel: string;
  presentation: 'interactive' | 'static' | 'edit-labeled';
  label: string;
  onOpenCategory?: RhythmCategoryBadgesProps['onOpenCategory'];
};

function CategoryBadge({
  rhythmId,
  categoryId,
  tooltipLabel,
  accessibleLabel,
  label,
  presentation,
  onOpenCategory
}: CategoryBadgeProps) {
  const tooltipId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!tooltipOpen) {
      setTooltipPosition(null);
      return;
    }

    const positionTooltip = () => {
      const button = buttonRef.current;
      const tooltip = tooltipRef.current;
      if (!button || !tooltip) return;
      const buttonRect = button.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
      const horizontalInset = 8;
      const left = Math.max(
        horizontalInset,
        Math.min(
          buttonRect.left + (buttonRect.width - tooltipRect.width) / 2,
          viewportWidth - tooltipRect.width - horizontalInset
        )
      );
      const above = buttonRect.top - tooltipRect.height - 8;
      const top = above >= horizontalInset
        ? above
        : Math.min(buttonRect.bottom + 8, viewportHeight - tooltipRect.height - horizontalInset);
      setTooltipPosition({ left, top });
    };

    positionTooltip();
    window.addEventListener('resize', positionTooltip);
    window.addEventListener('scroll', positionTooltip, true);
    return () => {
      window.removeEventListener('resize', positionTooltip);
      window.removeEventListener('scroll', positionTooltip, true);
    };
  }, [tooltipOpen, tooltipLabel]);

  function dismissOnEscape(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'Escape' || !tooltipOpen) return;
    event.preventDefault();
    event.stopPropagation();
    setTooltipOpen(false);
  }

  function openCategory(event: MouseEvent<HTMLButtonElement>) {
    onOpenCategory?.(categoryId, event.currentTarget.id);
  }

  const visual = (
    <span className="rhythm-area-badge__visual" aria-hidden="true">
      <AreaIcon id={categoryId} />
    </span>
  );
  const badgeLabel = presentation === 'edit-labeled'
    ? <span className="rhythm-association-badge__name">{label}</span>
    : null;

  if (presentation === 'static' || !onOpenCategory) {
    return (
      <span
        className="rhythm-area-badge"
        role="img"
        aria-label={accessibleLabel}
        title={accessibleLabel}
      >
        {visual}
        {badgeLabel}
      </span>
    );
  }

  return (
    <>
      <button
        ref={buttonRef}
        id={`rhythm-category-badge-${rhythmId}-${categoryId}`}
        type="button"
        className="rhythm-area-badge"
        aria-label={accessibleLabel}
        aria-describedby={tooltipOpen ? tooltipId : undefined}
        data-category-id={categoryId}
        data-tooltip={tooltipLabel}
        onFocus={() => setTooltipOpen(true)}
        onBlur={() => setTooltipOpen(false)}
        onMouseEnter={() => setTooltipOpen(true)}
        onMouseLeave={() => {
          if (document.activeElement !== buttonRef.current) setTooltipOpen(false);
        }}
        onKeyDown={dismissOnEscape}
        onClick={openCategory}
      >
        {visual}
        {badgeLabel}
      </button>
      {tooltipOpen && typeof document !== 'undefined' && createPortal(
        <span
          ref={tooltipRef}
          id={tooltipId}
          className="rhythm-area-tooltip"
          role="tooltip"
          style={{
            ...(tooltipPosition ?? {}),
            visibility: tooltipPosition ? 'visible' : 'hidden'
          }}
        >
          {tooltipLabel}
        </span>,
        buttonRef.current?.closest('dialog') ?? document.body
      )}
    </>
  );
}

export function RhythmCategoryBadges({
  rhythm,
  itemsOnly = false,
  presentation = 'interactive',
  foundations = foundationCatalogue,
  onOpenCategory
}: RhythmCategoryBadgesProps) {
  const categoryIds = rhythm.categoryIds?.length
    ? rhythm.categoryIds
    : foundationRhythmIds(rhythm)
        .map(id => foundations.find(foundation => foundation.id === id)?.categoryId)
        .filter((id): id is RhythmCategoryId => Boolean(id));
  const categories = areas.filter(area => categoryIds.includes(area.id as RhythmCategoryId));
  const linkedFoundationIds = foundationRhythmIds(rhythm);

  if (categories.length === 0) return null;

  const badges = categories.map(category => {
    const linkedFoundations = foundations.filter(foundation =>
      linkedFoundationIds.includes(foundation.id)
      && foundation.categoryId === category.id
    );
    const linkedNames = linkedFoundations.map(foundation => foundation.name);
    const tooltipLabel = linkedNames.length > 0
      ? `${category.label} · ${foundationTerminologyForCategory(category.id).plural}: ${linkedNames.join(', ')}`
      : category.label;
    const accessibleLabel = presentation === 'interactive' && onOpenCategory && linkedNames.length > 0
      ? `${category.label} category and linked ${foundationTerminologyForCategory(category.id).plural}: ${linkedNames.join(', ')}`
      : category.label;

    return (
      <CategoryBadge
        key={category.id}
        rhythmId={rhythm.id}
        categoryId={category.id as RhythmCategoryId}
        tooltipLabel={tooltipLabel}
        accessibleLabel={accessibleLabel}
        label={category.label}
        presentation={presentation}
        onOpenCategory={onOpenCategory}
      />
    );
  });
  if (itemsOnly) return <>{badges}</>;
  return (
    <div className="today-rhythm-details__categories" role="group" aria-label="Associated categories">
      {badges}
    </div>
  );
}
