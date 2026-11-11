import { useEffect, useMemo, useState } from 'react';
import {
  calendarFeedUrlError,
  createCalendarSourceId,
  validateCalendarSources
} from '../domain/calendar-sources.ts';
import type { CalendarSource } from '../domain/calendar-sources.ts';

type Props = {
  sources: readonly CalendarSource[];
  onSave: (sources: CalendarSource[]) => string | null;
};

type SourceDraft = { id: string | null; name: string; url: string };

function cloneSources(sources: readonly CalendarSource[]): CalendarSource[] {
  return sources.map(source => ({ ...source }));
}

export function CalendarSettings({ sources, onSave }: Props) {
  const [draftSources, setDraftSources] = useState(() => cloneSources(sources));
  const [sourceDraft, setSourceDraft] = useState<SourceDraft | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isDirty = useMemo(() => JSON.stringify(draftSources) !== JSON.stringify(sources), [draftSources, sources]);

  useEffect(() => {
    if (!isDirty) setDraftSources(cloneSources(sources));
  }, [sources, isDirty]);

  function stageSource() {
    if (!sourceDraft) return;
    const name = sourceDraft.name.trim();
    const urlError = calendarFeedUrlError(sourceDraft.url);
    if (!name || name.length > 60 || urlError) {
      setErrors([
        ...(!name ? ['Add a calendar name.'] : []),
        ...(name.length > 60 ? ['Calendar names must be 60 characters or fewer.'] : []),
        ...(urlError ? [urlError] : [])
      ]);
      return;
    }
    const id = sourceDraft.id ?? createCalendarSourceId();
    if (!id) {
      setErrors(['A stable calendar ID could not be generated in this browser.']);
      return;
    }
    const nextSources = sourceDraft.id
      ? draftSources.map(source => source.id === sourceDraft.id
        ? { id, name, url: sourceDraft.url }
        : source)
      : [...draftSources, { id, name, url: sourceDraft.url }];
    const validation = validateCalendarSources(nextSources);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }
    setDraftSources(validation.sources);
    setSourceDraft(null);
    setErrors([]);
    setSaveError(null);
  }

  function save() {
    const validation = validateCalendarSources(draftSources);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }
    const error = onSave(validation.sources);
    setSaveError(error);
    if (error === null) {
      setDraftSources(cloneSources(validation.sources));
      setErrors([]);
    }
  }

  function cancel() {
    setDraftSources(cloneSources(sources));
    setSourceDraft(null);
    setErrors([]);
    setSaveError(null);
  }

  return (
    <div className="calendar-settings">
      <p className="calendar-settings__intro">
        Connect an iCloud calendar using its public subscription link. Anyone who has that link may be able to view its events;
        this does not sign in to a private Apple Account.
      </p>
      <p className="calendar-settings__notice" role="note">
        Calendar loading is not enabled yet. Do not enter a real calendar link until secure fetching is ready.
        Links are sensitive and are included in this browser’s Preview backup.
      </p>
      <div className="calendar-settings__list" aria-label="Calendar sources">
        {draftSources.map(source => (
          <div className="calendar-settings__row" key={source.id}>
            <div>
              <strong>{source.name}</strong>
              <span>Link saved in this browser</span>
            </div>
            <button
              type="button"
              className="btn mini ghost"
              onClick={() => {
                setSourceDraft({ id: source.id, name: source.name, url: source.url });
                setErrors([]);
                setSaveError(null);
              }}
            >
              Edit
            </button>
            <button
              type="button"
              className="btn mini ghost"
              aria-label={`Remove ${source.name}`}
              onClick={() => {
                setDraftSources(current => current.filter(item => item.id !== source.id));
                setErrors([]);
                setSaveError(null);
              }}
            >
              Remove
            </button>
          </div>
        ))}
        {draftSources.length === 0 && <p className="empty">No calendar sources added.</p>}
      </div>
      {sourceDraft ? (
        <fieldset className="calendar-settings__editor">
          <legend>{sourceDraft.id ? 'Edit calendar' : 'Add calendar'}</legend>
          <label>
            <span>Calendar name</span>
            <input
              type="text"
              maxLength={60}
              value={sourceDraft.name}
              onChange={event => {
                const name = event.currentTarget.value;
                setSourceDraft(current => current && { ...current, name });
                setErrors([]);
              }}
            />
          </label>
          <label>
            <span>Public iCloud calendar link</span>
            <input
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={sourceDraft.url}
              onChange={event => {
                const url = event.currentTarget.value;
                setSourceDraft(current => current && { ...current, url });
                setErrors([]);
              }}
            />
          </label>
          <div className="calendar-settings__actions">
            <button type="button" className="btn mini" onClick={stageSource}>Save calendar</button>
            <button type="button" className="btn mini ghost" onClick={() => setSourceDraft(null)}>Cancel</button>
          </div>
        </fieldset>
      ) : (
        <button
          type="button"
          className="btn mini ghost"
          onClick={() => {
            setSourceDraft({ id: null, name: '', url: '' });
            setErrors([]);
          }}
        >
          Add calendar
        </button>
      )}
      {errors.length > 0 && (
        <div className="calendar-settings__errors" role="alert">
          {errors.map(error => <p key={error}>{error}</p>)}
        </div>
      )}
      {saveError && <p className="calendar-settings__errors" role="alert">{saveError}</p>}
      <div className="calendar-settings__actions">
        <button type="button" className="btn primary" onClick={save} disabled={!isDirty || sourceDraft !== null}>
          Save calendar settings
        </button>
        <button type="button" className="btn ghost" onClick={cancel} disabled={!isDirty && sourceDraft === null}>
          Cancel
        </button>
      </div>
    </div>
  );
}
