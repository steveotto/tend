import { describe, expect, it, vi } from 'vitest';
import { selectWeatherForTime } from '../src/domain/today-weather.ts';
import {
  normalizeForecastResponse,
  normalizeGeocodingResponse,
  OpenMeteoWeatherClient,
  WEATHER_CACHE_DURATION_MS
} from '../src/weather/open-meteo.ts';
import type { WeatherCity } from '../src/weather/open-meteo.ts';

const city: WeatherCity = {
  id: 1,
  name: 'Springfield',
  admin1: 'Oregon',
  country: 'United States',
  countryCode: 'US',
  latitude: 44.05,
  longitude: -123.02
};

function forecastResponse() {
  return {
    timezone: 'GMT',
    timezone_abbreviation: 'GMT',
    utc_offset_seconds: 0,
    current: { time: '2026-10-31T17:00', temperature_2m: 64.7, weather_code: 2, is_day: 1 },
    hourly: {
      time: [
        '2026-10-31T17:00',
        '2026-11-01T01:00',
        '2026-11-01T05:30',
        '2026-11-01T08:30',
        '2026-11-01T09:30'
      ],
      temperature_2m: [64.7, 52, 48, 47, 46],
      weather_code: [2, 0, 3, 0, 0],
      is_day: [1, 0, 0, 0, 0]
    }
  };
}

describe('Open-Meteo weather adapter', () => {
  it('validates and labels geocoding results without collapsing distinct places', () => {
    expect(normalizeGeocodingResponse({
      results: [
        { id: 1, name: 'Springfield', admin1: 'Oregon', country: 'United States', country_code: 'US', latitude: 44.05, longitude: -123.02 },
        { id: 2, name: 'Springfield', admin1: 'Illinois', country: 'United States', country_code: 'US', latitude: 39.78, longitude: -89.64 }
      ]
    })).toMatchObject([
      { id: 1, name: 'Springfield', admin1: 'Oregon', country: 'United States', latitude: 44.05 },
      { id: 2, name: 'Springfield', admin1: 'Illinois', country: 'United States', latitude: 39.78 }
    ]);
    expect(() => normalizeGeocodingResponse({ results: [{ name: 'Nowhere' }] })).toThrow(/incomplete city result/);
    expect(() => normalizeGeocodingResponse({ results: 'not an array' })).toThrow(/invalid response/);
  });

  it('normalizes explicit UTC timestamps into Today’s local date and time across overnight and DST boundaries', () => {
    const report = normalizeForecastResponse(forecastResponse(), 'America/Los_Angeles');
    expect(report.current).toMatchObject({ date: '2026-10-31', time: '10:00', temperature: 64.7 });
    expect(report.hourly.map(({ date, time }) => `${date} ${time}`)).toEqual([
      '2026-10-31 10:00',
      '2026-10-31 18:00',
      '2026-10-31 22:30',
      '2026-11-01 01:30',
      '2026-11-01 01:30'
    ]);
    expect(selectWeatherForTime(report, '2026-10-31', '18:00')).toMatchObject({
      temperature: 52,
      isDay: false
    });
    expect(selectWeatherForTime(report, '2026-10-31', '22:30')).toMatchObject({
      temperature: 48,
      code: 3
    });
    expect(selectWeatherForTime(report, '2026-11-01', '01:30')).toMatchObject({
      temperature: 46
    });
    expect(selectWeatherForTime(report, '2026-11-02', '18:00')).toBeNull();
  });

  it('rejects provider offsets, malformed observation values, and mismatched hourly arrays', () => {
    expect(() => normalizeForecastResponse({
      ...forecastResponse(),
      timezone: 'America/Los_Angeles',
      utc_offset_seconds: -25200
    }, 'America/Los_Angeles')).toThrow(/requested UTC timestamps/);
    expect(() => normalizeForecastResponse({
      ...forecastResponse(),
      hourly: { ...forecastResponse().hourly, temperature_2m: [1] }
    }, 'UTC')).toThrow(/incomplete hourly forecast/);
    expect(() => normalizeForecastResponse({
      ...forecastResponse(),
      current: { ...forecastResponse().current, temperature_2m: 'warm' }
    }, 'UTC')).toThrow(/incomplete observation/);
    expect(() => normalizeForecastResponse({
      ...forecastResponse(),
      current: { ...forecastResponse().current, time: '2026-10-31T10:00-07:00' }
    }, 'UTC')).toThrow(/invalid UTC timestamp/);
  });

  it('uses the 15-minute in-memory cache, deduplicates pending requests, and expires entries', async () => {
    let now = 1000;
    let resolveFetch!: (response: Response) => void;
    const fetcher = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      new Promise<Response>(resolve => { resolveFetch = resolve; }));
    const client = new OpenMeteoWeatherClient(fetcher, () => now);
    const first = client.fetchForecast(city, 'UTC');
    const duplicate = client.fetchForecast(city, 'UTC');
    expect(fetcher).toHaveBeenCalledTimes(1);
    resolveFetch(new Response(JSON.stringify(forecastResponse()), { status: 200 }));
    const [firstResult, duplicateResult] = await Promise.all([first, duplicate]);
    expect(firstResult).toEqual(duplicateResult);
    expect(client.getCachedForecast(city, 'UTC')).toEqual(firstResult);
    now += WEATHER_CACHE_DURATION_MS - 1;
    expect(client.getCachedForecast(city, 'UTC')).toEqual(firstResult);
    now += 1;
    expect(client.getCachedForecast(city, 'UTC')).toBeNull();
    expect(fetcher.mock.calls[0]?.[0].toString()).toContain('timezone=GMT');
    expect(fetcher.mock.calls[0]?.[0].toString()).toContain('temperature_unit=fahrenheit');
  });
});
