import { describe, expect, it } from 'vitest';
import { selectCategoryScore } from '../src/domain/category-scoring.ts';
import { aggregateHealthMeasures } from '../src/domain/health-scoring.ts';
import {
  selectPersonConnectionHealth,
  selectPersonHealth,
  selectPersonOverallHealth,
  selectPersonRhythmHealth
} from '../src/domain/person-health.ts';
import {
  addOrUpdateConnection,
  createFriendshipData,
  setFriendCadence
} from '../src/domain/friendships.ts';
import type { ConnectionCadence } from '../src/domain/friendships.ts';
import { marriageRhythms } from '../src/domain/preview-data.ts';
import type { RhythmPreview } from '../src/domain/preview-data.ts';
import type { RhythmScoreResult, RhythmScoreSelection } from '../src/domain/rhythm-scoring.ts';
import type { FoundationScoreSelection } from '../src/domain/foundation-scoring.ts';

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

    expect(selectPersonOverallHealth(scored).health).toBe(scored.health);
    expect(selectPersonOverallHealth(scored).health).toBe(35);
    expect(selectPersonOverallHealth(zero).health).toBe(0);
    expect(selectPersonOverallHealth(unavailable).health).toBeNull();
  });

  it('scores saved connection history against every configured cadence using Rhythm scoring', () => {
    const fixtures: {
      cadence: ConnectionCadence;
      setOn: string;
      connectionDates: readonly string[];
    }[] = [
      { cadence: 'daily', setOn: '2026-11-01', connectionDates: ['2026-11-10'] },
      { cadence: 'weekly', setOn: '2026-11-05', connectionDates: ['2026-11-05'] },
      { cadence: 'two-weeks', setOn: '2026-10-28', connectionDates: ['2026-10-28'] },
      { cadence: 'monthly', setOn: '2026-11-01', connectionDates: ['2026-11-01'] },
      { cadence: 'twice-weekly', setOn: '2026-11-05', connectionDates: ['2026-11-05', '2026-11-08'] }
    ];

    for (const [fixtureIndex, fixture] of fixtures.entries()) {
      let friendships = setFriendCadence(
        createFriendshipData(),
        'sample-person-avery',
        fixture.cadence,
        fixture.setOn
      );
      for (const [connectionIndex, date] of fixture.connectionDates.entries()) {
        friendships = addOrUpdateConnection(friendships, {
          id: `connection-health-${fixtureIndex}-${connectionIndex}`,
          type: 'time-together',
          date,
          participantIds: ['sample-person-avery']
        });
      }

      const result = selectPersonConnectionHealth(
        'sample-person-avery',
        friendships,
        '2026-11-11',
        'UTC'
      );
      expect(result.configured, fixture.cadence).toBe(true);
      expect(result.connectionIds).toHaveLength(fixture.connectionDates.length);
      expect(result.consistency, fixture.cadence).toEqual(expect.any(Number));
      expect(result.onTrack, fixture.cadence).toEqual(expect.any(Number));
      expect(result.health, fixture.cadence).toEqual(expect.any(Number));
      expect(result.scoringResult?.kind, fixture.cadence).toBe('rhythm-score');
      if (result.scoringResult?.kind === 'rhythm-score') {
        expect(result.scoringResult.consistency.kind, fixture.cadence).toBe('scored');
        expect(result.scoringResult.onTrack.kind, fixture.cadence).toBe('scored');
      }
    }
  });

  it('counts a completed past connection but excludes a future-dated connection from missed evidence', () => {
    let friendships = setFriendCadence(
      createFriendshipData(),
      'sample-person-avery',
      'daily',
      '2026-11-01'
    );
    friendships = addOrUpdateConnection(friendships, {
      id: 'connection-yesterday',
      type: 'time-together',
      date: '2026-11-10',
      participantIds: ['sample-person-avery']
    });
    const pastOnly = selectPersonConnectionHealth(
      'sample-person-avery',
      friendships,
      '2026-11-11',
      'UTC'
    );
    friendships = addOrUpdateConnection(friendships, {
      id: 'connection-tomorrow',
      type: 'call',
      date: '2026-11-12',
      participantIds: ['sample-person-avery']
    });
    const withFuture = selectPersonConnectionHealth(
      'sample-person-avery',
      friendships,
      '2026-11-11',
      'UTC'
    );

    expect(pastOnly.consistency).toEqual(expect.any(Number));
    expect(pastOnly.onTrack).toEqual(expect.any(Number));
    expect(withFuture.consistency).toBe(pastOnly.consistency);
    expect(withFuture.onTrack).toBe(pastOnly.onTrack);
    expect(withFuture.connectionIds).toEqual(['connection-tomorrow', 'connection-yesterday']);
    expect(withFuture.scoringResult?.kind).toBe('rhythm-score');
    if (withFuture.scoringResult?.kind === 'rhythm-score') {
      expect(withFuture.scoringResult.consistency.kind).toBe('scored');
      if (withFuture.scoringResult.consistency.kind === 'scored') {
        expect(withFuture.scoringResult.consistency.evidence.completedCount).toBe(1);
      }
      expect(withFuture.scoringResult.onTrack.kind).toBe('scored');
      if (withFuture.scoringResult.onTrack.kind === 'scored') {
        expect(withFuture.scoringResult.onTrack.evidence.missedOccurrenceCount).toBe(0);
      }
    }
  });

  it('scores pre-cadence connections inside the trailing window and excludes older history', () => {
    let friendships = setFriendCadence(
      createFriendshipData(),
      'sample-person-avery',
      'daily',
      '2026-11-10'
    );
    friendships = addOrUpdateConnection(friendships, {
      id: 'pre-cadence-in-window',
      type: 'call',
      date: '2026-11-09',
      participantIds: ['sample-person-avery']
    });
    friendships = addOrUpdateConnection(friendships, {
      id: 'outside-trailing-window',
      type: 'text',
      date: '2026-11-04',
      participantIds: ['sample-person-avery']
    });

    const result = selectPersonConnectionHealth(
      'sample-person-avery',
      friendships,
      '2026-11-11',
      'UTC'
    );

    expect(result.consistency).toEqual(expect.any(Number));
    expect(result.scoringResult?.kind).toBe('rhythm-score');
    if (result.scoringResult?.kind === 'rhythm-score'
      && result.scoringResult.consistency.kind === 'scored') {
      expect(result.scoringResult.consistency.evidence.completedCount).toBe(1);
      expect(result.scoringResult.consistency.evidence.windowStartDate).toBe('2026-11-05');
    } else {
      throw new Error('Expected scored Consistency evidence.');
    }

    const oldOnly = setFriendCadence(
      addOrUpdateConnection(createFriendshipData(), {
        id: 'outside-trailing-window-only',
        type: 'text',
        date: '2026-11-04',
        participantIds: ['sample-person-avery']
      }),
      'sample-person-avery',
      'daily',
      '2026-11-10'
    );
    const outsideWindow = selectPersonConnectionHealth(
      'sample-person-avery',
      oldOnly,
      '2026-11-11',
      'UTC'
    );
    expect(outsideWindow.scoringResult?.kind).toBe('rhythm-score');
    if (outsideWindow.scoringResult?.kind === 'rhythm-score'
      && outsideWindow.scoringResult.consistency.kind === 'scored') {
      expect(outsideWindow.scoringResult.consistency.evidence.completedCount).toBe(0);
    } else {
      throw new Error('Expected scored Consistency evidence for empty trailing history.');
    }
  });

  it('uses the Rhythms 10-point overdue decay for every connection cadence', () => {
    const fixtures: {
      cadence: ConnectionCadence;
      setOn: string;
      connectionDate: string;
      asOfDate: string;
    }[] = [
      { cadence: 'daily', setOn: '2026-11-01', connectionDate: '2026-11-09', asOfDate: '2026-11-11' },
      { cadence: 'weekly', setOn: '2026-10-28', connectionDate: '2026-10-28', asOfDate: '2026-11-10' },
      { cadence: 'twice-weekly', setOn: '2026-11-02', connectionDate: '2026-11-02', asOfDate: '2026-11-06' },
      { cadence: 'two-weeks', setOn: '2026-10-14', connectionDate: '2026-10-14', asOfDate: '2026-10-29' },
      { cadence: 'monthly', setOn: '2026-10-01', connectionDate: '2026-10-01', asOfDate: '2026-12-01' }
    ];

    for (const fixture of fixtures) {
      let friendships = setFriendCadence(
        createFriendshipData(),
        'sample-person-avery',
        fixture.cadence,
        fixture.setOn
      );
      friendships = addOrUpdateConnection(friendships, {
        id: `decay-${fixture.cadence}`,
        type: 'time-together',
        date: fixture.connectionDate,
        participantIds: ['sample-person-avery']
      });
      const result = selectPersonConnectionHealth(
        'sample-person-avery',
        friendships,
        fixture.asOfDate,
        'UTC'
      );

      expect(result.onTrack, fixture.cadence).toBe(90);
      expect(result.scoringResult?.kind, fixture.cadence).toBe('rhythm-score');
      if (result.scoringResult?.kind === 'rhythm-score'
        && result.scoringResult.onTrack.kind === 'scored') {
        expect(result.scoringResult.onTrack.evidence.pointsPerMissedOccurrence, fixture.cadence).toBe(10);
        expect(result.scoringResult.onTrack.evidence.missedOccurrenceCount, fixture.cadence).toBe(1);
      }
    }
  });

  it('starts caught-up at 100, resets on a connection today, and floors the shared decay at zero', () => {
    let friendships = setFriendCadence(
      createFriendshipData(),
      'sample-person-avery',
      'daily',
      '2026-11-01'
    );
    friendships = addOrUpdateConnection(friendships, {
      id: 'caught-up-yesterday',
      type: 'call',
      date: '2026-11-10',
      participantIds: ['sample-person-avery']
    });
    expect(selectPersonConnectionHealth('sample-person-avery', friendships, '2026-11-11', 'UTC').onTrack)
      .toBe(100);

    friendships = addOrUpdateConnection(friendships, {
      id: 'connection-today',
      type: 'text',
      date: '2026-11-11',
      participantIds: ['sample-person-avery']
    });
    expect(selectPersonConnectionHealth('sample-person-avery', friendships, '2026-11-11', 'UTC').onTrack)
      .toBe(100);

    const overdue = addOrUpdateConnection(createFriendshipData(), {
      id: 'ten-missed-periods',
      type: 'time-together',
      date: '2026-11-01',
      participantIds: ['sample-person-avery']
    });
    const withCadence = setFriendCadence(overdue, 'sample-person-avery', 'daily', '2026-11-01');
    const decayed = selectPersonConnectionHealth('sample-person-avery', withCadence, '2026-11-12', 'UTC');
    expect(decayed.onTrack).toBe(0);
    if (decayed.scoringResult?.kind === 'rhythm-score'
      && decayed.scoringResult.onTrack.kind === 'scored') {
      expect(decayed.scoringResult.onTrack.evidence.missedOccurrenceCount).toBe(10);
      expect(decayed.scoringResult.onTrack.evidence.deduction).toBe(100);
    } else {
      throw new Error('Expected scored On Track evidence.');
    }
  });

  it('keeps connection scoring unavailable only when no cadence is configured', () => {
    const friendships = addOrUpdateConnection(createFriendshipData(), {
      id: 'connection-without-cadence',
      type: 'text',
      date: '2026-11-10',
      participantIds: ['sample-person-avery']
    });
    const result = selectPersonConnectionHealth(
      'sample-person-avery',
      friendships,
      '2026-11-11',
      'UTC'
    );

    expect(result).toMatchObject({
      configured: false,
      connectionIds: ['connection-without-cadence'],
      consistency: null,
      onTrack: null,
      health: null,
      scoringResult: undefined
    });
  });
});
