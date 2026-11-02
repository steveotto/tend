import { useEffect, useRef, useState } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import {
  activePrayerRequestCount,
  personPrayerRequestDraft,
  personPrayerRequestsForPerson,
  prayerRequestHistorySummary
} from '../domain/person-prayers.ts';
import type {
  PersonPrayerRequest,
  PersonPrayerRequestDraft,
  PrayerRequestTransition
} from '../domain/person-prayers.ts';
import { personById } from '../domain/preview-data.ts';
import type { PersonId, PersonPickerGroup, PersonPreview } from '../domain/preview-data.ts';
import { PeopleBadgeSelectionPicker } from './PeopleAssociationControls.tsx';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';

type EditorState = {
  request?: PersonPrayerRequest;
  draft: PersonPrayerRequestDraft;
  error: string;
};

export function PersonPrayerPanel({
  personId,
  people,
  peopleGroups,
  requests,
  onCreate,
  onUpdate,
  onTransition,
  onPray,
  onRemove
}: {
  personId: PersonId;
  people: readonly PersonPreview[];
  peopleGroups: readonly PersonPickerGroup[];
  requests: readonly PersonPrayerRequest[];
  onCreate: (personId: PersonId, draft: PersonPrayerRequestDraft) => string | null;
  onUpdate: (
    requestId: string,
    expectedUpdatedAt: string,
    actorId: PersonId,
    draft: PersonPrayerRequestDraft
  ) => string | null;
  onTransition: (
    requestId: string,
    expectedUpdatedAt: string,
    actorId: PersonId,
    transition: PrayerRequestTransition
  ) => string | null;
  onPray: (requestId: string, expectedUpdatedAt: string, actorId: PersonId) => string | null;
  onRemove: (requestId: string, expectedUpdatedAt: string, actorId: PersonId) => string | null;
}) {
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<PersonPrayerRequest | null>(null);
  const [actionError, setActionError] = useState('');
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const returnTarget = useRef<HTMLButtonElement | null>(null);
  const pickerOpener = useRef<HTMLButtonElement | null>(null);
  const dialogWasOpen = useRef(false);
  const pickerWasOpen = useRef(false);
  const personRequests = personPrayerRequestsForPerson(requests, personId);
  const activeCount = activePrayerRequestCount(requests, personId);
  const ownerName = (request: PersonPrayerRequest) => personById(people, request.personId).displayName;
  const groups = [
    { status: 'active' as const, label: 'Active' },
    { status: 'answered' as const, label: 'Answered' },
    { status: 'archived' as const, label: 'Archived' }
  ];

  useEffect(() => {
    const isOpen = editor !== null || confirmRequest !== null;
    if (isOpen) {
      dialogWasOpen.current = true;
      return;
    }
    if (dialogWasOpen.current) {
      dialogWasOpen.current = false;
      if (returnTarget.current?.isConnected) returnTarget.current.focus({ preventScroll: true });
      else addButtonRef.current?.focus({ preventScroll: true });
    }
  }, [editor, confirmRequest]);

  useEffect(() => {
    if (pickerOpen) {
      pickerWasOpen.current = true;
      return;
    }
    if (pickerWasOpen.current) {
      pickerWasOpen.current = false;
      pickerOpener.current?.focus({ preventScroll: true });
    }
  }, [pickerOpen]);

  function openEditor(event: MouseEvent<HTMLButtonElement>, request?: PersonPrayerRequest) {
    returnTarget.current = event.currentTarget;
    setActionError('');
    setPickerOpen(false);
    setEditor({ ...(request ? { request } : {}), draft: personPrayerRequestDraft(request), error: '' });
  }

  function updateDraft(patch: Partial<PersonPrayerRequestDraft>) {
    setEditor(current => current ? { ...current, draft: { ...current.draft, ...patch }, error: '' } : current);
  }

  function saveEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    const result = editor.request
      ? onUpdate(editor.request.id, editor.request.updatedAt, personId, editor.draft)
      : onCreate(personId, editor.draft);
    if (result) {
      setEditor(current => current ? { ...current, error: result } : current);
      return;
    }
    setEditor(null);
  }

  function changeStatus(request: PersonPrayerRequest, transition: PrayerRequestTransition) {
    setActionError(onTransition(request.id, request.updatedAt, personId, transition) ?? '');
  }

  function pray(request: PersonPrayerRequest) {
    setActionError(onPray(request.id, request.updatedAt, personId) ?? '');
  }

  function removeRequest() {
    if (!confirmRequest) return;
    const error = onRemove(confirmRequest.id, confirmRequest.updatedAt, personId);
    if (error) {
      setActionError(error);
      return;
    }
    setConfirmRequest(null);
    setActionError('');
  }

  const editorTitleId = `person-prayer-editor-title-${personId}`;
  const confirmTitleId = `person-prayer-delete-title-${personId}`;

  return (
    <section className="person-prayer-panel" aria-labelledby={`person-prayer-heading-${personId}`}>
      <header className="person-profile__section-heading">
        <div>
          <h3 id={`person-prayer-heading-${personId}`}>Prayer</h3>
          <p>{activeCount} active {activeCount === 1 ? 'request' : 'requests'}</p>
        </div>
        <button ref={addButtonRef} type="button" className="btn mini" onClick={event => openEditor(event)}>
          Add prayer request
        </button>
      </header>
      {actionError && <p className="person-prayer-panel__error" role="alert">{actionError}</p>}
      {personRequests.length === 0 ? (
        <p className="friendships-empty">No prayer requests for {personById(people, personId).displayName} yet.</p>
      ) : (
        <>
        {activeCount === 0 && <p className="friendships-empty">No active prayer requests.</p>}
        {groups.map(group => {
        const groupRequests = personRequests.filter(request => request.status === group.status);
        if (groupRequests.length === 0) return null;
        return (
          <section
            key={group.status}
            className="person-prayer-panel__group"
            aria-labelledby={`person-prayer-${group.status}-${personId}`}
          >
            <h4 id={`person-prayer-${group.status}-${personId}`}>{group.label} ({groupRequests.length})</h4>
            <ul className="person-prayer-list">
              {groupRequests.map(request => {
                const isOwner = request.personId === personId;
                const shareNames = (request.sharedWith ?? []).map(id => personById(people, id).displayName);
                const prayerHistory = prayerRequestHistorySummary(request);
                return (
                  <li className="person-prayer-card" key={request.id}>
                    <div className="person-prayer-card__content">
                      <h5>{request.title}</h5>
                      {request.details && <p className="person-prayer-card__details">{request.details}</p>}
                      {!isOwner && <p className="person-prayer-card__meta">Owned by {ownerName(request)}</p>}
                      {shareNames.length > 0 && (
                        <p className="person-prayer-card__meta">Shared with {shareNames.join(', ')}</p>
                      )}
                      <p className="person-prayer-card__meta">
                        Prayed {prayerHistory.count} {prayerHistory.count === 1 ? 'time' : 'times'}
                        {prayerHistory.lastPrayedAt && ` · Last prayed ${formatPrayerDate(prayerHistory.lastPrayedAt)}`}
                      </p>
                    </div>
                    <div className="person-prayer-card__actions" aria-label={`Actions for ${request.title}`}>
                      {request.status === 'active' && (
                        <>
                          <button type="button" className="btn mini" onClick={() => pray(request)}>Prayed</button>
                          <button type="button" className="btn mini ghost" onClick={() => changeStatus(request, 'answer')}>Answer</button>
                          <button type="button" className="btn mini ghost" onClick={() => changeStatus(request, 'archive')}>Archive</button>
                        </>
                      )}
                      {request.status !== 'active' && (
                        <button type="button" className="btn mini ghost" onClick={() => changeStatus(request, 'reopen')}>Reopen</button>
                      )}
                      <button
                        type="button"
                        className="btn mini ghost"
                        aria-label={`Edit ${request.title}`}
                        onClick={event => openEditor(event, request)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn mini ghost"
                        aria-label={isOwner ? `Delete ${request.title}` : `Remove ${request.title} from this profile`}
                        onClick={event => {
                          returnTarget.current = event.currentTarget;
                          setActionError('');
                          setConfirmRequest(request);
                        }}
                      >
                        {isOwner ? 'Delete' : 'Remove'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
        })}
        </>
      )}

      {editor && pickerOpen ? (
        <MoneyGoalDialog
          titleId={editorTitleId}
          labelledBy={editorTitleId}
          dialogClassName="person-prayer-dialog person-prayer-dialog--picker"
          stopEscapePropagation
          closeOnEscape
          onClose={() => setPickerOpen(false)}
        >
          <h2 id={editorTitleId}>Choose people to share this request with</h2>
          <PeopleBadgeSelectionPicker
            people={people}
            groups={peopleGroups}
            selectedIds={editor.draft.sharedWith}
            excludedIds={[editor.request?.personId ?? personId]}
            onToggle={id => updateDraft({
              sharedWith: editor.draft.sharedWith.includes(id)
                ? editor.draft.sharedWith.filter(item => item !== id)
                : [...editor.draft.sharedWith, id]
            })}
            onToggleGroup={ids => {
              const eligibleIds = ids.filter(id => id !== (editor.request?.personId ?? personId));
              const allSelected = eligibleIds.length > 0
                && eligibleIds.every(id => editor.draft.sharedWith.includes(id));
              updateDraft({
                sharedWith: allSelected
                  ? editor.draft.sharedWith.filter(id => !eligibleIds.includes(id))
                  : [...editor.draft.sharedWith, ...eligibleIds.filter(id => !editor.draft.sharedWith.includes(id))]
              });
            }}
            onDone={() => setPickerOpen(false)}
            onCancel={() => setPickerOpen(false)}
          />
        </MoneyGoalDialog>
      ) : editor ? (
        <MoneyGoalDialog
          titleId={editorTitleId}
          labelledBy={editorTitleId}
          dialogClassName="person-prayer-dialog"
          initialFocusId={`person-prayer-title-${personId}`}
          stopEscapePropagation
          closeOnEscape
          onClose={() => setEditor(null)}
        >
          <form className="person-prayer-form" onSubmit={saveEditor}>
            <h2 id={editorTitleId}>{editor.request ? 'Edit prayer request' : 'Add prayer request'}</h2>
            <label>
              Title
              <input
                id={`person-prayer-title-${personId}`}
                value={editor.draft.title}
                maxLength={160}
                required
                onChange={event => updateDraft({ title: event.currentTarget.value })}
              />
            </label>
            <label>
              Details (optional)
              <textarea
                value={editor.draft.details}
                maxLength={4_000}
                rows={4}
                onChange={event => updateDraft({ details: event.currentTarget.value })}
              />
            </label>
            <div className="person-prayer-form__sharing">
              <span>Shared with</span>
              <span>{editor.draft.sharedWith.length} {editor.draft.sharedWith.length === 1 ? 'person' : 'people'}</span>
              <button
                ref={pickerOpener}
                type="button"
                className="btn mini ghost"
                onClick={() => setPickerOpen(true)}
              >
                Choose people
              </button>
            </div>
            {editor.error && <p className="person-prayer-panel__error" role="alert">{editor.error}</p>}
            <div className="person-prayer-form__actions">
              <button type="button" className="btn mini ghost" onClick={() => setEditor(null)}>Cancel</button>
              <button type="submit" className="btn mini">{editor.request ? 'Save changes' : 'Save request'}</button>
            </div>
          </form>
        </MoneyGoalDialog>
      ) : null}
      {confirmRequest && (
        <MoneyGoalDialog
          titleId={confirmTitleId}
          labelledBy={confirmTitleId}
          dialogClassName="person-prayer-dialog"
          initialFocusId={`person-prayer-cancel-delete-${personId}`}
          stopEscapePropagation
          closeOnEscape
          onClose={() => setConfirmRequest(null)}
        >
          <div className="person-prayer-confirm">
            <h2 id={confirmTitleId}>{confirmRequest.personId === personId ? 'Delete this request?' : 'Remove this request from this profile?'}</h2>
            <p>
              {confirmRequest.personId === personId
                ? 'This permanently deletes the request and its prayer history from every linked profile.'
                : 'The primary owner and other linked profiles will keep the request and its prayer history.'}
            </p>
            {actionError && <p className="person-prayer-panel__error" role="alert">{actionError}</p>}
            <div className="person-prayer-form__actions">
              <button
                id={`person-prayer-cancel-delete-${personId}`}
                type="button"
                className="btn mini ghost"
                onClick={() => {
                  setConfirmRequest(null);
                  setActionError('');
                }}
              >
                Cancel
              </button>
              <button type="button" className="btn mini" onClick={removeRequest}>
                {confirmRequest.personId === personId ? 'Delete request' : 'Remove from profile'}
              </button>
            </div>
          </div>
        </MoneyGoalDialog>
      )}
    </section>
  );
}

function formatPrayerDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    .format(new Date(value));
}
