import type { RhythmSchedule, RhythmWeekday } from '../../foundation-preview/src/domain/rhythm-schedule.ts';

export const CONSISTENCY_WEIGHT = 0.75;
export const ON_TRACK_WEIGHT = 0.25;
export const POINTS_PER_CONSECUTIVE_MISS = 10;

export type ScoreMetric =
  | { kind: 'scored'; score: number }
  | { kind: 'unscored'; reason: 'missing-clock' | 'not-due-yet' | 'no-due-occurrences' };

export type RhythmScore = {
  kind: 'rhythm-score';
  rhythmId: string;
  scoreClockStartDate: string | null;
  consistencyWindow: { startDate: string; endDate: string };
  occurrences: readonly {
    dueDate: string;
    periodStartDate: string;
    periodEndDate: string;
    completed: boolean;
    missed: boolean;
    onTrack: number | null;
  }[];
  consistency: ScoreMetric;
  onTrack: ScoreMetric;
  health: number | null;
};

export type RhythmScoreInput = {
  rhythmId: string;
  schedule: RhythmSchedule;
  createdDate?: string;
  explicitStartDate?: string;
  completionDates: readonly string[];
  asOfDate: string;
};

export type ScoreComponents = {
  consistency: number;
  onTrack: number;
};

export type RollupScore = {
  consistency: number | null;
  onTrack: number | null;
  health: number | null;
  scoredCount: number;
  totalCount: number;
};

export type ConsistencyWindow = {
  startDate: string;
  endDate: string;
  dueDates: readonly string[];
};

type DueOccurrence = {
  dueDate: string;
  periodStartDate: string;
  periodEndDate: string;
};

type WindowLength = { days?: number; months?: number };

const DAY_MS = 86_400_000;
const MAX_SCHEDULE_SEARCH_DAYS = 366 * 100;

export function isValidLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function addDays(value: string, amount: number): string {
  assertDate(value);
  if (!Number.isInteger(amount)) throw new RangeError('A whole-day offset is required.');
  return new Date(Date.parse(`${value}T00:00:00.000Z`) + amount * DAY_MS)
    .toISOString().slice(0, 10);
}

function assertDate(value: string): void {
  if (!isValidLocalDate(value)) throw new RangeError(`Invalid local date: ${value}`);
}

function weekday(value: string): RhythmWeekday {
  return new Date(`${value}T00:00:00.000Z`).getUTCDay() as RhythmWeekday;
}

function monthParts(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split('-').map(Number);
  return { year: year!, month: month!, day: day! };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addMonths(value: string, amount: number): string {
  const { year, month, day } = monthParts(value);
  const index = year * 12 + month - 1 + amount;
  const nextYear = Math.floor(index / 12);
  const nextMonth = index % 12 + 1;
  return [
    String(nextYear).padStart(4, '0'),
    String(nextMonth).padStart(2, '0'),
    String(Math.min(day, daysInMonth(nextYear, nextMonth))).padStart(2, '0')
  ].join('-');
}

function startOfWeek(value: string): string {
  return addDays(value, -((weekday(value) + 6) % 7));
}

function monthIndex(value: string): number {
  const { year, month } = monthParts(value);
  return year * 12 + month - 1;
}

function patternMatches(
  pattern: Extract<RhythmSchedule, { frequency: 'monthly' }>['pattern'],
  value: string
): boolean {
  const { year, month, day } = monthParts(value);
  if (pattern.kind === 'dayOfMonth') {
    return pattern.day === 'last'
      ? day === daysInMonth(year, month)
      : day === pattern.day;
  }
  const dayOfWeek = weekday(value);
  if (dayOfWeek !== pattern.weekday) return false;
  if (pattern.ordinal === 'last') return day + 7 > daysInMonth(year, month);
  return Math.floor((day - 1) / 7) + 1 === pattern.ordinal;
}

function isScheduledDate(schedule: RhythmSchedule, date: string): boolean {
  if (schedule.endDate !== undefined && date > schedule.endDate) return false;
  const { year, month } = monthParts(date);
  if (schedule.frequency === 'daily') return true;
  if (schedule.frequency === 'weekly') return schedule.weekdays.includes(weekday(date));
  if (schedule.frequency === 'monthly') return patternMatches(schedule.pattern, date);
  if (schedule.frequency === 'quarterly') {
    return (month - 1) % 3 + 1 === schedule.monthInQuarter
      && patternMatches(schedule.pattern, date);
  }
  if (schedule.frequency === 'yearly') {
    return month === schedule.month && patternMatches(schedule.pattern, date);
  }

  if (date < schedule.startDate) return false;
  if (schedule.unit === 'days') {
    return dateDifference(schedule.startDate, date) % schedule.interval === 0;
  }
  if (schedule.unit === 'weeks') {
    const weekOffset = Math.floor(dateDifference(startOfWeek(schedule.startDate), startOfWeek(date)) / 7);
    return weekOffset >= 0
      && weekOffset % schedule.interval === 0
      && schedule.weekdays.includes(weekday(date));
  }
  if (schedule.unit === 'months') {
    return (monthIndex(date) - monthIndex(schedule.startDate)) % schedule.interval === 0
      && patternMatches(schedule.pattern, date);
  }
  return (year - monthParts(schedule.startDate).year) % schedule.interval === 0
    && month === schedule.month
    && patternMatches(schedule.pattern, date);
}

function dateDifference(start: string, end: string): number {
  return Math.floor((Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / DAY_MS);
}

function occurrencePeriod(schedule: RhythmSchedule, dueDate: string): DueOccurrence {
  if (schedule.frequency === 'weekly' && schedule.weekdays.length === 1
    && schedule.weeklyMode !== 'select-days') {
    const periodStartDate = startOfWeek(dueDate);
    return { dueDate, periodStartDate, periodEndDate: addDays(periodStartDate, 6) };
  }
  if (schedule.frequency === 'monthly') {
    const { year, month } = monthParts(dueDate);
    const periodStartDate = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
    return {
      dueDate,
      periodStartDate,
      periodEndDate: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(daysInMonth(year, month)).padStart(2, '0')}`
    };
  }
  if (schedule.frequency === 'quarterly') {
    const { year, month } = monthParts(dueDate);
    const firstMonth = Math.floor((month - 1) / 3) * 3 + 1;
    return {
      dueDate,
      periodStartDate: `${String(year).padStart(4, '0')}-${String(firstMonth).padStart(2, '0')}-01`,
      periodEndDate: `${String(year).padStart(4, '0')}-${String(firstMonth + 2).padStart(2, '0')}-${String(daysInMonth(year, firstMonth + 2)).padStart(2, '0')}`
    };
  }
  if (schedule.frequency === 'yearly') {
    const { year } = monthParts(dueDate);
    return {
      dueDate,
      periodStartDate: `${String(year).padStart(4, '0')}-01-01`,
      periodEndDate: `${String(year).padStart(4, '0')}-12-31`
    };
  }
  return { dueDate, periodStartDate: dueDate, periodEndDate: dueDate };
}

function windowLength(schedule: RhythmSchedule): WindowLength {
  if (schedule.frequency === 'daily') return { days: 30 };
  if (schedule.frequency === 'weekly') return { days: 84 };
  if (schedule.frequency === 'monthly') return { months: 6 };
  if (schedule.frequency === 'quarterly') return { months: 12 };
  if (schedule.frequency === 'yearly') return { months: 24 };
  if (schedule.unit === 'days') return { days: 30 };
  if (schedule.unit === 'weeks') return { days: 84 };
  if (schedule.unit === 'months') return { months: 6 };
  return { months: 24 };
}

function subtractWindow(value: string, length: WindowLength): string {
  return length.days === undefined
    ? addMonths(value, -length.months!)
    : addDays(value, -(length.days - 1));
}

function isCustom(schedule: RhythmSchedule): boolean {
  return schedule.frequency === 'custom';
}

function scheduleHasEnd(schedule: RhythmSchedule, date: string): boolean {
  return schedule.endDate === undefined || date <= schedule.endDate;
}

function dueOccurrencesBetween(
  schedule: RhythmSchedule,
  startDate: string,
  endDate: string
): DueOccurrence[] {
  const result: DueOccurrence[] = [];
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    if (!scheduleHasEnd(schedule, date) || !isScheduledDate(schedule, date)) continue;
    if (schedule.frequency === 'weekly' && schedule.weekdays.length === 1
      && schedule.weeklyMode !== 'select-days') {
      const periodStart = startOfWeek(date);
      if (periodStart < startDate && result.at(-1)?.periodStartDate === periodStart) continue;
    }
    if (schedule.frequency === 'monthly' || schedule.frequency === 'quarterly'
      || schedule.frequency === 'yearly') {
      const period = occurrencePeriod(schedule, date);
      if (result.at(-1)?.periodStartDate === period.periodStartDate) continue;
      result.push(period);
      continue;
    }
    result.push(occurrencePeriod(schedule, date));
  }
  return result;
}

function getScoreClockStart(input: RhythmScoreInput): string | null {
  const firstCompletion = [...input.completionDates].sort()[0];
  const knownDates = [input.createdDate, firstCompletion].filter(
    (value): value is string => value !== undefined
  );
  if (knownDates.length > 0) return knownDates.sort()[0]!;
  return input.explicitStartDate ?? null;
}

function consistencyWindow(
  schedule: RhythmSchedule,
  asOfDate: string,
  scoreClockStartDate: string | null
): { startDate: string; endDate: string; dueOccurrences: DueOccurrence[] } {
  const start = subtractWindow(asOfDate, windowLength(schedule));
  let startDate = scoreClockStartDate && scoreClockStartDate > start ? scoreClockStartDate : start;
  let dueOccurrences = dueOccurrencesBetween(schedule, startDate, asOfDate);

  if (isCustom(schedule) && dueOccurrences.length < 2) {
    const searchStart = addDays(asOfDate, -MAX_SCHEDULE_SEARCH_DAYS);
    const historicalOccurrences = dueOccurrencesBetween(schedule, searchStart, asOfDate);
    if (historicalOccurrences.length >= 2) {
      startDate = historicalOccurrences.at(-2)!.dueDate;
      if (scoreClockStartDate && startDate < scoreClockStartDate) startDate = scoreClockStartDate;
      dueOccurrences = dueOccurrencesBetween(schedule, startDate, asOfDate);
    }
  }

  return { startDate, endDate: asOfDate, dueOccurrences };
}

export function consistencyWindowForSchedule(
  schedule: RhythmSchedule,
  asOfDate: string,
  scoreClockStartDate: string | null = null
): ConsistencyWindow {
  assertDate(asOfDate);
  if (scoreClockStartDate !== null) assertDate(scoreClockStartDate);
  const window = consistencyWindow(schedule, asOfDate, scoreClockStartDate);
  return {
    startDate: window.startDate,
    endDate: window.endDate,
    dueDates: window.dueOccurrences.map(occurrence => occurrence.dueDate)
  };
}

function occurrenceCompleted(
  occurrence: DueOccurrence,
  schedule: RhythmSchedule,
  completionDates: ReadonlySet<string>
): boolean {
  if (schedule.frequency === 'weekly' && schedule.weekdays.length === 1
    && schedule.weeklyMode !== 'select-days') {
    return [...completionDates].some(date =>
      date >= occurrence.periodStartDate && date <= occurrence.periodEndDate
    );
  }
  if (schedule.frequency === 'monthly' || schedule.frequency === 'quarterly'
    || schedule.frequency === 'yearly') {
    return [...completionDates].some(date =>
      date >= occurrence.periodStartDate && date <= occurrence.periodEndDate
    );
  }
  return completionDates.has(occurrence.dueDate);
}

function validateInput(input: RhythmScoreInput): void {
  if (!input.rhythmId.trim()) throw new TypeError('A Rhythm ID is required.');
  assertDate(input.asOfDate);
  if (input.createdDate !== undefined) assertDate(input.createdDate);
  if (input.explicitStartDate !== undefined) assertDate(input.explicitStartDate);
  for (const date of input.completionDates) assertDate(date);
  if (!Number.isInteger(input.schedule.frequency === 'custom' ? input.schedule.interval : 1)
    || input.schedule.frequency === 'custom' && input.schedule.interval < 1) {
    throw new RangeError('A custom Rhythm interval must be a positive whole number.');
  }
}

export function scoreRhythm(input: RhythmScoreInput): RhythmScore {
  validateInput(input);
  const scoreClockStartDate = getScoreClockStart(input);
  const window = consistencyWindow(input.schedule, input.asOfDate, scoreClockStartDate);
  if (scoreClockStartDate === null) {
    const unscored: ScoreMetric = { kind: 'unscored', reason: 'missing-clock' };
    return {
      kind: 'rhythm-score',
      rhythmId: input.rhythmId,
      scoreClockStartDate: null,
      consistencyWindow: { startDate: window.startDate, endDate: window.endDate },
      occurrences: [],
      consistency: unscored,
      onTrack: unscored,
      health: null
    };
  }
  const completionDates = new Set(input.completionDates.filter(date => date <= input.asOfDate));
  const scoredOccurrences = window.dueOccurrences
    .filter(occurrence => occurrence.periodEndDate >= scoreClockStartDate)
    .map(occurrence => {
      const completed = occurrenceCompleted(occurrence, input.schedule, completionDates);
      const missed = !completed && occurrence.periodEndDate < input.asOfDate;
      return { ...occurrence, completed, missed };
    });

  const completedCount = scoredOccurrences.filter(occurrence => occurrence.completed).length;
  const consistency: ScoreMetric = scoredOccurrences.length === 0
    ? { kind: 'unscored', reason: 'no-due-occurrences' }
    : { kind: 'scored', score: completedCount / scoredOccurrences.length * 100 };

  let onTrackValue = 100;
  let hasOnTrackEvidence = scoredOccurrences.length > 0;
  const occurrences = scoredOccurrences.map(occurrence => {
    if (occurrence.completed) {
      onTrackValue = 100;
      hasOnTrackEvidence = true;
    } else if (occurrence.missed) {
      onTrackValue = Math.max(0, onTrackValue - POINTS_PER_CONSECUTIVE_MISS);
      hasOnTrackEvidence = true;
    }
    return {
      ...occurrence,
      onTrack: hasOnTrackEvidence ? onTrackValue : null
    };
  });
  const onTrack: ScoreMetric = hasOnTrackEvidence
    ? { kind: 'scored', score: onTrackValue }
    : { kind: 'unscored', reason: 'not-due-yet' };
  const health = consistency.kind === 'scored' && onTrack.kind === 'scored'
    ? blendScores(consistency.score, onTrack.score)
    : null;

  return {
    kind: 'rhythm-score',
    rhythmId: input.rhythmId,
    scoreClockStartDate,
    consistencyWindow: { startDate: window.startDate, endDate: window.endDate },
    occurrences,
    consistency,
    onTrack,
    health
  };
}

export function blendScores(consistency: number, onTrack: number): number {
  assertScore(consistency);
  assertScore(onTrack);
  return consistency * CONSISTENCY_WEIGHT + onTrack * ON_TRACK_WEIGHT;
}

export function averageScores(scores: readonly (ScoreComponents | null)[]): RollupScore {
  const scored = scores.filter((score): score is ScoreComponents =>
    score !== null
      && Number.isFinite(score.consistency)
      && Number.isFinite(score.onTrack)
  );
  const totalCount = scores.length;
  if (scored.length === 0) {
    return { consistency: null, onTrack: null, health: null, scoredCount: 0, totalCount };
  }
  const consistency = scored.reduce((sum, score) => sum + score.consistency, 0) / scored.length;
  const onTrack = scored.reduce((sum, score) => sum + score.onTrack, 0) / scored.length;
  return {
    consistency,
    onTrack,
    health: blendScores(consistency, onTrack),
    scoredCount: scored.length,
    totalCount
  };
}

function assertScore(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new RangeError('Scores must be finite values from 0 through 100.');
  }
}
