import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';

type Props = {
  error?: string;
  onChooseRhythm: () => void;
  onSaveWorkoutOnly: () => void;
  onClose: () => void;
};

export function StrengthWorkoutOnlyConfirmationDialog({
  error,
  onChooseRhythm,
  onSaveWorkoutOnly,
  onClose
}: Props) {
  return (
    <MoneyGoalDialog
      title="Save without a Rhythm?"
      labelledBy="strength-workout-only-confirmation-title"
      titleId="strength-workout-only-confirmation-title"
      initialFocusId="strength-workout-only-choose"
      closeLabel="Return to workout details"
      dialogClassName="strength-workout-only-confirmation"
      portalToBody
      onClose={onClose}
    >
      <p>
        This workout will appear in History and update your muscle training status, but it won’t count toward Strength Health unless it’s linked to a Rhythm.
      </p>
      {error && <p className="strength-form-error" role="alert">{error}</p>}
      <div className="money-goal-dialog__actions">
        <button
          id="strength-workout-only-choose"
          type="button"
          className="btn mini ghost"
          onClick={onChooseRhythm}
        >
          Choose a Rhythm
        </button>
        <button type="button" className="btn mini" onClick={onSaveWorkoutOnly}>
          Save workout only
        </button>
      </div>
    </MoneyGoalDialog>
  );
}
