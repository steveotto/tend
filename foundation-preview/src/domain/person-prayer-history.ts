import type { PersonPrayerRequest } from './person-prayers.ts';

export type PersonPrayerDailyCount = {
  date: string;
  count: number;
};

export type PersonPrayerHistory = {
  totalCount: number;
  datedCount: number;
  undatedCount: number;
  futureDatedCount: number;
  lastPrayedAt: string | null;
  lastPrayedDate: string | null;
  recentWindowStart: string;
  recentCount: number;
  dailyCounts: readonly PersonPrayerDailyCount[];
};

const millisecondsPerDay = 86_400_000;

export function selectPersonPrayerHistory(
  request: PersonPrayerRequest,
  asOfDate: string,
  timeZone: string
): PersonPrayerHistory {
  const asOf = dateNumber(asOfDate);
  const recentWindowStart = dateString(asOf - 29 * millisecondsPerDay);
  const counts = new Map<string, number>();
  let datedCount = 0;
  let undatedCount = 0;
  let futureDatedCount = 0;
  let lastPrayedAt: string | null = null;
  let lastPrayedDate: string | null = null;
  let latestInstant = Number.NEGATIVE_INFINITY;

  for (const log of request.prayerLogs) {
    if (log.prayedAt === undefined && log.prayedOn === undefined) {
      undatedCount += 1;
      continue;
    }

    let date: string;
    let instant: number | undefined;
    if (log.prayedOn !== undefined) {
      if (!isCalendarDate(log.prayedOn)) {
        throw new RangeError(`Prayer log ${log.id} has an invalid date.`);
      }
      date = log.prayedOn;
    } else {
      instant = Date.parse(log.prayedAt!);
      if (!Number.isFinite(instant)) {
        throw new RangeError(`Prayer log ${log.id} has an invalid timestamp.`);
      }
      date = dateInTimeZone(instant, timeZone);
    }
    datedCount += 1;
    if (date > asOfDate) {
      futureDatedCount += 1;
      continue;
    }
    if (instant !== undefined && instant > latestInstant) {
      latestInstant = instant;
      lastPrayedAt = log.prayedAt!;
    }
    counts.set(date, (counts.get(date) ?? 0) + 1);
    if (lastPrayedDate === null || date > lastPrayedDate) lastPrayedDate = date;
  }

  const firstDatedDate = [...counts.keys()].sort()[0] ?? asOfDate;
  const firstDay = dateNumber(firstDatedDate);
  const dailyCounts: PersonPrayerDailyCount[] = [];
  for (let day = firstDay; day <= asOf; day += millisecondsPerDay) {
    const date = dateString(day);
    dailyCounts.push({ date, count: counts.get(date) ?? 0 });
  }

  return {
    totalCount: request.prayerLogs.length,
    datedCount,
    undatedCount,
    futureDatedCount,
    lastPrayedAt,
    lastPrayedDate,
    recentWindowStart,
    recentCount: dailyCounts.reduce(
      (count, item) => item.date >= recentWindowStart ? count + item.count : count,
      0
    ),
    dailyCounts
  };
}

export function formatPrayerLogDate(log: {
  prayedAt?: string;
  prayedOn?: string;
}, timeZone: string): string {
  if (log.prayedOn !== undefined) {
    if (!isCalendarDate(log.prayedOn)) return 'Date unavailable';
    const [year, month, day] = log.prayedOn.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(Date.UTC(year!, month! - 1, day!, 12)));
  }
  if (!log.prayedAt) return 'Date not recorded';
  const instant = Date.parse(log.prayedAt);
  if (!Number.isFinite(instant)) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(instant));
}

export function formatPrayerLogTime(log: { prayedAt?: string }, timeZone: string): string | null {
  if (!log.prayedAt) return null;
  const instant = Date.parse(log.prayedAt);
  if (!Number.isFinite(instant)) return null;
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(instant));
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}

function dateNumber(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError(`Expected a calendar date, received ${value}.`);
  }
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) {
    throw new RangeError(`Invalid calendar date: ${value}.`);
  }
  return parsed;
}

function dateString(value: number): string {
  return new Date(value).toISOString().slice(0, 10);
}

function dateInTimeZone(instant: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(instant));
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;
  if (!year || !month || !day) {
    throw new RangeError(`Prayer history could not be formatted for timezone ${timeZone}.`);
  }
  return `${year}-${month}-${day}`;
}
