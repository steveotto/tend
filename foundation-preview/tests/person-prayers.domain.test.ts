import { describe, expect, it } from 'vitest';
import {
  activePrayerRequestCount,
  createPersonPrayerRequest,
  deletePersonPrayerLog,
  deletePersonPrayerRequest,
  personPrayerRequestsForPerson,
  prayerRequestHistorySummary,
  recordPersonPrayer,
  savePersonPrayerLog,
  transitionPersonPrayerRequest,
  undoDeletePersonPrayerLog,
  unlinkPersonPrayerRequest,
  updatePersonPrayerRequest,
  validatePersonPrayerRequestsCollection
} from '../src/domain/person-prayers.ts';
import { selectPersonPrayerHistory } from '../src/domain/person-prayer-history.ts';
import type { PersonPrayerRequest } from '../src/domain/person-prayers.ts';

const owner = 'sample-person-avery';
const shared = 'sample-person-morgan';
const other = 'sample-person-jordan';
const people = [owner, shared, other] as const;
const createdAt = '2026-10-31T12:00:00.000Z';

function request(overrides: Partial<PersonPrayerRequest> = {}): PersonPrayerRequest {
  return {
    id: 'prayer-request-one',
    personId: owner,
    sharedWith: [shared],
    title: 'For a family member',
    details: 'A plain-text request.',
    status: 'active',
    createdAt,
    updatedAt: createdAt,
    prayerLogs: [],
    ...overrides
  };
}

describe('person-linked Prayer requests', () => {
  it('projects one shared request per linked person and counts only active requests', () => {
    const requests = [request(), request({
      id: 'prayer-request-two',
      title: 'Answered request',
      status: 'answered',
      answeredAt: '2026-10-31T13:00:00.000Z',
      updatedAt: '2026-10-31T13:00:00.000Z',
      sharedWith: []
    })];
    expect(personPrayerRequestsForPerson(requests, owner)).toHaveLength(2);
    expect(personPrayerRequestsForPerson(requests, shared)).toEqual([requests[0]]);
    expect(personPrayerRequestsForPerson(requests, other)).toEqual([]);
    expect(activePrayerRequestCount(requests, owner)).toBe(1);
    expect(activePrayerRequestCount(requests, shared)).toBe(1);
  });

  it('validates stable owners, shared links, lifecycle timestamps, and timestamped logs', () => {
    expect(validatePersonPrayerRequestsCollection([request()], people)).toBe(true);
    expect(validatePersonPrayerRequestsCollection([request({ personId: 'missing-person' as typeof owner })], people))
      .toBe(false);
    expect(validatePersonPrayerRequestsCollection([request({ sharedWith: [owner] })], people)).toBe(false);
    expect(validatePersonPrayerRequestsCollection([request({
      prayerLogs: [{ id: 'log-one', prayedAt: 'not-a-date' }]
    })], people)).toBe(false);
    expect(validatePersonPrayerRequestsCollection([request({
      prayerLogs: [{ id: 'undated-log' }]
    })], people)).toBe(true);
    expect(validatePersonPrayerRequestsCollection([request({
      status: 'answered',
      archivedAt: '2026-10-31T13:00:00.000Z',
      answeredAt: '2026-10-31T13:00:00.000Z'
    })], people)).toBe(false);
    expect(validatePersonPrayerRequestsCollection([request({
      title: '<script>alert(1)</script>'
    })], people)).toBe(true);
  });

  it('updates and logs an account-level Prayer without assigning a Person', () => {
    const accountPrayer = request({
      personId: null,
      sharedWith: [],
      prayerLogs: [{ id: 'existing-log', prayedOn: '2026-10-30' }]
    });
    expect(validatePersonPrayerRequestsCollection([accountPrayer], people)).toBe(true);

    const edited = updatePersonPrayerRequest(
      [accountPrayer],
      accountPrayer.id,
      accountPrayer.updatedAt,
      null,
      { title: 'Updated account Prayer', details: accountPrayer.details ?? '', sharedWith: [] },
      '2026-10-31T13:00:00.000Z',
      people
    );
    expect(edited.valid).toBe(true);
    if (!edited.valid) return;
    expect(edited.requests[0]).toMatchObject({
      personId: null,
      sharedWith: [],
      title: 'Updated account Prayer',
      prayerLogs: [{ id: 'existing-log', prayedOn: '2026-10-30' }]
    });

    const logged = recordPersonPrayer(
      edited.requests,
      accountPrayer.id,
      '2026-10-31T13:00:00.000Z',
      null,
      { id: 'new-log', prayedAt: '2026-10-31T14:00:00.000Z' },
      people
    );
    expect(logged.valid).toBe(true);
    if (!logged.valid) return;
    expect(logged.requests[0]).toMatchObject({
      personId: null,
      sharedWith: [],
      prayerLogs: [
        { id: 'existing-log', prayedOn: '2026-10-30' },
        { id: 'new-log', prayedAt: '2026-10-31T14:00:00.000Z' }
      ]
    });
  });

  it('creates, edits, and changes lifecycle without adding prayer logs', () => {
    const created = createPersonPrayerRequest([], request({ sharedWith: [] }), people);
    expect(created.valid).toBe(true);
    if (!created.valid) return;

    const edited = updatePersonPrayerRequest(
      created.requests,
      'prayer-request-one',
      createdAt,
      owner,
      { title: 'Updated request', details: '', sharedWith: [shared] },
      '2026-10-31T13:00:00.000Z',
      people
    );
    expect(edited.valid).toBe(true);
    if (!edited.valid) return;
    expect(edited.requests[0]).toMatchObject({
      title: 'Updated request',
      sharedWith: [shared],
      status: 'active',
      prayerLogs: []
    });

    const answered = transitionPersonPrayerRequest(
      edited.requests,
      'prayer-request-one',
      '2026-10-31T13:00:00.000Z',
      owner,
      'answer',
      '2026-10-31T14:00:00.000Z'
    );
    expect(answered.valid).toBe(true);
    if (!answered.valid) return;
    expect(answered.requests[0]).toMatchObject({
      status: 'answered',
      answeredAt: '2026-10-31T14:00:00.000Z',
      prayerLogs: []
    });
    const reopened = transitionPersonPrayerRequest(
      answered.requests,
      'prayer-request-one',
      '2026-10-31T14:00:00.000Z',
      owner,
      'reopen',
      '2026-10-31T15:00:00.000Z'
    );
    expect(reopened.valid).toBe(true);
    if (reopened.valid) expect(reopened.requests[0]).toMatchObject({ status: 'active', prayerLogs: [] });
  });

  it('records Prayer schedule changes prospectively without inventing legacy baseline history', () => {
    const legacy = request({
      schedule: { frequency: 'daily' },
      timeOfDay: 'morning',
      prayerLogs: [{ id: 'legacy-prayer', prayedAt: '2026-11-01T10:00:00.000Z' }]
    });
    const dailyToWeekly = updatePersonPrayerRequest(
      [legacy],
      legacy.id,
      legacy.updatedAt,
      owner,
      {
        title: legacy.title,
        details: legacy.details ?? '',
        sharedWith: legacy.sharedWith ?? [],
        schedule: { frequency: 'weekly', weekdays: [1, 3] },
        timeOfDay: 'evening'
      },
      '2026-11-03T12:00:00.000Z',
      people,
      { currentDate: '2026-11-03', timeZone: 'UTC' }
    );
    expect(dailyToWeekly.valid).toBe(true);
    if (!dailyToWeekly.valid) return;
    const first = dailyToWeekly.requests[0]!;
    expect(first.scoring).toMatchObject({
      trackingStartDate: '2026-11-03',
      timeZone: 'UTC',
      scheduleHistory: [
        { kind: 'unknown', startDate: '2026-10-31' },
        {
          kind: 'scheduled',
          startDate: '2026-11-03',
          schedule: { frequency: 'weekly', weekdays: [1, 3] },
          timeOfDay: 'evening'
        }
      ]
    });

    const weeklyToDaily = updatePersonPrayerRequest(
      dailyToWeekly.requests,
      first.id,
      first.updatedAt,
      owner,
      {
        title: first.title,
        details: first.details ?? '',
        sharedWith: first.sharedWith ?? [],
        schedule: { frequency: 'daily', endDate: '2026-12-10' },
        timeOfDay: 'evening'
      },
      '2026-11-05T12:00:00.000Z',
      people,
      { currentDate: '2026-11-05', timeZone: 'UTC' }
    );
    expect(weeklyToDaily.valid).toBe(true);
    if (!weeklyToDaily.valid) return;
    const second = weeklyToDaily.requests[0]!;
    expect(second.scoring?.scheduleHistory).toMatchObject([
      { kind: 'unknown', startDate: '2026-10-31' },
      {
        kind: 'scheduled',
        startDate: '2026-11-03',
        schedule: {
          frequency: 'weekly',
          weekdays: [1, 3],
          endDate: '2026-11-04'
        }
      },
      {
        kind: 'scheduled',
        startDate: '2026-11-05',
        schedule: { frequency: 'daily', endDate: '2026-12-10' },
        timeOfDay: 'evening'
      }
    ]);

    const sameDayCorrection = updatePersonPrayerRequest(
      weeklyToDaily.requests,
      second.id,
      second.updatedAt,
      owner,
      {
        title: second.title,
        details: second.details ?? '',
        sharedWith: second.sharedWith ?? [],
        schedule: { frequency: 'daily', endDate: '2026-12-12' },
        timeOfDay: 'morning'
      },
      '2026-11-05T13:00:00.000Z',
      people,
      { currentDate: '2026-11-05', timeZone: 'UTC' }
    );
    expect(sameDayCorrection.valid).toBe(true);
    if (!sameDayCorrection.valid) return;
    const corrected = sameDayCorrection.requests[0]!;
    expect(corrected.scoring?.scheduleHistory).toHaveLength(3);
    expect(corrected.scoring?.scheduleHistory.at(-1)).toMatchObject({
      startDate: '2026-11-05',
      schedule: { frequency: 'daily', endDate: '2026-12-12' },
      timeOfDay: 'morning'
    });

    const unchanged = updatePersonPrayerRequest(
      sameDayCorrection.requests,
      corrected.id,
      corrected.updatedAt,
      owner,
      {
        title: corrected.title,
        details: corrected.details ?? '',
        sharedWith: corrected.sharedWith ?? [],
        schedule: corrected.schedule,
        timeOfDay: corrected.timeOfDay
      },
      '2026-11-06T12:00:00.000Z',
      people,
      { currentDate: '2026-11-06', timeZone: 'UTC' }
    );
    expect(unchanged.valid).toBe(true);
    if (!unchanged.valid) return;
    expect(unchanged.requests[0]?.updatedAt).toBe(corrected.updatedAt);
    expect(unchanged.requests[0]?.scoring).toEqual(corrected.scoring);

    expect(updatePersonPrayerRequest(
      unchanged.requests,
      corrected.id,
      legacy.updatedAt,
      owner,
      {
        title: corrected.title,
        details: corrected.details ?? '',
        sharedWith: corrected.sharedWith ?? [],
        schedule: corrected.schedule,
        timeOfDay: corrected.timeOfDay
      },
      '2026-11-06T12:00:00.000Z',
      people,
      { currentDate: '2026-11-06', timeZone: 'UTC' }
    )).toMatchObject({ valid: false, error: expect.stringMatching(/changed while you were editing/i) });
  });

  it('records Prayed independently and restricts it to active requests', () => {
    const prayed = recordPersonPrayer(
      [request()],
      'prayer-request-one',
      createdAt,
      shared,
      { id: 'prayer-log-one', prayedAt: '2026-10-31T13:00:00.000Z' },
      people
    );
    expect(prayed.valid).toBe(true);
    if (!prayed.valid) return;
    expect(prayed.requests[0]?.prayerLogs).toEqual([
      { id: 'prayer-log-one', prayedAt: '2026-10-31T13:00:00.000Z' }
    ]);
    expect(prayerRequestHistorySummary(request({
      prayerLogs: [
        { id: 'log-later', prayedAt: '2026-10-31T15:00:00Z' },
        { id: 'log-latest', prayedAt: '2026-10-31T15:00:00.001Z' },
        { id: 'log-earlier', prayedAt: '2026-10-31T13:00:00.000Z' },
        { id: 'log-legacy' }
      ]
    }))).toEqual({ count: 4, lastPrayedAt: '2026-10-31T15:00:00.001Z' });
    expect(recordPersonPrayer(
      [request({ status: 'archived', archivedAt: '2026-10-31T13:00:00.000Z' })],
      'prayer-request-one',
      '2026-10-31T13:00:00.000Z',
      owner,
      { id: 'prayer-log-two', prayedAt: '2026-10-31T14:00:00.000Z' },
      people
    ).valid).toBe(false);
  });

  it('edits, deletes, and restores one shared prayer log with identity and stale-revision safeguards', () => {
    const original = request({
      updatedAt: '2026-10-31T14:00:00.000Z',
      prayerLogs: [
        { id: 'old-log', prayedAt: '2026-10-30T08:15:30.123Z', notes: 'Keep this note.' },
        { id: 'latest-log', prayedAt: '2026-10-31T08:15:00.000Z' }
      ]
    });
    const edited = savePersonPrayerLog(
      [original],
      original.id,
      original.updatedAt,
      shared,
      { id: 'old-log', prayedAt: '2026-10-29T08:15:30.123Z', notes: 'Edited note.' },
      '2026-10-31T15:00:00.000Z',
      people
    );
    expect(edited.valid).toBe(true);
    if (!edited.valid) return;
    expect(edited.requests[0]?.prayerLogs).toEqual([
      { id: 'old-log', prayedAt: '2026-10-29T08:15:30.123Z', notes: 'Edited note.' },
      { id: 'latest-log', prayedAt: '2026-10-31T08:15:00.000Z' }
    ]);

    const deleted = deletePersonPrayerLog(
      edited.requests,
      original.id,
      '2026-10-31T15:00:00.000Z',
      shared,
      'latest-log',
      '2026-10-31T16:00:00.000Z',
      people
    );
    expect(deleted.valid).toBe(true);
    if (!deleted.valid || !deleted.undo) return;
    expect(deleted.requests[0]?.prayerLogs.map(log => log.id)).toEqual(['old-log']);

    expect(undoDeletePersonPrayerLog(
      deleted.requests,
      deleted.undo,
      shared,
      '2026-10-31T17:00:00.000Z',
      people
    )).toMatchObject({
      valid: true,
      requests: [{
        prayerLogs: [
          { id: 'old-log', prayedAt: '2026-10-29T08:15:30.123Z', notes: 'Edited note.' },
          { id: 'latest-log', prayedAt: '2026-10-31T08:15:00.000Z' }
        ]
      }]
    });
    expect(undoDeletePersonPrayerLog(
      [request({ updatedAt: '2026-10-31T16:30:00.000Z' })],
      deleted.undo,
      shared,
      '2026-10-31T17:00:00.000Z',
      people
    )).toMatchObject({ valid: false, error: expect.stringMatching(/changed after the entry was deleted/i) });
    expect(deletePersonPrayerLog(
      [original],
      original.id,
      original.updatedAt,
      other,
      'latest-log',
      '2026-10-31T15:00:00.000Z',
      people
    )).toMatchObject({ valid: false, error: expect.stringMatching(/no longer available/i) });
  });

  it('keeps date-only and undated legacy entries honest and blocks unsafe imported identities', () => {
    const legacy = request({
      prayerLogs: [
        { id: 'date-only', prayedOn: '2026-10-30', editable: false },
        { id: 'missing-date', editable: false }
      ]
    });
    expect(validatePersonPrayerRequestsCollection([legacy], people)).toBe(true);
    expect(selectPersonPrayerHistory(legacy, '2026-10-31', 'UTC')).toMatchObject({
      totalCount: 2,
      datedCount: 1,
      undatedCount: 1,
      lastPrayedAt: null,
      lastPrayedDate: '2026-10-30',
      dailyCounts: [
        { date: '2026-10-30', count: 1 },
        { date: '2026-10-31', count: 0 }
      ]
    });
    expect(savePersonPrayerLog(
      [legacy],
      legacy.id,
      legacy.updatedAt,
      owner,
      { id: 'date-only', prayedOn: '2026-10-29' },
      '2026-10-31T13:00:00.000Z',
      people
    )).toMatchObject({
      valid: false,
      error: expect.stringMatching(/no safely editable record identity/i)
    });
  });

  it('keeps undated history separate and counts only the requested dated window', () => {
    const history = selectPersonPrayerHistory(request({
      prayerLogs: [
        { id: 'today', prayedAt: '2026-11-01T10:00:00.000Z' },
        { id: 'window-start', prayedAt: '2026-10-03T23:59:00.000Z' },
        { id: 'older', prayedAt: '2026-10-02T10:00:00.000Z' },
        { id: 'undated' },
        { id: 'future', prayedAt: '2026-11-02T10:00:00.000Z' }
      ]
    }), '2026-11-01', 'UTC');

    expect(history).toMatchObject({
      totalCount: 5,
      datedCount: 4,
      undatedCount: 1,
      futureDatedCount: 1,
      lastPrayedAt: '2026-11-01T10:00:00.000Z',
      lastPrayedDate: '2026-11-01',
      recentWindowStart: '2026-10-03',
      recentCount: 2
    });
    expect(history.dailyCounts[0]).toEqual({ date: '2026-10-02', count: 1 });
    expect(history.dailyCounts.at(-1)).toEqual({ date: '2026-11-01', count: 1 });
    expect(history.dailyCounts).toHaveLength(31);
  });

  it('formats dated activity in the supplied timezone and includes today for empty history', () => {
    const localHistory = selectPersonPrayerHistory(request({
      prayerLogs: [{ id: 'late-utc', prayedAt: '2026-10-01T01:00:00.000Z' }]
    }), '2026-09-30', 'America/Los_Angeles');
    expect(localHistory.dailyCounts).toEqual([{ date: '2026-09-30', count: 1 }]);
    expect(localHistory.recentCount).toBe(1);

    const emptyHistory = selectPersonPrayerHistory(request(), '2026-11-01', 'UTC');
    expect(emptyHistory).toMatchObject({
      totalCount: 0,
      datedCount: 0,
      undatedCount: 0,
      recentCount: 0,
      lastPrayedAt: null,
      lastPrayedDate: null,
      dailyCounts: [{ date: '2026-11-01', count: 0 }]
    });
  });

  it('unlinks a secondary profile but only lets the primary owner delete the shared record', () => {
    const unlinked = unlinkPersonPrayerRequest(
      [request()],
      'prayer-request-one',
      createdAt,
      shared,
      '2026-10-31T13:00:00.000Z'
    );
    expect(unlinked.valid).toBe(true);
    if (!unlinked.valid) return;
    expect(unlinked.requests[0]?.sharedWith).toEqual([]);
    expect(unlinked.requests[0]?.prayerLogs).toEqual([]);
    expect(deletePersonPrayerRequest(
      unlinked.requests,
      'prayer-request-one',
      '2026-10-31T13:00:00.000Z',
      shared
    ).valid).toBe(false);
    expect(deletePersonPrayerRequest(
      unlinked.requests,
      'prayer-request-one',
      '2026-10-31T13:00:00.000Z',
      owner
    )).toEqual({ valid: true, requests: [] });
  });
});
