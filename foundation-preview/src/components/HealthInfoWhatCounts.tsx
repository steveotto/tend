import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CategoryHealthBadge } from './Cards.tsx';
import { AreaIcon } from './AreaIcon.tsx';
import type { HealthRollupConfig, HealthRollupGroup, HealthRollupItem } from './HealthRollupDiagram.tsx';
import { MarriageIcon } from './MarriageIcon.tsx';
import { RhythmRepeatIcon } from './RhythmMetadata.tsx';
import { HealthScoreInfoButton } from './HealthScoreBreakdown.tsx';
import { HealthDetailsExpandableHeader } from './HealthDetailsExpandableHeader.tsx';
import { HealthScoreDetailsDialog, useHealthDetailsNestedDialog } from './HealthScoreDetailsDialog.tsx';
import type { RhythmContributionItem } from '../domain/rhythm-contribution.ts';
import type { HealthContributionDiagram } from '../domain/rhythm-contribution.ts';

function connectedItems(
  group: HealthRollupGroup,
  relatedIds: readonly string[],
  relatedGroupId: string
): readonly HealthRollupItem[] {
  const matching = group.items.filter(item =>
    item.relatedItemIds?.[relatedGroupId]?.some(id => relatedIds.includes(id))
  );
  return matching.length > 0 ? matching : group.emptyItem ? [group.emptyItem] : [];
}

function selectFlow(config: HealthRollupConfig): ReadonlyMap<string, readonly HealthRollupItem[]> {
  const groups = config.groups;
  const seedIndex = groups.findIndex(group => group.id === config.initialGroupId);
  const selected = new Map<string, readonly HealthRollupItem[]>();
  if (seedIndex < 0) return selected;

  const seedGroup = groups[seedIndex]!;
  const seedItem = seedGroup.items.find(item => item.id === config.initialItemId)
    ?? (seedGroup.emptyItem?.id === config.initialItemId ? seedGroup.emptyItem : undefined)
    ?? seedGroup.items[0];
  if (!seedItem) return selected;
  selected.set(seedGroup.id, [seedItem]);

  for (let index = seedIndex + 1; index < groups.length; index += 1) {
    const source = groups[index - 1]!;
    const target = groups[index]!;
    const sourceItems = selected.get(source.id) ?? [];
    const relatedIds = sourceItems.flatMap(item => item.relatedItemIds?.[target.id] ?? []);
    const items = target.items.filter(item => relatedIds.includes(item.id));
    if (items.length > 0) selected.set(target.id, items);
  }

  for (let index = seedIndex - 1; index >= 0; index -= 1) {
    const target = groups[index]!;
    const source = groups[index + 1]!;
    const sourceIds = (selected.get(source.id) ?? []).map(item => item.id);
    const items = connectedItems(target, sourceIds, source.id);
    if (items.length > 0) selected.set(target.id, items);
  }

  return selected;
}

function FlowItem({ item }: { item: HealthRollupItem }) {
  return (
    <div className="health-info-what-counts__item">
      {item.categoryIconId && <AreaIcon id={item.categoryIconId} />}
      {item.foundationIconId && (
        <MarriageIcon group="foundations" id={item.foundationIconId} />
      )}
      <strong>{item.label}</strong>
    </div>
  );
}

function ContributionItem({
  item,
  kind,
  current
}: {
  item: RhythmContributionItem;
  kind: 'overall' | 'category' | 'foundation' | 'rhythm' | 'linked-rhythms' | 'person-area';
  current: boolean;
}) {
  const scoreLabel = item.score === null
    ? `${item.label} score unavailable`
    : `${item.label} score ${Math.round(item.score)} out of 100`;
  return (
    <div className={`health-info-what-counts__contribution-item${current ? ' is-current' : ''}`}>
      {item.categoryIconId && <AreaIcon id={item.categoryIconId} />}
      {item.foundationIconId && (
        <MarriageIcon group="foundations" id={item.foundationIconId} />
      )}
      {(kind === 'rhythm' || kind === 'linked-rhythms') && (
        <span className="health-info-what-counts__rhythm-icon" aria-hidden="true">
          <RhythmRepeatIcon />
        </span>
      )}
      {kind === 'overall' && (
        <span className="health-info-what-counts__overall-icon" aria-hidden="true">♥</span>
      )}
      <span className="health-info-what-counts__contribution-copy">
        <strong>{item.label}</strong>
        {current && <span className="visually-hidden">Current item</span>}
        {item.categoryLabel && <span>{item.categoryLabel}</span>}
      </span>
      {item.showScore !== false && (
        <CategoryHealthBadge
          score={item.score}
          appearance="rounded"
          accessibleLabel={scoreLabel}
        />
      )}
    </div>
  );
}

function ContributionFlow({
  diagram,
  children,
  initiallyExpanded
}: {
  diagram: HealthContributionDiagram;
  children?: ReactNode;
  initiallyExpanded: boolean;
}) {
  const headingId = useId();
  const contentId = useId();
  const scoringInfoId = useId();
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [scoringInfoOpen, setScoringInfoOpen] = useState(false);
  const scoringInfoButtonRef = useRef<HTMLButtonElement>(null);
  const setParentDialogInert = useHealthDetailsNestedDialog();
  const scoringInfo = diagram.scoringInfo;
  const groups = diagram.personOverallHealth
    ? [
        {
          id: 'overall',
          label: 'Overall Health',
          items: [{
            id: 'person-overall-health',
            label: 'Your overall Health',
            score: diagram.overallScore
          }],
          kind: 'overall' as const,
          emptyLabel: ''
        },
        {
          id: 'categories',
          label: 'Category',
          items: [{
            id: 'person-category',
            label: diagram.personOverallHealth.categoryLabel ?? 'Category',
            score: null,
            showScore: false
          }],
          kind: 'category' as const,
          emptyLabel: ''
        },
        {
          id: 'people-list',
          label: 'People list',
          items: [{
            id: 'person-list-item',
            label: diagram.personOverallHealth.name,
            score: null,
            showScore: false
          }],
          kind: 'person-area' as const,
          emptyLabel: ''
        }
      ]
    : diagram.personHealth
    ? [
        {
          id: 'overall',
          label: 'Overall Health',
          items: [{
            id: 'person-overall-health',
            label: `${diagram.personHealth.name}’s Overall Health`,
            score: diagram.overallScore
          }],
          kind: 'overall' as const,
          emptyLabel: ''
        },
        {
          id: 'person-area',
          label: `${diagram.personHealth.areaLabel} Health`,
          items: [{
            id: 'person-area-health',
            label: `${diagram.personHealth.areaLabel} Health`,
            score: diagram.personHealth.areaScore
          }],
          kind: 'person-area' as const,
          emptyLabel: ''
        }
      ]
    : [
        {
          id: 'overall',
          label: 'Overall Health',
          items: [{ id: 'overall-health', label: 'Your overall Health', score: diagram.overallScore }],
          kind: 'overall' as const,
          emptyLabel: ''
        },
        {
          id: 'categories',
          label: 'Categories',
          items: diagram.categories,
          kind: 'category' as const,
          emptyLabel: diagram.categories.some(item => item.label.includes('(unresolved)'))
            || diagram.foundations.some(item => item.label.includes('(unresolved)'))
            ? 'Category link unavailable for unresolved Foundations.'
            : 'No linked Categories.'
        },
        {
          id: 'foundations',
          label: 'Practices & Foundations',
          items: diagram.foundations,
          kind: 'foundation' as const,
          emptyLabel: 'No linked Practices or Foundations contribute to scoring.'
        },
        {
          id: diagram.highlightedGroup === 'rhythm' ? 'rhythm' : 'linked-rhythms',
          label: diagram.bottomGroupLabel,
          items: [diagram.bottomItem],
          kind: diagram.highlightedGroup === 'rhythm' ? 'rhythm' as const : 'linked-rhythms' as const,
          emptyLabel: ''
        }
      ];

  return (
    <section
      className="health-info-what-counts health-info-what-counts--rhythm"
      aria-labelledby={headingId}
    >
      <HealthDetailsExpandableHeader
        id={headingId}
        contentId={contentId}
        title={diagram.heading}
        expanded={expanded}
        onToggle={() => setExpanded(value => !value)}
      />
      <div id={contentId} hidden={!expanded}>
        <div className="health-info-what-counts__contribution-flow">
          {groups.map((group, index) => (
            <div className="health-info-what-counts__contribution-step" key={group.id}>
              {index > 0 && (
                <div className="health-info-what-counts__contribution-arrow" aria-hidden="true">↑</div>
              )}
              <section className={`health-info-what-counts__contribution-group health-info-what-counts__contribution-group--${group.id}${group.id === diagram.highlightedGroup ? ' is-featured' : ''}`}>
                <div className="health-info-what-counts__contribution-heading">
                  <h4>{group.label}</h4>
                  {scoringInfo?.groupId === group.id && (
                    <HealthScoreInfoButton
                      ref={scoringInfoButtonRef}
                      label={scoringInfo.triggerLabel}
                      expanded={scoringInfoOpen}
                      controls={scoringInfoId}
                      onClick={() => {
                        setScoringInfoOpen(true);
                        setParentDialogInert(true);
                      }}
                    />
                  )}
                </div>
                <div className="health-info-what-counts__contribution-items">
                  {group.items.map(item => (
                    <ContributionItem
                      key={item.id}
                      item={item}
                      kind={group.kind}
                      current={group.id === diagram.highlightedGroup && item.id === diagram.highlightedItemId}
                    />
                  ))}
                  {group.items.length === 0 && (
                    <p className="health-info-what-counts__contribution-empty">{group.emptyLabel}</p>
                  )}
                </div>
              </section>
            </div>
          ))}
        </div>
        {diagram.personHealth && !diagram.personHealth.contributes && (
          <p className="health-info-what-counts__person-unavailable">
            {diagram.personHealth.areaLabel} Health is unavailable and is left out of Overall Health.
          </p>
        )}
      </div>
      {scoringInfoOpen && scoringInfo && (
        <HealthScoreDetailsDialog
          title={scoringInfo.title}
          closeLabel="Close scoring explanation"
          className="health-scoring-info-dialog"
          phoneFullScreen={false}
          onClose={() => {
            setScoringInfoOpen(false);
            setParentDialogInert(false);
            requestAnimationFrame(() => scoringInfoButtonRef.current?.focus({ preventScroll: true }));
          }}
        >
          <div
            id={scoringInfoId}
            className="health-scoring-info-dialog__content"
            role="region"
            aria-label={`${scoringInfo.title} details`}
          >
            {scoringInfo.coverage && (
              <p className="health-scoring-info-dialog__coverage">{scoringInfo.coverage}</p>
            )}
            {scoringInfo.paragraphs?.map((paragraph, index) => (
              <p key={`scoring-info-${index}`}>{paragraph}</p>
            ))}
            {children}
          </div>
        </HealthScoreDetailsDialog>
      )}
    </section>
  );
}

type FlowLevel = {
  label: string;
  item?: HealthRollupItem;
  value?: string;
};

function rhythmGroupLabel(group: HealthRollupGroup): string {
  return group.id === 'rhythms' ? 'Linked Rhythms' : group.label;
}

function flowLevels(config: HealthRollupConfig): readonly FlowLevel[] {
  const groups = config.groups;
  const seedIndex = groups.findIndex(group => group.id === config.initialGroupId);
  if (seedIndex < 0) return [];
  const seedGroup = groups[seedIndex]!;
  const selected = selectFlow(config);
  const seedItem = selected.get(seedGroup.id)?.[0];

  if (seedGroup.id === 'rhythms') {
    return [
      { label: 'Rhythm', ...(seedItem ? { item: seedItem } : {}) },
      { label: 'Scheduled completions' }
    ];
  }

  if (seedGroup.id === 'foundations') {
    const rhythmGroup = groups.slice(0, seedIndex).find(group =>
      group.id === 'rhythms' || group.id === 'rhythms-logs'
    ) ?? groups[seedIndex - 1];
    if (!rhythmGroup) return [{ label: seedGroup.label, ...(seedItem ? { item: seedItem } : {}) }];
    const rhythmItems = selected.get(rhythmGroup.id) ?? [];
    const hasNoRhythms = rhythmItems.some(item => item.id === rhythmGroup.emptyItem?.id);
    const rhythmInputLabel = seedItem?.id === 'cardio'
      ? 'Run logs'
      : seedItem?.id === 'strength' || seedItem?.id === 'weight'
        ? 'Linked Rhythms'
        : rhythmGroupLabel(rhythmGroup);
    return [
      { label: seedGroup.label, ...(seedItem ? { item: seedItem } : {}) },
      {
        label: rhythmInputLabel,
        ...(hasNoRhythms ? { value: 'No linked Rhythms' } : {})
      }
    ];
  }

  return groups
    .slice(0, seedIndex + 1)
    .reverse()
    .map(group => {
      const item = selected.get(group.id)?.[0];
      return {
        label: rhythmGroupLabel(group),
        ...(group === seedGroup && item ? { item } : {})
      };
    });
}

export function HealthInfoWhatCounts({
  config,
  children,
  initialContributionExpanded = true
}: {
  config: HealthRollupConfig;
  children?: ReactNode;
  initialContributionExpanded?: boolean;
}) {
  const headingId = useId();
  const diagram = config.healthContribution ?? (config.rhythmContribution
    ? {
        heading: 'How this Rhythm contributes',
        highlightedGroup: 'rhythm' as const,
        highlightedItemId: config.rhythmContribution.rhythm.id,
        overallScore: config.rhythmContribution.overallScore,
        categories: config.rhythmContribution.categories,
        foundations: config.rhythmContribution.foundations,
        bottomGroupLabel: 'Rhythm',
        bottomItem: config.rhythmContribution.rhythm,
        identity: {
          name: config.rhythmContribution.rhythm.label,
          icon: { kind: 'rhythm' as const }
        },
        ...(config.scoringInfo ? { scoringInfo: config.scoringInfo } : {})
      }
    : undefined);
  if (diagram) {
    return (
      <ContributionFlow
        key={`${diagram.highlightedGroup}:${diagram.identity.name}`}
        diagram={diagram}
        initiallyExpanded={initialContributionExpanded}
      >
        {children}
      </ContributionFlow>
    );
  }
  const levels = flowLevels(config);
  if (levels.length === 0) return null;

  return (
    <section className="health-info-what-counts" aria-labelledby={headingId}>
      <h3 id={headingId}>What counts</h3>
      <div className="health-info-what-counts__flow">
        {levels.map((level, index) => (
          <div className="health-info-what-counts__step" key={`level-${index}`}>
            {index > 0 && (
              <div className="health-info-what-counts__arrow" aria-hidden="true">↑</div>
            )}
            <section className="health-info-what-counts__group">
              <h4>{level.label}</h4>
              <div className="health-info-what-counts__items">
                {level.item && <FlowItem item={level.item} />}
                {level.value && <strong>{level.value}</strong>}
              </div>
            </section>
          </div>
        ))}
      </div>
      {children && <div className="health-info-what-counts__notes">{children}</div>}
    </section>
  );
}
