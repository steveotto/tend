import type { RhythmPreview } from '../domain/preview-data.ts';
import type { RhythmCompletionRecord } from '../domain/rhythm-completion.ts';
import type { PersonId, PersonPreview } from '../domain/preview-data.ts';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { RhythmCompletionForm } from './RhythmCompletionForm.tsx';

export function RhythmCompletionDialog({
  rhythm,
  people = [],
  onSave,
  onClose
}: {
  rhythm: RhythmPreview;
  people?: readonly PersonPreview[];
  onSave: (record: RhythmCompletionRecord, connectionParticipantIds?: PersonId[]) => string | null;
  onClose: () => void;
}) {
  return (
    <MoneyGoalDialog
      closeLabel="Close completion"
      labelledBy="rhythm-completion-heading"
      initialFocusId="rhythm-completion-heading"
      surfaceClassName="money-goal-dialog__surface--flush"
      phoneFullScreen
      scrollableBody
      onClose={onClose}
    >
      <RhythmCompletionForm
        rhythm={rhythm}
        people={people}
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
