import { useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import {
  formatMoney,
  latestCheckIn,
  type CheckInDraft,
  type CheckInDraftErrors,
  type GoalCheckIn,
  type GoalDraft,
  type GoalRhythmAssociationChange,
  type MoneyGoal
} from '../domain/money-goals.ts';
import type { CategoryScoreSelection } from '../domain/category-scoring.ts';
import { selectFoundationCategoryScore } from '../domain/category-scoring.ts';
import { foundationRhythmIds } from '../domain/foundation-rhythm-associations.ts';
import type { FoundationRhythmAssociationChange } from '../domain/foundation-rhythm-associations.ts';
import type { FoundationPreview, PersonId, PersonPreview, RhythmPreview } from '../domain/preview-data.ts';
import type { RhythmScoreResult } from '../domain/rhythm-scoring.ts';
import type { Destination } from './AppNavigation.tsx';
import { CategoryHealthSummary } from './CategoryHealthSummary.tsx';
import { FoundationRhythmAssociationDialog } from './FoundationRhythmAssociationDialog.tsx';
import { FoundationRhythmGroup } from './FoundationRhythmGroup.tsx';
import { FoundationSectionHeading } from './FoundationSectionHeading.tsx';
import { GoalRhythmAssociationDialog } from './GoalRhythmAssociationDialog.tsx';
import { FinanceGoalLibraryDialog } from './FinanceGoalLibraryDialog.tsx';
import { FinanceGoalDetailsDialog } from './FinanceGoalDetailsDialog.tsx';
import { GoalEditor } from './GoalEditor.tsx';
import { GoalCard } from './Cards.tsx';
import { ProgressCheckIn } from './ProgressCheckIn.tsx';
import { CategoryHeader } from './CategoryHeader.tsx';
import { AreaIcon } from './AreaIcon.tsx';
import { SegmentedTabs } from './SegmentedTabs.tsx';
import type { SegmentedTab } from './SegmentedTabs.tsx';
import type { FinanceGoalTemplate } from '../domain/finance-goal-templates.ts';
import { financeGoalTemplateGroups } from '../domain/finance-goal-templates.ts';
import type { HealthRollupConfig } from './HealthRollupDiagram.tsx';

type GoalDialogState =
  | { kind: 'library' }
  | { kind: 'details'; goalId: string }
  | { kind: 'edit'; goal: MoneyGoal | null; newGoalId: string; initialDraft?: Partial<GoalDraft>; intro?: string; returnToDetails?: boolean }
  | { kind: 'check-in'; goalId: string; checkIn: GoalCheckIn | null; returnToDetails?: boolean }
  | { kind: 'goal-rhythms'; goalId: string; returnToDetails?: boolean }
  | { kind: 'foundation-rhythms' };

type FinanceTab = 'overview' | 'goals' | 'rhythms';

const financeTabs: readonly SegmentedTab<FinanceTab>[] = [
  { id: 'overview', label: 'Overview', tabId: 'finance-tab-overview', panelId: 'finance-panel-overview' },
  { id: 'goals', label: 'Goals', tabId: 'finance-tab-goals', panelId: 'finance-panel-goals' },
  { id: 'rhythms', label: 'Rhythms', tabId: 'finance-tab-rhythms', panelId: 'finance-panel-rhythms' }
];

type FinanceGoalsViewProps = {
  goals: readonly MoneyGoal[];
  currentDate: string;
  financeFoundation: FoundationPreview;
  financeCategoryEnabled: boolean;
  rhythms: readonly RhythmPreview[];
  archivedRhythms: readonly RhythmPreview[];
  categoryRhythms: readonly RhythmPreview[];
  archivedCategoryRhythms: readonly RhythmPreview[];
  people: readonly PersonPreview[];
  foundations: readonly FoundationPreview[];
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>;
  archivedRhythmIds: readonly string[];
  completedRhythms: ReadonlySet<string>;
  undoableRhythms: ReadonlySet<string>;
  onSaveGoal: (goal: MoneyGoal) => void;
  onSaveCheckIn: (goalId: string, draft: CheckInDraft, correctingCheckIn?: GoalCheckIn) => CheckInDraftErrors;
  onSaveGoalRhythms: (goalId: string, changes: readonly GoalRhythmAssociationChange[]) => string | null;
  onSaveFoundationAssociations: (
    foundationId: string,
    changes: readonly FoundationRhythmAssociationChange[]
  ) => string | null;
  onAddLinkedRhythm: (foundationId: string, event: MouseEvent<HTMLButtonElement>) => void;
  onCreateRhythmFromGoal: (
    event: MouseEvent<HTMLButtonElement>,
    onFinished: (saved: boolean) => void
  ) => void;
  onTendRhythm: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onUndoRhythm: (id: string) => void;
  onEditRhythm: (rhythm: RhythmPreview, event: MouseEvent<HTMLButtonElement>) => void;
  onRhythmHistory: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onPersonSelect: (id: PersonId) => void;
  onOpenFoundation: (id: string, openerId: string) => void;
  onOpenCategory: (id: Destination, openerId: string) => void;
  onToday: () => void;
};

export function FinanceGoalsView({
  goals,
  currentDate,
  financeFoundation,
  financeCategoryEnabled,
  rhythms,
  archivedRhythms,
  categoryRhythms,
  archivedCategoryRhythms,
  people,
  foundations,
  rhythmScores,
  archivedRhythmIds,
  completedRhythms,
  undoableRhythms,
  onSaveGoal,
  onSaveCheckIn,
  onSaveGoalRhythms,
  onSaveFoundationAssociations,
  onAddLinkedRhythm,
  onCreateRhythmFromGoal,
  onTendRhythm,
  onUndoRhythm,
  onEditRhythm,
  onRhythmHistory,
  onPersonSelect,
  onOpenFoundation,
  onOpenCategory,
  onToday
}: FinanceGoalsViewProps) {
  const [dialog, setDialog] = useState<GoalDialogState | null>(null);
  const [selectedTab, setSelectedTab] = useState<FinanceTab>('overview');
  const goalSequence = useRef(1);
  const dialogOpener = useRef<HTMLElement | null>(null);
  const detailsGoal = dialog?.kind === 'details'
    ? goals.find(goal => goal.id === dialog.goalId)
    : undefined;
  const checkInGoal = dialog?.kind === 'check-in'
    ? goals.find(goal => goal.id === dialog.goalId)
    : undefined;
  const goalRhythmGoal = dialog?.kind === 'goal-rhythms'
    ? goals.find(goal => goal.id === dialog.goalId)
    : undefined;
  const financeRhythms = rhythms.filter(rhythm =>
    foundationRhythmIds(rhythm).includes(financeFoundation.id)
  );
  const archivedFinanceRhythms = archivedRhythms.filter(rhythm =>
    foundationRhythmIds(rhythm).includes(financeFoundation.id)
  );
  const eligibleGoalRhythms = financeCategoryEnabled
    ? financeRhythms.filter(rhythm => rhythm.categoryIds?.includes('finances'))
    : [];
  const financeHealthScore: CategoryScoreSelection = selectFoundationCategoryScore(
    financeFoundation.id,
    [...financeRhythms, ...archivedFinanceRhythms],
    rhythmScores,
    archivedRhythmIds
  );
  const unlinkedFinanceRhythms = categoryRhythms.filter(rhythm =>
    !foundationRhythmIds(rhythm).includes(financeFoundation.id)
  );
  const financeRollup: HealthRollupConfig = {
    groups: [
      {
        id: 'finance-foundation',
        label: 'Foundation',
        items: [{
          id: financeFoundation.id,
          label: financeFoundation.name,
          foundationIconId: financeFoundation.iconId ?? financeFoundation.id,
          explanation: 'Eligible linked Finance Rhythms determine this score. Goal balances, check-ins, and goal completion do not contribute.'
        }]
      },
      {
        id: 'finance-rhythms',
        label: 'Linked Rhythms',
        items: financeRhythms.map(rhythm => ({
          id: rhythm.id,
          label: rhythm.title,
          explanation: `Linked through ${financeFoundation.name}.`
        })),
        emptyItem: {
          id: 'no-finance-rhythms',
          label: 'No linked Rhythms',
          explanation: 'No Finance Rhythms are linked to the Finance Foundation.'
        }
      }
    ],
    initialGroupId: 'finance-foundation',
    initialItemId: financeFoundation.id
  };

  function rememberDialogOpener() {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) dialogOpener.current = activeElement;
  }

  function closeDialog() {
    setDialog(null);
    requestAnimationFrame(() => {
      if (dialogOpener.current?.isConnected) dialogOpener.current.focus();
    });
  }

  function finishGoalDialog(goalId: string, returnToDetails = false) {
    if (returnToDetails) {
      setDialog({ kind: 'details', goalId });
      return;
    }
    closeDialog();
  }

  function addGoal() {
    rememberDialogOpener();
    setDialog({ kind: 'library' });
  }

  function newGoalId() {
    let newGoalId = `sample-goal-${goalSequence.current}`;
    while (goals.some(goal => goal.id === newGoalId)) {
      goalSequence.current += 1;
      newGoalId = `sample-goal-${goalSequence.current}`;
    }
    goalSequence.current += 1;
    return newGoalId;
  }

  function createOwnGoal() {
    setDialog({ kind: 'edit', goal: null, newGoalId: newGoalId() });
  }

  function chooseTemplate(template: FinanceGoalTemplate) {
    setDialog({
      kind: 'edit',
      goal: null,
      newGoalId: newGoalId(),
      initialDraft: template.draft,
      intro: `${template.description} Review the values before saving; edits stay in this synthetic preview.`
    });
  }

  function correctCheckIn(goal: MoneyGoal, checkIn: GoalCheckIn, returnToDetails = false) {
    if (!returnToDetails) rememberDialogOpener();
    setDialog({ kind: 'check-in', goalId: goal.id, checkIn, returnToDetails });
  }

  return (
    <main className="category-page category-page--with-header category-page--segmented money-goals-page finance-page" aria-labelledby="finances-heading">
      <CategoryHeader
        title="Finances"
        titleId="finances-heading"
        icon={<AreaIcon id="finances" />}
        subtitle="Track balance goals and the Rhythms that support them."
        trailing={<span className="hint">Illustrative preview · taxonomy not finalized</span>}
      />
      <CategoryHealthSummary
        title="Health"
        contextTitle="Finance Health"
        score={financeHealthScore}
        itemTerm={{ singular: 'Rhythm', plural: 'Rhythms' }}
        explanation="Finance Health reflects eligible Rhythms explicitly linked to the current Finance Foundation. Goal balances, targets, check-ins, and completion never affect it."
        describeRollup={false}
        coverageLabel={financeHealthScore.eligibleFoundationIds.length > 0
          ? 'The Finance Foundation has eligible linked Rhythm scores.'
          : 'No eligible Finance Foundation-linked Rhythms are scored yet.'}
        consistencyDescription="The average Consistency score of eligible active Rhythms linked to the Finance Foundation."
        onTrackDescription="The average On Track score of eligible active Rhythms linked to the Finance Foundation."
        unlinkedRhythms={unlinkedFinanceRhythms}
        onEditRhythm={onEditRhythm}
        rollup={financeRollup}
      />
      <SegmentedTabs
        tabs={financeTabs}
        selectedTabId={selectedTab}
        ariaLabel="Finances"
        onChange={setSelectedTab}
        variant="compact"
      />
      <div className="finance-page__panels">
        <section
          id="finance-panel-overview"
          className="strength-section-panel"
          role="tabpanel"
          aria-labelledby="finance-tab-overview"
          hidden={selectedTab !== 'overview'}
        >
          <div className="finance-overview">
            <FoundationSectionHeading
              title="Overview"
              headingId="finance-overview-heading"
              subtitle="Tracked amounts stay separate by goal and currency."
            />
            <p className="finance-preview-note">
              Balances are manually tracked values, not bank balances or a complete financial picture. This synthetic preview has no bank connection or money movement.
            </p>
            <div className="finance-overview__grid">
              <FinanceBalanceSummary
                title="Savings"
                direction="increase"
                goals={goals}
                onViewGoals={() => setSelectedTab('goals')}
              />
              <FinanceBalanceSummary
                title="Debt"
                direction="decrease"
                goals={goals}
                onViewGoals={() => setSelectedTab('goals')}
              />
            </div>
          </div>
        </section>

        <section
          id="finance-panel-goals"
          className="strength-section-panel"
          role="tabpanel"
          aria-labelledby="finance-tab-goals"
          hidden={selectedTab !== 'goals'}
        >
          <section className="money-goals-section finance-goals-section" aria-labelledby="finance-goals-heading">
            <FoundationSectionHeading
              title="My goals"
              headingId="finance-goals-heading"
              subtitle="The outcomes you’re working toward."
              actions={<button type="button" className="btn mini ghost" onClick={addGoal}>+ Add</button>}
            />
            {goals.length
              ? (
                <div className="money-goals-list">
                  {goals.map(goal => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      presentation="summary"
                      supportingRhythmCount={goal.supportingRhythmIds?.length ?? 0}
                      onManageSupportingRhythms={() => {
                        rememberDialogOpener();
                        setDialog({ kind: 'goal-rhythms', goalId: goal.id });
                      }}
                      onDetails={() => {
                        rememberDialogOpener();
                        setDialog({ kind: 'details', goalId: goal.id });
                      }}
                      onCheckIn={() => {
                        rememberDialogOpener();
                        setDialog({ kind: 'check-in', goalId: goal.id, checkIn: null });
                      }}
                    />
                  ))}
                </div>
              )
              : (
                <div className="finance-goals-empty" role="status">
                  <p>No goals yet. Add a savings increase or debt reduction balance goal to begin.</p>
                  <button type="button" className="btn mini ghost" onClick={addGoal}>+ Add</button>
                </div>
              )}
          </section>
        </section>

        <section
          id="finance-panel-rhythms"
          className="strength-section-panel"
          role="tabpanel"
          aria-labelledby="finance-tab-rhythms"
          hidden={selectedTab !== 'rhythms'}
        >
          <section className="marriage-foundation-support strength-rhythms-panel" aria-labelledby="finance-linked-rhythms-title">
            <FoundationSectionHeading
              title="Linked Rhythms"
              headingId="finance-linked-rhythms-title"
              accessibleName={`Linked Rhythms · ${financeRhythms.length}`}
              secondary={<span className="strength-linked-rhythms-count" aria-hidden="true">{financeRhythms.length}</span>}
              subtitle="Repeatable actions can support goals; only eligible linked Rhythms affect Finance Health."
              actions={
                <>
                  <button
                    type="button"
                    className="btn mini ghost"
                    aria-haspopup="dialog"
                    onClick={() => {
                      rememberDialogOpener();
                      setDialog({ kind: 'foundation-rhythms' });
                    }}
                  >
                    Manage links
                  </button>
                  <button
                    type="button"
                    className="btn mini"
                    onClick={event => onAddLinkedRhythm(financeFoundation.id, event)}
                  >
                    Add Rhythm
                  </button>
                </>
              }
            />
            {financeRhythms.length > 0 ? (
              <FoundationRhythmGroup
                people={people}
                rhythms={financeRhythms}
                archivedRhythmIds={archivedFinanceRhythms.map(rhythm => rhythm.id)}
                headingId="finance-linked-rhythms-title"
                rhythmScores={rhythmScores}
                completedRhythms={completedRhythms}
                undoableRhythms={undoableRhythms}
                foundations={foundations}
                categoryToken="finance"
                onTend={onTendRhythm}
                onUndo={onUndoRhythm}
                onEditRhythm={onEditRhythm}
                onRhythmHistory={onRhythmHistory}
                onPersonSelect={onPersonSelect}
                onOpenFoundation={onOpenFoundation}
                onOpenCategory={onOpenCategory}
              />
            ) : (
              <div className="strength-rhythms-empty">
                <p>No Rhythms are linked to Finances yet.</p>
              </div>
            )}
          </section>
        </section>
      </div>

      {dialog?.kind === 'details' && detailsGoal && (
        <FinanceGoalDetailsDialog
          goal={detailsGoal}
          financeFoundationId={financeFoundation.id}
          financeCategoryEnabled={financeCategoryEnabled}
          financeRhythms={financeRhythms}
          rhythms={rhythms}
          archivedRhythms={archivedRhythms}
          onEdit={() => setDialog({
            kind: 'edit',
            goal: detailsGoal,
            newGoalId: detailsGoal.id,
            returnToDetails: true
          })}
          onCheckIn={() => setDialog({
            kind: 'check-in',
            goalId: detailsGoal.id,
            checkIn: null,
            returnToDetails: true
          })}
          onCorrectCheckIn={checkIn => correctCheckIn(detailsGoal, checkIn, true)}
          onManageSupportingRhythms={() => setDialog({
            kind: 'goal-rhythms',
            goalId: detailsGoal.id,
            returnToDetails: true
          })}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === 'edit' && (
        <GoalEditor
          {...(dialog.goal ? { goal: dialog.goal } : {})}
          newGoalId={dialog.newGoalId}
          {...(dialog.initialDraft ? { initialDraft: dialog.initialDraft } : {})}
          {...(dialog.intro ? { intro: dialog.intro } : {})}
          onSave={goal => {
            onSaveGoal(goal);
            finishGoalDialog(dialog.goal?.id ?? goal.id, dialog.returnToDetails);
          }}
          onClose={() => finishGoalDialog(dialog.goal?.id ?? dialog.newGoalId, dialog.returnToDetails)}
        />
      )}
      {dialog?.kind === 'library' && (
        <FinanceGoalLibraryDialog
          groups={financeGoalTemplateGroups}
          onCreateOwn={createOwnGoal}
          onChooseTemplate={chooseTemplate}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === 'check-in' && checkInGoal && (
        <ProgressCheckIn
          key={`${dialog.goalId}-${dialog.checkIn?.id ?? 'new'}`}
          goal={checkInGoal}
          currentDate={currentDate}
          {...(dialog.checkIn ? { checkIn: dialog.checkIn } : {})}
          onSave={(draft, correctingCheckIn) => onSaveCheckIn(dialog.goalId, draft, correctingCheckIn)}
          onClose={() => finishGoalDialog(dialog.goalId, dialog.returnToDetails)}
        />
      )}
      {dialog?.kind === 'goal-rhythms' && goalRhythmGoal && (
        <GoalRhythmAssociationDialog
          key={goalRhythmGoal.id}
          goal={goalRhythmGoal}
          financeFoundationId={financeFoundation.id}
          financeCategoryEnabled={financeCategoryEnabled}
          eligibleRhythms={eligibleGoalRhythms}
          rhythms={rhythms}
          archivedRhythms={archivedRhythms}
          onSave={changes => onSaveGoalRhythms(goalRhythmGoal.id, changes)}
          onCreateRhythm={event => {
            const goalId = goalRhythmGoal.id;
            setDialog(null);
            onCreateRhythmFromGoal(event, saved => {
              if (saved) setDialog({
                kind: 'goal-rhythms',
                goalId,
                ...(dialog.returnToDetails ? { returnToDetails: true } : {})
              });
            });
          }}
          onClose={() => finishGoalDialog(goalRhythmGoal.id, dialog.returnToDetails)}
        />
      )}
      {dialog?.kind === 'foundation-rhythms' && (
        <FoundationRhythmAssociationDialog
          key={financeFoundation.id}
          foundation={financeFoundation}
          rhythms={[
            ...categoryRhythms.map(rhythm => ({ rhythm, archived: false })),
            ...archivedCategoryRhythms.map(rhythm => ({ rhythm, archived: true }))
          ]}
          onSave={changes => onSaveFoundationAssociations(financeFoundation.id, changes)}
          onClose={closeDialog}
        />
      )}
      <button type="button" className="money-goals-back" onClick={onToday}>Back to Today</button>
    </main>
  );
}

function FinanceBalanceSummary({
  title,
  direction,
  goals,
  onViewGoals
}: {
  title: string;
  direction: MoneyGoal['direction'];
  goals: readonly MoneyGoal[];
  onViewGoals: () => void;
}) {
  const matchingGoals = goals.filter(goal => goal.direction === direction);
  return (
    <section className="finance-overview-card" aria-labelledby={`finance-overview-${direction}`}>
      <header>
        <h3 id={`finance-overview-${direction}`}>{title}</h3>
        <button type="button" className="btn mini ghost" onClick={onViewGoals}>View goals</button>
      </header>
      {matchingGoals.length === 0 ? (
        <p className="finance-overview-card__empty">No {title.toLowerCase()} goal is being tracked.</p>
      ) : (
        <>
          {matchingGoals.length > 1 && (
            <p className="finance-overview-card__note">
              Balances are listed separately to avoid adding overlapping goals or currencies.
            </p>
          )}
          <ul>
            {matchingGoals.map(goal => {
              const latest = latestCheckIn(goal);
              const recentChange = recentBalanceChange(goal);
              return (
                <li className="finance-overview-entry" key={goal.id}>
                  <div className="finance-overview-entry__heading">
                    <button type="button" onClick={onViewGoals}>{goal.title}</button>
                    <strong>{latest ? formatMoney(latest.balanceMinor, goal.currency) : 'Unavailable'}</strong>
                  </div>
                  <small>{latest ? `Recorded ${formatDate(latest.effectiveDate)}` : 'No check-in recorded'}</small>
                  {recentChange && <p>{recentChange}</p>}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function recentBalanceChange(goal: MoneyGoal): string | null {
  const checkIns = [...goal.checkIns].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  if (checkIns.length < 2) return null;
  const previous = checkIns.at(-2)!;
  const latest = checkIns.at(-1)!;
  const delta = latest.balanceMinor - previous.balanceMinor;
  if (delta === 0) return `No balance change since ${formatDate(previous.effectiveDate)}.`;
  const verb = goal.direction === 'increase'
    ? delta > 0 ? 'increased' : 'decreased'
    : delta < 0 ? 'reduced' : 'increased';
  return `${goal.direction === 'increase' ? 'Savings' : 'Debt'} ${verb} by ${formatMoney(Math.abs(delta), goal.currency)} since ${formatDate(previous.effectiveDate)}.`;
}

function formatDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}
