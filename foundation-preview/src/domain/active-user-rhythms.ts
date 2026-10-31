import type { RhythmPreview } from './preview-data.ts';

export function selectActiveUserRhythms(
  candidates: readonly RhythmPreview[],
  savedRhythmIds: readonly string[],
  archivedRhythmIds: readonly string[]
): RhythmPreview[] {
  const archivedIds = new Set(archivedRhythmIds);
  return selectSavedUserRhythms(candidates, savedRhythmIds)
    .filter(rhythm => !archivedIds.has(rhythm.id));
}

export function selectArchivedUserRhythms(
  candidates: readonly RhythmPreview[],
  savedRhythmIds: readonly string[],
  archivedRhythmIds: readonly string[]
): RhythmPreview[] {
  const archivedIds = new Set(archivedRhythmIds);
  return selectSavedUserRhythms(candidates, savedRhythmIds)
    .filter(rhythm => archivedIds.has(rhythm.id));
}

function selectSavedUserRhythms(
  candidates: readonly RhythmPreview[],
  savedRhythmIds: readonly string[]
): RhythmPreview[] {
  const savedIds = new Set(savedRhythmIds);
  const seenIds = new Set<string>();

  return candidates.filter(rhythm => {
    if (!savedIds.has(rhythm.id) || seenIds.has(rhythm.id)) return false;
    seenIds.add(rhythm.id);
    return true;
  });
}
