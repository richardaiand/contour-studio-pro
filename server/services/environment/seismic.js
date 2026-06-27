import { AppError } from '../../errors.js';

export async function fetchSeismicData(lat, lon, radiusKm = 100) {
  const startTime = new Date();
  startTime.setFullYear(startTime.getFullYear() - 25);

  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${lat}&longitude=${lon}&maxradiuskm=${radiusKm}&starttime=${startTime.toISOString().split('T')[0]}&minmagnitude=2.5`;

  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) {
    throw new AppError(`USGS API error ${res.status}`, 502, 'SEISMIC_ERROR');
  }

  const data = await res.json();
  const features = data.features || [];

  let maxMagnitude = 0;
  let totalCount = features.length;
  const allEvents = [];

  for (const f of features) {
    const mag = f.properties?.mag || 0;
    if (mag > maxMagnitude) maxMagnitude = mag;

    allEvents.push({
      magnitude: Math.round(mag * 10) / 10,
      place: f.properties?.place || 'Unknown',
      time: f.properties?.time || 0,
      url: f.properties?.url || null,
    });
  }

  allEvents.sort((a, b) => b.magnitude - a.magnitude);
  const recentEvents = allEvents.slice(0, 10);

  return {
    maxMagnitude: Math.round(maxMagnitude * 10) / 10,
    earthquakeCount: totalCount,
    riskLevel: calculateSeismicRisk(features),
    radiusKm,
    recentEvents,
  };
}

export function calculateSeismicRisk(earthquakes) {
  let maxMag = 0;
  let significantCount = 0;

  for (const f of earthquakes) {
    const mag = f.properties?.mag || 0;
    if (mag > maxMag) maxMag = mag;
    if (mag >= 5.0) significantCount++;
  }

  if (maxMag >= 7.0 || significantCount >= 10) return 'very high';
  if (maxMag >= 6.0 || significantCount >= 5) return 'high';
  if (maxMag >= 5.0 || earthquakes.length >= 20) return 'moderate';
  if (earthquakes.length >= 5) return 'low';
  return 'very low';
}
