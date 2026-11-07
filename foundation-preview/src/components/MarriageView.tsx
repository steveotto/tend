import { useEffect, useId, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import {
  marriageRhythmGroups,
  marriageRhythmSuggestions,
  foundationCatalogue,
  foundationTerminologyForCategory,
  type CategoryId,
  peopleForRhythm,
  rhythmLastActivityLabel,
  type FoundationTerminology,
  type FoundationPreview,
  type PersonId,
  type PersonPickerGroup,
  type PersonPreview,
  type RhythmPreview,
  rhythmsSupportingFoundation
} from '../domain/preview-data.ts';
import { effectiveRhythmSchedule, rhythmScheduleSummary, rhythmTimeLabel, rhythmTimeValueFromLabel } from '../domain/rhythm-schedule.ts';
import {
  isRhythmRelevantOnDate,
  rhythmsForSuggestionSource
} from '../domain/category-rhythms.ts';
import {
  foundationRhythmIds,
  missingRequiredFoundationCategories
} from '../domain/foundation-rhythm-associations.ts';
import type { FoundationRhythmAssociationChange } from '../domain/foundation-rhythm-associations.ts';
import { selectCategoryScore } from '../domain/category-scoring.ts';
import type { CategoryScoreSelection } from '../domain/category-scoring.ts';
import { rhythmHealthScore } from '../domain/rhythm-scoring.ts';
import { selectFoundationScore } from '../domain/foundation-scoring.ts';
import type { FoundationScoreSelection } from '../domain/foundation-scoring.ts';
import { isEditableRhythmId } from '../domain/rhythm-editor.ts';
import type { RhythmScoreResult } from '../domain/rhythm-scoring.ts';
import { FoundationCard } from './Cards.tsx';
import { FoundationDetailHeader } from './FoundationDetailHeader.tsx';
import { BackButton } from './BackButton.tsx';
import { HealthScoreInfoButton } from './HealthScoreBreakdown.tsx';
import { HealthScoreDetailsDialog } from './HealthScoreDetailsDialog.tsx';
import { HealthScoreDetailsContent } from './HealthScoreDetailsContent.tsx';
import type { HealthAggregateEvidence } from './HealthScoringDetailsCard.tsx';
import type { HealthRollupConfig, HealthRollupGroup } from './HealthRollupDiagram.tsx';
import { CategoryHealthSummary } from './CategoryHealthSummary.tsx';
import { CategoryHeader } from './CategoryHeader.tsx';
import { SegmentedTabs } from './SegmentedTabs.tsx';
import type { SegmentedTab } from './SegmentedTabs.tsx';
import { ArchivedRhythmsDialog } from './ArchivedRhythmsDialog.tsx';
import { FoundationRhythmAssociationDialog } from './FoundationRhythmAssociationDialog.tsx';
import { MarriageIcon } from './MarriageIcon.tsx';
import { RhythmDetailsDialog } from './RhythmDetailsDialog.tsx';
import { CategoryRhythmCollection } from './CategoryRhythmCollection.tsx';
import { RhythmSuggestionPicker } from './RhythmSuggestionPicker.tsx';
import type { RhythmSuggestionPickerGroup } from './RhythmSuggestionPicker.tsx';
import type { CategoryTabNavigationRequest, Destination } from './AppNavigation.tsx';
import type { RhythmCategoryId } from '../domain/rhythm-editor.ts';
import type { RhythmFrequencyRecommendation } from '../domain/rhythm-schedule.ts';
import { resolvePersonCategoryGroups } from '../domain/person-categories.ts';
import { PersonBadgeVisual } from './PersonBadge.tsx';
import { useRhythmTimeOptions } from './TimeBlocksContext.tsx';
import { TendedRhythmList } from './TendedRhythmList.tsx';
import { selectTendedRhythmDisplayIds } from '../domain/category-rhythms.ts';

export type MarriageTab = 'today' | 'rhythms' | 'foundations';

export type CategoryRhythmSuggestion = {
  sourceId: string;
  categoryId: RhythmCategoryId;
  rhythm: RhythmPreview;
  scheduleHint: string;
  icon: ReactNode;
  recommendedFrequency: RhythmFrequencyRecommendation;
  frequencyGuidance?: string;
  healthWorkoutMode?: 'recommended' | 'specific';
};

export type CategoryRhythmSuggestionGroup = {
  id: string;
  title: string;
  subtitle: string;
  suggestions: readonly CategoryRhythmSuggestion[];
};

export type CategoryRhythmSuggestionCatalogue = {
  title: string;
  groups: readonly CategoryRhythmSuggestionGroup[];
};

export function createMarriageSuggestionCatalogue(
  suggestionRhythms: readonly RhythmPreview[]
): CategoryRhythmSuggestionCatalogue {
  const suggestionById = new Map(suggestionRhythms.map(rhythm => [rhythm.id, rhythm]));
  return {
    title: 'Marriage rhythms',
    groups: marriageRhythmGroups.map(group => ({
      id: group.id,
      title: group.title,
      subtitle: group.subtitle,
      suggestions: marriageRhythmSuggestions
        .filter(suggestion => suggestion.rhythm.marriageGroup === group.id)
        .map(suggestion => {
          const source = suggestion.sourceSampleRhythmId
            ? suggestionById.get(suggestion.sourceSampleRhythmId)
            : undefined;
          return {
            sourceId: suggestion.templateId,
            categoryId: 'marriage',
            rhythm: {
              ...suggestion.rhythm,
              ...(source ? {
                description: source.description ?? suggestion.rhythm.description,
                primaryFoundationId: source.primaryFoundationId ?? suggestion.rhythm.primaryFoundationId,
                secondaryFoundationIds: source.secondaryFoundationIds ?? suggestion.rhythm.secondaryFoundationIds
              } : {})
            },
            scheduleHint: suggestion.scheduleHint,
            icon: <MarriageIcon group="rhythms" id={suggestion.rhythm.iconId ?? suggestion.templateId} />,
            recommendedFrequency: suggestion.recommendedFrequency,
            ...(suggestion.frequencyGuidance ? { frequencyGuidance: suggestion.frequencyGuidance } : {})
          };
        })
    }))
  };
}

type MarriageViewProps = {
  people?: readonly PersonPreview[];
  peopleGroups?: readonly PersonPickerGroup[];
  categoryConfig?: {
    categoryId: RhythmCategoryId;
    label: string;
    description: string;
    foundations: readonly FoundationPreview[];
    foundationTerm?: FoundationTerminology;
    tabLabel?: string;
    scoreInterpretationNote?: string;
    scoreExplanationIntro?: string;
    suggestionCatalogue?: CategoryRhythmSuggestionCatalogue;
  };
  todayDate: string;
  onAddRhythm: (event: MouseEvent<HTMLButtonElement>) => void;
  onAddLinkedRhythm: (foundationId: string, event: MouseEvent<HTMLButtonElement>) => void;
  onAddSuggestion?: (
    suggestion: CategoryRhythmSuggestion,
    event: MouseEvent<HTMLButtonElement>,
    returnToSuggestions: (saved: boolean) => void
  ) => void;
  onPersonSelect: (personId: PersonId) => void;
  onOpenPeople: () => void;
  onOpenCategory: (categoryId: Destination, openerId: string) => void;
  onRhythmHistory: (id: string, event: MouseEvent<HTMLButtonElement>, returnTab?: MarriageTab) => void;
  onEditRhythm: (
    rhythm: RhythmPreview,
    event: MouseEvent<HTMLButtonElement>,
    returnToSuggestions?: (saved: boolean) => void
  ) => void;
  onRestoreRhythm: (id: string) => void;
  userRhythms: readonly RhythmPreview[];
  archivedRhythms: readonly RhythmPreview[];
  foundationRhythms: readonly RhythmPreview[];
  suggestionRhythms: readonly RhythmPreview[];
  suggestionInstances: readonly RhythmPreview[];
  foundationRhythmScores: ReadonlyMap<string, RhythmScoreResult>;
  overallHealthScore?: number | null;
  archivedRhythmIds: readonly string[];
  completedRhythms: ReadonlySet<string>;
  undoableRhythms: ReadonlySet<string>;
  satisfiedRhythmIds?: ReadonlySet<string>;
  tendedRhythmIds?: ReadonlySet<string>;
  showTended?: boolean;
  onShowTendedChange?: (show: boolean) => void;
  initializing?: boolean;
  onTend: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onUndo: (id: string) => void;
  onSaveFoundationAssociations: (
    foundationId: string,
    changes: readonly FoundationRhythmAssociationChange[]
  ) => string | null;
  foundationNavigationRequest?: {
    foundationId: string;
    requestId: number;
    returnTab: MarriageTab;
  } | null;
  categoryTabNavigationRequest?: CategoryTabNavigationRequest | null;
  onFoundationNavigationHandled?: (requestId: number) => void;
};

const tabs: readonly SegmentedTab<MarriageTab>[] = [
  { id: 'foundations', label: 'Foundations', tabId: 'foundations', panelId: 'marriage-panel-foundations' },
  { id: 'today', label: 'Today', tabId: 'today', panelId: 'marriage-panel-today' },
  { id: 'rhythms', label: 'Rhythms', tabId: 'rhythms', panelId: 'marriage-panel-rhythms' }
];

export function MarriageView({
  people = [],
  peopleGroups = [],
  categoryConfig,
  todayDate,
  onAddRhythm,
  onAddLinkedRhythm,
  onAddSuggestion,
  onPersonSelect,
  onOpenPeople,
  onOpenCategory,
  onRhythmHistory,
  onEditRhythm,
  onRestoreRhythm,
  userRhythms,
  archivedRhythms,
  foundationRhythms,
  suggestionRhythms,
  suggestionInstances,
  foundationRhythmScores,
  overallHealthScore = null,
  archivedRhythmIds,
  completedRhythms,
  undoableRhythms,
  satisfiedRhythmIds = new Set(),
  tendedRhythmIds: savedTendedRhythmIds,
  showTended = false,
  onShowTendedChange = () => undefined,
  initializing = false,
  onTend,
  onUndo,
  onSaveFoundationAssociations,
  foundationNavigationRequest = null,
  categoryTabNavigationRequest = null,
  onFoundationNavigationHandled
}: MarriageViewProps) {
  const tendedRhythmIds = savedTendedRhythmIds
    ?? selectTendedRhythmDisplayIds(completedRhythms, satisfiedRhythmIds);
  const timeOptions = useRhythmTimeOptions();
  const [activeTab, setActiveTab] = useState<MarriageTab>('today');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showArchivedRhythms, setShowArchivedRhythms] = useState(false);
  const [selectedFoundationId, setSelectedFoundationId] = useState<string | null>(null);
  const [associationFoundationId, setAssociationFoundationId] = useState<string | null>(null);
  const foundationOpener = useRef<{ id: string; tab: MarriageTab } | null>(null);
  const handledFoundationNavigationRequest = useRef<number | null>(null);
  const associationOpener = useRef<HTMLButtonElement | null>(null);
  const suggestionsOpener = useRef<HTMLButtonElement | null>(null);
  const archivedRhythmsOpener = useRef<HTMLElement | null>(null);
  const wasSuggestionsOpen = useRef(false);
  const skipSuggestionsFocusRestore = useRef(false);
  const wasAssociationDialogOpen = useRef(false);
  const wasArchiveDialogOpen = useRef(false);
  const categoryId = categoryConfig?.categoryId ?? 'marriage';
  const categoryLabel = categoryConfig?.label ?? 'Marriage';
  const categoryDescription = categoryConfig?.description ?? 'Structure beats good intentions.';
  const categoryToken = categoryId;
  const foundationTerm = categoryConfig?.foundationTerm ?? foundationTerminologyForCategory(categoryId);
  const foundationDetailOpen = activeTab === 'foundations' && selectedFoundationId !== null;
  const categoryFoundations = categoryConfig?.foundations
    ?? foundationCatalogue.filter(foundation => foundation.categoryId === categoryId);
  const associationFoundation = categoryFoundations.find(item => item.id === associationFoundationId);

  useEffect(() => {
    const request = categoryTabNavigationRequest;
    if (!request || request.categoryId !== categoryId) return;
    foundationOpener.current = null;
    setSelectedFoundationId(null);
    setActiveTab('foundations');
  }, [categoryTabNavigationRequest?.requestId, categoryId]);

  useEffect(() => {
    if (associationFoundationId) {
      wasAssociationDialogOpen.current = true;
      return;
    }
    if (!wasAssociationDialogOpen.current) return;
    wasAssociationDialogOpen.current = false;
    if (associationOpener.current?.isConnected) associationOpener.current.focus();
  }, [associationFoundationId]);

  useEffect(() => {
    if (showArchivedRhythms) {
      wasArchiveDialogOpen.current = true;
      return;
    }
    if (!wasArchiveDialogOpen.current) return;
    wasArchiveDialogOpen.current = false;
    archivedRhythmsOpener.current?.focus();
  }, [showArchivedRhythms]);

  useEffect(() => {
    if (selectedFoundationId) {
      document.getElementById(`${categoryToken}-foundation-detail`)?.focus();
    } else if (foundationOpener.current) {
      const opener = foundationOpener.current;
      if (activeTab !== opener.tab) {
        setActiveTab(opener.tab);
        return;
      }
      const returnTarget = document.getElementById(opener.id);
      if (returnTarget) returnTarget.focus();
      else document.getElementById(`${categoryToken}-tab-${opener.tab}`)?.focus();
      foundationOpener.current = null;
    }
  }, [selectedFoundationId, activeTab]);

  useEffect(() => {
    const request = foundationNavigationRequest;
    if (!request || handledFoundationNavigationRequest.current === request.requestId) return;
    handledFoundationNavigationRequest.current = request.requestId;
    if (categoryFoundations.some(foundation => foundation.id === request.foundationId)) {
      foundationOpener.current = {
        id: `${categoryToken}-tab-${request.returnTab}`,
        tab: request.returnTab
      };
      setSelectedFoundationId(request.foundationId);
      setActiveTab('foundations');
    }
    onFoundationNavigationHandled?.(request.requestId);
  }, [foundationNavigationRequest?.requestId, categoryToken]);

  useEffect(() => {
    if (showSuggestions) {
      wasSuggestionsOpen.current = true;
      return;
    }
    if (!wasSuggestionsOpen.current) return;
    wasSuggestionsOpen.current = false;
    if (skipSuggestionsFocusRestore.current) {
      skipSuggestionsFocusRestore.current = false;
      return;
    }
    suggestionsOpener.current?.focus();
  }, [showSuggestions]);

  function openFoundation(id: string, openerId: string, returnTab: MarriageTab = activeTab) {
    foundationOpener.current = { id: openerId, tab: returnTab };
    setActiveTab('foundations');
    setSelectedFoundationId(id);
  }

  function selectTab(tab: MarriageTab) {
    setActiveTab(tab);
    setSelectedFoundationId(null);
    foundationOpener.current = null;
  }

  function openAssociationDialog(id: string, event: MouseEvent<HTMLButtonElement>) {
    associationOpener.current = event.currentTarget;
    setAssociationFoundationId(id);
  }

  const foundationScores = new Map(categoryFoundations.map(foundation => [
    foundation.id,
    selectFoundationScore(foundation.id, foundationRhythms, foundationRhythmScores, archivedRhythmIds)
  ]));
  const categoryScore = selectCategoryScore(categoryFoundations, foundationScores);
  const categoryScoringEvidence: HealthAggregateEvidence = {
    heading: `${foundationTerm.singular} scores`,
    description: `Each eligible ${foundationTerm.singular.toLowerCase()} counts equally.`,
    itemLabel: foundationTerm.singular,
    rows: categoryScore.eligibleFoundationIds.flatMap(id => {
      const foundation = categoryFoundations.find(item => item.id === id);
      const score = foundationScores.get(id);
      return foundation && score
        ? [{ id, label: foundation.name, consistency: score.consistency, onTrack: score.onTrack }]
        : [];
    }),
    otherCount: categoryScore.foundationIds.length - categoryScore.eligibleFoundationIds.length,
    consistencyAverage: categoryScore.consistency,
    consistencyCount: categoryScore.eligibleFoundationIds.length,
    onTrackAverage: categoryScore.onTrack,
    onTrackCount: categoryScore.eligibleFoundationIds.length,
    coverage: `${categoryScore.eligibleFoundationIds.length} of ${categoryScore.foundationIds.length} ${foundationTerm.plural} scored.`,
    notes: [
      `Unscored ${foundationTerm.plural.toLowerCase()} are excluded from this average.`,
      ...(categoryScore.unresolvedFoundationIds.length > 0
        ? [`${categoryScore.unresolvedFoundationIds.length} ${foundationTerm.plural.toLowerCase()} could not be resolved.`]
        : [])
    ],
    emptyState: `No eligible ${foundationTerm.plural.toLowerCase()} are available.`
  };
  const categoryRollup = foundationHealthRollup({
    categoryId,
    categoryLabel,
    foundationLabel: foundationTerm.plural,
    foundationSingular: foundationTerm.singular,
    foundations: categoryFoundations,
    rhythms: foundationRhythms,
    foundationScores,
    categoryScore,
    overallHealthScore,
    categoryExplanation: [
      `Each eligible ${foundationTerm.singular.toLowerCase()} contributes equally to available Consistency and On Track averages.`,
      categoryConfig?.scoreExplanationIntro,
      categoryConfig?.scoreInterpretationNote
    ].filter(Boolean).join(' ')
  });
  const unlinkedCategoryRhythms = userRhythms.filter(rhythm =>
    !archivedRhythmIds.includes(rhythm.id)
    && rhythm.categoryIds?.includes(categoryId)
    && missingRequiredFoundationCategories(
      [categoryId],
      foundationRhythmIds(rhythm),
      categoryFoundations
    ).includes(categoryId)
  );
  const resolvedPeople = resolvePersonCategoryGroups(peopleGroups).groups;
  const marriagePersonIds = new Set(
    resolvedPeople.find(group => group.id === 'marriage')?.memberIds ?? []
  );
  const marriagePeople = categoryId === 'marriage'
    ? people.filter(person => marriagePersonIds.has(person.id))
    : [];
  const todayRhythms = userRhythms.filter(rhythm => isRhythmRelevantOnDate(rhythm, todayDate));
  function browseSuggestions(event: MouseEvent<HTMLButtonElement>) {
    suggestionsOpener.current = event.currentTarget;
    setShowSuggestions(true);
  }
  function returnToSuggestions(saved: boolean) {
    if (saved) setActiveTab('rhythms');
    setShowSuggestions(true);
  }
  function beginSuggestionAdd(
    suggestion: CategoryRhythmSuggestion,
    event: MouseEvent<HTMLButtonElement>,
    returnToPicker: (saved: boolean) => void
  ) {
    if (!onAddSuggestion) return;
    skipSuggestionsFocusRestore.current = true;
    onAddSuggestion(suggestion, event, returnToPicker);
  }
  function beginSuggestionEdit(
    rhythm: RhythmPreview,
    event: MouseEvent<HTMLButtonElement>,
    returnToPicker: (saved: boolean) => void
  ) {
    if (!onEditRhythm) return;
    skipSuggestionsFocusRestore.current = true;
    onEditRhythm(rhythm, event, returnToPicker);
  }

  const defaultSuggestionCatalogue = createMarriageSuggestionCatalogue(suggestionRhythms);
  const suggestionCatalogue = categoryConfig?.suggestionCatalogue
    ?? (!categoryConfig ? defaultSuggestionCatalogue : undefined);
  const suggestionPickerGroups: RhythmSuggestionPickerGroup[] = (suggestionCatalogue?.groups ?? []).map(group => ({
    id: group.id,
    title: group.title,
    subtitle: group.subtitle,
    items: group.suggestions.map(suggestion => {
        const instances = rhythmsForSuggestionSource(suggestionInstances, suggestion.sourceId)
          .map(instance => {
            const archived = archivedRhythmIds.includes(instance.id);
            const schedule = effectiveRhythmSchedule(instance.schedule, instance.cadence);
            const summary = schedule
              ? rhythmScheduleSummary(schedule).replace(/\.$/, '')
              : instance.cadence ?? 'Schedule unavailable';
            const timeOfDay = instance.timeOfDay ?? rhythmTimeValueFromLabel(instance.timeLabel ?? '', timeOptions);
            const timeLabel = timeOfDay ? rhythmTimeLabel(timeOfDay, timeOptions) : undefined;
            return {
              id: instance.id,
              title: instance.title,
              ...(peopleForRhythm(instance, people).length
                ? { peopleLabel: peopleForRhythm(instance, people).map(person => person.displayName).join(', ') }
                : {}),
              scheduleSummary: timeLabel && timeLabel !== 'Anytime' ? `${summary} · ${timeLabel}` : summary,
              archived,
              ...(!archived
                ? {
                    onEdit: (
                      event: MouseEvent<HTMLButtonElement>,
                      returnToPicker: (saved: boolean) => void
                    ) => beginSuggestionEdit(instance, event, returnToPicker)
                  }
                : { onRestore: () => onRestoreRhythm(instance.id) })
            };
          });
        return {
          id: suggestion.sourceId,
          title: suggestion.rhythm.title,
          ...(suggestion.rhythm.description ? { description: suggestion.rhythm.description } : {}),
          scheduleHint: suggestion.scheduleHint,
          icon: suggestion.icon,
          instances,
          onAdd: (
            event: MouseEvent<HTMLButtonElement>,
            returnToPicker: (saved: boolean) => void
          ) => beginSuggestionAdd(suggestion, event, returnToPicker)
        };
      })
  }));
  return (
    <main
      className={`category-page category-page--with-header marriage-page${foundationDetailOpen ? ' marriage-page--foundation-detail' : ''}`}
      aria-labelledby={foundationDetailOpen
        ? `${categoryToken}-foundation-detail-title`
        : `${categoryToken}-title`}
    >
      {!foundationDetailOpen && (
        <>
          <CategoryHeader
            title={categoryLabel}
            titleId={`${categoryToken}-title`}
            subtitle={categoryDescription}
            trailing={categoryId === 'marriage' ? (
              marriagePeople.length > 0
                ? (
                  <div className="marriage-people-shortcuts" role="group" aria-label="People classified in Marriage">
                    {marriagePeople.map(person => (
                      <button
                        key={person.id}
                        type="button"
                        className="marriage-person-shortcut"
                        aria-label={`Open profile for ${person.displayName}`}
                        onClick={() => onPersonSelect(person.id)}
                      >
                        <PersonBadgeVisual person={person} displayNameMode="full" />
                        <span className="marriage-person-shortcut__chevron" aria-hidden="true">›</span>
                      </button>
                    ))}
                  </div>
                )
                : (
                  <div className="marriage-people-empty">
                    <p>No People are classified in Marriage.</p>
                    <button type="button" className="btn mini ghost" onClick={onOpenPeople}>
                      Add or classify a Person
                    </button>
                  </div>
                )
            ) : undefined}
          />

          <CategoryHealthSummary
            key={categoryConfig?.categoryId ?? 'marriage'}
            score={categoryScore}
            title={`${categoryLabel} Health`}
            itemTerm={foundationTerm}
            explanation={categoryConfig?.scoreExplanationIntro ?? ''}
            scoringEvidence={categoryScoringEvidence}
            rollup={categoryRollup}
            unlinkedRhythms={unlinkedCategoryRhythms}
            onEditRhythm={onEditRhythm}
            {...(categoryConfig?.scoreInterpretationNote
              ? { interpretationNote: categoryConfig.scoreInterpretationNote }
              : {})}
          />

          <SegmentedTabs
            tabs={tabs.map(tab => ({
              ...tab,
              tabId: `${categoryToken}-tab-${tab.id}`,
              panelId: `${categoryToken}-panel-${tab.id}`,
              label: tab.id === 'foundations' ? categoryConfig?.tabLabel ?? tab.label : tab.label
            }))}
            selectedTabId={activeTab}
            ariaLabel={`${categoryLabel} content`}
            onChange={selectTab}
          />
        </>
      )}

      <section
        className="marriage-view-panel"
        id={`${categoryToken}-panel-today`}
        role="tabpanel"
        aria-labelledby={`${categoryToken}-tab-today`}
        hidden={activeTab !== 'today'}
      >
        <TodayTogether
          people={people}
          rhythms={todayRhythms}
          hasActiveRhythms={userRhythms.length > 0}
          rhythmScores={foundationRhythmScores}
          undoableRhythms={undoableRhythms}
          satisfiedRhythmIds={satisfiedRhythmIds}
          tendedRhythmIds={tendedRhythmIds}
          showTended={showTended}
          onShowTendedChange={onShowTendedChange}
          initializing={initializing}
          resetKey={`${activeTab}:${todayDate}`}
          onTend={onTend}
          onUndo={onUndo}
          onEditRhythm={onEditRhythm}
          onRhythmHistory={(id, event) => onRhythmHistory(id, event, 'today')}
          onPersonSelect={onPersonSelect}
          foundations={foundationCatalogue}
          onOpenFoundation={(id, openerId) => openFoundation(id, openerId, 'today')}
          onOpenCategory={onOpenCategory}
          todayDate={todayDate}
          categoryToken={categoryToken}
        />
      </section>

      <section
        className="marriage-view-panel"
        id={`${categoryToken}-panel-rhythms`}
        role="tabpanel"
        aria-labelledby={`${categoryToken}-tab-rhythms`}
        hidden={activeTab !== 'rhythms'}
      >
        <CategoryRhythmCollection
          people={people}
          rhythms={userRhythms}
          rhythmScores={foundationRhythmScores}
          completedRhythms={completedRhythms}
          undoableRhythms={undoableRhythms}
          onTend={onTend}
          onUndo={onUndo}
          onEditRhythm={onEditRhythm}
          onRhythmHistory={(id, event) => onRhythmHistory(id, event, 'rhythms')}
          onPersonSelect={onPersonSelect}
          foundations={foundationCatalogue}
          onOpenFoundation={(id, openerId) => openFoundation(id, openerId, 'rhythms')}
          onOpenCategory={onOpenCategory}
          todayDate={todayDate}
          onAddRhythm={onAddRhythm}
          {...(suggestionCatalogue ? { onBrowseSuggestions: browseSuggestions } : {})}
          archivedRhythms={archivedRhythms}
          archivedRhythmsOpenerRef={archivedRhythmsOpener}
          showArchivedRhythms={showArchivedRhythms}
          onShowArchivedRhythms={() => setShowArchivedRhythms(true)}
          categoryLabel={categoryLabel}
          categoryToken={categoryToken}
        />
      </section>

      <section
        className="marriage-view-panel"
        id={`${categoryToken}-panel-foundations`}
        {...(foundationDetailOpen
          ? {}
          : {
              role: 'tabpanel',
              'aria-labelledby': `${categoryToken}-tab-foundations`
            })}
        hidden={activeTab !== 'foundations'}
      >
        <FoundationList
          people={people}
          categoryLabel={categoryLabel}
          foundationTerm={foundationTerm}
          categoryToken={categoryToken}
          categoryFoundations={categoryFoundations}
          rhythms={foundationRhythms}
          rhythmScores={foundationRhythmScores}
          archivedRhythmIds={archivedRhythmIds}
          foundationScores={foundationScores}
          overallHealthScore={overallHealthScore}
          selectedFoundationId={selectedFoundationId}
          onSelect={openFoundation}
          onBack={() => setSelectedFoundationId(null)}
          onManage={openAssociationDialog}
          onAddRhythm={onAddLinkedRhythm}
          onRhythmHistory={(id, event) => onRhythmHistory(id, event, 'foundations')}
          completedRhythms={completedRhythms}
          undoableRhythms={undoableRhythms}
          onTend={onTend}
          onUndo={onUndo}
          onEditRhythm={onEditRhythm}
          onPersonSelect={onPersonSelect}
          associationFoundations={foundationCatalogue}
          onOpenFoundation={(id, openerId) => openFoundation(id, openerId, 'foundations')}
          onOpenCategory={onOpenCategory}
        />
      </section>
      {associationFoundation && (
        <FoundationRhythmAssociationDialog
          key={associationFoundation.id}
          foundation={associationFoundation}
          foundationTerm={foundationTerm}
          rhythms={foundationRhythms.map(rhythm => ({
            rhythm,
            archived: archivedRhythmIds.includes(rhythm.id)
          }))}
          onSave={changes => onSaveFoundationAssociations(associationFoundation.id, changes)}
          onClose={() => setAssociationFoundationId(null)}
        />
      )}
      {showArchivedRhythms && (
        <ArchivedRhythmsDialog
          rhythms={archivedRhythms}
          people={people}
          foundations={foundationCatalogue}
          completedRhythms={completedRhythms}
          onPersonSelect={onPersonSelect}
          onOpenFoundation={(id, openerId) => {
            setShowArchivedRhythms(false);
            openFoundation(id, openerId, 'rhythms');
          }}
          onOpenCategory={onOpenCategory}
          onRestore={onRestoreRhythm}
          onClose={() => setShowArchivedRhythms(false)}
        />
      )}
      {suggestionCatalogue && <RhythmSuggestionPicker
        title={suggestionCatalogue.title}
        open={showSuggestions}
        groups={suggestionPickerGroups}
        onClose={() => setShowSuggestions(false)}
        onReopen={returnToSuggestions}
      />}
    </main>
  );
}

function TodayTogether({
  people,
  rhythms,
  hasActiveRhythms,
  rhythmScores,
  undoableRhythms,
  satisfiedRhythmIds,
  tendedRhythmIds,
  showTended,
  onShowTendedChange,
  initializing,
  resetKey,
  onTend,
  onUndo,
  onEditRhythm,
  onRhythmHistory,
  onPersonSelect,
  foundations,
  onOpenFoundation,
  onOpenCategory,
  todayDate,
  categoryToken
}: {
  people: readonly PersonPreview[];
  rhythms: readonly RhythmPreview[];
  hasActiveRhythms: boolean;
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>;
  undoableRhythms: ReadonlySet<string>;
  satisfiedRhythmIds: ReadonlySet<string>;
  tendedRhythmIds: ReadonlySet<string>;
  showTended: boolean;
  onShowTendedChange: (show: boolean) => void;
  initializing: boolean;
  resetKey: string;
  onTend: MarriageViewProps['onTend'];
  onUndo: MarriageViewProps['onUndo'];
  onEditRhythm: MarriageViewProps['onEditRhythm'];
  onRhythmHistory: MarriageViewProps['onRhythmHistory'];
  onPersonSelect: MarriageViewProps['onPersonSelect'];
  foundations: readonly FoundationPreview[];
  onOpenFoundation: (foundationId: string, openerId: string) => void;
  onOpenCategory: MarriageViewProps['onOpenCategory'];
  todayDate: string;
  categoryToken: string;
}) {
  const completedCount = rhythms.filter(rhythm => tendedRhythmIds.has(rhythm.id)).length;
  return (
    <section className="marriage-today-section" aria-labelledby={`${categoryToken}-today-together-title`}>
      <div className="marriage-section-heading">
        <div>
          <h3 id={`${categoryToken}-today-together-title`}>Today</h3>
          <p>{completedCount} of {rhythms.length} Rhythms tended</p>
        </div>
      </div>
      <TendedRhythmList
        rhythms={rhythms}
        tendedRhythmIds={tendedRhythmIds}
        satisfiedRhythmIds={satisfiedRhythmIds}
        undoableRhythmIds={undoableRhythms}
        showTended={showTended}
        onShowTendedChange={onShowTendedChange}
        onUndo={onUndo}
        resetKey={resetKey}
        initializing={initializing}
      >
        {({ visibleRhythmIds, tendedRhythmIds: displayedTendedIds, itemProps }) => {
          const visibleRhythms = rhythms.filter(rhythm => visibleRhythmIds.has(rhythm.id));
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
                      onOpenFoundation={onOpenFoundation}
                      onOpenCategory={onOpenCategory}
                      headingId={`${categoryToken}-today-rhythm-${rhythm.id}`}
                      archived={false}
                      healthScore={rhythmHealthScore(rhythmScores.get(rhythm.id))}
                      onHistory={event => onRhythmHistory(rhythm.id, event)}
                      {...(isEditableRhythmId(rhythm.id)
                        ? {
                            onTend: (event: MouseEvent<HTMLButtonElement>) => onTend(rhythm.id, event),
                            onEdit: (event: MouseEvent<HTMLButtonElement>) => onEditRhythm(rhythm, event),
                            ...(undoableRhythms.has(rhythm.id) && !rhythm.healthLogCapability
                              ? { onUndo: () => onUndo(rhythm.id) }
                              : {})
                          }
                        : {})}
                      onClose={() => undefined}
                    />
                  </div>
                ))}
              </div>
            )
            : rhythms.length > 0
              ? <div className="marriage-empty-state" role="status"><p>You’ve tended everything here.</p></div>
              : (
                <div className="marriage-empty-state">
                  <p>{hasActiveRhythms ? 'All caught up. Nothing to tend to.' : 'No active Rhythms.'}</p>
                </div>
              );
        }}
      </TendedRhythmList>
    </section>
  );
}

function FoundationList({
  people,
  categoryLabel,
  foundationTerm,
  categoryToken,
  categoryFoundations,
  rhythms,
  rhythmScores,
  archivedRhythmIds,
  foundationScores,
  overallHealthScore,
  selectedFoundationId,
  onSelect,
  onBack,
  onManage,
  onAddRhythm,
  onRhythmHistory,
  completedRhythms,
  undoableRhythms,
  onTend,
  onUndo,
  onEditRhythm,
  onPersonSelect,
  associationFoundations,
  onOpenFoundation,
  onOpenCategory
}: {
  people: readonly PersonPreview[];
  categoryLabel: string;
  foundationTerm: FoundationTerminology;
  categoryToken: string;
  categoryFoundations: readonly FoundationPreview[];
  rhythms: readonly RhythmPreview[];
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>;
  archivedRhythmIds: readonly string[];
  foundationScores: ReadonlyMap<string, FoundationScoreSelection>;
  overallHealthScore: number | null;
  selectedFoundationId: string | null;
  onSelect: (id: string, openerId: string) => void;
  onBack: () => void;
  onManage: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onAddRhythm: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onRhythmHistory: MarriageViewProps['onRhythmHistory'];
  completedRhythms: ReadonlySet<string>;
  undoableRhythms: ReadonlySet<string>;
  onTend: MarriageViewProps['onTend'];
  onUndo: MarriageViewProps['onUndo'];
  onEditRhythm: MarriageViewProps['onEditRhythm'];
  onPersonSelect: MarriageViewProps['onPersonSelect'];
  associationFoundations: readonly FoundationPreview[];
  onOpenFoundation: (foundationId: string, openerId: string) => void;
  onOpenCategory: MarriageViewProps['onOpenCategory'];
}) {
  const [scoreInfoExpanded, setScoreInfoExpanded] = useState(false);
  const scoreInfoButtonRef = useRef<HTMLButtonElement>(null);
  const scoreInfoId = useId();
  const selectedFoundation = categoryFoundations.find(item => item.id === selectedFoundationId);
  const selectedFoundationScore = selectedFoundation
    ? foundationScores.get(selectedFoundation.id) ?? null
    : null;
  const linkedRhythms = selectedFoundation
    ? rhythmsSupportingFoundation(rhythms, selectedFoundation.id)
    : [];
  const foundationScoringEvidence: HealthAggregateEvidence | undefined = selectedFoundationScore
    ? {
        heading: 'Linked Rhythm scores',
        description: 'Each eligible linked Rhythm counts equally.',
        itemLabel: 'Rhythm',
        rows: selectedFoundationScore.eligibleRhythmIds.flatMap(id => {
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
        }),
        otherCount: selectedFoundationScore.activeLinkedRhythmIds.length
          - selectedFoundationScore.eligibleRhythmIds.length,
        consistencyAverage: selectedFoundationScore.consistency,
        consistencyCount: selectedFoundationScore.eligibleRhythmIds.length,
        onTrackAverage: selectedFoundationScore.onTrack,
        onTrackCount: selectedFoundationScore.eligibleRhythmIds.length,
        coverage: `${selectedFoundationScore.eligibleRhythmIds.length} of ${selectedFoundationScore.activeLinkedRhythmIds.length} linked Rhythms scored.`,
        notes: [
          'Uses each Rhythm’s own scoring window and season schedules.',
          ...(selectedFoundationScore.archivedRhythmIds.length > 0
            ? [`${selectedFoundationScore.archivedRhythmIds.length} archived linked Rhythms are excluded.`]
            : []),
          ...(selectedFoundationScore.unresolvedRhythmIds.length > 0
            ? [`${selectedFoundationScore.unresolvedRhythmIds.length} linked Rhythm scores could not be resolved.`]
            : []),
          ...(selectedFoundationScore.excludedRhythms.length > 0
            ? ['Linked Rhythms without both scores are excluded from both averages.']
            : [])
        ],
        emptyState: 'No eligible linked Rhythms have both scores available.'
      }
    : undefined;
  const foundationRollup = selectedFoundation
    ? foundationHealthRollup({
        categoryId: selectedFoundation.categoryId,
        categoryLabel,
        foundationLabel: foundationTerm.plural,
        foundationSingular: foundationTerm.singular,
        foundations: categoryFoundations,
        rhythms,
        foundationScores,
        categoryScore: selectCategoryScore(categoryFoundations, foundationScores),
        overallHealthScore,
        categoryExplanation: `Each eligible ${foundationTerm.singular.toLowerCase()} contributes equally to available Consistency and On Track averages.`,
        initialGroupId: 'foundations',
        initialItemId: selectedFoundation.id
      })
    : undefined;
  const closeScoreInfo = () => {
    setScoreInfoExpanded(false);
    requestAnimationFrame(() => scoreInfoButtonRef.current?.focus());
  };

  return (
    <section
      className="marriage-foundations-section"
      aria-label={selectedFoundation
        ? `${selectedFoundation.name} ${foundationTerm.singular.toLowerCase()} detail`
        : `${categoryLabel} ${foundationTerm.plural.toLowerCase()}`}
    >
      {scoreInfoExpanded && selectedFoundation && (
        <HealthScoreDetailsDialog
          title={`${selectedFoundation.name} Health details`}
          onClose={closeScoreInfo}
          className="marriage-foundation-score-info"
        >
          <div
            id={scoreInfoId}
            className="marriage-foundation-score-info__content"
            role="region"
            aria-label={`${selectedFoundation.name} Health scoring details`}
          >
            <HealthScoreDetailsContent
              key={selectedFoundation.id}
              title={`${selectedFoundation.name} Health`}
              ariaLabel={`${selectedFoundation.name} Health scoring details`}
              score={selectedFoundationScore?.health ?? null}
              healthLabel={`${selectedFoundation?.name ?? foundationTerm.singular} ${foundationTerm.singular} Health`}
              consistency={{
                score: selectedFoundationScore?.consistency ?? null,
                state: selectedFoundationScore?.consistency === null || selectedFoundationScore === null
                  ? 'unavailable'
                  : 'scored'
              }}
              onTrack={{
                score: selectedFoundationScore?.onTrack ?? null,
                state: selectedFoundationScore?.onTrack === null || selectedFoundationScore === null
                  ? 'unavailable'
                  : 'scored'
              }}
              consistencyCaption="How often you show up."
              onTrackCaption="How caught up you are."
              consistencyDescription="The average Consistency score of eligible linked Rhythms."
              onTrackDescription="The average On Track score of eligible linked Rhythms."
              {...(foundationRollup ? { rollup: foundationRollup } : {})}
              scoringDisclosureTitle={`How this ${foundationTerm.singular} was scored`}
              {...(foundationScoringEvidence ? { scoringEvidence: foundationScoringEvidence } : {})}
              initialContributionExpanded={false}
            />
          </div>
        </HealthScoreDetailsDialog>
      )}
      {selectedFoundation
        ? (
          <section
            id={`${categoryToken}-foundation-detail`}
            className="marriage-foundation-detail tend-back-stack"
            aria-labelledby={`${categoryToken}-foundation-detail-title`}
            tabIndex={-1}
          >
            <BackButton onClick={onBack}>All {foundationTerm.plural}</BackButton>
            <FoundationDetailHeader
              foundation={selectedFoundation}
              headingId={`${categoryToken}-foundation-detail-title`}
              score={selectedFoundationScore?.health ?? null}
              scoreLabel={`${selectedFoundation.name} ${foundationTerm.singular} Health`}
              scoreAction={(
                <HealthScoreInfoButton
                  ref={scoreInfoButtonRef}
                  label={`Show ${selectedFoundation.name} Health scoring details`}
                  expanded={scoreInfoExpanded}
                  controls={scoreInfoId}
                  onClick={() => setScoreInfoExpanded(expanded => !expanded)}
                />
              )}
            />
            <div className="marriage-foundation-support">
                <div className="marriage-foundation-support__heading">
                  <h3 id={`${categoryToken}-foundation-linked-rhythms-title`}>
                    Linked Rhythms · {linkedRhythms.length}
                  </h3>
                  <div className="marriage-foundation-support__heading-actions">
                    <button
                      type="button"
                      className="btn mini"
                      onClick={event => onAddRhythm(selectedFoundation.id, event)}
                    >
                      Add Rhythm
                    </button>
                    <button
                      type="button"
                      className="btn mini ghost"
                      aria-haspopup="dialog"
                      onClick={event => onManage(selectedFoundation.id, event)}
                    >
                      Manage links
                    </button>
                  </div>
                </div>
                {selectedFoundationScore && selectedFoundationScore.archivedRhythmIds.length > 0 && (
                  <p className="marriage-foundation-support__score-note">
                    {selectedFoundationScore.archivedRhythmIds.length} archived linked
                    {' '}{selectedFoundationScore.archivedRhythmIds.length === 1 ? 'Rhythm is' : 'Rhythms are'} excluded from scoring.
                  </p>
                )}
                {selectedFoundationScore && selectedFoundationScore.unresolvedRhythmIds.length > 0 && (
                  <p className="marriage-foundation-support__score-note" role="status">
                    {selectedFoundationScore.unresolvedRhythmIds.length} linked
                    {' '}{selectedFoundationScore.unresolvedRhythmIds.length === 1 ? 'Rhythm score could' : 'Rhythm scores could'}
                    {' '}not be resolved.
                  </p>
                )}
                {selectedFoundationScore && selectedFoundationScore.excludedRhythms.length > 0 && (
                  <p className="marriage-foundation-support__score-note">
                    Linked Rhythms without both scores are excluded from both averages.
                  </p>
                )}
                {linkedRhythms.length
                  ? (
                    <FoundationRhythmGroup
                      people={people}
                      rhythms={linkedRhythms}
                      archivedRhythmIds={archivedRhythmIds}
                      headingId={`${categoryToken}-foundation-linked-rhythms-title`}
                      rhythmScores={rhythmScores}
                      completedRhythms={completedRhythms}
                      undoableRhythms={undoableRhythms}
                      onTend={onTend}
                      onUndo={onUndo}
                      onEditRhythm={onEditRhythm}
                      onRhythmHistory={(id, event) => onRhythmHistory(id, event, 'foundations')}
                      onPersonSelect={onPersonSelect}
                      foundations={associationFoundations}
                      categoryToken={categoryToken}
                      onOpenFoundation={id => onOpenFoundation(
                        id,
                        `${categoryToken}-foundation-select-${selectedFoundation.id}`
                      )}
                      onOpenCategory={onOpenCategory}
                    />
                  )
                  : <p>No Rhythms are linked to this ongoing {foundationTerm.singular} yet.</p>}
            </div>
          </section>
        )
        : (
          <div className="marriage-foundation-list">
            {categoryFoundations.map(foundation => {
              const score = foundationScores.get(foundation.id);
              const scoreEvidence = score ? foundationScoreEvidence(score) : undefined;
              return (
                <FoundationCard
                  key={foundation.id}
                  foundation={foundation}
                  variant="compact"
                  icon={<MarriageIcon group="foundations" id={foundation.iconId ?? foundation.id} />}
                  score={score?.health ?? null}
                  scoreLabel={`${foundation.name} ${foundationTerm.singular} Health score`}
                  scoreEvidence={scoreEvidence ?? 'No linked Rhythms'}
                  headingId={`${categoryToken}-foundation-list-${foundation.id}`}
                  selectButtonId={`${categoryToken}-foundation-select-${foundation.id}`}
                  onSelect={() => onSelect(foundation.id, `${categoryToken}-foundation-select-${foundation.id}`)}
                />
              );
            })}
          </div>
        )}
    </section>
  );
}

function foundationHealthRollup({
  categoryId,
  categoryLabel,
  foundationLabel,
  foundationSingular,
  foundations,
  rhythms,
  foundationScores,
  categoryScore,
  overallHealthScore,
  categoryExplanation,
  initialGroupId = 'category',
  initialItemId = categoryId
}: {
  categoryId: CategoryId;
  categoryLabel: string;
  foundationLabel: string;
  foundationSingular: string;
  foundations: readonly FoundationPreview[];
  rhythms: readonly RhythmPreview[];
  foundationScores: ReadonlyMap<string, FoundationScoreSelection>;
  categoryScore: CategoryScoreSelection;
  overallHealthScore: number | null;
  categoryExplanation: string;
  initialGroupId?: string;
  initialItemId?: string;
}): HealthRollupConfig {
  const foundationById = new Map(foundations.map(foundation => [foundation.id, foundation]));
  const categoryRhythms = rhythms.filter(rhythm =>
    rhythm.categoryIds?.some(id => id === categoryId)
    || foundationRhythmIds(rhythm).some(id => foundationById.has(id))
  );
  const rhythmItems = categoryRhythms.map(rhythm => {
    const linkedFoundationIds = foundationRhythmIds(rhythm);
    const linkedFoundationNames = linkedFoundationIds.map(id =>
      foundationById.get(id)?.name ?? `${id} (unresolved)`
    );
    return {
      id: rhythm.id,
      label: rhythm.title,
      explanation: linkedFoundationNames.length > 0
        ? `Linked through ${linkedFoundationNames.join(', ')}.`
        : `This Rhythm is associated with ${categoryLabel}.`,
      relatedItemIds: {
        foundations: linkedFoundationIds,
        category: rhythm.categoryIds?.includes(categoryId) || linkedFoundationIds.length > 0
          ? [categoryId]
          : []
      }
    };
  });
  const foundationItems = foundations.map(foundation => {
    const linked = rhythmsSupportingFoundation(rhythms, foundation.id);
    const score = foundationScores.get(foundation.id);
    return {
      id: foundation.id,
      label: foundation.name,
      score: score?.health ?? null,
      categoryId,
      categoryLabel,
      foundationIconId: foundation.iconId ?? foundation.id,
      details: [
        'The average Consistency score of eligible linked Rhythms.',
        'The average On Track score of eligible linked Rhythms.'
      ],
      explanation: [
        'Each linked Rhythm counts equally; it needs both Consistency and On Track scores to contribute.',
        linked.length > 0
          ? `Linked Rhythms: ${linked.map(rhythm => rhythm.title).join(', ')}.`
          : 'No Rhythms are linked.',
        score
          ? `${score.eligibleRhythmIds.length} linked Rhythms currently have both scores available.`
          : 'Its linked Rhythm scores could not be resolved.'
      ].join(' '),
      relatedItemIds: {
        rhythms: linked.map(rhythm => rhythm.id),
        category: [categoryId]
      }
    };
  });
  const foundationIds = foundationItems.map(item => item.id);
  const selectedFoundation = foundations.find(foundation => foundation.id === initialItemId);
  const categoryLevelItem = {
    id: categoryId,
    label: categoryLabel,
    score: categoryScore.health,
    categoryIconId: categoryId
  };
  const selectedFoundationScore = selectedFoundation
    ? foundationScores.get(selectedFoundation.id)
    : undefined;
  const selectedScoreEvidence = selectedFoundationScore
    ? foundationScoreEvidence(selectedFoundationScore)
    : undefined;
  const hasLinkedRhythms = initialGroupId === 'foundations'
    ? (selectedFoundationScore?.activeLinkedRhythmIds.length ?? 0) > 0
    : categoryRhythms.length > 0;
  const foundationLevelItems = initialGroupId === 'foundations'
    ? foundationItems.filter(item => item.id === initialItemId)
    : foundationItems;
  const selectedFoundationName = selectedFoundation?.name ?? categoryLabel;
  const contributionHeading = initialGroupId === 'foundations'
    ? `How this ${foundationSingular} contributes`
    : 'How this Category contributes';
  const healthContribution = {
    heading: contributionHeading,
    highlightedGroup: initialGroupId === 'foundations' ? 'foundations' as const : 'categories' as const,
    highlightedItemId: initialGroupId === 'foundations' ? initialItemId : categoryId,
    scoringInfo: initialGroupId === 'foundations'
      ? {
          groupId: 'foundations' as const,
          triggerLabel: `About ${foundationSingular} scoring`,
          title: `${foundationSingular} scoring`,
          ...(selectedScoreEvidence ? { coverage: selectedScoreEvidence } : {}),
          paragraphs: ['Each linked Rhythm counts equally. A Rhythm needs both Consistency and On Track scores to contribute.']
        }
      : {
          groupId: 'foundations' as const,
          triggerLabel: `About ${foundationLabel.toLowerCase()} scoring`,
          title: `${foundationLabel} scoring`
        },
    overallScore: overallHealthScore,
    categories: [categoryLevelItem],
    foundations: foundationLevelItems,
    bottomGroupLabel: 'Linked Rhythms',
    bottomItem: {
      id: 'linked-rhythms',
      label: hasLinkedRhythms ? 'Linked Rhythms' : 'No linked Rhythms',
      score: null,
      showScore: false
    },
    identity: initialGroupId === 'foundations'
      ? {
          name: selectedFoundationName,
          secondary: categoryLabel,
          icon: { kind: 'foundation' as const, id: selectedFoundation?.iconId ?? selectedFoundation?.id ?? '' }
        }
      : {
          name: categoryLabel,
          icon: { kind: 'category' as const, id: categoryId }
        }
  };
  const groups: HealthRollupGroup[] = [
    {
      id: 'rhythms',
      label: 'Rhythms',
      items: rhythmItems,
      emptyItem: {
        id: 'no-rhythms',
        label: 'No Rhythms',
        explanation: 'No Rhythms are linked to this Foundation or Practice.',
        usesStandardWeights: false
      }
    },
    { id: 'foundations', label: foundationLabel, items: foundationItems },
    {
      id: 'category',
      label: 'Category',
      items: [{
        id: categoryId,
        label: categoryLabel,
        categoryIconId: categoryId,
        explanation: categoryExplanation,
        relatedItemIds: { foundations: foundationIds }
      }]
    }
  ];
  return { groups, initialGroupId, initialItemId, healthContribution };
}

function foundationScoreEvidence(score: FoundationScoreSelection): string | undefined {
  if (score.linkedRhythmIds.length === 0) return 'No linked Rhythms';
  if (score.activeLinkedRhythmIds.length === 0) return 'No active linked Rhythms';
  if (score.eligibleRhythmIds.length < score.activeLinkedRhythmIds.length) {
    return `${score.eligibleRhythmIds.length} of ${score.activeLinkedRhythmIds.length} linked Rhythms scored`;
  }
  return `${score.eligibleRhythmIds.length} linked Rhythm${score.eligibleRhythmIds.length === 1 ? '' : 's'} scored`;
}

function FoundationRhythmGroup({
  people,
  rhythms,
  archivedRhythmIds,
  headingId,
  rhythmScores,
  completedRhythms,
  undoableRhythms,
  onTend,
  onUndo,
  onEditRhythm,
  onRhythmHistory,
  onPersonSelect,
  foundations,
  categoryToken,
  onOpenFoundation,
  onOpenCategory
}: {
  people: readonly PersonPreview[];
  rhythms: readonly RhythmPreview[];
  archivedRhythmIds: readonly string[];
  headingId: string;
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>;
  completedRhythms: ReadonlySet<string>;
  undoableRhythms: ReadonlySet<string>;
  onTend: MarriageViewProps['onTend'];
  onUndo: MarriageViewProps['onUndo'];
  onEditRhythm: MarriageViewProps['onEditRhythm'];
  onRhythmHistory: MarriageViewProps['onRhythmHistory'];
  onPersonSelect: MarriageViewProps['onPersonSelect'];
  foundations: readonly FoundationPreview[];
  categoryToken: string;
  onOpenFoundation: (foundationId: string, openerId: string) => void;
  onOpenCategory: MarriageViewProps['onOpenCategory'];
}) {
  return (
    <section className="marriage-foundation-support-group" aria-labelledby={headingId}>
      <div className="marriage-rhythm-list current-plan-item-group">
        {rhythms.map(rhythm => (
          <RhythmDetailsDialog
            key={rhythm.id}
            rhythm={rhythm}
            inline
            completed={completedRhythms.has(rhythm.id)}
            people={peopleForRhythm(rhythm, people)}
            foundations={foundations}
            relatedRhythms={rhythms}
            onPersonSelect={onPersonSelect}
            onOpenFoundation={onOpenFoundation}
            onOpenCategory={onOpenCategory}
            archived={archivedRhythmIds.includes(rhythm.id)}
            headingId={`${categoryToken}-detail-rhythm-${rhythm.id}`}
            healthScore={rhythmHealthScore(rhythmScores.get(rhythm.id))}
            onHistory={event => onRhythmHistory(rhythm.id, event)}
            {...(!archivedRhythmIds.includes(rhythm.id) && isEditableRhythmId(rhythm.id)
              ? {
                  onTend: (event: MouseEvent<HTMLButtonElement>) => onTend(rhythm.id, event),
                  onEdit: (event: MouseEvent<HTMLButtonElement>) => onEditRhythm(rhythm, event),
                  ...(undoableRhythms.has(rhythm.id) ? { onUndo: () => onUndo(rhythm.id) } : {})
                }
              : {})}
            onClose={() => undefined}
          />
        ))}
      </div>
    </section>
  );
}
