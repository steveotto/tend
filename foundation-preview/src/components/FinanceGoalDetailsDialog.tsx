import type { MoneyGoal } from '../domain/money-goals.ts';
import type { FoundationPreview } from '../domain/preview-data.ts';
import { useAvailableFoundations } from './CategoryAvailabilityContext.tsx';
import { GoalCard } from './Cards.tsx';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { ToolZone, ToolZoneTrendingUpIcon } from './ToolZone.tsx';

export function FinanceGoalDetailsDialog({
  goal,
  foundations,
  onEdit,
  onCheckIn,
  onCorrectCheckIn,
  onClose
}: {
  goal: MoneyGoal;
  foundations: readonly FoundationPreview[];
  onEdit: () => void;
  onCheckIn: () => void;
  onCorrectCheckIn: (checkIn: MoneyGoal['checkIns'][number]) => void;
  onClose: () => void;
}) {
  const availableFoundations = useAvailableFoundations(foundations);
  const linkedFoundation = goal.foundationId
    ? availableFoundations.find(foundation => foundation.id === goal.foundationId)
    : undefined;
  const hasSavedFoundation = goal.foundationId
    ? foundations.some(foundation => foundation.id === goal.foundationId)
    : false;

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
        <p className="finance-goal-details__foundation">
          Related Finance Foundation:{' '}
          {goal.foundationId
            ? linkedFoundation?.name
              ?? (hasSavedFoundation
                ? 'Hidden Foundation (association preserved)'
                : `Unavailable saved reference (${goal.foundationId})`)
            : 'Unassigned'}
        </p>
        <ToolZone
          className="finance-goal-details__tool-zone"
          headingId="finance-goal-details-progress"
          icon={<ToolZoneTrendingUpIcon />}
          purposeLabel="Balance progress"
          subtitle="Track balance, target progress, and dated check-ins."
          scoringFootnote="Goal balances don’t change your Health score."
        >
          <GoalCard
            goal={goal}
            presentation="details"
            onEdit={onEdit}
            onCheckIn={onCheckIn}
            onCorrectCheckIn={onCorrectCheckIn}
          />
        </ToolZone>
      </div>
    </MoneyGoalDialog>
  );
}
