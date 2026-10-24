import { orderedCompletions } from './preview-data.ts';
import type { RhythmCompletion } from './preview-data.ts';
import type { RhythmCompletionRecord } from './rhythm-completion.ts';

export type RhythmScoreExample = {
  rhythmIds: readonly string[];
  asOfDate: string;
  consistencyOccurrences: readonly {
    date: string;
    status: 'completed' | 'not-completed';
    recordIds?: readonly string[];
  }[];
  onTrack: {
    pointsPerFullUntendedDay: number;
    days: readonly {
      date: string;
      status: 'tended' | 'not-tended' | 'as-of';
    }[];
  };
};

export type IllustratedMetric =
  | {
      kind: 'scored';
      score: number;
    }
  | {
      kind: 'unscored';
      explanation: string;
    }
  | {
      kind: 'unavailable';
      explanation: string;
    };

export type PreparedRhythmScoreExample = {
  asOfDate: string;
  healthScore: number | null;
  consistency:
    | {
        kind: 'scored';
        score: number;
        eligibleDueCount: number;
        completedCount: number;
        notCompletedCount: number;
        exactPercent: number;
        occurrences: readonly {
          date: string;
          status: 'completed' | 'not-completed';
          recordIds: readonly string[];
        }[];
        evidence: {
          windowStartDate: string;
          windowEndDate: string;
          eligibleDueCount: number;
          completedCount: number;
          notCompletedCount: number;
          occurrences: readonly {
            date: string;
            status: 'completed' | 'not-completed';
            recordIds: readonly string[];
          }[];
        };
      }
    | {
        kind: 'unscored';
        explanation: string;
      }
    | { kind: 'unavailable'; explanation: string; };
  onTrack:
    | {
        kind: 'scored';
        score: number;
        lastTendedDate: string | null;
        fullOverdueDates: readonly string[];
        pointsPerFullUntendedDay: number;
        days: readonly {
          date: string;
          status: 'tended' | 'not-tended' | 'as-of';
          score: number;
        }[];
        evidence: {
          lastQualifyingCompletionDate: string | null;
          overdueDates: readonly string[];
          pointsPerOverdueDate: 10;
          deduction: number;
          days: readonly {
            date: string;
            status: 'tended' | 'not-tended' | 'today';
            score: number;
          }[];
        };
      }
    | {
        kind: 'unscored';
        explanation: string;
      }
    | { kind: 'unavailable'; explanation: string; };
};

export const dailyRhythmScoreExample = {
  rhythmIds: ['sample-pray-together', 'sample-connect'],
  asOfDate: '2026-10-23',
  consistencyOccurrences: [
    { date: '2026-09-23', status: 'completed' },
    { date: '2026-09-24', status: 'completed' },
    { date: '2026-09-25', status: 'completed' },
    { date: '2026-09-26', status: 'not-completed' },
    { date: '2026-09-27', status: 'completed' },
    { date: '2026-09-28', status: 'completed' },
    { date: '2026-09-29', status: 'completed' },
    { date: '2026-09-30', status: 'completed' },
    { date: '2026-10-01', status: 'completed' },
    { date: '2026-10-02', status: 'not-completed' },
    { date: '2026-10-03', status: 'completed' },
    { date: '2026-10-04', status: 'completed' },
    { date: '2026-10-05', status: 'completed' },
    { date: '2026-10-06', status: 'not-completed' },
    { date: '2026-10-07', status: 'completed' },
    { date: '2026-10-08', status: 'completed' },
    { date: '2026-10-09', status: 'completed' },
    { date: '2026-10-10', status: 'completed' },
    { date: '2026-10-11', status: 'completed' },
    { date: '2026-10-12', status: 'completed' },
    { date: '2026-10-13', status: 'not-completed' },
    { date: '2026-10-14', status: 'completed' },
    { date: '2026-10-15', status: 'completed' },
    { date: '2026-10-16', status: 'completed' },
    { date: '2026-10-17', status: 'completed' },
    { date: '2026-10-18', status: 'completed' },
    { date: '2026-10-19', status: 'completed' },
    { date: '2026-10-20', status: 'not-completed' },
    { date: '2026-10-21', status: 'not-completed' },
    { date: '2026-10-22', status: 'not-completed' }
  ],
  onTrack: {
    pointsPerFullUntendedDay: 10,
    days: [
      { date: '2026-10-19', status: 'tended' },
      { date: '2026-10-20', status: 'not-tended' },
      { date: '2026-10-21', status: 'not-tended' },
      { date: '2026-10-22', status: 'not-tended' },
      { date: '2026-10-23', status: 'as-of' }
    ]
  }
} as const satisfies RhythmScoreExample;

export const unavailableRhythmScoreExample: PreparedRhythmScoreExample = {
  asOfDate: dailyRhythmScoreExample.asOfDate,
  healthScore: null,
  consistency: { kind: 'unavailable', explanation: 'An illustrative Consistency breakdown is not available for this Rhythm.' },
  onTrack: { kind: 'unavailable', explanation: 'An illustrative On Track breakdown is not available for this Rhythm.' }
};

export const HEALTH_CONSISTENCY_WEIGHT = 0.75;
export const HEALTH_ON_TRACK_WEIGHT = 0.25;

export function calculateBlendedHealth(consistencyScore: number | null, onTrackScore: number | null): number | null {
  validateScoreInput(consistencyScore, 'Consistency');
  validateScoreInput(onTrackScore, 'On Track');
  if (consistencyScore === null || onTrackScore === null) return null;
  return consistencyScore * HEALTH_CONSISTENCY_WEIGHT + onTrackScore * HEALTH_ON_TRACK_WEIGHT;
}

function validateScoreInput(score: number | null, metric: string): void {
  if (score === null) return;
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100) {
    throw new RangeError(`${metric} score must be a finite number from 0 to 100.`);
  }
}

export type PreparedCompletionHistory =
  | { kind: 'unavailable' }
  | { kind: 'empty'; records: readonly RhythmCompletion[] }
  | {
      kind: 'recorded';
      records: readonly RhythmCompletion[];
      count: number;
      firstDate: string;
      lastDate: string;
      dailyCounts: readonly DailyCompletionCount[];
    };

export type DailyCompletionCount = {
  date: string;
  count: number;
  recordIds: readonly string[];
};

export function resolveSeedCompletionRecords(
  history: readonly RhythmCompletion[] | undefined,
  overrides: readonly RhythmCompletionRecord[],
  removedIds: readonly string[]
): readonly RhythmCompletion[] | undefined {
  if (history === undefined) return undefined;
  const overrideById = new Map(overrides.map(record => [record.id, record]));
  const removed = new Set(removedIds);
  return history.flatMap(record => {
    if (removed.has(record.id)) return [];
    return [overrideById.get(record.id) ?? record];
  });
}

export function rhythmScoreExampleFor(rhythmId: string): RhythmScoreExample | undefined {
  return dailyRhythmScoreExample.rhythmIds.some(id => id === rhythmId) ? dailyRhythmScoreExample : undefined;
}

export function prepareRhythmScoreExample(example: RhythmScoreExample): PreparedRhythmScoreExample {
  const consistencyOccurrences = example.consistencyOccurrences.map(item => ({
    ...item,
    recordIds: item.recordIds ?? []
  }));
  const completedCount = consistencyOccurrences.filter(item => item.status === 'completed').length;
  const eligibleDueCount = consistencyOccurrences.length;
  const notCompletedCount = eligibleDueCount - completedCount;
  const consistency: PreparedRhythmScoreExample['consistency'] = eligibleDueCount === 0
    ? {
        kind: 'unscored',
        explanation: 'There are no eligible due occurrences in this window, so Consistency is unscored.'
      }
    : {
        kind: 'scored',
        score: Math.round((completedCount / eligibleDueCount) * 100),
        eligibleDueCount,
        completedCount,
        notCompletedCount,
        exactPercent: (completedCount / eligibleDueCount) * 100,
        occurrences: consistencyOccurrences,
        evidence: {
          windowStartDate: consistencyOccurrences[0]?.date ?? example.asOfDate,
          windowEndDate: consistencyOccurrences.at(-1)?.date ?? example.asOfDate,
          eligibleDueCount,
          completedCount,
          notCompletedCount,
          occurrences: consistencyOccurrences
        }
      };

  const lastTendedDate = [...example.onTrack.days]
    .reverse()
    .find(item => item.status === 'tended')?.date;
  const asOfDate = [...example.onTrack.days]
    .reverse()
    .find(item => item.status === 'as-of')?.date;
  if (!lastTendedDate || !asOfDate) {
    return {
      asOfDate: example.asOfDate,
      healthScore: null,
      consistency,
      onTrack: {
        kind: 'unscored',
        explanation: 'There is no qualifying completed day in this illustration, so On Track is unscored.'
      }
    };
  }

  let score = 100;
  const fullOverdueDates: string[] = [];
  const days: readonly {
    date: string;
    status: 'tended' | 'not-tended' | 'as-of';
    score: number;
  }[] = example.onTrack.days.map(item => {
    if (item.status === 'tended') score = 100;
    if (item.status === 'not-tended' && item.date > lastTendedDate) {
      fullOverdueDates.push(item.date);
      score = Math.max(0, score - example.onTrack.pointsPerFullUntendedDay);
    }
    return { ...item, score };
  });

  const onTrack: PreparedRhythmScoreExample['onTrack'] = {
    kind: 'scored',
    score,
    lastTendedDate,
    fullOverdueDates,
    pointsPerFullUntendedDay: example.onTrack.pointsPerFullUntendedDay,
    days: days.map(item => ({
      date: item.date,
      status: item.status === 'as-of' ? 'as-of' : item.status,
      score: item.score
    })),
    evidence: {
      lastQualifyingCompletionDate: lastTendedDate,
      overdueDates: fullOverdueDates,
      pointsPerOverdueDate: example.onTrack.pointsPerFullUntendedDay as 10,
      deduction: example.onTrack.pointsPerFullUntendedDay * fullOverdueDates.length,
      days: days.map(item => ({
        date: item.date,
        status: item.status === 'as-of' ? 'today' : item.status,
        score: item.score
      }))
    }
  };
  return {
    asOfDate: example.asOfDate,
    healthScore: calculateBlendedHealth(
      consistency.kind === 'scored' ? consistency.exactPercent : null,
      onTrack.score
    ),
    consistency,
    onTrack
  };
}

export function prepareDailyCompletionCounts(
  records: readonly RhythmCompletion[],
  throughDate?: string
): readonly DailyCompletionCount[] {
  if (records.length === 0) return [];

  const countsByDate = new Map<string, string[]>();
  for (const record of records) {
    const recordIds = countsByDate.get(record.effectiveDate) ?? [];
    recordIds.push(record.id);
    countsByDate.set(record.effectiveDate, recordIds);
  }

  const dates = [...countsByDate.keys()].sort();
  const firstDate = dates[0]!;
  const lastRecordedDate = dates.at(-1)!;
  const lastDate = throughDate ?? lastRecordedDate;
  if (lastDate < firstDate) return [];
  const dailyCounts: DailyCompletionCount[] = [];
  for (let date = firstDate; date <= lastDate; date = nextCalendarDate(date)) {
    const recordIds = countsByDate.get(date) ?? [];
    dailyCounts.push({ date, count: recordIds.length, recordIds });
  }
  return dailyCounts;
}

export function prepareCompletionHistory(
  history: readonly RhythmCompletion[] | undefined,
  throughDate?: string
): PreparedCompletionHistory {
  if (history === undefined) return { kind: 'unavailable' };
  const records = orderedCompletions(history);
  if (records.length === 0) return { kind: 'empty', records };

  const firstDate = records.at(-1)!.effectiveDate;
  const lastDate = records[0]!.effectiveDate;
  const dailyCounts = prepareDailyCompletionCounts(records, throughDate);

  return { kind: 'recorded', records, count: records.length, firstDate, lastDate, dailyCounts };
}

function nextCalendarDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year!, month! - 1, day! + 1);
  date.setUTCHours(0, 0, 0, 0);
  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('-');
}
