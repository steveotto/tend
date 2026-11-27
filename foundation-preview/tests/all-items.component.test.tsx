import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AllItemsPage } from '../src/components/AllItemsPage.tsx';
import {
  createPersonPickerGroups,
  createSamplePeople,
  foundationCatalogue,
  todayRhythms
} from '../src/domain/preview-data.ts';
import type { PersonId, RhythmPreview } from '../src/domain/preview-data.ts';
import type { PersonPrayerRequest } from '../src/domain/person-prayers.ts';
import type { PersonSpark } from '../src/domain/person-sparks.ts';
import { createSamplePreviewData } from '../src/domain/preview-state.ts';

afterEach(cleanup);

const people = createSamplePeople();
const owner: PersonId = people[0]!.id;

async function selectFilterOptions(
  user: ReturnType<typeof userEvent.setup>,
  filterName: string,
  optionNames: readonly string[]
) {
  const groupName = `${filterName} options`;
  if (!screen.queryByRole('group', { name: groupName })) {
    await user.click(screen.getByRole('button', { name: new RegExp(`^${filterName}:`) }));
  }
  const group = screen.getByRole('group', { name: groupName });
  for (const optionName of optionNames) {
    const option = within(group).getByRole('checkbox', { name: optionName });
    if (!(option as HTMLInputElement).checked) await user.click(option);
  }
}

async function selectSortOption(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  option: string
) {
  await user.click(screen.getByRole('combobox', { name: new RegExp(`^${label}:`) }));
  await user.click(screen.getByRole('option', { name: option }));
}

function sortedCardTitles(): string[] {
  const sortedItems = screen.getByRole('region', { name: 'Sorted all items' });
  return [...sortedItems.querySelectorAll('article')].map(card =>
    card.querySelector('[role="heading"], h3')?.textContent ?? ''
  );
}

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
    rhythmScores: new Map(),
    people,
    peopleGroups: createPersonPickerGroups(),
    foundations: [],
    friendships: sampleData.friendships,
    today: '2026-10-31',
    timeZone: 'UTC',
    prayerEnabled: true,
    onRhythmHistory: vi.fn(),
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
  it('excludes archived Rhythms but retains other supported statuses', async () => {
    const user = userEvent.setup();
    render(<AllItemsPage {...pageProps({
      completedRhythmIds: new Set([rhythm.id]),
      archivedRhythmIds: [rhythm.id],
      sparks: [archivedSpark, completedSpark],
      prayerRequests: [archivedPrayer]
    })} />);

    expect(screen.queryByRole('article', { name: 'All items rhythm' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Expand Spark Archived Spark' }));
    await user.click(screen.getByRole('button', { name: 'Expand Spark Completed Spark' }));
    expect(screen.getByText('Archived', { selector: '.person-spark-card__status' })).toBeTruthy();
    expect(screen.getByText(/Completed/, { selector: '.person-spark-card__status' })).toBeTruthy();
    expect(screen.getByText('Archived', { selector: '.person-prayer-card__status' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('3 items');
  });

  it('renders the same inline Rhythm card and history action used by Home and People', async () => {
    const user = userEvent.setup();
    const onRhythmHistory = vi.fn();
    const cardRhythm: RhythmPreview = {
      ...rhythm,
      categoryIds: ['faith'],
      primaryFoundationId: 'faith-prayer'
    };
    render(<AllItemsPage {...pageProps({
      rhythms: [cardRhythm],
      foundations: foundationCatalogue,
      onRhythmHistory
    })} />);

    const card = screen.getByRole('article', { name: 'All items rhythm' });
    expect(card.classList.contains('today-rhythm-details-dialog--inline')).toBe(true);
    expect(card.querySelector('.rhythm-card--details-summary')).toBeNull();
    expect(card.querySelector('.today-rhythm-details__title-score-row')).toBeTruthy();
    expect(card.querySelector('.today-rhythm-details__footer')).toBeTruthy();
    expect(card.querySelector('.today-rhythm-details__edit-icon')).toBeNull();
    expect(card.querySelector('.today-rhythm-details__association-people')).toBeTruthy();
    expect(card.querySelector('.rhythm-area-badge__visual')).toBeTruthy();
    expect(card.querySelector('.rhythm-card__tend')).toBeTruthy();
    expect(card.querySelector('.today-rhythm-details__history-button')).toBeTruthy();

    await user.click(within(card).getByRole('button', {
      name: /View scores and history for All items rhythm/
    }));
    expect(onRhythmHistory).toHaveBeenCalledOnce();
    expect(onRhythmHistory.mock.calls[0]?.[0]).toBe(rhythm.id);
  });

  it('groups active Rhythms by the shared schedule sections without disturbing other item sections', () => {
    const groupedRhythms: RhythmPreview[] = [{
      ...rhythm,
      id: 'user-rhythm-11111111-1111-4111-8111-111111111111',
      title: 'Daily all-items Rhythm',
      cadence: 'Daily',
      schedule: { frequency: 'daily' }
    }, {
      ...rhythm,
      id: 'user-rhythm-22222222-2222-4222-8222-222222222222',
      title: 'Weekly all-items Rhythm',
      cadence: 'Weekly',
      schedule: { frequency: 'weekly', weekdays: [1] }
    }, {
      ...rhythm,
      id: 'user-rhythm-33333333-3333-4333-8333-333333333333',
      title: 'Seasonal all-items Rhythm',
      cadence: 'Quarterly',
      schedule: {
        frequency: 'quarterly',
        monthInQuarter: 1,
        pattern: { kind: 'dayOfMonth', day: 1 }
      }
    }, {
      ...rhythm,
      id: 'user-rhythm-44444444-4444-4444-8444-444444444444',
      title: 'Every other week all-items Rhythm',
      cadence: 'Every 2 weeks',
      schedule: {
        frequency: 'custom',
        unit: 'weeks',
        interval: 2,
        weekdays: [1],
        startDate: '2026-10-26'
      }
    }, {
      ...rhythm,
      id: 'user-rhythm-55555555-5555-4555-8555-555555555555',
      title: 'Archived all-items Rhythm',
      cadence: 'Daily',
      schedule: { frequency: 'daily' }
    }];
    const prayerRequest: PersonPrayerRequest = {
      id: 'all-items-active-prayer',
      personId: owner,
      title: 'All items Prayer',
      status: 'active',
      createdAt: '2026-10-01T12:00:00.000Z',
      updatedAt: '2026-10-31T12:00:00.000Z',
      prayerLogs: []
    };
    render(<AllItemsPage {...pageProps({
      rhythms: groupedRhythms,
      archivedRhythmIds: [groupedRhythms[4]!.id],
      sparks: [completedSpark],
      prayerRequests: [prayerRequest]
    })} />);

    expect(screen.getByRole('status').textContent).toContain('6 items');
    expect(screen.getByRole('heading', { name: 'Sparks (1)' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Prayer requests (1)' })).toBeTruthy();
    for (const [groupTitle, rhythm] of [
      ['Daily', groupedRhythms[0]!],
      ['Weekly', groupedRhythms[1]!],
      ['Seasonal & Annual', groupedRhythms[2]!],
      ['Custom schedule', groupedRhythms[3]!]
    ] as const) {
      const group = screen.getByRole('region', { name: groupTitle });
      expect(within(group).getByRole('article', { name: rhythm.title })).toBeTruthy();
      expect(screen.getAllByRole('article', { name: rhythm.title })).toHaveLength(1);
    }
    expect(screen.queryByRole('article', { name: 'Archived all-items Rhythm' })).toBeNull();
  });

  it('keeps filters and refreshed results when the standard Rhythm history/edit flow returns', async () => {
    const user = userEvent.setup();
    const onRhythmHistory = vi.fn();
    const view = render(<AllItemsPage {...pageProps({ onRhythmHistory })} />);

    await selectFilterOptions(user, 'Type', ['Rhythms']);
    await selectFilterOptions(user, 'Person', [people[0]!.displayName]);
    await selectFilterOptions(user, 'Frequency', ['Daily']);
    await selectFilterOptions(user, 'Time of day', ['Morning']);
    await user.click(screen.getByRole('button', {
      name: /View scores and history for All items rhythm/
    }));

    expect(onRhythmHistory).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Type: Rhythms' })).toBeTruthy();
    expect(screen.getByRole('button', { name: `Person: ${people[0]!.displayName}` })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Frequency: Daily' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Time of day: Morning' })).toBeTruthy();

    const renamedRhythm = { ...rhythm, title: 'Updated rhythm title' };
    view.rerender(<AllItemsPage {...pageProps({
      rhythms: [renamedRhythm],
      onRhythmHistory
    })} />);

    expect(screen.getByRole('heading', { name: 'Updated rhythm title' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('1 item');
    expect(screen.getByRole('button', { name: `Person: ${people[0]!.displayName}` })).toBeTruthy();
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

    await selectFilterOptions(user, 'Type', ['Sparks']);
    await selectFilterOptions(user, 'Person', [people[0]!.displayName]);
    await selectFilterOptions(user, 'Frequency', ['Not scheduled / Not applicable']);
    await selectFilterOptions(user, 'Time of day', ['No applicable time setting']);
    const card = screen.getByRole('article', { name: 'All items Spark' });
    await user.click(within(card).getByRole('button', { name: 'Expand Spark All items Spark' }));
    await user.click(within(card).getByRole('button', { name: 'Edit Spark' }));
    const editor = screen.getByRole('dialog', { name: 'Edit Spark' });
    await user.clear(within(editor).getByLabelText('Title'));
    await user.type(within(editor).getByLabelText('Title'), 'Updated All items Spark');
    await user.click(within(editor).getByRole('button', { name: 'Save changes' }));

    expect(onUpdateSpark).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Type: Sparks' })).toBeTruthy();
    expect(screen.getByRole('button', { name: `Person: ${people[0]!.displayName}` })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Frequency: Not scheduled / Not applicable' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Time of day: No applicable time setting' })).toBeTruthy();

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

    await selectFilterOptions(user, 'Type', ['Prayer requests']);
    await selectFilterOptions(user, 'Person', ['No person']);
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
    expect(screen.getByRole('button', { name: 'Type: Prayer requests' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Person: No person' })).toBeTruthy();

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
    await selectFilterOptions(user, 'Type', ['Sparks']);

    expect(screen.getByRole('status').textContent).toContain('0 items');
    expect(screen.getByText('No items match these filters. Clear filters to see everything.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('button', { name: 'Type: All types' })).toBeTruthy();
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

    await selectFilterOptions(user, 'Type', ['Prayer requests']);
    await selectFilterOptions(user, 'Time of day', ['No applicable time setting']);
    expect(screen.getByRole('status').textContent).toContain('1 item');
    expect(screen.getByRole('article', { name: 'Prayer with no time' })).toBeTruthy();
    expect(screen.getByText('Time of day not set')).toBeTruthy();

    const timeOptions = screen.getByRole('group', { name: 'Time of day options' });
    await user.click(within(timeOptions).getByRole('checkbox', { name: 'No applicable time setting' }));
    await selectFilterOptions(user, 'Time of day', ['Anytime']);
    expect(screen.getByRole('status').textContent).toContain('1 item');
    const anytimeCard = screen.getByRole('article', { name: 'Anytime prayer' });
    expect(screen.queryByRole('article', { name: 'Prayer with no time' })).toBeNull();
    expect(within(anytimeCard).getByText('Anytime')).toBeTruthy();
  });

  it('matches any selected option within each filter while combining filters with AND', async () => {
    const user = userEvent.setup();
    const rhythmA = { ...rhythm, id: 'multi-a', title: 'Morning rhythm', personIds: [owner] };
    const personB = people[1]!;
    const prayerB: PersonPrayerRequest = {
      id: 'multi-b',
      personId: personB.id,
      sharedWith: [],
      title: 'Afternoon Prayer',
      status: 'active',
      schedule: { frequency: 'weekly', weekdays: [1] },
      timeOfDay: 'afternoon',
      createdAt: '2026-10-01T12:00:00.000Z',
      updatedAt: '2026-10-31T12:00:00.000Z',
      prayerLogs: []
    };
    render(<AllItemsPage {...pageProps({
      rhythms: [rhythmA],
      prayerRequests: [prayerB]
    })} />);

    await selectFilterOptions(user, 'Type', ['Rhythms', 'Prayer requests']);
    await selectFilterOptions(user, 'Person', [people[0]!.displayName, personB.displayName]);
    await selectFilterOptions(user, 'Frequency', ['Daily', 'Weekly']);
    await selectFilterOptions(user, 'Time of day', ['Morning', 'Afternoon']);

    expect(screen.getByRole('button', { name: 'Type: 2 selected' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Person: 2 selected' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Frequency: 2 selected' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Time of day: 2 selected' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('2 items');
    expect(screen.getByRole('article', { name: 'Morning rhythm' })).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Afternoon Prayer' })).toBeTruthy();
  });

  it('searches titles and details locally and combines search with filters and clear actions', async () => {
    const user = userEvent.setup();
    const detailedRhythm = {
      ...rhythm,
      id: 'search-detail',
      title: 'Morning walk',
      description: 'Call Avery after breakfast'
    };
    const otherRhythm = {
      ...rhythm,
      id: 'search-other',
      title: 'Evening rest',
      description: 'Quiet reflection'
    };
    render(<AllItemsPage {...pageProps({
      rhythms: [detailedRhythm, otherRhythm]
    })} />);

    const search = screen.getByRole('searchbox', { name: 'Search titles and details' }) as HTMLInputElement;
    expect(search.getAttribute('placeholder')).toBe('Search titles and details…');
    await user.type(search, '  BREAKFAST  ');
    await selectFilterOptions(user, 'Type', ['Rhythms']);
    expect(screen.getByRole('status').textContent).toContain('1 item');
    expect(screen.getByRole('article', { name: 'Morning walk' })).toBeTruthy();
    expect(screen.queryByRole('article', { name: 'Evening rest' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(search.value).toBe('');
    expect(screen.getByRole('status').textContent).toContain('2 items');

    await user.type(search, 'quiet');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(search.value).toBe('');
    expect(screen.getByRole('button', { name: 'Type: All types' })).toBeTruthy();
  });

  it('preserves search text and filters when the standard Rhythm history/edit route returns', async () => {
    const user = userEvent.setup();
    const onRhythmHistory = vi.fn();
    const detailedRhythm = {
      ...rhythm,
      description: 'A shared detail to find'
    };
    const view = render(<AllItemsPage {...pageProps({
      rhythms: [detailedRhythm],
      onRhythmHistory
    })} />);

    const search = screen.getByRole('searchbox', { name: 'Search titles and details' }) as HTMLInputElement;
    await user.type(search, 'shared detail');
    await selectFilterOptions(user, 'Type', ['Rhythms']);
    await user.click(screen.getByRole('button', {
      name: /View scores and history for All items rhythm/
    }));

    expect(onRhythmHistory).toHaveBeenCalledOnce();
    expect(search.value).toBe('shared detail');
    expect(screen.getByRole('button', { name: 'Type: Rhythms' })).toBeTruthy();

    view.rerender(<AllItemsPage {...pageProps({
      rhythms: [{ ...detailedRhythm, title: 'Updated rhythm title' }],
      onRhythmHistory
    })} />);

    expect(search.value).toBe('shared detail');
    expect(screen.getByRole('button', { name: 'Type: Rhythms' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('1 item');
  });

  it('flattens mixed results for explicit sorting and preserves the sort across clear filters and edit return', async () => {
    const user = userEvent.setup();
    const spark: PersonSpark = {
      id: 'sorted-spark',
      ownerId: owner,
      title: 'Beta Spark',
      sharedWith: [],
      archived: false,
      completed: false,
      completionHistory: []
    };
    const prayerRequest: PersonPrayerRequest = {
      id: 'sorted-prayer',
      personId: owner,
      title: 'Alpha request',
      status: 'active',
      createdAt: '2026-10-01T12:00:00.000Z',
      updatedAt: '2026-10-31T12:00:00.000Z',
      prayerLogs: []
    };
    const onUpdateSpark = vi.fn(() => null);
    const view = render(<AllItemsPage {...pageProps({
      rhythms: [{ ...rhythm, title: 'Zulu Rhythm' }],
      sparks: [spark],
      prayerRequests: [prayerRequest],
      onUpdateSpark
    })} />);

    await selectSortOption(user, 'Sort by', 'Title');
    expect(screen.queryByRole('heading', { name: 'Rhythms (1)' })).toBeNull();
    expect(sortedCardTitles()).toEqual(['Alpha request', 'Beta Spark', 'Zulu Rhythm']);

    await selectSortOption(user, 'Sort direction', 'Descending');
    expect(sortedCardTitles()).toEqual(['Zulu Rhythm', 'Beta Spark', 'Alpha request']);
    await selectFilterOptions(user, 'Type', ['Sparks']);
    expect(screen.getByRole('status').textContent).toContain('1 item');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('combobox', { name: 'Sort by: Title' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Sort direction: Descending' })).toBeTruthy();
    expect(sortedCardTitles()).toEqual(['Zulu Rhythm', 'Beta Spark', 'Alpha request']);

    const sparkCard = screen.getByRole('article', { name: 'Beta Spark' });
    await user.click(within(sparkCard).getByRole('button', { name: 'Expand Spark Beta Spark' }));
    await user.click(within(sparkCard).getByRole('button', { name: 'Edit Spark' }));
    const editor = screen.getByRole('dialog', { name: 'Edit Spark' });
    await user.clear(within(editor).getByLabelText('Title'));
    await user.type(within(editor).getByLabelText('Title'), 'Yotta Spark');
    await user.click(within(editor).getByRole('button', { name: 'Save changes' }));
    expect(onUpdateSpark).toHaveBeenCalledOnce();

    view.rerender(<AllItemsPage {...pageProps({
      rhythms: [{ ...rhythm, title: 'Zulu Rhythm' }],
      sparks: [{ ...spark, title: 'Yotta Spark' }],
      prayerRequests: [prayerRequest],
      onUpdateSpark
    })} />);
    expect(screen.getByRole('combobox', { name: 'Sort by: Title' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Sort direction: Descending' })).toBeTruthy();
    expect(sortedCardTitles()).toEqual(['Zulu Rhythm', 'Yotta Spark', 'Alpha request']);
  });
});
