import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { StrengthView } from './StrengthView.tsx';
import type { StrengthViewProps } from './StrengthView.tsx';
import { WeightView } from './WeightView.tsx';
import type { WeightViewProps } from './WeightView.tsx';
import { CardioView } from './CardioView.tsx';
import { FlexibilityView } from './FlexibilityView.tsx';
import type { FlexibilityViewProps } from './FlexibilityView.tsx';
import type { CardioViewProps } from './CardioView.tsx';
import { CategoryHealthSummary } from './CategoryHealthSummary.tsx';
import { CategoryHeader } from './CategoryHeader.tsx';
import { AreaIcon } from './AreaIcon.tsx';
import { MarriageIcon } from './MarriageIcon.tsx';
import { FoundationCard } from './Cards.tsx';
import { FoundationDetailHeader } from './FoundationDetailHeader.tsx';
import { SegmentedTabs } from './SegmentedTabs.tsx';
import type { SegmentedTab } from './SegmentedTabs.tsx';
import { CategoryRhythmCollection } from './CategoryRhythmCollection.tsx';
import { ArchivedRhythmsDialog } from './ArchivedRhythmsDialog.tsx';
import { RhythmDetailsDialog } from './RhythmDetailsDialog.tsx';
import { RhythmSuggestionPicker } from './RhythmSuggestionPicker.tsx';
import type { RhythmSuggestionPickerGroup } from './RhythmSuggestionPicker.tsx';
import type { CategoryRhythmSuggestion, CategoryRhythmSuggestionCatalogue } from './MarriageView.tsx';
import type { CategoryScoreSelection } from '../domain/category-scoring.ts';
import type { FoundationRhythmAssociationChange } from '../domain/foundation-rhythm-associations.ts';
import { selectUnlinkedFlexibilityRhythms } from '../domain/category-scoring.ts';
import { selectAvailableFoundationLinkedItems, selectAvailableFoundationIds } from '../domain/category-availability.ts';
import { foundationRhythmIds } from '../domain/foundation-rhythm-associations.ts';
import { selectFoundationScore } from '../domain/foundation-scoring.ts';
import type { CategoryTabNavigationRequest, Destination } from './AppNavigation.tsx';
import { healthFoundationDefinitions, syntheticPeople } from '../domain/preview-data.ts';
import type { FoundationPreview, PersonId, PersonPreview, RhythmPreview } from '../domain/preview-data.ts';
import { rhythmLastActivityLabel } from '../domain/preview-data.ts';
import { isRhythmRelevantOnDate, rhythmsForSuggestionSource } from '../domain/category-rhythms.ts';
import { effectiveRhythmSchedule, rhythmScheduleSummary, rhythmTimeLabel, rhythmTimeValueFromLabel } from '../domain/rhythm-schedule.ts';
import type { RhythmScoreResult } from '../domain/rhythm-scoring.ts';
import { rhythmHealthScore } from '../domain/rhythm-scoring.ts';
import { isEditableRhythmId } from '../domain/rhythm-editor.ts';
import { TendedRhythmList } from './TendedRhythmList.tsx';
import { TendedRhythmItems } from './TendedRhythmItems.tsx';
import { selectTendedRhythmDisplayIds } from '../domain/category-rhythms.ts';
import { createHealthFitnessHealthContribution, createHealthFitnessRollup } from './HealthRollupDiagram.tsx';
import { useRhythmTimeOptions } from './TimeBlocksContext.tsx';
import type { HealthAggregateEvidence } from './HealthScoringDetailsCard.tsx';
import { noLinkedRhythmHealthMessage } from './health-summary-copy.ts';
import { useAreaAvailability, useAvailableFoundations } from './CategoryAvailabilityContext.tsx';

type HealthFitnessTab = 'today' | 'rhythms' | 'progress';
type ProgressTab = (typeof healthFoundationDefinitions)[number]['progressId'];
type HealthFitnessMeasureId = 'strength' | 'cardio' | 'weight' | 'flexibility';
type HealthFitnessMeasureRow = HealthAggregateEvidence['rows'][number] & {
  id: HealthFitnessMeasureId;
};

type HealthFitnessViewProps = {
  people?: readonly PersonPreview[];
  hidden?: boolean;
  strength: StrengthViewProps;
  weight: WeightViewProps;
  cardio: CardioViewProps;
  flexibility: Omit<
    FlexibilityViewProps,
    'healthScore' | 'scoringEvidence' | 'unlinkedStretchRhythmTitles'
  >;
  rhythms: readonly RhythmPreview[];
  archivedRhythms: readonly RhythmPreview[];
  todayDate: string;
  onHome: () => void;
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>;
  completedRhythms: ReadonlySet<string>;
  undoableRhythms: ReadonlySet<string>;
  satisfiedRhythmIds?: ReadonlySet<string>;
  tendedRhythmIds?: ReadonlySet<string>;
  initializing?: boolean;
  foundations: readonly FoundationPreview[];
  suggestionCatalogue: CategoryRhythmSuggestionCatalogue;
  categoryTabNavigationRequest?: CategoryTabNavigationRequest | null;
  foundationNavigationRequest?: { foundationId: string; requestId: number } | null;
  onFoundationNavigationHandled?: (requestId: number) => void;
  onAddRhythm: (event: MouseEvent<HTMLButtonElement>) => void;
  onAddLinkedRhythm?: (foundationId: string, event: MouseEvent<HTMLButtonElement>) => void;
  onSaveFoundationAssociations?: (
    foundationId: string,
    changes: readonly FoundationRhythmAssociationChange[]
  ) => string | null;
  onAddSuggestion?: (
    suggestion: CategoryRhythmSuggestion,
    event: MouseEvent<HTMLButtonElement>,
    returnToSuggestions: (saved: boolean) => void
  ) => void;
  onEditRhythm: (
    rhythm: RhythmPreview,
    event: MouseEvent<HTMLButtonElement>,
    returnToSuggestions?: (saved: boolean) => void
  ) => void;
  onRhythmHistory: (id: string, event: MouseEvent<HTMLButtonElement>, returnTab: 'today' | 'rhythms') => void;
  onRestoreRhythm: (id: string) => void;
  onTendRhythm: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onUndoRhythm: (id: string) => void;
  onPersonSelect: (id: PersonId) => void;
  onOpenFoundation: (id: string, openerId: string, returnTab: 'today' | 'rhythms') => void;
  onOpenCategory: (id: Destination, openerId: string) => void;
  healthScore: CategoryScoreSelection;
  weightHealthScore: CategoryScoreSelection;
  cardioHealthScore: CategoryScoreSelection;
  flexibilityHealthScore: CategoryScoreSelection;
  overallHealthScore?: number | null;
};

const categoryTabs: readonly SegmentedTab<HealthFitnessTab>[] = [
  { id: 'progress', label: 'Foundations', tabId: 'health-tab-foundations', panelId: 'health-panel-foundations' },
  { id: 'today', label: 'Today', tabId: 'health-tab-today', panelId: 'health-panel-today' },
  { id: 'rhythms', label: 'Rhythms', tabId: 'health-tab-rhythms', panelId: 'health-panel-rhythms' }
];

const progressDetails = healthFoundationDefinitions.map(({ id: foundationId, progressId: id, title, description }) => ({
  id,
  foundationId,
  title,
  description
}));

function linkedRhythmEvidence(
  foundationId: string,
  rhythms: readonly RhythmPreview[],
  archivedRhythms: readonly RhythmPreview[],
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>
): HealthAggregateEvidence {
  const selection = selectFoundationScore(
    foundationId,
    rhythms,
    rhythmScores,
    archivedRhythms.map(rhythm => rhythm.id)
  );
  const rows = selection.eligibleRhythmIds.flatMap(id => {
    const rhythm = rhythms.find(item => item.id === id);
    const result = rhythmScores.get(id);
    return rhythm && result?.kind === 'rhythm-score'
      && result.consistency.kind === 'scored'
      && result.onTrack.kind === 'scored'
      ? [{
          id,
          label: rhythm.title,
          consistency: result.consistency.score,
          onTrack: result.onTrack.score
        }]
      : [];
  });
  return {
    heading: 'Linked Rhythm scores',
    description: 'Each eligible linked Rhythm counts equally.',
    itemLabel: 'Rhythm',
    rows,
    otherCount: selection.activeLinkedRhythmIds.length - selection.eligibleRhythmIds.length,
    consistencyAverage: selection.consistency,
    consistencyCount: selection.eligibleRhythmIds.length,
    onTrackAverage: selection.onTrack,
    onTrackCount: selection.eligibleRhythmIds.length,
    coverage: `${selection.eligibleRhythmIds.length} of ${selection.activeLinkedRhythmIds.length} linked Rhythms scored.`,
    notes: [
      'Uses each Rhythm’s own scoring window and season schedules.',
      'Consistency contributes 75% and On Track contributes 25%.',
      ...(selection.archivedRhythmIds.length > 0
        ? [`${selection.archivedRhythmIds.length} archived linked Rhythms are excluded.`]
        : []),
      ...(selection.unresolvedRhythmIds.length > 0
        ? [`${selection.unresolvedRhythmIds.length} linked Rhythm scores could not be resolved.`]
        : []),
      ...(selection.excludedRhythms.length > 0
        ? ['Linked Rhythms without both scores are excluded from both averages.']
        : [])
    ],
    emptyState: selection.activeLinkedRhythmIds.length === 0
      ? noLinkedRhythmHealthMessage('Foundation')
      : 'Scores appear after an eligible linked Rhythm has its first due occurrence.',
    weightSummary: 'Consistency contributes 75% and On Track contributes 25%.'
  };
}

export function HealthFitnessView({
  people = syntheticPeople,
  hidden = false,
  strength,
  weight,
  cardio,
  flexibility,
  rhythms,
  archivedRhythms,
  todayDate,
  onHome,
  rhythmScores,
  completedRhythms,
  undoableRhythms,
  satisfiedRhythmIds = new Set(),
  tendedRhythmIds: savedTendedRhythmIds,
  initializing = false,
  foundations: allFoundations,
  categoryTabNavigationRequest = null,
  foundationNavigationRequest = null,
  onFoundationNavigationHandled,
  onAddRhythm,
  onAddLinkedRhythm,
  onSaveFoundationAssociations,
  suggestionCatalogue,
  onAddSuggestion,
  onEditRhythm,
  onRhythmHistory,
  onRestoreRhythm,
  onTendRhythm,
  onUndoRhythm,
  onPersonSelect,
  onOpenFoundation,
  onOpenCategory,
  healthScore,
  weightHealthScore,
  cardioHealthScore,
  flexibilityHealthScore,
  overallHealthScore = null
}: HealthFitnessViewProps) {
  const availability = useAreaAvailability();
  const foundations = useAvailableFoundations(allFoundations);
  const enabledFoundationIds = selectAvailableFoundationIds(availability, allFoundations);
  const enabledHealthFoundationIds = new Set(
    allFoundations
      .filter(foundation => foundation.categoryId === 'health' && enabledFoundationIds.has(foundation.id))
      .map(foundation => foundation.id)
  );
  const tendedRhythmIds = savedTendedRhythmIds
    ?? selectTendedRhythmDisplayIds(completedRhythms, satisfiedRhythmIds);
  const [selected, setSelected] = useState<HealthFitnessTab>('today');
  const [progressSelected, setProgressSelected] = useState<ProgressTab | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showArchivedRhythms, setShowArchivedRhythms] = useState(false);
  const archivedRhythmIds = new Set(archivedRhythms.map(rhythm => rhythm.id));
  const fitnessMeasureRows = ([
    {
      id: 'strength',
      label: 'Strength',
      consistency: strength.healthScore?.consistency ?? null,
      onTrack: strength.healthScore?.onTrack ?? null
    },
    {
      id: 'cardio',
      label: 'Cardio',
      consistency: cardioHealthScore.consistency,
      onTrack: cardioHealthScore.onTrack
    },
    {
      id: 'weight',
      label: 'Weight',
      consistency: weightHealthScore.consistency,
      onTrack: weightHealthScore.onTrack
    },
    {
      id: 'flexibility',
      label: 'Flexibility',
      consistency: flexibilityHealthScore.consistency,
      onTrack: flexibilityHealthScore.onTrack
    }
  ] satisfies HealthFitnessMeasureRow[])
    .filter(row => enabledHealthFoundationIds.has(`health-${row.id}`));
  const fitnessMeasureExplanations: Readonly<Record<HealthFitnessMeasureId, string>> = {
    strength: 'Averages active linked Strength Rhythms that have both Consistency and On Track scores.',
    cardio: 'Consistency averages completed weeks in the four-week lookback with a tracking start and trustworthy targets. On Track is the lower of weekly run-count and mileage progress (max 100%).',
    weight: 'Averages available scores from active linked Weight Rhythms separately for each measure.',
    flexibility: 'Averages active linked stretch Rhythms equally for Consistency and On Track, then blends the averages 75/25. Region history is diagnostic only.'
  };
  const fitnessMeasureEvidence: HealthAggregateEvidence = {
    heading: 'Health & Fitness measure scores',
    description: fitnessMeasureRows.length > 0
      ? 'Scores from enabled Foundations are averaged separately.'
      : 'No Health & Fitness Foundations are enabled, so this Category is unscored.',
    itemLabel: 'Measure',
    rows: fitnessMeasureRows,
    consistencyAverage: healthScore.consistency,
    consistencyCount: fitnessMeasureRows
      .filter(row => row.consistency !== null && Number.isFinite(row.consistency)).length,
    onTrackAverage: healthScore.onTrack,
    onTrackCount: fitnessMeasureRows
      .filter(row => row.onTrack !== null && Number.isFinite(row.onTrack)).length,
    averageLabels: {
      consistency: 'Average Consistency',
      onTrack: 'Average On Track'
    },
    notes: ['Unavailable scores are excluded.'],
    emptyState: 'No scores available yet.',
    showEmptyStateWhenNoAverages: true,
    weightSummary: null,
    areaExplanations: fitnessMeasureRows.map(row => ({
      label: row.label,
      explanation: fitnessMeasureExplanations[row.id]
    }))
  };
  const strengthScoringEvidence = linkedRhythmEvidence('health-strength', rhythms, archivedRhythms, rhythmScores);
  const weightScoringEvidence = linkedRhythmEvidence('health-weight', rhythms, archivedRhythms, rhythmScores);
  const flexibilityScoringEvidence = linkedRhythmEvidence('health-flexibility', rhythms, archivedRhythms, rhythmScores);
  const unlinkedStretchRhythmTitles = selectUnlinkedFlexibilityRhythms([
    ...rhythms,
    ...archivedRhythms
  ]).map(rhythm => `${rhythm.title}${archivedRhythmIds.has(rhythm.id) ? ' (archived)' : ''}`);
  const suggestionsOpenerRef = useRef<HTMLButtonElement | null>(null);
  const wasSuggestionsOpenRef = useRef(false);
  const skipSuggestionsFocusRestoreRef = useRef(false);
  const archiveOpenerRef = useRef<HTMLElement | null>(null);
  const wasArchiveOpenRef = useRef(false);
  const progressOpenerRef = useRef<HTMLButtonElement | null>(null);
  const progressScrollPositionRef = useRef<number | null>(null);
  const restoreProgressOverviewRef = useRef(false);
  const logReturnContextRef = useRef<{
    tab: HealthFitnessTab;
    opener: HTMLButtonElement;
    progress: ProgressTab | null;
  } | null>(null);
  const restoreLogFocusRef = useRef<HTMLButtonElement | null>(null);
  const timeOptions = useRhythmTimeOptions();
  const foundationDetailOpen = selected === 'progress' && progressSelected !== null;
  const todayRhythms = rhythms.filter(rhythm => isRhythmRelevantOnDate(rhythm, todayDate));
  const availableSuggestionCatalogue = {
    ...suggestionCatalogue,
    groups: suggestionCatalogue.groups.map(group => ({
      ...group,
      suggestions: selectAvailableFoundationLinkedItems(
        availability,
        group.suggestions,
        suggestion => foundationRhythmIds(suggestion.rhythm)
      )
    })).filter(group => group.suggestions.length > 0)
  };
  const hasAvailableSuggestions = availableSuggestionCatalogue.groups.length > 0;
  useEffect(() => {
    if (!hasAvailableSuggestions) setShowSuggestions(false);
  }, [hasAvailableSuggestions]);
  useEffect(() => {
    if (categoryTabNavigationRequest?.categoryId !== 'health') return;
    setProgressSelected(null);
    setSelected('progress');
  }, [categoryTabNavigationRequest?.requestId]);

  useEffect(() => {
    const request = foundationNavigationRequest;
    if (!request) return;
    const foundation = progressDetails.find(item => item.foundationId === request.foundationId);
    if (foundation && enabledHealthFoundationIds.has(request.foundationId)) {
      setSelected('progress');
      setProgressSelected(foundation.id);
    } else {
      setProgressSelected(null);
      setSelected('progress');
    }
    onFoundationNavigationHandled?.(request.requestId);
  }, [foundationNavigationRequest?.requestId, enabledHealthFoundationIds]);

  useEffect(() => {
    if (progressSelected === null) return;
    const foundation = progressDetails.find(detail => detail.id === progressSelected);
    if (!foundation || enabledHealthFoundationIds.has(foundation.foundationId)) return;
    setProgressSelected(null);
    setSelected('progress');
  }, [progressSelected, enabledHealthFoundationIds]);

  useLayoutEffect(() => {
    if (progressSelected !== null || !restoreProgressOverviewRef.current) return;
    const scrollPosition = progressScrollPositionRef.current;
    if (scrollPosition !== null && document.scrollingElement) {
      document.scrollingElement.scrollTop = scrollPosition;
    }
    progressOpenerRef.current?.focus({ preventScroll: true });
    progressOpenerRef.current = null;
    progressScrollPositionRef.current = null;
    restoreProgressOverviewRef.current = false;
  }, [progressSelected]);

  useEffect(() => {
    if (showArchivedRhythms) {
      wasArchiveOpenRef.current = true;
      return;
    }
    if (!wasArchiveOpenRef.current) return;
    wasArchiveOpenRef.current = false;
    archiveOpenerRef.current?.focus({ preventScroll: true });
  }, [showArchivedRhythms]);

  useEffect(() => {
    if (showSuggestions) {
      wasSuggestionsOpenRef.current = true;
      return;
    }
    if (!wasSuggestionsOpenRef.current) return;
    wasSuggestionsOpenRef.current = false;
    if (skipSuggestionsFocusRestoreRef.current) {
      skipSuggestionsFocusRestoreRef.current = false;
      return;
    }
    suggestionsOpenerRef.current?.focus({ preventScroll: true });
  }, [showSuggestions]);

  function browseSuggestions(event: MouseEvent<HTMLButtonElement>) {
    suggestionsOpenerRef.current = event.currentTarget;
    setShowSuggestions(true);
  }

  function returnToSuggestions(saved: boolean) {
    if (saved) setSelected('rhythms');
    setShowSuggestions(true);
  }

  function beginSuggestionAdd(
    suggestion: CategoryRhythmSuggestion,
    event: MouseEvent<HTMLButtonElement>,
    returnToPicker: (saved: boolean) => void
  ) {
    if (!onAddSuggestion) return;
    skipSuggestionsFocusRestoreRef.current = true;
    onAddSuggestion(suggestion, event, returnToPicker);
  }

  function beginSuggestionEdit(
    rhythm: RhythmPreview,
    event: MouseEvent<HTMLButtonElement>,
    returnToPicker: (saved: boolean) => void
  ) {
    skipSuggestionsFocusRestoreRef.current = true;
    onEditRhythm(rhythm, event, returnToPicker);
  }

  const suggestionPickerGroups: RhythmSuggestionPickerGroup[] = availableSuggestionCatalogue.groups.map(group => ({
    id: group.id,
    title: group.title,
    subtitle: group.subtitle,
    items: group.suggestions.map(suggestion => ({
      id: suggestion.sourceId,
      title: suggestion.rhythm.title,
      ...(suggestion.rhythm.description ? { description: suggestion.rhythm.description } : {}),
      scheduleHint: suggestion.scheduleHint,
      icon: suggestion.icon,
      instances: rhythmsForSuggestionSource([...rhythms, ...archivedRhythms], suggestion.sourceId)
        .map(instance => {
          const archived = archivedRhythmIds.has(instance.id);
          const schedule = effectiveRhythmSchedule(instance.schedule, instance.cadence);
          const summary = schedule
            ? rhythmScheduleSummary(schedule).replace(/\.$/, '')
            : instance.cadence ?? 'Schedule unavailable';
          const timeOfDay = instance.timeOfDay ?? rhythmTimeValueFromLabel(instance.timeLabel ?? '', timeOptions);
          const timeLabel = timeOfDay ? rhythmTimeLabel(timeOfDay, timeOptions) : undefined;
          return {
            id: instance.id,
            title: instance.title,
            scheduleSummary: timeLabel && timeLabel !== 'Anytime' ? `${summary} · ${timeLabel}` : summary,
            archived,
            ...(!archived
              ? { onEdit: (event: MouseEvent<HTMLButtonElement>, returnToPicker: (saved: boolean) => void) =>
                  beginSuggestionEdit(instance, event, returnToPicker) }
              : { onRestore: () => onRestoreRhythm(instance.id) })
          };
        }),
      onAdd: (event: MouseEvent<HTMLButtonElement>, returnToPicker: (saved: boolean) => void) =>
        beginSuggestionAdd(suggestion, event, returnToPicker)
    }))
  }));

  useEffect(() => {
    const pending = strength.pendingRhythmLog;
    if (!pending) return;
    if (!logReturnContextRef.current) {
      const opener = pending.opener
        ?? (document.activeElement instanceof HTMLButtonElement ? document.activeElement : null);
      if (opener) logReturnContextRef.current = { tab: selected, opener, progress: progressSelected };
    }
    setSelected('progress');
    setProgressSelected('strength');
  }, [strength.pendingRhythmLog?.requestId]);

  useEffect(() => {
    const pending = cardio.pendingLogRequest;
    if (!pending) return;
    if (!logReturnContextRef.current) {
      logReturnContextRef.current = { tab: selected, opener: pending.opener, progress: progressSelected };
    }
    setSelected('progress');
    setProgressSelected('cardio');
  }, [cardio.pendingLogRequest?.requestId]);

  useEffect(() => {
    const pending = weight.pendingLogRequest;
    if (!pending) return;
    if (!logReturnContextRef.current) {
      logReturnContextRef.current = { tab: selected, opener: pending.opener, progress: progressSelected };
    }
    setSelected('progress');
    setProgressSelected('weight');
  }, [weight.pendingLogRequest?.requestId]);

  useEffect(() => {
    const pending = flexibility.pendingQuickLog;
    if (!pending?.linkedRhythmId) return;
    if (!logReturnContextRef.current && pending.opener) {
      logReturnContextRef.current = {
        tab: selected,
        opener: pending.opener,
        progress: progressSelected
      };
    }
    setSelected('progress');
    setProgressSelected('flexibility');
  }, [flexibility.pendingQuickLog?.requestId]);

  useEffect(() => {
    if (!restoreLogFocusRef.current) return;
    const opener = restoreLogFocusRef.current;
    if (opener.isConnected) {
      opener.focus({ preventScroll: true });
    } else {
      document.querySelector<HTMLButtonElement>(
        '.health-fitness-progress__detail:not([hidden]) > .tend-back-button'
      )?.focus({ preventScroll: true });
    }
    restoreLogFocusRef.current = null;
  }, [selected, progressSelected]);

  function rememberLogContext(opener: HTMLButtonElement) {
    logReturnContextRef.current = { tab: selected, opener, progress: progressSelected };
  }

  function restoreLogContext() {
    const context = logReturnContextRef.current;
    if (!context) return;
    logReturnContextRef.current = null;
    restoreLogFocusRef.current = context.opener;
    setSelected(context.tab);
    if (context.progress !== null) setProgressSelected(context.progress);
  }

  function openRhythmLog(id: string, event: MouseEvent<HTMLButtonElement>) {
    const capability = rhythms.find(rhythm => rhythm.id === id)?.healthLogCapability;
    const section: ProgressTab = capability === 'cardio'
      ? 'cardio'
      : capability === 'weight' ? 'weight'
        : capability === 'flexibility' ? 'flexibility' : 'strength';
    rememberLogContext(event.currentTarget);
    setSelected('progress');
    setProgressSelected(section);
    onTendRhythm(id, event);
  }

  function returnToProgressOverview() {
    restoreProgressOverviewRef.current = true;
    setProgressSelected(null);
  }

  function renderFoundationHeading(foundationId: string) {
    const foundation = foundations.find(item => item.id === foundationId);
    if (!foundation) return null;
    return (
      <FoundationDetailHeader
        foundation={foundation}
        headingId={`health-foundation-${foundation.id}-title`}
        backLabel="All Foundations"
        onBack={returnToProgressOverview}
      />
    );
  }

  return (
    <main
      className={`category-page category-page--with-header category-page--segmented health-fitness-page${foundationDetailOpen ? ' health-fitness-page--foundation-detail' : ''}`}
      aria-labelledby={foundationDetailOpen ? undefined : 'health-fitness-title'}
      aria-label={foundationDetailOpen ? 'Health & Fitness Foundation' : undefined}
      hidden={hidden}
    >
      {!foundationDetailOpen && (
        <>
          <CategoryHeader
            title="Health & Fitness"
            titleId="health-fitness-title"
            icon={<AreaIcon id="health" />}
            onHome={onHome}
            subtitle="Structure beats good intentions"
          />

          <CategoryHealthSummary
            title="Health"
            contextTitle="Health & Fitness Health"
            score={healthScore}
            itemTerm={{ singular: 'measure', plural: 'measures' }}
            explanation={fitnessMeasureRows.length > 0
              ? `Health & Fitness Health averages available ${fitnessMeasureRows.map(row => row.label).join(', ')} measures; each measure uses its own eligible evidence.`
              : 'No Health & Fitness Foundations are enabled, so this Category is unscored.'}
            scoringEvidence={fitnessMeasureEvidence}
            describeRollup={false}
            coverageLabel={healthScore.consistency !== null && healthScore.onTrack !== null
              ? 'Health & Fitness Consistency and On Track are both scored.'
              : healthScore.consistency !== null
                ? 'Health & Fitness Consistency is scored; On Track is unavailable.'
                : healthScore.onTrack !== null
                  ? 'Health & Fitness On Track is scored; Consistency is unavailable.'
                  : fitnessMeasureRows.length === 0
                    ? 'No enabled Health & Fitness Foundations contribute to this score.'
                    : 'Health & Fitness Consistency and On Track are unavailable.'}
            consistencyDescription="The equal-weight average of available Consistency scores from enabled Health & Fitness Foundations."
            onTrackDescription="The equal-weight average of available On Track scores from enabled Health & Fitness Foundations."
            rollup={{
                  ...createHealthFitnessRollup('category', 'health-fitness', enabledHealthFoundationIds),
              healthContribution: createHealthFitnessHealthContribution({
                overallHealthScore,
                categoryHealthScore: healthScore.health,
                strengthHealthScore: strength.healthScore?.health ?? null,
                cardioHealthScore: cardioHealthScore.health,
                weightHealthScore: weightHealthScore.health,
                    flexibilityHealthScore: flexibilityHealthScore.health,
                    enabledFoundationIds: enabledHealthFoundationIds
              })
            }}
          />

          <SegmentedTabs
            tabs={categoryTabs}
            selectedTabId={selected}
            ariaLabel="Health and Fitness"
            onChange={setSelected}
          />
        </>
      )}

      <section id="health-panel-today" role="tabpanel" aria-labelledby="health-tab-today" hidden={selected !== 'today'}>
        <div className="health-fitness-today">
          <section className="marriage-today-section" aria-labelledby="health-today-heading">
            <header className="marriage-section-heading">
              <div>
                <h3 id="health-today-heading">Today</h3>
                <p>{todayRhythms.filter(rhythm => tendedRhythmIds.has(rhythm.id)).length} of {todayRhythms.length} Rhythms tended</p>
              </div>
            </header>
            <TendedRhythmList
              rhythms={todayRhythms}
              tendedRhythmIds={tendedRhythmIds}
              satisfiedRhythmIds={satisfiedRhythmIds}
              undoableRhythmIds={undoableRhythms}
              displayMode="done-rows"
              todayDate={todayDate}
              onUndo={onUndoRhythm}
              resetKey={`${selected}:${todayDate}`}
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
                const renderRhythmCard = (rhythm: RhythmPreview) => (
                          <RhythmDetailsDialog
                            rhythm={rhythm}
                            inline
                            completed={displayedTendedIds.has(rhythm.id)}
                            statusLabel={rhythmLastActivityLabel(rhythm, todayDate)}
                            people={people}
                            foundations={foundations}
                            relatedRhythms={rhythms}
                            onPersonSelect={onPersonSelect}
                            onOpenFoundation={(id, openerId) => onOpenFoundation(id, openerId, 'today')}
                            onOpenCategory={onOpenCategory}
                            headingId={`health-today-rhythm-${rhythm.id}`}
                            archived={false}
                            healthScore={rhythmHealthScore(rhythmScores.get(rhythm.id))}
                            onHistory={event => onRhythmHistory(rhythm.id, event, 'today')}
                            {...(isEditableRhythmId(rhythm.id)
                              ? {
                                  onTend: (event: MouseEvent<HTMLButtonElement>) => openRhythmLog(rhythm.id, event),
                                  onEdit: (event: MouseEvent<HTMLButtonElement>) => onEditRhythm(rhythm, event),
                                  ...(undoableRhythms.has(rhythm.id) && !rhythm.healthLogCapability
                                    ? { onUndo: () => onUndoTendedRhythm(rhythm.id) }
                                    : {}),
                                  completionActionLabel: 'Log',
                                  completionActionAccessibleLabel: rhythm.healthLogCapability === 'cardio'
                                    ? 'Log run'
                                    : rhythm.healthLogCapability === 'weight' ? 'Log weigh-in'
                                      : rhythm.healthLogCapability === 'flexibility'
                                        ? 'Start stretch routine' : 'Log workout',
                                  completedActionLabel: rhythm.healthLogCapability === 'weight'
                                    ? 'Weighed in'
                                    : rhythm.healthLogCapability === 'flexibility' ? 'Stretched' : 'Logged'
                                }
                              : {})}
                            onClose={() => undefined}
                          />
                );
                return (
                  <>
                    <TendedRhythmItems
                      className="marriage-rhythm-list current-plan-item-group"
                      rhythms={todayRhythms}
                      tendedRhythmIds={displayedTendedIds}
                      displayItems={tendedDisplayItems}
                      expandedRhythmIds={expandedTendedRhythmIds}
                      onToggleRhythm={onToggleTendedRhythm}
                      itemProps={itemProps}
                      renderRhythmCard={renderRhythmCard}
                      renderExpandedRhythm={item => renderRhythmCard(item.rhythm)}
                    />
                    {todayRhythms.length === 0 && (
                      <div className="marriage-empty-state">
                        <p>{rhythms.length > 0 ? 'All caught up. Nothing to tend to.' : 'No active Rhythms.'}</p>
                      </div>
                    )}
                  </>
                );
              }}
            </TendedRhythmList>
          </section>
        </div>
      </section>

      <section id="health-panel-rhythms" role="tabpanel" aria-labelledby="health-tab-rhythms" hidden={selected !== 'rhythms'}>
        <CategoryRhythmCollection
          people={people}
          categoryLabel="Health & Fitness"
          categoryToken="health"
          rhythms={rhythms}
          archivedRhythms={archivedRhythms}
          todayDate={todayDate}
          rhythmScores={rhythmScores}
          completedRhythms={completedRhythms}
          undoableRhythms={undoableRhythms}
          foundations={foundations}
          archivedRhythmsOpenerRef={archiveOpenerRef}
          showArchivedRhythms={showArchivedRhythms}
          onAddRhythm={onAddRhythm}
          {...(hasAvailableSuggestions
            ? { onBrowseSuggestions: browseSuggestions }
            : { suggestionsUnavailableReason: 'Suggestions for turned-off Foundations are hidden.' })}
          onShowArchivedRhythms={() => setShowArchivedRhythms(true)}
          onPersonSelect={onPersonSelect}
          onOpenFoundation={(id, openerId) => onOpenFoundation(id, openerId, 'rhythms')}
          onOpenCategory={onOpenCategory}
          onRhythmHistory={(id, event) => onRhythmHistory(id, event, 'rhythms')}
          onEditRhythm={onEditRhythm}
          onTend={openRhythmLog}
          onUndo={onUndoRhythm}
          completionActionLabelFor={() => 'Log'}
          completionActionAccessibleLabelFor={rhythm => rhythm.healthLogCapability === 'cardio'
            ? 'Log run'
            : rhythm.healthLogCapability === 'weight' ? 'Log weigh-in'
              : rhythm.healthLogCapability === 'flexibility' ? 'Start stretch routine' : 'Log workout'}
          completedActionLabelFor={rhythm => rhythm.healthLogCapability === 'weight'
            ? 'Weighed in' : rhythm.healthLogCapability === 'flexibility' ? 'Stretched' : 'Logged'}
        />
      </section>

      <section
        id="health-panel-foundations"
        {...(foundationDetailOpen
          ? { role: 'region' as const, 'aria-label': 'Foundations' }
          : { role: 'tabpanel' as const, 'aria-labelledby': 'health-tab-foundations' })}
        hidden={selected !== 'progress'}
      >
        <div className="health-fitness-progress">
          <section className="health-fitness-progress__overview" aria-label="Foundations" hidden={progressSelected !== null}>
            <div className="marriage-foundation-list">
              {progressDetails.map(detail => {
                const foundation = foundations.find(item => item.id === detail.foundationId);
                if (!foundation) return null;
                const scores = {
                  strength: strength.healthScore,
                  cardio: cardioHealthScore,
                  weight: weightHealthScore,
                  flexibility: flexibilityHealthScore
                };
                return (
                  <FoundationCard
                    key={detail.id}
                    foundation={foundation}
                    variant="compact"
                    score={scores[detail.id]?.health ?? null}
                    scoreLabel={`${foundation.name} Health`}
                    icon={<MarriageIcon group="foundations" id={foundation.id} />}
                    onSelect={event => {
                      progressOpenerRef.current = event.currentTarget;
                      progressScrollPositionRef.current = document.scrollingElement?.scrollTop ?? null;
                      restoreProgressOverviewRef.current = false;
                      setProgressSelected(detail.id);
                    }}
                  />
                );
              })}
            </div>
          </section>
          <section className="health-fitness-progress__detail tend-back-stack" aria-label="Strength Foundation" hidden={progressSelected !== 'strength'}>
            {renderFoundationHeading('health-strength')}
            <StrengthView
              {...strength}
              foundations={foundations}
              rhythmScores={rhythmScores}
              completedRhythms={completedRhythms}
              undoableRhythms={undoableRhythms}
              healthScoringEvidence={strengthScoringEvidence}
              overallHealthScore={overallHealthScore}
              categoryHealthScore={healthScore.health}
              foundationNavigation
              foundationActive={!hidden && selected === 'progress' && progressSelected === 'strength'}
              {...(onAddLinkedRhythm ? { onAddLinkedRhythm } : {})}
              {...(onSaveFoundationAssociations ? { onSaveFoundationAssociations } : {})}
              onRhythmHistory={(id, event) => onRhythmHistory(id, event, 'rhythms')}
              onEditRhythm={(rhythm, event) => onEditRhythm(rhythm, event)}
              onTend={openRhythmLog}
              onUndo={onUndoRhythm}
              onPersonSelect={onPersonSelect}
              onOpenFoundation={(id, openerId) => onOpenFoundation(id, openerId, 'today')}
              onOpenCategory={onOpenCategory}
              onRhythmLogClosed={restoreLogContext}
            />
          </section>
          <section className="health-fitness-progress__detail tend-back-stack" aria-label="Cardio Foundation" hidden={progressSelected !== 'cardio'}>
            {renderFoundationHeading('health-cardio')}
            <CardioView
              {...cardio}
              overallHealthScore={overallHealthScore}
              categoryHealthScore={healthScore.health}
              foundationNavigation
              foundationActive={!hidden && selected === 'progress' && progressSelected === 'cardio'}
              weightData={weight.data}
              people={people}
              archivedRhythms={archivedRhythms}
              foundations={foundations}
              rhythmScores={rhythmScores}
              completedRhythms={completedRhythms}
              undoableRhythms={undoableRhythms}
              {...(onAddLinkedRhythm ? { onAddLinkedRhythm } : {})}
              {...(onSaveFoundationAssociations ? { onSaveFoundationAssociations } : {})}
              onRhythmHistory={(id, event) => onRhythmHistory(id, event, 'rhythms')}
              onEditRhythm={(rhythm, event) => onEditRhythm(rhythm, event)}
              onTend={openRhythmLog}
              onUndo={onUndoRhythm}
              onPersonSelect={onPersonSelect}
              onOpenFoundation={(id, openerId) => onOpenFoundation(id, openerId, 'today')}
              onOpenCategory={onOpenCategory}
              onLogRequestClosed={restoreLogContext}
            />
          </section>
          <section className="health-fitness-progress__detail tend-back-stack" aria-label="Weight Foundation" hidden={progressSelected !== 'weight'}>
            {renderFoundationHeading('health-weight')}
            <WeightView
              {...weight}
              healthScoringEvidence={weightScoringEvidence}
              healthScore={weightHealthScore}
              overallHealthScore={overallHealthScore}
              categoryHealthScore={healthScore.health}
              foundationNavigation
              foundationActive={!hidden && selected === 'progress' && progressSelected === 'weight'}
              people={people}
              archivedRhythms={archivedRhythms}
              foundations={foundations}
              rhythmScores={rhythmScores}
              completedRhythms={completedRhythms}
              undoableRhythms={undoableRhythms}
              {...(onAddLinkedRhythm ? { onAddLinkedRhythm } : {})}
              {...(onSaveFoundationAssociations ? { onSaveFoundationAssociations } : {})}
              onRhythmHistory={(id, event) => onRhythmHistory(id, event, 'rhythms')}
              onEditRhythm={(rhythm, event) => onEditRhythm(rhythm, event)}
              onTend={openRhythmLog}
              onUndo={onUndoRhythm}
              onPersonSelect={onPersonSelect}
              onOpenFoundation={(id, openerId) => onOpenFoundation(id, openerId, 'today')}
              onOpenCategory={onOpenCategory}
              onLogRequestClosed={restoreLogContext}
            />
          </section>
          <section className="health-fitness-progress__detail tend-back-stack" aria-label="Flexibility Foundation" hidden={progressSelected !== 'flexibility'}>
            {renderFoundationHeading('health-flexibility')}
            <FlexibilityView
              {...flexibility}
              healthScore={flexibilityHealthScore}
              scoringEvidence={flexibilityScoringEvidence}
              unlinkedStretchRhythmTitles={unlinkedStretchRhythmTitles}
              overallHealthScore={overallHealthScore}
              categoryHealthScore={healthScore.health}
              foundationNavigation
              foundationActive={!hidden && selected === 'progress' && progressSelected === 'flexibility'}
              people={people}
              rhythms={rhythms}
              archivedRhythms={archivedRhythms}
              foundations={foundations}
              rhythmScores={rhythmScores}
              completedRhythms={completedRhythms}
              undoableRhythms={undoableRhythms}
              {...(onAddLinkedRhythm ? { onAddLinkedRhythm } : {})}
              {...(onSaveFoundationAssociations ? { onSaveFoundationAssociations } : {})}
              onRhythmHistory={(id, event) => onRhythmHistory(id, event, 'rhythms')}
              onEditRhythm={(rhythm, event) => onEditRhythm(rhythm, event)}
              onTend={openRhythmLog}
              onUndo={onUndoRhythm}
              onPersonSelect={onPersonSelect}
              onOpenFoundation={(id, openerId) => onOpenFoundation(id, openerId, 'today')}
              onOpenCategory={onOpenCategory}
              pendingQuickLog={flexibility.pendingQuickLog ?? null}
              onQuickLogOpened={requestId => flexibility.onQuickLogOpened?.(requestId)}
              onLogRequestClosed={restoreLogContext}
            />
          </section>
        </div>
      </section>

      {showArchivedRhythms && (
        <ArchivedRhythmsDialog
          rhythms={archivedRhythms}
          people={people}
          foundations={foundations}
          completedRhythms={completedRhythms}
          onPersonSelect={onPersonSelect}
          onOpenFoundation={(id, openerId) => {
            setShowArchivedRhythms(false);
            onOpenFoundation(id, openerId, 'rhythms');
          }}
          onOpenCategory={(id, openerId) => {
            setShowArchivedRhythms(false);
            onOpenCategory(id, openerId);
          }}
          onRestore={onRestoreRhythm}
          onClose={() => setShowArchivedRhythms(false)}
        />
      )}
      {hasAvailableSuggestions && <RhythmSuggestionPicker
        title={availableSuggestionCatalogue.title}
        open={showSuggestions}
        groups={suggestionPickerGroups}
        onClose={() => setShowSuggestions(false)}
        onReopen={returnToSuggestions}
      />}
    </main>
  );
}
