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
  let latestInstant = Number.NEGATIVE_INFINITY;

  for (const log of request.prayerLogs) {
    if (log.prayedAt === undefined) {
      undatedCount += 1;
      continue;
    }

    const instant = Date.parse(log.prayedAt);
    if (!Number.isFinite(instant)) {
      throw new RangeError(`Prayer log ${log.id} has an invalid timestamp.`);
    }
    const date = dateInTimeZone(instant, timeZone);
    datedCount += 1;
    if (date > asOfDate) {
      futureDatedCount += 1;
      continue;
    }
    counts.set(date, (counts.get(date) ?? 0) + 1);
    if (instant > latestInstant) {
      latestInstant = instant;
      lastPrayedAt = log.prayedAt;
    }
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
    recentWindowStart,
    recentCount: dailyCounts.reduce(
      (count, item) => item.date >= recentWindowStart ? count + item.count : count,
      0
    ),
    dailyCounts
  };
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
