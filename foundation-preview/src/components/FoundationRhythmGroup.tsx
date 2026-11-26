import type { MouseEvent } from 'react';
import type { Destination } from './AppNavigation.tsx';
import { isEditableRhythmId } from '../domain/rhythm-editor.ts';
import { type FoundationPreview, type PersonId, type PersonPreview, type RhythmPreview } from '../domain/preview-data.ts';
import { rhythmHealthScore } from '../domain/rhythm-scoring.ts';
import type { RhythmScoreResult } from '../domain/rhythm-scoring.ts';
import { RhythmDetailsDialog } from './RhythmDetailsDialog.tsx';
import { RhythmScheduleGroups } from './RhythmScheduleGroups.tsx';

type Props = {
  people: readonly PersonPreview[];
  rhythms: readonly RhythmPreview[];
  archivedRhythmIds: readonly string[];
  headingId: string;
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>;
  completedRhythms: ReadonlySet<string>;
  undoableRhythms: ReadonlySet<string>;
  foundations: readonly FoundationPreview[];
  categoryToken: string;
  onTend?: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onUndo?: (id: string) => void;
  onEditRhythm?: (rhythm: RhythmPreview, event: MouseEvent<HTMLButtonElement>) => void;
  onRhythmHistory?: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onPersonSelect?: (personId: PersonId) => void;
  onOpenFoundation?: (foundationId: string, openerId: string) => void;
  onOpenCategory?: (categoryId: Destination, openerId: string) => void;
  completionActionLabelFor?: (rhythm: RhythmPreview) => string;
  completionActionAccessibleLabelFor?: (rhythm: RhythmPreview) => string;
  completedActionLabelFor?: (rhythm: RhythmPreview) => string;
};

export function FoundationRhythmGroup({
  people,
  rhythms,
  archivedRhythmIds,
  headingId,
  rhythmScores,
  completedRhythms,
  undoableRhythms,
  onTend,
  onUndo,
  onEditRhythm,
  onRhythmHistory,
  onPersonSelect,
  foundations,
  categoryToken,
  onOpenFoundation,
  onOpenCategory,
  completionActionLabelFor,
  completionActionAccessibleLabelFor,
  completedActionLabelFor
}: Props) {
  return (
    <section className="marriage-foundation-support-group" aria-labelledby={headingId}>
      <RhythmScheduleGroups
        rhythms={rhythms}
        categoryToken={`${categoryToken}-${headingId}`}
        renderGroup={groupRhythms => (
          <div className="marriage-rhythm-list current-plan-item-group">
            {groupRhythms.map(rhythm => {
              const archived = archivedRhythmIds.includes(rhythm.id);
              return (
                <RhythmDetailsDialog
                  key={rhythm.id}
                  rhythm={rhythm}
                  inline
                  completed={completedRhythms.has(rhythm.id)}
                  people={people}
                  foundations={foundations}
                  relatedRhythms={rhythms}
                  {...(onPersonSelect ? { onPersonSelect } : {})}
                  {...(onOpenFoundation ? { onOpenFoundation } : {})}
                  {...(onOpenCategory ? { onOpenCategory } : {})}
                  archived={archived}
                  headingId={`${categoryToken}-detail-rhythm-${rhythm.id}`}
                  healthScore={rhythmHealthScore(rhythmScores.get(rhythm.id))}
                  {...(completionActionLabelFor
                    ? { completionActionLabel: completionActionLabelFor(rhythm) }
                    : {})}
                  {...(completionActionAccessibleLabelFor
                    ? { completionActionAccessibleLabel: completionActionAccessibleLabelFor(rhythm) }
                    : {})}
                  {...(completedActionLabelFor
                    ? { completedActionLabel: completedActionLabelFor(rhythm) }
                    : {})}
                  {...(onRhythmHistory
                    ? { onHistory: (event: MouseEvent<HTMLButtonElement>) => onRhythmHistory(rhythm.id, event) }
                    : {})}
                  {...(!archived && isEditableRhythmId(rhythm.id)
                    ? {
                        ...(onTend
                          ? { onTend: (event: MouseEvent<HTMLButtonElement>) => onTend(rhythm.id, event) }
                          : {}),
                        ...(onEditRhythm
                          ? { onEdit: (event: MouseEvent<HTMLButtonElement>) => onEditRhythm(rhythm, event) }
                          : {}),
                        ...(undoableRhythms.has(rhythm.id) && onUndo
                          ? { onUndo: () => onUndo(rhythm.id) }
                          : {})
                      }
                    : {})}
                  onClose={() => undefined}
                />
              );
            })}
          </div>
        )}
      />
    </section>
  );
}
