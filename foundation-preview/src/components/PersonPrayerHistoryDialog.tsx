import type { PersonPrayerHistory } from '../domain/person-prayer-history.ts';
import type { PersonPrayerRequest } from '../domain/person-prayers.ts';
import type { PersonPreview } from '../domain/preview-data.ts';
import { DailyCountHistoryChart } from './DailyCountHistoryChart.tsx';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { PersonBadge } from './PersonBadge.tsx';

export function PersonPrayerHistoryDialog({
  request,
  person,
  owner,
  history,
  today,
  onClose
}: {
  request: PersonPrayerRequest;
  person: PersonPreview;
  owner: PersonPreview;
  history: PersonPrayerHistory;
  today: string;
  onClose: () => void;
}) {
  const dialogTitleId = `person-prayer-history-title-${request.id}`;
  const totalLabel = `${history.totalCount} ${history.totalCount === 1 ? 'prayer' : 'prayers'} recorded`;

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
        <div className="person-prayer-history__context" role="group" aria-label="Prayer history context">
          <PersonBadge person={person} presentation="static" displayNameMode="full" />
          {owner.id !== person.id && (
            <span className="person-prayer-history__owner">
              Owned by <PersonBadge person={owner} presentation="static" displayNameMode="full" />
            </span>
          )}
        </div>
        <header className="person-prayer-history__request">
          <h3>{request.title}</h3>
          {request.details && <p>{request.details}</p>}
        </header>
        <p className="person-prayer-history__window">
          <strong>{history.recentCount} {history.recentCount === 1 ? 'time' : 'times'} prayed · last 30 days</strong>
          <span>{totalLabel}</span>
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
        />
      </div>
    </MoneyGoalDialog>
  );
}
