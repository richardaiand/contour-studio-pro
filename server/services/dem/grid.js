/**
 * Resample a grid to a target width/height using bilinear interpolation.
 * @param {number[][]} grid
 * @param {number} targetWidth
 * @param {number} targetHeight
 * @returns {number[][]}
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
    const fy = (y / Math.max(1, targetHeight - 1)) * (sourceHeight - 1);
    const sy0 = Math.floor(fy);
    const sy1 = Math.min(sourceHeight - 1, sy0 + 1);
    const ty = fy - sy0;

    for (let x = 0; x < targetWidth; x++) {
      const fx = (x / Math.max(1, targetWidth - 1)) * (sourceWidth - 1);
      const sx0 = Math.floor(fx);
      const sx1 = Math.min(sourceWidth - 1, sx0 + 1);
      const tx = fx - sx0;

      const v00 = grid[sy0][sx0];
      const v01 = grid[sy0][sx1];
      const v10 = grid[sy1][sx0];
      const v11 = grid[sy1][sx1];

      const top = v00 * (1 - tx) + v01 * tx;
      const bottom = v10 * (1 - tx) + v11 * tx;
      row.push(top * (1 - ty) + bottom * ty);
    }
    output.push(row);
  }

  return output;
}

/**
 * Smooth a grid using a simple averaging filter.
 * Each cell is blended with the average of its neighbors.
 * @param {number[][]} grid
 * @param {number} iterations - Number of smoothing passes (default 1)
 * @param {number} strength - 0 to 1, how much to blend toward the average (default 0.5)
 * @returns {number[][]}
 */
export function smoothGrid(grid, iterations = 1, strength = 0.5) {
  const height = grid.length;
  const width = grid[0]?.length || 0;
  if (height < 3 || width < 3) return grid;

  let current = grid;

  for (let iter = 0; iter < iterations; iter++) {
    const output = current.map((row) => [...row]);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const sum =
          current[y - 1][x - 1] + current[y - 1][x] + current[y - 1][x + 1] +
          current[y][x - 1] + current[y][x + 1] +
          current[y + 1][x - 1] + current[y + 1][x] + current[y + 1][x + 1];
        const avg = sum / 8;
        output[y][x] = current[y][x] * (1 - strength) + avg * strength;
      }
    }

    current = output;
  }

  return current;
}
