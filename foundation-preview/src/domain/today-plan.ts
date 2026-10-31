import type { RhythmPreview } from './preview-data.ts';
import { rhythmTimeValueFromLabel } from './rhythm-schedule.ts';

export const DEFAULT_TODAY_BLOCKS = [
  { id: 'early', name: 'Early morning', start: '05:30', timeValue: 'early-morning' },
  { id: 'morning', name: 'Morning', start: '09:00', timeValue: 'morning' },
  { id: 'lunch', name: 'Lunch', start: '11:30', timeValue: 'lunch' },
  { id: 'afternoon', name: 'Afternoon', start: '13:30', timeValue: 'afternoon' },
  { id: 'commute', name: 'Way home', start: '16:30', timeValue: 'way-home' },
  { id: 'evening', name: 'Evening', start: '18:00', timeValue: 'evening' },
  { id: 'bedtime', name: 'Bedtime', start: '21:30', timeValue: 'bedtime' }
] as const;

export type TodayBlockId = (typeof DEFAULT_TODAY_BLOCKS)[number]['id'];
export type TodayFocusId = 'now' | 'everything-today' | TodayBlockId;
export type TodayItemType = 'scheduled' | 'anytime' | 'all-day';

export type TodayPlanGroup = {
  id: string;
  title: string;
  rhythms: readonly RhythmPreview[];
};

function timeMinutes(value: string): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTime(value: string): string {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, '0')}${hours < 12 ? 'am' : 'pm'}`;
}

export function currentTodayBlock(instant: Date): TodayBlockId {
  const minute = instant.getHours() * 60 + instant.getMinutes();
  let current = DEFAULT_TODAY_BLOCKS.at(-1)!.id;
  for (const block of DEFAULT_TODAY_BLOCKS) {
    if (minute >= timeMinutes(block.start)) current = block.id;
  }
  return current;
}

export function todayBlockRange(blockId: TodayBlockId): string {
  const index = DEFAULT_TODAY_BLOCKS.findIndex(block => block.id === blockId);
  const block = DEFAULT_TODAY_BLOCKS[index]!;
  const next = DEFAULT_TODAY_BLOCKS[(index + 1) % DEFAULT_TODAY_BLOCKS.length]!;
  return `${formatTime(block.start)} – ${formatTime(next.start)}${index === DEFAULT_TODAY_BLOCKS.length - 1 ? ' (next day)' : ''}`;
}

export function todayFocusLabel(focus: TodayFocusId, instant: Date): string {
  if (focus === 'now') return 'Now';
  if (focus === 'everything-today') return 'Everything today';
  return DEFAULT_TODAY_BLOCKS.find(block => block.id === focus)?.name ?? DEFAULT_TODAY_BLOCKS.find(block => block.id === currentTodayBlock(instant))!.name;
}

function rhythmTimeValue(rhythm: RhythmPreview) {
  if (rhythm.timeOfDay) return rhythm.timeOfDay;
  return rhythmTimeValueFromLabel(rhythm.timeLabel ?? '');
}

function scheduledInBlock(rhythm: RhythmPreview, blockId: TodayBlockId, currentBlockId: TodayBlockId): boolean {
  const value = rhythmTimeValue(rhythm);
  if (value === 'anytime' || value === 'all-day') return false;
  const block = DEFAULT_TODAY_BLOCKS.find(candidate => candidate.id === blockId)!;
  return value === undefined ? blockId === currentBlockId : value === block.timeValue;
}

export function selectTodayPlanGroups(
  rhythms: readonly RhythmPreview[],
  itemType: TodayItemType,
  focus: TodayFocusId,
  instant: Date
): TodayPlanGroup[] {
  if (itemType === 'anytime') {
    const items = rhythms.filter(rhythm => rhythmTimeValue(rhythm) === 'anytime');
    return items.length ? [{ id: 'anytime', title: '', rhythms: items }] : [];
  }
  if (itemType === 'all-day') {
    const items = rhythms.filter(rhythm => rhythmTimeValue(rhythm) === 'all-day');
    return items.length ? [{ id: 'all-day', title: '', rhythms: items }] : [];
  }

  const currentBlockId = currentTodayBlock(instant);
  const blockIds = focus === 'everything-today'
    ? DEFAULT_TODAY_BLOCKS.map(block => block.id)
    : [focus === 'now' ? currentBlockId : focus];

  return blockIds.flatMap(blockId => {
    const block = DEFAULT_TODAY_BLOCKS.find(candidate => candidate.id === blockId)!;
    const items = rhythms.filter(rhythm => scheduledInBlock(rhythm, blockId, currentBlockId));
    return items.length ? [{ id: blockId, title: focus === 'everything-today' ? block.name : '', rhythms: items }] : [];
  });
}

export function todayFocusContext(focus: TodayFocusId, itemType: TodayItemType, instant: Date): string {
  if (itemType === 'anytime') return 'No preferred time';
  if (itemType === 'all-day') return 'Assigned all day';
  if (focus === 'everything-today') return 'Across every time block';
  const blockId = focus === 'now' ? currentTodayBlock(instant) : focus;
  return todayBlockRange(blockId);
}
