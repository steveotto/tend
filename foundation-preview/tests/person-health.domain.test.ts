import { describe, expect, it } from 'vitest';
import { selectCategoryScore } from '../src/domain/category-scoring.ts';
import { aggregateHealthMeasures } from '../src/domain/health-scoring.ts';
import {
  selectPersonHealth,
  selectPersonOverallHealth,
  selectPersonRhythmHealth
} from '../src/domain/person-health.ts';
import {
  rhythmScheduleForConnectionCadence,
  selectPersonConnectionHealth
} from '../src/domain/person-connection-health.ts';
import { createFriendshipData } from '../src/domain/friendships.ts';
import type {
  ConnectionCadence,
  FriendshipConnection,
  FriendshipData
} from '../src/domain/friendships.ts';
import { marriageRhythms } from '../src/domain/preview-data.ts';
import type { RhythmPreview } from '../src/domain/preview-data.ts';
import type { RhythmScoreResult, RhythmScoreSelection } from '../src/domain/rhythm-scoring.ts';
import type { FoundationScoreSelection } from '../src/domain/foundation-scoring.ts';
import { scoreRhythm } from '../../src/scoring/engine.ts';

const averyId = 'sample-person-avery';

function connection(
  id: string,
  type: FriendshipConnection['type'],
  date: string,
  participantIds: string[] = [averyId],
  extra: Partial<FriendshipConnection> = {}
): FriendshipConnection {
  return { id, type, date, participantIds, ...extra };
}

function friendshipData(
  cadence: ConnectionCadence | null,
  connections: FriendshipConnection[]
): FriendshipData {
  return {
    ...createFriendshipData(),
    cadenceSettings: cadence === null
      ? []
      : [{ personId: averyId, cadence, setOn: '2020-01-01' }],
    connections
  };
}

function scoredRhythm(consistency: number, onTrack: number): RhythmScoreSelection {
  return {
    kind: 'rhythm-score',
    asOfDate: '2026-10-27',
    timeZone: 'UTC',
    trackingStartDate: '2026-10-01',
    consistency: {
      kind: 'scored',
      score: consistency,
      exactPercent: consistency,
      evidence: {
        frequency: 'daily',
        windowStartDate: '2026-10-01',
        windowEndDate: '2026-10-27',
        eligibleDueCount: 1,
        completedCount: 1,
        notCompletedCount: 0,
        limitedHistoryDays: null,
        todayIncluded: true,
        occurrences: []
      }
    },
    onTrack: {
      kind: 'scored',
      score: onTrack,
      evidence: {
        lastQualifyingCompletionDate: '2026-10-27',
        missedOccurrenceCount: 0,
        pointsPerMissedOccurrence: 10,
        deduction: 0,
        occurrences: [],
        repeatedZeroScoreSpans: [],
        scheduleChanges: []
      }
    },
    healthScore: consistency * 0.75 + onTrack * 0.25
  };
}

function foundationScore(
  foundationId: string,
  consistency: number | null,
  onTrack: number | null
): FoundationScoreSelection {
  return {
    foundationId,
    linkedRhythmIds: [],
    activeLinkedRhythmIds: [],
    eligibleRhythmIds: [],
    archivedRhythmIds: [],
    unresolvedRhythmIds: [],
    excludedRhythms: [],
    consistency,
    onTrack,
    health: consistency === null || onTrack === null ? null : consistency * 0.75 + onTrack * 0.25
  };
}

describe('person Health selectors', () => {
  it('uses the Faith rollup for identical eligible measures without rounding inputs', () => {
    const measures = [
      { id: 'rhythm-component', consistency: 80.4, onTrack: 100 },
      { id: 'connection-component', consistency: 40.2, onTrack: 60 }
    ];
    const person = selectPersonHealth(measures);
    const faith = selectCategoryScore(
      [{ id: 'practice-a' }, { id: 'practice-b' }],
      new Map([
        ['practice-a', foundationScore('practice-a', 80.4, 100)],
        ['practice-b', foundationScore('practice-b', 40.2, 60)]
      ])
    );

    expect(person.eligibleComponentIds).toEqual(['rhythm-component', 'connection-component']);
    expect(person.consistency).toBeCloseTo(60.3);
    expect(person.onTrack).toBe(80);
    expect(person.health).toBeCloseTo(65.225);
    expect(person.consistency).toBe(faith.consistency);
    expect(person.onTrack).toBe(faith.onTrack);
    expect(person.health).toBe(faith.health);
    expect(Math.round(person.consistency!)).toBe(60);
    expect(Math.round(person.health!)).toBe(65);
  });

  it('keeps valid zero distinct from empty and unavailable component sets', () => {
    expect(aggregateHealthMeasures([{ consistency: 0, onTrack: 0 }]))
      .toEqual({ consistency: 0, onTrack: 0, health: 0 });
    expect(selectPersonHealth([{ id: 'pending', consistency: null, onTrack: null }]))
      .toMatchObject({
        componentIds: ['pending'],
        eligibleComponentIds: [],
        excludedComponentIds: ['pending'],
        consistency: null,
        onTrack: null,
        health: null
      });
    expect(selectPersonHealth([])).toMatchObject({
      componentIds: [],
      consistency: null,
      onTrack: null,
      health: null
    });
  });

  it('aggregates only unique eligible person-associated Rhythms and reports exclusions', () => {
    const rhythmA: RhythmPreview = {
      ...marriageRhythms[0]!,
      id: 'person-health-rhythm-a',
      personIds: ['sample-person-avery']
    };
    const rhythmB: RhythmPreview = {
      ...rhythmA,
      id: 'person-health-rhythm-b'
    };
    const archived: RhythmPreview = {
      ...rhythmA,
      id: 'person-health-rhythm-archived'
    };
    const unrelated: RhythmPreview = {
      ...rhythmA,
      id: 'person-health-rhythm-unrelated',
      personIds: ['sample-person-morgan']
    };
    const rhythmScores = new Map<string, RhythmScoreResult>([
      [rhythmA.id, scoredRhythm(80.4, 100)],
      [rhythmB.id, scoredRhythm(40.2, 60)],
      [archived.id, scoredRhythm(100, 100)]
    ]);
    const result = selectPersonRhythmHealth(
      'sample-person-avery',
      [rhythmA, rhythmA, rhythmB, archived, unrelated],
      rhythmScores,
      new Set([archived.id])
    );

    expect(result.rhythmIds).toEqual([rhythmA.id, rhythmB.id, archived.id]);
    expect(result.activeRhythmIds).toEqual([rhythmA.id, rhythmB.id]);
    expect(result.eligibleRhythmIds).toEqual([rhythmA.id, rhythmB.id]);
    expect(result.archivedRhythmIds).toEqual([archived.id]);
    expect(result.consistency).toBeCloseTo(60.3);
    expect(result.onTrack).toBe(80);
    expect(result.health).toBeCloseTo(65.225);
  });

  it('excludes a Rhythm missing either measure and preserves genuine scored zero', () => {
    const zero: RhythmPreview = {
      ...marriageRhythms[0]!,
      id: 'person-health-rhythm-zero',
      personIds: ['sample-person-avery']
    };
    const unscored: RhythmPreview = {
      ...zero,
      id: 'person-health-rhythm-unscored'
    };
    const partialScore: RhythmScoreSelection = {
      ...scoredRhythm(30, 50),
      onTrack: {
        kind: 'unscored',
        reasonCode: 'history-unavailable',
        explanation: 'No eligible evidence.'
      }
    };
    const result = selectPersonRhythmHealth(
      'sample-person-avery',
      [zero, unscored, { ...zero, id: 'person-health-rhythm-missing' }],
      new Map<string, RhythmScoreResult>([
        [zero.id, scoredRhythm(0, 0)],
        [unscored.id, partialScore]
      ]),
      new Set()
    );

    expect(result.eligibleRhythmIds).toEqual([zero.id]);
    expect(result.excludedRhythmIds).toEqual([unscored.id]);
    expect(result.unresolvedRhythmIds).toEqual(['person-health-rhythm-missing']);
    expect(result).toMatchObject({ consistency: 0, onTrack: 0, health: 0 });
  });

  it('rolls up available components once and ignores missing measures instead of treating them as zero', () => {
    const result = selectPersonHealth([
      { id: 'rhythms', consistency: 70, onTrack: 90 },
      { id: 'connection', consistency: null, onTrack: null, scoringStatus: 'unavailable' },
      { id: 'prayer', consistency: null, onTrack: null, scoringStatus: 'unavailable' },
      { id: 'rhythms', consistency: 0, onTrack: 0 }
    ]);

    expect(result.componentIds).toEqual(['rhythms', 'connection', 'prayer']);
    expect(result.eligibleComponentIds).toEqual(['rhythms']);
    expect(result.excludedComponentIds).toEqual([]);
    expect(result.unscoredComponentIds).toEqual(['connection', 'prayer']);
    expect(result).toMatchObject({ consistency: 70, onTrack: 90, health: 75 });
  });

  it('uses the profile Overall Health selector for list scores, including zero and unavailable', () => {
    const rhythm: RhythmPreview = {
      ...marriageRhythms[0]!,
      id: 'person-health-rhythm-score-parity',
      personIds: ['sample-person-avery']
    };
    const scored = selectPersonRhythmHealth(
      'sample-person-avery',
      [rhythm],
      new Map([[rhythm.id, scoredRhythm(20, 80)]]),
      new Set()
    );
    const zero = selectPersonRhythmHealth(
      'sample-person-avery',
      [rhythm],
      new Map([[rhythm.id, scoredRhythm(0, 0)]]),
      new Set()
    );
    const unavailable = selectPersonRhythmHealth('sample-person-avery', [rhythm], new Map(), new Set());

    const noConnectionHealth = selectPersonConnectionHealth(
      createFriendshipData(),
      averyId,
      '2026-10-27'
    );
    const enabled = selectPersonOverallHealth(scored, noConnectionHealth);
    const prayerDisabled = selectPersonOverallHealth(scored, noConnectionHealth, false);
    expect(enabled.health).toBe(scored.health);
    expect(enabled.componentIds).toEqual(['rhythms', 'connection', 'prayer']);
    expect(prayerDisabled.componentIds).toEqual(['rhythms', 'connection']);
    expect(prayerDisabled.unscoredComponentIds).toEqual(['connection']);
    expect(prayerDisabled.health).toBe(enabled.health);
    expect(selectPersonOverallHealth(scored, noConnectionHealth).health).toBe(35);
    expect(selectPersonOverallHealth(zero, noConnectionHealth).health).toBe(0);
    expect(selectPersonOverallHealth(unavailable, noConnectionHealth).health).toBeNull();
    expect(selectPersonOverallHealth(unavailable, noConnectionHealth, false)).toMatchObject({
      componentIds: ['rhythms', 'connection'],
      health: null
    });
  });

  it('uses only shared Rhythm On Track decay for every saved person connection cadence', () => {
    const cases: readonly {
      cadence: ConnectionCadence;
      lastConnectedDate: string;
      asOfDate: string;
    }[] = [
      { cadence: 'daily', lastConnectedDate: '2026-11-23', asOfDate: '2026-11-25' },
      { cadence: 'twice-weekly', lastConnectedDate: '2026-11-23', asOfDate: '2026-11-27' },
      { cadence: 'weekly', lastConnectedDate: '2026-11-23', asOfDate: '2026-12-07' },
      { cadence: 'two-weeks', lastConnectedDate: '2026-11-23', asOfDate: '2026-12-08' },
      { cadence: 'monthly', lastConnectedDate: '2026-11-15', asOfDate: '2027-01-01' }
    ];

    for (const { cadence, lastConnectedDate, asOfDate } of cases) {
      const selected = selectPersonConnectionHealth(
        friendshipData(cadence, [
          connection(`connection-${cadence}`, 'text', lastConnectedDate)
        ]),
        averyId,
        asOfDate
      );
      const rhythmReference = scoreRhythm({
        rhythmId: `reference-${cadence}`,
        schedule: rhythmScheduleForConnectionCadence(cadence, lastConnectedDate),
        createdDate: lastConnectedDate,
        completionDates: [lastConnectedDate],
        asOfDate
      });

      expect(selected.score, cadence).toBe(90);
      expect(rhythmReference.onTrack).toEqual({ kind: 'scored', score: selected.score });
      expect(rhythmReference.consistency.kind).toBe('scored');
    }
  });

  it('follows Rhythm missed-occurrence grace boundaries for each cadence', () => {
    const cases: readonly {
      cadence: ConnectionCadence;
      lastConnectedDate: string;
      asOfDateBeforeMiss: string;
      asOfDateAfterMiss: string;
    }[] = [
      {
        cadence: 'daily',
        lastConnectedDate: '2026-11-23',
        asOfDateBeforeMiss: '2026-11-24',
        asOfDateAfterMiss: '2026-11-25'
      },
      {
        cadence: 'twice-weekly',
        lastConnectedDate: '2026-11-23',
        asOfDateBeforeMiss: '2026-11-26',
        asOfDateAfterMiss: '2026-11-27'
      },
      {
        cadence: 'weekly',
        lastConnectedDate: '2026-11-23',
        asOfDateBeforeMiss: '2026-12-06',
        asOfDateAfterMiss: '2026-12-07'
      },
      {
        cadence: 'two-weeks',
        lastConnectedDate: '2026-11-23',
        asOfDateBeforeMiss: '2026-12-07',
        asOfDateAfterMiss: '2026-12-08'
      },
      {
        cadence: 'monthly',
        lastConnectedDate: '2026-11-15',
        asOfDateBeforeMiss: '2026-12-31',
        asOfDateAfterMiss: '2027-01-01'
      }
    ];

    for (const { cadence, lastConnectedDate, asOfDateBeforeMiss, asOfDateAfterMiss } of cases) {
      const data = friendshipData(cadence, [
        connection(`boundary-${cadence}`, 'text', lastConnectedDate)
      ]);
      expect(selectPersonConnectionHealth(data, averyId, asOfDateBeforeMiss).score, cadence).toBe(100);
      expect(selectPersonConnectionHealth(data, averyId, asOfDateAfterMiss).score, cadence).toBe(90);
    }
  });

  it('handles month-end dates using the Rhythm last-day schedule and date-only grace', () => {
    const data = friendshipData('monthly', [
      connection('month-end', 'text', '2026-01-31')
    ]);

    expect(rhythmScheduleForConnectionCadence('monthly', '2026-01-31')).toMatchObject({
      frequency: 'monthly',
      pattern: { kind: 'dayOfMonth', day: 'last' }
    });
    expect(selectPersonConnectionHealth(data, averyId, '2026-02-28').score).toBe(100);
    expect(selectPersonConnectionHealth(data, averyId, '2026-03-01').score).toBe(90);
  });

  it('requires both a saved frequency and an eligible connection, without a default score', () => {
    const noHistory = selectPersonConnectionHealth(
      friendshipData('daily', []),
      averyId,
      '2026-11-23'
    );
    expect(noHistory.score).toBeNull();
    expect(noHistory.unavailableReason).toBe('No connections yet.');

    const missingFrequency = selectPersonConnectionHealth(
      friendshipData(null, [connection('saved-but-unrated', 'text', '2026-11-22')]),
      averyId,
      '2026-11-23'
    );
    expect(missingFrequency.score).toBeNull();
    expect(missingFrequency.unavailableReason).toContain('Set a connection frequency');

    const missingBoth = selectPersonConnectionHealth(
      friendshipData(null, []),
      averyId,
      '2026-11-23'
    );
    expect(missingBoth.unavailableReason).toContain('Set a connection frequency');
    expect(missingBoth.unavailableReason).toContain('No connections yet.');

    const futureFrequency = friendshipData('daily', [
      connection('before-frequency', 'text', '2026-11-22')
    ]);
    futureFrequency.cadenceSettings[0]!.setOn = '2026-11-24';
    const notStarted = selectPersonConnectionHealth(
      futureFrequency,
      averyId,
      '2026-11-23'
    );
    expect(notStarted.score).toBeNull();
    expect(notStarted.unavailableReason).toContain('Connection frequency starts on 2026-11-24');
  });

  it('filters future, deleted, and other-person records and scores only the latest source equally', () => {
    const data = friendshipData('daily', [
      connection('manual-old', 'text', '2026-11-20'),
      connection('spark-latest', 'spark', '2026-11-22', [averyId, 'sample-person-morgan'], {
        sparkId: 'spark-source',
        sparkOwnerId: averyId,
        sparkTitleSnapshot: 'Watch Backrooms Movie'
      }),
      connection('rhythm-future', 'rhythm', '2026-11-24', [averyId], {
        rhythmId: 'rhythm-source',
        completionId: 'rhythm-completion',
        rhythmTitleSnapshot: 'Pray together'
      }),
      connection('deleted-newer', 'call', '2026-11-23', [averyId], { deletedAt: '2026-11-23T12:00:00Z' }),
      connection('morgan-only', 'time-together', '2026-11-23', ['sample-person-morgan'])
    ]);

    const result = selectPersonConnectionHealth(data, averyId, '2026-11-23');
    const onlyLatest = selectPersonConnectionHealth(
      friendshipData('daily', [
        connection('spark-only', 'spark', '2026-11-22', [averyId], {
          sparkId: 'spark-source',
          sparkOwnerId: averyId,
          sparkTitleSnapshot: 'Watch Backrooms Movie'
        })
      ]),
      averyId,
      '2026-11-23'
    );

    expect(result.eligibleConnectionCount).toBe(2);
    expect(result.latestConnection?.id).toBe('spark-latest');
    expect(result.score).toBe(onlyLatest.score);
    expect(result.score).toBe(100);
  });

  it('recalculates after connection edits/deletes and cadence changes without stacking events', () => {
    const recent = connection('connection-latest', 'rhythm', '2026-11-20');
    const daily = friendshipData('daily', [recent]);
    const edited = friendshipData('daily', [
      { ...recent, date: '2026-11-22' },
      connection('extra-same-day', 'spark', '2026-11-22')
    ]);
    const deleted = friendshipData('daily', []);
    const weekly = friendshipData('weekly', [recent]);

    expect(selectPersonConnectionHealth(daily, averyId, '2026-11-23').score).toBe(80);
    expect(selectPersonConnectionHealth(edited, averyId, '2026-11-23').score).toBe(100);
    expect(selectPersonConnectionHealth(deleted, averyId, '2026-11-23').score).toBeNull();
    expect(selectPersonConnectionHealth(weekly, averyId, '2026-11-23').score).toBe(100);
  });

  it('feeds one Connection decay score through existing aggregate weights', () => {
    const rhythms = { consistency: 80, onTrack: 40 };
    const connections = {
      ...selectPersonConnectionHealth(
        friendshipData('daily', [connection('decay-connection', 'text', '2026-11-21')]),
        averyId,
        '2026-11-23'
      ),
      score: 90
    };
    const result = selectPersonOverallHealth(rhythms, connections, false);

    expect(result.eligibleComponentIds).toEqual(['rhythms', 'connection']);
    expect(result).toMatchObject({
      consistency: 85,
      onTrack: 65,
      health: 80
    });
  });
});
