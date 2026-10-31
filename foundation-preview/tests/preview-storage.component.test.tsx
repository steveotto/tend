import { cleanup, fireEvent, render as testingRender, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App.tsx';
import { PreviewDataControls } from '../src/components/PreviewDataControls.tsx';
import {
  createPreviewEnvelope,
  createSamplePreviewData,
  parsePreviewBackup,
  PREVIEW_SCHEMA_VERSION,
  validatePreviewEnvelope
} from '../src/domain/preview-state.ts';
import { createStrengthData, createStrengthGuidedSession } from '../src/domain/strength.ts';
import { createWeightData } from '../src/domain/weight.ts';
import { createCardioData } from '../src/domain/cardio.ts';
import { createFriendshipData } from '../src/domain/friendships.ts';
import { createPersonPickerGroups, setPersonGroupMembership } from '../src/domain/preview-data.ts';
import type { StrengthSavedWorkout } from '../src/domain/strength.ts';
import {
  browserPreviewStorage,
  loadPreview,
  loadV1RecoveryCopy,
  loadV2RecoveryCopy,
  loadV3RecoveryCopy,
  loadV4RecoveryCopy,
  loadV5RecoveryCopy,
  loadV6RecoveryCopy,
  loadV7RecoveryCopy,
  loadV8RecoveryCopy,
  loadV9RecoveryCopy,
  loadV11RecoveryCopy,
  loadV12RecoveryCopy,
  loadV14RecoveryCopy,
  loadV16RecoveryCopy,
  loadV17RecoveryCopy,
  loadV18RecoveryCopy,
  loadV20RecoveryCopy,
  loadV21RecoveryCopy,
  loadV25RecoveryCopy,
  loadV27RecoveryCopy,
  loadV28RecoveryCopy,
  loadV29RecoveryCopy,
  PREVIEW_V19_RECOVERY_KEY,
  PREVIEW_STORAGE_KEY,
  PREVIEW_V1_RECOVERY_KEY,
  PREVIEW_V2_RECOVERY_KEY,
  PREVIEW_V3_RECOVERY_KEY,
  PREVIEW_V4_RECOVERY_KEY,
  PREVIEW_V5_RECOVERY_KEY,
  PREVIEW_V6_RECOVERY_KEY,
  PREVIEW_V7_RECOVERY_KEY,
  PREVIEW_V8_RECOVERY_KEY,
  PREVIEW_V9_RECOVERY_KEY,
  PREVIEW_V10_RECOVERY_KEY,
  PREVIEW_V11_RECOVERY_KEY,
  PREVIEW_V12_RECOVERY_KEY,
  PREVIEW_V14_RECOVERY_KEY,
  PREVIEW_V16_RECOVERY_KEY,
  PREVIEW_V17_RECOVERY_KEY,
  PREVIEW_V18_RECOVERY_KEY,
  PREVIEW_V20_RECOVERY_KEY,
  PREVIEW_V21_RECOVERY_KEY,
  PREVIEW_V25_RECOVERY_KEY,
  PREVIEW_V27_RECOVERY_KEY,
  PREVIEW_V28_RECOVERY_KEY,
  PREVIEW_V29_RECOVERY_KEY,
  writePreview
} from '../src/storage/preview-storage.ts';
import { createRhythmSeason } from '../src/domain/rhythm-seasons.ts';
import { rhythmSeasonInclusiveEndDate } from '../src/domain/rhythm-seasons.ts';
import { selectDailyRhythmScore } from '../src/domain/rhythm-scoring.ts';
import type { PreviewData } from '../src/domain/preview-state.ts';
import { localDateString } from '../src/domain/money-goals.ts';
import { addCalendarDays } from '../src/domain/rhythm-occurrences.ts';
import { installMemoryStorage, MemoryStorage } from './memory-storage.ts';

function render(ui: Parameters<typeof testingRender>[0]) {
  const result = testingRender(ui);
  const trigger = result.container.querySelector('.today-plan__focus-trigger');
  if (trigger) {
    fireEvent.click(trigger);
    const allDayOption = [...result.container.querySelectorAll('button')]
      .find(button => button.textContent?.startsWith('Everything today'));
    if (allDayOption) fireEvent.click(allDayOption);
  }
  return result;
}

beforeEach(installMemoryStorage);
afterEach(() => {
  cleanup();
  window.localStorage.removeItem(PREVIEW_STORAGE_KEY);
  window.localStorage.removeItem(PREVIEW_V1_RECOVERY_KEY);
  window.localStorage.removeItem(PREVIEW_V2_RECOVERY_KEY);
  window.localStorage.removeItem(PREVIEW_V3_RECOVERY_KEY);
  window.localStorage.removeItem(PREVIEW_V4_RECOVERY_KEY);
  window.localStorage.removeItem(PREVIEW_V5_RECOVERY_KEY);
  window.localStorage.removeItem(PREVIEW_V6_RECOVERY_KEY);
  window.localStorage.removeItem(PREVIEW_V7_RECOVERY_KEY);
  window.localStorage.removeItem(PREVIEW_V8_RECOVERY_KEY);
  window.localStorage.removeItem(PREVIEW_V9_RECOVERY_KEY);
  window.localStorage.removeItem(PREVIEW_V10_RECOVERY_KEY);
  window.localStorage.removeItem(PREVIEW_V11_RECOVERY_KEY);
  window.localStorage.removeItem(PREVIEW_V12_RECOVERY_KEY);
  window.localStorage.removeItem(PREVIEW_V14_RECOVERY_KEY);
  window.localStorage.removeItem(PREVIEW_V16_RECOVERY_KEY);
  window.localStorage.removeItem(PREVIEW_V17_RECOVERY_KEY);
  window.localStorage.removeItem(PREVIEW_V18_RECOVERY_KEY);
  window.localStorage.removeItem(PREVIEW_V20_RECOVERY_KEY);
  window.localStorage.removeItem(PREVIEW_V21_RECOVERY_KEY);
  window.localStorage.removeItem(PREVIEW_V25_RECOVERY_KEY);
  window.localStorage.removeItem(PREVIEW_V27_RECOVERY_KEY);
  vi.unstubAllGlobals();
});

function sampleWithHistory(): PreviewData {
  const data = createSamplePreviewData();
  data.goals[0]!.correctionHistory.push({
    effectiveDate: '2026-10-18',
    previousBalanceMinor: 120_000,
    previousNote: 'Earlier value',
    replacedAt: '2026-10-20T12:30:00.000Z'
  });
  data.completedRhythmIds = ['sample-pray-together'];
  return data;
}

function versionOneRaw(data: PreviewData): string {
  const envelope = createPreviewEnvelope(data);
  return JSON.stringify({
    format: envelope.format,
    schemaVersion: 1,
    data: {
      goals: envelope.data.goals,
      completedRhythmIds: envelope.data.completedRhythmIds
    }
  });
}

function versionTwoRaw(data: PreviewData): string {
  const envelope = createPreviewEnvelope(data);
  return JSON.stringify({
    format: envelope.format,
    schemaVersion: 2,
    data: {
      goals: envelope.data.goals,
      completedRhythmIds: envelope.data.completedRhythmIds,
      savedRhythms: legacySavedRhythms(envelope.data.savedRhythms)
    }
  });
}

function versionThreeRaw(data: PreviewData): string {
  const envelope = createPreviewEnvelope(data);
  return JSON.stringify({
    format: envelope.format,
    schemaVersion: 3,
    data: {
      goals: envelope.data.goals,
      completedRhythmIds: envelope.data.completedRhythmIds,
      savedRhythms: legacySavedRhythms(envelope.data.savedRhythms),
      archivedRhythmIds: envelope.data.archivedRhythmIds
    }
  });
}

function versionFourRaw(data: PreviewData): string {
  const envelope = createPreviewEnvelope(data);
  return JSON.stringify({
    format: envelope.format,
    schemaVersion: 4,
    data: {
      goals: envelope.data.goals,
      completedRhythmIds: envelope.data.completedRhythmIds,
      savedRhythms: envelope.data.savedRhythms,
      archivedRhythmIds: envelope.data.archivedRhythmIds
    }
  });
}

function versionFiveRaw(data: PreviewData): string {
  const envelope = createPreviewEnvelope(data);
  return JSON.stringify({
    format: envelope.format,
    schemaVersion: 5,
    data: {
      goals: envelope.data.goals,
      completedRhythmIds: envelope.data.completedRhythmIds,
      savedRhythms: envelope.data.savedRhythms,
      archivedRhythmIds: envelope.data.archivedRhythmIds,
      datedRhythmCompletions: envelope.data.datedRhythmCompletions,
      activeRhythmCompletions: envelope.data.activeRhythmCompletions
    }
  });
}

function versionSixRaw(data: PreviewData): string {
  const envelope = createPreviewEnvelope(data);
  const {
    rhythmHistoryIds: _rhythmHistoryIds,
    strength: _strength,
    weight: _weight,
    cardio: _cardio,
    friendships: _friendships,
    peopleGroups: _peopleGroups,
    personDetails: _personDetails,
    personNotes: _personNotes,
    ...legacyData
  } = envelope.data;
  return JSON.stringify({
    ...envelope,
    schemaVersion: 6,
    data: {
      ...legacyData,
      savedRhythms: envelope.data.savedRhythms.map(rhythm => {
        const { scoring: _ignored, ...legacyRhythm } = rhythm;
        return legacyRhythm;
      })
    }
  });
}

function versionSevenRaw(data: PreviewData): string {
  const envelope = JSON.parse(versionEightRaw(data)) as ReturnType<typeof createPreviewEnvelope>;
  const { personNotes: _personNotes, ...legacyData } = envelope.data;
  return JSON.stringify({
    ...envelope,
    schemaVersion: 7,
    data: {
      ...legacyData,
      savedRhythms: envelope.data.savedRhythms.map(rhythm => {
        const {
          createdLocalDate: _createdLocalDate,
          createdTimeZone: _createdTimeZone,
          dailyBackfillAllowed: _dailyBackfillAllowed,
          ...versionSevenRhythm
        } = rhythm;
        return versionSevenRhythm;
      })
    }
  });
}

function versionEightRaw(data: PreviewData): string {
  const envelope = createPreviewEnvelope(data);
  const {
    rhythmHistoryIds: _rhythmHistoryIds,
    strength: _strength,
    weight: _weight,
    cardio: _cardio,
    friendships: _friendships,
    peopleGroups: _peopleGroups,
    personDetails: _personDetails,
    personNotes: _personNotes,
    ...legacyData
  } = envelope.data;
  return JSON.stringify({
    ...envelope,
    schemaVersion: 8,
    data: {
      ...legacyData,
      savedRhythms: envelope.data.savedRhythms.map(rhythm => ({
        ...rhythm,
        ...(rhythm.scoring === undefined ? {} : {
          scoring: {
            trackingStartDate: rhythm.scoring.trackingStartDate,
            timeZone: rhythm.scoring.timeZone,
            scheduleHistory: rhythm.scoring.scheduleHistory
              .filter((segment): segment is Extract<typeof segment, { kind: 'scheduled' }> => segment.kind === 'scheduled')
              .map((segment, index, segments) => {
              const next = segments[index + 1];
              return {
                startDate: segment.startDate,
                ...(next === undefined ? {} : {
                  endDate: addCalendarDays(next.startDate, -1)
                }),
                schedule: segment.schedule
              };
            })
          }
        })
      }))
    }
  });
}

function versionNineRaw(data: PreviewData): string {
  const envelope = createPreviewEnvelope(data);
  const {
    rhythmHistoryIds: _rhythmHistoryIds,
    strength: _strength,
    weight: _weight,
    cardio: _cardio,
    friendships: _friendships,
    peopleGroups: _peopleGroups,
    personDetails: _personDetails,
    personNotes: _personNotes,
    ...legacyData
  } = envelope.data;
  return JSON.stringify({ ...envelope, schemaVersion: 9, data: legacyData });
}

function versionTenRaw(data: PreviewData): string {
  const envelope = createPreviewEnvelope(data);
  const {
    strength: _strength,
    weight: _weight,
    cardio: _cardio,
    friendships: _friendships,
    peopleGroups: _peopleGroups,
    personDetails: _personDetails,
    personNotes: _personNotes,
    ...legacyData
  } = envelope.data;
  return JSON.stringify({
    ...envelope,
    schemaVersion: 10,
    data: {
      ...legacyData,
      savedRhythms: envelope.data.savedRhythms.map(rhythm => ({
        ...rhythm,
        ...(rhythm.scoring === undefined ? {} : {
          scoring: {
            ...rhythm.scoring,
            scheduleHistory: rhythm.scoring.scheduleHistory.map(segment => {
              if (segment.kind === 'unknown') throw new Error('Schema v10 does not support unknown schedule history.');
              const { timeOfDay: _timeOfDay, ...v10Segment } = segment;
              return v10Segment;
            })
          }
        })
      }))
    }
  });
}

function legacySavedRhythms(rhythms: PreviewData['savedRhythms']) {
  return rhythms.map(rhythm => ({
    id: rhythm.id,
    title: rhythm.title,
    ...(rhythm.description === undefined ? {} : { description: rhythm.description }),
    cadence: rhythm.cadence,
    timeLabel: rhythm.timeLabel,
    personIds: [...rhythm.personIds],
    categoryIds: [...rhythm.categoryIds]
  }));
}

function storageFixture(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); }
  };
  return { storage, values };
}

function alteredEnvelope(change: (value: Record<string, unknown>) => void): unknown {
  const value: unknown = JSON.parse(JSON.stringify(createPreviewEnvelope(sampleWithHistory())));
  change(value as Record<string, unknown>);
  return value;
}

function setDownloadMocks() {
  const createObjectURL = vi.fn((_blob: Blob) => 'blob:synthetic-preview');
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  return { createObjectURL, revokeObjectURL };
}

describe('synthetic preview storage adapter and envelope', () => {
  it('migrates schema v28 without inventing Person details and preserves exact source recovery', () => {
    const data = createSamplePreviewData();
    const priorEnvelope = JSON.parse(JSON.stringify(createPreviewEnvelope(data))) as {
      format: string;
      schemaVersion: number;
      data: Record<string, unknown>;
    };
    priorEnvelope.schemaVersion = 28;
    delete priorEnvelope.data.personDetails;
    delete priorEnvelope.data.personNotes;
    const raw = JSON.stringify(priorEnvelope);
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: raw });

    const loaded = loadPreview(storage, '2026-10-31');
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    expect(loaded.data.personDetails).toEqual([]);
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(raw);
    expect(writePreview(storage, loaded.data, loaded.raw, { currentDate: '2026-10-31' }).kind).toBe('saved');
    expect(values.get(PREVIEW_V28_RECOVERY_KEY)).toBe(raw);
    expect(loadV28RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw });
    expect(JSON.parse(values.get(PREVIEW_STORAGE_KEY)!).schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
  });

  it('migrates schema v29 with an empty person-note collection and preserves exact raw recovery', () => {
    const data = createSamplePreviewData();
    const previous = JSON.parse(JSON.stringify(createPreviewEnvelope(data))) as {
      format: string;
      schemaVersion: number;
      data: Record<string, unknown>;
    };
    previous.schemaVersion = 29;
    delete previous.data.personNotes;
    const raw = ` \n${JSON.stringify(previous)}\n`;
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: raw });

    const loaded = loadPreview(storage, '2026-10-31');
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    expect(loaded.data.personNotes).toEqual([]);
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(raw);
    expect(writePreview(storage, loaded.data, loaded.raw, { currentDate: '2026-10-31' }).kind).toBe('saved');
    expect(values.get(PREVIEW_V29_RECOVERY_KEY)).toBe(raw);
    expect(loadV29RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw });
    expect(JSON.parse(values.get(PREVIEW_STORAGE_KEY)!).schemaVersion).toBe(30);
  });

  it('round-trips person notes and refuses a stale write that would replace a newer document', () => {
    const data = createSamplePreviewData();
    data.personNotes = [{
      id: 'preview-note-one',
      personId: 'sample-person-avery',
      sharedWith: ['sample-person-morgan'],
      content: 'A synthetic note\nwith retained formatting.',
      createdAt: '2026-10-31T12:00:00.000Z',
      updatedAt: '2026-10-31T12:00:00.000Z'
    }];
    const backup = JSON.stringify(createPreviewEnvelope(data));
    const parsed = parsePreviewBackup(backup, '2026-10-31');
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;
    expect(parsed.envelope.data.personNotes).toEqual(data.personNotes);

    const currentRaw = JSON.stringify(createPreviewEnvelope(createSamplePreviewData()));
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: currentRaw });
    const externalRaw = JSON.stringify(createPreviewEnvelope({ ...createSamplePreviewData(), personNotes: [...data.personNotes] }));
    values.set(PREVIEW_STORAGE_KEY, externalRaw);
    expect(writePreview(storage, data, currentRaw, { currentDate: '2026-10-31' }))
      .toEqual({ kind: 'conflict', actualRaw: externalRaw });
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(externalRaw);
  });

  it('accepts subsequent writes when a current-schema source contains an active Strength session draft', () => {
    const data = createSamplePreviewData();
    const workout: StrengthSavedWorkout = {
      id: 'active-session-template',
      name: 'Active session',
      muscleIds: ['chest'],
      sharedWith: [],
      exercises: [{
        id: 'active-session-exercise',
        name: 'Bench Press',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        loadMeaning: 'total',
        restDurationSeconds: 180,
        restDurationOverridden: false,
        sets: [{ id: 'active-session-set', targetReps: 8 }]
      }],
      supersetGroups: []
    };
    const started = createStrengthGuidedSession(workout, {
      id: 'active-session-draft',
      date: '2026-10-22',
      startedAt: '2026-10-22T09:00:00.000Z',
      timeZone: 'UTC'
    });
    expect(started.valid).toBe(true);
    if (!started.valid) return;
    data.strength.savedWorkouts = [workout];
    data.strength.guidedSessionDraft = started.session;
    const { storage } = storageFixture();

    const initial = writePreview(storage, data, null);
    expect(initial.kind).toBe('saved');
    if (initial.kind !== 'saved') return;
    expect(parsePreviewBackup(initial.raw, '2026-10-22')).toMatchObject({
      valid: true,
      sourceSchemaVersion: PREVIEW_SCHEMA_VERSION
    });

    const updated = {
      ...data,
      strength: {
        ...data.strength,
        guidedSessionDraft: { ...started.session, notes: 'Session progress remains resumable.' }
      }
    };
    expect(writePreview(storage, updated, initial.raw, { currentDate: '2026-10-22' }).kind).toBe('saved');
  });

  it('round-trips the explicit versioned envelope including shared Friendships records', () => {
    const data = sampleWithHistory();
    data.friendships = {
      cadenceSettings: [{
        personId: 'sample-person-morgan',
        cadence: 'weekly',
        setOn: '2026-10-19'
      }],
      connections: [{
        id: 'friendship-connection-storage-test',
        type: 'time-together',
        date: '2026-10-20',
        time: '17:30',
        participantIds: ['sample-person-morgan', 'sample-person-avery'],
        notes: 'One shared event, two actual participants.'
      }]
    };
    data.peopleGroups = setPersonGroupMembership(
      data.peopleGroups,
      'friends',
      'sample-person-morgan',
      true
    );
    const envelope = createPreviewEnvelope(data);
    const parsed = validatePreviewEnvelope(envelope, '2026-10-21');
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;
    expect(parsed.envelope.format).toBe('tend.synthetic-preview');
    expect(parsed.envelope.schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
    expect(parsed.envelope.data).toEqual(data);

    const { storage } = storageFixture();
    expect(writePreview(storage, data, null).kind).toBe('saved');
    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind === 'loaded') expect(loaded.data).toEqual(data);
  });

  it('migrates schema v19 friend selections exactly and preserves the raw v19 recovery copy', () => {
    const data = createSamplePreviewData();
    data.friendships = {
      cadenceSettings: [{
        personId: 'sample-person-morgan',
        cadence: 'weekly',
        setOn: '2026-10-01'
      }],
      connections: [{
        id: 'legacy-friendship-event',
        type: 'call',
        date: '2026-10-10',
        participantIds: ['sample-person-morgan'],
        notes: 'Existing history is retained.'
      }]
    };
    const legacyEnvelope = JSON.parse(JSON.stringify(createPreviewEnvelope(data))) as {
      schemaVersion: number;
      data: Record<string, unknown> & { friendships: Record<string, unknown> };
    };
    legacyEnvelope.schemaVersion = 19;
    delete legacyEnvelope.data.peopleGroups;
    delete legacyEnvelope.data.personDetails;
    delete legacyEnvelope.data.personNotes;
    legacyEnvelope.data.friendships = {
      ...data.friendships,
      friendIds: ['sample-person-morgan']
    };
    const raw = JSON.stringify(legacyEnvelope);

    const parsed = parsePreviewBackup(raw, '2026-10-21');
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;
    expect(parsed.sourceSchemaVersion).toBe(19);
    expect(parsed.envelope.schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
    expect(parsed.envelope.data.peopleGroups.find(group => group.id === 'friends')?.memberIds)
      .toEqual(['sample-person-morgan']);
    expect(parsed.envelope.data.friendships).toEqual(data.friendships);
    expect(parsed.envelope.data.friendships.connections).toEqual(data.friendships.connections);

    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: raw });
    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    expect(writePreview(storage, loaded.data, raw, { currentDate: '2026-10-21' }).kind).toBe('saved');
    expect(values.get(PREVIEW_V19_RECOVERY_KEY)).toBe(raw);
  });

  it('migrates schema v20 Strength without fabricating exercise data and preserves exact recovery bytes', () => {
    const data = createSamplePreviewData();
    data.strength.savedWorkouts = [{
      id: 'legacy-template-without-plan',
      name: 'Existing workout',
      muscleIds: ['chest'],
      sharedWith: []
    }];
    data.strength.workouts = [{
      id: 'legacy-date-only-log',
      date: '2026-10-10',
      muscleIds: ['chest'],
      savedWorkoutId: 'legacy-template-without-plan',
      workoutName: 'Existing workout'
    }];
    const legacyEnvelope = JSON.parse(JSON.stringify(createPreviewEnvelope(data))) as {
      schemaVersion: number;
      data: Record<string, unknown>;
    };
    legacyEnvelope.schemaVersion = 20;
    delete legacyEnvelope.data.personDetails;
    delete legacyEnvelope.data.personNotes;
    const legacyStrength = legacyEnvelope.data.strength as { settings: Record<string, unknown> };
    delete legacyStrength.settings.weightUnit;
    const raw = ` \n${JSON.stringify(legacyEnvelope)}\n`;

    const parsed = parsePreviewBackup(raw, '2026-10-21');
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;
    expect(parsed.sourceSchemaVersion).toBe(20);
    expect(parsed.envelope.schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
    expect(parsed.envelope.data.strength.settings.weightUnit).toBe('lb');
    expect(parsed.envelope.data.strength.savedWorkouts[0]).toEqual({
      ...data.strength.savedWorkouts[0],
      supersetGroups: []
    });
    expect(parsed.envelope.data.strength.workouts[0]).toEqual({
      ...data.strength.workouts[0],
      supersetGroups: []
    });

    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: raw });
    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    expect(writePreview(storage, loaded.data, raw, { currentDate: '2026-10-21' }).kind).toBe('saved');
    expect(values.get(PREVIEW_V20_RECOVERY_KEY)).toBe(raw);
    expect(loadV20RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw });
    const reloaded = loadPreview(storage, '2026-10-21');
    expect(reloaded.kind).toBe('loaded');
    if (reloaded.kind === 'loaded') {
      expect(reloaded.data.strength.savedWorkouts[0]).toEqual({
        ...data.strength.savedWorkouts[0],
        supersetGroups: []
      });
      expect(reloaded.data.strength.workouts[0]).toEqual({
        ...data.strength.workouts[0],
        supersetGroups: []
      });
    }

    const occupied = storageFixture({
      [PREVIEW_STORAGE_KEY]: raw,
      [PREVIEW_V20_RECOVERY_KEY]: 'different original bytes'
    });
    expect(writePreview(occupied.storage, data, raw, { currentDate: '2026-10-21' })).toMatchObject({
      kind: 'error',
      message: expect.stringContaining('recovery copy')
    });
    expect(occupied.values.get(PREVIEW_STORAGE_KEY)).toBe(raw);
  });

  it('round-trips nested Strength plans and immutable performance snapshots through preview backup', () => {
    const data = createSamplePreviewData();
    data.strength.savedWorkouts = [{
      id: 'plan-roundtrip',
      name: 'Push',
      muscleIds: ['chest', 'triceps'],
      sharedWith: ['sample-person-avery'],
      exercises: [{
        id: 'exercise-bench',
        name: 'Bench Press',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        restDurationSeconds: 90,
        sets: [{
          id: 'bench-set-1',
          targetReps: 8,
          targetLoad: { kind: 'external', meaning: 'total', value: 135, unit: 'lb' }
        }]
      }]
    }];
    const active = createStrengthGuidedSession(data.strength.savedWorkouts[0]!, {
      id: 'guided-session-roundtrip',
      date: '2026-10-21',
      startedAt: '2026-10-21T09:00:00.000Z',
      timeZone: 'UTC'
    });
    expect(active.valid).toBe(true);
    if (!active.valid) return;
    data.strength.guidedSessionDraft = {
      ...active.session,
      autoStartRest: true,
      restTimer: {
        status: 'running',
        durationSeconds: 90,
        deadlineAt: '2026-10-21T09:01:30.000Z'
      }
    };
    data.strength.workouts = [{
      id: 'log-roundtrip',
      date: '2026-10-21',
      muscleIds: ['chest'],
      savedWorkoutId: 'plan-roundtrip',
      workoutName: 'Push',
      startedAt: '2026-10-21T09:00:00.000Z',
      finishedAt: '2026-10-21T09:30:00.000Z',
      timeZone: 'UTC',
      exercises: [{
        id: 'exercise-bench',
        name: 'Bench Press',
        muscleIds: ['chest'],
        equipment: 'Barbell',
        restDurationSeconds: 90,
        sets: [{
          id: 'bench-set-1',
          targetReps: 8,
          targetLoad: { kind: 'external', meaning: 'total', value: 135, unit: 'lb' },
          status: 'performed',
          actualReps: 8,
          actualLoad: { kind: 'external', meaning: 'total', value: 135, unit: 'lb' },
          confirmedAt: '2026-10-21T09:10:00.000Z'
        }]
      }]
    }];
    const expectedStrength = createPreviewEnvelope(data).data.strength;
    const backup = JSON.stringify(createPreviewEnvelope(data));
    const parsed = parsePreviewBackup(backup, '2026-10-21');
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;
    expect(parsed.envelope.data.strength).toEqual(expectedStrength);

    const { storage } = storageFixture();
    expect(writePreview(storage, data, null).kind).toBe('saved');
    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind === 'loaded') expect(loaded.data.strength).toEqual(expectedStrength);
  });

  it('preserves exact schema v21 bytes before writing the resumable timer-ready schema v25 draft shape', () => {
    const data = createSamplePreviewData();
    const current = createPreviewEnvelope(data);
    const { personDetails: _personDetails, personNotes: _personNotes, ...v21Data } = current.data;
    const v21Raw = ` \n${JSON.stringify({ ...current, schemaVersion: 21, data: v21Data })}\n`;
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: v21Raw });
    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    expect(loaded.data.strength.guidedSessionDraft).toBeUndefined();
    expect(writePreview(storage, loaded.data, v21Raw, { currentDate: '2026-10-21' }).kind).toBe('saved');
    expect(values.get(PREVIEW_V21_RECOVERY_KEY)).toBe(v21Raw);
    expect(loadV21RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: v21Raw });
    expect(JSON.parse(values.get(PREVIEW_STORAGE_KEY)!).schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
  });

  it('exports and imports structured schedules and Personal through the backup controls', async () => {
    const user = userEvent.setup();
    const data = sampleWithHistory();
    const id = 'user-rhythm-11111111-1111-4111-8111-111111111111';
    data.savedRhythms = [{
      id,
      title: 'Quarterly connection',
      cadence: 'Quarterly',
      timeLabel: 'Early morning',
      timeOfDay: 'early-morning',
      schedule: {
        frequency: 'quarterly',
        monthInQuarter: 1,
        pattern: { kind: 'dayOfMonth', day: 'last' }
      },
      scoring: {
        trackingStartDate: '2026-10-01',
        timeZone: 'UTC',
        scheduleHistory: [{
          ...createRhythmSeason(id, '2026-10-01', {
            frequency: 'quarterly',
            monthInQuarter: 1,
            pattern: { kind: 'dayOfMonth', day: 'last' }
          }),
          name: 'A user label',
          note: 'A saved note.'
        }]
      },
      personal: false,
      personIds: ['sample-person-avery'],
      categoryIds: ['marriage']
    }];
    data.completedRhythmIds.push(id);
    data.archivedRhythmIds = [id];
    data.completedRhythmIds.push('sample-connect');
    data.datedRhythmCompletions.push({
      id: 'dated-connect-2026-10-20',
      rhythmId: 'sample-connect',
      effectiveDate: '2026-10-20',
      localTime: '19:45',
      timeZone: 'UTC',
      completedAt: '2026-10-20T19:45:00.000Z',
      recordedAt: '2026-10-20T19:46:00.000Z',
      memory: 'A saved memory.'
    });
    data.rhythmHistoryIds.push('sample-connect');
    data.activeRhythmCompletions.push({
      rhythmId: 'sample-connect',
      completionId: 'dated-connect-2026-10-20'
    });
    data.rhythmCompletionOverrides = [{
      id: 'sample-connect-2026-10-17',
      rhythmId: 'sample-connect',
      effectiveDate: '2026-10-16',
      memory: 'Date-only edit survives backup.'
    }];
    data.removedSeedCompletionIds = ['sample-connect-2026-10-18'];
    data.friendships = {
      cadenceSettings: [{
        personId: 'sample-person-morgan',
        cadence: 'monthly',
        setOn: '2026-10-01'
      }],
      connections: [{
        id: 'friendship-connection-export-test',
        type: 'text',
        date: '2026-10-20',
        participantIds: ['sample-person-morgan'],
        notes: 'Preserved through export and import.'
      }]
    };
    data.peopleGroups = setPersonGroupMembership(
      data.peopleGroups,
      'friends',
      'sample-person-morgan',
      true
    );
    const savedStrengthTemplate: StrengthSavedWorkout = {
      id: 'saved-strength-template',
      name: 'Renamed strength day',
      muscleIds: ['shoulders', 'quads'],
      sharedWith: ['sample-person-avery'],
      suggestionSourceId: 'strength.shoulders-quads'
    };
    data.strength.savedWorkouts = [Object.assign(savedStrengthTemplate, { futureTemplateMetadata: { revision: 3 } })];
    const onImport = vi.fn(() => null);
    const { createObjectURL } = setDownloadMocks();
    render(
      <PreviewDataControls
        data={data}
        status={{ kind: 'saved' }}
        currentDate="2026-10-21"
        onImport={onImport}
        onReset={() => null}
        onRetrySave={() => {}}
        onReloadExternal={() => null}
        onReplaceExternal={() => null}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Export preview backup' }));
    const blob = createObjectURL.mock.calls[0]![0];
    const backup = await blob.text();
    expect(JSON.parse(backup).schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
    expect(JSON.parse(backup).data.datedRhythmCompletions).toEqual(data.datedRhythmCompletions);
    expect(JSON.parse(backup).data.activeRhythmCompletions).toEqual(data.activeRhythmCompletions);
    expect(JSON.parse(backup).data.rhythmCompletionOverrides).toEqual(data.rhythmCompletionOverrides);
    expect(JSON.parse(backup).data.removedSeedCompletionIds).toEqual(data.removedSeedCompletionIds);
    expect(JSON.parse(backup).data.rhythmHistoryIds).toEqual(data.rhythmHistoryIds);
    expect(JSON.parse(backup).data.friendships).toEqual(data.friendships);
    expect(JSON.parse(backup).data.strength.savedWorkouts[0]).toMatchObject({
      id: 'saved-strength-template',
      name: 'Renamed strength day',
      muscleIds: ['shoulders', 'quads'],
      suggestionSourceId: 'strength.shoulders-quads',
      futureTemplateMetadata: { revision: 3 }
    });
    expect(JSON.parse(backup).data.savedRhythms[0].scoring.scheduleHistory[0]).toMatchObject({
      id: `season:${id}:2026-10-01`,
      name: 'A user label',
      note: 'A saved note.'
    });
    await user.upload(
      screen.getByLabelText('Import preview backup'),
      new File([backup], 'v4-structured.json', { type: 'application/json' })
    );
    const dialog = await screen.findByRole('dialog', { name: 'Replace preview data?' });
    await user.click(within(dialog).getByRole('button', { name: 'Replace with backup' }));
    expect(onImport).toHaveBeenCalledWith(createPreviewEnvelope(data).data);
  });

  it('offers exact v3 recovery bytes through the shared backup controls', async () => {
    const user = userEvent.setup();
    const raw = versionThreeRaw(sampleWithHistory());
    const { createObjectURL } = setDownloadMocks();
    render(
      <PreviewDataControls
        data={createSamplePreviewData()}
        status={{ kind: 'saved' }}
        currentDate="2026-10-21"
        onImport={() => null}
        onReset={() => null}
        onRetrySave={() => {}}
        onReloadExternal={() => null}
        onReplaceExternal={() => null}
        v3RecoveryCopy={raw}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Download original v3 recovery backup' }));
    const download = createObjectURL.mock.calls[0]![0];
    expect(await download.text()).toBe(raw);
  });

  it('offers the exact v20 source envelope through the shared recovery controls', async () => {
    const user = userEvent.setup();
    const raw = ` \n${JSON.stringify({
      ...createPreviewEnvelope(createSamplePreviewData()),
      schemaVersion: 20
    })}\n`;
    const { createObjectURL } = setDownloadMocks();
    render(
      <PreviewDataControls
        data={createSamplePreviewData()}
        status={{ kind: 'saved' }}
        currentDate="2026-10-21"
        onImport={() => null}
        onReset={() => null}
        onRetrySave={() => {}}
        onReloadExternal={() => null}
        onReplaceExternal={() => null}
        v20RecoveryCopy={raw}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Download original v20 recovery backup' }));
    const download = createObjectURL.mock.calls[0]![0];
    expect(await download.text()).toBe(raw);
  });

  it('loads and exposes the exact v25 recovery envelope through the shared controls', async () => {
    const user = userEvent.setup();
    const raw = ` \n${JSON.stringify({
      ...createPreviewEnvelope(createSamplePreviewData()),
      schemaVersion: 25
    })}\n`;
    window.localStorage.setItem(PREVIEW_V25_RECOVERY_KEY, raw);
    const recovered = loadV25RecoveryCopy(browserPreviewStorage());
    expect(recovered).toEqual({ kind: 'loaded', raw });
    const { createObjectURL } = setDownloadMocks();
    render(
      <PreviewDataControls
        data={createSamplePreviewData()}
        status={{ kind: 'saved' }}
        currentDate="2026-10-21"
        onImport={() => null}
        onReset={() => null}
        onRetrySave={() => {}}
        onReloadExternal={() => null}
        onReplaceExternal={() => null}
        v25RecoveryCopy={raw}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Download original v25 recovery backup' }));
    expect(await createObjectURL.mock.calls[0]![0].text()).toBe(raw);
  });

  it('preserves and exposes the exact v27 source before schema-v28 scoring migration', async () => {
    const data = createSamplePreviewData();
    const legacy = JSON.parse(JSON.stringify(createPreviewEnvelope(data))) as {
      schemaVersion: number;
      data: {
        cardio: Record<string, unknown>;
        strength: Record<string, unknown>;
        personDetails?: unknown;
        personNotes?: unknown;
      };
    };
    legacy.schemaVersion = 27;
    delete legacy.data.personDetails;
    delete legacy.data.personNotes;
    delete legacy.data.cardio.trackingStartDate;
    delete legacy.data.cardio.targetHistory;
    delete legacy.data.strength.trackingStartDate;
    delete legacy.data.strength.scoringSettingsHistory;
    const raw = JSON.stringify(legacy);
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: raw });

    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    expect(writePreview(storage, loaded.data, raw, { currentDate: '2026-10-21' }).kind).toBe('saved');
    expect(values.get(PREVIEW_V27_RECOVERY_KEY)).toBe(raw);

    window.localStorage.setItem(PREVIEW_V27_RECOVERY_KEY, raw);
    expect(loadV27RecoveryCopy(browserPreviewStorage())).toEqual({ kind: 'loaded', raw });
    const user = userEvent.setup();
    const { createObjectURL } = setDownloadMocks();
    render(
      <PreviewDataControls
        data={createSamplePreviewData()}
        status={{ kind: 'saved' }}
        currentDate="2026-10-21"
        onImport={() => null}
        onReset={() => null}
        onRetrySave={() => {}}
        onReloadExternal={() => null}
        onReplaceExternal={() => null}
        v27RecoveryCopy={raw}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Download original v27 recovery backup' }));
    expect(await createObjectURL.mock.calls[0]![0].text()).toBe(raw);
  });

  it('restores valid empty state without reinitializing sample goals or completions', () => {
    const empty = {
      goals: [],
      completedRhythmIds: [],
      savedRhythms: [],
      archivedRhythmIds: [],
      datedRhythmCompletions: [],
      activeRhythmCompletions: [],
      rhythmCompletionOverrides: [],
      removedSeedCompletionIds: [],
      rhythmHistoryIds: [],
      strength: createStrengthData(),
      weight: createWeightData(),
      cardio: createCardioData(),
      friendships: createFriendshipData(),
      peopleGroups: createPersonPickerGroups(),
      personDetails: [],
      personNotes: []
    };
    const raw = JSON.stringify(createPreviewEnvelope(empty));
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: raw });
    const result = loadPreview(storage, '2026-10-21');
    expect(result.kind).toBe('loaded');
    if (result.kind === 'loaded') expect(result.data).toEqual(empty);
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(raw);
  });

  it('does not overwrite an existing saved draft during startup or a stale initial write', () => {
    const saved = sampleWithHistory();
    const raw = JSON.stringify(createPreviewEnvelope(saved));
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: raw });
    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(raw);
    expect(writePreview(storage, createSamplePreviewData(), null)).toEqual({ kind: 'conflict', actualRaw: raw });
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(raw);
  });

  it('migrates a v1 backup in memory while preserving goals, corrections, completions, and valid empty states', () => {
    const data = sampleWithHistory();
    const raw = versionOneRaw(data);
    const parsed = parsePreviewBackup(raw, '2026-10-21');
    expect(parsed.valid).toBe(true);
    if (parsed.valid) {
      expect(parsed.envelope.schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
      expect(parsed.envelope.data).toEqual({ ...data, savedRhythms: [], archivedRhythmIds: [] });
      expect(parsed.envelope.data.goals[0]!.checkIns).toEqual(data.goals[0]!.checkIns);
      expect(parsed.envelope.data.goals[0]!.correctionHistory).toEqual(data.goals[0]!.correctionHistory);
      expect(parsed.envelope.data.completedRhythmIds).toEqual(data.completedRhythmIds);
    }

    const emptyV1 = JSON.stringify({
      format: 'tend.synthetic-preview',
      schemaVersion: 1,
      data: { goals: [], completedRhythmIds: [] }
    });
    const emptyResult = parsePreviewBackup(emptyV1, '2026-10-21');
    expect(emptyResult.valid && emptyResult.envelope.data).toEqual({
      goals: [],
      completedRhythmIds: [],
      savedRhythms: [],
      archivedRhythmIds: [],
      datedRhythmCompletions: [],
      activeRhythmCompletions: [],
      rhythmCompletionOverrides: [],
      removedSeedCompletionIds: [],
      rhythmHistoryIds: [],
      strength: createStrengthData(),
      weight: createWeightData(),
      cardio: createCardioData(),
      friendships: createFriendshipData(),
      peopleGroups: createPersonPickerGroups(),
      personDetails: [],
      personNotes: []
    });
  });

  it('migrates v2 previews with editable Rhythms and completions while making them active', () => {
    const data = sampleWithHistory();
    const savedRhythms: PreviewData['savedRhythms'] = [{
      id: 'user-rhythm-11111111-1111-4111-8111-111111111111',
      title: 'Marriage walk',
      cadence: 'Weekly',
      timeLabel: 'Evening',
      personIds: ['sample-person-morgan'],
      categoryIds: ['marriage']
    }];
    const v2Data = { ...data, savedRhythms };
    const parsed = parsePreviewBackup(versionTwoRaw(v2Data), '2026-10-21');
    expect(parsed.valid).toBe(true);
    if (parsed.valid) {
      expect(parsed.sourceSchemaVersion).toBe(2);
      expect(parsed.envelope.schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
      expect(parsed.envelope.data).toEqual({
        ...v2Data,
        savedRhythms: v2Data.savedRhythms.map(rhythm => ({ ...rhythm, timeOfDay: 'evening' })),
        archivedRhythmIds: []
      });
    }
  });

  it('loads v3 without writing and preserves exact bytes before its first explicit v4 save', () => {
    const data = sampleWithHistory();
    const id = 'user-rhythm-11111111-1111-4111-8111-111111111111';
    data.savedRhythms = [{
      id,
      title: 'Descriptive weekly rhythm',
      cadence: '3 times a week',
      timeLabel: 'Evening',
      personIds: ['sample-person-morgan'],
      categoryIds: ['marriage']
    }];
    data.completedRhythmIds.push(id);
    data.archivedRhythmIds = [id];
    const originalRaw = versionThreeRaw(data);
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: originalRaw });

    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    if (loaded.kind !== 'loaded') return;
    expect(loaded.data.savedRhythms[0]).toMatchObject({
      id,
      cadence: '3 times a week',
      timeLabel: 'Evening',
      timeOfDay: 'evening',
      personIds: ['sample-person-morgan'],
      categoryIds: ['marriage']
    });
    expect(loaded.data.savedRhythms[0]!.schedule).toBeUndefined();
    expect(loaded.data.completedRhythmIds).toContain(id);
    expect(loaded.data.archivedRhythmIds).toEqual([id]);

    const result = writePreview(storage, loaded.data, originalRaw, { currentDate: '2026-10-21' });
    expect(result.kind).toBe('saved');
    expect(values.get(PREVIEW_V3_RECOVERY_KEY)).toBe(originalRaw);
    expect(loadV3RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: originalRaw });
    expect(JSON.parse(values.get(PREVIEW_STORAGE_KEY)!).schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
  });

  it('blocks v3 replacement on recovery conflicts or recovery storage failures', () => {
    const originalRaw = versionThreeRaw(sampleWithHistory());
    const conflict = storageFixture({
      [PREVIEW_STORAGE_KEY]: originalRaw,
      [PREVIEW_V3_RECOVERY_KEY]: '{"different":"v3"}'
    });
    expect(loadPreview(conflict.storage, '2026-10-21').kind).toBe('loaded');
    expect(writePreview(conflict.storage, createSamplePreviewData(), originalRaw, {
      currentDate: '2026-10-21'
    })).toMatchObject({ kind: 'error' });
    expect(conflict.values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);

    const values = new Map([[PREVIEW_STORAGE_KEY, originalRaw]]);
    const failingStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key === PREVIEW_V3_RECOVERY_KEY) throw new Error('Recovery write blocked');
        values.set(key, value);
      }
    };
    expect(writePreview(failingStorage, createSamplePreviewData(), originalRaw, {
      currentDate: '2026-10-21'
    }))
      .toMatchObject({ kind: 'error', message: 'Recovery write blocked' });
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    expect(values.has(PREVIEW_V3_RECOVERY_KEY)).toBe(false);
  });

  it('preserves exact v4 bytes before the first v5 replacement and blocks recovery conflicts', () => {
    const originalRaw = ` \n${versionFourRaw(sampleWithHistory())}\n`;
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: originalRaw });
    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    if (loaded.kind !== 'loaded') return;
    expect(loaded.data.datedRhythmCompletions).toEqual([]);

    expect(writePreview(storage, loaded.data, originalRaw, { currentDate: '2026-10-21' }).kind).toBe('saved');
    expect(values.get(PREVIEW_V4_RECOVERY_KEY)).toBe(originalRaw);
    expect(loadV4RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: originalRaw });
    expect(JSON.parse(values.get(PREVIEW_STORAGE_KEY)!).schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);

    const conflicting = storageFixture({
      [PREVIEW_STORAGE_KEY]: originalRaw,
      [PREVIEW_V4_RECOVERY_KEY]: '{"different":"v4"}'
    });
    expect(writePreview(conflicting.storage, createSamplePreviewData(), originalRaw, {
      currentDate: '2026-10-21'
    })).toMatchObject({ kind: 'error' });
    expect(conflicting.values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    expect(conflicting.values.get(PREVIEW_V4_RECOVERY_KEY)).toBe('{"different":"v4"}');

    const failingValues = new Map([[PREVIEW_STORAGE_KEY, originalRaw]]);
    const failingStorage = {
      getItem: (key: string) => failingValues.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key === PREVIEW_V4_RECOVERY_KEY) throw new Error('v4 recovery write blocked');
        failingValues.set(key, value);
      }
    };
    expect(writePreview(failingStorage, createSamplePreviewData(), originalRaw, {
      currentDate: '2026-10-21'
    })).toMatchObject({ kind: 'error', message: 'v4 recovery write blocked' });
    expect(failingValues.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
  });

  it('preserves exact v5 bytes before the first v9 replacement and blocks recovery conflicts', () => {
    const originalRaw = ` \n${versionFiveRaw(sampleWithHistory())}\n`;
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: originalRaw });
    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    expect(loadV5RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: null });
    if (loaded.kind !== 'loaded') return;
    expect(loaded.data.rhythmCompletionOverrides).toEqual([]);
    expect(loaded.data.removedSeedCompletionIds).toEqual([]);

    expect(writePreview(storage, loaded.data, originalRaw, { currentDate: '2026-10-21' }).kind).toBe('saved');
    expect(values.get(PREVIEW_V5_RECOVERY_KEY)).toBe(originalRaw);
    expect(loadV5RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: originalRaw });
    expect(JSON.parse(values.get(PREVIEW_STORAGE_KEY)!).schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);

    const conflicting = storageFixture({
      [PREVIEW_STORAGE_KEY]: originalRaw,
      [PREVIEW_V5_RECOVERY_KEY]: '{"different":"v5"}'
    });
    expect(writePreview(conflicting.storage, createSamplePreviewData(), originalRaw, {
      currentDate: '2026-10-21'
    })).toMatchObject({ kind: 'error' });
    expect(conflicting.values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    expect(conflicting.values.get(PREVIEW_V5_RECOVERY_KEY)).toBe('{"different":"v5"}');

    const failingValues = new Map([[PREVIEW_STORAGE_KEY, originalRaw]]);
    const failingStorage = {
      getItem: (key: string) => failingValues.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key === PREVIEW_V5_RECOVERY_KEY) throw new Error('v5 recovery write blocked');
        failingValues.set(key, value);
      }
    };
    expect(writePreview(failingStorage, createSamplePreviewData(), originalRaw, {
      currentDate: '2026-10-21'
    })).toMatchObject({ kind: 'error', message: 'v5 recovery write blocked' });
    expect(failingValues.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
  });

  it('migrates schema v6 in memory and preserves its exact bytes before a v9 replacement', () => {
    const originalRaw = ` \n${versionSixRaw(sampleWithHistory())}\n`;
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: originalRaw });
    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    expect(loadV6RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: null });
    if (loaded.kind !== 'loaded') return;
    expect(loaded.data.savedRhythms.every(rhythm => rhythm.scoring === undefined)).toBe(true);

    expect(writePreview(storage, loaded.data, originalRaw, { currentDate: '2026-10-21' }).kind).toBe('saved');
    expect(values.get(PREVIEW_V6_RECOVERY_KEY)).toBe(originalRaw);
    expect(loadV6RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: originalRaw });
    expect(JSON.parse(values.get(PREVIEW_STORAGE_KEY)!).schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
  });

  it('migrates schema v7 read-only and preserves its exact bytes before the first v9 write', () => {
    const data = sampleWithHistory();
    const id = 'user-rhythm-77777777-7777-4777-8777-777777777777';
    const schedule = { frequency: 'daily' as const };
    data.savedRhythms = [{
      id,
      title: 'V7 schedule history',
      cadence: 'Daily',
      timeLabel: 'Anytime',
      timeOfDay: 'anytime',
      personIds: [],
      categoryIds: [],
      schedule,
      scoring: {
        trackingStartDate: '2026-10-01',
        timeZone: 'UTC',
        scheduleHistory: [createRhythmSeason(id, '2026-10-01', schedule)]
      }
    }];
    const originalRaw = ` \n${versionSevenRaw(data)}\n`;
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: originalRaw });
    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    expect(loadV7RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: null });
    if (loaded.kind !== 'loaded') return;
    expect(loaded.data.savedRhythms.every(rhythm => rhythm.createdLocalDate === undefined)).toBe(true);
    expect(loaded.data.savedRhythms[0]!.scoring!.scheduleHistory[0]).toEqual(
      {
        ...createRhythmSeason(id, '2026-10-01', schedule),
        paletteToken: 'fern'
      }
    );

    expect(writePreview(storage, loaded.data, originalRaw, { currentDate: '2026-10-21' }).kind).toBe('saved');
    expect(values.get(PREVIEW_V7_RECOVERY_KEY)).toBe(originalRaw);
    expect(loadV7RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: originalRaw });
    expect(JSON.parse(values.get(PREVIEW_STORAGE_KEY)!).schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
  });

  it('migrates v8 schedule history to stable Seasons in memory, then preserves exact bytes before write', () => {
    const data = sampleWithHistory();
    const id = 'user-rhythm-88888888-8888-4888-8888-888888888888';
    const daily = { frequency: 'daily' as const };
    const weekly = { frequency: 'weekly' as const, weekdays: [1, 3] as (1 | 3)[] };
    data.savedRhythms = [{
      id,
      title: 'Schedule history migration',
      cadence: 'Daily',
      timeLabel: 'Anytime',
      timeOfDay: 'anytime',
      personIds: [],
      categoryIds: [],
      schedule: weekly,
      scoring: {
        trackingStartDate: '2026-10-01',
        timeZone: 'America/New_York',
        scheduleHistory: [
          createRhythmSeason(id, '2026-10-01', daily),
          createRhythmSeason(id, '2026-10-10', weekly)
        ]
      }
    }];
    data.completedRhythmIds.push(id);
    data.datedRhythmCompletions.push({
      id: 'v8-migration-completion',
      rhythmId: id,
      effectiveDate: '2026-10-02',
      localTime: '12:00',
      timeZone: 'America/New_York',
      completedAt: '2026-10-02T16:00:00.000Z',
      recordedAt: '2026-10-02T16:01:00.000Z',
      memory: 'Preserved through the schedule migration.'
    });
    data.activeRhythmCompletions.push({ rhythmId: id, completionId: 'v8-migration-completion' });
    const originalRaw = ` \n${versionEightRaw(data)}\n`;
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: originalRaw });
    expect(loadV8RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: null });

    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    if (loaded.kind !== 'loaded') return;
    const seasons = loaded.data.savedRhythms[0]!.scoring!.scheduleHistory;
    expect(seasons).toHaveLength(2);
    expect(seasons.map(season => season.startDate)).toEqual(['2026-10-01', '2026-10-10']);
    expect(seasons.map(season => season.kind === 'scheduled' ? season.schedule : undefined)).toEqual([daily, weekly]);
    expect(rhythmSeasonInclusiveEndDate(seasons, 0)).toBe('2026-10-09');
    expect(seasons[0]).toMatchObject({
      id: `season:${id}:2026-10-01`,
      paletteToken: 'fern'
    });
    expect(seasons[1]?.kind === 'scheduled' ? seasons[1].paletteToken : undefined).toBe('sage');
    expect(seasons[0]!.kind === 'scheduled' ? seasons[0]!.name : undefined).toBeUndefined();
    expect(seasons[0]!.kind === 'scheduled' ? seasons[0]!.note : undefined).toBeUndefined();
    expect(loaded.data.goals).toEqual(data.goals);
    expect(loaded.data.completedRhythmIds).toEqual(data.completedRhythmIds);
    expect(loaded.data.datedRhythmCompletions).toEqual(data.datedRhythmCompletions);
    expect(loaded.data.activeRhythmCompletions).toEqual(data.activeRhythmCompletions);
    const scoreInput = {
      rhythmId: id,
      schedule: weekly,
      records: [{ id: 'v8-migration-completion', rhythmId: id, effectiveDate: '2026-10-02' }],
      recordsAvailable: true,
      asOfDate: '2026-10-21',
      timeZone: 'America/New_York',
      createdLocalDate: '2026-10-01',
      createdTimeZone: 'America/New_York',
      dailyBackfillAllowed: false
    };
    const originalScoring = data.savedRhythms[0]!.scoring!;
    expect(selectDailyRhythmScore({
      ...scoreInput,
      scoring: loaded.data.savedRhythms[0]!.scoring!
    })).toEqual(selectDailyRhythmScore({
      ...scoreInput,
      scoring: originalScoring
    }));

    const reloaded = loadPreview(storage, '2026-10-21');
    expect(reloaded).toMatchObject({ kind: 'loaded', data: loaded.data, raw: originalRaw });
    expect(writePreview(storage, loaded.data, originalRaw, { currentDate: '2026-10-21' }).kind).toBe('saved');
    expect(values.get(PREVIEW_V8_RECOVERY_KEY)).toBe(originalRaw);
    expect(loadV8RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: originalRaw });
    const exported = parsePreviewBackup(values.get(PREVIEW_STORAGE_KEY)!, '2026-10-21');
    expect(exported.valid).toBe(true);
    if (exported.valid) {
      expect(exported.envelope.data.savedRhythms[0]!.scoring!.scheduleHistory).toEqual(seasons);
    }

    const conflicting = storageFixture({
      [PREVIEW_STORAGE_KEY]: originalRaw,
      [PREVIEW_V8_RECOVERY_KEY]: '{"different":"source"}'
    });
    expect(writePreview(conflicting.storage, loaded.data, originalRaw, {
      currentDate: '2026-10-21'
    })).toMatchObject({ kind: 'error' });
    expect(conflicting.values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    expect(conflicting.values.get(PREVIEW_V8_RECOVERY_KEY)).toBe('{"different":"source"}');

    const failingValues = new Map([[PREVIEW_STORAGE_KEY, originalRaw]]);
    const failingStorage = {
      getItem: (key: string) => failingValues.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key === PREVIEW_V8_RECOVERY_KEY) throw new Error('v8 recovery write blocked');
        failingValues.set(key, value);
      }
    };
    expect(writePreview(failingStorage, loaded.data, originalRaw, {
      currentDate: '2026-10-21'
    })).toMatchObject({ kind: 'error', message: 'v8 recovery write blocked' });
    expect(failingValues.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
  });

  it('validates and round-trips seed overrides and removals without allowing invented associations', () => {
    const data = sampleWithHistory();
    data.rhythmCompletionOverrides = [{
      id: 'sample-connect-2026-10-17',
      rhythmId: 'sample-connect',
      effectiveDate: '2026-10-16',
      memory: 'Edited without adding a time.'
    }, {
      id: 'sample-connect-2026-10-20',
      rhythmId: 'sample-connect',
      effectiveDate: '2026-10-20',
      localTime: '09:30',
      timeZone: 'UTC',
      completedAt: '2026-10-20T09:30:00.000Z'
    }];
    data.removedSeedCompletionIds = ['sample-connect-2026-10-18'];
    const raw = JSON.stringify(createPreviewEnvelope(data));
    const parsed = parsePreviewBackup(raw, '2026-10-21');
    expect(parsed.valid).toBe(true);
    if (parsed.valid) expect(parsed.envelope.data).toEqual(data);

    const invalidOverride = JSON.parse(raw) as {
      data: { rhythmCompletionOverrides: Array<Record<string, unknown>> };
    };
    invalidOverride.data.rhythmCompletionOverrides[0]!.rhythmId = 'sample-pray-together';
    expect(parsePreviewBackup(JSON.stringify(invalidOverride), '2026-10-21')).toMatchObject({
      valid: false,
      kind: 'invalid'
    });

    const conflicted = JSON.parse(raw) as {
      data: { removedSeedCompletionIds: string[] };
    };
    conflicted.data.removedSeedCompletionIds.push('sample-connect-2026-10-17');
    expect(parsePreviewBackup(JSON.stringify(conflicted), '2026-10-21')).toMatchObject({
      valid: false,
      kind: 'invalid'
    });
  });

  it('does not automatically replace malformed supported-version source data', () => {
    const malformedEnvelope = JSON.parse(versionThreeRaw(sampleWithHistory())) as {
      data: { archivedRhythmIds: string[] };
    };
    malformedEnvelope.data.archivedRhythmIds = ['unresolved-rhythm-id'];
    const raw = JSON.stringify(malformedEnvelope);
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: raw });
    expect(loadPreview(storage, '2026-10-21')).toMatchObject({ kind: 'corrupt', raw });
    expect(writePreview(storage, createSamplePreviewData(), raw, {
      currentDate: '2026-10-21'
    })).toMatchObject({ kind: 'error' });
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(raw);
    expect(values.has(PREVIEW_V3_RECOVERY_KEY)).toBe(false);
  });

  it('archives the exact v1 envelope before the first v4 write and never overwrites that recovery copy', () => {
    const initial = sampleWithHistory();
    const originalRaw = versionOneRaw(initial);
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: originalRaw });
    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    expect(loaded.data).toEqual({ ...initial, savedRhythms: [] });
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    expect(loadV1RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: null });

    const updated = { ...loaded.data, completedRhythmIds: ['sample-connect'] };
    expect(writePreview(storage, updated, originalRaw, { currentDate: '2026-10-21' }).kind).toBe('saved');
    expect(values.get(PREVIEW_V1_RECOVERY_KEY)).toBe(originalRaw);
    const recoveryCopy = values.get(PREVIEW_V1_RECOVERY_KEY);
    const activeV2 = values.get(PREVIEW_STORAGE_KEY)!;
    expect(JSON.parse(activeV2).schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
    expect(writePreview(storage, { ...updated, completedRhythmIds: [] }, activeV2, {
      currentDate: '2026-10-21'
    }).kind).toBe('saved');
    expect(values.get(PREVIEW_V1_RECOVERY_KEY)).toBe(recoveryCopy);

    const occupied = storageFixture({
      [PREVIEW_STORAGE_KEY]: originalRaw,
      [PREVIEW_V1_RECOVERY_KEY]: '{"other":"preserved"}'
    });
    expect(writePreview(occupied.storage, loaded.data, originalRaw, {
      currentDate: '2026-10-21'
    })).toMatchObject({ kind: 'error' });
    expect(occupied.values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    expect(occupied.values.get(PREVIEW_V1_RECOVERY_KEY)).toBe('{"other":"preserved"}');
  });

  it('preserves exact v2 bytes before migration and blocks conflicting recovery copies', () => {
    const data = sampleWithHistory();
    data.savedRhythms = [{
      id: 'user-rhythm-11111111-1111-4111-8111-111111111111',
      title: 'Marriage walk',
      cadence: 'Weekly',
      timeLabel: 'Evening',
      personIds: ['sample-person-morgan'],
      categoryIds: ['marriage']
    }];
    const originalRaw = versionTwoRaw(data);
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: originalRaw });
    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;

    expect(writePreview(storage, {
      ...loaded.data,
      archivedRhythmIds: [data.savedRhythms[0]!.id]
    }, originalRaw, { currentDate: '2026-10-21' }).kind).toBe('saved');
    expect(values.get(PREVIEW_V2_RECOVERY_KEY)).toBe(originalRaw);
    expect(loadV2RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: originalRaw });
    expect(JSON.parse(values.get(PREVIEW_STORAGE_KEY)!).schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);

    const occupied = storageFixture({
      [PREVIEW_STORAGE_KEY]: originalRaw,
      [PREVIEW_V2_RECOVERY_KEY]: '{"different":"v2"}'
    });
    expect(writePreview(occupied.storage, loaded.data, originalRaw, {
      currentDate: '2026-10-21'
    })).toMatchObject({ kind: 'error' });
    expect(occupied.values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    expect(occupied.values.get(PREVIEW_V2_RECOVERY_KEY)).toBe('{"different":"v2"}');
  });

  it('round-trips legacy fitness records and leaves new scoring history unavailable', () => {
    const data = sampleWithHistory();
    const id = 'user-rhythm-11111111-1111-4111-8111-111111111111';
    data.savedRhythms = [{
      id,
      title: 'Monthly connection',
      cadence: 'Monthly',
      timeLabel: 'All day',
      timeOfDay: 'all-day',
      schedule: {
        frequency: 'monthly',
        pattern: { kind: 'ordinalWeekday', ordinal: 2, weekday: 4 },
        endDate: '2028-10-22'
      },
      scoring: {
        trackingStartDate: '2026-10-01',
        timeZone: 'America/New_York',
        scheduleHistory: [createRhythmSeason(id, '2026-10-01', {
            frequency: 'monthly',
            pattern: { kind: 'ordinalWeekday', ordinal: 2, weekday: 4 },
            endDate: '2028-10-22'
          })]
      },
      personal: true,
      personIds: ['sample-person-morgan', 'sample-person-avery'],
      categoryIds: ['health', 'friendships'],
      primaryFoundationId: 'connection',
      secondaryFoundationIds: ['partnership'],
      healthLogCapability: 'weight'
    }];
    data.weight = {
      displayUnit: 'kg',
      goals: {
        startWeightKg: 90.718474,
        startDate: '2026-10-01',
        targetWeightKg: 81.646626,
        goalDate: '2027-01-01',
        importedNote: 'Preserve this unknown field.'
      },
      weighIns: [
        { id: 'preserved-weight-entry', date: '2026-10-20', weightKg: 88.4, legacyField: 'kept' },
        { id: 'invalid-weight-entry', date: 'not-a-date', value: 'preserve raw record' }
      ],
      extraWeightField: { untouched: true }
    };
    data.cardio = {
      goals: { weeklyRunTarget: 2, weeklyMileTarget: 8 },
      runs: [{ id: 'preserved-cardio-run', date: '2026-10-20', distance: 3, legacyField: 'kept' }],
      extraCardioField: { untouched: true }
    };
    data.completedRhythmIds.push(id);
    data.archivedRhythmIds = [id];
    data.rhythmCompletionOverrides = [{
      id: 'sample-connect-2026-10-17',
      rhythmId: 'sample-connect',
      effectiveDate: '2026-10-16',
      memory: 'A date-only fixture edit.'
    }];
    data.removedSeedCompletionIds = ['sample-connect-2026-10-18'];
    const { storage } = storageFixture();

    const saved = writePreview(storage, data, null);
    expect(saved.kind).toBe('saved');
    if (saved.kind !== 'saved') return;
    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    expect(loaded.data).toMatchObject(data);
    expect(loaded.data.cardio.targetHistory).toEqual([]);
    expect(loaded.data.strength.trackingStartDate).toBeUndefined();
    expect(loaded.data.strength.scoringSettingsHistory).toEqual([]);
    expect(parsePreviewBackup(saved.raw, '2026-10-21')).toMatchObject({
      valid: true,
      sourceSchemaVersion: PREVIEW_SCHEMA_VERSION,
      envelope: { schemaVersion: PREVIEW_SCHEMA_VERSION }
    });

  });

  it('hydrates v16 Weight with an empty default and saves the exact source bytes for recovery', () => {
      const data = createSamplePreviewData();
      const current = createPreviewEnvelope(data);
      const {
        weight: _weight,
        cardio: _cardio,
        friendships: _friendships,
        peopleGroups: _peopleGroups,
        personDetails: _personDetails,
        personNotes: _personNotes,
        ...v16Data
      } = current.data;
      const source = JSON.stringify({ ...current, schemaVersion: 16, data: v16Data });
      const originalRaw = ` \n${source}\n`;
      const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: originalRaw });

      const loaded = loadPreview(storage, '2026-10-21');
      expect(loaded.kind).toBe('loaded');
      expect(values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
      if (loaded.kind !== 'loaded') return;
      expect(loaded.data.weight).toEqual(createWeightData());

      expect(writePreview(storage, loaded.data, originalRaw, { currentDate: '2026-10-21' }).kind).toBe('saved');
      expect(values.get(PREVIEW_V16_RECOVERY_KEY)).toBe(originalRaw);
      expect(loadV16RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: originalRaw });
  });

  it('hydrates v17 Weight with empty Cardio and Friendships defaults and preserves exact bytes before schema v21 writes', () => {
    const data = createSamplePreviewData();
    data.weight = {
      displayUnit: 'lb',
      goals: { startWeightKg: 80, startDate: '2026-10-01', targetWeightKg: 75, goalDate: '2027-01-01' },
      weighIns: [{ id: 'existing-v17-weigh-in', date: '2026-10-20', weightKg: 78 }]
    };
    const current = createPreviewEnvelope(data);
    const {
      cardio: _cardio,
      friendships: _friendships,
      peopleGroups: _peopleGroups,
      personDetails: _personDetails,
      personNotes: _personNotes,
      ...v17Data
    } = current.data;
    const source = JSON.stringify({ ...current, schemaVersion: 17, data: v17Data });
    const originalRaw = ` \n${source}\n`;
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: originalRaw });

    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    if (loaded.kind !== 'loaded') return;
    expect(loaded.data.weight).toEqual(data.weight);
    expect(loaded.data.cardio).toEqual(createCardioData());

    expect(writePreview(storage, loaded.data, originalRaw, { currentDate: '2026-10-21' }).kind).toBe('saved');
    expect(values.get(PREVIEW_V17_RECOVERY_KEY)).toBe(originalRaw);
    expect(loadV17RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: originalRaw });
  });

  it('hydrates v18 with empty Friendships and People defaults and preserves exact source bytes before schema v21 writes', () => {
    const data = createSamplePreviewData();
    const current = createPreviewEnvelope(data);
    const {
      friendships: _friendships,
      peopleGroups: _peopleGroups,
      personDetails: _personDetails,
      personNotes: _personNotes,
      ...v18Data
    } = current.data;
    const originalRaw = ` \n${JSON.stringify({ ...current, schemaVersion: 18, data: v18Data })}\n`;
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: originalRaw });

    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    if (loaded.kind !== 'loaded') return;
    expect(loaded.data.friendships).toEqual(createFriendshipData());

    expect(writePreview(storage, loaded.data, originalRaw, { currentDate: '2026-10-21' }).kind).toBe('saved');
    expect(values.get(PREVIEW_V18_RECOVERY_KEY)).toBe(originalRaw);
    expect(loadV18RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: originalRaw });
  });

  it('hydrates v14 with default Strength, Weight, Friendships, and People data and preserves exact source bytes before schema v21 writes', () => {
    const data = sampleWithHistory();
    const envelope = createPreviewEnvelope(data);
    const {
      strength: _strength,
      weight: _weight,
      cardio: _cardio,
      friendships: _friendships,
      peopleGroups: _peopleGroups,
      personDetails: _personDetails,
      personNotes: _personNotes,
      ...v14Data
    } = envelope.data;
    const originalRaw = JSON.stringify({ ...envelope, schemaVersion: 14, data: v14Data });
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: originalRaw });

    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    expect(loadV14RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: null });
    if (loaded.kind !== 'loaded') return;
    expect(loaded.data.strength).toEqual(createStrengthData());

    expect(writePreview(storage, loaded.data, originalRaw, { currentDate: '2026-10-21' }).kind).toBe('saved');
    expect(values.get(PREVIEW_V14_RECOVERY_KEY)).toBe(originalRaw);
    expect(loadV14RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: originalRaw });
    expect(JSON.parse(values.get(PREVIEW_STORAGE_KEY)!).schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
  });

  it('preserves exact v12 source bytes before the first association-schema v13 write', () => {
    const data = createSamplePreviewData();
    const current = createPreviewEnvelope(data);
    const {
      strength: _strength,
      weight: _weight,
      cardio: _cardio,
      friendships: _friendships,
      peopleGroups: _peopleGroups,
      personDetails: _personDetails,
      personNotes: _personNotes,
      ...v12Data
    } = current.data;
    const source = JSON.stringify({
      format: current.format,
      schemaVersion: 12,
      data: v12Data
    });
    const originalRaw = ` \n${source}\n`;
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: originalRaw });
    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;

    expect(writePreview(storage, loaded.data, originalRaw, { currentDate: '2026-10-21' }).kind).toBe('saved');
    expect(values.get(PREVIEW_V12_RECOVERY_KEY)).toBe(originalRaw);
    expect(loadV12RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: originalRaw });
    expect(JSON.parse(values.get(PREVIEW_STORAGE_KEY)!).schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
  });

    it('migrates v10 read-only and recovers exact source bytes before the first schema v13 save', () => {
      const data = sampleWithHistory();
      const id = 'user-rhythm-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const daily = { frequency: 'daily' as const };
      const weekly = { frequency: 'weekly' as const, weekdays: [4] as (4)[] };
      const first = { ...createRhythmSeason(id, '2026-10-01', daily), name: 'Daily start', note: 'Prior note.' };
      const current = createRhythmSeason(id, '2026-10-10', weekly);
      data.savedRhythms = [{
        id,
        title: 'Versioned Thursday Rhythm',
        cadence: 'Weekly',
        timeLabel: 'Afternoon',
        timeOfDay: 'afternoon',
        schedule: weekly,
        scoring: {
          trackingStartDate: '2026-10-01',
          timeZone: 'America/New_York',
          scheduleHistory: [first, current]
        },
        personIds: ['sample-person-morgan'],
        categoryIds: ['marriage']
      }];
      data.datedRhythmCompletions = [{
        id: 'v10-preserved-log',
        rhythmId: id,
        effectiveDate: '2026-10-08',
        localTime: '17:00',
        timeZone: 'America/New_York',
        completedAt: '2026-10-08T21:00:00.000Z',
        recordedAt: '2026-10-08T21:05:00.000Z',
        memory: 'Keep this exact note.'
      }];
      data.completedRhythmIds = [id];
      data.activeRhythmCompletions = [{ rhythmId: id, completionId: 'v10-preserved-log' }];
      data.rhythmHistoryIds = [id];

      const originalRaw = ` \n${versionTenRaw(data)}\n`;
      const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: originalRaw });
      const setItem = vi.spyOn(storage, 'setItem');
      const loaded = loadPreview(storage, '2026-10-21');

      expect(loaded.kind).toBe('loaded');
      expect(values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
      expect(setItem).not.toHaveBeenCalled();
      if (loaded.kind !== 'loaded') return;
      expect(loaded.data.savedRhythms[0]!.scoring!.scheduleHistory).toEqual([
        first,
        current
      ]);
      expect(loaded.data.datedRhythmCompletions).toEqual(data.datedRhythmCompletions);
      expect(loaded.data.activeRhythmCompletions).toEqual(data.activeRhythmCompletions);
      expect(loaded.data.rhythmHistoryIds).toEqual([id]);

      expect(writePreview(storage, loaded.data, originalRaw, { currentDate: '2026-10-21' }).kind).toBe('saved');
      expect(values.get(PREVIEW_V10_RECOVERY_KEY)).toBe(originalRaw);
      expect(JSON.parse(values.get(PREVIEW_STORAGE_KEY)!).schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
    });

    it('blocks v10 replacement on exact-recovery conflicts and failed recovery writes', () => {
      const originalRaw = versionTenRaw(sampleWithHistory());
      const conflicting = storageFixture({
        [PREVIEW_STORAGE_KEY]: originalRaw,
        [PREVIEW_V10_RECOVERY_KEY]: '{"different":"v10"}'
      });
      const conflict = writePreview(conflicting.storage, createSamplePreviewData(), originalRaw, {
        currentDate: '2026-10-21'
      });
      expect(conflict).toMatchObject({ kind: 'error' });
      expect(conflicting.values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
      expect(conflicting.values.get(PREVIEW_V10_RECOVERY_KEY)).toBe('{"different":"v10"}');

      const values = new Map([[PREVIEW_STORAGE_KEY, originalRaw]]);
      const failedRecoveryStorage = {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => {
          if (key === PREVIEW_V10_RECOVERY_KEY) throw new Error('v10 recovery write blocked');
          values.set(key, value);
        }
      };
      expect(writePreview(failedRecoveryStorage, createSamplePreviewData(), originalRaw, {
        currentDate: '2026-10-21'
      })).toMatchObject({ kind: 'error', message: 'v10 recovery write blocked' });
      expect(values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
      expect(values.has(PREVIEW_V10_RECOVERY_KEY)).toBe(false);
    });

    it('migrates v11 without guessing ambiguous single-day identity and preserves the exact source before saving v13', () => {
      const data = sampleWithHistory();
      const id = 'user-rhythm-cccccccc-cccc-4ccc-8ccc-cccccccccccc';
      const weekly = { frequency: 'weekly' as const, weekdays: [1] as (1)[] };
      const season = createRhythmSeason(id, '2026-10-19', weekly);
      data.savedRhythms = [{
        id,
        title: 'Legacy single weekday',
        cadence: 'Weekly',
        timeLabel: 'Anytime',
        timeOfDay: 'anytime',
        personIds: [],
        categoryIds: [],
        schedule: weekly,
        scoring: { trackingStartDate: '2026-10-19', timeZone: 'UTC', scheduleHistory: [season] },
        createdLocalDate: '2026-10-19',
        createdTimeZone: 'UTC'
      }];
      data.datedRhythmCompletions = [{
        id: 'legacy-tuesday-log',
        rhythmId: id,
        effectiveDate: '2026-10-20',
        localTime: '09:00',
        timeZone: 'UTC',
        completedAt: '2026-10-20T09:00:00.000Z',
        recordedAt: '2026-10-20T09:05:00.000Z'
      }];
      data.rhythmHistoryIds = [id];
      const versionTwelve = createPreviewEnvelope(data);
      const {
        strength: _strength,
        weight: _weight,
        cardio: _cardio,
        friendships: _friendships,
        peopleGroups: _peopleGroups,
        personDetails: _personDetails,
        personNotes: _personNotes,
        ...versionElevenData
      } = versionTwelve.data;
      const originalRaw = ` \n${JSON.stringify({
        ...versionTwelve,
        schemaVersion: 11,
        data: versionElevenData
      })}\n`;
      const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: originalRaw });
      const setItem = vi.spyOn(storage, 'setItem');

      const loaded = loadPreview(storage, '2026-10-25');
      expect(loaded.kind).toBe('loaded');
      expect(values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
      expect(setItem).not.toHaveBeenCalled();
      expect(loadV11RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: null });
      if (loaded.kind !== 'loaded') return;
      expect(loaded.data.savedRhythms[0]!.schedule).toEqual(weekly);
      expect(loaded.data.savedRhythms[0]!.scoring!.scheduleHistory).toEqual([season]);
      expect(loaded.data.datedRhythmCompletions).toEqual(data.datedRhythmCompletions);

      expect(writePreview(storage, loaded.data, originalRaw, { currentDate: '2026-10-25' }).kind).toBe('saved');
      expect(loadV11RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: originalRaw });
      const reloaded = loadPreview(storage, '2026-10-25');
      expect(reloaded.kind).toBe('loaded');
      if (reloaded.kind !== 'loaded') return;
      expect(reloaded.data.savedRhythms[0]!.schedule).toEqual(weekly);
      expect(reloaded.data.savedRhythms[0]!.scoring!.scheduleHistory).toEqual([season]);
      expect(reloaded.data.datedRhythmCompletions).toEqual(data.datedRhythmCompletions);
      expect(JSON.parse(values.get(PREVIEW_STORAGE_KEY)!).schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
    });

    it('round-trips the explicit single-day Select Days marker through saved Season metadata', () => {
      const data = sampleWithHistory();
      const id = 'user-rhythm-dddddddd-dddd-4ddd-8ddd-dddddddddddd';
      const schedule = {
        frequency: 'weekly' as const,
        weekdays: [1] as (1)[],
        weeklyMode: 'select-days' as const
      };
      const season = createRhythmSeason(id, '2026-10-19', schedule);
      data.savedRhythms = [{
        id,
        title: 'Monday-only practice',
        cadence: 'Select Days',
        timeLabel: 'Anytime',
        timeOfDay: 'anytime',
        personIds: [],
        categoryIds: [],
        schedule,
        scoring: { trackingStartDate: '2026-10-19', timeZone: 'UTC', scheduleHistory: [season] },
        createdLocalDate: '2026-10-19',
        createdTimeZone: 'UTC'
      }];
      data.datedRhythmCompletions = [{
        id: 'select-days-monday-log',
        rhythmId: id,
        effectiveDate: '2026-10-19',
        localTime: '09:00',
        timeZone: 'UTC',
        completedAt: '2026-10-19T09:00:00.000Z',
        recordedAt: '2026-10-19T09:05:00.000Z'
      }];
      data.rhythmHistoryIds = [id];
      const { storage, values } = storageFixture();

      expect(writePreview(storage, data, null).kind).toBe('saved');
      expect(JSON.parse(values.get(PREVIEW_STORAGE_KEY)!).schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
      const loaded = loadPreview(storage, '2026-10-25');
      expect(loaded.kind).toBe('loaded');
      if (loaded.kind !== 'loaded') return;
      expect(loaded.data.savedRhythms[0]!.schedule).toEqual(schedule);
      expect(loaded.data.savedRhythms[0]!.scoring!.scheduleHistory).toEqual([season]);
      expect(loaded.data.datedRhythmCompletions).toEqual(data.datedRhythmCompletions);
    });

    it('saves through the production localStorage adapter and hydrates a fresh adapter with Season metadata intact', () => {
      const data = sampleWithHistory();
      const id = 'user-rhythm-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      const schedule = { frequency: 'weekly' as const, weekdays: [4] as (4)[] };
      const season = {
        ...createRhythmSeason(id, '2026-10-01', schedule, 'evening'),
        name: 'Thursday walks'
      };
      data.savedRhythms = [{
        id,
        title: 'Persistent Thursday Rhythm',
        cadence: 'Weekly',
        timeLabel: 'Afternoon',
        timeOfDay: 'afternoon',
        schedule,
        scoring: { trackingStartDate: '2026-10-01', timeZone: 'America/New_York', scheduleHistory: [season] },
        personIds: ['sample-person-morgan'],
        categoryIds: ['marriage']
      }];
      data.datedRhythmCompletions = [{
        id: 'fresh-adapter-log',
        rhythmId: id,
        effectiveDate: '2026-10-08',
        localTime: '17:00',
        timeZone: 'America/New_York',
        completedAt: '2026-10-08T21:00:00.000Z',
        recordedAt: '2026-10-08T21:05:00.000Z',
        memory: 'Original note.'
      }];
      data.completedRhythmIds = [id];
      data.activeRhythmCompletions = [{ rhythmId: id, completionId: 'fresh-adapter-log' }];
      data.rhythmHistoryIds = [id];

      const writerAdapter = browserPreviewStorage();
      const write = writePreview(writerAdapter, data, null);
      expect(write.kind).toBe('saved');
      const freshAdapter = browserPreviewStorage();
      const reloaded = loadPreview(freshAdapter, '2026-10-21');
      expect(reloaded.kind).toBe('loaded');
      if (reloaded.kind !== 'loaded') return;
      expect(reloaded.data.savedRhythms[0]!.scoring!.scheduleHistory).toEqual([season]);
      expect(reloaded.data.datedRhythmCompletions).toEqual(data.datedRhythmCompletions);
      expect(reloaded.data.activeRhythmCompletions).toEqual(data.activeRhythmCompletions);
      expect(reloaded.data.rhythmHistoryIds).toEqual([id]);
      const backup = parsePreviewBackup(write.kind === 'saved' ? write.raw : '', '2026-10-21');
      expect(backup.valid).toBe(true);
      if (backup.valid) {
        expect(backup.envelope.schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
        expect(backup.envelope.data.savedRhythms[0]!.scoring!.scheduleHistory).toEqual([season]);
        expect(backup.envelope.data.datedRhythmCompletions).toEqual(data.datedRhythmCompletions);
      }
    });
  it('migrates v9 markers from evidenced dated logs without writing during hydration and backs up exact bytes', () => {
    const data = sampleWithHistory();
    const id = 'user-rhythm-99999999-9999-4999-8999-999999999999';
    const schedule = { frequency: 'daily' as const };
    data.savedRhythms = [{
      id,
      title: 'History marker migration',
      cadence: 'Daily',
      timeLabel: 'Anytime',
      timeOfDay: 'anytime',
      personIds: [],
      categoryIds: [],
      schedule,
      scoring: {
        trackingStartDate: '2026-10-01',
        timeZone: 'UTC',
        scheduleHistory: [createRhythmSeason(id, '2026-10-01', schedule)]
      }
    }];
    data.datedRhythmCompletions = [{
      id: 'migration-marker-record',
      rhythmId: id,
      effectiveDate: '2026-10-02',
      localTime: '12:00',
      timeZone: 'UTC',
      completedAt: '2026-10-02T12:00:00.000Z',
      recordedAt: '2026-10-02T12:01:00.000Z'
    }];
    data.completedRhythmIds = [id];
    data.activeRhythmCompletions = [{ rhythmId: id, completionId: 'migration-marker-record' }];
    const originalRaw = ` \n${versionNineRaw(data)}\n`;
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: originalRaw });

    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    expect(loadV9RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: null });
    if (loaded.kind !== 'loaded') return;
    expect(loaded.data.rhythmHistoryIds).toEqual([id]);

    expect(writePreview(storage, loaded.data, originalRaw, { currentDate: '2026-10-21' }).kind).toBe('saved');
    expect(values.get(PREVIEW_V9_RECOVERY_KEY)).toBe(originalRaw);
    expect(loadV9RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: originalRaw });
    expect(JSON.parse(values.get(PREVIEW_STORAGE_KEY)!).schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
  });

  it('does not overwrite an unsupported active envelope', () => {
    const unsupportedRaw = JSON.stringify({
      format: 'tend.synthetic-preview',
      schemaVersion: PREVIEW_SCHEMA_VERSION + 1,
      data: { goals: [], completedRhythmIds: [], savedRhythms: [], archivedRhythmIds: [] }
    });
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: unsupportedRaw });
    expect(loadPreview(storage, '2026-10-21')).toMatchObject({ kind: 'unsupported', raw: unsupportedRaw });
    expect(writePreview(storage, createSamplePreviewData(), null)).toEqual({
      kind: 'conflict',
      actualRaw: unsupportedRaw
    });
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(unsupportedRaw);
  });

  it('keeps malformed v7 data untouched and blocks non-explicit adapter writes', () => {
    const data = sampleWithHistory();
    data.savedRhythms = [{
      id: 'user-rhythm-11111111-1111-4111-8111-111111111111',
      title: 'Malformed schedule',
      cadence: 'Weekly',
      timeLabel: 'Morning',
      timeOfDay: 'morning',
      schedule: { frequency: 'weekly', weekdays: [1] },
      personIds: [],
      categoryIds: []
    }];
    const malformed = JSON.parse(JSON.stringify(createPreviewEnvelope(data))) as {
      data: { savedRhythms: Array<Record<string, unknown>> };
    };
    malformed.data.savedRhythms[0]!.schedule = {
      frequency: 'weekly',
      weekdays: [1, 1]
    };
    const raw = JSON.stringify(malformed);
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: raw });
    expect(loadPreview(storage, '2026-10-21')).toMatchObject({ kind: 'corrupt', raw });
    expect(writePreview(storage, createSamplePreviewData(), raw, {
      currentDate: '2026-10-21'
    })).toMatchObject({ kind: 'error' });
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(raw);
  });

  it('touches only the isolated preview key, leaving existing Tend storage keys unchanged', () => {
    const legacyKeys = {
      'tend-state': '{"live":"unchanged"}',
      'tend:account-cache': '{"account":"unchanged"}',
      'supabase.auth.token': '{"auth":"unchanged"}',
      'tend:calendar-cache': '{"calendar":"unchanged"}',
      'tend:sync-state': '{"sync":"unchanged"}'
    };
    const { storage, values } = storageFixture(legacyKeys);
    expect(loadPreview(storage, '2026-10-21').kind).toBe('missing');
    expect(writePreview(storage, createSamplePreviewData(), null).kind).toBe('saved');
    for (const [key, value] of Object.entries(legacyKeys)) expect(values.get(key)).toBe(value);
    expect([...values.keys()]).toEqual([...Object.keys(legacyKeys), PREVIEW_STORAGE_KEY]);
  });

  it('rejects malformed JSON, unsupported versions, malformed records, duplicate IDs, and invalid references', () => {
    expect(parsePreviewBackup('{', '2026-10-21').valid).toBe(false);
    const unsupported = createPreviewEnvelope(sampleWithHistory());
    expect(validatePreviewEnvelope({ ...unsupported, schemaVersion: PREVIEW_SCHEMA_VERSION + 1 }, '2026-10-21')).toMatchObject({
      valid: false,
      kind: 'unsupported'
    });
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      const data = value.data as Record<string, unknown>;
      (data.goals as Array<Record<string, unknown>>)[0]!.targetBalanceMinor = -1;
    }), '2026-10-21').valid).toBe(false);
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      const data = value.data as Record<string, unknown>;
      const goals = data.goals as Array<Record<string, unknown>>;
      goals.push({ ...goals[0] });
    }), '2026-10-21').valid).toBe(false);
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      const data = value.data as Record<string, unknown>;
      data.completedRhythmIds = ['not-a-today-example'];
    }), '2026-10-21').valid).toBe(false);
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      const data = value.data as Record<string, unknown>;
      data.archivedRhythmIds = ['not-a-today-example'];
    }), '2026-10-21').valid).toBe(false);
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      const data = value.data as Record<string, unknown>;
      data.archivedRhythmIds = ['sample-pray-together', 'sample-pray-together'];
    }), '2026-10-21').valid).toBe(false);
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      delete (value.data as Record<string, unknown>).archivedRhythmIds;
    }), '2026-10-21').valid).toBe(false);
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      const data = value.data as Record<string, unknown>;
      const goals = data.goals as Array<Record<string, unknown>>;
      goals[0]!.startDate = '2026-02-30';
    }), '2026-10-21').valid).toBe(false);
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      const data = value.data as Record<string, unknown>;
      const goals = data.goals as Array<Record<string, unknown>>;
      const checkIns = goals[0]!.checkIns as Array<Record<string, unknown>>;
      checkIns[0]!.effectiveDate = 'not-a-date';
    }), '2026-10-21').valid).toBe(false);
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      const data = value.data as Record<string, unknown>;
      const goals = data.goals as Array<Record<string, unknown>>;
      const checkIns = goals[0]!.checkIns as Array<Record<string, unknown>>;
      checkIns[0]!.effectiveDate = '2026-10-22';
    }), '2026-10-21').valid).toBe(false);
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      const data = value.data as Record<string, unknown>;
      const goals = data.goals as Array<Record<string, unknown>>;
      const checkIns = goals[0]!.checkIns as Array<Record<string, unknown>>;
      checkIns[1]!.id = checkIns[0]!.id;
    }), '2026-10-21').valid).toBe(false);
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      const data = value.data as Record<string, unknown>;
      const goals = data.goals as Array<Record<string, unknown>>;
      goals[0]!.currency = 'ZZZ';
    }), '2026-10-21').valid).toBe(false);
  });

  it('preserves corrupt stored bytes and reports blocked and quota-failed storage', () => {
    const corruptRaw = '{"broken":';
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: corruptRaw });
    expect(loadPreview(storage, '2026-10-21')).toMatchObject({ kind: 'corrupt', raw: corruptRaw });
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(corruptRaw);

    const blocked = {
      getItem: () => { throw new Error('Storage access denied'); },
      setItem: () => {},
      removeItem: () => {}
    };
    expect(loadPreview(blocked, '2026-10-21')).toMatchObject({ kind: 'unavailable', message: 'Storage access denied' });

    const quota = {
      getItem: () => null,
      setItem: () => { throw new Error('Quota exceeded'); },
      removeItem: () => {}
    };
    expect(writePreview(quota, createSamplePreviewData(), null))
      .toMatchObject({ kind: 'error', message: 'Quota exceeded' });
  });

  it('detects an external-tab write before replacing a stale value', () => {
    const first = JSON.stringify(createPreviewEnvelope(createSamplePreviewData()));
    const secondData = sampleWithHistory();
    const second = JSON.stringify(createPreviewEnvelope(secondData));
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: first });
    expect(writePreview(storage, secondData, first, { currentDate: '2026-10-21' })).toMatchObject({ kind: 'saved' });
    expect(writePreview(storage, createSamplePreviewData(), first, { currentDate: '2026-10-21' }))
      .toEqual({ kind: 'conflict', actualRaw: second });
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(second);
  });
});

async function openPreviewSettings(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'More, settings' }));
  await user.click(await screen.findByRole('button', { name: 'Settings' }));
}

describe('preview backup controls', () => {
  it('exports the explicit envelope and imports the backup through confirmation', async () => {
    const user = userEvent.setup();
    const data = sampleWithHistory();
    data.archivedRhythmIds = ['sample-pray-together'];
    const onImport = vi.fn(() => null);
    const { createObjectURL } = setDownloadMocks();
    render(
      <PreviewDataControls
        data={data}
        status={{ kind: 'saved' }}
        currentDate="2026-10-21"
        onImport={onImport}
        onReset={() => null}
        onRetrySave={() => {}}
        onReloadExternal={() => null}
        onReplaceExternal={() => null}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Export preview backup' }));
    const exportedBlob = createObjectURL.mock.calls[0]![0];
    const exportedText = await exportedBlob.text();
    const exported = JSON.parse(exportedText) as Record<string, unknown>;
    expect(Object.keys(exported).sort()).toEqual(['data', 'format', 'schemaVersion']);
    expect(exported.format).toBe('tend.synthetic-preview');
    expect(exported.schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
    expect((exported.data as PreviewData).archivedRhythmIds).toEqual(['sample-pray-together']);
    await user.upload(
      screen.getByLabelText('Import preview backup'),
      new File([exportedText], 'exported.json', { type: 'application/json' })
    );
    const dialog = await screen.findByRole('dialog', { name: 'Replace preview data?' });
    await user.click(within(dialog).getByRole('button', { name: 'Replace with backup' }));
    expect(onImport).toHaveBeenCalledWith(data);
  });

  it('imports v2 backups as active and explains the missing archive state before replacement', async () => {
    const user = userEvent.setup();
    const legacyData = sampleWithHistory();
    legacyData.savedRhythms = [{
      id: 'user-rhythm-11111111-1111-4111-8111-111111111111',
      title: 'Earlier saved Rhythm',
      cadence: 'Weekly',
      timeLabel: 'Evening',
      personIds: ['sample-person-morgan'],
      categoryIds: ['marriage']
    }];
    const onImport = vi.fn(() => null);
    render(
      <PreviewDataControls
        data={createSamplePreviewData()}
        status={{ kind: 'saved' }}
        currentDate="2026-10-21"
        onImport={onImport}
        onReset={() => null}
        onRetrySave={() => {}}
        onReloadExternal={() => null}
        onReplaceExternal={() => null}
      />
    );
    await user.upload(
      screen.getByLabelText('Import preview backup'),
      new File([versionTwoRaw(legacyData)], 'v2-backup.json', { type: 'application/json' })
    );
    const dialog = await screen.findByRole('dialog', { name: 'Replace preview data?' });
    expect(within(dialog).getByText(/predates archive status, so its Rhythms will be restored as active/)).toBeTruthy();
    expect(onImport).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Replace with backup' }));
    expect(onImport).toHaveBeenCalledWith({
      ...legacyData,
      savedRhythms: legacyData.savedRhythms.map(rhythm => ({ ...rhythm, timeOfDay: 'evening' })),
      archivedRhythmIds: []
    });
  });

  it('imports only after validation and confirmation, and cancellation preserves current state', async () => {
    const user = userEvent.setup();
    const imported = sampleWithHistory();
    imported.goals[0]!.title = '<script>sample</script>';
    const onImport = vi.fn(() => null);
    const { container } = render(
      <PreviewDataControls
        data={createSamplePreviewData()}
        status={{ kind: 'saved' }}
        currentDate="2026-10-21"
        onImport={onImport}
        onReset={() => null}
        onRetrySave={() => {}}
        onReloadExternal={() => null}
        onReplaceExternal={() => null}
      />
    );
    const input = within(container).getByLabelText('Import preview backup') as HTMLInputElement;
    const file = new File([JSON.stringify(createPreviewEnvelope(imported))], 'sample.json', { type: 'application/json' });
    await user.upload(input, file);
    const dialog = await screen.findByRole('dialog', { name: 'Replace preview data?' });
    expect(within(dialog).getByText(/Cancel leaves the current preview unchanged/)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Download current preview backup' })).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onImport).not.toHaveBeenCalled();
    expect(screen.getByText('Preview data saved in this browser.')).toBeTruthy();
  });

  it('offers export before reset and preserves storage when the replacement is cancelled', async () => {
    const user = userEvent.setup();
    const original = JSON.stringify(createPreviewEnvelope(sampleWithHistory()));
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, original);
    const { createObjectURL } = setDownloadMocks();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await openPreviewSettings(user);
    await user.click(screen.getByRole('button', { name: 'Reset sample data' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reset sample data?' });
    await user.click(within(dialog).getByRole('button', { name: 'Download current preview backup' }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(original);
  });

  it('preserves corrupt storage, offers raw recovery, and resets only the preview key after confirmation', async () => {
    const user = userEvent.setup();
    const corruptRaw = '{"bad":';
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, corruptRaw);
    window.localStorage.setItem('tend-state', '{"live":"keep"}');
    const { createObjectURL } = setDownloadMocks();
    render(<App />);

    expect(await screen.findByText(/original value is preserved/)).toBeTruthy();
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(corruptRaw);
    await openPreviewSettings(user);
    await user.click(screen.getByRole('button', { name: 'Download raw recovery file' }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    const recoveryBlob = createObjectURL.mock.calls[0]![0] as Blob;
    expect(await recoveryBlob.text()).toBe(corruptRaw);

    await user.click(screen.getByRole('button', { name: 'Reset sample data' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reset sample data?' });
    await user.click(within(dialog).getByRole('button', { name: 'Reset sample data' }));
    expect(await screen.findByText('Preview data saved in this browser.')).toBeTruthy();
    expect(loadPreview(browserPreviewStorage(), '2026-10-21').kind).toBe('loaded');
    expect(window.localStorage.getItem('tend-state')).toBe('{"live":"keep"}');
  });

  it('keeps app state on an invalid backup and restores goal corrections and Today completion on remount', async () => {
    const user = userEvent.setup();
    const openFinances = () => user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Finances' }));
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(screen.getByRole('button', { name: 'Tend Pray together' }));
    const completionDialog = await screen.findByRole('dialog', { name: 'When did you tend it?' });
    await user.click(within(completionDialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tended Pray together' }).matches(':disabled')).toBe(true));
    await openFinances();
    const goal = screen.getByRole('article', { name: 'Starter reserve' });
    await user.click(within(goal).getAllByRole('button', { name: 'Correct' })[0]!);
    const correction = screen.getByRole('dialog', { name: 'Correct balance check-in' });
    const balance = within(correction).getByLabelText('Current balance');
    await user.clear(balance);
    await user.type(balance, '1350.00');
    await user.click(within(correction).getByRole('button', { name: 'Save correction' }));
    const beforeInvalidImport = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    await user.upload(
      screen.getByLabelText('Import preview backup'),
      new File(['{"format":"bad"}'], 'invalid.json', { type: 'application/json' })
    );
    expect(await screen.findByText(/format or schema version is not supported/)).toBeTruthy();
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(beforeInvalidImport);

    cleanup();
    render(<App />);
    expect(await screen.findByText('1 of 3 tended')).toBeTruthy();
    await openFinances();
    const restored = screen.getByRole('article', { name: 'Starter reserve' });
    expect(within(restored).getByText('$1,350.00')).toBeTruthy();
    expect(within(restored).getByText(/previous value \$1,250\.00/)).toBeTruthy();
    expect(within(restored).getByRole('heading', { name: 'Correction history' })).toBeTruthy();
  });

  it('preserves a backdated Tend state through backup export, import and reload', async () => {
    const user = userEvent.setup();
    const { createObjectURL } = setDownloadMocks();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');

    const card = screen.getByRole('article', { name: 'Take a walk' });
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);
    const effectiveDate = localDateString(pastDate);
    const dateLabel = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(new Date(`${effectiveDate}T12:00:00`));

    await user.click(within(card).getByRole('button', { name: 'Tend Take a walk' }));
    const completionDialog = screen.getByRole('dialog', { name: 'When did you tend it?' });
    fireEvent.change(within(completionDialog).getByLabelText('Date'), { target: { value: effectiveDate } });
    await user.click(within(completionDialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(within(card).getByRole('button', { name: 'Tend Take a walk' })).toBeTruthy();
      expect(within(card).getByText(dateLabel)).toBeTruthy();
    });

    await openPreviewSettings(user);
    await user.click(screen.getByRole('button', { name: 'Export preview backup' }));
    const exportedText = await (createObjectURL.mock.calls[0]![0] as Blob).text();
    await user.upload(
      screen.getByLabelText('Import preview backup'),
      new File([exportedText], 'backdated.json', { type: 'application/json' })
    );
    const importDialog = await screen.findByRole('dialog', { name: 'Replace preview data?' });
    await user.click(within(importDialog).getByRole('button', { name: 'Replace with backup' }));
    await user.click(screen.getByRole('button', { name: 'Today' }));
    const restoredCard = screen.getByRole('article', { name: 'Take a walk' });
    await waitFor(() => {
      expect(within(restoredCard).getByRole('button', { name: 'Tend Take a walk' })).toBeTruthy();
      expect(within(restoredCard).getByText(dateLabel)).toBeTruthy();
    });

    cleanup();
    render(<App />);
    const reloadedCard = await screen.findByRole('article', { name: 'Take a walk' });
    expect(within(reloadedCard).getByRole('button', { name: 'Tend Take a walk' })).toBeTruthy();
    expect(within(reloadedCard).getByText(dateLabel)).toBeTruthy();
  });

  it('creates, shares, edits from a linked profile, and reloads one stored person note in App', async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    window.localStorage.setItem(
      PREVIEW_STORAGE_KEY,
      JSON.stringify(createPreviewEnvelope(createSamplePreviewData()))
    );
    const openPerson = async (name: string) => {
      await user.click(within(screen.getByRole('navigation', { name: 'Tools and navigation' }))
        .getByRole('button', { name: 'People' }));
      await user.click(screen.getByRole('button', { name: `Open synthetic profile for ${name}` }));
      await user.click(screen.getByRole('tab', { name: 'Notes' }));
    };

    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await openPerson('Avery Brooks');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    const editor = screen.getByRole('dialog', { name: 'Add note for Avery Brooks' });
    await user.type(within(editor).getByRole('textbox', { name: 'Note' }), 'App integration first line{Enter}second line');
    await user.click(within(editor).getByRole('button', { name: 'Choose people' }));
    const picker = screen.getByRole('dialog', { name: 'Share note' });
    await user.click(within(picker).getByRole('button', { name: 'Morgan Reed' }));
    await user.click(within(picker).getByRole('button', { name: 'Done' }));
    await user.click(within(editor).getByRole('button', { name: 'Save note' }));

    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(PREVIEW_STORAGE_KEY) ?? '{}') as {
        data?: { personNotes?: Array<Record<string, unknown>> };
      };
      expect(saved.data?.personNotes).toHaveLength(1);
      expect(saved.data?.personNotes?.[0]).toMatchObject({
        personId: 'sample-person-avery',
        sharedWith: ['sample-person-morgan'],
        content: 'App integration first line\nsecond line'
      });
    });

    await user.click(screen.getByRole('button', { name: 'Close profile for Avery Brooks' }));
    await openPerson('Morgan Reed');
    await user.click(screen.getByRole('button', { name: /Open note updated/ }));
    const noteDetail = screen.getByRole('dialog', { name: 'Note' });
    expect(within(noteDetail).getByText(/Primary person: Avery Brooks/)).toBeTruthy();
    await user.click(within(noteDetail).getByRole('button', { name: 'Edit note' }));
    const edit = screen.getByRole('dialog', { name: 'Edit note' });
    await user.clear(within(edit).getByRole('textbox', { name: 'Note' }));
    await user.type(within(edit).getByRole('textbox', { name: 'Note' }), 'Edited from the shared profile');
    await user.click(within(edit).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(PREVIEW_STORAGE_KEY) ?? '{}') as {
        data?: { personNotes?: Array<Record<string, unknown>> };
      };
      expect(saved.data?.personNotes).toHaveLength(1);
      expect(saved.data?.personNotes?.[0]).toMatchObject({
        personId: 'sample-person-avery',
        sharedWith: ['sample-person-morgan'],
        content: 'Edited from the shared profile'
      });
    });

    cleanup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await openPerson('Avery Brooks');
    expect(screen.getByText('Notes (1)')).toBeTruthy();
    expect(screen.getByText('Edited from the shared profile')).toBeTruthy();
  });

  it('renders imported strings as text and persists the confirmed preview replacement', async () => {
    const user = userEvent.setup();
    const imported = sampleWithHistory();
    imported.goals[0]!.title = '<script>synthetic</script>';
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await openPreviewSettings(user);
    await user.upload(
      screen.getByLabelText('Import preview backup'),
      new File([JSON.stringify(createPreviewEnvelope(imported))], 'safe-data.json', { type: 'application/json' })
    );
    const dialog = await screen.findByRole('dialog', { name: 'Replace preview data?' });
    await user.click(within(dialog).getByRole('button', { name: 'Replace with backup' }));
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Finances' }));
    const importedGoal = screen.getByRole('article', { name: '<script>synthetic</script>' });
    expect(importedGoal.textContent).toContain('<script>synthetic</script>');
    expect(importedGoal.querySelector('script')).toBeNull();
    const saved = JSON.parse(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!) as {
      data: { goals: Array<{ title: string }> };
    };
    expect(saved.data.goals[0]!.title).toBe('<script>synthetic</script>');
  });

  it('requires an explicit decision for another tab and supports reload or replacement', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    const oldValue = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    const external = createSamplePreviewData();
    external.goals[0]!.title = 'Another tab reserve';
    const newValue = JSON.stringify(createPreviewEnvelope(external));
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, newValue);
    const storageEvent = new Event('storage');
    Object.defineProperties(storageEvent, {
      key: { value: PREVIEW_STORAGE_KEY },
      oldValue: { value: oldValue },
      newValue: { value: newValue }
    });
    window.dispatchEvent(storageEvent);
    await openPreviewSettings(user);
    expect(await screen.findByText(/changed in another tab/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Reload other tab’s preview' }));
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Finances' }));
    expect(await screen.findByRole('article', { name: 'Another tab reserve' })).toBeTruthy();
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(newValue);

    const laterExternal = createSamplePreviewData();
    laterExternal.goals[0]!.title = 'Third tab reserve';
    const laterValue = JSON.stringify(createPreviewEnvelope(laterExternal));
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, laterValue);
    const laterEvent = new Event('storage');
    Object.defineProperties(laterEvent, {
      key: { value: PREVIEW_STORAGE_KEY },
      oldValue: { value: newValue },
      newValue: { value: laterValue }
    });
    window.dispatchEvent(laterEvent);
    await openPreviewSettings(user);
    await screen.findByText(/changed in another tab/);
    await user.click(screen.getByRole('button', { name: 'Replace other tab’s data' }));
    const replaceDialog = await screen.findByRole('dialog', { name: 'Replace the other tab?' });
    expect(within(replaceDialog).getByRole('button', { name: 'Download current preview backup' })).toBeTruthy();
    await user.click(within(replaceDialog).getByRole('button', { name: 'Replace other tab' }));
    expect(JSON.parse(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!).data.goals[0].title)
      .toBe('Another tab reserve');
  });

  it('reports blocked storage and quota errors without claiming that data was saved', async () => {
    const user = userEvent.setup();
    vi.spyOn(MemoryStorage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage access denied'); });
    render(<App />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    await openPreviewSettings(user);
    expect(screen.getByText(/Browser storage is unavailable/)).toBeTruthy();
    expect(screen.queryByText('Preview data saved in this browser.')).toBeNull();
    cleanup();
    vi.restoreAllMocks();

    vi.spyOn(MemoryStorage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded'); });
    render(<App />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    await openPreviewSettings(user);
    expect(screen.getByText(/Preview data was not saved\. Quota exceeded/)).toBeTruthy();
    expect(screen.queryByText('Preview data saved in this browser.')).toBeNull();
  });
});
