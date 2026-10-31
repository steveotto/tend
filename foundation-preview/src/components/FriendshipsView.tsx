import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import {
  addOrUpdateConnection,
  connectionsForPerson,
  friendConnectionStatus,
  selectFriendStatuses,
} from '../domain/friendships.ts';
import type {
  ConnectionCadence,
  ConnectionType,
  FriendshipConnection,
  FriendshipData
} from '../domain/friendships.ts';
import { personById, personGroupMemberIds, syntheticPersonPickerGroups } from '../domain/preview-data.ts';
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
import { RhythmDetailsDialog } from './RhythmDetailsDialog.tsx';
import { PersonBadge } from './PersonBadge.tsx';
import { PeopleCard } from './PeopleCard.tsx';
import { AreaIcon } from './AreaIcon.tsx';
import type { Destination } from './AppNavigation.tsx';
import {
  ConnectionTypeActions,
  ConnectionEditor,
  ConnectionHistoryDialog,
  FriendshipCadenceControl
} from './FriendshipConnectionControls.tsx';
import { CategoryHeader } from './CategoryHeader.tsx';

type FriendshipTab = 'today' | 'friends' | 'rhythms';

const friendshipTabs: { id: FriendshipTab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'friends', label: 'Friends' },
  { id: 'rhythms', label: 'Rhythms' }
];

const cadenceLabels: Record<ConnectionCadence, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  'two-weeks': 'Every two weeks',
  monthly: 'Monthly'
};
type FriendshipsViewProps = {
  data: FriendshipData;
  peopleGroups?: readonly PersonPickerGroup[];
  today: string;
  rhythms: readonly RhythmPreview[];
  archivedRhythms: readonly RhythmPreview[];
  foundations: readonly FoundationPreview[];
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>;
  completedRhythms: ReadonlySet<string>;
  undoableRhythms: ReadonlySet<string>;
  onChange: (data: FriendshipData) => void;
  onAddRhythm: (event: MouseEvent<HTMLButtonElement>) => void;
  onEditRhythm: (rhythm: RhythmPreview, event: MouseEvent<HTMLButtonElement>) => void;
  onRhythmHistory: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onTend: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onUndo: (id: string) => void;
  onPersonSelect: (id: PersonId) => void;
  onGoToPeople: () => void;
  onRestoreRhythm: (id: string) => void;
  onOpenFoundation: (foundationId: string, openerId: string) => void;
  onOpenCategory: (categoryId: Destination, openerId: string) => void;
};

export function FriendshipsView({
  data,
  peopleGroups = syntheticPersonPickerGroups,
  today,
  rhythms,
  archivedRhythms,
  foundations,
  rhythmScores,
  completedRhythms,
  undoableRhythms,
  onChange,
  onAddRhythm,
  onEditRhythm,
  onRhythmHistory,
  onTend,
  onUndo,
  onPersonSelect,
  onGoToPeople,
  onRestoreRhythm,
  onOpenFoundation,
  onOpenCategory
}: FriendshipsViewProps) {
  const [tab, setTab] = useState<FriendshipTab>('today');
  const [historyPersonId, setHistoryPersonId] = useState<PersonId | null>(null);
  const [connectionEditor, setConnectionEditor] = useState<{
    record?: FriendshipConnection;
    participantId?: PersonId;
    type?: ConnectionType;
  } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const historyOpener = useRef<HTMLButtonElement | null>(null);
  const connectionOpener = useRef<HTMLButtonElement | null>(null);
  const wasHistoryOpen = useRef(false);
  const wasEditorOpen = useRef(false);
  const wasArchiveOpen = useRef(false);
  const archiveOpener = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (historyPersonId !== null) {
      wasHistoryOpen.current = true;
      return;
    }
    if (wasHistoryOpen.current) {
      wasHistoryOpen.current = false;
      historyOpener.current?.focus();
    }
  }, [historyPersonId]);

  useEffect(() => {
    if (connectionEditor) {
      wasEditorOpen.current = true;
      return;
    }
    if (wasEditorOpen.current) {
      wasEditorOpen.current = false;
      if (connectionOpener.current?.isConnected) {
        connectionOpener.current.focus();
      } else if (historyPersonId !== null) {
        document.querySelector<HTMLButtonElement>('#friendships-history-dialog-close')?.focus();
      } else {
        const selectedIndex = friendshipTabs.findIndex(item => item.id === tab);
        tabRefs.current[selectedIndex]?.focus();
      }
    }
  }, [connectionEditor, historyPersonId, tab]);

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

  function selectTab(next: FriendshipTab) {
    setTab(next);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let target: number | null = null;
    if (event.key === 'ArrowRight') target = (index + 1) % friendshipTabs.length;
    else if (event.key === 'ArrowLeft') target = (index - 1 + friendshipTabs.length) % friendshipTabs.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = friendshipTabs.length - 1;
    if (target === null) return;
    event.preventDefault();
    const next = friendshipTabs[target]!;
    setTab(next.id);
    tabRefs.current[target]?.focus();
  }

  function openHistory(personId: PersonId, event: MouseEvent<HTMLButtonElement>) {
    historyOpener.current = event.currentTarget;
    setHistoryPersonId(personId);
  }

  function openNewConnection(
    event: MouseEvent<HTMLButtonElement>,
    participantId?: PersonId,
    type: ConnectionType = 'text'
  ) {
    connectionOpener.current = event.currentTarget;
    setConnectionEditor({ ...(participantId ? { participantId } : {}), type });
  }

  function openEditConnection(record: FriendshipConnection, event: MouseEvent<HTMLButtonElement>) {
    connectionOpener.current = event.currentTarget;
    setConnectionEditor({ record });
  }

  function saveConnection(connection: FriendshipConnection): string | null {
    const next = addOrUpdateConnection(data, connection);
    onChange(next);
    return null;
  }

  const friendIds = personGroupMemberIds(peopleGroups, 'friends');
  const statuses = selectFriendStatuses(data, friendIds, today);
  const dueStatuses = statuses.filter(status => status.due);
  const configuredCadenceCount = statuses.filter(status => status.cadence !== null).length;
  const activeHistory = historyPersonId === null
    ? []
    : connectionsForPerson(data, historyPersonId);
  const editorParticipantIds = connectionEditor
    ? connectionEditor.record?.participantIds ?? (connectionEditor.participantId ? [connectionEditor.participantId] : [])
    : [];
  return (
    <main className="category-page category-page--with-header friendships-page" aria-labelledby="friendships-page-title">
      <CategoryHeader
        title="Friendships"
        titleId="friendships-page-title"
        trailing={<span className="menu-area-icon"><AreaIcon id="friendships" variant="today-summary" /></span>}
      />
      <div className="faith-view-nav marriage-view-nav" role="tablist" aria-label="Friendships">
        {friendshipTabs.map((item, index) => (
          <button
            key={item.id}
            ref={element => { tabRefs.current[index] = element; }}
            id={`friendships-tab-${item.id}`}
            type="button"
            role="tab"
            aria-controls={`friendships-panel-${item.id}`}
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
        id="friendships-panel-today"
        className="friendships-panel marriage-view-panel"
        role="tabpanel"
        aria-labelledby="friendships-tab-today"
        hidden={tab !== 'today'}
      >
        {statuses.length === 0 ? (
          <div className="friendships-empty-state">
            <p>No friends yet.</p>
            <button type="button" className="btn mini ghost" onClick={onGoToPeople}>Go to People</button>
          </div>
        ) : dueStatuses.length > 0 ? (
          <div className="friendships-due-list">
            {dueStatuses.map(status => (
              <DueFriendRow
                key={status.personId}
                status={status}
                today={today}
                onLog={event => openNewConnection(event, status.personId)}
              />
            ))}
          </div>
        ) : configuredCadenceCount === 0 ? (
          <p className="friendships-empty">No connection cadences set.</p>
        ) : (
          <p className="friendships-caught-up">You’re caught up.</p>
        )}
      </section>

      <section
        id="friendships-panel-friends"
        className="friendships-panel marriage-view-panel"
        role="tabpanel"
        aria-labelledby="friendships-tab-friends"
        hidden={tab !== 'friends'}
      >
        <div className="friendships-section-heading">
          <h3>Friends</h3>
        </div>
        {statuses.length === 0 ? (
          <div className="friendships-empty-state">
            <p>No friends yet.</p>
            <p>Add people and mark them as friends.</p>
            <button type="button" className="btn mini ghost" onClick={onGoToPeople}>Go to People</button>
          </div>
        ) : (
          <div className="friendships-friend-list">
            {statuses.map(status => (
              <FriendRow
                key={status.personId}
                status={status}
                today={today}
                connections={connectionsForPerson(data, status.personId)}
                classifications={peopleGroups.filter(group => group.memberIds.includes(status.personId))}
                data={data}
                onChange={onChange}
                onPersonSelect={onPersonSelect}
                onHistory={event => openHistory(status.personId, event)}
                onQuickLog={(type, event) => openNewConnection(event, status.personId, type)}
              />
            ))}
          </div>
        )}
      </section>

      <section
        id="friendships-panel-rhythms"
        className="friendships-panel marriage-view-panel"
        role="tabpanel"
        aria-labelledby="friendships-tab-rhythms"
        hidden={tab !== 'rhythms'}
      >
        <div className="friendships-section-heading">
          <h3>Rhythms</h3>
          <button type="button" className="btn mini" onClick={onAddRhythm}>Add Rhythm</button>
        </div>
        {rhythms.length > 0 ? (
          <div className="marriage-rhythm-list current-plan-item-group">
            {rhythms.map(rhythm => (
              <RhythmDetailsDialog
                key={rhythm.id}
                rhythm={rhythm}
                inline
                headingId={`friendships-rhythm-${rhythm.id}`}
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
          <p className="friendships-empty">No active Rhythms yet.</p>
        )}
        <button
          ref={archiveOpener}
          type="button"
          className="category-archived-rhythms-toggle"
          aria-haspopup="dialog"
          onClick={() => setShowArchived(true)}
        >
          Archived rhythms ({archivedRhythms.length})
        </button>
      </section>

      {historyPersonId !== null && (
        <ConnectionHistoryDialog
          personId={historyPersonId}
          connections={activeHistory}
          data={data}
          onChange={onChange}
          onPersonSelect={onPersonSelect}
          onEdit={openEditConnection}
          onClose={() => setHistoryPersonId(null)}
        />
      )}
      {connectionEditor && (
        <ConnectionEditor
          key={connectionEditor.record?.id ?? connectionEditor.participantId ?? 'new'}
          {...(connectionEditor.record ? { record: connectionEditor.record } : {})}
          initialParticipantIds={editorParticipantIds}
          {...(connectionEditor.type ? { initialType: connectionEditor.type } : {})}
          today={today}
          onSave={saveConnection}
          onClose={() => setConnectionEditor(null)}
        />
      )}
      {showArchived && (
        <ArchivedRhythmsDialog
          rhythms={archivedRhythms}
          completedRhythms={completedRhythms}
          onPersonSelect={onPersonSelect}
          onRestore={onRestoreRhythm}
          onClose={() => setShowArchived(false)}
        />
      )}
    </main>
  );
}

function DueFriendRow({
  status,
  today,
  onLog
}: {
  status: ReturnType<typeof friendConnectionStatus>;
  today: string;
  onLog: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const person = personById(status.personId);
  return (
    <article className="friendships-due-row">
      <div className="friendships-person">
        <PersonBadge person={person} presentation="static" displayNameMode="full" />
        <div className="friendships-person__details">
          <p>{status.cadence ? cadenceLabels[status.cadence] : 'No cadence'}</p>
          <p>{status.lastConnection
            ? `Last connected ${formatFriendDate(status.lastConnection.date, today)}`
            : 'No connections yet'}</p>
        </div>
      </div>
      <button type="button" className="btn mini" onClick={onLog}>Log connection</button>
    </article>
  );
}

function FriendRow({
  status,
  today,
  connections,
  classifications,
  data,
  onChange,
  onPersonSelect,
  onHistory,
  onQuickLog
}: {
  status: ReturnType<typeof friendConnectionStatus>;
  today: string;
  connections: FriendshipConnection[];
  classifications: readonly Pick<PersonPickerGroup, 'id' | 'label'>[];
  data: FriendshipData;
  onChange: (data: FriendshipData) => void;
  onPersonSelect: (id: PersonId) => void;
  onHistory: (event: MouseEvent<HTMLButtonElement>) => void;
  onQuickLog: (type: ConnectionType, event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const person = personById(status.personId);
  const last = connections[0] ?? null;
  return (
    <PeopleCard
      person={person}
      classifications={classifications}
      {...(last ? { connectionRecency: `Last connected ${formatFriendDate(last.date, today)}` } : {})}
      onSelect={onPersonSelect}
      className="friendships-friend-row"
      identityClassName="friendships-friend-row__identity"
      connectionClassName="friendships-friend-row__last"
    >
      <FriendshipCadenceControl
        personId={status.personId}
        cadence={status.cadence}
        today={today}
        data={data}
        onChange={onChange}
      />
      <ConnectionTypeActions
        personId={status.personId}
        onSelect={(type, event) => onQuickLog(type, event)}
      />
      <button type="button" className="friendships-history-button" onClick={onHistory}>
        View connections{connections.length > 0 ? ` (${connections.length})` : ''}
      </button>
    </PeopleCard>
  );
}

function formatFriendDate(value: string, today: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const currentYear = Number(today.slice(0, 4));
  return new Date(year!, month! - 1, day!, 12).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(year !== currentYear ? { year: 'numeric' as const } : {})
  });
}
