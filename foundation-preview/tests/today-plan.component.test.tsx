import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TodayView } from '../src/components/TodayView.tsx';
import type { TodayWeatherController } from '../src/components/useTodayWeather.ts';
import type { TodayFocusId } from '../src/domain/today-plan.ts';
import { foundationCatalogue, todayRhythms } from '../src/domain/preview-data.ts';
import { TimeBlocksProvider } from '../src/components/TimeBlocksContext.tsx';
import { createDefaultTimeBlockSettings } from '../src/domain/time-blocks.ts';
import type { TimeBlockSettings } from '../src/domain/time-blocks.ts';

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
  categoryHealthScores = new Map()
}: {
  weatherController?: TodayWeatherController;
  satisfiedRhythmIds?: ReadonlySet<string>;
  showTended?: boolean;
  timeBlockSettings?: TimeBlockSettings;
  categoryHealthScores?: ReadonlyMap<string, number | null>;
}) {
  const [focus, setFocus] = useState<TodayFocusId>('now');
  const [tendedVisible, setTendedVisible] = useState(showTended);
  return (
    <TimeBlocksProvider settings={timeBlockSettings}>
      <TodayView
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
        rhythms={todayRhythms}
        rhythmScores={new Map()}
        categoryHealthScores={categoryHealthScores}
        search=""
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
  } = {}
) {
  return render(<TodayHarness
    {...(weatherController ? { weatherController } : {})}
    {...options}
  />);
}

describe('Today time-frame interaction', () => {
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
    expect(within(plan).getByText('Now', { selector: 'summary span' })).toBeTruthy();
    expect(within(plan).getByText('1 of 1 tended')).toBeTruthy();
    expect(within(plan).getByRole('article', { name: 'Pray together' })).toBeTruthy();
    expect(within(plan).queryByRole('article', { name: 'Daily connection' })).toBeNull();
    expect(within(plan).queryByRole('heading', { name: 'Your plan' })).toBeNull();

    await user.click(within(plan).getByText('Now', { selector: 'summary span' }));
    expect(within(plan).getByRole('button', { name: /Now.*9:00am – 11:30am/ })).toBeTruthy();
    await user.click(within(plan).getByRole('button', { name: /Evening/ }));

    expect(within(plan).queryByText('6:00pm – 9:30pm')).toBeNull();
    expect(within(plan).getByText('0 of 1 tended')).toBeTruthy();
    expect(within(plan).getByRole('article', { name: 'Daily connection' })).toBeTruthy();
    expect(within(plan).queryByRole('article', { name: 'Pray together' })).toBeNull();
    await user.click(within(plan).getByText('Evening', { selector: 'summary span' }));
    expect(within(plan).getByRole('button', { name: /Evening.*6:00pm – 9:30pm/ })).toBeTruthy();
  });

  it('offers Everything today and the three preserved item-type tabs with ARIA selection', async () => {
    const user = userEvent.setup();
    renderToday();
    const plan = screen.getByRole('region', { name: "Today's plan" });
    await user.click(within(plan).getByText('Now', { selector: 'summary span' }));
    await user.click(within(plan).getByRole('button', { name: /Everything today/ }));

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
    expect(within(plan).getByText('No eligible Anytime rhythms.')).toBeTruthy();
  });

  it('distinguishes an all-tended selection from an empty tab and keeps Show tended available', async () => {
    const user = userEvent.setup();
    renderToday(undefined, {
      satisfiedRhythmIds: new Set(['sample-pray-together']),
      showTended: false
    });
    const plan = screen.getByRole('region', { name: "Today's plan" });

    expect(within(plan).getByText('1 of 1 tended')).toBeTruthy();
    expect(within(plan).getByRole('button', { name: 'Show tended' }).getAttribute('aria-pressed'))
      .toBe('false');
    expect(within(plan).getByRole('status').textContent).toBe('You’ve tended everything here.');

    await user.click(within(plan).getByRole('tab', { name: 'Anytime' }));
    expect(within(plan).getByText('No eligible Anytime rhythms.')).toBeTruthy();
    expect(within(plan).queryByText('You’ve tended everything here.')).toBeNull();
    expect(within(plan).getByRole('button', { name: 'Show tended' })).toBeTruthy();
  });

  it('shows current progress with a compact, accessible Show/Hide action on every plan tab', async () => {
    const user = userEvent.setup();
    renderToday(undefined, { showTended: false });
    const plan = screen.getByRole('region', { name: "Today's plan" });
    const toggle = () => within(plan).getByRole('button', { name: 'Show tended' });

    for (const tabName of ['Scheduled', 'Anytime', 'All-day']) {
      await user.click(within(plan).getByRole('tab', { name: tabName }));
      expect(within(plan).getByText(/\d+ of \d+ tended/).className)
        .toContain('show-tended-list__progress');
      expect(toggle().getAttribute('aria-pressed')).toBe('false');
      expect(toggle().textContent).toBe('Show tended');
      expect(plan.querySelector('.show-tended-list__progress svg')?.getAttribute('aria-hidden')).toBe('true');
      const tabList = within(plan).getByRole('tablist', { name: 'Plan items' });
      const progressRow = plan.querySelector('.show-tended-list__progress-row');
      expect(progressRow).toBeTruthy();
      expect(tabList.compareDocumentPosition(progressRow!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

      await user.click(toggle());
      const hideToggle = within(plan).getByRole('button', { name: 'Hide tended' });
      expect(hideToggle.getAttribute('aria-pressed')).toBe('true');
      expect(hideToggle.textContent).toBe('Hide tended');
      await user.click(hideToggle);
    }
  });

  it('moves focus and activates Today plan tabs with arrows, Home, and End', async () => {
    const user = userEvent.setup();
    renderToday();
    const plan = screen.getByRole('region', { name: "Today's plan" });
    await user.click(within(plan).getByText('Now', { selector: 'summary span' }));
    await user.click(within(plan).getByRole('button', { name: /Everything today/ }));

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

  it('places the Scheduled time picker after the tended row and preserves tab-to-picker focus and filtering', async () => {
    const user = userEvent.setup();
    renderToday();
    const plan = screen.getByRole('region', { name: "Today's plan" });
    const tabList = within(plan).getByRole('tablist', { name: 'Plan items' });
    const progressRow = plan.querySelector('.show-tended-list__progress-row')!;
    const timePicker = within(plan).getByText('Now', { selector: 'summary span' }).closest('summary')!;
    const panel = within(plan).getByRole('tabpanel');

    expect(tabList.compareDocumentPosition(progressRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(progressRow.compareDocumentPosition(timePicker) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(timePicker.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    within(tabList).getByRole('tab', { name: 'Scheduled' }).focus();
    await user.tab();
    expect(document.activeElement).toBe(within(plan).getByRole('button', { name: 'Hide tended' }));
    await user.tab();
    expect(document.activeElement).toBe(timePicker);

    await user.click(timePicker);
    await user.click(within(plan).getByRole('button', { name: /Morning/ }));
    expect(within(plan).getByText('Morning', { selector: 'summary span' })).toBeTruthy();
    expect(within(plan).getByRole('article', { name: 'Pray together' })).toBeTruthy();
  });

  it('keeps focus-frame hover and keyboard focus separate from activation', async () => {
    const user = userEvent.setup();
    renderToday();
    const plan = screen.getByRole('region', { name: "Today's plan" });
    const trigger = plan.querySelector('.today-plan__focus-trigger') as HTMLElement;
    await user.click(trigger);

    const evening = within(plan).getByRole('button', { name: /Evening.*6:00pm – 9:30pm.*1 item/ });
    const initialTendedCount = within(plan).getByText('1 of 1 tended').textContent;
    await user.hover(evening);
    expect(evening.getAttribute('aria-pressed')).toBe('false');
    expect(within(plan).getByText('Now', { selector: 'summary span' })).toBeTruthy();
    expect(within(plan).getByText(initialTendedCount!)).toBeTruthy();
    expect(within(plan).getByRole('article', { name: 'Pray together' })).toBeTruthy();
    expect(within(plan).queryByRole('status')).toBeNull();
    expect(plan.querySelector('.today-plan__weather')).toBeNull();

    await user.unhover(evening);
    expect(evening.getAttribute('aria-pressed')).toBe('false');

    await user.tab();
    const nowOption = within(plan).getByRole('button', { name: /^Now/ });
    expect(document.activeElement).toBe(nowOption);
    await user.tab();
    const everythingOption = within(plan).getByRole('button', { name: /Everything today/ });
    expect(document.activeElement).toBe(everythingOption);
    expect(everythingOption.getAttribute('aria-pressed')).toBe('false');
    expect(within(plan).getByText(initialTendedCount!)).toBeTruthy();

    await user.keyboard('{Enter}');
    expect(everythingOption.getAttribute('aria-pressed')).toBe('true');
    expect(within(plan).getByText('Everything today', { selector: 'summary span' })).toBeTruthy();
    expect(within(plan).getByText('1 of 3 tended')).toBeTruthy();
    expect(within(plan).getByRole('article', { name: 'Daily connection' })).toBeTruthy();
    expect(within(plan).queryByText(/Weather is unavailable/)).toBeNull();
    expect(document.activeElement).toBe(trigger);
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
    const trigger = plan.querySelector('.today-plan__focus-trigger') as HTMLElement;
    expect(tabList.compareDocumentPosition(trigger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(plan).getByRole('img', { name: 'Current conditions: Clear, 18 degrees' })).toBeTruthy();

    await user.click(trigger);
    await user.click(within(plan).getByRole('button', { name: /Evening.*6:00pm – 9:30pm/ }));
    expect(within(plan).getByRole('img', { name: 'Forecast: Partly cloudy, 16 degrees' })).toBeTruthy();
    expect(within(plan).queryByText('6:00pm – 9:30pm')).toBeNull();
    expect(within(plan).getByText('0 of 1 tended')).toBeTruthy();

    for (const tabName of ['Anytime', 'All-day']) {
      const tab = within(plan).getByRole('tab', { name: tabName });
      await user.click(tab);
      expect(tab.getAttribute('aria-selected')).toBe('true');
      expect(within(plan).queryByRole('group', { name: 'Time frames' })).toBeNull();
      expect(plan.querySelector('.today-plan__weather')).toBeNull();
      expect(within(plan).getByText(/\d+ of \d+ tended/)).toBeTruthy();
    }

    await user.click(within(plan).getByRole('tab', { name: 'Scheduled' }));
    expect(within(plan).getByText('Evening', { selector: 'summary span' })).toBeTruthy();
    await user.click(trigger);
    await user.click(within(plan).getByRole('button', { name: /Everything today/ }));
    expect(within(plan).queryByRole('img')).toBeNull();
    expect(within(plan).queryByText('Across every time block')).toBeNull();
    await user.click(trigger);
    expect(within(plan).getByRole('button', { name: /Everything today.*Across every time block/ })).toBeTruthy();
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
    const trigger = within(plan).getByLabelText('Choose a time frame, currently Now');

    await user.click(trigger);
    const customOption = within(plan).getByRole('button', {
      name: new RegExp(`${longName}.*6:00pm – 9:30pm`)
    });
    expect(customOption).toBeTruthy();
    await user.click(customOption);

    expect(trigger.getAttribute('aria-label')).toBe(`Choose a time frame, currently ${longName}`);
    expect(trigger.querySelector('span')?.textContent).toBe(longName);
    expect(within(plan).getByRole('img', { name: 'Forecast: Cloudy, 16 degrees' })).toBeTruthy();
    expect(plan.querySelector('.today-plan__weather')).not.toBeNull();
  });
});
