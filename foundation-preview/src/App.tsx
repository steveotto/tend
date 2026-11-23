import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useCurrentInstant } from './components/useCurrentInstant.ts';
import type { MouseEvent } from 'react';
import { AppNavigation } from './components/AppNavigation.tsx';
import type { CategoryTabNavigationRequest, Destination } from './components/AppNavigation.tsx';
import {
  MarriageView,
  createMarriageSuggestionCatalogue,
  type CategoryRhythmSuggestion,
  type CategoryRhythmSuggestionCatalogue,
  type MarriageTab
} from './components/MarriageView.tsx';
import { MarriageIcon } from './components/MarriageIcon.tsx';
import { selectActiveUserRhythms, selectArchivedUserRhythms } from './domain/active-user-rhythms.ts';
import {
  foundationCategoryId,
  saveFoundationRhythmAssociations
} from './domain/foundation-rhythm-associations.ts';
import type { FoundationRhythmAssociationChange } from './domain/foundation-rhythm-associations.ts';
import { selectFoundationRhythmScores } from './domain/foundation-scoring.ts';
import {
  aggregateCategoryHealthScores,
  selectCardioCategoryScore,
  selectCategoryHealthScore,
  selectFoundationCategoryScore,
  selectHealthFitnessCategoryScore,
  selectStrengthCategoryScore,
  selectWeightCategoryScore
} from './domain/category-scoring.ts';
import { RhythmDetailsDialog } from './components/RhythmDetailsDialog.tsx';
import { RhythmCompletionDialog } from './components/RhythmCompletionDialog.tsx';
import { FinanceGoalsView } from './components/FinanceGoalsView.tsx';
import { PreviewDataControls } from './components/PreviewDataControls.tsx';
import type { PreviewPersistenceStatus } from './components/PreviewDataControls.tsx';
import { PreviewAccountSync } from './components/PreviewAccountSync.tsx';
import { PreviewBackupImportControl } from './components/PreviewBackupImportControl.tsx';
import { TextSizeSettings } from './components/TextSizeSettings.tsx';
import type { PreviewAccountBackupApi } from './storage/preview-account-backup.ts';
import { PersonProfileView } from './components/PersonProfileView.tsx';
import type { PersonProfileNavigationRequest, ProfileTab } from './components/PersonProfileView.tsx';
import { PersonDetailsEditor } from './components/PersonDetailsEditor.tsx';
import { PeopleView } from './components/PeopleView.tsx';
import { RhythmEditor } from './components/RhythmEditor.tsx';
import { TodayView } from './components/TodayView.tsx';
import { FocusDialog } from './components/FocusDialog.tsx';
import { TodayWeatherSettings } from './components/TodayWeatherSettings.tsx';
import { CalendarSourcesSettings } from './components/CalendarSourcesSettings.tsx';
import { CategorySettings } from './components/CategorySettings.tsx';
import { PrayerSettings } from './components/PrayerSettings.tsx';
import { CategoryAvailabilityProvider } from './components/CategoryAvailabilityContext.tsx';
import { TimeBlocksProvider } from './components/TimeBlocksContext.tsx';
import { TimeBlocksSettings } from './components/TimeBlocksSettings.tsx';
import { useTodayWeather } from './components/useTodayWeather.ts';
import type { TodayViewId } from './domain/today-plan.ts';
import { HealthFitnessView } from './components/HealthFitnessView.tsx';
import {
  connectionCadences,
  addOrUpdateConnection,
  detachRhythmCompletionOwnership,
  isRhythmCompletionConnectionUnchanged,
  reconcileDirectRhythmConnectionEdit,
  reconcileRhythmCompletionConnection,
  rhythmCompletionConnectionSnapshot,
  setPersonConnectionCadence
} from './domain/friendships.ts';
import type { FriendshipConnection } from './domain/friendships.ts';
import {
  completePersonSpark,
  createPersonSpark,
  deletePersonConnection,
  deletePersonSpark,
  savePersonConnection as savePersonConnectionCommand,
  setPersonSparkArchived,
  undoPersonSparkCompletion,
  updatePersonSpark
} from './domain/person-sparks.ts';
import type { PersonSpark, PersonSparkDraft } from './domain/person-sparks.ts';
import { selectGlobalSearchResults } from './domain/global-search.ts';
import type { GlobalSearchResult } from './domain/global-search.ts';
import { APP_DISPLAY_VERSION } from './domain/app-version.ts';
import { resolvePersonCategory, resolvePersonCategoryGroups, setPersonCategory } from './domain/person-categories.ts';
import {
  marriageRhythms,
  financeFoundations,
  foundationCatalogue,
  faithRhythmSuggestionGroups,
  faithRhythmSuggestions,
  financeRhythmSuggestionGroups,
  financeRhythmSuggestions,
  healthFitnessRhythmSuggestionGroups,
  healthFitnessRhythmSuggestions,
  parentingRhythmSuggestionGroups,
  parentingRhythmSuggestions,
  datingRhythmSuggestionGroups,
  datingRhythmSuggestions,
  personById,
  peopleForRhythm,
  syntheticPrayerRequests,
  todayRhythms,
  type CategoryRhythmSuggestionGroupDefinition,
  type CategoryRhythmSuggestionTemplate,
  type CategoryId,
  type PersonId,
  type PersonPickerGroupId,
  type PersonPreview,
  type RhythmPreview
} from './domain/preview-data.ts';
import { recordPreviewPrayer } from './domain/prayer-session.ts';
import type { PrayerRequestPreview } from './domain/prayer-session.ts';
import {
  saveCheckIn,
  type CheckInDraft,
  type CheckInDraftErrors,
  type GoalCheckIn,
  localDateString,
  type MoneyGoal
} from './domain/money-goals.ts';
import {
  createEmptyPreviewData,
  createSamplePreviewData,
  isPreviewDataPristine,
  parsePreviewBackup
} from './domain/preview-state.ts';
import type { PreviewData, PreviewTextSize } from './domain/preview-state.ts';
import { validateCalendarSources } from './domain/calendar-sources.ts';
import type { CalendarSource } from './domain/calendar-sources.ts';
import {
  isFoundationEnabled,
  isCategoryEnabled,
  setCategoryPreference as setCategoryPreferenceCommand,
  selectAvailableCategories,
  selectAvailableCategoryIds,
  selectAvailableFoundationIds,
  selectAvailableFoundations,
  selectAvailablePersonGroups
} from './domain/category-availability.ts';
import {
  DEVELOPMENT_PREVIEW_IDENTITY,
  PREVIEW_AUTH_PENDING,
  previewIdentityKey,
  validatePreviewIdentity
} from './domain/preview-identity.ts';
import type { PreviewIdentityState } from './domain/preview-identity.ts';
import {
  peopleWithSavedPhotos,
  savePersonDetailsCommand,
  personDetailsForId
} from './domain/person-details.ts';
import type { PersonDetailsDraft } from './domain/person-details.ts';
import {
  createPersonNote,
  deletePersonNote,
  updatePersonNote
} from './domain/person-notes.ts';
import type { PersonNoteDraft } from './domain/person-notes.ts';
import {
  createPersonPrayerRequest,
  deletePersonPrayerRequest,
  recordPersonPrayer,
  transitionPersonPrayerRequest,
  unlinkPersonPrayerRequest,
  updatePersonPrayerRequest
} from './domain/person-prayers.ts';
import type { PersonPrayerRequestDraft, PrayerRequestTransition } from './domain/person-prayers.ts';
import type { DatedRhythmCompletion, RhythmCompletionRecord } from './domain/rhythm-completion.ts';
import {
  deleteDatedCompletion,
  removeActionCompletion,
  rhythmCompletionStateForDate
} from './domain/rhythm-completion.ts';
import { resolveSeedCompletionRecords } from './domain/rhythm-history.ts';
import { localDateInTimeZone, localTimeInTimeZone } from './domain/rhythm-scoring.ts';
import { hasRhythmOccurrenceForCompletion } from './domain/rhythm-occurrences.ts';
import { rhythmScheduleForDate } from './domain/rhythm-schedule.ts';
import { selectFocusData, selectFocusRhythms } from './domain/focus.ts';
import type { CalendarEvent } from './domain/calendar-events.ts';
import { selectSatisfiedRhythmIds, selectTendedRhythmDisplayIds } from './domain/category-rhythms.ts';
import { prepareDatedRhythmCompletion } from './domain/rhythm-completion.ts';
import {
  selectPersonOverallHealth,
  selectPersonRhythmHealth
} from './domain/person-health.ts';
import { selectPersonConnectionHealth } from './domain/person-connection-health.ts';
import { validateStrengthData } from './domain/strength.ts';
import type { StrengthMode } from './domain/strength.ts';
import {
  selectStrengthRotationAssignment,
  updateStrengthRhythmMode
} from './domain/strength-rotation.ts';
import { isPinnedStrengthRotationRepair } from './domain/strength-rhythm-linking.ts';
import {
  saveWeightDataCommand
} from './domain/weight.ts';
import { saveCardioDataCommand, selectCardioProgress } from './domain/cardio.ts';
import { saveFlexibilityDataCommand } from './domain/flexibility-rhythm-linking.ts';
import {
  activeTodayRhythms,
  applySavedRhythmOverrides,
  archiveRhythmId,
  archivedTodayRhythms,
  isEditableRhythmId,
  resolveTodayRhythms,
  restoreRhythmId,
  rhythmDraftFrom,
  rhythmsForCategory,
  saveRhythmDraft
} from './domain/rhythm-editor.ts';
import { createRhythmDraft } from './domain/rhythm-editor.ts';
import type { RhythmDraft, RhythmDraftErrors, SavedRhythm } from './domain/rhythm-editor.ts';
import type { RhythmSeasonEditDraft } from './domain/rhythm-season-edit.ts';
import { establishCurrentRhythmSeason } from './domain/rhythm-season-edit.ts';
import { resolveRhythmSeasonRange } from './domain/rhythm-season-range.ts';
import { ensureRhythmSeasonHistoryCoverage } from './domain/rhythm-seasons.ts';
import {
  deleteRhythmSeason,
  restoreDeletedRhythmSeason
} from './domain/rhythm-season-delete.ts';
import type { RhythmSeasonDeletionUndo } from './domain/rhythm-season-delete.ts';
import {
  effectiveRhythmSchedule,
  rhythmScheduleSummary,
  rhythmTimeLabel,
  rhythmTimeValueFromLabel,
  type RhythmFrequencyRecommendation
} from './domain/rhythm-schedule.ts';
import {
  assignedTimeBlockIds,
  rhythmTimeOptionsForBlocks,
  timeBlockIdFromRhythmValue,
  validateTimeBlockSettings
} from './domain/time-blocks.ts';
import { rhythmSchedulesEqual } from './domain/rhythm-occurrences.ts';
import {
  browserPreviewStorage,
  listenForPreviewChanges,
  loadRawRecoveryCopy,
  loadV2RecoveryCopy,
  loadV1RecoveryCopy,
  loadV3RecoveryCopy,
  loadV4RecoveryCopy,
  loadV5RecoveryCopy,
  loadV6RecoveryCopy,
  loadV7RecoveryCopy,
  loadV8RecoveryCopy,
  loadV9RecoveryCopy,
  loadV10RecoveryCopy,
  loadV11RecoveryCopy,
  loadV12RecoveryCopy,
  loadV13RecoveryCopy,
  loadV14RecoveryCopy,
  loadV15RecoveryCopy,
  loadV16RecoveryCopy,
  loadV17RecoveryCopy,
  loadV18RecoveryCopy,
  loadV19RecoveryCopy,
  loadV20RecoveryCopy,
  loadV21RecoveryCopy,
  loadV22RecoveryCopy,
  loadV23RecoveryCopy,
  loadV24RecoveryCopy,
  loadV25RecoveryCopy,
  loadV26RecoveryCopy,
  loadV27RecoveryCopy,
  loadV28RecoveryCopy,
  loadV29RecoveryCopy,
  loadV30RecoveryCopy,
  loadV31RecoveryCopy,
  loadV32RecoveryCopy,
  loadV33RecoveryCopy,
  loadV34RecoveryCopy,
  loadV35RecoveryCopy,
  loadV36RecoveryCopy,
  loadV40RecoveryCopy,
  loadV41RecoveryCopy,
  loadV42RecoveryCopy,
  loadV43RecoveryCopy,
  loadV44RecoveryCopy,
  loadV45RecoveryCopy,
  loadV46RecoveryCopy,
  loadV47RecoveryCopy,
  loadV48RecoveryCopy,
  loadV50RecoveryCopy,
  loadV54RecoveryCopy,
  loadV55RecoveryCopy,
  loadCloudRestoreRecoveryCopy,
  loadStrengthRepairRecoveryCopy,
  loadPreviewImportRecovery,
  loadPreview,
  writePreview
} from './storage/preview-storage.ts';

const destinationLabels: Record<Exclude<Destination, 'today'>, string> = {
  focus: 'Focus',
  people: 'People',
  more: 'More',
  faith: 'Faith',
  marriage: 'Marriage',
  dating: 'Dating',
  parenting: 'Parenting',
  health: 'Health & Fitness',
  finances: 'Finances',
  friendships: 'Friendships'
};
const personProfileHistoryKey = 'tendPersonProfileId';
const prayerUnavailableMessage = 'Prayer is turned off in Settings.';

function isRhythmConnectionShared(data: PreviewData, connectionId: string): boolean {
  const connection = data.friendships.connections.find(item => item.id === connectionId);
  if (connection?.sparkId || connection?.sparkOwnerId) return true;
  return data.personSparks.some(spark => spark.completionHistory.some(completion =>
    completion.undone !== true
    && completion.source === 'connection'
    && completion.connectionId === connectionId
  ));
}

function restorePersonProfileFocus(opener: HTMLElement | null, personId: PersonId | null): void {
  if (opener?.isConnected && !opener.closest('[hidden]')) {
    opener.focus({ preventScroll: true });
    return;
  }
  const personButton = personId
    ? [...document.querySelectorAll<HTMLButtonElement>('dialog [data-person-id]')]
      .find(button => button.dataset.personId === personId)
    : undefined;
  if (personButton) personButton.focus({ preventScroll: true });
  else document.querySelector<HTMLButtonElement>('.utility-primary-button[aria-current="page"]')?.focus({ preventScroll: true });
}

function categorySuggestionCatalogue(
  categoryId: CategoryId,
  title: string,
  groups: readonly CategoryRhythmSuggestionGroupDefinition[],
  templates: readonly CategoryRhythmSuggestionTemplate[]
): CategoryRhythmSuggestionCatalogue {
  return {
    title,
    groups: groups.map(group => ({
      id: group.id,
      title: group.title,
      subtitle: group.subtitle,
      suggestions: templates
        .filter(suggestion => suggestion.groupId === group.id)
        .map(suggestion => ({
          sourceId: suggestion.sourceId,
          categoryId,
          rhythm: {
            id: suggestion.sourceId,
            title: suggestion.title,
            description: suggestion.description,
            cadence: suggestion.cadence,
            timeLabel: 'Anytime',
            automation: 'manual',
            status: 'Not confirmed',
            primaryFoundationId: suggestion.primaryFoundationId,
            secondaryFoundationIds: suggestion.secondaryFoundationIds,
            categoryIds: [categoryId]
          },
          scheduleHint: suggestion.scheduleHint,
          icon: <MarriageIcon group="foundations" id={suggestion.iconId} />,
          recommendedFrequency: suggestion.recommendedFrequency,
          ...(suggestion.frequencyGuidance ? { frequencyGuidance: suggestion.frequencyGuidance } : {})
        }))
    }))
  };
}

const parentingSuggestionCatalogue = categorySuggestionCatalogue(
  'parenting',
  'Parenting rhythms',
  parentingRhythmSuggestionGroups,
  parentingRhythmSuggestions
);
const datingSuggestionCatalogue = categorySuggestionCatalogue(
  'dating',
  'Dating Rhythm suggestions',
  datingRhythmSuggestionGroups,
  datingRhythmSuggestions
);
const marriageSuggestionCatalogue = createMarriageSuggestionCatalogue(marriageRhythms);
const faithSuggestionCatalogue = categorySuggestionCatalogue(
  'faith',
  'Faith practice suggestions',
  faithRhythmSuggestionGroups,
  faithRhythmSuggestions
);
const financeSuggestionCatalogue = categorySuggestionCatalogue(
  'finances',
  'Finance rhythm suggestions',
  financeRhythmSuggestionGroups,
  financeRhythmSuggestions
);
const healthFitnessSuggestionCatalogue: CategoryRhythmSuggestionCatalogue = {
  title: 'Health & Fitness rhythms',
  groups: healthFitnessRhythmSuggestionGroups.map(group => ({
    id: group.id,
    title: group.title,
    subtitle: group.subtitle,
    suggestions: healthFitnessRhythmSuggestions
      .filter(suggestion => suggestion.groupId === group.id)
      .map(suggestion => ({
        sourceId: suggestion.sourceId,
        categoryId: 'health',
        rhythm: {
          id: suggestion.sourceId,
          title: suggestion.title,
          description: suggestion.description,
          cadence: suggestion.cadence,
          timeLabel: rhythmTimeLabel(suggestion.timeOfDay),
          automation: 'manual',
          status: 'Not confirmed',
          primaryFoundationId: suggestion.primaryFoundationId,
          secondaryFoundationIds: suggestion.secondaryFoundationIds,
          categoryIds: ['health'],
          healthLogCapability: suggestion.healthLogCapability,
          ...(suggestion.schedule ? { schedule: suggestion.schedule } : {}),
          ...(suggestion.healthRunTarget ? { healthRunTarget: suggestion.healthRunTarget } : {})
        },
        scheduleHint: suggestion.scheduleHint,
        icon: <MarriageIcon group="foundations" id={suggestion.iconId} />,
        recommendedFrequency: suggestion.recommendedFrequency,
        ...(suggestion.frequencyGuidance ? { frequencyGuidance: suggestion.frequencyGuidance } : {}),
        ...(suggestion.healthWorkoutMode ? { healthWorkoutMode: suggestion.healthWorkoutMode } : {})
      }))
  }))
};

function isDatedCompletionRecord(record: RhythmCompletionRecord): record is DatedRhythmCompletion {
  return typeof record.localTime === 'string'
    && typeof record.timeZone === 'string'
    && typeof record.completedAt === 'string'
    && typeof record.recordedAt === 'string';
}

function isFitnessLinkedCompletion(data: PreviewData, completionId: string | undefined): boolean {
  if (completionId === undefined) return false;
  const records: readonly unknown[] = [
    ...data.strength.workouts,
    ...data.weight.weighIns,
    ...data.cardio.runs,
    ...data.flexibility.sessions,
    ...(data.flexibility.guidedSessions ?? [])
  ];
  return records.some(record => typeof record === 'object'
    && record !== null
    && !Array.isArray(record)
    && 'completionId' in record
    && record.completionId === completionId);
}

const defaultPreviewIdentity = import.meta.env.DEV
  ? DEVELOPMENT_PREVIEW_IDENTITY
  : PREVIEW_AUTH_PENDING;

export function App({
  identity = defaultPreviewIdentity,
  authRefreshSequence = 0,
  onSignOut,
  accountBackupApi,
  isAccountBackupIdentityCurrent
}: {
  identity?: PreviewIdentityState;
  authRefreshSequence?: number;
  onSignOut?: () => void | Promise<void>;
  accountBackupApi?: PreviewAccountBackupApi;
  isAccountBackupIdentityCurrent?: () => boolean;
} = {}) {
  const resolvedIdentity = useMemo(() => validatePreviewIdentity(identity), [identity]);
  const identityKey = previewIdentityKey(resolvedIdentity);
  const activeIdentityKey = useRef(identityKey);
  activeIdentityKey.current = identityKey;
  const isIdentityCurrent = useCallback(
    (key: string) => activeIdentityKey.current === key,
    []
  );
  useEffect(() => {
    const state = { ...(window.history.state ?? {}) };
    if (!(personProfileHistoryKey in state)) return;
    delete state[personProfileHistoryKey];
    window.history.replaceState(state, '', window.location.href);
  }, [identityKey]);

  if (resolvedIdentity.kind === 'pending') {
    return <PreviewAccessState title="Checking Preview access" message="Your account data has not been opened." />;
  }
  if (resolvedIdentity.kind === 'signed-out') {
    return <PreviewAccessState title="Sign in to open Preview" message="No account Preview data was loaded." />;
  }
  if (resolvedIdentity.kind === 'error') {
    return <PreviewAccessState title="Preview access is unavailable" message={resolvedIdentity.message} />;
  }

  return (
    <PreviewWorkspace
      key={identityKey}
      identity={resolvedIdentity}
      authRefreshSequence={authRefreshSequence}
      isIdentityCurrent={() => isIdentityCurrent(identityKey)}
      {...(isAccountBackupIdentityCurrent ? { isAccountBackupIdentityCurrent } : {})}
      {...(accountBackupApi ? { accountBackupApi } : {})}
      {...(onSignOut ? { onSignOut } : {})}
    />
  );
}

function PreviewAccessState({ title, message }: { title: string; message: string }) {
  return (
    <main className="preview-access-state" aria-labelledby="preview-access-title">
      <h1 id="preview-access-title">{title}</h1>
      <p>{message}</p>
    </main>
  );
}

type SettingsDetail =
  | 'categories'
  | 'prayer'
  | 'appearance'
  | 'time-blocks'
  | 'calendar'
  | 'weather'
  | 'save-sync'
  | 'backup-recovery';

type SettingsIconName = 'categories' | 'prayer' | 'appearance' | 'time-blocks' | 'calendar' | 'weather' | 'backup-recovery' | 'settings';

function SettingsDirectoryIcon({ name }: { name: SettingsIconName }) {
  return (
    <span className={`settings-link__icon settings-link__icon--${name}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        {name === 'categories' && <>
          <rect x="4" y="4" width="6" height="6" rx="1" />
          <rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" />
          <rect x="14" y="14" width="6" height="6" rx="1" />
        </>}
        {name === 'prayer' && <path d="M12 20s-7-4.4-7-9.2A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7 2.8C19 15.6 12 20 12 20Z" />}
        {name === 'appearance' && <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
        </>}
        {name === 'time-blocks' && <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7v5l3.5 2" />
        </>}
        {name === 'calendar' && <>
          <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
          <path d="M7.5 3v4m9-4v4M3.5 9h17" />
        </>}
        {name === 'weather' && <>
          <path d="M7 18.5h10a4 4 0 0 0 .4-8A6 6 0 0 0 6 9.5a4.5 4.5 0 0 0 1 9Z" />
          <path d="M6 3v2m-3 1.2 1.4 1.4m9.8-1.4-1.4 1.4" />
        </>}
        {name === 'backup-recovery' && <>
          <path d="M3.5 7.5h7l2 2h8v9h-17z" />
          <path d="M8 14.5a4 4 0 1 1 1.2 2.8m-1.2-5v2.5h2.5" />
        </>}
        {name === 'settings' && <>
          <path d="M4 6h16M4 12h16M4 18h16" />
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="8" cy="18" r="1.5" />
        </>}
      </svg>
    </span>
  );
}

function PreviewWorkspace({
  identity,
  authRefreshSequence,
  isIdentityCurrent,
  isAccountBackupIdentityCurrent,
  accountBackupApi,
  onSignOut
}: {
  identity: Extract<PreviewIdentityState, { kind: 'development' | 'authenticated' }>;
  authRefreshSequence: number;
  isIdentityCurrent: () => boolean;
  isAccountBackupIdentityCurrent?: () => boolean;
  accountBackupApi?: PreviewAccountBackupApi;
  onSignOut?: () => void | Promise<void>;
}) {
  const scoringInstant = useCurrentInstant();
  const previewStorage = useMemo(() => browserPreviewStorage(identity), [identity]);
  const initialPreviewData = () => identity.kind === 'development'
    && import.meta.env.DEV
    ? createSamplePreviewData()
    : createEmptyPreviewData();
  const [destination, setDestination] = useState<Destination>('today');
  const [peopleInitialFilter, setPeopleInitialFilter] = useState<PersonPickerGroupId | 'all'>('all');
  const [moreSettingsOpen, setMoreSettingsOpen] = useState(false);
  const [settingsDetail, setSettingsDetail] = useState<SettingsDetail | null>(null);
  const [settingsReturnTo, setSettingsReturnTo] = useState<SettingsDetail | null>(null);
  const weatherTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const todayWeather = useTodayWeather(
    destination === 'today' || (destination === 'more' && moreSettingsOpen),
    weatherTimeZone
  );
  const [healthFitnessVisited, setHealthFitnessVisited] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData>(initialPreviewData);
  const [freshInitialData, setFreshInitialData] = useState<PreviewData | null>(null);
  const [focusCalendarEvents, setFocusCalendarEvents] = useState<readonly CalendarEvent[]>([]);
  const localIsPristine = useMemo(
    () => isPreviewDataPristine(previewData, freshInitialData ?? initialPreviewData()),
    [freshInitialData, previewData]
  );
  const [manualBackupLocked, setManualBackupLocked] = useState(false);
  const [accountSyncTarget, setAccountSyncTarget] = useState<HTMLDivElement | null>(null);
  const [accountRecoveryTarget, setAccountRecoveryTarget] = useState<HTMLDivElement | null>(null);
  const [persistedSatisfiedRhythmIds, setPersistedSatisfiedRhythmIds] = useState<ReadonlySet<string>>(new Set());
  const [persistedCompletedRhythmIds, setPersistedCompletedRhythmIds] = useState<ReadonlySet<string>>(new Set());
  const configuredRhythmTimeOptions = rhythmTimeOptionsForBlocks(previewData.timeBlocks);
  const [prayerRequests, setPrayerRequests] = useState<PrayerRequestPreview[]>(() =>
    syntheticPrayerRequests.map(request => request.sharedWith
      ? { ...request, sharedWith: [...request.sharedWith] }
      : { ...request }));
  const [hydrated, setHydrated] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [persistenceStatus, setPersistenceStatus] = useState<PreviewPersistenceStatus>({ kind: 'loading' });
  const [rhythmConnectionNotice, setRhythmConnectionNotice] = useState('');
  const [rawRecoveryCopy, setRawRecoveryCopy] = useState<string | null>(null);
  const [rawRecoveryError, setRawRecoveryError] = useState<string | null>(null);
  const [cloudRestoreRecoveryCopy, setCloudRestoreRecoveryCopy] = useState<string | null>(null);
  const [cloudRestoreRecoveryError, setCloudRestoreRecoveryError] = useState<string | null>(null);
  const [strengthRepairRecoveryCopy, setStrengthRepairRecoveryCopy] = useState<string | null>(null);
  const [strengthRepairRecoveryError, setStrengthRepairRecoveryError] = useState<string | null>(null);
  const [importRecoveryCopy, setImportRecoveryCopy] = useState<string | null>(null);
  const [importRecoverySourceCopy, setImportRecoverySourceCopy] = useState<string | null>(null);
  const [importRecoveryArchive, setImportRecoveryArchive] = useState<string | null>(null);
  const [importRecoveryError, setImportRecoveryError] = useState<string | null>(null);
  const [v1RecoveryCopy, setV1RecoveryCopy] = useState<string | null>(null);
  const [v1RecoveryError, setV1RecoveryError] = useState<string | null>(null);
  const [v2RecoveryCopy, setV2RecoveryCopy] = useState<string | null>(null);
  const [v2RecoveryError, setV2RecoveryError] = useState<string | null>(null);
  const [v3RecoveryCopy, setV3RecoveryCopy] = useState<string | null>(null);
  const [v3RecoveryError, setV3RecoveryError] = useState<string | null>(null);
  const [v4RecoveryCopy, setV4RecoveryCopy] = useState<string | null>(null);
  const [v4RecoveryError, setV4RecoveryError] = useState<string | null>(null);
  const [v5RecoveryCopy, setV5RecoveryCopy] = useState<string | null>(null);
  const [v5RecoveryError, setV5RecoveryError] = useState<string | null>(null);
  const [v6RecoveryCopy, setV6RecoveryCopy] = useState<string | null>(null);
  const [v6RecoveryError, setV6RecoveryError] = useState<string | null>(null);
  const [v7RecoveryCopy, setV7RecoveryCopy] = useState<string | null>(null);
  const [v7RecoveryError, setV7RecoveryError] = useState<string | null>(null);
  const [v8RecoveryCopy, setV8RecoveryCopy] = useState<string | null>(null);
  const [v8RecoveryError, setV8RecoveryError] = useState<string | null>(null);
  const [v9RecoveryCopy, setV9RecoveryCopy] = useState<string | null>(null);
  const [v9RecoveryError, setV9RecoveryError] = useState<string | null>(null);
  const [v10RecoveryCopy, setV10RecoveryCopy] = useState<string | null>(null);
  const [v10RecoveryError, setV10RecoveryError] = useState<string | null>(null);
  const [v11RecoveryCopy, setV11RecoveryCopy] = useState<string | null>(null);
  const [v11RecoveryError, setV11RecoveryError] = useState<string | null>(null);
  const [v12RecoveryCopy, setV12RecoveryCopy] = useState<string | null>(null);
  const [v12RecoveryError, setV12RecoveryError] = useState<string | null>(null);
  const [v13RecoveryCopy, setV13RecoveryCopy] = useState<string | null>(null);
  const [v13RecoveryError, setV13RecoveryError] = useState<string | null>(null);
  const [v14RecoveryCopy, setV14RecoveryCopy] = useState<string | null>(null);
  const [v14RecoveryError, setV14RecoveryError] = useState<string | null>(null);
  const [v15RecoveryCopy, setV15RecoveryCopy] = useState<string | null>(null);
  const [v15RecoveryError, setV15RecoveryError] = useState<string | null>(null);
  const [v16RecoveryCopy, setV16RecoveryCopy] = useState<string | null>(null);
  const [v16RecoveryError, setV16RecoveryError] = useState<string | null>(null);
  const [v17RecoveryCopy, setV17RecoveryCopy] = useState<string | null>(null);
  const [v17RecoveryError, setV17RecoveryError] = useState<string | null>(null);
  const [v18RecoveryCopy, setV18RecoveryCopy] = useState<string | null>(null);
  const [v18RecoveryError, setV18RecoveryError] = useState<string | null>(null);
  const [v19RecoveryCopy, setV19RecoveryCopy] = useState<string | null>(null);
  const [v19RecoveryError, setV19RecoveryError] = useState<string | null>(null);
  const [v20RecoveryCopy, setV20RecoveryCopy] = useState<string | null>(null);
  const [v20RecoveryError, setV20RecoveryError] = useState<string | null>(null);
  const [v21RecoveryCopy, setV21RecoveryCopy] = useState<string | null>(null);
  const [v21RecoveryError, setV21RecoveryError] = useState<string | null>(null);
  const [v22RecoveryCopy, setV22RecoveryCopy] = useState<string | null>(null);
  const [v22RecoveryError, setV22RecoveryError] = useState<string | null>(null);
  const [v23RecoveryCopy, setV23RecoveryCopy] = useState<string | null>(null);
  const [v23RecoveryError, setV23RecoveryError] = useState<string | null>(null);
  const [v24RecoveryCopy, setV24RecoveryCopy] = useState<string | null>(null);
  const [v24RecoveryError, setV24RecoveryError] = useState<string | null>(null);
  const [v25RecoveryCopy, setV25RecoveryCopy] = useState<string | null>(null);
  const [v25RecoveryError, setV25RecoveryError] = useState<string | null>(null);
  const [v26RecoveryCopy, setV26RecoveryCopy] = useState<string | null>(null);
  const [v26RecoveryError, setV26RecoveryError] = useState<string | null>(null);
  const [v27RecoveryCopy, setV27RecoveryCopy] = useState<string | null>(null);
  const [v27RecoveryError, setV27RecoveryError] = useState<string | null>(null);
  const [v28RecoveryCopy, setV28RecoveryCopy] = useState<string | null>(null);
  const [v28RecoveryError, setV28RecoveryError] = useState<string | null>(null);
  const [v29RecoveryCopy, setV29RecoveryCopy] = useState<string | null>(null);
  const [v29RecoveryError, setV29RecoveryError] = useState<string | null>(null);
  const [v30RecoveryCopy, setV30RecoveryCopy] = useState<string | null>(null);
  const [v30RecoveryError, setV30RecoveryError] = useState<string | null>(null);
  const [v31RecoveryCopy, setV31RecoveryCopy] = useState<string | null>(null);
  const [v31RecoveryError, setV31RecoveryError] = useState<string | null>(null);
  const [v32RecoveryCopy, setV32RecoveryCopy] = useState<string | null>(null);
  const [v32RecoveryError, setV32RecoveryError] = useState<string | null>(null);
  const [v33RecoveryCopy, setV33RecoveryCopy] = useState<string | null>(null);
  const [v33RecoveryError, setV33RecoveryError] = useState<string | null>(null);
  const [v34RecoveryCopy, setV34RecoveryCopy] = useState<string | null>(null);
  const [v34RecoveryError, setV34RecoveryError] = useState<string | null>(null);
  const [v35RecoveryCopy, setV35RecoveryCopy] = useState<string | null>(null);
  const [v35RecoveryError, setV35RecoveryError] = useState<string | null>(null);
  const [v36RecoveryCopy, setV36RecoveryCopy] = useState<string | null>(null);
  const [v36RecoveryError, setV36RecoveryError] = useState<string | null>(null);
  const [v40RecoveryCopy, setV40RecoveryCopy] = useState<string | null>(null);
  const [v40RecoveryError, setV40RecoveryError] = useState<string | null>(null);
  const [v41RecoveryCopy, setV41RecoveryCopy] = useState<string | null>(null);
  const [v42RecoveryCopy, setV42RecoveryCopy] = useState<string | null>(null);
  const [v43RecoveryCopy, setV43RecoveryCopy] = useState<string | null>(null);
  const [v44RecoveryCopy, setV44RecoveryCopy] = useState<string | null>(null);
  const [v45RecoveryCopy, setV45RecoveryCopy] = useState<string | null>(null);
  const [v46RecoveryCopy, setV46RecoveryCopy] = useState<string | null>(null);
  const [v47RecoveryCopy, setV47RecoveryCopy] = useState<string | null>(null);
  const [v48RecoveryCopy, setV48RecoveryCopy] = useState<string | null>(null);
  const [v50RecoveryCopy, setV50RecoveryCopy] = useState<string | null>(null);
  const [v54RecoveryCopy, setV54RecoveryCopy] = useState<string | null>(null);
  const [v55RecoveryCopy, setV55RecoveryCopy] = useState<string | null>(null);
  const expectedRaw = useRef<string | null>(null);
  const externalRaw = useRef<string | null>(null);
  const skipNextAutosave = useRef(false);
  const hydratedDataWithoutSave = useRef<PreviewData | null>(null);
  const morePageHeading = useRef<HTMLHeadingElement>(null);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [foundationNavigationRequest, setFoundationNavigationRequest] = useState<{
    foundationId: string;
    requestId: number;
    returnTab: 'today' | MarriageTab;
  } | null>(null);
  const foundationNavigationSequence = useRef(0);
  const [categoryTabNavigationRequest, setCategoryTabNavigationRequest] =
    useState<CategoryTabNavigationRequest | null>(null);
  const categoryTabNavigationSequence = useRef(0);
  const activeRhythmReturnTab = useRef<'today' | MarriageTab>('today');
  const [profilePersonId, setProfilePersonId] = useState<PersonId | null>(null);
  const [profileNavigationRequest, setProfileNavigationRequest] =
    useState<PersonProfileNavigationRequest | null>(null);
  const profileNavigationSequence = useRef(0);
  const profileReturnRhythmId = useRef<string | null>(null);
  const profileReturnScrollTop = useRef<number | null>(null);
  const profileReturnFocusRhythmId = useRef<string | null>(null);
  const [personDetailsEditorId, setPersonDetailsEditorId] = useState<PersonId | null>(null);
  const personDetailsEditorOpener = useRef<HTMLButtonElement | null>(null);
  const wasPersonDetailsEditorOpen = useRef(false);
  const [activeRhythmId, setActiveRhythmId] = useState<string | null>(null);
  const [seasonDeletionUndo, setSeasonDeletionUndo] = useState<RhythmSeasonDeletionUndo | null>(null);
  const [seasonRangeUndo, setSeasonRangeUndo] = useState<{
    rhythmId: string;
    expected: SavedRhythm;
    restore?: SavedRhythm;
  } | null>(null);
  const [detailsInitialView, setDetailsInitialView] = useState<'details' | 'history'>('details');
  const [completionDialogRhythmId, setCompletionDialogRhythmId] = useState<string | null>(null);
  const [strengthLogRequest, setStrengthLogRequest] = useState<{
    rhythmId: string;
    mode: StrengthMode;
    workoutId?: string;
    requestId: number;
    opener?: HTMLButtonElement;
  } | null>(null);
  const strengthLogRequestSequence = useRef(0);
  const [cardioLogRequest, setCardioLogRequest] = useState<{
    requestId: number;
    opener: HTMLButtonElement;
    rhythm?: (typeof todayRhythms)[number];
  } | null>(null);
  const cardioLogRequestSequence = useRef(0);
  const [flexibilityLogRequest, setFlexibilityLogRequest] = useState<{
    requestId: number;
    opener: HTMLButtonElement;
    rhythm: (typeof todayRhythms)[number];
  } | null>(null);
  const flexibilityLogRequestSequence = useRef(0);
  const [weightLogRequest, setWeightLogRequest] = useState<{
    requestId: number;
    opener: HTMLButtonElement;
    rhythm?: (typeof todayRhythms)[number];
  } | null>(null);
  const weightLogRequestSequence = useRef(0);
  const [rhythmEditor, setRhythmEditor] = useState<{
    id: string;
    rhythm?: (typeof todayRhythms)[number];
    initialDraft?: RhythmDraft;
    suggestionSourceId?: string;
    recommendedFrequency?: RhythmFrequencyRecommendation;
    frequencyGuidance?: string;
    returnToSuggestions?: (saved: boolean) => void;
  } | null>(null);
  const dialogOpener = useRef<HTMLButtonElement | null>(null);
  const completionDialogOpener = useRef<HTMLButtonElement | null>(null);
  const wasCompletionDialogOpen = useRef(false);
  const rhythmEditorOpener = useRef<HTMLButtonElement | null>(null);
  const profileOpener = useRef<HTMLElement | null>(null);
  const profileReturnPersonId = useRef<PersonId | null>(null);
  const wasProfileOpen = useRef(false);
  const wasDetailsOpen = useRef(false);
  const wasRhythmEditorOpen = useRef(false);
  const rhythmEditorReturnsToSuggestions = useRef(false);

  function writeCurrentPreview(
    data: PreviewData,
    expected: string | null,
    options: Parameters<typeof writePreview>[3] = {}
  ) {
    if (!isIdentityCurrent()) {
      return { kind: 'error' as const, message: 'Preview identity changed. No changes were saved.' };
    }
    const written = writePreview(previewStorage, data, expected, options);
    refreshRawRecoveryCopy();
    const v41Recovery = loadV41RecoveryCopy(previewStorage);
    setV41RecoveryCopy(v41Recovery.kind === 'loaded' ? v41Recovery.raw : null);
    const v42Recovery = loadV42RecoveryCopy(previewStorage);
    setV42RecoveryCopy(v42Recovery.kind === 'loaded' ? v42Recovery.raw : null);
    const v43Recovery = loadV43RecoveryCopy(previewStorage);
    setV43RecoveryCopy(v43Recovery.kind === 'loaded' ? v43Recovery.raw : null);
    const v44Recovery = loadV44RecoveryCopy(previewStorage);
    setV44RecoveryCopy(v44Recovery.kind === 'loaded' ? v44Recovery.raw : null);
    const v45Recovery = loadV45RecoveryCopy(previewStorage);
    setV45RecoveryCopy(v45Recovery.kind === 'loaded' ? v45Recovery.raw : null);
    const v46Recovery = loadV46RecoveryCopy(previewStorage);
    setV46RecoveryCopy(v46Recovery.kind === 'loaded' ? v46Recovery.raw : null);
    const v47Recovery = loadV47RecoveryCopy(previewStorage);
    setV47RecoveryCopy(v47Recovery.kind === 'loaded' ? v47Recovery.raw : null);
    const v48Recovery = loadV48RecoveryCopy(previewStorage);
    setV48RecoveryCopy(v48Recovery.kind === 'loaded' ? v48Recovery.raw : null);
    const v50Recovery = loadV50RecoveryCopy(previewStorage);
    setV50RecoveryCopy(v50Recovery.kind === 'loaded' ? v50Recovery.raw : null);
    const v54Recovery = loadV54RecoveryCopy(previewStorage);
    setV54RecoveryCopy(v54Recovery.kind === 'loaded' ? v54Recovery.raw : null);
    const v55Recovery = loadV55RecoveryCopy(previewStorage);
    setV55RecoveryCopy(v55Recovery.kind === 'loaded' ? v55Recovery.raw : null);
    if (written.kind === 'saved') {
      setPersistedSatisfiedRhythmIds(satisfiedRhythmIdsForData(data));
      setPersistedCompletedRhythmIds(completedRhythmIdsForData(data));
    }
    return written;
  }

  const hour = scoringInstant.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  function rhythmWithSavedCompletions(
    rhythm: RhythmPreview,
    data: PreviewData = previewData
  ): RhythmPreview {
    const seededRecords = resolveSeedCompletionRecords(
      rhythm.completionHistory,
      data.rhythmCompletionOverrides,
      data.removedSeedCompletionIds
    );
    const datedRecords = data.datedRhythmCompletions.filter(item => item.rhythmId === rhythm.id);
    const completionHistory = seededRecords === undefined && datedRecords.length === 0
      ? undefined
      : [...(seededRecords ?? []), ...datedRecords];
    const coverageStart = [
      rhythm.createdLocalDate,
      ...(completionHistory ?? []).map(record => record.effectiveDate)
    ].filter((date): date is string => date !== undefined).sort()[0];
    const scoring = rhythm.scoring && completionHistory?.length && coverageStart
      ? {
          ...rhythm.scoring,
          scheduleHistory: ensureRhythmSeasonHistoryCoverage(
            rhythm.id,
            rhythm.scoring.scheduleHistory,
            coverageStart
          )
        }
      : rhythm.scoring;
    if (completionHistory === undefined && scoring === rhythm.scoring) return rhythm;
    return {
      ...rhythm,
      ...(completionHistory === undefined ? {} : { completionHistory }),
      ...(scoring === undefined ? {} : { scoring })
    };
  }
  function dateForRhythm(rhythm: RhythmPreview, instant = new Date()): string {
    const timeZone = rhythm.scoring?.timeZone
      ?? rhythm.createdTimeZone
      ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    return localDateInTimeZone(instant, timeZone);
  }
  function completedIdsForData(data: PreviewData, rhythms: readonly RhythmPreview[]): ReadonlySet<string> {
    return new Set(rhythms.filter(rhythm => rhythmCompletionStateForDate(
      rhythm.id,
      dateForRhythm(rhythm),
      data.completedRhythmIds,
      data.activeRhythmCompletions,
      (rhythm.completionHistory ?? []).map(record => ({ ...record, rhythmId: rhythm.id }))
    ).completed).map(rhythm => rhythm.id));
  }
  function satisfiedRhythmIdsForData(data: PreviewData): ReadonlySet<string> {
    const rhythms = resolveTodayRhythms(data.savedRhythms)
      .map(rhythm => rhythmWithSavedCompletions(rhythm, data));
    return selectSatisfiedRhythmIds(rhythms, completedIdsForData(data, rhythms), date => dateForRhythm(date));
  }
  function completedRhythmIdsForData(data: PreviewData): ReadonlySet<string> {
    const rhythms = resolveTodayRhythms(data.savedRhythms)
      .map(rhythm => rhythmWithSavedCompletions(rhythm, data));
    return completedIdsForData(data, rhythms);
  }
  const allTodayRhythms = resolveTodayRhythms(previewData.savedRhythms)
    .map(rhythm => rhythmWithSavedCompletions(rhythm));
  const editableTodayRhythms = activeTodayRhythms(allTodayRhythms, previewData.archivedRhythmIds);
  const archivedRhythms = archivedTodayRhythms(allTodayRhythms, previewData.archivedRhythmIds);
  const resolvedMarriageRhythms = marriageRhythms.map(rhythm =>
    rhythmWithSavedCompletions(applySavedRhythmOverrides(
      rhythm,
      previewData.savedRhythms.find(saved => saved.id === rhythm.id)
    ))
  );
  const composedUserRhythmCandidates = [...allTodayRhythms, ...resolvedMarriageRhythms];
  const savedRhythmIds = previewData.savedRhythms.map(rhythm => rhythm.id);
  const userRhythms = selectActiveUserRhythms(
    composedUserRhythmCandidates,
    savedRhythmIds,
    previewData.archivedRhythmIds
  );
  const archivedUserRhythms = selectArchivedUserRhythms(
    composedUserRhythmCandidates,
    savedRhythmIds,
    previewData.archivedRhythmIds
  );
  const marriageCategoryRhythms = rhythmsForCategory(userRhythms, 'marriage');
  const datingCategoryRhythms = rhythmsForCategory(userRhythms, 'dating');
  const parentingCategoryRhythms = rhythmsForCategory(userRhythms, 'parenting');
  const faithCategoryRhythms = rhythmsForCategory(userRhythms, 'faith');
  const healthCategoryRhythms = rhythmsForCategory(userRhythms, 'health');
  const friendshipCategoryRhythms = rhythmsForCategory(userRhythms, 'friendships');
  const archivedMarriageRhythms = rhythmsForCategory(archivedUserRhythms, 'marriage');
  const archivedDatingRhythms = rhythmsForCategory(archivedUserRhythms, 'dating');
  const archivedParentingRhythms = rhythmsForCategory(archivedUserRhythms, 'parenting');
  const archivedFaithRhythms = rhythmsForCategory(archivedUserRhythms, 'faith');
  const archivedHealthRhythms = rhythmsForCategory(archivedUserRhythms, 'health');
  const archivedFriendshipRhythms = rhythmsForCategory(archivedUserRhythms, 'friendships');
  const financeCategoryRhythms = rhythmsForCategory(userRhythms, 'finances');
  const archivedFinanceCategoryRhythms = rhythmsForCategory(archivedUserRhythms, 'finances');
  const pendingStrengthLogRhythm = strengthLogRequest
    ? healthCategoryRhythms.find(rhythm => rhythm.id === strengthLogRequest.rhythmId)
    : undefined;
  const pendingStrengthRhythmLog = strengthLogRequest && pendingStrengthLogRhythm
    ? { ...strengthLogRequest, rhythm: pendingStrengthLogRhythm }
    : null;
  const scoredRhythms = [...new Map(
    [...allTodayRhythms, ...resolvedMarriageRhythms].map(rhythm => [rhythm.id, rhythm])
  ).values()];
  const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const rhythmScoreResults = selectFoundationRhythmScores(
    scoredRhythms,
    previewData.archivedRhythmIds,
    new Set([
      ...editableTodayRhythms.map(rhythm => rhythm.id),
      ...archivedRhythms.map(rhythm => rhythm.id)
    ]),
    scoringInstant,
    localTimeZone,
    previewData.timeBlocks
  );
  const categoryRhythms = {
    faith: faithCategoryRhythms,
    marriage: marriageCategoryRhythms,
    dating: datingCategoryRhythms,
    parenting: parentingCategoryRhythms,
    friendships: friendshipCategoryRhythms
  } as const;
  const availableCategories = selectAvailableCategories(previewData.categoryPreferences);
  const availableCategoryIds = selectAvailableCategoryIds(previewData.categoryPreferences);
  const focusRhythms = selectFocusRhythms(
    [...editableTodayRhythms, ...userRhythms],
    availableCategoryIds
  );
  const cardioCategoryScore = selectCardioCategoryScore(
    selectCardioProgress(previewData.cardio, localDateString(scoringInstant))
  );
  const weightCategoryScore = selectWeightCategoryScore(
    healthCategoryRhythms,
    rhythmScoreResults,
    previewData.archivedRhythmIds
  );
  const strengthCategoryScore = selectStrengthCategoryScore(
    healthCategoryRhythms,
    rhythmScoreResults,
    previewData.archivedRhythmIds
  );
  const flexibilityCategoryScore = selectFoundationCategoryScore(
    'health-flexibility',
    healthCategoryRhythms,
    rhythmScoreResults,
    previewData.archivedRhythmIds
  );
  const availability = {
    categoryPreferences: previewData.categoryPreferences,
    foundationPreferences: previewData.foundationPreferences
  };
  const availableFoundations = selectAvailableFoundations(availability, foundationCatalogue);
  const availableFoundationIds = selectAvailableFoundationIds(availability, foundationCatalogue);
  const healthFitnessCategoryScore = selectHealthFitnessCategoryScore(
    cardioCategoryScore,
    weightCategoryScore,
    strengthCategoryScore,
    flexibilityCategoryScore,
    availableFoundationIds
  );
  const categoryHealthScores = new Map<CategoryId, number | null>(
    [
      ...(['faith', 'marriage', 'dating', 'parenting', 'friendships'] as const).map(categoryId => [
        categoryId,
        selectCategoryHealthScore(
          availableFoundations.filter(foundation => foundation.categoryId === categoryId),
          categoryRhythms[categoryId],
          rhythmScoreResults,
          previewData.archivedRhythmIds
        ).health
      ] as const),
      ['health', healthFitnessCategoryScore.health]
    ]
  );
  const overallHealthScore = aggregateCategoryHealthScores(
    availableCategories.map(area => categoryHealthScores.get(area.id) ?? null)
  ).health;
  const activeRhythm = [
    ...allTodayRhythms,
    ...resolvedMarriageRhythms
  ].find(rhythm => rhythm.id === activeRhythmId) ?? null;
  const peopleWithPhotos = peopleWithSavedPhotos(previewData.people, previewData.personDetails);
  const selectedProfilePerson = profilePersonId === null ? null : personById(peopleWithPhotos, profilePersonId) ?? null;
  const searchResults = selectGlobalSearchResults(search, {
    people: peopleWithPhotos,
    rhythms: [...new Map([...allTodayRhythms, ...resolvedMarriageRhythms].map(rhythm => [rhythm.id, rhythm])).values()],
    prayerRequests: previewData.prayerRequests,
    personNotes: previewData.personNotes,
    friendships: previewData.friendships,
    availableCategoryIds,
    prayerEnabled: previewData.prayerEnabled
  });
  const selectedDetailsEditorPerson = personDetailsEditorId === null
    ? null
    : personById(previewData.people, personDetailsEditorId) ?? null;
  const selectedDetailsEditorDetails = personDetailsEditorId === null
    ? undefined
    : personDetailsForId(previewData.personDetails, personDetailsEditorId);
  const selectedDetailsEditorCadence = personDetailsEditorId === null
    ? null
    : previewData.friendships.cadenceSettings.find(item => item.personId === personDetailsEditorId)?.cadence ?? null;
  const selectedDetailsEditorCategoryIds = personDetailsEditorId === null
    ? []
    : [resolvePersonCategory(
        previewData.peopleGroups
          .filter(group => group.memberIds.includes(personDetailsEditorId))
          .map(group => group.id)
      )].filter((category): category is PersonPickerGroupId => category !== null);
  const resolvedPeopleGroups = resolvePersonCategoryGroups(previewData.peopleGroups).groups;
  const availablePeopleGroups = selectAvailablePersonGroups(
    previewData.categoryPreferences,
    resolvedPeopleGroups
  );
  const selectedProfileCategory = selectedProfilePerson
    ? resolvePersonCategory(
        availablePeopleGroups
          .filter(group => group.memberIds.includes(selectedProfilePerson.id))
          .map(group => group.id)
      )
    : null;
  const selectedProfileSuggestionCatalogue = selectedProfileCategory === 'marriage'
    ? marriageSuggestionCatalogue
    : selectedProfileCategory === 'dating'
      ? datingSuggestionCatalogue
    : selectedProfileCategory === 'parenting'
      ? parentingSuggestionCatalogue
      : undefined;
  const profileRhythmCandidates = [...new Map(
    [...editableTodayRhythms, ...userRhythms].map(rhythm => [rhythm.id, rhythm])
  ).values()];
  const archivedProfileRhythmCandidates = [...new Map(
    [...archivedRhythms, ...archivedUserRhythms].map(rhythm => [rhythm.id, rhythm])
  ).values()];
  const personHealthAsOfDate = localDateString(scoringInstant);
  const personOverallHealthScores = new Map(peopleWithPhotos.map(person => {
    const active = profileRhythmCandidates.filter(rhythm =>
      rhythm.personIds?.includes(person.id) && !previewData.archivedRhythmIds.includes(rhythm.id)
    );
    const archived = archivedProfileRhythmCandidates.filter(rhythm =>
      rhythm.personIds?.includes(person.id)
    );
    const rhythmHealth = selectPersonRhythmHealth(
      person.id,
      [...active, ...archived],
      rhythmScoreResults,
      new Set(archived.map(rhythm => rhythm.id))
    );
    const connectionHealth = selectPersonConnectionHealth(
      previewData.friendships,
      person.id,
      personHealthAsOfDate
    );
    return [person.id, selectPersonOverallHealth(rhythmHealth, connectionHealth).health] as const;
  }));
  const personActiveRhythms = profilePersonId === null
    ? []
    : profileRhythmCandidates.filter(rhythm =>
        rhythm.personIds?.includes(profilePersonId) && !previewData.archivedRhythmIds.includes(rhythm.id)
      );
  const personArchivedRhythms = profilePersonId === null
    ? []
    : archivedProfileRhythmCandidates.filter(rhythm =>
        rhythm.personIds?.includes(profilePersonId)
      );
  const activeRhythmIsToday = activeRhythm !== null && editableTodayRhythms.some(rhythm => rhythm.id === activeRhythm.id);
  const activeRhythmIsArchived = activeRhythm !== null && previewData.archivedRhythmIds.includes(activeRhythm.id);
  const activeRhythmForDetails = activeRhythm;
  const completionDialogRhythm = completionDialogRhythmId
    ? allTodayRhythms.find(rhythm => rhythm.id === completionDialogRhythmId) ?? null
    : null;
  const currentDate = localDateString(scoringInstant);
  const initialLoadDate = useRef(currentDate).current;
  const completionStates = new Map(allTodayRhythms.map(rhythm => [
    rhythm.id,
    rhythmCompletionStateForDate(
      rhythm.id,
      dateForRhythm(rhythm),
      previewData.completedRhythmIds,
      previewData.activeRhythmCompletions,
      (rhythm.completionHistory ?? []).map(record => ({ ...record, rhythmId: rhythm.id }))
    )
  ] as const));
  const completedRhythms = new Set(
    [...completionStates].filter(([, state]) => state.completed).map(([id]) => id)
  );
  const focusData = selectFocusData({
    instant: scoringInstant,
    timeZone: localTimeZone,
    settings: previewData.timeBlocks,
    rhythms: focusRhythms,
    rhythmScores: rhythmScoreResults,
    people: peopleWithPhotos,
    peopleGroups: resolvedPeopleGroups,
    categoryPreferences: previewData.categoryPreferences,
    friendships: previewData.friendships,
    personHealthScores: personOverallHealthScores,
    calendarAvailable: previewData.showCalendarOnToday
      && (identity.kind === 'development' || identity.kind === 'authenticated'),
    calendarEvents: focusCalendarEvents,
    completedRhythmIds: completedRhythms,
    datedCompletions: previewData.datedRhythmCompletions
  });
  const undoableRhythms = new Set(
    [...completionStates].filter(([id, state]) => {
      if (!state.undoable) return false;
      const activeCompletionId = previewData.activeRhythmCompletions
        .find(item => item.rhythmId === id)?.completionId;
      return !isFitnessLinkedCompletion(previewData, activeCompletionId);
    }).map(([id]) => id)
  );
  const currentlySatisfiedRhythmIds = selectSatisfiedRhythmIds(
    allTodayRhythms,
    completedRhythms,
    rhythm => dateForRhythm(rhythm)
  );
  const satisfiedRhythmIds = new Set(
    [...currentlySatisfiedRhythmIds].filter(id => persistedSatisfiedRhythmIds.has(id))
  );
  const tendedRhythmIds = selectTendedRhythmDisplayIds(
    persistedCompletedRhythmIds,
    satisfiedRhythmIds
  );
  const moneyGoals = previewData.goals;
  const textSize = previewData.textSize;

  function refreshRawRecoveryCopy() {
    const result = loadRawRecoveryCopy(previewStorage);
    if (result.kind === 'loaded') {
      setRawRecoveryCopy(result.raw);
      setRawRecoveryError(null);
    } else {
      setRawRecoveryCopy(null);
      setRawRecoveryError(result.message);
    }
  }

  function refreshCloudRestoreRecoveryCopy() {
    const result = loadCloudRestoreRecoveryCopy(previewStorage);
    if (result.kind === 'loaded') {
      setCloudRestoreRecoveryCopy(result.raw);
      setCloudRestoreRecoveryError(null);
    } else {
      setCloudRestoreRecoveryCopy(null);
      setCloudRestoreRecoveryError(result.message);
    }
  }

  function refreshStrengthRepairRecoveryCopy() {
    const result = loadStrengthRepairRecoveryCopy(previewStorage);
    if (result.kind === 'loaded') {
      setStrengthRepairRecoveryCopy(result.raw);
      setStrengthRepairRecoveryError(null);
    } else {
      setStrengthRepairRecoveryCopy(null);
      setStrengthRepairRecoveryError(result.message);
    }
  }

  function refreshImportRecoveryCopy() {
    const result = loadPreviewImportRecovery(previewStorage);
    if (result.kind === 'loaded') {
      setImportRecoveryCopy(result.latestRaw);
      setImportRecoverySourceCopy(result.latestSourceRaw);
      setImportRecoveryArchive(result.archiveRaw);
      setImportRecoveryError(null);
    } else {
      setImportRecoveryCopy(null);
      setImportRecoverySourceCopy(null);
      setImportRecoveryArchive(null);
      setImportRecoveryError(result.message);
    }
  }

  function recordPrayer(requestId: string): string | null {
    if (!previewData.prayerEnabled) return prayerUnavailableMessage;
    const result = recordPreviewPrayer(prayerRequests, requestId, new Date().toISOString());
    if (!result.valid) return result.error;
    setPrayerRequests(result.requests);
    return null;
  }

  function refreshV1RecoveryCopy() {
    const result = loadV1RecoveryCopy(previewStorage);
    if (result.kind === 'loaded') {
      setV1RecoveryCopy(result.raw);
      setV1RecoveryError(null);
    } else {
      setV1RecoveryCopy(null);
      setV1RecoveryError(result.message);
    }
  }

  function refreshV2RecoveryCopy() {
    const result = loadV2RecoveryCopy(previewStorage);
    if (result.kind === 'loaded') {
      setV2RecoveryCopy(result.raw);
      setV2RecoveryError(null);
    } else {
      setV2RecoveryCopy(null);
      setV2RecoveryError(result.message);
    }
  }

  function refreshV3RecoveryCopy() {
    const result = loadV3RecoveryCopy(previewStorage);
    if (result.kind === 'loaded') {
      setV3RecoveryCopy(result.raw);
      setV3RecoveryError(null);
    } else {
      setV3RecoveryCopy(null);
      setV3RecoveryError(result.message);
    }
  }

  function refreshV4RecoveryCopy() {
    const result = loadV4RecoveryCopy(previewStorage);
    if (result.kind === 'loaded') {
      setV4RecoveryCopy(result.raw);
      setV4RecoveryError(null);
    }
    else {
      setV4RecoveryCopy(null);
      setV4RecoveryError(result.message);
    }
  }

  function refreshV5RecoveryCopy() {
    const result = loadV5RecoveryCopy(previewStorage);
    if (result.kind === 'loaded') {
      setV5RecoveryCopy(result.raw);
      setV5RecoveryError(null);
    } else {
      setV5RecoveryCopy(null);
      setV5RecoveryError(result.message);
    }
  }

  function refreshV6RecoveryCopy() {
    const result = loadV6RecoveryCopy(previewStorage);
    if (result.kind === 'loaded') {
      setV6RecoveryCopy(result.raw);
      setV6RecoveryError(null);
    } else {
      setV6RecoveryCopy(null);
      setV6RecoveryError(result.message);
    }

  }

  function refreshV7RecoveryCopy() {
    const result = loadV7RecoveryCopy(previewStorage);
    if (result.kind === 'loaded') {
      setV7RecoveryCopy(result.raw);
      setV7RecoveryError(null);
    } else {
      setV7RecoveryCopy(null);
      setV7RecoveryError(result.message);
    }
  }

  function refreshV8RecoveryCopy() {
    const result = loadV8RecoveryCopy(previewStorage);
    if (result.kind === 'loaded') {
      setV8RecoveryCopy(result.raw);
      setV8RecoveryError(null);
    } else {
      setV8RecoveryCopy(null);
      setV8RecoveryError(result.message);
    }
  }

  function refreshV9RecoveryCopy() {
    const result = loadV9RecoveryCopy(previewStorage);
    if (result.kind === 'loaded') {
      setV9RecoveryCopy(result.raw);
      setV9RecoveryError(null);
    } else {
      setV9RecoveryCopy(null);
      setV9RecoveryError(result.message);
    }

    refreshV10RecoveryCopy();
  }

  function refreshV29RecoveryCopy() {
    const result = loadV29RecoveryCopy(previewStorage);
    if (result.kind === 'loaded') {
      setV29RecoveryCopy(result.raw);
      setV29RecoveryError(null);
    } else {
      setV29RecoveryCopy(null);
      setV29RecoveryError(result.message);
    }

  }

  function refreshV30RecoveryCopy() {
    const result = loadV30RecoveryCopy(previewStorage);
    if (result.kind === 'loaded') {
      setV30RecoveryCopy(result.raw);
      setV30RecoveryError(null);
    } else {
      setV30RecoveryCopy(null);
      setV30RecoveryError(result.message);
    }
    const previous = loadV31RecoveryCopy(previewStorage);
    if (previous.kind === 'loaded') {
      setV31RecoveryCopy(previous.raw);
      setV31RecoveryError(null);
    } else {
      setV31RecoveryCopy(null);
      setV31RecoveryError(previous.message);
    }
    const latest = loadV32RecoveryCopy(previewStorage);
    if (latest.kind === 'loaded') {
      setV32RecoveryCopy(latest.raw);
      setV32RecoveryError(null);
    } else {
      setV32RecoveryCopy(null);
      setV32RecoveryError(latest.message);
    }
    const v33 = loadV33RecoveryCopy(previewStorage);
    if (v33.kind === 'loaded') {
      setV33RecoveryCopy(v33.raw);
      setV33RecoveryError(null);
    } else {
      setV33RecoveryCopy(null);
      setV33RecoveryError(v33.message);
    }
    const v34 = loadV34RecoveryCopy(previewStorage);
    if (v34.kind === 'loaded') {
      setV34RecoveryCopy(v34.raw);
      setV34RecoveryError(null);
    } else {
      setV34RecoveryCopy(null);
      setV34RecoveryError(v34.message);
    }
    const v35 = loadV35RecoveryCopy(previewStorage);
    if (v35.kind === 'loaded') {
      setV35RecoveryCopy(v35.raw);
      setV35RecoveryError(null);
    } else {
      setV35RecoveryCopy(null);
      setV35RecoveryError(v35.message);
    }
    const v36 = loadV36RecoveryCopy(previewStorage);
    if (v36.kind === 'loaded') {
      setV36RecoveryCopy(v36.raw);
      setV36RecoveryError(null);
    } else {
      setV36RecoveryCopy(null);
      setV36RecoveryError(v36.message);
    }
    const v40 = loadV40RecoveryCopy(previewStorage);
    if (v40.kind === 'loaded') {
      setV40RecoveryCopy(v40.raw);
      setV40RecoveryError(null);
    } else {
      setV40RecoveryCopy(null);
      setV40RecoveryError(v40.message);
    }
    const v41 = loadV41RecoveryCopy(previewStorage);
    if (v41.kind === 'loaded') {
      setV41RecoveryCopy(v41.raw);
    } else {
      setV41RecoveryCopy(null);
    }
    const v42 = loadV42RecoveryCopy(previewStorage);
    setV42RecoveryCopy(v42.kind === 'loaded' ? v42.raw : null);
    const v43 = loadV43RecoveryCopy(previewStorage);
    setV43RecoveryCopy(v43.kind === 'loaded' ? v43.raw : null);
    const v44 = loadV44RecoveryCopy(previewStorage);
    setV44RecoveryCopy(v44.kind === 'loaded' ? v44.raw : null);
    const v45 = loadV45RecoveryCopy(previewStorage);
    setV45RecoveryCopy(v45.kind === 'loaded' ? v45.raw : null);
    const v46 = loadV46RecoveryCopy(previewStorage);
    setV46RecoveryCopy(v46.kind === 'loaded' ? v46.raw : null);
    const v47 = loadV47RecoveryCopy(previewStorage);
    setV47RecoveryCopy(v47.kind === 'loaded' ? v47.raw : null);
    const v48 = loadV48RecoveryCopy(previewStorage);
    setV48RecoveryCopy(v48.kind === 'loaded' ? v48.raw : null);
    const v50 = loadV50RecoveryCopy(previewStorage);
    setV50RecoveryCopy(v50.kind === 'loaded' ? v50.raw : null);
    const v54 = loadV54RecoveryCopy(previewStorage);
    setV54RecoveryCopy(v54.kind === 'loaded' ? v54.raw : null);
    const v55 = loadV55RecoveryCopy(previewStorage);
    setV55RecoveryCopy(v55.kind === 'loaded' ? v55.raw : null);
  }

  function refreshV10RecoveryCopy() {
    const result = loadV10RecoveryCopy(previewStorage);
    if (result.kind === 'loaded') {
      setV10RecoveryCopy(result.raw);
      setV10RecoveryError(null);
    } else {
      setV10RecoveryCopy(null);
      setV10RecoveryError(result.message);
    }
    refreshV11RecoveryCopy();
  }

  function refreshV11RecoveryCopy() {
    const result = loadV11RecoveryCopy(previewStorage);
    if (result.kind === 'loaded') {
      setV11RecoveryCopy(result.raw);
      setV11RecoveryError(null);
    } else {
      setV11RecoveryCopy(null);
      setV11RecoveryError(result.message);
    }
    refreshV12RecoveryCopy();
  }

  function refreshV12RecoveryCopy() {
    const result = loadV12RecoveryCopy(previewStorage);
    if (result.kind === 'loaded') {
      setV12RecoveryCopy(result.raw);
      setV12RecoveryError(null);
    } else {
      setV12RecoveryCopy(null);
      setV12RecoveryError(result.message);
    }
    refreshV13RecoveryCopy();
  }

  function refreshV13RecoveryCopy() {
    const result = loadV13RecoveryCopy(previewStorage);
    if (result.kind === 'loaded') {
      setV13RecoveryCopy(result.raw);
      setV13RecoveryError(null);
    } else {
      setV13RecoveryCopy(null);
      setV13RecoveryError(result.message);
    }
    const v14 = loadV14RecoveryCopy(previewStorage);
    if (v14.kind === 'loaded') {
      setV14RecoveryCopy(v14.raw);
      setV14RecoveryError(null);
    } else {
      setV14RecoveryCopy(null);
      setV14RecoveryError(v14.message);
    }
    const v15 = loadV15RecoveryCopy(previewStorage);
    if (v15.kind === 'loaded') {
      setV15RecoveryCopy(v15.raw);
      setV15RecoveryError(null);
    } else {
      setV15RecoveryCopy(null);
      setV15RecoveryError(v15.message);
    }
    const v16 = loadV16RecoveryCopy(previewStorage);
    if (v16.kind === 'loaded') {
      setV16RecoveryCopy(v16.raw);
      setV16RecoveryError(null);
    } else {
      setV16RecoveryCopy(null);
      setV16RecoveryError(v16.message);
    }
    const v17 = loadV17RecoveryCopy(previewStorage);
    if (v17.kind === 'loaded') {
      setV17RecoveryCopy(v17.raw);
      setV17RecoveryError(null);
    } else {
      setV17RecoveryCopy(null);
      setV17RecoveryError(v17.message);
    }
    const v18 = loadV18RecoveryCopy(previewStorage);
    if (v18.kind === 'loaded') {
      setV18RecoveryCopy(v18.raw);
      setV18RecoveryError(null);
    } else {
      setV18RecoveryCopy(null);
      setV18RecoveryError(v18.message);
    }
    const v19 = loadV19RecoveryCopy(previewStorage);
    if (v19.kind === 'loaded') {
      setV19RecoveryCopy(v19.raw);
      setV19RecoveryError(null);
    } else {
      setV19RecoveryCopy(null);
      setV19RecoveryError(v19.message);
    }
    const v20 = loadV20RecoveryCopy(previewStorage);
    if (v20.kind === 'loaded') {
      setV20RecoveryCopy(v20.raw);
      setV20RecoveryError(null);
    } else {
      setV20RecoveryCopy(null);
      setV20RecoveryError(v20.message);
    }
    const v21 = loadV21RecoveryCopy(previewStorage);
    if (v21.kind === 'loaded') {
      setV21RecoveryCopy(v21.raw);
      setV21RecoveryError(null);
    } else {
      setV21RecoveryCopy(null);
      setV21RecoveryError(v21.message);
    }
    const v22 = loadV22RecoveryCopy(previewStorage);
    if (v22.kind === 'loaded') {
      setV22RecoveryCopy(v22.raw);
      setV22RecoveryError(null);
    } else {
      setV22RecoveryCopy(null);
      setV22RecoveryError(v22.message);
    }
    const v23 = loadV23RecoveryCopy(previewStorage);
    if (v23.kind === 'loaded') {
      setV23RecoveryCopy(v23.raw);
      setV23RecoveryError(null);
    } else {
      setV23RecoveryCopy(null);
      setV23RecoveryError(v23.message);
    }
    const v24 = loadV24RecoveryCopy(previewStorage);
    if (v24.kind === 'loaded') {
      setV24RecoveryCopy(v24.raw);
      setV24RecoveryError(null);
    } else {
      setV24RecoveryCopy(null);
      setV24RecoveryError(v24.message);
    }
    const v25 = loadV25RecoveryCopy(previewStorage);
    if (v25.kind === 'loaded') {
      setV25RecoveryCopy(v25.raw);
      setV25RecoveryError(null);
    } else {
      setV25RecoveryCopy(null);
      setV25RecoveryError(v25.message);
    }
    const v26 = loadV26RecoveryCopy(previewStorage);
    if (v26.kind === 'loaded') {
      setV26RecoveryCopy(v26.raw);
      setV26RecoveryError(null);
    } else {
      setV26RecoveryCopy(null);
      setV26RecoveryError(v26.message);
    }
    const v27 = loadV27RecoveryCopy(previewStorage);
    if (v27.kind === 'loaded') {
      setV27RecoveryCopy(v27.raw);
      setV27RecoveryError(null);
    } else {
      setV27RecoveryCopy(null);
      setV27RecoveryError(v27.message);
    }
    const v28 = loadV28RecoveryCopy(previewStorage);
    if (v28.kind === 'loaded') {
      setV28RecoveryCopy(v28.raw);
      setV28RecoveryError(null);
    } else {
      setV28RecoveryCopy(null);
      setV28RecoveryError(v28.message);
    }
  }

  useEffect(() => {
    refreshRawRecoveryCopy();
    refreshCloudRestoreRecoveryCopy();
    refreshStrengthRepairRecoveryCopy();
    refreshImportRecoveryCopy();
    refreshV1RecoveryCopy();
    refreshV2RecoveryCopy();
    refreshV3RecoveryCopy();
    refreshV4RecoveryCopy();
    refreshV5RecoveryCopy();
    refreshV6RecoveryCopy();
    refreshV7RecoveryCopy();
    refreshV8RecoveryCopy();
    refreshV9RecoveryCopy();
    refreshV29RecoveryCopy();
    refreshV30RecoveryCopy();
    if (!isIdentityCurrent()) return;
    const loaded = loadPreview(previewStorage, initialLoadDate);
    if (loaded.kind === 'loaded') {
      expectedRaw.current = loaded.raw;
      setFreshInitialData(null);
      hydratedDataWithoutSave.current = loaded.data;
      setPreviewData(loaded.data);
      setPersistedSatisfiedRhythmIds(satisfiedRhythmIdsForData(loaded.data));
      setPersistedCompletedRhythmIds(completedRhythmIdsForData(loaded.data));
      setPersistenceStatus({ kind: 'saved' });
      setAutoSaveEnabled(true);
    } else if (loaded.kind === 'missing') {
      expectedRaw.current = null;
      const initialData = initialPreviewData();
      setFreshInitialData(initialData);
      setPreviewData(initialData);
      setPersistedSatisfiedRhythmIds(new Set());
      setPersistedCompletedRhythmIds(new Set());
      setPersistenceStatus({ kind: 'saving' });
      setAutoSaveEnabled(true);
    } else if (loaded.kind === 'corrupt' || loaded.kind === 'unsupported') {
      expectedRaw.current = loaded.raw;
      setPersistenceStatus({ kind: loaded.kind, raw: loaded.raw, message: loaded.message });
    } else {
      setPersistenceStatus({ kind: 'unavailable', message: loaded.message });
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !autoSaveEnabled) return;
    if (hydratedDataWithoutSave.current === previewData) return;
    if (hydratedDataWithoutSave.current !== null) hydratedDataWithoutSave.current = null;
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    const saved = writeCurrentPreview(previewData, expectedRaw.current, { currentDate });
    refreshV29RecoveryCopy();
    refreshV30RecoveryCopy();
    refreshV1RecoveryCopy();
    refreshV2RecoveryCopy();
    refreshV3RecoveryCopy();
    refreshV4RecoveryCopy();
    refreshV5RecoveryCopy();
    refreshV6RecoveryCopy();
    refreshV7RecoveryCopy();
    refreshV8RecoveryCopy();
    refreshV9RecoveryCopy();
    if (saved.kind === 'saved') {
      expectedRaw.current = saved.raw;
      setPersistenceStatus({ kind: 'saved' });
    } else if (saved.kind === 'conflict') {
      externalRaw.current = saved.actualRaw;
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'conflict' });
    } else {
      setAutoSaveEnabled(false);
      setPersistenceStatus({
        kind: 'error',
        message: saved.message,
        ...(saved.diagnostic ? { diagnostic: saved.diagnostic } : {})
      });
    }
  }, [previewData, hydrated, autoSaveEnabled]);

  useEffect(() => {
    if (!hydrated) return;
    return listenForPreviewChanges(newValue => {
      if (!isIdentityCurrent()) return;
      if (newValue === expectedRaw.current) return;
      externalRaw.current = newValue;
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'conflict' });
    }, identity);
  }, [hydrated]);

  useEffect(() => {
    if (persistenceStatus.kind !== 'error' && persistenceStatus.kind !== 'conflict') return;
    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [persistenceStatus.kind]);

  useEffect(() => {
    document.documentElement.dataset.mobileTextSize = textSize === 'small' ? 'normal' : textSize === 'medium' ? 'large' : 'larger';
    document.documentElement.dataset.mobileTextSizeLevel = textSize === 'large' ? 'larger' : textSize;
  }, [textSize]);

  useEffect(() => {
    if (destination === 'more') morePageHeading.current?.focus();
  }, [destination, moreSettingsOpen, settingsDetail]);

  useEffect(() => {
    if (activeRhythmId) {
      wasDetailsOpen.current = true;
      return;
    }
    if (!wasDetailsOpen.current) return;
    wasDetailsOpen.current = false;
    if (dialogOpener.current?.isConnected) dialogOpener.current.focus({ preventScroll: true });
    else document.querySelector<HTMLButtonElement>('.utility-primary-button[aria-current="page"]')?.focus({ preventScroll: true });
  }, [activeRhythmId]);

  useEffect(() => {
    if (completionDialogRhythmId !== null) {
      wasCompletionDialogOpen.current = true;
      return;
    }
    if (!wasCompletionDialogOpen.current) return;
    wasCompletionDialogOpen.current = false;
    const opener = completionDialogOpener.current;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const focusTendedTarget = () => {
        const rhythmId = opener?.dataset.rhythmTendButton;
        if (rhythmId) {
          const doneRow = [...document.querySelectorAll<HTMLButtonElement>('[data-tended-rhythm-done-button]')]
            .find(item => item.dataset.tendedRhythmDoneButton === rhythmId);
          if (doneRow) {
            doneRow.focus({ preventScroll: true });
            return;
          }
        }
        const toggles = [...document.querySelectorAll<HTMLButtonElement>('.show-tended-list__toggle')];
        const toggle = toggles.find(item => item.closest('[hidden]') === null) ?? toggles[0];
        toggle?.focus({ preventScroll: true });
      };
      if (opener?.isConnected) {
        if (opener.disabled) {
          const replacement = opener.closest('article')
            ?.querySelector<HTMLButtonElement>(
              '.focus-rhythm-title, .today-rhythm-details__history-button, .today-rhythm-card__details-toggle'
            );
          if (replacement) replacement.focus({ preventScroll: true });
          else focusTendedTarget();
        } else {
          opener.focus({ preventScroll: true });
        }
      } else {
        focusTendedTarget();
      }
    });
    completionDialogOpener.current = null;
    return () => { cancelled = true; };
  }, [completionDialogRhythmId]);

  useEffect(() => {
    if (rhythmEditor) {
      wasRhythmEditorOpen.current = true;
      return;
    }
    if (!wasRhythmEditorOpen.current) return;
    wasRhythmEditorOpen.current = false;
    if (rhythmEditorReturnsToSuggestions.current) {
      rhythmEditorReturnsToSuggestions.current = false;
      return;
    }
    if (rhythmEditorOpener.current?.isConnected) rhythmEditorOpener.current.focus({ preventScroll: true });
    else document.querySelector<HTMLButtonElement>('.utility-primary-button[aria-current="page"]')?.focus({ preventScroll: true });
  }, [rhythmEditor]);

  function navigate(
    next: Destination,
    { categoryTabDefault = true }: { categoryTabDefault?: boolean } = {}
  ) {
    const safeDestination = isCategoryEnabled(previewData.categoryPreferences, next)
      ? next
      : next === 'faith' || next === 'marriage' || next === 'dating' || next === 'parenting'
        || next === 'health' || next === 'finances' || next === 'friendships'
        ? 'today'
        : next;
    if (profilePersonId !== null) {
      const state = { ...(window.history.state ?? {}) };
      delete state[personProfileHistoryKey];
      window.history.replaceState(state, '', window.location.href);
      profileReturnRhythmId.current = null;
      profileReturnScrollTop.current = null;
      profileOpener.current = null;
      profileReturnPersonId.current = null;
      setProfilePersonId(null);
    }
    if (categoryTabDefault
      && (safeDestination === 'faith' || safeDestination === 'marriage'
        || safeDestination === 'parenting' || safeDestination === 'friendships'
        || safeDestination === 'health' || safeDestination === 'dating')) {
      categoryTabNavigationSequence.current += 1;
      setCategoryTabNavigationRequest({
        categoryId: safeDestination,
        requestId: categoryTabNavigationSequence.current
      });
    } else if (!categoryTabDefault) {
      setCategoryTabNavigationRequest(null);
    }
    if (safeDestination !== 'people') setPeopleInitialFilter('all');
    setDestination(safeDestination);
    if (safeDestination === 'health') setHealthFitnessVisited(true);
    setMoreSettingsOpen(false);
    setSearch('');
    setSearchOpen(false);
    document.body.classList.remove('mobile-search-open');
  }

  function openPersonProfileAt(
    personId: PersonId,
    tab: ProfileTab = 'rhythms',
    targetPrayerRequestId?: string,
    options: {
      sparkCompletionId?: string;
      openNotes?: boolean;
      returnFocus?: HTMLElement | null;
    } = {}
  ) {
    if (!previewData.prayerEnabled && tab === 'prayer') return;
    profileNavigationSequence.current += 1;
    setProfileNavigationRequest({
      personId,
      requestId: profileNavigationSequence.current,
      tab,
      ...(targetPrayerRequestId ? { targetPrayerRequestId } : {}),
      ...(options.sparkCompletionId ? { sparkCompletionId: options.sparkCompletionId } : {}),
      ...(options.openNotes ? { openNotes: true } : {})
    });
    if (profilePersonId === personId) return;
    if (profilePersonId === null) {
      profileOpener.current = options.returnFocus
        ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      profileReturnPersonId.current = personId;
      profileReturnRhythmId.current = activeRhythmId;
      profileReturnScrollTop.current = (document.scrollingElement ?? document.documentElement).scrollTop;
      if (activeRhythmId !== null) setActiveRhythmId(null);
    }
    window.history.pushState(
      { ...(window.history.state ?? {}), [personProfileHistoryKey]: personId },
      '',
      window.location.href
    );
    setProfilePersonId(personId);
  }

  function openPersonProfile(personId: PersonId) {
    openPersonProfileAt(personId);
  }

  function openSearchResult(result: GlobalSearchResult) {
    if (!previewData.prayerEnabled && (result.kind === 'prayer' || result.kind === 'prayer-note')) return;
    if (result.kind === 'person') {
      openPersonProfileAt(result.personId);
    } else if (result.kind === 'rhythm') {
      const rhythm = [...allTodayRhythms, ...resolvedMarriageRhythms]
        .find(candidate => candidate.id === result.rhythmId);
      if (rhythm) openRhythmEditor(undefined, rhythm);
    } else if (result.kind === 'prayer' || result.kind === 'prayer-note') {
      openPersonProfileAt(result.personId, 'prayer', result.requestId);
    } else if (result.kind === 'connection-note') {
      openPersonProfileAt(result.personId, 'connections');
    } else {
      openPersonProfileAt(result.personId);
    }
  }

  function openPersonDetailsEditor(personId: PersonId, event: MouseEvent<HTMLButtonElement>) {
    personDetailsEditorOpener.current = event.currentTarget;
    setPersonDetailsEditorId(personId);
  }

  function closePersonDetailsEditor() {
    setPersonDetailsEditorId(null);
  }

  function createPerson(
    person: PersonPreview,
    groupIds: readonly PersonPickerGroupId[]
  ): string | null {
    if (groupIds.length > 1) return 'Choose one category for this person.';
    if (previewData.people.some(item => item.id === person.id)) {
      return 'This person ID already exists. No changes were saved.';
    }
    const peopleGroups = setPersonCategory(previewData.peopleGroups, person.id, groupIds[0] ?? null);
    return persistSeasonHistory({
      ...previewData,
      people: [...previewData.people, person],
      peopleGroups
    }, 'person');
  }

  function savePersonDetails(personId: PersonId, draft: PersonDetailsDraft): string | null {
    const result = savePersonDetailsCommand(previewData.personDetails, personId, draft, currentDate);
    if (!result.valid) return Object.values(result.errors)[0] ?? 'Person details are invalid.';
    let peopleGroups = previewData.peopleGroups;
    if (draft.categoryChanged) {
      peopleGroups = setPersonCategory(peopleGroups, personId, draft.categoryIds[0] ?? null);
    }
    const cadence = connectionCadences.find(item => item === draft.connectionCadence) ?? null;
    const friendships = setPersonConnectionCadence(
      previewData.friendships,
      personId,
      cadence,
      currentDate
    );
    return persistSeasonHistory({
      ...previewData,
      personDetails: result.details,
      peopleGroups,
      friendships
    }, 'person settings');
  }

  function savePersonNote(personId: PersonId, draft: PersonNoteDraft): string | null {
    const now = new Date().toISOString();
    const result = createPersonNote(previewData.personNotes, {
      id: `person-note-${globalThis.crypto.randomUUID()}`,
      personId,
      sharedWith: draft.sharedWith,
      content: draft.content,
      createdAt: now,
      updatedAt: now
    });
    if (!result.valid) return result.error;
    return persistSeasonHistory({ ...previewData, personNotes: result.notes }, 'person note');
  }

  function editPersonNote(
    noteId: string,
    expectedUpdatedAt: string,
    actorId: PersonId,
    draft: PersonNoteDraft
  ): string | null {
    const result = updatePersonNote(
      previewData.personNotes,
      noteId,
      expectedUpdatedAt,
      actorId,
      draft,
      new Date().toISOString()
    );
    if (!result.valid) return result.error;
    return persistSeasonHistory({ ...previewData, personNotes: result.notes }, 'person note');
  }

  function removePersonNote(noteId: string, expectedUpdatedAt: string, actorId: PersonId): string | null {
    const result = deletePersonNote(previewData.personNotes, noteId, expectedUpdatedAt, actorId);
    if (!result.valid) return result.error;
    return persistSeasonHistory({ ...previewData, personNotes: result.notes }, 'person note');
  }

  function createPrayerRequest(personId: PersonId, draft: PersonPrayerRequestDraft): string | null {
    if (!previewData.prayerEnabled) return prayerUnavailableMessage;
    const now = new Date().toISOString();
    const result = createPersonPrayerRequest(previewData.prayerRequests, {
      id: `prayer-request-${globalThis.crypto.randomUUID()}`,
      personId,
      sharedWith: draft.sharedWith,
      title: draft.title.trim(),
      ...(draft.details.trim() ? { details: draft.details } : {}),
      status: 'active',
      createdAt: now,
      updatedAt: now,
      prayerLogs: []
    }, previewData.people.map(person => person.id));
    if (!result.valid) return result.error;
    return persistSeasonHistory({ ...previewData, prayerRequests: result.requests }, 'prayer request');
  }

  function editPrayerRequest(
    requestId: string,
    expectedUpdatedAt: string,
    actorId: PersonId,
    draft: PersonPrayerRequestDraft
  ): string | null {
    if (!previewData.prayerEnabled) return prayerUnavailableMessage;
    const result = updatePersonPrayerRequest(
      previewData.prayerRequests,
      requestId,
      expectedUpdatedAt,
      actorId,
      { ...draft, title: draft.title.trim() },
      new Date().toISOString(),
      previewData.people.map(person => person.id)
    );
    if (!result.valid) return result.error;
    return persistSeasonHistory({ ...previewData, prayerRequests: result.requests }, 'prayer request');
  }

  function transitionPrayerRequest(
    requestId: string,
    expectedUpdatedAt: string,
    actorId: PersonId,
    transition: PrayerRequestTransition
  ): string | null {
    if (!previewData.prayerEnabled) return prayerUnavailableMessage;
    const result = transitionPersonPrayerRequest(
      previewData.prayerRequests,
      requestId,
      expectedUpdatedAt,
      actorId,
      transition,
      new Date().toISOString()
    );
    if (!result.valid) return result.error;
    return persistSeasonHistory({ ...previewData, prayerRequests: result.requests }, 'prayer request');
  }

  function prayForRequest(requestId: string, expectedUpdatedAt: string, actorId: PersonId): string | null {
    if (!previewData.prayerEnabled) return prayerUnavailableMessage;
    const now = new Date().toISOString();
    const result = recordPersonPrayer(
      previewData.prayerRequests,
      requestId,
      expectedUpdatedAt,
      actorId,
      { id: `prayer-log-${globalThis.crypto.randomUUID()}`, prayedAt: now },
      previewData.people.map(person => person.id)
    );
    if (!result.valid) return result.error;
    return persistSeasonHistory({ ...previewData, prayerRequests: result.requests }, 'prayer log');
  }

  function removePrayerRequest(requestId: string, expectedUpdatedAt: string, actorId: PersonId): string | null {
    if (!previewData.prayerEnabled) return prayerUnavailableMessage;
    const request = previewData.prayerRequests.find(item => item.id === requestId);
    if (!request) return 'This prayer request is no longer available.';
    const result = request.personId === actorId
      ? deletePersonPrayerRequest(previewData.prayerRequests, requestId, expectedUpdatedAt, actorId)
      : unlinkPersonPrayerRequest(
          previewData.prayerRequests,
          requestId,
          expectedUpdatedAt,
          actorId,
          new Date().toISOString()
        );
    if (!result.valid) return result.error;
    return persistSeasonHistory({ ...previewData, prayerRequests: result.requests }, 'prayer request');
  }

  function createPersonSparkForProfile(ownerId: PersonId, draft: PersonSparkDraft): string | null {
    const result = createPersonSpark(
      previewData.personSparks,
      ownerId,
      draft,
      `person-spark-${globalThis.crypto.randomUUID()}`
    );
    if (!result.ok) return result.error;
    return persistSeasonHistory({ ...previewData, personSparks: result.value }, 'Spark');
  }

  function editPersonSpark(sparkId: string, draft: PersonSparkDraft): string | null {
    const result = updatePersonSpark(
      previewData.personSparks,
      sparkId,
      draft,
      previewData.people.map(person => person.id)
    );
    if (!result.ok) return result.error;
    return persistSeasonHistory({ ...previewData, personSparks: result.value }, 'Spark');
  }

  function archivePersonSpark(sparkId: string, archived: boolean): string | null {
    if (!previewData.personSparks.some(spark => spark.id === sparkId)) {
      return 'This Spark is no longer available.';
    }
    return persistSeasonHistory({
      ...previewData,
      personSparks: setPersonSparkArchived(previewData.personSparks, sparkId, archived)
    }, 'Spark');
  }

  function removePersonSpark(sparkId: string, viewerId: PersonId): string | null {
    const result = deletePersonSpark(
      previewData.personSparks,
      previewData.friendships,
      sparkId,
      viewerId
    );
    if (!result.ok) return result.error;
    return persistSeasonHistory({
      ...previewData,
      personSparks: result.value.sparks,
      friendships: result.value.friendships
    }, 'Spark');
  }

  function undoSparkCompletion(sparkId: string): string | null {
    const result = undoPersonSparkCompletion(
      previewData.personSparks,
      previewData.friendships,
      sparkId
    );
    if (!result.ok) return result.error;
    return persistSeasonHistory({
      ...previewData,
      personSparks: result.value.sparks,
      friendships: result.value.friendships
    }, 'Spark completion');
  }

  function completeSparkWithConnection(
    sparkId: string,
    connection: FriendshipConnection
  ): string | null {
    const result = completePersonSpark(
      previewData.personSparks,
      previewData.friendships,
      sparkId,
      connection
    );
    if (!result.ok) return result.error;
    return persistSeasonHistory({
      ...previewData,
      personSparks: result.value.sparks,
      friendships: result.value.friendships
    }, 'Spark connection');
  }

  function savePersonConnection(connection: FriendshipConnection): string | null {
    const existing = previewData.friendships.connections.find(item => item.id === connection.id);
    const reconciledConnection = reconcileDirectRhythmConnectionEdit(existing, connection);
    const result = savePersonConnectionCommand(
      previewData.personSparks,
      previewData.friendships,
      reconciledConnection
    );
    if (!result.ok) return result.error;
    return persistSeasonHistory({
      ...previewData,
      personSparks: result.value.sparks,
      friendships: result.value.friendships
    }, 'connection');
  }

  function removePersonConnection(connectionId: string): string | null {
    const result = deletePersonConnection(
      previewData.personSparks,
      previewData.friendships,
      connectionId
    );
    if (!result.ok) return result.error;
    return persistSeasonHistory({
      ...previewData,
      personSparks: result.value.sparks,
      friendships: result.value.friendships
    }, 'connection');
  }

  useEffect(() => {
    if (personDetailsEditorId !== null) {
      wasPersonDetailsEditorOpen.current = true;
      return;
    }
    if (wasPersonDetailsEditorOpen.current) {
      wasPersonDetailsEditorOpen.current = false;
      personDetailsEditorOpener.current?.focus({ preventScroll: true });
    }
  }, [personDetailsEditorId]);

  function closePersonProfile() {
    if (window.history.state?.[personProfileHistoryKey]) {
      window.history.back();
    } else {
      setProfilePersonId(null);
    }
  }

  useEffect(() => {
    function syncProfileFromHistory() {
      const profileId = window.history.state?.[personProfileHistoryKey];
      setProfilePersonId(typeof profileId === 'string'
        ? previewData.people.find(person => person.id === profileId)?.id ?? null
        : null);
    }
    window.addEventListener('popstate', syncProfileFromHistory);
    return () => window.removeEventListener('popstate', syncProfileFromHistory);
  }, []);

  useLayoutEffect(() => {
    if (profilePersonId !== null) {
      (document.scrollingElement ?? document.documentElement).scrollTop = 0;
    }
  }, [profilePersonId]);

  useEffect(() => {
    if (profilePersonId !== null) {
      wasProfileOpen.current = true;
      return;
    }
    if (wasProfileOpen.current) {
      wasProfileOpen.current = false;
      const returnRhythmId = profileReturnRhythmId.current;
      profileReturnRhythmId.current = null;
      if (returnRhythmId !== null) {
        profileReturnFocusRhythmId.current = returnRhythmId;
        setActiveRhythmId(returnRhythmId);
      } else {
        const returnScrollTop = profileReturnScrollTop.current;
        profileReturnScrollTop.current = null;
        if (returnScrollTop !== null) {
          (document.scrollingElement ?? document.documentElement).scrollTop = returnScrollTop;
        }
        restorePersonProfileFocus(profileOpener.current, profileReturnPersonId.current);
        profileOpener.current = null;
        profileReturnPersonId.current = null;
      }
    }
  }, [profilePersonId]);

  useEffect(() => {
    const returnRhythmId = profileReturnFocusRhythmId.current;
    if (returnRhythmId === null || activeRhythmId !== returnRhythmId) return;
    const returnScrollTop = profileReturnScrollTop.current;
    profileReturnFocusRhythmId.current = null;
    profileReturnScrollTop.current = null;
    if (returnScrollTop !== null) {
      (document.scrollingElement ?? document.documentElement).scrollTop = returnScrollTop;
    }
    restorePersonProfileFocus(profileOpener.current, profileReturnPersonId.current);
    profileOpener.current = null;
    profileReturnPersonId.current = null;
  }, [activeRhythmId]);

  function navigateToFoundation(foundationId: string, returnTab: 'today' | MarriageTab) {
    const categoryId = foundationCategoryId(foundationId);
    if (!categoryId) return;
    if (!isFoundationEnabled(availability, foundationId)) {
      navigate(isCategoryEnabled(previewData.categoryPreferences, categoryId) ? categoryId : 'today');
      return;
    }
    foundationNavigationSequence.current += 1;
    setFoundationNavigationRequest({
      foundationId,
      requestId: foundationNavigationSequence.current,
      returnTab
    });
    navigate(categoryId, { categoryTabDefault: false });
  }

  function closeSearch() {
    setSearch('');
    setSearchOpen(false);
    document.body.classList.remove('mobile-search-open');
  }

  function toggleSearch() {
    const next = !searchOpen;
    setSearchOpen(next);
    document.body.classList.toggle('mobile-search-open', next);
    if (!next) setSearch('');
  }

  function openRhythmHistory(
    id: string,
    event: MouseEvent<HTMLButtonElement>,
    returnTab: 'today' | MarriageTab = 'today'
  ) {
    dialogOpener.current = event.currentTarget;
    activeRhythmReturnTab.current = returnTab;
    setDetailsInitialView('history');
    setActiveRhythmId(id);
  }

  function openCompletion(id: string, event: MouseEvent<HTMLButtonElement>) {
    if (!isEditableRhythmId(id) || completedRhythms.has(id)
      || previewData.archivedRhythmIds.includes(id)) return;
    const rhythm = allTodayRhythms.find(item => item.id === id);
    if (rhythm?.categoryIds?.includes('health')) {
      if (rhythm.healthLogCapability === 'flexibility') {
        flexibilityLogRequestSequence.current += 1;
        setFlexibilityLogRequest({
          requestId: flexibilityLogRequestSequence.current,
          opener: event.currentTarget,
          rhythm
        });
        navigate('health', { categoryTabDefault: false });
        return;
      }
      if (rhythm.healthLogCapability === 'cardio') {
        cardioLogRequestSequence.current += 1;
        setCardioLogRequest({
          requestId: cardioLogRequestSequence.current,
          opener: event.currentTarget,
          rhythm
        });
        navigate('health', { categoryTabDefault: false });
        return;
      }
      if (rhythm.healthLogCapability === 'weight') {
        weightLogRequestSequence.current += 1;
        setWeightLogRequest({
          requestId: weightLogRequestSequence.current,
          opener: event.currentTarget,
          rhythm
        });
        navigate('health', { categoryTabDefault: false });
        return;
      }
      const mode = previewData.strength.rhythmModes.find(item => item.rhythmId === id);
      strengthLogRequestSequence.current += 1;
      setStrengthLogRequest({
        rhythmId: id,
        mode: mode?.mode ?? 'recommended',
        ...(mode?.workoutId ? { workoutId: mode.workoutId } : {}),
        requestId: strengthLogRequestSequence.current,
        opener: event.currentTarget
      });
      navigate('health', { categoryTabDefault: false });
      return;
    }
    completionDialogOpener.current = event.currentTarget;
    setCompletionDialogRhythmId(id);
  }

  function openRhythmEditor(
    event: MouseEvent<HTMLButtonElement> | undefined,
    rhythm?: (typeof todayRhythms)[number],
    options?: {
      id?: string;
      initialDraft?: RhythmDraft;
      suggestionSourceId?: string;
      recommendedFrequency?: RhythmFrequencyRecommendation;
      frequencyGuidance?: string;
      returnToSuggestions?: (saved: boolean) => void;
    }
  ) {
    rhythmEditorOpener.current = event?.currentTarget ?? null;
    rhythmEditorReturnsToSuggestions.current = false;
    setRhythmEditor({
      id: options?.id ?? rhythm?.id ?? `user-rhythm-${globalThis.crypto.randomUUID()}`,
      ...(options?.initialDraft ? { initialDraft: options.initialDraft } : {}),
      ...(options?.suggestionSourceId ? { suggestionSourceId: options.suggestionSourceId } : {}),
      ...(options?.recommendedFrequency ? { recommendedFrequency: options.recommendedFrequency } : {}),
      ...(options?.frequencyGuidance ? { frequencyGuidance: options.frequencyGuidance } : {}),
      ...(options?.returnToSuggestions ? { returnToSuggestions: options.returnToSuggestions } : {}),
      ...(rhythm ? { rhythm } : {})
    });
  }

  function finishRhythmEditor(saved: boolean) {
    const returnToSuggestions = rhythmEditor?.returnToSuggestions;
    if (returnToSuggestions) rhythmEditorReturnsToSuggestions.current = true;
    setRhythmEditor(null);
    returnToSuggestions?.(saved);
  }

  function openRhythmSuggestion(
    suggestion: CategoryRhythmSuggestion,
    event: MouseEvent<HTMLButtonElement>,
    returnToSuggestions: (saved: boolean) => void,
    initialPersonIds: readonly PersonId[] = []
  ) {
    const rhythm = suggestion.rhythm;
    const initialDraft: RhythmDraft = {
      title: rhythm.title,
      description: rhythm.description ?? '',
      cadence: rhythm.cadence ?? 'Daily',
      timeLabel: rhythm.timeLabel ?? 'Anytime',
      personIds: [...initialPersonIds],
      categoryIds: [suggestion.categoryId],
      ...(rhythm.schedule
        ? { schedule: rhythm.schedule }
        : suggestion.recommendedFrequency === 'daily' ? { schedule: { frequency: 'daily' as const } } : {}),
      scheduleEditing: true,
      personal: false,
      primaryFoundationId: rhythm.primaryFoundationId ?? null,
      secondaryFoundationIds: [...(rhythm.secondaryFoundationIds ?? [])],
      ...(rhythm.healthLogCapability ? { healthLogCapability: rhythm.healthLogCapability } : {}),
      ...(rhythm.healthRunTarget ? { healthRunTarget: rhythm.healthRunTarget } : {}),
      ...(suggestion.healthWorkoutMode ? { healthWorkoutMode: suggestion.healthWorkoutMode } : {})
    };
    openRhythmEditor(event, undefined, {
      initialDraft,
      suggestionSourceId: suggestion.sourceId,
      recommendedFrequency: suggestion.recommendedFrequency,
      ...(suggestion.frequencyGuidance ? { frequencyGuidance: suggestion.frequencyGuidance } : {}),
      returnToSuggestions
    });
  }

  function saveRhythm(draft: RhythmDraft): RhythmDraftErrors {
    if (!rhythmEditor) return { title: 'The Rhythm editor is no longer active.' };
    if (!rhythmEditor.rhythm && previewData.savedRhythms.some(saved => saved.id === rhythmEditor.id)) {
      return { title: 'This Rhythm draft has already been saved. No duplicate Rhythm was created.' };
    }
    if (draft.healthLogCapability === 'workout'
      && draft.healthWorkoutMode === 'specific'
      && !previewData.strength.savedWorkouts.some(workout => workout.id === draft.healthWorkoutId)) {
      return { healthWorkoutId: 'Select an available saved workout.' };
    }
    const scoringTimeZone = rhythmEditor.rhythm?.scoring?.timeZone
      ?? rhythmEditor.rhythm?.createdTimeZone
      ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    const hasDatedCompletionHistory = previewData.rhythmHistoryIds.includes(rhythmEditor.id)
      || (rhythmEditor.rhythm?.completionHistory?.length ?? 0) > 0;
    const earliestDatedCompletionDate = rhythmEditor.rhythm?.completionHistory
      ?.map(record => record.effectiveDate)
      .sort()[0];
    const creationInstant = new Date();
    const creationTimeValue = rhythmTimeValueFromLabel(draft.timeLabel, configuredRhythmTimeOptions);
    const creationTimeBlockId = creationTimeValue
      ? timeBlockIdFromRhythmValue(creationTimeValue)
      : undefined;
    const creationDueTime = creationTimeBlockId
      ? previewData.timeBlocks.blocks.find(block => block.id === creationTimeBlockId)?.start
      : undefined;
    const result = saveRhythmDraft(
      previewData.savedRhythms,
      draft,
      rhythmEditor.id,
      rhythmEditor.rhythm ? 'edit' : 'create',
      {
        currentDate: localDateInTimeZone(creationInstant, scoringTimeZone),
        deviceTimeZone: scoringTimeZone,
        ...(!rhythmEditor.rhythm && creationDueTime
          ? {
              createdLocalTime: localTimeInTimeZone(creationInstant, scoringTimeZone),
              createdDueTime: creationDueTime
            }
          : {}),
        hasDatedCompletionHistory,
        ...(rhythmEditor.rhythm?.createdLocalDate
          ? { effectiveStartDate: rhythmEditor.rhythm.createdLocalDate }
          : {}),
        ...(earliestDatedCompletionDate ? { earliestDatedCompletionDate } : {})
      },
      undefined,
      {
        ...(rhythmEditor.suggestionSourceId
          ? { suggestionSourceId: rhythmEditor.suggestionSourceId }
          : {}),
        timeOptions: configuredRhythmTimeOptions,
        categoryPreferences: previewData.categoryPreferences
      },
      previewData.people.map(person => person.id)
    );
    const savedRhythms = result.savedRhythms;
    if (!savedRhythms) return result.errors;
    const savedRhythm = resolveTodayRhythms(savedRhythms).find(item => item.id === rhythmEditor.id);
    if (!savedRhythm) return { form: 'The saved Rhythm could not be resolved. No changes were saved.' };
    const priorWorkoutSetting = previewData.strength.rhythmModes.find(item =>
      item.rhythmId === rhythmEditor.id
    );
    const shouldSaveWorkoutSetting = isCategoryEnabled(previewData.categoryPreferences, 'health')
      && (draft.categoryIds.includes('health')
        || priorWorkoutSetting?.mode === 'rotation'
        || !rhythmEditor.rhythm);
    let strength = previewData.strength;
    if (shouldSaveWorkoutSetting) {
      const workoutMode = draft.healthLogCapability === 'workout'
        ? draft.healthWorkoutMode ?? 'recommended'
        : priorWorkoutSetting?.mode === 'rotation' ? 'recommended' : priorWorkoutSetting?.mode ?? 'recommended';
      const modeUpdate = updateStrengthRhythmMode({
        ...(priorWorkoutSetting ? { prior: priorWorkoutSetting } : {}),
        rhythm: savedRhythm,
        mode: workoutMode,
        ...(draft.healthWorkoutMode === 'specific' && draft.healthWorkoutId
          ? { workoutId: draft.healthWorkoutId }
          : {}),
        rotationWorkoutIds: draft.healthWorkoutRotationWorkoutIds ?? [],
        advanceMode: draft.healthWorkoutRotationAdvanceMode ?? 'after-completion',
        savedWorkouts: previewData.strength.savedWorkouts,
        workouts: previewData.strength.workouts,
        completions: previewData.datedRhythmCompletions,
        ...(previewData.strength.guidedSessionDraft
          ? { activeDraft: previewData.strength.guidedSessionDraft }
          : {}),
        asOfDate: localDateInTimeZone(creationInstant, scoringTimeZone),
        scheduleChanged: draft.schedule !== undefined && draft.originalSchedule !== undefined
          ? !rhythmSchedulesEqual(draft.schedule, draft.originalSchedule)
          : false
      });
      if (!modeUpdate.valid) {
        return workoutMode === 'rotation'
          ? { healthWorkoutRotationWorkoutIds: modeUpdate.error }
          : { form: modeUpdate.error };
      }
      strength = {
        ...previewData.strength,
        rhythmModes: [
          ...previewData.strength.rhythmModes.filter(item => item.rhythmId !== rhythmEditor.id),
          modeUpdate.setting
        ]
      };
    }
    const nextData: PreviewData = {
      ...previewData,
      savedRhythms,
      strength,
      ...(hasDatedCompletionHistory && !previewData.rhythmHistoryIds.includes(rhythmEditor.id)
        ? { rhythmHistoryIds: [...previewData.rhythmHistoryIds, rhythmEditor.id] }
        : {})
    };
    const written = writeCurrentPreview(nextData, expectedRaw.current, { currentDate });
    refreshV29RecoveryCopy();
    refreshV30RecoveryCopy();
    refreshV1RecoveryCopy();
    refreshV2RecoveryCopy();
    refreshV3RecoveryCopy();
    refreshV4RecoveryCopy();
    refreshV5RecoveryCopy();
    refreshV6RecoveryCopy();
    refreshV7RecoveryCopy();
    refreshV8RecoveryCopy();
    refreshV9RecoveryCopy();
    if (written.kind === 'conflict') {
      externalRaw.current = written.actualRaw;
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'conflict' });
      return { form: 'Preview storage changed in another tab. No Rhythm changes were saved.' };
    }
    if (written.kind === 'error') {
      setAutoSaveEnabled(false);
      setPersistenceStatus({
        kind: 'error',
        message: written.message,
        ...(written.diagnostic ? { diagnostic: written.diagnostic } : {})
      });
      return { form: `Preview could not save this Rhythm. ${written.message}` };
    }
    expectedRaw.current = written.raw;
    externalRaw.current = null;
    skipNextAutosave.current = true;
    setPreviewData(nextData);
    setAutoSaveEnabled(true);
    setPersistenceStatus({ kind: 'saved' });
    finishRhythmEditor(true);
    return result.errors;
  }

  function persistSeasonHistory(nextData: PreviewData, action: string): string | null {
    const written = writeCurrentPreview(nextData, expectedRaw.current, { currentDate });
    refreshV29RecoveryCopy();
    refreshV30RecoveryCopy();
    refreshV1RecoveryCopy();
    refreshV2RecoveryCopy();
    refreshV3RecoveryCopy();
    refreshV4RecoveryCopy();
    refreshV5RecoveryCopy();
    refreshV6RecoveryCopy();
    refreshV7RecoveryCopy();
    refreshV8RecoveryCopy();
    refreshV9RecoveryCopy();
    refreshV10RecoveryCopy();
    if (written.kind === 'conflict') {
      externalRaw.current = written.actualRaw;
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'conflict' });
      return `Preview storage changed in another tab. No ${action} was saved.`;
    }
    if (written.kind === 'error') {
      setAutoSaveEnabled(false);
      const failureDetail = written.diagnostic
        ? ` (${written.diagnostic.rejectedRule}${written.diagnostic.failurePath
          ? ` at ${written.diagnostic.failurePath}`
          : ''})`
        : '';
      const message = `${written.message}${failureDetail}`;
      setPersistenceStatus({
        kind: 'error',
        message,
        ...(written.diagnostic ? { diagnostic: written.diagnostic } : {})
      });
      return `Preview could not save this ${action}. ${message}`;
    }
    expectedRaw.current = written.raw;
    externalRaw.current = null;
    skipNextAutosave.current = true;
    setPreviewData(nextData);
    setAutoSaveEnabled(true);
    setPersistenceStatus({ kind: 'saved' });
    return null;
  }

  function saveTimeBlockSettings(settings: PreviewData['timeBlocks']): string | null {
    const validation = validateTimeBlockSettings(settings);
    if (!validation.valid) return validation.errors[0] ?? 'Time block settings are invalid.';
    const nextBlockIds = new Set(validation.settings.blocks.map(block => block.id));
    const removedAssignedBlocks = [...assignedTimeBlockIds(previewData.savedRhythms)]
      .filter(id => !nextBlockIds.has(id));
    if (removedAssignedBlocks.length > 0) {
      return 'A time block is still used by a current or historical Rhythm schedule. Keep the block to preserve those assignments.';
    }

    return persistSeasonHistory({
      ...previewData,
      timeBlocks: validation.settings
    }, 'time block settings');
  }

  function saveCalendarSources(sources: CalendarSource[]): string | null {
    const validation = validateCalendarSources(sources);
    if (!validation.valid) {
      return validation.errors[0] ?? 'Calendar settings are invalid. No changes were saved.';
    }
    return persistSeasonHistory({
      ...previewData,
      calendarSources: validation.sources
    }, 'calendar settings');
  }

  function saveStrengthData(strength: PreviewData['strength']): string | null {
    if (!validateStrengthData(
      strength,
      true,
      true,
      true,
      true,
      previewData.people.map(person => person.id),
      true
    )) {
      return 'Strength settings or workout records are invalid. No changes were saved.';
    }
    const previousLogs = new Map(previewData.strength.workouts.map(log => [log.id, log]));
    const nextLogs = new Map(strength.workouts.map(log => [log.id, log]));
    let datedRhythmCompletions = [...previewData.datedRhythmCompletions];
    let activeRhythmCompletions = [...previewData.activeRhythmCompletions];
    let completedRhythmIds = [...previewData.completedRhythmIds];
    let rhythmHistoryIds = [...previewData.rhythmHistoryIds];

    for (const previous of previousLogs.values()) {
      const next = nextLogs.get(previous.id);
      if (!previous.completionId || next?.completionId === previous.completionId && next.rhythmId === previous.rhythmId) continue;
      const removed = deleteDatedCompletion(
        datedRhythmCompletions,
        activeRhythmCompletions,
        completedRhythmIds,
        previous.completionId
      );
      datedRhythmCompletions = removed.records;
      activeRhythmCompletions = removed.active;
      completedRhythmIds = removed.completedRhythmIds;
    }

    const now = new Date();
    const timeParts = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).formatToParts(now);
    const hour = Number(timeParts.find(part => part.type === 'hour')?.value);
    const minute = Number(timeParts.find(part => part.type === 'minute')?.value);
    const period = timeParts.find(part => part.type === 'dayPeriod')?.value.toUpperCase();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    for (const log of strength.workouts) {
      if (!log.rhythmId) continue;
      const previous = previousLogs.get(log.id);
      const rhythm = allTodayRhythms.find(item => item.id === log.rhythmId);
      if (!rhythm || rhythm.healthLogCapability !== 'workout'
        || !rhythm.categoryIds?.includes('health') || !isEditableRhythmId(log.rhythmId)
        || previewData.archivedRhythmIds.includes(log.rhythmId)
        || log.rhythmOccurrence !== log.date || !log.completionId) {
        return 'The linked Strength Rhythm or its completion record is unavailable. No workout changes were saved.';
      }
      const existingCompletion = datedRhythmCompletions.find(item => item.id === log.completionId);
      const ownsCompletion = previous?.completionId === log.completionId;
      if (existingCompletion && !ownsCompletion) {
        return 'This workout is linked to a different completion record. No changes were saved.';
      }
      if (ownsCompletion && !existingCompletion) {
        return 'The linked completion record is missing. No workout changes were saved.';
      }
      const unchangedLinkedWorkout = ownsCompletion && existingCompletion
        && previous?.rhythmId === log.rhythmId
        && previous.rhythmOccurrence === log.rhythmOccurrence
        && previous.date === log.date
        && previous.savedWorkoutId === log.savedWorkoutId;
      if (unchangedLinkedWorkout) continue;
      const rotationSetting = strength.rhythmModes.find(item => item.rhythmId === log.rhythmId);
      if (rotationSetting?.mode === 'rotation') {
        const assignment = selectStrengthRotationAssignment({
          rhythm,
          setting: rotationSetting,
          date: log.date,
          workouts: previewData.strength.workouts,
          savedWorkouts: previewData.strength.savedWorkouts,
          completions: previewData.datedRhythmCompletions,
          excludeWorkoutLogId: log.id
        });
        const pinnedUnavailableAssignment = isPinnedStrengthRotationRepair(
          assignment,
          log,
          previewData.strength.guidedSessionDraft
        );
        if (assignment.kind === 'unavailable') {
          return `${assignment.reason} No changes were saved.`;
        }
        if (assignment.kind === 'repair' && !pinnedUnavailableAssignment) {
          return `${assignment.reason} No changes were saved.`;
        }
        if (assignment.workoutId !== log.savedWorkoutId) {
          return `This occurrence is assigned to ${assignment.workoutName}. No changes were saved.`;
        }
      }
      const schedule = rhythmScheduleForDate(rhythm, log.date);
      if (!schedule || !hasRhythmOccurrenceForCompletion(
        schedule,
        log.date,
        rhythm.scoring?.trackingStartDate
      )) {
        return 'The workout date is not a scheduled occurrence for this Rhythm. No changes were saved.';
      }
      if (datedRhythmCompletions.some(item => item.rhythmId === log.rhythmId
        && item.effectiveDate === log.date && item.id !== log.completionId)) {
        return 'This Strength Rhythm occurrence already has a completion. No changes were saved.';
      }
      const completion = prepareDatedRhythmCompletion({
        id: log.completionId,
        rhythmId: log.rhythmId,
        effectiveDate: log.date,
        hour,
        minute,
        period: period === 'PM' ? 'PM' : 'AM',
        memory: '',
        timeZone
      }, now);
      if (!completion.valid) {
        return completion.errors.time ?? completion.errors.effectiveDate
          ?? 'The linked completion time is invalid. No workout changes were saved.';
      }
      if (existingCompletion) {
        datedRhythmCompletions = datedRhythmCompletions.map(item =>
          item.id === log.completionId ? completion.record : item
        );
      } else {
        datedRhythmCompletions.push(completion.record);
      }
      if (!activeRhythmCompletions.some(item => item.completionId === log.completionId)) {
        activeRhythmCompletions = [
          ...activeRhythmCompletions.filter(item => item.rhythmId !== log.rhythmId),
          { rhythmId: log.rhythmId, completionId: log.completionId }
        ];
        if (!completedRhythmIds.includes(log.rhythmId)) completedRhythmIds.push(log.rhythmId);
      }
      if (!rhythmHistoryIds.includes(log.rhythmId)) rhythmHistoryIds.push(log.rhythmId);
    }

    return persistSeasonHistory({
      ...previewData,
      strength,
      datedRhythmCompletions,
      activeRhythmCompletions,
      completedRhythmIds,
      rhythmHistoryIds
    }, 'Strength data');
  }

  function saveWeightData(weight: PreviewData['weight']): string | null {
    const result = saveWeightDataCommand({
      previous: previewData.weight,
      next: weight,
      today: currentDate,
      now: new Date(),
      rhythms: allTodayRhythms,
      archivedRhythmIds: new Set(previewData.archivedRhythmIds),
      editableRhythmIds: new Set(allTodayRhythms
        .filter(rhythm => isEditableRhythmId(rhythm.id))
        .map(rhythm => rhythm.id)),
      completionState: {
        datedRhythmCompletions: previewData.datedRhythmCompletions,
        activeRhythmCompletions: previewData.activeRhythmCompletions,
        completedRhythmIds: previewData.completedRhythmIds,
        rhythmHistoryIds: previewData.rhythmHistoryIds
      }
    });
    if (!result.valid) return result.error;
    return persistSeasonHistory({
      ...previewData,
      weight: result.weight,
      ...result.completionState
    }, 'Weight data');
  }

  function saveCardioData(cardio: PreviewData['cardio']): string | null {
    const result = saveCardioDataCommand({
      previous: previewData.cardio,
      next: cardio,
      today: currentDate,
      now: new Date(),
      rhythms: allTodayRhythms,
      archivedRhythmIds: new Set(previewData.archivedRhythmIds),
      editableRhythmIds: new Set(allTodayRhythms
        .filter(rhythm => isEditableRhythmId(rhythm.id))
        .map(rhythm => rhythm.id)),
      completionState: {
        datedRhythmCompletions: previewData.datedRhythmCompletions,
        activeRhythmCompletions: previewData.activeRhythmCompletions,
        completedRhythmIds: previewData.completedRhythmIds,
        rhythmHistoryIds: previewData.rhythmHistoryIds
      }
    });
    if (!result.valid) return result.error;
    return persistSeasonHistory({
      ...previewData,
      cardio: result.cardio,
      ...result.completionState
    }, 'Cardio data');
  }

  function saveFlexibilityData(flexibility: PreviewData['flexibility']): string | null {
    const saved = saveFlexibilityDataCommand({
      previous: previewData.flexibility,
      next: flexibility,
      today: currentDate,
      now: new Date(),
      rhythms: allTodayRhythms,
      archivedRhythmIds: new Set(previewData.archivedRhythmIds),
      editableRhythmIds: new Set(allTodayRhythms
        .filter(rhythm => isEditableRhythmId(rhythm.id))
        .map(rhythm => rhythm.id)),
      completionState: {
        datedRhythmCompletions: previewData.datedRhythmCompletions,
        activeRhythmCompletions: previewData.activeRhythmCompletions,
        completedRhythmIds: previewData.completedRhythmIds,
        rhythmHistoryIds: previewData.rhythmHistoryIds
      }
    });
    if (!saved.valid) return saved.error;
    let {
      datedRhythmCompletions,
      activeRhythmCompletions,
      completedRhythmIds,
      rhythmHistoryIds
    } = saved.completionState;
    const previousGuidedIds = new Set((previewData.flexibility.guidedSessions ?? []).map(session => session.id));
    for (const session of flexibility.guidedSessions ?? []) {
      if (previousGuidedIds.has(session.id) || !session.linkedRhythmId) continue;
      const rhythm = allTodayRhythms.find(item => item.id === session.linkedRhythmId);
      if (!rhythm || rhythm.healthLogCapability !== 'flexibility'
        || !isEditableRhythmId(rhythm.id) || previewData.archivedRhythmIds.includes(rhythm.id)
        || session.rhythmOccurrence !== session.date || !session.completionId) {
        return 'The linked stretch Rhythm or its completion record is unavailable. No stretch changes were saved.';
      }
      const schedule = effectiveRhythmSchedule(rhythm.schedule, rhythm.cadence);
      if (!schedule || !hasRhythmOccurrenceForCompletion(
        schedule,
        session.rhythmOccurrence,
        rhythm.scoring?.trackingStartDate
      )) {
        return 'The stretch session date is not a scheduled occurrence for this Rhythm. No changes were saved.';
      }
      if (datedRhythmCompletions.some(item =>
        item.id === session.completionId
        || item.rhythmId === rhythm.id && item.effectiveDate === session.rhythmOccurrence)) {
        return 'This stretch Rhythm occurrence already has a completion. No changes were saved.';
      }
      const timeParts = new Intl.DateTimeFormat('en-US', {
        timeZone: session.timeZone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).formatToParts(new Date(session.startedAt));
      const hour = Number(timeParts.find(part => part.type === 'hour')?.value);
      const minute = Number(timeParts.find(part => part.type === 'minute')?.value);
      const period = timeParts.find(part => part.type === 'dayPeriod')?.value.toUpperCase();
      const completion = prepareDatedRhythmCompletion({
        id: session.completionId,
        rhythmId: rhythm.id,
        effectiveDate: session.rhythmOccurrence,
        hour,
        minute,
        period: period === 'PM' ? 'PM' : 'AM',
        memory: '',
        timeZone: session.timeZone
      }, new Date());
      if (!completion.valid) {
        return completion.errors.time ?? completion.errors.effectiveDate
          ?? 'The linked stretch completion time is invalid. No changes were saved.';
      }
      datedRhythmCompletions.push(completion.record);
      if (!activeRhythmCompletions.some(item => item.completionId === session.completionId)) {
        activeRhythmCompletions = [
          ...activeRhythmCompletions.filter(item => item.rhythmId !== rhythm.id),
          { rhythmId: rhythm.id, completionId: session.completionId }
        ];
        if (!completedRhythmIds.includes(rhythm.id)) completedRhythmIds.push(rhythm.id);
      }
      if (!rhythmHistoryIds.includes(rhythm.id)) rhythmHistoryIds.push(rhythm.id);
    }
    return persistSeasonHistory({
      ...previewData,
      flexibility: saved.flexibility,
      datedRhythmCompletions,
      activeRhythmCompletions,
      completedRhythmIds,
      rhythmHistoryIds
    }, 'Flexibility data');
  }

  function saveFoundationAssociations(
    foundationId: string,
    changes: readonly FoundationRhythmAssociationChange[]
  ): string | null {
    const result = saveFoundationRhythmAssociations(
      previewData.savedRhythms,
    userRhythms,
      previewData.archivedRhythmIds,
      foundationId,
      changes
    );
    if ('error' in result) return result.error;
    return persistSeasonHistory(
      { ...previewData, savedRhythms: result.savedRhythms },
      'Foundation associations'
    );
  }

  function saveSeasonCorrection(rhythmId: string, draft: RhythmSeasonEditDraft): string | null {
    if (!activeRhythmIsToday || activeRhythmIsArchived) {
      return 'This Rhythm is read-only.';
    }
    const savedRhythm = previewData.savedRhythms.find(rhythm => rhythm.id === rhythmId);
    const rhythm = allTodayRhythms.find(entry => entry.id === rhythmId);
    if (draft.segmentId === `new-season:${rhythmId}`) {
      const currentSchedule = rhythm && effectiveRhythmSchedule(rhythm.schedule, rhythm.cadence);
      if (!rhythm || !currentSchedule) return 'This Rhythm no longer has a known current schedule.';
      const timeZone = rhythm.scoring?.timeZone ?? rhythm.createdTimeZone
        ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
      const asOfDate = localDateInTimeZone(new Date(), timeZone);
      const result = resolveRhythmSeasonRange({
        rhythmId,
        currentSchedule,
        ...(rhythm.scoring ? { scoring: rhythm.scoring } : {}),
        timeZone,
        asOfDate,
        draft: {
          startDate: draft.startDate,
          ...(draft.endDate === undefined ? {} : { endDate: draft.endDate }),
          schedule: draft.schedule,
          timeOfDay: draft.timeOfDay,
          name: draft.name
        },
        coverage: {
          ...(rhythm.createdLocalDate ? { effectiveStartDate: rhythm.createdLocalDate } : {}),
          ...(rhythm.completionHistory?.length
            ? {
                earliestCompletionDate: rhythm.completionHistory
                  .map(record => record.effectiveDate)
                  .sort()[0]
              }
            : {}),
          ...(rhythm.timeOfDay ? { currentTimeOfDay: rhythm.timeOfDay } : {})
        }
      });
      if (!result.valid) return result.error;

      const sourceRhythms = previewData.savedRhythms.map(entry => {
        if (entry.id !== rhythmId) return entry;
        const { scoring: _scoring, ...withoutScoring } = entry;
        return withoutScoring;
      });
      const { originalScoring: _originalScoring, ...baseDraft } =
        rhythmDraftFrom(rhythm, rhythm.categoryIds ?? [], undefined, configuredRhythmTimeOptions);
      const activeTime = result.activeTimeOfDay ?? rhythm.timeOfDay ?? draft.timeOfDay;
      const saved = saveRhythmDraft(
        sourceRhythms,
        {
          ...baseDraft,
          schedule: result.schedule,
          scheduleEditing: true,
          originalSchedule: currentSchedule,
          timeLabel: rhythmTimeLabel(activeTime, configuredRhythmTimeOptions),
          seasonName: draft.name
        },
        rhythmId,
        'edit',
        undefined,
        undefined,
        { timeOptions: configuredRhythmTimeOptions, categoryPreferences: previewData.categoryPreferences },
        previewData.people.map(person => person.id)
      );
      if (!saved.savedRhythms) return Object.values(saved.errors)[0] ?? 'This Rhythm could not be saved.';
      const savedRhythms = saved.savedRhythms.map(entry => entry.id !== rhythmId
        ? entry
        : {
            ...entry,
            cadence: rhythmScheduleSummary(result.schedule),
            schedule: result.schedule,
            scoring: result.scoring,
            timeOfDay: activeTime,
            timeLabel: rhythmTimeLabel(activeTime, configuredRhythmTimeOptions)
          });
      const changedRhythm = savedRhythms.find(entry => entry.id === rhythmId);
      if (!changedRhythm) return 'The updated Rhythm could not be found.';
      const nextData: PreviewData = {
        ...previewData,
        savedRhythms,
        ...(rhythm.completionHistory?.length && !previewData.rhythmHistoryIds.includes(rhythmId)
          ? { rhythmHistoryIds: [...previewData.rhythmHistoryIds, rhythmId] }
          : {})
      };
      const saveError = persistSeasonHistory(nextData, 'Season range');
      if (saveError) return saveError;
      setSeasonRangeUndo({
        rhythmId,
        expected: changedRhythm,
        ...(savedRhythm ? { restore: savedRhythm } : {})
      });
      return null;
    }
    if (draft.segmentId === `current-schedule:${rhythmId}`) {
      const currentSchedule = rhythm && effectiveRhythmSchedule(rhythm.schedule, rhythm.cadence);
      if (!rhythm || !currentSchedule) return 'This Rhythm no longer has a known current schedule.';
      const established = establishCurrentRhythmSeason(
        rhythmId,
        currentSchedule,
        rhythm.scoring,
        rhythm.scoring?.timeZone ?? rhythm.createdTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        localDateInTimeZone(new Date(), rhythm.scoring?.timeZone ?? rhythm.createdTimeZone
          ?? Intl.DateTimeFormat().resolvedOptions().timeZone),
        draft,
        {
          ...(rhythm.createdLocalDate ? { effectiveStartDate: rhythm.createdLocalDate } : {}),
          ...(rhythm.completionHistory?.length
            ? {
                earliestCompletionDate: rhythm.completionHistory
                  .map(record => record.effectiveDate)
                  .sort()[0]
              }
            : {}),
          ...(rhythm.timeOfDay ? { previousTimeOfDay: rhythm.timeOfDay } : {})
        }
      );
      if (!established.valid) return established.error;

      const sourceRhythms = previewData.savedRhythms.map(entry => {
        if (entry.id !== rhythmId) return entry;
        const { scoring: _scoring, ...withoutScoring } = entry;
        return withoutScoring;
      });
      const {
        originalScoring: _originalScoring,
        ...baseDraft
      } = rhythmDraftFrom(rhythm, rhythm.categoryIds ?? [], undefined, configuredRhythmTimeOptions);
      const saved = saveRhythmDraft(
        sourceRhythms,
        {
          ...baseDraft,
          schedule: draft.schedule,
          scheduleEditing: true,
          originalSchedule: currentSchedule,
          timeLabel: rhythmTimeLabel(draft.timeOfDay, configuredRhythmTimeOptions),
          seasonName: draft.name
        },
        rhythmId,
        'edit',
        undefined,
        undefined,
        { timeOptions: configuredRhythmTimeOptions, categoryPreferences: previewData.categoryPreferences },
        previewData.people.map(person => person.id)
      );
      if (!saved.savedRhythms) return Object.values(saved.errors)[0] ?? 'This Rhythm could not be saved.';
      const savedRhythms = saved.savedRhythms.map(entry => entry.id !== rhythmId
        ? entry
        : {
            ...entry,
            cadence: rhythmScheduleSummary(established.schedule),
            schedule: established.schedule,
            scoring: established.scoring,
            timeOfDay: established.activeTimeOfDay ?? draft.timeOfDay,
            timeLabel: rhythmTimeLabel(established.activeTimeOfDay ?? draft.timeOfDay, configuredRhythmTimeOptions),
            ...(rhythm.createdLocalDate === undefined ? {} : { createdLocalDate: rhythm.createdLocalDate }),
            ...(rhythm.createdTimeZone === undefined ? {} : { createdTimeZone: rhythm.createdTimeZone }),
            ...(rhythm.dailyBackfillAllowed === undefined ? {} : { dailyBackfillAllowed: rhythm.dailyBackfillAllowed })
          });
      return persistSeasonHistory({ ...previewData, savedRhythms }, 'current Season boundary');
    }
    const currentSchedule = rhythm && effectiveRhythmSchedule(rhythm.schedule, rhythm.cadence);
    if (!savedRhythm?.schedule || !currentSchedule || !rhythm?.scoring) {
      return 'This Rhythm no longer has editable schedule history.';
    }
    const timeZone = rhythm.scoring.timeZone;
    const result = resolveRhythmSeasonRange({
      rhythmId,
      currentSchedule,
      scoring: rhythm.scoring,
      timeZone,
      asOfDate: localDateInTimeZone(new Date(), timeZone),
      draft,
      ...(rhythm.completionHistory?.length
        ? {
            coverage: {
              earliestCompletionDate: rhythm.completionHistory
                .map(record => record.effectiveDate)
                .sort()[0]!
            }
          }
        : {})
    });
    if (!result.valid) return result.error;

    const savedRhythms = previewData.savedRhythms.map(rhythm => rhythm.id !== rhythmId
      ? rhythm
      : {
          ...rhythm,
          ...(rhythm.schedule && rhythmSchedulesEqual(rhythm.schedule, result.schedule)
            ? {}
            : { cadence: rhythmScheduleSummary(result.schedule) }),
          schedule: result.schedule,
          scoring: result.scoring,
          ...(result.activeTimeOfDay === undefined ? {} : {
            timeOfDay: result.activeTimeOfDay,
            timeLabel: rhythmTimeLabel(result.activeTimeOfDay, configuredRhythmTimeOptions)
          })
        });
    const nextData: PreviewData = { ...previewData, savedRhythms };
    const changedRhythm = savedRhythms.find(entry => entry.id === rhythmId);
    if (!changedRhythm) return 'The updated Rhythm could not be found.';
    const saveError = persistSeasonHistory(nextData, 'schedule correction');
    if (saveError) return saveError;
    setSeasonRangeUndo({ rhythmId, expected: changedRhythm, restore: savedRhythm });
    return null;
  }

  function undoSeasonRange(): string | null {
    const undo = seasonRangeUndo;
    if (!undo || activeRhythmId !== undo.rhythmId || !activeRhythmIsToday || activeRhythmIsArchived) {
      return 'This Rhythm is no longer available for Undo.';
    }
    const current = previewData.savedRhythms.find(entry => entry.id === undo.rhythmId);
    if (!current || JSON.stringify(current) !== JSON.stringify(undo.expected)) {
      return 'This Rhythm changed after the Season update. It cannot be safely restored without overwriting those changes.';
    }
    const savedRhythms = previewData.savedRhythms
      .filter(entry => entry.id !== undo.rhythmId);
    if (undo.restore) savedRhythms.push(undo.restore);
    const saveError = persistSeasonHistory({ ...previewData, savedRhythms }, 'Season Undo');
    if (saveError) return saveError;
    setSeasonRangeUndo(null);
    return null;
  }

  function deleteSeason(rhythmId: string, seasonId: string): string | null {
    if (!activeRhythmIsToday || activeRhythmIsArchived || !isEditableRhythmId(rhythmId)) {
      return 'This Rhythm is read-only.';
    }
    const rhythm = previewData.savedRhythms.find(entry => entry.id === rhythmId);
    const resolvedRhythm = allTodayRhythms.find(entry => entry.id === rhythmId);
    const schedule = resolvedRhythm && effectiveRhythmSchedule(resolvedRhythm.schedule, resolvedRhythm.cadence);
    if (!rhythm?.schedule || !resolvedRhythm?.scoring || !schedule) {
      return 'This Rhythm no longer has editable schedule history.';
    }
    const records: RhythmCompletionRecord[] = (resolvedRhythm.completionHistory ?? [])
      .map(record => ({ ...record, rhythmId }));
    const result = deleteRhythmSeason(
      rhythmId,
      schedule,
      resolvedRhythm.scoring,
      seasonId,
      records,
      localDateInTimeZone(
        new Date(),
        resolvedRhythm.scoring.timeZone
      )
    );
    if (!result.valid) return result.error;

    const nextCadence = rhythmSchedulesEqual(rhythm.schedule, result.schedule)
      ? rhythm.cadence
      : rhythmScheduleSummary(result.schedule);
    const nextTimeOfDay = result.activeTimeOfDay ?? rhythm.timeOfDay;
    const nextTimeLabel = result.activeTimeOfDay === undefined
      ? rhythm.timeLabel
      : rhythmTimeLabel(result.activeTimeOfDay, configuredRhythmTimeOptions);
    const savedRhythms = previewData.savedRhythms.map(entry => entry.id !== rhythmId
      ? entry
      : {
          ...entry,
          cadence: nextCadence,
          schedule: result.schedule,
          scoring: result.scoring,
          timeLabel: nextTimeLabel,
          ...(nextTimeOfDay === undefined ? {} : { timeOfDay: nextTimeOfDay })
        });
    const nextData: PreviewData = { ...previewData, savedRhythms };
    const saveError = persistSeasonHistory(nextData, 'Season deletion');
    if (saveError) return saveError;
    setSeasonDeletionUndo({
      rhythmId,
      season: result.deletedSeason,
      index: result.index,
      expectedScoring: result.scoring,
      expectedSchedule: result.schedule,
      expectedCadence: nextCadence,
      expectedTimeLabel: nextTimeLabel,
      ...(nextTimeOfDay === undefined ? {} : { expectedTimeOfDay: nextTimeOfDay }),
      restoreSchedule: rhythm.schedule,
      restoreCadence: rhythm.cadence,
      restoreTimeLabel: rhythm.timeLabel,
      ...(rhythm.timeOfDay === undefined ? {} : { restoreTimeOfDay: rhythm.timeOfDay }),
      restoreTrackingStartDate: resolvedRhythm.scoring.trackingStartDate
    });
    return null;
  }

  function undoSeasonDeletion(): string | null {
    const undo = seasonDeletionUndo;
    if (!undo || activeRhythmId !== undo.rhythmId || !activeRhythmIsToday || activeRhythmIsArchived) {
      return 'This Rhythm is no longer available for Undo.';
    }
    const rhythm = previewData.savedRhythms.find(entry => entry.id === undo.rhythmId);
    if (!rhythm?.schedule || !rhythm.scoring) {
      return 'This Rhythm no longer has editable schedule history.';
    }
    const resolvedRhythm = allTodayRhythms.find(entry => entry.id === undo.rhythmId);
    const records: RhythmCompletionRecord[] = (resolvedRhythm?.completionHistory ?? [])
      .map(record => ({ ...record, rhythmId: undo.rhythmId }));
    const result = restoreDeletedRhythmSeason(
      rhythm.id,
      rhythm.schedule,
      rhythm.scoring,
      rhythm.cadence,
      rhythm.timeLabel,
      rhythm.timeOfDay,
      undo,
      records
    );
    if (!result.valid) return result.error;
    const savedRhythms = previewData.savedRhythms.map(entry => entry.id !== rhythm.id
      ? entry
      : {
          ...entry,
          cadence: result.cadence,
          timeLabel: result.timeLabel,
          ...(result.timeOfDay === undefined ? {} : { timeOfDay: result.timeOfDay }),
          schedule: result.schedule,
          scoring: result.scoring
        });
    const saveError = persistSeasonHistory({ ...previewData, savedRhythms }, 'Season Undo');
    if (saveError) return saveError;
    setSeasonDeletionUndo(null);
    return null;
  }

  function archiveRhythm(id: string) {
    setPreviewData(previous => {
      const archivedRhythmIds = archiveRhythmId(previous.savedRhythms, previous.archivedRhythmIds, id);
      return archivedRhythmIds
        ? { ...previous, archivedRhythmIds }
        : previous;
    });
    finishRhythmEditor(false);
  }

  function restoreRhythm(id: string) {
    setPreviewData(previous => {
      const archivedRhythmIds = restoreRhythmId(previous.savedRhythms, previous.archivedRhythmIds, id);
      return archivedRhythmIds
        ? { ...previous, archivedRhythmIds }
        : previous;
    });
  }

  function saveDatedCompletion(
    candidate: RhythmCompletionRecord,
    sourceOrParticipantIds: 'tend' | 'history' | readonly import('./domain/preview-data.ts').PersonId[] = 'tend',
    explicitParticipantIds?: readonly import('./domain/preview-data.ts').PersonId[]
  ): string | null {
    const source = typeof sourceOrParticipantIds === 'string' ? sourceOrParticipantIds : 'tend';
    const connectionParticipantIds = typeof sourceOrParticipantIds === 'string'
      ? explicitParticipantIds
      : sourceOrParticipantIds;
    if (!isDatedCompletionRecord(candidate)) {
      return 'A new completion must include its selected local time. No completion was saved.';
    }
    const record = candidate;
    if (previewData.datedRhythmCompletions.some(item => item.id === record.id)
      || previewData.rhythmCompletionOverrides.some(item => item.id === record.id)
      || todayRhythms.some(rhythm => rhythm.completionHistory?.some(item => item.id === record.id))) {
      return 'This completion is already saved. No duplicate completion or Connection was created.';
    }
    if (source === 'history' && allTodayRhythms.some(rhythm =>
      rhythm.id === record.rhythmId && rhythm.categoryIds?.includes('health')
    )) {
      return 'Log a workout from the Strength Rhythm so its history stays linked.';
    }
    const isTendAction = source === 'tend';
    if (!isEditableRhythmId(record.rhythmId)
      || !resolveTodayRhythms(previewData.savedRhythms).some(rhythm => rhythm.id === record.rhythmId)
      || previewData.archivedRhythmIds.includes(record.rhythmId)
      || (isTendAction && completedRhythms.has(record.rhythmId))) {
      return 'This Rhythm cannot be completed right now. No completion was saved.';
    }
    if (isTendAction && completedRhythms.has(record.rhythmId)) {
      return 'This Rhythm cannot be completed twice. No completion or Connection was saved.';
    }
    if (connectionParticipantIds !== undefined
      && (connectionParticipantIds.length === 0
        || new Set(connectionParticipantIds).size !== connectionParticipantIds.length
        || connectionParticipantIds.some(personId => !previewData.people.some(person => person.id === personId)))) {
      return 'Choose at least one valid participant, or skip this Connection. No completion was saved.';
    }
    if (previewData.friendships.connections.some(connection =>
      connection.completionId === record.id
    )) {
      return 'A Connection already refers to this completion. No duplicate record was created.';
    }
    let nextData: PreviewData = {
      ...previewData,
      datedRhythmCompletions: [...previewData.datedRhythmCompletions, record],
      rhythmHistoryIds: previewData.rhythmHistoryIds.includes(record.rhythmId)
        ? previewData.rhythmHistoryIds
        : [...previewData.rhythmHistoryIds, record.rhythmId],
      ...(isTendAction
        ? {
            completedRhythmIds: previewData.completedRhythmIds.includes(record.rhythmId)
              ? previewData.completedRhythmIds
              : [...previewData.completedRhythmIds, record.rhythmId],
            activeRhythmCompletions: [
              ...previewData.activeRhythmCompletions.filter(item => item.rhythmId !== record.rhythmId),
              { rhythmId: record.rhythmId, completionId: record.id }
            ]
          }
        : {})
    };
    if (connectionParticipantIds !== undefined) {
      const rhythm = resolveTodayRhythms(previewData.savedRhythms)
        .find(item => item.id === record.rhythmId);
      if (rhythm?.alsoLogConnection === true) {
        let connectionId: string;
        try {
          connectionId = globalThis.crypto.randomUUID();
        } catch {
          return 'A secure Connection ID could not be created. No completion was saved.';
        }
        if (previewData.friendships.connections.some(connection => connection.id === connectionId)) {
          return 'The generated Connection ID is already in use. No completion was saved.';
        }
        nextData = {
          ...nextData,
          friendships: addOrUpdateConnection(nextData.friendships, {
            id: connectionId,
            type: 'rhythm',
            date: record.effectiveDate,
            ...(record.localTime ? { time: record.localTime, timeZone: record.timeZone } : {}),
            participantIds: [...connectionParticipantIds],
            ...(record.memory ? { notes: record.memory } : {}),
            rhythmId: record.rhythmId,
            completionId: record.id,
            rhythmTitleSnapshot: rhythm.title,
            ownedByRhythmCompletion: true,
            rhythmConnectionSnapshot: rhythmCompletionConnectionSnapshot({
              date: record.effectiveDate,
              ...(record.localTime ? { time: record.localTime, timeZone: record.timeZone } : {}),
              participantIds: [...connectionParticipantIds],
              ...(record.memory ? { notes: record.memory } : {}),
              rhythmTitleSnapshot: rhythm.title
            })
          })
        };
      }
    }
    const written = writeCurrentPreview(nextData, expectedRaw.current, { currentDate });
    if (written.kind === 'conflict') {
      externalRaw.current = written.actualRaw;
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'conflict' });
      return 'Preview storage changed in another tab. No completion or Connection was saved.';
    }
    if (written.kind === 'error') {
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'error', message: written.message, ...(written.diagnostic ? { diagnostic: written.diagnostic } : {}) });
      return `Preview could not save this completion. ${written.message}`;
    }
    expectedRaw.current = written.raw;
    externalRaw.current = null;
    skipNextAutosave.current = true;
    setPreviewData(nextData);
    setAutoSaveEnabled(true);
    setPersistenceStatus({ kind: 'saved' });
    return null;
  }

  function updateDatedCompletion(record: RhythmCompletionRecord): string | null {
    if (previewData.strength.workouts.some(log => log.completionId === record.id)) {
      return 'Edit this completion through its linked Strength workout log.';
    }
    const existing = previewData.datedRhythmCompletions.find(item => item.id === record.id);
    if (!isEditableRhythmId(record.rhythmId)
      || previewData.archivedRhythmIds.includes(record.rhythmId)
      || !resolveTodayRhythms(previewData.savedRhythms).some(rhythm => rhythm.id === record.rhythmId)) {
      return 'This logged moment can no longer be edited. No changes were saved.';
    }
    if (existing) {
      if (existing.rhythmId !== record.rhythmId || !isDatedCompletionRecord(record)) {
        return 'A recorded time must remain complete and valid. No changes were saved.';
      }
      const updatedRecord = { ...record, recordedAt: existing.recordedAt };
      const ownedConnections = previewData.friendships.connections.filter(connection =>
        connection.ownedByRhythmCompletion === true
        && connection.completionId === record.id
        && connection.rhythmId === record.rhythmId
      );
      const preservedConnectionIds = new Set(ownedConnections
        .filter(connection => isRhythmConnectionShared(previewData, connection.id)
          || !isRhythmCompletionConnectionUnchanged(connection))
        .map(connection => connection.id));
      setRhythmConnectionNotice(preservedConnectionIds.size > 0
        ? 'The completion was updated. A Connection that was edited, predates ownership safeguards, or is referenced by a Spark was preserved and detached.'
        : '');
      setPreviewData(previous => ({
        ...previous,
        datedRhythmCompletions: previous.datedRhythmCompletions.map(item =>
          item.id === record.id && item.rhythmId === record.rhythmId
            ? { ...updatedRecord, recordedAt: item.recordedAt }
            : item
        ),
        ...(ownedConnections.length === 0
          ? {}
          : {
              friendships: {
                ...previous.friendships,
                connections: previous.friendships.connections.flatMap(connection => {
                  if (!ownedConnections.some(owned => owned.id === connection.id)) return [connection];
                  if (preservedConnectionIds.has(connection.id)) {
                    return [detachRhythmCompletionOwnership(connection)];
                  }
                  return [reconcileRhythmCompletionConnection(connection, updatedRecord)];
                })
              }
            })
      }));
      return null;
    }
    const seedRecord = todayRhythms
      .find(rhythm => rhythm.id === record.rhythmId)
      ?.completionHistory?.find(item => item.id === record.id);
    if (!seedRecord || previewData.removedSeedCompletionIds.includes(record.id)) {
      return 'This logged moment can no longer be edited. No changes were saved.';
    }
    if (record.localTime
      ? (!record.timeZone || !record.completedAt)
      : record.timeZone !== undefined || record.completedAt !== undefined || record.recordedAt !== undefined) {
      return 'The completion time is incomplete. No changes were saved.';
    }
    setPreviewData(previous => ({
      ...previous,
      rhythmCompletionOverrides: [
        ...previous.rhythmCompletionOverrides.filter(item => item.id !== record.id),
        { ...record }
      ],
      rhythmHistoryIds: previous.rhythmHistoryIds.includes(record.rhythmId)
        ? previous.rhythmHistoryIds
        : [...previous.rhythmHistoryIds, record.rhythmId]
    }));
    return null;
  }

  function deleteDatedCompletionRecord(completionId: string): string | null {
    if (previewData.strength.workouts.some(log => log.completionId === completionId)) {
      return 'Delete this completion through its linked Strength workout log.';
    }
    if (previewData.flexibility.sessions.some(log => log.completionId === completionId)) {
      return 'Delete this completion through its linked stretch log.';
    }
    const record = previewData.datedRhythmCompletions.find(item => item.id === completionId);
    const seedRhythmId = todayRhythms.find(rhythm =>
      rhythm.completionHistory?.some(item => item.id === completionId)
    )?.id;
    const rhythmId = record?.rhythmId ?? seedRhythmId;
    if (!rhythmId || !isEditableRhythmId(rhythmId)
      || previewData.archivedRhythmIds.includes(rhythmId)
      || !resolveTodayRhythms(previewData.savedRhythms).some(rhythm => rhythm.id === rhythmId)) {
      return 'This logged moment can no longer be deleted. No changes were made.';
    }
    if (!record) {
      setPreviewData(previous => ({
        ...previous,
        rhythmCompletionOverrides: previous.rhythmCompletionOverrides.filter(item => item.id !== completionId),
        removedSeedCompletionIds: previous.removedSeedCompletionIds.includes(completionId)
          ? previous.removedSeedCompletionIds
          : [...previous.removedSeedCompletionIds, completionId],
        rhythmHistoryIds: previous.rhythmHistoryIds.includes(rhythmId)
          ? previous.rhythmHistoryIds
          : [...previous.rhythmHistoryIds, rhythmId]
      }));
      return null;
    }
    const ownedConnections = previewData.friendships.connections.filter(connection =>
      connection.ownedByRhythmCompletion === true
      && connection.completionId === completionId
      && connection.rhythmId === rhythmId
    );
    const preservedConnectionIds = new Set(ownedConnections
      .filter(connection => isRhythmConnectionShared(previewData, connection.id)
        || !isRhythmCompletionConnectionUnchanged(connection))
      .map(connection => connection.id));
    setRhythmConnectionNotice(preservedConnectionIds.size > 0
      ? 'The completion was deleted. A Connection that was edited, predates ownership safeguards, or is referenced by a Spark was preserved and detached.'
      : '');
    setPreviewData(previous => {
      const result = deleteDatedCompletion(
        previous.datedRhythmCompletions,
        previous.activeRhythmCompletions,
        previous.completedRhythmIds,
        completionId
      );
      return {
        ...previous,
        datedRhythmCompletions: result.records,
        activeRhythmCompletions: result.active,
        completedRhythmIds: result.completedRhythmIds,
        ...(ownedConnections.length === 0
          ? {}
          : {
              friendships: {
                ...previous.friendships,
                connections: previous.friendships.connections.flatMap(connection => {
                  if (!ownedConnections.some(owned => owned.id === connection.id)) return [connection];
                  return preservedConnectionIds.has(connection.id)
                    ? [detachRhythmCompletionOwnership(connection)]
                    : [];
                })
              }
            })
      };
    });
    return null;
  }

  function undoTend(id: string) {
    const activeCompletionId = previewData.activeRhythmCompletions
      .find(item => item.rhythmId === id)?.completionId;
    if (previewData.completedRhythmIds.includes(id)
      && resolveTodayRhythms(previewData.savedRhythms).some(rhythm => rhythm.id === id)
      && !isFitnessLinkedCompletion(previewData, activeCompletionId)) {
      const ownedConnections = previewData.friendships.connections.filter(connection =>
        connection.type === 'rhythm'
        && connection.rhythmId === id
        && connection.ownedByRhythmCompletion === true
        && (activeCompletionId === undefined || connection.completionId === activeCompletionId)
      );
      const preservedConnectionIds = new Set(ownedConnections
        .filter(connection => isRhythmConnectionShared(previewData, connection.id)
          || !isRhythmCompletionConnectionUnchanged(connection))
        .map(connection => connection.id));
      setRhythmConnectionNotice(preservedConnectionIds.size > 0
        ? 'Tend was undone. A Connection that was edited, predates ownership safeguards, or is referenced by a Spark was preserved and detached.'
        : '');
    }
    setPreviewData(previous => {
      const completionIndex = previous.completedRhythmIds.indexOf(id);
      if (completionIndex === -1
        || !resolveTodayRhythms(previous.savedRhythms).some(rhythm => rhythm.id === id)) return previous;
      const activeCompletionId = previous.activeRhythmCompletions
        .find(item => item.rhythmId === id)?.completionId;
      if (isFitnessLinkedCompletion(previous, activeCompletionId)) return previous;
      const reversed = removeActionCompletion(
        previous.datedRhythmCompletions,
        previous.activeRhythmCompletions,
        id
      );
      const ownedConnections = previous.friendships.connections.filter(connection =>
        connection.type === 'rhythm'
        && connection.rhythmId === id
        && connection.ownedByRhythmCompletion === true
        && (activeCompletionId === undefined || connection.completionId === activeCompletionId)
      );
      const ownedConnectionIds = new Set(ownedConnections.map(connection => connection.id));
      const preservedConnectionIds = new Set(ownedConnections
        .filter(connection => isRhythmConnectionShared(previous, connection.id)
          || !isRhythmCompletionConnectionUnchanged(connection))
        .map(connection => connection.id));
      return {
        ...previous,
        datedRhythmCompletions: reversed.records,
        activeRhythmCompletions: reversed.active,
        completedRhythmIds: [
          ...previous.completedRhythmIds.slice(0, completionIndex),
          ...previous.completedRhythmIds.slice(completionIndex + 1)
        ],
        friendships: ownedConnectionIds.size === 0
          ? previous.friendships
          : {
              ...previous.friendships,
              connections: previous.friendships.connections.flatMap(connection => {
                if (!ownedConnectionIds.has(connection.id)) return [connection];
                return preservedConnectionIds.has(connection.id)
                  ? [detachRhythmCompletionOwnership(connection)]
                  : [];
              })
            }
      };
    });
  }

  function setShowCalendarOnTodayPreference(showCalendarOnToday: boolean) {
    if (!showCalendarOnToday) setFocusCalendarEvents([]);
    setPreviewData(previous => previous.showCalendarOnToday === showCalendarOnToday
      ? previous
      : { ...previous, showCalendarOnToday });
  }

  function setPrayerEnabledPreference(prayerEnabled: boolean) {
    setPreviewData(previous => previous.prayerEnabled === prayerEnabled
      ? previous
      : { ...previous, prayerEnabled });
  }

  function openCalendarSettings() {
    navigate('more');
    setSettingsReturnTo(null);
    setSettingsDetail('calendar');
    setMoreSettingsOpen(true);
  }

  function setCategoryPreference(categoryId: keyof PreviewData['categoryPreferences'], enabled: boolean) {
    setPreviewData(previous => {
      const categoryPreferences = setCategoryPreferenceCommand(
        previous.categoryPreferences,
        categoryId,
        enabled
      );
      if (Object.keys(categoryPreferences).every(key =>
        categoryPreferences[key as keyof typeof categoryPreferences]
          === previous.categoryPreferences[key as keyof typeof previous.categoryPreferences]
      )) return previous;
      return { ...previous, categoryPreferences };
    });
  }

  function setFoundationPreference(foundationId: string, enabled: boolean) {
    setPreviewData(previous => previous.foundationPreferences[foundationId] === enabled
      ? previous
      : {
        ...previous,
        foundationPreferences: {
          ...previous.foundationPreferences,
          [foundationId]: enabled
        }
      });
  }

  function setTodayViewPreference(todayView: TodayViewId) {
    setPreviewData(previous => previous.todayView === todayView
      ? previous
      : { ...previous, todayView });
  }

  function setTextSizePreference(textSize: PreviewTextSize) {
    setPreviewData(previous => previous.textSize === textSize
      ? previous
      : { ...previous, textSize });
  }

  function saveGoal(goal: MoneyGoal) {
    setPreviewData(previous => ({
      ...previous,
      goals: previous.goals.some(item => item.id === goal.id)
        ? previous.goals.map(item => item.id === goal.id ? goal : item)
        : [...previous.goals, goal]
    }));
  }

  function saveGoalCheckIn(
    goalId: string,
    draft: CheckInDraft,
    correctingCheckIn?: GoalCheckIn
  ): CheckInDraftErrors {
    const goal = previewData.goals.find(item => item.id === goalId);
    if (!goal) return { balance: 'This example goal is no longer available.' };
    const result = saveCheckIn(goal, draft, new Date().toISOString(), currentDate, correctingCheckIn);
    const updatedGoal = result.goal;
    if (!updatedGoal) {
      return result.errors;
    }

    const nextData: PreviewData = {
      ...previewData,
      goals: previewData.goals.map(item => item.id === goalId ? updatedGoal : item)
    };
    skipNextAutosave.current = true;
    setPreviewData(nextData);
    const written = writeCurrentPreview(nextData, expectedRaw.current, { currentDate });
    refreshV29RecoveryCopy();
    refreshV30RecoveryCopy();
    refreshV1RecoveryCopy();
    refreshV2RecoveryCopy();
    refreshV3RecoveryCopy();
    refreshV4RecoveryCopy();
    refreshV5RecoveryCopy();
    refreshV6RecoveryCopy();
    refreshV7RecoveryCopy();
    refreshV8RecoveryCopy();
    refreshV9RecoveryCopy();
    if (written.kind === 'saved') {
      expectedRaw.current = written.raw;
      externalRaw.current = null;
      setAutoSaveEnabled(true);
      setPersistenceStatus({ kind: 'saved' });
    } else if (written.kind === 'conflict') {
      externalRaw.current = written.actualRaw;
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'conflict' });
    } else {
      setAutoSaveEnabled(false);
      setPersistenceStatus({
        kind: 'error',
        message: written.message,
        ...(written.diagnostic ? { diagnostic: written.diagnostic } : {})
      });
    }
    return result.errors;
  }

  function finishWrite(
    resultData: PreviewData,
    allowUnrecoverableReplacement = false,
    operation: 'save' | 'import' | 'reset' | 'replace' | 'cloud-restore' = 'save',
    importSourceRaw?: string
  ): string | null {
    const written = writeCurrentPreview(resultData, expectedRaw.current, {
      allowUnrecoverableReplacement,
      currentDate,
      operation,
      ...(importSourceRaw === undefined ? {} : { importSourceRaw })
    });
    refreshV29RecoveryCopy();
    refreshV30RecoveryCopy();
    refreshV1RecoveryCopy();
    refreshV2RecoveryCopy();
    refreshV3RecoveryCopy();
    refreshV4RecoveryCopy();
    refreshV5RecoveryCopy();
    refreshV6RecoveryCopy();
    refreshV7RecoveryCopy();
    refreshV8RecoveryCopy();
    refreshV9RecoveryCopy();
    if (operation === 'import') refreshImportRecoveryCopy();
    if (written.kind === 'saved') {
      expectedRaw.current = written.raw;
      externalRaw.current = null;
      skipNextAutosave.current = true;
      setPreviewData(resultData);
      setAutoSaveEnabled(true);
      setPersistenceStatus({ kind: 'saved' });
      return null;
    }
    if (written.kind === 'conflict') {
      externalRaw.current = written.actualRaw;
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'conflict' });
      return 'Preview storage changed in another tab. No data was replaced.';
    }
    setAutoSaveEnabled(false);
    setPersistenceStatus({
      kind: 'error',
      message: written.message,
      ...(written.diagnostic ? { diagnostic: written.diagnostic } : {})
    });
    return written.message;
  }

  function finishTargetedRepair(resultData: PreviewData, expectedLocalRaw: string): string | null {
    if (expectedRaw.current !== expectedLocalRaw) {
      return 'This browser’s preview changed after confirmation. No local data was replaced.';
    }
    const written = writeCurrentPreview(resultData, expectedLocalRaw, {
      allowTargetedRepair: true,
      currentDate,
      operation: 'repair'
    });
    refreshV29RecoveryCopy();
    refreshV30RecoveryCopy();
    refreshV1RecoveryCopy();
    refreshV2RecoveryCopy();
    refreshV3RecoveryCopy();
    refreshV4RecoveryCopy();
    refreshV5RecoveryCopy();
    refreshV6RecoveryCopy();
    refreshV7RecoveryCopy();
    refreshV8RecoveryCopy();
    refreshV9RecoveryCopy();
    if (written.kind === 'saved') {
      expectedRaw.current = written.raw;
      externalRaw.current = null;
      skipNextAutosave.current = true;
      setPreviewData(resultData);
      setAutoSaveEnabled(true);
      setPersistenceStatus({ kind: 'saved' });
      return null;
    }
    if (written.kind === 'conflict') {
      externalRaw.current = written.actualRaw;
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'conflict' });
      return 'Preview storage changed in another tab. No data was replaced.';
    }
    setAutoSaveEnabled(false);
    setPersistenceStatus({
      kind: 'error',
      message: written.message,
      ...(written.diagnostic ? { diagnostic: written.diagnostic } : {})
    });
    return written.message;
  }

  function reloadExternal(): string | null {
    const raw = externalRaw.current;
    if (raw === null) {
      return 'The saved preview was removed in another tab. Your current preview remains open; no empty data was written. Download a backup or explicitly replace the removed value to save this tab.';
    }
    const parsed = parsePreviewBackup(raw, currentDate);
    if (!parsed.valid) {
      expectedRaw.current = raw;
      externalRaw.current = null;
      setAutoSaveEnabled(false);
      setPersistenceStatus({
        kind: parsed.kind === 'unsupported' ? 'unsupported' : 'corrupt',
        raw,
        message: parsed.message
      });
      return parsed.message;
    }
    expectedRaw.current = raw;
    externalRaw.current = null;
    skipNextAutosave.current = true;
    setPreviewData(parsed.envelope.data);
    setAutoSaveEnabled(true);
    setPersistenceStatus({ kind: 'saved' });
    return null;
  }

  function replaceExternal(): string | null {
    const written = writeCurrentPreview(previewData, externalRaw.current, {
      allowUnrecoverableReplacement: true,
      currentDate,
      operation: 'replace'
    });
    refreshV29RecoveryCopy();
    refreshV30RecoveryCopy();
    refreshV1RecoveryCopy();
    refreshV2RecoveryCopy();
    refreshV3RecoveryCopy();
    refreshV4RecoveryCopy();
    refreshV5RecoveryCopy();
    refreshV6RecoveryCopy();
    refreshV7RecoveryCopy();
    refreshV8RecoveryCopy();
    refreshV9RecoveryCopy();
    if (written.kind === 'saved') {
      expectedRaw.current = written.raw;
      externalRaw.current = null;
      skipNextAutosave.current = true;
      setAutoSaveEnabled(true);
      setPersistenceStatus({ kind: 'saved' });
      return null;
    }
    if (written.kind === 'conflict') {
      externalRaw.current = written.actualRaw;
      setPersistenceStatus({ kind: 'conflict' });
      return 'Preview storage changed again in another tab. No data was replaced.';
    }
    setPersistenceStatus({
      kind: 'error',
      message: written.message,
      ...(written.diagnostic ? { diagnostic: written.diagnostic } : {})
    });
    return written.message;
  }

  function retrySave() {
    skipNextAutosave.current = true;
    setAutoSaveEnabled(true);
    const written = writeCurrentPreview(previewData, expectedRaw.current, { currentDate, operation: 'save' });
    refreshV29RecoveryCopy();
    refreshV30RecoveryCopy();
    refreshV1RecoveryCopy();
    refreshV2RecoveryCopy();
    refreshV3RecoveryCopy();
    refreshV4RecoveryCopy();
    refreshV5RecoveryCopy();
    refreshV6RecoveryCopy();
    refreshV7RecoveryCopy();
    refreshV8RecoveryCopy();
    refreshV9RecoveryCopy();
    if (written.kind === 'saved') {
      expectedRaw.current = written.raw;
      setPersistenceStatus({ kind: 'saved' });
    } else if (written.kind === 'conflict') {
      externalRaw.current = written.actualRaw;
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'conflict' });
    } else {
      setAutoSaveEnabled(false);
      setPersistenceStatus({
        kind: 'error',
        message: written.message,
        ...(written.diagnostic ? { diagnostic: written.diagnostic } : {})
      });
    }
  }

  function signOut() {
    if (!onSignOut) return;
    if ((persistenceStatus.kind === 'error' || persistenceStatus.kind === 'conflict')
      && !window.confirm('Preview changes are not saved. Sign out anyway? The current tab draft will not be transferred.')) return;
    void onSignOut();
  }

  const isPreviewSettings = destination === 'more' && moreSettingsOpen;
  const storageNeedsAttention = ['unavailable', 'error', 'corrupt', 'unsupported', 'conflict']
    .includes(persistenceStatus.kind);
  const settingsGroups: { title: string; items: {
    detail: SettingsDetail;
    label: string;
    summary: string;
    icon: SettingsIconName;
  }[] }[] = [
    { title: 'Personalize', items: [
      { detail: 'categories', label: 'Categories', summary: 'Choose what appears across Tend.', icon: 'categories' },
      { detail: 'prayer', label: 'Prayer', summary: 'Show prayer features and include Prayer in Person Health.', icon: 'prayer' },
      { detail: 'appearance', label: 'Appearance', summary: 'Set your preferred text size.', icon: 'appearance' },
      { detail: 'time-blocks', label: 'Time blocks', summary: 'Set the times that shape your day.', icon: 'time-blocks' }
    ] },
    { title: 'Connections', items: [
      { detail: 'calendar', label: 'Calendar', summary: 'Manage sources and Today visibility.', icon: 'calendar' },
      { detail: 'weather', label: 'Weather', summary: 'Choose a location and forecast units.', icon: 'weather' }
    ] },
    { title: 'Your data', items: [
      { detail: 'backup-recovery', label: 'Backup & recovery', summary: 'Export, import, and restore your data.', icon: 'backup-recovery' }
    ] }
  ];

  const healthFitnessView = hydrated && (healthFitnessVisited || destination === 'health') ? (
    <HealthFitnessView
      people={peopleWithPhotos}
      onHome={() => navigate('today')}
      hidden={destination !== 'health' || profilePersonId !== null}
      strength={{
        data: previewData.strength,
        healthScore: strengthCategoryScore,
        people: previewData.people,
        peopleGroups: previewData.peopleGroups,
        rhythms: healthCategoryRhythms.map(rhythm => {
          const setting = previewData.strength.rhythmModes.find(item => item.rhythmId === rhythm.id);
          return {
            rhythm,
            mode: setting?.mode ?? 'recommended',
            ...(setting?.workoutId ? { workoutId: setting.workoutId } : {}),
            ...(setting?.rotationHistory ? { rotationHistory: setting.rotationHistory } : {})
          };
        }),
        archivedRhythms: archivedHealthRhythms,
        datedRhythmCompletions: previewData.datedRhythmCompletions,
        evaluationDate: currentDate,
        onChange: saveStrengthData,
        pendingRhythmLog: pendingStrengthRhythmLog,
        onRhythmLogOpened: requestId => {
          setStrengthLogRequest(current => current?.requestId === requestId ? null : current);
        }
      }}
      weight={{
        data: previewData.weight,
        today: currentDate,
        healthScore: weightCategoryScore,
        rhythms: healthCategoryRhythms,
        archivedRhythmIds: new Set(previewData.archivedRhythmIds),
        datedRhythmCompletions: previewData.datedRhythmCompletions,
        onChange: saveWeightData,
        pendingLogRequest: weightLogRequest,
        onLogRequestOpened: requestId => {
          setWeightLogRequest(current => current?.requestId === requestId ? null : current);
        },
        onQuickLog: event => {
          weightLogRequestSequence.current += 1;
          setWeightLogRequest({
            requestId: weightLogRequestSequence.current,
            opener: event.currentTarget
          });
        }
      }}
      cardio={{
        data: previewData.cardio,
        today: currentDate,
        rhythms: healthCategoryRhythms,
        archivedRhythmIds: new Set(previewData.archivedRhythmIds),
        datedRhythmCompletions: previewData.datedRhythmCompletions,
        onChange: saveCardioData,
        pendingLogRequest: cardioLogRequest,
        onLogRequestOpened: requestId => {
          setCardioLogRequest(current => current?.requestId === requestId ? null : current);
        },
        onQuickLog: event => {
          cardioLogRequestSequence.current += 1;
          setCardioLogRequest({
            requestId: cardioLogRequestSequence.current,
            opener: event.currentTarget
          });
        }
      }}
      flexibility={{
        data: previewData.flexibility,
        today: currentDate,
        datedRhythmCompletions: previewData.datedRhythmCompletions,
        onChange: saveFlexibilityData,
        pendingQuickLog: flexibilityLogRequest ? {
          requestId: flexibilityLogRequest.requestId,
          regionIds: [],
          linkedRhythmId: flexibilityLogRequest.rhythm.id,
          rhythmOccurrence: currentDate,
          rhythmTitle: flexibilityLogRequest.rhythm.title,
          opener: flexibilityLogRequest.opener
        } : null,
        onQuickLogOpened: requestId => {
          setFlexibilityLogRequest(current =>
            current?.requestId === requestId ? null : current
          );
        }
      }}
      rhythms={healthCategoryRhythms}
      archivedRhythms={archivedHealthRhythms}
      todayDate={currentDate}
      rhythmScores={rhythmScoreResults}
      completedRhythms={completedRhythms}
      undoableRhythms={undoableRhythms}
      satisfiedRhythmIds={satisfiedRhythmIds}
      tendedRhythmIds={tendedRhythmIds}
      initializing={!hydrated}
      foundations={foundationCatalogue}
      suggestionCatalogue={healthFitnessSuggestionCatalogue}
      categoryTabNavigationRequest={categoryTabNavigationRequest}
      foundationNavigationRequest={foundationNavigationRequest}
      onFoundationNavigationHandled={requestId => {
        setFoundationNavigationRequest(current =>
          current?.requestId === requestId ? null : current
        );
      }}
      onAddRhythm={event => openRhythmEditor(event, undefined, {
        initialDraft: createRhythmDraft(['health'])
      })}
      onAddLinkedRhythm={(foundationId, event) => openRhythmEditor(event, undefined, {
        initialDraft: {
          ...createRhythmDraft(['health']),
          primaryFoundationId: foundationId,
          secondaryFoundationIds: [],
          ...(foundationId === 'health-flexibility' ? { healthLogCapability: 'flexibility' } : {})
        }
      })}
      onSaveFoundationAssociations={saveFoundationAssociations}
      onAddSuggestion={openRhythmSuggestion}
      onEditRhythm={(rhythm, event, returnToSuggestions) => openRhythmEditor(event, rhythm, {
        ...(returnToSuggestions ? { returnToSuggestions } : {})
      })}
      onRhythmHistory={openRhythmHistory}
      onRestoreRhythm={restoreRhythm}
      onTendRhythm={openCompletion}
      onUndoRhythm={undoTend}
      onPersonSelect={openPersonProfile}
      onOpenFoundation={foundationId => navigateToFoundation(foundationId, 'today')}
      onOpenCategory={categoryId => navigate(categoryId)}
      healthScore={healthFitnessCategoryScore}
      weightHealthScore={weightCategoryScore}
      cardioHealthScore={cardioCategoryScore}
      flexibilityHealthScore={flexibilityCategoryScore}
      overallHealthScore={overallHealthScore}
    />
  ) : null;

  if (!hydrated) {
    return <PreviewAccessState title="Opening Preview" message="Loading this session’s local data." />;
  }

  return (
    <CategoryAvailabilityProvider
      preferences={previewData.categoryPreferences}
      foundationPreferences={previewData.foundationPreferences}
      prayerEnabled={previewData.prayerEnabled}
    >
    <TimeBlocksProvider settings={previewData.timeBlocks}>
    <div className="wrap tend-app-preview" data-text-size={textSize}>
      <AppNavigation
        destination={destination}
        search={search}
        searchOpen={searchOpen}
        searchResults={searchResults}
        textSize={textSize}
        onNavigate={next => {
          if (next !== 'more') {
            setSettingsDetail(null);
            setSettingsReturnTo(null);
          }
          navigate(next);
        }}
        onSearchChange={setSearch}
        onSearchClose={closeSearch}
        onSearchResult={openSearchResult}
        onSearchToggle={toggleSearch}
        onTextSizeChange={() => setTextSizePreference(textSize === 'small' ? 'medium' : textSize === 'medium' ? 'large' : 'small')}
      />
        {identity.kind === 'authenticated' && (
          <PreviewAccountSync
            portalTarget={accountSyncTarget}
            recoveryPortalTarget={accountRecoveryTarget}
            api={accountBackupApi ?? null}
            accountId={identity.accountId}
            {...(identity.email ? { email: identity.email } : {})}
            authRefreshSequence={authRefreshSequence}
            storage={previewStorage}
            data={previewData}
            localIsPristine={localIsPristine}
            currentDate={currentDate}
            localRaw={expectedRaw.current}
            importRecoveryRaw={importRecoveryCopy}
            importRecoverySourceRaw={importRecoverySourceCopy}
            importRecoveryArchiveRaw={importRecoveryArchive}
            importRecoveryError={importRecoveryError}
            localRecoveryRaw={cloudRestoreRecoveryCopy}
            localRecoveryError={cloudRestoreRecoveryError}
            repairRecoveryRaw={strengthRepairRecoveryCopy}
            repairRecoveryError={strengthRepairRecoveryError}
            onRepairRecoveryChanged={refreshStrengthRepairRecoveryCopy}
            onRecoveryArchiveChanged={refreshImportRecoveryCopy}
            enabled={hydrated && autoSaveEnabled && persistenceStatus.kind === 'saved'}
            localSaveConfirmed={persistenceStatus.kind === 'saved'}
            localSaveStatus={persistenceStatus.kind}
            localSaveError={
              persistenceStatus.kind === 'unavailable'
                || persistenceStatus.kind === 'error'
                || persistenceStatus.kind === 'corrupt'
                || persistenceStatus.kind === 'unsupported'
                ? persistenceStatus.message
                : persistenceStatus.kind === 'conflict'
                  ? 'This browser’s saved data changed in another tab. Reload it or resolve the conflict before saving.'
                  : null
            }
            onRetryLocalSave={retrySave}
            autoSyncEnabled
            visible={destination === 'more'}
            onOpenRecovery={() => {
              setMoreSettingsOpen(true);
              setSettingsReturnTo(null);
              setSettingsDetail('backup-recovery');
            }}
            manualOperationLocked={manualBackupLocked}
            isIdentityCurrent={() => isIdentityCurrent()
              && (isAccountBackupIdentityCurrent?.() ?? true)}
            onRestore={(data, expectedLocalRaw, restoreKind) => {
              if (!isIdentityCurrent()) {
                return 'Preview identity changed. No local data was replaced.';
              }
              if (expectedRaw.current !== expectedLocalRaw) {
                return 'This browser’s preview changed after confirmation. No local data was replaced.';
              }
              const writeError = finishWrite(
                data,
                false,
                restoreKind === 'manual-recovery' ? 'cloud-restore' : 'replace'
              );
              if (!writeError) refreshCloudRestoreRecoveryCopy();
              return writeError;
            }}
            onRepair={(data, expectedLocalRaw) => {
              if (!isIdentityCurrent() || !(isAccountBackupIdentityCurrent?.() ?? true)) {
                return 'Preview identity changed. No local data was replaced.';
              }
              if (expectedRaw.current !== expectedLocalRaw) {
                return 'This browser’s preview changed after confirmation. No local data was replaced.';
              }
              const writeError = finishTargetedRepair(data, expectedLocalRaw);
              refreshStrengthRepairRecoveryCopy();
              return writeError;
            }}
            onManualOperationLockChange={setManualBackupLocked}
          >
            <PreviewBackupImportControl
              data={previewData}
              status={persistenceStatus}
              currentDate={currentDate}
              currentRaw={expectedRaw.current}
              recoveryRaw={importRecoveryCopy}
              recoverySourceRaw={importRecoverySourceCopy}
              recoveryArchiveRaw={importRecoveryArchive}
              recoveryError={importRecoveryError}
              onImport={(data, sourceRaw) => finishWrite(data, true, 'import', sourceRaw)}
              showExport
              presentation="recovery"
              accountScoped
              advancedRecoveryInParent
            />
          </PreviewAccountSync>
        )}
        <div id="view" hidden={profilePersonId !== null}>
        {!hydrated
          ? <p role="status">Loading saved preview data…</p>
          : destination === 'more'
            ? (
              <main className="settings-page" aria-labelledby="more-page-title">
                <header className="settings-page__heading">
                  <h2 id="more-page-title" ref={morePageHeading} tabIndex={-1}>
                    {moreSettingsOpen ? 'Settings' : 'More'}
                  </h2>
                </header>
                <div
                  className="settings-page__more-sync-target"
                  hidden={moreSettingsOpen}
                  ref={identity.kind === 'authenticated' ? setAccountSyncTarget : undefined}
                />
                {!moreSettingsOpen && identity.kind === 'development' && (
                  <section className="settings-section more-save-status" aria-labelledby="more-save-status-title">
                    <h3 id="more-save-status-title">Save &amp; sync</h3>
                    <div className={`preview-account-sync__status-row preview-account-sync__status-row--${persistenceStatus.kind}`}>
                      <span className="preview-account-sync__icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" focusable="false">
                          <path d="M7.3 18.2h10.1a4.1 4.1 0 0 0 .4-8.2A6.2 6.2 0 0 0 6 8.5a4.9 4.9 0 0 0 1.3 9.7Z" />
                          {persistenceStatus.kind === 'saved'
                            ? <path d="m9.2 13.1 2.1 2.1 4.2-4.4" />
                            : <path d="M12 8.5v4l2.4 1.4" />}
                        </svg>
                      </span>
                      <div className="preview-account-sync__status-copy">
                        <p className="preview-account-sync__status" role="status">
                          {persistenceStatus.kind === 'saved'
                            ? 'Saved on this device'
                            : persistenceStatus.kind === 'saving' || persistenceStatus.kind === 'loading'
                              ? 'Saving…'
                              : 'Needs attention'}
                        </p>
                        <p className="preview-account-sync__description">
                          {persistenceStatus.kind === 'saved'
                            ? 'This synthetic preview is saved in this browser.'
                            : persistenceStatus.kind === 'saving' || persistenceStatus.kind === 'loading'
                              ? 'Checking and saving this browser copy.'
                              : 'Your latest changes are not confirmed saved on this device.'}
                        </p>
                      </div>
                      {persistenceStatus.kind === 'error' && (
                        <button type="button" className="btn mini ghost preview-account-sync__retry" onClick={retrySave}>
                          Try saving again
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      className="settings-link preview-account-sync__recovery-link"
                      onClick={() => {
                        setMoreSettingsOpen(true);
                        setSettingsReturnTo(null);
                        setSettingsDetail('backup-recovery');
                      }}
                    >
                      <span>Backup &amp; recovery</span>
                      <span aria-hidden="true">›</span>
                    </button>
                    <button
                      type="button"
                      className="more-save-status__tools"
                      onClick={() => {
                        setSettingsDetail('save-sync');
                        setMoreSettingsOpen(true);
                      }}
                    >
                      Preview data tools
                    </button>
                  </section>
                )}
                {moreSettingsOpen
                  ? (
                    <>
                      <button
                        type="button"
                        className="btn mini ghost settings-page__back"
                        onClick={() => {
                          if (settingsDetail) {
                            setSettingsDetail(settingsReturnTo ?? null);
                            setSettingsReturnTo(null);
                          } else {
                            setMoreSettingsOpen(false);
                          }
                        }}
                      >
                        {settingsDetail ? '‹ Settings' : '‹ More'}
                      </button>
                      {settingsDetail === null && <p className="settings-page__tagline">Make Tend your own.</p>}
                      <div className="settings-page__directory" hidden={settingsDetail !== null}>
                        {settingsGroups.map(group => (
                          <section className="settings-section" key={group.title} aria-label={group.title}>
                            <h3>{group.title}</h3>
                            {group.items.map(item => (
                              <button
                                type="button"
                                className="settings-link"
                                key={item.detail}
                                aria-label={item.label}
                                aria-describedby={`settings-summary-${item.detail}`}
                                onClick={() => {
                                  setSettingsReturnTo(null);
                                  setSettingsDetail(item.detail);
                                }}
                              >
                                <SettingsDirectoryIcon name={item.icon} />
                                <span className="settings-link__copy">
                                  <span className="settings-link__title">{item.label}</span>
                                  <span className="settings-link__summary" id={`settings-summary-${item.detail}`}>{item.summary}</span>
                                </span>
                                <span className="settings-link__chevron" aria-hidden="true">›</span>
                              </button>
                            ))}
                          </section>
                        ))}
                      </div>
                      {settingsDetail === null && (
                        <section
                          className="settings-section settings-page__account-actions"
                          aria-labelledby="settings-account-actions-title"
                        >
                          <h3 id="settings-account-actions-title">Account</h3>
                          <a className="settings-link" href="https://steveotto.github.io/tend/">
                            <span>Open Tend Classic</span>
                            <span className="settings-link__chevron" aria-hidden="true">›</span>
                          </a>
                          {onSignOut && (
                            <button type="button" className="settings-link" onClick={signOut}>
                              <span>Sign out</span>
                              <span className="settings-link__chevron" aria-hidden="true">›</span>
                            </button>
                          )}
                        </section>
                      )}
                      <section className="settings-section" aria-labelledby="category-settings-title" hidden={settingsDetail !== 'categories'}>
                        <h3 id="category-settings-title">Categories</h3>
                        <CategorySettings
                          preferences={previewData.categoryPreferences}
                          foundationPreferences={previewData.foundationPreferences}
                          onChange={setCategoryPreference}
                          onFoundationChange={setFoundationPreference}
                        />
                      </section>
                      <section className="settings-section" aria-labelledby="prayer-settings-title" hidden={settingsDetail !== 'prayer'}>
                        <h3 id="prayer-settings-title">Prayer</h3>
                        <PrayerSettings
                          enabled={previewData.prayerEnabled}
                          onChange={setPrayerEnabledPreference}
                        />
                      </section>
                      <section className="settings-section" aria-labelledby="appearance-settings-title" hidden={settingsDetail !== 'appearance'}>
                        <h3 id="appearance-settings-title">Appearance</h3>
                        <TextSizeSettings value={textSize} onChange={setTextSizePreference} />
                      </section>
                      <section className="settings-section" aria-labelledby="time-block-settings-title" hidden={settingsDetail !== 'time-blocks'}>
                        <h3 id="time-block-settings-title">Time blocks</h3>
                        <TimeBlocksSettings
                          settings={previewData.timeBlocks}
                          assignedBlockIds={assignedTimeBlockIds(previewData.savedRhythms)}
                          onSave={saveTimeBlockSettings}
                        />
                      </section>
                      <section className="settings-section" aria-labelledby="calendar-settings-title" hidden={settingsDetail !== 'calendar'}>
                        <h3 id="calendar-settings-title">Calendar</h3>
                        <CalendarSourcesSettings
                          sources={previewData.calendarSources}
                          onSave={saveCalendarSources}
                          showOnToday={previewData.showCalendarOnToday}
                          onShowOnTodayChange={setShowCalendarOnTodayPreference}
                          localReaderEnabled={identity.kind === 'development'}
                          accountScoped={identity.kind === 'authenticated'}
                        />
                      </section>
                      <section className="settings-section" aria-labelledby="weather-settings-title" hidden={settingsDetail !== 'weather'}>
                        <h3 id="weather-settings-title">Weather</h3>
                        <TodayWeatherSettings controller={todayWeather} timeZone={weatherTimeZone} />
                      </section>
                      <div className="settings-page__detail-slot" hidden={settingsDetail !== 'save-sync'}>
                        {identity.kind === 'development' && <h3 className="settings-page__detail-heading">Save &amp; sync</h3>}
                      </div>
                      <div className="settings-page__detail-slot" hidden={settingsDetail !== 'backup-recovery'}>
                        <h3 className="settings-page__detail-heading">Backup &amp; recovery</h3>
                        {identity.kind === 'authenticated'
                          ? <div className="preview-account-sync-slot" ref={setAccountRecoveryTarget} />
                          : <PreviewBackupImportControl
                              data={previewData}
                              status={persistenceStatus}
                              currentDate={currentDate}
                              currentRaw={expectedRaw.current}
                              recoveryRaw={importRecoveryCopy}
                              recoverySourceRaw={importRecoverySourceCopy}
                              recoveryArchiveRaw={importRecoveryArchive}
                              recoveryError={importRecoveryError}
                              onImport={(data, sourceRaw) => finishWrite(data, true, 'import', sourceRaw)}
                              showExport
                              presentation="recovery"
                            />}
                      </div>
                    </>
                  )
                  : (
                    <section className="settings-section settings-page__more-options" aria-label="More options">
                      <button
                        type="button"
                        className="settings-link"
                        aria-label="Settings"
                        aria-describedby="settings-summary-more-settings"
                        onClick={() => {
                          setSettingsDetail(null);
                          setMoreSettingsOpen(true);
                        }}
                      >
                        <SettingsDirectoryIcon name="settings" />
                        <span className="settings-link__copy">
                          <span className="settings-link__title">Settings</span>
                          <span className="settings-link__summary" id="settings-summary-more-settings">Make Tend your own.</span>
                        </span>
                        <span className="settings-link__chevron" aria-hidden="true">›</span>
                      </button>
                    </section>
                  )}
                {!moreSettingsOpen && (
                  <p className="settings-page__version">Version {APP_DISPLAY_VERSION}</p>
                )}
              </main>
            )
          : destination === 'today'
          ? (
            <TodayView
              people={peopleWithPhotos}
              peopleGroups={resolvedPeopleGroups}
              personSparks={previewData.personSparks}
              friendships={previewData.friendships}
              greeting={greeting}
              evaluationInstant={scoringInstant}
              localDate={currentDate}
              localTimeZone={localTimeZone || 'UTC'}
              calendarReaderEnabled={identity.kind === 'development' || identity.kind === 'authenticated'}
              view={previewData.todayView}
              onViewChange={setTodayViewPreference}
              weatherController={todayWeather}
              completedRhythms={completedRhythms}
              undoableRhythms={undoableRhythms}
              satisfiedRhythmIds={satisfiedRhythmIds}
              tendedRhythmIds={tendedRhythmIds}
              initializing={!hydrated}
              rhythms={editableTodayRhythms}
              rhythmScores={rhythmScoreResults}
              prayerRequests={prayerRequests}
              onPrayForRequest={recordPrayer}
              categoryHealthScores={categoryHealthScores}
              foundations={foundationCatalogue}
              onNavigate={navigate}
              onOpenSettings={() => {
                navigate('more');
                setSettingsDetail('categories');
                setMoreSettingsOpen(true);
              }}
              onOpenCalendarSetup={openCalendarSettings}
              onOpenFoundation={foundationId => navigateToFoundation(foundationId, 'today')}
              onPersonSelect={openPersonProfile}
              onCreateSpark={createPersonSparkForProfile}
              onUpdateSpark={editPersonSpark}
              onArchiveSpark={archivePersonSpark}
              onDeleteSpark={removePersonSpark}
              onUndoSpark={undoSparkCompletion}
              onCompleteSpark={(spark: PersonSpark, _opener, returnFocus) => {
                openPersonProfileAt(spark.ownerId, 'connections', undefined, {
                  sparkCompletionId: spark.id,
                  returnFocus
                });
              }}
              onOpenSparkPerson={(personId, returnFocus) => {
                openPersonProfileAt(personId, 'rhythms', undefined, { returnFocus });
              }}
              onHistory={openRhythmHistory}
              onTend={openCompletion}
              onEditRhythm={(rhythm, event) => openRhythmEditor(event, rhythm)}
              onUndo={undoTend}
              calendarSources={previewData.calendarSources}
              onCalendarEventsChange={setFocusCalendarEvents}
              showCalendarOnToday={previewData.showCalendarOnToday}
            />
          )
          : destination === 'marriage'
            ? (
              <MarriageView
                people={peopleWithPhotos}
                overallHealthScore={overallHealthScore}
                todayDate={currentDate}
                onAddRhythm={event => openRhythmEditor(event)}
                onAddLinkedRhythm={(foundationId, event) => openRhythmEditor(event, undefined, {
                  initialDraft: {
                    ...createRhythmDraft(['marriage']),
                    primaryFoundationId: foundationId,
                    secondaryFoundationIds: []
                  }
                })}
                onAddSuggestion={openRhythmSuggestion}
                onPersonSelect={openPersonProfile}
                onOpenCategory={categoryId => navigate(categoryId)}
                onHome={() => navigate('today')}
                userRhythms={marriageCategoryRhythms}
                archivedRhythms={archivedMarriageRhythms}
                foundationRhythms={marriageCategoryRhythms}
                suggestionRhythms={resolvedMarriageRhythms}
                suggestionInstances={allTodayRhythms}
                foundationRhythmScores={rhythmScoreResults}
                archivedRhythmIds={previewData.archivedRhythmIds}
                completedRhythms={completedRhythms}
                undoableRhythms={undoableRhythms}
                satisfiedRhythmIds={satisfiedRhythmIds}
                tendedRhythmIds={tendedRhythmIds}
                initializing={!hydrated}
                onRhythmHistory={openRhythmHistory}
                onEditRhythm={(rhythm, event, returnToSuggestions) => openRhythmEditor(event, rhythm, {
                  ...(returnToSuggestions ? { returnToSuggestions } : {})
                })}
                onRestoreRhythm={restoreRhythm}
                onTend={openCompletion}
                onUndo={undoTend}
                onSaveFoundationAssociations={saveFoundationAssociations}
                foundationNavigationRequest={foundationNavigationRequest}
                categoryTabNavigationRequest={categoryTabNavigationRequest}
                onFoundationNavigationHandled={() => setFoundationNavigationRequest(null)}
              />
            )
          : destination === 'dating'
            ? (
              <MarriageView
                people={peopleWithPhotos}
                overallHealthScore={overallHealthScore}
                categoryConfig={{
                  categoryId: 'dating',
                  label: 'Dating',
                  description: 'Build connection and shared direction at a pace that feels mutual.',
                  foundations: foundationCatalogue.filter(foundation => foundation.categoryId === 'dating'),
                  scoreExplanationIntro: 'Dating Health reflects follow-through on chosen Rhythms; it does not rate relationship quality.',
                  scoreInterpretationNote: 'These scores describe selected Rhythm follow-through, not the quality or future of a relationship.',
                  suggestionCatalogue: datingSuggestionCatalogue,
                  categoryAction: (
                    <button
                      type="button"
                      className="btn mini ghost"
                      aria-label={`Open People filtered to Dating partners · ${resolvedPeopleGroups.find(group => group.id === 'dating')?.memberIds.length ?? 0}`}
                      onClick={() => {
                        setPeopleInitialFilter('dating');
                        navigate('people');
                      }}
                    >
                      Dating partners · {resolvedPeopleGroups.find(group => group.id === 'dating')?.memberIds.length ?? 0}
                      <span aria-hidden="true">›</span>
                    </button>
                  )
                }}
                todayDate={currentDate}
                onAddRhythm={event => openRhythmEditor(event, undefined, {
                  initialDraft: createRhythmDraft(['dating'])
                })}
                onAddLinkedRhythm={(foundationId, event) => openRhythmEditor(event, undefined, {
                  initialDraft: {
                    ...createRhythmDraft(['dating']),
                    primaryFoundationId: foundationId,
                    secondaryFoundationIds: []
                  }
                })}
                onAddSuggestion={openRhythmSuggestion}
                onPersonSelect={openPersonProfile}
                onOpenCategory={categoryId => navigate(categoryId)}
                onHome={() => navigate('today')}
                userRhythms={datingCategoryRhythms}
                archivedRhythms={archivedDatingRhythms}
                foundationRhythms={datingCategoryRhythms}
                suggestionRhythms={datingCategoryRhythms}
                suggestionInstances={allTodayRhythms}
                foundationRhythmScores={rhythmScoreResults}
                archivedRhythmIds={previewData.archivedRhythmIds}
                completedRhythms={completedRhythms}
                undoableRhythms={undoableRhythms}
                satisfiedRhythmIds={satisfiedRhythmIds}
                tendedRhythmIds={tendedRhythmIds}
                initializing={!hydrated}
                onRhythmHistory={openRhythmHistory}
                onEditRhythm={(rhythm, event, returnToSuggestions) => openRhythmEditor(event, rhythm, {
                  ...(returnToSuggestions ? { returnToSuggestions } : {})
                })}
                onRestoreRhythm={restoreRhythm}
                onTend={openCompletion}
                onUndo={undoTend}
                onSaveFoundationAssociations={saveFoundationAssociations}
                foundationNavigationRequest={foundationNavigationRequest}
                categoryTabNavigationRequest={categoryTabNavigationRequest}
                onFoundationNavigationHandled={() => setFoundationNavigationRequest(null)}
              />
            )
          : destination === 'parenting'
            ? (
              <MarriageView
                people={peopleWithPhotos}
                overallHealthScore={overallHealthScore}
                categoryConfig={{
                  categoryId: 'parenting',
                  label: 'Parenting',
                  description: "If your presence isn't felt, your absence won't be noticed.",
                  foundations: foundationCatalogue.filter(foundation => foundation.categoryId === 'parenting'),
                  scoreInterpretationNote: 'These scores reflect follow-through on chosen Rhythms. They do not measure a child’s wellbeing or the quality of someone’s parenting.',
                  suggestionCatalogue: parentingSuggestionCatalogue
                }}
                todayDate={currentDate}
                onAddRhythm={event => openRhythmEditor(event, undefined, {
                  initialDraft: createRhythmDraft(['parenting'])
                })}
                onAddLinkedRhythm={(foundationId, event) => openRhythmEditor(event, undefined, {
                  initialDraft: {
                    ...createRhythmDraft(['parenting']),
                    primaryFoundationId: foundationId,
                    secondaryFoundationIds: []
                  }
                })}
                onAddSuggestion={openRhythmSuggestion}
                onPersonSelect={openPersonProfile}
                onOpenCategory={categoryId => navigate(categoryId)}
                onHome={() => navigate('today')}
                userRhythms={parentingCategoryRhythms}
                archivedRhythms={archivedParentingRhythms}
                foundationRhythms={parentingCategoryRhythms}
                suggestionRhythms={parentingCategoryRhythms}
                suggestionInstances={allTodayRhythms}
                foundationRhythmScores={rhythmScoreResults}
                archivedRhythmIds={previewData.archivedRhythmIds}
                completedRhythms={completedRhythms}
                undoableRhythms={undoableRhythms}
                satisfiedRhythmIds={satisfiedRhythmIds}
                tendedRhythmIds={tendedRhythmIds}
                initializing={!hydrated}
                onRhythmHistory={openRhythmHistory}
                onEditRhythm={(rhythm, event, returnToSuggestions) => openRhythmEditor(event, rhythm, {
                  ...(returnToSuggestions ? { returnToSuggestions } : {})
                })}
                onRestoreRhythm={restoreRhythm}
                onTend={openCompletion}
                onUndo={undoTend}
                onSaveFoundationAssociations={saveFoundationAssociations}
                foundationNavigationRequest={foundationNavigationRequest}
                categoryTabNavigationRequest={categoryTabNavigationRequest}
                onFoundationNavigationHandled={() => setFoundationNavigationRequest(null)}
              />
            )
          : destination === 'faith'
            ? (
              <MarriageView
                people={peopleWithPhotos}
                overallHealthScore={overallHealthScore}
                categoryConfig={{
                  categoryId: 'faith',
                  label: 'Faith',
                  description: 'Faith practices that help you make room for God in everyday life.',
                  foundations: foundationCatalogue.filter(foundation => foundation.categoryId === 'faith'),
                  foundationTerm: { singular: 'Practice', plural: 'Practices' },
                  tabLabel: 'Practices',
                  scoreExplanationIntro: 'Your score reflects follow-through on your chosen practices—not the strength of your faith.',
                  suggestionCatalogue: faithSuggestionCatalogue
                }}
                todayDate={currentDate}
                onAddRhythm={event => openRhythmEditor(event, undefined, {
                  initialDraft: createRhythmDraft(['faith'])
                })}
                onAddLinkedRhythm={(foundationId, event) => openRhythmEditor(event, undefined, {
                  initialDraft: {
                    ...createRhythmDraft(['faith']),
                    primaryFoundationId: foundationId,
                    secondaryFoundationIds: []
                  }
                })}
                onAddSuggestion={openRhythmSuggestion}
                onPersonSelect={openPersonProfile}
                onOpenCategory={categoryId => navigate(categoryId)}
                onHome={() => navigate('today')}
                userRhythms={faithCategoryRhythms}
                archivedRhythms={archivedFaithRhythms}
                foundationRhythms={faithCategoryRhythms}
                suggestionRhythms={faithCategoryRhythms}
                suggestionInstances={allTodayRhythms}
                foundationRhythmScores={rhythmScoreResults}
                archivedRhythmIds={previewData.archivedRhythmIds}
                completedRhythms={completedRhythms}
                undoableRhythms={undoableRhythms}
                satisfiedRhythmIds={satisfiedRhythmIds}
                tendedRhythmIds={tendedRhythmIds}
                initializing={!hydrated}
                onRhythmHistory={openRhythmHistory}
                onEditRhythm={(rhythm, event, returnToSuggestions) => openRhythmEditor(event, rhythm, {
                  ...(returnToSuggestions ? { returnToSuggestions } : {})
                })}
                onRestoreRhythm={restoreRhythm}
                onTend={openCompletion}
                onUndo={undoTend}
                onSaveFoundationAssociations={saveFoundationAssociations}
                foundationNavigationRequest={foundationNavigationRequest}
                categoryTabNavigationRequest={categoryTabNavigationRequest}
                onFoundationNavigationHandled={() => setFoundationNavigationRequest(null)}
              />
            )
          : destination === 'health'
            ? null
          : destination === 'friendships'
            ? (
              <MarriageView
                people={peopleWithPhotos}
                overallHealthScore={overallHealthScore}
                categoryConfig={{
                  categoryId: 'friendships',
                  label: 'Friendships',
                  description: 'Keep close through time, encouragement, and shared memories.',
                  foundations: foundationCatalogue.filter(foundation => foundation.categoryId === 'friendships'),
                  scoreExplanationIntro: 'Friendships Health reflects eligible Rhythms linked through these Foundations. Connection logs and cadence do not affect scoring.',
                  categoryAction: (
                    <button
                      type="button"
                      className="btn mini ghost friendships-friends-navigation"
                      aria-label={`Open People filtered to Friends · ${resolvedPeopleGroups.find(group => group.id === 'friends')?.memberIds.length ?? 0}`}
                      onClick={() => {
                        setPeopleInitialFilter('friends');
                        navigate('people');
                      }}
                    >
                      Friends · {resolvedPeopleGroups.find(group => group.id === 'friends')?.memberIds.length ?? 0}
                      <span aria-hidden="true">›</span>
                    </button>
                  )
                }}
                todayDate={currentDate}
                onAddRhythm={event => openRhythmEditor(event, undefined, {
                  initialDraft: createRhythmDraft(['friendships'])
                })}
                onAddLinkedRhythm={(foundationId, event) => openRhythmEditor(event, undefined, {
                  initialDraft: {
                    ...createRhythmDraft(['friendships']),
                    primaryFoundationId: foundationId,
                    secondaryFoundationIds: []
                  }
                })}
                onPersonSelect={openPersonProfile}
                onOpenCategory={categoryId => navigate(categoryId)}
                onHome={() => navigate('today')}
                userRhythms={friendshipCategoryRhythms}
                archivedRhythms={archivedFriendshipRhythms}
                foundationRhythms={friendshipCategoryRhythms}
                suggestionRhythms={friendshipCategoryRhythms}
                suggestionInstances={allTodayRhythms}
                foundationRhythmScores={rhythmScoreResults}
                archivedRhythmIds={previewData.archivedRhythmIds}
                completedRhythms={completedRhythms}
                undoableRhythms={undoableRhythms}
                satisfiedRhythmIds={satisfiedRhythmIds}
                tendedRhythmIds={tendedRhythmIds}
                initializing={!hydrated}
                onRhythmHistory={openRhythmHistory}
                onEditRhythm={(rhythm, event) => openRhythmEditor(event, rhythm)}
                onRestoreRhythm={restoreRhythm}
                onTend={openCompletion}
                onUndo={undoTend}
                onSaveFoundationAssociations={saveFoundationAssociations}
                foundationNavigationRequest={foundationNavigationRequest}
                categoryTabNavigationRequest={categoryTabNavigationRequest}
                onFoundationNavigationHandled={() => setFoundationNavigationRequest(null)}
              />
            )
          : destination === 'finances'
            ? (
              <FinanceGoalsView
                goals={moneyGoals}
                currentDate={currentDate}
                financeFoundations={financeFoundations}
                rhythms={userRhythms}
                archivedRhythms={archivedUserRhythms}
                categoryRhythms={financeCategoryRhythms}
                archivedCategoryRhythms={archivedFinanceCategoryRhythms}
                people={peopleWithPhotos}
                foundations={foundationCatalogue}
                suggestionCatalogue={financeSuggestionCatalogue}
                rhythmScores={rhythmScoreResults}
                archivedRhythmIds={previewData.archivedRhythmIds}
                completedRhythms={completedRhythms}
                undoableRhythms={undoableRhythms}
                onSaveGoal={saveGoal}
                onSaveCheckIn={saveGoalCheckIn}
                onSaveFoundationAssociations={saveFoundationAssociations}
                onAddLinkedRhythm={(foundationId, event) => openRhythmEditor(event, undefined, {
                  initialDraft: {
                    ...createRhythmDraft(['finances']),
                    primaryFoundationId: foundationId
                  }
                })}
                onAddRhythm={event => openRhythmEditor(event, undefined, {
                  initialDraft: createRhythmDraft(['finances'])
                })}
                onAddSuggestion={openRhythmSuggestion}
                onTendRhythm={openCompletion}
                onUndoRhythm={undoTend}
                onRestoreRhythm={restoreRhythm}
                onEditRhythm={(rhythm, event, returnToSuggestions) => openRhythmEditor(event, rhythm, {
                  ...(returnToSuggestions ? { returnToSuggestions } : {})
                })}
                onRhythmHistory={openRhythmHistory}
                onPersonSelect={openPersonProfile}
                onOpenFoundation={foundationId => navigateToFoundation(foundationId, 'today')}
                onOpenCategory={categoryId => navigate(categoryId)}
                onToday={() => navigate('today')}
                foundationNavigationRequest={foundationNavigationRequest}
                onFoundationNavigationHandled={() => setFoundationNavigationRequest(null)}
              />
            )
          : destination === 'people'
            ? (
              <PeopleView
                people={peopleWithPhotos}
                groups={resolvedPeopleGroups}
                friendships={previewData.friendships}
                today={currentDate}
                personDetails={previewData.personDetails}
                healthScores={personOverallHealthScores}
                initialFilter={peopleInitialFilter}
                onOpenPerson={openPersonProfile}
                onCreatePerson={createPerson}
              />
            )
          : destination === 'focus'
          ? (
            focusData
              ? (
                <FocusDialog
                  data={focusData}
                  people={peopleWithPhotos}
                  rhythms={focusRhythms}
                  foundations={foundationCatalogue}
                  rhythmScores={rhythmScoreResults}
                  categoryHealthScores={categoryHealthScores}
                  undoableRhythmIds={undoableRhythms}
                  todayDate={currentDate}
                  timeZone={localTimeZone}
                  initializing={!hydrated}
                  onClose={() => navigate('today')}
                  onPersonSelect={openPersonProfile}
                  onOpenFoundation={foundationId => navigateToFoundation(foundationId, 'today')}
                  onOpenCategory={categoryId => navigate(categoryId)}
                  onRhythmHistory={openRhythmHistory}
                  onEditRhythm={(rhythm, event) => openRhythmEditor(event, rhythm)}
                  onTendRhythm={openCompletion}
                  onUndoRhythm={undoTend}
                />
              )
              : <PlaceholderPage destination={destination} onToday={() => navigate('today')} />
          )
          : <PlaceholderPage destination={destination} onToday={() => navigate('today')} />}
      </div>
      {identity.kind === 'development' && (
        <PreviewDataControls
          hidden={!isPreviewSettings || settingsDetail !== 'save-sync' || profilePersonId !== null}
          data={previewData}
          status={persistenceStatus}
          currentDate={currentDate}
          currentRaw={expectedRaw.current}
          importRecoveryRaw={importRecoveryCopy}
          importRecoverySourceRaw={importRecoverySourceCopy}
          importRecoveryArchiveRaw={importRecoveryArchive}
          importRecoveryError={importRecoveryError}
          onImport={(data, sourceRaw) => finishWrite(data, true, 'import', sourceRaw)}
          onReset={() => finishWrite(initialPreviewData(), true, 'reset')}
          onRetrySave={retrySave}
          onReloadExternal={reloadExternal}
          onReplaceExternal={replaceExternal}
          rawRecoveryCopy={rawRecoveryCopy}
          rawRecoveryError={rawRecoveryError}
          v1RecoveryCopy={v1RecoveryCopy} v1RecoveryError={v1RecoveryError}
          v2RecoveryCopy={v2RecoveryCopy} v2RecoveryError={v2RecoveryError}
          v3RecoveryCopy={v3RecoveryCopy} v3RecoveryError={v3RecoveryError}
          v4RecoveryCopy={v4RecoveryCopy} v4RecoveryError={v4RecoveryError}
          v5RecoveryCopy={v5RecoveryCopy} v5RecoveryError={v5RecoveryError}
          v6RecoveryCopy={v6RecoveryCopy} v6RecoveryError={v6RecoveryError}
          v7RecoveryCopy={v7RecoveryCopy} v7RecoveryError={v7RecoveryError}
          v8RecoveryCopy={v8RecoveryCopy} v8RecoveryError={v8RecoveryError}
          v9RecoveryCopy={v9RecoveryCopy} v9RecoveryError={v9RecoveryError}
          v10RecoveryCopy={v10RecoveryCopy} v10RecoveryError={v10RecoveryError}
          v11RecoveryCopy={v11RecoveryCopy} v11RecoveryError={v11RecoveryError}
          v12RecoveryCopy={v12RecoveryCopy} v12RecoveryError={v12RecoveryError}
          v13RecoveryCopy={v13RecoveryCopy} v13RecoveryError={v13RecoveryError}
          v14RecoveryCopy={v14RecoveryCopy} v14RecoveryError={v14RecoveryError}
          v15RecoveryCopy={v15RecoveryCopy} v15RecoveryError={v15RecoveryError}
          v16RecoveryCopy={v16RecoveryCopy} v16RecoveryError={v16RecoveryError}
          v17RecoveryCopy={v17RecoveryCopy} v17RecoveryError={v17RecoveryError}
          v18RecoveryCopy={v18RecoveryCopy} v18RecoveryError={v18RecoveryError}
          v19RecoveryCopy={v19RecoveryCopy} v19RecoveryError={v19RecoveryError}
          v20RecoveryCopy={v20RecoveryCopy} v20RecoveryError={v20RecoveryError}
          v21RecoveryCopy={v21RecoveryCopy} v21RecoveryError={v21RecoveryError}
          v22RecoveryCopy={v22RecoveryCopy} v22RecoveryError={v22RecoveryError}
          v23RecoveryCopy={v23RecoveryCopy} v23RecoveryError={v23RecoveryError}
          v24RecoveryCopy={v24RecoveryCopy} v24RecoveryError={v24RecoveryError}
          v25RecoveryCopy={v25RecoveryCopy} v25RecoveryError={v25RecoveryError}
          v26RecoveryCopy={v26RecoveryCopy} v26RecoveryError={v26RecoveryError}
          v27RecoveryCopy={v27RecoveryCopy} v27RecoveryError={v27RecoveryError}
          v28RecoveryCopy={v28RecoveryCopy} v28RecoveryError={v28RecoveryError}
          v29RecoveryCopy={v29RecoveryCopy} v29RecoveryError={v29RecoveryError}
          v30RecoveryCopy={v30RecoveryCopy} v30RecoveryError={v30RecoveryError}
          v31RecoveryCopy={v31RecoveryCopy} v31RecoveryError={v31RecoveryError}
          v32RecoveryCopy={v32RecoveryCopy} v32RecoveryError={v32RecoveryError}
          v33RecoveryCopy={v33RecoveryCopy} v33RecoveryError={v33RecoveryError}
          v34RecoveryCopy={v34RecoveryCopy} v34RecoveryError={v34RecoveryError}
          v35RecoveryCopy={v35RecoveryCopy} v35RecoveryError={v35RecoveryError}
          v36RecoveryCopy={v36RecoveryCopy} v36RecoveryError={v36RecoveryError}
          v40RecoveryCopy={v40RecoveryCopy} v40RecoveryError={v40RecoveryError}
          v41RecoveryCopy={v41RecoveryCopy}
          v42RecoveryCopy={v42RecoveryCopy}
          v43RecoveryCopy={v43RecoveryCopy}
          v44RecoveryCopy={v44RecoveryCopy}
          v45RecoveryCopy={v45RecoveryCopy}
          v46RecoveryCopy={v46RecoveryCopy}
          v47RecoveryCopy={v47RecoveryCopy}
          v48RecoveryCopy={v48RecoveryCopy}
          v50RecoveryCopy={v50RecoveryCopy}
          v54RecoveryCopy={v54RecoveryCopy}
          v55RecoveryCopy={v55RecoveryCopy}
        />
      )}
      {healthFitnessView}
      {selectedProfilePerson && (
        <PersonProfileView
          personId={selectedProfilePerson.id}
          people={peopleWithPhotos}
          returnLabel={destination === 'today' ? 'Today' : destinationLabels[destination]}
          peopleGroups={resolvedPeopleGroups}
          personDetails={previewData.personDetails}
          personNotes={previewData.personNotes}
          prayerRequests={previewData.prayerRequests}
          navigationRequest={profileNavigationRequest}
          friendships={previewData.friendships}
          today={localDateInTimeZone(new Date(), localTimeZone)}
          rhythms={personActiveRhythms}
          archivedRhythms={personArchivedRhythms}
          foundations={foundationCatalogue}
          {...(selectedProfileSuggestionCatalogue ? { suggestionCatalogue: selectedProfileSuggestionCatalogue } : {})}
          rhythmScores={rhythmScoreResults}
          completedRhythms={completedRhythms}
          undoableRhythms={undoableRhythms}
          satisfiedRhythmIds={satisfiedRhythmIds}
          tendedRhythmIds={tendedRhythmIds}
          initializing={!hydrated}
          onEditPerson={openPersonDetailsEditor}
          onAddRhythm={(event, personId) => openRhythmEditor(event, undefined, {
            initialDraft: { ...createRhythmDraft([]), personIds: [personId] }
          })}
          onEditRhythm={(rhythm, event) => openRhythmEditor(event, rhythm)}
          onRhythmHistory={openRhythmHistory}
          onTend={openCompletion}
          onUndo={undoTend}
          onRestoreRhythm={restoreRhythm}
          onOpenFoundation={foundationId => {
            navigateToFoundation(foundationId, 'today');
          }}
          onOpenCategory={categoryId => {
            navigate(categoryId);
          }}
          onPersonSelect={openPersonProfile}
          onConnectionChange={friendships => setPreviewData(previous => ({ ...previous, friendships }))}
          personSparks={previewData.personSparks}
          onCreatePersonSpark={createPersonSparkForProfile}
          onUpdatePersonSpark={editPersonSpark}
          onArchivePersonSpark={archivePersonSpark}
          onDeletePersonSpark={removePersonSpark}
          onUndoPersonSparkCompletion={undoSparkCompletion}
          onCompletePersonSpark={completeSparkWithConnection}
          onSaveConnection={savePersonConnection}
          onDeleteConnection={removePersonConnection}
          onCreatePersonNote={savePersonNote}
          onUpdatePersonNote={editPersonNote}
          onDeletePersonNote={removePersonNote}
          onCreatePrayerRequest={createPrayerRequest}
          onUpdatePrayerRequest={editPrayerRequest}
          onPrayerRequestTransition={transitionPrayerRequest}
          onPrayForRequest={prayForRequest}
          onRemovePrayerRequest={removePrayerRequest}
          onClose={closePersonProfile}
        />
      )}
      {selectedDetailsEditorPerson && (
        <PersonDetailsEditor
          key={selectedDetailsEditorPerson.id}
          personId={selectedDetailsEditorPerson.id}
          personName={selectedDetailsEditorPerson.displayName}
          {...(selectedDetailsEditorDetails ? { details: selectedDetailsEditorDetails } : {})}
          today={currentDate}
          cadence={selectedDetailsEditorCadence}
          categoryIds={selectedDetailsEditorCategoryIds}
          onSave={draft => savePersonDetails(selectedDetailsEditorPerson.id, draft)}
          onClose={closePersonDetailsEditor}
        />
      )}
      {storageNeedsAttention && !isPreviewSettings && (
        <p className="preview-storage-alert" role="alert">
          {persistenceStatus.kind === 'error'
            ? 'Preview data was not saved on this device. Your changes remain in this tab; open More → Settings → Save & sync to retry before leaving.'
            : persistenceStatus.kind === 'conflict'
              ? 'Another tab changed the saved preview. Your current changes remain here until you choose how to resolve it.'
              : 'Preview data needs attention. Open More → Settings → Save & sync to review recovery and storage options.'}
        </p>
      )}
      {rhythmConnectionNotice && (
        <p className="rhythm-connection-notice" role="status" aria-live="polite">
          <span>{rhythmConnectionNotice}</span>
          <button type="button" onClick={() => setRhythmConnectionNotice('')}>Dismiss</button>
        </p>
      )}
      {import.meta.env.MODE !== 'pages' && (
        <footer className="preview-footer">
          <a href="/preview.html">Component catalogue</a>
        </footer>
      )}
      {activeRhythm && (
        <RhythmDetailsDialog
          key={activeRhythm.id}
          rhythm={activeRhythmForDetails!}
          {...(activeRhythm.healthLogCapability === 'workout'
            ? {
                healthWorkoutSetting: (() => {
                  const setting = previewData.strength.rhythmModes.find(item =>
                    item.rhythmId === activeRhythm.id
                  );
                  return {
                    mode: setting?.mode ?? 'recommended',
                    ...(setting?.mode === 'specific' && setting.workoutId
                      ? {
                          workoutName: previewData.strength.savedWorkouts.find(workout =>
                            workout.id === setting.workoutId
                          )?.name ?? 'Unavailable saved workout'
                        }
                      : {})
                  };
                })()
              }
            : {})}
          initialView={detailsInitialView}
          datedCompletions={[]}
          completionHistoryAvailable={
            activeRhythmIsToday || activeRhythmIsArchived || activeRhythm.completionHistory !== undefined
          }
          {...(activeRhythm.categoryIds?.includes('health')
            ? { completionActionLabel: 'Log workout', completedActionLabel: 'Logged' }
            : {})}
          {...(activeRhythmIsToday && isEditableRhythmId(activeRhythm.id) && !activeRhythmIsArchived
            && !activeRhythm.categoryIds?.includes('health')
            ? {
                onLogCompletion: (record, participants) =>
                  saveDatedCompletion(record, 'history', participants)
              }
            : {})}
          {...(activeRhythmIsToday && isEditableRhythmId(activeRhythm.id) && !activeRhythmIsArchived
            ? {
                onUpdateCompletion: updateDatedCompletion,
                onDeleteCompletion: deleteDatedCompletionRecord
              }
            : {})}
          {...(activeRhythmIsToday && isEditableRhythmId(activeRhythm.id) && !activeRhythmIsArchived
            ? { onEditSeason: saveSeasonCorrection }
            : {})}
          {...(activeRhythmIsToday && isEditableRhythmId(activeRhythm.id) && !activeRhythmIsArchived
            ? { onDeleteSeason: deleteSeason }
            : {})}
          seasonDeletionUndo={seasonDeletionUndo?.rhythmId === activeRhythm.id ? seasonDeletionUndo : null}
          {...(seasonDeletionUndo?.rhythmId === activeRhythm.id
            ? { onUndoSeasonDeletion: undoSeasonDeletion }
            : {})}
          seasonRangeUndo={seasonRangeUndo?.rhythmId === activeRhythm.id
            ? { rhythmId: seasonRangeUndo.rhythmId }
            : null}
          {...(seasonRangeUndo?.rhythmId === activeRhythm.id
            ? { onUndoSeasonRange: undoSeasonRange }
            : {})}
          people={peopleForRhythm(activeRhythm, peopleWithPhotos)}
          foundations={foundationCatalogue}
          relatedRhythms={scoredRhythms}
          rhythmScores={rhythmScoreResults}
          categoryHealthScores={categoryHealthScores}
          archivedRhythmIds={previewData.archivedRhythmIds}
          archived={activeRhythmIsArchived}
          onOpenFoundation={foundationId => {
            setActiveRhythmId(null);
            navigateToFoundation(foundationId, activeRhythmReturnTab.current);
          }}
          onOpenCategory={categoryId => {
            setActiveRhythmId(null);
            navigate(categoryId);
          }}
          onPersonSelect={personId => {
            openPersonProfile(personId);
          }}
          {...(activeRhythmIsToday
            ? {
                completed: completedRhythms.has(activeRhythm.id),
                ...(!activeRhythmIsArchived ? { onSaveCompletion: saveDatedCompletion } : {}),
                ...(activeRhythm.categoryIds?.includes('health') && !activeRhythmIsArchived
                  ? { onTend: event => openCompletion(activeRhythm.id, event) }
                  : {}),
                ...(undoableRhythms.has(activeRhythm.id) && !activeRhythm.healthLogCapability
                  ? { onUndo: () => undoTend(activeRhythm.id) }
                  : {}),
                ...(isEditableRhythmId(activeRhythm.id)
                  ? {
                      onEdit: event => openRhythmEditor(event, activeRhythm)
                    }
                  : {})
              }
            : {
                completed: completedRhythms.has(activeRhythm.id),
                ...(undoableRhythms.has(activeRhythm.id) && !activeRhythm.healthLogCapability
                  ? { onUndo: () => undoTend(activeRhythm.id) }
                  : {})
              })}
          onClose={() => setActiveRhythmId(null)}
        />
      )}
      {completionDialogRhythm && (
        <RhythmCompletionDialog
          rhythm={completionDialogRhythm}
          onSave={saveDatedCompletion}
          onClose={() => setCompletionDialogRhythmId(null)}
        />
      )}
      {rhythmEditor && (
        <RhythmEditor
          people={peopleWithPhotos}
          savedWorkouts={previewData.strength.savedWorkouts}
          {...(rhythmEditor.rhythm
            ? {
                healthWorkoutSetting: (() => {
                  const setting = previewData.strength.rhythmModes.find(item =>
                    item.rhythmId === rhythmEditor.id
                  );
                  return {
                    mode: setting?.mode ?? 'recommended',
                    ...(setting?.workoutId ? { workoutId: setting.workoutId } : {}),
                    ...(setting?.rotationHistory ? { rotationHistory: setting.rotationHistory } : {})
                  };
                })()
              }
            : {})}
          {...(rhythmEditor.rhythm ? { rhythm: rhythmEditor.rhythm } : {})}
          {...(rhythmEditor.initialDraft ? { initialDraft: rhythmEditor.initialDraft } : {})}
          {...(rhythmEditor.suggestionSourceId
            ? { suggestionSourceId: rhythmEditor.suggestionSourceId }
            : {})}
          {...(rhythmEditor.recommendedFrequency
            ? {
                recommendedFrequency: rhythmEditor.recommendedFrequency,
                ...(rhythmEditor.frequencyGuidance ? { frequencyGuidance: rhythmEditor.frequencyGuidance } : {})
              }
            : {})}
          asOfDate={localDateInTimeZone(
            new Date(),
            rhythmEditor.rhythm?.scoring?.timeZone
              ?? rhythmEditor.rhythm?.createdTimeZone
              ?? Intl.DateTimeFormat().resolvedOptions().timeZone
          )}
          peopleGroups={resolvedPeopleGroups}
          hasDatedCompletionHistory={
            previewData.rhythmHistoryIds.includes(rhythmEditor.id)
            || (rhythmEditor.rhythm?.completionHistory?.length ?? 0) > 0
          }
          onSave={saveRhythm}
          {...(rhythmEditor.rhythm ? { onArchive: archiveRhythm } : {})}
          onClose={() => finishRhythmEditor(false)}
        />
      )}
    </div>
    </TimeBlocksProvider>
    </CategoryAvailabilityProvider>
  );
}

function PlaceholderPage({ destination, onToday }: { destination: Exclude<Destination, 'today'>; onToday: () => void }) {
  return (
    <main className="category-page preview-placeholder" aria-labelledby="placeholder-title">
      <header className="category-page-heading">
        <h2 id="placeholder-title">{destinationLabels[destination]}</h2>
        <span className="hint">This destination is not implemented in this preview.</span>
      </header>
      <section className="card placeholder-card">
        <p className="empty">Only the Today view is active. This preview uses sample data and does not connect to your Tend account.</p>
        <button type="button" className="btn mini" onClick={onToday}>Back to Today</button>
      </section>
    </main>
  );
}
