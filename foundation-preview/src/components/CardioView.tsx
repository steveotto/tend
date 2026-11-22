import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, MouseEvent } from 'react';
import {
  cardioDataIssues,
  cardioActivityType,
  cardioCalorieEstimateFromWeighIn,
  cardioEstimateWeightSetting,
  cardioDistanceFromMiles,
  cardioDistanceToMiles,
  estimateCardioCalories,
  formatCardioActivityDistance,
  formatCardioActivitySummary,
  formatCardioPace,
  cardioGoalSettings,
  cardioPaceSecondsPerUnit,
  cardioRhythmOccurrenceError,
  formatCardioWeekRange,
  formatCardioWeekdayRange,
  latestCardioWeightOnOrBefore,
  addDateDays,
  cardioTargetsForDate,
  cardioWeekStart,
  deleteCardioActivity,
  isCardioRun,
  parseCardioGoalInput,
  parseCardioRunDuration,
  saveCardioGoals,
  saveCardioEstimateWeight,
  saveCardioActivity,
  selectCardioActivityComparisons,
  selectCardioProgress,
  selectCardioActivityTotals,
  stepCardioGoalInput,
  validatedCardioActivities,
  validateCardioGoals
} from '../domain/cardio.ts';
import type {
  CardioActivity,
  CardioActivityType,
  CardioCalorieEstimate,
  CardioData,
  CardioDistanceUnit
} from '../domain/cardio.ts';
import {
  createWeightData,
  formatWeight,
  formatWeightInput,
  parseWeightInput,
  weightUnit,
  weightValueInUnit
} from '../domain/weight.ts';
import type { WeightData, WeightUnit } from '../domain/weight.ts';
import type { RhythmPreview } from '../domain/preview-data.ts';
import {
  foundationCatalogue,
  syntheticPeople
} from '../domain/preview-data.ts';
import type {
  FoundationPreview,
  PersonId,
  PersonPreview
} from '../domain/preview-data.ts';
import type { DatedRhythmCompletion } from '../domain/rhythm-completion.ts';
import type { RhythmScoreResult } from '../domain/rhythm-scoring.ts';
import {
  foundationRhythmIds,
  type FoundationRhythmAssociationChange
} from '../domain/foundation-rhythm-associations.ts';
import type { Destination } from './AppNavigation.tsx';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { NumericControl } from './NumericControl.tsx';
import { FitnessScoreSummary } from './FitnessScoreSummary.tsx';
import { cardioHealthStatusMessage } from './health-summary-copy.ts';
import { SettingsGearButton } from './SettingsGearButton.tsx';
import { ToolZone, ToolZoneTrendingUpIcon } from './ToolZone.tsx';
import { FoundationSectionHeading } from './FoundationSectionHeading.tsx';
import { FoundationRhythmGroup } from './FoundationRhythmGroup.tsx';
import { FoundationRhythmAssociationDialog } from './FoundationRhythmAssociationDialog.tsx';
import { SegmentedTabs } from './SegmentedTabs.tsx';
import type { SegmentedTab } from './SegmentedTabs.tsx';
import { CardioActivityDetailsDialog } from './CardioActivityDetailsDialog.tsx';
import { CardioActivitySummary } from './CardioActivitySummary.tsx';
import { CardioActivityPerformance } from './CardioActivityPerformance.tsx';
import type { CardioSummaryMetric } from './CardioActivitySummary.tsx';
import {
  CardioActivityTypeIcon,
  CardioFlameIcon,
  CardioRunnerIcon,
  CardioStopwatchIcon,
} from './CardioActivitySummary.tsx';
import { CardioWeekCalendar } from './CardioWeekCalendar.tsx';

export type CardioViewProps = {
  data: CardioData;
  today: string;
  rhythms: readonly RhythmPreview[];
  archivedRhythmIds: ReadonlySet<string>;
  datedRhythmCompletions: readonly DatedRhythmCompletion[];
  onChange: (data: CardioData) => string | null;
  pendingLogRequest?: { requestId: number; opener: HTMLButtonElement; rhythm?: RhythmPreview } | null;
  onLogRequestOpened?: (requestId: number) => void;
  onLogRequestClosed?: () => void;
  onQuickLog?: (event: MouseEvent<HTMLButtonElement>) => void;
  foundationNavigation?: boolean;
  foundationActive?: boolean;
  people?: readonly PersonPreview[];
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
  overallHealthScore?: number | null;
  categoryHealthScore?: number | null;
  weightData?: WeightData;
};

type DialogState = { kind: 'goals' }
  | { kind: 'activity'; activity?: CardioActivity; rhythm?: RhythmPreview }
  | { kind: 'details'; activity: CardioActivity };
type CardioTab = 'progress' | 'activities' | 'rhythms';

const cardioTabs = [
  { id: 'progress', label: 'Insights', tabId: 'cardio-tab-progress', panelId: 'cardio-panel-progress' },
  { id: 'activities', label: 'Activities', tabId: 'cardio-tab-activities', panelId: 'cardio-panel-activities' },
  { id: 'rhythms', label: 'Rhythms', tabId: 'cardio-tab-rhythms', panelId: 'cardio-panel-rhythms' }
] as const satisfies readonly SegmentedTab<CardioTab>[];

export function CardioView({
  data,
  today,
  rhythms,
  archivedRhythmIds,
  datedRhythmCompletions,
  onChange,
  pendingLogRequest = null,
  onLogRequestOpened,
  onLogRequestClosed,
  foundationNavigation = false,
  foundationActive = false,
  people = syntheticPeople,
  archivedRhythms = [],
  foundations = foundationCatalogue,
  rhythmScores = new Map(),
  completedRhythms = new Set(),
  undoableRhythms = new Set(),
  onAddLinkedRhythm,
  onSaveFoundationAssociations,
  onRhythmHistory,
  onEditRhythm,
  onTend,
  onUndo,
  onPersonSelect,
  onOpenFoundation,
  onOpenCategory,
  overallHealthScore = null,
  categoryHealthScore = null,
  weightData = createWeightData()
}: CardioViewProps) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [actionError, setActionError] = useState('');
  const [selectedTab, setSelectedTab] = useState<CardioTab>('progress');
  const [associationDialogOpen, setAssociationDialogOpen] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const addActivityFallbackRef = useRef<HTMLButtonElement | null>(null);
  const activityRowRefs = useRef(new Map<string, HTMLButtonElement>());
  const restoreActivityIdRef = useRef<string | null>(null);
  const handledLogRequestRef = useRef<number | null>(null);
  const activeLogRequestRef = useRef<number | null>(null);
  const wasFoundationActiveRef = useRef(false);
  const progress = selectCardioProgress(data, today);
  const activities = validatedCardioActivities(data, today).records;
  const sortedActivities = [...activities]
    .sort((left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id));
  const latestActivity = sortedActivities[0] ?? null;
  const historyActivities = sortedActivities.slice(1);
  const weeklyActivities = activities.filter(activity =>
    activity.date >= progress.weekStart && activity.date <= today
  );
  const weeklyTotals = selectCardioActivityTotals(weeklyActivities, weightData, today);
  const allActivityTotals = selectCardioActivityTotals(activities, weightData, today);
  const weeklySummaryMetrics: readonly CardioSummaryMetric[] = [
    {
      key: 'distance',
      icon: <CardioRunnerIcon />,
      label: 'Distance',
      value: `${formatNumber(weeklyTotals.distanceMiles)} mi`,
      note: ''
    },
    {
      key: 'time',
      icon: <CardioStopwatchIcon />,
      label: 'Total time',
      value: weeklyTotals.durationSeconds === null
        ? '—'
        : formatTotalDuration(weeklyTotals.durationSeconds),
      note: coverageNote(weeklyTotals.durationActivityCount, weeklyTotals.activityCount, 'this week')
    },
    {
      key: 'calories',
      icon: <CardioFlameIcon />,
      label: 'Calories',
      value: weeklyTotals.estimatedCalories === null
        ? '—'
        : formatNumber(weeklyTotals.estimatedCalories),
      unit: weeklyTotals.estimatedCalories === null ? undefined : 'kcal',
      note: calorieCoverageNote(weeklyTotals, 'this week')
    }
  ];
  const allActivitySummaryMetrics: readonly CardioSummaryMetric[] = [
    {
      key: 'activities',
      icon: null,
      label: 'Activities',
      value: String(allActivityTotals.activityCount),
      note: ''
    },
    {
      key: 'distance',
      icon: <CardioRunnerIcon />,
      label: 'Total distance',
      value: formatNumber(allActivityTotals.distanceMiles),
      unit: 'mi',
      note: ''
    },
    {
      key: 'calories',
      icon: <CardioFlameIcon />,
      label: 'Calories',
      value: allActivityTotals.estimatedCalories === null
        ? '—'
        : formatNumber(allActivityTotals.estimatedCalories),
      unit: allActivityTotals.estimatedCalories === null ? undefined : 'kcal',
      note: ''
    }
  ];
  const activeCardioRhythms = rhythms.filter(rhythm => foundationRhythmIds(rhythm).includes('health-cardio'));
  const archivedCardioRhythms = archivedRhythms.filter(rhythm => foundationRhythmIds(rhythm).includes('health-cardio'));
  const cardioFoundation = foundations.find(foundation => foundation.id === 'health-cardio');
  const trackingSetupRequired = !data.trackingStartDate
    || !data.targetHistory?.length
    || progress.targetRuns === null
    || progress.targetMiles === null;
  const issues = [
    ...cardioDataIssues(data, today),
    ...cardioLinkIssues(data, rhythms, archivedRhythmIds, datedRhythmCompletions)
  ];
  const healthSummary = (
    <FitnessScoreSummary
      category="Cardio"
      healthTitle="Cardio Health"
      {...(foundationNavigation ? { cardTitle: 'Health' } : {})}
      className={`rhythm-history-view__score-card${foundationNavigation ? ' foundation-health-card' : ''}`}
      consistency={progress.consistency}
      onTrack={progress.score}
      health={progress.health}
      showMeasures={!foundationNavigation}
      overallHealthScore={overallHealthScore}
      categoryHealthScore={categoryHealthScore}
      linkedRhythmCount={0}
      setupRequired={trackingSetupRequired}
      showSetupAction={false}
      statusMessage={cardioHealthStatusMessage({
        hasTrackingStartDate: Boolean(data.trackingStartDate),
        hasWeeklyGoals: Boolean(data.targetHistory?.length)
          && progress.targetRuns !== null
          && progress.targetMiles !== null,
        hasCompletedWeek: progress.consistency !== null
      })}
      onSetup={event => openDialog({ kind: 'goals' }, event)}
      summaryExplanation="Your Cardio Health comes from logged runs and weekly goals. Tending a Rhythm alone doesn’t count as a run."
      scoringExplanation={(
        <>
          <p>
            Current week ({progress.weekStart}–{progress.weekEnd}): {progress.runs} of
            {' '}{progress.targetRuns ?? '—'} runs and {formatNumber(progress.miles)} of
            {' '}{progress.targetMiles === null ? '—' : formatNumber(progress.targetMiles)} miles.
          </p>
          <p>{progress.eligibleConsistencyWeeks} completed weeks have eligible goals for Consistency.</p>
          {progress.consistencyUnavailableReason && (
            <p>
              {progress.consistencyUnavailableReason.includes('tracking start')
                ? 'Set a tracking start date and save weekly goals to begin.'
                : 'No completed week in the four-week lookback has full tracking and trustworthy goals yet.'}
            </p>
          )}
          <p>
            Only complete Monday–Sunday weeks with known targets count. Goal changes
            start the following Monday; first-time setup applies to this week’s progress,
            but its partial week is excluded from Consistency. Unavailable recent weeks
            are not replaced with older weeks.
          </p>
        </>
      )}
    />
  );

  useEffect(() => {
    if (dialog) return;
    const opener = openerRef.current;
    if (opener?.isConnected && !opener.closest('[hidden]')) opener.focus({ preventScroll: true });
    else {
      const activityRow = restoreActivityIdRef.current
        ? activityRowRefs.current.get(restoreActivityIdRef.current)
        : null;
      if (activityRow?.isConnected && !activityRow.closest('[hidden]')) {
        activityRow.focus({ preventScroll: true });
      } else addActivityFallbackRef.current?.focus({ preventScroll: true });
    }
  }, [dialog]);

  useEffect(() => {
    if (!foundationNavigation) {
      wasFoundationActiveRef.current = false;
      return;
    }
    if (foundationActive && !wasFoundationActiveRef.current) setSelectedTab('progress');
    wasFoundationActiveRef.current = foundationActive;
  }, [foundationActive, foundationNavigation]);

  useEffect(() => {
    if (!pendingLogRequest || handledLogRequestRef.current === pendingLogRequest.requestId) return;
    handledLogRequestRef.current = pendingLogRequest.requestId;
    activeLogRequestRef.current = pendingLogRequest.requestId;
    openerRef.current = pendingLogRequest.opener;
    restoreActivityIdRef.current = null;
    setSelectedTab('activities');
    setDialog({ kind: 'activity', ...(pendingLogRequest.rhythm ? { rhythm: pendingLogRequest.rhythm } : {}) });
    onLogRequestOpened?.(pendingLogRequest.requestId);
  }, [pendingLogRequest?.requestId]);

  function openDialog(next: DialogState, event: MouseEvent<HTMLButtonElement>) {
    openerRef.current = event.currentTarget;
    restoreActivityIdRef.current = null;
    setDialog(next);
  }

  function openActivityDetails(activity: CardioActivity, opener: HTMLButtonElement) {
    openerRef.current = opener;
    restoreActivityIdRef.current = activity.id;
    setSelectedTab('activities');
    setDialog({ kind: 'details', activity });
  }

  function editActivityDetails(activity: CardioActivity) {
    setDialog({ kind: 'activity', activity });
  }

  function registerActivityRow(activityId: string, button: HTMLButtonElement | null) {
    if (button) activityRowRefs.current.set(activityId, button);
    else activityRowRefs.current.delete(activityId);
  }

  function closeDialog() {
    setDialog(null);
    if (activeLogRequestRef.current !== null) {
      activeLogRequestRef.current = null;
      onLogRequestClosed?.();
    }
  }

  function removeActivity(activity: CardioActivity): string | null {
    const result = deleteCardioActivity(data, activity.id);
    if (!result.deleted) return 'This activity is no longer available to delete.';
    const error = onChange(result.data);
    if (error) {
      setActionError(error);
      return error;
    }
    setActionError('');
    return null;
  }

  return (
    <section
      className="category-page cardio-page"
      {...(!foundationNavigation && { 'aria-labelledby': 'cardio-title' })}
    >
      {!foundationNavigation && (
        <header className="category-page-heading">
          <div>
            <h1 id="cardio-title">Cardio</h1>
            <p>Track runs and walks, and see how your activities build over time.</p>
          </div>
        </header>
      )}
      {healthSummary}
      {foundationNavigation && (
        <SegmentedTabs
          tabs={cardioTabs}
          selectedTabId={selectedTab}
          ariaLabel="Cardio Foundation sections"
          onChange={setSelectedTab}
        />
      )}
      <section
        className={foundationNavigation ? 'strength-section-panels' : 'cardio-progress'}
        aria-label="Cardio insights, activities, and Rhythms"
      >
        <section
          id="cardio-panel-progress"
          className={foundationNavigation
            ? 'strength-section-panel strength-workout-section'
            : 'strength-section-panel'}
          {...(foundationNavigation && {
            role: 'tabpanel' as const,
            'aria-labelledby': 'cardio-tab-progress'
          })}
          hidden={foundationNavigation && selectedTab !== 'progress'}
        >
          <ToolZone
            className="cardio-progress-tools"
            headingId="cardio-progress-tools-title"
            icon={<ToolZoneTrendingUpIcon />}
            purposeLabel="Activity insights"
            subtitle="Explore your activity and weekly progress."
            headerAction={(
              <SettingsGearButton
                label="Cardio tracking settings"
                onClick={event => openDialog({ kind: 'goals' }, event)}
              />
            )}
            scoringFootnote="Your Cardio Health comes from logged runs and weekly goals. Tending a Rhythm alone doesn’t count as a run."
          >
            <CardioActivitySummary
              title="This week"
              headingId="cardio-this-week-title"
              metrics={weeklySummaryMetrics}
              className="cardio-weekly-summary"
            />
            {trackingSetupRequired || progress.targetRuns === null || progress.targetMiles === null ? (
              <p className="cardio-empty" role="status">
                Set a tracking start date and weekly Run and distance goals in Activity insights settings.
              </p>
            ) : (
              <div className="cardio-measures" aria-label="Weekly goal progress">
                <CardioMeasure label="Weekly distance" value={progress.miles} target={progress.targetMiles}
                  percent={progress.targetMiles > 0 ? progress.miles / progress.targetMiles * 100 : 0}
                  unit="mi" />
                <CardioMeasure label="Number of runs" value={progress.runs} target={progress.targetRuns}
                  percent={progress.targetRuns > 0 ? progress.runs / progress.targetRuns * 100 : 0} />
              </div>
            )}
            <section className="card cardio-progress-card" aria-labelledby="cardio-progress-title">
              <header className="cardio-card-heading">
                <div>
                  <h2 id="cardio-progress-title">{formatCardioWeekRange(progress.weekStart, progress.weekEnd)}</h2>
                  <p>{formatCardioWeekdayRange(progress.weekStart, progress.weekEnd)}</p>
                </div>
              </header>
              <CardioWeekCalendar
                days={progress.days}
                activities={weeklyActivities}
                today={today}
                onActivityDetails={openActivityDetails}
              />
            </section>
          </ToolZone>
        </section>

        <section
          id="cardio-panel-activities"
          className={foundationNavigation
            ? 'strength-section-panel strength-workout-section'
            : 'strength-section-panel'}
          {...(foundationNavigation && {
            role: 'tabpanel' as const,
            'aria-labelledby': 'cardio-tab-activities'
          })}
          hidden={foundationNavigation && selectedTab !== 'activities'}
        >
          {foundationNavigation && (
            <FoundationSectionHeading
              title="Activities"
              headingId="cardio-activities-heading"
              subtitle="Your complete activity history."
              actions={
                <button ref={addActivityFallbackRef} type="button" className="btn mini cardio-add-activity"
                  aria-label="Add activity"
                  onClick={event => openDialog({ kind: 'activity' }, event)}>
                  <span aria-hidden="true">+</span> Activity
                </button>
              }
            />
          )}
          {!foundationNavigation && (
            <header className="category-page-heading cardio-runs-heading">
              <div>
                <h2>Activities</h2>
                <p>Your complete activity history.</p>
              </div>
              <button ref={addActivityFallbackRef} type="button" className="btn mini cardio-add-activity"
                aria-label="Add activity"
                onClick={event => openDialog({ kind: 'activity' }, event)}>
                <span aria-hidden="true">+</span> Activity
              </button>
            </header>
          )}
          <CardioActivitySummary
            title="All Activities"
            subtitle="All-time totals."
            headingId="cardio-all-activities-title"
            headingIcon={<CardioRunnerIcon />}
            metrics={allActivitySummaryMetrics}
            explanation={allActivityTotals.activityCount === 0
              ? 'No activities in saved history.'
              : allActivityTotals.estimatedCalories === null
                ? 'Estimated calories are unavailable for the saved history.'
                : allActivityTotals.estimatedRunCount < allActivityTotals.runCount
                  ? calorieCoverageNote(allActivityTotals, 'in saved history')
                  : ''}
            className="cardio-all-activities-summary"
          />
          <section className="card cardio-latest-activity-card" aria-labelledby="cardio-latest-activity-title">
            <h2 id="cardio-latest-activity-title">Latest Activity</h2>
            {latestActivity ? (
              <LatestActivityCard
                activity={latestActivity}
                activities={activities}
                weightData={weightData}
                today={today}
                buttonRef={button => registerActivityRow(latestActivity.id, button)}
                onOpen={event => openActivityDetails(latestActivity, event.currentTarget)}
              />
            ) : (
              <p className="cardio-empty">No activity has been logged yet.</p>
            )}
          </section>
          <section className="card cardio-history-card" aria-labelledby="cardio-activities-history-title">
            <header className="cardio-history-card__heading">
              <h2 id="cardio-activities-history-title">Activity History</h2>
              {historyActivities.length > 5 && !showAllHistory && (
                <button type="button" className="cardio-history-card__action"
                  onClick={() => setShowAllHistory(true)}>
                  All Activities
                </button>
              )}
            </header>
            {historyActivities.length > 0 ? (
              <ol className="cardio-history-list">
                {(showAllHistory ? historyActivities : historyActivities.slice(0, 5)).map(activity => (
                  <li key={activity.id}>
                    <ActivitySummaryButton
                      activity={activity}
                      activities={activities}
                      weightData={weightData}
                      today={today}
                      buttonRef={button => registerActivityRow(activity.id, button)}
                      onOpen={event => openActivityDetails(activity, event.currentTarget)}
                    />
                  </li>
                ))}
              </ol>
            ) : (
              <p className="cardio-empty">
                {latestActivity
                  ? 'No earlier activities yet.'
                  : 'No activities yet. Add a Run or Walk to start your history.'}
              </p>
            )}
            {actionError && <p className="goal-field-error" role="alert">{actionError}</p>}
          </section>
        </section>

        {foundationNavigation && (
          <section
            id="cardio-panel-rhythms"
            className="strength-section-panel"
            role="tabpanel"
            aria-labelledby="cardio-tab-rhythms"
            hidden={selectedTab !== 'rhythms'}
          >
            <section className="marriage-foundation-support strength-rhythms-panel" aria-labelledby="cardio-linked-rhythms-title">
              <FoundationSectionHeading
                title="Linked Rhythms"
                headingId="cardio-linked-rhythms-title"
                accessibleName={`Linked Rhythms · ${activeCardioRhythms.length}`}
                secondary={<span className="strength-linked-rhythms-count" aria-hidden="true">{activeCardioRhythms.length}</span>}
                subtitle="Your routines for building cardio."
                actions={
                  <>
                    {onSaveFoundationAssociations && (
                      <button type="button" className="btn mini ghost" aria-haspopup="dialog"
                        onClick={() => setAssociationDialogOpen(true)}>Manage links</button>
                    )}
                    {onAddLinkedRhythm && (
                      <button type="button" className="btn mini"
                        onClick={event => onAddLinkedRhythm('health-cardio', event)}>Add Rhythm</button>
                    )}
                  </>
                }
              />
              {activeCardioRhythms.length > 0 ? (
                <FoundationRhythmGroup
                  people={people}
                  rhythms={activeCardioRhythms}
                  archivedRhythmIds={archivedCardioRhythms.map(rhythm => rhythm.id)}
                  headingId="cardio-linked-rhythms-title"
                  rhythmScores={rhythmScores}
                  completedRhythms={completedRhythms}
                  undoableRhythms={undoableRhythms}
                  foundations={foundations}
                  categoryToken="cardio"
                  {...(onTend ? { onTend } : {})}
                  {...(onUndo ? { onUndo } : {})}
                  {...(onEditRhythm ? { onEditRhythm } : {})}
                  {...(onRhythmHistory ? { onRhythmHistory } : {})}
                  {...(onPersonSelect ? { onPersonSelect } : {})}
                  {...(onOpenFoundation ? { onOpenFoundation } : {})}
                  {...(onOpenCategory ? { onOpenCategory } : {})}
                  completionActionLabelFor={() => 'Log'}
                  completionActionAccessibleLabelFor={rhythm =>
                    rhythm.healthLogCapability === 'weight' ? 'Log weigh-in'
                      : rhythm.healthLogCapability === 'flexibility' ? 'Start stretch routine' : 'Log run'}
                  completedActionLabelFor={rhythm =>
                    rhythm.healthLogCapability === 'weight' ? 'Weighed in'
                      : rhythm.healthLogCapability === 'flexibility' ? 'Stretched' : 'Logged'}
                />
              ) : (
                <div className="strength-rhythms-empty">
                  <p>No Rhythms are linked to Cardio yet.</p>
                </div>
              )}
            </section>
          </section>
        )}
      </section>
      {associationDialogOpen && cardioFoundation && onSaveFoundationAssociations && (
        <FoundationRhythmAssociationDialog
          key={cardioFoundation.id}
          foundation={cardioFoundation}
          rhythms={[
            ...rhythms.map(rhythm => ({ rhythm, archived: false })),
            ...archivedRhythms.map(rhythm => ({ rhythm, archived: true }))
          ]}
          onSave={changes => onSaveFoundationAssociations(cardioFoundation.id, changes)}
          onClose={() => setAssociationDialogOpen(false)}
        />
      )}
      {dialog?.kind === 'goals' && (
        <CardioGoalsDialog data={data} today={today} weightData={weightData}
          onSave={onChange} onClose={closeDialog} />
      )}
      {dialog?.kind === 'details' && (
        <CardioActivityDetailsDialog
          activity={dialog.activity}
          activities={activities}
          weightData={weightData}
          today={today}
          rhythms={rhythms}
          archivedRhythms={archivedRhythms}
          onEdit={() => editActivityDetails(dialog.activity)}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === 'activity' && (
        <CardioActivityDialog
          key={dialog.activity?.id ?? dialog.rhythm?.id ?? 'new-activity'}
          data={data}
          today={today}
          rhythms={rhythms}
          archivedRhythmIds={archivedRhythmIds}
          weightData={weightData}
          {...(dialog.activity ? { activity: dialog.activity } : {})}
          {...(dialog.rhythm ? { initialRhythm: dialog.rhythm } : {})}
          onSave={onChange}
          onClose={closeDialog}
          onDelete={removeActivity}
        />
      )}
      {issues.length > 0 && (
        <section className="cardio-data-issues" role="status" aria-label="Cardio data quality">
          <h2>Some Cardio data needs review</h2>
          <ul>{issues.map((issue, index) => <li key={`${issue}-${index}`}>{issue}</li>)}</ul>
        </section>
      )}
    </section>
  );
}

function CardioMeasure({ label, value, target, percent, unit }: {
  label: string;
  value: number;
  target: number;
  percent: number;
  unit?: 'mi';
}) {
  const safePercent = Number.isFinite(percent) ? percent : 0;
  const width = Math.max(0, Math.min(100, safePercent));
  const displayedPercent = Math.max(0, Math.round(safePercent + 0.0000001));
  const valueText = formatNumber(value);
  const targetText = formatNumber(target);
  const remainingText = value > target
    ? `${formatNumber(value - target)}${unit ? ` ${unit}` : ''} above goal`
    : value === target
      ? 'Goal reached'
      : `${formatNumber(Math.max(0, target - value))}${unit ? ` ${unit}` : ''} remaining`;
  return (
    <div className="cardio-measure">
      <div
        className="cardio-measure__ring"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={width}
        aria-valuetext={`${displayedPercent}% of weekly goal`}
        style={{ '--cardio-gauge-progress': `${width * 3.6}deg` } as CSSProperties}
      >
        <span aria-hidden="true">{displayedPercent}%</span>
      </div>
      <div className="cardio-measure__copy">
        <div className="cardio-measure__heading">
          <div className="cardio-measure__title">
            <strong>{label}</strong>
            <span className="cardio-measure__badge">This week</span>
          </div>
          <span className="cardio-measure__values">
            {valueText}{unit ? ` ${unit}` : ''}{' '}
            <small>/ {targetText}{unit ? ` ${unit}` : ''}</small>
          </span>
        </div>
        <div className="cardio-measure__progress" aria-hidden="true">
          <span style={{ width: `${width}%` }} />
        </div>
        <small className="cardio-measure__remaining">{remainingText}</small>
      </div>
    </div>
  );
}

function ActivitySummaryButton({
  activity,
  activities,
  weightData,
  today,
  latest = false,
  buttonRef,
  onOpen
}: {
  activity: CardioActivity;
  activities: readonly CardioActivity[];
  weightData: WeightData;
  today: string;
  latest?: boolean;
  buttonRef: (button: HTMLButtonElement | null) => void;
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const activityName = cardioActivityType(activity);
  const unit = activity.distanceUnit ?? 'mi';
  const pace = cardioPaceSecondsPerUnit(
    activity.durationSeconds,
    cardioDistanceFromMiles(activity.distance, unit)
  );
  const durationText = activity.durationSeconds ? formatTotalDuration(activity.durationSeconds) : null;
  const paceText = pace === null ? null : formatCardioPace(pace, unit);
  const comparison = selectCardioActivityComparisons(activities, activity, weightData, today);
  const paceComparison = formatHistoryPaceComparison(comparison.paceImprovementSeconds, unit);
  const accessibleDetails = [
    `Open ${latest ? 'latest ' : ''}${activityName} details for ${formatCardioActivityDistance(activity)}`,
    `on ${formatLongDate(activity.date)}`,
    ...(durationText ? [`duration ${durationText}`] : []),
    ...(paceText ? [`pace ${paceText}`] : []),
    ...(paceComparison ? [paceComparison.accessibleText] : [])
  ].join(', ');

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`cardio-activity-row${latest ? ' cardio-activity-row--latest' : ''}`}
      aria-label={accessibleDetails}
      onClick={onOpen}
    >
      <span className="cardio-activity-row__type-icon" aria-hidden="true">
        <CardioActivityTypeIcon type={activityName} />
      </span>
      <span className="cardio-activity-row__main">
        <strong>{formatCardioActivitySummary(activity)}</strong>
        <span className="cardio-activity-row__metadata">
          <time dateTime={activity.date}>{formatLongDate(activity.date)}</time>
          {(durationText || paceText) && (
            <span className="cardio-activity-row__metadata-secondary">
              {durationText && <span>{durationText}</span>}
              {durationText && paceText && <span className="cardio-activity-row__metadata-separator" aria-hidden="true">·</span>}
              {paceText && <span>{paceText}</span>}
            </span>
          )}
        </span>
      </span>
      {paceComparison && (
        <span className={`cardio-activity-row__pace-cardio-chip cardio-activity-row__pace-cardio-chip--${paceComparison.tone}`}
          aria-hidden="true">
          {paceComparison.text}
        </span>
      )}
      <svg className="cardio-activity-row__chevron" viewBox="0 0 24 24"
        aria-hidden="true" focusable="false">
        <path d="m9 5 7 7-7 7" />
      </svg>
    </button>
  );
}

function LatestActivityCard({
  activity,
  activities,
  weightData,
  today,
  buttonRef,
  onOpen
}: {
  activity: CardioActivity;
  activities: readonly CardioActivity[];
  weightData: WeightData;
  today: string;
  buttonRef: (button: HTMLButtonElement | null) => void;
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const activityType = cardioActivityType(activity);
  const activityName = activityType === 'run' ? 'run' : 'walk';

  return (
    <div className="cardio-latest-activity">
      <button
        ref={buttonRef}
        type="button"
        className="cardio-latest-activity__header"
        aria-label={`Open latest ${activityName} details for ${formatCardioActivityDistance(activity)} on ${formatLongDate(activity.date)}`}
        onClick={onOpen}
      >
        <span className="cardio-latest-activity__type-icon" aria-hidden="true">
          <CardioActivityTypeIcon type={activityType} />
        </span>
        <span className="cardio-latest-activity__copy">
          <strong>{formatCardioActivityDistance(activity)}</strong>
          <span>
            <time dateTime={activity.date}>{formatLongDate(activity.date)}</time>
          </span>
        </span>
        <svg className="cardio-latest-activity__chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="m9 5 7 7-7 7" />
        </svg>
      </button>
      <CardioActivityPerformance
        activity={activity}
        activities={activities}
        weightData={weightData}
        today={today}
      />
    </div>
  );
}

function formatHistoryPaceComparison(
  improvementSeconds: number | null,
  unit: CardioDistanceUnit
): { text: string; accessibleText: string; tone: 'faster' | 'slower' | 'same' } | null {
  if (improvementSeconds === null) return null;
  if (improvementSeconds === 0) {
    return {
      text: '↔ Pace unchanged',
      accessibleText: 'Pace unchanged compared with the previous comparable run',
      tone: 'same'
    };
  }
  const totalSeconds = Math.abs(improvementSeconds);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const compactDelta = `${minutes}:${String(seconds).padStart(2, '0')}/${unit}`;
  const unitName = unit === 'mi' ? 'mile' : 'km';
  if (improvementSeconds > 0) {
    return {
      text: `▼ −${compactDelta}`,
      accessibleText: `${totalSeconds} seconds per ${unitName} faster than the previous comparable run`,
      tone: 'faster'
    };
  }
  return {
    text: `▲ +${compactDelta}`,
    accessibleText: `${totalSeconds} seconds per ${unitName} slower than the previous comparable run`,
    tone: 'slower'
  };
}

function coverageNote(
  availableCount: number,
  activityCount: number,
  context: string
): string {
  if (activityCount === 0) return `No activities ${context}`;
  if (availableCount === 0) {
    return '— · no durations recorded';
  }
  if (availableCount < activityCount) {
    return `Partial total · duration for ${availableCount} of ${activityCount} activities`;
  }
  return '';
}

function calorieCoverageNote(
  totals: ReturnType<typeof selectCardioActivityTotals>,
  context: string
): string {
  if (totals.activityCount === 0) return `No activities ${context}`;
  if (totals.runCount === 0) return '— · no validated estimate for Walks';
  if (totals.estimatedRunCount === 0) {
    return totals.walkCount
      ? '— · no saved Run estimates; Walk estimates are unavailable'
      : '— · no Run estimates recorded';
  }
  if (totals.estimatedRunCount < totals.runCount) {
    return `Calories available for ${totals.estimatedRunCount} of ${totals.activityCount} activities`;
  }
  if (totals.walkCount > 0) {
    return `Calories available for ${totals.runCount} of ${totals.activityCount} activities`;
  }
  return '';
}

function formatTotalDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function CardioGoalsDialog({ data, today, weightData, onSave, onClose }: {
  data: CardioData;
  today: string;
  weightData: WeightData;
  onSave: (data: CardioData) => string | null;
  onClose: () => void;
}) {
  const history = data.targetHistory ?? [];
  const selectedHistory = [...history].filter(item => item.effectiveDate > today).at(-1)
    ?? [...history].filter(item => item.effectiveDate <= today).at(-1);
  const goals = data.trackingStartDate
    ? selectedHistory ? cardioGoalSettings(selectedHistory) : cardioTargetsForDate(data, today)
    : cardioGoalSettings(data.goals);
  const rawGoals = typeof data.goals === 'object' && data.goals !== null
    ? data.goals as Record<string, unknown> : {};
  const [runs, setRuns] = useState(goals ? String(goals.weeklyRunTarget)
    : selectedHistory || data.trackingStartDate || rawGoals.weeklyRunTarget == null ? '' : String(rawGoals.weeklyRunTarget));
  const [miles, setMiles] = useState(goals ? String(goals.weeklyMileTarget)
    : selectedHistory || data.trackingStartDate || rawGoals.weeklyMileTarget == null ? '' : String(rawGoals.weeklyMileTarget));
  const [trackingStartDate, setTrackingStartDate] = useState(data.trackingStartDate ?? today);
  const initialEstimateWeight = cardioEstimateWeightSetting(data.estimateWeight);
  const [estimateWeightUnit, setEstimateWeightUnit] = useState<WeightUnit>(
    initialEstimateWeight?.unit ?? weightUnit(weightData.displayUnit)
  );
  const [estimateWeight, setEstimateWeight] = useState(
    initialEstimateWeight
      ? formatWeight(initialEstimateWeight.weightKg, initialEstimateWeight.unit)
      : ''
  );
  const [errors, setErrors] = useState<{ runs: string | null; miles: string | null; estimateWeight: string | null; form: string | null }>({
    runs: null, miles: null, estimateWeight: null, form: null
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const runTarget = parseCardioGoalInput(runs);
    const mileTarget = parseCardioGoalInput(miles);
    const estimateWeightKg = estimateWeight.trim()
      ? parseWeightInput(estimateWeight, estimateWeightUnit)
      : null;
    const nextErrors: { runs: string | null; miles: string | null; estimateWeight: string | null; form: string | null } = {
      runs: null, miles: null, estimateWeight: null, form: null
    };
    if (runs.trim() && (!Number.isInteger(runTarget) || (runTarget ?? 0) < 1 || (runTarget ?? 0) > 21)) {
      nextErrors.runs = 'Enter 1 to 21 runs per week.';
    }
    if (miles.trim() && (!Number.isFinite(mileTarget) || (mileTarget ?? 0) < 0.1 || (mileTarget ?? 0) > 1000)) {
      nextErrors.miles = 'Enter a distance from 0.1 to 1,000 miles.';
    }
    if (estimateWeight.trim() && (estimateWeightKg === null || estimateWeightKg <= 0
      || weightValueInUnit(estimateWeightKg, estimateWeightUnit) > 2000)) {
      nextErrors.estimateWeight = 'Enter a positive body weight within the supported range, or leave it blank.';
    }
    const validation = validateCardioGoals({ weeklyRunTarget: runTarget, weeklyMileTarget: mileTarget });
    if (validation) {
      if (runTarget === null && mileTarget !== null) nextErrors.runs = 'Set both weekly targets, or leave both blank.';
      if (mileTarget === null && runTarget !== null) nextErrors.miles = 'Set both weekly targets, or leave both blank.';
      if (!nextErrors.runs && !nextErrors.miles) nextErrors.form = validation;
    }
    if (nextErrors.runs || nextErrors.miles || nextErrors.estimateWeight || nextErrors.form) {
      setErrors(nextErrors);
      return;
    }
    if (!data.trackingStartDate && (!trackingStartDate || trackingStartDate > today)) {
      setErrors({ runs: null, miles: null, estimateWeight: null, form: 'Choose a Cardio tracking start date that is today or earlier.' });
      return;
    }
    const goalsData = saveCardioGoals(data, {
      weeklyRunTarget: runTarget,
      weeklyMileTarget: mileTarget
    }, today, trackingStartDate);
    const nextData = saveCardioEstimateWeight(goalsData,
      estimateWeightKg === null ? null : { weightKg: estimateWeightKg, unit: estimateWeightUnit });
    const writeError = onSave(nextData);
    if (writeError) setErrors({ runs: null, miles: null, estimateWeight: null, form: writeError });
    else onClose();
  }

  return (
    <MoneyGoalDialog title="Cardio goals" labelledBy="cardio-goals-title" titleId="cardio-goals-title"
      initialFocusId="cardio-goal-runs" onClose={onClose} closeLabel="Close Cardio goals"
      bodyClassName="fitness-goals-dialog-body" dialogClassName="money-goal-dialog--fitness-goals" phoneFullScreen>
      <form className="cardio-form fitness-goals-form" noValidate onSubmit={submit}>
        <div className="fitness-goals-scroll">
          <p>Both weekly targets are needed to calculate run-based Cardio progress. Leave both blank to clear them.</p>
          <p>Walks appear in activity summaries but do not count toward current run goals, Cardio Health, or Cardio Rhythm credit.</p>
          {!data.trackingStartDate && (
            <label className="cardio-tracking-start">Start Cardio tracking on
              <input type="date" max={today} value={trackingStartDate}
                onChange={event => setTrackingStartDate(event.currentTarget.value)} />
            </label>
          )}
          <div className="cardio-goal-inputs">
            <div className="cardio-goal-field">
              <NumericControl
                id="cardio-goal-runs"
                label="Runs per week"
                value={runs}
                min={1}
                max={21}
                step={1}
                inputMode="numeric"
                invalid={Boolean(errors.runs)}
                {...(errors.runs ? { describedBy: 'cardio-goal-runs-error' } : {})}
                decreaseLabel="Decrease runs per week by 1"
                increaseLabel="Increase runs per week by 1"
                onChange={value => {
                  setRuns(value);
                  setErrors(current => ({ ...current, runs: null, form: null }));
                }}
                onStep={direction => setRuns(value => stepCardioGoalInput(value, direction, 'runs'))}
              />
              {errors.runs && <small id="cardio-goal-runs-error" className="numeric-control__error" role="alert">{errors.runs}</small>}
            </div>
            {data.trackingStartDate ? (
              <p className="cardio-goal-effective-date">
                Upcoming targets: {runTargetText(runs)} runs/week and {mileTargetText(miles)} miles/week,
                effective Monday {formatLongDate(addDateDays(cardioWeekStart(today), 7))}. Current targets stay active through Sunday.
              </p>
            ) : (
              <p className="cardio-goal-effective-date">
                Tracking starts {formatLongDate(trackingStartDate)}. These goals affect this week’s progress immediately; this partial setup week is excluded from Consistency.
              </p>
            )}
            <div className="cardio-goal-field">
              <NumericControl
                id="cardio-goal-miles"
                label="Miles per week"
                value={miles}
                min={0.1}
                max={1000}
                step={0.1}
                invalid={Boolean(errors.miles)}
                {...(errors.miles ? { describedBy: 'cardio-goal-miles-error' } : {})}
                decreaseLabel="Decrease miles per week by 0.1"
                increaseLabel="Increase miles per week by 0.1"
                onChange={value => {
                  setMiles(value);
                  setErrors(current => ({ ...current, miles: null, form: null }));
                }}
                onStep={direction => setMiles(value => stepCardioGoalInput(value, direction, 'miles'))}
              />
              {errors.miles && <small id="cardio-goal-miles-error" className="numeric-control__error" role="alert">{errors.miles}</small>}
            </div>
          </div>
          <fieldset className="cardio-estimate-weight">
            <legend>Calorie estimate weight</legend>
            <p>This separate setting supplies a rough Run calorie estimate when no dated weigh-in is available. It does not change Weight Foundation data or historical activity snapshots.</p>
            <div className="cardio-estimate-weight__fields">
              <label>
                Estimate weight
                <input
                  type="number"
                  min="0.1"
                  max="2000"
                  step="0.1"
                  inputMode="decimal"
                  value={estimateWeight}
                  onChange={event => {
                    setEstimateWeight(event.currentTarget.value);
                    setErrors(current => ({ ...current, estimateWeight: null, form: null }));
                  }}
                />
              </label>
              <label>
                Weight unit
                <select
                  value={estimateWeightUnit}
                  onChange={event => {
                    const nextUnit = event.currentTarget.value;
                    if (nextUnit !== 'lb' && nextUnit !== 'kg') return;
                    if (estimateWeight.trim()) {
                      const kg = parseWeightInput(estimateWeight, estimateWeightUnit);
                      if (kg !== null) setEstimateWeight(formatWeightInput(kg, nextUnit));
                    }
                    setEstimateWeightUnit(nextUnit);
                    setErrors(current => ({ ...current, estimateWeight: null, form: null }));
                  }}
                >
                  <option value="lb">lb</option>
                  <option value="kg">kg</option>
                </select>
              </label>
            </div>
            {errors.estimateWeight && (
              <small className="numeric-control__error" role="alert">{errors.estimateWeight}</small>
            )}
          </fieldset>
          {errors.form && <p className="goal-field-error" role="alert">{errors.form}</p>}
        </div>
        <div className="profile-editor-actions fitness-goals-actions">
          <button type="submit" className="btn mini">Save goals</button>
          <button type="button" className="btn mini ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </MoneyGoalDialog>
  );
}

function CardioActivityDialog({
  data,
  today,
  weightData,
  rhythms,
  archivedRhythmIds,
  activity,
  initialRhythm,
  onSave,
  onDelete,
  onClose
}: {
  data: CardioData;
  today: string;
  weightData: WeightData;
  rhythms: readonly RhythmPreview[];
  archivedRhythmIds: ReadonlySet<string>;
  activity?: CardioActivity;
  initialRhythm?: RhythmPreview;
  onSave: (data: CardioData) => string | null;
  onDelete: (activity: CardioActivity) => string | null;
  onClose: () => void;
}) {
  const [date, setDate] = useState(activity?.date ?? today);
  const [activityType, setActivityType] = useState<CardioActivityType | ''>(
    activity ? cardioActivityType(activity) : initialRhythm ? 'run' : ''
  );
  const [distanceUnit, setDistanceUnit] = useState<CardioDistanceUnit>(
    activity?.distanceUnit ?? initialRhythm?.healthRunTarget?.unit ?? 'mi'
  );
  const [distance, setDistance] = useState(activity
    ? formatDistanceInput(cardioDistanceFromMiles(activity.distance, activity.distanceUnit ?? 'mi'))
    : '');
  const [durationHours, setDurationHours] = useState(activity?.durationSeconds
    ? String(Math.floor(activity.durationSeconds / 3600)) : '');
  const [durationMinutes, setDurationMinutes] = useState(activity?.durationSeconds
    ? String(Math.floor(activity.durationSeconds % 3600 / 60)) : '');
  const [durationSeconds, setDurationSeconds] = useState(activity?.durationSeconds
    ? String(activity.durationSeconds % 60) : '');
  const [notes, setNotes] = useState(activity?.notes ?? '');
  const [rhythmId, setRhythmId] = useState(activity?.rhythmId ?? initialRhythm?.id ?? '');
  const [error, setError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const submitting = useRef(false);
  const eligible = rhythms.filter(rhythm => rhythm.healthLogCapability === 'cardio');
  const selectedRhythm = rhythms.find(rhythm => rhythm.id === rhythmId);
  const parsedDuration = parseCardioRunDuration(durationHours, durationMinutes, durationSeconds);
  const numericDistance = Number(distance);
  const paceSeconds = parsedDuration.valid
    ? cardioPaceSecondsPerUnit(parsedDuration.durationSeconds, numericDistance)
    : null;
  const weightDisplayUnit = weightUnit(weightData.displayUnit);
  const currentRunEstimate = activityType === 'run' && activity?.date === date
    ? activity.calorieEstimate
    : undefined;
  const recordedWeight = currentRunEstimate?.weightSource === 'weigh-in'
    ? null
    : latestCardioWeightOnOrBefore(weightData, date, today);
  const estimateWeightSetting = cardioEstimateWeightSetting(data.estimateWeight);
  const runCalorieEstimate: CardioCalorieEstimate | undefined =
    currentRunEstimate?.weightSource === 'weigh-in'
      ? currentRunEstimate
      : currentRunEstimate?.weightSource === 'manual'
        ? currentRunEstimate
        : recordedWeight
          ? cardioCalorieEstimateFromWeighIn(recordedWeight)
          : estimateWeightSetting
            ? {
              source: 'estimated',
              method: 'distance-weight-v1',
              weightKg: estimateWeightSetting.weightKg,
              weightSource: 'manual'
            }
            : undefined;
  const calorieEstimate = activityType === 'walk'
    ? activity?.calorieEstimate
    : runCalorieEstimate;
  const estimateWeightKg = calorieEstimate?.weightKg ?? null;
  const estimatedCalories = activityType !== 'run' || estimateWeightKg === null
    ? null
    : estimateCardioCalories(estimateWeightKg, cardioDistanceToMiles(numericDistance, distanceUnit));
  const associationError = rhythmId
    ? cardioRhythmOccurrenceError(selectedRhythm, date, today, archivedRhythmIds)
    : null;

  function changeDistanceUnit(value: string) {
    if (value !== 'mi' && value !== 'km') return;
    const parsedDistance = Number(distance);
    if (distance.trim() && Number.isFinite(parsedDistance) && parsedDistance > 0) {
      const miles = cardioDistanceToMiles(parsedDistance, distanceUnit);
      setDistance(formatDistanceInput(cardioDistanceFromMiles(miles, value)));
    }
    setDistanceUnit(value);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (!activityType) {
      setError('Choose Run or Walk.');
      return;
    }
    if (!Number.isFinite(numericDistance) || numericDistance <= 0) {
      setError('Enter a distance greater than zero.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) {
      setError('Choose a valid activity date that is today or earlier.');
      return;
    }
    if (!parsedDuration.valid) {
      setError(parsedDuration.error);
      return;
    }
    if (notes.length > 1000) {
      setError('Notes must be 1,000 characters or fewer.');
      return;
    }
    if (activityType === 'walk' && rhythmId) {
      setError('Only Runs can be linked to a Cardio Rhythm. Remove the link before saving as a Walk.');
      return;
    }
    if (rhythmId && associationError) {
      setError(associationError);
      return;
    }
    const id = activity?.id ?? `cardio-${globalThis.crypto.randomUUID()}`;
    const previous = data.runs.find((item): item is CardioActivity => isCardioRun(item) && item.id === id);
    const sameLink = previous !== undefined && previous.rhythmId === rhythmId;
    const distanceMiles = cardioDistanceToMiles(numericDistance, distanceUnit);
    const saved = saveCardioActivity(data, {
      id,
      date,
      distance: distanceMiles,
      activityType,
      distanceUnit,
      ...(parsedDuration.durationSeconds === null ? {} : { durationSeconds: parsedDuration.durationSeconds }),
      ...(calorieEstimate ? { calorieEstimate } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(rhythmId ? {
        rhythmId,
        rhythmOccurrence: date,
        completionId: sameLink && previous.completionId
          ? previous.completionId : `cardio-completion-${globalThis.crypto.randomUUID()}`
      } : {})
    }, today);
    if (!saved.valid) {
      setError(saved.error);
      return;
    }
    submitting.current = true;
    const saveError = onSave(saved.data);
    if (saveError) {
      submitting.current = false;
      setError(saveError);
    } else onClose();
  }

  function deleteActivity() {
    if (!activity) return;
    const deleteError = onDelete(activity);
    if (deleteError) {
      setError(deleteError);
      setConfirmingDelete(false);
    }
    else onClose();
  }

  const paceLabel = paceSeconds === null
    ? '—'
    : `${Math.floor(paceSeconds / 60)}:${String(paceSeconds % 60).padStart(2, '0')} per ${distanceUnit === 'mi' ? 'mile' : 'kilometer'}`;
  const activityName = activityType === 'run' ? 'Run' : 'Walk';
  const dialogTitle = activity
    ? `Edit ${activityName.toLowerCase()}`
    : 'Log activity';

  return (
    <>
    <MoneyGoalDialog title={dialogTitle} labelledBy="cardio-activity-title" titleId="cardio-activity-title"
      onClose={onClose} closeLabel="Close activity form" phoneFullScreen inert={confirmingDelete}>
      <form className="cardio-form" onSubmit={submit}>
        <label>Activity type
          <select
            value={activityType}
            disabled={Boolean(rhythmId)}
            onChange={event => {
              const nextType = event.currentTarget.value;
              if (nextType === '' || nextType === 'run' || nextType === 'walk') {
                setActivityType(nextType);
                setError('');
              }
            }}
            required
          >
            <option value="">Choose activity type</option>
            <option value="run">Run</option>
            <option value="walk">Walk</option>
          </select>
        </label>
        {rhythmId ? (
          <p className="cardio-form__notice">
            Rhythm-linked activities must be Runs. Remove the Rhythm link before changing activity type.
          </p>
        ) : activityType === 'walk' ? (
          <p className="cardio-form__notice">
            Walks appear in activity summaries, but do not count toward run goals or Cardio Rhythm credit.
          </p>
        ) : null}
        <label>Activity date
          <input id="cardio-activity-date" type="date" max={today} value={date}
            onChange={event => setDate(event.currentTarget.value)} required />
        </label>
        <label>Distance ({distanceUnit === 'mi' ? 'miles' : 'kilometers'})
          <input type="number" min="0.01" step="0.01" value={distance}
            onChange={event => setDistance(event.currentTarget.value)} required />
        </label>
        <label>Distance unit
          <select value={distanceUnit} onChange={event => changeDistanceUnit(event.currentTarget.value)}>
            <option value="mi">Miles</option>
            <option value="km">Kilometers</option>
          </select>
        </label>
        <fieldset className="cardio-duration">
          <legend>Duration (optional)</legend>
          <div className="cardio-duration__fields">
            <label>Hours
              <input type="number" min="0" max="167" step="1" inputMode="numeric"
                value={durationHours} onChange={event => setDurationHours(event.currentTarget.value)} />
            </label>
            <label>Minutes
              <input type="number" min="0" max="59" step="1" inputMode="numeric"
                value={durationMinutes} onChange={event => setDurationMinutes(event.currentTarget.value)} />
            </label>
            <label>Seconds
              <input type="number" min="0" max="59" step="1" inputMode="numeric"
                value={durationSeconds} onChange={event => setDurationSeconds(event.currentTarget.value)} />
            </label>
          </div>
        </fieldset>
        <p className="cardio-pace" aria-live="polite">
          <strong>Pace</strong>
          <span>{paceLabel}</span>
        </p>
        <div className="cardio-calorie-estimate" aria-live="polite">
          <div className="cardio-calorie-estimate__heading">
            <strong>Calories</strong>
            <span>{estimatedCalories === null ? '—' : `${formatNumber(estimatedCalories)} kcal`}</span>
          </div>
          {activityType === 'run' ? (
            <>
              <p>
                {calorieEstimate?.weightSource === 'weigh-in'
                  ? `Using ${formatWeight(calorieEstimate.weightKg, weightDisplayUnit)} ${weightDisplayUnit} recorded on ${formatLongDate(calorieEstimate.weightDate)}.`
                  : calorieEstimate
                    ? `Using saved estimate weight ${formatWeight(calorieEstimate.weightKg, estimateWeightSetting?.unit ?? weightDisplayUnit)} ${estimateWeightSetting?.unit ?? weightDisplayUnit}.`
                    : 'No weight is available on or before this run date.'}
              </p>
              <details className="cardio-calorie-estimate__help">
                <summary>How this estimate is calculated</summary>
                <p>
                  Estimated calories = saved body weight in kilograms × run distance in kilometers,
                  rounded to the nearest kcal. This is a rough gross-energy estimate, not active calories;
                  age, incline, and pace are not used.
                </p>
              </details>
            </>
          ) : activityType === 'walk' ? (
            <p>No validated calorie estimate method is available for Walks. The running method is not applied.</p>
          ) : (
            <p>Choose Run or Walk to see available estimate information.</p>
          )}
        </div>
        {selectedRhythm?.healthRunTarget && (
          <p className="cardio-form__notice">
            Rhythm target: {selectedRhythm.healthRunTarget.distance} {selectedRhythm.healthRunTarget.unit}.
            Record the distance you actually ran.
          </p>
        )}
        <label>Notes (optional)
          <textarea rows={3} maxLength={1000} value={notes} onChange={event => setNotes(event.currentTarget.value)} />
        </label>
        {(activityType === 'run' || rhythmId) && (
          <label>Cardio Rhythm (optional)
            <select value={rhythmId} onChange={event => setRhythmId(event.currentTarget.value)}>
              <option value="">No linked Rhythm</option>
              {eligible.map(rhythm => <option key={rhythm.id} value={rhythm.id}>{rhythm.title}</option>)}
              {rhythmId && !eligible.some(rhythm => rhythm.id === rhythmId)
                && <option value={rhythmId}>Unresolved linked Rhythm</option>}
            </select>
          </label>
        )}
        {associationError && <p className="cardio-form__notice" role="status">{associationError}</p>}
        {error && <p className="goal-field-error" role="alert">{error}</p>}
        <div className="cardio-form__actions">
          {activity && (
            <button type="button" className="btn mini ghost cardio-form__delete"
              aria-label={`Delete ${activityName.toLowerCase()}`} onClick={() => setConfirmingDelete(true)}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m3 3v7m6-7v7" />
              </svg>
              Delete {activityName.toLowerCase()}
            </button>
          )}
          <div className="profile-editor-actions cardio-form__submit-actions">
            <button type="submit" className="btn mini">{activity ? 'Save changes' : 'Save activity'}</button>
            <button type="button" className="btn mini ghost" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </form>
    </MoneyGoalDialog>
    {confirmingDelete && activity && (
      <MoneyGoalDialog
        title={`Delete this ${activityName.toLowerCase()}?`}
        labelledBy="cardio-delete-title"
        titleId="cardio-delete-title"
        onClose={() => setConfirmingDelete(false)}
        closeLabel="Close delete confirmation"
        dialogClassName="cardio-delete-confirmation"
        portalToBody
      >
        <p>This also removes the activity’s linked Rhythm completion, if any.</p>
        <div className="cardio-delete-confirmation__actions">
          <button type="button" className="btn mini ghost" onClick={() => setConfirmingDelete(false)}>Keep activity</button>
          <button type="button" className="btn mini" onClick={deleteActivity}>Delete {activityName.toLowerCase()}</button>
        </div>
      </MoneyGoalDialog>
    )}
    </>
  );
}

function cardioLinkIssues(
  data: CardioData,
  rhythms: readonly RhythmPreview[],
  archivedRhythmIds: ReadonlySet<string>,
  completions: readonly DatedRhythmCompletion[]
): string[] {
  const issues: string[] = [];
  for (const value of data.runs) {
    if (!isCardioRun(value) || !value.rhythmId || !value.completionId) continue;
    if (cardioActivityType(value) !== 'run') {
      issues.push(`Walk activity ${value.id} has a run-linked Rhythm completion; it was preserved but receives no credit.`);
      continue;
    }
    const rhythm = rhythms.find(item => item.id === value.rhythmId);
    const matching = completions.filter(item => item.id === value.completionId);
    if (matching.length !== 1 || matching[0]?.rhythmId !== value.rhythmId
      || matching[0]?.effectiveDate !== value.date) {
      issues.push(`Activity ${value.id} has a missing or conflicting owned completion; it was preserved.`);
      continue;
    }
    const error = cardioRhythmOccurrenceError(rhythm, value.date, '9999-12-31', archivedRhythmIds);
    if (error) issues.push(`Activity ${value.id} has an unresolved Cardio Rhythm association; it was preserved.`);
  }
  return [...new Set(issues)];
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}


function formatDistanceInput(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function runTargetText(value: string): string {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) ? formatNumber(parsed) : '—';
}

function mileTargetText(value: string): string {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) ? formatNumber(parsed) : '—';
}

function formatLongDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
