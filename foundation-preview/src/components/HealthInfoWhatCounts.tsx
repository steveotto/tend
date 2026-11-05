import { useId } from 'react';
import type { ReactNode } from 'react';
import { AreaIcon } from './AreaIcon.tsx';
import type { HealthRollupConfig, HealthRollupGroup, HealthRollupItem } from './HealthRollupDiagram.tsx';
import { MarriageIcon } from './MarriageIcon.tsx';

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
  children
}: {
  config: HealthRollupConfig;
  children?: ReactNode;
}) {
  const headingId = useId();
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
