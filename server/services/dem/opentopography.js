import { config } from '../../config.js';
import { AppError } from '../../errors.js';
import { parseGeoTiff, resampleGrid } from './geotiff.js';

const ENDPOINT = 'https://portal.opentopography.org/API/globaldem';
const DATASETS = {
  draft: 'SRTMGL3',
  standard: 'SRTMGL1',
  survey: 'USGS10m',
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  let res;
  try {
    res = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new AppError(`OpenTopography error ${res.status}: ${text.slice(0, 200)}`, 502, 'DEM_ERROR');
  }

  const arrayBuffer = await res.arrayBuffer();

  // Check for TIFF magic bytes instead of relying on content-type header
  const bytes = new Uint8Array(arrayBuffer);
  const isTiff =
    (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a) || // II* (little-endian)
    (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00);  // MM\0 (big-endian)

  if (!isTiff) {
    const text = new TextDecoder().decode(bytes.slice(0, 200));
    throw new AppError(`OpenTopography returned non-GeoTIFF response: ${text}`, 502, 'DEM_ERROR');
  }

  const { width, height, grid } = await parseGeoTiff(arrayBuffer);

  const targetSize = Math.min(detail.meshSize, detail.maxSamples);
  const finalGrid = resampleGrid(grid, targetSize, targetSize);

  // Nominal source resolution: USGS 3DEP 1m, SRTM GL1 ~30m, SRTM GL3 ~90m
  const nominalResolution =
    dataset === 'USGS10m' ? 10 : dataset === 'SRTMGL1' ? 30 : 90;

  return {
    width: targetSize,
    height: targetSize,
    grid: finalGrid,
    resolutionMeters: nominalResolution,
    source: dataset === 'USGS10m' ? 'usgs-3dep' : 'opentopography',
    attribution: `Elevation data by OpenTopography (${dataset})`,
  };
}
