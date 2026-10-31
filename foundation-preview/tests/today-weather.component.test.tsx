import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TodayWeather } from '../src/components/TodayWeather.tsx';
import type { TodayWeatherReport } from '../src/domain/today-weather.ts';

afterEach(cleanup);

const syntheticWeatherFixture: TodayWeatherReport = {
  current: { date: '2026-10-31', time: '10:00', temperature: 64.7, code: 2, isDay: true },
  hourly: [
    { date: '2026-10-31', time: '09:00', temperature: 63, code: 1, isDay: true },
    { date: '2026-10-31', time: '10:00', temperature: 65, code: 61, isDay: true },
    { date: '2026-11-01', time: '18:00', temperature: 52, code: 0, isDay: false }
  ]
};

describe('Today weather adapter presentation', () => {
  it('shows an honest unavailable state when no preview weather source is configured', () => {
    render(<TodayWeather localDate="2026-10-31" time={null} />);
    expect(screen.getByRole('status').textContent).toBe('Weather is unavailable in this preview.');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders the current synthetic fixture and a selected-block forecast with Tend weather styling', () => {
    const { rerender } = render(
      <TodayWeather report={syntheticWeatherFixture} localDate="2026-10-31" time={null} />
    );
    expect(screen.getByRole('img', { name: 'Current conditions: Partly cloudy, 65 degrees' }).className)
      .toContain('today-weather--partly');

    rerender(<TodayWeather report={syntheticWeatherFixture} localDate="2026-10-31" time="10:00" />);
    expect(screen.getByRole('img', { name: 'Forecast: Rain, 65 degrees' }).className)
      .toContain('today-weather--rain');
    expect(screen.getByRole('img').querySelector('svg')).toBeTruthy();
  });

  it('does not substitute weather from another date when the selected block has no forecast', () => {
    render(<TodayWeather report={syntheticWeatherFixture} localDate="2026-11-02" time="18:00" />);
    expect(screen.getByRole('status').textContent).toBe('No forecast is available for this time.');
  });

  it('keeps the existing day/night icon and color mapping for Open-Meteo weather codes', () => {
    const { rerender } = render(
      <TodayWeather report={{ ...syntheticWeatherFixture, current: { ...syntheticWeatherFixture.current, code: 0 } }}
        localDate="2026-10-31" time={null} />
    );
    expect(screen.getByRole('img', { name: 'Current conditions: Clear, 65 degrees' }).className)
      .toContain('today-weather--sunny');
    expect(screen.getByRole('img').querySelector('svg circle')).toBeTruthy();

    rerender(
      <TodayWeather report={{ ...syntheticWeatherFixture, current: { ...syntheticWeatherFixture.current, code: 0, isDay: false } }}
        localDate="2026-10-31" time={null} />
    );
    expect(screen.getByRole('img', { name: 'Current conditions: Clear night, 65 degrees' }).className)
      .toContain('today-weather--night');
  });
});
