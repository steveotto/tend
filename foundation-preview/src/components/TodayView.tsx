import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import {
  areas,
  peopleForRhythm,
  type FoundationPreview,
  type PersonId,
  type PersonPreview,
  type RhythmPreview
} from '../domain/preview-data.ts';
import { isEditableRhythmId } from '../domain/rhythm-editor.ts';
import { rhythmHealthScore } from '../domain/rhythm-scoring.ts';
import type { RhythmScoreResult } from '../domain/rhythm-scoring.ts';
import { AreaIcon } from './AreaIcon.tsx';
import { CategoryHealthBadge, ScoreMeter } from './Cards.tsx';
import type { Destination } from './AppNavigation.tsx';
import { RhythmDetailsDialog } from './RhythmDetailsDialog.tsx';
import {
  selectTodayPlanGroups,
  todayFocusContext,
  todayFocusLabel
} from '../domain/today-plan.ts';
import type { TodayFocusId, TodayItemType } from '../domain/today-plan.ts';
import { TodayWeather } from './TodayWeather.tsx';
import type { TodayWeatherController } from './useTodayWeather.ts';
import { useTimeBlockSettings } from './TimeBlocksContext.tsx';
import { TendedRhythmList } from './TendedRhythmList.tsx';
import { selectTendedRhythmDisplayIds } from '../domain/category-rhythms.ts';
import { formatScore } from '../domain/score-display.ts';
import { aggregateCategoryHealthScores } from '../domain/category-scoring.ts';
import { StyledSelect } from './StyledSelect.tsx';
import type { StyledSelectOption } from './StyledSelect.tsx';

const planTypes: { id: TodayItemType; label: string }[] = [
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'anytime', label: 'Anytime' },
  { id: 'all-day', label: 'All-day' }
];

type TodayViewProps = {
  people?: readonly PersonPreview[];
  greeting: string;
  evaluationInstant: Date;
  localDate: string;
  focus: TodayFocusId;
  onFocusChange: (focus: TodayFocusId) => void;
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
  search: string;
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
  focus,
  onFocusChange,
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
  search,
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
  const restoreTimePickerFocus = useRef(false);
  const tendedRhythmIds = savedTendedRhythmIds
    ?? selectTendedRhythmDisplayIds(completedRhythms, satisfiedRhythmIds);
  const [planType, setPlanType] = useState<TodayItemType>('scheduled');
  const timeBlocks = useTimeBlockSettings();
  const visibleRhythms = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? rhythms.filter(item => item.title.toLocaleLowerCase().includes(query)) : rhythms;
  }, [rhythms, search]);
  const planGroups = useMemo(
    () => selectTodayPlanGroups(visibleRhythms, planType, focus, evaluationInstant, timeBlocks),
    [visibleRhythms, planType, focus, evaluationInstant, timeBlocks]
  );
  const planRhythms = planGroups.flatMap(group => group.rhythms);
  const currentLabel = todayFocusLabel(focus, evaluationInstant, timeBlocks);
  const emptyPlanLabel = planType === 'scheduled'
    ? focus === 'everything-today' ? 'today' : `in ${currentLabel}`
    : `in ${planType === 'anytime' ? 'Anytime' : 'All-day'}`;
  const selectedTimeRange = planType === 'scheduled' && focus !== 'everything-today'
    ? todayFocusContext(focus, 'scheduled', evaluationInstant, timeBlocks)
    : undefined;
  useLayoutEffect(() => {
    if (!restoreTimePickerFocus.current) return;
    restoreTimePickerFocus.current = false;
    document.getElementById('today-plan-time-select')?.focus();
  }, [focus]);
  function handleTimeFrameChange(nextFocus: TodayFocusId) {
    restoreTimePickerFocus.current = true;
    onFocusChange(nextFocus);
  }
  const weatherTime = focus === 'now'
    ? null
    : focus === 'everything-today'
      ? undefined
      : timeBlocks.blocks.find(block => block.id === focus)?.start;
  const scheduledItemCount = (timeFrame: TodayFocusId) =>
    selectTodayPlanGroups(visibleRhythms, 'scheduled', timeFrame, evaluationInstant, timeBlocks)
      .reduce((count, group) => count + group.rhythms.length, 0);
  const itemCountLabel = (timeFrame: TodayFocusId) => {
    const count = scheduledItemCount(timeFrame);
    return `${count} ${count === 1 ? 'item' : 'items'}`;
  };
  const timeFrameOptions: readonly StyledSelectOption<TodayFocusId>[] = [
    {
      value: 'now',
      label: 'Now',
      description: `${todayFocusContext('now', 'scheduled', evaluationInstant, timeBlocks)} · ${itemCountLabel('now')}`,
      group: 'View'
    },
    {
      value: 'everything-today',
      label: 'Everything today',
      description: `Across every time block · ${itemCountLabel('everything-today')}`,
      group: 'View'
    },
    ...timeBlocks.blocks.map(block => ({
      value: block.id,
      label: block.name,
      description: `${todayFocusContext(block.id, 'scheduled', evaluationInstant, timeBlocks)} · ${itemCountLabel(block.id)}`,
      group: 'Specific time'
    }))
  ];
  const timeFramePicker = (
    <StyledSelect
      id="today-plan-time-select"
      label="Filter scheduled Rhythms by time"
      triggerAriaLabel={`Filter scheduled Rhythms by time, currently ${currentLabel}`}
      containerClassName="today-plan__focus-picker"
      triggerClassName="today-plan__focus-trigger"
      sizeTriggerToOptions
      popoverMinWidth={320}
      options={timeFrameOptions}
      value={focus}
      onChange={handleTimeFrameChange}
    />
  );
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
    setPlanType(planTypes[nextIndex]!.id);
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
        <p className="overall-health-coverage">
          {overallHealth.scoredCategoryCount} of {overallHealth.categoryCount} categories scored.
        </p>
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
          keepToggleWhenEmpty={visibleRhythms.length > 0}
          renderControls={false}
          onUndo={onUndo}
          resetKey={`${planType}:${focus}:${search}:${planRhythms.length}`}
          initializing={initializing}
        >
          {({ visibleRhythmIds, tendedRhythmIds: displayedTendedIds, controls, itemProps }) => {
              const visiblePlanGroups = planGroups.flatMap(group => {
                const rhythms = group.rhythms.filter(rhythm => visibleRhythmIds.has(rhythm.id));
                return rhythms.length ? [{ ...group, rhythms }] : [];
              });
              const everythingToday = planType === 'scheduled' && focus === 'everything-today';
              const weather = planType === 'scheduled'
                && weatherController.city
                && weatherController.weather.status === 'ready'
                && weatherTime !== undefined && (
                  <TodayWeather
                    report={weatherController.weather.report}
                    localDate={localDate}
                    time={weatherTime ?? null}
                    containerClassName="today-plan__weather"
                  />
                );
              return (
                <>
                  <div className="today-plan__title-row">
                    <h3 className="today-plan__heading">Today</h3>
                    <div className="today-plan__title-progress">{controls}</div>
                  </div>
                  <div className="today-plan__controls">
                    <div className="faith-practice-tabs home-plan-type-tabs" role="tablist" aria-label="Plan items">
                      {planTypes.map((type, index) => (
                        <button
                          key={type.id}
                          type="button"
                          role="tab"
                          id={`plan-tab-${type.id}`}
                          aria-controls="today-plan-items"
                          aria-selected={planType === type.id}
                          tabIndex={planType === type.id ? 0 : -1}
                          onClick={() => setPlanType(type.id)}
                          onKeyDown={event => handlePlanTabKeyDown(event, index)}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="today-plan__results">
                    <div
                      className="current-plan-items"
                      id="today-plan-items"
                      role="tabpanel"
                      aria-labelledby={`plan-tab-${planType}`}
                    >
                {!everythingToday && (
                  <div className="today-plan__view-heading-row">
                    <div className="today-plan__left-column">
                      <div className="today-plan__heading-range-row">
                        <h4 className="today-plan__view-heading">
                          {planType === 'scheduled' ? currentLabel : planType === 'anytime' ? 'Anytime' : 'All-day'}
                        </h4>
                        {selectedTimeRange && (
                          <span className="today-plan__time-range">{selectedTimeRange}</span>
                        )}
                      </div>
                    </div>
                    <div className="today-plan__header-actions">
                      {weather}
                      {planType === 'scheduled' && timeFramePicker}
                    </div>
                  </div>
                )}
                {everythingToday && !visiblePlanGroups.length && (
                  <div className="today-plan__view-heading-row today-plan__view-heading-row--picker-only">
                    <div className="today-plan__header-actions">{timeFramePicker}</div>
                  </div>
                )}
                {visiblePlanGroups.length ? (
                  <>
                    {visiblePlanGroups.map((group, index) => {
                      const groupTimeBlock = planType === 'scheduled'
                        ? timeBlocks.blocks.find(block => block.id === group.id)
                        : undefined;
                      const groupTimeRange = groupTimeBlock
                        ? todayFocusContext(groupTimeBlock.id, 'scheduled', evaluationInstant, timeBlocks)
                        : undefined;
                      return (
                        <div
                          className="current-plan-item-group"
                          key={group.id}
                          aria-label={group.title || `${planType === 'scheduled' ? currentLabel : planType} Rhythms`}
                        >
                          {group.title && (
                            <div className={`current-plan-item-group-heading-row${
                              everythingToday && index === 0 ? ' current-plan-item-group-heading-row--with-picker' : ''
                            }`}>
                              <div className="today-plan__heading-range-row">
                                <h4 className="current-plan-item-group-title">{group.title}</h4>
                                {groupTimeRange && (
                                  <span className="today-plan__time-range">{groupTimeRange}</span>
                                )}
                              </div>
                              {everythingToday && index === 0 && (
                                <div className="today-plan__header-actions">{timeFramePicker}</div>
                              )}
                            </div>
                          )}
                          {group.rhythms.map(rhythm => (
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
                          ))}
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <>
                    {planRhythms.length > 0 ? (
                      <div className="dashed-empty-state" role="status">
                        <p>You’ve tended everything here.</p>
                      </div>
                    ) : (
                      <div className="today-plan__empty-rhythms" role="status">
                        <p>No active Rhythms {emptyPlanLabel}.</p>
                      </div>
                    )}
                  </>
                )}
                  </div>
                </div>
                </>
              );
            }}
        </TendedRhythmList>
      </section>

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
