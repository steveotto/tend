import { useRef, useState, type FormEvent } from 'react';
import { AnchoredPopover } from './AnchoredPopover.tsx';
import type { WeatherCity } from '../weather/open-meteo.ts';
import type { TodayWeatherController } from './useTodayWeather.ts';

export function weatherCityLabel(city: WeatherCity): string {
  return [city.name, city.admin1, city.country].filter(Boolean).join(', ');
}

export function TodayWeatherSettings({
  controller,
  timeZone
}: {
  controller: TodayWeatherController;
  timeZone: string;
}) {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { city, weather, search, searchCities, selectCity, clearCity, retry } = controller;

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
    setCityPickerOpen(false);
  }

  return (
    <section className="today-weather-settings" aria-label="Weather settings">
      <div className="today-weather-panel__row">
        <div className="today-weather-panel__place">
          {city && <span className="today-weather-panel__city">{weatherCityLabel(city)}</span>}
          <div className="today-weather-picker">
            <button
              ref={triggerRef}
              type="button"
              className="today-weather-picker__trigger"
              aria-haspopup="dialog"
              aria-expanded={cityPickerOpen}
              aria-controls="today-weather-city-popover"
              onClick={() => setCityPickerOpen(open => !open)}
            >
              {city ? 'Change city' : 'Choose city'}
            </button>
            {cityPickerOpen && (
              <AnchoredPopover
                anchorRef={triggerRef}
                id="today-weather-city-popover"
                label={city ? 'Choose a different city' : 'Choose a city'}
                className="today-weather-picker__popover"
                initialFocusSelector="#today-weather-city-search"
                onClose={() => setCityPickerOpen(false)}
              >
                <div className="today-weather-picker__fixed">
                  <div className="today-weather-picker__popover-heading">
                    <strong>Choose a city</strong>
                    <button
                      type="button"
                      className="today-weather-picker__close"
                      onClick={() => setCityPickerOpen(false)}
                    >
                      Close
                    </button>
                  </div>
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
                </div>
                <div className="today-weather-picker__popover-content">
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
              </AnchoredPopover>
            )}
          </div>
          {city && (
            <button type="button" className="today-weather-picker__clear" onClick={clearCity}>
              Clear
            </button>
          )}
        </div>
      </div>
      <p className="today-weather-picker__privacy">
        Source: Open-Meteo · Time zone: {timeZone} · City choice is session-only.
      </p>
      {city && weather.status === 'loading' && (
        <p className="today-weather-picker__message" role="status">Loading weather for {city.name}…</p>
      )}
      {city && weather.status === 'error' && (
        <div className="today-weather-panel__error">
          <p className="today-weather-picker__message" role="status">
            {weather.message ?? 'Weather could not be loaded. Check your connection and try again.'}
          </p>
          <button type="button" className="today-weather-panel__retry" onClick={retry}>Retry</button>
        </div>
      )}
      {city && weather.status === 'ready' && weather.fetchedAt !== null && (
        <p className="today-weather-picker__message" role="status">
          Forecast updated {new Intl.DateTimeFormat(undefined, {
            hour: 'numeric',
            minute: '2-digit',
            timeZone
          }).format(weather.fetchedAt)}.
        </p>
      )}
    </section>
  );
}
