import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useScoringInstant } from './components/useScoringInstant.ts';
import type { MouseEvent } from 'react';
import { AppNavigation } from './components/AppNavigation.tsx';
import type { CategoryTabNavigationRequest, Destination, TextSize } from './components/AppNavigation.tsx';
import {
  MarriageView,
  createMarriageSuggestionCatalogue,
  type CategoryRhythmSuggestion,
  type CategoryRhythmSuggestionCatalogue,
  type MarriageTab
} from './components/MarriageView.tsx';
import { MarriageIcon } from './components/MarriageIcon.tsx';
import { selectActiveUserRhythms, selectArchivedUserRhythms } from './domain/active-user-rhythms.ts';
import { foundationCategoryId, saveFoundationRhythmAssociations } from './domain/foundation-rhythm-associations.ts';
import type { FoundationRhythmAssociationChange } from './domain/foundation-rhythm-associations.ts';
import { selectFoundationRhythmScores } from './domain/foundation-scoring.ts';
import {
  aggregateCategoryHealthScores,
  selectCardioCategoryScore,
  selectCategoryHealthScore,
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
import type { PreviewAccountBackupApi } from './storage/preview-account-backup.ts';
import { PersonProfileView } from './components/PersonProfileView.tsx';
import { PersonDetailsEditor } from './components/PersonDetailsEditor.tsx';
import { PeopleView } from './components/PeopleView.tsx';
import { RhythmEditor } from './components/RhythmEditor.tsx';
import { TodayView } from './components/TodayView.tsx';
import { TodayWeatherSettings } from './components/TodayWeatherSettings.tsx';
import { TimeBlocksProvider } from './components/TimeBlocksContext.tsx';
import { TimeBlocksSettings } from './components/TimeBlocksSettings.tsx';
import { useTodayWeather } from './components/useTodayWeather.ts';
import type { TodayViewId } from './domain/today-plan.ts';
import { HealthFitnessView } from './components/HealthFitnessView.tsx';
import { FriendshipsView } from './components/FriendshipsView.tsx';
import { connectionCadences, setPersonConnectionCadence } from './domain/friendships.ts';
import { APP_DISPLAY_VERSION } from './domain/app-version.ts';
import { resolvePersonCategory, resolvePersonCategoryGroups, setPersonCategory } from './domain/person-categories.ts';
import {
  areas,
  marriageRhythms,
  foundationCatalogue,
  faithRhythmSuggestionGroups,
  faithRhythmSuggestions,
  healthFitnessRhythmSuggestionGroups,
  healthFitnessRhythmSuggestions,
  parentingRhythmSuggestionGroups,
  parentingRhythmSuggestions,
  personById,
  peopleForRhythm,
  todayRhythms,
  type CategoryRhythmSuggestionGroupDefinition,
  type CategoryRhythmSuggestionTemplate,
  type CategoryId,
  type PersonId,
  type PersonPickerGroupId,
  type PersonPreview,
  type RhythmPreview
} from './domain/preview-data.ts';
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
import type { PreviewData } from './domain/preview-state.ts';
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
import { localDateInTimeZone } from './domain/rhythm-scoring.ts';
import { hasRhythmOccurrenceForCompletion } from './domain/rhythm-occurrences.ts';
import { selectSatisfiedRhythmIds, selectTendedRhythmDisplayIds } from './domain/category-rhythms.ts';
import { prepareDatedRhythmCompletion } from './domain/rhythm-completion.ts';
import { selectPersonOverallHealth, selectPersonRhythmHealth } from './domain/person-health.ts';
import { validateStrengthData } from './domain/strength.ts';
import type { StrengthMode } from './domain/strength.ts';
import {
  saveWeightDataCommand
} from './domain/weight.ts';
import { saveCardioDataCommand, selectCardioProgress } from './domain/cardio.ts';
import {
  selectFlexibilityConsistency,
  selectFlexibilityRegionScores,
  validateFlexibilityData
} from './domain/flexibility.ts';
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
  type RhythmFrequencyRecommendation
} from './domain/rhythm-schedule.ts';
import {
  assignedTimeBlockIds,
  rhythmTimeOptionsForBlocks,
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
  loadCloudRestoreRecoveryCopy,
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
  parenting: 'Parenting',
  health: 'Health & Fitness',
  finances: 'Finances',
  friendships: 'Friendships'
};
const personProfileHistoryKey = 'tendPersonProfileId';

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
const marriageSuggestionCatalogue = createMarriageSuggestionCatalogue(marriageRhythms);
const faithSuggestionCatalogue = categorySuggestionCatalogue(
  'faith',
  'Faith practice suggestions',
  faithRhythmSuggestionGroups,
  faithRhythmSuggestions
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
  const scoringInstant = useScoringInstant();
  const previewStorage = useMemo(() => browserPreviewStorage(identity), [identity]);
  const initialPreviewData = () => identity.kind === 'development'
    && import.meta.env.DEV
    ? createSamplePreviewData()
    : createEmptyPreviewData();
  const [destination, setDestination] = useState<Destination>('today');
  const [moreSettingsOpen, setMoreSettingsOpen] = useState(false);
  const weatherTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const todayWeather = useTodayWeather(
    destination === 'today' || (destination === 'more' && moreSettingsOpen),
    weatherTimeZone
  );
  const [healthFitnessVisited, setHealthFitnessVisited] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData>(initialPreviewData);
  const [freshInitialData, setFreshInitialData] = useState<PreviewData | null>(null);
  const localIsPristine = useMemo(
    () => isPreviewDataPristine(previewData, freshInitialData ?? initialPreviewData()),
    [freshInitialData, previewData]
  );
  const [manualBackupLocked, setManualBackupLocked] = useState(false);
  const [accountSyncTarget, setAccountSyncTarget] = useState<HTMLDivElement | null>(null);
  const [persistedSatisfiedRhythmIds, setPersistedSatisfiedRhythmIds] = useState<ReadonlySet<string>>(new Set());
  const [persistedCompletedRhythmIds, setPersistedCompletedRhythmIds] = useState<ReadonlySet<string>>(new Set());
  const configuredRhythmTimeOptions = rhythmTimeOptionsForBlocks(previewData.timeBlocks);
  const [hydrated, setHydrated] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [persistenceStatus, setPersistenceStatus] = useState<PreviewPersistenceStatus>({ kind: 'loading' });
  const [rawRecoveryCopy, setRawRecoveryCopy] = useState<string | null>(null);
  const [rawRecoveryError, setRawRecoveryError] = useState<string | null>(null);
  const [cloudRestoreRecoveryCopy, setCloudRestoreRecoveryCopy] = useState<string | null>(null);
  const [cloudRestoreRecoveryError, setCloudRestoreRecoveryError] = useState<string | null>(null);
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
  const expectedRaw = useRef<string | null>(null);
  const externalRaw = useRef<string | null>(null);
  const skipNextAutosave = useRef(false);
  const morePageHeading = useRef<HTMLHeadingElement>(null);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [textSize, setTextSize] = useState<TextSize>('small');
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
  const parentingCategoryRhythms = rhythmsForCategory(userRhythms, 'parenting');
  const faithCategoryRhythms = rhythmsForCategory(userRhythms, 'faith');
  const healthCategoryRhythms = rhythmsForCategory(userRhythms, 'health');
  const friendshipCategoryRhythms = rhythmsForCategory(userRhythms, 'friendships');
  const archivedMarriageRhythms = rhythmsForCategory(archivedUserRhythms, 'marriage');
  const archivedParentingRhythms = rhythmsForCategory(archivedUserRhythms, 'parenting');
  const archivedFaithRhythms = rhythmsForCategory(archivedUserRhythms, 'faith');
  const archivedHealthRhythms = rhythmsForCategory(archivedUserRhythms, 'health');
  const archivedFriendshipRhythms = rhythmsForCategory(archivedUserRhythms, 'friendships');
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
    localTimeZone
  );
  const categoryRhythms = {
    faith: faithCategoryRhythms,
    marriage: marriageCategoryRhythms,
    parenting: parentingCategoryRhythms
  } as const;
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
  const flexibilityRegionScores = selectFlexibilityRegionScores(
    previewData.flexibility,
    localDateString(scoringInstant)
  );
  const flexibilityConsistency = selectFlexibilityConsistency(flexibilityRegionScores);
  const flexibilityCategoryScore = {
    foundationIds: ['health-flexibility'],
    eligibleFoundationIds: flexibilityConsistency.score === null ? [] : ['health-flexibility'],
    excludedFoundationIds: [],
    unresolvedFoundationIds: [],
    consistency: flexibilityConsistency.score,
    onTrack: null,
    health: flexibilityConsistency.score
  };
  const healthFitnessCategoryScore = selectHealthFitnessCategoryScore(
    cardioCategoryScore,
    weightCategoryScore,
    strengthCategoryScore,
    flexibilityCategoryScore
  );
  const categoryHealthScores = new Map<CategoryId, number | null>(
    [
      ...(['faith', 'marriage', 'parenting'] as const).map(categoryId => [
        categoryId,
        selectCategoryHealthScore(
          foundationCatalogue.filter(foundation => foundation.categoryId === categoryId),
          categoryRhythms[categoryId],
          rhythmScoreResults,
          previewData.archivedRhythmIds
        ).health
      ] as const),
      ['health', healthFitnessCategoryScore.health]
    ]
  );
  const overallHealthScore = aggregateCategoryHealthScores(
    areas.map(area => categoryHealthScores.get(area.id) ?? null)
  ).health;
  const activeRhythm = [
    ...allTodayRhythms,
    ...resolvedMarriageRhythms
  ].find(rhythm => rhythm.id === activeRhythmId) ?? null;
  const peopleWithPhotos = peopleWithSavedPhotos(previewData.people, previewData.personDetails);
  const selectedProfilePerson = profilePersonId === null ? null : personById(peopleWithPhotos, profilePersonId) ?? null;
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
  const selectedProfileCategory = selectedProfilePerson
    ? resolvePersonCategory(
        resolvedPeopleGroups
          .filter(group => group.memberIds.includes(selectedProfilePerson.id))
          .map(group => group.id)
      )
    : null;
  const selectedProfileSuggestionCatalogue = selectedProfileCategory === 'marriage'
    ? marriageSuggestionCatalogue
    : selectedProfileCategory === 'parenting'
      ? parentingSuggestionCatalogue
      : undefined;
  const profileRhythmCandidates = [...new Map(
    [...editableTodayRhythms, ...userRhythms].map(rhythm => [rhythm.id, rhythm])
  ).values()];
  const archivedProfileRhythmCandidates = [...new Map(
    [...archivedRhythms, ...archivedUserRhythms].map(rhythm => [rhythm.id, rhythm])
  ).values()];
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
    return [person.id, selectPersonOverallHealth(rhythmHealth).health] as const;
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
      skipNextAutosave.current = true;
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
  }, [destination, moreSettingsOpen]);

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
      const focusTendedToggle = () => {
        const toggles = [...document.querySelectorAll<HTMLButtonElement>('.show-tended-list__toggle')];
        const toggle = toggles.find(item => item.closest('[hidden]') === null) ?? toggles[0];
        toggle?.focus({ preventScroll: true });
      };
      if (opener?.isConnected) {
        if (opener.disabled) {
          const replacement = opener.closest('article')
            ?.querySelector<HTMLButtonElement>(
              '.today-rhythm-details__history-button, .today-rhythm-card__details-toggle'
            );
          if (replacement) replacement.focus({ preventScroll: true });
          else focusTendedToggle();
        } else {
          opener.focus({ preventScroll: true });
        }
      } else {
        focusTendedToggle();
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
      && (next === 'faith' || next === 'marriage' || next === 'parenting' || next === 'health')) {
      categoryTabNavigationSequence.current += 1;
      setCategoryTabNavigationRequest({
        categoryId: next,
        requestId: categoryTabNavigationSequence.current
      });
    } else if (!categoryTabDefault) {
      setCategoryTabNavigationRequest(null);
    }
    setDestination(next);
    if (next === 'health') setHealthFitnessVisited(true);
    setMoreSettingsOpen(false);
    setSearch('');
    setSearchOpen(false);
    document.body.classList.remove('mobile-search-open');
  }

  function openPersonProfile(personId: PersonId) {
    if (profilePersonId === personId) return;
    if (profilePersonId === null) {
      profileOpener.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
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
    event: MouseEvent<HTMLButtonElement>,
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
    rhythmEditorOpener.current = event.currentTarget;
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
    const result = saveRhythmDraft(
      previewData.savedRhythms,
      draft,
      rhythmEditor.id,
      rhythmEditor.rhythm ? 'edit' : 'create',
      {
        currentDate: localDateInTimeZone(new Date(), scoringTimeZone),
        deviceTimeZone: scoringTimeZone,
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
        timeOptions: configuredRhythmTimeOptions
      },
      previewData.people.map(person => person.id)
    );
    const savedRhythms = result.savedRhythms;
    if (!savedRhythms) return result.errors;
    const nextData: PreviewData = {
      ...previewData,
      savedRhythms,
      ...(draft.categoryIds.includes('health')
        && (draft.healthLogCapability === 'workout'
          || !rhythmEditor.rhythm)
        ? {
            strength: {
              ...previewData.strength,
              rhythmModes: [
                ...previewData.strength.rhythmModes.filter(item => item.rhythmId !== rhythmEditor.id),
                {
                  rhythmId: rhythmEditor.id,
                  mode: draft.healthLogCapability === 'workout'
                    ? draft.healthWorkoutMode ?? 'recommended'
                    : 'recommended',
                  ...(draft.healthWorkoutMode === 'specific' && draft.healthWorkoutId
                    ? { workoutId: draft.healthWorkoutId }
                    : {})
                }
              ]
            }
          }
        : {}),
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
      setPersistenceStatus({
        kind: 'error',
        message: written.message,
        ...(written.diagnostic ? { diagnostic: written.diagnostic } : {})
      });
      return `Preview could not save this ${action}. ${written.message}`;
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

  function saveStrengthData(strength: PreviewData['strength']): string | null {
    if (!validateStrengthData(strength, true, true, true, true, previewData.people.map(person => person.id))) {
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
      if (!rhythm || !isEditableRhythmId(log.rhythmId)
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
      if (ownsCompletion && existingCompletion && previous?.rhythmId === log.rhythmId
        && previous.rhythmOccurrence === log.rhythmOccurrence && previous.date === log.date) continue;
      const schedule = effectiveRhythmSchedule(rhythm.schedule, rhythm.cadence);
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
    if (!validateFlexibilityData(flexibility, currentDate)) {
      return 'Flexibility settings or stretch records are invalid. No changes were saved.';
    }
    let datedRhythmCompletions = [...previewData.datedRhythmCompletions];
    let activeRhythmCompletions = [...previewData.activeRhythmCompletions];
    let completedRhythmIds = [...previewData.completedRhythmIds];
    let rhythmHistoryIds = [...previewData.rhythmHistoryIds];
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
      flexibility,
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
        { timeOptions: configuredRhythmTimeOptions },
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
        { timeOptions: configuredRhythmTimeOptions },
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

  function saveDatedCompletion(candidate: RhythmCompletionRecord, source: 'tend' | 'history' = 'tend'): string | null {
    if (!isDatedCompletionRecord(candidate)) {
      return 'A new completion must include its selected local time. No completion was saved.';
    }
    const record = candidate;
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
    setPreviewData(previous => {
      if (isTendAction && completedRhythms.has(record.rhythmId)) return previous;
      return {
        ...previous,
        datedRhythmCompletions: [...previous.datedRhythmCompletions, record],
        rhythmHistoryIds: previous.rhythmHistoryIds.includes(record.rhythmId)
          ? previous.rhythmHistoryIds
          : [...previous.rhythmHistoryIds, record.rhythmId],
        ...(isTendAction
          ? {
              completedRhythmIds: previous.completedRhythmIds.includes(record.rhythmId)
                ? previous.completedRhythmIds
                : [...previous.completedRhythmIds, record.rhythmId],
              activeRhythmCompletions: [
                ...previous.activeRhythmCompletions.filter(item => item.rhythmId !== record.rhythmId),
                { rhythmId: record.rhythmId, completionId: record.id }
              ]
            }
          : {})
      };
    });
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
      setPreviewData(previous => ({
        ...previous,
        datedRhythmCompletions: previous.datedRhythmCompletions.map(item =>
          item.id === record.id && item.rhythmId === record.rhythmId
            ? { ...record, recordedAt: item.recordedAt }
            : item
        )
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
        completedRhythmIds: result.completedRhythmIds
      };
    });
    return null;
  }

  function undoTend(id: string) {
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
      return {
        ...previous,
        datedRhythmCompletions: reversed.records,
        activeRhythmCompletions: reversed.active,
        completedRhythmIds: [
          ...previous.completedRhythmIds.slice(0, completionIndex),
          ...previous.completedRhythmIds.slice(completionIndex + 1)
        ]
      };
    });
  }

  function setShowTendedPreference(showTended: boolean) {
    setPreviewData(previous => previous.showTended === showTended
      ? previous
      : { ...previous, showTended });
  }

  function setTodayViewPreference(todayView: TodayViewId) {
    setPreviewData(previous => previous.todayView === todayView
      ? previous
      : { ...previous, todayView });
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
    operation: 'save' | 'import' | 'reset' | 'replace' = 'save',
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

  const isPreviewSettings = destination === 'more' && moreSettingsOpen;
  const storageNeedsAttention = ['unavailable', 'error', 'corrupt', 'unsupported', 'conflict']
    .includes(persistenceStatus.kind);

  const healthFitnessView = hydrated && (healthFitnessVisited || destination === 'health') ? (
    <HealthFitnessView
      people={peopleWithPhotos}
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
            ...(setting?.workoutId ? { workoutId: setting.workoutId } : {})
          };
        }),
        archivedRhythms: archivedHealthRhythms,
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
      showTended={previewData.showTended}
      onShowTendedChange={setShowTendedPreference}
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
    <TimeBlocksProvider settings={previewData.timeBlocks}>
    <div className="wrap tend-app-preview" data-text-size={textSize}>
      <AppNavigation
        destination={destination}
        search={search}
        searchOpen={searchOpen}
        textSize={textSize}
        onNavigate={navigate}
        onSearchChange={setSearch}
        onSearchClose={closeSearch}
        onSearchToggle={toggleSearch}
        onTextSizeChange={() => setTextSize(size => size === 'small' ? 'medium' : size === 'medium' ? 'large' : 'small')}
      />
        {identity.kind === 'authenticated' && (
          <PreviewAccountSync
            portalTarget={accountSyncTarget}
            api={accountBackupApi ?? null}
            accountId={identity.accountId}
            authRefreshSequence={authRefreshSequence}
            storage={previewStorage}
            data={previewData}
            localIsPristine={localIsPristine}
            currentDate={currentDate}
            localRaw={expectedRaw.current}
            localRecoveryRaw={cloudRestoreRecoveryCopy}
            localRecoveryError={cloudRestoreRecoveryError}
            enabled={hydrated && autoSaveEnabled && persistenceStatus.kind === 'saved'}
            autoSyncEnabled={import.meta.env.VITE_TEND_PREVIEW_AUTO_SYNC_ENABLED === 'true'}
            visible={destination === 'more' && !moreSettingsOpen}
            manualOperationLocked={manualBackupLocked}
            isIdentityCurrent={() => isIdentityCurrent()
              && (isAccountBackupIdentityCurrent?.() ?? true)}
            onRestore={(data, expectedLocalRaw) => {
              if (!isIdentityCurrent()) {
                return 'Preview identity changed. No local data was replaced.';
              }
              if (expectedRaw.current !== expectedLocalRaw) {
                return 'This browser’s preview changed after confirmation. No local data was replaced.';
              }
              const writeError = finishWrite(data, false, 'replace');
              if (!writeError) refreshCloudRestoreRecoveryCopy();
              return writeError;
            }}
            onManualOperationLockChange={setManualBackupLocked}
          />
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
                {moreSettingsOpen
                  ? (
                    <>
                      <button
                        type="button"
                        className="btn mini ghost settings-page__back"
                        onClick={() => setMoreSettingsOpen(false)}
                      >
                        ‹ More
                      </button>
                      <section className="settings-section" aria-labelledby="weather-settings-title">
                        <h3 id="weather-settings-title">Weather</h3>
                        <TodayWeatherSettings controller={todayWeather} timeZone={weatherTimeZone} />
                      </section>
                      <section className="settings-section" aria-labelledby="time-block-settings-title">
                        <h3 id="time-block-settings-title">Time blocks</h3>
                        <TimeBlocksSettings
                          settings={previewData.timeBlocks}
                          assignedBlockIds={assignedTimeBlockIds(previewData.savedRhythms)}
                          onSave={saveTimeBlockSettings}
                        />
                      </section>
                      <section className="settings-section" aria-labelledby="preview-data-title">
                      <h3 id="preview-data-title">Preview data</h3>
                      </section>
                    </>
                  )
                  : (
                    <section className="settings-section" aria-label="More options">
                      <button
                        type="button"
                        className="settings-link"
                        onClick={() => setMoreSettingsOpen(true)}
                      >
                        <span>Settings</span>
                        <span aria-hidden="true">›</span>
                      </button>
                    </section>
                  )}
                {!moreSettingsOpen && identity.kind === 'authenticated' && (
                  <PreviewBackupImportControl
                    data={previewData}
                    status={persistenceStatus}
                    currentDate={currentDate}
                    onImport={(data, sourceRaw) => finishWrite(data, true, 'import', sourceRaw)}
                    recoveryRaw={importRecoveryCopy}
                    recoverySourceRaw={importRecoverySourceCopy}
                    recoveryArchiveRaw={importRecoveryArchive}
                    recoveryError={importRecoveryError}
                  />
                )}
                {!moreSettingsOpen && <div className="preview-account-sync-slot" ref={setAccountSyncTarget} />}
                {!moreSettingsOpen && (
                  <p className="settings-page__version">Version {APP_DISPLAY_VERSION}</p>
                )}
              </main>
            )
          : destination === 'today'
          ? (
            <TodayView
              people={peopleWithPhotos}
              greeting={greeting}
              evaluationInstant={scoringInstant}
              localDate={currentDate}
              view={previewData.todayView}
              onViewChange={setTodayViewPreference}
              weatherController={todayWeather}
              completedRhythms={completedRhythms}
              undoableRhythms={undoableRhythms}
              satisfiedRhythmIds={satisfiedRhythmIds}
              tendedRhythmIds={tendedRhythmIds}
              showTended={previewData.showTended}
              onShowTendedChange={setShowTendedPreference}
              initializing={!hydrated}
              rhythms={editableTodayRhythms}
              rhythmScores={rhythmScoreResults}
              search={search}
              categoryHealthScores={categoryHealthScores}
              foundations={foundationCatalogue}
              onNavigate={navigate}
              onOpenFoundation={foundationId => navigateToFoundation(foundationId, 'today')}
              onPersonSelect={openPersonProfile}
              onHistory={openRhythmHistory}
              onTend={openCompletion}
              onEditRhythm={(rhythm, event) => openRhythmEditor(event, rhythm)}
              onUndo={undoTend}
            />
          )
          : destination === 'marriage'
            ? (
              <MarriageView
                people={peopleWithPhotos}
                peopleGroups={resolvedPeopleGroups}
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
                onOpenPeople={() => navigate('people')}
                onOpenCategory={categoryId => navigate(categoryId)}
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
                showTended={previewData.showTended}
                onShowTendedChange={setShowTendedPreference}
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
                onOpenPeople={() => navigate('people')}
                onOpenCategory={categoryId => navigate(categoryId)}
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
                showTended={previewData.showTended}
                onShowTendedChange={setShowTendedPreference}
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
                onOpenPeople={() => navigate('people')}
                onOpenCategory={categoryId => navigate(categoryId)}
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
                showTended={previewData.showTended}
                onShowTendedChange={setShowTendedPreference}
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
              <FriendshipsView
                data={previewData.friendships}
                people={peopleWithPhotos}
                peopleGroups={resolvedPeopleGroups}
                personDetails={previewData.personDetails}
                healthScores={personOverallHealthScores}
                today={localDateInTimeZone(new Date(), localTimeZone)}
                rhythms={friendshipCategoryRhythms}
                archivedRhythms={archivedFriendshipRhythms}
                foundations={foundationCatalogue}
                rhythmScores={rhythmScoreResults}
                completedRhythms={completedRhythms}
                undoableRhythms={undoableRhythms}
                onChange={friendships => setPreviewData(previous => ({ ...previous, friendships }))}
                onAddRhythm={event => openRhythmEditor(event, undefined, {
                  initialDraft: createRhythmDraft(['friendships'])
                })}
                onEditRhythm={(rhythm, event) => openRhythmEditor(event, rhythm)}
                onTend={openCompletion}
                onUndo={id => undoTend(id)}
                onPersonSelect={openPersonProfile}
                onGoToPeople={() => navigate('people')}
                onRhythmHistory={openRhythmHistory}
                onOpenFoundation={foundationId => navigateToFoundation(foundationId, 'today')}
                onOpenCategory={categoryId => navigate(categoryId)}
                onRestoreRhythm={restoreRhythm}
                profileOpen={profilePersonId !== null}
              />
            )
          : destination === 'finances'
            ? (
              <FinanceGoalsView
                goals={moneyGoals}
                currentDate={currentDate}
                onSaveGoal={saveGoal}
                onSaveCheckIn={saveGoalCheckIn}
                onToday={() => navigate('today')}
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
                onOpenPerson={openPersonProfile}
                onCreatePerson={createPerson}
              />
            )
          : <PlaceholderPage destination={destination} onToday={() => navigate('today')} />}
      </div>
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
          showTended={previewData.showTended}
          onShowTendedChange={setShowTendedPreference}
          initializing={!hydrated}
          onFriendshipsChange={friendships => setPreviewData(previous => ({ ...previous, friendships }))}
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
      <PreviewDataControls
        hidden={!isPreviewSettings}
        data={previewData}
        status={persistenceStatus}
        currentDate={currentDate}
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
        v1RecoveryCopy={v1RecoveryCopy}
        v1RecoveryError={v1RecoveryError}
        v2RecoveryCopy={v2RecoveryCopy}
        v2RecoveryError={v2RecoveryError}
        v3RecoveryCopy={v3RecoveryCopy}
        v3RecoveryError={v3RecoveryError}
        v4RecoveryCopy={v4RecoveryCopy}
        v4RecoveryError={v4RecoveryError}
        v5RecoveryCopy={v5RecoveryCopy}
        v5RecoveryError={v5RecoveryError}
        v6RecoveryCopy={v6RecoveryCopy}
        v6RecoveryError={v6RecoveryError}
        v7RecoveryCopy={v7RecoveryCopy}
        v7RecoveryError={v7RecoveryError}
        v8RecoveryCopy={v8RecoveryCopy}
        v8RecoveryError={v8RecoveryError}
        v9RecoveryCopy={v9RecoveryCopy}
        v9RecoveryError={v9RecoveryError}
        v10RecoveryCopy={v10RecoveryCopy}
        v10RecoveryError={v10RecoveryError}
        v11RecoveryCopy={v11RecoveryCopy}
        v11RecoveryError={v11RecoveryError}
        v12RecoveryCopy={v12RecoveryCopy}
        v12RecoveryError={v12RecoveryError}
        v13RecoveryCopy={v13RecoveryCopy}
        v13RecoveryError={v13RecoveryError}
        v14RecoveryCopy={v14RecoveryCopy}
        v14RecoveryError={v14RecoveryError}
        v15RecoveryCopy={v15RecoveryCopy}
        v15RecoveryError={v15RecoveryError}
        v16RecoveryCopy={v16RecoveryCopy}
        v16RecoveryError={v16RecoveryError}
        v17RecoveryCopy={v17RecoveryCopy}
        v17RecoveryError={v17RecoveryError}
        v18RecoveryCopy={v18RecoveryCopy}
        v18RecoveryError={v18RecoveryError}
        v19RecoveryCopy={v19RecoveryCopy}
        v19RecoveryError={v19RecoveryError}
        v20RecoveryCopy={v20RecoveryCopy}
        v20RecoveryError={v20RecoveryError}
        v21RecoveryCopy={v21RecoveryCopy}
        v21RecoveryError={v21RecoveryError}
        v22RecoveryCopy={v22RecoveryCopy}
        v22RecoveryError={v22RecoveryError}
        v23RecoveryCopy={v23RecoveryCopy}
        v23RecoveryError={v23RecoveryError}
        v24RecoveryCopy={v24RecoveryCopy}
        v24RecoveryError={v24RecoveryError}
        v25RecoveryCopy={v25RecoveryCopy}
        v25RecoveryError={v25RecoveryError}
        v26RecoveryCopy={v26RecoveryCopy}
        v26RecoveryError={v26RecoveryError}
        v27RecoveryCopy={v27RecoveryCopy}
        v27RecoveryError={v27RecoveryError}
        v28RecoveryCopy={v28RecoveryCopy}
        v28RecoveryError={v28RecoveryError}
        v29RecoveryCopy={v29RecoveryCopy}
        v29RecoveryError={v29RecoveryError}
        v30RecoveryCopy={v30RecoveryCopy}
        v30RecoveryError={v30RecoveryError}
        v31RecoveryCopy={v31RecoveryCopy}
        v31RecoveryError={v31RecoveryError}
        v32RecoveryCopy={v32RecoveryCopy}
        v32RecoveryError={v32RecoveryError}
        v33RecoveryCopy={v33RecoveryCopy}
        v33RecoveryError={v33RecoveryError}
        v34RecoveryCopy={v34RecoveryCopy}
        v34RecoveryError={v34RecoveryError}
        v35RecoveryCopy={v35RecoveryCopy}
        v35RecoveryError={v35RecoveryError}
        v36RecoveryCopy={v36RecoveryCopy}
        v36RecoveryError={v36RecoveryError}
      />
      {storageNeedsAttention && !isPreviewSettings && (
        <p className="preview-storage-alert" role="alert">
          {persistenceStatus.kind === 'error'
            ? 'Preview data was not saved on this device. Your changes remain in this tab; open More → Settings → Preview data to retry before leaving.'
            : persistenceStatus.kind === 'conflict'
              ? 'Another tab changed the saved preview. Your current changes remain here until you choose how to resolve it.'
              : 'Preview data needs attention. Open More → Settings → Preview data to review recovery and storage options.'}
        </p>
      )}
      <footer className="preview-footer">
        <span>
          {import.meta.env.MODE === 'pages'
            ? 'Preview data saves on this device first; when signed in, changes sync to your account while connected.'
            : 'Synthetic preview data stays separate from Tend accounts.'}
        </span>
        {import.meta.env.MODE !== 'pages' && <a href="/preview.html">Component catalogue</a>}
        <a href="https://steveotto.github.io/tend/">Open Tend Classic</a>
        {onSignOut && (
          <button type="button" className="preview-sign-out" onClick={() => {
            if ((persistenceStatus.kind === 'error' || persistenceStatus.kind === 'conflict')
              && !window.confirm('Preview changes are not saved. Sign out anyway? The current tab draft will not be transferred.')) return;
            void onSignOut();
          }}>
            Sign out
          </button>
        )}
      </footer>
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
            ? { onLogCompletion: record => saveDatedCompletion(record, 'history') }
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
                    ...(setting?.workoutId ? { workoutId: setting.workoutId } : {})
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
