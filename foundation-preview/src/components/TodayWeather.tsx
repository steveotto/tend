import { selectWeatherForTime, weatherCondition } from '../domain/today-weather.ts';
import type { TodayWeatherReport } from '../domain/today-weather.ts';

export function TodayWeather({
  report,
  localDate,
  time,
  unavailableMessage = 'Weather is unavailable in this preview.'
}: {
  report?: TodayWeatherReport | null;
  localDate: string;
  time: string | null;
  unavailableMessage?: string;
}) {
  if (!report) {
    return <p className="today-weather-unavailable" role="status">{unavailableMessage}</p>;
  }
  const observation = selectWeatherForTime(report, localDate, time);
  if (!observation) {
    return <p className="today-weather-unavailable" role="status">No forecast is available for this time.</p>;
  }
  const condition = weatherCondition(observation.code, observation.isDay);
  const roundedTemperature = Math.round(observation.temperature);
  return (
    <span
      className={`today-weather today-weather--${condition.theme}`}
      role="img"
      aria-label={`${condition.description}, ${roundedTemperature} degrees`}
    >
      <WeatherIcon code={observation.code} isDay={observation.isDay} />
      <span className="today-weather__reading">
        <strong>{roundedTemperature}<sup>°</sup></strong>
        <span>{condition.description}</span>
      </span>
    </span>
  );
}

function WeatherIcon({ code, isDay }: { code: number; isDay: boolean }) {
  if (code === 0 && isDay) {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>;
  }
  if (code === 0) {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 15.5A8 8 0 0 1 8.5 4.5 8.5 8.5 0 1 0 19.5 15.5Z" /><path d="m17 3 .5 1.5L19 5l-1.5.5L17 7l-.5-1.5L15 5l1.5-.5L17 3Z" /></svg>;
  }
  if (code === 1 || code === 2) {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 16.2a4.1 4.1 0 0 0-1.7-7.8A6.3 6.3 0 0 0 6 9.8a3.5 3.5 0 0 0 .5 7h13.1Z" /><path d="M15 3v2m4 0 1.4-1.4" /></svg>;
  }
  if (code === 3 || code === 45 || code === 48) {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 16.2a4.1 4.1 0 0 0-1.7-7.8A6.3 6.3 0 0 0 6 9.8a3.5 3.5 0 0 0 .5 7h13.1Z" />{code >= 45 && <path d="M5 20h14M8 22h8" />}</svg>;
  }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 15.7a4 4 0 0 0-1.6-7.6A6.2 6.2 0 0 0 6 9.8a3.4 3.4 0 0 0 .5 6.8h13Z" /><path d="m9 19-1 2m6-2-1 2m6-2-1 2" /></svg>;
  }
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 15.7a4 4 0 0 0-1.6-7.6A6.2 6.2 0 0 0 6 9.8a3.4 3.4 0 0 0 .5 6.8h13Z" /><path d="M7 19v4m-2-2h4m3-2v4m-2-2h4m3-2v4m-2-2h4" /></svg>;
  }
  if (code >= 95) {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 15.7a4 4 0 0 0-1.6-7.6A6.2 6.2 0 0 0 6 9.8a3.4 3.4 0 0 0 .5 6.8h13Z" /><path d="m13 17-3 4h3l-1 3 4-5h-3l1-2Z" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /></svg>;
}
