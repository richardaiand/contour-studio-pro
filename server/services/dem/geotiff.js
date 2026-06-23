import { fromArrayBuffer } from 'geotiff';

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

  const data = await image.readRasters({ interleave: true });
  const values = data[0] ?? data;

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

  return { width, height, grid, noData };
}

/**
 * Resample a grid to a target width/height using simple nearest-neighbor sampling.
 */
export function resampleGrid(grid, targetWidth, targetHeight) {
  const sourceHeight = grid.length;
  const sourceWidth = grid[0]?.length || 0;

  if (sourceWidth === 0 || sourceHeight === 0) {
    throw new Error('Cannot resample empty grid');
  }

  if (sourceWidth === targetWidth && sourceHeight === targetHeight) {
    return grid;
  }

  const output = [];
  for (let y = 0; y < targetHeight; y++) {
    const row = [];
    const sy = Math.min(sourceHeight - 1, Math.round((y / Math.max(1, targetHeight - 1)) * (sourceHeight - 1)));
    for (let x = 0; x < targetWidth; x++) {
      const sx = Math.min(sourceWidth - 1, Math.round((x / Math.max(1, targetWidth - 1)) * (sourceWidth - 1)));
      row.push(grid[sy][sx]);
    }
    output.push(row);
  }

  return output;
}
