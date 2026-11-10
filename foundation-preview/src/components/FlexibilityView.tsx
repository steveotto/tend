import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { FitnessScoreSummary } from './FitnessScoreSummary.tsx';
import { HealthScoringDetailsCard } from './HealthScoringDetailsCard.tsx';
import type { HealthAggregateEvidence } from './HealthScoringDetailsCard.tsx';
import { createHealthFitnessRollup } from './HealthRollupDiagram.tsx';
import { SegmentedTabs } from './SegmentedTabs.tsx';
import type { SegmentedTab } from './SegmentedTabs.tsx';
import { FitnessBodyMapLayout } from './FitnessBodyMap.tsx';
import type { FitnessBodyMapConfigFor } from './FitnessBodyMap.tsx';
import { FlexibilityGuidedSessionDialog } from './FlexibilityGuidedSessionDialog.tsx';
import { FlexibilityRoutineEditorDialog } from './FlexibilityRoutineEditorDialog.tsx';
import { RhythmCalendarIcon } from './RhythmCalendarIcon.tsx';
import { SettingsGearButton } from './SettingsGearButton.tsx';
import {
  clearFlexibilityDraft,
  createFlexibilityGuidedSession,
  deleteFlexibilityRoutine,
  deleteFlexibilitySession,
  estimateFlexibilityRoutineSeconds,
  flexibilityRegions,
  flexibilityRoutineSuggestions,
  finishFlexibilityGuidedSession,
  migrateFlexibilityData,
  saveFlexibilityDraft,
  saveFlexibilityRoutine,
  saveFlexibilitySession,
  selectFlexibilityConsistency,
  selectFlexibilityRegionScores,
  suggestNextFlexibilityStretch
} from '../domain/flexibility.ts';
import type {
  FlexibilityData,
  FlexibilityGuidedSessionDraft,
  FlexibilityRegionId,
  FlexibilityRegionScore,
  FlexibilitySession,
  FlexibilitySessionDraft,
  SavedFlexibilityRoutine
} from '../domain/flexibility.ts';
import { formatHealthAverageEquation, formatScore } from '../domain/score-display.ts';

type DialogState = 'log' | 'settings' | 'guided' | null;
type FlexibilityCollectionTab = 'recommended' | 'saved' | 'history';
const flexibilityCollectionTabs = [
  { id: 'recommended', label: 'Recommended', tabId: 'flexibility-tab-recommended', panelId: 'flexibility-panel-recommended' },
  { id: 'saved', label: 'Saved', tabId: 'flexibility-tab-saved', panelId: 'flexibility-panel-saved' },
  { id: 'history', label: 'History', tabId: 'flexibility-tab-history', panelId: 'flexibility-panel-history' }
] as const satisfies readonly SegmentedTab<FlexibilityCollectionTab>[];

export type FlexibilityViewProps = {
  data: FlexibilityData;
  today: string;
  onChange: (data: FlexibilityData) => string | null;
  overallHealthScore?: number | null;
  categoryHealthScore?: number | null;
  foundationNavigation?: boolean;
  pendingQuickLog?: {
    requestId: number;
    regionIds: readonly FlexibilityRegionId[];
    linkedRhythmId?: string;
    rhythmOccurrence?: string;
    rhythmTitle?: string;
    opener?: HTMLButtonElement;
  } | null;
  onQuickLogOpened?: (requestId: number) => void;
  onLogRequestClosed?: () => void;
};

const defaultDraft = (today: string, regionIds: readonly FlexibilityRegionId[] = []): FlexibilitySessionDraft => ({
  date: today,
  regionIds: [...regionIds],
  minutes: '',
  notes: ''
});

const flexibilityBodyMapOrder: readonly FlexibilityRegionId[] = [
  'neck', 'shoulders', 'chest', 'abs', 'hip-flexors', 'quads',
  'back', 'glutes', 'hamstrings', 'calves'
];
const flexibilityFrontRegions = new Set<FlexibilityRegionId>([
  'neck', 'shoulders', 'chest', 'abs', 'hip-flexors', 'quads'
]);
const flexibilityBackRegions = new Set<FlexibilityRegionId>([
  'neck', 'shoulders', 'back', 'glutes', 'hamstrings', 'calves'
]);

export function createFlexibilityBodyMapConfig(
  scores: ReturnType<typeof selectFlexibilityRegionScores>
): FitnessBodyMapConfigFor<FlexibilityRegionId> {
  return {
    title: 'Stretch schedule',
    eventType: 'flexibility',
    verb: 'stretching',
    regions: flexibilityBodyMapOrder.map(id => {
      const region = scores.find(score => score.id === id)!;
      return {
        id: region.id,
        name: region.name,
        group: region.group,
        front: flexibilityFrontRegions.has(region.id),
        back: flexibilityBackRegions.has(region.id),
        score: region.score,
        status: region.status,
        fill: flexibilityScoreFill(region.score)
      };
    })
  };
}

export function FlexibilityView({
  data,
  today,
  onChange,
  overallHealthScore = null,
  categoryHealthScore = null,
  foundationNavigation = false,
  pendingQuickLog = null,
  onQuickLogOpened,
  onLogRequestClosed
}: FlexibilityViewProps) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [collectionTab, setCollectionTab] = useState<FlexibilityCollectionTab>('recommended');
  const [routineEditor, setRoutineEditor] = useState<SavedFlexibilityRoutine | null>(null);
  const [suggestionPickerOpen, setSuggestionPickerOpen] = useState(false);
  const [routineError, setRoutineError] = useState('');
  const [pendingRhythmStart, setPendingRhythmStart] = useState<{
    rhythmId: string;
    occurrence: string;
    title: string;
  } | null>(null);
  const [linkedRoutineId, setLinkedRoutineId] = useState('');
  const savedRoutines = data.savedRoutines ?? [];
  const [view, setView] = useState<'front' | 'back'>('front');
  const [selectedRegion, setSelectedRegion] = useState<FlexibilityRegionId>('shoulders');
  const [draft, setDraft] = useState<FlexibilitySessionDraft | null>(null);
  const [intervalDraft, setIntervalDraft] = useState<Record<FlexibilityRegionId, string>>(() =>
    Object.fromEntries(flexibilityRegions.map(region => [
      region.id,
      String(data.settings.intervals[region.id] ?? region.defaultIntervalDays)
    ])) as Record<FlexibilityRegionId, string>
  );
  const [error, setError] = useState('');
  const scores = useMemo(() => selectFlexibilityRegionScores(data, today), [data, today]);
  const consistency = selectFlexibilityConsistency(scores);
  const scoredRegionValues = scores.flatMap(region =>
    region.score !== null && Number.isFinite(region.score) ? [region.score] : []
  );
  const flexibilityScoringEvidence: HealthAggregateEvidence = {
    heading: 'Stretch-region consistency scores',
    description: 'Tracked region scores contribute equally to Flexibility Health.',
    itemLabel: 'Region',
    rows: scores.map(region => ({
      id: region.id,
      label: region.name,
      consistency: region.score,
      onTrack: null
    })),
    consistencyAverage: consistency.score,
    consistencyCount: consistency.trackedCount,
    onTrackAverage: null,
    onTrackCount: 0,
    notes: ['Untracked regions are unavailable and excluded.'],
    emptyState: 'No tracked stretch-region scores are available yet.',
    showEmptyStateWhenNoAverages: true
  };
  const flexibilityFormula = (
    <section className="rhythm-health-scoring-card__calculation health-scoring-details-card__calculation">
      <h4>How Health is calculated</h4>
      <p>Flexibility Health is the equal-weight average of tracked stretch-region Consistency scores.</p>
      <p className="rhythm-health-scoring-card__formula rhythm-health-scoring-card__formula--total">
        {formatHealthAverageEquation(scoredRegionValues, consistency.score, consistency.trackedCount, true)}
      </p>
      <p>On Track is unavailable for this measure.</p>
    </section>
  );
  const flexibilityScoringCard = (
    <HealthScoringDetailsCard
      title="How Flexibility Health is scored"
      healthScore={consistency.score}
      consistencyScore={consistency.score}
      onTrackScore={null}
      evidence={flexibilityScoringEvidence}
      formulaContent={flexibilityFormula}
    />
  );
  const suggestion = suggestNextFlexibilityStretch(scores);
  const recommendedSavedRoutines = suggestion.reasonRegionId === null
    ? []
    : savedRoutines.filter(routine => routine.stretches.some(stretch =>
      stretch.regionIds.some(id => suggestion.regionIds.includes(id))));
  const bodyMapConfig = createFlexibilityBodyMapConfig(scores);
  const groups = [...new Set(flexibilityRegions.map(region => region.group))];
  const visibleRegions = bodyMapConfig.regions.filter(region => region[view]);
  const sortedSessions = [...data.sessions].sort((left, right) =>
    right.date.localeCompare(left.date) || right.id.localeCompare(left.id)
  );
  const sortedGuidedSessions = [...(data.guidedSessions ?? [])].sort((left, right) =>
    right.date.localeCompare(left.date) || right.startedAt.localeCompare(left.startedAt)
  );

  function persist(next: FlexibilityData): boolean {
    const message = onChange(next);
    if (message) {
      setError(message);
      return false;
    }
    setError('');
    return true;
  }

  function openLog(regionIds: readonly FlexibilityRegionId[] = [], session?: FlexibilitySession) {
    const nextDraft = session
      ? {
          date: session.date,
          regionIds: [...session.regionIds],
          minutes: session.minutes === undefined ? '' : String(session.minutes),
          notes: session.notes ?? '',
          editingSessionId: session.id
        }
      : data.draftSession ?? defaultDraft(today, regionIds);
    const saved = saveFlexibilityDraft(data, nextDraft, today);
    if (!saved.valid) {
      setError(saved.error);
      return;
    }
    if (!persist(saved.data)) return;
    setDraft(nextDraft);
    setDialog('log');
  }

  function updateDraft(next: FlexibilitySessionDraft) {
    const saved = saveFlexibilityDraft(data, next, today);
    if (!saved.valid) {
      setError(saved.error);
      return;
    }
    if (persist(saved.data)) setDraft(next);
  }

  function saveLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const minutes = draft.minutes.trim() === '' ? undefined : Number(draft.minutes);
    const session: FlexibilitySession = {
      id: draft.editingSessionId ?? crypto.randomUUID(),
      date: draft.date,
      regionIds: draft.regionIds,
      ...(minutes === undefined ? {} : { minutes }),
      ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {})
    };
    const saved = saveFlexibilitySession(data.sessions, session);
    if (!saved.valid) {
      setError(saved.error);
      return;
    }
    const next = clearFlexibilityDraft({ ...data, sessions: saved.sessions });
    if (!persist(next)) return;
    setDialog(null);
    setDraft(null);
    onLogRequestClosed?.();
  }

  function closeLog() {
    setDialog(null);
    setDraft(null);
    onLogRequestClosed?.();
  }

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const intervals = {} as Record<FlexibilityRegionId, number>;
    for (const region of flexibilityRegions) {
      const interval = Number(intervalDraft[region.id]);
      if (!Number.isInteger(interval) || interval < 1 || interval > 365) {
        setError(`Enter a whole number from 1 to 365 for ${region.name}.`);
        return;
      }
      intervals[region.id] = interval;
    }
    if (!persist({ ...data, settings: { intervals } })) return;
    setDialog(null);
  }

  function deleteSession(session: FlexibilitySession) {
    if (!window.confirm(`Delete the stretch session from ${session.date}?`)) return;
    const result = deleteFlexibilitySession(data.sessions, session.id);
    if (!result.deleted) {
      setError('That stretch session is no longer available.');
      return;
    }
    const next = clearFlexibilityDraft({ ...data, sessions: result.sessions });
    persist(next);
  }

  function openRoutineEditor(routine: SavedFlexibilityRoutine) {
    setRoutineEditor(routine);
    setRoutineError('');
  }

  function createRoutine() {
    openRoutineEditor({
      id: `new-routine-${globalThis.crypto.randomUUID()}`,
      name: '',
      stretches: [],
      preparationSeconds: 5,
      timerDirection: 'down'
    });
  }

  function saveRoutine(routine: SavedFlexibilityRoutine) {
    const savedRoutine = routine.id.startsWith('suggestion-') || routine.id.startsWith('new-routine-')
      ? { ...routine, id: `flexibility-routine-${globalThis.crypto.randomUUID()}` }
      : routine;
    const result = saveFlexibilityRoutine(savedRoutines, savedRoutine);
    if (!result.valid) {
      setRoutineError(result.error);
      return;
    }
    if (persist(migrateFlexibilityData({ ...data, savedRoutines: result.routines }))) {
      setRoutineEditor(null);
      setCollectionTab('saved');
    }
  }

  function startRoutine(
    routine: SavedFlexibilityRoutine,
    linkedRhythm?: { rhythmId: string; occurrence: string }
  ) {
    if (data.guidedSessionDraft) {
      setRoutineError('Resume or finish the current stretch session before starting another.');
      return;
    }
    const preferences = data.timerPreferences;
    const result = createFlexibilityGuidedSession(routine, {
      id: `flexibility-session-${globalThis.crypto.randomUUID()}`,
      date: today,
      startedAt: new Date().toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      preparationSeconds: preferences?.preparationSeconds ?? routine.preparationSeconds,
      timerDirection: preferences?.timerDirection ?? routine.timerDirection,
      ...(linkedRhythm ? {
        linkedRhythmId: linkedRhythm.rhythmId,
        rhythmOccurrence: linkedRhythm.occurrence,
        completionId: `flexibility-completion-${globalThis.crypto.randomUUID()}`
      } : {})
    });
    if (!result.valid) {
      setRoutineError(result.error);
      return;
    }
    if (persist(migrateFlexibilityData({ ...data, guidedSessionDraft: result.session }))) {
      setRoutineError('');
      setDialog('guided');
      setPendingRhythmStart(null);
    }
  }

  function updateGuidedSession(
    session: FlexibilityGuidedSessionDraft,
    timerPreferences?: FlexibilityData['timerPreferences']
  ): string | null {
    const next = migrateFlexibilityData({
      ...data,
      guidedSessionDraft: session,
      ...(timerPreferences ? { timerPreferences } : {})
    });
    return onChange(next);
  }

  function saveGuidedSession(session: FlexibilityGuidedSessionDraft): string | null {
    const result = finishFlexibilityGuidedSession(data, session);
    if (!result.valid) return result.error;
    const message = onChange(result.data);
    if (!message) {
      setDialog(null);
      setError('');
      onLogRequestClosed?.();
    }
    return message;
  }

  function removeRoutine(routine: SavedFlexibilityRoutine) {
    if (!window.confirm(`Delete the saved routine "${routine.name}"?`)) return;
    const result = deleteFlexibilityRoutine(savedRoutines, routine.id);
    if (result.deleted) persist(migrateFlexibilityData({ ...data, savedRoutines: result.routines }));
  }

  function toggleRegion(regionId: FlexibilityRegionId) {
    if (!draft) return;
    updateDraft({
      ...draft,
      regionIds: draft.regionIds.includes(regionId)
        ? draft.regionIds.filter(id => id !== regionId)
        : [...draft.regionIds, regionId]
    });
  }

  function chooseBodyView(nextView: 'front' | 'back') {
    if (!bodyMapConfig.regions.some(region => region.id === selectedRegion && region[nextView])) {
      const nextSelected = bodyMapConfig.regions.find(region => region[nextView]);
      if (nextSelected) setSelectedRegion(nextSelected.id);
    }
    setView(nextView);
  }

  useEffect(() => {
    if (!pendingQuickLog) return;
    if (pendingQuickLog.linkedRhythmId && pendingQuickLog.rhythmOccurrence) {
      setPendingRhythmStart({
        rhythmId: pendingQuickLog.linkedRhythmId,
        occurrence: pendingQuickLog.rhythmOccurrence,
        title: pendingQuickLog.rhythmTitle ?? 'Linked stretch Rhythm'
      });
      setLinkedRoutineId(savedRoutines[0]?.id ?? '');
      setCollectionTab('saved');
      onQuickLogOpened?.(pendingQuickLog.requestId);
      return;
    }
    openLog(pendingQuickLog.regionIds);
    onQuickLogOpened?.(pendingQuickLog.requestId);
  }, [pendingQuickLog?.requestId]);

  return (
    <div className="category-page flexibility-view strength-page">
      <FitnessScoreSummary
        category="Flexibility"
        healthTitle="Flexibility Health"
        className={`rhythm-history-view__score-card flexibility-summary${foundationNavigation ? ' foundation-health-card' : ''}`}
        consistency={consistency.score}
        onTrack={null}
        health={consistency.score}
        showMeasures={!foundationNavigation}
        consistencyCaption="Consistency with your stretch schedule."
        onTrackCaption="On Track is unavailable for Flexibility."
        overallHealthScore={overallHealthScore}
        categoryHealthScore={categoryHealthScore}
        summaryExplanation="Flexibility Health averages tracked stretch-region Consistency scores."
        statusMessage={`${consistency.trackedCount} of ${flexibilityRegions.length} stretch regions tracked`}
        scoringEvidence={flexibilityScoringEvidence}
        scoringCard={flexibilityScoringCard}
        rollup={createHealthFitnessRollup('foundations', 'flexibility')}
      />

      <section className="card strength-card strength-map-card flexibility-map-card" aria-labelledby="flexibility-map-heading">
        <header className="strength-card-heading">
          <div>
            <h2 id="flexibility-map-heading">Stretch schedule</h2>
            <p>Choose a region to see its stretch status.</p>
          </div>
          <SettingsGearButton
            label="Stretch interval settings"
            onClick={() => setDialog('settings')}
          />
        </header>
        <div className="strength-map-toolbar" role="group" aria-label="Body map view">
          {(['front', 'back'] as const).map(nextView => (
            <button key={nextView} type="button" aria-pressed={view === nextView}
              onClick={() => chooseBodyView(nextView)}>
              {nextView === 'front' ? 'Front' : 'Back'}
            </button>
          ))}
        </div>
        <FitnessBodyMapLayout
          config={bodyMapConfig}
          view={view}
          selectedId={selectedRegion}
          onSelect={setSelectedRegion}
          listLabel="Stretch schedule status"
        >
          {visibleRegions.map(region => {
            const score = scores.find(item => item.id === region.id)!;
            const nextDueLabel = flexibilityNextDueLabel(score);
            const lastStretchedLabel = flexibilityLastStretchedLabel(score);
            const scoreLabel = score.score === null ? 'unavailable' : formatScore(score.score);
            const nextDueDescription = nextDueLabel === '—'
              ? 'Next stretch unavailable.'
              : `${nextDueLabel}.`;
            return (
              <button
                key={region.id}
                type="button"
                className="strength-muscle-row flexibility-region"
                aria-pressed={selectedRegion === region.id}
                aria-label={`${region.name}. Consistency score: ${scoreLabel}. ${score.status} Last stretched: ${lastStretchedLabel}. ${nextDueDescription}`}
                onClick={() => setSelectedRegion(region.id)}
              >
                <span className="strength-muscle-row__heading">
                  <strong>{region.name}</strong>
                  <span
                    className={`strength-muscle-row__status strength-muscle-row__status--${flexibilityStatusTone(score.score)}`}
                    role="img"
                    aria-label={`Stretch status: ${score.status}`}
                    title={`Stretch status: ${score.status}`}
                  />
                </span>
                <span className="strength-muscle-row__timing">
                  <span className="strength-muscle-row__last-workout">
                    <RhythmCalendarIcon className="strength-muscle-row__calendar-icon" />
                    <span>{lastStretchedLabel}</span>
                  </span>
                  <span className="strength-muscle-row__next-due">{nextDueLabel}</span>
                </span>
              </button>
            );
          })}
        </FitnessBodyMapLayout>
        <button type="button" className="btn mini ghost" onClick={() => openLog([selectedRegion])}>
          Log {scores.find(region => region.id === selectedRegion)?.name}
        </button>
      </section>

      <section className="strength-workouts flexibility-routine-collection" aria-labelledby="flexibility-routines-heading">
        <header className="strength-card-heading strength-workouts__heading">
          <h2 id="flexibility-routines-heading">Stretch routines</h2>
        </header>
        <SegmentedTabs
          tabs={flexibilityCollectionTabs}
          selectedTabId={collectionTab}
          ariaLabel="Stretch routines"
          onChange={setCollectionTab}
        />
        <section
          id="flexibility-panel-recommended"
          className="strength-workout-panel strength-workout-panel--recommended"
          role="tabpanel"
          aria-labelledby="flexibility-tab-recommended"
          hidden={collectionTab !== 'recommended'}
        >
          {collectionTab === 'recommended' && (
            <section className="strength-workout-section" aria-labelledby="flexibility-recommended-heading">
              <header className="strength-card-heading">
                <div>
                  <h3 id="flexibility-recommended-heading">Recommended stretches</h3>
                  <p>Suggestions based on your recent stretching.</p>
                </div>
              </header>
              <div className="category-rhythm-entry-actions flexibility-routine-collection__actions">
                <button type="button" className="btn mini" onClick={() => openLog()}>
                  Custom stretch
                </button>
              </div>
              {recommendedSavedRoutines.length ? (
                <div className="strength-recommendations">
                  {recommendedSavedRoutines.map(routine => (
                    <article key={routine.id} className="strength-recommendation">
                      <div>
                        <h3>{routine.name}</h3>
                        <p>Includes {suggestion.regionIds
                          .filter(id => routine.stretches.some(stretch => stretch.regionIds.includes(id)))
                          .map(id => flexibilityRegions.find(region => region.id === id)?.name ?? id)
                          .join(', ')}, which are due for a stretch.</p>
                        <small>About {formatRoutineDuration(routine)}</small>
                      </div>
                      <button type="button" className="btn mini" onClick={() => startRoutine(routine)}>Start stretch</button>
                    </article>
                  ))}
                </div>
              ) : (
                <>
                  {suggestion.reasonRegionId !== null && (
                    <div className="strength-recommendations">
                      <article className="strength-recommendation">
                        <div>
                          <h3>Next stretch</h3>
                          <p>{suggestion.text}</p>
                        </div>
                        <button type="button" className="btn mini"
                          onClick={() => openLog(suggestion.regionIds)}>Log suggested regions</button>
                      </article>
                    </div>
                  )}
                  {savedRoutines.length === 0 && (
                    <p className="strength-empty">
                      Save a routine to get recommendations, or log a custom stretch.
                    </p>
                  )}
                </>
              )}
            </section>
          )}
        </section>
        <section
          id="flexibility-panel-saved"
          className="strength-workout-panel"
          role="tabpanel"
          aria-labelledby="flexibility-tab-saved"
          hidden={collectionTab !== 'saved'}
        >
          {collectionTab === 'saved' && (
            <section className="strength-workout-section" aria-labelledby="flexibility-saved-routines-heading">
              <header className="strength-card-heading">
                <div>
                  <h3 id="flexibility-saved-routines-heading">Saved routines</h3>
                  <p>Stretch templates are separate from recorded activity.</p>
                </div>
              </header>
              <div className="category-rhythm-entry-actions flexibility-routine-collection__actions">
                <button type="button" className="btn mini" onClick={createRoutine}>Create routine</button>
                <button type="button" className="btn mini ghost" onClick={() => setSuggestionPickerOpen(true)}>
                  Suggestions
                </button>
              </div>
              {(data.guidedSessionDraft || data.draftSession) && (
                <div className="category-rhythm-entry-actions flexibility-routine-resume">
                  {data.guidedSessionDraft && (
                    <button type="button" className="btn mini ghost" onClick={() => setDialog('guided')}>
                      Resume stretch session
                    </button>
                  )}
                  {data.draftSession && (
                    <button type="button" className="btn mini ghost" onClick={() => openLog()}>
                      Resume manual stretch log
                    </button>
                  )}
                </div>
              )}
              {pendingRhythmStart && (
                <div className="flexibility-linked-rhythm" role="group"
                  aria-label={`Start linked Rhythm ${pendingRhythmStart.title}`}>
                  <p>Choose a saved routine to complete “{pendingRhythmStart.title}”. The Rhythm stays incomplete until you finish the session.</p>
                  {savedRoutines.length ? (
                    <>
                      <label>Saved routine
                        <select aria-label="Saved routine for linked Rhythm" value={linkedRoutineId}
                          onChange={event => setLinkedRoutineId(event.currentTarget.value)}>
                          {savedRoutines.map(routine => (
                            <option key={routine.id} value={routine.id}>{routine.name}</option>
                          ))}
                        </select>
                      </label>
                      <button type="button" className="btn mini"
                        onClick={() => {
                          const routine = savedRoutines.find(item => item.id === linkedRoutineId);
                          if (routine) startRoutine(routine, pendingRhythmStart);
                        }}>
                        Start linked stretch
                      </button>
                    </>
                  ) : <p>Save a stretch routine before starting this linked Rhythm.</p>}
                </div>
              )}
              {savedRoutines.length ? (
                <div className="flexibility-routine-list">
                  {savedRoutines.map(routine => (
                    <article key={routine.id} className="strength-recommendation flexibility-routine-card">
                      <div>
                        <h3>{routine.name}</h3>
                        <p>{routine.stretches.map(stretch => stretch.name).join(' · ')}</p>
                        <small>About {formatRoutineDuration(routine)}</small>
                      </div>
                      <div className="flexibility-routine-card__actions">
                        <button type="button" className="btn mini" onClick={() => startRoutine(routine)}>Start</button>
                        <button type="button" className="btn mini ghost" onClick={() => openRoutineEditor(routine)}>Edit</button>
                        <button type="button" className="btn mini ghost" onClick={() => removeRoutine(routine)}>Delete</button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : <p className="strength-empty">No saved routines yet. Create one or choose a suggestion.</p>}
            </section>
          )}
        </section>
        <section
          id="flexibility-panel-history"
          className="strength-workout-panel"
          role="tabpanel"
          aria-labelledby="flexibility-tab-history"
          hidden={collectionTab !== 'history'}
        >
          {collectionTab === 'history' && (
            <section className="strength-workout-section flexibility-history" aria-labelledby="flexibility-history-heading">
              <header className="strength-card-heading">
                <div>
                  <h3 id="flexibility-history-heading">Stretch history</h3>
                  <p>Review your past stretches and the regions you stretched.</p>
                </div>
              </header>
              {sortedSessions.length + sortedGuidedSessions.length ? (
                <ul className="flexibility-history__list">
                  {sortedGuidedSessions.map(session => (
                    <li key={session.id} className="strength-recommendation">
                      <div>
                        <strong>{session.date} · {session.routineName}</strong>
                        <span>{session.holds.filter(hold => hold.status === 'completed').length} holds completed · {
                          session.holds.filter(hold => hold.status === 'skipped').length
                        } skipped</span>
                        <span>{[...new Set(session.holds.filter(hold => hold.status === 'completed')
                          .flatMap(hold => hold.regionIds))]
                          .map(id => flexibilityRegions.find(region => region.id === id)?.name ?? id).join(', ')}</span>
                      </div>
                    </li>
                  ))}
                  {sortedSessions.map(session => (
                    <li key={session.id} className="strength-recommendation">
                      <div>
                        <strong>{session.date} · Manual stretch</strong>
                        <span>{session.regionIds.map(id => flexibilityRegions.find(region => region.id === id)?.name ?? id).join(', ')}</span>
                        {session.minutes !== undefined && <span>{session.minutes} min</span>}
                      </div>
                      <div className="flexibility-history__actions">
                        <button type="button" className="btn mini ghost" onClick={() => openLog([], session)}>Edit</button>
                        <button type="button" className="btn mini ghost" onClick={() => deleteSession(session)}>Delete</button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <p className="strength-empty">No stretches logged yet.</p>}
            </section>
          )}
        </section>
        {routineError && <p className="flexibility-error" role="alert">{routineError}</p>}
      </section>

      {error && <p className="flexibility-error" role="alert">{error}</p>}

      {routineEditor && (
        <FlexibilityRoutineEditorDialog
          routine={routineEditor}
          onSave={saveRoutine}
          onClose={() => setRoutineEditor(null)}
        />
      )}
      {suggestionPickerOpen && (
        <MoneyGoalDialog
          title="Suggested stretch routines"
          closeLabel="Close suggested stretch routines"
          closeOnEscape
          dismissOnBackdrop
          portalToBody
          phoneFullScreen
          onClose={() => setSuggestionPickerOpen(false)}
        >
          <div className="flexibility-routine-list">
            {flexibilityRoutineSuggestions.map(routine => (
              <article key={routine.id} className="strength-recommendation flexibility-routine-card">
                <div>
                  <h3>{routine.name}</h3>
                  <p>{routine.stretches.map(stretch => stretch.name).join(' · ')}</p>
                  <small>About {formatRoutineDuration(routine)}</small>
                </div>
                <button type="button" className="btn mini ghost"
                  aria-label={`Preview and edit ${routine.name}`}
                  onClick={() => {
                    setSuggestionPickerOpen(false);
                    openRoutineEditor(routine);
                  }}>Preview &amp; edit</button>
              </article>
            ))}
          </div>
        </MoneyGoalDialog>
      )}
      {dialog === 'guided' && data.guidedSessionDraft && (
        <FlexibilityGuidedSessionDialog
          session={data.guidedSessionDraft}
          onChange={updateGuidedSession}
          onFinish={saveGuidedSession}
          onClose={() => {
            setDialog(null);
            onLogRequestClosed?.();
          }}
        />
      )}

      {dialog === 'log' && draft && (
        <MoneyGoalDialog
          title={draft.editingSessionId ? 'Edit stretch session' : 'Log a stretch'}
          closeLabel="Close stretch session"
          closeOnEscape
          dismissOnBackdrop
          portalToBody
          initialFocusId="flexibility-log-date"
          onClose={closeLog}
        >
          <form className="flexibility-form" onSubmit={saveLog}>
            <label>
              Date
              <input id="flexibility-log-date" type="date" max={today} value={draft.date}
                onChange={event => updateDraft({ ...draft, date: event.target.value })} required />
            </label>
            <fieldset>
              <legend>Stretch regions</legend>
              {groups.map(group => (
                <div key={group} className="flexibility-form__region-group">
                  <h3>{group}</h3>
                  <div>
                    {flexibilityRegions.filter(region => region.group === group).map(region => (
                      <label key={region.id} className="flexibility-checkbox">
                        <input type="checkbox" checked={draft.regionIds.includes(region.id)}
                          onChange={() => toggleRegion(region.id)} />
                        {region.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </fieldset>
            <label>
              Minutes (optional)
              <input type="number" min="1" max="1440" step="1" inputMode="numeric"
                value={draft.minutes} onChange={event => updateDraft({ ...draft, minutes: event.target.value })} />
            </label>
            <label>
              Notes (optional)
              <textarea rows={3} maxLength={1000} value={draft.notes}
                onChange={event => updateDraft({ ...draft, notes: event.target.value })} />
            </label>
            {error && <p className="flexibility-error" role="alert">{error}</p>}
            <div className="flexibility-form__actions">
              <button type="button" className="btn mini ghost" onClick={closeLog}>Cancel</button>
              <button type="submit" className="btn primary" disabled={!draft.regionIds.length}>Save stretch</button>
            </div>
          </form>
        </MoneyGoalDialog>
      )}

      {dialog === 'settings' && (
        <MoneyGoalDialog
          title="Stretch intervals"
          closeLabel="Close stretch intervals"
          closeOnEscape
          dismissOnBackdrop
          portalToBody
          onClose={() => setDialog(null)}
        >
          <form className="flexibility-settings" onSubmit={saveSettings}>
            <p>Set how many days can pass between sessions for each region.</p>
            {groups.map(group => (
              <fieldset key={group}>
                <legend>{group}</legend>
                {flexibilityRegions.filter(region => region.group === group).map(region => (
                  <label key={region.id}>
                    <span>{region.name}</span>
                    <input type="number" min="1" max="365" step="1" inputMode="numeric"
                      aria-label={`${region.name} interval in days`}
                      value={intervalDraft[region.id]}
                      onChange={event => setIntervalDraft(current => ({
                        ...current,
                        [region.id]: event.target.value
                      }))} />
                    <span>days</span>
                  </label>
                ))}
              </fieldset>
            ))}
            {error && <p className="flexibility-error" role="alert">{error}</p>}
            <div className="flexibility-form__actions">
              <button type="button" className="btn mini ghost" onClick={() => setDialog(null)}>Cancel</button>
              <button type="submit" className="btn primary">Save intervals</button>
            </div>
          </form>
        </MoneyGoalDialog>
      )}
    </div>
  );
}

function flexibilityScoreFill(score: number | null): string {
  switch (flexibilityStatusTone(score)) {
    case 'current': return 'var(--score-green)';
    case 'due': return 'var(--score-yellow)';
    case 'overdue': return 'var(--score-red)';
    case 'unavailable': return 'var(--score-neutral)';
  }
}

function flexibilityStatusTone(score: number | null): 'current' | 'due' | 'overdue' | 'unavailable' {
  if (score === null) return 'unavailable';
  return score >= 100 ? 'current' : score >= 80 ? 'due' : 'overdue';
}

function flexibilityLastStretchedLabel(region: FlexibilityRegionScore): string {
  if (region.historyState === 'invalid') return 'Unavailable';
  if (region.daysSince === null) return 'No log yet';
  if (region.daysSince === 0) return 'Today';
  return `${region.daysSince}d ago`;
}

function flexibilityNextDueLabel(region: FlexibilityRegionScore): string {
  if (region.historyState === 'invalid' || region.daysUntilDue === null) return '—';
  if (region.daysUntilDue < 0) return `Overdue by ${Math.abs(region.daysUntilDue)}d`;
  if (region.daysUntilDue === 0) return 'Due today';
  return `Next stretch in ${region.daysUntilDue}d`;
}

function formatRoutineDuration(routine: SavedFlexibilityRoutine): string {
  const seconds = estimateFlexibilityRoutineSeconds(routine);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes} min${remainder ? ` ${remainder} sec` : ''}` : `${remainder} sec`;
}
