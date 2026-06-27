import { fetchUtilities, getAvailableUtilities } from '../services/utilities/sources.js';

export default async function (fastify) {
  fastify.get('/', {
    onRequest: [fastify.authenticate],
  }, async (req) => {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const utilityType = req.query.type || 'sewer';

    let bounds;
    if (req.query.bounds) {
      try {
        bounds = JSON.parse(req.query.bounds);
      } catch {
        return { error: 'Invalid bounds JSON' };
      }
    } else if (Number.isFinite(lat) && Number.isFinite(lon)) {
      const size = 0.01;
      bounds = {
        minLat: lat - size,
        maxLat: lat + size,
        minLon: lon - size,
        maxLon: lon + size,
      };
    } else {
      return { error: 'lat/lon or bounds required' };
    }

    const features = await fetchUtilities(bounds, utilityType);

    return {
      type: 'FeatureCollection',
      features,
      availableTypes: getAvailableUtilities(lat, lon),
    };
  });
}
