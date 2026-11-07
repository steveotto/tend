import type { RhythmPreview } from './preview-data.ts';
import { rhythmTimeValueFromLabel } from './rhythm-schedule.ts';
import {
  createDefaultTimeBlockSettings,
  currentTimeBlock,
  isTimeBlockId,
  rhythmTimeOptionsForBlocks,
  sleepTimeBlockRange,
  timeBlockRange
} from './time-blocks.ts';
import type { TimeBlockId, TimeBlockSettings } from './time-blocks.ts';

const defaultTimeBlocks = createDefaultTimeBlockSettings();

export const DEFAULT_TODAY_BLOCKS = defaultTimeBlocks.blocks.map(block => ({
  ...block,
  timeValue: block.id
}));

export type TodayBlockId = TimeBlockId;
export type TodayFocusId = 'now' | 'everything-today' | TodayBlockId;
export type TodayItemType = 'scheduled' | 'anytime' | 'all-day';
export type TodayViewId = 'now' | 'flexible' | 'all-today';

export type TodayPlanGroup = {
  id: string;
  title: string;
  rhythms: readonly RhythmPreview[];
};

export type TodayPlanSection = TodayPlanGroup & {
  category: TodayItemType;
  range?: string;
};

export function migrateTodayViewSelection(value: unknown): TodayViewId {
  if (value === 'now' || value === 'flexible' || value === 'all-today') return value;
  if (value === 'anytime') return 'flexible';
  if (value === 'all-day' || value === 'all day' || value === 'everything-today'
    || isTimeBlockId(value)) return 'all-today';
  return 'now';
}

export function currentTodayBlock(instant: Date, settings: TimeBlockSettings = defaultTimeBlocks): TodayBlockId | null {
  return currentTimeBlock(instant, settings)?.id ?? null;
}

export function todayBlockRange(blockId: TodayBlockId, settings: TimeBlockSettings = defaultTimeBlocks): string {
  return timeBlockRange(settings, blockId) ?? 'Time block unavailable';
}

export function todayFocusLabel(
  focus: TodayFocusId,
  _instant: Date,
  settings: TimeBlockSettings = defaultTimeBlocks
): string {
  if (focus === 'now') return 'Now';
  if (focus === 'everything-today') return 'Everything today';
  const selectedBlock = settings.blocks.find(block => block.id === focus);
  return selectedBlock?.name ?? 'Now';
}

function rhythmTimeValue(rhythm: RhythmPreview, settings: TimeBlockSettings) {
  if (rhythm.timeOfDay) return rhythm.timeOfDay;
  return rhythmTimeValueFromLabel(rhythm.timeLabel ?? '', rhythmTimeOptionsForBlocks(settings));
}

function scheduledInBlock(
  rhythm: RhythmPreview,
  blockId: TodayBlockId,
  currentBlockId: TodayBlockId | null,
  settings: TimeBlockSettings
): boolean {
  const value = rhythmTimeValue(rhythm, settings);
  if (value === 'anytime' || value === 'all-day') return false;
  return value === undefined ? blockId === currentBlockId : value === blockId;
}

export function selectTodayPlanGroups(
  rhythms: readonly RhythmPreview[],
  itemType: TodayItemType,
  focus: TodayFocusId,
  instant: Date,
  settings: TimeBlockSettings = defaultTimeBlocks
): TodayPlanGroup[] {
  if (itemType === 'anytime') {
    const items = rhythms.filter(rhythm => rhythmTimeValue(rhythm, settings) === 'anytime');
    return items.length ? [{ id: 'anytime', title: '', rhythms: items }] : [];
  }
  if (itemType === 'all-day') {
    const items = rhythms.filter(rhythm => rhythmTimeValue(rhythm, settings) === 'all-day');
    return items.length ? [{ id: 'all-day', title: '', rhythms: items }] : [];
  }

  const currentBlockId = currentTodayBlock(instant, settings);
  if (focus === 'now' && currentBlockId === null) return [];
  const blockIds = focus === 'everything-today'
    ? settings.blocks.map(block => block.id)
    : [focus === 'now' ? currentBlockId! : focus];

  return blockIds.flatMap(blockId => {
    const block = settings.blocks.find(candidate => candidate.id === blockId);
    if (!block) return [];
    const items = rhythms.filter(rhythm => scheduledInBlock(rhythm, blockId, currentBlockId, settings));
    return items.length ? [{ id: blockId, title: focus === 'everything-today' ? block.name : '', rhythms: items }] : [];
  });
}

export function selectTodayPlanSections(
  rhythms: readonly RhythmPreview[],
  view: TodayViewId,
  instant: Date,
  settings: TimeBlockSettings = defaultTimeBlocks
): TodayPlanSection[] {
  const scheduledGroups = selectTodayPlanGroups(rhythms, 'scheduled', 'everything-today', instant, settings)
    .map(group => {
      const blockId = group.id as TodayBlockId;
      return {
        ...group,
        category: 'scheduled' as const,
        range: todayBlockRange(blockId, settings)
      };
    });
  const anytimeGroups = selectTodayPlanGroups(rhythms, 'anytime', 'now', instant, settings)
    .map(group => ({ ...group, title: 'Anytime', category: 'anytime' as const }));
  const allDayGroups = selectTodayPlanGroups(rhythms, 'all-day', 'now', instant, settings)
    .map(group => ({ ...group, title: 'All-day', category: 'all-day' as const }));

  if (view === 'now') {
    const currentBlockId = currentTodayBlock(instant, settings);
    return currentBlockId
      ? scheduledGroups.filter(group => group.id === currentBlockId)
      : [];
  }
  if (view === 'flexible') return [...anytimeGroups, ...allDayGroups];
  return [...scheduledGroups, ...anytimeGroups, ...allDayGroups];
}

export function todayFocusContext(
  focus: TodayFocusId,
  itemType: TodayItemType,
  instant: Date,
  settings: TimeBlockSettings = defaultTimeBlocks
): string {
  if (itemType === 'anytime') return 'No preferred time';
  if (itemType === 'all-day') return 'Assigned all day';
  if (focus === 'everything-today') return 'Across every time block';
  if (focus !== 'now') return todayBlockRange(focus, settings);
  const blockId = currentTodayBlock(instant, settings);
  return blockId ? todayBlockRange(blockId, settings) : `Sleep · ${sleepTimeBlockRange(settings)}`;
}
