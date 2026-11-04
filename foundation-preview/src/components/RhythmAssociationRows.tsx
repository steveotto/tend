import {
  areas,
  foundationTerminologyForCategory,
  type FoundationPreview,
  type PersonId,
  type PersonPreview,
  type RhythmPreview
} from '../domain/preview-data.ts';
import {
  resolveRhythmFoundationLinks
} from '../domain/foundation-rhythm-associations.ts';
import type { Destination } from './AppNavigation.tsx';
import { PersonBadgeList } from './PersonBadge.tsx';
import { RhythmCategoryBadges } from './RhythmCategoryBadges.tsx';
import { RhythmFoundationBadges } from './RhythmFoundationBadges.tsx';

type RhythmAssociationRowsProps = {
  rhythm: RhythmPreview;
  people?: readonly PersonPreview[];
  foundations?: readonly FoundationPreview[];
  onPersonSelect?: (personId: PersonId) => void;
  onOpenCategory?: (categoryId: Destination, openerId: string) => void;
  onOpenFoundation?: (foundationId: string, openerId: string) => void;
  showFoundationLinks?: boolean;
};

export function RhythmAssociationRows({
  rhythm,
  people,
  foundations,
  onPersonSelect,
  onOpenCategory,
  onOpenFoundation,
  showFoundationLinks = true
}: RhythmAssociationRowsProps) {
  const categories = areas.filter(area => rhythm.categoryIds?.includes(area.id) === true);
  const resolvedLinks = foundations
    ? resolveRhythmFoundationLinks(rhythm, foundations)
    : undefined;
  const assignedCategoryIds = new Set(categories.map(category => category.id));
  const categoryGroups = categories.map(category => ({
    category,
    linkedFoundations: resolvedLinks?.foundations.filter(foundation =>
      foundation.categoryId === category.id
    ) ?? []
  }));
  const unmatchedFoundations = resolvedLinks?.foundations.filter(foundation =>
    !assignedCategoryIds.has(foundation.categoryId)
  ) ?? [];
  const hasVisibleFoundationLinks = showFoundationLinks
    && (categoryGroups.some(group => group.linkedFoundations.length > 0) || unmatchedFoundations.length > 0);

  return (
    <>
      {((people?.length && onPersonSelect) || categoryGroups.length > 0
        || (showFoundationLinks && (unmatchedFoundations.length > 0 || (resolvedLinks?.unresolvedIds.length ?? 0) > 0))) ? (
        <div
          className="today-rhythm-details__association-metadata-row"
          role="group"
          aria-label={hasVisibleFoundationLinks
            ? `People, categories, and Foundations associated with ${rhythm.title}`
            : `People and categories associated with ${rhythm.title}`}
        >
          {people && people.length > 0 && onPersonSelect && (
            <div
              className="today-rhythm-details__association-people"
              role="group"
              aria-label={`People associated with ${rhythm.title}`}
            >
              <PersonBadgeList
                people={people}
                rhythmTitle={rhythm.title}
                onSelect={onPersonSelect}
                collapsedLimit={2}
                itemsOnly
              />
            </div>
          )}
          {categoryGroups.map(({ category, linkedFoundations }) => (
            <div
              className="today-rhythm-details__association-category-group"
              key={category.id}
              role="group"
              aria-label={showFoundationLinks && linkedFoundations.length > 0
                ? `${category.label} category and linked ${foundationTerminologyForCategory(category.id).plural}`
                : `${category.label} category`}
            >
              <RhythmCategoryBadges
                rhythm={{ ...rhythm, categoryIds: [category.id] }}
                {...(foundations ? { foundations } : {})}
                itemsOnly
                {...(onOpenCategory ? { onOpenCategory } : {})}
              />
              {showFoundationLinks && foundations && linkedFoundations.length > 0 && (
                <>
                  <RhythmFoundationBadges
                    rhythm={rhythmWithFoundationIds(rhythm, linkedFoundations.map(foundation => foundation.id))}
                    foundations={foundations}
                    presentation={onOpenFoundation ? 'interactive' : 'static'}
                    accessibleLabel={`${category.label} Foundations linked to ${rhythm.title}`}
                    {...(onOpenFoundation ? { onOpenFoundation } : {})}
                  />
                  <ul
                    className="today-rhythm-details__category-foundation-names"
                    aria-label={`${category.label} linked ${foundationTerminologyForCategory(category.id).plural}`}
                  >
                    {linkedFoundations.map(foundation => (
                      <li key={foundation.id}>{foundation.name}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}
          {showFoundationLinks && foundations && unmatchedFoundations.length > 0 && (
            <div
              className="today-rhythm-details__association-unmatched"
            >
              <RhythmFoundationBadges
                rhythm={rhythmWithFoundationIds(rhythm, unmatchedFoundations.map(foundation => foundation.id))}
                foundations={foundations}
                presentation={onOpenFoundation ? 'interactive' : 'static'}
                accessibleLabel={`Foundations without an assigned Category for ${rhythm.title}`}
                {...(onOpenFoundation ? { onOpenFoundation } : {})}
              />
            </div>
          )}
          {showFoundationLinks && resolvedLinks && resolvedLinks.unresolvedIds.length > 0 && (
            <span className="visually-hidden">
              {`${resolvedLinks.unresolvedIds.length} linked Foundation ${
                resolvedLinks.unresolvedIds.length === 1 ? 'reference could' : 'references could'
              } not be resolved to a Foundation record.`}
            </span>
          )}
        </div>
      ) : null}
    </>
  );
}

function rhythmWithFoundationIds(rhythm: RhythmPreview, foundationIds: readonly string[]): RhythmPreview {
  const ids = new Set(foundationIds);
  const primaryFoundationId = rhythm.primaryFoundationId && ids.has(rhythm.primaryFoundationId)
    ? rhythm.primaryFoundationId
    : foundationIds[0] ?? null;
  return {
    ...rhythm,
    primaryFoundationId,
    secondaryFoundationIds: foundationIds.filter(id => id !== primaryFoundationId)
  };
}
