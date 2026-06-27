import { fetchSocrataFeatures } from './arcgis.js';

export const UTILITY_SOURCES = {
  san_francisco: {
    sewer: {
      url: 'https://data.sfgov.org/resource',
      datasetId: 'wg7w-7t6v',
      type: 'sewer',
      label: 'Sewer Mains',
    },
    water: {
      url: 'https://data.sfgov.gov/resource',
      datasetId: 'b27m-yh7b',
      type: 'water',
      label: 'Water Mains',
    },
  },
};

const SF_BOUNDS = {
  minLat: 37.70,
  maxLat: 37.82,
  minLon: -122.52,
  maxLon: -122.35,
};

export async function fetchUtilities(bounds, utilityType = 'sewer') {
  const citySource = UTILITY_SOURCES.san_francisco;
  const source = citySource[utilityType];

  if (!source) {
    return generateSampleUtilities(bounds, utilityType);
  }

  try {
    const features = await fetchSocrataFeatures(source.url, source.datasetId, bounds);

    if (features.length === 0) {
      return generateSampleUtilities(bounds, utilityType);
    }

    return features.map((f) => ({
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        ...f.properties,
        utilityType,
        diameter: f.properties?.pipe_diameter || f.properties?.diameter || null,
        material: f.properties?.material || f.properties?.pipe_type || null,
        label: source.label,
      },
    }));
  } catch (err) {
    console.warn(`Failed to fetch ${utilityType} from ${source.datasetId}: ${err.message}`);
    return generateSampleUtilities(bounds, utilityType);
  }
}

export function getAvailableUtilities(lat, lon) {
  if (lat >= SF_BOUNDS.minLat && lat <= SF_BOUNDS.maxLat &&
      lon >= SF_BOUNDS.minLon && lon <= SF_BOUNDS.maxLon) {
    return ['sewer', 'water'];
  }
  return [];
}

function generateSampleUtilities(bounds, utilityType) {
  const { minLat, minLon, maxLat, maxLon } = bounds;
  const midLat = (minLat + maxLat) / 2;
  const midLon = (minLon + maxLon) / 2;
  const latSpan = maxLat - minLat;
  const lonSpan = maxLon - minLon;

  const features = [];
  const numPipes = 3 + Math.floor(Math.random() * 3);

  for (let i = 0; i < numPipes; i++) {
    const segments = 4 + Math.floor(Math.random() * 4);
    const coords = [];
    let lat = minLat + Math.random() * latSpan;
    let lon = minLon + Math.random() * lonSpan;
    const dLat = (Math.random() - 0.5) * latSpan * 0.3;
    const dLon = (Math.random() - 0.5) * lonSpan * 0.3;

    coords.push([lon, lat]);
    for (let s = 0; s < segments; s++) {
      lat = Math.max(minLat, Math.min(maxLat, lat + dLat + (Math.random() - 0.5) * latSpan * 0.1));
      lon = Math.max(minLon, Math.min(maxLon, lon + dLon + (Math.random() - 0.5) * lonSpan * 0.1));
      coords.push([lon, lat]);
    }

    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coords,
      },
      properties: {
        utilityType,
        diameter: 0.3 + Math.random() * 0.8,
        material: utilityType === 'sewer' ? 'Vitrified Clay' : 'Ductile Iron',
        label: utilityType === 'sewer' ? 'Sewer Main' : 'Water Main',
        isSample: true,
      },
    });
  }

  return features;
}
