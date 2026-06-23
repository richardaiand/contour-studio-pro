import Fastify from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, isProduction } from './config.js';
import { runMigrations } from './db.js';
import securityPlugin from './security.js';
import authPlugin from './plugins/auth.js';
import { errorHandler } from './errors.js';

import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import geocodeRoutes from './routes/geocode.js';
import terrainRoutes from './routes/terrain.js';
import catalogRoutes from './routes/catalog.js';
import chatRoutes from './routes/chat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildServer() {
  const fastify = Fastify({
    logger: !isProduction,
    trustProxy: true,
    connectionTimeout: config.requestTimeout,
    keepAliveTimeout: config.requestTimeout,
  });

  // Error handling
  fastify.setErrorHandler(errorHandler);

  // Security, CORS, cookies, rate limiting
  await fastify.register(securityPlugin);

  // Auth hook
  await fastify.register(authPlugin);

  // Run DB migrations
  runMigrations();

  // API routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(projectRoutes, { prefix: '/api/projects' });
  await fastify.register(geocodeRoutes, { prefix: '/api/geocode' });
  await fastify.register(terrainRoutes, { prefix: '/api/terrain' });
  await fastify.register(catalogRoutes, { prefix: '/api/catalog' });
  await fastify.register(chatRoutes, { prefix: '/api/chat' });

  // Health check
  fastify.get('/health', async () => ({ status: 'ok', version: '0.1.0' }));

  // Serve static client in production
  if (isProduction) {
    const { default: fastifyStatic } = await import('@fastify/static');
    await fastify.register(fastifyStatic, {
      root: path.join(__dirname, '../dist/client'),
      prefix: '/',
    });

    fastify.setNotFoundHandler((req, reply) => {
      reply.sendFile('index.html');
    });
  }

  return fastify;
}

async function start() {
  try {
    const fastify = await buildServer();
    const address = await fastify.listen({ port: config.port, host: '0.0.0.0' });
    fastify.log.info(`Server listening on ${address}`);
  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
}

start();

export { buildServer };
