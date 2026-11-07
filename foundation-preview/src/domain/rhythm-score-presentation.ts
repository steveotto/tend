import type { OnTrackEvidence } from './rhythm-scoring.ts';
import { addCalendarDays } from './rhythm-occurrences.ts';

export const ON_TRACK_SCORE_HISTORY_DISPLAY_LIMIT = 5;

export type OnTrackHistoryDisplayEntry =
  | {
      kind: 'created';
      key: string;
      date: string;
      score: number | null;
    }
  | {
      kind: 'occurrence';
      key: string;
      date: string;
      status: 'completed' | 'missed' | 'today';
      score: number;
      completionDate?: string;
      periodStartDate?: string;
      eligibleEndDate?: string;
    }
  | {
      kind: 'zero-score-span';
      key: string;
      startDate: string;
      endDate: string;
      occurrenceCount: number;
      recentOccurrenceDates: readonly string[];
      score: 0;
    }
  | {
      kind: 'schedule-change';
      key: string;
      date: string;
      score: number;
    };

export function onTrackHistoryDisplayEntries(
  evidence: OnTrackEvidence,
  createdLocalDate?: string,
  createdOnTrackScore: number | null = null
): readonly OnTrackHistoryDisplayEntry[] {
  const entries: OnTrackHistoryDisplayEntry[] = [
    ...(createdLocalDate ? [{
      kind: 'created' as const,
      key: `created-${createdLocalDate}`,
      date: createdLocalDate,
      score: createdOnTrackScore
    }] : []),
    ...evidence.scheduleChanges.map(item => ({
      kind: 'schedule-change' as const,
      key: `schedule-change-${item.date}`,
      date: item.date,
      score: item.score
    })),
    ...evidence.occurrences.map(item => ({
      kind: 'occurrence' as const,
      key: `occurrence-${item.date}`,
      date: item.date,
      status: item.status,
      score: item.score,
      ...('periodStartDate' in item && item.periodStartDate !== undefined
        ? {
            ...(item.status === 'completed' && 'completionDate' in item && item.completionDate
              ? { completionDate: item.completionDate }
              : {}),
            periodStartDate: item.periodStartDate,
            eligibleEndDate: item.eligibleEndDate
          }
        : {})
    })),
    ...evidence.repeatedZeroScoreSpans.map(item => ({
      kind: 'zero-score-span' as const,
      key: `zero-score-${item.startDate}-${item.endDate}`,
      startDate: item.startDate,
      endDate: item.endDate,
      occurrenceCount: item.occurrenceCount,
      recentOccurrenceDates: item.recentOccurrenceDates,
      score: 0 as const
    }))
  ];
  return sortOnTrackHistoryEntries(entries);
}

export function recentOnTrackHistoryEntries(
  entries: readonly OnTrackHistoryDisplayEntry[],
  asOfDate: string
): readonly OnTrackHistoryDisplayEntry[] {
  const firstDate = addCalendarDays(asOfDate, -29);
  const recentEntries: OnTrackHistoryDisplayEntry[] = [];
  for (const entry of entries) {
    if (entry.kind === 'zero-score-span') {
      const recentDates = entry.recentOccurrenceDates.filter(date => date >= firstDate && date <= asOfDate);
      if (recentDates.length === 0) continue;
      const startDate = recentDates[0]!;
      const endDate = recentDates[recentDates.length - 1]!;
      if (startDate === entry.startDate
        && endDate === entry.endDate
        && recentDates.length === entry.occurrenceCount) {
        recentEntries.push(entry);
        continue;
      }
      recentEntries.push({
        ...entry,
        startDate,
        endDate,
        occurrenceCount: recentDates.length
      });
      continue;
    }
    if (entry.date >= firstDate && entry.date <= asOfDate) recentEntries.push(entry);
  }
  return sortOnTrackHistoryEntries(recentEntries);
}

function sortOnTrackHistoryEntries(
  entries: readonly OnTrackHistoryDisplayEntry[]
): readonly OnTrackHistoryDisplayEntry[] {
  return [...entries].sort((left, right) => {
    const leftDate = left.kind === 'zero-score-span' ? left.startDate : left.date;
    const rightDate = right.kind === 'zero-score-span' ? right.startDate : right.date;
    if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
    if (left.kind === right.kind) return left.key.localeCompare(right.key);
    const tieOrder = { created: 0, 'schedule-change': 1, occurrence: 2, 'zero-score-span': 3 } as const;
    return tieOrder[left.kind] - tieOrder[right.kind];
  });
}

export function latestOnTrackHistoryEntries(
  entries: readonly OnTrackHistoryDisplayEntry[],
  limit: number
): readonly OnTrackHistoryDisplayEntry[] {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('The history display limit must be a positive integer.');
  return entries.slice(-limit);
}
