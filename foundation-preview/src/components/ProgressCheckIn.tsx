import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  moneyInputValue,
  validateCheckInDraft,
  type CheckInDraft,
  type CheckInDraftErrors,
  type GoalCheckIn,
  type MoneyGoal
} from '../domain/money-goals.ts';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';

type ProgressCheckInProps = {
  goal: MoneyGoal;
  checkIn?: GoalCheckIn;
  currentDate: string;
  onSave: (draft: CheckInDraft, correctingCheckIn?: GoalCheckIn) => CheckInDraftErrors;
  onClose: () => void;
};

export function ProgressCheckIn({ goal, checkIn, currentDate, onSave, onClose }: ProgressCheckInProps) {
  const [draft, setDraft] = useState<CheckInDraft>(() => ({
    effectiveDate: checkIn?.effectiveDate ?? currentDate,
    balance: checkIn ? moneyInputValue(checkIn.balanceMinor, goal.currency) : '',
    note: checkIn?.note ?? ''
  }));
  const [errors, setErrors] = useState<CheckInDraftErrors>({});
  const duplicateDate = goal.checkIns.find(item => item.effectiveDate === draft.effectiveDate);

  function update(field: keyof CheckInDraft, value: string) {
    setDraft(previous => ({ ...previous, [field]: value }));
    setErrors({});
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validateCheckInDraft(goal, draft, currentDate, checkIn);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;
    const saveErrors = onSave(draft, checkIn);
    setErrors(saveErrors);
    if (Object.keys(saveErrors).length === 0) onClose();
  }

  function fieldError(field: keyof CheckInDraft) {
    return errors[field] ? <span className="goal-field-error" id={`check-in-error-${field}`}>{errors[field]}</span> : null;
  }

  return (
    <MoneyGoalDialog
      title={checkIn ? 'Correct balance check-in' : 'Record balance check-in'}
      intro={`${goal.title} · ${goal.currency}. Enter an observed balance, not a payment amount.`}
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate>
          <div className="goal-field">
            <label htmlFor="check-in-date">Effective date</label>
            <input
              id="check-in-date"
              type={checkIn ? 'text' : 'date'}
              value={draft.effectiveDate}
              readOnly={Boolean(checkIn)}
              aria-readonly={Boolean(checkIn)}
              aria-invalid={Boolean(errors.effectiveDate)}
              aria-describedby={errors.effectiveDate ? 'check-in-error-effectiveDate' : undefined}
              onChange={event => update('effectiveDate', event.currentTarget.value)}
            />
            {fieldError('effectiveDate')}
          </div>
          <div className="goal-field">
            <label htmlFor="check-in-balance">Current balance</label>
            <input
              id="check-in-balance"
              inputMode="decimal"
              value={draft.balance}
              aria-invalid={Boolean(errors.balance)}
              aria-describedby={errors.balance ? 'check-in-error-balance' : undefined}
              onChange={event => update('balance', event.currentTarget.value)}
            />
            {fieldError('balance')}
          </div>
          <div className="goal-field">
            <label htmlFor="check-in-note">Note <span className="goal-field-optional">(optional)</span></label>
            <textarea
              id="check-in-note"
              value={draft.note}
              rows={3}
              onChange={event => update('note', event.currentTarget.value)}
            />
          </div>
          {duplicateDate && (
            <p className="check-in-correction-notice" role="status">
              {checkIn
                ? 'The effective date is fixed while correcting this check-in. Saving replaces its value and retains the previous value in this preview’s correction history.'
                : 'A check-in already exists for this date. Saving replaces it and retains its previous value in this preview’s correction history.'}
            </p>
          )}
          {Object.keys(errors).length > 0 && <p className="goal-form-error-summary" role="alert">Review the highlighted check-in fields.</p>}
          <div className="money-goal-dialog__actions">
            <button type="submit" className="btn mini">{duplicateDate ? 'Save correction' : 'Save check-in'}</button>
            <button type="button" className="btn mini ghost" onClick={onClose}>Cancel</button>
          </div>
      </form>
    </MoneyGoalDialog>
  );
}
