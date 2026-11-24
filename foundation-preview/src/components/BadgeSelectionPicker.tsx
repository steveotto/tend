import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type IdentifiedItem = { id: string };

export type BadgeSelectionDetailOption = {
  id: string;
  label: string;
  content: ReactNode;
  selected: boolean;
};

export type BadgeSelectionNavigation<Item> = {
  getSummary: (item: Item) => readonly string[];
  hasValidSelection: (item: Item) => boolean;
  getDetail: (item: Item) => {
    description: ReactNode;
    optionsLabel: string;
    options: readonly BadgeSelectionDetailOption[];
  };
};

export type BadgeSelectionGroup<Id extends string = string> = {
  id: string;
  label: string;
  memberIds: readonly Id[];
};

export function toggleBadgeGroup<Id extends string>(
  selectedIds: readonly Id[],
  groupIds: readonly Id[]
): Id[] {
  const groupIdSet = new Set(groupIds);
  const allSelected = groupIds.length > 0 && groupIds.every(id => selectedIds.includes(id));
  return allSelected
    ? selectedIds.filter(id => !groupIdSet.has(id))
    : [...selectedIds, ...groupIds.filter(id => !selectedIds.includes(id))];
}

export function BadgeSelectionPicker<Item extends IdentifiedItem>({
  title,
  items,
  selectedIds,
  getLabel,
  renderBadge,
  emptyMessage = 'No options are available.',
  groups,
  groupBy,
  unavailableSelectedItems = [],
  unavailableItemType = 'Foundation',
  unavailableGroupLabel,
  getUnavailableItemLabel,
  fixedSelectedIds = [],
  focusItemId,
  description,
  renderSelectedItemContent,
  navigation,
  onToggle,
  onToggleGroup,
  doneLabel = 'Done',
  onDone,
  onCancel
}: {
  title: string;
  items: readonly Item[];
  selectedIds: readonly string[];
  getLabel: (item: Item) => string;
  renderBadge: (item: Item) => ReactNode;
  emptyMessage?: string;
  groups?: readonly BadgeSelectionGroup<Item['id']>[];
  groupBy?: (item: Item) => string | undefined;
  unavailableSelectedItems?: readonly { id: string; label: string }[];
  unavailableItemType?: string;
  unavailableGroupLabel?: string;
  getUnavailableItemLabel?: (item: { id: string; label: string }) => string;
  fixedSelectedIds?: readonly string[];
  focusItemId?: string | null;
  description?: ReactNode;
  renderSelectedItemContent?: (item: Item) => ReactNode;
  navigation?: BadgeSelectionNavigation<Item>;
  onToggle: (id: Item['id']) => void;
  onToggleGroup?: (ids: readonly Item['id'][]) => void;
  doneLabel?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const categoryButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const returnFocusId = useRef<string | null>(null);
  const focusedItemId = useRef<string | null>(null);
  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const hasNavigation = Boolean(navigation);

  useEffect(() => {
    if (focusItemId && focusItemId !== focusedItemId.current) {
      focusedItemId.current = focusItemId;
      setDetailItemId(null);
      Array.from(document.querySelectorAll<HTMLButtonElement>('[data-picker-category-id], [data-picker-item-id]'))
        .find(button =>
          button.dataset.pickerCategoryId === focusItemId
          || button.dataset.pickerItemId === focusItemId
        )
        ?.focus();
      return;
    }
    if (!focusItemId) focusedItemId.current = null;
    if (navigation && detailItemId) {
      detailHeadingRef.current?.focus();
    } else if (returnFocusId.current) {
      categoryButtonRefs.current.get(returnFocusId.current)?.focus();
      returnFocusId.current = null;
    } else {
      headingRef.current?.focus();
    }
  }, [detailItemId, focusItemId, hasNavigation]);

  const availableIds = new Set(items.map(item => item.id));
  const detailItem = navigation
    ? items.find(item => item.id === detailItemId)
    : undefined;
  const selectedCategoryCount = navigation
    ? items.filter(item => selectedIds.includes(item.id)).length
    : 0;
  const selectedCategoryCountLabel = `${selectedCategoryCount} ${selectedCategoryCount === 1 ? 'category' : 'categories'} selected`;

  if (navigation && detailItem) {
    const detail = navigation.getDetail(detailItem);
    const categorySelected = selectedIds.includes(detailItem.id);
    const returnToList = () => {
      returnFocusId.current = detailItem.id;
      setDetailItemId(null);
    };

    return (
      <section
        className="rhythm-association-picker rhythm-association-picker__category-detail"
        aria-labelledby="rhythm-association-picker-title"
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
          }
        }}
      >
        <button
          type="button"
          className="rhythm-association-picker__back"
          onClick={returnToList}
        >
          <span aria-hidden="true">‹</span>
          Categories
        </button>
        <h3 id="rhythm-association-picker-title" ref={detailHeadingRef} tabIndex={-1}>
          {getLabel(detailItem)}
        </h3>
        <p className="rhythm-association-picker__description">{detail.description}</p>
        <button
          type="button"
          className="rhythm-association-picker__category-toggle"
          aria-label={`${categorySelected ? 'Remove' : 'Add'} ${getLabel(detailItem)} category`}
          aria-pressed={categorySelected}
          data-selected={categorySelected ? 'true' : 'false'}
          onClick={() => onToggle(detailItem.id)}
        >
          <span className="rhythm-association-picker__selection-indicator" aria-hidden="true">
            {categorySelected ? '✓' : ''}
          </span>
          <span>{categorySelected ? 'Included in this Rhythm' : 'Include in this Rhythm'}</span>
        </button>
        <div
          className="rhythm-association-picker__detail-options"
          role="group"
          aria-label={detail.optionsLabel}
        >
          {detail.options.length > 0 ? detail.options.map(option => {
            const selected = option.selected;
            return (
              <button
                key={option.id}
                type="button"
                className="rhythm-association-picker__detail-option"
                data-picker-item-id={option.id}
                aria-label={option.label}
                aria-pressed={selected}
                data-selected={selected ? 'true' : 'false'}
                onClick={() => onToggle(option.id)}
              >
                <span className="rhythm-association-picker__detail-option-content">
                  {option.content}
                </span>
                <span className="rhythm-association-picker__selection-indicator" aria-hidden="true">
                  {selected ? '✓' : ''}
                </span>
              </button>
            );
          }) : <p className="rhythm-association-picker__empty">{emptyMessage}</p>}
        </div>
        <div className="money-goal-dialog__actions rhythm-association-picker__actions">
          <span className="rhythm-association-picker__selection-count" aria-live="polite">
            {selectedCategoryCountLabel}
          </span>
          <button type="button" className="btn mini" onClick={returnToList}>Done</button>
          <button type="button" className="btn mini ghost" onClick={onCancel}>Cancel</button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="rhythm-association-picker"
      aria-labelledby="rhythm-association-picker-title"
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <h3 id="rhythm-association-picker-title" ref={headingRef} tabIndex={-1}>{title}</h3>
      {description && <p className="rhythm-association-picker__description">{description}</p>}
      {groups && onToggleGroup && (
        <div className="rhythm-association-picker__groups" role="group" aria-label="Select people by group">
          {groups.map(group => {
            const memberIds = group.memberIds.filter(id => availableIds.has(id));
            const selectedCount = memberIds.filter(id => selectedIds.includes(id)).length;
            const selected = memberIds.length > 0 && selectedCount === memberIds.length;
            const disabled = memberIds.length === 0;
            const descriptionId = `rhythm-association-group-${group.id}`;
            return (
              <button
                key={group.id}
                type="button"
                className="rhythm-association-picker__group"
                data-selected={selected ? 'true' : 'false'}
                aria-label={`Select ${group.label} people`}
                aria-describedby={descriptionId}
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => onToggleGroup(memberIds)}
              >
                <span className="rhythm-association-picker__group-badge">{group.label}</span>
              </button>
            );
          })}
          {groups.map(group => {
            const memberIds = group.memberIds.filter(id => availableIds.has(id));
            const selected = memberIds.length > 0 && memberIds.every(id => selectedIds.includes(id));
            const disabled = memberIds.length === 0;
            return (
              <span
                key={`${group.id}-status`}
                className="visually-hidden"
                id={`rhythm-association-group-${group.id}`}
              >
                {disabled
                  ? `No people belong to ${group.label} in the synthetic preview.`
                  : selected
                    ? `All ${group.label} members are selected. Activate to deselect all ${group.label} members.`
                    : `Not all ${group.label} members are selected. Activate to select all ${group.label} members.`}
              </span>
            );
          })}
        </div>
      )}
      {items.length === 0 ? (
        <>
          <p className="rhythm-association-picker__empty">{emptyMessage}</p>
          {unavailableSelectedItems.length > 0 && (
            <div className="rhythm-association-picker__unavailable" role="group"
              aria-label={unavailableGroupLabel ?? `Unresolved ${unavailableItemType} links`}>
              {unavailableSelectedItems.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className="rhythm-association-picker__option rhythm-association-picker__option--unavailable"
                  aria-label={getUnavailableItemLabel?.(item) ?? `Remove unresolved ${unavailableItemType} link ${item.id}`}
                  aria-pressed="true"
                  data-selected="true"
                  onClick={() => onToggle(item.id)}
                >
                  <span className="rhythm-association-picker__badge">{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div
          className={navigation
            ? 'rhythm-association-picker__category-list'
            : `rhythm-association-picker__options${renderSelectedItemContent ? ' rhythm-association-picker__options--expanded' : ''}`}
          role="group"
          aria-label={navigation ? 'Available categories' : title}
        >
          {(groupBy
            ? [...new Set(items.map(groupBy))]
            : [undefined]
          ).map(groupLabel => {
            const groupItems = groupBy
              ? items.filter(item => groupBy(item) === groupLabel)
              : items;
            return (
              <section
                key={groupLabel ?? title}
                className="rhythm-association-picker__option-group"
                aria-label={groupLabel}
              >
                {groupLabel && <h4>{groupLabel}</h4>}
                <div className={navigation
                  ? 'rhythm-association-picker__category-rows'
                  : 'rhythm-association-picker__option-grid'}>
                  {groupItems.map(item => {
                    const selected = selectedIds.includes(item.id);
                    const fixedSelected = selected && fixedSelectedIds.includes(item.id);
                    const label = getLabel(item);
                    if (navigation) {
                      const summary = navigation.getSummary(item);
                      const valid = navigation.hasValidSelection(item);
                      const summaryText = summary.length > 0
                        ? summary.join(', ')
                        : selected ? 'Choose a Practice or Foundation' : '';
                      const statusId = `rhythm-category-status-${item.id}`;
                      return (
                        <button
                          key={item.id}
                          ref={button => {
                            if (button) categoryButtonRefs.current.set(item.id, button);
                            else categoryButtonRefs.current.delete(item.id);
                          }}
                          type="button"
                          className="rhythm-association-picker__category-row"
                          data-picker-category-id={item.id}
                          aria-label={label}
                          aria-describedby={statusId}
                          onClick={() => setDetailItemId(item.id)}
                        >
                          <span className="rhythm-association-picker__category-row-main">
                            <span className="rhythm-association-picker__category-label">
                              {renderBadge(item)}
                            </span>
                            {summaryText && (
                              <span
                                className="rhythm-association-picker__category-summary"
                                title={summaryText}
                              >
                                {summaryText}
                              </span>
                            )}
                          </span>
                          <span className="rhythm-association-picker__category-row-status">
                            {valid && (
                              <span className="rhythm-association-picker__selection-indicator" aria-hidden="true">
                                ✓
                              </span>
                            )}
                            <span className="rhythm-association-picker__chevron" aria-hidden="true">›</span>
                          </span>
                          <span className="visually-hidden" id={statusId}>
                            {`${valid
                              ? 'This category has a valid Practice or Foundation selection.'
                              : selected
                                ? 'This selected category still needs a valid Practice or Foundation selection.'
                                : 'Open to choose this category and its Practices or Foundations.'}${
                                  summary.length > 0 ? ` Selected: ${summary.join(', ')}.` : ''
                                }`}
                          </span>
                        </button>
                      );
                    }
                    const selectedContent = selected && renderSelectedItemContent
                      ? renderSelectedItemContent(item)
                      : null;
                    const option = (
                      <button
                        key={item.id}
                        type="button"
                        className="rhythm-association-picker__option"
                        data-picker-item-id={item.id}
                        aria-label={label}
                        aria-pressed={selected}
                        {...(renderSelectedItemContent
                          ? {
                              'aria-expanded': selectedContent !== null,
                              ...(selectedContent !== null
                                ? { 'aria-controls': `rhythm-association-item-content-${item.id}` }
                                : {})
                            }
                          : {})}
                        disabled={fixedSelected}
                        data-selected={selected ? 'true' : 'false'}
                        onClick={() => onToggle(item.id)}
                      >
                        <span className="rhythm-association-picker__badge">{renderBadge(item)}</span>
                      </button>
                    );
                    return renderSelectedItemContent
                      ? (
                        <div
                          key={item.id}
                          className="rhythm-association-picker__expanded-item"
                          data-selected={selected ? 'true' : 'false'}
                          data-expanded={selectedContent !== null ? 'true' : 'false'}
                        >
                          {option}
                          {selectedContent !== null && (
                            <div className="rhythm-association-picker__expanded-content">
                              <div id={`rhythm-association-item-content-${item.id}`}>
                                {selectedContent}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                      : option;
                  })}
                </div>
              </section>
            );
          })}
          {unavailableSelectedItems.length > 0 && (
            <div className="rhythm-association-picker__unavailable" role="group"
              aria-label={unavailableGroupLabel ?? `Unresolved ${unavailableItemType} links`}>
              {unavailableSelectedItems.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className="rhythm-association-picker__option rhythm-association-picker__option--unavailable"
                  aria-label={getUnavailableItemLabel?.(item) ?? `Remove unresolved ${unavailableItemType} link ${item.id}`}
                  aria-pressed="true"
                  data-selected="true"
                  onClick={() => onToggle(item.id)}
                >
                  <span className="rhythm-association-picker__badge">{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="money-goal-dialog__actions rhythm-association-picker__actions">
        {navigation && (
          <span className="rhythm-association-picker__selection-count" aria-live="polite">
            {selectedCategoryCountLabel}
          </span>
        )}
        <button type="button" className="btn mini" onClick={onDone}>{doneLabel}</button>
        <button type="button" className="btn mini ghost" onClick={onCancel}>Cancel</button>
      </div>
    </section>
  );
}
