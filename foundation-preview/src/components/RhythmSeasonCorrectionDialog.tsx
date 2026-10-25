import { useId, useState } from 'react';
import type { RhythmPreview } from '../domain/preview-data.ts';
import type { RhythmCompletionRecord } from '../domain/rhythm-completion.ts';
import { isValidDate } from '../domain/money-goals.ts';
import { isScheduledDate } from '../domain/rhythm-occurrences.ts';
import type { RhythmSchedule, RhythmScheduleHistorySegment, RhythmTimeValue } from '../domain/rhythm-schedule.ts';
import { formatRhythmSchedule, rhythmTimeOptions } from '../domain/rhythm-schedule.ts';
import type { SelectRhythmScoreInput } from '../domain/rhythm-scoring.ts';
import { selectRhythmScore } from '../domain/rhythm-scoring.ts';
import { editRhythmSeason } from '../domain/rhythm-season-edit.ts';
import type { RhythmSeasonEditDraft } from '../domain/rhythm-season-edit.ts';
import { rhythmSeasonInclusiveEndDate } from '../domain/rhythm-seasons.ts';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { RhythmSeasonImpact } from './RhythmSeasonImpact.tsx';
import { RhythmScheduleFields } from './RhythmScheduleFields.tsx';
import { StyledSelect } from './StyledSelect.tsx';

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(`${date}T12:00:00Z`));
}

export type RhythmSeasonEditDialogDraft = {
  startDate: string;
  schedule: RhythmSchedule | undefined;
  timeOfDay: RhythmTimeValue;
  name: string;
};

export function RhythmSeasonCorrectionDialog({
  rhythm,
  season,
  scoringInput,
  records,
  suggestedStartDate,
  initialDraft,
  canDelete,
  deleteRestriction,
  onSave,
  onRequestDelete,
  onClose
}: {
  rhythm: RhythmPreview;
  season: RhythmScheduleHistorySegment;
  scoringInput: SelectRhythmScoreInput;
  records: readonly RhythmCompletionRecord[];
  suggestedStartDate: string;
  initialDraft?: RhythmSeasonEditDialogDraft;
  canDelete: boolean;
  deleteRestriction?: string;
  onSave: (draft: RhythmSeasonEditDraft) => string | null;
  onRequestDelete?: (draft: RhythmSeasonEditDialogDraft) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const scoring = rhythm.scoring!;
  const [startDate, setStartDate] = useState(initialDraft?.startDate ?? season.startDate);
  const [schedule, setSchedule] = useState(
    initialDraft?.schedule ?? (season.kind === 'scheduled' ? season.schedule : undefined)
  );
  const [timeOfDay, setTimeOfDay] = useState<RhythmTimeValue>(
    initialDraft?.timeOfDay ?? (season.kind === 'scheduled'
      ? season.timeOfDay ?? rhythm.timeOfDay ?? 'anytime'
      : rhythm.timeOfDay ?? 'anytime')
  );
  const [name, setName] = useState(initialDraft?.name ?? (season.kind === 'scheduled' ? season.name ?? '' : ''));
  const [error, setError] = useState('');

  const seasonIndex = scoring.scheduleHistory.findIndex(entry => entry.id === season.id);
  const next = scoring.scheduleHistory[seasonIndex + 1];
  const periodEndDate = next
    ? rhythmSeasonInclusiveEndDate(scoring.scheduleHistory, seasonIndex)
    : scoringInput.asOfDate;
  const affectedEndDate = periodEndDate && schedule?.endDate && schedule.endDate < periodEndDate
    ? schedule.endDate
    : periodEndDate;
  const affectedLogs = records.filter(record => record.rhythmId === rhythm.id
    && record.effectiveDate >= startDate
    && (!affectedEndDate || record.effectiveDate <= affectedEndDate));
  const logsOutsideProposedSchedule = schedule
    ? affectedLogs.filter(record => !isScheduledDate(schedule, record.effectiveDate))
    : [];
  const outsideScheduleWeekdays = [...new Set(logsOutsideProposedSchedule.map(record =>
    new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' })
      .format(new Date(`${record.effectiveDate}T12:00:00Z`))
  ))];
  const before = selectRhythmScore(scoringInput);
  const draft: RhythmSeasonEditDraft | undefined = schedule && isValidDate(startDate)
    ? { segmentId: season.id, startDate, schedule, timeOfDay, name }
    : undefined;
  const editResult = draft && rhythm.schedule
    ? editRhythmSeason(rhythm.id, rhythm.schedule, scoring, draft)
    : undefined;
  const after = editResult?.valid
    ? selectRhythmScore({
        ...scoringInput,
        schedule: editResult.schedule,
        scoring: editResult.scoring
      })
    : undefined;
  const oldSchedule = season.kind === 'scheduled'
    ? formatRhythmSchedule(season.schedule, 'detailed')
    : 'Earlier schedule needs details';
  const proposedSchedule = schedule ? formatRhythmSchedule(schedule, 'detailed') : 'Choose a schedule';
  const maxDate = periodEndDate ?? scoringInput.asOfDate;
  const validationMessage = !schedule
    ? 'Choose a complete, valid schedule to preview its impact.'
    : !isValidDate(startDate)
      ? 'Choose a valid starting date to preview its impact.'
      : editResult && !editResult.valid
        ? editResult.error
        : '';

  function confirm() {
    if (!draft || !editResult?.valid) {
      setError(editResult && !editResult.valid
        ? editResult.error
        : 'Choose a complete schedule and valid starting date.');
      return;
    }
    const saveError = onSave(draft);
    if (saveError) {
      setError(saveError);
      return;
    }
    onClose();
  }

  return (
    <MoneyGoalDialog
      labelledBy={titleId}
      closeLabel="Cancel schedule correction"
      initialFocusId={initialDraft ? 'rhythm-season-delete-from-editor' : 'rhythm-season-start-date'}
      stopEscapePropagation
      onClose={onClose}
    >
      <section className="rhythm-season-correction" aria-labelledby={titleId}>
        <h2 id={titleId}>{season.kind === 'unknown' ? 'Set earlier schedule' : 'Edit schedule period'}</h2>
        <p className="rhythm-season-correction__range">
          Affected dates: {formatDate(startDate)} – {affectedEndDate ? formatDate(affectedEndDate) : 'date unavailable'}
        </p>
        {season.kind === 'unknown' && season.descriptiveCadence && (
          <p className="rhythm-season-correction__context">
            Original description: {season.descriptiveCadence}
          </p>
        )}
        <p className="rhythm-season-correction__preserved">
          {affectedLogs.length} saved {affectedLogs.length === 1 ? 'log in this period remains' : 'logs in this period remain'} with this Rhythm; no logs are deleted.
        </p>
        {logsOutsideProposedSchedule.length > 0 && outsideScheduleWeekdays.length > 0 && (
          <p className="rhythm-season-correction__warning">
            {logsOutsideProposedSchedule.length} {logsOutsideProposedSchedule.length === 1 ? 'log falls' : 'logs fall'} outside this proposed schedule
            {' '}({outsideScheduleWeekdays.join(', ')}). Those logs remain in history but may not count toward these scores.
          </p>
        )}
        <div className="rhythm-season-correction__transition">
          <p><strong>Previous</strong><span>{oldSchedule}</span></p>
          <p><strong>Proposed</strong><span>{proposedSchedule}</span></p>
        </div>
        <p className="rhythm-season-correction__suggestion">
          Suggested starting date: {formatDate(suggestedStartDate)}. Choose the date this schedule began.
        </p>
        <div className="goal-field">
          <label htmlFor="rhythm-season-start-date">Starting date</label>
          <input
            id="rhythm-season-start-date"
            type="date"
            min={scoring.scheduleHistory[Math.max(0, seasonIndex - 1)]?.startDate}
            max={maxDate}
            value={startDate}
            onChange={event => {
              setStartDate(event.currentTarget.value);
              setError('');
            }}
          />
        </div>
        <RhythmScheduleFields
          schedule={schedule}
          onChange={nextSchedule => {
            setSchedule(nextSchedule);
            setError('');
          }}
        >
          <div className="goal-field rhythm-schedule-fields__time">
            <label>Time of day</label>
            <StyledSelect
              label="Time of day"
              options={rhythmTimeOptions}
              value={timeOfDay}
              onChange={setTimeOfDay}
            />
          </div>
        </RhythmScheduleFields>
        <div className="goal-field">
          <label htmlFor="rhythm-season-name">Season name (optional)</label>
          <input
            id="rhythm-season-name"
            maxLength={80}
            value={name}
            onChange={event => {
              setName(event.currentTarget.value);
              setError('');
            }}
          />
        </div>
        {validationMessage && <p className="goal-field-error" role="alert">{validationMessage}</p>}
        <RhythmSeasonImpact before={before} after={after} />
        {error && <p className="goal-field-error" role="alert">{error}</p>}
        <div className="money-goal-dialog__actions">
          <button type="button" className="btn mini" onClick={confirm}>Confirm schedule correction</button>
          <button type="button" className="btn mini ghost" onClick={onClose}>Cancel</button>
        </div>
        {canDelete && onRequestDelete && (
          <div className="rhythm-season-correction__delete-action">
            <button
              id="rhythm-season-delete-from-editor"
              type="button"
              className="btn mini rhythm-season-correction__delete"
              onClick={() => onRequestDelete({ startDate, schedule, timeOfDay, name })}
            >
              Delete season
            </button>
          </div>
        )}
        {!canDelete && deleteRestriction && (
          <p className="rhythm-season-correction__delete-restriction">{deleteRestriction}</p>
        )}
      </section>
    </MoneyGoalDialog>
  );
}
