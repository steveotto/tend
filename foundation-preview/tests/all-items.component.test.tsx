import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AllItemsPage } from '../src/components/AllItemsPage.tsx';
import { createPersonPickerGroups, createSamplePeople, todayRhythms } from '../src/domain/preview-data.ts';
import type { PersonId, RhythmPreview } from '../src/domain/preview-data.ts';
import type { PersonPrayerRequest } from '../src/domain/person-prayers.ts';
import type { PersonSpark } from '../src/domain/person-sparks.ts';
import { createSamplePreviewData } from '../src/domain/preview-state.ts';

afterEach(cleanup);

const people = createSamplePeople();
const owner: PersonId = people[0]!.id;
const rhythm: RhythmPreview = {
  id: 'all-items-rhythm',
  title: 'All items rhythm',
  automation: todayRhythms[0]!.automation,
  status: 'Not confirmed',
  personIds: [owner],
  schedule: { frequency: 'daily' },
  timeOfDay: 'morning'
};
const archivedSpark: PersonSpark = {
  id: 'all-items-archived-spark',
  ownerId: owner,
  title: 'Archived Spark',
  sharedWith: [],
  archived: true,
  completed: false,
  completionHistory: []
};
const completedSpark: PersonSpark = {
  id: 'all-items-completed-spark',
  ownerId: owner,
  title: 'Completed Spark',
  sharedWith: [],
  archived: false,
  completed: true,
  completionHistory: [{ id: 'completion-1', source: 'legacy', date: '2026-10-30' }]
};
const archivedPrayer: PersonPrayerRequest = {
  id: 'all-items-archived-prayer',
  personId: owner,
  title: 'Archived request',
  status: 'archived',
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-31T12:00:00.000Z',
  archivedAt: '2026-10-31T12:00:00.000Z',
  prayerLogs: []
};
const sampleData = createSamplePreviewData();

function pageProps<T extends object = {}>(overrides?: T) {
  return {
    rhythms: [rhythm],
    completedRhythmIds: new Set<string>(),
    archivedRhythmIds: [],
    sparks: [],
    prayerRequests: [],
    people,
    peopleGroups: createPersonPickerGroups(),
    foundations: [],
    friendships: sampleData.friendships,
    today: '2026-10-31',
    timeZone: 'UTC',
    prayerEnabled: true,
    onEditRhythm: vi.fn(),
    onTendRhythm: vi.fn(),
    onUndoRhythm: vi.fn(),
    onPersonSelect: vi.fn(),
    onOpenCategory: vi.fn(),
    onOpenFoundation: vi.fn(),
    onCreateSpark: vi.fn(),
    onUpdateSpark: vi.fn(),
    onArchiveSpark: vi.fn(),
    onDeleteSpark: vi.fn(),
    onUndoSpark: vi.fn(),
    onCompleteSpark: vi.fn(),
    onCreatePrayerRequest: vi.fn(),
    onUpdatePrayerRequest: vi.fn(),
    onPrayerRequestTransition: vi.fn(),
    onPrayForRequest: vi.fn(),
    onRemovePrayerRequest: vi.fn(),
    ...overrides
  };
}

describe('All items page', () => {
  it('retains every supported status in the type groups', async () => {
    const user = userEvent.setup();
    render(<AllItemsPage {...pageProps({
      completedRhythmIds: new Set([rhythm.id]),
      archivedRhythmIds: [rhythm.id],
      sparks: [archivedSpark, completedSpark],
      prayerRequests: [archivedPrayer]
    })} />);

    expect(screen.getByText('Archived', { selector: '.rhythm-archived-badge' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Expand Spark Archived Spark' }));
    await user.click(screen.getByRole('button', { name: 'Expand Spark Completed Spark' }));
    expect(screen.getByText('Archived', { selector: '.person-spark-card__status' })).toBeTruthy();
    expect(screen.getByText(/Completed/, { selector: '.person-spark-card__status' })).toBeTruthy();
    expect(screen.getByText('Archived', { selector: '.person-prayer-card__status' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('4 items');
  });

  it('keeps filters and refreshed results after the existing Rhythm editor is opened', async () => {
    const user = userEvent.setup();
    const onEditRhythm = vi.fn();
    const originalProps = pageProps({ onEditRhythm });
    const view = render(<AllItemsPage {...originalProps} />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'rhythms');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Person' }), owner);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Frequency' }), 'daily');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Time of day' }), 'morning');
    await user.click(screen.getByRole('button', { name: 'Edit All items rhythm' }));

    expect(onEditRhythm).toHaveBeenCalledOnce();
    expect((screen.getByRole('combobox', { name: 'Type' }) as HTMLSelectElement).value).toBe('rhythms');
    expect((screen.getByRole('combobox', { name: 'Person' }) as HTMLSelectElement).value).toBe(owner);
    expect((screen.getByRole('combobox', { name: 'Frequency' }) as HTMLSelectElement).value).toBe('daily');
    expect((screen.getByRole('combobox', { name: 'Time of day' }) as HTMLSelectElement).value).toBe('morning');

    const renamedRhythm = { ...rhythm, title: 'Updated rhythm title' };
    view.rerender(<AllItemsPage {...pageProps({
      rhythms: [renamedRhythm],
      onEditRhythm
    })} />);

    expect(screen.getByRole('heading', { name: 'Updated rhythm title' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('1 item');
    expect((screen.getByRole('combobox', { name: 'Person' }) as HTMLSelectElement).value).toBe(owner);
  });

  it('keeps filters and refreshed results after the existing Spark editor is opened', async () => {
    const user = userEvent.setup();
    const spark: PersonSpark = {
      id: 'all-items-spark',
      ownerId: owner,
      title: 'All items Spark',
      sharedWith: [],
      archived: false,
      completed: false,
      completionHistory: []
    };
    const onUpdateSpark = vi.fn(() => null);
    const view = render(<AllItemsPage {...pageProps({
      rhythms: [],
      sparks: [spark],
      onUpdateSpark
    })} />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'sparks');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Person' }), owner);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Frequency' }), 'not-scheduled');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Time of day' }), 'not-applicable');
    const card = screen.getByRole('article', { name: 'All items Spark' });
    await user.click(within(card).getByRole('button', { name: 'Expand Spark All items Spark' }));
    await user.click(within(card).getByRole('button', { name: 'Edit Spark' }));
    const editor = screen.getByRole('dialog', { name: 'Edit Spark' });
    await user.clear(within(editor).getByLabelText('Title'));
    await user.type(within(editor).getByLabelText('Title'), 'Updated All items Spark');
    await user.click(within(editor).getByRole('button', { name: 'Save changes' }));

    expect(onUpdateSpark).toHaveBeenCalledOnce();
    expect((screen.getByRole('combobox', { name: 'Type' }) as HTMLSelectElement).value).toBe('sparks');
    expect((screen.getByRole('combobox', { name: 'Person' }) as HTMLSelectElement).value).toBe(owner);
    expect((screen.getByRole('combobox', { name: 'Frequency' }) as HTMLSelectElement).value)
      .toBe('not-scheduled');
    expect((screen.getByRole('combobox', { name: 'Time of day' }) as HTMLSelectElement).value)
      .toBe('not-applicable');

    view.rerender(<AllItemsPage {...pageProps({
      rhythms: [],
      sparks: [{ ...spark, title: 'Updated All items Spark' }],
      onUpdateSpark
    })} />);
    expect(screen.getByRole('article', { name: 'Updated All items Spark' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('1 item');
  });

  it('edits an account Prayer with no Person association without assigning an owner', async () => {
    const user = userEvent.setup();
    const request: PersonPrayerRequest = {
      id: 'all-items-account-prayer',
      personId: null,
      sharedWith: [],
      title: 'Account-level request',
      status: 'active',
      createdAt: '2026-10-01T12:00:00.000Z',
      updatedAt: '2026-10-31T12:00:00.000Z',
      prayerLogs: []
    };
    const onUpdatePrayerRequest = vi.fn(() => null);
    const props = pageProps({
      rhythms: [],
      prayerRequests: [request],
      onUpdatePrayerRequest
    });
    const view = render(<AllItemsPage {...props} />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'prayer-requests');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Person' }), 'none');
    expect(within(screen.getByRole('group', { name: 'Person association' })).getByText('No person')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('1 item');

    await user.click(screen.getByRole('button', { name: 'View prayer history for Account-level request' }));
    await user.click(screen.getByRole('button', { name: 'Edit prayer request Account-level request' }));
    expect(screen.getByRole('dialog', { name: 'Prayer request details' })).toBeTruthy();
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Updated account request');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(onUpdatePrayerRequest).toHaveBeenCalledWith(
      request.id,
      request.updatedAt,
      null,
      expect.objectContaining({ title: 'Updated account request', sharedWith: [] })
    );
    expect((screen.getByRole('combobox', { name: 'Type' }) as HTMLSelectElement).value)
      .toBe('prayer-requests');
    expect((screen.getByRole('combobox', { name: 'Person' }) as HTMLSelectElement).value)
      .toBe('none');

    view.rerender(<AllItemsPage {...pageProps({
      rhythms: [],
      prayerRequests: [{ ...request, title: 'Updated account request' }],
      onUpdatePrayerRequest
    })} />);
    expect(screen.getAllByRole('heading', { name: 'Updated account request' })).toHaveLength(2);
    expect(screen.getByRole('status').textContent).toContain('1 item');
  });

  it('keeps the existing delete action available for a Prayer with no Person association', async () => {
    const user = userEvent.setup();
    const request: PersonPrayerRequest = {
      id: 'all-items-delete-account-prayer',
      personId: null,
      sharedWith: [],
      title: 'Account Prayer to delete',
      status: 'active',
      createdAt: '2026-10-01T12:00:00.000Z',
      updatedAt: '2026-10-31T12:00:00.000Z',
      prayerLogs: []
    };
    const onRemovePrayerRequest = vi.fn(() => null);
    render(<AllItemsPage {...pageProps({
      rhythms: [],
      prayerRequests: [request],
      onRemovePrayerRequest
    })} />);

    await user.click(screen.getByRole('button', {
      name: 'View prayer history for Account Prayer to delete'
    }));
    await user.click(screen.getByRole('button', {
      name: 'Edit prayer request Account Prayer to delete'
    }));
    const editor = screen.getByRole('dialog', { name: 'Prayer request details' });
    await user.click(within(editor).getByRole('button', { name: 'Delete Account Prayer to delete' }));
    const confirmation = screen.getByRole('dialog', { name: 'Delete this request?' });
    await user.click(within(confirmation).getByRole('button', { name: 'Delete request' }));

    expect(onRemovePrayerRequest).toHaveBeenCalledWith(
      request.id,
      request.updatedAt,
      null
    );
  });

  it('combines filters and displays the no-match guidance with a clear action', async () => {
    const user = userEvent.setup();
    render(<AllItemsPage {...pageProps()} />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'sparks');

    expect(screen.getByRole('status').textContent).toContain('0 items');
    expect(screen.getByText('No items match these filters. Clear filters to see everything.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect((screen.getByRole('combobox', { name: 'Type' }) as HTMLSelectElement).value).toBe('all');
  });

  it('distinguishes Anytime from an unset Prayer time in the filter and shared card', async () => {
    const user = userEvent.setup();
    const noTimeRequest: PersonPrayerRequest = {
      id: 'all-items-prayer-no-time',
      personId: null,
      sharedWith: [],
      title: 'Prayer with no time',
      status: 'active',
      schedule: { frequency: 'daily' },
      createdAt: '2026-10-01T12:00:00.000Z',
      updatedAt: '2026-10-31T12:00:00.000Z',
      prayerLogs: []
    };
    const anytimeRequest: PersonPrayerRequest = {
      ...noTimeRequest,
      id: 'all-items-prayer-anytime',
      title: 'Anytime prayer',
      timeOfDay: 'anytime'
    };
    render(<AllItemsPage {...pageProps({
      rhythms: [],
      prayerRequests: [noTimeRequest, anytimeRequest]
    })} />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'prayer-requests');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Time of day' }), 'not-applicable');
    expect(screen.getByRole('status').textContent).toContain('1 item');
    expect(screen.getByRole('article', { name: 'Prayer with no time' })).toBeTruthy();
    expect(screen.getByText('Time of day not set')).toBeTruthy();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Time of day' }), 'anytime');
    expect(screen.getByRole('status').textContent).toContain('1 item');
    const anytimeCard = screen.getByRole('article', { name: 'Anytime prayer' });
    expect(screen.queryByRole('article', { name: 'Prayer with no time' })).toBeNull();
    expect(within(anytimeCard).getByText('Anytime')).toBeTruthy();
  });
});
