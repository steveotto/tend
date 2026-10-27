import { isValidDate } from './money-goals.ts';
import type { RhythmCompletionRecord } from './rhythm-completion.ts';
import { HEALTH_CONSISTENCY_WEIGHT, HEALTH_ON_TRACK_WEIGHT, calculateBlendedHealth } from './rhythm-history.ts';
import {
  addCalendarDays,
  calendarDaysInclusive,
  dateParts,
  daysInMonth,
  isPeriodBasedRhythmSchedule,
  isScheduledDate,
  rhythmOccurrencePeriod,
  rhythmSchedulesEqual
} from './rhythm-occurrences.ts';
export { addCalendarDays, localDateInTimeZone } from './rhythm-occurrences.ts';
import {
  effectiveRhythmSchedule,
  isValidTimeZone,
  validateRhythmScoringMetadata
} from './rhythm-schedule.ts';
import type { RhythmSchedule, RhythmScoringMetadata, RhythmScheduleHistorySegment } from './rhythm-schedule.ts';
import { rhythmSeasonForDate, rhythmSeasonInclusiveEndDate } from './rhythm-seasons.ts';

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
  periodStartDate?: string;
  eligibleEndDate?: string;
};

type ScoringOccurrence = ScheduledOccurrenceState & {
  completionDate: string | null;
  eligibleEndDate: string;
  periodStartDate: string;
  periodBased: boolean;
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
  completionDate?: string;
  periodStartDate?: string;
  eligibleEndDate?: string;
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

export function rhythmHealthScore(result: RhythmScoreResult | undefined): number | null {
  return result?.kind === 'rhythm-score' ? result.healthScore : null;
}

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
  if (schedule.frequency === 'weekly'
    && (schedule.weeklyMode === 'select-days' || schedule.weekdays.length > 1)) {
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

function buildScoringOccurrences(input: {
  firstDueDate: string;
  lastCandidateDate: string;
  trackingStartDate: string;
  asOfDate: string;
  records: readonly RhythmCompletionRecord[];
  scheduleForDate: (date: string) => RhythmSchedule | undefined;
  segments: readonly RhythmScheduleHistorySegment[];
}): ScoringOccurrence[] {
  const occurrences: ScoringOccurrence[] = [];
  const assignedRecordIds = new Set<string>();
  const recordsByDate = new Map<string, RhythmCompletionRecord[]>();
  for (const record of input.records) {
    if (record.effectiveDate > input.asOfDate) continue;
    const records = recordsByDate.get(record.effectiveDate) ?? [];
    records.push(record);
    recordsByDate.set(record.effectiveDate, records);
  }
  const yesterday = previousDate(input.asOfDate);

  for (let date = input.firstDueDate; date <= input.lastCandidateDate; date = addCalendarDays(date, 1)) {
    const schedule = input.scheduleForDate(date);
    if (!schedule || !isScheduledDate(schedule, date)) continue;
    const period = rhythmOccurrencePeriod(schedule, date);
    const periodBased = isPeriodBasedRhythmSchedule(schedule);
    const segment = rhythmSeasonForDate(input.segments, date);
    const segmentIndex = segment ? input.segments.findIndex(item => item.id === segment.id) : -1;
    const segmentEnd = segmentIndex >= 0
      ? rhythmSeasonInclusiveEndDate(input.segments, segmentIndex)
      : undefined;
    const startDate = [
      period.startDate,
      input.trackingStartDate,
      segment?.startDate
    ].filter((value): value is string => value !== undefined).sort().at(-1)!;
    const endDate = [
      period.endDate,
      schedule.endDate,
      segmentEnd
    ].filter((value): value is string => value !== undefined).sort()[0]!;
    if (date < startDate || date > endDate) continue;

    const matchedRecords: RhythmCompletionRecord[] = [];
    const firstRecordDate = periodBased ? startDate : date;
    const lastRecordDate = periodBased
      ? [endDate, period.endDate, input.asOfDate].sort()[0]!
      : date;
    for (let recordDate = firstRecordDate; recordDate <= lastRecordDate; recordDate = addCalendarDays(recordDate, 1)) {
      for (const record of recordsByDate.get(recordDate) ?? []) {
        if (assignedRecordIds.has(record.id)) continue;
        const recordSchedule = input.scheduleForDate(record.effectiveDate);
        if (!recordSchedule) continue;
        const recordSegment = rhythmSeasonForDate(input.segments, record.effectiveDate);
        if ((recordSegment?.id ?? null) !== (segment?.id ?? null)) continue;
        matchedRecords.push(record);
      }
    }
    for (const record of matchedRecords) assignedRecordIds.add(record.id);

    if (date > yesterday && matchedRecords.length === 0) continue;
    const recordIds = matchedRecords.map(record => record.id);
    occurrences.push({
      date,
      status: recordIds.length > 0 ? 'completed' : 'not-completed',
      recordIds,
      completionDate: matchedRecords.map(record => record.effectiveDate).sort()[0] ?? null,
      eligibleEndDate: endDate,
      periodStartDate: startDate,
      periodBased
    });
  }
  return occurrences;
}

export function selectRhythmScore(input: SelectRhythmScoreInput): RhythmScoreResult {
  const invalidReason = validateInput(input);
  if (invalidReason) return invalid(input, invalidReason);

  if (input.archived) {
    return baseUnscored(input, unscored('inactive', 'This Rhythm is inactive, so its score is not accruing.'));
  }
  const schedule = effectiveRhythmSchedule(input.schedule, input.cadence);
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
  let segments: readonly RhythmScheduleHistorySegment[] = [];
  if (input.scoring) {
    const { timeZone, scheduleHistory } = input.scoring;
    if (!input.schedule || !validateRhythmScoringMetadata(input.scoring)
      || !isValidTimeZone(timeZone) || input.timeZone !== timeZone
      || scheduleHistory.length === 0
      || scheduleHistory.find(segment => segment.kind === 'scheduled')?.startDate !== input.scoring.trackingStartDate) {
      return invalid(input, 'Scoring metadata or schedule history is malformed.');
    }
    const latestSegment = scheduleHistory.at(-1);
    const activeSegment = rhythmSeasonForDate(scheduleHistory, input.asOfDate);
    if (!latestSegment) {
      return invalid(input, 'Schedule history has no current segment.');
    }
    if (latestSegment.kind !== 'scheduled') {
      return invalid(input, 'The latest saved schedule-history segment must have a known schedule.');
    }
    if (activeSegment?.kind === 'scheduled' && !rhythmSchedulesEqual(activeSegment.schedule, schedule)) {
      return invalid(input, 'The current schedule does not match the schedule effective today.');
    }
    segments = scheduleHistory;
  }

  const datedRecords = input.records.filter(record => record.rhythmId === input.rhythmId
    && record.effectiveDate <= input.asOfDate);
  const oldestCompletionDate = datedRecords.map(record => record.effectiveDate).sort()[0];
  // Explicit schedule history owns its tracking boundary; older logs still expose missing history.
  const trackingCandidates = input.scoring
    ? [input.scoring.trackingStartDate, oldestCompletionDate]
    : [input.createdLocalDate, oldestCompletionDate];
  const trackingStartDate = [
    ...trackingCandidates
  ].filter((date): date is string => date !== undefined).sort()[0] ?? null;
  if (trackingStartDate && trackingStartDate > input.asOfDate) {
    return baseUnscored(input, unscored('not-started', 'This Rhythm’s tracking date is in the future.'));
  }

  const scheduleForDate = (date: string): RhythmSchedule | undefined => {
    if (!input.scoring) return trackingStartDate && date >= trackingStartDate ? schedule : undefined;
    const historicalSegment = rhythmSeasonForDate(segments, date);
    const historicalSchedule = historicalSegment?.kind === 'scheduled' ? historicalSegment.schedule : undefined;
    if (historicalSchedule) return historicalSchedule;
    const firstSegment = segments[0];
    const canUseUnchangedDailyScheduleBeforeHistory = firstSegment?.kind === 'scheduled'
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
      && isScheduledDate(scheduleForDate(record.effectiveDate)!, record.effectiveDate) === true)
    && !(scheduleForDate(input.asOfDate)
      && isPeriodBasedRhythmSchedule(scheduleForDate(input.asOfDate)!)
      && datedRecords.some(record => record.effectiveDate === input.asOfDate))) {
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
        const currentSchedule = scheduleForDate(input.asOfDate);
        const currentPeriodEnd = currentSchedule
          ? rhythmOccurrencePeriod(currentSchedule, input.asOfDate).endDate
          : input.asOfDate;
        const scoringOccurrences = buildScoringOccurrences({
          firstDueDate: windowStartDate,
          lastCandidateDate: currentPeriodEnd > windowEndDate ? currentPeriodEnd : windowEndDate,
          trackingStartDate,
          asOfDate: input.asOfDate,
          records: datedRecords,
          scheduleForDate,
          segments
        });
        const occurrences = scoringOccurrences.filter(occurrence => {
          if (occurrence.date !== input.asOfDate || !occurrence.recordIds.length) return true;
          const occurrenceSchedule = scheduleForDate(occurrence.date);
          return occurrenceSchedule?.frequency === 'daily'
            || occurrenceSchedule !== undefined && isPeriodBasedRhythmSchedule(occurrenceSchedule);
        });
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
              occurrences: occurrences.map(occurrence => ({
                date: occurrence.date,
                status: occurrence.status,
                recordIds: occurrence.recordIds,
                ...(occurrence.periodBased
                  ? {
                      periodStartDate: occurrence.periodStartDate,
                      eligibleEndDate: occurrence.eligibleEndDate
                    }
                  : {})
              }))
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
    if (!trackingStartDate) {
      onTrack = unscored('ready-for-first-tend', 'Starts with your first Tend.');
    } else {
      const currentSchedule = scheduleForDate(input.asOfDate);
      const currentPeriodEnd = currentSchedule
        ? rhythmOccurrencePeriod(currentSchedule, input.asOfDate).endDate
        : input.asOfDate;
      const scoringOccurrences = buildScoringOccurrences({
        firstDueDate: trackingStartDate,
        lastCandidateDate: currentPeriodEnd > input.asOfDate ? currentPeriodEnd : input.asOfDate,
        trackingStartDate,
        asOfDate: input.asOfDate,
        records: datedRecords,
        scheduleForDate,
        segments
      });
      const completedOccurrences = scoringOccurrences.filter(item => item.status === 'completed');
      const lastQualifyingCompletionDate = completedOccurrences
        .map(item => item.completionDate!)
        .sort()
        .at(-1) ?? null;
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
        type TrackEvent =
          | { kind: 'occurrence'; date: string; occurrence: ScoringOccurrence; status: 'completed' | 'missed' }
          | { kind: 'schedule-change'; date: string };
        const events: TrackEvent[] = [];
        for (const occurrence of scoringOccurrences) {
          if (occurrence.status === 'completed') {
            events.push({
              kind: 'occurrence',
              date: occurrence.completionDate!,
              occurrence,
              status: 'completed'
            });
          } else if (occurrence.eligibleEndDate < input.asOfDate) {
            events.push({
              kind: 'occurrence',
              date: occurrence.eligibleEndDate,
              occurrence,
              status: 'missed'
            });
          }
        }
        for (let index = 1; index < segments.length; index += 1) {
          const previousSegment = segments[index - 1]!;
          const currentSegment = segments[index]!;
          const previousSchedule = previousSegment.kind === 'scheduled' ? previousSegment.schedule : undefined;
          const currentSegmentSchedule = currentSegment.kind === 'scheduled' ? currentSegment.schedule : undefined;
          if (currentSegment.startDate >= trackingStartDate
            && currentSegment.startDate <= input.asOfDate
            && previousSchedule !== undefined && currentSegmentSchedule !== undefined
            && !rhythmSchedulesEqual(previousSchedule, currentSegmentSchedule)) {
            events.push({ kind: 'schedule-change', date: currentSegment.startDate });
          }
        }
        events.sort((left, right) => left.date.localeCompare(right.date)
          || (left.kind === 'schedule-change' ? -1 : right.kind === 'schedule-change' ? 1 : 0));

        for (const event of events) {
          if (event.kind === 'schedule-change') {
            flushZeroScoreSpan();
            scheduleChanges.push({ date: event.date, score: previousScore });
            continue;
          }
          const { occurrence, status } = event;
          if (status === 'completed') {
            flushZeroScoreSpan();
            missedOccurrenceCount = 0;
            previousScore = 100;
            if (occurrence.date !== input.asOfDate || occurrence.completionDate !== input.asOfDate) {
              occurrences.push({
                date: occurrence.date,
                status: 'completed',
                score: previousScore,
                ...(occurrence.periodBased
                  ? {
                      completionDate: occurrence.completionDate!,
                      periodStartDate: occurrence.periodStartDate,
                      eligibleEndDate: occurrence.eligibleEndDate
                    }
                  : {})
              });
            }
            continue;
          }
          missedOccurrenceCount += 1;
          const nextScore = Math.max(0, 100 - missedOccurrenceCount * deductionPerMissedOccurrence);
          if (nextScore === 0 && previousScore === 0) {
            zeroScoreSpanStart ??= occurrence.date;
            zeroScoreSpanEnd = occurrence.date;
            zeroScoreSpanCount += 1;
          } else {
            flushZeroScoreSpan();
            occurrences.push({
              date: occurrence.date,
              status: 'missed',
              score: nextScore,
              ...(occurrence.periodBased
                ? { periodStartDate: occurrence.periodStartDate, eligibleEndDate: occurrence.eligibleEndDate }
                : {})
            });
          }
          previousScore = nextScore;
        }
        flushZeroScoreSpan();
        const score = previousScore;
        occurrences.push({ date: input.asOfDate, status: 'today', score });
        const dueTodayCompleted = completedOccurrences.some(item =>
          item.date === input.asOfDate && item.completionDate === input.asOfDate
        );
        if (dueTodayCompleted) {
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

export function selectRhythmSeasonScore(
  input: SelectRhythmScoreInput,
  season: RhythmScheduleHistorySegment,
  endDate?: string
): RhythmScoreResult {
  if (season.kind !== 'scheduled') {
    return baseUnscored(input, unscored(
      'unsupported-history',
      'Season Health is unavailable because its schedule is unknown.'
    ));
  }
  if (!input.scoring) {
    return baseUnscored(input, unscored(
      'unsupported-history',
      'Season Health is unavailable because its schedule history is not recorded.'
    ));
  }
  const historyIndex = input.scoring.scheduleHistory.findIndex(segment => segment.id === season.id);
  const savedSeason = input.scoring.scheduleHistory[historyIndex];
  if (!savedSeason || savedSeason.kind !== 'scheduled') {
    return baseUnscored(input, unscored(
      'unsupported-history',
      'Season Health is unavailable because its schedule history is unresolved.'
    ));
  }
  if (endDate !== undefined && !isValidDate(endDate)) {
    return invalid(input, 'The Season scoring end date is invalid.');
  }
  const seasonEndDate = endDate && endDate < input.asOfDate ? endDate : input.asOfDate;
  if (seasonEndDate < savedSeason.startDate) {
    return baseUnscored(input, unscored(
      'not-started',
      'This Season has not started, so it does not have a score yet.'
    ));
  }
  const evaluationDate = endDate !== undefined && savedSeason.schedule.endDate !== undefined
    && savedSeason.schedule.endDate < seasonEndDate
    ? savedSeason.schedule.endDate
    : seasonEndDate;
  const trackingStartDate = savedSeason.startDate > input.scoring.trackingStartDate
    ? savedSeason.startDate
    : input.scoring.trackingStartDate;
  if (trackingStartDate > evaluationDate) {
    return baseUnscored(input, unscored(
      'not-started',
      'This Season is outside the Rhythm’s established tracking dates.'
    ));
  }
  const scopedSeason: RhythmScheduleHistorySegment = {
    ...savedSeason,
    startDate: trackingStartDate
  };
  const scopedHistory: RhythmScheduleHistorySegment[] = [scopedSeason];
  if (evaluationDate < input.asOfDate) {
    const afterSeasonDate = addCalendarDays(evaluationDate, 1);
    if (!isValidDate(afterSeasonDate)) {
      return invalid(input, 'The Season scoring end date cannot be represented as a following calendar date.');
    }
    scopedHistory.push({
      ...scopedSeason,
      id: `season-score-end:${savedSeason.id}:${evaluationDate}`,
      startDate: afterSeasonDate
    });
  }
  return selectRhythmScore({
    ...input,
    schedule: savedSeason.schedule,
    scoring: {
      ...input.scoring,
      trackingStartDate,
      scheduleHistory: scopedHistory
    },
    records: input.records.filter(record =>
      record.rhythmId === input.rhythmId
      && record.effectiveDate >= savedSeason.startDate
      && record.effectiveDate <= evaluationDate
    ),
    asOfDate: evaluationDate
  });
}

export const selectDailyRhythmScore = selectRhythmScore;

export { HEALTH_CONSISTENCY_WEIGHT, HEALTH_ON_TRACK_WEIGHT };
