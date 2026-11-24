import {
  POINTS_PER_CONSECUTIVE_MISS,
  scoreRhythm
} from '../../../src/scoring/engine.ts';
import type { RhythmSchedule, RhythmWeekday } from './rhythm-schedule.ts';
import { eligibleConnectionsForPerson } from './friendships.ts';
import type {
  ConnectionCadence,
  FriendshipConnection,
  FriendshipData
} from './friendships.ts';
import type { PersonId } from './preview-data.ts';
import { isValidDate } from './money-goals.ts';

export const PERSON_CONNECTION_HEALTH_SCORING_POLICY_VERSION = 1;

export type PersonConnectionHealthSelection = {
  personId: PersonId;
  cadence: ConnectionCadence | null;
  eligibleConnectionCount: number;
  latestConnection: FriendshipConnection | null;
  score: number | null;
  unavailableReason: string | null;
};

function weekdayForDate(date: string): RhythmWeekday {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay() as RhythmWeekday;
}

export function rhythmScheduleForConnectionCadence(
  cadence: ConnectionCadence,
  lastConnectedDate: string
): RhythmSchedule {
  const weekday = weekdayForDate(lastConnectedDate);
  if (cadence === 'daily') return { frequency: 'daily' };
  if (cadence === 'weekly') return { frequency: 'weekly', weekdays: [weekday] };
  if (cadence === 'two-weeks') {
    return {
      frequency: 'custom',
      unit: 'weeks',
      interval: 2,
      weekdays: [weekday],
      startDate: lastConnectedDate
    };
  }
  if (cadence === 'twice-weekly') {
    // Anchor the flexible two-day cadence to the last connection; weekly gaps alternate 3/4 days.
    const secondWeekday = (weekday + 3) % 7 as RhythmWeekday;
    return {
      frequency: 'weekly',
      weekdays: [weekday, secondWeekday].sort((left, right) => left - right)
    };
  }

  const [year, month, day] = lastConnectedDate.split('-').map(Number);
  const lastDayOfMonth = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  return {
    frequency: 'monthly',
    pattern: {
      kind: 'dayOfMonth',
      day: day === lastDayOfMonth ? 'last' : day!
    }
  };
}

function emptySelection(
  personId: PersonId,
  cadence: ConnectionCadence | null,
  eligibleConnectionCount: number,
  latestConnection: FriendshipConnection | null,
  unavailableReason: string
): PersonConnectionHealthSelection {
  return {
    personId,
    cadence,
    eligibleConnectionCount,
    latestConnection,
    score: null,
    unavailableReason
  };
}

export function selectPersonConnectionHealth(
  friendships: FriendshipData,
  personId: PersonId,
  asOfDate: string
): PersonConnectionHealthSelection {
  const cadenceSetting = friendships.cadenceSettings.find(setting => setting.personId === personId);
  const cadence = cadenceSetting?.cadence ?? null;
  const eligibleConnections = eligibleConnectionsForPerson(friendships, personId, asOfDate);
  const latestConnection = eligibleConnections[0] ?? null;
  const emptyReasons = [
    !cadence ? 'Set a connection frequency in Person settings to calculate Connection Health.' : null,
    eligibleConnections.length === 0 ? 'No connections yet.' : null
  ].filter((reason): reason is string => reason !== null);

  if (!isValidDate(asOfDate)) {
    return emptySelection(
      personId,
      cadence,
      0,
      null,
      'Connection Health is unavailable because the current date is invalid.'
    );
  }
  if (cadenceSetting && cadenceSetting.setOn > asOfDate) {
    return emptySelection(
      personId,
      cadence,
      eligibleConnections.length,
      latestConnection,
      [
        `Connection frequency starts on ${cadenceSetting.setOn}.`,
        ...(eligibleConnections.length === 0 ? ['No connections yet.'] : [])
      ].join(' ')
    );
  }
  if (!cadence || !latestConnection) {
    return emptySelection(
      personId,
      cadence,
      eligibleConnections.length,
      latestConnection,
      emptyReasons.join(' ')
    );
  }

  const score = scoreRhythm({
    rhythmId: `person-connection-health:${personId}`,
    schedule: rhythmScheduleForConnectionCadence(cadence, latestConnection.date),
    createdDate: latestConnection.date,
    completionDates: [latestConnection.date],
    asOfDate
  });
  if (score.onTrack.kind !== 'scored') {
    return emptySelection(
      personId,
      cadence,
      eligibleConnections.length,
      latestConnection,
      `Connection Health is unavailable: ${score.onTrack.reason}.`
    );
  }

  return {
    personId,
    cadence,
    eligibleConnectionCount: eligibleConnections.length,
    latestConnection,
    score: score.onTrack.score,
    unavailableReason: null
  };
}

export const PERSON_CONNECTION_HEALTH_SCORING_EXPLANATION =
  `Connection Health starts at 100 after the latest eligible Connection, loses ${POINTS_PER_CONSECUTIVE_MISS} points for each missed Rhythm frequency occurrence, resets after a new Connection, and never falls below zero.`;
