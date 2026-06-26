// V3: Soil data from ISRIC SoilGrids
// TODO: Fetch soil type and properties for a location
// API: https://rest.isric.org/soilgrids/v2.0/properties/query?lon=&lat=

export async function fetchSoilData(lat, lon) {
  // TODO: Query SoilGrids API
  // TODO: Extract: soil type, clay content, sand content, bulk density, organic carbon
  // TODO: Return { soilType, clayPercent, sandPercent, bulkDensity, organicCarbon, drainageClass }
  throw new Error('Not implemented — see ROADMAP.md V3.1');
}

export function classifySoil(clayPercent, sandPercent) {
  // TODO: USDA soil texture classification
  // TODO: Return texture class (e.g., 'clay', 'loam', 'sandy loam')
  throw new Error('Not implemented — see ROADMAP.md V3.1');
}
