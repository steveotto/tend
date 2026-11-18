import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  selectCategoryHealthScore,
  selectFoundationCategoryScore
} from '../domain/category-scoring.ts';
import { selectFoundationScore } from '../domain/foundation-scoring.ts';
import type { FoundationScoreSelection } from '../domain/foundation-scoring.ts';
import { foundationRhythmIds } from '../domain/foundation-rhythm-associations.ts';
import type { FoundationRhythmAssociationChange } from '../domain/foundation-rhythm-associations.ts';
import {
  type FoundationPreview,
  type PersonId,
  type PersonPreview,
  type RhythmPreview
} from '../domain/preview-data.ts';
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
import { FoundationCard, GoalCard } from './Cards.tsx';
import { ProgressCheckIn } from './ProgressCheckIn.tsx';
import { CategoryHeader } from './CategoryHeader.tsx';
import { FoundationDetailHeader } from './FoundationDetailHeader.tsx';
import { MarriageIcon } from './MarriageIcon.tsx';
import { AreaIcon } from './AreaIcon.tsx';
import { BackButton } from './BackButton.tsx';
import { SegmentedTabs } from './SegmentedTabs.tsx';
import { ToolZone, ToolZoneTrendingUpIcon } from './ToolZone.tsx';
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
  | { kind: 'foundation-rhythms'; foundationId: string };

type FinanceTab = 'overview' | 'goals' | 'rhythms';

const financeTabs: readonly SegmentedTab<FinanceTab>[] = [
  { id: 'overview', label: 'Overview', tabId: 'finance-tab-overview', panelId: 'finance-panel-overview' },
  { id: 'goals', label: 'Goals', tabId: 'finance-tab-goals', panelId: 'finance-panel-goals' },
  { id: 'rhythms', label: 'Rhythms', tabId: 'finance-tab-rhythms', panelId: 'finance-panel-rhythms' }
];

type FinanceGoalsViewProps = {
  goals: readonly MoneyGoal[];
  currentDate: string;
  financeFoundations: readonly FoundationPreview[];
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
    context: {
      goalId: string;
      foundationId?: string;
      onFinished: (saved: boolean) => void;
    }
  ) => void;
  foundationNavigationRequest?: { foundationId: string; requestId: number } | null;
  onFoundationNavigationHandled?: () => void;
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
  financeFoundations: financeFoundationList,
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
  onToday,
  foundationNavigationRequest,
  onFoundationNavigationHandled
}: FinanceGoalsViewProps) {
  const [dialog, setDialog] = useState<GoalDialogState | null>(null);
  const [selectedTab, setSelectedTab] = useState<FinanceTab>('overview');
  const [selectedFoundationId, setSelectedFoundationId] = useState<string | null>(null);
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
  const financeFoundationIds = useMemo(
    () => new Set(financeFoundationList.map(foundation => foundation.id)),
    [financeFoundationList]
  );
  const linkedToFinanceFoundation = (rhythm: RhythmPreview) =>
    foundationRhythmIds(rhythm).some(id => financeFoundationIds.has(id));
  const financeRhythms = rhythms.filter(linkedToFinanceFoundation);
  const archivedFinanceRhythms = archivedRhythms.filter(linkedToFinanceFoundation);
  const eligibleGoalRhythms = financeCategoryEnabled
    ? financeRhythms.filter(rhythm => rhythm.categoryIds?.includes('finances'))
    : [];
  const financeRhythmPool = [...categoryRhythms, ...archivedCategoryRhythms];
  const foundationScores = new Map(financeFoundationList.map(foundation => [
    foundation.id,
    selectFoundationCategoryScore(
      foundation.id,
      financeRhythmPool,
      rhythmScores,
      archivedRhythmIds
    )
  ]));
  const foundationScoreDetails = new Map(financeFoundationList.map(foundation => [
    foundation.id,
    selectFoundationScore(
      foundation.id,
      financeRhythmPool,
      rhythmScores,
      archivedRhythmIds
    )
  ]));
  const financeHealthScore: CategoryScoreSelection = selectCategoryHealthScore(
    financeFoundationList,
    financeRhythmPool,
    rhythmScores,
    archivedRhythmIds
  );
  const unlinkedFinanceRhythms = categoryRhythms.filter(rhythm =>
    !linkedToFinanceFoundation(rhythm)
  );
  const selectedFoundation = financeFoundationList.find(foundation =>
    foundation.id === selectedFoundationId
  );
  const selectedFoundationRhythms = selectedFoundation
    ? rhythms.filter(rhythm => foundationRhythmIds(rhythm).includes(selectedFoundation.id))
    : [];
  const selectedFoundationArchivedRhythms = selectedFoundation
    ? archivedRhythms.filter(rhythm => foundationRhythmIds(rhythm).includes(selectedFoundation.id))
    : [];
  const selectedFoundationUnlinkedRhythms = selectedFoundation
    ? categoryRhythms.filter(rhythm => !foundationRhythmIds(rhythm).includes(selectedFoundation.id))
    : [];
  const selectedFoundationScore = selectedFoundation
    ? foundationScores.get(selectedFoundation.id) ?? selectFoundationCategoryScore(
        selectedFoundation.id,
        financeRhythmPool,
        rhythmScores,
        archivedRhythmIds
      )
    : null;
  const financeRollup: HealthRollupConfig = {
    groups: [
      {
        id: 'finance-foundations',
        label: 'Foundations',
        items: financeFoundationList.map(foundation => ({
          id: foundation.id,
          label: foundation.name,
          foundationIconId: foundation.iconId ?? foundation.id,
          explanation: 'Eligible linked Finance Rhythms determine this Foundation score.'
        }))
      },
      {
        id: 'finance-rhythms',
        label: 'Eligible Rhythms',
        items: financeRhythms.map(rhythm => {
          const linkedNames = financeFoundationList
            .filter(foundation => foundationRhythmIds(rhythm).includes(foundation.id))
            .map(foundation => foundation.name);
          return {
          id: rhythm.id,
          label: rhythm.title,
          explanation: `Linked through ${linkedNames.join(', ')}.`
          };
        }),
        emptyItem: {
          id: 'no-finance-rhythms',
          label: 'No linked Rhythms',
          explanation: 'No eligible Finance Rhythms are linked to a Finance Foundation.'
        }
      }
    ],
    initialGroupId: 'finance-foundations',
    initialItemId: financeFoundationList[0]?.id ?? 'finance-foundations-empty'
  };
  const selectedFoundationRollup: HealthRollupConfig | null = selectedFoundation
    ? {
        groups: [
          {
            id: 'selected-finance-foundation',
            label: 'Foundation',
            items: [{
              id: selectedFoundation.id,
              label: selectedFoundation.name,
              foundationIconId: selectedFoundation.iconId ?? selectedFoundation.id,
              explanation: 'Eligible linked Finance Rhythms determine this Foundation score.'
            }]
          },
          {
            id: 'selected-finance-rhythms',
            label: 'Eligible Rhythms',
            items: selectedFoundationRhythms.map(rhythm => ({
              id: rhythm.id,
              label: rhythm.title,
              explanation: `Linked through ${selectedFoundation.name}.`
            })),
            emptyItem: {
              id: `no-${selectedFoundation.id}-rhythms`,
              label: 'No linked Rhythms',
              explanation: `No eligible Rhythms are linked to ${selectedFoundation.name}.`
            }
          }
        ],
        initialGroupId: 'selected-finance-foundation',
        initialItemId: selectedFoundation.id
      }
    : null;

  useEffect(() => {
    if (!foundationNavigationRequest) return;
    if (financeFoundationIds.has(foundationNavigationRequest.foundationId)) {
      setSelectedFoundationId(foundationNavigationRequest.foundationId);
    }
    onFoundationNavigationHandled?.();
  }, [foundationNavigationRequest?.requestId, financeFoundationList, onFoundationNavigationHandled]);

  function openFoundationOrCategory(foundationId: string) {
    if (financeFoundationIds.has(foundationId)) setSelectedFoundationId(foundationId);
    else onOpenFoundation(foundationId, `finance-foundation-select-${foundationId}`);
  }

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
    <main
      className="category-page category-page--with-header category-page--segmented money-goals-page finance-page"
      aria-labelledby={selectedFoundation
        ? `finance-foundation-${selectedFoundation.id}-heading`
        : 'finances-heading'}
    >
      {!selectedFoundation && (
        <CategoryHeader
          title="Finances"
          titleId="finances-heading"
          icon={<AreaIcon id="finances" />}
          onHome={onToday}
          subtitle="Track balance goals and the Rhythms that support them."
          trailing={<span className="hint">Synthetic preview · no account connection</span>}
        />
      )}
      {selectedFoundation ? (
        <section className="marriage-foundation-detail finance-foundation-detail" aria-labelledby={`finance-foundation-${selectedFoundation.id}-heading`}>
          <BackButton onClick={() => setSelectedFoundationId(null)} variant="plain">
            Back to Finance Overview
          </BackButton>
          <FoundationDetailHeader
            foundation={selectedFoundation}
            headingId={`finance-foundation-${selectedFoundation.id}-heading`}
          />
          {selectedFoundationScore && selectedFoundationRollup && (
            <CategoryHealthSummary
              title="Health"
              contextTitle={`${selectedFoundation.name} Health`}
              score={selectedFoundationScore}
              itemTerm={{ singular: 'Rhythm', plural: 'Rhythms' }}
              explanation={`${selectedFoundation.name} Health reflects eligible Rhythms explicitly linked to this Foundation.`}
              describeRollup={false}
              coverageLabel={foundationScoreEvidence(
                foundationScoreDetails.get(selectedFoundation.id)!
              )}
              consistencyDescription={`The average Consistency score of eligible active Rhythms linked to ${selectedFoundation.name}.`}
              onTrackDescription={`The average On Track score of eligible active Rhythms linked to ${selectedFoundation.name}.`}
              unlinkedRhythms={selectedFoundationUnlinkedRhythms}
              onEditRhythm={onEditRhythm}
              rollup={selectedFoundationRollup}
            />
          )}
          <section className="marriage-foundation-support strength-rhythms-panel" aria-labelledby={`finance-foundation-${selectedFoundation.id}-rhythms-title`}>
            <FoundationSectionHeading
              title="Linked Rhythms"
              headingId={`finance-foundation-${selectedFoundation.id}-rhythms-title`}
              accessibleName={`Linked Rhythms · ${selectedFoundationRhythms.length}`}
              secondary={<span className="strength-linked-rhythms-count" aria-hidden="true">{selectedFoundationRhythms.length}</span>}
              subtitle="Eligible linked Rhythms contribute to this Foundation’s Health."
              actions={
                <>
                  <button
                    type="button"
                    className="btn mini ghost"
                    aria-haspopup="dialog"
                    onClick={() => {
                      rememberDialogOpener();
                      setDialog({ kind: 'foundation-rhythms', foundationId: selectedFoundation.id });
                    }}
                  >
                    Manage links
                  </button>
                  <button
                    type="button"
                    className="btn mini"
                    onClick={event => onAddLinkedRhythm(selectedFoundation.id, event)}
                  >
                    Add Rhythm
                  </button>
                </>
              }
            />
            {selectedFoundationRhythms.length > 0 ? (
              <FoundationRhythmGroup
                people={people}
                rhythms={selectedFoundationRhythms}
                archivedRhythmIds={selectedFoundationArchivedRhythms.map(rhythm => rhythm.id)}
                headingId={`finance-foundation-${selectedFoundation.id}-rhythms-title`}
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
                onOpenFoundation={openFoundationOrCategory}
                onOpenCategory={onOpenCategory}
              />
            ) : (
              <div className="strength-rhythms-empty">
                <p>No Rhythms are linked to {selectedFoundation.name} yet.</p>
              </div>
            )}
          </section>
        </section>
      ) : (
        <>
      <CategoryHealthSummary
        title="Health"
        contextTitle="Finance Health"
        score={financeHealthScore}
        itemTerm={{ singular: 'Rhythm', plural: 'Rhythms' }}
        explanation="Finance Health averages eligible Foundation Health scores. Goal balances, targets, check-ins, and goal completion never contribute."
        describeRollup={false}
        coverageLabel={financeHealthScore.eligibleFoundationIds.length > 0
          ? 'Eligible Foundation Health scores are averaged for Finance Health.'
          : 'No eligible Finance Foundation scores are available yet.'}
        consistencyDescription="The average Consistency score of eligible Finance Foundations."
        onTrackDescription="The average On Track score of eligible Finance Foundations."
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
              subtitle="Build financial habits across five areas."
            />
            <section aria-labelledby="finance-foundations-heading">
              <FoundationSectionHeading
                title="Foundations"
                headingId="finance-foundations-heading"
                subtitle="Open a Foundation to review its Health and linked Rhythms."
              />
              <div className="marriage-foundation-list">
                {financeFoundationList.map(foundation => {
                  const score = foundationScores.get(foundation.id);
                  return (
                    <FoundationCard
                      key={foundation.id}
                      foundation={foundation}
                      variant="compact"
                      icon={<MarriageIcon group="foundations" id={foundation.iconId ?? foundation.id} />}
                      score={score?.health ?? null}
                      scoreLabel={`${foundation.name} Health`}
                      scoreEvidence={foundationScoreDetails.has(foundation.id)
                        ? foundationScoreEvidence(foundationScoreDetails.get(foundation.id)!)
                        : 'Health unavailable'}
                      headingId={`finance-foundation-list-${foundation.id}`}
                      onSelect={() => setSelectedFoundationId(foundation.id)}
                    />
                  );
                })}
              </div>
            </section>
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
          <ToolZone
            className="money-goals-section finance-goals-section"
            headingId="finance-goals-heading"
            icon={<ToolZoneTrendingUpIcon />}
            purposeLabel="Progress tracker"
            subtitle="Track the outcomes your Rhythms support."
            scoringFootnote="Goal balances don’t change your Health score."
            headerAction={<button type="button" className="btn mini ghost" onClick={addGoal}>+ Add</button>}
          >
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
          </ToolZone>
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
                <button
                  type="button"
                  className="btn mini ghost"
                  onClick={() => setSelectedTab('overview')}
                >
                  View Foundations
                </button>
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
                onOpenFoundation={openFoundationOrCategory}
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
        </>
      )}

      {dialog?.kind === 'details' && detailsGoal && (
        <FinanceGoalDetailsDialog
          goal={detailsGoal}
          foundations={foundations}
          financeFoundationIds={financeFoundationIds}
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
          foundations={foundations}
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
          financeFoundationIds={financeFoundationIds}
          financeCategoryEnabled={financeCategoryEnabled}
          eligibleRhythms={eligibleGoalRhythms}
          rhythms={rhythms}
          archivedRhythms={archivedRhythms}
          onSave={changes => onSaveGoalRhythms(goalRhythmGoal.id, changes)}
          onCreateRhythm={event => {
            const goalId = goalRhythmGoal.id;
            setDialog(null);
            onCreateRhythmFromGoal(event, {
              goalId,
              ...(goalRhythmGoal.foundationId && financeFoundationIds.has(goalRhythmGoal.foundationId)
                ? { foundationId: goalRhythmGoal.foundationId }
                : {}),
              onFinished: () => setDialog({
                  kind: 'goal-rhythms',
                  goalId,
                  ...(dialog.returnToDetails ? { returnToDetails: true } : {})
              })
            });
          }}
          onClose={() => finishGoalDialog(goalRhythmGoal.id, dialog.returnToDetails)}
        />
      )}
      {dialog?.kind === 'foundation-rhythms' && (
        <FoundationRhythmAssociationDialog
          key={dialog.foundationId}
          foundation={financeFoundationList.find(foundation => foundation.id === dialog.foundationId)!}
          rhythms={[
            ...categoryRhythms.map(rhythm => ({ rhythm, archived: false })),
            ...archivedCategoryRhythms.map(rhythm => ({ rhythm, archived: true }))
          ]}
          onSave={changes => onSaveFoundationAssociations(dialog.foundationId, changes)}
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

function foundationScoreEvidence(score: FoundationScoreSelection): string {
  const active = score.activeLinkedRhythmIds.length;
  const archived = score.archivedRhythmIds.length;
  if (active === 0) {
    return archived > 0 ? `No active linked Rhythms · ${archived} archived` : 'No linked Rhythms';
  }
  const unresolved = score.unresolvedRhythmIds.length;
  const excluded = score.excludedRhythms.length;
  return [
    `${score.eligibleRhythmIds.length} of ${active} active linked Rhythms scored`,
    ...(unresolved ? [`${unresolved} unresolved`] : []),
    ...(excluded ? [`${excluded} not scoreable`] : []),
    ...(archived ? [`${archived} archived`] : [])
  ].join(' · ');
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
