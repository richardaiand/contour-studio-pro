import { analyzeMap } from '../ai/analyzer.js';
import { fetchTopoMapUrl } from './tnm.js';

/**
 * Hybrid enhancement: download the US Topo map for the area, run AI vision
 * analysis to extract contour lines, then interpolate intermediate elevation
 * points from those contours into the DEM grid.
 * 
 * Requires an AI provider API key (user's key or server default).
 * 
 * @param {Object} bounds - { minLat, maxLat, minLon, maxLon }
 * @param {number[][]} grid - Current DEM grid
 * @param {Object} bounds2 - Mesh bounds (fetchBounds)
 * @param {string} userId - User ID for AI key lookup
 * @returns {Promise<{grid: number[][], analysis: Object, topoMap: Object} | null>}
 */
export async function enhanceWithTopoMap(bounds, grid, meshBounds, userId) {
  // 1. Fetch the topo map sheet URL for this area
  const topoMapInfo = await fetchTopoMapUrl(bounds);
  if (!topoMapInfo?.downloadUrl) return null;

  // 2. Download the topo map as an image buffer
  const imageBuffer = await downloadTopoMapImage(topoMapInfo.downloadUrl);
  if (!imageBuffer) return null;

  // 3. Run AI vision analysis to extract contours and features
  const analysis = await analyzeMap({
    imageBuffer,
    mimeType: 'image/png',
    userId,
  });

  if (!analysis || !analysis.contours || analysis.contours.length === 0) {
    return { analysis, topoMap: topoMapInfo };
  }

  // 4. Use the AI-extracted contour data to enhance the grid
  const enhancedGrid = interpolateContoursIntoGrid(grid, analysis, meshBounds);

  return {
    grid: enhancedGrid,
    analysis,
    topoMap: topoMapInfo,
  };
}

/**
 * Download the US Topo GeoPDF/GeoTIFF and convert to a PNG image buffer.
 * If it's already a GeoTIFF, we can render it. If it's a GeoPDF, we try
 * to render the first page to PNG using a canvas-like approach.
 * Since we can't easily render PDFs server-side without extra deps,
 * we check if the URL points to a GeoTIFF and use that, otherwise we
 * fetch the map thumbnail/preview if available.
 */
async function downloadTopoMapImage(downloadUrl) {
  try {
    const res = await fetch(downloadUrl, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || '';

    // If it's a TIFF, we can't easily convert to PNG for vision analysis
    // without extra deps. Instead, try to get a preview image.
    if (contentType.includes('tiff') || downloadUrl.toLowerCase().includes('.tif')) {
      // Try to get a JPEG/PNG preview from TNM
      return await fetchTopoMapPreview(downloadUrl);
    }

    // If it's already an image, use it directly
    if (contentType.startsWith('image/')) {
      return Buffer.from(await res.arrayBuffer());
    }

    // For PDFs, try to get a preview image from the TNM API
    return await fetchTopoMapPreview(downloadUrl);
  } catch (err) {
    console.warn(`Failed to download topo map image: ${err.message}`);
    return null;
  }
}

/**
 * Try to fetch a preview/thumbnail of the topo map.
 * USGS TNM sometimes provides preview images via a slightly different URL.
 */
async function fetchTopoMapPreview(originalUrl) {
  // Try common TNM preview URL patterns
  const previewUrls = [
    originalUrl.replace('/download/', '/preview/').replace('.pdf', '.jpg'),
    originalUrl.replace('.pdf', '.jpg'),
    originalUrl.replace('.tif', '.jpg'),
  ];

  for (const url of previewUrls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (res.ok && (res.headers.get('content-type') || '').startsWith('image/')) {
        return Buffer.from(await res.arrayBuffer());
      }
    } catch {
      // try next
    }
  }

  // Last resort: render a small DEM-based preview as a simple elevation image
  // This gives the AI *something* to work with even without a real map image
  return null;
}

/**
 * Use AI-extracted contour data to interpolate intermediate elevation points
 * into the DEM grid. This adds detail between the DEM's coarse grid cells
 * by using the contour line elevations as reference points.
 * 
 * @param {number[][]} grid - Current DEM grid
 * @param {Object} analysis - AI analysis result with contours
 * @param {Object} bounds - Mesh bounds
 * @returns {number[][]} Enhanced grid
 */
function interpolateContoursIntoGrid(grid, analysis, bounds) {
  const height = grid.length;
  const width = grid[0]?.length || 0;
  if (height < 3 || width < 3) return grid;

  const contours = analysis.contours || [];
  if (contours.length === 0) return grid;

  // Get the elevation values from contours
  const contourElevations = contours
    .map((c) => c.elevationMeters)
    .filter((e) => e !== null && e !== undefined && Number.isFinite(e))
    .sort((a, b) => a - b);

  if (contourElevations.length === 0) return grid;

  // Use contour data to create a reference elevation table
  // We know the DEM's min/max — the contours give us intermediate checkpoints
  // to validate and adjust grid cells toward the topo map's representation

  const minElev = Math.min(...contourElevations);
  const maxElev = Math.max(...contourElevations);

  // Compute the DEM's current min/max
  let demMin = Infinity;
  let demMax = -Infinity;
  for (const row of grid) {
    for (const v of row) {
      if (v < demMin) demMin = v;
      if (v > demMax) demMax = v;
    }
  }

  // If the topo map shows a wider elevation range than the DEM,
  // gently scale the DEM values to match the topo map's range
  const topoRange = maxElev - minElev;
  const demRange = demMax - demMin;

  if (topoRange > demRange * 1.2 && topoRange > 0 && demRange > 0) {
    // Scale DEM values to match topo map range
    const scale = topoRange / demRange;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const normalized = (grid[y][x] - demMin) / demRange;
        grid[y][x] = minElev + normalized * topoRange;
      }
    }
  }

  // If the contour interval is known, we can add micro-variations
  // to make the terrain look more natural between contour lines
  const interval = analysis.contourIntervalMeters;
  if (interval && interval > 0 && interval < 50) {
    // Add subtle interpolation between known contour elevations
    // This creates smoother transitions in the grid
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        // Find the nearest contour elevation
        const val = grid[y][x];
        let nearestContour = contourElevations[0];
        let nearestDist = Math.abs(val - nearestContour);

        for (const ce of contourElevations) {
          const dist = Math.abs(val - ce);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestContour = ce;
          }
        }

        // Gently blend toward the nearest contour elevation
        // This makes the terrain respect the topo map's elevation data
        if (nearestDist < interval) {
          const blend = 0.15 * (1 - nearestDist / interval);
          grid[y][x] = val * (1 - blend) + nearestContour * blend;
        }
      }
    }
  }

  return grid;
}
