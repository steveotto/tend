import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  foundationTerminologyForCategory,
  type FoundationPreview,
  type FoundationTerminology,
  type RhythmPreview
} from '../domain/preview-data.ts';
import {
  isRhythmLinkedToFoundation,
  type FoundationRhythmAssociationChange
} from '../domain/foundation-rhythm-associations.ts';
import { MarriageIcon } from './MarriageIcon.tsx';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';

type AssociationRhythm = {
  rhythm: RhythmPreview;
  archived: boolean;
};

export function FoundationRhythmAssociationDialog({
  foundation,
  foundationTerm,
  rhythms,
  onSave,
  onClose
}: {
  foundation: FoundationPreview;
  foundationTerm?: FoundationTerminology;
  rhythms: readonly AssociationRhythm[];
  onSave: (changes: readonly FoundationRhythmAssociationChange[]) => string | null;
  onClose: () => void;
}) {
  const term = foundationTerm ?? foundationTerminologyForCategory(foundation.categoryId);
  const isPractice = term.singular === 'Practice';
  const [linkedRhythms, setLinkedRhythms] = useState(() => new Map(
    rhythms.map(({ rhythm }) => [rhythm.id, isRhythmLinkedToFoundation(rhythm, foundation.id)])
  ));
  const [error, setError] = useState<string | null>(null);
  const hasChanges = rhythms.some(({ rhythm }) =>
    (linkedRhythms.get(rhythm.id) ?? false) !== isRhythmLinkedToFoundation(rhythm, foundation.id)
  );

  function updateLinked(rhythmId: string, linked: boolean) {
    setLinkedRhythms(previous => new Map(previous).set(rhythmId, linked));
    setError(null);
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = onSave([...linkedRhythms].map(([rhythmId, linked]) => ({ rhythmId, linked })));
    if (message) {
      setError(message);
      return;
    }
    onClose();
  }

  return (
    <MoneyGoalDialog
      eyebrow={foundation.name}
      title="Linked Rhythms"
      intro={isPractice
        ? `Choose the Rhythms that support this ${term.singular}.`
        : `Choose the rhythms that support ${foundation.name}.`}
      closeLabel={`Close ${term.singular} associations`}
      closeButtonId="foundation-rhythm-associations-close"
      initialFocusId="foundation-rhythm-associations-close"
      dialogClassName="foundation-association-dialog"
      surfaceClassName="foundation-association-dialog__surface"
      onClose={onClose}
    >
      <form className="foundation-association-form" onSubmit={save}>
        {rhythms.length === 0
          ? (
            <div className="foundation-association-empty-state">
              <span className="foundation-association-empty-state__icon">
                <MarriageIcon group="foundations" id={foundation.iconId ?? foundation.id} />
              </span>
              <h3>No rhythms to link yet</h3>
              <p>{isPractice
                ? `Add a Faith Rhythm from the Rhythms tab. Then choose it here.`
                : `Add a ${foundation.category} rhythm from the Rhythms tab. Then choose it here.`}</p>
            </div>
          )
          : (
            <fieldset className="foundation-association-options">
              <legend>{foundation.category} Rhythms</legend>
              {rhythms.map(({ rhythm, archived }) => {
                const checkboxId = `foundation-rhythm-association-${rhythm.id}`;
                return (
                  <div className="foundation-association-option" key={rhythm.id}>
                    <label htmlFor={checkboxId}>
                      <span>{rhythm.title}</span>
                      <small>{rhythmMetadata(rhythm)}</small>
                      {archived && <small>Archived · restore before changing this association</small>}
                    </label>
                    <input
                      id={checkboxId}
                      type="checkbox"
                      checked={linkedRhythms.get(rhythm.id) ?? false}
                      disabled={archived}
                      onChange={event => updateLinked(rhythm.id, event.currentTarget.checked)}
                    />
                  </div>
                );
              })}
            </fieldset>
          )}

        {error && <p className="goal-field-error" role="alert">{error}</p>}
        <div className="money-goal-dialog__actions foundation-association-actions">
          <button type="submit" className="btn mini" disabled={!hasChanges}>Save</button>
          <button type="button" className="btn mini ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </MoneyGoalDialog>
  );
}

function rhythmMetadata(rhythm: RhythmPreview): string {
  return [rhythm.cadence, rhythm.timeLabel].filter(Boolean).join(' · ') || 'Schedule not set';
}
