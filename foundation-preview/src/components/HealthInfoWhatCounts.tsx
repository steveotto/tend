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

function FlowItem({
  item,
  showExplanation
}: {
  item: HealthRollupItem;
  showExplanation: boolean;
}) {
  return (
    <div className="health-info-what-counts__item">
      {item.categoryIconId && <AreaIcon id={item.categoryIconId} />}
      {item.foundationIconId && (
        <MarriageIcon group="foundations" id={item.foundationIconId} />
      )}
      <strong>{item.label}</strong>
      {showExplanation && item.summary && <p>{item.summary}</p>}
    </div>
  );
}

export function HealthInfoWhatCounts({
  config,
  children
}: {
  config: HealthRollupConfig;
  children?: ReactNode;
}) {
  const headingId = useId();
  const selected = selectFlow(config);
  const groups = config.groups.filter(group => selected.has(group.id));
  if (groups.length === 0) return null;

  return (
    <section className="health-info-what-counts" aria-labelledby={headingId}>
      <h3 id={headingId}>What counts</h3>
      <div className="health-info-what-counts__flow">
        {config.initialGroupId === 'rhythms' && (
          <div className="health-info-what-counts__step">
            <section className="health-info-what-counts__group">
              <h4>Scheduled completions</h4>
            </section>
          </div>
        )}
        {groups.map((group, index) => (
          <div className="health-info-what-counts__step" key={group.id}>
            {(index > 0 || config.initialGroupId === 'rhythms') && (
              <div className="health-info-what-counts__arrow" aria-hidden="true">↑</div>
            )}
            <section className="health-info-what-counts__group">
              <h4>{group.label}</h4>
              <div className="health-info-what-counts__items">
                {(selected.get(group.id) ?? []).map(item => (
                  <FlowItem
                    key={item.id}
                    item={item}
                    showExplanation={item.usesStandardWeights === false}
                  />
                ))}
              </div>
            </section>
          </div>
        ))}
      </div>
      {children && <div className="health-info-what-counts__notes">{children}</div>}
    </section>
  );
}
