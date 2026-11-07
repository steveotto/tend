import type { RefObject } from 'react';
import type { PersonId, PersonPickerGroup, PersonPreview } from '../domain/preview-data.ts';
import { syntheticPersonPickerGroups } from '../domain/preview-data.ts';
import { BadgeSelectionPicker } from './BadgeSelectionPicker.tsx';
import { PersonBadge, PersonBadgeVisual } from './PersonBadge.tsx';

export function PeopleAssociationRow({
  selectedPeople,
  unavailableIds = [],
  openerRef,
  onChoose
}: {
  selectedPeople: readonly PersonPreview[];
  unavailableIds?: readonly string[];
  openerRef: RefObject<HTMLButtonElement | null>;
  onChoose: () => void;
}) {
  const names = selectedPeople.map(person => person.displayName);
  const selectedNames = [
    ...names,
    ...unavailableIds.map(id => `Unavailable person reference ${id}`)
  ];
  const selectionLabel = selectedNames.length === 1
    ? selectedNames[0]!
    : `${selectedNames.slice(0, -1).join(', ')} and ${selectedNames.at(-1)}`;

  return (
    <button
      ref={openerRef}
      type="button"
      className="rhythm-editor__association-row"
      aria-label={selectedNames.length > 0 ? `Choose people, ${selectionLabel}` : 'Choose people'}
      onClick={onChoose}
    >
      <span className="rhythm-editor__association-row-content">
        <span className="rhythm-editor__association-row-title">People</span>
        <span className="rhythm-editor__association-row-selection">
          {selectedPeople.length > 0 && (
            <span className="rhythm-editor__association-people">
              {selectedPeople.map(person => (
                <PersonBadge key={person.id} person={person} presentation="static" />
              ))}
            </span>
          )}
          {unavailableIds.map(id => (
            <span key={id} className="rhythm-editor__association-unavailable">
              Unavailable person: {id}. Open Choose people to remove this reference.
            </span>
          ))}
          {selectedPeople.length === 0 && unavailableIds.length === 0 && (
            <span className="rhythm-editor__association-empty">Choose people</span>
          )}
        </span>
      </span>
      <span className="rhythm-editor__association-row-chevron" aria-hidden="true">›</span>
    </button>
  );
}

export function PeopleBadgeSelectionPicker({
  people,
  selectedIds,
  onToggle,
  onToggleGroup,
  groups = syntheticPersonPickerGroups,
  excludedIds = [],
  unavailableSelectedIds = [],
  onDone,
  onCancel
}: {
  people: readonly PersonPreview[];
  selectedIds: readonly PersonId[];
  onToggle: (id: PersonId) => void;
  onToggleGroup: (ids: readonly PersonId[]) => void;
  groups?: readonly PersonPickerGroup[];
  excludedIds?: readonly PersonId[];
  unavailableSelectedIds?: readonly PersonId[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const excluded = new Set(excludedIds);
  const availablePeople = people.filter(person => !excluded.has(person.id));
  const availableGroups = groups.map(group => ({
    ...group,
    memberIds: group.memberIds.filter(id => !excluded.has(id))
  }));
  return (
    <BadgeSelectionPicker
      title="Choose people"
      items={availablePeople}
      selectedIds={selectedIds}
      getLabel={person => person.displayName}
      renderBadge={person => <PersonBadgeVisual person={person} />}
      groups={availableGroups}
      unavailableSelectedItems={[...new Set(unavailableSelectedIds)].map(id => ({
        id,
        label: `Unavailable person (${id})`
      }))}
      unavailableItemType="Person"
      unavailableGroupLabel="Unavailable People references"
      getUnavailableItemLabel={item => `Remove unavailable person reference ${item.id}`}
      onToggle={onToggle}
      onToggleGroup={onToggleGroup}
      onDone={onDone}
      onCancel={onCancel}
    />
  );
}
