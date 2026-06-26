// V3: Climate data from Open-Meteo
// TODO: Fetch historical climate averages for a location
// API: https://archive-api.open-meteo.com/v1/archive?latitude=&longitude=&start_date=&end_date=&daily=temperature_2m_mean,precipitation_sum&timezone=auto

export async function fetchClimateData(lat, lon) {
  // TODO: Fetch historical averages (last 10 years)
  // TODO: Calculate: avg temp, avg precipitation, humidity, snowfall
  // TODO: Return { avgTempC, avgPrecipMm, avgHumidity, avgSnowfallCm, climateZone }
  throw new Error('Not implemented — see ROADMAP.md V3.1');
}

export async function fetchCurrentWeather(lat, lon) {
  // TODO: Fetch current conditions
  // API: https://api.open-meteo.com/v1/forecast?latitude=&longitude=&current=temperature_2m,relative_humidity_2m,precipitation
  throw new Error('Not implemented — see ROADMAP.md V3.1');
}
