import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gridToMesh } from '../server/services/terrain/mesh.js';

describe('gridToMesh', () => {
  it('produces positions and indices for a 2x2 grid', () => {
    const grid = [
      [0, 10],
      [5, 15],
    ];
    const bounds = {
      minLat: 0,
      maxLat: 0.001,
      minLon: 0,
      maxLon: 0.001,
    };

    const mesh = gridToMesh(grid, bounds);

    assert.equal(mesh.width, 2);
    assert.equal(mesh.height, 2);
    // Top surface: 4 verts, Bottom: 4 verts = 8 total × 3 = 24
    assert.equal(mesh.positions.length, 8 * 3);
    // Top: 2 tri, Bottom: 2 tri, 4 walls × 2 tri = 12 tri × 3 = 36
    assert.equal(mesh.indices.length, 12 * 3);
    assert.ok(mesh.minElevation >= 0);
    assert.ok(mesh.maxElevation >= 15);
    assert.ok(mesh.grid);
  });

  it('throws for an empty grid', () => {
    assert.throws(() => gridToMesh([], { minLat: 0, maxLat: 1, minLon: 0, maxLon: 1 }));
  });

  it('throws for a 1xN grid', () => {
    assert.throws(() => gridToMesh([[1, 2]], { minLat: 0, maxLat: 1, minLon: 0, maxLon: 1 }));
  });
});
