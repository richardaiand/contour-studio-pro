import { PNG } from 'pngjs';
import { sanitizeFilename } from '../../utils/index.js';

export function exportMesh(mesh, format, nameRoot = 'terrain') {
  const filename = sanitizeFilename(nameRoot) + '.' + format;

  switch (format) {
    case 'obj':
      return { filename, data: toObj(mesh), type: 'text/plain' };
    case 'stl':
      return { filename, data: toAsciiStl(mesh), type: 'model/stl' };
    case 'heightmap':
      return { filename, data: toHeightmapPng(mesh), type: 'image/png' };
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

function toObj(mesh) {
  let text = '# Contour Studio terrain export\n';
  const positions = mesh.positions;
  const normals = mesh.normals;
  const uvs = mesh.uvs;
  const indices = mesh.indices;

  for (let i = 0; i < positions.length; i += 3) {
    text += `v ${positions[i].toFixed(6)} ${positions[i + 1].toFixed(6)} ${positions[i + 2].toFixed(6)}\n`;
  }

  for (let i = 0; i < uvs.length; i += 2) {
    text += `vt ${uvs[i].toFixed(6)} ${uvs[i + 1].toFixed(6)}\n`;
  }

  for (let i = 0; i < normals.length; i += 3) {
    text += `vn ${normals[i].toFixed(6)} ${normals[i + 1].toFixed(6)} ${normals[i + 2].toFixed(6)}\n`;
  }

  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] + 1;
    const b = indices[i + 1] + 1;
    const c = indices[i + 2] + 1;
    text += `f ${a}/${a}/${a} ${b}/${b}/${b} ${c}/${c}/${c}\n`;
  }

  return text;
}

function toAsciiStl(mesh) {
  let text = 'solid terrain\n';
  const positions = mesh.positions;
  const normals = mesh.normals;
  const indices = mesh.indices;

  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i] * 3;
    const i1 = indices[i + 1] * 3;
    const i2 = indices[i + 2] * 3;

    const nx = (normals[i0] + normals[i1] + normals[i2]) / 3;
    const ny = (normals[i0 + 1] + normals[i1 + 1] + normals[i2 + 1]) / 3;
    const nz = (normals[i0 + 2] + normals[i1 + 2] + normals[i2 + 2]) / 3;

    text += `  facet normal ${nx.toFixed(6)} ${ny.toFixed(6)} ${nz.toFixed(6)}\n`;
    text += '    outer loop\n';
    text += `      vertex ${positions[i0].toFixed(6)} ${positions[i0 + 1].toFixed(6)} ${positions[i0 + 2].toFixed(6)}\n`;
    text += `      vertex ${positions[i1].toFixed(6)} ${positions[i1 + 1].toFixed(6)} ${positions[i1 + 2].toFixed(6)}\n`;
    text += `      vertex ${positions[i2].toFixed(6)} ${positions[i2 + 1].toFixed(6)} ${positions[i2 + 2].toFixed(6)}\n`;
    text += '    endloop\n';
    text += '  endfacet\n';
  }

  text += 'endsolid terrain\n';
  return text;
}

function toHeightmapPng(mesh) {
  const { width, height, minElevation, maxElevation, grid } = mesh;

  if (!grid || grid.length === 0) {
    throw new Error('Mesh is missing elevation grid for heightmap export');
  }

  const png = new PNG({ width, height, filterType: -1 });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const elevation = grid[y][x];
      const t = maxElevation > minElevation
        ? (elevation - minElevation) / (maxElevation - minElevation)
      const gray = Math.round(clamp(t, 0, 1) * 255);
      png.data[idx] = gray;
      png.data[idx + 1] = gray;
      png.data[idx + 2] = gray;
      png.data[idx + 3] = 255;
    }
  }

  return PNG.sync.write(png);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
