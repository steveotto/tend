import type { OnTrackEvidence } from './rhythm-scoring.ts';

export type OnTrackHistoryDisplayEntry =
  | {
      kind: 'occurrence';
      key: string;
      date: string;
      status: 'completed' | 'missed' | 'today';
      score: number;
    }
  | {
      kind: 'zero-score-span';
      key: string;
      startDate: string;
      endDate: string;
      occurrenceCount: number;
      score: 0;
    }
  | {
      kind: 'schedule-change';
      key: string;
      date: string;
      score: number;
    };

export function onTrackHistoryDisplayEntries(evidence: OnTrackEvidence): readonly OnTrackHistoryDisplayEntry[] {
  const entries: OnTrackHistoryDisplayEntry[] = [
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
      score: item.score
    })),
    ...evidence.repeatedZeroScoreSpans.map(item => ({
      kind: 'zero-score-span' as const,
      key: `zero-score-${item.startDate}-${item.endDate}`,
      startDate: item.startDate,
      endDate: item.endDate,
      occurrenceCount: item.occurrenceCount,
      score: 0 as const
    }))
  ];
  return entries.sort((left, right) => {
    const leftDate = left.kind === 'zero-score-span' ? left.startDate : left.date;
    const rightDate = right.kind === 'zero-score-span' ? right.startDate : right.date;
    if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
    if (left.kind === right.kind) return left.key.localeCompare(right.key);
    return left.kind === 'schedule-change' ? -1 : right.kind === 'schedule-change' ? 1 : 0;
  });
}

export function latestOnTrackHistoryEntries(
  entries: readonly OnTrackHistoryDisplayEntry[],
  limit: number
): readonly OnTrackHistoryDisplayEntry[] {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('The history display limit must be a positive integer.');
  return entries.slice(-limit);
}
