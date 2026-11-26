import type { MouseEvent, ReactNode } from 'react';
import { syntheticPeople } from '../domain/preview-data.ts';
import type { FoundationPreview, PersonId, PersonPreview, RhythmPreview } from '../domain/preview-data.ts';
import type { Destination } from './AppNavigation.tsx';
import type { RhythmScoreResult } from '../domain/rhythm-scoring.ts';
import { isEditableRhythmId } from '../domain/rhythm-editor.ts';
import { rhythmLastActivityLabel } from '../domain/preview-data.ts';
import { rhythmHealthScore } from '../domain/rhythm-scoring.ts';
import { RhythmDetailsDialog } from './RhythmDetailsDialog.tsx';
import { ArchivedRhythmsControl } from './ArchivedRhythmsControl.tsx';
import { RhythmScheduleGroups } from './RhythmScheduleGroups.tsx';

type Props = {
  people?: readonly PersonPreview[];
  categoryLabel: string;
  categoryToken: string;
  subtitle?: string;
  rhythms: readonly RhythmPreview[];
  archivedRhythms: readonly RhythmPreview[];
  todayDate: string;
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>;
  completedRhythms: ReadonlySet<string>;
  undoableRhythms: ReadonlySet<string>;
  foundations: readonly FoundationPreview[];
  archivedRhythmsOpenerRef: { current: HTMLElement | null };
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
  completionActionAccessibleLabelFor?: (rhythm: RhythmPreview) => string;
  completedActionLabelFor?: (rhythm: RhythmPreview) => string;
  renderAdditionalActions?: (rhythm: RhythmPreview) => ReactNode;
};

export function CategoryRhythmCollection({
  people = syntheticPeople,
  categoryLabel,
  categoryToken,
  subtitle,
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
  completionActionAccessibleLabelFor,
  completedActionLabelFor,
  renderAdditionalActions
}: Props) {
  return (
    <section className="marriage-rhythm-section" aria-labelledby={`${categoryToken}-rhythm-section-title`}>
      <div className="marriage-section-heading">
        <div>
          <h3 id={`${categoryToken}-rhythm-section-title`}>Your Rhythms</h3>
          <p>{subtitle ?? `Active Rhythms connected to ${categoryLabel}.`}</p>
        </div>
      </div>
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
      <RhythmScheduleGroups
        rhythms={rhythms}
        categoryToken={categoryToken}
        emptyCollectionMessage={rhythms.length === 0
          ? <h4 className="marriage-empty-state">Start with a rhythm.</h4>
          : undefined}
        renderGroup={groupRhythms => (
          <div className="marriage-rhythm-list">
            {groupRhythms.map(rhythm => (
              <div className="marriage-rhythm-entry" key={rhythm.id}>
                <RhythmDetailsDialog
                  rhythm={rhythm}
                  inline
                  statusLabel={rhythmLastActivityLabel(rhythm, todayDate)}
                  completed={completedRhythms.has(rhythm.id)}
                  people={people}
                  foundations={foundations}
                  relatedRhythms={rhythms}
                  onPersonSelect={onPersonSelect}
                  onOpenFoundation={onOpenFoundation}
                  onOpenCategory={onOpenCategory}
                  headingId={`${categoryToken}-active-rhythm-${rhythm.id}`}
                  archived={false}
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
                  onHistory={event => onRhythmHistory(rhythm.id, event)}
                  {...(isEditableRhythmId(rhythm.id)
                    ? {
                        onTend: (event: MouseEvent<HTMLButtonElement>) => onTend(rhythm.id, event),
                        onEdit: (event: MouseEvent<HTMLButtonElement>) => onEditRhythm(rhythm, event),
                        ...(undoableRhythms.has(rhythm.id) && !rhythm.healthLogCapability
                          ? { onUndo: () => onUndo(rhythm.id) }
                          : {})
                      }
                    : {})}
                  onClose={() => undefined}
                />
                {renderAdditionalActions?.(rhythm)}
              </div>
            ))}
          </div>
        )}
      />
      <ArchivedRhythmsControl
        count={archivedRhythms.length}
        openerRef={archivedRhythmsOpenerRef}
        expanded={showArchivedRhythms}
        onOpen={onShowArchivedRhythms}
      />
    </section>
  );
}
