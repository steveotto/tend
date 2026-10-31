import { syntheticPeople } from './preview-data.ts';
import type { PersonId } from './preview-data.ts';

export type PersonNote = {
  id: string;
  personId: PersonId;
  sharedWith?: PersonId[];
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type PersonNoteDraft = {
  content: string;
  sharedWith: PersonId[];
};

export type PersonNoteCommandResult =
  | { valid: true; notes: PersonNote[] }
  | { valid: false; error: string };

const knownPeople = new Set<string>(syntheticPeople.map(person => person.id));
const maxNoteLength = 10_000;

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return false;
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return false;
  const canonical = timestamp.toISOString();
  return canonical === value || canonical.replace(/\.000Z$/, 'Z') === value;
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim() === value && value.length <= 160;
}

function validPersonId(value: unknown): value is PersonId {
  return typeof value === 'string' && knownPeople.has(value);
}

export function validatePersonNotesCollection(value: unknown): value is PersonNote[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return false;
    const note = item as Record<string, unknown>;
    if (Object.keys(note).some(key =>
      !['id', 'personId', 'sharedWith', 'content', 'createdAt', 'updatedAt'].includes(key)
    )) return false;
    const sharedWith = Array.isArray(note.sharedWith) ? note.sharedWith : [];
    if (!validId(note.id) || ids.has(note.id)
      || !validPersonId(note.personId)
      || (note.sharedWith !== undefined && !Array.isArray(note.sharedWith))
      || !sharedWith.every(validPersonId)
      || sharedWith.some(id => id === note.personId)
      || new Set(sharedWith).size !== sharedWith.length
      || typeof note.content !== 'string'
      || note.content.trim().length === 0
      || note.content.length > maxNoteLength
      || !isCanonicalTimestamp(note.createdAt)
      || !isCanonicalTimestamp(note.updatedAt)
      || Date.parse(note.updatedAt) < Date.parse(note.createdAt)) return false;
    ids.add(note.id);
  }
  return true;
}

export function personNotesForPerson(
  notes: readonly PersonNote[],
  personId: PersonId
): PersonNote[] {
  return notes
    .filter(note => note.personId === personId || note.sharedWith?.includes(personId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
}

export function personNoteDraft(note?: PersonNote): PersonNoteDraft {
  return {
    content: note?.content ?? '',
    sharedWith: [...(note?.sharedWith ?? [])]
  };
}

export function createPersonNote(
  notes: readonly PersonNote[],
  input: PersonNote & { sharedWith: PersonId[] }
): PersonNoteCommandResult {
  if (!validId(input.id) || notes.some(note => note.id === input.id)) {
    return { valid: false, error: 'A unique note ID is required.' };
  }
  if (!validPersonId(input.personId)) {
    return { valid: false, error: 'Choose an existing primary person.' };
  }
  if (typeof input.content !== 'string' || input.content.trim().length === 0 || input.content.length > maxNoteLength) {
    return { valid: false, error: 'Enter a note with no more than 10,000 characters.' };
  }
  if (!isCanonicalTimestamp(input.createdAt) || !isCanonicalTimestamp(input.updatedAt)
    || input.createdAt !== input.updatedAt) {
    return { valid: false, error: 'The note timestamp is invalid.' };
  }
  const sharedWith = normalizeSharedWith(input.sharedWith, input.personId);
  if (!sharedWith) return { valid: false, error: 'Choose valid, unique people to share this note with.' };
  return {
    valid: true,
    notes: [...notes, { ...input, sharedWith }]
  };
}

export function updatePersonNote(
  notes: readonly PersonNote[],
  noteId: string,
  expectedUpdatedAt: string,
  actorId: PersonId,
  draft: PersonNoteDraft,
  updatedAt: string
): PersonNoteCommandResult {
  const existing = notes.find(note => note.id === noteId);
  if (!existing || (existing.personId !== actorId && !existing.sharedWith?.includes(actorId))) {
    return { valid: false, error: 'This note is no longer available from this profile.' };
  }
  if (existing.updatedAt !== expectedUpdatedAt) {
    return { valid: false, error: 'This note changed while you were editing. Reload it before saving.' };
  }
  if (typeof draft.content !== 'string' || draft.content.trim().length === 0 || draft.content.length > maxNoteLength) {
    return { valid: false, error: 'Enter a note with no more than 10,000 characters.' };
  }
  if (!isCanonicalTimestamp(updatedAt) || Date.parse(updatedAt) < Date.parse(existing.createdAt)) {
    return { valid: false, error: 'The note timestamp is invalid.' };
  }
  const sharedWith = normalizeSharedWith(draft.sharedWith, existing.personId);
  if (!sharedWith) return { valid: false, error: 'Choose valid, unique people to share this note with.' };
  const unchanged = existing.content === draft.content
    && (existing.sharedWith ?? []).length === sharedWith.length
    && (existing.sharedWith ?? []).every((id, index) => id === sharedWith[index]);
  return {
    valid: true,
    notes: notes.map(note => note.id === noteId
      ? {
          ...note,
          content: draft.content,
          ...(sharedWith.length > 0 ? { sharedWith } : { sharedWith: [] }),
          updatedAt: unchanged ? note.updatedAt : updatedAt
        }
      : note)
  };
}

export function deletePersonNote(
  notes: readonly PersonNote[],
  noteId: string,
  expectedUpdatedAt: string,
  actorId: PersonId
): PersonNoteCommandResult {
  const existing = notes.find(note => note.id === noteId);
  if (!existing || (existing.personId !== actorId && !existing.sharedWith?.includes(actorId))) {
    return { valid: false, error: 'This note is no longer available from this profile.' };
  }
  if (existing.updatedAt !== expectedUpdatedAt) {
    return { valid: false, error: 'This note changed before it could be deleted. Review the latest version first.' };
  }
  return { valid: true, notes: notes.filter(note => note.id !== noteId) };
}

function normalizeSharedWith(
  sharedWith: readonly PersonId[],
  primaryPersonId: PersonId
): PersonId[] | null {
  if (!Array.isArray(sharedWith)
    || !sharedWith.every(validPersonId)
    || new Set(sharedWith).size !== sharedWith.length) return null;
  return sharedWith.filter(id => id !== primaryPersonId);
}

export function formatPersonNoteDate(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}
