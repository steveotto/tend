import { useId, useState } from 'react';
import type { RhythmPreview } from '../domain/preview-data.ts';
import type { RhythmCompletionRecord } from '../domain/rhythm-completion.ts';
import { isValidDate } from '../domain/money-goals.ts';
import { hasRhythmOccurrenceForCompletion } from '../domain/rhythm-occurrences.ts';
import type { RhythmSchedule, RhythmTimeValue } from '../domain/rhythm-schedule.ts';
import { formatRhythmSchedule, rhythmTimeLabel, rhythmTimeOptions } from '../domain/rhythm-schedule.ts';
import type { SelectRhythmScoreInput } from '../domain/rhythm-scoring.ts';
import { selectRhythmScore } from '../domain/rhythm-scoring.ts';
import { editRhythmSeason, establishCurrentRhythmSeason } from '../domain/rhythm-season-edit.ts';
import type { RhythmSeasonEditDraft, RhythmSeasonEditTarget } from '../domain/rhythm-season-edit.ts';
import { rhythmSeasonInclusiveEndDate } from '../domain/rhythm-seasons.ts';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { RhythmSeasonImpact } from './RhythmSeasonImpact.tsx';
import { RhythmScheduleFields } from './RhythmScheduleFields.tsx';
import type { RhythmScheduleFieldsDraft } from './RhythmScheduleFields.tsx';
import { StyledSelect } from './StyledSelect.tsx';

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(`${date}T12:00:00Z`));
}

function SeasonSectionHeading({
  id,
  number,
  children
}: {
  id: string;
  number: number;
  children: string;
}) {
  return (
    <h3 className="rhythm-season-correction__section-heading" id={id}>
      <span aria-hidden="true">{number}</span>
      {children}
    </h3>
  );
}

function SeasonCalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2.75" y="4.25" width="14.5" height="13" rx="2" />
      <path d="M6 2.75v3M14 2.75v3M3 8h14" />
    </svg>
  );
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
  season: RhythmSeasonEditTarget;
  scoringInput: SelectRhythmScoreInput;
  records: readonly RhythmCompletionRecord[];
  suggestedStartDate?: string;
  initialDraft?: RhythmSeasonEditDialogDraft;
  canDelete: boolean;
  deleteRestriction?: string;
  onSave: (draft: RhythmSeasonEditDraft) => string | null;
  onRequestDelete?: (draft: RhythmSeasonEditDialogDraft) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const savedScheduleHeadingId = useId();
  const makeChangesHeadingId = useId();
  const reviewImpactHeadingId = useId();
  const scoring = rhythm.scoring ?? scoringInput.scoring;
  const scheduleHistory = scoring?.scheduleHistory ?? [];
  const requiresStartDate = season.startDate === undefined;
  const defaultStartDate = requiresStartDate
    ? records
        .filter(record => record.rhythmId === rhythm.id
          && isValidDate(record.effectiveDate)
          && record.effectiveDate <= scoringInput.asOfDate)
        .map(record => record.effectiveDate)
        .sort()[0] ?? scoringInput.asOfDate
    : '';
  const [startDate, setStartDate] = useState(
    initialDraft?.startDate ?? season.startDate ?? defaultStartDate
  );
  const initialSchedule =
    initialDraft?.schedule ?? (season.kind === 'scheduled' ? season.schedule : undefined)
  const [schedule, setSchedule] = useState(initialSchedule);
  const [scheduleDraft, setScheduleDraft] = useState<RhythmScheduleFieldsDraft>({
    ...(initialSchedule ? { schedule: initialSchedule, displaySchedule: initialSchedule } : {}),
    hasEndDate: initialSchedule?.endDate !== undefined,
    endDate: initialSchedule?.endDate ?? ''
  });
  const [timeOfDay, setTimeOfDay] = useState<RhythmTimeValue>(
    initialDraft?.timeOfDay ?? (season.kind === 'scheduled'
      ? season.timeOfDay ?? rhythm.timeOfDay ?? 'anytime'
      : rhythm.timeOfDay ?? 'anytime')
  );
  const [name, setName] = useState(initialDraft?.name ?? (season.kind === 'scheduled' ? season.name ?? '' : ''));
  const [error, setError] = useState('');
  const [startDateHelpOpen, setStartDateHelpOpen] = useState(false);

  const seasonIndex = scheduleHistory.findIndex(entry => entry.id === season.id);
  const next = seasonIndex >= 0 ? scheduleHistory[seasonIndex + 1] : undefined;
  const periodEndDate = next && seasonIndex >= 0
    ? rhythmSeasonInclusiveEndDate(scheduleHistory, seasonIndex)
    : scoringInput.asOfDate;
  const savedBoundaryEndDate = next ? periodEndDate : undefined;
  const savedScheduleEndDate = season.kind === 'scheduled' ? season.schedule.endDate : undefined;
  const savedEndDate = [savedBoundaryEndDate, savedScheduleEndDate]
    .filter((value): value is string => value !== undefined && isValidDate(value))
    .sort()[0];
  const savedDateRange = `${season.startDate ? formatDate(season.startDate) : 'Start date not recorded'} – ${savedEndDate ? formatDate(savedEndDate) : 'Present'}`;
  const savedTimeValue = season.kind === 'scheduled'
    ? season.timeOfDay ?? (requiresStartDate ? rhythm.timeOfDay : undefined)
    : undefined;
  const savedTimeLabel = savedTimeValue
    ? rhythmTimeLabel(savedTimeValue)
    : 'Time of day not recorded';
  const savedScheduleText = season.kind === 'scheduled'
    ? formatRhythmSchedule(season.schedule, 'detailed').replace(/\.$/, '')
    : season.descriptiveCadence
      ? `Original description: ${season.descriptiveCadence}`
      : 'Schedule details are not recorded.';
  const savedScheduleTitle = season.kind === 'scheduled'
    ? season.name?.trim() || savedScheduleText
    : 'Earlier schedule details unavailable';
  const savedScheduleDetails = season.kind === 'scheduled'
    ? season.name?.trim() ? savedScheduleText : undefined
    : savedScheduleText;
  const savedComparison = season.kind === 'scheduled'
    ? `${savedScheduleText} · ${savedTimeLabel}`
    : savedScheduleDetails ?? savedScheduleTitle;
  const savedPaletteClass = season.kind === 'unknown'
    ? 'rhythm-history-view__season-visual--unknown'
    : `rhythm-history-view__season-visual--${season.paletteToken}`;
  const proposedEndDate = scheduleDraft.hasEndDate
    ? isValidDate(scheduleDraft.endDate) ? scheduleDraft.endDate : undefined
    : periodEndDate;
  const affectedEndDate = periodEndDate && proposedEndDate
    ? proposedEndDate < periodEndDate ? proposedEndDate : periodEndDate
    : proposedEndDate ?? periodEndDate;
  const rhythmLogs = records.filter(record => record.rhythmId === rhythm.id);
  const affectedLogs = rhythmLogs.filter(record => isValidDate(startDate)
    && record.rhythmId === rhythm.id
    && record.effectiveDate >= startDate
    && (!affectedEndDate || record.effectiveDate <= affectedEndDate));
  const logsOutsideProposedSchedule = schedule
    ? affectedLogs.filter(record => !hasRhythmOccurrenceForCompletion(schedule, record.effectiveDate, startDate))
    : [];
  const outsideScheduleDates = [...new Set(logsOutsideProposedSchedule.map(record =>
    formatDate(record.effectiveDate)
  ))];
  const before = selectRhythmScore(scoringInput);
  const draft: RhythmSeasonEditDraft | undefined = schedule
    && !scheduleDraft.validationMessage
    && isValidDate(startDate)
    ? { segmentId: season.id, startDate, schedule, timeOfDay, name }
    : undefined;
  const editResult = draft && rhythm.schedule
    ? requiresStartDate
      ? establishCurrentRhythmSeason(
          rhythm.id,
          rhythm.schedule,
          scoring,
          scoringInput.timeZone,
          scoringInput.asOfDate,
          draft
        )
      : scoring
        ? editRhythmSeason(rhythm.id, rhythm.schedule, scoring, draft)
        : undefined
    : undefined;
  const after = editResult?.valid
    ? selectRhythmScore({
        ...scoringInput,
        schedule: editResult.schedule,
        scoring: editResult.scoring
      })
    : undefined;
  const summarySchedule = scheduleDraft.displaySchedule ?? schedule;
  let summaryCadence = scheduleDraft.validationMessage ?? 'Choose a schedule';
  if (summarySchedule) {
    const { endDate: _endDate, ...cadenceSchedule } = summarySchedule;
    summaryCadence = formatRhythmSchedule(cadenceSchedule, 'detailed').replace(/\.$/, '');
  }
  const proposedSchedule = name.trim() ? `${name.trim()} · ${summaryCadence}` : summaryCadence;
  const maxDate = periodEndDate ?? scoringInput.asOfDate;
  const validationMessage = scheduleDraft.validationMessage
    ?? (!schedule
      ? 'Choose a complete, valid schedule to preview its impact.'
    : !isValidDate(startDate)
      ? requiresStartDate
        ? 'Choose when this schedule began. Logs before that date will not be scored using it.'
        : 'Choose a valid starting date to preview its impact.'
      : editResult && !editResult.valid
        ? editResult.error
        : '');
  const affectedDateLabel = scheduleDraft.hasEndDate && !isValidDate(scheduleDraft.endDate)
    ? 'Choose a valid end date'
    : isValidDate(startDate)
    ? `${formatDate(startDate)} – ${scheduleDraft.hasEndDate
      ? isValidDate(scheduleDraft.endDate)
        ? next && periodEndDate && periodEndDate < scheduleDraft.endDate
          ? formatDate(periodEndDate)
          : formatDate(scheduleDraft.endDate)
        : 'date unavailable'
      : next && periodEndDate && isValidDate(periodEndDate)
        ? formatDate(periodEndDate)
        : 'Present'}`
    : 'Choose a valid starting date';

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
      initialFocusId={initialDraft ? 'rhythm-season-delete-from-editor' : 'rhythm-season-name'}
      stopEscapePropagation
      onClose={onClose}
    >
      <section className="rhythm-season-correction" aria-labelledby={titleId}>
        <header className="rhythm-season-correction__header">
          <h2 id={titleId}>{season.kind === 'unknown' ? 'Set earlier schedule' : 'Edit season'}</h2>
          <p>{rhythm.title}</p>
        </header>
        <section className="rhythm-season-correction__step" aria-labelledby={savedScheduleHeadingId}>
          <SeasonSectionHeading id={savedScheduleHeadingId} number={1}>Your saved schedule</SeasonSectionHeading>
          <div className={`rhythm-season-correction__saved-schedule ${savedPaletteClass}`}>
            <SeasonCalendarIcon className="rhythm-season-correction__saved-calendar" />
            <div className="rhythm-season-correction__saved-copy">
              <strong>{savedScheduleTitle}</strong>
              {savedScheduleDetails && <p>{savedScheduleDetails}</p>}
              <p>{savedDateRange} · {savedTimeLabel}</p>
            </div>
          </div>
        </section>

        <section className="rhythm-season-correction__step" aria-labelledby={makeChangesHeadingId}>
          <SeasonSectionHeading id={makeChangesHeadingId} number={2}>Make your changes</SeasonSectionHeading>
          <div className="goal-field rhythm-season-correction__name">
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
          <p className="rhythm-season-correction__affected-dates">
            <SeasonCalendarIcon />
            <span className="rhythm-season-correction__affected-label">Affected dates</span>
            <strong>{affectedDateLabel}</strong>
          </p>
          {!requiresStartDate && (
            <p className="rhythm-season-correction__suggestion">
              {suggestedStartDate
                ? `Suggested starting date: ${formatDate(suggestedStartDate)}. Choose the date this schedule began.`
                : 'Choose the date this schedule began.'}
            </p>
          )}
          <div className="rhythm-season-correction__date-field-group">
            <div className="goal-field rhythm-season-correction__start-date">
              <div className="rhythm-season-correction__start-date-label">
                <label htmlFor="rhythm-season-start-date">Starting date</label>
                {requiresStartDate && (
                  <button
                    type="button"
                    className="rhythm-season-correction__hint-trigger"
                    aria-label="Starting date help"
                    aria-haspopup="dialog"
                    onClick={() => setStartDateHelpOpen(true)}
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                      <circle cx="8" cy="8" r="6.25" />
                      <path d="M8 7.1v4M8 4.85h.01" />
                    </svg>
                  </button>
                )}
              </div>
              <input
                id="rhythm-season-start-date"
                type="date"
                min={requiresStartDate
                  ? scheduleHistory.at(-1)?.startDate
                  : scheduleHistory[Math.max(0, seasonIndex - 1)]?.startDate}
                max={maxDate}
                value={startDate}
                onChange={event => {
                  setStartDate(event.currentTarget.value);
                  setError('');
                }}
              />
            </div>
          </div>
          <RhythmScheduleFields
            schedule={schedule}
            defaultEndDate={scoringInput.asOfDate}
            onChange={nextSchedule => {
              setSchedule(nextSchedule);
              setError('');
            }}
            onDraftChange={setScheduleDraft}
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
        </section>

        <section className="rhythm-season-correction__step" aria-labelledby={reviewImpactHeadingId}>
          <SeasonSectionHeading id={reviewImpactHeadingId} number={3}>Review the impact</SeasonSectionHeading>
          <div className="rhythm-season-correction__schedule-comparison" role="group" aria-label="Saved and proposed schedules">
            <div className="rhythm-season-correction__schedule-side">
              <span>Saved schedule</span>
              <strong>{savedComparison}</strong>
            </div>
            <span className="rhythm-season-correction__schedule-arrow" aria-hidden="true">→</span>
            <div className="rhythm-season-correction__schedule-side">
              <span>Proposed schedule</span>
              <strong>{proposedSchedule}</strong>
            </div>
          </div>
          <p className="rhythm-season-correction__effective-range">
            Effective {affectedDateLabel} · {rhythmTimeLabel(timeOfDay)}
          </p>
          <p className="rhythm-season-correction__preserved">
            All logs remain saved ({rhythmLogs.length} total); {affectedLogs.length} fall within the affected period.
          </p>
          {logsOutsideProposedSchedule.length > 0 && outsideScheduleDates.length > 0 && (
            <p className="rhythm-season-correction__warning">
              {logsOutsideProposedSchedule.length} logged {logsOutsideProposedSchedule.length === 1 ? 'moment' : 'moments'}
              {' '}({outsideScheduleDates.join(', ')}) will not receive scoring credit under the proposed schedule.
            </p>
          )}
          {validationMessage && <p className="goal-field-error" role="alert">{validationMessage}</p>}
          <RhythmSeasonImpact before={before} after={after} detailsDisclosure hideHeading />
          {error && <p className="goal-field-error" role="alert">{error}</p>}
          <div className="money-goal-dialog__actions">
            <button type="button" className="btn mini" onClick={confirm}>Apply</button>
            <button type="button" className="btn mini ghost" onClick={onClose}>Cancel</button>
          </div>
        </section>
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
        {!canDelete && seasonIndex >= 0 && deleteRestriction && (
          <p className="rhythm-season-correction__delete-restriction">{deleteRestriction}</p>
        )}
        {requiresStartDate && startDateHelpOpen && (
          <MoneyGoalDialog
            title="Starting date"
            closeLabel="Close starting date help"
            stopEscapePropagation
            dialogClassName="money-goal-dialog--compact"
            surfaceClassName="rhythm-season-correction__help-dialog"
            onClose={() => setStartDateHelpOpen(false)}
          >
            <p>
              Starting date defaults to the earliest logged moment, or today if there are no logs. Change it if this schedule began on a different date.
            </p>
            <div className="money-goal-dialog__actions">
              <button
                type="button"
                className="btn mini"
                onClick={() => setStartDateHelpOpen(false)}
              >
                Close
              </button>
            </div>
          </MoneyGoalDialog>
        )}
      </section>
    </MoneyGoalDialog>
  );
}
