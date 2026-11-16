import type { MoneyGoal } from '../domain/money-goals.ts';
import type { RhythmPreview } from '../domain/preview-data.ts';
import { foundationRhythmIds } from '../domain/foundation-rhythm-associations.ts';
import { GoalCard } from './Cards.tsx';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';

export function FinanceGoalDetailsDialog({
  goal,
  financeFoundationId,
  financeCategoryEnabled,
  financeRhythms,
  rhythms,
  archivedRhythms,
  onEdit,
  onCheckIn,
  onCorrectCheckIn,
  onManageSupportingRhythms,
  onClose
}: {
  goal: MoneyGoal;
  financeFoundationId: string;
  financeCategoryEnabled: boolean;
  financeRhythms: readonly RhythmPreview[];
  rhythms: readonly RhythmPreview[];
  archivedRhythms: readonly RhythmPreview[];
  onEdit: () => void;
  onCheckIn: () => void;
  onCorrectCheckIn: (checkIn: MoneyGoal['checkIns'][number]) => void;
  onManageSupportingRhythms: () => void;
  onClose: () => void;
}) {
  const activeFinanceIds = new Set(financeRhythms.map(rhythm => rhythm.id));
  const rhythmById = new Map([
    ...rhythms.map(rhythm => [rhythm.id, rhythm] as const),
    ...archivedRhythms.map(rhythm => [rhythm.id, rhythm] as const)
  ]);
  const supportingIds = goal.supportingRhythmIds ?? [];

  return (
    <MoneyGoalDialog
      eyebrow={goal.direction === 'increase' ? 'Savings increase' : 'Debt reduction'}
      title={goal.title}
      intro={`Manually tracked ${goal.currency} balance. This is not a bank balance or a complete financial picture.`}
      closeLabel="Close goal details"
      closeButtonId="finance-goal-details-close"
      initialFocusId="finance-goal-details-close"
      dialogClassName="finance-goal-fullscreen-dialog"
      phoneFullScreen
      onClose={onClose}
    >
      <div className="finance-goal-details">
        <GoalCard
          goal={goal}
          presentation="details"
          onEdit={onEdit}
          onCheckIn={onCheckIn}
          onCorrectCheckIn={onCorrectCheckIn}
        />
        <section className="finance-goal-details__support" aria-labelledby="finance-goal-details-support-title">
          <header>
            <h3 id="finance-goal-details-support-title">Supporting Rhythms · {supportingIds.length}</h3>
            <p>Goal links do not qualify Rhythms for scoring or change their completion history.</p>
          </header>
          {supportingIds.length > 0 ? (
            <ul>
              {supportingIds.map(rhythmId => {
                const rhythm = rhythmById.get(rhythmId);
                const isArchived = archivedRhythms.some(item => item.id === rhythmId);
                const foundationLinked = activeFinanceIds.has(rhythmId)
                  && rhythm !== undefined
                  && foundationRhythmIds(rhythm).includes(financeFoundationId);
                const status = !rhythm
                  ? `Unavailable saved reference: ${rhythmId}`
                  : isArchived
                    ? 'Archived; saved link retained.'
                    : !foundationLinked
                      ? 'Finance Foundation link unavailable; saved goal link retained.'
                      : !financeCategoryEnabled
                        ? 'Finances is disabled; saved link retained.'
                        : 'Linked to the Finance Foundation.';
                return (
                  <li key={rhythmId}>
                    <strong>{rhythm?.title ?? 'Unavailable Rhythm'}</strong>
                    <small>{status}</small>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="finance-goal-details__empty">No Rhythms are linked to this goal yet.</p>
          )}
          <button type="button" className="btn mini ghost" onClick={onManageSupportingRhythms}>
            {supportingIds.length ? 'Manage supporting Rhythms' : 'Add a supporting Rhythm'}
          </button>
        </section>
      </div>
    </MoneyGoalDialog>
  );
}
