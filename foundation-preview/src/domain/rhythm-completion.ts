import { isValidDate } from './money-goals.ts';

export type CompletionDraft = {
  effectiveDate: string;
  hour: number;
  minute: number;
  period: 'AM' | 'PM';
  memory: string;
};

export type DatedRhythmCompletion = {
  id: string;
  rhythmId: string;
  effectiveDate: string;
  localTime: string;
  timeZone: string;
  completedAt: string;
  recordedAt: string;
  memory?: string;
};

export type RhythmCompletionRecord = {
  id: string;
  rhythmId: string;
  effectiveDate: string;
  localTime?: string;
  timeZone?: string;
  completedAt?: string;
  recordedAt?: string;
  memory?: string;
};

export type ActiveRhythmCompletion = {
  rhythmId: string;
  completionId: string;
};

export type CompletionValidationResult =
  | { valid: true; record: DatedRhythmCompletion }
  | { valid: false; errors: Partial<Record<'effectiveDate' | 'time' | 'memory', string>> };

export type CompletionEditValidationResult =
  | { valid: true; record: RhythmCompletionRecord }
  | { valid: false; errors: Partial<Record<'effectiveDate' | 'time' | 'memory', string>> };

export type CompletionDraftErrors = Partial<Record<'effectiveDate' | 'time' | 'memory', string>>;

function currentTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function localDateInZone(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(value);
  const fields = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

export function prepareUndatedRhythmCompletionEdit(
  input: Pick<RhythmCompletionRecord, 'id' | 'rhythmId' | 'effectiveDate' | 'memory'>,
  now: Date
): CompletionEditValidationResult {
  const errors: CompletionDraftErrors = {};
  if (!isValidDate(input.effectiveDate) || input.effectiveDate > localDateInZone(now, currentTimeZone())) {
    errors.effectiveDate = 'Choose a valid date that is not in the future.';
  }
  if (input.memory && input.memory.length > 1000) errors.memory = 'Notes must be 1,000 characters or fewer.';
  if (!Number.isFinite(now.getTime())) errors.effectiveDate = 'The current date is unavailable.';
  if (Object.keys(errors).length) return { valid: false, errors };

  return {
    valid: true,
    record: {
      id: input.id,
      rhythmId: input.rhythmId,
      effectiveDate: input.effectiveDate,
      ...(input.memory?.trim() ? { memory: input.memory } : {})
    }
  };
}

export function prepareDatedRhythmCompletion(
  input: CompletionDraft & {
    id: string;
    rhythmId: string;
    timeZone: string;
  },
  now: Date
): CompletionValidationResult {
  const errors: CompletionDraftErrors = {};
  if (!isValidDate(input.effectiveDate)) {
    errors.effectiveDate = 'Choose a valid date.';
  }
  if (!Number.isInteger(input.hour) || input.hour < 1 || input.hour > 12
    || !Number.isInteger(input.minute) || input.minute < 0 || input.minute > 59
    || (input.period !== 'AM' && input.period !== 'PM')) {
    errors.time = 'Choose a valid time.';
  }
  if (input.memory.length > 1000) errors.memory = 'Notes must be 1,000 characters or fewer.';
  if (!Number.isFinite(now.getTime())) errors.time = 'The current time is unavailable.';
  if (Object.keys(errors).length > 0) return { valid: false, errors };

  const hour24 = (input.hour % 12) + (input.period === 'PM' ? 12 : 0);
  const localTime = `${String(hour24).padStart(2, '0')}:${String(input.minute).padStart(2, '0')}`;
  let timeZone: string;
  let completedAt: Date;
  try {
    timeZone = new Intl.DateTimeFormat('en-US', { timeZone: input.timeZone }).resolvedOptions().timeZone;
    completedAt = localDateTimeInZone(input.effectiveDate, localTime, timeZone);
  } catch {
    return { valid: false, errors: { time: 'The selected local time is not valid in this time zone.' } };
  }

  if (completedAt.getTime() > now.getTime()) {
    return { valid: false, errors: { time: 'Choose a time that is not in the future.' } };
  }

  const record: DatedRhythmCompletion = {
    id: input.id,
    rhythmId: input.rhythmId,
    effectiveDate: input.effectiveDate,
    localTime,
    timeZone,
    completedAt: completedAt.toISOString(),
    recordedAt: now.toISOString(),
    ...(input.memory.trim() ? { memory: input.memory } : {})
  };
  return { valid: true, record };
}

export function localDateTimeInZone(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const targetUtc = Date.UTC(year!, month! - 1, day!, hour!, minute!);
  let instant = targetUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date(instant));
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    const representedUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute)
    );
    instant += targetUtc - representedUtc;
  }

  const converted = new Date(instant);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(converted);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  if (Number(values.year) !== year || Number(values.month) !== month || Number(values.day) !== day
    || Number(values.hour) !== hour || Number(values.minute) !== minute) {
    throw new Error('The selected local time does not exist.');
  }
  return converted;
}

export function removeActionCompletion(
  records: readonly DatedRhythmCompletion[],
  active: readonly ActiveRhythmCompletion[],
  rhythmId: string
): {
  records: DatedRhythmCompletion[];
  active: ActiveRhythmCompletion[];
  removedRecordId?: string;
} {
  const action = active.find(item => item.rhythmId === rhythmId);
  if (!action) return { records: [...records], active: [...active] };
  return {
    records: records.filter(item => item.id !== action.completionId),
    active: active.filter(item => item.rhythmId !== rhythmId),
    removedRecordId: action.completionId
  };
}

export function deleteDatedCompletion(
  records: readonly DatedRhythmCompletion[],
  active: readonly ActiveRhythmCompletion[],
  completedRhythmIds: readonly string[],
  completionId: string
): {
  records: DatedRhythmCompletion[];
  active: ActiveRhythmCompletion[];
  completedRhythmIds: string[];
} {
  const record = records.find(item => item.id === completionId);
  if (!record) {
    return {
      records: [...records],
      active: [...active],
      completedRhythmIds: [...completedRhythmIds]
    };
  }

  const removedActiveLink = active.some(item =>
    item.rhythmId === record.rhythmId && item.completionId === completionId
  );
  const remainingRecords = records.filter(item => item.id !== completionId);
  const hasRemainingRhythmRecords = remainingRecords.some(item => item.rhythmId === record.rhythmId);

  return {
    records: remainingRecords,
    active: active.filter(item => item.completionId !== completionId),
    completedRhythmIds: removedActiveLink && !hasRemainingRhythmRecords
      ? completedRhythmIds.filter(id => id !== record.rhythmId)
      : [...completedRhythmIds]
  };
}
