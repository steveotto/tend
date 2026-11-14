import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import type { ReactNode } from 'react';
import {
  areas,
  peopleForRhythm,
  type FoundationPreview,
  type PersonId,
  type PersonPreview,
  type RhythmPreview
} from '../domain/preview-data.ts';
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
import { TodayTimeframeHeader } from './TodayTimeframeHeader.tsx';
import { selectTendedRhythmDisplayIds } from '../domain/category-rhythms.ts';
import { formatScore } from '../domain/score-display.ts';
import { aggregateCategoryHealthScores } from '../domain/category-scoring.ts';
import { TodayPrayerModule } from './TodayPrayerModule.tsx';

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
  showTended?: boolean;
  onShowTendedChange?: (show: boolean) => void;
  initializing?: boolean;
  rhythms: readonly RhythmPreview[];
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>;
  prayerRequests: readonly PrayerRequestPreview[];
  onPrayForRequest: (requestId: string) => string | null;
  categoryHealthScores: ReadonlyMap<string, number | null>;
  onNavigate: (destination: Destination) => void;
  onPersonSelect: (personId: PersonId) => void;
  foundations: readonly FoundationPreview[];
  onOpenFoundation: (foundationId: string, openerId: string) => void;
  onHistory: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onTend: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onEditRhythm: (rhythm: RhythmPreview, event: MouseEvent<HTMLButtonElement>) => void;
  onUndo: (id: string) => void;
};

export function TodayView({
  people = [],
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
  showTended = false,
  onShowTendedChange = () => undefined,
  initializing = false,
  rhythms,
  rhythmScores,
  prayerRequests,
  onPrayForRequest,
  categoryHealthScores,
  foundations,
  onOpenFoundation,
  onNavigate,
  onPersonSelect,
  onHistory,
  onTend,
  onEditRhythm,
  onUndo,
}: TodayViewProps) {
  const tendedRhythmIds = savedTendedRhythmIds
    ?? selectTendedRhythmDisplayIds(completedRhythms, satisfiedRhythmIds);
  const timeBlocks = useTimeBlockSettings();
  const [expandedSectionIds, setExpandedSectionIds] = useState<ReadonlySet<string>>(() => new Set());
  const lastAutoExpandedContext = useRef<string | null>(null);
  const manuallyToggledSectionIds = useRef(new Set<string>());
  const sectionIdPrefix = useId();
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
    areas.map(area => categoryHealthScores.get(area.id) ?? null)
  );
  const overallHealthLabel = overallHealth.health === null
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
        <div className="menu-grid">
          {areas.map(area => {
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
        </div>
      </section>

      <section className="today-plan-section" aria-label="Today's plan">
        <TendedRhythmList
          rhythms={planRhythms}
          tendedRhythmIds={tendedRhythmIds}
          satisfiedRhythmIds={satisfiedRhythmIds}
          undoableRhythmIds={undoableRhythms}
          showTended={showTended}
          onShowTendedChange={onShowTendedChange}
          showProgress
          progressDisclosure
          keepToggleWhenEmpty
          renderControls={false}
          onUndo={onUndo}
          resetKey={planRhythms.map(rhythm => rhythm.id).join('\u001f')}
          initializing={initializing}
        >
          {({ visibleRhythmIds, tendedRhythmIds: displayedTendedIds, controls, itemProps }) => {
              const allMatchingHidden = planRhythms.length > 0
                && planRhythms.every(rhythm => !visibleRhythmIds.has(rhythm.id));
              const weather = view === 'now'
                && weatherController.city
                && weatherController.weather.status === 'ready'
                && (
                  <TodayWeather
                    report={weatherController.weather.report}
                    localDate={localDate}
                    time={null}
                    containerClassName="today-plan__weather"
                  />
                );
              const renderRhythms = (sectionRhythms: readonly RhythmPreview[]) =>
                sectionRhythms
                  .filter(rhythm => visibleRhythmIds.has(rhythm.id))
                  .map(rhythm => (
                    <div key={rhythm.id} {...itemProps(rhythm.id)}>
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
                          ? { onUndo: () => onUndo(rhythm.id) }
                          : {})}
                        onClose={() => undefined}
                      />
                    </div>
                  ));
              const emptyMessage = view === 'now'
                ? 'No active Rhythms right now.'
                : view === 'flexible' ? 'No flexible Rhythms due today.' : 'No Rhythms due today.';
              const renderHiddenStatus = allMatchingHidden && (
                <div className="dashed-empty-state" role="status">
                  <p>You’ve tended everything here.</p>
                </div>
              );
              return (
                <>
                  <div className="today-plan__title-row">
                    <h3 className="today-plan__heading">Today</h3>
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
                        <TodayAgendaRail className="today-plan__agenda-rail today-plan__agenda-rail--now">
                          <section className="today-plan__agenda-group today-plan__agenda-group--expanded">
                            <TodayTimeframeHeader
                              title={currentBlock?.name ?? 'Now'}
                              timeRange={currentBlockRange}
                              agendaState="expanded"
                              progress={timeframeProgress(planSections[0]?.rhythms ?? [])}
                              trailingContent={weather}
                            />
                            {renderHiddenStatus}
                            {planSections.length > 0
                              ? <div className="current-plan-item-group">{renderRhythms(planSections[0]!.rhythms)}</div>
                              : (
                                <div className="today-plan__empty-rhythms" role="status">
                                  <p>{emptyMessage}</p>
                                  <button type="button" className="today-plan__empty-action" onClick={() => onViewChange('all-today')}>
                                    View all today
                                  </button>
                                </div>
                              )}
                          </section>
                        </TodayAgendaRail>
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
                                      <div className="current-plan-item-group">{renderRhythms(section.rhythms)}</div>
                                    </section>
                                  ))}
                                </TodayAgendaRail>
                                {renderHiddenStatus}
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
                                        <div className="today-plan__accordion-panel-content current-plan-item-group">
                                          {renderRhythms(section.rhythms)}
                                        </div>
                                      </div>
                                    </section>
                                  );
                                })}
                              </TodayAgendaRail>
                              {renderHiddenStatus}
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

      <TodayPrayerModule
        requests={prayerRequests}
        onPray={onPrayForRequest}
      />

      <section aria-labelledby="calendar-heading" className="today-calendar-section">
        <div className="sectiontitle"><h2 id="calendar-heading">On your calendar</h2></div>
        <div className="card calendar-card">
          <p className="empty">No calendars connected in this preview.</p>
          <button type="button" className="btn mini ghost calendar-settings-button" onClick={() => onNavigate('more')}>Settings</button>
        </div>
      </section>
    </main>
  );
}
