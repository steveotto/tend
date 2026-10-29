import { useEffect, useRef, useState } from 'react';
import { useScoringInstant } from './components/useScoringInstant.ts';
import type { MouseEvent } from 'react';
import { AppNavigation } from './components/AppNavigation.tsx';
import type { Destination, TextSize } from './components/AppNavigation.tsx';
import {
  MarriageView,
  type CategoryRhythmSuggestion,
  type CategoryRhythmSuggestionCatalogue,
  type MarriageTab
} from './components/MarriageView.tsx';
import { MarriageIcon } from './components/MarriageIcon.tsx';
import { selectActiveUserRhythms, selectArchivedUserRhythms } from './domain/active-user-rhythms.ts';
import { foundationCategoryId, saveFoundationRhythmAssociations } from './domain/foundation-rhythm-associations.ts';
import type { FoundationRhythmAssociationChange } from './domain/foundation-rhythm-associations.ts';
import { selectFoundationRhythmScores } from './domain/foundation-scoring.ts';
import { RhythmDetailsDialog } from './components/RhythmDetailsDialog.tsx';
import { RhythmCompletionDialog } from './components/RhythmCompletionDialog.tsx';
import { FinanceGoalsView } from './components/FinanceGoalsView.tsx';
import { PreviewDataControls } from './components/PreviewDataControls.tsx';
import type { PreviewPersistenceStatus } from './components/PreviewDataControls.tsx';
import { PersonProfileView } from './components/PersonProfileView.tsx';
import { PeopleView } from './components/PeopleView.tsx';
import { RhythmEditor } from './components/RhythmEditor.tsx';
import { TodayView } from './components/TodayView.tsx';
import { HealthFitnessView } from './components/HealthFitnessView.tsx';
import { FriendshipsView } from './components/FriendshipsView.tsx';
import {
  marriageRhythms,
  foundationCatalogue,
  faithRhythmSuggestionGroups,
  faithRhythmSuggestions,
  parentingRhythmSuggestionGroups,
  parentingRhythmSuggestions,
  personById,
  peopleForRhythm,
  todayRhythms,
  type CategoryRhythmSuggestionGroupDefinition,
  type CategoryRhythmSuggestionTemplate,
  type CategoryId,
  type MarriageExampleId,
  type PersonId,
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
import { createSamplePreviewData, parsePreviewBackup } from './domain/preview-state.ts';
import type { PreviewData } from './domain/preview-state.ts';
import type { DatedRhythmCompletion, RhythmCompletionRecord } from './domain/rhythm-completion.ts';
import {
  deleteDatedCompletion,
  removeActionCompletion,
  rhythmCompletionStateForDate
} from './domain/rhythm-completion.ts';
import { resolveSeedCompletionRecords } from './domain/rhythm-history.ts';
import { localDateInTimeZone } from './domain/rhythm-scoring.ts';
import { hasRhythmOccurrenceForCompletion } from './domain/rhythm-occurrences.ts';
import { prepareDatedRhythmCompletion } from './domain/rhythm-completion.ts';
import { validateStrengthData } from './domain/strength.ts';
import type { StrengthMode } from './domain/strength.ts';
import {
  saveWeightDataCommand
} from './domain/weight.ts';
import { saveCardioDataCommand } from './domain/cardio.ts';
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
import { rhythmSchedulesEqual } from './domain/rhythm-occurrences.ts';
import {
  browserPreviewStorage,
  listenForPreviewChanges,
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
const faithSuggestionCatalogue = categorySuggestionCatalogue(
  'faith',
  'Faith practice suggestions',
  faithRhythmSuggestionGroups,
  faithRhythmSuggestions
);

function isDatedCompletionRecord(record: RhythmCompletionRecord): record is DatedRhythmCompletion {
  return typeof record.localTime === 'string'
    && typeof record.timeZone === 'string'
    && typeof record.completedAt === 'string'
    && typeof record.recordedAt === 'string';
}

export function App() {
  const scoringInstant = useScoringInstant();
  const [destination, setDestination] = useState<Destination>('today');
  const [moreSettingsOpen, setMoreSettingsOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData>(createSamplePreviewData);
  const [hydrated, setHydrated] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [persistenceStatus, setPersistenceStatus] = useState<PreviewPersistenceStatus>({ kind: 'loading' });
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
  const expectedRaw = useRef<string | null>(null);
  const externalRaw = useRef<string | null>(null);
  const skipNextAutosave = useRef(false);
  const morePageHeading = useRef<HTMLHeadingElement>(null);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [textSize, setTextSize] = useState<TextSize>('small');
  const [marriageExampleId, setMarriageExampleId] = useState<MarriageExampleId>('populated');
  const [foundationNavigationRequest, setFoundationNavigationRequest] = useState<{
    foundationId: string;
    requestId: number;
    returnTab: 'today' | MarriageTab;
  } | null>(null);
  const foundationNavigationSequence = useRef(0);
  const activeRhythmReturnTab = useRef<'today' | MarriageTab>('today');
  const [profilePersonId, setProfilePersonId] = useState<PersonId | null>(null);
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
  } | null>(null);
  const strengthLogRequestSequence = useRef(0);
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
  const rhythmEditorOpener = useRef<HTMLButtonElement | null>(null);
  const profileOpener = useRef<HTMLElement | null>(null);
  const wasProfileOpen = useRef(false);
  const wasDetailsOpen = useRef(false);
  const wasRhythmEditorOpen = useRef(false);
  const rhythmEditorReturnsToSuggestions = useRef(false);

  const dateLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).format(new Date());
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  function rhythmWithSavedCompletions(rhythm: RhythmPreview): RhythmPreview {
    const seededRecords = resolveSeedCompletionRecords(
      rhythm.completionHistory,
      previewData.rhythmCompletionOverrides,
      previewData.removedSeedCompletionIds
    );
    const datedRecords = previewData.datedRhythmCompletions.filter(item => item.rhythmId === rhythm.id);
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
  const allTodayRhythms = resolveTodayRhythms(previewData.savedRhythms).map(rhythmWithSavedCompletions);
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
  const activeRhythm = [
    ...allTodayRhythms,
    ...resolvedMarriageRhythms
  ].find(rhythm => rhythm.id === activeRhythmId) ?? null;
  const selectedProfilePerson = profilePersonId === null ? null : personById(profilePersonId);
  const profileRhythmCandidates = [...new Map(
    [...editableTodayRhythms, ...userRhythms].map(rhythm => [rhythm.id, rhythm])
  ).values()];
  const archivedProfileRhythmCandidates = [...new Map(
    [...archivedRhythms, ...archivedUserRhythms].map(rhythm => [rhythm.id, rhythm])
  ).values()];
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
  const currentDate = localDateString(new Date());
  const initialLoadDate = useRef(currentDate).current;
  const completionStates = new Map(allTodayRhythms.map(rhythm => {
    const timeZone = rhythm.scoring?.timeZone
      ?? rhythm.createdTimeZone
      ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    const effectiveDate = localDateInTimeZone(new Date(), timeZone);
    const state = rhythmCompletionStateForDate(
      rhythm.id,
      effectiveDate,
      previewData.completedRhythmIds,
      previewData.activeRhythmCompletions,
      (rhythm.completionHistory ?? []).map(record => ({ ...record, rhythmId: rhythm.id }))
    );
    return [rhythm.id, state] as const;
  }));
  const completedRhythms = new Set(
    [...completionStates].filter(([, state]) => state.completed).map(([id]) => id)
  );
  const undoableRhythms = new Set(
    [...completionStates].filter(([, state]) => state.undoable).map(([id]) => id)
  );
  const moneyGoals = previewData.goals;

  function refreshV1RecoveryCopy() {
    const result = loadV1RecoveryCopy(browserPreviewStorage());
    if (result.kind === 'loaded') {
      setV1RecoveryCopy(result.raw);
      setV1RecoveryError(null);
    } else {
      setV1RecoveryCopy(null);
      setV1RecoveryError(result.message);
    }
  }

  function refreshV2RecoveryCopy() {
    const result = loadV2RecoveryCopy(browserPreviewStorage());
    if (result.kind === 'loaded') {
      setV2RecoveryCopy(result.raw);
      setV2RecoveryError(null);
    } else {
      setV2RecoveryCopy(null);
      setV2RecoveryError(result.message);
    }
  }

  function refreshV3RecoveryCopy() {
    const result = loadV3RecoveryCopy(browserPreviewStorage());
    if (result.kind === 'loaded') {
      setV3RecoveryCopy(result.raw);
      setV3RecoveryError(null);
    } else {
      setV3RecoveryCopy(null);
      setV3RecoveryError(result.message);
    }
  }

  function refreshV4RecoveryCopy() {
    const result = loadV4RecoveryCopy(browserPreviewStorage());
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
    const result = loadV5RecoveryCopy(browserPreviewStorage());
    if (result.kind === 'loaded') {
      setV5RecoveryCopy(result.raw);
      setV5RecoveryError(null);
    } else {
      setV5RecoveryCopy(null);
      setV5RecoveryError(result.message);
    }
  }

  function refreshV6RecoveryCopy() {
    const result = loadV6RecoveryCopy(browserPreviewStorage());
    if (result.kind === 'loaded') {
      setV6RecoveryCopy(result.raw);
      setV6RecoveryError(null);
    } else {
      setV6RecoveryCopy(null);
      setV6RecoveryError(result.message);
    }

  }

  function refreshV7RecoveryCopy() {
    const result = loadV7RecoveryCopy(browserPreviewStorage());
    if (result.kind === 'loaded') {
      setV7RecoveryCopy(result.raw);
      setV7RecoveryError(null);
    } else {
      setV7RecoveryCopy(null);
      setV7RecoveryError(result.message);
    }
  }

  function refreshV8RecoveryCopy() {
    const result = loadV8RecoveryCopy(browserPreviewStorage());
    if (result.kind === 'loaded') {
      setV8RecoveryCopy(result.raw);
      setV8RecoveryError(null);
    } else {
      setV8RecoveryCopy(null);
      setV8RecoveryError(result.message);
    }
  }

  function refreshV9RecoveryCopy() {
    const result = loadV9RecoveryCopy(browserPreviewStorage());
    if (result.kind === 'loaded') {
      setV9RecoveryCopy(result.raw);
      setV9RecoveryError(null);
    } else {
      setV9RecoveryCopy(null);
      setV9RecoveryError(result.message);
    }
    refreshV10RecoveryCopy();
  }

  function refreshV10RecoveryCopy() {
    const result = loadV10RecoveryCopy(browserPreviewStorage());
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
    const result = loadV11RecoveryCopy(browserPreviewStorage());
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
    const result = loadV12RecoveryCopy(browserPreviewStorage());
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
    const result = loadV13RecoveryCopy(browserPreviewStorage());
    if (result.kind === 'loaded') {
      setV13RecoveryCopy(result.raw);
      setV13RecoveryError(null);
    } else {
      setV13RecoveryCopy(null);
      setV13RecoveryError(result.message);
    }
    const v14 = loadV14RecoveryCopy(browserPreviewStorage());
    if (v14.kind === 'loaded') {
      setV14RecoveryCopy(v14.raw);
      setV14RecoveryError(null);
    } else {
      setV14RecoveryCopy(null);
      setV14RecoveryError(v14.message);
    }
    const v15 = loadV15RecoveryCopy(browserPreviewStorage());
    if (v15.kind === 'loaded') {
      setV15RecoveryCopy(v15.raw);
      setV15RecoveryError(null);
    } else {
      setV15RecoveryCopy(null);
      setV15RecoveryError(v15.message);
    }
    const v16 = loadV16RecoveryCopy(browserPreviewStorage());
    if (v16.kind === 'loaded') {
      setV16RecoveryCopy(v16.raw);
      setV16RecoveryError(null);
    } else {
      setV16RecoveryCopy(null);
      setV16RecoveryError(v16.message);
    }
    const v17 = loadV17RecoveryCopy(browserPreviewStorage());
    if (v17.kind === 'loaded') {
      setV17RecoveryCopy(v17.raw);
      setV17RecoveryError(null);
    } else {
      setV17RecoveryCopy(null);
      setV17RecoveryError(v17.message);
    }
    const v18 = loadV18RecoveryCopy(browserPreviewStorage());
    if (v18.kind === 'loaded') {
      setV18RecoveryCopy(v18.raw);
      setV18RecoveryError(null);
    } else {
      setV18RecoveryCopy(null);
      setV18RecoveryError(v18.message);
    }
    const v19 = loadV19RecoveryCopy(browserPreviewStorage());
    if (v19.kind === 'loaded') {
      setV19RecoveryCopy(v19.raw);
      setV19RecoveryError(null);
    } else {
      setV19RecoveryCopy(null);
      setV19RecoveryError(v19.message);
    }
  }

  useEffect(() => {
    refreshV1RecoveryCopy();
    refreshV2RecoveryCopy();
    refreshV3RecoveryCopy();
    refreshV4RecoveryCopy();
    refreshV5RecoveryCopy();
    refreshV6RecoveryCopy();
    refreshV7RecoveryCopy();
    refreshV8RecoveryCopy();
    refreshV9RecoveryCopy();
    const loaded = loadPreview(browserPreviewStorage(), initialLoadDate);
    if (loaded.kind === 'loaded') {
      expectedRaw.current = loaded.raw;
      skipNextAutosave.current = true;
      setPreviewData(loaded.data);
      setPersistenceStatus({ kind: 'saved' });
      setAutoSaveEnabled(true);
    } else if (loaded.kind === 'missing') {
      expectedRaw.current = null;
      setPreviewData(createSamplePreviewData());
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
    const saved = writePreview(browserPreviewStorage(), previewData, expectedRaw.current, { currentDate });
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
      setPersistenceStatus({ kind: 'error', message: saved.message });
    }
  }, [previewData, hydrated, autoSaveEnabled]);

  useEffect(() => {
    if (!hydrated) return;
    return listenForPreviewChanges(newValue => {
      if (newValue === expectedRaw.current) return;
      externalRaw.current = newValue;
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'conflict' });
    });
  }, [hydrated]);

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
    if (dialogOpener.current?.isConnected) dialogOpener.current.focus();
    else document.querySelector<HTMLButtonElement>('.utility-primary-button[aria-current="page"]')?.focus();
  }, [activeRhythmId]);

  useEffect(() => {
    if (completionDialogRhythmId !== null) return;
    const opener = completionDialogOpener.current;
    if (opener?.isConnected) {
      if (opener.disabled) {
        opener.closest('article')
          ?.querySelector<HTMLButtonElement>(
            '.today-rhythm-details__history-button, .today-rhythm-card__details-toggle'
          )
          ?.focus();
      } else {
        opener.focus();
      }
    }
    completionDialogOpener.current = null;
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
    if (rhythmEditorOpener.current?.isConnected) rhythmEditorOpener.current.focus();
    else document.querySelector<HTMLButtonElement>('.utility-primary-button[aria-current="page"]')?.focus();
  }, [rhythmEditor]);

  function navigate(next: Destination) {
    setDestination(next);
    setMoreSettingsOpen(false);
    setSearch('');
    setSearchOpen(false);
    document.body.classList.remove('mobile-search-open');
  }

  function openPersonProfile(personId: PersonId) {
    if (profilePersonId === null) {
      profileOpener.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    }
    setProfilePersonId(personId);
  }

  function closePersonProfile() {
    setProfilePersonId(null);
  }

  useEffect(() => {
    if (profilePersonId !== null) {
      wasProfileOpen.current = true;
      return;
    }
    if (wasProfileOpen.current) {
      wasProfileOpen.current = false;
      profileOpener.current?.focus();
    }
  }, [profilePersonId]);

  function navigateToFoundation(foundationId: string, returnTab: 'today' | MarriageTab) {
    const categoryId = foundationCategoryId(foundationId);
    if (!categoryId) return;
    foundationNavigationSequence.current += 1;
    setFoundationNavigationRequest({
      foundationId,
      requestId: foundationNavigationSequence.current,
      returnTab
    });
    navigate(categoryId);
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
      const mode = previewData.strength.rhythmModes.find(item => item.rhythmId === id);
      strengthLogRequestSequence.current += 1;
      setStrengthLogRequest({
        rhythmId: id,
        mode: mode?.mode ?? 'recommended',
        ...(mode?.workoutId ? { workoutId: mode.workoutId } : {}),
        requestId: strengthLogRequestSequence.current
      });
      navigate('health');
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
    returnToSuggestions: (saved: boolean) => void
  ) {
    const rhythm = suggestion.rhythm;
    const initialDraft: RhythmDraft = {
      title: rhythm.title,
      description: rhythm.description ?? '',
      cadence: rhythm.cadence ?? 'Daily',
      timeLabel: rhythm.timeLabel ?? 'Anytime',
      personIds: [],
      categoryIds: [suggestion.categoryId],
      ...(suggestion.recommendedFrequency === 'daily' ? { schedule: { frequency: 'daily' as const } } : {}),
      scheduleEditing: true,
      personal: false,
      primaryFoundationId: rhythm.primaryFoundationId ?? null,
      secondaryFoundationIds: [...(rhythm.secondaryFoundationIds ?? [])]
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
          : {})
      }
    );
    const savedRhythms = result.savedRhythms;
    if (!savedRhythms) return result.errors;
    const nextData: PreviewData = {
      ...previewData,
      savedRhythms,
      ...(!rhythmEditor.rhythm && draft.categoryIds.includes('health')
        ? {
            strength: {
              ...previewData.strength,
              rhythmModes: [
                ...previewData.strength.rhythmModes.filter(item => item.rhythmId !== rhythmEditor.id),
                { rhythmId: rhythmEditor.id, mode: 'recommended' as const }
              ]
            }
          }
        : {}),
      ...(hasDatedCompletionHistory && !previewData.rhythmHistoryIds.includes(rhythmEditor.id)
        ? { rhythmHistoryIds: [...previewData.rhythmHistoryIds, rhythmEditor.id] }
        : {})
    };
    const written = writePreview(browserPreviewStorage(), nextData, expectedRaw.current, { currentDate });
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
      return { title: 'Preview storage changed in another tab. No Rhythm changes were saved.' };
    }
    if (written.kind === 'error') {
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'error', message: written.message });
      return { title: `Preview could not save this Rhythm. ${written.message}` };
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
    const written = writePreview(browserPreviewStorage(), nextData, expectedRaw.current, { currentDate });
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
      setPersistenceStatus({ kind: 'error', message: written.message });
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

  function saveStrengthData(strength: PreviewData['strength']): string | null {
    if (!validateStrengthData(strength)) {
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
        rhythmDraftFrom(rhythm, rhythm.categoryIds ?? []);
      const activeTime = result.activeTimeOfDay ?? rhythm.timeOfDay ?? draft.timeOfDay;
      const saved = saveRhythmDraft(
        sourceRhythms,
        {
          ...baseDraft,
          schedule: result.schedule,
          scheduleEditing: true,
          originalSchedule: currentSchedule,
          timeLabel: rhythmTimeLabel(activeTime),
          seasonName: draft.name
        },
        rhythmId,
        'edit'
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
            timeLabel: rhythmTimeLabel(activeTime)
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
      } = rhythmDraftFrom(rhythm, rhythm.categoryIds ?? []);
      const saved = saveRhythmDraft(
        sourceRhythms,
        {
          ...baseDraft,
          schedule: draft.schedule,
          scheduleEditing: true,
          originalSchedule: currentSchedule,
          timeLabel: rhythmTimeLabel(draft.timeOfDay),
          seasonName: draft.name
        },
        rhythmId,
        'edit'
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
            timeLabel: rhythmTimeLabel(established.activeTimeOfDay ?? draft.timeOfDay),
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
            timeLabel: rhythmTimeLabel(result.activeTimeOfDay)
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
      : rhythmTimeLabel(result.activeTimeOfDay);
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
    const written = writePreview(browserPreviewStorage(), nextData, expectedRaw.current, { currentDate });
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
      setPersistenceStatus({ kind: 'error', message: written.message });
    }
    return result.errors;
  }

  function finishWrite(resultData: PreviewData, allowUnrecoverableReplacement = false): string | null {
    const written = writePreview(browserPreviewStorage(), resultData, expectedRaw.current, {
      allowUnrecoverableReplacement,
      currentDate
    });
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
    setPersistenceStatus({ kind: 'error', message: written.message });
    return written.message;
  }

  function reloadExternal(): string | null {
    const raw = externalRaw.current;
    if (raw === null) {
      expectedRaw.current = null;
      return finishWrite(createSamplePreviewData());
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
    const written = writePreview(browserPreviewStorage(), previewData, externalRaw.current, {
      allowUnrecoverableReplacement: true,
      currentDate
    });
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
    setPersistenceStatus({ kind: 'error', message: written.message });
    return written.message;
  }

  function retrySave() {
    skipNextAutosave.current = true;
    setAutoSaveEnabled(true);
    const written = writePreview(browserPreviewStorage(), previewData, expectedRaw.current, { currentDate });
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
      setPersistenceStatus({ kind: 'error', message: written.message });
    }
  }

  const isPreviewSettings = destination === 'more' && moreSettingsOpen;
  const storageNeedsAttention = ['unavailable', 'error', 'corrupt', 'unsupported', 'conflict']
    .includes(persistenceStatus.kind);

  return (
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
      <div id="view">
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
                    <section className="settings-section" aria-labelledby="preview-data-title">
                      <button
                        type="button"
                        className="btn mini ghost settings-page__back"
                        onClick={() => setMoreSettingsOpen(false)}
                      >
                        ‹ More
                      </button>
                      <h3 id="preview-data-title">Preview data</h3>
                    </section>
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
              </main>
            )
          : destination === 'today'
          ? (
            <TodayView
              greeting={greeting}
              dateLabel={dateLabel}
              completedRhythms={completedRhythms}
              undoableRhythms={undoableRhythms}
              rhythms={editableTodayRhythms}
              rhythmScores={rhythmScoreResults}
              search={search}
              marriageExampleId={marriageExampleId}
              foundations={foundationCatalogue}
              onNavigate={navigate}
              onMarriageExampleChange={setMarriageExampleId}
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
                marriageExampleId={marriageExampleId}
                onMarriageExampleChange={setMarriageExampleId}
                todayDate={currentDate}
                onAddRhythm={event => openRhythmEditor(event)}
                onAddSuggestion={openRhythmSuggestion}
                onPersonSelect={openPersonProfile}
                onPartnerProfile={() => navigate('people')}
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
                onRhythmHistory={openRhythmHistory}
                onEditRhythm={(rhythm, event, returnToSuggestions) => openRhythmEditor(event, rhythm, {
                  ...(returnToSuggestions ? { returnToSuggestions } : {})
                })}
                onRestoreRhythm={restoreRhythm}
                onTend={openCompletion}
                onUndo={undoTend}
                onSaveFoundationAssociations={saveFoundationAssociations}
                foundationNavigationRequest={foundationNavigationRequest}
                onFoundationNavigationHandled={() => setFoundationNavigationRequest(null)}
              />
            )
          : destination === 'parenting'
            ? (
              <MarriageView
                categoryConfig={{
                  categoryId: 'parenting',
                  label: 'Parenting',
                  description: 'Build connection, trust and meaningful memories with your children.',
                  foundations: foundationCatalogue.filter(foundation => foundation.categoryId === 'parenting'),
                  emptyFoundationDescription: 'Ongoing areas of care; scores are unavailable without scored linked Rhythms.',
                  scoreInterpretationNote: 'These scores reflect follow-through on chosen Rhythms. They do not measure a child’s wellbeing or the quality of someone’s parenting.',
                  suggestionCatalogue: parentingSuggestionCatalogue
                }}
                todayDate={currentDate}
                onAddRhythm={event => openRhythmEditor(event, undefined, {
                  initialDraft: createRhythmDraft(['parenting'])
                })}
                onAddSuggestion={openRhythmSuggestion}
                onPersonSelect={openPersonProfile}
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
                onRhythmHistory={openRhythmHistory}
                onEditRhythm={(rhythm, event, returnToSuggestions) => openRhythmEditor(event, rhythm, {
                  ...(returnToSuggestions ? { returnToSuggestions } : {})
                })}
                onRestoreRhythm={restoreRhythm}
                onTend={openCompletion}
                onUndo={undoTend}
                onSaveFoundationAssociations={saveFoundationAssociations}
                foundationNavigationRequest={foundationNavigationRequest}
                onFoundationNavigationHandled={() => setFoundationNavigationRequest(null)}
              />
            )
          : destination === 'faith'
            ? (
              <MarriageView
                categoryConfig={{
                  categoryId: 'faith',
                  label: 'Faith',
                  description: 'Faith practices that help you make room for God in everyday life.',
                  foundations: foundationCatalogue.filter(foundation => foundation.categoryId === 'faith'),
                  foundationTerm: { singular: 'Practice', plural: 'Practices' },
                  tabLabel: 'Practices',
                  emptyFoundationDescription: 'Ongoing practices; scores are unavailable without scored linked Rhythms.',
                  scoreExplanationIntro: 'Your score reflects follow-through on your chosen practices—not the strength of your faith.',
                  suggestionCatalogue: faithSuggestionCatalogue
                }}
                todayDate={currentDate}
                onAddRhythm={event => openRhythmEditor(event, undefined, {
                  initialDraft: createRhythmDraft(['faith'])
                })}
                onAddSuggestion={openRhythmSuggestion}
                onPersonSelect={openPersonProfile}
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
                onRhythmHistory={openRhythmHistory}
                onEditRhythm={(rhythm, event, returnToSuggestions) => openRhythmEditor(event, rhythm, {
                  ...(returnToSuggestions ? { returnToSuggestions } : {})
                })}
                onRestoreRhythm={restoreRhythm}
                onTend={openCompletion}
                onUndo={undoTend}
                onSaveFoundationAssociations={saveFoundationAssociations}
                foundationNavigationRequest={foundationNavigationRequest}
                onFoundationNavigationHandled={() => setFoundationNavigationRequest(null)}
              />
            )
          : destination === 'health'
            ? (
              <HealthFitnessView
                strength={{
                  data: previewData.strength,
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
                  completedRhythmIds: completedRhythms,
                  evaluationDate: currentDate,
                  onChange: saveStrengthData,
                  onAddRhythm: event => openRhythmEditor(event, undefined, {
                    initialDraft: createRhythmDraft(['health'])
                  }),
                  onEditRhythm: (rhythm, event) => openRhythmEditor(event, rhythm),
                  onOpenRhythm: (rhythm, event) => {
                    dialogOpener.current = event.currentTarget;
                    activeRhythmReturnTab.current = 'today';
                    setDetailsInitialView('details');
                    setActiveRhythmId(rhythm.id);
                  },
                  pendingRhythmLog: pendingStrengthRhythmLog,
                  onRhythmLogOpened: requestId => {
                    setStrengthLogRequest(current => current?.requestId === requestId ? null : null);
                  },
                  onRestoreRhythm: restoreRhythm
                }}
                weight={{
                  data: previewData.weight,
                  today: currentDate,
                  rhythms: healthCategoryRhythms,
                  archivedRhythmIds: new Set(previewData.archivedRhythmIds),
                  completedRhythmIds: completedRhythms,
                  datedRhythmCompletions: previewData.datedRhythmCompletions,
                  onChange: saveWeightData,
                  onAddRhythm: event => openRhythmEditor(event, undefined, {
                    initialDraft: createRhythmDraft(['health'])
                  }),
                  onEditRhythm: (rhythm, event) => openRhythmEditor(event, rhythm),
                  onOpenRhythm: (rhythm, event) => {
                    dialogOpener.current = event.currentTarget;
                    activeRhythmReturnTab.current = 'today';
                    setDetailsInitialView('details');
                    setActiveRhythmId(rhythm.id);
                  }
                }}
                cardio={{
                  data: previewData.cardio,
                  today: currentDate,
                  rhythms: healthCategoryRhythms,
                  archivedRhythmIds: new Set(previewData.archivedRhythmIds),
                  completedRhythmIds: completedRhythms,
                  datedRhythmCompletions: previewData.datedRhythmCompletions,
                  onChange: saveCardioData,
                  onAddRhythm: event => openRhythmEditor(event, undefined, {
                    initialDraft: createRhythmDraft(['health'])
                  }),
                  onEditRhythm: (rhythm, event) => openRhythmEditor(event, rhythm),
                  onOpenRhythm: (rhythm, event) => {
                    dialogOpener.current = event.currentTarget;
                    activeRhythmReturnTab.current = 'today';
                    setDetailsInitialView('details');
                    setActiveRhythmId(rhythm.id);
                  }
                }}
              />
            )
          : destination === 'friendships'
            ? (
              <FriendshipsView
                data={previewData.friendships}
                peopleGroups={previewData.peopleGroups}
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
                groups={previewData.peopleGroups}
                onChangeGroups={peopleGroups => setPreviewData(previous => ({ ...previous, peopleGroups }))}
                onOpenPerson={openPersonProfile}
              />
            )
          : <PlaceholderPage destination={destination} onToday={() => navigate('today')} />}
      </div>
      {selectedProfilePerson && (
        <PersonProfileView
          key={selectedProfilePerson.id}
          personId={selectedProfilePerson.id}
          peopleGroups={previewData.peopleGroups}
          friendships={previewData.friendships}
          today={localDateInTimeZone(new Date(), localTimeZone)}
          rhythms={personActiveRhythms}
          archivedRhythms={personArchivedRhythms}
          foundations={foundationCatalogue}
          rhythmScores={rhythmScoreResults}
          completedRhythms={completedRhythms}
          undoableRhythms={undoableRhythms}
          onFriendshipsChange={friendships => setPreviewData(previous => ({ ...previous, friendships }))}
          onAddRhythm={(event, personId) => openRhythmEditor(event, undefined, {
            initialDraft: { ...createRhythmDraft([]), personIds: [personId] }
          })}
          onEditRhythm={(rhythm, event) => openRhythmEditor(event, rhythm)}
          onRhythmHistory={openRhythmHistory}
          onTend={openCompletion}
          onUndo={undoTend}
          onRestoreRhythm={restoreRhythm}
          onOpenFoundation={foundationId => {
            closePersonProfile();
            navigateToFoundation(foundationId, 'today');
          }}
          onOpenCategory={categoryId => {
            closePersonProfile();
            navigate(categoryId);
          }}
          onPersonSelect={openPersonProfile}
          onConnectionChange={friendships => setPreviewData(previous => ({ ...previous, friendships }))}
          onClose={closePersonProfile}
        />
      )}
      <PreviewDataControls
        hidden={!isPreviewSettings}
        data={previewData}
        status={persistenceStatus}
        currentDate={currentDate}
        onImport={data => finishWrite(data, true)}
        onReset={() => finishWrite(createSamplePreviewData(), true)}
        onRetrySave={retrySave}
        onReloadExternal={reloadExternal}
        onReplaceExternal={replaceExternal}
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
      />
      {storageNeedsAttention && !isPreviewSettings && (
        <p className="preview-storage-alert" role="alert">
          Preview data needs attention. Open More → Settings → Preview data to review recovery and storage options.
        </p>
      )}
      <footer className="preview-footer">
        <span>Synthetic preview data stays separate from Tend accounts.</span>
        <a href="/preview.html">Component catalogue</a>
      </footer>
      {activeRhythm && (
        <RhythmDetailsDialog
          key={activeRhythm.id}
          rhythm={activeRhythmForDetails!}
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
          people={peopleForRhythm(activeRhythm)}
          foundations={foundationCatalogue}
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
                ...(undoableRhythms.has(activeRhythm.id) ? { onUndo: () => undoTend(activeRhythm.id) } : {}),
                ...(isEditableRhythmId(activeRhythm.id)
                  ? {
                      onEdit: event => openRhythmEditor(event, activeRhythm)
                    }
                  : {})
              }
            : {
                completed: completedRhythms.has(activeRhythm.id),
                ...(undoableRhythms.has(activeRhythm.id) ? { onUndo: () => undoTend(activeRhythm.id) } : {})
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
          peopleGroups={previewData.peopleGroups}
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
