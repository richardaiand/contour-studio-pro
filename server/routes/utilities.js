// V2: Utility routes
// TODO: GET /api/utilities?lat=&lon=&bounds=&type=
// TODO: Returns GeoJSON features for pipe/utility lines

export default async function (fastify) {
  fastify.get('/', {
    // TODO: Add auth
  }, async (req) => {
    // TODO: Parse bounds from query
    // TODO: Call fetchUtilities(bounds, type)
    // TODO: Return GeoJSON FeatureCollection
    return { type: 'FeatureCollection', features: [] };
  });
}
