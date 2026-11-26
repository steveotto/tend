import { useState } from 'react';
import type { MouseEvent } from 'react';
import type {
  FoundationPreview,
  PersonId,
  PersonPickerGroup,
  PersonPreview,
  RhythmPreview
} from '../domain/preview-data.ts';
import type { RhythmScoreResult } from '../domain/rhythm-scoring.ts';
import { rhythmHealthScore } from '../domain/rhythm-scoring.ts';
import {
  defaultAllItemsFilters,
  selectArchivedRhythms,
  type AllItemsFilters,
  type AllItemsFrequencyFilter,
  type AllItemsPersonFilterValue,
  type AllItemsTimeFilter
} from '../domain/all-items.ts';
import { MultiSelectDropdown } from './MultiSelectDropdown.tsx';
import type { MultiSelectOption } from './MultiSelectDropdown.tsx';
import { RhythmScheduleGroups } from './RhythmScheduleGroups.tsx';
import { RhythmDetailsDialog } from './RhythmDetailsDialog.tsx';
import type { Destination } from './AppNavigation.tsx';
import { useRhythmTimeOptions } from './TimeBlocksContext.tsx';

const frequencyOptions: MultiSelectOption<Exclude<AllItemsFrequencyFilter, 'all'>>[] = [
  { value: 'not-scheduled', label: 'Not scheduled / Not applicable' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom interval' }
];

type ArchivedRhythmsPageProps = {
  rhythms: readonly RhythmPreview[];
  archivedRhythmIds: readonly string[];
  completedRhythmIds: ReadonlySet<string>;
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>;
  people: readonly PersonPreview[];
  peopleGroups: readonly PersonPickerGroup[];
  foundations: readonly FoundationPreview[];
  onRhythmHistory: (rhythmId: string, event: MouseEvent<HTMLButtonElement>) => void;
  onPersonSelect: (personId: PersonId) => void;
  onOpenCategory: (categoryId: Destination, openerId: string) => void;
  onOpenFoundation: (foundationId: string, openerId: string) => void;
  onEditRhythm: (rhythm: RhythmPreview, event: MouseEvent<HTMLButtonElement>) => void;
  onRestoreRhythm: (rhythmId: string) => void;
};

export function ArchivedRhythmsPage(props: ArchivedRhythmsPageProps) {
  const [filters, setFilters] = useState<AllItemsFilters>({
    ...defaultAllItemsFilters,
    type: ['rhythms']
  });
  const timeOptions = useRhythmTimeOptions();
  const archived = new Set(props.archivedRhythmIds);
  const archivedRhythms = selectArchivedRhythms(props.rhythms, archived, filters);
  const allArchivedCount = props.rhythms.filter(rhythm => archived.has(rhythm.id)).length;
  const hasActiveFilters = filters.person !== 'all'
    || filters.frequency !== 'all'
    || filters.timeOfDay !== 'all'
    || filters.search.trim().length > 0;
  const personOptions: MultiSelectOption<AllItemsPersonFilterValue>[] = [
    { value: 'none', label: 'No person' },
    ...[...props.people]
      .sort((left, right) => left.displayName.localeCompare(right.displayName) || left.id.localeCompare(right.id))
      .map(person => ({ value: person.id, label: person.displayName }))
  ];
  const timeFilterOptions: MultiSelectOption<Exclude<AllItemsTimeFilter, 'all'>>[] = [
    { value: 'not-applicable', label: 'No applicable time setting' },
    ...timeOptions
  ];

  return (
    <section className="archived-rhythms-page" aria-labelledby="archived-rhythms-heading">
      <h3 id="archived-rhythms-heading">Archived Rhythms</h3>
      <div className="archived-rhythms-page__search">
        <div className="utility-search-field">
          <span className="utility-search-icon" aria-hidden="true">⌕</span>
          <input
            type="search"
            placeholder="Search titles and details…"
            aria-label="Search titles and details"
            value={filters.search}
            onChange={event => {
              const search = event.currentTarget.value;
              setFilters(current => ({
                ...current,
                search
              }));
            }}
          />
          {filters.search && (
            <button
              type="button"
              className="utility-search-clear"
              aria-label="Clear search"
              onClick={() => setFilters(current => ({ ...current, search: '' }))}
            >
              ×
            </button>
          )}
        </div>
      </div>
      <div className="archived-rhythms-page__filters" aria-label="Filter archived Rhythms">
        <div className="all-items-filter">
          <span className="all-items-filter__label">Type</span>
          <button
            type="button"
            className="all-items-filter__trigger"
            aria-label="Type: Rhythms"
            disabled
          >
            <span className="all-items-filter__value">Rhythms</span>
          </button>
        </div>
        <MultiSelectDropdown
          label="Person"
          allLabel="All people"
          options={personOptions}
          value={filters.person}
          onChange={person => setFilters(current => ({ ...current, person }))}
        />
        <MultiSelectDropdown
          label="Frequency"
          allLabel="All frequencies"
          options={frequencyOptions}
          value={filters.frequency}
          onChange={frequency => setFilters(current => ({ ...current, frequency }))}
        />
        <MultiSelectDropdown
          label="Time of day"
          allLabel="All times"
          options={timeFilterOptions}
          value={filters.timeOfDay}
          onChange={timeOfDay => setFilters(current => ({ ...current, timeOfDay }))}
        />
      </div>
      <div className="archived-rhythms-page__results">
        <p role="status" aria-live="polite">
          {archivedRhythms.length} {archivedRhythms.length === 1 ? 'Rhythm' : 'Rhythms'}
        </p>
        <button
          type="button"
          className="btn mini ghost"
          disabled={!hasActiveFilters}
          onClick={() => setFilters({
            ...defaultAllItemsFilters,
            type: ['rhythms']
          })}
        >
          Clear filters
        </button>
      </div>
      {archivedRhythms.length === 0 ? (
        <p className="archived-rhythms-page__empty">
          {allArchivedCount === 0
            ? 'There are no archived Rhythms.'
            : 'No archived Rhythms match these filters. Clear filters to see everything.'}
        </p>
      ) : (
        <div className="archived-rhythms-page__groups">
          <section className="archived-rhythms-page__group" aria-labelledby="archived-rhythms-list-heading">
            <h4 id="archived-rhythms-list-heading">Rhythms ({archivedRhythms.length})</h4>
            <RhythmScheduleGroups
              rhythms={archivedRhythms}
              categoryToken="archived-rhythms"
              renderGroup={groupRhythms => (
                <ul className="archived-rhythms-page__list">
                  {groupRhythms.map(rhythm => (
                    <li key={rhythm.id}>
                      <RhythmDetailsDialog
                        rhythm={rhythm}
                        inline
                        completed={props.completedRhythmIds.has(rhythm.id)}
                        healthScore={rhythmHealthScore(props.rhythmScores.get(rhythm.id))}
                        people={props.people}
                        foundations={props.foundations}
                        relatedRhythms={props.rhythms.filter(item => archived.has(item.id))}
                        archived
                        archivedRhythmIds={props.archivedRhythmIds}
                        onPersonSelect={props.onPersonSelect}
                        onOpenCategory={props.onOpenCategory}
                        onOpenFoundation={props.onOpenFoundation}
                        onHistory={event => props.onRhythmHistory(rhythm.id, event)}
                        onEdit={event => props.onEditRhythm(rhythm, event)}
                        showInlineEdit
                        onClose={() => undefined}
                      />
                      <button
                        type="button"
                        className="archived-rhythms-dialog__restore"
                        aria-label={`Restore rhythm ${rhythm.title}`}
                        onClick={() => props.onRestoreRhythm(rhythm.id)}
                      >
                        Restore rhythm
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            />
          </section>
        </div>
      )}
    </section>
  );
}
