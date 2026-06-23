import { AppError } from '../../errors.js';

// USGS 3DEP Elevation Point Query Service (EPQS) and WCS stubs.
// For the MVP, this uses EPQS for sparse samples and builds a grid.
// Full WCS raster download would require geotiff.js / GDAL.

const EPQS_URL = 'https://api.usgs.gov/api/nad/epqs/v1';

export async function fetchElevation(bounds, detail) {
  // WARNING: This MVP implementation uses point queries, which is only viable
  // for very small sample grids. For production, use USGS WCS/ImageServer
  // raster download with geotiff.js or GDAL.
  const samples = Math.min(detail.meshSize, 16, detail.maxSamples);
  const grid = [];

  for (let y = 0; y < samples; y++) {
    const row = [];
    const lat = bounds.minLat + (bounds.maxLat - bounds.minLat) * (y / (samples - 1));

    for (let x = 0; x < samples; x++) {
      const lon = bounds.minLon + (bounds.maxLon - bounds.minLon) * (x / (samples - 1));

      try {
        const elevation = await queryEpqs(lat, lon);
        row.push(elevation);
      } catch (err) {
        // Fill with neighbor or throw
        if (row.length > 0) row.push(row[row.length - 1]);
        else if (grid.length > 0) row.push(grid[grid.length - 1][0] || 0);
        else row.push(0);
      }
    }

    grid.push(row);
  }

  return {
    width: samples,
    height: samples,
    grid,
    resolutionMeters: estimateResolutionMeters(bounds, samples),
    source: 'usgs-3dep',
    attribution: 'Elevation data by USGS 3D Elevation Program',
  };
}

async function queryEpqs(lat, lon) {
  const url = new URL(EPQS_URL);
  url.searchParams.set('lat', lat.toFixed(6));
  url.searchParams.set('lon', lon.toFixed(6));
  url.searchParams.set('units', 'Meters');
  url.searchParams.set('output', 'json');

  const res = await fetch(url);
  if (!res.ok) {
    throw new AppError(`USGS EPQS error: ${res.status}`, 502, 'DEM_ERROR');
  }

  const data = await res.json();
  const value = data?.USGS_Elevation_Point_Query_Service?.Elevation_Query?.Elevation;
  if (value === undefined || value === null) {
    throw new AppError('Unexpected USGS EPQS response', 502, 'DEM_ERROR');
  }
  return Number(value);
}

function estimateResolutionMeters(bounds, samples) {
  const latMid = (bounds.minLat + bounds.maxLat) / 2;
  const latSpanMeters = (bounds.maxLat - bounds.minLat) * 111320;
  const lonSpanMeters = (bounds.maxLon - bounds.minLon) * 111320 * Math.cos((latMid * Math.PI) / 180);
  const spanMeters = Math.min(latSpanMeters, lonSpanMeters);
  return Math.round(spanMeters / samples);
}
