import { useMemo, useRef, useState } from 'react';
import { selectPersonPrayerHistory } from '../domain/person-prayer-history.ts';
import type {
  PersonPrayerLog,
  PersonPrayerLogUndo,
  PersonPrayerRequest,
  PrayerRequestTransition
} from '../domain/person-prayers.ts';
import type { PersonPrayerHealthSelection } from '../domain/person-prayer-health.ts';
import { formatRhythmActivityDate } from '../domain/preview-data.ts';
import type { PersonPreview } from '../domain/preview-data.ts';
import { AnchoredPopover } from './AnchoredPopover.tsx';
import { PersonBadge } from './PersonBadge.tsx';
import { PersonPrayerHistoryDialog } from './PersonPrayerHistoryDialog.tsx';
import { PersonPrayerCountBadge } from './PersonPrayerCountBadge.tsx';
import { RecordCardFrame } from './RecordCardFrame.tsx';
import { RhythmCalendarIcon, RhythmScheduleSummary } from './RhythmMetadata.tsx';
import { RhythmMetadataIcon } from './RhythmMetadataIcon.tsx';
import { rhythmTimeLabel } from '../domain/rhythm-schedule.ts';
import { useRhythmTimeOptions } from './TimeBlocksContext.tsx';

export function PersonPrayerCard({
  request,
  person,
  owner,
  sharedPeople,
  today,
  timeZone,
  personPrayerHealth,
  statusLabel,
  showOwner = false,
  onPray,
  onTransition,
  onEdit,
  onSaveLog,
  onDeleteLog,
  onUndoDeleteLog,
  undoLog
}: {
  request: PersonPrayerRequest;
  person?: PersonPreview;
  owner?: PersonPreview;
  sharedPeople: readonly PersonPreview[];
  today: string;
  timeZone: string;
  personPrayerHealth?: PersonPrayerHealthSelection;
  statusLabel?: string;
  showOwner?: boolean;
  onPray: (request: PersonPrayerRequest) => void;
  onTransition: (request: PersonPrayerRequest, transition: PrayerRequestTransition) => void;
  onEdit: (
    request: PersonPrayerRequest,
    opener: HTMLButtonElement,
    onReturn?: () => void
  ) => void;
  onSaveLog?: (
    requestId: string,
    expectedUpdatedAt: string,
    actorId: PersonPreview['id'] | null,
    log: PersonPrayerLog
  ) => string | null;
  onDeleteLog?: (
    requestId: string,
    expectedUpdatedAt: string,
    actorId: PersonPreview['id'] | null,
    logId: string
  ) => PersonPrayerLogUndo | string;
  onUndoDeleteLog?: (undo: PersonPrayerLogUndo, actorId: PersonPreview['id'] | null) => string | null;
  undoLog?: PersonPrayerLogUndo | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const actionsRef = useRef<HTMLButtonElement>(null);
  const historyOpenerRef = useRef<HTMLButtonElement>(null);
  const history = useMemo(
    () => selectPersonPrayerHistory(request, today, timeZone),
    [request, today, timeZone]
  );
  const headingId = `person-prayer-title-${request.id}`;
  const menuId = `person-prayer-actions-${request.id}`;
  const timeOptions = useRhythmTimeOptions();
  const lastPrayed = history.lastPrayedDate
    ? formatRhythmActivityDate(history.lastPrayedDate, today)
    : history.totalCount > 0
      ? 'Date not recorded'
      : 'Not yet';

  return (
    <>
      <RecordCardFrame
        className="rhythm-card--simple person-prayer-card"
        headingId={headingId}
      >
        <div className="rhythm-card__simple-content person-prayer-card__content">
          <div className="person-prayer-card__heading">
            <div className="person-prayer-card__heading-main">
              <h3 id={headingId} className="person-prayer-card__title">{request.title}</h3>
              {statusLabel && (
                <span className={`person-prayer-card__status person-prayer-card__status--${request.status}`}>
                  {statusLabel}
                </span>
              )}
              {request.details && <p className="person-prayer-card__details">{request.details}</p>}
            </div>
            <button
              ref={historyOpenerRef}
              type="button"
              className="person-prayer-card__history"
              aria-label={`View prayer history for ${request.title}`}
              title="View prayer history"
              onClick={() => setHistoryOpen(true)}
            >
              <span className="rhythm-card__history-content" aria-hidden="true">
                <RhythmMetadataIcon kind="history" />
              </span>
            </button>
          </div>
          <div className="person-prayer-card__associations">
            {(showOwner || request.personId !== person?.id) && (
              <div
                className="person-prayer-card__association"
                role="group"
                aria-label={request.personId === null ? 'Person association' : 'Request owner'}
              >
                <span>{request.personId === null ? 'Person association' : 'Owned by'}</span>
                {owner
                  ? <PersonBadge person={owner} presentation="static" displayNameMode="full" />
                  : <span>No person</span>}
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
            <button
              type="button"
              className="person-prayer-card__set-frequency"
              onClick={event => onEdit(request, event.currentTarget)}
            >
              Set prayer frequency
            </button>
          )}
          <div className="person-prayer-card__actions">
            <PersonPrayerCountBadge count={history.totalCount} />
            <button
              ref={actionsRef}
              id={`${menuId}-trigger`}
              type="button"
              className="person-prayer-card__actions-trigger rhythm-card__tend"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? menuId : undefined}
              aria-label={`Actions for ${request.title}`}
              onClick={() => setMenuOpen(open => !open)}
            >
              Actions
              <span aria-hidden="true">⌄</span>
            </button>
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
            <span
              className="person-prayer-card__last-prayed"
              aria-label={`Last prayed: ${lastPrayed}`}
            >
              <RhythmCalendarIcon />
              <span>{lastPrayed}</span>
            </span>
          </div>
        </footer>
      </RecordCardFrame>

      {menuOpen && (
        <AnchoredPopover
          anchorRef={actionsRef}
          id={menuId}
          label={`Actions for ${request.title}`}
          role="menu"
          className="person-prayer-menu prayer-theme"
          onClose={() => setMenuOpen(false)}
        >
          {request.status === 'active' ? (
            <>
              <PrayerMenuItem onClick={() => { setMenuOpen(false); onPray(request); }}>Pray</PrayerMenuItem>
              <PrayerMenuItem onClick={() => { setMenuOpen(false); onTransition(request, 'answer'); }}>
                Mark answered
              </PrayerMenuItem>
              <PrayerMenuItem onClick={() => { setMenuOpen(false); onTransition(request, 'archive'); }}>
                Archive
              </PrayerMenuItem>
            </>
          ) : (
            <PrayerMenuItem onClick={() => { setMenuOpen(false); onTransition(request, 'reopen'); }}>
              Reopen
            </PrayerMenuItem>
          )}
        </AnchoredPopover>
      )}

      {historyOpen && (
        <PersonPrayerHistoryDialog
          request={request}
          {...(person ? { person } : {})}
          {...(owner ? { owner } : {})}
          sharedPeople={sharedPeople}
          history={history}
          today={today}
          timeZone={timeZone}
          {...(personPrayerHealth ? { personPrayerHealth } : {})}
          undoLog={undoLog ?? null}
          onEditRequest={() => {
            setHistoryOpen(false);
            if (historyOpenerRef.current) {
              onEdit(request, historyOpenerRef.current, () => setHistoryOpen(true));
            }
          }}
          {...(onSaveLog ? {
            onSaveLog: (log, expectedUpdatedAt) =>
              onSaveLog(request.id, expectedUpdatedAt, person?.id ?? request.personId, log)
          } : {})}
          {...(onDeleteLog ? {
            onDeleteLog: (logId, expectedUpdatedAt) =>
              onDeleteLog(request.id, expectedUpdatedAt, person?.id ?? request.personId, logId)
          } : {})}
          {...(onUndoDeleteLog ? {
            onUndoDeleteLog: undo => onUndoDeleteLog(undo, person?.id ?? request.personId)
          } : {})}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </>
  );
}

function PrayerMenuItem({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" className="person-prayer-menu__item" onClick={onClick}>
      {children}
    </button>
  );
}
