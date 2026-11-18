import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { FitnessScoreSummary } from './FitnessScoreSummary.tsx';
import type { HealthAggregateEvidence } from './HealthScoringDetailsCard.tsx';
import { createHealthFitnessRollup } from './HealthRollupDiagram.tsx';
import { SegmentedTabs } from './SegmentedTabs.tsx';
import type { SegmentedTab } from './SegmentedTabs.tsx';
import { FoundationSectionHeading } from './FoundationSectionHeading.tsx';
import { FoundationRoutineSummary } from './FoundationRoutineSummary.tsx';
import { FoundationRhythmGroup } from './FoundationRhythmGroup.tsx';
import { FoundationRhythmAssociationDialog } from './FoundationRhythmAssociationDialog.tsx';
import { FitnessBodyMapLayout } from './FitnessBodyMap.tsx';
import type { FitnessBodyMapConfigFor } from './FitnessBodyMap.tsx';
import { FlexibilityGuidedSessionDialog } from './FlexibilityGuidedSessionDialog.tsx';
import { FlexibilityRoutineEditorDialog } from './FlexibilityRoutineEditorDialog.tsx';
import { RhythmCalendarIcon } from './RhythmCalendarIcon.tsx';
import { RhythmMetadataIcon } from './RhythmMetadataIcon.tsx';
import { ToolZone } from './ToolZone.tsx';
import { SettingsGearButton } from './SettingsGearButton.tsx';
import { StyledSelect } from './StyledSelect.tsx';
import type { Destination } from './AppNavigation.tsx';
import type { FoundationRhythmAssociationChange } from '../domain/foundation-rhythm-associations.ts';
import { foundationRhythmIds } from '../domain/foundation-rhythm-associations.ts';
import type { RhythmScoreResult } from '../domain/rhythm-scoring.ts';
import {
  clearFlexibilityDraft,
  createFlexibilityGuidedSession,
  deleteFlexibilityRoutine,
  deleteFlexibilitySession,
  estimateFlexibilityRoutineSeconds,
  flexibilityRegions,
  flexibilityRoutineSuggestions,
  finishFlexibilityGuidedSession,
  migrateFlexibilityData,
  saveFlexibilityDraft,
  saveFlexibilityRoutine,
  saveFlexibilitySession,
  selectFlexibilityRegionStatuses,
  suggestNextFlexibilityStretch
} from '../domain/flexibility.ts';
import type {
  FlexibilityData,
  FlexibilityGuidedSessionDraft,
  FlexibilityRegionId,
  FlexibilityRegionStatus,
  FlexibilitySession,
  FlexibilitySessionDraft,
  SavedFlexibilityRoutine
} from '../domain/flexibility.ts';
import type { CategoryScoreSelection } from '../domain/category-scoring.ts';
import {
  foundationCatalogue,
  syntheticPeople
} from '../domain/preview-data.ts';
import type {
  FoundationPreview,
  PersonId,
  PersonPreview,
  RhythmPreview
} from '../domain/preview-data.ts';

type DialogState = 'log' | 'settings' | 'guided' | null;
type FlexibilityTab = 'body' | 'routines' | 'rhythms';
const flexibilityTabs = [
  { id: 'body', label: 'Body', tabId: 'flexibility-tab-body', panelId: 'flexibility-panel-body' },
  { id: 'routines', label: 'Routines', tabId: 'flexibility-tab-routines', panelId: 'flexibility-panel-routines' },
  { id: 'rhythms', label: 'Rhythms', tabId: 'flexibility-tab-rhythms', panelId: 'flexibility-panel-rhythms' }
] as const satisfies readonly SegmentedTab<FlexibilityTab>[];

export type FlexibilityViewProps = {
  data: FlexibilityData;
  today: string;
  onChange: (data: FlexibilityData) => string | null;
  healthScore: CategoryScoreSelection;
  scoringEvidence: HealthAggregateEvidence;
  unlinkedStretchRhythmTitles: readonly string[];
  overallHealthScore?: number | null;
  categoryHealthScore?: number | null;
  foundationNavigation?: boolean;
  foundationActive?: boolean;
  people?: readonly PersonPreview[];
  rhythms?: readonly RhythmPreview[];
  archivedRhythms?: readonly RhythmPreview[];
  foundations?: readonly FoundationPreview[];
  rhythmScores?: ReadonlyMap<string, RhythmScoreResult>;
  completedRhythms?: ReadonlySet<string>;
  undoableRhythms?: ReadonlySet<string>;
  onAddLinkedRhythm?: (foundationId: string, event: MouseEvent<HTMLButtonElement>) => void;
  onSaveFoundationAssociations?: (
    foundationId: string,
    changes: readonly FoundationRhythmAssociationChange[]
  ) => string | null;
  onRhythmHistory?: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onEditRhythm?: (rhythm: RhythmPreview, event: MouseEvent<HTMLButtonElement>) => void;
  onTend?: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onUndo?: (id: string) => void;
  onPersonSelect?: (personId: PersonId) => void;
  onOpenFoundation?: (foundationId: string, openerId: string) => void;
  onOpenCategory?: (categoryId: Destination, openerId: string) => void;
  pendingQuickLog?: {
    requestId: number;
    regionIds: readonly FlexibilityRegionId[];
    linkedRhythmId?: string;
    rhythmOccurrence?: string;
    rhythmTitle?: string;
    opener?: HTMLButtonElement;
  } | null;
  onQuickLogOpened?: (requestId: number) => void;
  onLogRequestClosed?: () => void;
};

const defaultDraft = (today: string, regionIds: readonly FlexibilityRegionId[] = []): FlexibilitySessionDraft => ({
  date: today,
  regionIds: [...regionIds],
  minutes: '',
  notes: ''
});

const flexibilityBodyMapOrder: readonly FlexibilityRegionId[] = [
  'neck', 'shoulders', 'chest', 'abs', 'hip-flexors', 'quads',
  'back', 'glutes', 'hamstrings', 'calves'
];
const flexibilityFrontRegions = new Set<FlexibilityRegionId>([
  'neck', 'shoulders', 'chest', 'abs', 'hip-flexors', 'quads'
]);
const flexibilityBackRegions = new Set<FlexibilityRegionId>([
  'neck', 'shoulders', 'back', 'glutes', 'hamstrings', 'calves'
]);
const flexibilityIntervalPresets = [1, 2, 3, 4, 5, 7, 10, 14, 21, 30, 45, 60, 90, 120, 180, 365];

function intervalDraftFrom(data: FlexibilityData): Record<FlexibilityRegionId, string> {
  return Object.fromEntries(flexibilityRegions.map(region => [
    region.id,
    String(data.settings.intervals[region.id] ?? region.defaultIntervalDays)
  ])) as Record<FlexibilityRegionId, string>;
}

function customIntervalsFromDraft(
  draft: Record<FlexibilityRegionId, string>
): Record<FlexibilityRegionId, boolean> {
  return Object.fromEntries(flexibilityRegions.map(region => [
    region.id,
    !flexibilityIntervalPresets.includes(Number(draft[region.id]))
  ])) as Record<FlexibilityRegionId, boolean>;
}

function formatFlexibilityIntervalOption(value: string): string {
  const days = Number(value);
  return `Every ${value || '…'} day${days === 1 ? '' : 's'}`;
}

export function createFlexibilityBodyMapConfig(
  regions: ReturnType<typeof selectFlexibilityRegionStatuses>
): FitnessBodyMapConfigFor<FlexibilityRegionId> {
  return {
    title: 'Stretch schedule',
    eventType: 'flexibility',
    verb: 'stretching',
    regions: flexibilityBodyMapOrder.map(id => {
      const region = regions.find(item => item.id === id)!;
      return {
        id: region.id,
        name: region.name,
        group: region.group,
        front: flexibilityFrontRegions.has(region.id),
        back: flexibilityBackRegions.has(region.id),
        status: region.status,
        fill: flexibilityScoreFill(region),
        accessibilityLabel: `${region.status} ${flexibilityIntervalLabel(region)}. Last stretched: ${
          flexibilityLastStretchedLabel(region)
        }. ${flexibilityNextDueLabel(region)}.`
      };
    })
  };
}

export function FlexibilityView({
  data,
  today,
  onChange,
  healthScore,
  scoringEvidence,
  unlinkedStretchRhythmTitles,
  people = syntheticPeople,
  rhythms = [],
  archivedRhythms = [],
  foundations = foundationCatalogue,
  rhythmScores = new Map(),
  completedRhythms = new Set(),
  undoableRhythms = new Set(),
  overallHealthScore = null,
  categoryHealthScore = null,
  foundationNavigation = false,
  foundationActive = true,
  onAddLinkedRhythm,
  onSaveFoundationAssociations,
  onRhythmHistory,
  onEditRhythm,
  onTend,
  onUndo,
  onPersonSelect,
  onOpenFoundation,
  onOpenCategory,
  pendingQuickLog = null,
  onQuickLogOpened,
  onLogRequestClosed
}: FlexibilityViewProps) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [flexibilityTab, setFlexibilityTab] = useState<FlexibilityTab>(() =>
    data.guidedSessionDraft || pendingQuickLog?.linkedRhythmId ? 'routines' : 'body'
  );
  const wasFoundationActiveRef = useRef(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [routineEditor, setRoutineEditor] = useState<SavedFlexibilityRoutine | null>(null);
  const [routineEditorDraft, setRoutineEditorDraft] = useState<SavedFlexibilityRoutine | null>(null);
  const [routineEditorFromLibrary, setRoutineEditorFromLibrary] = useState(false);
  const [routineLibraryOpen, setRoutineLibraryOpen] = useState(false);
  const [routineChoice, setRoutineChoice] = useState<SavedFlexibilityRoutine | null>(null);
  const [routineError, setRoutineError] = useState('');
  const [associationDialogOpen, setAssociationDialogOpen] = useState(false);
  const [pendingRhythmStart, setPendingRhythmStart] = useState<{
    rhythmId: string;
    occurrence: string;
    title: string;
  } | null>(null);
  const [linkedRoutineId, setLinkedRoutineId] = useState('');
  const savedRoutines = data.savedRoutines ?? [];
  const [view, setView] = useState<'front' | 'back'>('front');
  const [selectedRegion, setSelectedRegion] = useState<FlexibilityRegionId>('shoulders');
  const [draft, setDraft] = useState<FlexibilitySessionDraft | null>(null);
  const [intervalDraft, setIntervalDraft] = useState(() => intervalDraftFrom(data));
  const [customIntervals, setCustomIntervals] = useState(() =>
    customIntervalsFromDraft(intervalDraftFrom(data))
  );
  const [error, setError] = useState('');
  const regionStatuses = useMemo(() => selectFlexibilityRegionStatuses(data, today), [data, today]);
  const flexibilityScoringEvidence: HealthAggregateEvidence = {
    ...scoringEvidence,
    notes: [
      ...(scoringEvidence.notes ?? []),
      ...(unlinkedStretchRhythmTitles.length > 0
        ? [`Not included because they are not linked to the Flexibility Foundation: ${unlinkedStretchRhythmTitles.join(', ')}.`]
        : [])
    ]
  };
  const suggestion = suggestNextFlexibilityStretch(regionStatuses);
  const recommendedSavedRoutineIds = suggestion.reasonRegionId === null
    ? []
    : savedRoutines.filter(routine => routine.stretches.some(stretch =>
      stretch.regionIds.some(id => suggestion.regionIds.includes(id)))).map(routine => routine.id);
  const bodyMapConfig = createFlexibilityBodyMapConfig(regionStatuses);
  const groups = [...new Set(flexibilityRegions.map(region => region.group))];
  const visibleRegions = bodyMapConfig.regions.filter(region => region[view]);
  const sortedSessions = [...data.sessions].sort((left, right) =>
    right.date.localeCompare(left.date) || right.id.localeCompare(left.id)
  );
  const sortedGuidedSessions = [...(data.guidedSessions ?? [])].sort((left, right) =>
    right.date.localeCompare(left.date) || right.startedAt.localeCompare(left.startedAt)
  );
  const historyEntries = [
    ...sortedSessions.map(session => ({ kind: 'manual' as const, date: session.date, id: session.id, session })),
    ...sortedGuidedSessions.map(session => ({ kind: 'guided' as const, date: session.date, id: session.id, session }))
  ].sort((left, right) =>
    right.date.localeCompare(left.date)
      || (right.kind === 'guided' ? right.session.startedAt : '')
        .localeCompare(left.kind === 'guided' ? left.session.startedAt : '')
      || right.id.localeCompare(left.id)
  );
  const visibleHistoryEntries = showAllHistory ? historyEntries : historyEntries.slice(0, 3);
  const activeFlexibilityRhythms = rhythms.filter(rhythm =>
    foundationRhythmIds(rhythm).includes('health-flexibility')
  );
  const archivedFlexibilityRhythms = archivedRhythms.filter(rhythm =>
    foundationRhythmIds(rhythm).includes('health-flexibility')
  );
  const flexibilityFoundation = foundations.find(foundation => foundation.id === 'health-flexibility');
  const selectedRegionStatus = regionStatuses.find(region => region.id === selectedRegion) ?? regionStatuses[0]!;

  useEffect(() => {
    if (!foundationNavigation) return;
    if (!foundationActive) {
      wasFoundationActiveRef.current = false;
      return;
    }
    if (wasFoundationActiveRef.current) return;
    wasFoundationActiveRef.current = true;
    if (data.guidedSessionDraft || pendingQuickLog?.linkedRhythmId) {
      setFlexibilityTab('routines');
    } else {
      setFlexibilityTab('body');
    }
  }, [
    data.guidedSessionDraft,
    foundationActive,
    foundationNavigation,
    pendingQuickLog?.linkedRhythmId
  ]);

  function persist(next: FlexibilityData): boolean {
    const message = onChange(next);
    if (message) {
      setError(message);
      return false;
    }
    setError('');
    return true;
  }

  function openLog(regionIds: readonly FlexibilityRegionId[] = [], session?: FlexibilitySession) {
    const nextDraft = session
      ? {
          date: session.date,
          regionIds: [...session.regionIds],
          minutes: session.minutes === undefined ? '' : String(session.minutes),
          notes: session.notes ?? '',
          editingSessionId: session.id
        }
      : data.draftSession ?? defaultDraft(today, regionIds);
    const saved = saveFlexibilityDraft(data, nextDraft, today);
    if (!saved.valid) {
      setError(saved.error);
      return;
    }
    if (!persist(saved.data)) return;
    setDraft(nextDraft);
    setDialog('log');
  }

  function updateDraft(next: FlexibilitySessionDraft) {
    const saved = saveFlexibilityDraft(data, next, today);
    if (!saved.valid) {
      setError(saved.error);
      return;
    }
    if (persist(saved.data)) setDraft(next);
  }

  function saveLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const minutes = draft.minutes.trim() === '' ? undefined : Number(draft.minutes);
    const session: FlexibilitySession = {
      id: draft.editingSessionId ?? crypto.randomUUID(),
      date: draft.date,
      regionIds: draft.regionIds,
      ...(minutes === undefined ? {} : { minutes }),
      ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {})
    };
    const saved = saveFlexibilitySession(data.sessions, session);
    if (!saved.valid) {
      setError(saved.error);
      return;
    }
    const next = clearFlexibilityDraft({ ...data, sessions: saved.sessions });
    if (!persist(next)) return;
    setDialog(null);
    setDraft(null);
    onLogRequestClosed?.();
  }

  function closeLog() {
    setDialog(null);
    setDraft(null);
    onLogRequestClosed?.();
  }

  function openIntervalSettings() {
    const nextDraft = intervalDraftFrom(data);
    setIntervalDraft(nextDraft);
    setCustomIntervals(customIntervalsFromDraft(nextDraft));
    setError('');
    setDialog('settings');
  }

  function closeIntervalSettings() {
    const currentDraft = intervalDraftFrom(data);
    setIntervalDraft(currentDraft);
    setCustomIntervals(customIntervalsFromDraft(currentDraft));
    setError('');
    setDialog(null);
  }

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const intervals = {} as Record<FlexibilityRegionId, number>;
    for (const region of flexibilityRegions) {
      const interval = Number(intervalDraft[region.id]);
      if (!Number.isInteger(interval) || interval < 1 || interval > 365) {
        setError(`Enter a whole number from 1 to 365 for ${region.name}.`);
        return;
      }
      intervals[region.id] = interval;
    }
    if (!persist({ ...data, settings: { intervals } })) return;
    const savedDraft = Object.fromEntries(flexibilityRegions.map(region => [
      region.id,
      String(intervals[region.id])
    ])) as Record<FlexibilityRegionId, string>;
    setIntervalDraft(savedDraft);
    setCustomIntervals(customIntervalsFromDraft(savedDraft));
    setError('');
    setDialog(null);
  }

  function deleteSession(session: FlexibilitySession) {
    if (!window.confirm(`Delete the stretch session from ${session.date}?`)) return;
    const result = deleteFlexibilitySession(data.sessions, session.id);
    if (!result.deleted) {
      setError('That stretch session is no longer available.');
      return;
    }
    const next = clearFlexibilityDraft({ ...data, sessions: result.sessions });
    persist(next);
  }

  function openRoutineEditor(routine: SavedFlexibilityRoutine, fromLibrary = false) {
    setRoutineEditor(routine);
    setRoutineEditorDraft(routine);
    setRoutineEditorFromLibrary(fromLibrary);
    setRoutineLibraryOpen(false);
    setRoutineError('');
  }

  function closeRoutineEditor(returnToLibrary = routineEditorFromLibrary) {
    setRoutineEditor(null);
    setRoutineEditorFromLibrary(false);
    if (returnToLibrary) setRoutineLibraryOpen(true);
  }

  function continueRoutineDraft() {
    if (!routineEditorDraft) return;
    setRoutineEditor(routineEditorDraft);
    setRoutineEditorFromLibrary(true);
    setRoutineLibraryOpen(false);
    setRoutineError('');
  }

  function createRoutine() {
    openRoutineEditor({
      id: `new-routine-${globalThis.crypto.randomUUID()}`,
      name: '',
      stretches: [],
      preparationSeconds: 5,
      timerDirection: 'down'
    }, true);
  }

  function saveRoutine(routine: SavedFlexibilityRoutine) {
    const savedRoutine = routine.id.startsWith('suggestion-') || routine.id.startsWith('new-routine-')
      ? { ...routine, id: `flexibility-routine-${globalThis.crypto.randomUUID()}` }
      : routine;
    const result = saveFlexibilityRoutine(savedRoutines, savedRoutine);
    if (!result.valid) {
      setRoutineError(result.error);
      return;
    }
    if (persist(migrateFlexibilityData({ ...data, savedRoutines: result.routines }))) {
      setRoutineEditor(null);
      setRoutineEditorDraft(null);
      setRoutineEditorFromLibrary(false);
      setRoutineLibraryOpen(false);
      setFlexibilityTab('routines');
      setRoutineError('');
    }
  }

  function startRoutine(
    routine: SavedFlexibilityRoutine,
    linkedRhythm?: { rhythmId: string; occurrence: string }
  ) {
    if (data.guidedSessionDraft) {
      setRoutineError('Resume or finish the current stretch session before starting another.');
      return;
    }
    const preferences = data.timerPreferences;
    const result = createFlexibilityGuidedSession(routine, {
      id: `flexibility-session-${globalThis.crypto.randomUUID()}`,
      date: today,
      startedAt: new Date().toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      preparationSeconds: preferences?.preparationSeconds ?? routine.preparationSeconds,
      timerDirection: preferences?.timerDirection ?? routine.timerDirection,
      ...(linkedRhythm ? {
        linkedRhythmId: linkedRhythm.rhythmId,
        rhythmOccurrence: linkedRhythm.occurrence,
        completionId: `flexibility-completion-${globalThis.crypto.randomUUID()}`
      } : {})
    });
    if (!result.valid) {
      setRoutineError(result.error);
      return;
    }
    if (persist(migrateFlexibilityData({ ...data, guidedSessionDraft: result.session }))) {
      setRoutineError('');
      setRoutineChoice(null);
      setDialog('guided');
      setPendingRhythmStart(null);
    }
  }

  function quickLogRoutine(routine: SavedFlexibilityRoutine) {
    const regionIds = [...new Set(routine.stretches.flatMap(stretch => stretch.regionIds))];
    setRoutineChoice(null);
    openLog(regionIds);
  }

  function updateGuidedSession(
    session: FlexibilityGuidedSessionDraft,
    timerPreferences?: FlexibilityData['timerPreferences']
  ): string | null {
    const next = migrateFlexibilityData({
      ...data,
      guidedSessionDraft: session,
      ...(timerPreferences ? { timerPreferences } : {})
    });
    return onChange(next);
  }

  function saveGuidedSession(session: FlexibilityGuidedSessionDraft): string | null {
    const result = finishFlexibilityGuidedSession(data, session);
    if (!result.valid) return result.error;
    const message = onChange(result.data);
    if (!message) {
      setDialog(null);
      setError('');
      onLogRequestClosed?.();
    }
    return message;
  }

  function removeRoutine(routine: SavedFlexibilityRoutine) {
    if (!window.confirm(`Delete the saved routine "${routine.name}"?`)) return;
    const result = deleteFlexibilityRoutine(savedRoutines, routine.id);
    if (result.deleted) persist(migrateFlexibilityData({ ...data, savedRoutines: result.routines }));
  }

  function toggleRegion(regionId: FlexibilityRegionId) {
    if (!draft) return;
    updateDraft({
      ...draft,
      regionIds: draft.regionIds.includes(regionId)
        ? draft.regionIds.filter(id => id !== regionId)
        : [...draft.regionIds, regionId]
    });
  }

  function chooseBodyView(nextView: 'front' | 'back') {
    if (!bodyMapConfig.regions.some(region => region.id === selectedRegion && region[nextView])) {
      const nextSelected = bodyMapConfig.regions.find(region => region[nextView]);
      if (nextSelected) setSelectedRegion(nextSelected.id);
    }
    setView(nextView);
  }

  useEffect(() => {
    if (!pendingQuickLog) return;
    if (pendingQuickLog.linkedRhythmId && pendingQuickLog.rhythmOccurrence) {
      setPendingRhythmStart({
        rhythmId: pendingQuickLog.linkedRhythmId,
        occurrence: pendingQuickLog.rhythmOccurrence,
        title: pendingQuickLog.rhythmTitle ?? 'Linked stretch Rhythm'
      });
      setLinkedRoutineId(savedRoutines[0]?.id ?? '');
      setFlexibilityTab('routines');
      onQuickLogOpened?.(pendingQuickLog.requestId);
      return;
    }
    openLog(pendingQuickLog.regionIds);
    onQuickLogOpened?.(pendingQuickLog.requestId);
  }, [pendingQuickLog?.requestId]);

  return (
    <div className="category-page flexibility-view strength-page">
      <FitnessScoreSummary
        category="Flexibility"
        healthTitle="Flexibility Health"
        className={`rhythm-history-view__score-card flexibility-summary${foundationNavigation ? ' foundation-health-card' : ''}`}
        consistency={healthScore.consistency}
        onTrack={healthScore.onTrack}
        health={healthScore.health}
        showMeasures={!foundationNavigation}
        consistencyCaption="Average Consistency across active linked stretch Rhythms."
        onTrackCaption="Average On Track across active linked stretch Rhythms."
        overallHealthScore={overallHealthScore}
        categoryHealthScore={categoryHealthScore}
        summaryExplanation="Flexibility Health averages Consistency and On Track from active linked stretch Rhythms equally, then applies the 75/25 blend. Stretch-region history is diagnostic only."
        statusMessage={`${healthScore.health === null ? 'Flexibility Health is not yet scored. ' : ''}${
          scoringEvidence.coverage ?? 'No linked stretch Rhythms are available yet.'
        }`}
        scoringEvidence={flexibilityScoringEvidence}
        rollup={createHealthFitnessRollup('foundations', 'flexibility')}
      />
      {unlinkedStretchRhythmTitles.length > 0 && (
        <div className="fitness-score-summary__status" role="status">
          <p>
            These stretch Rhythms are not included in Flexibility Health because they are not linked
            to the Flexibility Foundation: {unlinkedStretchRhythmTitles.join(', ')}. Link them in
            their Foundation associations to include their scores.
          </p>
        </div>
      )}

      {data.guidedSessionDraft && dialog !== 'guided' && (
        <aside className="strength-guided-banner flexibility-guided-banner" aria-label="Stretch session in progress">
          <div>
            <strong>{data.guidedSessionDraft.routineName} is in progress</strong>
            <span>Your stretch holds are saved in this preview draft.</span>
          </div>
          <button type="button" className="btn mini" onClick={() => setDialog('guided')}>
            Resume session
          </button>
        </aside>
      )}

      <SegmentedTabs
        tabs={flexibilityTabs}
        selectedTabId={flexibilityTab}
        ariaLabel="Flexibility sections"
        onChange={setFlexibilityTab}
      />
      <div className="strength-section-panels">
        <section
          id="flexibility-panel-body"
          className="strength-section-panel strength-section-panel--body"
          role="tabpanel"
          aria-labelledby="flexibility-tab-body"
          hidden={flexibilityTab !== 'body'}
        >
          {suggestion.reasonRegionId !== null && recommendedSavedRoutineIds.length === 0 && (
            <article className="strength-recommendation flexibility-next-stretch">
              <div>
                <h3>Next stretch</h3>
                <p>{suggestion.text}</p>
              </div>
              <button type="button" className="btn mini" onClick={() => openLog(suggestion.regionIds)}>
                Log suggested regions
              </button>
            </article>
          )}
          <ToolZone
            className="strength-map-card flexibility-map-card"
            icon={<RhythmMetadataIcon kind="history" />}
            purposeLabel="Body insights"
            subtitle="Explore your stretch coverage and readiness."
            scoringFootnote="Your linked Rhythms determine Flexibility Health."
            headerAction={(
              <SettingsGearButton
                label="Stretch interval settings"
                onClick={openIntervalSettings}
                expanded={dialog === 'settings'}
              />
            )}
          >
            <div className="strength-map-toolbar" role="group" aria-label="Body map view">
              {(['front', 'back'] as const).map(nextView => (
                <button key={nextView} type="button" aria-pressed={view === nextView}
                  onClick={() => chooseBodyView(nextView)}>
                  {nextView === 'front' ? 'Front' : 'Back'}
                </button>
              ))}
            </div>
            <FitnessBodyMapLayout
              config={bodyMapConfig}
              view={view}
              selectedId={selectedRegion}
              onSelect={setSelectedRegion}
              listLabel="Stretch schedule status"
            >
              {visibleRegions.map(region => {
                const regionStatus = regionStatuses.find(item => item.id === region.id)!;
                const nextDueLabel = flexibilityNextDueLabel(regionStatus);
                const lastStretchedLabel = flexibilityLastStretchedLabel(regionStatus);
                const nextDueDescription = nextDueLabel === '—'
                  ? 'Next stretch unavailable.'
                  : `${nextDueLabel}.`;
                return (
                  <button
                    key={region.id}
                    type="button"
                    className="strength-muscle-row flexibility-region"
                    aria-pressed={selectedRegion === region.id}
                    aria-label={`${region.name}. ${regionStatus.status} Last stretched: ${lastStretchedLabel}. ${nextDueDescription}`}
                    onClick={() => setSelectedRegion(region.id)}
                  >
                    <span className="strength-muscle-row__heading">
                      <strong>{region.name}</strong>
                      <span
                        className={`strength-muscle-row__status strength-muscle-row__status--${flexibilityStatusTone(regionStatus)}`}
                        role="img"
                        aria-label={`Stretch status: ${regionStatus.status}`}
                        title={`Stretch status: ${regionStatus.status}`}
                      />
                    </span>
                    <span className="strength-muscle-row__timing">
                      <span className="strength-muscle-row__last-workout">
                        <RhythmCalendarIcon className="strength-muscle-row__calendar-icon" />
                        <span>{lastStretchedLabel}</span>
                      </span>
                      <span className="strength-muscle-row__next-due">
                        {nextDueLabel} · {flexibilityIntervalLabel(regionStatus)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </FitnessBodyMapLayout>
            <div className="strength-muscle-detail" aria-live="polite">
              <h3 className="strength-muscle-detail__title">{selectedRegionStatus.name} details</h3>
              <dl className="strength-muscle-facts">
                <div>
                  <dt>Stretch interval</dt>
                  <dd>{flexibilityIntervalLabel(selectedRegionStatus)}</dd>
                </div>
                <div>
                  <dt>Last stretched</dt>
                  <dd>{flexibilityLastStretchedLabel(selectedRegionStatus)}</dd>
                </div>
                <div>
                  <dt>Next due</dt>
                  <dd>{flexibilityNextDueLabel(selectedRegionStatus)}</dd>
                </div>
              </dl>
            </div>
            <button type="button" className="btn mini ghost" onClick={() => openLog([selectedRegion])}>
              Log {selectedRegionStatus.name}
            </button>
          </ToolZone>
        </section>

        <section
          id="flexibility-panel-routines"
          className="strength-section-panel"
          role="tabpanel"
          aria-labelledby="flexibility-tab-routines"
          hidden={flexibilityTab !== 'routines'}
        >
          <div className="strength-workouts flexibility-routine-collection">
            <section className="strength-workout-section" aria-labelledby="flexibility-routines-heading">
              <FoundationSectionHeading
                title="My routines"
                headingId="flexibility-routines-heading"
                subtitle="Your stretches, ready when you are."
                actions={<button
                  type="button"
                  className="btn mini ghost strength-workouts__add"
                  aria-label="Add routine"
                  onClick={() => {
                    setFlexibilityTab('routines');
                    setRoutineLibraryOpen(true);
                  }}
                >
                  <span aria-hidden="true">+</span> Add
                </button>}
              />
              {routineError && <p className="flexibility-error" role="alert">{routineError}</p>}
              {data.draftSession && (
                <div className="flexibility-routine-resume">
                  <button type="button" className="btn mini ghost" onClick={() => openLog()}>
                    Resume manual stretch log
                  </button>
                </div>
              )}
              {pendingRhythmStart && (
                <div className="flexibility-linked-rhythm" role="group"
                  aria-label={`Start linked Rhythm ${pendingRhythmStart.title}`}>
                  <p>Choose a saved routine to complete “{pendingRhythmStart.title}”. The Rhythm stays incomplete until you finish the guided session.</p>
                  {savedRoutines.length ? (
                    <>
                      <label>Saved routine
                        <select aria-label="Saved routine for linked Rhythm" value={linkedRoutineId}
                          onChange={event => setLinkedRoutineId(event.currentTarget.value)}>
                          {savedRoutines.map(routine => (
                            <option key={routine.id} value={routine.id}>{routine.name}</option>
                          ))}
                        </select>
                      </label>
                      <button type="button" className="btn mini"
                        onClick={() => {
                          const routine = savedRoutines.find(item => item.id === linkedRoutineId);
                          if (routine) startRoutine(routine, pendingRhythmStart);
                        }}>
                        Start linked stretch
                      </button>
                    </>
                  ) : <p>Save a stretch routine before starting this linked Rhythm.</p>}
                </div>
              )}
              {savedRoutines.length ? (
                <div className="strength-template-list">
                  {savedRoutines.map(routine => (
                    <article key={routine.id} className="strength-template flexibility-routine-card">
                      <FoundationRoutineSummary
                        className="strength-template__content"
                        title={routine.name}
                        description={routineTargetNames(routine)}
                        metadata={`${routine.stretches.length} ${
                          routine.stretches.length === 1 ? 'stretch' : 'stretches'
                        } · About ${formatRoutineDuration(routine)}`}
                        metadataClassName="strength-template__exercise-summary"
                      >
                        {recommendedSavedRoutineIds.includes(routine.id) && (
                          <span className="flexibility-routine-card__hint">
                            Suggested for regions due to stretch
                          </span>
                        )}
                      </FoundationRoutineSummary>
                      <details className="strength-template__menu">
                        <summary aria-label={`Actions for ${routine.name}`}>⋯</summary>
                        <div className="strength-template__menu-items">
                          <button type="button" onClick={event => {
                            openRoutineEditor(routine);
                            event.currentTarget.closest('details')?.removeAttribute('open');
                          }}>Edit routine</button>
                          <button type="button" onClick={event => {
                            removeRoutine(routine);
                            event.currentTarget.closest('details')?.removeAttribute('open');
                          }}>Delete routine</button>
                        </div>
                      </details>
                      <div className="strength-template__actions">
                        <button type="button" className="btn mini" onClick={() => setRoutineChoice(routine)}>
                          Stretch
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="strength-empty">No routines saved yet. Add a suggested routine or create your own.</p>
              )}
            </section>

            <section className="strength-workout-section strength-history-page flexibility-history"
              aria-labelledby="flexibility-history-heading">
              <FoundationSectionHeading
                title="History"
                headingId="flexibility-history-heading"
                subtitle="Your completed stretches."
                actions={<button
                  type="button"
                  className="btn mini ghost"
                  aria-label="Log stretch"
                  onClick={() => openLog()}
                >
                  <span aria-hidden="true">+</span> Log stretch
                </button>}
              />
              {historyEntries.length ? (
                <>
                  <ul className="flexibility-history__list">
                    {visibleHistoryEntries.map(entry => (
                      <li key={`${entry.kind}-${entry.id}`} className="strength-recommendation">
                        {entry.kind === 'guided' ? (
                          <div>
                            <strong>{entry.date} · {entry.session.routineName}</strong>
                            <span>{entry.session.holds.filter(hold => hold.status === 'completed').length} holds completed · {
                              entry.session.holds.filter(hold => hold.status === 'skipped').length
                            } skipped</span>
                            <span>{[...new Set(entry.session.holds.filter(hold => hold.status === 'completed')
                              .flatMap(hold => hold.regionIds))]
                              .map(id => flexibilityRegions.find(region => region.id === id)?.name ?? id).join(', ')}</span>
                          </div>
                        ) : (
                          <>
                            <div>
                              <strong>{entry.date} · Manual stretch</strong>
                              <span>{entry.session.regionIds.map(id =>
                                flexibilityRegions.find(region => region.id === id)?.name ?? id
                              ).join(', ')}</span>
                              {entry.session.minutes !== undefined && <span>{entry.session.minutes} min</span>}
                            </div>
                            <div className="flexibility-history__actions">
                              <button type="button" className="btn mini ghost"
                                onClick={() => openLog([], entry.session)}>Edit</button>
                              <button type="button" className="btn mini ghost"
                                onClick={() => deleteSession(entry.session)}>Delete</button>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                  {historyEntries.length > 3 && (
                    <div className="strength-history-page__actions">
                      <button type="button" className="btn mini ghost"
                        onClick={() => setShowAllHistory(value => !value)}>
                        {showAllHistory ? 'Show recent' : 'View all'}
                      </button>
                    </div>
                  )}
                </>
              ) : <p className="strength-empty">No stretches logged yet.</p>}
            </section>
          </div>
        </section>

        <section
          id="flexibility-panel-rhythms"
          className="strength-section-panel"
          role="tabpanel"
          aria-labelledby="flexibility-tab-rhythms"
          hidden={flexibilityTab !== 'rhythms'}
        >
          <section className="marriage-foundation-support strength-rhythms-panel"
            aria-labelledby="flexibility-linked-rhythms-title">
            <FoundationSectionHeading
              title="Linked Rhythms"
              headingId="flexibility-linked-rhythms-title"
              accessibleName={`Linked Rhythms · ${activeFlexibilityRhythms.length}`}
              secondary={<span className="strength-linked-rhythms-count" aria-hidden="true">
                {activeFlexibilityRhythms.length}
              </span>}
              subtitle="Your routines for building flexibility."
              actions={
                <>
                  {onSaveFoundationAssociations && (
                    <button type="button" className="btn mini ghost" aria-haspopup="dialog"
                      onClick={() => setAssociationDialogOpen(true)}>
                      Manage links
                    </button>
                  )}
                  {onAddLinkedRhythm && (
                    <button type="button" className="btn mini"
                      onClick={event => onAddLinkedRhythm('health-flexibility', event)}>
                      Add Rhythm
                    </button>
                  )}
                </>
              }
            />
            {activeFlexibilityRhythms.length > 0 && (
              <FoundationRhythmGroup
                people={people}
                rhythms={activeFlexibilityRhythms}
                archivedRhythmIds={archivedFlexibilityRhythms.map(rhythm => rhythm.id)}
                headingId="flexibility-linked-rhythms-title"
                rhythmScores={rhythmScores}
                completedRhythms={completedRhythms}
                undoableRhythms={undoableRhythms}
                foundations={foundations}
                categoryToken="flexibility"
                {...(onTend ? { onTend } : {})}
                {...(onUndo ? { onUndo } : {})}
                {...(onEditRhythm ? { onEditRhythm } : {})}
                {...(onRhythmHistory ? { onRhythmHistory } : {})}
                {...(onPersonSelect ? { onPersonSelect } : {})}
                {...(onOpenFoundation ? { onOpenFoundation } : {})}
                {...(onOpenCategory ? { onOpenCategory } : {})}
                completionActionLabelFor={() => 'Log'}
                completionActionAccessibleLabelFor={() => 'Start stretch routine'}
                completedActionLabelFor={() => 'Stretched'}
              />
            )}
            {activeFlexibilityRhythms.length === 0 && (
              <div className="strength-rhythms-empty">
                <p>No Rhythms are linked to Flexibility yet.</p>
              </div>
            )}
          </section>
        </section>
      </div>

      {error && <p className="flexibility-error" role="alert">{error}</p>}

      {routineEditor && (
        <FlexibilityRoutineEditorDialog
          routine={routineEditor}
          onSave={saveRoutine}
          onClose={() => closeRoutineEditor()}
          onDraftChange={setRoutineEditorDraft}
          errorMessage={routineError}
          {...(routineEditorFromLibrary ? { onBack: () => closeRoutineEditor(true) } : {})}
        />
      )}
      {routineLibraryOpen && (
        <MoneyGoalDialog
          title="Add routine"
          labelledBy="flexibility-routine-library-title"
          titleId="flexibility-routine-library-title"
          closeLabel="Close Add routine"
          closeOnEscape
          dismissOnBackdrop
          portalToBody
          phoneFullScreen
          bodyClassName="strength-dialog-body"
          dialogClassName="money-goal-dialog--strength-suggestions"
          onClose={() => setRoutineLibraryOpen(false)}
        >
          <div className="strength-workout-suggestions flexibility-routine-library">
            <section className="strength-workout-suggestions__create" aria-label="Create a routine">
              <FoundationRoutineSummary
                className="strength-workout-suggestions__content"
                title="Create your own"
                description="Build a stretch routine with your preferred holds and target regions."
              />
              <button type="button" className="btn mini ghost" onClick={createRoutine}>Create</button>
              {routineEditorDraft && (
                <button type="button" className="strength-workout-suggestions__continue"
                  onClick={continueRoutineDraft}>
                  Continue editing
                </button>
              )}
            </section>
            <section className="strength-workout-suggestions__list" aria-label="Suggested stretch routines">
              {flexibilityRoutineSuggestions.map(routine => (
                <article className="strength-workout-suggestion" key={routine.id}>
                  <FoundationRoutineSummary
                    className="strength-workout-suggestion__content"
                    title={routine.name}
                    description={routineTargetNames(routine)}
                    metadata={`${routine.stretches.length} ${
                      routine.stretches.length === 1 ? 'stretch' : 'stretches'
                    } · About ${formatRoutineDuration(routine)}`}
                  >
                    <details className="strength-workout-suggestion__preview">
                      <summary>Preview routine</summary>
                      <ol>
                        {routine.stretches.map(stretch => (
                          <li key={stretch.id}>
                            <strong>{stretch.name}</strong>
                            <span>{stretch.holdSeconds} sec · {
                              stretch.sideMode === 'both' ? 'Both sides' : 'Left and right'
                            } · {stretch.regionIds.map(regionId =>
                              flexibilityRegions.find(region => region.id === regionId)?.name ?? regionId
                            ).join(', ')}</span>
                            {stretch.instructions && <span>{stretch.instructions}</span>}
                          </li>
                        ))}
                      </ol>
                    </details>
                  </FoundationRoutineSummary>
                  <button type="button" className="btn mini"
                    onClick={() => openRoutineEditor(routine, true)}>
                    Customize
                  </button>
                </article>
              ))}
            </section>
          </div>
        </MoneyGoalDialog>
      )}
      {routineChoice && (
        <MoneyGoalDialog
          title={routineChoice.name}
          intro="How do you want to stretch today?"
          labelledBy="flexibility-routine-choice-title"
          titleId="flexibility-routine-choice-title"
          closeLabel="Close stretch choices"
          onClose={() => setRoutineChoice(null)}
        >
          <div className="strength-workout-choice flexibility-routine-choice">
            <button type="button"
              className="strength-workout-choice__option strength-workout-choice__option--guided"
              onClick={() => startRoutine(routineChoice)}>
              <span className="strength-workout-choice__icon flexibility-routine-choice__icon" aria-hidden="true">◷</span>
              <span className="strength-workout-choice__copy">
                <strong>Guided session</strong>
                <span>Time each stretch and track each side.</span>
              </span>
            </button>
            <button type="button"
              className="strength-workout-choice__option strength-workout-choice__option--quick"
              onClick={() => quickLogRoutine(routineChoice)}>
              <span className="strength-workout-choice__icon flexibility-routine-choice__icon" aria-hidden="true">✓</span>
              <span className="strength-workout-choice__copy">
                <strong>Quick log</strong>
                <span>Record the regions you stretched.</span>
              </span>
            </button>
          </div>
          {routineError && <p className="flexibility-error" role="alert">{routineError}</p>}
          <div className="money-goal-dialog__actions">
            <button type="button" className="btn mini ghost" onClick={() => setRoutineChoice(null)}>Cancel</button>
          </div>
        </MoneyGoalDialog>
      )}
      {associationDialogOpen && flexibilityFoundation && onSaveFoundationAssociations && (
        <FoundationRhythmAssociationDialog
          key={flexibilityFoundation.id}
          foundation={flexibilityFoundation}
          rhythms={[
            ...rhythms.map(rhythm => ({ rhythm, archived: false })),
            ...archivedRhythms.map(rhythm => ({ rhythm, archived: true }))
          ]}
          onSave={changes => onSaveFoundationAssociations(flexibilityFoundation.id, changes)}
          onClose={() => setAssociationDialogOpen(false)}
        />
      )}
      {dialog === 'guided' && data.guidedSessionDraft && (
        <FlexibilityGuidedSessionDialog
          session={data.guidedSessionDraft}
          onChange={updateGuidedSession}
          onFinish={saveGuidedSession}
          onClose={() => {
            setDialog(null);
            onLogRequestClosed?.();
          }}
        />
      )}

      {dialog === 'log' && draft && (
        <MoneyGoalDialog
          title={draft.editingSessionId ? 'Edit stretch session' : 'Log a stretch'}
          closeLabel="Close stretch session"
          closeOnEscape
          dismissOnBackdrop
          portalToBody
          initialFocusId="flexibility-log-date"
          onClose={closeLog}
        >
          <form className="flexibility-form" onSubmit={saveLog}>
            <label>
              Date
              <input id="flexibility-log-date" type="date" max={today} value={draft.date}
                onChange={event => updateDraft({ ...draft, date: event.target.value })} required />
            </label>
            <fieldset>
              <legend>Stretch regions</legend>
              {groups.map(group => (
                <div key={group} className="flexibility-form__region-group">
                  <h3>{group}</h3>
                  <div>
                    {flexibilityRegions.filter(region => region.group === group).map(region => (
                      <label key={region.id} className="flexibility-checkbox">
                        <input type="checkbox" checked={draft.regionIds.includes(region.id)}
                          onChange={() => toggleRegion(region.id)} />
                        {region.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </fieldset>
            <label>
              Minutes (optional)
              <input type="number" min="1" max="1440" step="1" inputMode="numeric"
                value={draft.minutes} onChange={event => updateDraft({ ...draft, minutes: event.target.value })} />
            </label>
            <label>
              Notes (optional)
              <textarea rows={3} maxLength={1000} value={draft.notes}
                onChange={event => updateDraft({ ...draft, notes: event.target.value })} />
            </label>
            {error && <p className="flexibility-error" role="alert">{error}</p>}
            <div className="flexibility-form__actions">
              <button type="button" className="btn mini ghost" onClick={closeLog}>Cancel</button>
              <button type="submit" className="btn primary" disabled={!draft.regionIds.length}>Save stretch</button>
            </div>
          </form>
        </MoneyGoalDialog>
      )}

      {dialog === 'settings' && (
        <MoneyGoalDialog
          title="Stretch intervals"
          closeLabel="Close stretch intervals"
          closeOnEscape
          dismissOnBackdrop
          portalToBody
          phoneFullScreen
          bodyClassName="flexibility-settings-dialog__body"
          dialogClassName="flexibility-settings-dialog"
          onClose={closeIntervalSettings}
        >
          <form className="flexibility-settings" onSubmit={saveSettings}>
            <p>Set how many days can pass between sessions for each region.</p>
            {groups.map(group => (
              <fieldset key={group}>
                <legend>{group}</legend>
                {flexibilityRegions.filter(region => region.group === group).map(region => (
                  <div key={region.id} className="flexibility-settings__row">
                    <span>{region.name}</span>
                    <div className="flexibility-settings__field">
                      <StyledSelect
                        label={`${region.name} stretch interval`}
                        triggerAriaLabel={`${region.name} stretch interval`}
                        value={customIntervals[region.id] ? 'custom' : intervalDraft[region.id]}
                        options={[
                          ...flexibilityIntervalPresets.map(days => ({
                            value: String(days),
                            label: formatFlexibilityIntervalOption(String(days))
                          })),
                          {
                            value: 'custom',
                            label: customIntervals[region.id]
                              ? `Custom · ${formatFlexibilityIntervalOption(intervalDraft[region.id])}`
                              : 'Custom…',
                            description: 'Enter a whole number from 1 to 365 days.'
                          }
                        ]}
                        containerClassName="flexibility-settings__select"
                        triggerClassName="flexibility-settings__select-trigger"
                        matchTriggerWidth
                        popoverMinWidth={160}
                        onChange={value => {
                          if (value === 'custom') {
                            setCustomIntervals(current => ({ ...current, [region.id]: true }));
                            return;
                          }
                          setIntervalDraft(current => ({ ...current, [region.id]: value }));
                          setCustomIntervals(current => ({ ...current, [region.id]: false }));
                        }}
                      />
                      {customIntervals[region.id] && (
                        <input
                          className="flexibility-settings__custom-input"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          aria-label={`${region.name} custom interval in days`}
                          value={intervalDraft[region.id]}
                          onChange={event => setIntervalDraft(current => ({
                            ...current,
                            [region.id]: event.target.value
                          }))}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </fieldset>
            ))}
            {error && <p className="flexibility-error" role="alert">{error}</p>}
            <div className="flexibility-form__actions flexibility-settings__actions">
              <button type="button" className="btn mini ghost" onClick={closeIntervalSettings}>Cancel</button>
              <button type="submit" className="btn primary">Save intervals</button>
            </div>
          </form>
        </MoneyGoalDialog>
      )}
    </div>
  );
}

function flexibilityScoreFill(region: FlexibilityRegionStatus): string {
  switch (flexibilityStatusTone(region)) {
    case 'current': return 'var(--score-green)';
    case 'due': return 'var(--score-yellow)';
    case 'overdue': return 'var(--score-red)';
    case 'unavailable': return 'var(--score-neutral)';
  }
}

function flexibilityStatusTone(region: FlexibilityRegionStatus): 'current' | 'due' | 'overdue' | 'unavailable' {
  if (region.historyState === 'invalid' || region.daysUntilDue === null) return 'unavailable';
  return region.daysUntilDue > 0 ? 'current' : region.daysUntilDue === 0 ? 'due' : 'overdue';
}

function flexibilityLastStretchedLabel(region: FlexibilityRegionStatus): string {
  if (region.historyState === 'invalid') return 'Unavailable';
  if (region.daysSince === null) return 'No log yet';
  if (region.daysSince === 0) return 'Today';
  return `${region.daysSince}d ago`;
}

function flexibilityNextDueLabel(region: FlexibilityRegionStatus): string {
  if (region.historyState === 'invalid' || region.daysUntilDue === null) return '—';
  if (region.daysUntilDue < 0) return `Overdue by ${Math.abs(region.daysUntilDue)}d`;
  if (region.daysUntilDue === 0) return 'Due today';
  return `Next stretch in ${region.daysUntilDue}d`;
}

function flexibilityIntervalLabel(region: FlexibilityRegionStatus): string {
  return `Every ${region.intervalDays} day${region.intervalDays === 1 ? '' : 's'}`;
}

function routineTargetNames(routine: SavedFlexibilityRoutine): string {
  const regionIds = [...new Set(routine.stretches.flatMap(stretch => stretch.regionIds))];
  return regionIds.map(id => flexibilityRegions.find(region => region.id === id)?.name ?? id)
    .join(' · ') || 'Target regions unavailable';
}

function formatRoutineDuration(routine: SavedFlexibilityRoutine): string {
  const seconds = estimateFlexibilityRoutineSeconds(routine);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes} min${remainder ? ` ${remainder} sec` : ''}` : `${remainder} sec`;
}
