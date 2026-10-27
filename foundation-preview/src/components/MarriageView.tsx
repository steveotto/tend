import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import {
  marriageExampleFixtures,
  marriageRhythmGroups,
  marriageScoreCoverage,
  marriageWeekDays,
  peopleForRhythm,
  type PersonId,
  type MarriageExampleId,
  type MarriageFixture,
  type RhythmPreview,
  rhythmsSupportingFoundation
} from '../domain/preview-data.ts';
import type { FoundationRhythmAssociationChange } from '../domain/foundation-rhythm-associations.ts';
import { selectFoundationScore } from '../domain/foundation-scoring.ts';
import type { FoundationScoreSelection } from '../domain/foundation-scoring.ts';
import type { RhythmScoreResult } from '../domain/rhythm-scoring.ts';
import { FoundationCard, RhythmCard, ScoreMeter } from './Cards.tsx';
import { FoundationRhythmAssociationDialog } from './FoundationRhythmAssociationDialog.tsx';
import { MarriageIcon } from './MarriageIcon.tsx';
import { MarriageExampleSelector } from './MarriageExampleSelector.tsx';

type MarriageTab = 'today' | 'rhythms' | 'foundations';

type MarriageViewProps = {
  marriageExampleId: MarriageExampleId;
  onMarriageExampleChange: (id: MarriageExampleId) => void;
  onPersonSelect: (personId: PersonId) => void;
  onPartnerProfile: () => void;
  onRhythmDetails: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  userRhythms: readonly RhythmPreview[];
  foundationRhythms: readonly RhythmPreview[];
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
};

const tabs: { id: MarriageTab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'rhythms', label: 'Rhythms' },
  { id: 'foundations', label: 'Foundations' }
];

export function MarriageView({
  marriageExampleId,
  onMarriageExampleChange,
  onPersonSelect,
  onPartnerProfile,
  onRhythmDetails,
  userRhythms,
  foundationRhythms,
  foundationRhythmScores,
  archivedRhythmIds,
  completedRhythms,
  undoableRhythms,
  onTend,
  onUndo,
  onSaveFoundationAssociations
}: MarriageViewProps) {
  const [activeTab, setActiveTab] = useState<MarriageTab>('today');
  const [selectedFoundationId, setSelectedFoundationId] = useState<string | null>(null);
  const [associationFoundationId, setAssociationFoundationId] = useState<string | null>(null);
  const foundationOpener = useRef<string | null>(null);
  const associationOpener = useRef<HTMLButtonElement | null>(null);
  const wasAssociationDialogOpen = useRef(false);
  const fixture = marriageExampleFixtures[marriageExampleId];
  const associationFoundation = fixture.foundations.find(item => item.id === associationFoundationId);

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
    if (selectedFoundationId) {
      document.getElementById('marriage-foundation-detail-title')?.focus();
    } else if (foundationOpener.current) {
      document.getElementById(foundationOpener.current)?.focus();
      foundationOpener.current = null;
    }
  }, [selectedFoundationId]);

  function openFoundation(id: string, openerId: string) {
    foundationOpener.current = openerId;
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
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`#marriage-tab-${next.id}`)?.focus();
  }

  function selectTab(tab: MarriageTab) {
    setActiveTab(tab);
    setSelectedFoundationId(null);
    foundationOpener.current = null;
  }

  function selectExample(id: MarriageExampleId) {
    onMarriageExampleChange(id);
    setSelectedFoundationId(null);
    foundationOpener.current = null;
  }

  function openAssociationDialog(id: string, event: MouseEvent<HTMLButtonElement>) {
    associationOpener.current = event.currentTarget;
    setAssociationFoundationId(id);
  }

  const todayRhythms = fixture.rhythms.filter(rhythm => rhythm.status === 'Due today');

  return (
    <main className="category-page marriage-page" aria-labelledby="marriage-title">
      <header className="category-page-heading marriage-page-heading">
        <div className="marriage-heading-copy">
          <h2 id="marriage-title">Marriage</h2>
          <p>Structure beats good intentions.</p>
        </div>
        <button type="button" className="marriage-spouse-shortcut" onClick={onPartnerProfile}>
          <span className="marriage-partner-avatar" aria-hidden="true">P</span>
          <span>Your partner</span>
          <span className="marriage-spouse-shortcut-chevron" aria-hidden="true">›</span>
        </button>
        <span className="marriage-sample-tag">Synthetic example</span>
      </header>

      <MarriageExampleSelector value={marriageExampleId} onChange={selectExample} />

      <MarriageSummary fixture={fixture} />

      <div className="faith-view-nav marriage-view-nav" role="tablist" aria-label="Marriage content">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`marriage-tab-${tab.id}`}
            aria-controls={`marriage-panel-${tab.id}`}
            aria-selected={activeTab === tab.id}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => selectTab(tab.id)}
            onKeyDown={event => handleTabKeyDown(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section
        className="marriage-view-panel"
        id="marriage-panel-today"
        role="tabpanel"
        aria-labelledby="marriage-tab-today"
        hidden={activeTab !== 'today'}
      >
        <TodayTogether fixture={fixture} rhythms={todayRhythms} onRhythmDetails={onRhythmDetails} onPersonSelect={onPersonSelect} />
      </section>

      <section
        className="marriage-view-panel"
        id="marriage-panel-rhythms"
        role="tabpanel"
        aria-labelledby="marriage-tab-rhythms"
        hidden={activeTab !== 'rhythms'}
      >
        <RhythmSuggestions
          fixture={fixture}
          userRhythms={userRhythms}
          completedRhythms={completedRhythms}
          undoableRhythms={undoableRhythms}
          onTend={onTend}
          onUndo={onUndo}
          onRhythmDetails={onRhythmDetails}
          onPersonSelect={onPersonSelect}
        />
      </section>

      <section
        className="marriage-view-panel"
        id="marriage-panel-foundations"
        role="tabpanel"
        aria-labelledby="marriage-tab-foundations"
        hidden={activeTab !== 'foundations'}
      >
        <FoundationList
          fixture={fixture}
          rhythms={foundationRhythms}
          rhythmScores={foundationRhythmScores}
          archivedRhythmIds={archivedRhythmIds}
          selectedFoundationId={selectedFoundationId}
          onSelect={openFoundation}
          onBack={() => setSelectedFoundationId(null)}
          onManage={openAssociationDialog}
          onRhythmDetails={onRhythmDetails}
          onPersonSelect={onPersonSelect}
        />
      </section>
      {associationFoundation && (
        <FoundationRhythmAssociationDialog
          key={associationFoundation.id}
          foundation={associationFoundation}
          rhythms={foundationRhythms.map(rhythm => ({
            rhythm,
            archived: archivedRhythmIds.includes(rhythm.id)
          }))}
          onSave={changes => onSaveFoundationAssociations(associationFoundation.id, changes)}
          onClose={() => setAssociationFoundationId(null)}
        />
      )}
    </main>
  );
}

function MarriageSummary({ fixture }: { fixture: MarriageFixture }) {
  const { summary } = fixture;
  const rhythmCoverage = marriageScoreCoverage(fixture.rhythms.map(rhythm => rhythm.illustrativeScore));
  const foundationCoverage = marriageScoreCoverage(fixture.foundations.map(foundation => foundation.illustrativeScore));
  return (
    <section className="card category-health-card marriage-summary-card" aria-labelledby="marriage-health-heading">
      <div className="category-health-heading">
        <div className="category-health-copy">
          <h3 id="marriage-health-heading">Overall Marriage health</h3>
          <p className="category-health-status">
            {summary.overallScore === null ? 'No sample scores available in this example.' : 'Illustrative sample values · not calculated'}
          </p>
        </div>
        <span
          className={`category-health-score${summary.overallScore === null ? ' neutral' : ''}`}
          aria-label={summary.overallScore === null ? 'Marriage sample score unavailable' : `Illustrative Marriage sample score ${summary.overallScore}`}
        >
          {summary.overallScore ?? '—'}
        </span>
      </div>
      <ScoreMeter
        label={summary.overallScore === null
          ? 'Marriage sample score unavailable'
          : 'Illustrative Marriage sample score, not calculated'}
        score={summary.overallScore}
          markerPlacement="below"
      />
      <div className="health-summary-breakdown" role="group" aria-label="Marriage summary measures">
        <SummaryMeasure label="Rhythms" score={summary.rhythmScore} coverage={rhythmCoverage} />
        <SummaryMeasure label="Foundations" score={summary.foundationScore} coverage={foundationCoverage} />
      </div>
    </section>
  );
}

function SummaryMeasure({
  label,
  score,
  coverage
}: {
  label: string;
  score: number | null;
  coverage: { scored: number; total: number };
}) {
  return (
    <div className="health-summary-item">
      <span className={`health-summary-score${score === null ? ' neutral' : ''}`} aria-label={score === null ? `${label} illustrative score unavailable` : `${label} illustrative sample score ${score}`}>
        {score ?? '—'}
      </span>
      <span className="health-summary-label">{label}</span>
      <span className="health-summary-detail">
        {coverage.total === 0
          ? `No sample ${label.toLowerCase()} are available`
          : `${coverage.scored} of ${coverage.total} ${label.toLowerCase()} have illustrative values`}
      </span>
    </div>
  );
}

function TodayTogether({
  fixture,
  rhythms,
  onRhythmDetails,
  onPersonSelect
}: {
  fixture: MarriageFixture;
  rhythms: MarriageFixture['rhythms'];
  onRhythmDetails: MarriageViewProps['onRhythmDetails'];
  onPersonSelect: MarriageViewProps['onPersonSelect'];
}) {
  return (
    <>
      {fixture.today
        ? (
          <section className="marriage-daily-card" aria-labelledby="marriage-invitation-title">
            <div className="marriage-daily-heading">
              <div>
                <span className="marriage-daily-eyebrow">A small invitation · example</span>
                <h3 id="marriage-invitation-title">Daily Connection</h3>
              </div>
              <span className="marriage-sample-tag">Read-only</span>
            </div>
            <div className="marriage-daily-topic">
              <span className="marriage-topic-icon"><MarriageIcon group="rhythms" id="daily-connection" /></span>
              <span><span className="marriage-daily-prompt-label">Today’s topic</span><strong>{fixture.today.topic}</strong></span>
            </div>
            <div className="marriage-daily-prompt-inset">
              <p className="marriage-daily-prompt">{fixture.today.prompt}</p>
            </div>
            <WeeklyStrip fixture={fixture} />
            <p className="marriage-readonly-note">Tending, editing the prompt, and changing settings are unavailable in this synthetic preview.</p>
          </section>
        )
        : <p className="marriage-empty-state">No sample invitation or topic is available.</p>}

      <section className="marriage-today-section" aria-labelledby="marriage-today-together-title">
        <div className="marriage-section-heading">
          <div>
            <h3 id="marriage-today-together-title">Today together</h3>
            <p>Read-only sample Rhythms planned for today.</p>
          </div>
          <span className="marriage-sample-tag">Examples</span>
        </div>
        {rhythms.length > 0
          ? (
            <div className="marriage-rhythm-list">
              {rhythms.map(rhythm => (
                <RhythmCard
                  key={rhythm.id}
                  rhythm={rhythm}
                  people={peopleForRhythm(rhythm)}
                  onPersonSelect={onPersonSelect}
                  variant="simple"
                  headingId={`marriage-today-rhythm-${rhythm.id}`}
                  onDetails={event => onRhythmDetails(rhythm.id, event)}
                />
              ))}
            </div>
          )
          : <p className="marriage-empty-state">No sample Rhythms are planned for today.</p>}
      </section>
    </>
  );
}

function WeeklyStrip({ fixture }: { fixture: MarriageFixture }) {
  const days = marriageWeekDays(fixture);
  const completed = days.filter(day => day.state === 'sample' || day.state === 'today-sample').length;
  return (
    <section className="marriage-weekly-goal" aria-label="Example activity this week">
      <div className="marriage-weekly-heading">
        <h3>Weekly connection</h3>
        <span className="marriage-sample-tag">
          Sample week · {formatDate(fixture.week.startDate)}–{formatDate(days[6]!.date)}
        </span>
      </div>
      <p className="marriage-weekly-progress">{completed} of {fixture.week.target} sample connections this week</p>
      <div className="marriage-weekday-strip" role="group" aria-label="Synthetic example activity by day">
        {days.map(day => (
          <span
            key={day.date}
            className={`marriage-weekday${day.state === 'sample' || day.state === 'today-sample' ? ' is-complete' : ''}${day.state === 'today' || day.state === 'today-sample' ? ' is-today' : ''}`}
            aria-label={`${formatDay(day.date)}: ${day.state === 'sample' || day.state === 'today-sample' ? 'sample activity' : day.state === 'today' ? 'today' : 'no sample activity'}`}
          >
            {day.label}
          </span>
        ))}
      </div>
    </section>
  );
}

function RhythmSuggestions({
  fixture,
  userRhythms,
  completedRhythms,
  undoableRhythms,
  onTend,
  onUndo,
  onRhythmDetails,
  onPersonSelect
}: {
  fixture: MarriageFixture;
  userRhythms: readonly RhythmPreview[];
  completedRhythms: ReadonlySet<string>;
  undoableRhythms: ReadonlySet<string>;
  onTend: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onUndo: (id: string) => void;
  onRhythmDetails: MarriageViewProps['onRhythmDetails'];
  onPersonSelect: MarriageViewProps['onPersonSelect'];
}) {
  return (
    <section className="marriage-rhythm-section" aria-labelledby="marriage-rhythm-section-title">
      <div className="marriage-section-heading">
        <div>
          <h3 id="marriage-rhythm-section-title">Explore Marriage Rhythms</h3>
          <p>Suggestions for small, intentional investments in your relationship.</p>
        </div>
        <span className="marriage-sample-tag">Synthetic examples</span>
      </div>
      <p className="marriage-readonly-note">These suggestions are not added or scheduled. Editing and adding Rhythms are unavailable in this preview.</p>
      {userRhythms.length > 0 && (
        <section className="marriage-user-rhythms" aria-labelledby="marriage-user-rhythms-title">
          <div className="marriage-section-heading">
            <div>
              <h3 id="marriage-user-rhythms-title">Your Rhythms</h3>
              <p>Preview Rhythms assigned to Marriage.</p>
            </div>
            <span className="marriage-sample-tag">Synthetic</span>
          </div>
          <div className="marriage-rhythm-list">
            {userRhythms.map(rhythm => (
              <RhythmCard
                key={rhythm.id}
                rhythm={rhythm}
                people={peopleForRhythm(rhythm)}
                onPersonSelect={onPersonSelect}
                variant="simple"
                completed={completedRhythms.has(rhythm.id)}
                headingId={`marriage-user-rhythm-${rhythm.id}`}
                onDetails={event => onRhythmDetails(rhythm.id, event)}
                onTend={event => onTend(rhythm.id, event)}
                {...(undoableRhythms.has(rhythm.id) ? { onUndo: () => onUndo(rhythm.id) } : {})}
              />
            ))}
          </div>
        </section>
      )}
      {marriageRhythmGroups.map(group => {
        const rhythms = fixture.rhythms.filter(rhythm => rhythm.marriageGroup === group.id);
        return (
          <section key={group.id} className="marriage-recommendation-group" aria-labelledby={`marriage-group-${group.id}`}>
            <header><h4 id={`marriage-group-${group.id}`}>{group.title}</h4><span>{rhythms.length} suggested</span></header>
            {rhythms.length
              ? (
                <div className="marriage-rhythm-list">
                  {rhythms.map(rhythm => (
                    <RhythmCard
                      key={rhythm.id}
                      rhythm={rhythm}
                      people={peopleForRhythm(rhythm)}
                      onPersonSelect={onPersonSelect}
                      variant="suggestion"
                      icon={<MarriageIcon group="rhythms" id={rhythm.iconId ?? ''} />}
                      headingId={`marriage-suggested-rhythm-${rhythm.id}`}
                      onDetails={event => onRhythmDetails(rhythm.id, event)}
                    />
                  ))}
                </div>
              )
              : <p className="marriage-empty-state">No sample suggestions in this group.</p>}
          </section>
        );
      })}
    </section>
  );
}

function FoundationList({
  fixture,
  rhythms,
  rhythmScores,
  archivedRhythmIds,
  selectedFoundationId,
  onSelect,
  onBack,
  onManage,
  onRhythmDetails,
  onPersonSelect
}: {
  fixture: MarriageFixture;
  rhythms: readonly RhythmPreview[];
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>;
  archivedRhythmIds: readonly string[];
  selectedFoundationId: string | null;
  onSelect: (id: string, openerId: string) => void;
  onBack: () => void;
  onManage: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onRhythmDetails: MarriageViewProps['onRhythmDetails'];
  onPersonSelect: MarriageViewProps['onPersonSelect'];
}) {
  const [scoreInfoExpanded, setScoreInfoExpanded] = useState(false);
  const scoreInfoId = useId();
  const foundationScores = new Map(fixture.foundations.map(foundation => [
    foundation.id,
    selectFoundationScore(foundation.id, rhythms, rhythmScores, archivedRhythmIds)
  ]));
  const selectedFoundation = fixture.foundations.find(item => item.id === selectedFoundationId);
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
    <section className="marriage-foundations-section" aria-labelledby="marriage-foundations-title">
      <div className="marriage-section-heading">
        <div>
          <h3 id="marriage-foundations-title">Marriage foundations</h3>
          <p>
            {fixture.id === 'empty'
              ? 'Ongoing areas of care; scores are unavailable without scored linked Rhythms.'
              : 'Ongoing areas of care.'}
          </p>
        </div>
        <button
          type="button"
          className="rhythm-history-view__score-info"
          aria-label={`${scoreInfoExpanded ? 'Hide' : 'Show'} Foundation scoring explanation`}
          aria-expanded={scoreInfoExpanded}
          aria-controls={scoreInfoId}
          onClick={() => setScoreInfoExpanded(expanded => !expanded)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <circle cx="8" cy="8" r="6.25" />
            <path d="M8 7.2v4M8 4.8h.01" />
          </svg>
        </button>
        <span className="marriage-sample-tag">Synthetic examples</span>
      </div>
      <p id={scoreInfoId} className="marriage-foundation-score-info__copy" hidden={!scoreInfoExpanded}>
        Linked Rhythms with both scores contribute equally. Foundation Consistency and On Track are
        averaged over the same Rhythms; Health blends them 75% Consistency and 25% On Track.
      </p>
      {selectedFoundation
        ? (
          <section className="marriage-foundation-detail" aria-labelledby="marriage-foundation-detail-title">
            <button type="button" className="marriage-back-link" onClick={onBack}>
              ‹ All Foundations
            </button>
            <FoundationCard
              foundation={selectedFoundation}
              variant="compact"
              icon={<MarriageIcon group="foundations" id={selectedFoundation.iconId ?? selectedFoundation.id} />}
              headingId="marriage-foundation-detail-title"
              score={selectedFoundationScore?.health ?? null}
              scoreLabel={`${selectedFoundation.name} Foundation Health score`}
              {...(selectedScoreEvidence !== undefined
                ? { scoreEvidence: selectedScoreEvidence }
                : {})}
            >
              <div className="marriage-foundation-support">
                <div className="marriage-foundation-support__heading">
                  <h3>Linked Rhythms · {linkedRhythms.length}</h3>
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
                      title={`Linked Rhythms · ${linkedRhythms.length}`}
                      rhythms={linkedRhythms}
                      archivedRhythmIds={archivedRhythmIds}
                      onRhythmDetails={onRhythmDetails}
                      onPersonSelect={onPersonSelect}
                    />
                  )
                  : <p>No Rhythms are linked to this ongoing Foundation yet.</p>}
              </div>
            </FoundationCard>
          </section>
        )
        : (
          <div className="marriage-foundation-list">
            {fixture.foundations.map(foundation => {
              const score = foundationScores.get(foundation.id);
              const scoreEvidence = score ? foundationScoreEvidence(score) : undefined;
              return (
                <FoundationCard
                  key={foundation.id}
                  foundation={foundation}
                  variant="compact"
                  icon={<MarriageIcon group="foundations" id={foundation.iconId ?? foundation.id} />}
                  score={score?.health ?? null}
                  scoreLabel={`${foundation.name} Foundation Health score`}
                  {...(scoreEvidence !== undefined
                    ? { scoreEvidence }
                    : {})}
                  headingId={`marriage-foundation-list-${foundation.id}`}
                  selectButtonId={`marriage-foundation-select-${foundation.id}`}
                  onSelect={() => onSelect(foundation.id, `marriage-foundation-select-${foundation.id}`)}
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
  title,
  rhythms,
  archivedRhythmIds,
  onRhythmDetails,
  onPersonSelect
}: {
  title: string;
  rhythms: MarriageFixture['rhythms'];
  archivedRhythmIds: readonly string[];
  onRhythmDetails: MarriageViewProps['onRhythmDetails'];
  onPersonSelect: MarriageViewProps['onPersonSelect'];
}) {
  return (
    <section className="marriage-foundation-support-group" aria-label={title}>
      <h4>{title}</h4>
      <div className="marriage-rhythm-list">
        {rhythms.map(rhythm => (
          <RhythmCard
            key={rhythm.id}
            rhythm={rhythm}
            people={peopleForRhythm(rhythm)}
            onPersonSelect={onPersonSelect}
            variant="simple"
            archived={archivedRhythmIds.includes(rhythm.id)}
            headingId={`marriage-detail-rhythm-${rhythm.id}`}
            onDetails={event => onRhythmDetails(rhythm.id, event)}
          />
        ))}
      </div>
    </section>
  );
}

function formatDay(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
}

function formatDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}
