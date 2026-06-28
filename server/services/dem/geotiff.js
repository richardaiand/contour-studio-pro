import { fromArrayBuffer } from 'geotiff';
export { resampleGrid } from './grid.js';

/**
 * Parse a GeoTIFF buffer into an elevation grid.
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<{width: number, height: number, grid: number[][], noData: number}>}
 */
export async function parseGeoTiff(arrayBuffer) {
  const tiff = await fromArrayBuffer(arrayBuffer);
  const image = await tiff.getImage();

  const width = image.getWidth();
  const height = image.getHeight();

  let noData = null;
  const gdalNoData = image.getGDALNoData?.();
  if (gdalNoData !== undefined && gdalNoData !== null && !Number.isNaN(Number(gdalNoData))) {
    noData = Number(gdalNoData);
  }

  let bounds = null;
  try {
    const bbox = image.getBoundingBox();
    if (bbox && bbox.length === 4) {
      bounds = { minLon: bbox[0], minLat: bbox[1], maxLon: bbox[2], maxLat: bbox[3] };
    }
  } catch {}

  const data = await image.readRasters();
  const values = Array.isArray(data) ? data[0] : data;

  const grid = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      let value = values[idx];
      if (value === noData || value === null || value === undefined || Number.isNaN(value)) {
        value = 0;
      }
      row.push(Number(value));
    }
    grid.push(row);
  }

  grid.reverse();

  return { width, height, grid, noData, bounds };
}
