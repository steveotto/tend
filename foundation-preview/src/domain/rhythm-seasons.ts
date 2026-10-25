import { isValidDate } from './money-goals.ts';
import { rhythmSeasonPaletteTokens } from './rhythm-schedule.ts';
import type {
  RhythmLocalDate,
  RhythmSchedule,
  RhythmScheduleHistorySegment,
  RhythmScheduleSegment
} from './rhythm-schedule.ts';

export function rhythmSeasonId(rhythmId: string, startDate: RhythmLocalDate): string {
  return `season:${rhythmId}:${startDate}`;
}

export function rhythmSeasonPaletteForId(id: string): RhythmScheduleSegment['paletteToken'] {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return rhythmSeasonPaletteTokens[(hash >>> 0) % rhythmSeasonPaletteTokens.length]!;
}

export function createRhythmSeason(
  rhythmId: string,
  startDate: RhythmLocalDate,
  schedule: RhythmSchedule,
  timeOfDay?: RhythmScheduleSegment['timeOfDay'],
  id?: string
): RhythmScheduleSegment {
  const stableId = id ?? rhythmSeasonId(rhythmId, startDate);
  return {
    kind: 'scheduled',
    id: stableId,
    startDate,
    schedule,
    ...(timeOfDay === undefined ? {} : { timeOfDay }),
    paletteToken: rhythmSeasonPaletteForId(stableId)
  };
}

export function createUnknownRhythmSeason(
  rhythmId: string,
  startDate: RhythmLocalDate,
  descriptiveCadence?: string
): Extract<RhythmScheduleHistorySegment, { kind: 'unknown' }> {
  const id = `${rhythmSeasonId(rhythmId, startDate)}:unknown`;
  return {
    kind: 'unknown',
    id,
    startDate,
    ...(descriptiveCadence === undefined ? {} : { descriptiveCadence }),
    paletteToken: rhythmSeasonPaletteForId(id)
  };
}

export function rhythmSeasonForDate(
  seasons: readonly RhythmScheduleHistorySegment[],
  date: string
): RhythmScheduleHistorySegment | undefined {
  if (!isValidDate(date)) return undefined;
  let current: RhythmScheduleHistorySegment | undefined;
  for (const season of seasons) {
    if (season.startDate > date) break;
    current = season;
  }
  return current;
}

export function rhythmSeasonInclusiveEndDate(
  seasons: readonly RhythmScheduleHistorySegment[],
  index: number
): RhythmLocalDate | undefined {
  const next = seasons[index + 1];
  if (!next) return undefined;
  const [year, month, day] = next.startDate.split('-').map(Number);
  const end = new Date(0);
  end.setUTCFullYear(year!, month! - 1, day! - 1);
  end.setUTCHours(0, 0, 0, 0);
  return [
    String(end.getUTCFullYear()).padStart(4, '0'),
    String(end.getUTCMonth() + 1).padStart(2, '0'),
    String(end.getUTCDate()).padStart(2, '0')
  ].join('-');
}
