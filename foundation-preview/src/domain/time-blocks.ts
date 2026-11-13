import type { RhythmTimeOption, RhythmTimeValue } from './rhythm-schedule.ts';

export type TimeBlockId = Exclude<RhythmTimeValue, 'anytime' | 'all-day'>;

export type TimeBlock = {
  id: TimeBlockId;
  name: string;
  start: string;
};

export type TimeBlockSettings = {
  blocks: TimeBlock[];
  sleepStart: string;
};

export const DEFAULT_TIME_BLOCK_SETTINGS: Readonly<TimeBlockSettings> = {
  blocks: [
    { id: 'early-morning', name: 'Early morning', start: '05:30' },
    { id: 'morning', name: 'Morning', start: '09:00' },
    { id: 'lunch', name: 'Lunch', start: '11:30' },
    { id: 'afternoon', name: 'Afternoon', start: '13:30' },
    { id: 'way-home', name: 'Way home', start: '16:30' },
    { id: 'evening', name: 'Evening', start: '18:00' },
    { id: 'bedtime', name: 'Bedtime', start: '21:30' }
  ],
  sleepStart: '22:00'
};

export type TimeBlockValidation =
  | { valid: true; settings: TimeBlockSettings }
  | { valid: false; errors: string[] };

const builtInIds = new Set([
  'early-morning',
  'morning',
  'lunch',
  'afternoon',
  'way-home',
  'evening',
  'bedtime'
]);
const customIdPattern = /^custom-time-block:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function isTimeBlockId(value: unknown): value is TimeBlockId {
  return typeof value === 'string' && (builtInIds.has(value) || customIdPattern.test(value));
}

export function createDefaultTimeBlockSettings(): TimeBlockSettings {
  return {
    blocks: DEFAULT_TIME_BLOCK_SETTINGS.blocks.map(block => ({ ...block })),
    sleepStart: DEFAULT_TIME_BLOCK_SETTINGS.sleepStart
  };
}

export function rhythmTimeOptionsForBlocks(settings: TimeBlockSettings): RhythmTimeOption[] {
  return [
    { value: 'anytime', label: 'Anytime' },
    { value: 'all-day', label: 'All day' },
    ...settings.blocks.map(block => ({ value: block.id, label: block.name }))
  ];
}

export function sortTimeBlocks(blocks: readonly TimeBlock[]): TimeBlock[] {
  return [...blocks].sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
}

export function validateTimeBlockSettings(value: unknown): TimeBlockValidation {
  const errors: string[] = [];
  if (!isRecord(value) || !hasOnlyKeys(value, ['blocks', 'sleepStart']) || !Array.isArray(value.blocks)) {
    return { valid: false, errors: ['Time block settings have an invalid structure.'] };
  }
  if (value.blocks.length === 0) errors.push('Keep at least one visible time block.');
  if (value.blocks.some(block => !isValidTimeBlock(block))) {
    return { valid: false, errors: [...errors, 'Each time block needs a stable ID, name, and valid start time.'] };
  }

  const blocks = value.blocks as TimeBlock[];
  const ids = new Set<string>();
  const names = new Set<string>();
  let previousStart = -1;
  for (const block of blocks) {
    const minutes = timeMinutes(block.start);
    if (ids.has(block.id)) errors.push('Time block IDs must be unique.');
    if (names.has(block.name.trim().toLocaleLowerCase())) errors.push('Time block names must be unique.');
    if (minutes <= previousStart) errors.push('Time blocks must be ordered chronologically with distinct start times.');
    ids.add(block.id);
    names.add(block.name.trim().toLocaleLowerCase());
    previousStart = minutes;
  }
  if (typeof value.sleepStart !== 'string' || !timePattern.test(value.sleepStart)) {
    errors.push('Choose a valid Sleep start time.');
  } else if (blocks.length > 0 && timeMinutes(value.sleepStart) <= timeMinutes(blocks.at(-1)!.start)) {
    errors.push('Sleep must start after the last visible time block.');
  }

  return errors.length
    ? { valid: false, errors: [...new Set(errors)] }
    : {
        valid: true,
        settings: {
          blocks: blocks.map(block => ({ ...block })),
          sleepStart: value.sleepStart as string
        }
      };
}

export function assignedTimeBlockIds(
  rhythms: readonly {
    timeOfDay?: RhythmTimeValue;
    scoring?: { scheduleHistory?: readonly { kind: string; timeOfDay?: RhythmTimeValue }[] };
  }[]
): ReadonlySet<TimeBlockId> {
  const assigned = new Set<TimeBlockId>();
  for (const rhythm of rhythms) {
    if (isTimeBlockId(rhythm.timeOfDay)) assigned.add(rhythm.timeOfDay);
    for (const season of rhythm.scoring?.scheduleHistory ?? []) {
      if (season.kind === 'scheduled' && isTimeBlockId(season.timeOfDay)) assigned.add(season.timeOfDay);
    }
  }
  return assigned;
}

export function formatTimeBlockTime(value: string): string {
  if (!timePattern.test(value)) return '—';
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')}${hours < 12 ? 'am' : 'pm'}`;
}

export function timeBlockRange(settings: TimeBlockSettings, blockId: TimeBlockId): string | undefined {
  const index = settings.blocks.findIndex(block => block.id === blockId);
  const block = settings.blocks[index];
  if (!block) return undefined;
  const end = settings.blocks[index + 1]?.start ?? settings.sleepStart;
  return `${formatTimeBlockTime(block.start)} – ${formatTimeBlockTime(end)}`;
}

export function sleepTimeBlockRange(settings: TimeBlockSettings): string {
  const first = settings.blocks[0];
  if (!first) return `${formatTimeBlockTime(settings.sleepStart)} – —`;
  return `${formatTimeBlockTime(settings.sleepStart)} – ${formatTimeBlockTime(first.start)} (next day)`;
}

export function currentTimeBlock(
  instant: Date,
  settings: TimeBlockSettings
): TimeBlock | null {
  const first = settings.blocks[0];
  const last = settings.blocks.at(-1);
  if (!first || !last) return null;
  const minute = instant.getHours() * 60 + instant.getMinutes();
  const firstMinute = timeMinutes(first.start);
  const sleepMinute = timeMinutes(settings.sleepStart);
  if (minute < firstMinute || minute >= sleepMinute) return null;

  let current: TimeBlock | null = null;
  for (const block of settings.blocks) {
    const startMinute = timeMinutes(block.start);
    if (minute >= startMinute) current = block;
    else break;
  }
  return current;
}

export function timeBlockIdFromRhythmValue(value: RhythmTimeValue): TimeBlockId | undefined {
  return isTimeBlockId(value) ? value : undefined;
}

function isValidTimeBlock(value: unknown): value is TimeBlock {
  return isRecord(value)
    && hasOnlyKeys(value, ['id', 'name', 'start'])
    && isTimeBlockId(value.id)
    && typeof value.name === 'string'
    && value.name.trim().length > 0
    && value.name.length <= 48
    && typeof value.start === 'string'
    && timePattern.test(value.start);
}

function timeMinutes(value: string): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every(key => keys.includes(key));
}
