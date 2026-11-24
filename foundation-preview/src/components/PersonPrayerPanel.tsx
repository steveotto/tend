import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  activePrayerRequestCount,
  personPrayerRequestDraft,
  personPrayerRequestsForPerson
} from '../domain/person-prayers.ts';
import type {
  PersonPrayerRequest,
  PersonPrayerRequestDraft,
  PersonPrayerLog,
  PersonPrayerLogUndo,
  PrayerRequestTransition
} from '../domain/person-prayers.ts';
import { personById } from '../domain/preview-data.ts';
import type { PersonId, PersonPickerGroup, PersonPreview } from '../domain/preview-data.ts';
import { PeopleBadgeSelectionPicker } from './PeopleAssociationControls.tsx';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { PersonPrayerCard } from './PersonPrayerCard.tsx';
import { PersonProfileTabHeader } from './PersonProfileTabHeader.tsx';
import { RhythmMetadataIcon } from './RhythmMetadataIcon.tsx';
import { RhythmScheduleFields } from './RhythmScheduleFields.tsx';
import { StyledSelect } from './StyledSelect.tsx';
import { useRhythmTimeOptions, useTimeBlockSettings } from './TimeBlocksContext.tsx';
import { selectPersonPrayerHealth } from '../domain/person-prayer-health.ts';
import type { PersonPrayerHealthSelection } from '../domain/person-prayer-health.ts';

type EditorState = {
  request?: PersonPrayerRequest;
  draft: PersonPrayerRequestDraft;
  error: string;
  onReturn?: () => void;
};

export function PersonPrayerPanel({
  personId,
  enabled = true,
  today,
  prayerHealthInstant = new Date(),
  timeZone: requestedTimeZone,
  people,
  peopleGroups,
  requests,
  targetRequestId,
  onCreate,
  onUpdate,
  onTransition,
  onPray,
  onSaveLog,
  onDeleteLog,
  onUndoDeleteLog,
  onRemove
}: {
  personId: PersonId;
  enabled?: boolean;
  today: string;
  prayerHealthInstant?: Date;
  timeZone?: string;
  people: readonly PersonPreview[];
  peopleGroups: readonly PersonPickerGroup[];
  requests: readonly PersonPrayerRequest[];
  targetRequestId?: string | null;
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
  onSaveLog?: (
    requestId: string,
    expectedUpdatedAt: string,
    actorId: PersonId,
    log: PersonPrayerLog
  ) => string | null;
  onDeleteLog?: (
    requestId: string,
    expectedUpdatedAt: string,
    actorId: PersonId,
    logId: string
  ) => PersonPrayerLogUndo | string;
  onUndoDeleteLog?: (undo: PersonPrayerLogUndo, actorId: PersonId) => string | null;
  onRemove: (requestId: string, expectedUpdatedAt: string, actorId: PersonId) => string | null;
}) {
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<PersonPrayerRequest | null>(null);
  const [actionError, setActionError] = useState('');
  const [deletedLogUndo, setDeletedLogUndo] = useState<PersonPrayerLogUndo | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const returnTarget = useRef<HTMLButtonElement | null>(null);
  const pickerOpener = useRef<HTMLButtonElement | null>(null);
  const dialogWasOpen = useRef(false);
  const pickerWasOpen = useRef(false);
  const personRequests = personPrayerRequestsForPerson(requests, personId);
  const activeCount = activePrayerRequestCount(requests, personId);
  const person = personById(people, personId);
  const timeOptions = useRhythmTimeOptions();
  const timeBlockSettings = useTimeBlockSettings();
  const timeZone = requestedTimeZone
    ?? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const personPrayerHealth: PersonPrayerHealthSelection = selectPersonPrayerHealth(
    requests,
    personId,
    today,
    timeZone,
    prayerHealthInstant,
    timeBlockSettings
  );
  const groups = [
    { status: 'active' as const, label: 'Active' },
    { status: 'answered' as const, label: 'Answered' },
    { status: 'archived' as const, label: 'Archived' }
  ];

  useEffect(() => {
    if (!enabled || !targetRequestId) return;
    const target = document.getElementById(`person-prayer-request-${targetRequestId}`);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView?.({ block: 'center' });
  }, [enabled, targetRequestId, personId, requests]);

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

  function openEditor(
    opener: HTMLButtonElement,
    request?: PersonPrayerRequest,
    onReturn?: () => void
  ) {
    returnTarget.current = opener;
    setActionError('');
    setPickerOpen(false);
    setEditor({
      ...(request ? { request } : {}),
      ...(onReturn ? { onReturn } : {}),
      draft: personPrayerRequestDraft(request),
      error: ''
    });
  }

  function updateDraft(patch: Partial<PersonPrayerRequestDraft>) {
    setEditor(current => current ? { ...current, draft: { ...current.draft, ...patch }, error: '' } : current);
  }

  function saveEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled || !editor) return;
    const result = editor.request
      ? onUpdate(editor.request.id, editor.request.updatedAt, personId, editor.draft)
      : onCreate(personId, editor.draft);
    if (result) {
      setEditor(current => current ? { ...current, error: result } : current);
      return;
    }
    editor.onReturn?.();
    setEditor(null);
  }

  function closeEditor() {
    const onReturn = editor?.onReturn;
    setEditor(null);
    onReturn?.();
  }

  function changeStatus(request: PersonPrayerRequest, transition: PrayerRequestTransition) {
    if (!enabled) return;
    setActionError(onTransition(request.id, request.updatedAt, personId, transition) ?? '');
  }

  function pray(request: PersonPrayerRequest) {
    if (!enabled) return;
    setActionError(onPray(request.id, request.updatedAt, personId) ?? '');
  }

  function deleteLog(
    requestId: string,
    expectedUpdatedAt: string,
    actorId: PersonId,
    logId: string
  ): PersonPrayerLogUndo | string {
    if (!enabled) return 'Prayer logging is unavailable.';
    if (!onDeleteLog) return 'Prayer log deletion is unavailable.';
    const result = onDeleteLog(requestId, expectedUpdatedAt, actorId, logId);
    if (typeof result === 'string') return result;
    setDeletedLogUndo(result);
    return result;
  }

  function undoDeleteLog(undo: PersonPrayerLogUndo, actorId: PersonId): string | null {
    if (!enabled) return 'Prayer logging is unavailable.';
    if (!onUndoDeleteLog) return 'Prayer log Undo is unavailable.';
    const error = onUndoDeleteLog(undo, actorId);
    if (!error) setDeletedLogUndo(null);
    return error;
  }

  function removeRequest() {
    if (!enabled || !confirmRequest) return;
    const error = onRemove(confirmRequest.id, confirmRequest.updatedAt, personId);
    if (error) {
      setActionError(error);
      return;
    }
    setConfirmRequest(null);
    setEditor(null);
    setActionError('');
  }

  const editorTitleId = `person-prayer-editor-title-${personId}`;
  const confirmTitleId = `person-prayer-delete-title-${personId}`;

  return (
    <section className="person-prayer-panel prayer-theme" aria-labelledby={`person-prayer-heading-${personId}`} hidden={!enabled}>
      <PersonProfileTabHeader
        headingId={`person-prayer-heading-${personId}`}
        title="Prayer"
        subtitle={`${activeCount} active ${activeCount === 1 ? 'request' : 'requests'}`}
        actionLabel="Add request"
        actionRef={addButtonRef}
        theme="prayer"
        onAction={event => openEditor(event.currentTarget)}
      />
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
                const owner = personById(people, request.personId);
                const sharedPeople = (request.sharedWith ?? []).map(id => personById(people, id));
                return (
                  <li
                    id={`person-prayer-request-${request.id}`}
                    className="person-prayer-list__item"
                    key={request.id}
                    tabIndex={targetRequestId === request.id ? -1 : undefined}
                    aria-current={targetRequestId === request.id ? 'true' : undefined}
                  >
                    <PersonPrayerCard
                      request={request}
                      person={person}
                      owner={owner}
                      sharedPeople={sharedPeople}
                      today={today}
                      timeZone={timeZone}
                      personPrayerHealth={personPrayerHealth}
                      onPray={pray}
                      onTransition={changeStatus}
                      onEdit={(selectedRequest, opener, onReturn) =>
                        openEditor(opener, selectedRequest, onReturn)}
                      {...(onSaveLog ? { onSaveLog } : {})}
                      {...(onDeleteLog ? { onDeleteLog: deleteLog } : {})}
                      {...(onUndoDeleteLog ? { onUndoDeleteLog: undoDeleteLog } : {})}
                      undoLog={deletedLogUndo?.requestId === request.id ? deletedLogUndo : null}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        );
        })}
        </>
      )}

      {enabled && editor && pickerOpen ? (
        <MoneyGoalDialog
          title="Choose people to share this request with"
          titleId={editorTitleId}
          labelledBy={editorTitleId}
          dialogClassName="person-prayer-dialog person-prayer-dialog--picker prayer-theme"
          closeLabel="Close people picker"
          phoneFullScreen
          scrollableBody
          stopEscapePropagation
          closeOnEscape
          onClose={() => setPickerOpen(false)}
        >
          <PeopleBadgeSelectionPicker
            people={people}
            groups={peopleGroups}
            theme="prayer"
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
      ) : enabled && editor ? (
        <MoneyGoalDialog
          title={editor.request ? 'Prayer request details' : 'Add prayer request'}
          titleId={editorTitleId}
          labelledBy={editorTitleId}
          dialogClassName="person-prayer-dialog prayer-theme"
          initialFocusId={`person-prayer-title-${personId}`}
          closeLabel="Close prayer request details"
          phoneFullScreen
          scrollableBody
          stopEscapePropagation
          closeOnEscape
          onClose={closeEditor}
        >
          <form className="person-prayer-form" onSubmit={saveEditor}>
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
            <RhythmScheduleFields
              schedule={editor.draft.schedule}
              onChange={schedule => updateDraft({ schedule })}
              {...(editor.request && !editor.request.schedule
                ? { frequencyGuidance: 'Set prayer frequency to include this request in Prayer Health.' }
                : {})}
            >
              <div className="goal-field rhythm-schedule-fields__time">
                <label>Time of day</label>
                <StyledSelect
                  label="Time of day"
                  options={timeOptions}
                  value={editor.draft.timeOfDay ?? 'anytime'}
                  onChange={timeOfDay => updateDraft({ timeOfDay })}
                />
              </div>
            </RhythmScheduleFields>
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
              <button type="button" className="btn mini ghost" onClick={closeEditor}>Cancel</button>
              <button type="submit" className="btn mini">{editor.request ? 'Save changes' : 'Save request'}</button>
            </div>
            {editor.request && (
              <div className="person-prayer-form__delete">
                <button
                  type="button"
                  className="person-prayer-form__delete-button"
                  aria-label={editor.request.personId === personId
                    ? `Delete ${editor.request.title}`
                    : `Remove ${editor.request.title} from this profile`}
                  onClick={() => {
                    setActionError('');
                    setConfirmRequest(editor.request ?? null);
                  }}
                >
                  <RhythmMetadataIcon kind="delete" />
                  {editor.request.personId === personId ? 'Delete request' : 'Remove from this profile'}
                </button>
              </div>
            )}
          </form>
        </MoneyGoalDialog>
      ) : null}
      {enabled && confirmRequest && (
        <MoneyGoalDialog
          title={confirmRequest.personId === personId
            ? 'Delete this request?'
            : 'Remove this request from this profile?'}
          titleId={confirmTitleId}
          labelledBy={confirmTitleId}
          dialogClassName="person-prayer-dialog prayer-theme"
          initialFocusId={`person-prayer-cancel-delete-${personId}`}
          closeLabel="Close delete confirmation"
          phoneFullScreen
          scrollableBody
          stopEscapePropagation
          closeOnEscape
          onClose={() => setConfirmRequest(null)}
        >
          <div className="person-prayer-confirm">
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
