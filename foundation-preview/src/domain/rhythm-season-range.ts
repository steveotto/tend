import { isValidDate } from './money-goals.ts';
import { addCalendarDays } from './rhythm-occurrences.ts';
import {
  isValidTimeZone,
  rhythmTimeOptions,
  validateRhythmSchedule,
  validateRhythmScoringMetadata
} from './rhythm-schedule.ts';
import type {
  RhythmLocalDate,
  RhythmSchedule,
  RhythmScheduleHistorySegment,
  RhythmScheduleSegment,
  RhythmScoringMetadata,
  RhythmTimeValue
} from './rhythm-schedule.ts';
import {
  createRhythmSeason,
  createUnknownRhythmSeason,
  rhythmSeasonId,
  rhythmSeasonPaletteForOrdinal
} from './rhythm-seasons.ts';

export type RhythmSeasonRangeDraft = {
  segmentId?: string;
  startDate: string;
  endDate?: string;
  schedule: RhythmSchedule;
  timeOfDay: RhythmTimeValue;
  name: string;
};

export type RhythmSeasonRangeChange = {
  seasonId: string;
  label: string;
  change: 'split' | 'shortened' | 'replaced';
};

export type RhythmSeasonRangeResult =
  | {
      valid: true;
      scoring: RhythmScoringMetadata;
      schedule: RhythmSchedule;
      activeTimeOfDay?: RhythmTimeValue;
      changes: readonly RhythmSeasonRangeChange[];
      selectedChange?: RhythmSeasonRangeChange;
      appliedEndDate?: string;
    }
  | { valid: false; error: string };

export type RhythmSeasonRangeCoverage = {
  effectiveStartDate?: string;
  earliestCompletionDate?: string;
  currentTimeOfDay?: RhythmTimeValue;
};

function endBefore(date: RhythmLocalDate): RhythmLocalDate {
  return addCalendarDays(date, -1) as RhythmLocalDate;
}

function uniqueId(rhythmId: string, date: RhythmLocalDate, history: readonly RhythmScheduleHistorySegment[]): string {
  const existing = new Set(history.map(segment => segment.id));
  const base = rhythmSeasonId(rhythmId, date);
  if (!existing.has(base)) return base;
  for (let index = 1; index < 10_000; index += 1) {
    const candidate = `${base}:fragment:${index}`;
    if (!existing.has(candidate)) return candidate;
  }
  throw new RangeError('A unique Season identity could not be generated.');
}

function withBoundaryEnd(
  segment: RhythmScheduleHistorySegment,
  endDate: RhythmLocalDate
): RhythmScheduleHistorySegment {
  if (segment.kind === 'unknown') return segment;
  const existingEnd = segment.schedule.endDate;
  if (!existingEnd || existingEnd <= endDate) return segment;
  const constrainedEnd = existingEnd && existingEnd < endDate ? existingEnd : endDate;
  return {
    ...segment,
    schedule: { ...segment.schedule, endDate: constrainedEnd }
  };
}

function cloneAt(
  segment: RhythmScheduleHistorySegment,
  startDate: RhythmLocalDate,
  id: string
): RhythmScheduleHistorySegment {
  return { ...segment, id, startDate } as RhythmScheduleHistorySegment;
}

function initialHistory(
  rhythmId: string,
  currentSchedule: RhythmSchedule,
  timeZone: string,
  asOfDate: RhythmLocalDate,
  coverage?: RhythmSeasonRangeCoverage
): RhythmScoringMetadata | undefined {
  if (!isValidTimeZone(timeZone)) return undefined;
  const effectiveStartDate = coverage?.effectiveStartDate;
  const earliestCompletionDate = coverage?.earliestCompletionDate;
  if ((effectiveStartDate && !isValidDate(effectiveStartDate))
    || (earliestCompletionDate && !isValidDate(earliestCompletionDate))) return undefined;

  const trackingStartDate = [effectiveStartDate, earliestCompletionDate, asOfDate]
    .filter((date): date is string => date !== undefined)
    .sort()[0] as RhythmLocalDate;
  const history: RhythmScheduleHistorySegment[] = [];
  const knownStartDate = effectiveStartDate && effectiveStartDate <= asOfDate
    ? effectiveStartDate
    : asOfDate;
  if (trackingStartDate < knownStartDate) {
    history.push(createUnknownRhythmSeason(rhythmId, trackingStartDate));
  }
  history.push(createRhythmSeason(
    rhythmId,
    knownStartDate,
    currentSchedule,
    coverage?.currentTimeOfDay,
    undefined,
    rhythmSeasonPaletteForOrdinal(0)
  ));
  return { trackingStartDate, timeZone, scheduleHistory: history };
}

function previewChanges(
  history: readonly RhythmScheduleHistorySegment[],
  rangeStart: RhythmLocalDate,
  rangeEnd: RhythmLocalDate | undefined,
  excludedId?: string
): RhythmSeasonRangeChange[] {
  return history.flatMap((segment, index) => {
    if (segment.id === excludedId) return [];
    const nextStart = history[index + 1]?.startDate;
    const segmentEnd = nextStart ? endBefore(nextStart) : undefined;
    const overlaps = (rangeEnd === undefined || segment.startDate <= rangeEnd)
      && (segmentEnd === undefined || segmentEnd >= rangeStart);
    if (!overlaps) return [];
    const hasPrefix = segment.startDate < rangeStart;
    const hasSuffix = rangeEnd !== undefined && (segmentEnd === undefined || segmentEnd > rangeEnd);
    return [{
      seasonId: segment.id,
      label: segment.kind === 'scheduled'
        ? segment.name?.trim() || 'Scheduled season'
        : 'Unknown history',
      change: hasPrefix && hasSuffix ? 'split' as const
        : hasPrefix || hasSuffix ? 'shortened' as const
          : 'replaced' as const
    }];
  });
}

export function resolveRhythmSeasonRange(input: {
  rhythmId: string;
  currentSchedule: RhythmSchedule;
  scoring?: RhythmScoringMetadata;
  timeZone: string;
  asOfDate: string;
  draft: RhythmSeasonRangeDraft;
  coverage?: RhythmSeasonRangeCoverage;
}): RhythmSeasonRangeResult {
  const { rhythmId, currentSchedule, scoring, timeZone, asOfDate, draft, coverage } = input;
  if (!isValidDate(asOfDate) || !isValidDate(draft.startDate)
    || (draft.endDate !== undefined && (!isValidDate(draft.endDate) || draft.endDate < draft.startDate))
    || !validateRhythmSchedule(currentSchedule).valid
    || !validateRhythmSchedule(draft.schedule).valid
    || !rhythmTimeOptions.some(option => option.value === draft.timeOfDay)
    || draft.name.length > 80
    || !isValidTimeZone(timeZone)) {
    return { valid: false, error: 'Check the date range, schedule, time of day, and optional name.' };
  }
  if (scoring && !validateRhythmScoringMetadata(scoring)) {
    return { valid: false, error: 'This Rhythm has invalid schedule history and cannot be changed.' };
  }
  if (coverage?.earliestCompletionDate !== undefined && !isValidDate(coverage.earliestCompletionDate)) {
    return { valid: false, error: 'Completion history contains an invalid date and cannot be changed safely.' };
  }

  const baseScoring = scoring ?? initialHistory(
    rhythmId,
    currentSchedule,
    timeZone,
    asOfDate as RhythmLocalDate,
    coverage
  );
  if (!baseScoring) {
    return { valid: false, error: 'The current schedule history could not be established safely.' };
  }
  const originalHistory = [...baseScoring.scheduleHistory];
  const selectedIndex = draft.segmentId
    ? originalHistory.findIndex(segment => segment.id === draft.segmentId)
    : -1;
  if (draft.segmentId && selectedIndex < 0) {
    return { valid: false, error: 'This schedule period is no longer available.' };
  }
  const selected = selectedIndex >= 0 ? originalHistory[selectedIndex] : undefined;
  const nextSelected = selectedIndex >= 0 ? originalHistory[selectedIndex + 1] : undefined;
  if (selectedIndex === 0 && coverage?.earliestCompletionDate
    && draft.startDate > coverage.earliestCompletionDate) {
    return {
      valid: false,
      error: `The first Season cannot start after the earliest logged moment (${coverage.earliestCompletionDate}).`
    };
  }
  const rangeEnd = draft.endDate
    ?? draft.schedule.endDate
    ?? (nextSelected ? endBefore(nextSelected.startDate) : undefined);
  if (rangeEnd !== undefined && rangeEnd < draft.startDate) {
    return { valid: false, error: 'The end date must be on or after the starting date.' };
  }

  const changes = previewChanges(
    originalHistory,
    draft.startDate as RhythmLocalDate,
    rangeEnd as RhythmLocalDate | undefined,
    draft.segmentId
  );
  let selectedChange: RhythmSeasonRangeChange | undefined;
  if (selected) {
    const selectedEnd = nextSelected ? endBefore(nextSelected.startDate) : undefined;
    const selectedHasPrefix = selected.startDate < draft.startDate;
    const selectedHasSuffix = rangeEnd !== undefined
      && (selectedEnd === undefined || selectedEnd > rangeEnd);
    selectedChange = {
      seasonId: selected.id,
      label: selected.kind === 'scheduled'
        ? selected.name?.trim() || 'Selected season'
        : 'Selected unknown-history interval',
      change: selectedHasPrefix && selectedHasSuffix ? 'split'
        : selectedHasPrefix || selectedHasSuffix ? 'shortened'
          : 'replaced'
    };
  }
  const historyToResolve = selected?.kind === 'scheduled'
    ? originalHistory.map(segment => segment.id !== selected.id
        ? segment
        : {
            kind: 'unknown' as const,
            id: selected.id,
            startDate: selected.startDate,
            ...(selected.contextCadence === undefined
              ? {}
              : { descriptiveCadence: selected.contextCadence }),
            paletteToken: selected.paletteToken
          })
    : originalHistory;
  const fragments: RhythmScheduleHistorySegment[] = [];
  const ids = new Set<string>();
  const reserveId = (preferred: string, date: RhythmLocalDate): string => {
    if (!ids.has(preferred)) {
      ids.add(preferred);
      return preferred;
    }
    const fallback = uniqueId(rhythmId, date, [...originalHistory, ...fragments]);
    ids.add(fallback);
    return fallback;
  };

  for (let index = 0; index < historyToResolve.length; index += 1) {
    const segment = historyToResolve[index]!;
    const nextStart = historyToResolve[index + 1]?.startDate;
    const intervalEnd = nextStart ? endBefore(nextStart) : undefined;
    const overlaps = (rangeEnd === undefined || segment.startDate <= rangeEnd)
      && (intervalEnd === undefined || intervalEnd >= draft.startDate);
    if (!overlaps) {
      fragments.push(segment);
      ids.add(segment.id);
      continue;
    }

    const hasPrefix = segment.startDate < draft.startDate;
    const hasSuffix = rangeEnd !== undefined && (intervalEnd === undefined || intervalEnd > rangeEnd);
    const selectedOpenEnded = selected?.id === segment.id && nextSelected === undefined;
    if (hasPrefix) {
      const prefixEnd = endBefore(draft.startDate as RhythmLocalDate);
      const prefix = withBoundaryEnd(segment, prefixEnd);
      fragments.push(cloneAt(prefix, segment.startDate, reserveId(segment.id, segment.startDate)));
    }
    if (hasSuffix && rangeEnd && !selectedOpenEnded) {
      const suffixStart = addCalendarDays(rangeEnd, 1) as RhythmLocalDate;
      const originalScheduleEnded = segment.kind === 'scheduled'
        && segment.schedule.endDate !== undefined
        && segment.schedule.endDate < suffixStart;
      if (originalScheduleEnded) {
        const unknown = createUnknownRhythmSeason(rhythmId, suffixStart);
        fragments.push({
          ...unknown,
          id: reserveId(unknown.id, suffixStart),
          ...(segment.kind === 'scheduled' && segment.contextCadence
            ? { descriptiveCadence: segment.contextCadence }
            : {})
        });
      } else {
        const keepOriginalId = !hasPrefix && (!selected || selected.id !== segment.id
          || selected.startDate !== draft.startDate);
        const suffixId = keepOriginalId
          ? reserveId(segment.id, suffixStart)
          : uniqueId(rhythmId, suffixStart, [...originalHistory, ...fragments]);
        ids.add(suffixId);
        fragments.push(cloneAt(segment, suffixStart, suffixId));
      }
    }
  }

  const selectedIdentityRetained = selected?.startDate === draft.startDate
    && !fragments.some(segment => segment.id === selected.id);
  const insertedId = selectedIdentityRetained
    ? selected.id
    : uniqueId(rhythmId, draft.startDate as RhythmLocalDate, [...originalHistory, ...fragments]);
  const explicitEndDate = draft.endDate ?? draft.schedule.endDate;
  const insertedSchedule: RhythmSchedule = explicitEndDate
    ? { ...draft.schedule, endDate: explicitEndDate }
    : draft.schedule;
  const inserted = createRhythmSeason(
    rhythmId,
    draft.startDate as RhythmLocalDate,
    insertedSchedule,
    draft.timeOfDay,
    insertedId,
    selected?.kind === 'scheduled' ? selected.paletteToken : undefined
  );
  const name = draft.name.trim();
  const named = name ? { ...inserted, name } : inserted;
  fragments.push({
    ...named,
    ...(selected?.kind === 'scheduled' && selected.note !== undefined ? { note: selected.note } : {}),
    ...(selected?.kind === 'scheduled' && selected.contextCadence !== undefined
      ? { contextCadence: selected.contextCadence }
      : selected?.kind === 'unknown' && selected.descriptiveCadence !== undefined
        ? { contextCadence: selected.descriptiveCadence }
        : {})
  });
  fragments.sort((left, right) => left.startDate.localeCompare(right.startDate));

  const firstScheduled = fragments.find(segment => segment.kind === 'scheduled');
  if (!firstScheduled || fragments.at(-1)?.kind !== 'scheduled') {
    return {
      valid: false,
      error: 'This range would leave the latest history unknown. Add a known schedule for the remaining current or future dates.'
    };
  }
  const nextScoring: RhythmScoringMetadata = {
    ...baseScoring,
    trackingStartDate: firstScheduled.startDate,
    scheduleHistory: fragments
  };
  if (!validateRhythmScoringMetadata(nextScoring)) {
    return { valid: false, error: 'This range cannot be saved without overlapping or invalid schedule history.' };
  }
  const active = [...fragments].reverse().find(segment => segment.startDate <= asOfDate);
  if (active?.kind !== 'scheduled') {
    return {
      valid: false,
      error: 'The date range would leave today without a known schedule. Add a current schedule before saving.'
    };
  }
  return {
    valid: true,
    scoring: nextScoring,
    schedule: active.schedule,
    ...(active.timeOfDay === undefined ? {} : { activeTimeOfDay: active.timeOfDay }),
    changes,
    ...(selectedChange ? { selectedChange } : {}),
    ...(rangeEnd === undefined ? {} : { appliedEndDate: rangeEnd })
  };
}

export function restoreRhythmSeasonRange(
  rhythmId: string,
  currentSchedule: RhythmSchedule,
  scoring: RhythmScoringMetadata,
  expectedScoring: RhythmScoringMetadata,
  expectedSchedule: RhythmSchedule,
  restoreScoring: RhythmScoringMetadata,
  restoreSchedule: RhythmSchedule
): { valid: true; scoring: RhythmScoringMetadata; schedule: RhythmSchedule }
  | { valid: false; error: string } {
  if (!validateRhythmScoringMetadata(scoring) || !validateRhythmScoringMetadata(expectedScoring)
    || !validateRhythmScoringMetadata(restoreScoring)
    || JSON.stringify(scoring) !== JSON.stringify(expectedScoring)
    || JSON.stringify(currentSchedule) !== JSON.stringify(expectedSchedule)
    || !validateRhythmSchedule(restoreSchedule).valid
    || restoreScoring.scheduleHistory.some(segment => segment.id.trim().length === 0)) {
    return {
      valid: false,
      error: `Schedule history for ${rhythmId} changed after the Season update. It cannot be safely restored.`
    };
  }
  return { valid: true, scoring: restoreScoring, schedule: restoreSchedule };
}

export function rhythmSeasonRangeIntervalEnd(
  seasons: readonly RhythmScheduleHistorySegment[],
  index: number
): string | undefined {
  const next = seasons[index + 1]?.startDate;
  return next ? endBefore(next) : undefined;
}

export type RhythmSeasonRangeScheduledSegment = Extract<RhythmScheduleHistorySegment, { kind: 'scheduled' }>;
export type RhythmSeasonRangeSource = RhythmScheduleSegment;
