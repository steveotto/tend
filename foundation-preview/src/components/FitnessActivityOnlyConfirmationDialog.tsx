import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';

type Props = {
  description: string;
  error?: string;
  titleId: string;
  initialFocusId: string;
  closeLabel: string;
  dialogClassName?: string;
  chooseButtonLabel: string;
  saveButtonLabel: string;
  onChooseRhythm: () => void;
  onSaveActivityOnly: () => void;
  onClose: () => void;
};

export function FitnessActivityOnlyConfirmationDialog({
  description,
  error,
  titleId,
  initialFocusId,
  closeLabel,
  dialogClassName = 'fitness-activity-only-confirmation',
  chooseButtonLabel,
  saveButtonLabel,
  onChooseRhythm,
  onSaveActivityOnly,
  onClose
}: Props) {
  return (
    <MoneyGoalDialog
      title="Save without a Rhythm?"
      labelledBy={titleId}
      titleId={titleId}
      initialFocusId={initialFocusId}
      closeLabel={closeLabel}
      dialogClassName={dialogClassName}
      portalToBody
      onClose={onClose}
    >
      <p>{description}</p>
      {error && <p className="strength-form-error" role="alert">{error}</p>}
      <div className="money-goal-dialog__actions">
        <button
          id={initialFocusId}
          type="button"
          className="btn mini ghost"
          onClick={onChooseRhythm}
        >
          {chooseButtonLabel}
        </button>
        <button type="button" className="btn mini" onClick={onSaveActivityOnly}>
          {saveButtonLabel}
        </button>
      </div>
    </MoneyGoalDialog>
  );
}
