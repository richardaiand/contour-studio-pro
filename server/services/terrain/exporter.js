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

    // Use averaged face normal
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
  const { width, height, minElevation, maxElevation } = mesh;
  const size = width * height;
  const rgba = Buffer.alloc(size * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const elevation = mesh.grid[y][x];
      const t = maxElevation > minElevation
        ? (elevation - minElevation) / (maxElevation - minElevation)
        : 0;
      const gray = Math.round(clamp(t, 0, 1) * 255);
      const offset = idx * 4;
      rgba[offset] = gray;
      rgba[offset + 1] = gray;
      rgba[offset + 2] = gray;
      rgba[offset + 3] = 255;
    }
  }

  // Return raw PNG bytes (caller should use a PNG library for proper encoding)
  return {
    width,
    height,
    rgba,
    note: 'Raw RGBA heightmap; encode to PNG before serving',
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
