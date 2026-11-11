import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { PersonPrayerPanel } from '../src/components/PersonPrayerPanel.tsx';
import {
  createPersonPrayerRequest,
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
  failCreate = false
}: {
  failCreate?: boolean;
}) {
  const [requests, setRequests] = useState<PersonPrayerRequest[]>([]);
  const peopleIds = people.map(person => person.id);
  const nextTimestamp = (id: string) => new Date(
    Date.parse(requests.find(request => request.id === id)?.updatedAt ?? createdAt) + 60_000
  ).toISOString();
  return (
    <>
      <PersonPrayerPanel
        personId={owner}
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
            schedule: draft.schedule,
            timeOfDay: draft.timeOfDay,
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
        onRemove={(id, _expectedUpdatedAt, actorId) => {
          const request = requests.find(item => item.id === id);
          if (!request || request.personId !== actorId) return 'Only the owner can delete.';
          setRequests([]);
          return null;
        }}
      />
      <output data-testid="requests">{JSON.stringify(requests)}</output>
    </>
  );
}

describe('shared Person Prayer panel', () => {
  it('offers the complete Classic time-of-day option list in order', async () => {
    const user = userEvent.setup();
    render(<PrayerHarness />);
    await user.click(screen.getByRole('button', { name: 'Add prayer request' }));
    const editor = screen.getByRole('dialog', { name: 'Add prayer request' });
    await user.click(within(editor).getByRole('combobox', { name: /Time of day/ }));
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map(option => option.textContent))
      .toEqual([
        'Anytime',
        'All day',
        'Early morning',
        'Morning',
        'Lunch',
        'Afternoon',
        'Way home',
        'Evening',
        'Bedtime'
      ]);
  });

  it('creates a shared plain-text request, independently logs Prayed, and transitions without extra logs', async () => {
    const user = userEvent.setup();
    render(<PrayerHarness />);
    expect(screen.getByText('No prayer requests for Avery Brooks yet.')).toBeTruthy();

    const addButton = screen.getByRole('button', { name: 'Add prayer request' });
    await user.click(addButton);
    const editor = screen.getByRole('dialog', { name: 'Add prayer request' });
    await user.type(within(editor).getByRole('textbox', { name: 'Title' }), '<script>care</script>');
    await user.type(within(editor).getByRole('textbox', { name: 'Details (optional)' }), 'Keep this as plain text.');
    await user.click(within(editor).getByRole('combobox', { name: /Frequency/ }));
    await user.click(screen.getByRole('option', { name: 'Weekly' }));
    await user.click(within(editor).getByRole('radio', { name: 'Monday' }));
    await user.click(within(editor).getByRole('combobox', { name: /Time of day/ }));
    await user.click(screen.getByRole('option', { name: 'Morning' }));
    await user.click(within(editor).getByRole('button', { name: 'Choose people' }));
    const picker = screen.getByRole('dialog', { name: 'Choose people to share this request with' });
    await user.click(within(picker).getByRole('button', { name: 'Morgan Reed' }));
    await user.click(within(picker).getByRole('button', { name: 'Done' }));
    await user.click(within(editor).getByRole('button', { name: 'Save request' }));

    const card = screen.getByRole('listitem');
    expect(within(card).getByText('<script>care</script>')).toBeTruthy();
    expect(within(card).queryByRole('script')).toBeNull();
    expect(within(card).getByText('Shared with Morgan Reed')).toBeTruthy();
    expect(document.activeElement).toBe(addButton);
    expect(JSON.parse(screen.getByTestId('requests').textContent ?? '[]')).toMatchObject([
      {
        personId: owner,
        sharedWith: [shared],
        status: 'active',
        schedule: { frequency: 'weekly', weekdays: [1] },
        timeOfDay: 'morning',
        prayerLogs: []
      }
    ]);

    await user.click(within(card).getByRole('button', { name: 'Prayed' }));
    let saved = JSON.parse(screen.getByTestId('requests').textContent ?? '[]') as PersonPrayerRequest[];
    expect(saved[0]?.prayerLogs).toHaveLength(1);
    expect(within(screen.getByRole('listitem')).getByText(/Prayed 1 time · Last prayed/)).toBeTruthy();

    await user.click(within(screen.getByRole('listitem')).getByRole('button', { name: 'Answer' }));
    saved = JSON.parse(screen.getByTestId('requests').textContent ?? '[]') as PersonPrayerRequest[];
    expect(saved[0]?.status).toBe('answered');
    expect(saved[0]?.prayerLogs).toHaveLength(1);
    await user.click(within(screen.getByRole('listitem')).getByRole('button', { name: 'Reopen' }));
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
});
