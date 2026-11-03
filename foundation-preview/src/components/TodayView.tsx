import { useMemo, useRef, useState } from 'react';
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
  const tendedRhythmIds = savedTendedRhythmIds
    ?? selectTendedRhythmDisplayIds(completedRhythms, satisfiedRhythmIds);
  const [planType, setPlanType] = useState<TodayItemType>('scheduled');
  const timeBlocks = useTimeBlockSettings();
  const focusPickerRef = useRef<HTMLDetailsElement>(null);
  const focusTriggerRef = useRef<HTMLElement>(null);
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
          <h3>Overall health</h3><span className="ov-score" aria-hidden="true">—</span>
        </div>
        <ScoreMeter
          label="Overall health: Not enough data"
          score={null}
          markerPlacement="below"
        />
        <p className="overall-health-unavailable">Overall Health is unavailable until an approved aggregate is defined.</p>
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
                <CategoryHealthBadge score={score} />
              </button>
            );
          })}
        </div>
      </section>

      <section aria-label="Today's plan">
        <div className="card planblock current today-plan">
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
          {planType === 'scheduled' ? (
            <>
              <div className="today-plan__scheduled-controls">
                <details className="today-plan__focus-picker" ref={focusPickerRef}>
                  <summary
                    ref={focusTriggerRef}
                    className="today-plan__focus-trigger"
                    aria-label={`Choose a time frame, currently ${currentLabel}`}
                  >
                    <span>{currentLabel}</span>
                    <span className="today-plan__chevron" aria-hidden="true">⌄</span>
                  </summary>
                  <div className="today-plan__focus-options" role="group" aria-label="Time frames">
                    <div className="today-plan__focus-options-section">
                      <span>View</span>
                      {([
                        ['now', 'Now', `${todayFocusContext('now', 'scheduled', evaluationInstant, timeBlocks)} · ${itemCountLabel('now')}`],
                        ['everything-today', 'Everything today', `Across every time block · ${itemCountLabel('everything-today')}`]
                      ] as const).map(([id, label, range]) => (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={focus === id}
                          onClick={() => {
                            onFocusChange(id);
                            if (focusPickerRef.current) focusPickerRef.current.open = false;
                            focusTriggerRef.current?.focus();
                          }}
                        >
                          <span>{label}</span><small>{range}</small>
                        </button>
                      ))}
                    </div>
                    <div className="today-plan__focus-options-section">
                      <span>Specific time</span>
                      {timeBlocks.blocks.map(block => (
                        <button
                          key={block.id}
                          type="button"
                          aria-pressed={focus === block.id}
                          onClick={() => {
                            onFocusChange(block.id);
                            if (focusPickerRef.current) focusPickerRef.current.open = false;
                            focusTriggerRef.current?.focus();
                          }}
                        >
                          <span>{block.name}</span>
                          <small>{todayFocusContext(block.id, 'scheduled', evaluationInstant, timeBlocks)} · {itemCountLabel(block.id)}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                </details>
                {weatherController.city
                  && weatherController.weather.status === 'ready'
                  && focus !== 'everything-today'
                  && weatherTime !== undefined && (
                    <TodayWeather
                      report={weatherController.weather.report}
                      localDate={localDate}
                      time={weatherTime ?? null}
                      containerClassName="today-plan__weather"
                    />
                  )}
              </div>
            </>
          ) : null}
          <TendedRhythmList
            rhythms={planRhythms}
            tendedRhythmIds={tendedRhythmIds}
            satisfiedRhythmIds={satisfiedRhythmIds}
            undoableRhythmIds={undoableRhythms}
            showTended={showTended}
            onShowTendedChange={onShowTendedChange}
            showProgress
            onUndo={onUndo}
            resetKey={`${planType}:${focus}:${search}`}
            initializing={initializing}
          >
            {({ visibleRhythmIds, tendedRhythmIds: displayedTendedIds, itemProps }) => {
              const visiblePlanGroups = planGroups.flatMap(group => {
                const rhythms = group.rhythms.filter(rhythm => visibleRhythmIds.has(rhythm.id));
                return rhythms.length ? [{ ...group, rhythms }] : [];
              });
              return (
                <div className="current-plan-items" id="today-plan-items" role="tabpanel" aria-labelledby={`plan-tab-${planType}`}>
                  {visiblePlanGroups.length ? (
                    visiblePlanGroups.map(group => (
                      <div className="current-plan-item-group" key={group.id} aria-label={group.title || `${planType === 'scheduled' ? currentLabel : planType} Rhythms`}>
                        {group.title && <h3 className="current-plan-item-group-title">{group.title}</h3>}
                        {group.rhythms.map(rhythm => (
                          <div key={rhythm.id} {...itemProps(rhythm.id)}>
                            <RhythmDetailsDialog
                              rhythm={rhythm}
                              inline
                              headingId={`today-rhythm-${rhythm.id}-title`}
                              people={peopleForRhythm(rhythm, people)}
                              foundations={foundations}
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
                    ))
                  ) : planRhythms.length > 0 ? (
                    <div className="dashed-empty-state" role="status">
                      <p>You’ve tended everything here.</p>
                    </div>
                  ) : (
                    <div className="dashed-empty-state" role="status">
                      <p>{planType === 'anytime'
                        ? 'No eligible Anytime rhythms.'
                        : planType === 'all-day'
                          ? 'No eligible All-day rhythms.'
                          : `No active Rhythms in ${focus === 'everything-today' ? 'today’s plan' : currentLabel}.`}</p>
                    </div>
                  )}
                </div>
              );
            }}
          </TendedRhythmList>
        </div>
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
