import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TodayTimeFilter } from '../src/components/TodayTimeFilter.tsx';
import { TimeBlocksProvider } from '../src/components/TimeBlocksContext.tsx';
import { TodayView } from '../src/components/TodayView.tsx';
import type { TodayWeatherController } from '../src/components/useTodayWeather.ts';
import { createDefaultTimeBlockSettings } from '../src/domain/time-blocks.ts';
import type { TimeBlockSettings } from '../src/domain/time-blocks.ts';
import { foundationCatalogue, todayRhythms } from '../src/domain/preview-data.ts';
import type { RhythmPreview } from '../src/domain/preview-data.ts';
import type { TodayFocusId, TodayViewId } from '../src/domain/today-plan.ts';
import { todayFocusContext } from '../src/domain/today-plan.ts';
import { areas } from '../src/domain/preview-data.ts';
import type { CalendarSource } from '../src/domain/calendar-sources.ts';
import type { WeatherCity } from '../src/weather/open-meteo.ts';

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
const testWeatherCity: WeatherCity = {
  id: 1,
  name: 'Springfield',
  admin1: 'Oregon',
  country: 'United States',
  countryCode: 'US',
  latitude: 44.05,
  longitude: -123.02
};
const availableWeather: TodayWeatherController = {
  ...unavailableWeather,
  city: testWeatherCity,
  weather: {
    status: 'ready',
    report: {
      current: {
        date: '2026-10-31',
        time: '10:00',
        temperature: 42,
        code: 3,
        isDay: true
      },
      hourly: []
    },
    fetchedAt: 1,
    message: null
  }
};

const defaultTimeBlocks = createDefaultTimeBlockSettings();
const defaultInstant = new Date(2026, 9, 31, 10, 0);

function makeRhythm(id: string, title: string, timeOfDay: NonNullable<RhythmPreview['timeOfDay']>): RhythmPreview {
  return { ...todayRhythms[0]!, id, title, timeOfDay };
}

function TodayHarness({
  greeting = 'Good morning',
  satisfiedRhythmIds = new Set(['sample-pray-together']),
  timeBlockSettings = defaultTimeBlocks,
  categoryHealthScores = new Map(),
  rhythms = todayRhythms,
  evaluationInstant = defaultInstant,
  localDate = '2026-10-31',
  initialView = 'now',
  calendarSources = [],
  weatherController = unavailableWeather
}: {
  greeting?: string;
  satisfiedRhythmIds?: ReadonlySet<string>;
  timeBlockSettings?: TimeBlockSettings;
  categoryHealthScores?: ReadonlyMap<string, number | null>;
  rhythms?: readonly RhythmPreview[];
  evaluationInstant?: Date;
  localDate?: string;
  initialView?: TodayViewId;
  calendarSources?: CalendarSource[];
  weatherController?: TodayWeatherController;
}) {
  const [view, setView] = useState<TodayViewId>(initialView);
  const [completedRhythms, setCompletedRhythms] = useState<ReadonlySet<string>>(new Set());
  return (
    <TimeBlocksProvider settings={timeBlockSettings}>
      <TodayView
        greeting={greeting}
        evaluationInstant={evaluationInstant}
        localDate={localDate}
        view={view}
        onViewChange={setView}
        weatherController={weatherController}
        completedRhythms={completedRhythms}
        undoableRhythms={new Set(rhythms.map(rhythm => rhythm.id))}
        satisfiedRhythmIds={new Set([...satisfiedRhythmIds, ...completedRhythms])}
        rhythms={rhythms}
        rhythmScores={new Map()}
        prayerRequests={[]}
        onPrayForRequest={vi.fn(() => null)}
        categoryHealthScores={categoryHealthScores}
        onNavigate={vi.fn()}
        onPersonSelect={vi.fn()}
        foundations={foundationCatalogue}
        onOpenFoundation={vi.fn()}
        onHistory={vi.fn()}
        onTend={id => setCompletedRhythms(current => new Set(current).add(id))}
        onEditRhythm={vi.fn()}
        onUndo={id => setCompletedRhythms(current => {
          const next = new Set(current);
          next.delete(id);
          return next;
        })}
        calendarSources={calendarSources}
      />
    </TimeBlocksProvider>
  );
}

function renderToday(options: {
  greeting?: string;
  satisfiedRhythmIds?: ReadonlySet<string>;
  timeBlockSettings?: TimeBlockSettings;
  categoryHealthScores?: ReadonlyMap<string, number | null>;
  rhythms?: readonly RhythmPreview[];
  evaluationInstant?: Date;
  localDate?: string;
  initialView?: TodayViewId;
  calendarSources?: CalendarSource[];
  weatherController?: TodayWeatherController;
} = {}) {
  return render(<TodayHarness {...options} />);
}

function TimeFilterHarness({
  rhythms = todayRhythms,
  timeBlockSettings = defaultTimeBlocks
}: {
  rhythms?: readonly RhythmPreview[];
  timeBlockSettings?: TimeBlockSettings;
}) {
  const [focus, setFocus] = useState<TodayFocusId>('now');
  return (
    <TimeBlocksProvider settings={timeBlockSettings}>
      <TodayTimeFilter
        rhythms={rhythms}
        focus={focus}
        onFocusChange={setFocus}
        evaluationInstant={defaultInstant}
        timeBlocks={timeBlockSettings}
      />
    </TimeBlocksProvider>
  );
}

function renderTimeFilter(options: {
  rhythms?: readonly RhythmPreview[];
  timeBlockSettings?: TimeBlockSettings;
} = {}) {
  return render(<TimeFilterHarness {...options} />);
}

function todayPlan() {
  return screen.getByRole('region', { name: "Today's plan" });
}

function planTabs(plan: HTMLElement) {
  return within(plan).getByRole('tablist', { name: 'Today views' });
}

describe('Today time-frame interaction', () => {
  it('keeps compact weather beside Today in every view with accessible conditions', async () => {
    const user = userEvent.setup();
    renderToday({ weatherController: availableWeather });
    const plan = todayPlan();
    const titleMain = plan.querySelector<HTMLElement>('.today-plan__title-main')!;
    expect(within(titleMain).getByRole('heading', { name: 'Today' })).toBeTruthy();
    expect(within(titleMain).getByRole('img', {
      name: 'Current conditions: Cloudy, 42 degrees'
    }).getAttribute('title')).toBe('Cloudy');
    expect(within(titleMain).getByText('42').parentElement?.querySelector('sup')?.textContent).toBe('°');
    expect(within(titleMain).getByText('Cloudy', { selector: '.visually-hidden' })).toBeTruthy();
    expect(plan.querySelectorAll('.today-plan__title-weather')).toHaveLength(1);
    expect(plan.querySelector<HTMLElement>('.today-timeframe-header .today-plan__weather')).toBeNull();
    expect(plan.querySelector('.today-plan__title-row .today-plan__title-progress')).toBeTruthy();

    for (const viewName of ['Flexible', 'All today']) {
      await user.click(within(planTabs(plan)).getByRole('tab', { name: viewName }));
      expect(plan.querySelectorAll('.today-plan__title-weather')).toHaveLength(1);
      expect(within(titleMain).getByRole('img', {
        name: 'Current conditions: Cloudy, 42 degrees'
      })).toBeTruthy();
      expect(plan.querySelector('.today-timeframe-header .today-plan__weather')).toBeNull();
    }
  });

  it('omits weather for loading, failed, or unconfigured conditions', () => {
    for (const status of ['loading', 'error'] as const) {
      const controller: TodayWeatherController = {
        ...availableWeather,
        weather: { status, report: null, fetchedAt: null, message: null }
      };
      const { unmount } = render(<TodayHarness weatherController={controller} />);
      expect(document.querySelector('.today-plan__title-weather')).toBeNull();
      unmount();
    }
    renderToday();
    expect(document.querySelector('.today-plan__title-weather')).toBeNull();
  });

  it('places the simple greeting directly above the existing Overall Health card', () => {
    renderToday();
    const dashboard = document.querySelector('.home-dashboard');
    const greeting = dashboard?.querySelector(':scope > .sectiontitle.dashboard-greeting');
    const overall = screen.getByRole('region', { name: 'Overall health summary' });
    expect(dashboard).toBeTruthy();
    expect(greeting?.tagName).toBe('DIV');
    expect(within(greeting as HTMLElement).getByRole('heading', { name: 'Good morning' })).toBeTruthy();
    expect(greeting?.querySelector('.dashboard-greeting__subline')).toBeNull();
    expect(greeting?.nextElementSibling).toBe(overall);
    expect(document.querySelector('.today-dawn-hero')).toBeNull();
    expect(within(overall).getByText('Overall health')).toBeTruthy();
    expect(overall.querySelector('[role="meter"]')).toBeTruthy();

    const categories = screen.getByRole('navigation', { name: 'Today categories' });
    const plan = screen.getByRole('region', { name: "Today's plan" });
    expect(overall.contains(categories)).toBe(true);
    expect(greeting && (greeting.compareDocumentPosition(categories) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
    expect(categories.compareDocumentPosition(plan) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(categories).getAllByRole('button'))
      .toHaveLength(areas.filter(area => area.id !== 'dating').length);
    expect(within(categories).getAllByRole('button')
      .every(category => category.querySelector('.ma-score__value')?.textContent?.trim() === '—')).toBe(true);
  });

  it('preserves the existing time-based greeting without a supporting sentence', () => {
    for (const greeting of ['Good morning', 'Good afternoon', 'Good evening']) {
      const { unmount } = renderToday({ greeting });
      expect(screen.getByRole('heading', { name: greeting })).toBeTruthy();
      expect(document.querySelector('.dashboard-greeting__subline')).toBeNull();
      unmount();
    }
  });

  it('keeps Overall Health category labels intact and in order beside their icon and score', () => {
    renderToday();
    const categoryNavigation = screen.getByRole('navigation', { name: 'Today categories' });
    const categoryCards = within(categoryNavigation).getAllByRole('button');
    expect(categoryCards.map(card => card.querySelector('.ma-name')?.textContent))
      .toEqual(areas.filter(area => area.id !== 'dating').map(area => area.label));
    for (const card of categoryCards) {
      expect(card.querySelector('.menu-area-icon')?.getAttribute('aria-hidden')).toBe('true');
      expect(card.querySelector('.ma-score__value')).toBeTruthy();
    }
  });

  it('shows the equal-weight average of available category Health values without coverage text', () => {
    renderToday({
      categoryHealthScores: new Map([
        ['faith', 100],
        ['marriage', 13],
        ['parenting', 13]
      ])
    });
    const overall = screen.getByRole('region', { name: 'Overall health summary' });
    const categories = screen.getByRole('navigation', { name: 'Today categories' });
    expect(overall.contains(categories)).toBe(true);
    expect(within(categories).getAllByRole('button'))
      .toHaveLength(areas.filter(area => area.id !== 'dating').length);
    expect(within(categories).getAllByRole('button').slice(0, 3)
      .map(category => category.querySelector('.ma-score__value')?.textContent?.trim()))
      .toEqual(['100', '13', '13']);
    expect(within(overall).getByText('42', { selector: '.ov-score' })).toBeTruthy();
    expect(within(overall).queryByText(/categories scored/)).toBeNull();
    expect(overall.querySelector('.overall-health-coverage')).toBeNull();
    expect(within(overall).getByRole('meter', {
      name: 'Overall health score 42 out of 100'
    }).getAttribute('aria-valuenow')).toBe('42');
  });

  it('includes zero in the Today Overall Health average', () => {
    renderToday({ categoryHealthScores: new Map([['faith', 0]]) });
    const overall = screen.getByRole('region', { name: 'Overall health summary' });
    expect(within(overall).getByText('0', { selector: '.ov-score' })).toBeTruthy();
    expect(within(overall).queryByText(/categories scored/)).toBeNull();
    expect(overall.querySelector('.overall-health-coverage')).toBeNull();
    expect(within(overall).getByRole('meter', { name: 'Overall health score 0 out of 100' })
      .getAttribute('aria-valuenow')).toBe('0');
  });

  it('defaults to Now and shows only today’s scheduled Rhythms in the current block', () => {
    const rhythms = [
      makeRhythm('morning-item', 'Morning item', 'morning'),
      makeRhythm('afternoon-item', 'Afternoon item', 'afternoon'),
      makeRhythm('anytime-item', 'Anytime item', 'anytime'),
      makeRhythm('all-day-item', 'All-day item', 'all-day')
    ];
    renderToday({ rhythms, satisfiedRhythmIds: new Set() });
    const plan = todayPlan();
    expect(within(planTabs(plan)).getByRole('tab', { name: 'Now' }).getAttribute('aria-selected')).toBe('true');
    expect(plan.querySelector('.today-timeframe-header .today-plan__view-heading')?.textContent).toBe('Morning');
    expect(within(plan).getByText(todayFocusContext(
      'now', 'scheduled', defaultInstant, defaultTimeBlocks
    ), { selector: '.today-timeframe-header__range' })).toBeTruthy();
    expect(within(plan).getByRole('article', { name: 'Morning item' })).toBeTruthy();
    expect(within(plan).queryByRole('article', { name: 'Afternoon item' })).toBeNull();
    expect(within(plan).queryByRole('article', { name: 'Anytime item' })).toBeNull();
    expect(within(plan).queryByRole('article', { name: 'All-day item' })).toBeNull();
    expect(within(plan).queryByRole('combobox')).toBeNull();
  });

  it('moves focus and activates tabs with arrows, Home, and End while keeping tab and panel ARIA in sync', async () => {
    const user = userEvent.setup();
    renderToday();
    const plan = todayPlan();
    const tabList = planTabs(plan);
    const now = within(tabList).getByRole('tab', { name: 'Now' });
    const flexible = within(tabList).getByRole('tab', { name: 'Flexible' });
    const allToday = within(tabList).getByRole('tab', { name: 'All today' });
    const panel = within(plan).getByRole('tabpanel');

    now.focus();
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(allToday);
    expect(allToday.getAttribute('aria-selected')).toBe('true');
    expect(allToday.tabIndex).toBe(0);
    expect(now.tabIndex).toBe(-1);
    expect(panel.getAttribute('aria-labelledby')).toBe('plan-tab-all-today');

    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(now);
    expect(now.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(allToday);
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(now);
    await user.click(flexible);
    expect(flexible.getAttribute('aria-selected')).toBe('true');
    expect(panel.getAttribute('aria-labelledby')).toBe('plan-tab-flexible');
  });

  it('shows Anytime and All-day groups in order on Flexible without scheduled Rhythms', async () => {
    const user = userEvent.setup();
    const rhythms = [
      makeRhythm('morning-item', 'Morning item', 'morning'),
      makeRhythm('anytime-item', 'Anytime item', 'anytime'),
      makeRhythm('all-day-item', 'All-day item', 'all-day')
    ];
    renderToday({ rhythms, satisfiedRhythmIds: new Set() });
    const plan = todayPlan();
    await user.click(within(planTabs(plan)).getByRole('tab', { name: 'Flexible' }));
    const groupHeadings = [...plan.querySelectorAll('.today-plan__flexible-group .today-plan__view-heading')];
    expect(groupHeadings.map(heading => heading.textContent)).toEqual(['Anytime', 'All-day']);
    expect(within(plan).getByText('On your schedule', { selector: '.today-timeframe-header__range' })).toBeTruthy();
    expect(within(plan).getByText('Throughout the day', { selector: '.today-timeframe-header__range' })).toBeTruthy();
    expect(within(plan).getByRole('article', { name: 'Anytime item' })).toBeTruthy();
    expect(within(plan).getByRole('article', { name: 'All-day item' })).toBeTruthy();
    expect(within(plan).queryByRole('article', { name: 'Morning item' })).toBeNull();
  });

  it('shows display-only group counts in Now and Flexible without adding collapse controls', async () => {
    const user = userEvent.setup();
    const rhythms = [
      makeRhythm('morning-one', 'Morning one', 'morning'),
      makeRhythm('morning-two', 'Morning two', 'morning'),
      makeRhythm('anytime-item', 'Anytime item', 'anytime'),
      makeRhythm('all-day-item', 'All-day item', 'all-day')
    ];
    renderToday({ rhythms, satisfiedRhythmIds: new Set(['morning-one']) });
    const plan = todayPlan();
    expect(within(plan).getByText('1 of 2', { selector: '.today-timeframe-header__progress' })).toBeTruthy();
    expect(plan.querySelector('.today-timeframe-header__disclosure')).toBeNull();
    expect(plan.querySelector('.today-plan__agenda-marker')).toBeNull();
    expect(plan.querySelector('.today-plan__agenda-rail')).toBeNull();
    expect(plan.querySelector('.today-plan__agenda-group--expanded')).toBeTruthy();

    await user.click(within(planTabs(plan)).getByRole('tab', { name: 'Flexible' }));
    expect(within(plan).getAllByText('0 of 1', { selector: '.today-timeframe-header__progress' })).toHaveLength(2);
    expect(plan.querySelector('.today-plan__agenda-marker')).toBeNull();
    expect(plan.querySelector('.today-timeframe-header__disclosure')).toBeNull();
    expect(plan.querySelectorAll('.today-plan__agenda-group--expanded')).toHaveLength(2);
  });

  it('offers View all today when Now is empty and keeps completed Rhythms in done rows', async () => {
    const user = userEvent.setup();
    const afternoon = makeRhythm('afternoon-item', 'Afternoon item', 'afternoon');
    renderToday({ rhythms: [afternoon], satisfiedRhythmIds: new Set() });
    const plan = todayPlan();
    expect(within(plan).getByRole('status').textContent).toContain('No active Rhythms right now.');
    await user.click(within(plan).getByRole('button', { name: 'View all today' }));
    expect(within(planTabs(plan)).getByRole('tab', { name: 'All today' }).getAttribute('aria-selected')).toBe('true');

    cleanup();
    renderToday({
      rhythms: [makeRhythm('morning-item', 'Morning item', 'morning')],
      satisfiedRhythmIds: new Set(['morning-item'])
    });
    const completedPlan = todayPlan();
    const completedRow = within(completedPlan).getByRole('button', {
      name: 'Morning item, Tended today'
    });
    expect(completedRow.getAttribute('aria-expanded')).toBe('false');
    expect(within(completedPlan).queryByRole('article', { name: 'Morning item' })).toBeNull();
    expect(within(completedPlan).queryByRole('button', { name: /Show tended|Hide tended/ })).toBeNull();
  });

  it('updates Now when the time advances and uses configured block labels and hours', () => {
    const settings = createDefaultTimeBlockSettings();
    settings.blocks = settings.blocks.map(block => block.id === 'lunch'
      ? { ...block, name: 'Midday', start: '12:00', end: '13:00' }
      : block);
    const rhythms = [
      makeRhythm('morning-item', 'Morning item', 'morning'),
      makeRhythm('lunch-item', 'Lunch item', 'lunch')
    ];
    const { rerender } = render(<TodayHarness
      rhythms={rhythms}
      satisfiedRhythmIds={new Set()}
      timeBlockSettings={settings}
      evaluationInstant={new Date(2026, 9, 31, 10, 0)}
    />);
    const plan = todayPlan();
    expect(plan.querySelector('.today-timeframe-header .today-plan__view-heading')?.textContent).toBe('Morning');
    expect(within(plan).getByRole('article', { name: 'Morning item' })).toBeTruthy();

    rerender(<TodayHarness
      rhythms={rhythms}
      satisfiedRhythmIds={new Set()}
      timeBlockSettings={settings}
      evaluationInstant={new Date(2026, 9, 31, 12, 15)}
    />);
    expect(plan.querySelector('.today-timeframe-header .today-plan__view-heading')?.textContent).toBe('Midday');
    expect(within(plan).getByText(todayFocusContext(
      'lunch', 'scheduled', new Date(2026, 9, 31, 12, 15), settings
    ), { selector: '.today-timeframe-header__range' })).toBeTruthy();
    expect(within(plan).getByRole('article', { name: 'Lunch item' })).toBeTruthy();
    expect(within(plan).queryByRole('article', { name: 'Morning item' })).toBeNull();
  });

  it('keeps All today groups independently expandable and preserves expansion choices', async () => {
    const user = userEvent.setup();
    const rhythms = [
      makeRhythm('morning-item', 'Morning item', 'morning'),
      makeRhythm('lunch-item', 'Lunch item', 'lunch'),
      makeRhythm('anytime-item', 'Anytime item', 'anytime'),
      makeRhythm('all-day-item', 'All-day item', 'all-day')
    ];
    const { rerender } = renderToday({ rhythms, satisfiedRhythmIds: new Set() });
    const plan = todayPlan();
    await user.click(within(planTabs(plan)).getByRole('tab', { name: 'All today' }));
    const morning = within(plan).getByRole('button', { name: /^Morning, .*0 of 1 tended$/ });
    const lunch = within(plan).getByRole('button', { name: /^Lunch/ });
    const anytime = within(plan).getByRole('button', { name: /^Anytime/ });
    const morningPanel = document.getElementById(morning.getAttribute('aria-controls')!);
    expect(morningPanel?.getAttribute('aria-labelledby')).toBe(morning.id);
    expect(within(morning).getByText('Morning', { selector: '.today-plan__view-heading' })).toBeTruthy();
    const morningProgress = within(morning).getByText('0 of 1', { selector: '.today-timeframe-header__progress' });
    expect(morningProgress.parentElement?.classList.contains('today-timeframe-header__meta')).toBe(true);
    expect(morningProgress.getAttribute('aria-hidden')).toBe('true');
    expect(morningProgress.textContent).not.toContain('tended');
    expect(within(morning).getByText(/9:00am/, { selector: '.today-timeframe-header__range' })).toBeTruthy();
    expect(morning.textContent).not.toContain('Rhythm');
    expect(morning.getAttribute('aria-expanded')).toBe('true');
    expect(lunch.getAttribute('aria-expanded')).toBe('false');
    expect(morning.querySelector('.today-plan__agenda-marker path')?.getAttribute('d')).toBe('M6 10h8');
    expect(lunch.querySelector('.today-plan__agenda-marker path')?.getAttribute('d')).toBe('M6 10h8M10 6v8');
    expect(morning.querySelector('.today-plan__agenda-marker')?.getAttribute('aria-hidden')).toBe('true');
    expect(morning.querySelector('.today-plan__agenda-marker')?.closest('button')).toBe(morning);
    expect(morning.querySelector('button button')).toBeNull();
    expect(morning.closest('.today-timeframe-header')?.classList.contains('today-timeframe-header--collapsed')).toBe(false);
    expect(lunch.closest('.today-timeframe-header')?.classList.contains('today-timeframe-header--collapsed')).toBe(true);
    expect(anytime.getAttribute('aria-expanded')).toBe('false');
    expect(within(anytime).getByText('On your schedule', { selector: '.today-timeframe-header__range' })).toBeTruthy();
    const allDay = within(plan).getByRole('button', { name: /^All-day/ });
    expect(within(allDay).getByText('Throughout the day', { selector: '.today-timeframe-header__range' })).toBeTruthy();
    expect(within(anytime).getByText('0 of 1', { selector: '.today-timeframe-header__progress' })).toBeTruthy();
    expect(within(plan).getByRole('button', { name: /^Morning, .*0 of 1 tended$/ })).toBeTruthy();
    expect(within(plan).queryByRole('button', { name: /Expand all|Collapse all/ })).toBeNull();

    const morningMarker = morning.querySelector<SVGSVGElement>('.today-plan__agenda-marker');
    expect(morningMarker).toBeTruthy();
    await user.click(morningMarker!);
    expect(morning.getAttribute('aria-expanded')).toBe('false');
    expect(morning.querySelector('.today-plan__agenda-marker path')?.getAttribute('d')).toBe('M6 10h8M10 6v8');

    await user.pointer({ target: morningMarker!, keys: '[TouchA]' });
    expect(morning.getAttribute('aria-expanded')).toBe('true');
    expect(morning.querySelector('.today-plan__agenda-marker path')?.getAttribute('d')).toBe('M6 10h8');

    morning.focus();
    await user.keyboard('{Enter}');
    expect(morning.getAttribute('aria-expanded')).toBe('false');
    expect(morning.querySelector('.today-plan__agenda-marker path')?.getAttribute('d')).toBe('M6 10h8M10 6v8');
    expect(morning.closest('.today-timeframe-header')?.classList.contains('today-timeframe-header--collapsed')).toBe(true);
    await user.keyboard(' ');
    expect(morning.getAttribute('aria-expanded')).toBe('true');
    expect(morning.querySelector('.today-plan__agenda-marker path')?.getAttribute('d')).toBe('M6 10h8');
    expect(morning.closest('.today-timeframe-header')?.classList.contains('today-timeframe-header--collapsed')).toBe(false);
    await user.click(lunch);
    await user.click(morning);
    expect(morning.getAttribute('aria-expanded')).toBe('false');
    expect(lunch.getAttribute('aria-expanded')).toBe('true');
    await user.click(morning);
    expect(morning.getAttribute('aria-expanded')).toBe('true');
    expect(lunch.getAttribute('aria-expanded')).toBe('true');
    expect(plan.querySelectorAll('.today-timeframe-header__disclosure[aria-expanded="true"]')).toHaveLength(2);

    await user.click(within(planTabs(plan)).getByRole('tab', { name: 'Flexible' }));
    await user.click(within(planTabs(plan)).getByRole('tab', { name: 'All today' }));
    expect(plan.querySelectorAll('.today-timeframe-header__disclosure[aria-expanded="true"]')).toHaveLength(2);
    rerender(<TodayHarness rhythms={rhythms} satisfiedRhythmIds={new Set()} />);
    expect(plan.querySelectorAll('.today-timeframe-header__disclosure[aria-expanded="true"]')).toHaveLength(2);
  });

  it('opens the current timeframe on entry and adds new defaults across time transitions without resetting choices', async () => {
    const user = userEvent.setup();
    const timeBlockSettings = {
      ...defaultTimeBlocks,
      blocks: defaultTimeBlocks.blocks.map(block => {
        if (block.id === 'lunch') return { ...block, start: '12:00' };
        if (block.id === 'afternoon') return { ...block, start: '13:00' };
        if (block.id === 'evening') return { ...block, start: '17:00' };
        return block;
      })
    };
    const rhythms = [
      makeRhythm('morning-item', 'Morning item', 'morning'),
      makeRhythm('lunch-item', 'Lunch item', 'lunch'),
      makeRhythm('afternoon-item', 'Afternoon item', 'afternoon'),
      makeRhythm('anytime-item', 'Anytime item', 'anytime'),
      makeRhythm('all-day-item', 'All-day item', 'all-day')
    ];
    const { rerender } = renderToday({
      rhythms,
      satisfiedRhythmIds: new Set(),
      timeBlockSettings,
      evaluationInstant: new Date(2026, 9, 31, 10, 0)
    });
    const plan = todayPlan();
    await user.click(within(planTabs(plan)).getByRole('tab', { name: 'All today' }));
    const group = (name: string) => within(plan).getByRole('button', { name: new RegExp(`^${name}`) });
    const morning = group('Morning');
    const lunch = group('Lunch');
    const afternoon = group('Afternoon');
    const anytime = group('Anytime');
    const allDay = group('All-day');

    expect(morning.getAttribute('aria-expanded')).toBe('true');
    expect(lunch.getAttribute('aria-expanded')).toBe('false');
    expect(afternoon.getAttribute('aria-expanded')).toBe('false');
    expect(anytime.getAttribute('aria-expanded')).toBe('false');
    expect(allDay.getAttribute('aria-expanded')).toBe('false');

    await user.click(morning);
    await user.click(anytime);
    rerender(<TodayHarness
      rhythms={rhythms}
      satisfiedRhythmIds={new Set()}
      timeBlockSettings={timeBlockSettings}
      evaluationInstant={new Date(2026, 9, 31, 12, 30)}
    />);
    expect(morning.getAttribute('aria-expanded')).toBe('false');
    expect(lunch.getAttribute('aria-expanded')).toBe('true');
    expect(anytime.getAttribute('aria-expanded')).toBe('true');
    expect(afternoon.getAttribute('aria-expanded')).toBe('false');

    await user.click(lunch);
    rerender(<TodayHarness
      rhythms={rhythms}
      satisfiedRhythmIds={new Set()}
      timeBlockSettings={timeBlockSettings}
      evaluationInstant={new Date(2026, 9, 31, 14, 0)}
    />);
    expect(lunch.getAttribute('aria-expanded')).toBe('false');
    expect(afternoon.getAttribute('aria-expanded')).toBe('true');
    expect(morning.getAttribute('aria-expanded')).toBe('false');
    expect(anytime.getAttribute('aria-expanded')).toBe('true');

    rerender(<TodayHarness
      rhythms={rhythms}
      satisfiedRhythmIds={new Set()}
      timeBlockSettings={timeBlockSettings}
      evaluationInstant={new Date(2026, 10, 1, 10, 0)}
      localDate="2026-11-01"
    />);
    expect(morning.getAttribute('aria-expanded')).toBe('false');
    expect(afternoon.getAttribute('aria-expanded')).toBe('true');
    expect(anytime.getAttribute('aria-expanded')).toBe('true');
  });

  it('omits empty timeframe groups and does not expand the first visible group when the current one is empty', () => {
    const rhythms = [makeRhythm('morning-item', 'Morning item', 'morning')];
    renderToday({
      rhythms,
      satisfiedRhythmIds: new Set(),
      initialView: 'all-today',
      evaluationInstant: new Date(2026, 9, 31, 12, 30)
    });
    const plan = todayPlan();
    expect(within(plan).getByRole('button', { name: /^Morning/ }).getAttribute('aria-expanded')).toBe('false');
    expect(within(plan).queryByRole('button', { name: /^Lunch/ })).toBeNull();
    expect(plan.querySelectorAll('.today-timeframe-header__disclosure[aria-expanded="true"]')).toHaveLength(0);
  });

  it('keeps tended Rhythms in their original time group and position through expand, collapse, and Undo', async () => {
    const user = userEvent.setup();
    const rhythms = [
      makeRhythm('morning-one', 'Morning one', 'morning'),
      makeRhythm('morning-two', 'Morning two', 'morning'),
      makeRhythm('lunch-one', 'Lunch one', 'lunch')
    ];
    renderToday({ rhythms, satisfiedRhythmIds: new Set() });
    const plan = todayPlan();
    expect(within(plan).queryByRole('button', { name: /Show tended|Hide tended/ })).toBeNull();

    await user.click(within(planTabs(plan)).getByRole('tab', { name: 'All today' }));
    const morning = within(plan).getByRole('button', { name: /^Morning,/ });
    const morningPanelId = morning.getAttribute('aria-controls')!;
    const morningPanel = plan.querySelector<HTMLElement>(`#${morningPanelId}`)!;
    expect(morning.getAttribute('aria-expanded')).toBe('true');
    const morningOrder = () => [...morningPanel.querySelectorAll<HTMLElement>('[data-tended-rhythm-item]')]
      .map(item => item.dataset.tendedRhythmItem);
    expect(morningOrder()).toEqual(['morning-one', 'morning-two']);
    expect(morning.querySelector('.today-timeframe-header__progress')?.textContent).toBe('0 of 2');

    await user.click(within(morningPanel).getByRole('button', { name: 'Tend Morning one' }));
    const row = within(morningPanel).getByRole('button', { name: 'Morning one, Tended today' });
    expect(morningOrder()).toEqual(['morning-one', 'morning-two']);
    expect(row.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(row);
    expect(morning.querySelector('.today-timeframe-header__progress')?.textContent).toBe('1 of 2');
    expect(plan.querySelector('.today-plan__title-progress')?.textContent).toContain('1 of 3 tended');
    expect(within(morningPanel).getByRole('article', { name: 'Morning two' })).toBeTruthy();
    expect(within(morningPanel).queryByRole('heading', { name: 'Tended today' })).toBeNull();

    await user.click(row);
    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(within(morningPanel).getByRole('article', { name: 'Morning one' })).toBeTruthy();
    expect(morningOrder()).toEqual(['morning-one', 'morning-two']);
    await user.click(row);
    expect(row.getAttribute('aria-expanded')).toBe('false');
    expect(within(morningPanel).queryByRole('article', { name: 'Morning one' })).toBeNull();
    expect(morningOrder()).toEqual(['morning-one', 'morning-two']);

    await user.click(row);
    const tendedItem = row.closest<HTMLElement>('[data-tended-rhythm-item]')!;
    await user.click(within(tendedItem).getByRole('button', { name: /Undo/ }));
    expect(within(morningPanel).getByRole('article', { name: 'Morning one' })).toBeTruthy();
    expect(morningOrder()).toEqual(['morning-one', 'morning-two']);
    expect(document.activeElement).toBe(within(morningPanel).getByRole('button', { name: 'Tend Morning one' }));
    expect(morning.querySelector('.today-timeframe-header__progress')?.textContent).toBe('0 of 2');
    expect(plan.querySelector('.today-plan__title-progress')?.textContent).toContain('0 of 3 tended');

    await user.click(morning);
    expect(morning.getAttribute('aria-expanded')).toBe('false');
    expect(morningPanel.hidden).toBe(true);
    expect(morning.querySelector('.today-timeframe-header__progress')?.textContent).toBe('0 of 2');
  });

  it('renders 20-plus Rhythms without losing group counts or progress', async () => {
    const user = userEvent.setup();
    const rhythms = Array.from({ length: 24 }, (_, index) =>
      makeRhythm(`item-${index}`, `Rhythm ${index + 1}`, index < 20 ? 'morning' : 'lunch'));
    renderToday({ rhythms, satisfiedRhythmIds: new Set() });
    const plan = todayPlan();
    await user.click(within(planTabs(plan)).getByRole('tab', { name: 'All today' }));
    const morning = within(plan).getByRole('button', { name: /^Morning, .*0 of 20 tended$/ });
    const lunch = within(plan).getByRole('button', { name: /^Lunch, .*0 of 4 tended$/ });
    expect(within(morning).getByText('0 of 20', { selector: '.today-timeframe-header__progress' })).toBeTruthy();
    expect(within(lunch).getByText('0 of 4', { selector: '.today-timeframe-header__progress' })).toBeTruthy();
    expect(within(plan).getAllByRole('article')).toHaveLength(20);
    await user.click(lunch);
    expect(within(plan).getAllByRole('article')).toHaveLength(24);
  });

  it('leaves sections collapsed when there is no current eligible scheduled group', async () => {
    const user = userEvent.setup();
    renderToday({
      rhythms: [makeRhythm('morning-item', 'Morning item', 'morning')],
      satisfiedRhythmIds: new Set(),
      evaluationInstant: new Date(2026, 9, 31, 3, 0)
    });
    const plan = todayPlan();
    expect(plan.querySelector('.today-timeframe-header .today-plan__view-heading')?.textContent).toBe('Now');
    const emptyState = within(plan).getByRole('status');
    expect(emptyState.textContent).toContain('No active Rhythms right now.');
    await user.click(within(emptyState).getByRole('button', { name: 'View all today' }));
    expect(within(planTabs(plan)).getByRole('tab', { name: 'All today' }).getAttribute('aria-selected'))
      .toBe('true');
    expect(plan.querySelectorAll('.today-timeframe-header__disclosure[aria-expanded="true"]')).toHaveLength(0);
  });

  it('keeps empty messages consistent across Now, Flexible, and All today', async () => {
    const user = userEvent.setup();
    renderToday({ rhythms: [] });
    const plan = todayPlan();

    expect(within(plan).getByText('No active Rhythms right now.')).toBeTruthy();
    expect(within(plan).getByRole('button', { name: 'View all today' })).toBeTruthy();

    await user.click(within(planTabs(plan)).getByRole('tab', { name: 'Flexible' }));
    expect(within(plan).getByText('No flexible Rhythms due today.')).toBeTruthy();
    expect(within(plan).queryByRole('button', { name: 'View all today' })).toBeNull();

    await user.click(within(planTabs(plan)).getByRole('tab', { name: 'All today' }));
    expect(within(plan).getByText('No Rhythms due today.')).toBeTruthy();
    expect(within(plan).queryByRole('button', { name: 'View all today' })).toBeNull();
  });

  it('shows the local-reader scope for configured calendar sources without a settings shortcut', () => {
    renderToday({
      calendarSources: [{
        id: 'calendar-source-preview',
        name: 'Synthetic work',
        url: 'https://p123-caldav.icloud.com/published/synthetic-only'
      }]
    });

    const calendarSection = document.querySelector<HTMLElement>('.today-calendar-section')!;
    expect(calendarSection.textContent).toContain('Calendar reading is available only in the isolated local preview.');
    expect(within(calendarSection).queryByRole('button', { name: /settings/i })).toBeNull();
  });

  it('retains the reusable time filter options and keyboard selection outside Today’s rendered layout', async () => {
    const user = userEvent.setup();
    renderTimeFilter();
    const trigger = screen.getByRole('combobox', { name: /Filter scheduled Rhythms by time, currently Now/ });
    await user.click(trigger);
    expect(screen.getByRole('option', { name: /Everything today.*Across every time block/ })).toBeTruthy();
    expect(screen.getByRole('option', { name: /Morning.*9:00am – 11:30am/ })).toBeTruthy();
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('option', { name: /Everything today/ }));
    await user.keyboard('{Enter}');
    expect(screen.getByRole('combobox', { name: /currently Everything today/ })).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: /Filter scheduled Rhythms by time/ })).toBeTruthy();
  });
});
