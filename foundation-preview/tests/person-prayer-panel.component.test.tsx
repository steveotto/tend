import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { localDateString } from '../src/domain/money-goals.ts';
import { PersonPrayerPanel } from '../src/components/PersonPrayerPanel.tsx';
import { PersonPrayerCard } from '../src/components/PersonPrayerCard.tsx';
import {
  createPersonPrayerRequest,
  deletePersonPrayerLog,
  deletePersonPrayerRequest,
  recordPersonPrayer,
  savePersonPrayerLog,
  transitionPersonPrayerRequest,
  undoDeletePersonPrayerLog,
  updatePersonPrayerRequest
} from '../src/domain/person-prayers.ts';
import type { PersonPrayerLog, PersonPrayerRequest } from '../src/domain/person-prayers.ts';
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
  failUpdate = false,
  failPray = false,
  failSaveLog = false,
  failDeleteLog = false,
  initialRequests = [],
  prayerHealthInstant
}: {
  failCreate?: boolean;
  failUpdate?: boolean;
  failPray?: boolean;
  failSaveLog?: boolean;
  failDeleteLog?: boolean;
  initialRequests?: PersonPrayerRequest[];
  prayerHealthInstant?: Date;
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
        {...(prayerHealthInstant ? { prayerHealthInstant } : {})}
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
            ...(draft.schedule ? { schedule: draft.schedule } : {}),
            ...(draft.timeOfDay ? { timeOfDay: draft.timeOfDay } : {}),
            createdAt,
            updatedAt: createdAt,
            prayerLogs: []
          }, peopleIds, { currentDate: '2026-10-31', timeZone: 'UTC' });
          if (!result.valid) return result.error;
          setRequests(result.requests);
          return null;
        }}
        onUpdate={(id, expectedUpdatedAt, actorId, draft) => {
          if (failUpdate) return 'Preview storage changed. No request was saved.';
          const result = updatePersonPrayerRequest(
            requests, id, expectedUpdatedAt, actorId, draft, nextTimestamp(id), peopleIds,
            { currentDate: '2026-10-31', timeZone: 'UTC' }
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
        onSaveLog={(id, expectedUpdatedAt, actorId, log: PersonPrayerLog) => {
          if (failSaveLog) return 'Preview storage changed. No prayer entry was saved.';
          const result = savePersonPrayerLog(
            requests, id, expectedUpdatedAt, actorId, log, nextTimestamp(id), peopleIds
          );
          if (!result.valid) return result.error;
          setRequests(result.requests);
          return null;
        }}
        onDeleteLog={(id, expectedUpdatedAt, actorId, logId) => {
          if (failDeleteLog) return 'Preview storage changed. No prayer entry was deleted.';
          const result = deletePersonPrayerLog(
            requests, id, expectedUpdatedAt, actorId, logId, nextTimestamp(id), peopleIds
          );
          if (!result.valid) return result.error;
          setRequests(result.requests);
          return result.undo!;
        }}
        onUndoDeleteLog={(undo, actorId) => {
          const result = undoDeletePersonPrayerLog(requests, undo, actorId, nextTimestamp(undo.requestId), peopleIds);
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
  it('keeps Prayer end dates editable, hidden when unchecked, and unchanged when re-enabled', async () => {
    const user = userEvent.setup();
    render(<PrayerHarness />);
    const prayerHeading = screen.getByRole('heading', { name: 'Prayer' });
    const prayerHeader = prayerHeading.closest('.person-profile-tab-header');
    expect(prayerHeader?.querySelector('p')?.textContent).toBe('0 active requests');
    expect(prayerHeader?.classList.contains('person-profile-tab-header--prayer')).toBe(true);
    expect(within(prayerHeader as HTMLElement).getByRole('button', { name: 'Add request' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Add request' }));
    const editor = screen.getByRole('dialog', { name: 'Add prayer request' });
    const endDateToggle = within(editor).getByRole('checkbox', { name: 'Set an end date' });

    expect((endDateToggle as HTMLInputElement).checked).toBe(false);
    expect(within(editor).queryByLabelText('End date')).toBeNull();
    await user.click(endDateToggle);
    const dateInput = within(editor).getByLabelText('End date') as HTMLInputElement;
    expect((endDateToggle as HTMLInputElement).checked).toBe(true);
    await user.clear(dateInput);
    await user.type(dateInput, '2026-12-31');
    await user.click(endDateToggle);
    expect(within(editor).queryByLabelText('End date')).toBeNull();
    await user.click(endDateToggle);
    expect((within(editor).getByLabelText('End date') as HTMLInputElement).value).toBe('2026-12-31');

    await user.type(within(editor).getByRole('textbox', { name: 'Title' }), 'Seasonal request');
    await user.click(within(editor).getByRole('button', { name: 'Save request' }));
    const saved = JSON.parse(screen.getByTestId('requests').textContent ?? '[]') as PersonPrayerRequest[];
    expect(saved[0]?.schedule?.endDate).toBe('2026-12-31');
  });

  it('creates a shared plain-text request and exposes state-appropriate menu actions', async () => {
    const user = userEvent.setup();
    render(<PrayerHarness prayerHealthInstant={new Date('2026-10-31T12:02:00.000Z')} />);
    expect(screen.getByText('No prayer requests for Avery Brooks yet.')).toBeTruthy();

    const addButton = screen.getByRole('button', { name: 'Add request' });
    await user.click(addButton);
    const editor = screen.getByRole('dialog', { name: 'Add prayer request' });
    expect(within(editor).getByRole('combobox', { name: 'Frequency: Daily' })).toBeTruthy();
    expect(within(editor).getByRole('combobox', { name: 'Time of day: Anytime' })).toBeTruthy();
    await user.type(within(editor).getByRole('textbox', { name: 'Title' }), '<script>care</script>');
    await user.type(within(editor).getByRole('textbox', { name: 'Details (optional)' }), 'Keep this as plain text.');
    await user.click(within(editor).getByRole('button', { name: 'Choose people' }));
    const picker = screen.getByRole('dialog', { name: 'Choose people to share this request with' });
    expect(picker.querySelector('.rhythm-association-picker--prayer')).toBeTruthy();
    await user.click(within(picker).getByRole('button', { name: 'Morgan Reed' }));
    await user.click(within(picker).getByRole('button', { name: 'Done' }));
    await user.click(within(editor).getByRole('button', { name: 'Save request' }));

    const card = screen.getByRole('listitem');
    expect(within(card).getByText('<script>care</script>')).toBeTruthy();
    expect(within(card).queryByRole('script')).toBeNull();
    expect(within(card).getByRole('group', { name: 'Shared with' })).toBeTruthy();
    expect(within(card).getByRole('img', { name: 'Morgan Reed' })).toBeTruthy();
    const footerSchedule = card.querySelector('.person-prayer-card__footer .rhythm-metadata-schedule-group');
    expect(footerSchedule?.querySelector('.rhythm-metadata-schedule-label')?.textContent).toBe('Daily');
    expect(within(card).getByText('Anytime')).toBeTruthy();
    expect(within(card).getByText('Prayed 0 times')).toBeTruthy();
    expect(within(card).getByLabelText('Last prayed: Not yet')).toBeTruthy();
    const countBadge = within(card).getByText('Prayed 0 times');
    const footer = card.querySelector('.person-prayer-card__footer');
    expect(card.querySelector('.person-prayer-card__actions')?.contains(countBadge)).toBe(true);
    expect(footer?.contains(countBadge)).toBe(false);
    expect(footer?.querySelector('.rhythm-metadata-schedule-group')?.querySelectorAll('svg')).toHaveLength(2);
    expect(document.activeElement).toBe(addButton);
    expect(JSON.parse(screen.getByTestId('requests').textContent ?? '[]')).toMatchObject([
      {
        personId: owner,
        sharedWith: [shared],
        status: 'active',
        schedule: { frequency: 'daily' },
        timeOfDay: 'anytime',
        prayerLogs: []
      }
    ]);

    await user.click(within(card).getByRole('button', {
      name: 'View prayer history for <script>care</script>'
    }));
    let historyDialog = screen.getByRole('dialog', { name: 'Prayer history' });
    const healthSummary = within(historyDialog).getByRole('region', {
      name: 'Health, Consistency, and On Track scores for this prayer request'
    });
    expect(within(healthSummary).getByRole('img', {
      name: 'Health: Not enough data'
    })).toBeTruthy();
    await user.click(within(historyDialog).getByRole('button', { name: 'Close prayer history' }));

    await user.click(within(card).getByRole('button', { name: 'Actions for <script>care</script>' }));
    let menu = screen.getByRole('menu', { name: 'Actions for <script>care</script>' });
    expect(within(menu).getByRole('menuitem', { name: 'Pray' })).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: 'Mark answered' })).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: 'Archive' })).toBeTruthy();
    expect(within(menu).queryByRole('menuitem', { name: 'Details/Edit' })).toBeNull();
    expect(within(menu).queryByRole('menuitem', { name: /Delete/ })).toBeNull();
    await user.click(within(menu).getByRole('menuitem', { name: 'Pray' }));
    let saved = JSON.parse(screen.getByTestId('requests').textContent ?? '[]') as PersonPrayerRequest[];
    expect(saved[0]?.prayerLogs).toHaveLength(1);
    expect(within(screen.getByRole('listitem')).getByText('Prayed 1 time')).toBeTruthy();
    const historyButton = within(screen.getByRole('listitem')).getByRole('button', {
      name: 'View prayer history for <script>care</script>'
    });

    await user.click(historyButton);
    historyDialog = screen.getByRole('dialog', { name: 'Prayer history' });
    const updatedHealthSummary = within(historyDialog).getByRole('region', {
      name: 'Health, Consistency, and On Track scores for this prayer request'
    });
    expect(within(updatedHealthSummary).getByRole('meter', {
      name: 'Health score'
    }).getAttribute('aria-valuenow')).toBe('100');
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

  it('keeps an older missing frequency unset until the user chooses one', async () => {
    const user = userEvent.setup();
    const legacyRequest: PersonPrayerRequest = {
      id: 'legacy-unscheduled-request',
      personId: owner,
      title: 'Older request',
      status: 'active',
      createdAt,
      updatedAt: createdAt,
      prayerLogs: [{ id: 'legacy-log', prayedAt: '2026-10-31T10:00:00.000Z' }]
    };
    render(<PrayerHarness initialRequests={[legacyRequest]} />);

    const card = screen.getByRole('article', { name: legacyRequest.title });
    expect(card.querySelector('.person-prayer-card__footer .rhythm-metadata-schedule-group')).toBeNull();
    await user.click(within(card).getByRole('button', { name: `View prayer history for ${legacyRequest.title}` }));
    const historyDialog = screen.getByRole('dialog', { name: 'Prayer history' });
    const historySummary = within(historyDialog).getByRole('article', { name: legacyRequest.title });
    expect(within(historySummary).getByText('Prayer frequency not set')).toBeTruthy();
    expect(historySummary.querySelector('.person-prayer-card__footer .rhythm-metadata-schedule-group')).toBeNull();
    await user.click(within(historyDialog).getByRole('button', { name: 'Close prayer history' }));

    await user.click(within(card).getByRole('button', { name: 'Set prayer frequency' }));
    const editor = screen.getByRole('dialog', { name: 'Prayer request details' });
    expect(within(editor).getByRole('combobox', { name: 'Frequency: Choose frequency' })).toBeTruthy();
    expect(within(editor).getByText('Set prayer frequency to include this request in Prayer Health.')).toBeTruthy();
    expect((JSON.parse(screen.getByTestId('requests').textContent ?? '[]') as PersonPrayerRequest[])[0]?.schedule)
      .toBeUndefined();

    await user.click(within(editor).getByRole('combobox', { name: 'Frequency: Choose frequency' }));
    await user.click(within(editor).getByRole('option', { name: 'Weekly' }));
    await user.click(within(editor).getByRole('radio', { name: 'Sunday' }));
    await user.click(within(editor).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect((JSON.parse(screen.getByTestId('requests').textContent ?? '[]') as PersonPrayerRequest[])[0])
        .toMatchObject({ schedule: { frequency: 'weekly', weekdays: [0] } });
    });
  });

  it('retains the unsaved Prayer schedule after an edit persistence failure', async () => {
    const user = userEvent.setup();
    const legacyRequest: PersonPrayerRequest = {
      id: 'legacy-unscheduled-request',
      personId: owner,
      title: 'Older request',
      status: 'active',
      createdAt,
      updatedAt: createdAt,
      prayerLogs: [{ id: 'legacy-log', prayedAt: '2026-10-31T10:00:00.000Z' }]
    };
    render(<PrayerHarness initialRequests={[legacyRequest]} failUpdate />);

    const card = screen.getByRole('article', { name: legacyRequest.title });
    await user.click(within(card).getByRole('button', { name: 'Set prayer frequency' }));
    const editor = screen.getByRole('dialog', { name: 'Prayer request details' });
    const frequency = within(editor).getByRole('combobox', { name: 'Frequency: Choose frequency' });
    await user.click(frequency);
    await user.click(within(editor).getByRole('option', { name: 'Weekly' }));
    await user.click(within(editor).getByRole('radio', { name: 'Sunday' }));
    await user.click(within(editor).getByRole('button', { name: 'Save changes' }));

    expect(within(editor).getByRole('alert').textContent).toBe('Preview storage changed. No request was saved.');
    expect(within(editor).getByRole('combobox', { name: 'Frequency: Weekly' })).toBeTruthy();
    const saved = JSON.parse(screen.getByTestId('requests').textContent ?? '[]') as PersonPrayerRequest[];
    expect(saved[0]?.schedule).toBeUndefined();
  });

  it('retains the editor draft when persistence fails and closes cleanly on Escape or Cancel', async () => {
    const user = userEvent.setup();
    render(<PrayerHarness failCreate />);
    const addButton = screen.getByRole('button', { name: 'Add request' });
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
      name: `View prayer history for ${request.title}`
    });
    expect(within(card).getByText('Prayed 5 times')).toBeTruthy();
    expect(within(card).getByLabelText('Last prayed: Today')).toBeTruthy();
    await user.click(historyButton);
    const dialog = screen.getByRole('dialog', { name: 'Prayer history' });
    expect(within(dialog).getByText('2 times prayed · last 30 days')).toBeTruthy();
    expect(within(dialog).getByText(/1 historical prayer has no saved date/)).toBeTruthy();
    expect(within(dialog).getByText(/1 future-dated record is excluded/)).toBeTruthy();
    expect(within(dialog).getByText('Context for this synthetic history.')).toBeTruthy();
    const chart = within(dialog).getByRole('region', {
      name: 'Prayer history chart; scroll horizontally for older dates'
    });

    const recordedColumn = within(chart).getByRole('listitem', { name: /October 1, 2026: 1 prayer/ });
    const todayColumn = within(chart).getByRole('listitem', { name: /October 31, 2026: 1 prayer, today/ });
    expect(recordedColumn.querySelector('.rhythm-history-view__completion-bar')).toBeTruthy();
    expect(todayColumn.getAttribute('data-today')).toBe('true');
    expect(todayColumn.querySelector('.rhythm-history-view__completion-bar')).toBeTruthy();
    expect(within(chart).queryByRole('listitem', { name: /November 1, 2026/ })).toBeNull();
    expect(chart.parentElement?.getAttribute('data-theme')).toBe('prayer');
    await user.click(within(dialog).getByRole('button', { name: 'Close prayer history' }));
    await waitFor(() => expect(document.activeElement).toBe(historyButton));
  });

  it('updates total prayer count and Rhythm-formatted date when history changes', () => {
    const baseRequest: PersonPrayerRequest = {
      id: 'prayer-footer-history',
      personId: owner,
      sharedWith: [],
      title: 'Footer history',
      details: '',
      status: 'active',
      createdAt,
      updatedAt: createdAt,
      prayerLogs: []
    };
    const renderCard = (request: PersonPrayerRequest) => (
      <PersonPrayerCard
        request={request}
        person={people[0]!}
        owner={people[0]!}
        sharedPeople={[]}
        today="2026-10-31"
        timeZone="UTC"
        onPray={() => {}}
        onTransition={() => {}}
        onEdit={() => {}}
      />
    );
    const { rerender } = render(renderCard(baseRequest));
    const card = () => screen.getByRole('article', { name: 'Footer history' });
    expect(within(card()).getByText('Prayed 0 times')).toBeTruthy();
    expect(within(card()).getByLabelText('Last prayed: Not yet')).toBeTruthy();

    const threePrayers = {
      ...baseRequest,
      prayerLogs: [
        { id: 'old', prayedAt: '2025-10-20T12:00:00.000Z' },
        { id: 'recent', prayedAt: '2026-10-30T12:00:00.000Z' },
        { id: 'latest', prayedAt: '2026-10-31T12:00:00.000Z' }
      ]
    };
    rerender(renderCard(threePrayers));
    expect(within(card()).getByText('Prayed 3 times')).toBeTruthy();
    expect(within(card()).getByLabelText('Last prayed: Today')).toBeTruthy();

    rerender(renderCard({
      ...threePrayers,
      prayerLogs: threePrayers.prayerLogs.slice(0, 2)
    }));
    expect(within(card()).getByText('Prayed 2 times')).toBeTruthy();
    expect(within(card()).getByLabelText('Last prayed: Oct 30')).toBeTruthy();
  });

  it('uses the shared schedule footer in the request-history summary without losing its count badge', async () => {
    const user = userEvent.setup();
    const request: PersonPrayerRequest = {
      id: 'prayer-long-schedule',
      personId: owner,
      sharedWith: [],
      title: 'Long schedule',
      details: '',
      status: 'active',
      createdAt,
      updatedAt: createdAt,
      schedule: {
        frequency: 'custom',
        unit: 'weeks',
        interval: 2,
        weekdays: [1, 3, 5],
        startDate: '2026-01-05',
        endDate: '2026-12-31'
      },
      timeOfDay: 'afternoon',
      prayerLogs: []
    };
    render(
      <PersonPrayerCard
        request={request}
        person={people[0]!}
        owner={people[0]!}
        sharedPeople={[]}
        today="2026-10-31"
        timeZone="UTC"
        onPray={() => {}}
        onTransition={() => {}}
        onEdit={() => {}}
      />
    );

    const card = screen.getByRole('article', { name: request.title });
    const footer = card.querySelector('.person-prayer-card__footer');
    const schedule = footer?.querySelector('.rhythm-metadata-schedule-group');
    expect(schedule?.querySelectorAll('svg')).toHaveLength(2);
    expect(schedule?.querySelector('.rhythm-metadata-schedule-label')?.textContent)
      .toBe('Every 2 weeks · M · W · F');
    expect(within(footer as HTMLElement).getByText('Afternoon')).toBeTruthy();
    expect(card.querySelector('.person-prayer-card__schedule')).toBeNull();
    expect(within(card).getByText('Prayed 0 times').parentElement?.classList.contains('person-prayer-card__actions'))
      .toBe(true);

    await user.click(within(card).getByRole('button', { name: 'View prayer history for Long schedule' }));
    const dialog = screen.getByRole('dialog', { name: 'Prayer history' });
    const summary = within(dialog).getByRole('article', { name: request.title });
    const summaryFooter = summary.querySelector('.person-prayer-card__footer');
    expect(summaryFooter?.querySelector('.rhythm-metadata-schedule-label')?.textContent)
      .toBe('Every 2 weeks · M · W · F');
    expect(within(summaryFooter as HTMLElement).getByText('Afternoon')).toBeTruthy();
    const summaryCount = within(summary).getByText('Prayed 0 times');
    expect(summary.querySelector('.person-prayer-card__count-row')?.contains(summaryCount)).toBe(true);
    expect(summaryFooter?.contains(summaryCount)).toBe(false);
  });

  it('supports editing, canceling, deletion confirmation, and focus fallback after removal', async () => {
    const user = userEvent.setup();
    render(<PrayerHarness />);
    const addButton = screen.getByRole('button', { name: 'Add request' });
    await user.click(addButton);
    let editor = screen.getByRole('dialog', { name: 'Add prayer request' });
    await user.type(within(editor).getByRole('textbox', { name: 'Title' }), 'First request');
    await user.click(within(editor).getByRole('button', { name: 'Save request' }));

    async function openRequestEditor(title: string) {
      const card = screen.getByRole('article', { name: title });
      await user.click(within(card).getByRole('button', {
        name: `View prayer history for ${title}`
      }));
      const history = screen.getByRole('dialog', { name: 'Prayer history' });
      await user.click(within(history).getByRole('button', {
        name: `Edit prayer request ${title}`
      }));
      return screen.getByRole('dialog', { name: 'Prayer request details' });
    }

    editor = await openRequestEditor('First request');
    const title = within(editor).getByRole('textbox', { name: 'Title' });
    await user.clear(title);
    await user.type(title, 'Unsaved title');
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('dialog', { name: 'Prayer history' })).toBeTruthy();
    await user.click(within(screen.getByRole('dialog', { name: 'Prayer history' }))
      .getByRole('button', { name: 'Close prayer history' }));
    expect(screen.getByRole('article', { name: 'First request' })).toBeTruthy();

    editor = await openRequestEditor('First request');
    await user.clear(within(editor).getByRole('textbox', { name: 'Title' }));
    await user.type(within(editor).getByRole('textbox', { name: 'Title' }), 'Updated request');
    await user.click(within(editor).getByRole('button', { name: 'Save changes' }));
    expect(screen.getAllByRole('article', { name: 'Updated request' })).toHaveLength(2);
    expect(screen.getByRole('dialog', { name: 'Prayer history' })).toBeTruthy();
    await user.click(within(screen.getByRole('dialog', { name: 'Prayer history' }))
      .getByRole('button', { name: 'Close prayer history' }));

    editor = await openRequestEditor('Updated request');
    await user.click(within(editor).getByRole('button', { name: 'Delete Updated request' }));
    const confirmation = screen.getByRole('dialog', { name: 'Delete this request?' });
    expect(within(confirmation).getByText(/permanently deletes the request and its prayer history/)).toBeTruthy();
    await user.click(within(confirmation).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('article', { name: 'Updated request' })).toBeTruthy();

    editor = await openRequestEditor('Updated request');
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
      name: 'View prayer history for Empty history'
    }));
    const dialog = screen.getByRole('dialog', { name: 'Prayer history' });
    expect(within(dialog).getByText('No prayer history is recorded for this request yet.')).toBeTruthy();
    const todayColumn = within(dialog).getByRole('listitem', { name: /no prayer recorded yet, today/ });
    expect(todayColumn.getAttribute('data-today')).toBe('true');
    expect(todayColumn.querySelector('.rhythm-history-view__completion-zero')).toBeTruthy();
    expect(todayColumn.querySelector('.rhythm-history-view__completion-bar')).toBeNull();
    expect(within(dialog).getByRole('region', {
      name: 'Prayer history chart; scroll horizontally for older dates'
    }).parentElement?.getAttribute('data-theme')).toBe('prayer');
  });

  it('adds, edits, deletes, and restores logged prayers without losing identity or timestamp precision', async () => {
    const user = userEvent.setup();
    const request: PersonPrayerRequest = {
      id: 'prayer-log-lifecycle',
      personId: owner,
      title: 'Lifecycle request',
      status: 'active',
      schedule: { frequency: 'daily' },
      timeOfDay: 'anytime',
      createdAt,
      updatedAt: createdAt,
      prayerLogs: [{
        id: 'existing-prayer-log',
        prayedAt: new Date(Date.now() - 86_400_000 + 789).toISOString(),
        notes: 'Original note'
      }]
    };
    render(<PrayerHarness initialRequests={[request]} />);
    const card = screen.getByRole('article', { name: request.title });
    await user.click(within(card).getByRole('button', {
      name: `View prayer history for ${request.title}`
    }));
    const history = screen.getByRole('dialog', { name: 'Prayer history' });
    const health = within(history).getByRole('region', {
      name: 'Health, Consistency, and On Track scores for this prayer request'
    });
    expect(within(health).getByRole('heading', { name: 'Health' })).toBeTruthy();
    expect(within(health).queryByText(/Avery Brooks.*Prayer Health/)).toBeNull();
    const healthDisclosure = within(health).getByRole('button', {
      name: 'Show Health Consistency and On Track breakdown'
    });
    await user.click(healthDisclosure);
    expect(within(health).getByRole('group', { name: 'Consistency and On Track' })).toBeTruthy();
    expect(within(health).getByText('Follow-through over time')).toBeTruthy();
    await user.click(within(health).getByRole('button', {
      name: 'Hide Health Consistency and On Track breakdown'
    }));
    await user.click(within(health).getByRole('button', {
      name: 'Show Consistency and On Track score details'
    }));
    const healthDetails = screen.getByRole('dialog', { name: 'Prayer Health details' });
    expect(within(healthDetails).getByText('How this prayer request was scored')).toBeTruthy();
    expect(within(healthDetails).getByRole('heading', { name: 'Consistency' })).toBeTruthy();
    expect(within(healthDetails).getByRole('heading', { name: 'On Track' })).toBeTruthy();
    await user.click(within(healthDetails).getByRole('button', {
      name: 'Back to prayer request details'
    }));
    expect(screen.queryByRole('dialog', { name: 'Prayer Health details' })).toBeNull();
    const loggedPrayers = within(history).getByRole('button', { name: 'Logged prayers (1)' });
    await user.click(loggedPrayers);
    expect(within(history).getByText('Original note')).toBeTruthy();

    await user.click(within(history).getByRole('button', { name: /Edit logged prayer/ }));
    const editForm = within(history).getByRole('heading', { name: 'Edit logged prayer' }).closest('form');
    expect(editForm).not.toBeNull();
    const dateField = within(editForm as HTMLElement).getByLabelText('Date') as HTMLInputElement;
    expect(dateField.value).not.toBe('');
    await user.clear(within(editForm as HTMLElement).getByRole('textbox', { name: /Notes/ }));
    await user.type(within(editForm as HTMLElement).getByRole('textbox', { name: /Notes/ }), 'Updated note');
    await user.clear(dateField);
    await user.type(dateField, localDateString(new Date(Date.now() - 2 * 86_400_000)));
    await user.click(within(editForm as HTMLElement).getByRole('button', { name: 'Save changes' }));
    let saved = JSON.parse(screen.getByTestId('requests').textContent ?? '[]') as PersonPrayerRequest[];
    expect(saved[0]?.prayerLogs).toMatchObject([{
      id: 'existing-prayer-log',
      notes: 'Updated note'
    }]);
    expect(saved[0]?.prayerLogs[0]?.prayedAt).toMatch(/\.\d{3}Z$/);

    const addButton = within(history).getByRole('button', { name: '+ Log a prayer' });
    await user.click(addButton);
    const addForm = within(history).getByRole('heading', { name: 'Log a prayer' }).closest('form');
    expect(addForm).not.toBeNull();
    expect((within(addForm as HTMLElement).getByLabelText('Date') as HTMLInputElement).value)
      .toBe(localDateString(new Date()));
    await user.click(within(addForm as HTMLElement).getByRole('button', { name: 'Save prayer' }));
    saved = JSON.parse(screen.getByTestId('requests').textContent ?? '[]') as PersonPrayerRequest[];
    expect(saved[0]?.prayerLogs).toHaveLength(2);
    expect(saved[0]?.prayerLogs[1]?.prayedAt).toBeTruthy();
    expect(within(history).getByRole('button', { name: 'Logged prayers (2)' })).toBeTruthy();

    await user.click(within(history).getAllByRole('button', { name: /Delete logged prayer/ })[0]!);
    const confirmation = within(history).getByRole('alertdialog');
    await user.click(within(confirmation).getByRole('button', { name: 'Delete prayer' }));
    saved = JSON.parse(screen.getByTestId('requests').textContent ?? '[]') as PersonPrayerRequest[];
    expect(saved[0]?.prayerLogs).toHaveLength(1);
    await user.click(within(history).getByRole('button', { name: 'Undo' }));
    saved = JSON.parse(screen.getByTestId('requests').textContent ?? '[]') as PersonPrayerRequest[];
    expect(saved[0]?.prayerLogs).toHaveLength(2);
    expect(saved[0]?.prayerLogs[0]).toMatchObject({
      id: 'existing-prayer-log',
      notes: 'Updated note'
    });
  });

  it('keeps entered prayer-log edits after a failed persistence attempt', async () => {
    const user = userEvent.setup();
    const request: PersonPrayerRequest = {
      id: 'prayer-log-save-failure',
      personId: owner,
      title: 'Save failure',
      status: 'active',
      createdAt,
      updatedAt: createdAt,
      prayerLogs: [{ id: 'existing-log', prayedAt: new Date(Date.now() - 86_400_000).toISOString() }]
    };
    render(<PrayerHarness initialRequests={[request]} failSaveLog />);
    await user.click(within(screen.getByRole('article', { name: request.title })).getByRole('button', {
      name: `View prayer history for ${request.title}`
    }));
    const history = screen.getByRole('dialog', { name: 'Prayer history' });
    await user.click(within(history).getByRole('button', { name: 'Logged prayers (1)' }));
    await user.click(within(history).getByRole('button', { name: /Edit logged prayer/ }));
    const editForm = within(history).getByRole('heading', { name: 'Edit logged prayer' }).closest('form')!;
    const notes = within(editForm).getByRole('textbox', { name: /Notes/ }) as HTMLTextAreaElement;
    await user.type(notes, 'Keep this draft');
    await user.click(within(editForm).getByRole('button', { name: 'Save changes' }));
    expect(within(editForm).getByRole('alert').textContent)
      .toBe('Preview storage changed. No prayer entry was saved.');
    expect(notes.value).toBe('Keep this draft');
    expect((JSON.parse(screen.getByTestId('requests').textContent ?? '[]') as PersonPrayerRequest[])[0]?.prayerLogs)
      .toEqual(request.prayerLogs);
  });
});
