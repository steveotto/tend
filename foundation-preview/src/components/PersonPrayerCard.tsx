import { useMemo, useRef, useState } from 'react';
import { selectPersonPrayerHistory } from '../domain/person-prayer-history.ts';
import type { PersonPrayerRequest, PrayerRequestTransition } from '../domain/person-prayers.ts';
import type { PersonPreview } from '../domain/preview-data.ts';
import { AnchoredPopover } from './AnchoredPopover.tsx';
import { PersonBadge } from './PersonBadge.tsx';
import { PersonPrayerHistoryDialog } from './PersonPrayerHistoryDialog.tsx';
import { RecordCardFrame } from './RecordCardFrame.tsx';
import { RhythmMetadataIcon } from './RhythmMetadataIcon.tsx';

export function PersonPrayerCard({
  request,
  person,
  owner,
  sharedPeople,
  today,
  timeZone,
  onPray,
  onTransition,
  onEdit
}: {
  request: PersonPrayerRequest;
  person: PersonPreview;
  owner: PersonPreview;
  sharedPeople: readonly PersonPreview[];
  today: string;
  timeZone: string;
  onPray: (request: PersonPrayerRequest) => void;
  onTransition: (request: PersonPrayerRequest, transition: PrayerRequestTransition) => void;
  onEdit: (request: PersonPrayerRequest, opener: HTMLButtonElement) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const actionsRef = useRef<HTMLButtonElement>(null);
  const history = useMemo(
    () => selectPersonPrayerHistory(request, today, timeZone),
    [request, today, timeZone]
  );
  const headingId = `person-prayer-title-${request.id}`;
  const menuId = `person-prayer-actions-${request.id}`;
  const lastPrayed = history.lastPrayedAt
    ? formatPrayerDate(history.lastPrayedAt)
    : history.undatedCount > 0
      ? 'Date not recorded'
      : 'Not prayed yet';

  function editRequest() {
    setMenuOpen(false);
    if (actionsRef.current) onEdit(request, actionsRef.current);
  }

  return (
    <>
      <RecordCardFrame
        className="rhythm-card--simple person-prayer-card"
        headingId={headingId}
      >
        <div className="rhythm-card__simple-content person-prayer-card__content">
          <h3 id={headingId} className="person-prayer-card__title">{request.title}</h3>
          {request.details && <p className="person-prayer-card__details">{request.details}</p>}
          <div className="person-prayer-card__associations">
            {request.personId !== person.id && (
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
          <div className="person-prayer-card__history-row">
            <button
              type="button"
              className="person-prayer-card__history"
              aria-label={`Prayer history for ${request.title}: ${history.totalCount} ${
                history.totalCount === 1 ? 'prayer' : 'prayers'
              } recorded`}
              onClick={() => setHistoryOpen(true)}
            >
              <RhythmMetadataIcon kind="history" />
              <span>Prayer history</span>
              <strong>{history.totalCount}</strong>
            </button>
          </div>
        </div>
        <div className="rhythm-card__actions person-prayer-card__actions">
          <button
            ref={actionsRef}
            id={`${menuId}-trigger`}
            type="button"
            className="person-prayer-card__actions-trigger"
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
        <footer className="rhythm-card__meta person-prayer-card__footer">
          <span className="person-prayer-card__last-prayed">Last prayed · {lastPrayed}</span>
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
          <PrayerMenuItem onClick={editRequest}>Details/Edit</PrayerMenuItem>
        </AnchoredPopover>
      )}

      {historyOpen && (
        <PersonPrayerHistoryDialog
          request={request}
          person={person}
          owner={owner}
          history={history}
          today={today}
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

function formatPrayerDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    .format(new Date(value));
}
