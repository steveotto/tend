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
  weatherController = unavailableWeather
}: {
  weatherController?: TodayWeatherController;
}) {
  const [focus, setFocus] = useState<TodayFocusId>('now');
  return (
    <TimeBlocksProvider settings={createDefaultTimeBlockSettings()}>
      <TodayView
        greeting="Good morning"
        evaluationInstant={new Date(2026, 9, 31, 10, 0)}
        localDate="2026-10-31"
        focus={focus}
        onFocusChange={setFocus}
        weatherController={weatherController}
        completedRhythms={new Set(['sample-pray-together'])}
        undoableRhythms={new Set()}
        rhythms={todayRhythms}
        rhythmScores={new Map()}
        marriageHealthScore={null}
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

function renderToday(weatherController?: TodayWeatherController) {
  return render(<TodayHarness {...(weatherController ? { weatherController } : {})} />);
}

describe('Today time-frame interaction', () => {
  it('defaults to Now, counts only the selected range, and keeps the selected block during the visit', async () => {
    const user = userEvent.setup();
    renderToday();
    const plan = screen.getByRole('region', { name: "Today's plan" });
    expect(within(plan).getByText('Now', { selector: 'summary span' })).toBeTruthy();
    expect(within(plan).getByText('9:00am – 11:30am')).toBeTruthy();
    expect(within(plan).getByText('1 of 1 tended')).toBeTruthy();
    expect(within(plan).getByRole('article', { name: 'Pray together' })).toBeTruthy();
    expect(within(plan).queryByRole('article', { name: 'Daily connection' })).toBeNull();
    expect(within(plan).queryByRole('heading', { name: 'Your plan' })).toBeNull();

    await user.click(within(plan).getByText('Now', { selector: 'summary span' }));
    await user.click(within(plan).getByRole('button', { name: /Evening/ }));

    expect(within(plan).getByText('6:00pm – 9:30pm')).toBeTruthy();
    expect(within(plan).getByText('0 of 1 tended')).toBeTruthy();
    expect(within(plan).getByRole('article', { name: 'Daily connection' })).toBeTruthy();
    expect(within(plan).queryByRole('article', { name: 'Pray together' })).toBeNull();
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
    expect(within(plan).getByText('6:00pm – 9:30pm')).toBeTruthy();
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
    expect(within(plan).getByText('6:00pm – 9:30pm')).toBeTruthy();
    await user.click(trigger);
    await user.click(within(plan).getByRole('button', { name: /Everything today/ }));
    expect(within(plan).queryByRole('img')).toBeNull();
    expect(within(plan).getByText('Across every time block')).toBeTruthy();
  });
});
