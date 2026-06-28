import { parseGeoTiff, resampleGrid } from '../dem/geotiff.js';

const TNM_API = 'https://tnmaccess.nationalmap.gov/api/v1/products';

export async function fetchTnmDem(bounds, targetSize = 256) {
  const bbox = `${bounds.minLon},${bounds.minLat},${bounds.maxLon},${bounds.maxLat}`;

  const url = new URL(TNM_API);
  url.searchParams.set('datasets', 'National Elevation Dataset (NED)');
  url.searchParams.set('bbox', bbox);
  url.searchParams.set('prodFormats', 'GeoTIFF');
  url.searchParams.set('max', '20');

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    throw new Error(`TNM API error ${res.status}`);
  }

  const data = await res.json();
  const items = (data.items || []).filter((i) => i.downloadURL && i.prodFormat === 'GeoTIFF');

  if (items.length === 0) return null;

  const tiles = [];
  for (const item of items.slice(0, 4)) {
    try {
      const tile = await downloadAndParseTile(item.downloadURL);
      if (tile) tiles.push(tile);
    } catch (err) {
      console.warn(`TNM tile download failed: ${err.message}`);
    }
  }

  if (tiles.length === 0) return null;

  const merged = mergeTiles(tiles, bounds, targetSize);

  const resolutionMeters = estimateResolution(bounds, merged.length);

  return {
    ...merged,
    resolutionMeters,
    source: 'usgs-tnm',
    attribution: 'Elevation data from USGS The National Map (NED)',
  };
}

export async function fetchTopoMapUrl(bounds) {
  const bbox = `${bounds.minLon},${bounds.minLat},${bounds.maxLon},${bounds.maxLat}`;

  const url = new URL(TNM_API);
  url.searchParams.set('datasets', 'US Topo');
  url.searchParams.set('bbox', bbox);
  url.searchParams.set('prodFormats', 'GeoTIFF');
  url.searchParams.set('max', '5');

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;

    const data = await res.json();
    const items = (data.items || []).filter((i) => i.downloadURL);

    if (items.length === 0) return null;

    return {
      title: items[0].title,
      downloadUrl: items[0].downloadURL,
      publicationDate: items[0].publicationDate || null,
    };
  } catch {
    return null;
  }
}

async function downloadAndParseTile(downloadUrl) {
  const res = await fetch(downloadUrl, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  const arrayBuffer = await res.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const isTiff =
    (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a) ||
    (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00);
  if (!isTiff) return null;

  const parsed = await parseGeoTiff(arrayBuffer);
  if (!parsed.bounds) return null;

  return parsed;
}

function mergeTiles(tiles, targetBounds, targetSize) {
  const latMid = (targetBounds.minLat + targetBounds.maxLat) / 2;
  const xScale = 111320 * Math.cos((latMid * Math.PI) / 180);
  const zScale = 111320;

  const xSpanMeters = (targetBounds.maxLon - targetBounds.minLon) * xScale;
  const zSpanMeters = (targetBounds.maxLat - targetBounds.minLat) * zScale;

  const grid = [];
  for (let y = 0; y < targetSize; y++) {
    const row = [];
    for (let x = 0; x < targetSize; x++) {
      row.push(null);
    }
    grid.push(row);
  }

  const cellLat = (targetBounds.maxLat - targetBounds.minLat) / (targetSize - 1);
  const cellLon = (targetBounds.maxLon - targetBounds.minLon) / (targetSize - 1);

  for (const tile of tiles) {
    if (!tile.bounds) continue;

    const tLatSpan = tile.bounds.maxLat - tile.bounds.minLat;
    const tLonSpan = tile.bounds.maxLon - tile.bounds.minLon;
    if (tLatSpan <= 0 || tLonSpan <= 0) continue;

    const tHeight = tile.grid.length;
    const tWidth = tile.grid[0]?.length || 0;

    for (let y = 0; y < targetSize; y++) {
      const lat = targetBounds.minLat + y * cellLat;
      if (lat < tile.bounds.minLat || lat > tile.bounds.maxLat) continue;

      for (let x = 0; x < targetSize; x++) {
        const lon = targetBounds.minLon + x * cellLon;
        if (lon < tile.bounds.minLon || lon > tile.bounds.maxLon) continue;

        const tx = Math.round(((lon - tile.bounds.minLon) / tLonSpan) * (tWidth - 1));
        const ty = Math.round(((lat - tile.bounds.minLat) / tLatSpan) * (tHeight - 1));

        const sx = Math.max(0, Math.min(tWidth - 1, tx));
        const sy = Math.max(0, Math.min(tHeight - 1, ty));

        grid[y][x] = tile.grid[sy][sx];
      }
    }
  }

  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize; x++) {
      if (grid[y][x] === null) {
        grid[y][x] = 0;
      }
    }
  }

  return {
    width: targetSize,
    height: targetSize,
    grid,
  };
}

function estimateResolution(bounds, samples) {
  const latMid = (bounds.minLat + bounds.maxLat) / 2;
  const latSpanMeters = (bounds.maxLat - bounds.minLat) * 111320;
  const lonSpanMeters = (bounds.maxLon - bounds.minLon) * 111320 * Math.cos((latMid * Math.PI) / 180);
  const spanMeters = Math.min(latSpanMeters, lonSpanMeters);
  return Math.round(spanMeters / samples);
}
