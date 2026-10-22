import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { AppNavigation } from './components/AppNavigation.tsx';
import type { Destination, TextSize } from './components/AppNavigation.tsx';
import { MarriageView } from './components/MarriageView.tsx';
import { RhythmDetailsDialog } from './components/RhythmDetailsDialog.tsx';
import { FinanceGoalsView } from './components/FinanceGoalsView.tsx';
import { PreviewDataControls } from './components/PreviewDataControls.tsx';
import type { PreviewPersistenceStatus } from './components/PreviewDataControls.tsx';
import { PersonProfilePlaceholder } from './components/PersonProfilePlaceholder.tsx';
import { RhythmEditor } from './components/RhythmEditor.tsx';
import { TodayView } from './components/TodayView.tsx';
import {
  marriageRhythms,
  personById,
  peopleForRhythm,
  todayRhythms,
  type MarriageExampleId,
  type PersonId
} from './domain/preview-data.ts';
import {
  saveCheckIn,
  type CheckInDraft,
  type CheckInDraftErrors,
  type GoalCheckIn,
  localDateString,
  type MoneyGoal
} from './domain/money-goals.ts';
import { createSamplePreviewData, parsePreviewBackup } from './domain/preview-state.ts';
import type { PreviewData } from './domain/preview-state.ts';
import {
  activeTodayRhythms,
  archiveRhythmId,
  archivedTodayRhythms,
  isEditableRhythmId,
  resolveTodayRhythms,
  restoreRhythmId,
  rhythmsForCategory,
  saveRhythmDraft
} from './domain/rhythm-editor.ts';
import type { RhythmDraft, RhythmDraftErrors } from './domain/rhythm-editor.ts';
import {
  browserPreviewStorage,
  listenForPreviewChanges,
  loadV2RecoveryCopy,
  loadV1RecoveryCopy,
  loadPreview,
  writePreview
} from './storage/preview-storage.ts';

const destinationLabels: Record<Exclude<Destination, 'today'>, string> = {
  focus: 'Focus',
  people: 'People',
  more: 'More',
  faith: 'Faith',
  marriage: 'Marriage',
  parenting: 'Parenting',
  health: 'Health & Fitness',
  finances: 'Finances',
  friendships: 'Friendships'
};

export function App() {
  const [destination, setDestination] = useState<Destination>('today');
  const [previewData, setPreviewData] = useState<PreviewData>(createSamplePreviewData);
  const [hydrated, setHydrated] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [persistenceStatus, setPersistenceStatus] = useState<PreviewPersistenceStatus>({ kind: 'loading' });
  const [v1RecoveryCopy, setV1RecoveryCopy] = useState<string | null>(null);
  const [v1RecoveryError, setV1RecoveryError] = useState<string | null>(null);
  const [v2RecoveryCopy, setV2RecoveryCopy] = useState<string | null>(null);
  const [v2RecoveryError, setV2RecoveryError] = useState<string | null>(null);
  const expectedRaw = useRef<string | null>(null);
  const externalRaw = useRef<string | null>(null);
  const skipNextAutosave = useRef(false);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [textSize, setTextSize] = useState<TextSize>('small');
  const [marriageExampleId, setMarriageExampleId] = useState<MarriageExampleId>('populated');
  const [selectedPersonId, setSelectedPersonId] = useState<PersonId | null>(null);
  const [activeRhythmId, setActiveRhythmId] = useState<string | null>(null);
  const [rhythmEditor, setRhythmEditor] = useState<{ id: string; rhythm?: (typeof todayRhythms)[number] } | null>(null);
  const dialogOpener = useRef<HTMLButtonElement | null>(null);
  const rhythmEditorOpener = useRef<HTMLButtonElement | null>(null);
  const wasDetailsOpen = useRef(false);
  const wasRhythmEditorOpen = useRef(false);

  const dateLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).format(new Date());
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const allTodayRhythms = resolveTodayRhythms(previewData.savedRhythms);
  const editableTodayRhythms = activeTodayRhythms(allTodayRhythms, previewData.archivedRhythmIds);
  const archivedRhythms = archivedTodayRhythms(allTodayRhythms, previewData.archivedRhythmIds);
  const userRhythms = editableTodayRhythms.filter(rhythm =>
    previewData.savedRhythms.some(saved => saved.id === rhythm.id)
  );
  const marriageCategoryRhythms = rhythmsForCategory(userRhythms, 'marriage');
  const activeRhythm = [
    ...allTodayRhythms,
    ...marriageRhythms
  ].find(rhythm => rhythm.id === activeRhythmId) ?? null;
  const selectedPerson = selectedPersonId === null ? null : personById(selectedPersonId);
  const activeRhythmIsToday = activeRhythm !== null && editableTodayRhythms.some(rhythm => rhythm.id === activeRhythm.id);
  const activeRhythmIsArchived = activeRhythm !== null && previewData.archivedRhythmIds.includes(activeRhythm.id);
  const currentDate = localDateString(new Date());
  const initialLoadDate = useRef(currentDate).current;
  const completedRhythms = new Set(previewData.completedRhythmIds);
  const moneyGoals = previewData.goals;

  function refreshV1RecoveryCopy() {
    const result = loadV1RecoveryCopy(browserPreviewStorage());
    if (result.kind === 'loaded') {
      setV1RecoveryCopy(result.raw);
      setV1RecoveryError(null);
    } else {
      setV1RecoveryCopy(null);
      setV1RecoveryError(result.message);
    }
  }

  function refreshV2RecoveryCopy() {
    const result = loadV2RecoveryCopy(browserPreviewStorage());
    if (result.kind === 'loaded') {
      setV2RecoveryCopy(result.raw);
      setV2RecoveryError(null);
    } else {
      setV2RecoveryCopy(null);
      setV2RecoveryError(result.message);
    }
  }

  useEffect(() => {
    refreshV1RecoveryCopy();
    refreshV2RecoveryCopy();
    const loaded = loadPreview(browserPreviewStorage(), initialLoadDate);
    if (loaded.kind === 'loaded') {
      expectedRaw.current = loaded.raw;
      skipNextAutosave.current = true;
      setPreviewData(loaded.data);
      setPersistenceStatus({ kind: 'saved' });
      setAutoSaveEnabled(true);
    } else if (loaded.kind === 'missing') {
      expectedRaw.current = null;
      setPreviewData(createSamplePreviewData());
      setPersistenceStatus({ kind: 'saving' });
      setAutoSaveEnabled(true);
    } else if (loaded.kind === 'corrupt' || loaded.kind === 'unsupported') {
      expectedRaw.current = loaded.raw;
      setPersistenceStatus({ kind: loaded.kind, raw: loaded.raw, message: loaded.message });
    } else {
      setPersistenceStatus({ kind: 'unavailable', message: loaded.message });
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !autoSaveEnabled) return;
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    const saved = writePreview(browserPreviewStorage(), previewData, expectedRaw.current);
    refreshV1RecoveryCopy();
    refreshV2RecoveryCopy();
    if (saved.kind === 'saved') {
      expectedRaw.current = saved.raw;
      setPersistenceStatus({ kind: 'saved' });
    } else if (saved.kind === 'conflict') {
      externalRaw.current = saved.actualRaw;
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'conflict' });
    } else {
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'error', message: saved.message });
    }
  }, [previewData, hydrated, autoSaveEnabled]);

  useEffect(() => {
    if (!hydrated) return;
    return listenForPreviewChanges(newValue => {
      if (newValue === expectedRaw.current) return;
      externalRaw.current = newValue;
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'conflict' });
    });
  }, [hydrated]);

  useEffect(() => {
    document.documentElement.dataset.mobileTextSize = textSize === 'small' ? 'normal' : textSize === 'medium' ? 'large' : 'larger';
    document.documentElement.dataset.mobileTextSizeLevel = textSize === 'large' ? 'larger' : textSize;
  }, [textSize]);

  useEffect(() => {
    if (activeRhythmId) {
      wasDetailsOpen.current = true;
      return;
    }
    if (!wasDetailsOpen.current) return;
    wasDetailsOpen.current = false;
    if (dialogOpener.current?.isConnected) dialogOpener.current.focus();
    else document.querySelector<HTMLButtonElement>('.utility-primary-button[aria-current="page"]')?.focus();
  }, [activeRhythmId]);

  useEffect(() => {
    if (rhythmEditor) {
      wasRhythmEditorOpen.current = true;
      return;
    }
    if (!wasRhythmEditorOpen.current) return;
    wasRhythmEditorOpen.current = false;
    if (rhythmEditorOpener.current?.isConnected) rhythmEditorOpener.current.focus();
  }, [rhythmEditor]);

  function navigate(next: Destination, personId?: PersonId) {
    setDestination(next);
    setSelectedPersonId(personId ?? null);
    setSearch('');
    setSearchOpen(false);
    document.body.classList.remove('mobile-search-open');
  }

  function closeSearch() {
    setSearch('');
    setSearchOpen(false);
    document.body.classList.remove('mobile-search-open');
  }

  function toggleSearch() {
    const next = !searchOpen;
    setSearchOpen(next);
    document.body.classList.toggle('mobile-search-open', next);
    if (!next) setSearch('');
  }

  function openDetails(id: string, event: MouseEvent<HTMLButtonElement>) {
    dialogOpener.current = event.currentTarget;
    setActiveRhythmId(id);
  }

  function openRhythmEditor(event: MouseEvent<HTMLButtonElement>, rhythm?: (typeof todayRhythms)[number]) {
    rhythmEditorOpener.current = event.currentTarget;
    setRhythmEditor({
      id: rhythm?.id ?? `user-rhythm-${globalThis.crypto.randomUUID()}`,
      ...(rhythm ? { rhythm } : {})
    });
  }

  function saveRhythm(draft: RhythmDraft): RhythmDraftErrors {
    if (!rhythmEditor) return { title: 'The Rhythm editor is no longer active.' };
    const result = saveRhythmDraft(
      previewData.savedRhythms,
      draft,
      rhythmEditor.id,
      rhythmEditor.rhythm ? 'edit' : 'create'
    );
    const savedRhythms = result.savedRhythms;
    if (!savedRhythms) return result.errors;
    setPreviewData(previous => ({
      ...previous,
      savedRhythms
    }));
    setRhythmEditor(null);
    return result.errors;
  }

  function archiveRhythm(id: string) {
    setPreviewData(previous => {
      const archivedRhythmIds = archiveRhythmId(previous.savedRhythms, previous.archivedRhythmIds, id);
      return archivedRhythmIds
        ? { ...previous, archivedRhythmIds }
        : previous;
    });
    setRhythmEditor(null);
  }

  function restoreRhythm(id: string) {
    setPreviewData(previous => {
      const archivedRhythmIds = restoreRhythmId(previous.savedRhythms, previous.archivedRhythmIds, id);
      return archivedRhythmIds
        ? { ...previous, archivedRhythmIds }
        : previous;
    });
  }

  function tend(id: string) {
    setPreviewData(previous => {
      if (previous.completedRhythmIds.includes(id)
        || !resolveTodayRhythms(previous.savedRhythms).some(rhythm => rhythm.id === id)) return previous;
      return {
        ...previous,
        completedRhythmIds: [...previous.completedRhythmIds, id]
      };
    });
  }

  function undoTend(id: string) {
    setPreviewData(previous => {
      const completionIndex = previous.completedRhythmIds.indexOf(id);
      if (completionIndex === -1
        || !resolveTodayRhythms(previous.savedRhythms).some(rhythm => rhythm.id === id)) return previous;
      return {
        ...previous,
        completedRhythmIds: [
          ...previous.completedRhythmIds.slice(0, completionIndex),
          ...previous.completedRhythmIds.slice(completionIndex + 1)
        ]
      };
    });
  }

  function saveGoal(goal: MoneyGoal) {
    setPreviewData(previous => ({
      ...previous,
      goals: previous.goals.some(item => item.id === goal.id)
        ? previous.goals.map(item => item.id === goal.id ? goal : item)
        : [...previous.goals, goal]
    }));
  }

  function saveGoalCheckIn(
    goalId: string,
    draft: CheckInDraft,
    correctingCheckIn?: GoalCheckIn
  ): CheckInDraftErrors {
    const goal = previewData.goals.find(item => item.id === goalId);
    if (!goal) return { balance: 'This example goal is no longer available.' };
    const result = saveCheckIn(goal, draft, new Date().toISOString(), currentDate, correctingCheckIn);
    const updatedGoal = result.goal;
    if (updatedGoal) {
      setPreviewData(previous => ({
        ...previous,
        goals: previous.goals.map(item => item.id === goalId ? updatedGoal : item)
      }));
    }
    return result.errors;
  }

  function finishWrite(resultData: PreviewData): string | null {
    const written = writePreview(browserPreviewStorage(), resultData, expectedRaw.current);
    refreshV1RecoveryCopy();
    refreshV2RecoveryCopy();
    if (written.kind === 'saved') {
      expectedRaw.current = written.raw;
      externalRaw.current = null;
      skipNextAutosave.current = true;
      setPreviewData(resultData);
      setAutoSaveEnabled(true);
      setPersistenceStatus({ kind: 'saved' });
      return null;
    }
    if (written.kind === 'conflict') {
      externalRaw.current = written.actualRaw;
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'conflict' });
      return 'Preview storage changed in another tab. No data was replaced.';
    }
    setAutoSaveEnabled(false);
    setPersistenceStatus({ kind: 'error', message: written.message });
    return written.message;
  }

  function reloadExternal(): string | null {
    const raw = externalRaw.current;
    if (raw === null) {
      expectedRaw.current = null;
      return finishWrite(createSamplePreviewData());
    }
    const parsed = parsePreviewBackup(raw, currentDate);
    if (!parsed.valid) {
      expectedRaw.current = raw;
      externalRaw.current = null;
      setAutoSaveEnabled(false);
      setPersistenceStatus({
        kind: parsed.kind === 'unsupported' ? 'unsupported' : 'corrupt',
        raw,
        message: parsed.message
      });
      return parsed.message;
    }
    expectedRaw.current = raw;
    externalRaw.current = null;
    skipNextAutosave.current = true;
    setPreviewData(parsed.envelope.data);
    setAutoSaveEnabled(true);
    setPersistenceStatus({ kind: 'saved' });
    return null;
  }

  function replaceExternal(): string | null {
    const written = writePreview(browserPreviewStorage(), previewData, externalRaw.current);
    refreshV1RecoveryCopy();
    refreshV2RecoveryCopy();
    if (written.kind === 'saved') {
      expectedRaw.current = written.raw;
      externalRaw.current = null;
      skipNextAutosave.current = true;
      setAutoSaveEnabled(true);
      setPersistenceStatus({ kind: 'saved' });
      return null;
    }
    if (written.kind === 'conflict') {
      externalRaw.current = written.actualRaw;
      setPersistenceStatus({ kind: 'conflict' });
      return 'Preview storage changed again in another tab. No data was replaced.';
    }
    setPersistenceStatus({ kind: 'error', message: written.message });
    return written.message;
  }

  function retrySave() {
    skipNextAutosave.current = true;
    setAutoSaveEnabled(true);
    const written = writePreview(browserPreviewStorage(), previewData, expectedRaw.current);
    refreshV1RecoveryCopy();
    refreshV2RecoveryCopy();
    if (written.kind === 'saved') {
      expectedRaw.current = written.raw;
      setPersistenceStatus({ kind: 'saved' });
    } else if (written.kind === 'conflict') {
      externalRaw.current = written.actualRaw;
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'conflict' });
    } else {
      setAutoSaveEnabled(false);
      setPersistenceStatus({ kind: 'error', message: written.message });
    }
  }

  return (
    <div className="wrap tend-app-preview" data-text-size={textSize}>
      <AppNavigation
        destination={destination}
        search={search}
        searchOpen={searchOpen}
        textSize={textSize}
        onNavigate={navigate}
        onSearchChange={setSearch}
        onSearchClose={closeSearch}
        onSearchToggle={toggleSearch}
        onTextSizeChange={() => setTextSize(size => size === 'small' ? 'medium' : size === 'medium' ? 'large' : 'small')}
      />
      <div id="view">
        {!hydrated
          ? <p role="status">Loading saved preview data…</p>
          : destination === 'today'
          ? (
            <TodayView
              greeting={greeting}
              dateLabel={dateLabel}
              completedRhythms={completedRhythms}
              rhythms={editableTodayRhythms}
              archivedRhythms={archivedRhythms}
              search={search}
              marriageExampleId={marriageExampleId}
              onNavigate={navigate}
              onMarriageExampleChange={setMarriageExampleId}
              onPersonSelect={personId => navigate('people', personId)}
              onDetails={openDetails}
              onTend={tend}
              onUndo={undoTend}
              onAddRhythm={event => openRhythmEditor(event)}
              onRestoreRhythm={restoreRhythm}
            />
          )
          : destination === 'marriage'
            ? (
              <MarriageView
                marriageExampleId={marriageExampleId}
                onMarriageExampleChange={setMarriageExampleId}
                onPersonSelect={personId => navigate('people', personId)}
                onPartnerProfile={() => navigate('people')}
                userRhythms={marriageCategoryRhythms}
                completedRhythms={completedRhythms}
                onRhythmDetails={(id, event) => {
                  dialogOpener.current = event.currentTarget;
                  setActiveRhythmId(id);
                }}
                onTend={tend}
                onUndo={undoTend}
              />
            )
          : destination === 'finances'
            ? (
              <FinanceGoalsView
                goals={moneyGoals}
                currentDate={currentDate}
                onSaveGoal={saveGoal}
                onSaveCheckIn={saveGoalCheckIn}
                onToday={() => navigate('today')}
              />
            )
          : destination === 'people' && selectedPerson
            ? <PersonProfilePlaceholder person={selectedPerson} backLabel="Today" onBack={() => navigate('today')} />
          : <PlaceholderPage destination={destination} onToday={() => navigate('today')} />}
      </div>
      <PreviewDataControls
        data={previewData}
        status={persistenceStatus}
        currentDate={currentDate}
        onImport={data => finishWrite(data)}
        onReset={() => finishWrite(createSamplePreviewData())}
        onRetrySave={retrySave}
        onReloadExternal={reloadExternal}
        onReplaceExternal={replaceExternal}
        v1RecoveryCopy={v1RecoveryCopy}
        v1RecoveryError={v1RecoveryError}
        v2RecoveryCopy={v2RecoveryCopy}
        v2RecoveryError={v2RecoveryError}
      />
      <footer className="preview-footer">
        <span>Synthetic preview data stays separate from Tend accounts.</span>
        <a href="/preview.html">Component catalogue</a>
      </footer>
      {activeRhythm && (
        <RhythmDetailsDialog
          rhythm={activeRhythm}
          people={peopleForRhythm(activeRhythm)}
          archived={activeRhythmIsArchived}
          onPersonSelect={personId => {
            setActiveRhythmId(null);
            dialogOpener.current = null;
            navigate('people', personId);
          }}
          {...(activeRhythmIsToday
            ? {
                completed: completedRhythms.has(activeRhythm.id),
                onTend: () => tend(activeRhythm.id),
                onUndo: () => undoTend(activeRhythm.id),
                ...(isEditableRhythmId(activeRhythm.id)
                  ? { onEdit: event => openRhythmEditor(event, activeRhythm) }
                  : {})
              }
            : {
                completed: completedRhythms.has(activeRhythm.id)
              })}
          onClose={() => setActiveRhythmId(null)}
        />
      )}
      {rhythmEditor && (
        <RhythmEditor
          {...(rhythmEditor.rhythm ? { rhythm: rhythmEditor.rhythm } : {})}
          onSave={saveRhythm}
          {...(rhythmEditor.rhythm ? { onArchive: archiveRhythm } : {})}
          onClose={() => setRhythmEditor(null)}
        />
      )}
    </div>
  );
}

function PlaceholderPage({ destination, onToday }: { destination: Exclude<Destination, 'today'>; onToday: () => void }) {
  return (
    <main className="category-page preview-placeholder" aria-labelledby="placeholder-title">
      <header className="category-page-heading">
        <h2 id="placeholder-title">{destinationLabels[destination]}</h2>
        <span className="hint">This destination is not implemented in this preview.</span>
      </header>
      <section className="card placeholder-card">
        <p className="empty">Only the Today view is active. This preview uses sample data and does not connect to your Tend account.</p>
        <button type="button" className="btn mini" onClick={onToday}>Back to Today</button>
      </section>
    </main>
  );
}
