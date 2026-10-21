import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { AppNavigation } from './components/AppNavigation.tsx';
import type { Destination, TextSize } from './components/AppNavigation.tsx';
import { RhythmDetailsDialog } from './components/RhythmDetailsDialog.tsx';
import { FinanceGoalsView } from './components/FinanceGoalsView.tsx';
import { PreviewDataControls } from './components/PreviewDataControls.tsx';
import type { PreviewPersistenceStatus } from './components/PreviewDataControls.tsx';
import { TodayView } from './components/TodayView.tsx';
import { todayRhythms } from './domain/preview-data.ts';
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
  browserPreviewStorage,
  listenForPreviewChanges,
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
  const expectedRaw = useRef<string | null>(null);
  const externalRaw = useRef<string | null>(null);
  const skipNextAutosave = useRef(false);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [textSize, setTextSize] = useState<TextSize>('small');
  const [activeRhythmId, setActiveRhythmId] = useState<string | null>(null);
  const dialogOpener = useRef<HTMLButtonElement | null>(null);

  const dateLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).format(new Date());
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const activeRhythm = todayRhythms.find(rhythm => rhythm.id === activeRhythmId) ?? null;
  const currentDate = localDateString(new Date());
  const initialLoadDate = useRef(currentDate).current;
  const completedRhythms = new Set(previewData.completedRhythmIds);
  const moneyGoals = previewData.goals;

  useEffect(() => {
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
    if (!activeRhythmId) dialogOpener.current?.focus();
  }, [activeRhythmId]);

  function navigate(next: Destination) {
    setDestination(next);
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

  function tend(id: string) {
    setPreviewData(previous => {
      if (previous.completedRhythmIds.includes(id)) return previous;
      return {
        ...previous,
        completedRhythmIds: [...previous.completedRhythmIds, id]
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
              search={search}
              onNavigate={navigate}
              onTend={tend}
              onDetails={openDetails}
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
      />
      <footer className="preview-footer">
        <span>Synthetic preview data stays separate from Tend accounts.</span>
        <a href="/preview.html">Component catalogue</a>
      </footer>
      {activeRhythm && (
        <RhythmDetailsDialog
          rhythm={activeRhythm}
          completed={completedRhythms.has(activeRhythm.id)}
          onTend={() => tend(activeRhythm.id)}
          onClose={() => setActiveRhythmId(null)}
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
