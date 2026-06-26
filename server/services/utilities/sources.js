// V2: Utility line data integration
// TODO: Implement ArcGIS REST API client for municipal utility data
// Starting with San Francisco DataSF sewer mains as proof of concept

// ArcGIS REST API endpoint format:
// https://data.sfgov.org/resource/{dataset_id}.json?$where=within_box(geom, minLat, minLon, maxLat, maxLon)

// TODO: Implement fetchUtilities(bounds, type)
// TODO: Support types: sewer, water, gas, electric
// TODO: Return GeoJSON features with pipe geometry

export const UTILITY_SOURCES = {
  // TODO: Add real dataset IDs
  san_francisco: {
    sewer: {
      url: 'https://data.sfgov.org/resource/',
      datasetId: 'TODO',
      type: 'sewer_main',
    },
    water: {
      url: 'https://data.sfgov.org/resource/',
      datasetId: 'TODO',
      type: 'water_main',
    },
  },
};

export async function fetchUtilities(bounds, utilityType = 'sewer') {
  // TODO: Query ArcGIS REST API within bounds
  // TODO: Return array of { type, geometry, diameter, depth, material }
  throw new Error('Not implemented — see ROADMAP.md V2.1');
}

export function getAvailableUtilities(lat, lon) {
  // TODO: Return available utility sources for a given location
  // TODO: Only San Francisco for demo; expand later
  return ['sewer', 'water'];
}
