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

// OpenTopography requires each side of the bounding box to be > ~250 meters
const MIN_SIDE_METERS = 300; // 300m to be safe above the 250m minimum

function calculateAreaKm2(bounds) {
  const latMid = (bounds.minLat + bounds.maxLat) / 2;
  const latSpan = bounds.maxLat - bounds.minLat;
  const lonSpan = bounds.maxLon - bounds.minLon;
  const widthKm = lonSpan * 111.32 * Math.cos((latMid * Math.PI) / 180);
  const heightKm = latSpan * 111.32;
  return widthKm * heightKm;
}

function expandToBoundsToMinimum(originalBounds) {
  const latSpan = originalBounds.maxLat - originalBounds.minLat;
  const lonSpan = originalBounds.maxLon - originalBounds.minLon;
  const latMid = (originalBounds.minLat + originalBounds.maxLat) / 2;
  const lonMid = (originalBounds.minLon + originalBounds.maxLon) / 2;

  // Convert minimum meters to degrees at this latitude
  const minLatDeg = MIN_SIDE_METERS / 111320;
  const minLonDeg = MIN_SIDE_METERS / (111320 * Math.cos((latMid * Math.PI) / 180));

  const neededLatSpan = Math.max(latSpan, minLatDeg);
  const neededLonSpan = Math.max(lonSpan, minLonDeg);

  const wasExpanded = neededLatSpan > latSpan || neededLonSpan > lonSpan;

  return {
    bounds: {
      minLat: latMid - neededLatSpan / 2,
      maxLat: latMid + neededLatSpan / 2,
      minLon: lonMid - neededLonSpan / 2,
      maxLon: lonMid + neededLonSpan / 2,
    },
    wasExpanded,
    originalBounds,
    expansionNote: wasExpanded
      ? `Selected area was ${calculateAreaKm2(originalBounds).toFixed(4)} km², below the 0.01 km² minimum. Expanded to ${calculateAreaKm2({
          minLat: latMid - neededLatSpan / 2,
          maxLat: latMid + neededLatSpan / 2,
          minLon: lonMid - neededLonSpan / 2,
          maxLon: lonMid + neededLonSpan / 2,
        }).toFixed(4)} km² to fetch elevation data.`
      : null,
  };
}

export async function fetchDemForBounds(bounds, detailLevel = 'standard') {
  const detail = DETAIL_CONFIG[detailLevel] || DETAIL_CONFIG.standard;
  const errors = [];

  // Expand bounds if below minimum area requirement
  const expansion = expandToBoundsToMinimum(bounds);
  const fetchBounds = expansion.bounds;

  // 1. Try OpenTopography global DEM if key is configured
  if (config.dem.openTopographyKey) {
    try {
      const data = await opentopography.fetchDem(fetchBounds, { ...detail, detailLevel });
      return {
        ...data,
        detailLevel,
        sources: ['opentopography'],
        originalBounds: bounds,
        fetchBounds,
        wasExpanded: expansion.wasExpanded,
        expansionNote: expansion.expansionNote,
      };
    } catch (err) {
      errors.push(`OpenTopography: ${err.message}`);
    }
  }

  // 2. Fallback to Open-Meteo (free, no key)
  try {
    await new Promise((r) => setTimeout(r, 2000));
    const data = await openmeteo.fetchElevation(fetchBounds, { ...detail, detailLevel });
    return {
      ...data,
      detailLevel,
      sources: ['open-meteo'],
      originalBounds: bounds,
      fetchBounds,
      wasExpanded: expansion.wasExpanded,
      expansionNote: expansion.expansionNote,
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
  if (sources.includes('usgs-3dep')) return 'USGS 3DEP high-resolution DEM (10m)';
  if (sources.includes('opentopography')) return 'OpenTopography global DEM';
  if (sources.includes('open-meteo')) return 'Open-Meteo SRTM/ASTER elevation (fallback)';
  return 'Unknown source';
}
