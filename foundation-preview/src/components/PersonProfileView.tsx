import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import {
  addOrUpdateConnection,
  connectionsForPerson,
  deleteConnection,
  friendConnectionStatus
} from '../domain/friendships.ts';
import type {
  FriendshipConnection,
  FriendshipData
} from '../domain/friendships.ts';
import { personById, syntheticPeople } from '../domain/preview-data.ts';
import type {
  FoundationPreview,
  PersonId,
  PersonPickerGroup,
  PersonPreview,
  RhythmPreview
} from '../domain/preview-data.ts';
import { isEditableRhythmId } from '../domain/rhythm-editor.ts';
import { peopleForRhythm } from '../domain/preview-data.ts';
import { rhythmHealthScore } from '../domain/rhythm-scoring.ts';
import type { RhythmScoreResult } from '../domain/rhythm-scoring.ts';
import { ArchivedRhythmsDialog } from './ArchivedRhythmsDialog.tsx';
import { AreaIcon } from './AreaIcon.tsx';
import { BackButton } from './BackButton.tsx';
import { ConnectionEditor, ConnectionHistoryList, ConnectionTypeActions, FriendshipCadenceControl } from './FriendshipConnectionControls.tsx';
import { PersonAvatar } from './PersonBadge.tsx';
import { RhythmDetailsDialog } from './RhythmDetailsDialog.tsx';
import { selectPersonRhythmsDueToday } from '../domain/person-rhythms.ts';
import type { Destination } from './AppNavigation.tsx';
import {
  connectionStyleLabel,
  personDetailsForId,
  personWithSavedPhoto
} from '../domain/person-details.ts';
import type { PersonDetails } from '../domain/person-details.ts';
import { PersonNotesPanel } from './PersonNotesPanel.tsx';
import { personNotesForPerson } from '../domain/person-notes.ts';
import type { PersonNote, PersonNoteDraft } from '../domain/person-notes.ts';
import { resolvePersonCategory } from '../domain/person-categories.ts';
import { BirthdayCakeIcon } from './BirthdayCakeIcon.tsx';
import { PersonHealthSummary } from './PersonHealthSummary.tsx';
import { PersonPrayerPanel } from './PersonPrayerPanel.tsx';
import { selectPersonHealth, selectPersonRhythmHealth } from '../domain/person-health.ts';
import type {
  PersonPrayerRequest,
  PersonPrayerRequestDraft,
  PrayerRequestTransition
} from '../domain/person-prayers.ts';

type ProfileTab = 'rhythms' | 'connections' | 'prayer';

const profileTabs: { id: ProfileTab; label: string }[] = [
  { id: 'rhythms', label: 'Rhythms' },
  { id: 'connections', label: 'Connections' },
  { id: 'prayer', label: 'Prayer' }
];

export function PersonProfileView({
  personId,
  people = syntheticPeople,
  peopleGroups,
  friendships,
  today,
  rhythms,
  archivedRhythms,
  foundations,
  rhythmScores,
  completedRhythms,
  undoableRhythms,
  onFriendshipsChange,
  personDetails = [],
  personNotes = [],
  prayerRequests = [],
  onCreatePersonNote,
  onUpdatePersonNote,
  onDeletePersonNote,
  onCreatePrayerRequest,
  onUpdatePrayerRequest,
  onPrayerRequestTransition,
  onPrayForRequest,
  onRemovePrayerRequest,
  onEditPerson,
  onAddRhythm,
  onEditRhythm,
  onRhythmHistory,
  onTend,
  onUndo,
  onRestoreRhythm,
  onOpenFoundation,
  onOpenCategory,
  onPersonSelect,
  onConnectionChange,
  showAddRhythm = true,
  returnLabel = 'previous page',
  onClose
}: {
  personId: PersonId;
  people?: readonly PersonPreview[];
  peopleGroups: readonly PersonPickerGroup[];
  friendships: FriendshipData;
  today: string;
  rhythms: readonly RhythmPreview[];
  archivedRhythms: readonly RhythmPreview[];
  foundations: readonly FoundationPreview[];
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>;
  completedRhythms: ReadonlySet<string>;
  undoableRhythms: ReadonlySet<string>;
  onFriendshipsChange: (friendships: FriendshipData) => void;
  personDetails?: readonly PersonDetails[];
  personNotes?: readonly PersonNote[];
  prayerRequests?: readonly PersonPrayerRequest[];
  onCreatePersonNote?: (personId: PersonId, draft: PersonNoteDraft) => string | null;
  onUpdatePersonNote?: (noteId: string, expectedUpdatedAt: string, actorId: PersonId, draft: PersonNoteDraft) => string | null;
  onDeletePersonNote?: (noteId: string, expectedUpdatedAt: string, actorId: PersonId) => string | null;
  onCreatePrayerRequest?: (personId: PersonId, draft: PersonPrayerRequestDraft) => string | null;
  onUpdatePrayerRequest?: (
    requestId: string,
    expectedUpdatedAt: string,
    actorId: PersonId,
    draft: PersonPrayerRequestDraft
  ) => string | null;
  onPrayerRequestTransition?: (
    requestId: string,
    expectedUpdatedAt: string,
    actorId: PersonId,
    transition: PrayerRequestTransition
  ) => string | null;
  onPrayForRequest?: (requestId: string, expectedUpdatedAt: string, actorId: PersonId) => string | null;
  onRemovePrayerRequest?: (requestId: string, expectedUpdatedAt: string, actorId: PersonId) => string | null;
  onEditPerson?: (personId: PersonId, event: MouseEvent<HTMLButtonElement>) => void;
  onAddRhythm: (event: MouseEvent<HTMLButtonElement>, personId: PersonId) => void;
  onEditRhythm: (rhythm: RhythmPreview, event: MouseEvent<HTMLButtonElement>) => void;
  onRhythmHistory: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onTend: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onUndo: (id: string) => void;
  onRestoreRhythm: (id: string) => void;
  onOpenFoundation: (foundationId: string, openerId: string) => void;
  onOpenCategory: (categoryId: Destination, openerId: string) => void;
  onPersonSelect: (id: PersonId) => void;
  onConnectionChange: (friendships: FriendshipData) => void;
  showAddRhythm?: boolean;
  returnLabel?: string;
  onClose: () => void;
}) {
  const details = personDetailsForId(personDetails, personId);
  const person = personWithSavedPhoto(personById(people, personId), personDetails ?? []);
  const [tab, setTab] = useState<ProfileTab>('rhythms');
  const [notesOpen, setNotesOpen] = useState(false);
  const [connectionEditor, setConnectionEditor] = useState<{
    record?: FriendshipConnection;
    type?: 'text' | 'call' | 'time-together';
  } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedPersonId, setArchivedPersonId] = useState<PersonId | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const notesAccessRef = useRef<HTMLButtonElement | null>(null);
  const connectionOpener = useRef<HTMLButtonElement | null>(null);
  const wasEditorOpen = useRef(false);
  const archiveOpener = useRef<HTMLButtonElement | null>(null);
  const wasArchiveOpen = useRef(false);
  const connectionHistory = connectionsForPerson(friendships, personId);
  const personConnectionStatus = friendConnectionStatus(friendships, personId, today);
  const classifications = peopleGroups.filter(group => group.memberIds.includes(personId));
  const resolvedCategory = resolvePersonCategory(classifications.map(group => group.id));
  const categoryLabel = resolvedCategory === 'friends'
    ? 'Friend'
    : resolvedCategory === 'marriage'
      ? 'Marriage'
      : resolvedCategory === 'parenting'
        ? 'Parenting'
        : null;
  const profileNotes = personNotesForPerson(personNotes, personId);
  const birthdayDateLabel = details?.birthday ? personDateLabel(details.birthday.monthDay) : null;
  const anniversaryDateLabel = details?.anniversary ? personDateLabel(details.anniversary.monthDay) : null;
  const personRhythms = rhythms.filter(rhythm => rhythm.personIds?.includes(personId));
  const archivedRhythmIds = new Set(archivedRhythms.map(rhythm => rhythm.id));
  const personRhythmHealth = selectPersonRhythmHealth(
    personId,
    [...rhythms, ...archivedRhythms],
    rhythmScores,
    archivedRhythmIds
  );
  const overallHealth = selectPersonHealth([
    { id: 'rhythms', consistency: personRhythmHealth.consistency, onTrack: personRhythmHealth.onTrack },
    { id: 'connection', consistency: null, onTrack: null, scoringStatus: 'unavailable' },
    { id: 'prayer', consistency: null, onTrack: null, scoringStatus: 'unavailable' }
  ]);
  const duePersonRhythms = selectPersonRhythmsDueToday(personRhythms, personId, today);
  const dueRhythmIds = new Set(duePersonRhythms.map(rhythm => rhythm.id));
  const otherPersonRhythms = personRhythms.filter(rhythm => !dueRhythmIds.has(rhythm.id));
  const personArchivedRhythms = archivedRhythms.filter(rhythm => rhythm.personIds?.includes(personId));

  useEffect(() => {
    if (connectionEditor) {
      wasEditorOpen.current = true;
      return;
    }
    if (wasEditorOpen.current) {
      wasEditorOpen.current = false;
      if (connectionOpener.current?.isConnected) connectionOpener.current.focus({ preventScroll: true });
      else tabRefs.current[1]?.focus({ preventScroll: true });
    }
  }, [connectionEditor]);

  useEffect(() => {
    if (showArchived) {
      wasArchiveOpen.current = true;
      return;
    }
    if (wasArchiveOpen.current) {
      wasArchiveOpen.current = false;
      archiveOpener.current?.focus({ preventScroll: true });
    }
  }, [showArchived]);

  function selectTab(next: ProfileTab) {
    setTab(next);
    setNotesOpen(false);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let target: number | null = null;
    if (event.key === 'ArrowRight') target = (index + 1) % profileTabs.length;
    else if (event.key === 'ArrowLeft') target = (index - 1 + profileTabs.length) % profileTabs.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = profileTabs.length - 1;
    if (target === null) return;
    event.preventDefault();
    setTab(profileTabs[target]!.id);
    tabRefs.current[target]?.focus();
  }

  function openConnectionDraft(
    type: 'text' | 'call' | 'time-together',
    event: MouseEvent<HTMLButtonElement>
  ) {
    connectionOpener.current = event.currentTarget;
    setConnectionEditor({ type });
  }

  function openEditConnection(record: FriendshipConnection, event: MouseEvent<HTMLButtonElement>) {
    connectionOpener.current = event.currentTarget;
    setConnectionEditor({ record });
  }

  function renderPersonRhythm(rhythm: RhythmPreview) {
    return (
      <RhythmDetailsDialog
        key={rhythm.id}
        rhythm={rhythm}
        inline
        headingId={`person-profile-rhythm-${personId}-${rhythm.id}`}
        people={peopleForRhythm(rhythm, people)}
        foundations={foundations}
        onPersonSelect={onPersonSelect}
        onOpenFoundation={onOpenFoundation}
        onOpenCategory={onOpenCategory}
        completed={completedRhythms.has(rhythm.id)}
        healthScore={rhythmHealthScore(rhythmScores.get(rhythm.id))}
        onHistory={event => onRhythmHistory(rhythm.id, event)}
        {...(isEditableRhythmId(rhythm.id)
          ? {
              onTend: (event: MouseEvent<HTMLButtonElement>) => onTend(rhythm.id, event),
              onEdit: (event: MouseEvent<HTMLButtonElement>) => onEditRhythm(rhythm, event),
              ...(completedRhythms.has(rhythm.id) && undoableRhythms.has(rhythm.id)
                ? { onUndo: () => onUndo(rhythm.id) }
                : {})
            }
          : {})}
        onClose={() => undefined}
      />
    );
  }

  function personDateLabel(monthDay: string): string {
    const [month, day] = monthDay.split('-').map(Number);
    return new Date(Date.UTC(2000, month! - 1, day!)).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    });
  }

  return (
    <main className="person-profile-page" aria-labelledby="person-profile-title">
      <div className="person-profile-page__back">
        <BackButton onClick={onClose}>Back to {returnLabel}</BackButton>
      </div>
      <section className="person-profile__content" aria-labelledby="person-profile-title">
          <header className="person-profile__identity">
            <PersonAvatar person={person} />
            <div className="person-profile__identity-copy">
              <div className="person-profile__identity-title-row">
                <h2 id="person-profile-title">{person.displayName}</h2>
                {onEditPerson && (
                  <button
                    type="button"
                    className="person-profile__settings"
                    aria-label="Person settings"
                    aria-haspopup="dialog"
                    onClick={event => onEditPerson(personId, event)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm0 1.8a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4Zm7.3 1.7a7.3 7.3 0 0 0-.1-1l1.5-1.2-1.5-2.6-1.8.7a7 7 0 0 0-1.7-1L15.4 5h-3l-.4 1.9a7 7 0 0 0-1.7 1l-1.8-.7L7 9.8l1.5 1.2a7.3 7.3 0 0 0 0 2L7 14.2l1.5 2.6 1.8-.7a7 7 0 0 0 1.7 1l.4 1.9h3l.4-1.9a7 7 0 0 0 1.7-1l1.8.7 1.5-2.6-1.5-1.2a7.3 7.3 0 0 0 0-1Z" />
                    </svg>
                  </button>
                )}
              </div>
              {categoryLabel && (
                <span className="person-profile__category">
                  {resolvedCategory !== 'friends' && resolvedCategory && <AreaIcon id={resolvedCategory} />}
                  {categoryLabel}
                </span>
              )}
            </div>
          </header>
          {(details?.connectionStyle || birthdayDateLabel || anniversaryDateLabel) && (
            <div className="person-profile__details" aria-label={`${person.displayName} personal details`}>
              {details?.connectionStyle && (
                <span className="person-profile__detail" aria-label={`Love language: ${connectionStyleLabel(details.connectionStyle)}`}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M20.8 4.8a5.4 5.4 0 0 0-7.6 0L12 6l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6l1.2 1.2L12 21l7.6-7.4 1.2-1.2a5.4 5.4 0 0 0 0-7.6Z" />
                  </svg>
                  {connectionStyleLabel(details.connectionStyle)}
                </span>
              )}
              {birthdayDateLabel && (
                <span className="person-profile__detail" aria-label={`Birthday: ${birthdayDateLabel}`}>
                  <BirthdayCakeIcon />
                  {birthdayDateLabel}
                </span>
              )}
              {anniversaryDateLabel && (
                <span className="person-profile__detail" aria-label={`Anniversary: ${anniversaryDateLabel}`}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M20.8 4.8a5.4 5.4 0 0 0-7.6 0L12 6l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6l1.2 1.2L12 21l7.6-7.4 1.2-1.2a5.4 5.4 0 0 0 0-7.6Z" />
                  </svg>
                  {anniversaryDateLabel}
                </span>
              )}
            </div>
          )}
          <div className="person-profile-health-overview">
            <PersonHealthSummary
              key={`${personId}:overall-health`}
              title="Overall Health"
              health={overallHealth}
              itemTerm="component"
              totalCount={overallHealth.componentIds.length}
              eligibleCount={overallHealth.eligibleComponentIds.length}
              excludedCount={overallHealth.excludedComponentIds.length}
              unscoredCount={overallHealth.unscoredComponentIds.length}
            />
          </div>
          <div className="faith-view-nav marriage-view-nav person-profile__nav" role="tablist" aria-label={`${person.displayName} profile`}>
            {profileTabs.map((item, index) => (
              <button
                key={item.id}
                ref={element => { tabRefs.current[index] = element; }}
                id={`person-profile-tab-${item.id}`}
                type="button"
                role="tab"
                aria-controls={`person-profile-panel-${item.id}`}
                aria-selected={tab === item.id}
                tabIndex={tab === item.id ? 0 : -1}
                onClick={() => selectTab(item.id)}
                onKeyDown={event => handleTabKeyDown(event, index)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="person-profile__notes-access">
            <button
              ref={notesAccessRef}
              type="button"
              className="btn mini ghost"
              aria-controls={`person-profile-notes-view-${personId}`}
              aria-expanded={notesOpen}
              onClick={() => setNotesOpen(true)}
            >
              Notes ({profileNotes.length})
            </button>
          </div>
          <section
            id="person-profile-panel-rhythms"
            className="person-profile__panel marriage-view-panel"
            role="tabpanel"
            aria-labelledby="person-profile-tab-rhythms"
            hidden={notesOpen || tab !== 'rhythms'}
          >
            <PersonHealthSummary
              key={`${personId}:rhythm-health`}
              title="Rhythm Health"
              health={personRhythmHealth}
              itemTerm="Rhythm"
              totalCount={personRhythmHealth.activeRhythmIds.length}
              eligibleCount={personRhythmHealth.eligibleRhythmIds.length}
              excludedCount={personRhythmHealth.excludedRhythmIds.length}
              unresolvedCount={personRhythmHealth.unresolvedRhythmIds.length}
              archivedCount={personRhythmHealth.archivedRhythmIds.length}
              coverageLabel={personRhythmHealth.activeRhythmIds.length === 0
                ? personRhythmHealth.archivedRhythmIds.length > 0
                  ? 'No active associated Rhythms; archived Rhythms are excluded.'
                  : 'No associated Rhythms.'
                : `${personRhythmHealth.eligibleRhythmIds.length} of ${personRhythmHealth.activeRhythmIds.length} active associated Rhythms scored.`}
            />
            <div className="person-profile__section-heading">
              <h3>Today with {person.displayName}</h3>
              {showAddRhythm && (
                <button
                  type="button"
                  className="btn mini"
                  onClick={event => onAddRhythm(event, personId)}
                >
                  Add Rhythm
                </button>
              )}
            </div>
            {duePersonRhythms.length > 0 ? (
              <div className="marriage-rhythm-list current-plan-item-group">
                {duePersonRhythms.map(renderPersonRhythm)}
              </div>
            ) : (
              <p className="friendships-empty">
                {personRhythms.length === 0 ? 'No Rhythms yet.' : 'No Rhythms due today.'}
              </p>
            )}
            {otherPersonRhythms.length > 0 && (
              <section className="person-profile__other-rhythms" aria-labelledby="person-profile-other-rhythms">
                <h4 id="person-profile-other-rhythms">Other Rhythms</h4>
                <div className="marriage-rhythm-list current-plan-item-group">
                  {otherPersonRhythms.map(renderPersonRhythm)}
                </div>
              </section>
            )}
            <button
              ref={archiveOpener}
              type="button"
              className="category-archived-rhythms-toggle"
              aria-haspopup="dialog"
              onClick={() => {
                setArchivedPersonId(personId);
                setShowArchived(true);
              }}
            >
              Archived rhythms ({personArchivedRhythms.length})
            </button>
          </section>
          <section
            id="person-profile-panel-connections"
            className="person-profile__panel marriage-view-panel"
            role="tabpanel"
            aria-labelledby="person-profile-tab-connections"
            hidden={notesOpen || tab !== 'connections'}
          >
            <PersonHealthSummary
              key={`${personId}:connection-health`}
              title="Connection Health"
              health={{ consistency: null, onTrack: null, health: null }}
              itemTerm="component"
              totalCount={1}
              eligibleCount={0}
              coverageLabel="Connection scoring is not defined yet."
            />
            <div className="person-profile__section-heading">
              <h3>Connections</h3>
              <ConnectionTypeActions
                personId={personId}
                people={people}
                onSelect={openConnectionDraft}
              />
            </div>
            <section className="person-profile__cadence" aria-label="Person connection cadence">
                <span>Connection cadence</span>
                <FriendshipCadenceControl
                  personId={personId}
                  people={people}
                  cadence={personConnectionStatus.cadence}
                  today={today}
                  data={friendships}
                  onChange={onFriendshipsChange}
                />
            </section>
            <ConnectionHistoryList
              connections={connectionHistory}
              people={people}
              onEdit={openEditConnection}
              onDelete={id => onConnectionChange(deleteConnection(friendships, id))}
              onPersonSelect={onPersonSelect}
            />
          </section>
          <section
            id="person-profile-panel-prayer"
            className="person-profile__panel marriage-view-panel"
            role="tabpanel"
            aria-labelledby="person-profile-tab-prayer"
            hidden={notesOpen || tab !== 'prayer'}
          >
            <PersonHealthSummary
              key={`${personId}:prayer-health`}
              title="Prayer Health"
              health={{ consistency: null, onTrack: null, health: null }}
              itemTerm="component"
              totalCount={1}
              eligibleCount={0}
              coverageLabel="Prayer scoring is not defined yet."
            />
            <PersonPrayerPanel
              personId={personId}
              people={people}
              peopleGroups={peopleGroups}
              requests={prayerRequests}
              onCreate={(ownerId, draft) => onCreatePrayerRequest
                ? onCreatePrayerRequest(ownerId, draft)
                : 'Prayer requests are unavailable.'}
              onUpdate={(requestId, expectedUpdatedAt, actorId, draft) => onUpdatePrayerRequest
                ? onUpdatePrayerRequest(requestId, expectedUpdatedAt, actorId, draft)
                : 'Prayer requests are unavailable.'}
              onTransition={(requestId, expectedUpdatedAt, actorId, transition) => onPrayerRequestTransition
                ? onPrayerRequestTransition(requestId, expectedUpdatedAt, actorId, transition)
                : 'Prayer requests are unavailable.'}
              onPray={(requestId, expectedUpdatedAt, actorId) => onPrayForRequest
                ? onPrayForRequest(requestId, expectedUpdatedAt, actorId)
                : 'Prayer logging is unavailable.'}
              onRemove={(requestId, expectedUpdatedAt, actorId) => onRemovePrayerRequest
                ? onRemovePrayerRequest(requestId, expectedUpdatedAt, actorId)
                : 'Prayer requests are unavailable.'}
            />
          </section>
          <section
            id={`person-profile-notes-view-${personId}`}
            className="person-profile__notes-view"
            aria-labelledby={`person-profile-notes-heading-${personId}`}
            hidden={!notesOpen}
          >
              <header className="person-profile__section-heading">
                <h3 id={`person-profile-notes-heading-${personId}`}>Notes</h3>
                <button
                  type="button"
                  className="btn mini ghost"
                  onClick={() => {
                    setNotesOpen(false);
                    notesAccessRef.current?.focus();
                  }}
                >
                  Return to profile tabs
                </button>
              </header>
              <PersonNotesPanel
                personId={personId}
                people={people}
                notes={personNotes}
                onCreate={draft => onCreatePersonNote
                  ? onCreatePersonNote(personId, draft)
                  : 'Person notes are unavailable.'}
                onUpdate={(noteId, expectedUpdatedAt, actorId, draft) => onUpdatePersonNote
                  ? onUpdatePersonNote(noteId, expectedUpdatedAt, actorId, draft)
                  : 'Person notes are unavailable.'}
                onDelete={(noteId, expectedUpdatedAt, actorId) => onDeletePersonNote
                  ? onDeletePersonNote(noteId, expectedUpdatedAt, actorId)
                  : 'Person notes are unavailable.'}
              />
          </section>
      </section>
      {connectionEditor && (
        <ConnectionEditor
          key={connectionEditor.record?.id ?? `${personId}-new`}
          {...(connectionEditor.record ? { record: connectionEditor.record } : {})}
          people={people}
          initialParticipantIds={connectionEditor.record?.participantIds ?? [personId]}
          {...(connectionEditor.type ? { initialType: connectionEditor.type } : {})}
          today={today}
          onSave={connection => {
            onConnectionChange(addOrUpdateConnection(friendships, connection));
            return null;
          }}
          onClose={() => setConnectionEditor(null)}
        />
      )}
      {showArchived && archivedPersonId === personId && (
        <ArchivedRhythmsDialog
          rhythms={personArchivedRhythms}
          people={people}
          foundations={foundations}
          completedRhythms={completedRhythms}
          onPersonSelect={onPersonSelect}
          onOpenFoundation={onOpenFoundation}
          onOpenCategory={onOpenCategory}
          onRestore={onRestoreRhythm}
          onClose={() => {
            setShowArchived(false);
            setArchivedPersonId(null);
          }}
        />
      )}
    </main>
  );
}
