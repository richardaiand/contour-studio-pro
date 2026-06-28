import { setTimeout } from 'timers/promises';
import { getDb } from '../../db.js';
import { now } from '../../utils/index.js';
import { claimPendingJob, updateJob } from './db.js';
import { fetchDemForBounds, selectSourceDescription } from '../dem/router.js';
import { gridToMesh } from '../terrain/mesh.js';
import { cleanupMesh } from '../terrain/cleanup.js';
import { createProjectFromJob, updateProjectFromJob } from '../projects/db.js';
import { fetchTnmDem, fetchTopoMapUrl } from '../topo/tnm.js';
import { mergeGrids } from '../topo/merger.js';

const PROCESSORS = {
  'terrain:generate': processTerrainJob,
};

let running = false;

export function startWorker() {
  if (running) return;
  running = true;
  resetStuckJobs();
  console.log('Starting async job worker');
  loop().catch((err) => {
    console.error('Job worker crashed:', err);
    running = false;
  });
}

function resetStuckJobs() {
  try {
    const db = getDb();
    const result = db.prepare(
      `UPDATE jobs SET status = 'pending', progress = 0, updated_at = ? WHERE status = 'running'`
    ).run(now());
    if (result.changes > 0) {
      console.log(`Reset ${result.changes} stuck job(s) to pending`);
    }
  } catch (err) {
    console.error('Failed to reset stuck jobs:', err);
  }
}

export function stopWorker() {
  running = false;
}

async function loop() {
  while (running) {
    try {
      const job = claimPendingJob();
      if (job) {
        await runJob(job);
      }
    } catch (err) {
      console.error('Worker loop error:', err);
    }
    await setTimeout(1000);
  }
}

async function runJob(job) {
  const processor = PROCESSORS[job.type];
  if (!processor) {
    await updateJob(job.id, { status: 'failed', error: `Unknown job type: ${job.type}` });
    return;
  }

  try {
    console.log(`Processing job ${job.id} (${job.type})`);
    await processor(job, (progress) => updateJob(job.id, { progress }));
  } catch (err) {
    console.error(`Job ${job.id} failed:`, err);
    await updateJob(job.id, {
      status: 'failed',
      progress: 100,
      error: err.message || 'Unknown error',
    });
  }
}

async function processTerrainJob(job, setProgress) {
  const { bounds, detailLevel = 'standard', verticalExaggeration = 1.5 } = job.payload;

  setProgress(10);
  const dem = await fetchDemForBounds(bounds, detailLevel);

  setProgress(30);
  // Hybrid enhancement: try to fetch higher-resolution DEM from USGS TNM (US only)
  let topoMapInfo = null;
  if (bounds.minLat >= 24 && bounds.maxLat <= 50 && bounds.minLon >= -125 && bounds.maxLon <= -66) {
    try {
      const meshBounds = dem.fetchBounds || bounds;
      const targetSize = dem.grid.length;
      const tnmData = await fetchTnmDem(meshBounds, targetSize);
      if (tnmData && tnmData.grid && tnmData.grid.length > 0) {
        dem.grid = mergeGrids(dem.grid, tnmData.grid);
        if (tnmData.resolutionMeters < dem.resolutionMeters) {
          dem.resolutionMeters = tnmData.resolutionMeters;
        }
        dem.sources = [...new Set([...(dem.sources || []), 'usgs-tnm'])];
        dem.attribution += '; ' + tnmData.attribution;
        console.log(`TNM enhancement: merged ${tnmData.width}x${tnmData.height} grid at ${tnmData.resolutionMeters}m resolution`);
      }
    } catch (err) {
      console.warn(`TNM enhancement failed (non-fatal): ${err.message}`);
    }

    // Fetch US Topo map sheet info for reference
    try {
      topoMapInfo = await fetchTopoMapUrl(bounds);
    } catch {
      // non-fatal
    }
  }

  setProgress(60);
  if (!dem.grid || dem.grid.length === 0) {
    throw new Error('DEM grid was empty');
  }

  // Use the fetch bounds (which may be expanded) for mesh generation
  // so the terrain covers the full data area
  const meshBounds = dem.fetchBounds || bounds;
  const mesh = gridToMesh(dem.grid, meshBounds, { verticalExaggeration });

  // V2.4: Clean up mesh geometry (remove degenerate triangles, weld duplicates)
  const cleaned = cleanupMesh(mesh.positions, mesh.normals, mesh.indices, mesh.uvs, mesh.colors);
  mesh.positions = cleaned.positions;
  mesh.normals = cleaned.normals;
  mesh.indices = cleaned.indices;
  mesh.uvs = cleaned.uvs;
  mesh.colors = cleaned.colors;
  console.log(`Mesh cleanup: removed ${cleaned.removedDegenerate} degenerate triangles, merged ${cleaned.mergedVertices} duplicate vertices`);

  setProgress(95);
  const project = job.payload.projectId
    ? updateProjectFromJob(job.payload.projectId, job, dem, mesh)
    : createProjectFromJob(job, dem, mesh);
  await updateJob(job.id, {
    status: 'completed',
    progress: 100,
    result: {
      projectId: project.id,
      projectTitle: project.title,
      detailLevel,
      resolutionMeters: dem.resolutionMeters,
      minElevation: mesh.minElevation,
      maxElevation: mesh.maxElevation,
      verticalExaggeration,
      sources: dem.sources,
      sourceDescription: selectSourceDescription(dem.sources, detailLevel),
      attribution: dem.attribution,
      wasExpanded: dem.wasExpanded || false,
      expansionNote: dem.expansionNote || null,
      originalBounds: dem.originalBounds || bounds,
      fetchBounds: dem.fetchBounds || bounds,
      topoMap: topoMapInfo,
      mesh: {
        width: mesh.width,
        height: mesh.height,
        grid: mesh.grid,
        positions: mesh.positions,
        normals: mesh.normals,
        uvs: mesh.uvs,
        colors: mesh.colors,
        indices: mesh.indices,
        minElevation: mesh.minElevation,
        maxElevation: mesh.maxElevation,
      },
    },
  });
}
