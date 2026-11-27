import { useState } from 'react';
import type { MouseEvent } from 'react';
import { effectiveRhythmSchedule } from '../domain/rhythm-schedule.ts';
import type { PersonPrayerLog, PersonPrayerLogUndo, PersonPrayerRequest, PersonPrayerRequestDraft, PrayerRequestTransition } from '../domain/person-prayers.ts';
import type { PersonSpark, PersonSparkDraft } from '../domain/person-sparks.ts';
import {
  type FoundationPreview,
  type PersonId,
  type PersonPickerGroup,
  type PersonPreview,
  type RhythmPreview
} from '../domain/preview-data.ts';
import type { FriendshipData } from '../domain/friendships.ts';
import { defaultAllItemsFilters, orderAllItems, selectAllItems } from '../domain/all-items.ts';
import { rhythmHealthScore } from '../domain/rhythm-scoring.ts';
import type { RhythmScoreResult } from '../domain/rhythm-scoring.ts';
import type {
  AllItemsFilters,
  AllItemsFrequencyFilter,
  AllItemsPersonFilterValue,
  AllItemsSortDirection,
  AllItemsSortField,
  AllItemsTimeFilter,
  AllItemsTypeFilter
} from '../domain/all-items.ts';
import { PersonSparkPanel } from './PersonSparkPanel.tsx';
import { PersonPrayerPanel } from './PersonPrayerPanel.tsx';
import { RhythmDetailsDialog } from './RhythmDetailsDialog.tsx';
import { RhythmScheduleGroups } from './RhythmScheduleGroups.tsx';
import type { Destination } from './AppNavigation.tsx';
import { useRhythmTimeOptions } from './TimeBlocksContext.tsx';
import { MultiSelectDropdown } from './MultiSelectDropdown.tsx';
import type { MultiSelectOption } from './MultiSelectDropdown.tsx';
import { StyledSelect } from './StyledSelect.tsx';
import type { StyledSelectOption } from './StyledSelect.tsx';

const typeOptions: MultiSelectOption<Exclude<AllItemsTypeFilter, 'all'>>[] = [
  { value: 'rhythms', label: 'Rhythms' },
  { value: 'sparks', label: 'Sparks' },
  { value: 'prayer-requests', label: 'Prayer requests' }
];

const frequencyOptions: MultiSelectOption<Exclude<AllItemsFrequencyFilter, 'all'>>[] = [
  { value: 'not-scheduled', label: 'Not scheduled / Not applicable' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom interval' }
];

const sortFieldOptions: readonly StyledSelectOption<AllItemsSortField>[] = [
  { value: 'grouped', label: 'Grouped presentation' },
  { value: 'title', label: 'Title' },
  { value: 'type', label: 'Type' },
  { value: 'person', label: 'Person name' },
  { value: 'time-of-day', label: 'Time of day' },
  { value: 'frequency', label: 'Frequency' }
];

const sortDirectionOptions: readonly StyledSelectOption<AllItemsSortDirection>[] = [
  { value: 'ascending', label: 'Ascending' },
  { value: 'descending', label: 'Descending' }
];

type AllItemsPageProps = {
  rhythms: readonly RhythmPreview[];
  completedRhythmIds: ReadonlySet<string>;
  archivedRhythmIds: readonly string[];
  sparks: readonly PersonSpark[];
  prayerRequests: readonly PersonPrayerRequest[];
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>;
  people: readonly PersonPreview[];
  peopleGroups: readonly PersonPickerGroup[];
  foundations: readonly FoundationPreview[];
  friendships: FriendshipData;
  today: string;
  timeZone: string;
  prayerEnabled: boolean;
  onRhythmHistory: (rhythmId: string, event: MouseEvent<HTMLButtonElement>) => void;
  onTendRhythm: (rhythmId: string, event: MouseEvent<HTMLButtonElement>) => void;
  onUndoRhythm: (rhythmId: string) => void;
  onPersonSelect: (personId: PersonId) => void;
  onOpenCategory: (categoryId: Destination, openerId: string) => void;
  onOpenFoundation: (foundationId: string, openerId: string) => void;
  onCreateSpark: (ownerId: PersonId, draft: PersonSparkDraft) => string | null;
  onUpdateSpark: (sparkId: string, draft: PersonSparkDraft) => string | null;
  onArchiveSpark: (sparkId: string, archived: boolean) => string | null;
  onDeleteSpark: (sparkId: string, viewerId: PersonId) => string | null;
  onUndoSpark: (sparkId: string) => string | null;
  onCompleteSpark: (spark: PersonSpark, opener: HTMLButtonElement) => void;
  onCreatePrayerRequest: (personId: PersonId, draft: PersonPrayerRequestDraft) => string | null;
  onRetryLocalSave?: () => Promise<string | null>;
  onUpdatePrayerRequest: (
    requestId: string,
    expectedUpdatedAt: string,
    actorId: PersonId | null,
    draft: PersonPrayerRequestDraft
  ) => string | null;
  onPrayerRequestTransition: (
    requestId: string,
    expectedUpdatedAt: string,
    actorId: PersonId | null,
    transition: PrayerRequestTransition
  ) => string | null;
  onPrayForRequest: (requestId: string, expectedUpdatedAt: string, actorId: PersonId | null) => string | null;
  onSavePrayerLog?: (
    requestId: string,
    expectedUpdatedAt: string,
    actorId: PersonId | null,
    log: PersonPrayerLog
  ) => string | null;
  onDeletePrayerLog?: (
    requestId: string,
    expectedUpdatedAt: string,
    actorId: PersonId | null,
    logId: string
  ) => PersonPrayerLogUndo | string;
  onUndoDeletePrayerLog?: (undo: PersonPrayerLogUndo, actorId: PersonId | null) => string | null;
  onRemovePrayerRequest: (requestId: string, expectedUpdatedAt: string, actorId: PersonId | null) => string | null;
};

export function AllItemsPage(props: AllItemsPageProps) {
  const [filters, setFilters] = useState<AllItemsFilters>({
    ...defaultAllItemsFilters
  });
  const [sortField, setSortField] = useState<AllItemsSortField>('grouped');
  const [sortDirection, setSortDirection] = useState<AllItemsSortDirection>('ascending');
  const timeOptions = useRhythmTimeOptions();
  const archivedRhythmIds = new Set(props.archivedRhythmIds);
  const activeRhythms = props.rhythms.filter(rhythm => !archivedRhythmIds.has(rhythm.id));
  const selection = selectAllItems({
    rhythms: props.rhythms,
    archivedRhythmIds,
    sparks: props.sparks,
    prayerRequests: props.prayerRequests
  }, filters);
  const orderedItems = orderAllItems(
    selection,
    { field: sortField, direction: sortDirection },
    props.people,
    timeOptions
  );
  const totalItems = activeRhythms.length
    + props.sparks.length
    + props.prayerRequests.length;
  const hasActiveFilters = filters.type !== 'all'
    || filters.person !== 'all'
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

  function renderRhythm(rhythm: RhythmPreview) {
    const completed = props.completedRhythmIds.has(rhythm.id);
    const schedule = effectiveRhythmSchedule(rhythm.schedule, rhythm.cadence);
    const isInactive = Boolean(schedule?.endDate && schedule.endDate < props.today);
    return (
      <RhythmDetailsDialog
        rhythm={rhythm}
        inline
        completed={completed}
        healthScore={rhythmHealthScore(props.rhythmScores.get(rhythm.id))}
        people={props.people}
        foundations={props.foundations}
        relatedRhythms={activeRhythms}
        onPersonSelect={props.onPersonSelect}
        onOpenCategory={props.onOpenCategory}
        onOpenFoundation={props.onOpenFoundation}
        onHistory={event => props.onRhythmHistory(rhythm.id, event)}
        {...(isInactive ? { statusLabel: 'Inactive' } : {})}
        {...(!isInactive ? {
          onTend: (event: MouseEvent<HTMLButtonElement>) => props.onTendRhythm(rhythm.id, event)
        } : {})}
        {...(!isInactive && completed
          ? { onUndo: () => props.onUndoRhythm(rhythm.id) }
          : {})}
        onClose={() => undefined}
      />
    );
  }

  function renderSparkPanel(sparks: readonly PersonSpark[], entry = false) {
    const firstSpark = sparks[0];
    if (!firstSpark) return null;
    return (
      <PersonSparkPanel
        personId={firstSpark.ownerId}
        people={props.people}
        peopleGroups={props.peopleGroups}
        sparks={sparks}
        friendships={props.friendships}
        today={props.today}
        onCreate={draft => props.onCreateSpark(firstSpark.ownerId, draft)}
        onUpdate={props.onUpdateSpark}
        onArchive={props.onArchiveSpark}
        onDelete={props.onDeleteSpark}
        onUndo={props.onUndoSpark}
        onComplete={props.onCompleteSpark}
        onPersonSelect={props.onPersonSelect}
        allItems
        {...(entry ? { allItemsEntry: true } : {})}
      />
    );
  }

  function renderPrayerPanel(requests: readonly PersonPrayerRequest[], entry = false) {
    const firstRequest = requests[0];
    if (!firstRequest) return null;
    return (
      <PersonPrayerPanel
        personId={firstRequest.personId}
        enabled={props.prayerEnabled}
        today={props.today}
        timeZone={props.timeZone}
        people={props.people}
        peopleGroups={props.peopleGroups}
        requests={requests}
        allPrayerRequests={props.prayerRequests}
        onCreate={props.onCreatePrayerRequest}
        {...(props.onRetryLocalSave ? { onRetryLocalSave: props.onRetryLocalSave } : {})}
        onUpdate={props.onUpdatePrayerRequest}
        onTransition={props.onPrayerRequestTransition}
        onPray={props.onPrayForRequest}
        {...(props.onSavePrayerLog ? { onSaveLog: props.onSavePrayerLog } : {})}
        {...(props.onDeletePrayerLog ? { onDeleteLog: props.onDeletePrayerLog } : {})}
        {...(props.onUndoDeletePrayerLog ? { onUndoDeleteLog: props.onUndoDeletePrayerLog } : {})}
        onRemove={props.onRemovePrayerRequest}
        allItems
        {...(entry ? { allItemsEntry: true } : {})}
      />
    );
  }

  return (
    <section className="all-items-page" aria-labelledby="all-items-heading">
      <h3 id="all-items-heading">All items</h3>
      <div className="all-items-page__search">
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
      <div className="all-items-page__filters" aria-label="Filter all items">
        <MultiSelectDropdown
          label="Type"
          allLabel="All types"
          options={typeOptions}
          value={filters.type}
          onChange={type => setFilters(current => ({ ...current, type }))}
        />
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
      <div className="all-items-page__sorting" aria-label="Sort all items">
        <div className="all-items-page__sort-control">
          <span>Sort by</span>
          <StyledSelect
            label="Sort by"
            options={sortFieldOptions}
            value={sortField}
            onChange={setSortField}
          />
        </div>
        <div className="all-items-page__sort-control">
          <span>Direction</span>
          <StyledSelect
            label="Sort direction"
            options={sortDirectionOptions}
            value={sortDirection}
            disabled={sortField === 'grouped'}
            onChange={setSortDirection}
          />
        </div>
      </div>
      <div className="all-items-page__results">
        <p role="status" aria-live="polite">
          {selection.count} {selection.count === 1 ? 'item' : 'items'}
        </p>
        <button
          type="button"
          className="btn mini ghost"
          disabled={!hasActiveFilters}
          onClick={() => setFilters({ ...defaultAllItemsFilters })}
        >
          Clear filters
        </button>
      </div>
      {selection.count === 0 ? (
        <p className="all-items-page__empty">
          {totalItems === 0
            ? 'There are no items to show.'
            : 'No items match these filters. Clear filters to see everything.'}
        </p>
      ) : (
        sortField === 'grouped' ? <div className="all-items-page__groups">
          {selection.rhythms.length > 0 && (
            <section className="all-items-page__group" aria-labelledby="all-items-rhythms-heading">
              <h4 id="all-items-rhythms-heading">Rhythms ({selection.rhythms.length})</h4>
              <RhythmScheduleGroups
                rhythms={selection.rhythms}
                categoryToken="all-items-rhythms"
                renderGroup={groupRhythms => (
                  <ul className="all-items-page__list">
                    {groupRhythms.map(rhythm => (
                      <li key={rhythm.id}>{renderRhythm(rhythm)}</li>
                    ))}
                  </ul>
                )}
              />
            </section>
          )}
          {selection.sparks.length > 0 && (
            <section className="all-items-page__group" aria-labelledby="all-items-sparks-heading">
              <h4 id="all-items-sparks-heading">Sparks ({selection.sparks.length})</h4>
              {renderSparkPanel(selection.sparks)}
            </section>
          )}
          {selection.prayerRequests.length > 0 && (
            <section className="all-items-page__group" aria-labelledby="all-items-prayer-heading">
              <h4 id="all-items-prayer-heading">Prayer requests ({selection.prayerRequests.length})</h4>
              {renderPrayerPanel(selection.prayerRequests)}
            </section>
          )}
        </div> : (
          <section className="all-items-page__sorted-items" aria-label="Sorted all items">
            {orderedItems.map(entry => (
              <div className="all-items-page__sorted-entry" key={`${entry.kind}:${entry.item.id}`}>
                {entry.kind === 'rhythm'
                  ? renderRhythm(entry.item)
                  : entry.kind === 'spark'
                    ? renderSparkPanel([entry.item], true)
                    : renderPrayerPanel([entry.item], true)}
              </div>
            ))}
          </section>
        )
      )}
    </section>
  );
}
