import { isValidDate } from './money-goals.ts';
import type { RhythmCompletionRecord } from './rhythm-completion.ts';
import { HEALTH_CONSISTENCY_WEIGHT, HEALTH_ON_TRACK_WEIGHT, calculateBlendedHealth } from './rhythm-history.ts';
import {
  isValidTimeZone,
  validateRhythmScoringMetadata
} from './rhythm-schedule.ts';
import type { RhythmSchedule, RhythmScoringMetadata, RhythmScheduleSegment } from './rhythm-schedule.ts';

export type UnscoredReasonCode =
  | 'missing-tracking-start'
  | 'unsupported-schedule'
  | 'unsupported-history'
  | 'no-eligible-occurrences'
  | 'not-started'
  | 'inactive'
  | 'history-unavailable';

export type UnscoredMetric = {
  kind: 'unscored';
  reasonCode: UnscoredReasonCode;
  explanation: string;
};

export type DailyOccurrenceState = {
  date: string;
  status: 'completed' | 'not-completed';
  recordIds: readonly string[];
};

export type ConsistencyEvidence = {
  windowStartDate: string;
  windowEndDate: string;
  eligibleDueCount: number;
  completedCount: number;
  notCompletedCount: number;
  occurrences: readonly DailyOccurrenceState[];
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

export type OnTrackEvidence = {
  lastQualifyingCompletionDate: string | null;
  overdueDates: readonly string[];
  pointsPerOverdueDate: 10;
  deduction: number;
  days: readonly OnTrackDay[];
};

export type ScoredOnTrackMetric = {
  kind: 'scored';
  score: number;
  evidence: OnTrackEvidence;
};

export type DailyRhythmScoreSelection = {
  kind: 'daily-score';
  asOfDate: string;
  timeZone: string;
  trackingStartDate: string;
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
  | DailyRhythmScoreSelection
  | UnscoredDailyRhythmSelection
  | InvalidDailyRhythmSelection;

export type SelectDailyRhythmScoreInput = {
  rhythmId: string;
  schedule?: RhythmSchedule;
  scoring?: RhythmScoringMetadata;
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

function isDueDaily(segments: readonly RhythmScheduleSegment[], date: string): boolean | 'unsupported' | 'missing' {
  const schedule = scheduleAt(segments, date);
  if (!schedule) return 'missing';
  if (schedule.endDate !== undefined && date > schedule.endDate) return false;
  if (schedule.frequency !== 'daily') return 'unsupported';
  return true;
}

function previousDate(value: string): string {
  return addCalendarDays(value, -1);
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
  segments: readonly RhythmScheduleSegment[],
  firstDate: string,
  lastDate: string
): UnscoredMetric | null {
  for (let date = firstDate; date <= lastDate; date = addCalendarDays(date, 1)) {
    const due = isDueDaily(segments, date);
    if (due === 'unsupported') {
      return unscored('unsupported-history', 'This scoring window includes a schedule that is not supported for daily scoring.');
    }
    if (due === 'missing') {
      return unscored('unsupported-history', 'The schedule history does not cover the full scoring window.');
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
  if (!input.schedule) {
    return baseUnscored(input, unscored('unsupported-schedule', 'Scoring for this schedule isn’t available yet.'));
  }
  if (input.schedule.frequency !== 'daily') {
    return baseUnscored(input, unscored('unsupported-schedule', 'Scoring for this schedule isn’t available yet.'));
  }
  if (input.schedule.endDate !== undefined && input.schedule.endDate < input.asOfDate) {
    return baseUnscored(input, unscored('inactive', 'This Rhythm has ended, so its score is not accruing.'));
  }
  if (!input.scoring) {
    return baseUnscored(input, unscored('missing-tracking-start', 'Set a tracking start date to begin scoring this Rhythm.'));
  }
  if (!input.recordsAvailable) {
    return baseUnscored(input, unscored('history-unavailable', 'Completion history is unavailable, so this Rhythm cannot be scored.'));
  }
  const { trackingStartDate, timeZone, scheduleHistory: segments } = input.scoring;
  if (!validateRhythmScoringMetadata(input.scoring) || !isValidDate(trackingStartDate)
    || !isValidTimeZone(timeZone) || input.timeZone !== timeZone
    || segments.length === 0 || segments[0]?.startDate !== trackingStartDate) {
    return invalid(input, 'Scoring metadata or schedule history is malformed.');
  }
  if (trackingStartDate > input.asOfDate) {
    return baseUnscored(input, unscored('not-started', 'Tracking has not started yet.'));
  }

  const latestSegment = segments.at(-1);
  if (!latestSegment || latestSegment.endDate !== undefined) {
    return invalid(input, 'Schedule history has no current segment.');
  }
  if (canonicalValue(latestSegment.schedule) !== canonicalValue(input.schedule)) {
    return invalid(input, 'The current schedule does not match the final saved schedule-history segment.');
  }
  const latestEndDate = input.schedule.endDate;
  if (latestEndDate !== undefined && latestEndDate < input.asOfDate) {
    return baseUnscored(input, unscored('inactive', 'This Rhythm has ended, so its score is not accruing.'));
  }

  const yesterday = previousDate(input.asOfDate);
  const windowStartDate = trackingStartDate > addCalendarDays(input.asOfDate, -30)
    ? trackingStartDate
    : addCalendarDays(input.asOfDate, -30);
  const windowEndDate = yesterday;
  let consistency: ScoredConsistencyMetric | UnscoredMetric;
  if (windowStartDate > windowEndDate) {
    consistency = unscored('no-eligible-occurrences', 'There are no completed days in the tracking window yet.');
  } else {
    const historyFailure = failureForHistory(segments, windowStartDate, windowEndDate);
    if (historyFailure) {
      consistency = historyFailure;
    } else {
      const completedRecords = new Map<string, string[]>();
      for (const record of input.records) {
        if (record.rhythmId !== input.rhythmId || record.effectiveDate < trackingStartDate
          || record.effectiveDate > windowEndDate) continue;
        const due = isDueDaily(segments, record.effectiveDate);
        if (due === true) {
          const ids = completedRecords.get(record.effectiveDate) ?? [];
          ids.push(record.id);
          completedRecords.set(record.effectiveDate, ids);
        }
      }
      const occurrences: DailyOccurrenceState[] = [];
      for (let date = windowStartDate; date <= windowEndDate; date = addCalendarDays(date, 1)) {
        if (isDueDaily(segments, date) !== true) continue;
        const recordIds = completedRecords.get(date) ?? [];
        occurrences.push({
          date,
          status: recordIds.length > 0 ? 'completed' : 'not-completed',
          recordIds
        });
      }
      const completedCount = occurrences.filter(item => item.status === 'completed').length;
      if (occurrences.length === 0) {
        consistency = unscored('no-eligible-occurrences', 'There are no eligible due occurrences in this tracking window.');
      } else {
        const exactPercent = Math.min(100, (completedCount / occurrences.length) * 100);
        consistency = {
          kind: 'scored',
          score: exactPercent,
          exactPercent,
          evidence: {
            windowStartDate,
            windowEndDate,
            eligibleDueCount: occurrences.length,
            completedCount,
            notCompletedCount: occurrences.length - completedCount,
            occurrences
          }
        };
      }
    }
  }

  const qualifyingDates = new Set<string>();
  for (const record of input.records) {
    if (record.rhythmId !== input.rhythmId || record.effectiveDate < trackingStartDate
      || record.effectiveDate > input.asOfDate) continue;
    if (isDueDaily(segments, record.effectiveDate) === true) qualifyingDates.add(record.effectiveDate);
  }
  const lastQualifyingCompletionDate = [...qualifyingDates].sort().at(-1) ?? null;
  const overdueStartDate = lastQualifyingCompletionDate
    ? addCalendarDays(lastQualifyingCompletionDate, 1)
    : trackingStartDate;
  const currentScheduleFailure = overdueStartDate <= yesterday
    ? failureForHistory(segments, overdueStartDate, yesterday)
    : null;
  let onTrack: ScoredOnTrackMetric | UnscoredMetric;
  if (currentScheduleFailure) {
    onTrack = currentScheduleFailure;
  } else {
    const completedToday = lastQualifyingCompletionDate === input.asOfDate;
    const overdueDates: string[] = [];
    if (!completedToday && overdueStartDate <= yesterday) {
      for (let date = overdueStartDate; date <= yesterday; date = addCalendarDays(date, 1)) {
        if (isDueDaily(segments, date) === true) overdueDates.push(date);
      }
    }
    const deduction = overdueDates.length * dailyDeduction;
    const score = completedToday ? 100 : Math.max(0, 100 - deduction);
    const days: OnTrackDay[] = [];
    const relevantStartDate = completedToday
      ? input.asOfDate
      : lastQualifyingCompletionDate ?? overdueStartDate;
    if (lastQualifyingCompletionDate && lastQualifyingCompletionDate < input.asOfDate) {
      days.push({ date: lastQualifyingCompletionDate, status: 'tended', score: 100 });
    }
    let cumulativeOverdue = 0;
    for (let date = relevantStartDate; date < input.asOfDate; date = addCalendarDays(date, 1)) {
      if (isDueDaily(segments, date) !== true || date <= (lastQualifyingCompletionDate ?? '0000-00-00')) continue;
      cumulativeOverdue += 1;
      days.push({
        date,
        status: 'not-tended',
        score: Math.max(0, 100 - cumulativeOverdue * dailyDeduction)
      });
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
        overdueDates,
        pointsPerOverdueDate: dailyDeduction,
        deduction,
        days
      }
    };
  }

  const healthScore = consistency.kind === 'scored' && onTrack.kind === 'scored'
    ? calculateBlendedHealth(consistency.exactPercent, onTrack.score)
    : null;
  return {
    kind: 'daily-score',
    asOfDate: input.asOfDate,
    timeZone,
    trackingStartDate,
    consistency,
    onTrack,
    healthScore
  };
}

export { HEALTH_CONSISTENCY_WEIGHT, HEALTH_ON_TRACK_WEIGHT };
