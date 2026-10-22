import { describe, expect, it } from 'vitest';
import { todayRhythms } from '../src/domain/preview-data.ts';
import {
  activeTodayRhythms,
  archiveRhythmId,
  archivedTodayRhythms,
  isEditableRhythmId,
  resolveTodayRhythms,
  rhythmDraftFrom,
  rhythmsForCategory,
  restoreRhythmId,
  saveRhythmDraft,
  validateRhythmDraft,
  validateSavedRhythms
} from '../src/domain/rhythm-editor.ts';
import type { RhythmDraft } from '../src/domain/rhythm-editor.ts';

const validDraft: RhythmDraft = {
  title: 'Walk after lunch',
  description: 'A short synthetic example.',
  cadence: '3 times a week',
  timeLabel: 'Afternoon',
  personIds: ['sample-person-avery'],
  categoryIds: ['marriage']
};

describe('synthetic Rhythm editor domain', () => {
  it('validates title, description, cadence, time, and identity associations', () => {
    expect(validateRhythmDraft({ ...validDraft })).toEqual({});
    expect(validateRhythmDraft({
      ...validDraft,
      title: '  ',
      description: 'x'.repeat(1001),
      cadence: 'Monthly',
      timeLabel: 'Overnight',
      personIds: ['not-a-synthetic-person'],
      categoryIds: ['not-a-category']
    } as unknown as RhythmDraft)).toMatchObject({
      title: expect.any(String),
      description: expect.any(String),
      cadence: expect.any(String),
      timeLabel: expect.any(String),
      personIds: expect.any(String),
      categoryIds: expect.any(String)
    });
  });

  it('creates a stable namespaced identity and resolves its category and people associations', () => {
    const id = 'user-rhythm-11111111-1111-4111-8111-111111111111';
    const result = saveRhythmDraft([], { ...validDraft }, id, 'create');
    expect(result.errors).toEqual({});
    expect(result.savedRhythms?.[0]).toEqual({ id, ...validDraft });
    expect(isEditableRhythmId(id)).toBe(true);
    const resolved = resolveTodayRhythms(result.savedRhythms ?? []);
    expect(resolved.at(-1)).toMatchObject({
      id,
      title: validDraft.title,
      personIds: ['sample-person-avery'],
      categoryIds: ['marriage'],
      automation: 'manual',
      status: 'Due today'
    });
    expect(rhythmsForCategory(resolved, 'marriage').map(rhythm => rhythm.id)).toEqual([id]);
  });

  it('edits an existing fixture with the same identity and overlays only editable fields', () => {
    const fixture = todayRhythms[0]!;
    const edit = { ...validDraft, title: 'Prayer together' };
    const result = saveRhythmDraft([], edit, fixture.id, 'edit');
    expect(result.errors).toEqual({});
    const resolved = resolveTodayRhythms(result.savedRhythms ?? []);
    expect(resolved[0]).toMatchObject({
      id: fixture.id,
      title: edit.title,
      cadence: edit.cadence,
      timeLabel: edit.timeLabel,
      automation: fixture.automation,
      status: fixture.status,
      description: edit.description
    });
    expect(resolved[0]?.completionHistory).toBe(fixture.completionHistory);
    expect(resolved[0]?.illustrativeScore).toBe(fixture.illustrativeScore);
  });

  it('refuses duplicate custom IDs, missing edit targets, and immutable Marriage examples', () => {
    const id = 'user-rhythm-11111111-1111-4111-8111-111111111111';
    const created = saveRhythmDraft([], { ...validDraft }, id, 'create').savedRhythms!;
    expect(saveRhythmDraft(created, { ...validDraft }, id, 'create').savedRhythms).toBeUndefined();
    expect(saveRhythmDraft([], { ...validDraft }, id, 'edit').savedRhythms).toBeUndefined();
    expect(isEditableRhythmId('sample-marriage-prayer')).toBe(false);
    expect(isEditableRhythmId('sample-transfer')).toBe(false);
    expect(validateSavedRhythms([
      { id, ...validDraft },
      { id, ...validDraft }
    ])).toBe(false);
  });

  it('initializes the editor from existing metadata without regenerating identity or associations', () => {
    const fixture = todayRhythms[1]!;
    expect(rhythmDraftFrom(fixture)).toEqual({
      title: fixture.title,
      description: fixture.description,
      cadence: fixture.cadence,
      timeLabel: fixture.timeLabel,
      personIds: fixture.personIds,
      categoryIds: []
    });
  });

  it('archives fixture overlays without deleting their identity, associations, or completion reference', () => {
    const fixture = todayRhythms[0]!;
    const overlay = {
      id: fixture.id,
      title: 'Updated prayer rhythm',
      description: 'Retained while archived.',
      cadence: 'Weekly' as const,
      timeLabel: 'Evening' as const,
      personIds: ['sample-person-avery'] as const,
      categoryIds: ['marriage'] as const
    };
    const savedRhythms = [{
      ...overlay,
      personIds: [...overlay.personIds],
      categoryIds: [...overlay.categoryIds]
    }];
    const completions = [fixture.id];

    const archivedIds = archiveRhythmId(savedRhythms, [], fixture.id);
    expect(archivedIds).toEqual([fixture.id]);
    expect(archiveRhythmId(savedRhythms, archivedIds!, fixture.id)).toBeUndefined();
    const resolvedWhileArchived = resolveTodayRhythms(savedRhythms);
    expect(activeTodayRhythms(resolvedWhileArchived, archivedIds!)).toEqual(
      resolvedWhileArchived.filter(rhythm => rhythm.id !== fixture.id)
    );
    expect(archivedTodayRhythms(resolvedWhileArchived, archivedIds!)[0]).toMatchObject({
      id: fixture.id,
      title: overlay.title,
      personIds: ['sample-person-avery'],
      categoryIds: ['marriage']
    });
    expect(savedRhythms).toHaveLength(1);
    expect(completions).toEqual([fixture.id]);

    const restoredIds = restoreRhythmId(savedRhythms, archivedIds!, fixture.id);
    expect(restoredIds).toEqual([]);
    expect(restoreRhythmId(savedRhythms, restoredIds!, fixture.id)).toBeUndefined();
    expect(activeTodayRhythms(resolveTodayRhythms(savedRhythms), restoredIds!)[0]).toMatchObject({
      id: fixture.id,
      title: overlay.title,
      personIds: ['sample-person-avery'],
      categoryIds: ['marriage']
    });
    expect(completions).toEqual([fixture.id]);
  });
});
