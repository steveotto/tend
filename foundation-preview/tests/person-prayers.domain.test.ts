import { describe, expect, it } from 'vitest';
import {
  activePrayerRequestCount,
  createPersonPrayerRequest,
  deletePersonPrayerRequest,
  personPrayerRequestsForPerson,
  prayerRequestHistorySummary,
  recordPersonPrayer,
  transitionPersonPrayerRequest,
  unlinkPersonPrayerRequest,
  updatePersonPrayerRequest,
  validatePersonPrayerRequestsCollection
} from '../src/domain/person-prayers.ts';
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
      status: 'answered',
      archivedAt: '2026-10-31T13:00:00.000Z',
      answeredAt: '2026-10-31T13:00:00.000Z'
    })], people)).toBe(false);
    expect(validatePersonPrayerRequestsCollection([request({
      title: '<script>alert(1)</script>'
    })], people)).toBe(true);
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
        { id: 'log-later', prayedAt: '2026-10-31T15:00:00.000Z' },
        { id: 'log-earlier', prayedAt: '2026-10-31T13:00:00.000Z' }
      ]
    }))).toEqual({ count: 2, lastPrayedAt: '2026-10-31T15:00:00.000Z' });
    expect(recordPersonPrayer(
      [request({ status: 'archived', archivedAt: '2026-10-31T13:00:00.000Z' })],
      'prayer-request-one',
      '2026-10-31T13:00:00.000Z',
      owner,
      { id: 'prayer-log-two', prayedAt: '2026-10-31T14:00:00.000Z' },
      people
    ).valid).toBe(false);
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
