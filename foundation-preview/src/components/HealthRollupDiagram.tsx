import { useState } from 'react';
import type { CategoryId } from '../domain/preview-data.ts';
import { AreaIcon } from './AreaIcon.tsx';
import { HealthWeightPanels } from './HealthWeightPanels.tsx';
import { MarriageIcon } from './MarriageIcon.tsx';

export type HealthRollupItem = {
  id: string;
  label: string;
  summary?: string;
  explanation?: string;
  details?: readonly string[];
  usesStandardWeights?: boolean;
  categoryIconId?: CategoryId;
  foundationIconId?: string;
  relatedItemIds?: Readonly<Record<string, readonly string[]>>;
};

export type HealthRollupGroup = {
  id: string;
  label: string;
  items: readonly HealthRollupItem[];
  emptyItem?: HealthRollupItem;
};

export type HealthRollupConfig = {
  groups: readonly HealthRollupGroup[];
  initialGroupId: string;
  initialItemId: string;
  footer?: readonly string[];
};

export function createHealthFitnessRollup(
  initialGroupId: string,
  initialItemId: string
): HealthRollupConfig {
  const foundationItems = [
    {
      id: 'strength',
      label: 'Strength',
      foundationIconId: 'health-strength',
      explanation: 'Eligible Strength-linked Rhythm scores are averaged for Consistency and On Track.',
      relatedItemIds: { 'rhythms-logs': ['strength-logs'], category: ['health-fitness'] }
    },
    {
      id: 'weight',
      label: 'Weight',
      foundationIconId: 'health-weight',
      explanation: 'Eligible scheduled Weight-linked weigh-in Rhythm scores are averaged for Consistency and On Track.',
      relatedItemIds: { 'rhythms-logs': ['weight-logs'], category: ['health-fitness'] }
    },
    {
      id: 'cardio',
      label: 'Cardio',
      foundationIconId: 'health-cardio',
      explanation: 'Cardio uses saved run logs to score weekly run and distance goals; completing a Rhythm alone is not a run.',
      relatedItemIds: { 'rhythms-logs': ['cardio-logs'], category: ['health-fitness'] }
    }
  ] satisfies readonly HealthRollupItem[];
  return {
    groups: [
      {
        id: 'rhythms-logs',
        label: 'Rhythms & logs',
        items: [
          {
            id: 'strength-logs',
            label: 'Workouts → Strength',
            summary: 'Saved workouts inform Strength measures; eligible linked Rhythms determine Health.',
            usesStandardWeights: false,
            explanation: 'Saved workouts feed Strength training measures. Eligible linked Rhythm scores determine Strength Health.',
            relatedItemIds: { foundations: ['strength'], category: ['health-fitness'] }
          },
          {
            id: 'weight-logs',
            label: 'Weigh-ins → Weight',
            summary: 'Scheduled linked weigh-in Rhythms determine Weight Health.',
            usesStandardWeights: false,
            explanation: 'Scheduled Weight-linked weigh-in Rhythms determine Weight Health; recorded weight and Goal Progress do not.',
            relatedItemIds: { foundations: ['weight'], category: ['health-fitness'] }
          },
          {
            id: 'cardio-logs',
            label: 'Runs → Cardio',
            summary: 'Cardio uses saved run logs against weekly run and distance goals.',
            usesStandardWeights: false,
            explanation: 'Cardio Health uses saved run logs to calculate weekly run and distance goal progress.',
            relatedItemIds: { foundations: ['cardio'], category: ['health-fitness'] }
          }
        ]
      },
      {
        id: 'foundations',
        label: 'Foundations',
        items: foundationItems
      },
      {
        id: 'category',
        label: 'Category',
        items: [{
          id: 'health-fitness',
          label: 'Health & Fitness',
          categoryIconId: 'health',
          explanation: 'Strength, Cardio, and Weight contribute equally to each available Consistency and On Track measure average.',
          relatedItemIds: { foundations: foundationItems.map(item => item.id) }
        }]
      }
    ],
    initialGroupId,
    initialItemId,
    footer: [
      'Strength, Cardio, and Weight contribute equally to available Consistency and On Track measures.',
      '— means unavailable; 0 is a valid score.'
    ]
  };
}

type Selection = Readonly<Record<string, string>>;

function itemsFor(group: HealthRollupGroup): readonly HealthRollupItem[] {
  if (group.items.length > 0) return group.items;
  return group.emptyItem ? [group.emptyItem] : [];
}

function emptyFallback(group: HealthRollupGroup): readonly HealthRollupItem[] {
  return group.emptyItem ? [group.emptyItem] : [];
}

function relatedItems(
  item: HealthRollupItem | undefined,
  groupId: string,
  items: readonly HealthRollupItem[]
): readonly HealthRollupItem[] {
  const relatedIds = item?.relatedItemIds?.[groupId];
  return relatedIds === undefined ? items : items.filter(candidate => relatedIds.includes(candidate.id));
}

function reconcileSelection(
  config: HealthRollupConfig,
  seedGroupId: string,
  seedItemId: string,
  previousSelection: Selection = {}
): Selection {
  const groups = config.groups;
  const visibleGroups = groups.filter(group => itemsFor(group).length > 0);
  if (visibleGroups.length === 0) return {};
  const selected: Record<string, string> = {};
  for (const group of visibleGroups) {
    const items = itemsFor(group);
    selected[group.id] = items.find(item => item.id === previousSelection[group.id])?.id
      ?? (group.emptyItem && group.emptyItem.id === previousSelection[group.id]
        ? group.emptyItem.id
        : undefined)
      ?? items[0]!.id;
  }

  let seedIndex = visibleGroups.findIndex(group => group.id === seedGroupId);
  if (seedIndex < 0) seedIndex = visibleGroups.findIndex(group => group.id === config.initialGroupId);
  if (seedIndex < 0) seedIndex = 0;
  const seedGroup = visibleGroups[seedIndex]!;
  const seedItem = itemsFor(seedGroup).find(item => item.id === seedItemId)
    ?? (seedGroup.emptyItem?.id === seedItemId ? seedGroup.emptyItem : undefined)
    ?? itemsFor(seedGroup).find(item => item.id === config.initialItemId)
    ?? itemsFor(seedGroup)[0]!;
  selected[seedGroup.id] = seedItem.id;

  for (let index = seedIndex + 1; index < visibleGroups.length; index += 1) {
    const parentGroup = visibleGroups[index]!;
    const childGroup = visibleGroups[index - 1]!;
    if (childGroup.emptyItem?.id === selected[childGroup.id]) continue;
    const parentItems = itemsFor(parentGroup);
    const matching = parentItems.filter(item =>
      item.relatedItemIds?.[childGroup.id]?.includes(selected[childGroup.id]!)
    );
    if (matching.length > 0) {
      const current = matching.find(item => item.id === selected[parentGroup.id]);
      selected[parentGroup.id] = (current ?? matching[0]!).id;
    }
  }

  for (let index = seedIndex - 1; index >= 0; index -= 1) {
    const group = visibleGroups[index]!;
    const parentGroup = visibleGroups[index + 1]!;
    const candidates = relatedItems(
      itemsFor(parentGroup).find(item => item.id === selected[parentGroup.id]),
      group.id,
      itemsFor(group)
    );
    const current = candidates.find(item => item.id === selected[group.id]);
    selected[group.id] = (current ?? candidates[0] ?? emptyFallback(group)[0] ?? itemsFor(group)[0]!).id;
  }

  return selected;
}

export function HealthRollupDiagram({ config }: { config: HealthRollupConfig }) {
  const [requestedSelection, setRequestedSelection] = useState<{
    groupId: string;
    itemId: string;
    selection: Selection;
  }>(() => ({
    groupId: config.initialGroupId,
    itemId: config.initialItemId,
    selection: reconcileSelection(config, config.initialGroupId, config.initialItemId)
  }));
  const selection = reconcileSelection(
    config,
    requestedSelection.groupId,
    requestedSelection.itemId,
    requestedSelection.selection
  );
  const groups = config.groups.filter(group => itemsFor(group).length > 0);

  function visibleItems(index: number): readonly HealthRollupItem[] {
    const group = groups[index]!;
    if (index === groups.length - 1) return itemsFor(group);
    const parentGroup = groups[index + 1]!;
    const parentItem = itemsFor(parentGroup).find(item => item.id === selection[parentGroup.id]);
    const matching = relatedItems(parentItem, group.id, itemsFor(group));
    return matching.length > 0 ? matching : emptyFallback(group);
  }

  function select(group: HealthRollupGroup, item: HealthRollupItem) {
    setRequestedSelection(current => ({
      groupId: group.id,
      itemId: item.id,
      selection: reconcileSelection(config, group.id, item.id, current.selection)
    }));
  }

  if (groups.length === 0) return null;

  return (
    <section className="health-rollup" aria-label="Health scoring relationships">
      {groups.slice().reverse().map((group, displayIndex) => {
        const index = groups.length - displayIndex - 1;
        const groupItems = visibleItems(index);
        const selectedItem = groupItems.find(item => item.id === selection[group.id])
          ?? groupItems[0];
        const featured = group.id === requestedSelection.groupId
          && selectedItem?.id === selection[group.id];
        const displayItems = groupItems.length > 0 ? groupItems : itemsFor(group);
        const itemIndex = displayItems.findIndex(item => item.id === selectedItem?.id);

        return (
          <div className="health-rollup__step" key={group.id}>
            {displayIndex > 0 && (
              <div className="health-rollup__arrow-row" aria-hidden="true">↑</div>
            )}
            <section className={`health-rollup__group${featured ? ' is-featured' : ''}`}>
              <h3 className="health-rollup__group-label">{group.label}</h3>
              {selectedItem && (
                <button
                  type="button"
                  className="health-rollup__item"
                  aria-pressed={featured}
                  onClick={() => select(group, selectedItem)}
                >
                  {selectedItem.categoryIconId && <AreaIcon id={selectedItem.categoryIconId} />}
                  {selectedItem.foundationIconId && (
                    <MarriageIcon group="foundations" id={selectedItem.foundationIconId} />
                  )}
                  <span>{selectedItem.label}</span>
                </button>
              )}
              {displayItems.length > 1 && selectedItem && (
                <div className="health-rollup__navigation" role="group" aria-label={`${group.label} navigation`}>
                  <button
                    type="button"
                    className="health-rollup__navigate"
                    aria-label={`Previous ${group.label.toLowerCase()}`}
                    disabled={itemIndex <= 0}
                    onClick={() => select(group, displayItems[itemIndex - 1]!)}
                  >‹</button>
                  <span aria-live="polite">{itemIndex + 1} of {displayItems.length}</span>
                  <button
                    type="button"
                    className="health-rollup__navigate"
                    aria-label={`Next ${group.label.toLowerCase()}`}
                    disabled={itemIndex >= displayItems.length - 1}
                    onClick={() => select(group, displayItems[itemIndex + 1]!)}
                  >›</button>
                </div>
              )}
              {featured && selectedItem && (
                <div className="health-rollup__feature" aria-live="polite">
                  <h4 className="visually-hidden">{selectedItem.label}</h4>
                  {selectedItem.usesStandardWeights === false
                    ? <p>{selectedItem.explanation}</p>
                    : (
                      <HealthWeightPanels
                        consistencyDescription="How regularly you follow through"
                        onTrackDescription="How caught up you are."
                      />
                    )}
                  {selectedItem.details?.map((detail, detailIndex) => (
                    <p key={`${selectedItem.id}-detail-${detailIndex}`}>{detail}</p>
                  ))}
                  {selectedItem.usesStandardWeights !== false && selectedItem.explanation && (
                    <p className="health-rollup__explanation">{selectedItem.explanation}</p>
                  )}
                </div>
              )}
            </section>
          </div>
        );
      })}
    </section>
  );
}
