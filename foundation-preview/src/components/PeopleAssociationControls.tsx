import type { RefObject } from 'react';
import type { PersonId, PersonPreview } from '../domain/preview-data.ts';
import { syntheticPeople, syntheticPersonPickerGroups } from '../domain/preview-data.ts';
import { BadgeSelectionPicker } from './BadgeSelectionPicker.tsx';
import { PersonBadge, PersonBadgeVisual } from './PersonBadge.tsx';

export function PeopleAssociationRow({
  selectedPeople,
  openerRef,
  onChoose
}: {
  selectedPeople: readonly PersonPreview[];
  openerRef: RefObject<HTMLButtonElement | null>;
  onChoose: () => void;
}) {
  const names = selectedPeople.map(person => person.displayName);
  const selectedNames = names.length === 1
    ? names[0]!
    : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

  return (
    <button
      ref={openerRef}
      type="button"
      className="rhythm-editor__association-row"
      aria-label={names.length > 0 ? `Choose people, ${selectedNames}` : 'Choose people'}
      onClick={onChoose}
    >
      <span className="rhythm-editor__association-row-content">
        <span className="rhythm-editor__association-row-title">People</span>
        <span className="rhythm-editor__association-row-selection">
          {selectedPeople.length > 0 ? (
            <span className="rhythm-editor__association-people">
              {selectedPeople.map(person => (
                <PersonBadge key={person.id} person={person} presentation="static" />
              ))}
            </span>
          ) : <span className="rhythm-editor__association-empty">Choose people</span>}
        </span>
      </span>
      <span className="rhythm-editor__association-row-chevron" aria-hidden="true">›</span>
    </button>
  );
}

export function PeopleBadgeSelectionPicker({
  selectedIds,
  onToggle,
  onToggleGroup,
  onDone,
  onCancel
}: {
  selectedIds: readonly PersonId[];
  onToggle: (id: PersonId) => void;
  onToggleGroup: (ids: readonly PersonId[]) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  return (
    <BadgeSelectionPicker
      title="Choose people"
      items={syntheticPeople}
      selectedIds={selectedIds}
      getLabel={person => person.displayName}
      renderBadge={person => <PersonBadgeVisual person={person} />}
      groups={syntheticPersonPickerGroups}
      onToggle={onToggle}
      onToggleGroup={onToggleGroup}
      onDone={onDone}
      onCancel={onCancel}
    />
  );
}
