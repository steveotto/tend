import type { CalendarEvent } from './calendar-events.ts';
import { zonedWallTimeToInstant } from './calendar-events.ts';
import type { DatedRhythmCompletion } from './rhythm-completion.ts';
import type { FriendshipData } from './friendships.ts';
import { latestValidConnectionForPerson, formatConnectionRecency } from './friendships.ts';
import type { PersonPreview, RhythmPreview } from './preview-data.ts';
import { localDateInTimeZone, addCalendarDays } from './rhythm-occurrences.ts';
import { rhythmScheduleForDate, rhythmTimeValueFromLabel } from './rhythm-schedule.ts';
import type { RhythmTimeValue } from './rhythm-schedule.ts';
import { isScheduledDate } from './rhythm-occurrences.ts';
import { currentTimeBlock, rhythmTimeOptionsForBlocks } from './time-blocks.ts';
import type { TimeBlockId, TimeBlockSettings } from './time-blocks.ts';

export type FocusWindow = {
  blockId: TimeBlockId;
  name: string;
  start: number;
  end: number;
  nextName: string | null;
};

export type FocusRhythmItem = {
  kind: 'rhythm';
  rhythmId: string;
  personIds: readonly string[];
  title: string;
  time: number;
  timeLabel: string;
  overdueDate: string | null;
};

export type FocusCalendarItem = {
  kind: 'calendar';
  id: string;
  title: string;
  time: number;
  endTime: number;
  allDay: boolean;
  sourceName: string;
};

export type FocusItem = FocusRhythmItem | FocusCalendarItem;

export type FocusPersonNotice = {
  personId: string;
  score: number;
  recencyLabel: string;
};

export type FocusData = {
  window: FocusWindow;
  items: readonly FocusItem[];
  people: readonly FocusPersonNotice[];
};

function timeMinutes(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return Number.NaN;
  return Number(match[1]) * 60 + Number(match[2]);
}

function wallTimeInstant(date: string, time: string, timeZone: string): number {
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  const [year, month, day] = date.split('-').map(Number);
  return zonedWallTimeToInstant({
    year: year!,
    month: month!,
    day: day!,
    hour,
    minute,
    second: 0
  }, timeZone);
}

export function selectFocusWindow(
  instant: Date,
  settings: TimeBlockSettings,
  timeZone: string,
  blockId?: TimeBlockId
): FocusWindow | null {
  if (!settings.blocks.length) return null;
  const sorted = [...settings.blocks].sort((a, b) => timeMinutes(a.start) - timeMinutes(b.start));
  const current = blockId
    ? sorted.find(block => block.id === blockId) ?? null
    : currentTimeBlock(instant, settings) ?? sorted[0]!;
  if (!current) return null;
  const localDate = localDateInTimeZone(instant, timeZone);
  const currentIndex = sorted.findIndex(block => block.id === current.id);
  const next = sorted[currentIndex + 1] ?? null;
  const blockStart = wallTimeInstant(localDate, current.start, timeZone);
  const end = next
    ? wallTimeInstant(localDate, next.start, timeZone)
    : wallTimeInstant(addCalendarDays(localDate, 1), '00:00', timeZone);
  return {
    blockId: current.id,
    name: current.name,
    start: Math.max(instant.getTime(), blockStart),
    end: end > instant.getTime() ? end : instant.getTime(),
    nextName: next?.name ?? null
  };
}

function rhythmTimeValue(rhythm: RhythmPreview, settings: TimeBlockSettings): RhythmTimeValue | undefined {
  if (rhythm.timeOfDay) return rhythm.timeOfDay;
  return rhythmTimeValueFromLabel(rhythm.timeLabel ?? '', rhythmTimeOptionsForBlocks(settings));
}

function formatFocusTime(instant: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(instant)).replace(':00', '');
}

function rhythmCompletedOnDate(
  rhythmId: string,
  date: string,
  completedRhythmIds: ReadonlySet<string>,
  datedCompletions: readonly DatedRhythmCompletion[]
): boolean {
  return completedRhythmIds.has(rhythmId)
    || datedCompletions.some(record => record.rhythmId === rhythmId && record.effectiveDate === date);
}

function overdueScheduledDate(
  rhythm: RhythmPreview,
  today: string,
  completedRhythmIds: ReadonlySet<string>,
  datedCompletions: readonly DatedRhythmCompletion[]
): string | null {
  const schedule = rhythmScheduleForDate(rhythm, today);
  if (!schedule) return null;
  let cursor = addCalendarDays(today, -366);
  if (rhythm.scoring?.trackingStartDate && cursor < rhythm.scoring.trackingStartDate) {
    cursor = rhythm.scoring.trackingStartDate;
  }
  while (cursor < today) {
    const dateSchedule = rhythmScheduleForDate(rhythm, cursor);
    if (dateSchedule
      && isScheduledDate(dateSchedule, cursor)
      && !rhythmCompletedOnDate(rhythm.id, cursor, completedRhythmIds, datedCompletions)) {
      return cursor;
    }
    cursor = addCalendarDays(cursor, 1);
  }
  return null;
}

export function selectFocusData(input: {
  instant: Date;
  timeZone: string;
  settings: TimeBlockSettings;
  rhythms: readonly RhythmPreview[];
  people: readonly PersonPreview[];
  friendships: FriendshipData;
  personHealthScores: ReadonlyMap<string, number | null>;
  calendarAvailable: boolean;
  calendarEvents: readonly CalendarEvent[];
  completedRhythmIds: ReadonlySet<string>;
  datedCompletions: readonly DatedRhythmCompletion[];
  blockId?: TimeBlockId;
}): FocusData | null {
  const focusWindow = selectFocusWindow(input.instant, input.settings, input.timeZone, input.blockId);
  if (!focusWindow) return null;

  const today = localDateInTimeZone(input.instant, input.timeZone);
  const items: FocusItem[] = [];
  const coveredPeople = new Set<string>();

  for (const event of input.calendarAvailable ? input.calendarEvents : []) {
    if (event.allDay || event.startsAt >= focusWindow.end || event.endsAt <= focusWindow.start) continue;
    items.push({
      kind: 'calendar',
      id: event.id,
      title: event.title,
      time: Math.max(event.startsAt, focusWindow.start),
      endTime: event.endsAt,
      allDay: event.allDay,
      sourceName: event.sourceName
    });
  }

  for (const person of input.people) {
    const name = person.displayName.trim();
    if (!name) continue;
    for (const item of items) {
      if (item.kind === 'calendar' && item.title.toLocaleLowerCase().includes(name.toLocaleLowerCase())) {
        coveredPeople.add(person.id);
      }
    }
  }

  for (const rhythm of input.rhythms) {
    const personIds = rhythm.personIds?.filter(personId =>
      input.people.some(person => person.id === personId)
    ) ?? [];
    const value = rhythmTimeValue(rhythm, input.settings);
    if (value === 'anytime' || value === 'all-day' || value === undefined) continue;
    const block = input.settings.blocks.find(candidate => candidate.id === value);
    if (!block) continue;
    const blockStart = wallTimeInstant(today, block.start, input.timeZone);
    const schedule = rhythmScheduleForDate(rhythm, today);
    const dueToday = schedule !== undefined
      && isScheduledDate(schedule, today)
      && !rhythmCompletedOnDate(rhythm.id, today, input.completedRhythmIds, input.datedCompletions);
    const overdueDate = overdueScheduledDate(
      rhythm,
      today,
      input.completedRhythmIds,
      input.datedCompletions
    );
    if (!dueToday && !overdueDate) continue;
    if (dueToday && value !== focusWindow.blockId) continue;

    const time = dueToday ? Math.max(blockStart, focusWindow.start) : focusWindow.start;
    items.push({
      kind: 'rhythm',
      rhythmId: rhythm.id,
      personIds,
      title: rhythm.title,
      time,
      timeLabel: overdueDate
        ? `Overdue · ${formatFocusTime(time, input.timeZone)}`
        : formatFocusTime(time, input.timeZone),
      overdueDate
    });
    for (const personId of personIds) coveredPeople.add(personId);
  }

  items.sort((left, right) =>
    left.time - right.time
    || (left.kind === 'calendar' ? -1 : right.kind === 'calendar' ? 1 : 0)
    || (left.kind === 'calendar' ? left.title : left.kind === 'rhythm' ? left.title : '')
      .localeCompare(right.kind === 'calendar' ? right.title : right.kind === 'rhythm' ? right.title : '')
  );

  const people = input.people
    .map(person => ({
      person,
      score: input.personHealthScores.get(person.id)
    }))
    .filter((entry): entry is { person: PersonPreview; score: number } =>
      entry.score !== undefined && entry.score !== null && entry.score < 75
    )
    .filter(entry => !coveredPeople.has(entry.person.id))
    .sort((left, right) =>
      left.score - right.score
      || left.person.displayName.localeCompare(right.person.displayName)
    )
    .slice(0, 2)
    .map(({ person, score }) => {
      const connection = latestValidConnectionForPerson(input.friendships, person.id);
      return {
        personId: person.id,
        score,
        recencyLabel: connection
          ? `Last connected ${formatConnectionRecency(connection.date, today)?.toLocaleLowerCase() ?? connection.date}`
          : 'No connection logged'
      };
    });

  return { window: focusWindow, items, people };
}
