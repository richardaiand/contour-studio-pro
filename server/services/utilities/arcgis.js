import { AppError } from '../../errors.js';

const SOCRATA_TIMEOUT = 20000;

export async function fetchSocrataFeatures(baseUrl, datasetId, bounds, extraParams = {}) {
  const { minLat, minLon, maxLat, maxLon } = bounds;
  const where = `within_box(the_geom, ${minLat}, ${minLon}, ${maxLat}, ${maxLon})`;

  const params = new URLSearchParams({
    $where: where,
    $limit: '500',
    ...extraParams,
  });

  const url = `${baseUrl}/${datasetId}.json?${params}`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(SOCRATA_TIMEOUT),
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new AppError(`Socrata API error ${res.status} for ${datasetId}`, 502, 'UTILITY_API_ERROR');
  }

  const rows = await res.json();
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    const geom = row.the_geom || row.geom || row.geometry;
    if (!geom) return null;
    return {
      type: 'Feature',
      geometry: geom,
      properties: {
        ...row,
        the_geom: undefined,
        geom: undefined,
      },
    };
  }).filter(Boolean);
}

export async function fetchArcGisFeatures(baseUrl, layerId, bounds) {
  const { minLat, minLon, maxLat, maxLon } = bounds;
  const envelope = `${minLon},${minLat},${maxLon},${maxLat}`;
  const url = `${baseUrl}/${layerId}/query?f=geojson&geometryType=esriGeometryEnvelope&geometry=${encodeURIComponent(envelope)}&spatialRel=esriSpatialRelIntersects&inSR=4326&outSR=4326&outFields=*&returnGeometry=true`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(SOCRATA_TIMEOUT),
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new AppError(`ArcGIS API error ${res.status}`, 502, 'UTILITY_API_ERROR');
  }

  const data = await res.json();
  return data.features || [];
}
