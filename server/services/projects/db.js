import { getDb, generateId } from '../../db.js';
import { now, parseJson } from '../../utils/index.js';

export function createProjectFromJob(job, dem, mesh) {
  const db = getDb();
  const id = generateId();
  const createdAt = now();

  const center = {
    lat: (job.payload.bounds.minLat + job.payload.bounds.maxLat) / 2,
    lon: (job.payload.bounds.minLon + job.payload.bounds.maxLon) / 2,
  };

  const title = generateTitle(center, job.payload.detailLevel);

  const sourceInfo = {
    sources: dem.sources,
    attribution: dem.attribution,
    resolutionMeters: dem.resolutionMeters,
    verticalExaggeration: job.payload.verticalExaggeration,
    minElevation: mesh.minElevation,
    maxElevation: mesh.maxElevation,
  };

  const terrainData = buildTerrainData(dem, mesh, job.payload);

  db.prepare(
    `INSERT INTO projects (id, user_id, title, detail_level, bounds_json, center_json, source_info_json, terrain_data_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    job.userId,
    title,
    job.payload.detailLevel,
    JSON.stringify(job.payload.bounds),
    JSON.stringify(center),
    JSON.stringify(sourceInfo),
    JSON.stringify(terrainData),
    createdAt,
    createdAt
  );

  return { id, title };
}

export function updateProjectFromJob(projectId, job, dem, mesh) {
  const db = getDb();
  const center = {
    lat: (job.payload.bounds.minLat + job.payload.bounds.maxLat) / 2,
    lon: (job.payload.bounds.minLon + job.payload.bounds.maxLon) / 2,
  };

  const sourceInfo = {
    sources: dem.sources,
    attribution: dem.attribution,
    resolutionMeters: dem.resolutionMeters,
    verticalExaggeration: job.payload.verticalExaggeration,
    minElevation: mesh.minElevation,
    maxElevation: mesh.maxElevation,
  };

  const existing = db.prepare('SELECT terrain_data_json, terrain_versions_json FROM projects WHERE id = ?').get(projectId);
  const oldTerrainData = parseJson(existing?.terrain_data_json, null);
  let versions = parseJson(existing?.terrain_versions_json, []);

  if (oldTerrainData) {
    const versionNumber = versions.length + 1;
    versions.unshift({
      ...oldTerrainData,
      savedAt: now(),
      versionLabel: `v${versionNumber}`,
    });
    if (versions.length > 10) versions.length = 10;
  }

  const terrainData = buildTerrainData(dem, mesh, job.payload);

  const currentVersionNumber = versions.length + 1;
  terrainData.versionLabel = `v${currentVersionNumber}`;

  db.prepare(
    `UPDATE projects SET bounds_json = ?, center_json = ?, source_info_json = ?, terrain_data_json = ?, terrain_versions_json = ?, updated_at = ? WHERE id = ?`
  ).run(
    JSON.stringify(job.payload.bounds),
    JSON.stringify(center),
    JSON.stringify(sourceInfo),
    JSON.stringify(terrainData),
    JSON.stringify(versions),
    now(),
    projectId
  );

  const row = db.prepare('SELECT title FROM projects WHERE id = ?').get(projectId);
  return { id: projectId, title: row?.title || 'Terrain' };
}

function buildTerrainData(dem, mesh, payload) {
  return {
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
    originalBounds: dem.originalBounds || payload.bounds,
    fetchBounds: dem.fetchBounds || payload.bounds,
    wasExpanded: dem.wasExpanded || false,
    minElevation: mesh.minElevation,
    maxElevation: mesh.maxElevation,
    resolutionMeters: dem.resolutionMeters,
    verticalExaggeration: payload.verticalExaggeration,
    sourceDescription: dem.sources?.includes('usgs-3dep')
      ? 'USGS 3DEP high-resolution lidar DEM'
      : dem.sources?.includes('opentopography')
      ? 'OpenTopography global DEM'
      : 'Open-Meteo SRTM/ASTER elevation (fallback)',
  };
}

export function recordExport({ userId, projectId, format, filename, sizeBytes }) {
  const db = getDb();
  const id = generateId();
  db.prepare(
    `INSERT INTO exports (id, user_id, project_id, format, filename, size_bytes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId, projectId || null, format, filename, sizeBytes || 0, now());
  return id;
}

function generateTitle(center, detailLevel) {
  const level = detailLevel ? detailLevel[0].toUpperCase() + detailLevel.slice(1) : 'Terrain';
  const latDir = center.lat >= 0 ? 'N' : 'S';
  const lonDir = center.lon >= 0 ? 'E' : 'W';
  return `${level} · ${Math.abs(center.lat).toFixed(4)}°${latDir}, ${Math.abs(center.lon).toFixed(4)}°${lonDir}`;
}
