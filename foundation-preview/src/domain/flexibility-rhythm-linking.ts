import { foundationRhythmIds } from './foundation-rhythm-associations.ts';
import {
  deleteDatedCompletion,
  prepareDatedRhythmCompletion
} from './rhythm-completion.ts';
import type {
  ActiveRhythmCompletion,
  DatedRhythmCompletion
} from './rhythm-completion.ts';
import {
  hasRhythmOccurrenceForCompletion,
  isPeriodBasedRhythmSchedule,
  rhythmOccurrencePeriod
} from './rhythm-occurrences.ts';
import { rhythmScheduleForDate } from './rhythm-schedule.ts';
import type { FlexibilityData } from './flexibility.ts';
import { validateFlexibilityData } from './flexibility.ts';
import type { RhythmPreview } from './preview-data.ts';

export type FlexibilityRhythmOption = {
  rhythm: RhythmPreview;
  eligible: boolean;
  suggested: boolean;
  explicit: boolean;
  reason?: string;
};

export type FlexibilityCompletionState = {
  datedRhythmCompletions: DatedRhythmCompletion[];
  activeRhythmCompletions: ActiveRhythmCompletion[];
  completedRhythmIds: string[];
  rhythmHistoryIds: string[];
};

export type FlexibilitySaveResult =
  | { valid: true; flexibility: FlexibilityData; completionState: FlexibilityCompletionState }
  | { valid: false; error: string };

export function selectFlexibilityStretchRhythmOptions(
  rhythms: readonly RhythmPreview[],
  archivedRhythms: readonly RhythmPreview[],
  completions: readonly DatedRhythmCompletion[],
  date: string,
  ignoredCompletionId?: string,
  explicitRhythmId?: string
): FlexibilityRhythmOption[] {
  const candidates = [
    ...rhythms.filter(rhythm =>
      foundationRhythmIds(rhythm).includes('health-flexibility')
      || rhythm.id === explicitRhythmId
    ),
    ...archivedRhythms.filter(rhythm => rhythm.id === explicitRhythmId)
  ];

  return candidates
    .filter(rhythm => rhythm.healthLogCapability === 'flexibility'
      && rhythm.categoryIds?.includes('health'))
    .map(rhythm => {
      const explicit = rhythm.id === explicitRhythmId;
      const schedule = rhythmScheduleForDate(rhythm, date);
      let reason: string | undefined;
      if (archivedRhythms.some(item => item.id === rhythm.id)) {
        reason = 'Restore this Rhythm before linking a stretch.';
      } else if (!schedule) {
        reason = 'This Rhythm’s schedule for this date is unavailable.';
      } else if (!hasRhythmOccurrenceForCompletion(schedule, date, rhythm.scoring?.trackingStartDate)) {
        reason = 'This date is not a scheduled occurrence.';
      } else if (hasCompletionForOccurrence(rhythm, completions, schedule, date, ignoredCompletionId)) {
        reason = 'A completion already exists for this Rhythm in this scheduled period.';
      }

      return {
        rhythm,
        eligible: reason === undefined,
        suggested: false,
        explicit,
        ...(reason === undefined ? {} : { reason })
      };
    });
}

export function saveFlexibilityDataCommand(input: {
  previous: FlexibilityData;
  next: FlexibilityData;
  today: string;
  now: Date;
  rhythms: readonly RhythmPreview[];
  archivedRhythmIds: ReadonlySet<string>;
  editableRhythmIds: ReadonlySet<string>;
  completionState: FlexibilityCompletionState;
}): FlexibilitySaveResult {
  if (!validateFlexibilityData(input.previous, input.today)
    || !validateFlexibilityData(input.next, input.today)) {
    return {
      valid: false,
      error: 'Flexibility settings or stretch records are invalid. No changes were saved.'
    };
  }

  const previousSessions = new Map(input.previous.sessions.map(session => [session.id, session]));
  const nextSessions = new Map(input.next.sessions.map(session => [session.id, session]));
  const originalCompletions = new Map(
    input.completionState.datedRhythmCompletions.map(record => [record.id, record])
  );
  let datedRhythmCompletions = [...input.completionState.datedRhythmCompletions];
  let activeRhythmCompletions = [...input.completionState.activeRhythmCompletions];
  let completedRhythmIds = [...input.completionState.completedRhythmIds];
  let rhythmHistoryIds = [...input.completionState.rhythmHistoryIds];

  for (const previous of previousSessions.values()) {
    if (!previous.linkedRhythmId || !previous.completionId) continue;
    const next = nextSessions.get(previous.id);
    const sameAssociation = next?.linkedRhythmId === previous.linkedRhythmId
      && next.completionId === previous.completionId
      && next.date === previous.date;
    if (sameAssociation) continue;

    const owned = datedRhythmCompletions.find(record =>
      record.id === previous.completionId
      && record.rhythmId === previous.linkedRhythmId
      && record.effectiveDate === previous.date
    );
    if (!owned) {
      return {
        valid: false,
        error: 'The linked stretch completion is missing or no longer belongs to this session. No Flexibility changes were saved.'
      };
    }
    const removed = deleteDatedCompletion(
      datedRhythmCompletions,
      activeRhythmCompletions,
      completedRhythmIds,
      previous.completionId
    );
    datedRhythmCompletions = removed.records;
    activeRhythmCompletions = removed.active;
    completedRhythmIds = removed.completedRhythmIds;
  }

  const currentTime = localTimeParts(input.now);
  if (!currentTime) {
    return { valid: false, error: 'The current time is unavailable. No Flexibility changes were saved.' };
  }

  for (const session of input.next.sessions) {
    if (!session.linkedRhythmId || !session.completionId) continue;
    const previous = previousSessions.get(session.id);
    const sameOwnedLink = previous?.linkedRhythmId === session.linkedRhythmId
      && previous.completionId === session.completionId;
    const existing = datedRhythmCompletions.find(record => record.id === session.completionId);
    const previousCompletion = sameOwnedLink
      ? originalCompletions.get(session.completionId)
      : undefined;
    if (existing && !sameOwnedLink) {
      return {
        valid: false,
        error: 'This stretch session references a completion owned by another activity. No Flexibility changes were saved.'
      };
    }
    if (sameOwnedLink && !previousCompletion) {
      return {
        valid: false,
        error: 'The linked stretch completion is missing. No Flexibility changes were saved.'
      };
    }

    const rhythm = input.rhythms.find(item => item.id === session.linkedRhythmId);
    if (!rhythm || rhythm.healthLogCapability !== 'flexibility'
      || !rhythm.categoryIds?.includes('health')
      || !input.editableRhythmIds.has(session.linkedRhythmId)
      || input.archivedRhythmIds.has(session.linkedRhythmId)) {
      return {
        valid: false,
        error: 'The linked Flexibility Rhythm is unavailable. No Flexibility changes were saved.'
      };
    }
    const schedule = rhythmScheduleForDate(rhythm, session.date);
    if (!schedule || !hasRhythmOccurrenceForCompletion(
      schedule,
      session.date,
      rhythm.scoring?.trackingStartDate
    )) {
      return {
        valid: false,
        error: 'The stretch date is not a scheduled occurrence for this Rhythm. No Flexibility changes were saved.'
      };
    }
    if (hasCompletionForOccurrence(rhythm, datedRhythmCompletions, schedule, session.date, session.completionId)) {
      return {
        valid: false,
        error: 'This Flexibility Rhythm occurrence already has completion credit. No changes were saved.'
      };
    }
    if (sameOwnedLink && previous?.date === session.date && existing) continue;

    const time = previousCompletion
      ? parseLocalTime(previousCompletion.localTime)
      : currentTime;
    if (!time) {
      return {
        valid: false,
        error: 'The linked stretch completion time is invalid. No Flexibility changes were saved.'
      };
    }
    const prepared = prepareDatedRhythmCompletion({
      id: session.completionId,
      rhythmId: session.linkedRhythmId,
      effectiveDate: session.date,
      hour: time.hour,
      minute: time.minute,
      period: time.period,
      memory: previousCompletion?.memory ?? '',
      timeZone: previousCompletion?.timeZone ?? currentTime.timeZone
    }, input.now);
    if (!prepared.valid) {
      return {
        valid: false,
        error: prepared.errors.time ?? prepared.errors.effectiveDate
          ?? 'The linked stretch completion is invalid. No Flexibility changes were saved.'
      };
    }
    datedRhythmCompletions.push(prepared.record);
    if (session.date === input.today
      && !activeRhythmCompletions.some(item => item.rhythmId === session.linkedRhythmId)
      && !completedRhythmIds.includes(session.linkedRhythmId)) {
      activeRhythmCompletions.push({
        rhythmId: session.linkedRhythmId,
        completionId: session.completionId
      });
      completedRhythmIds.push(session.linkedRhythmId);
    }
    if (!rhythmHistoryIds.includes(session.linkedRhythmId)) {
      rhythmHistoryIds.push(session.linkedRhythmId);
    }
  }

  return {
    valid: true,
    flexibility: input.next,
    completionState: {
      datedRhythmCompletions,
      activeRhythmCompletions,
      completedRhythmIds,
      rhythmHistoryIds
    }
  };
}

function hasCompletionForOccurrence(
  rhythm: RhythmPreview,
  completions: readonly DatedRhythmCompletion[],
  schedule: NonNullable<ReturnType<typeof rhythmScheduleForDate>>,
  date: string,
  ignoredCompletionId?: string
): boolean {
  const period = isPeriodBasedRhythmSchedule(schedule)
    ? rhythmOccurrencePeriod(schedule, date)
    : null;
  const records = [
    ...(rhythm.completionHistory ?? []),
    ...completions.filter(item => item.rhythmId === rhythm.id)
  ];
  return records.some(record => {
    if (record.id === ignoredCompletionId) return false;
    return period
      ? record.effectiveDate >= period.startDate && record.effectiveDate <= period.endDate
      : record.effectiveDate === date;
  });
}

function localTimeParts(value: Date): {
  hour: number;
  minute: number;
  period: 'AM' | 'PM';
  timeZone: string;
} | null {
  if (!Number.isFinite(value.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).formatToParts(value);
  const hour = Number(parts.find(part => part.type === 'hour')?.value);
  const minute = Number(parts.find(part => part.type === 'minute')?.value);
  const period = parts.find(part => part.type === 'dayPeriod')?.value.toUpperCase();
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || (period !== 'AM' && period !== 'PM')) return null;
  return {
    hour,
    minute,
    period,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };
}

function parseLocalTime(value: string): {
  hour: number;
  minute: number;
  period: 'AM' | 'PM';
} | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  const hour24 = Number(match[1]);
  return {
    hour: hour24 % 12 || 12,
    minute: Number(match[2]),
    period: hour24 >= 12 ? 'PM' : 'AM'
  };
}
