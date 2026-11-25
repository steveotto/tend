import { useState } from 'react';
import type { PersonPrayerHistory } from '../domain/person-prayer-history.ts';
import { formatPrayerLogDate, formatPrayerLogTime } from '../domain/person-prayer-history.ts';
import type {
  PersonPrayerLog,
  PersonPrayerLogUndo,
  PersonPrayerRequest
} from '../domain/person-prayers.ts';
import type { PersonPrayerHealthSelection } from '../domain/person-prayer-health.ts';
import { formatRhythmActivityDate, type PersonPreview } from '../domain/preview-data.ts';
import { rhythmScheduleSummary, rhythmTimeLabel } from '../domain/rhythm-schedule.ts';
import type { RhythmScoreResult } from '../domain/rhythm-scoring.ts';
import { CollapsibleHistorySection } from './CollapsibleHistorySection.tsx';
import { DailyCountHistoryChart } from './DailyCountHistoryChart.tsx';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { PersonBadge } from './PersonBadge.tsx';
import { PersonPrayerCountBadge } from './PersonPrayerCountBadge.tsx';
import { HealthScoreBreakdown, HealthScoreInfoButton } from './HealthScoreBreakdown.tsx';
import { HealthScoreDetailsDialog } from './HealthScoreDetailsDialog.tsx';
import { HealthScoreDetailsContent } from './HealthScoreDetailsContent.tsx';
import { RhythmHealthScoringDetails } from './RhythmHealthScoringDetails.tsx';
import { PersonPrayerLogForm } from './PersonPrayerLogForm.tsx';
import { RecordCardFrame } from './RecordCardFrame.tsx';
import { RhythmCalendarIcon, RhythmScheduleSummary } from './RhythmMetadata.tsx';
import { RhythmMetadataIcon } from './RhythmMetadataIcon.tsx';
import { useRhythmTimeOptions } from './TimeBlocksContext.tsx';
import type { HealthScoreMetric } from './HealthScoreBreakdown.tsx';

type DeletePrayerLogResult = PersonPrayerLogUndo | string;

export function PersonPrayerHistoryDialog({
  request,
  person,
  owner,
  sharedPeople,
  history,
  personPrayerHealth,
  today,
  timeZone,
  undoLog,
  onEditRequest,
  onSaveLog,
  onDeleteLog,
  onUndoDeleteLog,
  onClose
}: {
  request: PersonPrayerRequest;
  person: PersonPreview;
  owner: PersonPreview;
  sharedPeople: readonly PersonPreview[];
  history: PersonPrayerHistory;
  personPrayerHealth?: PersonPrayerHealthSelection;
  today: string;
  timeZone: string;
  undoLog: PersonPrayerLogUndo | null;
  onEditRequest: () => void;
  onSaveLog?: (log: PersonPrayerLog, expectedUpdatedAt: string) => string | null;
  onDeleteLog?: (logId: string, expectedUpdatedAt: string) => DeletePrayerLogResult;
  onUndoDeleteLog?: (undo: PersonPrayerLogUndo) => string | null;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [healthDetailsExpanded, setHealthDetailsExpanded] = useState(false);
  const [editingLog, setEditingLog] = useState<PersonPrayerLog | 'new' | null>(null);
  const [editingExpectedUpdatedAt, setEditingExpectedUpdatedAt] = useState<string | null>(null);
  const [deletingLog, setDeletingLog] = useState<PersonPrayerLog | null>(null);
  const [deletingExpectedUpdatedAt, setDeletingExpectedUpdatedAt] = useState<string | null>(null);
  const [logError, setLogError] = useState('');
  const [undoError, setUndoError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const timeOptions = useRhythmTimeOptions();
  const dialogTitleId = `person-prayer-history-title-${request.id}`;
  const scoreDetailsId = `person-prayer-health-details-${request.id}`;
  const lastPrayed = history.lastPrayedDate
    ? formatRhythmActivityDate(history.lastPrayedDate, today)
    : history.totalCount > 0
      ? 'Date not recorded'
      : 'Not yet';
  const requestHealth = personPrayerHealth?.requests.find(item => item.requestId === request.id);
  const requestHealthScore = requestHealth?.score ?? null;
  const scoreResult = requestHealth?.scoreResult;
  const consistency = scoreResult ? healthMetric(scoreResult.consistency) : unavailableHealthMetric();
  const onTrack = scoreResult ? healthMetric(scoreResult.onTrack) : unavailableHealthMetric();
  const schedule = request.schedule;

  function closeScoreDetails() {
    setHealthDetailsExpanded(false);
  }

  function saveLog(log: PersonPrayerLog): string | null {
    if (!onSaveLog) return 'Prayer logging is unavailable.';
    const error = onSaveLog(log, editingExpectedUpdatedAt ?? request.updatedAt);
    if (error) return error;
    setEditingLog(null);
    setEditingExpectedUpdatedAt(null);
    setLogError('');
    setAnnouncement(log.id && request.prayerLogs.some(item => item.id === log.id)
      ? 'Prayer entry updated.'
      : 'Prayer logged.');
    return null;
  }

  function deleteLog() {
    if (!deletingLog || !deletingExpectedUpdatedAt || !onDeleteLog) return;
    const result = onDeleteLog(deletingLog.id, deletingExpectedUpdatedAt);
    if (typeof result === 'string') {
      setLogError(result);
      return;
    }
    setDeletingLog(null);
    setDeletingExpectedUpdatedAt(null);
    setLogError('');
    setAnnouncement('Prayer entry deleted. Undo is available.');
  }

  function undoDelete() {
    if (!undoLog || !onUndoDeleteLog) return;
    const error = onUndoDeleteLog(undoLog);
    if (error) {
      setUndoError(error);
      return;
    }
    setUndoError('');
    setAnnouncement('Prayer entry restored.');
  }

  return (
    <MoneyGoalDialog
      title="Prayer history"
      titleId={dialogTitleId}
      labelledBy={dialogTitleId}
      closeLabel="Close prayer history"
      closeButtonId={`person-prayer-history-close-${request.id}`}
      initialFocusId={dialogTitleId}
      dialogClassName="person-prayer-history-dialog prayer-theme"
      bodyClassName="person-prayer-history-dialog__body"
      phoneFullScreen
      scrollableBody
      portalToBody
      stopEscapePropagation
      closeOnEscape
      onClose={onClose}
    >
      <div className="person-prayer-history">
        <RecordCardFrame
          className="rhythm-card--simple person-prayer-card person-prayer-history__summary"
          headingId={`person-prayer-history-summary-${request.id}`}
        >
          <div className="rhythm-card__simple-content person-prayer-card__content">
            <div className="person-prayer-card__heading">
              <div className="person-prayer-card__heading-main">
                <h3 id={`person-prayer-history-summary-${request.id}`} className="person-prayer-card__title">
                  {request.title}
                </h3>
                {request.details && <p className="person-prayer-card__details">{request.details}</p>}
              </div>
              <button
                type="button"
                className="person-prayer-history__edit"
                aria-label={`Edit prayer request ${request.title}`}
                title="Edit prayer request"
                onClick={onEditRequest}
              >
                <RhythmMetadataIcon kind="edit" />
              </button>
            </div>
            <div className="person-prayer-card__associations">
              <div className="person-prayer-card__association" role="group" aria-label="Prayer profile">
                <PersonBadge person={person} presentation="static" displayNameMode="full" />
              </div>
              {owner.id !== person.id && (
                <div className="person-prayer-card__association" role="group" aria-label="Request owner">
                  <span>Owned by</span>
                  <PersonBadge person={owner} presentation="static" displayNameMode="full" />
                </div>
              )}
              {sharedPeople.length > 0 && (
                <div className="person-prayer-card__association" role="group" aria-label="Shared with">
                  <span>Shared with</span>
                  <span className="person-prayer-card__badges">
                    {sharedPeople.map(sharedPerson => (
                      <PersonBadge
                        key={sharedPerson.id}
                        person={sharedPerson}
                        presentation="static"
                        displayNameMode="full"
                      />
                    ))}
                  </span>
                </div>
              )}
            </div>
            {!request.schedule && (
              <p className="person-prayer-card__schedule">Prayer frequency not set</p>
            )}
            <div className="person-prayer-card__count-row">
              <PersonPrayerCountBadge count={history.totalCount} />
            </div>
          </div>
          <footer className="rhythm-card__meta person-prayer-card__footer">
            <div className="rhythm-metadata-footer">
              {request.schedule && (
                <RhythmScheduleSummary
                  schedule={request.schedule}
                  timeLabel={request.timeOfDay
                    ? rhythmTimeLabel(request.timeOfDay, timeOptions)
                    : 'Time of day not set'}
                  presentation="card-footer"
                />
              )}
              <span className="person-prayer-card__last-prayed" aria-label={`Last prayed: ${lastPrayed}`}>
                <RhythmCalendarIcon />
                <span>{lastPrayed}</span>
              </span>
            </div>
          </footer>
        </RecordCardFrame>

        {requestHealth && (
          <section
            className="rhythm-history-view__score-section rhythm-history-view__card person-prayer-history__health"
            aria-label="Health, Consistency, and On Track scores for this prayer request"
          >
            <HealthScoreBreakdown
              className="rhythm-history-view__score-card"
              title="Health"
              score={requestHealthScore}
              consistency={consistency}
              onTrack={onTrack}
              measureDisclosure
              ariaLabel="Prayer request Health score summary"
              headingAction={(
                <HealthScoreInfoButton
                  label="Show Consistency and On Track score details"
                  controls={scoreDetailsId}
                  expanded={healthDetailsExpanded}
                  onClick={() => setHealthDetailsExpanded(expanded => !expanded)}
                />
              )}
              showMeasureCaptions={false}
            >
              {healthDetailsExpanded && scoreResult && (
                <HealthScoreDetailsDialog
                  title="Prayer Health details"
                  titleLeadingAction={(
                    <button
                      type="button"
                      className="rhythm-history-view__health-details-back"
                      aria-label="Back to prayer request details"
                      onClick={closeScoreDetails}
                    >
                      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                        <path d="m10.5 3.5-4.5 4.5 4.5 4.5" />
                      </svg>
                    </button>
                  )}
                  showCloseButton={false}
                  onClose={closeScoreDetails}
                  className="rhythm-history-view__health-details-dialog"
                >
                  <HealthScoreDetailsContent
                    key={request.id}
                    title="Health"
                    ariaLabel="Prayer request Health score details"
                    score={requestHealthScore}
                    healthLabel="Prayer request Health"
                    consistency={consistency}
                    onTrack={onTrack}
                    healthIdentity={{
                      name: request.title,
                      secondary: schedule
                        ? `${rhythmScheduleSummary(schedule)} · ${request.timeOfDay
                          ? rhythmTimeLabel(request.timeOfDay, timeOptions)
                          : 'Time of day not set'}`
                        : 'Prayer frequency not set',
                      icon: { kind: 'prayer' }
                    }}
                    showScoreNote={false}
                    initialContributionExpanded={false}
                    scoringCard={(
                      <RhythmHealthScoringDetails
                        id={scoreDetailsId}
                        consistency={scoreResult.consistency}
                        onTrack={scoreResult.onTrack}
                        healthScore={requestHealthScore}
                        {...(requestHealth?.unavailableReason
                          ? { unavailableExplanation: requestHealth.unavailableReason }
                          : {})}
                        {...(schedule ? { schedule } : {})}
                        asOfDate={today}
                        createdOnTrackScore={null}
                        formatDate={date => formatPrayerLogDate({ prayedOn: date }, timeZone)}
                        activity="prayer"
                        initiallyExpanded={false}
                      />
                    )}
                  />
                </HealthScoreDetailsDialog>
              )}
            </HealthScoreBreakdown>
          </section>
        )}

        <p className="person-prayer-history__window">
          <strong>{history.recentCount} {history.recentCount === 1 ? 'time' : 'times'} prayed · last 30 days</strong>
          <span>{history.totalCount} {history.totalCount === 1 ? 'prayer' : 'prayers'} recorded</span>
        </p>
        {history.undatedCount > 0 && (
          <p className="person-prayer-history__notice" role="note">
            {history.undatedCount} historical {history.undatedCount === 1 ? 'prayer has' : 'prayers have'} no saved date and
            {' '}are excluded from the dated chart and 30-day count.
          </p>
        )}
        {history.futureDatedCount > 0 && (
          <p className="person-prayer-history__notice" role="note">
            {history.futureDatedCount} future-dated {history.futureDatedCount === 1 ? 'record is' : 'records are'}
            {' '}excluded from the dated chart and 30-day count.
          </p>
        )}
        {history.dailyCounts.every(item => item.count === 0) && (
          <p className="person-prayer-history__empty">
            {history.totalCount === 0
              ? 'No prayer history is recorded for this request yet.'
              : 'No dated prayer activity is available for this request yet.'}
          </p>
        )}
        <DailyCountHistoryChart
          dailyCounts={history.dailyCounts}
          todayDate={today}
          activityName="Prayer"
          activitySingular="prayer"
          activityPlural="prayers"
          valuesLabel="Recorded prayer count by date"
          theme="prayer"
        />
        <CollapsibleHistorySection
          className="rhythm-history-view__logged-moments rhythm-history-view__card person-prayer-history__logged"
          label="Logged prayers"
          count={history.totalCount}
          expanded={expanded}
          onExpandedChange={setExpanded}
        >
          {onSaveLog && (
            <div className="rhythm-history-view__log-moment-row">
              <button
                type="button"
                className="btn mini ghost rhythm-history-view__log-moment person-prayer-history__log-button"
                onClick={() => {
                  setLogError('');
                  setEditingLog('new');
                  setEditingExpectedUpdatedAt(request.updatedAt);
                  setDeletingLog(null);
                  setDeletingExpectedUpdatedAt(null);
                }}
              >
                + Log a prayer
              </button>
            </div>
          )}
          {request.prayerLogs.length > 0 ? (
            <ol>
              {request.prayerLogs.map(log => {
                const date = formatPrayerLogDate(log, timeZone);
                const time = formatPrayerLogTime(log, timeZone);
                const disabled = log.editable === false || !onSaveLog;
                const restrictionId = `prayer-log-legacy-${request.id}-${log.id}`;
                return (
                  <li className="rhythm-history-view__logged-entry" key={log.id}>
                    <div className="rhythm-history-view__logged-entry-content">
                      <div className="rhythm-history-view__logged-entry-copy">
                        <strong>{request.title}</strong>
                        <p className="rhythm-history-view__logged-entry-date">
                          <span>{date}</span>
                          <span aria-hidden="true"> · </span>
                          <span>{time ?? 'Time not recorded'}</span>
                        </p>
                        {log.notes && <p className="rhythm-history-view__logged-entry-memory">{log.notes}</p>}
                        {log.editable === false && (
                          <p id={restrictionId} className="person-prayer-history__legacy-note">
                            This legacy entry has no safely editable record identity. It will remain unchanged.
                          </p>
                        )}
                      </div>
                      {(onSaveLog || onDeleteLog) && (
                        <div className="rhythm-history-view__logged-entry-actions">
                          {onSaveLog && (
                            <button
                              type="button"
                              className="rhythm-history-view__entry-action person-prayer-history__entry-action"
                              aria-label={`Edit logged prayer for ${request.title}, ${date}`}
                              aria-describedby={log.editable === false ? restrictionId : undefined}
                              disabled={disabled}
                              onClick={() => {
                                setLogError('');
                                setEditingLog(log);
                                setEditingExpectedUpdatedAt(request.updatedAt);
                                setDeletingLog(null);
                                setDeletingExpectedUpdatedAt(null);
                              }}
                            >
                              <RhythmMetadataIcon kind="edit" />
                            </button>
                          )}
                          {onDeleteLog && (
                            <button
                              type="button"
                              className="rhythm-history-view__entry-action person-prayer-history__entry-action"
                              aria-label={`Delete logged prayer for ${request.title}, ${date}`}
                              aria-describedby={log.editable === false ? restrictionId : undefined}
                              disabled={disabled}
                              onClick={() => {
                                setLogError('');
                                setDeletingLog(log);
                                setDeletingExpectedUpdatedAt(request.updatedAt);
                                setEditingLog(null);
                                setEditingExpectedUpdatedAt(null);
                              }}
                            >
                              <RhythmMetadataIcon kind="delete" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {deletingLog?.id === log.id && (
                      <div
                        className="rhythm-history-view__delete-confirmation"
                        role="alertdialog"
                        aria-labelledby={`delete-prayer-log-${request.id}-${log.id}`}
                      >
                        <strong id={`delete-prayer-log-${request.id}-${log.id}`}>
                          Delete this logged prayer from {date}{time ? ` at ${time}` : ''}?
                        </strong>
                        {logError && <p role="alert">{logError}</p>}
                        <div className="rhythm-history-view__delete-actions">
                          <button
                            type="button"
                            className="btn mini ghost"
                            onClick={() => {
                              setDeletingLog(null);
                              setDeletingExpectedUpdatedAt(null);
                              setLogError('');
                            }}
                          >
                            Cancel
                          </button>
                          <button type="button" className="btn mini" onClick={deleteLog}>Delete prayer</button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p>No logged prayers.</p>
          )}
          {undoLog && onUndoDeleteLog && (
            <div className="person-prayer-history__undo" role="status">
              <span>Prayer entry deleted.</span>
              <button type="button" className="btn mini ghost" onClick={undoDelete}>Undo</button>
              {undoError && <p role="alert">{undoError}</p>}
            </div>
          )}
          {editingLog && (
            <PersonPrayerLogForm
              key={editingLog === 'new' ? 'new-prayer-log' : editingLog.id}
              request={request}
              {...(editingLog === 'new' ? {} : { initialLog: editingLog })}
              timeZone={timeZone}
              onSave={saveLog}
              onCancel={() => {
                setEditingLog(null);
                setEditingExpectedUpdatedAt(null);
                setLogError('');
              }}
            />
          )}
          {logError && !deletingLog && <p className="person-prayer-panel__error" role="alert">{logError}</p>}
          {announcement && <p className="visually-hidden" role="status" aria-live="polite">{announcement}</p>}
        </CollapsibleHistorySection>
      </div>
    </MoneyGoalDialog>
  );
}

function healthMetric(
  metric: RhythmScoreResult['consistency'] | RhythmScoreResult['onTrack']
): HealthScoreMetric {
  return metric.kind === 'scored'
    ? { score: metric.score, state: 'scored' }
    : { score: null, state: 'unscored', explanation: metric.explanation };
}

function unavailableHealthMetric(): HealthScoreMetric {
  return {
    score: null,
    state: 'unavailable',
    explanation: 'This prayer request’s Health scoring result is unavailable.'
  };
}
