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
import { personById, personGroupMemberIds } from '../domain/preview-data.ts';
import type {
  FoundationPreview,
  PersonId,
  PersonPickerGroup,
  RhythmPreview
} from '../domain/preview-data.ts';
import { isEditableRhythmId } from '../domain/rhythm-editor.ts';
import { peopleForRhythm } from '../domain/preview-data.ts';
import { rhythmHealthScore } from '../domain/rhythm-scoring.ts';
import type { RhythmScoreResult } from '../domain/rhythm-scoring.ts';
import { ArchivedRhythmsDialog } from './ArchivedRhythmsDialog.tsx';
import { AreaIcon } from './AreaIcon.tsx';
import { ConnectionEditor, ConnectionHistoryList, ConnectionTypeActions, FriendshipCadenceControl } from './FriendshipConnectionControls.tsx';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { PersonAvatar } from './PersonBadge.tsx';
import { RhythmDetailsDialog } from './RhythmDetailsDialog.tsx';
import type { Destination } from './AppNavigation.tsx';

type ProfileTab = 'rhythms' | 'connections';

const profileTabs: { id: ProfileTab; label: string }[] = [
  { id: 'rhythms', label: 'Rhythms' },
  { id: 'connections', label: 'Connections' }
];

export function PersonProfileView({
  personId,
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
  onClose
}: {
  personId: PersonId;
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
  onClose: () => void;
}) {
  const person = personById(personId);
  const [tab, setTab] = useState<ProfileTab>('rhythms');
  const [connectionEditor, setConnectionEditor] = useState<{
    record?: FriendshipConnection;
    type?: 'text' | 'call' | 'time-together';
  } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const connectionOpener = useRef<HTMLButtonElement | null>(null);
  const wasEditorOpen = useRef(false);
  const archiveOpener = useRef<HTMLButtonElement | null>(null);
  const wasArchiveOpen = useRef(false);
  const friends = new Set(personGroupMemberIds(peopleGroups, 'friends'));
  const isFriend = friends.has(personId);
  const connectionHistory = connectionsForPerson(friendships, personId);
  const friendStatus = isFriend ? friendConnectionStatus(friendships, personId, today) : null;
  const classifications = peopleGroups.filter(group => group.memberIds.includes(personId));
  const personRhythms = rhythms.filter(rhythm => rhythm.personIds?.includes(personId));
  const personArchivedRhythms = archivedRhythms.filter(rhythm => rhythm.personIds?.includes(personId));

  useEffect(() => {
    if (connectionEditor) {
      wasEditorOpen.current = true;
      return;
    }
    if (wasEditorOpen.current) {
      wasEditorOpen.current = false;
      if (connectionOpener.current?.isConnected) connectionOpener.current.focus();
      else tabRefs.current[1]?.focus();
    }
  }, [connectionEditor]);

  useEffect(() => {
    if (showArchived) {
      wasArchiveOpen.current = true;
      return;
    }
    if (wasArchiveOpen.current) {
      wasArchiveOpen.current = false;
      archiveOpener.current?.focus();
    }
  }, [showArchived]);

  function selectTab(next: ProfileTab) {
    setTab(next);
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

  return (
    <>
      <MoneyGoalDialog
        dialogClassName="person-profile-dialog"
        surfaceClassName="person-profile-dialog__surface"
        bodyClassName="person-profile-dialog__body"
        labelledBy="person-profile-title"
        closeLabel={`Close profile for ${person.displayName}`}
        onClose={onClose}
      >
        <section className="person-profile" aria-labelledby="person-profile-title">
          <header className="person-profile__identity">
            <PersonAvatar person={person} />
            <div className="person-profile__identity-copy">
              <h2 id="person-profile-title">{person.displayName}</h2>
              {classifications.length > 0 && (
                <div className="person-profile__classifications" aria-label="People classifications">
                  {classifications.map(group => (
                    <span className="person-profile__classification" key={group.id}>
                      {group.id !== 'friends' && <AreaIcon id={group.id} />}
                      {group.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </header>
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
          <section
            id="person-profile-panel-rhythms"
            className="person-profile__panel marriage-view-panel"
            role="tabpanel"
            aria-labelledby="person-profile-tab-rhythms"
            hidden={tab !== 'rhythms'}
          >
            <div className="person-profile__section-heading">
              <h3>Rhythms</h3>
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
            {personRhythms.length > 0 ? (
              <div className="marriage-rhythm-list current-plan-item-group">
                {personRhythms.map(rhythm => (
                  <RhythmDetailsDialog
                    key={rhythm.id}
                    rhythm={rhythm}
                    inline
                    headingId={`person-profile-rhythm-${personId}-${rhythm.id}`}
                    people={peopleForRhythm(rhythm)}
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
                ))}
              </div>
            ) : (
              <p className="friendships-empty">No Rhythms yet.</p>
            )}
            <button
              ref={archiveOpener}
              type="button"
              className="category-archived-rhythms-toggle"
              aria-haspopup="dialog"
              onClick={() => setShowArchived(true)}
            >
              Archived rhythms ({personArchivedRhythms.length})
            </button>
          </section>
          <section
            id="person-profile-panel-connections"
            className="person-profile__panel marriage-view-panel"
            role="tabpanel"
            aria-labelledby="person-profile-tab-connections"
            hidden={tab !== 'connections'}
          >
            <div className="person-profile__section-heading">
              <h3>Connections</h3>
              <ConnectionTypeActions
                personId={personId}
                onSelect={openConnectionDraft}
              />
            </div>
            {friendStatus && (
              <section className="person-profile__cadence" aria-label="Friendship cadence">
                <span>Connection cadence</span>
                <FriendshipCadenceControl
                  personId={personId}
                  cadence={friendStatus.cadence}
                  today={today}
                  data={friendships}
                  onChange={onFriendshipsChange}
                />
              </section>
            )}
            <ConnectionHistoryList
              connections={connectionHistory}
              onEdit={openEditConnection}
              onDelete={id => onConnectionChange(deleteConnection(friendships, id))}
              onPersonSelect={onPersonSelect}
            />
          </section>
        </section>
      </MoneyGoalDialog>
      {connectionEditor && (
        <ConnectionEditor
          key={connectionEditor.record?.id ?? `${personId}-new`}
          {...(connectionEditor.record ? { record: connectionEditor.record } : {})}
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
      {showArchived && (
        <ArchivedRhythmsDialog
          rhythms={personArchivedRhythms}
          foundations={foundations}
          completedRhythms={completedRhythms}
          onPersonSelect={onPersonSelect}
          onOpenFoundation={onOpenFoundation}
          onOpenCategory={onOpenCategory}
          onRestore={onRestoreRhythm}
          onClose={() => setShowArchived(false)}
        />
      )}
    </>
  );
}
