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
import type { SavedRhythm } from '../src/domain/rhythm-editor.ts';
import type { RhythmSchedule, RhythmScoringMetadata } from '../src/domain/rhythm-schedule.ts';
import {
  createRhythmSeason,
  createUnknownRhythmSeason,
  rhythmSeasonPaletteForOrdinal
} from '../src/domain/rhythm-seasons.ts';

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
      schedule: { frequency: 'daily' },
      originalSchedule: { frequency: 'daily' },
      scheduleEditing: false
    });
  });

  it('uses the supported effective schedule without persisting an unchanged legacy fallback', () => {
    const fixture = todayRhythms[1]!;
    expect(fixture.schedule).toBeUndefined();
    const draft = rhythmDraftFrom(fixture);
    expect(draft.schedule).toEqual({ frequency: 'daily' });
    expect(draft.originalSchedule).toEqual({ frequency: 'daily' });

    const saved = saveRhythmDraft([], {
      ...draft,
      title: 'Updated without changing frequency'
    }, fixture.id, 'edit');
    expect(saved.errors).toEqual({});
    expect(saved.savedRhythms?.[0]?.schedule).toBeUndefined();
  });

  it('uses the active Season schedule and time of day as the editor effective values', () => {
    const id = 'user-rhythm-123e4567-e89b-42d3-a456-426614174000';
    const historicalSchedule = { frequency: 'daily' as const };
    const activeSchedule = {
      frequency: 'quarterly' as const,
      monthInQuarter: 2 as const,
      pattern: { kind: 'ordinalWeekday' as const, ordinal: 2 as const, weekday: 3 as const },
      endDate: '2027-12-31'
    };
    const rhythm = {
      ...todayRhythms[0]!,
      id,
      cadence: 'Daily',
      schedule: historicalSchedule,
      scoring: {
        trackingStartDate: '2026-01-01',
        timeZone: 'UTC',
        scheduleHistory: [
          createRhythmSeason(id, '2026-01-01', historicalSchedule, 'anytime'),
          createRhythmSeason(id, '2026-06-01', activeSchedule, 'early-morning')
        ]
      }
    };

    const draft = rhythmDraftFrom(rhythm, [], '2026-10-28');
    expect(draft.schedule).toEqual(activeSchedule);
    expect(draft.originalSchedule).toEqual(activeSchedule);
    expect(draft.timeLabel).toBe('Early morning');
  });

  it('does not infer a schedule from a descriptive cadence or an unknown active Season', () => {
    const descriptive = { ...todayRhythms[2]!, cadence: '3 times a week' };
    expect(rhythmDraftFrom(descriptive).schedule).toBeUndefined();

    const id = 'user-rhythm-123e4567-e89b-42d3-a456-426614174000';
    const rhythm = {
      ...todayRhythms[0]!,
      id,
      cadence: 'Daily',
      schedule: { frequency: 'daily' as const },
      scoring: {
        trackingStartDate: '2026-01-01',
        timeZone: 'UTC',
        scheduleHistory: [createUnknownRhythmSeason(id, '2026-01-01', 'Daily')]
      }
    };
    expect(rhythmDraftFrom(rhythm, [], '2026-10-28').schedule).toBeUndefined();
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
      scheduleHistory: [
        createRhythmSeason(
          id,
          '2026-10-23',
          schedule,
          undefined,
          undefined,
          rhythmSeasonPaletteForOrdinal(0)
        )
      ]
    });
    expect(result.savedRhythms?.[0]).toMatchObject({
      createdLocalDate: '2026-10-23',
      createdTimeZone: 'UTC',
      dailyBackfillAllowed: true
    });
  });

  it('updates the initial schedule before dated history without adding a Season', () => {
    const id = 'user-rhythm-33333333-3333-4333-8333-333333333333';
    const initialSchedule = { frequency: 'daily' as const };
    const nextSchedule = { frequency: 'weekly' as const, weekdays: [2, 4] as (2 | 4)[] };
    const initialSeason = {
      ...createRhythmSeason(id, '2026-10-01', initialSchedule),
      name: 'A user label',
      note: 'Kept as metadata.'
    };
    const existing = {
      id,
      title: 'Schedule before history',
      cadence: 'Daily',
      timeLabel: 'Anytime' as const,
      timeOfDay: 'anytime' as const,
      personIds: [],
      categoryIds: [],
      schedule: initialSchedule,
      scoring: {
        trackingStartDate: '2026-10-01',
        timeZone: 'UTC',
        scheduleHistory: [initialSeason]
      }
    };
    const result = saveRhythmDraft([existing], {
      ...validDraft,
      originalSchedule: initialSchedule,
      originalScoring: existing.scoring,
      schedule: nextSchedule,
      scheduleEditing: true
    }, id, 'edit', {
      currentDate: '2026-10-20',
      deviceTimeZone: 'UTC',
      hasDatedCompletionHistory: false
    });

    expect(result.errors).toEqual({});
    expect(result.savedRhythms?.[0]?.schedule).toEqual(nextSchedule);
    expect(result.savedRhythms?.[0]?.scoring?.scheduleHistory).toEqual([
      { ...initialSeason, schedule: nextSchedule }
    ]);
  });

  it('preserves the prior schedule and appends a Season after dated history exists', () => {
    const id = 'user-rhythm-44444444-4444-4444-8444-444444444444';
    const initialSchedule = { frequency: 'daily' as const };
    const nextSchedule = { frequency: 'weekly' as const, weekdays: [2, 4] as (2 | 4)[] };
    const initialSeason = createRhythmSeason(
      id,
      '2026-10-01',
      initialSchedule,
      undefined,
      undefined,
      rhythmSeasonPaletteForOrdinal(0)
    );
    const existing = {
      id,
      title: 'Schedule with history',
      cadence: 'Daily',
      timeLabel: 'Anytime' as const,
      timeOfDay: 'anytime' as const,
      personIds: [],
      categoryIds: [],
      schedule: initialSchedule,
      scoring: {
        trackingStartDate: '2026-10-01',
        timeZone: 'UTC',
        scheduleHistory: [initialSeason]
      }
    };
    const result = saveRhythmDraft([existing], {
      ...validDraft,
      originalSchedule: initialSchedule,
      originalScoring: existing.scoring,
      schedule: nextSchedule,
      scheduleEditing: true
    }, id, 'edit', {
      currentDate: '2026-10-20',
      deviceTimeZone: 'UTC',
      hasDatedCompletionHistory: true
    });

    expect(result.errors).toEqual({});
    expect(result.savedRhythms?.[0]?.scoring?.scheduleHistory).toEqual([
      initialSeason,
      createRhythmSeason(
        id,
        '2026-10-20',
        nextSchedule,
        undefined,
        undefined,
        rhythmSeasonPaletteForOrdinal(1)
      )
    ]);
  });

  it('assigns newly appended Seasons the next chronological palette token and cycles after five', () => {
    const id = 'user-rhythm-55555555-5555-4555-8555-555555555555';
    let schedule: RhythmSchedule = { frequency: 'daily' };
    let scoring: RhythmScoringMetadata = {
      trackingStartDate: '2026-10-01',
      timeZone: 'UTC',
      scheduleHistory: [
        createRhythmSeason(
          id,
          '2026-10-01',
          schedule,
          undefined,
          undefined,
          rhythmSeasonPaletteForOrdinal(0)
        )
      ]
    };
    let savedRhythms: SavedRhythm[] = [{
      id,
      title: 'Palette history',
      cadence: 'Daily',
      timeLabel: 'Anytime' as const,
      timeOfDay: 'anytime' as const,
      personIds: [],
      categoryIds: [],
      schedule,
      scoring
    }];
    const expectedTokens = ['fern', 'sage', 'sky', 'ocean', 'plum', 'fern', 'sage'];

    for (let ordinal = 1; ordinal < expectedTokens.length; ordinal += 1) {
      const nextSchedule = {
        frequency: 'weekly' as const,
        weekdays: [ordinal % 7 as 0 | 1 | 2 | 3 | 4 | 5 | 6]
      };
      const date = `2026-10-${String(ordinal + 1).padStart(2, '0')}`;
      const result = saveRhythmDraft(savedRhythms, {
        ...validDraft,
        originalSchedule: schedule,
        originalScoring: scoring,
        schedule: nextSchedule,
        scheduleEditing: true
      }, id, 'edit', {
        currentDate: date,
        deviceTimeZone: 'UTC',
        hasDatedCompletionHistory: true
      });

      expect(result.errors).toEqual({});
      savedRhythms = result.savedRhythms!;
      scoring = savedRhythms[0]!.scoring!;
      schedule = nextSchedule;
      expect(scoring.scheduleHistory.at(-1)?.paletteToken).toBe(expectedTokens[ordinal]);
    }
    expect(scoring.scheduleHistory.map(season => season.paletteToken)).toEqual(expectedTokens);
  });

  it('keeps the sample Daily cadence as the known earlier Season when its schedule is first structured', () => {
    const fixture = todayRhythms.find(rhythm => rhythm.id === 'sample-connect')!;
    const initialSchedule = { frequency: 'daily' as const };
    const nextSchedule = { frequency: 'weekly' as const, weekdays: [1, 3, 5] as (1 | 3 | 5)[] };
    const result = saveRhythmDraft([], {
      ...rhythmDraftFrom(fixture),
      schedule: nextSchedule,
      scheduleEditing: true
    }, fixture.id, 'edit', {
      currentDate: '2026-10-25',
      deviceTimeZone: 'UTC',
      hasDatedCompletionHistory: true,
      earliestDatedCompletionDate: '2026-10-17'
    });

    expect(result.errors).toEqual({});
    expect(result.savedRhythms?.[0]).toMatchObject({
      id: 'sample-connect',
      schedule: nextSchedule,
      cadence: 'Every week on Monday, Wednesday, and Friday.',
      scoring: {
        trackingStartDate: '2026-10-17',
        timeZone: 'UTC',
        scheduleHistory: [
          createRhythmSeason(
            'sample-connect',
            '2026-10-17',
            initialSchedule,
            undefined,
            undefined,
            rhythmSeasonPaletteForOrdinal(0)
          ),
          createRhythmSeason(
            'sample-connect',
            '2026-10-25',
            nextSchedule,
            undefined,
            undefined,
            rhythmSeasonPaletteForOrdinal(1)
          )
        ]
      }
    });
  });

  it('stores a Season name when first structuring schedule history from a sample rhythm', () => {
    const fixture = todayRhythms.find(rhythm => rhythm.id === 'sample-connect')!;
    const result = saveRhythmDraft([], {
      ...rhythmDraftFrom(fixture),
      schedule: { frequency: 'weekly', weekdays: [1, 3, 5] },
      scheduleEditing: true,
      seasonName: 'Evening connection'
    }, fixture.id, 'edit', {
      currentDate: '2026-10-25',
      deviceTimeZone: 'UTC',
      hasDatedCompletionHistory: true,
      earliestDatedCompletionDate: '2026-10-17'
    });

    expect(result.errors).toEqual({});
    expect(result.savedRhythms?.[0]?.scoring?.scheduleHistory).toHaveLength(2);
    expect(result.savedRhythms?.[0]?.scoring?.scheduleHistory[1])
      .toMatchObject({ kind: 'scheduled', name: 'Evening connection' });
  });

  it('preserves an existing active Season name by default and clears it only when explicitly blanked', () => {
    const id = 'user-rhythm-55555555-5555-4555-8555-555555555555';
    const previousSchedule = { frequency: 'daily' as const };
    const currentSchedule = { frequency: 'weekly' as const, weekdays: [2] as (2)[] };
    const season = {
      ...createRhythmSeason(id, '2026-10-25', currentSchedule),
      name: 'Evening connection'
    };
    const existing = {
      id,
      title: 'Named current Season',
      cadence: 'Every Tuesday.',
      timeLabel: 'Anytime' as const,
      timeOfDay: 'anytime' as const,
      personIds: [],
      categoryIds: [],
      schedule: currentSchedule,
      scoring: {
        trackingStartDate: '2026-10-01',
        timeZone: 'UTC',
        scheduleHistory: [
          createRhythmSeason(id, '2026-10-01', previousSchedule),
          season
        ]
      }
    };
    const baseDraft = {
      ...validDraft,
      originalSchedule: currentSchedule,
      originalScoring: existing.scoring,
      schedule: { frequency: 'weekly' as const, weekdays: [4] as (4)[] },
      scheduleEditing: true
    };
    const context = {
      currentDate: '2026-10-25',
      deviceTimeZone: 'UTC',
      hasDatedCompletionHistory: true
    };
    const preserved = saveRhythmDraft([existing], baseDraft, id, 'edit', context);
    const cleared = saveRhythmDraft([existing], {
      ...baseDraft,
      seasonName: ''
    }, id, 'edit', context);

    const preservedActive = preserved.savedRhythms?.[0]?.scoring?.scheduleHistory.at(-1);
    expect(preservedActive?.kind === 'scheduled' ? preservedActive.name : undefined)
      .toBe('Evening connection');
    expect(cleared.savedRhythms?.[0]?.scoring?.scheduleHistory.at(-1)).not.toHaveProperty('name');
    expect(rhythmDraftFrom({
      ...todayRhythms[0]!,
      ...existing,
      schedule: currentSchedule,
      scoring: existing.scoring
    }).seasonName).toBe('Evening connection');
  });

  it('replaces same-day schedule changes without duplicating the boundary and ignores cosmetic edits', () => {
    const id = 'user-rhythm-55555555-5555-4555-8555-555555555555';
    const schedule = { frequency: 'daily' as const };
    const initialSeason = createRhythmSeason(id, '2026-10-20', schedule);
    const existing = {
      id,
      title: 'Existing rhythm',
      cadence: 'Daily',
      timeLabel: 'Anytime' as const,
      timeOfDay: 'anytime' as const,
      personIds: [],
      categoryIds: [],
      schedule,
      scoring: {
        trackingStartDate: '2026-10-20',
        timeZone: 'UTC',
        scheduleHistory: [initialSeason]
      }
    };
    const cosmetic = saveRhythmDraft([existing], {
      ...validDraft,
      title: 'Cosmetic title edit',
      originalSchedule: schedule,
      originalScoring: existing.scoring,
      schedule,
      scheduleEditing: true
    }, id, 'edit', { currentDate: '2026-10-20', deviceTimeZone: 'UTC', hasDatedCompletionHistory: true });
    expect(cosmetic.savedRhythms?.[0]?.scoring?.scheduleHistory).toEqual([initialSeason]);

    const changedSchedule = { frequency: 'weekly' as const, weekdays: [2] as 2[] };
    const sameDay = saveRhythmDraft([existing], {
      ...validDraft,
      originalSchedule: schedule,
      originalScoring: existing.scoring,
      schedule: changedSchedule,
      scheduleEditing: true
    }, id, 'edit', { currentDate: '2026-10-20', deviceTimeZone: 'UTC', hasDatedCompletionHistory: true });
    expect(sameDay.savedRhythms?.[0]?.scoring?.scheduleHistory).toEqual([
      { ...initialSeason, schedule: changedSchedule }
    ]);
  });

  it('preserves an honest unknown period when backdated logs precede a same-day schedule replacement', () => {
    const id = 'user-rhythm-66666666-6666-4666-8666-666666666666';
    const schedule = { frequency: 'weekly' as const, weekdays: [1] as 1[] };
    const initialSeason = createRhythmSeason(id, '2026-10-25', schedule);
    const existing = {
      id,
      title: 'Backdated history',
      cadence: 'Every week on Monday',
      timeLabel: 'Anytime' as const,
      timeOfDay: 'anytime' as const,
      personIds: [],
      categoryIds: [],
      schedule,
      scoring: {
        trackingStartDate: '2026-10-25',
        timeZone: 'UTC',
        scheduleHistory: [initialSeason]
      }
    };
    const changedSchedule = { frequency: 'weekly' as const, weekdays: [4] as 4[] };
    const result = saveRhythmDraft([existing], {
      ...validDraft,
      originalSchedule: schedule,
      originalScoring: existing.scoring,
      schedule: changedSchedule,
      scheduleEditing: true
    }, id, 'edit', {
      currentDate: '2026-10-25',
      deviceTimeZone: 'UTC',
      hasDatedCompletionHistory: true,
      earliestDatedCompletionDate: '2026-10-05'
    });

    expect(result.errors).toEqual({});
    expect(result.savedRhythms?.[0]?.scoring?.scheduleHistory).toEqual([
      createUnknownRhythmSeason(id, '2026-10-05'),
      { ...initialSeason, schedule: changedSchedule }
    ]);
    expect(result.savedRhythms?.[0]?.scoring?.trackingStartDate).toBe('2026-10-25');
    expect(result.savedRhythms?.[0]?.schedule).toEqual(changedSchedule);
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
