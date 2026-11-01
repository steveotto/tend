import { connectionCadences } from './friendships.ts';
import type { ConnectionCadence } from './friendships.ts';
import { isValidPersonId } from './preview-data.ts';
import type { PersonId } from './preview-data.ts';

export const relationshipGroups = [
  {
    label: 'Family',
    values: [
      'Spouse', 'Son', 'Daughter', 'Bonus son', 'Bonus daughter', 'Father', 'Mother',
      'Brother', 'Sister', 'Son-in-law', 'Daughter-in-law', 'Grandchild', 'Nephew',
      'Niece', 'In-law'
    ]
  },
  {
    label: 'Friends & others',
    values: [
      'Family', 'Friend', 'Close friend', 'Mentor', 'Mentee', 'Coworker', 'Neighbor',
      'Small group friend', 'Accountability partner', 'Pastor', 'Other'
    ]
  }
] as const;

export const connectionStyles = [
  { value: 'qt', label: 'Quality Time' },
  { value: 'wa', label: 'Words of Affirmation' },
  { value: 'as', label: 'Acts of Service' },
  { value: 'gf', label: 'Gifts' },
  { value: 'pt', label: 'Physical Touch' }
] as const;

export type ConnectionStyle = (typeof connectionStyles)[number]['value'];
export type PersonDetails = {
  personId: PersonId;
  relationshipLabel?: string;
  birthday?: { monthDay: string; year?: number };
  anniversary?: { monthDay: string; year?: number };
  connectionStyle?: ConnectionStyle;
  photoDataUrl?: string;
};

export type PersonDetailsDraft = {
  relationshipLabel: string;
  birthdayDate: string;
  birthdayYearUnknown: boolean;
  anniversaryDate: string;
  anniversaryYearUnknown: boolean;
  connectionStyle: string;
  connectionCadence: string;
  photoDataUrl: string;
};

export type PersonDetailsDraftErrors = Partial<Record<keyof PersonDetailsDraft, string>>;
export const PERSON_PHOTO_MAX_DATA_URL_LENGTH = 450_000;

const connectionStyleValues = new Set<string>(connectionStyles.map(style => style.value));
const connectionCadenceValues = new Set<string>(connectionCadences);
const relationshipValues = new Set<string>(relationshipGroups.flatMap(group => [...group.values]));

export function isStandardRelationship(value: string): boolean {
  return relationshipValues.has(value);
}

export function personDetailsForId(
  details: readonly PersonDetails[],
  personId: PersonId
): PersonDetails | undefined {
  return details.find(item => item.personId === personId);
}

export function personDetailsDraft(
  details?: PersonDetails,
  connectionCadence: ConnectionCadence | null = null
): PersonDetailsDraft {
  return {
    relationshipLabel: details?.relationshipLabel ?? '',
    birthdayDate: pickerDate(details?.birthday),
    birthdayYearUnknown: Boolean(details?.birthday && details.birthday.year === undefined),
    anniversaryDate: pickerDate(details?.anniversary),
    anniversaryYearUnknown: Boolean(details?.anniversary && details.anniversary.year === undefined),
    connectionStyle: details?.connectionStyle ?? '',
    connectionCadence: connectionCadence ?? '',
    photoDataUrl: details?.photoDataUrl ?? ''
  };
}

function pickerDate(value?: { monthDay: string; year?: number }): string {
  if (!value) return '';
  return `${(value.year ?? 2000).toString().padStart(4, '0')}-${value.monthDay}`;
}

function datePickerMonthDay(value: string): string {
  return value.slice(5);
}

export function isValidMonthDay(value: string): boolean {
  if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) return false;
  const [month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(2000, month! - 1, day!));
  return date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}

export function validatePersonDetailsDraft(
  draft: PersonDetailsDraft,
  today: string
): { valid: true; details?: Omit<PersonDetails, 'personId'> } | { valid: false; errors: PersonDetailsDraftErrors } {
  const errors: PersonDetailsDraftErrors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || !isValidCalendarDate(today)) {
    return { valid: false, errors: { relationshipLabel: 'The current date is invalid.' } };
  }
  if (draft.relationshipLabel.trim().length > 80) {
    errors.relationshipLabel = 'Use 80 characters or fewer.';
  }
  const birthday = validatePickerDate(
    draft.birthdayDate,
    draft.birthdayYearUnknown,
    today,
    errors,
    'birthdayDate',
    true
  );
  const anniversary = validatePickerDate(
    draft.anniversaryDate,
    draft.anniversaryYearUnknown,
    today,
    errors,
    'anniversaryDate',
    false
  );
  if (draft.connectionStyle && !connectionStyleValues.has(draft.connectionStyle)) {
    errors.connectionStyle = 'Choose a supported love language.';
  }
  if (draft.connectionCadence && !connectionCadenceValues.has(draft.connectionCadence)) {
    errors.connectionCadence = 'Choose a supported connection cadence.';
  }
  if (draft.photoDataUrl && !isValidPersonPhotoDataUrl(draft.photoDataUrl)) {
    errors.photoDataUrl = 'Choose a supported, compressed photo.';
  }
  if (Object.keys(errors).length > 0) return { valid: false, errors };

  const result: Omit<PersonDetails, 'personId'> = {
    ...(draft.relationshipLabel.trim() ? { relationshipLabel: draft.relationshipLabel.trim() } : {}),
    ...(birthday ? { birthday } : {}),
    ...(anniversary ? { anniversary } : {}),
    ...(draft.connectionStyle ? { connectionStyle: draft.connectionStyle as ConnectionStyle } : {}),
    ...(draft.photoDataUrl ? { photoDataUrl: draft.photoDataUrl } : {})
  };
  return Object.keys(result).length ? { valid: true, details: result } : { valid: true };
}

function validatePickerDate(
  value: string,
  yearUnknown: boolean,
  today: string,
  errors: PersonDetailsDraftErrors,
  field: 'birthdayDate' | 'anniversaryDate',
  validatePast: boolean
): { monthDay: string; year?: number } | undefined {
  const date = value.trim();
  if (!date) return undefined;
  const year = Number(date.slice(0, 4));
  const monthDay = datePickerMonthDay(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isValidCalendarDate(date)) {
    errors[field] = 'Choose a valid date.';
    return undefined;
  }
  if (!yearUnknown && validatePast && date > today) {
    errors[field] = 'Birthday cannot be in the future.';
    return undefined;
  }
  if (yearUnknown) {
    if (!isValidMonthDay(monthDay)) {
      errors[field] = 'Choose a valid month and day.';
      return undefined;
    }
    return { monthDay };
  }
  return { monthDay, year };
}

export function isValidPersonPhotoDataUrl(value: string): boolean {
  return value.length <= PERSON_PHOTO_MAX_DATA_URL_LENGTH
    && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}

export function savePersonDetailsCommand(
  current: readonly PersonDetails[],
  personId: PersonId,
  draft: PersonDetailsDraft,
  today: string
): { valid: true; details: PersonDetails[] } | { valid: false; errors: PersonDetailsDraftErrors } {
  const result = validatePersonDetailsDraft(draft, today);
  if (!result.valid) return result;
  const remaining = current.filter(item => item.personId !== personId);
  if (result.details) remaining.push({ personId, ...result.details });
  return { valid: true, details: remaining };
}

export function validatePersonDetailsCollection(
  value: unknown,
  today: string,
  knownPersonIds?: readonly PersonId[]
): value is PersonDetails[] {
  if (!Array.isArray(value)) return false;
  const knownPeople = knownPersonIds === undefined ? null : new Set(knownPersonIds);
  const seen = new Set<string>();
  for (const raw of value) {
    if (!isRecord(raw) || !onlyKeys(raw, [
      'personId', 'relationshipLabel', 'birthday', 'anniversary', 'connectionStyle', 'photoDataUrl'
    ]) || !isValidPersonId(raw.personId)
      || knownPeople !== null && !knownPeople.has(raw.personId)
      || seen.has(raw.personId)) return false;
    seen.add(raw.personId);
    if (raw.relationshipLabel !== undefined
      && (typeof raw.relationshipLabel !== 'string' || !raw.relationshipLabel.trim()
        || raw.relationshipLabel.length > 80)) return false;
    if (raw.connectionStyle !== undefined
      && (typeof raw.connectionStyle !== 'string' || !connectionStyleValues.has(raw.connectionStyle))) return false;
    if (raw.photoDataUrl !== undefined
      && (typeof raw.photoDataUrl !== 'string' || !isValidPersonPhotoDataUrl(raw.photoDataUrl))) return false;
    if (raw.birthday !== undefined && !validateStoredDate(raw.birthday, today, true)) return false;
    if (raw.anniversary !== undefined && !validateStoredDate(raw.anniversary, today, false)) return false;
  }
  return true;
}

function validateStoredDate(value: unknown, today: string, validatePast: boolean): boolean {
  if (!isRecord(value) || !onlyKeys(value, ['monthDay', 'year'])
    || typeof value.monthDay !== 'string' || !isValidMonthDay(value.monthDay)) return false;
  if (value.year === undefined) return true;
  if (typeof value.year !== 'number' || !Number.isInteger(value.year) || value.year < 1) return false;
  const fullDate = `${value.year.toString().padStart(4, '0')}-${value.monthDay}`;
  return isValidCalendarDate(fullDate)
    && (!validatePast || fullDate <= today);
}

export function annualDateSummary(monthDay: string, today: string): { date: string; daysUntil: number } | null {
  if (!isValidMonthDay(monthDay) || !isValidCalendarDate(today)) return null;
  const [month, day] = monthDay.split('-').map(Number);
  const todayDate = dateFromCalendar(today);
  let occurrence = annualOccurrence(todayDate.getUTCFullYear(), month!, day!);
  if (occurrence < todayDate) occurrence = annualOccurrence(todayDate.getUTCFullYear() + 1, month!, day!);
  return {
    date: calendarString(occurrence),
    daysUntil: Math.round((occurrence.getTime() - todayDate.getTime()) / 86_400_000)
  };
}

export function birthdaySummary(
  birthday: NonNullable<PersonDetails['birthday']>,
  today: string
): { label: string; age?: number } | null {
  const next = annualDateSummary(birthday.monthDay, today);
  if (!next) return null;
  const [month, day] = birthday.monthDay.split('-').map(Number);
  const [todayYear] = today.split('-').map(Number);
  const observed = annualOccurrence(todayYear!, month!, day!);
  const daysUntil = next.daysUntil;
  const birthdayLabel = daysUntil === 0
    ? 'Birthday today'
    : `Birthday in ${daysUntil} ${daysUntil === 1 ? 'day' : 'days'}`;
  if (birthday.year === undefined) return { label: birthdayLabel };
  let age = todayYear! - birthday.year;
  if (dateFromCalendar(today) < observed) age -= 1;
  return { label: `${age} · ${birthdayLabel}`, age };
}

export function birthdayCardSummary(
  birthday: NonNullable<PersonDetails['birthday']>,
  today: string
): { dateLabel: string; countdownLabel: string; age?: number } | null {
  const next = annualDateSummary(birthday.monthDay, today);
  const summary = birthdaySummary(birthday, today);
  if (!next || !summary) return null;
  const [year, month, day] = next.date.split('-').map(Number);
  const dateLabel = new Date(year!, month! - 1, day!, 12).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric'
  });
  return {
    dateLabel,
    countdownLabel: next.daysUntil === 0
      ? 'Birthday today'
      : `Birthday in ${next.daysUntil} ${next.daysUntil === 1 ? 'day' : 'days'}`,
    ...(summary.age === undefined ? {} : { age: summary.age })
  };
}

export function anniversarySummary(
  anniversary: NonNullable<PersonDetails['anniversary']>,
  today: string
): string | null {
  const next = annualDateSummary(anniversary.monthDay, today);
  if (!next) return null;
  return next.daysUntil === 0
    ? 'Anniversary today'
    : `Anniversary in ${next.daysUntil} ${next.daysUntil === 1 ? 'day' : 'days'}`;
}

export function connectionStyleLabel(style: ConnectionStyle): string {
  return connectionStyles.find(item => item.value === style)?.label ?? style;
}

function annualOccurrence(year: number, month: number, day: number): Date {
  const observedMonth = month === 2 && day === 29 && !isLeapYear(year) ? 3 : month;
  const observedDay = month === 2 && day === 29 && !isLeapYear(year) ? 1 : day;
  return new Date(Date.UTC(year, observedMonth - 1, observedDay));
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = dateFromCalendar(value);
  return calendarString(date) === value;
}

function dateFromCalendar(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year!, month! - 1, day!);
  return date;
}

function calendarString(date: Date): string {
  return `${date.getUTCFullYear().toString().padStart(4, '0')}-${(date.getUTCMonth() + 1)
    .toString().padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function onlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every(key => keys.includes(key));
}
