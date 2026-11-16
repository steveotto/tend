import { useId, useState } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import type { GoalRhythmAssociationChange, MoneyGoal } from '../domain/money-goals.ts';
import { foundationRhythmIds } from '../domain/foundation-rhythm-associations.ts';
import type { RhythmPreview } from '../domain/preview-data.ts';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';

type RhythmRecord = {
  rhythm: RhythmPreview;
  archived: boolean;
};

type GoalRhythmOption = {
  id: string;
  title: string;
  detail: string;
  eligible: boolean;
};

export function GoalRhythmAssociationDialog({
  goal,
  financeFoundationId,
  financeCategoryEnabled,
  eligibleRhythms,
  rhythms,
  archivedRhythms,
  onSave,
  onCreateRhythm,
  onClose
}: {
  goal: MoneyGoal;
  financeFoundationId: string;
  financeCategoryEnabled: boolean;
  eligibleRhythms: readonly RhythmPreview[];
  rhythms: readonly RhythmPreview[];
  archivedRhythms: readonly RhythmPreview[];
  onSave: (changes: readonly GoalRhythmAssociationChange[]) => string | null;
  onCreateRhythm: (event: MouseEvent<HTMLButtonElement>) => void;
  onClose: () => void;
}) {
  const id = useId();
  const originalIds = goal.supportingRhythmIds ?? [];
  const [selectedIds, setSelectedIds] = useState(() => new Set(originalIds));
  const [error, setError] = useState<string | null>(null);
  const records = new Map<string, RhythmRecord>();
  for (const rhythm of rhythms) records.set(rhythm.id, { rhythm, archived: false });
  for (const rhythm of archivedRhythms) records.set(rhythm.id, { rhythm, archived: true });

  const options = new Map<string, GoalRhythmOption>();
  for (const rhythm of eligibleRhythms) {
    options.set(rhythm.id, {
      id: rhythm.id,
      title: rhythm.title,
      detail: [rhythm.cadence, rhythm.timeLabel].filter(Boolean).join(' · ') || 'Schedule not set',
      eligible: true
    });
  }
  for (const rhythmId of originalIds) {
    if (options.has(rhythmId)) continue;
    const record = records.get(rhythmId);
    if (!record) {
      options.set(rhythmId, {
        id: rhythmId,
        title: 'Unavailable Rhythm',
        detail: 'Saved reference retained. Uncheck to remove this goal link.',
        eligible: false
      });
      continue;
    }
    const detail = record.archived
      ? 'Archived. This goal link is preserved; removing it will not delete the Rhythm or its history.'
      : !financeCategoryEnabled
        ? 'Finances is disabled. This existing link is preserved and cannot be newly added.'
        : !record.rhythm.categoryIds?.includes('finances')
          ? 'No longer in the Finance category. This existing link is preserved.'
          : !foundationRhythmIds(record.rhythm).includes(financeFoundationId)
            ? 'Not linked to the Finance Foundation. This existing goal link is preserved.'
            : 'This existing link is not currently eligible for a new association.';
    options.set(rhythmId, {
      id: rhythmId,
      title: record.rhythm.title,
      detail,
      eligible: false
    });
  }

  const ids = [...options.keys()];
  const hasChanges = ids.some(rhythmId =>
    selectedIds.has(rhythmId) !== originalIds.includes(rhythmId)
  );

  function toggle(rhythmId: string, linked: boolean) {
    setSelectedIds(previous => {
      const next = new Set(previous);
      if (linked) next.add(rhythmId);
      else next.delete(rhythmId);
      return next;
    });
    setError(null);
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const changes: GoalRhythmAssociationChange[] = ids.map(rhythmId => ({
      rhythmId,
      linked: selectedIds.has(rhythmId)
    }));
    const message = onSave(changes);
    if (message) {
      setError(message);
      return;
    }
    onClose();
  }

  return (
    <MoneyGoalDialog
      eyebrow={goal.title}
      title="Supporting Rhythms"
      intro="Choose active Finance Rhythms that already have an explicit Finance Foundation link. Goal links do not qualify Rhythms for scoring."
      closeLabel="Close supporting Rhythm links"
      closeButtonId="goal-rhythm-links-close"
      initialFocusId="goal-rhythm-links-close"
      dialogClassName="finance-goal-fullscreen-dialog"
      phoneFullScreen
      onClose={onClose}
    >
      <form className="finance-goal-rhythm-links" onSubmit={save}>
        {options.size > 0 ? (
          <fieldset>
            <legend>Finance Rhythms and saved links</legend>
            {ids.map((rhythmId, index) => {
              const option = options.get(rhythmId)!;
              const checkboxId = `${id}-rhythm-${index}`;
              return (
                <div className="finance-goal-rhythm-links__option" key={rhythmId}>
                  <label htmlFor={checkboxId}>
                    <strong>{option.title}</strong>
                    <small>{option.detail}</small>
                  </label>
                  <input
                    id={checkboxId}
                    type="checkbox"
                    checked={selectedIds.has(rhythmId)}
                    disabled={!option.eligible && !originalIds.includes(rhythmId)}
                    onChange={event => toggle(rhythmId, event.currentTarget.checked)}
                  />
                </div>
              );
            })}
          </fieldset>
        ) : (
          <div className="finance-goal-rhythm-links__empty" role="status">
            <h3>No eligible Finance Rhythms yet</h3>
            <p>
              Create a Finance Rhythm and explicitly choose the Finance Foundation in its editor before linking it here.
            </p>
          </div>
        )}

        {!financeCategoryEnabled && (
          <p className="finance-goal-rhythm-links__notice" role="status">
            Finances is disabled. Existing references are retained; enable the category before adding new links.
          </p>
        )}
        {financeCategoryEnabled && (
          <button type="button" className="btn mini ghost" onClick={onCreateRhythm}>
            Create a Finance Rhythm
          </button>
        )}
        {error && <p className="goal-field-error" role="alert">{error}</p>}
        <div className="money-goal-dialog__actions">
          <button type="submit" className="btn mini" disabled={!hasChanges}>Save links</button>
          <button type="button" className="btn mini ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </MoneyGoalDialog>
  );
}
