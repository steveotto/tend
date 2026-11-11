import { prayerRequestHistorySummary } from './person-prayers.ts';
import type { PersonPrayerRequest } from './person-prayers.ts';
import type { PersonId, PersonPickerGroup } from './preview-data.ts';
import {
  addCalendarDays,
  calendarDaysInclusive,
  isScheduledDate,
  localDateInTimeZone,
  selectNextScheduledOccurrence
} from './rhythm-occurrences.ts';
import type { RhythmSchedule } from './rhythm-schedule.ts';
import { rhythmTimeLabel } from './rhythm-schedule.ts';
import {
  currentTimeBlock,
  rhythmTimeOptionsForBlocks,
  timeBlockRange
} from './time-blocks.ts';
import type { TimeBlock, TimeBlockId, TimeBlockSettings } from './time-blocks.ts';

export type PrayerTimeframeId = 'now' | 'all-day' | 'all-prayers-today' | TimeBlockId;
export type PrayerTimeframeOption = {
  id: PrayerTimeframeId;
  label: string;
  description: string;
  count: number;
  isCurrent: boolean;
};

export type PrayerSession = {
  requestIds: string[];
  index: number;
  prayedIds: string[];
  ended: boolean;
};

export function selectActivePrayerRequests(
  requests: readonly PersonPrayerRequest[],
  selectedPeople: readonly PersonId[],
  timeframe: PrayerTimeframeId = 'all-day',
  instant = new Date(),
  settings: TimeBlockSettings = { blocks: [], sleepStart: '22:00' },
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
): PersonPrayerRequest[] {
  const selected = new Set(selectedPeople);
  const localDate = localDateInTimeZone(instant, timeZone);
  return requests
    .map((request, index) => ({ request, index }))
    .filter(({ request }) => request.status === 'active'
      && (selected.has(request.personId) || request.sharedWith?.some(id => selected.has(id)))
      && (timeframe === 'all-day' || isPrayerRequestScheduledOn(request, localDate, timeZone))
      && matchesPrayerTimeframe(request, timeframe, instant, settings))
    .sort((left, right) => comparePrayerPriority(
      left.request,
      right.request,
      localDate,
      timeZone,
      settings
    ) || left.index - right.index)
    .map(({ request }) => request);
}

export function isPrayerRequestScheduledOn(
  request: PersonPrayerRequest,
  date: string,
  timeZone = 'UTC'
): boolean {
  if (date < localDateInTimeZone(new Date(request.createdAt), timeZone)) return false;
  return isScheduledDate(prayerSchedule(request), date);
}

export function prayerScore(
  request: PersonPrayerRequest,
  today: string,
  timeZone = 'UTC'
): number | null {
  const schedule = prayerSchedule(request);
  const scoreDate = schedule.endDate && today > schedule.endDate ? schedule.endDate : today;
  const lastPrayed = prayerRequestHistorySummary(request).lastPrayedAt;
  const lastDate = lastPrayed ? localDateInTimeZone(new Date(lastPrayed), timeZone) : null;

  if (lastDate) {
    if (schedule.frequency === 'daily') {
      return Math.max(0, 100 - 10 * Math.max(0, dateDistance(lastDate, scoreDate)));
    }
    const nextDue = nextScheduledDate(request, addCalendarDays(lastDate, 1), timeZone);
    if (!nextDue || scoreDate <= nextDue) return 100;
    const followingDue = nextScheduledDate(request, addCalendarDays(nextDue, 1), timeZone);
    const period = followingDue
      ? dateDistance(nextDue, followingDue)
      : fallbackSchedulePeriod(schedule);
    return Math.max(0, Math.round(
      100 - dateDistance(nextDue, scoreDate) * Math.min(10, 100 / Math.max(1, period))
    ));
  }

  const startDate = localDateInTimeZone(new Date(request.createdAt), timeZone);
  const firstDue = nextScheduledDate(request, startDate, timeZone);
  if (!firstDue || scoreDate <= firstDue) return null;
  const secondDue = nextScheduledDate(request, addCalendarDays(firstDue, 1), timeZone);
  const period = secondDue
    ? dateDistance(firstDue, secondDue)
    : fallbackSchedulePeriod(schedule);
  return Math.max(0, Math.round(
    100 - dateDistance(firstDue, scoreDate) * Math.min(10, 100 / Math.max(1, period))
  ));
}

export function prayerFrequencyLabel(request: PersonPrayerRequest): string {
  const schedule = prayerSchedule(request);
  switch (schedule.frequency) {
    case 'daily': return 'Daily';
    case 'weekly': return schedule.weekdays.length === 1 ? 'Weekly' : 'Select Days';
    case 'monthly': return 'Monthly';
    case 'quarterly': return 'Quarterly';
    case 'yearly': return 'Yearly';
    case 'custom': return `Every ${schedule.interval} ${schedule.unit}`;
  }
}

export function prayerTimeOfDayLabel(
  request: PersonPrayerRequest,
  settings: TimeBlockSettings
): string {
  const options = rhythmTimeOptionsForBlocks(settings);
  return rhythmTimeLabel(request.timeOfDay ?? 'anytime', options);
}

export function togglePrayerSelectionGroup(
  selectedPeople: readonly PersonId[],
  group: Pick<PersonPickerGroup, 'memberIds'>
): PersonId[] {
  const selected = new Set(selectedPeople);
  const allSelected = group.memberIds.length > 0
    && group.memberIds.every(personId => selected.has(personId));
  for (const personId of group.memberIds) {
    if (allSelected) selected.delete(personId);
    else selected.add(personId);
  }
  return [...selected];
}

export function resolvePrayerTimeframeBlock(
  timeframe: PrayerTimeframeId,
  instant: Date,
  settings: TimeBlockSettings
): TimeBlock | null {
  if (timeframe === 'all-day' || timeframe === 'all-prayers-today') return null;
  if (timeframe !== 'now') return settings.blocks.find(block => block.id === timeframe) ?? null;
  return currentTimeBlock(instant, settings) ?? settings.blocks.at(-1) ?? null;
}

export function prayerTimeframeOptions(
  requests: readonly PersonPrayerRequest[],
  selectedPeople: readonly PersonId[],
  instant: Date,
  settings: TimeBlockSettings,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
): PrayerTimeframeOption[] {
  const currentBlock = resolvePrayerTimeframeBlock('now', instant, settings);
  const countFor = (id: PrayerTimeframeId) =>
    selectActivePrayerRequests(requests, selectedPeople, id, instant, settings, timeZone).length;
  return [
    {
      id: 'now',
      label: 'Now',
      description: currentBlock
        ? `${currentBlock.name} · ${timeBlockRange(settings, currentBlock.id) ?? 'Current time block'}`
        : 'Current time block',
      count: countFor(currentBlock?.id ?? 'all-day'),
      isCurrent: true
    },
    ...settings.blocks.map(block => ({
      id: block.id,
      label: block.name,
      description: timeBlockRange(settings, block.id) ?? 'Time range unavailable',
      count: countFor(block.id),
      isCurrent: currentBlock?.id === block.id
    })),
    {
      id: 'all-day',
      label: 'All Day',
      description: 'Any time today',
      count: countFor('all-day'),
      isCurrent: false
    },
    {
      id: 'all-prayers-today',
      label: 'All prayers today',
      description: 'Across every time block',
      count: countFor('all-prayers-today'),
      isCurrent: false
    }
  ];
}

export function createPrayerSession(requests: readonly PersonPrayerRequest[]): PrayerSession | null {
  if (requests.length === 0) return null;
  return {
    requestIds: requests.map(request => request.id),
    index: 0,
    prayedIds: [],
    ended: false
  };
}

export function movePrayerSession(session: PrayerSession, direction: -1 | 1): PrayerSession {
  return {
    ...session,
    index: Math.max(0, Math.min(session.requestIds.length, session.index + direction))
  };
}

export function markPrayerSessionPrayed(
  session: PrayerSession,
  requestId: string
): PrayerSession {
  if (session.ended
    || session.requestIds[session.index] !== requestId
    || session.prayedIds.includes(requestId)) return session;
  return {
    ...session,
    index: session.index + 1,
    prayedIds: [...session.prayedIds, requestId]
  };
}

export function endPrayerSession(session: PrayerSession): PrayerSession {
  return { ...session, ended: true };
}

function matchesPrayerTimeframe(
  request: PersonPrayerRequest,
  timeframe: PrayerTimeframeId,
  instant: Date,
  settings: TimeBlockSettings
): boolean {
  if (timeframe === 'all-day' || timeframe === 'all-prayers-today') return true;
  const block = resolvePrayerTimeframeBlock(timeframe, instant, settings);
  if (!block) return false;
  const timeOfDay = request.timeOfDay ?? 'anytime';
  return timeOfDay === 'anytime' || timeOfDay === block.id;
}

function comparePrayerPriority(
  left: PersonPrayerRequest,
  right: PersonPrayerRequest,
  today: string,
  timeZone: string,
  settings: TimeBlockSettings
): number {
  const leftScore = prayerScore(left, today, timeZone) ?? 101;
  const rightScore = prayerScore(right, today, timeZone) ?? 101;
  if (leftScore !== rightScore) return leftScore - rightScore;
  const rank = prayerTimeRank(left, settings) - prayerTimeRank(right, settings);
  if (rank !== 0) return rank;
  const leftLastPrayed = prayerRequestHistorySummary(left).lastPrayedAt;
  const rightLastPrayed = prayerRequestHistorySummary(right).lastPrayedAt;
  const latestLogOrder = (leftLastPrayed ? Date.parse(leftLastPrayed) : 0)
    - (rightLastPrayed ? Date.parse(rightLastPrayed) : 0);
  return latestLogOrder || left.title.localeCompare(right.title);
}

function prayerTimeRank(request: PersonPrayerRequest, settings: TimeBlockSettings): number {
  const timeOfDay = request.timeOfDay ?? 'anytime';
  if (timeOfDay === 'all-day') return -1;
  const index = settings.blocks.findIndex(block => block.id === timeOfDay);
  return index < 0 ? settings.blocks.length : index;
}

function prayerSchedule(request: PersonPrayerRequest): RhythmSchedule {
  return request.schedule ?? { frequency: 'daily' };
}

function nextScheduledDate(
  request: PersonPrayerRequest,
  asOfDate: string,
  timeZone: string
): string | null {
  const result = selectNextScheduledOccurrence({
    schedule: prayerSchedule(request),
    trackingStartDate: localDateInTimeZone(new Date(request.createdAt), timeZone),
    asOfDate
  });
  return result.kind === 'found' ? result.date : null;
}

function fallbackSchedulePeriod(schedule: RhythmSchedule): number {
  if (schedule.frequency === 'daily') return 1;
  if (schedule.frequency === 'weekly') return 7;
  if (schedule.frequency === 'monthly') return 30;
  if (schedule.frequency === 'quarterly') return 91;
  if (schedule.frequency === 'yearly') return 365;
  if (schedule.unit === 'days') return schedule.interval;
  if (schedule.unit === 'weeks') return schedule.interval * 7;
  if (schedule.unit === 'months') return schedule.interval * 30;
  return schedule.interval * 365;
}

function dateDistance(start: string, end: string): number {
  return calendarDaysInclusive(start, end) - 1;
}
