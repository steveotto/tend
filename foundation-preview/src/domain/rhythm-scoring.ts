import { isValidDate } from './money-goals.ts';
import type { RhythmCompletionRecord } from './rhythm-completion.ts';
import { HEALTH_CONSISTENCY_WEIGHT, HEALTH_ON_TRACK_WEIGHT, calculateBlendedHealth } from './rhythm-history.ts';
import {
  addCalendarDays,
  calendarDaysInclusive,
  dateParts,
  daysInMonth,
  isScheduledDate,
  rhythmSchedulesEqual
} from './rhythm-occurrences.ts';
export { addCalendarDays, localDateInTimeZone } from './rhythm-occurrences.ts';
import {
  isValidTimeZone,
  validateRhythmScoringMetadata
} from './rhythm-schedule.ts';
import type { RhythmSchedule, RhythmScoringMetadata, RhythmScheduleSegment } from './rhythm-schedule.ts';

export type UnscoredReasonCode =
  | 'ready-for-first-tend'
  | 'unsupported-schedule'
  | 'unsupported-history'
  | 'no-eligible-occurrences'
  | 'not-started'
  | 'inactive'
  | 'history-unavailable'
  | 'timezone-uncertain';

export type UnscoredMetric = {
  kind: 'unscored';
  reasonCode: UnscoredReasonCode;
  explanation: string;
};

export type ScheduledOccurrenceState = {
  date: string;
  status: 'completed' | 'not-completed';
  recordIds: readonly string[];
};

export type ConsistencyEvidence = {
  frequency: Exclude<RhythmSchedule['frequency'], 'custom'>;
  windowStartDate: string;
  windowEndDate: string;
  eligibleDueCount: number;
  completedCount: number;
  notCompletedCount: number;
  limitedHistoryDays: number | null;
  todayIncluded: boolean;
  occurrences: readonly ScheduledOccurrenceState[];
};

export type ScoredConsistencyMetric = {
  kind: 'scored';
  score: number;
  exactPercent: number;
  evidence: ConsistencyEvidence;
};

export type OnTrackOccurrence = {
  date: string;
  status: 'completed' | 'missed' | 'today';
  score: number;
};

export type OnTrackZeroScoreSpan = {
  startDate: string;
  endDate: string;
  occurrenceCount: number;
};

export type OnTrackScheduleChange = {
  date: string;
  score: number;
};

export type OnTrackEvidence = {
  lastQualifyingCompletionDate: string | null;
  missedOccurrenceCount: number;
  pointsPerMissedOccurrence: 10;
  deduction: number;
  occurrences: readonly OnTrackOccurrence[];
  repeatedZeroScoreSpans: readonly OnTrackZeroScoreSpan[];
  scheduleChanges: readonly OnTrackScheduleChange[];
};

export type ScoredOnTrackMetric = {
  kind: 'scored';
  score: number;
  evidence: OnTrackEvidence;
};

export type RhythmScoreSelection = {
  kind: 'rhythm-score';
  asOfDate: string;
  timeZone: string;
  trackingStartDate: string | null;
  consistency: ScoredConsistencyMetric | UnscoredMetric;
  onTrack: ScoredOnTrackMetric | UnscoredMetric;
  healthScore: number | null;
};

export type UnscoredRhythmSelection = {
  kind: 'unscored';
  asOfDate: string;
  timeZone: string;
  reason: UnscoredMetric;
  consistency: UnscoredMetric;
  onTrack: UnscoredMetric;
  healthScore: null;
};

export type InvalidRhythmSelection = {
  kind: 'invalid';
  asOfDate: string;
  timeZone: string;
  reason: string;
  consistency: UnscoredMetric;
  onTrack: UnscoredMetric;
  healthScore: null;
};

export type RhythmScoreResult =
  | RhythmScoreSelection
  | UnscoredRhythmSelection
  | InvalidRhythmSelection;

export type SelectRhythmScoreInput = {
  rhythmId: string;
  cadence?: string;
  schedule?: RhythmSchedule;
  scoring?: RhythmScoringMetadata;
  createdLocalDate?: string;
  createdTimeZone?: string;
  dailyBackfillAllowed?: boolean;
  records: readonly RhythmCompletionRecord[];
  recordsAvailable: boolean;
  archived?: boolean;
  asOfDate: string;
  timeZone: string;
};

export type UnscoredDailyRhythmSelection = UnscoredRhythmSelection;
export type InvalidDailyRhythmSelection = InvalidRhythmSelection;
export type DailyRhythmScoreResult = RhythmScoreResult;
export type SelectDailyRhythmScoreInput = SelectRhythmScoreInput;

const deductionPerMissedOccurrence = 10 as const;

function unscored(reasonCode: UnscoredReasonCode, explanation: string): UnscoredMetric {
  return { kind: 'unscored', reasonCode, explanation };
}

function baseUnscored(
  input: Pick<SelectRhythmScoreInput, 'asOfDate' | 'timeZone'>,
  reason: UnscoredMetric
): UnscoredRhythmSelection {
  return {
    kind: 'unscored',
    asOfDate: input.asOfDate,
    timeZone: input.timeZone,
    reason,
    consistency: reason,
    onTrack: reason,
    healthScore: null
  };
}

function invalid(
  input: Pick<SelectRhythmScoreInput, 'asOfDate' | 'timeZone'>,
  reason: string
): InvalidRhythmSelection {
  const metric = unscored('unsupported-history', reason);
  return {
    kind: 'invalid',
    asOfDate: input.asOfDate,
    timeZone: input.timeZone,
    reason,
    consistency: metric,
    onTrack: metric,
    healthScore: null
  };
}

function previousDate(value: string): string {
  return addCalendarDays(value, -1);
}

function addCalendarMonths(value: string, amount: number): string {
  const { year, month, day } = dateParts(value);
  const monthIndex = year * 12 + month - 1 + amount;
  const nextYear = Math.floor(monthIndex / 12);
  const nextMonth = (monthIndex % 12) + 1;
  return [
    String(nextYear).padStart(4, '0'),
    String(nextMonth).padStart(2, '0'),
    String(Math.min(day, daysInMonth(nextYear, nextMonth))).padStart(2, '0')
  ].join('-');
}

function consistencyScheduleSupported(
  schedule: RhythmSchedule
): schedule is Exclude<RhythmSchedule, { frequency: 'custom' }> {
  return schedule.frequency !== 'custom';
}

function maximumWindowStart(schedule: Exclude<RhythmSchedule, { frequency: 'custom' }>, asOfDate: string): string {
  if (schedule.frequency === 'daily') return addCalendarDays(asOfDate, -29);
  if (schedule.frequency === 'weekly' && schedule.weekdays.length > 1) {
    return addCalendarDays(asOfDate, -30);
  }
  if (schedule.frequency === 'weekly') return addCalendarDays(asOfDate, -84);
  if (schedule.frequency === 'monthly') return addCalendarMonths(asOfDate, -6);
  if (schedule.frequency === 'quarterly') return addCalendarMonths(asOfDate, -12);
  return addCalendarMonths(asOfDate, -24);
}

function validateInput(input: SelectRhythmScoreInput): string | null {
  if (!input.rhythmId.trim()) return 'The Rhythm identity is missing.';
  if (!isValidDate(input.asOfDate)) return 'The scoring as-of date is invalid.';
  if (!isValidTimeZone(input.timeZone)) return 'The scoring time zone is invalid.';
  if ((input.createdLocalDate === undefined) !== (input.createdTimeZone === undefined)
    || input.createdLocalDate !== undefined
      && (!isValidDate(input.createdLocalDate) || !isValidTimeZone(input.createdTimeZone))) {
    return 'Rhythm creation date or time zone metadata is invalid.';
  }
  if (input.dailyBackfillAllowed !== undefined && typeof input.dailyBackfillAllowed !== 'boolean') {
    return 'Rhythm daily backfill metadata is invalid.';
  }
  if (!Array.isArray(input.records)) return 'Completion records are invalid.';
  const recordIds = new Set<string>();
  for (const record of input.records) {
    if (record.rhythmId !== input.rhythmId) continue;
    if (!isValidDate(record.effectiveDate) || !record.id.trim() || recordIds.has(record.id)) {
      return 'A dated completion has an invalid identity or effective local date.';
    }
    recordIds.add(record.id);
  }
  return null;
}

function failureForHistory(
  scheduleForDate: (date: string) => RhythmSchedule | undefined,
  firstDate: string,
  lastDate: string
): UnscoredMetric | null {
  for (let date = firstDate; date <= lastDate; date = addCalendarDays(date, 1)) {
    const schedule = scheduleForDate(date);
    if (!schedule) {
      return unscored('unsupported-history', 'The schedule history does not cover the full scoring window.');
    }
    if (!consistencyScheduleSupported(schedule)) {
      return unscored('unsupported-history', 'Consistency has no approved lookback policy for Custom intervals.');
    }
  }
  return null;
}

function occurrenceHistoryFailure(
  scheduleForDate: (date: string) => RhythmSchedule | undefined,
  firstDate: string,
  lastDate: string
): UnscoredMetric | null {
  for (let date = firstDate; date <= lastDate; date = addCalendarDays(date, 1)) {
    if (!scheduleForDate(date)) {
      return unscored(
        'unsupported-history',
      'The schedule history does not cover part of the On Track period, so missed occurrences cannot be reconstructed.'
      );
    }
  }
  return null;
}

export function selectRhythmScore(input: SelectRhythmScoreInput): RhythmScoreResult {
  const invalidReason = validateInput(input);
  if (invalidReason) return invalid(input, invalidReason);

  if (input.archived) {
    return baseUnscored(input, unscored('inactive', 'This Rhythm is inactive, so its score is not accruing.'));
  }
  const schedule = input.schedule ?? (input.cadence === 'Daily' ? { frequency: 'daily' as const } : undefined);
  if (!schedule) {
    if (input.scoring) return invalid(input, 'Scoring metadata exists without a current supported schedule.');
    return baseUnscored(input, unscored(
      'unsupported-schedule',
      'Choose a schedule to calculate On Track. Descriptive cadence alone does not define due dates.'
    ));
  }
  if (schedule.endDate !== undefined && schedule.endDate < input.asOfDate) {
    return baseUnscored(input, unscored('inactive', 'This Rhythm has ended, so its score is not accruing.'));
  }
  if (!input.recordsAvailable) {
    return baseUnscored(input, unscored('history-unavailable', 'Completion history is unavailable, so this Rhythm cannot be scored.'));
  }
  let segments: readonly RhythmScheduleSegment[] = [];
  if (input.scoring) {
    const { timeZone, scheduleHistory } = input.scoring;
    if (!input.schedule || !validateRhythmScoringMetadata(input.scoring)
      || !isValidTimeZone(timeZone) || input.timeZone !== timeZone
      || scheduleHistory.length === 0 || scheduleHistory[0]?.startDate !== input.scoring.trackingStartDate) {
      return invalid(input, 'Scoring metadata or schedule history is malformed.');
    }
    const latestSegment = scheduleHistory.at(-1);
    if (!latestSegment || latestSegment.endDate !== undefined) {
      return invalid(input, 'Schedule history has no current segment.');
    }
    if (!rhythmSchedulesEqual(latestSegment.schedule, schedule)) {
      return invalid(input, 'The current schedule does not match the final saved schedule-history segment.');
    }
    segments = scheduleHistory;
  }

  const datedRecords = input.records.filter(record => record.rhythmId === input.rhythmId
    && record.effectiveDate <= input.asOfDate);
  const oldestCompletionDate = datedRecords.map(record => record.effectiveDate).sort()[0];
  const trackingStartDate = [
    input.createdLocalDate,
    oldestCompletionDate
  ].filter((date): date is string => date !== undefined).sort()[0] ?? null;
  if (trackingStartDate && trackingStartDate > input.asOfDate) {
    return baseUnscored(input, unscored('not-started', 'This Rhythm’s tracking date is in the future.'));
  }

  const scheduleForDate = (date: string): RhythmSchedule | undefined => {
    if (!input.scoring) return trackingStartDate && date >= trackingStartDate ? schedule : undefined;
    const historicalSchedule = segments.find(segment => segment.startDate <= date
      && (segment.endDate === undefined || date <= segment.endDate))?.schedule;
    if (historicalSchedule) return historicalSchedule;
    const firstSegment = segments[0];
    const canUseUnchangedDailyScheduleBeforeHistory = firstSegment
      && segments.length === 1
      && firstSegment.schedule.frequency === 'daily'
      && input.dailyBackfillAllowed !== false
      && (input.createdLocalDate === firstSegment.startDate
        || input.scoring.trackingStartDate < input.asOfDate)
      && trackingStartDate !== null
      && date >= trackingStartDate
      && date < firstSegment.startDate;
    return canUseUnchangedDailyScheduleBeforeHistory ? firstSegment.schedule : undefined;
  };
  const yesterday = previousDate(input.asOfDate);
  let consistency: ScoredConsistencyMetric | UnscoredMetric;
  if (!consistencyScheduleSupported(schedule)) {
    consistency = unscored(
      'unsupported-schedule',
      'Consistency for Custom intervals is unavailable because a lookback policy has not been approved.'
    );
  } else if (!trackingStartDate) {
    consistency = unscored('ready-for-first-tend', 'Ready for your first Tend.');
  } else if (trackingStartDate === input.asOfDate
    && !datedRecords.some(record => record.effectiveDate === input.asOfDate
      && scheduleForDate(record.effectiveDate) !== undefined
      && isScheduledDate(scheduleForDate(record.effectiveDate)!, record.effectiveDate) === true)) {
    const todaySchedule = scheduleForDate(input.asOfDate);
    consistency = todaySchedule && isScheduledDate(todaySchedule, input.asOfDate)
      ? unscored('ready-for-first-tend', 'Ready for your first Tend.')
      : unscored('no-eligible-occurrences', 'No scheduled moments to measure yet.');
  } else {
    const completedToday = datedRecords.some(record => record.effectiveDate === input.asOfDate
      && scheduleForDate(record.effectiveDate) !== undefined
      && isScheduledDate(scheduleForDate(record.effectiveDate)!, record.effectiveDate) === true);
    const maxWindowStartDate = maximumWindowStart(schedule, input.asOfDate);
    const windowStartDate = trackingStartDate > maxWindowStartDate ? trackingStartDate : maxWindowStartDate;
    const todayIncluded = schedule.frequency === 'daily' && completedToday;
    const windowEndDate = todayIncluded ? input.asOfDate : yesterday;
    if (windowStartDate > windowEndDate) {
      consistency = unscored(
        'no-eligible-occurrences',
        'No scheduled moments to measure yet.'
      );
    } else {
      const historyFailure = failureForHistory(scheduleForDate, windowStartDate, windowEndDate);
      if (historyFailure) {
        consistency = input.scoring && windowStartDate < (segments[0]?.startDate ?? input.asOfDate)
          ? unscored('unsupported-history', 'A schedule change leaves earlier dates without a known schedule; those occurrences cannot be reconstructed.')
          : historyFailure;
      } else {
        const completedRecords = new Map<string, string[]>();
        for (const record of datedRecords) {
          if (record.effectiveDate < windowStartDate
            || record.effectiveDate > windowEndDate) continue;
          const recordSchedule = scheduleForDate(record.effectiveDate);
          if (!recordSchedule || !consistencyScheduleSupported(recordSchedule)) continue;
          if (isScheduledDate(recordSchedule, record.effectiveDate) !== true) continue;
          const ids = completedRecords.get(record.effectiveDate) ?? [];
          ids.push(record.id);
          completedRecords.set(record.effectiveDate, ids);
        }
        const occurrences: ScheduledOccurrenceState[] = [];
        for (let date = windowStartDate; date <= windowEndDate; date = addCalendarDays(date, 1)) {
          const scheduled = scheduleForDate(date);
          if (!scheduled || !consistencyScheduleSupported(scheduled)) continue;
          if (isScheduledDate(scheduled, date) !== true) continue;
          const recordIds = completedRecords.get(date) ?? [];
          occurrences.push({
            date,
            status: recordIds.length > 0 ? 'completed' : 'not-completed',
            recordIds
          });
        }
        const completedCount = occurrences.filter(item => item.status === 'completed').length;
        if (occurrences.length === 0) {
          consistency = unscored('no-eligible-occurrences', 'No scheduled moments to measure yet.');
        } else {
          const exactPercent = (completedCount / occurrences.length) * 100;
          consistency = {
            kind: 'scored',
            score: exactPercent,
            exactPercent,
            evidence: {
              frequency: schedule.frequency,
              windowStartDate,
              windowEndDate,
              eligibleDueCount: occurrences.length,
              completedCount,
              notCompletedCount: occurrences.length - completedCount,
              limitedHistoryDays: trackingStartDate > maxWindowStartDate
                ? schedule.frequency === 'daily'
                  ? occurrences.length
                  : calendarDaysInclusive(windowStartDate, windowEndDate)
                : null,
              todayIncluded,
              occurrences
            }
          };
        }
      }
    }
  }

  let onTrack: ScoredOnTrackMetric | UnscoredMetric;
  const scoringTimeZone = new Intl.DateTimeFormat('en-US', { timeZone: input.timeZone }).resolvedOptions().timeZone;
  const timezoneMismatch = !input.scoring && datedRecords.some(record => {
    if (record.rhythmId !== input.rhythmId || record.timeZone === undefined) return false;
    if (!isValidTimeZone(record.timeZone)) return true;
    return new Intl.DateTimeFormat('en-US', { timeZone: record.timeZone }).resolvedOptions().timeZone
      !== scoringTimeZone;
  });
  if (timezoneMismatch) {
    onTrack = unscored(
      'timezone-uncertain',
      'On Track is unavailable because completion time zones do not match the Rhythm’s scoring time zone.'
    );
  } else {
    const qualifyingDates = new Set<string>();
    for (const record of datedRecords) {
      if (!trackingStartDate || record.effectiveDate < trackingStartDate) continue;
      const recordSchedule = scheduleForDate(record.effectiveDate);
      if (recordSchedule && isScheduledDate(recordSchedule, record.effectiveDate)) {
        qualifyingDates.add(record.effectiveDate);
      }
    }
    const lastQualifyingCompletionDate = [...qualifyingDates].sort().at(-1) ?? null;
    if (!trackingStartDate) {
      onTrack = unscored('ready-for-first-tend', 'Starts with your first Tend.');
    } else {
      const overdueStartDate = lastQualifyingCompletionDate
        ? addCalendarDays(lastQualifyingCompletionDate, 1)
        : trackingStartDate;
      const historyFailure = overdueStartDate <= yesterday
        ? occurrenceHistoryFailure(scheduleForDate, overdueStartDate, yesterday)
        : null;
      if (historyFailure) {
        onTrack = historyFailure;
      } else {
        const repeatedZeroScoreSpans: OnTrackZeroScoreSpan[] = [];
        const scheduleChanges: OnTrackScheduleChange[] = [];
        const occurrences: OnTrackOccurrence[] = [];
        let zeroScoreSpanStart: string | null = null;
        let zeroScoreSpanEnd: string | null = null;
        let zeroScoreSpanCount = 0;
        let missedOccurrenceCount = 0;
        let previousScore = 100;
        const flushZeroScoreSpan = () => {
          if (zeroScoreSpanStart && zeroScoreSpanEnd && zeroScoreSpanCount > 0) {
            repeatedZeroScoreSpans.push({
              startDate: zeroScoreSpanStart,
              endDate: zeroScoreSpanEnd,
              occurrenceCount: zeroScoreSpanCount
            });
          }
          zeroScoreSpanStart = null;
          zeroScoreSpanEnd = null;
          zeroScoreSpanCount = 0;
        };
        const scheduleChangedOn = (date: string) => {
          const segmentIndex = segments.findIndex(segment => segment.startDate === date);
          if (segmentIndex <= 0) return false;
          const previousSchedule = segments[segmentIndex - 1]?.schedule;
          const currentSegmentSchedule = segments[segmentIndex]?.schedule;
          return previousSchedule !== undefined && currentSegmentSchedule !== undefined
            && !rhythmSchedulesEqual(previousSchedule, currentSegmentSchedule);
        };

        for (let date = trackingStartDate; date < input.asOfDate; date = addCalendarDays(date, 1)) {
          const daySchedule = scheduleForDate(date);
          if (scheduleChangedOn(date)) {
            flushZeroScoreSpan();
            scheduleChanges.push({ date, score: previousScore });
          }
          if (!daySchedule || !isScheduledDate(daySchedule, date)) continue;
          if (qualifyingDates.has(date)) {
            flushZeroScoreSpan();
            missedOccurrenceCount = 0;
            previousScore = 100;
            occurrences.push({ date, status: 'completed', score: previousScore });
            continue;
          }
          missedOccurrenceCount += 1;
          const nextScore = Math.max(0, 100 - missedOccurrenceCount * deductionPerMissedOccurrence);
          if (nextScore === 0 && previousScore === 0) {
            zeroScoreSpanStart ??= date;
            zeroScoreSpanEnd = date;
            zeroScoreSpanCount += 1;
          } else {
            flushZeroScoreSpan();
            occurrences.push({ date, status: 'missed', score: nextScore });
          }
          previousScore = nextScore;
        }
        flushZeroScoreSpan();
        const currentSchedule = scheduleForDate(input.asOfDate);
        const completedToday = qualifyingDates.has(input.asOfDate);
        if (scheduleChangedOn(input.asOfDate)) {
          scheduleChanges.push({ date: input.asOfDate, score: completedToday ? 100 : previousScore });
        }
        if (completedToday) {
          missedOccurrenceCount = 0;
          previousScore = 100;
        }
        const score = previousScore;
        occurrences.push({ date: input.asOfDate, status: 'today', score });
        if (currentSchedule && isScheduledDate(currentSchedule, input.asOfDate) && completedToday) {
          occurrences[occurrences.length - 1] = { date: input.asOfDate, status: 'completed', score };
        }
        const deduction = Math.min(100, missedOccurrenceCount * deductionPerMissedOccurrence);
        onTrack = lastQualifyingCompletionDate === null && missedOccurrenceCount === 0
          ? unscored('ready-for-first-tend', 'Starts with your first Tend.')
          : {
              kind: 'scored',
              score,
              evidence: {
                lastQualifyingCompletionDate,
                missedOccurrenceCount,
                pointsPerMissedOccurrence: deductionPerMissedOccurrence,
                deduction,
                occurrences,
                repeatedZeroScoreSpans,
                scheduleChanges
              }
            };
      }
    }
  }

  const healthScore = consistency.kind === 'scored' && onTrack.kind === 'scored'
    ? calculateBlendedHealth(consistency.exactPercent, onTrack.score)
    : null;
  return {
    kind: 'rhythm-score',
    asOfDate: input.asOfDate,
    timeZone: input.scoring?.timeZone ?? input.createdTimeZone ?? input.timeZone,
    trackingStartDate,
    consistency,
    onTrack,
    healthScore
  };
}

export const selectDailyRhythmScore = selectRhythmScore;

export { HEALTH_CONSISTENCY_WEIGHT, HEALTH_ON_TRACK_WEIGHT };
