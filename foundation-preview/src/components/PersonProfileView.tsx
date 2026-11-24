import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import {
  addOrUpdateConnection,
  connectionsForPerson,
  deleteConnection,
  friendConnectionStatus,
  formatConnectionRecency,
  reconcileDirectRhythmConnectionEdit
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
import { BackButton } from './BackButton.tsx';
import { SettingsGearButton } from './SettingsGearButton.tsx';
import { ConnectionEditor, ConnectionHistoryList } from './FriendshipConnectionControls.tsx';
import { PersonAvatar, personFirstName } from './PersonBadge.tsx';
import { PersonProfileTabHeader } from './PersonProfileTabHeader.tsx';
import { RhythmDetailsDialog } from './RhythmDetailsDialog.tsx';
import { selectPersonRhythmsDueToday } from '../domain/person-rhythms.ts';
import type { Destination } from './AppNavigation.tsx';
import {
  birthdayCardSummary,
  personDetailsForId,
  personWithSavedPhoto
} from '../domain/person-details.ts';
import type { PersonDetails } from '../domain/person-details.ts';
import { PersonNotesIcon, PersonNotesPanel } from './PersonNotesPanel.tsx';
import { ArchivedRhythmsControl } from './ArchivedRhythmsControl.tsx';
import { personNotesForPerson } from '../domain/person-notes.ts';
import type { PersonNote, PersonNoteDraft } from '../domain/person-notes.ts';
import { resolvePersonCategory } from '../domain/person-categories.ts';
import { BirthdayCakeIcon } from './BirthdayCakeIcon.tsx';
import {
  PersonHealthComponentScores,
  PersonHealthSummary,
  PersonHealthAreaDetails,
  PersonOverallHealthDetails
} from './PersonHealthSummary.tsx';
import type { HealthAggregateEvidence } from './HealthScoringDetailsCard.tsx';
import { createPersonHealthRollup } from './HealthRollupDiagram.tsx';
import { TendedRhythmList } from './TendedRhythmList.tsx';
import { TendedRhythmItems } from './TendedRhythmItems.tsx';
import { selectTendedRhythmDisplayIds } from '../domain/category-rhythms.ts';
import { useAvailablePersonGroups, usePrayerEnabled } from './CategoryAvailabilityContext.tsx';
import { PersonPrayerPanel } from './PersonPrayerPanel.tsx';
import { PersonSparkPanel } from './PersonSparkPanel.tsx';
import { selectPersonOverallHealth, selectPersonRhythmHealth } from '../domain/person-health.ts';
import { selectPersonPrayerHealth } from '../domain/person-prayer-health.ts';
import { useTimeBlockSettings } from './TimeBlocksContext.tsx';
import {
  PERSON_CONNECTION_HEALTH_SCORING_EXPLANATION,
  selectPersonConnectionHealth
} from '../domain/person-connection-health.ts';
import { personPrayerRequestsForPerson } from '../domain/person-prayers.ts';
import type { PersonSparkDraft, PersonSpark } from '../domain/person-sparks.ts';
import { connectionCadenceOptions } from './PersonConnectionCadenceSelect.tsx';
import type {
  PersonPrayerLog,
  PersonPrayerLogUndo,
  PersonPrayerRequest,
  PersonPrayerRequestDraft,
  PrayerRequestTransition
} from '../domain/person-prayers.ts';

export type ProfileTab = 'rhythms' | 'connections' | 'prayer';

export type PersonProfileNavigationRequest = {
  personId: PersonId;
  requestId: number;
  tab: ProfileTab;
  targetPrayerRequestId?: string;
  sparkCompletionId?: string;
  openNotes?: boolean;
};

const profileTabs: { id: ProfileTab; label: string }[] = [
  { id: 'rhythms', label: 'Rhythms' },
  { id: 'connections', label: 'Connections' },
  { id: 'prayer', label: 'Prayer' }
];

function excludedRhythmReason(score: RhythmScoreResult | undefined): string {
  if (!score || score.kind !== 'rhythm-score') return 'Needs scoring data';
  const missingMeasures = [
    ...(score.consistency.kind === 'scored' && Number.isFinite(score.consistency.score) ? [] : ['Consistency']),
    ...(score.onTrack.kind === 'scored' && Number.isFinite(score.onTrack.score) ? [] : ['On Track'])
  ];
  return missingMeasures.length === 2
    ? 'Needs scoring data'
    : `Needs ${missingMeasures[0]} score`;
}

export function PersonProfileView({
  personId,
  people = syntheticPeople,
  peopleGroups,
  friendships,
  today,
  prayerHealthTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  prayerHealthInstant = new Date(),
  rhythms,
  archivedRhythms,
  foundations,
  rhythmScores,
  completedRhythms,
  undoableRhythms,
  satisfiedRhythmIds = new Set(),
  tendedRhythmIds: savedTendedRhythmIds,
  initializing = false,
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
  onSavePrayerLog,
  onDeletePrayerLog,
  onUndoDeletePrayerLog,
  onRemovePrayerRequest,
  personSparks = [],
  onCreatePersonSpark,
  onUpdatePersonSpark,
  onArchivePersonSpark,
  onDeletePersonSpark,
  onUndoPersonSparkCompletion,
  onCompletePersonSpark,
  onSaveConnection,
  onDeleteConnection,
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
  navigationRequest,
  onClose
}: {
  personId: PersonId;
  people?: readonly PersonPreview[];
  peopleGroups: readonly PersonPickerGroup[];
  friendships: FriendshipData;
  today: string;
  prayerHealthTimeZone?: string;
  prayerHealthInstant?: Date;
  rhythms: readonly RhythmPreview[];
  archivedRhythms: readonly RhythmPreview[];
  foundations: readonly FoundationPreview[];
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>;
  completedRhythms: ReadonlySet<string>;
  undoableRhythms: ReadonlySet<string>;
  satisfiedRhythmIds?: ReadonlySet<string>;
  tendedRhythmIds?: ReadonlySet<string>;
  initializing?: boolean;
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
  onSavePrayerLog?: (
    requestId: string,
    expectedUpdatedAt: string,
    actorId: PersonId,
    log: PersonPrayerLog
  ) => string | null;
  onDeletePrayerLog?: (
    requestId: string,
    expectedUpdatedAt: string,
    actorId: PersonId,
    logId: string
  ) => PersonPrayerLogUndo | string;
  onUndoDeletePrayerLog?: (undo: PersonPrayerLogUndo, actorId: PersonId) => string | null;
  onRemovePrayerRequest?: (requestId: string, expectedUpdatedAt: string, actorId: PersonId) => string | null;
  personSparks?: readonly PersonSpark[];
  onCreatePersonSpark?: (ownerId: PersonId, draft: PersonSparkDraft) => string | null;
  onUpdatePersonSpark?: (sparkId: string, draft: PersonSparkDraft) => string | null;
  onArchivePersonSpark?: (sparkId: string, archived: boolean) => string | null;
  onDeletePersonSpark?: (sparkId: string, viewerId: PersonId) => string | null;
  onUndoPersonSparkCompletion?: (sparkId: string) => string | null;
  onCompletePersonSpark?: (sparkId: string, connection: FriendshipConnection) => string | null;
  onSaveConnection?: (connection: FriendshipConnection) => string | null;
  onDeleteConnection?: (connectionId: string) => string | null;
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
  navigationRequest?: PersonProfileNavigationRequest | null;
  onClose: () => void;
}) {
  const timeBlockSettings = useTimeBlockSettings();
  const tendedRhythmIds = savedTendedRhythmIds
    ?? selectTendedRhythmDisplayIds(completedRhythms, satisfiedRhythmIds);
  const details = personDetailsForId(personDetails, personId);
  const person = personWithSavedPhoto(personById(people, personId), personDetails ?? []);
  const [tab, setTab] = useState<ProfileTab>('rhythms');
  const [targetPrayerRequestId, setTargetPrayerRequestId] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const prayerEnabled = usePrayerEnabled();
  const visibleProfileTabs = prayerEnabled ? profileTabs : profileTabs.filter(item => item.id !== 'prayer');
  const lastHandledNavigationRequest = useRef<number | null>(null);
  const previousProfilePersonId = useRef(personId);

  useLayoutEffect(() => {
    if (previousProfilePersonId.current !== personId) setNotesOpen(false);
    previousProfilePersonId.current = personId;
  }, [personId]);

  useEffect(() => {
    if (!navigationRequest || navigationRequest.personId !== personId) return;
    if (lastHandledNavigationRequest.current === navigationRequest.requestId) return;
    lastHandledNavigationRequest.current = navigationRequest.requestId;
    if (!prayerEnabled && navigationRequest.tab === 'prayer') return;
    setTab(navigationRequest.tab);
    setTargetPrayerRequestId(navigationRequest.targetPrayerRequestId ?? null);
    setNotesOpen(navigationRequest.openNotes === true);
    if (navigationRequest.sparkCompletionId) {
      const spark = personSparks.find(item => item.id === navigationRequest.sparkCompletionId);
      if (spark) openSparkCompletion(spark);
    }
  }, [navigationRequest, personId, prayerEnabled, personSparks]);
  useEffect(() => {
    if (prayerEnabled || tab !== 'prayer') return;
    setTab('rhythms');
    setNotesOpen(false);
    tabRefs.current[0]?.focus({ preventScroll: true });
  }, [prayerEnabled, tab]);
  const [connectionEditor, setConnectionEditor] = useState<{
    record?: FriendshipConnection;
    sparkId?: string;
  } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedPersonId, setArchivedPersonId] = useState<PersonId | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const notesDockOpener = useRef<HTMLButtonElement | null>(null);
  const connectionOpener = useRef<HTMLButtonElement | null>(null);
  const wasEditorOpen = useRef(false);
  const archiveOpener = useRef<HTMLElement | null>(null);
  const wasArchiveOpen = useRef(false);
  const connectionHistory = connectionsForPerson(friendships, personId);
  const personConnectionStatus = friendConnectionStatus(friendships, personId, today);
  const availablePeopleGroups = useAvailablePersonGroups(peopleGroups);
  const classifications = availablePeopleGroups.filter(group => group.memberIds.includes(personId));
  const resolvedCategory = resolvePersonCategory(classifications.map(group => group.id));
  const categoryLabel = resolvedCategory === 'friends'
    ? 'Friends'
    : resolvedCategory === 'marriage'
      ? 'Marriage'
      : resolvedCategory === 'parenting'
        ? 'Parenting'
        : null;
  const profileNotes = personNotesForPerson(personNotes, personId);
  const birthdaySummaryForProfile = details?.birthday
    ? birthdayCardSummary(details.birthday, today)
    : null;
  const personRhythms = rhythms.filter(rhythm => rhythm.personIds?.includes(personId));
  const archivedRhythmIds = new Set(archivedRhythms.map(rhythm => rhythm.id));
  const personRhythmHealth = selectPersonRhythmHealth(
    personId,
    [...rhythms, ...archivedRhythms],
    rhythmScores,
    archivedRhythmIds
  );
  const personConnectionHealth = selectPersonConnectionHealth(friendships, personId, today);
  const personPrayerHealth = selectPersonPrayerHealth(
    prayerRequests,
    personId,
    today,
    prayerHealthTimeZone,
    prayerHealthInstant,
    timeBlockSettings
  );
  const overallHealth = selectPersonOverallHealth(
    personRhythmHealth,
    personConnectionHealth,
    personPrayerHealth,
    prayerEnabled
  );
  const componentScores = [
    { id: 'rhythms', label: 'Rhythms', score: personRhythmHealth.health },
    {
      id: 'connections',
      label: 'Connections',
      score: personConnectionHealth.score,
      ...(personConnectionHealth.unavailableReason
        ? { unavailableReason: personConnectionHealth.unavailableReason }
        : {})
    },
    ...(prayerEnabled ? [{
      id: 'prayer' as const,
      label: 'Prayer',
      score: personPrayerHealth.score,
      ...(personPrayerHealth.score === null && personPrayerHealth.unavailableReason
        ? { unavailableReason: personPrayerHealth.unavailableReason }
        : {})
    }] : [])
  ] as const;
  const connectionCadenceLabel = personConnectionStatus.cadence
    ? connectionCadenceOptions.find(option => option.value === personConnectionStatus.cadence)?.label
      ?? personConnectionStatus.cadence
    : 'No cadence configured';
  const personPrayerRecords = personPrayerRequestsForPerson(prayerRequests, personId);
  const personPrayerLogCount = personPrayerRecords.reduce(
    (count, request) => count + request.prayerLogs.length,
    0
  );
  const personRhythmById = new Map([...rhythms, ...archivedRhythms]
    .filter(rhythm => rhythm.personIds?.includes(personId))
    .map(rhythm => [rhythm.id, rhythm]));
  const rhythmEvidenceRows = personRhythmHealth.eligibleRhythmIds.flatMap(id => {
    const rhythm = personRhythmById.get(id);
    const score = rhythmScores.get(id);
    return rhythm && score?.kind === 'rhythm-score'
      && score.consistency.kind === 'scored'
      && score.onTrack.kind === 'scored'
      ? [{
          id,
          label: rhythm.title,
          consistency: score.consistency.score,
          onTrack: score.onTrack.score
        }]
      : [];
  });
  const excludedRhythmEvidenceRows = [
    ...personRhythmHealth.excludedRhythmIds.map(id => ({
      id,
      reason: excludedRhythmReason(rhythmScores.get(id))
    })),
    ...personRhythmHealth.unresolvedRhythmIds.map(id => ({
      id,
      reason: 'Needs scoring data'
    }))
  ].map(row => ({
    ...row,
    label: personRhythmById.get(row.id)?.title ?? row.id
  }));
  const personRhythmScoringEvidence: HealthAggregateEvidence = {
    heading: 'Scored Rhythms',
    itemLabel: 'Rhythm',
    rows: rhythmEvidenceRows,
    excludedRows: excludedRhythmEvidenceRows,
    consistencyAverage: personRhythmHealth.consistency,
    consistencyCount: rhythmEvidenceRows.length,
    onTrackAverage: personRhythmHealth.onTrack,
    onTrackCount: rhythmEvidenceRows.length,
    presentation: 'person-rhythm',
    countLabel: `${rhythmEvidenceRows.length} of ${personRhythmHealth.activeRhythmIds.length}`,
    emptyState: 'No Rhythms have both scores available.'
  };
  const personAreaHealth = {
    rhythms: { label: 'Rhythm' as const, health: personRhythmHealth, supportsMeasures: true },
    connections: {
      label: 'Connection' as const,
      health: {
        consistency: null,
        onTrack: null,
        health: personConnectionHealth.score
      },
      supportsMeasures: false
    },
    prayer: {
      label: 'Prayer' as const,
      health: { consistency: null, onTrack: null, health: personPrayerHealth.score },
      supportsMeasures: false
    }
  };
  const latestConnection = personConnectionHealth.latestConnection;
  const latestConnectionLabel = latestConnection
    ? formatConnectionRecency(latestConnection.date, today)
    : null;
  const activePrayerRequestIds = new Set(personPrayerHealth.activeRequestIds);
  const latestPrayerDate = personPrayerHealth.requests
    .filter(request => activePrayerRequestIds.has(request.requestId))
    .flatMap(request => request.latestPrayerDate ? [request.latestPrayerDate] : [])
    .sort()
    .at(-1);

  function healthDetailsFor(area: ProfileTab) {
    const config = personAreaHealth[area];
    const areaScoreId = area === 'connections' ? 'connection' : area;
    const areaScore = componentScores.find(score => score.id === area)?.score ?? null;
    const contributes = overallHealth.eligibleComponentIds.includes(areaScoreId);
    const inputRows = area === 'connections'
      ? [
          ['Eligible connections', String(personConnectionHealth.eligibleConnectionCount)],
          ['Connection frequency', connectionCadenceLabel],
          ['Latest eligible connection', latestConnection?.date ?? '—']
        ] as const
      : area === 'prayer'
        ? [
            ['Prayer requests', String(personPrayerRecords.length)],
            ['Active requests', String(personPrayerHealth.activeRequestIds.length)],
            ['Requests with Health', String(personPrayerHealth.scoredRequestIds.length)],
            ['Missing frequency', String(personPrayerHealth.missingFrequencyRequestIds.length)],
            ['No eligible history', String(personPrayerHealth.noHistoryRequestIds.length)],
            ['Prayer logs', String(personPrayerLogCount)],
            ['Most recent prayer', latestPrayerDate ?? '—']
          ] as const
        : [];
    const unavailableInputs = inputRows.length > 0
      ? <PersonHealthInputFacts rows={inputRows} />
      : undefined;
    return (
      <PersonHealthAreaDetails
        person={person}
        areaLabel={config.label}
        health={config.health}
        supportsMeasures={config.supportsMeasures}
        rollup={createPersonHealthRollup({
          personName: personFirstName(person.displayName),
          areaLabel: config.label,
          areaScore,
          overallScore: overallHealth.health,
          contributes
        })}
        {...(area === 'rhythms' ? { evidence: personRhythmScoringEvidence } : {})}
        {...(!config.supportsMeasures ? {
          ...(area === 'connections' && personConnectionHealth.score !== null
            ? { scoringExplanation: PERSON_CONNECTION_HEALTH_SCORING_EXPLANATION }
            : area === 'prayer' && personPrayerHealth.score !== null
              ? { scoringExplanation: personPrayerHealth.unavailableReason ?? 'Available active prayer request Health scores are averaged equally.' }
            : {
                unavailableExplanation: area === 'connections'
                  ? personConnectionHealth.unavailableReason ?? 'Connection Health is unavailable.'
                  : area === 'prayer'
                    ? personPrayerHealth.unavailableReason ?? 'Prayer Health is unavailable.'
                    : `${config.label} Health is unavailable in this preview.`
              }),
          ...(unavailableInputs ? { unavailableInputs } : {})
        } : {})}
      />
    );
  }

  function PersonHealthInputFacts({
    rows
  }: {
    rows: readonly (readonly [string, string])[];
  }) {
    return (
      <dl className="person-health-input-facts">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    );
  }
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
    if (next === 'prayer' && !prayerEnabled) return;
    setTab(next);
    setNotesOpen(false);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let target: number | null = null;
    if (event.key === 'ArrowRight') target = (index + 1) % visibleProfileTabs.length;
    else if (event.key === 'ArrowLeft') target = (index - 1 + visibleProfileTabs.length) % visibleProfileTabs.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = visibleProfileTabs.length - 1;
    if (target === null) return;
    event.preventDefault();
    selectTab(visibleProfileTabs[target]!.id);
    tabRefs.current[target]?.focus();
  }

  function openConnectionDraft(event: MouseEvent<HTMLButtonElement>) {
    connectionOpener.current = event.currentTarget;
    setConnectionEditor({});
  }

  function openEditConnection(record: FriendshipConnection, event: MouseEvent<HTMLButtonElement>) {
    connectionOpener.current = event.currentTarget;
    setConnectionEditor({ record });
  }

  function openSparkCompletion(spark: PersonSpark, opener?: HTMLButtonElement) {
    connectionOpener.current = opener ?? null;
    setConnectionEditor({ sparkId: spark.id });
  }

  function renderPersonRhythm(
    rhythm: RhythmPreview,
    displayTended = completedRhythms.has(rhythm.id),
    undoRhythm: (rhythmId: string) => void = onUndo
  ) {
    return (
      <RhythmDetailsDialog
        key={rhythm.id}
        rhythm={rhythm}
        inline
        headingId={`person-profile-rhythm-${personId}-${rhythm.id}`}
        people={peopleForRhythm(rhythm, people)}
        foundations={foundations}
        relatedRhythms={rhythms}
        onPersonSelect={onPersonSelect}
        onOpenFoundation={onOpenFoundation}
        onOpenCategory={onOpenCategory}
        completed={displayTended}
        healthScore={rhythmHealthScore(rhythmScores.get(rhythm.id))}
        onHistory={event => onRhythmHistory(rhythm.id, event)}
        {...(isEditableRhythmId(rhythm.id)
          ? {
              onTend: (event: MouseEvent<HTMLButtonElement>) => onTend(rhythm.id, event),
              onEdit: (event: MouseEvent<HTMLButtonElement>) => onEditRhythm(rhythm, event),
              ...(completedRhythms.has(rhythm.id) && undoableRhythms.has(rhythm.id) && !rhythm.healthLogCapability
                ? { onUndo: () => undoRhythm(rhythm.id) }
                : {})
            }
          : {})}
        onClose={() => undefined}
      />
    );
  }

  return (
    <main className="person-profile-page" aria-labelledby="person-profile-title">
      <div className="person-profile-page__back">
        <BackButton onClick={onClose}>Back to {returnLabel}</BackButton>
      </div>
      <section className="person-profile__content" aria-labelledby="person-profile-title">
          <div className="people-card person-profile__identity-card">
          <header className="people-card__header person-profile__identity">
            <div className="people-card__identity">
              <PersonAvatar person={person} />
              <div className="people-card__identity-copy">
                <h2 id="person-profile-title" className="people-card__name">{person.displayName}</h2>
                {details?.relationshipLabel && (
                  <span className="people-card__relationship">
                    {resolvedCategory && (
                      <span
                        className={`people-card__relationship-dot people-card__relationship-dot--${resolvedCategory}`}
                        aria-hidden="true"
                      />
                    )}
                    {details.relationshipLabel}
                  </span>
                )}
              </div>
            </div>
            {onEditPerson && (
              <SettingsGearButton
                label="Person settings"
                onClick={event => onEditPerson(personId, event)}
              />
            )}
          </header>
          {(categoryLabel || latestConnectionLabel) && (
            <div className="people-card__meta-row" aria-label={`${person.displayName} personal details`}>
              {categoryLabel && (
                <div className="people-card__classifications" role="group" aria-label={`${person.displayName} relationship group`}>
                  <span className={`people-card__classification people-card__classification--${resolvedCategory}`}>
                    <span aria-hidden="true" />
                    {categoryLabel}
                  </span>
                </div>
              )}
              {latestConnectionLabel && (
                <span className="people-card__connection-detail" aria-label={`Last connected: ${latestConnectionLabel}`}>
                  <span className="people-card__connection-icon" aria-hidden="true">
                    <svg viewBox="0 0 20 20" fill="none" focusable="false">
                      <path d="M4.25 4.75h11.5v8H9l-3.5 2.5v-2.5H4.25z" />
                      <path d="M7 8h6M7 10.5h4" />
                    </svg>
                  </span>
                  <span className="people-card__connection-copy">
                    <span className="people-card__connection-label">Connected</span>
                    <time className="people-card__connection-time" dateTime={latestConnection?.date}>
                      {latestConnectionLabel}
                    </time>
                  </span>
                </span>
              )}
            </div>
          )}
          {birthdaySummaryForProfile && (
            <div className="people-card__birthday-footer">
              {birthdaySummaryForProfile && (
                <span
                  className="people-card__birthday"
                  aria-label={`Birthday: ${birthdaySummaryForProfile.dateLabel}, ${birthdaySummaryForProfile.countdownLabel}`}
                >
                  <BirthdayCakeIcon />
                  <span className="people-card__birthday-date">{birthdaySummaryForProfile.dateLabel}</span>
                  <span className="people-card__birthday-separator" aria-hidden="true">•</span>
                  <span className="people-card__birthday-countdown">{birthdaySummaryForProfile.countdownLabel}</span>
                </span>
              )}
              {birthdaySummaryForProfile?.age !== undefined && (
                <strong className="people-card__age" aria-label={`Age ${birthdaySummaryForProfile.age}`}>
                  Age {birthdaySummaryForProfile.age}
                </strong>
              )}
            </div>
          )}
          </div>
          <div className="person-profile-health-overview">
            <PersonHealthSummary
              key={`${personId}:overall-health`}
              title="Health"
              ariaLabel="Overall Health summary"
              summaryDisclosureLabel="Overall Health component scores"
              infoLabel="Overall Health"
              scoreLabel="Overall Health score"
              progressLabel="Overall Health progress score"
              health={overallHealth}
              itemTerm="component"
              totalCount={overallHealth.componentIds.length}
              eligibleCount={overallHealth.eligibleComponentIds.length}
              excludedCount={overallHealth.excludedComponentIds.length}
              unscoredCount={overallHealth.unscoredComponentIds.length}
              showMeasures={false}
              showHealthMeter
              headerStyle="category"
              detailsDialogTitle={`${personFirstName(person.displayName)}’s Overall Health details`}
              detailsLabel={`${person.displayName}’s Overall Health scoring explanation`}
              detailsContent={(
                <PersonOverallHealthDetails
                  person={person}
                  overallScore={overallHealth.health}
                  areas={componentScores}
                  areaDetails={{
                    rhythms: {
                      title: `${personFirstName(person.displayName)}’s Rhythm Health details`,
                      content: healthDetailsFor('rhythms')
                    },
                    connections: {
                      title: `${personFirstName(person.displayName)}’s Connection Health details`,
                      content: healthDetailsFor('connections')
                    },
                    ...(prayerEnabled ? { prayer: {
                      title: `${personFirstName(person.displayName)}’s Prayer Health details`,
                      content: healthDetailsFor('prayer')
                    } } : {})
                  }}
                />
              )}
              summaryContent={(
                <PersonHealthComponentScores values={componentScores} />
              )}
            />
          </div>
          <div className={`faith-view-nav marriage-view-nav person-profile__nav${prayerEnabled ? '' : ' person-profile__nav--prayer-disabled'}`} role="tablist" aria-label={`${person.displayName} profile`}>
            {visibleProfileTabs.map((item, index) => (
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
            hidden={notesOpen || tab !== 'rhythms'}
          >
            <PersonProfileTabHeader
              title="Rhythms"
              subtitle={`${duePersonRhythms.length} in queue`}
              {...(showAddRhythm
                ? {
                    actionLabel: 'Add rhythm',
                    onAction: (event: MouseEvent<HTMLButtonElement>) => onAddRhythm(event, personId)
                  }
                : {})}
            />
            <TendedRhythmList
              rhythms={duePersonRhythms}
              tendedRhythmIds={tendedRhythmIds}
              satisfiedRhythmIds={satisfiedRhythmIds}
              undoableRhythmIds={undoableRhythms}
              displayMode="done-rows"
              todayDate={today}
              onUndo={onUndo}
              resetKey={`${personId}:${tab}:${today}`}
              initializing={initializing}
            >
              {({
                tendedRhythmIds: displayedTendedIds,
                tendedDisplayItems,
                expandedTendedRhythmIds,
                onToggleTendedRhythm,
                onUndoTendedRhythm,
                itemProps
              }) => {
                return duePersonRhythms.length > 0
                  ? (
                    <TendedRhythmItems
                      className="marriage-rhythm-list current-plan-item-group"
                      rhythms={duePersonRhythms}
                      tendedRhythmIds={displayedTendedIds}
                      displayItems={tendedDisplayItems}
                      expandedRhythmIds={expandedTendedRhythmIds}
                      onToggleRhythm={onToggleTendedRhythm}
                      itemProps={itemProps}
                      renderRhythmCard={rhythm => renderPersonRhythm(
                        rhythm,
                        displayedTendedIds.has(rhythm.id)
                      )}
                      renderExpandedRhythm={item => renderPersonRhythm(
                        item.rhythm,
                        true,
                        onUndoTendedRhythm
                      )}
                    />
                  )
                  : (
                    <p className="friendships-empty">
                      {personRhythms.length === 0 ? 'No Rhythms yet.' : 'No Rhythms due today.'}
                    </p>
                  );
              }}
            </TendedRhythmList>
            {otherPersonRhythms.length > 0 && (
              <section className="person-profile__other-rhythms" aria-labelledby="person-profile-other-rhythms">
                <h4 id="person-profile-other-rhythms">Other Rhythms</h4>
                <div className="marriage-rhythm-list current-plan-item-group">
                  {otherPersonRhythms.map(rhythm => renderPersonRhythm(rhythm))}
                </div>
              </section>
            )}
            <ArchivedRhythmsControl
              count={personArchivedRhythms.length}
              openerRef={archiveOpener}
              expanded={showArchived}
              onOpen={() => {
                setArchivedPersonId(personId);
                setShowArchived(true);
              }}
            />
          </section>
          <section
            id="person-profile-panel-connections"
            className="person-profile__panel marriage-view-panel"
            role="tabpanel"
            aria-labelledby="person-profile-tab-connections"
            hidden={notesOpen || tab !== 'connections'}
          >
            <PersonProfileTabHeader
              title="Connections"
              subtitle={`${connectionHistory.length} ${connectionHistory.length === 1 ? 'connection' : 'connections'}`}
              actionLabel="Add connection"
              actionRef={connectionOpener}
              onAction={openConnectionDraft}
            />
            <ConnectionHistoryList
              connections={connectionHistory}
              today={today}
              onEdit={openEditConnection}
            />
            <PersonSparkPanel
              personId={personId}
              people={people}
              peopleGroups={peopleGroups}
              sparks={personSparks}
              friendships={friendships}
              today={today}
              onCreate={draft => onCreatePersonSpark
                ? onCreatePersonSpark(personId, draft)
                : 'Sparks are unavailable.'}
              onUpdate={(sparkId, draft) => onUpdatePersonSpark
                ? onUpdatePersonSpark(sparkId, draft)
                : 'Sparks are unavailable.'}
              onArchive={(sparkId, archived) => onArchivePersonSpark
                ? onArchivePersonSpark(sparkId, archived)
                : 'Sparks are unavailable.'}
              onDelete={(sparkId, viewerId) => onDeletePersonSpark
                ? onDeletePersonSpark(sparkId, viewerId)
                : 'Sparks are unavailable.'}
              onUndo={sparkId => onUndoPersonSparkCompletion
                ? onUndoPersonSparkCompletion(sparkId)
                : 'Spark completion is unavailable.'}
              onComplete={openSparkCompletion}
              onPersonSelect={onPersonSelect}
            />
          </section>
          <section
            id="person-profile-panel-prayer"
            className="person-profile__panel marriage-view-panel"
            role="tabpanel"
            {...(prayerEnabled ? { 'aria-labelledby': 'person-profile-tab-prayer' } : {})}
            hidden={!prayerEnabled || notesOpen || tab !== 'prayer'}
          >
            <PersonPrayerPanel
              personId={personId}
              enabled={prayerEnabled}
              today={today}
              prayerHealthInstant={prayerHealthInstant}
              people={people}
              peopleGroups={peopleGroups}
              requests={prayerRequests}
              targetRequestId={targetPrayerRequestId}
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
              {...(onSavePrayerLog ? { onSaveLog: onSavePrayerLog } : {})}
              {...(onDeletePrayerLog ? { onDeleteLog: onDeletePrayerLog } : {})}
              {...(onUndoDeletePrayerLog ? { onUndoDeleteLog: onUndoDeletePrayerLog } : {})}
              onRemove={(requestId, expectedUpdatedAt, actorId) => onRemovePrayerRequest
                ? onRemovePrayerRequest(requestId, expectedUpdatedAt, actorId)
                : 'Prayer requests are unavailable.'}
            />
          </section>
          <div className="person-profile__notes-dock">
            <button
              ref={notesDockOpener}
              type="button"
              className="person-profile__notes-dock-button"
              aria-label={`Notes (${profileNotes.length})`}
              aria-controls={`person-profile-notes-drawer-${personId}`}
              aria-expanded={notesOpen}
              onClick={() => setNotesOpen(true)}
            >
              <span className="person-profile__notes-dock-label">
                <PersonNotesIcon />
                <span>Notes</span>
              </span>
              <span className="person-profile__notes-dock-actions">
                {profileNotes.length > 0 && (
                  <span className="person-profile__notes-count">{profileNotes.length}</span>
                )}
                <span className="person-profile__notes-chevron" aria-hidden="true">⌃</span>
              </span>
            </button>
          </div>
          <PersonNotesPanel
            personId={personId}
            people={people}
            peopleGroups={peopleGroups}
            notes={personNotes}
            canEdit={onUpdatePersonNote !== undefined}
            drawerOpen={notesOpen}
            drawerId={`person-profile-notes-drawer-${personId}`}
            openerRef={notesDockOpener}
            onDrawerClose={() => setNotesOpen(false)}
            onDrawerOpen={() => setNotesOpen(true)}
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
      {connectionEditor && (
        <ConnectionEditor
          key={connectionEditor.record?.id ?? `${personId}-${connectionEditor.sparkId ?? 'new'}`}
          {...(connectionEditor.record ? { record: connectionEditor.record } : {})}
          people={people}
          peopleGroups={peopleGroups}
          initialParticipantIds={connectionEditor.record?.participantIds ?? (() => {
            const spark = personSparks.find(item => item.id === connectionEditor.sparkId);
            return spark ? [spark.ownerId, ...spark.sharedWith] : [personId];
          })()}
          {...(connectionEditor.sparkId
            ? { sparkTitle: personSparks.find(item => item.id === connectionEditor.sparkId)?.title ?? 'Spark' }
            : {})}
          today={today}
          onSave={connection => {
            if (connectionEditor.sparkId) {
              return onCompletePersonSpark
                ? onCompletePersonSpark(connectionEditor.sparkId, connection)
                : 'Spark completion is unavailable.';
            }
            if (onSaveConnection) return onSaveConnection(connection);
            const existing = friendships.connections.find(item => item.id === connection.id);
            onConnectionChange(addOrUpdateConnection(
              friendships,
              reconcileDirectRhythmConnectionEdit(existing, connection)
            ));
            return null;
          }}
          onDelete={connectionId => onDeleteConnection
            ? onDeleteConnection(connectionId)
            : (onConnectionChange(deleteConnection(friendships, connectionId)), null)}
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
