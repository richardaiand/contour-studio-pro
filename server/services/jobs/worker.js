import { setTimeout } from 'timers/promises';
import { getDb } from '../../db.js';
import { now } from '../../utils/index.js';
import { claimPendingJob, updateJob } from './db.js';
import { fetchDemForBounds, selectSourceDescription } from '../dem/router.js';
import { gridToMesh } from '../terrain/mesh.js';
import { cleanupMesh } from '../terrain/cleanup.js';
import { createProjectFromJob, updateProjectFromJob, updateProjectTerrain } from '../projects/db.js';
import { fetchTnmDem, fetchTopoMapUrl } from '../topo/tnm.js';
import { mergeGrids } from '../topo/merger.js';
import { enhanceWithTopoMap } from '../topo/hybrid.js';

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

  // ===== PHASE 1: Basic DEM + mesh (fast, show to user immediately) =====
  setProgress(10);
  const dem = await fetchDemForBounds(bounds, detailLevel);

  setProgress(25);
  if (!dem.grid || dem.grid.length === 0) {
    throw new Error('DEM grid was empty');
  }

  const meshBounds = dem.fetchBounds || bounds;
  const mesh = gridToMesh(dem.grid, meshBounds, { verticalExaggeration });

  const cleaned = cleanupMesh(mesh.positions, mesh.normals, mesh.indices, mesh.uvs, mesh.colors);
  mesh.positions = cleaned.positions;
  mesh.normals = cleaned.normals;
  mesh.indices = cleaned.indices;
  mesh.uvs = cleaned.uvs;
  mesh.colors = cleaned.colors;

  // Save initial version to project
  setProgress(45);
  const project = job.payload.projectId
    ? updateProjectFromJob(job.payload.projectId, job, dem, mesh)
    : createProjectFromJob(job, dem, mesh);

  // Send phase 1 result so client can show terrain immediately
  // Keep status as 'running' with progress 50 — client detects phase via result.phase
  await updateJob(job.id, {
    progress: 50,
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
      phase: 1,
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

  // ===== PHASE 2: Enhancement (TNM + AI hybrid, run in background) =====
  let topoMapInfo = null;
  let enhanced = false;

  if (bounds.minLat >= 24 && bounds.maxLat <= 50 && bounds.minLon >= -125 && bounds.maxLon <= -66) {
    // TNM DEM enhancement
    try {
      setProgress(60);
      const targetSize = dem.grid.length;
      const tnmData = await fetchTnmDem(meshBounds, targetSize);
      if (tnmData && tnmData.grid && tnmData.grid.length > 0) {
        dem.grid = mergeGrids(dem.grid, tnmData.grid);
        if (tnmData.resolutionMeters < dem.resolutionMeters) {
          dem.resolutionMeters = tnmData.resolutionMeters;
        }
        dem.sources = [...new Set([...(dem.sources || []), 'usgs-tnm'])];
        dem.attribution += '; ' + tnmData.attribution;
        enhanced = true;
        console.log(`TNM enhancement: merged ${tnmData.width}x${tnmData.height} grid at ${tnmData.resolutionMeters}m resolution`);
      }
    } catch (err) {
      console.warn(`TNM enhancement failed (non-fatal): ${err.message}`);
    }

    // AI topo map hybrid
    try {
      setProgress(75);
      const hybridResult = await enhanceWithTopoMap(bounds, dem.grid, meshBounds, job.userId);
      if (hybridResult) {
        if (hybridResult.grid) {
          dem.grid = hybridResult.grid;
          enhanced = true;
        }
        topoMapInfo = hybridResult.topoMap;
        dem.sources = [...new Set([...(dem.sources || []), 'ai-topo-hybrid'])];
        console.log('AI topo map hybrid: enhanced grid with contour data');
      } else if (hybridResult?.topoMap) {
        topoMapInfo = hybridResult.topoMap;
      }
    } catch (err) {
      console.warn(`AI topo map hybrid failed (non-fatal): ${err.message}`);
      try {
        topoMapInfo = await fetchTopoMapUrl(bounds);
      } catch {}
    }
  }

  // If enhancement happened, rebuild mesh and update project
  if (enhanced) {
    setProgress(90);
    const enhancedMesh = gridToMesh(dem.grid, meshBounds, { verticalExaggeration });
    const enhancedCleaned = cleanupMesh(enhancedMesh.positions, enhancedMesh.normals, enhancedMesh.indices, enhancedMesh.uvs, enhancedMesh.colors);
    enhancedMesh.positions = enhancedCleaned.positions;
    enhancedMesh.normals = enhancedCleaned.normals;
    enhancedMesh.indices = enhancedCleaned.indices;
    enhancedMesh.uvs = enhancedCleaned.uvs;
    enhancedMesh.colors = enhancedCleaned.colors;

    // Update project with enhanced version
    updateProjectTerrain

    // Update job with phase 2 result
    await updateJob(job.id, {
      status: 'completed',
      progress: 100,
      result: {
        projectId: project.id,
        projectTitle: project.title,
        detailLevel,
        resolutionMeters: dem.resolutionMeters,
        minElevation: enhancedMesh.minElevation,
        maxElevation: enhancedMesh.maxElevation,
        verticalExaggeration,
        sources: dem.sources,
        sourceDescription: selectSourceDescription(dem.sources, detailLevel),
        attribution: dem.attribution,
        wasExpanded: dem.wasExpanded || false,
        expansionNote: dem.expansionNote || null,
        originalBounds: dem.originalBounds || bounds,
        fetchBounds: dem.fetchBounds || bounds,
        topoMap: topoMapInfo,
        phase: 2,
        mesh: {
          width: enhancedMesh.width,
          height: enhancedMesh.height,
          grid: enhancedMesh.grid,
          positions: enhancedMesh.positions,
          normals: enhancedMesh.normals,
          uvs: enhancedMesh.uvs,
          colors: enhancedMesh.colors,
          indices: enhancedMesh.indices,
          minElevation: enhancedMesh.minElevation,
          maxElevation: enhancedMesh.maxElevation,
        },
      },
    });
  } else {
    // No enhancement — just update progress to 100
    await updateJob(job.id, {
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
        phase: 2,
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
}
