import { useMemo, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import {
  areas,
  peopleForRhythm,
  type FoundationPreview,
  todayAreaScore,
  todayOverallIllustrativeScore,
  type MarriageExampleId,
  type PersonId,
  type RhythmPreview
} from '../domain/preview-data.ts';
import { isEditableRhythmId } from '../domain/rhythm-editor.ts';
import { rhythmHealthScore } from '../domain/rhythm-scoring.ts';
import type { RhythmScoreResult } from '../domain/rhythm-scoring.ts';
import { AreaIcon } from './AreaIcon.tsx';
import { CategoryHealthBadge, ScoreMeter } from './Cards.tsx';
import { MarriageExampleSelector } from './MarriageExampleSelector.tsx';
import type { Destination } from './AppNavigation.tsx';
import { RhythmDetailsDialog } from './RhythmDetailsDialog.tsx';

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
  undoableRhythms: ReadonlySet<string>;
  rhythms: readonly RhythmPreview[];
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>;
  search: string;
  marriageExampleId: MarriageExampleId;
  onNavigate: (destination: Destination) => void;
  onMarriageExampleChange: (id: MarriageExampleId) => void;
  onPersonSelect: (personId: PersonId) => void;
  foundations: readonly FoundationPreview[];
  onOpenFoundation: (foundationId: string, openerId: string) => void;
  onHistory: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onTend: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onEditRhythm: (rhythm: RhythmPreview, event: MouseEvent<HTMLButtonElement>) => void;
  onUndo: (id: string) => void;
};

export function TodayView({
  greeting,
  dateLabel,
  completedRhythms,
  undoableRhythms,
  rhythms,
  rhythmScores,
  search,
  marriageExampleId,
  foundations,
  onOpenFoundation,
  onNavigate,
  onMarriageExampleChange,
  onPersonSelect,
  onHistory,
  onTend,
  onEditRhythm,
  onUndo,
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
                <span className="menu-area-icon" aria-hidden="true">
                  <AreaIcon id={area.id} variant="today-summary" />
                </span>
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
        </div>
        <div className="card planblock current">
          <div className="current-plan-summary">
            <div className="plan-block-name">Today</div>
            <span className="current-plan-item-count" aria-live="polite">
              {rhythms.filter(rhythm => completedRhythms.has(rhythm.id)).length} of {rhythms.length} tended
            </span>
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
                    <RhythmDetailsDialog
                      key={rhythm.id}
                      rhythm={rhythm}
                      inline
                      headingId={`today-rhythm-${rhythm.id}-title`}
                      people={peopleForRhythm(rhythm)}
                      foundations={foundations}
                      onPersonSelect={onPersonSelect}
                      onOpenFoundation={onOpenFoundation}
                      onOpenCategory={categoryId => onNavigate(categoryId)}
                      completed={completedRhythms.has(rhythm.id)}
                      healthScore={rhythmHealthScore(rhythmScores.get(rhythm.id))}
                      onTend={event => onTend(rhythm.id, event)}
                      {...(rhythm.categoryIds?.includes('health')
                        ? { completionActionLabel: 'Log workout', completedActionLabel: 'Logged' }
                        : {})}
                      onHistory={event => onHistory(rhythm.id, event)}
                      {...(isEditableRhythmId(rhythm.id)
                        ? { onEdit: event => onEditRhythm(rhythm, event) }
                        : {})}
                      {...(undoableRhythms.has(rhythm.id) ? { onUndo: () => onUndo(rhythm.id) } : {})}
                      onClose={() => undefined}
                    />
                  ))}
                </div>
              ) : <div className="dashed-empty-state" role="status"><p>No active Rhythms.</p></div>
            ) : (
              <div className="dashed-empty-state" role="status"><p>No active Rhythms.</p></div>
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
