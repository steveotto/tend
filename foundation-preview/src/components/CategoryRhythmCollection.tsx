import type { MouseEvent, ReactNode, RefObject } from 'react';
import type { FoundationPreview, PersonId, RhythmPreview } from '../domain/preview-data.ts';
import type { CategoryRhythmGroupId } from '../domain/category-rhythms.ts';
import type { Destination } from './AppNavigation.tsx';
import type { RhythmScoreResult } from '../domain/rhythm-scoring.ts';
import { categoryRhythmGroup } from '../domain/category-rhythms.ts';
import { isEditableRhythmId } from '../domain/rhythm-editor.ts';
import { peopleForRhythm, rhythmLastActivityLabel } from '../domain/preview-data.ts';
import { rhythmHealthScore } from '../domain/rhythm-scoring.ts';
import { RhythmDetailsDialog } from './RhythmDetailsDialog.tsx';

type Props = {
  categoryLabel: string;
  categoryToken: string;
  rhythms: readonly RhythmPreview[];
  archivedRhythms: readonly RhythmPreview[];
  todayDate: string;
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>;
  completedRhythms: ReadonlySet<string>;
  undoableRhythms: ReadonlySet<string>;
  foundations: readonly FoundationPreview[];
  archivedRhythmsOpenerRef: RefObject<HTMLButtonElement | null>;
  showArchivedRhythms: boolean;
  onAddRhythm: (event: MouseEvent<HTMLButtonElement>) => void;
  onBrowseSuggestions?: (event: MouseEvent<HTMLButtonElement>) => void;
  suggestionsUnavailableReason?: string;
  onShowArchivedRhythms: () => void;
  onPersonSelect: (personId: PersonId) => void;
  onOpenFoundation: (foundationId: string, openerId: string) => void;
  onOpenCategory: (categoryId: Destination, openerId: string) => void;
  onRhythmHistory: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onEditRhythm: (rhythm: RhythmPreview, event: MouseEvent<HTMLButtonElement>) => void;
  onTend: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onUndo: (id: string) => void;
  completionActionLabelFor?: (rhythm: RhythmPreview) => string;
  completedActionLabelFor?: (rhythm: RhythmPreview) => string;
  renderAdditionalActions?: (rhythm: RhythmPreview) => ReactNode;
};

const groups = [
  { id: 'daily', title: 'Daily' },
  { id: 'weekly', title: 'Weekly' },
  { id: 'seasonal', title: 'Seasonal & Annual' }
] as const;

export function CategoryRhythmCollection({
  categoryLabel,
  categoryToken,
  rhythms,
  archivedRhythms,
  todayDate,
  rhythmScores,
  completedRhythms,
  undoableRhythms,
  foundations,
  archivedRhythmsOpenerRef,
  showArchivedRhythms,
  onAddRhythm,
  onBrowseSuggestions,
  suggestionsUnavailableReason,
  onShowArchivedRhythms,
  onPersonSelect,
  onOpenFoundation,
  onOpenCategory,
  onRhythmHistory,
  onEditRhythm,
  onTend,
  onUndo,
  completionActionLabelFor,
  completedActionLabelFor,
  renderAdditionalActions
}: Props) {
  const groupedRhythms: Array<{ id: CategoryRhythmGroupId; title: string; rhythms: RhythmPreview[] }> = groups.map(group => ({
    ...group,
    rhythms: rhythms.filter(rhythm => categoryRhythmGroup(rhythm) === group.id)
  }));
  if (rhythms.some(rhythm => categoryRhythmGroup(rhythm) === 'custom')) {
    groupedRhythms.push({
      id: 'custom',
      title: 'Custom schedule',
      rhythms: rhythms.filter(rhythm => categoryRhythmGroup(rhythm) === 'custom')
    });
  }

  return (
    <section className="marriage-rhythm-section" aria-labelledby={`${categoryToken}-rhythm-section-title`}>
      <div className="marriage-section-heading">
        <div>
          <h3 id={`${categoryToken}-rhythm-section-title`}>Your Rhythms</h3>
          <p>Active Rhythms connected to {categoryLabel}.</p>
        </div>
      </div>
      <div className="marriage-empty-state">
        <h4>{rhythms.length === 0 ? 'Start with a rhythm.' : 'Add a rhythm.'}</h4>
        <div className="category-rhythm-entry-actions">
          <button type="button" className="btn mini" onClick={onAddRhythm}>Add Rhythm</button>
          <button
            type="button"
            className="btn mini ghost"
            onClick={onBrowseSuggestions}
            disabled={!onBrowseSuggestions}
            {...(!onBrowseSuggestions && suggestionsUnavailableReason
              ? {
                  'aria-describedby': `${categoryToken}-suggestions-unavailable`,
                  title: suggestionsUnavailableReason
                }
              : {})}
          >
            Suggestions
          </button>
          {!onBrowseSuggestions && suggestionsUnavailableReason && (
            <span className="visually-hidden" id={`${categoryToken}-suggestions-unavailable`}>
              {suggestionsUnavailableReason}
            </span>
          )}
        </div>
      </div>
      {groupedRhythms.map(group => (
        <section key={group.id} className="marriage-recommendation-group" aria-labelledby={`${categoryToken}-group-${group.id}`}>
          <header><h4 id={`${categoryToken}-group-${group.id}`}>{group.title}</h4><span>{group.rhythms.length}</span></header>
          {group.rhythms.length
            ? (
              <div className="marriage-rhythm-list">
                {group.rhythms.map(rhythm => (
                  <div className="marriage-rhythm-entry" key={rhythm.id}>
                    <RhythmDetailsDialog
                      rhythm={rhythm}
                      inline
                      statusLabel={rhythmLastActivityLabel(rhythm, todayDate)}
                      completed={completedRhythms.has(rhythm.id)}
                      people={peopleForRhythm(rhythm)}
                      foundations={foundations}
                      onPersonSelect={onPersonSelect}
                      onOpenFoundation={onOpenFoundation}
                      onOpenCategory={onOpenCategory}
                      headingId={`${categoryToken}-active-rhythm-${rhythm.id}`}
                      archived={false}
                      healthScore={rhythmHealthScore(rhythmScores.get(rhythm.id))}
                      {...(completionActionLabelFor
                        ? { completionActionLabel: completionActionLabelFor(rhythm) }
                        : {})}
                      {...(completedActionLabelFor
                        ? { completedActionLabel: completedActionLabelFor(rhythm) }
                        : {})}
                      onHistory={event => onRhythmHistory(rhythm.id, event)}
                      {...(isEditableRhythmId(rhythm.id)
                        ? {
                            onTend: (event: MouseEvent<HTMLButtonElement>) => onTend(rhythm.id, event),
                            onEdit: (event: MouseEvent<HTMLButtonElement>) => onEditRhythm(rhythm, event),
                            ...(undoableRhythms.has(rhythm.id) ? { onUndo: () => onUndo(rhythm.id) } : {})
                          }
                        : {})}
                      onClose={() => undefined}
                    />
                    {renderAdditionalActions?.(rhythm)}
                  </div>
                ))}
              </div>
            )
            : <p className="marriage-empty-state">No active Rhythms.</p>}
        </section>
      ))}
      <button
        ref={archivedRhythmsOpenerRef}
        type="button"
        className="category-archived-rhythms-toggle"
        aria-expanded={showArchivedRhythms}
        aria-haspopup="dialog"
        aria-controls="archived-rhythms-dialog"
        onClick={onShowArchivedRhythms}
      >
        Archived rhythms ({archivedRhythms.length})
      </button>
    </section>
  );
}
