import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import path from 'path';
import { existsSync } from 'fs';
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
import jobRoutes from './routes/jobs.js';
import mapRoutes from './routes/maps.js';
import providerRoutes from './routes/providers.js';
import utilityRoutes from './routes/utilities.js';
import environmentRoutes from './routes/environment.js';
import { startWorker } from './services/jobs/worker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildServer() {
  const fastify = Fastify({
    logger: !isProduction,
    trustProxy: true,
    connectionTimeout: config.requestTimeout,
    keepAliveTimeout: config.requestTimeout,
    bodyLimit: 50 * 1024 * 1024,
  });

  // Error handling
  fastify.setErrorHandler(errorHandler);

  // Security, CORS, cookies, rate limiting
  await fastify.register(securityPlugin);

  // Multipart file uploads
  await fastify.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024,
      files: 1,
    },
  });

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
  await fastify.register(jobRoutes, { prefix: '/api/jobs' });
  await fastify.register(mapRoutes, { prefix: '/api/maps' });
  await fastify.register(providerRoutes, { prefix: '/api/providers' });
  await fastify.register(utilityRoutes, { prefix: '/api/utilities' });
  await fastify.register(environmentRoutes, { prefix: '/api/environment' });

  // Health check
  fastify.get('/health', async () => ({ status: 'ok', version: '0.2.0' }));

  // Serve static client in production
  if (isProduction) {
    const { default: fastifyStatic } = await import('@fastify/static');
    const clientRoot = path.join(__dirname, '../dist/client');

    if (!existsSync(clientRoot)) {
      console.error(`Client build directory not found: ${clientRoot}. Run "npm run build" first.`);
    } else {
      console.log(`Serving static files from ${clientRoot}`);
    }

    await fastify.register(fastifyStatic, {
      root: clientRoot,
      prefix: '/',
      wildcard: false,
      decorateReply: true,
      setHeaders: (res, path) => {
        // Never cache the HTML entry point; hashed assets can be cached forever
        if (path.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    });

    fastify.setNotFoundHandler((req, reply) => {
      // If the request looks like a static asset but wasn't found, return 404
      if (/\.[a-zA-Z0-9]+$/.test(req.raw.url) && !req.raw.url.endsWith('.html')) {
        reply.status(404).send({ error: 'Not found' });
        return;
      }
      try {
        reply.sendFile('index.html');
      } catch (err) {
        reply.type('text/html').send('<h1>Build Error</h1><p>Client files not found. The build may have failed.</p>');
      }
    });
  }

  return fastify;
}

async function start() {
  try {
    const fastify = await buildServer();
    const address = await fastify.listen({ port: config.port, host: '0.0.0.0' });
    fastify.log.info(`Server listening on ${address}`);
    startWorker();
  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
}

start();

export { buildServer };
