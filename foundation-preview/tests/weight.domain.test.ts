import { describe, expect, it } from 'vitest';
import {
  createWeightData,
  deleteWeightMeasurement,
  formatWeightInput,
  kilogramsToPounds,
  parseWeightInput,
  poundsToKilograms,
  saveWeightDataCommand,
  saveWeightGoals,
  saveWeightMeasurement,
  selectWeightProgress,
  stepWeightInput,
  validateCanonicalWeightGoals,
  validWeightMeasurements,
  weightDataIssues,
  weightRhythmOccurrenceError,
  weightRhythmScheduleForDate
} from '../src/domain/weight.ts';
import type { WeightData, WeightMeasurement } from '../src/domain/weight.ts';
import type { RhythmPreview } from '../src/domain/preview-data.ts';
import { todayRhythms } from '../src/domain/preview-data.ts';
import { createRhythmSeason } from '../src/domain/rhythm-seasons.ts';
import type { DatedRhythmCompletion } from '../src/domain/rhythm-completion.ts';

const today = '2026-10-22';

function goals(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    startWeightKg: 100,
    startDate: '2026-10-01',
    targetWeightKg: 90,
    goalDate: '2026-10-11',
    ...overrides
  };
}

function rhythm(schedule: RhythmPreview['schedule'] = { frequency: 'daily' }): RhythmPreview {
  const source = todayRhythms[0]!;
  const { scoring: _scoring, completionHistory: _completionHistory, ...base } = source;
  return {
    ...base,
    id: 'user-rhythm-weight-fixture',
    title: 'Weigh in',
    schedule,
    categoryIds: ['health'],
    healthLogCapability: 'weight',
    completionHistory: []
  };
}

function linkedMeasurement(overrides: Partial<WeightMeasurement> = {}): WeightMeasurement {
  return {
    id: 'weigh-in-1',
    date: today,
    weightKg: 95,
    rhythmId: 'user-rhythm-weight-fixture',
    rhythmOccurrence: today,
    completionId: 'weight-completion-1',
    ...overrides
  };
}

function command(
  previous: WeightData,
  next: WeightData,
  options: {
    rhythms?: readonly RhythmPreview[];
    datedRhythmCompletions?: DatedRhythmCompletion[];
    today?: string;
  } = {}
) {
  return saveWeightDataCommand({
    previous,
    next,
    today: options.today ?? today,
    now: new Date('2026-10-22T17:20:00.000Z'),
    rhythms: options.rhythms ?? [rhythm()],
    archivedRhythmIds: new Set(),
    editableRhythmIds: new Set(['user-rhythm-weight-fixture']),
    completionState: {
      datedRhythmCompletions: options.datedRhythmCompletions ?? [],
      activeRhythmCompletions: [],
      completedRhythmIds: [],
      rhythmHistoryIds: []
    }
  });
}

describe('Weight domain', () => {
  it('formats numeric control values without trailing zeros and steps by whole display units', () => {
    expect(formatWeightInput(poundsToKilograms(173), 'lb')).toBe('173');
    expect(formatWeightInput(poundsToKilograms(173.5), 'lb')).toBe('173.5');
    expect(formatWeightInput(173.5, 'kg')).toBe('173.5');
    expect(formatWeightInput(null, 'lb')).toBe('');
    expect(formatWeightInput(0, 'lb')).toBe('0');
    expect(parseWeightInput('', 'lb')).toBeNull();
    expect(parseWeightInput('0', 'lb')).toBe(0);
    expect(parseWeightInput('173.5', 'lb')).toBe(poundsToKilograms(173.5));
    expect(parseWeightInput('invalid', 'kg')).toBeNull();
    expect(stepWeightInput(null, 'lb', 1)).toBe(poundsToKilograms(1));
    expect(stepWeightInput(null, 'lb', -1)).toBeNull();
    expect(formatWeightInput(stepWeightInput(poundsToKilograms(173.5), 'lb', 1), 'lb')).toBe('174.5');
    expect(formatWeightInput(stepWeightInput(poundsToKilograms(173.5), 'lb', -1), 'lb')).toBe('172.5');
  });

  it('converts physical units exactly and preserves canonical values across repeated display-unit changes', () => {
    const pounds = 200;
    const kilograms = poundsToKilograms(pounds);
    expect(kilograms).toBe(pounds * 0.45359237);
    expect(kilogramsToPounds(kilograms)).toBe(pounds);

    let data = createWeightData();
    data = saveWeightGoals(data, goals({ startWeightKg: kilograms, targetWeightKg: kilograms - 10 }), 'lb');
    const original = data.goals;
    for (let index = 0; index < 20; index += 1) {
      data = saveWeightGoals(data, data.goals as Record<string, unknown>, index % 2 ? 'lb' : 'kg');
    }
    expect(data.goals).toEqual(original);
  });

  it('validates complete goals while allowing all-empty goals', () => {
    expect(validateCanonicalWeightGoals({
      startWeightKg: null, startDate: '', targetWeightKg: null, goalDate: ''
    })).toBeNull();
    expect(validateCanonicalWeightGoals({
      startWeightKg: 100, startDate: '2026-10-01', targetWeightKg: null, goalDate: '2026-10-11'
    })).toContain('positive starting and target');
    expect(validateCanonicalWeightGoals({
      startWeightKg: 100, startDate: '2026-10-01', targetWeightKg: 90, goalDate: '2026-10-01'
    })).toContain('after');
  });

  it('preserves multiple same-date measurements and uses date-then-ID ordering for latest ties', () => {
    let data = createWeightData();
    const first = saveWeightMeasurement(data, { id: 'same-day-a', date: today, weightKg: 95 }, today);
    expect(first.valid).toBe(true);
    if (!first.valid) return;
    data = first.data;
    const second = saveWeightMeasurement(data, { id: 'same-day-z', date: today, weightKg: 94 }, today);
    expect(second.valid).toBe(true);
    if (!second.valid) return;
    data = { ...second.data, goals: goals() };
    expect(data.weighIns).toHaveLength(2);
    expect(selectWeightProgress(data, today).latest?.id).toBe('same-day-z');
  });

  it('preserves stable IDs on edits and rejects duplicate IDs and future dates', () => {
    const original = saveWeightMeasurement(createWeightData(), {
      id: 'stable-id', date: today, weightKg: 95, notes: 'Original'
    }, today);
    expect(original.valid).toBe(true);
    if (!original.valid) return;
    const edited = saveWeightMeasurement(original.data, {
      id: 'stable-id', date: today, weightKg: 94, notes: 'Edited'
    }, today);
    expect(edited.valid).toBe(true);
    if (!edited.valid) return;
    expect(edited.data.weighIns).toHaveLength(1);
    expect(edited.data.weighIns[0]).toMatchObject({ id: 'stable-id', weightKg: 94 });
    expect(saveWeightMeasurement(edited.data, {
      id: 'stable-id', date: today, weightKg: 93
    }, today)).toMatchObject({ valid: true });
    expect(saveWeightMeasurement(edited.data, {
      id: 'future', date: '2026-10-23', weightKg: 93
    }, today)).toMatchObject({ valid: false });
    const duplicated: WeightData = {
      ...edited.data,
      weighIns: [
        ...edited.data.weighIns,
        { id: 'stable-id', date: today, weightKg: 94, notes: 'Edited' }
      ]
    };
    expect(saveWeightMeasurement(duplicated, {
      id: 'stable-id', date: today, weightKg: 93
    }, today)).toMatchObject({ valid: false, error: 'This weigh-in ID is already in use.' });
  });

  it('excludes malformed and future records from calculations without discarding raw input', () => {
    const malformed = { id: 'bad', date: today, weightKg: 0, note: 'unknown field' };
    const future = { id: 'future', date: '2026-10-23', weightKg: 95 };
    const data: WeightData = {
      ...createWeightData(),
      goals: goals(),
      weighIns: [malformed, future, { id: 'valid', date: '2026-10-20', weightKg: 96 }]
    };
    const selected = validWeightMeasurements(data, today);
    expect(selected.records.map(record => record.id)).toEqual(['valid']);
    expect(selected.issues.join(' ')).toContain('future-dated');
    expect(weightDataIssues(data, today).join(' ')).toContain('invalid fields');
    expect(data.weighIns[0]).toBe(malformed);
    expect(data.weighIns[1]).toBe(future);
    expect(selectWeightProgress(data, today).latest?.id).toBe('valid');
  });

  it('matches legacy weight trajectory for loss, gain, maintenance, missing logs, and stale evidence', () => {
    const loss: WeightData = {
      ...createWeightData(),
      goals: goals({ targetWeightKg: 90, goalDate: '2026-10-21' }),
      weighIns: [{ id: 'stale-loss', date: '2026-10-09', weightKg: 96 }]
    };
    const lossProgress = selectWeightProgress(loss, '2026-10-11');
    expect(lossProgress.expectedWeightKg).toBe(95);
    expect(lossProgress.latestAge).toBe(2);
    expect(lossProgress.latest?.date).toBe('2026-10-09');
    expect(lossProgress.score).toBe(90);

    const gain: WeightData = {
      ...createWeightData(),
      goals: goals({ startWeightKg: 100, targetWeightKg: 120, goalDate: '2026-10-21' }),
      weighIns: [{ id: 'gain', date: '2026-10-06', weightKg: 107 }]
    };
    expect(selectWeightProgress(gain, '2026-10-06')).toMatchObject({
      expectedWeightKg: 105,
      score: 100,
      daysAhead: 2
    });

    const maintenance = { ...loss, goals: goals({ targetWeightKg: 100 }) };
    expect(selectWeightProgress(maintenance, today)).toMatchObject({
      score: null, maintenance: true, status: 'Maintenance'
    });
    expect(selectWeightProgress({ ...loss, weighIns: [] }, today)).toMatchObject({
      score: null, status: 'Goal date passed'
    });
  });

  it('clamps the goal path and preserves unavailable, start-date, and expired-goal states', () => {
    const data: WeightData = { ...createWeightData(), goals: goals() };
    expect(selectWeightProgress(data, '2026-09-30')).toMatchObject({
      expectedWeightKg: 100, score: null, status: 'Goal starts 2026-10-01'
    });
    expect(selectWeightProgress(data, '2026-10-01')).toMatchObject({
      expectedWeightKg: 100, score: null, status: 'Just started'
    });
    expect(selectWeightProgress(data, '2026-10-22')).toMatchObject({
      expectedWeightKg: 90, score: null, status: 'Goal date passed'
    });
    expect(selectWeightProgress({ ...data, goals: {} }, today)).toMatchObject({
      expectedWeightKg: null, score: null, status: 'Add your first weigh-in'
    });
  });

  it('keeps the legacy five-points-per-day-behind score and zero floor', () => {
    const dataFor = (weightKg: number): WeightData => ({
      ...createWeightData(),
      goals: goals({
        startWeightKg: 200,
        targetWeightKg: 180,
        startDate: '2026-10-01',
        goalDate: '2026-10-21'
      }),
      weighIns: [{ id: 'legacy-score-fixture', date: '2026-10-11', weightKg }]
    });
    expect(selectWeightProgress(dataFor(191), '2026-10-11')).toMatchObject({
      expectedWeightKg: 190,
      daysAhead: -1,
      score: 95
    });
    expect(selectWeightProgress(dataFor(210), '2026-10-11')).toMatchObject({
      daysAhead: -20,
      score: 0
    });
    expect(selectWeightProgress(dataFor(189), '2026-10-11')).toMatchObject({
      daysAhead: 1,
      score: 100
    });
  });

  it('uses the selected date schedule and the explicit Weight capability for linked occurrences', () => {
    const weekly = rhythm({ frequency: 'weekly', weekdays: [1] });
    expect(weightRhythmScheduleForDate(weekly, '2026-10-22')).toEqual(weekly.schedule);
    expect(weightRhythmOccurrenceError(weekly, '2026-10-22', today, new Set())).toBeNull();
    const ended = rhythm({ frequency: 'weekly', weekdays: [1], endDate: '2026-10-20' });
    expect(weightRhythmOccurrenceError(ended, today, today, new Set())).toContain('not a scheduled occurrence');
    const { healthLogCapability: _capability, ...uncapableRhythm } = weekly;
    expect(weightRhythmOccurrenceError(uncapableRhythm, today, today, new Set()))
      .toContain('explicitly marked');
    expect(weightRhythmOccurrenceError(weekly, today, today, new Set([weekly.id]))).toContain('Restore');

    const rhythmId = weekly.id;
    const rhythmWithSeasons: RhythmPreview = {
      ...weekly,
      schedule: { frequency: 'daily' },
      scoring: {
        trackingStartDate: '2026-10-01',
        timeZone: 'UTC',
        scheduleHistory: [
          createRhythmSeason(rhythmId, '2026-10-01', { frequency: 'weekly', weekdays: [1] }),
          createRhythmSeason(rhythmId, '2026-10-20', { frequency: 'daily' })
        ]
      }
    };
    expect(weightRhythmScheduleForDate(rhythmWithSeasons, '2026-10-19')).toEqual({
      frequency: 'weekly', weekdays: [1]
    });
    expect(weightRhythmScheduleForDate(rhythmWithSeasons, '2026-10-20')).toEqual({ frequency: 'daily' });
  });

  it('creates, edits, unlinks, and deletes only the completion owned by a weigh-in', () => {
    const previous = createWeightData();
    const next = { ...previous, weighIns: [linkedMeasurement()] };
    const created = command(previous, next);
    expect(created.valid).toBe(true);
    if (!created.valid) return;
    expect(created.completionState.datedRhythmCompletions).toHaveLength(1);
    expect(created.completionState.datedRhythmCompletions[0]).toMatchObject({
      id: 'weight-completion-1', rhythmId: 'user-rhythm-weight-fixture', effectiveDate: today
    });
    expect(created.completionState.activeRhythmCompletions).toEqual([{
      rhythmId: 'user-rhythm-weight-fixture', completionId: 'weight-completion-1'
    }]);

    const completion = created.completionState.datedRhythmCompletions[0]!;
    const withNotes = { ...completion, memory: 'Keep this completion note.' };
    const moved = command(next, {
      ...next,
      weighIns: [linkedMeasurement({ date: '2026-10-21', rhythmOccurrence: '2026-10-21' })]
    }, { datedRhythmCompletions: [withNotes] });
    expect(moved.valid).toBe(true);
    if (!moved.valid) return;
    expect(moved.completionState.datedRhythmCompletions[0]).toMatchObject({
      id: completion.id, effectiveDate: '2026-10-21', memory: 'Keep this completion note.'
    });

    const unlinked = command(next, {
      ...next,
      weighIns: [{ id: 'weigh-in-1', date: today, weightKg: 95 }]
    }, { datedRhythmCompletions: [withNotes] });
    expect(unlinked.valid).toBe(true);
    if (!unlinked.valid) return;
    expect(unlinked.completionState.datedRhythmCompletions).toEqual([]);
    expect(unlinked.completionState.completedRhythmIds).toEqual([]);

    const removed = deleteWeightMeasurement(next, 'weigh-in-1');
    expect(removed.deleted?.id).toBe('weigh-in-1');
    expect(removed.data.weighIns).toEqual([]);
  });

  it('blocks duplicate occurrence credit and preserves unrelated completion records', () => {
    const weekly = rhythm({ frequency: 'weekly', weekdays: [1] });
    const duplicateCompletion: DatedRhythmCompletion = {
      id: 'other-activity',
      rhythmId: weekly.id,
      effectiveDate: '2026-10-19',
      localTime: '10:00',
      timeZone: 'UTC',
      completedAt: '2026-10-19T10:00:00.000Z',
      recordedAt: '2026-10-19T10:00:00.000Z',
      memory: 'Unrelated note.'
    };
    const attempted = command(createWeightData(), {
      ...createWeightData(),
      weighIns: [linkedMeasurement({ date: '2026-10-22', rhythmOccurrence: '2026-10-22' })]
    }, { rhythms: [weekly], datedRhythmCompletions: [duplicateCompletion] });
    expect(attempted).toMatchObject({ valid: false, error: expect.stringContaining('already has completion credit') });
    expect(duplicateCompletion.memory).toBe('Unrelated note.');

    const conflict = command(createWeightData(), {
      ...createWeightData(),
      weighIns: [linkedMeasurement({ completionId: duplicateCompletion.id })]
    }, { datedRhythmCompletions: [duplicateCompletion] });
    expect(conflict).toMatchObject({
      valid: false, error: expect.stringContaining('owned by another activity')
    });
  });
});
