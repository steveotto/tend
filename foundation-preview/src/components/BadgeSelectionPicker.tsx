import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

type IdentifiedItem = { id: string };

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
  focusItemId,
  onToggle,
  onToggleGroup,
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
  focusItemId?: string | null;
  onToggle: (id: Item['id']) => void;
  onToggleGroup?: (ids: readonly Item['id'][]) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focusItemId) {
      Array.from(document.querySelectorAll<HTMLButtonElement>('[data-picker-item-id]'))
        .find(button => button.dataset.pickerItemId === focusItemId)
        ?.focus();
    } else {
      headingRef.current?.focus();
    }
  }, [focusItemId]);

  const availableIds = new Set(items.map(item => item.id));

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
          {unavailableSelectedItems.map(item => (
            <button
              key={item.id}
              type="button"
              className="rhythm-association-picker__option rhythm-association-picker__option--unavailable"
              aria-label={`Remove unresolved ${unavailableItemType} link ${item.id}`}
              aria-pressed="true"
              data-selected="true"
              onClick={() => onToggle(item.id)}
            >
              <span className="rhythm-association-picker__badge">{item.label}</span>
            </button>
          ))}
        </>
      ) : (
        <div className="rhythm-association-picker__options" role="group" aria-label={title}>
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
                <div className="rhythm-association-picker__option-grid">
                  {groupItems.map(item => {
                    const selected = selectedIds.includes(item.id);
                    const label = getLabel(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="rhythm-association-picker__option"
                        data-picker-item-id={item.id}
                        aria-label={label}
                        aria-pressed={selected}
                        data-selected={selected ? 'true' : 'false'}
                        onClick={() => onToggle(item.id)}
                      >
                        <span className="rhythm-association-picker__badge">{renderBadge(item)}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {unavailableSelectedItems.map(item => (
            <button
              key={item.id}
              type="button"
              className="rhythm-association-picker__option rhythm-association-picker__option--unavailable"
              aria-label={`Remove unresolved ${unavailableItemType} link ${item.id}`}
              aria-pressed="true"
              data-selected="true"
              onClick={() => onToggle(item.id)}
            >
              <span className="rhythm-association-picker__badge">{item.label}</span>
            </button>
          ))}
        </div>
      )}
      <div className="money-goal-dialog__actions rhythm-association-picker__actions">
        <button type="button" className="btn mini" onClick={onDone}>Done</button>
        <button type="button" className="btn mini ghost" onClick={onCancel}>Cancel</button>
      </div>
    </section>
  );
}
