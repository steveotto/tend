import { useRef, useState } from 'react';
import type { CheckInDraft, CheckInDraftErrors, GoalCheckIn, MoneyGoal } from '../domain/money-goals.ts';
import { GoalEditor } from './GoalEditor.tsx';
import { GoalCard } from './Cards.tsx';
import { ProgressCheckIn } from './ProgressCheckIn.tsx';
import { CategoryHeader } from './CategoryHeader.tsx';

type GoalDialogState =
  | { kind: 'edit'; goal: MoneyGoal | null; newGoalId: string }
  | { kind: 'check-in'; goalId: string; checkIn: GoalCheckIn | null };

type FinanceGoalsViewProps = {
  goals: readonly MoneyGoal[];
  currentDate: string;
  onSaveGoal: (goal: MoneyGoal) => void;
  onSaveCheckIn: (goalId: string, draft: CheckInDraft, correctingCheckIn?: GoalCheckIn) => CheckInDraftErrors;
  onToday: () => void;
};

export function FinanceGoalsView({ goals, currentDate, onSaveGoal, onSaveCheckIn, onToday }: FinanceGoalsViewProps) {
  const [dialog, setDialog] = useState<GoalDialogState | null>(null);
  const goalSequence = useRef(1);
  const checkInGoal = dialog?.kind === 'check-in'
    ? goals.find(goal => goal.id === dialog.goalId)
    : undefined;

  function addGoal() {
    let newGoalId = `sample-goal-${goalSequence.current}`;
    while (goals.some(goal => goal.id === newGoalId)) {
      goalSequence.current += 1;
      newGoalId = `sample-goal-${goalSequence.current}`;
    }
    goalSequence.current += 1;
    setDialog({ kind: 'edit', goal: null, newGoalId });
  }

  function correctCheckIn(goal: MoneyGoal, checkIn: GoalCheckIn) {
    setDialog({ kind: 'check-in', goalId: goal.id, checkIn });
  }

  return (
    <main className="category-page category-page--with-header money-goals-page" aria-labelledby="finances-heading">
      <CategoryHeader
        title="Finances"
        titleId="finances-heading"
        trailing={<span className="hint">Examples only · taxonomy not finalized</span>}
      />
      <section className="money-goals-intro card" aria-label="Finance preview information">
        <p><strong>Sample goals and balance snapshots.</strong> All values are illustrative; edits are saved only in this browser’s synthetic preview.</p>
        <p>Manual check-ins are dated observations. No account, bank connection, balance verification, or money movement is active.</p>
      </section>
      <section className="money-goals-section" aria-labelledby="sample-goals-heading">
        <div className="money-goals-section__heading">
          <div>
            <h3 id="sample-goals-heading">Goal examples</h3>
            <p>Savings and debt use the same goal, check-in, and timeline components.</p>
          </div>
          <button type="button" className="btn mini" onClick={addGoal}>Add example goal</button>
        </div>
        {goals.length
          ? <div className="money-goals-list">{goals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={() => setDialog({ kind: 'edit', goal, newGoalId: goal.id })}
              onCheckIn={() => setDialog({ kind: 'check-in', goalId: goal.id, checkIn: null })}
              onCorrectCheckIn={checkIn => correctCheckIn(goal, checkIn)}
            />
          ))}</div>
          : <p className="goal-empty-state" role="status">No sample goals available. Add an example goal to begin.</p>}
      </section>
      {dialog?.kind === 'edit' && (
        <GoalEditor
          {...(dialog.goal ? { goal: dialog.goal } : {})}
          newGoalId={dialog.newGoalId}
          onSave={goal => {
            onSaveGoal(goal);
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'check-in' && checkInGoal && (
        <ProgressCheckIn
          key={`${dialog.goalId}-${dialog.checkIn?.id ?? 'new'}`}
          goal={checkInGoal}
          currentDate={currentDate}
          {...(dialog.checkIn ? { checkIn: dialog.checkIn } : {})}
          onSave={(draft, correctingCheckIn) => onSaveCheckIn(dialog.goalId, draft, correctingCheckIn)}
          onClose={() => setDialog(null)}
        />
      )}
      <button type="button" className="money-goals-back" onClick={onToday}>Back to Today</button>
    </main>
  );
}
