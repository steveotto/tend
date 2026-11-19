import { FitnessActivityOnlyConfirmationDialog } from './FitnessActivityOnlyConfirmationDialog.tsx';

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
    <FitnessActivityOnlyConfirmationDialog
      description="This workout will appear in History and update your muscle training status, but it won’t count toward Strength Health unless it’s linked to a Rhythm."
      titleId="strength-workout-only-confirmation-title"
      initialFocusId="strength-workout-only-choose"
      closeLabel="Return to workout details"
      dialogClassName="fitness-activity-only-confirmation strength-workout-only-confirmation"
      chooseButtonLabel="Choose a Rhythm"
      saveButtonLabel="Save workout only"
      {...(error ? { error } : {})}
      onChooseRhythm={onChooseRhythm}
      onSaveActivityOnly={onSaveWorkoutOnly}
      onClose={onClose}
    />
  );
}
