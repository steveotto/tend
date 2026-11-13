import { useEffect, useId, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';

export type RhythmSuggestionPickerInstance = {
  id: string;
  title: string;
  peopleLabel?: string;
  scheduleSummary: string;
  archived: boolean;
  onEdit?: (
    event: MouseEvent<HTMLButtonElement>,
    returnToPicker: (saved: boolean) => void
  ) => void;
  onRestore?: () => void;
};

export type RhythmSuggestionPickerItem = {
  id: string;
  title: string;
  description?: string;
  scheduleHint: string;
  icon: ReactNode;
  instances: readonly RhythmSuggestionPickerInstance[];
  onAdd?: (
    event: MouseEvent<HTMLButtonElement>,
    returnToPicker: (saved: boolean) => void
  ) => void;
};

export type RhythmSuggestionPickerGroup = {
  id: string;
  title: string;
  subtitle: string;
  items: readonly RhythmSuggestionPickerItem[];
};

export function RhythmSuggestionPicker({
  title,
  open,
  groups,
  onClose,
  onReopen
}: {
  title: string;
  open: boolean;
  groups: readonly RhythmSuggestionPickerGroup[];
  onClose: () => void;
  onReopen: (saved: boolean) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(0);
  const returnFocusIdRef = useRef<string | null>(null);
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);
  const closeId = `${useId()}-suggestion-picker-close`;
  const selectedItem = groups.flatMap(group => group.items)
    .find(item => item.id === selectedSuggestionId);

  useEffect(() => {
    if (open && bodyRef.current) bodyRef.current.scrollTop = scrollTopRef.current;
  }, [open]);

  useEffect(() => {
    if (!open || !returnFocusIdRef.current) return;
    const target = document.getElementById(returnFocusIdRef.current);
    if (target instanceof HTMLElement) {
      target.focus({ preventScroll: true });
      returnFocusIdRef.current = null;
    }
  }, [groups, open, selectedSuggestionId]);

  function startAction(
    action: NonNullable<RhythmSuggestionPickerItem['onAdd'] | RhythmSuggestionPickerInstance['onEdit']>,
    focusTargetId: string,
    event: MouseEvent<HTMLButtonElement>
  ) {
    scrollTopRef.current = bodyRef.current?.scrollTop ?? scrollTopRef.current;
    returnFocusIdRef.current = focusTargetId;
    onClose();
    action(event, saved => {
      returnFocusIdRef.current = focusTargetId;
      onReopen(saved);
      const returnFocusId = focusTargetId;
      window.setTimeout(() => {
        const target = document.getElementById(returnFocusId);
        if (target instanceof HTMLElement) {
          target.focus({ preventScroll: true });
          returnFocusIdRef.current = null;
        }
      }, 0);
    });
  }

  function openChoice(item: RhythmSuggestionPickerItem) {
    setSelectedSuggestionId(item.id);
    const firstActive = item.instances.find(instance => !instance.archived);
    const firstArchived = item.instances.find(instance => instance.archived);
    const focusId = firstActive
      ? `${closeId}-choice-edit-${item.id}-${firstActive.id}`
      : firstArchived
        ? `${closeId}-choice-restore-${item.id}-${firstArchived.id}`
        : `${closeId}-choice-add-another-${item.id}`;
    window.setTimeout(() => {
      const target = document.getElementById(focusId);
      if (target instanceof HTMLElement) target.focus({ preventScroll: true });
    }, 0);
  }

  function returnToCatalogue(item: RhythmSuggestionPickerItem) {
    setSelectedSuggestionId(null);
    const focusId = `${closeId}-add-${item.id}`;
    window.setTimeout(() => {
      const target = document.getElementById(focusId);
      if (target instanceof HTMLElement) target.focus({ preventScroll: true });
    }, 0);
  }

  if (!open) return null;

  return (
    <MoneyGoalDialog
      title={title}
      intro="Choose a starting point. Make it yours."
      closeLabel={`Close ${title}`}
      closeButtonId={closeId}
      initialFocusId={returnFocusIdRef.current ?? closeId}
      dialogClassName="money-goal-dialog--suggestion-picker"
      surfaceClassName="money-goal-dialog__surface--suggestion-picker"
      bodyClassName="rhythm-suggestion-picker__body"
      onClose={onClose}
    >
      <div
        ref={bodyRef}
        className="rhythm-suggestion-picker__scroll"
        onScroll={event => {
          scrollTopRef.current = event.currentTarget.scrollTop;
        }}
      >
        {selectedItem ? (
          <section className="rhythm-suggestion-picker__choice" aria-labelledby={`${closeId}-choice-title`}>
            <button
              type="button"
              className="btn mini ghost rhythm-suggestion-picker__back"
              onClick={() => returnToCatalogue(selectedItem)}
            >
              Back
            </button>
            <h3 id={`${closeId}-choice-title`}>
              {selectedItem.instances.some(instance => !instance.archived)
                ? `You’ve added ${selectedItem.title}`
                : `Previously added ${selectedItem.title}`}
            </h3>
            <p>Edit an existing rhythm or create another.</p>
            {selectedItem.instances.some(instance => !instance.archived) && (
              <ul className="rhythm-suggestion-picker__instance-list" aria-label="Active instances">
                {selectedItem.instances.filter(instance => !instance.archived).map(instance => {
                  const editId = `${closeId}-choice-edit-${selectedItem.id}-${instance.id}`;
                  return (
                    <li key={instance.id} className="rhythm-suggestion-picker__instance">
                      <div>
                        <h4>{instance.title}</h4>
                        {instance.peopleLabel && <p>{instance.peopleLabel}</p>}
                        <p>{instance.scheduleSummary}</p>
                      </div>
                      {instance.onEdit && (
                        <button
                          id={editId}
                          type="button"
                          className="btn mini ghost"
                          aria-label={`Edit ${instance.title}`}
                          onClick={event => startAction(instance.onEdit!, editId, event)}
                        >
                          Edit
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {selectedItem.instances.some(instance => instance.archived) && (
              <section className="rhythm-suggestion-picker__archived" aria-labelledby={`${closeId}-archived-title`}>
                <h4 id={`${closeId}-archived-title`}>Archived</h4>
                <ul className="rhythm-suggestion-picker__instance-list">
                  {selectedItem.instances.filter(instance => instance.archived).map(instance => {
                    const restoreId = `${closeId}-choice-restore-${selectedItem.id}-${instance.id}`;
                    return (
                      <li key={instance.id} className="rhythm-suggestion-picker__instance">
                        <div>
                          <h4>{instance.title}</h4>
                          {instance.peopleLabel && <p>{instance.peopleLabel}</p>}
                          <p>{instance.scheduleSummary}</p>
                        </div>
                        {instance.onRestore && (
                          <button
                            id={restoreId}
                            type="button"
                            className="btn mini ghost"
                            onClick={() => instance.onRestore?.()}
                          >
                            Restore
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            <button
              id={`${closeId}-choice-add-another-${selectedItem.id}`}
              type="button"
              className="btn mini rhythm-suggestion-picker__add-another"
              onClick={event => selectedItem.onAdd
                && startAction(selectedItem.onAdd, `${closeId}-choice-add-another-${selectedItem.id}`, event)}
            >
              ＋ Add another
            </button>
          </section>
        ) : groups.map(group => (
          <section
            key={group.id}
            className="rhythm-suggestion-picker__group"
            aria-labelledby={`${closeId}-${group.id}-title`}
          >
            <header className="rhythm-suggestion-picker__group-header">
              <h3 id={`${closeId}-${group.id}-title`}>{group.title}</h3>
              <p>{group.subtitle}</p>
            </header>
            <ul className="rhythm-suggestion-picker__list">
              {group.items.map(item => {
                const addId = `${closeId}-add-${item.id}`;
                const activeCount = item.instances.filter(instance => !instance.archived).length;
                return (
                  <li className="rhythm-suggestion-picker__row" key={item.id}>
                    <span className="rhythm-suggestion-picker__icon">{item.icon}</span>
                    <div className="rhythm-suggestion-picker__details">
                      <div className={`rhythm-suggestion-picker__title-line${activeCount ? ' rhythm-suggestion-picker__title-line--added' : ''}`}>
                        <h4>{item.title}</h4>
                        {activeCount === 1 && (
                          <span className="rhythm-suggestion-picker__status">
                            <svg viewBox="0 0 20 20" aria-hidden="true">
                              <path d="m4 10 4 4 8-8" />
                            </svg>
                            Added
                          </span>
                        )}
                        {activeCount > 1 && (
                          <span className="rhythm-suggestion-picker__status">{activeCount} added</span>
                        )}
                      </div>
                      <p className="rhythm-suggestion-picker__schedule">{item.scheduleHint}</p>
                      {item.description && <p className="rhythm-suggestion-picker__description">{item.description}</p>}
                    </div>
                    <div className="rhythm-suggestion-picker__action">
                      {item.onAdd && (
                        <button
                          id={addId}
                          type="button"
                          className="btn mini"
                          onClick={event => item.instances.length > 0
                            ? openChoice(item)
                            : startAction(item.onAdd!, addId, event)}
                        >
                          Add
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </MoneyGoalDialog>
  );
}
