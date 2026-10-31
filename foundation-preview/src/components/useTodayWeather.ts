import { useCallback, useEffect, useRef, useState } from 'react';
import {
  OpenMeteoWeatherClient,
  WEATHER_CACHE_DURATION_MS,
  WeatherRequestError
} from '../weather/open-meteo.ts';
import type { WeatherCity } from '../weather/open-meteo.ts';
import type { TodayWeatherReport } from '../domain/today-weather.ts';

type WeatherLoadState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  report: TodayWeatherReport | null;
  fetchedAt: number | null;
  message: string | null;
};

type CitySearchState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  results: WeatherCity[];
  message: string | null;
};

export type TodayWeatherController = {
  city: WeatherCity | null;
  weather: WeatherLoadState;
  search: CitySearchState;
  searchCities: (query: string) => void;
  selectCity: (city: WeatherCity) => void;
  retry: () => void;
};

export function useTodayWeather(
  enabled: boolean,
  timeZone: string,
  client?: OpenMeteoWeatherClient
): TodayWeatherController {
  const [service] = useState(() => client ?? new OpenMeteoWeatherClient());
  const [city, setCity] = useState<WeatherCity | null>(null);
  const [weather, setWeather] = useState<WeatherLoadState>({
    status: 'idle',
    report: null,
    fetchedAt: null,
    message: null
  });
  const [search, setSearch] = useState<CitySearchState>({
    status: 'idle',
    results: [],
    message: null
  });
  const [requestVersion, setRequestVersion] = useState(0);
  const requestSequence = useRef(0);
  const searchSequence = useRef(0);
  const searchController = useRef<AbortController | null>(null);
  const forceRefresh = useRef(false);

  const searchCities = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearch({ status: 'error', results: [], message: 'Enter a city or postal code.' });
      return;
    }
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    const sequence = ++searchSequence.current;
    setSearch({ status: 'loading', results: [], message: null });
    void service.searchCities(trimmed, controller.signal).then(results => {
      if (sequence !== searchSequence.current) return;
      setSearch({
        status: 'ready',
        results,
        message: results.length === 0 ? 'No matching places were found.' : null
      });
    }).catch(error => {
      if (sequence !== searchSequence.current || controller.signal.aborted) return;
      setSearch({
        status: 'error',
        results: [],
        message: error instanceof WeatherRequestError
          ? error.message
          : 'City search is unavailable. Check your connection and try again.'
      });
    });
  }, [service]);

  const selectCity = useCallback((selected: WeatherCity) => {
    searchSequence.current += 1;
    searchController.current?.abort();
    searchController.current = null;
    setSearch({ status: 'idle', results: [], message: null });
    forceRefresh.current = false;
    setCity(selected);
    setWeather({ status: 'loading', report: null, fetchedAt: null, message: null });
  }, []);

  const retry = useCallback(() => {
    if (!city) return;
    forceRefresh.current = true;
    setRequestVersion(version => version + 1);
  }, [city]);

  useEffect(() => {
    if (!enabled || !city) {
      if (!city) setWeather({ status: 'idle', report: null, fetchedAt: null, message: null });
      return;
    }
    let active = true;
    const sequence = ++requestSequence.current;
    const cached = forceRefresh.current ? null : service.getCachedForecast(city, timeZone);
    const force = forceRefresh.current;
    forceRefresh.current = false;
    if (cached) {
      setWeather({ status: 'ready', report: cached.report, fetchedAt: cached.fetchedAt, message: null });
      return () => {
        active = false;
      };
    }
    setWeather({ status: 'loading', report: null, fetchedAt: null, message: null });
    void service.fetchForecast(city, timeZone, force).then(result => {
      if (!active || sequence !== requestSequence.current) return;
      setWeather({ status: 'ready', report: result.report, fetchedAt: result.fetchedAt, message: null });
    }).catch(error => {
      if (!active || sequence !== requestSequence.current || (error instanceof DOMException && error.name === 'AbortError')) return;
      setWeather({
        status: 'error',
        report: null,
        fetchedAt: null,
        message: 'Weather could not be loaded. Check your connection and try again.'
      });
    });
    return () => {
      active = false;
      requestSequence.current += 1;
      service.cancelForecast(city, timeZone);
    };
  }, [city, enabled, requestVersion, service, timeZone]);

  useEffect(() => {
    if (enabled || !searchController.current) return;
    searchSequence.current += 1;
    searchController.current.abort();
    searchController.current = null;
    setSearch({ status: 'idle', results: [], message: null });
  }, [enabled]);

  useEffect(() => () => {
    requestSequence.current += 1;
    searchSequence.current += 1;
    searchController.current?.abort();
    service.cancelAllForecasts();
  }, [service]);

  useEffect(() => {
    if (!enabled || !city || weather.status !== 'ready' || weather.fetchedAt === null) return;
    const refreshIfExpired = () => {
      if (document.visibilityState !== 'visible' || service.getCachedForecast(city, timeZone)) return;
      forceRefresh.current = true;
      setRequestVersion(version => version + 1);
    };
    const expiresAt = weather.fetchedAt + WEATHER_CACHE_DURATION_MS;
    const timer = window.setTimeout(refreshIfExpired, Math.max(0, expiresAt - Date.now()));
    document.addEventListener('visibilitychange', refreshIfExpired);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', refreshIfExpired);
    };
  }, [city, enabled, service, timeZone, weather.fetchedAt, weather.status]);

  return { city, weather, search, searchCities, selectCity, retry };
}
