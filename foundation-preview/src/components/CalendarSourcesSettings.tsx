import { useState, type FormEvent } from 'react';
import {
  CONTROLLED_CALENDAR_TEST_URL,
  calendarFeedUrlError,
  createCalendarSourceId,
  validateCalendarSources
} from '../domain/calendar-sources.ts';
import type { CalendarSource } from '../domain/calendar-sources.ts';

type CalendarSourceDraft = {
  id: string | null;
  name: string;
  url: string;
  enabled: boolean;
  kind?: 'controlled-test';
};

function draftFromSource(source: CalendarSource): CalendarSourceDraft {
  return {
    id: source.id,
    name: source.name,
    url: source.url,
    enabled: source.enabled !== false,
    ...(source.kind === 'controlled-test' ? { kind: source.kind } : {})
  };
}

export function CalendarSourcesSettings({
  sources,
  onSave,
  showOnToday = true,
  onShowOnTodayChange = () => undefined,
  localReaderEnabled = false,
  accountScoped = false
}: {
  sources: readonly CalendarSource[];
  onSave: (sources: CalendarSource[]) => string | null;
  showOnToday?: boolean;
  onShowOnTodayChange?: (show: boolean) => void;
  localReaderEnabled?: boolean;
  accountScoped?: boolean;
}) {
  const [draft, setDraft] = useState<CalendarSourceDraft | null>(null);
  const [removalId, setRemovalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function beginAdd() {
    setDraft({ id: null, name: '', url: '', enabled: true });
    setError(null);
    setNotice(null);
  }

  function addControlledTest() {
    const id = createCalendarSourceId();
    if (!id) {
      setError('A secure calendar ID could not be created. No changes were saved.');
      return;
    }
    const validation = validateCalendarSources([
      ...sources,
      {
        id,
        name: 'Controlled test calendar',
        url: CONTROLLED_CALENDAR_TEST_URL,
        enabled: true,
        kind: 'controlled-test'
      }
    ]);
    if (!validation.valid) {
      setError(validation.errors[0] ?? 'Calendar settings are invalid. No changes were saved.');
      return;
    }
    const saveError = onSave(validation.sources);
    setError(saveError);
    setNotice(saveError ? null : 'Controlled test calendar added.');
  }

  function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    if (draft.id && !sources.some(source => source.id === draft.id)) {
      setError('This calendar changed while you were editing. No changes were saved.');
      return;
    }
    if (!draft.name.trim() || draft.name.trim().length > 60) {
      setError('Enter a calendar name using 1–60 characters.');
      return;
    }
    const urlError = draft.kind === 'controlled-test' ? null : calendarFeedUrlError(draft.url);
    if (urlError) {
      setError(urlError);
      return;
    }
    const id = draft.id ?? createCalendarSourceId();
    if (!id) {
      setError('A secure calendar ID could not be created. No changes were saved.');
      return;
    }
    const nextSource = {
      id,
      name: draft.name.trim(),
      url: draft.url,
      enabled: draft.enabled,
      ...(draft.kind === 'controlled-test' ? { kind: draft.kind } : {})
    };
    const nextSources = draft.id
      ? sources.map(source => source.id === draft.id ? nextSource : source)
      : [...sources, nextSource];
    const validation = validateCalendarSources(nextSources);
    if (!validation.valid) {
      setError(validation.errors[0] ?? 'Calendar settings are invalid. No changes were saved.');
      return;
    }
    const saveError = onSave(validation.sources);
    if (saveError) {
      setError(saveError);
      return;
    }
    setDraft(null);
    setError(null);
    setNotice(draft.id ? 'Calendar updated.' : 'Calendar added.');
  }

  function toggleSource(source: CalendarSource) {
    const nextSources = sources.map(item => item.id === source.id
      ? { ...item, enabled: item.enabled === false }
      : item);
    const saveError = onSave(nextSources);
    setError(saveError);
    setNotice(saveError ? null : `${source.name} ${source.enabled === false ? 'enabled' : 'disabled'}.`);
  }

  function removeSource(id: string) {
    const saveError = onSave(sources.filter(source => source.id !== id));
    setError(saveError);
    if (saveError) return;
    setRemovalId(null);
    setNotice('Calendar removed.');
  }

  return (
    <div className="calendar-sources-settings">
      <label className="calendar-sources-settings__show-today">
        <input
          type="checkbox"
          checked={showOnToday}
          onChange={event => onShowOnTodayChange(event.currentTarget.checked)}
        />
        Show calendar on Today
      </label>
      <p className="calendar-sources-settings__help">
        In iCloud Calendar on icloud.com, open a calendar’s sharing settings, turn on Public Calendar, and copy its link. Private Apple Account sign-in and other providers are not supported.
      </p>
      <p className="calendar-sources-settings__privacy">
        Public calendar links can grant access to the feed. Treat each link like a password. {accountScoped
          ? 'Links are stored in this signed-in account’s saved data and included in its existing sync. Only enabled sources are sent to the same-origin reader while Calendar is shown on Today.'
          : localReaderEnabled
            ? 'This local preview sends enabled links only to a reader on this device. Links and event details are not logged or uploaded.'
            : 'This preview saves links only in its versioned synthetic data and does not fetch them.'}
      </p>

      {sources.length === 0
        ? <p className="calendar-sources-settings__empty">No calendar sources configured.</p>
        : (
          <ul className="calendar-sources-settings__list" aria-label="Calendar sources">
            {sources.map(source => (
              <li className="calendar-sources-settings__item" key={source.id}>
                <div className="calendar-sources-settings__item-copy">
                  <strong>{source.name}</strong>
                  <span>
                    {source.enabled === false ? 'Disabled' : 'Enabled'} · {source.kind === 'controlled-test' ? 'controlled test feed' : 'public iCloud feed'}
                  </span>
                </div>
                <div className="calendar-sources-settings__item-actions">
                  <label className="calendar-sources-settings__source-enabled">
                    <input
                      type="checkbox"
                      checked={source.enabled !== false}
                      aria-label={`Use ${source.name}`}
                      onChange={() => toggleSource(source)}
                    />
                    Enabled
                  </label>
                  <button
                    type="button"
                    className="btn mini ghost"
                    aria-label={`Edit ${source.name}`}
                    onClick={() => {
                      setDraft(draftFromSource(source));
                      setError(null);
                      setNotice(null);
                    }}
                  >
                    Edit
                  </button>
                  {removalId === source.id
                    ? (
                      <>
                        <button
                          type="button"
                          className="btn mini danger"
                          aria-label={`Confirm removal of ${source.name}`}
                          onClick={() => removeSource(source.id)}
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          className="btn mini ghost"
                          onClick={() => setRemovalId(null)}
                        >
                          Cancel
                        </button>
                      </>
                    )
                    : (
                      <button
                        type="button"
                        className="btn mini ghost"
                        onClick={() => setRemovalId(source.id)}
                      >
                        Remove
                      </button>
                    )}
                </div>
              </li>
            ))}
          </ul>
        )}

      {draft && (
        <form className="calendar-sources-settings__form" onSubmit={saveDraft}>
          <h4>{draft.id ? 'Edit calendar' : 'Add calendar'}</h4>
          <label>
            Calendar name
            <input
              name="calendar-name"
              autoComplete="off"
              maxLength={60}
              value={draft.name}
              onChange={event => {
                const name = event.currentTarget.value;
                setDraft(current => current && { ...current, name });
              }}
              required
            />
          </label>
          {draft.kind === 'controlled-test'
            ? <p className="calendar-sources-settings__field-help">Uses a fixed synthetic feed from the local reader. It cannot access a personal calendar.</p>
            : (
              <>
                <label>
                  Public iCloud calendar link
                  <input
                    name="calendar-url"
                    type="text"
                    inputMode="url"
                    autoComplete="off"
                    spellCheck={false}
                    value={draft.url}
                    placeholder="webcal://… or https://…"
                    onChange={event => {
                      const url = event.currentTarget.value;
                      setDraft(current => current && { ...current, url });
                    }}
                    required
                    aria-describedby="calendar-url-help"
                  />
                </label>
                <p id="calendar-url-help" className="calendar-sources-settings__field-help">
                  The saved link is not shown in the source list and is never included in validation errors.
                </p>
              </>
            )}
          <label className="calendar-sources-settings__enabled">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={event => {
                const enabled = event.currentTarget.checked;
                setDraft(current => current && { ...current, enabled });
              }}
            />
            Enable this calendar
          </label>
          <div className="calendar-sources-settings__form-actions">
            <button type="submit" className="btn mini">Save calendar</button>
            <button type="button" className="btn mini ghost" onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </form>
      )}

      {error && <p className="calendar-sources-settings__message" role="alert">{error}</p>}
      {notice && <p className="calendar-sources-settings__message" role="status">{notice}</p>}
      {!draft && (
        <div className="calendar-sources-settings__add-actions">
          <button type="button" className="btn mini ghost" onClick={beginAdd}>
            Add calendar
          </button>
          {localReaderEnabled && (
            <button type="button" className="btn mini ghost" onClick={addControlledTest}>
              Add controlled test feed
            </button>
          )}
        </div>
      )}
    </div>
  );
}
