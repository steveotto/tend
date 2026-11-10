import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { StrengthView } from './StrengthView.tsx';
import type { StrengthViewProps } from './StrengthView.tsx';
import { WeightView } from './WeightView.tsx';
import type { WeightViewProps } from './WeightView.tsx';
import { CardioView } from './CardioView.tsx';
import { FlexibilityView } from './FlexibilityView.tsx';
import type { FlexibilityViewProps } from './FlexibilityView.tsx';
import { BackButton } from './BackButton.tsx';
import type { CardioViewProps } from './CardioView.tsx';
import { CategoryHealthSummary } from './CategoryHealthSummary.tsx';
import { CategoryHeader } from './CategoryHeader.tsx';
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
import { isFlexibilityRegionId } from '../domain/flexibility.ts';
import type { FlexibilityRegionId } from '../domain/flexibility.ts';
import { selectFoundationScore } from '../domain/foundation-scoring.ts';
import type { CategoryTabNavigationRequest, Destination } from './AppNavigation.tsx';
import { healthFoundationDefinitions, syntheticPeople } from '../domain/preview-data.ts';
import type { FoundationPreview, PersonId, PersonPreview, RhythmPreview } from '../domain/preview-data.ts';
import { peopleForRhythm, rhythmLastActivityLabel } from '../domain/preview-data.ts';
import { isRhythmRelevantOnDate, rhythmsForSuggestionSource } from '../domain/category-rhythms.ts';
import { effectiveRhythmSchedule, rhythmScheduleSummary, rhythmTimeLabel, rhythmTimeValueFromLabel } from '../domain/rhythm-schedule.ts';
import type { RhythmScoreResult } from '../domain/rhythm-scoring.ts';
import { rhythmHealthScore } from '../domain/rhythm-scoring.ts';
import { isEditableRhythmId } from '../domain/rhythm-editor.ts';
import { TendedRhythmList } from './TendedRhythmList.tsx';
import { selectTendedRhythmDisplayIds } from '../domain/category-rhythms.ts';
import { createHealthFitnessHealthContribution, createHealthFitnessRollup } from './HealthRollupDiagram.tsx';
import { useRhythmTimeOptions } from './TimeBlocksContext.tsx';
import type { HealthAggregateEvidence } from './HealthScoringDetailsCard.tsx';

type HealthFitnessTab = 'today' | 'rhythms' | 'progress';
type ProgressTab = (typeof healthFoundationDefinitions)[number]['progressId'];

type HealthFitnessViewProps = {
  people?: readonly PersonPreview[];
  hidden?: boolean;
  strength: StrengthViewProps;
  weight: WeightViewProps;
  cardio: CardioViewProps;
  flexibility: FlexibilityViewProps;
  rhythms: readonly RhythmPreview[];
  archivedRhythms: readonly RhythmPreview[];
  todayDate: string;
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>;
  completedRhythms: ReadonlySet<string>;
  undoableRhythms: ReadonlySet<string>;
  satisfiedRhythmIds?: ReadonlySet<string>;
  tendedRhythmIds?: ReadonlySet<string>;
  showTended?: boolean;
  onShowTendedChange?: (show: boolean) => void;
  initializing?: boolean;
  foundations: readonly FoundationPreview[];
  suggestionCatalogue: CategoryRhythmSuggestionCatalogue;
  categoryTabNavigationRequest?: CategoryTabNavigationRequest | null;
  foundationNavigationRequest?: { foundationId: string; requestId: number } | null;
  onFoundationNavigationHandled?: (requestId: number) => void;
  onAddRhythm: (event: MouseEvent<HTMLButtonElement>) => void;
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
    emptyState: 'No eligible linked Rhythms have both scores available.'
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
  rhythmScores,
  completedRhythms,
  undoableRhythms,
  satisfiedRhythmIds = new Set(),
  tendedRhythmIds: savedTendedRhythmIds,
  showTended = false,
  onShowTendedChange = () => undefined,
  initializing = false,
  foundations,
  categoryTabNavigationRequest = null,
  foundationNavigationRequest = null,
  onFoundationNavigationHandled,
  onAddRhythm,
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
  const tendedRhythmIds = savedTendedRhythmIds
    ?? selectTendedRhythmDisplayIds(completedRhythms, satisfiedRhythmIds);
  const [selected, setSelected] = useState<HealthFitnessTab>('today');
  const [progressSelected, setProgressSelected] = useState<ProgressTab | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showArchivedRhythms, setShowArchivedRhythms] = useState(false);
  const [pendingFlexibilityLog, setPendingFlexibilityLog] = useState<{
    requestId: number;
    regionIds: FlexibilityRegionId[];
  } | null>(null);
  const flexibilityLogRequestSequence = useRef(0);
  const fitnessMeasureRows = [
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
      onTrack: null
    }
  ] satisfies HealthAggregateEvidence['rows'];
  const fitnessMeasureEvidence: HealthAggregateEvidence = {
    heading: 'Health & Fitness measure scores',
    description: 'Available scores are averaged separately.',
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
    areaExplanations: [
      {
        label: 'Strength',
        explanation: 'Averages active linked Strength Rhythms that have both Consistency and On Track scores.'
      },
      {
        label: 'Cardio',
        explanation: 'Consistency averages completed weeks in the four-week lookback with a tracking start and trustworthy targets. On Track is the lower of weekly run-count and mileage progress (max 100%).'
      },
      {
        label: 'Weight',
        explanation: 'Averages available scores from active linked Weight Rhythms separately for each measure.'
      },
      {
        label: 'Flexibility',
        explanation: 'Consistency averages regions with valid stretch history; each region loses 10 points per day overdue beyond its interval. On Track is not scored.'
      }
    ]
  };
  const strengthScoringEvidence = linkedRhythmEvidence('health-strength', rhythms, archivedRhythms, rhythmScores);
  const weightScoringEvidence = linkedRhythmEvidence('health-weight', rhythms, archivedRhythms, rhythmScores);
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
  useEffect(() => {
    if (categoryTabNavigationRequest?.categoryId !== 'health') return;
    setProgressSelected(null);
    setSelected('progress');
  }, [categoryTabNavigationRequest?.requestId]);

  useEffect(() => {
    const request = foundationNavigationRequest;
    if (!request) return;
    const foundation = progressDetails.find(item => item.foundationId === request.foundationId);
    if (foundation) {
      setSelected('progress');
      setProgressSelected(foundation.id);
      onFoundationNavigationHandled?.(request.requestId);
    }
  }, [foundationNavigationRequest?.requestId]);

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

  const archivedRhythmIds = new Set(archivedRhythms.map(rhythm => rhythm.id));
  const suggestionPickerGroups: RhythmSuggestionPickerGroup[] = suggestionCatalogue.groups.map(group => ({
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

  function openStretchAfter(
    muscleIds: readonly string[],
    event: MouseEvent<HTMLButtonElement>
  ) {
    const regionIds = muscleIds.filter(isFlexibilityRegionId);
    flexibilityLogRequestSequence.current += 1;
    rememberLogContext(event.currentTarget);
    setPendingFlexibilityLog({
      requestId: flexibilityLogRequestSequence.current,
      regionIds
    });
    setSelected('progress');
    setProgressSelected('flexibility');
  }

  function returnToProgressOverview() {
    restoreProgressOverviewRef.current = true;
    setProgressSelected(null);
  }

  function renderProgressOverviewLink() {
    return (
      <BackButton onClick={returnToProgressOverview}>All Foundations</BackButton>
    );
  }

  function renderFoundationHeading(foundationId: string) {
    const foundation = foundations.find(item => item.id === foundationId);
    if (!foundation) return null;
    return (
      <FoundationDetailHeader
        foundation={foundation}
        headingId={`health-foundation-${foundation.id}-title`}
      />
    );
  }

  return (
    <main
      className={`category-page category-page--with-header health-fitness-page${foundationDetailOpen ? ' health-fitness-page--foundation-detail' : ''}`}
      aria-labelledby={foundationDetailOpen ? undefined : 'health-fitness-title'}
      aria-label={foundationDetailOpen ? 'Health & Fitness Foundation' : undefined}
      hidden={hidden}
    >
      {!foundationDetailOpen && (
        <>
          <CategoryHeader
            title="Health & Fitness"
            titleId="health-fitness-title"
            subtitle="Structure beats good intentions"
          />

          <CategoryHealthSummary
            title="Health & Fitness Health"
            score={healthScore}
            itemTerm={{ singular: 'measure', plural: 'measures' }}
            explanation="Health & Fitness Health averages available Strength, Cardio, Weight, and Flexibility measures; each measure uses its own eligible evidence."
            scoringEvidence={fitnessMeasureEvidence}
            describeRollup={false}
            coverageLabel={healthScore.consistency !== null && healthScore.onTrack !== null
              ? 'Health & Fitness Consistency and On Track are both scored.'
              : healthScore.consistency !== null
                ? 'Health & Fitness Consistency is scored; On Track is unavailable.'
                : healthScore.onTrack !== null
                  ? 'Health & Fitness On Track is scored; Consistency is unavailable.'
                  : 'Health & Fitness Consistency and On Track are unavailable.'}
            consistencyDescription="The equal-weight average of available Strength, Cardio, Weight, and Flexibility Consistency measures."
            onTrackDescription="The equal-weight average of available Strength, Cardio, and Weight On Track measures."
            rollup={{
              ...createHealthFitnessRollup('category', 'health-fitness'),
              healthContribution: createHealthFitnessHealthContribution({
                overallHealthScore,
                categoryHealthScore: healthScore.health,
                strengthHealthScore: strength.healthScore?.health ?? null,
                cardioHealthScore: cardioHealthScore.health,
                weightHealthScore: weightHealthScore.health,
                flexibilityHealthScore: flexibilityHealthScore.health
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
              showTended={showTended}
              onShowTendedChange={onShowTendedChange}
              onUndo={onUndoRhythm}
              resetKey={`${selected}:${todayDate}`}
              initializing={initializing}
            >
              {({ visibleRhythmIds, tendedRhythmIds: displayedTendedIds, itemProps }) => {
                const visibleRhythms = todayRhythms.filter(rhythm => visibleRhythmIds.has(rhythm.id));
                return visibleRhythms.length > 0
                  ? (
                    <div className="marriage-rhythm-list current-plan-item-group">
                      {visibleRhythms.map(rhythm => (
                        <div key={rhythm.id} {...itemProps(rhythm.id)}>
                          <RhythmDetailsDialog
                            rhythm={rhythm}
                            inline
                            completed={displayedTendedIds.has(rhythm.id)}
                            statusLabel={rhythmLastActivityLabel(rhythm, todayDate)}
                            people={peopleForRhythm(rhythm, people)}
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
                                    ? { onUndo: () => onUndoRhythm(rhythm.id) }
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
                        </div>
                      ))}
                    </div>
                  )
                  : todayRhythms.length > 0
                    ? <div className="marriage-empty-state" role="status"><p>You’ve tended everything here.</p></div>
                    : (
                      <div className="marriage-empty-state">
                        <p>{rhythms.length > 0 ? 'All caught up. Nothing to tend to.' : 'No active Rhythms.'}</p>
                      </div>
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
          onBrowseSuggestions={browseSuggestions}
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
            {renderProgressOverviewLink()}
            {renderFoundationHeading('health-strength')}
            <StrengthView
              {...strength}
              healthScoringEvidence={strengthScoringEvidence}
              overallHealthScore={overallHealthScore}
              categoryHealthScore={healthScore.health}
              foundationNavigation
              onRhythmLogClosed={restoreLogContext}
              onStretchAfter={openStretchAfter}
            />
          </section>
          <section className="health-fitness-progress__detail tend-back-stack" aria-label="Cardio Foundation" hidden={progressSelected !== 'cardio'}>
            {renderProgressOverviewLink()}
            {renderFoundationHeading('health-cardio')}
            <CardioView
              {...cardio}
              overallHealthScore={overallHealthScore}
              categoryHealthScore={healthScore.health}
              foundationNavigation
              onLogRequestClosed={restoreLogContext}
            />
          </section>
          <section className="health-fitness-progress__detail tend-back-stack" aria-label="Weight Foundation" hidden={progressSelected !== 'weight'}>
            {renderProgressOverviewLink()}
            {renderFoundationHeading('health-weight')}
            <WeightView
              {...weight}
              healthScoringEvidence={weightScoringEvidence}
              healthScore={weightHealthScore}
              overallHealthScore={overallHealthScore}
              categoryHealthScore={healthScore.health}
              foundationNavigation
              onLogRequestClosed={restoreLogContext}
            />
          </section>
          <section className="health-fitness-progress__detail tend-back-stack" aria-label="Flexibility Foundation" hidden={progressSelected !== 'flexibility'}>
            {renderProgressOverviewLink()}
            {renderFoundationHeading('health-flexibility')}
            <FlexibilityView
              {...flexibility}
              overallHealthScore={overallHealthScore}
              categoryHealthScore={healthScore.health}
              foundationNavigation
              pendingQuickLog={pendingFlexibilityLog ?? flexibility.pendingQuickLog ?? null}
              onQuickLogOpened={requestId => {
                setPendingFlexibilityLog(current =>
                  current?.requestId === requestId ? null : current
                );
                flexibility.onQuickLogOpened?.(requestId);
              }}
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
      <RhythmSuggestionPicker
        title={suggestionCatalogue.title}
        open={showSuggestions}
        groups={suggestionPickerGroups}
        onClose={() => setShowSuggestions(false)}
        onReopen={returnToSuggestions}
      />
    </main>
  );
}
