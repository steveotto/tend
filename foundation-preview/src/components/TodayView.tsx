import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import type { ReactNode } from 'react';
import {
  peopleForRhythm,
  type FoundationPreview,
  type PersonId,
  type PersonPickerGroup,
  type PersonPreview,
  type RhythmPreview
} from '../domain/preview-data.ts';
import type { FriendshipData } from '../domain/friendships.ts';
import type { PersonSpark, PersonSparkDraft } from '../domain/person-sparks.ts';
import { activePersonSparkCompletion } from '../domain/person-sparks.ts';
import {
  selectHomePersonSparks,
  selectPersonSparksByStatus,
  selectSparksVisibleToPeople,
  selectSparkVisiblePeople
} from '../domain/home-sparks.ts';
import type { PrayerRequestPreview } from '../domain/prayer-session.ts';
import { isEditableRhythmId } from '../domain/rhythm-editor.ts';
import { rhythmHealthScore } from '../domain/rhythm-scoring.ts';
import type { RhythmScoreResult } from '../domain/rhythm-scoring.ts';
import { isRhythmEligibleForToday } from '../domain/category-rhythms.ts';
import { AreaIcon } from './AreaIcon.tsx';
import { CategoryHealthBadge, ScoreMeter } from './Cards.tsx';
import type { Destination } from './AppNavigation.tsx';
import { RhythmDetailsDialog } from './RhythmDetailsDialog.tsx';
import {
  currentTodayBlock,
  selectTodayPlanSections,
  todayBlockRange,
  todayFocusContext
} from '../domain/today-plan.ts';
import type { TodayPlanSection, TodayViewId } from '../domain/today-plan.ts';
import { TodayWeather } from './TodayWeather.tsx';
import type { TodayWeatherController } from './useTodayWeather.ts';
import { useTimeBlockSettings } from './TimeBlocksContext.tsx';
import { TendedRhythmList } from './TendedRhythmList.tsx';
import { TendedRhythmItems } from './TendedRhythmItems.tsx';
import { TodayTimeframeHeader } from './TodayTimeframeHeader.tsx';
import { selectTendedRhythmDisplayIds } from '../domain/category-rhythms.ts';
import { formatScore } from '../domain/score-display.ts';
import { aggregateCategoryHealthScores } from '../domain/category-scoring.ts';
import { TodayPrayerModule } from './TodayPrayerModule.tsx';
import type { PrayerDataStatus } from './TodayPrayerModule.tsx';
import type { CalendarSource } from '../domain/calendar-sources.ts';
import { CalendarAgendaSection } from './CalendarAgendaSection.tsx';
import {
  useAvailableCategories,
  useAvailablePersonGroups,
  useCategoryAvailability,
  usePrayerEnabled
} from './CategoryAvailabilityContext.tsx';
import { PersonSparkCard } from './PersonSparkCard.tsx';
import { PersonSparkEditorDialog } from './PersonSparkEditorDialog.tsx';
import { SparksDialog } from './SparksDialog.tsx';

const planTypes: { id: TodayViewId; label: string }[] = [
  { id: 'now', label: 'Now' },
  { id: 'flexible', label: 'Flexible' },
  { id: 'all-today', label: 'All today' }
];

function TodayAgendaRail({ className, children }: { className: string; children: ReactNode }) {
  const railRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const updateEndpoints = () => {
      const railRect = rail.getBoundingClientRect();
      const headers = [...rail.querySelectorAll<HTMLElement>(
        ':scope > .today-plan__agenda-group > .today-timeframe-header'
      )].filter(header => header.getClientRects().length > 0);
      rail.dataset.hasRailLine = String(headers.length > 1);
      if (headers.length < 2) {
        rail.style.removeProperty('--today-agenda-rail-start');
        rail.style.removeProperty('--today-agenda-rail-length');
        return;
      }

      const firstRect = headers[0]!.getBoundingClientRect();
      const lastRect = headers.at(-1)!.getBoundingClientRect();
      const start = firstRect.top + firstRect.height / 2 - railRect.top;
      const end = lastRect.top + lastRect.height / 2 - railRect.top;
      rail.style.setProperty('--today-agenda-rail-start', `${start}px`);
      rail.style.setProperty('--today-agenda-rail-length', `${Math.max(0, end - start)}px`);
    };

    updateEndpoints();
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateEndpoints);
    resizeObserver?.observe(rail);
    rail.querySelectorAll<HTMLElement>('.today-timeframe-header').forEach(header => resizeObserver?.observe(header));
    const mutationObserver = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(updateEndpoints);
    mutationObserver?.observe(rail, { childList: true, subtree: true });
    window.addEventListener('resize', updateEndpoints);
    return () => {
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener('resize', updateEndpoints);
    };
  }, [children]);

  return (
    <div ref={railRef} className={className} data-has-rail-line="false">
      {children}
    </div>
  );
}

function timeframeSubtitle(section: TodayPlanSection): string | undefined {
  if (section.category === 'scheduled') return section.range;
  return section.category === 'anytime' ? 'On your schedule' : 'Throughout the day';
}

type TodayViewProps = {
  people?: readonly PersonPreview[];
  peopleGroups?: readonly PersonPickerGroup[];
  personSparks?: readonly PersonSpark[];
  friendships?: FriendshipData;
  greeting: string;
  evaluationInstant: Date;
  localDate: string;
  view: TodayViewId;
  onViewChange: (view: TodayViewId) => void;
  weatherController: TodayWeatherController;
  completedRhythms: ReadonlySet<string>;
  undoableRhythms: ReadonlySet<string>;
  satisfiedRhythmIds?: ReadonlySet<string>;
  tendedRhythmIds?: ReadonlySet<string>;
  initializing?: boolean;
  rhythms: readonly RhythmPreview[];
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>;
  prayerDataStatus?: PrayerDataStatus;
  prayerDataError?: string;
  prayerRequests: readonly PrayerRequestPreview[];
  onPrayForRequest: (requestId: string, expectedUpdatedAt: string, actorId: PersonId) => string | null;
  categoryHealthScores: ReadonlyMap<string, number | null>;
  onNavigate: (destination: Destination) => void;
  onOpenSettings?: () => void;
  onOpenCalendarSetup?: () => void;
  onPersonSelect: (personId: PersonId) => void;
  onCreateSpark?: (ownerId: PersonId, draft: PersonSparkDraft) => string | null;
  onUpdateSpark?: (sparkId: string, draft: PersonSparkDraft) => string | null;
  onArchiveSpark?: (sparkId: string, archived: boolean) => string | null;
  onDeleteSpark?: (sparkId: string, viewerId: PersonId) => string | null;
  onUndoSpark?: (sparkId: string) => string | null;
  onCompleteSpark?: (
    spark: PersonSpark,
    opener: HTMLButtonElement,
    returnFocus: HTMLElement | null
  ) => void;
  onOpenSparkPerson?: (personId: PersonId, returnFocus: HTMLElement | null) => void;
  foundations: readonly FoundationPreview[];
  onOpenFoundation: (foundationId: string, openerId: string) => void;
  onHistory: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onTend: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onEditRhythm: (rhythm: RhythmPreview, event: MouseEvent<HTMLButtonElement>) => void;
  onUndo: (id: string) => void;
  calendarSources?: readonly CalendarSource[];
  localTimeZone?: string;
  calendarReaderEnabled?: boolean;
  showCalendarOnToday?: boolean;
  onCalendarEventsChange?: (events: readonly import('../domain/calendar-events.ts').CalendarEvent[]) => void;
};

export function TodayView({
  people = [],
  peopleGroups = [],
  personSparks = [],
  friendships,
  greeting,
  evaluationInstant,
  localDate,
  view,
  onViewChange,
  weatherController,
  completedRhythms,
  undoableRhythms,
  satisfiedRhythmIds = new Set(),
  tendedRhythmIds: savedTendedRhythmIds,
  initializing = false,
  rhythms,
  rhythmScores,
  prayerDataStatus = 'ready',
  prayerDataError,
  prayerRequests,
  onPrayForRequest,
  categoryHealthScores,
  foundations,
  onOpenFoundation,
  onNavigate,
  onOpenSettings = () => onNavigate('more'),
  onOpenCalendarSetup,
  onPersonSelect,
  onCreateSpark,
  onUpdateSpark,
  onArchiveSpark,
  onDeleteSpark,
  onUndoSpark,
  onCompleteSpark,
  onOpenSparkPerson,
  onHistory,
  onTend,
  onEditRhythm,
  onUndo,
  calendarSources = [],
  localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  calendarReaderEnabled = false,
  showCalendarOnToday = true,
  onCalendarEventsChange,
}: TodayViewProps) {
  const tendedRhythmIds = savedTendedRhythmIds
    ?? selectTendedRhythmDisplayIds(completedRhythms, satisfiedRhythmIds);
  const availableCategories = useAvailableCategories();
  const categoryPreferences = useCategoryAvailability();
  const availablePeopleGroups = useAvailablePersonGroups(peopleGroups);
  const prayerEnabled = usePrayerEnabled();
  const timeBlocks = useTimeBlockSettings();
  const [expandedSectionIds, setExpandedSectionIds] = useState<ReadonlySet<string>>(() => new Set());
  const lastAutoExpandedContext = useRef<string | null>(null);
  const manuallyToggledSectionIds = useRef(new Set<string>());
  const sectionIdPrefix = useId();
  const [sparksDialog, setSparksDialog] = useState<{
    key: number;
    initialSparkId?: string;
    startWithAdd?: boolean;
  } | null>(null);
  const [sparkEditor, setSparkEditor] = useState<{
    key: number;
    spark: PersonSpark | null;
  } | null>(null);
  const sparksDialogSequence = useRef(0);
  const sparkEditorSequence = useRef(0);
  const sparksDialogOpener = useRef<HTMLElement | null>(null);
  const sparkEditorOpener = useRef<HTMLElement | null>(null);
  const sparkPeople = useMemo(
    () => selectSparkVisiblePeople(people, availablePeopleGroups, categoryPreferences),
    [people, availablePeopleGroups, categoryPreferences]
  );
  const visibleSparks = useMemo(
    () => selectSparksVisibleToPeople(personSparks, sparkPeople),
    [personSparks, sparkPeople]
  );
  const homeSparks = useMemo(
    () => selectHomePersonSparks(visibleSparks, localDate),
    [visibleSparks, localDate]
  );
  const activeVisibleSparks = useMemo(
    () => selectPersonSparksByStatus(visibleSparks, 'active'),
    [visibleSparks]
  );
  const sparkActions = onCreateSpark && onUpdateSpark && onArchiveSpark
    && onDeleteSpark && onUndoSpark && onCompleteSpark
    ? {
        create: onCreateSpark,
        update: onUpdateSpark,
        archive: onArchiveSpark,
        delete: onDeleteSpark,
        undo: onUndoSpark,
        complete: onCompleteSpark
      }
    : null;
  function openSparksDialog(
    opener: HTMLElement,
    request: { initialSparkId?: string; startWithAdd?: boolean } = {}
  ) {
    sparksDialogOpener.current = opener;
    setSparksDialog({ key: ++sparksDialogSequence.current, ...request });
  }
  function openSparkEditor(opener: HTMLElement, spark: PersonSpark | null = null) {
    sparkEditorOpener.current = opener;
    setSparkEditor({ key: ++sparkEditorSequence.current, spark });
  }
  const eligibleRhythms = useMemo(
    () => rhythms.filter(rhythm => isRhythmEligibleForToday(rhythm, localDate)),
    [rhythms, localDate]
  );
  const planSections = useMemo(
    () => selectTodayPlanSections(eligibleRhythms, view, evaluationInstant, timeBlocks),
    [eligibleRhythms, view, evaluationInstant, timeBlocks]
  );
  const planRhythms = planSections.flatMap(section => section.rhythms);
  const currentBlockId = currentTodayBlock(evaluationInstant, timeBlocks);
  const currentBlock = currentBlockId
    ? timeBlocks.blocks.find(block => block.id === currentBlockId)
    : undefined;
  const currentBlockRange = currentBlockId
    ? todayBlockRange(currentBlockId, timeBlocks)
    : todayFocusContext('now', 'scheduled', evaluationInstant, timeBlocks);
  const timeframeProgress = (sectionRhythms: readonly RhythmPreview[]) => {
    const tendedCount = sectionRhythms.filter(rhythm => tendedRhythmIds.has(rhythm.id)).length;
    return {
      text: `${tendedCount} of ${sectionRhythms.length}`,
      accessibleLabel: `${tendedCount} of ${sectionRhythms.length} tended`
    };
  };
  useEffect(() => {
    if (view !== 'all-today' || initializing) return;
    const currentSection = planSections.find(section =>
      section.category === 'scheduled' && section.id === currentBlockId
    );
    const contextKey = `${localDate}:${currentBlockId ?? 'no-current-block'}:${currentSection ? 'visible' : 'empty'}`;
    if (lastAutoExpandedContext.current === contextKey) return;
    lastAutoExpandedContext.current = contextKey;
    if (!currentSection || manuallyToggledSectionIds.current.has(currentSection.id)) return;
    setExpandedSectionIds(current => {
      if (current.has(currentSection.id)) return current;
      return new Set([...current, currentSection.id]);
    });
  }, [initializing, view, localDate, planSections, currentBlockId]);
  const overallHealth = aggregateCategoryHealthScores(
    availableCategories.map(area => categoryHealthScores.get(area.id) ?? null)
  );
  const overallHealthLabel = availableCategories.length === 0
    ? 'Overall Health unavailable'
    : overallHealth.health === null
    ? 'Overall health: Not enough data'
    : `Overall health score ${formatScore(overallHealth.health)} out of 100`;
  function handlePlanTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number;
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (index + 1) % planTypes.length;
        break;
      case 'ArrowLeft':
        nextIndex = (index - 1 + planTypes.length) % planTypes.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = planTypes.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs?.[nextIndex]?.focus();
    onViewChange(planTypes[nextIndex]!.id);
  }

  return (
    <main className="home-dashboard">
      <div className="sectiontitle dashboard-greeting">
        <h2>{greeting}</h2>
      </div>

      <section className="card overall-card" aria-label="Overall health summary">
        <div className="dashboard-overall-heading">
          <h3>Overall health</h3>
          <span className="ov-score" aria-hidden="true">{formatScore(overallHealth.health)}</span>
        </div>
        <ScoreMeter
          label={overallHealthLabel}
          score={overallHealth.health}
          markerPlacement="below"
        />
        <nav className="menu-grid today-category-menu" aria-label="Today categories">
          {availableCategories.length === 0
            ? (
              <div className="category-empty-state">
                <p>All categories are turned off. Your saved data is still here.</p>
                <button type="button" className="btn mini ghost" onClick={onOpenSettings}>
                  Open Settings
                </button>
              </div>
            )
            : availableCategories.map(area => {
              const score = categoryHealthScores.get(area.id) ?? null;
              return (
                <button
                  className="menu-area"
                  key={area.id}
                  type="button"
                  aria-description={score === null
                    ? `${area.label} health score unavailable`
                    : `${area.label} health score ${formatScore(score)} out of 100`}
                  onClick={() => onNavigate(area.id)}
                >
                  <span className="menu-area-icon" aria-hidden="true">
                    <AreaIcon id={area.id} variant="today-summary" />
                  </span>
                  <span className="ma-name">{area.label}</span>
                  <CategoryHealthBadge score={score} appearance="rounded" />
                </button>
              );
            })}
        </nav>
      </section>

      <section className="today-plan-section" aria-label="Today's plan">
        <TendedRhythmList
          rhythms={planRhythms}
          tendedRhythmIds={tendedRhythmIds}
          satisfiedRhythmIds={satisfiedRhythmIds}
          undoableRhythmIds={undoableRhythms}
          showProgress
          displayMode="done-rows"
          todayDate={localDate}
          renderControls={false}
          onUndo={onUndo}
          resetKey={planRhythms.map(rhythm => rhythm.id).join('\u001f')}
          initializing={initializing}
        >
          {({
              visibleRhythmIds,
              tendedRhythmIds: displayedTendedIds,
              tendedDisplayItems,
              expandedTendedRhythmIds,
              onToggleTendedRhythm,
              onUndoTendedRhythm,
              controls,
              itemProps
            }) => {
              const weather = weatherController.city
                && weatherController.weather.status === 'ready'
                && (
                  <TodayWeather
                    report={weatherController.weather.report}
                    localDate={localDate}
                    time={null}
                    containerClassName="today-plan__title-weather"
                    compact
                  />
                );
              const renderRhythmCard = (rhythm: RhythmPreview) => (
                <RhythmDetailsDialog
                        rhythm={rhythm}
                        inline
                        headingId={`today-rhythm-${rhythm.id}-title`}
                        people={peopleForRhythm(rhythm, people)}
                        foundations={foundations}
                        relatedRhythms={rhythms}
                        onPersonSelect={onPersonSelect}
                        onOpenFoundation={onOpenFoundation}
                        onOpenCategory={categoryId => onNavigate(categoryId)}
                        completed={displayedTendedIds.has(rhythm.id)}
                        healthScore={rhythmHealthScore(rhythmScores.get(rhythm.id))}
                        onTend={event => onTend(rhythm.id, event)}
                        {...(rhythm.categoryIds?.includes('health')
                          ? {
                              completionActionLabel: 'Log',
                              completionActionAccessibleLabel: rhythm.healthLogCapability === 'cardio'
                                ? 'Log run'
                                : rhythm.healthLogCapability === 'weight' ? 'Log weigh-in' : 'Log workout',
                              completedActionLabel: rhythm.healthLogCapability === 'weight' ? 'Weighed in' : 'Logged'
                            }
                          : {})}
                        onHistory={event => onHistory(rhythm.id, event)}
                        {...(isEditableRhythmId(rhythm.id)
                          ? { onEdit: event => onEditRhythm(rhythm, event) }
                          : {})}
                        {...(undoableRhythms.has(rhythm.id) && !rhythm.healthLogCapability
                          ? { onUndo: () => onUndoTendedRhythm(rhythm.id) }
                          : {})}
                        onClose={() => undefined}
                      />
              );
              const renderRhythms = (sectionRhythms: readonly RhythmPreview[]) => {
                const visibleRhythms = sectionRhythms
                  .filter(rhythm => visibleRhythmIds.has(rhythm.id));
                return visibleRhythms.length > 0
                  ? (
                    <TendedRhythmItems
                      className="current-plan-item-group"
                      rhythms={visibleRhythms}
                      tendedRhythmIds={displayedTendedIds}
                      displayItems={tendedDisplayItems}
                      expandedRhythmIds={expandedTendedRhythmIds}
                      onToggleRhythm={onToggleTendedRhythm}
                      itemProps={itemProps}
                      renderRhythmCard={renderRhythmCard}
                      renderExpandedRhythm={item => renderRhythmCard(item.rhythm)}
                    />
                  )
                  : null;
              };
              const emptyMessage = view === 'now'
                ? 'No active Rhythms right now.'
                : view === 'flexible' ? 'No flexible Rhythms due today.' : 'No Rhythms due today.';
              return (
                <>
                  <div className="today-plan__title-row">
                    <div className="today-plan__title-main">
                      <h3 className="today-plan__heading">Today</h3>
                      {weather}
                    </div>
                    <div className="today-plan__title-progress">{controls}</div>
                  </div>
                  <div className="today-plan__controls">
                    <div className="faith-practice-tabs home-plan-type-tabs" role="tablist" aria-label="Today views">
                      {planTypes.map((type, index) => (
                        <button
                          key={type.id}
                          type="button"
                          role="tab"
                          id={`plan-tab-${type.id}`}
                          aria-controls="today-plan-items"
                          aria-selected={view === type.id}
                          tabIndex={view === type.id ? 0 : -1}
                          onClick={() => onViewChange(type.id)}
                          onKeyDown={event => handlePlanTabKeyDown(event, index)}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="today-plan__results">
                    <div
                      className={`current-plan-items${view === 'flexible' ? ' current-plan-items--flexible' : ''}`}
                      id="today-plan-items"
                      role="tabpanel"
                      aria-labelledby={`plan-tab-${view}`}
                    >
                      {view === 'now' && (
                        <section className="today-plan__agenda-group today-plan__agenda-group--expanded">
                            <TodayTimeframeHeader
                              title={currentBlock?.name ?? 'Now'}
                              timeRange={currentBlockRange}
                              agendaState="expanded"
                              progress={timeframeProgress(planSections[0]?.rhythms ?? [])}
                            />
                            {planSections.length > 0
                              ? renderRhythms(planSections[0]!.rhythms)
                              : (
                                <div className="today-plan__empty-rhythms today-plan__empty-rhythms--now" role="status">
                                  <p>{emptyMessage}</p>
                                  <button type="button" className="today-plan__empty-action" onClick={() => onViewChange('all-today')}>
                                    View all today
                                  </button>
                                </div>
                              )}
                        </section>
                      )}
                      {view === 'flexible' && (
                        <>
                          {planSections.length > 0
                            ? (
                              <>
                                <TodayAgendaRail className="today-plan__agenda-rail today-plan__agenda-rail--flexible">
                                  {planSections.map(section => (
                                    <section
                                      className="today-plan__agenda-group today-plan__agenda-group--expanded today-plan__flexible-group"
                                      key={section.id}
                                      aria-labelledby={`${sectionIdPrefix}-${section.id}-heading`}
                                    >
                                      <TodayTimeframeHeader
                                        headingId={`${sectionIdPrefix}-${section.id}-heading`}
                                        title={section.title}
                                        timeRange={timeframeSubtitle(section)}
                                        agendaState="expanded"
                                        progress={timeframeProgress(section.rhythms)}
                                      />
                                      {renderRhythms(section.rhythms)}
                                    </section>
                                  ))}
                                </TodayAgendaRail>
                              </>
                            )
                            : (
                              <div className="today-plan__empty-rhythms" role="status">
                                <p>{emptyMessage}</p>
                              </div>
                            )}
                        </>
                      )}
                      {view === 'all-today' && (
                        planSections.length
                          ? (
                            <>
                              <TodayAgendaRail className="today-plan__accordion-groups today-plan__agenda-rail today-plan__agenda-rail--all-today">
                                {planSections.map(section => {
                                  const expanded = expandedSectionIds.has(section.id);
                                  const panelId = `${sectionIdPrefix}-${section.id}-panel`;
                                  const headingId = `${sectionIdPrefix}-${section.id}-disclosure`;
                                  return (
                                    <section
                                      className={`today-plan__agenda-group today-plan__accordion-group${expanded ? ' today-plan__agenda-group--expanded' : ' today-plan__agenda-group--collapsed'}`}
                                      key={section.id}
                                    >
                                      <TodayTimeframeHeader
                                        title={section.title}
                                        timeRange={timeframeSubtitle(section)}
                                        progress={timeframeProgress(section.rhythms)}
                                        disclosure={{
                                          id: headingId,
                                          panelId,
                                          expanded,
                                          onToggle: () => {
                                            manuallyToggledSectionIds.current.add(section.id);
                                            setExpandedSectionIds(current => {
                                              const next = new Set(current);
                                              if (next.has(section.id)) next.delete(section.id);
                                              else next.add(section.id);
                                              return next;
                                            });
                                          }
                                        }}
                                      />
                                      <div
                                        className="today-plan__accordion-panel"
                                        id={panelId}
                                        role="region"
                                        aria-labelledby={headingId}
                                        hidden={!expanded}
                                      >
                                        <div className="today-plan__accordion-panel-content">
                                          {renderRhythms(section.rhythms)}
                                        </div>
                                      </div>
                                    </section>
                                  );
                                })}
                              </TodayAgendaRail>
                            </>
                          )
                          : (
                            <div className="today-plan__empty-rhythms" role="status">
                              <p>{emptyMessage}</p>
                            </div>
                          )
                      )}
                  </div>
                </div>
                </>
              );
            }}
        </TendedRhythmList>
      </section>

      {sparkActions && friendships && sparkPeople.length > 0 && (
        <section className="today-sparks-section" aria-labelledby="today-sparks-heading">
          <header className="today-sparks-section__heading">
            <div>
              <h2 id="today-sparks-heading">Sparks</h2>
            </div>
            {visibleSparks.length > 0 && (
              <button
                type="button"
                className="today-sparks-section__view-all"
                onClick={event => openSparksDialog(event.currentTarget)}
              >
                View all
              </button>
            )}
          </header>
          {homeSparks.length > 0 ? (
            <ul className="person-spark-list today-sparks-section__list">
              {homeSparks.map(spark => {
                const associatedPeople = [spark.ownerId, ...spark.sharedWith]
                  .map(id => sparkPeople.find(person => person.id === id))
                  .filter((person): person is PersonPreview => person !== undefined);
                const completion = activePersonSparkCompletion(spark);
                const linkedConnection = completion?.connectionId
                  ? friendships.connections.find(connection => connection.id === completion.connectionId)
                  : undefined;
                return (
                  <li
                    key={spark.id}
                    className="person-spark-list__item"
                    data-person-spark-id={spark.id}
                  >
                    <PersonSparkCard
                      spark={spark}
                      associatedPeople={associatedPeople}
                      {...(linkedConnection ? { linkedConnection } : {})}
                      today={localDate}
                      onComplete={(item, opener) => onCompleteSpark?.(item, opener, opener)}
                      onEdit={(item, opener) => openSparkEditor(opener, item)}
                      onPersonSelect={onPersonSelect}
                    />
                  </li>
                );
              })}
            </ul>
          ) : activeVisibleSparks.length > 0 ? (
            <div className="today-sparks-section__empty" role="status">
              <p>Your next Sparks are saved for later.</p>
            </div>
          ) : (
            <div className="today-sparks-section__empty" role="status">
              <p>Save an idea for connecting.</p>
              <button
                type="button"
                className="person-spark-panel__add"
                onClick={event => openSparkEditor(event.currentTarget)}
              >
                + Add Spark
              </button>
            </div>
          )}
        </section>
      )}

      {sparksDialog && sparkActions && friendships && sparkPeople.length > 0 && (
        <SparksDialog
          key={sparksDialog.key}
          people={sparkPeople}
          peopleGroups={peopleGroups}
          sparks={visibleSparks}
          friendships={friendships}
          today={localDate}
          {...(sparksDialog.initialSparkId ? { initialSparkId: sparksDialog.initialSparkId } : {})}
          {...(sparksDialog.startWithAdd ? { startWithAdd: true } : {})}
          onCreate={sparkActions.create}
          onUpdate={sparkActions.update}
          onArchive={sparkActions.archive}
          onDelete={sparkActions.delete}
          onUndo={sparkActions.undo}
          onComplete={(spark, opener) => {
            const returnFocus = sparksDialogOpener.current;
            setSparksDialog(null);
            sparkActions.complete(spark, opener, returnFocus);
          }}
          onPersonSelect={personId => {
            const returnFocus = sparksDialogOpener.current;
            setSparksDialog(null);
            if (onOpenSparkPerson) onOpenSparkPerson(personId, returnFocus);
            else onPersonSelect(personId);
          }}
          onClose={() => setSparksDialog(null)}
        />
      )}

      {sparkEditor && sparkActions && friendships && sparkPeople.length > 0 && (
        <PersonSparkEditorDialog
          key={sparkEditor.key}
          spark={sparkEditor.spark}
          {...(sparkEditor.spark ? { initialOwnerId: sparkEditor.spark.ownerId } : {})}
          viewerId={sparkEditor.spark?.ownerId ?? sparkPeople[0]!.id}
          people={sparkPeople}
          peopleGroups={peopleGroups}
          friendships={friendships}
          onCreate={sparkActions.create}
          onUpdate={sparkActions.update}
          onArchive={sparkActions.archive}
          onDelete={sparkActions.delete}
          onUndo={sparkActions.undo}
          onClose={() => {
            const returnFocus = sparkEditorOpener.current;
            setSparkEditor(null);
            window.requestAnimationFrame(() => {
              if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
            });
          }}
        />
      )}

      <TodayPrayerModule
        people={people}
        peopleGroups={peopleGroups}
        requests={prayerRequests}
        dataStatus={prayerDataStatus}
        {...(prayerDataError ? { dataError: prayerDataError } : {})}
        enabled={prayerEnabled}
        onPray={onPrayForRequest}
      />

      {showCalendarOnToday && (
        <CalendarAgendaSection
          sources={calendarSources}
          timeZone={localTimeZone}
          readerEnabled={calendarReaderEnabled}
          {...(onOpenCalendarSetup ? { onOpenSetup: onOpenCalendarSetup } : {})}
          {...(onCalendarEventsChange ? { onEventsChange: onCalendarEventsChange } : {})}
        />
      )}
    </main>
  );
}
