import { act, cleanup, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TodayWeatherPanel } from '../src/components/TodayWeatherPanel.tsx';
import { useTodayWeather } from '../src/components/useTodayWeather.ts';
import type { OpenMeteoWeatherClient } from '../src/weather/open-meteo.ts';
import {
  normalizeGeocodingResponse,
  OpenMeteoWeatherClient as WeatherClient,
  WEATHER_CACHE_DURATION_MS
} from '../src/weather/open-meteo.ts';

let geolocationDescriptor: PropertyDescriptor | undefined;
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  if (geolocationDescriptor) Object.defineProperty(navigator, 'geolocation', geolocationDescriptor);
  else Reflect.deleteProperty(navigator, 'geolocation');
  geolocationDescriptor = undefined;
});

const locations = {
  results: [
    { id: 11, name: 'Springfield', admin1: 'Oregon', country: 'United States', country_code: 'US', latitude: 44.05, longitude: -123.02 },
    { id: 12, name: 'Springfield', admin1: 'Illinois', country: 'United States', country_code: 'US', latitude: 39.78, longitude: -89.64 }
  ]
};

const forecast = {
  timezone: 'GMT',
  timezone_abbreviation: 'GMT',
  utc_offset_seconds: 0,
  current: { time: '2026-10-31T17:00', temperature_2m: 64.7, weather_code: 2, is_day: 1 },
  hourly: {
    time: ['2026-10-31T17:00', '2026-11-01T01:00'],
    temperature_2m: [64.7, 52],
    weather_code: [2, 0],
    is_day: [1, 0]
  }
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function WeatherHarness({ client, enabled = true }: {
  client: OpenMeteoWeatherClient;
  enabled?: boolean;
}) {
  const [time, setTime] = useState<string | null | undefined>(null);
  const controller = useTodayWeather(enabled, 'America/Los_Angeles', client);
  return (
    <>
      <TodayWeatherPanel controller={controller} localDate="2026-10-31" time={time} />
      <button type="button" onClick={() => setTime('18:00')}>Evening</button>
      <button type="button" onClick={() => setTime(undefined)}>Everything today</button>
    </>
  );
}

describe('Today city weather flow', () => {
  it('searches only on submit, distinguishes city results, then updates Now and selected-period weather', async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input.toString());
      return url.hostname === 'geocoding-api.open-meteo.com' ? response(locations) : response(forecast);
    });
    const client = new WeatherClient(fetcher);
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem');
    render(<WeatherHarness client={client} />);
    expect(screen.getByRole('status').textContent).toContain('choose a city');
    expect(fetcher).not.toHaveBeenCalled();
    expect(storageWrite).not.toHaveBeenCalled();

    await user.click(screen.getByText('Choose city'));
    await user.type(screen.getByLabelText('City or postal code'), 'Springfield');
    expect(fetcher).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Search' }));

    const results = await screen.findByRole('group', { name: 'Matching locations' });
    const options = within(results).getAllByRole('button');
    expect(options).toHaveLength(2);
    expect(options[0]?.textContent).toContain('Oregon, United States');
    expect(options[1]?.textContent).toContain('Illinois, United States');
    expect(fetcher).toHaveBeenCalledTimes(1);

    await user.click(options[0]!);
    expect(screen.getByText('Springfield, Oregon, United States')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Matching locations' })).toBeNull();
    expect(await screen.findByRole('img', {
      name: 'Current conditions: Partly cloudy, 65 degrees'
    })).toBeTruthy();
    expect(fetcher).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole('button', { name: 'Evening' }));
    expect(await screen.findByRole('img', { name: 'Forecast: Clear night, 52 degrees' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Everything today' }));
    expect(screen.getByRole('status').textContent).toBe('Weather is not shown for Everything today.');
    expect(screen.queryByRole('img')).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('keeps the selected city on forecast failure and retries without another search', async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(locations))
      .mockResolvedValueOnce(response({}, 503))
      .mockResolvedValueOnce(response(forecast));
    const client = new WeatherClient(fetcher);
    render(<WeatherHarness client={client} />);
    await user.click(screen.getByText('Choose city'));
    await user.type(screen.getByLabelText('City or postal code'), 'Springfield');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    const result = await screen.findByRole('button', { name: /Springfield.*Oregon, United States/ });
    await user.click(result);
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.getByText('Springfield, Oregon, United States')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('img', { name: 'Current conditions: Partly cloudy, 65 degrees' })).toBeTruthy();
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(screen.getByText(/cleared when this preview reloads/)).toBeTruthy();
  });

  it('ignores a stale forecast after selecting a different city and cancels work when Today is left', async () => {
    let resolveOld!: (value: Response) => void;
    const fetcher = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
      const url = new URL(input.toString());
      if (url.hostname === 'geocoding-api.open-meteo.com') return Promise.resolve(response(locations));
      if (url.searchParams.get('latitude') === '44.05') {
        return new Promise<Response>(resolve => { resolveOld = resolve; });
      }
      return Promise.resolve(response(forecast));
    });
    const client = new WeatherClient(fetcher);
    const { result, rerender } = renderHook(
      ({ enabled }) => useTodayWeather(enabled, 'America/Los_Angeles', client),
      { initialProps: { enabled: true } }
    );
    await act(async () => { result.current.searchCities('Springfield'); });
    await waitFor(() => expect(result.current.search.results).toHaveLength(2));
    const [oldCity, newCity] = result.current.search.results;
    act(() => result.current.selectCity(oldCity!));
    await waitFor(() => expect(resolveOld).toBeTypeOf('function'));
    const oldRequestSignal = fetcher.mock.calls[1]?.[1]?.signal;
    act(() => result.current.selectCity(newCity!));
    expect(oldRequestSignal?.aborted).toBe(true);
    await waitFor(() => expect(result.current.city?.admin1).toBe('Illinois'));
    await waitFor(() => expect(result.current.weather.status).toBe('ready'));
    await act(async () => { resolveOld(response(forecast)); });
    expect(result.current.city?.admin1).toBe('Illinois');
    expect(result.current.weather.report?.current.temperature).toBe(64.7);

    rerender({ enabled: false });
  });

  it('does not request location or persist a city automatically, and cleans up refresh timers on exit', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input.toString());
      return url.hostname === 'geocoding-api.open-meteo.com' ? response(locations) : response(forecast);
    });
    const client = new WeatherClient(fetcher);
    geolocationDescriptor = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
    const getPosition = vi.fn();
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: getPosition }
    });
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem');
    const { result, unmount } = renderHook(
      ({ enabled }) => useTodayWeather(enabled, 'America/Los_Angeles', client),
      { initialProps: { enabled: true } }
    );
    expect(fetcher).not.toHaveBeenCalled();
    expect(getPosition).not.toHaveBeenCalled();
    expect(storageWrite).not.toHaveBeenCalled();
    await act(async () => { result.current.searchCities('Springfield'); });
    await act(async () => { await Promise.resolve(); });
    act(() => result.current.selectCity(normalizeGeocodingResponse(locations)[0]!));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.weather.status).toBe('ready');
    expect(fetcher).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(WEATHER_CACHE_DURATION_MS + 1); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(result.current.weather.status).toBe('ready');
    unmount();
    await act(async () => { vi.advanceTimersByTime(WEATHER_CACHE_DURATION_MS + 100); });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
