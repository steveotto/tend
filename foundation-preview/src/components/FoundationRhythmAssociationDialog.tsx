import { useState } from 'react';
import type { FormEvent } from 'react';
import type { FoundationPreview, RhythmPreview } from '../domain/preview-data.ts';
import {
  foundationRhythmRole,
  type FoundationRhythmAssociationChange,
  type FoundationRhythmRole
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
  const [roles, setRoles] = useState(() => new Map(
    rhythms.map(({ rhythm }) => [rhythm.id, foundationRhythmRole(rhythm, foundation.id)])
  ));
  const [error, setError] = useState<string | null>(null);

  function updateRole(rhythmId: string, role: FoundationRhythmRole) {
    setRoles(previous => new Map(previous).set(rhythmId, role));
    setError(null);
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = onSave([...roles].map(([rhythmId, role]) => ({ rhythmId, role })));
    if (message) {
      setError(message);
      return;
    }
    onClose();
  }

  const currentSelections = rhythms.filter(({ rhythm }) =>
    foundationRhythmRole(rhythm, foundation.id) !== 'none'
  );

  return (
    <MoneyGoalDialog
      title={`Manage Rhythms for ${foundation.name}`}
      intro="Choose which synthetic Marriage Rhythms support this Foundation. A Rhythm keeps one primary Foundation; it may support additional Foundations."
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
                  <span>{roleLabel(foundationRhythmRole(rhythm, foundation.id))}</span>
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
                const primaryElsewhere = Boolean(
                  rhythm.primaryFoundationId && rhythm.primaryFoundationId !== foundation.id
                );
                const selectId = `foundation-rhythm-association-${rhythm.id}`;
                const metadata = [rhythm.cadence, rhythm.timeLabel].filter(Boolean).join(' · ');
                return (
                  <div className="foundation-association-option" key={rhythm.id}>
                    <label htmlFor={selectId}>
                      <span>{rhythm.title} <span className="foundation-association-id">({rhythm.id})</span></span>
                      {metadata && <small>{metadata}</small>}
                      {archived && <small>Archived · restore before changing this association</small>}
                    </label>
                    <select
                      id={selectId}
                      aria-label={`Association role for ${rhythm.title}, ${rhythm.id}`}
                      value={roles.get(rhythm.id) ?? 'none'}
                      disabled={archived}
                      onChange={event => {
                        const value = event.currentTarget.value;
                        if (value === 'none' || value === 'primary' || value === 'supporting') {
                          updateRole(rhythm.id, value);
                        }
                      }}
                    >
                      <option value="none">Not linked</option>
                      <option value="primary" disabled={primaryElsewhere}>Primary</option>
                      <option value="supporting">Supporting</option>
                    </select>
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

function roleLabel(role: FoundationRhythmRole): string {
  return role === 'primary' ? 'Primary' : 'Supporting';
}
