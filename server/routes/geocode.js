import { geocodeAddress, computeBounds } from '../services/geocode.js';

export default async function (fastify) {
  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['address'],
        properties: {
          address: { type: 'string', minLength: 1 },
          sizeMeters: { type: 'number', minimum: 100, maximum: 10000 },
        },
      },
    },
  }, async (req) => {
    const { address, sizeMeters = 1000 } = req.body;
    const result = await geocodeAddress(address);
    const bounds = computeBounds({ lat: result.lat, lon: result.lon }, sizeMeters);

    return {
      center: { lat: result.lat, lon: result.lon },
      displayName: result.displayName,
      bounds,
      address: result.address,
    };
  });
}
