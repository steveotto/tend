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
  onRetryLocalSave,
  onUpdate,
  onTransition,
  onPray,
  onSaveLog,
  onDeleteLog,
  onUndoDeleteLog,
  onRemove,
  allItems = false,
  allItemsEntry = false,
  allPrayerRequests
}: {
  personId: PersonId | null;
  enabled?: boolean;
  today: string;
  prayerHealthInstant?: Date;
  timeZone?: string;
  people: readonly PersonPreview[];
  peopleGroups: readonly PersonPickerGroup[];
  requests: readonly PersonPrayerRequest[];
  targetRequestId?: string | null;
  onCreate: (personId: PersonId, draft: PersonPrayerRequestDraft) => string | null;
  onRetryLocalSave?: () => Promise<string | null>;
  onUpdate: (
    requestId: string,
    expectedUpdatedAt: string,
    actorId: PersonId | null,
    draft: PersonPrayerRequestDraft
  ) => string | null;
  onTransition: (
    requestId: string,
    expectedUpdatedAt: string,
    actorId: PersonId | null,
    transition: PrayerRequestTransition
  ) => string | null;
  onPray: (requestId: string, expectedUpdatedAt: string, actorId: PersonId | null) => string | null;
  onSaveLog?: (
    requestId: string,
    expectedUpdatedAt: string,
    actorId: PersonId | null,
    log: PersonPrayerLog
  ) => string | null;
  onDeleteLog?: (
    requestId: string,
    expectedUpdatedAt: string,
    actorId: PersonId | null,
    logId: string
  ) => PersonPrayerLogUndo | string;
  onUndoDeleteLog?: (undo: PersonPrayerLogUndo, actorId: PersonId | null) => string | null;
  onRemove: (requestId: string, expectedUpdatedAt: string, actorId: PersonId | null) => string | null;
  allItems?: boolean;
  allItemsEntry?: boolean;
  allPrayerRequests?: readonly PersonPrayerRequest[];
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
  const personRequests = allItems
    ? requests
    : personId ? personPrayerRequestsForPerson(requests, personId) : [];
  const activeCount = personId ? activePrayerRequestCount(requests, personId) : 0;
  const person = personId ? personById(people, personId) : undefined;
  const panelIdentity = personId ?? 'all-items';
  const timeOptions = useRhythmTimeOptions();
  const editorTimeOptions = editor?.request && editor.draft.timeOfDay === undefined
    ? [{ value: 'not-set', label: 'Not set' } as const, ...timeOptions]
    : timeOptions;
  const timeBlockSettings = useTimeBlockSettings();
  const timeZone = requestedTimeZone
    ?? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const actionsEnabled = enabled || allItems;
  const personPrayerHealth: PersonPrayerHealthSelection | undefined = personId
    ? selectPersonPrayerHealth(
        allPrayerRequests ?? requests,
        personId,
        today,
        timeZone,
        prayerHealthInstant,
        timeBlockSettings
      )
    : undefined;
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
    if (!actionsEnabled || !editor) return;
    let result: string | null;
    if (editor.request) {
      result = onUpdate(
          editor.request.id,
          editor.request.updatedAt,
          allItems ? editor.request.personId : personId,
          editor.draft
        );
    } else {
      if (personId === null) return;
      result = onCreate(personId, editor.draft);
    }
    if (result) {
      setEditor(current => current ? { ...current, error: result } : current);
      return;
    }
    editor.onReturn?.();
    setEditor(null);
  }

  async function retrySafeSave() {
    if (!onRetryLocalSave) return;
    const retryError = await onRetryLocalSave();
    setEditor(current => current ? {
      ...current,
      error: retryError ?? 'The saved document is now safe. Save again to apply this prayer request.'
    } : current);
  }

  function closeEditor() {
    const onReturn = editor?.onReturn;
    setEditor(null);
    onReturn?.();
  }

  function changeStatus(request: PersonPrayerRequest, transition: PrayerRequestTransition) {
    if (!actionsEnabled) return;
    setActionError(onTransition(
      request.id,
      request.updatedAt,
      allItems ? request.personId : personId,
      transition
    ) ?? '');
  }

  function pray(request: PersonPrayerRequest) {
    if (!actionsEnabled) return;
    setActionError(onPray(request.id, request.updatedAt, allItems ? request.personId : personId) ?? '');
  }

  function deleteLog(
    requestId: string,
    expectedUpdatedAt: string,
    actorId: PersonId | null,
    logId: string
  ): PersonPrayerLogUndo | string {
    if (!actionsEnabled) return 'Prayer logging is unavailable.';
    if (!onDeleteLog) return 'Prayer log deletion is unavailable.';
    const result = onDeleteLog(requestId, expectedUpdatedAt, actorId, logId);
    if (typeof result === 'string') return result;
    setDeletedLogUndo(result);
    return result;
  }

  function undoDeleteLog(undo: PersonPrayerLogUndo, actorId: PersonId | null): string | null {
    if (!actionsEnabled) return 'Prayer logging is unavailable.';
    if (!onUndoDeleteLog) return 'Prayer log Undo is unavailable.';
    const error = onUndoDeleteLog(undo, actorId);
    if (!error) setDeletedLogUndo(null);
    return error;
  }

  function removeRequest() {
    if (!actionsEnabled || !confirmRequest) return;
    const error = onRemove(
      confirmRequest.id,
      confirmRequest.updatedAt,
      allItems ? confirmRequest.personId : personId
    );
    if (error) {
      setActionError(error);
      return;
    }
    setConfirmRequest(null);
    setEditor(null);
    setActionError('');
  }

  const editorTitleId = `person-prayer-editor-title-${panelIdentity}`;
  const confirmTitleId = `person-prayer-delete-title-${panelIdentity}`;
  const statusLabels = {
    active: 'Active',
    answered: 'Answered',
    archived: 'Archived'
  } as const;

  function renderRequestCard(request: PersonPrayerRequest) {
    const owner = request.personId === null ? undefined : personById(people, request.personId);
    const displayPerson = allItems ? owner : person;
    const sharedPeople = (request.sharedWith ?? []).map(id => personById(people, id));
    const requestHealth = allItems && owner
      ? selectPersonPrayerHealth(
          allPrayerRequests ?? requests,
          owner.id,
          today,
          timeZone,
          prayerHealthInstant,
          timeBlockSettings
        )
      : allItems ? undefined : personPrayerHealth;
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
          {...(displayPerson ? { person: displayPerson } : {})}
          {...(owner ? { owner } : {})}
          sharedPeople={sharedPeople}
          today={today}
          timeZone={timeZone}
          {...(requestHealth ? { personPrayerHealth: requestHealth } : {})}
          {...(allItems ? {
            statusLabel: statusLabels[request.status],
            showOwner: true
          } : {})}
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
  }

  return (
    <section
      className={`person-prayer-panel prayer-theme${allItems ? ' person-prayer-panel--all-items' : ''}${allItemsEntry ? ' person-prayer-panel--all-items-entry' : ''}`}
      {...(allItems
        ? allItemsEntry ? {} : { 'aria-label': 'Prayer requests' }
        : { 'aria-labelledby': `person-prayer-heading-${panelIdentity}` })}
      hidden={!enabled && !allItems}
    >
      {!allItems && (
        <PersonProfileTabHeader
          headingId={`person-prayer-heading-${panelIdentity}`}
          title="Prayer"
          subtitle={`${activeCount} active ${activeCount === 1 ? 'request' : 'requests'}`}
          actionLabel="Add request"
          actionRef={addButtonRef}
          theme="prayer"
          onAction={event => openEditor(event.currentTarget)}
        />
      )}
      {actionError && <p className="person-prayer-panel__error" role="alert">{actionError}</p>}
      {personRequests.length === 0 ? (
        <p className="friendships-empty">
          {allItems ? 'No prayer requests match these filters.' : `No prayer requests for ${person?.displayName ?? 'this person'} yet.`}
        </p>
      ) : (
        <>
        {allItems ? (
          <ul className="person-prayer-list">{personRequests.map(renderRequestCard)}</ul>
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
                  <ul className="person-prayer-list">{groupRequests.map(renderRequestCard)}</ul>
                </section>
              );
            })}
          </>
        )}
        </>
      )}

      {actionsEnabled && editor && pickerOpen ? (
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
            excludedIds={editor.request
              ? editor.request.personId === null ? [] : [editor.request.personId]
              : personId === null ? [] : [personId]}
            onToggle={id => updateDraft({
              sharedWith: editor.draft.sharedWith.includes(id)
                ? editor.draft.sharedWith.filter(item => item !== id)
                : [...editor.draft.sharedWith, id]
            })}
            onToggleGroup={ids => {
              const excludedIds = editor.request
                ? editor.request.personId === null ? [] : [editor.request.personId]
                : personId === null ? [] : [personId];
              const eligibleIds = ids.filter(id => !excludedIds.includes(id));
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
      ) : actionsEnabled && editor ? (
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
                id={`person-prayer-title-${panelIdentity}`}
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
                  options={editorTimeOptions}
                  value={editor.draft.timeOfDay ?? (editor.request ? 'not-set' : 'anytime')}
                  onChange={timeOfDay => updateDraft({
                    timeOfDay: timeOfDay === 'not-set' ? undefined : timeOfDay
                  })}
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
            {editor.error.includes('immutable-recovery-copy-failed at schemaVersion')
              && onRetryLocalSave && (
                <button
                  type="button"
                  className="btn mini ghost"
                  onClick={() => void retrySafeSave()}
                >
                  Try safe save again
                </button>
              )}
            <div className="person-prayer-form__actions">
              <button type="button" className="btn mini ghost" onClick={closeEditor}>Cancel</button>
              <button type="submit" className="btn mini">{editor.request ? 'Save changes' : 'Save request'}</button>
            </div>
            {editor.request && (
              <div className="person-prayer-form__delete">
                <button
                  type="button"
                  className="person-prayer-form__delete-button"
                  aria-label={allItems || editor.request.personId === personId
                    ? `Delete ${editor.request.title}`
                    : `Remove ${editor.request.title} from this profile`}
                  onClick={() => {
                    setActionError('');
                    setConfirmRequest(editor.request ?? null);
                  }}
                >
                  <RhythmMetadataIcon kind="delete" />
                  {allItems || editor.request.personId === personId ? 'Delete request' : 'Remove from this profile'}
                </button>
              </div>
            )}
          </form>
        </MoneyGoalDialog>
      ) : null}
      {enabled && confirmRequest && (
        <MoneyGoalDialog
          title={allItems || confirmRequest.personId === personId
            ? 'Delete this request?'
            : 'Remove this request from this profile?'}
          titleId={confirmTitleId}
          labelledBy={confirmTitleId}
          dialogClassName="person-prayer-dialog prayer-theme"
          initialFocusId={`person-prayer-cancel-delete-${panelIdentity}`}
          closeLabel="Close delete confirmation"
          phoneFullScreen
          scrollableBody
          stopEscapePropagation
          closeOnEscape
          onClose={() => setConfirmRequest(null)}
        >
          <div className="person-prayer-confirm">
            <p>
              {allItems || confirmRequest.personId === personId
                ? 'This permanently deletes the request and its prayer history from every linked profile.'
                : 'The primary owner and other linked profiles will keep the request and its prayer history.'}
            </p>
            {actionError && <p className="person-prayer-panel__error" role="alert">{actionError}</p>}
            <div className="person-prayer-form__actions">
              <button
                id={`person-prayer-cancel-delete-${panelIdentity}`}
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
                {allItems || confirmRequest.personId === personId ? 'Delete request' : 'Remove from profile'}
              </button>
            </div>
          </div>
        </MoneyGoalDialog>
      )}
    </section>
  );
}
