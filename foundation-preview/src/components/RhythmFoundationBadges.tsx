import type { FoundationPreview, RhythmPreview } from '../domain/preview-data.ts';
import { foundationRhythmIds, foundationRhythmRole } from '../domain/foundation-rhythm-associations.ts';

export function RhythmFoundationBadges({
  rhythm,
  foundations
}: {
  rhythm: RhythmPreview;
  foundations: readonly FoundationPreview[];
}) {
  const linkedIds = foundationRhythmIds(rhythm);
  if (linkedIds.length === 0) return null;

  const foundationById = new Map(foundations.map(foundation => [foundation.id, foundation]));
  const resolved = linkedIds
    .map(id => foundationById.get(id))
    .filter((foundation): foundation is FoundationPreview => foundation !== undefined);
  const unresolvedCount = linkedIds.length - resolved.length;
  const duplicateCount = linkedIds.length - new Set(linkedIds).size;

  return (
    <div className="rhythm-foundation-badges" role="group" aria-label={`Foundations linked to ${rhythm.title}`}>
      {resolved.map((foundation, index) => {
        const role = foundationRhythmRole(rhythm, foundation.id);
        const roleLabel = role === 'primary' ? 'Primary' : 'Supporting';
        return (
          <span className="rhythm-foundation-badge" key={`${foundation.id}-${index}`}>
            {roleLabel} · {foundation.name}
          </span>
        );
      })}
      {unresolvedCount > 0 && (
        <span className="visually-hidden" role="status">
          {unresolvedCount} linked Foundation {unresolvedCount === 1 ? 'reference could' : 'references could'} not be resolved.
        </span>
      )}
      {duplicateCount > 0 && (
        <span className="visually-hidden" role="status">
          {duplicateCount} duplicate Foundation {duplicateCount === 1 ? 'association reference was' : 'association references were'} found.
        </span>
      )}
    </div>
  );
}
