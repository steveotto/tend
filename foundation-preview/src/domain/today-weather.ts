export type WeatherObservation = {
  date: string;
  time: string;
  temperature: number;
  code: number;
  isDay: boolean;
};

export type TodayWeatherReport = {
  current: WeatherObservation;
  hourly: readonly WeatherObservation[];
};

export type WeatherCondition = {
  description: string;
  theme: 'night' | 'sunny' | 'clear' | 'partly' | 'cloudy' | 'rain' | 'snow' | 'storm';
};

function localMinutes(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function selectWeatherForTime(
  report: TodayWeatherReport,
  localDate: string,
  time: string | null
): WeatherObservation | null {
  if (time === null) return report.current.date === localDate ? report.current : null;
  const targetMinutes = localMinutes(time);
  if (targetMinutes === null) return null;
  let closest: WeatherObservation | null = null;
  let closestDistance = Infinity;
  for (const hour of report.hourly) {
    if (hour.date !== localDate) continue;
    const minutes = localMinutes(hour.time);
    if (minutes === null) continue;
    const distance = Math.abs(minutes - targetMinutes);
    if (distance < closestDistance || (distance === closestDistance && minutes >= targetMinutes)) {
      closest = hour;
      closestDistance = distance;
    }
  }
  return closestDistance <= 60 ? closest : null;
}

export function weatherCondition(code: number, isDay: boolean): WeatherCondition {
  if (code === 0) return { description: isDay ? 'Clear' : 'Clear night', theme: isDay ? 'sunny' : 'night' };
  if (code === 1) return { description: 'Mostly clear', theme: isDay ? 'clear' : 'night' };
  if (code === 2) return { description: 'Partly cloudy', theme: isDay ? 'partly' : 'night' };
  if (code === 3) return { description: 'Cloudy', theme: isDay ? 'cloudy' : 'night' };
  if (code === 45 || code === 48) return { description: 'Fog', theme: isDay ? 'cloudy' : 'night' };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return { description: code >= 61 || code >= 80 ? 'Rain' : 'Drizzle', theme: isDay ? 'rain' : 'night' };
  }
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    return { description: 'Snow', theme: isDay ? 'snow' : 'night' };
  }
  if (code >= 95) return { description: 'Thunderstorms', theme: isDay ? 'storm' : 'night' };
  return { description: 'Current weather', theme: isDay ? 'partly' : 'night' };
}
