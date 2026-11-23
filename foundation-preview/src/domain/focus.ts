import type { CalendarEvent } from './calendar-events.ts';
import { zonedWallTimeToInstant } from './calendar-events.ts';
import type { DatedRhythmCompletion } from './rhythm-completion.ts';
import type { FriendshipData } from './friendships.ts';
import { latestValidConnectionForPerson, formatConnectionRecency } from './friendships.ts';
import { selectAvailablePersonGroups } from './category-availability.ts';
import { defaultCategoryPreferences } from './category-availability.ts';
import type { CategoryPreferences } from './category-availability.ts';
import type {
  PersonPickerGroup,
  PersonPickerGroupId,
  PersonPreview,
  RhythmPreview
} from './preview-data.ts';
import { addCalendarDays, localDateInTimeZone } from './rhythm-occurrences.ts';
import { rhythmScheduleForDate, rhythmTimeValueFromLabel } from './rhythm-schedule.ts';
import type { RhythmTimeValue } from './rhythm-schedule.ts';
import { isScheduledDate } from './rhythm-occurrences.ts';
import { formatTimeBlockTime, sortTimeBlocks } from './time-blocks.ts';
import type { TimeBlockId, TimeBlockSettings } from './time-blocks.ts';
import { rhythmHealthScore, type RhythmScoreResult } from './rhythm-scoring.ts';

export type FocusRhythmItem = {
  rhythmId: string;
  personIds: readonly string[];
  time: number;
  healthScore: number | null;
  completed: boolean;
};

export type FocusCalendarItem = {
  id: string;
  title: string;
  time: number;
  endTime: number;
  allDay: boolean;
  sourceName: string;
};

export type FocusBlock = {
  id: TimeBlockId | 'sleep';
  name: string;
  localDate: string;
  startsAt: number;
  endsAt: number;
  rangeLabel: string;
  dateLabel: string | null;
  rhythms: readonly FocusRhythmItem[];
  calendarEvents: readonly FocusCalendarItem[];
};

export type FocusPersonNotice = {
  personId: string;
  score: number;
  recencyLabel: string;
};

export type FocusData = {
  blocks: readonly [FocusBlock, FocusBlock, FocusBlock];
  people: readonly FocusPersonNotice[];
};

type FocusBlockSlot = Pick<
  FocusBlock,
  'id' | 'name' | 'localDate' | 'startsAt' | 'endsAt' | 'rangeLabel' | 'dateLabel'
>;

type MutableFocusBlock = FocusBlock & {
  rhythms: FocusRhythmItem[];
  calendarEvents: FocusCalendarItem[];
};

export function selectFocusRhythms(
  rhythms: readonly RhythmPreview[],
  availableCategoryIds: ReadonlySet<string>
): RhythmPreview[] {
  const seenIds = new Set<string>();
  return rhythms.filter(rhythm => {
    const categories = rhythm.categoryIds ?? [];
    if (categories.length > 0 && !categories.some(categoryId => availableCategoryIds.has(categoryId))) {
      return false;
    }
    if (seenIds.has(rhythm.id)) return false;
    seenIds.add(rhythm.id);
    return true;
  });
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

function blockDateLabel(slot: Pick<FocusBlockSlot, 'localDate' | 'endsAt'>, today: string, timeZone: string) {
  const tomorrow = addCalendarDays(today, 1);
  const startDate = slot.localDate;
  const endDate = localDateInTimeZone(new Date(slot.endsAt), timeZone);
  if (startDate === tomorrow) return 'Tomorrow';
  if (startDate === today && endDate === tomorrow) return 'Overnight · into tomorrow';
  if (startDate !== today && endDate === today) return 'Overnight · began yesterday';
  return null;
}

function focusSlotsForDate(date: string, today: string, settings: TimeBlockSettings, timeZone: string): FocusBlockSlot[] {
  const blocks = sortTimeBlocks(settings.blocks);
  if (!blocks.length) return [];
  const slots: FocusBlockSlot[] = blocks.map((block, index) => {
    const nextBlock = blocks[index + 1];
    const startsAt = wallTimeInstant(date, block.start, timeZone);
    const endsAt = wallTimeInstant(date, nextBlock?.start ?? settings.sleepStart, timeZone);
    const slot = {
      id: block.id,
      name: block.name,
      localDate: date,
      startsAt,
      endsAt,
      rangeLabel: `${formatTimeBlockTime(block.start)}–${formatTimeBlockTime(nextBlock?.start ?? settings.sleepStart)}`,
      dateLabel: null
    };
    return { ...slot, dateLabel: blockDateLabel(slot, today, timeZone) };
  });
  const firstBlock = blocks[0]!;
  const startsAt = wallTimeInstant(date, settings.sleepStart, timeZone);
  const endsAt = wallTimeInstant(addCalendarDays(date, 1), firstBlock.start, timeZone);
  const sleepSlot = {
    id: 'sleep' as const,
    name: 'Sleep',
    localDate: date,
    startsAt,
    endsAt,
    rangeLabel: `${formatTimeBlockTime(settings.sleepStart)}–${formatTimeBlockTime(firstBlock.start)}`,
    dateLabel: null
  };
  slots.push({ ...sleepSlot, dateLabel: blockDateLabel(sleepSlot, today, timeZone) });
  return slots;
}

function rhythmTimeValue(rhythm: RhythmPreview, settings: TimeBlockSettings): RhythmTimeValue | undefined {
  if (rhythm.timeOfDay) return rhythm.timeOfDay;
  const options = [
    { value: 'anytime' as const, label: 'Anytime' },
    { value: 'all-day' as const, label: 'All day' },
    ...settings.blocks.map(block => ({ value: block.id, label: block.name }))
  ];
  return rhythmTimeValueFromLabel(rhythm.timeLabel ?? '', options);
}

function rhythmCompletedOnDate(
  rhythmId: string,
  date: string,
  today: string,
  completedRhythmIds: ReadonlySet<string>,
  datedCompletions: readonly DatedRhythmCompletion[]
): boolean {
  return date === today && completedRhythmIds.has(rhythmId)
    || datedCompletions.some(record => record.rhythmId === rhythmId && record.effectiveDate === date);
}

function finiteRhythmHealthScore(scores: ReadonlyMap<string, RhythmScoreResult>, rhythmId: string): number | null {
  const score = rhythmHealthScore(scores.get(rhythmId));
  return score !== null && Number.isFinite(score) ? score : null;
}

function compareRhythmItems(
  left: FocusRhythmItem,
  right: FocusRhythmItem,
  rhythmById: ReadonlyMap<string, RhythmPreview>,
  indexById: ReadonlyMap<string, number>
): number {
  if (left.healthScore !== null || right.healthScore !== null) {
    if (left.healthScore === null) return 1;
    if (right.healthScore === null) return -1;
    if (left.healthScore !== right.healthScore) return left.healthScore - right.healthScore;
  }
  const titleOrder = (rhythmById.get(left.rhythmId)?.title ?? '')
    .localeCompare(rhythmById.get(right.rhythmId)?.title ?? '');
  return titleOrder || (indexById.get(left.rhythmId) ?? 0) - (indexById.get(right.rhythmId) ?? 0);
}

export function selectFocusData(input: {
  instant: Date;
  timeZone: string;
  settings: TimeBlockSettings;
  rhythms: readonly RhythmPreview[];
  people: readonly PersonPreview[];
  peopleGroups?: readonly PersonPickerGroup[];
  categoryPreferences?: CategoryPreferences;
  friendships: FriendshipData;
  rhythmScores: ReadonlyMap<string, RhythmScoreResult>;
  personHealthScores: ReadonlyMap<string, number | null>;
  calendarAvailable: boolean;
  calendarEvents: readonly CalendarEvent[];
  completedRhythmIds: ReadonlySet<string>;
  datedCompletions: readonly DatedRhythmCompletion[];
}): FocusData | null {
  if (!input.settings.blocks.length) return null;
  const instant = input.instant.getTime();
  const today = localDateInTimeZone(input.instant, input.timeZone);
  const timeline = [
    addCalendarDays(today, -1),
    today,
    addCalendarDays(today, 1),
    addCalendarDays(today, 2)
  ].flatMap(date => focusSlotsForDate(date, today, input.settings, input.timeZone));
  const currentIndex = timeline.findIndex(slot => slot.startsAt <= instant && instant < slot.endsAt);
  if (currentIndex < 0) return null;
  const slots = timeline.slice(currentIndex, currentIndex + 3);
  if (slots.length !== 3) return null;
  const blocks: MutableFocusBlock[] = slots.map(slot => ({
    ...slot,
    rhythms: [],
    calendarEvents: []
  }));
  const rhythmById = new Map(input.rhythms.map(rhythm => [rhythm.id, rhythm]));
  const rhythmIndexById = new Map(input.rhythms.map((rhythm, index) => [rhythm.id, index]));
  const peopleById = new Map(input.people.map(person => [person.id, person]));

  if (input.calendarAvailable) {
    const assignedCalendarIds = new Set<string>();
    for (const block of blocks) {
      for (const event of input.calendarEvents) {
        if (event.allDay
          || assignedCalendarIds.has(event.id)
          || event.startsAt >= block.endsAt
          || event.endsAt <= block.startsAt) continue;
        block.calendarEvents.push({
          id: event.id,
          title: event.title,
          time: Math.max(event.startsAt, block.startsAt),
          endTime: event.endsAt,
          allDay: event.allDay,
          sourceName: event.sourceName
        });
        assignedCalendarIds.add(event.id);
      }
      block.calendarEvents.sort((left, right) =>
        left.time - right.time || left.title.localeCompare(right.title) || left.id.localeCompare(right.id)
      );
    }
  }

  const assignedRhythmIds = new Set<string>();
  for (const rhythm of input.rhythms) {
    const personIds = rhythm.personIds?.filter(personId => peopleById.has(personId)) ?? [];
    const value = rhythmTimeValue(rhythm, input.settings);
    if (value === 'anytime' || value === 'all-day' || value === undefined) continue;
    for (const block of blocks) {
      if (block.id !== value || assignedRhythmIds.has(rhythm.id)) continue;
      const schedule = rhythmScheduleForDate(rhythm, block.localDate);
      if (!schedule || !isScheduledDate(schedule, block.localDate)) continue;
      const completed = rhythmCompletedOnDate(
        rhythm.id,
        block.localDate,
        today,
        input.completedRhythmIds,
        input.datedCompletions
      );
      block.rhythms.push({
        rhythmId: rhythm.id,
        personIds,
        time: Math.max(block.startsAt, instant),
        healthScore: finiteRhythmHealthScore(input.rhythmScores, rhythm.id),
        completed
      });
      assignedRhythmIds.add(rhythm.id);
      break;
    }
  }

  for (const block of blocks) {
    block.rhythms.sort((left, right) =>
      compareRhythmItems(left, right, rhythmById, rhythmIndexById)
    );
  }
  const categoryPreferences = input.categoryPreferences ?? defaultCategoryPreferences;
  const partnerCategory: PersonPickerGroupId | null = categoryPreferences.dating
    ? 'dating'
    : categoryPreferences.marriage
      ? 'marriage'
      : null;
  const categoryPriority = new Map<PersonPickerGroupId, number>();
  if (partnerCategory) categoryPriority.set(partnerCategory, 0);
  categoryPriority.set('parenting', partnerCategory ? 1 : 0);
  categoryPriority.set('friends', partnerCategory ? 2 : 1);
  const personPriority = new Map<string, number>();
  for (const group of selectAvailablePersonGroups(
    categoryPreferences,
    input.peopleGroups ?? []
  )) {
    const priority = categoryPriority.get(group.id);
    if (priority === undefined) continue;
    for (const personId of group.memberIds) {
      const current = personPriority.get(personId);
      if (current === undefined || priority < current) personPriority.set(personId, priority);
    }
  }
  const people = input.people
    .map(person => ({
      person,
      priority: personPriority.get(person.id),
      score: input.personHealthScores.get(person.id)
    }))
    .filter((entry): entry is { person: PersonPreview; priority: number; score: number } =>
      entry.priority !== undefined
      && entry.score !== undefined
      && entry.score !== null
      && Number.isFinite(entry.score)
      && entry.score < 70
    )
    .sort((left, right) =>
      left.priority - right.priority
      || left.score - right.score
      || left.person.displayName.localeCompare(right.person.displayName)
      || left.person.id.localeCompare(right.person.id)
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

  return {
    blocks: [blocks[0]!, blocks[1]!, blocks[2]!],
    people
  };
}
