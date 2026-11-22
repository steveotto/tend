import type { DailyCompletionCount } from '../domain/rhythm-history.ts';
import { localDateString } from '../domain/money-goals.ts';
import { DailyCountHistoryChart } from './DailyCountHistoryChart.tsx';

export function RhythmCompletionHistoryChart({
  dailyCounts,
  todayDate = localDateString(new Date())
}: {
  dailyCounts: readonly DailyCompletionCount[];
  todayDate?: string;
}) {
  return (
    <DailyCountHistoryChart
      dailyCounts={dailyCounts}
      todayDate={todayDate}
      activityName="Completion"
      activitySingular="completion"
      activityPlural="completions"
      valuesLabel="Recorded completion count by date"
    />
  );
}
