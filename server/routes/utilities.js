import { fetchUtilities, getAvailableUtilities } from '../services/utilities/sources.js';
import { AppError } from '../errors.js';

export default async function (fastify) {
  fastify.get('/', {
    onRequest: [fastify.authenticate],
  }, async (req, reply) => {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const utilityType = req.query.type || 'sewer';

    let bounds;
    if (req.query.bounds) {
      try {
        bounds = JSON.parse(req.query.bounds);
      } catch {
        throw new AppError('Invalid bounds JSON', 400, 'BAD_REQUEST');
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
      throw new AppError('lat/lon or bounds required', 400, 'BAD_REQUEST');
    }

    const features = await fetchUtilities(bounds, utilityType);

    return {
      type: 'FeatureCollection',
      features,
      availableTypes: getAvailableUtilities(lat, lon),
    };
  });
}
