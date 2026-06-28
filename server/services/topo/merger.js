/**
 * Merge a high-resolution TNM grid into a lower-resolution DEM grid.
 * Where TNM has data, it replaces the DEM value (higher fidelity).
 * Where TNM has gaps (null/0), the original DEM value is kept.
 * 
 * @param {number[][]} demGrid - Original DEM grid (lower resolution)
 * @param {number[][]} tnmGrid - TNM grid (higher resolution, same target size)
 * @returns {number[][]} Merged grid
 */
export function mergeGrids(demGrid, tnmGrid) {
  if (!tnmGrid || tnmGrid.length === 0) return demGrid;

  const height = demGrid.length;
  const width = demGrid[0]?.length || 0;
  const tHeight = tnmGrid.length;
  const tWidth = tnmGrid[0]?.length || 0;

  if (tHeight === 0 || tWidth === 0) return demGrid;

  const merged = [];

  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const ty = Math.min(tHeight - 1, Math.round((y / Math.max(1, height - 1)) * (tHeight - 1)));
      const tx = Math.min(tWidth - 1, Math.round((x / Math.max(1, width - 1)) * (tWidth - 1)));

      const tnmValue = tnmGrid[ty][tx];

      if (tnmValue !== null && tnmValue !== undefined && tnmValue !== 0) {
        row.push(tnmValue);
      } else {
        row.push(demGrid[y][x]);
      }
    }
    merged.push(row);
  }

  return merged;
}
