import { isValidDate } from './money-goals.ts';
import type { PersonId } from './preview-data.ts';
import {
  localDateInTimeZone,
  localTimeInTimeZone,
  selectRhythmScore
} from './rhythm-scoring.ts';
import type { RhythmScoreResult, UnscoredMetric } from './rhythm-scoring.ts';
import { isValidTimeZone, validateRhythmSchedule } from './rhythm-schedule.ts';
import { personPrayerRequestsForPerson } from './person-prayers.ts';
import type { PersonPrayerRequest } from './person-prayers.ts';
import { DEFAULT_TIME_BLOCK_SETTINGS, timeBlockIdFromRhythmValue } from './time-blocks.ts';
import type { TimeBlockSettings } from './time-blocks.ts';

export const PERSON_PRAYER_HEALTH_SCORING_POLICY_VERSION = 2;

export type PersonPrayerRequestHealth = {
  requestId: string;
  title: string;
  status: PersonPrayerRequest['status'];
  score: number | null;
  scoreResult: RhythmScoreResult;
  latestPrayerDate: string | null;
  unavailableReason: string | null;
};

export type PersonPrayerHealthSelection = {
  personId: PersonId;
  activeRequestIds: readonly string[];
  scoredRequestIds: readonly string[];
  missingFrequencyRequestIds: readonly string[];
  noHistoryRequestIds: readonly string[];
  unsupportedScheduleRequestIds: readonly string[];
  requests: readonly PersonPrayerRequestHealth[];
  score: number | null;
  unavailableReason: string | null;
};

type EligiblePrayerHistory = {
  records: { id: string; rhythmId: string; effectiveDate: string }[];
  latestPrayerDate: string | null;
  undatedCount: number;
  malformedCount: number;
  futureCount: number;
  preRequestCount: number;
};

function isCanonicalPrayerTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return false;
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime())) return false;
  const canonical = timestamp.toISOString();
  return canonical === value || canonical.replace(/\.000Z$/, 'Z') === value;
}

function eligiblePrayerHistory(
  request: PersonPrayerRequest,
  asOfDate: string,
  asOfInstant: Date,
  timeZone: string,
  createdAt: Date
): EligiblePrayerHistory {
  const rhythmId = `person-prayer-health:${request.id}`;
  const createdAtInstant = createdAt.getTime();
  const createdDate = localDateInTimeZone(createdAt, timeZone);
  const records: EligiblePrayerHistory['records'] = [];
  let latestPrayerDate: string | null = null;
  let undatedCount = 0;
  let malformedCount = 0;
  let futureCount = 0;
  let preRequestCount = 0;

  for (const log of request.prayerLogs) {
    if (log.prayedAt === undefined && log.prayedOn === undefined) {
      undatedCount += 1;
      continue;
    }
    if (log.prayedAt !== undefined && log.prayedOn !== undefined) {
      malformedCount += 1;
      continue;
    }

    let effectiveDate: string;
    if (log.prayedOn !== undefined) {
      if (!isValidDate(log.prayedOn)) {
        malformedCount += 1;
        continue;
      }
      effectiveDate = log.prayedOn;
    } else {
      if (!isCanonicalPrayerTimestamp(log.prayedAt!)) {
        malformedCount += 1;
        continue;
      }
      const instant = Date.parse(log.prayedAt!);
      if (instant > asOfInstant.getTime()) {
        futureCount += 1;
        continue;
      }
      if (instant < createdAtInstant) {
        preRequestCount += 1;
        continue;
      }
      effectiveDate = localDateInTimeZone(new Date(instant), timeZone);
    }

    if (effectiveDate > asOfDate) {
      futureCount += 1;
      continue;
    }
    if (effectiveDate < createdDate) {
      preRequestCount += 1;
      continue;
    }
    records.push({ id: log.id, rhythmId, effectiveDate });
    if (latestPrayerDate === null || effectiveDate > latestPrayerDate) {
      latestPrayerDate = effectiveDate;
    }
  }

  return {
    records,
    latestPrayerDate,
    undatedCount,
    malformedCount,
    futureCount,
    preRequestCount
  };
}

function unscoredResult(
  asOfDate: string,
  timeZone: string,
  reasonCode: UnscoredMetric['reasonCode'],
  explanation: string
): RhythmScoreResult {
  const reason: UnscoredMetric = { kind: 'unscored', reasonCode, explanation };
  return {
    kind: 'unscored',
    asOfDate,
    timeZone,
    reason,
    consistency: reason,
    onTrack: reason,
    healthScore: null
  };
}

function resultUnavailableReason(result: RhythmScoreResult): string | null {
  if (result.kind === 'invalid') {
    return `Prayer Health is unavailable: ${result.reason.replaceAll('Rhythm', 'prayer request')}`;
  }
  if (result.kind === 'unscored') {
    if (result.reason.reasonCode === 'unsupported-schedule') return 'Set prayer frequency to calculate Health.';
    return result.reason.explanation
      .replaceAll('This Rhythm has ended', 'This prayer schedule has ended')
      .replaceAll('This Rhythm is inactive', 'This prayer request is inactive')
      .replaceAll('This Rhythm', 'This prayer request')
      .replaceAll('Rhythm’s', 'prayer request’s')
      .replaceAll('your first Tend', 'your first prayer')
      .replaceAll('first Tend', 'first prayer')
      .replaceAll('scheduled moments', 'scheduled prayer opportunities');
  }
  if (result.healthScore !== null) return null;
  const explanations = [
    result.consistency.kind === 'unscored' ? result.consistency.explanation : null,
    result.onTrack.kind === 'unscored' ? result.onTrack.explanation : null
  ].filter((value): value is string => value !== null);
  return explanations.length > 0
    ? `Prayer Health is unavailable: ${[...new Set(explanations)].join(' ')}`
    : 'Prayer Health is unavailable because its scoring evidence is incomplete.';
}

function requestHealth(
  request: PersonPrayerRequest,
  asOfDate: string,
  asOfInstant: Date,
  timeZone: string,
  timeBlockSettings: TimeBlockSettings
): PersonPrayerRequestHealth {
  const rhythmId = `person-prayer-health:${request.id}`;
  const createdAt = new Date(request.createdAt);
  const scoreTimeZone = request.scoring?.timeZone ?? timeZone;
  if (!isValidTimeZone(scoreTimeZone)) {
    const scoreResult = unscoredResult(
      asOfDate,
      timeZone,
      'unsupported-history',
      'The Prayer schedule time zone is unavailable, so its history cannot be scored.'
    );
    return {
      requestId: request.id,
      title: request.title,
      status: request.status,
      score: null,
      scoreResult,
      latestPrayerDate: null,
      unavailableReason: resultUnavailableReason(scoreResult)
    };
  }
  const scoreAsOfDate = request.scoring
    ? localDateInTimeZone(asOfInstant, scoreTimeZone)
    : asOfDate;
  if (!Number.isFinite(createdAt.getTime())) {
    const scoreResult = unscoredResult(
      scoreAsOfDate,
      scoreTimeZone,
      'unsupported-history',
      'The request creation date is unavailable, so its prayer history cannot be scored.'
    );
    return {
      requestId: request.id,
      title: request.title,
      status: request.status,
      score: null,
      scoreResult,
      latestPrayerDate: null,
      unavailableReason: resultUnavailableReason(scoreResult)
    };
  }
  const createdLocalDate = localDateInTimeZone(createdAt, scoreTimeZone);
  const history = eligiblePrayerHistory(request, scoreAsOfDate, asOfInstant, scoreTimeZone, createdAt);
  let scoreResult: RhythmScoreResult;
  let unavailableReason: string | null;

  if (request.status !== 'active') {
    scoreResult = unscoredResult(
      scoreAsOfDate,
      scoreTimeZone,
      'inactive',
      'This prayer request is not active, so its Health is not accruing.'
    );
    unavailableReason = 'This request is not active and does not contribute to Prayer Health.';
  } else if (!request.schedule) {
    scoreResult = unscoredResult(
      scoreAsOfDate,
      scoreTimeZone,
      'unsupported-schedule',
      'Set prayer frequency to calculate Health.'
    );
    unavailableReason = 'Set prayer frequency.';
  } else {
    const schedule = validateRhythmSchedule(request.schedule);
    if (!schedule.valid) {
      scoreResult = unscoredResult(
        scoreAsOfDate,
        scoreTimeZone,
        'unsupported-schedule',
        'The saved prayer frequency is unsupported and cannot be scored.'
      );
      unavailableReason = 'The saved prayer frequency is unsupported.';
    } else {
      const blockId = request.timeOfDay
        ? timeBlockIdFromRhythmValue(request.timeOfDay)
        : undefined;
      const timeBlock = blockId
        ? timeBlockSettings.blocks.find(block => block.id === blockId)
        : undefined;
      if (blockId && !timeBlock) {
        const reason = 'The saved prayer time block is not configured, so its scoring boundary is unavailable.';
        scoreResult = unscoredResult(
          scoreAsOfDate,
          scoreTimeZone,
          'unsupported-history',
          reason
        );
        unavailableReason = reason;
      } else if (history.records.length === 0 && request.prayerLogs.length > 0) {
        const reason = history.undatedCount > 0 || history.malformedCount > 0
          ? 'Saved prayer history has no usable date, so Health cannot be scored.'
          : history.futureCount > 0
            ? 'No eligible prayer history is recorded as of today.'
            : history.preRequestCount > 0
              ? 'Prayer entries before this request was created are excluded from Health.'
              : 'No eligible dated prayer history is available.';
        scoreResult = unscoredResult(scoreAsOfDate, scoreTimeZone, 'unsupported-history', reason);
        unavailableReason = reason;
      } else {
        scoreResult = selectRhythmScore({
          rhythmId,
          schedule: schedule.schedule,
          createdLocalDate,
          createdTimeZone: scoreTimeZone,
          records: history.records,
          recordsAvailable: true,
          ...(timeBlock ? {
            asOfTime: localTimeInTimeZone(asOfInstant, scoreTimeZone),
            dueTime: timeBlock.start
          } : {}),
          ...(request.scoring ? { scoring: request.scoring } : {}),
          asOfDate: scoreAsOfDate,
          timeZone: scoreTimeZone
        });

        if (history.records.length === 0
          && scoreResult.kind !== 'unscored'
          && scoreResult.kind !== 'invalid') {
          scoreResult = unscoredResult(
            scoreAsOfDate,
            scoreTimeZone,
            'ready-for-first-tend',
            'Ready for your first prayer.'
          );
        }
        unavailableReason = resultUnavailableReason(scoreResult);
      }
    }
  }

  return {
    requestId: request.id,
    title: request.title,
    status: request.status,
    score: scoreResult.kind === 'rhythm-score' ? scoreResult.healthScore : null,
    scoreResult,
    latestPrayerDate: history.latestPrayerDate,
    unavailableReason
  };
}

export function selectPersonPrayerHealth(
  requests: readonly PersonPrayerRequest[],
  personId: PersonId,
  asOfDate: string,
  timeZone: string,
  asOfInstant = new Date(),
  timeBlockSettings: TimeBlockSettings = DEFAULT_TIME_BLOCK_SETTINGS
): PersonPrayerHealthSelection {
  const relatedRequests = personPrayerRequestsForPerson(requests, personId);
  const activeRequests = relatedRequests.filter(request => request.status === 'active');
  const emptySelection = (
    unavailableReason: string
  ): PersonPrayerHealthSelection => ({
    personId,
    activeRequestIds: activeRequests.map(request => request.id),
    scoredRequestIds: [],
    missingFrequencyRequestIds: [],
    noHistoryRequestIds: [],
    unsupportedScheduleRequestIds: [],
    requests: [],
    score: null,
    unavailableReason
  });

  if (!isValidDate(asOfDate)) {
    return emptySelection('Prayer Health is unavailable because the current date is invalid.');
  }
  if (!isValidTimeZone(timeZone) || !Number.isFinite(asOfInstant.getTime())) {
    return emptySelection('Prayer Health is unavailable because its local date or time zone is invalid.');
  }

  const requestResults = relatedRequests.map(request =>
    requestHealth(request, asOfDate, asOfInstant, timeZone, timeBlockSettings)
  );
  const activeResults = requestResults.filter(request => request.status === 'active');
  const scored = activeResults.filter(
    (request): request is PersonPrayerRequestHealth & { score: number } =>
      request.score !== null && Number.isFinite(request.score)
  );
  const missingFrequencyRequestIds = activeResults
    .filter(request => request.unavailableReason === 'Set prayer frequency.')
    .map(request => request.requestId);
  const noHistoryRequestIds = activeResults
    .filter(request => request.unavailableReason?.startsWith('Ready for your first prayer')
      || request.unavailableReason?.toLowerCase().includes('no eligible')
      || request.unavailableReason?.toLowerCase().includes('no usable date'))
    .map(request => request.requestId);
  const unsupportedScheduleRequestIds = activeResults
    .filter(request => request.unavailableReason?.includes('unsupported'))
    .map(request => request.requestId);
  const score = scored.length > 0
    ? scored.reduce((total, request) => total + request.score, 0) / scored.length
    : null;
  const otherUnavailable = activeResults
    .filter(request => request.score === null
      && !missingFrequencyRequestIds.includes(request.requestId)
      && !noHistoryRequestIds.includes(request.requestId)
      && !unsupportedScheduleRequestIds.includes(request.requestId))
    .map(request => request.unavailableReason)
    .filter((reason): reason is string => reason !== null);
  const unavailableParts = [
    missingFrequencyRequestIds.length > 0
      ? `${missingFrequencyRequestIds.length} active ${missingFrequencyRequestIds.length === 1 ? 'request needs' : 'requests need'} a prayer frequency.`
      : null,
    noHistoryRequestIds.length > 0
      ? `${noHistoryRequestIds.length} active ${noHistoryRequestIds.length === 1 ? 'request has' : 'requests have'} no complete eligible prayer history.`
      : null,
    unsupportedScheduleRequestIds.length > 0
      ? `${unsupportedScheduleRequestIds.length} active ${unsupportedScheduleRequestIds.length === 1 ? 'request has' : 'requests have'} an unsupported saved schedule.`
      : null,
    ...[...new Set(otherUnavailable)]
  ].filter((part): part is string => part !== null);

  return {
    personId,
    activeRequestIds: activeRequests.map(request => request.id),
    scoredRequestIds: scored.map(request => request.requestId),
    missingFrequencyRequestIds,
    noHistoryRequestIds,
    unsupportedScheduleRequestIds,
    requests: requestResults,
    score,
    unavailableReason: score === null
      ? unavailableParts.join(' ') || 'No active scheduled prayer requests are available.'
      : unavailableParts.length > 0
        ? `Available active prayer request Health scores are averaged equally. ${unavailableParts.join(' ')}`
        : 'Available active prayer request Health scores are averaged equally.'
  };
}
