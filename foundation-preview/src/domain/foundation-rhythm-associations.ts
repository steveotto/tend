import {
  foundationCatalogue,
  foundationTerminologyForCategory,
  type FoundationPreview,
  type RhythmPreview
} from './preview-data.ts';
import type { RhythmCategoryId, SavedRhythm } from './rhythm-editor.ts';

export type FoundationRhythmAssociationChange = {
  rhythmId: string;
  linked: boolean;
};

export type FoundationRhythmAssociationResult =
  | { savedRhythms: SavedRhythm[] }
  | { error: string };

export function foundationRhythmIds(
  rhythm: Pick<RhythmPreview, 'primaryFoundationId' | 'secondaryFoundationIds'>
): string[] {
  return [...new Set([
    ...(rhythm.primaryFoundationId ? [rhythm.primaryFoundationId] : []),
    ...(rhythm.secondaryFoundationIds ?? [])
  ])];
}

export function foundationCategoryId(
  foundationId: string,
  foundations: readonly FoundationPreview[] = foundationCatalogue
): RhythmCategoryId | undefined {
  const foundation = foundations.find(item => item.id === foundationId);
  return foundation?.categoryId;
}

export function foundationOwnershipError(
  categoryIds: readonly string[],
  foundationIds: readonly string[],
  foundations: readonly FoundationPreview[] = foundationCatalogue
): string | undefined {
  const unresolved = foundationIds.filter(id => !foundations.some(foundation => foundation.id === id));
  if (unresolved.length > 0) {
    const term = categoryIds.length === 1
      ? foundationTerminologyForCategory(categoryIds[0]).singular
      : foundationTerminologyForCategory().singular;
    const noun = `${term} links`;
    return `Remove or resolve unavailable ${noun} before saving: ${unresolved.join(', ')}.`;
  }

  const knownFoundations = foundationIds
    .map(id => foundations.find(foundation => foundation.id === id)!);
  const unassigned = knownFoundations.filter(foundation => {
    return !categoryIds.includes(foundation.categoryId);
  });
  if (unassigned.length === 0) return undefined;

  const names = [...new Set(unassigned.map(foundation => foundation.name))];
  const categories = [...new Set(unassigned.map(foundation => foundation.category))];
  const categoryInstruction = categories.length === 1
    ? `the ${categories[0]} category`
    : `these Categories: ${categories.join(', ')}`;
  const terms = [...new Set(unassigned.map(foundation =>
    foundationTerminologyForCategory(foundation.categoryId).singular
  ))];
  const linkTerm = terms.length === 1 ? terms[0]! : 'association';
  return `Assign ${categoryInstruction} or unlink these ${linkTerm} links: ${names.join(', ')}.`;
}

export function removeFoundationLinksForCategory(
  rhythm: Pick<RhythmPreview, 'primaryFoundationId' | 'secondaryFoundationIds'>,
  categoryId: RhythmCategoryId,
  foundations: readonly FoundationPreview[] = foundationCatalogue
): {
  primaryFoundationId: string | null;
  secondaryFoundationIds: string[];
  removedIds: string[];
} {
  const existingIds = foundationRhythmIds(rhythm);
  const removedIds = existingIds.filter(id => foundationCategoryId(id, foundations) === categoryId);
  const remainingIds = existingIds.filter(id => !removedIds.includes(id));
  const primaryFoundationId = rhythm.primaryFoundationId && remainingIds.includes(rhythm.primaryFoundationId)
    ? rhythm.primaryFoundationId
    : rhythm.primaryFoundationId
      ? remainingIds[0] ?? null
      : null;

  return {
    primaryFoundationId,
    secondaryFoundationIds: remainingIds.filter(id => id !== primaryFoundationId),
    removedIds
  };
}

export function resolveRhythmFoundationLinks(
  rhythm: Pick<RhythmPreview, 'primaryFoundationId' | 'secondaryFoundationIds'>,
  foundations: readonly FoundationPreview[]
): { foundations: FoundationPreview[]; unresolvedIds: string[] } {
  const linkedIds = foundationRhythmIds(rhythm);
  const linkedIdSet = new Set(linkedIds);
  const seen = new Set<string>();
  const resolved: FoundationPreview[] = [];

  for (const foundation of foundations) {
    if (!linkedIdSet.has(foundation.id) || seen.has(foundation.id)) continue;
    seen.add(foundation.id);
    resolved.push(foundation);
  }

  return {
    foundations: resolved,
    unresolvedIds: linkedIds.filter(id => !seen.has(id))
  };
}

export function isRhythmLinkedToFoundation(
  rhythm: Pick<RhythmPreview, 'primaryFoundationId' | 'secondaryFoundationIds'>,
  foundationId: string
): boolean {
  return foundationRhythmIds(rhythm).includes(foundationId);
}

export function saveFoundationRhythmAssociations(
  savedRhythms: readonly SavedRhythm[],
  rhythms: readonly RhythmPreview[],
  archivedRhythmIds: readonly string[],
  foundationId: string,
  changes: readonly FoundationRhythmAssociationChange[],
  foundations: readonly FoundationPreview[] = foundationCatalogue
): FoundationRhythmAssociationResult {
  if (!foundations.some(foundation => foundation.id === foundationId)) {
    return { error: 'This linked Practice or Foundation is unavailable.' };
  }

  const rhythmsById = new Map<string, RhythmPreview>();
  for (const rhythm of rhythms) {
    if (rhythmsById.has(rhythm.id)) return { error: 'A Rhythm appears more than once in the association list.' };
    rhythmsById.set(rhythm.id, rhythm);
  }

  const savedById = new Map<string, SavedRhythm>();
  for (const saved of savedRhythms) {
    if (savedById.has(saved.id)) return { error: 'A Rhythm has conflicting saved preview records.' };
    savedById.set(saved.id, saved);
  }

  const seenChanges = new Set<string>();
  const updates = new Map<string, boolean>();
  for (const change of changes) {
    const rhythm = rhythmsById.get(change.rhythmId);
    if (!rhythm) return { error: 'A selected Rhythm is no longer available.' };
    if (seenChanges.has(change.rhythmId)) return { error: 'A Rhythm can only have one association choice.' };
    if (typeof change.linked !== 'boolean') return { error: 'Choose whether this Rhythm is linked.' };
    seenChanges.add(change.rhythmId);
    updates.set(change.rhythmId, change.linked);
  }
  for (const rhythmId of updates.keys()) {
    if (!savedById.has(rhythmId)) return { error: 'A selected Rhythm is no longer available.' };
  }

  const nextSaved = [...savedRhythms];
  for (const [rhythmId, linked] of updates) {
    const rhythm = rhythmsById.get(rhythmId)!;
    const existing = savedById.get(rhythmId);
    const existingIds = foundationRhythmIds(rhythm);
    const currentLinked = existingIds.includes(foundationId);
    if (archivedRhythmIds.includes(rhythmId)) {
      if (linked !== currentLinked) {
        const term = foundationTerminologyForCategory(
          foundationCategoryId(foundationId, foundations)
        ).singular;
        return { error: `Restore this Rhythm before changing its ${term} associations.` };
      }
      continue;
    }
    if (linked === currentLinked) continue;

    if (!existing) return { error: 'A selected Rhythm is no longer available.' };
    const nextIds = linked ? [...existingIds, foundationId] : existingIds.filter(id => id !== foundationId);
    const ownershipError = foundationOwnershipError(existing.categoryIds, nextIds, foundations);
    if (ownershipError) return { error: ownershipError };
    const primaryFoundationId = rhythm.primaryFoundationId
      && nextIds.includes(rhythm.primaryFoundationId)
      ? rhythm.primaryFoundationId
      : nextIds[0] ?? null;
    const nextSecondaryIds = nextIds.filter(id => id !== primaryFoundationId);

    const saved: SavedRhythm = {
      ...existing,
      primaryFoundationId,
      secondaryFoundationIds: nextSecondaryIds
    };
    const savedIndex = nextSaved.findIndex(item => item.id === rhythmId);
    if (savedIndex < 0) nextSaved.push(saved);
    else nextSaved[savedIndex] = saved;
    savedById.set(rhythmId, saved);
  }

  return { savedRhythms: nextSaved };
}
