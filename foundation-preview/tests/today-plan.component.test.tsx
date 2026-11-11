import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TodayView } from '../src/components/TodayView.tsx';
import type { TodayWeatherController } from '../src/components/useTodayWeather.ts';
import { todayFocusContext } from '../src/domain/today-plan.ts';
import type { TodayFocusId } from '../src/domain/today-plan.ts';
import {
  foundationCatalogue,
  SELF_PREVIEW_PERSON,
  todayRhythms
} from '../src/domain/preview-data.ts';
import type {
  PersonPickerGroup,
  PersonPreview,
  RhythmPreview
} from '../src/domain/preview-data.ts';
import { TimeBlocksProvider } from '../src/components/TimeBlocksContext.tsx';
import { createDefaultTimeBlockSettings } from '../src/domain/time-blocks.ts';
import type { TimeBlockSettings } from '../src/domain/time-blocks.ts';
import { createSamplePreviewData } from '../src/domain/preview-state.ts';
import type { PersonPrayerRequest } from '../src/domain/person-prayers.ts';

afterEach(cleanup);

const unavailableWeather: TodayWeatherController = {
  city: null,
  weather: { status: 'idle', report: null, fetchedAt: null, message: null },
  search: { status: 'idle', results: [], message: null },
  searchCities: vi.fn(),
  selectCity: vi.fn(),
  clearCity: vi.fn(),
  retry: vi.fn()
};

function TodayHarness({
  weatherController = unavailableWeather,
  satisfiedRhythmIds = new Set(['sample-pray-together']),
  showTended = true,
  timeBlockSettings = createDefaultTimeBlockSettings(),
  categoryHealthScores = new Map(),
  rhythms = todayRhythms,
  people = [],
  peopleGroups = [],
  prayerRequests = []
}: {
  weatherController?: TodayWeatherController;
  satisfiedRhythmIds?: ReadonlySet<string>;
  showTended?: boolean;
  timeBlockSettings?: TimeBlockSettings;
  categoryHealthScores?: ReadonlyMap<string, number | null>;
  rhythms?: readonly RhythmPreview[];
  people?: readonly PersonPreview[];
  peopleGroups?: readonly PersonPickerGroup[];
  prayerRequests?: readonly PersonPrayerRequest[];
}) {
  const [focus, setFocus] = useState<TodayFocusId>('now');
  const [tendedVisible, setTendedVisible] = useState(showTended);
  return (
    <TimeBlocksProvider settings={timeBlockSettings}>
      <TodayView
        people={people}
        peopleGroups={peopleGroups}
        prayerRequests={prayerRequests}
        onPrayForRequest={() => null}
        greeting="Good morning"
        evaluationInstant={new Date(2026, 9, 31, 10, 0)}
        localDate="2026-10-31"
        focus={focus}
        onFocusChange={setFocus}
        weatherController={weatherController}
        completedRhythms={new Set(['sample-pray-together'])}
        undoableRhythms={new Set()}
        satisfiedRhythmIds={satisfiedRhythmIds}
        showTended={tendedVisible}
        onShowTendedChange={setTendedVisible}
        rhythms={rhythms}
        rhythmScores={new Map()}
        categoryHealthScores={categoryHealthScores}
        onNavigate={vi.fn()}
        onPersonSelect={vi.fn()}
        foundations={foundationCatalogue}
        onOpenFoundation={vi.fn()}
        onHistory={vi.fn()}
        onTend={vi.fn()}
        onEditRhythm={vi.fn()}
        onUndo={vi.fn()}
      />
    </TimeBlocksProvider>
  );
}

function renderToday(
  weatherController?: TodayWeatherController,
  options: {
    satisfiedRhythmIds?: ReadonlySet<string>;
    showTended?: boolean;
    timeBlockSettings?: TimeBlockSettings;
    categoryHealthScores?: ReadonlyMap<string, number | null>;
    rhythms?: readonly RhythmPreview[];
    people?: readonly PersonPreview[];
    peopleGroups?: readonly PersonPickerGroup[];
    prayerRequests?: readonly PersonPrayerRequest[];
  } = {}
) {
  return render(<TodayHarness
    {...(weatherController ? { weatherController } : {})}
    {...options}
  />);
}

describe('Today time-frame interaction', () => {
  it('renders the full Today view with default preview data and no Prayer requests', () => {
    const data = createSamplePreviewData();
    renderToday(undefined, {
      people: [SELF_PREVIEW_PERSON, ...data.people],
      peopleGroups: data.peopleGroups,
      prayerRequests: data.prayerRequests,
      timeBlockSettings: data.timeBlocks,
      rhythms: todayRhythms
    });

    expect(screen.getByText('Good morning')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Overall health summary' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Faith/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Marriage/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Parenting/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Health & Fitness/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Finances/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Friendships/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Prayer' })).toBeTruthy();
    expect(screen.getByText('4 people selected · Now · 0 requests')).toBeTruthy();
    const plan = screen.getByRole('region', { name: "Today's plan" });
    expect(within(plan).getByRole('combobox', {
      name: /Filter scheduled Rhythms by time, currently Now/
    })).toBeTruthy();
    expect(within(plan).getByRole('article', { name: 'Pray together' })).toBeTruthy();
    expect(within(plan).getByRole('tab', { name: 'Scheduled' })).toBeTruthy();
    expect([...document.querySelectorAll<HTMLDialogElement>('.prayer-dialog')]
      .filter(dialog => !dialog.open)
      .every(dialog => getComputedStyle(dialog).display === 'none')).toBe(true);
  });

  it('keeps Today usable with a legacy unscheduled request and an empty Prayer selection', async () => {
    const user = userEvent.setup();
    const data = createSamplePreviewData();
    const legacyRequest: PersonPrayerRequest = {
      id: 'legacy-prayer',
      personId: data.people[0]!.id,
      title: 'Legacy request',
      details: 'Older data has no recurrence fields.',
      status: 'active',
      createdAt: '2026-10-01T12:00:00.000Z',
      updatedAt: '2026-10-01T12:00:00.000Z',
      prayerLogs: []
    };
    renderToday(undefined, {
      people: [SELF_PREVIEW_PERSON, ...data.people],
      peopleGroups: data.peopleGroups,
      prayerRequests: [legacyRequest],
      timeBlockSettings: data.timeBlocks,
      rhythms: todayRhythms
    });

    expect(screen.getByRole('region', { name: 'Overall health summary' })).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Pray together' })).toBeTruthy();
    expect(screen.getByText('4 people selected · Now · 1 request')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Focused Prayer · 1' }));
    expect(screen.getByText('Legacy request')).toBeTruthy();
    expect(screen.getByText('Daily · Anytime · prayed 0 times')).toBeTruthy();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Customize' }));
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByText('0 people selected · Now · 0 requests')).toBeTruthy();
    expect(screen.getByText('No active requests match this selection.')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Overall health summary' })).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Pray together' })).toBeTruthy();
    expect(screen.getByRole('combobox', {
      name: /Filter scheduled Rhythms by time, currently Now/
    })).toBeTruthy();
    expect([...document.querySelectorAll<HTMLDialogElement>('.prayer-dialog')]
      .filter(dialog => !dialog.open)
      .every(dialog => getComputedStyle(dialog).display === 'none')).toBe(true);
  });

  it('keeps Overall Health category labels intact and in order beside their icon and score', () => {
    renderToday();

    const overall = screen.getByRole('region', { name: 'Overall health summary' });
    const categoryCards = within(overall).getAllByRole('button');
    expect(categoryCards.map(card => card.querySelector('.ma-name')?.textContent)).toEqual([
      'Faith',
      'Marriage',
      'Parenting',
      'Health & Fitness',
      'Finances',
      'Friendships'
    ]);
    for (const card of categoryCards) {
      expect(card.querySelector('.menu-area-icon')?.getAttribute('aria-hidden')).toBe('true');
      expect(card.querySelector('.ma-score__value')).toBeTruthy();
    }
  });

  it('shows the equal-weight average of available category Health values and synchronized coverage', () => {
    renderToday(undefined, {
      categoryHealthScores: new Map([
        ['faith', 100],
        ['marriage', 13],
        ['parenting', 13]
      ])
    });

    const overall = screen.getByRole('region', { name: 'Overall health summary' });
    expect(within(overall).getByText('42', { selector: '.ov-score' })).toBeTruthy();
    expect(within(overall).getByText('3 of 6 categories scored.')).toBeTruthy();
    expect(within(overall).getByRole('meter', {
      name: 'Overall health score 42 out of 100'
    }).getAttribute('aria-valuenow')).toBe('42');
    expect(within(overall).getByRole('button', { name: /Faith/ }).querySelector('.ma-score')?.textContent).toBe('100');
    expect(within(overall).getByRole('button', { name: /Marriage/ }).querySelector('.ma-score')?.textContent).toBe('13');
    expect(within(overall).getByRole('button', { name: /Parenting/ }).querySelector('.ma-score')?.textContent).toBe('13');
  });

  it('updates the displayed score, progress meter and coverage when Category scores change', () => {
    const { rerender } = renderToday(undefined, {
      categoryHealthScores: new Map([
        ['faith', 100],
        ['marriage', 13]
      ])
    });
    const overall = screen.getByRole('region', { name: 'Overall health summary' });
    expect(within(overall).getByText('57', { selector: '.ov-score' })).toBeTruthy();
    expect(within(overall).getByText('2 of 6 categories scored.')).toBeTruthy();

    rerender(<TodayHarness categoryHealthScores={new Map([
      ['faith', 100],
      ['marriage', 13],
      ['parenting', 13]
    ])} />);

    expect(within(overall).getByText('42', { selector: '.ov-score' })).toBeTruthy();
    expect(within(overall).getByText('3 of 6 categories scored.')).toBeTruthy();
    expect(within(overall).getByRole('meter', { name: 'Overall health score 42 out of 100' })
      .getAttribute('aria-valuenow')).toBe('42');
  });

  it('includes zero in the Today Overall Health average', () => {
    renderToday(undefined, {
      categoryHealthScores: new Map([['faith', 0]])
    });

    const overall = screen.getByRole('region', { name: 'Overall health summary' });
    expect(within(overall).getByText('0', { selector: '.ov-score' })).toBeTruthy();
    expect(within(overall).getByText('1 of 6 categories scored.')).toBeTruthy();
    expect(within(overall).getByRole('meter', { name: 'Overall health score 0 out of 100' })
      .getAttribute('aria-valuenow')).toBe('0');
  });

  it('keeps zero, two-digit, and three-digit category scores in the shared numeric badge', () => {
    renderToday(undefined, {
      categoryHealthScores: new Map([
        ['faith', 0],
        ['marriage', 23],
        ['parenting', 100]
      ])
    });

    const overall = screen.getByRole('region', { name: 'Overall health summary' });
    const values = ['Faith', 'Marriage', 'Parenting'].map(label => {
      const badge = within(overall).getByRole('button', { name: new RegExp(label) })
        .querySelector('.ma-score');
      expect(badge).toBeTruthy();
      expect(badge?.querySelector('.ma-score__value')).toBeTruthy();
      return badge?.querySelector('.ma-score__value')?.textContent;
    });

    expect(values).toEqual(['0', '23', '100']);
  });

  it('shows a dash, empty meter and zero coverage when all category scores are unavailable', () => {
    renderToday();

    const overall = screen.getByRole('region', { name: 'Overall health summary' });
    expect(within(overall).getByText('—', { selector: '.ov-score' })).toBeTruthy();
    expect(within(overall).getByText('0 of 6 categories scored.')).toBeTruthy();
    const meter = within(overall).getByRole('meter', { name: 'Overall health: Not enough data' });
    expect(meter.getAttribute('aria-valuenow')).toBeNull();
    expect(meter.getAttribute('aria-valuetext')).toBe('Score unavailable');
    expect(meter.querySelector('.preview-score-marker')).toBeNull();
  });

  it('defaults to Now, counts only the selected range, and keeps the selected block during the visit', async () => {
    const user = userEvent.setup();
    renderToday();
    const plan = screen.getByRole('region', { name: "Today's plan" });
    expect(within(plan).getByRole('combobox', { name: /Filter scheduled Rhythms by time, currently Now/ })).toBeTruthy();
    expect(within(plan).getByText('1 of 1 tended')).toBeTruthy();
    expect(within(plan).getByRole('article', { name: 'Pray together' })).toBeTruthy();
    expect(within(plan).queryByRole('article', { name: 'Daily connection' })).toBeNull();
    expect(within(plan).queryByRole('heading', { name: 'Your plan' })).toBeNull();

    await user.click(within(plan).getByRole('combobox', { name: /Filter scheduled Rhythms by time, currently Now/ }));
    expect(within(plan).getByRole('option', { name: /Now.*9:00am – 11:30am/ })).toBeTruthy();
    await user.click(within(plan).getByRole('option', { name: /Evening/ }));

    expect(within(plan).getByText('6:00pm – 9:30pm', {
      selector: '.today-plan__time-range'
    })).toBeTruthy();
    expect(within(plan).getByText('0 of 1 tended')).toBeTruthy();
    expect(within(plan).getByRole('article', { name: 'Daily connection' })).toBeTruthy();
    expect(within(plan).queryByRole('article', { name: 'Pray together' })).toBeNull();
    await user.click(within(plan).getByRole('combobox', { name: /Filter scheduled Rhythms by time, currently Evening/ }));
    expect(within(plan).getByRole('option', { name: /Evening.*6:00pm – 9:30pm/ })).toBeTruthy();
  });

  it('sizes the Today time trigger from all primary option labels, independent of selection', async () => {
    const user = userEvent.setup();
    renderToday();
    const plan = screen.getByRole('region', { name: "Today's plan" });
    const trigger = within(plan).getByRole('combobox', { name: /Filter scheduled Rhythms by time, currently Now/ });
    const sizingLabels = () => [...trigger.querySelector('.rhythm-select__trigger-sizer')!.children]
      .map(label => label.textContent ?? '');
    const expectedLabels = [
      'Now',
      'Everything today',
      ...createDefaultTimeBlockSettings().blocks.map(block => block.name)
    ];

    expect(trigger.classList.contains('rhythm-select__trigger--size-to-options')).toBe(true);
    expect(sizingLabels()).toEqual(expectedLabels);
    expect(trigger.querySelector('.rhythm-select__trigger-sizer')?.getAttribute('aria-hidden')).toBe('true');
    expect(trigger.querySelector('.rhythm-select__trigger-sizer')?.textContent)
      .not.toContain('Across every time block');

    const selections: Array<[string, RegExp]> = [
      ['Everything today', /Filter scheduled Rhythms by time, currently Everything today/],
      ['Evening', /Filter scheduled Rhythms by time, currently Evening/]
    ];
    for (const [label, expectedTriggerName] of selections) {
      await user.click(screen.getByRole('combobox', { name: /^Filter scheduled Rhythms by time/ }));
      await user.click(within(plan).getByRole('option', { name: new RegExp(`^${label}`) }));
      expect(within(plan).getByRole('combobox', { name: expectedTriggerName })).toBeTruthy();
      expect(sizingLabels()).toEqual(expectedLabels);
    }
  });

  it('offers Everything today and the three preserved item-type tabs with ARIA selection', async () => {
    const user = userEvent.setup();
    renderToday();
    const plan = screen.getByRole('region', { name: "Today's plan" });
    await user.click(within(plan).getByRole('combobox', { name: /Filter scheduled Rhythms by time, currently Now/ }));
    await user.click(within(plan).getByRole('option', { name: /Everything today/ }));

    expect(within(plan).getByText('1 of 3 tended')).toBeTruthy();
    for (const name of ['Pray together', 'Daily connection', 'Take a walk']) {
      expect(within(plan).getByRole('article', { name })).toBeTruthy();
    }
    for (const tabName of ['Scheduled', 'Anytime', 'All-day']) {
      expect(within(plan).getByRole('tab', { name: tabName })).toBeTruthy();
    }
    expect(within(plan).getByRole('tab', { name: 'Scheduled' }).getAttribute('aria-selected')).toBe('true');

    await user.click(within(plan).getByRole('tab', { name: 'Anytime' }));
    expect(within(plan).getByRole('tab', { name: 'Anytime' }).getAttribute('aria-selected')).toBe('true');
    expect(within(plan).getByRole('status').textContent).toBe('No active Rhythms in Anytime.');
  });

  it('distinguishes an all-tended selection from an empty tab and keeps Show tended available', async () => {
    const user = userEvent.setup();
    renderToday(undefined, {
      satisfiedRhythmIds: new Set(['sample-pray-together']),
      showTended: false
    });
    const plan = screen.getByRole('region', { name: "Today's plan" });

    expect(within(plan).getByText('1 of 1 tended')).toBeTruthy();
    expect(within(plan).getByRole('button', { name: 'Show tended Rhythms, 1 of 1 tended' }).getAttribute('aria-expanded'))
      .toBe('false');
    expect(within(plan).getByRole('status').textContent).toBe('You’ve tended everything here.');

    await user.click(within(plan).getByRole('tab', { name: 'Anytime' }));
    expect(within(plan).getByRole('status').textContent).toBe('No active Rhythms in Anytime.');
    expect(within(plan).queryByText('You’ve tended everything here.')).toBeNull();
    expect(within(plan).getByRole('button', { name: 'Show tended Rhythms, 0 of 0 tended' })).toBeTruthy();
  });

  it('renders a single card-style empty message using the selected view label', async () => {
    const user = userEvent.setup();
    renderToday(undefined, { rhythms: [] });
    const plan = screen.getByRole('region', { name: "Today's plan" });
    const emptyState = () => within(plan).getByRole('status');

    expect(emptyState().textContent).toBe('No active Rhythms in Now.');
    expect(emptyState().className).toContain('today-plan__empty-rhythms');
    expect(emptyState().querySelectorAll('button, svg, img')).toHaveLength(0);

    await user.click(within(plan).getByRole('combobox', { name: /Filter scheduled Rhythms by time, currently Now/ }));
    await user.click(within(plan).getByRole('option', { name: /Everything today/ }));
    expect(emptyState().textContent).toBe('No active Rhythms today.');
    expect(within(plan).queryByRole('heading', { name: 'Everything today' })).toBeNull();
    expect(within(plan).getByRole('combobox', {
      name: 'Filter scheduled Rhythms by time, currently Everything today'
    })).toBeTruthy();
    expect(plan.querySelector('.today-plan__view-heading-row--picker-only')).toBeTruthy();

    await user.click(within(plan).getByRole('combobox', { name: /Filter scheduled Rhythms by time, currently Everything today/ }));
    await user.click(within(plan).getByRole('option', { name: /^Morning/ }));
    expect(emptyState().textContent).toBe('No active Rhythms in Morning.');

    await user.click(within(plan).getByRole('tab', { name: 'Anytime' }));
    expect(emptyState().textContent).toBe('No active Rhythms in Anytime.');
    await user.click(within(plan).getByRole('tab', { name: 'All-day' }));
    expect(emptyState().textContent).toBe('No active Rhythms in All-day.');
  });

  it('keeps populated Rhythms visible without rendering the empty card', () => {
    renderToday();
    const plan = screen.getByRole('region', { name: "Today's plan" });
    expect(within(plan).getByRole('article', { name: 'Pray together' })).toBeTruthy();
    expect(plan.querySelector('.today-plan__empty-rhythms')).toBeNull();
  });

  it('shows the selected collection disclosure in the Today heading row on every plan tab', async () => {
    const user = userEvent.setup();
    renderToday(undefined, { showTended: false });
    const plan = screen.getByRole('region', { name: "Today's plan" });
    const toggle = () => within(plan).getByRole('button', { name: /Show tended Rhythms/ });
    const titleRow = plan.querySelector<HTMLElement>('.today-plan__title-row')!;
    const progressRow = plan.querySelector('.show-tended-list__progress-row')!;
    const tabList = within(plan).getByRole('tablist', { name: 'Plan items' });

    for (const tabName of ['Scheduled', 'Anytime', 'All-day']) {
      await user.click(within(plan).getByRole('tab', { name: tabName }));
      expect(within(plan).getByRole('heading', { name: tabName === 'Scheduled' ? 'Now' : tabName }))
        .toBeTruthy();
      expect(within(titleRow).getByRole('heading', { name: 'Today' })).toBeTruthy();
      expect(titleRow.contains(progressRow)).toBe(true);
      expect(titleRow.compareDocumentPosition(tabList) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(plan.querySelectorAll('.show-tended-list__progress-row')).toHaveLength(1);
      expect(plan.querySelector('.show-tended-list__disclosure-content')?.className)
        .toContain('show-tended-list__progress');
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
      expect(toggle().textContent).toContain(`${within(plan).getByText(/\d+ of \d+ tended/).textContent}`);
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
      const chevron = toggle().querySelector('.show-tended-list__disclosure-chevron path');
      expect(chevron?.getAttribute('d')).toBe('m3 6 5 5 5-5');
      expect(progressRow).toBeTruthy();
      expect(plan.querySelector('.today-plan__left-column')?.contains(progressRow)).toBe(false);

      await user.click(toggle());
      const hideToggle = within(plan).getByRole('button', { name: /Hide tended Rhythms/ });
      expect(hideToggle.getAttribute('aria-expanded')).toBe('true');
      expect(hideToggle.querySelector('.show-tended-list__disclosure-chevron path')?.getAttribute('d'))
        .toBe('m3 10 5-5 5 5');
      await user.click(hideToggle);
    }
  });

  it('uses one accessible keyboard-operable disclosure pill for Today progress', async () => {
    const user = userEvent.setup();
    renderToday(undefined, { showTended: false });
    const plan = screen.getByRole('region', { name: "Today's plan" });
    await user.click(within(plan).getByRole('tab', { name: 'Anytime' }));

    const pill = within(plan).getByRole('button', { name: 'Show tended Rhythms, 0 of 0 tended' });
    expect(pill.getAttribute('aria-expanded')).toBe('false');
    expect(pill.textContent).toContain('0 of 0 tended');
    expect(pill.querySelector('.show-tended-list__disclosure-chevron path')?.getAttribute('d'))
      .toBe('m3 6 5 5 5-5');
    expect(pill.getAttribute('type')).toBe('button');

    pill.focus();
    await user.keyboard('{Enter}');
    const expandedPill = within(plan).getByRole('button', { name: 'Hide tended Rhythms, 0 of 0 tended' });
    expect(expandedPill.getAttribute('aria-expanded')).toBe('true');
    expect(expandedPill.querySelector('.show-tended-list__disclosure-chevron path')?.getAttribute('d'))
      .toBe('m3 10 5-5 5 5');

    await user.click(within(plan).getByRole('tab', { name: 'Scheduled' }));
    expect(within(plan).getByRole('button', { name: 'Hide tended Rhythms, 1 of 1 tended' })).toBeTruthy();
  });

  it('moves focus and activates Today plan tabs with arrows, Home, and End', async () => {
    const user = userEvent.setup();
    renderToday();
    const plan = screen.getByRole('region', { name: "Today's plan" });
    await user.click(within(plan).getByRole('combobox', { name: /Filter scheduled Rhythms by time, currently Now/ }));
    await user.click(within(plan).getByRole('option', { name: /Everything today/ }));

    const tabList = within(plan).getByRole('tablist', { name: 'Plan items' });
    const scheduled = within(tabList).getByRole('tab', { name: 'Scheduled' });
    const anytime = within(tabList).getByRole('tab', { name: 'Anytime' });
    const allDay = within(tabList).getByRole('tab', { name: 'All-day' });
    const panel = within(plan).getByRole('tabpanel');

    scheduled.focus();
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(allDay);
    expect(allDay.getAttribute('aria-selected')).toBe('true');
    expect(allDay.tabIndex).toBe(0);
    expect(scheduled.tabIndex).toBe(-1);
    expect(panel.getAttribute('aria-labelledby')).toBe('plan-tab-all-day');

    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(scheduled);
    expect(scheduled.getAttribute('aria-selected')).toBe('true');

    await user.keyboard('{End}');
    expect(document.activeElement).toBe(allDay);
    expect(allDay.getAttribute('aria-selected')).toBe('true');

    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(scheduled);
    expect(scheduled.getAttribute('aria-selected')).toBe('true');

    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(anytime);
    expect(anytime.getAttribute('aria-selected')).toBe('true');
    expect(panel.getAttribute('aria-labelledby')).toBe('plan-tab-anytime');
  });

  it('places the Scheduled time picker beside the results heading and preserves tab-to-picker focus and filtering', async () => {
    const user = userEvent.setup();
    renderToday();
    const plan = screen.getByRole('region', { name: "Today's plan" });
    const tabList = within(plan).getByRole('tablist', { name: 'Plan items' });
    const controls = plan.querySelector('.today-plan__controls')!;
    const results = plan.querySelector('.today-plan__results')!;
    const timePicker = within(plan).getByRole('combobox', { name: /Filter scheduled Rhythms by time, currently Now/ });
    const viewHeading = plan.querySelector('.today-plan__view-heading')!;
    const progressRow = plan.querySelector('.show-tended-list__progress-row')!;
    const leftColumn = plan.querySelector('.today-plan__left-column')!;
    const headerActions = plan.querySelector('.today-plan__header-actions')!;
    const panel = within(plan).getByRole('tabpanel');

    expect(plan.classList.contains('card')).toBe(false);
    expect(controls.children).toHaveLength(1);
    expect(controls.querySelector('.show-tended-list__progress-row')).toBeNull();
    expect(controls.querySelector('.current-plan-items')).toBeNull();
    expect(controls.contains(tabList)).toBe(true);
    expect(controls.contains(timePicker)).toBe(false);
    expect(controls.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(plan.querySelector('.today-plan__time-label')).toBeNull();
    expect(timePicker.getAttribute('aria-label')).toBe('Filter scheduled Rhythms by time, currently Now');
    expect(tabList.compareDocumentPosition(timePicker) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const titleRow = plan.querySelector('.today-plan__title-row')!;
    expect(titleRow.contains(plan.querySelector('.today-plan__heading'))).toBe(true);
    expect(titleRow.contains(progressRow)).toBe(true);
    expect(titleRow.compareDocumentPosition(tabList) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(leftColumn.contains(viewHeading)).toBe(true);
    expect(leftColumn.contains(progressRow)).toBe(false);
    expect(headerActions.contains(timePicker)).toBe(true);
    expect(leftColumn.compareDocumentPosition(headerActions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(panel.querySelector('.today-rhythm-details-dialog--inline')!)
      .toBeTruthy();
    expect(results.compareDocumentPosition(panel.querySelector('.today-rhythm-details-dialog--inline')!)
      & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(controls.contains(panel)).toBe(false);
    expect(progressRow.contains(progressRow.querySelector('.show-tended-list__disclosure'))).toBe(true);

    within(tabList).getByRole('tab', { name: 'Scheduled' }).focus();
    await user.tab();
    expect(document.activeElement).toBe(timePicker);

    await user.click(timePicker);
    await user.click(within(plan).getByRole('option', { name: /^Morning/ }));
    expect(within(plan).getByRole('combobox', { name: /Filter scheduled Rhythms by time, currently Morning/ })).toBeTruthy();
    expect(within(plan).getByRole('article', { name: 'Pray together' })).toBeTruthy();
  });

  it('keeps focus-frame hover and keyboard focus separate from activation', async () => {
    const user = userEvent.setup();
    renderToday();
    const plan = screen.getByRole('region', { name: "Today's plan" });
    const trigger = within(plan).getByRole('combobox', { name: /Filter scheduled Rhythms by time, currently Now/ });
    await user.click(trigger);

    const evening = within(plan).getByRole('option', { name: /Evening.*6:00pm – 9:30pm.*1 item/ });
    const initialTendedCount = within(plan).getByText('1 of 1 tended').textContent;
    await user.hover(evening);
    expect(evening.getAttribute('aria-selected')).toBe('false');
    expect(within(plan).getByRole('combobox', { name: /Filter scheduled Rhythms by time, currently Now/ })).toBeTruthy();
    expect(within(plan).getByText(initialTendedCount!)).toBeTruthy();
    expect(within(plan).getByRole('article', { name: 'Pray together' })).toBeTruthy();
    expect(within(plan).queryByRole('status')).toBeNull();
    expect(plan.querySelector('.today-plan__weather')).toBeNull();

    await user.unhover(evening);
    expect(evening.getAttribute('aria-selected')).toBe('false');

    await user.keyboard('{ArrowDown}');
    const everythingOption = within(plan).getByRole('option', { name: /Everything today/ });
    expect(document.activeElement).toBe(everythingOption);
    expect(everythingOption.getAttribute('aria-selected')).toBe('false');
    expect(within(plan).getByText(initialTendedCount!)).toBeTruthy();

    await user.keyboard('{Enter}');
    expect(within(plan).getByRole('combobox', { name: /Filter scheduled Rhythms by time, currently Everything today/ })).toBeTruthy();
    expect(within(plan).getByText('1 of 3 tended')).toBeTruthy();
    expect(within(plan).getByRole('article', { name: 'Daily connection' })).toBeTruthy();
    expect(within(plan).queryByText(/Weather is unavailable/)).toBeNull();
    expect(document.activeElement).toBe(within(plan).getByRole('combobox', {
      name: 'Filter scheduled Rhythms by time, currently Everything today'
    }));
  });

  it('counts only the active tab and time-filter results before hiding tended Rhythms', async () => {
    const user = userEvent.setup();
    const rhythms: RhythmPreview[] = [
      { ...todayRhythms[0]!, id: 'synthetic-morning', title: 'Morning rhythm', timeOfDay: 'morning' },
      { ...todayRhythms[1]!, id: 'synthetic-afternoon', title: 'Afternoon rhythm', timeOfDay: 'afternoon' },
      { ...todayRhythms[2]!, id: 'synthetic-anytime', title: 'Anytime rhythm', timeOfDay: 'anytime' },
      { ...todayRhythms[2]!, id: 'synthetic-all-day', title: 'All-day rhythm', timeOfDay: 'all-day' }
    ];
    renderToday(undefined, {
      rhythms,
      satisfiedRhythmIds: new Set(['synthetic-morning', 'synthetic-anytime']),
      showTended: true
    });
    const plan = screen.getByRole('region', { name: "Today's plan" });
    expect(within(plan).getByText('1 of 1 tended')).toBeTruthy();
    expect(within(plan).getByRole('heading', { name: 'Now' })).toBeTruthy();
    const nowHeading = within(plan).getByRole('heading', { name: 'Now' });
    const nowTimeRange = within(plan).getByText(todayFocusContext(
      'now',
      'scheduled',
      new Date(2026, 9, 31, 10, 0),
      createDefaultTimeBlockSettings()
    ), { selector: '.today-plan__time-range' });
    expect(nowHeading.parentElement?.classList.contains('today-plan__heading-range-row')).toBe(true);
    expect(nowHeading.parentElement?.contains(nowTimeRange)).toBe(true);
    expect(nowHeading.compareDocumentPosition(nowTimeRange) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(within(plan).getByRole('combobox', { name: /Filter scheduled Rhythms by time, currently Now/ }));
    await user.click(within(plan).getByRole('option', { name: /Everything today/ }));
    expect(within(plan).getByText('1 of 2 tended')).toBeTruthy();
    expect(within(plan).getByRole('combobox', { name: /Filter scheduled Rhythms by time, currently Everything today/ })).toBeTruthy();
    expect(within(plan).queryByRole('heading', { name: 'Everything today' })).toBeNull();
    expect(plan.querySelector('.today-plan__view-heading-row')).toBeNull();
    expect(plan.querySelector('.today-plan__results')).toBeTruthy();
    expect(plan.querySelector('.current-plan-items--scheduled-everything')).toBeNull();
    expect(within(plan).getByRole('heading', { name: 'Morning' })).toBeTruthy();
    expect(within(plan).getByRole('heading', { name: 'Afternoon' })).toBeTruthy();
    expect(within(plan).getAllByRole('heading', { name: 'Afternoon' })).toHaveLength(1);
    for (const blockId of ['morning', 'afternoon'] as const) {
      const groupHeading = within(plan).getByRole('heading', {
        name: blockId === 'morning' ? 'Morning' : 'Afternoon'
      });
      const groupRange = within(plan).getByText(todayFocusContext(
        blockId,
        'scheduled',
        new Date(2026, 9, 31, 10, 0),
        createDefaultTimeBlockSettings()
      ), { selector: '.today-plan__time-range' });
      expect(groupHeading.parentElement?.classList.contains('today-plan__heading-range-row')).toBe(true);
      expect(groupHeading.parentElement?.contains(groupRange)).toBe(true);
      expect(groupHeading.compareDocumentPosition(groupRange) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    const firstGroupHeading = within(plan).getByRole('heading', { name: 'Morning' });
    const progressRow = plan.querySelector<HTMLDivElement>('.show-tended-list__progress-row')!;
    const firstGroupHeadingRow = firstGroupHeading.closest<HTMLElement>('.current-plan-item-group-heading-row')!;
    const titleRow = plan.querySelector('.today-plan__title-row')!;
    const timePicker = within(plan).getByRole('combobox', {
      name: 'Filter scheduled Rhythms by time, currently Everything today'
    });
    expect(firstGroupHeadingRow.contains(timePicker)).toBe(true);
    expect(titleRow.contains(progressRow)).toBe(true);
    expect(titleRow.compareDocumentPosition(firstGroupHeadingRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(progressRow.contains(within(progressRow).getByRole('button', { name: 'Hide tended Rhythms, 1 of 2 tended' }))).toBe(true);
    expect(plan.querySelectorAll('.current-plan-item-group-heading-row .today-plan__focus-picker')).toHaveLength(1);
    expect(plan.querySelectorAll('.show-tended-list__progress-row')).toHaveLength(1);

    await user.click(within(plan).getByRole('button', { name: 'Hide tended Rhythms, 1 of 2 tended' }));
    expect(within(plan).getByText('1 of 2 tended')).toBeTruthy();
    expect(within(plan).getByRole('article', { name: 'Afternoon rhythm' })).toBeTruthy();
    expect(within(plan).queryByRole('article', { name: 'Morning rhythm' })).toBeNull();
    expect(plan.querySelectorAll('.show-tended-list__progress-row')).toHaveLength(1);

    await user.click(within(plan).getByRole('combobox', { name: /Filter scheduled Rhythms by time, currently Everything today/ }));
    await user.click(within(plan).getByRole('option', { name: /^Afternoon/ }));
    expect(within(plan).getByRole('heading', { name: 'Afternoon' })).toBeTruthy();
    expect(within(plan).getAllByText(todayFocusContext(
      'afternoon',
      'scheduled',
      new Date(2026, 9, 31, 10, 0),
      createDefaultTimeBlockSettings()
    ), { selector: '.today-plan__time-range' })).toHaveLength(1);
    expect(plan.querySelector('.today-plan__results')).toBeTruthy();
    expect(within(plan).getByText('0 of 1 tended')).toBeTruthy();

    await user.click(within(plan).getByRole('tab', { name: 'Anytime' }));
    expect(within(plan).queryByRole('combobox', { name: /Filter scheduled Rhythms by time/ })).toBeNull();
    expect(within(plan).getByRole('heading', { name: 'Anytime' })).toBeTruthy();
    expect(plan.querySelector('.today-plan__time-range')).toBeNull();
    expect(within(plan).getByText('1 of 1 tended')).toBeTruthy();
    expect(within(plan).queryByRole('article', { name: 'Anytime rhythm' })).toBeNull();

    await user.click(within(plan).getByRole('tab', { name: 'All-day' }));
    expect(within(plan).queryByRole('combobox', { name: /Filter scheduled Rhythms by time/ })).toBeNull();
    expect(within(plan).getByRole('heading', { name: 'All-day' })).toBeTruthy();
    expect(plan.querySelector('.today-plan__time-range')).toBeNull();
    expect(within(plan).getByText('0 of 1 tended')).toBeTruthy();
    expect(within(plan).getByRole('article', { name: 'All-day rhythm' })).toBeTruthy();
  });

  it('uses the same results layout when Afternoon is the first Everything today group', async () => {
    const user = userEvent.setup();
    renderToday(undefined, {
      rhythms: [{
        ...todayRhythms[1]!,
        id: 'synthetic-afternoon-only',
        title: 'Afternoon rhythm',
        timeOfDay: 'afternoon'
      }],
      satisfiedRhythmIds: new Set()
    });
    const plan = screen.getByRole('region', { name: "Today's plan" });

    await user.click(within(plan).getByRole('combobox', { name: /Filter scheduled Rhythms by time, currently Now/ }));
    await user.click(within(plan).getByRole('option', { name: /Everything today/ }));

    const results = plan.querySelector('.today-plan__results')!;
    const groupHeadings = [...results.querySelectorAll('.current-plan-item-group-title')];
    expect(groupHeadings.map(heading => heading.textContent)).toEqual(['Afternoon']);
    expect(results.querySelector('.current-plan-items--scheduled-everything')).toBeNull();
    expect(plan.querySelectorAll('.show-tended-list__progress-row')).toHaveLength(1);
    expect(within(plan).getByRole('article', { name: 'Afternoon rhythm' })).toBeTruthy();
  });

  it('keeps tabs first, hides scheduled controls from other tabs, and preserves the scheduled filter and count', async () => {
    const user = userEvent.setup();
    const weatherController: TodayWeatherController = {
      ...unavailableWeather,
      city: { id: 1, name: 'Example City', admin1: null, country: 'Example', countryCode: 'EX', latitude: 0, longitude: 0 },
      weather: {
        status: 'ready',
        report: {
          current: { date: '2026-10-31', time: '10:00', temperature: 18, code: 0, isDay: true },
          hourly: [
            { date: '2026-10-31', time: '10:00', temperature: 18, code: 0, isDay: true },
            { date: '2026-10-31', time: '18:00', temperature: 16, code: 2, isDay: true }
          ]
        },
        fetchedAt: 0,
        message: null
      }
    };
    renderToday(weatherController);
    const plan = screen.getByRole('region', { name: "Today's plan" });
    const tabList = within(plan).getByRole('tablist', { name: 'Plan items' });
    const trigger = within(plan).getByRole('combobox', { name: /Filter scheduled Rhythms by time, currently Now/ });
    expect(tabList.compareDocumentPosition(trigger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(plan).getByRole('img', { name: 'Current conditions: Clear, 18 degrees' })).toBeTruthy();

    await user.click(trigger);
    await user.click(within(plan).getByRole('option', { name: /Evening.*6:00pm – 9:30pm/ }));
    expect(within(plan).getByRole('img', { name: 'Forecast: Partly cloudy, 16 degrees' })).toBeTruthy();
    expect(within(plan).getByText('6:00pm – 9:30pm', {
      selector: '.today-plan__time-range'
    })).toBeTruthy();
    expect(within(plan).getByText('0 of 1 tended')).toBeTruthy();

    for (const tabName of ['Anytime', 'All-day']) {
      const tab = within(plan).getByRole('tab', { name: tabName });
      await user.click(tab);
      expect(tab.getAttribute('aria-selected')).toBe('true');
      expect(within(plan).queryByRole('listbox', { name: 'Filter scheduled Rhythms by time' })).toBeNull();
      expect(plan.querySelector('.today-plan__weather')).toBeNull();
      expect(within(plan).getByText(/\d+ of \d+ tended/)).toBeTruthy();
    }

    await user.click(within(plan).getByRole('tab', { name: 'Scheduled' }));
    const scheduledTrigger = within(plan).getByRole('combobox', { name: /Filter scheduled Rhythms by time, currently Evening/ });
    expect(scheduledTrigger).toBeTruthy();
    await user.click(scheduledTrigger);
    await user.click(within(plan).getByRole('option', { name: /Everything today/ }));
    expect(within(plan).queryByRole('img')).toBeNull();
    expect(within(plan).queryByText('Across every time block')).toBeNull();
    await user.click(within(plan).getByRole('combobox', {
      name: 'Filter scheduled Rhythms by time, currently Everything today'
    }));
    expect(within(plan).getByRole('option', { name: /Everything today.*Across every time block/ })).toBeTruthy();
  });

  it('keeps long custom block names in the selector without losing the right-side forecast', async () => {
    const user = userEvent.setup();
    const timeBlockSettings = createDefaultTimeBlockSettings();
    const longName = 'An intentionally long custom evening time block';
    timeBlockSettings.blocks = timeBlockSettings.blocks.map(block =>
      block.id === 'evening' ? { ...block, name: longName } : block
    );
    const weatherController: TodayWeatherController = {
      ...unavailableWeather,
      city: { id: 1, name: 'Example City', admin1: null, country: 'Example', countryCode: 'EX', latitude: 0, longitude: 0 },
      weather: {
        status: 'ready',
        report: {
          current: { date: '2026-10-31', time: '10:00', temperature: 18, code: 2, isDay: true },
          hourly: [
            { date: '2026-10-31', time: '10:00', temperature: 18, code: 2, isDay: true },
            { date: '2026-10-31', time: '18:00', temperature: 16, code: 3, isDay: true }
          ]
        },
        fetchedAt: 0,
        message: null
      }
    };
    renderToday(weatherController, { timeBlockSettings });
    const plan = screen.getByRole('region', { name: "Today's plan" });
    const trigger = within(plan).getByLabelText(/Filter scheduled Rhythms by time, currently Now/);

    await user.click(trigger);
    const customOption = within(plan).getByRole('option', {
      name: new RegExp(`${longName}.*6:00pm – 9:30pm`)
    });
    expect(customOption).toBeTruthy();
    await user.click(customOption);

    expect(trigger.getAttribute('aria-label')).toBe(`Filter scheduled Rhythms by time, currently ${longName}`);
    expect(trigger.querySelector(':scope > span:first-child')?.textContent).toBe(longName);
    expect(within(plan).getByRole('img', { name: 'Forecast: Cloudy, 16 degrees' })).toBeTruthy();
    expect(plan.querySelector('.today-plan__weather')).not.toBeNull();
  });
});
