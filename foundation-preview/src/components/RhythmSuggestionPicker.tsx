import { useEffect, useId, useRef } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';

export type RhythmSuggestionPickerItem = {
  id: string;
  title: string;
  description?: string;
  scheduleHint: string;
  icon: ReactNode;
  status: 'available' | 'added' | 'archived';
  onAdd?: (
    event: MouseEvent<HTMLButtonElement>,
    returnToPicker: (saved: boolean) => void
  ) => void;
  onEdit?: (
    event: MouseEvent<HTMLButtonElement>,
    returnToPicker: (saved: boolean) => void
  ) => void;
  onRestore?: () => void;
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
  const closeId = `${useId()}-suggestion-picker-close`;

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
  }, [groups, open]);

  function startAction(
    item: RhythmSuggestionPickerItem,
    action: NonNullable<RhythmSuggestionPickerItem['onAdd'] | RhythmSuggestionPickerItem['onEdit']>,
    focusTargetId: string,
    event: MouseEvent<HTMLButtonElement>
  ) {
    scrollTopRef.current = bodyRef.current?.scrollTop ?? scrollTopRef.current;
    returnFocusIdRef.current = focusTargetId;
    onClose();
    action(event, saved => {
      returnFocusIdRef.current = saved
        ? `${closeId}-edit-${item.id}`
        : focusTargetId;
      onReopen(saved);
      const returnFocusId = returnFocusIdRef.current;
      window.setTimeout(() => {
        const target = document.getElementById(returnFocusId);
        if (target instanceof HTMLElement) {
          target.focus({ preventScroll: true });
          returnFocusIdRef.current = null;
        }
      }, 0);
    });
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
        {groups.map(group => (
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
                const editId = `${closeId}-edit-${item.id}`;
                return (
                  <li className="rhythm-suggestion-picker__row" key={item.id}>
                    <span className="rhythm-suggestion-picker__icon">{item.icon}</span>
                    <div className="rhythm-suggestion-picker__details">
                      <h4>{item.title}</h4>
                      <p className="rhythm-suggestion-picker__schedule">{item.scheduleHint}</p>
                      {item.description && <p className="rhythm-suggestion-picker__description">{item.description}</p>}
                    </div>
                    <div className="rhythm-suggestion-picker__action">
                      {item.status === 'available' && item.onAdd && (
                        <button
                          id={addId}
                          type="button"
                          className="btn mini"
                          onClick={event => startAction(item, item.onAdd!, addId, event)}
                        >
                          Add
                        </button>
                      )}
                      {item.status === 'added' && (
                        <>
                          <span className="rhythm-suggestion-picker__status">
                            <svg viewBox="0 0 20 20" aria-hidden="true">
                              <path d="m4 10 4 4 8-8" />
                            </svg>
                            Added
                          </span>
                          {item.onEdit && (
                            <button
                              id={editId}
                              type="button"
                              className="btn mini ghost"
                              onClick={event => startAction(item, item.onEdit!, editId, event)}
                            >
                              Edit rhythm
                            </button>
                          )}
                        </>
                      )}
                      {item.status === 'archived' && (
                        <>
                          <span className="rhythm-suggestion-picker__status rhythm-suggestion-picker__status--archived">
                            Archived
                          </span>
                          {item.onRestore && (
                            <button
                              type="button"
                              className="btn mini ghost"
                              onClick={() => {
                                returnFocusIdRef.current = editId;
                                item.onRestore?.();
                                window.setTimeout(() => {
                                  const target = document.getElementById(editId);
                                  if (target instanceof HTMLElement) {
                                    target.focus({ preventScroll: true });
                                    returnFocusIdRef.current = null;
                                  }
                                }, 0);
                              }}
                            >
                              Restore rhythm
                            </button>
                          )}
                        </>
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
