import type { RhythmPreview } from '../domain/preview-data.ts';
import type { RhythmCompletionRecord } from '../domain/rhythm-completion.ts';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { RhythmCompletionForm } from './RhythmCompletionForm.tsx';

export function RhythmCompletionDialog({
  rhythm,
  onSave,
  onClose
}: {
  rhythm: RhythmPreview;
  onSave: (record: RhythmCompletionRecord) => string | null;
  onClose: () => void;
}) {
  return (
    <MoneyGoalDialog
      closeLabel="Close completion"
      labelledBy="rhythm-completion-heading"
      initialFocusId="rhythm-completion-heading"
      surfaceClassName="money-goal-dialog__surface--flush"
      onClose={onClose}
    >
      <RhythmCompletionForm
        rhythm={rhythm}
        embedded
        dialogLayout
        headingId="rhythm-completion-heading"
        onSave={onSave}
        onCancel={onClose}
        onSaved={onClose}
      />
    </MoneyGoalDialog>
  );
}
