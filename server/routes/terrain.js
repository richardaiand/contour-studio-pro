import { fetchDemForBounds, selectSourceDescription, DETAIL_CONFIG } from '../services/dem/router.js';
import { gridToMesh } from '../services/terrain/mesh.js';
import { exportMesh } from '../services/terrain/exporter.js';
import { recordExport } from '../services/projects/db.js';
import { getDb } from '../db.js';
import { AppError } from '../errors.js';

export default async function (fastify) {
  // Generate terrain from bounds
  fastify.post('/generate', {
    onRequest: [fastify.authenticate],
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
        minElevation: mesh.minElevation,
        maxElevation: mesh.maxElevation,
      },
    };
  });

  // Export terrain mesh — fetch from project DB instead of client
  fastify.post('/export', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['format', 'projectId'],
        properties: {
          format: { type: 'string', enum: ['obj', 'stl', 'heightmap'] },
          filename: { type: 'string' },
          projectId: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const { format, filename = 'terrain', projectId } = req.body;

      // Fetch terrain data from project
      const db = getDb();
      const row = db.prepare('SELECT terrain_data_json FROM projects WHERE id = ? AND user_id = ?').get(projectId, req.user.userId);
      if (!row || !row.terrain_data_json) {
        throw new AppError('Project terrain not found', 404, 'NOT_FOUND');
      }

      const terrainData = JSON.parse(row.terrain_data_json);
      const mesh = terrainData.mesh;
      if (!mesh) {
        throw new AppError('No mesh data in project', 404, 'NOT_FOUND');
      }

      // Add grid from terrainData if available (needed for heightmap)
      if (terrainData.mesh.grid) mesh.grid = terrainData.mesh.grid;
      if (terrainData.minElevation !== undefined) mesh.minElevation = terrainData.minElevation;
      if (terrainData.maxElevation !== undefined) mesh.maxElevation = terrainData.maxElevation;

      req.log.info({ format, meshSize: mesh.positions?.length, hasGrid: !!mesh.grid }, 'Export request');
      const result = exportMesh(mesh, format, filename);

      if (req.user?.userId) {
        const sizeBytes = Buffer.isBuffer(result.data) ? result.data.length : Buffer.byteLength(result.data, 'utf8');
        recordExport({
          userId: req.user.userId,
          projectId,
          format,
          filename: result.filename,
          sizeBytes,
        });
      }

      reply.header('Content-Disposition', `attachment; filename="${result.filename}"`);
      reply.header('Content-Type', result.type);
      return reply.send(result.data);
    } catch (err) {
      if (err instanceof AppError) throw err;
      req.log.error({ err: err.message, stack: err.stack }, 'Export failed');
      throw new AppError('Export failed: ' + err.message, 500, 'EXPORT_ERROR');
    }
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
