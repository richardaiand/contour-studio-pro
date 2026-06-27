import { AppError } from '../../errors.js';

export async function fetchClimateData(lat, lon) {
  const endYear = new Date().getFullYear() - 1;
  const startYear = endYear - 9;
  const startDate = `${startYear}-01-01`;
  const endDate = `${endYear}-12-31`;

  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_mean,precipitation_sum,snowfall_sum&timezone=auto`;

  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) {
    throw new AppError(`Climate API error ${res.status}`, 502, 'CLIMATE_ERROR');
  }

  const data = await res.json();
  const daily = data.daily;
  if (!daily || !daily.temperature_2m_mean) {
    throw new AppError('No climate data available for this location', 502, 'CLIMATE_ERROR');
  }

  const temps = daily.temperature_2m_mean.filter((t) => t !== null);
  const precip = daily.precipitation_sum.filter((p) => p !== null);
  const snow = daily.snowfall_sum.filter((s) => s !== null);

  const avgTempC = temps.reduce((a, b) => a + b, 0) / (temps.length || 1);
  const avgPrecipMm = precip.reduce((a, b) => a + b, 0) / (precip.length || 1);
  const avgSnowCm = snow.reduce((a, b) => a + b, 0) / (snow.length || 1);

  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);

  return {
    avgTempC: Math.round(avgTempC * 10) / 10,
    minTempC: Math.round(minTemp * 10) / 10,
    maxTempC: Math.round(maxTemp * 10) / 10,
    avgPrecipMm: Math.round(avgPrecipMm * 10) / 10,
    avgSnowCm: Math.round(avgSnowCm * 10) / 10,
    climateZone: classifyClimate(avgTempC, avgPrecipMm),
    period: `${startYear}-${endYear}`,
  };
}

export async function fetchCurrentWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m`;

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    throw new AppError(`Weather API error ${res.status}`, 502, 'WEATHER_ERROR');
  }

  const data = await res.json();
  const current = data.current;
  if (!current) {
    return null;
  }

  return {
    temperatureC: Math.round(current.temperature_2m * 10) / 10,
    humidity: Math.round(current.relative_humidity_2m),
    precipitation: current.precipitation,
    windSpeedKmh: Math.round(current.wind_speed_10m * 10) / 10,
  };
}

function classifyClimate(avgTempC, avgPrecipMm) {
  if (avgTempC >= 18 && avgPrecipMm < 25) return 'Arid/Desert';
  if (avgTempC >= 18 && avgPrecipMm < 50) return 'Semi-arid';
  if (avgTempC >= 18 && avgPrecipMm >= 60) return 'Tropical';
  if (avgTempC >= 10 && avgPrecipMm >= 50) return 'Temperate';
  if (avgTempC >= 0 && avgTempC < 10) return 'Continental';
  if (avgTempC < 0) return 'Polar';
  if (avgTempC >= 18 && avgPrecipMm >= 25 && avgPrecipMm < 60) return 'Mediterranean';
  return 'Temperate';
}
