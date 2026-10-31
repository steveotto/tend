import { describe, expect, it } from 'vitest';
import {
  createPersonNote,
  deletePersonNote,
  personNotesForPerson,
  validatePersonNotesCollection,
  updatePersonNote
} from '../src/domain/person-notes.ts';
import type { PersonNote } from '../src/domain/person-notes.ts';

const createdAt = '2026-10-31T12:00:00.000Z';

function note(overrides: Partial<PersonNote> = {}): PersonNote {
  return {
    id: 'person-note-one',
    personId: 'sample-person-avery',
    sharedWith: ['sample-person-morgan'],
    content: 'First line\nSecond line',
    createdAt,
    updatedAt: createdAt,
    ...overrides
  };
}

describe('person-linked notes domain', () => {
  it('projects one primary-owned record into each linked person and orders by update time', () => {
    const older = note({ id: 'note-old', updatedAt: '2026-10-29T12:00:00.000Z' });
    const newer = note({ id: 'note-new', updatedAt: '2026-10-30T12:00:00.000Z' });
    const data = [older, newer];

    expect(personNotesForPerson(data, 'sample-person-avery')).toEqual([newer, older]);
    expect(personNotesForPerson(data, 'sample-person-morgan')).toEqual([newer, older]);
    expect(personNotesForPerson(data, 'sample-person-jordan')).toEqual([]);
    expect(data).toEqual([older, newer]);
  });

  it('creates exactly one note, excludes primary duplication, and preserves plain text', () => {
    const result = createPersonNote([], {
      ...note({
        content: '<script>not executable</script>\nKeep formatting'
      }),
      sharedWith: ['sample-person-avery', 'sample-person-morgan']
    });

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]).toMatchObject({
      personId: 'sample-person-avery',
      sharedWith: ['sample-person-morgan'],
      content: '<script>not executable</script>\nKeep formatting',
      createdAt,
      updatedAt: createdAt
    });
  });

  it('edits the same record from a linked profile while keeping primary ownership and creation time', () => {
    const existing = note();
    const result = updatePersonNote(
      [existing],
      existing.id,
      existing.updatedAt,
      'sample-person-morgan',
      { content: 'Edited by a secondary person', sharedWith: ['sample-person-avery', 'sample-person-jordan'] },
      '2026-10-31T14:00:00.000Z'
    );

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]).toEqual({
      ...existing,
      sharedWith: ['sample-person-jordan'],
      content: 'Edited by a secondary person',
      updatedAt: '2026-10-31T14:00:00.000Z'
    });
    expect(personNotesForPerson(result.notes, 'sample-person-morgan')).toEqual([]);
    expect(personNotesForPerson(result.notes, 'sample-person-avery')).toHaveLength(1);
    expect(personNotesForPerson(result.notes, 'sample-person-jordan')).toHaveLength(1);
  });

  it('retains the current timestamp for an unchanged save and rejects stale edits', () => {
    const existing = note();
    const unchanged = updatePersonNote(
      [existing], existing.id, existing.updatedAt, existing.personId,
      { content: existing.content, sharedWith: [...(existing.sharedWith ?? [])] },
      '2026-10-31T15:00:00.000Z'
    );
    expect(unchanged.valid && unchanged.notes[0]?.updatedAt).toBe(existing.updatedAt);

    expect(updatePersonNote(
      [existing], existing.id, '2026-10-30T12:00:00.000Z', existing.personId,
      { content: 'Do not overwrite', sharedWith: [] }, '2026-10-31T15:00:00.000Z'
    )).toMatchObject({ valid: false });
  });

  it('rejects blank content, malformed dates, duplicate IDs and unresolved people', () => {
    expect(createPersonNote([], {
      ...note({ content: ' \n ' }),
      sharedWith: []
    })).toMatchObject({ valid: false });
    expect(validatePersonNotesCollection([note({ createdAt: '2026-02-30T12:00:00.000Z' })])).toBe(false);
    expect(validatePersonNotesCollection([note(), note()])).toBe(false);
    expect(validatePersonNotesCollection([note({ personId: 'unresolved-person' as PersonNote['personId'] })])).toBe(false);
    expect(validatePersonNotesCollection([note({ sharedWith: ['sample-person-avery'] })])).toBe(false);
    expect(validatePersonNotesCollection([note({ sharedWith: ['sample-person-morgan', 'sample-person-morgan'] })])).toBe(false);
  });

  it('deletes only the expected version when initiated from a linked profile', () => {
    const existing = note();
    expect(deletePersonNote([existing], existing.id, existing.updatedAt, 'sample-person-morgan'))
      .toEqual({ valid: true, notes: [] });
    expect(deletePersonNote([existing], existing.id, '2026-10-30T12:00:00.000Z', existing.personId))
      .toMatchObject({ valid: false });
    expect(deletePersonNote([existing], existing.id, existing.updatedAt, 'sample-person-jordan'))
      .toMatchObject({ valid: false });
  });
});
