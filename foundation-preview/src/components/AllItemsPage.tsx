import { useState } from 'react';
import type { MouseEvent } from 'react';
import { effectiveRhythmSchedule, rhythmTimeLabel, rhythmTimeValueFromLegacyLabel } from '../domain/rhythm-schedule.ts';
import type { PersonPrayerLog, PersonPrayerLogUndo, PersonPrayerRequest, PersonPrayerRequestDraft, PrayerRequestTransition } from '../domain/person-prayers.ts';
import type { PersonSpark, PersonSparkDraft } from '../domain/person-sparks.ts';
import { rhythmLastTendedLabel } from '../domain/preview-data.ts';
import type { FoundationPreview, PersonId, PersonPickerGroup, PersonPreview, RhythmPreview } from '../domain/preview-data.ts';
import type { FriendshipData } from '../domain/friendships.ts';
import { selectAllItems } from '../domain/all-items.ts';
import type { AllItemsFrequencyFilter, AllItemsFilters } from '../domain/all-items.ts';
import { PersonSparkPanel } from './PersonSparkPanel.tsx';
import { PersonPrayerPanel } from './PersonPrayerPanel.tsx';
import { RhythmCard } from './Cards.tsx';
import type { Destination } from './AppNavigation.tsx';
import { useRhythmTimeOptions } from './TimeBlocksContext.tsx';

const frequencyOptions: { value: AllItemsFrequencyFilter; label: string }[] = [
  { value: 'all', label: 'All frequencies' },
  { value: 'not-scheduled', label: 'Not scheduled / Not applicable' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom interval' }
];

type AllItemsPageProps = {
  rhythms: readonly RhythmPreview[];
  completedRhythmIds: ReadonlySet<string>;
  archivedRhythmIds: readonly string[];
  sparks: readonly PersonSpark[];
  prayerRequests: readonly PersonPrayerRequest[];
  people: readonly PersonPreview[];
  peopleGroups: readonly PersonPickerGroup[];
  foundations: readonly FoundationPreview[];
  friendships: FriendshipData;
  today: string;
  timeZone: string;
  prayerEnabled: boolean;
  onEditRhythm: (rhythm: RhythmPreview, event: MouseEvent<HTMLButtonElement>) => void;
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
    type: 'all',
    person: 'all',
    frequency: 'all',
    timeOfDay: 'all'
  });
  const timeOptions = useRhythmTimeOptions();
  const selection = selectAllItems({
    rhythms: props.rhythms,
    sparks: props.sparks,
    prayerRequests: props.prayerRequests
  }, filters);
  const totalItems = props.rhythms.length + props.sparks.length + props.prayerRequests.length;
  const hasActiveFilters = filters.type !== 'all'
    || filters.person !== 'all'
    || filters.frequency !== 'all'
    || filters.timeOfDay !== 'all';
  const timeValues = timeOptions.map(option => option.value);

  function updateType(value: string) {
    if (value === 'all' || value === 'rhythms' || value === 'sparks' || value === 'prayer-requests') {
      setFilters(current => ({ ...current, type: value }));
    }
  }

  function updatePerson(value: string) {
    if (value === 'all' || value === 'none') {
      setFilters(current => ({ ...current, person: value }));
    } else {
      const person = props.people.find(item => item.id === value);
      if (person) setFilters(current => ({ ...current, person: person.id }));
    }
  }

  function updateFrequency(value: string) {
    const option = frequencyOptions.find(item => item.value === value);
    if (option) {
      setFilters(current => ({
        ...current,
        frequency: option.value
      }));
    }
  }

  function updateTime(value: string) {
    if (value === 'all' || value === 'not-applicable') {
      setFilters(current => ({ ...current, timeOfDay: value }));
    } else {
      const selectedTime = timeValues.find(time => time === value);
      if (selectedTime) setFilters(current => ({ ...current, timeOfDay: selectedTime }));
    }
  }

  function lastTendedLabel(rhythm: RhythmPreview, completed: boolean) {
    return rhythmLastTendedLabel(rhythm, completed, props.today);
  }

  function timeLabel(rhythm: RhythmPreview) {
    const legacyTimeLabel = 'timeLabel' in rhythm && typeof rhythm.timeLabel === 'string'
      ? rhythm.timeLabel
      : undefined;
    const value = rhythm.timeOfDay ?? (legacyTimeLabel
      ? rhythmTimeValueFromLegacyLabel(legacyTimeLabel)
      : undefined);
    return value ? rhythmTimeLabel(value, timeOptions) : undefined;
  }

  return (
    <section className="all-items-page" aria-labelledby="all-items-heading">
      <h3 id="all-items-heading">All items</h3>
      <div className="all-items-page__filters" aria-label="Filter all items">
        <label>
          <span>Type</span>
          <select aria-label="Type" value={filters.type} onChange={event => updateType(event.currentTarget.value)}>
            <option value="all">All types</option>
            <option value="rhythms">Rhythms</option>
            <option value="sparks">Sparks</option>
            <option value="prayer-requests">Prayer requests</option>
          </select>
        </label>
        <label>
          <span>Person</span>
          <select aria-label="Person" value={filters.person} onChange={event => updatePerson(event.currentTarget.value)}>
            <option value="all">All people</option>
            <option value="none">No person</option>
            {[...props.people]
              .sort((left, right) => left.displayName.localeCompare(right.displayName) || left.id.localeCompare(right.id))
              .map(person => <option key={person.id} value={person.id}>{person.displayName}</option>)}
          </select>
        </label>
        <label>
          <span>Frequency</span>
          <select
            aria-label="Frequency"
            value={filters.frequency}
            onChange={event => updateFrequency(event.currentTarget.value)}
          >
            {frequencyOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          <span>Time of day</span>
          <select
            aria-label="Time of day"
            value={filters.timeOfDay}
            onChange={event => updateTime(event.currentTarget.value)}
          >
            <option value="all">All times</option>
            <option value="not-applicable">No applicable time setting</option>
            {timeValues.map(value => (
              <option key={value} value={value}>{rhythmTimeLabel(value, timeOptions)}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="all-items-page__results">
        <p role="status" aria-live="polite">
          {selection.count} {selection.count === 1 ? 'item' : 'items'}
        </p>
        <button
          type="button"
          className="btn mini ghost"
          disabled={!hasActiveFilters}
          onClick={() => setFilters({
            type: 'all',
            person: 'all',
            frequency: 'all',
            timeOfDay: 'all'
          })}
        >
          Clear filters
        </button>
      </div>
      {selection.count === 0 ? (
        <p className="all-items-page__empty">
          {totalItems === 0
            ? 'There are no items in this account yet.'
            : 'No items match these filters. Clear filters to see everything.'}
        </p>
      ) : (
        <div className="all-items-page__groups">
          {selection.rhythms.length > 0 && (
            <section className="all-items-page__group" aria-labelledby="all-items-rhythms-heading">
              <h4 id="all-items-rhythms-heading">Rhythms ({selection.rhythms.length})</h4>
              <ul className="all-items-page__list">
                {selection.rhythms.map(rhythm => {
                  const archived = props.archivedRhythmIds.includes(rhythm.id);
                  const completed = props.completedRhythmIds.has(rhythm.id);
                  const schedule = effectiveRhythmSchedule(rhythm.schedule, rhythm.cadence);
                  const rhythmTimeLabel = timeLabel(rhythm);
                  const isInactive = !archived && Boolean(schedule?.endDate && schedule.endDate < props.today);
                  return (
                    <li key={rhythm.id}>
                      <RhythmCard
                        rhythm={rhythm}
                        variant="details-summary"
                        archived={archived}
                        completed={completed}
                        {...(isInactive ? { statusLabel: 'Inactive' } : {})}
                        {...(schedule ? { schedule } : rhythm.cadence ? { cadence: rhythm.cadence } : {})}
                        {...(rhythmTimeLabel ? { timeLabel: rhythmTimeLabel } : {})}
                        lastTended={lastTendedLabel(rhythm, completed)}
                        onEdit={(event: MouseEvent<HTMLButtonElement>) => props.onEditRhythm(rhythm, event)}
                        {...(!archived && !isInactive ? {
                          onTend: (event: MouseEvent<HTMLButtonElement>) => props.onTendRhythm(rhythm.id, event)
                        } : {})}
                        {...(!archived && !isInactive && completed
                          ? { onUndo: () => props.onUndoRhythm(rhythm.id) }
                          : {})}
                        people={props.people}
                        foundations={props.foundations}
                        onPersonSelect={props.onPersonSelect}
                        onOpenCategory={props.onOpenCategory}
                        onOpenFoundation={props.onOpenFoundation}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {selection.sparks.length > 0 && (
            <section className="all-items-page__group" aria-labelledby="all-items-sparks-heading">
              <h4 id="all-items-sparks-heading">Sparks ({selection.sparks.length})</h4>
              <PersonSparkPanel
                personId={selection.sparks[0]!.ownerId}
                people={props.people}
                peopleGroups={props.peopleGroups}
                sparks={selection.sparks}
                friendships={props.friendships}
                today={props.today}
                onCreate={draft => props.onCreateSpark(selection.sparks[0]!.ownerId, draft)}
                onUpdate={props.onUpdateSpark}
                onArchive={props.onArchiveSpark}
                onDelete={props.onDeleteSpark}
                onUndo={props.onUndoSpark}
                onComplete={props.onCompleteSpark}
                onPersonSelect={props.onPersonSelect}
                allItems
              />
            </section>
          )}
          {selection.prayerRequests.length > 0 && (
            <section className="all-items-page__group" aria-labelledby="all-items-prayer-heading">
              <h4 id="all-items-prayer-heading">Prayer requests ({selection.prayerRequests.length})</h4>
              <PersonPrayerPanel
                personId={selection.prayerRequests[0]!.personId}
                enabled={props.prayerEnabled}
                today={props.today}
                timeZone={props.timeZone}
                people={props.people}
                peopleGroups={props.peopleGroups}
                requests={selection.prayerRequests}
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
              />
            </section>
          )}
        </div>
      )}
    </section>
  );
}
