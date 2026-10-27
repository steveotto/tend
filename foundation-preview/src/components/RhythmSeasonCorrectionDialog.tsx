import { useId, useState } from 'react';
import type { RhythmPreview } from '../domain/preview-data.ts';
import type { RhythmCompletionRecord } from '../domain/rhythm-completion.ts';
import { isValidDate } from '../domain/money-goals.ts';
import { addCalendarDays } from '../domain/rhythm-scoring.ts';
import type { OnTrackOccurrence, RhythmScoreResult } from '../domain/rhythm-scoring.ts';
import type {
  RhythmSchedule,
  RhythmScheduleHistorySegment,
  RhythmScoringMetadata,
  RhythmTimeValue
} from '../domain/rhythm-schedule.ts';
import { formatRhythmSchedule, rhythmTimeLabel, rhythmTimeOptions } from '../domain/rhythm-schedule.ts';
import type { SelectRhythmScoreInput } from '../domain/rhythm-scoring.ts';
import { selectRhythmScore, selectRhythmSeasonScore } from '../domain/rhythm-scoring.ts';
import { establishCurrentRhythmSeason } from '../domain/rhythm-season-edit.ts';
import type { RhythmSeasonEditDraft, RhythmSeasonEditTarget } from '../domain/rhythm-season-edit.ts';
import { resolveRhythmSeasonRange } from '../domain/rhythm-season-range.ts';
import { rhythmSeasonForDate, rhythmSeasonInclusiveEndDate } from '../domain/rhythm-seasons.ts';
import { rhythmSeasonPaletteAssignments } from '../domain/rhythm-seasons.ts';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { RhythmSeasonImpact } from './RhythmSeasonImpact.tsx';
import { formatRhythmSeasonDate, RhythmSeasonCard } from './RhythmSeasonCard.tsx';
import { RhythmScheduleFields } from './RhythmScheduleFields.tsx';
import type { RhythmScheduleFieldsDraft } from './RhythmScheduleFields.tsx';
import { StyledSelect } from './StyledSelect.tsx';

function formatDate(date: string): string {
  return formatRhythmSeasonDate(date);
}

function formatScheduleComparison(schedule: RhythmSchedule): string {
  const { endDate: _endDate, ...cadenceSchedule } = schedule;
  if (schedule.frequency === 'daily') return 'Daily';
  return formatRhythmSchedule(cadenceSchedule, 'detailed').replace(/\.$/, '');
}

function scoreDateRange(
  input: SelectRhythmScoreInput,
  scoring: RhythmScoringMetadata | undefined,
  startDate: string,
  endDate: string
): RhythmScoreResult | undefined {
  const asOfDate = endDate < input.asOfDate ? endDate : input.asOfDate;
  if (asOfDate < startDate) return undefined;
  const schedule = scoring
    ? rhythmSeasonForDate(scoring.scheduleHistory, asOfDate)
    : undefined;
  const effectiveSchedule = schedule?.kind === 'scheduled'
    ? schedule.schedule
    : scoring ? undefined : input.schedule;
  if (!effectiveSchedule) return undefined;
  return selectRhythmScore({
    ...input,
    schedule: effectiveSchedule,
    ...(scoring ? { scoring } : {}),
    createdLocalDate: startDate,
    createdTimeZone: input.createdTimeZone ?? scoring?.timeZone ?? input.timeZone,
    records: input.records.filter(record =>
      record.rhythmId === input.rhythmId
      && record.effectiveDate >= startDate
      && record.effectiveDate <= asOfDate
    ),
    asOfDate
  });
}

function scoreValuesDiffer(before: RhythmScoreResult | undefined, after: RhythmScoreResult | undefined): boolean {
  if (!before || !after) return false;
  const scoreValue = (result: RhythmScoreResult, metric: 'consistency' | 'onTrack' | 'health') => {
    if (metric === 'health') {
      return result.kind === 'rhythm-score' && result.healthScore !== null
        ? result.healthScore
        : 'unavailable';
    }
    const value = result[metric];
    return value.kind === 'scored' ? value.score : `unavailable:${value.reasonCode}`;
  };
  return (['consistency', 'onTrack', 'health'] as const).some(metric =>
    scoreValue(before, metric) !== scoreValue(after, metric)
  );
}

function scoreChangeSummaries(before: RhythmScoreResult, after: RhythmScoreResult): string[] {
  const label = (result: RhythmScoreResult, metric: 'consistency' | 'onTrack' | 'health') => {
    if (metric === 'health') {
      return result.kind === 'rhythm-score' && result.healthScore !== null
        ? String(Math.round(result.healthScore))
        : 'unavailable';
    }
    const value = result[metric];
    return value.kind === 'scored' ? String(Math.round(value.score)) : 'unavailable';
  };
  return ([
    ['Consistency', 'consistency'],
    ['On Track', 'onTrack'],
    ['Health', 'health']
  ] as const).flatMap(([name, metric]) => {
    const beforeValue = label(before, metric);
    const afterValue = label(after, metric);
    return beforeValue === afterValue ? [] : [`${name} changes from ${beforeValue} to ${afterValue}.`];
  });
}

function completedOccurrences(result: RhythmScoreResult | undefined): readonly OnTrackOccurrence[] | undefined {
  return result?.kind === 'rhythm-score' && result.onTrack.kind === 'scored'
    ? result.onTrack.evidence.occurrences.filter(occurrence => occurrence.status === 'completed')
    : undefined;
}

function logCreditSummary(
  totalLogs: number,
  affectedLogs: readonly RhythmCompletionRecord[],
  result: RhythmScoreResult | undefined,
  asOfDate: string
): { headline: string; details: string[] } {
  const savedLogs = totalLogs === 1 ? 'Your log stays saved' : `All ${totalLogs} logs stay saved`;
  const details: string[] = [];
  if (affectedLogs.length !== totalLogs) {
    details.push(`${affectedLogs.length} of ${totalLogs} logs fall within the affected date range.`);
  }
  const inScoringPeriod = affectedLogs.filter(record => record.effectiveDate <= asOfDate);
  const notYetScored = affectedLogs.length - inScoringPeriod.length;
  const occurrences = completedOccurrences(result);
  let creditSummary = totalLogs === 0
    ? 'No logs to score yet'
    : affectedLogs.length === 0
      ? 'No logs in this date range'
      : 'Scoring credit is unavailable';
  if (inScoringPeriod.length > 0 && !occurrences) {
    details.push('Scoring credit is unavailable for this draft.');
  } else if (inScoringPeriod.length > 0 && occurrences) {
    const assignedIds = new Set<string>();
    const creditedDates: string[] = [];
    for (const occurrence of occurrences) {
      const startDate = occurrence.periodStartDate ?? occurrence.date;
      const endDate = occurrence.eligibleEndDate ?? occurrence.date;
      const matching = inScoringPeriod.filter(record =>
        !assignedIds.has(record.id)
        && record.effectiveDate >= startDate
        && record.effectiveDate <= endDate
      );
      if (matching.length > 0) {
        creditedDates.push(occurrence.date);
        matching.forEach(record => assignedIds.add(record.id));
      }
    }
    const qualifyingLogs = assignedIds.size;
    const creditedOccurrences = creditedDates.length;
    const extraLogs = Math.max(0, qualifyingLogs - creditedOccurrences);
    const offScheduleLogs = inScoringPeriod.length - qualifyingLogs;
    if (qualifyingLogs === 0) {
      creditSummary = 'No logs qualify for schedule credit';
      details.push(`None of the ${inScoringPeriod.length} affected logs match a scheduled occurrence; they stay in history.`);
    } else if (qualifyingLogs === creditedOccurrences && qualifyingLogs === inScoringPeriod.length) {
      creditSummary = `${qualifyingLogs} ${qualifyingLogs === 1 ? 'counts' : 'count'} toward this schedule`;
      details.push(`${qualifyingLogs} ${qualifyingLogs === 1 ? 'log qualifies' : 'logs qualify'} for ${creditedOccurrences} scheduled ${creditedOccurrences === 1 ? 'occurrence' : 'occurrences'}.`);
    } else if (extraLogs > 0 && qualifyingLogs === inScoringPeriod.length) {
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const monthNumbers = [...new Set(creditedDates.map(date => Number(date.slice(5, 7))))];
      const monthLabels = monthNumbers.map(month => monthNames[month - 1] ?? '');
      const monthLabel = monthLabels.length === 1
        ? monthLabels[0]
        : monthLabels.join(', ');
      const monthVerb = monthLabels.length === 1 ? 'receives' : 'receive';
      creditSummary = `${monthLabel} ${monthVerb} ${creditedOccurrences} completion ${creditedOccurrences === 1 ? 'credit' : 'credits'}`;
      details.push(`${qualifyingLogs} logs qualify across ${creditedOccurrences} credited ${creditedOccurrences === 1 ? 'occurrence' : 'occurrences'}; ${extraLogs} extra ${extraLogs === 1 ? 'log does' : 'logs do'} not add credit.`);
    } else {
      creditSummary = `${qualifyingLogs} of ${inScoringPeriod.length} logs qualify for ${creditedOccurrences} ${creditedOccurrences === 1 ? 'schedule credit' : 'schedule credits'}`;
      details.push(`${qualifyingLogs} ${qualifyingLogs === 1 ? 'log qualifies' : 'logs qualify'} for ${creditedOccurrences} scheduled ${creditedOccurrences === 1 ? 'occurrence' : 'occurrences'}.`);
      if (extraLogs > 0) {
        details.push(`${extraLogs} extra ${extraLogs === 1 ? 'log does' : 'logs do'} not add credit.`);
      }
    }
    if (offScheduleLogs > 0 && qualifyingLogs > 0) {
      details.push(`${offScheduleLogs} other affected ${offScheduleLogs === 1 ? 'log does' : 'logs do'} not match a scheduled occurrence; ${offScheduleLogs === 1 ? 'it stays' : 'they stay'} in history.`);
    }
  }
  if (notYetScored > 0) {
    details.push(`${notYetScored} affected ${notYetScored === 1 ? 'log is' : 'logs are'} after the scoring date and not yet evaluated.`);
  }
  if (affectedLogs.length > 0 && inScoringPeriod.length === 0) {
    creditSummary = `${affectedLogs.length} affected ${affectedLogs.length === 1 ? 'log is' : 'logs are'} not yet evaluated`;
  }
  return {
    headline: totalLogs === 0 ? creditSummary : `${savedLogs} · ${creditSummary}`,
    details
  };
}

function SeasonSectionHeading({
  id,
  number,
  description,
  children
}: {
  id: string;
  number: number;
  description: string;
  children: string;
}) {
  return (
    <header className="rhythm-season-correction__section-heading">
      <span aria-hidden="true">{number}</span>
      <div>
        <h3 id={id}>{children}</h3>
        <p>{description}</p>
      </div>
    </header>
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
  endDate?: string;
  schedule: RhythmSchedule | undefined;
  timeOfDay: RhythmTimeValue;
  name: string;
};

export function RhythmSeasonCorrectionDialog({
  rhythm,
  season,
  scoringInput,
  records,
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
  const isAddingSeason = season.id === `new-season:${rhythm.id}`;
  const requiresStartDate = season.startDate === undefined;
  const defaultStartDate = requiresStartDate
    ? isAddingSeason
      ? scoringInput.asOfDate
      : records
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
  const activeSavedSeason = [...scheduleHistory].reverse().find(segment =>
    segment.startDate <= scoringInput.asOfDate
  );
  const savedSeason: RhythmScheduleHistorySegment | RhythmSeasonEditTarget =
    isAddingSeason
      ? activeSavedSeason ?? season
      : scheduleHistory.find(segment => segment.id === season.id) ?? season;
  const savedSeasonIndex = scheduleHistory.findIndex(segment => segment.id === savedSeason.id);
  const savedSeasonNext = savedSeasonIndex >= 0 ? scheduleHistory[savedSeasonIndex + 1] : undefined;
  const savedSeasonBoundaryEnd = savedSeasonNext && savedSeasonIndex >= 0
    ? rhythmSeasonInclusiveEndDate(scheduleHistory, savedSeasonIndex)
    : undefined;
  const savedSeasonScheduleEnd = savedSeason.kind === 'scheduled'
    ? savedSeason.schedule.endDate
    : undefined;
  const savedEndDate = [savedSeasonBoundaryEnd, savedSeasonScheduleEnd]
    .filter((value): value is string => value !== undefined && isValidDate(value))
    .sort()[0];
  const savedSeasonIsCurrent = savedSeason.kind === 'scheduled'
    && (savedSeason.startDate === undefined
      ? savedSeason.id === `current-schedule:${rhythm.id}`
        || savedSeason.id === `new-season:${rhythm.id}`
      : savedSeason.startDate <= scoringInput.asOfDate
        && (!savedSeasonNext || savedSeasonNext.startDate > scoringInput.asOfDate));
  const savedDateRange = {
    ...(savedSeason.startDate ? { startDate: savedSeason.startDate } : {}),
    ...(savedSeasonIsCurrent || !savedEndDate ? {} : { endDate: savedEndDate }),
    endLabel: savedSeasonIsCurrent ? 'Present' : 'End date not recorded'
  };
  const savedTimeValue = savedSeason.kind === 'scheduled'
    ? savedSeason.timeOfDay ?? (savedSeasonIsCurrent ? rhythm.timeOfDay : undefined)
    : undefined;
  const savedTimeLabel = savedTimeValue ? rhythmTimeLabel(savedTimeValue) : 'Time of day not recorded';
  const savedScheduleText = savedSeason.kind === 'scheduled'
    ? formatRhythmSchedule(savedSeason.schedule, 'detailed').replace(/\.$/, '')
    : savedSeason.descriptiveCadence
      ? `Original description: ${savedSeason.descriptiveCadence}`
      : 'Schedule details are not recorded.';
  const savedScheduleTitle = savedSeason.kind === 'scheduled'
    ? savedSeason.name?.trim() || formatRhythmSchedule(savedSeason.schedule, 'compact')
    : 'Earlier schedule details unavailable';
  const savedComparison = savedSeason.kind === 'scheduled'
    ? `${formatScheduleComparison(savedSeason.schedule)} · ${savedTimeValue
      ? rhythmTimeLabel(savedTimeValue)
      : 'Time not recorded'}`
    : `${savedScheduleText.replace(/\.$/, '')} · Time not recorded`;
  const savedPaletteAssignments = rhythmSeasonPaletteAssignments(scheduleHistory);
  const savedPaletteToken = savedPaletteAssignments.get(savedSeason.id) ?? savedSeason.paletteToken;
  const proposedEndDate = scheduleDraft.hasEndDate
    ? isValidDate(scheduleDraft.endDate) ? scheduleDraft.endDate : undefined
    : undefined;
  const scoringEndDate = scheduleDraft.hasEndDate
    ? isValidDate(scheduleDraft.endDate) ? scheduleDraft.endDate : undefined
    : periodEndDate;
  const affectedEndDate = periodEndDate && scoringEndDate
    ? scoringEndDate < periodEndDate ? scoringEndDate : periodEndDate
    : scoringEndDate ?? periodEndDate;
  const selectedRangeEndDate = isAddingSeason ? proposedEndDate : affectedEndDate;
  const scoreRangeEndDate = selectedRangeEndDate && selectedRangeEndDate < scoringInput.asOfDate
    ? selectedRangeEndDate
    : scoringInput.asOfDate;
  const rhythmLogs = records.filter(record => record.rhythmId === rhythm.id);
  const affectedLogs = rhythmLogs.filter(record => isValidDate(startDate)
    && isValidDate(record.effectiveDate)
    && record.effectiveDate >= startDate
    && (!selectedRangeEndDate || record.effectiveDate <= selectedRangeEndDate));
  const draft: RhythmSeasonEditDraft | undefined = schedule
    && !scheduleDraft.validationMessage
    && isValidDate(startDate)
    ? {
        segmentId: season.id,
        startDate,
        ...(proposedEndDate === undefined ? {} : { endDate: proposedEndDate }),
        schedule,
        timeOfDay,
        name
      }
    : undefined;
  const rangeResult = draft && rhythm.schedule && (isAddingSeason || (!requiresStartDate && Boolean(scoring)))
    ? resolveRhythmSeasonRange({
        rhythmId: rhythm.id,
        currentSchedule: rhythm.schedule,
        ...(scoring ? { scoring } : {}),
        timeZone: scoringInput.timeZone,
        asOfDate: scoringInput.asOfDate,
        draft: {
          ...(!isAddingSeason ? { segmentId: season.id } : {}),
          startDate: draft.startDate,
          ...(proposedEndDate ? { endDate: proposedEndDate } : {}),
          schedule: draft.schedule,
          timeOfDay: draft.timeOfDay,
          name: draft.name
        },
        coverage: {
          ...(rhythm.createdLocalDate ? { effectiveStartDate: rhythm.createdLocalDate } : {}),
          ...(records.length
            ? { earliestCompletionDate: records.map(record => record.effectiveDate).sort()[0] }
            : {}),
          ...(rhythm.timeOfDay ? { currentTimeOfDay: rhythm.timeOfDay } : {})
        }
      })
    : undefined;
  const editResult = draft && rhythm.schedule && requiresStartDate && !isAddingSeason
    ? establishCurrentRhythmSeason(
          rhythm.id,
          rhythm.schedule,
          scoring,
          scoringInput.timeZone,
          scoringInput.asOfDate,
            draft
          )
    : undefined;
  const resolvedResult = rangeResult ?? editResult
  const after = resolvedResult?.valid
    ? scoreDateRange(
        { ...scoringInput, schedule: resolvedResult.schedule },
        resolvedResult.scoring,
        startDate,
        scoreRangeEndDate
      )
    : undefined;
  const currentScore = selectRhythmScore(scoringInput);
  const savedSeasonScore = savedSeason.kind === 'scheduled'
    ? scoringInput.scoring && savedSeason.startDate !== undefined
      ? selectRhythmSeasonScore(
          scoringInput,
          savedSeason,
          savedSeasonIsCurrent ? undefined : savedEndDate
        )
      : scoringInput.scoring ? undefined : currentScore
    : undefined;
  const savedSeasonHealthScore = savedSeasonScore?.kind === 'rhythm-score'
    ? savedSeasonScore.healthScore
    : null;
  const proposedFullScore = resolvedResult?.valid
    ? selectRhythmScore({
        ...scoringInput,
        schedule: resolvedResult.schedule,
        scoring: resolvedResult.scoring
      })
    : undefined;
  const baselineTrackingStartDate = currentScore.kind === 'rhythm-score'
    ? currentScore.trackingStartDate
    : [
        scoring?.trackingStartDate,
        scoringInput.createdLocalDate,
        ...rhythmLogs.map(record => record.effectiveDate)
      ].filter((date): date is string => date !== undefined && date <= scoringInput.asOfDate).sort()[0] ?? null;
  const extendsTrackingHistory = Boolean(
    resolvedResult?.valid
    && baselineTrackingStartDate
    && resolvedResult.scoring.trackingStartDate < baselineTrackingStartDate
  );
  const earlierScoringEndDate = extendsTrackingHistory && baselineTrackingStartDate
    ? proposedEndDate && proposedEndDate < baselineTrackingStartDate
      ? proposedEndDate
      : addCalendarDays(baselineTrackingStartDate, -1)
    : undefined;
  const fullScoreChanged = extendsTrackingHistory && proposedFullScore
    ? scoreValuesDiffer(currentScore, proposedFullScore)
    : false;
  const trackingScoreChangeSummaries = extendsTrackingHistory && proposedFullScore
    ? scoreChangeSummaries(currentScore, proposedFullScore)
    : [];
  const before = scoreDateRange(
    scoringInput,
    scoring,
    startDate,
    scoreRangeEndDate
  );
  const rangeHasRecordedActivity = isValidDate(startDate) && rhythmLogs.some(record =>
    isValidDate(record.effectiveDate)
    && record.effectiveDate >= startDate
    && (!selectedRangeEndDate || record.effectiveDate <= selectedRangeEndDate)
  );
  const rangeHasScoredActivity = rangeHasRecordedActivity && rhythmLogs.some(record =>
    isValidDate(record.effectiveDate)
    && record.effectiveDate >= startDate
    && (!selectedRangeEndDate || record.effectiveDate <= selectedRangeEndDate)
    && record.effectiveDate <= scoringInput.asOfDate
  );
  const showScoreChangeWarning = (rangeHasScoredActivity && scoreValuesDiffer(before, after))
    || fullScoreChanged;
  const summarySchedule = scheduleDraft.displaySchedule ?? schedule;
  let summaryCadence = scheduleDraft.validationMessage ?? 'Choose a schedule';
  if (summarySchedule) {
    summaryCadence = formatScheduleComparison(summarySchedule);
  }
  const proposedSchedule = `${summaryCadence} · ${rhythmTimeLabel(timeOfDay)}`;
  const validationMessage = scheduleDraft.validationMessage
    ?? (!schedule
      ? 'Choose a complete, valid schedule to preview its impact.'
    : !isValidDate(startDate)
      ? requiresStartDate
        ? 'Choose when this schedule began. Logs before that date will not be scored using it.'
        : 'Choose a valid starting date to preview its impact.'
      : resolvedResult && !resolvedResult.valid
        ? resolvedResult.error
        : '');
  const affectedDateLabel = scheduleDraft.hasEndDate && !isValidDate(scheduleDraft.endDate)
    ? 'Choose a valid end date'
    : isValidDate(startDate)
    ? `${formatDate(startDate)} – ${scheduleDraft.hasEndDate
      ? isValidDate(scheduleDraft.endDate)
        ? formatDate(scheduleDraft.endDate)
        : 'date unavailable'
      : isAddingSeason
        ? 'Present'
        : next && periodEndDate && isValidDate(periodEndDate)
        ? formatDate(periodEndDate)
        : 'Present'}`
    : 'Choose a valid starting date';
  const visibleSeasonChanges = rangeResult?.valid
    ? [
        ...(rangeResult.selectedChange && rangeResult.selectedChange.change !== 'replaced'
          ? [rangeResult.selectedChange]
          : []),
        ...rangeResult.changes
      ]
    : [];
  const logSummary = logCreditSummary(rhythmLogs.length, affectedLogs, after, scoringInput.asOfDate);

  function confirm() {
    if (!draft || !resolvedResult?.valid) {
      setError(resolvedResult && !resolvedResult.valid
        ? resolvedResult.error
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
      dialogClassName="money-goal-dialog--season-correction"
      surfaceClassName="money-goal-dialog__surface--season-correction"
      onClose={onClose}
    >
      <section className="rhythm-season-correction" aria-labelledby={titleId}>
        <header className="rhythm-season-correction__header">
          <h2 id={titleId}>{isAddingSeason ? 'Add a season' : season.kind === 'unknown' ? 'Set earlier schedule' : 'Edit season'}</h2>
          <p>{rhythm.title}</p>
        </header>
        <section className="rhythm-season-correction__step" aria-labelledby={savedScheduleHeadingId}>
          <SeasonSectionHeading
            id={savedScheduleHeadingId}
            number={1}
            description="This is your current schedule for this season."
          >
            {isAddingSeason ? 'Current schedule' : 'Your saved schedule'}
          </SeasonSectionHeading>
          <div className="rhythm-season-correction__step-card rhythm-season-correction__saved-card">
            <RhythmSeasonCard
              seasonKind={savedSeason.kind}
              paletteToken={savedPaletteToken}
              seasonId={savedSeason.id}
              title={savedScheduleTitle}
              dateRange={savedDateRange}
              healthScore={savedSeasonHealthScore}
              {...(savedSeasonIsCurrent ? { statusLabel: 'Current' } : {})}
              {...(savedSeason.kind === 'scheduled'
                ? { schedule: savedSeason.schedule, timeLabel: savedTimeLabel }
                : {
                    scheduleLabel: 'Schedule details unavailable.',
                    timeLabel: savedTimeLabel,
                    ...(savedSeason.descriptiveCadence
                      ? { note: `Original description: ${savedSeason.descriptiveCadence}` }
                      : {})
                  })}
            />
          </div>
        </section>

        <section className="rhythm-season-correction__step" aria-labelledby={makeChangesHeadingId}>
          <SeasonSectionHeading
            id={makeChangesHeadingId}
            number={2}
            description="Update the details for this season."
          >
            Make your changes
          </SeasonSectionHeading>
          <div className="rhythm-season-correction__step-card rhythm-season-correction__edit-card">
            {isAddingSeason && (
              <p className="rhythm-season-correction__range-help">
                Set a schedule for a date range. Existing seasons will adjust to fit.
              </p>
            )}
            <div className="goal-field rhythm-season-correction__name">
              <label htmlFor="rhythm-season-name">Season name (optional)</label>
              <input
                id="rhythm-season-name"
                maxLength={80}
                placeholder="e.g. Morning routine"
                value={name}
                onChange={event => {
                  setName(event.currentTarget.value);
                  setError('');
                }}
              />
            </div>
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
            <p className="rhythm-season-correction__affected-dates">
              <SeasonCalendarIcon />
              <span className="rhythm-season-correction__affected-label">Affected dates</span>
              <strong>{affectedDateLabel}</strong>
            </p>
            {validationMessage && <p className="goal-field-error" role="alert">{validationMessage}</p>}
          </div>
        </section>

        <section className="rhythm-season-correction__step" aria-labelledby={reviewImpactHeadingId}>
          <SeasonSectionHeading
            id={reviewImpactHeadingId}
            number={3}
            description="See how your changes affect your data."
          >
            Review the impact
          </SeasonSectionHeading>
          <div className="rhythm-season-correction__step-card rhythm-season-correction__review-card">
          {isAddingSeason ? (
            <div className="rhythm-season-correction__schedule-comparison rhythm-season-correction__schedule-comparison--single" role="group" aria-label="New season schedule">
              <div className="rhythm-season-correction__schedule-side rhythm-season-correction__schedule-side--proposed">
                <span>Proposed</span>
                <strong>{proposedSchedule}</strong>
              </div>
            </div>
          ) : (
            <div className="rhythm-season-correction__schedule-comparison" role="group" aria-label="Saved and proposed schedules">
              <div className="rhythm-season-correction__schedule-side">
                <span>Saved</span>
                <strong>{savedComparison}</strong>
              </div>
              <span className="rhythm-season-correction__schedule-arrow" aria-hidden="true">→</span>
              <div className="rhythm-season-correction__schedule-side rhythm-season-correction__schedule-side--proposed">
                <span>Proposed</span>
                <strong>{proposedSchedule}</strong>
              </div>
            </div>
          )}
          <p className="rhythm-season-correction__effective-range" aria-label={`Affected dates: ${affectedDateLabel}`}>
            <SeasonCalendarIcon />
            <strong>{affectedDateLabel}</strong>
          </p>
          {rangeResult?.valid && (visibleSeasonChanges.length > 0 || showScoreChangeWarning || extendsTrackingHistory) && (
            <div className="rhythm-season-correction__range-preview" aria-live="polite">
              {visibleSeasonChanges.length > 0 && (
                <ul>
                  {visibleSeasonChanges.map(change => (
                    <li key={change.seasonId}>
                      {change.label} will be {change.change === 'replaced' ? 'removed' : change.change}.
                    </li>
                  ))}
                </ul>
              )}
              {showScoreChangeWarning && <p>Affected historical scores may change.</p>}
              {extendsTrackingHistory && earlierScoringEndDate && (
                <>
                  <p>This adds earlier scheduled dates to your scores. Dates without a log will count as missed.</p>
                  <p>
                    Earlier scheduled range: {formatDate(startDate)} – {formatDate(earlierScoringEndDate)}.
                  </p>
                  {trackingScoreChangeSummaries.map(summary => <p key={summary}>{summary}</p>)}
                </>
              )}
            </div>
          )}
          <div className="rhythm-season-correction__log-summary" role="group" aria-label="Log preservation and scoring credit">
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path d="M10 2.5 16 4.7v4.6c0 3.7-2.5 6.3-6 8.2-3.5-1.9-6-4.5-6-8.2V4.7L10 2.5Z" />
              <path d="m7.2 9.8 1.8 1.8 3.9-4" />
            </svg>
            <p>{logSummary.headline}</p>
            {logSummary.details.length > 0 && (
              <details>
                <summary>Log details</summary>
                <ul>
                  {logSummary.details.map(line => <li key={line}>{line}</li>)}
                </ul>
              </details>
            )}
          </div>
          <RhythmSeasonImpact
            {...(before ? { before } : {})}
            after={after}
            mode={isAddingSeason ? 'single' : 'comparison'}
            noRecordedActivity={!rangeHasRecordedActivity}
            noScorableActivity={!rangeHasScoredActivity}
            {...(isAddingSeason ? {
              singleScore: after,
              ...(rangeHasScoredActivity
                ? { singleMessage: `Scores use recorded activity from ${affectedDateLabel}.` }
                : rangeHasRecordedActivity
                  ? { singleMessage: 'No activity in this date range is eligible to score yet.' }
                  : { singleMessage: 'No recorded activity in this date range.' })
            } : { detailsDisclosure: rangeHasScoredActivity, hideHeading: true })}
            beforeSchedule={season.kind === 'scheduled' ? season.schedule : undefined}
            afterSchedule={summarySchedule}
            showChange={!isAddingSeason}
          />
          {error && <p className="goal-field-error" role="alert">{error}</p>}
          </div>
        </section>
        {!canDelete && seasonIndex >= 0 && deleteRestriction && (
          <p className="rhythm-season-correction__delete-restriction">{deleteRestriction}</p>
        )}
        <div className="rhythm-season-correction__action-bar">
          <button type="button" className="btn mini rhythm-season-correction__apply" onClick={confirm}>Apply</button>
          <button type="button" className="btn mini ghost" onClick={onClose}>Cancel</button>
          {canDelete && onRequestDelete && !isAddingSeason && (
            <button
              id="rhythm-season-delete-from-editor"
              type="button"
              className="btn mini rhythm-season-correction__delete"
              onClick={() => onRequestDelete({ startDate, schedule, timeOfDay, name })}
            >
              Delete season
            </button>
          )}
        </div>
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
