import { findSourcesForBounds, seedCatalog } from '../services/catalog/registry.js';

export default async function (fastify) {
  // Seed catalog on first request if needed
  fastify.addHook('onReady', () => {
    seedCatalog();
  });

  fastify.post('/search', {
    schema: {
      body: {
        type: 'object',
        required: ['bounds'],
        properties: {
          bounds: {
            type: 'object',
            required: ['minLat', 'maxLat', 'minLon', 'maxLon'],
            properties: {
              minLat: { type: 'number' },
              maxLat: { type: 'number' },
              minLon: { type: 'number' },
              maxLon: { type: 'number' },
            },
          },
        },
      },
    },
  }, async (req) => {
    const sources = findSourcesForBounds(req.body.bounds);
    return { sources };
  });
}
