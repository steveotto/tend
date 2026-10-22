import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  goalDraftFrom,
  goalFromDraft,
  type GoalDraft,
  type GoalDraftErrors,
  type MoneyGoal
} from '../domain/money-goals.ts';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';

type GoalEditorProps = {
  goal?: MoneyGoal;
  newGoalId: string;
  onSave: (goal: MoneyGoal) => void;
  onClose: () => void;
};

const emptyDraft: GoalDraft = {
  title: '',
  currency: 'USD',
  direction: 'increase',
  startingBalance: '',
  startDate: '',
  targetBalance: '',
  targetDate: ''
};

export function GoalEditor({ goal, newGoalId, onSave, onClose }: GoalEditorProps) {
  const [draft, setDraft] = useState<GoalDraft>(() => goal ? goalDraftFrom(goal) : emptyDraft);
  const [errors, setErrors] = useState<GoalDraftErrors>({});

  function update(field: keyof GoalDraft, value: string) {
    setDraft(previous => ({ ...previous, [field]: value }));
    setErrors({});
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = goalFromDraft(draft, goal?.id ?? newGoalId, goal);
    setErrors(result.errors);
    if (result.goal) onSave(result.goal);
  }

  function fieldError(field: keyof GoalDraft) {
    return errors[field] ? <span className="goal-field-error" id={`goal-error-${field}`}>{errors[field]}</span> : null;
  }

  return (
    <MoneyGoalDialog
      title={goal ? 'Edit example goal' : 'Add example goal'}
      intro="Example only. Edits stay in this synthetic preview, separate from your Tend account."
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate>
        <div className="goal-field">
          <label htmlFor="goal-title">Title</label>
          <input
            id="goal-title"
            value={draft.title}
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? 'goal-error-title' : undefined}
            onChange={event => update('title', event.currentTarget.value)}
          />
          {fieldError('title')}
        </div>
        <div className="goal-form-grid">
          <div className="goal-field">
            <label htmlFor="goal-currency">Currency (3-letter code)</label>
            <input
              id="goal-currency"
              value={draft.currency}
              maxLength={3}
              autoCapitalize="characters"
              aria-invalid={Boolean(errors.currency)}
              aria-describedby={errors.currency ? 'goal-error-currency' : undefined}
              onChange={event => update('currency', event.currentTarget.value.toUpperCase())}
            />
            {fieldError('currency')}
          </div>
          <div className="goal-field">
            <label htmlFor="goal-direction">Goal direction</label>
            <select
              id="goal-direction"
              value={draft.direction}
              onChange={event => {
                const direction = event.currentTarget.value;
                if (direction === 'increase' || direction === 'decrease') update('direction', direction);
              }}
            >
              <option value="increase">Savings — balance increases</option>
              <option value="decrease">Debt — balance decreases</option>
            </select>
          </div>
          <div className="goal-field">
            <label htmlFor="goal-starting-balance">Starting balance</label>
            <input
              id="goal-starting-balance"
              inputMode="decimal"
              value={draft.startingBalance}
              aria-invalid={Boolean(errors.startingBalance)}
              aria-describedby={errors.startingBalance ? 'goal-error-startingBalance' : undefined}
              onChange={event => update('startingBalance', event.currentTarget.value)}
            />
            {fieldError('startingBalance')}
          </div>
          <div className="goal-field">
            <label htmlFor="goal-start-date">Starting date</label>
            <input
              id="goal-start-date"
              type="date"
              value={draft.startDate}
              aria-invalid={Boolean(errors.startDate)}
              aria-describedby={errors.startDate ? 'goal-error-startDate' : undefined}
              onChange={event => update('startDate', event.currentTarget.value)}
            />
            {fieldError('startDate')}
          </div>
          <div className="goal-field">
            <label htmlFor="goal-target-balance">Target balance</label>
            <input
              id="goal-target-balance"
              inputMode="decimal"
              value={draft.targetBalance}
              aria-invalid={Boolean(errors.targetBalance)}
              aria-describedby={errors.targetBalance ? 'goal-error-targetBalance' : undefined}
              onChange={event => update('targetBalance', event.currentTarget.value)}
            />
            {fieldError('targetBalance')}
          </div>
          <div className="goal-field">
            <label htmlFor="goal-target-date">Target date</label>
            <input
              id="goal-target-date"
              type="date"
              value={draft.targetDate}
              aria-invalid={Boolean(errors.targetDate)}
              aria-describedby={errors.targetDate ? 'goal-error-targetDate' : undefined}
              onChange={event => update('targetDate', event.currentTarget.value)}
            />
            {fieldError('targetDate')}
          </div>
        </div>
        {Object.keys(errors).length > 0 && <p className="goal-form-error-summary" role="alert">Review the highlighted goal fields.</p>}
        <div className="money-goal-dialog__actions">
          <button type="submit" className="btn mini">{goal ? 'Save goal' : 'Add goal'}</button>
          <button type="button" className="btn mini ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </MoneyGoalDialog>
  );
}
