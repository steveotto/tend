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

const defaultTimeBlocks = createDefaultTimeBlockSettings();
const defaultInstant = new Date(2026, 9, 31, 10, 0);

function makeRhythm(id: string, title: string, timeOfDay: NonNullable<RhythmPreview['timeOfDay']>): RhythmPreview {
  return { ...todayRhythms[0]!, id, title, timeOfDay };
}

function TodayHarness({
  satisfiedRhythmIds = new Set(['sample-pray-together']),
  showTended = true,
  timeBlockSettings = defaultTimeBlocks,
  categoryHealthScores = new Map(),
  rhythms = todayRhythms,
  evaluationInstant = defaultInstant,
  localDate = '2026-10-31',
  initialView = 'now'
}: {
  satisfiedRhythmIds?: ReadonlySet<string>;
  showTended?: boolean;
  timeBlockSettings?: TimeBlockSettings;
  categoryHealthScores?: ReadonlyMap<string, number | null>;
  rhythms?: readonly RhythmPreview[];
  evaluationInstant?: Date;
  localDate?: string;
  initialView?: TodayViewId;
}) {
  const [view, setView] = useState<TodayViewId>(initialView);
  const [tendedVisible, setTendedVisible] = useState(showTended);
  const completedRhythms = new Set<string>();
  return (
    <TimeBlocksProvider settings={timeBlockSettings}>
      <TodayView
        greeting="Good morning"
        evaluationInstant={evaluationInstant}
        localDate={localDate}
        view={view}
        onViewChange={setView}
        weatherController={unavailableWeather}
        completedRhythms={completedRhythms}
        undoableRhythms={new Set()}
        satisfiedRhythmIds={satisfiedRhythmIds}
        showTended={tendedVisible}
        onShowTendedChange={setTendedVisible}
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
        onTend={vi.fn()}
        onEditRhythm={vi.fn()}
        onUndo={vi.fn()}
      />
    </TimeBlocksProvider>
  );
}

function renderToday(options: {
  satisfiedRhythmIds?: ReadonlySet<string>;
  showTended?: boolean;
  timeBlockSettings?: TimeBlockSettings;
  categoryHealthScores?: ReadonlyMap<string, number | null>;
  rhythms?: readonly RhythmPreview[];
  evaluationInstant?: Date;
  localDate?: string;
  initialView?: TodayViewId;
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
  it('keeps Overall Health category labels intact and in order beside their icon and score', () => {
    renderToday();
    const overall = screen.getByRole('region', { name: 'Overall health summary' });
    const categoryCards = within(overall).getAllByRole('button');
    expect(categoryCards.map(card => card.querySelector('.ma-name')?.textContent))
      .toEqual(areas.map(area => area.label));
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

  it('offers the quiet View all today action when Now is empty and distinguishes hidden tended items', async () => {
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
      satisfiedRhythmIds: new Set(['morning-item']),
      showTended: false
    });
    const hiddenPlan = todayPlan();
    expect(within(hiddenPlan).getByRole('status').textContent).toContain('You’ve tended everything here.');
    expect(within(hiddenPlan).queryByText('No active Rhythms right now.')).toBeNull();
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
    const morningProgress = within(morning).getByText('0 of 1 tended', { selector: '.today-plan__accordion-progress' });
    expect(morningProgress.parentElement?.classList.contains('today-timeframe-header__meta')).toBe(true);
    expect(within(morning).getByText(/9:00am/, { selector: '.today-timeframe-header__range' })).toBeTruthy();
    expect(morning.textContent).not.toContain('Rhythm');
    expect(morning.getAttribute('aria-expanded')).toBe('true');
    expect(lunch.getAttribute('aria-expanded')).toBe('false');
    expect(anytime.getAttribute('aria-expanded')).toBe('false');
    expect(within(anytime).getByText('On your schedule', { selector: '.today-timeframe-header__range' })).toBeTruthy();
    const allDay = within(plan).getByRole('button', { name: /^All-day/ });
    expect(within(allDay).getByText('Throughout the day', { selector: '.today-timeframe-header__range' })).toBeTruthy();
    expect(within(anytime).getByText('0 of 1 tended', { selector: '.today-plan__accordion-progress' })).toBeTruthy();
    expect(within(plan).queryByRole('button', { name: /Expand all|Collapse all/ })).toBeNull();

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

  it('shows collection counts before hiding tended Rhythms and keeps progress in collapsed summaries', async () => {
    const user = userEvent.setup();
    const rhythms = [
      makeRhythm('morning-one', 'Morning one', 'morning'),
      makeRhythm('morning-two', 'Morning two', 'morning'),
      makeRhythm('lunch-one', 'Lunch one', 'lunch')
    ];
    renderToday({
      rhythms,
      satisfiedRhythmIds: new Set(['morning-one']),
      showTended: false
    });
    const plan = todayPlan();
    expect(within(plan).getByText('1 of 2 tended')).toBeTruthy();
    expect(within(plan).getByRole('article', { name: 'Morning two' })).toBeTruthy();
    expect(within(plan).queryByRole('article', { name: 'Morning one' })).toBeNull();

    await user.click(within(planTabs(plan)).getByRole('tab', { name: 'All today' }));
    const morning = within(plan).getByRole('button', { name: /^Morning/ });
    expect(morning.textContent).toContain('1 of 2 tended');
    expect(morning.getAttribute('aria-expanded')).toBe('true');
    await user.click(morning);
    expect(morning.getAttribute('aria-expanded')).toBe('false');
    expect(morning.textContent).toContain('1 of 2 tended');
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
    expect(within(morning).getByText('0 of 20 tended')).toBeTruthy();
    expect(within(lunch).getByText('0 of 4 tended')).toBeTruthy();
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
    expect(within(plan).getByRole('status').textContent).toContain('No active Rhythms right now.');
    await user.click(within(planTabs(plan)).getByRole('tab', { name: 'All today' }));
    expect(plan.querySelectorAll('.today-timeframe-header__disclosure[aria-expanded="true"]')).toHaveLength(0);
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
