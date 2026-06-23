import { fetchDemForBounds, selectSourceDescription, DETAIL_CONFIG } from '../services/dem/router.js';
import { gridToMesh } from '../services/terrain/mesh.js';
import { exportMesh } from '../services/terrain/exporter.js';
import { AppError } from '../errors.js';

export default async function (fastify) {
  // Generate terrain from bounds
  fastify.post('/generate', {
    schema: {
      body: {
        type: 'object',
        required: ['bounds'],
        properties: {
          bounds: {
            type: 'object',
            required: ['minLat', 'maxLat', 'minLon', 'maxLon'],
            properties: {
              minLat: { type: 'number' },
              maxLat: { type: 'number' },
              minLon: { type: 'number' },
              maxLon: { type: 'number' },
            },
          },
          detailLevel: { type: 'string', enum: ['draft', 'standard', 'survey'], default: 'standard' },
          verticalExaggeration: { type: 'number', default: 1.5 },
        },
      },
    },
  }, async (req) => {
    const { bounds, detailLevel = 'standard', verticalExaggeration = 1.5 } = req.body;

    if (bounds.minLat >= bounds.maxLat || bounds.minLon >= bounds.maxLon) {
      throw new AppError('Invalid bounds', 400, 'BAD_REQUEST');
    }

    const dem = await fetchDemForBounds(bounds, detailLevel);

    // Fallback: if grid is empty (e.g., OpenTopography placeholder), generate synthetic demo grid
    if (!dem.grid || dem.grid.length === 0) {
      dem.grid = generateSyntheticGrid(DETAIL_CONFIG[detailLevel].meshSize);
    }

    const mesh = gridToMesh(dem.grid, bounds, { verticalExaggeration });
    const sourceDescription = selectSourceDescription(dem.sources, detailLevel);

    return {
      detailLevel,
      resolutionMeters: dem.resolutionMeters,
      minElevation: mesh.minElevation,
      maxElevation: mesh.maxElevation,
      verticalExaggeration,
      sources: dem.sources,
      sourceDescription,
      attribution: dem.attribution,
      mesh: {
        width: mesh.width,
        height: mesh.height,
        positions: mesh.positions,
        normals: mesh.normals,
        uvs: mesh.uvs,
        colors: mesh.colors,
        indices: mesh.indices,
      },
    };
  });

  // Export terrain mesh
  fastify.post('/export', {
    schema: {
      body: {
        type: 'object',
        required: ['mesh', 'format'],
        properties: {
          mesh: { type: 'object' },
          format: { type: 'string', enum: ['obj', 'stl', 'heightmap'] },
          filename: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { mesh, format, filename = 'terrain' } = req.body;
    const result = exportMesh(mesh, format, filename);
    reply.header('Content-Disposition', `attachment; filename="${result.filename}"`);
    reply.header('Content-Type', result.type);
    return reply.send(result.data);
  });
}

function generateSyntheticGrid(size) {
  const grid = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      const h = Math.sin(nx * Math.PI * 3) * Math.cos(ny * Math.PI * 2) * 50 +
                Math.sin(nx * Math.PI * 8 + ny * Math.PI * 4) * 10 +
                100;
      row.push(h);
    }
    grid.push(row);
  }
  return grid;
}
