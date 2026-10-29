import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent, ReactNode, RefObject } from 'react';
import {
  marriageExampleFixtures,
  marriageRhythmGroups,
  marriageRhythmSuggestions,
  foundationCatalogue,
  foundationTerminologyForCategory,
  peopleForRhythm,
  rhythmLastActivityLabel,
  type FoundationTerminology,
  type FoundationPreview,
  type PersonId,
  type MarriageExampleId,
  type RhythmPreview,
  rhythmsSupportingFoundation
} from '../domain/preview-data.ts';
import { effectiveRhythmSchedule, rhythmScheduleSummary, rhythmTimeLabel, rhythmTimeValueFromLabel } from '../domain/rhythm-schedule.ts';
import {
  categoryRhythmGroup,
  isRhythmRelevantOnDate,
  rhythmsForSuggestionSource
} from '../domain/category-rhythms.ts';
import type { FoundationRhythmAssociationChange } from '../domain/foundation-rhythm-associations.ts';
import { selectCategoryScore } from '../domain/category-scoring.ts';
import { rhythmHealthScore } from '../domain/rhythm-scoring.ts';
import { selectFoundationScore } from '../domain/foundation-scoring.ts';
import type { FoundationScoreSelection } from '../domain/foundation-scoring.ts';
import { isEditableRhythmId } from '../domain/rhythm-editor.ts';
import type { RhythmScoreResult } from '../domain/rhythm-scoring.ts';
import { FoundationCard } from './Cards.tsx';
import { HealthWeightPanels } from './HealthWeightPanels.tsx';
import { CategoryHealthSummary } from './CategoryHealthSummary.tsx';
import { ArchivedRhythmsDialog } from './ArchivedRhythmsDialog.tsx';
import { FoundationRhythmAssociationDialog } from './FoundationRhythmAssociationDialog.tsx';
import { MarriageIcon } from './MarriageIcon.tsx';
import { MarriageExampleSelector } from './MarriageExampleSelector.tsx';
import { RhythmDetailsDialog } from './RhythmDetailsDialog.tsx';
import { RhythmSuggestionPicker } from './RhythmSuggestionPicker.tsx';
import type { RhythmSuggestionPickerGroup } from './RhythmSuggestionPicker.tsx';
import type { Destination } from './AppNavigation.tsx';
import type { RhythmCategoryId } from '../domain/rhythm-editor.ts';
import type { RhythmFrequencyRecommendation } from '../domain/rhythm-schedule.ts';

export type MarriageTab = 'today' | 'rhythms' | 'foundations';

export type CategoryRhythmSuggestion = {
  sourceId: string;
  categoryId: RhythmCategoryId;
  rhythm: RhythmPreview;
  scheduleHint: string;
  icon: ReactNode;
  recommendedFrequency: RhythmFrequencyRecommendation;
  frequencyGuidance?: string;
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

type MarriageViewProps = {
  marriageExampleId?: MarriageExampleId;
  onMarriageExampleChange?: (id: MarriageExampleId) => void;
  categoryConfig?: {
    categoryId: RhythmCategoryId;
    label: string;
    description: string;
    foundations: readonly FoundationPreview[];
    foundationTerm?: FoundationTerminology;
    tabLabel?: string;
    emptyFoundationDescription?: string;
    scoreInterpretationNote?: string;
    scoreExplanationIntro?: string;
    suggestionCatalogue?: CategoryRhythmSuggestionCatalogue;
  };
  todayDate: string;
  onAddRhythm: (event: MouseEvent<HTMLButtonElement>) => void;
  onAddSuggestion?: (
    suggestion: CategoryRhythmSuggestion,
    event: MouseEvent<HTMLButtonElement>,
    returnToSuggestions: (saved: boolean) => void
  ) => void;
  onPersonSelect: (personId: PersonId) => void;
  onPartnerProfile?: () => void;
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
  archivedRhythmIds: readonly string[];
  completedRhythms: ReadonlySet<string>;
  undoableRhythms: ReadonlySet<string>;
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
  onFoundationNavigationHandled?: (requestId: number) => void;
};

const tabs: { id: MarriageTab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'rhythms', label: 'Rhythms' },
  { id: 'foundations', label: 'Foundations' }
];

export function MarriageView({
  marriageExampleId,
  onMarriageExampleChange,
  categoryConfig,
  todayDate,
  onAddRhythm,
  onAddSuggestion,
  onPersonSelect,
  onPartnerProfile,
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
  archivedRhythmIds,
  completedRhythms,
  undoableRhythms,
  onTend,
  onUndo,
  onSaveFoundationAssociations,
  foundationNavigationRequest = null,
  onFoundationNavigationHandled
}: MarriageViewProps) {
  const [activeTab, setActiveTab] = useState<MarriageTab>('today');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showArchivedRhythms, setShowArchivedRhythms] = useState(false);
  const [selectedFoundationId, setSelectedFoundationId] = useState<string | null>(null);
  const [associationFoundationId, setAssociationFoundationId] = useState<string | null>(null);
  const foundationOpener = useRef<{ id: string; tab: MarriageTab } | null>(null);
  const handledFoundationNavigationRequest = useRef<number | null>(null);
  const associationOpener = useRef<HTMLButtonElement | null>(null);
  const suggestionsOpener = useRef<HTMLButtonElement | null>(null);
  const archivedRhythmsOpener = useRef<HTMLButtonElement | null>(null);
  const wasSuggestionsOpen = useRef(false);
  const skipSuggestionsFocusRestore = useRef(false);
  const wasAssociationDialogOpen = useRef(false);
  const wasArchiveDialogOpen = useRef(false);
  const fixture = marriageExampleFixtures[marriageExampleId ?? 'populated'];
  const categoryId = categoryConfig?.categoryId ?? 'marriage';
  const categoryLabel = categoryConfig?.label ?? 'Marriage';
  const categoryDescription = categoryConfig?.description ?? 'Structure beats good intentions.';
  const categoryToken = categoryId;
  const foundationTerm = categoryConfig?.foundationTerm ?? foundationTerminologyForCategory(categoryId);
  const categoryFoundations = categoryConfig?.foundations ?? fixture.foundations;
  const associationFoundation = categoryFoundations.find(item => item.id === associationFoundationId);

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
      document.getElementById(`${categoryToken}-foundation-detail-title`)?.focus();
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

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    const next = tabs[nextIndex]!;
    setActiveTab(next.id);
    setSelectedFoundationId(null);
    foundationOpener.current = null;
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`#${categoryToken}-tab-${next.id}`)?.focus();
  }

  function selectTab(tab: MarriageTab) {
    setActiveTab(tab);
    setSelectedFoundationId(null);
    foundationOpener.current = null;
  }

  function selectExample(id: MarriageExampleId) {
    onMarriageExampleChange?.(id);
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

  const suggestionById = new Map(suggestionRhythms.map(rhythm => [rhythm.id, rhythm]));
  const defaultSuggestionCatalogue: CategoryRhythmSuggestionCatalogue = {
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
            const timeOfDay = instance.timeOfDay ?? rhythmTimeValueFromLabel(instance.timeLabel ?? '');
            const timeLabel = timeOfDay ? rhythmTimeLabel(timeOfDay) : undefined;
            return {
              id: instance.id,
              title: instance.title,
              ...(peopleForRhythm(instance).length
                ? { peopleLabel: peopleForRhythm(instance).map(person => person.displayName).join(', ') }
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
    <main className="category-page marriage-page" aria-labelledby={`${categoryToken}-title`}>
      <header className="category-page-heading marriage-page-heading">
        <div className="marriage-heading-copy">
          <h2 id={`${categoryToken}-title`}>{categoryLabel}</h2>
          <p>{categoryDescription}</p>
        </div>
        {onPartnerProfile && (
          <button type="button" className="marriage-spouse-shortcut" onClick={onPartnerProfile}>
            <span className="marriage-partner-avatar" aria-hidden="true">P</span>
            <span>Your partner</span>
            <span className="marriage-spouse-shortcut-chevron" aria-hidden="true">›</span>
          </button>
        )}
        {!categoryConfig && <span className="marriage-sample-tag">Synthetic example</span>}
      </header>

      {!categoryConfig && (
        <MarriageExampleSelector value={marriageExampleId ?? 'populated'} onChange={selectExample} />
      )}

      <CategoryHealthSummary
        key={categoryConfig?.categoryId ?? 'marriage'}
        score={categoryScore}
        categoryLabel={categoryLabel}
        itemTerm={foundationTerm}
        {...(categoryConfig?.scoreExplanationIntro
          ? { explanationIntro: categoryConfig.scoreExplanationIntro }
          : {})}
        {...(categoryConfig?.scoreInterpretationNote
          ? { interpretationNote: categoryConfig.scoreInterpretationNote }
          : {})}
      />

      <div className="faith-view-nav marriage-view-nav" role="tablist" aria-label={`${categoryLabel} content`}>
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${categoryToken}-tab-${tab.id}`}
            aria-controls={`${categoryToken}-panel-${tab.id}`}
            aria-selected={activeTab === tab.id}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => selectTab(tab.id)}
            onKeyDown={event => handleTabKeyDown(event, index)}
          >
            {tab.id === 'foundations' ? categoryConfig?.tabLabel ?? tab.label : tab.label}
          </button>
        ))}
      </div>

      <section
        className="marriage-view-panel"
        id={`${categoryToken}-panel-today`}
        role="tabpanel"
        aria-labelledby={`${categoryToken}-tab-today`}
        hidden={activeTab !== 'today'}
      >
        <TodayTogether
          rhythms={todayRhythms}
          hasActiveRhythms={userRhythms.length > 0}
          rhythmScores={foundationRhythmScores}
          completedRhythms={completedRhythms}
          undoableRhythms={undoableRhythms}
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
        <RhythmSuggestions
          userRhythms={userRhythms}
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
        role="tabpanel"
        aria-labelledby={`${categoryToken}-tab-foundations`}
        hidden={activeTab !== 'foundations'}
      >
        <FoundationList
          categoryLabel={categoryLabel}
          foundationTerm={foundationTerm}
          categoryToken={categoryToken}
          categoryFoundations={categoryFoundations}
          emptyFoundationDescription={categoryConfig?.emptyFoundationDescription
            ?? (fixture.id === 'empty'
              ? 'Ongoing areas of care; scores are unavailable without scored linked Rhythms.'
              : 'Ongoing areas of care.')}
          rhythms={foundationRhythms}
          rhythmScores={foundationRhythmScores}
          archivedRhythmIds={archivedRhythmIds}
          foundationScores={foundationScores}
          selectedFoundationId={selectedFoundationId}
          onSelect={openFoundation}
          onBack={() => setSelectedFoundationId(null)}
          onManage={openAssociationDialog}
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
  rhythms,
  hasActiveRhythms,
  rhythmScores,
  completedRhythms,
  undoableRhythms,
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
  rhythms: readonly RhythmPreview[];
  hasActiveRhythms: boolean;
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>;
  completedRhythms: ReadonlySet<string>;
  undoableRhythms: ReadonlySet<string>;
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
  const completedCount = rhythms.filter(rhythm => completedRhythms.has(rhythm.id)).length;
  return (
    <section className="marriage-today-section" aria-labelledby={`${categoryToken}-today-together-title`}>
      <div className="marriage-section-heading">
        <div>
          <h3 id={`${categoryToken}-today-together-title`}>Today</h3>
          <p>{completedCount} of {rhythms.length} Rhythms tended today</p>
        </div>
      </div>
      {rhythms.length > 0
        ? (
          <div className="marriage-rhythm-list current-plan-item-group">
            {rhythms.map(rhythm => (
              <RhythmDetailsDialog
                key={rhythm.id}
                rhythm={rhythm}
                inline
                completed={completedRhythms.has(rhythm.id)}
                statusLabel={rhythmLastActivityLabel(rhythm, todayDate)}
                people={peopleForRhythm(rhythm)}
                foundations={foundations}
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
                      ...(undoableRhythms.has(rhythm.id) ? { onUndo: () => onUndo(rhythm.id) } : {})
                    }
                  : {})}
                onClose={() => undefined}
              />
            ))}
          </div>
        )
        : (
          <div className="marriage-empty-state">
            <p>{hasActiveRhythms ? 'All caught up. Nothing to tend to.' : 'No active Rhythms.'}</p>
          </div>
        )}
    </section>
  );
}

function RhythmSuggestions({
  userRhythms,
  rhythmScores,
  completedRhythms,
  undoableRhythms,
  onTend,
  onUndo,
  onEditRhythm,
  onRhythmHistory,
  onPersonSelect,
  foundations,
  onOpenFoundation,
  onOpenCategory,
  todayDate,
  onAddRhythm,
  onBrowseSuggestions,
  archivedRhythms,
  archivedRhythmsOpenerRef,
  showArchivedRhythms,
  onShowArchivedRhythms,
  categoryLabel,
  categoryToken
}: {
  userRhythms: readonly RhythmPreview[];
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>;
  completedRhythms: ReadonlySet<string>;
  undoableRhythms: ReadonlySet<string>;
  onTend: MarriageViewProps['onTend'];
  onUndo: MarriageViewProps['onUndo'];
  onEditRhythm: MarriageViewProps['onEditRhythm'];
  onRhythmHistory: MarriageViewProps['onRhythmHistory'];
  onPersonSelect: MarriageViewProps['onPersonSelect'];
  foundations: readonly FoundationPreview[];
  onOpenFoundation: (foundationId: string, openerId: string) => void;
  onOpenCategory: MarriageViewProps['onOpenCategory'];
  todayDate: string;
  onAddRhythm: MarriageViewProps['onAddRhythm'];
  onBrowseSuggestions?: (event: MouseEvent<HTMLButtonElement>) => void;
  archivedRhythms: readonly RhythmPreview[];
  archivedRhythmsOpenerRef: RefObject<HTMLButtonElement | null>;
  showArchivedRhythms: boolean;
  onShowArchivedRhythms: () => void;
  categoryLabel: string;
  categoryToken: string;
}) {
  const allGroups = [
    { id: 'daily', title: 'Daily' },
    { id: 'weekly', title: 'Weekly' },
    { id: 'seasonal', title: 'Seasonal & Annual' },
    ...(userRhythms.some(rhythm => categoryRhythmGroup(rhythm) === 'custom')
      ? [{ id: 'custom' as const, title: 'Custom schedule' }]
      : [])
  ] as const;
  return (
    <section className="marriage-rhythm-section" aria-labelledby={`${categoryToken}-rhythm-section-title`}>
      <div className="marriage-section-heading">
        <div>
          <h3 id={`${categoryToken}-rhythm-section-title`}>Your Rhythms</h3>
          <p>Active Rhythms connected to {categoryLabel}.</p>
        </div>
      </div>
      <div className="marriage-empty-state">
        <h4>{userRhythms.length === 0 ? 'Start with a rhythm.' : 'Add a rhythm.'}</h4>
        <div className="marriage-onboarding-actions">
          <button type="button" className="btn mini" onClick={onAddRhythm}>Add Rhythm</button>
          {onBrowseSuggestions && (
            <button type="button" className="btn mini ghost" onClick={onBrowseSuggestions}>Browse suggestions</button>
          )}
        </div>
      </div>
      {allGroups.map(group => {
        const rhythms = userRhythms.filter(rhythm => categoryRhythmGroup(rhythm) === group.id);
        return (
          <section key={group.id} className="marriage-recommendation-group" aria-labelledby={`${categoryToken}-group-${group.id}`}>
            <header><h4 id={`${categoryToken}-group-${group.id}`}>{group.title}</h4><span>{rhythms.length}</span></header>
            {rhythms.length
              ? (
                <div className="marriage-rhythm-list">
                  {rhythms.map(rhythm => (
                    <RhythmDetailsDialog
                      key={rhythm.id}
                      rhythm={rhythm}
                      inline
                      statusLabel={rhythmLastActivityLabel(rhythm, todayDate)}
                      completed={completedRhythms.has(rhythm.id)}
                      people={peopleForRhythm(rhythm)}
                      foundations={foundations}
                      onPersonSelect={onPersonSelect}
                      onOpenFoundation={onOpenFoundation}
                      onOpenCategory={onOpenCategory}
                      headingId={`${categoryToken}-active-rhythm-${rhythm.id}`}
                      archived={false}
                      healthScore={rhythmHealthScore(rhythmScores.get(rhythm.id))}
                      onHistory={event => onRhythmHistory(rhythm.id, event)}
                      {...(isEditableRhythmId(rhythm.id)
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
              )
              : <p className="marriage-empty-state">No active Rhythms.</p>}
          </section>
        );
      })}
      <button
        ref={archivedRhythmsOpenerRef}
        type="button"
        className="category-archived-rhythms-toggle"
        aria-expanded={showArchivedRhythms}
        aria-haspopup="dialog"
        aria-controls="archived-rhythms-dialog"
        onClick={onShowArchivedRhythms}
      >
        Archived rhythms ({archivedRhythms.length})
      </button>
    </section>
  );
}

function FoundationList({
  categoryLabel,
  foundationTerm,
  categoryToken,
  categoryFoundations,
  emptyFoundationDescription,
  rhythms,
  rhythmScores,
  archivedRhythmIds,
  foundationScores,
  selectedFoundationId,
  onSelect,
  onBack,
  onManage,
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
  categoryLabel: string;
  foundationTerm: FoundationTerminology;
  categoryToken: string;
  categoryFoundations: readonly FoundationPreview[];
  emptyFoundationDescription: string;
  rhythms: readonly RhythmPreview[];
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>;
  archivedRhythmIds: readonly string[];
  foundationScores: ReadonlyMap<string, FoundationScoreSelection>;
  selectedFoundationId: string | null;
  onSelect: (id: string, openerId: string) => void;
  onBack: () => void;
  onManage: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
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
  const scoreInfoId = useId();
  const selectedFoundation = categoryFoundations.find(item => item.id === selectedFoundationId);
  const selectedFoundationScore = selectedFoundation
    ? foundationScores.get(selectedFoundation.id) ?? null
    : null;
  const selectedScoreEvidence = selectedFoundationScore
    ? foundationScoreEvidence(selectedFoundationScore)
    : undefined;
  const linkedRhythms = selectedFoundation
    ? rhythmsSupportingFoundation(rhythms, selectedFoundation.id)
    : [];

  return (
    <section className="marriage-foundations-section" aria-labelledby={`${categoryToken}-foundations-title`}>
      <div className="marriage-section-heading marriage-foundations-section__heading">
        <div className="marriage-foundations-section__heading-copy">
          <div className="marriage-foundations-section__title-row">
            <h3 id={`${categoryToken}-foundations-title`}>{categoryLabel} {foundationTerm.plural.toLowerCase()}</h3>
            <button
              type="button"
              className="rhythm-history-view__score-info"
              aria-label={`${scoreInfoExpanded ? 'Hide' : 'Show'} ${foundationTerm.singular} scoring explanation`}
              aria-expanded={scoreInfoExpanded}
              aria-controls={scoreInfoId}
              onClick={() => setScoreInfoExpanded(expanded => !expanded)}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <circle cx="8" cy="8" r="6.25" />
                <path d="M8 7.2v4M8 4.8h.01" />
              </svg>
            </button>
          </div>
          <p>
            {emptyFoundationDescription}
          </p>
        </div>
      </div>
      <div
        id={scoreInfoId}
        className="marriage-foundation-score-info__content"
        role="region"
        aria-labelledby={`${scoreInfoId}-title`}
        hidden={!scoreInfoExpanded}
      >
        <h4 id={`${scoreInfoId}-title`}>
          {foundationTerm.singular === 'Practice'
            ? 'Each Rhythm counts equally.'
            : 'Each rhythm counts equally.'}
        </h4>
        <p>We combine their Consistency and On Track scores to calculate this {foundationTerm.singular}’s Health.</p>
        <HealthWeightPanels
          consistencyDescription="How regularly you follow through"
          onTrackDescription="How caught up you are"
        />
        <p className="marriage-foundation-score-info__note">Rhythms need both scores to count.</p>
      </div>
      {selectedFoundation
        ? (
          <section className="marriage-foundation-detail" aria-labelledby={`${categoryToken}-foundation-detail-title`}>
            <button type="button" className="marriage-back-link" onClick={onBack}>
              ‹ All {foundationTerm.plural}
            </button>
            <FoundationCard
              foundation={selectedFoundation}
              variant="compact"
              icon={<MarriageIcon group="foundations" id={selectedFoundation.iconId ?? selectedFoundation.id} />}
              headingId={`${categoryToken}-foundation-detail-title`}
              reserveDescriptionSpace
              score={selectedFoundationScore?.health ?? null}
              scoreLabel={`${selectedFoundation.name} ${foundationTerm.singular} Health score`}
              {...(selectedScoreEvidence !== undefined
                ? { scoreEvidence: selectedScoreEvidence }
                : {})}
            >
              <div className="marriage-foundation-support">
                <div className="marriage-foundation-support__heading">
                  <h3 id={`${categoryToken}-foundation-linked-rhythms-title`}>
                    Linked Rhythms · {linkedRhythms.length}
                  </h3>
                  <button
                    type="button"
                    className="marriage-foundation-support__actions"
                    aria-haspopup="dialog"
                    onClick={event => onManage(selectedFoundation.id, event)}
                  >
                    Manage linked Rhythms
                  </button>
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
            </FoundationCard>
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
                  {...(scoreEvidence !== undefined
                    ? { scoreEvidence }
                    : {})}
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

function foundationScoreEvidence(score: FoundationScoreSelection): string | undefined {
  if (score.linkedRhythmIds.length === 0) return 'No linked Rhythms';
  if (score.activeLinkedRhythmIds.length === 0) return 'No active linked Rhythms';
  if (score.eligibleRhythmIds.length < score.activeLinkedRhythmIds.length) {
    return `${score.eligibleRhythmIds.length} of ${score.activeLinkedRhythmIds.length} linked Rhythms scored`;
  }
  return undefined;
}

function FoundationRhythmGroup({
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
            people={peopleForRhythm(rhythm)}
            foundations={foundations}
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
