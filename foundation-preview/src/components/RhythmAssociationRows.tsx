import {
  areas,
  foundationTerminologyForCategory,
  type FoundationPreview,
  type PersonId,
  type PersonPreview,
  type RhythmPreview
} from '../domain/preview-data.ts';
import {
  foundationCategoryId,
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
};

export function RhythmAssociationRows({
  rhythm,
  people,
  foundations,
  onPersonSelect,
  onOpenCategory,
  onOpenFoundation
}: RhythmAssociationRowsProps) {
  const categories = areas.filter(area => rhythm.categoryIds?.includes(area.id) === true);
  const resolvedLinks = foundations
    ? resolveRhythmFoundationLinks(rhythm, foundations)
    : undefined;
  const assignedCategoryIds = new Set(categories.map(category => category.id));
  const associationTerms = [...new Map(categories.map(category => {
    const term = foundationTerminologyForCategory(category.id);
    return [term.singular, term] as const;
  })).values()];
  const associationTerm = associationTerms.length === 1
    ? associationTerms[0]!
    : associationTerms.some(term => term.singular === 'Practice')
      ? { singular: 'Practice and Foundation', plural: 'Practices and Foundations' }
      : foundationTerminologyForCategory();
  const categoryGroups = categories.map(category => {
    const categoryFoundations = resolvedLinks?.foundations.filter(foundation =>
      foundationCategoryId(foundation.id, foundations) === category.id
    ) ?? [];
    return {
      category,
      rhythm: {
        ...rhythm,
        categoryIds: [category.id],
        primaryFoundationId: categoryFoundations[0]?.id ?? null,
        secondaryFoundationIds: categoryFoundations.slice(1).map(foundation => foundation.id)
      } satisfies RhythmPreview
    };
  });
  const ungroupedFoundationCount = resolvedLinks
    ? resolvedLinks.unresolvedIds.length + resolvedLinks.foundations.filter(foundation => {
      const categoryId = foundationCategoryId(foundation.id, foundations);
      return categoryId === undefined || !assignedCategoryIds.has(categoryId);
    }).length
    : 0;

  return (
    <>
      {people && people.length > 0 && onPersonSelect && (
        <div className="today-rhythm-details__association-people-row" role="group" aria-label={`People associated with ${rhythm.title}`}>
          <PersonBadgeList
            people={people}
            rhythmTitle={rhythm.title}
            onSelect={onPersonSelect}
            collapsedLimit={2}
            itemsOnly
          />
        </div>
      )}
      {categoryGroups.length > 0 && (
        <div className="today-rhythm-details__association-category-row">
          {categoryGroups.map(({ category, rhythm: categoryRhythm }) => (
            <div
              className="today-rhythm-details__association-category-group"
              key={category.id}
              role="group"
              aria-label={`${category.label} category and linked ${foundationTerminologyForCategory(category.id).plural}`}
            >
              <RhythmCategoryBadges
                rhythm={categoryRhythm}
                itemsOnly
                {...(onOpenCategory ? { onOpenCategory } : {})}
              />
              {foundations && onOpenFoundation && (
                <RhythmFoundationBadges
                  rhythm={categoryRhythm}
                  foundations={foundations}
                  onOpenFoundation={onOpenFoundation}
                />
              )}
            </div>
          ))}
        </div>
      )}
      {foundations && onOpenFoundation && ungroupedFoundationCount > 0 && (
        <span className="visually-hidden">
          {ungroupedFoundationCount} linked {ungroupedFoundationCount === 1
            ? associationTerm.singular
            : associationTerm.plural} could not be associated with an assigned Category.
        </span>
      )}
    </>
  );
}
