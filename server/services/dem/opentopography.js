import { config } from '../../config.js';
import { AppError } from '../../errors.js';

const ENDPOINT = 'https://portal.opentopography.org/API/globaldem';
const DATASETS = {
  draft: 'SRTMGL3',
  standard: 'SRTMGL1',
  survey: 'SRTMGL1',
};

export async function fetchDem(bounds, detail) {
  if (!config.dem.openTopographyKey) {
    throw new AppError('OpenTopography API key not configured', 502, 'DEM_ERROR');
  }

  const dataset = DATASETS[detail.detailLevel] || DATASETS.standard;
  const url = new URL(ENDPOINT);
  url.searchParams.set('demtype', dataset);
  url.searchParams.set('south', bounds.minLat.toFixed(6));
  url.searchParams.set('north', bounds.maxLat.toFixed(6));
  url.searchParams.set('west', bounds.minLon.toFixed(6));
  url.searchParams.set('east', bounds.maxLon.toFixed(6));
  url.searchParams.set('outputFormat', 'GTiff');
  url.searchParams.set('API_Key', config.dem.openTopographyKey);

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new AppError(`OpenTopography error ${res.status}: ${text.slice(0, 200)}`, 502, 'DEM_ERROR');
  }

  // OpenTopography returns a GeoTIFF blob. For the MVP, we can't parse GeoTIFF
  // without a library, so we return metadata and fall back to Open-Meteo grid.
  // In production, use geotiff.js or GDAL to read the raster.
  return {
    width: detail.meshSize,
    height: detail.meshSize,
    grid: [], // placeholder
    resolutionMeters: dataset === 'SRTMGL1' ? 30 : 90,
    source: 'opentopography',
    attribution: `Elevation data by OpenTopography (${dataset})`,
    note: 'GeoTIFF returned; full raster parsing to be implemented with geotiff.js',
  };
}
