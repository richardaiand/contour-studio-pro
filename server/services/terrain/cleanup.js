// V2.4: Mesh geometry cleanup
// Removes degenerate triangles and merges duplicate vertices

export function cleanupMesh(positions, normals, indices) {
  let removedDegenerate = 0;
  let mergedVertices = 0;

  const result = removeDegenerateTriangles(positions, indices);
  removedDegenerate = result.removedCount;

  const mergeResult = mergeDuplicateVertices(result.positions, result.indices);
  mergedVertices = mergeResult.mergedCount;

  const cleanedNormals = recomputeNormals(mergeResult.positions, mergeResult.indices);

  return {
    positions: mergeResult.positions,
    normals: cleanedNormals,
    indices: mergeResult.indices,
    removedDegenerate,
    mergedVertices,
  };
}

export function removeDegenerateTriangles(positions, indices) {
  const kept = [];
  let removedCount = 0;

  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i];
    const b = indices[i + 1];
    const c = indices[i + 2];

    const ax = positions[a * 3];
    const ay = positions[a * 3 + 1];
    const az = positions[a * 3 + 2];
    const bx = positions[b * 3];
    const by = positions[b * 3 + 1];
    const bz = positions[b * 3 + 2];
    const cx = positions[c * 3];
    const cy = positions[c * 3 + 1];
    const cz = positions[c * 3 + 2];

    const ex1 = bx - ax;
    const ey1 = by - ay;
    const ez1 = bz - az;
    const ex2 = cx - ax;
    const ey2 = cy - ay;
    const ez2 = cz - az;

    const crossX = ey1 * ez2 - ez1 * ey2;
    const crossY = ez1 * ex2 - ex1 * ez2;
    const crossZ = ex1 * ey2 - ey1 * ex2;
    const area2 = crossX * crossX + crossY * crossY + crossZ * crossZ;

    if (area2 < 1e-20) {
      removedCount++;
      continue;
    }

    kept.push(a, b, c);
  }

  return { positions, indices: kept, removedCount };
}

export function mergeDuplicateVertices(positions, indices) {
  const precision = 3;
  const hash = new Map();
  const newPositions = [];
  const remap = new Map();
  let nextIndex = 0;

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    const key = `${x.toFixed(precision)},${y.toFixed(precision)},${z.toFixed(precision)}`;

    if (hash.has(key)) {
      remap.set(i / 3, hash.get(key));
    } else {
      hash.set(key, nextIndex);
      remap.set(i / 3, nextIndex);
      newPositions.push(x, y, z);
      nextIndex++;
    }
  }

  const newIndices = new Array(indices.length);
  for (let i = 0; i < indices.length; i++) {
    newIndices[i] = remap.get(indices[i]) ?? indices[i];
  }

  const mergedCount = positions.length / 3 - newPositions.length / 3;

  return { positions: newPositions, indices: newIndices, mergedCount };
}

function recomputeNormals(positions, indices) {
  const normals = new Array(positions.length).fill(0);

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

  return normals;
}
