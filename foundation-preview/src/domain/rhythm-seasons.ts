import { isValidDate } from './money-goals.ts';
import { rhythmSeasonPaletteCycleTokens, rhythmSeasonPaletteTokens } from './rhythm-schedule.ts';
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

export function rhythmSeasonPaletteForOrdinal(ordinal: number): RhythmScheduleSegment['paletteToken'] {
  if (!Number.isInteger(ordinal) || ordinal < 0) {
    throw new RangeError('Season palette ordinal must be a non-negative integer.');
  }
  return rhythmSeasonPaletteCycleTokens[ordinal % rhythmSeasonPaletteCycleTokens.length]!;
}

export function rhythmSeasonPaletteAssignments(
  seasons: readonly RhythmScheduleHistorySegment[]
): ReadonlyMap<string, RhythmScheduleSegment['paletteToken']> {
  const assignments = new Map<string, RhythmScheduleSegment['paletteToken']>();
  const recentPaletteColors: RhythmScheduleSegment['paletteToken'][] = [];
  const chronologicalSeasons = [...seasons].sort((left, right) =>
    left.startDate.localeCompare(right.startDate) || left.id.localeCompare(right.id)
  );
  let scheduledOrdinal = 0;
  for (const season of chronologicalSeasons) {
    if (season.kind !== 'scheduled') continue;
    if (recentPaletteColors.length === rhythmSeasonPaletteCycleTokens.length) {
      recentPaletteColors.shift();
    }
    let paletteToken = season.paletteToken;
    const idPaletteToken = rhythmSeasonPaletteForId(season.id);
    const chronologicalPaletteToken = rhythmSeasonPaletteForOrdinal(scheduledOrdinal);
    if (sameRhythmSeasonPaletteColor(paletteToken, idPaletteToken)
      && !sameRhythmSeasonPaletteColor(paletteToken, chronologicalPaletteToken)) {
      paletteToken = chronologicalPaletteToken;
    }
    if (recentPaletteColors.some(recent => sameRhythmSeasonPaletteColor(paletteToken, recent))) {
      const startIndex = rhythmSeasonPaletteCycleTokens.findIndex(token =>
        sameRhythmSeasonPaletteColor(token, chronologicalPaletteToken)
      );
      for (let offset = 0; offset < rhythmSeasonPaletteCycleTokens.length; offset += 1) {
        const candidate = rhythmSeasonPaletteCycleTokens[
          (Math.max(startIndex, 0) + offset) % rhythmSeasonPaletteCycleTokens.length
        ]!;
        if (!recentPaletteColors.some(recent => sameRhythmSeasonPaletteColor(candidate, recent))) {
          paletteToken = candidate;
          break;
        }
      }
    }
    assignments.set(season.id, paletteToken);
    recentPaletteColors.push(paletteToken);
    scheduledOrdinal += 1;
  }
  return assignments;
}

function sameRhythmSeasonPaletteColor(
  left: RhythmScheduleSegment['paletteToken'] | undefined,
  right: RhythmScheduleSegment['paletteToken'] | undefined
): boolean {
  if (left === undefined || right === undefined) return false;
  return (left === 'clay' ? 'ocean' : left) === (right === 'clay' ? 'ocean' : right);
}

export function createRhythmSeason(
  rhythmId: string,
  startDate: RhythmLocalDate,
  schedule: RhythmSchedule,
  timeOfDay?: RhythmScheduleSegment['timeOfDay'],
  id?: string,
  paletteToken?: RhythmScheduleSegment['paletteToken']
): RhythmScheduleSegment {
  const stableId = id ?? rhythmSeasonId(rhythmId, startDate);
  return {
    kind: 'scheduled',
    id: stableId,
    startDate,
    schedule,
    ...(timeOfDay === undefined ? {} : { timeOfDay }),
    paletteToken: paletteToken ?? rhythmSeasonPaletteForId(stableId)
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

export function ensureRhythmSeasonHistoryCoverage(
  rhythmId: string,
  seasons: readonly RhythmScheduleHistorySegment[],
  startDate: RhythmLocalDate
): RhythmScheduleHistorySegment[] {
  if (!isValidDate(startDate)) {
    throw new RangeError('Season history coverage start must be a valid date.');
  }
  const first = seasons[0];
  if (!first || startDate >= first.startDate) return [...seasons];
  if (first.kind === 'unknown') {
    return [{ ...first, startDate }, ...seasons.slice(1)];
  }
  return [createUnknownRhythmSeason(rhythmId, startDate), ...seasons];
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
