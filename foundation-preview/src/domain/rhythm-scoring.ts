import { isValidDate } from './money-goals.ts';
import type { RhythmCompletionRecord } from './rhythm-completion.ts';
import { HEALTH_CONSISTENCY_WEIGHT, HEALTH_ON_TRACK_WEIGHT, calculateBlendedHealth } from './rhythm-history.ts';
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

export type OnTrackDay = {
  date: string;
  status: 'tended' | 'not-tended' | 'today';
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
  overdueCount: number;
  pointsPerOverdueDate: 10;
  deduction: number;
  days: readonly OnTrackDay[];
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

export type UnscoredDailyRhythmSelection = {
  kind: 'unscored';
  asOfDate: string;
  timeZone: string;
  reason: UnscoredMetric;
  consistency: UnscoredMetric;
  onTrack: UnscoredMetric;
  healthScore: null;
};

export type InvalidDailyRhythmSelection = {
  kind: 'invalid';
  asOfDate: string;
  timeZone: string;
  reason: string;
  consistency: UnscoredMetric;
  onTrack: UnscoredMetric;
  healthScore: null;
};

export type DailyRhythmScoreResult =
  | RhythmScoreSelection
  | UnscoredDailyRhythmSelection
  | InvalidDailyRhythmSelection;

export type SelectDailyRhythmScoreInput = {
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

const dailyDeduction = 10 as const;

function unscored(reasonCode: UnscoredReasonCode, explanation: string): UnscoredMetric {
  return { kind: 'unscored', reasonCode, explanation };
}

function baseUnscored(
  input: Pick<SelectDailyRhythmScoreInput, 'asOfDate' | 'timeZone'>,
  reason: UnscoredMetric
): UnscoredDailyRhythmSelection {
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
  input: Pick<SelectDailyRhythmScoreInput, 'asOfDate' | 'timeZone'>,
  reason: string
): InvalidDailyRhythmSelection {
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

export function localDateInTimeZone(value: Date, timeZone: string): string {
  if (!Number.isFinite(value.getTime())) throw new RangeError('The scoring instant is invalid.');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(value);
  const fields = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

export function addCalendarDays(value: string, amount: number): string {
  if (!isValidDate(value) || !Number.isInteger(amount)) throw new RangeError('A valid calendar date and whole-day offset are required.');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year!, month! - 1, day! + amount);
  date.setUTCHours(0, 0, 0, 0);
  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('-');
}

function scheduleAt(
  segments: readonly RhythmScheduleSegment[],
  date: string
): RhythmSchedule | undefined {
  return segments.find(segment => segment.startDate <= date
    && (segment.endDate === undefined || date <= segment.endDate))?.schedule;
}

function previousDate(value: string): string {
  return addCalendarDays(value, -1);
}

function dateParts(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split('-').map(Number);
  return { year: year!, month: month!, day: day! };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
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

function calendarDaysInclusive(start: string, end: string): number {
  if (start > end) return 0;
  return Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
}

function scheduleSupported(schedule: RhythmSchedule): schedule is Exclude<RhythmSchedule, { frequency: 'custom' }> {
  return schedule.frequency !== 'custom';
}

function patternMatches(pattern: Extract<RhythmSchedule, { frequency: 'monthly' }>['pattern'], date: string): boolean {
  const { year, month, day } = dateParts(date);
  if (pattern.kind === 'dayOfMonth') {
    return pattern.day === 'last'
      ? day === daysInMonth(year, month)
      : day === pattern.day;
  }
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  if (weekday !== pattern.weekday) return false;
  if (pattern.ordinal === 'last') return day + 7 > daysInMonth(year, month);
  return Math.floor((day - 1) / 7) + 1 === pattern.ordinal;
}

function isScheduledDate(schedule: RhythmSchedule, date: string): boolean | 'unsupported' {
  if (!scheduleSupported(schedule)) return 'unsupported';
  if (schedule.endDate !== undefined && date > schedule.endDate) return false;
  const { month } = dateParts(date);
  if (schedule.frequency === 'daily') return true;
  if (schedule.frequency === 'weekly') {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    return schedule.weekdays.includes(weekday as (typeof schedule.weekdays)[number]);
  }
  if (schedule.frequency === 'monthly') return patternMatches(schedule.pattern, date);
  if (schedule.frequency === 'quarterly') {
    return (month - 1) % 3 + 1 === schedule.monthInQuarter && patternMatches(schedule.pattern, date);
  }
  return month === schedule.month && patternMatches(schedule.pattern, date);
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

function canonicalValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalValue).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalValue(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? '';
}

function validateInput(input: SelectDailyRhythmScoreInput): string | null {
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
    if (!scheduleSupported(schedule)) {
      return unscored('unsupported-history', 'This scoring window includes a custom schedule whose occurrences are not supported.');
    }
  }
  return null;
}

function dailyFailureForHistory(
  scheduleForDate: (date: string) => RhythmSchedule | undefined,
  firstDate: string,
  lastDate: string
): UnscoredMetric | null {
  for (let date = firstDate; date <= lastDate; date = addCalendarDays(date, 1)) {
    const schedule = scheduleForDate(date);
    if (!schedule) return unscored('unsupported-history', 'The schedule history does not cover the current On Track period.');
    if (schedule.frequency !== 'daily') {
      return unscored('unsupported-history', 'On Track cannot score across a schedule change away from Daily.');
    }
  }
  return null;
}

export function selectDailyRhythmScore(input: SelectDailyRhythmScoreInput): DailyRhythmScoreResult {
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
      'This descriptive cadence does not define a supported schedule. Choose a structured schedule; recurrence cannot be inferred from its label.'
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
    if (canonicalValue(latestSegment.schedule) !== canonicalValue(schedule)) {
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
    const historicalSchedule = scheduleAt(segments, date);
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
  if (!scheduleSupported(schedule)) {
    consistency = unscored('unsupported-schedule', 'Consistency for custom interval schedules is not supported yet.');
  } else if (!trackingStartDate) {
    consistency = unscored('ready-for-first-tend', 'Ready for your first Tend.');
  } else if (trackingStartDate === input.asOfDate
    && !datedRecords.some(record => record.effectiveDate === input.asOfDate
      && scheduleForDate(record.effectiveDate) !== undefined
      && isScheduledDate(scheduleForDate(record.effectiveDate)!, record.effectiveDate) === true)) {
    consistency = unscored('ready-for-first-tend', 'Ready for your first Tend.');
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
        schedule.frequency === 'daily'
          ? 'Consistency is waiting for a completed eligible day; today remains pending until the day ends.'
          : 'There are no eligible past occurrences yet; today is excluded.'
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
          if (!recordSchedule || !scheduleSupported(recordSchedule)) continue;
          if (isScheduledDate(recordSchedule, record.effectiveDate) !== true) continue;
          const ids = completedRecords.get(record.effectiveDate) ?? [];
          ids.push(record.id);
          completedRecords.set(record.effectiveDate, ids);
        }
        const occurrences: ScheduledOccurrenceState[] = [];
        for (let date = windowStartDate; date <= windowEndDate; date = addCalendarDays(date, 1)) {
          const scheduled = scheduleForDate(date);
          if (!scheduled || !scheduleSupported(scheduled)) continue;
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
          consistency = unscored('no-eligible-occurrences', 'There are no eligible scheduled occurrences in this tracking window.');
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
  if (schedule.frequency !== 'daily') {
    onTrack = unscored('unsupported-schedule', 'On Track scoring is currently available only for daily Rhythms.');
  } else {
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
        if (!trackingStartDate) continue;
        if (record.effectiveDate < trackingStartDate) continue;
        const recordSchedule = scheduleForDate(record.effectiveDate);
        if (recordSchedule && scheduleSupported(recordSchedule)
          && recordSchedule.frequency === 'daily'
          && isScheduledDate(recordSchedule, record.effectiveDate) === true) {
          qualifyingDates.add(record.effectiveDate);
        }
      }
      const lastQualifyingCompletionDate = [...qualifyingDates].sort().at(-1) ?? null;
      if (!trackingStartDate) {
        onTrack = unscored('ready-for-first-tend', 'Ready for your first Tend.');
      } else if (trackingStartDate === input.asOfDate && !lastQualifyingCompletionDate) {
        onTrack = unscored('ready-for-first-tend', 'Ready for your first Tend.');
      } else {
      const overdueStartDate = lastQualifyingCompletionDate
        ? addCalendarDays(lastQualifyingCompletionDate, 1)
        : trackingStartDate;
      const currentScheduleFailure = overdueStartDate <= yesterday
        ? dailyFailureForHistory(scheduleForDate, overdueStartDate, yesterday)
        : null;
      if (currentScheduleFailure) {
        onTrack = input.scoring && overdueStartDate < (segments[0]?.startDate ?? input.asOfDate)
          ? unscored('unsupported-history', 'A schedule change leaves earlier dates without a known schedule; On Track cannot reconstruct them.')
          : currentScheduleFailure;
      } else {
        const completedToday = lastQualifyingCompletionDate === input.asOfDate;
        let overdueCount = 0;
        if (!completedToday && overdueStartDate <= yesterday) {
          for (let date = overdueStartDate; date <= yesterday; date = addCalendarDays(date, 1)) {
            const daySchedule = scheduleForDate(date);
            if (daySchedule?.frequency === 'daily' && isScheduledDate(daySchedule, date) === true) {
              overdueCount += 1;
            }
          }
        }
        const deduction = overdueCount * dailyDeduction;
        const score = completedToday ? 100 : Math.max(0, 100 - deduction);
        const days: OnTrackDay[] = [];
        const repeatedZeroScoreSpans: OnTrackZeroScoreSpan[] = [];
        const scheduleChanges: OnTrackScheduleChange[] = [];
        let zeroScoreSpanStart: string | null = null;
        let zeroScoreSpanEnd: string | null = null;
        let zeroScoreSpanCount = 0;
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
          return canonicalValue(segments[segmentIndex - 1]?.schedule)
            !== canonicalValue(segments[segmentIndex]?.schedule);
        };
        let timelineStartDate = trackingStartDate;
        if (input.scoring) {
          for (let index = segments.length - 1; index >= 0; index -= 1) {
            if (segments[index]?.schedule.frequency !== 'daily') {
              timelineStartDate = segments[index + 1]?.startDate ?? input.asOfDate;
              break;
            }
          }
          if (timelineStartDate < trackingStartDate) timelineStartDate = trackingStartDate;
        }
        const timelineCompletionDates = new Set(
          [...qualifyingDates].filter(date => date >= timelineStartDate)
        );
        let cumulativeOverdue = 0;
        let previousScore = 100;
        for (let date = timelineStartDate; date < input.asOfDate; date = addCalendarDays(date, 1)) {
          const daySchedule = scheduleForDate(date);
          if (scheduleChangedOn(date)) {
            flushZeroScoreSpan();
            scheduleChanges.push({ date, score: previousScore });
          }
          if (daySchedule?.frequency !== 'daily' || isScheduledDate(daySchedule, date) !== true) {
            flushZeroScoreSpan();
            continue;
          }
          if (timelineCompletionDates.has(date)) {
            flushZeroScoreSpan();
            cumulativeOverdue = 0;
            previousScore = 100;
            days.push({ date, status: 'tended', score: 100 });
            continue;
          }
          cumulativeOverdue += 1;
          const nextScore = Math.max(0, 100 - cumulativeOverdue * dailyDeduction);
          if (nextScore === 0 && previousScore === 0) {
            zeroScoreSpanStart ??= date;
            zeroScoreSpanEnd = date;
            zeroScoreSpanCount += 1;
          } else {
            flushZeroScoreSpan();
            days.push({
              date,
              status: 'not-tended',
              score: nextScore
            });
          }
          previousScore = nextScore;
        }
        flushZeroScoreSpan();
        if (scheduleChangedOn(input.asOfDate)) {
          scheduleChanges.push({ date: input.asOfDate, score });
        }
        days.push({
          date: input.asOfDate,
          status: completedToday ? 'tended' : 'today',
          score
        });
        onTrack = {
          kind: 'scored',
          score,
          evidence: {
            lastQualifyingCompletionDate,
            overdueCount,
            pointsPerOverdueDate: dailyDeduction,
            deduction,
            days,
            repeatedZeroScoreSpans,
            scheduleChanges
          }
        };
      }
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

export { HEALTH_CONSISTENCY_WEIGHT, HEALTH_ON_TRACK_WEIGHT };
