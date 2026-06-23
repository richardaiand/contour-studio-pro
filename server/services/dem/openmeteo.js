import { AppError } from '../../errors.js';

const ENDPOINT = 'https://api.open-meteo.com/v1/elevation';

export async function fetchElevation(bounds, detail) {
  // Build a grid of sample points. Open-Meteo accepts up to 100 locations per request,
  // so we cap the grid to keep request count reasonable.
  const samples = Math.min(48, detail.meshSize, detail.maxSamples);
  const points = [];

  for (let y = 0; y < samples; y++) {
    for (let x = 0; x < samples; x++) {
      const lat = bounds.minLat + (bounds.maxLat - bounds.minLat) * (y / (samples - 1));
      const lon = bounds.minLon + (bounds.maxLon - bounds.minLon) * (x / (samples - 1));
      points.push(`${lat},${lon}`);
    }
  }

  // Open-Meteo accepts up to 100 locations per request
  const chunkSize = 100;
  const results = [];

  for (let i = 0; i < points.length; i += chunkSize) {
    const chunk = points.slice(i, i + chunkSize);
    const url = new URL(ENDPOINT);
    url.searchParams.set('locations', chunk.join('|'));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let res;
    try {
      res = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      throw new AppError(`Open-Meteo error: ${res.status}`, 502, 'DEM_ERROR');
    }

    const data = await res.json();
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

function estimateResolutionMeters(bounds, samples) {
  const latMid = (bounds.minLat + bounds.maxLat) / 2;
  const latSpanMeters = (bounds.maxLat - bounds.minLat) * 111320;
  const lonSpanMeters = (bounds.maxLon - bounds.minLon) * 111320 * Math.cos((latMid * Math.PI) / 180);
  const spanMeters = Math.min(latSpanMeters, lonSpanMeters);
  return Math.round(spanMeters / samples);
}
