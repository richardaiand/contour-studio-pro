import { config } from '../../config.js';
import { AppError } from '../../errors.js';
import * as openmeteo from './openmeteo.js';
import * as opentopography from './opentopography.js';

// Detail levels map to approximate target resolutions in meters
export const DETAIL_CONFIG = {
  draft: { targetResolutionMeters: 30, meshSize: 128, maxSamples: 256 },
  standard: { targetResolutionMeters: 10, meshSize: 256, maxSamples: 512 },
  survey: { targetResolutionMeters: 3, meshSize: 512, maxSamples: 1024 },
};

export async function fetchDemForBounds(bounds, detailLevel = 'standard') {
  const detail = DETAIL_CONFIG[detailLevel] || DETAIL_CONFIG.standard;
  const errors = [];

  // 1. Try OpenTopography global DEM if key is configured
  //    Includes SRTM (global) and USGS 1m/10m (US) datasets.
  if (config.dem.openTopographyKey) {
    try {
      const data = await opentopography.fetchDem(bounds, detail);
      return {
        ...data,
        detailLevel,
        sources: ['opentopography'],
      };
    } catch (err) {
      errors.push(`OpenTopography: ${err.message}`);
    }
  }

  // 2. Fallback to Open-Meteo (free, no key)
  try {
    const data = await openmeteo.fetchElevation(bounds, detail);
    return {
      ...data,
      detailLevel,
      sources: ['open-meteo'],
    };
  } catch (err) {
    errors.push(`Open-Meteo: ${err.message}`);
  }

  throw new AppError(
    `Could not fetch elevation data. Errors: ${errors.join('; ')}`,
    502,
    'DEM_ERROR'
  );
}

export function selectSourceDescription(sources, detailLevel) {
  if (sources.includes('usgs-3dep')) return 'USGS 3DEP high-resolution lidar DEM';
  if (sources.includes('opentopography')) return 'OpenTopography global DEM';
  if (sources.includes('open-meteo')) return 'Open-Meteo SRTM/ASTER elevation (fallback)';
  return 'Unknown source';
}
