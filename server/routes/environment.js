// V3: Environmental site data routes
// TODO: GET /api/environment?lat=&lon=
// TODO: Returns climate, precipitation, seismic, soil data

export default async function (fastify) {
  fastify.get('/', async (req) => {
    const { lat, lon } = req.query;
    // TODO: Call all environmental data services in parallel
    // TODO: Return combined report
    return {
      climate: null,
      seismic: null,
      soil: null,
      summary: null,
    };
  });
}
