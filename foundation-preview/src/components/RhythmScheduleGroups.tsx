import type { ReactNode } from 'react';
import type { RhythmPreview } from '../domain/preview-data.ts';
import { categoryRhythmGroup } from '../domain/category-rhythms.ts';
import type { CategoryRhythmGroupId } from '../domain/category-rhythms.ts';

const standardGroups = [
  { id: 'daily', title: 'Daily' },
  { id: 'weekly', title: 'Weekly' },
  { id: 'seasonal', title: 'Seasonal & Annual' }
] as const satisfies readonly { id: CategoryRhythmGroupId; title: string }[];

type Props = {
  rhythms: readonly RhythmPreview[];
  categoryToken: string;
  emptyCollectionMessage?: ReactNode;
  renderGroup: (rhythms: readonly RhythmPreview[], groupId: CategoryRhythmGroupId | null) => ReactNode;
};

export function RhythmScheduleGroups({
  rhythms,
  categoryToken,
  emptyCollectionMessage,
  renderGroup
}: Props) {
  const classifiedRhythms = rhythms.map(rhythm => ({
    rhythm,
    groupId: categoryRhythmGroup(rhythm)
  }));
  const groups: Array<{
    id: CategoryRhythmGroupId | 'unclassified';
    title: string;
    rhythms: RhythmPreview[];
    groupId: CategoryRhythmGroupId | null;
  }> = standardGroups.map(group => ({
    ...group,
    groupId: group.id,
    rhythms: classifiedRhythms
      .filter(item => item.groupId === group.id)
      .map(item => item.rhythm)
  }));
  if (classifiedRhythms.some(item => item.groupId === 'custom')) {
    groups.push({
      id: 'custom',
      title: 'Custom schedule',
      groupId: 'custom',
      rhythms: classifiedRhythms
        .filter(item => item.groupId === 'custom')
        .map(item => item.rhythm)
    });
  }
  if (classifiedRhythms.some(item => item.groupId === null)) {
    groups.push({
      id: 'unclassified',
      title: 'Unclassified schedule',
      groupId: null,
      rhythms: classifiedRhythms
        .filter(item => item.groupId === null)
        .map(item => item.rhythm)
    });
  }

  return (
    <>
      {emptyCollectionMessage}
      {groups.map(group => (
        <section
          key={group.id}
          className="marriage-recommendation-group"
          aria-labelledby={`${categoryToken}-group-${group.id}`}
        >
          <header>
            <h4 id={`${categoryToken}-group-${group.id}`}>{group.title}</h4>
            <span>{group.rhythms.length}</span>
          </header>
          {group.rhythms.length
            ? renderGroup(group.rhythms, group.groupId)
            : <p className="marriage-empty-state">No active Rhythms.</p>}
        </section>
      ))}
    </>
  );
}
