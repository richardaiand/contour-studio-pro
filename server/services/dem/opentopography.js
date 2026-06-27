import { config } from '../../config.js';
import { AppError } from '../../errors.js';
import { parseGeoTiff, resampleGrid } from './geotiff.js';

const GLOBAL_ENDPOINT = 'https://portal.opentopography.org/API/globaldem';
const USGS_ENDPOINT = 'https://portal.opentopography.org/API/usgsdem';

const GLOBAL_DATASETS = {
  draft: 'SRTMGL3',
  standard: 'SRTMGL1',
};

const USGS_DATASETS = {
  survey: 'USGS10m',
};

export async function fetchDem(bounds, detail) {
  if (!config.dem.openTopographyKey) {
    throw new AppError('OpenTopography API key not configured', 502, 'DEM_ERROR');
  }

  const detailLevel = detail.detailLevel;
  const isUsgs = !!USGS_DATASETS[detailLevel];
  const dataset = isUsgs ? USGS_DATASETS[detailLevel] : (GLOBAL_DATASETS[detailLevel] || GLOBAL_DATASETS.standard);
  const endpoint = isUsgs ? USGS_ENDPOINT : GLOBAL_ENDPOINT;

  const url = new URL(endpoint);
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

  const bytes = new Uint8Array(arrayBuffer);
  const isTiff =
    (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a) ||
    (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00);

  if (!isTiff) {
    const text = new TextDecoder().decode(bytes.slice(0, 200));
    throw new AppError(`OpenTopography returned non-GeoTIFF response: ${text}`, 502, 'DEM_ERROR');
  }

  const { width, height, grid } = await parseGeoTiff(arrayBuffer);

  const targetSize = Math.min(detail.meshSize, detail.maxSamples);
  const finalGrid = resampleGrid(grid, targetSize, targetSize);

  const nominalResolution =
    dataset === 'USGS10m' ? 10 : dataset === 'SRTMGL1' ? 30 : 90;

  return {
    width: targetSize,
    height: targetSize,
    grid: finalGrid,
    resolutionMeters: nominalResolution,
    source: isUsgs ? 'usgs-3dep' : 'opentopography',
    attribution: `Elevation data by OpenTopography (${dataset})`,
  };
}
