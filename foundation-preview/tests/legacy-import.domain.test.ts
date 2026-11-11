import { describe, expect, it } from 'vitest';
import { analyzeLegacyTendImport } from '../src/domain/legacy-import.ts';
import { createPreviewEnvelope, parsePreviewBackup, validatePreviewEnvelope } from '../src/domain/preview-state.ts';
import { poundsToKilograms } from '../src/domain/weight.ts';
import { loadPreview, writePreview } from '../src/storage/preview-storage.ts';

describe('Classic Tend import dry run', () => {
  it('converts arbitrary People identities, details, and explicit classifications without sample injection', () => {
    const source = JSON.stringify({
      version: 2,
      people: [
        {
          id: 'legacy person/one',
          name: 'Taylor Example',
          relation: 'Custom relationship',
          area: 'marriage',
          birthday: '02-29',
          anniversary: '2021-04-15'
        },
        {
          id: 'legacy-person-two',
          name: 'Taylor Example',
          relation: 'Neighbor',
          area: 'parenting'
        },
        { id: 'legacy-person-three', name: 'Morgan Example', area: 'friendships' }
      ]
    });

    const result = analyzeLegacyTendImport(source, '2026-10-31');
    expect(result.candidate).not.toBeNull();
    expect(result.report.supported).toEqual(expect.objectContaining({
      people: 3, details: 2, classifications: 3
    }));
    expect(result.report.remappedIds).toBe(1);
    expect(result.report.invalid).toEqual([]);
    expect(result.report.ambiguous).toEqual([]);
    expect(result.candidate?.people.map(person => person.displayName))
      .toEqual(['Taylor Example', 'Taylor Example', 'Morgan Example']);
    expect(result.candidate?.people.map(person => person.id)).not.toContain('sample-person-avery');
    expect(result.candidate?.personDetails).toEqual([
      {
        personId: result.candidate?.people[0]?.id,
        relationshipLabel: 'Custom relationship',
        birthday: { monthDay: '02-29' },
        anniversary: { monthDay: '04-15', year: 2021 }
      },
      {
        personId: 'legacy-person-two',
        relationshipLabel: 'Neighbor'
      }
    ]);
    expect(result.candidate?.peopleGroups.map(group => [group.id, group.memberIds]))
      .toEqual([
        ['marriage', [result.candidate?.people[0]?.id]],
        ['parenting', ['legacy-person-two']],
        ['friends', ['legacy-person-three']]
      ]);
    expect(analyzeLegacyTendImport(source, '2026-10-31').candidate?.people[0]?.id)
      .toBe(result.candidate?.people[0]?.id);
  });

  it('keeps unsupported source sections in the recovery package and separates their report', () => {
    const source = JSON.stringify({
      people: [{
        id: 'person-one', name: 'Person One',
        rhythms: [{ id: 'rhythm-one', title: 'Unsupported schedule', freq: 'twicewk', tod: 'anytime' }]
      }],
      prayers: [{ id: 'prayer-one', personId: 'person-one', status: 'answered' }],
      events: [{ id: 'connection-one', personIds: ['person-one'] }],
      calendars: [{ id: 'calendar-one' }]
    });
    const result = analyzeLegacyTendImport(source, '2026-10-31');

    expect(result.candidate).not.toBeNull();
    expect(result.report.unsupported).toEqual(expect.arrayContaining([
      { path: '/people/0/rhythms/0/freq', count: 1 },
      { path: '/prayers', count: 1 },
      { path: '/events/0/type', count: 1 },
      { path: '/calendars', count: 1 }
    ]));
    const recovery = JSON.parse(result.recoveryPackage) as { sourceText: string };
    expect(recovery.sourceText).toBe(source);
  });

  it('blocks duplicate IDs and invalid dates rather than guessing or dropping records', () => {
    const duplicateIds = analyzeLegacyTendImport(JSON.stringify({
      people: [
        { id: 'duplicate', name: 'First' },
        { id: 'duplicate', name: 'Second' }
      ]
    }), '2026-10-31');
    expect(duplicateIds.candidate).toBeNull();
    expect(duplicateIds.report.ambiguous).toEqual([{ path: '/people/1', count: 1 }]);

    const invalidDate = analyzeLegacyTendImport(JSON.stringify({
      people: [{ id: 'person-one', name: 'Person One', birthday: '2023-02-29' }]
    }), '2026-10-31');
    expect(invalidDate.candidate).toBeNull();
    expect(invalidDate.report.invalid.length).toBeGreaterThan(0);
  });

  it('does not infer a birthday date from a standalone legacy year', () => {
    const source = JSON.stringify({
      people: [{ id: 'person-one', name: 'Person One', birthday: '1951' }]
    });
    const result = analyzeLegacyTendImport(source, '2026-10-31');

    expect(result.candidate).toBeNull();
    expect(result.report.invalid).toContainEqual({ path: '/people/0/birthday', count: 1 });
    expect(JSON.parse(result.recoveryPackage).sourceText).toBe(source);
  });

  it('uses a deterministic collision-safe ID when an invalid source ID maps onto an existing ID', () => {
    const mapped = analyzeLegacyTendImport(JSON.stringify({
      people: [{ id: 'legacy person/one', name: 'Mapped Person' }]
    }), '2026-10-31');
    const mappedId = mapped.candidate?.people[0]?.id;
    expect(mappedId).toBeTruthy();

    const collision = analyzeLegacyTendImport(JSON.stringify({
      people: [
        { id: 'legacy person/one', name: 'Mapped Person' },
        { id: mappedId, name: 'Existing Person' }
      ]
    }), '2026-10-31');
    expect(collision.candidate?.people.map(person => person.id)).toEqual([
      `${mappedId}-2`,
      mappedId
    ]);
  });

  it('rejects a missing People collection and malformed JSON without losing recovery text', () => {
    const missingPeople = analyzeLegacyTendImport('{"events":[]}', '2026-10-31');
    expect(missingPeople.candidate).toBeNull();
    expect(missingPeople.report.invalid).toEqual([{ path: '/people', count: 1 }]);

    const malformed = '{invalid';
    const malformedResult = analyzeLegacyTendImport(malformed, '2026-10-31');
    expect(malformedResult.candidate).toBeNull();
    expect(JSON.parse(malformedResult.recoveryPackage).sourceText).toBe(malformed);
  });

  it('converts linked records once with stable identities, explicit schedules, and exact measurements', () => {
    const source = JSON.stringify({
      people: [
        { id: 'person-one', name: 'Taylor', connectCadence: 'weekly', connectCadenceSetOn: '2026-01-02' },
        { id: 'person-two', name: 'Jordan' }
      ],
      rhythms: [
        {
          id: 'check-in', text: 'Call Jordan', freq: 'weekly', scheduleDows: [2],
          tod: 'morning', personIds: ['person-one', 'person-two'], areas: ['friendships']
        },
        {
          id: 'run-rhythm', text: 'Run', type: 'cardio', freq: 'weekly', scheduleDows: [3],
          tod: 'anytime', areas: ['health'], fitnessType: 'cardio'
        },
        { id: 'archived-rhythm', text: 'Archived practice', freq: 'daily', tod: 'all-day', archived: true }
      ],
      events: [
        {
          id: 'connection-one', type: 'call', date: '2026-10-10', time: '09:15',
          personIds: ['person-one', 'person-two'], note: 'Spoke together'
        },
        {
          id: 'completion-one', rhythmId: 'check-in', rhythmOccurrence: '2026-10-11',
          ts: Date.parse('2026-10-11T09:30:00Z'), completionNote: 'Caught up'
        },
        {
          id: 'fitness-run-event', rhythmId: 'run-rhythm', fitnessLogId: 'run-one',
          rhythmOccurrence: '2026-10-12', fitnessType: 'cardio',
          ts: Date.parse('2026-10-12T12:00:00Z')
        }
      ],
      personNotes: [{
        id: 'note-one', personId: 'person-one', sharedWith: ['person-two'],
        content: 'A plain-text note', createdAt: '2026-09-01T10:00:00.000Z',
        updatedAt: '2026-09-02T10:00:00.000Z'
      }],
      fitness: {
        settings: {
          weightUnit: 'lb', muscleIntervals: { chest: 2 }, preferredRestDays: { chest: 1 },
          weeklyRunTarget: 3, weeklyMileTarget: 12.5,
          startWeight: 160, startDate: '2026-01-01', targetWeight: 150,
          goalDate: '2027-01-01'
        },
        savedWorkouts: [{ id: 'template-one', name: 'Upper', muscleIds: ['chest'], sharedWith: ['person-two'] }],
        workouts: [{
          id: 'workout-one', date: '2026-10-09', muscleIds: ['chest'],
          savedWorkoutId: 'template-one', notes: 'Completed'
        }],
        runs: [{
          id: 'run-one', date: '2026-10-12', distance: 2.75, unit: 'mi',
          rhythmId: 'run-rhythm', rhythmOccurrence: '2026-10-12', fitnessType: 'cardio'
        }],
        weighIns: [{ id: 'weight-one', date: '2026-10-13', weight: 150.25, unit: 'lb' }]
      }
    });

    const result = analyzeLegacyTendImport(source, '2026-10-31');
    expect(result.candidate).not.toBeNull();
    expect(result.report.source).toEqual(expect.objectContaining({
      people: 2, rhythms: 3, events: 3, notes: 1, strengthTemplates: 1,
      strengthLogs: 1, cardioRuns: 1, weightMeasurements: 1
    }));
    expect(result.report.supported).toEqual(expect.objectContaining({
      rhythms: 3, rhythmCompletions: 2, connections: 1, cadences: 1, notes: 1,
      strengthTemplates: 1, strengthLogs: 1, cardioGoals: 1, cardioRuns: 1,
      weightGoals: 1, weightMeasurements: 1
    }));
    expect(result.report.invalid).toEqual([]);
    expect(result.report.ambiguous).toEqual([]);

    const candidate = result.candidate!;
    const rhythmId = candidate.savedRhythms.find(item => item.title === 'Run')!.id;
    expect(candidate.archivedRhythmIds).toContain(
      candidate.savedRhythms.find(item => item.title === 'Archived practice')!.id
    );
    const run = candidate.cardio.runs[0] as { rhythmId: string; rhythmOccurrence: string; completionId: string; distance: number };
    expect(run).toMatchObject({
      rhythmId,
      rhythmOccurrence: '2026-10-12',
      distance: 2.75
    });
    expect(candidate.datedRhythmCompletions).toHaveLength(2);
    expect(candidate.datedRhythmCompletions.filter(item => item.rhythmId === rhythmId)).toHaveLength(1);
    expect(candidate.friendships.connections).toHaveLength(1);
    expect(candidate.friendships.connections[0]?.participantIds).toEqual(['person-one', 'person-two']);
    expect(candidate.personNotes).toHaveLength(1);
    expect(candidate.personNotes[0]?.sharedWith).toEqual(['person-two']);
    expect(candidate.strength.savedWorkouts[0]?.sharedWith).toEqual(['person-two']);
    expect(candidate.strength.workouts[0]?.exercises).toBeUndefined();
    expect((candidate.weight.weighIns[0] as { weightKg: number } | undefined)?.weightKg)
      .toBe(poundsToKilograms(150.25));
    expect(candidate.people.some(person => person.id.startsWith('sample-person-'))).toBe(false);
    expect(validatePreviewEnvelope(createPreviewEnvelope(candidate), '2026-10-31').valid).toBe(true);

    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); }
    };
    expect(writePreview(storage, candidate, null, { currentDate: '2026-10-31' }).kind).toBe('saved');
    const reloaded = loadPreview(storage, '2026-10-31');
    expect(reloaded.kind).toBe('loaded');
    if (reloaded.kind === 'loaded') {
      expect(reloaded.data.people).toEqual(candidate.people);
      expect(reloaded.data.friendships).toEqual(candidate.friendships);
      expect(reloaded.data.personNotes).toEqual(candidate.personNotes);
      expect(reloaded.data.savedRhythms).toEqual(candidate.savedRhythms);
      expect(reloaded.data.datedRhythmCompletions).toEqual(candidate.datedRhythmCompletions);
      expect(reloaded.data.cardio.runs).toEqual(candidate.cardio.runs);
      expect(reloaded.data.weight.weighIns).toEqual(candidate.weight.weighIns);
      expect(JSON.parse(values.get('tend2:synthetic-preview')!).data).toEqual(reloaded.data);
    }
  });

  it('maps legacy Rhythm time IDs and reports a repeated embedded-owner reference', () => {
    const result = analyzeLegacyTendImport(JSON.stringify({
      people: [{
        id: 'person-one',
        name: 'Taylor',
        rhythms: [
          { id: 'early-rhythm', text: 'Early practice', freq: 'daily', tod: 'early', personId: 'person-one' },
          { id: 'all-day-rhythm', text: 'All-day practice', freq: 'daily', tod: 'allday' },
          { id: 'commute-rhythm', text: 'Way-home practice', freq: 'daily', tod: 'commute' }
        ]
      }]
    }), '2026-10-31');

    expect(result.candidate).not.toBeNull();
    expect(result.report.supported.rhythms).toBe(3);
    expect(result.report.ambiguous).toEqual([]);
    expect(result.report.unsupported).toEqual([
      { path: '/people/0/rhythms/0/personId', count: 1 }
    ]);
    expect(result.candidate?.savedRhythms.map(rhythm => [rhythm.title, rhythm.timeOfDay]))
      .toEqual([
        ['Early practice', 'early-morning'],
        ['All-day practice', 'all-day'],
        ['Way-home practice', 'way-home']
      ]);
    expect(result.candidate?.savedRhythms[0]?.personIds).toEqual(['person-one']);
  });

  it('maps documented recurrence defaults and uses only explicit custom schedule anchors', () => {
    const result = analyzeLegacyTendImport(JSON.stringify({
      people: [{ id: 'person-one', name: 'Taylor' }],
      rhythms: [
        { id: 'weekly', text: 'Weekly', freq: 'weekly', weekdays: [] },
        { id: 'selected-days', text: 'Selected days', freq: 'selectdays', weekdays: [] },
        { id: 'monthly', text: 'Monthly', freq: 'monthly', monthDay: null },
        { id: 'quarterly-date', text: 'Quarterly date', freq: 'quarterly', qmonth: 2, dayOfMonth: null },
        {
          id: 'quarterly-weekday', text: 'Quarterly weekday', freq: 'quarterly', qmonth: 3,
          monthlyMode: 'onThe', ord: null, ordWeekday: null
        },
        { id: 'yearly', text: 'Yearly', freq: 'yearly', month: null, monthDay: null },
        { id: 'custom-anchored', text: 'Custom anchored', freq: 'custom', unit: 'days', every: 2, added: '2026-01-05' },
        { id: 'custom-months', text: 'Custom months', freq: 'custom', unit: 'months', every: 2, start: '2026-01-06', dayOfMonth: null },
        { id: 'custom-years', text: 'Custom years', freq: 'custom', unit: 'years', every: 2, start: '2026-01-07', month: null, dayOfMonth: null },
        { id: 'biweekly', text: 'Biweekly', freq: 'biweekly', added: '2026-01-06' },
        { id: 'twice-weekly-legacy', text: 'Legacy twice weekly', freq: 'twicewk', added: '2026-01-07' },
        { id: 'custom-no-anchor', text: 'Custom without anchor', freq: 'custom', unit: 'days', every: 2 }
      ]
    }), '2026-10-31');

    expect(result.candidate).not.toBeNull();
    const rhythms = new Map(result.candidate?.savedRhythms.map(rhythm => [rhythm.title, rhythm]));
    expect(rhythms.get('Weekly')?.schedule).toEqual({ frequency: 'weekly', weekdays: [1] });
    expect(rhythms.get('Selected days')?.schedule).toEqual({ frequency: 'weekly', weekdays: [1] });
    expect(rhythms.get('Monthly')?.schedule).toEqual({
      frequency: 'monthly', pattern: { kind: 'dayOfMonth', day: 1 }
    });
    expect(rhythms.get('Quarterly date')?.schedule).toEqual({
      frequency: 'quarterly', monthInQuarter: 2, pattern: { kind: 'dayOfMonth', day: 1 }
    });
    expect(rhythms.get('Quarterly weekday')?.schedule).toEqual({
      frequency: 'quarterly', monthInQuarter: 3,
      pattern: { kind: 'ordinalWeekday', ordinal: 1, weekday: 0 }
    });
    expect(rhythms.get('Yearly')?.schedule).toEqual({
      frequency: 'yearly', month: 1, pattern: { kind: 'dayOfMonth', day: 1 }
    });
    expect(rhythms.get('Custom anchored')?.schedule).toEqual({
      frequency: 'custom', unit: 'days', interval: 2, startDate: '2026-01-05'
    });
    expect(rhythms.get('Custom months')?.schedule).toEqual({
      frequency: 'custom', unit: 'months', interval: 2,
      pattern: { kind: 'dayOfMonth', day: 1 }, startDate: '2026-01-06'
    });
    expect(rhythms.get('Custom years')?.schedule).toEqual({
      frequency: 'custom', unit: 'years', interval: 2, month: 1,
      pattern: { kind: 'dayOfMonth', day: 1 }, startDate: '2026-01-07'
    });
    expect(rhythms.get('Biweekly')?.schedule).toEqual({
      frequency: 'custom', unit: 'weeks', interval: 2, weekdays: [0], startDate: '2026-01-06'
    });
    expect(rhythms.get('Legacy twice weekly')?.schedule).toEqual({
      frequency: 'custom', unit: 'days', interval: 3, startDate: '2026-01-07'
    });
    expect(rhythms.get('Custom without anchor')?.schedule).toBeUndefined();
    expect(result.report.unsupported).toContainEqual({ path: '/rhythms/11/freq', count: 1 });
  });

  it('treats null Rhythm links as absent and distinguishes unresolved from unconverted links', () => {
    const result = analyzeLegacyTendImport(JSON.stringify({
      people: [{ id: 'person-one', name: 'Taylor' }],
      rhythms: [{ id: 'paused-rhythm', text: 'Paused practice', freq: 'daily', paused: true }],
      events: [
        { id: 'unlinked-prayer', type: 'prayer', rhythmId: null },
        { id: 'missing-rhythm-event', rhythmId: 'missing-rhythm' },
        { id: 'paused-rhythm-event', rhythmId: 'paused-rhythm' }
      ]
    }), '2026-10-31');

    expect(result.candidate).toBeNull();
    expect(result.report.ambiguous).toEqual([
      { path: '/events/1/rhythmId', count: 1 }
    ]);
    expect(result.report.unsupported).toEqual(expect.arrayContaining([
      { path: '/events/0/type', count: 1 },
      { path: '/events/2/rhythmId', count: 1 },
      { path: '/rhythms/0/paused', count: 1 }
    ]));
  });

  it('excludes independent orphaned historical events while converting unrelated valid records', () => {
    const source = JSON.stringify({
      people: [{ id: 'person-one', name: 'Taylor' }],
      rhythms: [{ id: 'rhythm-one', text: 'Check in', freq: 'weekly', tod: 'anytime' }],
      events: [
        {
          id: 'valid-completion', rhythmId: 'rhythm-one', date: '2026-10-10',
          ts: Date.parse('2026-10-10T12:00:00Z')
        },
        {
          id: 'orphan-prayer', type: 'prayer', kind: 'prayer', personId: 'person-one',
          rhythmId: 'missing-rhythm-one', ts: Date.parse('2026-10-11T12:00:00Z'),
          note: 'Retained only in the recovery package'
        },
        {
          id: 'orphan-quality', type: 'quality', kind: 'quality', personId: 'person-one',
          rhythmId: 'missing-rhythm-two', ts: Date.parse('2026-10-12T12:00:00Z')
        }
      ]
    });

    const result = analyzeLegacyTendImport(source, '2026-10-31');
    expect(result.candidate).not.toBeNull();
    expect(result.report.ambiguous).toEqual([]);
    expect(result.report.invalid).toEqual([]);
    expect(result.report.supported).toEqual(expect.objectContaining({
      people: 1, rhythms: 1, rhythmCompletions: 1
    }));
    expect(result.report.excluded).toEqual([
      expect.objectContaining({
        path: '/events/1', sourceId: 'orphan-prayer', sourceRhythmId: 'missing-rhythm-one'
      }),
      expect.objectContaining({
        path: '/events/2', sourceId: 'orphan-quality', sourceRhythmId: 'missing-rhythm-two'
      })
    ]);
    expect(result.candidate?.datedRhythmCompletions.map(item => item.id))
      .toEqual(['legacy-completion-valid-completion']);
    expect(result.candidate?.datedRhythmCompletions[0]?.rhythmId)
      .toBe(result.candidate?.savedRhythms[0]?.id);

    const recovery = JSON.parse(result.recoveryPackage) as {
      sourceText: string;
      excludedRecords: { path: string; sourceRecord: Record<string, unknown> }[];
    };
    expect(recovery.sourceText).toBe(source);
    expect(recovery.excludedRecords).toEqual([
      { path: '/events/1', sourceRecord: JSON.parse(source).events[1] },
      { path: '/events/2', sourceRecord: JSON.parse(source).events[2] }
    ]);
    expect(JSON.stringify(recovery.excludedRecords)).toContain('Retained only in the recovery package');
    expect(validatePreviewEnvelope(createPreviewEnvelope(result.candidate!), '2026-10-31').valid).toBe(true);

    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); }
    };
    expect(writePreview(storage, result.candidate!, null, { currentDate: '2026-10-31' }).kind)
      .toBe('saved');
    const reloaded = loadPreview(storage, '2026-10-31');
    expect(reloaded.kind).toBe('loaded');
    if (reloaded.kind === 'loaded') {
      const exported = JSON.stringify(createPreviewEnvelope(reloaded.data));
      const reparsed = parsePreviewBackup(exported, '2026-10-31');
      expect(reparsed.valid).toBe(true);
      if (reparsed.valid) expect(reparsed.envelope.data).toEqual(reloaded.data);
      expect(reloaded.data.datedRhythmCompletions).toEqual(result.candidate?.datedRhythmCompletions);
    }
  });

  it('does not exclude orphan events that are linked to Fitness records', () => {
    const result = analyzeLegacyTendImport(JSON.stringify({
      people: [{ id: 'person-one', name: 'Taylor' }],
      events: [{
        id: 'workout-one', type: 'quality', kind: 'quality', rhythmId: 'missing-rhythm',
        ts: Date.parse('2026-10-10T12:00:00Z')
      }],
      fitness: {
        workouts: [{
          id: 'workout-one', date: '2026-10-10', muscleIds: ['chest'],
          rhythmId: 'missing-rhythm', rhythmOccurrence: '2026-10-10', fitnessType: 'workout'
        }]
      }
    }), '2026-10-31');

    expect(result.candidate).toBeNull();
    expect(result.report.excluded).toEqual([]);
    expect(result.report.ambiguous.length).toBeGreaterThan(0);
  });

  it('reports unresolved, duplicate, timestamp-only, and unsupported records without approximation', () => {
    const result = analyzeLegacyTendImport(JSON.stringify({
      people: [{ id: 'person-one', name: 'Taylor' }],
      rhythms: [{ id: 'rhythm-one', text: 'Check in', freq: 'weekly', scheduleDow: 1, tod: 'anytime' }],
      events: [
        { id: 'timestamp-only', rhythmId: 'rhythm-one', ts: Date.parse('2026-10-10T12:00:00Z') },
        { id: 'unknown-connection', type: 'quality', personId: 'person-one', date: '2026-10-10' },
        { id: 'unresolved-connection', type: 'call', personId: 'missing-person', date: '2026-10-10' },
        { id: 'malformed-time', type: 'call', personId: 'person-one', date: '2026-10-10', time: '9 AM' },
        { id: 'extra-connection-field', type: 'call', personId: 'person-one', date: '2026-10-10', legacyTag: 'retained' },
        {
          id: 'conflicting-completion-date', rhythmId: 'rhythm-one', date: '2026-10-09',
          rhythmOccurrence: '2026-10-10', ts: Date.parse('2026-10-10T12:00:00Z')
        },
        { id: 'unsupported-coffee', type: 'coffee', personId: 'person-one', date: '2026-10-10' }
      ],
      personNotes: [{
        id: 'follow-up-one', personId: 'person-one', type: 'followup',
        content: 'Do not flatten', createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-01T10:00:00.000Z'
      }],
      followups: [{ id: 'task-one', personId: 'person-one' }],
      fitness: {
        weighIns: [{ id: 'missing-unit', date: '2026-10-10', weight: 150 }],
        runs: [{ id: 'unsupported-unit', date: '2026-10-10', distance: 5, unit: 'km' }]
      }
    }), '2026-10-31');
    expect(result.candidate).toBeNull();
    expect(result.report.supported.notes).toBe(0);
    expect(result.report.unsupported).toEqual(expect.arrayContaining([
      { path: '/events/0/ts', count: 1 },
      { path: '/events/1/type', count: 1 },
      { path: '/events/6/type', count: 1 },
      { path: '/events/4/legacyTag', count: 1 },
      { path: '/personNotes/0/type', count: 1 },
      { path: '/followups', count: 1 },
      { path: '/fitness/weighIns/0/unit', count: 1 },
      { path: '/fitness/runs/0/unit', count: 1 }
    ]));
    expect(result.report.ambiguous).toEqual(expect.arrayContaining([
      { path: '/events/2/personIds', count: 1 }
    ]));
    expect(result.report.ambiguous).toContainEqual({ path: '/events/5/date', count: 1 });
    expect(result.report.invalid).toContainEqual({ path: '/events/3/time', count: 1 });
  });
});
