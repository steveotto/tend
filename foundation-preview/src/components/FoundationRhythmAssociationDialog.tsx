import { useState } from 'react';
import type { FormEvent } from 'react';
import type { FoundationPreview, RhythmPreview } from '../domain/preview-data.ts';
import {
  isRhythmLinkedToFoundation,
  type FoundationRhythmAssociationChange
} from '../domain/foundation-rhythm-associations.ts';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';

type AssociationRhythm = {
  rhythm: RhythmPreview;
  archived: boolean;
};

export function FoundationRhythmAssociationDialog({
  foundation,
  rhythms,
  onSave,
  onClose
}: {
  foundation: FoundationPreview;
  rhythms: readonly AssociationRhythm[];
  onSave: (changes: readonly FoundationRhythmAssociationChange[]) => string | null;
  onClose: () => void;
}) {
  const [linkedRhythms, setLinkedRhythms] = useState(() => new Map(
    rhythms.map(({ rhythm }) => [rhythm.id, isRhythmLinkedToFoundation(rhythm, foundation.id)])
  ));
  const [error, setError] = useState<string | null>(null);

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

  const currentSelections = rhythms.filter(({ rhythm }) =>
    linkedRhythms.get(rhythm.id) ?? isRhythmLinkedToFoundation(rhythm, foundation.id)
  );

  return (
    <MoneyGoalDialog
      title={`Manage Rhythms for ${foundation.name}`}
      intro="Choose the rhythms that support this Foundation."
      closeLabel="Close Foundation associations"
      initialFocusId="foundation-rhythm-associations-title"
      dialogClassName="foundation-association-dialog"
      surfaceClassName="foundation-association-dialog__surface"
      onClose={onClose}
    >
      <form className="foundation-association-form" onSubmit={save}>
        <h3 id="foundation-rhythm-associations-title" tabIndex={-1}>Current selections</h3>
        {currentSelections.length
          ? (
            <ul className="foundation-association-current">
              {currentSelections.map(({ rhythm }) => (
                <li key={rhythm.id}>
                  <span>{rhythm.title}</span>
                  <small>{rhythmMetadata(rhythm)}</small>
                </li>
              ))}
            </ul>
          )
          : <p className="foundation-association-empty">No Rhythms currently support this Foundation.</p>}

        <fieldset className="foundation-association-options">
          <legend>Eligible Marriage Rhythms</legend>
          {rhythms.length === 0
            ? <p className="foundation-association-empty">No synthetic Marriage Rhythms are available in this example.</p>
            : rhythms.map(({ rhythm, archived }) => {
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

        {error && <p className="goal-field-error" role="alert">{error}</p>}
        <div className="money-goal-dialog__actions foundation-association-actions">
          <button type="submit" className="btn mini">Save</button>
          <button type="button" className="btn mini ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </MoneyGoalDialog>
  );
}

function rhythmMetadata(rhythm: RhythmPreview): string {
  return [rhythm.cadence, rhythm.timeLabel].filter(Boolean).join(' · ') || 'Schedule not set';
}
