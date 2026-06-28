import { AppError } from '../../errors.js';
import { setTimeout as sleep } from 'timers/promises';

const ENDPOINT = 'https://api.open-meteo.com/v1/elevation';

export async function fetchElevation(bounds, detail) {
  const samples = Math.max(5, Math.min(48, detail.meshSize, detail.maxSamples));
  const points = [];

  for (let y = 0; y < samples; y++) {
    for (let x = 0; x < samples; x++) {
      const lat = bounds.minLat + (bounds.maxLat - bounds.minLat) * (y / (samples - 1));
      const lon = bounds.minLon + (bounds.maxLon - bounds.minLon) * (x / (samples - 1));
      points.push(`${lat},${lon}`);
    }
  }

  const chunkSize = 50;
  const results = [];

  for (let i = 0; i < points.length; i += chunkSize) {
    const chunk = points.slice(i, i + chunkSize);
    const lats = chunk.map((p) => p.split(',')[0]).join(',');
    const lons = chunk.map((p) => p.split(',')[1]).join(',');

    const url = new URL(ENDPOINT);
    url.searchParams.set('latitude', lats);
    url.searchParams.set('longitude', lons);

    const data = await fetchWithRetry(url, 3);
    if (!Array.isArray(data.elevation)) {
      throw new AppError('Unexpected Open-Meteo response format', 502, 'DEM_ERROR');
    }

    results.push(...data.elevation);
  }

  const grid = [];
  for (let y = 0; y < samples; y++) {
    grid[y] = results.slice(y * samples, (y + 1) * samples);
  }

  return {
    width: samples,
    height: samples,
    grid,
    resolutionMeters: estimateResolutionMeters(bounds, samples),
    source: 'open-meteo',
    attribution: 'Elevation data by Open-Meteo (SRTM/ASTER)',
  };
}

async function fetchWithRetry(url, maxRetries) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let res;
    try {
      res = await fetch(url, { signal: controller.signal });
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;
      if (attempt < maxRetries) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      throw new AppError(`Open-Meteo fetch failed: ${err.message}`, 502, 'DEM_ERROR');
    }
    clearTimeout(timeout);

    if (res.status === 429 && attempt < maxRetries) {
      const retryAfter = parseInt(res.headers.get('retry-after') || '0', 10);
      await sleep(Math.max(retryAfter * 1000, 3000));
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new AppError(`Open-Meteo error ${res.status}: ${text.slice(0, 200)}`, 502, 'DEM_ERROR');
    }

    return await res.json();
  }
  throw lastError || new AppError('Open-Meteo failed after retries', 502, 'DEM_ERROR');
}

function estimateResolutionMeters(bounds, samples) {
  const latMid = (bounds.minLat + bounds.maxLat) / 2;
  const latSpanMeters = (bounds.maxLat - bounds.minLat) * 111320;
  const lonSpanMeters = (bounds.maxLon - bounds.minLon) * 111320 * Math.cos((latMid * Math.PI) / 180);
  const spanMeters = Math.min(latSpanMeters, lonSpanMeters);
  return Math.round(spanMeters / samples);
}
