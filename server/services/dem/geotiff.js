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

  // Try to read no-data value from GeoTIFF metadata
  let noData = null;
  const gdalNoData = image.getGDALNoData?.();
  if (gdalNoData !== undefined && gdalNoData !== null && !Number.isNaN(Number(gdalNoData))) {
    noData = Number(gdalNoData);
  }

  const data = await image.readRasters();
  // readRasters returns an array of bands; DEMs are typically single-band.
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

  // GeoTIFF row 0 is usually north; our mesh expects row 0 to be south (minLat).
  grid.reverse();

  return { width, height, grid, noData };
}
