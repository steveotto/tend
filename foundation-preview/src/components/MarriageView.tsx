import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import {
  marriageExampleFixtures,
  marriageRhythmGroups,
  marriageFoundationCoverage,
  marriageScoreCoverage,
  marriageWeekDays,
  peopleForRhythm,
  type PersonId,
  type MarriageExampleId,
  type MarriageFixture,
  type RhythmPreview,
  rhythmsSupportingFoundation
} from '../domain/preview-data.ts';
import { FoundationCard, RhythmCard, ScoreMeter } from './Cards.tsx';
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
  completedRhythms: ReadonlySet<string>;
  onTend: (id: string) => void;
  onUndo: (id: string) => void;
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
  completedRhythms,
  onTend,
  onUndo
}: MarriageViewProps) {
  const [activeTab, setActiveTab] = useState<MarriageTab>('today');
  const [selectedFoundationId, setSelectedFoundationId] = useState<string | null>(null);
  const foundationOpener = useRef<string | null>(null);
  const fixture = marriageExampleFixtures[marriageExampleId];

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
          selectedFoundationId={selectedFoundationId}
          onSelect={openFoundation}
          onBack={() => setSelectedFoundationId(null)}
          onRhythmDetails={onRhythmDetails}
          onPersonSelect={onPersonSelect}
        />
      </section>
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
  onTend,
  onUndo,
  onRhythmDetails,
  onPersonSelect
}: {
  fixture: MarriageFixture;
  userRhythms: readonly RhythmPreview[];
  completedRhythms: ReadonlySet<string>;
  onTend: (id: string) => void;
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
                onTend={() => onTend(rhythm.id)}
                onUndo={() => onUndo(rhythm.id)}
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
  selectedFoundationId,
  onSelect,
  onBack,
  onRhythmDetails,
  onPersonSelect
}: {
  fixture: MarriageFixture;
  selectedFoundationId: string | null;
  onSelect: (id: string, openerId: string) => void;
  onBack: () => void;
  onRhythmDetails: MarriageViewProps['onRhythmDetails'];
  onPersonSelect: MarriageViewProps['onPersonSelect'];
}) {
  const selectedFoundation = fixture.foundations.find(item => item.id === selectedFoundationId);
  const supportingRhythms = selectedFoundation
    ? rhythmsSupportingFoundation(fixture.rhythms, selectedFoundation.id)
    : [];
  const primaryRhythms = selectedFoundation
    ? supportingRhythms.filter(rhythm => rhythm.primaryFoundationId === selectedFoundation.id)
    : [];
  const secondaryRhythms = selectedFoundation
    ? supportingRhythms.filter(rhythm =>
      rhythm.primaryFoundationId !== selectedFoundation.id &&
      rhythm.secondaryFoundationIds?.includes(selectedFoundation.id) === true
    )
    : [];

  return (
    <section className="marriage-foundations-section" aria-labelledby="marriage-foundations-title">
      <div className="marriage-section-heading">
        <div>
          <h3 id="marriage-foundations-title">Marriage foundations</h3>
          <p>
            {fixture.id === 'empty'
              ? 'Ongoing areas of care; no sample scores are available.'
              : 'Ongoing areas of care.'}
          </p>
        </div>
        <span className="marriage-sample-tag">Synthetic examples</span>
      </div>
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
              illustrativeScore={selectedFoundation.illustrativeScore ?? null}
              rhythmCoverage={marriageFoundationCoverage(fixture, selectedFoundation.id)}
            >
              <div className="marriage-foundation-support">
                <h3>Supporting Rhythms · {supportingRhythms.length}</h3>
                {supportingRhythms.length
                  ? (
                    <>
                      {primaryRhythms.length > 0 && (
                        <FoundationRhythmGroup
                          title={`Primary associations · ${primaryRhythms.length}`}
                          rhythms={primaryRhythms}
                          onRhythmDetails={onRhythmDetails}
                          onPersonSelect={onPersonSelect}
                        />
                      )}
                      {secondaryRhythms.length > 0 && (
                        <FoundationRhythmGroup
                          title={`Secondary associations · ${secondaryRhythms.length}`}
                          rhythms={secondaryRhythms}
                          onRhythmDetails={onRhythmDetails}
                          onPersonSelect={onPersonSelect}
                        />
                      )}
                    </>
                  )
                  : <p>No sample Rhythms are assigned to this ongoing Foundation yet.</p>}
              </div>
            </FoundationCard>
          </section>
        )
        : (
          <div className="marriage-foundation-list">
            {fixture.foundations.map(foundation => (
              <FoundationCard
                key={foundation.id}
                foundation={foundation}
                variant="compact"
                icon={<MarriageIcon group="foundations" id={foundation.iconId ?? foundation.id} />}
                illustrativeScore={foundation.illustrativeScore ?? null}
                rhythmCoverage={marriageFoundationCoverage(fixture, foundation.id)}
                headingId={`marriage-foundation-list-${foundation.id}`}
                selectButtonId={`marriage-foundation-select-${foundation.id}`}
                onSelect={() => onSelect(foundation.id, `marriage-foundation-select-${foundation.id}`)}
              />
            ))}
          </div>
        )}
    </section>
  );
}

function FoundationRhythmGroup({
  title,
  rhythms,
  onRhythmDetails,
  onPersonSelect
}: {
  title: string;
  rhythms: MarriageFixture['rhythms'];
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
