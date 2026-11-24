import { describe, expect, it } from 'vitest';
import {
  deletePersonPrayerLog,
  personPrayerRequestDraft,
  recordPersonPrayer,
  savePersonPrayerLog,
  undoDeletePersonPrayerLog,
  updatePersonPrayerRequest
} from '../src/domain/person-prayers.ts';
import type { PersonPrayerRequest } from '../src/domain/person-prayers.ts';
import { syntheticPeople } from '../src/domain/preview-data.ts';
import type { PersonId } from '../src/domain/preview-data.ts';
import { selectPersonPrayerHealth } from '../src/domain/person-prayer-health.ts';
import {
  localDateInTimeZone,
  localTimeInTimeZone,
  selectRhythmScore
} from '../src/domain/rhythm-scoring.ts';
import { timeBlockIdFromRhythmValue } from '../src/domain/time-blocks.ts';
import { DEFAULT_TIME_BLOCK_SETTINGS } from '../src/domain/time-blocks.ts';
import type { TimeBlockSettings } from '../src/domain/time-blocks.ts';
import type { RhythmSchedule, RhythmScoringMetadata } from '../src/domain/rhythm-schedule.ts';
import { createRhythmSeason } from '../src/domain/rhythm-seasons.ts';

const ownerId = syntheticPeople[0]!.id;
const sharedId = syntheticPeople[1]!.id;
const unrelatedId = syntheticPeople[2]!.id;
const asOfDate = '2026-11-01';
const asOfInstant = new Date('2026-11-01T12:00:00.000Z');

function request(overrides: Partial<PersonPrayerRequest> = {}): PersonPrayerRequest {
  return {
    id: 'prayer-request-one',
    personId: ownerId,
    title: 'Pray for peace',
    status: 'active',
    schedule: { frequency: 'daily' },
    timeOfDay: 'anytime',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    prayerLogs: [],
    ...overrides
  };
}

function log(id: string, prayedAt: string) {
  return { id, prayedAt };
}

function selection(
  requests: readonly PersonPrayerRequest[],
  personId: PersonId = ownerId,
  date = asOfDate,
  instant = asOfInstant,
  timeZone = 'UTC',
  timeBlockSettings: TimeBlockSettings = DEFAULT_TIME_BLOCK_SETTINGS
) {
  return selectPersonPrayerHealth(
    requests,
    personId,
    date,
    timeZone,
    instant,
    timeBlockSettings
  );
}

function sharedRhythmScore(
  savedRequest: PersonPrayerRequest,
  date: string,
  instant: Date,
  timeZone = 'UTC',
  timeBlockSettings: TimeBlockSettings = DEFAULT_TIME_BLOCK_SETTINGS
) {
  const rhythmId = `person-prayer-health:${savedRequest.id}`;
  const scoreTimeZone = savedRequest.scoring?.timeZone ?? timeZone;
  const scoreDate = savedRequest.scoring
    ? localDateInTimeZone(instant, scoreTimeZone)
    : date;
  const records = savedRequest.prayerLogs.flatMap(log => {
    if (log.prayedOn) {
      return [{ id: log.id, rhythmId, effectiveDate: log.prayedOn }];
    }
    if (!log.prayedAt) return [];
    const completedAt = new Date(log.prayedAt);
    if (completedAt > instant) return [];
    return [{
      id: log.id,
      rhythmId,
      effectiveDate: localDateInTimeZone(completedAt, scoreTimeZone)
    }];
  });
  const blockId = savedRequest.timeOfDay
    ? timeBlockIdFromRhythmValue(savedRequest.timeOfDay)
    : undefined;
  const dueTime = blockId
    ? timeBlockSettings.blocks.find(block => block.id === blockId)?.start
    : undefined;
  return selectRhythmScore({
    rhythmId,
    schedule: savedRequest.schedule!,
    createdLocalDate: localDateInTimeZone(new Date(savedRequest.createdAt), scoreTimeZone),
    createdTimeZone: scoreTimeZone,
    records,
    recordsAvailable: true,
    ...(dueTime ? {
      asOfTime: localTimeInTimeZone(instant, scoreTimeZone),
      dueTime
    } : {}),
    ...(savedRequest.scoring ? { scoring: savedRequest.scoring } : {}),
    asOfDate: scoreDate,
    timeZone: scoreTimeZone
  });
}

function requestHealth(
  requests: readonly PersonPrayerRequest[],
  requestId = 'prayer-request-one',
  personId: PersonId = ownerId,
  date = asOfDate,
  instant = asOfInstant,
  timeZone = 'UTC',
  timeBlockSettings: TimeBlockSettings = DEFAULT_TIME_BLOCK_SETTINGS
) {
  const result = selection(requests, personId, date, instant, timeZone, timeBlockSettings);
  const health = result.requests.find(item => item.requestId === requestId);
  if (!health) throw new Error(`Missing Prayer Health for ${requestId}.`);
  return { result, health };
}

describe('person Prayer Health', () => {
  it('uses the full shared Rhythm Health model and counts repeated prayers once per occurrence', () => {
    const savedRequest = request({
      prayerLogs: [
        log('prayer-log-one', '2026-11-01T09:00:00.000Z'),
        log('prayer-log-two', '2026-11-01T10:00:00.000Z'),
        log('prayer-log-three', '2026-11-01T11:00:00.000Z')
      ]
    });
    const { result, health } = requestHealth([savedRequest]);
    const expected = sharedRhythmScore(savedRequest, asOfDate, asOfInstant);
    const oneLog = requestHealth([request({
      prayerLogs: [log('single-prayer-log', '2026-11-01T09:00:00.000Z')]
    })]).health;

    expect(health.scoreResult).toEqual(expected);
    expect(health.score).toBe(expected.kind === 'rhythm-score' ? expected.healthScore : null);
    expect(expected.kind).toBe('rhythm-score');
    if (expected.kind !== 'rhythm-score') return;
    expect(expected.consistency.kind).toBe('scored');
    expect(expected.onTrack.kind).toBe('scored');
    expect(health.score).toBe(27.5);
    expect(oneLog.score).toBe(health.score);
    expect(result.scoredRequestIds).toEqual([savedRequest.id]);
  });

  const schedules: RhythmSchedule[] = [
    { frequency: 'daily' },
    { frequency: 'weekly', weekdays: [0] },
    { frequency: 'monthly', pattern: { kind: 'dayOfMonth', day: 1 } },
    { frequency: 'quarterly', monthInQuarter: 1, pattern: { kind: 'dayOfMonth', day: 1 } },
    { frequency: 'yearly', month: 1, pattern: { kind: 'dayOfMonth', day: 1 } },
    { frequency: 'custom', unit: 'days', interval: 3, startDate: '2026-10-01' },
    { frequency: 'custom', unit: 'weeks', interval: 2, weekdays: [0], startDate: '2026-10-01' },
    { frequency: 'custom', unit: 'months', interval: 2, pattern: { kind: 'dayOfMonth', day: 15 }, startDate: '2026-10-01' },
    { frequency: 'custom', unit: 'years', interval: 2, month: 10, pattern: { kind: 'dayOfMonth', day: 1 }, startDate: '2026-10-01' }
  ];

  it.each(schedules)('matches shared Rhythm metrics and combined Health for a $frequency schedule', schedule => {
    const savedRequest = request({
      schedule,
      prayerLogs: [
        log('prayer-october-one', '2026-10-01T12:00:00.000Z'),
        log('prayer-october-thirty', '2026-10-30T12:00:00.000Z'),
        log('prayer-november-one', '2026-11-01T10:00:00.000Z')
      ]
    });
    const { health } = requestHealth([savedRequest]);
    const expected = sharedRhythmScore(savedRequest, asOfDate, asOfInstant);

    expect(health.scoreResult).toEqual(expected);
    expect(health.score).toBe(expected.kind === 'rhythm-score' ? expected.healthScore : null);
  });

  it('scores Prayer against each saved schedule period instead of applying the latest cadence retroactively', () => {
    const rhythmId = `person-prayer-health:${'prayer-request-one'}`;
    const schedule: RhythmSchedule = { frequency: 'weekly', weekdays: [0] };
    const scoring: RhythmScoringMetadata = {
      trackingStartDate: '2026-10-01',
      timeZone: 'UTC',
      scheduleHistory: [
        createRhythmSeason(rhythmId, '2026-10-01', { frequency: 'daily' }, 'morning'),
        createRhythmSeason(rhythmId, '2026-10-20', schedule, 'evening')
      ]
    };
    const savedRequest = request({
      schedule,
      timeOfDay: 'evening',
      scoring,
      prayerLogs: [
        log('daily-prayer-one', '2026-10-01T10:00:00.000Z'),
        log('daily-prayer-two', '2026-10-02T10:00:00.000Z'),
        log('weekly-prayer-one', '2026-10-25T18:00:00.000Z'),
        log('weekly-prayer-two', '2026-11-01T18:00:00.000Z')
      ]
    });
    const { health } = requestHealth([savedRequest]);
    const expected = sharedRhythmScore(savedRequest, asOfDate, asOfInstant);
    const requestWithoutHistory = { ...savedRequest };
    delete requestWithoutHistory.scoring;
    const latestScheduleOnly = sharedRhythmScore(requestWithoutHistory, asOfDate, asOfInstant);

    expect(health.scoreResult).toEqual(expected);
    expect(health.score).toBe(expected.kind === 'rhythm-score' ? expected.healthScore : null);
    expect(health.scoreResult).not.toEqual(latestScheduleOnly);
  });

  it('keeps new requests unscored until their first prayer and explains missing eligible history', () => {
    const noHistory = request({ createdAt: '2026-10-01T00:00:00.000Z' });
    const empty = requestHealth([noHistory]);
    expect(empty.health.score).toBeNull();
    expect(empty.health.scoreResult.kind).toBe('unscored');
    expect(empty.health.unavailableReason).toBe('Ready for your first prayer.');
    expect(empty.result.noHistoryRequestIds).toEqual([noHistory.id]);

    const firstPrayer = request({
      prayerLogs: [log('first-prayer', '2026-11-01T10:00:00.000Z')]
    });
    const withFirstPrayer = requestHealth([firstPrayer]);
    expect(withFirstPrayer.health.scoreResult.kind).toBe('rhythm-score');
    expect(withFirstPrayer.health.score).not.toBeNull();

    const undated = request({ prayerLogs: [{ id: 'legacy-undated' }] });
    expect(requestHealth([undated]).health.score).toBeNull();
    expect(requestHealth([undated]).health.unavailableReason)
      .toContain('no usable date');
  });

  it('keeps legacy schedule uncertainty through a prospective revision until the new history window is covered', () => {
    const legacy = request({
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-31T12:00:00.000Z',
      prayerLogs: Array.from({ length: 31 }, (_, index) => {
        const day = String(index + 1).padStart(2, '0');
        return log(`legacy-prayer-${day}`, `2026-10-${day}T10:00:00.000Z`);
      })
    });
    const beforeRevision = requestHealth(
      [legacy],
      legacy.id,
      ownerId,
      '2026-10-31',
      new Date('2026-10-31T12:00:00.000Z')
    );
    expect(beforeRevision.health.score).toBe(100);

    const revision = updatePersonPrayerRequest(
      [legacy],
      legacy.id,
      legacy.updatedAt,
      ownerId,
      {
        ...personPrayerRequestDraft(legacy),
        schedule: { frequency: 'weekly', weekdays: [0] }
      },
      '2026-11-01T00:01:00.000Z',
      [ownerId],
      { currentDate: '2026-11-01', timeZone: 'UTC' }
    );
    expect(revision.valid).toBe(true);
    if (!revision.valid) return;

    const revised = revision.requests[0]!;
    expect(revised.scoring?.scheduleHistory).toMatchObject([
      { kind: 'unknown', startDate: '2026-10-01' },
      {
        kind: 'scheduled',
        startDate: '2026-11-01',
        schedule: { frequency: 'weekly', weekdays: [0] }
      }
    ]);

    const afterRevision = requestHealth(
      revision.requests,
      legacy.id,
      ownerId,
      '2026-11-01',
      new Date('2026-11-01T09:00:00.000Z')
    ).health;
    expect(afterRevision.score).toBeNull();
    expect(afterRevision.scoreResult.kind).toBe('rhythm-score');
    expect(afterRevision.scoreResult.consistency).toMatchObject({
      kind: 'unscored',
      reasonCode: 'unsupported-history'
    });

    const firstPrayer = recordPersonPrayer(
      revision.requests,
      legacy.id,
      revised.updatedAt,
      ownerId,
      log('weekly-prayer-2026-11-01', '2026-11-01T10:00:00.000Z'),
      [ownerId]
    );
    expect(firstPrayer.valid).toBe(true);
    if (!firstPrayer.valid) return;

    let currentRequest = firstPrayer.requests[0]!;
    const afterFirstNewPrayer = requestHealth(
      firstPrayer.requests,
      legacy.id,
      ownerId,
      '2026-11-01',
      new Date('2026-11-01T12:00:00.000Z')
    ).health;
    expect(afterFirstNewPrayer.score).toBeNull();
    expect(afterFirstNewPrayer.scoreResult.kind).toBe('rhythm-score');
    expect(afterFirstNewPrayer.scoreResult.onTrack).toMatchObject({
      kind: 'scored',
      score: 100
    });
    expect(afterFirstNewPrayer.scoreResult.consistency).toMatchObject({
      kind: 'unscored',
      reasonCode: 'unsupported-history'
    });

    for (const date of [
      '2026-11-08', '2026-11-15', '2026-11-22', '2026-11-29',
      '2026-12-06', '2026-12-13', '2026-12-20', '2026-12-27',
      '2027-01-03', '2027-01-10', '2027-01-17', '2027-01-24'
    ]) {
      const nextPrayer = recordPersonPrayer(
        [currentRequest],
        legacy.id,
        currentRequest.updatedAt,
        ownerId,
        log(`weekly-prayer-${date}`, `${date}T10:00:00.000Z`),
        [ownerId]
      );
      expect(nextPrayer.valid).toBe(true);
      if (!nextPrayer.valid) return;
      currentRequest = nextPrayer.requests[0]!;
    }

    const coveredHistory = requestHealth(
      [currentRequest],
      legacy.id,
      ownerId,
      '2027-01-24',
      new Date('2027-01-24T12:00:00.000Z')
    ).health;
    expect(coveredHistory.score).toBe(100);
    expect(coveredHistory.scoreResult.kind).toBe('rhythm-score');
    expect(coveredHistory.scoreResult.consistency.kind).toBe('scored');
    expect(coveredHistory.scoreResult.onTrack.kind).toBe('scored');
  });

  it('includes exact date-only history and excludes future, malformed, and pre-request logs', () => {
    const savedRequest = request({
      prayerLogs: [
        { id: 'date-only', prayedOn: '2026-10-31' },
        log('future-time', '2026-11-01T12:01:00.000Z'),
        log('before-request', '2026-09-30T23:59:00.000Z')
      ]
    });
    const { health } = requestHealth([savedRequest]);
    const expected = sharedRhythmScore(
      request({ prayerLogs: [{ id: 'date-only', prayedOn: '2026-10-31' }] }),
      asOfDate,
      asOfInstant
    );

    expect(health.latestPrayerDate).toBe('2026-10-31');
    expect(health.scoreResult).toEqual(expected);
    expect(health.score).toBe(expected.kind === 'rhythm-score' ? expected.healthScore : null);
  });

  it('reuses saved end dates, time-block boundaries, and missing time-block safeguards', () => {
    const ended = request({
      schedule: { frequency: 'daily', endDate: '2026-10-31' },
      prayerLogs: [log('before-end', '2026-10-31T12:00:00.000Z')]
    });
    const endedHealth = requestHealth([ended]).health;
    expect(endedHealth.score).toBeNull();
    expect(endedHealth.unavailableReason).toContain('prayer schedule has ended');

    const morning = request({
      timeOfDay: 'morning',
      prayerLogs: [log('yesterday-prayer', '2026-10-31T10:00:00.000Z')]
    });
    const beforeBlock = requestHealth(
      [morning],
      morning.id,
      ownerId,
      asOfDate,
      new Date('2026-11-01T08:59:00.000Z')
    ).health;
    const afterBlock = requestHealth(
      [morning],
      morning.id,
      ownerId,
      asOfDate,
      new Date('2026-11-01T09:01:00.000Z')
    ).health;
    expect(beforeBlock.scoreResult).toEqual(sharedRhythmScore(
      morning,
      asOfDate,
      new Date('2026-11-01T08:59:00.000Z')
    ));
    expect(afterBlock.scoreResult).toEqual(sharedRhythmScore(
      morning,
      asOfDate,
      new Date('2026-11-01T09:01:00.000Z')
    ));

    const missingBlock = request({
      timeOfDay: 'custom-time-block:00000000-0000-4000-8000-000000000001',
      prayerLogs: [log('dated-prayer', '2026-10-31T10:00:00.000Z')]
    });
    const unavailable = requestHealth([missingBlock]).health;
    expect(unavailable.score).toBeNull();
    expect(unavailable.unavailableReason).toContain('time block is not configured');
  });

  it('recalculates the full Health result after a saved schedule change', () => {
    const savedRequest = request({
      prayerLogs: [
        log('first-prayer', '2026-10-01T10:00:00.000Z'),
        log('latest-prayer', '2026-10-31T10:00:00.000Z')
      ]
    });
    const before = requestHealth([savedRequest]).health;
    expect(before.score).not.toBeNull();

    const scheduleEdit = updatePersonPrayerRequest(
      [savedRequest],
      savedRequest.id,
      savedRequest.updatedAt,
      ownerId,
      {
        ...personPrayerRequestDraft(savedRequest),
        schedule: { frequency: 'monthly', pattern: { kind: 'dayOfMonth', day: 31 } }
      },
      '2026-11-01T12:01:00.000Z',
      [ownerId],
      { currentDate: '2026-11-01', timeZone: 'UTC' }
    );
    expect(scheduleEdit.valid).toBe(true);
    if (!scheduleEdit.valid) return;
    const scheduledHealth = requestHealth(scheduleEdit.requests).health;
    expect(scheduledHealth.scoreResult).toEqual(sharedRhythmScore(
      scheduleEdit.requests[0]!,
      asOfDate,
      asOfInstant
    ));
    expect(scheduledHealth.score).not.toBe(before.score);
  });

  it('recalculates log edits, deletion, Undo, and rejects stale writes without changing Health', () => {
    const savedRequest = request({
      prayerLogs: [log('latest-prayer', '2026-10-31T10:00:00.000Z')]
    });
    const before = requestHealth([savedRequest]).health;
    const editedLog = savePersonPrayerLog(
      [savedRequest],
      savedRequest.id,
      savedRequest.updatedAt,
      ownerId,
      { id: 'latest-prayer', prayedAt: '2026-10-29T10:00:00.000Z' },
      '2026-11-01T12:01:00.000Z',
      [ownerId]
    );
    expect(editedLog.valid).toBe(true);
    if (!editedLog.valid) return;
    const editedHealth = requestHealth(editedLog.requests).health;
    expect(editedHealth.scoreResult).toEqual(sharedRhythmScore(
      editedLog.requests[0]!,
      asOfDate,
      asOfInstant
    ));
    expect(editedHealth.score).not.toBe(before.score);

    const staleWrite = savePersonPrayerLog(
      editedLog.requests,
      savedRequest.id,
      savedRequest.updatedAt,
      ownerId,
      { id: 'latest-prayer', prayedAt: '2026-10-31T10:00:00.000Z' },
      '2026-11-01T12:02:00.000Z',
      [ownerId]
    );
    expect(staleWrite.valid).toBe(false);
    expect(requestHealth(editedLog.requests).health.score).toBe(editedHealth.score);

    const deletion = deletePersonPrayerLog(
      editedLog.requests,
      savedRequest.id,
      editedLog.requests[0]!.updatedAt,
      ownerId,
      'latest-prayer',
      '2026-11-01T12:03:00.000Z',
      [ownerId]
    );
    expect(deletion.valid).toBe(true);
    if (!deletion.valid || !deletion.undo) return;
    expect(requestHealth(deletion.requests).health.score).toBeNull();
    expect(requestHealth(deletion.requests).health.unavailableReason)
      .toBe('Ready for your first prayer.');

    const restored = undoDeletePersonPrayerLog(
      deletion.requests,
      deletion.undo,
      ownerId,
      '2026-11-01T12:04:00.000Z',
      [ownerId]
    );
    expect(restored.valid).toBe(true);
    if (!restored.valid) return;
    expect(requestHealth(restored.requests).health.score).toBe(editedHealth.score);
    expect(requestHealth(restored.requests).health.scoreResult).toEqual(editedHealth.scoreResult);
  });

  it('aggregates only available active request Health and keeps shared-person scores scoped', () => {
    const first = request({
      id: 'first',
      prayerLogs: [log('first-log', '2026-10-31T10:00:00.000Z')]
    });
    const second = request({
      id: 'second',
      personId: ownerId,
      sharedWith: [sharedId as PersonId],
      prayerLogs: [log('second-log', '2026-10-30T10:00:00.000Z')]
    });
    const archived = request({
      id: 'archived',
      status: 'archived',
      archivedAt: '2026-10-20T00:00:00.000Z',
      prayerLogs: [log('archived-log', '2026-10-31T10:00:00.000Z')]
    });
    const missing = request({ id: 'missing', schedule: undefined });
    const all = [first, second, archived, missing];

    const owner = selection(all, ownerId);
    const shared = selection(all, sharedId);
    const unrelated = selection(all, unrelatedId);
    const firstHealth = owner.requests.find(item => item.requestId === first.id)!.score!;
    const secondHealth = owner.requests.find(item => item.requestId === second.id)!.score!;

    expect(owner.activeRequestIds).toEqual(['first', 'missing', 'second']);
    expect(owner.score).toBe((firstHealth + secondHealth) / 2);
    expect(owner.scoredRequestIds).toEqual(['first', 'second']);
    expect(owner.requests.find(item => item.requestId === 'archived')?.score).toBeNull();
    expect(shared.activeRequestIds).toEqual(['second']);
    expect(shared.score).toBe(secondHealth);
    expect(unrelated.activeRequestIds).toEqual([]);
    expect(unrelated.score).toBeNull();
  });
});
