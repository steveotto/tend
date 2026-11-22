import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { PersonPrayerPanel } from '../src/components/PersonPrayerPanel.tsx';
import {
  createPersonPrayerRequest,
  deletePersonPrayerRequest,
  recordPersonPrayer,
  transitionPersonPrayerRequest,
  updatePersonPrayerRequest
} from '../src/domain/person-prayers.ts';
import type { PersonPrayerRequest } from '../src/domain/person-prayers.ts';
import { createPersonPickerGroups, createSamplePeople } from '../src/domain/preview-data.ts';
import type { PersonId } from '../src/domain/preview-data.ts';
import type { PrayerRequestTransition } from '../src/domain/person-prayers.ts';

afterEach(cleanup);

const owner: PersonId = 'sample-person-avery';
const shared: PersonId = 'sample-person-morgan';
const people = createSamplePeople();
const peopleGroups = createPersonPickerGroups();
const createdAt = '2026-10-31T12:00:00.000Z';

function PrayerHarness({
  failCreate = false,
  failPray = false,
  initialRequests = []
}: {
  failCreate?: boolean;
  failPray?: boolean;
  initialRequests?: PersonPrayerRequest[];
}) {
  const [requests, setRequests] = useState<PersonPrayerRequest[]>(initialRequests);
  const peopleIds = people.map(person => person.id);
  const nextTimestamp = (id: string) => new Date(
    Date.parse(requests.find(request => request.id === id)?.updatedAt ?? createdAt) + 60_000
  ).toISOString();
  return (
    <>
      <PersonPrayerPanel
        personId={owner}
        today="2026-10-31"
        timeZone="UTC"
        people={people}
        peopleGroups={peopleGroups}
        requests={requests}
        onCreate={(personId, draft) => {
          if (failCreate) return 'Preview storage changed. No request was saved.';
          const result = createPersonPrayerRequest(requests, {
            id: 'prayer-request-test',
            personId,
            sharedWith: draft.sharedWith,
            title: draft.title.trim(),
            ...(draft.details.trim() ? { details: draft.details } : {}),
            status: 'active',
            createdAt,
            updatedAt: createdAt,
            prayerLogs: []
          }, peopleIds);
          if (!result.valid) return result.error;
          setRequests(result.requests);
          return null;
        }}
        onUpdate={(id, expectedUpdatedAt, actorId, draft) => {
          const result = updatePersonPrayerRequest(
            requests, id, expectedUpdatedAt, actorId, draft, nextTimestamp(id), peopleIds
          );
          if (!result.valid) return result.error;
          setRequests(result.requests);
          return null;
        }}
        onTransition={(id, expectedUpdatedAt, actorId, transition: PrayerRequestTransition) => {
          const result = transitionPersonPrayerRequest(
            requests, id, expectedUpdatedAt, actorId, transition, nextTimestamp(id)
          );
          if (!result.valid) return result.error;
          setRequests(result.requests);
          return null;
        }}
        onPray={(id, expectedUpdatedAt, actorId) => {
          if (failPray) return 'Prayer history changed. No prayer was recorded.';
          const result = recordPersonPrayer(
            requests,
            id,
            expectedUpdatedAt,
            actorId,
            { id: `prayer-log-${requests[0]?.prayerLogs.length ?? 0}`, prayedAt: nextTimestamp(id) },
            peopleIds
          );
          if (!result.valid) return result.error;
          setRequests(result.requests);
          return null;
        }}
        onRemove={(id, expectedUpdatedAt, actorId) => {
          const result = deletePersonPrayerRequest(requests, id, expectedUpdatedAt, actorId);
          if (!result.valid) return result.error;
          setRequests(result.requests);
          return null;
        }}
      />
      <output data-testid="requests">{JSON.stringify(requests)}</output>
    </>
  );
}

describe('shared Person Prayer panel', () => {
  it('creates a shared plain-text request and exposes state-appropriate menu actions', async () => {
    const user = userEvent.setup();
    render(<PrayerHarness />);
    expect(screen.getByText('No prayer requests for Avery Brooks yet.')).toBeTruthy();

    const addButton = screen.getByRole('button', { name: 'Add prayer request' });
    await user.click(addButton);
    const editor = screen.getByRole('dialog', { name: 'Add prayer request' });
    await user.type(within(editor).getByRole('textbox', { name: 'Title' }), '<script>care</script>');
    await user.type(within(editor).getByRole('textbox', { name: 'Details (optional)' }), 'Keep this as plain text.');
    await user.click(within(editor).getByRole('button', { name: 'Choose people' }));
    const picker = screen.getByRole('dialog', { name: 'Choose people to share this request with' });
    await user.click(within(picker).getByRole('button', { name: 'Morgan Reed' }));
    await user.click(within(picker).getByRole('button', { name: 'Done' }));
    await user.click(within(editor).getByRole('button', { name: 'Save request' }));

    const card = screen.getByRole('listitem');
    expect(within(card).getByText('<script>care</script>')).toBeTruthy();
    expect(within(card).queryByRole('script')).toBeNull();
    expect(within(card).getByRole('group', { name: 'Shared with' })).toBeTruthy();
    expect(within(card).getByRole('img', { name: 'Morgan Reed' })).toBeTruthy();
    expect(within(card).queryByText(/Schedule/)).toBeNull();
    expect(document.activeElement).toBe(addButton);
    expect(JSON.parse(screen.getByTestId('requests').textContent ?? '[]')).toMatchObject([
      { personId: owner, sharedWith: [shared], status: 'active', prayerLogs: [] }
    ]);

    await user.click(within(card).getByRole('button', { name: 'Actions for <script>care</script>' }));
    let menu = screen.getByRole('menu', { name: 'Actions for <script>care</script>' });
    expect(within(menu).getByRole('menuitem', { name: 'Pray' })).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: 'Mark answered' })).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: 'Archive' })).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: 'Details/Edit' })).toBeTruthy();
    expect(within(menu).queryByRole('menuitem', { name: /Delete/ })).toBeNull();
    await user.click(within(menu).getByRole('menuitem', { name: 'Pray' }));
    let saved = JSON.parse(screen.getByTestId('requests').textContent ?? '[]') as PersonPrayerRequest[];
    expect(saved[0]?.prayerLogs).toHaveLength(1);
    const historyButton = within(screen.getByRole('listitem')).getByRole('button', {
      name: 'Prayer history for <script>care</script>: 1 prayer recorded'
    });
    await user.click(historyButton);
    const historyDialog = screen.getByRole('dialog', { name: 'Prayer history' });
    expect(within(historyDialog).getByText('1 time prayed · last 30 days')).toBeTruthy();
    expect(historyDialog.classList.contains('dialog--phone-fullscreen')).toBe(true);
    await user.click(within(historyDialog).getByRole('button', { name: 'Close prayer history' }));
    await waitFor(() => expect(document.activeElement).toBe(historyButton));

    await user.click(within(screen.getByRole('listitem')).getByRole('button', {
      name: 'Actions for <script>care</script>'
    }));
    menu = screen.getByRole('menu', { name: 'Actions for <script>care</script>' });
    await user.click(within(menu).getByRole('menuitem', { name: 'Mark answered' }));
    saved = JSON.parse(screen.getByTestId('requests').textContent ?? '[]') as PersonPrayerRequest[];
    expect(saved[0]?.status).toBe('answered');
    expect(saved[0]?.prayerLogs).toHaveLength(1);
    await user.click(within(screen.getByRole('listitem')).getByRole('button', {
      name: 'Actions for <script>care</script>'
    }));
    menu = screen.getByRole('menu', { name: 'Actions for <script>care</script>' });
    expect(within(menu).getByRole('menuitem', { name: 'Reopen' })).toBeTruthy();
    expect(within(menu).queryByRole('menuitem', { name: 'Pray' })).toBeNull();
    await user.click(within(menu).getByRole('menuitem', { name: 'Reopen' }));
    saved = JSON.parse(screen.getByTestId('requests').textContent ?? '[]') as PersonPrayerRequest[];
    expect(saved[0]?.status).toBe('active');
    await user.click(within(screen.getByRole('listitem')).getByRole('button', {
      name: 'Actions for <script>care</script>'
    }));
    menu = screen.getByRole('menu', { name: 'Actions for <script>care</script>' });
    await user.click(within(menu).getByRole('menuitem', { name: 'Archive' }));
    saved = JSON.parse(screen.getByTestId('requests').textContent ?? '[]') as PersonPrayerRequest[];
    expect(saved[0]?.status).toBe('archived');
    await user.click(within(screen.getByRole('listitem')).getByRole('button', {
      name: 'Actions for <script>care</script>'
    }));
    menu = screen.getByRole('menu', { name: 'Actions for <script>care</script>' });
    expect(within(menu).getByRole('menuitem', { name: 'Reopen' })).toBeTruthy();
    await user.click(within(menu).getByRole('menuitem', { name: 'Reopen' }));
    saved = JSON.parse(screen.getByTestId('requests').textContent ?? '[]') as PersonPrayerRequest[];
    expect(saved[0]?.status).toBe('active');
    expect(saved[0]?.prayerLogs).toHaveLength(1);
  });

  it('retains the editor draft when persistence fails and closes cleanly on Escape or Cancel', async () => {
    const user = userEvent.setup();
    render(<PrayerHarness failCreate />);
    const addButton = screen.getByRole('button', { name: 'Add prayer request' });
    await user.click(addButton);
    let editor = screen.getByRole('dialog', { name: 'Add prayer request' });
    const title = within(editor).getByRole('textbox', { name: 'Title' });
    await user.type(title, 'Unsaved request');
    await user.click(within(editor).getByRole('button', { name: 'Save request' }));
    expect(within(editor).getByRole('alert').textContent).toBe('Preview storage changed. No request was saved.');
    expect((title as HTMLInputElement).value).toBe('Unsaved request');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Add prayer request' })).toBeNull();
    expect(document.activeElement).toBe(addButton);
    expect(JSON.parse(screen.getByTestId('requests').textContent ?? '[]')).toEqual([]);

    await user.click(addButton);
    editor = screen.getByRole('dialog', { name: 'Add prayer request' });
    await user.type(within(editor).getByRole('textbox', { name: 'Title' }), 'Cancel this draft');
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(addButton);
    expect(JSON.parse(screen.getByTestId('requests').textContent ?? '[]')).toEqual([]);
  });

  it('keeps an undated legacy log separate, charts dated history, and restores menu focus', async () => {
    const user = userEvent.setup();
    const request: PersonPrayerRequest = {
      id: 'legacy-prayer-request',
      personId: owner,
      sharedWith: [shared],
      title: 'A synthetic history request',
      details: 'Context for this synthetic history.',
      status: 'active',
      createdAt,
      updatedAt: createdAt,
      prayerLogs: [
        { id: 'today-log', prayedAt: '2026-10-31T12:00:00.000Z' },
        { id: 'window-log', prayedAt: '2026-10-02T12:00:00.000Z' },
        { id: 'older-log', prayedAt: '2026-10-01T12:00:00.000Z' },
        { id: 'undated-log' },
        { id: 'future-log', prayedAt: '2026-11-01T12:00:00.000Z' }
      ]
    };
    render(<PrayerHarness initialRequests={[request]} />);
    const card = screen.getByRole('article', { name: request.title });
    const actions = within(card).getByRole('button', { name: `Actions for ${request.title}` });
    await user.click(actions);
    const menu = screen.getByRole('menu', { name: `Actions for ${request.title}` });
    expect(document.activeElement).toBe(within(menu).getByRole('menuitem', { name: 'Pray' }));
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(within(menu).getByRole('menuitem', { name: 'Mark answered' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(actions);
    await user.click(actions);
    await user.click(screen.getByRole('heading', { name: 'Active (1)' }));
    expect(screen.queryByRole('menu')).toBeNull();

    const historyButton = within(card).getByRole('button', {
      name: `Prayer history for ${request.title}: 5 prayers recorded`
    });
    await user.click(historyButton);
    const dialog = screen.getByRole('dialog', { name: 'Prayer history' });
    expect(within(dialog).getByText('2 times prayed · last 30 days')).toBeTruthy();
    expect(within(dialog).getByText(/1 historical prayer has no saved date/)).toBeTruthy();
    expect(within(dialog).getByText(/1 future-dated record is excluded/)).toBeTruthy();
    expect(within(dialog).getByText('Context for this synthetic history.')).toBeTruthy();
    const chart = within(dialog).getByRole('region', {
      name: 'Prayer history chart; scroll horizontally for older dates'
    });
    expect(within(chart).getByRole('listitem', { name: /October 1, 2026: 1 prayer/ })).toBeTruthy();
    expect(within(chart).getByRole('listitem', { name: /October 31, 2026: 1 prayer, today/ })).toBeTruthy();
    expect(within(chart).queryByRole('listitem', { name: /November 1, 2026/ })).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Close prayer history' }));
    await waitFor(() => expect(document.activeElement).toBe(historyButton));
  });

  it('supports editing, canceling, deletion confirmation, and focus fallback after removal', async () => {
    const user = userEvent.setup();
    render(<PrayerHarness />);
    const addButton = screen.getByRole('button', { name: 'Add prayer request' });
    await user.click(addButton);
    let editor = screen.getByRole('dialog', { name: 'Add prayer request' });
    await user.type(within(editor).getByRole('textbox', { name: 'Title' }), 'First request');
    await user.click(within(editor).getByRole('button', { name: 'Save request' }));

    const actions = within(screen.getByRole('article', { name: 'First request' }))
      .getByRole('button', { name: 'Actions for First request' });
    await user.click(actions);
    let menu = screen.getByRole('menu', { name: 'Actions for First request' });
    await user.click(within(menu).getByRole('menuitem', { name: 'Details/Edit' }));
    editor = screen.getByRole('dialog', { name: 'Prayer request details' });
    const title = within(editor).getByRole('textbox', { name: 'Title' });
    await user.clear(title);
    await user.type(title, 'Unsaved title');
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('article', { name: 'First request' })).toBeTruthy();

    await user.click(within(screen.getByRole('article', { name: 'First request' }))
      .getByRole('button', { name: 'Actions for First request' }));
    menu = screen.getByRole('menu', { name: 'Actions for First request' });
    await user.click(within(menu).getByRole('menuitem', { name: 'Details/Edit' }));
    editor = screen.getByRole('dialog', { name: 'Prayer request details' });
    await user.clear(within(editor).getByRole('textbox', { name: 'Title' }));
    await user.type(within(editor).getByRole('textbox', { name: 'Title' }), 'Updated request');
    await user.click(within(editor).getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('article', { name: 'Updated request' })).toBeTruthy();

    await user.click(within(screen.getByRole('article', { name: 'Updated request' }))
      .getByRole('button', { name: 'Actions for Updated request' }));
    menu = screen.getByRole('menu', { name: 'Actions for Updated request' });
    await user.click(within(menu).getByRole('menuitem', { name: 'Details/Edit' }));
    editor = screen.getByRole('dialog', { name: 'Prayer request details' });
    await user.click(within(editor).getByRole('button', { name: 'Delete Updated request' }));
    const confirmation = screen.getByRole('dialog', { name: 'Delete this request?' });
    expect(within(confirmation).getByText(/permanently deletes the request and its prayer history/)).toBeTruthy();
    await user.click(within(confirmation).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('article', { name: 'Updated request' })).toBeTruthy();

    await user.click(within(screen.getByRole('article', { name: 'Updated request' }))
      .getByRole('button', { name: 'Actions for Updated request' }));
    menu = screen.getByRole('menu', { name: 'Actions for Updated request' });
    await user.click(within(menu).getByRole('menuitem', { name: 'Details/Edit' }));
    editor = screen.getByRole('dialog', { name: 'Prayer request details' });
    await user.click(within(editor).getByRole('button', { name: 'Delete Updated request' }));
    const finalConfirmation = screen.getByRole('dialog', { name: 'Delete this request?' });
    await user.click(within(finalConfirmation).getByRole('button', { name: 'Delete request' }));
    expect(screen.getByText('No prayer requests for Avery Brooks yet.')).toBeTruthy();
    expect(JSON.parse(screen.getByTestId('requests').textContent ?? '[]')).toEqual([]);
    expect(document.activeElement).toBe(addButton);
  });

  it('does not change stored prayer history when the existing Pray flow fails', async () => {
    const user = userEvent.setup();
    render(<PrayerHarness failPray initialRequests={[{
      id: 'failed-prayer-request',
      personId: owner,
      title: 'Do not record on failure',
      status: 'active',
      createdAt,
      updatedAt: createdAt,
      prayerLogs: []
    }]} />);
    const card = screen.getByRole('article', { name: 'Do not record on failure' });
    await user.click(within(card).getByRole('button', { name: 'Actions for Do not record on failure' }));
    const menu = screen.getByRole('menu', { name: 'Actions for Do not record on failure' });
    await user.click(within(menu).getByRole('menuitem', { name: 'Pray' }));
    expect(screen.getByRole('alert').textContent).toBe('Prayer history changed. No prayer was recorded.');
    expect(JSON.parse(screen.getByTestId('requests').textContent ?? '[]')).toMatchObject([
      { prayerLogs: [] }
    ]);
  });

  it('shows a clear empty history state for a request without prayer records', async () => {
    const user = userEvent.setup();
    render(<PrayerHarness initialRequests={[{
      id: 'empty-history-request',
      personId: owner,
      title: 'Empty history',
      status: 'active',
      createdAt,
      updatedAt: createdAt,
      prayerLogs: []
    }]} />);
    const card = screen.getByRole('article', { name: 'Empty history' });
    await user.click(within(card).getByRole('button', {
      name: 'Prayer history for Empty history: 0 prayers recorded'
    }));
    const dialog = screen.getByRole('dialog', { name: 'Prayer history' });
    expect(within(dialog).getByText('No prayer history is recorded for this request yet.')).toBeTruthy();
    expect(within(dialog).getByRole('listitem', { name: /no prayer recorded yet, today/ })).toBeTruthy();
  });
});
