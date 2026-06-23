export function gridToMesh(grid, bounds, options = {}) {
  const { verticalExaggeration = 1.5, baseHeight = 0 } = options;
  const height = grid.length;
  const width = grid[0]?.length || 0;

  if (height < 2 || width < 2) {
    throw new Error('Grid must be at least 2x2');
  }

  const minElevation = Math.min(...grid.flat());
  const maxElevation = Math.max(...grid.flat());
  const elevationRange = Math.max(0.001, maxElevation - minElevation);

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const colors = [];

  const latMid = (bounds.minLat + bounds.maxLat) / 2;
  const xScale = 111320 * Math.cos((latMid * Math.PI) / 180);
  const zScale = 111320;

  const xSpanMeters = (bounds.maxLon - bounds.minLon) * xScale;
  const zSpanMeters = (bounds.maxLat - bounds.minLat) * zScale;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const lon = bounds.minLon + ((bounds.maxLon - bounds.minLon) * x) / (width - 1);
      const lat = bounds.minLat + ((bounds.maxLat - bounds.minLat) * y) / (height - 1);

      const px = (lon - bounds.minLon) * xScale - xSpanMeters / 2;
      const pz = (lat - bounds.minLat) * zScale - zSpanMeters / 2;
      const py = (grid[y][x] - minElevation) * verticalExaggeration + baseHeight;

      positions.push(px, py, pz);
      uvs.push(x / (width - 1), y / (height - 1));

      // Simple color by elevation (terrain-ish ramp)
      const t = (grid[y][x] - minElevation) / elevationRange;
      const [r, g, b] = elevationColor(t);
      colors.push(r, g, b);

      normals.push(0, 1, 0);
    }
  }

  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const a = y * width + x;
      const b = a + 1;
      const c = a + width;
      const d = c + 1;

      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  computeNormals(positions, normals, indices);

  return {
    width,
    height,
    grid,
    positions,
    normals,
    uvs,
    colors,
    indices,
    bounds,
    minElevation,
    maxElevation,
    elevationRange,
    verticalExaggeration,
    xSpanMeters,
    zSpanMeters,
  };
}

function elevationColor(t) {
  // Low: green/brown, Mid: brown/gray, High: white
  if (t < 0.3) return [0.2 + t * 0.5, 0.5 + t * 0.8, 0.2];
  if (t < 0.7) return [0.55 + (t - 0.3) * 0.3, 0.45 - (t - 0.3) * 0.4, 0.25 - (t - 0.3) * 0.2];
  return [0.7 + (t - 0.7) * 0.9, 0.7 + (t - 0.7) * 0.9, 0.7 + (t - 0.7) * 0.9];
}

function computeNormals(positions, normals, indices) {
  // Reset normals
  for (let i = 0; i < normals.length; i++) normals[i] = 0;

  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i] * 3;
    const i1 = indices[i + 1] * 3;
    const i2 = indices[i + 2] * 3;

    const ax = positions[i1] - positions[i0];
    const ay = positions[i1 + 1] - positions[i0 + 1];
    const az = positions[i1 + 2] - positions[i0 + 2];

    const bx = positions[i2] - positions[i0];
    const by = positions[i2 + 1] - positions[i0 + 1];
    const bz = positions[i2 + 2] - positions[i0 + 2];

    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;

    normals[i0] += nx; normals[i0 + 1] += ny; normals[i0 + 2] += nz;
    normals[i1] += nx; normals[i1 + 1] += ny; normals[i1 + 2] += nz;
    normals[i2] += nx; normals[i2 + 1] += ny; normals[i2 + 2] += nz;
  }

  for (let i = 0; i < normals.length; i += 3) {
    const x = normals[i];
    const y = normals[i + 1];
    const z = normals[i + 2];
    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    normals[i] = x / len;
    normals[i + 1] = y / len;
    normals[i + 2] = z / len;
  }
}
