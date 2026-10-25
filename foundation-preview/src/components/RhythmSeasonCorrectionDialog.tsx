import { useId, useState } from 'react';
import type { RhythmPreview } from '../domain/preview-data.ts';
import type { RhythmCompletionRecord } from '../domain/rhythm-completion.ts';
import { isValidDate } from '../domain/money-goals.ts';
import type { RhythmScheduleHistorySegment, RhythmTimeValue } from '../domain/rhythm-schedule.ts';
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

export function RhythmSeasonCorrectionDialog({
  rhythm,
  season,
  scoringInput,
  records,
  suggestedStartDate,
  onSave,
  onClose
}: {
  rhythm: RhythmPreview;
  season: RhythmScheduleHistorySegment;
  scoringInput: SelectRhythmScoreInput;
  records: readonly RhythmCompletionRecord[];
  suggestedStartDate: string;
  onSave: (draft: RhythmSeasonEditDraft) => string | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const scoring = rhythm.scoring!;
  const [startDate, setStartDate] = useState(season.startDate);
  const [schedule, setSchedule] = useState(
    season.kind === 'scheduled' ? season.schedule : undefined
  );
  const [timeOfDay, setTimeOfDay] = useState<RhythmTimeValue>(
    season.kind === 'scheduled'
      ? season.timeOfDay ?? rhythm.timeOfDay ?? 'anytime'
      : rhythm.timeOfDay ?? 'anytime'
  );
  const [name, setName] = useState(season.kind === 'scheduled' ? season.name ?? '' : '');
  const [error, setError] = useState('');

  const seasonIndex = scoring.scheduleHistory.findIndex(entry => entry.id === season.id);
  const next = scoring.scheduleHistory[seasonIndex + 1];
  const endDate = next
    ? rhythmSeasonInclusiveEndDate(scoring.scheduleHistory, seasonIndex)
    : scoringInput.asOfDate;
  const preservedLogs = records.filter(record => record.rhythmId === rhythm.id
    && record.effectiveDate >= season.startDate
    && (!next || record.effectiveDate < next.startDate));
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
  const maxDate = next ? rhythmSeasonInclusiveEndDate(scoring.scheduleHistory, seasonIndex) : scoringInput.asOfDate;

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
      initialFocusId="rhythm-season-start-date"
      stopEscapePropagation
      onClose={onClose}
    >
      <section className="rhythm-season-correction" aria-labelledby={titleId}>
        <h2 id={titleId}>{season.kind === 'unknown' ? 'Set earlier schedule' : 'Edit schedule period'}</h2>
        <p className="rhythm-season-correction__range">
          Affected dates: {formatDate(season.startDate)} – {endDate ? formatDate(endDate) : 'date unavailable'}
        </p>
        {season.kind === 'unknown' && season.descriptiveCadence && (
          <p className="rhythm-season-correction__context">
            Original description: {season.descriptiveCadence}
          </p>
        )}
        <p className="rhythm-season-correction__warning">
          Correcting schedule history may change which logs qualify. Thursday logs will not count toward a Monday/Wednesday/Friday schedule.
        </p>
        <p className="rhythm-season-correction__preserved">
          {preservedLogs.length} saved {preservedLogs.length === 1 ? 'log' : 'logs'} will be preserved.
        </p>
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
        <RhythmSeasonImpact before={before} after={after} />
        {error && <p className="goal-field-error" role="alert">{error}</p>}
        <div className="money-goal-dialog__actions">
          <button type="button" className="btn mini" onClick={confirm}>Confirm schedule correction</button>
          <button type="button" className="btn mini ghost" onClick={onClose}>Cancel</button>
        </div>
      </section>
    </MoneyGoalDialog>
  );
}
