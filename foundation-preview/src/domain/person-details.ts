import type { PersonId } from './preview-data.ts';

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
  anniversary?: { monthDay: string };
  connectionStyle?: ConnectionStyle;
};

export type PersonDetailsDraft = {
  relationshipLabel: string;
  birthdayMonthDay: string;
  birthdayYear: string;
  anniversaryMonthDay: string;
  connectionStyle: string;
};

export type PersonDetailsDraftErrors = Partial<Record<keyof PersonDetailsDraft, string>>;

const personIds = new Set<PersonId>([
  'sample-person-avery',
  'sample-person-morgan',
  'sample-person-jordan'
]);
const connectionStyleValues = new Set<string>(connectionStyles.map(style => style.value));

export function personDetailsForId(
  details: readonly PersonDetails[],
  personId: PersonId
): PersonDetails | undefined {
  return details.find(item => item.personId === personId);
}

export function personDetailsDraft(details?: PersonDetails): PersonDetailsDraft {
  return {
    relationshipLabel: details?.relationshipLabel ?? '',
    birthdayMonthDay: details?.birthday?.monthDay ?? '',
    birthdayYear: details?.birthday?.year?.toString() ?? '',
    anniversaryMonthDay: details?.anniversary?.monthDay ?? '',
    connectionStyle: details?.connectionStyle ?? ''
  };
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
  let birthday: PersonDetails['birthday'];
  const birthdayMonthDay = draft.birthdayMonthDay.trim();
  const birthdayYear = draft.birthdayYear.trim();
  if (birthdayMonthDay) {
    if (!isValidMonthDay(birthdayMonthDay)) {
      errors.birthdayMonthDay = 'Enter a valid month and day (MM-DD).';
    } else if (birthdayYear && !/^\d{4}$/.test(birthdayYear)) {
      errors.birthdayYear = 'Enter a four-digit year or leave it blank.';
    } else if (birthdayYear && Number(birthdayYear) > Number(today.slice(0, 4))) {
      errors.birthdayYear = 'Birth year cannot be in the future.';
    } else if (birthdayYear
      && (!isValidCalendarDate(`${birthdayYear}-${birthdayMonthDay}`)
        || `${birthdayYear}-${birthdayMonthDay}` > today)) {
      errors.birthdayYear = 'Enter a valid birthday that is not in the future.';
    } else {
      birthday = {
        monthDay: birthdayMonthDay,
        ...(birthdayYear ? { year: Number(birthdayYear) } : {})
      };
    }
  } else if (birthdayYear) {
    errors.birthdayMonthDay = 'Enter a month and day or clear the birth year.';
  }
  let anniversary: PersonDetails['anniversary'];
  const anniversaryMonthDay = draft.anniversaryMonthDay.trim();
  if (anniversaryMonthDay) {
    if (!isValidMonthDay(anniversaryMonthDay)) {
      errors.anniversaryMonthDay = 'Enter a valid month and day (MM-DD).';
    } else {
      anniversary = { monthDay: anniversaryMonthDay };
    }
  }
  if (draft.connectionStyle && !connectionStyleValues.has(draft.connectionStyle)) {
    errors.connectionStyle = 'Choose a supported connection style.';
  }
  if (Object.keys(errors).length > 0) return { valid: false, errors };

  const result: Omit<PersonDetails, 'personId'> = {
    ...(draft.relationshipLabel.trim() ? { relationshipLabel: draft.relationshipLabel } : {}),
    ...(birthday ? { birthday } : {}),
    ...(anniversary ? { anniversary } : {}),
    ...(draft.connectionStyle ? { connectionStyle: draft.connectionStyle as ConnectionStyle } : {})
  };
  return Object.keys(result).length ? { valid: true, details: result } : { valid: true };
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
  today: string
): value is PersonDetails[] {
  if (!Array.isArray(value)) return false;
  const seen = new Set<string>();
  for (const raw of value) {
    if (!isRecord(raw) || !onlyKeys(raw, ['personId', 'relationshipLabel', 'birthday', 'anniversary', 'connectionStyle'])
      || typeof raw.personId !== 'string' || !personIds.has(raw.personId as PersonId)
      || seen.has(raw.personId)) return false;
    seen.add(raw.personId);
    if (raw.relationshipLabel !== undefined
      && (typeof raw.relationshipLabel !== 'string' || !raw.relationshipLabel.trim()
        || raw.relationshipLabel.length > 80)) return false;
    if (raw.connectionStyle !== undefined
      && (typeof raw.connectionStyle !== 'string' || !connectionStyleValues.has(raw.connectionStyle))) return false;
    if (raw.birthday !== undefined) {
      if (!isRecord(raw.birthday) || !onlyKeys(raw.birthday, ['monthDay', 'year'])
        || typeof raw.birthday.monthDay !== 'string' || !isValidMonthDay(raw.birthday.monthDay)) return false;
      if (raw.birthday.year !== undefined) {
        const fullBirthday = `${raw.birthday.year}-${raw.birthday.monthDay}`;
        if (typeof raw.birthday.year !== 'number' || !Number.isInteger(raw.birthday.year)
          || raw.birthday.year < 1 || raw.birthday.year > Number(today.slice(0, 4))
          || !isValidCalendarDate(fullBirthday) || fullBirthday > today) return false;
      }
    }
    if (raw.anniversary !== undefined
      && (!isRecord(raw.anniversary) || !onlyKeys(raw.anniversary, ['monthDay'])
        || typeof raw.anniversary.monthDay !== 'string' || !isValidMonthDay(raw.anniversary.monthDay))) return false;
  }
  return true;
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
