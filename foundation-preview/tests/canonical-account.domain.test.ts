import { describe, expect, it, vi } from 'vitest';
import {
  CANONICAL_PREVIEW_ENVELOPE_KEY,
  createCanonicalAccountApi,
  convertClassicStateToPreviewEnvelope,
  mergePrayerRequestsIntoClassicState
} from '../src/storage/canonical-account.ts';
import type { CanonicalAccountSupabaseClient } from '../src/storage/canonical-account.ts';
import {
  createPreviewEnvelope,
  createEmptyPreviewData,
  PREVIEW_SCHEMA_VERSION
} from '../src/domain/preview-state.ts';
import type { PreviewEnvelope } from '../src/domain/preview-state.ts';
import { selectPersonPrayerHealth } from '../src/domain/person-prayer-health.ts';
import {
  deletePersonPrayerLog,
  savePersonPrayerLog,
  undoDeletePersonPrayerLog
} from '../src/domain/person-prayers.ts';
import type { PersonPrayerRequest } from '../src/domain/person-prayers.ts';

function clientFor(state: Record<string, unknown>, saveResult: unknown = { revision: 2, updated_at: '2026-11-24T12:00:00Z' }) {
  const rpc = vi.fn(async (_functionName: string, _params: Record<string, unknown>) => ({
    data: [saveResult],
    error: null
  }));
  const from = vi.fn(() => ({
    select: vi.fn(() => ({
      maybeSingle: vi.fn(async () => ({
        data: {
          state,
          schema_version: 1,
          revision: 1,
          updated_at: '2026-11-24T12:00:00Z'
        },
        error: null
      }))
    }))
  }));
  return {
    client: { from, rpc } satisfies CanonicalAccountSupabaseClient,
    from,
    rpc
  };
}

describe('canonical authenticated account adapter', () => {
  it('converts a Classic person prayer and eligible history into the canonical React request model', async () => {
    const { client } = clientFor({
      people: [{ id: 'avery', name: 'Avery' }],
      prayers: [{
        id: 'prayer-1',
        personId: 'avery',
        text: 'Pray with Avery',
        added: '2026-11-20',
        freq: 'daily',
        tod: 'morning',
        prayerLogs: [Date.parse('2026-11-22T12:00:00Z'), Date.parse('2026-11-24T12:00:00Z')]
      }]
    });
    const api = createCanonicalAccountApi(client);
    const record = await api.read();
    expect(record).not.toBeNull();
    expect(record?.schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
    expect(record?.document).toMatchObject({
      format: 'tend.synthetic-preview',
      schemaVersion: PREVIEW_SCHEMA_VERSION,
      data: {
        people: [{ id: 'avery', displayName: 'Avery' }],
        prayerRequests: [{
          id: 'prayer-1',
          personId: 'avery',
          title: 'Pray with Avery',
          status: 'active',
          schedule: { frequency: 'daily' },
          timeOfDay: 'morning',
          prayerLogs: [
            { prayedAt: '2026-11-22T12:00:00.000Z' },
            { prayedAt: '2026-11-24T12:00:00.000Z' }
          ]
        }]
      }
    });
  });

  it('rejects unsupported canonical state schemas without attempting a save', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({
          data: {
            state: { people: [], prayers: [] },
            schema_version: 2,
            revision: 1,
            updated_at: '2026-11-24T12:00:00.000Z'
          },
          error: null
        }))
      }))
    }));
    const api = createCanonicalAccountApi({
      from,
      rpc
    } satisfies CanonicalAccountSupabaseClient);

    await expect(api.read()).rejects.toThrow('canonical Tend account schema is not supported');
    await expect(api.save(createPreviewEnvelope(createEmptyPreviewData()), 1))
      .rejects.toMatchObject({ kind: 'unsupported' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('surfaces an unresolved canonical Prayer owner instead of silently omitting the request', () => {
    expect(() => convertClassicStateToPreviewEnvelope({
      people: [{ id: 'avery', name: 'Avery' }],
      prayers: [{
        id: 'orphan-prayer',
        personId: 'missing-person',
        text: 'Unresolved Prayer',
        added: '2026-11-20',
        prayerLogs: []
      }]
    })).toThrow('references a Person missing');
  });

  it('preserves unscheduled requests as unset and does not invent a frequency', async () => {
    const { client } = clientFor({
      people: [{ id: 'avery', name: 'Avery' }],
      prayers: [{
        id: 'prayer-legacy',
        personId: 'avery',
        text: 'Legacy request',
        added: '2026-11-20',
        prayerLogs: [Date.parse('2026-11-24T12:00:00Z')]
      }]
    });
    const record = await createCanonicalAccountApi(client).read();
    const envelope = record?.document as PreviewEnvelope | undefined;
    const request = envelope?.data.prayerRequests[0];
    expect(request?.schedule).toBeUndefined();
    expect(request?.timeOfDay).toBeUndefined();
  });

  it('merges schedule edits through tend_save_user_state and preserves unrelated state', async () => {
    const state = {
      people: [{ id: 'avery', name: 'Avery' }],
      prayers: [],
      tasks: [{ id: 'keep-me', text: 'Unrelated' }]
    };
    const { client, rpc } = clientFor(state);
    const api = createCanonicalAccountApi(client);
    const data = createEmptyPreviewData();
    data.people = [{ id: 'avery', displayName: 'Avery' }];
    data.prayerRequests = [{
      id: 'prayer-new',
      personId: 'avery',
      title: 'Daily prayer',
      status: 'active',
      schedule: { frequency: 'weekly', weekdays: [1], weeklyMode: 'select-days', endDate: '2026-12-31' },
      timeOfDay: 'evening',
      scoring: {
        trackingStartDate: '2026-11-24',
        timeZone: 'UTC',
        scheduleHistory: [{
          kind: 'scheduled',
          id: 'season:prayer-new:2026-11-24',
          startDate: '2026-11-24',
          schedule: {
            frequency: 'weekly',
            weekdays: [1],
            weeklyMode: 'select-days',
            endDate: '2026-12-31'
          },
          timeOfDay: 'evening',
          paletteToken: 'fern'
        }]
      },
      createdAt: '2026-11-24T12:00:00.000Z',
      updatedAt: '2026-11-24T12:00:00.000Z',
      prayerLogs: []
    }];
    const revision = await api.save(createPreviewEnvelope(data), 1);
    expect(revision).toBe(2);
    expect(rpc).toHaveBeenCalledWith('tend_save_user_state', expect.objectContaining({
      p_expected_revision: 1,
      p_schema_version: 1
    }));
    const params = rpc.mock.calls[0]?.[1];
    expect(params?.p_state).toMatchObject({
      tasks: [{ id: 'keep-me', text: 'Unrelated' }],
      prayers: [{
        id: 'prayer-new',
        personId: 'avery',
        text: 'Daily prayer',
        freq: 'selectdays',
        weekdays: [1],
        tod: 'evening',
        until: '2026-12-31'
      }]
    });
    const savedState = rpc.mock.calls[0]?.[1].p_state as Record<string, unknown>;
    expect(convertClassicStateToPreviewEnvelope(savedState).data.prayerRequests[0]?.scoring)
      .toEqual(data.prayerRequests[0]?.scoring);
  });

  it('preserves a Preview-created Prayer owner through canonical log and frequency saves', async () => {
    const existingPeople = [
      { id: 'avery', name: 'Avery', existingField: { keep: true } },
      { id: 'morgan', name: 'Morgan' }
    ];
    let revision = 1;
    let canonicalState: Record<string, unknown> = {
      people: structuredClone(existingPeople),
      prayers: [],
      tasks: [{ id: 'keep-task', title: 'Unrelated' }]
    };
    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({
          data: {
            state: canonicalState,
            schema_version: 1,
            revision,
            updated_at: '2026-11-24T12:00:00.000Z'
          },
          error: null
        }))
      }))
    }));
    const rpc = vi.fn(async (_functionName: string, parameters: Record<string, unknown>) => {
      if (parameters.p_expected_revision !== revision) {
        return { data: null, error: { code: '40001', message: 'Stale revision' } };
      }
      canonicalState = parameters.p_state as Record<string, unknown>;
      revision += 1;
      return {
        data: [{ revision, updated_at: `2026-11-24T12:0${revision}:00.000Z` }],
        error: null
      };
    });
    const api = createCanonicalAccountApi({
      from,
      rpc
    } satisfies CanonicalAccountSupabaseClient);
    const data = createEmptyPreviewData();
    data.people = [
      { id: 'avery', displayName: 'Avery' },
      { id: 'morgan', displayName: 'Morgan' },
      { id: 'beta-test', displayName: 'Beta Test' }
    ];
    const request: PersonPrayerRequest = {
      id: 'test-prayer',
      personId: 'beta-test',
      title: 'Test Prayer',
      status: 'active',
      schedule: { frequency: 'daily' },
      timeOfDay: 'anytime',
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      prayerLogs: []
    };

    await expect(api.save(createPreviewEnvelope(data), 1)).resolves.toBe(2);
    expect(canonicalState.people).toEqual(existingPeople);
    expect(canonicalState.tasks).toEqual([{ id: 'keep-task', title: 'Unrelated' }]);
    expect((canonicalState[CANONICAL_PREVIEW_ENVELOPE_KEY] as PreviewEnvelope).data.people)
      .toContainEqual({ id: 'beta-test', displayName: 'Beta Test' });

    const prayerCreated = createPreviewEnvelope({
      ...data,
      prayerRequests: [request]
    });
    await expect(api.save(prayerCreated, 2)).resolves.toBe(3);
    expect((canonicalState.prayers as unknown[])).toHaveLength(1);
    expect(canonicalState.people).toEqual(existingPeople);

    const afterCreate = await api.read();
    expect(afterCreate).not.toBeNull();
    const createdEnvelope = afterCreate!.document as PreviewEnvelope;
    expect(createdEnvelope.data.people).toContainEqual({ id: 'beta-test', displayName: 'Beta Test' });
    expect(createdEnvelope.data.prayerRequests).toMatchObject([{
      id: 'test-prayer',
      personId: 'beta-test',
      schedule: { frequency: 'daily' },
      prayerLogs: []
    }]);

    const logResult = savePersonPrayerLog(
      createdEnvelope.data.prayerRequests,
      'test-prayer',
      request.updatedAt,
      'beta-test',
      {
        id: 'test-prayer-log',
        prayedAt: '2026-11-21T12:00:00.000Z',
        notes: 'Synthetic fixture only'
      },
      '2026-11-24T12:01:00.000Z',
      createdEnvelope.data.people.map(person => person.id)
    );
    expect(logResult.valid).toBe(true);
    if (!logResult.valid) return;
    await expect(api.save(createPreviewEnvelope({
      ...createdEnvelope.data,
      prayerRequests: logResult.requests
    }), afterCreate!.revision)).resolves.toBe(4);
    expect((canonicalState.prayers as unknown[])).toHaveLength(1);

    const afterLog = await api.read();
    expect(afterLog).not.toBeNull();
    const loggedEnvelope = afterLog!.document as PreviewEnvelope;
    expect(loggedEnvelope.data.prayerRequests[0]?.prayerLogs).toEqual([{
      id: 'test-prayer-log',
      prayedAt: '2026-11-21T12:00:00.000Z',
      notes: 'Synthetic fixture only'
    }]);

    const frequencyEdit = createPreviewEnvelope({
      ...loggedEnvelope.data,
      prayerRequests: loggedEnvelope.data.prayerRequests.map(request => ({
        ...request,
        schedule: { frequency: 'weekly', weekdays: [2] },
        updatedAt: '2026-11-24T12:02:00.000Z'
      }))
    });
    await expect(api.save(frequencyEdit, afterLog!.revision)).resolves.toBe(5);
    expect(canonicalState.people).toEqual(existingPeople);
    expect(canonicalState.tasks).toEqual([{ id: 'keep-task', title: 'Unrelated' }]);
    expect((canonicalState.prayers as unknown[])).toHaveLength(1);
    expect((canonicalState.prayers as Array<Record<string, unknown>>)[0]).toMatchObject({
      id: 'test-prayer',
      personId: 'beta-test',
      freq: 'weekly',
      weekdays: [2],
      prayerLogs: [Date.parse('2026-11-21T12:00:00.000Z')]
    });

    const afterFrequencyEdit = await api.read();
    expect(afterFrequencyEdit).not.toBeNull();
    const reloaded = afterFrequencyEdit!.document as PreviewEnvelope;
    expect(reloaded.data.people).toContainEqual({ id: 'beta-test', displayName: 'Beta Test' });
    expect(reloaded.data.prayerRequests).toMatchObject([{
      id: 'test-prayer',
      personId: 'beta-test',
      schedule: { frequency: 'weekly', weekdays: [2] },
      prayerLogs: [{
        id: 'test-prayer-log',
        prayedAt: '2026-11-21T12:00:00.000Z',
        notes: 'Synthetic fixture only'
      }]
    }]);
  });

  it('round-trips Prayer log identity, notes, date precision, deletion, and Undo in the canonical document', () => {
    const classic = {
      people: [{ id: 'avery', name: 'Avery' }],
      prayers: [{
        id: 'prayer-round-trip',
        personId: 'avery',
        text: 'Keep this request',
        added: '2026-11-20',
        prayerLogs: [Date.parse('2026-11-22T12:34:56.789Z')],
        unrelatedPrayerField: { keep: true }
      }],
      unrelatedDomain: [{ id: 'preserve' }]
    };
    const first = convertClassicStateToPreviewEnvelope(classic);
    const originalLog = first.data.prayerRequests[0]?.prayerLogs[0];
    expect(originalLog).toMatchObject({
      id: 'prayer-round-trip-log-0',
      prayedAt: '2026-11-22T12:34:56.789Z'
    });
    const withNotes = createPreviewEnvelope({
      ...first.data,
      prayerRequests: first.data.prayerRequests.map(request => ({
        ...request,
        prayerLogs: [{ ...request.prayerLogs[0]!, notes: 'A saved private note.' }]
      }))
    });
    const notesRoundTrip = mergePrayerRequestsIntoClassicState(classic, withNotes);
    expect(notesRoundTrip.prayers).toMatchObject([{
      prayerLogs: [Date.parse('2026-11-22T12:34:56.789Z')],
      unrelatedPrayerField: { keep: true }
    }]);
    expect(convertClassicStateToPreviewEnvelope(notesRoundTrip).data.prayerRequests[0]?.prayerLogs)
      .toEqual([{ ...originalLog!, notes: 'A saved private note.' }]);

    const editedLog = createPreviewEnvelope({
      ...withNotes.data,
      prayerRequests: withNotes.data.prayerRequests.map(request => ({
        ...request,
        prayerLogs: [{
          ...request.prayerLogs[0]!,
          prayedAt: '2026-11-21T11:22:33.444Z',
          notes: 'Edited without changing identity.'
        }]
      }))
    });
    const editedState = mergePrayerRequestsIntoClassicState(notesRoundTrip, editedLog);
    expect(editedState.prayers).toMatchObject([{
      prayerLogs: [Date.parse('2026-11-21T11:22:33.444Z')]
    }]);
    expect(convertClassicStateToPreviewEnvelope(editedState).data.prayerRequests[0]?.prayerLogs)
      .toEqual([{
        id: originalLog!.id,
        prayedAt: '2026-11-21T11:22:33.444Z',
        notes: 'Edited without changing identity.'
      }]);

    const deleted = createPreviewEnvelope({
      ...editedLog.data,
      prayerRequests: editedLog.data.prayerRequests.map(request => ({ ...request, prayerLogs: [] }))
    });
    const deletedState = mergePrayerRequestsIntoClassicState(editedState, deleted);
    expect(convertClassicStateToPreviewEnvelope(deletedState).data.prayerRequests[0]?.prayerLogs).toEqual([]);
    expect(deletedState.unrelatedDomain).toEqual(classic.unrelatedDomain);

    const restored = createPreviewEnvelope({
      ...deleted.data,
      prayerRequests: deleted.data.prayerRequests.map(request => ({
        ...request,
        prayerLogs: [{
          id: originalLog!.id,
          prayedAt: '2026-11-21T11:22:33.444Z',
          notes: 'Edited without changing identity.'
        }]
      }))
    });
    const restoredState = mergePrayerRequestsIntoClassicState(deletedState, restored);
    expect(convertClassicStateToPreviewEnvelope(restoredState).data.prayerRequests[0]?.prayerLogs)
      .toEqual(restored.data.prayerRequests[0]?.prayerLogs);
    expect(restoredState.prayers).toMatchObject([{
      unrelatedPrayerField: { keep: true },
      prayerLogs: [Date.parse('2026-11-21T11:22:33.444Z')]
    }]);
  });

  it('saves Prayer log edits and Undo through the revision-checked canonical writer, preserving stale-write safety', async () => {
    let revision = 4;
    let canonicalState: Record<string, unknown> = {
      people: [{ id: 'avery', name: 'Avery' }],
      prayers: [{
        id: 'prayer-authenticated-fixture',
        personId: 'avery',
        text: 'Preserve this canonical request',
        added: '2026-11-01',
        updatedAt: '2026-11-24T12:00:00.000Z',
        freq: 'daily',
        prayerLogs: [Date.parse('2026-11-22T12:34:56.789Z')]
      }],
      rhythms: [{ id: 'unrelated-rhythm', unknown: { retain: true } }],
      unknownSupportedField: { retain: ['untouched'] }
    };
    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({
          data: {
            state: canonicalState,
            schema_version: 1,
            revision,
            updated_at: '2026-11-24T12:00:00.000Z'
          },
          error: null
        }))
      }))
    }));
    const rpc = vi.fn(async (_functionName: string, params: Record<string, unknown>) => {
      if (params.p_expected_revision !== revision) {
        return { data: null, error: { code: '40001', message: 'Stale revision' } };
      }
      canonicalState = params.p_state as Record<string, unknown>;
      revision += 1;
      return {
        data: [{ revision, updated_at: '2026-11-24T13:00:00.000Z' }],
        error: null
      };
    });
    const api = createCanonicalAccountApi({
      from,
      rpc
    } satisfies CanonicalAccountSupabaseClient);

    const first = await api.read();
    expect(first).not.toBeNull();
    const envelope = first!.document as PreviewEnvelope;
    const request = envelope.data.prayerRequests[0]!;
    const personId = request.personId;
    const personIds = envelope.data.people.map(person => person.id);
    const edit = savePersonPrayerLog(
      [request],
      request.id,
      request.updatedAt,
      personId,
      {
        id: request.prayerLogs[0]!.id,
        prayedAt: '2026-11-23T11:22:33.789Z',
        notes: 'Canonical log note'
      },
      '2026-11-24T12:01:00.000Z',
      personIds
    );
    expect(edit.valid).toBe(true);
    if (!edit.valid) return;
    const editedEnvelope = createPreviewEnvelope({
      ...envelope.data,
      prayerRequests: edit.requests
    });
    await api.save(editedEnvelope, first!.revision);

    const staleSnapshotSave = api.save(envelope, first!.revision);
    await expect(staleSnapshotSave).rejects.toThrow('changed before this save');
    expect((canonicalState.prayers as Array<Record<string, unknown>>)[0]?.prayerLogs)
      .toEqual([Date.parse('2026-11-23T11:22:33.789Z')]);

    const afterEdit = await api.read();
    expect(afterEdit?.document).toMatchObject({
      data: {
        prayerRequests: [{
          id: request.id,
          prayerLogs: [{
            id: request.prayerLogs[0]!.id,
            prayedAt: '2026-11-23T11:22:33.789Z',
            notes: 'Canonical log note'
          }]
        }]
      }
    });
    const afterEditEnvelope = afterEdit!.document as PreviewEnvelope;
    const editedRequest = afterEditEnvelope.data.prayerRequests[0]!;
    const deletion = deletePersonPrayerLog(
      [editedRequest],
      editedRequest.id,
      editedRequest.updatedAt,
      personId,
      editedRequest.prayerLogs[0]!.id,
      '2026-11-24T12:02:00.000Z',
      personIds
    );
    expect(deletion.valid).toBe(true);
    if (!deletion.valid || !deletion.undo) return;
    await api.save(createPreviewEnvelope({
      ...afterEditEnvelope.data,
      prayerRequests: deletion.requests
    }), afterEdit!.revision);
    const afterDelete = await api.read();
    expect((afterDelete!.document as PreviewEnvelope).data.prayerRequests[0]?.prayerLogs).toEqual([]);

    const restore = undoDeletePersonPrayerLog(
      deletion.requests,
      deletion.undo,
      personId,
      '2026-11-24T12:03:00.000Z',
      personIds
    );
    expect(restore.valid).toBe(true);
    if (!restore.valid) return;
    await api.save(createPreviewEnvelope({
      ...afterEditEnvelope.data,
      prayerRequests: restore.requests
    }), afterDelete!.revision);
    const afterUndo = await api.read();
    expect((afterUndo!.document as PreviewEnvelope).data.prayerRequests[0]?.prayerLogs)
      .toEqual([{
        id: request.prayerLogs[0]!.id,
        prayedAt: '2026-11-23T11:22:33.789Z',
        notes: 'Canonical log note'
      }]);
    expect(canonicalState.rhythms).toEqual([{ id: 'unrelated-rhythm', unknown: { retain: true } }]);
    expect(canonicalState.unknownSupportedField).toEqual({ retain: ['untouched'] });
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it('rejects stale-save responses without treating them as account success', async () => {
    const state = { people: [], prayers: [] };
    const rpc = vi.fn(async (_functionName: string, _params: Record<string, unknown>) => ({
      data: null,
      error: { code: '40001', message: 'Stale revision' }
    }));
    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({
          data: { state, schema_version: 1, revision: 1, updated_at: null },
          error: null
        }))
      }))
    }));
    const api = createCanonicalAccountApi({ from, rpc } satisfies CanonicalAccountSupabaseClient);
    await expect(api.save(createPreviewEnvelope(createEmptyPreviewData()), 1))
      .rejects.toThrow('changed before this save');
  });

  it('preserves unrelated canonical fields and unknown Prayer fields across merge and conversion', () => {
    const classic = {
      people: [{ id: 'avery', name: 'Avery', privateProfileField: 'keep-me' }],
      rhythms: [{ id: 'rhythm-1', title: 'Call', unknownRhythmField: { nested: true } }],
      datedRhythmCompletions: [{ rhythmId: 'rhythm-1', date: '2026-11-24', precision: 'minute' }],
      connections: [{ id: 'connection-1', personId: 'avery', unknown: 'preserve' }],
      sparks: [{ id: 'spark-1', owner: 'avery', unknown: 123 }],
      personNotes: [{ id: 'note-1', personId: 'avery', body: 'private fixture note' }],
      settings: { textSize: 'large', unknownSetting: { a: true } },
      unknownTopLevelField: { supported: false, ids: ['a', 'b'] },
      prayers: [{
        id: 'prayer-1',
        personId: 'avery',
        sharedWith: ['avery', 'friend'],
        text: 'Original title snapshot',
        details: 'Exact details',
        freq: 'daily',
        tod: 'morning',
        until: '2026-12-31',
        added: '2026-11-20',
        updatedAt: '2026-11-24T12:00:00.123Z',
        prayerLogs: [Date.parse('2026-11-22T12:00:00Z')],
        unknownPrayerField: { preserve: true },
        faithOwner: 'me',
        category: 'Family'
      }]
    };
    const envelope = convertClassicStateToPreviewEnvelope(classic);
    const request = envelope.data.prayerRequests.find(item => item.id === 'prayer-1');
    expect(request).toMatchObject({
      personId: 'avery',
      sharedWith: ['avery', 'friend'],
      title: 'Original title snapshot',
      details: 'Exact details',
      schedule: { frequency: 'daily', endDate: '2026-12-31' },
      timeOfDay: 'morning',
      prayerLogs: [{ prayedAt: '2026-11-22T12:00:00.000Z' }]
    });

    const edited = createPreviewEnvelope({
      ...envelope.data,
      prayerRequests: envelope.data.prayerRequests.map(item => ({
        ...item,
        schedule: { frequency: 'weekly', weekdays: [1, 3, 5], weeklyMode: 'select-days', endDate: '2027-01-15' },
        timeOfDay: 'evening',
        updatedAt: '2026-11-24T13:00:00.123Z'
      }))
    });
    const merged = mergePrayerRequestsIntoClassicState(classic, edited);
    expect(merged).toMatchObject({
      people: classic.people,
      rhythms: classic.rhythms,
      datedRhythmCompletions: classic.datedRhythmCompletions,
      connections: classic.connections,
      sparks: classic.sparks,
      personNotes: classic.personNotes,
      settings: classic.settings,
      unknownTopLevelField: classic.unknownTopLevelField,
      prayers: [{
        id: 'prayer-1',
        personId: 'avery',
        sharedWith: ['avery', 'friend'],
        text: 'Original title snapshot',
        details: 'Exact details',
        freq: 'selectdays',
        weekdays: [1, 3, 5],
        tod: 'evening',
        until: '2027-01-15',
        prayerLogs: [Date.parse('2026-11-22T12:00:00Z')],
        unknownPrayerField: { preserve: true },
        faithOwner: 'me',
        category: 'Family'
      }]
    });
  });

  it('does not resurrect a Prayer deleted by a React command that still has a previous envelope tombstone', () => {
    const previous = createEmptyPreviewData();
    previous.people = [{ id: 'avery', displayName: 'Avery' }];
    previous.prayerRequests = [{
      id: 'prayer-1',
      personId: 'avery',
      title: 'Delete me',
      status: 'active',
      schedule: { frequency: 'daily' },
      createdAt: '2026-11-20T12:00:00.000Z',
      updatedAt: '2026-11-24T12:00:00.000Z',
      prayerLogs: []
    }];
    const classic = {
      prayers: [{
        id: 'prayer-1',
        personId: 'avery',
        text: 'Delete me',
        added: '2026-11-20',
        freq: 'daily',
        prayerLogs: []
      }],
      [CANONICAL_PREVIEW_ENVELOPE_KEY]: createPreviewEnvelope(previous)
    };
    const next = createPreviewEnvelope({ ...previous, prayerRequests: [] });
    const merged = mergePrayerRequestsIntoClassicState(classic, next);
    expect(merged.prayers).toEqual([]);
  });

  it('checks the account revision before RPC and never retries a stale envelope write', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({
          data: {
            state: { prayers: [] },
            schema_version: 1,
            revision: 7,
            updated_at: '2026-11-24T12:00:00Z'
          },
          error: null
        }))
      }))
    }));
    const api = createCanonicalAccountApi({ from, rpc } satisfies CanonicalAccountSupabaseClient);
    await expect(api.save(createPreviewEnvelope(createEmptyPreviewData()), 6))
      .rejects.toMatchObject({ kind: 'stale' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('applies a saved frequency to existing eligible logs in shared Rhythm decay health', () => {
    const request: PersonPrayerRequest = {
      id: 'prayer-1',
      personId: 'avery',
      title: 'Pray daily',
      status: 'active',
      schedule: { frequency: 'daily' },
      createdAt: '2026-11-20T12:00:00.000Z',
      updatedAt: '2026-11-24T12:00:00.000Z',
      prayerLogs: [
        { id: 'log-1', prayedAt: '2026-11-22T12:00:00.000Z' },
        { id: 'log-2', prayedAt: '2026-11-23T12:00:00.000Z' },
        { id: 'log-3', prayedAt: '2026-11-24T12:00:00.000Z' }
      ]
    };
    const health = selectPersonPrayerHealth(
      [request],
      'avery',
      '2026-11-24',
      'UTC',
      new Date('2026-11-24T18:00:00.000Z')
    );
    expect(health.score).not.toBeNull();
    expect(health.scoredRequestIds).toEqual(['prayer-1']);
    expect(health.requests[0]).toMatchObject({
      requestId: 'prayer-1',
      latestPrayerDate: '2026-11-24',
      unavailableReason: null
    });
  });

  it('preserves unsupported Classic schedules and rejects unsupported React schedule saves', () => {
    const classic = {
      people: [{ id: 'avery', name: 'Avery' }],
      prayers: [{
        id: 'prayer-custom',
        personId: 'avery',
        text: 'Custom schedule',
        added: '2026-11-20',
        freq: 'custom',
        customUnit: 'days',
        customInterval: 10,
        tod: 'custom-block-id',
        until: '2026-12-31',
        prayerLogs: [Date.parse('2026-11-24T12:00:00Z')]
      }]
    };
    const envelope = convertClassicStateToPreviewEnvelope(classic);
    expect(envelope.data.prayerRequests[0]?.schedule).toBeUndefined();
    expect(envelope.data.prayerRequests[0]?.timeOfDay).toBeUndefined();

    const merged = mergePrayerRequestsIntoClassicState(classic, envelope);
    expect(merged.prayers).toEqual(classic.prayers);

    const editedUnsupported = createPreviewEnvelope({
      ...envelope.data,
      prayerRequests: envelope.data.prayerRequests.map(request => ({
        ...request,
        title: 'Attempted unsupported edit'
      }))
    });
    expect(() => mergePrayerRequestsIntoClassicState(classic, editedUnsupported))
      .toThrow(/unsupported Classic schedule.*left unchanged/i);

    const unsupported = createPreviewEnvelope({
      ...envelope.data,
      prayerRequests: [{
        ...envelope.data.prayerRequests[0]!,
        id: 'prayer-new-custom',
        schedule: {
          frequency: 'custom',
          unit: 'days',
          interval: 10,
          startDate: '2026-11-20'
        },
        timeOfDay: 'morning'
      }]
    });
    expect(() => mergePrayerRequestsIntoClassicState(classic, unsupported))
      .toThrow(/cannot be saved to the canonical Classic account/);
  });
});
