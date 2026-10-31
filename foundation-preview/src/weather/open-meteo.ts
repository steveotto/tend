import type { TodayWeatherReport, WeatherObservation } from '../domain/today-weather.ts';

export type WeatherCity = {
  id: number;
  name: string;
  admin1: string | null;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
};

export type CachedWeatherReport = {
  report: TodayWeatherReport;
  fetchedAt: number;
};

export const WEATHER_CACHE_DURATION_MS = 15 * 60 * 1000;

type GeocodingResponse = {
  results?: unknown;
};

type ForecastResponse = {
  timezone?: unknown;
  utc_offset_seconds?: unknown;
  current?: {
    time?: unknown;
    temperature_2m?: unknown;
    weather_code?: unknown;
    is_day?: unknown;
  };
  hourly?: {
    time?: unknown;
    temperature_2m?: unknown;
    weather_code?: unknown;
    is_day?: unknown;
  };
};

export class WeatherRequestError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'WeatherRequestError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function parseUtcTimestamp(value: unknown): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) {
    throw new WeatherRequestError('The weather service returned an invalid UTC timestamp.');
  }
  const timestamp = Date.parse(`${value}Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 16) !== value.slice(0, 16)) {
    throw new WeatherRequestError('The weather service returned an invalid UTC timestamp.');
  }
  return timestamp;
}

function normalizeTimestamp(timestamp: number, timeZone: string): Pick<WeatherObservation, 'date' | 'time'> {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(timestamp);
  } catch (error) {
    throw new WeatherRequestError('Today’s local time zone is unavailable for weather.', { cause: error });
  }
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value;
  const year = part('year');
  const month = part('month');
  const day = part('day');
  const hour = part('hour');
  const minute = part('minute');
  if (!year || !month || !day || !hour || !minute) {
    throw new WeatherRequestError('The weather service returned an incomplete timestamp.');
  }
  return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` };
}

function isWeatherCode(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 99;
}

function isDayValue(value: unknown): value is number {
  return value === 0 || value === 1;
}

function normalizeObservation(
  time: unknown,
  temperature: unknown,
  code: unknown,
  isDay: unknown,
  timeZone: string
): WeatherObservation {
  const timestamp = parseUtcTimestamp(time);
  if (typeof temperature !== 'number' || !Number.isFinite(temperature)
    || !isWeatherCode(code) || !isDayValue(isDay)) {
    throw new WeatherRequestError('The weather service returned incomplete observation data.');
  }
  return {
    ...normalizeTimestamp(timestamp, timeZone),
    temperature,
    code,
    isDay: isDay === 1
  };
}

export function normalizeGeocodingResponse(payload: unknown): WeatherCity[] {
  if (!isRecord(payload) || !Array.isArray((payload as GeocodingResponse).results)) {
    throw new WeatherRequestError('The location service returned an invalid response.');
  }
  const results = (payload as { results: unknown[] }).results;
  return results.map(result => {
    if (!isRecord(result)
      || typeof result.id !== 'number' || !Number.isInteger(result.id)
      || typeof result.name !== 'string' || !result.name.trim()
      || typeof result.country !== 'string' || !result.country.trim()
      || typeof result.country_code !== 'string' || !result.country_code.trim()
      || !validCoordinate(result.latitude, -90, 90)
      || !validCoordinate(result.longitude, -180, 180)
      || (result.admin1 !== undefined && result.admin1 !== null && typeof result.admin1 !== 'string')) {
      throw new WeatherRequestError('The location service returned an incomplete city result.');
    }
    return {
      id: result.id,
      name: result.name.trim(),
      admin1: typeof result.admin1 === 'string' && result.admin1.trim() ? result.admin1.trim() : null,
      country: result.country.trim(),
      countryCode: result.country_code.trim(),
      latitude: result.latitude,
      longitude: result.longitude
    };
  });
}

export function normalizeForecastResponse(payload: unknown, timeZone: string): TodayWeatherReport {
  if (!isRecord(payload)) throw new WeatherRequestError('The weather service returned an invalid response.');
  const response = payload as ForecastResponse;
  if ((response.timezone !== 'GMT' && response.timezone !== 'UTC') || response.utc_offset_seconds !== 0) {
    throw new WeatherRequestError('The weather service did not return the requested UTC timestamps.');
  }
  const current = response.current;
  const hourly = response.hourly;
  const times = hourly?.time;
  const temperatures = hourly?.temperature_2m;
  const codes = hourly?.weather_code;
  const dayFlags = hourly?.is_day;
  if (!current || !hourly
    || !Array.isArray(times)
    || !Array.isArray(temperatures)
    || !Array.isArray(codes)
    || !Array.isArray(dayFlags)
    || times.length !== temperatures.length
    || times.length !== codes.length
    || times.length !== dayFlags.length) {
    throw new WeatherRequestError('The weather service returned incomplete hourly forecast data.');
  }
  return {
    current: normalizeObservation(
      current.time,
      current.temperature_2m,
      current.weather_code,
      current.is_day,
      timeZone
    ),
    hourly: times.map((time, index) => normalizeObservation(
      time,
      temperatures[index],
      codes[index],
      dayFlags[index],
      timeZone
    ))
  };
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type PendingForecast = { controller: AbortController; promise: Promise<CachedWeatherReport> };

export class OpenMeteoWeatherClient {
  private readonly cache = new Map<string, CachedWeatherReport>();
  private readonly pending = new Map<string, PendingForecast>();
  private readonly fetcher: Fetcher;
  private readonly now: () => number;

  constructor(
    fetcher: Fetcher = (input, init) => globalThis.fetch(input, init),
    now: () => number = Date.now
  ) {
    this.fetcher = fetcher;
    this.now = now;
  }

  async searchCities(query: string, signal: AbortSignal): Promise<WeatherCity[]> {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.search = new URLSearchParams({
      name: query.trim(),
      count: '10',
      language: 'en',
      format: 'json'
    }).toString();
    const response = await this.fetcher(url, { signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new WeatherRequestError(`Location search failed (${response.status}).`);
    return normalizeGeocodingResponse(await response.json());
  }

  getCachedForecast(city: WeatherCity, timeZone: string): CachedWeatherReport | null {
    const key = this.forecastKey(city, timeZone);
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (this.now() - cached.fetchedAt >= WEATHER_CACHE_DURATION_MS) {
      this.cache.delete(key);
      return null;
    }
    return cached;
  }

  fetchForecast(city: WeatherCity, timeZone: string, force = false): Promise<CachedWeatherReport> {
    const key = this.forecastKey(city, timeZone);
    if (!force) {
      const cached = this.getCachedForecast(city, timeZone);
      if (cached) return Promise.resolve(cached);
    }
    const existing = this.pending.get(key);
    if (existing && !existing.controller.signal.aborted) return existing.promise;
    if (existing) this.pending.delete(key);

    const controller = new AbortController();
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({
      latitude: String(city.latitude),
      longitude: String(city.longitude),
      current: 'temperature_2m,weather_code,is_day',
      hourly: 'temperature_2m,weather_code,is_day',
      temperature_unit: 'fahrenheit',
      timezone: 'GMT'
    }).toString();
    const promise = this.fetcher(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    }).then(async response => {
      if (!response.ok) throw new WeatherRequestError(`Weather request failed (${response.status}).`);
      const report = normalizeForecastResponse(await response.json(), timeZone);
      const cached = { report, fetchedAt: this.now() };
      this.cache.set(key, cached);
      while (this.cache.size > 8) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey === undefined) break;
        this.cache.delete(oldestKey);
      }
      return cached;
    }).finally(() => {
      if (this.pending.get(key)?.promise === promise) this.pending.delete(key);
    });
    this.pending.set(key, { controller, promise });
    return promise;
  }

  cancelForecast(city: WeatherCity, timeZone: string): void {
    const key = this.forecastKey(city, timeZone);
    const request = this.pending.get(key);
    if (!request) return;
    this.pending.delete(key);
    request.controller.abort();
  }

  cancelAllForecasts(): void {
    for (const request of this.pending.values()) request.controller.abort();
    this.pending.clear();
  }

  private forecastKey(city: WeatherCity, timeZone: string): string {
    return `${city.latitude},${city.longitude}:${timeZone}`;
  }
}
