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
      cadence: '',
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
    expect(result.savedRhythms?.[0]).toEqual({
      id,
      ...validDraft,
      timeOfDay: 'afternoon'
    });
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

  it('preserves v4 schedule and Personal metadata while editing through the unchanged form fields', () => {
    const id = 'user-rhythm-11111111-1111-4111-8111-111111111111';
    const existing = {
      id,
      title: 'Structured weekly',
      cadence: 'Weekly',
      timeLabel: 'Morning' as const,
      timeOfDay: 'morning' as const,
      schedule: { frequency: 'weekly' as const, weekdays: [1, 3] as (1 | 3)[] },
      personal: true,
      personIds: ['sample-person-avery' as const],
      categoryIds: ['marriage' as const]
    };
    const result = saveRhythmDraft([existing], {
      ...validDraft,
      title: 'Updated title'
    }, id, 'edit');
    expect(result.errors).toEqual({});
    expect(result.savedRhythms?.[0]).toMatchObject({
      id,
      title: 'Updated title',
      schedule: existing.schedule,
      personal: true,
      timeOfDay: 'afternoon'
    });
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
      categoryIds: [],
      scheduleEditing: false
    });
  });

  it('keeps creation and scoring metadata out of an unconfirmed draft', () => {
    const fixture = {
      ...todayRhythms.find(rhythm => rhythm.cadence === 'Daily')!,
      schedule: { frequency: 'daily' as const }
    };
    const draft = rhythmDraftFrom(fixture);
    expect(draft).toMatchObject({
      schedule: { frequency: 'daily' }
    });
    expect(draft.originalScoring).toBeUndefined();
  });

  it('stores creation-local-date and stable scoring timezone for a new structured Rhythm', () => {
    const id = 'user-rhythm-22222222-2222-4222-8222-222222222222';
    const schedule = { frequency: 'weekly' as const, weekdays: [1, 3] as (1 | 3)[] };
    const result = saveRhythmDraft([], {
      ...validDraft,
      schedule,
      scheduleEditing: true
    }, id, 'create', { currentDate: '2026-10-23', deviceTimeZone: 'UTC' });
    expect(result.errors).toEqual({});
    expect(result.savedRhythms?.[0]?.scoring).toEqual({
      trackingStartDate: '2026-10-23',
      timeZone: 'UTC',
      scheduleHistory: [{ startDate: '2026-10-23', schedule }]
    });
    expect(result.savedRhythms?.[0]).toMatchObject({
      createdLocalDate: '2026-10-23',
      createdTimeZone: 'UTC',
      dailyBackfillAllowed: true
    });
  });

  it('preserves descriptive cadence when unrelated fields are saved', () => {
    const fixture = todayRhythms[1]!;
    const originalCadence = fixture.cadence!;
    const draft = {
      ...rhythmDraftFrom(fixture),
      title: 'Updated title only',
      timeLabel: 'Evening'
    };

    const result = saveRhythmDraft([], draft, fixture.id, 'edit');
    expect(result.errors).toEqual({});
    expect(result.savedRhythms?.[0]).toMatchObject({
      id: fixture.id,
      title: 'Updated title only',
      cadence: originalCadence,
      timeLabel: 'Evening'
    });
    expect(result.savedRhythms?.[0]?.schedule).toBeUndefined();
  });

  it('keeps supported v4 descriptive labels editable without converting them', () => {
    const id = 'user-rhythm-11111111-1111-4111-8111-111111111111';
    const existing = {
      id,
      title: 'Unstructured legacy cadence',
      cadence: 'Every other week',
      timeLabel: 'Morning' as const,
      timeOfDay: 'morning' as const,
      personIds: [],
      categoryIds: []
    };
    const draft = {
      title: 'Updated descriptive rhythm',
      description: '',
      cadence: existing.cadence,
      timeLabel: 'Morning',
      personIds: [],
      categoryIds: [],
      scheduleEditing: false
    };
    const result = saveRhythmDraft([existing], draft, id, 'edit');

    expect(result.errors).toEqual({});
    expect(result.savedRhythms?.[0]).toMatchObject({
      cadence: 'Every other week'
    });
    expect(result.savedRhythms?.[0]?.schedule).toBeUndefined();
  });

  it('requires an explicit valid schedule when schedule editing is enabled', () => {
    expect(validateRhythmDraft({
      ...validDraft,
      scheduleEditing: true
    })).toMatchObject({ schedule: expect.any(String) });
    expect(validateRhythmDraft({
      ...validDraft,
      scheduleEditing: true,
      schedule: { frequency: 'weekly', weekdays: [] } as never
    })).toMatchObject({ schedule: expect.any(String) });
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
