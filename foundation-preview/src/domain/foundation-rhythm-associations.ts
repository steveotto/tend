import {
  isMarriageFoundationId,
  type MarriageFoundationId,
  type RhythmPreview
} from './preview-data.ts';
import { rhythmTimeOptions } from './rhythm-schedule.ts';
import type { SavedRhythm } from './rhythm-editor.ts';

export type FoundationRhythmRole = 'none' | 'primary' | 'supporting';

export type FoundationRhythmAssociationChange = {
  rhythmId: string;
  role: FoundationRhythmRole;
};

export type FoundationRhythmAssociationResult =
  | { savedRhythms: SavedRhythm[] }
  | { error: string };

export function foundationRhythmRole(
  rhythm: Pick<RhythmPreview, 'primaryFoundationId' | 'secondaryFoundationIds'>,
  foundationId: string
): FoundationRhythmRole {
  if (rhythm.primaryFoundationId === foundationId) return 'primary';
  return rhythm.secondaryFoundationIds?.includes(foundationId) ? 'supporting' : 'none';
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
  const updates = new Map<string, FoundationRhythmRole>();
  for (const change of changes) {
    const rhythm = rhythmsById.get(change.rhythmId);
    if (!rhythm) return { error: 'A selected Rhythm is no longer available.' };
    if (seenChanges.has(change.rhythmId)) return { error: 'A Rhythm can only have one association choice.' };
    if (change.role !== 'none' && change.role !== 'primary' && change.role !== 'supporting') {
      return { error: 'Choose a valid association role.' };
    }
    seenChanges.add(change.rhythmId);
    updates.set(change.rhythmId, change.role);
  }

  const nextSaved = [...savedRhythms];
  for (const [rhythmId, role] of updates) {
    const rhythm = rhythmsById.get(rhythmId)!;
    const existing = savedById.get(rhythmId);
    const currentRole = foundationRhythmRole(rhythm, foundationId);
    const secondaryIds = rhythm.secondaryFoundationIds ?? [];
    if (secondaryIds.includes(rhythm.primaryFoundationId ?? '')) {
      return { error: 'This Rhythm has conflicting primary and supporting associations.' };
    }
    if (new Set(secondaryIds).size !== secondaryIds.length) {
      return { error: 'This Rhythm has duplicate supporting associations and cannot be changed safely.' };
    }
    if (archivedRhythmIds.includes(rhythmId) && role !== currentRole) {
      return { error: 'Restore this Rhythm before changing its Foundation associations.' };
    }
    if (role === 'primary' && rhythm.primaryFoundationId
      && rhythm.primaryFoundationId !== foundationId) {
      return { error: 'This Rhythm already has a different primary Foundation.' };
    }
    if (role === currentRole) continue;

    let primaryFoundationId = rhythm.primaryFoundationId ?? null;
    let nextSecondaryIds = [...secondaryIds];
    if (role === 'primary') {
      primaryFoundationId = foundationId;
      nextSecondaryIds = nextSecondaryIds.filter(id => id !== foundationId);
    } else if (role === 'supporting') {
      if (primaryFoundationId === foundationId) primaryFoundationId = null;
      if (!nextSecondaryIds.includes(foundationId)) nextSecondaryIds.push(foundationId);
    } else {
      if (primaryFoundationId === foundationId) primaryFoundationId = null;
      nextSecondaryIds = nextSecondaryIds.filter(id => id !== foundationId);
    }

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
