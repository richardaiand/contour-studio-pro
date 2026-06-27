import { fetchClimateData, fetchCurrentWeather } from '../services/environment/climate.js';
import { fetchSeismicData, calculateSeismicRisk } from '../services/environment/seismic.js';
import { fetchSoilData, classifySoil } from '../services/environment/soil.js';

export default async function (fastify) {
  fastify.get('/', {
    onRequest: [fastify.authenticate],
  }, async (req) => {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return { error: 'lat and lon are required' };
    }

    const [climateResult, seismicResult, soilResult, weatherResult] = await Promise.allSettled([
      fetchClimateData(lat, lon),
      fetchSeismicData(lat, lon),
      fetchSoilData(lat, lon),
      fetchCurrentWeather(lat, lon),
    ]);

    const climate = climateResult.status === 'fulfilled' ? climateResult.value : null;
    const seismic = seismicResult.status === 'fulfilled' ? seismicResult.value : null;
    const soil = soilResult.status === 'fulfilled' ? soilResult.value : null;
    const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null;

    const errors = [];
    if (climateResult.status === 'rejected') errors.push({ source: 'climate', error: climateResult.reason.message });
    if (seismicResult.status === 'rejected') errors.push({ source: 'seismic', error: seismicResult.reason.message });
    if (soilResult.status === 'rejected') errors.push({ source: 'soil', error: soilResult.reason.message });
    if (weatherResult.status === 'rejected') errors.push({ source: 'weather', error: weatherResult.reason.message });

    const summary = generateSummary(climate, seismic, soil);

    return {
      climate,
      weather,
      seismic,
      soil,
      summary,
      errors: errors.length > 0 ? errors : undefined,
    };
  });
}

function generateSummary(climate, seismic, soil) {
  const parts = [];

  if (climate) {
    parts.push(`The climate is ${climate.climateZone.toLowerCase()} with an average temperature of ${climate.avgTempC}°C and ${climate.avgPrecipMm}mm average daily precipitation.`);
  }

  if (seismic) {
    const riskText = seismic.riskLevel === 'very high' ? 'very high' : seismic.riskLevel;
    parts.push(`Seismic risk is ${riskText}. ${seismic.earthquakeCount} earthquakes (M≥2.5) recorded within 100km in the last 25 years, with a maximum magnitude of ${seismic.maxMagnitude}.`);
  }

  if (soil) {
    parts.push(`The soil is classified as ${soil.soilType} with ${soil.clayPercent}% clay, ${soil.sandPercent}% sand, and ${soil.organicCarbon}g/kg organic carbon.`);
  }

  return parts.length > 0 ? parts.join(' ') : 'Environmental data not available for this location.';
}
