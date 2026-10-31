import { useRef, useState, type FormEvent } from 'react';
import type { WeatherCity } from '../weather/open-meteo.ts';
import type { TodayWeatherController } from './useTodayWeather.ts';
import { TodayWeather } from './TodayWeather.tsx';

export function weatherCityLabel(city: WeatherCity): string {
  return [city.name, city.admin1, city.country].filter(Boolean).join(', ');
}

export function TodayWeatherPanel({
  controller,
  localDate,
  time
}: {
  controller: TodayWeatherController;
  localDate: string;
  time: string | null | undefined;
}) {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const pickerRef = useRef<HTMLDetailsElement>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const { city, weather, search, searchCities, selectCity, retry } = controller;

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedQuery(query.trim());
    searchCities(query);
  }

  function retrySearch() {
    searchCities(submittedQuery);
  }

  function chooseCity(result: WeatherCity) {
    selectCity(result);
    setQuery('');
    if (pickerRef.current) pickerRef.current.open = false;
    triggerRef.current?.focus();
  }

  return (
    <section className="today-weather-panel" aria-label="Local weather">
      <div className="today-weather-panel__row">
        <div className="today-weather-panel__place">
          {city && <span className="today-weather-panel__city">{weatherCityLabel(city)}</span>}
          <details className="today-weather-picker" ref={pickerRef}>
            <summary ref={triggerRef} className="today-weather-picker__trigger">
              {city ? 'Change city' : 'Choose city'}
            </summary>
            <div className="today-weather-picker__popover">
              <form className="today-weather-picker__form" onSubmit={submitSearch}>
                <label htmlFor="today-weather-city-search">City or postal code</label>
                <div className="today-weather-picker__search-row">
                  <input
                    id="today-weather-city-search"
                    name="today-weather-city-search"
                    type="search"
                    autoComplete="off"
                    value={query}
                    onChange={event => setQuery(event.currentTarget.value)}
                  />
                  <button type="submit" disabled={search.status === 'loading'}>Search</button>
                </div>
              </form>
              <p className="today-weather-picker__privacy">
                City choice stays in memory and is cleared when this preview reloads.
              </p>
              {search.status === 'loading' && submittedQuery === query.trim() && (
                <p className="today-weather-picker__message" role="status">Searching locations…</p>
              )}
              {search.message && submittedQuery === query.trim() && (
                <p className="today-weather-picker__message" role="status">{search.message}</p>
              )}
              {search.status === 'error' && submittedQuery === query.trim() && (
                <button type="button" className="today-weather-picker__retry" onClick={retrySearch}>
                  Retry search
                </button>
              )}
              {search.results.length > 0 && search.status === 'ready' && submittedQuery === query.trim() && (
                <div className="today-weather-picker__results" role="group" aria-label="Matching locations">
                  {search.results.map(result => (
                    <button
                      type="button"
                      className="today-weather-picker__result"
                      key={`${result.id}:${result.latitude}:${result.longitude}`}
                      onClick={() => chooseCity(result)}
                    >
                      <span>{result.name}</span>
                      <small>{[result.admin1, result.country].filter(Boolean).join(', ')}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </details>
        </div>
      </div>
      {time === undefined
        ? <p className="today-weather-unavailable" role="status">Weather is not shown for Everything today.</p>
        : weather.status === 'loading' && city
          ? <p className="today-weather-unavailable" role="status">Loading weather for {city.name}…</p>
          : weather.status === 'error' && city
            ? (
              <div className="today-weather-panel__error">
                <p className="today-weather-unavailable" role="status">
                  {weather.message ?? 'Weather could not be loaded. Check your connection and try again.'}
                </p>
                <button type="button" className="today-weather-panel__retry" onClick={retry}>Retry</button>
              </div>
            )
            : (
              <TodayWeather
                report={weather.status === 'ready' ? weather.report : null}
                localDate={localDate}
                time={time}
                unavailableMessage={city ? 'Weather is unavailable.' : 'Weather is unavailable until you choose a city.'}
              />
            )}
    </section>
  );
}
