import { useMemo, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import {
  areas,
  peopleForRhythm,
  todayAreaScore,
  todayOverallIllustrativeScore,
  type MarriageExampleId,
  type PersonId,
  type RhythmPreview
} from '../domain/preview-data.ts';
import { AreaIcon } from './AreaIcon.tsx';
import { CategoryHealthBadge, RhythmCard, ScoreMeter } from './Cards.tsx';
import { MarriageExampleSelector } from './MarriageExampleSelector.tsx';
import type { Destination } from './AppNavigation.tsx';

type PlanType = 'scheduled' | 'anytime' | 'all-day';

const planTypes: { id: PlanType; label: string }[] = [
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'anytime', label: 'Anytime' },
  { id: 'all-day', label: 'All-day' }
];

type TodayViewProps = {
  greeting: string;
  dateLabel: string;
  completedRhythms: ReadonlySet<string>;
  rhythms: readonly RhythmPreview[];
  search: string;
  marriageExampleId: MarriageExampleId;
  onNavigate: (destination: Destination) => void;
  onMarriageExampleChange: (id: MarriageExampleId) => void;
  onPersonSelect: (personId: PersonId) => void;
  onDetails: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onTend: (id: string) => void;
  onUndo: (id: string) => void;
  onAddRhythm: (event: MouseEvent<HTMLButtonElement>) => void;
};

export function TodayView({
  greeting,
  dateLabel,
  completedRhythms,
  rhythms,
  search,
  marriageExampleId,
  onNavigate,
  onMarriageExampleChange,
  onPersonSelect,
  onDetails,
  onTend,
  onUndo,
  onAddRhythm
}: TodayViewProps) {
  const [planType, setPlanType] = useState<PlanType>('scheduled');
  const visibleRhythms = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? rhythms.filter(item => item.title.toLocaleLowerCase().includes(query)) : rhythms;
  }, [rhythms, search]);

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
        <h2>{greeting}</h2><span className="hint">{dateLabel}</span>
      </div>

      <section className="card overall-card" aria-label="Overall health summary">
        <div className="dashboard-overall-heading">
          <h3>Overall health</h3><span className="ov-score" aria-hidden="true">{todayOverallIllustrativeScore}</span>
        </div>
        <ScoreMeter
          label={`Overall health, illustrative sample score ${todayOverallIllustrativeScore} out of 100, not calculated`}
          score={todayOverallIllustrativeScore}
          markerPlacement="below"
        />
        <div className="meta"><span className="sample-status">Illustrative sample · not calculated</span></div>
        <div className="menu-grid">
          {areas.map(area => {
            const score = todayAreaScore(area.id, marriageExampleId);
            return (
              <button
                className="menu-area"
                key={area.id}
                type="button"
                aria-description={score === null
                  ? `${area.label} sample health score unavailable`
                  : `${area.label} illustrative sample score ${score}, not calculated`}
                onClick={() => onNavigate(area.id)}
              >
                <span className="menu-area-icon" aria-hidden="true"><AreaIcon id={area.id} /></span>
                <span className="ma-name">{area.label}</span>
                <CategoryHealthBadge score={score} />
              </button>
            );
          })}
        </div>
        <MarriageExampleSelector value={marriageExampleId} onChange={onMarriageExampleChange} />
      </section>

      <section aria-labelledby="today-plan-heading">
        <div className="sectiontitle today-plan-heading">
          <h2 id="today-plan-heading">Your plan</h2>
          <span className="hint">Today</span>
          <button type="button" className="btn mini today-add-rhythm" onClick={onAddRhythm}>Add Rhythm</button>
        </div>
        <div className="card planblock current">
          <div className="current-plan-summary">
            <div className="plan-block-name">Today</div>
            <span className="current-plan-item-count" aria-live="polite">{completedRhythms.size} of {rhythms.length} tended</span>
          </div>
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
          <div className="home-plan-context-row">
            <div className="home-plan-context">
              {planType === 'scheduled' ? 'Your scheduled Rhythms for today' : planType === 'anytime' ? 'Rhythms you can tend anytime' : 'All-day commitments'}
            </div>
          </div>
          <div className="current-plan-items" id="today-plan-items" role="tabpanel" aria-labelledby={`plan-tab-${planType}`}>
            {planType === 'scheduled' ? (
              visibleRhythms.length ? (
                <div className="current-plan-item-group" aria-label="Scheduled Rhythms">
                  {visibleRhythms.map(rhythm => (
                    <RhythmCard
                      key={rhythm.id}
                      rhythm={rhythm}
                      people={peopleForRhythm(rhythm)}
                      onPersonSelect={onPersonSelect}
                      variant="simple"
                      completed={completedRhythms.has(rhythm.id)}
                      onDetails={event => onDetails(rhythm.id, event)}
                      onTend={() => onTend(rhythm.id)}
                      onUndo={() => onUndo(rhythm.id)}
                    />
                  ))}
                </div>
              ) : <p className="empty plan-empty" role="status">No sample Rhythms match “{search.trim()}”.</p>
            ) : (
              <p className="empty plan-empty" role="status">
                {planType === 'anytime' ? 'No anytime Rhythms in this sample.' : 'No all-day commitments in this sample.'}
              </p>
            )}
          </div>
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
