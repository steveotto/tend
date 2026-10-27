import {
  isMarriageFoundationId,
  type MarriageFoundationId,
  type RhythmPreview
} from './preview-data.ts';
import { rhythmTimeOptions } from './rhythm-schedule.ts';
import type { SavedRhythm } from './rhythm-editor.ts';

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
  foundationId: MarriageFoundationId,
  changes: readonly FoundationRhythmAssociationChange[]
): FoundationRhythmAssociationResult {
  if (!isMarriageFoundationId(foundationId)) return { error: 'This Marriage Foundation is unavailable.' };

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

  const nextSaved = [...savedRhythms];
  for (const [rhythmId, linked] of updates) {
    const rhythm = rhythmsById.get(rhythmId)!;
    const existing = savedById.get(rhythmId);
    const existingIds = foundationRhythmIds(rhythm);
    const currentLinked = existingIds.includes(foundationId);
    if (archivedRhythmIds.includes(rhythmId)) {
      if (linked !== currentLinked) {
        return { error: 'Restore this Rhythm before changing its Foundation associations.' };
      }
      continue;
    }
    if (linked === currentLinked) continue;

    const nextIds = linked === currentLinked
      ? existingIds
      : linked ? [...existingIds, foundationId] : existingIds.filter(id => id !== foundationId);
    const primaryFoundationId = rhythm.primaryFoundationId
      && nextIds.includes(rhythm.primaryFoundationId)
      ? rhythm.primaryFoundationId
      : nextIds[0] ?? null;
    const nextSecondaryIds = nextIds.filter(id => id !== primaryFoundationId);

    let base: SavedRhythm;
    if (existing) {
      base = existing;
    } else {
      const timeLabel = rhythmTimeOptions.find(option => option.label === rhythm.timeLabel)?.label;
      if (!rhythm.cadence || !timeLabel) {
        return { error: 'This Rhythm does not have enough schedule information to save its association.' };
      }
      base = {
        id: rhythm.id,
        title: rhythm.title,
        ...(rhythm.description === undefined ? {} : { description: rhythm.description }),
        cadence: rhythm.cadence,
        timeLabel,
        personIds: [...(rhythm.personIds ?? [])],
        categoryIds: [...(rhythm.categoryIds ?? [])],
        ...(rhythm.schedule === undefined ? {} : { schedule: rhythm.schedule }),
        ...(rhythm.scoring === undefined ? {} : { scoring: rhythm.scoring }),
        ...(rhythm.timeOfDay === undefined ? {} : { timeOfDay: rhythm.timeOfDay }),
        ...(rhythm.createdLocalDate === undefined ? {} : {
          createdLocalDate: rhythm.createdLocalDate,
          createdTimeZone: rhythm.createdTimeZone
        }),
        ...(rhythm.dailyBackfillAllowed === undefined ? {} : { dailyBackfillAllowed: rhythm.dailyBackfillAllowed }),
        ...(rhythm.personal === undefined ? {} : { personal: rhythm.personal })
      };
    }

    const saved: SavedRhythm = {
      ...base,
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
