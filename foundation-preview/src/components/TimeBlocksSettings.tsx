import { useEffect, useMemo, useState } from 'react';
import {
  formatTimeBlockTime,
  sortTimeBlocks,
  timeBlockRange,
  validateTimeBlockSettings
} from '../domain/time-blocks.ts';
import type { TimeBlockId, TimeBlockSettings } from '../domain/time-blocks.ts';

type Props = {
  settings: TimeBlockSettings;
  assignedBlockIds: ReadonlySet<TimeBlockId>;
  onSave: (settings: TimeBlockSettings) => string | null;
};

function cloneSettings(settings: TimeBlockSettings): TimeBlockSettings {
  return { blocks: settings.blocks.map(block => ({ ...block })), sleepStart: settings.sleepStart };
}

export function TimeBlocksSettings({ settings, assignedBlockIds, onSave }: Props) {
  const [draft, setDraft] = useState(() => cloneSettings(settings));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(settings), [draft, settings]);
  const assigned = useMemo(() => new Set(assignedBlockIds), [assignedBlockIds]);

  useEffect(() => {
    if (!isDirty) setDraft(cloneSettings(settings));
  }, [settings, isDirty]);

  function updateBlock(id: TimeBlockId, patch: { name?: string; start?: string }) {
    setDraft(current => ({
      ...current,
      blocks: sortTimeBlocks(current.blocks.map(block => block.id === id ? { ...block, ...patch } : block))
    }));
    setValidationErrors([]);
    setSaveError(null);
  }

  function addBlock() {
    const starts = new Set(draft.blocks.map(block => block.start));
    const start = Array.from({ length: 32 }, (_, index) => {
      const minutes = 6 * 60 + index * 30;
      return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    }).find(value => !starts.has(value) && value !== draft.sleepStart);
    if (!start) {
      setValidationErrors(['No available half-hour start remains; move an existing block first.']);
      return;
    }
    const id = globalThis.crypto?.randomUUID?.();
    if (!id) {
      setSaveError('A stable time-block ID could not be generated in this browser.');
      return;
    }
    setDraft(current => ({
      ...current,
      blocks: sortTimeBlocks([...current.blocks, { id: `custom-time-block:${id}`, name: 'New time block', start }])
    }));
    setValidationErrors([]);
    setSaveError(null);
  }

  function removeBlock(id: TimeBlockId) {
    if (assigned.has(id)) return;
    setDraft(current => ({ ...current, blocks: current.blocks.filter(block => block.id !== id) }));
    setValidationErrors([]);
    setSaveError(null);
  }

  function save() {
    const validation = validateTimeBlockSettings(draft);
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      setSaveError(null);
      return;
    }
    const error = onSave(validation.settings);
    setSaveError(error);
    if (error === null) {
      setDraft(cloneSettings(validation.settings));
      setValidationErrors([]);
    }
  }

  function cancel() {
    setDraft(cloneSettings(settings));
    setValidationErrors([]);
    setSaveError(null);
  }

  const firstBlock = draft.blocks[0];
  return (
    <div className="time-block-settings">
      <p className="time-block-settings__intro">
        Each visible block ends when the next begins. Sleep is hidden from Rhythm schedules and Today’s block list.
      </p>
      <div className="time-block-settings__list" aria-label="Visible time blocks">
        {draft.blocks.map((block, index) => {
          const range = timeBlockRange(draft, block.id);
          const end = range?.split(' – ')[1] ?? '—';
          const cannotDelete = assigned.has(block.id);
          return (
            <section className="time-block-settings__row" key={block.id} aria-label={`${block.name} time block`}>
              <label>
                <span>Block name</span>
                <input
                  type="text"
                  maxLength={48}
                  value={block.name}
                  onChange={event => updateBlock(block.id, { name: event.currentTarget.value })}
                />
              </label>
              <label>
                <span>Starts</span>
                <input
                  type="time"
                  value={block.start}
                  onChange={event => updateBlock(block.id, { start: event.currentTarget.value })}
                />
              </label>
              <div className="time-block-settings__end">
                <span>Ends</span>
                <output>{end}</output>
              </div>
              <button
                type="button"
                className="btn mini ghost"
                aria-label={`Delete ${block.name}`}
                disabled={cannotDelete}
                title={cannotDelete ? 'This block is used by a current or historical Rhythm schedule.' : undefined}
                onClick={() => removeBlock(block.id)}
              >
                Delete
              </button>
              {cannotDelete && (
                <small className="time-block-settings__assignment-note">
                  Used in a current or historical Rhythm schedule; it cannot be deleted.
                </small>
              )}
              {index === 0 && <span className="sr-only">First visible morning block</span>}
            </section>
          );
        })}
      </div>
      <button type="button" className="btn mini ghost" onClick={addBlock}>Add time block</button>
      <section className="time-block-settings__sleep" aria-labelledby="sleep-time-block-title">
        <h4 id="sleep-time-block-title">Hidden Sleep boundary</h4>
        <label>
          <span>Sleep starts</span>
          <input
            type="time"
            value={draft.sleepStart}
            onChange={event => {
              setDraft(current => ({ ...current, sleepStart: event.currentTarget.value }));
              setValidationErrors([]);
              setSaveError(null);
            }}
          />
        </label>
        <div className="time-block-settings__sleep-range">
          Sleep runs {formatTimeBlockTime(draft.sleepStart)} until {firstBlock?.start
            ? formatTimeBlockTime(firstBlock.start)
            : 'the first visible block'} (next day).
        </div>
      </section>
      {validationErrors.length > 0 && (
        <div className="time-block-settings__errors" role="alert">
          {validationErrors.map(error => <p key={error}>{error}</p>)}
        </div>
      )}
      {saveError && <p className="time-block-settings__errors" role="alert">{saveError}</p>}
      <div className="time-block-settings__actions">
        <button type="button" className="btn primary" onClick={save} disabled={!isDirty}>
          Save time blocks
        </button>
        <button type="button" className="btn ghost" onClick={cancel} disabled={!isDirty}>
          Cancel
        </button>
      </div>
    </div>
  );
}
