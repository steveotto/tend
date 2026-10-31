import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { StrengthView } from './StrengthView.tsx';
import type { StrengthViewProps } from './StrengthView.tsx';
import { WeightView } from './WeightView.tsx';
import type { WeightViewProps } from './WeightView.tsx';
import { CardioView } from './CardioView.tsx';
import { BackButton } from './BackButton.tsx';
import type { CardioViewProps } from './CardioView.tsx';
import { CategoryHealthSummary } from './CategoryHealthSummary.tsx';
import { CategoryHeader } from './CategoryHeader.tsx';
import { AreaIcon } from './AreaIcon.tsx';
import { DetailNavigationCard } from './Cards.tsx';
import { SegmentedTabs } from './SegmentedTabs.tsx';
import type { SegmentedTab } from './SegmentedTabs.tsx';
import { CategoryRhythmCollection } from './CategoryRhythmCollection.tsx';
import { ArchivedRhythmsDialog } from './ArchivedRhythmsDialog.tsx';
import { RhythmDetailsDialog } from './RhythmDetailsDialog.tsx';
import type { CategoryScoreSelection } from '../domain/category-scoring.ts';
import type { Destination } from './AppNavigation.tsx';
import type { FoundationPreview, PersonId, RhythmPreview } from '../domain/preview-data.ts';
import { peopleForRhythm, rhythmLastActivityLabel } from '../domain/preview-data.ts';
import { isRhythmRelevantOnDate } from '../domain/category-rhythms.ts';
import type { RhythmScoreResult } from '../domain/rhythm-scoring.ts';
import { rhythmHealthScore } from '../domain/rhythm-scoring.ts';
import { isEditableRhythmId } from '../domain/rhythm-editor.ts';

type HealthFitnessTab = 'today' | 'rhythms' | 'progress';
type ProgressTab = 'strength' | 'cardio' | 'weight';

type HealthFitnessViewProps = {
  hidden?: boolean;
  strength: StrengthViewProps;
  weight: WeightViewProps;
  cardio: CardioViewProps;
  rhythms: readonly RhythmPreview[];
  archivedRhythms: readonly RhythmPreview[];
  todayDate: string;
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>;
  completedRhythms: ReadonlySet<string>;
  undoableRhythms: ReadonlySet<string>;
  foundations: readonly FoundationPreview[];
  onAddRhythm: (event: MouseEvent<HTMLButtonElement>) => void;
  onEditRhythm: (rhythm: RhythmPreview, event: MouseEvent<HTMLButtonElement>) => void;
  onRhythmHistory: (id: string, event: MouseEvent<HTMLButtonElement>, returnTab: 'today' | 'rhythms') => void;
  onRestoreRhythm: (id: string) => void;
  onTendRhythm: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onUndoRhythm: (id: string) => void;
  onPersonSelect: (id: PersonId) => void;
  onOpenFoundation: (id: string, openerId: string, returnTab: 'today' | 'rhythms') => void;
  onOpenCategory: (id: Destination, openerId: string) => void;
};

const categoryTabs: readonly SegmentedTab<HealthFitnessTab>[] = [
  { id: 'today', label: 'Today', tabId: 'health-tab-today', panelId: 'health-panel-today' },
  { id: 'rhythms', label: 'Rhythms', tabId: 'health-tab-rhythms', panelId: 'health-panel-rhythms' },
  { id: 'progress', label: 'Progress', tabId: 'health-tab-progress', panelId: 'health-panel-progress' }
];

const progressDetails: readonly { id: ProgressTab; title: string; description: string }[] = [
  { id: 'strength', title: 'Strength', description: 'Your training, workouts, and muscle balance.' },
  { id: 'cardio', title: 'Cardio', description: 'Your activity and weekly goals.' },
  { id: 'weight', title: 'Weight', description: 'Your measurements and goal progress.' }
];

export function HealthFitnessView({
  hidden = false,
  strength,
  weight,
  cardio,
  rhythms,
  archivedRhythms,
  todayDate,
  rhythmScores,
  completedRhythms,
  undoableRhythms,
  foundations,
  onAddRhythm,
  onEditRhythm,
  onRhythmHistory,
  onRestoreRhythm,
  onTendRhythm,
  onUndoRhythm,
  onPersonSelect,
  onOpenFoundation,
  onOpenCategory
}: HealthFitnessViewProps) {
  const [selected, setSelected] = useState<HealthFitnessTab>('today');
  const [progressSelected, setProgressSelected] = useState<ProgressTab | null>(null);
  const [showArchivedRhythms, setShowArchivedRhythms] = useState(false);
  const archiveOpenerRef = useRef<HTMLButtonElement | null>(null);
  const wasArchiveOpenRef = useRef(false);
  const progressOpenerRef = useRef<HTMLButtonElement | null>(null);
  const progressScrollPositionRef = useRef<number | null>(null);
  const restoreProgressOverviewRef = useRef(false);
  const logReturnContextRef = useRef<{ tab: HealthFitnessTab; opener: HTMLButtonElement } | null>(null);
  const restoreLogFocusRef = useRef<HTMLButtonElement | null>(null);
  const [startWorkoutRequest, setStartWorkoutRequest] = useState<{
    requestId: number;
    opener: HTMLButtonElement;
  } | null>(null);
  const [rhythmModeRequest, setRhythmModeRequest] = useState<
    NonNullable<StrengthViewProps['pendingRhythmModeRequest']> | null
  >(null);
  const requestSequence = useRef(0);
  const todayRhythms = rhythms.filter(rhythm => isRhythmRelevantOnDate(rhythm, todayDate));
  const summaryScore: CategoryScoreSelection = {
    foundationIds: [],
    eligibleFoundationIds: [],
    excludedFoundationIds: [],
    unresolvedFoundationIds: [],
    consistency: null,
    onTrack: null,
    health: null
  };

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
    const pending = strength.pendingRhythmLog;
    if (!pending) return;
    if (!logReturnContextRef.current) {
      const opener = pending.opener
        ?? (document.activeElement instanceof HTMLButtonElement ? document.activeElement : null);
      if (opener) logReturnContextRef.current = { tab: selected, opener };
    }
    setSelected('progress');
    setProgressSelected('strength');
  }, [strength.pendingRhythmLog?.requestId]);

  useEffect(() => {
    const pending = cardio.pendingLogRequest;
    if (!pending) return;
    if (!logReturnContextRef.current) {
      logReturnContextRef.current = { tab: selected, opener: pending.opener };
    }
    setSelected('progress');
    setProgressSelected('cardio');
  }, [cardio.pendingLogRequest?.requestId]);

  useEffect(() => {
    const pending = weight.pendingLogRequest;
    if (!pending) return;
    if (!logReturnContextRef.current) {
      logReturnContextRef.current = { tab: selected, opener: pending.opener };
    }
    setSelected('progress');
    setProgressSelected('weight');
  }, [weight.pendingLogRequest?.requestId]);

  useEffect(() => {
    if (!restoreLogFocusRef.current) return;
    restoreLogFocusRef.current.focus({ preventScroll: true });
    restoreLogFocusRef.current = null;
  }, [selected]);

  function rememberLogContext(opener: HTMLButtonElement) {
    logReturnContextRef.current = { tab: selected, opener };
  }

  function restoreLogContext() {
    const context = logReturnContextRef.current;
    if (!context) return;
    logReturnContextRef.current = null;
    restoreLogFocusRef.current = context.opener;
    setSelected(context.tab);
  }

  function startWorkout(event: MouseEvent<HTMLButtonElement>) {
    rememberLogContext(event.currentTarget);
    requestSequence.current += 1;
    setStartWorkoutRequest({ requestId: requestSequence.current, opener: event.currentTarget });
    setSelected('progress');
    setProgressSelected('strength');
  }

  function openQuickLog(
    section: ProgressTab,
    callback: ((event: MouseEvent<HTMLButtonElement>) => void) | undefined,
    event: MouseEvent<HTMLButtonElement>
  ) {
    rememberLogContext(event.currentTarget);
    setSelected('progress');
    setProgressSelected(section);
    callback?.(event);
  }

  function openRhythmLog(id: string, event: MouseEvent<HTMLButtonElement>) {
    const capability = rhythms.find(rhythm => rhythm.id === id)?.healthLogCapability;
    const section: ProgressTab = capability === 'cardio'
      ? 'cardio'
      : capability === 'weight' ? 'weight' : 'strength';
    rememberLogContext(event.currentTarget);
    setSelected('progress');
    setProgressSelected(section);
    onTendRhythm(id, event);
  }

  function returnToProgressOverview() {
    restoreProgressOverviewRef.current = true;
    setProgressSelected(null);
  }

  function renderProgressOverviewLink() {
    return (
      <BackButton onClick={returnToProgressOverview}>All progress</BackButton>
    );
  }

  function renderStrengthRhythmAction(rhythm: RhythmPreview) {
    const setting = strength.rhythms.find(item => item.rhythm.id === rhythm.id);
    if (!setting) return null;
    return (
      <button
        type="button"
        className="btn mini ghost"
        onClick={event => {
          rememberLogContext(event.currentTarget);
          setSelected('progress');
          setProgressSelected('strength');
          requestSequence.current += 1;
          setRhythmModeRequest({
            requestId: requestSequence.current,
            setting,
            opener: event.currentTarget
          });
        }}
      >
        Workout mode
      </button>
    );
  }

  return (
    <main className="category-page category-page--with-header health-fitness-page" aria-labelledby="health-fitness-title" hidden={hidden}>
      <CategoryHeader
        title="Health & Fitness"
        titleId="health-fitness-title"
        subtitle="Structure beats good intentions"
      />

      <CategoryHealthSummary
        categoryLabel="Health & Fitness"
        score={summaryScore}
        itemTerm={{ singular: 'measure', plural: 'measures' }}
        explanationIntro="Overall score not available yet."
        interpretationNote="Strength, Cardio, and Weight remain available as separate views."
      />

      <SegmentedTabs
        tabs={categoryTabs}
        selectedTabId={selected}
        ariaLabel="Health and Fitness"
        onChange={setSelected}
      />

      <section id="health-panel-today" role="tabpanel" aria-labelledby="health-tab-today" hidden={selected !== 'today'}>
        <div className="health-fitness-today">
          <section className="marriage-today-section" aria-labelledby="health-today-heading">
            <header className="marriage-section-heading">
              <div>
                <h3 id="health-today-heading">Today</h3>
                <p>{todayRhythms.filter(rhythm => completedRhythms.has(rhythm.id)).length} of {todayRhythms.length} Rhythms tended today</p>
              </div>
            </header>
            {todayRhythms.length > 0
              ? (
                <div className="marriage-rhythm-list current-plan-item-group">
                  {todayRhythms.map(rhythm => (
                    <RhythmDetailsDialog
                      key={rhythm.id}
                      rhythm={rhythm}
                      inline
                      completed={completedRhythms.has(rhythm.id)}
                      statusLabel={rhythmLastActivityLabel(rhythm, todayDate)}
                      people={peopleForRhythm(rhythm)}
                      foundations={foundations}
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
                            ...(undoableRhythms.has(rhythm.id) ? { onUndo: () => onUndoRhythm(rhythm.id) } : {}),
                            completionActionLabel: rhythm.healthLogCapability === 'cardio'
                              ? 'Log run'
                              : rhythm.healthLogCapability === 'weight' ? 'Log weigh-in' : 'Log workout',
                            completedActionLabel: rhythm.healthLogCapability === 'weight' ? 'Weighed in' : 'Logged'
                          }
                        : {})}
                      onClose={() => undefined}
                    />
                  ))}
                </div>
              )
              : (
                <div className="marriage-empty-state">
                  <p>{rhythms.length > 0 ? 'All caught up. Nothing to tend to.' : 'No active Rhythms.'}</p>
                </div>
              )}
          </section>
          <div className="health-fitness-quick-actions" role="group" aria-label="Fitness quick actions">
            <button type="button" className="btn mini" onClick={startWorkout}>Start workout</button>
            <button type="button" className="btn mini ghost"
              onClick={event => openQuickLog('cardio', cardio.onQuickLog, event)}>Log cardio</button>
            <button type="button" className="btn mini ghost"
              onClick={event => openQuickLog('weight', weight.onQuickLog, event)}>Weigh in</button>
          </div>
        </div>
      </section>

      <section id="health-panel-rhythms" role="tabpanel" aria-labelledby="health-tab-rhythms" hidden={selected !== 'rhythms'}>
        <CategoryRhythmCollection
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
          suggestionsUnavailableReason="Health & Fitness Rhythm suggestions are not available yet."
          onShowArchivedRhythms={() => setShowArchivedRhythms(true)}
          onPersonSelect={onPersonSelect}
          onOpenFoundation={(id, openerId) => onOpenFoundation(id, openerId, 'rhythms')}
          onOpenCategory={onOpenCategory}
          onRhythmHistory={(id, event) => onRhythmHistory(id, event, 'rhythms')}
          onEditRhythm={onEditRhythm}
          onTend={openRhythmLog}
          onUndo={onUndoRhythm}
          completionActionLabelFor={rhythm => rhythm.healthLogCapability === 'cardio'
            ? 'Log run'
            : rhythm.healthLogCapability === 'weight' ? 'Log weigh-in' : 'Log workout'}
          completedActionLabelFor={rhythm => rhythm.healthLogCapability === 'weight' ? 'Weighed in' : 'Logged'}
          renderAdditionalActions={renderStrengthRhythmAction}
        />
      </section>

      <section id="health-panel-progress" role="tabpanel" aria-labelledby="health-tab-progress" hidden={selected !== 'progress'}>
        <div className="health-fitness-progress">
          <section className="health-fitness-progress__overview" aria-label="Progress categories" hidden={progressSelected !== null}>
            <div className="marriage-foundation-list">
              {progressDetails.map(detail => (
                <DetailNavigationCard
                  key={detail.id}
                  title={detail.title}
                  description={detail.description}
                  icon={<AreaIcon id="health" />}
                  onSelect={event => {
                    progressOpenerRef.current = event.currentTarget;
                    progressScrollPositionRef.current = document.scrollingElement?.scrollTop ?? null;
                    restoreProgressOverviewRef.current = false;
                    setProgressSelected(detail.id);
                  }}
                />
              ))}
            </div>
          </section>
          <section className="health-fitness-progress__detail tend-back-stack" aria-label="Strength progress" hidden={progressSelected !== 'strength'}>
            {renderProgressOverviewLink()}
            <StrengthView
              {...strength}
              quickStartRequest={startWorkoutRequest}
              onQuickStartClosed={restoreLogContext}
              pendingRhythmModeRequest={rhythmModeRequest}
              onRhythmModeRequestOpened={requestId => {
                setRhythmModeRequest(current => current?.requestId === requestId ? null : current);
              }}
              onRhythmLogClosed={restoreLogContext}
              onRhythmModeRequestClosed={restoreLogContext}
            />
          </section>
          <section className="health-fitness-progress__detail tend-back-stack" aria-label="Cardio progress" hidden={progressSelected !== 'cardio'}>
            {renderProgressOverviewLink()}
            <CardioView {...cardio} onLogRequestClosed={restoreLogContext} />
          </section>
          <section className="health-fitness-progress__detail tend-back-stack" aria-label="Weight progress" hidden={progressSelected !== 'weight'}>
            {renderProgressOverviewLink()}
            <WeightView {...weight} onLogRequestClosed={restoreLogContext} />
          </section>
        </div>
      </section>

      {showArchivedRhythms && (
        <ArchivedRhythmsDialog
          rhythms={archivedRhythms}
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
    </main>
  );
}
