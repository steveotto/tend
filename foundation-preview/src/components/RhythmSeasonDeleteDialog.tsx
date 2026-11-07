import { useId, useState } from 'react';
import type { RhythmPreview } from '../domain/preview-data.ts';
import type { RhythmCompletionRecord } from '../domain/rhythm-completion.ts';
import type { RhythmScheduleHistorySegment } from '../domain/rhythm-schedule.ts';
import type { SelectRhythmScoreInput } from '../domain/rhythm-scoring.ts';
import { selectRhythmScore } from '../domain/rhythm-scoring.ts';
import { deleteRhythmSeason } from '../domain/rhythm-season-delete.ts';
import { formatRhythmSchedule } from '../domain/rhythm-schedule.ts';
import { rhythmSeasonInclusiveEndDate } from '../domain/rhythm-seasons.ts';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { RhythmSeasonImpact } from './RhythmSeasonImpact.tsx';

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(`${date}T12:00:00Z`));
}

export function RhythmSeasonDeleteDialog({
  rhythm,
  season,
  scoringInput,
  records,
  onDelete,
  onClose
}: {
  rhythm: RhythmPreview;
  season: Extract<RhythmScheduleHistorySegment, { kind: 'scheduled' }>;
  scoringInput: SelectRhythmScoreInput;
  records: readonly RhythmCompletionRecord[];
  onDelete: (rhythmId: string, seasonId: string) => string | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const [error, setError] = useState('');
  const scoring = rhythm.scoring!;
  const index = scoring.scheduleHistory.findIndex(entry => entry.id === season.id);
  const previous = scoring.scheduleHistory[index - 1];
  const next = scoring.scheduleHistory[index + 1];
  const endDate = next
    ? rhythmSeasonInclusiveEndDate(scoring.scheduleHistory, index)
    : scoringInput.asOfDate;
  const before = selectRhythmScore(scoringInput);
  const result = rhythm.schedule
    ? deleteRhythmSeason(
      rhythm.id,
      rhythm.schedule,
      scoring,
      season.id,
      records,
      scoringInput.asOfDate
      )
    : undefined;
  const after = result?.valid
    ? selectRhythmScore({
        ...scoringInput,
        schedule: result.schedule,
        scoring: result.scoring
      })
    : undefined;
  const preservedLogs = records.filter(record => record.rhythmId === rhythm.id
    && record.effectiveDate >= season.startDate
    && (!next || record.effectiveDate < next.startDate));
  const affectedEnd = endDate ?? season.startDate;
  const previousEnd = index > 0
    ? rhythmSeasonInclusiveEndDate(scoring.scheduleHistory, index - 1)
    : undefined;
  const afterEnd = result?.valid
    ? index === 0
      ? rhythmSeasonInclusiveEndDate(result.scoring.scheduleHistory, 0) ?? scoringInput.asOfDate
      : rhythmSeasonInclusiveEndDate(result.scoring.scheduleHistory, index - 1) ?? scoringInput.asOfDate
    : affectedEnd;
  const deletingFirstSeason = index === 0;
  const firstRemainingKnownSeason = result?.valid
    ? result.scoring.scheduleHistory.find(
        (segment): segment is Extract<RhythmScheduleHistorySegment, { kind: 'scheduled' }> =>
          segment.kind === 'scheduled'
      )
    : undefined;

  function confirm() {
    if (!result?.valid) {
      setError(result?.error ?? 'This Season cannot be removed safely.');
      return;
    }
    const saveError = onDelete(rhythm.id, season.id);
    if (saveError) {
      setError(saveError);
      return;
    }
    onClose();
  }

  return (
    <MoneyGoalDialog
      labelledBy={titleId}
      closeLabel="Cancel Season deletion"
      initialFocusId="rhythm-season-delete-confirm"
      stopEscapePropagation
      onClose={onClose}
    >
      <section className="rhythm-season-correction rhythm-season-delete" aria-labelledby={titleId}>
        <h2 id={titleId}>Remove this season?</h2>
        <p className="rhythm-season-correction__range">
          {season.name?.trim() || formatRhythmSchedule(season.schedule, 'compact')} · {formatDate(season.startDate)} – {formatDate(affectedEnd)}
        </p>
        <p className="rhythm-season-correction__warning">
          {deletingFirstSeason
            ? 'This removes only this season. The next season will not extend backward, and these dates will no longer be treated as scheduled. All completion records stay saved.'
            : 'The previous schedule will apply to these dates. Your logged moments will stay.'}
        </p>
        <div className="rhythm-season-correction__transition">
          <p>
            <strong>Before</strong>
            <span>
              {deletingFirstSeason
                ? `${formatDate(season.startDate)} – ${formatDate(affectedEnd)}: ${formatRhythmSchedule(season.schedule, 'detailed')}`
                : `${previous?.kind === 'scheduled' ? `${formatDate(previous.startDate)} – ${formatDate(previousEnd ?? previous.startDate)}: ${formatRhythmSchedule(previous.schedule, 'detailed')}` : 'Earlier schedule needs details'}; ${formatDate(season.startDate)} – ${formatDate(affectedEnd)}: ${formatRhythmSchedule(season.schedule, 'detailed')}`}
            </span>
          </p>
          <p>
            <strong>After</strong>
            <span>
              {deletingFirstSeason
                ? `${firstRemainingKnownSeason
                    ? `${formatRhythmSchedule(firstRemainingKnownSeason.schedule, 'detailed')} starts ${formatDate(firstRemainingKnownSeason.startDate)}`
                    : 'No schedule is known yet'}; tracking starts ${formatDate(result?.valid ? result.scoring.trackingStartDate : scoring.trackingStartDate)}.`
                : `${previous?.kind === 'scheduled' ? formatRhythmSchedule(previous.schedule, 'detailed') : 'Earlier schedule needs details'} applies from ${formatDate(previous?.startDate ?? season.startDate)} through ${formatDate(afterEnd)}${next ? `; next Season starts ${formatDate(next.startDate)}` : ''}`}
            </span>
          </p>
        </div>
        <p className="rhythm-season-correction__preserved">
          {deletingFirstSeason
            ? preservedLogs.length === 0
              ? 'No logged moments fall within this season. All completion records will be preserved.'
              : `${preservedLogs.length} logged ${preservedLogs.length === 1 ? 'moment falls' : 'moments fall'} within this season; deletion is blocked.`
            : `${preservedLogs.length} logged ${preservedLogs.length === 1 ? 'moment' : 'moments'} in this period will be preserved.`}
        </p>
        <RhythmSeasonImpact before={before} after={after} />
        {result && !result.valid && <p className="goal-field-error" role="alert">{result.error}</p>}
        {error && <p className="goal-field-error" role="alert">{error}</p>}
        <div className="money-goal-dialog__actions">
          <button id="rhythm-season-delete-confirm" type="button" className="btn mini" onClick={confirm}>
            Delete season
          </button>
          <button type="button" className="btn mini ghost" onClick={onClose}>Cancel</button>
        </div>
      </section>
    </MoneyGoalDialog>
  );
}
